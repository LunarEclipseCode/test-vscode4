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
import { isKeyboardEvent, isMouseEvent, isPointerEvent } from '../../../../base/browser/dom.js';
import { Action } from '../../../../base/common/actions.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { Schemas } from '../../../../base/common/network.js';
import { isAbsolute } from '../../../../base/common/path.js';
import { isWindows } from '../../../../base/common/platform.js';
import { dirname } from '../../../../base/common/resources.js';
import { isObject, isString } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { getIconClasses } from '../../../../editor/common/services/getIconClasses.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { localize, localize2 } from '../../../../nls.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../platform/accessibility/common/accessibility.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { FileKind } from '../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IListService } from '../../../../platform/list/browser/listService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { TerminalExitReason, TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { createProfileSchemaEnums } from '../../../../platform/terminal/common/terminalProfiles.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from '../../../browser/actions/workspaceCommands.js';
import { CLOSE_EDITOR_COMMAND_ID } from '../../../browser/parts/editor/editorCommands.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { ConfigurationResolverExpression } from '../../../services/configurationResolver/common/configurationResolverExpression.js';
import { editorGroupToColumn } from '../../../services/editor/common/editorGroupColumn.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { accessibleViewCurrentProviderId, accessibleViewIsShown, accessibleViewOnLastLine } from '../../accessibility/browser/accessibilityConfiguration.js';
import { ITerminalProfileResolverService, ITerminalProfileService, TERMINAL_VIEW_ID } from '../common/terminal.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { terminalStrings } from '../common/terminalStrings.js';
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService, ITerminalService } from './terminal.js';
import { InstanceContext } from './terminalContextMenu.js';
import { getColorClass, getIconId, getUriClasses } from './terminalIcon.js';
import { killTerminalIcon, newTerminalIcon } from './terminalIcons.js';
import { TerminalTabList } from './terminalTabsList.js';
export const switchTerminalActionViewItemSeparator = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
export const switchTerminalShowTabsTitle = localize('showTerminalTabs', "Show Tabs");
const category = terminalStrings.actionCategory;
// Some terminal context keys get complicated. Since normalizing and/or context keys can be
// expensive this is done once per context key and shared.
const sharedWhenClause = (() => {
    const terminalAvailable = ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated);
    return {
        terminalAvailable,
        terminalAvailable_and_opened: ContextKeyExpr.and(terminalAvailable, TerminalContextKeys.isOpen),
        terminalAvailable_and_editorActive: ContextKeyExpr.and(terminalAvailable, TerminalContextKeys.terminalEditorActive),
        terminalAvailable_and_singularSelection: ContextKeyExpr.and(terminalAvailable, TerminalContextKeys.tabsSingularSelection),
        focusInAny_and_normalBuffer: ContextKeyExpr.and(TerminalContextKeys.focusInAny, TerminalContextKeys.altBufferActive.negate())
    };
})();
export async function getCwdForSplit(instance, folders, commandService, configService) {
    switch (configService.config.splitCwd) {
        case 'workspaceRoot':
            if (folders !== undefined && commandService !== undefined) {
                if (folders.length === 1) {
                    return folders[0].uri;
                }
                else if (folders.length > 1) {
                    // Only choose a path when there's more than 1 folder
                    const options = {
                        placeHolder: localize('workbench.action.terminal.newWorkspacePlaceholder', "Select current working directory for new terminal")
                    };
                    const workspace = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID, [options]);
                    if (!workspace) {
                        // Don't split the instance if the workspace picker was canceled
                        return undefined;
                    }
                    return Promise.resolve(workspace.uri);
                }
            }
            return '';
        case 'initial':
            return instance.getInitialCwd();
        case 'inherited':
            return instance.getCwd();
    }
}
let TerminalLaunchHelpAction = class TerminalLaunchHelpAction extends Action {
    constructor(_openerService) {
        super('workbench.action.terminal.launchHelp', localize('terminalLaunchHelp', "Open Help"));
        this._openerService = _openerService;
    }
    async run() {
        this._openerService.open('https://aka.ms/vscode-troubleshoot-terminal-launch');
    }
};
TerminalLaunchHelpAction = __decorate([
    __param(0, IOpenerService)
], TerminalLaunchHelpAction);
export { TerminalLaunchHelpAction };
/**
 * A wrapper function around registerAction2 to help make registering terminal actions more concise.
 * The following default options are used if undefined:
 *
 * - `f1`: true
 * - `category`: Terminal
 * - `precondition`: TerminalContextKeys.processSupported
 */
export function registerTerminalAction(options) {
    // Set defaults
    options.f1 = options.f1 ?? true;
    options.category = options.category ?? category;
    options.precondition = options.precondition ?? TerminalContextKeys.processSupported;
    // Remove run function from options so it's not passed through to registerAction2
    const runFunc = options.run;
    const strictOptions = options;
    delete strictOptions['run'];
    // Register
    return registerAction2(class extends Action2 {
        constructor() {
            super(strictOptions);
        }
        run(accessor, args, args2) {
            return runFunc(getTerminalServices(accessor), accessor, args, args2);
        }
    });
}
function parseActionArgs(args) {
    if (Array.isArray(args)) {
        if (args.every(e => e instanceof InstanceContext)) {
            return args;
        }
    }
    else if (args instanceof InstanceContext) {
        return [args];
    }
    return undefined;
}
/**
 * A wrapper around {@link registerTerminalAction} that runs a callback for all currently selected
 * instances provided in the action context. This falls back to the active instance if there are no
 * contextual instances provided.
 */
export function registerContextualInstanceAction(options) {
    const originalRun = options.run;
    return registerTerminalAction({
        ...options,
        run: async (c, accessor, focusedInstanceArgs, allInstanceArgs) => {
            let instances = getSelectedInstances2(accessor, allInstanceArgs);
            if (!instances) {
                const activeInstance = (options.activeInstanceType === 'view'
                    ? c.groupService
                    : options.activeInstanceType === 'editor' ?
                        c.editorService
                        : c.service).activeInstance;
                if (!activeInstance) {
                    return;
                }
                instances = [activeInstance];
            }
            const results = [];
            for (const instance of instances) {
                results.push(originalRun(instance, c, accessor, focusedInstanceArgs));
            }
            await Promise.all(results);
            if (options.runAfter) {
                options.runAfter(instances, c, accessor, focusedInstanceArgs);
            }
        }
    });
}
/**
 * A wrapper around {@link registerTerminalAction} that ensures an active instance exists and
 * provides it to the run function.
 */
export function registerActiveInstanceAction(options) {
    const originalRun = options.run;
    return registerTerminalAction({
        ...options,
        run: (c, accessor, args) => {
            const activeInstance = c.service.activeInstance;
            if (activeInstance) {
                return originalRun(activeInstance, c, accessor, args);
            }
        }
    });
}
/**
 * A wrapper around {@link registerTerminalAction} that ensures an active terminal
 * exists and provides it to the run function.
 *
 * This includes detached xterm terminals that are not managed by an {@link ITerminalInstance}.
 */
