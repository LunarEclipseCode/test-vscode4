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
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IMcpGalleryService, IMcpManagementService } from '../../../../platform/mcp/common/mcpManagement.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { HasInstalledMcpServersContext, IMcpWorkbenchService, McpServersGalleryEnabledContext } from '../common/mcpTypes.js';
import { McpServerEditorInput } from './mcpServerEditorInput.js';
let McpWorkbenchServer = class McpWorkbenchServer {
    constructor(local, gallery, mcpGalleryService, fileService) {
        this.local = local;
        this.gallery = gallery;
        this.mcpGalleryService = mcpGalleryService;
        this.fileService = fileService;
    }
    get id() {
        return this.gallery?.id ?? this.local?.id ?? '';
    }
    get name() {
        return this.gallery?.name ?? this.local?.name ?? '';
    }
    get label() {
        return this.gallery?.displayName ?? this.local?.displayName ?? '';
    }
    get iconUrl() {
        return this.gallery?.iconUrl ?? this.local?.iconUrl;
    }
    get publisherDisplayName() {
        return this.gallery?.publisherDisplayName ?? this.local?.publisherDisplayName ?? this.gallery?.publisher ?? this.local?.publisher;
    }
    get publisherUrl() {
        return this.gallery?.publisherDomain?.link;
    }
    get description() {
        return this.gallery?.description ?? this.local?.description ?? '';
    }
    get installCount() {
        return this.gallery?.installCount ?? 0;
    }
    get url() {
        return this.gallery?.url;
    }
    get repository() {
        return this.gallery?.repositoryUrl;
    }
    async getReadme(token) {
        if (this.local?.readmeUrl) {
            const content = await this.fileService.readFile(this.local.readmeUrl);
            return content.value.toString();
        }
        if (this.gallery?.readmeUrl) {
            return this.mcpGalleryService.getReadme(this.gallery, token);
        }
        return Promise.reject(new Error('not available'));
    }
};
McpWorkbenchServer = __decorate([
    __param(2, IMcpGalleryService),
    __param(3, IFileService)
], McpWorkbenchServer);
let McpWorkbenchService = class McpWorkbenchService extends Disposable {
    get local() { return this._local; }
    constructor(mcpGalleryService, mcpManagementService, editorService, instantiationService) {
        super();
        this.mcpGalleryService = mcpGalleryService;
        this.mcpManagementService = mcpManagementService;
        this.editorService = editorService;
        this.instantiationService = instantiationService;
        this._local = [];
        this._onChange = this._register(new Emitter());
        this.onChange = this._onChange.event;
        this._register(this.mcpManagementService.onDidInstallMcpServers(e => this.onDidInstallMcpServers(e)));
        this._register(this.mcpManagementService.onDidUninstallMcpServer(e => this.onDidUninstallMcpServer(e)));
        this.queryLocal().then(async () => {
            await this.queryGallery();
            this._onChange.fire(undefined);
        });
    }
    onDidUninstallMcpServer(e) {
        if (e.error) {
            return;
        }
        const server = this._local.find(server => server.local?.name === e.name);
        if (server) {
            this._local = this._local.filter(server => server.local?.name !== e.name);
            server.local = undefined;
            this._onChange.fire(server);
        }
    }
    onDidInstallMcpServers(e) {
        for (const result of e) {
            if (!result.local) {
                continue;
            }
            let server = this._local.find(server => server.local?.name === result.name);
            if (server) {
                server.local = result.local;
            }
            else {
                server = this.instantiationService.createInstance(McpWorkbenchServer, result.local, result.source);
                this._local.push(server);
            }
            this._onChange.fire(server);
        }
    }
    fromGallery(gallery) {
        for (const local of this._local) {
            if (local.name === gallery.name) {
                local.gallery = gallery;
                return local;
            }
        }
        return undefined;
    }
    async queryGallery(options, token) {
        if (!this.mcpGalleryService.isEnabled()) {
            return [];
        }
        const result = await this.mcpGalleryService.query(options, token);
        return result.map(gallery => this.fromGallery(gallery) ?? this.instantiationService.createInstance(McpWorkbenchServer, undefined, gallery));
    }
    async queryLocal() {
        const installed = await this.mcpManagementService.getInstalled();
        this._local = installed.map(i => {
            const local = this._local.find(server => server.name === i.name) ?? this.instantiationService.createInstance(McpWorkbenchServer, undefined, undefined);
            local.local = i;
            return local;
        });
        return this._local;
    }
    async install(server) {
        if (!server.gallery) {
            throw new Error('Gallery server is missing');
        }
        await this.mcpManagementService.installFromGallery(server.gallery, server.gallery.packageTypes[0]);
    }
    async uninstall(server) {
        if (!server.local) {
            throw new Error('Local server is missing');
        }
        await this.mcpManagementService.uninstall(server.local);
    }
    async open(extension, options) {
        await this.editorService.openEditor(this.instantiationService.createInstance(McpServerEditorInput, extension), options, ACTIVE_GROUP);
    }
};
McpWorkbenchService = __decorate([
    __param(0, IMcpGalleryService),
    __param(1, IMcpManagementService),
    __param(2, IEditorService),
    __param(3, IInstantiationService)
], McpWorkbenchService);
export { McpWorkbenchService };
let MCPContextsInitialisation = class MCPContextsInitialisation extends Disposable {
    static { this.ID = 'workbench.mcp.contexts.initialisation'; }
    constructor(mcpWorkbenchService, mcpGalleryService, contextKeyService) {
        super();
        const hasInstalledMcpServersContextKey = HasInstalledMcpServersContext.bindTo(contextKeyService);
        McpServersGalleryEnabledContext.bindTo(contextKeyService).set(mcpGalleryService.isEnabled());
        this._register(mcpWorkbenchService.onChange(() => hasInstalledMcpServersContextKey.set(mcpWorkbenchService.local.length > 0)));
    }
};
MCPContextsInitialisation = __decorate([
    __param(0, IMcpWorkbenchService),
    __param(1, IMcpGalleryService),
    __param(2, IContextKeyService)
], MCPContextsInitialisation);
export { MCPContextsInitialisation };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwV29ya2JlbmNoU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwV29ya2JlbmNoU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQWtFLGtCQUFrQixFQUFFLHFCQUFxQixFQUF5QyxNQUFNLGtEQUFrRCxDQUFDO0FBRXBOLE9BQU8sRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDaEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLG9CQUFvQixFQUF1QiwrQkFBK0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2xKLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRWpFLElBQU0sa0JBQWtCLEdBQXhCLE1BQU0sa0JBQWtCO0lBRXZCLFlBQ1EsS0FBa0MsRUFDbEMsT0FBc0MsRUFDUixpQkFBcUMsRUFDM0MsV0FBeUI7UUFIakQsVUFBSyxHQUFMLEtBQUssQ0FBNkI7UUFDbEMsWUFBTyxHQUFQLE9BQU8sQ0FBK0I7UUFDUixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQzNDLGdCQUFXLEdBQVgsV0FBVyxDQUFjO0lBRXpELENBQUM7SUFFRCxJQUFJLEVBQUU7UUFDTCxPQUFPLElBQUksQ0FB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