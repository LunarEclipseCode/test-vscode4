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
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { deepClone } from '../../../base/common/objects.js';
import { uppercaseFirstLetter } from '../../../base/common/strings.js';
import { URI } from '../../../base/common/uri.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { IFileService } from '../../files/common/files.js';
import { ILogService } from '../../log/common/log.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
import { IMcpGalleryService } from './mcpManagement.js';
let McpManagementService = class McpManagementService extends Disposable {
    get onDidInstallMcpServers() { return this._onDidInstallMcpServers.event; }
    get onUninstallMcpServer() { return this._onUninstallMcpServer.event; }
    get onDidUninstallMcpServer() { return this._onDidUninstallMcpServer.event; }
    constructor(configurationService, mcpGalleryService, fileService, environmentService, uriIdentityService, logService) {
        super();
        this.configurationService = configurationService;
        this.mcpGalleryService = mcpGalleryService;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this._onInstallMcpServer = this._register(new Emitter());
        this.onInstallMcpServer = this._onInstallMcpServer.event;
        this._onDidInstallMcpServers = this._register(new Emitter());
        this._onUninstallMcpServer = this._register(new Emitter());
        this._onDidUninstallMcpServer = this._register(new Emitter());
        this.mcpLocation = uriIdentityService.extUri.joinPath(environmentService.userRoamingDataHome, 'mcp');
    }
    async getInstalled() {
        const { userLocal } = this.configurationService.inspect('mcp');
        if (!userLocal?.value?.servers) {
            return [];
        }
        return Promise.all(Object.entries(userLocal.value.servers).map(([name, config]) => this.scanServer(name, config)));
    }
    async scanServer(name, config) {
        let scanned;
        let readmeUrl;
        if (config.location) {
            const manifestLocation = this.uriIdentityService.extUri.joinPath(URI.revive(config.location), 'manifest.json');
            try {
                const content = await this.fileService.readFile(manifestLocation);
                scanned = JSON.parse(content.value.toString());
            }
            catch (e) {
                this.logService.error('MCP Management Service: failed to read manifest', config.location.toString(), e);
            }
            readmeUrl = this.uriIdentityService.extUri.joinPath(URI.revive(config.location), 'README.md');
            if (!await this.fileService.exists(readmeUrl)) {
                readmeUrl = undefined;
            }
        }
        if (!scanned) {
            let publisher = '';
            const nameParts = name.split('/');
            if (nameParts.length > 0) {
                const domainParts = nameParts[0].split('.');
                if (domainParts.length > 0) {
                    publisher = domainParts[domainParts.length - 1]; // Always take the last part as owner
                }
            }
            scanned = {
                name,
                version: '1.0.0',
                displayName: nameParts[nameParts.length - 1].split('-').map(s => uppercaseFirstLetter(s)).join(' '),
                publisher
            };
        }
        return {
            name,
            config,
            version: scanned.version,
            location: URI.revive(config.location),
            id: scanned.id,
            displayName: scanned.displayName,
            description: scanned.description,
            publisher: scanned.publisher,
            publisherDisplayName: scanned.publisherDisplayName,
            repositoryUrl: scanned.repositoryUrl,
            readmeUrl,
            iconUrl: scanned.iconUrl,
            manifest: scanned.manifest
        };
    }
    async installFromGallery(server, packageType) {
        this.logService.trace('MCP Management Service: installGallery', server.url);
        this._onInstallMcpServer.fire({ name: server.name });
        try {
            const manifest = await this.mcpGalleryService.getManifest(server, CancellationToken.None);
            const location = this.uriIdentityService.extUri.joinPath(this.mcpLocation, `${server.name.replace('/', '.')}-${server.version}`);
            const manifestPath = this.uriIdentityService.extUri.joinPath(location, 'manifest.json');
            await this.fileService.writeFile(manifestPath, VSBuffer.fromString(JSON.stringify({
                id: server.id,
                name: server.name,
                displayName: server.displayName,
                description: server.description,
                version: server.version,
                publisher: server.publisher,
                publisherDisplayName: server.publisherDisplayName,
                repository: server.repositoryUrl,
                licenseUrl: server.licenseUrl,
                ...manifest,
            })));
            if (server.readmeUrl) {
                const readme = await this.mcpGalleryService.getReadme(server, CancellationToken.None);
                await this.fileService.writeFile(this.uriIdentityService.extUri.joinPath(location, 'README.md'), VSBuffer.fromString(readme));
            }
            const { userLocal } = this.configurationService.inspect('mcp');
            const value = deepClone(userLocal?.value ?? { servers: {} });
            if (!value.servers) {
                value.servers = {};
            }
            const serverConfig = this.getServerConfig(manifest, packageType);
            value.servers[server.name] = {
                ...serverConfig,
                location: location.toJSON(),
            };
            if (serverConfig.inputs) {
                value.inputs = value.inputs ?? [];
                for (const input of serverConfig.inputs) {
                    if (!value.inputs.some(i => i.id === input.id)) {
                        value.inputs.push({ ...input, serverName: server.name });
                    }
                }
            }
            await this.configurationService.updateValue('mcp', value, 3 /* ConfigurationTarget.USER_LOCAL */);
            const local = await this.scanServer(server.name, value.servers[server.name]);
            this._onDidInstallMcpServers.fire([{ name: server.name, source: server, local }]);
        }
        catch (e) {
            this._onDidInstallMcpServers.fire([{ name: server.name, source: server, error: e }]);
            throw e;
        }
    }
    async uninstall(server) {
        this.logService.trace('MCP Management Service: uninstall', server.name);
        this._onUninstallMcpServer.fire({ name: server.name });
        try {
            const { userLocal } = this.configurationService.inspect('mcp');
            const value = deepClone(userLocal?.value ?? { servers: {} });
            if (!value.servers) {
                value.servers = {};
            }
            delete value.servers[server.name];
            if (value.inputs) {
                const index = value.inputs.findIndex(i => i.serverName === server.name);
                if (index !== undefined && index >= 0) {
                    value.inputs?.splice(index, 1);
                }
            }
            await this.configurationService.updateValue('mcp', value, 3 /* ConfigurationTarget.USER_LOCAL */);
            if (server.location) {
                await this.fileService.del(URI.revive(server.location), { recursive: true });
            }
            this._onDidUninstallMcpServer.fire({ name: server.name });
        }
        catch (e) {
            this._onDidUninstallMcpServer.fire({ name: server.name, error: e });
            throw e;
        }
    }
    getServerConfig(manifest, packageType) {
        if (packageType === undefined) {
            packageType = manifest.packages?.[0]?.registry_name ?? "remote" /* PackageType.REMOTE */;
        }
        if (packageType === "remote" /* PackageType.REMOTE */) {
            const inputs = [];
            const headers = {};
            for (const input of manifest.remotes[0].headers ?? []) {
                headers[input.name] = input.value;
                if (input.variables) {
                    inputs.push(...this.getVariables(input.variables));
                }
            }
            return {
                type: 'http',
                url: manifest.remotes[0].url,
                headers: Object.keys(headers).length ? headers : undefined,
                inputs: inputs.length ? inputs : undefined,
            };
        }
        const serverPackage = manifest.packages.find(p => p.registry_name === packageType) ?? manifest.packages[0];
        const inputs = [];
        const args = [];
        const env = {};
        if (serverPackage.registry_name === "docker" /* PackageType.DOCKER */) {
            args.push('run');
            args.push('-i');
            args.push('--rm');
        }
        for (const arg of serverPackage.runtime_arguments ?? []) {
            if (arg.type === 'positional') {
                args.push(arg.value ?? arg.value_hint);
            }
            else if (arg.type === 'named') {
                args.push(arg.name);
                if (arg.value) {
                    args.push(arg.value);
                }
            }
            if (arg.variables) {
                inputs.push(...this.getVariables(arg.variables));
            }
        }
        for (const input of serverPackage.environment_variables ?? []) {
            const variables = input.variables ? this.getVariables(input.variables) : [];
            let value = input.value;
            for (const variable of variables) {
                value = value.replace(`{${variable.id}}`, `\${input:${variable.id}}`);
            }
            env[input.name] = value;
            if (variables.length) {
                inputs.push(...variables);
            }
            if (serverPackage.registry_name === "docker" /* PackageType.DOCKER */) {
                args.push('-e');
                args.push(input.name);
            }
        }
        if (serverPackage.registry_name === "npm" /* PackageType.NODE */) {
            args.push(`${serverPackage.name}@${serverPackage.version}`);
        }
        else if (serverPackage.registry_name === "pypi" /* PackageType.PYTHON */) {
            args.push(`${serverPackage.name}==${serverPackage.version}`);
        }
        else if (serverPackage.registry_name === "docker" /* PackageType.DOCKER */) {
            args.push(`${serverPackage.name}:${serverPackage.version}`);
        }
        for (const arg of serverPackage.package_arguments ?? []) {
            if (arg.type === 'positional') {
                args.push(arg.value ?? arg.value_hint);
            }
            else if (arg.type === 'named') {
                args.push(arg.name);
                if (arg.value) {
                    args.push(arg.value);
                }
            }
            if (arg.variables) {
                inputs.push(...this.getVariables(arg.variables));
            }
        }
        return {
            type: 'stdio',
            command: this.getCommandName(serverPackage.registry_name),
            args: args.length ? args : undefined,
            env: Object.keys(env).length ? env : undefined,
            inputs: inputs.length ? inputs : undefined,
        };
    }
    getCommandName(packageType) {
        switch (packageType) {
            case "npm" /* PackageType.NODE */: return 'npx';
            case "docker" /* PackageType.DOCKER */: return 'docker';
            case "pypi" /* PackageType.PYTHON */: return 'uvx';
        }
        return packageType;
    }
    getVariables(variableInputs) {
        const variables = [];
        for (const [key, value] of Object.entries(variableInputs)) {
            variables.push({
                id: key,
                type: value.choices ? "pickString" /* McpServerVariableType.PICK */ : "promptString" /* McpServerVariableType.PROMPT */,
                description: value.description ?? '',
                password: !!value.is_secret,
                default: value.default,
                options: value.choices,
            });
        }
        return variables;
    }
};
McpManagementService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IMcpGalleryService),
    __param(2, IFileService),
    __param(3, IEnvironmentService),
    __param(4, IUriIdentityService),
    __param(5, ILogService)
], McpManagementService);
export { McpManagementService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL21jcC9jb21tb24vbWNwTWFuYWdlbWVudFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDL0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDekcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RSxPQUFPLEVBQWtFLGtCQUFrQixFQUFtSixNQUFNLG9CQUFvQixDQUFDO0FBaUJsUSxJQUFNLG9CQUFvQixHQUExQixNQUFNLG9CQUFxQixTQUFRLFVBQVU7SUFVbkQsSUFBSSxzQkFBc0IsS0FBSyxPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRzNFLElB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