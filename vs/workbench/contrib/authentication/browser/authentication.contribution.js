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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { SignOutOfAccountAction } from './actions/signOutOfAccountAction.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../services/environment/browser/environmentService.js';
import { Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { ManageTrustedExtensionsForAccountAction } from './actions/manageTrustedExtensionsForAccountAction.js';
import { ManageAccountPreferencesForExtensionAction } from './actions/manageAccountPreferencesForExtensionAction.js';
import { IAuthenticationUsageService } from '../../../services/authentication/browser/authenticationUsageService.js';
import { ManageAccountPreferencesForMcpServerAction } from './actions/manageAccountPreferencesForMcpServerAction.js';
import { ManageTrustedMcpServersForAccountAction } from './actions/manageTrustedMcpServersForAccountAction.js';
import { RemoveDynamicAuthenticationProvidersAction } from './actions/manageDynamicAuthenticationProvidersAction.js';
const codeExchangeProxyCommand = CommandsRegistry.registerCommand('workbench.getCodeExchangeProxyEndpoints', function (accessor, _) {
    const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
    return environmentService.options?.codeExchangeProxyEndpoints;
});
class AuthenticationDataRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.authentication;
    }
    render(manifest) {
        const authentication = manifest.contributes?.authentication || [];
        if (!authentication.length) {
            return { data: { headers: [], rows: [] }, dispose: () => { } };
        }
        const headers = [
            localize('authenticationlabel', "Label"),
            localize('authenticationid', "ID"),
            localize('authenticationMcpAuthorizationServers', "MCP Authorization Servers")
        ];
        const rows = authentication
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(auth => {
            return [
                auth.label,
                auth.id,
                (auth.authorizationServerGlobs ?? []).join(',\n')
            ];
        });
        return {
            data: {
                headers,
                rows
            },
            dispose: () => { }
        };
    }
}
const extensionFeature = Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
    id: 'authentication',
    label: localize('authentication', "Authentication"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(AuthenticationDataRenderer),
});
let AuthenticationContribution = class AuthenticationContribution extends Disposable {
    static { this.ID = 'workbench.contrib.authentication'; }
    constructor(_authenticationService) {
        super();
        this._authenticationService = _authenticationService;
        this._placeholderMenuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
            command: {
                id: 'noAuthenticationProviders',
                title: localize('authentication.Placeholder', "No accounts requested yet..."),
                precondition: ContextKeyExpr.false()
            },
        });
        this._register(codeExchangeProxyCommand);
        this._register(extensionFeature);
        // Clear the placeholder menu item if there are already providers registered.
        if (_authenticationService.getProviderIds().length) {
            this._clearPlaceholderMenuItem();
        }
        this._registerHandlers();
        this._registerActions();
    }
    _registerHandlers() {
        this._register(this._authenticationService.onDidRegisterAuthenticationProvider(_e => {
            this._clearPlaceholderMenuItem();
        }));
        this._register(this._authenticationService.onDidUnregisterAuthenticationProvider(_e => {
            if (!this._authenticationService.getProviderIds().length) {
                this._placeholderMenuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
                    command: {
                        id: 'noAuthenticationProviders',
                        title: localize('loading', "Loading..."),
                        precondition: ContextKeyExpr.false()
                    }
                });
            }
        }));
    }
    _registerActions() {
        this._register(registerAction2(SignOutOfAccountAction));
        this._register(registerAction2(ManageTrustedExtensionsForAccountAction));
        this._register(registerAction2(ManageAccountPreferencesForExtensionAction));
        this._register(registerAction2(ManageTrustedMcpServersForAccountAction));
        this._register(registerAction2(ManageAccountPreferencesForMcpServerAction));
        this._register(registerAction2(RemoveDynamicAuthenticationProvidersAction));
    }
    _clearPlaceholderMenuItem() {
        this._placeholderMenuItem?.dispose();
        this._placeholderMenuItem = undefined;
    }
};
AuthenticationContribution = __decorate([
    __param(0, IAuthenticationService)
], AuthenticationContribution);
let AuthenticationUsageContribution = class AuthenticationUsageContribution {
    static { this.ID = 'workbench.contrib.authenticationUsage'; }
    constructor(_authenticationUsageService) {
        this._authenticationUsageService = _authenticationUsageService;
        this._initializeExtensionUsageCache();
    }
    async _initializeExtensionUsageCache() {
        await this._authenticationUsageService.initializeExtensionUsageCache();
    }
};
AuthenticationUsageContribution = __decorate([
    __param(0, IAuthenticationUsageService)
], AuthenticationUsageContribution);
registerWorkbenchContribution2(AuthenticationContribution.ID, AuthenticationContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(AuthenticationUsageContribution.ID, AuthenticationUsageContribution, 4 /* WorkbenchPhase.Eventually */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb24uY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFDL0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUV0RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDMUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBMEMsOEJBQThCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMxSCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNsSCxPQUFPLEVBQUUsVUFBVSxFQUFtRyxNQUFNLG1FQUFtRSxDQUFDO0FBQ2hNLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQy9HLE9BQU8sRUFBRSwwQ0FBMEMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3JILE9BQU8sRUFBRSwyQkFBMkIsRUFB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