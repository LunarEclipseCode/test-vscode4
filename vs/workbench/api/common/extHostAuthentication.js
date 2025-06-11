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
import * as nls from '../../../nls.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { MainContext } from './extHost.protocol.js';
import { Disposable, ProgressLocation } from './extHostTypes.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { INTERNAL_AUTH_PROVIDER_PREFIX } from '../../services/authentication/common/authentication.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { URI } from '../../../base/common/uri.js';
import { fetchDynamicRegistration, getClaimsFromJWT, isAuthorizationTokenResponse } from '../../../base/common/oauth.js';
import { IExtHostWindow } from './extHostWindow.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { ILoggerService } from '../../../platform/log/common/log.js';
import { autorun, derivedOpts, observableValue } from '../../../base/common/observable.js';
import { stringHash } from '../../../base/common/hash.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { IExtHostUrlsService } from './extHostUrls.js';
import { encodeBase64, VSBuffer } from '../../../base/common/buffer.js';
import { equals as arraysEqual } from '../../../base/common/arrays.js';
import { IExtHostProgress } from './extHostProgress.js';
import { CancellationError, isCancellationError } from '../../../base/common/errors.js';
import { raceCancellationError } from '../../../base/common/async.js';
export const IExtHostAuthentication = createDecorator('IExtHostAuthentication');
let ExtHostAuthentication = class ExtHostAuthentication {
    constructor(extHostRpc, _initData, _extHostWindow, _extHostUrls, _extHostProgress, _extHostLoggerService) {
        this._initData = _initData;
        this._extHostWindow = _extHostWindow;
        this._extHostUrls = _extHostUrls;
        this._extHostProgress = _extHostProgress;
        this._extHostLoggerService = _extHostLoggerService;
        this._dynamicAuthProviderCtor = DynamicAuthProvider;
        this._authenticationProviders = new Map();
        this._onDidChangeSessions = new Emitter();
        this._getSessionTaskSingler = new TaskSingler();
        this._onDidDynamicAuthProviderTokensChange = new Emitter();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadAuthentication);
    }
    /**
     * This sets up an event that will fire when the auth sessions change with a built-in filter for the extensionId
     * if a session change only affects a specific extension.
     * @param extensionId The extension that is interested in the event.
     * @returns An event with a built-in filter for the extensionId
     */
    getExtensionScopedSessionsEvent(extensionId) {
        const normalizedExtensionId = extensionId.toLowerCase();
        return Event.chain(this._onDidChangeSessions.event, ($) => $
            .filter(e => !e.extensionIdFilter || e.extensionIdFilter.includes(normalizedExtensionId))
            .map(e => ({ provider: e.provider })));
    }
    async getSession(requestingExtension, providerId, scopes, options = {}) {
        const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
        const sortedScopes = [...scopes].sort().join(' ');
        const keys = Object.keys(options);
        const optionsStr = keys.sort().map(key => `${key}:${!!options[key]}`).join(', ');
        return await this._getSessionTaskSingler.getOrCreate(`${extensionId} ${providerId} ${sortedScopes} ${optionsStr}`, async () => {
            await this._proxy.$ensureProvider(providerId);
            const extensionName = requestingExtension.displayName || requestingExtension.name;
            return this._proxy.$getSession(providerId, scopes, extensionId, extensionName, options);
        });
    }
    async getAccounts(providerId) {
        await this._proxy.$ensureProvider(providerId);
        return await this._proxy.$getAccounts(providerId);
    }
    async removeSession(providerId, sessionId) {
        const providerData = this._authenticationProviders.get(providerId);
        if (!providerData) {
            return this._proxy.$removeSession(providerId, sessionId);
        }
        return providerData.provider.removeSession(sessionId);
    }
    registerAuthenticationProvider(id, label, provider, options) {
        if (this._authenticationProviders.get(id)) {
            throw new Error(`An authentication provider with id '${id}' is already registered.`);
        }
        this._authenticationProviders.set(id, { label, provider, options: options ?? { supportsMultipleAccounts: false } });
        const listener = provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(id, e));
        this._proxy.$registerAuthenticationProvider(id, label, options?.supportsMultipleAccounts ?? false, options?.supportedAuthorizationServers);
        return new Disposable(() => {
            listener.dispose();
            this._authenticationProviders.delete(id);
            this._proxy.$unregisterAuthenticationProvider(id);
        });
    }
    async $createSession(providerId, scopes, options) {
        const providerData = this._authenticationProviders.get(providerId);
        if (providerData) {
            options.authorizationServer = URI.revive(options.authorizationServer);
            return await providerData.provider.createSession(scopes, options);
        }
        throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
    }
    async $removeSession(providerId, sessionId) {
        const providerData = this._authenticationProviders.get(providerId);
        if (providerData) {
            return await providerData.provider.removeSession(sessionId);
        }
        throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
    }
    async $getSessions(providerId, scopes, options) {
        const providerData = this._authenticationProviders.get(providerId);
        if (providerData) {
            options.authorizationServer = URI.revive(options.authorizationServer);
            return await providerData.provider.getSessions(scopes, options);
        }
        throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
    }
    $onDidChangeAuthenticationSessions(id, label, extensionIdFilter) {
        // Don't fire events for the internal auth providers
        if (!id.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
            this._onDidChangeSessions.fire({ provider: { id, label }, extensionIdFilter });
        }
        return Promise.resolve();
    }
    // Today, this only handles unregistering extensions that have disposables...
    // so basiscally just the dynmaic ones. This was done to fix a bug where
    // there was a racecondition between this event and re-registering a provider
    // with the same id. (https://github.com/microsoft/vscode-copilot/issues/18045)
    // This works for now, but should be cleaned up so theres one flow for register/unregister
    $onDidUnregisterAuthenticationProvider(id) {
        const providerData = this._authenticationProviders.get(id);
        if (providerData?.disposable) {
            providerData.disposable.dispose();
            this._authenticationProviders.delete(id);
        }
        return Promise.resolve();
    }
    async $registerDynamicAuthProvider(authorizationServerComponents, serverMetadata, resourceMetadata, clientId, initialTokens) {
        if (!clientId) {
            if (!serverMetadata.registration_endpoint) {
                throw new Error('Server does not support dynamic registration');
            }
            try {
                const registration = await fetchDynamicRegistration(serverMetadata.registration_endpoint, this._initData.environment.appName);
                clientId = registration.client_id;
            }
            catch (err) {
                throw new Error(`Dynamic registration failed: ${err.message}`);
            }
        }
        const provider = new this._dynamicAuthProviderCtor(this._extHostWindow, this._extHostUrls, this._initData, this._extHostProgress, this._extHostLoggerService, this._proxy, URI.revive(authorizationServerComponents), serverMetadata, resourceMetadata, clientId, this._onDidDynamicAuthProviderTokensChange, initialTokens || []);
        const disposable = provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(provider.id, e));
        this._authenticationProviders.set(provider.id, {
            label: provider.label,
            provider,
            disposable: Disposable.from(provider, disposable),
            options: { supportsMultipleAccounts: false }
        });
        await this._proxy.$registerDynamicAuthenticationProvider(provider.id, provider.label, provider.authorizationServer, provider.clientId);
        return provider.id;
    }
    async $onDidChangeDynamicAuthProviderTokens(authProviderId, clientId, tokens) {
        this._onDidDynamicAuthProviderTokensChange.fire({ authProviderId, clientId, tokens });
    }
};
ExtHostAuthentication = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostInitDataService),
    __param(2, IExtHostWindow),
    __param(3, IExtHostUrlsService),
    __param(4, IExtHostProgress),
    __param(5, ILoggerService)
], ExtHostAuthentication);
export { ExtHostAuthentication };
class TaskSingler {
    constructor() {
        this._inFlightPromises = new Map();
    }
    getOrCreate(key, promiseFactory) {
        const inFlight = this._inFlightPromises.get(key);
        if (inFlight) {
            return inFlight;
        }
        const promise = promiseFactory().finally(() => this._inFlightPromises.delete(key));
        this._inFlightPromises.set(key, promise);
        return promise;
    }
}
let DynamicAuthProvider = class DynamicAuthProvider {
    constructor(_extHostWindow, _extHostUrls, _initData, _extHostProgress, loggerService, _proxy, authorizationServer, _serverMetadata, _resourceMetadata, clientId, onDidDynamicAuthProviderTokensChange, initialTokens) {
        this._extHostWindow = _extHostWindow;
        this._extHostUrls = _extHostUrls;
        this._initData = _initData;
        this._extHostProgress = _extHostProgress;
        this._proxy = _proxy;
        this.authorizationServer = authorizationServer;
        this._serverMetadata = _serverMetadata;
        this._resourceMetadata = _resourceMetadata;
        this.clientId = clientId;
        this._onDidChangeSessions = new Emitter();
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        const stringifiedServer = authorizationServer.toString(true);
        this.id = _resourceMetadata?.resource
            ? stringifiedServer + ' ' + _resourceMetadata?.resource
            : stringifiedServer;
        this.label = _resourceMetadata?.resource_name ?? this.authorizationServer.authority;
        this._logger = loggerService.createLogger(stringifiedServer, { name: this.label });
        this._disposable = new DisposableStore();
        this._disposable.add(this._onDidChangeSessions);
        const scopedEvent = Event.chain(onDidDynamicAuthProviderTokensChange.event, $ => $
            .filter(e => e.authProviderId === this.id && e.clientId === clientId)
            .map(e => e.tokens));
        this._tokenStore = this._disposable.add(new TokenStore({
            onDidChange: scopedEvent,
            set: (tokens) => _proxy.$setSessionsForDynamicAuthProvider(stringifiedServer, this.clientId, tokens),
        }, initialTokens, this._logger));
        this._disposable.add(this._tokenStore.onDidChangeSessions(e => this._onDidChangeSessions.fire(e)));
        // Will be extended later to support other flows
        this._createFlows = [{
                label: nls.localize('url handler', "URL Handler"),
                handler: (scopes, progress, token) => this._createWithUrlHandler(scopes, progress, token)
            }];
    }
    async getSessions(scopes, _options) {
        this._logger.info(`Getting sessions for scopes: ${scopes?.join(' ') ?? 'all'}`);
        if (!scopes) {
            return this._tokenStore.sessions;
        }
        // The oauth spec says tthat order doesn't matter so we sort the scopes for easy comparison
        // https://datatracker.ietf.org/doc/html/rfc6749#section-3.3
        // TODO@TylerLeonhardt: Do this for all scope handling in the auth APIs
        const sortedScopes = [...scopes].sort();
        const scopeStr = scopes.join(' ');
        let sessions = this._tokenStore.sessions.filter(session => arraysEqual([...session.scopes].sort(), sortedScopes));
        this._logger.info(`Found ${sessions.length} sessions for scopes: ${scopeStr}`);
        if (sessions.length) {
            const newTokens = [];
            const removedTokens = [];
            const tokenMap = new Map(this._tokenStore.tokens.map(token => [token.access_token, token]));
            for (const session of sessions) {
                const token = tokenMap.get(session.accessToken);
                if (token && token.expires_in) {
                    const now = Date.now();
                    const expiresInMS = token.expires_in * 1000;
                    // Check if the token is about to expire in 5 minutes or if it is expired
                    if (now > token.created_at + expiresInMS - (5 * 60 * 1000)) {
                        this._logger.info(`Token for session ${session.id} is about to expire, refreshing...`);
                        removedTokens.push(token);
                        if (!token.refresh_token) {
                            // No refresh token available, cannot refresh
                            this._logger.warn(`No refresh token available for scopes ${session.scopes.join(' ')}. Throwing away token.`);
                            continue;
                        }
                        try {
                            const newToken = await this.exchangeRefreshTokenForToken(token.refresh_token);
                            // TODO@TylerLeonhardt: When the core scope handling doesn't care about order, this check should be
                            // updated to not care about order
                            if (newToken.scope !== scopeStr) {
                                this._logger.warn(`Token scopes '${newToken.scope}' do not match requested scopes '${scopeStr}'. Overwriting token with what was requested...`);
                                newToken.scope = scopeStr;
                            }
                            this._logger.info(`Successfully created a new token for scopes ${session.scopes.join(' ')}.`);
                            newTokens.push(newToken);
                        }
                        catch (err) {
                            this._logger.error(`Failed to refresh token: ${err}`);
                        }
                    }
                }
            }
            if (newTokens.length || removedTokens.length) {
                this._tokenStore.update({ added: newTokens, removed: removedTokens });
                // Since we updated the tokens, we need to re-filter the sessions
                // to get the latest state
                sessions = this._tokenStore.sessions.filter(session => arraysEqual([...session.scopes].sort(), sortedScopes));
            }
            this._logger.info(`Found ${sessions.length} sessions for scopes: ${scopeStr}`);
            return sessions;
        }
        return [];
    }
    async createSession(scopes, _options) {
        this._logger.info(`Creating session for scopes: ${scopes.join(' ')}`);
        let token;
        for (let i = 0; i < this._createFlows.length; i++) {
            const { handler } = this._createFlows[i];
            try {
                token = await this._extHostProgress.withProgressFromSource({ label: this.label, id: this.id }, {
                    location: ProgressLocation.Notification,
                    title: nls.localize('authenticatingTo', "Authenticating to '{0}'", this.label),
                    cancellable: true
                }, (progress, token) => handler(scopes, progress, token));
                if (token) {
                    break;
                }
            }
            catch (err) {
                const nextMode = this._createFlows[i + 1]?.label;
                if (!nextMode) {
                    break; // No more flows to try
                }
                const message = isCancellationError(err)
                    ? nls.localize('userCanceledContinue', "Having trouble authenticating to '{0}'? Would you like to try a different way? ({1})", this.label, nextMode)
                    : nls.localize('continueWith', "You have not yet finished authenticating to '{0}'. Would you like to try a different way? ({1})", this.label, nextMode);
                const result = await this._proxy.$showContinueNotification(message);
                if (!result) {
                    throw new CancellationError();
                }
                this._logger.error(`Failed to create token via flow '${nextMode}': ${err}`);
            }
        }
        if (!token) {
            throw new Error('Failed to create authentication token');
        }
        if (token.scope !== scopes.join(' ')) {
            this._logger.warn(`Token scopes '${token.scope}' do not match requested scopes '${scopes.join(' ')}'. Overwriting token with what was requested...`);
            token.scope = scopes.join(' ');
        }
        // Store session for later retrieval
        this._tokenStore.update({ added: [{ ...token, created_at: Date.now() }], removed: [] });
        const session = this._tokenStore.sessions.find(t => t.accessToken === token.access_token);
        this._logger.info(`Created session for scopes: ${token.scope}`);
        return session;
    }
    async removeSession(sessionId) {
        this._logger.info(`Removing session with id: ${sessionId}`);
        const session = this._tokenStore.sessions.find(session => session.id === sessionId);
        if (!session) {
            this._logger.error(`Session with id ${sessionId} not found`);
            return;
        }
        const token = this._tokenStore.tokens.find(token => token.access_token === session.accessToken);
        if (!token) {
            this._logger.error(`Failed to retrieve token for removed session: ${session.id}`);
            return;
        }
        this._tokenStore.update({ added: [], removed: [token] });
        this._logger.info(`Removed token for session: ${session.id} with scopes: ${session.scopes.join(' ')}`);
    }
    dispose() {
        this._disposable.dispose();
    }
    async _createWithUrlHandler(scopes, progress, token) {
        // Generate PKCE code verifier (random string) and code challenge (SHA-256 hash of verifier)
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        // Generate a random state value to prevent CSRF
        const nonce = this.generateRandomString(32);
        const callbackUri = URI.parse(`${this._initData.environment.appUriScheme}://dynamicauthprovider/${this.authorizationServer.authority}/authorize?nonce=${nonce}`);
        let state;
        try {
            state = await this._extHostUrls.createAppUri(callbackUri);
        }
        catch (error) {
            throw new Error(`Failed to create external URI: ${error}`);
        }
        // Prepare the authorization request URL
        const authorizationUrl = new URL(this._serverMetadata.authorization_endpoint);
        authorizationUrl.searchParams.append('client_id', this.clientId);
        authorizationUrl.searchParams.append('response_type', 'code');
        authorizationUrl.searchParams.append('state', state.toString());
        authorizationUrl.searchParams.append('code_challenge', codeChallenge);
        authorizationUrl.searchParams.append('code_challenge_method', 'S256');
        const scopeString = scopes.join(' ');
        if (scopeString) {
            // If non-empty scopes are provided, include scope parameter in the request
            authorizationUrl.searchParams.append('scope', scopeString);
        }
        if (this._resourceMetadata?.resource) {
            // If a resource is specified, include it in the request
            authorizationUrl.searchParams.append('resource', this._resourceMetadata.resource);
        }
        // Use a redirect URI that matches what was registered during dynamic registration
        const redirectUri = 'https://vscode.dev/redirect';
        authorizationUrl.searchParams.append('redirect_uri', redirectUri);
        const promise = this.waitForAuthorizationCode(callbackUri);
        // Open the browser for user authorization
        this._logger.info(`Opening authorization URL for scopes: ${scopeString}`);
        this._logger.trace(`Authorization URL: ${authorizationUrl.toString()}`);
        const opened = await this._extHostWindow.openUri(authorizationUrl.toString(), {});
        if (!opened) {
            throw new CancellationError();
        }
        progress.report({
            message: nls.localize('completeAuth', "Complete the authentication in the browser window that has opened."),
        });
        // Wait for the authorization code via a redirect
        let code;
        try {
            const response = await raceCancellationError(promise, token);
            code = response.code;
        }
        catch (err) {
            if (isCancellationError(err)) {
                this._logger.info('Authorization code request was cancelled by the user.');
                throw err;
            }
            this._logger.error(`Failed to receive authorization code: ${err}`);
            throw new Error(`Failed to receive authorization code: ${err}`);
        }
        this._logger.info(`Authorization code received for scopes: ${scopeString}`);
        // Exchange the authorization code for tokens
        const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier, redirectUri);
        return tokenResponse;
    }
    generateRandomString(length) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .substring(0, length);
    }
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        // Base64url encode the digest
        return encodeBase64(VSBuffer.wrap(new Uint8Array(digest)), false, false)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
    async waitForAuthorizationCode(expectedState) {
        const result = await this._proxy.$waitForUriHandler(expectedState);
        // Extract the code parameter directly from the query string. NOTE, URLSearchParams does not work here because
        // it will decode the query string and we need to keep it encoded.
        const codeMatch = /[?&]code=([^&]+)/.exec(result.query || '');
        if (!codeMatch || codeMatch.length < 2) {
            // No code parameter found in the query string
            throw new Error('Authentication failed: No authorization code received');
        }
        return { code: codeMatch[1] };
    }
    async exchangeCodeForToken(code, codeVerifier, redirectUri) {
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        const tokenRequest = new URLSearchParams();
        tokenRequest.append('client_id', this.clientId);
        tokenRequest.append('grant_type', 'authorization_code');
        tokenRequest.append('code', code);
        tokenRequest.append('redirect_uri', redirectUri);
        tokenRequest.append('code_verifier', codeVerifier);
        const response = await fetch(this._serverMetadata.token_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenRequest.toString()
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${text}`);
        }
        const result = await response.json();
        if (isAuthorizationTokenResponse(result)) {
            return result;
        }
        throw new Error(`Invalid authorization token response: ${JSON.stringify(result)}`);
    }
    async exchangeRefreshTokenForToken(refreshToken) {
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        const tokenRequest = new URLSearchParams();
        tokenRequest.append('client_id', this.clientId);
        tokenRequest.append('grant_type', 'refresh_token');
        tokenRequest.append('refresh_token', refreshToken);
        const response = await fetch(this._serverMetadata.token_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenRequest.toString()
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${text}`);
        }
        const result = await response.json();
        if (isAuthorizationTokenResponse(result)) {
            return {
                ...result,
                created_at: Date.now(),
            };
        }
        throw new Error(`Invalid authorization token response: ${JSON.stringify(result)}`);
    }
};
DynamicAuthProvider = __decorate([
    __param(0, IExtHostWindow),
    __param(1, IExtHostUrlsService),
    __param(2, IExtHostInitDataService),
    __param(3, IExtHostProgress),
    __param(4, ILoggerService)
], DynamicAuthProvider);
export { DynamicAuthProvider };
class TokenStore {
    constructor(_persistence, initialTokens, _logger) {
        this._persistence = _persistence;
        this._logger = _logger;
        this._onDidChangeSessions = new Emitter();
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        this._disposable = new DisposableStore();
        this._tokensObservable = observableValue('tokens', initialTokens);
        this._sessionsObservable = derivedOpts({ equalsFn: (a, b) => arraysEqual(a, b, (a, b) => a.accessToken === b.accessToken) }, (reader) => this._tokensObservable.read(reader).map(t => this._getSessionFromToken(t)));
        this._disposable.add(this._registerChangeEventAutorun());
        this._disposable.add(this._persistence.onDidChange((tokens) => this._tokensObservable.set(tokens, undefined)));
    }
    get tokens() {
        return this._tokensObservable.get();
    }
    get sessions() {
        return this._sessionsObservable.get();
    }
    dispose() {
        this._disposable.dispose();
    }
    update({ added, removed }) {
        this._logger.trace(`Updating tokens: added ${added.length}, removed ${removed.length}`);
        const currentTokens = [...this._tokensObservable.get()];
        for (const token of removed) {
            const index = currentTokens.findIndex(t => t.access_token === token.access_token);
            if (index !== -1) {
                currentTokens.splice(index, 1);
            }
        }
        for (const token of added) {
            const index = currentTokens.findIndex(t => t.access_token === token.access_token);
            if (index === -1) {
                currentTokens.push(token);
            }
            else {
                currentTokens[index] = token;
            }
        }
        if (added.length || removed.length) {
            this._tokensObservable.set(currentTokens, undefined);
            void this._persistence.set(currentTokens);
        }
        this._logger.trace(`Tokens updated: ${currentTokens.length} tokens stored.`);
    }
    _registerChangeEventAutorun() {
        let previousSessions = [];
        return autorun((reader) => {
            this._logger.trace('Checking for session changes...');
            const currentSessions = this._sessionsObservable.read(reader);
            if (previousSessions === currentSessions) {
                this._logger.trace('No session changes detected.');
                return;
            }
            if (!currentSessions || currentSessions.length === 0) {
                // If currentSessions is undefined, all previous sessions are considered removed
                this._logger.trace('All sessions removed.');
                if (previousSessions.length > 0) {
                    this._onDidChangeSessions.fire({
                        added: [],
                        removed: previousSessions,
                        changed: []
                    });
                    previousSessions = [];
                }
                return;
            }
            const added = [];
            const removed = [];
            // Find added sessions
            for (const current of currentSessions) {
                const exists = previousSessions.some(prev => prev.accessToken === current.accessToken);
                if (!exists) {
                    added.push(current);
                }
            }
            // Find removed sessions
            for (const prev of previousSessions) {
                const exists = currentSessions.some(current => current.accessToken === prev.accessToken);
                if (!exists) {
                    removed.push(prev);
                }
            }
            // Fire the event if there are any changes
            if (added.length > 0 || removed.length > 0) {
                this._logger.trace(`Sessions changed: added ${added.length}, removed ${removed.length}`);
                this._onDidChangeSessions.fire({ added, removed, changed: [] });
            }
            // Update previous sessions reference
            previousSessions = currentSessions;
        });
    }
    _getSessionFromToken(token) {
        let claims;
        if (token.id_token) {
            try {
                claims = getClaimsFromJWT(token.id_token);
            }
            catch (e) {
                // log
            }
        }
        if (!claims) {
            try {
                claims = getClaimsFromJWT(token.access_token);
            }
            catch (e) {
                // log
            }
        }
        const scopes = token.scope
            ? token.scope.split(' ')
            : claims?.scope
                ? claims.scope.split(' ')
                : [];
        return {
            id: stringHash(token.access_token, 0).toString(),
            accessToken: token.access_token,
            account: {
                id: claims?.sub || 'unknown',
                // TODO: Don't say MCP...
                label: claims?.preferred_username || claims?.name || claims?.email || 'MCP',
            },
            scopes: scopes,
            idToken: token.id_token
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0QXV0aGVudGljYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxXQUFXLEVBQTZELE1BQU0sdUJBQXVCLENBQUM7QUFDL0csT0FBTyxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2pFLE9BQU8sRUFBeUIsbUJBQW1CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDNUQsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQStILDRCQUE0QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdFAsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3BELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RFLE9BQU8sRUFBVyxjQUFjLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBb0MsZUFBZSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0gsT0FBTyxFQUFFLFVB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