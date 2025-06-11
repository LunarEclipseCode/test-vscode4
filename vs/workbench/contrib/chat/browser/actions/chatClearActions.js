/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize2 } from '../../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { ActiveEditorContext } from '../../../../common/contextkeys.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatMode } from '../../common/constants.js';
import { ChatViewId } from '../chat.js';
import { EditingSessionAction } from '../chatEditing/chatEditingActions.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { ACTION_ID_NEW_CHAT, ACTION_ID_NEW_EDIT_SESSION, CHAT_CATEGORY, handleCurrentEditingSession } from './chatActions.js';
import { clearChatEditor } from './chatClear.js';
export function registerNewChatActions() {
    registerAction2(class NewChatEditorAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chatEditor.newChat',
                title: localize2('chat.newChat.label', "New Chat"),
                icon: Codicon.plus,
                f1: false,
                precondition: ChatContextKeys.enabled,
                menu: [MenuId.EditorTitle, MenuId.CompactWindowEditorTitle].map(id => ({
                    id,
                    group: 'navigation',
                    when: ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID),
                    order: 1
                }))
            });
        }
        async run(accessor, ...args) {
            announceChatCleared(accessor.get(IAccessibilitySignalService));
            await clearChatEditor(accessor);
        }
    });
    registerAction2(class NewChatAction extends EditingSessionAction {
        constructor() {
            super({
                id: ACTION_ID_NEW_CHAT,
                title: localize2('chat.newEdits.label', "New Chat"),
                category: CHAT_CATEGORY,
                icon: Codicon.plus,
                precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
                f1: true,
                menu: [{
                        id: MenuId.ChatContext,
                        group: 'z_clear'
                    },
                    {
                        id: MenuId.ViewTitle,
                        when: ContextKeyExpr.equals('view', ChatViewId),
                        group: 'navigation',
                        order: -1
                    }],
                keybinding: {
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 42 /* KeyCode.KeyL */,
                    mac: {
                        primary: 256 /* KeyMod.WinCtrl */ | 42 /* KeyCode.KeyL */
                    },
                    when: ChatContextKeys.inChatSession
                }
            });
        }
        async runEditingSessionAction(accessor, editingSession, widget, ...args) {
            const context = args[0];
            const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
            const dialogService = accessor.get(IDialogService);
            if (!(await handleCurrentEditingSession(editingSession, undefined, dialogService))) {
                return;
            }
            announceChatCleared(accessibilitySignalService);
            await editingSession.stop();
            widget.clear();
            await widget.waitForReady();
            widget.attachmentModel.clear(true);
            widget.input.relatedFiles?.clear();
            widget.focusInput();
            if (!context) {
                return;
            }
            if (typeof context.agentMode === 'boolean') {
                widget.input.setChatMode(context.agentMode ? ChatMode.Agent : ChatMode.Edit);
            }
            if (context.inputValue) {
                if (context.isPartialQuery) {
                    widget.setInput(context.inputValue);
                }
                else {
                    widget.acceptInput(context.inputValue);
                }
            }
        }
    });
    CommandsRegistry.registerCommandAlias(ACTION_ID_NEW_EDIT_SESSION, ACTION_ID_NEW_CHAT);
    registerAction2(class UndoChatEditInteractionAction extends EditingSessionAction {
        constructor() {
            super({
                id: 'workbench.action.chat.undoEdit',
                title: localize2('chat.undoEdit.label', "Undo Last Request"),
                category: CHAT_CATEGORY,
                icon: Codicon.discard,
                precondition: ContextKeyExpr.and(ChatContextKeys.chatEditingCanUndo, ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
                f1: true,
                menu: [{
                        id: MenuId.ViewTitle,
                        when: ContextKeyExpr.equals('view', ChatViewId),
                        group: 'navigation',
                        order: -3
                    }]
            });
        }
        async runEditingSessionAction(accessor, editingSession) {
            await editingSession.undoInteraction();
        }
    });
    registerAction2(class RedoChatEditInteractionAction extends EditingSessionAction {
        constructor() {
            super({
                id: 'workbench.action.chat.redoEdit',
                title: localize2('chat.redoEdit.label', "Redo Last Request"),
                category: CHAT_CATEGORY,
                icon: Codicon.redo,
                precondition: ContextKeyExpr.and(ChatContextKeys.chatEditingCanRedo, ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
                f1: true,
                menu: [{
                        id: MenuId.ViewTitle,
                        when: ContextKeyExpr.equals('view', ChatViewId),
                        group: 'navigation',
                        order: -2
                    }]
            });
        }
        async runEditingSessionAction(accessor, editingSession) {
            await editingSession.redoInteraction();
        }
    });
}
function announceChatCleared(accessibilitySignalService) {
    accessibilitySignalService.playSignal(AccessibilitySignal.clear);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENsZWFyQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FjdGlvbnMvY2hhdENsZWFyQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFHakUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG1GQUFtRixDQUFDO0FBQ3JKLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFbkYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0sWUFBWSxDQUFDO0FBQ3JELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsMEJBQTBCLEVBQUUsYUFBYSxFQUFFLDJCQUEyQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDOUgsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBb0JqRCxNQUFNLFVBQVUsc0JBQXNCO0lBQ3JDLGVBQWUsQ0FBQyxNQUFNLG1CQUFvQixTQUFRLE9BQU87UUFDeEQ7WUFDQyxLQUFLLENBQUM7Z0JBQ0wsRUFBRSxFQUFFLHFDQUFxQztnQkFDekMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxVQUFVLENBQUM7Z0JBQ2xELElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtnQkFDbEIsRUFBRSxFQUFFLEtBQUs7Z0JBQ1QsWUFBWSxFQUFFLGVBQWUsQ0FBQyxPQUFPO2dCQUNyQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ3RFLEVBQUU7b0JBQ0YsS0FBSyxFQUFFLFlBQVk7b0JBQ25CLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQztvQkFDN0QsS0FBSyxFQUFFLENBQUM7aUJBQ1IsQ0FBQyxDQUFDO2FBQ0gsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEIsRUFBRSxHQUFHLElBQVc7WUFDbkQsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7WUFDL0QsTUFBTSxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakMsQ0FBQztLQUNELENBQUMsQ0FBQztJQUVILGVBQWUsQ0FBQyxNQUFNLGFBQWMsU0FBUSxvQkFBb0I7UUFDL0Q7WUFDQyxLQUFLLENBQUM7Z0JBQ0wsRUFBRSxFQUFFLGtCQUFrQjtnQkFDdEIsS0FBSyxFQUFFLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxVQUFVLENBQUM7Z0JBQ25ELFFBQVEsRUFBRSxhQUFhO2dCQUN2QixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7Z0JBQ2xCLFlBQVksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDLDRCQUE0QixDQUFDO2dCQUN2RyxFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsQ0FBQzt3QkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLFdBQVc7d0JBQ3RCLEtBQUssRUFBRSxTQUFTO3FCQUNoQjtvQkFDRDt3QkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLFNBQVM7d0JBQ3BCLElBQUksRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUM7d0JBQy9DLEtBQUssRUFBRSxZQUFZO3dCQUNuQixLQUFLLEVBQUUsQ0FBQyxDQUFDO3FCQUNULENBQUM7Z0JBQ0YsVUFBVSxFQUFFO29CQUNYLE1BQU0sNkNBQW1DO29CQUN6QyxPQUFPLEVBQUUsaURBQTZCO29CQUN0QyxHQUFHLEVBQUU7d0JBQ0osT0FBTyxFQUFFLGdEQUE2QjtxQkFDdEM7b0JBQ0QsSUFBSSxFQUFFLGVBQWUsQ0FBQyxhQUFhO2lCQUNuQzthQUNELENBQUMsQ0FBQztRQUNKLENBQUM7UUFHRCxLQUFLLENBQUMsdUJBQXVCLENBQUMsUUFBMEIsRUFBRSxjQUFtQyxFQUFFLE1BQW1CLEVBQUUsR0FBRyxJQUFXO1lBQ2pJLE1BQU0sT0FBTyxHQUE2QyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEUsTUFBTSwwQkFBMEIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7WUFDN0UsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUVuRCxJQUFJLENBQUMsQ0FBQyxNQUFNLDJCQUEyQixDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNwRixPQUFPO1lBQ1IsQ0FBQztZQUVELG1CQUFtQixDQUFDLDBCQUEwQixDQUFDLENBQUM7WUFFaEQsTUFBTSxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDNUIsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2YsTUFBTSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDNUIsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkMsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUM7WUFDbkMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBRXBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZCxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksT0FBTyxPQUFPLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUM1QyxNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUUsQ0FBQztZQUVELElBQUksT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUN4QixJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDNUIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3JDLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDeEMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO0tBQ0QsQ0FBQyxDQUFDO0lBQ0gsZ0JBQWdCLENBQUMsb0JBQW9CLENBQUMsMEJBQTBCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUd0RixlQUFlLENBQUMsTUFBTSw2QkFBOEIsU0FBUSxvQkFBb0I7UUFDL0U7WUFDQyxLQUFLLENBQUM7Z0JBQ0wsRUFBRSxFQUFFLGdDQUFnQztnQkFDcEMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxtQkFBbUIsQ0FBQztnQkFDNUQsUUFBUSxFQUFFLGFBQWE7Z0JBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsT0FBTztnQkFDckIsWUFBWSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDLDRCQUE0QixDQUFDO2dCQUMzSSxFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsQ0FBQzt3QkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLFNBQVM7d0JBQ3BCLElBQUksRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUM7d0JBQy9DLEtBQUssRUFBRSxZQUFZO3dCQUNuQixLQUFLLEVBQUUsQ0FBQyxDQUFDO3FCQUNULENBQUM7YUFDRixDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsS0FBSyxDQUFDLHVCQUF1QixDQUFDLFFBQTBCLEVBQUUsY0FBbUM7WUFDNUYsTUFBTSxjQUFjLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDeEMsQ0FBQztLQUNELENBQUMsQ0FBQztJQUVILGVBQWUsQ0FBQyxNQUFNLDZCQUE4QixTQUFRLG9CQUFvQjtRQUMvRTtZQUNDLEtBQUssQ0FBQztnQkFDTCxFQUFFLEVBQUUsZ0NBQWdDO2dCQUNwQyxLQUFLLEVBQUUsU0FBUyxDQUFDLHFCQUFxQixFQUFFLG1CQUFtQixDQUFDO2dCQUM1RCxRQUFRLEVBQUUsYUFBYTtnQkFDdkIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO2dCQUNsQixZQUFZLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEVBQUUsZUFBZSxDQUFDLE9BQU8sRUFBRSxlQUFlLENBQUMsNEJBQTRCLENBQUM7Z0JBQzNJLEVBQUUsRUFBRSxJQUFJO2dCQUNSLElBQUksRUFBRSxDQUFDO3dCQUNOLEVBQUUsRUFBRSxNQUFNLENBQUMsU0FBUzt3QkFDcEIsSUFBSSxFQUFFLGNBQWMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQzt3QkFDL0MsS0FBSyxFQUFFLFlBQVk7d0JBQ25CLEtBQUssRUFBRSxDQUFDLENBQUM7cUJBQ1QsQ0FBQzthQUNGLENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxLQUFLLENBQUMsdUJBQXVCLENBQUMsUUFBMEIsRUFBRSxjQUFtQztZQUM1RixNQUFNLGNBQWMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN4QyxDQUFDO0tBQ0QsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsMEJBQXVEO0lBQ25GLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNsRSxDQUFDIn0=