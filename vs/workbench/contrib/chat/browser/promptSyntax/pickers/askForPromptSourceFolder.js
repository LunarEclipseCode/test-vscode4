/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename, extUri, isEqual } from '../../../../../../base/common/resources.js';
import { URI } from '../../../../../../base/common/uri.js';
import { localize } from '../../../../../../nls.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { PROMPT_DOCUMENTATION_URL, PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { IPromptsService } from '../../../common/promptSyntax/service/promptsService.js';
/**
 * Asks the user for a specific prompt folder, if multiple folders provided.
 */
export async function askForPromptSourceFolder(accessor, type, existingFolder, isMove = false) {
    const quickInputService = accessor.get(IQuickInputService);
    const promptsService = accessor.get(IPromptsService);
    const labelService = accessor.get(ILabelService);
    const workspaceService = accessor.get(IWorkspaceContextService);
    // get prompts source folders based on the prompt type
    const folders = promptsService.getSourceFolders(type);
    // if no source folders found, show 'learn more' dialog
    // note! this is a temporary solution and must be replaced with a dialog to select
    //       a custom folder path, or switch to a different prompt type
    if (folders.length === 0) {
        await showNoFoldersDialog(accessor, type);
        return;
    }
    // if there is only one folder and it's for new, no need to ask
    if (!existingFolder && folders.length === 1) {
        return folders[0];
    }
    const pickOptions = {
        placeHolder: existingFolder ? getPlaceholderStringforMove(type, isMove) : getPlaceholderStringforNew(type),
        canPickMany: false,
        matchOnDescription: true,
    };
    // create list of source folder locations
    const foldersList = folders.map(folder => {
        const uri = folder.uri;
        const detail = (existingFolder && isEqual(uri, existingFolder)) ? localize('current.folder', "Current Location") : undefined;
        if (folder.storage === 'user') {
            return {
                type: 'item',
                label: localize('commands.prompts.create.source-folder.user', "User Data Folder"),
                detail,
                description: labelService.getUriLabel(uri),
                tooltip: uri.fsPath,
                folder
            };
        }
        const { folders } = workspaceService.getWorkspace();
        const isMultirootWorkspace = (folders.length > 1);
        const firstFolder = folders[0];
        // if multi-root or empty workspace, or source folder `uri` does not point to
        // the root folder of a single-root workspace, return the default label and description
        if (isMultirootWorkspace || !firstFolder || !extUri.isEqual(firstFolder.uri, uri)) {
            return {
                type: 'item',
                label: basename(uri),
                detail,
                description: labelService.getUriLabel(uri, { relative: true }),
                tooltip: uri.fsPath,
                folder,
            };
        }
        // if source folder points to the root of this single-root workspace,
        // use appropriate label and description strings to prevent confusion
        return {
            type: 'item',
            label: localize('commands.prompts.create.source-folder.current-workspace', "Current Workspace"),
            detail,
            // use absolute path as the description
            description: labelService.getUriLabel(uri, { relative: false }),
            tooltip: uri.fsPath,
            folder,
        };
    });
    const answer = await quickInputService.pick(foldersList, pickOptions);
    if (!answer) {
        return;
    }
    return answer.folder;
}
function getPlaceholderStringforNew(type) {
    switch (type) {
        case PromptsType.instructions:
            return localize('workbench.command.instructions.create.location.placeholder', "Select a location to create the instructions file in...");
        case PromptsType.prompt:
            return localize('workbench.command.prompt.create.location.placeholder', "Select a location to create the prompt file in...");
        case PromptsType.mode:
            return localize('workbench.command.mode.create.location.placeholder', "Select a location to create the mode file in...");
        default:
            throw new Error('Unknown prompt type');
    }
}
function getPlaceholderStringforMove(type, isMove) {
    if (isMove) {
        switch (type) {
            case PromptsType.instructions:
                return localize('instructions.move.location.placeholder', "Select a location to move the instructions file to...");
            case PromptsType.prompt:
                return localize('prompt.move.location.placeholder', "Select a location to move the prompt file to...");
            case PromptsType.mode:
                return localize('mode.move.location.placeholder', "Select a location to move the mode file to...");
            default:
                throw new Error('Unknown prompt type');
        }
    }
    switch (type) {
        case PromptsType.instructions:
            return localize('instructions.copy.location.placeholder', "Select a location to copy the instructions file to...");
        case PromptsType.prompt:
            return localize('prompt.copy.location.placeholder', "Select a location to copy the prompt file to...");
        case PromptsType.mode:
            return localize('mode.copy.location.placeholder', "Select a location to copy the mode file to...");
        default:
            throw new Error('Unknown prompt type');
    }
}
/**
 * Shows a dialog to the user when no prompt source folders are found.
 *
 * Note! this is a temporary solution and must be replaced with a dialog to select
 *       a custom folder path, or switch to a different prompt type
 */
async function showNoFoldersDialog(accessor, type) {
    const quickInputService = accessor.get(IQuickInputService);
    const openerService = accessor.get(IOpenerService);
    const docsQuickPick = {
        type: 'item',
        label: getLearnLabel(type),
        description: PROMPT_DOCUMENTATION_URL,
        tooltip: PROMPT_DOCUMENTATION_URL,
        value: URI.parse(PROMPT_DOCUMENTATION_URL),
    };
    const result = await quickInputService.pick([docsQuickPick], {
        placeHolder: getMissingSourceFolderString(type),
        canPickMany: false,
    });
    if (result) {
        await openerService.open(result.value);
    }
}
function getLearnLabel(type) {
    switch (type) {
        case PromptsType.prompt:
            return localize('commands.prompts.create.ask-folder.empty.docs-label', 'Learn how to configure reusable prompts');
        case PromptsType.instructions:
            return localize('commands.instructions.create.ask-folder.empty.docs-label', 'Learn how to configure reusable instructions');
        case PromptsType.mode:
            return localize('commands.mode.create.ask-folder.empty.docs-label', 'Learn how to configure custom chat modes');
        default:
            throw new Error('Unknown prompt type');
    }
}
function getMissingSourceFolderString(type) {
    switch (type) {
        case PromptsType.instructions:
            return localize('commands.instructions.create.ask-folder.empty.placeholder', 'No instruction source folders found.');
        case PromptsType.prompt:
            return localize('commands.prompts.create.ask-folder.empty.placeholder', 'No prompt source folders found.');
        case PromptsType.mode:
            return localize('commands.mode.create.ask-folder.empty.placeholder', 'No custom chat mode source folders found.');
        default:
            throw new Error('Unknown prompt type');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNrRm9yUHJvbXB0U291cmNlRm9sZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvcHJvbXB0U3ludGF4L3BpY2tlcnMvYXNrRm9yUHJvbXB0U291cmNlRm9sZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUUzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEcsT0FBTyxFQUFnQixrQkFBa0IsRUFBa0IsTUFBTSw0REFBNEQsQ0FBQztBQUM5SCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNwRyxPQUFPLEVBQWUsZUFBZSxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFPdEc7O0dBRUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLHdCQUF3QixDQUM3QyxRQUEwQixFQUMxQixJQUFpQixFQUNqQixjQUFnQyxFQUNoQyxTQUFrQixLQUFLO0lBRXZCLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzNELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDckQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFD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