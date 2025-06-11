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
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { decodeBase64 } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { markdownCommandLink, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { equals } from '../../../../base/common/objects.js';
import { autorun, observableValue, transaction } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ChatResponseResource, getAttachableImageExtension } from '../../chat/common/chatModel.js';
import { ILanguageModelToolsService } from '../../chat/common/languageModelToolsService.js';
import { IMcpRegistry } from './mcpRegistryTypes.js';
import { McpServer, McpServerMetadataCache } from './mcpServer.js';
import { McpResourceURI, McpServerDefinition } from './mcpTypes.js';
let McpService = class McpService extends Disposable {
    get lazyCollectionState() { return this._mcpRegistry.lazyCollectionState; }
    constructor(_instantiationService, _mcpRegistry, _toolsService, _logService) {
        super();
        this._instantiationService = _instantiationService;
        this._mcpRegistry = _mcpRegistry;
        this._toolsService = _toolsService;
        this._logService = _logService;
        this._servers = observableValue(this, []);
        this.servers = this._servers.map(servers => servers.map(s => s.object));
        this.userCache = this._register(_instantiationService.createInstance(McpServerMetadataCache, 0 /* StorageScope.PROFILE */));
        this.workspaceCache = this._register(_instantiationService.createInstance(McpServerMetadataCache, 1 /* StorageScope.WORKSPACE */));
        const updateThrottle = this._store.add(new RunOnceScheduler(() => this.updateCollectedServers(), 500));
        // Throttle changes so that if a collection is changed, or a server is
        // unregistered/registered, we don't stop servers unnecessarily.
        this._register(autorun(reader => {
            for (const collection of this._mcpRegistry.collections.read(reader)) {
                collection.serverDefinitions.read(reader);
            }
            updateThrottle.schedule(500);
        }));
    }
    resetCaches() {
        this.userCache.reset();
        this.workspaceCache.reset();
    }
    async activateCollections() {
        const collections = await this._mcpRegistry.discoverCollections();
        const collectionIds = new Set(collections.map(c => c.id));
        this.updateCollectedServers();
        // Discover any newly-collected servers with unknown tools
        const todo = [];
        for (const { object: server } of this._servers.get()) {
            if (collectionIds.has(server.collection.id)) {
                const state = server.cacheState.get();
                if (state === 0 /* McpServerCacheState.Unknown */) {
                    todo.push(server.start());
                }
            }
        }
        await Promise.all(todo);
    }
    _syncTools(server, toolSet, source, store) {
        const tools = new Map();
        store.add(autorun(reader => {
            const toDelete = new Set(tools.keys());
            // toRegister is deferred until deleting tools that moving a tool between
            // servers (or deleting one instance of a multi-instance server) doesn't cause an error.
            const toRegister = [];
            const registerTool = (tool, toolData, store) => {
                store.add(this._toolsService.registerToolData(toolData));
                store.add(this._toolsService.registerToolImplementation(tool.id, this._instantiationService.createInstance(McpToolImplementation, tool, server)));
                store.add(toolSet.addTool(toolData));
            };
            for (const tool of server.tools.read(reader)) {
                const existing = tools.get(tool.id);
                const collection = this._mcpRegistry.collections.get().find(c => c.id === server.collection.id);
                const toolData = {
                    id: tool.id,
                    source,
                    icon: Codicon.tools,
                    displayName: tool.definition.annotations?.title || tool.definition.name,
                    toolReferenceName: tool.referenceName,
                    modelDescription: tool.definition.description ?? '',
                    userDescription: tool.definition.description ?? '',
                    inputSchema: tool.definition.inputSchema,
                    canBeReferencedInPrompt: true,
                    alwaysDisplayInputOutput: true,
                    runsInWorkspace: collection?.scope === 1 /* StorageScope.WORKSPACE */ || !!collection?.remoteAuthority,
                    tags: ['mcp'],
                };
                if (existing) {
                    if (!equals(existing.toolData, toolData)) {
                        existing.toolData = toolData;
                        existing.store.clear();
                        // We need to re-register both the data and implementation, as the
                        // implementation is discarded when the data is removed (#245921)
                        registerTool(tool, toolData, store);
                    }
                    toDelete.delete(tool.id);
                }
                else {
                    const store = new DisposableStore();
                    toRegister.push(() => registerTool(tool, toolData, store));
                    tools.set(tool.id, { toolData, store });
                }
            }
            for (const id of toDelete) {
                const tool = tools.get(id);
                if (tool) {
                    tool.store.dispose();
                    tools.delete(id);
                }
            }
            for (const fn of toRegister) {
                fn();
            }
        }));
        store.add(toDisposable(() => {
            for (const tool of tools.values()) {
                tool.store.dispose();
            }
        }));
    }
    updateCollectedServers() {
        const prefixGenerator = new McpPrefixGenerator();
        const definitions = this._mcpRegistry.collections.get().flatMap(collectionDefinition => collectionDefinition.serverDefinitions.get().map(serverDefinition => {
            const toolPrefix = prefixGenerator.generate(serverDefinition.label);
            return { serverDefinition, collectionDefinition, toolPrefix };
        }));
        const nextDefinitions = new Set(definitions);
        const currentServers = this._servers.get();
        const nextServers = [];
        const pushMatch = (match, rec) => {
            nextDefinitions.delete(match);
            nextServers.push(rec);
            const connection = rec.object.connection.get();
            // if the definition was modified, stop the server; it'll be restarted again on-demand
            if (connection && !McpServerDefinition.equals(connection.definition, match.serverDefinition)) {
                rec.object.stop();
                this._logService.debug(`MCP server ${rec.object.definition.id} stopped because the definition changed`);
            }
        };
        // Transfer over any servers that are still valid.
        for (const server of currentServers) {
            const match = definitions.find(d => defsEqual(server.object, d) && server.toolPrefix === d.toolPrefix);
            if (match) {
                pushMatch(match, server);
            }
            else {
                server.dispose();
            }
        }
        // Create any new servers that are needed.
        for (const def of nextDefinitions) {
            const store = new DisposableStore();
            const object = this._instantiationService.createInstance(McpServer, def.collectionDefinition, def.serverDefinition, def.serverDefinition.roots, !!def.collectionDefinition.lazy, def.collectionDefinition.scope === 1 /* StorageScope.WORKSPACE */ ? this.workspaceCache : this.userCache, def.toolPrefix);
            const source = { type: 'mcp', label: object.definition.label, collectionId: object.collection.id, definitionId: object.definition.id };
            const toolSet = this._toolsService.createToolSet(source, def.serverDefinition.id, def.serverDefinition.label, {
                icon: Codicon.mcp,
                description: localize('mcp.toolset', "{0}: All Tools", def.serverDefinition.label)
            });
            store.add(toolSet);
            store.add(object);
            this._syncTools(object, toolSet, source, store);
            nextServers.push({ object, dispose: () => store.dispose(), toolPrefix: def.toolPrefix });
        }
        transaction(tx => {
            this._servers.set(nextServers, tx);
        });
    }
    dispose() {
        this._servers.get().forEach(s => s.dispose());
        super.dispose();
    }
};
McpService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IMcpRegistry),
    __param(2, ILanguageModelToolsService),
    __param(3, ILogService)
], McpService);
export { McpService };
function defsEqual(server, def) {
    return server.collection.id === def.collectionDefinition.id && server.definition.id === def.serverDefinition.id;
}
let McpToolImplementation = class McpToolImplementation {
    constructor(_tool, _server, _productService) {
        this._tool = _tool;
        this._server = _server;
        this._productService = _productService;
    }
    async prepareToolInvocation(parameters) {
        const tool = this._tool;
        const server = this._server;
        const mcpToolWarning = localize('mcp.tool.warning', "Note that MCP servers or malicious conversation content may attempt to misuse '{0}' through tools.", this._productService.nameShort);
        const needsConfirmation = !tool.definition.annotations?.readOnlyHint;
        const title = tool.definition.annotations?.title || ('`' + tool.definition.name + '`');
        const subtitle = localize('msg.subtitle', "{0} (MCP Server)", server.definition.label);
        return {
            confirmationMessages: needsConfirmation ? {
                title: new MarkdownString(localize('msg.title', "Run {0}", title)),
                message: new MarkdownString(tool.definition.description, { supportThemeIcons: true }),
                disclaimer: mcpToolWarning,
                allowAutoConfirm: true,
            } : undefined,
            invocationMessage: new MarkdownString(localize('msg.run', "Running {0}", title)),
            pastTenseMessage: new MarkdownString(localize('msg.ran', "Ran {0} ", title)),
            originMessage: new MarkdownString(markdownCommandLink({
                id: "workbench.mcp.showConfiguration" /* McpCommandIds.ShowConfiguration */,
                title: subtitle,
                arguments: [server.collection.id, server.definition.id],
            }), { isTrusted: true }),
            toolSpecificData: {
                kind: 'input',
                rawInput: parameters
            }
        };
    }
    async invoke(invocation, _countTokens, progress, token) {
        const result = {
            content: []
        };
        const callResult = await this._tool.callWithProgress(invocation.parameters, progress, token);
        const details = {
            input: JSON.stringify(invocation.parameters, undefined, 2),
            output: [],
            isError: callResult.isError === true,
        };
        for (const item of callResult.content) {
            const audience = item.annotations?.audience || ['assistant'];
            if (audience.includes('user')) {
                if (item.type === 'text') {
                    progress.report({ message: item.text });
                }
            }
            // Rewrite image rsources to images so they are inlined nicely
            const addAsInlineData = (mimeType, value, uri) => {
                details.output.push({ mimeType, value, uri });
                if (isForModel) {
                    result.content.push({
                        kind: 'data',
                        value: { mimeType, data: decodeBase64(value) }
                    });
                }
            };
            const isForModel = audience.includes('assistant');
            if (item.type === 'text') {
                details.output.push({ isText: true, value: item.text });
                if (isForModel) {
                    result.content.push({
                        kind: 'text',
                        value: item.text
                    });
                }
            }
            else if (item.type === 'image' || item.type === 'audio') {
                // default to some image type if not given to hint
                addAsInlineData(item.mimeType || 'image/png', item.data);
            }
            else if (item.type === 'resource') {
                const uri = McpResourceURI.fromServer(this._server.definition, item.resource.uri);
                if (item.resource.mimeType && getAttachableImageExtension(item.resource.mimeType) && 'blob' in item.resource) {
                    addAsInlineData(item.resource.mimeType, item.resource.blob, uri);
                }
                else {
                    details.output.push({
                        uri,
                        isText: 'text' in item.resource,
                        mimeType: item.resource.mimeType,
                        value: 'blob' in item.resource ? item.resource.blob : item.resource.text,
                        asResource: true,
                    });
                    if (isForModel) {
                        const permalink = invocation.chatRequestId && invocation.context && ChatResponseResource.createUri(invocation.context.sessionId, invocation.chatRequestId, invocation.callId, result.content.length, basename(uri));
                        result.content.push({
                            kind: 'text',
                            value: 'text' in item.resource ? item.resource.text : `The tool returns a resource which can be read from the URI ${permalink || uri}`,
                        });
                    }
                }
            }
        }
        result.toolResultDetails = details;
        return result;
    }
};
McpToolImplementation = __decorate([
    __param(2, IProductService)
], McpToolImplementation);
// Helper class for generating unique MCP tool prefixes
class McpPrefixGenerator {
    constructor() {
        this.seenPrefixes = new Set();
    }
    generate(label) {
        const baseToolPrefix = "mcp_" /* McpToolName.Prefix */ + label.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 18 /* McpToolName.MaxPrefixLen */ - "mcp_" /* McpToolName.Prefix */.length - 1);
        let toolPrefix = baseToolPrefix + '_';
        for (let i = 2; this.seenPrefixes.has(toolPrefix); i++) {
            toolPrefix = baseToolPrefix + i + '_';
        }
        this.seenPrefixes.add(toolPrefix);
        return toolPrefix;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUVqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFjLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzdHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFlLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMzRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFFeEYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLDJCQUEyQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkcsT0FBTyxFQUF1QiwwQkFBMEIsRUFBcUosTUFBTSxnREFBZ0QsQ0FBQztBQUVwUSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sdUJB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