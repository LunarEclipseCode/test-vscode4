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
import { computeLevenshteinDistance } from '../../../../base/common/diff/diff.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { markdownCommandLink, MarkdownString } from '../../../../base/common/htmlContent.js';
import { findNodeAtLocation, parseTree } from '../../../../base/common/json.js';
import { Disposable, DisposableStore, dispose, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { isEqual } from '../../../../base/common/resources.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { localize } from '../../../../nls.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { ConfigurationResolverExpression } from '../../../services/configurationResolver/common/configurationResolverExpression.js';
import { IMcpConfigPathsService } from '../common/mcpConfigPathsService.js';
import { mcpConfigurationSection } from '../common/mcpConfiguration.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { IMcpService } from '../common/mcpTypes.js';
const diagnosticOwner = 'vscode.mcp';
let McpLanguageFeatures = class McpLanguageFeatures extends Disposable {
    constructor(languageFeaturesService, _mcpRegistry, _mcpConfigPathsService, _mcpService, _markerService, _configurationResolverService) {
        super();
        this._mcpRegistry = _mcpRegistry;
        this._mcpConfigPathsService = _mcpConfigPathsService;
        this._mcpService = _mcpService;
        this._markerService = _markerService;
        this._configurationResolverService = _configurationResolverService;
        this._cachedMcpSection = this._register(new MutableDisposable());
        const patterns = [
            { pattern: '**/.vscode/mcp.json' },
            { pattern: '**/settings.json' },
            { pattern: '**/workspace.json' },
        ];
        const onDidChangeCodeLens = this._register(new Emitter());
        const codeLensProvider = {
            onDidChange: onDidChangeCodeLens.event,
            provideCodeLenses: (model, range) => this._provideCodeLenses(model, () => onDidChangeCodeLens.fire(codeLensProvider)),
        };
        this._register(languageFeaturesService.codeLensProvider.register(patterns, codeLensProvider));
        this._register(languageFeaturesService.inlayHintsProvider.register(patterns, {
            onDidChangeInlayHints: _mcpRegistry.onDidChangeInputs,
            provideInlayHints: (model, range) => this._provideInlayHints(model, range),
        }));
    }
    /** Simple mechanism to avoid extra json parsing for hints+lenses */
    _parseModel(model) {
        if (this._cachedMcpSection.value?.model === model) {
            return this._cachedMcpSection.value;
        }
        const uri = model.uri;
        const inConfig = this._mcpConfigPathsService.paths.get().find(u => isEqual(u.uri, uri));
        if (!inConfig) {
            return undefined;
        }
        const value = model.getValue();
        const tree = parseTree(value);
        const listeners = [
            model.onDidChangeContent(() => this._cachedMcpSection.clear()),
            model.onWillDispose(() => this._cachedMcpSection.clear()),
        ];
        this._addDiagnostics(model, value, tree, inConfig);
        return this._cachedMcpSection.value = {
            model,
            tree,
            inConfig,
            dispose: () => {
                this._markerService.remove(diagnosticOwner, [uri]);
                dispose(listeners);
            }
        };
    }
    _addDiagnostics(tm, value, tree, inConfig) {
        const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, 'servers'] : ['servers']);
        if (!serversNode) {
            return;
        }
        const getClosestMatchingVariable = (name) => {
            let bestValue = '';
            let bestDistance = Infinity;
            for (const variable of this._configurationResolverService.resolvableVariables) {
                const distance = computeLevenshteinDistance(name, variable);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestValue = variable;
                }
            }
            return bestValue;
        };
        const diagnostics = [];
        forEachPropertyWithReplacement(serversNode, node => {
            const expr = ConfigurationResolverExpression.parse(node.value);
            for (const { id, name, arg } of expr.unresolved()) {
                if (!this._configurationResolverService.resolvableVariables.has(name)) {
                    const position = value.indexOf(id, node.offset);
                    if (position === -1) {
                        continue;
                    } // unreachable?
                    const start = tm.getPositionAt(position);
                    const end = tm.getPositionAt(position + id.length);
                    diagnostics.push({
                        severity: MarkerSeverity.Warning,
                        message: localize('mcp.variableNotFound', 'Variable `{0}` not found, did you mean ${{1}}?', name, getClosestMatchingVariable(name) + (arg ? `:${arg}` : '')),
                        startLineNumber: start.lineNumber,
                        startColumn: start.column,
                        endLineNumber: end.lineNumber,
                        endColumn: end.column,
                        modelVersionId: tm.getVersionId(),
                    });
                }
            }
        });
        if (diagnostics.length) {
            this._markerService.changeOne(diagnosticOwner, tm.uri, diagnostics);
        }
        else {
            this._markerService.remove(diagnosticOwner, [tm.uri]);
        }
    }
    _provideCodeLenses(model, onDidChangeCodeLens) {
        const parsed = this._parseModel(model);
        if (!parsed) {
            return undefined;
        }
        const { tree, inConfig } = parsed;
        const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, 'servers'] : ['servers']);
        if (!serversNode) {
            return undefined;
        }
        const store = new DisposableStore();
        const lenses = { lenses: [], dispose: () => store.dispose() };
        const read = (observable) => {
            store.add(Event.fromObservableLight(observable)(onDidChangeCodeLens));
            return observable.get();
        };
        const collection = read(this._mcpRegistry.collections).find(c => isEqual(c.presentation?.origin, model.uri));
        if (!collection) {
            return lenses;
        }
        const mcpServers = read(this._mcpService.servers).filter(s => s.collection.id === collection.id);
        for (const node of serversNode.children || []) {
            if (node.type !== 'property' || node.children?.[0]?.type !== 'string') {
                continue;
            }
            const name = node.children[0].value;
            const server = mcpServers.find(s => s.definition.label === name);
            if (!server) {
                continue;
            }
            const range = Range.fromPositions(model.getPositionAt(node.children[0].offset));
            const canDebug = !!server.readDefinitions().get().server?.devMode?.debug;
            const state = read(server.connectionState).state;
            switch (state) {
                case 3 /* McpConnectionState.Kind.Error */:
                    lenses.lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
                            title: '$(error) ' + localize('server.error', 'Error'),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                            title: localize('mcp.restart', "Restart"),
                            arguments: [server.definition.id],
                        },
                    });
                    if (canDebug) {
                        lenses.lenses.push({
                            range,
                            command: {
                                id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                                title: localize('mcp.debug', "Debug"),
                                arguments: [server.definition.id, { debug: true }],
                            },
                        });
                    }
                    break;
                case 1 /* McpConnectionState.Kind.Starting */:
                    lenses.lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
                            title: '$(loading~spin) ' + localize('server.starting', 'Starting'),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.stopServer" /* McpCommandIds.StopServer */,
                            title: localize('cancel', "Cancel"),
                            arguments: [server.definition.id],
                        },
                    });
                    break;
                case 2 /* McpConnectionState.Kind.Running */:
                    lenses.lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
                            title: '$(check) ' + localize('server.running', 'Running'),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.stopServer" /* McpCommandIds.StopServer */,
                            title: localize('mcp.stop', "Stop"),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                            title: localize('mcp.restart', "Restart"),
                            arguments: [server.definition.id],
                        },
                    });
                    if (canDebug) {
                        lenses.lenses.push({
                            range,
                            command: {
                                id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                                title: localize('mcp.debug', "Debug"),
                                arguments: [server.definition.id, { debug: true }],
                            },
                        });
                    }
                    break;
                case 0 /* McpConnectionState.Kind.Stopped */:
                    lenses.lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.startServer" /* McpCommandIds.StartServer */,
                            title: '$(debug-start) ' + localize('mcp.start', "Start"),
                            arguments: [server.definition.id],
                        },
                    });
                    if (canDebug) {
                        lenses.lenses.push({
                            range,
                            command: {
                                id: "workbench.mcp.startServer" /* McpCommandIds.StartServer */,
                                title: localize('mcp.debug', "Debug"),
                                arguments: [server.definition.id, { debug: true }],
                            },
                        });
                    }
            }
            if (state !== 3 /* McpConnectionState.Kind.Error */) {
                const toolCount = read(server.tools).length;
                if (toolCount) {
                    lenses.lenses.push({
                        range,
                        command: {
                            id: '',
                            title: localize('server.toolCount', '{0} tools', toolCount),
                        }
                    });
                }
                const promptCount = read(server.prompts).length;
                if (promptCount) {
                    lenses.lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.startPromptForServer" /* McpCommandIds.StartPromptForServer */,
                            title: localize('server.promptcount', '{0} prompts', promptCount),
                            arguments: [server],
                        }
                    });
                }
                lenses.lenses.push({
                    range,
                    command: {
                        id: "workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */,
                        title: localize('mcp.server.more', 'More...'),
                        arguments: [server.definition.id],
                    }
                });
            }
        }
        return lenses;
    }
    async _provideInlayHints(model, range) {
        const parsed = this._parseModel(model);
        if (!parsed) {
            return undefined;
        }
        const { tree, inConfig } = parsed;
        const mcpSection = inConfig.section ? findNodeAtLocation(tree, [...inConfig.section]) : tree;
        if (!mcpSection) {
            return undefined;
        }
        const inputsNode = findNodeAtLocation(mcpSection, ['inputs']);
        if (!inputsNode) {
            return undefined;
        }
        const inputs = await this._mcpRegistry.getSavedInputs(inConfig.scope);
        const hints = [];
        const serversNode = findNodeAtLocation(mcpSection, ['servers']);
        if (serversNode) {
            annotateServers(serversNode);
        }
        annotateInputs(inputsNode);
        return { hints, dispose: () => { } };
        function annotateServers(servers) {
            forEachPropertyWithReplacement(servers, node => {
                const expr = ConfigurationResolverExpression.parse(node.value);
                for (const { id } of expr.unresolved()) {
                    const saved = inputs[id];
                    if (saved) {
                        pushAnnotation(id, node.offset + node.value.indexOf(id) + id.length, saved);
                    }
                }
            });
        }
        function annotateInputs(node) {
            if (node.type !== 'array' || !node.children) {
                return;
            }
            for (const input of node.children) {
                if (input.type !== 'object' || !input.children) {
                    continue;
                }
                const idProp = input.children.find(c => c.type === 'property' && c.children?.[0].value === 'id');
                if (!idProp) {
                    continue;
                }
                const id = idProp.children[1];
                if (!id || id.type !== 'string' || !id.value) {
                    continue;
                }
                const savedId = '${input:' + id.value + '}';
                const saved = inputs[savedId];
                if (saved) {
                    pushAnnotation(savedId, id.offset + 1 + id.length, saved);
                }
            }
        }
        function pushAnnotation(savedId, offset, saved) {
            const tooltip = new MarkdownString([
                markdownCommandLink({ id: "workbench.mcp.editStoredInput" /* McpCommandIds.EditStoredInput */, title: localize('edit', 'Edit'), arguments: [savedId, model.uri, mcpConfigurationSection, inConfig.target] }),
                markdownCommandLink({ id: "workbench.mcp.removeStoredInput" /* McpCommandIds.RemoveStoredInput */, title: localize('clear', 'Clear'), arguments: [inConfig.scope, savedId] }),
                markdownCommandLink({ id: "workbench.mcp.removeStoredInput" /* McpCommandIds.RemoveStoredInput */, title: localize('clearAll', 'Clear All'), arguments: [inConfig.scope] }),
            ].join(' | '), { isTrusted: true });
            const hint = {
                label: '= ' + (saved.input?.type === 'promptString' && saved.input.password ? '*'.repeat(10) : (saved.value || '')),
                position: model.getPositionAt(offset),
                tooltip,
                paddingLeft: true,
            };
            hints.push(hint);
            return hint;
        }
    }
};
McpLanguageFeatures = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, IMcpRegistry),
    __param(2, IMcpConfigPathsService),
    __param(3, IMcpService),
    __param(4, IMarkerService),
    __param(5, IConfigurationResolverService)
], McpLanguageFeatures);
export { McpLanguageFeatures };
function forEachPropertyWithReplacement(node, callback) {
    if (node.type === 'string' && typeof node.value === 'string' && node.value.includes(ConfigurationResolverExpression.VARIABLE_LHS)) {
        callback(node);
    }
    else if (node.type === 'property') {
        // skip the property name
        node.children?.slice(1).forEach(n => forEachPropertyWithReplacement(n, callback));
    }
    else {
        node.children?.forEach(n => forEachPropertyWithReplacement(n, callback));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTGFuZ3VhZ2VGZWF0dXJlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwTGFuZ3VhZ2VGZWF0dXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM3RixPQUFPLEVBQUUsa0JBQWtCLEVBQVEsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFNUgsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUdoRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNsRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFlLGNBQWMsRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUU3RyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUN4SCxPQUFPLEVBQUUsK0JBQStCLEVBQWtCLE1BQU0sbUZBQW1GLENBQUM7QUFFcEosT0FBTyxFQUFrQixzQkFBc0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzVGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLCtCQUErQixDQUFD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