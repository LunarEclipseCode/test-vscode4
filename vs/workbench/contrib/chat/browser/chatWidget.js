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
var ChatWidget_1;
import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { assert } from '../../../../base/common/assert.js';
import { disposableTimeout, timeout } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../base/common/map.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun, observableFromEvent, observableValue } from '../../../../base/common/observable.js';
import { basename, extUri, isEqual } from '../../../../base/common/resources.js';
import { isDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { localize } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { bindContextKey } from '../../../../platform/observable/common/platformObservableUtils.js';
import { PromptsType } from '../common/promptSyntax/promptTypes.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { buttonSecondaryBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { checkModeOption } from '../common/chat.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { applyingChatEditsFailedContextKey, decidedChatEditingResourceContextKey, hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey, IChatEditingService, inChatEditingSessionContextKey } from '../common/chatEditingService.js';
import { IChatRequestVariableEntry } from '../common/chatModel.js';
import { chatAgentLeader, ChatRequestAgentPart, ChatRequestDynamicVariablePart, ChatRequestSlashPromptPart, ChatRequestToolPart, ChatRequestToolSetPart, chatSubcommandLeader, formatChatQuestion } from '../common/chatParserTypes.js';
import { ChatRequestParser } from '../common/chatRequestParser.js';
import { IChatService } from '../common/chatService.js';
import { IChatSlashCommandService } from '../common/chatSlashCommands.js';
import { ChatViewModel, isRequestVM, isResponseVM } from '../common/chatViewModel.js';
import { CodeBlockModelCollection } from '../common/codeBlockModelCollection.js';
import { ChatMode } from '../common/constants.js';
import { ILanguageModelToolsService, ToolSet } from '../common/languageModelToolsService.js';
import { IPromptsService } from '../common/promptSyntax/service/promptsService.js';
import { handleModeSwitch } from './actions/chatActions.js';
import { IChatAccessibilityService, IChatWidgetService } from './chat.js';
import { ChatAccessibilityProvider } from './chatAccessibilityProvider.js';
import { addPromptFileChatVariable, isPromptFileChatVariable } from './chatAttachmentModel/chatPromptAttachmentsCollection.js';
import { ChatInputPart } from './chatInputPart.js';
import { ChatListDelegate, ChatListItemRenderer } from './chatListRenderer.js';
import { ChatEditorOptions } from './chatOptions.js';
import './media/chat.css';
import './media/chatAgentHover.css';
import './media/chatViewWelcome.css';
import { ChatViewWelcomePart } from './viewsWelcome/chatViewWelcomeController.js';
import { MicrotaskDelay } from '../../../../base/common/symbols.js';
const $ = dom.$;
export function isQuickChat(widget) {
    return 'viewContext' in widget && 'isQuickChat' in widget.viewContext && Boolean(widget.viewContext.isQuickChat);
}
let ChatWidget = class ChatWidget extends Disposable {
    static { ChatWidget_1 = this; }
    static { this.CONTRIBS = []; }
    get domNode() {
        return this.container;
    }
    get visible() {
        return this._visible;
    }
    set viewModel(viewModel) {
        if (this._viewModel === viewModel) {
            return;
        }
        this.viewModelDisposables.clear();
        this._viewModel = viewModel;
        if (viewModel) {
            this.viewModelDisposables.add(viewModel);
            this.logService.debug('ChatWidget#setViewModel: have viewModel');
            if (viewModel.model.editingSessionObs) {
                this.logService.debug('ChatWidget#setViewModel: waiting for editing session');
                viewModel.model.editingSessionObs?.promise.then(() => {
                    this._isReady = true;
                    this._onDidBecomeReady.fire();
                });
            }
            else {
                this._isReady = true;
                this._onDidBecomeReady.fire();
            }
        }
        else {
            this.logService.debug('ChatWidget#setViewModel: no viewModel');
        }
        this._onDidChangeViewModel.fire();
    }
    get viewModel() {
        return this._viewModel;
    }
    get parsedInput() {
        if (this.parsedChatRequest === undefined) {
            if (!this.viewModel) {
                return { text: '', parts: [] };
            }
            this.parsedChatRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(this.viewModel.sessionId, this.getInput(), this.location, { selectedAgent: this._lastSelectedAgent, mode: this.input.currentMode });
            this._onDidChangeParsedInput.fire();
        }
        return this.parsedChatRequest;
    }
    get scopedContextKeyService() {
        return this.contextKeyService;
    }
    get location() {
        return this._location.location;
    }
    get supportsChangingModes() {
        return !!this.viewOptions.supportsChangingModes;
    }
    constructor(location, _viewContext, viewOptions, styles, codeEditorService, configurationService, contextKeyService, instantiationService, chatService, chatAgentService, chatWidgetService, contextMenuService, chatAccessibilityService, logService, themeService, chatSlashCommandService, chatEditingService, telemetryService, promptsService, toolsService) {
        super();
        this.viewOptions = viewOptions;
        this.styles = styles;
        this.configurationService = configurationService;
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        this.chatService = chatService;
        this.chatAgentService = chatAgentService;
        this.chatWidgetService = chatWidgetService;
        this.contextMenuService = contextMenuService;
        this.chatAccessibilityService = chatAccessibilityService;
        this.logService = logService;
        this.themeService = themeService;
        this.chatSlashCommandService = chatSlashCommandService;
        this.telemetryService = telemetryService;
        this.promptsService = promptsService;
        this.toolsService = toolsService;
        this._onDidSubmitAgent = this._register(new Emitter());
        this.onDidSubmitAgent = this._onDidSubmitAgent.event;
        this._onDidChangeAgent = this._register(new Emitter());
        this.onDidChangeAgent = this._onDidChangeAgent.event;
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidChangeViewModel = this._register(new Emitter());
        this.onDidChangeViewModel = this._onDidChangeViewModel.event;
        this._onDidScroll = this._register(new Emitter());
        this.onDidScroll = this._onDidScroll.event;
        this._onDidClear = this._register(new Emitter());
        this.onDidClear = this._onDidClear.event;
        this._onDidAcceptInput = this._register(new Emitter());
        this.onDidAcceptInput = this._onDidAcceptInput.event;
        this._onDidHide = this._register(new Emitter());
        this.onDidHide = this._onDidHide.event;
        this._onDidChangeParsedInput = this._register(new Emitter());
        this.onDidChangeParsedInput = this._onDidChangeParsedInput.event;
        this._onWillMaybeChangeHeight = new Emitter();
        this.onWillMaybeChangeHeight = this._onWillMaybeChangeHeight.event;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._onDidChangeContentHeight = new Emitter();
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this.contribs = [];
        this.welcomePart = this._register(new MutableDisposable());
        this.visibleChangeCount = 0;
        this._visible = false;
        this.previousTreeScrollHeight = 0;
        /**
         * Whether the list is scroll-locked to the bottom. Initialize to true so that we can scroll to the bottom on first render.
         * The initial render leads to a lot of `onDidChangeTreeContentHeight` as the renderer works out the real heights of rows.
         */
        this.scrollLock = true;
        this._isReady = false;
        this._onDidBecomeReady = this._register(new Emitter());
        this.viewModelDisposables = this._register(new DisposableStore());
        this._editingSession = observableValue(this, undefined);
        this.viewContext = _viewContext ?? {};
        const viewModelObs = observableFromEvent(this, this.onDidChangeViewModel, () => this.viewModel);
        if (typeof location === 'object') {
            this._location = location;
        }
        else {
            this._location = { location };
        }
        ChatContextKeys.inChatSession.bindTo(contextKeyService).set(true);
        ChatContextKeys.location.bindTo(contextKeyService).set(this._location.location);
        ChatContextKeys.inQuickChat.bindTo(contextKeyService).set(isQuickChat(this));
        this.agentInInput = ChatContextKeys.inputHasAgent.bindTo(contextKeyService);
        this.requestInProgress = ChatContextKeys.requestInProgress.bindTo(contextKeyService);
        this.isRequestPaused = ChatContextKeys.isRequestPaused.bindTo(contextKeyService);
        this.canRequestBePaused = ChatContextKeys.canRequestBePaused.bindTo(contextKeyService);
        this._register(bindContextKey(decidedChatEditingResourceContextKey, contextKeyService, (reader) => {
            const currentSession = this._editingSession.read(reader);
            if (!currentSession) {
                return;
            }
            const entries = currentSession.entries.read(reader);
            const decidedEntries = entries.filter(entry => entry.state.read(reader) !== 0 /* ModifiedFileEntryState.Modified */);
            return decidedEntries.map(entry => entry.entryId);
        }));
        this._register(bindContextKey(hasUndecidedChatEditingResourceContextKey, contextKeyService, (reader) => {
            const currentSession = this._editingSession.read(reader);
            const entries = currentSession?.entries.read(reader) ?? []; // using currentSession here
            const decidedEntries = entries.filter(entry => entry.state.read(reader) === 0 /* ModifiedFileEntryState.Modified */);
            return decidedEntries.length > 0;
        }));
        this._register(bindContextKey(hasAppliedChatEditsContextKey, contextKeyService, (reader) => {
            const currentSession = this._editingSession.read(reader);
            if (!currentSession) {
                return false;
            }
            const entries = currentSession.entries.read(reader);
            return entries.length > 0;
        }));
        this._register(bindContextKey(inChatEditingSessionContextKey, contextKeyService, (reader) => {
            return this._editingSession.read(reader) !== null;
        }));
        this._register(bindContextKey(ChatContextKeys.chatEditingCanUndo, contextKeyService, (r) => {
            return this._editingSession.read(r)?.canUndo.read(r) || false;
        }));
        this._register(bindContextKey(ChatContextKeys.chatEditingCanRedo, contextKeyService, (r) => {
            return this._editingSession.read(r)?.canRedo.read(r) || false;
        }));
        this._register(bindContextKey(applyingChatEditsFailedContextKey, contextKeyService, (r) => {
            const chatModel = viewModelObs.read(r)?.model;
            const editingSession = this._editingSession.read(r);
            if (!editingSession || !chatModel) {
                return false;
            }
            const lastResponse = observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().at(-1)?.response).read(r);
            return lastResponse?.result?.errorDetails && !lastResponse?.result?.errorDetails.responseIsIncomplete;
        }));
        this._codeBlockModelCollection = this._register(instantiationService.createInstance(CodeBlockModelCollection, undefined));
        this._register(this.configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('chat.renderRelatedFiles')) {
                this.renderChatEditingSessionState();
            }
        }));
        this._register(autorun(r => {
            const viewModel = viewModelObs.read(r);
            const sessions = chatEditingService.editingSessionsObs.read(r);
            const session = sessions.find(candidate => candidate.chatSessionId === viewModel?.sessionId);
            this._editingSession.set(undefined, undefined);
            this.renderChatEditingSessionState(); // this is necessary to make sure we dispose previous buttons, etc.
            if (!session) {
                // none or for a different chat widget
                return;
            }
            const entries = session.entries.read(r);
            for (const entry of entries) {
                entry.state.read(r); // SIGNAL
            }
            this._editingSession.set(session, undefined);
            r.store.add(session.onDidDispose(() => {
                this._editingSession.set(undefined, undefined);
                this.renderChatEditingSessionState();
            }));
            r.store.add(this.onDidChangeParsedInput(() => {
                this.renderChatEditingSessionState();
            }));
            r.store.add(this.inputEditor.onDidChangeModelContent(() => {
                if (this.getInput() === '') {
                    this.refreshParsedInput();
                    this.renderChatEditingSessionState();
                }
            }));
            this.renderChatEditingSessionState();
        }));
        this._register(codeEditorService.registerCodeEditorOpenHandler(async (input, _source, _sideBySide) => {
            const resource = input.resource;
            if (resource.scheme !== Schemas.vscodeChatCodeBlock) {
                return null;
            }
            const responseId = resource.path.split('/').at(1);
            if (!responseId) {
                return null;
            }
            const item = this.viewModel?.getItems().find(item => item.id === responseId);
            if (!item) {
                return null;
            }
            // TODO: needs to reveal the chat view
            this.reveal(item);
            await timeout(0); // wait for list to actually render
            for (const codeBlockPart of this.renderer.editorsInUse()) {
                if (extUri.isEqual(codeBlockPart.uri, resource, true)) {
                    const editor = codeBlockPart.editor;
                    let relativeTop = 0;
                    const editorDomNode = editor.getDomNode();
                    if (editorDomNode) {
                        const row = dom.findParentWithClass(editorDomNode, 'monaco-list-row');
                        if (row) {
                            relativeTop = dom.getTopLeftOffset(editorDomNode).top - dom.getTopLeftOffset(row).top;
                        }
                    }
                    if (input.options?.selection) {
                        const editorSelectionTopOffset = editor.getTopForPosition(input.options.selection.startLineNumber, input.options.selection.startColumn);
                        relativeTop += editorSelectionTopOffset;
                        editor.focus();
                        editor.setSelection({
                            startLineNumber: input.options.selection.startLineNumber,
                            startColumn: input.options.selection.startColumn,
                            endLineNumber: input.options.selection.endLineNumber ?? input.options.selection.startLineNumber,
                            endColumn: input.options.selection.endColumn ?? input.options.selection.startColumn
                        });
                    }
                    this.reveal(item, relativeTop);
                    return editor;
                }
            }
            return null;
        }));
        this._register(this.onDidChangeParsedInput(() => this.updateChatInputContext()));
    }
    set lastSelectedAgent(agent) {
        this.parsedChatRequest = undefined;
        this._lastSelectedAgent = agent;
        this._onDidChangeParsedInput.fire();
    }
    get lastSelectedAgent() {
        return this._lastSelectedAgent;
    }
    get supportsFileReferences() {
        return !!this.viewOptions.supportsFileReferences;
    }
    get input() {
        return this.inputPart;
    }
    get inputEditor() {
        return this.inputPart.inputEditor;
    }
    get inputUri() {
        return this.inputPart.inputUri;
    }
    get contentHeight() {
        return this.inputPart.contentHeight + this.tree.contentHeight;
    }
    get attachmentModel() {
        return this.inputPart.attachmentModel;
    }
    async waitForReady() {
        if (this._isReady) {
            this.logService.debug('ChatWidget#waitForReady: already ready');
            return;
        }
        this.logService.debug('ChatWidget#waitForReady: waiting for ready');
        await Event.toPromise(this._onDidBecomeReady.event);
        if (this.viewModel) {
            this.logService.debug('ChatWidget#waitForReady: ready');
        }
        else {
            this.logService.debug('ChatWidget#waitForReady: no viewModel');
        }
    }
    render(parent) {
        const viewId = 'viewId' in this.viewContext ? this.viewContext.viewId : undefined;
        this.editorOptions = this._register(this.instantiationService.createInstance(ChatEditorOptions, viewId, this.styles.listForeground, this.styles.inputEditorBackground, this.styles.resultEditorBackground));
        const renderInputOnTop = this.viewOptions.renderInputOnTop ?? false;
        const renderFollowups = this.viewOptions.renderFollowups ?? !renderInputOnTop;
        const renderStyle = this.viewOptions.renderStyle;
        this.container = dom.append(parent, $('.interactive-session'));
        this.welcomeMessageContainer = dom.append(this.container, $('.chat-welcome-view-container', { style: 'display: none' }));
        this._register(dom.addStandardDisposableListener(this.welcomeMessageContainer, dom.EventType.CLICK, () => this.focusInput()));
        if (renderInputOnTop) {
            this.createInput(this.container, { renderFollowups, renderStyle });
            this.listContainer = dom.append(this.container, $(`.interactive-list`));
        }
        else {
            this.listContainer = dom.append(this.container, $(`.interactive-list`));
            this.createInput(this.container, { renderFollowups, renderStyle });
        }
        this.renderWelcomeViewContentIfNeeded();
        this.createList(this.listContainer, { ...this.viewOptions.rendererOptions, renderStyle });
        const scrollDownButton = this._register(new Button(this.listContainer, {
            supportIcons: true,
            buttonBackground: asCssVariable(buttonSecondaryBackground),
            buttonForeground: asCssVariable(buttonSecondaryForeground),
            buttonHoverBackground: asCssVariable(buttonSecondaryHoverBackground),
        }));
        scrollDownButton.element.classList.add('chat-scroll-down');
        scrollDownButton.label = `$(${Codicon.chevronDown.id})`;
        scrollDownButton.setTitle(localize('scrollDownButtonLabel', "Scroll down"));
        this._register(scrollDownButton.onDidClick(() => {
            this.scrollLock = true;
            this.scrollToEnd();
        }));
        this._register(this.editorOptions.onDidChange(() => this.onDidStyleChange()));
        this.onDidStyleChange();
        // Do initial render
        if (this.viewModel) {
            this.onDidChangeItems();
            this.scrollToEnd();
        }
        this.contribs = ChatWidget_1.CONTRIBS.map(contrib => {
            try {
                return this._register(this.instantiationService.createInstance(contrib, this));
            }
            catch (err) {
                this.logService.error('Failed to instantiate chat widget contrib', toErrorMessage(err));
                return undefined;
            }
        }).filter(isDefined);
        this._register(this.chatWidgetService.register(this));
        const parsedInput = observableFromEvent(this.onDidChangeParsedInput, () => this.parsedInput);
        this._register(autorun(r => {
            const input = parsedInput.read(r);
            const newPromptAttachments = new Map();
            const oldPromptAttachments = new Set();
            // get all attachments, know those that are prompt-referenced
            for (const attachment of this.attachmentModel.attachments) {
                if (attachment.range) {
                    oldPromptAttachments.add(attachment.id);
                }
            }
            // update/insert prompt-referenced attachments
            for (const part of input.parts) {
                if (part instanceof ChatRequestToolPart || part instanceof ChatRequestToolSetPart || part instanceof ChatRequestDynamicVariablePart) {
                    const entry = part.toVariableEntry();
                    newPromptAttachments.set(entry.id, entry);
                    oldPromptAttachments.delete(entry.id);
                }
            }
            this.attachmentModel.updateContext(oldPromptAttachments, newPromptAttachments.values());
        }));
    }
    scrollToEnd() {
        if (this.lastItem) {
            const offset = Math.max(this.lastItem.currentRenderedHeight ?? 0, 1e6);
            this.tree.reveal(this.lastItem, offset);
        }
    }
    getContrib(id) {
        return this.contribs.find(c => c.id === id);
    }
    focusInput() {
        this.inputPart.focus();
        // Sometimes focusing the input part is not possible,
        // but we'd like to be the last focused chat widget,
        // so we emit an optimistic onDidFocus event nonetheless.
        this._onDidFocus.fire();
    }
    hasInputFocus() {
        return this.inputPart.hasFocus();
    }
    refreshParsedInput() {
        if (!this.viewModel) {
            return;
        }
        this.parsedChatRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(this.viewModel.sessionId, this.getInput(), this.location, { selectedAgent: this._lastSelectedAgent, mode: this.input.currentMode });
        this._onDidChangeParsedInput.fire();
    }
    getSibling(item, type) {
        if (!isResponseVM(item)) {
            return;
        }
        const items = this.viewModel?.getItems();
        if (!items) {
            return;
        }
        const responseItems = items.filter(i => isResponseVM(i));
        const targetIndex = responseItems.indexOf(item);
        if (targetIndex === undefined) {
            return;
        }
        const indexToFocus = type === 'next' ? targetIndex + 1 : targetIndex - 1;
        if (indexToFocus < 0 || indexToFocus > responseItems.length - 1) {
            return;
        }
        return responseItems[indexToFocus];
    }
    clear() {
        this.logService.debug('ChatWidget#clear');
        this._isReady = false;
        if (this._dynamicMessageLayoutData) {
            this._dynamicMessageLayoutData.enabled = true;
        }
        this._onDidClear.fire();
    }
    onDidChangeItems(skipDynamicLayout) {
        if (this._visible || !this.viewModel) {
            const treeItems = (this.viewModel?.getItems() ?? [])
                .map((item) => {
                return {
                    element: item,
                    collapsed: false,
                    collapsible: false
                };
            });
            this.renderWelcomeViewContentIfNeeded();
            this._onWillMaybeChangeHeight.fire();
            this.lastItem = treeItems.at(-1)?.element;
            ChatContextKeys.lastItemId.bindTo(this.contextKeyService).set(this.lastItem ? [this.lastItem.id] : []);
            this.tree.setChildren(null, treeItems, {
                diffIdentityProvider: {
                    getId: (element) => {
                        return element.dataId +
                            // Ensure re-rendering an element once slash commands are loaded, so the colorization can be applied.
                            `${(isRequestVM(element)) /* && !!this.lastSlashCommands ? '_scLoaded' : '' */}` +
                            // If a response is in the process of progressive rendering, we need to ensure that it will
                            // be re-rendered so progressive rendering is restarted, even if the model wasn't updated.
                            `${isResponseVM(element) && element.renderData ? `_${this.visibleChangeCount}` : ''}` +
                            // Re-render once content references are loaded
                            (isResponseVM(element) ? `_${element.contentReferences.length}` : '') +
                            // Re-render if element becomes hidden due to undo/redo
                            `_${element.shouldBeRemovedOnSend ? `${element.shouldBeRemovedOnSend.afterUndoStop || '1'}` : '0'}` +
                            // Rerender request if we got new content references in the response
                            // since this may change how we render the corresponding attachments in the request
                            (isRequestVM(element) && element.contentReferences ? `_${element.contentReferences?.length}` : '') +
                            (isResponseVM(element) && element.model.isPaused.get() ? '_paused' : '');
                    },
                }
            });
            if (!skipDynamicLayout && this._dynamicMessageLayoutData) {
                this.layoutDynamicChatTreeItemMode();
            }
            this.renderFollowups();
        }
    }
    renderWelcomeViewContentIfNeeded() {
        if (this.viewOptions.renderStyle === 'compact' || this.viewOptions.renderStyle === 'minimal') {
            return;
        }
        const numItems = this.viewModel?.getItems().length ?? 0;
        if (!numItems) {
            const welcomeContent = this.getWelcomeViewContent();
            dom.clearNode(this.welcomeMessageContainer);
            const tips = this.input.currentMode === ChatMode.Ask
                ? new MarkdownString(localize('chatWidget.tips', "{0} or type {1} to attach context\n\n{2} to chat with extensions\n\nType {3} to use commands", '$(attach)', '#', '$(mention)', '/'), { supportThemeIcons: true })
                : new MarkdownString(localize('chatWidget.tips.withoutParticipants', "{0} or type {1} to attach context", '$(attach)', '#'), { supportThemeIcons: true });
            const defaultAgent = this.chatAgentService.getDefaultAgent(this.location, this.input.currentMode);
            const additionalMessage = defaultAgent?.metadata.additionalWelcomeMessage;
            this.welcomePart.value = this.instantiationService.createInstance(ChatViewWelcomePart, { ...welcomeContent, tips, additionalMessage }, {
                location: this.location,
                isWidgetAgentWelcomeViewContent: this.input?.currentMode === ChatMode.Agent
            });
            dom.append(this.welcomeMessageContainer, this.welcomePart.value.element);
        }
        if (this.viewModel) {
            dom.setVisibility(numItems === 0, this.welcomeMessageContainer);
            dom.setVisibility(numItems !== 0, this.listContainer);
        }
    }
    getWelcomeViewContent() {
        const baseMessage = localize('chatMessage', "Copilot is powered by AI, so mistakes are possible. Review output carefully before use.");
        if (this.input.currentMode === ChatMode.Ask) {
            return {
                title: localize('chatDescription', "Ask Copilot"),
                message: new MarkdownString(baseMessage),
                icon: Codicon.copilotLarge
            };
        }
        else if (this.input.currentMode === ChatMode.Edit) {
            return {
                title: localize('editsTitle', "Edit with Copilot"),
                message: new MarkdownString(localize('editsMessage', "Start your editing session by defining a set of files that you want to work with. Then ask Copilot for the changes you want to make.") + `\n\n${baseMessage}`),
                icon: Codicon.copilotLarge
            };
        }
        else {
            return {
                title: localize('editsTitle', "Edit with Copilot"),
                message: new MarkdownString(localize('agentMessage', "Ask Copilot to edit your files in [agent mode]({0}). Copilot will automatically use multiple requests to pick files to edit, run terminal commands, and iterate on errors.", 'https://aka.ms/vscode-copilot-agent') + `\n\n${baseMessage}`),
                icon: Codicon.copilotLarge
            };
        }
    }
    async renderChatEditingSessionState() {
        if (!this.inputPart) {
            return;
        }
        this.inputPart.renderChatEditingSessionState(this._editingSession.get() ?? null);
        if (this.bodyDimension) {
            this.layout(this.bodyDimension.height, this.bodyDimension.width);
        }
    }
    async renderFollowups() {
        if (this.lastItem && isResponseVM(this.lastItem) && this.lastItem.isComplete && this.inputPart.currentMode === ChatMode.Ask) {
            this.inputPart.renderFollowups(this.lastItem.replyFollowups, this.lastItem);
        }
        else {
            this.inputPart.renderFollowups(undefined, undefined);
        }
        if (this.bodyDimension) {
            this.layout(this.bodyDimension.height, this.bodyDimension.width);
        }
    }
    setVisible(visible) {
        const wasVisible = this._visible;
        this._visible = visible;
        this.visibleChangeCount++;
        this.renderer.setVisible(visible);
        this.input.setVisible(visible);
        if (visible) {
            this._register(disposableTimeout(() => {
                // Progressive rendering paused while hidden, so start it up again.
                // Do it after a timeout because the container is not visible yet (it should be but offsetHeight returns 0 here)
                if (this._visible) {
                    this.onDidChangeItems(true);
                }
            }, 0));
        }
        else if (wasVisible) {
            this._onDidHide.fire();
        }
    }
    createList(listContainer, options) {
        const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.contextKeyService])));
        const delegate = scopedInstantiationService.createInstance(ChatListDelegate, this.viewOptions.defaultElementHeight ?? 200);
        const rendererDelegate = {
            getListLength: () => this.tree.getNode(null).visibleChildrenCount,
            onDidScroll: this.onDidScroll,
            container: listContainer,
            currentChatMode: () => this.input.currentMode,
        };
        // Create a dom element to hold UI from editor widgets embedded in chat messages
        const overflowWidgetsContainer = document.createElement('div');
        overflowWidgetsContainer.classList.add('chat-overflow-widget-container', 'monaco-editor');
        listContainer.append(overflowWidgetsContainer);
        this.renderer = this._register(scopedInstantiationService.createInstance(ChatListItemRenderer, this.editorOptions, options, rendererDelegate, this._codeBlockModelCollection, overflowWidgetsContainer));
        this._register(this.renderer.onDidClickFollowup(item => {
            // is this used anymore?
            this.acceptInput(item.message);
        }));
        this._register(this.renderer.onDidClickRerunWithAgentOrCommandDetection(item => {
            const request = this.chatService.getSession(item.sessionId)?.getRequests().find(candidate => candidate.id === item.requestId);
            if (request) {
                const options = {
                    noCommandDetection: true,
                    attempt: request.attempt + 1,
                    location: this.location,
                    userSelectedModelId: this.input.currentLanguageModel,
                    mode: this.input.currentMode,
                };
                this.chatService.resendRequest(request, options).catch(e => this.logService.error('FAILED to rerun request', e));
            }
        }));
        this.tree = this._register(scopedInstantiationService.createInstance((WorkbenchObjectTree), 'Chat', listContainer, delegate, [this.renderer], {
            identityProvider: { getId: (e) => e.id },
            horizontalScrolling: false,
            alwaysConsumeMouseWheel: false,
            supportDynamicHeights: true,
            hideTwistiesOfChildlessElements: true,
            accessibilityProvider: this.instantiationService.createInstance(ChatAccessibilityProvider),
            keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => isRequestVM(e) ? e.message : isResponseVM(e) ? e.response.value : '' }, // TODO
            setRowLineHeight: false,
            filter: this.viewOptions.filter ? { filter: this.viewOptions.filter.bind(this.viewOptions), } : undefined,
            scrollToActiveElement: true,
            overrideStyles: {
                listFocusBackground: this.styles.listBackground,
                listInactiveFocusBackground: this.styles.listBackground,
                listActiveSelectionBackground: this.styles.listBackground,
                listFocusAndSelectionBackground: this.styles.listBackground,
                listInactiveSelectionBackground: this.styles.listBackground,
                listHoverBackground: this.styles.listBackground,
                listBackground: this.styles.listBackground,
                listFocusForeground: this.styles.listForeground,
                listHoverForeground: this.styles.listForeground,
                listInactiveFocusForeground: this.styles.listForeground,
                listInactiveSelectionForeground: this.styles.listForeground,
                listActiveSelectionForeground: this.styles.listForeground,
                listFocusAndSelectionForeground: this.styles.listForeground,
                listActiveSelectionIconForeground: undefined,
                listInactiveSelectionIconForeground: undefined,
            }
        }));
        this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
        this._register(this.tree.onDidChangeContentHeight(() => {
            this.onDidChangeTreeContentHeight();
        }));
        this._register(this.renderer.onDidChangeItemHeight(e => {
            if (this.tree.hasElement(e.element)) {
                this.tree.updateElementHeight(e.element, e.height);
            }
        }));
        this._register(this.tree.onDidFocus(() => {
            this._onDidFocus.fire();
        }));
        this._register(this.tree.onDidScroll(() => {
            this._onDidScroll.fire();
            const isScrolledDown = this.tree.scrollTop >= this.tree.scrollHeight - this.tree.renderHeight - 2;
            this.container.classList.toggle('show-scroll-down', !isScrolledDown && !this.scrollLock);
        }));
    }
    onContextMenu(e) {
        e.browserEvent.preventDefault();
        e.browserEvent.stopPropagation();
        const selected = e.element;
        const scopedContextKeyService = this.contextKeyService.createOverlay([
            [ChatContextKeys.responseIsFiltered.key, isResponseVM(selected) && !!selected.errorDetails?.responseIsFiltered]
        ]);
        this.contextMenuService.showContextMenu({
            menuId: MenuId.ChatContext,
            menuActionOptions: { shouldForwardArgs: true },
            contextKeyService: scopedContextKeyService,
            getAnchor: () => e.anchor,
            getActionsContext: () => selected,
        });
    }
    onDidChangeTreeContentHeight() {
        // If the list was previously scrolled all the way down, ensure it stays scrolled down, if scroll lock is on
        if (this.tree.scrollHeight !== this.previousTreeScrollHeight) {
            const lastItem = this.viewModel?.getItems().at(-1);
            const lastResponseIsRendering = isResponseVM(lastItem) && lastItem.renderData;
            if (!lastResponseIsRendering || this.scrollLock) {
                // Due to rounding, the scrollTop + renderHeight will not exactly match the scrollHeight.
                // Consider the tree to be scrolled all the way down if it is within 2px of the bottom.
                const lastElementWasVisible = this.tree.scrollTop + this.tree.renderHeight >= this.previousTreeScrollHeight - 2;
                if (lastElementWasVisible) {
                    dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
                        // Can't set scrollTop during this event listener, the list might overwrite the change
                        this.scrollToEnd();
                    }, 0);
                }
            }
        }
        // TODO@roblourens add `show-scroll-down` class when button should show
        // Show the button when content height changes, the list is not fully scrolled down, and (the latest response is currently rendering OR I haven't yet scrolled all the way down since the last response)
        // So for example it would not reappear if I scroll up and delete a message
        this.previousTreeScrollHeight = this.tree.scrollHeight;
        this._onDidChangeContentHeight.fire();
    }
    getWidgetViewKindTag() {
        if (!this.viewContext) {
            return 'editor';
        }
        else if ('viewId' in this.viewContext) {
            return 'view';
        }
        else {
            return 'quick';
        }
    }
    createInput(container, options) {
        this.inputPart = this._register(this.instantiationService.createInstance(ChatInputPart, this.location, {
            renderFollowups: options?.renderFollowups ?? true,
            renderStyle: options?.renderStyle === 'minimal' ? 'compact' : options?.renderStyle,
            menus: { executeToolbar: MenuId.ChatExecute, ...this.viewOptions.menus },
            editorOverflowWidgetsDomNode: this.viewOptions.editorOverflowWidgetsDomNode,
            enableImplicitContext: this.viewOptions.enableImplicitContext,
            renderWorkingSet: this.viewOptions.enableWorkingSet === 'explicit',
            supportsChangingModes: this.viewOptions.supportsChangingModes,
            dndContainer: this.viewOptions.dndContainer,
            widgetViewKindTag: this.getWidgetViewKindTag()
        }, this.styles, () => this.collectInputState()));
        this.inputPart.render(container, '', this);
        this._register(this.inputPart.onDidLoadInputState(state => {
            this.contribs.forEach(c => {
                if (c.setInputState) {
                    const contribState = (typeof state === 'object' && state?.[c.id]) ?? {};
                    c.setInputState(contribState);
                }
            });
            this.refreshParsedInput();
        }));
        this._register(this.inputPart.onDidFocus(() => this._onDidFocus.fire()));
        this._register(this.inputPart.onDidAcceptFollowup(e => {
            if (!this.viewModel) {
                return;
            }
            let msg = '';
            if (e.followup.agentId && e.followup.agentId !== this.chatAgentService.getDefaultAgent(this.location, this.input.currentMode)?.id) {
                const agent = this.chatAgentService.getAgent(e.followup.agentId);
                if (!agent) {
                    return;
                }
                this.lastSelectedAgent = agent;
                msg = `${chatAgentLeader}${agent.name} `;
                if (e.followup.subCommand) {
                    msg += `${chatSubcommandLeader}${e.followup.subCommand} `;
                }
            }
            else if (!e.followup.agentId && e.followup.subCommand && this.chatSlashCommandService.hasCommand(e.followup.subCommand)) {
                msg = `${chatSubcommandLeader}${e.followup.subCommand} `;
            }
            msg += e.followup.message;
            this.acceptInput(msg);
            if (!e.response) {
                // Followups can be shown by the welcome message, then there is no response associated.
                // At some point we probably want telemetry for these too.
                return;
            }
            this.chatService.notifyUserAction({
                sessionId: this.viewModel.sessionId,
                requestId: e.response.requestId,
                agentId: e.response.agent?.id,
                command: e.response.slashCommand?.name,
                result: e.response.result,
                action: {
                    kind: 'followUp',
                    followup: e.followup
                },
            });
        }));
        this._register(this.inputPart.onDidChangeHeight(() => {
            if (this.bodyDimension) {
                this.layout(this.bodyDimension.height, this.bodyDimension.width);
            }
            this._onDidChangeContentHeight.fire();
        }));
        this._register(this.inputPart.attachmentModel.onDidChange(() => {
            if (this._editingSession) {
                // TODO still needed? Do this inside input part and fire onDidChangeHeight?
                this.renderChatEditingSessionState();
            }
        }));
        this._register(this.inputEditor.onDidChangeModelContent(() => {
            this.parsedChatRequest = undefined;
            this.updateChatInputContext();
        }));
        this._register(this.chatAgentService.onDidChangeAgents(() => {
            this.parsedChatRequest = undefined;
            // Tools agent loads -> welcome content changes
            this.renderWelcomeViewContentIfNeeded();
        }));
        this._register(this.input.onDidChangeCurrentChatMode(() => {
            this.renderWelcomeViewContentIfNeeded();
            this.refreshParsedInput();
            this.renderFollowups();
        }));
        const enabledToolSetsAndTools = this.input.selectedToolsModel.entries.map(value => {
            const toolSetIds = new Set();
            const toolIds = new Set();
            for (const item of value) {
                if (item instanceof ToolSet) {
                    toolSetIds.add(item.id);
                }
                else {
                    toolIds.add(item.id);
                }
            }
            return { toolSetIds, toolIds };
        });
        this._register(autorun(r => {
            const { toolSetIds, toolIds } = enabledToolSetsAndTools.read(r);
            const disabledTools = this.inputPart.attachmentModel.attachments
                .filter(a => a.kind === 'tool' && !toolIds.has(a.id) || a.kind === 'toolset' && !toolSetIds.has(a.id))
                .map(a => a.id);
            this.inputPart.attachmentModel.updateContext(disabledTools, Iterable.empty());
            this.refreshParsedInput();
        }));
    }
    onDidStyleChange() {
        this.container.style.setProperty('--vscode-interactive-result-editor-background-color', this.editorOptions.configuration.resultEditor.backgroundColor?.toString() ?? '');
        this.container.style.setProperty('--vscode-interactive-session-foreground', this.editorOptions.configuration.foreground?.toString() ?? '');
        this.container.style.setProperty('--vscode-chat-list-background', this.themeService.getColorTheme().getColor(this.styles.listBackground)?.toString() ?? '');
    }
    togglePaused() {
        this.viewModel?.model.toggleLastRequestPaused();
        this.onDidChangeItems();
    }
    setModel(model, viewState) {
        if (!this.container) {
            throw new Error('Call render() before setModel()');
        }
        if (model.sessionId === this.viewModel?.sessionId) {
            return;
        }
        this._codeBlockModelCollection.clear();
        this.container.setAttribute('data-session-id', model.sessionId);
        this.viewModel = this.instantiationService.createInstance(ChatViewModel, model, this._codeBlockModelCollection);
        const renderImmediately = this.configurationService.getValue('chat.experimental.renderMarkdownImmediately') === true;
        const delay = renderImmediately ? MicrotaskDelay : 0;
        this.viewModelDisposables.add(Event.runAndSubscribe(Event.accumulate(this.viewModel.onDidChange, delay), (events => {
            if (!this.viewModel) {
                return;
            }
            this.requestInProgress.set(this.viewModel.requestInProgress);
            this.isRequestPaused.set(this.viewModel.requestPausibility === 1 /* ChatPauseState.Paused */);
            this.canRequestBePaused.set(this.viewModel.requestPausibility !== 0 /* ChatPauseState.NotPausable */);
            this.onDidChangeItems();
            if (events?.some(e => e?.kind === 'addRequest') && this.visible) {
                this.scrollToEnd();
            }
            if (this._editingSession) {
                this.renderChatEditingSessionState();
            }
        })));
        this.viewModelDisposables.add(this.viewModel.onDidDisposeModel(() => {
            // Ensure that view state is saved here, because we will load it again when a new model is assigned
            this.inputPart.saveState();
            // Disposes the viewmodel and listeners
            this.viewModel = undefined;
            this.onDidChangeItems();
        }));
        this.inputPart.initForNewChatModel(viewState, model.getRequests().length === 0);
        this.contribs.forEach(c => {
            if (c.setInputState && viewState.inputState?.[c.id]) {
                c.setInputState(viewState.inputState?.[c.id]);
            }
        });
        this.refreshParsedInput();
        this.viewModelDisposables.add(model.onDidChange((e) => {
            if (e.kind === 'setAgent') {
                this._onDidChangeAgent.fire({ agent: e.agent, slashCommand: e.command });
            }
        }));
        if (this.tree && this.visible) {
            this.onDidChangeItems();
            this.scrollToEnd();
        }
        this.updateChatInputContext();
    }
    getFocus() {
        return this.tree.getFocus()[0] ?? undefined;
    }
    reveal(item, relativeTop) {
        this.tree.reveal(item, relativeTop);
    }
    focus(item) {
        const items = this.tree.getNode(null).children;
        const node = items.find(i => i.element?.id === item.id);
        if (!node) {
            return;
        }
        this.tree.setFocus([node.element]);
        this.tree.domFocus();
    }
    refilter() {
        this.tree.refilter();
    }
    setInputPlaceholder(placeholder) {
        this.viewModel?.setInputPlaceholder(placeholder);
    }
    resetInputPlaceholder() {
        this.viewModel?.resetInputPlaceholder();
    }
    setInput(value = '') {
        this.inputPart.setValue(value, false);
        this.refreshParsedInput();
    }
    getInput() {
        return this.inputPart.inputEditor.getValue();
    }
    logInputHistory() {
        this.inputPart.logInputHistory();
    }
    async acceptInput(query, options) {
        return this._acceptInput(query ? { query } : undefined, options);
    }
    async rerunLastRequest() {
        if (!this.viewModel) {
            return;
        }
        const sessionId = this.viewModel.sessionId;
        const lastRequest = this.chatService.getSession(sessionId)?.getRequests().at(-1);
        if (!lastRequest) {
            return;
        }
        const options = {
            attempt: lastRequest.attempt + 1,
            location: this.location,
            userSelectedModelId: this.input.currentLanguageModel
        };
        return await this.chatService.resendRequest(lastRequest, options);
    }
    collectInputState() {
        const inputState = {};
        this.contribs.forEach(c => {
            if (c.getInputState) {
                inputState[c.id] = c.getInputState();
            }
        });
        return inputState;
    }
    _findPromptFileInContext(attachedContext) {
        for (const item of attachedContext) {
            if (isPromptFileChatVariable(item) && item.isRoot) {
                return IChatRequestVariableEntry.toUri(item);
            }
        }
        return undefined;
    }
    async _applyPromptFileIfSet(requestInput) {
        let metadata;
        // first check if the input has a prompt slash command
        const agentSlashPromptPart = this.parsedInput.parts.find((r) => r instanceof ChatRequestSlashPromptPart);
        if (agentSlashPromptPart) {
            metadata = await this.promptsService.resolvePromptSlashCommand(agentSlashPromptPart.slashPromptCommand);
            if (metadata) {
                // add the prompt file to the context, but not sticky
                addPromptFileChatVariable(requestInput.attachedContext, metadata.uri);
                // remove the slash command from the input
                requestInput.input = this.parsedInput.parts.filter(part => !(part instanceof ChatRequestSlashPromptPart)).map(part => part.text).join('').trim();
            }
        }
        else {
            // if not, check if the context contains a prompt file: This is the old workflow that we still support for legacy reasons
            const uri = this._findPromptFileInContext(requestInput.attachedContext);
            if (uri) {
                metadata = await this.promptsService.getMetadata(uri);
            }
        }
        if (!metadata) {
            return undefined;
        }
        if (!requestInput.input.trim()) {
            // NOTE this is a prompt and therefore not localized
            requestInput.input = `Follow instructions from ${basename(metadata.uri)}`;
        }
        const meta = metadata.metadata;
        if (meta?.promptType === PromptsType.prompt) {
            await this._applyPromptMetadata(meta);
        }
        return metadata;
    }
    async _acceptInput(query, options) {
        if (this.viewModel?.requestInProgress && this.viewModel.requestPausibility !== 1 /* ChatPauseState.Paused */) {
            return;
        }
        if (!query && this.inputPart.generating) {
            // if the user submits the input and generation finishes quickly, just submit it for them
            const generatingAutoSubmitWindow = 500;
            const start = Date.now();
            await this.input.generating;
            if (Date.now() - start > generatingAutoSubmitWindow) {
                return;
            }
        }
        if (this.viewModel) {
            this._onDidAcceptInput.fire();
            this.scrollLock = !!checkModeOption(this.input.currentMode, this.viewOptions.autoScroll);
            const editorValue = this.getInput();
            const requestId = this.chatAccessibilityService.acceptRequest();
            const requestInputs = {
                input: !query ? editorValue : query.query,
                attachedContext: await this.inputPart.getAttachedAndImplicitContext(this.viewModel.sessionId),
            };
            const isUserQuery = !query;
            const { promptInstructions } = this.inputPart.attachmentModel;
            const instructionsEnabled = promptInstructions.featureEnabled;
            if (instructionsEnabled) {
                await this._applyPromptFileIfSet(requestInputs);
                await this.autoAttachInstructions(requestInputs.attachedContext);
            }
            if (this.viewOptions.enableWorkingSet !== undefined && this.input.currentMode === ChatMode.Edit && !this.chatService.edits2Enabled) {
                const uniqueWorkingSetEntries = new ResourceSet(); // NOTE: this is used for bookkeeping so the UI can avoid rendering references in the UI that are already shown in the working set
                const editingSessionAttachedContext = requestInputs.attachedContext;
                // Collect file variables from previous requests before sending the request
                const previousRequests = this.viewModel.model.getRequests();
                for (const request of previousRequests) {
                    for (const variable of request.variableData.variables) {
                        if (URI.isUri(variable.value) && variable.kind === 'file') {
                            const uri = variable.value;
                            if (!uniqueWorkingSetEntries.has(uri)) {
                                editingSessionAttachedContext.push(variable);
                                uniqueWorkingSetEntries.add(variable.value);
                            }
                        }
                    }
                }
                requestInputs.attachedContext = editingSessionAttachedContext;
                this.telemetryService.publicLog2('chatEditing/workingSetSize', { originalSize: uniqueWorkingSetEntries.size, actualSize: uniqueWorkingSetEntries.size });
            }
            this.chatService.cancelCurrentRequestForSession(this.viewModel.sessionId);
            this.input.validateAgentMode();
            const result = await this.chatService.sendRequest(this.viewModel.sessionId, requestInputs.input, {
                mode: this.inputPart.currentMode,
                userSelectedModelId: this.inputPart.currentLanguageModel,
                location: this.location,
                locationData: this._location.resolveData?.(),
                parserContext: { selectedAgent: this._lastSelectedAgent, mode: this.inputPart.currentMode },
                attachedContext: requestInputs.attachedContext,
                noCommandDetection: options?.noCommandDetection,
                userSelectedTools: this.getUserSelectedTools(),
                modeInstructions: this.input.currentMode2.body
            });
            if (result) {
                this.inputPart.acceptInput(isUserQuery);
                this._onDidSubmitAgent.fire({ agent: result.agent, slashCommand: result.slashCommand });
                result.responseCompletePromise.then(() => {
                    const responses = this.viewModel?.getItems().filter(isResponseVM);
                    const lastResponse = responses?.[responses.length - 1];
                    this.chatAccessibilityService.acceptResponse(lastResponse, requestId, options?.isVoiceInput);
                    if (lastResponse?.result?.nextQuestion) {
                        const { prompt, participant, command } = lastResponse.result.nextQuestion;
                        const question = formatChatQuestion(this.chatAgentService, this.location, prompt, participant, command);
                        if (question) {
                            this.input.setValue(question, false);
                        }
                    }
                });
                return result.responseCreatedPromise;
            }
        }
        return undefined;
    }
    getUserSelectedTools() {
        if (this.input.currentMode2.customTools) {
            return this.toolsService.toEnablementMap(this.input.currentMode2.customTools);
        }
        else if (this.input.currentMode === ChatMode.Agent) {
            const userSelectedTools = {};
            for (const [tool, enablement] of this.inputPart.selectedToolsModel.asEnablementMap()) {
                userSelectedTools[tool.id] = enablement;
            }
            return userSelectedTools;
        }
        return undefined;
    }
    getModeRequestOptions() {
        return {
            modeInstructions: this.input.currentMode2.body,
            userSelectedTools: this.getUserSelectedTools(),
            mode: this.input.currentMode,
        };
    }
    getCodeBlockInfosForResponse(response) {
        return this.renderer.getCodeBlockInfosForResponse(response);
    }
    getCodeBlockInfoForEditor(uri) {
        return this.renderer.getCodeBlockInfoForEditor(uri);
    }
    getFileTreeInfosForResponse(response) {
        return this.renderer.getFileTreeInfosForResponse(response);
    }
    getLastFocusedFileTreeForResponse(response) {
        return this.renderer.getLastFocusedFileTreeForResponse(response);
    }
    focusLastMessage() {
        if (!this.viewModel) {
            return;
        }
        const items = this.tree.getNode(null).children;
        const lastItem = items[items.length - 1];
        if (!lastItem) {
            return;
        }
        this.tree.setFocus([lastItem.element]);
        this.tree.domFocus();
    }
    layout(height, width) {
        width = Math.min(width, 850);
        this.bodyDimension = new dom.Dimension(width, height);
        this.inputPart.layout(this._dynamicMessageLayoutData?.enabled ? this._dynamicMessageLayoutData.maxHeight : height, width);
        const inputHeight = this.inputPart.inputPartHeight;
        const lastElementVisible = this.tree.scrollTop + this.tree.renderHeight >= this.tree.scrollHeight - 2;
        const contentHeight = Math.max(0, height - inputHeight);
        if (this.viewOptions.renderStyle === 'compact' || this.viewOptions.renderStyle === 'minimal') {
            this.listContainer.style.removeProperty('--chat-current-response-min-height');
        }
        else {
            this.listContainer.style.setProperty('--chat-current-response-min-height', contentHeight * .75 + 'px');
        }
        this.tree.layout(contentHeight, width);
        this.tree.getHTMLElement().style.height = `${contentHeight}px`;
        // Push the welcome message down so it doesn't change position
        // when followups, attachments or working set appear
        let welcomeOffset = 100;
        if (this.viewOptions.renderFollowups) {
            welcomeOffset = Math.max(welcomeOffset - this.inputPart.followupsHeight, 0);
        }
        if (this.viewOptions.enableWorkingSet) {
            welcomeOffset = Math.max(welcomeOffset - this.inputPart.editSessionWidgetHeight, 0);
        }
        welcomeOffset = Math.max(welcomeOffset - this.inputPart.attachmentsHeight, 0);
        this.welcomeMessageContainer.style.height = `${contentHeight - welcomeOffset}px`;
        this.welcomeMessageContainer.style.paddingBottom = `${welcomeOffset}px`;
        this.renderer.layout(width);
        const lastItem = this.viewModel?.getItems().at(-1);
        const lastResponseIsRendering = isResponseVM(lastItem) && lastItem.renderData;
        if (lastElementVisible && (!lastResponseIsRendering || checkModeOption(this.input.currentMode, this.viewOptions.autoScroll))) {
            this.scrollToEnd();
        }
        this.listContainer.style.height = `${contentHeight}px`;
        this._onDidChangeHeight.fire(height);
    }
    // An alternative to layout, this allows you to specify the number of ChatTreeItems
    // you want to show, and the max height of the container. It will then layout the
    // tree to show that many items.
    // TODO@TylerLeonhardt: This could use some refactoring to make it clear which layout strategy is being used
    setDynamicChatTreeItemLayout(numOfChatTreeItems, maxHeight) {
        this._dynamicMessageLayoutData = { numOfMessages: numOfChatTreeItems, maxHeight, enabled: true };
        this._register(this.renderer.onDidChangeItemHeight(() => this.layoutDynamicChatTreeItemMode()));
        const mutableDisposable = this._register(new MutableDisposable());
        this._register(this.tree.onDidScroll((e) => {
            // TODO@TylerLeonhardt this should probably just be disposed when this is disabled
            // and then set up again when it is enabled again
            if (!this._dynamicMessageLayoutData?.enabled) {
                return;
            }
            mutableDisposable.value = dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
                if (!e.scrollTopChanged || e.heightChanged || e.scrollHeightChanged) {
                    return;
                }
                const renderHeight = e.height;
                const diff = e.scrollHeight - renderHeight - e.scrollTop;
                if (diff === 0) {
                    return;
                }
                const possibleMaxHeight = (this._dynamicMessageLayoutData?.maxHeight ?? maxHeight);
                const width = this.bodyDimension?.width ?? this.container.offsetWidth;
                this.inputPart.layout(possibleMaxHeight, width);
                const inputPartHeight = this.inputPart.inputPartHeight;
                const newHeight = Math.min(renderHeight + diff, possibleMaxHeight - inputPartHeight);
                this.layout(newHeight + inputPartHeight, width);
            });
        }));
    }
    updateDynamicChatTreeItemLayout(numOfChatTreeItems, maxHeight) {
        this._dynamicMessageLayoutData = { numOfMessages: numOfChatTreeItems, maxHeight, enabled: true };
        let hasChanged = false;
        let height = this.bodyDimension.height;
        let width = this.bodyDimension.width;
        if (maxHeight < this.bodyDimension.height) {
            height = maxHeight;
            hasChanged = true;
        }
        const containerWidth = this.container.offsetWidth;
        if (this.bodyDimension?.width !== containerWidth) {
            width = containerWidth;
            hasChanged = true;
        }
        if (hasChanged) {
            this.layout(height, width);
        }
    }
    get isDynamicChatTreeItemLayoutEnabled() {
        return this._dynamicMessageLayoutData?.enabled ?? false;
    }
    set isDynamicChatTreeItemLayoutEnabled(value) {
        if (!this._dynamicMessageLayoutData) {
            return;
        }
        this._dynamicMessageLayoutData.enabled = value;
    }
    layoutDynamicChatTreeItemMode() {
        if (!this.viewModel || !this._dynamicMessageLayoutData?.enabled) {
            return;
        }
        const width = this.bodyDimension?.width ?? this.container.offsetWidth;
        this.inputPart.layout(this._dynamicMessageLayoutData.maxHeight, width);
        const inputHeight = this.inputPart.inputPartHeight;
        const totalMessages = this.viewModel.getItems();
        // grab the last N messages
        const messages = totalMessages.slice(-this._dynamicMessageLayoutData.numOfMessages);
        const needsRerender = messages.some(m => m.currentRenderedHeight === undefined);
        const listHeight = needsRerender
            ? this._dynamicMessageLayoutData.maxHeight
            : messages.reduce((acc, message) => acc + message.currentRenderedHeight, 0);
        this.layout(Math.min(
        // we add an additional 18px in order to show that there is scrollable content
        inputHeight + listHeight + (totalMessages.length > 2 ? 18 : 0), this._dynamicMessageLayoutData.maxHeight), width);
        if (needsRerender || !listHeight) {
            this.scrollToEnd();
        }
    }
    saveState() {
        this.inputPart.saveState();
    }
    getViewState() {
        return {
            inputValue: this.getInput(),
            inputState: this.inputPart.getViewState()
        };
    }
    updateChatInputContext() {
        const currentAgent = this.parsedInput.parts.find(part => part instanceof ChatRequestAgentPart);
        this.agentInInput.set(!!currentAgent);
    }
    async _applyPromptMetadata(metadata) {
        const { mode, tools } = metadata;
        // switch to appropriate chat mode if needed
        if (mode && mode !== this.inputPart.currentMode) {
            const chatModeCheck = await this.instantiationService.invokeFunction(handleModeSwitch, this.inputPart.currentMode, mode, this.viewModel?.model.getRequests().length ?? 0, this.viewModel?.model.editingSession);
            if (!chatModeCheck) {
                return undefined;
            }
            else if (chatModeCheck.needToClearSession) {
                this.clear();
                await this.waitForReady();
            }
            this.inputPart.setChatMode(mode);
        }
        // if not tools to enable are present, we are done
        if (tools === undefined) {
            return;
        }
        // sanity check on the logic of the `getPromptFilesMetadata` method
        // and the code above in case this block is moved around somewhere else:
        // if we have some tools present, the mode must have been equal to `agent`
        assert(this.inputPart.currentMode === ChatMode.Agent, `Chat mode must be 'agent' when there are 'tools' defined, got ${this.inputPart.currentMode}.`);
        // convert names to tools or tool sets
        const enabledTools = [];
        const enabledToolSets = [];
        for (const name of tools) {
            const tool = this.toolsService.getToolByName(name);
            if (tool) {
                enabledTools.push(tool);
                continue;
            }
            const toolset = this.toolsService.getToolSetByName(name);
            if (toolset) {
                enabledToolSets.push(toolset);
                continue;
            }
        }
        this.inputPart.selectedToolsModel.enable(enabledToolSets, enabledTools, true);
    }
    /**
     * Resolves instructions that have `include` metadata that can
     * match file references in the attached context and then attaches
     * such instructions to the context.
     */
    async autoAttachInstructions(attachedContext) {
        const variableUris = attachedContext
            .map(IChatRequestVariableEntry.toUri)
            .filter(isDefined);
        const automaticInstructions = await this.promptsService
            .findInstructionFilesFor(variableUris);
        // add instructions to the final context list
        automaticInstructions.forEach(instruction => addPromptFileChatVariable(attachedContext, instruction));
        // add to attached list to make the instructions sticky
        this.inputPart
            .attachmentModel
            .promptInstructions.add(automaticInstructions);
    }
};
ChatWidget = ChatWidget_1 = __decorate([
    __param(4, ICodeEditorService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService),
    __param(7, IInstantiationService),
    __param(8, IChatService),
    __param(9, IChatAgentService),
    __param(10, IChatWidgetService),
    __param(11, IContextMenuService),
    __param(12, IChatAccessibilityService),
    __param(13, ILogService),
    __param(14, IThemeService),
    __param(15, IChatSlashCommandService),
    __param(16, IChatEditingService),
    __param(17, ITelemetryService),
    __param(18, IPromptsService),
    __param(19, ILanguageModelToolsService)
], ChatWidget);
export { ChatWidget };
export class ChatWidgetService extends Disposable {
    constructor() {
        super(...arguments);
        this._widgets = [];
        this._lastFocusedWidget = undefined;
        this._onDidAddWidget = this._register(new Emitter());
        this.onDidAddWidget = this._onDidAddWidget.event;
    }
    get lastFocusedWidget() {
        return this._lastFocusedWidget;
    }
    getAllWidgets() {
        return this._widgets;
    }
    getWidgetsByLocations(location) {
        return this._widgets.filter(w => w.location === location);
    }
    getWidgetByInputUri(uri) {
        return this._widgets.find(w => isEqual(w.inputUri, uri));
    }
    getWidgetBySessionId(sessionId) {
        return this._widgets.find(w => w.viewModel?.sessionId === sessionId);
    }
    setLastFocusedWidget(widget) {
        if (widget === this._lastFocusedWidget) {
            return;
        }
        this._lastFocusedWidget = widget;
    }
    register(newWidget) {
        if (this._widgets.some(widget => widget === newWidget)) {
            throw new Error('Cannot register the same widget multiple times');
        }
        this._widgets.push(newWidget);
        this._onDidAddWidget.fire(newWidget);
        return combinedDisposable(newWidget.onDidFocus(() => this.setLastFocusedWidget(newWidget)), toDisposable(() => this._widgets.splice(this._widgets.indexOf(newWidget), 1)));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFdpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRXaWRnZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRXRFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDOUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDckosT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FB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