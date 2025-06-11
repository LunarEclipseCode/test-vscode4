/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatMode2, validateChatMode2 } from '../../common/chatModes.js';
import { chatVariableLeader } from '../../common/chatParserTypes.js';
import { IChatService } from '../../common/chatService.js';
import { ChatAgentLocation, ChatConfiguration, ChatMode, } from '../../common/constants.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { IChatWidgetService } from '../chat.js';
import { getEditingSessionContext } from '../chatEditing/chatEditingActions.js';
import { ACTION_ID_NEW_CHAT, CHAT_CATEGORY, handleCurrentEditingSession, handleModeSwitch } from './chatActions.js';
class SubmitAction extends Action2 {
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        widget?.acceptInput(context?.inputValue);
    }
}
const whenNotInProgressOrPaused = ContextKeyExpr.or(ChatContextKeys.isRequestPaused, ChatContextKeys.requestInProgress.negate());
export class ChatSubmitAction extends SubmitAction {
    static { this.ID = 'workbench.action.chat.submit'; }
    constructor() {
        const precondition = ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask);
        super({
            id: ChatSubmitAction.ID,
            title: localize2('interactive.submit.label', "Send and Dispatch"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.send,
            precondition,
            keybinding: {
                when: ChatContextKeys.inChatInput,
                primary: 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatExecuteSecondary,
                    group: 'group_1',
                    order: 1,
                    when: precondition
                },
                {
                    id: MenuId.ChatExecute,
                    order: 4,
                    when: ContextKeyExpr.and(whenNotInProgressOrPaused, precondition),
                    group: 'navigation',
                },
            ]
        });
    }
}
export const ToggleAgentModeActionId = 'workbench.action.chat.toggleAgentMode';
class ToggleChatModeAction extends Action2 {
    static { this.ID = ToggleAgentModeActionId; }
    constructor() {
        super({
            id: ToggleChatModeAction.ID,
            title: localize2('interactive.toggleAgent.label', "Set Chat Mode"),
            f1: true,
            category: CHAT_CATEGORY,
            precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.requestInProgress.negate()),
            tooltip: localize('setChatMode', "Set Mode"),
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel)),
                primary: 2048 /* KeyMod.CtrlCmd */ | 89 /* KeyCode.Period */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatInput,
                    order: 1,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel), ChatContextKeys.inQuickChat.negate()),
                    group: 'navigation',
                },
            ]
        });
    }
    async run(accessor, ...args) {
        const commandService = accessor.get(ICommandService);
        const configurationService = accessor.get(IConfigurationService);
        const instaService = accessor.get(IInstantiationService);
        const context = getEditingSessionContext(accessor, args);
        if (!context?.chatWidget) {
            return;
        }
        const arg = args.at(0);
        const chatSession = context.chatWidget.viewModel?.model;
        const requestCount = chatSession?.getRequests().length ?? 0;
        const switchToMode = validateChatMode2(arg?.mode) ?? this.getNextMode(context.chatWidget, requestCount, configurationService);
        if (switchToMode.id === context.chatWidget.input.currentMode2.id) {
            return;
        }
        const chatModeCheck = await instaService.invokeFunction(handleModeSwitch, context.chatWidget.input.currentMode, switchToMode.kind, requestCount, context.editingSession);
        if (!chatModeCheck) {
            return;
        }
        context.chatWidget.input.setChatMode2(switchToMode);
        if (chatModeCheck.needToClearSession) {
            await commandService.executeCommand(ACTION_ID_NEW_CHAT);
        }
    }
    getNextMode(chatWidget, requestCount, configurationService) {
        const modes = [ChatMode2.Ask];
        if (configurationService.getValue(ChatConfiguration.Edits2Enabled) || requestCount === 0) {
            modes.push(ChatMode2.Edit);
        }
        modes.push(ChatMode2.Agent);
        const modeIndex = modes.findIndex(mode => mode.id === chatWidget.input.currentMode2.id);
        const newMode = modes[(modeIndex + 1) % modes.length];
        return newMode;
    }
}
export const ToggleRequestPausedActionId = 'workbench.action.chat.toggleRequestPaused';
export class ToggleRequestPausedAction extends Action2 {
    static { this.ID = ToggleRequestPausedActionId; }
    constructor() {
        super({
            id: ToggleRequestPausedAction.ID,
            title: localize2('interactive.toggleRequestPausd.label', "Toggle Request Paused"),
            category: CHAT_CATEGORY,
            icon: Codicon.debugPause,
            toggled: {
                condition: ChatContextKeys.isRequestPaused,
                icon: Codicon.play,
                tooltip: localize('requestIsPaused', "Resume Request"),
            },
            tooltip: localize('requestNotPaused', "Pause Request"),
            menu: [
                {
                    id: MenuId.ChatExecute,
                    order: 3.5,
                    when: ContextKeyExpr.and(ChatContextKeys.canRequestBePaused, ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent), ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel), ContextKeyExpr.or(ChatContextKeys.isRequestPaused.negate(), ChatContextKeys.inputHasText.negate())),
                    group: 'navigation',
                },
            ]
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        widget?.togglePaused();
    }
}
class SwitchToNextModelAction extends Action2 {
    static { this.ID = 'workbench.action.chat.switchToNextModel'; }
    constructor() {
        super({
            id: SwitchToNextModelAction.ID,
            title: localize2('interactive.switchToNextModel.label', "Switch to Next Model"),
            category: CHAT_CATEGORY,
            f1: true,
            precondition: ChatContextKeys.enabled,
        });
    }
    run(accessor, ...args) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        widget?.input.switchToNextModel();
    }
}
export const ChatOpenModelPickerActionId = 'workbench.action.chat.openModelPicker';
class OpenModelPickerAction extends Action2 {
    static { this.ID = ChatOpenModelPickerActionId; }
    constructor() {
        super({
            id: OpenModelPickerAction.ID,
            title: localize2('interactive.openModelPicker.label', "Open Model Picker"),
            category: CHAT_CATEGORY,
            f1: false,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 89 /* KeyCode.Period */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: ChatContextKeys.inChatInput
            },
            precondition: ChatContextKeys.enabled,
            menu: {
                id: MenuId.ChatInput,
                order: 3,
                group: 'navigation',
                when: ContextKeyExpr.and(ChatContextKeys.languageModelsAreUserSelectable, ContextKeyExpr.or(ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Panel), ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Editor), ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Notebook), ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Terminal))),
            }
        });
    }
    async run(accessor, ...args) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        if (widget) {
            widget.input.openModelPicker();
        }
    }
}
export const ChangeChatModelActionId = 'workbench.action.chat.changeModel';
class ChangeChatModelAction extends Action2 {
    static { this.ID = ChangeChatModelActionId; }
    constructor() {
        super({
            id: ChangeChatModelAction.ID,
            title: localize2('interactive.changeModel.label', "Change Model"),
            category: CHAT_CATEGORY,
            f1: false,
            precondition: ChatContextKeys.enabled,
        });
    }
    run(accessor, ...args) {
        const modelInfo = args[0];
        // Type check the arg
        assertType(typeof modelInfo.vendor === 'string' && typeof modelInfo.id === 'string' && typeof modelInfo.family === 'string');
        const widgetService = accessor.get(IChatWidgetService);
        const widgets = widgetService.getAllWidgets();
        for (const widget of widgets) {
            widget.input.switchModel(modelInfo);
        }
    }
}
export class ChatEditingSessionSubmitAction extends SubmitAction {
    static { this.ID = 'workbench.action.edits.submit'; }
    constructor() {
        const precondition = ChatContextKeys.chatMode.notEqualsTo(ChatMode.Ask);
        super({
            id: ChatEditingSessionSubmitAction.ID,
            title: localize2('edits.submit.label', "Send"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.send,
            precondition,
            keybinding: {
                when: ChatContextKeys.inChatInput,
                primary: 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatExecuteSecondary,
                    group: 'group_1',
                    when: ContextKeyExpr.and(whenNotInProgressOrPaused, precondition),
                    order: 1
                },
                {
                    id: MenuId.ChatExecute,
                    order: 4,
                    when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.and(ChatContextKeys.isRequestPaused, ChatContextKeys.inputHasText), ChatContextKeys.requestInProgress.negate()), precondition),
                    group: 'navigation',
                },
            ]
        });
    }
}
class SubmitWithoutDispatchingAction extends Action2 {
    static { this.ID = 'workbench.action.chat.submitWithoutDispatching'; }
    constructor() {
        const precondition = ContextKeyExpr.and(
        // if the input has prompt instructions attached, allow submitting requests even
        // without text present - having instructions is enough context for a request
        ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.hasPromptFile), whenNotInProgressOrPaused, ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask));
        super({
            id: SubmitWithoutDispatchingAction.ID,
            title: localize2('interactive.submitWithoutDispatch.label', "Send"),
            f1: false,
            category: CHAT_CATEGORY,
            precondition,
            keybinding: {
                when: ChatContextKeys.inChatInput,
                primary: 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatExecuteSecondary,
                    group: 'group_1',
                    order: 2,
                    when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask),
                }
            ]
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        widget?.acceptInput(context?.inputValue, { noCommandDetection: true });
    }
}
export class ChatSubmitWithCodebaseAction extends Action2 {
    static { this.ID = 'workbench.action.chat.submitWithCodebase'; }
    constructor() {
        const precondition = ContextKeyExpr.and(
        // if the input has prompt instructions attached, allow submitting requests even
        // without text present - having instructions is enough context for a request
        ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.hasPromptFile), whenNotInProgressOrPaused);
        super({
            id: ChatSubmitWithCodebaseAction.ID,
            title: localize2('actions.chat.submitWithCodebase', "Send with {0}", `${chatVariableLeader}codebase`),
            precondition,
            menu: {
                id: MenuId.ChatExecuteSecondary,
                group: 'group_1',
                order: 3,
                when: ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Panel),
            },
            keybinding: {
                when: ChatContextKeys.inChatInput,
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const languageModelToolsService = accessor.get(ILanguageModelToolsService);
        const codebaseTool = languageModelToolsService.getToolByName('codebase');
        if (!codebaseTool) {
            return;
        }
        widget.input.attachmentModel.addContext({
            id: codebaseTool.id,
            name: codebaseTool.displayName ?? '',
            fullName: codebaseTool.displayName ?? '',
            value: undefined,
            icon: ThemeIcon.isThemeIcon(codebaseTool.icon) ? codebaseTool.icon : undefined,
            kind: 'tool'
        });
        widget.acceptInput();
    }
}
class SendToNewChatAction extends Action2 {
    constructor() {
        const precondition = ContextKeyExpr.and(
        // if the input has prompt instructions attached, allow submitting requests even
        // without text present - having instructions is enough context for a request
        ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.hasPromptFile), whenNotInProgressOrPaused);
        super({
            id: 'workbench.action.chat.sendToNewChat',
            title: localize2('chat.newChat.label', "Send to New Chat"),
            precondition,
            category: CHAT_CATEGORY,
            f1: false,
            menu: {
                id: MenuId.ChatExecuteSecondary,
                group: 'group_2',
                when: ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Panel)
            },
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
                when: ChatContextKeys.inChatInput,
            }
        });
    }
    async run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const dialogService = accessor.get(IDialogService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const editingSession = widget.viewModel?.model.editingSession;
        if (editingSession) {
            if (!(await handleCurrentEditingSession(editingSession, undefined, dialogService))) {
                return;
            }
        }
        widget.clear();
        await widget.waitForReady();
        widget.acceptInput(context?.inputValue);
    }
}
export const CancelChatActionId = 'workbench.action.chat.cancel';
export class CancelAction extends Action2 {
    static { this.ID = CancelChatActionId; }
    constructor() {
        super({
            id: CancelAction.ID,
            title: localize2('interactive.cancel.label', "Cancel"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.stopCircle,
            menu: {
                id: MenuId.ChatExecute,
                when: ContextKeyExpr.and(ChatContextKeys.isRequestPaused.negate(), ChatContextKeys.requestInProgress),
                order: 4,
                group: 'navigation',
            },
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 9 /* KeyCode.Escape */,
                win: { primary: 512 /* KeyMod.Alt */ | 1 /* KeyCode.Backspace */ },
            }
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const chatService = accessor.get(IChatService);
        if (widget.viewModel) {
            chatService.cancelCurrentRequestForSession(widget.viewModel.sessionId);
        }
    }
}
export function registerChatExecuteActions() {
    registerAction2(ChatSubmitAction);
    registerAction2(ChatEditingSessionSubmitAction);
    registerAction2(SubmitWithoutDispatchingAction);
    registerAction2(CancelAction);
    registerAction2(SendToNewChatAction);
    registerAction2(ChatSubmitWithCodebaseAction);
    registerAction2(ToggleChatModeAction);
    registerAction2(ToggleRequestPausedAction);
    registerAction2(SwitchToNextModelAction);
    registerAction2(OpenModelPickerAction);
    registerAction2(ChangeChatModelAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEV4ZWN1dGVBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0RXhlY3V0ZUFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNuRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFNBQVMsRUFBYSxpQkFBaUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3BGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxHQUFHLE1BQU0sMkJBQTJCLENBQUM7QUFFNUYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDdkYsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzdELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsMkJBQTJCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQVlwSCxNQUFlLFlBQWEsU0FBUSxPQUFPO0lBQzFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLEdBQUcsSUFBVztRQUM3QyxNQUFNLE9BQU8sR0FBMEMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRS9ELE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN2RCxNQUFNLE1BQU0sR0FBRyxPQUFPLEVBQUUsTUFBTSxJQUFJLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQztRQUNsRSxNQUFNLEVBQUUsV0FBVyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMxQyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLHlCQUF5QixHQUFHLGNBQWMsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxlQUFlLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUVqSSxNQUFNLE9BQU8sZ0JBQWlCLFNBQVEsWUFBWTthQUNqQyxPQUFFLEdBQUcsOEJBQThCLENBQUM7SUFFcEQ7UUFDQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFdEUsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLGdCQUFnQixDQUFDLEVBQUU7WUFDdkIsS0FBSyxFQUFFLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxtQkFBbUIsQ0FBQztZQUNqRSxFQUFFLEVBQUUsS0FBSztZQUNULFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNsQixZQUFZO1lBQ1osVUFBVSxFQUFFO2dCQUNYLElBQUksRUFBRSxlQUFlLENBQUMsV0FBVztnQkFDakMsT0FBTyx1QkFBZTtnQkFDdEIsTUFBTSwwQ0FBZ0M7YUFDdEM7WUFDRCxJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxvQkFBb0I7b0JBQy9CLEtBQUssRUFBRSxTQUFTO29CQUNoQixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsWUFBWTtpQkFDbEI7Z0JBQ0Q7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxXQUFXO29CQUN0QixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDdkIseUJBQXlCLEVBQ3pCLFlBQVksQ0FDWjtvQkFDRCxLQUFLLEVBQUUsWUFBWTtpQkFDbkI7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7O0FBR0YsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsdUNBQXVDLENBQUM7QUFNL0UsTUFBTSxvQkFBcUIsU0FBUSxPQUFPO2FBRXpCLE9BQUUsR0FBRyx1QkFBdUIsQ0FBQztJQUU3QztRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxvQkFBb0IsQ0FBQyxFQUFFO1lBQzNCLEtBQUssRUFBRSxTQUFTLENBQUMsK0JBQStCLEVBQUUsZUFBZSxDQUFDO1lBQ2xFLEVBQUUsRUFBRSxJQUFJO1lBQ1IsUUFBUSxFQUFFLGFBQWE7WUFDdkIsWUFBWSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQy9CLGVBQWUsQ0FBQyxPQUFPLEVBQ3ZCLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM1QyxPQUFPLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUM7WUFDNUMsVUFBVSxFQUFFO2dCQUNYLElBQUksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUN2QixlQUFlLENBQUMsV0FBVyxFQUMzQixlQUFlLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDN0QsT0FBTyxFQUFFLG1EQUErQjtnQkFDeEMsTUFBTSwwQ0FBZ0M7YUFDdEM7WUFDRCxJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxTQUFTO29CQUNwQixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDdkIsZUFBZSxDQUFDLE9BQU8sRUFDdkIsZUFBZSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQzNELGVBQWUsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQ3BDO29CQUNELEtBQUssRUFBRSxZQUFZO2lCQUNuQjthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEIsRUFBRSxHQUFHLElBQVc7UUFDbkQsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNyRCxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNqRSxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFFekQsTUFBTSxPQUFPLEdBQUcsd0JBQXdCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7WUFDMUIsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBb0MsQ0FBQztRQUMxRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUM7UUFDeEQsTUFBTSxZQUFZLEdBQUcsV0FBVyxFQUFFLFdBQVcsRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7UUFDNUQsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUU5SCxJQUFJLFlBQVksQ0FBQyxFQUFFLEtBQUssT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2xFLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxhQUFhLEdBQUcsTUFBTSxZQUFZLENBQUMsY0FBYyxDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDekssSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3BCLE9BQU87UUFDUixDQUFDO1FBRUQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXBELElBQUksYUFBYSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDdEMsTUFBTSxjQUFjLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDekQsQ0FBQztJQUNGLENBQUM7SUFFTyxXQUFXLENBQUMsVUFBdUIsRUFBRSxZQUFvQixFQUFFLG9CQUEyQztRQUM3RyxNQUFNLEtBQUssR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixJQUFJLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUYsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUNELEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTVCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLFVBQVUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEQsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQzs7QUFHRixNQUFNLENBQUMsTUFBTSwyQkFBMkIsR0FBRywyQ0FBMkMsQ0FBQztBQUN2RixNQUFNLE9BQU8seUJBQTBCLFNBQVEsT0FBTzthQUNyQyxPQUFFLEdBQUcsMkJBQTJCLENBQUM7SUFFakQ7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUseUJBQXlCLENBQUMsRUFBRTtZQUNoQyxLQUFLLEVBQUUsU0FBUyxDQUFDLHNDQUFzQyxFQUFFLHVCQUF1QixDQUFDO1lBQ2pGLFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVTtZQUN4QixPQUFPLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLGVBQWUsQ0FBQyxlQUFlO2dCQUMxQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxRQUFRLENBQUMsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUM7YUFDdEQ7WUFDRCxPQUFPLEVBQUUsUUFBUSxDQUFDLGtCQUFrQixFQUFFLGVBQWUsQ0FBQztZQUN0RCxJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxXQUFXO29CQUN0QixLQUFLLEVBQUUsR0FBRztvQkFDVixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDdkIsZUFBZSxDQUFDLGtCQUFrQixFQUNsQyxlQUFlLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQ2xELGVBQWUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUMzRCxjQUFjLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLEVBQUUsZUFBZSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUNsRztvQkFDRCxLQUFLLEVBQUUsWUFBWTtpQkFDbkI7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxHQUFHLENBQUMsUUFBMEIsRUFBRSxHQUFHLElBQVc7UUFDdEQsTUFBTSxPQUFPLEdBQTBDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsT0FBTyxFQUFFLE1BQU0sSUFBSSxhQUFhLENBQUMsaUJBQWlCLENBQUM7UUFDbEUsTUFBTSxFQUFFLFlBQVksRUFBRSxDQUFDO0lBQ3hCLENBQUM7O0FBR0YsTUFBTSx1QkFBd0IsU0FBUSxPQUFPO2FBQzVCLE9BQUUsR0FBRyx5Q0FBeUMsQ0FBQztJQUUvRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSx1QkFBdUIsQ0FBQyxFQUFFO1lBQzlCLEtBQUssRUFBRSxTQUFTLENBQUMscUNBQXFDLEVBQUUsc0JBQXNCLENBQUM7WUFDL0UsUUFBUSxFQUFFLGFBQWE7WUFDdkIsRUFBRSxFQUFFLElBQUk7WUFDUixZQUFZLEVBQUUsZUFBZSxDQUFDLE9BQU87U0FDckMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVRLEdBQUcsQ0FBQyxRQUEwQixFQUFFLEdBQUcsSUFBVztRQUN0RCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLGlCQUFpQixDQUFDO1FBQy9DLE1BQU0sRUFBRSxLQUFLLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUNuQyxDQUFDOztBQUdGLE1BQU0sQ0FBQyxNQUFNLDJCQUEyQixHQUFHLHVDQUF1QyxDQUFDO0FBQ25GLE1BQU0scUJBQXNCLFNBQVEsT0FBTzthQUMxQixPQUFFLEdBQUcsMkJBQTJCLENBQUM7SUFFakQ7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUscUJBQXFCLENBQUMsRUFBRTtZQUM1QixLQUFLLEVBQUUsU0FBUyxDQUFDLG1DQUFtQyxFQUFFLG1CQUFtQixDQUFDO1lBQzFFLFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLEVBQUUsRUFBRSxLQUFLO1lBQ1QsVUFBVSxFQUFFO2dCQUNYLE9BQU8sRUFBRSxnREFBMkIsMEJBQWlCO2dCQUNyRCxNQUFNLDZDQUFtQztnQkFDekMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxXQUFXO2FBQ2pDO1lBQ0QsWUFBWSxFQUFFLGVBQWUsQ0FBQyxPQUFPO1lBQ3JDLElBQUksRUFBRTtnQkFDTCxFQUFFLEVBQUUsTUFBTSxDQUFDLFNBQVM7Z0JBQ3BCLEtBQUssRUFBRSxDQUFDO2dCQUNSLEtBQUssRUFBRSxZQUFZO2dCQUNuQixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDdkIsZUFBZSxDQUFDLCtCQUErQixFQUMvQyxjQUFjLENBQUMsRUFBRSxDQUNoQixjQUFjLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUM1RSxjQUFjLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxFQUM3RSxjQUFjLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxFQUMvRSxjQUFjLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUMvRSxDQUNEO2FBQ0Q7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLEdBQUcsSUFBVztRQUM1RCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLGlCQUFpQixDQUFDO1FBQy9DLElBQUksTUFBTSxFQUFFLENBQUM7WUFDWixNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ2hDLENBQUM7SUFDRixDQUFDOztBQUdGLE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLG1DQUFtQyxDQUFDO0FBQzNFLE1BQU0scUJBQXNCLFNBQVEsT0FBTzthQUMxQixPQUFFLEdBQUcsdUJBQXVCLENBQUM7SUFFN0M7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUscUJBQXFCLENBQUMsRUFBRTtZQUM1QixLQUFLLEVBQUUsU0FBUyxDQUFDLCtCQUErQixFQUFFLGNBQWMsQ0FBQztZQUNqRSxRQUFRLEVBQUUsYUFBYTtZQUN2QixFQUFFLEVBQUUsS0FBSztZQUNULFlBQVksRUFBRSxlQUFlLENBQUMsT0FBTztTQUNyQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRVEsR0FBRyxDQUFDLFFBQTBCLEVBQUUsR0FBRyxJQUFXO1FBQ3RELE1BQU0sU0FBUyxHQUFpRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEYscUJBQXFCO1FBQ3JCLFVBQVUsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLEtBQUssUUFBUSxJQUFJLE9BQU8sU0FBUyxDQUFDLEVBQUUsS0FBSyxRQUFRLElBQUksT0FBTyxTQUFTLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBQzdILE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN2RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDOUMsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUM5QixNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyQyxDQUFDO0lBQ0YsQ0FBQzs7QUFHRixNQUFNLE9BQU8sOEJBQStCLFNBQVEsWUFBWTthQUMvQyxPQUFFLEdBQUcsK0JBQStCLENBQUM7SUFFckQ7UUFDQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFeEUsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLDhCQUE4QixDQUFDLEVBQUU7WUFDckMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxNQUFNLENBQUM7WUFDOUMsRUFBRSxFQUFFLEtBQUs7WUFDVCxRQUFRLEVBQUUsYUFBYTtZQUN2QixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7WUFDbEIsWUFBWTtZQUNaLFVBQVUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsZUFBZSxDQUFDLFdBQVc7Z0JBQ2pDLE9BQU8sdUJBQWU7Z0JBQ3RCLE1BQU0sMENBQWdDO2FBQ3RDO1lBQ0QsSUFBSSxFQUFFO2dCQUNMO29CQUNDLEVBQUUsRUFBRSxNQUFNLENBQUMsb0JBQW9CO29CQUMvQixLQUFLLEVBQUUsU0FBUztvQkFDaEIsSUFBSSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMseUJBQXlCLEVBQUUsWUFBWSxDQUFDO29CQUNqRSxLQUFLLEVBQUUsQ0FBQztpQkFDUjtnQkFDRDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLFdBQVc7b0JBQ3RCLEtBQUssRUFBRSxDQUFDO29CQUNSLElBQUksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUN2QixjQUFjLENBQUMsRUFBRSxDQUNoQixjQUFjLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLFlBQVksQ0FBQyxFQUNqRixlQUFlLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQzFDLEVBQ0QsWUFBWSxDQUFDO29CQUNkLEtBQUssRUFBRSxZQUFZO2lCQUNuQjthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQzs7QUFHRixNQUFNLDhCQUErQixTQUFRLE9BQU87YUFDbkMsT0FBRSxHQUFHLGdEQUFnRCxDQUFDO0lBRXRFO1FBQ0MsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDLEdBQUc7UUFDdEMsZ0ZBQWdGO1FBQ2hGLDZFQUE2RTtRQUM3RSxjQUFjLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLGFBQWEsQ0FBQyxFQUM5RSx5QkFBeUIsRUFDekIsZUFBZSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUNoRCxDQUFDO1FBRUYsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLDhCQUE4QixDQUFDLEVBQUU7WUFDckMsS0FBSyxFQUFFLFNBQVMsQ0FBQyx5Q0FBeUMsRUFBRSxNQUFNLENBQUM7WUFDbkUsRUFBRSxFQUFFLEtBQUs7WUFDVCxRQUFRLEVBQUUsYUFBYTtZQUN2QixZQUFZO1lBQ1osVUFBVSxFQUFFO2dCQUNYLElBQUksRUFBRSxlQUFlLENBQUMsV0FBVztnQkFDakMsT0FBTyxFQUFFLDhDQUF5Qix3QkFBZ0I7Z0JBQ2xELE1BQU0sMENBQWdDO2FBQ3RDO1lBQ0QsSUFBSSxFQUFFO2dCQUNMO29CQUNDLEVBQUUsRUFBRSxNQUFNLENBQUMsb0JBQW9CO29CQUMvQixLQUFLLEVBQUUsU0FBUztvQkFDaEIsS0FBSyxFQUFFLENBQUM7b0JBQ1IsSUFBSSxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUM7aUJBQ3REO2FBQ0Q7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsR0FBRyxDQUFDLFFBQTBCLEVBQUUsR0FBRyxJQUFXO1FBQzdDLE1BQU0sT0FBTyxHQUEwQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFL0QsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sTUFBTSxHQUFHLE9BQU8sRUFBRSxNQUFNLElBQUksYUFBYSxDQUFDLGlCQUFpQixDQUFDO1FBQ2xFLE1BQU0sRUFBRSxXQUFXLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDeEUsQ0FBQzs7QUFHRixNQUFNLE9BQU8sNEJBQTZCLFNBQVEsT0FBTzthQUN4QyxPQUFFLEdBQUcsMENBQTBDLENBQUM7SUFFaEU7UUFDQyxNQUFNLFlBQVksR0FBRyxjQUFjLENBQUMsR0FBRztRQUN0QyxnRkFBZ0Y7UUFDaEYsNkVBQTZFO1FBQzdFLGNBQWMsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLENBQUMsYUFBYSxDQUFDLEVBQzlFLHlCQUF5QixDQUN6QixDQUFDO1FBRUYsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLDRCQUE0QixDQUFDLEVBQUU7WUFDbkMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxpQ0FBaUMsRUFBRSxlQUFlLEVBQUUsR0FBRyxrQkFBa0IsVUFBVSxDQUFDO1lBQ3JHLFlBQVk7WUFDWixJQUFJLEVBQUU7Z0JBQ0wsRUFBRSxFQUFFLE1BQU0sQ0FBQyxvQkFBb0I7Z0JBQy9CLEtBQUssRUFBRSxTQUFTO2dCQUNoQixLQUFLLEVBQUUsQ0FBQztnQkFDUixJQUFJLEVBQUUsY0FBYyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7YUFDbEY7WUFDRCxVQUFVLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLGVBQWUsQ0FBQyxXQUFXO2dCQUNqQyxPQUFPLEVBQUUsaURBQThCO2dCQUN2QyxNQUFNLDBDQUFnQzthQUN0QztTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxHQUFHLENBQUMsUUFBMEIsRUFBRSxHQUFHLElBQVc7UUFDN0MsTUFBTSxPQUFPLEdBQTBDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUvRCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsT0FBTyxFQUFFLE1BQU0sSUFBSSxhQUFhLENBQUMsaUJBQWlCLENBQUM7UUFDbEUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLHlCQUF5QixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUMzRSxNQUFNLFlBQVksR0FBRyx5QkFBeUIsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25CLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDO1lBQ3ZDLEVBQUUsRUFBRSxZQUFZLENBQUMsRUFBRTtZQUNuQixJQUFJLEVBQUUsWUFBWSxDQUFDLFdBQVcsSUFBSSxFQUFFO1lBQ3BDLFFBQVEsRUFBRSxZQUFZLENBQUMsV0FBVyxJQUFJLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFNBQVM7WUFDaEIsSUFBSSxFQUFFLFNBQVMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQzlFLElBQUksRUFBRSxNQUFNO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3RCLENBQUM7O0FBR0YsTUFBTSxtQkFBb0IsU0FBUSxPQUFPO0lBQ3hDO1FBQ0MsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDLEdBQUc7UUFDdEMsZ0ZBQWdGO1FBQ2hGLDZFQUE2RTtRQUM3RSxjQUFjLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLGFBQWEsQ0FBQyxFQUM5RSx5QkFBeUIsQ0FDekIsQ0FBQztRQUVGLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxxQ0FBcUM7WUFDekMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQztZQUMxRCxZQUFZO1lBQ1osUUFBUSxFQUFFLGFBQWE7WUFDdkIsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUU7Z0JBQ0wsRUFBRSxFQUFFLE1BQU0sQ0FBQyxvQkFBb0I7Z0JBQy9CLEtBQUssRUFBRSxTQUFTO2dCQUNoQixJQUFJLEVBQUUsY0FBYyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7YUFFbEY7WUFDRCxVQUFVLEVBQUU7Z0JBQ1gsTUFBTSw2Q0FBbUM7Z0JBQ3pDLE9BQU8sRUFBRSxtREFBNkIsd0JBQWdCO2dCQUN0RCxJQUFJLEVBQUUsZUFBZSxDQUFDLFdBQVc7YUFDakM7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLEdBQUcsSUFBVztRQUNuRCxNQUFNLE9BQU8sR0FBMEMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRS9ELE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN2RCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sTUFBTSxHQUFHLE9BQU8sRUFBRSxNQUFNLElBQUksYUFBYSxDQUFDLGlCQUFpQixDQUFDO1FBQ2xFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsY0FBYyxDQUFDO1FBQzlELElBQUksY0FBYyxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLENBQUMsTUFBTSwyQkFBMkIsQ0FBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDcEYsT0FBTztZQUNSLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDNUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDekMsQ0FBQztDQUNEO0FBRUQsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsOEJBQThCLENBQUM7QUFDakUsTUFBTSxPQUFPLFlBQWEsU0FBUSxPQUFPO2FBQ3hCLE9BQUUsR0FBRyxrQkFBa0IsQ0FBQztJQUN4QztRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxZQUFZLENBQUMsRUFBRTtZQUNuQixLQUFLLEVBQUUsU0FBUyxDQUFDLDBCQUEwQixFQUFFLFFBQVEsQ0FBQztZQUN0RCxFQUFFLEVBQUUsS0FBSztZQUNULFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVTtZQUN4QixJQUFJLEVBQUU7Z0JBQ0wsRUFBRSxFQUFFLE1BQU0sQ0FBQyxXQUFXO2dCQUN0QixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQztnQkFDckcsS0FBSyxFQUFFLENBQUM7Z0JBQ1IsS0FBSyxFQUFFLFlBQVk7YUFDbkI7WUFDRCxVQUFVLEVBQUU7Z0JBQ1gsTUFBTSw2Q0FBbUM7Z0JBQ3pDLE9BQU8sRUFBRSxrREFBK0I7Z0JBQ3hDLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSxnREFBOEIsRUFBRTthQUNoRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxHQUFHLENBQUMsUUFBMEIsRUFBRSxHQUFHLElBQVc7UUFDN0MsTUFBTSxPQUFPLEdBQTBDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUvRCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsT0FBTyxFQUFFLE1BQU0sSUFBSSxhQUFhLENBQUMsaUJBQWlCLENBQUM7UUFDbEUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQy9DLElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3RCLFdBQVcsQ0FBQyw4QkFBOEIsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7SUFDRixDQUFDOztBQUdGLE1BQU0sVUFBVSwwQkFBMEI7SUFDekMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDbEMsZUFBZSxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFDaEQsZUFBZSxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFDaEQsZUFBZSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzlCLGVBQWUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQ3JDLGVBQWUsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0lBQzlDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3RDLGVBQWUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzNDLGVBQWUsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0lBQ3pDLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3ZDLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3hDLENBQUMifQ==