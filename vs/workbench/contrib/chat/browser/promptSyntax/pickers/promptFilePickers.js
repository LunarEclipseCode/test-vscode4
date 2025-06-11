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
import { localize } from '../../../../../../nls.js';
import { URI } from '../../../../../../base/common/uri.js';
import { assert } from '../../../../../../base/common/assert.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { IPromptsService } from '../../../common/promptSyntax/service/promptsService.js';
import { dirname, extUri, joinPath } from '../../../../../../base/common/resources.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IDialogService } from '../../../../../../platform/dialogs/common/dialogs.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { getCleanPromptName } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { PromptsType, INSTRUCTIONS_DOCUMENTATION_URL, MODE_DOCUMENTATION_URL, PROMPT_DOCUMENTATION_URL } from '../../../common/promptSyntax/promptTypes.js';
import { NEW_PROMPT_COMMAND_ID, NEW_INSTRUCTIONS_COMMAND_ID, NEW_MODE_COMMAND_ID } from '../newPromptFileActions.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { askForPromptFileName } from './askForPromptName.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { UILabelProvider } from '../../../../../../base/common/keybindingLabels.js';
import { OS } from '../../../../../../base/common/platform.js';
import { askForPromptSourceFolder } from './askForPromptSourceFolder.js';
/**
 * Button that opems the documentation.
 */
const HELP_BUTTON = Object.freeze({
    tooltip: localize('help', "Help"),
    iconClass: ThemeIcon.asClassName(Codicon.question),
});
/**
 * A quick pick item that starts the 'New Prompt File' command.
 */
const NEW_PROMPT_FILE_OPTION = Object.freeze({
    type: 'item',
    label: `$(plus) ${localize('commands.new-promptfile.select-dialog.label', 'New prompt file...')}`,
    value: URI.parse(PROMPT_DOCUMENTATION_URL),
    pickable: false,
    alwaysShow: true,
    buttons: [HELP_BUTTON],
    commandId: NEW_PROMPT_COMMAND_ID,
});
/**
 * A quick pick item that starts the 'New Instructions File' command.
 */
const NEW_INSTRUCTIONS_FILE_OPTION = Object.freeze({
    type: 'item',
    label: `$(plus) ${localize('commands.new-instructionsfile.select-dialog.label', 'Create new instruction file...')}`,
    value: URI.parse(INSTRUCTIONS_DOCUMENTATION_URL),
    pickable: false,
    alwaysShow: true,
    buttons: [HELP_BUTTON],
    commandId: NEW_INSTRUCTIONS_COMMAND_ID,
});
/**
 * A quick pick item that starts the 'New Instructions File' command.
 */
const NEW_MODE_FILE_OPTION = Object.freeze({
    type: 'item',
    label: `$(plus) ${localize('commands.new-modefile.select-dialog.label', 'Create new custom chat mode file...')}`,
    value: URI.parse(MODE_DOCUMENTATION_URL),
    pickable: false,
    alwaysShow: true,
    buttons: [HELP_BUTTON],
    commandId: NEW_MODE_COMMAND_ID,
});
/**
 * Button that opens a prompt file in the editor.
 */
const EDIT_BUTTON = Object.freeze({
    tooltip: localize('open', "Open in Editor"),
    iconClass: ThemeIcon.asClassName(Codicon.edit),
});
/**
 * Button that deletes a prompt file.
 */
const DELETE_BUTTON = Object.freeze({
    tooltip: localize('delete', "Delete"),
    iconClass: ThemeIcon.asClassName(Codicon.trash),
});
/**
 * Button that renames a prompt file.
 */
const RENAME_BUTTON = Object.freeze({
    tooltip: localize('rename', "Rename"),
    iconClass: ThemeIcon.asClassName(Codicon.replace),
});
/**
 * Button that copies a prompt file.
 */
