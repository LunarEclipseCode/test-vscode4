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
import { ChatViewId, IChatWidgetService, showChatView } from '../chat.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { localize, localize2 } from '../../../../../nls.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { PromptsConfig } from '../../common/promptSyntax/config/config.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { PromptFilePickers } from './pickers/promptFilePickers.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { getCleanPromptName } from '../../common/promptSyntax/config/promptFileLocations.js';
import { INSTRUCTIONS_LANGUAGE_ID, PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { compare } from '../../../../../base/common/strings.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { dirname } from '../../../../../base/common/resources.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
/**
 * Action ID for the `Attach Instruction` action.
 */
const ATTACH_INSTRUCTIONS_ACTION_ID = 'workbench.action.chat.attach.instructions';
/**
 * Action ID for the `Configure Instruction` action.
 */
const CONFIGURE_INSTRUCTIONS_ACTION_ID = 'workbench.action.chat.configure.instructions';
/**
 * Action to attach a prompt to a chat widget input.
 */
class AttachInstructionsAction extends Action2 {
    constructor() {
        super({
            id: ATTACH_INSTRUCTIONS_ACTION_ID,
            title: localize2('attach-instructions.capitalized.ellipses', "Attach Instructions..."),
            f1: false,
            precondition: ContextKeyExpr.and(PromptsConfig.enabledCtx, ChatContextKeys.enabled),
            category: CHAT_CATEGORY,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 90 /* KeyCode.Slash */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(PromptsConfig.enabledCtx, ChatContextKeys.enabled)
            }
        });
    }
    async run(accessor, options) {
        const viewsService = accessor.get(IViewsService);
        const instaService = accessor.get(IInstantiationService);
        if (!options) {
            options = {
                resource: getActiveInstructionsFileUri(accessor),
                widget: getFocusedChatWidget(accessor),
            };
        }
        const pickers = instaService.createInstance(PromptFilePickers);
        const { skipSelectionDialog, resource } = options;
        const widget = options.widget ?? (await showChatView(viewsService));
        if (!widget) {
            return;
        }
        if (skipSelectionDialog && resource) {
            widget.attachmentModel.promptInstructions.add(resource);
            widget.focusInput();
            return;
        }
        const placeholder = localize('commands.instructions.select-dialog.placeholder', 'Select instructions files to attach');
        const result = await pickers.selectPromptFile({ resource, placeholder, type: PromptsType.instructions });
        if (result !== undefined) {
            widget.attachmentModel.promptInstructions.add(result.promptFile);
            widget.focusInput();
        }
    }
}
class ManageInstructionsFilesAction extends Action2 {
    constructor() {
        super({
            id: CONFIGURE_INSTRUCTIONS_ACTION_ID,
            title: localize2('configure-instructions', "Configure Instructions"),
            icon: Codicon.bookmark,
            f1: true,
            precondition: ContextKeyExpr.and(PromptsConfig.enabledCtx, ChatContextKeys.enabled),
            category: CHAT_CATEGORY,
            menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.equals('view', ChatViewId),
                order: 11,
                group: '2_manage'
            },
        });
    }
    async run(accessor) {
        const openerService = accessor.get(IOpenerService);
        const instaService = accessor.get(IInstantiationService);
        const pickers = instaService.createInstance(PromptFilePickers);
        const placeholder = localize('commands.prompt.manage-dialog.placeholder', 'Select the instructions file to open');
        const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.instructions, optionEdit: false });
        if (result !== undefined) {
            await openerService.open(result.promptFile);
        }
    }
}
function getFocusedChatWidget(accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const { lastFocusedWidget } = chatWidgetService;
    if (!lastFocusedWidget) {
        return undefined;
    }
    // the widget input `must` be focused at the time when command run
    if (!lastFocusedWidget.hasInputFocus()) {
        return undefined;
    }
    return lastFocusedWidget;
}
/**
 * Gets `URI` of a instructions file open in an active editor instance, if any.
 */
function getActiveInstructionsFileUri(accessor) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const model = codeEditorService.getActiveCodeEditor()?.getModel();
    if (model?.getLanguageId() === INSTRUCTIONS_LANGUAGE_ID) {
        return model.uri;
    }
    return undefined;
}
/**
 * Helper to register the `Attach Prompt` action.
 */
export function registerAttachPromptActions() {
    registerAction2(AttachInstructionsAction);
    registerAction2(ManageInstructionsFilesAction);
}
let ChatInstructionsPickerPick = class ChatInstructionsPickerPick {
    constructor(promptsService, labelService) {
        this.promptsService = promptsService;
        this.labelService = labelService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.attach.instructions.label', 'Instructions...');
        this.icon = Codicon.bookmark;
        this.commandId = ATTACH_INSTRUCTIONS_ACTION_ID;
    }
    isEnabled(widget) {
        return widget.attachmentModel.promptInstructions.featureEnabled;
    }
    asPicker() {
        const picks = this.promptsService.listPromptFiles(PromptsType.instructions, CancellationToken.None).then(value => {
            const result = [];
            value = value.slice(0).sort((a, b) => compare(a.storage, b.storage));
            let storageType;
            for (const { uri, storage } of value) {
                if (storageType !== storage) {
                    storageType = storage;
                    result.push({
                        type: 'separator',
                        label: storage === 'user'
                            ? localize('user-data-dir.capitalized', 'User data folder')
                            : this.labelService.getUriLabel(dirname(uri), { relative: true })
                    });
                }
                result.push({
                    label: getCleanPromptName(uri),
                    asAttachment: () => {
                        return {
                            kind: 'promptFile',
                            id: uri.toString(),
                            value: uri,
                            name: this.labelService.getUriBasenameLabel(uri),
                        };
                    }
                });
            }
            return result;
        });
        return {
            placeholder: localize('placeholder', 'Select instructions files to attach'),
            picks
        };
    }
};
ChatInstructionsPickerPick = __decorate([
    __param(0, IPromptsService),
    __param(1, ILabelService)
], ChatInstructionsPickerPick);
export { ChatInstructionsPickerPick };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0YWNoSW5zdHJ1Y3Rpb25zQWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvcHJvbXB0U3ludGF4L2F0dGFjaEluc3RydWN0aW9uc0FjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFlLGtCQUFrQixFQUFFLFlBQVksRUFBRSxNQUFNLFlBQVksQ0FBQztBQUN2RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFbkUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBR3RHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENB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