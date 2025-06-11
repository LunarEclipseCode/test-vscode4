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
import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import * as nls from '../../../nls.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IAuthenticationService, IAuthenticationExtensionsService, INTERNAL_AUTH_PROVIDER_PREFIX as INTERNAL_MODEL_AUTH_PROVIDER_PREFIX } from '../../services/authentication/common/authentication.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import Severity from '../../../base/common/severity.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { Emitter } from '../../../base/common/event.js';
import { IAuthenticationAccessService } from '../../services/authentication/browser/authenticationAccessService.js';
import { IAuthenticationUsageService } from '../../services/authentication/browser/authenticationUsageService.js';
import { getAuthenticationProviderActivationEvent } from '../../services/authentication/browser/authenticationService.js';
import { URI } from '../../../base/common/uri.js';
import { IOpenerService } from '../../../platform/opener/common/opener.js';
import { CancellationError } from '../../../base/common/errors.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IURLService } from '../../../platform/url/common/url.js';
import { DeferredPromise, raceTimeout } from '../../../base/common/async.js';
import { IDynamicAuthenticationProviderStorageService } from '../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { IClipboardService } from '../../../platform/clipboard/common/clipboardService.js';
export class MainThreadAuthenticationProvider extends Disposable {
    constructor(_proxy, id, label, supportsMultipleAccounts, authorizationServers, notificationService, onDidChangeSessionsEmitter) {
        super();
        this._proxy = _proxy;
        this.id = id;
        this.label = label;
        this.supportsMultipleAccounts = supportsMultipleAccounts;
        this.authorizationServers = authorizationServers;
        this.notificationService = notificationService;
        this.onDidChangeSessions = onDidChangeSessionsEmitter.event;
    }
    async getSessions(scopes, options) {
        return this._proxy.$getSessions(this.id, scopes, options);
    }
    createSession(scopes, options) {
        return this._proxy.$createSession(this.id, scopes, options);
    }
    async removeSession(sessionId) {
        await this._proxy.$removeSession(this.id, sessionId);
        this.notificationService.info(nls.localize('signedOut', "Successfully signed out."));
    }
}
let MainThreadAuthentication = class MainThreadAuthentication extends Disposable {
    constructor(extHostContext, authenticationService, authenticationExtensionsService, authenticationAccessService, authenticationUsageService, dialogService, notificationService, extensionService, telemetryService, openerService, logService, urlService, dynamicAuthProviderStorageService, clipboardService) {
        super();
        this.authenticationService = authenticationService;
        this.authenticationExtensionsService = authenticationExtensionsService;
        this.authenticationAccessService = authenticationAccessService;
        this.authenticationUsageService = authenticationUsageService;
        this.dialogService = dialogService;
        this.notificationService = notificationService;
        this.extensionService = extensionService;
        this.telemetryService = telemetryService;
        this.openerService = openerService;
        this.logService = logService;
        this.urlService = urlService;
        this.dynamicAuthProviderStorageService = dynamicAuthProviderStorageService;
        this.clipboardService = clipboardService;
        this._registrations = this._register(new DisposableMap());
        this._sentProviderUsageEvents = new Set();
        // TODO@TylerLeonhardt this is a temporary addition to telemetry to understand what extensions are overriding the client id.
        // We can use this telemetry to reach out to these extension authors and let them know that they many need configuration changes
        // due to the adoption of the Microsoft broker.
        // Remove this in a few iterations.
        this._sentClientIdUsageEvents = new Set();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostAuthentication);
        this._register(this.authenticationService.onDidChangeSessions(e => this._proxy.$onDidChangeAuthenticationSessions(e.providerId, e.label)));
        this._register(this.authenticationService.onDidUnregisterAuthenticationProvider(e => this._proxy.$onDidUnregisterAuthenticationProvider(e.id)));
        this._register(this.authenticationExtensionsService.onDidChangeAccountPreference(e => {
            const providerInfo = this.authenticationService.getProvider(e.providerId);
            this._proxy.$onDidChangeAuthenticationSessions(providerInfo.id, providerInfo.label, e.extensionIds);
        }));
        // Listen for dynamic authentication provider token changes
        this._register(this.dynamicAuthProviderStorageService.onDidChangeTokens(e => {
            this._proxy.$onDidChangeDynamicAuthProviderTokens(e.authProviderId, e.clientId, e.tokens);
        }));
        this._register(authenticationService.registerAuthenticationProviderHostDelegate({
            // Prefer Node.js extension hosts when they're available. No CORS issues etc.
            priority: extHostContext.extensionHostKind === 2 /* ExtensionHostKind.LocalWebWorker */ ? 0 : 1,
            create: async (authorizationServer, serverMetadata, resource) => {
                const authProviderId = authorizationServer.toString(true);
                const clientId = this.dynamicAuthProviderStorageService.getClientId(authProviderId);
                let initialTokens = undefined;
                if (clientId) {
                    initialTokens = await this.dynamicAuthProviderStorageService.getSessionsForDynamicAuthProvider(authProviderId, clientId);
                }
                return await this._proxy.$registerDynamicAuthProvider(authorizationServer, serverMetadata, resource, clientId, initialTokens);
            }
        }));
    }
    async $registerAuthenticationProvider(id, label, supportsMultipleAccounts, supportedAuthorizationServer = []) {
        if (!this.authenticationService.declaredProviders.find(p => p.id === id)) {
            // If telemetry shows that this is not happening much, we can instead throw an error here.
            this.logService.warn(`Authentication provider ${id} was not declared in the Extension Manifest.`);
            this.telemetryService.publicLog2('authentication.providerNotDeclared', { id });
        }
        const emitter = new Emitter();
        this._registrations.set(id, emitter);
        const supportedAuthorizationServerUris = supportedAuthorizationServer.map(i => URI.revive(i));
        const provider = new MainThreadAuthenticationProvider(this._proxy, id, label, supportsMultipleAccounts, supportedAuthorizationServerUris, this.notificationService, emitter);
        this.authenticationService.registerAuthenticationProvider(id, provider);
    }
    async $unregisterAuthenticationProvider(id) {
        this._registrations.deleteAndDispose(id);
        this.authenticationService.unregisterAuthenticationProvider(id);
    }
    async $ensureProvider(id) {
        if (!this.authenticationService.isAuthenticationProviderRegistered(id)) {
            return await this.extensionService.activateByEvent(getAuthenticationProviderActivationEvent(id), 1 /* ActivationKind.Immediate */);
        }
    }
    async $sendDidChangeSessions(providerId, event) {
        const obj = this._registrations.get(providerId);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    $removeSession(providerId, sessionId) {
        return this.authenticationService.removeSession(providerId, sessionId);
    }
    async $waitForUriHandler(expectedUri) {
        const deferredPromise = new DeferredPromise();
        const disposable = this.urlService.registerHandler({
            handleURL: async (uri) => {
                if (uri.scheme !== expectedUri.scheme || uri.authority !== expectedUri.authority || uri.path !== expectedUri.path) {
                    return false;
                }
                deferredPromise.complete(uri);
                disposable.dispose();
                return true;
            }
        });
        const result = await raceTimeout(deferredPromise.p, 5 * 60 * 1000); // 5 minutes
        if (!result) {
            throw new Error('Timed out waiting for URI handler');
        }
        return await deferredPromise.p;
    }
    $showContinueNotification(message) {
        const yes = nls.localize('yes', "Yes");
        const no = nls.localize('no', "No");
        const deferredPromise = new DeferredPromise();
        let result = false;
        const handle = this.notificationService.prompt(Severity.Warning, message, [{
                label: yes,
                run: () => result = true
            }, {
                label: no,
                run: () => result = false
            }]);
        const disposable = handle.onDidClose(() => {
            deferredPromise.complete(result);
            disposable.dispose();
        });
        return deferredPromise.p;
    }
    async $registerDynamicAuthenticationProvider(id, label, authorizationServer, clientId) {
        await this.$registerAuthenticationProvider(id, label, false, [authorizationServer]);
        this.dynamicAuthProviderStorageService.storeClientId(id, URI.revive(authorizationServer).toString(true), clientId, label);
    }
    async $setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions) {
        await this.dynamicAuthProviderStorageService.setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions);
    }
    async loginPrompt(provider, extensionName, recreatingSession, options) {
        let message;
        // An internal provider is a special case which is for model access only.
        if (provider.id.startsWith(INTERNAL_MODEL_AUTH_PROVIDER_PREFIX)) {
            message = nls.localize('confirmModelAccess', "The extension '{0}' wants to access the language models provided by {1}.", extensionName, provider.label);
        }
        else {
            message = recreatingSession
                ? nls.localize('confirmRelogin', "The extension '{0}' wants you to sign in again using {1}.", extensionName, provider.label)
                : nls.localize('confirmLogin', "The extension '{0}' wants to sign in using {1}.", extensionName, provider.label);
        }
        const buttons = [
            {
                label: nls.localize({ key: 'allow', comment: ['&& denotes a mnemonic'] }, "&&Allow"),
                run() {
                    return true;
                },
            }
        ];
        if (options?.learnMore) {
            buttons.push({
                label: nls.localize('learnMore', "Learn more"),
                run: async () => {
                    const result = this.loginPrompt(provider, extensionName, recreatingSession, options);
                    await this.openerService.open(URI.revive(options.learnMore), { allowCommands: true });
                    return await result;
                }
            });
        }
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message,
            buttons,
            detail: options?.detail,
            cancelButton: true,
        });
        return result ?? false;
    }
    async continueWithIncorrectAccountPrompt(chosenAccountLabel, requestedAccountLabel) {
        const result = await this.dialogService.prompt({
            message: nls.localize('incorrectAccount', "Incorrect account detected"),
            detail: nls.localize('incorrectAccountDetail', "The chosen account, {0}, does not match the requested account, {1}.", chosenAccountLabel, requestedAccountLabel),
            type: Severity.Warning,
            cancelButton: true,
            buttons: [
                {
                    label: nls.localize('keep', 'Keep {0}', chosenAccountLabel),
                    run: () => chosenAccountLabel
                },
                {
                    label: nls.localize('loginWith', 'Login with {0}', requestedAccountLabel),
                    run: () => requestedAccountLabel
                }
            ],
        });
        if (!result.result) {
            throw new CancellationError();
        }
        return result.result === chosenAccountLabel;
    }
    async doGetSession(providerId, scopes, extensionId, extensionName, options) {
        const authorizationServer = URI.revive(options.authorizationServer);
        const sessions = await this.authenticationService.getSessions(providerId, scopes, { account: options.account, authorizationServer }, true);
        const provider = this.authenticationService.getProvider(providerId);
        // Error cases
        if (options.forceNewSession && options.createIfNone) {
            throw new Error('Invalid combination of options. Please remove one of the following: forceNewSession, createIfNone');
        }
        if (options.forceNewSession && options.silent) {
            throw new Error('Invalid combination of options. Please remove one of the following: forceNewSession, silent');
        }
        if (options.createIfNone && options.silent) {
            throw new Error('Invalid combination of options. Please remove one of the following: createIfNone, silent');
        }
        if (options.clearSessionPreference) {
            // Clearing the session preference is usually paired with createIfNone, so just remove the preference and
            // defer to the rest of the logic in this function to choose the session.
            this._removeAccountPreference(extensionId, providerId, scopes);
        }
        const matchingAccountPreferenceSession = 
        // If an account was passed in, that takes precedence over the account preference
        options.account
            // We only support one session per account per set of scopes so grab the first one here
            ? sessions[0]
            : this._getAccountPreference(extensionId, providerId, scopes, sessions);
        // Check if the sessions we have are valid
        if (!options.forceNewSession && sessions.length) {
            // If we have an existing session preference, use that. If not, we'll return any valid session at the end of this function.
            if (matchingAccountPreferenceSession && this.authenticationAccessService.isAccessAllowed(providerId, matchingAccountPreferenceSession.account.label, extensionId)) {
                return matchingAccountPreferenceSession;
            }
            // If we only have one account for a single auth provider, lets just check if it's allowed and return it if it is.
            if (!provider.supportsMultipleAccounts && this.authenticationAccessService.isAccessAllowed(providerId, sessions[0].account.label, extensionId)) {
                return sessions[0];
            }
        }
        // We may need to prompt because we don't have a valid session
        // modal flows
        if (options.createIfNone || options.forceNewSession) {
            let uiOptions;
            if (typeof options.forceNewSession === 'object') {
                uiOptions = options.forceNewSession;
            }
            else if (typeof options.createIfNone === 'object') {
                uiOptions = options.createIfNone;
            }
            // We only want to show the "recreating session" prompt if we are using forceNewSession & there are sessions
            // that we will be "forcing through".
            const recreatingSession = !!(options.forceNewSession && sessions.length);
            const isAllowed = await this.loginPrompt(provider, extensionName, recreatingSession, uiOptions);
            if (!isAllowed) {
                throw new Error('User did not consent to login.');
            }
            let session;
            if (sessions?.length && !options.forceNewSession) {
                session = provider.supportsMultipleAccounts && !options.account
                    ? await this.authenticationExtensionsService.selectSession(providerId, extensionId, extensionName, scopes, sessions)
                    : sessions[0];
            }
            else {
                const accountToCreate = options.account ?? matchingAccountPreferenceSession?.account;
                do {
                    session = await this.authenticationService.createSession(providerId, scopes, {
                        activateImmediate: true,
                        account: accountToCreate,
                        authorizationServer
                    });
                } while (accountToCreate
                    && accountToCreate.label !== session.account.label
                    && !await this.continueWithIncorrectAccountPrompt(session.account.label, accountToCreate.label));
            }
            this.authenticationAccessService.updateAllowedExtensions(providerId, session.account.label, [{ id: extensionId, name: extensionName, allowed: true }]);
            this._updateAccountPreference(extensionId, providerId, session);
            return session;
        }
        // For the silent flows, if we have a session but we don't have a session preference, we'll return the first one that is valid.
        if (!matchingAccountPreferenceSession && !this.authenticationExtensionsService.getAccountPreference(extensionId, providerId)) {
            const validSession = sessions.find(session => this.authenticationAccessService.isAccessAllowed(providerId, session.account.label, extensionId));
            if (validSession) {
                return validSession;
            }
        }
        // passive flows (silent or default)
        if (!options.silent) {
            // If there is a potential session, but the extension doesn't have access to it, use the "grant access" flow,
            // otherwise request a new one.
            sessions.length
                ? this.authenticationExtensionsService.requestSessionAccess(providerId, extensionId, extensionName, scopes, sessions)
                : await this.authenticationExtensionsService.requestNewSession(providerId, scopes, extensionId, extensionName);
        }
        return undefined;
    }
    async $getSession(providerId, scopes, extensionId, extensionName, options) {
        this.sendClientIdUsageTelemetry(extensionId, providerId, scopes);
        const session = await this.doGetSession(providerId, scopes, extensionId, extensionName, options);
        if (session) {
            this.sendProviderUsageTelemetry(extensionId, providerId);
            this.authenticationUsageService.addAccountUsage(providerId, session.account.label, scopes, extensionId, extensionName);
        }
        return session;
    }
    async $getAccounts(providerId) {
        const accounts = await this.authenticationService.getAccounts(providerId);
        return accounts;
    }
    sendClientIdUsageTelemetry(extensionId, providerId, scopes) {
        const containsVSCodeClientIdScope = scopes.some(scope => scope.startsWith('VSCODE_CLIENT_ID:'));
        const key = `${extensionId}|${providerId}|${containsVSCodeClientIdScope}`;
        if (this._sentClientIdUsageEvents.has(key)) {
            return;
        }
        this._sentClientIdUsageEvents.add(key);
        if (containsVSCodeClientIdScope) {
            this.telemetryService.publicLog2('authentication.clientIdUsage', { extensionId });
        }
    }
    sendProviderUsageTelemetry(extensionId, providerId) {
        const key = `${extensionId}|${providerId}`;
        if (this._sentProviderUsageEvents.has(key)) {
            return;
        }
        this._sentProviderUsageEvents.add(key);
        this.telemetryService.publicLog2('authentication.providerUsage', { providerId, extensionId });
    }
    //#region Account Preferences
    // TODO@TylerLeonhardt: Update this after a few iterations to no longer fallback to the session preference
    _getAccountPreference(extensionId, providerId, scopes, sessions) {
        if (sessions.length === 0) {
            return undefined;
        }
        const accountNamePreference = this.authenticationExtensionsService.getAccountPreference(extensionId, providerId);
        if (accountNamePreference) {
            const session = sessions.find(session => session.account.label === accountNamePreference);
            return session;
        }
        const sessionIdPreference = this.authenticationExtensionsService.getSessionPreference(providerId, extensionId, scopes);
        if (sessionIdPreference) {
            const session = sessions.find(session => session.id === sessionIdPreference);
            if (session) {
                // Migrate the session preference to the account preference
                this.authenticationExtensionsService.updateAccountPreference(extensionId, providerId, session.account);
                return session;
            }
        }
        return undefined;
    }
    _updateAccountPreference(extensionId, providerId, session) {
        this.authenticationExtensionsService.updateAccountPreference(extensionId, providerId, session.account);
        this.authenticationExtensionsService.updateSessionPreference(providerId, extensionId, session);
    }
    _removeAccountPreference(extensionId, providerId, scopes) {
        this.authenticationExtensionsService.removeAccountPreference(extensionId, providerId);
        this.authenticationExtensionsService.removeSessionPreference(providerId, extensionId, scopes);
    }
    //#endregion
    async $showDeviceCodeModal(userCode, verificationUri) {
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message: nls.localize('deviceCodeTitle', "Device Code Authentication"),
            detail: nls.localize('deviceCodeDetail', "Your code: {0}\n\nTo complete authentication, navigate to {1} and enter the code above.", userCode, verificationUri),
            buttons: [
                {
                    label: nls.localize('copyAndContinue', "Copy & Continue"),
                    run: () => true
                }
            ],
            cancelButton: true
        });
        if (result) {
            // Open verification URI
            try {
                await this.clipboardService.writeText(userCode);
                return await this.openerService.open(URI.parse(verificationUri));
            }
            catch (error) {
                this.notificationService.error(nls.localize('failedToOpenUri', "Failed to open {0}", verificationUri));
            }
        }
        return false;
    }
};
MainThreadAuthentication = __decorate([
    extHostNamedCustomer(MainContext.MainThreadAuthentication),
    __param(1, IAuthenticationService),
    __param(2, IAuthenticationExtensionsService),
    __param(3, IAuthenticationAccessService),
    __param(4, IAuthenticationUsageService),
    __param(5, IDialogService),
    __param(6, INotificationService),
    __param(7, IExtensionService),
    __param(8, ITelemetryService),
    __param(9, IOpenerService),
    __param(10, ILogService),
    __param(11, IURLService),
    __param(12, IDynamicAuthenticationProviderStorageService),
    __param(13, IClipboardService)
], MainThreadAuthentication);
export { MainThreadAuthentication };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEF1dGhlbnRpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZEF1dGhlbnRpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQUUsb0JBQW9CLEVBQW1CLE1BQU0sc0RBQXNELENBQUM7QUFDN0csT0FBTyxFQUEwSCxzQkFBc0IsRUFBRSxnQ0FBZ0MsRUFBRSw2QkFBNkIsSUFBSSxtQ0FBbUMsRUFBdUUsTUFBTSx3REFBd0QsQ0FBQztBQUNyWSxPQUFPLEVBQThCLGNBQWMsRUFBRSxXQUFXLEVBQWlDLE1BQU0sK0JBQStCLENBQUM7QUFDdkksT0FBTyxFQUFFLGNBQWMsRUFBaUIsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RixPQUFPLFFBQVEsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM3RixPQUFPLEVBQWtCLGlCQUFpQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDcEYsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQ2xILE9BQU8sRUFBRSx3Q0FBd0MsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQzFILE9BQU8sRUFBRSxHQUFHLEVB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