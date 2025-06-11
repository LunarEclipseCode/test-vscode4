/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize, localize2 } from '../../../../nls.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import * as jsonContributionRegistry from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { Extensions as ViewExtensions } from '../../../common/views.js';
import { mcpSchemaId } from '../../../services/configuration/common/configuration.js';
import { VIEW_CONTAINER } from '../../extensions/browser/extensions.contribution.js';
import { DefaultViewsContext, SearchMcpServersContext } from '../../extensions/common/extensions.js';
import { ConfigMcpDiscovery } from '../common/discovery/configMcpDiscovery.js';
import { ExtensionMcpDiscovery } from '../common/discovery/extensionMcpDiscovery.js';
import { mcpDiscoveryRegistry } from '../common/discovery/mcpDiscovery.js';
import { RemoteNativeMpcDiscovery } from '../common/discovery/nativeMcpRemoteDiscovery.js';
import { CursorWorkspaceMcpDiscoveryAdapter } from '../common/discovery/workspaceMcpDiscoveryAdapter.js';
import { IMcpConfigPathsService, McpConfigPathsService } from '../common/mcpConfigPathsService.js';
import { mcpServerSchema } from '../common/mcpConfiguration.js';
import { McpContextKeysController } from '../common/mcpContextKeys.js';
import { IMcpDevModeDebugging, McpDevModeDebugging } from '../common/mcpDevMode.js';
import { McpRegistry } from '../common/mcpRegistry.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { McpResourceFilesystem } from '../common/mcpResourceFilesystem.js';
import { McpSamplingService } from '../common/mcpSamplingService.js';
import { McpService } from '../common/mcpService.js';
import { HasInstalledMcpServersContext, IMcpSamplingService, IMcpService, IMcpWorkbenchService, InstalledMcpServersViewId, McpServersGalleryEnabledContext } from '../common/mcpTypes.js';
import { McpAddContextContribution } from './mcpAddContextContribution.js';
import { AddConfigurationAction, EditStoredInput, InstallFromActivation, ListMcpServerCommand, McpBrowseCommand, McpBrowseResourcesCommand, McpConfigureSamplingModels, MCPServerActionRendering, McpServerOptionsCommand, McpStartPromptingServerCommand, RemoveStoredInput, ResetMcpCachedTools, ResetMcpTrustCommand, RestartServer, ShowConfiguration, ShowOutput, StartServer, StopServer } from './mcpCommands.js';
import { McpDiscovery } from './mcpDiscovery.js';
import { McpLanguageFeatures } from './mcpLanguageFeatures.js';
import { McpResourceQuickAccess } from './mcpResourceQuickAccess.js';
import { McpServerEditor } from './mcpServerEditor.js';
import { McpServerEditorInput } from './mcpServerEditorInput.js';
import { McpServersListView } from './mcpServersView.js';
import { McpUrlHandler } from './mcpUrlHandler.js';
import { MCPContextsInitialisation, McpWorkbenchService } from './mcpWorkbenchService.js';
registerSingleton(IMcpRegistry, McpRegistry, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpService, McpService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpWorkbenchService, McpWorkbenchService, 0 /* InstantiationType.Eager */);
registerSingleton(IMcpConfigPathsService, McpConfigPathsService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpDevModeDebugging, McpDevModeDebugging, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpSamplingService, McpSamplingService, 1 /* InstantiationType.Delayed */);
mcpDiscoveryRegistry.register(new SyncDescriptor(RemoteNativeMpcDiscovery));
mcpDiscoveryRegistry.register(new SyncDescriptor(ConfigMcpDiscovery));
mcpDiscoveryRegistry.register(new SyncDescriptor(ExtensionMcpDiscovery));
mcpDiscoveryRegistry.register(new SyncDescriptor(CursorWorkspaceMcpDiscoveryAdapter));
registerWorkbenchContribution2('mcpDiscovery', McpDiscovery, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2('mcpContextKeys', McpContextKeysController, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2('mcpLanguageFeatures', McpLanguageFeatures, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2('mcpUrlHandler', McpUrlHandler, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2('mcpResourceFilesystem', McpResourceFilesystem, 2 /* WorkbenchPhase.BlockRestore */);
registerAction2(ListMcpServerCommand);
registerAction2(McpServerOptionsCommand);
registerAction2(ResetMcpTrustCommand);
registerAction2(ResetMcpCachedTools);
registerAction2(AddConfigurationAction);
registerAction2(RemoveStoredInput);
registerAction2(EditStoredInput);
registerAction2(StartServer);
registerAction2(StopServer);
registerAction2(ShowOutput);
registerAction2(InstallFromActivation);
registerAction2(RestartServer);
registerAction2(ShowConfiguration);
registerAction2(McpBrowseCommand);
registerAction2(McpBrowseResourcesCommand);
registerAction2(McpConfigureSamplingModels);
registerAction2(McpStartPromptingServerCommand);
registerWorkbenchContribution2('mcpActionRendering', MCPServerActionRendering, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2('mcpAddContext', McpAddContextContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(MCPContextsInitialisation.ID, MCPContextsInitialisation, 3 /* WorkbenchPhase.AfterRestored */);
const jsonRegistry = Registry.as(jsonContributionRegistry.Extensions.JSONContribution);
jsonRegistry.registerSchema(mcpSchemaId, mcpServerSchema);
Registry.as(ViewExtensions.ViewsRegistry).registerViews([
    {
        id: InstalledMcpServersViewId,
        name: localize2('mcp-installed', "MCP Servers - Installed"),
        ctorDescriptor: new SyncDescriptor(McpServersListView),
        when: ContextKeyExpr.and(DefaultViewsContext, HasInstalledMcpServersContext, McpServersGalleryEnabledContext),
        weight: 40,
        order: 4,
        canToggleVisibility: true
    },
    {
        id: 'workbench.views.mcp.marketplace',
        name: localize2('mcp', "MCP Servers"),
        ctorDescriptor: new SyncDescriptor(McpServersListView),
        when: ContextKeyExpr.and(SearchMcpServersContext, McpServersGalleryEnabledContext),
    }
], VIEW_CONTAINER);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(McpServerEditor, McpServerEditor.ID, localize('mcpServer', "MCP Server")), [
    new SyncDescriptor(McpServerEditorInput)
]);
Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
    ctor: McpResourceQuickAccess,
    prefix: McpResourceQuickAccess.PREFIX,
    placeholder: localize('mcp.quickaccess.placeholder', "Filter to an MCP resource"),
    helpEntries: [{
            description: localize('mcp.quickaccess.add', "MCP Server Resources"),
            commandId: "workbench.mcp.addConfiguration" /* McpCommandIds.AddConfiguration */
        }]
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEtBQUssd0JBQXdCLE1BQU0scUVBQXFFLENBQUM7QUFDaEgsT0FBTyxFQUF3QixVQUFVLElBQUkscUJBQXFCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsSSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLG9CQUFvQixFQUF1QixNQUFNLDRCQUE0QixDQUFDO0FBQ3ZGLE9BQU8sRUFBRSw4QkFBOEIsRUFBa0IsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWtCLFVBQVUsSUFBSSxjQUFjLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN4RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDdEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JH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