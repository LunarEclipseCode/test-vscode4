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
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
export const IAuthenticationMcpAccessService = createDecorator('IAuthenticationMcpAccessService');
let AuthenticationMcpAccessService = class AuthenticationMcpAccessService extends Disposable {
    constructor(_storageService, _productService) {
        super();
        this._storageService = _storageService;
        this._productService = _productService;
        this._onDidChangeMcpSessionAccess = this._register(new Emitter());
        this.onDidChangeMcpSessionAccess = this._onDidChangeMcpSessionAccess.event;
    }
    isAccessAllowed(providerId, accountName, mcpServerId) {
        const trustedMCPServerAuthAccess = this._productService.trustedMcpAuthAccess;
        if (Array.isArray(trustedMCPServerAuthAccess)) {
            if (trustedMCPServerAuthAccess.includes(mcpServerId)) {
                return true;
            }
        }
        else if (trustedMCPServerAuthAccess?.[providerId]?.includes(mcpServerId)) {
            return true;
        }
        const allowList = this.readAllowedMcpServers(providerId, accountName);
        const mcpServerData = allowList.find(mcpServer => mcpServer.id === mcpServerId);
        if (!mcpServerData) {
            return undefined;
        }
        // This property didn't exist on this data previously, inclusion in the list at all indicates allowance
        return mcpServerData.allowed !== undefined
            ? mcpServerData.allowed
            : true;
    }
    readAllowedMcpServers(providerId, accountName) {
        let trustedMCPServers = [];
        try {
            const trustedMCPServerSrc = this._storageService.get(`mcpserver-${providerId}-${accountName}`, -1 /* StorageScope.APPLICATION */);
            if (trustedMCPServerSrc) {
                trustedMCPServers = JSON.parse(trustedMCPServerSrc);
            }
        }
        catch (err) { }
        return trustedMCPServers;
    }
    updateAllowedMcpServers(providerId, accountName, mcpServers) {
        const allowList = this.readAllowedMcpServers(providerId, accountName);
        for (const mcpServer of mcpServers) {
            const index = allowList.findIndex(e => e.id === mcpServer.id);
            if (index === -1) {
                allowList.push(mcpServer);
            }
            else {
                allowList[index].allowed = mcpServer.allowed;
            }
        }
        this._storageService.store(`mcpserver-${providerId}-${accountName}`, JSON.stringify(allowList), -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
    }
    removeAllowedMcpServers(providerId, accountName) {
        this._storageService.remove(`mcpserver-${providerId}-${accountName}`, -1 /* StorageScope.APPLICATION */);
        this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
    }
};
AuthenticationMcpAccessService = __decorate([
    __param(0, IStorageService),
    __param(1, IProductService)
], AuthenticationMcpAccessService);
export { AuthenticationMcpAccessService };
registerSingleton(IAuthenticationMcpAccessService, AuthenticationMcpAccessService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25NY3BBY2Nlc3NTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvbk1jcEFjY2Vzc1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBZ0I5RyxNQUFNLENBQUMsTUFBTSwrQkFBK0IsR0FBRyxlQUFlLENBQWtDLGlDQUFpQyxDQUFDLENBQUM7QUFvQjVILElBQU0sOEJBQThCLEdBQXBDLE1BQU0sOEJBQStCLFNBQVEsVUFBVTtJQU03RCxZQUNrQixlQUFpRCxFQUNqRCxlQUFpRDtRQUVsRSxLQUFLLEVBQUUsQ0FBQztRQUgwQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDaEMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBTDNELGlDQUE0QixHQUF5RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUErQyxDQUFDLENBQUM7UUFDL0osZ0NBQTJCLEdBQXVELElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLENBQUM7SUFPbkksQ0FBQztJQUVELGVBQWUsQ0FBQyxVQUFrQixFQUFFLFdBQW1CLEVBQUUsV0FBbUI7UUFDM0UsTUFB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