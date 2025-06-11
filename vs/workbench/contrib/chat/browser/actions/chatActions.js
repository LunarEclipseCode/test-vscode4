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
import { isAncestorOfActiveElement } from '../../../../../base/browser/dom.js';
import { toAction } from '../../../../../base/common/actions.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { timeout } from '../../../../../base/common/async.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { fromNowByDay, safeIntl } from '../../../../../base/common/date.js';
import { Event } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, markAsSingleton } from '../../../../../base/common/lifecycle.js';
import { language } from '../../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditorAction2 } from '../../../../../editor/browser/editorExtensions.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { SuggestController } from '../../../../../editor/contrib/suggest/browser/suggestController.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { Action2, MenuId, MenuItemAction, MenuRegistry, registerAction2, SubmenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsLinuxContext, IsWindowsContext } from '../../../../../platform/contextkey/common/contextkeys.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import product from '../../../../../platform/product/common/product.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ToggleTitleBarConfigAction } from '../../../../browser/parts/titlebar/titlebarActions.js';
import { IsCompactTitleBarContext } from '../../../../common/contextkeys.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { EXTENSIONS_CATEGORY, IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { IChatAgentService } from '../../common/chatAgents.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatEntitlement, IChatEntitlementService } from '../../common/chatEntitlementService.js';
import { extractAgentAndCommand } from '../../common/chatParserTypes.js';
import { IChatService } from '../../common/chatService.js';
import { isRequestVM } from '../../common/chatViewModel.js';
import { IChatWidgetHistoryService } from '../../common/chatWidgetHistoryService.js';
import { ChatAgentLocation, ChatConfiguration, ChatMode, modeToString, validateChatMode } from '../../common/constants.js';
import { CopilotUsageExtensionFeatureId } from '../../common/languageModelStats.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { ChatViewId, IChatWidgetService, showChatView, showCopilotView } from '../chat.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { convertBufferToScreenshotVariable } from '../contrib/screenshot.js';
import { clearChatEditor } from './chatClear.js';
export const CHAT_CATEGORY = localize2('chat.category', 'Chat');
export const ACTION_ID_NEW_CHAT = `workbench.action.chat.newChat`;
export const ACTION_ID_NEW_EDIT_SESSION = `workbench.action.chat.newEditSession`;
export const CHAT_OPEN_ACTION_ID = 'workbench.action.chat.open';
export const CHAT_SETUP_ACTION_ID = 'workbench.action.chat.triggerSetup';
const TOGGLE_CHAT_ACTION_ID = 'workbench.action.chat.toggle';
const CHAT_CLEAR_HISTORY_ACTION_ID = 'workbench.action.chat.clearHistory';
const OPEN_CHAT_QUOTA_EXCEEDED_DIALOG = 'workbench.action.chat.openQuotaExceededDialog';
class OpenChatGlobalAction extends Action2 {
    constructor(overrides, mode) {
        super({
            ...overrides,
            icon: Codicon.copilot,
            f1: true,
            category: CHAT_CATEGORY,
            precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate())
        });
        this.mode = mode;
    }
    async run(accessor, opts) {
        opts = typeof opts === 'string' ? { query: opts } : opts;
        const chatService = accessor.get(IChatService);
        const widgetService = accessor.get(IChatWidgetService);
        const toolsService = accessor.get(ILanguageModelToolsService);
        const viewsService = accessor.get(IViewsService);
        const hostService = accessor.get(IHostService);
        const chatAgentService = accessor.get(IChatAgentService);
        const instaService = accessor.get(IInstantiationService);
        const commandService = accessor.get(ICommandService);
        let chatWidget = widgetService.lastFocusedWidget;
        // When this was invoked to switch to a mode via keybinding, and some chat widget is focused, use that one.
        // Otherwise, open the view.
        if (!this.mode || !chatWidget || !isAncestorOfActiveElement(chatWidget.domNode)) {
            chatWidget = await showChatView(viewsService);
        }
        if (!chatWidget) {
            return;
        }
        let switchToMode = opts?.mode ?? this.mode;
        if (!switchToMode) {
            switchToMode = opts?.query.startsWith('@') ? ChatMode.Ask : undefined;
        }
        if (switchToMode && validateChatMode(switchToMode)) {
            await this.handleSwitchToMode(switchToMode, chatWidget, instaService, commandService);
        }
        if (opts?.previousRequests?.length && chatWidget.viewModel) {
            for (const { request, response } of opts.previousRequests) {
                chatService.addCompleteRequest(chatWidget.viewModel.sessionId, request, undefined, 0, { message: response });
            }
        }
        if (opts?.attachScreenshot) {
            const screenshot = await hostService.getScreenshot();
            if (screenshot) {
                chatWidget.attachmentModel.addContext(convertBufferToScreenshotVariable(screenshot));
            }
        }
        if (opts?.query) {
            if (opts.isPartialQuery) {
                chatWidget.setInput(opts.query);
            }
            else {
                await chatWidget.waitForReady();
                await waitForDefaultAgent(chatAgentService, chatWidget.input.currentMode);
                chatWidget.acceptInput(opts.query);
            }
        }
        if (opts?.toolIds && opts.toolIds.length > 0) {
            for (const toolId of opts.toolIds) {
                const tool = toolsService.getTool(toolId);
                if (tool) {
                    chatWidget.attachmentModel.addContext({
                        id: tool.id,
                        name: tool.displayName,
                        fullName: tool.displayName,
                        value: undefined,
                        icon: ThemeIcon.isThemeIcon(tool.icon) ? tool.icon : undefined,
                        kind: 'tool'
                    });
                }
            }
        }
        chatWidget.focusInput();
    }
    async handleSwitchToMode(switchToMode, chatWidget, instaService, commandService) {
        const currentMode = chatWidget.input.currentMode;
        if (switchToMode) {
            const editingSession = chatWidget.viewModel?.model.editingSession;
            const requestCount = chatWidget.viewModel?.model.getRequests().length ?? 0;
            const chatModeCheck = await instaService.invokeFunction(handleModeSwitch, currentMode, switchToMode, requestCount, editingSession);
            if (!chatModeCheck) {
                return;
            }
            chatWidget.input.setChatMode(switchToMode);
            if (chatModeCheck.needToClearSession) {
                await commandService.executeCommand(ACTION_ID_NEW_CHAT);
            }
        }
    }
}
async function waitForDefaultAgent(chatAgentService, mode) {
    const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Panel, mode);
    if (defaultAgent) {
        return;
    }
    await Promise.race([
        Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
            const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Panel, mode);
            return Boolean(defaultAgent);
        })),
        timeout(60_000).then(() => { throw new Error('Timed out waiting for default agent'); })
    ]);
}
class PrimaryOpenChatGlobalAction extends OpenChatGlobalAction {
    constructor() {
        super({
            id: CHAT_OPEN_ACTION_ID,
            title: localize2('openChat', "Open Chat"),
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 39 /* KeyCode.KeyI */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 39 /* KeyCode.KeyI */
                }
            },
            menu: [{
                    id: MenuId.ChatTitleBarMenu,
                    group: 'a_open',
                    order: 1
                }]
        });
    }
}
export function getOpenChatActionIdForMode(mode) {
    const modeStr = modeToString(mode);
    return `workbench.action.chat.open${modeStr}`;
}
class ModeOpenChatGlobalAction extends OpenChatGlobalAction {
    constructor(mode, keybinding) {
        super({
            id: getOpenChatActionIdForMode(mode),
            title: localize2('openChatMode', "Open Chat ({0})", modeToString(mode)),
            keybinding
        }, mode);
    }
}
export function registerChatActions() {
    registerAction2(PrimaryOpenChatGlobalAction);
    registerAction2(class extends ModeOpenChatGlobalAction {
        constructor() { super(ChatMode.Ask); }
    });
    registerAction2(class extends ModeOpenChatGlobalAction {
        constructor() {
            super(ChatMode.Agent, {
                when: ContextKeyExpr.has(`config.${ChatConfiguration.AgentEnabled}`),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 39 /* KeyCode.KeyI */,
                linux: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 39 /* KeyCode.KeyI */
                }
            });
        }
    });
    registerAction2(class extends ModeOpenChatGlobalAction {
        constructor() { super(ChatMode.Edit); }
    });
    registerAction2(class ToggleChatAction extends Action2 {
        constructor() {
            super({
                id: TOGGLE_CHAT_ACTION_ID,
                title: localize2('toggleChat', "Toggle Chat"),
                category: CHAT_CATEGORY
            });
        }
        async run(accessor) {
            const layoutService = accessor.get(IWorkbenchLayoutService);
            const viewsService = accessor.get(IViewsService);
            const viewDescriptorService = accessor.get(IViewDescriptorService);
            const chatLocation = viewDescriptorService.getViewLocationById(ChatViewId);
            if (viewsService.isViewVisible(ChatViewId)) {
                this.updatePartVisibility(layoutService, chatLocation, false);
            }
            else {
                this.updatePartVisibility(layoutService, chatLocation, true);
                (await showCopilotView(viewsService, layoutService))?.focusInput();
            }
        }
        updatePartVisibility(layoutService, location, visible) {
            let part;
            switch (location) {
                case 1 /* ViewContainerLocation.Panel */:
                    part = "workbench.parts.panel" /* Parts.PANEL_PART */;
                    break;
                case 0 /* ViewContainerLocation.Sidebar */:
                    part = "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */;
                    break;
                case 2 /* ViewContainerLocation.AuxiliaryBar */:
                    part = "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */;
                    break;
            }
            if (part) {
                layoutService.setPartHidden(!visible, part);
            }
        }
    });
    registerAction2(class ChatHistoryAction extends Action2 {
        constructor() {
            super({
                id: `workbench.action.chat.history`,
                title: localize2('chat.history.label', "Show Chats..."),
                menu: {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.equals('view', ChatViewId),
                    group: 'navigation',
                    order: 2
                },
                category: CHAT_CATEGORY,
                icon: Codicon.history,
                f1: true,
                precondition: ChatContextKeys.enabled
            });
        }
        async run(accessor) {
            const chatService = accessor.get(IChatService);
            const quickInputService = accessor.get(IQuickInputService);
            const viewsService = accessor.get(IViewsService);
            const editorService = accessor.get(IEditorService);
            const dialogService = accessor.get(IDialogService);
            const commandService = accessor.get(ICommandService);
            const view = await viewsService.openView(ChatViewId);
            if (!view) {
                return;
            }
            const chatSessionId = view.widget.viewModel?.model.sessionId;
            if (!chatSessionId) {
                return;
            }
            const editingSession = view.widget.viewModel?.model.editingSession;
            if (editingSession) {
                const phrase = localize('switchChat.confirmPhrase', "Switching chats will end your current edit session.");
                if (!await handleCurrentEditingSession(editingSession, phrase, dialogService)) {
                    return;
                }
            }
            const showPicker = async () => {
                const clearChatHistoryButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.clearAll),
                    tooltip: localize('interactiveSession.history.clear', "Clear All Workspace Chats"),
                };
                const openInEditorButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.file),
                    tooltip: localize('interactiveSession.history.editor', "Open in Editor"),
                };
                const deleteButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.x),
                    tooltip: localize('interactiveSession.history.delete', "Delete"),
                };
                const renameButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.pencil),
                    tooltip: localize('chat.history.rename', "Rename"),
                };
                const getPicks = async () => {
                    const items = await chatService.getHistory();
                    items.sort((a, b) => (b.lastMessageDate ?? 0) - (a.lastMessageDate ?? 0));
                    let lastDate = undefined;
                    const picks = items.flatMap((i) => {
                        const timeAgoStr = fromNowByDay(i.lastMessageDate, true, true);
                        const separator = timeAgoStr !== lastDate ? {
                            type: 'separator', label: timeAgoStr,
                        } : undefined;
                        lastDate = timeAgoStr;
                        return [
                            separator,
                            {
                                label: i.title,
                                description: i.isActive ? `(${localize('currentChatLabel', 'current')})` : '',
                                chat: i,
                                buttons: i.isActive ? [renameButton] : [
                                    renameButton,
                                    openInEditorButton,
                                    deleteButton,
                                ]
                            }
                        ];
                    });
                    return coalesce(picks);
                };
                const store = new DisposableStore();
                const picker = store.add(quickInputService.createQuickPick({ useSeparators: true }));
                picker.title = localize('interactiveSession.history.title', "Workspace Chat History");
                picker.placeholder = localize('interactiveSession.history.pick', "Switch to chat");
                picker.buttons = [clearChatHistoryButton];
                const picks = await getPicks();
                picker.items = picks;
                store.add(picker.onDidTriggerButton(async (button) => {
                    if (button === clearChatHistoryButton) {
                        await commandService.executeCommand(CHAT_CLEAR_HISTORY_ACTION_ID);
                    }
                }));
                store.add(picker.onDidTriggerItemButton(async (context) => {
                    if (context.button === openInEditorButton) {
                        const options = { target: { sessionId: context.item.chat.sessionId }, pinned: true };
                        editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options }, ACTIVE_GROUP);
                        picker.hide();
                    }
                    else if (context.button === deleteButton) {
                        chatService.removeHistoryEntry(context.item.chat.sessionId);
                        picker.items = await getPicks();
                    }
                    else if (context.button === renameButton) {
                        const title = await quickInputService.input({ title: localize('newChatTitle', "New chat title"), value: context.item.chat.title });
                        if (title) {
                            chatService.setChatSessionTitle(context.item.chat.sessionId, title);
                        }
                        // The quick input hides the picker, it gets disposed, so we kick it off from scratch
                        await showPicker();
                    }
                }));
                store.add(picker.onDidAccept(async () => {
                    try {
                        const item = picker.selectedItems[0];
                        const sessionId = item.chat.sessionId;
                        await view.loadSession(sessionId);
                    }
                    finally {
                        picker.hide();
                    }
                }));
                store.add(picker.onDidHide(() => store.dispose()));
                picker.show();
            };
            await showPicker();
        }
    });
    registerAction2(class OpenChatEditorAction extends Action2 {
        constructor() {
            super({
                id: `workbench.action.openChat`,
                title: localize2('interactiveSession.open', "New Chat Editor"),
                f1: true,
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true } });
        }
    });
    registerAction2(class ChatAddAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.addParticipant',
                title: localize2('chatWith', "Chat with Extension"),
                icon: Codicon.mention,
                f1: false,
                category: CHAT_CATEGORY,
                menu: {
                    id: MenuId.ChatExecute,
                    when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask),
                    group: 'navigation',
                    order: 1
                }
            });
        }
        async run(accessor, ...args) {
            const widgetService = accessor.get(IChatWidgetService);
            const context = args[0];
            const widget = context?.widget ?? widgetService.lastFocusedWidget;
            if (!widget) {
                return;
            }
            const hasAgentOrCommand = extractAgentAndCommand(widget.parsedInput);
            if (hasAgentOrCommand?.agentPart || hasAgentOrCommand?.commandPart) {
                return;
            }
            const suggestCtrl = SuggestController.get(widget.inputEditor);
            if (suggestCtrl) {
                const curText = widget.inputEditor.getValue();
                const newValue = curText ? `@ ${curText}` : '@';
                if (!curText.startsWith('@')) {
                    widget.inputEditor.setValue(newValue);
                }
                widget.inputEditor.setPosition(new Position(1, 2));
                suggestCtrl.triggerSuggest(undefined, true);
            }
        }
    });
    registerAction2(class ClearChatInputHistoryAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.clearInputHistory',
                title: localize2('interactiveSession.clearHistory.label', "Clear Input History"),
                precondition: ChatContextKeys.enabled,
                category: CHAT_CATEGORY,
                f1: true,
            });
        }
        async run(accessor, ...args) {
            const historyService = accessor.get(IChatWidgetHistoryService);
            historyService.clearHistory();
        }
    });
    registerAction2(class ClearChatHistoryAction extends Action2 {
        constructor() {
            super({
                id: CHAT_CLEAR_HISTORY_ACTION_ID,
                title: localize2('chat.clear.label', "Clear All Workspace Chats"),
                precondition: ChatContextKeys.enabled,
                category: CHAT_CATEGORY,
                f1: true,
            });
        }
        async run(accessor, ...args) {
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const chatService = accessor.get(IChatService);
            const instantiationService = accessor.get(IInstantiationService);
            const widgetService = accessor.get(IChatWidgetService);
            await chatService.clearAllHistoryEntries();
            widgetService.getAllWidgets().forEach(widget => {
                widget.clear();
            });
            // Clear all chat editors. Have to go this route because the chat editor may be in the background and
            // not have a ChatEditorInput.
            editorGroupsService.groups.forEach(group => {
                group.editors.forEach(editor => {
                    if (editor instanceof ChatEditorInput) {
                        instantiationService.invokeFunction(clearChatEditor, editor);
                    }
                });
            });
        }
    });
    registerAction2(class FocusChatAction extends EditorAction2 {
        constructor() {
            super({
                id: 'chat.action.focus',
                title: localize2('actions.interactiveSession.focus', 'Focus Chat List'),
                precondition: ContextKeyExpr.and(ChatContextKeys.inChatInput),
                category: CHAT_CATEGORY,
                keybinding: [
                    // On mac, require that the cursor is at the top of the input, to avoid stealing cmd+up to move the cursor to the top
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inputCursorAtTop, ChatContextKeys.inQuickChat.negate()),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                    },
                    // On win/linux, ctrl+up can always focus the chat list
                    {
                        when: ContextKeyExpr.and(ContextKeyExpr.or(IsWindowsContext, IsLinuxContext), ChatContextKeys.inQuickChat.negate()),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                    },
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inQuickChat),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    }
                ]
            });
        }
        runEditorCommand(accessor, editor) {
            const editorUri = editor.getModel()?.uri;
            if (editorUri) {
                const widgetService = accessor.get(IChatWidgetService);
                widgetService.getWidgetByInputUri(editorUri)?.focusLastMessage();
            }
        }
    });
    registerAction2(class FocusChatInputAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.focusInput',
                title: localize2('interactiveSession.focusInput.label', "Focus Chat Input"),
                f1: false,
                keybinding: [
                    {
                        primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate(), ChatContextKeys.inQuickChat.negate()),
                    },
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate(), ChatContextKeys.inQuickChat),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    }
                ]
            });
        }
        run(accessor, ...args) {
            const widgetService = accessor.get(IChatWidgetService);
            widgetService.lastFocusedWidget?.focusInput();
        }
    });
    const nonEnterpriseCopilotUsers = ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.notEquals(`config.${defaultChat.completionsAdvancedSetting}.authProvider`, defaultChat.enterpriseProviderId));
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.manageSettings',
                title: localize2('manageCopilot', "Manage Copilot"),
                category: CHAT_CATEGORY,
                f1: true,
                precondition: ContextKeyExpr.and(ContextKeyExpr.or(ChatContextKeys.Entitlement.free, ChatContextKeys.Entitlement.pro, ChatContextKeys.Entitlement.proPlus), nonEnterpriseCopilotUsers),
                menu: {
                    id: MenuId.ChatTitleBarMenu,
                    group: 'y_manage',
                    order: 1,
                    when: nonEnterpriseCopilotUsers
                }
            });
        }
        async run(accessor) {
            const openerService = accessor.get(IOpenerService);
            openerService.open(URI.parse(defaultChat.manageSettingsUrl));
        }
    });
    registerAction2(class ShowExtensionsUsingCopilot extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.showExtensionsUsingCopilot',
                title: localize2('showCopilotUsageExtensions', "Show Extensions using Copilot"),
                f1: true,
                category: EXTENSIONS_CATEGORY,
                precondition: ChatContextKeys.enabled
            });
        }
        async run(accessor) {
            const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
            extensionsWorkbenchService.openSearch(`@feature:${CopilotUsageExtensionFeatureId}`);
        }
    });
    registerAction2(class ConfigureCopilotCompletions extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.configureCodeCompletions',
                title: localize2('configureCompletions', "Configure Code Completions..."),
                precondition: ContextKeyExpr.and(ChatContextKeys.Setup.installed, ChatContextKeys.Setup.disabled.negate()),
                menu: {
                    id: MenuId.ChatTitleBarMenu,
                    group: 'f_completions',
                    order: 10,
                }
            });
        }
        async run(accessor) {
            const commandService = accessor.get(ICommandService);
            commandService.executeCommand(defaultChat.completionsMenuCommand);
        }
    });
    registerAction2(class ShowQuotaExceededDialogAction extends Action2 {
        constructor() {
            super({
                id: OPEN_CHAT_QUOTA_EXCEEDED_DIALOG,
                title: localize('upgradeChat', "Upgrade Copilot Plan")
            });
        }
        async run(accessor) {
            const chatEntitlementService = accessor.get(IChatEntitlementService);
            const commandService = accessor.get(ICommandService);
            const dialogService = accessor.get(IDialogService);
            const telemetryService = accessor.get(ITelemetryService);
            let message;
            const chatQuotaExceeded = chatEntitlementService.quotas.chat?.percentRemaining === 0;
            const completionsQuotaExceeded = chatEntitlementService.quotas.completions?.percentRemaining === 0;
            if (chatQuotaExceeded && !completionsQuotaExceeded) {
                message = localize('chatQuotaExceeded', "You've reached your monthly chat messages quota. You still have free code completions available.");
            }
            else if (completionsQuotaExceeded && !chatQuotaExceeded) {
                message = localize('completionsQuotaExceeded', "You've reached your monthly code completions quota. You still have free chat messages available.");
            }
            else {
                message = localize('chatAndCompletionsQuotaExceeded', "You've reached your monthly chat messages and code completions quota.");
            }
            if (chatEntitlementService.quotas.resetDate) {
                const dateFormatter = safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' });
                const quotaResetDate = new Date(chatEntitlementService.quotas.resetDate);
                message = [message, localize('quotaResetDate', "The allowance will reset on {0}.", dateFormatter.value.format(quotaResetDate))].join(' ');
            }
            const free = chatEntitlementService.entitlement === ChatEntitlement.Free;
            const upgradeToPro = free ? localize('upgradeToPro', "Upgrade to Copilot Pro (your first 30 days are free) for:\n- Unlimited code completions\n- Unlimited chat messages\n- Access to premium models") : undefined;
            await dialogService.prompt({
                type: 'none',
                message: localize('copilotQuotaReached', "Copilot Quota Reached"),
                cancelButton: {
                    label: localize('dismiss', "Dismiss"),
                    run: () => { }
                },
                buttons: [
                    {
                        label: free ? localize('upgradePro', "Upgrade to Copilot Pro") : localize('upgradePlan', "Upgrade Copilot Plan"),
                        run: () => {
                            const commandId = 'workbench.action.chat.upgradePlan';
                            telemetryService.publicLog2('workbenchActionExecuted', { id: commandId, from: 'chat-dialog' });
                            commandService.executeCommand(commandId);
                        }
                    },
                ],
                custom: {
                    icon: Codicon.copilotWarningLarge,
                    markdownDetails: coalesce([
                        { markdown: new MarkdownString(message, true) },
                        upgradeToPro ? { markdown: new MarkdownString(upgradeToPro, true) } : undefined
                    ])
                }
            });
        }
    });
    registerAction2(class ResetTrustedToolsAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.resetTrustedTools',
                title: localize2('resetTrustedTools', "Reset Tool Confirmations"),
                category: CHAT_CATEGORY,
                f1: true,
                precondition: ChatContextKeys.enabled
            });
        }
        run(accessor) {
            accessor.get(ILanguageModelToolsService).resetToolAutoConfirmation();
            accessor.get(INotificationService).info(localize('resetTrustedToolsSuccess', "Tool confirmation preferences have been reset."));
        }
    });
}
export function stringifyItem(item, includeName = true) {
    if (isRequestVM(item)) {
        return (includeName ? `${item.username}: ` : '') + item.messageText;
    }
    else {
        return (includeName ? `${item.username}: ` : '') + item.response.toString();
    }
}
// --- Title Bar Copilot Controls
const defaultChat = {
    documentationUrl: product.defaultChatAgent?.documentationUrl ?? '',
    manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? '',
    managePlanUrl: product.defaultChatAgent?.managePlanUrl ?? '',
    enterpriseProviderId: product.defaultChatAgent?.enterpriseProviderId ?? '',
    completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? '',
    completionsMenuCommand: product.defaultChatAgent?.completionsMenuCommand ?? '',
};
// Add next to the command center if command center is disabled
MenuRegistry.appendMenuItem(MenuId.CommandCenter, {
    submenu: MenuId.ChatTitleBarMenu,
    title: localize('title4', "Copilot"),
    icon: Codicon.copilot,
    when: ContextKeyExpr.and(ChatContextKeys.supported, ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate()), ContextKeyExpr.has('config.chat.commandCenter.enabled')),
    order: 10001 // to the right of command center
});
// Add to the global title bar if command center is disabled
MenuRegistry.appendMenuItem(MenuId.TitleBar, {
    submenu: MenuId.ChatTitleBarMenu,
    title: localize('title4', "Copilot"),
    group: 'navigation',
    icon: Codicon.copilot,
    when: ContextKeyExpr.and(ChatContextKeys.supported, ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate()), ContextKeyExpr.has('config.chat.commandCenter.enabled'), ContextKeyExpr.has('config.window.commandCenter').negate()),
    order: 1
});
registerAction2(class ToggleCopilotControl extends ToggleTitleBarConfigAction {
    constructor() {
        super('chat.commandCenter.enabled', localize('toggle.chatControl', 'Copilot Controls'), localize('toggle.chatControlsDescription', "Toggle visibility of the Copilot Controls in title bar"), 5, ContextKeyExpr.and(ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate()), IsCompactTitleBarContext.negate(), ChatContextKeys.supported));
    }
});
let CopilotTitleBarMenuRendering = class CopilotTitleBarMenuRendering extends Disposable {
    static { this.ID = 'workbench.contrib.copilotTitleBarMenuRendering'; }
    constructor(actionViewItemService, instantiationService, chatEntitlementService) {
        super();
        const disposable = actionViewItemService.register(MenuId.CommandCenter, MenuId.ChatTitleBarMenu, (action, options) => {
            if (!(action instanceof SubmenuItemAction)) {
                return undefined;
            }
            const dropdownAction = toAction({
                id: 'copilot.titleBarMenuRendering.more',
                label: localize('more', "More..."),
                run() { }
            });
            const chatSentiment = chatEntitlementService.sentiment;
            const chatQuotaExceeded = chatEntitlementService.quotas.chat?.percentRemaining === 0;
            const signedOut = chatEntitlementService.entitlement === ChatEntitlement.Unknown;
            const free = chatEntitlementService.entitlement === ChatEntitlement.Free;
            let primaryActionId = TOGGLE_CHAT_ACTION_ID;
            let primaryActionTitle = localize('toggleChat', "Toggle Chat");
            let primaryActionIcon = Codicon.copilot;
            if (chatSentiment.installed && !chatSentiment.disabled) {
                if (signedOut) {
                    primaryActionId = CHAT_SETUP_ACTION_ID;
                    primaryActionTitle = localize('signInToChatSetup', "Sign in to use Copilot...");
                    primaryActionIcon = Codicon.copilotNotConnected;
                }
                else if (chatQuotaExceeded && free) {
                    primaryActionId = OPEN_CHAT_QUOTA_EXCEEDED_DIALOG;
                    primaryActionTitle = localize('chatQuotaExceededButton', "Copilot Free plan chat messages quota reached. Click for details.");
                    primaryActionIcon = Codicon.copilotWarning;
                }
            }
            return instantiationService.createInstance(DropdownWithPrimaryActionViewItem, instantiationService.createInstance(MenuItemAction, {
                id: primaryActionId,
                title: primaryActionTitle,
                icon: primaryActionIcon,
            }, undefined, undefined, undefined, undefined), dropdownAction, action.actions, '', { ...options, skipTelemetry: true });
        }, Event.any(chatEntitlementService.onDidChangeSentiment, chatEntitlementService.onDidChangeQuotaExceeded, chatEntitlementService.onDidChangeEntitlement));
        // Reduces flicker a bit on reload/restart
        markAsSingleton(disposable);
    }
};
CopilotTitleBarMenuRendering = __decorate([
    __param(0, IActionViewItemService),
    __param(1, IInstantiationService),
    __param(2, IChatEntitlementService)
], CopilotTitleBarMenuRendering);
export { CopilotTitleBarMenuRendering };
/**
 * Returns whether we can continue clearing/switching chat sessions, false to cancel.
 */
