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
import * as dom from '../../../../../base/browser/dom.js';
import { createInstantHoverDelegate } from '../../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { basename } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { localize } from '../../../../../nls.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ResourceLabels } from '../../../../browser/labels.js';
import { isElementVariableEntry, isImageVariableEntry, isNotebookOutputVariableEntry, isPasteVariableEntry, isSCMHistoryItemVariableEntry } from '../../common/chatModel.js';
import { ChatResponseReferencePartStatusKind } from '../../common/chatService.js';
import { DefaultChatAttachmentWidget, ElementChatAttachmentWidget, FileAttachmentWidget, ImageAttachmentWidget, NotebookCellOutputChatAttachmentWidget, PasteAttachmentWidget, SCMHistoryItemAttachmentWidget, ToolSetOrToolItemAttachmentWidget } from '../chatAttachmentWidgets.js';
export const chatAttachmentResourceContextKey = new RawContextKey('chatAttachmentResource', undefined, { type: 'URI', description: localize('resource', "The full value of the chat attachment resource, including scheme and path") });
let ChatAttachmentsContentPart = class ChatAttachmentsContentPart extends Disposable {
    constructor(variables, contentReferences = [], domNode = dom.$('.chat-attached-context'), instantiationService) {
        super();
        this.variables = variables;
        this.contentReferences = contentReferences;
        this.domNode = domNode;
        this.instantiationService = instantiationService;
        this.attachedContextDisposables = this._register(new DisposableStore());
        this._onDidChangeVisibility = this._register(new Emitter());
        this._contextResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility.event }));
        this.initAttachedContext(domNode);
        if (!domNode.childElementCount) {
            this.domNode = undefined;
        }
    }
    initAttachedContext(container) {
        dom.clearNode(container);
        this.attachedContextDisposables.clear();
        const hoverDelegate = this.attachedContextDisposables.add(createInstantHoverDelegate());
        for (const attachment of this.variables) {
            const resource = URI.isUri(attachment.value) ? attachment.value : attachment.value && typeof attachment.value === 'object' && 'uri' in attachment.value && URI.isUri(attachment.value.uri) ? attachment.value.uri : undefined;
            const range = attachment.value && typeof attachment.value === 'object' && 'range' in attachment.value && Range.isIRange(attachment.value.range) ? attachment.value.range : undefined;
            const correspondingContentReference = this.contentReferences.find((ref) => (typeof ref.reference === 'object' && 'variableName' in ref.reference && ref.reference.variableName === attachment.name) || (URI.isUri(ref.reference) && basename(ref.reference.path) === attachment.name));
            const isAttachmentOmitted = correspondingContentReference?.options?.status?.kind === ChatResponseReferencePartStatusKind.Omitted;
            const isAttachmentPartialOrOmitted = isAttachmentOmitted || correspondingContentReference?.options?.status?.kind === ChatResponseReferencePartStatusKind.Partial;
            let widget;
            if (attachment.kind === 'tool' || attachment.kind === 'toolset') {
                widget = this.instantiationService.createInstance(ToolSetOrToolItemAttachmentWidget, attachment, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else if (isElementVariableEntry(attachment)) {
                widget = this.instantiationService.createInstance(ElementChatAttachmentWidget, attachment, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else if (isImageVariableEntry(attachment)) {
                attachment.omittedState = isAttachmentPartialOrOmitted ? 2 /* OmittedState.Full */ : attachment.omittedState;
                widget = this.instantiationService.createInstance(ImageAttachmentWidget, resource, attachment, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else if (resource && (attachment.kind === 'file' || attachment.kind === 'directory')) {
                widget = this.instantiationService.createInstance(FileAttachmentWidget, resource, range, attachment, correspondingContentReference, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else if (isPasteVariableEntry(attachment)) {
                widget = this.instantiationService.createInstance(PasteAttachmentWidget, attachment, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else if (resource && isNotebookOutputVariableEntry(attachment)) {
                widget = this.instantiationService.createInstance(NotebookCellOutputChatAttachmentWidget, resource, attachment, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else if (isSCMHistoryItemVariableEntry(attachment)) {
                widget = this.instantiationService.createInstance(SCMHistoryItemAttachmentWidget, attachment, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            else {
                widget = this.instantiationService.createInstance(DefaultChatAttachmentWidget, resource, range, attachment, correspondingContentReference, undefined, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels, hoverDelegate);
            }
            let ariaLabel = null;
            if (isAttachmentPartialOrOmitted) {
                widget.element.classList.add('warning');
            }
            const description = correspondingContentReference?.options?.status?.description;
            if (isAttachmentPartialOrOmitted) {
                ariaLabel = `${ariaLabel}${description ? ` ${description}` : ''}`;
                for (const selector of ['.monaco-icon-suffix-container', '.monaco-icon-name-container']) {
                    const element = widget.label.element.querySelector(selector);
                    if (element) {
                        element.classList.add('warning');
                    }
                }
            }
            this._register(dom.addDisposableListener(widget.element, 'contextmenu', e => this.contextMenuHandler?.(attachment, e)));
            if (this.attachedContextDisposables.isDisposed) {
                widget.dispose();
                return;
            }
            if (ariaLabel) {
                widget.element.ariaLabel = ariaLabel;
            }
            this.attachedContextDisposables.add(widget);
        }
    }
};
ChatAttachmentsContentPart = __decorate([
    __param(3, IInstantiationService)
], ChatAttachmentsContentPart);
export { ChatAttachmentsContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEF0dGFjaG1lbnRzQ29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRBdHRhY2htZW50c0NvbnRlbnRQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDMUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN4RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUE2QixzQkFBc0IsRUFBRSxvQkFBb0IsRUFBRSw2QkFBNkIsRUFBRSxvQkFBb0IsRUFBRSw2QkFBNkIsRUFBZ0IsTUFBTSwyQkFBMkIsQ0FBQztBQUN0TixPQUFPLEVBQUUsbUNBQW1DLEVBQXlCLE1BQU0sNkJBQTZCLENBQUM7QUFDekcsT0FBTyxFQUFFLDJCQUEyQixFQUFFLDJCQUEyQixF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