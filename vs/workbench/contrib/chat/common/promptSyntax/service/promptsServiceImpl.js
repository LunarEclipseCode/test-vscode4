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
import { flatten } from '../utils/treeUtils.js';
import { localize } from '../../../../../../nls.js';
import { isValidPromptType, PROMPT_LANGUAGE_ID, PromptsType } from '../promptTypes.js';
import { PromptParser } from '../parsers/promptParser.js';
import { match, splitGlobAware } from '../../../../../../base/common/glob.js';
import { assert } from '../../../../../../base/common/assert.js';
import { basename } from '../../../../../../base/common/path.js';
import { ResourceSet } from '../../../../../../base/common/map.js';
import { PromptFilesLocator } from '../utils/promptFilesLocator.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ObjectCache } from '../utils/objectCache.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { TextModelPromptParser } from '../parsers/textModelPromptParser.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IUserDataProfileService } from '../../../../../services/userDataProfile/common/userDataProfile.js';
import { getCleanPromptName, PROMPT_FILE_EXTENSION } from '../config/promptFileLocations.js';
/**
 * Provides prompt services.
 */
let PromptsService = class PromptsService extends Disposable {
    constructor(logger, labelService, modelService, instantiationService, userDataService) {
        super();
        this.logger = logger;
        this.labelService = labelService;
        this.modelService = modelService;
        this.instantiationService = instantiationService;
        this.userDataService = userDataService;
        this.fileLocator = this._register(this.instantiationService.createInstance(PromptFilesLocator));
        // the factory function below creates a new prompt parser object
        // for the provided model, if no active non-disposed parser exists
        this.cache = this._register(new ObjectCache((model) => {
            assert(model.isDisposed() === false, 'Text model must not be disposed.');
            /**
             * Note! When/if shared with "file" prompts, the `seenReferences` array below must be taken into account.
             * Otherwise consumers will either see incorrect failing or incorrect successful results, based on their
             * use case, timing of their calls to the {@link getSyntaxParserFor} function, and state of this service.
             */
            const parser = instantiationService.createInstance(TextModelPromptParser, model, { seenReferences: [] }).start();
            // this is a sanity check and the contract of the object cache,
            // we must return a non-disposed object from this factory function
            parser.assertNotDisposed('Created prompt parser must not be disposed.');
            return parser;
        }));
    }
    /**
     * Emitter for the custom chat modes change event.
     */
    get onDidChangeCustomChatModes() {
        if (!this.onDidChangeCustomChatModesEvent) {
            this.onDidChangeCustomChatModesEvent = this._register(this.fileLocator.createFilesUpdatedEvent(PromptsType.mode)).event;
        }
        return this.onDidChangeCustomChatModesEvent;
    }
    /**
     * @throws {Error} if:
     * 	- the provided model is disposed
     * 	- newly created parser is disposed immediately on initialization.
     * 	  See factory function in the {@link constructor} for more info.
     */
    getSyntaxParserFor(model) {
        assert(model.isDisposed() === false, 'Cannot create a prompt syntax parser for a disposed model.');
        return this.cache.get(model);
    }
    async listPromptFiles(type, token) {
        const prompts = await Promise.all([
            this.fileLocator.listFiles(type, 'user', token)
                .then(withType('user', type)),
            this.fileLocator.listFiles(type, 'local', token)
                .then(withType('local', type)),
        ]);
        return prompts.flat();
    }
    getSourceFolders(type) {
        // sanity check to make sure we don't miss a new
        // prompt type that could be added in the future
        assert(isValidPromptType(type), `Unknown prompt type '${type}'.`);
        const result = [];
        for (const uri of this.fileLocator.getConfigBasedSourceFolders(type)) {
            result.push({ uri, storage: 'local', type });
        }
        const userHome = this.userDataService.currentProfile.promptsHome;
        result.push({ uri: userHome, storage: 'user', type });
        return result;
    }
    asPromptSlashCommand(command) {
        if (command.match(/^[\w_\-\.]+$/)) {
            return { command, detail: localize('prompt.file.detail', 'Prompt file: {0}', command) };
        }
        return undefined;
    }
    async resolvePromptSlashCommand(data) {
        const promptUri = await this.getPromptPath(data);
        if (!promptUri) {
            return undefined;
        }
        return await this.getMetadata(promptUri);
    }
    async getPromptPath(data) {
        if (data.promptPath) {
            return data.promptPath.uri;
        }
        const files = await this.listPromptFiles(PromptsType.prompt, CancellationToken.None);
        const command = data.command;
        const result = files.find(file => getPromptCommandName(file.uri.path) === command);
        if (result) {
            return result.uri;
        }
        const textModel = this.modelService.getModels().find(model => model.getLanguageId() === PROMPT_LANGUAGE_ID && getPromptCommandName(model.uri.path) === command);
        if (textModel) {
            return textModel.uri;
        }
        return undefined;
    }
    async findPromptSlashCommands() {
        const promptFiles = await this.listPromptFiles(PromptsType.prompt, CancellationToken.None);
        return promptFiles.map(promptPath => {
            const command = getPromptCommandName(promptPath.uri.path);
            return {
                command,
                detail: localize('prompt.file.detail', 'Prompt file: {0}', this.labelService.getUriLabel(promptPath.uri, { relative: true })),
                promptPath
            };
        });
    }
    async getCustomChatModes() {
        const modeFiles = (await this.listPromptFiles(PromptsType.mode, CancellationToken.None))
            .map(modeFile => modeFile.uri);
        const metadataList = await Promise.all(modeFiles.map(async (uri) => {
            let parser;
            try {
                // Note! this can be (and should be) improved by using shared parser instances
                // 		 that the `getSyntaxParserFor` method provides for opened documents.
                parser = this.instantiationService.createInstance(PromptParser, uri, { allowNonPromptFiles: true }).start();
                await parser.settled();
                const { metadata } = parser;
                const tools = (metadata && ('tools' in metadata))
                    ? metadata.tools
                    : undefined;
                const body = await parser.getBody();
                return {
                    uri: uri,
                    name: getCleanPromptName(uri),
                    description: metadata?.description,
                    tools,
                    body,
                };
            }
            finally {
                parser?.dispose();
            }
        }));
        return metadataList;
    }
    async findInstructionFilesFor(files) {
        const instructionFiles = await this.listPromptFiles(PromptsType.instructions, CancellationToken.None);
        if (instructionFiles.length === 0) {
            return [];
        }
        const instructions = await this.getAllMetadata(instructionFiles.map(file => file.uri));
        const foundFiles = new ResourceSet();
        for (const instruction of instructions.flatMap(flatten)) {
            const { metadata, uri } = instruction;
            if (metadata?.promptType !== PromptsType.instructions) {
                continue;
            }
            const { applyTo } = metadata;
            if (applyTo === undefined) {
                continue;
            }
            const patterns = splitGlobAware(applyTo, ',');
            const patterMatches = (pattern) => {
                pattern = pattern.trim();
                if (pattern.length === 0) {
                    // if glob pattern is empty, skip it
                    return false;
                }
                if (pattern === '**' || pattern === '**/*' || pattern === '*') {
                    // if glob pattern is one of the special wildcard values,
                    // add the instructions file event if no files are attached
                    return true;
                }
                if (!pattern.startsWith('/') && !pattern.startsWith('**/')) {
                    // support relative glob patterns, e.g. `src/**/*.js`
                    pattern = '**/' + pattern;
                }
                // match each attached file with each glob pattern and
                // add the instructions file if its rule matches the file
                for (const file of files) {
                    // if the file is not a valid URI, skip it
                    if (match(pattern, file.path)) {
                        return true;
                    }
                }
                return false;
            };
            if (patterns.some(patterMatches)) {
                foundFiles.add(uri);
            }
        }
        return [...foundFiles];
    }
    async getMetadata(promptFileUri) {
        const metaDatas = await this.getAllMetadata([promptFileUri]);
        return metaDatas[0];
    }
    async getAllMetadata(promptUris) {
        const metadata = await Promise.all(promptUris.map(async (uri) => {
            let parser;
            try {
                parser = this.instantiationService.createInstance(PromptParser, uri, { allowNonPromptFiles: true }).start();
                await parser.allSettled();
                return collectMetadata(parser);
            }
            finally {
                parser?.dispose();
            }
        }));
        return metadata;
    }
};
PromptsService = __decorate([
    __param(0, ILogService),
    __param(1, ILabelService),
    __param(2, IModelService),
    __param(3, IInstantiationService),
    __param(4, IUserDataProfileService)
], PromptsService);
export { PromptsService };
/**
 * Collect all metadata from prompt file references
 * into a single hierarchical tree structure.
 */
function collectMetadata(reference) {
    const childMetadata = [];
    for (const child of reference.references) {
        if (child.errorCondition !== undefined) {
            continue;
        }
        childMetadata.push(collectMetadata(child));
    }
    const children = (childMetadata.length > 0)
        ? childMetadata
        : undefined;
    return {
        uri: reference.uri,
        metadata: reference.metadata,
        children,
    };
}
export function getPromptCommandName(path) {
    const name = basename(path, PROMPT_FILE_EXTENSION);
    return name;
}
/**
 * Utility to add a provided prompt `storage` and
 * `type` attributes to a prompt URI.
 */
function addType(storage, type) {
    return (uri) => {
        return { uri, storage, type };
    };
}
/**
 * Utility to add a provided prompt `type` to a list of prompt URIs.
 */
function withType(storage, type) {
    return (uris) => {
        return uris
            .map(addType(storage, type));
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0c1NlcnZpY2VJbXBsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvc2VydmljZS9wcm9tcHRzU2VydmljZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2hELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDdkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFHOUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBR3hFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDM0UsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxt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