const COPY_BUTTON = Object.freeze({
    tooltip: localize('copy', "Copy or Move (press {0})", UILabelProvider.modifierLabels[OS].ctrlKey),
    iconClass: ThemeIcon.asClassName(Codicon.copy),
});
let PromptFilePickers = class PromptFilePickers {
    constructor(_labelService, _quickInputService, _openerService, _fileService, _dialogService, _commandService, _instaService, _promptsService) {
        this._labelService = _labelService;
        this._quickInputService = _quickInputService;
        this._openerService = _openerService;
        this._fileService = _fileService;
        this._dialogService = _dialogService;
        this._commandService = _commandService;
        this._instaService = _instaService;
        this._promptsService = _promptsService;
    }
    /**
     * Shows the prompt file selection dialog to the user that allows to run a prompt file(s).
     *
     * If {@link ISelectOptions.resource resource} is provided, the dialog will have
     * the resource pre-selected in the prompts list.
     */
    async selectPromptFile(options) {
        const quickPick = this._quickInputService.createQuickPick();
        quickPick.busy = true;
        quickPick.placeholder = localize('searching', 'Searching file system...');
        try {
            const fileOptions = await this._createPromptPickItems(options);
            const activeItem = options.resource && fileOptions.find(f => extUri.isEqual(f.value, options.resource));
            quickPick.activeItems = [activeItem ?? fileOptions[0]];
            quickPick.placeholder = options.placeholder;
            quickPick.canAcceptInBackground = true;
            quickPick.matchOnDescription = true;
            quickPick.items = fileOptions;
        }
        finally {
            quickPick.busy = false;
        }
        return new Promise(resolve => {
            const disposables = new DisposableStore();
            let isResolved = false;
            // then the dialog is hidden or disposed for other reason,
            // dispose everything and resolve the main promise
            disposables.add({
                dispose() {
                    quickPick.dispose();
                    if (!isResolved) {
                        resolve(undefined);
                        isResolved = true;
                    }
                },
            });
            // handle the prompt `accept` event
            disposables.add(quickPick.onDidAccept(async (event) => {
                const { selectedItems } = quickPick;
                const { keyMods } = quickPick;
                const selectedItem = selectedItems[0];
                if (selectedItem.commandId) {
                    await this._commandService.executeCommand(selectedItem.commandId);
                    return;
                }
                if (selectedItem) {
                    resolve({ promptFile: selectedItem.value, keyMods: { ...keyMods } });
                    isResolved = true;
                }
                // if user submitted their selection, close the dialog
                if (!event.inBackground) {
                    disposables.dispose();
                }
            }));
            // handle the `button click` event on a list item (edit, delete, etc.)
            disposables.add(quickPick.onDidTriggerItemButton(e => this._handleButtonClick(quickPick, e, options)));
            // when the dialog is hidden, dispose everything
            disposables.add(quickPick.onDidHide(disposables.dispose.bind(disposables)));
            // finally, reveal the dialog
            quickPick.show();
        });
    }
    async _createPromptPickItems(options) {
        const { resource } = options;
        const buttons = [];
        if (options.optionEdit !== false) {
            buttons.push(EDIT_BUTTON);
        }
        if (options.optionCopy !== false) {
            buttons.push(COPY_BUTTON);
        }
        if (options.optionRename !== false) {
            buttons.push(RENAME_BUTTON);
        }
        if (options.optionDelete !== false) {
            buttons.push(DELETE_BUTTON);
        }
        const promptFiles = await this._promptsService.listPromptFiles(options.type, CancellationToken.None);
        const fileOptions = promptFiles.map((promptFile) => {
            return this._createPromptPickItem(promptFile, buttons);
        });
        // if a resource is provided, create an `activeItem` for it to pre-select
        // it in the UI, and sort the list so the active item appears at the top
        let activeItem;
        if (options.resource) {
            activeItem = fileOptions.find((file) => {
                return extUri.isEqual(file.value, options.resource);
            });
            // if no item for the `resource` was found, it means that the resource is not
            // in the list of prompt files, so add a new item for it; this ensures that
            // the currently active prompt file is always available in the selection dialog,
            // even if it is not included in the prompts list otherwise(from location setting)
            if (!activeItem) {
                activeItem = this._createPromptPickItem({
                    uri: options.resource,
                    // "user" prompts are always registered in the prompts list, hence it
                    // should be safe to assume that `resource` is not "user" prompt here
                    storage: 'local',
                    type: options.type,
                }, buttons);
                fileOptions.push(activeItem);
            }
            fileOptions.sort((file1, file2) => {
                if (extUri.isEqual(file1.value, resource)) {
                    return -1;
                }
                if (extUri.isEqual(file2.value, resource)) {
                    return 1;
                }
                return 0;
            });
        }
        const newItem = options.optionNew !== false ? this._getNewItem(options.type) : undefined;
        if (newItem) {
            fileOptions.splice(0, 0, newItem);
        }
        return fileOptions;
    }
    _getNewItem(type) {
        switch (type) {
            case PromptsType.prompt:
                return NEW_PROMPT_FILE_OPTION;
            case PromptsType.instructions:
                return NEW_INSTRUCTIONS_FILE_OPTION;
            case PromptsType.mode:
                return NEW_MODE_FILE_OPTION;
            default:
                throw new Error(`Unknown prompt type '${type}'.`);
        }
    }
    _createPromptPickItem(promptFile, buttons) {
        const { uri, storage } = promptFile;
        const fileWithoutExtension = getCleanPromptName(uri);
        // if a "user" prompt, don't show its filesystem path in
        // the user interface, but do that for all the "local" ones
        const description = (storage === 'user')
            ? localize('user-data-dir.capitalized', 'User data folder')
            : this._labelService.getUriLabel(dirname(uri), { relative: true });
        const tooltip = (storage === 'user')
            ? description
            : uri.fsPath;
        return {
            id: uri.toString(),
            type: 'item',
            label: fileWithoutExtension,
            description,
            tooltip,
            value: uri,
            buttons
        };
    }
    async keepQuickPickOpen(quickPick, work) {
        const previousIgnoreFocusOut = quickPick.ignoreFocusOut;
        quickPick.ignoreFocusOut = true;
        try {
            await work();
        }
        finally {
            quickPick.ignoreFocusOut = previousIgnoreFocusOut;
        }
    }
    async _handleButtonClick(quickPick, context, options) {
        const { item, button } = context;
        const { value, } = item;
        // `edit` button was pressed, open the prompt file in editor
        if (button === EDIT_BUTTON) {
            await this._openerService.open(value);
            return;
        }
        // `copy` button was pressed, open the prompt file in editor
        if (button === COPY_BUTTON) {
            const currentFolder = dirname(value);
            const isMove = quickPick.keyMods.ctrlCmd;
            const newFolder = await this._instaService.invokeFunction(askForPromptSourceFolder, options.type, currentFolder, isMove);
            if (!newFolder) {
                return;
            }
            const newName = await this._instaService.invokeFunction(askForPromptFileName, options.type, newFolder.uri, item.label);
            if (!newName) {
                return;
            }
            const newFile = joinPath(newFolder.uri, newName);
            if (isMove) {
                await this._fileService.move(value, newFile);
            }
            else {
                await this._fileService.copy(value, newFile);
            }
            await this._openerService.open(newFile);
            return;
        }
        // `rename` button was pressed, open a rename dialog
        if (button === RENAME_BUTTON) {
            const currentFolder = dirname(value);
            const newName = await this._instaService.invokeFunction(askForPromptFileName, options.type, currentFolder, item.label);
            if (newName) {
                const newFile = joinPath(currentFolder, newName);
                await this._fileService.move(value, newFile);
                await this._openerService.open(newFile);
            }
            return;
        }
        // `delete` button was pressed, delete the prompt file
        if (button === DELETE_BUTTON) {
            // sanity check to confirm our expectations
            assert((quickPick.activeItems.length < 2), `Expected maximum one active item, got '${quickPick.activeItems.length}'.`);
            const activeItem = quickPick.activeItems[0];
            // sanity checks - prompt file exists and is not a folder
            const info = await this._fileService.stat(value);
            assert(info.isDirectory === false, `'${value.fsPath}' points to a folder.`);
            // don't close the main prompt selection dialog by the confirmation dialog
            await this.keepQuickPickOpen(quickPick, async () => {
                const filename = getCleanPromptName(value);
                const { confirmed } = await this._dialogService.confirm({
                    message: localize('commands.prompts.use.select-dialog.delete-prompt.confirm.message', "Are you sure you want to delete '{0}'?", filename),
                });
                // if prompt deletion was not confirmed, nothing to do
                if (!confirmed) {
                    return;
                }
                // prompt deletion was confirmed so delete the prompt file
                await this._fileService.del(value);
                // remove the deleted prompt from the selection dialog list
                let removedIndex = -1;
                quickPick.items = quickPick.items.filter((option, index) => {
                    if (option === item) {
                        removedIndex = index;
                        return false;
                    }
                    return true;
                });
                // if the deleted item was active item, find a new item to set as active
                if (activeItem && (activeItem === item)) {
                    assert(removedIndex >= 0, 'Removed item index must be a valid index.');
                    // we set the previous item as new active, or the next item
                    // if removed prompt item was in the beginning of the list
                    const newActiveItemIndex = Math.max(removedIndex - 1, 0);
                    const newActiveItem = quickPick.items[newActiveItemIndex];
                    quickPick.activeItems = newActiveItem ? [newActiveItem] : [];
                }
            });
            return;
        }
        if (button === HELP_BUTTON) {
            // open the documentation
            await this._openerService.open(item.value);
            return;
        }
        throw new Error(`Unknown button '${JSON.stringify(button)}'.`);
    }
};
PromptFilePickers = __decorate([
    __param(0, ILabelService),
    __param(1, IQuickInputService),
    __param(2, IOpenerService),
    __param(3, IFileService),
    __param(4, IDialogService),
    __param(5, ICommandService),
    __param(6, IInstantiationService),
    __param(7, IPromptsService)
], PromptFilePickers);
export { PromptFilePickers };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZVBpY2tlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvcGlja2Vycy9wcm9tcHRGaWxlUGlja2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBZSxlQUFlLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDcEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLDhCQUE4QixFQUFFLHNCQUFzQixFQUFF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