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
import { Emitter } from '../../../../../base/common/event.js';
import { basename, isEqual } from '../../../../../base/common/resources.js';
import { ChatPromptAttachmentModel } from './chatPromptAttachmentModel.js';
import { PromptsConfig } from '../../common/promptSyntax/config/config.js';
import { Disposable, DisposableMap } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IChatRequestVariableEntry, isChatRequestFileEntry } from '../../common/chatModel.js';
/**
 * Prefix for all prompt instruction variable IDs.
 */
const PROMPT_VARIABLE_ID_PREFIX = 'vscode.prompt.instructions';
/**
 * Prompt IDs start with a well-defined prefix that is used by
 * the copilot extension to identify prompt references.
 *
 * @param uri The URI of the prompt file.
 * @param isRoot Whether the prompt file is the root file, or a
 *               child reference that is nested inside the root file.
 */
export const createPromptVariableId = (uri, isRoot) => {
    // the default prefix that is used for all prompt files
    let prefix = PROMPT_VARIABLE_ID_PREFIX;
    // if the reference is the root object, add the `.root` suffix
    if (isRoot) {
        prefix += '.root';
    }
    // final `id` for all `prompt files` starts with the well-defined
    // part that the copilot extension(or other chatbot) can rely on
    return `${prefix}__${uri}`;
};
/**
 * Utility to convert a {@link reference} to a chat variable entry.
 * The `id` of the chat variable can be one of the following:
 *
 * - `vscode.prompt.instructions__<URI>`: for all non-root prompt file references
 * - `vscode.prompt.instructions.root__<URI>`: for *root* prompt file references
 * - `<URI>`: for the rest of references(the ones that do not point to a prompt file)
 *
 * @param reference A reference object to convert to a chat variable entry.
 * @param isRoot If the reference is the root reference in the references tree.
 * 				 This object most likely was explicitly attached by the user.
 */
export const toChatVariable = (reference, isRoot) => {
    const { uri, isPromptFile } = reference;
    // default `id` is the stringified `URI`
    let id = `${uri}`;
    // prompts have special `id`s that are used by the copilot extension
    if (isPromptFile) {
        id = createPromptVariableId(uri, isRoot);
    }
    const name = (isPromptFile)
        ? `prompt:${basename(uri)}`
        : `file:${basename(uri)}`;
    const modelDescription = (isPromptFile)
        ? 'Prompt instructions file'
        : 'File attachment';
    return {
        id,
        name,
        value: uri,
        kind: 'file',
        modelDescription,
        isRoot,
    };
};
/**
 * Checks of a provided chat variable is a `prompt file` variable.
 */
export function isPromptFileChatVariable(variable) {
    return isChatRequestFileEntry(variable)
        && variable.id.startsWith(PROMPT_VARIABLE_ID_PREFIX);
}
/**
 * Adds the provided `newReference` to the list of chat variables if it is not already present.
 */
export function addPromptFileChatVariable(variables, newReference) {
    if (!variables.some(variable => isPromptFileChatVariable(variable) && isEqual(IChatRequestVariableEntry.toUri(variable), newReference))) {
        variables.push(toChatVariable({ uri: newReference, isPromptFile: true }, true));
    }
}
/**
 * Model for a collection of prompt instruction attachments.
 * See {@linkcode ChatPromptAttachmentModel} for individual attachment.
 */
