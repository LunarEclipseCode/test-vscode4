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
var ChatMarkdownContentPart_1;
import * as dom from '../../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../../base/browser/mouseEvent.js';
import { findLast } from '../../../../../base/common/arraysFind.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun } from '../../../../../base/common/observable.js';
import { equalsIgnoreCase } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { getIconClasses } from '../../../../../editor/common/services/getIconClasses.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { getFlatContextMenuActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { FileKind } from '../../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IChatService } from '../../common/chatService.js';
import { isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
import { ChatMarkdownDecorationsRenderer } from '../chatMarkdownDecorationsRenderer.js';
import { CodeBlockPart, localFileLanguageId, parseLocalFileData } from '../codeBlockPart.js';
import '../media/chatCodeBlockPill.css';
import { ResourcePool } from './chatCollections.js';
import { ChatExtensionsContentPart } from './chatExtensionsContentPart.js';
const $ = dom.$;
let ChatMarkdownContentPart = class ChatMarkdownContentPart extends Disposable {
    static { ChatMarkdownContentPart_1 = this; }
    static { this.idPool = 0; }
    constructor(markdown, context, editorPool, fillInIncompleteTokens = false, codeBlockStartIndex = 0, renderer, currentWidth, codeBlockModelCollection, rendererOptions, contextKeyService, textModelService, instantiationService) {
        super();
        this.markdown = markdown;
        this.editorPool = editorPool;
        this.codeBlockModelCollection = codeBlockModelCollection;
        this.rendererOptions = rendererOptions;
        this.textModelService = textModelService;
        this.instantiationService = instantiationService;
        this.codeblocksPartId = String(++ChatMarkdownContentPart_1.idPool);
        this.allRefs = [];
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this.codeblocks = [];
        const element = context.element;
        const inUndoStop = findLast(context.content, e => e.kind === 'undoStop', context.contentIndex)?.id;
        // We release editors in order so that it's more likely that the same editor will be assigned if this element is re-rendered right away, like it often is during progressive rendering
        const orderedDisposablesList = [];
        // Need to track the index of the codeblock within the response so it can have a unique ID,
        // and within this part to find it within the codeblocks array
        let globalCodeBlockIndexStart = codeBlockStartIndex;
        let thisPartCodeBlockIndexStart = 0;
        // Don't set to 'false' for responses, respect defaults
        const markedOpts = isRequestVM(element) ? {
            gfm: true,
            breaks: true,
        } : undefined;
        const result = this._register(renderer.render(markdown.content, {
            fillInIncompleteTokens,
            codeBlockRendererSync: (languageId, text, raw) => {
                const isCodeBlockComplete = !isResponseVM(context.element) || context.element.isComplete || !raw || codeblockHasClosingBackticks(raw);
                if ((!text || (text.startsWith('<vscode_codeblock_uri') && !text.includes('\n'))) && !isCodeBlockComplete) {
                    const hideEmptyCodeblock = $('div');
                    hideEmptyCodeblock.style.display = 'none';
                    return hideEmptyCodeblock;
                }
                if (languageId === 'vscode-extensions') {
                    const chatExtensions = this._register(instantiationService.createInstance(ChatExtensionsContentPart, { kind: 'extensions', extensions: text.split(',') }));
                    this._register(chatExtensions.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
                    return chatExtensions.domNode;
                }
                const globalIndex = globalCodeBlockIndexStart++;
                const thisPartIndex = thisPartCodeBlockIndexStart++;
                let textModel;
                let range;
                let vulns;
                let codeblockEntry;
                if (equalsIgnoreCase(languageId, localFileLanguageId)) {
                    try {
                        const parsedBody = parseLocalFileData(text);
                        range = parsedBody.range && Range.lift(parsedBody.range);
                        textModel = this.textModelService.createModelReference(parsedBody.uri).then(ref => ref.object.textEditorModel);
                    }
                    catch (e) {
                        return $('div');
                    }
                }
                else {
                    const sessionId = isResponseVM(element) || isRequestVM(element) ? element.sessionId : '';
                    const modelEntry = this.codeBlockModelCollection.getOrCreate(sessionId, element, globalIndex);
                    const fastUpdateModelEntry = this.codeBlockModelCollection.updateSync(sessionId, element, globalIndex, { text, languageId, isComplete: isCodeBlockComplete });
                    vulns = modelEntry.vulns;
                    codeblockEntry = fastUpdateModelEntry;
                    textModel = modelEntry.model;
                }
                const hideToolbar = isResponseVM(element) && element.errorDetails?.responseIsFiltered;
                const renderOptions = {
                    ...this.rendererOptions.codeBlockRenderOptions,
                };
                if (hideToolbar !== undefined) {
                    renderOptions.hideToolbar = hideToolbar;
                }
                const codeBlockInfo = { languageId, textModel, codeBlockIndex: globalIndex, codeBlockPartIndex: thisPartIndex, element, range, parentContextKeyService: contextKeyService, vulns, codemapperUri: codeblockEntry?.codemapperUri, renderOptions, chatSessionId: element.sessionId };
                if (element.isCompleteAddedRequest || !codeblockEntry?.codemapperUri || !codeblockEntry.isEdit) {
                    const ref = this.renderCodeBlock(codeBlockInfo, text, isCodeBlockComplete, currentWidth);
                    this.allRefs.push(ref);
                    // Attach this after updating text/layout of the editor, so it should only be fired when the size updates later (horizontal scrollbar, wrapping)
                    // not during a renderElement OR a progressive render (when we will be firing this event anyway at the end of the render)
                    this._register(ref.object.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
                    const ownerMarkdownPartId = this.codeblocksPartId;
                    const info = new class {
                        constructor() {
                            this.ownerMarkdownPartId = ownerMarkdownPartId;
                            this.codeBlockIndex = globalIndex;
                            this.elementId = element.id;
                            this.isStreaming = false;
                            this.chatSessionId = element.sessionId;
                            this.codemapperUri = undefined; // will be set async
                            this.uriPromise = textModel.then(model => model.uri);
                        }
                        get uri() {
                            // here we must do a getter because the ref.object is rendered
                            // async and the uri might be undefined when it's read immediately
                            return ref.object.uri;
                        }
                        focus() {
                            ref.object.focus();
                        }
                    }();
                    this.codeblocks.push(info);
                    orderedDisposablesList.push(ref);
                    return ref.object.element;
                }
                else {
                    const requestId = isRequestVM(element) ? element.id : element.requestId;
                    const ref = this.renderCodeBlockPill(element.sessionId, requestId, inUndoStop, codeBlockInfo.codemapperUri, !isCodeBlockComplete);
                    if (isResponseVM(codeBlockInfo.element)) {
                        // TODO@joyceerhl: remove this code when we change the codeblockUri API to make the URI available synchronously
                        this.codeBlockModelCollection.update(codeBlockInfo.element.sessionId, codeBlockInfo.element, codeBlockInfo.codeBlockIndex, { text, languageId: codeBlockInfo.languageId, isComplete: isCodeBlockComplete }).then((e) => {
                            // Update the existing object's codemapperUri
                            this.codeblocks[codeBlockInfo.codeBlockPartIndex].codemapperUri = e.codemapperUri;
                            this._onDidChangeHeight.fire();
                        });
                    }
                    this.allRefs.push(ref);
                    const ownerMarkdownPartId = this.codeblocksPartId;
                    const info = new class {
                        constructor() {
                            this.ownerMarkdownPartId = ownerMarkdownPartId;
                            this.codeBlockIndex = globalIndex;
                            this.elementId = element.id;
                            this.isStreaming = !isCodeBlockComplete;
                            this.codemapperUri = codeblockEntry?.codemapperUri;
                            this.chatSessionId = element.sessionId;
                            this.uriPromise = Promise.resolve(undefined);
                        }
                        get uri() {
                            return undefined;
                        }
                        focus() {
                            return ref.object.element.focus();
                        }
                    }();
                    this.codeblocks.push(info);
                    orderedDisposablesList.push(ref);
                    return ref.object.element;
                }
            },
            asyncRenderCallback: () => this._onDidChangeHeight.fire(),
        }, markedOpts));
        const markdownDecorationsRenderer = instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
        this._register(markdownDecorationsRenderer.walkTreeAndAnnotateReferenceLinks(markdown, result.element));
        orderedDisposablesList.reverse().forEach(d => this._register(d));
        this.domNode = result.element;
    }
    renderCodeBlockPill(sessionId, requestId, inUndoStop, codemapperUri, isStreaming) {
        const codeBlock = this.instantiationService.createInstance(CollapsedCodeBlock, sessionId, requestId, inUndoStop);
        if (codemapperUri) {
            codeBlock.render(codemapperUri, isStreaming);
        }
        return {
            object: codeBlock,
            isStale: () => false,
            dispose: () => codeBlock.dispose()
        };
    }
    renderCodeBlock(data, text, isComplete, currentWidth) {
        const ref = this.editorPool.get();
        const editorInfo = ref.object;
        if (isResponseVM(data.element)) {
            this.codeBlockModelCollection.update(data.element.sessionId, data.element, data.codeBlockIndex, { text, languageId: data.languageId, isComplete }).then((e) => {
                // Update the existing object's codemapperUri
                this.codeblocks[data.codeBlockPartIndex].codemapperUri = e.codemapperUri;
                this._onDidChangeHeight.fire();
            });
        }
        editorInfo.render(data, currentWidth);
        return ref;
    }
    hasSameContent(other) {
        return other.kind === 'markdownContent' && !!(other.content.value === this.markdown.content.value
            || this.codeblocks.at(-1)?.isStreaming && this.codeblocks.at(-1)?.codemapperUri !== undefined && other.content.value.lastIndexOf('```') === this.markdown.content.value.lastIndexOf('```'));
    }
    layout(width) {
        this.allRefs.forEach((ref, index) => {
            if (ref.object instanceof CodeBlockPart) {
                ref.object.layout(width);
            }
            else if (ref.object instanceof CollapsedCodeBlock) {
                const codeblockModel = this.codeblocks[index];
                if (codeblockModel.codemapperUri && ref.object.uri?.toString() !== codeblockModel.codemapperUri.toString()) {
                    ref.object.render(codeblockModel.codemapperUri, codeblockModel.isStreaming);
                }
            }
        });
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatMarkdownContentPart = ChatMarkdownContentPart_1 = __decorate([
    __param(9, IContextKeyService),
    __param(10, ITextModelService),
    __param(11, IInstantiationService)
], ChatMarkdownContentPart);
export { ChatMarkdownContentPart };
let EditorPool = class EditorPool extends Disposable {
    inUse() {
        return this._pool.inUse;
    }
    constructor(options, delegate, overflowWidgetsDomNode, instantiationService) {
        super();
        this._pool = this._register(new ResourcePool(() => {
            return instantiationService.createInstance(CodeBlockPart, options, MenuId.ChatCodeBlock, delegate, overflowWidgetsDomNode);
        }));
    }
    get() {
        const codeBlock = this._pool.get();
        let stale = false;
        return {
            object: codeBlock,
            isStale: () => stale,
            dispose: () => {
                codeBlock.reset();
                stale = true;
                this._pool.release(codeBlock);
            }
        };
    }
};
EditorPool = __decorate([
    __param(3, IInstantiationService)
], EditorPool);
export { EditorPool };
function codeblockHasClosingBackticks(str) {
    str = str.trim();
    return !!str.match(/\n```+$/);
}
let CollapsedCodeBlock = class CollapsedCodeBlock extends Disposable {
    get uri() {
        return this._uri;
    }
    constructor(sessionId, requestId, inUndoStop, labelService, editorService, modelService, languageService, contextMenuService, contextKeyService, menuService, hoverService, chatService) {
        super();
        this.sessionId = sessionId;
        this.requestId = requestId;
        this.inUndoStop = inUndoStop;
        this.labelService = labelService;
        this.editorService = editorService;
        this.modelService = modelService;
        this.languageService = languageService;
        this.contextMenuService = contextMenuService;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this.hoverService = hoverService;
        this.chatService = chatService;
        this.hover = this._register(new MutableDisposable());
        this._progressStore = this._store.add(new DisposableStore());
        this.element = $('.chat-codeblock-pill-widget');
        this.element.classList.add('show-file-icons');
        this._register(dom.addDisposableListener(this.element, 'click', async () => {
            if (this._currentDiff) {
                this.editorService.openEditor({
                    original: { resource: this._currentDiff.originalURI },
                    modified: { resource: this._currentDiff.modifiedURI },
                    options: { transient: true },
                });
            }
            else if (this.uri) {
                this.editorService.openEditor({ resource: this.uri });
            }
        }));
        this._register(dom.addDisposableListener(this.element, dom.EventType.CONTEXT_MENU, domEvent => {
            const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
            dom.EventHelper.stop(domEvent, true);
            this.contextMenuService.showContextMenu({
                contextKeyService: this.contextKeyService,
                getAnchor: () => event,
                getActions: () => {
                    const menu = this.menuService.getMenuActions(MenuId.ChatEditingCodeBlockContext, this.contextKeyService, { arg: { sessionId, requestId, uri: this.uri, stopId: inUndoStop } });
                    return getFlatContextMenuActions(menu);
                },
            });
        }));
    }
    render(uri, isStreaming) {
        this._progressStore.clear();
        this._uri = uri;
        const session = this.chatService.getSession(this.sessionId);
        const iconText = this.labelService.getUriBasenameLabel(uri);
        let editSession = session?.editingSessionObs?.promiseResult.get()?.data;
        let modifiedEntry = editSession?.getEntry(uri);
        let modifiedByResponse = modifiedEntry?.isCurrentlyBeingModifiedBy.get();
        const isComplete = !modifiedByResponse || modifiedByResponse.requestId !== this.requestId;
        let iconClasses = [];
        if (isStreaming || !isComplete) {
            const codicon = ThemeIcon.modify(Codicon.loading, 'spin');
            iconClasses = ThemeIcon.asClassNameArray(codicon);
        }
        else {
            const fileKind = uri.path.endsWith('/') ? FileKind.FOLDER : FileKind.FILE;
            iconClasses = getIconClasses(this.modelService, this.languageService, uri, fileKind);
        }
        const iconEl = dom.$('span.icon');
        iconEl.classList.add(...iconClasses);
        const children = [dom.$('span.icon-label', {}, iconText)];
        const labelDetail = dom.$('span.label-detail', {}, '');
        children.push(labelDetail);
        if (isStreaming) {
            labelDetail.textContent = localize('chat.codeblock.generating', "Generating edits...");
        }
        this.element.replaceChildren(iconEl, ...children);
        this.updateTooltip(this.labelService.getUriLabel(uri, { relative: false }));
        const renderDiff = (changes) => {
            const labelAdded = this.element.querySelector('.label-added') ?? this.element.appendChild(dom.$('span.label-added'));
            const labelRemoved = this.element.querySelector('.label-removed') ?? this.element.appendChild(dom.$('span.label-removed'));
            if (changes && !changes?.identical && !changes?.quitEarly) {
                this._currentDiff = changes;
                labelAdded.textContent = `+${changes.added}`;
                labelRemoved.textContent = `-${changes.removed}`;
                const insertionsFragment = changes.added === 1 ? localize('chat.codeblock.insertions.one', "1 insertion") : localize('chat.codeblock.insertions', "{0} insertions", changes.added);
                const deletionsFragment = changes.removed === 1 ? localize('chat.codeblock.deletions.one', "1 deletion") : localize('chat.codeblock.deletions', "{0} deletions", changes.removed);
                const summary = localize('summary', 'Edited {0}, {1}, {2}', iconText, insertionsFragment, deletionsFragment);
                this.element.ariaLabel = summary;
                this.updateTooltip(summary);
            }
        };
        let diffBetweenStops;
        // Show a percentage progress that is driven by the rewrite
        this._progressStore.add(autorun(r => {
            if (!editSession) {
                editSession = session?.editingSessionObs?.promiseResult.read(r)?.data;
                modifiedEntry = editSession?.getEntry(uri);
            }
            modifiedByResponse = modifiedEntry?.isCurrentlyBeingModifiedBy.read(r);
            let diffValue = diffBetweenStops?.read(r);
            const isComplete = !!diffValue || !modifiedByResponse || modifiedByResponse.requestId !== this.requestId;
            const rewriteRatio = modifiedEntry?.rewriteRatio.read(r);
            if (!isStreaming && !isComplete) {
                const value = rewriteRatio;
                labelDetail.textContent = value === 0 || !value ? localize('chat.codeblock.generating', "Generating edits...") : localize('chat.codeblock.applyingPercentage', "Applying edits ({0}%)...", Math.round(value * 100));
            }
            else if (!isStreaming && isComplete) {
                iconEl.classList.remove(...iconClasses);
                const fileKind = uri.path.endsWith('/') ? FileKind.FOLDER : FileKind.FILE;
                iconEl.classList.add(...getIconClasses(this.modelService, this.languageService, uri, fileKind));
                labelDetail.textContent = '';
            }
            if (!diffBetweenStops) {
                diffBetweenStops = modifiedEntry && editSession
                    ? editSession.getEntryDiffBetweenStops(modifiedEntry.modifiedURI, this.requestId, this.inUndoStop)
                    : undefined;
                diffValue = diffBetweenStops?.read(r);
            }
            if (!isStreaming && isComplete) {
                renderDiff(diffValue);
            }
        }));
    }
    updateTooltip(tooltip) {
        this.tooltip = tooltip;
        if (!this.hover.value) {
            this.hover.value = this.hoverService.setupDelayedHover(this.element, () => ({
                content: this.tooltip,
                appearance: { compact: true, showPointer: true },
                position: { hoverPosition: 2 /* HoverPosition.BELOW */ },
                persistence: { hideOnKeyDown: true },
            }));
        }
    }
};
CollapsedCodeBlock = __decorate([
    __param(3, ILabelService),
    __param(4, IEditorService),
    __param(5, IModelService),
    __param(6, ILanguageService),
    __param(7, IContextMenuService),
    __param(8, IContextKeyService),
    __param(9, IMenuService),
    __param(10, IHoverService),
    __param(11, IChatService)
], CollapsedCodeBlock);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1hcmtkb3duQ29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRNYXJrZG93bkNvbnRlbnRQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRS9FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEgsT0FBTyxFQUFFLE9BQU8sRUFBZSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUdwRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFdEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDL0csT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDekUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFJckYsT0FBTyxFQUF3QixZQUFZLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUkxRSxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUV4RixPQUFPLEVBQUUsYUFBYSxFQUEyQyxtQkFBbUIsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3RJLE9BQU8sZ0NBQWdDLENBQUM7QUFDeEMsT0FBTyxFQUF3QixZQUFZLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUUxRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUUzRSxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBTVQsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVOzthQUN2QyxXQUFNLEdBQUcsQ0FBQyxBQUFKLENBQUs7SUFVMUIsWUFDa0IsUUFBOEIsRUFDL0MsT0FBc0MsRUFDckIsVUFBc0IsRUFDdkMsc0JBQXNCLEdBQUcsS0FBSyxFQUM5QixtQkFBbUIsR0FBRyxDQUFDLEVBQ3ZCLFFBQTBCLEVBQzFCLFlBQW9CLEVBQ0gsd0JBQWtELEVBQ2xELGVBQWdELEVBQzdDLGlCQUFxQyxFQUN0QyxnQkFBb0QsRUFDaEQsb0JBQTREO1FBRW5GLEtBQUssRUFBRSxDQUFDO1FBYlMsYUFBUSxHQUFSLFFBQVEsQ0FBc0I7UUFFOUIsZUFBVSxHQUFWLFVBQVUsQ0FBWTtRQUt0Qiw2QkFBd0IsR0FBeEIsd0JBQXdCLENBQTBCO1FBQ2xELG9CQUFlLEdBQWYsZUFBZSxDQUFpQztRQUU3QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW1CO1FBQy9CLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFyQnBFLHFCQUFnQixHQUFHLE1BQU0sQ0FBQyxFQUFFLHlCQUF1QixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTNELFlBQU8sR0FBK0QsRUFBRSxDQUFDO1FBRXpFLHVCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQzFELHNCQUFpQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUM7UUFFbEQsZUFBVSxHQUF5QixFQUFFLENBQUM7UUFrQnJELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDaEMsTUFBTSxVQUFVLEdBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUErQixFQUFFLEVBQUUsQ0FBQztRQUVsSSxzTEFBc0w7UUFDdEwsTUFBTSxzQkFBc0IsR0FBa0IsRUFBRSxDQUFDO1FBRWpELDJGQUEyRjtRQUMzRiw4REFBOEQ7UUFDOUQsSUFBSSx5QkFBeUIsR0FBRyxtQkFBbUIsQ0FBQztRQUNwRCxJQUFJLDJCQUEyQixHQUFHLENBQUMsQ0FBQztRQUVwQyx1REFBdUQ7UUFDdkQsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QyxHQUFHLEVBQUUsSUFBSTtZQUNULE1BQU0sRUFBRSxJQUFJO1NBQ1osQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRWQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUU7WUFDL0Qsc0JBQXNCO1lBQ3RCLHFCQUFxQixFQUFFLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRTtnQkFDaEQsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQUksQ0FBQyxHQUFHLElBQUksNEJBQTRCLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3RJLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztvQkFDM0csTUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3BDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO29CQUMxQyxPQUFPLGtCQUFrQixDQUFDO2dCQUMzQixDQUFDO2dCQUNELElBQUksVUFBVSxLQUFLLG1CQUFtQixFQUFFLENBQUM7b0JBQ3hDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHlCQUF5QixFQUFFLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDM0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDdkYsT0FBTyxjQUFjLENBQUMsT0FBTyxDQUFDO2dCQUMvQixDQUFDO2dCQUNELE1BQU0sV0FBVyxHQUFHLHlCQUF5QixFQUFFLENBQUM7Z0JBQ2hELE1BQU0sYUFBYSxHQUFHLDJCQUEyQixFQUFFLENBQUM7Z0JBQ3BELElBQUksU0FBOEIsQ0FBQztnQkFDbkMsSUFBSSxLQUF3QixDQUFDO2dCQUM3QixJQUFJLEtBQW9ELENBQUM7Z0JBQ3pELElBQUksY0FBMEMsQ0FBQztnQkFDL0MsSUFBSSxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLENBQUMsRUFBRSxDQUFDO29CQUN2RCxJQUFJLENBQUM7d0JBQ0osTUFBTSxVQUFVLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQzVDLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN6RCxTQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUNoSCxDQUFDO29CQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7d0JBQ1osT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ2pCLENBQUM7Z0JBQ0YsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDekYsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO29CQUM5RixNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUM7b0JBQzlKLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO29CQUN6QixjQUFjLEdBQUcsb0JBQW9CLENBQUM7b0JBQ3RDLFNBQVMsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO2dCQUM5QixDQUFDO2dCQUVELE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFLGtCQUFrQixDQUFDO2dCQUN0RixNQUFNLGFBQWEsR0FBRztvQkFDckIsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLHNCQUFzQjtpQkFDOUMsQ0FBQztnQkFDRixJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDL0IsYUFBYSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7Z0JBQ3pDLENBQUM7Z0JBQ0QsTUFBTSxhQUFhLEdBQW1CLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLHVCQUF1QixFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFFbFMsSUFBSSxPQUFPLENBQUMsc0JBQXNCLElBQUksQ0FBQyxjQUFjLEVBQUUsYUFBYSxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNoRyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLENBQUM7b0JBQ3pGLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUV2QixnSkFBZ0o7b0JBQ2hKLHlIQUF5SDtvQkFDekgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBRTFGLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDO29CQUNsRCxNQUFNLElBQUksR0FBdUIsSUFBSTt3QkFBQTs0QkFDM0Isd0JBQW1CLEdBQUcsbUJBQW1CLENBQUM7NEJBQzFDLG1CQUFjLEdBQUcsV0FBVyxDQUFDOzRCQUM3QixjQUFTLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQzs0QkFDdkIsZ0JBQVcsR0FBRyxLQUFLLENBQUM7NEJBQ3BCLGtCQUFhLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQzs0QkFDM0Msa0JBQWEsR0FBRyxTQUFTLENBQUMsQ0FBQyxvQkFBb0I7NEJBTXRDLGVBQVUsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUkxRCxDQUFDO3dCQVRBLElBQVcsR0FBRzs0QkFDYiw4REFBOEQ7NEJBQzlELGtFQUFrRTs0QkFDbEUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQzt3QkFDdkIsQ0FBQzt3QkFFTSxLQUFLOzRCQUNYLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQ3BCLENBQUM7cUJBQ0QsRUFBRSxDQUFDO29CQUNKLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMzQixzQkFBc0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2pDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7Z0JBQzNCLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7b0JBQ3hFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsYUFBYSxDQUFDLGFBQWEsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ2xJLElBQUksWUFBWSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO3dCQUN6QywrR0FBK0c7d0JBQy9HLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsY0FBYyxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxhQUFhLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7NEJBQ3ROLDZDQUE2Qzs0QkFDN0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLGFBQWEsQ0FBQzs0QkFDbEYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDO3dCQUNoQyxDQUFDLENBQUMsQ0FBQztvQkFDSixDQUFDO29CQUNELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN2QixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztvQkFDbEQsTUFBTSxJQUFJLEdBQXVCLElBQUk7d0JBQUE7NEJBQzNCLHdCQUFtQixHQUFHLG1CQUFtQixDQUFDOzRCQUMxQyxtQkFBYyxHQUFHLFdBQVcsQ0FBQzs0QkFDN0IsY0FBUyxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUM7NEJBQ3ZCLGdCQUFXLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQzs0QkFDbkMsa0JBQWEsR0FBRyxjQUFjLEVBQUUsYUFBYSxDQUFDOzRCQUM5QyxrQkFBYSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7NEJBSWxDLGVBQVUsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUlsRCxDQUFDO3dCQVBBLElBQVcsR0FBRzs0QkFDYixPQUFPLFNBQVMsQ0FBQzt3QkFDbEIsQ0FBQzt3QkFFTSxLQUFLOzRCQUNYLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQ25DLENBQUM7cUJBQ0QsRUFBRSxDQUFDO29CQUNKLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMzQixzQkFBc0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2pDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7Z0JBQzNCLENBQUM7WUFDRixDQUFDO1lBQ0QsbUJBQW1CLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRTtTQUN6RCxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFFaEIsTUFBTSwyQkFBMkIsR0FBRyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUN6RyxJQUFJLENBQUMsU0FBUyxDQUFDLDJCQUEyQixDQUFDLGlDQUFpQyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUV4RyxzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQy9CLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxTQUFpQixFQUFFLFNBQWlCLEVBQUUsVUFBOEIsRUFBRSxhQUE4QixFQUFFLFdBQW9CO1FBQ3JKLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNqSCxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ25CLFNBQVMsQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQzlDLENBQUM7UUFDRCxPQUFPO1lBQ04sTUFBTSxFQUFFLFNBQVM7WUFDakIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7U0FDbEMsQ0FBQztJQUNILENBQUM7SUFFTyxlQUFlLENBQUMsSUFBb0IsRUFBRSxJQUFZLEVBQUUsVUFBbUIsRUFBRSxZQUFvQjtRQUNwRyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7UUFDOUIsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtnQkFDN0osNkNBQTZDO2dCQUM3QyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsYUFBYSxDQUFDO2dCQUN6RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEMsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFFdEMsT0FBTyxHQUFHLENBQUM7SUFDWixDQUFDO0lBRUQsY0FBYyxDQUFDLEtBQTZDO1FBQzNELE9BQU8sS0FBSyxDQUFDLElBQUksS0FBSyxpQkFBaUIsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLO2VBQzdGLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxLQUFLLFNBQVMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzlMLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBYTtRQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNuQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLFlBQVksYUFBYSxFQUFFLENBQUM7Z0JBQ3pDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzFCLENBQUM7aUJBQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxZQUFZLGtCQUFrQixFQUFFLENBQUM7Z0JBQ3JELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzlDLElBQUksY0FBYyxDQUFDLGFBQWEsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsS0FBSyxjQUFjLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7b0JBQzVHLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUM3RSxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGFBQWEsQ0FBQyxVQUF1QjtRQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVCLENBQUM7O0FBbE5XLHVCQUF1QjtJQXFCakMsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFlBQUEscUJBQXFCLENBQUE7R0F2QlgsdUJBQXVCLENBbU5uQzs7QUFFTSxJQUFNLFVBQVUsR0FBaEIsTUFBTSxVQUFXLFNBQVEsVUFBVTtJQUlsQyxLQUFLO1FBQ1gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztJQUN6QixDQUFDO0lBRUQsWUFDQyxPQUEwQixFQUMxQixRQUErQixFQUMvQixzQkFBK0MsRUFDeEIsb0JBQTJDO1FBRWxFLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUNqRCxPQUFPLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxhQUFhLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLHNCQUFzQixDQUFDLENBQUM7UUFDNUgsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxHQUFHO1FBQ0YsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuQyxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbEIsT0FBTztZQUNOLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO1lBQ3BCLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2IsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNsQixLQUFLLEdBQUcsSUFBSSxDQUFDO2dCQUNiLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQy9CLENBQUM7U0FDRCxDQUFDO0lBQ0gsQ0FBQztDQUNELENBQUE7QUFqQ1ksVUFBVTtJQVlwQixXQUFBLHFCQUFxQixDQUFBO0dBWlgsVUFBVSxDQWlDdEI7O0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxHQUFXO0lBQ2hELEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDakIsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQixDQUFDO0FBRUQsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxVQUFVO0lBUTFDLElBQVcsR0FBRztRQUNiLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNsQixDQUFDO0lBTUQsWUFDa0IsU0FBaUIsRUFDakIsU0FBaUIsRUFDakIsVUFBOEIsRUFDaEMsWUFBNEMsRUFDM0MsYUFBOEMsRUFDL0MsWUFBNEMsRUFDekMsZUFBa0QsRUFDL0Msa0JBQXdELEVBQ3pELGlCQUFzRCxFQUM1RCxXQUEwQyxFQUN6QyxZQUE0QyxFQUM3QyxXQUEwQztRQUV4RCxLQUFLLEVBQUUsQ0FBQztRQWJTLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFDakIsY0FBUyxHQUFULFNBQVMsQ0FBUTtRQUNqQixlQUFVLEdBQVYsVUFBVSxDQUFvQjtRQUNmLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQzFCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUM5QixpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUN4QixvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7UUFDOUIsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFxQjtRQUN4QyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQzNDLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ3hCLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQzVCLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBeEJ4QyxVQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQVVoRCxtQkFBYyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxFQUFFLENBQUMsQ0FBQztRQWlCeEUsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLElBQUksRUFBRTtZQUMxRSxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUM7b0JBQzdCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRTtvQkFDckQsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFO29CQUNyRCxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFO2lCQUM1QixDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNyQixJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUN2RCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLEVBQUU7WUFDN0YsTUFBTSxLQUFLLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3hFLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVyQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDO2dCQUN2QyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO2dCQUN6QyxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsS0FBSztnQkFDdEIsVUFBVSxFQUFFLEdBQUcsRUFBRTtvQkFDaEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDL0ssT0FBTyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDeEMsQ0FBQzthQUNELENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsTUFBTSxDQUFDLEdBQVEsRUFBRSxXQUFxQjtRQUNyQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRTVCLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO1FBRWhCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTVELElBQUksV0FBVyxHQUFHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxhQUFhLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDO1FBQ3hFLElBQUksYUFBYSxHQUFHLFdBQVcsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDL0MsSUFBSSxrQkFBa0IsR0FBRyxhQUFhLEVBQUUsMEJBQTBCLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDekUsTUFBTSxVQUFVLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUUxRixJQUFJLFdBQVcsR0FBYSxFQUFFLENBQUM7UUFDL0IsSUFBSSxXQUFXLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNoQyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDMUQsV0FBVyxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRCxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1lBQzFFLFdBQVcsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNsQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDO1FBRXJDLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN2RCxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzNCLElBQUksV0FBVyxFQUFFLENBQUM7WUFDakIsV0FBVyxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsMkJBQTJCLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTVFLE1BQU0sVUFBVSxHQUFHLENBQUMsT0FBMEMsRUFBRSxFQUFFO1lBQ2pFLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1lBQ3JILE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7WUFDM0gsSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDO2dCQUMzRCxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQztnQkFDNUIsVUFBVSxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDN0MsWUFBWSxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDakQsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLCtCQUErQixFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNuTCxNQUFNLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsOEJBQThCLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNsTCxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsU0FBUyxFQUFFLHNCQUFzQixFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO2dCQUM3RyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0IsQ0FBQztRQUNGLENBQUMsQ0FBQztRQUVGLElBQUksZ0JBQTRFLENBQUM7UUFFakYsMkRBQTJEO1FBRTNELElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNuQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xCLFdBQVcsR0FBRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7Z0JBQ3RFLGFBQWEsR0FBRyxXQUFXLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLENBQUM7WUFFRCxrQkFBa0IsR0FBRyxhQUFhLEVBQUUsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksU0FBUyxHQUFHLGdCQUFnQixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQyxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsU0FBUyxJQUFJLENBQUMsa0JBQWtCLElBQUksa0JBQWtCLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDekcsTUFBTSxZQUFZLEdBQUcsYUFBYSxFQUFFLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekQsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNqQyxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUM7Z0JBQzNCLFdBQVcsQ0FBQyxXQUFXLEdBQUcsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQ0FBbUMsRUFBRSwwQkFBMEIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3JOLENBQUM7aUJBQU0sSUFBSSxDQUFDLFdBQVcsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDdkMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7Z0JBQzFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDaEcsV0FBVyxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7WUFDOUIsQ0FBQztZQUVELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUN2QixnQkFBZ0IsR0FBRyxhQUFhLElBQUksV0FBVztvQkFDOUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQztvQkFDbEcsQ0FBQyxDQUFDLFNBQVMsQ0FBQztnQkFDYixTQUFTLEdBQUcsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFFRCxJQUFJLENBQUMsV0FBVyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNoQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdkIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sYUFBYSxDQUFDLE9BQWU7UUFDcEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQzFFO2dCQUNDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBUTtnQkFDdEIsVUFBVSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO2dCQUNoRCxRQUFRLEVBQUUsRUFBRSxhQUFhLDZCQUFxQixFQUFFO2dCQUNoRCxXQUFXLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFO2FBQ3BDLENBQ0QsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7Q0FDRCxDQUFBO0FBaEtLLGtCQUFrQjtJQW9CckIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxnQkFBZ0IsQ0FBQTtJQUNoQixXQUFBLG1CQUFtQixDQUFBO0lBQ25CLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsV0FBQSxZQUFZLENBQUE7SUFDWixZQUFBLGFBQWEsQ0FBQTtJQUNiLFlBQUEsWUFBWSxDQUFBO0dBNUJULGtCQUFrQixDQWdLdkIifQ==