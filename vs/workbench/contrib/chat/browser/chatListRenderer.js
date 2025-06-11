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
var ChatListItemRenderer_1;
import * as dom from '../../../../base/browser/dom.js';
import { renderFormattedText } from '../../../../base/browser/formattedTextRenderer.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { DropdownMenuActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { coalesce, distinct } from '../../../../base/common/arrays.js';
import { findLast } from '../../../../base/common/arraysFind.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore, dispose, thenIfNotDisposed, toDisposable } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { FileAccess } from '../../../../base/common/network.js';
import { clamp } from '../../../../base/common/numbers.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { createActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkbenchIssueService } from '../../issue/common/issue.js';
import { annotateSpecialMarkdownContent } from '../common/annotations.js';
import { checkModeOption } from '../common/chat.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { chatSubcommandLeader } from '../common/chatParserTypes.js';
import { ChatAgentVoteDirection, ChatAgentVoteDownReason, ChatErrorLevel } from '../common/chatService.js';
import { isRequestVM, isResponseVM } from '../common/chatViewModel.js';
import { getNWords } from '../common/chatWordCounter.js';
import { CodeBlockModelCollection } from '../common/codeBlockModelCollection.js';
import { ChatAgentLocation } from '../common/constants.js';
import { MarkUnhelpfulActionId } from './actions/chatTitleActions.js';
import { IChatWidgetService } from './chat.js';
import { ChatAgentHover, getChatAgentHoverOptions } from './chatAgentHover.js';
import { ChatAgentCommandContentPart } from './chatContentParts/chatAgentCommandContentPart.js';
import { ChatAttachmentsContentPart } from './chatContentParts/chatAttachmentsContentPart.js';
import { ChatCodeCitationContentPart } from './chatContentParts/chatCodeCitationContentPart.js';
import { ChatCommandButtonContentPart } from './chatContentParts/chatCommandContentPart.js';
import { ChatConfirmationContentPart } from './chatContentParts/chatConfirmationContentPart.js';
import { ChatErrorConfirmationContentPart } from './chatContentParts/chatErrorConfirmationPart.js';
import { ChatExtensionsContentPart } from './chatContentParts/chatExtensionsContentPart.js';
import { ChatMarkdownContentPart, EditorPool } from './chatContentParts/chatMarkdownContentPart.js';
import { ChatProgressContentPart, ChatWorkingProgressContentPart } from './chatContentParts/chatProgressContentPart.js';
import { ChatQuotaExceededPart } from './chatContentParts/chatQuotaExceededPart.js';
import { ChatUsedReferencesListContentPart, CollapsibleListPool } from './chatContentParts/chatReferencesContentPart.js';
import { ChatTaskContentPart } from './chatContentParts/chatTaskContentPart.js';
import { ChatTextEditContentPart, DiffEditorPool } from './chatContentParts/chatTextEditContentPart.js';
import { ChatTreeContentPart, TreePool } from './chatContentParts/chatTreeContentPart.js';
import { ChatErrorContentPart } from './chatContentParts/chatErrorContentPart.js';
import { ChatToolInvocationPart } from './chatContentParts/toolInvocationParts/chatToolInvocationPart.js';
import { ChatMarkdownDecorationsRenderer } from './chatMarkdownDecorationsRenderer.js';
import { ChatMarkdownRenderer } from './chatMarkdownRenderer.js';
import { ChatCodeBlockContentProvider } from './codeBlockPart.js';
import { canceledName } from '../../../../base/common/errors.js';
const $ = dom.$;
const forceVerboseLayoutTracing = false;
const mostRecentResponseClassName = 'chat-most-recent-response';
let ChatListItemRenderer = class ChatListItemRenderer extends Disposable {
    static { ChatListItemRenderer_1 = this; }
    static { this.ID = 'item'; }
    constructor(editorOptions, rendererOptions, delegate, codeBlockModelCollection, overflowWidgetsDomNode, instantiationService, configService, logService, contextKeyService, themeService, commandService, hoverService, chatWidgetService) {
        super();
        this.rendererOptions = rendererOptions;
        this.delegate = delegate;
        this.codeBlockModelCollection = codeBlockModelCollection;
        this.instantiationService = instantiationService;
        this.configService = configService;
        this.logService = logService;
        this.contextKeyService = contextKeyService;
        this.themeService = themeService;
        this.commandService = commandService;
        this.hoverService = hoverService;
        this.chatWidgetService = chatWidgetService;
        this.codeBlocksByResponseId = new Map();
        this.codeBlocksByEditorUri = new ResourceMap();
        this.fileTreesByResponseId = new Map();
        this.focusedFileTreesByResponseId = new Map();
        this._onDidClickFollowup = this._register(new Emitter());
        this.onDidClickFollowup = this._onDidClickFollowup.event;
        this._onDidClickRerunWithAgentOrCommandDetection = new Emitter();
        this.onDidClickRerunWithAgentOrCommandDetection = this._onDidClickRerunWithAgentOrCommandDetection.event;
        this._onDidChangeItemHeight = this._register(new Emitter());
        this.onDidChangeItemHeight = this._onDidChangeItemHeight.event;
        this._currentLayoutWidth = 0;
        this._isVisible = true;
        this._onDidChangeVisibility = this._register(new Emitter());
        this.renderer = this.instantiationService.createInstance(ChatMarkdownRenderer, undefined);
        this.markdownDecorationsRenderer = this.instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
        this._editorPool = this._register(this.instantiationService.createInstance(EditorPool, editorOptions, delegate, overflowWidgetsDomNode));
        this._toolEditorPool = this._register(this.instantiationService.createInstance(EditorPool, editorOptions, delegate, overflowWidgetsDomNode));
        this._diffEditorPool = this._register(this.instantiationService.createInstance(DiffEditorPool, editorOptions, delegate, overflowWidgetsDomNode));
        this._treePool = this._register(this.instantiationService.createInstance(TreePool, this._onDidChangeVisibility.event));
        this._contentReferencesListPool = this._register(this.instantiationService.createInstance(CollapsibleListPool, this._onDidChangeVisibility.event, undefined));
        this._register(this.instantiationService.createInstance(ChatCodeBlockContentProvider));
        this._toolInvocationCodeBlockCollection = this._register(this.instantiationService.createInstance(CodeBlockModelCollection, 'tools'));
    }
    get templateId() {
        return ChatListItemRenderer_1.ID;
    }
    editorsInUse() {
        return Iterable.concat(this._editorPool.inUse(), this._toolEditorPool.inUse());
    }
    traceLayout(method, message) {
        if (forceVerboseLayoutTracing) {
            this.logService.info(`ChatListItemRenderer#${method}: ${message}`);
        }
        else {
            this.logService.trace(`ChatListItemRenderer#${method}: ${message}`);
        }
    }
    /**
     * Compute a rate to render at in words/s.
     */
    getProgressiveRenderRate(element) {
        let Rate;
        (function (Rate) {
            Rate[Rate["Min"] = 5] = "Min";
            Rate[Rate["Max"] = 2000] = "Max";
        })(Rate || (Rate = {}));
        const minAfterComplete = 80;
        const rate = element.contentUpdateTimings?.impliedWordLoadRate;
        if (element.isComplete || element.isPaused.get()) {
            if (typeof rate === 'number') {
                return clamp(rate, minAfterComplete, 2000 /* Rate.Max */);
            }
            else {
                return minAfterComplete;
            }
        }
        if (typeof rate === 'number') {
            return clamp(rate, 5 /* Rate.Min */, 2000 /* Rate.Max */);
        }
        return 8;
    }
    getCodeBlockInfosForResponse(response) {
        const codeBlocks = this.codeBlocksByResponseId.get(response.id);
        return codeBlocks ?? [];
    }
    getCodeBlockInfoForEditor(uri) {
        return this.codeBlocksByEditorUri.get(uri);
    }
    getFileTreeInfosForResponse(response) {
        const fileTrees = this.fileTreesByResponseId.get(response.id);
        return fileTrees ?? [];
    }
    getLastFocusedFileTreeForResponse(response) {
        const fileTrees = this.fileTreesByResponseId.get(response.id);
        const lastFocusedFileTreeIndex = this.focusedFileTreesByResponseId.get(response.id);
        if (fileTrees?.length && lastFocusedFileTreeIndex !== undefined && lastFocusedFileTreeIndex < fileTrees.length) {
            return fileTrees[lastFocusedFileTreeIndex];
        }
        return undefined;
    }
    setVisible(visible) {
        this._isVisible = visible;
        this._onDidChangeVisibility.fire(visible);
    }
    layout(width) {
        const newWidth = width - 40; // padding
        if (newWidth !== this._currentLayoutWidth) {
            this._currentLayoutWidth = newWidth;
            for (const editor of this._editorPool.inUse()) {
                editor.layout(this._currentLayoutWidth);
            }
            for (const toolEditor of this._toolEditorPool.inUse()) {
                toolEditor.layout(this._currentLayoutWidth);
            }
            for (const diffEditor of this._diffEditorPool.inUse()) {
                diffEditor.layout(this._currentLayoutWidth);
            }
        }
    }
    renderTemplate(container) {
        const templateDisposables = new DisposableStore();
        const rowContainer = dom.append(container, $('.interactive-item-container'));
        if (this.rendererOptions.renderStyle === 'compact') {
            rowContainer.classList.add('interactive-item-compact');
        }
        let headerParent = rowContainer;
        let valueParent = rowContainer;
        let detailContainerParent;
        if (this.rendererOptions.renderStyle === 'minimal') {
            rowContainer.classList.add('interactive-item-compact');
            rowContainer.classList.add('minimal');
            // -----------------------------------------------------
            //  icon | details
            //       | references
            //       | value
            // -----------------------------------------------------
            const lhsContainer = dom.append(rowContainer, $('.column.left'));
            const rhsContainer = dom.append(rowContainer, $('.column.right'));
            headerParent = lhsContainer;
            detailContainerParent = rhsContainer;
            valueParent = rhsContainer;
        }
        const header = dom.append(headerParent, $('.header'));
        const contextKeyService = templateDisposables.add(this.contextKeyService.createScoped(rowContainer));
        const scopedInstantiationService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
        const requestHover = dom.append(rowContainer, $('.request-hover'));
        let titleToolbar;
        if (this.rendererOptions.noHeader) {
            header.classList.add('hidden');
        }
        else {
            titleToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, requestHover, MenuId.ChatMessageTitle, {
                menuOptions: {
                    shouldForwardArgs: true
                },
                toolbarOptions: {
                    shouldInlineSubmenu: submenu => submenu.actions.length <= 1
                },
            }));
        }
        templateDisposables.add(dom.addDisposableListener(rowContainer, 'mouseenter', () => {
            if (isRequestVM(template.currentElement)) {
                dom.show(requestHover);
            }
        }));
        templateDisposables.add(dom.addDisposableListener(rowContainer, 'mouseleave', () => {
            if (isRequestVM(template.currentElement)) {
                dom.hide(requestHover);
            }
        }));
        dom.hide(requestHover);
        const user = dom.append(header, $('.user'));
        const avatarContainer = dom.append(user, $('.avatar-container'));
        const username = dom.append(user, $('h3.username'));
        username.tabIndex = 0;
        const detailContainer = dom.append(detailContainerParent ?? user, $('span.detail-container'));
        const detail = dom.append(detailContainer, $('span.detail'));
        dom.append(detailContainer, $('span.chat-animated-ellipsis'));
        const value = dom.append(valueParent, $('.value'));
        const elementDisposables = new DisposableStore();
        const footerToolbarContainer = dom.append(rowContainer, $('.chat-footer-toolbar'));
        const footerToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, footerToolbarContainer, MenuId.ChatMessageFooter, {
            eventDebounceDelay: 0,
            menuOptions: { shouldForwardArgs: true, renderShortTitle: true },
            toolbarOptions: { shouldInlineSubmenu: submenu => submenu.actions.length <= 1 },
            actionViewItemProvider: (action, options) => {
                if (action instanceof MenuItemAction && action.item.id === MarkUnhelpfulActionId) {
                    return scopedInstantiationService.createInstance(ChatVoteDownButton, action, options);
                }
                return createActionViewItem(scopedInstantiationService, action, options);
            }
        }));
        const agentHover = templateDisposables.add(this.instantiationService.createInstance(ChatAgentHover));
        const hoverContent = () => {
            if (isResponseVM(template.currentElement) && template.currentElement.agent && !template.currentElement.agent.isDefault) {
                agentHover.setAgent(template.currentElement.agent.id);
                return agentHover.domNode;
            }
            return undefined;
        };
        const hoverOptions = getChatAgentHoverOptions(() => isResponseVM(template.currentElement) ? template.currentElement.agent : undefined, this.commandService);
        templateDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), user, hoverContent, hoverOptions));
        templateDisposables.add(dom.addDisposableListener(user, dom.EventType.KEY_DOWN, e => {
            const ev = new StandardKeyboardEvent(e);
            if (ev.equals(10 /* KeyCode.Space */) || ev.equals(3 /* KeyCode.Enter */)) {
                const content = hoverContent();
                if (content) {
                    this.hoverService.showInstantHover({ content, target: user, trapFocus: true, actions: hoverOptions.actions }, true);
                }
            }
            else if (ev.equals(9 /* KeyCode.Escape */)) {
                this.hoverService.hideHover();
            }
        }));
        const template = { header, avatarContainer, requestHover, username, detail, value, rowContainer, elementDisposables, templateDisposables, contextKeyService, instantiationService: scopedInstantiationService, agentHover, titleToolbar, footerToolbar };
        return template;
    }
    renderElement(node, index, templateData) {
        this.renderChatTreeItem(node.element, index, templateData);
    }
    clearRenderedParts(templateData) {
        if (templateData.renderedParts) {
            dispose(coalesce(templateData.renderedParts));
            templateData.renderedParts = undefined;
            dom.clearNode(templateData.value);
        }
    }
    renderChatTreeItem(element, index, templateData) {
        if (templateData.currentElement && templateData.currentElement.id !== element.id) {
            this.traceLayout('renderChatTreeItem', `Rendering a different element into the template, index=${index}`);
            this.clearRenderedParts(templateData);
        }
        templateData.currentElement = element;
        const kind = isRequestVM(element) ? 'request' :
            isResponseVM(element) ? 'response' :
                'welcome';
        this.traceLayout('renderElement', `${kind}, index=${index}`);
        ChatContextKeys.isResponse.bindTo(templateData.contextKeyService).set(isResponseVM(element));
        ChatContextKeys.itemId.bindTo(templateData.contextKeyService).set(element.id);
        ChatContextKeys.isRequest.bindTo(templateData.contextKeyService).set(isRequestVM(element));
        ChatContextKeys.responseDetectedAgentCommand.bindTo(templateData.contextKeyService).set(isResponseVM(element) && element.agentOrSlashCommandDetected);
        if (isResponseVM(element)) {
            ChatContextKeys.responseSupportsIssueReporting.bindTo(templateData.contextKeyService).set(!!element.agent?.metadata.supportIssueReporting);
            ChatContextKeys.responseVote.bindTo(templateData.contextKeyService).set(element.vote === ChatAgentVoteDirection.Up ? 'up' : element.vote === ChatAgentVoteDirection.Down ? 'down' : '');
        }
        else {
            ChatContextKeys.responseVote.bindTo(templateData.contextKeyService).set('');
        }
        if (templateData.titleToolbar) {
            templateData.titleToolbar.context = element;
        }
        templateData.footerToolbar.context = element;
        ChatContextKeys.responseHasError.bindTo(templateData.contextKeyService).set(isResponseVM(element) && !!element.errorDetails);
        const isFiltered = !!(isResponseVM(element) && element.errorDetails?.responseIsFiltered);
        ChatContextKeys.responseIsFiltered.bindTo(templateData.contextKeyService).set(isFiltered);
        const location = this.chatWidgetService.getWidgetBySessionId(element.sessionId)?.location;
        templateData.rowContainer.classList.toggle('editing-session', location === ChatAgentLocation.Panel);
        templateData.rowContainer.classList.toggle('interactive-request', isRequestVM(element));
        templateData.rowContainer.classList.toggle('interactive-response', isResponseVM(element));
        const progressMessageAtBottomOfResponse = checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse);
        templateData.rowContainer.classList.toggle('show-detail-progress', isResponseVM(element) && !element.isComplete && !element.progressMessages.length && !element.model.isPaused.get() && !progressMessageAtBottomOfResponse);
        templateData.username.textContent = element.username;
        if (!this.rendererOptions.noHeader) {
            this.renderAvatar(element, templateData);
        }
        dom.hide(templateData.requestHover);
        dom.clearNode(templateData.detail);
        if (isResponseVM(element)) {
            this.renderDetail(element, templateData);
        }
        // hack @joaomoreno
        templateData.rowContainer.parentElement?.parentElement?.parentElement?.classList.toggle('request', isRequestVM(element));
        templateData.rowContainer.classList.toggle(mostRecentResponseClassName, index === this.delegate.getListLength() - 1);
        templateData.rowContainer.classList.toggle('confirmation-message', isRequestVM(element) && !!element.confirmation);
        // TODO: @justschen decide if we want to hide the header for requests or not
        const shouldShowHeader = isResponseVM(element) && !this.rendererOptions.noHeader;
        templateData.header?.classList.toggle('header-disabled', !shouldShowHeader);
        if (isRequestVM(element) && element.confirmation) {
            this.renderConfirmationAction(element, templateData);
        }
        // Do a progressive render if
        // - This the last response in the list
        // - And it has some content
        // - And the response is not complete
        //   - Or, we previously started a progressive rendering of this element (if the element is complete, we will finish progressive rendering with a very fast rate)
        if (isResponseVM(element) && index === this.delegate.getListLength() - 1 && (!element.isComplete || element.renderData)) {
            this.traceLayout('renderElement', `start progressive render, index=${index}`);
            const timer = templateData.elementDisposables.add(new dom.WindowIntervalTimer());
            const runProgressiveRender = (initial) => {
                try {
                    if (this.doNextProgressiveRender(element, index, templateData, !!initial)) {
                        timer.cancel();
                    }
                }
                catch (err) {
                    // Kill the timer if anything went wrong, avoid getting stuck in a nasty rendering loop.
                    timer.cancel();
                    this.logService.error(err);
                }
            };
            timer.cancelAndSet(runProgressiveRender, 50, dom.getWindow(templateData.rowContainer));
            runProgressiveRender(true);
        }
        else {
            if (isResponseVM(element)) {
                this.renderChatResponseBasic(element, index, templateData);
            }
            else if (isRequestVM(element)) {
                this.renderChatRequest(element, index, templateData);
            }
        }
    }
    renderDetail(element, templateData) {
        dom.clearNode(templateData.detail);
        if (element.agentOrSlashCommandDetected) {
            const msg = element.slashCommand ? localize('usedAgentSlashCommand', "used {0} [[(rerun without)]]", `${chatSubcommandLeader}${element.slashCommand.name}`) : localize('usedAgent', "[[(rerun without)]]");
            dom.reset(templateData.detail, renderFormattedText(msg, {
                className: 'agentOrSlashCommandDetected',
                inline: true,
                actionHandler: {
                    disposables: templateData.elementDisposables,
                    callback: (content) => {
                        this._onDidClickRerunWithAgentOrCommandDetection.fire(element);
                    },
                }
            }));
        }
        else if (this.rendererOptions.renderStyle !== 'minimal' && !element.isComplete && !checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse)) {
            if (element.model.isPaused.get()) {
                templateData.detail.textContent = localize('paused', "Paused");
            }
            else {
                templateData.detail.textContent = localize('working', "Working");
            }
        }
    }
    renderConfirmationAction(element, templateData) {
        dom.clearNode(templateData.detail);
        if (element.confirmation) {
            templateData.detail.textContent = localize('chatConfirmationAction', 'selected "{0}"', element.confirmation);
            templateData.header?.classList.remove('header-disabled');
        }
    }
    renderAvatar(element, templateData) {
        const icon = isResponseVM(element) ?
            this.getAgentIcon(element.agent?.metadata) :
            (element.avatarIcon ?? Codicon.account);
        if (icon instanceof URI) {
            const avatarIcon = dom.$('img.icon');
            avatarIcon.src = FileAccess.uriToBrowserUri(icon).toString(true);
            templateData.avatarContainer.replaceChildren(dom.$('.avatar', undefined, avatarIcon));
        }
        else {
            const avatarIcon = dom.$(ThemeIcon.asCSSSelector(icon));
            templateData.avatarContainer.replaceChildren(dom.$('.avatar.codicon-avatar', undefined, avatarIcon));
        }
    }
    getAgentIcon(agent) {
        if (agent?.themeIcon) {
            return agent.themeIcon;
        }
        else if (agent?.iconDark && this.themeService.getColorTheme().type === ColorScheme.DARK) {
            return agent.iconDark;
        }
        else if (agent?.icon) {
            return agent.icon;
        }
        else {
            return Codicon.copilot;
        }
    }
    renderChatResponseBasic(element, index, templateData) {
        templateData.rowContainer.classList.toggle('chat-response-loading', (isResponseVM(element) && !element.isComplete));
        const content = [];
        // Always add the references to avoid shifting the content parts when a reference is added, and having to re-diff all the content.
        // The part will hide itself if the list is empty.
        content.push({ kind: 'references', references: element.contentReferences });
        content.push(...annotateSpecialMarkdownContent(element.response.value));
        if (element.codeCitations.length) {
            content.push({ kind: 'codeCitations', citations: element.codeCitations });
        }
        if (element.errorDetails?.message && element.errorDetails.message !== canceledName) {
            content.push({ kind: 'errorDetails', errorDetails: element.errorDetails, isLast: index === this.delegate.getListLength() - 1 });
        }
        const isFiltered = !!element.errorDetails?.responseIsFiltered;
        if (!isFiltered) {
            const diff = this.diff(templateData.renderedParts ?? [], content, element);
            this.renderChatContentDiff(diff, content, element, index, templateData);
        }
        else {
            dom.clearNode(templateData.value);
            if (templateData.renderedParts) {
                dispose(templateData.renderedParts);
            }
            templateData.renderedParts = [];
        }
        this.updateItemHeightOnRender(element, templateData);
    }
    renderChatRequest(element, index, templateData) {
        templateData.rowContainer.classList.toggle('chat-response-loading', false);
        let content = [];
        if (!element.confirmation) {
            const markdown = 'message' in element.message ?
                element.message.message :
                this.markdownDecorationsRenderer.convertParsedRequestToMarkdown(element.message);
            content = [{ content: new MarkdownString(markdown), kind: 'markdownContent' }];
            if (this.rendererOptions.renderStyle === 'minimal' && !element.isComplete) {
                templateData.value.classList.add('inline-progress');
                templateData.elementDisposables.add(toDisposable(() => templateData.value.classList.remove('inline-progress')));
                content.push({ content: new MarkdownString('<span></span>', { supportHtml: true }), kind: 'markdownContent' });
            }
            else {
                templateData.value.classList.remove('inline-progress');
            }
        }
        dom.clearNode(templateData.value);
        const parts = [];
        let inlineSlashCommandRendered = false;
        content.forEach((data, contentIndex) => {
            const context = {
                element,
                elementIndex: index,
                contentIndex: contentIndex,
                content: content,
                preceedingContentParts: parts,
                container: templateData.rowContainer,
            };
            const newPart = this.renderChatContentPart(data, templateData, context);
            if (newPart) {
                if (this.rendererOptions.renderDetectedCommandsWithRequest
                    && !inlineSlashCommandRendered
                    && element.agentOrSlashCommandDetected && element.slashCommand
                    && data.kind === 'markdownContent' // TODO this is fishy but I didn't find a better way to render on the same inline as the MD request part
                ) {
                    if (newPart.domNode) {
                        newPart.domNode.style.display = 'inline-flex';
                    }
                    const cmdPart = this.instantiationService.createInstance(ChatAgentCommandContentPart, element.slashCommand, () => this._onDidClickRerunWithAgentOrCommandDetection.fire({ sessionId: element.sessionId, requestId: element.id }));
                    templateData.value.appendChild(cmdPart.domNode);
                    parts.push(cmdPart);
                    inlineSlashCommandRendered = true;
                }
                if (newPart.domNode) {
                    templateData.value.appendChild(newPart.domNode);
                }
                parts.push(newPart);
            }
        });
        if (templateData.renderedParts) {
            dispose(templateData.renderedParts);
        }
        templateData.renderedParts = parts;
        if (element.variables.length) {
            const newPart = this.renderAttachments(element.variables, element.contentReferences, templateData);
            if (newPart.domNode) {
                // p has a :last-child rule for margin
                templateData.value.appendChild(newPart.domNode);
            }
            templateData.elementDisposables.add(newPart);
        }
        this.updateItemHeightOnRender(element, templateData);
    }
    updateItemHeightOnRender(element, templateData) {
        const newHeight = templateData.rowContainer.offsetHeight;
        const fireEvent = !element.currentRenderedHeight || element.currentRenderedHeight !== newHeight;
        element.currentRenderedHeight = newHeight;
        if (fireEvent) {
            const disposable = templateData.elementDisposables.add(dom.scheduleAtNextAnimationFrame(dom.getWindow(templateData.value), () => {
                // Have to recompute the height here because codeblock rendering is currently async and it may have changed.
                // If it becomes properly sync, then this could be removed.
                element.currentRenderedHeight = templateData.rowContainer.offsetHeight;
                disposable.dispose();
                this._onDidChangeItemHeight.fire({ element, height: element.currentRenderedHeight });
            }));
        }
    }
    updateItemHeight(templateData) {
        if (!templateData.currentElement) {
            return;
        }
        const newHeight = Math.max(templateData.rowContainer.offsetHeight, 1);
        templateData.currentElement.currentRenderedHeight = newHeight;
        this._onDidChangeItemHeight.fire({ element: templateData.currentElement, height: newHeight });
    }
    /**
     *	@returns true if progressive rendering should be considered complete- the element's data is fully rendered or the view is not visible
     */
    doNextProgressiveRender(element, index, templateData, isInRenderElement) {
        if (!this._isVisible) {
            return true;
        }
        if (element.isCanceled) {
            this.traceLayout('doNextProgressiveRender', `canceled, index=${index}`);
            element.renderData = undefined;
            this.renderChatResponseBasic(element, index, templateData);
            return true;
        }
        templateData.rowContainer.classList.toggle('chat-response-loading', true);
        this.traceLayout('doNextProgressiveRender', `START progressive render, index=${index}, renderData=${JSON.stringify(element.renderData)}`);
        const contentForThisTurn = this.getNextProgressiveRenderContent(element);
        const partsToRender = this.diff(templateData.renderedParts ?? [], contentForThisTurn.content, element);
        const contentIsAlreadyRendered = partsToRender.every(part => part === null);
        if (contentIsAlreadyRendered) {
            if (contentForThisTurn.moreContentAvailable) {
                // The content that we want to render in this turn is already rendered, but there is more content to render on the next tick
                this.traceLayout('doNextProgressiveRender', 'not rendering any new content this tick, but more available');
                return false;
            }
            else if (element.isComplete) {
                // All content is rendered, and response is done, so do a normal render
                this.traceLayout('doNextProgressiveRender', `END progressive render, index=${index} and clearing renderData, response is complete`);
                element.renderData = undefined;
                this.renderChatResponseBasic(element, index, templateData);
                return true;
            }
            else {
                // Nothing new to render, stop rendering until next model update
                this.traceLayout('doNextProgressiveRender', 'caught up with the stream- no new content to render');
                if (!templateData.renderedParts) {
                    // First render? Initialize currentRenderedHeight. https://github.com/microsoft/vscode/issues/232096
                    const height = templateData.rowContainer.offsetHeight;
                    element.currentRenderedHeight = height;
                }
                return true;
            }
        }
        // Do an actual progressive render
        this.traceLayout('doNextProgressiveRender', `doing progressive render, ${partsToRender.length} parts to render`);
        this.renderChatContentDiff(partsToRender, contentForThisTurn.content, element, index, templateData);
        const height = templateData.rowContainer.offsetHeight;
        element.currentRenderedHeight = height;
        if (!isInRenderElement) {
            this._onDidChangeItemHeight.fire({ element, height });
        }
        return false;
    }
    renderChatContentDiff(partsToRender, contentForThisTurn, element, elementIndex, templateData) {
        const renderedParts = templateData.renderedParts ?? [];
        templateData.renderedParts = renderedParts;
        partsToRender.forEach((partToRender, contentIndex) => {
            if (!partToRender) {
                // null=no change
                return;
            }
            const alreadyRenderedPart = templateData.renderedParts?.[contentIndex];
            if (alreadyRenderedPart) {
                alreadyRenderedPart.dispose();
            }
            const preceedingContentParts = renderedParts.slice(0, contentIndex);
            const context = {
                element,
                elementIndex: elementIndex,
                content: contentForThisTurn,
                preceedingContentParts,
                contentIndex: contentIndex,
                container: templateData.rowContainer,
            };
            const newPart = this.renderChatContentPart(partToRender, templateData, context);
            if (newPart) {
                renderedParts[contentIndex] = newPart;
                // Maybe the part can't be rendered in this context, but this shouldn't really happen
                try {
                    if (alreadyRenderedPart?.domNode) {
                        if (newPart.domNode) {
                            // This method can throw HierarchyRequestError
                            alreadyRenderedPart.domNode.replaceWith(newPart.domNode);
                        }
                        else {
                            alreadyRenderedPart.domNode.remove();
                        }
                    }
                    else if (newPart.domNode) {
                        templateData.value.appendChild(newPart.domNode);
                    }
                }
                catch (err) {
                    this.logService.error('ChatListItemRenderer#renderChatContentDiff: error replacing part', err);
                }
            }
            else {
                alreadyRenderedPart?.domNode?.remove();
            }
        });
        // Delete previously rendered parts that are removed
        for (let i = partsToRender.length; i < renderedParts.length; i++) {
            const part = renderedParts[i];
            if (part) {
                part.dispose();
                part.domNode?.remove();
                delete renderedParts[i];
            }
        }
    }
    /**
     * Returns all content parts that should be rendered, and trimmed markdown content. We will diff this with the current rendered set.
     */
    getNextProgressiveRenderContent(element) {
        const data = this.getDataForProgressiveRender(element);
        // An unregistered setting for development- skip the word counting and smoothing, just render content as it comes in
        const renderImmediately = this.configService.getValue('chat.experimental.renderMarkdownImmediately') === true;
        const renderableResponse = annotateSpecialMarkdownContent(element.response.value);
        this.traceLayout('getNextProgressiveRenderContent', `Want to render ${data.numWordsToRender} at ${data.rate} words/s, counting...`);
        let numNeededWords = data.numWordsToRender;
        const partsToRender = [];
        // Always add the references to avoid shifting the content parts when a reference is added, and having to re-diff all the content.
        // The part will hide itself if the list is empty.
        partsToRender.push({ kind: 'references', references: element.contentReferences });
        let moreContentAvailable = false;
        for (let i = 0; i < renderableResponse.length; i++) {
            const part = renderableResponse[i];
            if (part.kind === 'markdownContent' && !renderImmediately) {
                const wordCountResult = getNWords(part.content.value, numNeededWords);
                this.traceLayout('getNextProgressiveRenderContent', `  Chunk ${i}: Want to render ${numNeededWords} words and found ${wordCountResult.returnedWordCount} words. Total words in chunk: ${wordCountResult.totalWordCount}`);
                numNeededWords -= wordCountResult.returnedWordCount;
                if (wordCountResult.isFullString) {
                    partsToRender.push(part);
                    // Consumed full markdown chunk- need to ensure that all following non-markdown parts are rendered
                    for (const nextPart of renderableResponse.slice(i + 1)) {
                        if (nextPart.kind !== 'markdownContent') {
                            i++;
                            partsToRender.push(nextPart);
                        }
                        else {
                            break;
                        }
                    }
                }
                else {
                    // Only taking part of this markdown part
                    moreContentAvailable = true;
                    partsToRender.push({ ...part, content: new MarkdownString(wordCountResult.value, part.content) });
                }
                if (numNeededWords <= 0) {
                    // Collected all words and following non-markdown parts if needed, done
                    if (renderableResponse.slice(i + 1).some(part => part.kind === 'markdownContent')) {
                        moreContentAvailable = true;
                    }
                    break;
                }
            }
            else {
                partsToRender.push(part);
            }
        }
        const lastWordCount = element.contentUpdateTimings?.lastWordCount ?? 0;
        const newRenderedWordCount = data.numWordsToRender - numNeededWords;
        const bufferWords = lastWordCount - newRenderedWordCount;
        this.traceLayout('getNextProgressiveRenderContent', `Want to render ${data.numWordsToRender} words. Rendering ${newRenderedWordCount} words. Buffer: ${bufferWords} words`);
        if (newRenderedWordCount > 0 && newRenderedWordCount !== element.renderData?.renderedWordCount) {
            // Only update lastRenderTime when we actually render new content
            element.renderData = { lastRenderTime: Date.now(), renderedWordCount: newRenderedWordCount, renderedParts: partsToRender };
        }
        if (this.shouldShowWorkingProgress(element, partsToRender)) {
            const isPaused = element.model.isPaused.get();
            partsToRender.push({ kind: 'working', isPaused, setPaused: p => element.model.setPaused(p) });
        }
        return { content: partsToRender, moreContentAvailable };
    }
    shouldShowWorkingProgress(element, partsToRender) {
        if (element.agentOrSlashCommandDetected || this.rendererOptions.renderStyle === 'minimal' || element.isComplete || !checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse)) {
            return false;
        }
        if (element.model.isPaused.get()) {
            return true;
        }
        // Show if no content, only "used references", ends with a complete tool call, or ends with complete text edits and there is no incomplete tool call (edits are still being applied some time after they are all generated)
        const lastPart = findLast(partsToRender, part => part.kind !== 'markdownContent' || part.content.value.trim().length > 0);
        if (!lastPart ||
            lastPart.kind === 'references' ||
            (lastPart.kind === 'toolInvocation' && (lastPart.isComplete || lastPart.presentation === 'hidden')) ||
            ((lastPart.kind === 'textEditGroup' || lastPart.kind === 'notebookEditGroup') && lastPart.done && !partsToRender.some(part => part.kind === 'toolInvocation' && !part.isComplete)) ||
            (lastPart.kind === 'progressTask' && lastPart.deferred.isSettled) ||
            lastPart.kind === 'prepareToolInvocation') {
            return true;
        }
        return false;
    }
    getDataForProgressiveRender(element) {
        const renderData = element.renderData ?? { lastRenderTime: 0, renderedWordCount: 0 };
        const rate = this.getProgressiveRenderRate(element);
        const numWordsToRender = renderData.lastRenderTime === 0 ?
            1 :
            renderData.renderedWordCount +
                // Additional words to render beyond what's already rendered
                Math.floor((Date.now() - renderData.lastRenderTime) / 1000 * rate);
        return {
            numWordsToRender,
            rate
        };
    }
    diff(renderedParts, contentToRender, element) {
        const diff = [];
        for (let i = 0; i < contentToRender.length; i++) {
            const content = contentToRender[i];
            const renderedPart = renderedParts[i];
            if (!renderedPart || !renderedPart.hasSameContent(content, contentToRender.slice(i + 1), element)) {
                diff.push(content);
            }
            else {
                // null -> no change
                diff.push(null);
            }
        }
        return diff;
    }
    renderChatContentPart(content, templateData, context) {
        try {
            if (content.kind === 'treeData') {
                return this.renderTreeData(content, templateData, context);
            }
            else if (content.kind === 'progressMessage') {
                return this.instantiationService.createInstance(ChatProgressContentPart, content, this.renderer, context, undefined, undefined, undefined);
            }
            else if (content.kind === 'progressTask' || content.kind === 'progressTaskSerialized') {
                return this.renderProgressTask(content, templateData, context);
            }
            else if (content.kind === 'command') {
                return this.instantiationService.createInstance(ChatCommandButtonContentPart, content, context);
            }
            else if (content.kind === 'textEditGroup') {
                return this.renderTextEdit(context, content, templateData);
            }
            else if (content.kind === 'confirmation') {
                return this.renderConfirmation(context, content, templateData);
            }
            else if (content.kind === 'warning') {
                return this.instantiationService.createInstance(ChatErrorContentPart, ChatErrorLevel.Warning, content.content, content, this.renderer);
            }
            else if (content.kind === 'markdownContent') {
                return this.renderMarkdown(content, templateData, context);
            }
            else if (content.kind === 'references') {
                return this.renderContentReferencesListData(content, undefined, context, templateData);
            }
            else if (content.kind === 'codeCitations') {
                return this.renderCodeCitations(content, context, templateData);
            }
            else if (content.kind === 'toolInvocation' || content.kind === 'toolInvocationSerialized') {
                return this.renderToolInvocation(content, context, templateData);
            }
            else if (content.kind === 'extensions') {
                return this.renderExtensionsContent(content, context, templateData);
            }
            else if (content.kind === 'working') {
                return this.renderWorkingProgress(content, context);
            }
            else if (content.kind === 'undoStop') {
                return this.renderUndoStop(content);
            }
            else if (content.kind === 'errorDetails') {
                return this.renderChatErrorDetails(context, content, templateData);
            }
            return this.renderNoContent(other => content.kind === other.kind);
        }
        catch (err) {
            this.logService.error('ChatListItemRenderer#renderChatContentPart: error rendering content', toErrorMessage(err, true));
            const errorPart = this.instantiationService.createInstance(ChatErrorContentPart, ChatErrorLevel.Error, new MarkdownString(localize('renderFailMsg', "Failed to render content") + `: ${toErrorMessage(err, false)}`), content, this.renderer);
            return {
                dispose: () => errorPart.dispose(),
                domNode: errorPart.domNode,
                hasSameContent: (other => content.kind === other.kind),
            };
        }
    }
    renderChatErrorDetails(context, content, templateData) {
        if (!isResponseVM(context.element)) {
            return this.renderNoContent(other => content.kind === other.kind);
        }
        const isLast = context.elementIndex === this.delegate.getListLength() - 1;
        if (content.errorDetails.isQuotaExceeded) {
            const renderedError = this.instantiationService.createInstance(ChatQuotaExceededPart, context.element, content, this.renderer);
            renderedError.addDisposable(renderedError.onDidChangeHeight(() => this.updateItemHeight(templateData)));
            return renderedError;
        }
        else if (content.errorDetails.confirmationButtons && isLast) {
            const errorConfirmation = this.instantiationService.createInstance(ChatErrorConfirmationContentPart, ChatErrorLevel.Error, new MarkdownString(content.errorDetails.message), content, content.errorDetails.confirmationButtons, this.renderer, context);
            errorConfirmation.addDisposable(errorConfirmation.onDidChangeHeight(() => this.updateItemHeight(templateData)));
            return errorConfirmation;
        }
        else {
            const level = content.errorDetails.level ?? (content.errorDetails.responseIsFiltered ? ChatErrorLevel.Info : ChatErrorLevel.Error);
            return this.instantiationService.createInstance(ChatErrorContentPart, level, new MarkdownString(content.errorDetails.message), content, this.renderer);
        }
    }
    renderUndoStop(content) {
        return this.renderNoContent(other => other.kind === content.kind && other.id === content.id);
    }
    renderNoContent(equals) {
        return {
            dispose: () => { },
            domNode: undefined,
            hasSameContent: equals,
        };
    }
    renderTreeData(content, templateData, context) {
        const data = content.treeData;
        const treeDataIndex = context.preceedingContentParts.filter(part => part instanceof ChatTreeContentPart).length;
        const treePart = this.instantiationService.createInstance(ChatTreeContentPart, data, context.element, this._treePool, treeDataIndex);
        treePart.addDisposable(treePart.onDidChangeHeight(() => {
            this.updateItemHeight(templateData);
        }));
        if (isResponseVM(context.element)) {
            const fileTreeFocusInfo = {
                treeDataId: data.uri.toString(),
                treeIndex: treeDataIndex,
                focus() {
                    treePart.domFocus();
                }
            };
            // TODO@roblourens there's got to be a better way to navigate trees
            treePart.addDisposable(treePart.onDidFocus(() => {
                this.focusedFileTreesByResponseId.set(context.element.id, fileTreeFocusInfo.treeIndex);
            }));
            const fileTrees = this.fileTreesByResponseId.get(context.element.id) ?? [];
            fileTrees.push(fileTreeFocusInfo);
            this.fileTreesByResponseId.set(context.element.id, distinct(fileTrees, (v) => v.treeDataId));
            treePart.addDisposable(toDisposable(() => this.fileTreesByResponseId.set(context.element.id, fileTrees.filter(v => v.treeDataId !== data.uri.toString()))));
        }
        return treePart;
    }
    renderContentReferencesListData(references, labelOverride, context, templateData) {
        const referencesPart = this.instantiationService.createInstance(ChatUsedReferencesListContentPart, references.references, labelOverride, context, this._contentReferencesListPool, { expandedWhenEmptyResponse: checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.referencesExpandedWhenEmptyResponse) });
        referencesPart.addDisposable(referencesPart.onDidChangeHeight(() => {
            this.updateItemHeight(templateData);
        }));
        return referencesPart;
    }
    renderCodeCitations(citations, context, templateData) {
        const citationsPart = this.instantiationService.createInstance(ChatCodeCitationContentPart, citations, context);
        return citationsPart;
    }
    getCodeBlockStartIndex(context) {
        return context.preceedingContentParts.reduce((acc, part) => acc + (part.codeblocks?.length ?? 0), 0);
    }
    handleRenderedCodeblocks(element, part, codeBlockStartIndex) {
        if (!part.addDisposable || part.codeblocksPartId === undefined) {
            return;
        }
        const codeBlocksByResponseId = this.codeBlocksByResponseId.get(element.id) ?? [];
        this.codeBlocksByResponseId.set(element.id, codeBlocksByResponseId);
        part.addDisposable(toDisposable(() => {
            const codeBlocksByResponseId = this.codeBlocksByResponseId.get(element.id);
            if (codeBlocksByResponseId) {
                // Only delete if this is my code block
                part.codeblocks?.forEach((info, i) => {
                    const codeblock = codeBlocksByResponseId[codeBlockStartIndex + i];
                    if (codeblock?.ownerMarkdownPartId === part.codeblocksPartId) {
                        delete codeBlocksByResponseId[codeBlockStartIndex + i];
                    }
                });
            }
        }));
        part.codeblocks?.forEach((info, i) => {
            codeBlocksByResponseId[codeBlockStartIndex + i] = info;
            part.addDisposable(thenIfNotDisposed(info.uriPromise, uri => {
                if (!uri) {
                    return;
                }
                this.codeBlocksByEditorUri.set(uri, info);
                part.addDisposable(toDisposable(() => {
                    const codeblock = this.codeBlocksByEditorUri.get(uri);
                    if (codeblock?.ownerMarkdownPartId === part.codeblocksPartId) {
                        this.codeBlocksByEditorUri.delete(uri);
                    }
                }));
            }));
        });
    }
    renderToolInvocation(toolInvocation, context, templateData) {
        const codeBlockStartIndex = this.getCodeBlockStartIndex(context);
        const part = this.instantiationService.createInstance(ChatToolInvocationPart, toolInvocation, context, this.renderer, this._contentReferencesListPool, this._toolEditorPool, () => this._currentLayoutWidth, this._toolInvocationCodeBlockCollection, codeBlockStartIndex);
        part.addDisposable(part.onDidChangeHeight(() => {
            this.updateItemHeight(templateData);
        }));
        this.handleRenderedCodeblocks(context.element, part, codeBlockStartIndex);
        return part;
    }
    renderExtensionsContent(extensionsContent, context, templateData) {
        const part = this.instantiationService.createInstance(ChatExtensionsContentPart, extensionsContent);
        part.addDisposable(part.onDidChangeHeight(() => this.updateItemHeight(templateData)));
        return part;
    }
    renderProgressTask(task, templateData, context) {
        if (!isResponseVM(context.element)) {
            return;
        }
        const taskPart = this.instantiationService.createInstance(ChatTaskContentPart, task, this._contentReferencesListPool, this.renderer, context);
        taskPart.addDisposable(taskPart.onDidChangeHeight(() => {
            this.updateItemHeight(templateData);
        }));
        return taskPart;
    }
    renderWorkingProgress(workingProgress, context) {
        return this.instantiationService.createInstance(ChatWorkingProgressContentPart, workingProgress, this.renderer, context);
    }
    renderConfirmation(context, confirmation, templateData) {
        const part = this.instantiationService.createInstance(ChatConfirmationContentPart, confirmation, context);
        part.addDisposable(part.onDidChangeHeight(() => this.updateItemHeight(templateData)));
        return part;
    }
    renderAttachments(variables, contentReferences, templateData) {
        return this.instantiationService.createInstance(ChatAttachmentsContentPart, variables, contentReferences, undefined);
    }
    renderTextEdit(context, chatTextEdit, templateData) {
        const textEditPart = this.instantiationService.createInstance(ChatTextEditContentPart, chatTextEdit, context, this.rendererOptions, this._diffEditorPool, this._currentLayoutWidth);
        textEditPart.addDisposable(textEditPart.onDidChangeHeight(() => {
            textEditPart.layout(this._currentLayoutWidth);
            this.updateItemHeight(templateData);
        }));
        return textEditPart;
    }
    renderMarkdown(markdown, templateData, context) {
        const element = context.element;
        const fillInIncompleteTokens = isResponseVM(element) && (!element.isComplete || element.isCanceled || element.errorDetails?.responseIsFiltered || element.errorDetails?.responseIsIncomplete || !!element.renderData);
        const codeBlockStartIndex = this.getCodeBlockStartIndex(context);
        const markdownPart = templateData.instantiationService.createInstance(ChatMarkdownContentPart, markdown, context, this._editorPool, fillInIncompleteTokens, codeBlockStartIndex, this.renderer, this._currentLayoutWidth, this.codeBlockModelCollection, {});
        if (isRequestVM(element)) {
            markdownPart.domNode.tabIndex = 0;
            markdownPart.addDisposable(dom.addDisposableListener(markdownPart.domNode, 'focus', () => {
                dom.show(templateData.requestHover);
            }));
            markdownPart.addDisposable(dom.addDisposableListener(markdownPart.domNode, 'blur', () => {
                dom.hide(templateData.requestHover);
            }));
        }
        markdownPart.addDisposable(markdownPart.onDidChangeHeight(() => {
            markdownPart.layout(this._currentLayoutWidth);
            this.updateItemHeight(templateData);
        }));
        this.handleRenderedCodeblocks(element, markdownPart, codeBlockStartIndex);
        return markdownPart;
    }
    disposeElement(node, index, templateData) {
        this.traceLayout('disposeElement', `Disposing element, index=${index}`);
        templateData.elementDisposables.clear();
        // Don't retain the toolbar context which includes chat viewmodels
        if (templateData.titleToolbar) {
            templateData.titleToolbar.context = undefined;
        }
        templateData.footerToolbar.context = undefined;
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
};
ChatListItemRenderer = ChatListItemRenderer_1 = __decorate([
    __param(5, IInstantiationService),
    __param(6, IConfigurationService),
    __param(7, ILogService),
    __param(8, IContextKeyService),
    __param(9, IThemeService),
    __param(10, ICommandService),
    __param(11, IHoverService),
    __param(12, IChatWidgetService)
], ChatListItemRenderer);
export { ChatListItemRenderer };
let ChatListDelegate = class ChatListDelegate {
    constructor(defaultElementHeight, logService) {
        this.defaultElementHeight = defaultElementHeight;
        this.logService = logService;
    }
    _traceLayout(method, message) {
        if (forceVerboseLayoutTracing) {
            this.logService.info(`ChatListDelegate#${method}: ${message}`);
        }
        else {
            this.logService.trace(`ChatListDelegate#${method}: ${message}`);
        }
    }
    getHeight(element) {
        const kind = isRequestVM(element) ? 'request' : 'response';
        const height = ('currentRenderedHeight' in element ? element.currentRenderedHeight : undefined) ?? this.defaultElementHeight;
        this._traceLayout('getHeight', `${kind}, height=${height}`);
        return height;
    }
    getTemplateId(element) {
        return ChatListItemRenderer.ID;
    }
    hasDynamicHeight(element) {
        return true;
    }
};
ChatListDelegate = __decorate([
    __param(1, ILogService)
], ChatListDelegate);
export { ChatListDelegate };
const voteDownDetailLabels = {
    [ChatAgentVoteDownReason.IncorrectCode]: localize('incorrectCode', "Suggested incorrect code"),
    [ChatAgentVoteDownReason.DidNotFollowInstructions]: localize('didNotFollowInstructions', "Didn't follow instructions"),
    [ChatAgentVoteDownReason.MissingContext]: localize('missingContext', "Missing context"),
    [ChatAgentVoteDownReason.OffensiveOrUnsafe]: localize('offensiveOrUnsafe', "Offensive or unsafe"),
    [ChatAgentVoteDownReason.PoorlyWrittenOrFormatted]: localize('poorlyWrittenOrFormatted', "Poorly written or formatted"),
    [ChatAgentVoteDownReason.RefusedAValidRequest]: localize('refusedAValidRequest', "Refused a valid request"),
    [ChatAgentVoteDownReason.IncompleteCode]: localize('incompleteCode', "Incomplete code"),
    [ChatAgentVoteDownReason.WillReportIssue]: localize('reportIssue', "Report an issue"),
    [ChatAgentVoteDownReason.Other]: localize('other', "Other"),
};
let ChatVoteDownButton = class ChatVoteDownButton extends DropdownMenuActionViewItem {
    constructor(action, options, commandService, issueService, logService, contextMenuService) {
        super(action, { getActions: () => this.getActions(), }, contextMenuService, {
            ...options,
            classNames: ThemeIcon.asClassNameArray(Codicon.thumbsdown),
        });
        this.commandService = commandService;
        this.issueService = issueService;
        this.logService = logService;
    }
    getActions() {
        return [
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.IncorrectCode),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.DidNotFollowInstructions),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.IncompleteCode),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.MissingContext),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.PoorlyWrittenOrFormatted),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.RefusedAValidRequest),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.OffensiveOrUnsafe),
            this.getVoteDownDetailAction(ChatAgentVoteDownReason.Other),
            {
                id: 'reportIssue',
                label: voteDownDetailLabels[ChatAgentVoteDownReason.WillReportIssue],
                tooltip: '',
                enabled: true,
                class: undefined,
                run: async (context) => {
                    if (!isResponseVM(context)) {
                        this.logService.error('ChatVoteDownButton#run: invalid context');
                        return;
                    }
                    await this.commandService.executeCommand(MarkUnhelpfulActionId, context, ChatAgentVoteDownReason.WillReportIssue);
                    await this.issueService.openReporter({ extensionId: context.agent?.extensionId.value });
                }
            }
        ];
    }
    render(container) {
        super.render(container);
        this.element?.classList.toggle('checked', this.action.checked);
    }
    getVoteDownDetailAction(reason) {
        const label = voteDownDetailLabels[reason];
        return {
            id: MarkUnhelpfulActionId,
            label,
            tooltip: '',
            enabled: true,
            checked: this._context.voteDownReason === reason,
            class: undefined,
            run: async (context) => {
                if (!isResponseVM(context)) {
                    this.logService.error('ChatVoteDownButton#getVoteDownDetailAction: invalid context');
                    return;
                }
                await this.commandService.executeCommand(MarkUnhelpfulActionId, context, reason);
            }
        };
    }
};
ChatVoteDownButton = __decorate([
    __param(2, ICommandService),
    __param(3, IWorkbenchIssueService),
    __param(4, ILogService),
    __param(5, IContextMenuService)
], ChatVoteDownButton);
export { ChatVoteDownButton };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdExpc3RSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRMaXN0UmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDeEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFbEYsT0FBTyxFQUFFLDBCQUEwQixFQUFzQyxNQUFNLGdFQUFnRSxDQUFDO0FBQ2hKLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBSXBHLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzFJLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sb0NBQW9D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