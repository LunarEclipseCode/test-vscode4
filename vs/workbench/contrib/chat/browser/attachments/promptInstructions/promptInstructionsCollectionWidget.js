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
import { Emitter } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { InstructionsAttachmentWidget } from './promptInstructionsWidget.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { INSTRUCTIONS_LANGUAGE_ID } from '../../../common/promptSyntax/promptTypes.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
/**
 * Widget for a collection of prompt instructions attachments.
 * See {@link InstructionsAttachmentWidget}.
 */
let PromptInstructionsAttachmentsCollectionWidget = class PromptInstructionsAttachmentsCollectionWidget extends Disposable {
    /**
     * Get all `URI`s of all valid references, including all
     * the possible references nested inside the children.
     */
    get references() {
        return this.model.references;
    }
    /**
     * Get the list of all prompt instruction attachment variables, including all
     * nested child references of each attachment explicitly attached by user.
     */
    get chatAttachments() {
        return this.model.chatAttachments;
    }
    /**
     * Get a promise that resolves when parsing/resolving processes
     * are fully completed, including all possible nested child references.
     */
    allSettled() {
        return this.model.allSettled();
    }
    /**
     * Check if child widget list is empty (no attachments present).
     */
    get empty() {
        return this.children.length === 0;
    }
    /**
     * Check if any of the attachments is a prompt file.
     */
    get hasInstructions() {
        return this.references.some((uri) => {
            const model = this.modelService.getModel(uri);
            const languageId = model ? model.getLanguageId() : this.languageService.guessLanguageIdByFilepathOrFirstLine(uri);
            return languageId === INSTRUCTIONS_LANGUAGE_ID;
        });
    }
    constructor(model, resourceLabels, instantiationService, languageService, modelService, logService) {
        super();
        this.model = model;
        this.resourceLabels = resourceLabels;
        this.instantiationService = instantiationService;
        this.languageService = languageService;
        this.modelService = modelService;
        this.logService = logService;
        /**
         * List of child instruction attachment widgets.
         */
        this.children = [];
        /**
         * Event that fires when number of attachments change
         *
         * See {@link onAttachmentsChange}.
         */
        this._onAttachmentsChange = this._register(new Emitter());
        /**
         * Subscribe to the event that fires when number of attachments change.
         */
        this.onAttachmentsChange = this._onAttachmentsChange.event;
        // when a new attachment model is added, create a new child widget for it
        this._register(this.model.onAdd((attachment) => {
            const widget = this.instantiationService.createInstance(InstructionsAttachmentWidget, attachment, this.resourceLabels);
            // handle the child widget disposal event, removing it from the list
            widget.onDispose(this.handleAttachmentDispose.bind(this, widget));
            // register the new child widget
            this.children.push(widget);
            // if parent node is present - append the widget to it, otherwise wait
            // until the `render` method will be called
            if (this.parentNode) {
                this.parentNode.appendChild(widget.domNode);
            }
            // fire the event to notify about the change in the number of attachments
            this._onAttachmentsChange.fire();
        }));
    }
    /**
     * Handle child widget disposal.
     * @param widget The child widget that was disposed.
     */
    handleAttachmentDispose(widget) {
        // common prefix for all log messages
        const logPrefix = `[onChildDispose] Widget for instructions attachment '${widget.uri.path}'`;
        // flag to check if the widget was found in the children list
        let widgetExists = false;
        // filter out disposed child widget from the list
        this.children = this.children.filter((child) => {
            if (child === widget) {
                // because we filter out all objects here it might be ok to have multiple of them, but
                // it also highlights a potential issue in our logic somewhere else, so trace a warning here
                if (widgetExists) {
                    this.logService.warn(`${logPrefix} is present in the children references list multiple times.`);
                }
                widgetExists = true;
                return false;
            }
            return true;
        });
        // no widget was found in the children list, while it might be ok it also
        // highlights a potential issue in our logic, so trace a warning here
        if (!widgetExists) {
            this.logService.warn(`${logPrefix} was disposed, but was not found in the child references.`);
        }
        if (!this.parentNode) {
            this.logService.warn(`${logPrefix} no parent node reference found.`);
        }
        // remove the child widget root node from the DOM
        this.parentNode?.removeChild(widget.domNode);
        // fire the event to notify about the change in the number of attachments
        this._onAttachmentsChange.fire();
        return this;
    }
    /**
     * Render attachments into the provided `parentNode`.
     *
     * Note! this method assumes that the provided `parentNode` is cleared by the caller.
     */
    render(parentNode) {
        this.parentNode = parentNode;
        for (const widget of this.children) {
            this.parentNode.appendChild(widget.domNode);
        }
        return this;
    }
    /**
     * Dispose of the widget, including all the child widget instances.
     */
    dispose() {
        for (const child of this.children) {
            child.dispose();
        }
        super.dispose();
    }
};
PromptInstructionsAttachmentsCollectionWidget = __decorate([
    __param(2, IInstantiationService),
    __param(3, ILanguageService),
    __param(4, IModelService),
    __param(5, ILogService)
], PromptInstructionsAttachmentsCollectionWidget);
export { PromptInstructionsAttachmentsCollectionWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0SW5zdHJ1Y3Rpb25zQ29sbGVjdGlvbldpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2F0dGFjaG1lbnRzL3Byb21wdEluc3RydWN0aW9ucy9wcm9tcHRJbnN0cnVjdGlvbnNDb2xsZWN0aW9uV2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzdFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN2RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUd6Rzs7O0dBR0c7QUFDSSxJQUFNLDZDQUE2QyxHQUFuRCxNQUFNLDZDQUE4QyxTQUFRLFVBQVU7SUFzQjVFOzs7T0FHRztJQUNILElBQVcsVUFBVTtRQUNwQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO0lBQzlCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxJQUFXLGVBQWU7UUFDekIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksVUFBVTtRQUNoQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxF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