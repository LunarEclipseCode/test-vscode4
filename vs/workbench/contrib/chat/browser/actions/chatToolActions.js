/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { ChatMode } from '../../common/constants.js';
import { ToolSet } from '../../common/languageModelToolsService.js';
import { IChatWidgetService } from '../chat.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { showToolsPicker } from './chatToolPicker.js';
export const AcceptToolConfirmationActionId = 'workbench.action.chat.acceptTool';
class AcceptToolConfirmation extends Action2 {
    constructor() {
        super({
            id: AcceptToolConfirmationActionId,
            title: localize2('chat.accept', "Accept"),
            f1: false,
            category: CHAT_CATEGORY,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.Editing.hasToolConfirmation),
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                // Override chatEditor.action.accept
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
            },
        });
    }
    run(accessor, ...args) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = chatWidgetService.lastFocusedWidget;
        const lastItem = widget?.viewModel?.getItems().at(-1);
        if (!isResponseVM(lastItem)) {
            return;
        }
        const unconfirmedToolInvocation = lastItem.model.response.value.find((item) => item.kind === 'toolInvocation' && !item.isConfirmed);
        if (unconfirmedToolInvocation) {
            unconfirmedToolInvocation.confirmed.complete(true);
        }
        // Return focus to the chat input, in case it was in the tool confirmation editor
        widget?.focusInput();
    }
}
class ConfigureToolsAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.configureTools',
            title: localize('label', "Configure Tools..."),
            icon: Codicon.tools,
            f1: false,
            category: CHAT_CATEGORY,
            precondition: ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent),
            menu: {
                when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent),
                id: MenuId.ChatExecute,
                group: 'navigation',
                order: 1,
            }
        });
    }
    async run(accessor, ...args) {
        const instaService = accessor.get(IInstantiationService);
        const chatWidgetService = accessor.get(IChatWidgetService);
        const telemetryService = accessor.get(ITelemetryService);
        let widget = chatWidgetService.lastFocusedWidget;
        if (!widget) {
            function isChatActionContext(obj) {
                return obj && typeof obj === 'object' && obj.widget;
            }
            const context = args[0];
            if (isChatActionContext(context)) {
                widget = context.widget;
            }
        }
        if (!widget) {
            return;
        }
        await instaService.invokeFunction(showToolsPicker, localize('placeholder', "Select tools that are available to chat"), widget.input.selectedToolsModel.entriesMap, newEntriesMap => {
            const disableToolSets = [];
            const disableTools = [];
            for (const [item, enabled] of newEntriesMap) {
                if (!enabled) {
                    if (item instanceof ToolSet) {
                        disableToolSets.push(item);
                    }
                    else {
                        disableTools.push(item);
                    }
                }
            }
            widget.input.selectedToolsModel.disable(disableToolSets, disableTools, false);
        });
        telemetryService.publicLog2('chat/selectedTools', {
            total: widget.input.selectedToolsModel.entriesMap.size,
            enabled: widget.input.selectedToolsModel.entries.get().size,
        });
    }
}
export function registerChatToolActions() {
    registerAction2(AcceptToolConfirmation);
    registerAction2(ConfigureToolsAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0VG9vbEFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBR2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDckcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRXRHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUVsRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDN0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3JELE9BQU8sRUFBYSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMvRSxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDN0QsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQWN0RCxNQUFNLENBQUMsTUFBTSw4QkFBOEIsR0FBRyxrQ0FBa0MsQ0FBQztBQUVqRixNQUFNLHNCQUF1QixTQUFRLE9BQU87SUFDM0M7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVB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