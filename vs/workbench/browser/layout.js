/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable, DisposableMap, DisposableStore, toDisposable } from '../../base/common/lifecycle.js';
import { Emitter } from '../../base/common/event.js';
import { EventType, addDisposableListener, getClientArea, position, size, isAncestorUsingFlowTo, computeScreenAwareSize, getActiveDocument, getWindows, getActiveWindow, isActiveDocument, getWindow, getWindowId, getActiveElement, Dimension } from '../../base/browser/dom.js';
import { onDidChangeFullscreen, isFullscreen, isWCOEnabled } from '../../base/browser/browser.js';
import { IWorkingCopyBackupService } from '../services/workingCopy/common/workingCopyBackup.js';
import { isWindows, isLinux, isMacintosh, isWeb, isIOS } from '../../base/common/platform.js';
import { isResourceEditorInput, pathsToEditors } from '../common/editor.js';
import { SidebarPart } from './parts/sidebar/sidebarPart.js';
import { PanelPart } from './parts/panel/panelPart.js';
import { positionFromString, positionToString, panelOpensMaximizedFromString, shouldShowCustomTitleBar, isHorizontal, isMultiWindowPart } from '../services/layout/browser/layoutService.js';
import { isTemporaryWorkspace, IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { IStorageService } from '../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { ITitleService } from '../services/title/browser/titleService.js';
import { ILifecycleService } from '../services/lifecycle/common/lifecycle.js';
import { getMenuBarVisibility, hasNativeTitlebar, hasCustomTitlebar, useWindowControlsOverlay, DEFAULT_WINDOW_SIZE, hasNativeMenu } from '../../platform/window/common/window.js';
import { IHostService } from '../services/host/browser/host.js';
import { IBrowserWorkbenchEnvironmentService } from '../services/environment/browser/environmentService.js';
import { IEditorService } from '../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../services/editor/common/editorGroupsService.js';
import { SerializableGrid, Sizing } from '../../base/browser/ui/grid/grid.js';
import { Part } from './part.js';
import { IStatusbarService } from '../services/statusbar/browser/statusbar.js';
import { IFileService } from '../../platform/files/common/files.js';
import { isCodeEditor } from '../../editor/browser/editorBrowser.js';
import { coalesce } from '../../base/common/arrays.js';
import { assertReturnsDefined } from '../../base/common/types.js';
import { INotificationService, NotificationsFilter } from '../../platform/notification/common/notification.js';
import { IThemeService } from '../../platform/theme/common/themeService.js';
import { WINDOW_ACTIVE_BORDER, WINDOW_INACTIVE_BORDER } from '../common/theme.js';
import { URI } from '../../base/common/uri.js';
import { IViewDescriptorService } from '../common/views.js';
import { DiffEditorInput } from '../common/editor/diffEditorInput.js';
import { mark } from '../../base/common/performance.js';
import { IExtensionService } from '../services/extensions/common/extensions.js';
import { ILogService } from '../../platform/log/common/log.js';
import { DeferredPromise, Promises } from '../../base/common/async.js';
import { IBannerService } from '../services/banner/browser/bannerService.js';
import { IPaneCompositePartService } from '../services/panecomposite/browser/panecomposite.js';
import { AuxiliaryBarPart } from './parts/auxiliarybar/auxiliaryBarPart.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';
import { IAuxiliaryWindowService } from '../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { mainWindow } from '../../base/browser/window.js';
var LayoutClasses;
(function (LayoutClasses) {
    LayoutClasses["SIDEBAR_HIDDEN"] = "nosidebar";
    LayoutClasses["MAIN_EDITOR_AREA_HIDDEN"] = "nomaineditorarea";
    LayoutClasses["PANEL_HIDDEN"] = "nopanel";
    LayoutClasses["AUXILIARYBAR_HIDDEN"] = "noauxiliarybar";
    LayoutClasses["STATUSBAR_HIDDEN"] = "nostatusbar";
    LayoutClasses["FULLSCREEN"] = "fullscreen";
    LayoutClasses["MAXIMIZED"] = "maximized";
    LayoutClasses["WINDOW_BORDER"] = "border";
})(LayoutClasses || (LayoutClasses = {}));
const COMMAND_CENTER_SETTINGS = [
    'chat.commandCenter.enabled',
    'workbench.navigationControl.enabled',
    'workbench.experimental.share.enabled',
];
export const TITLE_BAR_SETTINGS = [
    "workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */,
    "window.commandCenter" /* LayoutSettings.COMMAND_CENTER */,
    ...COMMAND_CENTER_SETTINGS,
    "workbench.editor.editorActionsLocation" /* LayoutSettings.EDITOR_ACTIONS_LOCATION */,
    "workbench.layoutControl.enabled" /* LayoutSettings.LAYOUT_ACTIONS */,
    "window.menuBarVisibility" /* MenuSettings.MenuBarVisibility */,
    "window.titleBarStyle" /* TitleBarSetting.TITLE_BAR_STYLE */,
    "window.customTitleBarVisibility" /* TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY */,
];
const DEFAULT_WINDOW_DIMENSIONS = new Dimension(DEFAULT_WINDOW_SIZE.width, DEFAULT_WINDOW_SIZE.height);
export class Layout extends Disposable {
    get activeContainer() { return this.getContainerFromDocument(getActiveDocument()); }
    get containers() {
        const containers = [];
        for (const { window } of getWindows()) {
            containers.push(this.getContainerFromDocument(window.document));
        }
        return containers;
    }
    getContainerFromDocument(targetDocument) {
        if (targetDocument === this.mainContainer.ownerDocument) {
            // main window
            return this.mainContainer;
        }
        else {
            // auxiliary window
            return targetDocument.body.getElementsByClassName('monaco-workbench')[0];
        }
    }
    whenContainerStylesLoaded(window) {
        return this.containerStylesLoaded.get(window.vscodeWindowId);
    }
    get mainContainerDimension() { return this._mainContainerDimension; }
    get activeContainerDimension() {
        return this.getContainerDimension(this.activeContainer);
    }
    getContainerDimension(container) {
        if (container === this.mainContainer) {
            return this.mainContainerDimension; // main window
        }
        else {
            return getClientArea(container); // auxiliary window
        }
    }
    get mainContainerOffset() {
        return this.computeContainerOffset(mainWindow);
    }
    get activeContainerOffset() {
        return this.computeContainerOffset(getWindow(this.activeContainer));
    }
    computeContainerOffset(targetWindow) {
        let top = 0;
        let quickPickTop = 0;
        if (this.isVisible("workbench.parts.banner" /* Parts.BANNER_PART */)) {
            top = this.getPart("workbench.parts.banner" /* Parts.BANNER_PART */).maximumHeight;
            quickPickTop = top;
        }
        const titlebarVisible = this.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */, targetWindow);
        if (titlebarVisible) {
            top += this.getPart("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */).maximumHeight;
            quickPickTop = top;
        }
        const isCommandCenterVisible = titlebarVisible && this.configurationService.getValue("window.commandCenter" /* LayoutSettings.COMMAND_CENTER */) !== false;
        if (isCommandCenterVisible) {
            // If the command center is visible then the quickinput
            // should go over the title bar and the banner
            quickPickTop = 6;
        }
        return { top, quickPickTop };
    }
    constructor(parent) {
        super();
        this.parent = parent;
        //#region Events
        this._onDidChangeZenMode = this._register(new Emitter());
        this.onDidChangeZenMode = this._onDidChangeZenMode.event;
        this._onDidChangeMainEditorCenteredLayout = this._register(new Emitter());
        this.onDidChangeMainEditorCenteredLayout = this._onDidChangeMainEditorCenteredLayout.event;
        this._onDidChangePanelAlignment = this._register(new Emitter());
        this.onDidChangePanelAlignment = this._onDidChangePanelAlignment.event;
        this._onDidChangeWindowMaximized = this._register(new Emitter());
        this.onDidChangeWindowMaximized = this._onDidChangeWindowMaximized.event;
        this._onDidChangePanelPosition = this._register(new Emitter());
        this.onDidChangePanelPosition = this._onDidChangePanelPosition.event;
        this._onDidChangePartVisibility = this._register(new Emitter());
        this.onDidChangePartVisibility = this._onDidChangePartVisibility.event;
        this._onDidChangeNotificationsVisibility = this._register(new Emitter());
        this.onDidChangeNotificationsVisibility = this._onDidChangeNotificationsVisibility.event;
        this._onDidLayoutMainContainer = this._register(new Emitter());
        this.onDidLayoutMainContainer = this._onDidLayoutMainContainer.event;
        this._onDidLayoutActiveContainer = this._register(new Emitter());
        this.onDidLayoutActiveContainer = this._onDidLayoutActiveContainer.event;
        this._onDidLayoutContainer = this._register(new Emitter());
        this.onDidLayoutContainer = this._onDidLayoutContainer.event;
        this._onDidAddContainer = this._register(new Emitter());
        this.onDidAddContainer = this._onDidAddContainer.event;
        this._onDidChangeActiveContainer = this._register(new Emitter());
        this.onDidChangeActiveContainer = this._onDidChangeActiveContainer.event;
        //#endregion
        //#region Properties
        this.mainContainer = document.createElement('div');
        this.containerStylesLoaded = new Map();
        //#endregion
        this.parts = new Map();
        this.initialized = false;
        this.disposed = false;
        this._openedDefaultEditors = false;
        this.whenReadyPromise = new DeferredPromise();
        this.whenReady = this.whenReadyPromise.p;
        this.whenRestoredPromise = new DeferredPromise();
        this.whenRestored = this.whenRestoredPromise.p;
        this.restored = false;
    }
    initLayout(accessor) {
        // Services
        this.environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
        this.configurationService = accessor.get(IConfigurationService);
        this.hostService = accessor.get(IHostService);
        this.contextService = accessor.get(IWorkspaceContextService);
        this.storageService = accessor.get(IStorageService);
        this.workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
        this.themeService = accessor.get(IThemeService);
        this.extensionService = accessor.get(IExtensionService);
        this.logService = accessor.get(ILogService);
        this.telemetryService = accessor.get(ITelemetryService);
        this.auxiliaryWindowService = accessor.get(IAuxiliaryWindowService);
        // Parts
        this.editorService = accessor.get(IEditorService);
        this.editorGroupService = accessor.get(IEditorGroupsService);
        this.mainPartEditorService = this.editorService.createScoped(this.editorGroupService.mainPart, this._store);
        this.paneCompositeService = accessor.get(IPaneCompositePartService);
        this.viewDescriptorService = accessor.get(IViewDescriptorService);
        this.titleService = accessor.get(ITitleService);
        this.notificationService = accessor.get(INotificationService);
        this.statusBarService = accessor.get(IStatusbarService);
        accessor.get(IBannerService);
        // Listeners
        this.registerLayoutListeners();
        // State
        this.initLayoutState(accessor.get(ILifecycleService), accessor.get(IFileService));
    }
    registerLayoutListeners() {
        // Restore editor if hidden
        const showEditorIfHidden = () => {
            if (!this.isVisible("workbench.parts.editor" /* Parts.EDITOR_PART */, mainWindow)) {
                this.toggleMaximizedPanel();
            }
        };
        // Wait to register these listeners after the editor group service
        // is ready to avoid conflicts on startup
        this.editorGroupService.whenRestored.then(() => {
            // Restore main editor part on any editor change in main part
            this._register(this.mainPartEditorService.onDidVisibleEditorsChange(showEditorIfHidden));
            this._register(this.editorGroupService.mainPart.onDidActivateGroup(showEditorIfHidden));
            // Revalidate center layout when active editor changes: diff editor quits centered mode.
            this._register(this.mainPartEditorService.onDidActiveEditorChange(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
        });
        // Configuration changes
        this._register(this.configurationService.onDidChangeConfiguration((e) => {
            if ([
                ...TITLE_BAR_SETTINGS,
                LegacyWorkbenchLayoutSettings.SIDEBAR_POSITION,
                LegacyWorkbenchLayoutSettings.STATUSBAR_VISIBLE,
            ].some(setting => e.affectsConfiguration(setting))) {
                // Show Command Center if command center actions enabled
                const shareEnabled = e.affectsConfiguration('workbench.experimental.share.enabled') && this.configurationService.getValue('workbench.experimental.share.enabled');
                const navigationControlEnabled = e.affectsConfiguration('workbench.navigationControl.enabled') && this.configurationService.getValue('workbench.navigationControl.enabled');
                // Currently not supported for "chat.commandCenter.enabled" as we
                // programatically set this during setup and could lead to unwanted titlebar appearing
                // const chatControlsEnabled = e.affectsConfiguration('chat.commandCenter.enabled') && this.configurationService.getValue<boolean>('chat.commandCenter.enabled');
                if (shareEnabled || navigationControlEnabled) {
                    if (this.configurationService.getValue("window.commandCenter" /* LayoutSettings.COMMAND_CENTER */) === false) {
                        this.configurationService.updateValue("window.commandCenter" /* LayoutSettings.COMMAND_CENTER */, true);
                        return; // onDidChangeConfiguration will be triggered again
                    }
                }
                // Show Custom TitleBar if actions enabled in (or moved to) the titlebar
                const editorActionsMovedToTitlebar = e.affectsConfiguration("workbench.editor.editorActionsLocation" /* LayoutSettings.EDITOR_ACTIONS_LOCATION */) && this.configurationService.getValue("workbench.editor.editorActionsLocation" /* LayoutSettings.EDITOR_ACTIONS_LOCATION */) === "titleBar" /* EditorActionsLocation.TITLEBAR */;
                const commandCenterEnabled = e.affectsConfiguration("window.commandCenter" /* LayoutSettings.COMMAND_CENTER */) && this.configurationService.getValue("window.commandCenter" /* LayoutSettings.COMMAND_CENTER */);
                const layoutControlsEnabled = e.affectsConfiguration("workbench.layoutControl.enabled" /* LayoutSettings.LAYOUT_ACTIONS */) && this.configurationService.getValue("workbench.layoutControl.enabled" /* LayoutSettings.LAYOUT_ACTIONS */);
                const activityBarMovedToTopOrBottom = e.affectsConfiguration("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */) && ["top" /* ActivityBarPosition.TOP */, "bottom" /* ActivityBarPosition.BOTTOM */].includes(this.configurationService.getValue("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */));
                if (activityBarMovedToTopOrBottom || editorActionsMovedToTitlebar || commandCenterEnabled || layoutControlsEnabled) {
                    if (this.configurationService.getValue("window.customTitleBarVisibility" /* TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY */) === "never" /* CustomTitleBarVisibility.NEVER */) {
                        this.configurationService.updateValue("window.customTitleBarVisibility" /* TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY */, "auto" /* CustomTitleBarVisibility.AUTO */);
                        return; // onDidChangeConfiguration will be triggered again
                    }
                }
                this.doUpdateLayoutConfiguration();
            }
        }));
        // Fullscreen changes
        this._register(onDidChangeFullscreen(windowId => this.onFullscreenChanged(windowId)));
        // Group changes
        this._register(this.editorGroupService.mainPart.onDidAddGroup(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
        this._register(this.editorGroupService.mainPart.onDidRemoveGroup(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
        this._register(this.editorGroupService.mainPart.onDidChangeGroupMaximized(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
        // Prevent workbench from scrolling #55456
        this._register(addDisposableListener(this.mainContainer, EventType.SCROLL, () => this.mainContainer.scrollTop = 0));
        // Menubar visibility changes
        const showingCustomMenu = (isWindows || isLinux || isWeb) && !hasNativeTitlebar(this.configurationService);
        if (showingCustomMenu) {
            this._register(this.titleService.onMenubarVisibilityChange(visible => this.onMenubarToggled(visible)));
        }
        // Theme changes
        this._register(this.themeService.onDidColorThemeChange(() => this.updateWindowsBorder()));
        // Window active / focus changes
        this._register(this.hostService.onDidChangeFocus(focused => this.onWindowFocusChanged(focused)));
        this._register(this.hostService.onDidChangeActiveWindow(() => this.onActiveWindowChanged()));
        // WCO changes
        if (isWeb && typeof navigator.windowControlsOverlay === 'object') {
            this._register(addDisposableListener(navigator.windowControlsOverlay, 'geometrychange', () => this.onDidChangeWCO()));
        }
        // Auxiliary windows
        this._register(this.auxiliaryWindowService.onDidOpenAuxiliaryWindow(({ window, disposables }) => {
            const windowId = window.window.vscodeWindowId;
            this.containerStylesLoaded.set(windowId, window.whenStylesHaveLoaded);
            window.whenStylesHaveLoaded.then(() => this.containerStylesLoaded.delete(windowId));
            disposables.add(toDisposable(() => this.containerStylesLoaded.delete(windowId)));
            const eventDisposables = disposables.add(new DisposableStore());
            this._onDidAddContainer.fire({ container: window.container, disposables: eventDisposables });
            disposables.add(window.onDidLayout(dimension => this.handleContainerDidLayout(window.container, dimension)));
        }));
    }
    onMenubarToggled(visible) {
        if (visible !== this.state.runtime.menuBar.toggled) {
            this.state.runtime.menuBar.toggled = visible;
            const menuBarVisibility = getMenuBarVisibility(this.configurationService);
            // The menu bar toggles the title bar in web because it does not need to be shown for window controls only
            if (isWeb && menuBarVisibility === 'toggle') {
                this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
            }
            // The menu bar toggles the title bar in full screen for toggle and classic settings
            else if (this.state.runtime.mainWindowFullscreen && (menuBarVisibility === 'toggle' || menuBarVisibility === 'classic')) {
                this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
            }
            // Move layout call to any time the menubar
            // is toggled to update consumers of offset
            // see issue #115267
            this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
        }
    }
    handleContainerDidLayout(container, dimension) {
        if (container === this.mainContainer) {
            this._onDidLayoutMainContainer.fire(dimension);
        }
        if (isActiveDocument(container)) {
            this._onDidLayoutActiveContainer.fire(dimension);
        }
        this._onDidLayoutContainer.fire({ container, dimension });
    }
    onFullscreenChanged(windowId) {
        if (windowId !== mainWindow.vscodeWindowId) {
            return; // ignore all but main window
        }
        this.state.runtime.mainWindowFullscreen = isFullscreen(mainWindow);
        // Apply as CSS class
        if (this.state.runtime.mainWindowFullscreen) {
            this.mainContainer.classList.add(LayoutClasses.FULLSCREEN);
        }
        else {
            this.mainContainer.classList.remove(LayoutClasses.FULLSCREEN);
            const zenModeExitInfo = this.stateModel.getRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO);
            if (zenModeExitInfo.transitionedToFullScreen && this.isZenModeActive()) {
                this.toggleZenMode();
            }
        }
        // Change edge snapping accordingly
        this.workbenchGrid.edgeSnapping = this.state.runtime.mainWindowFullscreen;
        // Changing fullscreen state of the main window has an impact
        // on custom title bar visibility, so we need to update
        if (hasCustomTitlebar(this.configurationService)) {
            // Propagate to grid
            this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
            this.updateWindowsBorder(true);
        }
    }
    onActiveWindowChanged() {
        const activeContainerId = this.getActiveContainerId();
        if (this.state.runtime.activeContainerId !== activeContainerId) {
            this.state.runtime.activeContainerId = activeContainerId;
            // Indicate active window border
            this.updateWindowsBorder();
            this._onDidChangeActiveContainer.fire();
        }
    }
    onWindowFocusChanged(hasFocus) {
        if (this.state.runtime.hasFocus !== hasFocus) {
            this.state.runtime.hasFocus = hasFocus;
            this.updateWindowsBorder();
        }
    }
    getActiveContainerId() {
        const activeContainer = this.activeContainer;
        return getWindow(activeContainer).vscodeWindowId;
    }
    doUpdateLayoutConfiguration(skipLayout) {
        // Custom Titlebar visibility with native titlebar
        this.updateCustomTitleBarVisibility();
        // Menubar visibility
        this.updateMenubarVisibility(!!skipLayout);
        // Centered Layout
        this.editorGroupService.whenRestored.then(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED), skipLayout));
    }
    setSideBarPosition(position) {
        const activityBar = this.getPart("workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */);
        const sideBar = this.getPart("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */);
        const auxiliaryBar = this.getPart("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
        const newPositionValue = (position === 0 /* Position.LEFT */) ? 'left' : 'right';
        const oldPositionValue = (position === 1 /* Position.RIGHT */) ? 'left' : 'right';
        const panelAlignment = this.getPanelAlignment();
        const panelPosition = this.getPanelPosition();
        this.stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON, position);
        // Adjust CSS
        const activityBarContainer = assertReturnsDefined(activityBar.getContainer());
        const sideBarContainer = assertReturnsDefined(sideBar.getContainer());
        const auxiliaryBarContainer = assertReturnsDefined(auxiliaryBar.getContainer());
        activityBarContainer.classList.remove(oldPositionValue);
        sideBarContainer.classList.remove(oldPositionValue);
        activityBarContainer.classList.add(newPositionValue);
        sideBarContainer.classList.add(newPositionValue);
        // Auxiliary Bar has opposite values
        auxiliaryBarContainer.classList.remove(newPositionValue);
        auxiliaryBarContainer.classList.add(oldPositionValue);
        // Update Styles
        activityBar.updateStyles();
        sideBar.updateStyles();
        auxiliaryBar.updateStyles();
        // Move activity bar and side bars
        this.adjustPartPositions(position, panelAlignment, panelPosition);
    }
    updateWindowsBorder(skipLayout = false) {
        if (isWeb ||
            isWindows || // not working well with zooming (border often not visible)
            ((isWindows || isLinux) &&
                useWindowControlsOverlay(this.configurationService) // Windows/Linux: not working with WCO (border cannot draw over the overlay)
            ) ||
            hasNativeTitlebar(this.configurationService)) {
            return;
        }
        const theme = this.themeService.getColorTheme();
        const activeBorder = theme.getColor(WINDOW_ACTIVE_BORDER);
        const inactiveBorder = theme.getColor(WINDOW_INACTIVE_BORDER);
        const didHaveMainWindowBorder = this.hasMainWindowBorder();
        for (const container of this.containers) {
            const isMainContainer = container === this.mainContainer;
            const isActiveContainer = this.activeContainer === container;
            let windowBorder = false;
            if (!this.state.runtime.mainWindowFullscreen && (activeBorder || inactiveBorder)) {
                windowBorder = true;
                // If the inactive color is missing, fallback to the active one
                const borderColor = isActiveContainer && this.state.runtime.hasFocus ? activeBorder : inactiveBorder ?? activeBorder;
                container.style.setProperty('--window-border-color', borderColor?.toString() ?? 'transparent');
            }
            if (isMainContainer) {
                this.state.runtime.mainWindowBorder = windowBorder;
            }
            container.classList.toggle(LayoutClasses.WINDOW_BORDER, windowBorder);
        }
        if (!skipLayout && didHaveMainWindowBorder !== this.hasMainWindowBorder()) {
            this.layout();
        }
    }
    initLayoutState(lifecycleService, fileService) {
        this._mainContainerDimension = getClientArea(this.parent, DEFAULT_WINDOW_DIMENSIONS); // running with fallback to ensure no error is thrown (https://github.com/microsoft/vscode/issues/240242)
        this.stateModel = new LayoutStateModel(this.storageService, this.configurationService, this.contextService);
        this.stateModel.load(this._mainContainerDimension);
        // Both editor and panel should not be hidden on startup
        if (this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN) && this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN)) {
            this.stateModel.setRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN, false);
        }
        this._register(this.stateModel.onDidChangeState(change => {
            if (change.key === LayoutStateKeys.ACTIVITYBAR_HIDDEN) {
                this.setActivityBarHidden(change.value);
            }
            if (change.key === LayoutStateKeys.STATUSBAR_HIDDEN) {
                this.setStatusBarHidden(change.value);
            }
            if (change.key === LayoutStateKeys.SIDEBAR_POSITON) {
                this.setSideBarPosition(change.value);
            }
            if (change.key === LayoutStateKeys.PANEL_POSITION) {
                this.setPanelPosition(change.value);
            }
            if (change.key === LayoutStateKeys.PANEL_ALIGNMENT) {
                this.setPanelAlignment(change.value);
            }
            this.doUpdateLayoutConfiguration();
        }));
        // Layout Initialization State
        const initialEditorsState = this.getInitialEditorsState();
        if (initialEditorsState) {
            this.logService.trace('Initial editor state', initialEditorsState);
        }
        const initialLayoutState = {
            layout: {
                editors: initialEditorsState?.layout
            },
            editor: {
                restoreEditors: this.shouldRestoreEditors(this.contextService, initialEditorsState),
                editorsToOpen: this.resolveEditorsToOpen(fileService, initialEditorsState),
            },
            views: {
                defaults: this.getDefaultLayoutViews(this.environmentService, this.storageService),
                containerToRestore: {}
            }
        };
        // Layout Runtime State
        const layoutRuntimeState = {
            activeContainerId: this.getActiveContainerId(),
            mainWindowFullscreen: isFullscreen(mainWindow),
            hasFocus: this.hostService.hasFocus,
            maximized: new Set(),
            mainWindowBorder: false,
            menuBar: {
                toggled: false,
            },
            zenMode: {
                transitionDisposables: new DisposableMap(),
            }
        };
        this.state = {
            initialization: initialLayoutState,
            runtime: layoutRuntimeState,
        };
        // Sidebar View Container To Restore
        if (this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */)) {
            // Only restore last viewlet if window was reloaded or we are in development mode
            let viewContainerToRestore;
            if (!this.environmentService.isBuilt ||
                lifecycleService.startupKind === 3 /* StartupKind.ReloadedWindow */ ||
                this.environmentService.isExtensionDevelopment && !this.environmentService.extensionTestsLocationURI) {
                viewContainerToRestore = this.storageService.get(SidebarPart.activeViewletSettingsKey, 1 /* StorageScope.WORKSPACE */, this.viewDescriptorService.getDefaultViewContainer(0 /* ViewContainerLocation.Sidebar */)?.id);
            }
            else {
                viewContainerToRestore = this.viewDescriptorService.getDefaultViewContainer(0 /* ViewContainerLocation.Sidebar */)?.id;
            }
            if (viewContainerToRestore) {
                this.state.initialization.views.containerToRestore.sideBar = viewContainerToRestore;
            }
            else {
                this.stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN, true);
            }
        }
        // Panel View Container To Restore
        if (this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */)) {
            const viewContainerToRestore = this.storageService.get(PanelPart.activePanelSettingsKey, 1 /* StorageScope.WORKSPACE */, this.viewDescriptorService.getDefaultViewContainer(1 /* ViewContainerLocation.Panel */)?.id);
            if (viewContainerToRestore) {
                this.state.initialization.views.containerToRestore.panel = viewContainerToRestore;
            }
            else {
                this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_HIDDEN, true);
            }
        }
        // Auxiliary View to restore
        if (this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */)) {
            const viewContainerToRestore = this.storageService.get(AuxiliaryBarPart.activeViewSettingsKey, 1 /* StorageScope.WORKSPACE */, this.viewDescriptorService.getDefaultViewContainer(2 /* ViewContainerLocation.AuxiliaryBar */)?.id);
            if (viewContainerToRestore) {
                this.state.initialization.views.containerToRestore.auxiliaryBar = viewContainerToRestore;
            }
            else {
                this.stateModel.setRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN, true);
            }
        }
        // Window border
        this.updateWindowsBorder(true);
    }
    getDefaultLayoutViews(environmentService, storageService) {
        const defaultLayout = environmentService.options?.defaultLayout;
        if (!defaultLayout) {
            return undefined;
        }
        if (!defaultLayout.force && !storageService.isNew(1 /* StorageScope.WORKSPACE */)) {
            return undefined;
        }
        const { views } = defaultLayout;
        if (views?.length) {
            return views.map(view => view.id);
        }
        return undefined;
    }
    shouldRestoreEditors(contextService, initialEditorsState) {
        // Restore editors based on a set of rules:
        // - never when running on temporary workspace
        // - not when we have files to open, unless:
        // - always when `window.restoreWindows: preserve`
        if (isTemporaryWorkspace(contextService.getWorkspace())) {
            return false;
        }
        const forceRestoreEditors = this.configurationService.getValue('window.restoreWindows') === 'preserve';
        return !!forceRestoreEditors || initialEditorsState === undefined;
    }
    willRestoreEditors() {
        return this.state.initialization.editor.restoreEditors;
    }
    async resolveEditorsToOpen(fileService, initialEditorsState) {
        if (initialEditorsState) {
            // Merge editor (single)
            const filesToMerge = coalesce(await pathsToEditors(initialEditorsState.filesToMerge, fileService, this.logService));
            if (filesToMerge.length === 4 && isResourceEditorInput(filesToMerge[0]) && isResourceEditorInput(filesToMerge[1]) && isResourceEditorInput(filesToMerge[2]) && isResourceEditorInput(filesToMerge[3])) {
                return [{
                        editor: {
                            input1: { resource: filesToMerge[0].resource },
                            input2: { resource: filesToMerge[1].resource },
                            base: { resource: filesToMerge[2].resource },
                            result: { resource: filesToMerge[3].resource },
                            options: { pinned: true }
                        }
                    }];
            }
            // Diff editor (single)
            const filesToDiff = coalesce(await pathsToEditors(initialEditorsState.filesToDiff, fileService, this.logService));
            if (filesToDiff.length === 2) {
                return [{
                        editor: {
                            original: { resource: filesToDiff[0].resource },
                            modified: { resource: filesToDiff[1].resource },
                            options: { pinned: true }
                        }
                    }];
            }
            // Normal editor (multiple)
            const filesToOpenOrCreate = [];
            const resolvedFilesToOpenOrCreate = await pathsToEditors(initialEditorsState.filesToOpenOrCreate, fileService, this.logService);
            for (let i = 0; i < resolvedFilesToOpenOrCreate.length; i++) {
                const resolvedFileToOpenOrCreate = resolvedFilesToOpenOrCreate[i];
                if (resolvedFileToOpenOrCreate) {
                    filesToOpenOrCreate.push({
                        editor: resolvedFileToOpenOrCreate,
                        viewColumn: initialEditorsState.filesToOpenOrCreate?.[i].viewColumn // take over `viewColumn` from initial state
                    });
                }
            }
            return filesToOpenOrCreate;
        }
        // Empty workbench configured to open untitled file if empty
        else if (this.contextService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */ && this.configurationService.getValue('workbench.startupEditor') === 'newUntitledFile') {
            if (this.editorGroupService.hasRestorableState) {
                return []; // do not open any empty untitled file if we restored groups/editors from previous session
            }
            const hasBackups = await this.workingCopyBackupService.hasBackups();
            if (hasBackups) {
                return []; // do not open any empty untitled file if we have backups to restore
            }
            return [{
                    editor: { resource: undefined } // open empty untitled file
                }];
        }
        return [];
    }
    get openedDefaultEditors() { return this._openedDefaultEditors; }
    getInitialEditorsState() {
        // Check for editors / editor layout from `defaultLayout` options first
        const defaultLayout = this.environmentService.options?.defaultLayout;
        if ((defaultLayout?.editors?.length || defaultLayout?.layout?.editors) && (defaultLayout.force || this.storageService.isNew(1 /* StorageScope.WORKSPACE */))) {
            this._openedDefaultEditors = true;
            return {
                layout: defaultLayout.layout?.editors,
                filesToOpenOrCreate: defaultLayout?.editors?.map(editor => {
                    return {
                        viewColumn: editor.viewColumn,
                        fileUri: URI.revive(editor.uri),
                        openOnlyIfExists: editor.openOnlyIfExists,
                        options: editor.options
                    };
                })
            };
        }
        // Then check for files to open, create or diff/merge from main side
        const { filesToOpenOrCreate, filesToDiff, filesToMerge } = this.environmentService;
        if (filesToOpenOrCreate || filesToDiff || filesToMerge) {
            return { filesToOpenOrCreate, filesToDiff, filesToMerge };
        }
        return undefined;
    }
    isRestored() {
        return this.restored;
    }
    restoreParts() {
        // distinguish long running restore operations that
        // are required for the layout to be ready from those
        // that are needed to signal restoring is done
        const layoutReadyPromises = [];
        const layoutRestoredPromises = [];
        // Restore editors
        layoutReadyPromises.push((async () => {
            mark('code/willRestoreEditors');
            // first ensure the editor part is ready
            await this.editorGroupService.whenReady;
            mark('code/restoreEditors/editorGroupsReady');
            // apply editor layout if any
            if (this.state.initialization.layout?.editors) {
                this.editorGroupService.mainPart.applyLayout(this.state.initialization.layout.editors);
            }
            // then see for editors to open as instructed
            // it is important that we trigger this from
            // the overall restore flow to reduce possible
            // flicker on startup: we want any editor to
            // open to get a chance to open first before
            // signaling that layout is restored, but we do
            // not need to await the editors from having
            // fully loaded.
            const editors = await this.state.initialization.editor.editorsToOpen;
            mark('code/restoreEditors/editorsToOpenResolved');
            let openEditorsPromise = undefined;
            if (editors.length) {
                // we have to map editors to their groups as instructed
                // by the input. this is important to ensure that we open
                // the editors in the groups they belong to.
                const editorGroupsInVisualOrder = this.editorGroupService.mainPart.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */);
                const mapEditorsToGroup = new Map();
                for (const editor of editors) {
                    const group = editorGroupsInVisualOrder[(editor.viewColumn ?? 1) - 1]; // viewColumn is index+1 based
                    let editorsByGroup = mapEditorsToGroup.get(group.id);
                    if (!editorsByGroup) {
                        editorsByGroup = new Set();
                        mapEditorsToGroup.set(group.id, editorsByGroup);
                    }
                    editorsByGroup.add(editor.editor);
                }
                openEditorsPromise = Promise.all(Array.from(mapEditorsToGroup).map(async ([groupId, editors]) => {
                    try {
                        await this.editorService.openEditors(Array.from(editors), groupId, { validateTrust: true });
                    }
                    catch (error) {
                        this.logService.error(error);
                    }
                }));
            }
            // do not block the overall layout ready flow from potentially
            // slow editors to resolve on startup
            layoutRestoredPromises.push(Promise.all([
                openEditorsPromise?.finally(() => mark('code/restoreEditors/editorsOpened')),
                this.editorGroupService.whenRestored.finally(() => mark('code/restoreEditors/editorGroupsRestored'))
            ]).finally(() => {
                // the `code/didRestoreEditors` perf mark is specifically
                // for when visible editors have resolved, so we only mark
                // if when editor group service has restored.
                mark('code/didRestoreEditors');
            }));
        })());
        // Restore default views (only when `IDefaultLayout` is provided)
        const restoreDefaultViewsPromise = (async () => {
            if (this.state.initialization.views.defaults?.length) {
                mark('code/willOpenDefaultViews');
                const locationsRestored = [];
                const tryOpenView = (view) => {
                    const location = this.viewDescriptorService.getViewLocationById(view.id);
                    if (location !== null) {
                        const container = this.viewDescriptorService.getViewContainerByViewId(view.id);
                        if (container) {
                            if (view.order >= (locationsRestored?.[location]?.order ?? 0)) {
                                locationsRestored[location] = { id: container.id, order: view.order };
                            }
                            const containerModel = this.viewDescriptorService.getViewContainerModel(container);
                            containerModel.setCollapsed(view.id, false);
                            containerModel.setVisible(view.id, true);
                            return true;
                        }
                    }
                    return false;
                };
                const defaultViews = [...this.state.initialization.views.defaults].reverse().map((v, index) => ({ id: v, order: index }));
                let i = defaultViews.length;
                while (i) {
                    i--;
                    if (tryOpenView(defaultViews[i])) {
                        defaultViews.splice(i, 1);
                    }
                }
                // If we still have views left over, wait until all extensions have been registered and try again
                if (defaultViews.length) {
                    await this.extensionService.whenInstalledExtensionsRegistered();
                    let i = defaultViews.length;
                    while (i) {
                        i--;
                        if (tryOpenView(defaultViews[i])) {
                            defaultViews.splice(i, 1);
                        }
                    }
                }
                // If we opened a view in the sidebar, stop any restore there
                if (locationsRestored[0 /* ViewContainerLocation.Sidebar */]) {
                    this.state.initialization.views.containerToRestore.sideBar = locationsRestored[0 /* ViewContainerLocation.Sidebar */].id;
                }
                // If we opened a view in the panel, stop any restore there
                if (locationsRestored[1 /* ViewContainerLocation.Panel */]) {
                    this.state.initialization.views.containerToRestore.panel = locationsRestored[1 /* ViewContainerLocation.Panel */].id;
                }
                // If we opened a view in the auxiliary bar, stop any restore there
                if (locationsRestored[2 /* ViewContainerLocation.AuxiliaryBar */]) {
                    this.state.initialization.views.containerToRestore.auxiliaryBar = locationsRestored[2 /* ViewContainerLocation.AuxiliaryBar */].id;
                }
                mark('code/didOpenDefaultViews');
            }
        })();
        layoutReadyPromises.push(restoreDefaultViewsPromise);
        // Restore Sidebar
        layoutReadyPromises.push((async () => {
            // Restoring views could mean that sidebar already
            // restored, as such we need to test again
            await restoreDefaultViewsPromise;
            if (!this.state.initialization.views.containerToRestore.sideBar) {
                return;
            }
            mark('code/willRestoreViewlet');
            await this.openViewContainer(0 /* ViewContainerLocation.Sidebar */, this.state.initialization.views.containerToRestore.sideBar);
            mark('code/didRestoreViewlet');
        })());
        // Restore Panel
        layoutReadyPromises.push((async () => {
            // Restoring views could mean that panel already
            // restored, as such we need to test again
            await restoreDefaultViewsPromise;
            if (!this.state.initialization.views.containerToRestore.panel) {
                return;
            }
            mark('code/willRestorePanel');
            await this.openViewContainer(1 /* ViewContainerLocation.Panel */, this.state.initialization.views.containerToRestore.panel);
            mark('code/didRestorePanel');
        })());
        // Restore Auxiliary Bar
        layoutReadyPromises.push((async () => {
            // Restoring views could mean that auxbar already
            // restored, as such we need to test again
            await restoreDefaultViewsPromise;
            if (!this.state.initialization.views.containerToRestore.auxiliaryBar) {
                return;
            }
            mark('code/willRestoreAuxiliaryBar');
            await this.openViewContainer(2 /* ViewContainerLocation.AuxiliaryBar */, this.state.initialization.views.containerToRestore.auxiliaryBar);
            mark('code/didRestoreAuxiliaryBar');
        })());
        // Restore Zen Mode
        const zenModeWasActive = this.isZenModeActive();
        const restoreZenMode = getZenModeConfiguration(this.configurationService).restore;
        if (zenModeWasActive) {
            this.setZenModeActive(!restoreZenMode);
            this.toggleZenMode(false, true);
        }
        // Restore Main Editor Center Mode
        if (this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED)) {
            this.centerMainEditorLayout(true, true);
        }
        // Await for promises that we recorded to update
        // our ready and restored states properly.
        Promises.settled(layoutReadyPromises).finally(() => {
            this.whenReadyPromise.complete();
            Promises.settled(layoutRestoredPromises).finally(() => {
                this.restored = true;
                this.whenRestoredPromise.complete();
            });
        });
    }
    async openViewContainer(location, id, focus) {
        let viewContainer = await this.paneCompositeService.openPaneComposite(id, location, focus);
        if (viewContainer) {
            return;
        }
        // fallback to default view container
        viewContainer = await this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(location)?.id, location, focus);
        if (viewContainer) {
            return;
        }
        // finally try to just open the first visible view container
        await this.paneCompositeService.openPaneComposite(this.paneCompositeService.getVisiblePaneCompositeIds(location).at(0), location, focus);
    }
    registerPart(part) {
        const id = part.getId();
        this.parts.set(id, part);
        return toDisposable(() => this.parts.delete(id));
    }
    getPart(key) {
        const part = this.parts.get(key);
        if (!part) {
            throw new Error(`Unknown part ${key}`);
        }
        return part;
    }
    registerNotifications(delegate) {
        this._register(delegate.onDidChangeNotificationsVisibility(visible => this._onDidChangeNotificationsVisibility.fire(visible)));
    }
    hasFocus(part) {
        const container = this.getContainer(getActiveWindow(), part);
        if (!container) {
            return false;
        }
        const activeElement = getActiveElement();
        if (!activeElement) {
            return false;
        }
        return isAncestorUsingFlowTo(activeElement, container);
    }
    _getFocusedPart() {
        for (const part of this.parts.keys()) {
            if (this.hasFocus(part)) {
                return part;
            }
        }
        return undefined;
    }
    focusPart(part, targetWindow = mainWindow) {
        const container = this.getContainer(targetWindow, part) ?? this.mainContainer;
        switch (part) {
            case "workbench.parts.editor" /* Parts.EDITOR_PART */:
                this.editorGroupService.getPart(container).activeGroup.focus();
                break;
            case "workbench.parts.panel" /* Parts.PANEL_PART */: {
                this.paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */)?.focus();
                break;
            }
            case "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */: {
                this.paneCompositeService.getActivePaneComposite(0 /* ViewContainerLocation.Sidebar */)?.focus();
                break;
            }
            case "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */: {
                this.paneCompositeService.getActivePaneComposite(2 /* ViewContainerLocation.AuxiliaryBar */)?.focus();
                break;
            }
            case "workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */:
                this.getPart("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */).focusActivityBar();
                break;
            case "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */:
                this.statusBarService.getPart(container).focus();
                break;
            default: {
                container?.focus();
            }
        }
    }
    getContainer(targetWindow, part) {
        if (typeof part === 'undefined') {
            return this.getContainerFromDocument(targetWindow.document);
        }
        if (targetWindow === mainWindow) {
            return this.getPart(part).getContainer();
        }
        // Only some parts are supported for auxiliary windows
        let partCandidate;
        if (part === "workbench.parts.editor" /* Parts.EDITOR_PART */) {
            partCandidate = this.editorGroupService.getPart(this.getContainerFromDocument(targetWindow.document));
        }
        else if (part === "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */) {
            partCandidate = this.statusBarService.getPart(this.getContainerFromDocument(targetWindow.document));
        }
        else if (part === "workbench.parts.titlebar" /* Parts.TITLEBAR_PART */) {
            partCandidate = this.titleService.getPart(this.getContainerFromDocument(targetWindow.document));
        }
        if (partCandidate instanceof Part) {
            return partCandidate.getContainer();
        }
        return undefined;
    }
    isVisible(part, targetWindow = mainWindow) {
        if (targetWindow !== mainWindow && part === "workbench.parts.editor" /* Parts.EDITOR_PART */) {
            return true; // cannot hide editor part in auxiliary windows
        }
        switch (part) {
            case "workbench.parts.titlebar" /* Parts.TITLEBAR_PART */:
                return this.initialized ?
                    this.workbenchGrid.isViewVisible(this.titleBarPartView) :
                    shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled);
            case "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */:
                return !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN);
            case "workbench.parts.panel" /* Parts.PANEL_PART */:
                return !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN);
            case "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */:
                return !this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN);
            case "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */:
                return !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN);
            case "workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */:
                return !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN);
            case "workbench.parts.editor" /* Parts.EDITOR_PART */:
                return !this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN);
            case "workbench.parts.banner" /* Parts.BANNER_PART */:
                return this.initialized ? this.workbenchGrid.isViewVisible(this.bannerPartView) : false;
            default:
                return false; // any other part cannot be hidden
        }
    }
    shouldShowBannerFirst() {
        return isWeb && !isWCOEnabled();
    }
    focus() {
        if (this.isPanelMaximized() && this.mainContainer === this.activeContainer) {
            this.focusPart("workbench.parts.panel" /* Parts.PANEL_PART */);
        }
        else {
            this.focusPart("workbench.parts.editor" /* Parts.EDITOR_PART */, getWindow(this.activeContainer));
        }
    }
    focusPanelOrEditor() {
        const activePanel = this.paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */);
        if ((this.hasFocus("workbench.parts.panel" /* Parts.PANEL_PART */) || !this.isVisible("workbench.parts.editor" /* Parts.EDITOR_PART */)) && activePanel) {
            activePanel.focus(); // prefer panel if it has focus or editor is hidden
        }
        else {
            this.focus(); // otherwise focus editor
        }
    }
    getMaximumEditorDimensions(container) {
        const targetWindow = getWindow(container);
        const containerDimension = this.getContainerDimension(container);
        if (container === this.mainContainer) {
            const isPanelHorizontal = isHorizontal(this.getPanelPosition());
            const takenWidth = (this.isVisible("workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */) ? this.activityBarPartView.minimumWidth : 0) +
                (this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */) ? this.sideBarPartView.minimumWidth : 0) +
                (this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */) && !isPanelHorizontal ? this.panelPartView.minimumWidth : 0) +
                (this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */) ? this.auxiliaryBarPartView.minimumWidth : 0);
            const takenHeight = (this.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */, targetWindow) ? this.titleBarPartView.minimumHeight : 0) +
                (this.isVisible("workbench.parts.statusbar" /* Parts.STATUSBAR_PART */, targetWindow) ? this.statusBarPartView.minimumHeight : 0) +
                (this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */) && isPanelHorizontal ? this.panelPartView.minimumHeight : 0);
            const availableWidth = containerDimension.width - takenWidth;
            const availableHeight = containerDimension.height - takenHeight;
            return { width: availableWidth, height: availableHeight };
        }
        else {
            const takenHeight = (this.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */, targetWindow) ? this.titleBarPartView.minimumHeight : 0) +
                (this.isVisible("workbench.parts.statusbar" /* Parts.STATUSBAR_PART */, targetWindow) ? this.statusBarPartView.minimumHeight : 0);
            return { width: containerDimension.width, height: containerDimension.height - takenHeight };
        }
    }
    isZenModeActive() {
        return this.stateModel.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
    }
    setZenModeActive(active) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE, active);
    }
    toggleZenMode(skipLayout, restoring = false) {
        const focusedPartPreTransition = this._getFocusedPart();
        this.setZenModeActive(!this.isZenModeActive());
        this.state.runtime.zenMode.transitionDisposables.clearAndDisposeAll();
        const setLineNumbers = (lineNumbers) => {
            for (const editor of this.mainPartEditorService.visibleTextEditorControls) {
                // To properly reset line numbers we need to read the configuration for each editor respecting it's uri.
                if (!lineNumbers && isCodeEditor(editor) && editor.hasModel()) {
                    const model = editor.getModel();
                    lineNumbers = this.configurationService.getValue('editor.lineNumbers', { resource: model.uri, overrideIdentifier: model.getLanguageId() });
                }
                if (!lineNumbers) {
                    lineNumbers = this.configurationService.getValue('editor.lineNumbers');
                }
                editor.updateOptions({ lineNumbers });
            }
        };
        // Check if zen mode transitioned to full screen and if now we are out of zen mode
        // -> we need to go out of full screen (same goes for the centered editor layout)
        let toggleMainWindowFullScreen = false;
        const config = getZenModeConfiguration(this.configurationService);
        const zenModeExitInfo = this.stateModel.getRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO);
        // Zen Mode Active
        if (this.isZenModeActive()) {
            toggleMainWindowFullScreen = !this.state.runtime.mainWindowFullscreen && config.fullScreen && !isIOS;
            if (!restoring) {
                zenModeExitInfo.transitionedToFullScreen = toggleMainWindowFullScreen;
                zenModeExitInfo.transitionedToCenteredEditorLayout = !this.isMainEditorLayoutCentered() && config.centerLayout;
                zenModeExitInfo.handleNotificationsDoNotDisturbMode = this.notificationService.getFilter() === NotificationsFilter.OFF;
                zenModeExitInfo.wasVisible.sideBar = this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */);
                zenModeExitInfo.wasVisible.panel = this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */);
                zenModeExitInfo.wasVisible.auxiliaryBar = this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
                this.stateModel.setRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO, zenModeExitInfo);
            }
            this.setPanelHidden(true, true);
            this.setAuxiliaryBarHidden(true, true);
            this.setSideBarHidden(true);
            if (config.hideActivityBar) {
                this.setActivityBarHidden(true);
            }
            if (config.hideStatusBar) {
                this.setStatusBarHidden(true);
            }
            if (config.hideLineNumbers) {
                setLineNumbers('off');
                this.state.runtime.zenMode.transitionDisposables.set("zenMode.hideLineNumbers" /* ZenModeSettings.HIDE_LINENUMBERS */, this.mainPartEditorService.onDidVisibleEditorsChange(() => setLineNumbers('off')));
            }
            if (config.showTabs !== this.editorGroupService.partOptions.showTabs) {
                this.state.runtime.zenMode.transitionDisposables.set("zenMode.showTabs" /* ZenModeSettings.SHOW_TABS */, this.editorGroupService.mainPart.enforcePartOptions({ showTabs: config.showTabs }));
            }
            if (config.silentNotifications && zenModeExitInfo.handleNotificationsDoNotDisturbMode) {
                this.notificationService.setFilter(NotificationsFilter.ERROR);
            }
            if (config.centerLayout) {
                this.centerMainEditorLayout(true, true);
            }
            // Zen Mode Configuration Changes
            this.state.runtime.zenMode.transitionDisposables.set('configurationChange', this.configurationService.onDidChangeConfiguration(e => {
                // Activity Bar
                if (e.affectsConfiguration("zenMode.hideActivityBar" /* ZenModeSettings.HIDE_ACTIVITYBAR */) || e.affectsConfiguration("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */)) {
                    const zenModeHideActivityBar = this.configurationService.getValue("zenMode.hideActivityBar" /* ZenModeSettings.HIDE_ACTIVITYBAR */);
                    const activityBarLocation = this.configurationService.getValue("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */);
                    this.setActivityBarHidden(zenModeHideActivityBar ? true : (activityBarLocation === "top" /* ActivityBarPosition.TOP */ || activityBarLocation === "bottom" /* ActivityBarPosition.BOTTOM */));
                }
                // Status Bar
                if (e.affectsConfiguration("zenMode.hideStatusBar" /* ZenModeSettings.HIDE_STATUSBAR */)) {
                    const zenModeHideStatusBar = this.configurationService.getValue("zenMode.hideStatusBar" /* ZenModeSettings.HIDE_STATUSBAR */);
                    this.setStatusBarHidden(zenModeHideStatusBar);
                }
                // Center Layout
                if (e.affectsConfiguration("zenMode.centerLayout" /* ZenModeSettings.CENTER_LAYOUT */)) {
                    const zenModeCenterLayout = this.configurationService.getValue("zenMode.centerLayout" /* ZenModeSettings.CENTER_LAYOUT */);
                    this.centerMainEditorLayout(zenModeCenterLayout, true);
                }
                // Show Tabs
                if (e.affectsConfiguration("zenMode.showTabs" /* ZenModeSettings.SHOW_TABS */)) {
                    const zenModeShowTabs = this.configurationService.getValue("zenMode.showTabs" /* ZenModeSettings.SHOW_TABS */) ?? 'multiple';
                    this.state.runtime.zenMode.transitionDisposables.set("zenMode.showTabs" /* ZenModeSettings.SHOW_TABS */, this.editorGroupService.mainPart.enforcePartOptions({ showTabs: zenModeShowTabs }));
                }
                // Notifications
                if (e.affectsConfiguration("zenMode.silentNotifications" /* ZenModeSettings.SILENT_NOTIFICATIONS */)) {
                    const zenModeSilentNotifications = !!this.configurationService.getValue("zenMode.silentNotifications" /* ZenModeSettings.SILENT_NOTIFICATIONS */);
                    if (zenModeExitInfo.handleNotificationsDoNotDisturbMode) {
                        this.notificationService.setFilter(zenModeSilentNotifications ? NotificationsFilter.ERROR : NotificationsFilter.OFF);
                    }
                }
                // Center Layout
                if (e.affectsConfiguration("zenMode.hideLineNumbers" /* ZenModeSettings.HIDE_LINENUMBERS */)) {
                    const lineNumbersType = this.configurationService.getValue("zenMode.hideLineNumbers" /* ZenModeSettings.HIDE_LINENUMBERS */) ? 'off' : undefined;
                    setLineNumbers(lineNumbersType);
                    this.state.runtime.zenMode.transitionDisposables.set("zenMode.hideLineNumbers" /* ZenModeSettings.HIDE_LINENUMBERS */, this.mainPartEditorService.onDidVisibleEditorsChange(() => setLineNumbers(lineNumbersType)));
                }
            }));
        }
        // Zen Mode Inactive
        else {
            if (zenModeExitInfo.wasVisible.panel) {
                this.setPanelHidden(false, true);
            }
            if (zenModeExitInfo.wasVisible.auxiliaryBar) {
                this.setAuxiliaryBarHidden(false, true);
            }
            if (zenModeExitInfo.wasVisible.sideBar) {
                this.setSideBarHidden(false);
            }
            if (!this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN, true)) {
                this.setActivityBarHidden(false);
            }
            if (!this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN, true)) {
                this.setStatusBarHidden(false);
            }
            if (zenModeExitInfo.transitionedToCenteredEditorLayout) {
                this.centerMainEditorLayout(false, true);
            }
            if (zenModeExitInfo.handleNotificationsDoNotDisturbMode) {
                this.notificationService.setFilter(NotificationsFilter.OFF);
            }
            setLineNumbers();
            toggleMainWindowFullScreen = zenModeExitInfo.transitionedToFullScreen && this.state.runtime.mainWindowFullscreen;
        }
        if (!skipLayout) {
            this.layout();
        }
        if (toggleMainWindowFullScreen) {
            this.hostService.toggleFullScreen(mainWindow);
        }
        // restore focus if part is still visible, otherwise fallback to editor
        if (focusedPartPreTransition && this.isVisible(focusedPartPreTransition, getWindow(this.activeContainer))) {
            if (isMultiWindowPart(focusedPartPreTransition)) {
                this.focusPart(focusedPartPreTransition, getWindow(this.activeContainer));
            }
            else {
                this.focusPart(focusedPartPreTransition);
            }
        }
        else {
            this.focus();
        }
        // Event
        this._onDidChangeZenMode.fire(this.isZenModeActive());
    }
    setStatusBarHidden(hidden) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN, hidden);
        // Adjust CSS
        if (hidden) {
            this.mainContainer.classList.add(LayoutClasses.STATUSBAR_HIDDEN);
        }
        else {
            this.mainContainer.classList.remove(LayoutClasses.STATUSBAR_HIDDEN);
        }
        // Propagate to grid
        this.workbenchGrid.setViewVisible(this.statusBarPartView, !hidden);
    }
    createWorkbenchLayout() {
        const titleBar = this.getPart("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */);
        const bannerPart = this.getPart("workbench.parts.banner" /* Parts.BANNER_PART */);
        const editorPart = this.getPart("workbench.parts.editor" /* Parts.EDITOR_PART */);
        const activityBar = this.getPart("workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */);
        const panelPart = this.getPart("workbench.parts.panel" /* Parts.PANEL_PART */);
        const auxiliaryBarPart = this.getPart("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
        const sideBar = this.getPart("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */);
        const statusBar = this.getPart("workbench.parts.statusbar" /* Parts.STATUSBAR_PART */);
        // View references for all parts
        this.titleBarPartView = titleBar;
        this.bannerPartView = bannerPart;
        this.sideBarPartView = sideBar;
        this.activityBarPartView = activityBar;
        this.editorPartView = editorPart;
        this.panelPartView = panelPart;
        this.auxiliaryBarPartView = auxiliaryBarPart;
        this.statusBarPartView = statusBar;
        const viewMap = {
            ["workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */]: this.activityBarPartView,
            ["workbench.parts.banner" /* Parts.BANNER_PART */]: this.bannerPartView,
            ["workbench.parts.titlebar" /* Parts.TITLEBAR_PART */]: this.titleBarPartView,
            ["workbench.parts.editor" /* Parts.EDITOR_PART */]: this.editorPartView,
            ["workbench.parts.panel" /* Parts.PANEL_PART */]: this.panelPartView,
            ["workbench.parts.sidebar" /* Parts.SIDEBAR_PART */]: this.sideBarPartView,
            ["workbench.parts.statusbar" /* Parts.STATUSBAR_PART */]: this.statusBarPartView,
            ["workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */]: this.auxiliaryBarPartView
        };
        const fromJSON = ({ type }) => viewMap[type];
        const workbenchGrid = SerializableGrid.deserialize(this.createGridDescriptor(), { fromJSON }, { proportionalLayout: false });
        this.mainContainer.prepend(workbenchGrid.element);
        this.mainContainer.setAttribute('role', 'application');
        this.workbenchGrid = workbenchGrid;
        this.workbenchGrid.edgeSnapping = this.state.runtime.mainWindowFullscreen;
        for (const part of [titleBar, editorPart, activityBar, panelPart, sideBar, statusBar, auxiliaryBarPart, bannerPart]) {
            this._register(part.onDidVisibilityChange((visible) => {
                if (part === sideBar) {
                    this.setSideBarHidden(!visible);
                }
                else if (part === panelPart) {
                    this.setPanelHidden(!visible, true);
                }
                else if (part === auxiliaryBarPart) {
                    this.setAuxiliaryBarHidden(!visible, true);
                }
                else if (part === editorPart) {
                    this.setEditorHidden(!visible);
                }
                this._onDidChangePartVisibility.fire();
                this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
            }));
        }
        this._register(this.storageService.onWillSaveState(e => {
            // Side Bar Size
            const sideBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN)
                ? this.workbenchGrid.getViewCachedVisibleSize(this.sideBarPartView)
                : this.workbenchGrid.getViewSize(this.sideBarPartView).width;
            this.stateModel.setInitializationValue(LayoutStateKeys.SIDEBAR_SIZE, sideBarSize);
            // Panel Size
            const panelSize = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN)
                ? this.workbenchGrid.getViewCachedVisibleSize(this.panelPartView)
                : isHorizontal(this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION))
                    ? this.workbenchGrid.getViewSize(this.panelPartView).height
                    : this.workbenchGrid.getViewSize(this.panelPartView).width;
            this.stateModel.setInitializationValue(LayoutStateKeys.PANEL_SIZE, panelSize);
            // Auxiliary Bar Size
            const auxiliaryBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN)
                ? this.workbenchGrid.getViewCachedVisibleSize(this.auxiliaryBarPartView)
                : this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).width;
            this.stateModel.setInitializationValue(LayoutStateKeys.AUXILIARYBAR_SIZE, auxiliaryBarSize);
            this.stateModel.save(true, true);
        }));
    }
    layout() {
        if (!this.disposed) {
            this._mainContainerDimension = getClientArea(this.state.runtime.mainWindowFullscreen ?
                mainWindow.document.body : // in fullscreen mode, make sure to use <body> element because
                this.parent, // in that case the workbench will span the entire site
            DEFAULT_WINDOW_DIMENSIONS // running with fallback to ensure no error is thrown (https://github.com/microsoft/vscode/issues/240242)
            );
            this.logService.trace(`Layout#layout, height: ${this._mainContainerDimension.height}, width: ${this._mainContainerDimension.width}`);
            position(this.mainContainer, 0, 0, 0, 0, 'relative');
            size(this.mainContainer, this._mainContainerDimension.width, this._mainContainerDimension.height);
            // Layout the grid widget
            this.workbenchGrid.layout(this._mainContainerDimension.width, this._mainContainerDimension.height);
            this.initialized = true;
            // Emit as event
            this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
        }
    }
    isMainEditorLayoutCentered() {
        return this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED);
    }
    centerMainEditorLayout(active, skipLayout) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED, active);
        const mainVisibleEditors = coalesce(this.editorGroupService.mainPart.groups.map(group => group.activeEditor));
        const isEditorComplex = mainVisibleEditors.some(editor => {
            if (editor instanceof DiffEditorInput) {
                return this.configurationService.getValue('diffEditor.renderSideBySide');
            }
            if (editor?.hasCapability(256 /* EditorInputCapabilities.MultipleEditors */)) {
                return true;
            }
            return false;
        });
        const layout = this.editorGroupService.getLayout();
        let hasMoreThanOneColumn = false;
        if (layout.orientation === 0 /* GroupOrientation.HORIZONTAL */) {
            hasMoreThanOneColumn = layout.groups.length > 1;
        }
        else {
            hasMoreThanOneColumn = layout.groups.some(group => group.groups && group.groups.length > 1);
        }
        const isCenteredLayoutAutoResizing = this.configurationService.getValue('workbench.editor.centeredLayoutAutoResize');
        if (isCenteredLayoutAutoResizing &&
            ((hasMoreThanOneColumn && !this.editorGroupService.mainPart.hasMaximizedGroup()) || isEditorComplex)) {
            active = false; // disable centered layout for complex editors or when there is more than one group
        }
        if (this.editorGroupService.mainPart.isLayoutCentered() !== active) {
            this.editorGroupService.mainPart.centerLayout(active);
            if (!skipLayout) {
                this.layout();
            }
        }
        this._onDidChangeMainEditorCenteredLayout.fire(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED));
    }
    getSize(part) {
        return this.workbenchGrid.getViewSize(this.getPart(part));
    }
    setSize(part, size) {
        this.workbenchGrid.resizeView(this.getPart(part), size);
    }
    resizePart(part, sizeChangeWidth, sizeChangeHeight) {
        const sizeChangePxWidth = Math.sign(sizeChangeWidth) * computeScreenAwareSize(getActiveWindow(), Math.abs(sizeChangeWidth));
        const sizeChangePxHeight = Math.sign(sizeChangeHeight) * computeScreenAwareSize(getActiveWindow(), Math.abs(sizeChangeHeight));
        let viewSize;
        switch (part) {
            case "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */:
                viewSize = this.workbenchGrid.getViewSize(this.sideBarPartView);
                this.workbenchGrid.resizeView(this.sideBarPartView, {
                    width: viewSize.width + sizeChangePxWidth,
                    height: viewSize.height
                });
                break;
            case "workbench.parts.panel" /* Parts.PANEL_PART */:
                viewSize = this.workbenchGrid.getViewSize(this.panelPartView);
                this.workbenchGrid.resizeView(this.panelPartView, {
                    width: viewSize.width + (isHorizontal(this.getPanelPosition()) ? 0 : sizeChangePxWidth),
                    height: viewSize.height + (isHorizontal(this.getPanelPosition()) ? sizeChangePxHeight : 0)
                });
                break;
            case "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */:
                viewSize = this.workbenchGrid.getViewSize(this.auxiliaryBarPartView);
                this.workbenchGrid.resizeView(this.auxiliaryBarPartView, {
                    width: viewSize.width + sizeChangePxWidth,
                    height: viewSize.height
                });
                break;
            case "workbench.parts.editor" /* Parts.EDITOR_PART */:
                viewSize = this.workbenchGrid.getViewSize(this.editorPartView);
                // Single Editor Group
                if (this.editorGroupService.mainPart.count === 1) {
                    this.workbenchGrid.resizeView(this.editorPartView, {
                        width: viewSize.width + sizeChangePxWidth,
                        height: viewSize.height + sizeChangePxHeight
                    });
                }
                else {
                    const activeGroup = this.editorGroupService.mainPart.activeGroup;
                    const { width, height } = this.editorGroupService.mainPart.getSize(activeGroup);
                    this.editorGroupService.mainPart.setSize(activeGroup, { width: width + sizeChangePxWidth, height: height + sizeChangePxHeight });
                    // After resizing the editor group
                    // if it does not change in either direction
                    // try resizing the full editor part
                    const { width: newWidth, height: newHeight } = this.editorGroupService.mainPart.getSize(activeGroup);
                    if ((sizeChangePxHeight && height === newHeight) || (sizeChangePxWidth && width === newWidth)) {
                        this.workbenchGrid.resizeView(this.editorPartView, {
                            width: viewSize.width + (sizeChangePxWidth && width === newWidth ? sizeChangePxWidth : 0),
                            height: viewSize.height + (sizeChangePxHeight && height === newHeight ? sizeChangePxHeight : 0)
                        });
                    }
                }
                break;
            default:
                return; // Cannot resize other parts
        }
    }
    setActivityBarHidden(hidden) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN, hidden);
        this.workbenchGrid.setViewVisible(this.activityBarPartView, !hidden);
    }
    setBannerHidden(hidden) {
        this.workbenchGrid.setViewVisible(this.bannerPartView, !hidden);
    }
    setEditorHidden(hidden) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN, hidden);
        // Adjust CSS
        if (hidden) {
            this.mainContainer.classList.add(LayoutClasses.MAIN_EDITOR_AREA_HIDDEN);
        }
        else {
            this.mainContainer.classList.remove(LayoutClasses.MAIN_EDITOR_AREA_HIDDEN);
        }
        // Propagate to grid
        this.workbenchGrid.setViewVisible(this.editorPartView, !hidden);
        // The editor and panel cannot be hidden at the same time
        if (hidden && !this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */)) {
            this.setPanelHidden(false, true);
        }
    }
    getLayoutClasses() {
        return coalesce([
            !this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */) ? LayoutClasses.SIDEBAR_HIDDEN : undefined,
            !this.isVisible("workbench.parts.editor" /* Parts.EDITOR_PART */, mainWindow) ? LayoutClasses.MAIN_EDITOR_AREA_HIDDEN : undefined,
            !this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */) ? LayoutClasses.PANEL_HIDDEN : undefined,
            !this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */) ? LayoutClasses.AUXILIARYBAR_HIDDEN : undefined,
            !this.isVisible("workbench.parts.statusbar" /* Parts.STATUSBAR_PART */) ? LayoutClasses.STATUSBAR_HIDDEN : undefined,
            this.state.runtime.mainWindowFullscreen ? LayoutClasses.FULLSCREEN : undefined
        ]);
    }
    setSideBarHidden(hidden) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN, hidden);
        // Adjust CSS
        if (hidden) {
            this.mainContainer.classList.add(LayoutClasses.SIDEBAR_HIDDEN);
        }
        else {
            this.mainContainer.classList.remove(LayoutClasses.SIDEBAR_HIDDEN);
        }
        // If sidebar becomes hidden, also hide the current active Viewlet if any
        if (hidden && this.paneCompositeService.getActivePaneComposite(0 /* ViewContainerLocation.Sidebar */)) {
            this.paneCompositeService.hideActivePaneComposite(0 /* ViewContainerLocation.Sidebar */);
            this.focusPanelOrEditor();
        }
        // If sidebar becomes visible, show last active Viewlet or default viewlet
        else if (!hidden && !this.paneCompositeService.getActivePaneComposite(0 /* ViewContainerLocation.Sidebar */)) {
            const viewletToOpen = this.paneCompositeService.getLastActivePaneCompositeId(0 /* ViewContainerLocation.Sidebar */);
            if (viewletToOpen) {
                this.openViewContainer(0 /* ViewContainerLocation.Sidebar */, viewletToOpen, true);
            }
        }
        // Propagate to grid
        this.workbenchGrid.setViewVisible(this.sideBarPartView, !hidden);
    }
    hasViews(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(id);
        if (!viewContainer) {
            return false;
        }
        const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
        if (!viewContainerModel) {
            return false;
        }
        return viewContainerModel.activeViewDescriptors.length >= 1;
    }
    adjustPartPositions(sideBarPosition, panelAlignment, panelPosition) {
        // Move activity bar and side bars
        const isPanelVertical = !isHorizontal(panelPosition);
        const sideBarSiblingToEditor = isPanelVertical || !(panelAlignment === 'center' || (sideBarPosition === 0 /* Position.LEFT */ && panelAlignment === 'right') || (sideBarPosition === 1 /* Position.RIGHT */ && panelAlignment === 'left'));
        const auxiliaryBarSiblingToEditor = isPanelVertical || !(panelAlignment === 'center' || (sideBarPosition === 1 /* Position.RIGHT */ && panelAlignment === 'right') || (sideBarPosition === 0 /* Position.LEFT */ && panelAlignment === 'left'));
        const preMovePanelWidth = !this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.panelPartView) ?? this.panelPartView.minimumWidth) : this.workbenchGrid.getViewSize(this.panelPartView).width;
        const preMovePanelHeight = !this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.panelPartView) ?? this.panelPartView.minimumHeight) : this.workbenchGrid.getViewSize(this.panelPartView).height;
        const preMoveSideBarSize = !this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.sideBarPartView) ?? this.sideBarPartView.minimumWidth) : this.workbenchGrid.getViewSize(this.sideBarPartView).width;
        const preMoveAuxiliaryBarSize = !this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.auxiliaryBarPartView) ?? this.auxiliaryBarPartView.minimumWidth) : this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).width;
        const focusedPart = ["workbench.parts.panel" /* Parts.PANEL_PART */, "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */].find(part => this.hasFocus(part));
        if (sideBarPosition === 0 /* Position.LEFT */) {
            this.workbenchGrid.moveViewTo(this.activityBarPartView, [2, 0]);
            this.workbenchGrid.moveView(this.sideBarPartView, preMoveSideBarSize, sideBarSiblingToEditor ? this.editorPartView : this.activityBarPartView, sideBarSiblingToEditor ? 2 /* Direction.Left */ : 3 /* Direction.Right */);
            if (auxiliaryBarSiblingToEditor) {
                this.workbenchGrid.moveView(this.auxiliaryBarPartView, preMoveAuxiliaryBarSize, this.editorPartView, 3 /* Direction.Right */);
            }
            else {
                this.workbenchGrid.moveViewTo(this.auxiliaryBarPartView, [2, -1]);
            }
        }
        else {
            this.workbenchGrid.moveViewTo(this.activityBarPartView, [2, -1]);
            this.workbenchGrid.moveView(this.sideBarPartView, preMoveSideBarSize, sideBarSiblingToEditor ? this.editorPartView : this.activityBarPartView, sideBarSiblingToEditor ? 3 /* Direction.Right */ : 2 /* Direction.Left */);
            if (auxiliaryBarSiblingToEditor) {
                this.workbenchGrid.moveView(this.auxiliaryBarPartView, preMoveAuxiliaryBarSize, this.editorPartView, 2 /* Direction.Left */);
            }
            else {
                this.workbenchGrid.moveViewTo(this.auxiliaryBarPartView, [2, 0]);
            }
        }
        // Maintain focus after moving parts
        if (focusedPart) {
            this.focusPart(focusedPart);
        }
        // We moved all the side parts based on the editor and ignored the panel
        // Now, we need to put the panel back in the right position when it is next to the editor
        if (isPanelVertical) {
            this.workbenchGrid.moveView(this.panelPartView, preMovePanelWidth, this.editorPartView, panelPosition === 0 /* Position.LEFT */ ? 2 /* Direction.Left */ : 3 /* Direction.Right */);
            this.workbenchGrid.resizeView(this.panelPartView, {
                height: preMovePanelHeight,
                width: preMovePanelWidth
            });
        }
        // Moving views in the grid can cause them to re-distribute sizing unnecessarily
        // Resize visible parts to the width they were before the operation
        if (this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */)) {
            this.workbenchGrid.resizeView(this.sideBarPartView, {
                height: this.workbenchGrid.getViewSize(this.sideBarPartView).height,
                width: preMoveSideBarSize
            });
        }
        if (this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */)) {
            this.workbenchGrid.resizeView(this.auxiliaryBarPartView, {
                height: this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).height,
                width: preMoveAuxiliaryBarSize
            });
        }
    }
    setPanelAlignment(alignment) {
        // Panel alignment only applies to a panel in the top/bottom position
        if (!isHorizontal(this.getPanelPosition())) {
            this.setPanelPosition(2 /* Position.BOTTOM */);
        }
        // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
        if (alignment !== 'center' && this.isPanelMaximized()) {
            this.toggleMaximizedPanel();
        }
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_ALIGNMENT, alignment);
        this.adjustPartPositions(this.getSideBarPosition(), alignment, this.getPanelPosition());
        this._onDidChangePanelAlignment.fire(alignment);
    }
    setPanelHidden(hidden, skipLayout) {
        // Return if not initialized fully #105480
        if (!this.workbenchGrid) {
            return;
        }
        const wasHidden = !this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */);
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_HIDDEN, hidden);
        const isPanelMaximized = this.isPanelMaximized();
        const panelOpensMaximized = this.panelOpensMaximized();
        // Adjust CSS
        if (hidden) {
            this.mainContainer.classList.add(LayoutClasses.PANEL_HIDDEN);
        }
        else {
            this.mainContainer.classList.remove(LayoutClasses.PANEL_HIDDEN);
        }
        // If panel part becomes hidden, also hide the current active panel if any
        let focusEditor = false;
        if (hidden && this.paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */)) {
            this.paneCompositeService.hideActivePaneComposite(1 /* ViewContainerLocation.Panel */);
            focusEditor = isIOS ? false : true; // Do not auto focus on ios #127832
        }
        // If panel part becomes visible, show last active panel or default panel
        else if (!hidden && !this.paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */)) {
            let panelToOpen = this.paneCompositeService.getLastActivePaneCompositeId(1 /* ViewContainerLocation.Panel */);
            // verify that the panel we try to open has views before we default to it
            // otherwise fall back to any view that has views still refs #111463
            if (!panelToOpen || !this.hasViews(panelToOpen)) {
                panelToOpen = this.viewDescriptorService
                    .getViewContainersByLocation(1 /* ViewContainerLocation.Panel */)
                    .find(viewContainer => this.hasViews(viewContainer.id))?.id;
            }
            if (panelToOpen) {
                this.openViewContainer(1 /* ViewContainerLocation.Panel */, panelToOpen, !skipLayout);
            }
        }
        // If maximized and in process of hiding, unmaximize before hiding to allow caching of non-maximized size
        if (hidden && isPanelMaximized) {
            this.toggleMaximizedPanel();
        }
        // Don't proceed if we have already done this before
        if (wasHidden === hidden) {
            return;
        }
        // Propagate layout changes to grid
        this.workbenchGrid.setViewVisible(this.panelPartView, !hidden);
        // If in process of showing, toggle whether or not panel is maximized
        if (!hidden) {
            if (!skipLayout && isPanelMaximized !== panelOpensMaximized) {
                this.toggleMaximizedPanel();
            }
        }
        else {
            // If in process of hiding, remember whether the panel is maximized or not
            this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED, isPanelMaximized);
        }
        if (focusEditor) {
            this.editorGroupService.mainPart.activeGroup.focus(); // Pass focus to editor group if panel part is now hidden
        }
    }
    toggleMaximizedPanel() {
        const size = this.workbenchGrid.getViewSize(this.panelPartView);
        const panelPosition = this.getPanelPosition();
        const isMaximized = this.isPanelMaximized();
        if (!isMaximized) {
            if (this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */)) {
                if (isHorizontal(panelPosition)) {
                    this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT, size.height);
                }
                else {
                    this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH, size.width);
                }
            }
            this.setEditorHidden(true);
        }
        else {
            this.setEditorHidden(false);
            this.workbenchGrid.resizeView(this.panelPartView, {
                width: isHorizontal(panelPosition) ? size.width : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH),
                height: isHorizontal(panelPosition) ? this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT) : size.height
            });
        }
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED, !isMaximized);
    }
    panelOpensMaximized() {
        // The workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
        if (this.getPanelAlignment() !== 'center' && isHorizontal(this.getPanelPosition())) {
            return false;
        }
        const panelOpensMaximized = panelOpensMaximizedFromString(this.configurationService.getValue(WorkbenchLayoutSettings.PANEL_OPENS_MAXIMIZED));
        const panelLastIsMaximized = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED);
        return panelOpensMaximized === 0 /* PanelOpensMaximizedOptions.ALWAYS */ || (panelOpensMaximized === 2 /* PanelOpensMaximizedOptions.REMEMBER_LAST */ && panelLastIsMaximized);
    }
    setAuxiliaryBarHidden(hidden, skipLayout) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN, hidden);
        // Adjust CSS
        if (hidden) {
            this.mainContainer.classList.add(LayoutClasses.AUXILIARYBAR_HIDDEN);
        }
        else {
            this.mainContainer.classList.remove(LayoutClasses.AUXILIARYBAR_HIDDEN);
        }
        // If auxiliary bar becomes hidden, also hide the current active pane composite if any
        if (hidden && this.paneCompositeService.getActivePaneComposite(2 /* ViewContainerLocation.AuxiliaryBar */)) {
            this.paneCompositeService.hideActivePaneComposite(2 /* ViewContainerLocation.AuxiliaryBar */);
            this.focusPanelOrEditor();
        }
        // If auxiliary bar becomes visible, show last active pane composite or default pane composite
        else if (!hidden && !this.paneCompositeService.getActivePaneComposite(2 /* ViewContainerLocation.AuxiliaryBar */)) {
            let viewletToOpen = this.paneCompositeService.getLastActivePaneCompositeId(2 /* ViewContainerLocation.AuxiliaryBar */);
            // verify that the viewlet we try to open has views before we default to it
            // otherwise fall back to any view that has views still refs #111463
            if (!viewletToOpen || !this.hasViews(viewletToOpen)) {
                viewletToOpen = this.viewDescriptorService
                    .getViewContainersByLocation(2 /* ViewContainerLocation.AuxiliaryBar */)
                    .find(viewContainer => this.hasViews(viewContainer.id))?.id;
            }
            if (viewletToOpen) {
                this.openViewContainer(2 /* ViewContainerLocation.AuxiliaryBar */, viewletToOpen, !skipLayout);
            }
        }
        // Propagate to grid
        this.workbenchGrid.setViewVisible(this.auxiliaryBarPartView, !hidden);
    }
    setPartHidden(hidden, part) {
        switch (part) {
            case "workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */:
                return this.setActivityBarHidden(hidden);
            case "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */:
                return this.setSideBarHidden(hidden);
            case "workbench.parts.editor" /* Parts.EDITOR_PART */:
                return this.setEditorHidden(hidden);
            case "workbench.parts.banner" /* Parts.BANNER_PART */:
                return this.setBannerHidden(hidden);
            case "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */:
                return this.setAuxiliaryBarHidden(hidden);
            case "workbench.parts.panel" /* Parts.PANEL_PART */:
                return this.setPanelHidden(hidden);
        }
    }
    hasMainWindowBorder() {
        return this.state.runtime.mainWindowBorder;
    }
    getMainWindowBorderRadius() {
        return this.state.runtime.mainWindowBorder && isMacintosh ? '10px' : undefined;
    }
    isPanelMaximized() {
        // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
        return (this.getPanelAlignment() === 'center' || !isHorizontal(this.getPanelPosition())) && !this.isVisible("workbench.parts.editor" /* Parts.EDITOR_PART */, mainWindow);
    }
    getSideBarPosition() {
        return this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON);
    }
    getPanelAlignment() {
        return this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_ALIGNMENT);
    }
    updateMenubarVisibility(skipLayout) {
        const shouldShowTitleBar = shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled);
        if (!skipLayout && this.workbenchGrid && shouldShowTitleBar !== this.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */, mainWindow)) {
            this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowTitleBar);
        }
    }
    updateCustomTitleBarVisibility() {
        const shouldShowTitleBar = shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled);
        const titlebarVisible = this.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */);
        if (shouldShowTitleBar !== titlebarVisible) {
            this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowTitleBar);
        }
    }
    toggleMenuBar() {
        let currentVisibilityValue = getMenuBarVisibility(this.configurationService);
        if (typeof currentVisibilityValue !== 'string') {
            currentVisibilityValue = 'classic';
        }
        let newVisibilityValue;
        if (currentVisibilityValue === 'visible' || currentVisibilityValue === 'classic') {
            newVisibilityValue = hasNativeMenu(this.configurationService) ? 'toggle' : 'compact';
        }
        else {
            newVisibilityValue = 'classic';
        }
        this.configurationService.updateValue("window.menuBarVisibility" /* MenuSettings.MenuBarVisibility */, newVisibilityValue);
    }
    getPanelPosition() {
        return this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION);
    }
    setPanelPosition(position) {
        if (!this.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */)) {
            this.setPanelHidden(false);
        }
        const panelPart = this.getPart("workbench.parts.panel" /* Parts.PANEL_PART */);
        const oldPositionValue = positionToString(this.getPanelPosition());
        const newPositionValue = positionToString(position);
        // Adjust CSS
        const panelContainer = assertReturnsDefined(panelPart.getContainer());
        panelContainer.classList.remove(oldPositionValue);
        panelContainer.classList.add(newPositionValue);
        // Update Styles
        panelPart.updateStyles();
        // Layout
        const size = this.workbenchGrid.getViewSize(this.panelPartView);
        const sideBarSize = this.workbenchGrid.getViewSize(this.sideBarPartView);
        const auxiliaryBarSize = this.workbenchGrid.getViewSize(this.auxiliaryBarPartView);
        let editorHidden = !this.isVisible("workbench.parts.editor" /* Parts.EDITOR_PART */, mainWindow);
        // Save last non-maximized size for panel before move
        if (newPositionValue !== oldPositionValue && !editorHidden) {
            // Save the current size of the panel for the new orthogonal direction
            // If moving down, save the width of the panel
            // Otherwise, save the height of the panel
            if (isHorizontal(position)) {
                this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH, size.width);
            }
            else if (isHorizontal(positionFromString(oldPositionValue))) {
                this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT, size.height);
            }
        }
        if (isHorizontal(position) && this.getPanelAlignment() !== 'center' && editorHidden) {
            this.toggleMaximizedPanel();
            editorHidden = false;
        }
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_POSITION, position);
        const sideBarVisible = this.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */);
        const auxiliaryBarVisible = this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
        const hadFocus = this.hasFocus("workbench.parts.panel" /* Parts.PANEL_PART */);
        if (position === 2 /* Position.BOTTOM */) {
            this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size.height : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT), this.editorPartView, 1 /* Direction.Down */);
        }
        else if (position === 3 /* Position.TOP */) {
            this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size.height : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT), this.editorPartView, 0 /* Direction.Up */);
        }
        else if (position === 1 /* Position.RIGHT */) {
            this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size.width : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH), this.editorPartView, 3 /* Direction.Right */);
        }
        else {
            this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size.width : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH), this.editorPartView, 2 /* Direction.Left */);
        }
        if (hadFocus) {
            this.focusPart("workbench.parts.panel" /* Parts.PANEL_PART */);
        }
        // Reset sidebar to original size before shifting the panel
        this.workbenchGrid.resizeView(this.sideBarPartView, sideBarSize);
        if (!sideBarVisible) {
            this.setSideBarHidden(true);
        }
        this.workbenchGrid.resizeView(this.auxiliaryBarPartView, auxiliaryBarSize);
        if (!auxiliaryBarVisible) {
            this.setAuxiliaryBarHidden(true);
        }
        if (isHorizontal(position)) {
            this.adjustPartPositions(this.getSideBarPosition(), this.getPanelAlignment(), position);
        }
        this._onDidChangePanelPosition.fire(newPositionValue);
    }
    isWindowMaximized(targetWindow) {
        return this.state.runtime.maximized.has(getWindowId(targetWindow));
    }
    updateWindowMaximizedState(targetWindow, maximized) {
        this.mainContainer.classList.toggle(LayoutClasses.MAXIMIZED, maximized);
        const targetWindowId = getWindowId(targetWindow);
        if (maximized === this.state.runtime.maximized.has(targetWindowId)) {
            return;
        }
        if (maximized) {
            this.state.runtime.maximized.add(targetWindowId);
        }
        else {
            this.state.runtime.maximized.delete(targetWindowId);
        }
        this.updateWindowsBorder();
        this._onDidChangeWindowMaximized.fire({ windowId: targetWindowId, maximized });
    }
    getVisibleNeighborPart(part, direction) {
        if (!this.workbenchGrid) {
            return undefined;
        }
        if (!this.isVisible(part, mainWindow)) {
            return undefined;
        }
        const neighborViews = this.workbenchGrid.getNeighborViews(this.getPart(part), direction, false);
        if (!neighborViews) {
            return undefined;
        }
        for (const neighborView of neighborViews) {
            const neighborPart = ["workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */, "workbench.parts.editor" /* Parts.EDITOR_PART */, "workbench.parts.panel" /* Parts.PANEL_PART */, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */, "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */, "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */, "workbench.parts.titlebar" /* Parts.TITLEBAR_PART */]
                .find(partId => this.getPart(partId) === neighborView && this.isVisible(partId, mainWindow));
            if (neighborPart !== undefined) {
                return neighborPart;
            }
        }
        return undefined;
    }
    onDidChangeWCO() {
        const bannerFirst = this.workbenchGrid.getNeighborViews(this.titleBarPartView, 0 /* Direction.Up */, false).length > 0;
        const shouldBannerBeFirst = this.shouldShowBannerFirst();
        if (bannerFirst !== shouldBannerBeFirst) {
            this.workbenchGrid.moveView(this.bannerPartView, Sizing.Distribute, this.titleBarPartView, shouldBannerBeFirst ? 0 /* Direction.Up */ : 1 /* Direction.Down */);
        }
        this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
    }
    arrangeEditorNodes(nodes, availableHeight, availableWidth) {
        if (!nodes.sideBar && !nodes.auxiliaryBar) {
            nodes.editor.size = availableHeight;
            return nodes.editor;
        }
        const result = [nodes.editor];
        nodes.editor.size = availableWidth;
        if (nodes.sideBar) {
            if (this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON) === 0 /* Position.LEFT */) {
                result.splice(0, 0, nodes.sideBar);
            }
            else {
                result.push(nodes.sideBar);
            }
            nodes.editor.size -= this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN) ? 0 : nodes.sideBar.size;
        }
        if (nodes.auxiliaryBar) {
            if (this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON) === 1 /* Position.RIGHT */) {
                result.splice(0, 0, nodes.auxiliaryBar);
            }
            else {
                result.push(nodes.auxiliaryBar);
            }
            nodes.editor.size -= this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN) ? 0 : nodes.auxiliaryBar.size;
        }
        return {
            type: 'branch',
            data: result,
            size: availableHeight
        };
    }
    arrangeMiddleSectionNodes(nodes, availableWidth, availableHeight) {
        const activityBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN) ? 0 : nodes.activityBar.size;
        const sideBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN) ? 0 : nodes.sideBar.size;
        const auxiliaryBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN) ? 0 : nodes.auxiliaryBar.size;
        const panelSize = this.stateModel.getInitializationValue(LayoutStateKeys.PANEL_SIZE) ? 0 : nodes.panel.size;
        const panelPostion = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION);
        const sideBarPosition = this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON);
        const result = [];
        if (!isHorizontal(panelPostion)) {
            result.push(nodes.editor);
            nodes.editor.size = availableWidth - activityBarSize - sideBarSize - panelSize - auxiliaryBarSize;
            if (panelPostion === 1 /* Position.RIGHT */) {
                result.push(nodes.panel);
            }
            else {
                result.splice(0, 0, nodes.panel);
            }
            if (sideBarPosition === 0 /* Position.LEFT */) {
                result.push(nodes.auxiliaryBar);
                result.splice(0, 0, nodes.sideBar);
                result.splice(0, 0, nodes.activityBar);
            }
            else {
                result.splice(0, 0, nodes.auxiliaryBar);
                result.push(nodes.sideBar);
                result.push(nodes.activityBar);
            }
        }
        else {
            const panelAlignment = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_ALIGNMENT);
            const sideBarNextToEditor = !(panelAlignment === 'center' || (sideBarPosition === 0 /* Position.LEFT */ && panelAlignment === 'right') || (sideBarPosition === 1 /* Position.RIGHT */ && panelAlignment === 'left'));
            const auxiliaryBarNextToEditor = !(panelAlignment === 'center' || (sideBarPosition === 1 /* Position.RIGHT */ && panelAlignment === 'right') || (sideBarPosition === 0 /* Position.LEFT */ && panelAlignment === 'left'));
            const editorSectionWidth = availableWidth - activityBarSize - (sideBarNextToEditor ? 0 : sideBarSize) - (auxiliaryBarNextToEditor ? 0 : auxiliaryBarSize);
            const editorNodes = this.arrangeEditorNodes({
                editor: nodes.editor,
                sideBar: sideBarNextToEditor ? nodes.sideBar : undefined,
                auxiliaryBar: auxiliaryBarNextToEditor ? nodes.auxiliaryBar : undefined
            }, availableHeight - panelSize, editorSectionWidth);
            result.push({
                type: 'branch',
                data: panelPostion === 2 /* Position.BOTTOM */ ? [editorNodes, nodes.panel] : [nodes.panel, editorNodes],
                size: editorSectionWidth
            });
            if (!sideBarNextToEditor) {
                if (sideBarPosition === 0 /* Position.LEFT */) {
                    result.splice(0, 0, nodes.sideBar);
                }
                else {
                    result.push(nodes.sideBar);
                }
            }
            if (!auxiliaryBarNextToEditor) {
                if (sideBarPosition === 1 /* Position.RIGHT */) {
                    result.splice(0, 0, nodes.auxiliaryBar);
                }
                else {
                    result.push(nodes.auxiliaryBar);
                }
            }
            if (sideBarPosition === 0 /* Position.LEFT */) {
                result.splice(0, 0, nodes.activityBar);
            }
            else {
                result.push(nodes.activityBar);
            }
        }
        return result;
    }
    createGridDescriptor() {
        const { width, height } = this._mainContainerDimension;
        const sideBarSize = this.stateModel.getInitializationValue(LayoutStateKeys.SIDEBAR_SIZE);
        const auxiliaryBarPartSize = this.stateModel.getInitializationValue(LayoutStateKeys.AUXILIARYBAR_SIZE);
        const panelSize = this.stateModel.getInitializationValue(LayoutStateKeys.PANEL_SIZE);
        const titleBarHeight = this.titleBarPartView.minimumHeight;
        const bannerHeight = this.bannerPartView.minimumHeight;
        const statusBarHeight = this.statusBarPartView.minimumHeight;
        const activityBarWidth = this.activityBarPartView.minimumWidth;
        const middleSectionHeight = height - titleBarHeight - statusBarHeight;
        const titleAndBanner = [
            {
                type: 'leaf',
                data: { type: "workbench.parts.titlebar" /* Parts.TITLEBAR_PART */ },
                size: titleBarHeight,
                visible: this.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */, mainWindow)
            },
            {
                type: 'leaf',
                data: { type: "workbench.parts.banner" /* Parts.BANNER_PART */ },
                size: bannerHeight,
                visible: false
            }
        ];
        const activityBarNode = {
            type: 'leaf',
            data: { type: "workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */ },
            size: activityBarWidth,
            visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN)
        };
        const sideBarNode = {
            type: 'leaf',
            data: { type: "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */ },
            size: sideBarSize,
            visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN)
        };
        const auxiliaryBarNode = {
            type: 'leaf',
            data: { type: "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */ },
            size: auxiliaryBarPartSize,
            visible: this.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */)
        };
        const editorNode = {
            type: 'leaf',
            data: { type: "workbench.parts.editor" /* Parts.EDITOR_PART */ },
            size: 0, // Update based on sibling sizes
            visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN)
        };
        const panelNode = {
            type: 'leaf',
            data: { type: "workbench.parts.panel" /* Parts.PANEL_PART */ },
            size: panelSize,
            visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN)
        };
        const middleSection = this.arrangeMiddleSectionNodes({
            activityBar: activityBarNode,
            auxiliaryBar: auxiliaryBarNode,
            editor: editorNode,
            panel: panelNode,
            sideBar: sideBarNode
        }, width, middleSectionHeight);
        const result = {
            root: {
                type: 'branch',
                size: width,
                data: [
                    ...(this.shouldShowBannerFirst() ? titleAndBanner.reverse() : titleAndBanner),
                    {
                        type: 'branch',
                        data: middleSection,
                        size: middleSectionHeight
                    },
                    {
                        type: 'leaf',
                        data: { type: "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */ },
                        size: statusBarHeight,
                        visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN)
                    }
                ]
            },
            orientation: 0 /* Orientation.VERTICAL */,
            width,
            height
        };
        const layoutDescriptor = {
            activityBarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN),
            sideBarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN),
            auxiliaryBarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN),
            panelVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN),
            statusbarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN),
            sideBarPosition: positionToString(this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON)),
            panelPosition: positionToString(this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION)),
        };
        this.telemetryService.publicLog2('startupLayout', layoutDescriptor);
        return result;
    }
    dispose() {
        super.dispose();
        this.disposed = true;
    }
}
function getZenModeConfiguration(configurationService) {
    return configurationService.getValue(WorkbenchLayoutSettings.ZEN_MODE_CONFIG);
}
class WorkbenchLayoutStateKey {
    constructor(name, scope, target, defaultValue) {
        this.name = name;
        this.scope = scope;
        this.target = target;
        this.defaultValue = defaultValue;
    }
}
class RuntimeStateKey extends WorkbenchLayoutStateKey {
    constructor(name, scope, target, defaultValue, zenModeIgnore) {
        super(name, scope, target, defaultValue);
        this.zenModeIgnore = zenModeIgnore;
        this.runtime = true;
    }
}
class InitializationStateKey extends WorkbenchLayoutStateKey {
    constructor() {
        super(...arguments);
        this.runtime = false;
    }
}
const LayoutStateKeys = {
    // Editor
    MAIN_EDITOR_CENTERED: new RuntimeStateKey('editor.centered', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false),
    // Zen Mode
    ZEN_MODE_ACTIVE: new RuntimeStateKey('zenMode.active', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false),
    ZEN_MODE_EXIT_INFO: new RuntimeStateKey('zenMode.exitInfo', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, {
        transitionedToCenteredEditorLayout: false,
        transitionedToFullScreen: false,
        handleNotificationsDoNotDisturbMode: false,
        wasVisible: {
            auxiliaryBar: false,
            panel: false,
            sideBar: false,
        },
    }),
    // Part Sizing
    SIDEBAR_SIZE: new InitializationStateKey('sideBar.size', 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */, 200),
    AUXILIARYBAR_SIZE: new InitializationStateKey('auxiliaryBar.size', 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */, 200),
    PANEL_SIZE: new InitializationStateKey('panel.size', 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */, 300),
    PANEL_LAST_NON_MAXIMIZED_HEIGHT: new RuntimeStateKey('panel.lastNonMaximizedHeight', 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */, 300),
    PANEL_LAST_NON_MAXIMIZED_WIDTH: new RuntimeStateKey('panel.lastNonMaximizedWidth', 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */, 300),
    PANEL_WAS_LAST_MAXIMIZED: new RuntimeStateKey('panel.wasLastMaximized', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false),
    // Part Positions
    SIDEBAR_POSITON: new RuntimeStateKey('sideBar.position', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, 0 /* Position.LEFT */),
    PANEL_POSITION: new RuntimeStateKey('panel.position', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, 2 /* Position.BOTTOM */),
    PANEL_ALIGNMENT: new RuntimeStateKey('panel.alignment', 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */, 'center'),
    // Part Visibility
    ACTIVITYBAR_HIDDEN: new RuntimeStateKey('activityBar.hidden', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false, true),
    SIDEBAR_HIDDEN: new RuntimeStateKey('sideBar.hidden', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false),
    EDITOR_HIDDEN: new RuntimeStateKey('editor.hidden', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false),
    PANEL_HIDDEN: new RuntimeStateKey('panel.hidden', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, true),
    AUXILIARYBAR_HIDDEN: new RuntimeStateKey('auxiliaryBar.hidden', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, true),
    STATUSBAR_HIDDEN: new RuntimeStateKey('statusBar.hidden', 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, false, true)
};
var WorkbenchLayoutSettings;
(function (WorkbenchLayoutSettings) {
    WorkbenchLayoutSettings["AUXILIARYBAR_DEFAULT_VISIBILITY"] = "workbench.secondarySideBar.defaultVisibility";
    WorkbenchLayoutSettings["ACTIVITY_BAR_VISIBLE"] = "workbench.activityBar.visible";
    WorkbenchLayoutSettings["PANEL_POSITION"] = "workbench.panel.defaultLocation";
    WorkbenchLayoutSettings["PANEL_OPENS_MAXIMIZED"] = "workbench.panel.opensMaximized";
    WorkbenchLayoutSettings["ZEN_MODE_CONFIG"] = "zenMode";
    WorkbenchLayoutSettings["EDITOR_CENTERED_LAYOUT_AUTO_RESIZE"] = "workbench.editor.centeredLayoutAutoResize";
})(WorkbenchLayoutSettings || (WorkbenchLayoutSettings = {}));
var LegacyWorkbenchLayoutSettings;
(function (LegacyWorkbenchLayoutSettings) {
    LegacyWorkbenchLayoutSettings["STATUSBAR_VISIBLE"] = "workbench.statusBar.visible";
    LegacyWorkbenchLayoutSettings["SIDEBAR_POSITION"] = "workbench.sideBar.location";
})(LegacyWorkbenchLayoutSettings || (LegacyWorkbenchLayoutSettings = {}));
class LayoutStateModel extends Disposable {
    static { this.STORAGE_PREFIX = 'workbench.'; }
    constructor(storageService, configurationService, contextService) {
        super();
        this.storageService = storageService;
        this.configurationService = configurationService;
        this.contextService = contextService;
        this._onDidChangeState = this._register(new Emitter());
        this.onDidChangeState = this._onDidChangeState.event;
        this.stateCache = new Map();
        this._register(this.configurationService.onDidChangeConfiguration(configurationChange => this.updateStateFromLegacySettings(configurationChange)));
    }
    updateStateFromLegacySettings(configurationChangeEvent) {
        if (configurationChangeEvent.affectsConfiguration("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */)) {
            this.setRuntimeValueAndFire(LayoutStateKeys.ACTIVITYBAR_HIDDEN, this.isActivityBarHidden());
        }
        if (configurationChangeEvent.affectsConfiguration(LegacyWorkbenchLayoutSettings.STATUSBAR_VISIBLE)) {
            this.setRuntimeValueAndFire(LayoutStateKeys.STATUSBAR_HIDDEN, !this.configurationService.getValue(LegacyWorkbenchLayoutSettings.STATUSBAR_VISIBLE));
        }
        if (configurationChangeEvent.affectsConfiguration(LegacyWorkbenchLayoutSettings.SIDEBAR_POSITION)) {
            this.setRuntimeValueAndFire(LayoutStateKeys.SIDEBAR_POSITON, positionFromString(this.configurationService.getValue(LegacyWorkbenchLayoutSettings.SIDEBAR_POSITION) ?? 'left'));
        }
    }
    updateLegacySettingsFromState(key, value) {
        const isZenMode = this.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
        if (key.zenModeIgnore && isZenMode) {
            return;
        }
        if (key === LayoutStateKeys.ACTIVITYBAR_HIDDEN) {
            this.configurationService.updateValue("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */, value ? "hidden" /* ActivityBarPosition.HIDDEN */ : undefined);
        }
        else if (key === LayoutStateKeys.STATUSBAR_HIDDEN) {
            this.configurationService.updateValue(LegacyWorkbenchLayoutSettings.STATUSBAR_VISIBLE, !value);
        }
        else if (key === LayoutStateKeys.SIDEBAR_POSITON) {
            this.configurationService.updateValue(LegacyWorkbenchLayoutSettings.SIDEBAR_POSITION, positionToString(value));
        }
    }
    load(mainContainerDimension) {
        let key;
        // Load stored values for all keys
        for (key in LayoutStateKeys) {
            const stateKey = LayoutStateKeys[key];
            const value = this.loadKeyFromStorage(stateKey);
            if (value !== undefined) {
                this.stateCache.set(stateKey.name, value);
            }
        }
        // Apply legacy settings
        this.stateCache.set(LayoutStateKeys.ACTIVITYBAR_HIDDEN.name, this.isActivityBarHidden());
        this.stateCache.set(LayoutStateKeys.STATUSBAR_HIDDEN.name, !this.configurationService.getValue(LegacyWorkbenchLayoutSettings.STATUSBAR_VISIBLE));
        this.stateCache.set(LayoutStateKeys.SIDEBAR_POSITON.name, positionFromString(this.configurationService.getValue(LegacyWorkbenchLayoutSettings.SIDEBAR_POSITION) ?? 'left'));
        // Set dynamic defaults: part sizing and side bar visibility
        const workbenchState = this.contextService.getWorkbenchState();
        LayoutStateKeys.SIDEBAR_SIZE.defaultValue = Math.min(300, mainContainerDimension.width / 4);
        LayoutStateKeys.SIDEBAR_HIDDEN.defaultValue = workbenchState === 1 /* WorkbenchState.EMPTY */;
        LayoutStateKeys.AUXILIARYBAR_SIZE.defaultValue = Math.min(300, mainContainerDimension.width / 4);
        LayoutStateKeys.AUXILIARYBAR_HIDDEN.defaultValue = (() => {
            switch (this.configurationService.getValue(WorkbenchLayoutSettings.AUXILIARYBAR_DEFAULT_VISIBILITY)) {
                case 'visible':
                    return false;
                case 'visibleInWorkspace':
                    return workbenchState === 1 /* WorkbenchState.EMPTY */;
                default:
                    return true;
            }
        })();
        LayoutStateKeys.PANEL_SIZE.defaultValue = (this.stateCache.get(LayoutStateKeys.PANEL_POSITION.name) ?? isHorizontal(LayoutStateKeys.PANEL_POSITION.defaultValue)) ? mainContainerDimension.height / 3 : mainContainerDimension.width / 4;
        LayoutStateKeys.PANEL_POSITION.defaultValue = positionFromString(this.configurationService.getValue(WorkbenchLayoutSettings.PANEL_POSITION) ?? 'bottom');
        // Apply all defaults
        for (key in LayoutStateKeys) {
            const stateKey = LayoutStateKeys[key];
            if (this.stateCache.get(stateKey.name) === undefined) {
                this.stateCache.set(stateKey.name, stateKey.defaultValue);
            }
        }
        // Register for runtime key changes
        this._register(this.storageService.onDidChangeValue(0 /* StorageScope.PROFILE */, undefined, this._store)(storageChangeEvent => {
            let key;
            for (key in LayoutStateKeys) {
                const stateKey = LayoutStateKeys[key];
                if (stateKey instanceof RuntimeStateKey && stateKey.scope === 0 /* StorageScope.PROFILE */ && stateKey.target === 0 /* StorageTarget.USER */) {
                    if (`${LayoutStateModel.STORAGE_PREFIX}${stateKey.name}` === storageChangeEvent.key) {
                        const value = this.loadKeyFromStorage(stateKey) ?? stateKey.defaultValue;
                        if (this.stateCache.get(stateKey.name) !== value) {
                            this.stateCache.set(stateKey.name, value);
                            this._onDidChangeState.fire({ key: stateKey, value });
                        }
                    }
                }
            }
        }));
    }
    save(workspace, global) {
        let key;
        const isZenMode = this.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
        for (key in LayoutStateKeys) {
            const stateKey = LayoutStateKeys[key];
            if ((workspace && stateKey.scope === 1 /* StorageScope.WORKSPACE */) ||
                (global && stateKey.scope === 0 /* StorageScope.PROFILE */)) {
                if (isZenMode && stateKey instanceof RuntimeStateKey && stateKey.zenModeIgnore) {
                    continue; // Don't write out specific keys while in zen mode
                }
                this.saveKeyToStorage(stateKey);
            }
        }
    }
    getInitializationValue(key) {
        return this.stateCache.get(key.name);
    }
    setInitializationValue(key, value) {
        this.stateCache.set(key.name, value);
    }
    getRuntimeValue(key, fallbackToSetting) {
        if (fallbackToSetting) {
            switch (key) {
                case LayoutStateKeys.ACTIVITYBAR_HIDDEN:
                    this.stateCache.set(key.name, this.isActivityBarHidden());
                    break;
                case LayoutStateKeys.STATUSBAR_HIDDEN:
                    this.stateCache.set(key.name, !this.configurationService.getValue(LegacyWorkbenchLayoutSettings.STATUSBAR_VISIBLE));
                    break;
                case LayoutStateKeys.SIDEBAR_POSITON:
                    this.stateCache.set(key.name, this.configurationService.getValue(LegacyWorkbenchLayoutSettings.SIDEBAR_POSITION) ?? 'left');
                    break;
            }
        }
        return this.stateCache.get(key.name);
    }
    setRuntimeValue(key, value) {
        this.stateCache.set(key.name, value);
        const isZenMode = this.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
        if (key.scope === 0 /* StorageScope.PROFILE */) {
            if (!isZenMode || !key.zenModeIgnore) {
                this.saveKeyToStorage(key);
                this.updateLegacySettingsFromState(key, value);
            }
        }
    }
    isActivityBarHidden() {
        const oldValue = this.configurationService.getValue(WorkbenchLayoutSettings.ACTIVITY_BAR_VISIBLE);
        if (oldValue !== undefined) {
            return !oldValue;
        }
        return this.configurationService.getValue("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */) !== "default" /* ActivityBarPosition.DEFAULT */;
    }
    setRuntimeValueAndFire(key, value) {
        const previousValue = this.stateCache.get(key.name);
        if (previousValue === value) {
            return;
        }
        this.setRuntimeValue(key, value);
        this._onDidChangeState.fire({ key, value });
    }
    saveKeyToStorage(key) {
        const value = this.stateCache.get(key.name);
        this.storageService.store(`${LayoutStateModel.STORAGE_PREFIX}${key.name}`, typeof value === 'object' ? JSON.stringify(value) : value, key.scope, key.target);
    }
    loadKeyFromStorage(key) {
        let value = this.storageService.get(`${LayoutStateModel.STORAGE_PREFIX}${key.name}`, key.scope);
        if (value !== undefined) {
            switch (typeof key.defaultValue) {
                case 'boolean':
                    value = value === 'true';
                    break;
                case 'number':
                    value = parseInt(value);
                    break;
                case 'object':
                    value = JSON.parse(value);
                    break;
            }
        }
        return value;
    }
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9sYXlvdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3ZILE9BQU8sRUFBUyxPQUFPLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsU0FBUyxFQUFFLHFCQUFxQixFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFjLHFCQUFxQixFQUFFLHNCQUFzQixFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM5UixPQUFPLEVBQUUscUJBQXFCLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2xHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDOUYsT0FBTyxFQUE0QyxxQkFBcUIsRUFBdUIsY0FBYyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDM0ksT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN2RCxPQUFPLEVBQXdFLGtCQUFrQixFQUFFLGdCQUFnQixFQUFFLDZCQUE2QixFQUF3Six3QkFBd0IsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6WixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsd0JBQXdCLEVBQWtCLE1BQU0sOENBQThDLENBQUM7QUFDOUgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSwwQ0FBMEMsQ0FBQztBQUN4RyxPQUFPLEVBQTZCLHFCQUFxQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDeEgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTFFLE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxvQkFBb0IsRUFBUyxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBNkMsd0JBQXdCLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxFQUFnQixNQUFNLHdDQUF3QyxDQUFDO0FBQ2xQLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM1RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDNUUsT0FBTyxFQUFvRCxvQkFBb0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzFJLE9BQU8sRUFBRSxnQkFBZ0IsRUFBK0csTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDM0wsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNqQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMvRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLHNCQUFzQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFbEYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxzQkFBc0IsRUFBeUIsTUFBTSxvQkFBb0IsQ0FBQztBQUNuRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM3RSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMvRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNqRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN4RyxPQUFPLEVBQWMsVUFBVSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUE4Q3RFLElBQUssYUFTSjtBQVRELFdBQUssYUFBYTtJQUNqQiw2Q0FBNEIsQ0FBQTtJQUM1Qiw2REFBNEMsQ0FBQTtJQUM1Qyx5Q0FBd0IsQ0FBQTtJQUN4Qix1REFBc0MsQ0FBQTtJQUN0QyxpREFBZ0MsQ0FBQTtJQUNoQywwQ0FBeUIsQ0FBQTtJQUN6Qix3Q0FBdUIsQ0FBQTtJQUN2Qix5Q0FBd0IsQ0FBQTtBQUN6QixDQUFDLEVBVEksYUFBYSxLQUFiLGFBQWEsUUFTakI7QUFjRCxNQUFNLHVCQUF1QixHQUFHO0lBQy9CLDRCQUE0QjtJQUM1QixxQ0FBcUM7SUFDckMsc0NBQXNDO0NBQ3RDLENBQUM7QUFFRixNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRzs7O0lBR2pDLEdBQUcsdUJBQXVCOzs7Ozs7Q0FNMUIsQ0FBQztBQUVGLE1BQU0seUJBQXlCLEdBQUcsSUFBSSxTQUFTLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRXZHLE1BQU0sT0FBZ0IsTUFBTyxTQUFRLFVBQVU7SUErQzlDLElBQUksZUFBZSxLQUFLLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEYsSUFBSSxVQUFVO1FBQ2IsTUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztRQUNyQyxLQUFLLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ3ZDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7UUFFRCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRU8sd0JBQXdCLENBQUMsY0FBd0I7UUFDeEQsSUFBSSxjQUFjLEtBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN6RCxjQUFjO1lBQ2QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQzNCLENBQUM7YUFBTSxDQUFDO1lBQ1AsbUJBQW1CO1lBQ25CLE9BQU8sY0FBYyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBZ0IsQ0FBQztRQUN6RixDQUFDO0lBQ0YsQ0FBQztJQUdELHlCQUF5QixDQUFDLE1BQWtCO1FBQzNDLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUdELElBQUksc0JBQXNCLEtBQWlCLE9BQU8sSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQztJQUVqRixJQUFJLHdCQUF3QjtRQUMzQixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVPLHFCQUFxQixDQUFDLFNBQXNCO1FBQ25ELElBQUksU0FBUyxLQUFLLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN0QyxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLGNBQWM7UUFDbkQsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFFLG1CQUFtQjtRQUN0RCxDQUFDO0lBQ0YsQ0FBQztJQUVELElBQUksbUJBQW1CO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRCxJQUFJLHFCQUFxQjtRQUN4QixPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVPLHNCQUFzQixDQUFDLFlBQW9CO1FBQ2xELElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztRQUNaLElBQUksWUFBWSxHQUFHLENBQUMsQ0FBQztRQUVyQixJQUFJLElBQUksQ0FBQyxTQUFTLGtEQUFtQixFQUFFLENBQUM7WUFDdkMsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLGtEQUFtQixDQUFDLGFBQWEsQ0FBQztZQUNwRCxZQUFZLEdBQUcsR0FBRyxDQUFDO1FBQ3BCLENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyx1REFBc0IsWUFBWSxDQUFDLENBQUM7UUFDMUUsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNyQixHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sc0RBQXFCLENBQUMsYUFBYSxDQUFDO1lBQ3ZELFlBQVksR0FBRyxHQUFHLENBQUM7UUFDcEIsQ0FBQztRQUVELE1BQU0sc0JBQXNCLEdBQUcsZUFBZSxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLDREQUF3QyxLQUFLLEtBQUssQ0FBQztRQUN2SSxJQUFJLHNCQUFzQixFQUFFLENBQUM7WUFDNUIsdURBQXVEO1lBQ3ZELDhDQUE4QztZQUM5QyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxPQUFPLEVBQUUsR0FBRyxFQUFFLFlBQVksRUFBRSxDQUFDO0lBQzlCLENBQUM7SUEyQ0QsWUFDb0IsTUFBbUI7UUFFdEMsS0FBSyxFQUFFLENBQUM7UUFGVyxXQUFNLEdBQU4sTUFBTSxDQUFhO1FBOUp2QyxnQkFBZ0I7UUFFQyx3QkFBbUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFXLENBQUMsQ0FBQztRQUNyRSx1QkFBa0IsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDO1FBRTVDLHlDQUFvQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVcsQ0FBQyxDQUFDO1FBQ3RGLHdDQUFtQyxHQUFHLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxLQUFLLENBQUM7UUFFOUUsK0JBQTBCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBa0IsQ0FBQyxDQUFDO1FBQ25GLDhCQUF5QixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUM7UUFFMUQsZ0NBQTJCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBNEMsQ0FBQyxDQUFDO1FBQzlHLCtCQUEwQixHQUFHLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLENBQUM7UUFFNUQsOEJBQXlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBVSxDQUFDLENBQUM7UUFDMUUsNkJBQXdCLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQztRQUV4RCwrQkFBMEIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUN6RSw4QkFBeUIsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDO1FBRTFELHdDQUFtQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVcsQ0FBQyxDQUFDO1FBQ3JGLHVDQUFrQyxHQUFHLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxLQUFLLENBQUM7UUFFNUUsOEJBQXlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBYyxDQUFDLENBQUM7UUFDOUUsNkJBQXdCLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQztRQUV4RCxnQ0FBMkIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFjLENBQUMsQ0FBQztRQUNoRiwrQkFBMEIsR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsS0FBSyxDQUFDO1FBRTVELDBCQUFxQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQXFELENBQUMsQ0FBQztRQUNqSCx5QkFBb0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDO1FBRWhELHVCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQTRELENBQUMsQ0FBQztRQUNySCxzQkFBaUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDO1FBRTFDLGdDQUEyQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQzFFLCtCQUEwQixHQUFHLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLENBQUM7UUFFN0UsWUFBWTtRQUVaLG9CQUFvQjtRQUVYLGtCQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQXFCdEMsMEJBQXFCLEdBQUcsSUFBSSxHQUFHLEVBQXlDLENBQUM7UUFxRDFGLFlBQVk7UUFFSyxVQUFLLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7UUFFekMsZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFtQ3BCLGFBQVEsR0FBRyxLQUFLLENBQUM7UUFzaUJqQiwwQkFBcUIsR0FBWSxLQUFLLENBQUM7UUFnQzlCLHFCQUFnQixHQUFHLElBQUksZUFBZSxFQUFRLENBQUM7UUFDN0MsY0FBUyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFFdEMsd0JBQW1CLEdBQUcsSUFBSSxlQUFlLEVBQVEsQ0FBQztRQUMxRCxpQkFBWSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFDM0MsYUFBUSxHQUFHLEtBQUssQ0FBQztJQXJrQnpCLENBQUM7SUFFUyxVQUFVLENBQUMsUUFBMEI7UUFFOUMsV0FBVztRQUNYLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFDNUUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsV0FBVyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDOUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDN0QsSUFBSSxDQUFDLGNBQWMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyx3QkFBd0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLHNCQUFzQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUVwRSxRQUFRO1FBQ1IsSUFBSSxDQUFDLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDN0QsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVHLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUNsRSxJQUFJLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUM5RCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3hELFFBQVEsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFN0IsWUFBWTtRQUNaLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBRS9CLFFBQVE7UUFDUixJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVPLHVCQUF1QjtRQUU5QiwyQkFBMkI7UUFDM0IsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLEVBQUU7WUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLG1EQUFvQixVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUM3QixDQUFDO1FBQ0YsQ0FBQyxDQUFDO1FBRUYsa0VBQWtFO1FBQ2xFLHlDQUF5QztRQUN6QyxJQUFJLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFFOUMsNkRBQTZEO1lBQzdELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHlCQUF5QixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztZQUN6RixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1lBRXhGLHdGQUF3RjtZQUN4RixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUssQ0FBQyxDQUFDLENBQUM7UUFFSCx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUN2RSxJQUFJO2dCQUNILEdBQUcsa0JBQWtCO2dCQUNyQiw2QkFBNkIsQ0FBQyxnQkFBZ0I7Z0JBQzlDLDZCQUE2QixDQUFDLGlCQUFpQjthQUMvQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBRXBELHdEQUF3RDtnQkFDeEQsTUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLHNDQUFzQyxDQUFDLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBVSxzQ0FBc0MsQ0FBQyxDQUFDO2dCQUMzSyxNQUFNLHdCQUF3QixHQUFHLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxxQ0FBcUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQVUscUNBQXFDLENBQUMsQ0FBQztnQkFFckwsaUVBQWlFO2dCQUNqRSxzRkFBc0Y7Z0JBQ3RGLGlLQUFpSztnQkFFakssSUFBSSxZQUFZLElBQUksd0JBQXdCLEVBQUUsQ0FBQztvQkFDOUMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSw0REFBd0MsS0FBSyxLQUFLLEVBQUUsQ0FBQzt3QkFDMUYsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFdBQVcsNkRBQWdDLElBQUksQ0FBQyxDQUFDO3dCQUMzRSxPQUFPLENBQUMsbURBQW1EO29CQUM1RCxDQUFDO2dCQUNGLENBQUM7Z0JBRUQsd0VBQXdFO2dCQUN4RSxNQUFNLDRCQUE0QixHQUFHLENBQUMsQ0FBQyxvQkFBb0IsdUZBQXdDLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsdUZBQStELG9EQUFtQyxDQUFDO2dCQUM1TyxNQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FBQyxvQkFBb0IsNERBQStCLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsNERBQXdDLENBQUM7Z0JBQ2pLLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQix1RUFBK0IsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSx1RUFBd0MsQ0FBQztnQkFDbEssTUFBTSw2QkFBNkIsR0FBRyxDQUFDLENBQUMsb0JBQW9CLDZFQUFzQyxJQUFJLGdGQUFxRCxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSw2RUFBMkQsQ0FBQyxDQUFDO2dCQUVwUSxJQUFJLDZCQUE2QixJQUFJLDRCQUE0QixJQUFJLG9CQUFvQixJQUFJLHFCQUFxQixFQUFFLENBQUM7b0JBQ3BILElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEscUZBQXVFLGlEQUFtQyxFQUFFLENBQUM7d0JBQ2xKLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLGlJQUE0RSxDQUFDO3dCQUNsSCxPQUFPLENBQUMsbURBQW1EO29CQUM1RCxDQUFDO2dCQUNGLENBQUM7Z0JBRUQsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7WUFDcEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixxQkFBcUI7UUFDckIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdEYsZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pLLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVyTCwwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVwSCw2QkFBNkI7UUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLFNBQVMsSUFBSSxPQUFPLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUMzRyxJQUFJLGlCQUFpQixFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4RyxDQUFDO1FBRUQsZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFMUYsZ0NBQWdDO1FBQ2hDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLHVCQUF1QixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU3RixjQUFjO1FBQ2QsSUFBSSxLQUFLLElBQUksT0FBUSxTQUFpQixDQUFDLHFCQUFxQixLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzNFLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUUsU0FBaUIsQ0FBQyxxQkFBcUIsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2hJLENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO1lBQy9GLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO1lBQzlDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3BGLFdBQVcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWpGLE1BQU0sZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7WUFDaEUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7WUFFN0YsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsT0FBZ0I7UUFDeEMsSUFBSSxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1lBRTdDLE1BQU0saUJBQWlCLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFFMUUsMEdBQTBHO1lBQzFHLElBQUksS0FBSyxJQUFJLGlCQUFpQixLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUM3QyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsd0JBQXdCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMvSixDQUFDO1lBRUQsb0ZBQW9GO2lCQUMvRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9CQUFvQixJQUFJLENBQUMsaUJBQWlCLEtBQUssUUFBUSxJQUFJLGlCQUFpQixLQUFLLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pILElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQy9KLENBQUM7WUFFRCwyQ0FBMkM7WUFDM0MsMkNBQTJDO1lBQzNDLG9CQUFvQjtZQUNwQixJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNqRixDQUFDO0lBQ0YsQ0FBQztJQUVPLHdCQUF3QixDQUFDLFNBQXNCLEVBQUUsU0FBcUI7UUFDN0UsSUFBSSxTQUFTLEtBQUssSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3RDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUVELElBQUksZ0JBQWdCLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFFRCxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFFBQWdCO1FBQzNDLElBQUksUUFBUSxLQUFLLFVBQVUsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUM1QyxPQUFPLENBQUMsNkJBQTZCO1FBQ3RDLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsR0FBRyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbkUscUJBQXFCO1FBQ3JCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVELENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUU5RCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUM1RixJQUFJLGVBQWUsQ0FBQyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQztnQkFDeEUsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3RCLENBQUM7UUFDRixDQUFDO1FBRUQsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDO1FBRTFFLDZEQUE2RDtRQUM3RCx1REFBdUQ7UUFDdkQsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO1lBRWxELG9CQUFvQjtZQUNwQixJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsd0JBQXdCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUU5SixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEMsQ0FBQztJQUNGLENBQUM7SUFFTyxxQkFBcUI7UUFDNUIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUN0RCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGlCQUFpQixLQUFLLGlCQUFpQixFQUFFLENBQUM7WUFDaEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEdBQUcsaUJBQWlCLENBQUM7WUFFekQsZ0NBQWdDO1lBQ2hDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBRTNCLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN6QyxDQUFDO0lBQ0YsQ0FBQztJQUVPLG9CQUFvQixDQUFDLFFBQWlCO1FBQzdDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7WUFDdkMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDNUIsQ0FBQztJQUNGLENBQUM7SUFFTyxvQkFBb0I7UUFDM0IsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUU3QyxPQUFPLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxjQUFjLENBQUM7SUFDbEQsQ0FBQztJQUVPLDJCQUEyQixDQUFDLFVBQW9CO1FBRXZELGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQztRQUV0QyxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUUzQyxrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDakssQ0FBQztJQUVPLGtCQUFrQixDQUFDLFFBQWtCO1FBQzVDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLDREQUF3QixDQUFDO1FBQ3pELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLG9EQUFvQixDQUFDO1FBQ2pELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLDhEQUF5QixDQUFDO1FBQzNELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxRQUFRLDBCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQ3pFLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxRQUFRLDJCQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQzFFLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ2hELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRTlDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFM0UsYUFBYTtRQUNiLE1BQU0sb0JBQW9CLEdBQUcsb0JBQW9CLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDOUUsTUFBTSxnQkFBZ0IsR0FBRyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUN0RSxNQUFNLHFCQUFxQixHQUFHLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ2hGLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN4RCxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDcEQsb0JBQW9CLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3JELGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUVqRCxvQ0FBb0M7UUFDcEMscUJBQXFCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3pELHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUV0RCxnQkFBZ0I7UUFDaEIsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQzNCLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUN2QixZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFNUIsa0NBQWtDO1FBQ2xDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsY0FBYyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxVQUFVLEdBQUcsS0FBSztRQUM3QyxJQUNDLEtBQUs7WUFDTCxTQUFTLElBQWUsMkRBQTJEO1lBQ25GLENBQ0MsQ0FBQyxTQUFTLElBQUksT0FBTyxDQUFDO2dCQUN0Qix3QkFBd0IsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyw0RUFBNEU7YUFDaEk7WUFDRCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFDM0MsQ0FBQztZQUNGLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUVoRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDMUQsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBRTlELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFFM0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDekMsTUFBTSxlQUFlLEdBQUcsU0FBUyxLQUFLLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDekQsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsZUFBZSxLQUFLLFNBQVMsQ0FBQztZQUU3RCxJQUFJLFlBQVksR0FBRyxLQUFLLENBQUM7WUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9CQUFvQixJQUFJLENBQUMsWUFBWSxJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xGLFlBQVksR0FBRyxJQUFJLENBQUM7Z0JBRXBCLCtEQUErRDtnQkFDL0QsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGNBQWMsSUFBSSxZQUFZLENBQUM7Z0JBQ3JILFNBQVMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLHVCQUF1QixFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsSUFBSSxhQUFhLENBQUMsQ0FBQztZQUNoRyxDQUFDO1lBRUQsSUFBSSxlQUFlLEVBQUUsQ0FBQztnQkFDckIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDO1lBQ3BELENBQUM7WUFFRCxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxJQUFJLENBQUMsVUFBVSxJQUFJLHVCQUF1QixLQUFLLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7WUFDM0UsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2YsQ0FBQztJQUNGLENBQUM7SUFFTyxlQUFlLENBQUMsZ0JBQW1DLEVBQUUsV0FBeUI7UUFDckYsSUFBSSxDQUFDLHVCQUF1QixHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLHlCQUF5QixDQUFDLENBQUMsQ0FBQyx5R0FBeUc7UUFFL0wsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM1RyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUVuRCx3REFBd0Q7UUFDeEQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDckksSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3hELElBQUksTUFBTSxDQUFDLEdBQUcsS0FBSyxlQUFlLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFDdkQsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxLQUFnQixDQUFDLENBQUM7WUFDcEQsQ0FBQztZQUVELElBQUksTUFBTSxDQUFDLEdBQUcsS0FBSyxlQUFlLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDckQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxLQUFnQixDQUFDLENBQUM7WUFDbEQsQ0FBQztZQUVELElBQUksTUFBTSxDQUFDLEdBQUcsS0FBSyxlQUFlLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3BELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsS0FBaUIsQ0FBQyxDQUFDO1lBQ25ELENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxHQUFHLEtBQUssZUFBZSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUNuRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEtBQWlCLENBQUMsQ0FBQztZQUNqRCxDQUFDO1lBRUQsSUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLGVBQWUsQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDcEQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxLQUF1QixDQUFDLENBQUM7WUFDeEQsQ0FBQztZQUVELElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSiw4QkFBOEI7UUFDOUIsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUMxRCxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBQ0QsTUFBTSxrQkFBa0IsR0FBK0I7WUFDdEQsTUFBTSxFQUFFO2dCQUNQLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNO2FBQ3BDO1lBQ0QsTUFBTSxFQUFFO2dCQUNQLGNBQWMsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxtQkFBbUIsQ0FBQztnQkFDbkYsYUFBYSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsbUJBQW1CLENBQUM7YUFDMUU7WUFDRCxLQUFLLEVBQUU7Z0JBQ04sUUFBUSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQztnQkFDbEYsa0JBQWtCLEVBQUUsRUFBRTthQUN0QjtTQUNELENBQUM7UUFFRix1QkFBdUI7UUFDdkIsTUFBTSxrQkFBa0IsR0FBd0I7WUFDL0MsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFO1lBQzlDLG9CQUFvQixFQUFFLFlBQVksQ0FBQyxVQUFVLENBQUM7WUFDOUMsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUTtZQUNuQyxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQVU7WUFDNUIsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixPQUFPLEVBQUU7Z0JBQ1IsT0FBTyxFQUFFLEtBQUs7YUFDZDtZQUNELE9BQU8sRUFBRTtnQkFDUixxQkFBcUIsRUFBRSxJQUFJLGFBQWEsRUFBRTthQUMxQztTQUNELENBQUM7UUFFRixJQUFJLENBQUMsS0FBSyxHQUFHO1lBQ1osY0FBYyxFQUFFLGtCQUFrQjtZQUNsQyxPQUFPLEVBQUUsa0JBQWtCO1NBQzNCLENBQUM7UUFFRixvQ0FBb0M7UUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxvREFBb0IsRUFBRSxDQUFDO1lBRXhDLGlGQUFpRjtZQUNqRixJQUFJLHNCQUEwQyxDQUFDO1lBQy9DLElBQ0MsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTztnQkFDaEMsZ0JBQWdCLENBQUMsV0FBVyx1Q0FBK0I7Z0JBQzNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyx5QkFBeUIsRUFDbkcsQ0FBQztnQkFDRixzQkFBc0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsd0JBQXdCLGtDQUEwQixJQUFJLENBQUMscUJBQXFCLENBQUMsdUJBQXVCLHVDQUErQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZNLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxzQkFBc0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsdUJBQXVCLHVDQUErQixFQUFFLEVBQUUsQ0FBQztZQUNoSCxDQUFDO1lBRUQsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO2dCQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsT0FBTyxHQUFHLHNCQUFzQixDQUFDO1lBQ3JGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7UUFDRixDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLElBQUksSUFBSSxDQUFDLFNBQVMsZ0RBQWtCLEVBQUUsQ0FBQztZQUN0QyxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0Isa0NBQTBCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx1QkFBdUIscUNBQTZCLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFdE0sSUFBSSxzQkFBc0IsRUFBRSxDQUFDO2dCQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsS0FBSyxHQUFHLHNCQUFzQixDQUFDO1lBQ25GLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3JFLENBQUM7UUFDRixDQUFDO1FBRUQsNEJBQTRCO1FBQzVCLElBQUksSUFBSSxDQUFDLFNBQVMsOERBQXlCLEVBQUUsQ0FBQztZQUM3QyxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixrQ0FBMEIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHVCQUF1Qiw0Q0FBb0MsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNuTixJQUFJLHNCQUFzQixFQUFFLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEdBQUcsc0JBQXNCLENBQUM7WUFDMUYsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM1RSxDQUFDO1FBQ0YsQ0FBQztRQUVELGdCQUFnQjtRQUNoQixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVPLHFCQUFxQixDQUFDLGtCQUF1RCxFQUFFLGNBQStCO1FBQ3JILE1BQU0sYUFBYSxHQUFHLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUM7UUFDaEUsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLGdDQUF3QixFQUFFLENBQUM7WUFDM0UsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxhQUFhLENBQUM7UUFDaEMsSUFBSSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDbkIsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU8sb0JBQW9CLENBQUMsY0FBd0MsRUFBRSxtQkFBcUQ7UUFFM0gsMkNBQTJDO1FBQzNDLDhDQUE4QztRQUM5Qyw0Q0FBNEM7UUFDNUMsa0RBQWtEO1FBRWxELElBQUksb0JBQW9CLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUN6RCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQVMsdUJBQXVCLENBQUMsS0FBSyxVQUFVLENBQUM7UUFDL0csT0FBTyxDQUFDLENBQUMsbUJBQW1CLElBQUksbUJBQW1CLEtBQUssU0FBUyxDQUFDO0lBQ25FLENBQUM7SUFFUyxrQkFBa0I7UUFDM0IsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO0lBQ3hELENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9CLENBQUMsV0FBeUIsRUFBRSxtQkFBcUQ7UUFDbEgsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1lBRXpCLHdCQUF3QjtZQUN4QixNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsTUFBTSxjQUFjLENBQUMsbUJBQW1CLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNwSCxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3ZNLE9BQU8sQ0FBQzt3QkFDUCxNQUFNLEVBQUU7NEJBQ1AsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7NEJBQzlDLE1BQU0sRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFOzRCQUM5QyxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTs0QkFDNUMsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7NEJBQzlDLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7eUJBQ3pCO3FCQUNELENBQUMsQ0FBQztZQUNKLENBQUM7WUFFRCx1QkFBdUI7WUFDdkIsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLE1BQU0sY0FBYyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDbEgsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUM5QixPQUFPLENBQUM7d0JBQ1AsTUFBTSxFQUFFOzRCQUNQLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFOzRCQUMvQyxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTs0QkFDL0MsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTt5QkFDekI7cUJBQ0QsQ0FBQyxDQUFDO1lBQ0osQ0FBQztZQUVELDJCQUEyQjtZQUMzQixNQUFNLG1CQUFtQixHQUFvQixFQUFFLENBQUM7WUFDaEQsTUFBTSwyQkFBMkIsR0FBRyxNQUFNLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ2hJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRywyQkFBMkIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDN0QsTUFBTSwwQkFBMEIsR0FBRywyQkFBMkIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbEUsSUFBSSwwQkFBMEIsRUFBRSxDQUFDO29CQUNoQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUM7d0JBQ3hCLE1BQU0sRUFBRSwwQkFBMEI7d0JBQ2xDLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0Q0FBNEM7cUJBQ2hILENBQUMsQ0FBQztnQkFDSixDQUFDO1lBQ0YsQ0FBQztZQUVELE9BQU8sbUJBQW1CLENBQUM7UUFDNUIsQ0FBQztRQUVELDREQUE0RDthQUN2RCxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLEVBQUUsaUNBQXlCLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLGlCQUFpQixFQUFFLENBQUM7WUFDbEssSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFDaEQsT0FBTyxFQUFFLENBQUMsQ0FBQywwRkFBMEY7WUFDdEcsQ0FBQztZQUVELE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLHdCQUF3QixDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3BFLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLE9BQU8sRUFBRSxDQUFDLENBQUMsb0VBQW9FO1lBQ2hGLENBQUM7WUFFRCxPQUFPLENBQUM7b0JBQ1AsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDLDJCQUEyQjtpQkFDM0QsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUVELE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUdELElBQUksb0JBQW9CLEtBQUssT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0lBRXpELHNCQUFzQjtRQUU3Qix1RUFBdUU7UUFDdkUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUM7UUFDckUsSUFBSSxDQUFDLGFBQWEsRUFBRSxPQUFPLEVBQUUsTUFBTSxJQUFJLGFBQWEsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxnQ0FBd0IsQ0FBQyxFQUFFLENBQUM7WUFDdEosSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQztZQUVsQyxPQUFPO2dCQUNOLE1BQU0sRUFBRSxhQUFhLENBQUMsTUFBTSxFQUFFLE9BQU87Z0JBQ3JDLG1CQUFtQixFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUN6RCxPQUFPO3dCQUNOLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVTt3QkFDN0IsT0FBTyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQzt3QkFDL0IsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQjt3QkFDekMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO3FCQUN2QixDQUFDO2dCQUNILENBQUMsQ0FBQzthQUNGLENBQUM7UUFDSCxDQUFDO1FBRUQsb0VBQW9FO1FBQ3BFLE1BQU0sRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQ25GLElBQUksbUJBQW1CLElBQUksV0FBVyxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ3hELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLENBQUM7UUFDM0QsQ0FBQztRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFTRCxVQUFVO1FBQ1QsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3RCLENBQUM7SUFFUyxZQUFZO1FBRXJCLG1EQUFtRDtRQUNuRCxxREFBcUQ7UUFDckQsOENBQThDO1FBQzlDLE1BQU0sbUJBQW1CLEdBQXVCLEVBQUUsQ0FBQztRQUNuRCxNQUFNLHNCQUFzQixHQUF1QixFQUFFLENBQUM7UUFFdEQsa0JBQWtCO1FBQ2xCLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQ3BDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBRWhDLHdDQUF3QztZQUN4QyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUM7WUFDeEMsSUFBSSxDQUFDLHVDQUF1QyxDQUFDLENBQUM7WUFFOUMsNkJBQTZCO1lBQzdCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDO2dCQUMvQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDeEYsQ0FBQztZQUVELDZDQUE2QztZQUM3Qyw0Q0FBNEM7WUFDNUMsOENBQThDO1lBQzlDLDRDQUE0QztZQUM1Qyw0Q0FBNEM7WUFDNUMsK0NBQStDO1lBQy9DLDRDQUE0QztZQUM1QyxnQkFBZ0I7WUFFaEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDO1lBQ3JFLElBQUksQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1lBRWxELElBQUksa0JBQWtCLEdBQWlDLFNBQVMsQ0FBQztZQUNqRSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFFcEIsdURBQXVEO2dCQUN2RCx5REFBeUQ7Z0JBQ3pELDRDQUE0QztnQkFFNUMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLFNBQVMscUNBQTZCLENBQUM7Z0JBQzFHLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQTZDLENBQUM7Z0JBRS9FLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFLENBQUM7b0JBQzlCLE1BQU0sS0FBSyxHQUFHLHlCQUF5QixDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLDhCQUE4QjtvQkFFckcsSUFBSSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDckQsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO3dCQUNyQixjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7d0JBQ2hELGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLGNBQWMsQ0FBQyxDQUFDO29CQUNqRCxDQUFDO29CQUVELGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNuQyxDQUFDO2dCQUVELGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtvQkFDL0YsSUFBSSxDQUFDO3dCQUNKLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDN0YsQ0FBQztvQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO3dCQUNoQixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDOUIsQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztZQUVELDhEQUE4RDtZQUM5RCxxQ0FBcUM7WUFDckMsc0JBQXNCLENBQUMsSUFBSSxDQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDO2dCQUNYLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLDBDQUEwQyxDQUFDLENBQUM7YUFDcEcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7Z0JBQ2YseURBQXlEO2dCQUN6RCwwREFBMEQ7Z0JBQzFELDZDQUE2QztnQkFDN0MsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7WUFDaEMsQ0FBQyxDQUFDLENBQ0YsQ0FBQztRQUNILENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVOLGlFQUFpRTtRQUNqRSxNQUFNLDBCQUEwQixHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDOUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUFDO2dCQUN0RCxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQztnQkFFbEMsTUFBTSxpQkFBaUIsR0FBb0MsRUFBRSxDQUFDO2dCQUU5RCxNQUFNLFdBQVcsR0FBRyxDQUFDLElBQW1DLEVBQVcsRUFBRTtvQkFDcEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDekUsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQ3ZCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7d0JBQy9FLElBQUksU0FBUyxFQUFFLENBQUM7NEJBQ2YsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQ0FDL0QsaUJBQWlCLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDOzRCQUN2RSxDQUFDOzRCQUVELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQzs0QkFDbkYsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDOzRCQUM1QyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7NEJBRXpDLE9BQU8sSUFBSSxDQUFDO3dCQUNiLENBQUM7b0JBQ0YsQ0FBQztvQkFFRCxPQUFPLEtBQUssQ0FBQztnQkFDZCxDQUFDLENBQUM7Z0JBRUYsTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUUxSCxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDO2dCQUM1QixPQUFPLENBQUMsRUFBRSxDQUFDO29CQUNWLENBQUMsRUFBRSxDQUFDO29CQUNKLElBQUksV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQ2xDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUMzQixDQUFDO2dCQUNGLENBQUM7Z0JBRUQsaUdBQWlHO2dCQUNqRyxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDekIsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztvQkFFaEUsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQztvQkFDNUIsT0FBTyxDQUFDLEVBQUUsQ0FBQzt3QkFDVixDQUFDLEVBQUUsQ0FBQzt3QkFDSixJQUFJLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDOzRCQUNsQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDM0IsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7Z0JBRUQsNkRBQTZEO2dCQUM3RCxJQUFJLGlCQUFpQix1Q0FBK0IsRUFBRSxDQUFDO29CQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsT0FBTyxHQUFHLGlCQUFpQix1Q0FBK0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xILENBQUM7Z0JBRUQsMkRBQTJEO2dCQUMzRCxJQUFJLGlCQUFpQixxQ0FBNkIsRUFBRSxDQUFDO29CQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsS0FBSyxHQUFHLGlCQUFpQixxQ0FBNkIsQ0FBQyxFQUFFLENBQUM7Z0JBQzlHLENBQUM7Z0JBRUQsbUVBQW1FO2dCQUNuRSxJQUFJLGlCQUFpQiw0Q0FBb0MsRUFBRSxDQUFDO29CQUMzRCxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsWUFBWSxHQUFHLGlCQUFpQiw0Q0FBb0MsQ0FBQyxFQUFFLENBQUM7Z0JBQzVILENBQUM7Z0JBRUQsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7WUFDbEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDTCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUVyRCxrQkFBa0I7UUFDbEIsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFFcEMsa0RBQWtEO1lBQ2xELDBDQUEwQztZQUMxQyxNQUFNLDBCQUEwQixDQUFDO1lBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2pFLE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7WUFFaEMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLHdDQUFnQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFeEgsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDaEMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRU4sZ0JBQWdCO1FBQ2hCLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO1lBRXBDLGdEQUFnRDtZQUNoRCwwQ0FBMEM7WUFDMUMsTUFBTSwwQkFBMEIsQ0FBQztZQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMvRCxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1lBRTlCLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixzQ0FBOEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXBILElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVOLHdCQUF3QjtRQUN4QixtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRTtZQUVwQyxpREFBaUQ7WUFDakQsMENBQTBDO1lBQzFDLE1BQU0sMEJBQTBCLENBQUM7WUFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDdEUsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztZQUVyQyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsNkNBQXFDLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVsSSxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFTixtQkFBbUI7UUFDbkIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDaEQsTUFBTSxjQUFjLEdBQUcsdUJBQXVCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsT0FBTyxDQUFDO1FBRWxGLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUN0QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztZQUMzRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3pDLENBQUM7UUFFRCxnREFBZ0Q7UUFDaEQsMENBQTBDO1FBQzFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ2xELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUVqQyxRQUFRLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtnQkFDckQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUErQixFQUFFLEVBQVUsRUFBRSxLQUFlO1FBQzNGLElBQUksYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0YsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQixPQUFPO1FBQ1IsQ0FBQztRQUVELHFDQUFxQztRQUNyQyxhQUFhLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckosSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQixPQUFPO1FBQ1IsQ0FBQztRQUVELDREQUE0RDtRQUM1RCxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsMEJBQTBCLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMxSSxDQUFDO0lBRUQsWUFBWSxDQUFDLElBQVU7UUFDdEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV6QixPQUFPLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFUyxPQUFPLENBQUMsR0FBVTtRQUMzQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWCxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxRQUFnRTtRQUNyRixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxrQ0FBa0MsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hJLENBQUM7SUFFRCxRQUFRLENBQUMsSUFBVztRQUNuQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdELElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNwQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPLHFCQUFxQixDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRU8sZUFBZTtRQUN0QixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUN0QyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBYSxDQUFDLEVBQUUsQ0FBQztnQkFDbEMsT0FBTyxJQUFhLENBQUM7WUFDdEIsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBSUQsU0FBUyxDQUFDLElBQVcsRUFBRSxlQUF1QixVQUFVO1FBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUM7UUFFOUUsUUFBUSxJQUFJLEVBQUUsQ0FBQztZQUNkO2dCQUNDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMvRCxNQUFNO1lBQ1AsbURBQXFCLENBQUMsQ0FBQyxDQUFDO2dCQUN2QixJQUFJLENBQUMsb0JBQW9CLENBQUMsc0JBQXNCLHFDQUE2QixFQUFFLEtBQUssRUFBRSxDQUFDO2dCQUN2RixNQUFNO1lBQ1AsQ0FBQztZQUNELHVEQUF1QixDQUFDLENBQUMsQ0FBQztnQkFDekIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHNCQUFzQix1Q0FBK0IsRUFBRSxLQUFLLEVBQUUsQ0FBQztnQkFDekYsTUFBTTtZQUNQLENBQUM7WUFDRCxpRUFBNEIsQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxzQkFBc0IsNENBQW9DLEVBQUUsS0FBSyxFQUFFLENBQUM7Z0JBQzlGLE1BQU07WUFDUCxDQUFDO1lBQ0Q7Z0JBQ0UsSUFBSSxDQUFDLE9BQU8sb0RBQW9DLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDckUsTUFBTTtZQUNQO2dCQUNDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2pELE1BQU07WUFDUCxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNULFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUNwQixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFJRCxZQUFZLENBQUMsWUFBb0IsRUFBRSxJQUFZO1FBQzlDLElBQUksT0FBTyxJQUFJLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDakMsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdELENBQUM7UUFFRCxJQUFJLFlBQVksS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDMUMsQ0FBQztRQUVELHNEQUFzRDtRQUN0RCxJQUFJLGFBQXNCLENBQUM7UUFDM0IsSUFBSSxJQUFJLHFEQUFzQixFQUFFLENBQUM7WUFDaEMsYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3ZHLENBQUM7YUFBTSxJQUFJLElBQUksMkRBQXlCLEVBQUUsQ0FBQztZQUMxQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDckcsQ0FBQzthQUFNLElBQUksSUFBSSx5REFBd0IsRUFBRSxDQUFDO1lBQ3pDLGFBQWEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDakcsQ0FBQztRQUVELElBQUksYUFBYSxZQUFZLElBQUksRUFBRSxDQUFDO1lBQ25DLE9BQU8sYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JDLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBS0QsU0FBUyxDQUFDLElBQVcsRUFBRSxlQUF1QixVQUFVO1FBQ3ZELElBQUksWUFBWSxLQUFLLFVBQVUsSUFBSSxJQUFJLHFEQUFzQixFQUFFLENBQUM7WUFDL0QsT0FBTyxJQUFJLENBQUMsQ0FBQywrQ0FBK0M7UUFDN0QsQ0FBQztRQUVELFFBQVEsSUFBSSxFQUFFLENBQUM7WUFDZDtnQkFDQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztvQkFDeEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztvQkFDekQsd0JBQXdCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdEc7Z0JBQ0MsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN6RTtnQkFDQyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3ZFO2dCQUNDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUM5RTtnQkFDQyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDM0U7Z0JBQ0MsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQzdFO2dCQUNDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDeEU7Z0JBQ0MsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUN6RjtnQkFDQyxPQUFPLEtBQUssQ0FBQyxDQUFDLGtDQUFrQztRQUNsRCxDQUFDO0lBQ0YsQ0FBQztJQUVPLHFCQUFxQjtRQUM1QixPQUFPLEtBQUssSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ2pDLENBQUM7SUFFRCxLQUFLO1FBQ0osSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUM1RSxJQUFJLENBQUMsU0FBUyxnREFBa0IsQ0FBQztRQUNsQyxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxTQUFTLG1EQUFvQixTQUFTLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDcEUsQ0FBQztJQUNGLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHNCQUFzQixxQ0FBNkIsQ0FBQztRQUNsRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsZ0RBQWtCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxrREFBbUIsQ0FBQyxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQzVGLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLG1EQUFtRDtRQUN6RSxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLHlCQUF5QjtRQUN4QyxDQUFDO0lBQ0YsQ0FBQztJQUVELDBCQUEwQixDQUFDLFNBQXNCO1FBQ2hELE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVqRSxJQUFJLFNBQVMsS0FBSyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDdEMsTUFBTSxpQkFBaUIsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztZQUNoRSxNQUFNLFVBQVUsR0FDZixDQUFDLElBQUksQ0FBQyxTQUFTLDREQUF3QixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BGLENBQUMsSUFBSSxDQUFDLFNBQVMsb0RBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVFLENBQUMsSUFBSSxDQUFDLFNBQVMsZ0RBQWtCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDOUYsQ0FBQyxJQUFJLENBQUMsU0FBUyw4REFBeUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFeEYsTUFBTSxXQUFXLEdBQ2hCLENBQUMsSUFBSSxDQUFDLFNBQVMsdURBQXNCLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdGLENBQUMsSUFBSSxDQUFDLFNBQVMseURBQXVCLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9GLENBQUMsSUFBSSxDQUFDLFNBQVMsZ0RBQWtCLElBQUksaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVoRyxNQUFNLGNBQWMsR0FBRyxrQkFBa0IsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDO1lBQzdELE1BQU0sZUFBZSxHQUFHLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7WUFFaEUsT0FBTyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxDQUFDO1FBQzNELENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxXQUFXLEdBQ2hCLENBQUMsSUFBSSxDQUFDLFNBQVMsdURBQXNCLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdGLENBQUMsSUFBSSxDQUFDLFNBQVMseURBQXVCLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVqRyxPQUFPLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsa0JBQWtCLENBQUMsTUFBTSxHQUFHLFdBQVcsRUFBRSxDQUFDO1FBQzdGLENBQUM7SUFDRixDQUFDO0lBRU8sZUFBZTtRQUN0QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsTUFBZTtRQUN2QyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRCxhQUFhLENBQUMsVUFBb0IsRUFBRSxTQUFTLEdBQUcsS0FBSztRQUNwRCxNQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUV4RCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUV0RSxNQUFNLGNBQWMsR0FBRyxDQUFDLFdBQTZCLEVBQUUsRUFBRTtZQUN4RCxLQUFLLE1BQU0sTUFBTSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO2dCQUUzRSx3R0FBd0c7Z0JBQ3hHLElBQUksQ0FBQyxXQUFXLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO29CQUMvRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQ2hDLFdBQVcsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDNUksQ0FBQztnQkFDRCxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQ2xCLFdBQVcsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUM7Z0JBQ3hFLENBQUM7Z0JBRUQsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDdkMsQ0FBQztRQUNGLENBQUMsQ0FBQztRQUVGLGtGQUFrRjtRQUNsRixpRkFBaUY7UUFDakYsSUFBSSwwQkFBMEIsR0FBRyxLQUFLLENBQUM7UUFDdkMsTUFBTSxNQUFNLEdBQUcsdUJBQXVCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDbEUsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFNUYsa0JBQWtCO1FBQ2xCLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUM7WUFFNUIsMEJBQTBCLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsSUFBSSxNQUFNLENBQUMsVUFBVSxJQUFJLENBQUMsS0FBSyxDQUFDO1lBRXJHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDaEIsZUFBZSxDQUFDLHdCQUF3QixHQUFHLDBCQUEwQixDQUFDO2dCQUN0RSxlQUFlLENBQUMsa0NBQWtDLEdBQUcsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDO2dCQUMvRyxlQUFlLENBQUMsbUNBQW1DLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxLQUFLLG1CQUFtQixDQUFDLEdBQUcsQ0FBQztnQkFDdkgsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsb0RBQW9CLENBQUM7Z0JBQ3hFLGVBQWUsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLGdEQUFrQixDQUFDO2dCQUNwRSxlQUFlLENBQUMsVUFBVSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyw4REFBeUIsQ0FBQztnQkFDbEYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3RGLENBQUM7WUFFRCxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU1QixJQUFJLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pDLENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDMUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9CLENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDNUIsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsR0FBRyxtRUFBbUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHlCQUF5QixDQUFDLEdBQUcsRUFBRSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0ssQ0FBQztZQUVELElBQUksTUFBTSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUN0RSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsR0FBRyxxREFBNEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3JLLENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsSUFBSSxlQUFlLENBQUMsbUNBQW1DLEVBQUUsQ0FBQztnQkFDdkYsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMvRCxDQUFDO1lBRUQsSUFBSSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsQ0FBQztZQUVELGlDQUFpQztZQUNqQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDbEksZUFBZTtnQkFDZixJQUFJLENBQUMsQ0FBQyxvQkFBb0Isa0VBQWtDLElBQUksQ0FBQyxDQUFDLG9CQUFvQiw2RUFBc0MsRUFBRSxDQUFDO29CQUM5SCxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLGtFQUEyQyxDQUFDO29CQUM3RyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLDZFQUEyRCxDQUFDO29CQUMxSCxJQUFJLENBQUMsb0JBQW9CLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsd0NBQTRCLElBQUksbUJBQW1CLDhDQUErQixDQUFDLENBQUMsQ0FBQztnQkFDcEssQ0FBQztnQkFFRCxhQUFhO2dCQUNiLElBQUksQ0FBQyxDQUFDLG9CQUFvQiw4REFBZ0MsRUFBRSxDQUFDO29CQUM1RCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLDhEQUF5QyxDQUFDO29CQUN6RyxJQUFJLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztnQkFDL0MsQ0FBQztnQkFFRCxnQkFBZ0I7Z0JBQ2hCLElBQUksQ0FBQyxDQUFDLG9CQUFvQiw0REFBK0IsRUFBRSxDQUFDO29CQUMzRCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLDREQUF3QyxDQUFDO29CQUN2RyxJQUFJLENBQUMsc0JBQXNCLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3hELENBQUM7Z0JBRUQsWUFBWTtnQkFDWixJQUFJLENBQUMsQ0FBQyxvQkFBb0Isb0RBQTJCLEVBQUUsQ0FBQztvQkFDdkQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsb0RBQXVELElBQUksVUFBVSxDQUFDO29CQUNoSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsR0FBRyxxREFBNEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JLLENBQUM7Z0JBRUQsZ0JBQWdCO2dCQUNoQixJQUFJLENBQUMsQ0FBQyxvQkFBb0IsMEVBQXNDLEVBQUUsQ0FBQztvQkFDbEUsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsMEVBQXNDLENBQUM7b0JBQzlHLElBQUksZUFBZSxDQUFDLG1DQUFtQyxFQUFFLENBQUM7d0JBQ3pELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3RILENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxnQkFBZ0I7Z0JBQ2hCLElBQUksQ0FBQyxDQUFDLG9CQUFvQixrRUFBa0MsRUFBRSxDQUFDO29CQUM5RCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxrRUFBMkMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7b0JBQzFILGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLEdBQUcsbUVBQW1DLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNyTCxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxvQkFBb0I7YUFDZixDQUFDO1lBQ0wsSUFBSSxlQUFlLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN0QyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNsQyxDQUFDO1lBRUQsSUFBSSxlQUFlLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUM3QyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pDLENBQUM7WUFFRCxJQUFJLGVBQWUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3hDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5QixDQUFDO1lBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNoRixJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUVELElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDOUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hDLENBQUM7WUFFRCxJQUFJLGVBQWUsQ0FBQyxrQ0FBa0MsRUFBRSxDQUFDO2dCQUN4RCxJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzFDLENBQUM7WUFFRCxJQUFJLGVBQWUsQ0FBQyxtQ0FBbUMsRUFBRSxDQUFDO2dCQUN6RCxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzdELENBQUM7WUFFRCxjQUFjLEVBQUUsQ0FBQztZQUVqQiwwQkFBMEIsR0FBRyxlQUFlLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUM7UUFDbEgsQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDZixDQUFDO1FBRUQsSUFBSSwwQkFBMEIsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELHVFQUF1RTtRQUN2RSxJQUFJLHdCQUF3QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsd0JBQXdCLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDM0csSUFBSSxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ2pELElBQUksQ0FBQyxTQUFTLENBQUMsd0JBQXdCLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO1lBQzNFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsU0FBUyxDQUFDLHdCQUF3QixDQUFDLENBQUM7WUFDMUMsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2QsQ0FBQztRQUVELFFBQVE7UUFDUixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxNQUFlO1FBQ3pDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUxRSxhQUFhO1FBQ2IsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNsRSxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBRUQsb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFUyxxQkFBcUI7UUFDOUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sc0RBQXFCLENBQUM7UUFDbkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sa0RBQW1CLENBQUM7UUFDbkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sa0RBQW1CLENBQUM7UUFDbkQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sNERBQXdCLENBQUM7UUFDekQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sZ0RBQWtCLENBQUM7UUFDakQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsT0FBTyw4REFBeUIsQ0FBQztRQUMvRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxvREFBb0IsQ0FBQztRQUNqRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyx3REFBc0IsQ0FBQztRQUVyRCxnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFFBQVEsQ0FBQztRQUNqQyxJQUFJLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQztRQUNqQyxJQUFJLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQztRQUMvQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsV0FBVyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxhQUFhLEdBQUcsU0FBUyxDQUFDO1FBQy9CLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxnQkFBZ0IsQ0FBQztRQUM3QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsU0FBUyxDQUFDO1FBRW5DLE1BQU0sT0FBTyxHQUFHO1lBQ2YsNERBQXdCLEVBQUUsSUFBSSxDQUFDLG1CQUFtQjtZQUNsRCxrREFBbUIsRUFBRSxJQUFJLENBQUMsY0FBYztZQUN4QyxzREFBcUIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCO1lBQzVDLGtEQUFtQixFQUFFLElBQUksQ0FBQyxjQUFjO1lBQ3hDLGdEQUFrQixFQUFFLElBQUksQ0FBQyxhQUFhO1lBQ3RDLG9EQUFvQixFQUFFLElBQUksQ0FBQyxlQUFlO1lBQzFDLHdEQUFzQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7WUFDOUMsOERBQXlCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQjtTQUNwRCxDQUFDO1FBRUYsTUFBTSxRQUFRLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBbUIsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlELE1BQU0sYUFBYSxHQUFHLGdCQUFnQixDQUFDLFdBQVcsQ0FDakQsSUFBSSxDQUFDLG9CQUFvQixFQUFFLEVBQzNCLEVBQUUsUUFBUSxFQUFFLEVBQ1osRUFBRSxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsQ0FDN0IsQ0FBQztRQUVGLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUM7UUFFMUUsS0FBSyxNQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDckgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDckQsSUFBSSxJQUFJLEtBQUssT0FBTyxFQUFFLENBQUM7b0JBQ3RCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO3FCQUFNLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUMvQixJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO3FCQUFNLElBQUksSUFBSSxLQUFLLGdCQUFnQixFQUFFLENBQUM7b0JBQ3RDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDNUMsQ0FBQztxQkFBTSxJQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO2dCQUNELElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDdkMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDakYsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBRXRELGdCQUFnQjtZQUNoQixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDO2dCQUNsRixDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO2dCQUNuRSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUM5RCxJQUFJLENBQUMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsV0FBcUIsQ0FBQyxDQUFDO1lBRTVGLGFBQWE7WUFDYixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDO2dCQUM5RSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2dCQUNqRSxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztvQkFDOUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNO29CQUMzRCxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUM3RCxJQUFJLENBQUMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxVQUFVLEVBQUUsU0FBbUIsQ0FBQyxDQUFDO1lBRXhGLHFCQUFxQjtZQUNyQixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxtQkFBbUIsQ0FBQztnQkFDNUYsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDO2dCQUN4RSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ25FLElBQUksQ0FBQyxVQUFVLENBQUMsc0JBQXNCLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLGdCQUEwQixDQUFDLENBQUM7WUFFdEcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsTUFBTTtRQUNMLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLHVCQUF1QixHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO2dCQUNyRixVQUFVLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUUsOERBQThEO2dCQUMxRixJQUFJLENBQUMsTUFBTSxFQUFLLHVEQUF1RDtZQUN2RSx5QkFBeUIsQ0FBQyx5R0FBeUc7YUFDbkksQ0FBQztZQUNGLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDBCQUEwQixJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxZQUFZLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBRXJJLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVsRyx5QkFBeUI7WUFDekIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFFeEIsZ0JBQWdCO1lBQ2hCLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7SUFDRixDQUFDO0lBRUQsMEJBQTBCO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUVELHNCQUFzQixDQUFDLE1BQWUsRUFBRSxVQUFvQjtRQUMzRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFOUUsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDOUcsTUFBTSxlQUFlLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3hELElBQUksTUFBTSxZQUFZLGVBQWUsRUFBRSxDQUFDO2dCQUN2QyxPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUMxRSxDQUFDO1lBRUQsSUFBSSxNQUFNLEVBQUUsYUFBYSxtREFBeUMsRUFBRSxDQUFDO2dCQUNwRSxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFFRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ25ELElBQUksb0JBQW9CLEdBQUcsS0FBSyxDQUFDO1FBQ2pDLElBQUksTUFBTSxDQUFDLFdBQVcsd0NBQWdDLEVBQUUsQ0FBQztZQUN4RCxvQkFBb0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDakQsQ0FBQzthQUFNLENBQUM7WUFDUCxvQkFBb0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUVELE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1FBQ3JILElBQ0MsNEJBQTRCO1lBQzVCLENBQUMsQ0FBQyxvQkFBb0IsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxFQUNuRyxDQUFDO1lBQ0YsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLG1GQUFtRjtRQUNwRyxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDcEUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFdEQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNqQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDZixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztJQUN2SCxDQUFDO0lBRUQsT0FBTyxDQUFDLElBQVc7UUFDbEIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVELE9BQU8sQ0FBQyxJQUFXLEVBQUUsSUFBZTtRQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFRCxVQUFVLENBQUMsSUFBVyxFQUFFLGVBQXVCLEVBQUUsZ0JBQXdCO1FBQ3hFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxzQkFBc0IsQ0FBQyxlQUFlLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDNUgsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsc0JBQXNCLENBQUMsZUFBZSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFFL0gsSUFBSSxRQUFtQixDQUFDO1FBRXhCLFFBQVEsSUFBSSxFQUFFLENBQUM7WUFDZDtnQkFDQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUNoRSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUNqRDtvQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBRyxpQkFBaUI7b0JBQ3pDLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTTtpQkFDdkIsQ0FBQyxDQUFDO2dCQUVKLE1BQU07WUFDUDtnQkFDQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUU5RCxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUMvQztvQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDO29CQUN2RixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUMxRixDQUFDLENBQUM7Z0JBRUosTUFBTTtZQUNQO2dCQUNDLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztnQkFDckUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUN0RDtvQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBRyxpQkFBaUI7b0JBQ3pDLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTTtpQkFDdkIsQ0FBQyxDQUFDO2dCQUNKLE1BQU07WUFDUDtnQkFDQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUUvRCxzQkFBc0I7Z0JBQ3RCLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ2xELElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQ2hEO3dCQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxHQUFHLGlCQUFpQjt3QkFDekMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLEdBQUcsa0JBQWtCO3FCQUM1QyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO29CQUVqRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUNoRixJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxHQUFHLGlCQUFpQixFQUFFLE1BQU0sRUFBRSxNQUFNLEdBQUcsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO29CQUVqSSxrQ0FBa0M7b0JBQ2xDLDRDQUE0QztvQkFDNUMsb0NBQW9DO29CQUNwQyxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQ3JHLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxNQUFNLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxLQUFLLEtBQUssUUFBUSxDQUFDLEVBQUUsQ0FBQzt3QkFDL0YsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFDaEQ7NEJBQ0MsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUN6RixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLGtCQUFrQixJQUFJLE1BQU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7eUJBQy9GLENBQUMsQ0FBQztvQkFDTCxDQUFDO2dCQUNGLENBQUM7Z0JBRUQsTUFBTTtZQUNQO2dCQUNDLE9BQU8sQ0FBQyw0QkFBNEI7UUFDdEMsQ0FBQztJQUNGLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxNQUFlO1FBQzNDLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM1RSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRU8sZUFBZSxDQUFDLE1BQWU7UUFDdEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFTyxlQUFlLENBQUMsTUFBZTtRQUN0QyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRXZFLGFBQWE7UUFDYixJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRWhFLHlEQUF5RDtRQUN6RCxJQUFJLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLGdEQUFrQixFQUFFLENBQUM7WUFDakQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FBQztJQUNGLENBQUM7SUFFRCxnQkFBZ0I7UUFDZixPQUFPLFFBQVEsQ0FBQztZQUNmLENBQUMsSUFBSSxDQUFDLFNBQVMsb0RBQW9CLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDOUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxtREFBb0IsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsU0FBUztZQUNsRyxDQUFDLElBQUksQ0FBQyxTQUFTLGdEQUFrQixDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQzFFLENBQUMsSUFBSSxDQUFDLFNBQVMsOERBQXlCLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsU0FBUztZQUN4RixDQUFDLElBQUksQ0FBQyxTQUFTLHdEQUFzQixDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDbEYsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDOUUsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVPLGdCQUFnQixDQUFDLE1BQWU7UUFDdkMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV4RSxhQUFhO1FBQ2IsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDaEUsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFFRCx5RUFBeUU7UUFDekUsSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLHNCQUFzQix1Q0FBK0IsRUFBRSxDQUFDO1lBQy9GLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyx1QkFBdUIsdUNBQStCLENBQUM7WUFDakYsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQztRQUVELDBFQUEwRTthQUNyRSxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHNCQUFzQix1Q0FBK0IsRUFBRSxDQUFDO1lBQ3RHLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyw0QkFBNEIsdUNBQStCLENBQUM7WUFDNUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFDbkIsSUFBSSxDQUFDLGlCQUFpQix3Q0FBZ0MsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzVFLENBQUM7UUFDRixDQUFDO1FBRUQsb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRU8sUUFBUSxDQUFDLEVBQVU7UUFDMUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFFLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNwQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMzRixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUN6QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPLGtCQUFrQixDQUFDLHFCQUFxQixDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVPLG1CQUFtQixDQUFDLGVBQXlCLEVBQUUsY0FBOEIsRUFBRSxhQUF1QjtRQUU3RyxrQ0FBa0M7UUFDbEMsTUFBTSxlQUFlLEdBQUcsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDckQsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLElBQUksQ0FBQyxDQUFDLGNBQWMsS0FBSyxRQUFRLElBQUksQ0FBQyxlQUFlLDBCQUFrQixJQUFJLGNBQWMsS0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsMkJBQW1CLElBQUksY0FBYyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDM04sTUFBTSwyQkFBMkIsR0FBRyxlQUFlLElBQUksQ0FBQyxDQUFDLGNBQWMsS0FBSyxRQUFRLElBQUksQ0FBQyxlQUFlLDJCQUFtQixJQUFJLGNBQWMsS0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsMEJBQWtCLElBQUksY0FBYyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDaE8sTUFBTSxpQkFBaUIsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLGdEQUFrQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDOU8sTUFBTSxrQkFBa0IsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLGdEQUFrQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDalAsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLG9EQUFvQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDdlAsTUFBTSx1QkFBdUIsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLDhEQUF5QixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksSUFBSSxDQUFDLG9CQUFvQixD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