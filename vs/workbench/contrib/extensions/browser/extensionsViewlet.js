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
import './media/extensionsViewlet.css';
import { localize, localize2 } from '../../../../nls.js';
import { timeout, Delayer } from '../../../../base/common/async.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { createErrorWithActions } from '../../../../base/common/errorMessage.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { Action } from '../../../../base/common/actions.js';
import { append, $, Dimension, hide, show, DragAndDropObserver, trackFocus, addDisposableListener, EventType, clearNode } from '../../../../base/browser/dom.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService, VIEWLET_ID, CloseExtensionDetailsOnViewChangeKey, INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, WORKSPACE_RECOMMENDATIONS_VIEW_ID, AutoCheckUpdatesConfigurationKey, OUTDATED_EXTENSIONS_VIEW_ID, CONTEXT_HAS_GALLERY, extensionsSearchActionsMenu, AutoRestartConfigurationKey, SearchMcpServersContext, DefaultViewsContext } from '../common/extensions.js';
import { InstallLocalExtensionsInRemoteAction, InstallRemoteExtensionsInLocalAction } from './extensionsActions.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IWorkbenchExtensionEnablementService, IExtensionManagementServerService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { ExtensionsInput } from '../common/extensionsInput.js';
import { ExtensionsListView, EnabledExtensionsView, DisabledExtensionsView, RecommendedExtensionsView, WorkspaceRecommendedExtensionsView, ServerInstalledExtensionsView, DefaultRecommendedExtensionsView, UntrustedWorkspaceUnsupportedExtensionsView, UntrustedWorkspacePartiallySupportedExtensionsView, VirtualWorkspaceUnsupportedExtensionsView, VirtualWorkspacePartiallySupportedExtensionsView, DefaultPopularExtensionsView, DeprecatedExtensionsView, SearchMarketplaceExtensionsView, RecentlyUpdatedExtensionsView, OutdatedExtensionsView, StaticQueryExtensionsView, NONE_CATEGORY } from './extensionsViews.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import Severity from '../../../../base/common/severity.js';
import { IActivityService, NumberBadge, WarningBadge } from '../../../services/activity/common/activity.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions, IViewDescriptorService } from '../../../common/views.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IContextKeyService, ContextKeyExpr, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, NotificationPriority } from '../../../../platform/notification/common/notification.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Query } from '../common/extensionQuery.js';
import { SuggestEnabledInput } from '../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { EXTENSION_CATEGORIES } from '../../../../platform/extensions/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { SIDE_BAR_DRAG_AND_DROP_BACKGROUND } from '../../../common/theme.js';
import { VirtualWorkspaceContext, WorkbenchStateContext } from '../../../common/contextkeys.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { installLocalInRemoteIcon } from './extensionsIcons.js';
import { registerAction2, Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { extractEditorsAndFilesDropData } from '../../../../platform/dnd/browser/dnd.js';
import { extname } from '../../../../base/common/resources.js';
import { registerNavigableContainer } from '../../../browser/actions/widgetNavigationCommands.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { createActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { SeverityIcon } from '../../../../base/browser/ui/severityIcon/severityIcon.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { URI } from '../../../../base/common/uri.js';
import { IMcpGalleryService } from '../../../../platform/mcp/common/mcpManagement.js';
export const ExtensionsSortByContext = new RawContextKey('extensionsSortByValue', '');
export const SearchMarketplaceExtensionsContext = new RawContextKey('searchMarketplaceExtensions', false);
export const SearchHasTextContext = new RawContextKey('extensionSearchHasText', false);
const InstalledExtensionsContext = new RawContextKey('installedExtensions', false);
const SearchInstalledExtensionsContext = new RawContextKey('searchInstalledExtensions', false);
const SearchRecentlyUpdatedExtensionsContext = new RawContextKey('searchRecentlyUpdatedExtensions', false);
const SearchExtensionUpdatesContext = new RawContextKey('searchExtensionUpdates', false);
const SearchOutdatedExtensionsContext = new RawContextKey('searchOutdatedExtensions', false);
const SearchEnabledExtensionsContext = new RawContextKey('searchEnabledExtensions', false);
const SearchDisabledExtensionsContext = new RawContextKey('searchDisabledExtensions', false);
const HasInstalledExtensionsContext = new RawContextKey('hasInstalledExtensions', true);
export const BuiltInExtensionsContext = new RawContextKey('builtInExtensions', false);
const SearchBuiltInExtensionsContext = new RawContextKey('searchBuiltInExtensions', false);
const SearchUnsupportedWorkspaceExtensionsContext = new RawContextKey('searchUnsupportedWorkspaceExtensions', false);
const SearchDeprecatedExtensionsContext = new RawContextKey('searchDeprecatedExtensions', false);
export const RecommendedExtensionsContext = new RawContextKey('recommendedExtensions', false);
const SortByUpdateDateContext = new RawContextKey('sortByUpdateDate', false);
export const ExtensionsSearchValueContext = new RawContextKey('extensionsSearchValue', '');
const REMOTE_CATEGORY = localize2({ key: 'remote', comment: ['Remote as in remote machine'] }, "Remote");
let ExtensionsViewletViewsContribution = class ExtensionsViewletViewsContribution extends Disposable {
    constructor(extensionManagementServerService, labelService, viewDescriptorService, contextKeyService) {
        super();
        this.extensionManagementServerService = extensionManagementServerService;
        this.labelService = labelService;
        this.contextKeyService = contextKeyService;
        this.container = viewDescriptorService.getViewContainerById(VIEWLET_ID);
        this.registerViews();
    }
    registerViews() {
        const viewDescriptors = [];
        /* Default views */
        viewDescriptors.push(...this.createDefaultExtensionsViewDescriptors());
        /* Search views */
        viewDescriptors.push(...this.createSearchExtensionsViewDescriptors());
        /* Recommendations views */
        viewDescriptors.push(...this.createRecommendedExtensionsViewDescriptors());
        /* Built-in extensions views */
        viewDescriptors.push(...this.createBuiltinExtensionsViewDescriptors());
        /* Trust Required extensions views */
        viewDescriptors.push(...this.createUnsupportedWorkspaceExtensionsViewDescriptors());
        /* Other Local Filtered extensions views */
        viewDescriptors.push(...this.createOtherLocalFilteredExtensionsViewDescriptors());
        Registry.as(Extensions.ViewsRegistry).registerViews(viewDescriptors, this.container);
    }
    createDefaultExtensionsViewDescriptors() {
        const viewDescriptors = [];
        /*
         * Default installed extensions views - Shows all user installed extensions.
         */
        const servers = [];
        if (this.extensionManagementServerService.localExtensionManagementServer) {
            servers.push(this.extensionManagementServerService.localExtensionManagementServer);
        }
        if (this.extensionManagementServerService.remoteExtensionManagementServer) {
            servers.push(this.extensionManagementServerService.remoteExtensionManagementServer);
        }
        if (this.extensionManagementServerService.webExtensionManagementServer) {
            servers.push(this.extensionManagementServerService.webExtensionManagementServer);
        }
        const getViewName = (viewTitle, server) => {
            return servers.length > 1 ? `${server.label} - ${viewTitle}` : viewTitle;
        };
        let installedWebExtensionsContextChangeEvent = Event.None;
        if (this.extensionManagementServerService.webExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
            const interestingContextKeys = new Set();
            interestingContextKeys.add('hasInstalledWebExtensions');
            installedWebExtensionsContextChangeEvent = Event.filter(this.contextKeyService.onDidChangeContext, e => e.affectsSome(interestingContextKeys));
        }
        const serverLabelChangeEvent = Event.any(this.labelService.onDidChangeFormatters, installedWebExtensionsContextChangeEvent);
        for (const server of servers) {
            const getInstalledViewName = () => getViewName(localize('installed', "Installed"), server);
            const onDidChangeTitle = Event.map(serverLabelChangeEvent, () => getInstalledViewName());
            const id = servers.length > 1 ? `workbench.views.extensions.${server.id}.installed` : `workbench.views.extensions.installed`;
            /* Installed extensions view */
            viewDescriptors.push({
                id,
                get name() {
                    return {
                        value: getInstalledViewName(),
                        original: getViewName('Installed', server)
                    };
                },
                weight: 100,
                order: 1,
                when: ContextKeyExpr.and(DefaultViewsContext),
                ctorDescriptor: new SyncDescriptor(ServerInstalledExtensionsView, [{ server, flexibleHeight: true, onDidChangeTitle }]),
                /* Installed extensions views shall not be allowed to hidden when there are more than one server */
                canToggleVisibility: servers.length === 1
            });
            if (server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManagementServerService.localExtensionManagementServer) {
                this._register(registerAction2(class InstallLocalExtensionsInRemoteAction2 extends Action2 {
                    constructor() {
                        super({
                            id: 'workbench.extensions.installLocalExtensions',
                            get title() {
                                return localize2('select and install local extensions', "Install Local Extensions in '{0}'...", server.label);
                            },
                            category: REMOTE_CATEGORY,
                            icon: installLocalInRemoteIcon,
                            f1: true,
                            menu: {
                                id: MenuId.ViewTitle,
                                when: ContextKeyExpr.equals('view', id),
                                group: 'navigation',
                            }
                        });
                    }
                    run(accessor) {
                        return accessor.get(IInstantiationService).createInstance(InstallLocalExtensionsInRemoteAction).run();
                    }
                }));
            }
        }
        if (this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
            this._register(registerAction2(class InstallRemoteExtensionsInLocalAction2 extends Action2 {
                constructor() {
                    super({
                        id: 'workbench.extensions.actions.installLocalExtensionsInRemote',
                        title: localize2('install remote in local', 'Install Remote Extensions Locally...'),
                        category: REMOTE_CATEGORY,
                        f1: true
                    });
                }
                run(accessor) {
                    return accessor.get(IInstantiationService).createInstance(InstallRemoteExtensionsInLocalAction, 'workbench.extensions.actions.installLocalExtensionsInRemote').run();
                }
            }));
        }
        /*
         * Default popular extensions view
         * Separate view for popular extensions required as we need to show popular and recommended sections
         * in the default view when there is no search text, and user has no installed extensions.
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.popular',
            name: localize2('popularExtensions', "Popular"),
            ctorDescriptor: new SyncDescriptor(DefaultPopularExtensionsView, [{ hideBadge: true }]),
            when: ContextKeyExpr.and(DefaultViewsContext, ContextKeyExpr.not('hasInstalledExtensions'), CONTEXT_HAS_GALLERY),
            weight: 60,
            order: 2,
            canToggleVisibility: false
        });
        /*
         * Default recommended extensions view
         * When user has installed extensions, this is shown along with the views for enabled & disabled extensions
         * When user has no installed extensions, this is shown along with the view for popular extensions
         */
        viewDescriptors.push({
            id: 'extensions.recommendedList',
            name: localize2('recommendedExtensions', "Recommended"),
            ctorDescriptor: new SyncDescriptor(DefaultRecommendedExtensionsView, [{ flexibleHeight: true }]),
            when: ContextKeyExpr.and(DefaultViewsContext, SortByUpdateDateContext.negate(), ContextKeyExpr.not('config.extensions.showRecommendationsOnlyOnDemand'), CONTEXT_HAS_GALLERY),
            weight: 40,
            order: 3,
            canToggleVisibility: true
        });
        /* Installed views shall be default in multi server window  */
        if (servers.length === 1) {
            /*
             * Default enabled extensions view - Shows all user installed enabled extensions.
             * Hidden by default
             */
            viewDescriptors.push({
                id: 'workbench.views.extensions.enabled',
                name: localize2('enabledExtensions', "Enabled"),
                ctorDescriptor: new SyncDescriptor(EnabledExtensionsView, [{}]),
                when: ContextKeyExpr.and(DefaultViewsContext, ContextKeyExpr.has('hasInstalledExtensions')),
                hideByDefault: true,
                weight: 40,
                order: 4,
                canToggleVisibility: true
            });
            /*
             * Default disabled extensions view - Shows all disabled extensions.
             * Hidden by default
             */
            viewDescriptors.push({
                id: 'workbench.views.extensions.disabled',
                name: localize2('disabledExtensions', "Disabled"),
                ctorDescriptor: new SyncDescriptor(DisabledExtensionsView, [{}]),
                when: ContextKeyExpr.and(DefaultViewsContext, ContextKeyExpr.has('hasInstalledExtensions')),
                hideByDefault: true,
                weight: 10,
                order: 5,
                canToggleVisibility: true
            });
        }
        return viewDescriptors;
    }
    createSearchExtensionsViewDescriptors() {
        const viewDescriptors = [];
        /*
         * View used for searching Marketplace
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.marketplace',
            name: localize2('marketPlace', "Marketplace"),
            ctorDescriptor: new SyncDescriptor(SearchMarketplaceExtensionsView, [{}]),
            when: ContextKeyExpr.and(ContextKeyExpr.has('searchMarketplaceExtensions')),
        });
        /*
         * View used for searching all installed extensions
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.searchInstalled',
            name: localize2('installed', "Installed"),
            ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
            when: ContextKeyExpr.or(ContextKeyExpr.has('searchInstalledExtensions'), ContextKeyExpr.has('installedExtensions')),
        });
        /*
         * View used for searching recently updated extensions
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.searchRecentlyUpdated',
            name: localize2('recently updated', "Recently Updated"),
            ctorDescriptor: new SyncDescriptor(RecentlyUpdatedExtensionsView, [{}]),
            when: ContextKeyExpr.or(SearchExtensionUpdatesContext, ContextKeyExpr.has('searchRecentlyUpdatedExtensions')),
            order: 2,
        });
        /*
         * View used for searching enabled extensions
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.searchEnabled',
            name: localize2('enabled', "Enabled"),
            ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
            when: ContextKeyExpr.and(ContextKeyExpr.has('searchEnabledExtensions')),
        });
        /*
         * View used for searching disabled extensions
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.searchDisabled',
            name: localize2('disabled', "Disabled"),
            ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
            when: ContextKeyExpr.and(ContextKeyExpr.has('searchDisabledExtensions')),
        });
        /*
         * View used for searching outdated extensions
         */
        viewDescriptors.push({
            id: OUTDATED_EXTENSIONS_VIEW_ID,
            name: localize2('availableUpdates', "Available Updates"),
            ctorDescriptor: new SyncDescriptor(OutdatedExtensionsView, [{}]),
            when: ContextKeyExpr.or(SearchExtensionUpdatesContext, ContextKeyExpr.has('searchOutdatedExtensions')),
            order: 1,
        });
        /*
         * View used for searching builtin extensions
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.searchBuiltin',
            name: localize2('builtin', "Builtin"),
            ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
            when: ContextKeyExpr.and(ContextKeyExpr.has('searchBuiltInExtensions')),
        });
        /*
         * View used for searching workspace unsupported extensions
         */
        viewDescriptors.push({
            id: 'workbench.views.extensions.searchWorkspaceUnsupported',
            name: localize2('workspaceUnsupported', "Workspace Unsupported"),
            ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
            when: ContextKeyExpr.and(ContextKeyExpr.has('searchWorkspaceUnsupportedExtensions')),
        });
        return viewDescriptors;
    }
    createRecommendedExtensionsViewDescriptors() {
        const viewDescriptors = [];
        viewDescriptors.push({
            id: WORKSPACE_RECOMMENDATIONS_VIEW_ID,
            name: localize2('workspaceRecommendedExtensions', "Workspace Recommendations"),
            ctorDescriptor: new SyncDescriptor(WorkspaceRecommendedExtensionsView, [{}]),
            when: ContextKeyExpr.and(ContextKeyExpr.has('recommendedExtensions'), WorkbenchStateContext.notEqualsTo('empty')),
            order: 1
        });
        viewDescriptors.push({
            id: 'workbench.views.extensions.otherRecommendations',
            name: localize2('otherRecommendedExtensions', "Other Recommendations"),
            ctorDescriptor: new SyncDescriptor(RecommendedExtensionsView, [{}]),
            when: ContextKeyExpr.has('recommendedExtensions'),
            order: 2
        });
        return viewDescriptors;
    }
    createBuiltinExtensionsViewDescriptors() {
        const viewDescriptors = [];
        const configuredCategories = ['themes', 'programming languages'];
        const otherCategories = EXTENSION_CATEGORIES.filter(c => !configuredCategories.includes(c.toLowerCase()));
        otherCategories.push(NONE_CATEGORY);
        const otherCategoriesQuery = `${otherCategories.map(c => `category:"${c}"`).join(' ')} ${configuredCategories.map(c => `category:"-${c}"`).join(' ')}`;
        viewDescriptors.push({
            id: 'workbench.views.extensions.builtinFeatureExtensions',
            name: localize2('builtinFeatureExtensions', "Features"),
            ctorDescriptor: new SyncDescriptor(StaticQueryExtensionsView, [{ query: `@builtin ${otherCategoriesQuery}` }]),
            when: ContextKeyExpr.has('builtInExtensions'),
        });
        viewDescriptors.push({
            id: 'workbench.views.extensions.builtinThemeExtensions',
            name: localize2('builtInThemesExtensions', "Themes"),
            ctorDescriptor: new SyncDescriptor(StaticQueryExtensionsView, [{ query: `@builtin category:themes` }]),
            when: ContextKeyExpr.has('builtInExtensions'),
        });
        viewDescriptors.push({
            id: 'workbench.views.extensions.builtinProgrammingLanguageExtensions',
            name: localize2('builtinProgrammingLanguageExtensions', "Programming Languages"),
            ctorDescriptor: new SyncDescriptor(StaticQueryExtensionsView, [{ query: `@builtin category:"programming languages"` }]),
            when: ContextKeyExpr.has('builtInExtensions'),
        });
        return viewDescriptors;
    }
    createUnsupportedWorkspaceExtensionsViewDescriptors() {
        const viewDescriptors = [];
        viewDescriptors.push({
            id: 'workbench.views.extensions.untrustedUnsupportedExtensions',
            name: localize2('untrustedUnsupportedExtensions', "Disabled in Restricted Mode"),
            ctorDescriptor: new SyncDescriptor(UntrustedWorkspaceUnsupportedExtensionsView, [{}]),
            when: ContextKeyExpr.and(SearchUnsupportedWorkspaceExtensionsContext),
        });
        viewDescriptors.push({
            id: 'workbench.views.extensions.untrustedPartiallySupportedExtensions',
            name: localize2('untrustedPartiallySupportedExtensions', "Limited in Restricted Mode"),
            ctorDescriptor: new SyncDescriptor(UntrustedWorkspacePartiallySupportedExtensionsView, [{}]),
            when: ContextKeyExpr.and(SearchUnsupportedWorkspaceExtensionsContext),
        });
        viewDescriptors.push({
            id: 'workbench.views.extensions.virtualUnsupportedExtensions',
            name: localize2('virtualUnsupportedExtensions', "Disabled in Virtual Workspaces"),
            ctorDescriptor: new SyncDescriptor(VirtualWorkspaceUnsupportedExtensionsView, [{}]),
            when: ContextKeyExpr.and(VirtualWorkspaceContext, SearchUnsupportedWorkspaceExtensionsContext),
        });
        viewDescriptors.push({
            id: 'workbench.views.extensions.virtualPartiallySupportedExtensions',
            name: localize2('virtualPartiallySupportedExtensions', "Limited in Virtual Workspaces"),
            ctorDescriptor: new SyncDescriptor(VirtualWorkspacePartiallySupportedExtensionsView, [{}]),
            when: ContextKeyExpr.and(VirtualWorkspaceContext, SearchUnsupportedWorkspaceExtensionsContext),
        });
        return viewDescriptors;
    }
    createOtherLocalFilteredExtensionsViewDescriptors() {
        const viewDescriptors = [];
        viewDescriptors.push({
            id: 'workbench.views.extensions.deprecatedExtensions',
            name: localize2('deprecated', "Deprecated"),
            ctorDescriptor: new SyncDescriptor(DeprecatedExtensionsView, [{}]),
            when: ContextKeyExpr.and(SearchDeprecatedExtensionsContext),
        });
        return viewDescriptors;
    }
};
ExtensionsViewletViewsContribution = __decorate([
    __param(0, IExtensionManagementServerService),
    __param(1, ILabelService),
    __param(2, IViewDescriptorService),
    __param(3, IContextKeyService)
], ExtensionsViewletViewsContribution);
export { ExtensionsViewletViewsContribution };
let ExtensionsViewPaneContainer = class ExtensionsViewPaneContainer extends ViewPaneContainer {
    constructor(layoutService, telemetryService, progressService, instantiationService, editorGroupService, extensionGalleryManifestService, extensionsWorkbenchService, extensionManagementServerService, notificationService, paneCompositeService, themeService, configurationService, storageService, contextService, contextKeyService, contextMenuService, extensionService, viewDescriptorService, preferencesService, commandService, mcpGalleryService, logService) {
        super(VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService);
        this.progressService = progressService;
        this.editorGroupService = editorGroupService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.notificationService = notificationService;
        this.paneCompositeService = paneCompositeService;
        this.contextKeyService = contextKeyService;
        this.preferencesService = preferencesService;
        this.commandService = commandService;
        this.mcpGalleryService = mcpGalleryService;
        this.extensionGalleryManifest = null;
        this.notificationDisposables = this._register(new MutableDisposable());
        this.searchDelayer = new Delayer(500);
        this.extensionsSearchValueContextKey = ExtensionsSearchValueContext.bindTo(contextKeyService);
        this.defaultViewsContextKey = DefaultViewsContext.bindTo(contextKeyService);
        this.sortByContextKey = ExtensionsSortByContext.bindTo(contextKeyService);
        this.searchMarketplaceExtensionsContextKey = SearchMarketplaceExtensionsContext.bindTo(contextKeyService);
        this.searchMcpServersContextKey = SearchMcpServersContext.bindTo(contextKeyService);
        this.searchHasTextContextKey = SearchHasTextContext.bindTo(contextKeyService);
        this.sortByUpdateDateContextKey = SortByUpdateDateContext.bindTo(contextKeyService);
        this.installedExtensionsContextKey = InstalledExtensionsContext.bindTo(contextKeyService);
        this.searchInstalledExtensionsContextKey = SearchInstalledExtensionsContext.bindTo(contextKeyService);
        this.searchRecentlyUpdatedExtensionsContextKey = SearchRecentlyUpdatedExtensionsContext.bindTo(contextKeyService);
        this.searchExtensionUpdatesContextKey = SearchExtensionUpdatesContext.bindTo(contextKeyService);
        this.searchWorkspaceUnsupportedExtensionsContextKey = SearchUnsupportedWorkspaceExtensionsContext.bindTo(contextKeyService);
        this.searchDeprecatedExtensionsContextKey = SearchDeprecatedExtensionsContext.bindTo(contextKeyService);
        this.searchOutdatedExtensionsContextKey = SearchOutdatedExtensionsContext.bindTo(contextKeyService);
        this.searchEnabledExtensionsContextKey = SearchEnabledExtensionsContext.bindTo(contextKeyService);
        this.searchDisabledExtensionsContextKey = SearchDisabledExtensionsContext.bindTo(contextKeyService);
        this.hasInstalledExtensionsContextKey = HasInstalledExtensionsContext.bindTo(contextKeyService);
        this.builtInExtensionsContextKey = BuiltInExtensionsContext.bindTo(contextKeyService);
        this.searchBuiltInExtensionsContextKey = SearchBuiltInExtensionsContext.bindTo(contextKeyService);
        this.recommendedExtensionsContextKey = RecommendedExtensionsContext.bindTo(contextKeyService);
        this._register(this.paneCompositeService.onDidPaneCompositeOpen(e => { if (e.viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */) {
            this.onViewletOpen(e.composite);
        } }, this));
        this._register(extensionsWorkbenchService.onReset(() => this.refresh()));
        this.searchViewletState = this.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        extensionGalleryManifestService.getExtensionGalleryManifest()
            .then(galleryManifest => {
            this.extensionGalleryManifest = galleryManifest;
            this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest(galleryManifest => {
                this.extensionGalleryManifest = galleryManifest;
                this.refresh();
            }));
        });
    }
    get searchValue() {
        return this.searchBox?.getValue();
    }
    create(parent) {
        parent.classList.add('extensions-viewlet');
        this.root = parent;
        const overlay = append(this.root, $('.overlay'));
        const overlayBackgroundColor = this.getColor(SIDE_BAR_DRAG_AND_DROP_BACKGROUND) ?? '';
        overlay.style.backgroundColor = overlayBackgroundColor;
        hide(overlay);
        this.header = append(this.root, $('.header'));
        const placeholder = localize('searchExtensions', "Search Extensions in Marketplace");
        const searchValue = this.searchViewletState['query.value'] ? this.searchViewletState['query.value'] : '';
        const searchContainer = append(this.header, $('.extensions-search-container'));
        this.searchBox = this._register(this.instantiationService.createInstance(SuggestEnabledInput, `${VIEWLET_ID}.searchbox`, searchContainer, {
            triggerCharacters: ['@'],
            sortKey: (item) => {
                if (item.indexOf(':') === -1) {
                    return 'a';
                }
                else if (/ext:/.test(item) || /id:/.test(item) || /tag:/.test(item)) {
                    return 'b';
                }
                else if (/sort:/.test(item)) {
                    return 'c';
                }
                else {
                    return 'd';
                }
            },
            provideResults: (query) => Query.suggestions(query, this.extensionGalleryManifest)
        }, placeholder, 'extensions:searchinput', { placeholderText: placeholder, value: searchValue }));
        this.notificationContainer = append(this.header, $('.notification-container.hidden', { 'tabindex': '0' }));
        this.renderNotificaiton();
        this._register(this.extensionsWorkbenchService.onDidChangeExtensionsNotification(() => this.renderNotificaiton()));
        this.updateInstalledExtensionsContexts();
        if (this.searchBox.getValue()) {
            this.triggerSearch();
        }
        this._register(this.searchBox.onInputDidChange(() => {
            this.sortByContextKey.set(Query.parse(this.searchBox?.getValue() ?? '').sortBy);
            this.triggerSearch();
        }, this));
        this._register(this.searchBox.onShouldFocusResults(() => this.focusListView(), this));
        const controlElement = append(searchContainer, $('.extensions-search-actions-container'));
        this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, controlElement, extensionsSearchActionsMenu, {
            toolbarOptions: {
                primaryGroup: () => true,
            },
            actionViewItemProvider: (action, options) => createActionViewItem(this.instantiationService, action, options)
        }));
        // Register DragAndDrop support
        this._register(new DragAndDropObserver(this.root, {
            onDragEnter: (e) => {
                if (this.isSupportedDragElement(e)) {
                    show(overlay);
                }
            },
            onDragLeave: (e) => {
                if (this.isSupportedDragElement(e)) {
                    hide(overlay);
                }
            },
            onDragOver: (e) => {
                if (this.isSupportedDragElement(e)) {
                    e.dataTransfer.dropEffect = 'copy';
                }
            },
            onDrop: async (e) => {
                if (this.isSupportedDragElement(e)) {
                    hide(overlay);
                    const vsixs = coalesce((await this.instantiationService.invokeFunction(accessor => extractEditorsAndFilesDropData(accessor, e)))
                        .map(editor => editor.resource && extname(editor.resource) === '.vsix' ? editor.resource : undefined));
                    if (vsixs.length > 0) {
                        try {
                            // Attempt to install the extension(s)
                            await this.commandService.executeCommand(INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, vsixs);
                        }
                        catch (err) {
                            this.notificationService.error(err);
                        }
                    }
                }
            }
        }));
        super.create(append(this.root, $('.extensions')));
        const focusTracker = this._register(trackFocus(this.root));
        const isSearchBoxFocused = () => this.searchBox?.inputWidget.hasWidgetFocus();
        this._register(registerNavigableContainer({
            name: 'extensionsView',
            focusNotifiers: [focusTracker],
            focusNextWidget: () => {
                if (isSearchBoxFocused()) {
                    this.focusListView();
                }
            },
            focusPreviousWidget: () => {
                if (!isSearchBoxFocused()) {
                    this.searchBox?.focus();
                }
            }
        }));
    }
    focus() {
        super.focus();
        this.searchBox?.focus();
    }
    layout(dimension) {
        this._dimension = dimension;
        if (this.root) {
            this.root.classList.toggle('narrow', dimension.width <= 250);
            this.root.classList.toggle('mini', dimension.width <= 200);
        }
        this.searchBox?.layout(new Dimension(dimension.width - 34 - /*padding*/ 8 - (24 * 2), 20));
        const searchBoxHeight = 20 + 21 /*margin*/;
        const headerHeight = this.header && !!this.notificationContainer?.childNodes.length ? this.notificationContainer.clientHeight + searchBoxHeight + 10 /*margin*/ : searchBoxHeight;
        this.header.style.height = `${headerHeight}px`;
        super.layout(new Dimension(dimension.width, dimension.height - headerHeight));
    }
    getOptimalWidth() {
        return 400;
    }
    search(value) {
        if (this.searchBox && this.searchBox.getValue() !== value) {
            this.searchBox.setValue(value);
        }
    }
    async refresh() {
        await this.updateInstalledExtensionsContexts();
        this.doSearch(true);
        if (this.configurationService.getValue(AutoCheckUpdatesConfigurationKey)) {
            this.extensionsWorkbenchService.checkForUpdates();
        }
    }
    renderNotificaiton() {
        if (!this.notificationContainer) {
            return;
        }
        clearNode(this.notificationContainer);
        this.notificationDisposables.value = new DisposableStore();
        const status = this.extensionsWorkbenchService.getExtensionsNotification();
        const query = status?.extensions.map(extension => `@id:${extension.identifier.id}`).join(' ');
        if (status && (query === this.searchBox?.getValue() || !this.searchMarketplaceExtensionsContextKey.get())) {
            this.notificationContainer.setAttribute('aria-label', status.message);
            this.notificationContainer.classList.remove('hidden');
            const messageContainer = append(this.notificationContainer, $('.message-container'));
            append(messageContainer, $('span')).className = SeverityIcon.className(status.severity);
            append(messageContainer, $('span.message', undefined, status.message));
            const showAction = append(messageContainer, $('span.message-text-action', {
                'tabindex': '0',
                'role': 'button',
                'aria-label': `${status.message}. ${localize('click show', "Click to Show")}`
            }, localize('show', "Show")));
            this.notificationDisposables.value.add(addDisposableListener(showAction, EventType.CLICK, () => this.search(query ?? '')));
            this.notificationDisposables.value.add(addDisposableListener(showAction, EventType.KEY_DOWN, (e) => {
                const standardKeyboardEvent = new StandardKeyboardEvent(e);
                if (standardKeyboardEvent.keyCode === 3 /* KeyCode.Enter */ || standardKeyboardEvent.keyCode === 10 /* KeyCode.Space */) {
                    this.search(query ?? '');
                }
                standardKeyboardEvent.stopPropagation();
            }));
            const dismissAction = append(this.notificationContainer, $(`span.message-action${ThemeIcon.asCSSSelector(Codicon.close)}`, {
                'tabindex': '0',
                'role': 'button',
                'aria-label': localize('dismiss', "Dismiss"),
                'title': localize('dismiss', "Dismiss")
            }));
            this.notificationDisposables.value.add(addDisposableListener(dismissAction, EventType.CLICK, () => status.dismiss()));
            this.notificationDisposables.value.add(addDisposableListener(dismissAction, EventType.KEY_DOWN, (e) => {
                const standardKeyboardEvent = new StandardKeyboardEvent(e);
                if (standardKeyboardEvent.keyCode === 3 /* KeyCode.Enter */ || standardKeyboardEvent.keyCode === 10 /* KeyCode.Space */) {
                    status.dismiss();
                }
                standardKeyboardEvent.stopPropagation();
            }));
        }
        else {
            this.notificationContainer.removeAttribute('aria-label');
            this.notificationContainer.classList.add('hidden');
        }
        if (this._dimension) {
            this.layout(this._dimension);
        }
    }
    async updateInstalledExtensionsContexts() {
        const result = await this.extensionsWorkbenchService.queryLocal();
        this.hasInstalledExtensionsContextKey.set(result.some(r => !r.isBuiltin));
    }
    triggerSearch() {
        this.searchDelayer.trigger(() => this.doSearch(), this.searchBox && this.searchBox.getValue() ? 500 : 0).then(undefined, err => this.onError(err));
    }
    normalizedQuery() {
        return this.searchBox
            ? this.searchBox.getValue()
                .trim()
                .replace(/@category/g, 'category')
                .replace(/@tag:/g, 'tag:')
                .replace(/@ext:/g, 'ext:')
                .replace(/@featured/g, 'featured')
                .replace(/@popular/g, this.extensionManagementServerService.webExtensionManagementServer && !this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer ? '@web' : '@popular')
            : '';
    }
    saveState() {
        const value = this.searchBox ? this.searchBox.getValue() : '';
        if (ExtensionsListView.isLocalExtensionsQuery(value)) {
            this.searchViewletState['query.value'] = value;
        }
        else {
            this.searchViewletState['query.value'] = '';
        }
        super.saveState();
    }
    doSearch(refresh) {
        const value = this.normalizedQuery();
        this.contextKeyService.bufferChangeEvents(() => {
            const isRecommendedExtensionsQuery = ExtensionsListView.isRecommendedExtensionsQuery(value);
            this.searchHasTextContextKey.set(value.trim() !== '');
            this.extensionsSearchValueContextKey.set(value);
            this.installedExtensionsContextKey.set(ExtensionsListView.isInstalledExtensionsQuery(value));
            this.searchInstalledExtensionsContextKey.set(ExtensionsListView.isSearchInstalledExtensionsQuery(value));
            this.searchRecentlyUpdatedExtensionsContextKey.set(ExtensionsListView.isSearchRecentlyUpdatedQuery(value) && !ExtensionsListView.isSearchExtensionUpdatesQuery(value));
            this.searchOutdatedExtensionsContextKey.set(ExtensionsListView.isOutdatedExtensionsQuery(value) && !ExtensionsListView.isSearchExtensionUpdatesQuery(value));
            this.searchExtensionUpdatesContextKey.set(ExtensionsListView.isSearchExtensionUpdatesQuery(value));
            this.searchEnabledExtensionsContextKey.set(ExtensionsListView.isEnabledExtensionsQuery(value));
            this.searchDisabledExtensionsContextKey.set(ExtensionsListView.isDisabledExtensionsQuery(value));
            this.searchBuiltInExtensionsContextKey.set(ExtensionsListView.isSearchBuiltInExtensionsQuery(value));
            this.searchWorkspaceUnsupportedExtensionsContextKey.set(ExtensionsListView.isSearchWorkspaceUnsupportedExtensionsQuery(value));
            this.searchDeprecatedExtensionsContextKey.set(ExtensionsListView.isSearchDeprecatedExtensionsQuery(value));
            this.builtInExtensionsContextKey.set(ExtensionsListView.isBuiltInExtensionsQuery(value));
            this.recommendedExtensionsContextKey.set(isRecommendedExtensionsQuery);
            this.searchMcpServersContextKey.set(this.mcpGalleryService.isEnabled() && !!value && /@mcp\s?.*/i.test(value));
            this.searchMarketplaceExtensionsContextKey.set(!!value && !ExtensionsListView.isLocalExtensionsQuery(value) && !isRecommendedExtensionsQuery && !this.searchMcpServersContextKey.get());
            this.sortByUpdateDateContextKey.set(ExtensionsListView.isSortUpdateDateQuery(value));
            this.defaultViewsContextKey.set(!value || ExtensionsListView.isSortInstalledExtensionsQuery(value));
        });
        this.renderNotificaiton();
        return this.progress(Promise.all(this.panes.map(view => view.show(this.normalizedQuery(), refresh)
            .then(model => this.alertSearchResult(model.length, view.id))))).then(() => undefined);
    }
    onDidAddViewDescriptors(added) {
        const addedViews = super.onDidAddViewDescriptors(added);
        this.progress(Promise.all(addedViews.map(addedView => addedView.show(this.normalizedQuery())
            .then(model => this.alertSearchResult(model.length, addedView.id)))));
        return addedViews;
    }
    alertSearchResult(count, viewId) {
        const view = this.viewContainerModel.visibleViewDescriptors.find(view => view.id === viewId);
        switch (count) {
            case 0:
                break;
            case 1:
                if (view) {
                    alert(localize('extensionFoundInSection', "1 extension found in the {0} section.", view.name.value));
                }
                else {
                    alert(localize('extensionFound', "1 extension found."));
                }
                break;
            default:
                if (view) {
                    alert(localize('extensionsFoundInSection', "{0} extensions found in the {1} section.", count, view.name.value));
                }
                else {
                    alert(localize('extensionsFound', "{0} extensions found.", count));
                }
                break;
        }
    }
    getFirstExpandedPane() {
        for (const pane of this.panes) {
            if (pane.isExpanded() && pane instanceof ExtensionsListView) {
                return pane;
            }
        }
        return undefined;
    }
    focusListView() {
        const pane = this.getFirstExpandedPane();
        if (pane && pane.count() > 0) {
            pane.focus();
        }
    }
    onViewletOpen(viewlet) {
        if (!viewlet || viewlet.getId() === VIEWLET_ID) {
            return;
        }
        if (this.configurationService.getValue(CloseExtensionDetailsOnViewChangeKey)) {
            const promises = this.editorGroupService.groups.map(group => {
                const editors = group.editors.filter(input => input instanceof ExtensionsInput);
                return group.closeEditors(editors);
            });
            Promise.all(promises);
        }
    }
    progress(promise) {
        return this.progressService.withProgress({ location: 5 /* ProgressLocation.Extensions */ }, () => promise);
    }
    onError(err) {
        if (isCancellationError(err)) {
            return;
        }
        const message = err && err.message || '';
        if (/ECONNREFUSED/.test(message)) {
            const error = createErrorWithActions(localize('suggestProxyError', "Marketplace returned 'ECONNREFUSED'. Please check the 'http.proxy' setting."), [
                new Action('open user settings', localize('open user settings', "Open User Settings"), undefined, true, () => this.preferencesService.openUserSettings())
            ]);
            this.notificationService.error(error);
            return;
        }
        this.notificationService.error(err);
    }
    isSupportedDragElement(e) {
        if (e.dataTransfer) {
            const typesLowerCase = e.dataTransfer.types.map(t => t.toLocaleLowerCase());
            return typesLowerCase.indexOf('files') !== -1;
        }
        return false;
    }
};
ExtensionsViewPaneContainer = __decorate([
    __param(0, IWorkbenchLayoutService),
    __param(1, ITelemetryService),
    __param(2, IProgressService),
    __param(3, IInstantiationService),
    __param(4, IEditorGroupsService),
    __param(5, IExtensionGalleryManifestService),
    __param(6, IExtensionsWorkbenchService),
    __param(7, IExtensionManagementServerService),
    __param(8, INotificationService),
    __param(9, IPaneCompositePartService),
    __param(10, IThemeService),
    __param(11, IConfigurationService),
    __param(12, IStorageService),
    __param(13, IWorkspaceContextService),
    __param(14, IContextKeyService),
    __param(15, IContextMenuService),
    __param(16, IExtensionService),
    __param(17, IViewDescriptorService),
    __param(18, IPreferencesService),
    __param(19, ICommandService),
    __param(20, IMcpGalleryService),
    __param(21, ILogService)
], ExtensionsViewPaneContainer);
export { ExtensionsViewPaneContainer };
let StatusUpdater = class StatusUpdater extends Disposable {
    constructor(activityService, extensionsWorkbenchService, extensionEnablementService, configurationService) {
        super();
        this.activityService = activityService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.configurationService = configurationService;
        this.badgeHandle = this._register(new MutableDisposable());
        this.onServiceChange();
        this._register(Event.any(Event.debounce(extensionsWorkbenchService.onChange, () => undefined, 100, undefined, undefined, undefined, this._store), extensionsWorkbenchService.onDidChangeExtensionsNotification)(this.onServiceChange, this));
    }
    onServiceChange() {
        this.badgeHandle.clear();
        let badge;
        const extensionsNotification = this.extensionsWorkbenchService.getExtensionsNotification();
        if (extensionsNotification) {
            if (extensionsNotification.severity === Severity.Warning) {
                badge = new WarningBadge(() => extensionsNotification.message);
            }
        }
        else {
            const actionRequired = this.configurationService.getValue(AutoRestartConfigurationKey) === true ? [] : this.extensionsWorkbenchService.installed.filter(e => e.runtimeState !== undefined);
            const outdated = this.extensionsWorkbenchService.outdated.reduce((r, e) => r + (this.extensionEnablementService.isEnabled(e.local) && !actionRequired.includes(e) ? 1 : 0), 0);
            const newBadgeNumber = outdated + actionRequired.length;
            if (newBadgeNumber > 0) {
                let msg = '';
                if (outdated) {
                    msg += outdated === 1 ? localize('extensionToUpdate', '{0} requires update', outdated) : localize('extensionsToUpdate', '{0} require update', outdated);
                }
                if (outdated > 0 && actionRequired.length > 0) {
                    msg += ', ';
                }
                if (actionRequired.length) {
                    msg += actionRequired.length === 1 ? localize('extensionToReload', '{0} requires restart', actionRequired.length) : localize('extensionsToReload', '{0} require restart', actionRequired.length);
                }
                badge = new NumberBadge(newBadgeNumber, () => msg);
            }
        }
        if (badge) {
            this.badgeHandle.value = this.activityService.showViewContainerActivity(VIEWLET_ID, { badge });
        }
    }
};
StatusUpdater = __decorate([
    __param(0, IActivityService),
    __param(1, IExtensionsWorkbenchService),
    __param(2, IWorkbenchExtensionEnablementService),
    __param(3, IConfigurationService)
], StatusUpdater);
export { StatusUpdater };
let MaliciousExtensionChecker = class MaliciousExtensionChecker {
    constructor(extensionsManagementService, extensionsWorkbenchService, hostService, logService, notificationService, commandService) {
        this.extensionsManagementService = extensionsManagementService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.hostService = hostService;
        this.logService = logService;
        this.notificationService = notificationService;
        this.commandService = commandService;
        this.loopCheckForMaliciousExtensions();
    }
    loopCheckForMaliciousExtensions() {
        this.checkForMaliciousExtensions()
            .then(() => timeout(1000 * 60 * 5)) // every five minutes
            .then(() => this.loopCheckForMaliciousExtensions());
    }
    async checkForMaliciousExtensions() {
        try {
            const maliciousExtensions = [];
            let shouldRestartExtensions = false;
            let shouldReloadWindow = false;
            for (const extension of this.extensionsWorkbenchService.installed) {
                if (extension.isMalicious && extension.local) {
                    maliciousExtensions.push([extension.local, extension.maliciousInfoLink]);
                    shouldRestartExtensions = shouldRestartExtensions || extension.runtimeState?.action === "restartExtensions" /* ExtensionRuntimeActionType.RestartExtensions */;
                    shouldReloadWindow = shouldReloadWindow || extension.runtimeState?.action === "reloadWindow" /* ExtensionRuntimeActionType.ReloadWindow */;
                }
            }
            if (maliciousExtensions.length) {
                await this.extensionsManagementService.uninstallExtensions(maliciousExtensions.map(e => ({ extension: e[0], options: { remove: true } })));
                for (const [extension, link] of maliciousExtensions) {
                    const buttons = [];
                    if (shouldRestartExtensions || shouldReloadWindow) {
                        buttons.push({
                            label: shouldRestartExtensions ? localize('restartNow', "Restart Extensions") : localize('reloadNow', "Reload Now"),
                            run: () => shouldRestartExtensions ? this.extensionsWorkbenchService.updateRunningExtensions() : this.hostService.reload()
                        });
                    }
                    if (link) {
                        buttons.push({
                            label: localize('learnMore', "Learn More"),
                            run: () => this.commandService.executeCommand('vscode.open', URI.parse(link))
                        });
                    }
                    this.notificationService.prompt(Severity.Warning, localize('malicious warning', "The extension '{0}' was found to be problematic and has been uninstalled", extension.manifest.displayName || extension.identifier.id), buttons, {
                        sticky: true,
                        priority: NotificationPriority.URGENT
                    });
                }
            }
        }
        catch (err) {
            this.logService.error(err);
        }
    }
};
MaliciousExtensionChecker = __decorate([
    __param(0, IExtensionManagementService),
    __param(1, IExtensionsWorkbenchService),
    __param(2, IHostService),
    __param(3, ILogService),
    __param(4, INotificationService),
    __param(5, ICommandService)
], MaliciousExtensionChecker);
export { MaliciousExtensionChecker };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uc1ZpZXdsZXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2V4dGVuc2lvbnMvYnJvd3Nlci9leHRlbnNpb25zVmlld2xldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVqRixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLHFCQUFxQixFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNqSyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUscUJBQXFCLEVBQW9CLE1BQU0sNERBQTRELENBQUM7QUFDckgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLDJCQUEyQixFQUFnQyxVQUFVLEVBQUUsb0NBQW9D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