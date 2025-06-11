/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { getCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { SnippetController2 } from '../../../../../editor/contrib/snippet/browser/snippetController2.js';
import { localize } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService, NeverShowAgainScope, Severity } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { PromptsConfig } from '../../common/promptSyntax/config/config.js';
import { getLanguageIdForPromptsType, PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { IUserDataSyncEnablementService } from '../../../../../platform/userDataSync/common/userDataSync.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { CONFIGURE_SYNC_COMMAND_ID } from '../../../../services/userDataSync/common/userDataSync.js';
import { ISnippetsService } from '../../../snippets/browser/snippets.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { askForPromptFileName } from './pickers/askForPromptName.js';
import { askForPromptSourceFolder } from './pickers/askForPromptSourceFolder.js';
class AbstractNewPromptFileAction extends Action2 {
    constructor(id, title, type) {
        super({
            id,
            title,
            f1: false,
            precondition: ContextKeyExpr.and(PromptsConfig.enabledCtx, ChatContextKeys.enabled),
            category: CHAT_CATEGORY,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(PromptsConfig.enabledCtx, ChatContextKeys.enabled)
            }
        });
        this.type = type;
    }
    async run(accessor) {
        const logService = accessor.get(ILogService);
        const openerService = accessor.get(IOpenerService);
        const commandService = accessor.get(ICommandService);
        const notificationService = accessor.get(INotificationService);
        const userDataSyncEnablementService = accessor.get(IUserDataSyncEnablementService);
        const snippetService = accessor.get(ISnippetsService);
        const editorService = accessor.get(IEditorService);
        const fileService = accessor.get(IFileService);
        const instaService = accessor.get(IInstantiationService);
        const selectedFolder = await instaService.invokeFunction(askForPromptSourceFolder, this.type);
        if (!selectedFolder) {
            return;
        }
        const fileName = await instaService.invokeFunction(askForPromptFileName, this.type, selectedFolder.uri);
        if (!fileName) {
            return;
        }
        // create the prompt file
        await fileService.createFolder(selectedFolder.uri);
        const promptUri = URI.joinPath(selectedFolder.uri, fileName);
        await fileService.createFile(promptUri);
        await openerService.open(promptUri);
        const editor = getCodeEditor(editorService.activeTextEditorControl);
        if (editor && editor.hasModel() && isEqual(editor.getModel().uri, promptUri)) {
            const languageId = getLanguageIdForPromptsType(this.type);
            const snippets = await snippetService.getSnippets(languageId, { fileTemplateSnippets: true, noRecencySort: true, includeNoPrefixSnippets: true });
            if (snippets.length > 0) {
                SnippetController2.get(editor)?.apply([{
                        range: editor.getModel().getFullModelRange(),
                        template: snippets[0].body
                    }]);
            }
        }
        if (selectedFolder.storage !== 'user') {
            return;
        }
        // due to PII concerns, synchronization of the 'user' reusable prompts
        // is disabled by default, but we want to make that fact clear to the user
        // hence after a 'user' prompt is create, we check if the synchronization
        // was explicitly configured before, and if it wasn't, we show a suggestion
        // to enable the synchronization logic in the Settings Sync configuration
        const isConfigured = userDataSyncEnablementService
            .isResourceEnablementConfigured("prompts" /* SyncResource.Prompts */);
        const isSettingsSyncEnabled = userDataSyncEnablementService.isEnabled();
        // if prompts synchronization has already been configured before or
        // if settings sync service is currently disabled, nothing to do
        if ((isConfigured === true) || (isSettingsSyncEnabled === false)) {
            return;
        }
        // show suggestion to enable synchronization of the user prompts and instructions to the user
        notificationService.prompt(Severity.Info, localize('workbench.command.prompts.create.user.enable-sync-notification', "Do you want to backup and sync your user prompt, instruction and mode files with Setting Sync?'"), [
            {
                label: localize('enable.capitalized', "Enable"),
                run: () => {
                    commandService.executeCommand(CONFIGURE_SYNC_COMMAND_ID)
                        .catch((error) => {
                        logService.error(`Failed to run '${CONFIGURE_SYNC_COMMAND_ID}' command: ${error}.`);
                    });
                },
            },
            {
                label: localize('learnMore.capitalized', "Learn More"),
                run: () => {
                    openerService.open(URI.parse('https://aka.ms/vscode-settings-sync-help'));
                },
            },
        ], {
            neverShowAgain: {
                id: 'workbench.command.prompts.create.user.enable-sync-notification',
                scope: NeverShowAgainScope.PROFILE,
            },
        });
    }
}
export const NEW_PROMPT_COMMAND_ID = 'workbench.command.new.prompt';
export const NEW_INSTRUCTIONS_COMMAND_ID = 'workbench.command.new.instructions';
export const NEW_MODE_COMMAND_ID = 'workbench.command.new.mode';
class NewPromptFileAction extends AbstractNewPromptFileAction {
    constructor() {
        super(NEW_PROMPT_COMMAND_ID, localize('commands.new.prompt.local.title', "New Prompt File..."), PromptsType.prompt);
    }
}
class NewInstructionsFileAction extends AbstractNewPromptFileAction {
    constructor() {
        super(NEW_INSTRUCTIONS_COMMAND_ID, localize('commands.new.instructions.local.title', "New Instructions File..."), PromptsType.instructions);
    }
}
class NewModeFileAction extends AbstractNewPromptFileAction {
    constructor() {
        super(NEW_MODE_COMMAND_ID, localize('commands.new.mode.local.title', "New Mode File..."), PromptsType.mode);
    }
}
export function registerNewPromptFileActions() {
    registerAction2(NewPromptFileAction);
    registerAction2(NewInstructionsFileAction);
    registerAction2(NewModeFileAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV3UHJvbXB0RmlsZUFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvbmV3UHJvbXB0RmlsZUFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDekcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDekYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSwrREFBK0QsQ0FBQztBQUV4SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDeEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNqRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDM0UsT0FBTyxFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSw4QkFBOEIsRUFBZ0IsTUFBTSw2REFBNkQsQ0FBQztBQUMzSCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDckcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNyRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUdqRixNQUFNLDJCQUE0QixTQUFRLE9BQU87SUFFaEQsWUFBWSxFQUFVLEVBQUUsS0FBYSxFQUFtQixJQUFpQjtRQUN4RSxLQUFLLENBQUM7WUFDTCxFQUFFO1lBQ0YsS0FBSztZQUNMLEVBQUUsRUFBRSxLQUFLO1lBQ1QsWUFBWSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDO1lBQ25GLFFBQVEsRUFBRSxhQUFhO1lBQ3ZCLFVBQVUsRUFBRTtnQkFDWCxNQUFNLDZDQUFtQzthQUN6QztZQUNELElBQUksRUFBRTtnQkFDTCxFQUFFLEVBQUUsTUFBTSxDQUFDLGNBQWM7Z0JBQ3pCLElBQUksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsZUFBZSxDQUFDLE9BQU8sQ0FBQzthQUMzRTtTQUNELENBQUMsQ0FBQztRQWRvRCxTQUFJLEdBQUosSUFBSSxDQUFhO0lBZXpFLENBQUM7SUFFZSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCO1FBQ25ELE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDN0MsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNuRCxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3JELE1BQU0sbUJBQW1CLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sNkJBQTZCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ25GLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN0RCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDL0MsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRXpELE1BQU0sY0FBYyxHQUFHLE1BQU0sWUFBWSxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUYsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3JCLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxZQUFZLENBQUMsY0FBYyxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE9BQU87UUFDUixDQUFDO1FBRUQseUJBQXlCO1FBRXpCLE1BQU0sV0FBVyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFbkQsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzdELE1BQU0sV0FBVyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV4QyxNQUFNLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFcEMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3BFLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQzlFLE1BQU0sVUFBVSxHQUFHLDJCQUEyQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUxRCxNQUFNLFFBQVEsR0FBRyxNQUFNLGNBQWMsQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsdUJBQXVCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNsSixJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDdEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRTt3QkFDNUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO3FCQUMxQixDQUFDLENBQUMsQ0FBQztZQUNMLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxjQUFjLENBQUMsT0FBTyxLQUFLLE1BQU0sRUFBRSxDQUFDO1lBQ3ZDLE9BQU87UUFDUixDQUFDO1FBRUQsc0VBQXNFO1FBQ3RFLDBFQUEwRTtRQUMxRSx5RUFBeUU7UUFDekUsMkVBQTJFO1FBQzNFLHlFQUF5RTtRQUV6RSxNQUFNLFlBQVksR0FBRyw2QkFBNkI7YUFDaEQsOEJBQThCLHNDQUFzQixDQUFDO1FBQ3ZELE1BQU0scUJBQXFCLEdBQUcsNkJBQTZCLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFeEUsbUVBQW1FO1FBQ25FLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsWUFBWSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEtBQUssS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNsRSxPQUFPO1FBQ1IsQ0FBQztRQUVELDZGQUE2RjtRQUM3RixtQkFBbUIsQ0FBQyxNQUFNLENBQ3pCLFFBQVEsQ0FBQyxJQUFJLEVBQ2IsUUFBUSxDQUNQLGdFQUFnRSxFQUNoRSxpR0FBaUcsQ0FDakcsRUFDRDtZQUNDO2dCQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsb0JBQW9CLEVBQUUsUUFBUSxDQUFDO2dCQUMvQyxHQUFHLEVBQUUsR0FBRyxFQUFFO29CQUNULGNBQWMsQ0FBQyxjQUFjLENBQUMseUJBQXlCLENBQUM7eUJBQ3RELEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO3dCQUNoQixVQUFVLENBQUMsS0FBSyxDQUFDLGtCQUFrQix5QkFBeUIsY0FBYyxLQUFLLEdBQUcsQ0FBQyxDQUFDO29CQUNyRixDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDO2FBQ0Q7WUFDRDtnQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLHVCQUF1QixFQUFFLFlBQVksQ0FBQztnQkFDdEQsR0FBRyxFQUFFLEdBQUcsRUFBRTtvQkFDVCxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQyxDQUFDO2dCQUMzRSxDQUFDO2FBQ0Q7U0FDRCxFQUNEO1lBQ0MsY0FBYyxFQUFFO2dCQUNmLEVBQUUsRUFBRSxnRUFBZ0U7Z0JBQ3BFLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxPQUFPO2FBQ2xDO1NBQ0QsQ0FDRCxDQUFDO0lBQ0gsQ0FBQztDQUNEO0FBR0QsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsOEJBQThCLENBQUM7QUFDcEUsTUFBTSxDQUFDLE1BQU0sMkJBQTJCLEdBQUcsb0NBQW9DLENBQUM7QUFDaEYsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsNEJBQTRCLENBQUM7QUFFaEUsTUFBTSxtQkFBb0IsU0FBUSwyQkFBMkI7SUFDNUQ7UUFDQyxLQUFLLENBQUMscUJBQXFCLEVBQUUsUUFBUSxDQUFDLGlDQUFpQyxFQUFFLG9CQUFvQixDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3JILENBQUM7Q0FDRDtBQUVELE1BQU0seUJBQTBCLFNBQVEsMkJBQTJCO0lBQ2xFO1FBQ0MsS0FBSyxDQUFDLDJCQUEyQixFQUFFLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSwwQkFBMEIsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUM3SSxDQUFDO0NBQ0Q7QUFFRCxNQUFNLGlCQUFrQixTQUFRLDJCQUEyQjtJQUMxRDtRQUNDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxRQUFRLENBQUMsK0JBQStCLEVBQUUsa0JBQWtCLENBQUMsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0csQ0FBQztDQUNEO0FBRUQsTUFBTSxVQUFVLDRCQUE0QjtJQUMzQyxlQUFlLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUNyQyxlQUFlLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUMzQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNwQyxDQUFDIn0=