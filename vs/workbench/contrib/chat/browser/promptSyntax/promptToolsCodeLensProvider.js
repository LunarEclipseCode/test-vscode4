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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { isITextModel } from '../../../../../editor/common/model.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { localize } from '../../../../../nls.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { showToolsPicker } from '../actions/chatToolPicker.js';
import { ILanguageModelToolsService, ToolSet } from '../../common/languageModelToolsService.js';
import { ALL_PROMPTS_LANGUAGE_SELECTOR } from '../../common/promptSyntax/promptTypes.js';
import { PromptToolsMetadata } from '../../common/promptSyntax/parsers/promptHeader/metadata/tools.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { registerEditorFeature } from '../../../../../editor/common/editorFeatures.js';
let PromptToolsCodeLensProvider = class PromptToolsCodeLensProvider extends Disposable {
    constructor(promptsService, languageService, languageModelToolsService, instantiationService) {
        super();
        this.promptsService = promptsService;
        this.languageService = languageService;
        this.languageModelToolsService = languageModelToolsService;
        this.instantiationService = instantiationService;
        // `_`-prefix marks this as private command
        this.cmdId = `_configure/${generateUuid()}`;
        this._register(this.languageService.codeLensProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, this));
        this._register(CommandsRegistry.registerCommand(this.cmdId, (_accessor, ...args) => {
            const [first, second] = args;
            if (isITextModel(first) && second instanceof PromptToolsMetadata) {
                this.updateTools(first, second);
            }
        }));
    }
    async provideCodeLenses(model, token) {
        const parser = this.promptsService.getSyntaxParserFor(model);
        const { header } = await parser
            .start()
            .settled();
        if ((header === undefined) || token.isCancellationRequested) {
            return undefined;
        }
        if (('tools' in header.metadataUtility) === false) {
            return undefined;
        }
        const { tools } = header.metadataUtility;
        if (tools === undefined) {
            return undefined;
        }
        const codeLens = {
            range: tools.range.collapseToStart(),
            command: {
                title: localize('configure-tools.capitalized.ellipsis', "Configure Tools..."),
                id: this.cmdId,
                arguments: [model, tools]
            }
        };
        return { lenses: [codeLens] };
    }
    async updateTools(model, tools) {
        const toolNames = new Set(tools.value);
        const selectedToolsNow = new Map();
        for (const tool of this.languageModelToolsService.getTools()) {
            selectedToolsNow.set(tool, toolNames.has(tool.toolReferenceName ?? tool.displayName));
        }
        for (const toolSet of this.languageModelToolsService.toolSets.get()) {
            selectedToolsNow.set(toolSet, toolNames.has(toolSet.referenceName));
        }
        const newSelectedAfter = await this.instantiationService.invokeFunction(showToolsPicker, localize('placeholder', "Select tools"), selectedToolsNow);
        if (!newSelectedAfter) {
            return;
        }
        const newToolNames = [];
        for (const [item, picked] of newSelectedAfter) {
            if (picked) {
                if (item instanceof ToolSet) {
                    newToolNames.push(item.referenceName);
                }
                else {
                    newToolNames.push(item.toolReferenceName ?? item.displayName);
                }
            }
        }
        model.pushStackElement();
        model.pushEditOperations(null, [EditOperation.replaceMove(tools.range, `tools: [${newToolNames.map(s => `'${s}'`).join(', ')}]`)], () => null);
        model.pushStackElement();
    }
};
PromptToolsCodeLensProvider = __decorate([
    __param(0, IPromptsService),
    __param(1, ILanguageFeaturesService),
    __param(2, ILanguageModelToolsService),
    __param(3, IInstantiationService)
], PromptToolsCodeLensProvider);
registerEditorFeature(PromptToolsCodeLensProvider);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VG9vbHNDb2RlTGVuc1Byb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvcHJvbXB0U3ludGF4L3Byb21wdFRvb2xzQ29kZUxlbnNQcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUVuRixPQUFPLEVBQUUsWUFBWSxFQUFjLE1BQU0sdUNBQXVDLENBQUM7QUFDakYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDckcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsMEJBQTBCLEVBQWEsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0csT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDdkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRXZGLElBQU0sMkJBQTJCLEdBQWpDLE1BQU0sMkJBQTRC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