let ChatPromptAttachmentsCollection = class ChatPromptAttachmentsCollection extends Disposable {
    /**
     * Get all `URI`s of all valid references, including all
     * the possible references nested inside the children.
     */
    get references() {
        const result = [];
        for (const child of this.attachments.values()) {
            result.push(...child.references);
        }
        return result;
    }
    /**
     * Get list of tools associated with all attached prompt files.
     */
    get toolsMetadata() {
        const result = [];
        for (const child of this.attachments.values()) {
            const { toolsMetadata } = child;
            if (toolsMetadata === null) {
                continue;
            }
            result.push(...toolsMetadata);
        }
        // return unique list of all tools
        return [...new Set(result)];
    }
    /**
     * Get the list of all prompt instruction attachment variables, including all
     * nested child references of each attachment explicitly attached by user.
     */
    get chatAttachments() {
        const result = [];
        const attachments = [...this.attachments.values()];
        for (const attachment of attachments) {
            const { reference } = attachment;
            // the usual URIs list of prompt instructions is `bottom-up`, therefore
            // we do the same here - first add all child references of the model
            result.push(...reference.allValidReferences.map((link) => {
                return toChatVariable(link, false);
            }));
            // then add the root reference of the model itself
            result.push(toChatVariable({
                uri: reference.uri,
                // the attached file must have been a prompt file therefore
                // we force that assumption here; this makes sure that prompts
                // in untitled documents can be also attached to the chat input
                isPromptFile: true,
            }, true));
        }
        return result;
    }
    /**
     * Promise that resolves when parsing of all attached prompt instruction
     * files completes, including parsing of all its possible child references.
     */
    async allSettled() {
        const attachments = [...this.attachments.values()];
        await Promise.allSettled(attachments.map((attachment) => {
            return attachment.allSettled;
        }));
        return this;
    }
    constructor(instantiationService, configService) {
        super();
        this.instantiationService = instantiationService;
        this.configService = configService;
        /**
         * Event that fires then this model is updated.
         *
         * See {@linkcode onUpdate}.
         */
        this._onUpdate = this._register(new Emitter());
        /**
         * Subscribe to the `onUpdate` event.
         */
        this.onUpdate = this._onUpdate.event;
        /**
         * Event that fires when a new prompt instruction attachment is added.
         * See {@linkcode onAdd}.
         */
        this._onAdd = this._register(new Emitter());
        /**
         * The `onAdd` event fires when a new prompt instruction attachment is added.
         */
        this.onAdd = this._onAdd.event;
        /**
         * Event that fires when a new prompt instruction attachment is removed.
         * See {@linkcode onRemove}.
         */
        this._onRemove = this._register(new Emitter());
        /**
         * The `onRemove` event fires when a new prompt instruction attachment is removed.
         */
        this.onRemove = this._onRemove.event;
        /**
         * List of all prompt instruction attachments.
         */
        this.attachments = this._register(new DisposableMap());
    }
    /**
     * Add a prompt instruction attachment instance with the provided `URI`.
     * @param uri URI of the prompt instruction attachment to add.
     */
    add(uris) {
        const uriList = Array.isArray(uris) ? uris : [uris];
        // if no URIs provided, nothing to do
        if (uriList.length === 0) {
            return;
        }
        for (const uri of uriList) {
            // if already exists, nothing to do
            if (this.attachments.has(uri.path)) {
                continue;
            }
            const instruction = this.instantiationService.createInstance(ChatPromptAttachmentModel, uri);
            instruction.addDisposables(instruction.onDispose(() => {
                // note! we have to use `deleteAndLeak` here, because the `*AndDispose`
                //       alternative results in an infinite loop of calling this callback
                this.attachments.deleteAndLeak(uri.path);
                this._onUpdate.fire();
                this._onRemove.fire(instruction);
            }), instruction.onUpdate(this._onUpdate.fire));
            this.attachments.set(uri.path, instruction);
            this._onAdd.fire(instruction);
            this._onUpdate.fire();
        }
    }
    /**
     * Remove a prompt instruction attachment instance by provided `URI`.
     * @param uri URI of the prompt instruction attachment to remove.
     */
    remove(uri) {
        // if does not exist, nothing to do
        if (!this.attachments.has(uri.path)) {
            return this;
        }
        this.attachments.deleteAndDispose(uri.path);
        return this;
    }
    /**
     * Checks if the prompt instructions feature is enabled in the user settings.
     */
    get featureEnabled() {
        return PromptsConfig.enabled(this.configService);
    }
    /**
     * Clear all prompt instruction attachments.
     */
    clear() {
        for (const attachment of this.attachments.values()) {
            this.remove(attachment.uri);
        }
        this._onUpdate.fire();
        return this;
    }
};
ChatPromptAttachmentsCollection = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService)
], ChatPromptAttachmentsCollection);
export { ChatPromptAttachmentsCollection };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFByb21wdEF0dGFjaG1lbnRzQ29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRBdHRhY2htZW50TW9kZWwvY2hhdFByb21wdEF0dGFjaG1lbnRzQ29sbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFM0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUseUJBQXlCLEVBQXdCLHNCQUFzQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFcEg7O0dBRUc7QUFDSCxNQUFNLHlCQUF5QixHQUFHLDRCQUE0QixDQUFDO0FBRS9EOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRyxDQUNyQyxHQUFRLEVBQ1IsTUFBZSxFQUNOLEVBQUU7SUFDWCx1REFBdUQ7SUFDdkQsSUFBSSxNQUFNLEdBQUcseUJBQXlCLENBQUM7SUFDdkMsOERBQThEO0lBQzlELElBQUksTUFBTSxFQUFFLENBQUM7UUFDWixNQUFNLElBQUksT0FBTyxDQUFDO0lBQ25CLENBQUM7SUFFRCxpRUFBaUU7SUFD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