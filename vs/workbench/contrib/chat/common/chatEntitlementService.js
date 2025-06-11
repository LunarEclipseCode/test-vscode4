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
var ChatEntitlementRequests_1, ChatEntitlementContext_1;
import product from '../../../../platform/product/common/product.js';
import { Barrier } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { asText, IRequestService } from '../../../../platform/request/common/request.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IAuthenticationExtensionsService, IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { ChatContextKeys } from './chatContextKeys.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { URI } from '../../../../base/common/uri.js';
import Severity from '../../../../base/common/severity.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { isWeb } from '../../../../base/common/platform.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
export const IChatEntitlementService = createDecorator('chatEntitlementService');
export var ChatEntitlement;
(function (ChatEntitlement) {
    /** Signed out */
    ChatEntitlement[ChatEntitlement["Unknown"] = 1] = "Unknown";
    /** Signed in but not yet resolved */
    ChatEntitlement[ChatEntitlement["Unresolved"] = 2] = "Unresolved";
    /** Signed in and entitled to Free */
    ChatEntitlement[ChatEntitlement["Available"] = 3] = "Available";
    /** Signed in but not entitled to Free */
    ChatEntitlement[ChatEntitlement["Unavailable"] = 4] = "Unavailable";
    /** Signed-up to Free */
    ChatEntitlement[ChatEntitlement["Free"] = 5] = "Free";
    /** Signed-up to Pro */
    ChatEntitlement[ChatEntitlement["Pro"] = 6] = "Pro";
    /** Signed-up to Pro Plus */
    ChatEntitlement[ChatEntitlement["ProPlus"] = 7] = "ProPlus";
    /** Signed-up to Business */
    ChatEntitlement[ChatEntitlement["Business"] = 8] = "Business";
    /** Signed-up to Enterprise */
    ChatEntitlement[ChatEntitlement["Enterprise"] = 9] = "Enterprise";
})(ChatEntitlement || (ChatEntitlement = {}));
//#region Helper Functions
/**
 * Checks the chat entitlements to see if the user falls into the paid category
 * @param chatEntitlement The chat entitlement to check
 * @returns Whether or not they are a paid user
 */
