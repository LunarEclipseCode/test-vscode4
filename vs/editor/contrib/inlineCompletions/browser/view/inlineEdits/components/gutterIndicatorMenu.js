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
import { n } from '../../../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../../../base/browser/ui/actionbar/actionbar.js';
import { renderIcon } from '../../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { KeybindingLabel } from '../../../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { Codicon } from '../../../../../../../base/common/codicons.js';
import { autorun, constObservable, derived, observableFromEvent, observableValue } from '../../../../../../../base/common/observable.js';
import { OS } from '../../../../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../../../../base/common/themables.js';
import { localize } from '../../../../../../../nls.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../../../platform/contextkey/common/contextkey.js';
import { nativeHoverDelegate } from '../../../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../../../platform/keybinding/common/keybinding.js';
import { defaultKeybindingLabelStyles } from '../../../../../../../platform/theme/browser/defaultStyles.js';
import { asCssVariable, descriptionForeground, editorActionListForeground, editorHoverBorder, keybindingLabelBackground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { hideInlineCompletionId, inlineSuggestCommitId, toggleShowCollapsedId } from '../../../controller/commandIds.js';
let GutterIndicatorMenuContent = class GutterIndicatorMenuContent {
    constructor(_model, _close, _editorObs, _contextKeyService, _keybindingService, _commandService) {
        this._model = _model;
        this._close = _close;
        this._editorObs = _editorObs;
        this._contextKeyService = _contextKeyService;
        this._keybindingService = _keybindingService;
        this._commandService = _commandService;
        this._inlineEditsShowCollapsed = this._editorObs.getOption(67 /* EditorOption.inlineSuggest */).map(s => s.edits.showCollapsed);
    }
    toDisposableLiveElement() {
        return this._createHoverContent().toDisposableLiveElement();
    }
    _createHoverContent() {
        const activeElement = observableValue('active', undefined);
        const createOptionArgs = (options) => {
            return {
                title: options.title,
                icon: options.icon,
                keybinding: typeof options.commandId === 'string' ? this._getKeybinding(options.commandArgs ? undefined : options.commandId) : derived(reader => typeof options.commandId === 'string' ? undefined : this._getKeybinding(options.commandArgs ? undefined : options.commandId.read(reader)).read(reader)),
                isActive: activeElement.map(v => v === options.id),
                onHoverChange: v => activeElement.set(v ? options.id : undefined, undefined),
                onAction: () => {
                    this._close(true);
                    return this._commandService.executeCommand(typeof options.commandId === 'string' ? options.commandId : options.commandId.get(), ...(options.commandArgs ?? []));
                },
            };
        };
        const title = header(this._model.displayName);
        const gotoAndAccept = option(createOptionArgs({
            id: 'gotoAndAccept',
            title: `${localize('goto', "Go To")} / ${localize('accept', "Accept")}`,
            icon: Codicon.check,
            commandId: inlineSuggestCommitId
        }));
        const reject = option(createOptionArgs({
            id: 'reject',
            title: localize('reject', "Reject"),
            icon: Codicon.close,
            commandId: hideInlineCompletionId
        }));
        const extensionCommands = this._model.extensionCommands.map((c, idx) => option(createOptionArgs({ id: c.id + '_' + idx, title: c.title, icon: Codicon.symbolEvent, commandId: c.id, commandArgs: c.arguments })));
        const toggleCollapsedMode = this._inlineEditsShowCollapsed.map(showCollapsed => showCollapsed ?
            option(createOptionArgs({
                id: 'showExpanded',
                title: localize('showExpanded', "Show Expanded"),
                icon: Codicon.expandAll,
                commandId: toggleShowCollapsedId
            }))
            : option(createOptionArgs({
                id: 'showCollapsed',
                title: localize('showCollapsed', "Show Collapsed"),
                icon: Codicon.collapseAll,
                commandId: toggleShowCollapsedId
            })));
        const settings = option(createOptionArgs({
            id: 'settings',
            title: localize('settings', "Settings"),
            icon: Codicon.gear,
            commandId: 'workbench.action.openSettings',
            commandArgs: ['@tag:nextEditSuggestions']
        }));
        const actions = this._model.action ? [this._model.action] : [];
        const actionBarFooter = actions.length > 0 ? actionBar(actions.map(action => ({
            id: action.id,
            label: action.title,
            enabled: true,
            run: () => this._commandService.executeCommand(action.id, ...(action.arguments ?? [])),
            class: undefined,
            tooltip: action.tooltip ?? action.title
        })), { hoverDelegate: nativeHoverDelegate /* unable to show hover inside another hover */ }) : undefined;
        return hoverContent([
            title,
            gotoAndAccept,
            reject,
            toggleCollapsedMode,
            settings,
            extensionCommands.length ? separator() : undefined,
            ...extensionCommands,
            actionBarFooter ? separator() : undefined,
            actionBarFooter
        ]);
    }
    _getKeybinding(commandId) {
        if (!commandId) {
            return constObservable(undefined);
        }
        return observableFromEvent(this._contextKeyService.onDidChangeContext, () => this._keybindingService.lookupKeybinding(commandId)); // TODO: use contextkeyservice to use different renderings
    }
};
GutterIndicatorMenuContent = __decorate([
    __param(3, IContextKeyService),
    __param(4, IKeybindingService),
    __param(5, ICommandService)
], GutterIndicatorMenuContent);
export { GutterIndicatorMenuContent };
function hoverContent(content) {
    return n.div({
        class: 'content',
        style: {
            margin: 4,
            minWidth: 150,
        }
    }, content);
}
function header(title) {
    return n.div({
        class: 'header',
        style: {
            color: asCssVariable(descriptionForeground),
            fontSize: '12px',
            fontWeight: '600',
            padding: '0 10px',
            lineHeight: 26,
        }
    }, [title]);
}
function option(props) {
    return derived((_reader) => n.div({
        class: ['monaco-menu-option', props.isActive?.map(v => v && 'active')],
        onmouseenter: () => props.onHoverChange?.(true),
        onmouseleave: () => props.onHoverChange?.(false),
        onclick: props.onAction,
        onkeydown: e => {
            if (e.key === 'Enter') {
                props.onAction?.();
            }
        },
        tabIndex: 0,
        style: {
            borderRadius: 3, // same as hover widget border radius
        }
    }, [
        n.elem('span', {
            style: {
                fontSize: 16,
                display: 'flex',
            }
        }, [ThemeIcon.isThemeIcon(props.icon) ? renderIcon(props.icon) : props.icon.map(icon => renderIcon(icon))]),
        n.elem('span', {}, [props.title]),
        n.div({
            style: { marginLeft: 'auto' },
            ref: elem => {
                const keybindingLabel = _reader.store.add(new KeybindingLabel(elem, OS, {
                    disableTitle: true,
                    ...defaultKeybindingLabelStyles,
                    keybindingLabelShadow: undefined,
                    keybindingLabelBackground: asCssVariable(keybindingLabelBackground),
                    keybindingLabelBorder: 'transparent',
                    keybindingLabelBottomBorder: undefined,
                }));
                _reader.store.add(autorun(reader => {
                    keybindingLabel.set(props.keybinding.read(reader));
                }));
            }
        })
    ]));
}
// TODO: make this observable
function actionBar(actions, options) {
    return derived((_reader) => n.div({
        class: ['action-widget-action-bar'],
        style: {
            padding: '0 10px',
        }
    }, [
        n.div({
            ref: elem => {
                const actionBar = _reader.store.add(new ActionBar(elem, options));
                actionBar.push(actions, { icon: false, label: true });
            }
        })
    ]));
}
function separator() {
    return n.div({
        id: 'inline-edit-gutter-indicator-menu-separator',
        class: 'menu-separator',
        style: {
            color: asCssVariable(editorActionListForeground),
            padding: '4px 0',
        }
    }, n.div({
        style: {
            borderBottom: `1px solid ${asCssVariable(editorHoverBorder)}`,
        }
    }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3V0dGVySW5kaWNhdG9yTWVudS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci92aWV3L2lubGluZUVkaXRzL2NvbXBvbmVudHMvZ3V0dGVySW5kaWNhdG9yTWVudS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQTBCLENBQUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxTQUFTLEVBQXFCLE1BQU0sNkRBQTZELENBQUM7QUFDM0csT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUUxRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFdkUsT0FBTyxFQUFlLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3RKLE9BQU8sRUFBRSxFQUFFLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUM1RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNuRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMzRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNuRyxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSw4REFBOEQsQ0FB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