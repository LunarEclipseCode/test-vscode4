/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { localize, localize2 } from '../../../../../nls.js';
import { PromptsConfig } from '../../common/promptSyntax/config/config.js';
import { PromptFilePickers } from './pickers/promptFilePickers.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ChatViewId } from '../chat.js';
/**
 * Action ID for the `Configure Custom Chat Mode` action.
 */
const COMFIGURE_MODES_ACTION_ID = 'workbench.action.chat.manage.mode';
class ManageModeAction extends Action2 {
    constructor() {
        super({
            id: COMFIGURE_MODES_ACTION_ID,
            title: localize2('configure-modes', "Configure Chat Modes"),
            shortTitle: localize('manage-mode', "Configure Modes"),
            icon: Codicon.bookmark,
            f1: true,
            precondition: ContextKeyExpr.and(PromptsConfig.enabledCtx, ChatContextKeys.enabled),
            category: CHAT_CATEGORY,
            menu: [
                {
                    id: MenuId.ChatModePicker,
                    when: ChatContextKeys.Modes.hasCustomChatModes
                }, {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.equals('view', ChatViewId),
                    order: 12,
                    group: '2_manage'
                }
            ]
        });
    }
    async run(accessor) {
        const openerService = accessor.get(IOpenerService);
        const instaService = accessor.get(IInstantiationService);
        const pickers = instaService.createInstance(PromptFilePickers);
        const placeholder = localize('commands.mode.select-dialog.placeholder', 'Select the chat mode file to open');
        const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.mode, optionEdit: false });
        if (result !== undefined) {
            await openerService.open(result.promptFile);
        }
    }
}
/**
 * Helper to register all the `Run Current Prompt` actions.
 */
export function registerChatModeActions() {
    registerAction2(ManageModeAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvcHJvbXB0U3ludGF4L2NoYXRNb2RlQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDMUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVuRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDekYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDckcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNqRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXhDOztHQUVHO0FBQ0gsTUFBTSx5QkFBeUIsR0FBRyxtQ0FBbUMsQ0FBQztBQUV0RSxNQUFNLGdCQUFpQixTQUFRLE9BQU87SUFDckM7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUseUJBQXlCO1lBQzdCLEtBQUssRUFBRSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsc0JBQXNCLENBQUM7WUFDM0QsVUFBVSxFQUFFLFFBQVEsQ0FBQyxhQUFhLEVBQUUsaUJBQWlCLENBQUM7WUFDdEQsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1lBQ3RCLEVBQUUsRUFBRSxJQUFJO1lBQ1IsWUFBWSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDO1lBQ25GLFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLElBQUksRUFBRTtnQkFDTDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLGNBQWM7b0JBQ3pCLElBQUksRUFBRSxlQUFlLENBQUMsS0FBSyxDQUFDLGtCQUFrQjtpQkFDOUMsRUFBRTtvQkFDRixFQUFFLEVBQUUsTUFBTSxDQUFDLFNBQVM7b0JBQ3BCLElBQUksRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUM7b0JBQy9DLEtBQUssRUFBRSxFQUFFO29CQUNULEtBQUssRUFBRSxVQUFVO2lCQUNqQjthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVlLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDbkQsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNuRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFFekQsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRS9ELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FDM0IseUNBQXlDLEVBQ3pDLG1DQUFtQyxDQUNuQyxDQUFDO1FBRUYsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDMUcsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDMUIsTUFBTSxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM3QyxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsdUJBQXVCO0lBQ3RDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ25DLENBQUMifQ==