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
var NativeWindow_1;
import './media/window.css';
import { localize } from '../../nls.js';
import { URI } from '../../base/common/uri.js';
import { equals } from '../../base/common/objects.js';
import { EventType, EventHelper, addDisposableListener, ModifierKeyEmitter, getActiveElement, hasWindow, getWindowById, getWindows, $ } from '../../base/browser/dom.js';
import { Action, Separator } from '../../base/common/actions.js';
import { IFileService } from '../../platform/files/common/files.js';
import { EditorResourceAccessor, SideBySideEditor, pathsToEditors, isResourceEditorInput } from '../common/editor.js';
import { IEditorService } from '../services/editor/common/editorService.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';
import { WindowMinimumSize, hasNativeTitlebar } from '../../platform/window/common/window.js';
import { ITitleService } from '../services/title/browser/titleService.js';
import { IWorkbenchThemeService } from '../services/themes/common/workbenchThemeService.js';
import { ApplyZoomTarget, applyZoom } from '../../platform/window/electron-browser/window.js';
import { setFullscreen, getZoomLevel, onDidChangeZoomLevel, getZoomFactor } from '../../base/browser/browser.js';
import { ICommandService, CommandsRegistry } from '../../platform/commands/common/commands.js';
import { ipcRenderer, process } from '../../base/parts/sandbox/electron-browser/globals.js';
import { IWorkspaceEditingService } from '../services/workspaces/common/workspaceEditing.js';
import { IMenuService, MenuId, MenuItemAction, MenuRegistry } from '../../platform/actions/common/actions.js';
import { getFlatActionBarActions } from '../../platform/actions/browser/menuEntryActionViewItem.js';
import { RunOnceScheduler } from '../../base/common/async.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../base/common/lifecycle.js';
import { ILifecycleService } from '../services/lifecycle/common/lifecycle.js';
import { IIntegrityService } from '../services/integrity/common/integrity.js';
import { isWindows, isMacintosh } from '../../base/common/platform.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { INotificationService, NotificationPriority, Severity } from '../../platform/notification/common/notification.js';
import { IKeybindingService } from '../../platform/keybinding/common/keybinding.js';
import { INativeWorkbenchEnvironmentService } from '../services/environment/electron-browser/environmentService.js';
import { IAccessibilityService } from '../../platform/accessibility/common/accessibility.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { coalesce } from '../../base/common/arrays.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../platform/storage/common/storage.js';
import { IOpenerService } from '../../platform/opener/common/opener.js';
import { Schemas } from '../../base/common/network.js';
import { INativeHostService } from '../../platform/native/common/native.js';
import { posix } from '../../base/common/path.js';
import { ITunnelService, extractLocalHostUriMetaDataForPortMapping, extractQueryLocalHostUriMetaDataForPortMapping } from '../../platform/tunnel/common/tunnel.js';
import { IWorkbenchLayoutService, positionFromString } from '../services/layout/browser/layoutService.js';
import { IWorkingCopyService } from '../services/workingCopy/common/workingCopyService.js';
import { IFilesConfigurationService } from '../services/filesConfiguration/common/filesConfigurationService.js';
import { Event } from '../../base/common/event.js';
import { IRemoteAuthorityResolverService } from '../../platform/remote/common/remoteAuthorityResolver.js';
import { IEditorGroupsService } from '../services/editor/common/editorGroupsService.js';
import { IDialogService } from '../../platform/dialogs/common/dialogs.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { whenEditorClosed } from '../browser/editor.js';
import { ISharedProcessService } from '../../platform/ipc/electron-browser/services.js';
import { IProgressService } from '../../platform/progress/common/progress.js';
import { toErrorMessage } from '../../base/common/errorMessage.js';
import { ILabelService } from '../../platform/label/common/label.js';
import { dirname } from '../../base/common/resources.js';
import { IBannerService } from '../services/banner/browser/bannerService.js';
import { Codicon } from '../../base/common/codicons.js';
import { IUriIdentityService } from '../../platform/uriIdentity/common/uriIdentity.js';
import { IPreferencesService } from '../services/preferences/common/preferences.js';
import { IUtilityProcessWorkerWorkbenchService } from '../services/utilityProcess/electron-browser/utilityProcessWorkerWorkbenchService.js';
import { registerWindowDriver } from '../services/driver/browser/driver.js';
import { mainWindow } from '../../base/browser/window.js';
import { BaseWindow } from '../browser/window.js';
import { IHostService } from '../services/host/browser/host.js';
import { IStatusbarService, ShowTooltipCommand } from '../services/statusbar/browser/statusbar.js';
import { ActionBar } from '../../base/browser/ui/actionbar/actionbar.js';
import { ThemeIcon } from '../../base/common/themables.js';
import { getWorkbenchContribution } from '../common/contributions.js';
import { DynamicWorkbenchSecurityConfiguration } from '../common/configuration.js';
import { nativeHoverDelegate } from '../../platform/hover/browser/hover.js';
let NativeWindow = NativeWindow_1 = class NativeWindow extends BaseWindow {
    constructor(editorService, editorGroupService, configurationService, titleService, themeService, notificationService, commandService, keybindingService, telemetryService, workspaceEditingService, fileService, menuService, lifecycleService, integrityService, nativeEnvironmentService, accessibilityService, contextService, openerService, nativeHostService, tunnelService, layoutService, workingCopyService, filesConfigurationService, productService, remoteAuthorityResolverService, dialogService, storageService, logService, instantiationService, sharedProcessService, progressService, labelService, bannerService, uriIdentityService, preferencesService, utilityProcessWorkerWorkbenchService, hostService) {
        super(mainWindow, undefined, hostService, nativeEnvironmentService);
        this.editorService = editorService;
        this.editorGroupService = editorGroupService;
        this.configurationService = configurationService;
        this.titleService = titleService;
        this.themeService = themeService;
        this.notificationService = notificationService;
        this.commandService = commandService;
        this.keybindingService = keybindingService;
        this.telemetryService = telemetryService;
        this.workspaceEditingService = workspaceEditingService;
        this.fileService = fileService;
        this.menuService = menuService;
        this.lifecycleService = lifecycleService;
        this.integrityService = integrityService;
        this.nativeEnvironmentService = nativeEnvironmentService;
        this.accessibilityService = accessibilityService;
        this.contextService = contextService;
        this.openerService = openerService;
        this.nativeHostService = nativeHostService;
        this.tunnelService = tunnelService;
        this.layoutService = layoutService;
        this.workingCopyService = workingCopyService;
        this.filesConfigurationService = filesConfigurationService;
        this.productService = productService;
        this.remoteAuthorityResolverService = remoteAuthorityResolverService;
        this.dialogService = dialogService;
        this.storageService = storageService;
        this.logService = logService;
        this.instantiationService = instantiationService;
        this.sharedProcessService = sharedProcessService;
        this.progressService = progressService;
        this.labelService = labelService;
        this.bannerService = bannerService;
        this.uriIdentityService = uriIdentityService;
        this.preferencesService = preferencesService;
        this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
        this.customTitleContextMenuDisposable = this._register(new DisposableStore());
        this.addRemoveFoldersScheduler = this._register(new RunOnceScheduler(() => this.doAddRemoveFolders(), 100));
        this.pendingFoldersToAdd = [];
        this.pendingFoldersToRemove = [];
        this.isDocumentedEdited = false;
        this.touchBarDisposables = this._register(new DisposableStore());
        //#region Window Zoom
        this.mapWindowIdToZoomStatusEntry = new Map();
        this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
        this.registerListeners();
        this.create();
    }
    registerListeners() {
        // Layout
        this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => this.layoutService.layout()));
        // React to editor input changes
        this._register(this.editorService.onDidActiveEditorChange(() => this.updateTouchbarMenu()));
        // Prevent opening a real URL inside the window
        for (const event of [EventType.DRAG_OVER, EventType.DROP]) {
            this._register(addDisposableListener(mainWindow.document.body, event, (e) => {
                EventHelper.stop(e);
            }));
        }
        // Support `runAction` event
        ipcRenderer.on('vscode:runAction', async (event, request) => {
            const args = request.args || [];
            // If we run an action from the touchbar, we fill in the currently active resource
            // as payload because the touch bar items are context aware depending on the editor
            if (request.from === 'touchbar') {
                const activeEditor = this.editorService.activeEditor;
                if (activeEditor) {
                    const resource = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
                    if (resource) {
                        args.push(resource);
                    }
                }
            }
            else {
                args.push({ from: request.from });
            }
            try {
                await this.commandService.executeCommand(request.id, ...args);
                this.telemetryService.publicLog2('workbenchActionExecuted', { id: request.id, from: request.from });
            }
            catch (error) {
                this.notificationService.error(error);
            }
        });
        // Support runKeybinding event
        ipcRenderer.on('vscode:runKeybinding', (event, request) => {
            const activeElement = getActiveElement();
            if (activeElement) {
                this.keybindingService.dispatchByUserSettingsLabel(request.userSettingsLabel, activeElement);
            }
        });
        // Shared Process crash reported from main
        ipcRenderer.on('vscode:reportSharedProcessCrash', (event, error) => {
            this.notificationService.prompt(Severity.Error, localize('sharedProcessCrash', "A shared background process terminated unexpectedly. Please restart the application to recover."), [{
                    label: localize('restart', "Restart"),
                    run: () => this.nativeHostService.relaunch()
                }], {
                priority: NotificationPriority.URGENT
            });
        });
        // Support openFiles event for existing and new files
        ipcRenderer.on('vscode:openFiles', (event, request) => { this.onOpenFiles(request); });
        // Support addRemoveFolders event for workspace management
        ipcRenderer.on('vscode:addRemoveFolders', (event, request) => this.onAddRemoveFoldersRequest(request));
        // Message support
        ipcRenderer.on('vscode:showInfoMessage', (event, message) => this.notificationService.info(message));
        // Shell Environment Issue Notifications
        ipcRenderer.on('vscode:showResolveShellEnvError', (event, message) => {
            this.notificationService.prompt(Severity.Error, message, [{
                    label: localize('restart', "Restart"),
                    run: () => this.nativeHostService.relaunch()
                },
                {
                    label: localize('configure', "Configure"),
                    run: () => this.preferencesService.openUserSettings({ query: 'application.shellEnvironmentResolutionTimeout' })
                },
                {
                    label: localize('learnMore', "Learn More"),
                    run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2149667')
                }]);
        });
        ipcRenderer.on('vscode:showCredentialsError', (event, message) => {
            this.notificationService.prompt(Severity.Error, localize('keychainWriteError', "Writing login information to the keychain failed with error '{0}'.", message), [{
                    label: localize('troubleshooting', "Troubleshooting Guide"),
                    run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2190713')
                }]);
        });
        ipcRenderer.on('vscode:showTranslatedBuildWarning', () => {
            this.notificationService.prompt(Severity.Warning, localize("runningTranslated", "You are running an emulated version of {0}. For better performance download the native arm64 version of {0} build for your machine.", this.productService.nameLong), [{
                    label: localize('downloadArmBuild', "Download"),
                    run: () => {
                        const quality = this.productService.quality;
                        const stableURL = 'https://code.visualstudio.com/docs/?dv=osx';
                        const insidersURL = 'https://code.visualstudio.com/docs/?dv=osx&build=insiders';
                        this.openerService.open(quality === 'stable' ? stableURL : insidersURL);
                    }
                }], {
                priority: NotificationPriority.URGENT
            });
        });
        ipcRenderer.on('vscode:showArgvParseWarning', (event, message) => {
            this.notificationService.prompt(Severity.Warning, localize("showArgvParseWarning", "The runtime arguments file 'argv.json' contains errors. Please correct them and restart."), [{
                    label: localize('showArgvParseWarningAction', "Open File"),
                    run: () => this.editorService.openEditor({ resource: this.nativeEnvironmentService.argvResource })
                }], {
                priority: NotificationPriority.URGENT
            });
        });
        // Fullscreen Events
        ipcRenderer.on('vscode:enterFullScreen', () => setFullscreen(true, mainWindow));
        ipcRenderer.on('vscode:leaveFullScreen', () => setFullscreen(false, mainWindow));
        // Proxy Login Dialog
        ipcRenderer.on('vscode:openProxyAuthenticationDialog', async (event, payload) => {
            const rememberCredentialsKey = 'window.rememberProxyCredentials';
            const rememberCredentials = this.storageService.getBoolean(rememberCredentialsKey, -1 /* StorageScope.APPLICATION */);
            const result = await this.dialogService.input({
                type: 'warning',
                message: localize('proxyAuthRequired', "Proxy Authentication Required"),
                primaryButton: localize({ key: 'loginButton', comment: ['&& denotes a mnemonic'] }, "&&Log In"),
                inputs: [
                    { placeholder: localize('username', "Username"), value: payload.username },
                    { placeholder: localize('password', "Password"), type: 'password', value: payload.password }
                ],
                detail: localize('proxyDetail', "The proxy {0} requires a username and password.", `${payload.authInfo.host}:${payload.authInfo.port}`),
                checkbox: {
                    label: localize('rememberCredentials', "Remember my credentials"),
                    checked: rememberCredentials
                }
            });
            // Reply back to the channel without result to indicate
            // that the login dialog was cancelled
            if (!result.confirmed || !result.values) {
                ipcRenderer.send(payload.replyChannel);
            }
            // Other reply back with the picked credentials
            else {
                // Update state based on checkbox
                if (result.checkboxChecked) {
                    this.storageService.store(rememberCredentialsKey, true, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
                }
                else {
                    this.storageService.remove(rememberCredentialsKey, -1 /* StorageScope.APPLICATION */);
                }
                // Reply back to main side with credentials
                const [username, password] = result.values;
                ipcRenderer.send(payload.replyChannel, { username, password, remember: !!result.checkboxChecked });
            }
        });
        // Accessibility support changed event
        ipcRenderer.on('vscode:accessibilitySupportChanged', (event, accessibilitySupportEnabled) => {
            this.accessibilityService.setAccessibilitySupport(accessibilitySupportEnabled ? 2 /* AccessibilitySupport.Enabled */ : 1 /* AccessibilitySupport.Disabled */);
        });
        // Allow to update security settings around allowed UNC Host
        ipcRenderer.on('vscode:configureAllowedUNCHost', async (event, host) => {
            if (!isWindows) {
                return; // only supported on Windows
            }
            const allowedUncHosts = new Set();
            const configuredAllowedUncHosts = this.configurationService.getValue('security.allowedUNCHosts') ?? [];
            if (Array.isArray(configuredAllowedUncHosts)) {
                for (const configuredAllowedUncHost of configuredAllowedUncHosts) {
                    if (typeof configuredAllowedUncHost === 'string') {
                        allowedUncHosts.add(configuredAllowedUncHost);
                    }
                }
            }
            if (!allowedUncHosts.has(host)) {
                allowedUncHosts.add(host);
                await getWorkbenchContribution(DynamicWorkbenchSecurityConfiguration.ID).ready; // ensure this setting is registered
                this.configurationService.updateValue('security.allowedUNCHosts', [...allowedUncHosts.values()], 2 /* ConfigurationTarget.USER */);
            }
        });
        // Allow to update security settings around protocol handlers
        ipcRenderer.on('vscode:disablePromptForProtocolHandling', (event, kind) => {
            const setting = kind === 'local' ? 'security.promptForLocalFileProtocolHandling' : 'security.promptForRemoteFileProtocolHandling';
            this.configurationService.updateValue(setting, false);
        });
        // Window Zoom
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('window.zoomLevel') || (e.affectsConfiguration('window.zoomPerWindow') && this.configurationService.getValue('window.zoomPerWindow') === false)) {
                this.onDidChangeConfiguredWindowZoomLevel();
            }
            else if (e.affectsConfiguration('keyboard.touchbar.enabled') || e.affectsConfiguration('keyboard.touchbar.ignored')) {
                this.updateTouchbarMenu();
            }
        }));
        this._register(onDidChangeZoomLevel(targetWindowId => this.handleOnDidChangeZoomLevel(targetWindowId)));
        for (const part of this.editorGroupService.parts) {
            this.createWindowZoomStatusEntry(part);
        }
        this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart(part => this.createWindowZoomStatusEntry(part)));
        // Listen to visible editor changes (debounced in case a new editor opens immediately after)
        this._register(Event.debounce(this.editorService.onDidVisibleEditorsChange, () => undefined, 0, undefined, undefined, undefined, this._store)(() => this.maybeCloseWindow()));
        // Listen to editor closing (if we run with --wait)
        const filesToWait = this.nativeEnvironmentService.filesToWait;
        if (filesToWait) {
            this.trackClosedWaitFiles(filesToWait.waitMarkerFileUri, coalesce(filesToWait.paths.map(path => path.fileUri)));
        }
        // macOS OS integration: represented file name
        if (isMacintosh) {
            for (const part of this.editorGroupService.parts) {
                this.handleRepresentedFilename(part);
            }
            this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart(part => this.handleRepresentedFilename(part)));
        }
        // Document edited: indicate for dirty working copies
        this._register(this.workingCopyService.onDidChangeDirty(workingCopy => {
            const gotDirty = workingCopy.isDirty();
            if (gotDirty && !(workingCopy.capabilities & 2 /* WorkingCopyCapabilities.Untitled */) && this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)) {
                return; // do not indicate dirty of working copies that are auto saved after short delay
            }
            this.updateDocumentEdited(gotDirty ? true : undefined);
        }));
        this.updateDocumentEdited(undefined);
        // Detect minimize / maximize
        this._register(Event.any(Event.map(Event.filter(this.nativeHostService.onDidMaximizeWindow, windowId => !!hasWindow(windowId)), windowId => ({ maximized: true, windowId })), Event.map(Event.filter(this.nativeHostService.onDidUnmaximizeWindow, windowId => !!hasWindow(windowId)), windowId => ({ maximized: false, windowId })))(e => this.layoutService.updateWindowMaximizedState(getWindowById(e.windowId).window, e.maximized)));
        this.layoutService.updateWindowMaximizedState(mainWindow, this.nativeEnvironmentService.window.maximized ?? false);
        // Detect panel position to determine minimum width
        this._register(this.layoutService.onDidChangePanelPosition(pos => this.onDidChangePanelPosition(positionFromString(pos))));
        this.onDidChangePanelPosition(this.layoutService.getPanelPosition());
        // Lifecycle
        this._register(this.lifecycleService.onBeforeShutdown(e => this.onBeforeShutdown(e)));
        this._register(this.lifecycleService.onBeforeShutdownError(e => this.onBeforeShutdownError(e)));
        this._register(this.lifecycleService.onWillShutdown(e => this.onWillShutdown(e)));
    }
    handleRepresentedFilename(part) {
        const disposables = new DisposableStore();
        Event.once(part.onWillDispose)(() => disposables.dispose());
        this.editorGroupService.getScopedInstantiationService(part).invokeFunction(accessor => {
            const editorService = accessor.get(IEditorService);
            disposables.add(editorService.onDidActiveEditorChange(() => this.updateRepresentedFilename(editorService, part.windowId)));
        });
    }
    updateRepresentedFilename(editorService, targetWindowId) {
        const file = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: Schemas.file });
        // Represented Filename
        this.nativeHostService.setRepresentedFilename(file?.fsPath ?? '', { targetWindowId });
        // Custom title menu (main window only currently)
        if (targetWindowId === mainWindow.vscodeWindowId) {
            this.provideCustomTitleContextMenu(file?.fsPath);
        }
    }
    //#region Window Lifecycle
    onBeforeShutdown({ veto, reason }) {
        if (reason === 1 /* ShutdownReason.CLOSE */) {
            const confirmBeforeCloseSetting = this.configurationService.getValue('window.confirmBeforeClose');
            const confirmBeforeClose = confirmBeforeCloseSetting === 'always' || (confirmBeforeCloseSetting === 'keyboardOnly' && ModifierKeyEmitter.getInstance().isModifierPressed);
            if (confirmBeforeClose) {
                // When we need to confirm on close or quit, veto the shutdown
                // with a long running promise to figure out whether shutdown
                // can proceed or not.
                return veto((async () => {
                    let actualReason = reason;
                    if (reason === 1 /* ShutdownReason.CLOSE */ && !isMacintosh) {
                        const windowCount = await this.nativeHostService.getWindowCount();
                        if (windowCount === 1) {
                            actualReason = 2 /* ShutdownReason.QUIT */; // Windows/Linux: closing last window means to QUIT
                        }
                    }
                    let confirmed = true;
                    if (confirmBeforeClose) {
                        confirmed = await this.instantiationService.invokeFunction(accessor => NativeWindow_1.confirmOnShutdown(accessor, actualReason));
                    }
                    // Progress for long running shutdown
                    if (confirmed) {
                        this.progressOnBeforeShutdown(reason);
                    }
                    return !confirmed;
                })(), 'veto.confirmBeforeClose');
            }
        }
        // Progress for long running shutdown
        this.progressOnBeforeShutdown(reason);
    }
    progressOnBeforeShutdown(reason) {
        this.progressService.withProgress({
            location: 10 /* ProgressLocation.Window */, // use window progress to not be too annoying about this operation
            delay: 800, // delay so that it only appears when operation takes a long time
            title: this.toShutdownLabel(reason, false),
        }, () => {
            return Event.toPromise(Event.any(this.lifecycleService.onWillShutdown, // dismiss this dialog when we shutdown
            this.lifecycleService.onShutdownVeto, // or when shutdown was vetoed
            this.dialogService.onWillShowDialog // or when a dialog asks for input
            ));
        });
    }
    onBeforeShutdownError({ error, reason }) {
        this.dialogService.error(this.toShutdownLabel(reason, true), localize('shutdownErrorDetail', "Error: {0}", toErrorMessage(error)));
    }
    onWillShutdown({ reason, force, joiners }) {
        // Delay so that the dialog only appears after timeout
        const shutdownDialogScheduler = new RunOnceScheduler(() => {
            const pendingJoiners = joiners();
            this.progressService.withProgress({
                location: 20 /* ProgressLocation.Dialog */, // use a dialog to prevent the user from making any more interactions now
                buttons: [this.toForceShutdownLabel(reason)], // allow to force shutdown anyway
                cancellable: false, // do not allow to cancel
                sticky: true, // do not allow to dismiss
                title: this.toShutdownLabel(reason, false),
                detail: pendingJoiners.length > 0 ? localize('willShutdownDetail', "The following operations are still running: \n{0}", pendingJoiners.map(joiner => `- ${joiner.label}`).join('\n')) : undefined
            }, () => {
                return Event.toPromise(this.lifecycleService.onDidShutdown); // dismiss this dialog when we actually shutdown
            }, () => {
                force();
            });
        }, 1200);
        shutdownDialogScheduler.schedule();
        // Dispose scheduler when we actually shutdown
        Event.once(this.lifecycleService.onDidShutdown)(() => shutdownDialogScheduler.dispose());
    }
    toShutdownLabel(reason, isError) {
        if (isError) {
            switch (reason) {
                case 1 /* ShutdownReason.CLOSE */:
                    return localize('shutdownErrorClose', "An unexpected error prevented the window to close");
                case 2 /* ShutdownReason.QUIT */:
                    return localize('shutdownErrorQuit', "An unexpected error prevented the application to quit");
                case 3 /* ShutdownReason.RELOAD */:
                    return localize('shutdownErrorReload', "An unexpected error prevented the window to reload");
                case 4 /* ShutdownReason.LOAD */:
                    return localize('shutdownErrorLoad', "An unexpected error prevented to change the workspace");
            }
        }
        switch (reason) {
            case 1 /* ShutdownReason.CLOSE */:
                return localize('shutdownTitleClose', "Closing the window is taking a bit longer...");
            case 2 /* ShutdownReason.QUIT */:
                return localize('shutdownTitleQuit', "Quitting the application is taking a bit longer...");
            case 3 /* ShutdownReason.RELOAD */:
                return localize('shutdownTitleReload', "Reloading the window is taking a bit longer...");
            case 4 /* ShutdownReason.LOAD */:
                return localize('shutdownTitleLoad', "Changing the workspace is taking a bit longer...");
        }
    }
    toForceShutdownLabel(reason) {
        switch (reason) {
            case 1 /* ShutdownReason.CLOSE */:
                return localize('shutdownForceClose', "Close Anyway");
            case 2 /* ShutdownReason.QUIT */:
                return localize('shutdownForceQuit', "Quit Anyway");
            case 3 /* ShutdownReason.RELOAD */:
                return localize('shutdownForceReload', "Reload Anyway");
            case 4 /* ShutdownReason.LOAD */:
                return localize('shutdownForceLoad', "Change Anyway");
        }
    }
    //#endregion
    updateDocumentEdited(documentEdited) {
        let setDocumentEdited;
        if (typeof documentEdited === 'boolean') {
            setDocumentEdited = documentEdited;
        }
        else {
            setDocumentEdited = this.workingCopyService.hasDirty;
        }
        if ((!this.isDocumentedEdited && setDocumentEdited) || (this.isDocumentedEdited && !setDocumentEdited)) {
            this.isDocumentedEdited = setDocumentEdited;
            this.nativeHostService.setDocumentEdited(setDocumentEdited);
        }
    }
    getWindowMinimumWidth(panelPosition = this.layoutService.getPanelPosition()) {
        // if panel is on the side, then return the larger minwidth
        const panelOnSide = panelPosition === 0 /* Position.LEFT */ || panelPosition === 1 /* Position.RIGHT */;
        if (panelOnSide) {
            return WindowMinimumSize.WIDTH_WITH_VERTICAL_PANEL;
        }
        return WindowMinimumSize.WIDTH;
    }
    onDidChangePanelPosition(pos) {
        const minWidth = this.getWindowMinimumWidth(pos);
        this.nativeHostService.setMinimumSize(minWidth, undefined);
    }
    maybeCloseWindow() {
        const closeWhenEmpty = this.configurationService.getValue('window.closeWhenEmpty') || this.nativeEnvironmentService.args.wait;
        if (!closeWhenEmpty) {
            return; // return early if configured to not close when empty
        }
        // Close empty editor groups based on setting and environment
        for (const editorPart of this.editorGroupService.parts) {
            if (editorPart.groups.some(group => !group.isEmpty)) {
                continue; // not empty
            }
            if (editorPart === this.editorGroupService.mainPart && (this.contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */ || // only for empty windows
                this.environmentService.isExtensionDevelopment || // not when developing an extension
                this.editorService.visibleEditors.length > 0 // not when there are still editors open in other windows
            )) {
                continue;
            }
            if (editorPart === this.editorGroupService.mainPart) {
                this.nativeHostService.closeWindow();
            }
            else {
                editorPart.removeGroup(editorPart.activeGroup);
            }
        }
    }
    provideCustomTitleContextMenu(filePath) {
        // Clear old menu
        this.customTitleContextMenuDisposable.clear();
        // Only provide a menu when we have a file path and custom titlebar
        if (!filePath || hasNativeTitlebar(this.configurationService)) {
            return;
        }
        // Split up filepath into segments
        const segments = filePath.split(posix.sep);
        for (let i = segments.length; i > 0; i--) {
            const isFile = (i === segments.length);
            let pathOffset = i;
            if (!isFile) {
                pathOffset++; // for segments which are not the file name we want to open the folder
            }
            const path = URI.file(segments.slice(0, pathOffset).join(posix.sep));
            let label;
            if (!isFile) {
                label = this.labelService.getUriBasenameLabel(dirname(path));
            }
            else {
                label = this.labelService.getUriBasenameLabel(path);
            }
            const commandId = `workbench.action.revealPathInFinder${i}`;
            this.customTitleContextMenuDisposable.add(CommandsRegistry.registerCommand(commandId, () => this.nativeHostService.showItemInFolder(path.fsPath)));
            this.customTitleContextMenuDisposable.add(MenuRegistry.appendMenuItem(MenuId.TitleBarTitleContext, { command: { id: commandId, title: label || posix.sep }, order: -i, group: '1_file' }));
        }
    }
    create() {
        // Handle open calls
        this.setupOpenHandlers();
        // Notify some services about lifecycle phases
        this.lifecycleService.when(2 /* LifecyclePhase.Ready */).then(() => this.nativeHostService.notifyReady());
        this.lifecycleService.when(3 /* LifecyclePhase.Restored */).then(() => {
            this.sharedProcessService.notifyRestored();
            this.utilityProcessWorkerWorkbenchService.notifyRestored();
        });
        // Check for situations that are worth warning the user about
        this.handleWarnings();
        // Touchbar menu (if enabled)
        this.updateTouchbarMenu();
        // Smoke Test Driver
        if (this.environmentService.enableSmokeTestDriver) {
            registerWindowDriver(this.instantiationService);
        }
    }
    async handleWarnings() {
        // After restored phase is fine for the following ones
        await this.lifecycleService.when(3 /* LifecyclePhase.Restored */);
        // Integrity / Root warning
        (async () => {
            const isAdmin = await this.nativeHostService.isAdmin();
            const { isPure } = await this.integrityService.isPure();
            // Update to title
            this.titleService.updateProperties({ isPure, isAdmin });
            // Show warning message (unix only)
            if (isAdmin && !isWindows) {
                this.notificationService.warn(localize('runningAsRoot', "It is not recommended to run {0} as root user.", this.productService.nameShort));
            }
        })();
        // Installation Dir Warning
        if (this.environmentService.isBuilt) {
            let installLocationUri;
            if (isMacintosh) {
                // appRoot = /Applications/Visual Studio Code - Insiders.app/Contents/Resources/app
                installLocationUri = dirname(dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot))));
            }
            else {
                // appRoot = C:\Users\<name>\AppData\Local\Programs\Microsoft VS Code Insiders\resources\app
                // appRoot = /usr/share/code-insiders/resources/app
                installLocationUri = dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot)));
            }
            for (const folder of this.contextService.getWorkspace().folders) {
                if (this.uriIdentityService.extUri.isEqualOrParent(folder.uri, installLocationUri)) {
                    this.bannerService.show({
                        id: 'appRootWarning.banner',
                        message: localize('appRootWarning.banner', "Files you store within the installation folder ('{0}') may be OVERWRITTEN or DELETED IRREVERSIBLY without warning at update time.", this.labelService.getUriLabel(installLocationUri)),
                        icon: Codicon.warning
                    });
                    break;
                }
            }
        }
        // Slow shell environment progress indicator
        const shellEnv = process.shellEnv();
        this.progressService.withProgress({
            title: localize('resolveShellEnvironment', "Resolving shell environment..."),
            location: 10 /* ProgressLocation.Window */,
            delay: 1600,
            buttons: [localize('learnMore', "Learn More")]
        }, () => shellEnv, () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2149667'));
    }
    async resolveExternalUri(uri, options) {
        let queryTunnel;
        if (options?.allowTunneling) {
            const portMappingRequest = extractLocalHostUriMetaDataForPortMapping(uri);
            const queryPortMapping = extractQueryLocalHostUriMetaDataForPortMapping(uri);
            if (queryPortMapping) {
                queryTunnel = await this.openTunnel(queryPortMapping.address, queryPortMapping.port);
                if (queryTunnel && (typeof queryTunnel !== 'string')) {
                    // If the tunnel was mapped to a different port, dispose it, because some services
                    // validate the port number in the query string.
                    if (queryTunnel.tunnelRemotePort !== queryPortMapping.port) {
                        queryTunnel.dispose();
                        queryTunnel = undefined;
                    }
                    else {
                        if (!portMappingRequest) {
                            const tunnel = queryTunnel;
                            return {
                                resolved: uri,
                                dispose: () => tunnel.dispose()
                            };
                        }
                    }
                }
            }
            if (portMappingRequest) {
                const tunnel = await this.openTunnel(portMappingRequest.address, portMappingRequest.port);
                if (tunnel && (typeof tunnel !== 'string')) {
                    const addressAsUri = URI.parse(tunnel.localAddress).with({ path: uri.path });
                    const resolved = addressAsUri.scheme.startsWith(uri.scheme) ? addressAsUri : uri.with({ authority: tunnel.localAddress });
                    return {
                        resolved,
                        dispose() {
                            tunnel.dispose();
                            if (queryTunnel && (typeof queryTunnel !== 'string')) {
                                queryTunnel.dispose();
                            }
                        }
                    };
                }
            }
        }
        if (!options?.openExternal) {
            const canHandleResource = await this.fileService.canHandleResource(uri);
            if (canHandleResource) {
                return {
                    resolved: URI.from({
                        scheme: this.productService.urlProtocol,
                        path: 'workspace',
                        query: uri.toString()
                    }),
                    dispose() { }
                };
            }
        }
        return undefined;
    }
    async openTunnel(address, port) {
        const remoteAuthority = this.environmentService.remoteAuthority;
        const addressProvider = remoteAuthority ? {
            getAddress: async () => {
                return (await this.remoteAuthorityResolverService.resolveAuthority(remoteAuthority)).authority;
            }
        } : undefined;
        const tunnel = await this.tunnelService.getExistingTunnel(address, port);
        if (!tunnel || (typeof tunnel === 'string')) {
            return this.tunnelService.openTunnel(addressProvider, address, port);
        }
        return tunnel;
    }
    setupOpenHandlers() {
        // Handle external open() calls
        this.openerService.setDefaultExternalOpener({
            openExternal: async (href) => {
                const success = await this.nativeHostService.openExternal(href, this.configurationService.getValue('workbench.externalBrowser'));
                if (!success) {
                    const fileCandidate = URI.parse(href);
                    if (fileCandidate.scheme === Schemas.file) {
                        // if opening failed, and this is a file, we can still try to reveal it
                        await this.nativeHostService.showItemInFolder(fileCandidate.fsPath);
                    }
                }
                return true;
            }
        });
        // Register external URI resolver
        this.openerService.registerExternalUriResolver({
            resolveExternalUri: async (uri, options) => {
                return this.resolveExternalUri(uri, options);
            }
        });
    }
    updateTouchbarMenu() {
        if (!isMacintosh) {
            return; // macOS only
        }
        // Dispose old
        this.touchBarDisposables.clear();
        this.touchBarMenu = undefined;
        // Create new (delayed)
        const scheduler = this.touchBarDisposables.add(new RunOnceScheduler(() => this.doUpdateTouchbarMenu(scheduler), 300));
        scheduler.schedule();
    }
    doUpdateTouchbarMenu(scheduler) {
        if (!this.touchBarMenu) {
            const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
            this.touchBarMenu = this.menuService.createMenu(MenuId.TouchBarContext, scopedContextKeyService);
            this.touchBarDisposables.add(this.touchBarMenu);
            this.touchBarDisposables.add(this.touchBarMenu.onDidChange(() => scheduler.schedule()));
        }
        const disabled = this.configurationService.getValue('keyboard.touchbar.enabled') === false;
        const touchbarIgnored = this.configurationService.getValue('keyboard.touchbar.ignored');
        const ignoredItems = Array.isArray(touchbarIgnored) ? touchbarIgnored : [];
        // Fill actions into groups respecting order
        const actions = getFlatActionBarActions(this.touchBarMenu.getActions());
        // Convert into command action multi array
        const items = [];
        let group = [];
        if (!disabled) {
            for (const action of actions) {
                // Command
                if (action instanceof MenuItemAction) {
                    if (ignoredItems.indexOf(action.item.id) >= 0) {
                        continue; // ignored
                    }
                    group.push(action.item);
                }
                // Separator
                else if (action instanceof Separator) {
                    if (group.length) {
                        items.push(group);
                    }
                    group = [];
                }
            }
            if (group.length) {
                items.push(group);
            }
        }
        // Only update if the actions have changed
        if (!equals(this.lastInstalledTouchedBar, items)) {
            this.lastInstalledTouchedBar = items;
            this.nativeHostService.updateTouchBar(items);
        }
    }
    //#endregion
    onAddRemoveFoldersRequest(request) {
        // Buffer all pending requests
        this.pendingFoldersToAdd.push(...request.foldersToAdd.map(folder => URI.revive(folder)));
        this.pendingFoldersToRemove.push(...request.foldersToRemove.map(folder => URI.revive(folder)));
        // Delay the adding of folders a bit to buffer in case more requests are coming
        if (!this.addRemoveFoldersScheduler.isScheduled()) {
            this.addRemoveFoldersScheduler.schedule();
        }
    }
    async doAddRemoveFolders() {
        const foldersToAdd = this.pendingFoldersToAdd.map(folder => ({ uri: folder }));
        const foldersToRemove = this.pendingFoldersToRemove.slice(0);
        this.pendingFoldersToAdd = [];
        this.pendingFoldersToRemove = [];
        if (foldersToAdd.length) {
            await this.workspaceEditingService.addFolders(foldersToAdd);
        }
        if (foldersToRemove.length) {
            await this.workspaceEditingService.removeFolders(foldersToRemove);
        }
    }
    async onOpenFiles(request) {
        const diffMode = !!(request.filesToDiff && (request.filesToDiff.length === 2));
        const mergeMode = !!(request.filesToMerge && (request.filesToMerge.length === 4));
        const inputs = coalesce(await pathsToEditors(mergeMode ? request.filesToMerge : diffMode ? request.filesToDiff : request.filesToOpenOrCreate, this.fileService, this.logService));
        if (inputs.length) {
            const openedEditorPanes = await this.openResources(inputs, diffMode, mergeMode);
            if (request.filesToWait) {
                // In wait mode, listen to changes to the editors and wait until the files
                // are closed that the user wants to wait for. When this happens we delete
                // the wait marker file to signal to the outside that editing is done.
                // However, it is possible that opening of the editors failed, as such we
                // check for whether editor panes got opened and otherwise delete the marker
                // right away.
                if (openedEditorPanes.length) {
                    return this.trackClosedWaitFiles(URI.revive(request.filesToWait.waitMarkerFileUri), coalesce(request.filesToWait.paths.map(path => URI.revive(path.fileUri))));
                }
                else {
                    return this.fileService.del(URI.revive(request.filesToWait.waitMarkerFileUri));
                }
            }
        }
    }
    async trackClosedWaitFiles(waitMarkerFile, resourcesToWaitFor) {
        // Wait for the resources to be closed in the text editor...
        await this.instantiationService.invokeFunction(accessor => whenEditorClosed(accessor, resourcesToWaitFor));
        // ...before deleting the wait marker file
        await this.fileService.del(waitMarkerFile);
    }
    async openResources(resources, diffMode, mergeMode) {
        const editors = [];
        if (mergeMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1]) && isResourceEditorInput(resources[2]) && isResourceEditorInput(resources[3])) {
            const mergeEditor = {
                input1: { resource: resources[0].resource },
                input2: { resource: resources[1].resource },
                base: { resource: resources[2].resource },
                result: { resource: resources[3].resource },
                options: { pinned: true }
            };
            editors.push(mergeEditor);
        }
        else if (diffMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1])) {
            const diffEditor = {
                original: { resource: resources[0].resource },
                modified: { resource: resources[1].resource },
                options: { pinned: true }
            };
            editors.push(diffEditor);
        }
        else {
            editors.push(...resources);
        }
        return this.editorService.openEditors(editors, undefined, { validateTrust: true });
    }
    resolveConfiguredWindowZoomLevel() {
        const windowZoomLevel = this.configurationService.getValue('window.zoomLevel');
        return typeof windowZoomLevel === 'number' ? windowZoomLevel : 0;
    }
    handleOnDidChangeZoomLevel(targetWindowId) {
        // Zoom status entry
        this.updateWindowZoomStatusEntry(targetWindowId);
        // Notify main process about a custom zoom level
        if (targetWindowId === mainWindow.vscodeWindowId) {
            const currentWindowZoomLevel = getZoomLevel(mainWindow);
            let notifyZoomLevel = undefined;
            if (this.configuredWindowZoomLevel !== currentWindowZoomLevel) {
                notifyZoomLevel = currentWindowZoomLevel;
            }
            ipcRenderer.invoke('vscode:notifyZoomLevel', notifyZoomLevel);
        }
    }
    createWindowZoomStatusEntry(part) {
        const disposables = new DisposableStore();
        Event.once(part.onWillDispose)(() => disposables.dispose());
        const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
        this.mapWindowIdToZoomStatusEntry.set(part.windowId, disposables.add(scopedInstantiationService.createInstance(ZoomStatusEntry)));
        disposables.add(toDisposable(() => this.mapWindowIdToZoomStatusEntry.delete(part.windowId)));
        this.updateWindowZoomStatusEntry(part.windowId);
    }
    updateWindowZoomStatusEntry(targetWindowId) {
        const targetWindow = getWindowById(targetWindowId);
        const entry = this.mapWindowIdToZoomStatusEntry.get(targetWindowId);
        if (entry && targetWindow) {
            const currentZoomLevel = getZoomLevel(targetWindow.window);
            let text = undefined;
            if (currentZoomLevel < this.configuredWindowZoomLevel) {
                text = '$(zoom-out)';
            }
            else if (currentZoomLevel > this.configuredWindowZoomLevel) {
                text = '$(zoom-in)';
            }
            entry.updateZoomEntry(text ?? false, targetWindowId);
        }
    }
    onDidChangeConfiguredWindowZoomLevel() {
        this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
        let applyZoomLevel = false;
        for (const { window } of getWindows()) {
            if (getZoomLevel(window) !== this.configuredWindowZoomLevel) {
                applyZoomLevel = true;
                break;
            }
        }
        if (applyZoomLevel) {
            applyZoom(this.configuredWindowZoomLevel, ApplyZoomTarget.ALL_WINDOWS);
        }
        for (const [windowId] of this.mapWindowIdToZoomStatusEntry) {
            this.updateWindowZoomStatusEntry(windowId);
        }
    }
    //#endregion
    dispose() {
        super.dispose();
        for (const [, entry] of this.mapWindowIdToZoomStatusEntry) {
            entry.dispose();
        }
    }
};
NativeWindow = NativeWindow_1 = __decorate([
    __param(0, IEditorService),
    __param(1, IEditorGroupsService),
    __param(2, IConfigurationService),
    __param(3, ITitleService),
    __param(4, IWorkbenchThemeService),
    __param(5, INotificationService),
    __param(6, ICommandService),
    __param(7, IKeybindingService),
    __param(8, ITelemetryService),
    __param(9, IWorkspaceEditingService),
    __param(10, IFileService),
    __param(11, IMenuService),
    __param(12, ILifecycleService),
    __param(13, IIntegrityService),
    __param(14, INativeWorkbenchEnvironmentService),
    __param(15, IAccessibilityService),
    __param(16, IWorkspaceContextService),
    __param(17, IOpenerService),
    __param(18, INativeHostService),
    __param(19, ITunnelService),
    __param(20, IWorkbenchLayoutService),
    __param(21, IWorkingCopyService),
    __param(22, IFilesConfigurationService),
    __param(23, IProductService),
    __param(24, IRemoteAuthorityResolverService),
    __param(25, IDialogService),
    __param(26, IStorageService),
    __param(27, ILogService),
    __param(28, IInstantiationService),
    __param(29, ISharedProcessService),
    __param(30, IProgressService),
    __param(31, ILabelService),
    __param(32, IBannerService),
    __param(33, IUriIdentityService),
    __param(34, IPreferencesService),
    __param(35, IUtilityProcessWorkerWorkbenchService),
    __param(36, IHostService)
], NativeWindow);
export { NativeWindow };
let ZoomStatusEntry = class ZoomStatusEntry extends Disposable {
    constructor(statusbarService, commandService, keybindingService) {
        super();
        this.statusbarService = statusbarService;
        this.commandService = commandService;
        this.keybindingService = keybindingService;
        this.disposable = this._register(new MutableDisposable());
        this.zoomLevelLabel = undefined;
    }
    updateZoomEntry(visibleOrText, targetWindowId) {
        if (typeof visibleOrText === 'string') {
            if (!this.disposable.value) {
                this.createZoomEntry(visibleOrText);
            }
            this.updateZoomLevelLabel(targetWindowId);
        }
        else {
            this.disposable.clear();
        }
    }
    createZoomEntry(visibleOrText) {
        const disposables = new DisposableStore();
        this.disposable.value = disposables;
        const container = $('.zoom-status');
        const left = $('.zoom-status-left');
        container.appendChild(left);
        const zoomOutAction = disposables.add(new Action('workbench.action.zoomOut', localize('zoomOut', "Zoom Out"), ThemeIcon.asClassName(Codicon.remove), true, () => this.commandService.executeCommand(zoomOutAction.id)));
        const zoomInAction = disposables.add(new Action('workbench.action.zoomIn', localize('zoomIn', "Zoom In"), ThemeIcon.asClassName(Codicon.plus), true, () => this.commandService.executeCommand(zoomInAction.id)));
        const zoomResetAction = disposables.add(new Action('workbench.action.zoomReset', localize('zoomReset', "Reset"), undefined, true, () => this.commandService.executeCommand(zoomResetAction.id)));
        zoomResetAction.tooltip = localize('zoomResetLabel', "{0} ({1})", zoomResetAction.label, this.keybindingService.lookupKeybinding(zoomResetAction.id)?.getLabel());
        const zoomSettingsAction = disposables.add(new Action('workbench.action.openSettings', localize('zoomSettings', "Settings"), ThemeIcon.asClassName(Codicon.settingsGear), true, () => this.commandService.executeCommand(zoomSettingsAction.id, 'window.zoom')));
        const zoomLevelLabel = disposables.add(new Action('zoomLabel', undefined, undefined, false));
        this.zoomLevelLabel = zoomLevelLabel;
        disposables.add(toDisposable(() => this.zoomLevelLabel = undefined));
        const actionBarLeft = disposables.add(new ActionBar(left, { hoverDelegate: nativeHoverDelegate }));
        actionBarLeft.push(zoomOutAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomOutAction.id)?.getLabel() });
        actionBarLeft.push(this.zoomLevelLabel, { icon: false, label: true });
        actionBarLeft.push(zoomInAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomInAction.id)?.getLabel() });
        const right = $('.zoom-status-right');
        container.appendChild(right);
        const actionBarRight = disposables.add(new ActionBar(right, { hoverDelegate: nativeHoverDelegate }));
        actionBarRight.push(zoomResetAction, { icon: false, label: true });
        actionBarRight.push(zoomSettingsAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomSettingsAction.id)?.getLabel() });
        const name = localize('status.windowZoom', "Window Zoom");
        disposables.add(this.statusbarService.addEntry({
            name,
            text: visibleOrText,
            tooltip: container,
            ariaLabel: name,
            command: ShowTooltipCommand,
            kind: 'prominent'
        }, 'status.windowZoom', 1 /* StatusbarAlignment.RIGHT */, 102));
    }
    updateZoomLevelLabel(targetWindowId) {
        if (this.zoomLevelLabel) {
            const targetWindow = getWindowById(targetWindowId, true).window;
            const zoomFactor = Math.round(getZoomFactor(targetWindow) * 100);
            const zoomLevel = getZoomLevel(targetWindow);
            this.zoomLevelLabel.label = `${zoomLevel}`;
            this.zoomLevelLabel.tooltip = localize('zoomNumber', "Zoom Level: {0} ({1}%)", zoomLevel, zoomFactor);
        }
    }
};
ZoomStatusEntry = __decorate([
    __param(0, IStatusbarService),
    __param(1, ICommandService),
    __param(2, IKeybindingService)
], ZoomStatusEntry);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvZWxlY3Ryb24tYnJvd3Nlci93aW5kb3cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN4QyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0MsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixFQUFFLGtCQUFrQixFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3pLLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUF1RSxNQUFNLDhCQUE4QixDQUFDO0FBQ3RJLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsc0JBQXNCLEVBQW9DLGdCQUFnQixFQUFFLGNBQWMsRUFBOEQscUJBQXFCLEVBQTZCLE1BQU0scUJBQXFCLENBQUM7QUFDL08sT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBNEksaUJBQWlCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4TyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDNUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxT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