export async function handleCurrentEditingSession(currentEditingSession, phrase, dialogService) {
    if (shouldShowClearEditingSessionConfirmation(currentEditingSession)) {
        return showClearEditingSessionConfirmation(currentEditingSession, dialogService, { messageOverride: phrase });
    }
    return true;
}
/**
 * Returns whether we can switch the chat mode, based on whether the user had to agree to clear the session, false to cancel.
 */
export async function handleModeSwitch(accessor, fromMode, toMode, requestCount, editingSession) {
    if (!editingSession || fromMode === toMode) {
        return { needToClearSession: false };
    }
    const configurationService = accessor.get(IConfigurationService);
    const dialogService = accessor.get(IDialogService);
    const needToClearEdits = (!configurationService.getValue(ChatConfiguration.Edits2Enabled) && (fromMode === ChatMode.Edit || toMode === ChatMode.Edit)) && requestCount > 0;
    if (needToClearEdits) {
        // If not using edits2 and switching into or out of edit mode, ask to discard the session
        const phrase = localize('switchMode.confirmPhrase', "Switching chat modes will end your current edit session.");
        const currentEdits = editingSession.entries.get();
        const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
        if (undecidedEdits.length > 0) {
            if (!await handleCurrentEditingSession(editingSession, phrase, dialogService)) {
                return false;
            }
            return { needToClearSession: true };
        }
        else {
            const confirmation = await dialogService.confirm({
                title: localize('agent.newSession', "Start new session?"),
                message: localize('agent.newSessionMessage', "Changing the chat mode will end your current edit session. Would you like to change the chat mode?"),
                primaryButton: localize('agent.newSession.confirm', "Yes"),
                type: 'info'
            });
            if (!confirmation.confirmed) {
                return false;
            }
            return { needToClearSession: true };
        }
    }
    return { needToClearSession: false };
}
export async function showClearEditingSessionConfirmation(editingSession, dialogService, options) {
    const defaultPhrase = localize('chat.startEditing.confirmation.pending.message.default', "Starting a new chat will end your current edit session.");
    const defaultTitle = localize('chat.startEditing.confirmation.title', "Start new chat?");
    const phrase = options?.messageOverride ?? defaultPhrase;
    const title = options?.titleOverride ?? defaultTitle;
    const currentEdits = editingSession.entries.get();
    const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
    const { result } = await dialogService.prompt({
        title,
        message: phrase + ' ' + localize('chat.startEditing.confirmation.pending.message.2', "Do you want to keep pending edits to {0} files?", undecidedEdits.length),
        type: 'info',
        cancelButton: true,
        buttons: [
            {
                label: localize('chat.startEditing.confirmation.acceptEdits', "Keep & Continue"),
                run: async () => {
                    await editingSession.accept();
                    return true;
                }
            },
            {
                label: localize('chat.startEditing.confirmation.discardEdits', "Undo & Continue"),
                run: async () => {
                    await editingSession.reject();
                    return true;
                }
            }
        ],
    });
    return Boolean(result);
}
export function shouldShowClearEditingSessionConfirmation(editingSession) {
    const currentEdits = editingSession.entries.get();
    const currentEditCount = currentEdits.length;
    if (currentEditCount) {
        const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
        return !!undecidedEdits.length;
    }
    return false;
}
// --- Chat Submenus in various Components
const menuContext = ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate());
const title = localize('copilot', "Copilot");
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
    submenu: MenuId.ChatTextEditorMenu,
    group: '1_copilot',
    title,
    when: menuContext
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
    submenu: MenuId.ChatExplorerMenu,
    group: '5_copilot',
    title,
    when: menuContext
});
MenuRegistry.appendMenuItem(MenuId.TerminalInstanceContext, {
    submenu: MenuId.ChatTerminalMenu,
    group: '2_copilot',
    title,
    when: menuContext
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxRQUFRLEVBQXVFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRXhELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDdkcsT0FBTyxFQUFFLFFB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