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
var DynamicAuthenticationProviderStorageService_1;
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IDynamicAuthenticationProviderStorageService } from '../common/dynamicAuthenticationProviderStorage.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { isAuthorizationTokenResponse } from '../../../../base/common/oauth.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Queue } from '../../../../base/common/async.js';
let DynamicAuthenticationProviderStorageService = class DynamicAuthenticationProviderStorageService extends Disposable {
    static { DynamicAuthenticationProviderStorageService_1 = this; }
    static { this.PROVIDERS_STORAGE_KEY = 'dynamicAuthProviders'; }
    constructor(storageService, secretStorageService, logService) {
        super();
        this.storageService = storageService;
        this.secretStorageService = secretStorageService;
        this.logService = logService;
        this._onDidChangeTokens = this._register(new Emitter());
        this.onDidChangeTokens = this._onDidChangeTokens.event;
        // Listen for secret storage changes and emit events for dynamic auth provider token changes
        const queue = new Queue();
        this._register(this.secretStorageService.onDidChangeSecret(async (key) => {
            let payload;
            try {
                payload = JSON.parse(key);
            }
            catch (error) {
                // Ignore errors... must not be a dynamic auth provider
            }
            if (payload?.isDynamicAuthProvider) {
                void queue.queue(async () => {
                    const tokens = await this.getSessionsForDynamicAuthProvider(payload.authProviderId, payload.clientId);
                    this._onDidChangeTokens.fire({
                        authProviderId: payload.authProviderId,
                        clientId: payload.clientId,
                        tokens
                    });
                });
            }
        }));
    }
    getClientId(providerId) {
        const providers = this._getStoredProviders();
        const provider = providers.find(p => p.providerId === providerId);
        return provider?.clientId;
    }
    storeClientId(providerId, authorizationServer, clientId, label) {
        // Store provider information in single location
        this._trackProvider(providerId, authorizationServer, clientId, label);
    }
    _trackProvider(providerId, authorizationServer, clientId, label) {
        const providers = this._getStoredProviders();
        // Check if provider already exists
        const existingProviderIndex = providers.findIndex(p => p.providerId === providerId);
        if (existingProviderIndex === -1) {
            // Add new provider with provided or default info
            const newProvider = {
                providerId,
                label: label || providerId, // Use provided label or providerId as default
                authorizationServer,
                clientId
            };
            providers.push(newProvider);
            this._storeProviders(providers);
        }
        else {
            const existingProvider = providers[existingProviderIndex];
            // Create new provider object with updated info
            const updatedProvider = {
                providerId,
                label: label || existingProvider.label,
                authorizationServer,
                clientId
            };
            providers[existingProviderIndex] = updatedProvider;
            this._storeProviders(providers);
        }
    }
    _getStoredProviders() {
        const stored = this.storageService.get(DynamicAuthenticationProviderStorageService_1.PROVIDERS_STORAGE_KEY, -1 /* StorageScope.APPLICATION */, '[]');
        try {
            const providerInfos = JSON.parse(stored);
            // MIGRATION: remove after an iteration or 2
            for (const providerInfo of providerInfos) {
                if (!providerInfo.authorizationServer) {
                    providerInfo.authorizationServer = providerInfo.issuer;
                }
            }
            return providerInfos;
        }
        catch {
            return [];
        }
    }
    _storeProviders(providers) {
        this.storageService.store(DynamicAuthenticationProviderStorageService_1.PROVIDERS_STORAGE_KEY, JSON.stringify(providers), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
    }
    getInteractedProviders() {
        return this._getStoredProviders();
    }
    async removeDynamicProvider(providerId) {
        // Get provider info before removal for secret cleanup
        const providers = this._getStoredProviders();
        const providerInfo = providers.find(p => p.providerId === providerId);
        // Remove from stored providers
        const filteredProviders = providers.filter(p => p.providerId !== providerId);
        this._storeProviders(filteredProviders);
        // Remove sessions from secret storage if we have the provider info
        if (providerInfo) {
            const secretKey = JSON.stringify({ isDynamicAuthProvider: true, authProviderId: providerId, clientId: providerInfo.clientId });
            await this.secretStorageService.delete(secretKey);
        }
    }
    async getSessionsForDynamicAuthProvider(authProviderId, clientId) {
        const key = JSON.stringify({ isDynamicAuthProvider: true, authProviderId, clientId });
        const value = await this.secretStorageService.get(key);
        if (value) {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed) || !parsed.every((t) => typeof t.created_at === 'number' && isAuthorizationTokenResponse(t))) {
                this.logService.error(`Invalid session data for ${authProviderId} (${clientId}) in secret storage:`, parsed);
                await this.secretStorageService.delete(key);
                return undefined;
            }
            return parsed;
        }
        return undefined;
    }
    async setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions) {
        const key = JSON.stringify({ isDynamicAuthProvider: true, authProviderId, clientId });
        const value = JSON.stringify(sessions);
        await this.secretStorageService.set(key, value);
        this.logService.trace(`Set session data for ${authProviderId} (${clientId}) in secret storage:`, sessions);
    }
};
DynamicAuthenticationProviderStorageService = DynamicAuthenticationProviderStorageService_1 = __decorate([
    __param(0, IStorageService),
    __param(1, ISecretStorageService),
    __param(2, ILogService)
], DynamicAuthenticationProviderStorageService);
export { DynamicAuthenticationProviderStorageService };
registerSingleton(IDynamicAuthenticationProviderStorageService, DynamicAuthenticationProviderStorageService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1pY0F1dGhlbnRpY2F0aW9uUHJvdmlkZXJTdG9yYWdlU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvZHluYW1pY0F1dGhlbnRpY2F0aW9uUHJvdmlkZXJTdG9yYWdlU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLDRDQUE0QyxFQUFxRixNQUFNLG1EQUFtRCxDQUFDO0FBQ3BNLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBK0IsNEJBQTRCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM3RyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFbEQsSUFBTSwyQ0FBMkMsR0FBakQsTUFBTSwyQ0FBNEMsU0FBUSxVQUFVOzthQUdsRCwwQkFBcUIsR0FBRyxzQkFBc0IsQUFBekIsQ0FBMEI7SUFLdkUsWUFDa0IsY0FBZ0QsRUFDMUMsb0JBQTRELEVBQ3RFLFVBQXdDO1FBRXJELEtBQUssRUFBRSxDQUFDO1FBSjBCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUN6Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ3JELGVBQVUsR0FBVixVQUFVLENB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