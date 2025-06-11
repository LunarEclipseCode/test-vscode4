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
var InstallAction_1, UninstallAction_1, ManageMcpServerAction_1, StartServerAction_1, StopServerAction_1, RestartServerAction_1, ShowServerOutputAction_1, ShowServerConfigurationAction_1;
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { Action, Separator } from '../../../../base/common/actions.js';
import { disposeIfDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { manageExtensionIcon } from '../../extensions/browser/extensionsIcons.js';
import { getDomNodePagePosition } from '../../../../base/browser/dom.js';
import { IMcpService, IMcpWorkbenchService, McpConnectionState } from '../common/mcpTypes.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
export class McpServerAction extends Action {
    constructor() {
        super(...arguments);
        this._mcpServer = null;
    }
    static { this.EXTENSION_ACTION_CLASS = 'extension-action'; }
    static { this.TEXT_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} text`; }
    static { this.LABEL_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} label`; }
    static { this.PROMINENT_LABEL_ACTION_CLASS = `${McpServerAction.LABEL_ACTION_CLASS} prominent`; }
    static { this.ICON_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} icon`; }
    get mcpServer() { return this._mcpServer; }
    set mcpServer(mcpServer) { this._mcpServer = mcpServer; this.update(); }
}
let DropDownAction = class DropDownAction extends McpServerAction {
    constructor(id, label, cssClass, enabled, instantiationService) {
        super(id, label, cssClass, enabled);
        this.instantiationService = instantiationService;
        this._actionViewItem = null;
    }
    createActionViewItem(options) {
        this._actionViewItem = this.instantiationService.createInstance(DropDownExtensionActionViewItem, this, options);
        return this._actionViewItem;
    }
    run(actionGroups) {
        this._actionViewItem?.showMenu(actionGroups);
        return Promise.resolve();
    }
};
DropDownAction = __decorate([
    __param(4, IInstantiationService)
], DropDownAction);
export { DropDownAction };
let DropDownExtensionActionViewItem = class DropDownExtensionActionViewItem extends ActionViewItem {
    constructor(action, options, contextMenuService) {
        super(null, action, { ...options, icon: true, label: true });
        this.contextMenuService = contextMenuService;
    }
    showMenu(menuActionGroups) {
        if (this.element) {
            const actions = this.getActions(menuActionGroups);
            const elementPosition = getDomNodePagePosition(this.element);
            const anchor = { x: elementPosition.left, y: elementPosition.top + elementPosition.height + 10 };
            this.contextMenuService.showContextMenu({
                getAnchor: () => anchor,
                getActions: () => actions,
                actionRunner: this.actionRunner,
                onHide: () => disposeIfDisposable(actions)
            });
        }
    }
    getActions(menuActionGroups) {
        let actions = [];
        for (const menuActions of menuActionGroups) {
            actions = [...actions, ...menuActions, new Separator()];
        }
        return actions.length ? actions.slice(0, actions.length - 1) : actions;
    }
};
DropDownExtensionActionViewItem = __decorate([
    __param(2, IContextMenuService)
], DropDownExtensionActionViewItem);
export { DropDownExtensionActionViewItem };
let InstallAction = class InstallAction extends McpServerAction {
    static { InstallAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpWorkbenchService) {
        super('extensions.install', localize('install', "Install"), InstallAction_1.CLASS, false);
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = InstallAction_1.HIDE;
        if (!this.mcpServer?.gallery) {
            return;
        }
        if (this.mcpServer.local) {
            return;
        }
        this.class = InstallAction_1.CLASS;
        this.enabled = true;
        this.label = localize('install', "Install");
    }
    async run() {
        if (!this.mcpServer) {
            return;
        }
        await this.mcpWorkbenchService.install(this.mcpServer);
    }
};
InstallAction = InstallAction_1 = __decorate([
    __param(0, IMcpWorkbenchService)
], InstallAction);
export { InstallAction };
let UninstallAction = class UninstallAction extends McpServerAction {
    static { UninstallAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent uninstall`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpWorkbenchService) {
        super('extensions.uninstall', localize('uninstall', "Uninstall"), UninstallAction_1.CLASS, false);
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = UninstallAction_1.HIDE;
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        this.class = UninstallAction_1.CLASS;
        this.enabled = true;
        this.label = localize('uninstall', "Uninstall");
    }
    async run() {
        if (!this.mcpServer) {
            return;
        }
        await this.mcpWorkbenchService.uninstall(this.mcpServer);
    }
};
UninstallAction = UninstallAction_1 = __decorate([
    __param(0, IMcpWorkbenchService)
], UninstallAction);
export { UninstallAction };
let ManageMcpServerAction = class ManageMcpServerAction extends DropDownAction {
    static { ManageMcpServerAction_1 = this; }
    static { this.ID = 'mcpServer.manage'; }
    static { this.Class = `${McpServerAction.ICON_ACTION_CLASS} manage ` + ThemeIcon.asClassName(manageExtensionIcon); }
    static { this.HideManageExtensionClass = `${this.Class} hide`; }
    constructor(isEditorAction, instantiationService) {
        super(ManageMcpServerAction_1.ID, '', '', true, instantiationService);
        this.isEditorAction = isEditorAction;
        this.tooltip = localize('manage', "Manage");
        this.update();
    }
    async getActionGroups() {
        const groups = [];
        groups.push([
            this.instantiationService.createInstance(StartServerAction),
        ]);
        groups.push([
            this.instantiationService.createInstance(StopServerAction),
            this.instantiationService.createInstance(RestartServerAction),
        ]);
        groups.push([
            this.instantiationService.createInstance(ShowServerOutputAction),
            this.instantiationService.createInstance(ShowServerConfigurationAction),
        ]);
        if (!this.isEditorAction) {
            groups.push([
                this.instantiationService.createInstance(UninstallAction),
            ]);
        }
        groups.forEach(group => group.forEach(extensionAction => {
            if (extensionAction instanceof McpServerAction) {
                extensionAction.mcpServer = this.mcpServer;
            }
        }));
        return groups;
    }
    async run() {
        return super.run(await this.getActionGroups());
    }
    update() {
        this.class = ManageMcpServerAction_1.HideManageExtensionClass;
        this.enabled = false;
        if (this.mcpServer) {
            this.enabled = !!this.mcpServer.local;
            this.class = this.enabled ? ManageMcpServerAction_1.Class : ManageMcpServerAction_1.HideManageExtensionClass;
        }
    }
};
ManageMcpServerAction = ManageMcpServerAction_1 = __decorate([
    __param(1, IInstantiationService)
], ManageMcpServerAction);
export { ManageMcpServerAction };
let StartServerAction = class StartServerAction extends McpServerAction {
    static { StartServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent start`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.start', localize('start', "Start Server"), StartServerAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = StartServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const serverState = server.connectionState.get();
        if (!McpConnectionState.canBeStarted(serverState.state)) {
            return;
        }
        this.class = StartServerAction_1.CLASS;
        this.enabled = true;
        this.label = localize('start', "Start Server");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        await server.start({ isFromInteraction: true });
        server.showOutput();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.label === this.mcpServer?.name);
    }
};
StartServerAction = StartServerAction_1 = __decorate([
    __param(0, IMcpService)
], StartServerAction);
export { StartServerAction };
let StopServerAction = class StopServerAction extends McpServerAction {
    static { StopServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent stop`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.stop', localize('stop', "Stop Server"), StopServerAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = StopServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const serverState = server.connectionState.get();
        if (McpConnectionState.canBeStarted(serverState.state)) {
            return;
        }
        this.class = StopServerAction_1.CLASS;
        this.enabled = true;
        this.label = localize('stop', "Stop Server");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        await server.stop();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.label === this.mcpServer?.name);
    }
};
StopServerAction = StopServerAction_1 = __decorate([
    __param(0, IMcpService)
], StopServerAction);
export { StopServerAction };
let RestartServerAction = class RestartServerAction extends McpServerAction {
    static { RestartServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent restart`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.restart', localize('restart', "Restart Server"), RestartServerAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = RestartServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const serverState = server.connectionState.get();
        if (McpConnectionState.canBeStarted(serverState.state)) {
            return;
        }
        this.class = RestartServerAction_1.CLASS;
        this.enabled = true;
        this.label = localize('restart', "Restart Server");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        await server.stop();
        await server.start({ isFromInteraction: true });
        server.showOutput();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.label === this.mcpServer?.name);
    }
};
RestartServerAction = RestartServerAction_1 = __decorate([
    __param(0, IMcpService)
], RestartServerAction);
export { RestartServerAction };
let ShowServerOutputAction = class ShowServerOutputAction extends McpServerAction {
    static { ShowServerOutputAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent output`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.output', localize('output', "Show Output"), ShowServerOutputAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ShowServerOutputAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        this.class = ShowServerOutputAction_1.CLASS;
        this.enabled = true;
        this.label = localize('output', "Show Output");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        server.showOutput();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.label === this.mcpServer?.name);
    }
};
ShowServerOutputAction = ShowServerOutputAction_1 = __decorate([
    __param(0, IMcpService)
], ShowServerOutputAction);
export { ShowServerOutputAction };
let ShowServerConfigurationAction = class ShowServerConfigurationAction extends McpServerAction {
    static { ShowServerConfigurationAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService, mcpRegistry, editorService) {
        super('extensions.config', localize('config', "Show Configuration"), ShowServerConfigurationAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.mcpRegistry = mcpRegistry;
        this.editorService = editorService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ShowServerConfigurationAction_1.HIDE;
        const configurationTarget = this.getConfigurationTarget();
        if (!configurationTarget) {
            return;
        }
        this.class = ShowServerConfigurationAction_1.CLASS;
        this.enabled = true;
        this.label = localize('config', "Show Configuration");
    }
    async run() {
        const configurationTarget = this.getConfigurationTarget();
        if (!configurationTarget) {
            return;
        }
        this.editorService.openEditor({
            resource: URI.isUri(configurationTarget) ? configurationTarget : configurationTarget.uri,
            options: { selection: URI.isUri(configurationTarget) ? undefined : configurationTarget.range }
        });
    }
    getConfigurationTarget() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        const server = this.mcpService.servers.get().find(s => s.definition.label === this.mcpServer?.name);
        if (!server) {
            return;
        }
        const collection = this.mcpRegistry.collections.get().find(c => c.id === server.collection.id);
        const serverDefinition = collection?.serverDefinitions.get().find(s => s.id === server.definition.id);
        return serverDefinition?.presentation?.origin || collection?.presentation?.origin;
    }
};
ShowServerConfigurationAction = ShowServerConfigurationAction_1 = __decorate([
    __param(0, IMcpService),
    __param(1, IMcpRegistry),
    __param(2, IEditorService)
], ShowServerConfigurationAction);
export { ShowServerConfigurationAction };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwU2VydmVyQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBMEIsTUFBTSwwREFBMEQsQ0FBQztBQUNsSCxPQUFPLEVBQUUsTUFBTSxFQUFXLFNBQVMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDbEYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDekUsT0FBTyxFQUFtQyxXQUFXLEVBQUUsb0JBQW9CLEVBQXVCLGtCQUFrQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDcEosT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFbEYsTUFBTSxPQUFnQixlQUFnQixTQUFRLE1BQU07SUFBcEQ7O1FBUVMsZUFBVSxHQUErQixJQUFJLENBQUM7SUFLdkQsQ0FBQzthQVhnQiwyQkFBc0Is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