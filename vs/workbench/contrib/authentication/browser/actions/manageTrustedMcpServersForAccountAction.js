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
import { Codicon } from '../../../../../base/common/codicons.js';
import { fromNow } from '../../../../../base/common/date.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IAuthenticationMcpAccessService } from '../../../../services/authentication/browser/authenticationMcpAccessService.js';
import { IAuthenticationMcpUsageService } from '../../../../services/authentication/browser/authenticationMcpUsageService.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
export class ManageTrustedMcpServersForAccountAction extends Action2 {
    constructor() {
        super({
            id: '_manageTrustedMCPServersForAccount',
            title: localize2('manageTrustedMcpServersForAccount', "Manage Trusted MCP Servers For Account"),
            category: localize2('accounts', "Accounts"),
            f1: true
        });
    }
    run(accessor, options) {
        const instantiationService = accessor.get(IInstantiationService);
        return instantiationService.createInstance(ManageTrustedMcpServersForAccountActionImpl).run(options);
    }
}
let ManageTrustedMcpServersForAccountActionImpl = class ManageTrustedMcpServersForAccountActionImpl {
    constructor(_productService, _mcpServerService, _dialogService, _quickInputService, _mcpServerAuthenticationService, _mcpServerAuthenticationUsageService, _mcpServerAuthenticationAccessService, _commandService) {
        this._productService = _productService;
        this._mcpServerService = _mcpServerService;
        this._dialogService = _dialogService;
        this._quickInputService = _quickInputService;
        this._mcpServerAuthenticationService = _mcpServerAuthenticationService;
        this._mcpServerAuthenticationUsageService = _mcpServerAuthenticationUsageService;
        this._mcpServerAuthenticationAccessService = _mcpServerAuthenticationAccessService;
        this._commandService = _commandService;
    }
    async run(options) {
        const { providerId, accountLabel } = await this._resolveProviderAndAccountLabel(options?.providerId, options?.accountLabel);
        if (!providerId || !accountLabel) {
            return;
        }
        const items = await this._getItems(providerId, accountLabel);
        if (!items.length) {
            return;
        }
        const disposables = new DisposableStore();
        const picker = this._createQuickPick(disposables, providerId, accountLabel);
        picker.items = items;
        picker.selectedItems = items.filter((i) => i.type !== 'separator' && !!i.picked);
        picker.show();
    }
    async _resolveProviderAndAccountLabel(providerId, accountLabel) {
        if (!providerId || !accountLabel) {
            const accounts = new Array();
            for (const id of this._mcpServerAuthenticationService.getProviderIds()) {
                const providerLabel = this._mcpServerAuthenticationService.getProvider(id).label;
                const sessions = await this._mcpServerAuthenticationService.getSessions(id);
                const uniqueAccountLabels = new Set();
                for (const session of sessions) {
                    if (!uniqueAccountLabels.has(session.account.label)) {
                        uniqueAccountLabels.add(session.account.label);
                        accounts.push({ providerId: id, providerLabel, accountLabel: session.account.label });
                    }
                }
            }
            const pick = await this._quickInputService.pick(accounts.map(account => ({
                providerId: account.providerId,
                label: account.accountLabel,
                description: account.providerLabel
            })), {
                placeHolder: localize('pickAccount', "Pick an account to manage trusted MCP servers for"),
                matchOnDescription: true,
            });
            if (pick) {
                providerId = pick.providerId;
                accountLabel = pick.label;
            }
            else {
                return { providerId: undefined, accountLabel: undefined };
            }
        }
        return { providerId, accountLabel };
    }
    async _getItems(providerId, accountLabel) {
        let allowedMcpServers = this._mcpServerAuthenticationAccessService.readAllowedMcpServers(providerId, accountLabel);
        // only include MCP servers that are installed
        // TODO: improve?
        const resolvedMcpServers = await Promise.all(allowedMcpServers.map(server => this._mcpServerService.servers.get().find(s => s.definition.id === server.id)));
        allowedMcpServers = resolvedMcpServers
            .map((server, i) => server ? allowedMcpServers[i] : undefined)
            .filter(server => !!server);
        const trustedMcpServerAuthAccess = this._productService.trustedMcpAuthAccess;
        const trustedMcpServerIds = 
        // Case 1: trustedMcpServerAuthAccess is an array
        Array.isArray(trustedMcpServerAuthAccess)
            ? trustedMcpServerAuthAccess
            // Case 2: trustedMcpServerAuthAccess is an object
            : typeof trustedMcpServerAuthAccess === 'object'
                ? trustedMcpServerAuthAccess[providerId] ?? []
                : [];
        for (const mcpServerId of trustedMcpServerIds) {
            const allowedMcpServer = allowedMcpServers.find(server => server.id === mcpServerId);
            if (!allowedMcpServer) {
                // Add the MCP server to the allowedMcpServers list
                // TODO: improve?
                const mcpServer = this._mcpServerService.servers.get().find(s => s.definition.id === mcpServerId);
                if (mcpServer) {
                    allowedMcpServers.push({
                        id: mcpServerId,
                        name: mcpServer.definition.label,
                        allowed: true,
                        trusted: true
                    });
                }
            }
            else {
                // Update the MCP server to be allowed
                allowedMcpServer.allowed = true;
                allowedMcpServer.trusted = true;
            }
        }
        if (!allowedMcpServers.length) {
            this._dialogService.info(localize('noTrustedMcpServers', "This account has not been used by any MCP servers."));
            return [];
        }
        const usages = this._mcpServerAuthenticationUsageService.readAccountUsages(providerId, accountLabel);
        const trustedMcpServers = [];
        const otherMcpServers = [];
        for (const mcpServer of allowedMcpServers) {
            const usage = usages.find(usage => mcpServer.id === usage.mcpServerId);
            mcpServer.lastUsed = usage?.lastUsed;
            if (mcpServer.trusted) {
                trustedMcpServers.push(mcpServer);
            }
            else {
                otherMcpServers.push(mcpServer);
            }
        }
        const sortByLastUsed = (a, b) => (b.lastUsed || 0) - (a.lastUsed || 0);
        const items = [
            ...otherMcpServers.sort(sortByLastUsed).map(this._toQuickPickItem),
            { type: 'separator', label: localize('trustedMcpServers', "Trusted by Microsoft") },
            ...trustedMcpServers.sort(sortByLastUsed).map(this._toQuickPickItem)
        ];
        return items;
    }
    _toQuickPickItem(mcpServer) {
        const lastUsed = mcpServer.lastUsed;
        const description = lastUsed
            ? localize({ key: 'accountLastUsedDate', comment: ['The placeholder {0} is a string with time information, such as "3 days ago"'] }, "Last used this account {0}", fromNow(lastUsed, true))
            : localize('notUsed', "Has not used this account");
        let tooltip;
        let disabled;
        if (mcpServer.trusted) {
            tooltip = localize('trustedMcpServerTooltip', "This MCP server is trusted by Microsoft and\nalways has access to this account");
            disabled = true;
        }
        return {
            label: mcpServer.name,
            mcpServer,
            description,
            tooltip,
            disabled,
            buttons: [{
                    tooltip: localize('accountPreferences', "Manage account preferences for this MCP server"),
                    iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                }],
            picked: mcpServer.allowed === undefined || mcpServer.allowed
        };
    }
    _createQuickPick(disposableStore, providerId, accountLabel) {
        const quickPick = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
        quickPick.canSelectMany = true;
        quickPick.customButton = true;
        quickPick.customLabel = localize('manageTrustedMcpServers.cancel', 'Cancel');
        quickPick.title = localize('manageTrustedMcpServers', "Manage Trusted MCP Servers");
        quickPick.placeholder = localize('manageMcpServers', "Choose which MCP servers can access this account");
        disposableStore.add(quickPick.onDidAccept(() => {
            const updatedAllowedList = quickPick.items
                .filter((item) => item.type !== 'separator')
                .map(i => i.mcpServer);
            const allowedMcpServersSet = new Set(quickPick.selectedItems.map(i => i.mcpServer));
            updatedAllowedList.forEach(mcpServer => {
                mcpServer.allowed = allowedMcpServersSet.has(mcpServer);
            });
            this._mcpServerAuthenticationAccessService.updateAllowedMcpServers(providerId, accountLabel, updatedAllowedList);
            quickPick.hide();
        }));
        disposableStore.add(quickPick.onDidHide(() => {
            disposableStore.dispose();
        }));
        disposableStore.add(quickPick.onDidCustom(() => {
            quickPick.hide();
        }));
        disposableStore.add(quickPick.onDidTriggerItemButton(e => this._commandService.executeCommand('_manageAccountPreferencesForMcpServer', e.item.mcpServer.id, providerId)));
        return quickPick;
    }
};
ManageTrustedMcpServersForAccountActionImpl = __decorate([
    __param(0, IProductService),
    __param(1, IMcpService),
    __param(2, IDialogService),
    __param(3, IQuickInputService),
    __param(4, IAuthenticationService),
    __param(5, IAuthenticationMcpUsageService),
    __param(6, IAuthenticationMcpAccessService),
    __param(7, ICommandService)
], ManageTrustedMcpServersForAccountActionImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlVHJ1c3RlZE1jcFNlcnZlcnNGb3JBY2NvdW50QWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9hdXRoZW50aWNhdGlvbi9icm93c2VyL2FjdGlvbnMvbWFuYWdlVHJ1c3RlZE1jcFNlcnZlcnNGb3JBY2NvdW50QWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSwrREFBK0QsQ0FBQztBQUN4SCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLGtCQUFrQixFQUF1QyxNQUFNLHlEQUF5RCxDQUFDO0FBQ2xJLE9BQU8sRUFBb0IsK0JBQStCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUNsSixPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSw4RUFBOEUsQ0FBQztBQUM5SCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN0RyxP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