export function isProUser(chatEntitlement) {
    return chatEntitlement === ChatEntitlement.Pro ||
        chatEntitlement === ChatEntitlement.ProPlus ||
        chatEntitlement === ChatEntitlement.Business ||
        chatEntitlement === ChatEntitlement.Enterprise;
}
//#region Service Implementation
const defaultChat = {
    extensionId: product.defaultChatAgent?.extensionId ?? '',
    chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? '',
    upgradePlanUrl: product.defaultChatAgent?.upgradePlanUrl ?? '',
    providerId: product.defaultChatAgent?.providerId ?? '',
    enterpriseProviderId: product.defaultChatAgent?.enterpriseProviderId ?? '',
    providerScopes: product.defaultChatAgent?.providerScopes ?? [[]],
    entitlementUrl: product.defaultChatAgent?.entitlementUrl ?? '',
    entitlementSignupLimitedUrl: product.defaultChatAgent?.entitlementSignupLimitedUrl ?? '',
    completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? '',
    chatQuotaExceededContext: product.defaultChatAgent?.chatQuotaExceededContext ?? '',
    completionsQuotaExceededContext: product.defaultChatAgent?.completionsQuotaExceededContext ?? ''
};
let ChatEntitlementService = class ChatEntitlementService extends Disposable {
    constructor(instantiationService, productService, environmentService, contextKeyService, configurationService) {
        super();
        this.contextKeyService = contextKeyService;
        //#endregion
        //#region --- Quotas
        this._onDidChangeQuotaExceeded = this._register(new Emitter());
        this.onDidChangeQuotaExceeded = this._onDidChangeQuotaExceeded.event;
        this._onDidChangeQuotaRemaining = this._register(new Emitter());
        this.onDidChangeQuotaRemaining = this._onDidChangeQuotaRemaining.event;
        this._quotas = {};
        this.ExtensionQuotaContextKeys = {
            chatQuotaExceeded: defaultChat.chatQuotaExceededContext,
            completionsQuotaExceeded: defaultChat.completionsQuotaExceededContext,
        };
        this.chatQuotaExceededContextKey = ChatContextKeys.chatQuotaExceeded.bindTo(this.contextKeyService);
        this.completionsQuotaExceededContextKey = ChatContextKeys.completionsQuotaExceeded.bindTo(this.contextKeyService);
        this.onDidChangeEntitlement = Event.map(Event.filter(this.contextKeyService.onDidChangeContext, e => e.affectsSome(new Set([
            ChatContextKeys.Entitlement.pro.key,
            ChatContextKeys.Entitlement.business.key,
            ChatContextKeys.Entitlement.enterprise.key,
            ChatContextKeys.Entitlement.proPlus.key,
            ChatContextKeys.Entitlement.free.key,
            ChatContextKeys.Entitlement.canSignUp.key,
            ChatContextKeys.Entitlement.signedOut.key
        ])), this._store), () => { }, this._store);
        this.onDidChangeSentiment = Event.map(Event.filter(this.contextKeyService.onDidChangeContext, e => e.affectsSome(new Set([
            ChatContextKeys.Setup.hidden.key,
            ChatContextKeys.Setup.disabled.key,
            ChatContextKeys.Setup.installed.key,
            ChatContextKeys.Setup.later.key
        ])), this._store), () => { }, this._store);
        if (!productService.defaultChatAgent || // needs product config
            (
            // TODO@bpasero remove this condition and 'serverlessWebEnabled' once Chat web support lands
            isWeb &&
                !environmentService.remoteAuthority &&
                !configurationService.getValue('chat.experimental.serverlessWebEnabled'))) {
            ChatContextKeys.Setup.hidden.bindTo(this.contextKeyService).set(true); // hide copilot UI
            return;
        }
        const context = this.context = new Lazy(() => this._register(instantiationService.createInstance(ChatEntitlementContext)));
        this.requests = new Lazy(() => this._register(instantiationService.createInstance(ChatEntitlementRequests, context.value, {
            clearQuotas: () => this.clearQuotas(),
            acceptQuotas: quotas => this.acceptQuotas(quotas)
        })));
        this.registerListeners();
    }
    get entitlement() {
        if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.pro.key) === true) {
            return ChatEntitlement.Pro;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.business.key) === true) {
            return ChatEntitlement.Business;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.enterprise.key) === true) {
            return ChatEntitlement.Enterprise;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.proPlus.key) === true) {
            return ChatEntitlement.ProPlus;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.free.key) === true) {
            return ChatEntitlement.Free;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.canSignUp.key) === true) {
            return ChatEntitlement.Available;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.signedOut.key) === true) {
            return ChatEntitlement.Unknown;
        }
        return ChatEntitlement.Unresolved;
    }
    get quotas() { return this._quotas; }
    registerListeners() {
        const quotaExceededSet = new Set([this.ExtensionQuotaContextKeys.chatQuotaExceeded, this.ExtensionQuotaContextKeys.completionsQuotaExceeded]);
        const cts = this._register(new MutableDisposable());
        this._register(this.contextKeyService.onDidChangeContext(e => {
            if (e.affectsSome(quotaExceededSet)) {
                if (cts.value) {
                    cts.value.cancel();
                }
                cts.value = new CancellationTokenSource();
                this.update(cts.value.token);
            }
        }));
    }
    acceptQuotas(quotas) {
        const oldQuota = this._quotas;
        this._quotas = quotas;
        this.updateContextKeys();
        const { changed: chatChanged } = this.compareQuotas(oldQuota.chat, quotas.chat);
        const { changed: completionsChanged } = this.compareQuotas(oldQuota.completions, quotas.completions);
        const { changed: premiumChatChanged } = this.compareQuotas(oldQuota.premiumChat, quotas.premiumChat);
        if (chatChanged.exceeded || completionsChanged.exceeded || premiumChatChanged.exceeded) {
            this._onDidChangeQuotaExceeded.fire();
        }
        if (chatChanged.remaining || completionsChanged.remaining || premiumChatChanged.remaining) {
            this._onDidChangeQuotaRemaining.fire();
        }
    }
    compareQuotas(oldQuota, newQuota) {
        return {
            changed: {
                exceeded: (oldQuota?.percentRemaining === 0) !== (newQuota?.percentRemaining === 0),
                remaining: oldQuota?.percentRemaining !== newQuota?.percentRemaining
            }
        };
    }
    clearQuotas() {
        this.acceptQuotas({});
    }
    updateContextKeys() {
        this.chatQuotaExceededContextKey.set(this._quotas.chat?.percentRemaining === 0);
        this.completionsQuotaExceededContextKey.set(this._quotas.completions?.percentRemaining === 0);
    }
    get sentiment() {
        return {
            installed: this.contextKeyService.getContextKeyValue(ChatContextKeys.Setup.installed.key) === true,
            hidden: this.contextKeyService.getContextKeyValue(ChatContextKeys.Setup.hidden.key) === true,
            disabled: this.contextKeyService.getContextKeyValue(ChatContextKeys.Setup.disabled.key) === true,
            later: this.contextKeyService.getContextKeyValue(ChatContextKeys.Setup.later.key) === true
        };
    }
    //#endregion
    async update(token) {
        await this.requests?.value.forceResolveEntitlement(undefined, token);
    }
};
ChatEntitlementService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IProductService),
    __param(2, IWorkbenchEnvironmentService),
    __param(3, IContextKeyService),
    __param(4, IConfigurationService)
], ChatEntitlementService);
export { ChatEntitlementService };
let ChatEntitlementRequests = ChatEntitlementRequests_1 = class ChatEntitlementRequests extends Disposable {
    static providerId(configurationService) {
        if (configurationService.getValue(`${defaultChat.completionsAdvancedSetting}.authProvider`) === defaultChat.enterpriseProviderId) {
            return defaultChat.enterpriseProviderId;
        }
        return defaultChat.providerId;
    }
    constructor(context, chatQuotasAccessor, telemetryService, authenticationService, logService, requestService, dialogService, openerService, configurationService, authenticationExtensionsService, lifecycleService) {
        super();
        this.context = context;
        this.chatQuotasAccessor = chatQuotasAccessor;
        this.telemetryService = telemetryService;
        this.authenticationService = authenticationService;
        this.logService = logService;
        this.requestService = requestService;
        this.dialogService = dialogService;
        this.openerService = openerService;
        this.configurationService = configurationService;
        this.authenticationExtensionsService = authenticationExtensionsService;
        this.lifecycleService = lifecycleService;
        this.pendingResolveCts = new CancellationTokenSource();
        this.didResolveEntitlements = false;
        this.state = { entitlement: this.context.state.entitlement };
        this.registerListeners();
        this.resolve();
    }
    registerListeners() {
        this._register(this.authenticationService.onDidChangeDeclaredProviders(() => this.resolve()));
        this._register(this.authenticationService.onDidChangeSessions(e => {
            if (e.providerId === ChatEntitlementRequests_1.providerId(this.configurationService)) {
                this.resolve();
            }
        }));
        this._register(this.authenticationService.onDidRegisterAuthenticationProvider(e => {
            if (e.id === ChatEntitlementRequests_1.providerId(this.configurationService)) {
                this.resolve();
            }
        }));
        this._register(this.authenticationService.onDidUnregisterAuthenticationProvider(e => {
            if (e.id === ChatEntitlementRequests_1.providerId(this.configurationService)) {
                this.resolve();
            }
        }));
        this._register(this.context.onDidChange(() => {
            if (!this.context.state.installed || this.context.state.disabled || this.context.state.entitlement === ChatEntitlement.Unknown) {
                // When the extension is not installed, disabled or the user is not entitled
                // make sure to clear quotas so that any indicators are also gone
                this.state = { entitlement: this.state.entitlement, quotas: undefined };
                this.chatQuotasAccessor.clearQuotas();
            }
        }));
    }
    async resolve() {
        this.pendingResolveCts.dispose(true);
        const cts = this.pendingResolveCts = new CancellationTokenSource();
        const session = await this.findMatchingProviderSession(cts.token);
        if (cts.token.isCancellationRequested) {
            return;
        }
        // Immediately signal whether we have a session or not
        let state = undefined;
        if (session) {
            // Do not overwrite any state we have already
            if (this.state.entitlement === ChatEntitlement.Unknown) {
                state = { entitlement: ChatEntitlement.Unresolved };
            }
        }
        else {
            this.didResolveEntitlements = false; // reset so that we resolve entitlements fresh when signed in again
            state = { entitlement: ChatEntitlement.Unknown };
        }
        if (state) {
            this.update(state);
        }
        if (session && !this.didResolveEntitlements) {
            // Afterwards resolve entitlement with a network request
            // but only unless it was not already resolved before.
            await this.resolveEntitlement(session, cts.token);
        }
    }
    async findMatchingProviderSession(token) {
        const sessions = await this.doGetSessions(ChatEntitlementRequests_1.providerId(this.configurationService));
        if (token.isCancellationRequested) {
            return undefined;
        }
        for (const session of sessions) {
            for (const scopes of defaultChat.providerScopes) {
                if (this.scopesMatch(session.scopes, scopes)) {
                    return session;
                }
            }
        }
        return undefined;
    }
    async doGetSessions(providerId) {
        const preferredAccountName = this.authenticationExtensionsService.getAccountPreference(defaultChat.chatExtensionId, providerId) ?? this.authenticationExtensionsService.getAccountPreference(defaultChat.extensionId, providerId);
        let preferredAccount;
        for (const account of await this.authenticationService.getAccounts(providerId)) {
            if (account.label === preferredAccountName) {
                preferredAccount = account;
                break;
            }
        }
        try {
            return await this.authenticationService.getSessions(providerId, undefined, { account: preferredAccount });
        }
        catch (error) {
            // ignore - errors can throw if a provider is not registered
        }
        return [];
    }
    scopesMatch(scopes, expectedScopes) {
        return scopes.length === expectedScopes.length && expectedScopes.every(scope => scopes.includes(scope));
    }
    async resolveEntitlement(session, token) {
        const entitlements = await this.doResolveEntitlement(session, token);
        if (typeof entitlements?.entitlement === 'number' && !token.isCancellationRequested) {
            this.didResolveEntitlements = true;
            this.update(entitlements);
        }
        return entitlements;
    }
    async doResolveEntitlement(session, token) {
        if (ChatEntitlementRequests_1.providerId(this.configurationService) === defaultChat.enterpriseProviderId) {
            this.logService.trace('[chat entitlement]: enterprise provider, assuming Enterprise plan');
            return { entitlement: ChatEntitlement.Enterprise };
        }
        if (token.isCancellationRequested) {
            return undefined;
        }
        const response = await this.request(defaultChat.entitlementUrl, 'GET', undefined, session, token);
        if (token.isCancellationRequested) {
            return undefined;
        }
        if (!response) {
            this.logService.trace('[chat entitlement]: no response');
            return { entitlement: ChatEntitlement.Unresolved };
        }
        if (response.res.statusCode && response.res.statusCode !== 200) {
            this.logService.trace(`[chat entitlement]: unexpected status code ${response.res.statusCode}`);
            return (response.res.statusCode === 401 || // oauth token being unavailable (expired/revoked)
                response.res.statusCode === 404 // missing scopes/permissions, service pretends the endpoint doesn't exist
            ) ? { entitlement: ChatEntitlement.Unknown /* treat as signed out */ } : { entitlement: ChatEntitlement.Unresolved };
        }
        let responseText = null;
        try {
            responseText = await asText(response);
        }
        catch (error) {
            // ignore - handled below
        }
        if (token.isCancellationRequested) {
            return undefined;
        }
        if (!responseText) {
            this.logService.trace('[chat entitlement]: response has no content');
            return { entitlement: ChatEntitlement.Unresolved };
        }
        let entitlementsResponse;
        try {
            entitlementsResponse = JSON.parse(responseText);
            this.logService.trace(`[chat entitlement]: parsed result is ${JSON.stringify(entitlementsResponse)}`);
        }
        catch (err) {
            this.logService.trace(`[chat entitlement]: error parsing response (${err})`);
            return { entitlement: ChatEntitlement.Unresolved };
        }
        let entitlement;
        if (entitlementsResponse.access_type_sku === 'free_limited_copilot') {
            entitlement = ChatEntitlement.Free;
        }
        else if (entitlementsResponse.can_signup_for_limited) {
            entitlement = ChatEntitlement.Available;
        }
        else if (entitlementsResponse.copilot_plan === 'individual') {
            entitlement = ChatEntitlement.Pro;
        }
        else if (entitlementsResponse.copilot_plan === 'individual_pro') {
            entitlement = ChatEntitlement.ProPlus;
        }
        else if (entitlementsResponse.copilot_plan === 'business') {
            entitlement = ChatEntitlement.Business;
        }
        else if (entitlementsResponse.copilot_plan === 'enterprise') {
            entitlement = ChatEntitlement.Enterprise;
        }
        else if (entitlementsResponse.chat_enabled) {
            // This should never happen as we exhaustively list the plans above. But if a new plan is added in the future older clients won't break
            entitlement = ChatEntitlement.Pro;
        }
        else {
            entitlement = ChatEntitlement.Unavailable;
        }
        const entitlements = {
            entitlement,
            quotas: this.toQuotas(entitlementsResponse)
        };
        this.logService.trace(`[chat entitlement]: resolved to ${entitlements.entitlement}, quotas: ${JSON.stringify(entitlements.quotas)}`);
        this.telemetryService.publicLog2('chatInstallEntitlement', {
            entitlement: entitlements.entitlement,
            tid: entitlementsResponse.analytics_tracking_id,
            quotaChat: entitlementsResponse?.quota_snapshots?.chat?.remaining,
            quotaPremiumChat: entitlementsResponse?.quota_snapshots?.premium_interactions?.remaining,
            quotaCompletions: entitlementsResponse?.quota_snapshots?.completions?.remaining,
            quotaResetDate: entitlementsResponse.quota_reset_date ?? entitlementsResponse.limited_user_reset_date
        });
        return entitlements;
    }
    toQuotas(response) {
        const quotas = {
            resetDate: response.quota_reset_date ?? response.limited_user_reset_date
        };
        // Legacy Free SKU Quota
        if (response.monthly_quotas?.chat && typeof response.limited_user_quotas?.chat === 'number') {
            quotas.chat = {
                total: response.monthly_quotas.chat,
                percentRemaining: Math.min(100, Math.max(0, (response.limited_user_quotas.chat / response.monthly_quotas.chat) * 100)),
                overageEnabled: false,
                overageCount: 0,
                unlimited: false
            };
        }
        if (response.monthly_quotas?.completions && typeof response.limited_user_quotas?.completions === 'number') {
            quotas.completions = {
                total: response.monthly_quotas.completions,
                percentRemaining: Math.min(100, Math.max(0, (response.limited_user_quotas.completions / response.monthly_quotas.completions) * 100)),
                overageEnabled: false,
                overageCount: 0,
                unlimited: false
            };
        }
        // New Quota Snapshot
        if (response.quota_snapshots) {
            for (const quotaType of ['chat', 'completions', 'premium_interactions']) {
                const rawQuotaSnapshot = response.quota_snapshots[quotaType];
                if (!rawQuotaSnapshot) {
                    continue;
                }
                const quotaSnapshot = {
                    total: rawQuotaSnapshot.entitlement,
                    percentRemaining: Math.min(100, Math.max(0, rawQuotaSnapshot.percent_remaining)),
                    overageEnabled: rawQuotaSnapshot.overage_permitted,
                    overageCount: rawQuotaSnapshot.overage_count,
                    unlimited: rawQuotaSnapshot.unlimited
                };
                switch (quotaType) {
                    case 'chat':
                        quotas.chat = quotaSnapshot;
                        break;
                    case 'completions':
                        quotas.completions = quotaSnapshot;
                        break;
                    case 'premium_interactions':
                        quotas.premiumChat = quotaSnapshot;
                        break;
                }
            }
        }
        return quotas;
    }
    async request(url, type, body, session, token) {
        try {
            return await this.requestService.request({
                type,
                url,
                data: type === 'POST' ? JSON.stringify(body) : undefined,
                disableCache: true,
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`
                }
            }, token);
        }
        catch (error) {
            if (!token.isCancellationRequested) {
                this.logService.error(`[chat entitlement] request: error ${error}`);
            }
            return undefined;
        }
    }
    update(state) {
        this.state = state;
        this.context.update({ entitlement: this.state.entitlement });
        if (state.quotas) {
            this.chatQuotasAccessor.acceptQuotas(state.quotas);
        }
    }
    async forceResolveEntitlement(session, token = CancellationToken.None) {
        if (!session) {
            session = await this.findMatchingProviderSession(token);
        }
        if (!session) {
            return undefined;
        }
        return this.resolveEntitlement(session, token);
    }
    async signUpFree(session) {
        const body = {
            restricted_telemetry: this.telemetryService.telemetryLevel === 0 /* TelemetryLevel.NONE */ ? 'disabled' : 'enabled',
            public_code_suggestions: 'enabled'
        };
        const response = await this.request(defaultChat.entitlementSignupLimitedUrl, 'POST', body, session, CancellationToken.None);
        if (!response) {
            const retry = await this.onUnknownSignUpError(localize('signUpNoResponseError', "No response received."), '[chat entitlement] sign-up: no response');
            return retry ? this.signUpFree(session) : { errorCode: 1 };
        }
        if (response.res.statusCode && response.res.statusCode !== 200) {
            if (response.res.statusCode === 422) {
                try {
                    const responseText = await asText(response);
                    if (responseText) {
                        const responseError = JSON.parse(responseText);
                        if (typeof responseError.message === 'string' && responseError.message) {
                            this.onUnprocessableSignUpError(`[chat entitlement] sign-up: unprocessable entity (${responseError.message})`, responseError.message);
                            return { errorCode: response.res.statusCode };
                        }
                    }
                }
                catch (error) {
                    // ignore - handled below
                }
            }
            const retry = await this.onUnknownSignUpError(localize('signUpUnexpectedStatusError', "Unexpected status code {0}.", response.res.statusCode), `[chat entitlement] sign-up: unexpected status code ${response.res.statusCode}`);
            return retry ? this.signUpFree(session) : { errorCode: response.res.statusCode };
        }
        let responseText = null;
        try {
            responseText = await asText(response);
        }
        catch (error) {
            // ignore - handled below
        }
        if (!responseText) {
            const retry = await this.onUnknownSignUpError(localize('signUpNoResponseContentsError', "Response has no contents."), '[chat entitlement] sign-up: response has no content');
            return retry ? this.signUpFree(session) : { errorCode: 2 };
        }
        let parsedResult = undefined;
        try {
            parsedResult = JSON.parse(responseText);
            this.logService.trace(`[chat entitlement] sign-up: response is ${responseText}`);
        }
        catch (err) {
            const retry = await this.onUnknownSignUpError(localize('signUpInvalidResponseError', "Invalid response contents."), `[chat entitlement] sign-up: error parsing response (${err})`);
            return retry ? this.signUpFree(session) : { errorCode: 3 };
        }
        // We have made it this far, so the user either did sign-up or was signed-up already.
        // That is, because the endpoint throws in all other case according to Patrick.
        this.update({ entitlement: ChatEntitlement.Free });
        return Boolean(parsedResult?.subscribed);
    }
    async onUnknownSignUpError(detail, logMessage) {
        this.logService.error(logMessage);
        if (!this.lifecycleService.willShutdown) {
            const { confirmed } = await this.dialogService.confirm({
                type: Severity.Error,
                message: localize('unknownSignUpError', "An error occurred while signing up for the Copilot Free plan. Would you like to try again?"),
                detail,
                primaryButton: localize('retry', "Retry")
            });
            return confirmed;
        }
        return false;
    }
    onUnprocessableSignUpError(logMessage, logDetails) {
        this.logService.error(logMessage);
        if (!this.lifecycleService.willShutdown) {
            this.dialogService.prompt({
                type: Severity.Error,
                message: localize('unprocessableSignUpError', "An error occurred while signing up for the Copilot Free plan."),
                detail: logDetails,
                buttons: [
                    {
                        label: localize('ok', "OK"),
                        run: () => { }
                    },
                    {
                        label: localize('learnMore', "Learn More"),
                        run: () => this.openerService.open(URI.parse(defaultChat.upgradePlanUrl))
                    }
                ]
            });
        }
    }
    async signIn() {
        const providerId = ChatEntitlementRequests_1.providerId(this.configurationService);
        const session = await this.authenticationService.createSession(providerId, defaultChat.providerScopes[0]);
        this.authenticationExtensionsService.updateAccountPreference(defaultChat.extensionId, providerId, session.account);
        this.authenticationExtensionsService.updateAccountPreference(defaultChat.chatExtensionId, providerId, session.account);
        const entitlements = await this.forceResolveEntitlement(session);
        return { session, entitlements };
    }
    dispose() {
        this.pendingResolveCts.dispose(true);
        super.dispose();
    }
};
ChatEntitlementRequests = ChatEntitlementRequests_1 = __decorate([
    __param(2, ITelemetryService),
    __param(3, IAuthenticationService),
    __param(4, ILogService),
    __param(5, IRequestService),
    __param(6, IDialogService),
    __param(7, IOpenerService),
    __param(8, IConfigurationService),
    __param(9, IAuthenticationExtensionsService),
    __param(10, ILifecycleService)
], ChatEntitlementRequests);
export { ChatEntitlementRequests };
let ChatEntitlementContext = class ChatEntitlementContext extends Disposable {
    static { ChatEntitlementContext_1 = this; }
    static { this.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY = 'chat.setupContext'; }
    get state() { return this.suspendedState ?? this._state; }
    constructor(contextKeyService, storageService, extensionEnablementService, logService, extensionsWorkbenchService) {
        super();
        this.storageService = storageService;
        this.extensionEnablementService = extensionEnablementService;
        this.logService = logService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.suspendedState = undefined;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.updateBarrier = undefined;
        this.canSignUpContextKey = ChatContextKeys.Entitlement.canSignUp.bindTo(contextKeyService);
        this.signedOutContextKey = ChatContextKeys.Entitlement.signedOut.bindTo(contextKeyService);
        this.freeContextKey = ChatContextKeys.Entitlement.free.bindTo(contextKeyService);
        this.proContextKey = ChatContextKeys.Entitlement.pro.bindTo(contextKeyService);
        this.proPlusContextKey = ChatContextKeys.Entitlement.proPlus.bindTo(contextKeyService);
        this.businessContextKey = ChatContextKeys.Entitlement.business.bindTo(contextKeyService);
        this.enterpriseContextKey = ChatContextKeys.Entitlement.enterprise.bindTo(contextKeyService);
        this.hiddenContext = ChatContextKeys.Setup.hidden.bindTo(contextKeyService);
        this.laterContext = ChatContextKeys.Setup.later.bindTo(contextKeyService);
        this.installedContext = ChatContextKeys.Setup.installed.bindTo(contextKeyService);
        this.disabledContext = ChatContextKeys.Setup.disabled.bindTo(contextKeyService);
        this._state = this.storageService.getObject(ChatEntitlementContext_1.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY, 0 /* StorageScope.PROFILE */) ?? { entitlement: ChatEntitlement.Unknown };
        this.checkExtensionInstallation();
        this.updateContextSync();
    }
    async checkExtensionInstallation() {
        // Await extensions to be ready to be queried
        await this.extensionsWorkbenchService.queryLocal();
        // Listen to change and process extensions once
        this._register(Event.runAndSubscribe(this.extensionsWorkbenchService.onChange, e => {
            if (e && !ExtensionIdentifier.equals(e.identifier.id, defaultChat.extensionId)) {
                return; // unrelated event
            }
            const defaultChatExtension = this.extensionsWorkbenchService.local.find(value => ExtensionIdentifier.equals(value.identifier.id, defaultChat.extensionId));
            const installed = !!defaultChatExtension?.local;
            const disabled = installed && !this.extensionEnablementService.isEnabled(defaultChatExtension.local);
            this.update({ installed, disabled });
        }));
    }
    update(context) {
        this.logService.trace(`[chat entitlement context] update(): ${JSON.stringify(context)}`);
        if (typeof context.installed === 'boolean' && typeof context.disabled === 'boolean') {
            this._state.installed = context.installed;
            this._state.disabled = context.disabled;
            if (context.installed && !context.disabled) {
                context.hidden = false; // treat this as a sign to make Chat visible again in case it is hidden
            }
        }
        if (typeof context.hidden === 'boolean') {
            this._state.hidden = context.hidden;
        }
        if (typeof context.later === 'boolean') {
            this._state.later = context.later;
        }
        if (typeof context.entitlement === 'number') {
            this._state.entitlement = context.entitlement;
            if (this._state.entitlement === ChatEntitlement.Free || isProUser(this._state.entitlement)) {
                this._state.registered = true;
            }
            else if (this._state.entitlement === ChatEntitlement.Available) {
                this._state.registered = false; // only reset when signed-in user can sign-up for free
            }
        }
        this.storageService.store(ChatEntitlementContext_1.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY, {
            ...this._state,
            later: undefined // do not persist this across restarts for now
        }, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        return this.updateContext();
    }
    async updateContext() {
        await this.updateBarrier?.wait();
        this.updateContextSync();
    }
    updateContextSync() {
        this.logService.trace(`[chat entitlement context] updateContext(): ${JSON.stringify(this._state)}`);
        this.signedOutContextKey.set(this._state.entitlement === ChatEntitlement.Unknown);
        this.canSignUpContextKey.set(this._state.entitlement === ChatEntitlement.Available);
        this.freeContextKey.set(this._state.entitlement === ChatEntitlement.Free);
        this.proContextKey.set(this._state.entitlement === ChatEntitlement.Pro);
        this.proPlusContextKey.set(this._state.entitlement === ChatEntitlement.ProPlus);
        this.businessContextKey.set(this._state.entitlement === ChatEntitlement.Business);
        this.enterpriseContextKey.set(this._state.entitlement === ChatEntitlement.Enterprise);
        this.hiddenContext.set(!!this._state.hidden);
        this.laterContext.set(!!this._state.later);
        this.installedContext.set(!!this._state.installed);
        this.disabledContext.set(!!this._state.disabled);
        this._onDidChange.fire();
    }
    suspend() {
        this.suspendedState = { ...this._state };
        this.updateBarrier = new Barrier();
    }
    resume() {
        this.suspendedState = undefined;
        this.updateBarrier?.open();
        this.updateBarrier = undefined;
    }
};
ChatEntitlementContext = ChatEntitlementContext_1 = __decorate([
    __param(0, IContextKeyService),
    __param(1, IStorageService),
    __param(2, IWorkbenchExtensionEnablementService),
    __param(3, ILogService),
    __param(4, IExtensionsWorkbenchService)
], ChatEntitlementContext);
export { ChatEntitlementContext };
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVudGl0bGVtZW50U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdEVudGl0bGVtZW50U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxPQUFPLE1BQU0sZ0RBQWdELENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVyRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxlQUFlLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNwSCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDekYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsaUJBQWlCLEVBQWtCLE1BQU0sb0RBQW9ELENBQUM7QUFDdkcsT0FBTyxFQUF1RCxnQ0FBZ0MsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQzFMLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzNILE9BQU8sRUFBYywyQkFBMkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDOUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNELE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUdwRixNQUFNLENBQUMsTUFBTSx1QkFBdUIsR0FBRyxlQUFlLENBQTBCLHdCQUF3QixDQUFDLENBQUM7QUFFMUcsTUFBTSxDQUFOLElBQVksZUFtQlg7QUFuQkQsV0FBWSxlQUFlO0lBQzFCLGlCQUFpQjtJQUNqQiwyREFBVyxDQUFBO0lBQ1gscUNBQXFDO0lBQ3JDLGlFQUFVLENBQUE7SUFDVixxQ0FBcUM7SUFDckMsK0RBQVMsQ0FBQTtJQUNULHlDQUF5QztJQUN6QyxtRUFBVyxDQUFBO0lBQ1gsd0JBQXdCO0lBQ3hCLHFEQUFJLENBQUE7SUFDSix1QkFBdUI7SUFDdkIsbURBQUcsQ0FBQTtJQUNILDRCQUE0QjtJQUM1QiwyREFBTyxDQUFBO0lBQ1AsNEJBQTRCO0lBQzVCLDZEQUFRLENBQUE7SUFDUiw4QkFBOEI7SUFDOUIsaUVBQVUsQ0FBQTtBQUNYLENBQUMsRUFuQlcsZUFBZSxLQUFmLGVBQWUsUUFtQjFCO0FBbURELDBCQUEwQjtBQUUxQjs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLFNBQVMsQ0FBQyxlQUFnQztJQUN6RCxPQUFPLGVBQWUsS0FBSyxlQUFlLENBQUMsR0FBRztRQUM3QyxlQUFlLEtBQUssZUFBZSxDQUFDLE9BQU87UUFDM0MsZUFBZSxLQUFLLGVBQWUsQ0FBQyxRQUFRO1FBQzVDLGVBQWUsS0FBSyxlQUFlLENBQUMsVUFBVSxDQUFDO0FBQ2pELENBQUM7QUFFRCxnQ0FBZ0M7QUFFaEMsTUFBTSxXQUFXLEdBQUc7SUFDbkIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLElBQUksRUFBRTtJQUN4RCxlQUFlLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixFQUFFLGVBQWUsSUFBSSxFQUFFO0lBQ2hFLGNBQWMsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsY0FBYyxJQUFJLEVBQUU7SUFDOUQsVUFBVSxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxVQUFVLElBQUksRUFBRTtJQUN0RCxvQkFBb0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsb0JBQW9CLElBQUksRUFBRTtJQUMxRSxjQUFjLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixFQUFFLGNBQWMsSUFBSSxDQUFDLEVBQUUsQ0FBQztJQUNoRSxjQUFjLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixFQUFFLGNBQWMsSUFBSSxFQUFFO0lBQzlELDJCQUEyQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSwyQkFBMkIsSUFBSSxFQUFFO0lBQ3hGLDBCQUEwQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSwwQkFBMEIsSUFBSSxFQUFFO0lBQ3RGLHdCQUF3QixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSx3QkFBd0IsSUFBSSxFQUFFO0lBQ2xGLCtCQUErQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSwrQkFBK0IsSUFBSSxFQUFFO0NBQ2hHLENBQUM7QUFPSyxJQUFNLHNCQUFzQixHQUE1QixNQUFNLHNCQUF1QixTQUFRLFVBQVU7SUFPckQsWUFDd0Isb0JBQTJDLEVBQ2pELGNBQStCLEVBQ2xCLGtCQUFnRCxFQUMxRCxpQkFBc0QsRUFDbkQsb0JBQTJDO1FBRWxFLEtBQUssRUFBRSxDQUFDO1FBSDZCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUErRTNFLFlBQVk7UUFFWixvQkFBb0I7UUFFSCw4QkFBeUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUN4RSw2QkFBd0IsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO1FBRXhELCtCQUEwQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQ3pFLDhCQUF5QixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUM7UUFFbkUsWUFBTyxHQUFZLEVBQUUsQ0FBQztRQU10Qiw4QkFBeUIsR0FBRztZQUNuQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsd0JBQXdCO1lBQ3ZELHdCQUF3QixFQUFFLFdBQVcsQ0FBQywrQkFBK0I7U0FDckUsQ0FBQztRQTdGRCxJQUFJLENBQUMsMkJBQTJCLEdBQUcsZUFBZSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNwRyxJQUFJLENBQUMsa0NBQWtDLEdBQUcsZUFBZSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUVsSCxJQUFJLENBQUMsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FDdEMsS0FBSyxDQUFDLE1BQU0sQ0FDWCxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDO1lBQ3JFLGVBQWUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDbkMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRztZQUN4QyxlQUFlLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHO1lBQzFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUc7WUFDdkMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRztZQUNwQyxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHO1lBQ3pDLGVBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEdBQUc7U0FDekMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FDaEIsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FDekIsQ0FBQztRQUVGLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUNwQyxLQUFLLENBQUMsTUFBTSxDQUNYLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLENBQUM7WUFDckUsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRztZQUNoQyxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHO1lBQ2xDLGVBQWUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUc7WUFDbkMsZUFBZSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRztTQUMvQixDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUNoQixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUN6QixDQUFDO1FBRUYsSUFDQyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsSUFBSSx1QkFBdUI7WUFDM0Q7WUFDQyw0RkFBNEY7WUFDNUYsS0FBSztnQkFDTCxDQUFDLGtCQUFrQixDQUFDLGVBQWU7Z0JBQ25DLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLHdDQUF3QyxDQUFDLENBQ3hFLEVBQ0EsQ0FBQztZQUNGLGVBQWUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxrQkFBa0I7WUFDekYsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNILElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsdUJBQXVCLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRTtZQUN6SCxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNyQyxZQUFZLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztTQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDMUIsQ0FBQztJQU1ELElBQUksV0FBVztRQUNkLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUFVLGVBQWUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3RHLE9BQU8sZUFBZSxDQUFDLEdBQUcsQ0FBQztRQUM1QixDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQVUsZUFBZSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDbEgsT0FBTyxlQUFlLENBQUMsUUFBUSxDQUFDO1FBQ2pDLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBVSxlQUFlLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNwSCxPQUFPLGVBQWUsQ0FBQyxVQUFVLENBQUM7UUFDbkMsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUFVLGVBQWUsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ2pILE9BQU8sZUFBZSxDQUFDLE9BQU8sQ0FBQztRQUNoQyxDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQVUsZUFBZSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDOUcsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDO1FBQzdCLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBVSxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNuSCxPQUFPLGVBQWUsQ0FBQyxTQUFTLENBQUM7UUFDbEMsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUFVLGVBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ25ILE9BQU8sZUFBZSxDQUFDLE9BQU8sQ0FBQztRQUNoQyxDQUFDO1FBRUQsT0FBTyxlQUFlLENBQUMsVUFBVSxDQUFDO0lBQ25DLENBQUM7SUFhRCxJQUFJLE1BQU0sS0FBSyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBVTdCLGlCQUFpQjtRQUN4QixNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7UUFFOUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGlCQUFpQixFQUEyQixDQUFDLENBQUM7UUFDN0UsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDNUQsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztnQkFDckMsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ2YsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDcEIsQ0FBQztnQkFDRCxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztnQkFDMUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFlBQVksQ0FBQyxNQUFlO1FBQzNCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDOUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDdEIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsTUFBTSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hGLE1BQU0sRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3JHLE1BQU0sRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXJHLElBQUksV0FBVyxDQUFDLFFBQVEsSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLElBQUksa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDeEYsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZDLENBQUM7UUFFRCxJQUFJLFdBQVcsQ0FBQyxTQUFTLElBQUksa0JBQWtCLENBQUMsU0FBUyxJQUFJLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQzNGLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN4QyxDQUFDO0lBQ0YsQ0FBQztJQUVPLGFBQWEsQ0FBQyxRQUFvQyxFQUFFLFFBQW9DO1FBQy9GLE9BQU87WUFDTixPQUFPLEVBQUU7Z0JBQ1IsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFLGdCQUFnQixLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLGdCQUFnQixLQUFLLENBQUMsQ0FBQztnQkFDbkYsU0FBUyxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsS0FBSyxRQUFRLEVBQUUsZ0JBQWdCO2FBQ3BFO1NBQ0QsQ0FBQztJQUNILENBQUM7SUFFRCxXQUFXO1FBQ1YsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRU8saUJBQWlCO1FBQ3hCLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMvRixDQUFDO0lBUUQsSUFBSSxTQUFTO1FBQ1osT0FBTztZQUNOLFNBQVMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQVUsZUFBZSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSTtZQUMzRyxNQUFNLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUFVLGVBQWUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUk7WUFDckcsUUFBUSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBVSxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJO1lBQ3pHLEtBQUssRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQVUsZUFBZSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSTtTQUNuRyxDQUFDO0lBQ0gsQ0FBQztJQUVELFlBQVk7SUFFWixLQUFLLENBQUMsTUFBTSxDQUFDLEtBQXdCO1FBQ3BDLE1BQU0sSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsdUJBQXVCLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3RFLENBQUM7Q0FDRCxDQUFBO0FBdExZLHNCQUFzQjtJQVFoQyxXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSw0QkFBNEIsQ0FBQTtJQUM1QixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEscUJBQXFCLENBQUE7R0FaWCxzQkFBc0IsQ0FzTGxDOztBQW9GTSxJQUFNLHVCQUF1QiwrQkFBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVO0lBRXRELE1BQU0sQ0FBQyxVQUFVLENBQUMsb0JBQTJDO1FBQzVELElBQUksb0JBQW9CLENBQUMsUUFBUSxDQUFxQixHQUFHLFdBQVcsQ0FBQywwQkFBMEIsZUFBZSxDQUFDLEtBQUssV0FBVyxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDdEosT0FBTyxXQUFXLENBQUMsb0JBQW9CLENBQUM7UUFDekMsQ0FBQztRQUVELE9BQU8sV0FBVyxDQUFDLFVBQVUsQ0FBQztJQUMvQixDQUFDO0lBT0QsWUFDa0IsT0FBK0IsRUFDL0Isa0JBQXVDLEVBQ3JDLGdCQUFvRCxFQUMvQyxxQkFBOEQsRUFDekUsVUFBd0MsRUFDcEMsY0FBZ0QsRUFDakQsYUFBOEMsRUFDOUMsYUFBOEMsRUFDdkMsb0JBQTRELEVBQ2pELCtCQUFrRixFQUNqRyxnQkFBb0Q7UUFFdkUsS0FBSyxFQUFFLENBQUM7UUFaUyxZQUFPLEdBQVAsT0FBTyxDQUF3QjtRQUMvQix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBQ3BCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDOUIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF3QjtRQUN4RCxlQUFVLEdBQVYsVUFBVSxDQUFhO1FBQ25CLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUNoQyxrQkFBYSxHQUFiLGFBQWEsQ0FBZ0I7UUFDN0Isa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ3RCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDaEMsb0NBQStCLEdBQS9CLCtCQUErQixDQUFrQztRQUNoRixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW1CO1FBZGhFLHNCQUFpQixHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztRQUNsRCwyQkFBc0IsR0FBRyxLQUFLLENBQUM7UUFpQnRDLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFN0QsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2hCLENBQUM7SUFFTyxpQkFBaUI7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsNEJBQTRCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU5RixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNqRSxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUsseUJBQXVCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ3BGLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG1DQUFtQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ2pGLElBQUksQ0FBQyxDQUFDLEVBQUUsS0FBSyx5QkFBdUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztnQkFDNUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2hCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMscUNBQXFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDbkYsSUFBSSxDQUFDLENBQUMsRUFBRSxLQUFLLHlCQUF1QixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO2dCQUM1RSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDaEIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRTtZQUM1QyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLEtBQUssZUFBZSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNoSSw0RUFBNEU7Z0JBQzVFLGlFQUFpRTtnQkFDakUsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUM7Z0JBQ3hFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN2QyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsT0FBTztRQUNwQixJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHVCQUF1QixFQUFFLENBQUM7UUFFbkUsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xFLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ3ZDLE9BQU87UUFDUixDQUFDO1FBRUQsc0RBQXNEO1FBQ3RELElBQUksS0FBSyxHQUE4QixTQUFTLENBQUM7UUFDakQsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLDZDQUE2QztZQUM3QyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxLQUFLLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDeEQsS0FBSyxHQUFHLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNyRCxDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLENBQUMsbUVBQW1FO1lBQ3hHLEtBQUssR0FBRyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbEQsQ0FBQztRQUNELElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BCLENBQUM7UUFFRCxJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1lBQzdDLHdEQUF3RDtZQUN4RCxzREFBc0Q7WUFDdEQsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxLQUF3QjtRQUNqRSxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMseUJBQXVCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFDekcsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNoQyxLQUFLLE1BQU0sTUFBTSxJQUFJLFdBQVcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDakQsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQztvQkFDOUMsT0FBTyxPQUFPLENBQUM7Z0JBQ2hCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFTyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQWtCO1FBQzdDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLCtCQUErQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLCtCQUErQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDbE8sSUFBSSxnQkFBMEQsQ0FBQztRQUMvRCxLQUFLLE1BQU0sT0FBTyxJQUFJLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ2hGLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxvQkFBb0IsRUFBRSxDQUFDO2dCQUM1QyxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7Z0JBQzNCLE1BQU07WUFDUCxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQztZQUNKLE9BQU8sTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBQzNHLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLDREQUE0RDtRQUM3RCxDQUFDO1FBRUQsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRU8sV0FBVyxDQUFDLE1BQTZCLEVBQUUsY0FBd0I7UUFDMUUsT0FBTyxNQUFNLENBQUMsTUFBTSxLQUFLLGNBQWMsQ0FBQyxNQUFNLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUN6RyxDQUFDO0lBRU8sS0FBSyxDQUFDLGtCQUFrQixDQUFDLE9BQThCLEVBQUUsS0FBd0I7UUFDeEYsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JFLElBQUksT0FBTyxZQUFZLEVBQUUsV0FBVyxLQUFLLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ3JGLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLENBQUM7WUFDbkMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMzQixDQUFDO1FBRUQsT0FBTyxZQUFZLENBQUM7SUFDckIsQ0FBQztJQUVPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxPQUE4QixFQUFFLEtBQXdCO1FBQzFGLElBQUkseUJBQXVCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLFdBQVcsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQ3hHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLG1FQUFtRSxDQUFDLENBQUM7WUFDM0YsT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDcEQsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xHLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDekQsT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDcEQsQ0FBQztRQUVELElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDaEUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsOENBQThDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztZQUMvRixPQUFPLENBQ04sUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRyxJQUFLLGtEQUFrRDtnQkFDdEYsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRyxDQUFFLDBFQUEwRTthQUMzRyxDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDLHlCQUF5QixFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN0SCxDQUFDO1FBRUQsSUFBSSxZQUFZLEdBQWtCLElBQUksQ0FBQztRQUN2QyxJQUFJLENBQUM7WUFDSixZQUFZLEdBQUcsTUFBTSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIseUJBQXlCO1FBQzFCLENBQUM7UUFDRCxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ25DLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsNkNBQTZDLENBQUMsQ0FBQztZQUNyRSxPQUFPLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNwRCxDQUFDO1FBRUQsSUFBSSxvQkFBMkMsQ0FBQztRQUNoRCxJQUFJLENBQUM7WUFDSixvQkFBb0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ2hELElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZHLENBQUM7UUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsK0NBQStDLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDN0UsT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDcEQsQ0FBQztRQUVELElBQUksV0FBNEIsQ0FBQztRQUNqQyxJQUFJLG9CQUFvQixDQUFDLGVBQWUsS0FBSyxzQkFBc0IsRUFBRSxDQUFDO1lBQ3JFLFdBQVcsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDO1FBQ3BDLENBQUM7YUFBTSxJQUFJLG9CQUFvQixDQUFDLHNCQUFzQixFQUFFLENBQUM7WUFDeEQsV0FBVyxHQUFHLGVBQWUsQ0FBQyxTQUFTLENBQUM7UUFDekMsQ0FBQzthQUFNLElBQUksb0JBQW9CLENBQUMsWUFBWSxLQUFLLFlBQVksRUFBRSxDQUFDO1lBQy9ELFdBQVcsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDO1FBQ25DLENBQUM7YUFBTSxJQUFJLG9CQUFvQixDQUFDLFlBQVksS0FBSyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ25FLFdBQVcsR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDO1FBQ3ZDLENBQUM7YUFBTSxJQUFJLG9CQUFvQixDQUFDLFlBQVksS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUM3RCxXQUFXLEdBQUcsZUFBZSxDQUFDLFFBQVEsQ0FBQztRQUN4QyxDQUFDO2FBQU0sSUFBSSxvQkFBb0IsQ0FBQyxZQUFZLEtBQUssWUFBWSxFQUFFLENBQUM7WUFDL0QsV0FBVyxHQUFHLGVBQWUsQ0FBQyxVQUFVLENBQUM7UUFDMUMsQ0FBQzthQUFNLElBQUksb0JBQW9CLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDOUMsdUlBQXVJO1lBQ3ZJLFdBQVcsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDO1FBQ25DLENBQUM7YUFBTSxDQUFDO1lBQ1AsV0FBVyxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUM7UUFDM0MsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUFrQjtZQUNuQyxXQUFXO1lBQ1gsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUM7U0FDM0MsQ0FBQztRQUVGLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxZQUFZLENBQUMsV0FBVyxhQUFhLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNySSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUE4Qyx3QkFBd0IsRUFBRTtZQUN2RyxXQUFXLEVBQUUsWUFBWSxDQUFDLFdBQVc7WUFDckMsR0FBRyxFQUFFLG9CQUFvQixDQUFDLHFCQUFxQjtZQUMvQyxTQUFTLEVBQUUsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSxTQUFTO1lBQ2pFLGdCQUFnQixFQUFFLG9CQUFvQixFQUFFLGVBQWUsRUFBRSxvQkFBb0IsRUFBRSxTQUFTO1lBQ3hGLGdCQUFnQixFQUFFLG9CQUFvQixFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsU0FBUztZQUMvRSxjQUFjLEVBQUUsb0JBQW9CLENBQUMsZ0JBQWdCLElBQUksb0JBQW9CLENBQUMsdUJBQXVCO1NBQ3JHLENBQUMsQ0FBQztRQUVILE9BQU8sWUFBWSxDQUFDO0lBQ3JCLENBQUM7SUFFTyxRQUFRLENBQUMsUUFBK0I7UUFDL0MsTUFBTSxNQUFNLEdBQXFCO1lBQ2hDLFNBQVMsRUFBRSxRQUFRLENBQUMsZ0JBQWdCLElBQUksUUFBUSxDQUFDLHVCQUF1QjtTQUN4RSxDQUFDO1FBRUYsd0JBQXdCO1FBQ3hCLElBQUksUUFBUSxDQUFDLGNBQWMsRUFBRSxJQUFJLElBQUksT0FBTyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzdGLE1BQU0sQ0FBQyxJQUFJLEdBQUc7Z0JBQ2IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSTtnQkFDbkMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7Z0JBQ3RILGNBQWMsRUFBRSxLQUFLO2dCQUNyQixZQUFZLEVBQUUsQ0FBQztnQkFDZixTQUFTLEVBQUUsS0FBSzthQUNoQixDQUFDO1FBQ0gsQ0FBQztRQUVELElBQUksUUFBUSxDQUFDLGNBQWMsRUFBRSxXQUFXLElBQUksT0FBTyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsV0FBVyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzNHLE1BQU0sQ0FBQyxXQUFXLEdBQUc7Z0JBQ3BCLEtBQUssRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLFdBQVc7Z0JBQzFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO2dCQUNwSSxjQUFjLEVBQUUsS0FBSztnQkFDckIsWUFBWSxFQUFFLENBQUM7Z0JBQ2YsU0FBUyxFQUFFLEtBQUs7YUFDaEIsQ0FBQztRQUNILENBQUM7UUFFRCxxQkFBcUI7UUFDckIsSUFBSSxRQUFRLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUIsS0FBSyxNQUFNLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxhQUFhLEVBQUUsc0JBQXNCLENBQVUsRUFBRSxDQUFDO2dCQUNsRixNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzdELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO29CQUN2QixTQUFTO2dCQUNWLENBQUM7Z0JBQ0QsTUFBTSxhQUFhLEdBQW1CO29CQUNyQyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsV0FBVztvQkFDbkMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsQ0FBQztvQkFDaEYsY0FBYyxFQUFFLGdCQUFnQixDQUFDLGlCQUFpQjtvQkFDbEQsWUFBWSxFQUFFLGdCQUFnQixDQUFDLGFBQWE7b0JBQzVDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxTQUFTO2lCQUNyQyxDQUFDO2dCQUVGLFFBQVEsU0FBUyxFQUFFLENBQUM7b0JBQ25CLEtBQUssTUFBTTt3QkFDVixNQUFNLENBQUMsSUFBSSxHQUFHLGFBQWEsQ0FBQzt3QkFDNUIsTUFBTTtvQkFDUCxLQUFLLGFBQWE7d0JBQ2pCLE1BQU0sQ0FBQyxXQUFXLEdBQUcsYUFBYSxDQUFDO3dCQUNuQyxNQUFNO29CQUNQLEtBQUssc0JBQXNCO3dCQUMxQixNQUFNLENBQUMsV0FBVyxHQUFHLGFBQWEsQ0FBQzt3QkFDbkMsTUFBTTtnQkFDUixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFJTyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQVcsRUFBRSxJQUFvQixFQUFFLElBQXdCLEVBQUUsT0FBOEIsRUFBRSxLQUF3QjtRQUMxSSxJQUFJLENBQUM7WUFDSixPQUFPLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUM7Z0JBQ3hDLElBQUk7Z0JBQ0osR0FBRztnQkFDSCxJQUFJLEVBQUUsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztnQkFDeEQsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRTtvQkFDUixlQUFlLEVBQUUsVUFBVSxPQUFPLENBQUMsV0FBVyxFQUFFO2lCQUNoRDthQUNELEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDWCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQ3BDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ3JFLENBQUM7WUFFRCxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO0lBQ0YsQ0FBQztJQUVPLE1BQU0sQ0FBQyxLQUFvQjtRQUNsQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUVuQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFFN0QsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEQsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsdUJBQXVCLENBQUMsT0FBMEMsRUFBRSxLQUFLLEdBQUcsaUJBQWlCLENBQUMsSUFBSTtRQUN2RyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsMkJBQTJCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNkLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBOEI7UUFDOUMsTUFBTSxJQUFJLEdBQUc7WUFDWixvQkFBb0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxnQ0FBd0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQzNHLHVCQUF1QixFQUFFLFNBQVM7U0FDbEMsQ0FBQztRQUVGLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsMkJBQTJCLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUgsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLHVCQUF1QixDQUFDLEVBQUUseUNBQXlDLENBQUMsQ0FBQztZQUNySixPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDNUQsQ0FBQztRQUVELElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDaEUsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsS0FBSyxHQUFHLEVBQUUsQ0FBQztnQkFDckMsSUFBSSxDQUFDO29CQUNKLE1BQU0sWUFBWSxHQUFHLE1BQU0sTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUM1QyxJQUFJLFlBQVksRUFBRSxDQUFDO3dCQUNsQixNQUFNLGFBQWEsR0FBd0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDcEUsSUFBSSxPQUFPLGFBQWEsQ0FBQyxPQUFPLEtBQUssUUFBUSxJQUFJLGFBQWEsQ0FBQyxPQUFPLEVBQUUsQ0FBQzs0QkFDeEUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLHFEQUFxRCxhQUFhLENBQUMsT0FBTyxHQUFHLEVBQUUsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDOzRCQUN0SSxPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7d0JBQy9DLENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO2dCQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7b0JBQ2hCLHlCQUF5QjtnQkFDMUIsQ0FBQztZQUNGLENBQUM7WUFDRCxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsNkJBQTZCLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxzREFBc0QsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ2hPLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2xGLENBQUM7UUFFRCxJQUFJLFlBQVksR0FBa0IsSUFBSSxDQUFDO1FBQ3ZDLElBQUksQ0FBQztZQUNKLFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNoQix5QkFBeUI7UUFDMUIsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNuQixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUsMkJBQTJCLENBQUMsRUFBRSxxREFBcUQsQ0FBQyxDQUFDO1lBQzdLLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUM1RCxDQUFDO1FBRUQsSUFBSSxZQUFZLEdBQXdDLFNBQVMsQ0FBQztRQUNsRSxJQUFJLENBQUM7WUFDSixZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQywyQ0FBMkMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNkLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSw0QkFBNEIsQ0FBQyxFQUFFLHVEQUF1RCxHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQ25MLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUM1RCxDQUFDO1FBRUQscUZBQXFGO1FBQ3JGLCtFQUErRTtRQUMvRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRW5ELE9BQU8sT0FBTyxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLE1BQWMsRUFBRSxVQUFrQjtRQUNwRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVsQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3pDLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO2dCQUN0RCxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUs7Z0JBQ3BCLE9BQU8sRUFBRSxRQUFRLENBQUMsb0JBQW9CLEVBQUUsNEZBQTRGLENBQUM7Z0JBQ3JJLE1BQU07Z0JBQ04sYUFBYSxFQUFFLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO2FBQ3pDLENBQUMsQ0FBQztZQUVILE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTywwQkFBMEIsQ0FBQyxVQUFrQixFQUFFLFVBQWtCO1FBQ3hFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRWxDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7Z0JBQ3pCLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztnQkFDcEIsT0FBTyxFQUFFLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSwrREFBK0QsQ0FBQztnQkFDOUcsTUFBTSxFQUFFLFVBQVU7Z0JBQ2xCLE9BQU8sRUFBRTtvQkFDUjt3QkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUM7d0JBQzNCLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBYyxDQUFDO3FCQUN6QjtvQkFDRDt3QkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUM7d0JBQzFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztxQkFDekU7aUJBQ0Q7YUFDRCxDQUFDLENBQUM7UUFDSixDQUFDO0lBQ0YsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFNO1FBQ1gsTUFBTSxVQUFVLEdBQUcseUJBQXVCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbkgsSUFBSSxDQUFDLCtCQUErQixDQUFDLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV2SCxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFUSxPQUFPO1FBQ2YsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVyQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDakIsQ0FBQztDQUNELENBQUE7QUF4Y1ksdUJBQXVCO0lBa0JqQyxXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsc0JBQXNCLENBQUE7SUFDdEIsV0FBQSxXQUFXLENBQUE7SUFDWCxXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsZ0NBQWdDLENBQUE7SUFDaEMsWUFBQSxpQkFBaUIsQ0FBQTtHQTFCUCx1QkFBdUIsQ0F3Y25DOztBQW1CTSxJQUFNLHNCQUFzQixHQUE1QixNQUFNLHNCQUF1QixTQUFRLFVBQVU7O2FBRTdCLHlDQUFvQyxHQUFHLG1CQUFtQixBQUF0QixDQUF1QjtJQWtCbkYsSUFBSSxLQUFLLEtBQW1DLE9BQU8sSUFBSSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQU94RixZQUNxQixpQkFBcUMsRUFDeEMsY0FBZ0QsRUFDM0IsMEJBQWlGLEVBQzFHLFVBQXdDLEVBQ3hCLDBCQUF3RTtRQUVyRyxLQUFLLEVBQUUsQ0FBQztRQUwwQixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDViwrQkFBMEIsR0FBMUIsMEJBQTBCLENBQXNDO1FBQ3pGLGVBQVUsR0FBVixVQUFVLENBQWE7UUFDUCwrQkFBMEIsR0FBMUIsMEJBQTBCLENBQTZCO1FBYjlGLG1CQUFjLEdBQTZDLFNBQVMsQ0FBQztRQUc1RCxpQkFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQzNELGdCQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7UUFFdkMsa0JBQWEsR0FBd0IsU0FBUyxDQUFDO1FBV3RELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUMzRixJQUFJLENBQUMsbUJBQW1CLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDM0YsSUFBSSxDQUFDLGNBQWMsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNqRixJQUFJLENBQUMsYUFBYSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQy9FLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsa0JBQWtCLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDekYsSUFBSSxDQUFDLG9CQUFvQixHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzdGLElBQUksQ0FBQyxhQUFhLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDNUUsSUFBSSxDQUFDLFlBQVksR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUVoRixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUErQix3QkFBc0IsQ0FBQyxvQ0FBb0MsK0JBQXVCLElBQUksRUFBRSxXQUFXLEVBQUUsZUFBZSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXpNLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFTyxLQUFLLENBQUMsMEJBQTBCO1FBRXZDLDZDQUE2QztRQUM3QyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUVuRCwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUF5QixJQUFJLENBQUMsMEJBQTBCLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzFHLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUNoRixPQUFPLENBQUMsa0JBQWtCO1lBQzNCLENBQUM7WUFFRCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzNKLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUM7WUFDaEQsTUFBTSxRQUFRLEdBQUcsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUVyRyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDdEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFNRCxNQUFNLENBQUMsT0FBc0g7UUFDNUgsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsd0NBQXdDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXpGLElBQUksT0FBTyxPQUFPLENBQUMsU0FBUyxLQUFLLFNBQVMsSUFBSSxPQUFPLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDckYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztZQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO1lBRXhDLElBQUksT0FBTyxDQUFDLFNBQVMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDNUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQyx1RUFBdUU7WUFDaEcsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLE9BQU8sT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ3JDLENBQUM7UUFFRCxJQUFJLE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQ25DLENBQUM7UUFFRCxJQUFJLE9BQU8sT0FBTyxDQUFDLFdBQVcsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBRTlDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEtBQUssZUFBZSxDQUFDLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUM1RixJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDL0IsQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxLQUFLLGVBQWUsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDbEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDLENBQUMsc0RBQXNEO1lBQ3ZGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsd0JBQXNCLENBQUMsb0NBQW9DLEVBQUU7WUFDdEYsR0FBRyxJQUFJLENBQUMsTUFBTTtZQUNkLEtBQUssRUFBRSxTQUFTLENBQUMsOENBQThDO1NBQy9ELDhEQUE4QyxDQUFDO1FBRWhELE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQzdCLENBQUM7SUFFTyxLQUFLLENBQUMsYUFBYTtRQUMxQixNQUFNLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFFakMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVPLGlCQUFpQjtRQUN4QixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXBHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEtBQUssZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xGLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEtBQUssZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BGLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxLQUFLLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsS0FBSyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsS0FBSyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsS0FBSyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsS0FBSyxlQUFlLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdEYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVqRCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxPQUFPO1FBQ04sSUFBSSxDQUFDLGNBQWMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRUQsTUFBTTtRQUNMLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDM0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxTQUFTLENBQUM7SUFDaEMsQ0FBQzs7QUFwSlcsc0JBQXNCO0lBNEJoQyxXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxvQ0FBb0MsQ0FBQTtJQUNwQyxXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsMkJBQTJCLENBQUE7R0FoQ2pCLHNCQUFzQixDQXFKbEM7O0FBRUQsWUFBWSJ9