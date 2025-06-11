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
import { ButtonWithIcon } from '../../../../../base/browser/ui/button/button.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, observableValue } from '../../../../../base/common/observable.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { MarkdownRenderer } from '../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { localize, localize2 } from '../../../../../nls.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IProgressService } from '../../../../../platform/progress/common/progress.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { REVEAL_IN_EXPLORER_COMMAND_ID } from '../../../files/browser/fileConstants.js';
import { getAttachableImageExtension } from '../../common/chatModel.js';
import { ChatAttachmentsContentPart } from './chatAttachmentsContentPart.js';
import { ChatQueryTitlePart } from './chatConfirmationWidget.js';
let ChatCollapsibleInputOutputContentPart = class ChatCollapsibleInputOutputContentPart extends Disposable {
    set title(s) {
        this._titlePart.title = s;
    }
    get title() {
        return this._titlePart.title;
    }
    get expanded() {
        return this._expanded.get();
    }
    constructor(title, subtitle, context, editorPool, input, output, isError, initiallyExpanded, width, contextKeyService, _instantiationService, _contextMenuService) {
        super();
        this.context = context;
        this.editorPool = editorPool;
        this.input = input;
        this.output = output;
        this.contextKeyService = contextKeyService;
        this._instantiationService = _instantiationService;
        this._contextMenuService = _contextMenuService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._currentWidth = 0;
        this._editorReferences = [];
        this.codeblocks = [];
        this._currentWidth = width;
        const titleEl = dom.h('.chat-confirmation-widget-title-inner');
        const iconEl = dom.h('.chat-confirmation-widget-title-icon');
        const elements = dom.h('.chat-confirmation-widget');
        this.domNode = elements.root;
        const titlePart = this._titlePart = this._register(_instantiationService.createInstance(ChatQueryTitlePart, titleEl.root, title, subtitle, _instantiationService.createInstance(MarkdownRenderer, {})));
        this._register(titlePart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        const spacer = document.createElement('span');
        spacer.style.flexGrow = '1';
        const btn = this._register(new ButtonWithIcon(elements.root, {}));
        btn.element.classList.add('chat-confirmation-widget-title', 'monaco-text-button');
        btn.labelElement.append(titleEl.root, iconEl.root);
        const check = dom.h(isError
            ? ThemeIcon.asCSSSelector(Codicon.error)
            : output
                ? ThemeIcon.asCSSSelector(Codicon.check)
                : ThemeIcon.asCSSSelector(ThemeIcon.modify(Codicon.loading, 'spin')));
        iconEl.root.appendChild(check.root);
        const expanded = this._expanded = observableValue(this, initiallyExpanded);
        this._register(autorun(r => {
            const value = expanded.read(r);
            btn.icon = value ? Codicon.chevronDown : Codicon.chevronRight;
            elements.root.classList.toggle('collapsed', !value);
            this._onDidChangeHeight.fire();
        }));
        const toggle = (e) => {
            if (!e.defaultPrevented) {
                const value = expanded.get();
                expanded.set(!value, undefined);
                e.preventDefault();
            }
        };
        this._register(btn.onDidClick(toggle));
        const message = dom.h('.chat-confirmation-widget-message');
        message.root.appendChild(this.createMessageContents());
        elements.root.appendChild(message.root);
    }
    createMessageContents() {
        const contents = dom.h('div', [
            dom.h('h3@inputTitle'),
            dom.h('div@input'),
            dom.h('h3@outputTitle'),
            dom.h('div@output'),
        ]);
        const { input, output } = this;
        contents.inputTitle.textContent = localize('chat.input', "Input");
        this.addCodeBlock(input, contents.input);
        if (!output) {
            contents.output.remove();
            contents.outputTitle.remove();
        }
        else {
            contents.outputTitle.textContent = localize('chat.output', "Output");
            for (let i = 0; i < output.parts.length; i++) {
                const part = output.parts[i];
                if (part.kind === 'code') {
                    this.addCodeBlock(part, contents.output);
                    continue;
                }
                const group = [];
                for (let k = i; k < output.parts.length; k++) {
                    const part = output.parts[k];
                    if (part.kind !== 'data') {
                        break;
                    }
                    group.push(part);
                }
                this.addResourceGroup(group, contents.output);
                i += group.length - 1; // Skip the parts we just added
            }
        }
        return contents.root;
    }
    addResourceGroup(parts, container) {
        const el = dom.h('.chat-collapsible-io-resource-group', [
            dom.h('.chat-collapsible-io-resource-items@items'),
            dom.h('.chat-collapsible-io-resource-actions@actions'),
        ]);
        const entries = parts.map((part) => {
            if (part.mimeType && getAttachableImageExtension(part.mimeType)) {
                return { kind: 'image', id: generateUuid(), name: basename(part.uri), value: part.value, mimeType: part.mimeType, isURL: false, references: [{ kind: 'reference', reference: part.uri }] };
            }
            else {
                return { kind: 'file', id: generateUuid(), name: basename(part.uri), fullName: part.uri.path, value: part.uri };
            }
        });
        const attachments = this._register(this._instantiationService.createInstance(ChatAttachmentsContentPart, entries, undefined, undefined));
        attachments.contextMenuHandler = (attachment, event) => {
            const index = entries.indexOf(attachment);
            const part = parts[index];
            if (part) {
                event.preventDefault();
                event.stopPropagation();
                this._contextMenuService.showContextMenu({
                    menuId: MenuId.ChatToolOutputResourceContext,
                    menuActionOptions: { shouldForwardArgs: true },
                    getAnchor: () => ({ x: event.pageX, y: event.pageY }),
                    getActionsContext: () => ({ parts: [part] }),
                });
            }
        };
        el.items.appendChild(attachments.domNode);
        const toolbar = this._register(this._instantiationService.createInstance(MenuWorkbenchToolBar, el.actions, MenuId.ChatToolOutputResourceToolbar, {
            menuOptions: {
                shouldForwardArgs: true,
            },
        }));
        toolbar.context = { parts };
        container.appendChild(el.root);
    }
    addCodeBlock(part, container) {
        const data = {
            languageId: part.languageId,
            textModel: Promise.resolve(part.textModel),
            codeBlockIndex: part.codeBlockInfo.codeBlockIndex,
            codeBlockPartIndex: 0,
            element: this.context.element,
            parentContextKeyService: this.contextKeyService,
            renderOptions: part.options,
            chatSessionId: this.context.element.sessionId,
        };
        const editorReference = this._register(this.editorPool.get());
        editorReference.object.render(data, this._currentWidth || 300);
        this._register(editorReference.object.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
        container.appendChild(editorReference.object.element);
        this._editorReferences.push(editorReference);
    }
    hasSameContent(other, followingContent, element) {
        // For now, we consider content different unless it's exactly the same instance
        return false;
    }
    layout(width) {
        this._currentWidth = width;
        this._editorReferences.forEach(r => r.object.layout(width));
    }
};
ChatCollapsibleInputOutputContentPart = __decorate([
    __param(9, IContextKeyService),
    __param(10, IInstantiationService),
    __param(11, IContextMenuService)
], ChatCollapsibleInputOutputContentPart);
export { ChatCollapsibleInputOutputContentPart };
class SaveResourcesAction extends Action2 {
    static { this.ID = 'chat.toolOutput.save'; }
    constructor() {
        super({
            id: SaveResourcesAction.ID,
            title: localize2('chat.saveResources', "Save As..."),
            icon: Codicon.cloudDownload,
            menu: [{
                    id: MenuId.ChatToolOutputResourceToolbar,
                    group: 'navigation',
                    order: 1
                }, {
                    id: MenuId.ChatToolOutputResourceContext,
                }]
        });
    }
    async run(accessor, context) {
        const fileDialog = accessor.get(IFileDialogService);
        const fileService = accessor.get(IFileService);
        const notificationService = accessor.get(INotificationService);
        const progressService = accessor.get(IProgressService);
        const workspaceContextService = accessor.get(IWorkspaceContextService);
        const commandService = accessor.get(ICommandService);
        const labelService = accessor.get(ILabelService);
        const defaultFilepath = await fileDialog.defaultFilePath();
        const savePart = async (part, isFolder, uri) => {
            const target = isFolder ? joinPath(uri, basename(part.uri)) : uri;
            try {
                if (part.kind === 'data') {
                    await fileService.writeFile(target, VSBuffer.wrap(part.value));
                }
                else {
                    // MCP doesn't support streaming data, so no sense trying
                    const contents = await fileService.readFile(part.uri);
                    await fileService.writeFile(target, contents.value);
                }
            }
            catch (e) {
                notificationService.error(localize('chat.saveResources.error', "Failed to save {0}: {1}", basename(part.uri), e));
            }
        };
        const withProgress = async (thenReveal, todo) => {
            await progressService.withProgress({
                location: 15 /* ProgressLocation.Notification */,
                delay: 5_000,
                title: localize('chat.saveResources.progress', "Saving resources..."),
            }, async (report) => {
                for (const task of todo) {
                    await task();
                    report.report({ increment: 1, total: todo.length });
                }
            });
            if (workspaceContextService.isInsideWorkspace(thenReveal)) {
                commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, thenReveal);
            }
            else {
                notificationService.info(localize('chat.saveResources.reveal', "Saved resources to {0}", labelService.getUriLabel(thenReveal)));
            }
        };
        if (context.parts.length === 1) {
            const part = context.parts[0];
            const uri = await fileDialog.pickFileToSave(joinPath(defaultFilepath, basename(part.uri)));
            if (!uri) {
                return;
            }
            await withProgress(uri, [() => savePart(part, false, uri)]);
        }
        else {
            const uris = await fileDialog.showOpenDialog({
                title: localize('chat.saveResources.title', "Pick folder to save resources"),
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: workspaceContextService.getWorkspace().folders[0]?.uri,
            });
            if (!uris?.length) {
                return;
            }
            await withProgress(uris[0], context.parts.map(part => () => savePart(part, true, uris[0])));
        }
    }
}
registerAction2(SaveResourcesAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xJbnB1dE91dHB1dENvbnRlbnRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0VG9vbElucHV0T3V0cHV0Q29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxPQUFPLEVBQXVCLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXBFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxtRkFBbUYsQ0FBQztBQUVySCxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFD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