export function registerActiveXtermAction(options) {
    const originalRun = options.run;
    return registerTerminalAction({
        ...options,
        run: (c, accessor, args) => {
            const activeDetached = Iterable.find(c.service.detachedInstances, d => d.xterm.isFocused);
            if (activeDetached) {
                return originalRun(activeDetached.xterm, accessor, activeDetached, args);
            }
            const activeInstance = c.service.activeInstance;
            if (activeInstance?.xterm) {
                return originalRun(activeInstance.xterm, accessor, activeInstance, args);
            }
        }
    });
}
function getTerminalServices(accessor) {
    return {
        service: accessor.get(ITerminalService),
        configService: accessor.get(ITerminalConfigurationService),
        groupService: accessor.get(ITerminalGroupService),
        instanceService: accessor.get(ITerminalInstanceService),
        editorService: accessor.get(ITerminalEditorService),
        profileService: accessor.get(ITerminalProfileService),
        profileResolverService: accessor.get(ITerminalProfileResolverService)
    };
}
export function registerTerminalActions() {
    registerTerminalAction({
        id: "workbench.action.terminal.newInActiveWorkspace" /* TerminalCommandId.NewInActiveWorkspace */,
        title: localize2('workbench.action.terminal.newInActiveWorkspace', 'Create New Terminal (In Active Workspace)'),
        run: async (c) => {
            if (c.service.isProcessSupportRegistered) {
                const instance = await c.service.createTerminal({ location: c.service.defaultLocation });
                if (!instance) {
                    return;
                }
                c.service.setActiveInstance(instance);
                await focusActiveTerminal(instance, c);
            }
        }
    });
    // Register new with profile command
    refreshTerminalActions([]);
    registerTerminalAction({
        id: "workbench.action.createTerminalEditor" /* TerminalCommandId.CreateTerminalEditor */,
        title: localize2('workbench.action.terminal.createTerminalEditor', 'Create New Terminal in Editor Area'),
        run: async (c, _, args) => {
            const options = (isObject(args) && 'location' in args) ? args : { location: TerminalLocation.Editor };
            const instance = await c.service.createTerminal(options);
            await instance.focusWhenReady();
        }
    });
    registerTerminalAction({
        id: "workbench.action.createTerminalEditorSameGroup" /* TerminalCommandId.CreateTerminalEditorSameGroup */,
        title: localize2('workbench.action.terminal.createTerminalEditor', 'Create New Terminal in Editor Area'),
        f1: false,
        run: async (c, accessor, args) => {
            // Force the editor into the same editor group if it's locked. This command is only ever
            // called when a terminal is the active editor
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const instance = await c.service.createTerminal({
                location: { viewColumn: editorGroupToColumn(editorGroupsService, editorGroupsService.activeGroup) }
            });
            await instance.focusWhenReady();
        }
    });
    registerTerminalAction({
        id: "workbench.action.createTerminalEditorSide" /* TerminalCommandId.CreateTerminalEditorSide */,
        title: localize2('workbench.action.terminal.createTerminalEditorSide', 'Create New Terminal in Editor Area to the Side'),
        run: async (c) => {
            const instance = await c.service.createTerminal({
                location: { viewColumn: SIDE_GROUP }
            });
            await instance.focusWhenReady();
        }
    });
    registerContextualInstanceAction({
        id: "workbench.action.terminal.moveToEditor" /* TerminalCommandId.MoveToEditor */,
        title: terminalStrings.moveToEditor,
        precondition: sharedWhenClause.terminalAvailable_and_opened,
        activeInstanceType: 'view',
        run: (instance, c) => c.service.moveToEditor(instance),
        runAfter: (instances) => instances.at(-1)?.focus()
    });
    registerContextualInstanceAction({
        id: "workbench.action.terminal.moveIntoNewWindow" /* TerminalCommandId.MoveIntoNewWindow */,
        title: terminalStrings.moveIntoNewWindow,
        precondition: sharedWhenClause.terminalAvailable_and_opened,
        run: (instance, c) => c.service.moveIntoNewEditor(instance),
        runAfter: (instances) => instances.at(-1)?.focus()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.moveToTerminalPanel" /* TerminalCommandId.MoveToTerminalPanel */,
        title: terminalStrings.moveToTerminalPanel,
        precondition: sharedWhenClause.terminalAvailable_and_editorActive,
        run: (c, _, args) => {
            const source = toOptionalUri(args) ?? c.editorService.activeInstance;
            if (source) {
                c.service.moveToTerminalView(source);
            }
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focusPreviousPane" /* TerminalCommandId.FocusPreviousPane */,
        title: localize2('workbench.action.terminal.focusPreviousPane', 'Focus Previous Terminal in Terminal Group'),
        keybinding: {
            primary: 512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */,
            secondary: [512 /* KeyMod.Alt */ | 16 /* KeyCode.UpArrow */],
            mac: {
                primary: 512 /* KeyMod.Alt */ | 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */,
                secondary: [512 /* KeyMod.Alt */ | 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */]
            },
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: async (c) => {
            c.groupService.activeGroup?.focusPreviousPane();
            await c.groupService.showPanel(true);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focusNextPane" /* TerminalCommandId.FocusNextPane */,
        title: localize2('workbench.action.terminal.focusNextPane', 'Focus Next Terminal in Terminal Group'),
        keybinding: {
            primary: 512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */,
            secondary: [512 /* KeyMod.Alt */ | 18 /* KeyCode.DownArrow */],
            mac: {
                primary: 512 /* KeyMod.Alt */ | 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */,
                secondary: [512 /* KeyMod.Alt */ | 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */]
            },
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: async (c) => {
            c.groupService.activeGroup?.focusNextPane();
            await c.groupService.showPanel(true);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.resizePaneLeft" /* TerminalCommandId.ResizePaneLeft */,
        title: localize2('workbench.action.terminal.resizePaneLeft', 'Resize Terminal Left'),
        keybinding: {
            linux: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */ },
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 15 /* KeyCode.LeftArrow */ },
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (c) => c.groupService.activeGroup?.resizePane(0 /* Direction.Left */)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.resizePaneRight" /* TerminalCommandId.ResizePaneRight */,
        title: localize2('workbench.action.terminal.resizePaneRight', 'Resize Terminal Right'),
        keybinding: {
            linux: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */ },
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 17 /* KeyCode.RightArrow */ },
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (c) => c.groupService.activeGroup?.resizePane(1 /* Direction.Right */)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.resizePaneUp" /* TerminalCommandId.ResizePaneUp */,
        title: localize2('workbench.action.terminal.resizePaneUp', 'Resize Terminal Up'),
        keybinding: {
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 16 /* KeyCode.UpArrow */ },
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (c) => c.groupService.activeGroup?.resizePane(2 /* Direction.Up */)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.resizePaneDown" /* TerminalCommandId.ResizePaneDown */,
        title: localize2('workbench.action.terminal.resizePaneDown', 'Resize Terminal Down'),
        keybinding: {
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 18 /* KeyCode.DownArrow */ },
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (c) => c.groupService.activeGroup?.resizePane(3 /* Direction.Down */)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focus" /* TerminalCommandId.Focus */,
        title: terminalStrings.focus,
        keybinding: {
            when: ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, accessibleViewOnLastLine, accessibleViewCurrentProviderId.isEqualTo("terminal" /* AccessibleViewProviderId.Terminal */)),
            primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: async (c) => {
            const instance = c.service.activeInstance || await c.service.createTerminal({ location: TerminalLocation.Panel });
            if (!instance) {
                return;
            }
            c.service.setActiveInstance(instance);
            focusActiveTerminal(instance, c);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focusTabs" /* TerminalCommandId.FocusTabs */,
        title: localize2('workbench.action.terminal.focus.tabsView', 'Focus Terminal Tabs View'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 93 /* KeyCode.Backslash */,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.or(TerminalContextKeys.tabsFocus, TerminalContextKeys.focus),
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (c) => c.groupService.focusTabs()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focusNext" /* TerminalCommandId.FocusNext */,
        title: localize2('workbench.action.terminal.focusNext', 'Focus Next Terminal Group'),
        precondition: sharedWhenClause.terminalAvailable,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 12 /* KeyCode.PageDown */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 94 /* KeyCode.BracketRight */
            },
            when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.editorFocus.negate()),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        run: async (c) => {
            c.groupService.setActiveGroupToNext();
            await c.groupService.showPanel(true);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focusPrevious" /* TerminalCommandId.FocusPrevious */,
        title: localize2('workbench.action.terminal.focusPrevious', 'Focus Previous Terminal Group'),
        precondition: sharedWhenClause.terminalAvailable,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 11 /* KeyCode.PageUp */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 92 /* KeyCode.BracketLeft */
            },
            when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.editorFocus.negate()),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        run: async (c) => {
            c.groupService.setActiveGroupToPrevious();
            await c.groupService.showPanel(true);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.runSelectedText" /* TerminalCommandId.RunSelectedText */,
        title: localize2('workbench.action.terminal.runSelectedText', 'Run Selected Text In Active Terminal'),
        run: async (c, accessor) => {
            const codeEditorService = accessor.get(ICodeEditorService);
            const editor = codeEditorService.getActiveCodeEditor();
            if (!editor || !editor.hasModel()) {
                return;
            }
            const instance = await c.service.getActiveOrCreateInstance({ acceptsInput: true });
            const selection = editor.getSelection();
            let text;
            if (selection.isEmpty()) {
                text = editor.getModel().getLineContent(selection.selectionStartLineNumber).trim();
            }
            else {
                const endOfLinePreference = isWindows ? 1 /* EndOfLinePreference.LF */ : 2 /* EndOfLinePreference.CRLF */;
                text = editor.getModel().getValueInRange(selection, endOfLinePreference);
            }
            instance.sendText(text, true, true);
            await c.service.revealActiveTerminal(true);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.runActiveFile" /* TerminalCommandId.RunActiveFile */,
        title: localize2('workbench.action.terminal.runActiveFile', 'Run Active File In Active Terminal'),
        precondition: sharedWhenClause.terminalAvailable,
        run: async (c, accessor) => {
            const codeEditorService = accessor.get(ICodeEditorService);
            const notificationService = accessor.get(INotificationService);
            const workbenchEnvironmentService = accessor.get(IWorkbenchEnvironmentService);
            const editor = codeEditorService.getActiveCodeEditor();
            if (!editor || !editor.hasModel()) {
                return;
            }
            const instance = await c.service.getActiveOrCreateInstance({ acceptsInput: true });
            const isRemote = instance ? instance.isRemote : (workbenchEnvironmentService.remoteAuthority ? true : false);
            const uri = editor.getModel().uri;
            if ((!isRemote && uri.scheme !== Schemas.file && uri.scheme !== Schemas.vscodeUserData) || (isRemote && uri.scheme !== Schemas.vscodeRemote)) {
                notificationService.warn(localize('workbench.action.terminal.runActiveFile.noFile', 'Only files on disk can be run in the terminal'));
                return;
            }
            // TODO: Convert this to ctrl+c, ctrl+v for pwsh?
            await instance.sendPath(uri, true);
            return c.groupService.showPanel();
        }
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.scrollDown" /* TerminalCommandId.ScrollDownLine */,
        title: localize2('workbench.action.terminal.scrollDown', 'Scroll Down (Line)'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 12 /* KeyCode.PageDown */,
            linux: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */ },
            when: sharedWhenClause.focusInAny_and_normalBuffer,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => xterm.scrollDownLine()
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.scrollDownPage" /* TerminalCommandId.ScrollDownPage */,
        title: localize2('workbench.action.terminal.scrollDownPage', 'Scroll Down (Page)'),
        keybinding: {
            primary: 1024 /* KeyMod.Shift */ | 12 /* KeyCode.PageDown */,
            mac: { primary: 12 /* KeyCode.PageDown */ },
            when: sharedWhenClause.focusInAny_and_normalBuffer,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => xterm.scrollDownPage()
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.scrollToBottom" /* TerminalCommandId.ScrollToBottom */,
        title: localize2('workbench.action.terminal.scrollToBottom', 'Scroll to Bottom'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 13 /* KeyCode.End */,
            linux: { primary: 1024 /* KeyMod.Shift */ | 13 /* KeyCode.End */ },
            when: sharedWhenClause.focusInAny_and_normalBuffer,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => xterm.scrollToBottom()
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.scrollUp" /* TerminalCommandId.ScrollUpLine */,
        title: localize2('workbench.action.terminal.scrollUp', 'Scroll Up (Line)'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 11 /* KeyCode.PageUp */,
            linux: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */ },
            when: sharedWhenClause.focusInAny_and_normalBuffer,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => xterm.scrollUpLine()
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.scrollUpPage" /* TerminalCommandId.ScrollUpPage */,
        title: localize2('workbench.action.terminal.scrollUpPage', 'Scroll Up (Page)'),
        f1: true,
        keybinding: {
            primary: 1024 /* KeyMod.Shift */ | 11 /* KeyCode.PageUp */,
            mac: { primary: 11 /* KeyCode.PageUp */ },
            when: sharedWhenClause.focusInAny_and_normalBuffer,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => xterm.scrollUpPage()
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.scrollToTop" /* TerminalCommandId.ScrollToTop */,
        title: localize2('workbench.action.terminal.scrollToTop', 'Scroll to Top'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 14 /* KeyCode.Home */,
            linux: { primary: 1024 /* KeyMod.Shift */ | 14 /* KeyCode.Home */ },
            when: sharedWhenClause.focusInAny_and_normalBuffer,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => xterm.scrollToTop()
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.clearSelection" /* TerminalCommandId.ClearSelection */,
        title: localize2('workbench.action.terminal.clearSelection', 'Clear Selection'),
        keybinding: {
            primary: 9 /* KeyCode.Escape */,
            when: ContextKeyExpr.and(TerminalContextKeys.focusInAny, TerminalContextKeys.textSelected, TerminalContextKeys.notFindVisible),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (xterm) => {
            if (xterm.hasSelection()) {
                xterm.clearSelection();
            }
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.changeIcon" /* TerminalCommandId.ChangeIcon */,
        title: terminalStrings.changeIcon,
        precondition: sharedWhenClause.terminalAvailable,
        run: (c, _, args) => getResourceOrActiveInstance(c, args)?.changeIcon()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.changeIconActiveTab" /* TerminalCommandId.ChangeIconActiveTab */,
        title: terminalStrings.changeIcon,
        f1: false,
        precondition: sharedWhenClause.terminalAvailable_and_singularSelection,
        run: async (c, accessor, args) => {
            let icon;
            if (c.groupService.lastAccessedMenu === 'inline-tab') {
                getResourceOrActiveInstance(c, args)?.changeIcon();
                return;
            }
            for (const terminal of getSelectedInstances(accessor) ?? []) {
                icon = await terminal.changeIcon(icon);
            }
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.changeColor" /* TerminalCommandId.ChangeColor */,
        title: terminalStrings.changeColor,
        precondition: sharedWhenClause.terminalAvailable,
        run: (c, _, args) => getResourceOrActiveInstance(c, args)?.changeColor()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.changeColorActiveTab" /* TerminalCommandId.ChangeColorActiveTab */,
        title: terminalStrings.changeColor,
        f1: false,
        precondition: sharedWhenClause.terminalAvailable_and_singularSelection,
        run: async (c, accessor, args) => {
            let color;
            let i = 0;
            if (c.groupService.lastAccessedMenu === 'inline-tab') {
                getResourceOrActiveInstance(c, args)?.changeColor();
                return;
            }
            for (const terminal of getSelectedInstances(accessor) ?? []) {
                const skipQuickPick = i !== 0;
                // Always show the quickpick on the first iteration
                color = await terminal.changeColor(color, skipQuickPick);
                i++;
            }
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.rename" /* TerminalCommandId.Rename */,
        title: terminalStrings.rename,
        precondition: sharedWhenClause.terminalAvailable,
        run: (c, accessor, args) => renameWithQuickPick(c, accessor, args)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.renameActiveTab" /* TerminalCommandId.RenameActiveTab */,
        title: terminalStrings.rename,
        f1: false,
        keybinding: {
            primary: 60 /* KeyCode.F2 */,
            mac: {
                primary: 3 /* KeyCode.Enter */
            },
            when: ContextKeyExpr.and(TerminalContextKeys.tabsFocus),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable_and_singularSelection,
        run: async (c, accessor) => {
            const terminalGroupService = accessor.get(ITerminalGroupService);
            const notificationService = accessor.get(INotificationService);
            const instances = getSelectedInstances(accessor);
            const firstInstance = instances?.[0];
            if (!firstInstance) {
                return;
            }
            if (terminalGroupService.lastAccessedMenu === 'inline-tab') {
                return renameWithQuickPick(c, accessor, firstInstance);
            }
            c.service.setEditingTerminal(firstInstance);
            c.service.setEditable(firstInstance, {
                validationMessage: value => validateTerminalName(value),
                onFinish: async (value, success) => {
                    // Cancel editing first as instance.rename will trigger a rerender automatically
                    c.service.setEditable(firstInstance, null);
                    c.service.setEditingTerminal(undefined);
                    if (success) {
                        const promises = [];
                        for (const instance of instances) {
                            promises.push((async () => {
                                await instance.rename(value);
                            })());
                        }
                        try {
                            await Promise.all(promises);
                        }
                        catch (e) {
                            notificationService.error(e);
                        }
                    }
                }
            });
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.detachSession" /* TerminalCommandId.DetachSession */,
        title: localize2('workbench.action.terminal.detachSession', 'Detach Session'),
        run: (activeInstance) => activeInstance.detachProcessAndDispose(TerminalExitReason.User)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.attachToSession" /* TerminalCommandId.AttachToSession */,
        title: localize2('workbench.action.terminal.attachToSession', 'Attach to Session'),
        run: async (c, accessor) => {
            const quickInputService = accessor.get(IQuickInputService);
            const labelService = accessor.get(ILabelService);
            const remoteAgentService = accessor.get(IRemoteAgentService);
            const notificationService = accessor.get(INotificationService);
            const remoteAuthority = remoteAgentService.getConnection()?.remoteAuthority ?? undefined;
            const backend = await accessor.get(ITerminalInstanceService).getBackend(remoteAuthority);
            if (!backend) {
                throw new Error(`No backend registered for remote authority '${remoteAuthority}'`);
            }
            const terms = await backend.listProcesses();
            backend.reduceConnectionGraceTime();
            const unattachedTerms = terms.filter(term => !c.service.isAttachedToTerminal(term));
            const items = unattachedTerms.map(term => {
                const cwdLabel = labelService.getUriLabel(URI.file(term.cwd));
                return {
                    label: term.title,
                    detail: term.workspaceName ? `${term.workspaceName} \u2E31 ${cwdLabel}` : cwdLabel,
                    description: term.pid ? String(term.pid) : '',
                    term
                };
            });
            if (items.length === 0) {
                notificationService.info(localize('noUnattachedTerminals', 'There are no unattached terminals to attach to'));
                return;
            }
            const selected = await quickInputService.pick(items, { canPickMany: false });
            if (selected) {
                const instance = await c.service.createTerminal({
                    config: { attachPersistentProcess: selected.term }
                });
                c.service.setActiveInstance(instance);
                await focusActiveTerminal(instance, c);
            }
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.scrollToPreviousCommand" /* TerminalCommandId.ScrollToPreviousCommand */,
        title: terminalStrings.scrollToPreviousCommand,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
            when: ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        icon: Codicon.arrowUp,
        menu: [
            {
                id: MenuId.ViewTitle,
                group: 'navigation',
                order: 4,
                when: ContextKeyExpr.equals('view', TERMINAL_VIEW_ID),
                isHiddenByDefault: true
            }
        ],
        run: (activeInstance) => activeInstance.xterm?.markTracker.scrollToPreviousMark(undefined, undefined, activeInstance.capabilities.has(2 /* TerminalCapability.CommandDetection */))
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.scrollToNextCommand" /* TerminalCommandId.ScrollToNextCommand */,
        title: terminalStrings.scrollToNextCommand,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
            when: ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        icon: Codicon.arrowDown,
        menu: [
            {
                id: MenuId.ViewTitle,
                group: 'navigation',
                order: 4,
                when: ContextKeyExpr.equals('view', TERMINAL_VIEW_ID),
                isHiddenByDefault: true
            }
        ],
        run: (activeInstance) => {
            activeInstance.xterm?.markTracker.scrollToNextMark();
            activeInstance.focus();
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.selectToPreviousCommand" /* TerminalCommandId.SelectToPreviousCommand */,
        title: localize2('workbench.action.terminal.selectToPreviousCommand', 'Select to Previous Command'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */,
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (activeInstance) => {
            activeInstance.xterm?.markTracker.selectToPreviousMark();
            activeInstance.focus();
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.selectToNextCommand" /* TerminalCommandId.SelectToNextCommand */,
        title: localize2('workbench.action.terminal.selectToNextCommand', 'Select to Next Command'),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */,
            when: TerminalContextKeys.focus,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: (activeInstance) => {
            activeInstance.xterm?.markTracker.selectToNextMark();
            activeInstance.focus();
        }
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.selectToPreviousLine" /* TerminalCommandId.SelectToPreviousLine */,
        title: localize2('workbench.action.terminal.selectToPreviousLine', 'Select to Previous Line'),
        precondition: sharedWhenClause.terminalAvailable,
        run: async (xterm, _, instance) => {
            xterm.markTracker.selectToPreviousLine();
            // prefer to call focus on the TerminalInstance for additional accessibility triggers
            (instance || xterm).focus();
        }
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.selectToNextLine" /* TerminalCommandId.SelectToNextLine */,
        title: localize2('workbench.action.terminal.selectToNextLine', 'Select to Next Line'),
        precondition: sharedWhenClause.terminalAvailable,
        run: async (xterm, _, instance) => {
            xterm.markTracker.selectToNextLine();
            // prefer to call focus on the TerminalInstance for additional accessibility triggers
            (instance || xterm).focus();
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.newWithCwd" /* TerminalCommandId.NewWithCwd */,
        title: terminalStrings.newWithCwd,
        metadata: {
            description: terminalStrings.newWithCwd.value,
            args: [{
                    name: 'args',
                    schema: {
                        type: 'object',
                        required: ['cwd'],
                        properties: {
                            cwd: {
                                description: localize('workbench.action.terminal.newWithCwd.cwd', "The directory to start the terminal at"),
                                type: 'string'
                            }
                        },
                    }
                }]
        },
        run: async (c, _, args) => {
            const cwd = isObject(args) && 'cwd' in args ? toOptionalString(args.cwd) : undefined;
            const instance = await c.service.createTerminal({ cwd });
            if (!instance) {
                return;
            }
            c.service.setActiveInstance(instance);
            await focusActiveTerminal(instance, c);
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.renameWithArg" /* TerminalCommandId.RenameWithArgs */,
        title: terminalStrings.renameWithArgs,
        metadata: {
            description: terminalStrings.renameWithArgs.value,
            args: [{
                    name: 'args',
                    schema: {
                        type: 'object',
                        required: ['name'],
                        properties: {
                            name: {
                                description: localize('workbench.action.terminal.renameWithArg.name', "The new name for the terminal"),
                                type: 'string',
                                minLength: 1
                            }
                        }
                    }
                }]
        },
        precondition: sharedWhenClause.terminalAvailable,
        run: async (activeInstance, c, accessor, args) => {
            const notificationService = accessor.get(INotificationService);
            const name = isObject(args) && 'name' in args ? toOptionalString(args.name) : undefined;
            if (!name) {
                notificationService.warn(localize('workbench.action.terminal.renameWithArg.noName', "No name argument provided"));
                return;
            }
            activeInstance.rename(name);
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.relaunch" /* TerminalCommandId.Relaunch */,
        title: localize2('workbench.action.terminal.relaunch', 'Relaunch Active Terminal'),
        run: (activeInstance) => activeInstance.relaunch()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.split" /* TerminalCommandId.Split */,
        title: terminalStrings.split,
        precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.webExtensionContributedProfile),
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 26 /* KeyCode.Digit5 */,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 93 /* KeyCode.Backslash */,
                secondary: [256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 26 /* KeyCode.Digit5 */]
            },
            when: TerminalContextKeys.focus
        },
        icon: Codicon.splitHorizontal,
        run: async (c, accessor, args) => {
            const optionsOrProfile = isObject(args) ? args : undefined;
            const commandService = accessor.get(ICommandService);
            const workspaceContextService = accessor.get(IWorkspaceContextService);
            const options = convertOptionsOrProfileToOptions(optionsOrProfile);
            const activeInstance = (await c.service.getInstanceHost(options?.location)).activeInstance;
            if (!activeInstance) {
                return;
            }
            const cwd = await getCwdForSplit(activeInstance, workspaceContextService.getWorkspace().folders, commandService, c.configService);
            if (cwd === undefined) {
                return;
            }
            const instance = await c.service.createTerminal({ location: { parentTerminal: activeInstance }, config: options?.config, cwd });
            await focusActiveTerminal(instance, c);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.splitActiveTab" /* TerminalCommandId.SplitActiveTab */,
        title: terminalStrings.split,
        f1: false,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 26 /* KeyCode.Digit5 */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 93 /* KeyCode.Backslash */,
                secondary: [256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 26 /* KeyCode.Digit5 */]
            },
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: TerminalContextKeys.tabsFocus
        },
        run: async (c, accessor) => {
            const instances = getSelectedInstances(accessor);
            if (instances) {
                const promises = [];
                for (const t of instances) {
                    promises.push((async () => {
                        await c.service.createTerminal({ location: { parentTerminal: t } });
                        await c.groupService.showPanel(true);
                    })());
                }
                await Promise.all(promises);
            }
        }
    });
    registerContextualInstanceAction({
        id: "workbench.action.terminal.unsplit" /* TerminalCommandId.Unsplit */,
        title: terminalStrings.unsplit,
        precondition: sharedWhenClause.terminalAvailable,
        run: async (instance, c) => {
            const group = c.groupService.getGroupForInstance(instance);
            if (group && group?.terminalInstances.length > 1) {
                c.groupService.unsplitInstance(instance);
            }
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.joinActiveTab" /* TerminalCommandId.JoinActiveTab */,
        title: localize2('workbench.action.terminal.joinInstance', 'Join Terminals'),
        precondition: ContextKeyExpr.and(sharedWhenClause.terminalAvailable, TerminalContextKeys.tabsSingularSelection.toNegated()),
        run: async (c, accessor) => {
            const instances = getSelectedInstances(accessor);
            if (instances && instances.length > 1) {
                c.groupService.joinInstances(instances);
            }
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.join" /* TerminalCommandId.Join */,
        title: localize2('workbench.action.terminal.join', 'Join Terminals...'),
        precondition: sharedWhenClause.terminalAvailable,
        run: async (c, accessor) => {
            const themeService = accessor.get(IThemeService);
            const notificationService = accessor.get(INotificationService);
            const quickInputService = accessor.get(IQuickInputService);
            const picks = [];
            if (c.groupService.instances.length <= 1) {
                notificationService.warn(localize('workbench.action.terminal.join.insufficientTerminals', 'Insufficient terminals for the join action'));
                return;
            }
            const otherInstances = c.groupService.instances.filter(i => i.instanceId !== c.groupService.activeInstance?.instanceId);
            for (const terminal of otherInstances) {
                const group = c.groupService.getGroupForInstance(terminal);
                if (group?.terminalInstances.length === 1) {
                    const iconId = getIconId(accessor, terminal);
                    const label = `$(${iconId}): ${terminal.title}`;
                    const iconClasses = [];
                    const colorClass = getColorClass(terminal);
                    if (colorClass) {
                        iconClasses.push(colorClass);
                    }
                    const uriClasses = getUriClasses(terminal, themeService.getColorTheme().type);
                    if (uriClasses) {
                        iconClasses.push(...uriClasses);
                    }
                    picks.push({
                        terminal,
                        label,
                        iconClasses
                    });
                }
            }
            if (picks.length === 0) {
                notificationService.warn(localize('workbench.action.terminal.join.onlySplits', 'All terminals are joined already'));
                return;
            }
            const result = await quickInputService.pick(picks, {});
            if (result) {
                c.groupService.joinInstances([result.terminal, c.groupService.activeInstance]);
            }
        }
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.splitInActiveWorkspace" /* TerminalCommandId.SplitInActiveWorkspace */,
        title: localize2('workbench.action.terminal.splitInActiveWorkspace', 'Split Terminal (In Active Workspace)'),
        run: async (instance, c) => {
            const newInstance = await c.service.createTerminal({ location: { parentTerminal: instance } });
            if (newInstance?.target !== TerminalLocation.Editor) {
                await c.groupService.showPanel(true);
            }
        }
    });
    registerActiveXtermAction({
        id: "workbench.action.terminal.selectAll" /* TerminalCommandId.SelectAll */,
        title: localize2('workbench.action.terminal.selectAll', 'Select All'),
        precondition: sharedWhenClause.terminalAvailable,
        keybinding: [{
                // Don't use ctrl+a by default as that would override the common go to start
                // of prompt shell binding
                primary: 0,
                // Technically this doesn't need to be here as it will fall back to this
                // behavior anyway when handed to xterm.js, having this handled by VS Code
                // makes it easier for users to see how it works though.
                mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 31 /* KeyCode.KeyA */ },
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: TerminalContextKeys.focusInAny
            }],
        run: (xterm) => xterm.selectAll()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.new" /* TerminalCommandId.New */,
        title: localize2('workbench.action.terminal.new', 'Create New Terminal'),
        precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.webExtensionContributedProfile),
        icon: newTerminalIcon,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 91 /* KeyCode.Backquote */,
            mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 91 /* KeyCode.Backquote */ },
            weight: 200 /* KeybindingWeight.WorkbenchContrib */
        },
        run: async (c, accessor, args) => {
            let eventOrOptions = isObject(args) ? args : undefined;
            const workspaceContextService = accessor.get(IWorkspaceContextService);
            const commandService = accessor.get(ICommandService);
            const folders = workspaceContextService.getWorkspace().folders;
            if (eventOrOptions && isMouseEvent(eventOrOptions) && (eventOrOptions.altKey || eventOrOptions.ctrlKey)) {
                await c.service.createTerminal({ location: { splitActiveTerminal: true } });
                return;
            }
            if (c.service.isProcessSupportRegistered) {
                eventOrOptions = !eventOrOptions || isMouseEvent(eventOrOptions) ? {} : eventOrOptions;
                let instance;
                if (folders.length <= 1) {
                    // Allow terminal service to handle the path when there is only a
                    // single root
                    instance = await c.service.createTerminal(eventOrOptions);
                }
                else {
                    const cwd = (await pickTerminalCwd(accessor))?.cwd;
                    if (!cwd) {
                        // Don't create the instance if the workspace picker was canceled
                        return;
                    }
                    eventOrOptions.cwd = cwd;
                    instance = await c.service.createTerminal(eventOrOptions);
                }
                c.service.setActiveInstance(instance);
                await focusActiveTerminal(instance, c);
            }
            else {
                if (c.profileService.contributedProfiles.length > 0) {
                    commandService.executeCommand("workbench.action.terminal.newWithProfile" /* TerminalCommandId.NewWithProfile */);
                }
                else {
                    commandService.executeCommand("workbench.action.terminal.toggleTerminal" /* TerminalCommandId.Toggle */);
                }
            }
        }
    });
    async function killInstance(c, instance) {
        if (!instance) {
            return;
        }
        await c.service.safeDisposeTerminal(instance);
        if (c.groupService.instances.length > 0) {
            await c.groupService.showPanel(true);
        }
    }
    registerTerminalAction({
        id: "workbench.action.terminal.kill" /* TerminalCommandId.Kill */,
        title: localize2('workbench.action.terminal.kill', 'Kill the Active Terminal Instance'),
        precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
        icon: killTerminalIcon,
        run: async (c) => killInstance(c, c.groupService.activeInstance)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.killViewOrEditor" /* TerminalCommandId.KillViewOrEditor */,
        title: terminalStrings.kill,
        f1: false, // This is an internal command used for context menus
        precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
        run: async (c) => killInstance(c, c.service.activeInstance)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.killAll" /* TerminalCommandId.KillAll */,
        title: localize2('workbench.action.terminal.killAll', 'Kill All Terminals'),
        precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
        icon: Codicon.trash,
        run: async (c) => {
            const disposePromises = [];
            for (const instance of c.service.instances) {
                disposePromises.push(c.service.safeDisposeTerminal(instance));
            }
            await Promise.all(disposePromises);
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.killEditor" /* TerminalCommandId.KillEditor */,
        title: localize2('workbench.action.terminal.killEditor', 'Kill the Active Terminal in Editor Area'),
        precondition: sharedWhenClause.terminalAvailable,
        keybinding: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 53 /* KeyCode.KeyW */,
            win: { primary: 2048 /* KeyMod.CtrlCmd */ | 62 /* KeyCode.F4 */, secondary: [2048 /* KeyMod.CtrlCmd */ | 53 /* KeyCode.KeyW */] },
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.editorFocus)
        },
        run: (c, accessor) => accessor.get(ICommandService).executeCommand(CLOSE_EDITOR_COMMAND_ID)
    });
    registerTerminalAction({
        id: "workbench.action.terminal.killActiveTab" /* TerminalCommandId.KillActiveTab */,
        title: terminalStrings.kill,
        f1: false,
        precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
        keybinding: {
            primary: 20 /* KeyCode.Delete */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
                secondary: [20 /* KeyCode.Delete */]
            },
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: TerminalContextKeys.tabsFocus
        },
        run: async (c, accessor) => {
            const disposePromises = [];
            for (const terminal of getSelectedInstances(accessor, true) ?? []) {
                disposePromises.push(c.service.safeDisposeTerminal(terminal));
            }
            await Promise.all(disposePromises);
            c.groupService.focusTabs();
        }
    });
    registerTerminalAction({
        id: "workbench.action.terminal.focusHover" /* TerminalCommandId.FocusHover */,
        title: terminalStrings.focusHover,
        precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
        keybinding: {
            primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.or(TerminalContextKeys.tabsFocus, TerminalContextKeys.focus)
        },
        run: (c) => c.groupService.focusHover()
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.clear" /* TerminalCommandId.Clear */,
        title: localize2('workbench.action.terminal.clear', 'Clear'),
        precondition: sharedWhenClause.terminalAvailable,
        keybinding: [{
                primary: 0,
                mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */ },
                // Weight is higher than work workbench contributions so the keybinding remains
                // highest priority when chords are registered afterwards
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
                // Disable the keybinding when accessibility mode is enabled as chords include
                // important screen reader keybindings such as cmd+k, cmd+i to show the hover
                when: ContextKeyExpr.or(ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()), ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, accessibleViewIsShown, accessibleViewCurrentProviderId.isEqualTo("terminal" /* AccessibleViewProviderId.Terminal */))),
            }],
        run: (activeInstance) => activeInstance.clearBuffer()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.selectDefaultShell" /* TerminalCommandId.SelectDefaultProfile */,
        title: localize2('workbench.action.terminal.selectDefaultShell', 'Select Default Profile'),
        run: (c) => c.service.showProfileQuickPick('setDefault')
    });
    registerTerminalAction({
        id: "workbench.action.terminal.openSettings" /* TerminalCommandId.ConfigureTerminalSettings */,
        title: localize2('workbench.action.terminal.openSettings', 'Configure Terminal Settings'),
        precondition: sharedWhenClause.terminalAvailable,
        run: (c, accessor) => accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@feature:terminal' })
    });
    registerActiveInstanceAction({
        id: "workbench.action.terminal.setDimensions" /* TerminalCommandId.SetDimensions */,
        title: localize2('workbench.action.terminal.setFixedDimensions', 'Set Fixed Dimensions'),
        precondition: sharedWhenClause.terminalAvailable_and_opened,
        run: (activeInstance) => activeInstance.setFixedDimensions()
    });
    registerContextualInstanceAction({
        id: "workbench.action.terminal.sizeToContentWidth" /* TerminalCommandId.SizeToContentWidth */,
        title: terminalStrings.toggleSizeToContentWidth,
        precondition: sharedWhenClause.terminalAvailable_and_opened,
        keybinding: {
            primary: 512 /* KeyMod.Alt */ | 56 /* KeyCode.KeyZ */,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: TerminalContextKeys.focus
        },
        run: (instance) => instance.toggleSizeToContentWidth()
    });
    registerTerminalAction({
        id: "workbench.action.terminal.switchTerminal" /* TerminalCommandId.SwitchTerminal */,
        title: localize2('workbench.action.terminal.switchTerminal', 'Switch Terminal'),
        precondition: sharedWhenClause.terminalAvailable,
        run: async (c, accessor, args) => {
            const item = toOptionalString(args);
            if (!item) {
                return;
            }
            if (item === switchTerminalActionViewItemSeparator) {
                c.service.refreshActiveGroup();
                return;
            }
            if (item === switchTerminalShowTabsTitle) {
                accessor.get(IConfigurationService).updateValue("terminal.integrated.tabs.enabled" /* TerminalSettingId.TabsEnabled */, true);
                return;
            }
            const terminalIndexRe = /^([0-9]+): /;
            const indexMatches = terminalIndexRe.exec(item);
            if (indexMatches) {
                c.groupService.setActiveGroupByIndex(Number(indexMatches[1]) - 1);
                return c.groupService.showPanel(true);
            }
            const quickSelectProfiles = c.profileService.availableProfiles;
            // Remove 'New ' from the selected item to get the profile name
            const profileSelection = item.substring(4);
            if (quickSelectProfiles) {
                const profile = quickSelectProfiles.find(profile => profile.profileName === profileSelection);
                if (profile) {
                    const instance = await c.service.createTerminal({
                        config: profile
                    });
                    c.service.setActiveInstance(instance);
                }
                else {
                    console.warn(`No profile with name "${profileSelection}"`);
                }
            }
            else {
                console.warn(`Unmatched terminal item: "${item}"`);
            }
        }
    });
}
function getSelectedInstances2(accessor, args) {
    const terminalService = accessor.get(ITerminalService);
    const result = [];
    const context = parseActionArgs(args);
    if (context && context.length > 0) {
        for (const instanceContext of context) {
            const instance = terminalService.getInstanceFromId(instanceContext.instanceId);
            if (instance) {
                result.push(instance);
            }
        }
        if (result.length > 0) {
            return result;
        }
    }
    return undefined;
}
function getSelectedInstances(accessor, args, args2) {
    const listService = accessor.get(IListService);
    const terminalService = accessor.get(ITerminalService);
    const terminalGroupService = accessor.get(ITerminalGroupService);
    const result = [];
    // Assign list only if it's an instance of TerminalTabList (#234791)
    const list = listService.lastFocusedList instanceof TerminalTabList ? listService.lastFocusedList : undefined;
    // Get selected tab list instance(s)
    const selections = list?.getSelection();
    // Get inline tab instance if there are not tab list selections #196578
    if (terminalGroupService.lastAccessedMenu === 'inline-tab' && !selections?.length) {
        const instance = terminalGroupService.activeInstance;
        return instance ? [terminalGroupService.activeInstance] : undefined;
    }
    if (!list || !selections) {
        return undefined;
    }
    const focused = list.getFocus();
    if (focused.length === 1 && !selections.includes(focused[0])) {
        // focused length is always a max of 1
        // if the focused one is not in the selected list, return that item
        result.push(terminalService.getInstanceFromIndex(focused[0]));
        return result;
    }
    // multi-select
    for (const selection of selections) {
        result.push(terminalService.getInstanceFromIndex(selection));
    }
    return result.filter(r => !!r);
}
export function validateTerminalName(name) {
    if (!name || name.trim().length === 0) {
        return {
            content: localize('emptyTerminalNameInfo', "Providing no name will reset it to the default value"),
            severity: Severity.Info
        };
    }
    return null;
}
function convertOptionsOrProfileToOptions(optionsOrProfile) {
    if (isObject(optionsOrProfile) && 'profileName' in optionsOrProfile) {
        return { config: optionsOrProfile, location: optionsOrProfile.location };
    }
    return optionsOrProfile;
}
let newWithProfileAction;
export function refreshTerminalActions(detectedProfiles) {
    const profileEnum = createProfileSchemaEnums(detectedProfiles);
    newWithProfileAction?.dispose();
    // TODO: Use new register function
    newWithProfileAction = registerAction2(class extends Action2 {
        constructor() {
            super({
                id: "workbench.action.terminal.newWithProfile" /* TerminalCommandId.NewWithProfile */,
                title: localize2('workbench.action.terminal.newWithProfile', 'Create New Terminal (With Profile)'),
                f1: true,
                precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.webExtensionContributedProfile),
                metadata: {
                    description: "workbench.action.terminal.newWithProfile" /* TerminalCommandId.NewWithProfile */,
                    args: [{
                            name: 'args',
                            schema: {
                                type: 'object',
                                required: ['profileName'],
                                properties: {
                                    profileName: {
                                        description: localize('workbench.action.terminal.newWithProfile.profileName', "The name of the profile to create"),
                                        type: 'string',
                                        enum: profileEnum.values,
                                        markdownEnumDescriptions: profileEnum.markdownDescriptions
                                    },
                                    location: {
                                        description: localize('newWithProfile.location', "Where to create the terminal"),
                                        type: 'string',
                                        enum: ['view', 'editor'],
                                        enumDescriptions: [
                                            localize('newWithProfile.location.view', 'Create the terminal in the terminal view'),
                                            localize('newWithProfile.location.editor', 'Create the terminal in the editor'),
                                        ]
                                    }
                                }
                            }
                        }]
                },
            });
        }
        async run(accessor, eventOrOptionsOrProfile, profile) {
            const c = getTerminalServices(accessor);
            const workspaceContextService = accessor.get(IWorkspaceContextService);
            const commandService = accessor.get(ICommandService);
            let event;
            let options;
            let instance;
            let cwd;
            if (isObject(eventOrOptionsOrProfile) && eventOrOptionsOrProfile && 'profileName' in eventOrOptionsOrProfile) {
                const config = c.profileService.availableProfiles.find(profile => profile.profileName === eventOrOptionsOrProfile.profileName);
                if (!config) {
                    throw new Error(`Could not find terminal profile "${eventOrOptionsOrProfile.profileName}"`);
                }
                options = { config };
                if ('location' in eventOrOptionsOrProfile) {
                    switch (eventOrOptionsOrProfile.location) {
                        case 'editor':
                            options.location = TerminalLocation.Editor;
                            break;
                        case 'view':
                            options.location = TerminalLocation.Panel;
                            break;
                    }
                }
            }
            else if (isMouseEvent(eventOrOptionsOrProfile) || isPointerEvent(eventOrOptionsOrProfile) || isKeyboardEvent(eventOrOptionsOrProfile)) {
                event = eventOrOptionsOrProfile;
                options = profile ? { config: profile } : undefined;
            }
            else {
                options = convertOptionsOrProfileToOptions(eventOrOptionsOrProfile);
            }
            // split terminal
            if (event && (event.altKey || event.ctrlKey)) {
                const parentTerminal = c.service.activeInstance;
                if (parentTerminal) {
                    await c.service.createTerminal({ location: { parentTerminal }, config: options?.config });
                    return;
                }
            }
            const folders = workspaceContextService.getWorkspace().folders;
            if (folders.length > 1) {
                // multi-root workspace, create root picker
                const options = {
                    placeHolder: localize('workbench.action.terminal.newWorkspacePlaceholder', "Select current working directory for new terminal")
                };
                const workspace = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID, [options]);
                if (!workspace) {
                    // Don't create the instance if the workspace picker was canceled
                    return;
                }
                cwd = workspace.uri;
            }
            if (options) {
                options.cwd = cwd;
                instance = await c.service.createTerminal(options);
            }
            else {
                instance = await c.service.showProfileQuickPick('createInstance', cwd);
            }
            if (instance) {
                c.service.setActiveInstance(instance);
                await focusActiveTerminal(instance, c);
            }
        }
    });
    return newWithProfileAction;
}
function getResourceOrActiveInstance(c, resource) {
    return c.service.getInstanceFromResource(toOptionalUri(resource)) || c.service.activeInstance;
}
async function pickTerminalCwd(accessor, cancel) {
    const quickInputService = accessor.get(IQuickInputService);
    const labelService = accessor.get(ILabelService);
    const contextService = accessor.get(IWorkspaceContextService);
    const modelService = accessor.get(IModelService);
    const languageService = accessor.get(ILanguageService);
    const configurationService = accessor.get(IConfigurationService);
    const configurationResolverService = accessor.get(IConfigurationResolverService);
    const folders = contextService.getWorkspace().folders;
    if (!folders.length) {
        return;
    }
    const folderCwdPairs = await Promise.all(folders.map(e => resolveWorkspaceFolderCwd(e, configurationService, configurationResolverService)));
    const shrinkedPairs = shrinkWorkspaceFolderCwdPairs(folderCwdPairs);
    if (shrinkedPairs.length === 1) {
        return shrinkedPairs[0];
    }
    const folderPicks = shrinkedPairs.map(pair => {
        const label = pair.folder.name;
        const description = pair.isOverridden
            ? localize('workbench.action.terminal.overriddenCwdDescription', "(Overriden) {0}", labelService.getUriLabel(pair.cwd, { relative: !pair.isAbsolute }))
            : labelService.getUriLabel(dirname(pair.cwd), { relative: true });
        return {
            label,
            description: description !== label ? description : undefined,
            pair: pair,
            iconClasses: getIconClasses(modelService, languageService, pair.cwd, FileKind.ROOT_FOLDER)
        };
    });
    const options = {
        placeHolder: localize('workbench.action.terminal.newWorkspacePlaceholder', "Select current working directory for new terminal"),
        matchOnDescription: true,
        canPickMany: false,
    };
    const token = cancel || CancellationToken.None;
    const pick = await quickInputService.pick(folderPicks, options, token);
    return pick?.pair;
}
async function resolveWorkspaceFolderCwd(folder, configurationService, configurationResolverService) {
    const cwdConfig = configurationService.getValue("terminal.integrated.cwd" /* TerminalSettingId.Cwd */, { resource: folder.uri });
    if (!isString(cwdConfig) || cwdConfig.length === 0) {
        return { folder, cwd: folder.uri, isAbsolute: false, isOverridden: false };
    }
    const resolvedCwdConfig = await configurationResolverService.resolveAsync(folder, cwdConfig);
    return isAbsolute(resolvedCwdConfig) || resolvedCwdConfig.startsWith(ConfigurationResolverExpression.VARIABLE_LHS)
        ? { folder, isAbsolute: true, isOverridden: true, cwd: URI.from({ ...folder.uri, path: resolvedCwdConfig }) }
        : { folder, isAbsolute: false, isOverridden: true, cwd: URI.joinPath(folder.uri, resolvedCwdConfig) };
}
/**
 * Drops repeated CWDs, if any, by keeping the one which best matches the workspace folder. It also preserves the original order.
 */
export function shrinkWorkspaceFolderCwdPairs(pairs) {
    const map = new Map();
    for (const pair of pairs) {
        const key = pair.cwd.toString();
        const value = map.get(key);
        if (!value || key === pair.folder.uri.toString()) {
            map.set(key, pair);
        }
    }
    const selectedPairs = new Set(map.values());
    const selectedPairsInOrder = pairs.filter(x => selectedPairs.has(x));
    return selectedPairsInOrder;
}
async function focusActiveTerminal(instance, c) {
    if (instance.target === TerminalLocation.Editor) {
        await c.editorService.revealActiveEditor();
        await instance.focusWhenReady(true);
    }
    else {
        await c.groupService.showPanel(true);
    }
}
async function renameWithQuickPick(c, accessor, resource) {
    let instance = resource;
    // Check if the 'instance' does not exist or if 'instance.rename' is not defined
    if (!instance || !instance?.rename) {
        // If not, obtain the resource instance using 'getResourceOrActiveInstance'
        instance = getResourceOrActiveInstance(c, resource);
    }
    if (instance) {
        const title = await accessor.get(IQuickInputService).input({
            value: instance.title,
            prompt: localize('workbench.action.terminal.rename.prompt', "Enter terminal name"),
        });
        if (title) {
            instance.rename(title);
        }
    }
}
function toOptionalUri(obj) {
    return URI.isUri(obj) ? obj : undefined;
}
function toOptionalString(obj) {
    return isString(obj) ? obj : undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFtQixNQUFNLHFDQUFxQyxDQUFDO0FBRWhGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUVuRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxF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