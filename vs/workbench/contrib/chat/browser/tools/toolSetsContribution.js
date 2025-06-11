/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { isFalsyOrEmpty } from '../../../../../base/common/arrays.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { observableFromEvent, observableSignalFromEvent, autorun, transaction } from '../../../../../base/common/observable.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { isFalsyOrWhitespace } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType, isObject } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../common/languageModelToolsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { Codicon, getAllCodicons } from '../../../../../base/common/codicons.js';
import { isValidBasename } from '../../../../../base/common/extpath.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { parse } from '../../../../../base/common/jsonc.js';
import * as JSONContributionRegistry from '../../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ChatViewId } from '../chat.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
const toolEnumValues = [];
const toolEnumDescriptions = [];
const toolSetSchemaId = 'vscode://schemas/toolsets';
const toolSetsSchema = {
    id: toolSetSchemaId,
    allowComments: true,
    allowTrailingCommas: true,
    defaultSnippets: [{
            label: localize('schema.default', "Empty tool set"),
            body: { '${1:toolSetName}': { 'tools': ['${2:someTool}', '${3:anotherTool}'], 'description': '${4:description}', 'icon': '${5:tools}' } }
        }],
    type: 'object',
    description: localize('toolsetSchema.json', 'User tool sets configuration'),
    additionalProperties: {
        type: 'object',
        required: ['tools'],
        additionalProperties: false,
        properties: {
            tools: {
                description: localize('schema.tools', "A list of tools or tool sets to include in this tool set. Cannot be empty and must reference tools the way they are referenced in prompts."),
                type: 'array',
                minItems: 1,
                items: {
                    type: 'string',
                    enum: toolEnumValues,
                    enumDescriptions: toolEnumDescriptions,
                }
            },
            icon: {
                description: localize('schema.icon', "Icon to use for this tool set in the UI. Uses the `\\$(name)`-syntax, like `\\$(zap)`"),
                type: 'string',
                enum: Array.from(getAllCodicons(), icon => icon.id),
                markdownEnumDescriptions: Array.from(getAllCodicons(), icon => `$(${icon.id})`),
            },
            description: {
                description: localize('schema.description', "A short description of this tool set."),
                type: 'string'
            },
        },
    }
};
const reg = Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
class RawToolSetsShape {
    static { this.suffix = '.toolsets.jsonc'; }
    static isToolSetFileName(uri) {
        return basename(uri).endsWith(RawToolSetsShape.suffix);
    }
    static from(data, logService) {
        if (!isObject(data)) {
            throw new Error(`Invalid tool set data`);
        }
        const map = new Map();
        for (const [name, value] of Object.entries(data)) {
            if (isFalsyOrWhitespace(name)) {
                logService.error(`Tool set name cannot be empty`);
            }
            if (isFalsyOrEmpty(value.tools)) {
                logService.error(`Tool set '${name}' cannot have an empty tools array`);
            }
            map.set(name, {
                name,
                tools: value.tools,
                description: value.description,
                icon: value.icon,
            });
        }
        return new class extends RawToolSetsShape {
        }(map);
    }
    constructor(entries) {
        this.entries = Object.freeze(new Map(entries));
    }
}
let UserToolSetsContributions = class UserToolSetsContributions extends Disposable {
    static { this.ID = 'chat.userToolSets'; }
    constructor(extensionService, lifecycleService, _languageModelToolsService, _userDataProfileService, _fileService, _logService) {
        super();
        this._languageModelToolsService = _languageModelToolsService;
        this._userDataProfileService = _userDataProfileService;
        this._fileService = _fileService;
        this._logService = _logService;
        Promise.allSettled([
            extensionService.whenInstalledExtensionsRegistered,
            lifecycleService.when(3 /* LifecyclePhase.Restored */)
        ]).then(() => this._initToolSets());
        const toolsObs = observableFromEvent(this, _languageModelToolsService.onDidChangeTools, () => Array.from(_languageModelToolsService.getTools()));
        const store = this._store.add(new DisposableStore());
        this._store.add(autorun(r => {
            const tools = toolsObs.read(r);
            const toolSets = this._languageModelToolsService.toolSets.read(r);
            const data = [];
            for (const tool of tools) {
                if (tool.canBeReferencedInPrompt) {
                    data.push({
                        name: tool.toolReferenceName ?? tool.displayName,
                        sourceLabel: ToolDataSource.classify(tool.source).label,
                        sourceOrdinal: ToolDataSource.classify(tool.source).ordinal,
                        description: tool.userDescription ?? tool.modelDescription
                    });
                }
            }
            for (const toolSet of toolSets) {
                data.push({
                    name: toolSet.referenceName,
                    sourceLabel: ToolDataSource.classify(toolSet.source).label,
                    sourceOrdinal: ToolDataSource.classify(toolSet.source).ordinal,
                    description: toolSet.description
                });
            }
            toolEnumValues.length = 0;
            toolEnumDescriptions.length = 0;
            data.sort((a, b) => {
                if (a.sourceOrdinal !== b.sourceOrdinal) {
                    return a.sourceOrdinal - b.sourceOrdinal;
                }
                if (a.sourceLabel !== b.sourceLabel) {
                    return a.sourceLabel.localeCompare(b.sourceLabel);
                }
                return a.name.localeCompare(b.name);
            });
            for (const item of data) {
                toolEnumValues.push(item.name);
                toolEnumDescriptions.push(localize('tool.description', "{1} ({0})\n\n{2}", item.sourceLabel, item.name, item.description));
            }
            store.clear(); // reset old schema
            reg.registerSchema(toolSetSchemaId, toolSetsSchema, store);
        }));
    }
    _initToolSets() {
        const promptFolder = observableFromEvent(this, this._userDataProfileService.onDidChangeCurrentProfile, () => this._userDataProfileService.currentProfile.promptsHome);
        const toolsSig = observableSignalFromEvent(this, this._languageModelToolsService.onDidChangeTools);
        const fileEventSig = observableSignalFromEvent(this, Event.filter(this._fileService.onDidFilesChange, e => e.affects(promptFolder.get())));
        const store = this._store.add(new DisposableStore());
        const getFilesInFolder = async (folder) => {
            try {
                return (await this._fileService.resolve(folder)).children ?? [];
            }
            catch (err) {
                return []; // folder does not exist or cannot be read
            }
        };
        this._store.add(autorun(async (r) => {
            store.clear();
            toolsSig.read(r); // SIGNALS
            fileEventSig.read(r);
            const uri = promptFolder.read(r);
            const cts = new CancellationTokenSource();
            store.add(toDisposable(() => cts.dispose(true)));
            const entries = await getFilesInFolder(uri);
            if (cts.token.isCancellationRequested) {
                store.clear();
                return;
            }
            for (const entry of entries) {
                if (!entry.isFile || !RawToolSetsShape.isToolSetFileName(entry.resource)) {
                    // not interesting
                    continue;
                }
                // watch this file
                store.add(this._fileService.watch(entry.resource));
                let data;
                try {
                    const content = await this._fileService.readFile(entry.resource, undefined, cts.token);
                    const rawObj = parse(content.value.toString());
                    data = RawToolSetsShape.from(rawObj, this._logService);
                }
                catch (err) {
                    this._logService.error(`Error reading tool set file ${entry.resource.toString()}:`, err);
                    continue;
                }
                if (cts.token.isCancellationRequested) {
                    store.dispose();
                    break;
                }
                for (const [name, value] of data.entries) {
                    const tools = [];
                    const toolSets = [];
                    value.tools.forEach(name => {
                        const tool = this._languageModelToolsService.getToolByName(name);
                        if (tool) {
                            tools.push(tool);
                            return;
                        }
                        const toolSet = this._languageModelToolsService.getToolSetByName(name);
                        if (toolSet) {
                            toolSets.push(toolSet);
                            return;
                        }
                    });
                    if (tools.length === 0 && toolSets.length === 0) {
                        // NO tools in this set
                        continue;
                    }
                    const toolset = this._languageModelToolsService.createToolSet({ type: 'user', file: entry.resource, label: basename(entry.resource) }, `user/${entry.resource.toString()}/${name}`, name, {
                        // toolReferenceName: value.referenceName,
                        icon: value.icon ? ThemeIcon.fromId(value.icon) : undefined,
                        description: value.description
                    });
                    transaction(tx => {
                        store.add(toolset);
                        tools.forEach(tool => store.add(toolset.addTool(tool, tx)));
                        toolSets.forEach(toolSet => store.add(toolset.addToolSet(toolSet, tx)));
                    });
                }
            }
        }));
    }
};
UserToolSetsContributions = __decorate([
    __param(0, IExtensionService),
    __param(1, ILifecycleService),
    __param(2, ILanguageModelToolsService),
    __param(3, IUserDataProfileService),
    __param(4, IFileService),
    __param(5, ILogService)
], UserToolSetsContributions);
export { UserToolSetsContributions };
// ---- actions
export class ConfigureToolSets extends Action2 {
    static { this.ID = 'chat.configureToolSets'; }
    constructor() {
        super({
            id: ConfigureToolSets.ID,
            title: localize2('chat.configureToolSets', 'Configure Tool Sets'),
            category: CHAT_CATEGORY,
            f1: true,
            precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.Tools.toolsCount.greater(0)),
            menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.equals('view', ChatViewId),
                order: 11,
                group: '2_manage'
            },
        });
    }
    async run(accessor) {
        const toolsService = accessor.get(ILanguageModelToolsService);
        const quickInputService = accessor.get(IQuickInputService);
        const editorService = accessor.get(IEditorService);
        const userDataProfileService = accessor.get(IUserDataProfileService);
        const fileService = accessor.get(IFileService);
        const textFileService = accessor.get(ITextFileService);
        const picks = [];
        picks.push({
            label: localize('chat.configureToolSets.add', 'Create new tool sets file...'),
            alwaysShow: true,
            iconClass: ThemeIcon.asClassName(Codicon.plus)
        });
        for (const toolSet of toolsService.toolSets.get()) {
            if (toolSet.source.type !== 'user') {
                continue;
            }
            picks.push({
                label: toolSet.referenceName,
                toolset: toolSet,
                tooltip: toolSet.description,
                iconClass: ThemeIcon.asClassName(toolSet.icon)
            });
        }
        const pick = await quickInputService.pick(picks, {
            canPickMany: false,
            placeHolder: localize('chat.configureToolSets.placeholder', 'Select a tool set to configure'),
        });
        if (!pick) {
            return; // user cancelled
        }
        let resource;
        if (!pick.toolset) {
            const name = await quickInputService.input({
                placeHolder: localize('input.placeholder', "Type tool sets file name"),
                validateInput: async (input) => {
                    if (!input) {
                        return localize('bad_name1', "Invalid file name");
                    }
                    if (!isValidBasename(input)) {
                        return localize('bad_name2', "'{0}' is not a valid file name", input);
                    }
                    return undefined;
                }
            });
            if (isFalsyOrWhitespace(name)) {
                return; // user cancelled
            }
            resource = joinPath(userDataProfileService.currentProfile.promptsHome, `${name}${RawToolSetsShape.suffix}`);
            if (!await fileService.exists(resource)) {
                await textFileService.write(resource, [
                    '// Place your tool sets here...',
                    '// Example:',
                    '// {',
                    '// \t"toolSetName": {',
                    '// \t\t"tools": [',
                    '// \t\t\t"someTool",',
                    '// \t\t\t"anotherTool"',
                    '// \t\t],',
                    '// \t\t"description": "description",',
                    '// \t\t"icon": "tools"',
                    '// \t}',
                    '// }',
                ].join('\n'));
            }
        }
        else {
            assertType(pick.toolset.source.type === 'user');
            resource = pick.toolset.source.file;
        }
        await editorService.openEditor({ resource, options: { pinned: true } });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbFNldHNDb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci90b29scy90b29sU2V0c0NvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDckYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSx5QkFBeUIsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEksT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRTdFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsa0JBQWtCLEVB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