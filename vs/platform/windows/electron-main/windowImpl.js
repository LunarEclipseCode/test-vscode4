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
import electron, { screen } from 'electron';
import { DeferredPromise, RunOnceScheduler, timeout, Delayer } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { FileAccess, Schemas } from '../../../base/common/network.js';
import { getMarks, mark } from '../../../base/common/performance.js';
import { isBigSurOrNewer, isLinux, isMacintosh, isWindows } from '../../../base/common/platform.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { release } from 'os';
import { IBackupMainService } from '../../backup/electron-main/backup.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IDialogMainService } from '../../dialogs/electron-main/dialogMainService.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { isLaunchedFromCli } from '../../environment/node/argvHelper.js';
import { IFileService } from '../../files/common/files.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { IProtocolMainService } from '../../protocol/electron-main/protocol.js';
import { resolveMarketplaceHeaders } from '../../externalServices/common/marketplace.js';
import { IApplicationStorageMainService, IStorageMainService } from '../../storage/electron-main/storageMainService.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { IThemeMainService } from '../../theme/electron-main/themeMainService.js';
import { getMenuBarVisibility, hasNativeTitlebar, useNativeFullScreen, useWindowControlsOverlay, DEFAULT_CUSTOM_TITLEBAR_HEIGHT } from '../../window/common/window.js';
import { defaultBrowserWindowOptions, getAllWindowsExcludingOffscreen, IWindowsMainService, WindowStateValidator } from './windows.js';
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { IWorkspacesManagementMainService } from '../../workspaces/electron-main/workspacesManagementMainService.js';
import { defaultWindowState } from '../../window/electron-main/window.js';
import { IPolicyService } from '../../policy/common/policy.js';
import { IStateService } from '../../state/node/state.js';
import { IUserDataProfilesMainService } from '../../userDataProfile/electron-main/userDataProfile.js';
import { ILoggerMainService } from '../../log/electron-main/loggerService.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { errorHandler } from '../../../base/common/errors.js';
var ReadyState;
(function (ReadyState) {
    /**
     * This window has not loaded anything yet
     * and this is the initial state of every
     * window.
     */
    ReadyState[ReadyState["NONE"] = 0] = "NONE";
    /**
     * This window is navigating, either for the
     * first time or subsequent times.
     */
    ReadyState[ReadyState["NAVIGATING"] = 1] = "NAVIGATING";
    /**
     * This window has finished loading and is ready
     * to forward IPC requests to the web contents.
     */
    ReadyState[ReadyState["READY"] = 2] = "READY";
})(ReadyState || (ReadyState = {}));
export class BaseWindow extends Disposable {
    get lastFocusTime() { return this._lastFocusTime; }
    get win() { return this._win; }
    setWin(win, options) {
        this._win = win;
        // Window Events
        this._register(Event.fromNodeEventEmitter(win, 'maximize')(() => {
            if (isWindows && this.environmentMainService.enableRDPDisplayTracking && this._win) {
                const [x, y] = this._win.getPosition();
                const [width, height] = this._win.getSize();
                this.maximizedWindowState = { mode: 0 /* WindowMode.Maximized */, width, height, x, y };
                this.logService.debug(`Saved maximized window ${this.id} display state:`, this.maximizedWindowState);
            }
            this._onDidMaximize.fire();
        }));
        this._register(Event.fromNodeEventEmitter(win, 'unmaximize')(() => {
            if (isWindows && this.environmentMainService.enableRDPDisplayTracking && this.maximizedWindowState) {
                this.maximizedWindowState = undefined;
                this.logService.debug(`Cleared maximized window ${this.id} state`);
            }
            this._onDidUnmaximize.fire();
        }));
        this._register(Event.fromNodeEventEmitter(win, 'closed')(() => {
            this._onDidClose.fire();
            this.dispose();
        }));
        this._register(Event.fromNodeEventEmitter(win, 'focus')(() => {
            this._lastFocusTime = Date.now();
        }));
        this._register(Event.fromNodeEventEmitter(this._win, 'enter-full-screen')(() => this._onDidEnterFullScreen.fire()));
        this._register(Event.fromNodeEventEmitter(this._win, 'leave-full-screen')(() => this._onDidLeaveFullScreen.fire()));
        this._register(Event.fromNodeEventEmitter(this._win, 'always-on-top-changed', (_, alwaysOnTop) => alwaysOnTop)(alwaysOnTop => this._onDidChangeAlwaysOnTop.fire(alwaysOnTop)));
        // Sheet Offsets
        const useCustomTitleStyle = !hasNativeTitlebar(this.configurationService, options?.titleBarStyle === 'hidden' ? "custom" /* TitlebarStyle.CUSTOM */ : undefined /* unknown */);
        if (isMacintosh && useCustomTitleStyle) {
            win.setSheetOffset(isBigSurOrNewer(release()) ? 28 : 22); // offset dialogs by the height of the custom title bar if we have any
        }
        // Update the window controls immediately based on cached or default values
        if (useCustomTitleStyle && useWindowControlsOverlay(this.configurationService)) {
            const cachedWindowControlHeight = this.stateService.getItem((BaseWindow.windowControlHeightStateStorageKey));
            if (cachedWindowControlHeight) {
                this.updateWindowControls({ height: cachedWindowControlHeight });
            }
            else {
                this.updateWindowControls({ height: DEFAULT_CUSTOM_TITLEBAR_HEIGHT });
            }
        }
        // Setup windows/linux system context menu so it only is allowed over the app icon
        if ((isWindows || isLinux) && useCustomTitleStyle) {
            this._register(Event.fromNodeEventEmitter(win, 'system-context-menu', (event, point) => ({ event, point }))(e => {
                const [x, y] = win.getPosition();
                const cursorPos = electron.screen.screenToDipPoint(e.point);
                const cx = Math.floor(cursorPos.x) - x;
                const cy = Math.floor(cursorPos.y) - y;
                // TODO@bpasero TODO@deepak1556 workaround for https://github.com/microsoft/vscode/issues/250626
                // where showing the custom menu seems broken on Windows
                if (isLinux) {
                    if (cx > 35 /* Cursor is beyond app icon in title bar */) {
                        e.event.preventDefault();
                        this._onDidTriggerSystemContextMenu.fire({ x: cx, y: cy });
                    }
                }
            }));
        }
        // Open devtools if instructed from command line args
        if (this.environmentMainService.args['open-devtools'] === true) {
            win.webContents.openDevTools();
        }
        // macOS: Window Fullscreen Transitions
        if (isMacintosh) {
            this._register(this.onDidEnterFullScreen(() => {
                this.joinNativeFullScreenTransition?.complete(true);
            }));
            this._register(this.onDidLeaveFullScreen(() => {
                this.joinNativeFullScreenTransition?.complete(true);
            }));
        }
        if (isWindows && this.environmentMainService.enableRDPDisplayTracking) {
            // Handles the display-added event on Windows RDP multi-monitor scenarios.
            // This helps restore maximized windows to their correct monitor after RDP reconnection.
            // Refs https://github.com/electron/electron/issues/47016
            this._register(Event.fromNodeEventEmitter(screen, 'display-added', (event, display) => ({ event, display }))((e) => {
                this.onDisplayAdded(e.display);
            }));
        }
    }
    onDisplayAdded(display) {
        const state = this.maximizedWindowState;
        if (state && this._win && WindowStateValidator.validateWindowStateOnDisplay(state, display)) {
            this.logService.debug(`Setting maximized window ${this.id} bounds to match newly added display`, state);
            this._win.setBounds(state);
        }
    }
    constructor(configurationService, stateService, environmentMainService, logService) {
        super();
        this.configurationService = configurationService;
        this.stateService = stateService;
        this.environmentMainService = environmentMainService;
        this.logService = logService;
        //#region Events
        this._onDidClose = this._register(new Emitter());
        this.onDidClose = this._onDidClose.event;
        this._onDidMaximize = this._register(new Emitter());
        this.onDidMaximize = this._onDidMaximize.event;
        this._onDidUnmaximize = this._register(new Emitter());
        this.onDidUnmaximize = this._onDidUnmaximize.event;
        this._onDidTriggerSystemContextMenu = this._register(new Emitter());
        this.onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;
        this._onDidEnterFullScreen = this._register(new Emitter());
        this.onDidEnterFullScreen = this._onDidEnterFullScreen.event;
        this._onDidLeaveFullScreen = this._register(new Emitter());
        this.onDidLeaveFullScreen = this._onDidLeaveFullScreen.event;
        this._onDidChangeAlwaysOnTop = this._register(new Emitter());
        this.onDidChangeAlwaysOnTop = this._onDidChangeAlwaysOnTop.event;
        this._lastFocusTime = Date.now(); // window is shown on creation so take current time
        this._win = null;
        //#endregion
        //#region Fullscreen
        this.transientIsNativeFullScreen = undefined;
        this.joinNativeFullScreenTransition = undefined;
    }
    applyState(state, hasMultipleDisplays = electron.screen.getAllDisplays().length > 0) {
        // TODO@electron (Electron 4 regression): when running on multiple displays where the target display
        // to open the window has a larger resolution than the primary display, the window will not size
        // correctly unless we set the bounds again (https://github.com/microsoft/vscode/issues/74872)
        //
        // Extended to cover Windows as well as Mac (https://github.com/microsoft/vscode/issues/146499)
        //
        // However, when running with native tabs with multiple windows we cannot use this workaround
        // because there is a potential that the new window will be added as native tab instead of being
        // a window on its own. In that case calling setBounds() would cause https://github.com/microsoft/vscode/issues/75830
        const windowSettings = this.configurationService.getValue('window');
        const useNativeTabs = isMacintosh && windowSettings?.nativeTabs === true;
        if ((isMacintosh || isWindows) && hasMultipleDisplays && (!useNativeTabs || getAllWindowsExcludingOffscreen().length === 1)) {
            if ([state.width, state.height, state.x, state.y].every(value => typeof value === 'number')) {
                this._win?.setBounds({
                    width: state.width,
                    height: state.height,
                    x: state.x,
                    y: state.y
                });
            }
        }
        if (state.mode === 0 /* WindowMode.Maximized */ || state.mode === 3 /* WindowMode.Fullscreen */) {
            // this call may or may not show the window, depends
            // on the platform: currently on Windows and Linux will
            // show the window as active. To be on the safe side,
            // we show the window at the end of this block.
            this._win?.maximize();
            if (state.mode === 3 /* WindowMode.Fullscreen */) {
                this.setFullScreen(true, true);
            }
            // to reduce flicker from the default window size
            // to maximize or fullscreen, we only show after
            this._win?.show();
        }
    }
    setRepresentedFilename(filename) {
        if (isMacintosh) {
            this.win?.setRepresentedFilename(filename);
        }
        else {
            this.representedFilename = filename;
        }
    }
    getRepresentedFilename() {
        if (isMacintosh) {
            return this.win?.getRepresentedFilename();
        }
        return this.representedFilename;
    }
    setDocumentEdited(edited) {
        if (isMacintosh) {
            this.win?.setDocumentEdited(edited);
        }
        this.documentEdited = edited;
    }
    isDocumentEdited() {
        if (isMacintosh) {
            return Boolean(this.win?.isDocumentEdited());
        }
        return !!this.documentEdited;
    }
    focus(options) {
        switch (options?.mode ?? 0 /* FocusMode.Transfer */) {
            case 0 /* FocusMode.Transfer */:
                this.doFocusWindow();
                break;
            case 1 /* FocusMode.Notify */:
                if (isMacintosh) {
                    electron.app.dock?.bounce('informational');
                }
                else if (isWindows) {
                    // On Windows, this just flashes the taskbar icon, which is desired
                    // https://github.com/electron/electron/issues/2867
                    this.win?.focus();
                }
                break;
            case 2 /* FocusMode.Force */:
                if (isMacintosh) {
                    electron.app.focus({ steal: true });
                }
                this.doFocusWindow();
                break;
        }
    }
    doFocusWindow() {
        const win = this.win;
        if (!win) {
            return;
        }
        if (win.isMinimized()) {
            win.restore();
        }
        win.focus();
    }
    //#region Window Control Overlays
    static { this.windowControlHeightStateStorageKey = 'windowControlHeight'; }
    updateWindowControls(options) {
        const win = this.win;
        if (!win) {
            return;
        }
        // Cache the height for speeds lookups on startup
        if (options.height) {
            this.stateService.setItem((CodeWindow.windowControlHeightStateStorageKey), options.height);
        }
        // Windows/Linux: update window controls via setTitleBarOverlay()
        if (!isMacintosh && useWindowControlsOverlay(this.configurationService)) {
            win.setTitleBarOverlay({
                color: options.backgroundColor?.trim() === '' ? undefined : options.backgroundColor,
                symbolColor: options.foregroundColor?.trim() === '' ? undefined : options.foregroundColor,
                height: options.height ? options.height - 1 : undefined // account for window border
            });
        }
        // macOS: update window controls via setWindowButtonPosition()
        else if (isMacintosh && options.height !== undefined) {
            // The traffic lights have a height of 12px. There's an invisible margin
            // of 2px at the top and bottom, and 1px on the left and right. Therefore,
            // the height for centering is 12px + 2 * 2px = 16px. When the position
            // is set, the horizontal margin is offset to ensure the distance between
            // the traffic lights and the window frame is equal in both directions.
            const offset = Math.floor((options.height - 16) / 2);
            if (!offset) {
                win.setWindowButtonPosition(null);
            }
            else {
                win.setWindowButtonPosition({ x: offset + 1, y: offset });
            }
        }
    }
    toggleFullScreen() {
        this.setFullScreen(!this.isFullScreen, false);
    }
    setFullScreen(fullscreen, fromRestore) {
        // Set fullscreen state
        if (useNativeFullScreen(this.configurationService)) {
            this.setNativeFullScreen(fullscreen, fromRestore);
        }
        else {
            this.setSimpleFullScreen(fullscreen);
        }
    }
    get isFullScreen() {
        if (isMacintosh && typeof this.transientIsNativeFullScreen === 'boolean') {
            return this.transientIsNativeFullScreen;
        }
        const win = this.win;
        const isFullScreen = win?.isFullScreen();
        const isSimpleFullScreen = win?.isSimpleFullScreen();
        return Boolean(isFullScreen || isSimpleFullScreen);
    }
    setNativeFullScreen(fullscreen, fromRestore) {
        const win = this.win;
        if (win?.isSimpleFullScreen()) {
            win?.setSimpleFullScreen(false);
        }
        this.doSetNativeFullScreen(fullscreen, fromRestore);
    }
    doSetNativeFullScreen(fullscreen, fromRestore) {
        if (isMacintosh) {
            // macOS: Electron windows report `false` for `isFullScreen()` for as long
            // as the fullscreen transition animation takes place. As such, we need to
            // listen to the transition events and carry around an intermediate state
            // for knowing if we are in fullscreen or not
            // Refs: https://github.com/electron/electron/issues/35360
            this.transientIsNativeFullScreen = fullscreen;
            const joinNativeFullScreenTransition = this.joinNativeFullScreenTransition = new DeferredPromise();
            (async () => {
                const transitioned = await Promise.race([
                    joinNativeFullScreenTransition.p,
                    timeout(10000).then(() => false)
                ]);
                if (this.joinNativeFullScreenTransition !== joinNativeFullScreenTransition) {
                    return; // another transition was requested later
                }
                this.transientIsNativeFullScreen = undefined;
                this.joinNativeFullScreenTransition = undefined;
                // There is one interesting gotcha on macOS: when you are opening a new
                // window from a fullscreen window, that new window will immediately
                // open fullscreen and emit the `enter-full-screen` event even before we
                // reach this method. In that case, we actually will timeout after 10s
                // for detecting the transition and as such it is important that we only
                // signal to leave fullscreen if the window reports as not being in fullscreen.
                if (!transitioned && fullscreen && fromRestore && this.win && !this.win.isFullScreen()) {
                    // We have seen requests for fullscreen failing eventually after some
                    // time, for example when an OS update was performed and windows restore.
                    // In those cases a user would find a window that is not in fullscreen
                    // but also does not show any custom titlebar (and thus window controls)
                    // because we think the window is in fullscreen.
                    //
                    // As a workaround in that case we emit a warning and leave fullscreen
                    // so that at least the window controls are back.
                    this.logService.warn('window: native macOS fullscreen transition did not happen within 10s from restoring');
                    this._onDidLeaveFullScreen.fire();
                }
            })();
        }
        const win = this.win;
        win?.setFullScreen(fullscreen);
    }
    setSimpleFullScreen(fullscreen) {
        const win = this.win;
        if (win?.isFullScreen()) {
            this.doSetNativeFullScreen(false, false);
        }
        win?.setSimpleFullScreen(fullscreen);
        win?.webContents.focus(); // workaround issue where focus is not going into window
    }
    dispose() {
        super.dispose();
        this._win = null; // Important to dereference the window object to allow for GC
    }
}
let CodeWindow = class CodeWindow extends BaseWindow {
    get id() { return this._id; }
    get backupPath() { return this._config?.backupPath; }
    get openedWorkspace() { return this._config?.workspace; }
    get profile() {
        if (!this.config) {
            return undefined;
        }
        const profile = this.userDataProfilesService.profiles.find(profile => profile.id === this.config?.profiles.profile.id);
        if (this.isExtensionDevelopmentHost && profile) {
            return profile;
        }
        return this.userDataProfilesService.getProfileForWorkspace(this.config.workspace ?? toWorkspaceIdentifier(this.backupPath, this.isExtensionDevelopmentHost)) ?? this.userDataProfilesService.defaultProfile;
    }
    get remoteAuthority() { return this._config?.remoteAuthority; }
    get config() { return this._config; }
    get isExtensionDevelopmentHost() { return !!(this._config?.extensionDevelopmentPath); }
    get isExtensionTestHost() { return !!(this._config?.extensionTestsPath); }
    get isExtensionDevelopmentTestFromCli() { return this.isExtensionDevelopmentHost && this.isExtensionTestHost && !this._config?.debugId; }
    constructor(config, logService, loggerMainService, environmentMainService, policyService, userDataProfilesService, fileService, applicationStorageMainService, storageMainService, configurationService, themeMainService, workspacesManagementMainService, backupMainService, telemetryService, dialogMainService, lifecycleMainService, productService, protocolMainService, windowsMainService, stateService, instantiationService) {
        super(configurationService, stateService, environmentMainService, logService);
        this.loggerMainService = loggerMainService;
        this.policyService = policyService;
        this.userDataProfilesService = userDataProfilesService;
        this.fileService = fileService;
        this.applicationStorageMainService = applicationStorageMainService;
        this.storageMainService = storageMainService;
        this.themeMainService = themeMainService;
        this.workspacesManagementMainService = workspacesManagementMainService;
        this.backupMainService = backupMainService;
        this.telemetryService = telemetryService;
        this.dialogMainService = dialogMainService;
        this.lifecycleMainService = lifecycleMainService;
        this.productService = productService;
        this.windowsMainService = windowsMainService;
        //#region Events
        this._onWillLoad = this._register(new Emitter());
        this.onWillLoad = this._onWillLoad.event;
        this._onDidSignalReady = this._register(new Emitter());
        this.onDidSignalReady = this._onDidSignalReady.event;
        this._onDidDestroy = this._register(new Emitter());
        this.onDidDestroy = this._onDidDestroy.event;
        this.whenReadyCallbacks = [];
        this.touchBarGroups = [];
        this.currentHttpProxy = undefined;
        this.currentNoProxy = undefined;
        this.customZoomLevel = undefined;
        this.wasLoaded = false;
        this.readyState = 0 /* ReadyState.NONE */;
        //#region create browser window
        {
            this.configObjectUrl = this._register(protocolMainService.createIPCObjectUrl());
            // Load window state
            const [state, hasMultipleDisplays] = this.restoreWindowState(config.state);
            this.windowState = state;
            this.logService.trace('window#ctor: using window state', state);
            const options = instantiationService.invokeFunction(defaultBrowserWindowOptions, this.windowState, undefined, {
                preload: FileAccess.asFileUri('vs/base/parts/sandbox/electron-browser/preload.js').fsPath,
                additionalArguments: [`--vscode-window-config=${this.configObjectUrl.resource.toString()}`],
                v8CacheOptions: this.environmentMainService.useCodeCache ? 'bypassHeatCheck' : 'none',
            });
            // Create the browser window
            mark('code/willCreateCodeBrowserWindow');
            this._win = new electron.BrowserWindow(options);
            mark('code/didCreateCodeBrowserWindow');
            this._id = this._win.id;
            this.setWin(this._win, options);
            // Apply some state after window creation
            this.applyState(this.windowState, hasMultipleDisplays);
            this._lastFocusTime = Date.now(); // since we show directly, we need to set the last focus time too
        }
        //#endregion
        //#region JS Callstack Collector
        let sampleInterval = parseInt(this.environmentMainService.args['unresponsive-sample-interval'] || '1000');
        let samplePeriod = parseInt(this.environmentMainService.args['unresponsive-sample-period'] || '15000');
        if (sampleInterval <= 0 || samplePeriod <= 0 || sampleInterval > samplePeriod) {
            this.logService.warn(`Invalid unresponsive sample interval (${sampleInterval}ms) or period (${samplePeriod}ms), using defaults.`);
            sampleInterval = 1000;
            samplePeriod = 15000;
        }
        this.jsCallStackMap = new Map();
        this.jsCallStackEffectiveSampleCount = Math.round(samplePeriod / sampleInterval);
        this.jsCallStackCollector = this._register(new Delayer(sampleInterval));
        this.jsCallStackCollectorStopScheduler = this._register(new RunOnceScheduler(() => {
            this.stopCollectingJScallStacks(); // Stop collecting after 15s max
        }, samplePeriod));
        //#endregion
        // respect configured menu bar visibility
        this.onConfigurationUpdated();
        // macOS: touch bar support
        this.createTouchBar();
        // Eventing
        this.registerListeners();
    }
    setReady() {
        this.logService.trace(`window#load: window reported ready (id: ${this._id})`);
        this.readyState = 2 /* ReadyState.READY */;
        // inform all waiting promises that we are ready now
        while (this.whenReadyCallbacks.length) {
            this.whenReadyCallbacks.pop()(this);
        }
        // Events
        this._onDidSignalReady.fire();
    }
    ready() {
        return new Promise(resolve => {
            if (this.isReady) {
                return resolve(this);
            }
            // otherwise keep and call later when we are ready
            this.whenReadyCallbacks.push(resolve);
        });
    }
    get isReady() {
        return this.readyState === 2 /* ReadyState.READY */;
    }
    get whenClosedOrLoaded() {
        return new Promise(resolve => {
            function handle() {
                closeListener.dispose();
                loadListener.dispose();
                resolve();
            }
            const closeListener = this.onDidClose(() => handle());
            const loadListener = this.onWillLoad(() => handle());
        });
    }
    registerListeners() {
        // Window error conditions to handle
        this._register(Event.fromNodeEventEmitter(this._win, 'unresponsive')(() => this.onWindowError(1 /* WindowError.UNRESPONSIVE */)));
        this._register(Event.fromNodeEventEmitter(this._win, 'responsive')(() => this.onWindowError(4 /* WindowError.RESPONSIVE */)));
        this._register(Event.fromNodeEventEmitter(this._win.webContents, 'render-process-gone', (event, details) => details)(details => this.onWindowError(2 /* WindowError.PROCESS_GONE */, { ...details })));
        this._register(Event.fromNodeEventEmitter(this._win.webContents, 'did-fail-load', (event, exitCode, reason) => ({ exitCode, reason }))(({ exitCode, reason }) => this.onWindowError(3 /* WindowError.LOAD */, { reason, exitCode })));
        // Prevent windows/iframes from blocking the unload
        // through DOM events. We have our own logic for
        // unloading a window that should not be confused
        // with the DOM way.
        // (https://github.com/microsoft/vscode/issues/122736)
        this._register(Event.fromNodeEventEmitter(this._win.webContents, 'will-prevent-unload')(event => event.preventDefault()));
        // Remember that we loaded
        this._register(Event.fromNodeEventEmitter(this._win.webContents, 'did-finish-load')(() => {
            // Associate properties from the load request if provided
            if (this.pendingLoadConfig) {
                this._config = this.pendingLoadConfig;
                this.pendingLoadConfig = undefined;
            }
        }));
        // Window (Un)Maximize
        this._register(this.onDidMaximize(() => {
            if (this._config) {
                this._config.maximized = true;
            }
        }));
        this._register(this.onDidUnmaximize(() => {
            if (this._config) {
                this._config.maximized = false;
            }
        }));
        // Window Fullscreen
        this._register(this.onDidEnterFullScreen(() => {
            this.sendWhenReady('vscode:enterFullScreen', CancellationToken.None);
        }));
        this._register(this.onDidLeaveFullScreen(() => {
            this.sendWhenReady('vscode:leaveFullScreen', CancellationToken.None);
        }));
        // Handle configuration changes
        this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));
        // Handle Workspace events
        this._register(this.workspacesManagementMainService.onDidDeleteUntitledWorkspace(e => this.onDidDeleteUntitledWorkspace(e)));
        // Inject headers when requests are incoming
        const urls = ['https://*.vsassets.io/*'];
        if (this.productService.extensionsGallery?.serviceUrl) {
            const serviceUrl = URI.parse(this.productService.extensionsGallery.serviceUrl);
            urls.push(`${serviceUrl.scheme}://${serviceUrl.authority}/*`);
        }
        this._win.webContents.session.webRequest.onBeforeSendHeaders({ urls }, async (details, cb) => {
            const headers = await this.getMarketplaceHeaders();
            cb({ cancel: false, requestHeaders: Object.assign(details.requestHeaders, headers) });
        });
    }
    getMarketplaceHeaders() {
        if (!this.marketplaceHeadersPromise) {
            this.marketplaceHeadersPromise = resolveMarketplaceHeaders(this.productService.version, this.productService, this.environmentMainService, this.configurationService, this.fileService, this.applicationStorageMainService, this.telemetryService);
        }
        return this.marketplaceHeadersPromise;
    }
    async onWindowError(type, details) {
        switch (type) {
            case 2 /* WindowError.PROCESS_GONE */:
                this.logService.error(`CodeWindow: renderer process gone (reason: ${details?.reason || '<unknown>'}, code: ${details?.exitCode || '<unknown>'})`);
                break;
            case 1 /* WindowError.UNRESPONSIVE */:
                this.logService.error('CodeWindow: detected unresponsive');
                break;
            case 4 /* WindowError.RESPONSIVE */:
                this.logService.error('CodeWindow: recovered from unresponsive');
                break;
            case 3 /* WindowError.LOAD */:
                this.logService.error(`CodeWindow: failed to load (reason: ${details?.reason || '<unknown>'}, code: ${details?.exitCode || '<unknown>'})`);
                break;
        }
        this.telemetryService.publicLog2('windowerror', {
            type,
            reason: details?.reason,
            code: details?.exitCode
        });
        // Inform User if non-recoverable
        switch (type) {
            case 1 /* WindowError.UNRESPONSIVE */:
            case 2 /* WindowError.PROCESS_GONE */:
                // If we run extension tests from CLI, we want to signal
                // back this state to the test runner by exiting with a
                // non-zero exit code.
                if (this.isExtensionDevelopmentTestFromCli) {
                    this.lifecycleMainService.kill(1);
                    return;
                }
                // If we run smoke tests, want to proceed with an orderly
                // shutdown as much as possible by destroying the window
                // and then calling the normal `quit` routine.
                if (this.environmentMainService.args['enable-smoke-test-driver']) {
                    await this.destroyWindow(false, false);
                    this.lifecycleMainService.quit(); // still allow for an orderly shutdown
                    return;
                }
                // Unresponsive
                if (type === 1 /* WindowError.UNRESPONSIVE */) {
                    if (this.isExtensionDevelopmentHost || this.isExtensionTestHost || (this._win && this._win.webContents && this._win.webContents.isDevToolsOpened())) {
                        // TODO@electron Workaround for https://github.com/microsoft/vscode/issues/56994
                        // In certain cases the window can report unresponsiveness because a breakpoint was hit
                        // and the process is stopped executing. The most typical cases are:
                        // - devtools are opened and debugging happens
                        // - window is an extensions development host that is being debugged
                        // - window is an extension test development host that is being debugged
                        return;
                    }
                    // Interrupt V8 and collect JavaScript stack
                    this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks());
                    // Stack collection will stop under any of the following conditions:
                    // - The window becomes responsive again
                    // - The window is destroyed i-e reopen or closed
                    // - sampling period is complete, default is 15s
                    this.jsCallStackCollectorStopScheduler.schedule();
                    // Show Dialog
                    const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
                        type: 'warning',
                        buttons: [
                            localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen"),
                            localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close"),
                            localize({ key: 'wait', comment: ['&& denotes a mnemonic'] }, "&&Keep Waiting")
                        ],
                        message: localize('appStalled', "The window is not responding"),
                        detail: localize('appStalledDetail', "You can reopen or close the window or keep waiting."),
                        checkboxLabel: this._config?.workspace ? localize('doNotRestoreEditors', "Don't restore editors") : undefined
                    }, this._win);
                    // Handle choice
                    if (response !== 2 /* keep waiting */) {
                        const reopen = response === 0;
                        this.stopCollectingJScallStacks();
                        await this.destroyWindow(reopen, checkboxChecked);
                    }
                }
                // Process gone
                else if (type === 2 /* WindowError.PROCESS_GONE */) {
                    let message;
                    if (!details) {
                        message = localize('appGone', "The window terminated unexpectedly");
                    }
                    else {
                        message = localize('appGoneDetails', "The window terminated unexpectedly (reason: '{0}', code: '{1}')", details.reason, details.exitCode ?? '<unknown>');
                    }
                    // Show Dialog
                    const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
                        type: 'warning',
                        buttons: [
                            this._config?.workspace ? localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen") : localize({ key: 'newWindow', comment: ['&& denotes a mnemonic'] }, "&&New Window"),
                            localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close")
                        ],
                        message,
                        detail: this._config?.workspace ?
                            localize('appGoneDetailWorkspace', "We are sorry for the inconvenience. You can reopen the window to continue where you left off.") :
                            localize('appGoneDetailEmptyWindow', "We are sorry for the inconvenience. You can open a new empty window to start again."),
                        checkboxLabel: this._config?.workspace ? localize('doNotRestoreEditors', "Don't restore editors") : undefined
                    }, this._win);
                    // Handle choice
                    const reopen = response === 0;
                    await this.destroyWindow(reopen, checkboxChecked);
                }
                break;
            case 4 /* WindowError.RESPONSIVE */:
                this.stopCollectingJScallStacks();
                break;
        }
    }
    async destroyWindow(reopen, skipRestoreEditors) {
        const workspace = this._config?.workspace;
        // check to discard editor state first
        if (skipRestoreEditors && workspace) {
            try {
                const workspaceStorage = this.storageMainService.workspaceStorage(workspace);
                await workspaceStorage.init();
                workspaceStorage.delete('memento/workbench.parts.editor');
                await workspaceStorage.close();
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        // 'close' event will not be fired on destroy(), so signal crash via explicit event
        this._onDidDestroy.fire();
        try {
            // ask the windows service to open a new fresh window if specified
            if (reopen && this._config) {
                // We have to reconstruct a openable from the current workspace
                let uriToOpen = undefined;
                let forceEmpty = undefined;
                if (isSingleFolderWorkspaceIdentifier(workspace)) {
                    uriToOpen = { folderUri: workspace.uri };
                }
                else if (isWorkspaceIdentifier(workspace)) {
                    uriToOpen = { workspaceUri: workspace.configPath };
                }
                else {
                    forceEmpty = true;
                }
                // Delegate to windows service
                const window = (await this.windowsMainService.open({
                    context: 5 /* OpenContext.API */,
                    userEnv: this._config.userEnv,
                    cli: {
                        ...this.environmentMainService.args,
                        _: [] // we pass in the workspace to open explicitly via `urisToOpen`
                    },
                    urisToOpen: uriToOpen ? [uriToOpen] : undefined,
                    forceEmpty,
                    forceNewWindow: true,
                    remoteAuthority: this.remoteAuthority
                })).at(0);
                window?.focus();
            }
        }
        finally {
            // make sure to destroy the window as its renderer process is gone. do this
            // after the code for reopening the window, to prevent the entire application
            // from quitting when the last window closes as a result.
            this._win?.destroy();
        }
    }
    onDidDeleteUntitledWorkspace(workspace) {
        // Make sure to update our workspace config if we detect that it
        // was deleted
        if (this._config?.workspace?.id === workspace.id) {
            this._config.workspace = undefined;
        }
    }
    onConfigurationUpdated(e) {
        // Menubar
        if (!e || e.affectsConfiguration("window.menuBarVisibility" /* MenuSettings.MenuBarVisibility */)) {
            const newMenuBarVisibility = this.getMenuBarVisibility();
            if (newMenuBarVisibility !== this.currentMenuBarVisibility) {
                this.currentMenuBarVisibility = newMenuBarVisibility;
                this.setMenuBarVisibility(newMenuBarVisibility);
            }
        }
        // Proxy
        if (!e || e.affectsConfiguration('http.proxy') || e.affectsConfiguration('http.noProxy')) {
            const inspect = this.configurationService.inspect('http.proxy');
            let newHttpProxy = (inspect.userLocalValue || '').trim()
                || (process.env['https_proxy'] || process.env['HTTPS_PROXY'] || process.env['http_proxy'] || process.env['HTTP_PROXY'] || '').trim() // Not standardized.
                || undefined;
            if (newHttpProxy?.indexOf('@') !== -1) {
                const uri = URI.parse(newHttpProxy);
                const i = uri.authority.indexOf('@');
                if (i !== -1) {
                    newHttpProxy = uri.with({ authority: uri.authority.substring(i + 1) })
                        .toString();
                }
            }
            if (newHttpProxy?.endsWith('/')) {
                newHttpProxy = newHttpProxy.substr(0, newHttpProxy.length - 1);
            }
            const newNoProxy = (this.configurationService.getValue('http.noProxy') || []).map((item) => item.trim()).join(',')
                || (process.env['no_proxy'] || process.env['NO_PROXY'] || '').trim() || undefined; // Not standardized.
            if ((newHttpProxy || '').indexOf('@') === -1 && (newHttpProxy !== this.currentHttpProxy || newNoProxy !== this.currentNoProxy)) {
                this.currentHttpProxy = newHttpProxy;
                this.currentNoProxy = newNoProxy;
                const proxyRules = newHttpProxy || '';
                const proxyBypassRules = newNoProxy ? `${newNoProxy},<local>` : '<local>';
                this.logService.trace(`Setting proxy to '${proxyRules}', bypassing '${proxyBypassRules}'`);
                this._win.webContents.session.setProxy({ proxyRules, proxyBypassRules, pacScript: '' });
                electron.app.setProxy({ proxyRules, proxyBypassRules, pacScript: '' });
            }
        }
    }
    addTabbedWindow(window) {
        if (isMacintosh && window.win) {
            this._win.addTabbedWindow(window.win);
        }
    }
    load(configuration, options = Object.create(null)) {
        this.logService.trace(`window#load: attempt to load window (id: ${this._id})`);
        // Clear Document Edited if needed
        if (this.isDocumentEdited()) {
            if (!options.isReload || !this.backupMainService.isHotExitEnabled()) {
                this.setDocumentEdited(false);
            }
        }
        // Clear Title and Filename if needed
        if (!options.isReload) {
            if (this.getRepresentedFilename()) {
                this.setRepresentedFilename('');
            }
            this._win.setTitle(this.productService.nameLong);
        }
        // Update configuration values based on our window context
        // and set it into the config object URL for usage.
        this.updateConfiguration(configuration, options);
        // If this is the first time the window is loaded, we associate the paths
        // directly with the window because we assume the loading will just work
        if (this.readyState === 0 /* ReadyState.NONE */) {
            this._config = configuration;
        }
        // Otherwise, the window is currently showing a folder and if there is an
        // unload handler preventing the load, we cannot just associate the paths
        // because the loading might be vetoed. Instead we associate it later when
        // the window load event has fired.
        else {
            this.pendingLoadConfig = configuration;
        }
        // Indicate we are navigting now
        this.readyState = 1 /* ReadyState.NAVIGATING */;
        // Load URL
        this._win.loadURL(FileAccess.asBrowserUri(`vs/code/electron-browser/workbench/workbench${this.environmentMainService.isBuilt ? '' : '-dev'}.html`).toString(true));
        // Remember that we did load
        const wasLoaded = this.wasLoaded;
        this.wasLoaded = true;
        // Make window visible if it did not open in N seconds because this indicates an error
        // Only do this when running out of sources and not when running tests
        if (!this.environmentMainService.isBuilt && !this.environmentMainService.extensionTestsLocationURI) {
            this._register(new RunOnceScheduler(() => {
                if (this._win && !this._win.isVisible() && !this._win.isMinimized()) {
                    this._win.show();
                    this.focus({ mode: 2 /* FocusMode.Force */ });
                    this._win.webContents.openDevTools();
                }
            }, 10000)).schedule();
        }
        // Event
        this._onWillLoad.fire({ workspace: configuration.workspace, reason: options.isReload ? 3 /* LoadReason.RELOAD */ : wasLoaded ? 2 /* LoadReason.LOAD */ : 1 /* LoadReason.INITIAL */ });
    }
    updateConfiguration(configuration, options) {
        // If this window was loaded before from the command line
        // (as indicated by VSCODE_CLI environment), make sure to
        // preserve that user environment in subsequent loads,
        // unless the new configuration context was also a CLI
        // (for https://github.com/microsoft/vscode/issues/108571)
        // Also, preserve the environment if we're loading from an
        // extension development host that had its environment set
        // (for https://github.com/microsoft/vscode/issues/123508)
        const currentUserEnv = (this._config ?? this.pendingLoadConfig)?.userEnv;
        if (currentUserEnv) {
            const shouldPreserveLaunchCliEnvironment = isLaunchedFromCli(currentUserEnv) && !isLaunchedFromCli(configuration.userEnv);
            const shouldPreserveDebugEnvironmnet = this.isExtensionDevelopmentHost;
            if (shouldPreserveLaunchCliEnvironment || shouldPreserveDebugEnvironmnet) {
                configuration.userEnv = { ...currentUserEnv, ...configuration.userEnv }; // still allow to override certain environment as passed in
            }
        }
        // If named pipe was instantiated for the crashpad_handler process, reuse the same
        // pipe for new app instances connecting to the original app instance.
        // Ref: https://github.com/microsoft/vscode/issues/115874
        if (process.env['CHROME_CRASHPAD_PIPE_NAME']) {
            Object.assign(configuration.userEnv, {
                CHROME_CRASHPAD_PIPE_NAME: process.env['CHROME_CRASHPAD_PIPE_NAME']
            });
        }
        // Add disable-extensions to the config, but do not preserve it on currentConfig or
        // pendingLoadConfig so that it is applied only on this load
        if (options.disableExtensions !== undefined) {
            configuration['disable-extensions'] = options.disableExtensions;
        }
        // Update window related properties
        try {
            configuration.handle = VSBuffer.wrap(this._win.getNativeWindowHandle());
        }
        catch (error) {
            this.logService.error(`Error getting native window handle: ${error}`);
        }
        configuration.fullscreen = this.isFullScreen;
        configuration.maximized = this._win.isMaximized();
        configuration.partsSplash = this.themeMainService.getWindowSplash(configuration.workspace);
        configuration.zoomLevel = this.getZoomLevel();
        configuration.isCustomZoomLevel = typeof this.customZoomLevel === 'number';
        if (configuration.isCustomZoomLevel && configuration.partsSplash) {
            configuration.partsSplash.zoomLevel = configuration.zoomLevel;
        }
        // Update with latest perf marks
        mark('code/willOpenNewWindow');
        configuration.perfMarks = getMarks();
        // Update in config object URL for usage in renderer
        this.configObjectUrl.update(configuration);
    }
    async reload(cli) {
        // Copy our current config for reuse
        const configuration = Object.assign({}, this._config);
        // Validate workspace
        configuration.workspace = await this.validateWorkspaceBeforeReload(configuration);
        // Delete some properties we do not want during reload
        delete configuration.filesToOpenOrCreate;
        delete configuration.filesToDiff;
        delete configuration.filesToMerge;
        delete configuration.filesToWait;
        // Some configuration things get inherited if the window is being reloaded and we are
        // in extension development mode. These options are all development related.
        if (this.isExtensionDevelopmentHost && cli) {
            configuration.verbose = cli.verbose;
            configuration.debugId = cli.debugId;
            configuration.extensionEnvironment = cli.extensionEnvironment;
            configuration['inspect-extensions'] = cli['inspect-extensions'];
            configuration['inspect-brk-extensions'] = cli['inspect-brk-extensions'];
            configuration['extensions-dir'] = cli['extensions-dir'];
        }
        configuration.accessibilitySupport = electron.app.isAccessibilitySupportEnabled();
        configuration.isInitialStartup = false; // since this is a reload
        configuration.policiesData = this.policyService.serialize(); // set policies data again
        configuration.continueOn = this.environmentMainService.continueOn;
        configuration.profiles = {
            all: this.userDataProfilesService.profiles,
            profile: this.profile || this.userDataProfilesService.defaultProfile,
            home: this.userDataProfilesService.profilesHome
        };
        configuration.logLevel = this.loggerMainService.getLogLevel();
        configuration.loggers = this.loggerMainService.getGlobalLoggers();
        // Load config
        this.load(configuration, { isReload: true, disableExtensions: cli?.['disable-extensions'] });
    }
    async validateWorkspaceBeforeReload(configuration) {
        // Multi folder
        if (isWorkspaceIdentifier(configuration.workspace)) {
            const configPath = configuration.workspace.configPath;
            if (configPath.scheme === Schemas.file) {
                const workspaceExists = await this.fileService.exists(configPath);
                if (!workspaceExists) {
                    return undefined;
                }
            }
        }
        // Single folder
        else if (isSingleFolderWorkspaceIdentifier(configuration.workspace)) {
            const uri = configuration.workspace.uri;
            if (uri.scheme === Schemas.file) {
                const folderExists = await this.fileService.exists(uri);
                if (!folderExists) {
                    return undefined;
                }
            }
        }
        // Workspace is valid
        return configuration.workspace;
    }
    serializeWindowState() {
        if (!this._win) {
            return defaultWindowState();
        }
        // fullscreen gets special treatment
        if (this.isFullScreen) {
            let display;
            try {
                display = electron.screen.getDisplayMatching(this.getBounds());
            }
            catch (error) {
                // Electron has weird conditions under which it throws errors
                // e.g. https://github.com/microsoft/vscode/issues/100334 when
                // large numbers are passed in
            }
            const defaultState = defaultWindowState();
            return {
                mode: 3 /* WindowMode.Fullscreen */,
                display: display ? display.id : undefined,
                // Still carry over window dimensions from previous sessions
                // if we can compute it in fullscreen state.
                // does not seem possible in all cases on Linux for example
                // (https://github.com/microsoft/vscode/issues/58218) so we
                // fallback to the defaults in that case.
                width: this.windowState.width || defaultState.width,
                height: this.windowState.height || defaultState.height,
                x: this.windowState.x || 0,
                y: this.windowState.y || 0,
                zoomLevel: this.customZoomLevel
            };
        }
        const state = Object.create(null);
        let mode;
        // get window mode
        if (!isMacintosh && this._win.isMaximized()) {
            mode = 0 /* WindowMode.Maximized */;
        }
        else {
            mode = 1 /* WindowMode.Normal */;
        }
        // we don't want to save minimized state, only maximized or normal
        if (mode === 0 /* WindowMode.Maximized */) {
            state.mode = 0 /* WindowMode.Maximized */;
        }
        else {
            state.mode = 1 /* WindowMode.Normal */;
        }
        // only consider non-minimized window states
        if (mode === 1 /* WindowMode.Normal */ || mode === 0 /* WindowMode.Maximized */) {
            let bounds;
            if (mode === 1 /* WindowMode.Normal */) {
                bounds = this.getBounds();
            }
            else {
                bounds = this._win.getNormalBounds(); // make sure to persist the normal bounds when maximized to be able to restore them
            }
            state.x = bounds.x;
            state.y = bounds.y;
            state.width = bounds.width;
            state.height = bounds.height;
        }
        state.zoomLevel = this.customZoomLevel;
        return state;
    }
    restoreWindowState(state) {
        mark('code/willRestoreCodeWindowState');
        let hasMultipleDisplays = false;
        if (state) {
            // Window zoom
            this.customZoomLevel = state.zoomLevel;
            // Window dimensions
            try {
                const displays = electron.screen.getAllDisplays();
                hasMultipleDisplays = displays.length > 1;
                state = WindowStateValidator.validateWindowState(this.logService, state, displays);
            }
            catch (err) {
                this.logService.warn(`Unexpected error validating window state: ${err}\n${err.stack}`); // somehow display API can be picky about the state to validate
            }
        }
        mark('code/didRestoreCodeWindowState');
        return [state || defaultWindowState(), hasMultipleDisplays];
    }
    getBounds() {
        const [x, y] = this._win.getPosition();
        const [width, height] = this._win.getSize();
        return { x, y, width, height };
    }
    setFullScreen(fullscreen, fromRestore) {
        super.setFullScreen(fullscreen, fromRestore);
        // Events
        this.sendWhenReady(fullscreen ? 'vscode:enterFullScreen' : 'vscode:leaveFullScreen', CancellationToken.None);
        // Respect configured menu bar visibility or default to toggle if not set
        if (this.currentMenuBarVisibility) {
            this.setMenuBarVisibility(this.currentMenuBarVisibility, false);
        }
    }
    getMenuBarVisibility() {
        let menuBarVisibility = getMenuBarVisibility(this.configurationService);
        if (['visible', 'toggle', 'hidden'].indexOf(menuBarVisibility) < 0) {
            menuBarVisibility = 'classic';
        }
        return menuBarVisibility;
    }
    setMenuBarVisibility(visibility, notify = true) {
        if (isMacintosh) {
            return; // ignore for macOS platform
        }
        if (visibility === 'toggle') {
            if (notify) {
                this.send('vscode:showInfoMessage', localize('hiddenMenuBar', "You can still access the menu bar by pressing the Alt-key."));
            }
        }
        if (visibility === 'hidden') {
            // for some weird reason that I have no explanation for, the menu bar is not hiding when calling
            // this without timeout (see https://github.com/microsoft/vscode/issues/19777). there seems to be
            // a timing issue with us opening the first window and the menu bar getting created. somehow the
            // fact that we want to hide the menu without being able to bring it back via Alt key makes Electron
            // still show the menu. Unable to reproduce from a simple Hello World application though...
            setTimeout(() => {
                this.doSetMenuBarVisibility(visibility);
            });
        }
        else {
            this.doSetMenuBarVisibility(visibility);
        }
    }
    doSetMenuBarVisibility(visibility) {
        const isFullscreen = this.isFullScreen;
        switch (visibility) {
            case ('classic'):
                this._win.setMenuBarVisibility(!isFullscreen);
                this._win.autoHideMenuBar = isFullscreen;
                break;
            case ('visible'):
                this._win.setMenuBarVisibility(true);
                this._win.autoHideMenuBar = false;
                break;
            case ('toggle'):
                this._win.setMenuBarVisibility(false);
                this._win.autoHideMenuBar = true;
                break;
            case ('hidden'):
                this._win.setMenuBarVisibility(false);
                this._win.autoHideMenuBar = false;
                break;
        }
    }
    notifyZoomLevel(zoomLevel) {
        this.customZoomLevel = zoomLevel;
    }
    getZoomLevel() {
        if (typeof this.customZoomLevel === 'number') {
            return this.customZoomLevel;
        }
        const windowSettings = this.configurationService.getValue('window');
        return windowSettings?.zoomLevel;
    }
    close() {
        this._win?.close();
    }
    sendWhenReady(channel, token, ...args) {
        if (this.isReady) {
            this.send(channel, ...args);
        }
        else {
            this.ready().then(() => {
                if (!token.isCancellationRequested) {
                    this.send(channel, ...args);
                }
            });
        }
    }
    send(channel, ...args) {
        if (this._win) {
            if (this._win.isDestroyed() || this._win.webContents.isDestroyed()) {
                this.logService.warn(`Sending IPC message to channel '${channel}' for window that is destroyed`);
                return;
            }
            try {
                this._win.webContents.send(channel, ...args);
            }
            catch (error) {
                this.logService.warn(`Error sending IPC message to channel '${channel}' of window ${this._id}: ${toErrorMessage(error)}`);
            }
        }
    }
    updateTouchBar(groups) {
        if (!isMacintosh) {
            return; // only supported on macOS
        }
        // Update segments for all groups. Setting the segments property
        // of the group directly prevents ugly flickering from happening
        this.touchBarGroups.forEach((touchBarGroup, index) => {
            const commands = groups[index];
            touchBarGroup.segments = this.createTouchBarGroupSegments(commands);
        });
    }
    createTouchBar() {
        if (!isMacintosh) {
            return; // only supported on macOS
        }
        // To avoid flickering, we try to reuse the touch bar group
        // as much as possible by creating a large number of groups
        // for reusing later.
        for (let i = 0; i < 10; i++) {
            const groupTouchBar = this.createTouchBarGroup();
            this.touchBarGroups.push(groupTouchBar);
        }
        this._win.setTouchBar(new electron.TouchBar({ items: this.touchBarGroups }));
    }
    createTouchBarGroup(items = []) {
        // Group Segments
        const segments = this.createTouchBarGroupSegments(items);
        // Group Control
        const control = new electron.TouchBar.TouchBarSegmentedControl({
            segments,
            mode: 'buttons',
            segmentStyle: 'automatic',
            change: (selectedIndex) => {
                this.sendWhenReady('vscode:runAction', CancellationToken.None, { id: control.segments[selectedIndex].id, from: 'touchbar' });
            }
        });
        return control;
    }
    createTouchBarGroupSegments(items = []) {
        const segments = items.map(item => {
            let icon;
            if (item.icon && !ThemeIcon.isThemeIcon(item.icon) && item.icon?.dark?.scheme === Schemas.file) {
                icon = electron.nativeImage.createFromPath(URI.revive(item.icon.dark).fsPath);
                if (icon.isEmpty()) {
                    icon = undefined;
                }
            }
            let title;
            if (typeof item.title === 'string') {
                title = item.title;
            }
            else {
                title = item.title.value;
            }
            return {
                id: item.id,
                label: !icon ? title : undefined,
                icon
            };
        });
        return segments;
    }
    async startCollectingJScallStacks() {
        if (!this.jsCallStackCollector.isTriggered()) {
            const stack = await this._win.webContents.mainFrame.collectJavaScriptCallStack();
            // Increment the count for this stack trace
            if (stack) {
                const count = this.jsCallStackMap.get(stack) || 0;
                this.jsCallStackMap.set(stack, count + 1);
            }
            this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks());
        }
    }
    stopCollectingJScallStacks() {
        this.jsCallStackCollectorStopScheduler.cancel();
        this.jsCallStackCollector.cancel();
        if (this.jsCallStackMap.size) {
            let logMessage = `CodeWindow unresponsive samples:\n`;
            let samples = 0;
            const sortedEntries = Array.from(this.jsCallStackMap.entries())
                .sort((a, b) => b[1] - a[1]);
            for (const [stack, count] of sortedEntries) {
                samples += count;
                // If the stack appears more than 20 percent of the time, log it
                // to the error telemetry as UnresponsiveSampleError.
                if (Math.round((count * 100) / this.jsCallStackEffectiveSampleCount) > 20) {
                    const fakeError = new UnresponsiveError(stack, this.id, this.win?.webContents.getOSProcessId());
                    errorHandler.onUnexpectedError(fakeError);
                }
                logMessage += `<${count}> ${stack}\n`;
            }
            logMessage += `Total Samples: ${samples}\n`;
            logMessage += 'For full overview of the unresponsive period, capture cpu profile via https://aka.ms/vscode-tracing-cpu-profile';
            this.logService.error(logMessage);
        }
        this.jsCallStackMap.clear();
    }
    matches(webContents) {
        return this._win?.webContents.id === webContents.id;
    }
    dispose() {
        super.dispose();
        // Deregister the loggers for this window
        this.loggerMainService.deregisterLoggers(this.id);
    }
};
CodeWindow = __decorate([
    __param(1, ILogService),
    __param(2, ILoggerMainService),
    __param(3, IEnvironmentMainService),
    __param(4, IPolicyService),
    __param(5, IUserDataProfilesMainService),
    __param(6, IFileService),
    __param(7, IApplicationStorageMainService),
    __param(8, IStorageMainService),
    __param(9, IConfigurationService),
    __param(10, IThemeMainService),
    __param(11, IWorkspacesManagementMainService),
    __param(12, IBackupMainService),
    __param(13, ITelemetryService),
    __param(14, IDialogMainService),
    __param(15, ILifecycleMainService),
    __param(16, IProductService),
    __param(17, IProtocolMainService),
    __param(18, IWindowsMainService),
    __param(19, IStateService),
    __param(20, IInstantiationService)
], CodeWindow);
export { CodeWindow };
class UnresponsiveError extends Error {
    constructor(sample, windowId, pid = 0) {
        // Since the stacks are available via the sample
        // we can avoid collecting them when constructing the error.
        const stackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 0;
        super(`UnresponsiveSampleError: from window with ID ${windowId} belonging to process with pid ${pid}`);
        Error.stackTraceLimit = stackTraceLimit;
        this.name = 'UnresponsiveSampleError';
        this.stack = sample;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93SW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vd2luZG93cy9lbGVjdHJvbi1tYWluL3dpbmRvd0ltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxRQUFRLEVBQUUsRUFBNEMsTUFBTSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3BHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLElBQUksQ0FBQztBQUU3QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMxRSxPQUFPLEVBQTZCLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDL0csT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFdEYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDcEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDekUsT0FBTyxFQUFpQixvQkFBb0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQy9GLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUNsRixPQUFPLEVBQUUsb0JBQW9CLEVBQW1HLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLHdCQUF3QixFQUFFLDhCQUE4QixFQUErQixNQUFNLCtCQUErQixDQUFDO0FBQ3JTLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSwrQkFBK0IsRUFBRSxtQkFBbUIsRUFBZSxvQkFBb0IsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNwSixPQUFPLEVBQTBELGlDQUFpQyxFQUFFLHFCQUFxQixFQUFFLHFCQUFxQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUwsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDckgsT0FBTyxFQUE4RSxrQkFBa0IsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25LLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUUvRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDMUQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDdEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDOUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQWtCOUQsSUFBVyxVQW9CVjtBQXBCRCxXQUFXLFVBQVU7SUFFcEI7Ozs7T0FJRztJQUNILDJDQUFJLENBQUE7SUFFSjs7O09BR0c7SUFDSCx1REFBVSxDQUFBO0lBRVY7OztPQUdHO0lBQ0gsNkNBQUssQ0FBQTtBQUNOLENBQUMsRUFwQlUsVUFBVSxLQUFWLFVBQVUsUUFvQnBCO0FBRUQsTUFBTSxPQUFnQixVQUFXLFNBQVEsVUFBVTtJQThCbEQsSUFBSSxhQUFhLEtBQWEsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUszRCxJQUFJLEdBQUcsS0FBSyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JCLE1BQU0sQ0FBQyxHQUEyQixFQUFFLE9BQXlDO1FBQ3RGLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO1FBRWhCLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsR0FBRyxFQUFFO1lBQy9ELElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3BGLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDdkMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUU1QyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsRUFBRSxJQUFJLDhCQUFzQixFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNoRixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsSUFBSSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDdEcsQ0FBQztZQUVELElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsQ0FBQyxHQUFHLEVBQUU7WUFDakUsSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLHNCQUFzQixDQUFDLHdCQUF3QixJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO2dCQUNwRyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsU0FBUyxDQUFDO2dCQUV0QyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsSUFBSSxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDcEUsQ0FBQztZQUVELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEdBQUcsRUFBRTtZQUM3RCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO1lBRXhCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRTtZQUM1RCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNsQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDcEgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDcEgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRSxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFL0ssZ0JBQWdCO1FBQ2hCLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsT0FBTyxFQUFFLGFBQWEsS0FBSyxRQUFRLENBQUMsQ0FBQyxxQ0FBc0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNoSyxJQUFJLFdBQVcsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1lBQ3hDLEdBQUcsQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzRUFBc0U7UUFDakksQ0FBQztRQUVELDJFQUEyRTtRQUMzRSxJQUFJLG1CQUFtQixJQUFJLHdCQUF3QixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7WUFDaEYsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBUyxDQUFDLFVBQVUsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDLENBQUM7WUFDckgsSUFBSSx5QkFBeUIsRUFBRSxDQUFDO2dCQUMvQixJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUUsQ0FBQyxDQUFDO1lBQ2xFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxNQUFNLEVBQUUsOEJBQThCLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7UUFDRixDQUFDO1FBRUQsa0ZBQWtGO1FBQ2xGLElBQUksQ0FBQyxTQUFTLElBQUksT0FBTyxDQUFDLElBQUksbUJBQW1CLEVBQUUsQ0FBQztZQUNuRCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxLQUFxQixFQUFFLEtBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUMvSSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzVELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDdkMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUV2QyxnR0FBZ0c7Z0JBQ2hHLHdEQUF3RDtnQkFDeEQsSUFBSSxPQUFPLEVBQUUsQ0FBQztvQkFDYixJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsNENBQTRDLEVBQUUsQ0FBQzt3QkFDMUQsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFFekIsSUFBSSxDQUFDLDhCQUE4QixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzVELENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQscURBQXFEO1FBQ3JELElBQUksSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNoRSxHQUFHLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2hDLENBQUM7UUFFRCx1Q0FBdUM7UUFDdkMsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUU7Z0JBQzdDLElBQUksQ0FBQyw4QkFBOEIsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckQsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRTtnQkFDN0MsSUFBSSxDQUFDLDhCQUE4QixFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ3ZFLDBFQUEwRTtZQUMxRSx3RkFBd0Y7WUFDeEYseURBQXlEO1lBQ3pELElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxlQUFlLEVBQUUsQ0FBQyxLQUFxQixFQUFFLE9BQWdCLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQzNJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2hDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0YsQ0FBQztJQUVPLGNBQWMsQ0FBQyxPQUFnQjtRQUN0QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUM7UUFDeEMsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxvQkFBb0IsQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM3RixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsSUFBSSxDQUFDLEVBQUUsc0NBQXNDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFeEcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUIsQ0FBQztJQUNGLENBQUM7SUFFRCxZQUNvQixvQkFBMkMsRUFDM0MsWUFBMkIsRUFDM0Isc0JBQStDLEVBQy9DLFVBQXVCO1FBRTFDLEtBQUssRUFBRSxDQUFDO1FBTFcseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUMzQyxpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUMzQiwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXlCO1FBQy9DLGVBQVUsR0FBVixVQUFVLENBQWE7UUFqSjNDLGdCQUFnQjtRQUVDLGdCQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDMUQsZUFBVSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDO1FBRTVCLG1CQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDN0Qsa0JBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztRQUVsQyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUMvRCxvQkFBZSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7UUFFdEMsbUNBQThCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBNEIsQ0FBQyxDQUFDO1FBQ2pHLGtDQUE2QixHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxLQUFLLENBQUM7UUFFbEUsMEJBQXFCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDcEUseUJBQW9CLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQztRQUVoRCwwQkFBcUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNwRSx5QkFBb0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDO1FBRWhELDRCQUF1QixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVcsQ0FBQyxDQUFDO1FBQ3pFLDJCQUFzQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUM7UUFNM0QsbUJBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxtREFBbUQ7UUFLaEYsU0FBSSxHQUFrQyxJQUFJLENBQUM7UUFtUnJELFlBQVk7UUFFWixvQkFBb0I7UUFFWixnQ0FBMkIsR0FBd0IsU0FBUyxDQUFDO1FBQzdELG1DQUE4QixHQUF5QyxTQUFTLENBQUM7SUFwS3pGLENBQUM7SUFFUyxVQUFVLENBQUMsS0FBbUIsRUFBRSxtQkFBbUIsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBRTFHLG9HQUFvRztRQUNwRyxnR0FBZ0c7UUFDaEcsOEZBQThGO1FBQzlGLEVBQUU7UUFDRiwrRkFBK0Y7UUFDL0YsRUFBRTtRQUNGLDZGQUE2RjtRQUM3RixnR0FBZ0c7UUFDaEcscUhBQXFIO1FBRXJILE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQThCLFFBQVEsQ0FBQyxDQUFDO1FBQ2pHLE1BQU0sYUFBYSxHQUFHLFdBQVcsSUFBSSxjQUFjLEVBQUUsVUFBVSxLQUFLLElBQUksQ0FBQztRQUN6RSxJQUFJLENBQUMsV0FBVyxJQUFJLFNBQVMsQ0FBQyxJQUFJLG1CQUFtQixJQUFJLENBQUMsQ0FBQyxhQUFhLElBQUksK0JBQStCLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUM3SCxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQzdGLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDO29CQUNwQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7b0JBQ2xCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtvQkFDcEIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUNWLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztpQkFDVixDQUFDLENBQUM7WUFDSixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLElBQUksaUNBQXlCLElBQUksS0FBSyxDQUFDLElBQUksa0NBQTBCLEVBQUUsQ0FBQztZQUVqRixvREFBb0Q7WUFDcEQsdURBQXVEO1lBQ3ZELHFEQUFxRDtZQUNyRCwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQztZQUV0QixJQUFJLEtBQUssQ0FBQyxJQUFJLGtDQUEwQixFQUFFLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hDLENBQUM7WUFFRCxpREFBaUQ7WUFDakQsZ0RBQWdEO1lBQ2hELElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDbkIsQ0FBQztJQUNGLENBQUM7SUFJRCxzQkFBc0IsQ0FBQyxRQUFnQjtRQUN0QyxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxHQUFHLEVBQUUsc0JBQXNCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUMsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsUUFBUSxDQUFDO1FBQ3JDLENBQUM7SUFDRixDQUFDO0lBRUQsc0JBQXNCO1FBQ3JCLElBQUksV0FBVyxFQUFFLENBQUM7WUFDakIsT0FBTyxJQUFJLENBQUMsR0FBRyxFQUFFLHNCQUFzQixFQUFFLENBQUM7UUFDM0MsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDO0lBQ2pDLENBQUM7SUFJRCxpQkFBaUIsQ0FBQyxNQUFlO1FBQ2hDLElBQUksV0FBVyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBRUQsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7SUFDOUIsQ0FBQztJQUVELGdCQUFnQjtRQUNmLElBQUksV0FBVyxFQUFFLENBQUM7WUFDakIsT0FBTyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDOUIsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUE2QjtRQUNsQyxRQUFRLE9BQU8sRUFBRSxJQUFJLDhCQUFzQixFQUFFLENBQUM7WUFDN0M7Z0JBQ0MsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNyQixNQUFNO1lBRVA7Z0JBQ0MsSUFBSSxXQUFXLEVBQUUsQ0FBQztvQkFDakIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM1QyxDQUFDO3FCQUFNLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ3RCLG1FQUFtRTtvQkFDbkUsbURBQW1EO29CQUNuRCxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDO2dCQUNuQixDQUFDO2dCQUNELE1BQU07WUFFUDtnQkFDQyxJQUFJLFdBQVcsRUFBRSxDQUFDO29CQUNqQixRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO2dCQUNELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDckIsTUFBTTtRQUNSLENBQUM7SUFDRixDQUFDO0lBRU8sYUFBYTtRQUNwQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNWLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxHQUFHLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUN2QixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixDQUFDO1FBRUQsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUVELGlDQUFpQzthQUVULHVDQUFrQyxHQUFHLHFCQUFxQixBQUF4QixDQUF5QjtJQUVuRixvQkFBb0IsQ0FBQyxPQUFnRjtRQUNwRyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNWLE9BQU87UUFDUixDQUFDO1FBRUQsaURBQWlEO1FBQ2pELElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLGtDQUFrQyxDQUFDLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVGLENBQUM7UUFFRCxpRUFBaUU7UUFDakUsSUFBSSxDQUFDLFdBQVcsSUFBSSx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO1lBQ3pFLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztnQkFDdEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxlQUFlLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlO2dCQUNuRixXQUFXLEVBQUUsT0FBTyxDQUFDLGVBQWUsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWU7Z0JBQ3pGLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLDRCQUE0QjthQUNwRixDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsOERBQThEO2FBQ3pELElBQUksV0FBVyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDdEQsd0VBQXdFO1lBQ3hFLDBFQUEwRTtZQUMxRSx1RUFBdUU7WUFDdkUseUVBQXlFO1lBQ3pFLHVFQUF1RTtZQUN2RSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2IsR0FBRyxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25DLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxHQUFHLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUMzRCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFTRCxnQkFBZ0I7UUFDZixJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRVMsYUFBYSxDQUFDLFVBQW1CLEVBQUUsV0FBb0I7UUFFaEUsdUJBQXVCO1FBQ3ZCLElBQUksbUJBQW1CLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztZQUNwRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ25ELENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7SUFDRixDQUFDO0lBRUQsSUFBSSxZQUFZO1FBQ2YsSUFBSSxXQUFXLElBQUksT0FBTyxJQUFJLENBQUMsMkJBQTJCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDMUUsT0FBTyxJQUFJLENBQUMsMkJBQTJCLENBQUM7UUFDekMsQ0FBQztRQUVELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7UUFDckIsTUFBTSxZQUFZLEdBQUcsR0FBRyxFQUFFLFlBQVksRUFBRSxDQUFDO1FBQ3pDLE1BQU0sa0JBQWtCLEdBQUcsR0FBRyxFQUFFLGtCQUFrQixFQUFFLENBQUM7UUFFckQsT0FBTyxPQUFPLENBQUMsWUFBWSxJQUFJLGtCQUFrQixDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFVBQW1CLEVBQUUsV0FBb0I7UUFDcEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNyQixJQUFJLEdBQUcsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLENBQUM7WUFDL0IsR0FBRyxFQUFFLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFFRCxJQUFJLENBQUMscUJBQXFCLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxVQUFtQixFQUFFLFdBQW9CO1FBQ3RFLElBQUksV0FBVyxFQUFFLENBQUM7WUFFakIsMEVBQTBFO1lBQzFFLDBFQUEwRTtZQUMxRSx5RUFBeUU7WUFDekUsNkNBQTZDO1lBQzdDLDBEQUEwRDtZQUUxRCxJQUFJLENBQUMsMkJBQTJCLEdBQUcsVUFBVSxDQUFDO1lBRTlDLE1BQU0sOEJBQThCLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixHQUFHLElBQUksZUFBZSxFQUFXLENBQUM7WUFDNUcsQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDWCxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQ3ZDLDhCQUE4QixDQUFDLENBQUM7b0JBQ2hDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDO2lCQUNoQyxDQUFDLENBQUM7Z0JBRUgsSUFBSSxJQUFJLENBQUMsOEJBQThCLEtBQUssOEJBQThCLEVBQUUsQ0FBQztvQkFDNUUsT0FBTyxDQUFDLHlDQUF5QztnQkFDbEQsQ0FBQztnQkFFRCxJQUFJLENBQUMsMkJBQTJCLEdBQUcsU0FBUyxDQUFDO2dCQUM3QyxJQUFJLENBQUMsOEJBQThCLEdBQUcsU0FBUyxDQUFDO2dCQUVoRCx1RUFBdUU7Z0JBQ3ZFLG9FQUFvRTtnQkFDcEUsd0VBQXdFO2dCQUN4RSxzRUFBc0U7Z0JBQ3RFLHdFQUF3RTtnQkFDeEUsK0VBQStFO2dCQUUvRSxJQUFJLENBQUMsWUFBWSxJQUFJLFVBQVUsSUFBSSxXQUFXLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQztvQkFFeEYscUVBQXFFO29CQUNyRSx5RUFBeUU7b0JBQ3pFLHNFQUFzRTtvQkFDdEUsd0VBQXdFO29CQUN4RSxnREFBZ0Q7b0JBQ2hELEVBQUU7b0JBQ0Ysc0VBQXNFO29CQUN0RSxpREFBaUQ7b0JBRWpELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHFGQUFxRixDQUFDLENBQUM7b0JBRTVHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDbkMsQ0FBQztZQUNGLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDTixDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNyQixHQUFHLEVBQUUsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxVQUFtQjtRQUM5QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQ3JCLElBQUksR0FBRyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsR0FBRyxFQUFFLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JDLEdBQUcsRUFBRSxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyx3REFBd0Q7SUFDbkYsQ0FBQztJQU1RLE9BQU87UUFDZixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFaEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFLLENBQUMsQ0FBQyw2REFBNkQ7SUFDakYsQ0FBQzs7QUFHSyxJQUFNLFVBQVUsR0FBaEIsTUFBTSxVQUFXLFNBQVEsVUFBVTtJQW1CekMsSUFBSSxFQUFFLEtBQWEsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUlyQyxJQUFJLFVBQVUsS0FBeUIsT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFekUsSUFBSSxlQUFlLEtBQTBFLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBRTlILElBQUksT0FBTztRQUNWLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdkgsSUFBSSxJQUFJLENBQUMsMEJBQTBCLElBQUksT0FBTyxFQUFFLENBQUM7WUFDaEQsT0FBTyxPQUFPLENBQUM7UUFDaEIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLHVCQUF1QixDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLHFCQUFxQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsY0FBYyxDQUFDO0lBQzdNLENBQUM7SUFFRCxJQUFJLGVBQWUsS0FBeUIsT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFHbkYsSUFBSSxNQUFNLEtBQTZDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFN0UsSUFBSSwwQkFBMEIsS0FBYyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFaEcsSUFBSSxtQkFBbUIsS0FBYyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFbkYsSUFBSSxpQ0FBaUMsS0FBYyxPQUFPLElBQUksQ0FBQywwQkFBMEIsSUFBSSxJQUFJLENBQUMsbUJBQW1CLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUF5QmxKLFlBQ0MsTUFBOEIsRUFDakIsVUFBdUIsRUFDaEIsaUJBQXNELEVBQ2pELHNCQUErQyxFQUN4RCxhQUE4QyxFQUNoQyx1QkFBc0UsRUFDdEYsV0FBMEMsRUFDeEIsNkJBQThFLEVBQ3pGLGtCQUF3RCxFQUN0RCxvQkFBMkMsRUFDL0MsZ0JBQW9ELEVBQ3JDLCtCQUFrRixFQUNoRyxpQkFBc0QsRUFDdkQsZ0JBQW9ELEVBQ25ELGlCQUFzRCxFQUNuRCxvQkFBNEQsRUFDbEUsY0FBZ0QsRUFDM0MsbUJBQXlDLEVBQzFDLGtCQUF3RCxFQUM5RCxZQUEyQixFQUNuQixvQkFBMkM7UUFFbEUsS0FBSyxDQUFDLG9CQUFvQixFQUFFLFlBQVksRUFBRSxzQkFBc0IsRUFBRSxVQUFVLENBQUMsQ0FBQztRQXBCekMsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQUV6QyxrQkFBYSxHQUFiLGFBQWEsQ0FBZ0I7UUFDZiw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQThCO1FBQ3JFLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ1Asa0NBQTZCLEdBQTdCLDZCQUE2QixDQUFnQztRQUN4RSx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBRXpDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDcEIsb0NBQStCLEdBQS9CLCtCQUErQixDQUFrQztRQUMvRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQ3RDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDbEMsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQUNsQyx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ2pELG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUUzQix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBM0Y5RSxnQkFBZ0I7UUFFQyxnQkFBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQWMsQ0FBQyxDQUFDO1FBQ2hFLGVBQVUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztRQUU1QixzQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNoRSxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDO1FBRXhDLGtCQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDNUQsaUJBQVksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztRQTZDaEMsdUJBQWtCLEdBQXNDLEVBQUUsQ0FBQztRQUUzRCxtQkFBYyxHQUF3QyxFQUFFLENBQUM7UUFFbEUscUJBQWdCLEdBQXVCLFNBQVMsQ0FBQztRQUNqRCxtQkFBYyxHQUF1QixTQUFTLENBQUM7UUFFL0Msb0JBQWUsR0FBdUIsU0FBUyxDQUFDO1FBSWhELGNBQVMsR0FBRyxLQUFLLENBQUM7UUEyRmxCLGVBQVUsMkJBQW1CO1FBM0RwQywrQkFBK0I7UUFDL0IsQ0FBQztZQUNBLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxrQkFBa0IsRUFBOEIsQ0FBQyxDQUFDO1lBRTVHLG9CQUFvQjtZQUNwQixNQUFNLENBQUMsS0FBSyxFQUFFLG1CQUFtQixDQUFDLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMzRSxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztZQUN6QixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUVoRSxNQUFNLE9BQU8sR0FBRyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUU7Z0JBQzdHLE9BQU8sRUFBRSxVQUFVLENBQUMsU0FBUyxDQUFDLG1EQUFtRCxDQUFDLENBQUMsTUFBTTtnQkFDekYsbUJBQW1CLEVBQUUsQ0FBQywwQkFBMEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztnQkFDM0YsY0FBYyxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxNQUFNO2FBQ3JGLENBQUMsQ0FBQztZQUVILDRCQUE0QjtZQUM1QixJQUFJLENBQUMsa0NBQWtDLENBQUMsQ0FBQztZQUN6QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUV4QyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUVoQyx5Q0FBeUM7WUFDekMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFFdkQsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxpRUFBaUU7UUFDcEcsQ0FBQztRQUNELFlBQVk7UUFFWixnQ0FBZ0M7UUFFaEMsSUFBSSxjQUFjLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQztRQUMxRyxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZHLElBQUksY0FBYyxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxJQUFJLGNBQWMsR0FBRyxZQUFZLEVBQUUsQ0FBQztZQUMvRSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyx5Q0FBeUMsY0FBYyxrQkFBa0IsWUFBWSxzQkFBc0IsQ0FBQyxDQUFDO1lBQ2xJLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDdEIsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUN0QixDQUFDO1FBRUQsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUNoRCxJQUFJLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsY0FBYyxDQUFDLENBQUM7UUFDakYsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQU8sY0FBYyxDQUFDLENBQUMsQ0FBQztRQUM5RSxJQUFJLENBQUMsaUNBQWlDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLEdBQUcsRUFBRTtZQUNqRixJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDLGdDQUFnQztRQUNwRSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUVsQixZQUFZO1FBRVoseUNBQXlDO1FBQ3pDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBRTlCLDJCQUEyQjtRQUMzQixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFdEIsV0FBVztRQUNYLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFJRCxRQUFRO1FBQ1AsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsMkNBQTJDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBRTlFLElBQUksQ0FBQyxVQUFVLDJCQUFtQixDQUFDO1FBRW5DLG9EQUFvRDtRQUNwRCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELFNBQVM7UUFDVCxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVELEtBQUs7UUFDSixPQUFPLElBQUksT0FBTyxDQUFjLE9BQU8sQ0FBQyxFQUFFO1lBQ3pDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsQixPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QixDQUFDO1lBRUQsa0RBQWtEO1lBQ2xELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1YsT0FBTyxJQUFJLENBQUMsVUFBVSw2QkFBcUIsQ0FBQztJQUM3QyxDQUFDO0lBRUQsSUFBSSxrQkFBa0I7UUFDckIsT0FBTyxJQUFJLE9BQU8sQ0FBTyxPQUFPLENBQUMsRUFBRTtZQUVsQyxTQUFTLE1BQU07Z0JBQ2QsYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN4QixZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBRXZCLE9BQU8sRUFBRSxDQUFDO1lBQ1gsQ0FBQztZQUVELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUN0RCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDdEQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8saUJBQWlCO1FBRXhCLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLGtDQUEwQixDQUFDLENBQUMsQ0FBQztRQUMxSCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLGdDQUF3QixDQUFDLENBQUMsQ0FBQztRQUN0SCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsbUNBQTJCLEVBQUUsR0FBRyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvTCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsMkJBQW1CLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlOLG1EQUFtRDtRQUNuRCxnREFBZ0Q7UUFDaEQsaURBQWlEO1FBQ2pELG9CQUFvQjtRQUNwQixzREFBc0Q7UUFDdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQWlCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLHFCQUFxQixDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTFJLDBCQUEwQjtRQUMxQixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsRUFBRTtZQUV4Rix5REFBeUQ7WUFDekQsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUM7Z0JBRXRDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxTQUFTLENBQUM7WUFDcEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRTtZQUN0QyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQy9CLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRTtZQUN4QyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ2hDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRTtZQUM3QyxJQUFJLENBQUMsYUFBYSxDQUFDLHdCQUF3QixFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUU7WUFDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosK0JBQStCO1FBQy9CLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV4RywwQkFBMEI7UUFDMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsK0JBQStCLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTdILDRDQUE0QztRQUM1QyxNQUFNLElBQUksR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDekMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxDQUFDO1lBQ3ZELE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMvRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sTUFBTSxVQUFVLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUU7WUFDNUYsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUVuRCxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUdPLHFCQUFxQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7WUFDckMsSUFBSSxDQUFDLHlCQUF5QixHQUFHLHlCQUF5QixDQUN6RCxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFDM0IsSUFBSSxDQUFDLGNBQWMsRUFDbkIsSUFBSSxDQUFDLHNCQUFzQixFQUMzQixJQUFJLENBQUMsb0JBQW9CLEVBQ3pCLElBQUksQ0FBQyxXQUFXLEVBQ2hCLElBQUksQ0FBQyw2QkFBNkIsRUFDbEMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDekIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLHlCQUF5QixDQUFDO0lBQ3ZDLENBQUM7SUFNTyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQWlCLEVBQUUsT0FBZ0Q7UUFFOUYsUUFBUSxJQUFJLEVBQUUsQ0FBQztZQUNkO2dCQUNDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDhDQUE4QyxPQUFPLEVBQUUsTUFBTSxJQUFJLFdBQVcsV0FBVyxPQUFPLEVBQUUsUUFBUSxJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7Z0JBQ2xKLE1BQU07WUFDUDtnQkFDQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO2dCQUMzRCxNQUFNO1lBQ1A7Z0JBQ0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMseUNBQXlDLENBQUMsQ0FBQztnQkFDakUsTUFBTTtZQUNQO2dCQUNDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxPQUFPLEVBQUUsTUFBTSxJQUFJLFdBQVcsV0FBVyxPQUFPLEVBQUUsUUFBUSxJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7Z0JBQzNJLE1BQU07UUFDUixDQUFDO1FBZUQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBOEMsYUFBYSxFQUFFO1lBQzVGLElBQUk7WUFDSixNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU07WUFDdkIsSUFBSSxFQUFFLE9BQU8sRUFBRSxRQUFRO1NBQ3ZCLENBQUMsQ0FBQztRQUVILGlDQUFpQztRQUNqQyxRQUFRLElBQUksRUFBRSxDQUFDO1lBQ2Qsc0NBQThCO1lBQzlCO2dCQUVDLHdEQUF3RDtnQkFDeEQsdURBQXVEO2dCQUN2RCxzQkFBc0I7Z0JBQ3RCLElBQUksSUFBSSxDQUFDLGlDQUFpQyxFQUFFLENBQUM7b0JBQzVDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2xDLE9BQU87Z0JBQ1IsQ0FBQztnQkFFRCx5REFBeUQ7Z0JBQ3pELHdEQUF3RDtnQkFDeEQsOENBQThDO2dCQUM5QyxJQUFJLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDO29CQUNsRSxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUN2QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxzQ0FBc0M7b0JBQ3hFLE9BQU87Z0JBQ1IsQ0FBQztnQkFFRCxlQUFlO2dCQUNmLElBQUksSUFBSSxxQ0FBNkIsRUFBRSxDQUFDO29CQUN2QyxJQUFJLElBQUksQ0FBQywwQkFBMEIsSUFBSSxJQUFJLENBQUMsbUJBQW1CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixFQUFFLENBQUMsRUFBRSxDQUFDO3dCQUNySixnRkFBZ0Y7d0JBQ2hGLHVGQUF1Rjt3QkFDdkYsb0VBQW9FO3dCQUNwRSw4Q0FBOEM7d0JBQzlDLG9FQUFvRTt3QkFDcEUsd0VBQXdFO3dCQUN4RSxPQUFPO29CQUNSLENBQUM7b0JBRUQsNENBQTRDO29CQUM1QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7b0JBQzVFLG9FQUFvRTtvQkFDcEUsd0NBQXdDO29CQUN4QyxpREFBaUQ7b0JBQ2pELGdEQUFnRDtvQkFDaEQsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUVsRCxjQUFjO29CQUNkLE1BQU0sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDO3dCQUNqRixJQUFJLEVBQUUsU0FBUzt3QkFDZixPQUFPLEVBQUU7NEJBQ1IsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDOzRCQUMzRSxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUM7NEJBQ3pFLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLGdCQUFnQixDQUFDO3lCQUMvRTt3QkFDRCxPQUFPLEVBQUUsUUFBUSxDQUFDLFlBQVksRUFBRSw4QkFBOEIsQ0FBQzt3QkFDL0QsTUFBTSxFQUFFLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxxREFBcUQsQ0FBQzt3QkFDM0YsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztxQkFDN0csRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBRWQsZ0JBQWdCO29CQUNoQixJQUFJLFFBQVEsS0FBSyxDQUFDLENBQUMsa0JBQWtCLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxNQUFNLEdBQUcsUUFBUSxLQUFLLENBQUMsQ0FBQzt3QkFDOUIsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7d0JBQ2xDLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLENBQUM7b0JBQ25ELENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxlQUFlO3FCQUNWLElBQUksSUFBSSxxQ0FBNkIsRUFBRSxDQUFDO29CQUM1QyxJQUFJLE9BQWUsQ0FBQztvQkFDcEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNkLE9BQU8sR0FBRyxRQUFRLENBQUMsU0FBUyxFQUFFLG9DQUFvQyxDQUFDLENBQUM7b0JBQ3JFLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxPQUFPLEdBQUcsUUFBUSxDQUFDLGdCQUFnQixFQUFFLGlFQUFpRSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsQ0FBQztvQkFDMUosQ0FBQztvQkFFRCxjQUFjO29CQUNkLE1BQU0sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDO3dCQUNqRixJQUFJLEVBQUUsU0FBUzt3QkFDZixPQUFPLEVBQUU7NEJBQ1IsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxjQUFjLENBQUM7NEJBQzFMLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQzt5QkFDekU7d0JBQ0QsT0FBTzt3QkFDUCxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQzs0QkFDaEMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLCtGQUErRixDQUFDLENBQUMsQ0FBQzs0QkFDckksUUFBUSxDQUFDLDBCQUEwQixFQUFFLHFGQUFxRixDQUFDO3dCQUM1SCxhQUFhLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO3FCQUM3RyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFFZCxnQkFBZ0I7b0JBQ2hCLE1BQU0sTUFBTSxHQUFHLFFBQVEsS0FBSyxDQUFDLENBQUM7b0JBQzlCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBQ25ELENBQUM7Z0JBQ0QsTUFBTTtZQUNQO2dCQUNDLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO2dCQUNsQyxNQUFNO1FBQ1IsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQWUsRUFBRSxrQkFBMkI7UUFDdkUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7UUFFMUMsc0NBQXNDO1FBQ3RDLElBQUksa0JBQWtCLElBQUksU0FBUyxFQUFFLENBQUM7WUFDckMsSUFBSSxDQUFDO2dCQUNKLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM3RSxNQUFNLGdCQUFnQixDQUFDLElBQUksRUFBRSxDQUFDO2dCQUM5QixnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztnQkFDMUQsTUFBTSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQyxDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDaEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUM7UUFFRCxtRkFBbUY7UUFDbkYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUUxQixJQUFJLENBQUM7WUFDSixrRUFBa0U7WUFDbEUsSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUU1QiwrREFBK0Q7Z0JBQy9ELElBQUksU0FBUyxHQUFpRCxTQUFTLENBQUM7Z0JBQ3hFLElBQUksVUFBVSxHQUFHLFNBQVMsQ0FBQztnQkFDM0IsSUFBSSxpQ0FBaUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO29CQUNsRCxTQUFTLEdBQUcsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUMxQyxDQUFDO3FCQUFNLElBQUkscUJBQXFCLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztvQkFDN0MsU0FBUyxHQUFHLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDcEQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLFVBQVUsR0FBRyxJQUFJLENBQUM7Z0JBQ25CLENBQUM7Z0JBRUQsOEJBQThCO2dCQUM5QixNQUFNLE1BQU0sR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQztvQkFDbEQsT0FBTyx5QkFBaUI7b0JBQ3hCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU87b0JBQzdCLEdBQUcsRUFBRTt3QkFDSixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJO3dCQUNuQyxDQUFDLEVBQUUsRUFBRSxDQUFDLCtEQUErRDtxQkFDckU7b0JBQ0QsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztvQkFDL0MsVUFBVTtvQkFDVixjQUFjLEVBQUUsSUFBSTtvQkFDcEIsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO2lCQUNyQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ2pCLENBQUM7UUFDRixDQUFDO2dCQUFTLENBQUM7WUFDViwyRUFBMkU7WUFDM0UsNkVBQTZFO1lBQzdFLHlEQUF5RDtZQUN6RCxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLENBQUM7SUFDRixDQUFDO0lBRU8sNEJBQTRCLENBQUMsU0FBK0I7UUFFbkUsZ0VBQWdFO1FBQ2hFLGNBQWM7UUFDZCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsS0FBSyxTQUFTLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQ3BDLENBQUM7SUFDRixDQUFDO0lBRU8sc0JBQXNCLENBQUMsQ0FBNkI7UUFFM0QsVUFBVTtRQUNWLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLG9CQUFvQixpRUFBZ0MsRUFBRSxDQUFDO1lBQ2xFLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDekQsSUFBSSxvQkFBb0IsS0FBSyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztnQkFDNUQsSUFBSSxDQUFDLHdCQUF3QixHQUFHLG9CQUFvQixDQUFDO2dCQUNyRCxJQUFJLENBQUMsb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUNqRCxDQUFDO1FBQ0YsQ0FBQztRQUVELFFBQVE7UUFDUixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUMxRixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFTLFlBQVksQ0FBQyxDQUFDO1lBQ3hFLElBQUksWUFBWSxHQUFHLENBQUMsT0FBTyxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUU7bUJBQ3BELENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxvQkFBb0I7bUJBQ3RKLFNBQVMsQ0FBQztZQUVkLElBQUksWUFBWSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN2QyxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFlBQWEsQ0FBQyxDQUFDO2dCQUNyQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDckMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDZCxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQzt5QkFDcEUsUUFBUSxFQUFFLENBQUM7Z0JBQ2QsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLFlBQVksRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDakMsWUFBWSxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUVELE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBVyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7bUJBQ3hILENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLG9CQUFvQjtZQUN4RyxJQUFJLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsZ0JBQWdCLElBQUksVUFBVSxLQUFLLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO2dCQUNoSSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDO2dCQUNyQyxJQUFJLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQztnQkFFakMsTUFBTSxVQUFVLEdBQUcsWUFBWSxJQUFJLEVBQUUsQ0FBQztnQkFDdEMsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsVUFBVSxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztnQkFDMUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMscUJBQXFCLFVBQVUsaUJBQWlCLGdCQUFnQixHQUFHLENBQUMsQ0FBQztnQkFDM0YsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDeEYsUUFBUSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDeEUsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRUQsZUFBZSxDQUFDLE1BQW1CO1FBQ2xDLElBQUksV0FBVyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkMsQ0FBQztJQUNGLENBQUM7SUFFRCxJQUFJLENBQUMsYUFBeUMsRUFBRSxVQUF3QixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztRQUMxRixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyw0Q0FBNEMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFFL0Usa0NBQWtDO1FBQ2xDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUM7Z0JBQ3JFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQztRQUVELHFDQUFxQztRQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3ZCLElBQUksSUFBSSxDQUFDLHNCQUFzQixFQUFFLEVBQUUsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2pDLENBQUM7WUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFFRCwwREFBMEQ7UUFDMUQsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFakQseUVBQXlFO1FBQ3pFLHdFQUF3RTtRQUN4RSxJQUFJLElBQUksQ0FBQyxVQUFVLDRCQUFvQixFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUM7UUFDOUIsQ0FBQztRQUVELHlFQUF5RTtRQUN6RSx5RUFBeUU7UUFDekUsMEVBQTBFO1FBQzFFLG1DQUFtQzthQUM5QixDQUFDO1lBQ0wsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGFBQWEsQ0FBQztRQUN4QyxDQUFDO1FBRUQsZ0NBQWdDO1FBQ2hDLElBQUksQ0FBQyxVQUFVLGdDQUF3QixDQUFDO1FBRXhDLFdBQVc7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLCtDQUErQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbkssNEJBQTRCO1FBQzVCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDakMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFFdEIsc0ZBQXNGO1FBQ3RGLHNFQUFzRTtRQUN0RSxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1lBQ3BHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUU7Z0JBQ3hDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7b0JBQ3JFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ2pCLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLHlCQUFpQixFQUFFLENBQUMsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ3RDLENBQUM7WUFDRixDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBRUQsUUFBUTtRQUNSLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLGFBQWEsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQywyQkFBbUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLHlCQUFpQixDQUFDLDJCQUFtQixFQUFFLENBQUMsQ0FBQztJQUNoSyxDQUFDO0lBRU8sbUJBQW1CLENBQUMsYUFBeUMsRUFBRSxPQUFxQjtRQUUzRix5REFBeUQ7UUFDekQseURBQXlEO1FBQ3pELHNEQUFzRDtRQUN0RCxzREFBc0Q7UUFDdEQsMERBQTBEO1FBQzFELDBEQUEwRDtRQUMxRCwwREFBMEQ7UUFDMUQsMERBQTBEO1FBQzFELE1BQU0sY0FBYyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsRUFBRSxPQUFPLENBQUM7UUFDekUsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwQixNQUFNLGtDQUFrQyxHQUFHLGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFILE1BQU0sOEJBQThCLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDO1lBQ3ZFLElBQUksa0NBQWtDLElBQUksOEJBQThCLEVBQUUsQ0FBQztnQkFDMUUsYUFBYSxDQUFDLE9BQU8sR0FBRyxFQUFFLEdBQUcsY0FBYyxFQUFFLEdBQUcsYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsMkRBQTJEO1lBQ3JJLENBQUM7UUFDRixDQUFDO1FBRUQsa0ZBQWtGO1FBQ2xGLHNFQUFzRTtRQUN0RSx5REFBeUQ7UUFDekQsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLEVBQUUsQ0FBQztZQUM5QyxNQUFNLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUU7Z0JBQ3BDLHlCQUF5QixFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLENBQUM7YUFDbkUsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUVELG1GQUFtRjtRQUNuRiw0REFBNEQ7UUFDNUQsSUFBSSxPQUFPLENBQUMsaUJBQWlCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDN0MsYUFBYSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQ2pFLENBQUM7UUFFRCxtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDO1lBQ0osYUFBYSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFDRCxhQUFhLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDN0MsYUFBYSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2xELGFBQWEsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0YsYUFBYSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDOUMsYUFBYSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sSUFBSSxDQUFDLGVBQWUsS0FBSyxRQUFRLENBQUM7UUFDM0UsSUFBSSxhQUFhLENBQUMsaUJBQWlCLElBQUksYUFBYSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2xFLGFBQWEsQ0FBQyxXQUFXLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxTQUFTLENBQUM7UUFDL0QsQ0FBQztRQUVELGdDQUFnQztRQUNoQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUMvQixhQUFhLENBQUMsU0FBUyxHQUFHLFFBQVEsRUFBRSxDQUFDO1FBRXJDLG9EQUFvRDtRQUNwRCxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFzQjtRQUVsQyxvQ0FBb0M7UUFDcEMsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXRELHFCQUFxQjtRQUNyQixhQUFhLENBQUMsU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLDZCQUE2QixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRWxGLHNEQUFzRDtRQUN0RCxPQUFPLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQztRQUN6QyxPQUFPLGFBQWEsQ0FBQyxXQUFXLENBQUM7UUFDakMsT0FBTyxhQUFhLENBQUMsWUFBWSxDQUFDO1FBQ2xDLE9BQU8sYUFBYSxDQUFDLFdBQVcsQ0FBQztRQUVqQyxxRkFBcUY7UUFDckYsNEVBQTRFO1FBQzVFLElBQUksSUFBSSxDQUFDLDBCQUEwQixJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQzVDLGFBQWEsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQztZQUNwQyxhQUFhLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUM7WUFDcEMsYUFBYSxDQUFDLG9CQUFvQixHQUFHLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQztZQUM5RCxhQUFhLENBQUMsb0JBQW9CLENBQUMsR0FBRyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUNoRSxhQUFhLENBQUMsd0JBQXdCLENBQUMsR0FBRyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUN4RSxhQUFhLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBRUQsYUFBYSxDQUFDLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsNkJBQTZCLEVBQUUsQ0FBQztRQUNsRixhQUFhLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLENBQUMseUJBQXlCO1FBQ2pFLGFBQWEsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLDBCQUEwQjtRQUN2RixhQUFhLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxVQUFVLENBQUM7UUFDbEUsYUFBYSxDQUFDLFFBQVEsR0FBRztZQUN4QixHQUFHLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVE7WUFDMUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLGNBQWM7WUFDcEUsSUFBSSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZO1NBQy9DLENBQUM7UUFDRixhQUFhLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUM5RCxhQUFhLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRWxFLGNBQWM7UUFDZCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDOUYsQ0FBQztJQUVPLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxhQUF5QztRQUVwRixlQUFlO1FBQ2YsSUFBSSxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUNwRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztZQUN0RCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN4QyxNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNsRSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ3RCLE9BQU8sU0FBUyxDQUFDO2dCQUNsQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxnQkFBZ0I7YUFDWCxJQUFJLGlDQUFpQyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ3JFLE1BQU0sR0FBRyxHQUFHLGFBQWEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDO1lBQ3hDLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2pDLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztvQkFDbkIsT0FBTyxTQUFTLENBQUM7Z0JBQ2xCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELHFCQUFxQjtRQUNyQixPQUFPLGFBQWEsQ0FBQyxTQUFTLENBQUM7SUFDaEMsQ0FBQztJQUVELG9CQUFvQjtRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hCLE9BQU8sa0JBQWtCLEVBQUUsQ0FBQztRQUM3QixDQUFDO1FBRUQsb0NBQW9DO1FBQ3BDLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3ZCLElBQUksT0FBcUMsQ0FBQztZQUMxQyxJQUFJLENBQUM7Z0JBQ0osT0FBTyxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLDZEQUE2RDtnQkFDN0QsOERBQThEO2dCQUM5RCw4QkFBOEI7WUFDL0IsQ0FBQztZQUVELE1BQU0sWUFBWSxHQUFHLGtCQUFrQixFQUFFLENBQUM7WUFFMUMsT0FBTztnQkFDTixJQUFJLCtCQUF1QjtnQkFDM0IsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUztnQkFFekMsNERBQTREO2dCQUM1RCw0Q0FBNEM7Z0JBQzVDLDJEQUEyRDtnQkFDM0QsMkRBQTJEO2dCQUMzRCx5Q0FBeUM7Z0JBQ3pDLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssSUFBSSxZQUFZLENBQUMsS0FBSztnQkFDbkQsTUFBTSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxJQUFJLFlBQVksQ0FBQyxNQUFNO2dCQUN0RCxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDMUIsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUM7Z0JBQzFCLFNBQVMsRUFBRSxJQUFJLENBQUMsZUFBZTthQUMvQixDQUFDO1FBQ0gsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFpQixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hELElBQUksSUFBZ0IsQ0FBQztRQUVyQixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7WUFDN0MsSUFBSSwrQkFBdUIsQ0FBQztRQUM3QixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksNEJBQW9CLENBQUM7UUFDMUIsQ0FBQztRQUVELGtFQUFrRTtRQUNsRSxJQUFJLElBQUksaUNBQXlCLEVBQUUsQ0FBQztZQUNuQyxLQUFLLENBQUMsSUFBSSwrQkFBdUIsQ0FBQztRQUNuQyxDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssQ0FBQyxJQUFJLDRCQUFvQixDQUFDO1FBQ2hDLENBQUM7UUFFRCw0Q0FBNEM7UUFDNUMsSUFBSSxJQUFJLDhCQUFzQixJQUFJLElBQUksaUNBQXlCLEVBQUUsQ0FBQztZQUNqRSxJQUFJLE1BQTBCLENBQUM7WUFDL0IsSUFBSSxJQUFJLDhCQUFzQixFQUFFLENBQUM7Z0JBQ2hDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDM0IsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsbUZBQW1GO1lBQzFILENBQUM7WUFFRCxLQUFLLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDbkIsS0FBSyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ25CLEtBQUssQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUMzQixLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDOUIsQ0FBQztRQUVELEtBQUssQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUV2QyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxLQUFvQjtRQUM5QyxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQztRQUV4QyxJQUFJLG1CQUFtQixHQUFHLEtBQUssQ0FBQztRQUNoQyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBRVgsY0FBYztZQUNkLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztZQUV2QyxvQkFBb0I7WUFDcEIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ2xELG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2dCQUUxQyxLQUFLLEdBQUcsb0JBQW9CLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDcEYsQ0FBQztZQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7Z0JBQ2QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsNkNBQTZDLEdBQUcsS0FBSyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLCtEQUErRDtZQUN4SixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBRXZDLE9BQU8sQ0FBQyxLQUFLLElBQUksa0JBQWtCLEVBQUUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRCxTQUFTO1FBQ1IsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUU1QyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVrQixhQUFhLENBQUMsVUFBbUIsRUFBRSxXQUFvQjtRQUN6RSxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUU3QyxTQUFTO1FBQ1QsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU3Ryx5RUFBeUU7UUFDekUsSUFBSSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2pFLENBQUM7SUFDRixDQUFDO0lBRU8sb0JBQW9CO1FBQzNCLElBQUksaUJBQWlCLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDcEUsaUJBQWlCLEdBQUcsU0FBUyxDQUFDO1FBQy9CLENBQUM7UUFFRCxPQUFPLGlCQUFpQixDQUFDO0lBQzFCLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxVQUE2QixFQUFFLFNBQWtCLElBQUk7UUFDakYsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixPQUFPLENBQUMsNEJBQTRCO1FBQ3JDLENBQUM7UUFFRCxJQUFJLFVBQVUsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM3QixJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsUUFBUSxDQUFDLGVBQWUsRUFBRSw0REFBNEQsQ0FBQyxDQUFDLENBQUM7WUFDOUgsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLFVBQVUsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM3QixnR0FBZ0c7WUFDaEcsaUdBQWlHO1lBQ2pHLGdHQUFnRztZQUNoRyxvR0FBb0c7WUFDcEcsMkZBQTJGO1lBQzNGLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2YsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3pDLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekMsQ0FBQztJQUNGLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxVQUE2QjtRQUMzRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBRXZDLFFBQVEsVUFBVSxFQUFFLENBQUM7WUFDcEIsS0FBSyxDQUFDLFNBQVMsQ0FBQztnQkFDZixJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFHLFlBQVksQ0FBQztnQkFDekMsTUFBTTtZQUVQLEtBQUssQ0FBQyxTQUFTLENBQUM7Z0JBQ2YsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO2dCQUNsQyxNQUFNO1lBRVAsS0FBSyxDQUFDLFFBQVEsQ0FBQztnQkFDZCxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7Z0JBQ2pDLE1BQU07WUFFUCxLQUFLLENBQUMsUUFBUSxDQUFDO2dCQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUssQ0FBQztnQkFDbEMsTUFBTTtRQUNSLENBQUM7SUFDRixDQUFDO0lBRUQsZUFBZSxDQUFDLFNBQTZCO1FBQzVDLElBQUksQ0FBQyxlQUFlLEdBQUcsU0FBUyxDQUFDO0lBQ2xDLENBQUM7SUFFTyxZQUFZO1FBQ25CLElBQUksT0FBTyxJQUFJLENBQUMsZUFBZSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUM3QixDQUFDO1FBRUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBOEIsUUFBUSxDQUFDLENBQUM7UUFDakcsT0FBTyxjQUFjLEVBQUUsU0FBUyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxLQUFLO1FBQ0osSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUNwQixDQUFDO0lBRUQsYUFBYSxDQUFDLE9BQWUsRUFBRSxLQUF3QixFQUFFLEdBQUcsSUFBVztRQUN0RSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQzdCLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ3RCLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztnQkFDN0IsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFRCxJQUFJLENBQUMsT0FBZSxFQUFFLEdBQUcsSUFBVztRQUNuQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNmLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO2dCQUNwRSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsT0FBTyxnQ0FBZ0MsQ0FBQyxDQUFDO2dCQUNqRyxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQztnQkFDSixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDOUMsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHlDQUF5QyxPQUFPLGVBQWUsSUFBSSxDQUFDLEdBQUcsS0FBSyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzNILENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELGNBQWMsQ0FBQyxNQUFzQztRQUNwRCxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDbEIsT0FBTyxDQUFDLDBCQUEwQjtRQUNuQyxDQUFDO1FBRUQsZ0VBQWdFO1FBQ2hFLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNwRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDL0IsYUFBYSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDckUsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sY0FBYztRQUNyQixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDbEIsT0FBTyxDQUFDLDBCQUEwQjtRQUNuQyxDQUFDO1FBRUQsMkRBQTJEO1FBQzNELDJEQUEyRDtRQUMzRCxxQkFBcUI7UUFDckIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzdCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3pDLENBQUM7UUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRU8sbUJBQW1CLENBQUMsUUFBc0MsRUFBRTtRQUVuRSxpQkFBaUI7UUFDakIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXpELGdCQUFnQjtRQUNoQixNQUFNLE9BQU8sR0FBRyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsd0JBQXdCLENBQUM7WUFDOUQsUUFBUTtZQUNSLElBQUksRUFBRSxTQUFTO1lBQ2YsWUFBWSxFQUFFLFdBQVc7WUFDekIsTUFBTSxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUU7Z0JBQ3pCLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFzQixDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztZQUNwSixDQUFDO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVPLDJCQUEyQixDQUFDLFFBQXNDLEVBQUU7UUFDM0UsTUFBTSxRQUFRLEdBQXVCLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDckQsSUFBSSxJQUFzQyxDQUFDO1lBQzNDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sS0FBSyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hHLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzlFLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7b0JBQ3BCLElBQUksR0FBRyxTQUFTLENBQUM7Z0JBQ2xCLENBQUM7WUFDRixDQUFDO1lBRUQsSUFBSSxLQUFhLENBQUM7WUFDbEIsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ3BDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQ3BCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDMUIsQ0FBQztZQUVELE9BQU87Z0JBQ04sRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNYLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUNoQyxJQUFJO2FBQ0osQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVPLEtBQUssQ0FBQywyQkFBMkI7UUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBQzlDLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLDBCQUEwQixFQUFFLENBQUM7WUFFakYsMkNBQTJDO1lBQzNDLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ1gsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNDLENBQUM7WUFFRCxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFDN0UsQ0FBQztJQUNGLENBQUM7SUFFTywwQkFBMEI7UUFDakMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2hELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUVuQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDOUIsSUFBSSxVQUFVLEdBQUcsb0NBQW9DLENBQUM7WUFDdEQsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO1lBRWhCLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztpQkFDN0QsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTlCLEtBQUssTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFDNUMsT0FBTyxJQUFJLEtBQUssQ0FBQztnQkFDakIsZ0VBQWdFO2dCQUNoRSxxREFBcUQ7Z0JBQ3JELElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztvQkFDM0UsTUFBTSxTQUFTLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO29CQUNoRyxZQUFZLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNDLENBQUM7Z0JBQ0QsVUFBVSxJQUFJLElBQUksS0FBSyxLQUFLLEtBQUssSUFBSSxDQUFDO1lBQ3ZDLENBQUM7WUFFRCxVQUFVLElBQUksa0JBQWtCLE9BQU8sSUFBSSxDQUFDO1lBQzVDLFVBQVUsSUFBSSxpSEFBaUgsQ0FBQztZQUNoSSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBRUQsT0FBTyxDQUFDLFdBQWlDO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsRUFBRSxLQUFLLFdBQVcsQ0FBQyxFQUFFLENBQUM7SUFDckQsQ0FBQztJQUVRLE9BQU87UUFDZixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFaEIseUNBQXlDO1FBQ3pDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkQsQ0FBQztDQUNELENBQUE7QUFyakNZLFVBQVU7SUE0RXBCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLHVCQUF1QixDQUFBO0lBQ3ZCLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSw0QkFBNEIsQ0FBQTtJQUM1QixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsOEJBQThCLENBQUE7SUFDOUIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFlBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxnQ0FBZ0MsQ0FBQTtJQUNoQyxZQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFlBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFlBQUEsZUFBZSxDQUFBO0lBQ2YsWUFBQSxvQkFBb0IsQ0FBQTtJQUNwQixZQUFBLG1CQUFtQixDQUFBO0lBQ25CLFlBQUEsYUFBYSxDQUFBO0lBQ2IsWUFBQSxxQkFBcUIsQ0FBQTtHQS9GWCxVQUFVLENBcWpDdEI7O0FBRUQsTUFBTSxpQkFBa0IsU0FBUSxLQUFLO0lBRXBDLFlBQVksTUFBYyxFQUFFLFFBQWdCLEVBQUUsTUFBYyxDQUFDO1FBQzVELGdEQUFnRDtRQUNoRCw0REFBNEQ7UUFDNUQsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsQ0FBQztRQUM5QyxLQUFLLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztRQUMxQixLQUFLLENBQUMsZ0RBQWdELFFBQVEsa0NBQWtDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkcsS0FBSyxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDeEMsSUFBSSxDQUFDLElBQUksR0FBRyx5QkFBeUIsQ0FBQztRQUN0QyxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQztJQUNyQixDQUFDO0NBQ0QifQ==