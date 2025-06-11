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
import * as dom from '../../../../../base/browser/dom.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { localize } from '../../../../../nls.js';
import { ActionWidgetDropdownActionViewItem } from '../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js';
import { getFlatActionBarActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IChatAgentService } from '../../common/chatAgents.js';
import { IChatModeService } from '../../common/chatModes.js';
import { ChatAgentLocation, modeToString } from '../../common/constants.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { getOpenChatActionIdForMode } from '../actions/chatActions.js';
let ModePickerActionItem = class ModePickerActionItem extends ActionWidgetDropdownActionViewItem {
    constructor(action, delegate, actionWidgetService, chatAgentService, keybindingService, contextKeyService, promptsService, chatModeService, menuService) {
        const makeAction = (mode, includeCategory) => ({
            ...action,
            id: getOpenChatActionIdForMode(mode),
            label: modeToString(mode),
            class: undefined,
            enabled: true,
            checked: delegate.getMode().id === mode,
            tooltip: chatAgentService.getDefaultAgent(ChatAgentLocation.Panel, mode)?.description ?? action.tooltip,
            run: async () => {
                const result = await action.run({ mode });
                this.renderLabel(this.element);
                return result;
            },
            category: includeCategory ? { label: localize('built-in', "Built-In"), order: 0 } : undefined
        });
        const makeActionFromCustomMode = (mode) => ({
            ...action,
            id: getOpenChatActionIdForMode(mode.name),
            label: mode.name,
            class: undefined,
            enabled: true,
            checked: delegate.getMode().id === mode.id,
            tooltip: mode.description ?? chatAgentService.getDefaultAgent(ChatAgentLocation.Panel, mode.kind)?.description ?? action.tooltip,
            run: async () => {
                const result = await action.run({ mode });
                this.renderLabel(this.element);
                return result;
            },
            category: { label: localize('custom', "Custom"), order: 1 }
        });
        const actionProvider = {
            getActions: () => {
                const modes = chatModeService.getModes();
                const hasCustomModes = modes.custom && modes.custom.length > 0;
                const agentStateActions = modes.builtin.map(mode => makeAction(mode.kind, !!hasCustomModes));
                if (modes.custom) {
                    agentStateActions.push(...modes.custom.map(mode => makeActionFromCustomMode(mode)));
                }
                return agentStateActions;
            }
        };
        const modePickerActionWidgetOptions = {
            actionProvider,
            actionBarActionProvider: {
                getActions: () => this.getModePickerActionBarActions()
            },
            showItemKeybindings: true
        };
        super(action, modePickerActionWidgetOptions, actionWidgetService, keybindingService, contextKeyService);
        this.delegate = delegate;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this._register(delegate.onDidChangeMode(() => this.renderLabel(this.element)));
    }
    getModePickerActionBarActions() {
        const menuActions = this.menuService.createMenu(MenuId.ChatModePicker, this.contextKeyService);
        const menuContributions = getFlatActionBarActions(menuActions.getActions({ renderShortTitle: true }));
        menuActions.dispose();
        return menuContributions;
    }
    renderLabel(element) {
        if (!this.element) {
            return null;
        }
        this.setAriaLabelAttributes(element);
        const state = this.delegate.getMode().name;
        dom.reset(element, dom.$('span.chat-model-label', undefined, state), ...renderLabelWithIcons(`$(chevron-down)`));
        return null;
    }
    render(container) {
        super.render(container);
        container.classList.add('chat-modelPicker-item');
    }
};
ModePickerActionItem = __decorate([
    __param(2, IActionWidgetService),
    __param(3, IChatAgentService),
    __param(4, IKeybindingService),
    __param(5, IContextKeyService),
    __param(6, IPromptsService),
    __param(7, IChatModeService),
    __param(8, IMenuService)
], ModePickerActionItem);
export { ModePickerActionItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZVBpY2tlckFjdGlvbkl0ZW0uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9tb2RlbFBpY2tlci9tb2RlUGlja2VyQWN0aW9uSXRlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBSTlGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUNuSSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUM3RyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBa0IsTUFBTSxtREFBbUQsQ0FBQztBQUN6RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUVwRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUMvRCxPQUFPLEVBQWEsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsaUJBQWlCLEVBQVksWUFBWSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDdEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBUWhFLElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNB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