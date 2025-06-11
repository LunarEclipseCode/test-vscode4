/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from '../../../../platform/registry/common/platform.js';
import { localize, localize2 } from '../../../../nls.js';
import { EditorPaneDescriptor } from '../../editor.js';
import { EditorExtensions } from '../../../common/editor.js';
import { TextCompareEditorActiveContext, ActiveEditorPinnedContext, EditorGroupEditorsCountContext, ActiveEditorStickyContext, ActiveEditorAvailableEditorIdsContext, EditorPartMultipleEditorGroupsContext, ActiveEditorDirtyContext, ActiveEditorGroupLockedContext, ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext, EditorTabsVisibleContext, ActiveEditorLastInGroupContext, EditorPartMaximizedEditorGroupContext, MultipleEditorGroupsContext, InEditorZenModeContext, IsAuxiliaryWindowContext, ActiveCompareEditorCanSwapContext, MultipleEditorsSelectedInGroupContext } from '../../../common/contextkeys.js';
import { SideBySideEditorInput, SideBySideEditorInputSerializer } from '../../../common/editor/sideBySideEditorInput.js';
import { TextResourceEditor } from './textResourceEditor.js';
import { SideBySideEditor } from './sideBySideEditor.js';
import { DiffEditorInput, DiffEditorInputSerializer } from '../../../common/editor/diffEditorInput.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { TextResourceEditorInput } from '../../../common/editor/textResourceEditorInput.js';
import { TextDiffEditor } from './textDiffEditor.js';
import { BinaryResourceDiffEditor } from './binaryDiffEditor.js';
import { ChangeEncodingAction, ChangeEOLAction, ChangeLanguageAction, EditorStatusContribution } from './editorStatus.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { MenuRegistry, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { CloseEditorsInOtherGroupsAction, CloseAllEditorsAction, MoveGroupLeftAction, MoveGroupRightAction, SplitEditorAction, JoinTwoGroupsAction, RevertAndCloseEditorAction, NavigateBetweenGroupsAction, FocusActiveGroupAction, FocusFirstGroupAction, ResetGroupSizesAction, MinimizeOtherGroupsAction, FocusPreviousGroup, FocusNextGroup, CloseLeftEditorsInGroupAction, OpenNextEditor, OpenPreviousEditor, NavigateBackwardsAction, NavigateForwardAction, NavigatePreviousAction, ReopenClosedEditorAction, QuickAccessPreviousRecentlyUsedEditorInGroupAction, QuickAccessPreviousEditorFromHistoryAction, ShowAllEditorsByAppearanceAction, ClearEditorHistoryAction, MoveEditorRightInGroupAction, OpenNextEditorInGroup, OpenPreviousEditorInGroup, OpenNextRecentlyUsedEditorAction, OpenPreviousRecentlyUsedEditorAction, MoveEditorToPreviousGroupAction, MoveEditorToNextGroupAction, MoveEditorToFirstGroupAction, MoveEditorLeftInGroupAction, ClearRecentFilesAction, OpenLastEditorInGroup, ShowEditorsInActiveGroupByMostRecentlyUsedAction, MoveEditorToLastGroupAction, OpenFirstEditorInGroup, MoveGroupUpAction, MoveGroupDownAction, FocusLastGroupAction, SplitEditorLeftAction, SplitEditorRightAction, SplitEditorUpAction, SplitEditorDownAction, MoveEditorToLeftGroupAction, MoveEditorToRightGroupAction, MoveEditorToAboveGroupAction, MoveEditorToBelowGroupAction, CloseAllEditorGroupsAction, JoinAllGroupsAction, FocusLeftGroup, FocusAboveGroup, FocusRightGroup, FocusBelowGroup, EditorLayoutSingleAction, EditorLayoutTwoColumnsAction, EditorLayoutThreeColumnsAction, EditorLayoutTwoByTwoGridAction, EditorLayoutTwoRowsAction, EditorLayoutThreeRowsAction, EditorLayoutTwoColumnsBottomAction, EditorLayoutTwoRowsRightAction, NewEditorGroupLeftAction, NewEditorGroupRightAction, NewEditorGroupAboveAction, NewEditorGroupBelowAction, SplitEditorOrthogonalAction, CloseEditorInAllGroupsAction, NavigateToLastEditLocationAction, ToggleGroupSizesAction, ShowAllEditorsByMostRecentlyUsedAction, QuickAccessPreviousRecentlyUsedEditorAction, OpenPreviousRecentlyUsedEditorInGroupAction, OpenNextRecentlyUsedEditorInGroupAction, QuickAccessLeastRecentlyUsedEditorAction, QuickAccessLeastRecentlyUsedEditorInGroupAction, ReOpenInTextEditorAction, DuplicateGroupDownAction, DuplicateGroupLeftAction, DuplicateGroupRightAction, DuplicateGroupUpAction, ToggleEditorTypeAction, SplitEditorToAboveGroupAction, SplitEditorToBelowGroupAction, SplitEditorToFirstGroupAction, SplitEditorToLastGroupAction, SplitEditorToLeftGroupAction, SplitEditorToNextGroupAction, SplitEditorToPreviousGroupAction, SplitEditorToRightGroupAction, NavigateForwardInEditsAction, NavigateBackwardsInEditsAction, NavigateForwardInNavigationsAction, NavigateBackwardsInNavigationsAction, NavigatePreviousInNavigationsAction, NavigatePreviousInEditsAction, NavigateToLastNavigationLocationAction, MaximizeGroupHideSidebarAction, MoveEditorToNewWindowAction, CopyEditorToNewindowAction, RestoreEditorsToMainWindowAction, ToggleMaximizeEditorGroupAction, MinimizeOtherGroupsHideSidebarAction, CopyEditorGroupToNewWindowAction, MoveEditorGroupToNewWindowAction, NewEmptyEditorWindowAction } from './editorActions.js';
import { CLOSE_EDITORS_AND_GROUP_COMMAND_ID, CLOSE_EDITORS_IN_GROUP_COMMAND_ID, CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, CLOSE_EDITOR_COMMAND_ID, CLOSE_EDITOR_GROUP_COMMAND_ID, CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, CLOSE_PINNED_EDITOR_COMMAND_ID, CLOSE_SAVED_EDITORS_COMMAND_ID, KEEP_EDITOR_COMMAND_ID, PIN_EDITOR_COMMAND_ID, SHOW_EDITORS_IN_GROUP, SPLIT_EDITOR_DOWN, SPLIT_EDITOR_LEFT, SPLIT_EDITOR_RIGHT, SPLIT_EDITOR_UP, TOGGLE_KEEP_EDITORS_COMMAND_ID, UNPIN_EDITOR_COMMAND_ID, setup as registerEditorCommands, REOPEN_WITH_COMMAND_ID, TOGGLE_LOCK_GROUP_COMMAND_ID, UNLOCK_GROUP_COMMAND_ID, SPLIT_EDITOR_IN_GROUP, JOIN_EDITOR_IN_GROUP, FOCUS_FIRST_SIDE_EDITOR, FOCUS_SECOND_SIDE_EDITOR, TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT, LOCK_GROUP_COMMAND_ID, SPLIT_EDITOR, TOGGLE_MAXIMIZE_EDITOR_GROUP, MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID } from './editorCommands.js';
import { GOTO_NEXT_CHANGE, GOTO_PREVIOUS_CHANGE, TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE, TOGGLE_DIFF_SIDE_BY_SIDE, DIFF_SWAP_SIDES } from './diffEditorCommands.js';
import { inQuickPickContext, getQuickNavigateHandler } from '../../quickaccess.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { registerEditorContribution } from '../../../../editor/browser/editorExtensions.js';
import { FloatingEditorClickMenu } from '../../codeeditor.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorAutoSave } from './editorAutoSave.js';
import { Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { ActiveGroupEditorsByMostRecentlyUsedQuickAccess, AllEditorsByAppearanceQuickAccess, AllEditorsByMostRecentlyUsedQuickAccess } from './editorQuickAccess.js';
import { FileAccess } from '../../../../base/common/network.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { UntitledTextEditorInputSerializer, UntitledTextEditorWorkingCopyEditorHandler } from '../../../services/untitled/common/untitledTextEditorHandler.js';
import { DynamicEditorConfigurations } from './editorConfiguration.js';
import { ConfigureEditorAction, ConfigureEditorTabsAction, EditorActionsDefaultAction, EditorActionsTitleBarAction, HideEditorActionsAction, HideEditorTabsAction, ShowMultipleEditorTabsAction, ShowSingleEditorTabAction, ZenHideEditorTabsAction, ZenShowMultipleEditorTabsAction, ZenShowSingleEditorTabAction } from '../../actions/layoutActions.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { getFontSnippets } from '../../../../base/browser/fonts.js';
import { registerEditorFontConfigurations } from '../../../../editor/common/config/editorConfigurationSchema.js';
//#region Editor Registrations
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TextResourceEditor, TextResourceEditor.ID, localize('textEditor', "Text Editor")), [
    new SyncDescriptor(UntitledTextEditorInput),
    new SyncDescriptor(TextResourceEditorInput)
]);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TextDiffEditor, TextDiffEditor.ID, localize('textDiffEditor', "Text Diff Editor")), [
    new SyncDescriptor(DiffEditorInput)
]);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(BinaryResourceDiffEditor, BinaryResourceDiffEditor.ID, localize('binaryDiffEditor', "Binary Diff Editor")), [
    new SyncDescriptor(DiffEditorInput)
]);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(SideBySideEditor, SideBySideEditor.ID, localize('sideBySideEditor', "Side by Side Editor")), [
    new SyncDescriptor(SideBySideEditorInput)
]);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(UntitledTextEditorInput.ID, UntitledTextEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(SideBySideEditorInput.ID, SideBySideEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(DiffEditorInput.ID, DiffEditorInputSerializer);
//#endregion
//#region Workbench Contributions
registerWorkbenchContribution2(EditorAutoSave.ID, EditorAutoSave, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(EditorStatusContribution.ID, EditorStatusContribution, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(UntitledTextEditorWorkingCopyEditorHandler.ID, UntitledTextEditorWorkingCopyEditorHandler, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(DynamicEditorConfigurations.ID, DynamicEditorConfigurations, 2 /* WorkbenchPhase.BlockRestore */);
registerEditorContribution(FloatingEditorClickMenu.ID, FloatingEditorClickMenu, 1 /* EditorContributionInstantiation.AfterFirstRender */);
//#endregion
//#region Quick Access
const quickAccessRegistry = Registry.as(QuickAccessExtensions.Quickaccess);
const editorPickerContextKey = 'inEditorsPicker';
const editorPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(editorPickerContextKey));
quickAccessRegistry.registerQuickAccessProvider({
    ctor: ActiveGroupEditorsByMostRecentlyUsedQuickAccess,
    prefix: ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX,
    contextKey: editorPickerContextKey,
    placeholder: localize('editorQuickAccessPlaceholder', "Type the name of an editor to open it."),
    helpEntries: [{ description: localize('activeGroupEditorsByMostRecentlyUsedQuickAccess', "Show Editors in Active Group by Most Recently Used"), commandId: ShowEditorsInActiveGroupByMostRecentlyUsedAction.ID }]
});
quickAccessRegistry.registerQuickAccessProvider({
    ctor: AllEditorsByAppearanceQuickAccess,
    prefix: AllEditorsByAppearanceQuickAccess.PREFIX,
    contextKey: editorPickerContextKey,
    placeholder: localize('editorQuickAccessPlaceholder', "Type the name of an editor to open it."),
    helpEntries: [{ description: localize('allEditorsByAppearanceQuickAccess', "Show All Opened Editors By Appearance"), commandId: ShowAllEditorsByAppearanceAction.ID }]
});
quickAccessRegistry.registerQuickAccessProvider({
    ctor: AllEditorsByMostRecentlyUsedQuickAccess,
    prefix: AllEditorsByMostRecentlyUsedQuickAccess.PREFIX,
    contextKey: editorPickerContextKey,
    placeholder: localize('editorQuickAccessPlaceholder', "Type the name of an editor to open it."),
    helpEntries: [{ description: localize('allEditorsByMostRecentlyUsedQuickAccess', "Show All Opened Editors By Most Recently Used"), commandId: ShowAllEditorsByMostRecentlyUsedAction.ID }]
});
//#endregion
//#region Actions & Commands
registerAction2(ChangeLanguageAction);
registerAction2(ChangeEOLAction);
registerAction2(ChangeEncodingAction);
registerAction2(NavigateForwardAction);
registerAction2(NavigateBackwardsAction);
registerAction2(OpenNextEditor);
registerAction2(OpenPreviousEditor);
registerAction2(OpenNextEditorInGroup);
registerAction2(OpenPreviousEditorInGroup);
registerAction2(OpenFirstEditorInGroup);
registerAction2(OpenLastEditorInGroup);
registerAction2(OpenNextRecentlyUsedEditorAction);
registerAction2(OpenPreviousRecentlyUsedEditorAction);
registerAction2(OpenNextRecentlyUsedEditorInGroupAction);
registerAction2(OpenPreviousRecentlyUsedEditorInGroupAction);
registerAction2(ReopenClosedEditorAction);
registerAction2(ClearRecentFilesAction);
registerAction2(ShowAllEditorsByAppearanceAction);
registerAction2(ShowAllEditorsByMostRecentlyUsedAction);
registerAction2(ShowEditorsInActiveGroupByMostRecentlyUsedAction);
registerAction2(CloseAllEditorsAction);
registerAction2(CloseAllEditorGroupsAction);
registerAction2(CloseLeftEditorsInGroupAction);
registerAction2(CloseEditorsInOtherGroupsAction);
registerAction2(CloseEditorInAllGroupsAction);
registerAction2(RevertAndCloseEditorAction);
registerAction2(SplitEditorAction);
registerAction2(SplitEditorOrthogonalAction);
registerAction2(SplitEditorLeftAction);
registerAction2(SplitEditorRightAction);
registerAction2(SplitEditorUpAction);
registerAction2(SplitEditorDownAction);
registerAction2(JoinTwoGroupsAction);
registerAction2(JoinAllGroupsAction);
registerAction2(NavigateBetweenGroupsAction);
registerAction2(ResetGroupSizesAction);
registerAction2(ToggleGroupSizesAction);
registerAction2(MaximizeGroupHideSidebarAction);
registerAction2(ToggleMaximizeEditorGroupAction);
registerAction2(MinimizeOtherGroupsAction);
registerAction2(MinimizeOtherGroupsHideSidebarAction);
registerAction2(MoveEditorLeftInGroupAction);
registerAction2(MoveEditorRightInGroupAction);
registerAction2(MoveGroupLeftAction);
registerAction2(MoveGroupRightAction);
registerAction2(MoveGroupUpAction);
registerAction2(MoveGroupDownAction);
registerAction2(DuplicateGroupLeftAction);
registerAction2(DuplicateGroupRightAction);
registerAction2(DuplicateGroupUpAction);
registerAction2(DuplicateGroupDownAction);
registerAction2(MoveEditorToPreviousGroupAction);
registerAction2(MoveEditorToNextGroupAction);
registerAction2(MoveEditorToFirstGroupAction);
registerAction2(MoveEditorToLastGroupAction);
registerAction2(MoveEditorToLeftGroupAction);
registerAction2(MoveEditorToRightGroupAction);
registerAction2(MoveEditorToAboveGroupAction);
registerAction2(MoveEditorToBelowGroupAction);
registerAction2(SplitEditorToPreviousGroupAction);
registerAction2(SplitEditorToNextGroupAction);
registerAction2(SplitEditorToFirstGroupAction);
registerAction2(SplitEditorToLastGroupAction);
registerAction2(SplitEditorToLeftGroupAction);
registerAction2(SplitEditorToRightGroupAction);
registerAction2(SplitEditorToAboveGroupAction);
registerAction2(SplitEditorToBelowGroupAction);
registerAction2(FocusActiveGroupAction);
registerAction2(FocusFirstGroupAction);
registerAction2(FocusLastGroupAction);
registerAction2(FocusPreviousGroup);
registerAction2(FocusNextGroup);
registerAction2(FocusLeftGroup);
registerAction2(FocusRightGroup);
registerAction2(FocusAboveGroup);
registerAction2(FocusBelowGroup);
registerAction2(NewEditorGroupLeftAction);
registerAction2(NewEditorGroupRightAction);
registerAction2(NewEditorGroupAboveAction);
registerAction2(NewEditorGroupBelowAction);
registerAction2(NavigatePreviousAction);
registerAction2(NavigateForwardInEditsAction);
registerAction2(NavigateBackwardsInEditsAction);
registerAction2(NavigatePreviousInEditsAction);
registerAction2(NavigateToLastEditLocationAction);
registerAction2(NavigateForwardInNavigationsAction);
registerAction2(NavigateBackwardsInNavigationsAction);
registerAction2(NavigatePreviousInNavigationsAction);
registerAction2(NavigateToLastNavigationLocationAction);
registerAction2(ClearEditorHistoryAction);
registerAction2(EditorLayoutSingleAction);
registerAction2(EditorLayoutTwoColumnsAction);
registerAction2(EditorLayoutThreeColumnsAction);
registerAction2(EditorLayoutTwoRowsAction);
registerAction2(EditorLayoutThreeRowsAction);
registerAction2(EditorLayoutTwoByTwoGridAction);
registerAction2(EditorLayoutTwoRowsRightAction);
registerAction2(EditorLayoutTwoColumnsBottomAction);
registerAction2(ToggleEditorTypeAction);
registerAction2(ReOpenInTextEditorAction);
registerAction2(QuickAccessPreviousRecentlyUsedEditorAction);
registerAction2(QuickAccessLeastRecentlyUsedEditorAction);
registerAction2(QuickAccessPreviousRecentlyUsedEditorInGroupAction);
registerAction2(QuickAccessLeastRecentlyUsedEditorInGroupAction);
registerAction2(QuickAccessPreviousEditorFromHistoryAction);
registerAction2(MoveEditorToNewWindowAction);
registerAction2(CopyEditorToNewindowAction);
registerAction2(MoveEditorGroupToNewWindowAction);
registerAction2(CopyEditorGroupToNewWindowAction);
registerAction2(RestoreEditorsToMainWindowAction);
registerAction2(NewEmptyEditorWindowAction);
const quickAccessNavigateNextInEditorPickerId = 'workbench.action.quickOpenNavigateNextInEditorPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: quickAccessNavigateNextInEditorPickerId,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 50,
    handler: getQuickNavigateHandler(quickAccessNavigateNextInEditorPickerId, true),
    when: editorPickerContext,
    primary: 2048 /* KeyMod.CtrlCmd */ | 2 /* KeyCode.Tab */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 2 /* KeyCode.Tab */ }
});
const quickAccessNavigatePreviousInEditorPickerId = 'workbench.action.quickOpenNavigatePreviousInEditorPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: quickAccessNavigatePreviousInEditorPickerId,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 50,
    handler: getQuickNavigateHandler(quickAccessNavigatePreviousInEditorPickerId, false),
    when: editorPickerContext,
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */ }
});
registerEditorCommands();
//#endregion
//#region Menus
// macOS: Touchbar
if (isMacintosh) {
    MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
        command: { id: NavigateBackwardsAction.ID, title: NavigateBackwardsAction.LABEL, icon: { dark: FileAccess.asFileUri('vs/workbench/browser/parts/editor/media/back-tb.png') } },
        group: 'navigation',
        order: 0
    });
    MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
        command: { id: NavigateForwardAction.ID, title: NavigateForwardAction.LABEL, icon: { dark: FileAccess.asFileUri('vs/workbench/browser/parts/editor/media/forward-tb.png') } },
        group: 'navigation',
        order: 1
    });
}
// Empty Editor Group Toolbar
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: LOCK_GROUP_COMMAND_ID, title: localize('lockGroupAction', "Lock Group"), icon: Codicon.unlock }, group: 'navigation', order: 10, when: ContextKeyExpr.and(IsAuxiliaryWindowContext, ActiveEditorGroupLockedContext.toNegated()) });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: UNLOCK_GROUP_COMMAND_ID, title: localize('unlockGroupAction', "Unlock Group"), icon: Codicon.lock, toggled: ContextKeyExpr.true() }, group: 'navigation', order: 10, when: ActiveEditorGroupLockedContext });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: CLOSE_EDITOR_GROUP_COMMAND_ID, title: localize('closeGroupAction', "Close Group"), icon: Codicon.close }, group: 'navigation', order: 20, when: ContextKeyExpr.or(IsAuxiliaryWindowContext, EditorPartMultipleEditorGroupsContext) });
// Empty Editor Group Context Menu
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_UP, title: localize('splitUp', "Split Up") }, group: '2_split', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize('splitDown', "Split Down") }, group: '2_split', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize('splitLeft', "Split Left") }, group: '2_split', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize('splitRight', "Split Right") }, group: '2_split', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID, title: localize('newWindow', "New Window") }, group: '3_window', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: TOGGLE_LOCK_GROUP_COMMAND_ID, title: localize('toggleLockGroup', "Lock Group"), toggled: ActiveEditorGroupLockedContext }, group: '4_lock', order: 10, when: IsAuxiliaryWindowContext.toNegated() /* already a primary action for aux windows */ });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: CLOSE_EDITOR_GROUP_COMMAND_ID, title: localize('close', "Close") }, group: '5_close', order: 10, when: MultipleEditorGroupsContext });
// Editor Tab Container Context Menu
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_UP, title: localize('splitUp', "Split Up") }, group: '2_split', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize('splitDown', "Split Down") }, group: '2_split', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize('splitLeft', "Split Left") }, group: '2_split', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize('splitRight', "Split Right") }, group: '2_split', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, title: localize('moveEditorGroupToNewWindow', "Move into New Window") }, group: '3_window', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, title: localize('copyEditorGroupToNewWindow', "Copy into New Window") }, group: '3_window', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorTabsBarShowTabsSubmenu, title: localize('tabBar', "Tab Bar"), group: '4_config', order: 10, when: InEditorZenModeContext.negate() });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: ShowMultipleEditorTabsAction.ID, title: localize('multipleTabs', "Multiple Tabs"), toggled: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'multiple') }, group: '1_config', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: ShowSingleEditorTabAction.ID, title: localize('singleTab', "Single Tab"), toggled: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'single') }, group: '1_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: HideEditorTabsAction.ID, title: localize('hideTabs', "Hidden"), toggled: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'none') }, group: '1_config', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorTabsBarShowTabsZenModeSubmenu, title: localize('tabBar', "Tab Bar"), group: '4_config', order: 10, when: InEditorZenModeContext });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenShowMultipleEditorTabsAction.ID, title: localize('multipleTabs', "Multiple Tabs"), toggled: ContextKeyExpr.equals('config.zenMode.showTabs', 'multiple') }, group: '1_config', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenShowSingleEditorTabAction.ID, title: localize('singleTab', "Single Tab"), toggled: ContextKeyExpr.equals('config.zenMode.showTabs', 'single') }, group: '1_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenHideEditorTabsAction.ID, title: localize('hideTabs', "Hidden"), toggled: ContextKeyExpr.equals('config.zenMode.showTabs', 'none') }, group: '1_config', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorActionsPositionSubmenu, title: localize('editorActionsPosition', "Editor Actions Position"), group: '4_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: EditorActionsDefaultAction.ID, title: localize('tabBar', "Tab Bar"), toggled: ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'default') }, group: '1_config', order: 10, when: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'none').negate() });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: EditorActionsTitleBarAction.ID, title: localize('titleBar', "Title Bar"), toggled: ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'titleBar'), ContextKeyExpr.and(ContextKeyExpr.equals('config.workbench.editor.showTabs', 'none'), ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'default'))) }, group: '1_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: HideEditorActionsAction.ID, title: localize('hidden', "Hidden"), toggled: ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'hidden') }, group: '1_config', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: ConfigureEditorTabsAction.ID, title: localize('configureTabs', "Configure Tabs") }, group: '9_configure', order: 10 });
// Editor Title Context Menu
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITOR_COMMAND_ID, title: localize('close', "Close") }, group: '1_close', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, title: localize('closeOthers', "Close Others"), precondition: EditorGroupEditorsCountContext.notEqualsTo('1') }, group: '1_close', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, title: localize('closeRight', "Close to the Right"), precondition: ContextKeyExpr.and(ActiveEditorLastInGroupContext.toNegated(), MultipleEditorsSelectedInGroupContext.negate()) }, group: '1_close', order: 30, when: EditorTabsVisibleContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize('closeAllSaved', "Close Saved") }, group: '1_close', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize('closeAll', "Close All") }, group: '1_close', order: 50 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: REOPEN_WITH_COMMAND_ID, title: localize('reopenWith', "Reopen Editor With...") }, group: '1_open', order: 10, when: ActiveEditorAvailableEditorIdsContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: KEEP_EDITOR_COMMAND_ID, title: localize('keepOpen', "Keep Open"), precondition: ActiveEditorPinnedContext.toNegated() }, group: '3_preview', order: 10, when: ContextKeyExpr.has('config.workbench.editor.enablePreview') });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: PIN_EDITOR_COMMAND_ID, title: localize('pin', "Pin") }, group: '3_preview', order: 20, when: ActiveEditorStickyContext.toNegated() });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: UNPIN_EDITOR_COMMAND_ID, title: localize('unpin', "Unpin") }, group: '3_preview', order: 20, when: ActiveEditorStickyContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_UP, title: localize('splitUp', "Split Up") }, group: '5_split', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize('splitDown', "Split Down") }, group: '5_split', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize('splitLeft', "Split Left") }, group: '5_split', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize('splitRight', "Split Right") }, group: '5_split', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_IN_GROUP, title: localize('splitInGroup', "Split in Group"), precondition: MultipleEditorsSelectedInGroupContext.negate() }, group: '6_split_in_group', order: 10, when: ActiveEditorCanSplitInGroupContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: JOIN_EDITOR_IN_GROUP, title: localize('joinInGroup', "Join in Group"), precondition: MultipleEditorsSelectedInGroupContext.negate() }, group: '6_split_in_group', order: 10, when: SideBySideEditorActiveContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, title: localize('moveToNewWindow', "Move into New Window") }, group: '7_new_window', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, title: localize('copyToNewWindow', "Copy into New Window") }, group: '7_new_window', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { submenu: MenuId.EditorTitleContextShare, title: localize('share', "Share"), group: '11_share', order: -1, when: MultipleEditorsSelectedInGroupContext.negate() });
// Editor Title Menu
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_DIFF_SIDE_BY_SIDE, title: localize('inlineView', "Inline View"), toggled: ContextKeyExpr.equals('config.diffEditor.renderSideBySide', false) }, group: '1_diff', order: 10, when: ContextKeyExpr.has('isInDiffEditor') });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: SHOW_EDITORS_IN_GROUP, title: localize('showOpenedEditors', "Show Opened Editors") }, group: '3_open', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize('closeAll', "Close All") }, group: '5_close', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize('closeAllSaved', "Close Saved") }, group: '5_close', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_KEEP_EDITORS_COMMAND_ID, title: localize('togglePreviewMode', "Enable Preview Editors"), toggled: ContextKeyExpr.has('config.workbench.editor.enablePreview') }, group: '7_settings', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_MAXIMIZE_EDITOR_GROUP, title: localize('maximizeGroup', "Maximize Group") }, group: '8_group_operations', order: 5, when: ContextKeyExpr.and(EditorPartMaximizedEditorGroupContext.negate(), EditorPartMultipleEditorGroupsContext) });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_MAXIMIZE_EDITOR_GROUP, title: localize('unmaximizeGroup', "Unmaximize Group") }, group: '8_group_operations', order: 5, when: EditorPartMaximizedEditorGroupContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_LOCK_GROUP_COMMAND_ID, title: localize('lockGroup', "Lock Group"), toggled: ActiveEditorGroupLockedContext }, group: '8_group_operations', order: 10, when: IsAuxiliaryWindowContext.toNegated() /* already a primary action for aux windows */ });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: ConfigureEditorAction.ID, title: localize('configureEditors', "Configure Editors") }, group: '9_configure', order: 10 });
function appendEditorToolItem(primary, when, order, alternative, precondition, enableInCompactMode) {
    const item = {
        command: {
            id: primary.id,
            title: primary.title,
            icon: primary.icon,
            toggled: primary.toggled,
            precondition
        },
        group: 'navigation',
        when,
        order
    };
    if (alternative) {
        item.alt = {
            id: alternative.id,
            title: alternative.title,
            icon: alternative.icon
        };
    }
    MenuRegistry.appendMenuItem(MenuId.EditorTitle, item);
    if (enableInCompactMode) {
        MenuRegistry.appendMenuItem(MenuId.CompactWindowEditorTitle, item);
    }
}
const SPLIT_ORDER = 100000; // towards the end
const CLOSE_ORDER = 1000000; // towards the far end
// Editor Title Menu: Split Editor
appendEditorToolItem({
    id: SPLIT_EDITOR,
    title: localize('splitEditorRight', "Split Editor Right"),
    icon: Codicon.splitHorizontal
}, ContextKeyExpr.not('splitEditorsVertically'), SPLIT_ORDER, {
    id: SPLIT_EDITOR_DOWN,
    title: localize('splitEditorDown', "Split Editor Down"),
    icon: Codicon.splitVertical
});
appendEditorToolItem({
    id: SPLIT_EDITOR,
    title: localize('splitEditorDown', "Split Editor Down"),
    icon: Codicon.splitVertical
}, ContextKeyExpr.has('splitEditorsVertically'), SPLIT_ORDER, {
    id: SPLIT_EDITOR_RIGHT,
    title: localize('splitEditorRight', "Split Editor Right"),
    icon: Codicon.splitHorizontal
});
// Side by side: layout
appendEditorToolItem({
    id: TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
    title: localize('toggleSplitEditorInGroupLayout', "Toggle Layout"),
    icon: Codicon.editorLayout
}, SideBySideEditorActiveContext, SPLIT_ORDER - 1);
// Editor Title Menu: Close (tabs disabled, normal editor)
appendEditorToolItem({
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize('close', "Close"),
    icon: Codicon.close
}, ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext.toNegated(), ActiveEditorStickyContext.toNegated()), CLOSE_ORDER, {
    id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
    title: localize('closeAll', "Close All"),
    icon: Codicon.closeAll
});
// Editor Title Menu: Close (tabs disabled, dirty editor)
appendEditorToolItem({
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize('close', "Close"),
    icon: Codicon.closeDirty
}, ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext, ActiveEditorStickyContext.toNegated()), CLOSE_ORDER, {
    id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
    title: localize('closeAll', "Close All"),
    icon: Codicon.closeAll
});
// Editor Title Menu: Close (tabs disabled, sticky editor)
appendEditorToolItem({
    id: UNPIN_EDITOR_COMMAND_ID,
    title: localize('unpin', "Unpin"),
    icon: Codicon.pinned
}, ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext.toNegated(), ActiveEditorStickyContext), CLOSE_ORDER, {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize('close', "Close"),
    icon: Codicon.close
});
// Editor Title Menu: Close (tabs disabled, dirty & sticky editor)
appendEditorToolItem({
    id: UNPIN_EDITOR_COMMAND_ID,
    title: localize('unpin', "Unpin"),
    icon: Codicon.pinnedDirty
}, ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext, ActiveEditorStickyContext), CLOSE_ORDER, {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize('close', "Close"),
    icon: Codicon.close
});
// Lock Group: only on auxiliary window and when group is unlocked
appendEditorToolItem({
    id: LOCK_GROUP_COMMAND_ID,
    title: localize('lockEditorGroup', "Lock Group"),
    icon: Codicon.unlock
}, ContextKeyExpr.and(IsAuxiliaryWindowContext, ActiveEditorGroupLockedContext.toNegated()), CLOSE_ORDER - 1);
// Unlock Group: only when group is locked
appendEditorToolItem({
    id: UNLOCK_GROUP_COMMAND_ID,
    title: localize('unlockEditorGroup', "Unlock Group"),
    icon: Codicon.lock,
    toggled: ContextKeyExpr.true()
}, ActiveEditorGroupLockedContext, CLOSE_ORDER - 1);
// Diff Editor Title Menu: Previous Change
const previousChangeIcon = registerIcon('diff-editor-previous-change', Codicon.arrowUp, localize('previousChangeIcon', 'Icon for the previous change action in the diff editor.'));
appendEditorToolItem({
    id: GOTO_PREVIOUS_CHANGE,
    title: localize('navigate.prev.label', "Previous Change"),
    icon: previousChangeIcon
}, TextCompareEditorActiveContext, 10, undefined, EditorContextKeys.hasChanges, true);
// Diff Editor Title Menu: Next Change
const nextChangeIcon = registerIcon('diff-editor-next-change', Codicon.arrowDown, localize('nextChangeIcon', 'Icon for the next change action in the diff editor.'));
appendEditorToolItem({
    id: GOTO_NEXT_CHANGE,
    title: localize('navigate.next.label', "Next Change"),
    icon: nextChangeIcon
}, TextCompareEditorActiveContext, 11, undefined, EditorContextKeys.hasChanges, true);
// Diff Editor Title Menu: Swap Sides
appendEditorToolItem({
    id: DIFF_SWAP_SIDES,
    title: localize('swapDiffSides', "Swap Left and Right Side"),
    icon: Codicon.arrowSwap
}, ContextKeyExpr.and(TextCompareEditorActiveContext, ActiveCompareEditorCanSwapContext), 15, undefined, undefined);
const toggleWhitespace = registerIcon('diff-editor-toggle-whitespace', Codicon.whitespace, localize('toggleWhitespace', 'Icon for the toggle whitespace action in the diff editor.'));
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
    command: {
        id: TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE,
        title: localize('ignoreTrimWhitespace.label', "Show Leading/Trailing Whitespace Differences"),
        icon: toggleWhitespace,
        precondition: TextCompareEditorActiveContext,
        toggled: ContextKeyExpr.equals('config.diffEditor.ignoreTrimWhitespace', false),
    },
    group: 'navigation',
    when: TextCompareEditorActiveContext,
    order: 20,
});
// Editor Commands for Command Palette
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: KEEP_EDITOR_COMMAND_ID, title: localize2('keepEditor', 'Keep Editor'), category: Categories.View }, when: ContextKeyExpr.has('config.workbench.editor.enablePreview') });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: PIN_EDITOR_COMMAND_ID, title: localize2('pinEditor', 'Pin Editor'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: UNPIN_EDITOR_COMMAND_ID, title: localize2('unpinEditor', 'Unpin Editor'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITOR_COMMAND_ID, title: localize2('closeEditor', 'Close Editor'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_PINNED_EDITOR_COMMAND_ID, title: localize2('closePinnedEditor', 'Close Pinned Editor'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize2('closeEditorsInGroup', 'Close All Editors in Group'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize2('closeSavedEditors', 'Close Saved Editors in Group'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, title: localize2('closeOtherEditors', 'Close Other Editors in Group'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, title: localize2('closeRightEditors', 'Close Editors to the Right in Group'), category: Categories.View }, when: ActiveEditorLastInGroupContext.toNegated() });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_AND_GROUP_COMMAND_ID, title: localize2('closeEditorGroup', 'Close Editor Group'), category: Categories.View }, when: MultipleEditorGroupsContext });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: REOPEN_WITH_COMMAND_ID, title: localize2('reopenWith', "Reopen Editor With..."), category: Categories.View }, when: ActiveEditorAvailableEditorIdsContext });
// File menu
MenuRegistry.appendMenuItem(MenuId.MenubarRecentMenu, {
    group: '1_editor',
    command: {
        id: ReopenClosedEditorAction.ID,
        title: localize({ key: 'miReopenClosedEditor', comment: ['&& denotes a mnemonic'] }, "&&Reopen Closed Editor"),
        precondition: ContextKeyExpr.has('canReopenClosedEditor')
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarRecentMenu, {
    group: 'z_clear',
    command: {
        id: ClearRecentFilesAction.ID,
        title: localize({ key: 'miClearRecentOpen', comment: ['&& denotes a mnemonic'] }, "&&Clear Recently Opened...")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
    title: localize('miShare', "Share"),
    submenu: MenuId.MenubarShare,
    group: '45_share',
    order: 1,
});
// Layout menu
MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
    group: '2_appearance',
    title: localize({ key: 'miEditorLayout', comment: ['&& denotes a mnemonic'] }, "Editor &&Layout"),
    submenu: MenuId.MenubarLayoutMenu,
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '1_split',
    command: {
        id: SPLIT_EDITOR_UP,
        title: {
            ...localize2('miSplitEditorUpWithoutMnemonic', "Split Up"),
            mnemonicTitle: localize({ key: 'miSplitEditorUp', comment: ['&& denotes a mnemonic'] }, "Split &&Up"),
        }
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '1_split',
    command: {
        id: SPLIT_EDITOR_DOWN,
        title: {
            ...localize2('miSplitEditorDownWithoutMnemonic', "Split Down"),
            mnemonicTitle: localize({ key: 'miSplitEditorDown', comment: ['&& denotes a mnemonic'] }, "Split &&Down"),
        }
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '1_split',
    command: {
        id: SPLIT_EDITOR_LEFT,
        title: {
            ...localize2('miSplitEditorLeftWithoutMnemonic', "Split Left"),
            mnemonicTitle: localize({ key: 'miSplitEditorLeft', comment: ['&& denotes a mnemonic'] }, "Split &&Left"),
        }
    },
    order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '1_split',
    command: {
        id: SPLIT_EDITOR_RIGHT,
        title: {
            ...localize2('miSplitEditorRightWithoutMnemonic', "Split Right"),
            mnemonicTitle: localize({ key: 'miSplitEditorRight', comment: ['&& denotes a mnemonic'] }, "Split &&Right"),
        }
    },
    order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '2_split_in_group',
    command: {
        id: SPLIT_EDITOR_IN_GROUP,
        title: {
            ...localize2('miSplitEditorInGroupWithoutMnemonic', "Split in Group"),
            mnemonicTitle: localize({ key: 'miSplitEditorInGroup', comment: ['&& denotes a mnemonic'] }, "Split in &&Group"),
        }
    },
    when: ActiveEditorCanSplitInGroupContext,
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '2_split_in_group',
    command: {
        id: JOIN_EDITOR_IN_GROUP,
        title: {
            ...localize2('miJoinEditorInGroupWithoutMnemonic', "Join in Group"),
            mnemonicTitle: localize({ key: 'miJoinEditorInGroup', comment: ['&& denotes a mnemonic'] }, "Join in &&Group"),
        }
    },
    when: SideBySideEditorActiveContext,
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '3_new_window',
    command: {
        id: MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
        title: {
            ...localize2('moveEditorToNewWindow', "Move Editor into New Window"),
            mnemonicTitle: localize({ key: 'miMoveEditorToNewWindow', comment: ['&& denotes a mnemonic'] }, "&&Move Editor into New Window"),
        }
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '3_new_window',
    command: {
        id: COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
        title: {
            ...localize2('copyEditorToNewWindow', "Copy Editor into New Window"),
            mnemonicTitle: localize({ key: 'miCopyEditorToNewWindow', comment: ['&& denotes a mnemonic'] }, "&&Copy Editor into New Window"),
        }
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutSingleAction.ID,
        title: {
            ...localize2('miSingleColumnEditorLayoutWithoutMnemonic', "Single"),
            mnemonicTitle: localize({ key: 'miSingleColumnEditorLayout', comment: ['&& denotes a mnemonic'] }, "&&Single"),
        }
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutTwoColumnsAction.ID,
        title: {
            ...localize2('miTwoColumnsEditorLayoutWithoutMnemonic', "Two Columns"),
            mnemonicTitle: localize({ key: 'miTwoColumnsEditorLayout', comment: ['&& denotes a mnemonic'] }, "&&Two Columns"),
        }
    },
    order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutThreeColumnsAction.ID,
        title: {
            ...localize2('miThreeColumnsEditorLayoutWithoutMnemonic', "Three Columns"),
            mnemonicTitle: localize({ key: 'miThreeColumnsEditorLayout', comment: ['&& denotes a mnemonic'] }, "T&&hree Columns"),
        }
    },
    order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutTwoRowsAction.ID,
        title: {
            ...localize2('miTwoRowsEditorLayoutWithoutMnemonic', "Two Rows"),
            mnemonicTitle: localize({ key: 'miTwoRowsEditorLayout', comment: ['&& denotes a mnemonic'] }, "T&&wo Rows"),
        }
    },
    order: 5
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutThreeRowsAction.ID,
        title: {
            ...localize2('miThreeRowsEditorLayoutWithoutMnemonic', "Three Rows"),
            mnemonicTitle: localize({ key: 'miThreeRowsEditorLayout', comment: ['&& denotes a mnemonic'] }, "Three &&Rows"),
        }
    },
    order: 6
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutTwoByTwoGridAction.ID,
        title: {
            ...localize2('miTwoByTwoGridEditorLayoutWithoutMnemonic', "Grid (2x2)"),
            mnemonicTitle: localize({ key: 'miTwoByTwoGridEditorLayout', comment: ['&& denotes a mnemonic'] }, "&&Grid (2x2)"),
        }
    },
    order: 7
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutTwoRowsRightAction.ID,
        title: {
            ...localize2('miTwoRowsRightEditorLayoutWithoutMnemonic', "Two Rows Right"),
            mnemonicTitle: localize({ key: 'miTwoRowsRightEditorLayout', comment: ['&& denotes a mnemonic'] }, "Two R&&ows Right"),
        }
    },
    order: 8
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
    group: '4_layouts',
    command: {
        id: EditorLayoutTwoColumnsBottomAction.ID,
        title: {
            ...localize2('miTwoColumnsBottomEditorLayoutWithoutMnemonic', "Two Columns Bottom"),
            mnemonicTitle: localize({ key: 'miTwoColumnsBottomEditorLayout', comment: ['&& denotes a mnemonic'] }, "Two &&Columns Bottom"),
        }
    },
    order: 9
});
// Main Menu Bar Contributions:
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
    group: '1_history_nav',
    command: {
        id: 'workbench.action.navigateToLastEditLocation',
        title: localize({ key: 'miLastEditLocation', comment: ['&& denotes a mnemonic'] }, "&&Last Edit Location"),
        precondition: ContextKeyExpr.has('canNavigateToLastEditLocation')
    },
    order: 3
});
// Switch Editor
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '1_sideBySide',
    command: {
        id: FOCUS_FIRST_SIDE_EDITOR,
        title: localize({ key: 'miFirstSideEditor', comment: ['&& denotes a mnemonic'] }, "&&First Side in Editor")
    },
    when: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '1_sideBySide',
    command: {
        id: FOCUS_SECOND_SIDE_EDITOR,
        title: localize({ key: 'miSecondSideEditor', comment: ['&& denotes a mnemonic'] }, "&&Second Side in Editor")
    },
    when: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '2_any',
    command: {
        id: 'workbench.action.nextEditor',
        title: localize({ key: 'miNextEditor', comment: ['&& denotes a mnemonic'] }, "&&Next Editor")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '2_any',
    command: {
        id: 'workbench.action.previousEditor',
        title: localize({ key: 'miPreviousEditor', comment: ['&& denotes a mnemonic'] }, "&&Previous Editor")
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '3_any_used',
    command: {
        id: 'workbench.action.openNextRecentlyUsedEditor',
        title: localize({ key: 'miNextRecentlyUsedEditor', comment: ['&& denotes a mnemonic'] }, "&&Next Used Editor")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '3_any_used',
    command: {
        id: 'workbench.action.openPreviousRecentlyUsedEditor',
        title: localize({ key: 'miPreviousRecentlyUsedEditor', comment: ['&& denotes a mnemonic'] }, "&&Previous Used Editor")
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '4_group',
    command: {
        id: 'workbench.action.nextEditorInGroup',
        title: localize({ key: 'miNextEditorInGroup', comment: ['&& denotes a mnemonic'] }, "&&Next Editor in Group")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '4_group',
    command: {
        id: 'workbench.action.previousEditorInGroup',
        title: localize({ key: 'miPreviousEditorInGroup', comment: ['&& denotes a mnemonic'] }, "&&Previous Editor in Group")
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '5_group_used',
    command: {
        id: 'workbench.action.openNextRecentlyUsedEditorInGroup',
        title: localize({ key: 'miNextUsedEditorInGroup', comment: ['&& denotes a mnemonic'] }, "&&Next Used Editor in Group")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
    group: '5_group_used',
    command: {
        id: 'workbench.action.openPreviousRecentlyUsedEditorInGroup',
        title: localize({ key: 'miPreviousUsedEditorInGroup', comment: ['&& denotes a mnemonic'] }, "&&Previous Used Editor in Group")
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
    group: '2_editor_nav',
    title: localize({ key: 'miSwitchEditor', comment: ['&& denotes a mnemonic'] }, "Switch &&Editor"),
    submenu: MenuId.MenubarSwitchEditorMenu,
    order: 1
});
// Switch Group
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '1_focus_index',
    command: {
        id: 'workbench.action.focusFirstEditorGroup',
        title: localize({ key: 'miFocusFirstGroup', comment: ['&& denotes a mnemonic'] }, "Group &&1")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '1_focus_index',
    command: {
        id: 'workbench.action.focusSecondEditorGroup',
        title: localize({ key: 'miFocusSecondGroup', comment: ['&& denotes a mnemonic'] }, "Group &&2")
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '1_focus_index',
    command: {
        id: 'workbench.action.focusThirdEditorGroup',
        title: localize({ key: 'miFocusThirdGroup', comment: ['&& denotes a mnemonic'] }, "Group &&3"),
        precondition: MultipleEditorGroupsContext
    },
    order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '1_focus_index',
    command: {
        id: 'workbench.action.focusFourthEditorGroup',
        title: localize({ key: 'miFocusFourthGroup', comment: ['&& denotes a mnemonic'] }, "Group &&4"),
        precondition: MultipleEditorGroupsContext
    },
    order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '1_focus_index',
    command: {
        id: 'workbench.action.focusFifthEditorGroup',
        title: localize({ key: 'miFocusFifthGroup', comment: ['&& denotes a mnemonic'] }, "Group &&5"),
        precondition: MultipleEditorGroupsContext
    },
    order: 5
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '2_next_prev',
    command: {
        id: 'workbench.action.focusNextGroup',
        title: localize({ key: 'miNextGroup', comment: ['&& denotes a mnemonic'] }, "&&Next Group"),
        precondition: MultipleEditorGroupsContext
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '2_next_prev',
    command: {
        id: 'workbench.action.focusPreviousGroup',
        title: localize({ key: 'miPreviousGroup', comment: ['&& denotes a mnemonic'] }, "&&Previous Group"),
        precondition: MultipleEditorGroupsContext
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '3_directional',
    command: {
        id: 'workbench.action.focusLeftGroup',
        title: localize({ key: 'miFocusLeftGroup', comment: ['&& denotes a mnemonic'] }, "Group &&Left"),
        precondition: MultipleEditorGroupsContext
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '3_directional',
    command: {
        id: 'workbench.action.focusRightGroup',
        title: localize({ key: 'miFocusRightGroup', comment: ['&& denotes a mnemonic'] }, "Group &&Right"),
        precondition: MultipleEditorGroupsContext
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '3_directional',
    command: {
        id: 'workbench.action.focusAboveGroup',
        title: localize({ key: 'miFocusAboveGroup', comment: ['&& denotes a mnemonic'] }, "Group &&Above"),
        precondition: MultipleEditorGroupsContext
    },
    order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
    group: '3_directional',
    command: {
        id: 'workbench.action.focusBelowGroup',
        title: localize({ key: 'miFocusBelowGroup', comment: ['&& denotes a mnemonic'] }, "Group &&Below"),
        precondition: MultipleEditorGroupsContext
    },
    order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
    group: '2_editor_nav',
    title: localize({ key: 'miSwitchGroup', comment: ['&& denotes a mnemonic'] }, "Switch &&Group"),
    submenu: MenuId.MenubarSwitchGroupMenu,
    order: 2
});
//#endregion
registerEditorFontConfigurations(getFontSnippets);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvci5jb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUF1QixvQkFBb0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzVFLE9BQU8sRUFBMEIsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNyRixPQUFPLEVBQ04sOEJBQThCLEVBQUUseUJBQXlCLEVBQUUsOEJBQThCLEVBQUUseUJBQXlCLEVBQUUscUNBQXFDLEVBQzNKLHFDQUFxQyxFQUFFLHdCQUF3QixFQUFFLDhCQUE4QixFQUFFLGtDQUFrQyxFQUFFLDZCQUE2QixFQUNsSyx3QkFBd0IsRUFBRSw4QkFBOEIsRUFBRSxxQ0FBcUMsRUFBRSwyQkFBMkIsRUFBRSxzQkFBc0IsRUFDcEosd0JBQXdCLEVBQUUsaUNBQWlDLEVBQUUscUNBQXFDLEVBQ2xHLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLCtCQUErQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDekgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDN0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDekQsT0FBTyxFQUFFLGVBQWUsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ3ZHLE9BQU8s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