/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { mcpSchemaId } from '../../../services/configuration/common/configuration.js';
import { inputsSchema } from '../../../services/configurationResolver/common/configurationResolverSchema.js';
const mcpActivationEventPrefix = 'onMcpCollection:';
/**
 * note: `contributedCollectionId` is _not_ the collection ID. The collection
 * ID is formed by passing the contributed ID through `extensionPrefixedIdentifier`
 */
export const mcpActivationEvent = (contributedCollectionId) => mcpActivationEventPrefix + contributedCollectionId;
export var DiscoverySource;
(function (DiscoverySource) {
    DiscoverySource["ClaudeDesktop"] = "claude-desktop";
    DiscoverySource["Windsurf"] = "windsurf";
    DiscoverySource["CursorGlobal"] = "cursor-global";
    DiscoverySource["CursorWorkspace"] = "cursor-workspace";
})(DiscoverySource || (DiscoverySource = {}));
export const allDiscoverySources = Object.keys({
    ["claude-desktop" /* DiscoverySource.ClaudeDesktop */]: true,
    ["windsurf" /* DiscoverySource.Windsurf */]: true,
    ["cursor-global" /* DiscoverySource.CursorGlobal */]: true,
    ["cursor-workspace" /* DiscoverySource.CursorWorkspace */]: true,
});
export const discoverySourceLabel = {
    ["claude-desktop" /* DiscoverySource.ClaudeDesktop */]: localize('mcp.discovery.source.claude-desktop', "Claude Desktop"),
    ["windsurf" /* DiscoverySource.Windsurf */]: localize('mcp.discovery.source.windsurf', "Windsurf"),
    ["cursor-global" /* DiscoverySource.CursorGlobal */]: localize('mcp.discovery.source.cursor-global', "Cursor (Global)"),
    ["cursor-workspace" /* DiscoverySource.CursorWorkspace */]: localize('mcp.discovery.source.cursor-workspace', "Cursor (Workspace)"),
};
export const mcpConfigurationSection = 'mcp';
export const mcpDiscoverySection = 'chat.mcp.discovery.enabled';
export const mcpEnabledSection = 'chat.mcp.enabled';
export const mcpServerSamplingSection = 'chat.mcp.serverSampling';
export const mcpSchemaExampleServers = {
    'mcp-server-time': {
        command: 'python',
        args: ['-m', 'mcp_server_time', '--local-timezone=America/Los_Angeles'],
        env: {},
    }
};
const httpSchemaExamples = {
    'my-mcp-server': {
        url: 'http://localhost:3001/mcp',
        headers: {},
    }
};
const mcpDevModeProps = (stdio) => ({
    dev: {
        type: 'object',
        markdownDescription: localize('app.mcp.dev', 'Enabled development mode for the server. When present, the server will be started eagerly and output will be included in its output. Properties inside the `dev` object can configure additional behavior.'),
        examples: [{ watch: 'src/**/*.ts', debug: { type: 'node' } }],
        properties: {
            watch: {
                description: localize('app.mcp.dev.watch', 'A glob pattern or list of glob patterns relative to the workspace folder to watch. The MCP server will be restarted when these files change.'),
                examples: ['src/**/*.ts'],
                oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
            ...(stdio && {
                debug: {
                    markdownDescription: localize('app.mcp.dev.debug', 'If set, debugs the MCP server using the given runtime as it\'s started.'),
                    oneOf: [
                        {
                            type: 'object',
                            required: ['type'],
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['node'],
                                    description: localize('app.mcp.dev.debug.type.node', "Debug the MCP server using Node.js.")
                                }
                            },
                            additionalProperties: false
                        },
                        {
                            type: 'object',
                            required: ['type'],
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['debugpy'],
                                    description: localize('app.mcp.dev.debug.type.python', "Debug the MCP server using Python and debugpy.")
                                },
                                debugpyPath: {
                                    type: 'string',
                                    description: localize('app.mcp.dev.debug.debugpyPath', "Path to the debugpy executable.")
                                },
                            },
                            additionalProperties: false
                        }
                    ]
                }
            })
        }
    }
});
export const mcpStdioServerSchema = {
    type: 'object',
    additionalProperties: false,
    examples: [mcpSchemaExampleServers['mcp-server-time']],
    properties: {
        type: {
            type: 'string',
            enum: ['stdio'],
            description: localize('app.mcp.json.type', "The type of the server.")
        },
        command: {
            type: 'string',
            description: localize('app.mcp.json.command', "The command to run the server.")
        },
        cwd: {
            type: 'string',
            description: localize('app.mcp.json.cwd', "The working directory for the server command. Defaults to the workspace folder when run in a workspace."),
            examples: ['${workspaceFolder}'],
        },
        args: {
            type: 'array',
            description: localize('app.mcp.args.command', "Arguments passed to the server."),
            items: {
                type: 'string'
            },
        },
        envFile: {
            type: 'string',
            description: localize('app.mcp.envFile.command', "Path to a file containing environment variables for the server."),
            examples: ['${workspaceFolder}/.env'],
        },
        env: {
            description: localize('app.mcp.env.command', "Environment variables passed to the server."),
            additionalProperties: {
                anyOf: [
                    { type: 'null' },
                    { type: 'string' },
                    { type: 'number' },
                ]
            }
        },
        ...mcpDevModeProps(true),
    }
};
export const mcpServerSchema = {
    id: mcpSchemaId,
    type: 'object',
    title: localize('app.mcp.json.title', "Model Context Protocol Servers"),
    allowTrailingCommas: true,
    allowComments: true,
    additionalProperties: false,
    properties: {
        servers: {
            examples: [
                mcpSchemaExampleServers,
                httpSchemaExamples,
            ],
            additionalProperties: {
                oneOf: [
                    mcpStdioServerSchema, {
                        type: 'object',
                        additionalProperties: false,
                        required: ['url'],
                        examples: [httpSchemaExamples['my-mcp-server']],
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['http', 'sse'],
                                description: localize('app.mcp.json.type', "The type of the server.")
                            },
                            url: {
                                type: 'string',
                                format: 'uri',
                                pattern: '^https?:\\/\\/.+',
                                patternErrorMessage: localize('app.mcp.json.url.pattern', "The URL must start with 'http://' or 'https://'."),
                                description: localize('app.mcp.json.url', "The URL of the Streamable HTTP or SSE endpoint.")
                            },
                            headers: {
                                type: 'object',
                                description: localize('app.mcp.json.headers', "Additional headers sent to the server."),
                                additionalProperties: { type: 'string' },
                            },
                            ...mcpDevModeProps(false),
                        }
                    },
                ]
            }
        },
        inputs: inputsSchema.definitions.inputs
    }
};
export const mcpContributionPoint = {
    extensionPoint: 'mcpServerDefinitionProviders',
    activationEventsGenerator(contribs, result) {
        for (const contrib of contribs) {
            if (contrib.id) {
                result.push(mcpActivationEvent(contrib.id));
            }
        }
    },
    jsonSchema: {
        description: localize('vscode.extension.contributes.mcp', 'Contributes Model Context Protocol servers. Users of this should also use `vscode.lm.registerMcpConfigurationProvider`.'),
        type: 'array',
        defaultSnippets: [{ body: [{ id: '', label: '' }] }],
        items: {
            additionalProperties: false,
            type: 'object',
            defaultSnippets: [{ body: { id: '', label: '' } }],
            properties: {
                id: {
                    description: localize('vscode.extension.contributes.mcp.id', "Unique ID for the collection."),
                    type: 'string'
                },
                label: {
                    description: localize('vscode.extension.contributes.mcp.label', "Display name for the collection."),
                    type: 'string'
                }
            }
        }
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwQ29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BDb25maWd1cmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUU5QyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDdEYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBSzdHLE1BQU0sd0JBQXdCLEdBQUcsa0JBQWtCLENBQUM7QUFFcEQ7OztHQUdHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyx1QkFBK0IsRUFBRSxFQUFFLENBQ3JFLHdCQUF3QixHQUFHLHVCQUF1QixDQUFDO0FBRXBELE1BQU0sQ0FBTixJQUFrQixlQUtqQjtBQUxELFdBQWtCLGVBQWU7SUFDaEMsbURBQWdDLENBQUE7SUFDaEMsd0NBQXFCLENBQUE7SUFDckIsaURBQThCLENBQUE7SUFDOUIsdURBQW9DLENBQUE7QUFDckMsQ0FBQyxFQUxpQixlQUFlLEtBQWYsZUFBZSxRQUtoQztBQUVELE1BQU0sQ0FBQyxNQUFNLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDOUMsc0RBQStCLEVBQUUsSUFBSTtJQUNyQywyQ0FBMEIsRUFBRSxJQUFJO0lBQ2hDLG9EQUE4QixFQUFFLElBQUk7SUFDcEMsMERBQWlDLEVBQUUsSUFBSTtDQUNDLENBQXNCLENBQUM7QUFFaEUsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQW9DO0lBQ3BFLHNEQUErQixFQUFFLFFBQVEsQ0FBQyxxQ0FBcUMsRUFBRSxnQkFBZ0IsQ0FBQztJQUNsRywyQ0FBMEIsRUFBRSxRQUFRLENBQUMsK0JBQStCLEVBQUUsVUFBVSxD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