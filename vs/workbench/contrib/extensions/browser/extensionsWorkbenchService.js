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
var ExtensionsWorkbenchService_1;
import * as nls from '../../../../nls.js';
import * as semver from '../../../../base/common/semver/semver.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { index } from '../../../../base/common/arrays.js';
import { Promises, ThrottledDelayer, createCancelablePromise } from '../../../../base/common/async.js';
import { CancellationError, isCancellationError } from '../../../../base/common/errors.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { singlePagePager } from '../../../../base/common/paging.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IExtensionGalleryService, WEB_EXTENSION_TAG, isTargetPlatformCompatible, EXTENSION_IDENTIFIER_REGEX, TargetPlatformToString, IAllowedExtensionsService, AllowedExtensionsConfigKey, EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT, ExtensionManagementError, shouldRequireRepositorySignatureFor } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IWorkbenchExtensionEnablementService, IExtensionManagementServerService, IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { getGalleryExtensionTelemetryData, getLocalExtensionTelemetryData, areSameExtensions, groupByExtension, getGalleryExtensionId, findMatchingMaliciousEntry } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { URI } from '../../../../base/common/uri.js';
import { AutoUpdateConfigurationKey, AutoCheckUpdatesConfigurationKey, HasOutdatedExtensionsContext, AutoRestartConfigurationKey, VIEWLET_ID } from '../common/extensions.js';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { IURLService } from '../../../../platform/url/common/url.js';
import { ExtensionsInput } from '../common/extensionsInput.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { INotificationService, NotificationPriority, Severity } from '../../../../platform/notification/common/notification.js';
import * as resources from '../../../../base/common/resources.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ExtensionIdentifier, isApplicationScopedExtension } from '../../../../platform/extensions/common/extensions.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { FileAccess } from '../../../../base/common/network.js';
import { IIgnoredExtensionsManagementService } from '../../../../platform/userDataSync/common/ignoredExtensions.js';
import { IUserDataAutoSyncService, IUserDataSyncEnablementService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { isBoolean, isDefined, isString, isUndefined } from '../../../../base/common/types.js';
import { IExtensionManifestPropertiesService } from '../../../services/extensions/common/extensionManifestPropertiesService.js';
import { IExtensionService, toExtension, toExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { isWeb, language } from '../../../../base/common/platform.js';
import { getLocale } from '../../../../platform/languagePacks/common/languagePacks.js';
import { ILocaleService } from '../../../services/localization/common/locale.js';
import { TelemetryTrustedValue } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
import { areApiProposalsCompatible, isEngineValid } from '../../../../platform/extensions/common/extensionValidator.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ShowCurrentReleaseNotesActionId } from '../../update/common/update.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { fromNow } from '../../../../base/common/date.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
let Extension = class Extension {
    constructor(stateProvider, runtimeStateProvider, server, local, _gallery, resourceExtensionInfo, galleryService, telemetryService, logService, fileService, productService) {
        this.stateProvider = stateProvider;
        this.runtimeStateProvider = runtimeStateProvider;
        this.server = server;
        this.local = local;
        this._gallery = _gallery;
        this.resourceExtensionInfo = resourceExtensionInfo;
        this.galleryService = galleryService;
        this.telemetryService = telemetryService;
        this.logService = logService;
        this.fileService = fileService;
        this.productService = productService;
        this.enablementState = 11 /* EnablementState.EnabledGlobally */;
        this.galleryResourcesCache = new Map();
    }
    get resourceExtension() {
        if (this.resourceExtensionInfo) {
            return this.resourceExtensionInfo.resourceExtension;
        }
        if (this.local?.isWorkspaceScoped) {
            return {
                type: 'resource',
                identifier: this.local.identifier,
                location: this.local.location,
                manifest: this.local.manifest,
                changelogUri: this.local.changelogUrl,
                readmeUri: this.local.readmeUrl,
            };
        }
        return undefined;
    }
    get gallery() {
        return this._gallery;
    }
    set gallery(gallery) {
        this._gallery = gallery;
        this.galleryResourcesCache.clear();
    }
    get missingFromGallery() {
        return !!this._missingFromGallery;
    }
    set missingFromGallery(missing) {
        this._missingFromGallery = missing;
    }
    get type() {
        return this.local ? this.local.type : 1 /* ExtensionType.User */;
    }
    get isBuiltin() {
        return this.local ? this.local.isBuiltin : false;
    }
    get isWorkspaceScoped() {
        if (this.local) {
            return this.local.isWorkspaceScoped;
        }
        if (this.resourceExtensionInfo) {
            return this.resourceExtensionInfo.isWorkspaceScoped;
        }
        return false;
    }
    get name() {
        if (this.gallery) {
            return this.gallery.name;
        }
        return this.getManifestFromLocalOrResource()?.name ?? '';
    }
    get displayName() {
        if (this.gallery) {
            return this.gallery.displayName || this.gallery.name;
        }
        return this.getManifestFromLocalOrResource()?.displayName ?? this.name;
    }
    get identifier() {
        if (this.gallery) {
            return this.gallery.identifier;
        }
        if (this.resourceExtension) {
            return this.resourceExtension.identifier;
        }
        return this.local?.identifier ?? { id: '' };
    }
    get uuid() {
        return this.gallery ? this.gallery.identifier.uuid : this.local?.identifier.uuid;
    }
    get publisher() {
        if (this.gallery) {
            return this.gallery.publisher;
        }
        return this.getManifestFromLocalOrResource()?.publisher ?? '';
    }
    get publisherDisplayName() {
        if (this.gallery) {
            return this.gallery.publisherDisplayName || this.gallery.publisher;
        }
        if (this.local?.publisherDisplayName) {
            return this.local.publisherDisplayName;
        }
        return this.publisher;
    }
    get publisherUrl() {
        return this.gallery?.publisherLink ? URI.parse(this.gallery.publisherLink) : undefined;
    }
    get publisherDomain() {
        return this.gallery?.publisherDomain;
    }
    get publisherSponsorLink() {
        return this.gallery?.publisherSponsorLink ? URI.parse(this.gallery.publisherSponsorLink) : undefined;
    }
    get version() {
        return this.local ? this.local.manifest.version : this.latestVersion;
    }
    get private() {
        return this.gallery ? this.gallery.private : this.local ? this.local.private : false;
    }
    get pinned() {
        return !!this.local?.pinned;
    }
    get latestVersion() {
        return this.gallery ? this.gallery.version : this.getManifestFromLocalOrResource()?.version ?? '';
    }
    get description() {
        return this.gallery ? this.gallery.description : this.getManifestFromLocalOrResource()?.description ?? '';
    }
    get url() {
        return this.gallery?.detailsLink;
    }
    get iconUrl() {
        return this.galleryIconUrl || this.resourceExtensionIconUrl || this.localIconUrl || this.defaultIconUrl;
    }
    get iconUrlFallback() {
        return this.gallery?.assets.icon?.fallbackUri;
    }
    get localIconUrl() {
        if (this.local && this.local.manifest.icon) {
            return FileAccess.uriToBrowserUri(resources.joinPath(this.local.location, this.local.manifest.icon)).toString(true);
        }
        return undefined;
    }
    get resourceExtensionIconUrl() {
        if (this.resourceExtension?.manifest.icon) {
            return FileAccess.uriToBrowserUri(resources.joinPath(this.resourceExtension.location, this.resourceExtension.manifest.icon)).toString(true);
        }
        return undefined;
    }
    get galleryIconUrl() {
        return this.gallery?.assets.icon?.uri;
    }
    get defaultIconUrl() {
        if (this.type === 0 /* ExtensionType.System */ && this.local) {
            if (this.local.manifest && this.local.manifest.contributes) {
                if (Array.isArray(this.local.manifest.contributes.themes) && this.local.manifest.contributes.themes.length) {
                    return FileAccess.asBrowserUri('vs/workbench/contrib/extensions/browser/media/theme-icon.png').toString(true);
                }
                if (Array.isArray(this.local.manifest.contributes.grammars) && this.local.manifest.contributes.grammars.length) {
                    return FileAccess.asBrowserUri('vs/workbench/contrib/extensions/browser/media/language-icon.svg').toString(true);
                }
            }
        }
        return undefined;
    }
    get repository() {
        return this.gallery && this.gallery.assets.repository ? this.gallery.assets.repository.uri : undefined;
    }
    get licenseUrl() {
        return this.gallery && this.gallery.assets.license ? this.gallery.assets.license.uri : undefined;
    }
    get supportUrl() {
        return this.gallery && this.gallery.supportLink ? this.gallery.supportLink : undefined;
    }
    get state() {
        return this.stateProvider(this);
    }
    get isMalicious() {
        return !!this.malicious || this.enablementState === 4 /* EnablementState.DisabledByMalicious */;
    }
    get maliciousInfoLink() {
        return this.malicious?.learnMoreLink;
    }
    get installCount() {
        return this.gallery ? this.gallery.installCount : undefined;
    }
    get rating() {
        return this.gallery ? this.gallery.rating : undefined;
    }
    get ratingCount() {
        return this.gallery ? this.gallery.ratingCount : undefined;
    }
    get ratingUrl() {
        return this.gallery?.ratingLink;
    }
    get outdated() {
        try {
            if (!this.gallery || !this.local) {
                return false;
            }
            // Do not allow updating system extensions in stable
            if (this.type === 0 /* ExtensionType.System */ && this.productService.quality === 'stable') {
                return false;
            }
            if (!this.local.preRelease && this.gallery.properties.isPreReleaseVersion) {
                return false;
            }
            if (semver.gt(this.latestVersion, this.version)) {
                return true;
            }
            if (this.outdatedTargetPlatform) {
                return true;
            }
        }
        catch (error) {
            /* Ignore */
        }
        return false;
    }
    get outdatedTargetPlatform() {
        return !!this.local && !!this.gallery
            && !["undefined" /* TargetPlatform.UNDEFINED */, "web" /* TargetPlatform.WEB */].includes(this.local.targetPlatform)
            && this.gallery.properties.targetPlatform !== "web" /* TargetPlatform.WEB */
            && this.local.targetPlatform !== this.gallery.properties.targetPlatform
            && semver.eq(this.latestVersion, this.version);
    }
    get runtimeState() {
        return this.runtimeStateProvider(this);
    }
    get telemetryData() {
        const { local, gallery } = this;
        if (gallery) {
            return getGalleryExtensionTelemetryData(gallery);
        }
        else if (local) {
            return getLocalExtensionTelemetryData(local);
        }
        else {
            return {};
        }
    }
    get preview() {
        return this.local?.manifest.preview ?? this.gallery?.preview ?? false;
    }
    get preRelease() {
        return !!this.local?.preRelease;
    }
    get isPreReleaseVersion() {
        if (this.local) {
            return this.local.isPreReleaseVersion;
        }
        return !!this.gallery?.properties.isPreReleaseVersion;
    }
    get hasPreReleaseVersion() {
        return this.gallery ? this.gallery.hasPreReleaseVersion : !!this.local?.hasPreReleaseVersion;
    }
    get hasReleaseVersion() {
        return !!this.resourceExtension || !!this.gallery?.hasReleaseVersion;
    }
    getLocal() {
        return this.local && !this.outdated ? this.local : undefined;
    }
    async getManifest(token) {
        const local = this.getLocal();
        if (local) {
            return local.manifest;
        }
        if (this.gallery) {
            return this.getGalleryManifest(token);
        }
        if (this.resourceExtension) {
            return this.resourceExtension.manifest;
        }
        return null;
    }
    async getGalleryManifest(token = CancellationToken.None) {
        if (this.gallery) {
            let cache = this.galleryResourcesCache.get('manifest');
            if (!cache) {
                if (this.gallery.assets.manifest) {
                    this.galleryResourcesCache.set('manifest', cache = this.galleryService.getManifest(this.gallery, token)
                        .catch(e => {
                        this.galleryResourcesCache.delete('manifest');
                        throw e;
                    }));
                }
                else {
                    this.logService.error(nls.localize('Manifest is not found', "Manifest is not found"), this.identifier.id);
                }
            }
            return cache;
        }
        return null;
    }
    hasReadme() {
        if (this.local && this.local.readmeUrl) {
            return true;
        }
        if (this.gallery && this.gallery.assets.readme) {
            return true;
        }
        if (this.resourceExtension?.readmeUri) {
            return true;
        }
        return this.type === 0 /* ExtensionType.System */;
    }
    async getReadme(token) {
        const local = this.getLocal();
        if (local?.readmeUrl) {
            const content = await this.fileService.readFile(local.readmeUrl);
            return content.value.toString();
        }
        if (this.gallery) {
            if (this.gallery.assets.readme) {
                return this.galleryService.getReadme(this.gallery, token);
            }
            this.telemetryService.publicLog('extensions:NotFoundReadMe', this.telemetryData);
        }
        if (this.type === 0 /* ExtensionType.System */) {
            return Promise.resolve(`# ${this.displayName || this.name}
**Notice:** This extension is bundled with Visual Studio Code. It can be disabled but not uninstalled.
## Features
${this.description}
`);
        }
        if (this.resourceExtension?.readmeUri) {
            const content = await this.fileService.readFile(this.resourceExtension?.readmeUri);
            return content.value.toString();
        }
        return Promise.reject(new Error('not available'));
    }
    hasChangelog() {
        if (this.local && this.local.changelogUrl) {
            return true;
        }
        if (this.gallery && this.gallery.assets.changelog) {
            return true;
        }
        return this.type === 0 /* ExtensionType.System */;
    }
    async getChangelog(token) {
        const local = this.getLocal();
        if (local?.changelogUrl) {
            const content = await this.fileService.readFile(local.changelogUrl);
            return content.value.toString();
        }
        if (this.gallery?.assets.changelog) {
            return this.galleryService.getChangelog(this.gallery, token);
        }
        if (this.type === 0 /* ExtensionType.System */) {
            return Promise.resolve(`Please check the [VS Code Release Notes](command:${ShowCurrentReleaseNotesActionId}) for changes to the built-in extensions.`);
        }
        return Promise.reject(new Error('not available'));
    }
    get categories() {
        const { local, gallery, resourceExtension } = this;
        if (local && local.manifest.categories && !this.outdated) {
            return local.manifest.categories;
        }
        if (gallery) {
            return gallery.categories;
        }
        if (resourceExtension) {
            return resourceExtension.manifest.categories ?? [];
        }
        return [];
    }
    get tags() {
        const { gallery } = this;
        if (gallery) {
            return gallery.tags.filter(tag => !tag.startsWith('_'));
        }
        return [];
    }
    get dependencies() {
        const { local, gallery, resourceExtension } = this;
        if (local && local.manifest.extensionDependencies && !this.outdated) {
            return local.manifest.extensionDependencies;
        }
        if (gallery) {
            return gallery.properties.dependencies || [];
        }
        if (resourceExtension) {
            return resourceExtension.manifest.extensionDependencies || [];
        }
        return [];
    }
    get extensionPack() {
        const { local, gallery, resourceExtension } = this;
        if (local && local.manifest.extensionPack && !this.outdated) {
            return local.manifest.extensionPack;
        }
        if (gallery) {
            return gallery.properties.extensionPack || [];
        }
        if (resourceExtension) {
            return resourceExtension.manifest.extensionPack || [];
        }
        return [];
    }
    setExtensionsControlManifest(extensionsControlManifest) {
        this.malicious = findMatchingMaliciousEntry(this.identifier, extensionsControlManifest.malicious);
        this.deprecationInfo = extensionsControlManifest.deprecated ? extensionsControlManifest.deprecated[this.identifier.id.toLowerCase()] : undefined;
    }
    getManifestFromLocalOrResource() {
        if (this.local) {
            return this.local.manifest;
        }
        if (this.resourceExtension) {
            return this.resourceExtension.manifest;
        }
        return null;
    }
};
Extension = __decorate([
    __param(6, IExtensionGalleryService),
    __param(7, ITelemetryService),
    __param(8, ILogService),
    __param(9, IFileService),
    __param(10, IProductService)
], Extension);
export { Extension };
const EXTENSIONS_AUTO_UPDATE_KEY = 'extensions.autoUpdate';
const EXTENSIONS_DONOT_AUTO_UPDATE_KEY = 'extensions.donotAutoUpdate';
const EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY = 'extensions.dismissedNotifications';
let Extensions = class Extensions extends Disposable {
    get onChange() { return this._onChange.event; }
    get onReset() { return this._onReset.event; }
    constructor(server, stateProvider, runtimeStateProvider, isWorkspaceServer, galleryService, extensionEnablementService, workbenchExtensionManagementService, telemetryService, instantiationService) {
        super();
        this.server = server;
        this.stateProvider = stateProvider;
        this.runtimeStateProvider = runtimeStateProvider;
        this.isWorkspaceServer = isWorkspaceServer;
        this.galleryService = galleryService;
        this.extensionEnablementService = extensionEnablementService;
        this.workbenchExtensionManagementService = workbenchExtensionManagementService;
        this.telemetryService = telemetryService;
        this.instantiationService = instantiationService;
        this._onChange = this._register(new Emitter());
        this._onReset = this._register(new Emitter());
        this.installing = [];
        this.uninstalling = [];
        this.installed = [];
        this._register(server.extensionManagementService.onInstallExtension(e => this.onInstallExtension(e)));
        this._register(server.extensionManagementService.onDidInstallExtensions(e => this.onDidInstallExtensions(e)));
        this._register(server.extensionManagementService.onUninstallExtension(e => this.onUninstallExtension(e.identifier)));
        this._register(server.extensionManagementService.onDidUninstallExtension(e => this.onDidUninstallExtension(e)));
        this._register(server.extensionManagementService.onDidUpdateExtensionMetadata(e => this.onDidUpdateExtensionMetadata(e.local)));
        this._register(server.extensionManagementService.onDidChangeProfile(() => this.reset()));
        this._register(extensionEnablementService.onEnablementChanged(e => this.onEnablementChanged(e)));
        this._register(Event.any(this.onChange, this.onReset)(() => this._local = undefined));
        if (this.isWorkspaceServer) {
            this._register(this.workbenchExtensionManagementService.onInstallExtension(e => {
                if (e.workspaceScoped) {
                    this.onInstallExtension(e);
                }
            }));
            this._register(this.workbenchExtensionManagementService.onDidInstallExtensions(e => {
                const result = e.filter(e => e.workspaceScoped);
                if (result.length) {
                    this.onDidInstallExtensions(result);
                }
            }));
            this._register(this.workbenchExtensionManagementService.onUninstallExtension(e => {
                if (e.workspaceScoped) {
                    this.onUninstallExtension(e.identifier);
                }
            }));
            this._register(this.workbenchExtensionManagementService.onDidUninstallExtension(e => {
                if (e.workspaceScoped) {
                    this.onDidUninstallExtension(e);
                }
            }));
        }
    }
    get local() {
        if (!this._local) {
            this._local = [];
            for (const extension of this.installed) {
                this._local.push(extension);
            }
            for (const extension of this.installing) {
                if (!this.installed.some(installed => areSameExtensions(installed.identifier, extension.identifier))) {
                    this._local.push(extension);
                }
            }
        }
        return this._local;
    }
    async queryInstalled(productVersion) {
        await this.fetchInstalledExtensions(productVersion);
        this._onChange.fire(undefined);
        return this.local;
    }
    async syncInstalledExtensionsWithGallery(galleryExtensions, productVersion, flagExtensionsMissingFromGallery) {
        const extensions = await this.mapInstalledExtensionWithCompatibleGalleryExtension(galleryExtensions, productVersion);
        for (const [extension, gallery] of extensions) {
            // update metadata of the extension if it does not exist
            if (extension.local && !extension.local.identifier.uuid) {
                extension.local = await this.updateMetadata(extension.local, gallery);
            }
            if (!extension.gallery || extension.gallery.version !== gallery.version || extension.gallery.properties.targetPlatform !== gallery.properties.targetPlatform) {
                extension.gallery = gallery;
                this._onChange.fire({ extension });
            }
        }
        // Detect extensions that do not have a corresponding gallery entry.
        if (flagExtensionsMissingFromGallery) {
            const extensionsToQuery = [];
            for (const extension of this.local) {
                // Extension is already paired with a gallery object
                if (extension.gallery) {
                    continue;
                }
                // Already flagged as missing from gallery
                if (extension.missingFromGallery) {
                    continue;
                }
                // A UUID indicates extension originated from gallery
                if (!extension.identifier.uuid) {
                    continue;
                }
                // Extension is not present in the set we are concerned about
                if (!flagExtensionsMissingFromGallery.some(f => areSameExtensions(f, extension.identifier))) {
                    continue;
                }
                extensionsToQuery.push(extension);
            }
            if (extensionsToQuery.length) {
                const queryResult = await this.galleryService.getExtensions(extensionsToQuery.map(e => ({ ...e.identifier, version: e.version })), CancellationToken.None);
                const queriedIds = [];
                const missingIds = [];
                for (const extension of extensionsToQuery) {
                    queriedIds.push(extension.identifier.id);
                    const gallery = queryResult.find(g => areSameExtensions(g.identifier, extension.identifier));
                    if (gallery) {
                        extension.gallery = gallery;
                    }
                    else {
                        extension.missingFromGallery = true;
                        missingIds.push(extension.identifier.id);
                    }
                    this._onChange.fire({ extension });
                }
                this.telemetryService.publicLog2('extensions:missingFromGallery', {
                    queriedIds: new TelemetryTrustedValue(queriedIds.join(';')),
                    missingIds: new TelemetryTrustedValue(missingIds.join(';'))
                });
            }
        }
    }
    async mapInstalledExtensionWithCompatibleGalleryExtension(galleryExtensions, productVersion) {
        const mappedExtensions = this.mapInstalledExtensionWithGalleryExtension(galleryExtensions);
        const targetPlatform = await this.server.extensionManagementService.getTargetPlatform();
        const compatibleGalleryExtensions = [];
        const compatibleGalleryExtensionsToFetch = [];
        await Promise.allSettled(mappedExtensions.map(async ([extension, gallery]) => {
            if (extension.local) {
                if (await this.galleryService.isExtensionCompatible(gallery, extension.local.preRelease, targetPlatform, productVersion)) {
                    compatibleGalleryExtensions.push(gallery);
                }
                else {
                    compatibleGalleryExtensionsToFetch.push({ ...extension.local.identifier, preRelease: extension.local.preRelease });
                }
            }
        }));
        if (compatibleGalleryExtensionsToFetch.length) {
            const result = await this.galleryService.getExtensions(compatibleGalleryExtensionsToFetch, { targetPlatform, compatible: true, queryAllVersions: true, productVersion }, CancellationToken.None);
            compatibleGalleryExtensions.push(...result);
        }
        return this.mapInstalledExtensionWithGalleryExtension(compatibleGalleryExtensions);
    }
    mapInstalledExtensionWithGalleryExtension(galleryExtensions) {
        const mappedExtensions = [];
        const byUUID = new Map(), byID = new Map();
        for (const gallery of galleryExtensions) {
            byUUID.set(gallery.identifier.uuid, gallery);
            byID.set(gallery.identifier.id.toLowerCase(), gallery);
        }
        for (const installed of this.installed) {
            if (installed.uuid) {
                const gallery = byUUID.get(installed.uuid);
                if (gallery) {
                    mappedExtensions.push([installed, gallery]);
                    continue;
                }
            }
            if (installed.local?.source !== 'resource') {
                const gallery = byID.get(installed.identifier.id.toLowerCase());
                if (gallery) {
                    mappedExtensions.push([installed, gallery]);
                }
            }
        }
        return mappedExtensions;
    }
    async updateMetadata(localExtension, gallery) {
        let isPreReleaseVersion = false;
        if (localExtension.manifest.version !== gallery.version) {
            this.telemetryService.publicLog2('galleryService:updateMetadata');
            const galleryWithLocalVersion = (await this.galleryService.getExtensions([{ ...localExtension.identifier, version: localExtension.manifest.version }], CancellationToken.None))[0];
            isPreReleaseVersion = !!galleryWithLocalVersion?.properties?.isPreReleaseVersion;
        }
        return this.workbenchExtensionManagementService.updateMetadata(localExtension, { id: gallery.identifier.uuid, publisherDisplayName: gallery.publisherDisplayName, publisherId: gallery.publisherId, isPreReleaseVersion });
    }
    canInstall(galleryExtension) {
        return this.server.extensionManagementService.canInstall(galleryExtension);
    }
    onInstallExtension(event) {
        const { source } = event;
        if (source && !URI.isUri(source)) {
            const extension = this.installed.find(e => areSameExtensions(e.identifier, source.identifier))
                ?? this.instantiationService.createInstance(Extension, this.stateProvider, this.runtimeStateProvider, this.server, undefined, source, undefined);
            this.installing.push(extension);
            this._onChange.fire({ extension });
        }
    }
    async fetchInstalledExtensions(productVersion) {
        const extensionsControlManifest = await this.server.extensionManagementService.getExtensionsControlManifest();
        const all = await this.server.extensionManagementService.getInstalled(undefined, undefined, productVersion);
        if (this.isWorkspaceServer) {
            all.push(...await this.workbenchExtensionManagementService.getInstalledWorkspaceExtensions(true));
        }
        // dedup workspace, user and system extensions by giving priority to workspace first and then to user extension.
        const installed = groupByExtension(all, r => r.identifier).reduce((result, extensions) => {
            if (extensions.length === 1) {
                result.push(extensions[0]);
            }
            else {
                let workspaceExtension, userExtension, systemExtension;
                for (const extension of extensions) {
                    if (extension.isWorkspaceScoped) {
                        workspaceExtension = extension;
                    }
                    else if (extension.type === 1 /* ExtensionType.User */) {
                        userExtension = extension;
                    }
                    else {
                        systemExtension = extension;
                    }
                }
                const extension = workspaceExtension ?? userExtension ?? systemExtension;
                if (extension) {
                    result.push(extension);
                }
            }
            return result;
        }, []);
        const byId = index(this.installed, e => e.local ? e.local.identifier.id : e.identifier.id);
        this.installed = installed.map(local => {
            const extension = byId[local.identifier.id] || this.instantiationService.createInstance(Extension, this.stateProvider, this.runtimeStateProvider, this.server, local, undefined, undefined);
            extension.local = local;
            extension.enablementState = this.extensionEnablementService.getEnablementState(local);
            extension.setExtensionsControlManifest(extensionsControlManifest);
            return extension;
        });
    }
    async reset() {
        this.installed = [];
        this.installing = [];
        this.uninstalling = [];
        await this.fetchInstalledExtensions();
        this._onReset.fire();
    }
    async onDidInstallExtensions(results) {
        const extensions = [];
        for (const event of results) {
            const { local, source } = event;
            const gallery = source && !URI.isUri(source) ? source : undefined;
            const location = source && URI.isUri(source) ? source : undefined;
            const installingExtension = gallery ? this.installing.filter(e => areSameExtensions(e.identifier, gallery.identifier))[0] : null;
            this.installing = installingExtension ? this.installing.filter(e => e !== installingExtension) : this.installing;
            let extension = installingExtension ? installingExtension
                : (location || local) ? this.instantiationService.createInstance(Extension, this.stateProvider, this.runtimeStateProvider, this.server, local, undefined, undefined)
                    : undefined;
            if (extension) {
                if (local) {
                    const installed = this.installed.filter(e => areSameExtensions(e.identifier, extension.identifier))[0];
                    if (installed) {
                        extension = installed;
                    }
                    else {
                        this.installed.push(extension);
                    }
                    extension.local = local;
                    if (!extension.gallery) {
                        extension.gallery = gallery;
                    }
                    extension.enablementState = this.extensionEnablementService.getEnablementState(local);
                }
                extensions.push(extension);
            }
            this._onChange.fire(!local || !extension ? undefined : { extension, operation: event.operation });
        }
        if (extensions.length) {
            const manifest = await this.server.extensionManagementService.getExtensionsControlManifest();
            for (const extension of extensions) {
                extension.setExtensionsControlManifest(manifest);
            }
            this.matchInstalledExtensionsWithGallery(extensions);
        }
    }
    async onDidUpdateExtensionMetadata(local) {
        const extension = this.installed.find(e => areSameExtensions(e.identifier, local.identifier));
        if (extension?.local) {
            extension.local = local;
            this._onChange.fire({ extension });
        }
    }
    async matchInstalledExtensionsWithGallery(extensions) {
        const toMatch = extensions.filter(e => e.local && !e.gallery && e.local.source !== 'resource');
        if (!toMatch.length) {
            return;
        }
        if (!this.galleryService.isEnabled()) {
            return;
        }
        const galleryExtensions = await this.galleryService.getExtensions(toMatch.map(e => ({ ...e.identifier, preRelease: e.local?.preRelease })), { compatible: true, targetPlatform: await this.server.extensionManagementService.getTargetPlatform() }, CancellationToken.None);
        for (const extension of extensions) {
            const compatible = galleryExtensions.find(e => areSameExtensions(e.identifier, extension.identifier));
            if (compatible) {
                extension.gallery = compatible;
                this._onChange.fire({ extension });
            }
        }
    }
    onUninstallExtension(identifier) {
        const extension = this.installed.filter(e => areSameExtensions(e.identifier, identifier))[0];
        if (extension) {
            const uninstalling = this.uninstalling.filter(e => areSameExtensions(e.identifier, identifier))[0] || extension;
            this.uninstalling = [uninstalling, ...this.uninstalling.filter(e => !areSameExtensions(e.identifier, identifier))];
            this._onChange.fire(uninstalling ? { extension: uninstalling } : undefined);
        }
    }
    onDidUninstallExtension({ identifier, error }) {
        const uninstalled = this.uninstalling.find(e => areSameExtensions(e.identifier, identifier)) || this.installed.find(e => areSameExtensions(e.identifier, identifier));
        this.uninstalling = this.uninstalling.filter(e => !areSameExtensions(e.identifier, identifier));
        if (!error) {
            this.installed = this.installed.filter(e => !areSameExtensions(e.identifier, identifier));
        }
        if (uninstalled) {
            this._onChange.fire({ extension: uninstalled });
        }
    }
    onEnablementChanged(platformExtensions) {
        const extensions = this.local.filter(e => platformExtensions.some(p => areSameExtensions(e.identifier, p.identifier)));
        for (const extension of extensions) {
            if (extension.local) {
                const enablementState = this.extensionEnablementService.getEnablementState(extension.local);
                if (enablementState !== extension.enablementState) {
                    extension.enablementState = enablementState;
                    this._onChange.fire({ extension });
                }
            }
        }
    }
    getExtensionState(extension) {
        if (extension.gallery && this.installing.some(e => !!e.gallery && areSameExtensions(e.gallery.identifier, extension.gallery.identifier))) {
            return 0 /* ExtensionState.Installing */;
        }
        if (this.uninstalling.some(e => areSameExtensions(e.identifier, extension.identifier))) {
            return 2 /* ExtensionState.Uninstalling */;
        }
        const local = this.installed.filter(e => e === extension || (e.gallery && extension.gallery && areSameExtensions(e.gallery.identifier, extension.gallery.identifier)))[0];
        return local ? 1 /* ExtensionState.Installed */ : 3 /* ExtensionState.Uninstalled */;
    }
};
Extensions = __decorate([
    __param(4, IExtensionGalleryService),
    __param(5, IWorkbenchExtensionEnablementService),
    __param(6, IWorkbenchExtensionManagementService),
    __param(7, ITelemetryService),
    __param(8, IInstantiationService)
], Extensions);
let ExtensionsWorkbenchService = class ExtensionsWorkbenchService extends Disposable {
    static { ExtensionsWorkbenchService_1 = this; }
    static { this.UpdatesCheckInterval = 1000 * 60 * 60 * 12; } // 12 hours
    get onChange() { return this._onChange.event; }
    get onReset() { return this._onReset.event; }
    constructor(instantiationService, editorService, extensionManagementService, galleryService, extensionGalleryManifestService, configurationService, telemetryService, notificationService, urlService, extensionEnablementService, hostService, progressService, extensionManagementServerService, languageService, extensionsSyncManagementService, userDataAutoSyncService, productService, contextKeyService, extensionManifestPropertiesService, logService, extensionService, localeService, lifecycleService, fileService, userDataProfileService, userDataProfilesService, storageService, dialogService, userDataSyncEnablementService, updateService, uriIdentityService, workspaceContextService, viewsService, fileDialogService, quickInputService, allowedExtensionsService) {
        super();
        this.instantiationService = instantiationService;
        this.editorService = editorService;
        this.extensionManagementService = extensionManagementService;
        this.galleryService = galleryService;
        this.extensionGalleryManifestService = extensionGalleryManifestService;
        this.configurationService = configurationService;
        this.telemetryService = telemetryService;
        this.notificationService = notificationService;
        this.extensionEnablementService = extensionEnablementService;
        this.hostService = hostService;
        this.progressService = progressService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.languageService = languageService;
        this.extensionsSyncManagementService = extensionsSyncManagementService;
        this.userDataAutoSyncService = userDataAutoSyncService;
        this.productService = productService;
        this.extensionManifestPropertiesService = extensionManifestPropertiesService;
        this.logService = logService;
        this.extensionService = extensionService;
        this.localeService = localeService;
        this.lifecycleService = lifecycleService;
        this.fileService = fileService;
        this.userDataProfileService = userDataProfileService;
        this.userDataProfilesService = userDataProfilesService;
        this.storageService = storageService;
        this.dialogService = dialogService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.updateService = updateService;
        this.uriIdentityService = uriIdentityService;
        this.workspaceContextService = workspaceContextService;
        this.viewsService = viewsService;
        this.fileDialogService = fileDialogService;
        this.quickInputService = quickInputService;
        this.allowedExtensionsService = allowedExtensionsService;
        this.localExtensions = null;
        this.remoteExtensions = null;
        this.webExtensions = null;
        this.extensionsServers = [];
        this._onChange = this._register(new Emitter());
        this._onDidChangeExtensionsNotification = new Emitter();
        this.onDidChangeExtensionsNotification = this._onDidChangeExtensionsNotification.event;
        this._onReset = new Emitter();
        this.installing = [];
        this.tasksInProgress = [];
        this.autoRestartListenerDisposable = this._register(new MutableDisposable());
        this.hasOutdatedExtensionsContextKey = HasOutdatedExtensionsContext.bindTo(contextKeyService);
        if (extensionManagementServerService.localExtensionManagementServer) {
            this.localExtensions = this._register(instantiationService.createInstance(Extensions, extensionManagementServerService.localExtensionManagementServer, ext => this.getExtensionState(ext), ext => this.getRuntimeState(ext), !extensionManagementServerService.remoteExtensionManagementServer));
            this._register(this.localExtensions.onChange(e => this.onDidChangeExtensions(e?.extension)));
            this._register(this.localExtensions.onReset(e => this.reset()));
            this.extensionsServers.push(this.localExtensions);
        }
        if (extensionManagementServerService.remoteExtensionManagementServer) {
            this.remoteExtensions = this._register(instantiationService.createInstance(Extensions, extensionManagementServerService.remoteExtensionManagementServer, ext => this.getExtensionState(ext), ext => this.getRuntimeState(ext), true));
            this._register(this.remoteExtensions.onChange(e => this.onDidChangeExtensions(e?.extension)));
            this._register(this.remoteExtensions.onReset(e => this.reset()));
            this.extensionsServers.push(this.remoteExtensions);
        }
        if (extensionManagementServerService.webExtensionManagementServer) {
            this.webExtensions = this._register(instantiationService.createInstance(Extensions, extensionManagementServerService.webExtensionManagementServer, ext => this.getExtensionState(ext), ext => this.getRuntimeState(ext), !(extensionManagementServerService.remoteExtensionManagementServer || extensionManagementServerService.localExtensionManagementServer)));
            this._register(this.webExtensions.onChange(e => this.onDidChangeExtensions(e?.extension)));
            this._register(this.webExtensions.onReset(e => this.reset()));
            this.extensionsServers.push(this.webExtensions);
        }
        this.updatesCheckDelayer = new ThrottledDelayer(ExtensionsWorkbenchService_1.UpdatesCheckInterval);
        this.autoUpdateDelayer = new ThrottledDelayer(1000);
        this._register(toDisposable(() => {
            this.updatesCheckDelayer.cancel();
            this.autoUpdateDelayer.cancel();
        }));
        urlService.registerHandler(this);
        this.whenInitialized = this.initialize();
    }
    async initialize() {
        // initialize local extensions
        await Promise.all([this.queryLocal(), this.extensionService.whenInstalledExtensionsRegistered()]);
        if (this._store.isDisposed) {
            return;
        }
        this.onDidChangeRunningExtensions(this.extensionService.extensions, []);
        this._register(this.extensionService.onDidChangeExtensions(({ added, removed }) => this.onDidChangeRunningExtensions(added, removed)));
        await this.lifecycleService.when(4 /* LifecyclePhase.Eventually */);
        if (this._store.isDisposed) {
            return;
        }
        this.initializeAutoUpdate();
        this.updateExtensionsNotificaiton();
        this.reportInstalledExtensionsTelemetry();
        this._register(this.storageService.onDidChangeValue(0 /* StorageScope.PROFILE */, EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY, this._store)(e => this.onDidDismissedNotificationsValueChange()));
        this._register(this.storageService.onDidChangeValue(-1 /* StorageScope.APPLICATION */, EXTENSIONS_AUTO_UPDATE_KEY, this._store)(e => this.onDidSelectedExtensionToAutoUpdateValueChange()));
        this._register(this.storageService.onDidChangeValue(-1 /* StorageScope.APPLICATION */, EXTENSIONS_DONOT_AUTO_UPDATE_KEY, this._store)(e => this.onDidSelectedExtensionToAutoUpdateValueChange()));
        this._register(Event.debounce(this.onChange, () => undefined, 100)(() => {
            this.updateExtensionsNotificaiton();
            this.reportProgressFromOtherSources();
        }));
    }
    initializeAutoUpdate() {
        // Register listeners for auto updates
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(AutoUpdateConfigurationKey)) {
                if (this.isAutoUpdateEnabled()) {
                    this.eventuallyAutoUpdateExtensions();
                }
            }
            if (e.affectsConfiguration(AutoCheckUpdatesConfigurationKey)) {
                if (this.isAutoCheckUpdatesEnabled()) {
                    this.checkForUpdates(`Enabled auto check updates`);
                }
            }
        }));
        this._register(this.extensionEnablementService.onEnablementChanged(platformExtensions => {
            if (this.getAutoUpdateValue() === 'onlyEnabledExtensions' && platformExtensions.some(e => this.extensionEnablementService.isEnabled(e))) {
                this.checkForUpdates('Extension enablement changed');
            }
        }));
        this._register(Event.debounce(this.onChange, () => undefined, 100)(() => this.hasOutdatedExtensionsContextKey.set(this.outdated.length > 0)));
        this._register(this.updateService.onStateChange(e => {
            if ((e.type === "checking for updates" /* StateType.CheckingForUpdates */ && e.explicit) || e.type === "available for download" /* StateType.AvailableForDownload */ || e.type === "downloaded" /* StateType.Downloaded */) {
                this.telemetryService.publicLog2('extensions:updatecheckonproductupdate');
                if (this.isAutoCheckUpdatesEnabled()) {
                    this.checkForUpdates('Product update');
                }
            }
        }));
        this._register(this.allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => {
            if (this.isAutoCheckUpdatesEnabled()) {
                this.checkForUpdates('Allowed extensions changed');
            }
        }));
        // Update AutoUpdate Contexts
        this.hasOutdatedExtensionsContextKey.set(this.outdated.length > 0);
        // Check for updates
        this.eventuallyCheckForUpdates(true);
        if (isWeb) {
            this.syncPinnedBuiltinExtensions();
            // Always auto update builtin extensions in web
            if (!this.isAutoUpdateEnabled()) {
                this.autoUpdateBuiltinExtensions();
            }
        }
        this.registerAutoRestartListener();
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(AutoRestartConfigurationKey)) {
                this.registerAutoRestartListener();
            }
        }));
    }
    isAutoUpdateEnabled() {
        return this.getAutoUpdateValue() !== false;
    }
    getAutoUpdateValue() {
        const autoUpdate = this.configurationService.getValue(AutoUpdateConfigurationKey);
        if (autoUpdate === 'onlySelectedExtensions') {
            return false;
        }
        return isBoolean(autoUpdate) || autoUpdate === 'onlyEnabledExtensions' ? autoUpdate : true;
    }
    async updateAutoUpdateForAllExtensions(isAutoUpdateEnabled) {
        const wasAutoUpdateEnabled = this.isAutoUpdateEnabled();
        if (wasAutoUpdateEnabled === isAutoUpdateEnabled) {
            return;
        }
        const result = await this.dialogService.confirm({
            title: nls.localize('confirmEnableDisableAutoUpdate', "Auto Update Extensions"),
            message: isAutoUpdateEnabled
                ? nls.localize('confirmEnableAutoUpdate', "Do you want to enable auto update for all extensions?")
                : nls.localize('confirmDisableAutoUpdate', "Do you want to disable auto update for all extensions?"),
            detail: nls.localize('confirmEnableDisableAutoUpdateDetail', "This will reset any auto update settings you have set for individual extensions."),
        });
        if (!result.confirmed) {
            return;
        }
        // Reset extensions enabled for auto update first to prevent them from being updated
        this.setEnabledAutoUpdateExtensions([]);
        await this.configurationService.updateValue(AutoUpdateConfigurationKey, isAutoUpdateEnabled);
        this.setDisabledAutoUpdateExtensions([]);
        await this.updateExtensionsPinnedState(!isAutoUpdateEnabled);
        this._onChange.fire(undefined);
    }
    registerAutoRestartListener() {
        this.autoRestartListenerDisposable.value = undefined;
        if (this.configurationService.getValue(AutoRestartConfigurationKey) === true) {
            this.autoRestartListenerDisposable.value = this.hostService.onDidChangeFocus(focus => {
                if (!focus && this.configurationService.getValue(AutoRestartConfigurationKey) === true) {
                    this.updateRunningExtensions(true);
                }
            });
        }
    }
    reportInstalledExtensionsTelemetry() {
        const extensionIds = this.installed.filter(extension => !extension.isBuiltin &&
            (extension.enablementState === 12 /* EnablementState.EnabledWorkspace */ ||
                extension.enablementState === 11 /* EnablementState.EnabledGlobally */))
            .map(extension => ExtensionIdentifier.toKey(extension.identifier.id));
        this.telemetryService.publicLog2('installedExtensions', { extensionIds: new TelemetryTrustedValue(extensionIds.join(';')), count: extensionIds.length });
    }
    async onDidChangeRunningExtensions(added, removed) {
        const changedExtensions = [];
        const extensionsToFetch = [];
        for (const desc of added) {
            const extension = this.installed.find(e => areSameExtensions({ id: desc.identifier.value, uuid: desc.uuid }, e.identifier));
            if (extension) {
                changedExtensions.push(extension);
            }
            else {
                extensionsToFetch.push(desc);
            }
        }
        const workspaceExtensions = [];
        for (const desc of removed) {
            if (this.workspaceContextService.isInsideWorkspace(desc.extensionLocation)) {
                workspaceExtensions.push(desc);
            }
            else {
                extensionsToFetch.push(desc);
            }
        }
        if (extensionsToFetch.length) {
            const extensions = await this.getExtensions(extensionsToFetch.map(e => ({ id: e.identifier.value, uuid: e.uuid })), CancellationToken.None);
            changedExtensions.push(...extensions);
        }
        if (workspaceExtensions.length) {
            const extensions = await this.getResourceExtensions(workspaceExtensions.map(e => e.extensionLocation), true);
            changedExtensions.push(...extensions);
        }
        for (const changedExtension of changedExtensions) {
            this._onChange.fire(changedExtension);
        }
    }
    updateExtensionsPinnedState(pinned) {
        return this.progressService.withProgress({
            location: 5 /* ProgressLocation.Extensions */,
            title: nls.localize('updatingExtensions', "Updating Extensions Auto Update State"),
        }, () => this.extensionManagementService.resetPinnedStateForAllUserExtensions(pinned));
    }
    reset() {
        for (const task of this.tasksInProgress) {
            task.cancel();
        }
        this.tasksInProgress = [];
        this.installing = [];
        this.onDidChangeExtensions();
        this._onReset.fire();
    }
    onDidChangeExtensions(extension) {
        this._installed = undefined;
        this._local = undefined;
        this._onChange.fire(extension);
    }
    get local() {
        if (!this._local) {
            if (this.extensionsServers.length === 1) {
                this._local = this.installed;
            }
            else {
                this._local = [];
                const byId = groupByExtension(this.installed, r => r.identifier);
                for (const extensions of byId) {
                    this._local.push(this.getPrimaryExtension(extensions));
                }
            }
        }
        return this._local;
    }
    get installed() {
        if (!this._installed) {
            this._installed = [];
            for (const extensions of this.extensionsServers) {
                for (const extension of extensions.local) {
                    this._installed.push(extension);
                }
            }
        }
        return this._installed;
    }
    get outdated() {
        return this.installed.filter(e => e.outdated && e.local && e.state === 1 /* ExtensionState.Installed */);
    }
    async queryLocal(server) {
        if (server) {
            if (this.localExtensions && this.extensionManagementServerService.localExtensionManagementServer === server) {
                return this.localExtensions.queryInstalled(this.getProductVersion());
            }
            if (this.remoteExtensions && this.extensionManagementServerService.remoteExtensionManagementServer === server) {
                return this.remoteExtensions.queryInstalled(this.getProductVersion());
            }
            if (this.webExtensions && this.extensionManagementServerService.webExtensionManagementServer === server) {
                return this.webExtensions.queryInstalled(this.getProductVersion());
            }
        }
        if (this.localExtensions) {
            try {
                await this.localExtensions.queryInstalled(this.getProductVersion());
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        if (this.remoteExtensions) {
            try {
                await this.remoteExtensions.queryInstalled(this.getProductVersion());
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        if (this.webExtensions) {
            try {
                await this.webExtensions.queryInstalled(this.getProductVersion());
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        return this.local;
    }
    async queryGallery(arg1, arg2) {
        if (!this.galleryService.isEnabled()) {
            return singlePagePager([]);
        }
        const options = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
        const token = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;
        options.text = options.text ? this.resolveQueryText(options.text) : options.text;
        options.includePreRelease = isUndefined(options.includePreRelease) ? this.extensionManagementService.preferPreReleases : options.includePreRelease;
        const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
        const pager = await this.galleryService.query(options, token);
        this.syncInstalledExtensionsWithGallery(pager.firstPage);
        return {
            firstPage: pager.firstPage.map(gallery => this.fromGallery(gallery, extensionsControlManifest)),
            total: pager.total,
            pageSize: pager.pageSize,
            getPage: async (pageIndex, token) => {
                const page = await pager.getPage(pageIndex, token);
                this.syncInstalledExtensionsWithGallery(page);
                return page.map(gallery => this.fromGallery(gallery, extensionsControlManifest));
            }
        };
    }
    async getExtensions(extensionInfos, arg1, arg2) {
        if (!this.galleryService.isEnabled()) {
            return [];
        }
        extensionInfos.forEach(e => e.preRelease = e.preRelease ?? this.extensionManagementService.preferPreReleases);
        const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
        const galleryExtensions = await this.galleryService.getExtensions(extensionInfos, arg1, arg2);
        this.syncInstalledExtensionsWithGallery(galleryExtensions);
        return galleryExtensions.map(gallery => this.fromGallery(gallery, extensionsControlManifest));
    }
    async getResourceExtensions(locations, isWorkspaceScoped) {
        const resourceExtensions = await this.extensionManagementService.getExtensions(locations);
        return resourceExtensions.map(resourceExtension => this.getInstalledExtensionMatchingLocation(resourceExtension.location)
            ?? this.instantiationService.createInstance(Extension, ext => this.getExtensionState(ext), ext => this.getRuntimeState(ext), undefined, undefined, undefined, { resourceExtension, isWorkspaceScoped }));
    }
    onDidDismissedNotificationsValueChange() {
        if (this.dismissedNotificationsValue !== this.getDismissedNotificationsValue() /* This checks if current window changed the value or not */) {
            this._dismissedNotificationsValue = undefined;
            this.updateExtensionsNotificaiton();
        }
    }
    updateExtensionsNotificaiton() {
        const computedNotificiations = this.computeExtensionsNotifications();
        const dismissedNotifications = [];
        let extensionsNotification;
        if (computedNotificiations.length) {
            // populate dismissed notifications with the ones that are still valid
            for (const dismissedNotification of this.getDismissedNotifications()) {
                if (computedNotificiations.some(e => e.key === dismissedNotification)) {
                    dismissedNotifications.push(dismissedNotification);
                }
            }
            if (!dismissedNotifications.includes(computedNotificiations[0].key)) {
                extensionsNotification = {
                    message: computedNotificiations[0].message,
                    severity: computedNotificiations[0].severity,
                    extensions: computedNotificiations[0].extensions,
                    key: computedNotificiations[0].key,
                    dismiss: () => {
                        this.setDismissedNotifications([...this.getDismissedNotifications(), computedNotificiations[0].key]);
                        this.updateExtensionsNotificaiton();
                    },
                };
            }
        }
        this.setDismissedNotifications(dismissedNotifications);
        if (this.extensionsNotification?.key !== extensionsNotification?.key) {
            this.extensionsNotification = extensionsNotification;
            this._onDidChangeExtensionsNotification.fire(this.extensionsNotification);
        }
    }
    computeExtensionsNotifications() {
        const computedNotificiations = [];
        const disallowedExtensions = this.local.filter(e => e.enablementState === 7 /* EnablementState.DisabledByAllowlist */);
        if (disallowedExtensions.length) {
            computedNotificiations.push({
                message: this.configurationService.inspect(AllowedExtensionsConfigKey).policy
                    ? nls.localize('disallowed extensions by policy', "Some extensions are disabled because they are not allowed by your system administrator.")
                    : nls.localize('disallowed extensions', "Some extensions are disabled because they are configured not to be allowed."),
                severity: Severity.Warning,
                extensions: disallowedExtensions,
                key: 'disallowedExtensions:' + disallowedExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map(e => e.identifier.id.toLowerCase()).join('-'),
            });
        }
        const invalidExtensions = this.local.filter(e => e.enablementState === 6 /* EnablementState.DisabledByInvalidExtension */ && !e.isWorkspaceScoped);
        if (invalidExtensions.length) {
            if (invalidExtensions.some(e => e.local && e.local.manifest.engines?.vscode &&
                (!isEngineValid(e.local.manifest.engines.vscode, this.productService.version, this.productService.date) || areApiProposalsCompatible([...e.local.manifest.enabledApiProposals ?? []])))) {
                computedNotificiations.push({
                    message: nls.localize('incompatibleExtensions', "Some extensions are disabled due to version incompatibility. Review and update them."),
                    severity: Severity.Warning,
                    extensions: invalidExtensions,
                    key: 'incompatibleExtensions:' + invalidExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map(e => `${e.identifier.id.toLowerCase()}@${e.local?.manifest.version}`).join('-'),
                });
            }
            else {
                computedNotificiations.push({
                    message: nls.localize('invalidExtensions', "Invalid extensions detected. Review them."),
                    severity: Severity.Warning,
                    extensions: invalidExtensions,
                    key: 'invalidExtensions:' + invalidExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map(e => `${e.identifier.id.toLowerCase()}@${e.local?.manifest.version}`).join('-'),
                });
            }
        }
        const deprecatedExtensions = this.local.filter(e => !!e.deprecationInfo && e.local && this.extensionEnablementService.isEnabled(e.local));
        if (deprecatedExtensions.length) {
            computedNotificiations.push({
                message: nls.localize('deprecated extensions', "Deprecated extensions detected. Review them and migrate to alternatives."),
                severity: Severity.Warning,
                extensions: deprecatedExtensions,
                key: 'deprecatedExtensions:' + deprecatedExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map(e => e.identifier.id.toLowerCase()).join('-'),
            });
        }
        return computedNotificiations;
    }
    getExtensionsNotification() {
        return this.extensionsNotification;
    }
    resolveQueryText(text) {
        text = text.replace(/@web/g, `tag:"${WEB_EXTENSION_TAG}"`);
        const extensionRegex = /\bext:([^\s]+)\b/g;
        if (extensionRegex.test(text)) {
            text = text.replace(extensionRegex, (m, ext) => {
                // Get curated keywords
                const lookup = this.productService.extensionKeywords || {};
                const keywords = lookup[ext] || [];
                // Get mode name
                const languageId = this.languageService.guessLanguageIdByFilepathOrFirstLine(URI.file(`.${ext}`));
                const languageName = languageId && this.languageService.getLanguageName(languageId);
                const languageTag = languageName ? ` tag:"${languageName}"` : '';
                // Construct a rich query
                return `tag:"__ext_${ext}" tag:"__ext_.${ext}" ${keywords.map(tag => `tag:"${tag}"`).join(' ')}${languageTag} tag:"${ext}"`;
            });
        }
        return text.substr(0, 350);
    }
    fromGallery(gallery, extensionsControlManifest) {
        let extension = this.getInstalledExtensionMatchingGallery(gallery);
        if (!extension) {
            extension = this.instantiationService.createInstance(Extension, ext => this.getExtensionState(ext), ext => this.getRuntimeState(ext), undefined, undefined, gallery, undefined);
            extension.setExtensionsControlManifest(extensionsControlManifest);
        }
        return extension;
    }
    getInstalledExtensionMatchingGallery(gallery) {
        for (const installed of this.local) {
            if (installed.identifier.uuid) { // Installed from Gallery
                if (installed.identifier.uuid === gallery.identifier.uuid) {
                    return installed;
                }
            }
            else if (installed.local?.source !== 'resource') {
                if (areSameExtensions(installed.identifier, gallery.identifier)) { // Installed from other sources
                    return installed;
                }
            }
        }
        return null;
    }
    getInstalledExtensionMatchingLocation(location) {
        return this.local.find(e => e.local && this.uriIdentityService.extUri.isEqualOrParent(location, e.local?.location)) ?? null;
    }
    async open(extension, options) {
        if (typeof extension === 'string') {
            const id = extension;
            extension = this.installed.find(e => areSameExtensions(e.identifier, { id })) ?? (await this.getExtensions([{ id: extension }], CancellationToken.None))[0];
        }
        if (!extension) {
            throw new Error(`Extension not found. ${extension}`);
        }
        await this.editorService.openEditor(this.instantiationService.createInstance(ExtensionsInput, extension), options, options?.sideByside ? SIDE_GROUP : ACTIVE_GROUP);
    }
    async openSearch(searchValue, preserveFoucs) {
        const viewPaneContainer = (await this.viewsService.openViewContainer(VIEWLET_ID, true))?.getViewPaneContainer();
        viewPaneContainer.search(searchValue);
        if (!preserveFoucs) {
            viewPaneContainer.focus();
        }
    }
    getExtensionRuntimeStatus(extension) {
        const extensionsStatus = this.extensionService.getExtensionsStatus();
        for (const id of Object.keys(extensionsStatus)) {
            if (areSameExtensions({ id }, extension.identifier)) {
                return extensionsStatus[id];
            }
        }
        return undefined;
    }
    async updateRunningExtensions(auto = false) {
        const toAdd = [];
        const toRemove = [];
        const extensionsToCheck = [...this.local];
        for (const extension of extensionsToCheck) {
            const runtimeState = extension.runtimeState;
            if (!runtimeState || runtimeState.action !== "restartExtensions" /* ExtensionRuntimeActionType.RestartExtensions */) {
                continue;
            }
            if (extension.state === 3 /* ExtensionState.Uninstalled */) {
                toRemove.push(extension.identifier.id);
                continue;
            }
            if (!extension.local) {
                continue;
            }
            const isEnabled = this.extensionEnablementService.isEnabled(extension.local);
            if (isEnabled) {
                const runningExtension = this.extensionService.extensions.find(e => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, extension.identifier));
                if (runningExtension) {
                    toRemove.push(runningExtension.identifier.value);
                }
                toAdd.push(extension.local);
            }
            else {
                toRemove.push(extension.identifier.id);
            }
        }
        for (const extension of this.extensionService.extensions) {
            if (extension.isUnderDevelopment) {
                continue;
            }
            if (extensionsToCheck.some(e => areSameExtensions({ id: extension.identifier.value, uuid: extension.uuid }, e.local?.identifier ?? e.identifier))) {
                continue;
            }
            // Extension is running but doesn't exist locally. Remove it from running extensions.
            toRemove.push(extension.identifier.value);
        }
        if (toAdd.length || toRemove.length) {
            if (await this.extensionService.stopExtensionHosts(nls.localize('restart', "Changing extension enablement"), auto)) {
                await this.extensionService.startExtensionHosts({ toAdd, toRemove });
                if (auto) {
                    this.notificationService.notify({
                        severity: Severity.Info,
                        message: nls.localize('extensionsAutoRestart', "Extensions were auto restarted to enable updates."),
                        priority: NotificationPriority.SILENT
                    });
                }
                this.telemetryService.publicLog2('extensions:autorestart', { count: toAdd.length + toRemove.length, auto });
            }
        }
    }
    getRuntimeState(extension) {
        const isUninstalled = extension.state === 3 /* ExtensionState.Uninstalled */;
        const runningExtension = this.extensionService.extensions.find(e => areSameExtensions({ id: e.identifier.value }, extension.identifier));
        const reloadAction = this.extensionManagementServerService.remoteExtensionManagementServer ? "reloadWindow" /* ExtensionRuntimeActionType.ReloadWindow */ : "restartExtensions" /* ExtensionRuntimeActionType.RestartExtensions */;
        const reloadActionLabel = reloadAction === "reloadWindow" /* ExtensionRuntimeActionType.ReloadWindow */ ? nls.localize('reload', "reload window") : nls.localize('restart extensions', "restart extensions");
        if (isUninstalled) {
            const canRemoveRunningExtension = runningExtension && this.extensionService.canRemoveExtension(runningExtension);
            const isSameExtensionRunning = runningExtension
                && (!extension.server || extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension)))
                && (!extension.resourceExtension || this.uriIdentityService.extUri.isEqual(extension.resourceExtension.location, runningExtension.extensionLocation));
            if (!canRemoveRunningExtension && isSameExtensionRunning && !runningExtension.isUnderDevelopment) {
                return { action: reloadAction, reason: nls.localize('postUninstallTooltip', "Please {0} to complete the uninstallation of this extension.", reloadActionLabel) };
            }
            return undefined;
        }
        if (extension.local) {
            const isSameExtensionRunning = runningExtension && extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension));
            const isEnabled = this.extensionEnablementService.isEnabled(extension.local);
            // Extension is running
            if (runningExtension) {
                if (isEnabled) {
                    // No Reload is required if extension can run without reload
                    if (this.extensionService.canAddExtension(toExtensionDescription(extension.local))) {
                        return undefined;
                    }
                    const runningExtensionServer = this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension));
                    if (isSameExtensionRunning) {
                        // Different version or target platform of same extension is running. Requires reload to run the current version
                        if (!runningExtension.isUnderDevelopment && (extension.version !== runningExtension.version || extension.local.targetPlatform !== runningExtension.targetPlatform)) {
                            const productCurrentVersion = this.getProductCurrentVersion();
                            const productUpdateVersion = this.getProductUpdateVersion();
                            if (productUpdateVersion
                                && !isEngineValid(extension.local.manifest.engines.vscode, productCurrentVersion.version, productCurrentVersion.date)
                                && isEngineValid(extension.local.manifest.engines.vscode, productUpdateVersion.version, productUpdateVersion.date)) {
                                const state = this.updateService.state;
                                if (state.type === "available for download" /* StateType.AvailableForDownload */) {
                                    return { action: "downloadUpdate" /* ExtensionRuntimeActionType.DownloadUpdate */, reason: nls.localize('postUpdateDownloadTooltip', "Please update {0} to enable the updated extension.", this.productService.nameLong) };
                                }
                                if (state.type === "downloaded" /* StateType.Downloaded */) {
                                    return { action: "applyUpdate" /* ExtensionRuntimeActionType.ApplyUpdate */, reason: nls.localize('postUpdateUpdateTooltip', "Please update {0} to enable the updated extension.", this.productService.nameLong) };
                                }
                                if (state.type === "ready" /* StateType.Ready */) {
                                    return { action: "quitAndInstall" /* ExtensionRuntimeActionType.QuitAndInstall */, reason: nls.localize('postUpdateRestartTooltip', "Please restart {0} to enable the updated extension.", this.productService.nameLong) };
                                }
                                return undefined;
                            }
                            return { action: reloadAction, reason: nls.localize('postUpdateTooltip', "Please {0} to enable the updated extension.", reloadActionLabel) };
                        }
                        if (this.extensionsServers.length > 1) {
                            const extensionInOtherServer = this.installed.filter(e => areSameExtensions(e.identifier, extension.identifier) && e.server !== extension.server)[0];
                            if (extensionInOtherServer) {
                                // This extension prefers to run on UI/Local side but is running in remote
                                if (runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnUI(extension.local.manifest) && extensionInOtherServer.server === this.extensionManagementServerService.localExtensionManagementServer) {
                                    return { action: reloadAction, reason: nls.localize('enable locally', "Please {0} to enable this extension locally.", reloadActionLabel) };
                                }
                                // This extension prefers to run on Workspace/Remote side but is running in local
                                if (runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(extension.local.manifest) && extensionInOtherServer.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
                                    return { action: reloadAction, reason: nls.localize('enable remote', "Please {0} to enable this extension in {1}.", reloadActionLabel, this.extensionManagementServerService.remoteExtensionManagementServer?.label) };
                                }
                            }
                        }
                    }
                    else {
                        if (extension.server === this.extensionManagementServerService.localExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer) {
                            // This extension prefers to run on UI/Local side but is running in remote
                            if (this.extensionManifestPropertiesService.prefersExecuteOnUI(extension.local.manifest)) {
                                return { action: reloadAction, reason: nls.localize('postEnableTooltip', "Please {0} to enable this extension.", reloadActionLabel) };
                            }
                        }
                        if (extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer) {
                            // This extension prefers to run on Workspace/Remote side but is running in local
                            if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(extension.local.manifest)) {
                                return { action: reloadAction, reason: nls.localize('postEnableTooltip', "Please {0} to enable this extension.", reloadActionLabel) };
                            }
                        }
                    }
                    return undefined;
                }
                else {
                    if (isSameExtensionRunning) {
                        return { action: reloadAction, reason: nls.localize('postDisableTooltip', "Please {0} to disable this extension.", reloadActionLabel) };
                    }
                }
                return undefined;
            }
            // Extension is not running
            else {
                if (isEnabled && !this.extensionService.canAddExtension(toExtensionDescription(extension.local))) {
                    return { action: reloadAction, reason: nls.localize('postEnableTooltip', "Please {0} to enable this extension.", reloadActionLabel) };
                }
                const otherServer = extension.server ? extension.server === this.extensionManagementServerService.localExtensionManagementServer ? this.extensionManagementServerService.remoteExtensionManagementServer : this.extensionManagementServerService.localExtensionManagementServer : null;
                if (otherServer && extension.enablementState === 1 /* EnablementState.DisabledByExtensionKind */) {
                    const extensionInOtherServer = this.local.filter(e => areSameExtensions(e.identifier, extension.identifier) && e.server === otherServer)[0];
                    // Same extension in other server exists and
                    if (extensionInOtherServer && extensionInOtherServer.local && this.extensionEnablementService.isEnabled(extensionInOtherServer.local)) {
                        return { action: reloadAction, reason: nls.localize('postEnableTooltip', "Please {0} to enable this extension.", reloadActionLabel) };
                    }
                }
            }
        }
        return undefined;
    }
    getPrimaryExtension(extensions) {
        if (extensions.length === 1) {
            return extensions[0];
        }
        const enabledExtensions = extensions.filter(e => e.local && this.extensionEnablementService.isEnabled(e.local));
        if (enabledExtensions.length === 1) {
            return enabledExtensions[0];
        }
        const extensionsToChoose = enabledExtensions.length ? enabledExtensions : extensions;
        const manifest = extensionsToChoose.find(e => e.local && e.local.manifest)?.local?.manifest;
        // Manifest is not found which should not happen.
        // In which case return the first extension.
        if (!manifest) {
            return extensionsToChoose[0];
        }
        const extensionKinds = this.extensionManifestPropertiesService.getExtensionKind(manifest);
        let extension = extensionsToChoose.find(extension => {
            for (const extensionKind of extensionKinds) {
                switch (extensionKind) {
                    case 'ui':
                        /* UI extension is chosen only if it is installed locally */
                        if (extension.server === this.extensionManagementServerService.localExtensionManagementServer) {
                            return true;
                        }
                        return false;
                    case 'workspace':
                        /* Choose remote workspace extension if exists */
                        if (extension.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
                            return true;
                        }
                        return false;
                    case 'web':
                        /* Choose web extension if exists */
                        if (extension.server === this.extensionManagementServerService.webExtensionManagementServer) {
                            return true;
                        }
                        return false;
                }
            }
            return false;
        });
        if (!extension && this.extensionManagementServerService.localExtensionManagementServer) {
            extension = extensionsToChoose.find(extension => {
                for (const extensionKind of extensionKinds) {
                    switch (extensionKind) {
                        case 'workspace':
                            /* Choose local workspace extension if exists */
                            if (extension.server === this.extensionManagementServerService.localExtensionManagementServer) {
                                return true;
                            }
                            return false;
                        case 'web':
                            /* Choose local web extension if exists */
                            if (extension.server === this.extensionManagementServerService.localExtensionManagementServer) {
                                return true;
                            }
                            return false;
                    }
                }
                return false;
            });
        }
        if (!extension && this.extensionManagementServerService.webExtensionManagementServer) {
            extension = extensionsToChoose.find(extension => {
                for (const extensionKind of extensionKinds) {
                    switch (extensionKind) {
                        case 'web':
                            /* Choose web extension if exists */
                            if (extension.server === this.extensionManagementServerService.webExtensionManagementServer) {
                                return true;
                            }
                            return false;
                    }
                }
                return false;
            });
        }
        if (!extension && this.extensionManagementServerService.remoteExtensionManagementServer) {
            extension = extensionsToChoose.find(extension => {
                for (const extensionKind of extensionKinds) {
                    switch (extensionKind) {
                        case 'web':
                            /* Choose remote web extension if exists */
                            if (extension.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
                                return true;
                            }
                            return false;
                    }
                }
                return false;
            });
        }
        return extension || extensions[0];
    }
    getExtensionState(extension) {
        if (this.installing.some(i => areSameExtensions(i.identifier, extension.identifier) && (!extension.server || i.server === extension.server))) {
            return 0 /* ExtensionState.Installing */;
        }
        if (this.remoteExtensions) {
            const state = this.remoteExtensions.getExtensionState(extension);
            if (state !== 3 /* ExtensionState.Uninstalled */) {
                return state;
            }
        }
        if (this.webExtensions) {
            const state = this.webExtensions.getExtensionState(extension);
            if (state !== 3 /* ExtensionState.Uninstalled */) {
                return state;
            }
        }
        if (this.localExtensions) {
            return this.localExtensions.getExtensionState(extension);
        }
        return 3 /* ExtensionState.Uninstalled */;
    }
    async checkForUpdates(reason, onlyBuiltin) {
        if (reason) {
            this.logService.trace(`[Extensions]: Checking for updates. Reason: ${reason}`);
        }
        else {
            this.logService.trace(`[Extensions]: Checking for updates`);
        }
        if (!this.galleryService.isEnabled()) {
            return;
        }
        const extensions = [];
        if (this.localExtensions) {
            extensions.push(this.localExtensions);
        }
        if (this.remoteExtensions) {
            extensions.push(this.remoteExtensions);
        }
        if (this.webExtensions) {
            extensions.push(this.webExtensions);
        }
        if (!extensions.length) {
            return;
        }
        const infos = [];
        for (const installed of this.local) {
            if (onlyBuiltin && !installed.isBuiltin) {
                // Skip if check updates only for builtin extensions and current extension is not builtin.
                continue;
            }
            if (installed.isBuiltin && !installed.local?.pinned && (installed.type === 0 /* ExtensionType.System */ || !installed.local?.identifier.uuid)) {
                // Skip checking updates for a builtin extension if it is a system extension or if it does not has Marketplace identifier
                continue;
            }
            if (installed.local?.source === 'resource') {
                continue;
            }
            infos.push({ ...installed.identifier, preRelease: !!installed.local?.preRelease });
        }
        if (infos.length) {
            const targetPlatform = await extensions[0].server.extensionManagementService.getTargetPlatform();
            this.telemetryService.publicLog2('galleryService:checkingForUpdates', {
                count: infos.length,
            });
            this.logService.trace(`Checking updates for extensions`, infos.map(e => e.id).join(', '));
            const galleryExtensions = await this.galleryService.getExtensions(infos, { targetPlatform, compatible: true, productVersion: this.getProductVersion(), updateCheck: true }, CancellationToken.None);
            if (galleryExtensions.length) {
                await this.syncInstalledExtensionsWithGallery(galleryExtensions, infos);
            }
        }
    }
    async updateAll() {
        const toUpdate = [];
        this.outdated.forEach((extension) => {
            if (extension.gallery) {
                toUpdate.push({
                    extension: extension.gallery,
                    options: {
                        operation: 3 /* InstallOperation.Update */,
                        installPreReleaseVersion: extension.local?.isPreReleaseVersion,
                        profileLocation: this.userDataProfileService.currentProfile.extensionsResource,
                        isApplicationScoped: extension.local?.isApplicationScoped,
                        context: { [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true }
                    }
                });
            }
        });
        return this.extensionManagementService.installGalleryExtensions(toUpdate);
    }
    async downloadVSIX(extensionId, versionKind) {
        let version;
        if (versionKind === 'any') {
            version = await this.pickVersionToDownload(extensionId);
            if (!version) {
                return;
            }
        }
        const extensionInfo = version ? { id: extensionId, version } : { id: extensionId, preRelease: versionKind === 'prerelease' };
        const queryOptions = version ? {} : { compatible: true };
        let [galleryExtension] = await this.galleryService.getExtensions([extensionInfo], queryOptions, CancellationToken.None);
        if (!galleryExtension) {
            throw new Error(nls.localize('extension not found', "Extension '{0}' not found.", extensionId));
        }
        let targetPlatform = galleryExtension.properties.targetPlatform;
        const options = [];
        for (const targetPlatform of galleryExtension.allTargetPlatforms) {
            if (targetPlatform !== "unknown" /* TargetPlatform.UNKNOWN */ && targetPlatform !== "universal" /* TargetPlatform.UNIVERSAL */) {
                options.push({
                    label: targetPlatform === "undefined" /* TargetPlatform.UNDEFINED */ ? nls.localize('allplatforms', "All Platforms") : TargetPlatformToString(targetPlatform),
                    id: targetPlatform
                });
            }
        }
        if (options.length > 1) {
            const message = nls.localize('platform placeholder', "Please select the platform for which you want to download the VSIX");
            const option = await this.quickInputService.pick(options.sort((a, b) => a.label.localeCompare(b.label)), { placeHolder: message });
            if (!option) {
                return;
            }
            targetPlatform = option.id;
        }
        if (targetPlatform !== galleryExtension.properties.targetPlatform) {
            [galleryExtension] = await this.galleryService.getExtensions([extensionInfo], { ...queryOptions, targetPlatform }, CancellationToken.None);
        }
        const result = await this.fileDialogService.showOpenDialog({
            title: nls.localize('download title', "Select folder to download the VSIX"),
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: nls.localize('download', "Download"),
        });
        if (!result?.[0]) {
            return;
        }
        this.progressService.withProgress({ location: 15 /* ProgressLocation.Notification */ }, async (progress) => {
            progress.report({ message: nls.localize('downloading...', "Downloading VSIX...") });
            const name = `${galleryExtension.identifier.id}-${galleryExtension.version}${targetPlatform !== "undefined" /* TargetPlatform.UNDEFINED */ && targetPlatform !== "universal" /* TargetPlatform.UNIVERSAL */ && targetPlatform !== "unknown" /* TargetPlatform.UNKNOWN */ ? `-${targetPlatform}` : ''}.vsix`;
            await this.galleryService.download(galleryExtension, this.uriIdentityService.extUri.joinPath(result[0], name), 1 /* InstallOperation.None */);
            this.notificationService.info(nls.localize('download.completed', "Successfully downloaded the VSIX"));
        });
    }
    async pickVersionToDownload(extensionId) {
        const allVersions = await this.galleryService.getAllVersions({ id: extensionId });
        if (!allVersions.length) {
            await this.dialogService.info(nls.localize('no versions', "This extension has no other versions."));
            return;
        }
        const picks = allVersions.map((v, i) => {
            return {
                id: v.version,
                label: v.version,
                description: `${fromNow(new Date(Date.parse(v.date)), true)}${v.isPreReleaseVersion ? ` (${nls.localize('pre-release', "pre-release")})` : ''}`,
                ariaLabel: `${v.isPreReleaseVersion ? 'Pre-Release version' : 'Release version'} ${v.version}`,
            };
        });
        const pick = await this.quickInputService.pick(picks, {
            placeHolder: nls.localize('selectVersion', "Select Version to Download"),
            matchOnDetail: true
        });
        return pick?.id;
    }
    async syncInstalledExtensionsWithGallery(gallery, flagExtensionsMissingFromGallery) {
        const extensions = [];
        if (this.localExtensions) {
            extensions.push(this.localExtensions);
        }
        if (this.remoteExtensions) {
            extensions.push(this.remoteExtensions);
        }
        if (this.webExtensions) {
            extensions.push(this.webExtensions);
        }
        if (!extensions.length) {
            return;
        }
        await Promise.allSettled(extensions.map(extensions => extensions.syncInstalledExtensionsWithGallery(gallery, this.getProductVersion(), flagExtensionsMissingFromGallery)));
        if (this.outdated.length) {
            this.logService.info(`Auto updating outdated extensions.`, this.outdated.map(e => e.identifier.id).join(', '));
            this.eventuallyAutoUpdateExtensions();
        }
    }
    isAutoCheckUpdatesEnabled() {
        return this.configurationService.getValue(AutoCheckUpdatesConfigurationKey);
    }
    eventuallyCheckForUpdates(immediate = false) {
        this.updatesCheckDelayer.cancel();
        this.updatesCheckDelayer.trigger(async () => {
            if (this.isAutoCheckUpdatesEnabled()) {
                await this.checkForUpdates();
            }
            this.eventuallyCheckForUpdates();
        }, immediate ? 0 : this.getUpdatesCheckInterval()).then(undefined, err => null);
    }
    getUpdatesCheckInterval() {
        if (this.productService.quality === 'insider' && this.getProductUpdateVersion()) {
            return 1000 * 60 * 60 * 1; // 1 hour
        }
        return ExtensionsWorkbenchService_1.UpdatesCheckInterval;
    }
    eventuallyAutoUpdateExtensions() {
        this.autoUpdateDelayer.trigger(() => this.autoUpdateExtensions())
            .then(undefined, err => null);
    }
    async autoUpdateBuiltinExtensions() {
        await this.checkForUpdates(undefined, true);
        const toUpdate = this.outdated.filter(e => e.isBuiltin);
        await Promises.settled(toUpdate.map(e => this.install(e, e.local?.preRelease ? { installPreReleaseVersion: true } : undefined)));
    }
    async syncPinnedBuiltinExtensions() {
        const infos = [];
        for (const installed of this.local) {
            if (installed.isBuiltin && installed.local?.pinned && installed.local?.identifier.uuid) {
                infos.push({ ...installed.identifier, version: installed.version });
            }
        }
        if (infos.length) {
            const galleryExtensions = await this.galleryService.getExtensions(infos, CancellationToken.None);
            if (galleryExtensions.length) {
                await this.syncInstalledExtensionsWithGallery(galleryExtensions);
            }
        }
    }
    async autoUpdateExtensions() {
        const toUpdate = [];
        const disabledAutoUpdate = [];
        const consentRequired = [];
        for (const extension of this.outdated) {
            if (!this.shouldAutoUpdateExtension(extension)) {
                disabledAutoUpdate.push(extension.identifier.id);
                continue;
            }
            if (await this.shouldRequireConsentToUpdate(extension)) {
                consentRequired.push(extension.identifier.id);
                continue;
            }
            toUpdate.push(extension);
        }
        if (disabledAutoUpdate.length) {
            this.logService.trace('Auto update disabled for extensions', disabledAutoUpdate.join(', '));
        }
        if (consentRequired.length) {
            this.logService.info('Auto update consent required for extensions', consentRequired.join(', '));
        }
        if (!toUpdate.length) {
            return;
        }
        const productVersion = this.getProductVersion();
        await Promises.settled(toUpdate.map(e => this.install(e, e.local?.preRelease ? { installPreReleaseVersion: true, productVersion } : { productVersion })));
    }
    getProductVersion() {
        return this.getProductUpdateVersion() ?? this.getProductCurrentVersion();
    }
    getProductCurrentVersion() {
        return { version: this.productService.version, date: this.productService.date };
    }
    getProductUpdateVersion() {
        switch (this.updateService.state.type) {
            case "available for download" /* StateType.AvailableForDownload */:
            case "downloaded" /* StateType.Downloaded */:
            case "updating" /* StateType.Updating */:
            case "ready" /* StateType.Ready */: {
                const version = this.updateService.state.update.productVersion;
                if (version && semver.valid(version)) {
                    return { version, date: this.updateService.state.update.timestamp ? new Date(this.updateService.state.update.timestamp).toISOString() : undefined };
                }
            }
        }
        return undefined;
    }
    shouldAutoUpdateExtension(extension) {
        if (extension.deprecationInfo?.disallowInstall) {
            return false;
        }
        const autoUpdateValue = this.getAutoUpdateValue();
        if (autoUpdateValue === false) {
            const extensionsToAutoUpdate = this.getEnabledAutoUpdateExtensions();
            const extensionId = extension.identifier.id.toLowerCase();
            if (extensionsToAutoUpdate.includes(extensionId)) {
                return true;
            }
            if (this.isAutoUpdateEnabledForPublisher(extension.publisher) && !extensionsToAutoUpdate.includes(`-${extensionId}`)) {
                return true;
            }
            return false;
        }
        if (extension.pinned) {
            return false;
        }
        const disabledAutoUpdateExtensions = this.getDisabledAutoUpdateExtensions();
        if (disabledAutoUpdateExtensions.includes(extension.identifier.id.toLowerCase())) {
            return false;
        }
        if (autoUpdateValue === true) {
            return true;
        }
        if (autoUpdateValue === 'onlyEnabledExtensions') {
            return extension.enablementState !== 9 /* EnablementState.DisabledGlobally */ && extension.enablementState !== 10 /* EnablementState.DisabledWorkspace */;
        }
        return false;
    }
    async shouldRequireConsentToUpdate(extension) {
        if (!extension.outdated) {
            return;
        }
        if (!extension.gallery || !extension.local) {
            return;
        }
        if (extension.local.identifier.uuid && extension.local.identifier.uuid !== extension.gallery.identifier.uuid) {
            return nls.localize('consentRequiredToUpdateRepublishedExtension', "The marketplace metadata of this extension changed, likely due to a re-publish.");
        }
        if (!extension.local.manifest.engines.vscode || extension.local.manifest.main || extension.local.manifest.browser) {
            return;
        }
        if (isDefined(extension.gallery.properties?.executesCode)) {
            if (!extension.gallery.properties.executesCode) {
                return;
            }
        }
        else {
            const manifest = extension instanceof Extension
                ? await extension.getGalleryManifest()
                : await this.galleryService.getManifest(extension.gallery, CancellationToken.None);
            if (!manifest?.main && !manifest?.browser) {
                return;
            }
        }
        return nls.localize('consentRequiredToUpdate', "The update for {0} extension introduces executable code, which is not present in the currently installed version.", extension.displayName);
    }
    isAutoUpdateEnabledFor(extensionOrPublisher) {
        if (isString(extensionOrPublisher)) {
            if (EXTENSION_IDENTIFIER_REGEX.test(extensionOrPublisher)) {
                throw new Error('Expected publisher string, found extension identifier');
            }
            if (this.isAutoUpdateEnabled()) {
                return true;
            }
            return this.isAutoUpdateEnabledForPublisher(extensionOrPublisher);
        }
        return this.shouldAutoUpdateExtension(extensionOrPublisher);
    }
    isAutoUpdateEnabledForPublisher(publisher) {
        const publishersToAutoUpdate = this.getPublishersToAutoUpdate();
        return publishersToAutoUpdate.includes(publisher.toLowerCase());
    }
    async updateAutoUpdateEnablementFor(extensionOrPublisher, enable) {
        if (this.isAutoUpdateEnabled()) {
            if (isString(extensionOrPublisher)) {
                throw new Error('Expected extension, found publisher string');
            }
            const disabledAutoUpdateExtensions = this.getDisabledAutoUpdateExtensions();
            const extensionId = extensionOrPublisher.identifier.id.toLowerCase();
            const extensionIndex = disabledAutoUpdateExtensions.indexOf(extensionId);
            if (enable) {
                if (extensionIndex !== -1) {
                    disabledAutoUpdateExtensions.splice(extensionIndex, 1);
                }
            }
            else {
                if (extensionIndex === -1) {
                    disabledAutoUpdateExtensions.push(extensionId);
                }
            }
            this.setDisabledAutoUpdateExtensions(disabledAutoUpdateExtensions);
            if (enable && extensionOrPublisher.local && extensionOrPublisher.pinned) {
                await this.extensionManagementService.updateMetadata(extensionOrPublisher.local, { pinned: false });
            }
            this._onChange.fire(extensionOrPublisher);
        }
        else {
            const enabledAutoUpdateExtensions = this.getEnabledAutoUpdateExtensions();
            if (isString(extensionOrPublisher)) {
                if (EXTENSION_IDENTIFIER_REGEX.test(extensionOrPublisher)) {
                    throw new Error('Expected publisher string, found extension identifier');
                }
                extensionOrPublisher = extensionOrPublisher.toLowerCase();
                if (this.isAutoUpdateEnabledFor(extensionOrPublisher) !== enable) {
                    if (enable) {
                        enabledAutoUpdateExtensions.push(extensionOrPublisher);
                    }
                    else {
                        if (enabledAutoUpdateExtensions.includes(extensionOrPublisher)) {
                            enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(extensionOrPublisher), 1);
                        }
                    }
                }
                this.setEnabledAutoUpdateExtensions(enabledAutoUpdateExtensions);
                for (const e of this.installed) {
                    if (e.publisher.toLowerCase() === extensionOrPublisher) {
                        this._onChange.fire(e);
                    }
                }
            }
            else {
                const extensionId = extensionOrPublisher.identifier.id.toLowerCase();
                const enableAutoUpdatesForPublisher = this.isAutoUpdateEnabledFor(extensionOrPublisher.publisher.toLowerCase());
                const enableAutoUpdatesForExtension = enabledAutoUpdateExtensions.includes(extensionId);
                const disableAutoUpdatesForExtension = enabledAutoUpdateExtensions.includes(`-${extensionId}`);
                if (enable) {
                    if (disableAutoUpdatesForExtension) {
                        enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(`-${extensionId}`), 1);
                    }
                    if (enableAutoUpdatesForPublisher) {
                        if (enableAutoUpdatesForExtension) {
                            enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(extensionId), 1);
                        }
                    }
                    else {
                        if (!enableAutoUpdatesForExtension) {
                            enabledAutoUpdateExtensions.push(extensionId);
                        }
                    }
                }
                // Disable Auto Updates
                else {
                    if (enableAutoUpdatesForExtension) {
                        enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(extensionId), 1);
                    }
                    if (enableAutoUpdatesForPublisher) {
                        if (!disableAutoUpdatesForExtension) {
                            enabledAutoUpdateExtensions.push(`-${extensionId}`);
                        }
                    }
                    else {
                        if (disableAutoUpdatesForExtension) {
                            enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(`-${extensionId}`), 1);
                        }
                    }
                }
                this.setEnabledAutoUpdateExtensions(enabledAutoUpdateExtensions);
                this._onChange.fire(extensionOrPublisher);
            }
        }
        if (enable) {
            this.autoUpdateExtensions();
        }
    }
    onDidSelectedExtensionToAutoUpdateValueChange() {
        if (this.enabledAuotUpdateExtensionsValue !== this.getEnabledAutoUpdateExtensionsValue() /* This checks if current window changed the value or not */
            || this.disabledAutoUpdateExtensionsValue !== this.getDisabledAutoUpdateExtensionsValue() /* This checks if current window changed the value or not */) {
            const userExtensions = this.installed.filter(e => !e.isBuiltin);
            const groupBy = (extensions) => {
                const shouldAutoUpdate = [];
                const shouldNotAutoUpdate = [];
                for (const extension of extensions) {
                    if (this.shouldAutoUpdateExtension(extension)) {
                        shouldAutoUpdate.push(extension);
                    }
                    else {
                        shouldNotAutoUpdate.push(extension);
                    }
                }
                return [shouldAutoUpdate, shouldNotAutoUpdate];
            };
            const [wasShouldAutoUpdate, wasShouldNotAutoUpdate] = groupBy(userExtensions);
            this._enabledAutoUpdateExtensionsValue = undefined;
            this._disabledAutoUpdateExtensionsValue = undefined;
            const [shouldAutoUpdate, shouldNotAutoUpdate] = groupBy(userExtensions);
            for (const e of wasShouldAutoUpdate ?? []) {
                if (shouldNotAutoUpdate?.includes(e)) {
                    this._onChange.fire(e);
                }
            }
            for (const e of wasShouldNotAutoUpdate ?? []) {
                if (shouldAutoUpdate?.includes(e)) {
                    this._onChange.fire(e);
                }
            }
        }
    }
    async canInstall(extension) {
        if (!(extension instanceof Extension)) {
            return new MarkdownString().appendText(nls.localize('not an extension', "The provided object is not an extension."));
        }
        if (extension.isMalicious) {
            return new MarkdownString().appendText(nls.localize('malicious', "This extension is reported to be problematic."));
        }
        if (extension.deprecationInfo?.disallowInstall) {
            return new MarkdownString().appendText(nls.localize('disallowed', "This extension is disallowed to be installed."));
        }
        if (extension.gallery) {
            if (!extension.gallery.isSigned && shouldRequireRepositorySignatureFor(extension.private, await this.extensionGalleryManifestService.getExtensionGalleryManifest())) {
                return new MarkdownString().appendText(nls.localize('not signed', "This extension is not signed."));
            }
            const localResult = this.localExtensions ? await this.localExtensions.canInstall(extension.gallery) : undefined;
            if (localResult === true) {
                return true;
            }
            const remoteResult = this.remoteExtensions ? await this.remoteExtensions.canInstall(extension.gallery) : undefined;
            if (remoteResult === true) {
                return true;
            }
            const webResult = this.webExtensions ? await this.webExtensions.canInstall(extension.gallery) : undefined;
            if (webResult === true) {
                return true;
            }
            return localResult ?? remoteResult ?? webResult ?? new MarkdownString().appendText(nls.localize('cannot be installed', "Cannot install the '{0}' extension because it is not available in this setup.", extension.displayName ?? extension.identifier.id));
        }
        if (extension.resourceExtension && await this.extensionManagementService.canInstall(extension.resourceExtension) === true) {
            return true;
        }
        return new MarkdownString().appendText(nls.localize('cannot be installed', "Cannot install the '{0}' extension because it is not available in this setup.", extension.displayName ?? extension.identifier.id));
    }
    async install(arg, installOptions = {}, progressLocation) {
        let installable;
        let extension;
        let servers;
        if (arg instanceof URI) {
            installable = arg;
        }
        else {
            let installableInfo;
            let gallery;
            // Install by id
            if (isString(arg)) {
                extension = this.local.find(e => areSameExtensions(e.identifier, { id: arg }));
                if (!extension?.isBuiltin) {
                    installableInfo = { id: arg, version: installOptions.version, preRelease: installOptions.installPreReleaseVersion ?? this.extensionManagementService.preferPreReleases };
                }
            }
            // Install by gallery
            else if (arg.gallery) {
                extension = arg;
                gallery = arg.gallery;
                if (installOptions.version && installOptions.version !== gallery?.version) {
                    installableInfo = { id: extension.identifier.id, version: installOptions.version };
                }
            }
            // Install by resource
            else if (arg.resourceExtension) {
                extension = arg;
                installable = arg.resourceExtension;
            }
            if (installableInfo) {
                const targetPlatform = extension?.server ? await extension.server.extensionManagementService.getTargetPlatform() : undefined;
                gallery = (await this.galleryService.getExtensions([installableInfo], { targetPlatform }, CancellationToken.None)).at(0);
            }
            if (!extension && gallery) {
                extension = this.instantiationService.createInstance(Extension, ext => this.getExtensionState(ext), ext => this.getRuntimeState(ext), undefined, undefined, gallery, undefined);
                extension.setExtensionsControlManifest(await this.extensionManagementService.getExtensionsControlManifest());
            }
            if (extension?.isMalicious) {
                throw new Error(nls.localize('malicious', "This extension is reported to be problematic."));
            }
            if (gallery) {
                // If requested to install everywhere
                // then install the extension in all the servers where it is not installed
                if (installOptions.installEverywhere) {
                    servers = [];
                    const installableServers = await this.extensionManagementService.getInstallableServers(gallery);
                    for (const extensionsServer of this.extensionsServers) {
                        if (installableServers.includes(extensionsServer.server) && !extensionsServer.local.find(e => areSameExtensions(e.identifier, gallery.identifier))) {
                            servers.push(extensionsServer.server);
                        }
                    }
                }
                // If requested to enable and extension is already installed
                // Check if the extension is disabled because of extension kind
                // If so, install the extension in the server that is compatible.
                else if (installOptions.enable && extension?.local) {
                    servers = [];
                    if (extension.enablementState === 1 /* EnablementState.DisabledByExtensionKind */) {
                        const [installableServer] = await this.extensionManagementService.getInstallableServers(gallery);
                        if (installableServer) {
                            servers.push(installableServer);
                        }
                    }
                }
            }
            if (!servers || servers.length) {
                if (!installable) {
                    if (!gallery) {
                        const id = isString(arg) ? arg : arg.identifier.id;
                        const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
                        const reportIssueUri = manifest ? getExtensionGalleryManifestResourceUri(manifest, "ContactSupportUri" /* ExtensionGalleryResourceType.ContactSupportUri */) : undefined;
                        const reportIssueMessage = reportIssueUri ? nls.localize('report issue', "If this issue persists, please report it at {0}", reportIssueUri.toString()) : '';
                        if (installOptions.version) {
                            const message = nls.localize('not found version', "The extension '{0}' cannot be installed because the requested version '{1}' was not found.", id, installOptions.version);
                            throw new ExtensionManagementError(reportIssueMessage ? `${message} ${reportIssueMessage}` : message, "NotFound" /* ExtensionManagementErrorCode.NotFound */);
                        }
                        else {
                            const message = nls.localize('not found', "The extension '{0}' cannot be installed because it was not found.", id);
                            throw new ExtensionManagementError(reportIssueMessage ? `${message} ${reportIssueMessage}` : message, "NotFound" /* ExtensionManagementErrorCode.NotFound */);
                        }
                    }
                    installable = gallery;
                }
                if (installOptions.version) {
                    installOptions.installGivenVersion = true;
                }
                if (extension?.isWorkspaceScoped) {
                    installOptions.isWorkspaceScoped = true;
                }
            }
        }
        if (installable) {
            if (installOptions.justification) {
                const syncCheck = isUndefined(installOptions.isMachineScoped) && this.userDataSyncEnablementService.isEnabled() && this.userDataSyncEnablementService.isResourceEnabled("extensions" /* SyncResource.Extensions */);
                const buttons = [];
                buttons.push({
                    label: isString(installOptions.justification) || !installOptions.justification.action
                        ? nls.localize({ key: 'installButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Install Extension")
                        : nls.localize({ key: 'installButtonLabelWithAction', comment: ['&& denotes a mnemonic'] }, "&&Install Extension and {0}", installOptions.justification.action), run: () => true
                });
                if (!extension) {
                    buttons.push({ label: nls.localize('open', "Open Extension"), run: () => { this.open(extension); return false; } });
                }
                const result = await this.dialogService.prompt({
                    title: nls.localize('installExtensionTitle', "Install Extension"),
                    message: extension ? nls.localize('installExtensionMessage', "Would you like to install '{0}' extension from '{1}'?", extension.displayName, extension.publisherDisplayName) : nls.localize('installVSIXMessage', "Would you like to install the extension?"),
                    detail: isString(installOptions.justification) ? installOptions.justification : installOptions.justification.reason,
                    cancelButton: true,
                    buttons,
                    checkbox: syncCheck ? {
                        label: nls.localize('sync extension', "Sync this extension"),
                        checked: true,
                    } : undefined,
                });
                if (!result.result) {
                    throw new CancellationError();
                }
                if (syncCheck) {
                    installOptions.isMachineScoped = !result.checkboxChecked;
                }
            }
            if (installable instanceof URI) {
                extension = await this.doInstall(undefined, () => this.installFromVSIX(installable, installOptions), progressLocation);
            }
            else if (extension) {
                if (extension.resourceExtension) {
                    extension = await this.doInstall(extension, () => this.extensionManagementService.installResourceExtension(installable, installOptions), progressLocation);
                }
                else {
                    extension = await this.doInstall(extension, () => this.installFromGallery(extension, installable, installOptions, servers), progressLocation);
                }
            }
        }
        if (!extension) {
            throw new Error(nls.localize('unknown', "Unable to install extension"));
        }
        if (installOptions.enable) {
            if (extension.enablementState === 10 /* EnablementState.DisabledWorkspace */ || extension.enablementState === 9 /* EnablementState.DisabledGlobally */) {
                if (installOptions.justification) {
                    const result = await this.dialogService.confirm({
                        title: nls.localize('enableExtensionTitle', "Enable Extension"),
                        message: nls.localize('enableExtensionMessage', "Would you like to enable '{0}' extension?", extension.displayName),
                        detail: isString(installOptions.justification) ? installOptions.justification : installOptions.justification.reason,
                        primaryButton: isString(installOptions.justification) ? nls.localize({ key: 'enableButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Enable Extension") : nls.localize({ key: 'enableButtonLabelWithAction', comment: ['&& denotes a mnemonic'] }, "&&Enable Extension and {0}", installOptions.justification.action),
                    });
                    if (!result.confirmed) {
                        throw new CancellationError();
                    }
                }
                await this.setEnablement(extension, extension.enablementState === 10 /* EnablementState.DisabledWorkspace */ ? 12 /* EnablementState.EnabledWorkspace */ : 11 /* EnablementState.EnabledGlobally */);
            }
            await this.waitUntilExtensionIsEnabled(extension);
        }
        return extension;
    }
    async installInServer(extension, server, installOptions) {
        await this.doInstall(extension, async () => {
            const local = extension.local;
            if (!local) {
                throw new Error('Extension not found');
            }
            if (!extension.gallery) {
                extension = (await this.getExtensions([{ ...extension.identifier, preRelease: local.preRelease }], CancellationToken.None))[0] ?? extension;
            }
            if (extension.gallery) {
                return server.extensionManagementService.installFromGallery(extension.gallery, { installPreReleaseVersion: local.preRelease, ...installOptions });
            }
            const targetPlatform = await server.extensionManagementService.getTargetPlatform();
            if (!isTargetPlatformCompatible(local.targetPlatform, [local.targetPlatform], targetPlatform)) {
                throw new Error(nls.localize('incompatible', "Can't install '{0}' extension because it is not compatible.", extension.identifier.id));
            }
            const vsix = await this.extensionManagementService.zip(local);
            try {
                return await server.extensionManagementService.install(vsix);
            }
            finally {
                try {
                    await this.fileService.del(vsix);
                }
                catch (error) {
                    this.logService.error(error);
                }
            }
        });
    }
    canSetLanguage(extension) {
        if (!isWeb) {
            return false;
        }
        if (!extension.gallery) {
            return false;
        }
        const locale = getLocale(extension.gallery);
        if (!locale) {
            return false;
        }
        return true;
    }
    async setLanguage(extension) {
        if (!this.canSetLanguage(extension)) {
            throw new Error('Can not set language');
        }
        const locale = getLocale(extension.gallery);
        if (locale === language) {
            return;
        }
        const localizedLanguageName = extension.gallery?.properties?.localizedLanguages?.[0];
        return this.localeService.setLocale({ id: locale, galleryExtension: extension.gallery, extensionId: extension.identifier.id, label: localizedLanguageName ?? extension.displayName });
    }
    setEnablement(extensions, enablementState) {
        extensions = Array.isArray(extensions) ? extensions : [extensions];
        return this.promptAndSetEnablement(extensions, enablementState);
    }
    async uninstall(e) {
        const extension = e.local ? e : this.local.find(local => areSameExtensions(local.identifier, e.identifier));
        if (!extension?.local) {
            throw new Error('Missing local');
        }
        if (extension.local.isApplicationScoped && this.userDataProfilesService.profiles.length > 1) {
            const { confirmed } = await this.dialogService.confirm({
                title: nls.localize('uninstallApplicationScoped', "Uninstall Extension"),
                type: Severity.Info,
                message: nls.localize('uninstallApplicationScopedMessage', "Would you like to Uninstall {0} from all profiles?", extension.displayName),
                primaryButton: nls.localize('uninstallAllProfiles', "Uninstall (All Profiles)")
            });
            if (!confirmed) {
                throw new CancellationError();
            }
        }
        const extensionsToUninstall = [{ extension: extension.local }];
        for (const packExtension of this.getAllPackedExtensions(extension, this.local)) {
            if (packExtension.local && !extensionsToUninstall.some(e => areSameExtensions(e.extension.identifier, packExtension.identifier))) {
                extensionsToUninstall.push({ extension: packExtension.local });
            }
        }
        const dependents = [];
        let extensionsFromAllProfiles;
        for (const { extension } of extensionsToUninstall) {
            const installedExtensions = [];
            if (extension.isApplicationScoped && this.userDataProfilesService.profiles.length > 1) {
                if (!extensionsFromAllProfiles) {
                    extensionsFromAllProfiles = [];
                    await Promise.allSettled(this.userDataProfilesService.profiles.map(async (profile) => {
                        const installed = await this.extensionManagementService.getInstalled(1 /* ExtensionType.User */, profile.extensionsResource);
                        for (const local of installed) {
                            extensionsFromAllProfiles?.push([local, profile.extensionsResource]);
                        }
                    }));
                }
                installedExtensions.push(...extensionsFromAllProfiles);
            }
            else {
                for (const { local } of this.local) {
                    if (local) {
                        installedExtensions.push([local, undefined]);
                    }
                }
            }
            for (const [local, profileLocation] of installedExtensions) {
                if (areSameExtensions(local.identifier, extension.identifier)) {
                    continue;
                }
                if (!local.manifest.extensionDependencies || local.manifest.extensionDependencies.length === 0) {
                    continue;
                }
                if (extension.manifest.extensionPack?.some(id => areSameExtensions({ id }, local.identifier))) {
                    continue;
                }
                if (dependents.some(d => d.manifest.extensionPack?.some(id => areSameExtensions({ id }, local.identifier)))) {
                    continue;
                }
                if (local.manifest.extensionDependencies.some(dep => areSameExtensions(extension.identifier, { id: dep }))) {
                    dependents.push(local);
                    extensionsToUninstall.push({ extension: local, options: { profileLocation } });
                }
            }
        }
        if (dependents.length) {
            const { result } = await this.dialogService.prompt({
                title: nls.localize('uninstallDependents', "Uninstall Extension with Dependents"),
                type: Severity.Warning,
                message: this.getErrorMessageForUninstallingAnExtensionWithDependents(extension, dependents),
                buttons: [{
                        label: nls.localize('uninstallAll', "Uninstall All"),
                        run: () => true
                    }],
                cancelButton: {
                    run: () => false
                }
            });
            if (!result) {
                throw new CancellationError();
            }
        }
        return this.withProgress({
            location: 5 /* ProgressLocation.Extensions */,
            title: nls.localize('uninstallingExtension', 'Uninstalling extension...'),
            source: `${extension.identifier.id}`
        }, () => this.extensionManagementService.uninstallExtensions(extensionsToUninstall).then(() => undefined));
    }
    getAllPackedExtensions(extension, installed, checked = []) {
        if (checked.some(e => areSameExtensions(e.identifier, extension.identifier))) {
            return [];
        }
        checked.push(extension);
        const extensionsPack = extension.extensionPack ?? [];
        if (extensionsPack.length) {
            const packedExtensions = [];
            for (const i of installed) {
                if (!i.isBuiltin && extensionsPack.some(id => areSameExtensions({ id }, i.identifier))) {
                    packedExtensions.push(i);
                }
            }
            const packOfPackedExtensions = [];
            for (const packedExtension of packedExtensions) {
                packOfPackedExtensions.push(...this.getAllPackedExtensions(packedExtension, installed, checked));
            }
            return [...packedExtensions, ...packOfPackedExtensions];
        }
        return [];
    }
    getErrorMessageForUninstallingAnExtensionWithDependents(extension, dependents) {
        if (dependents.length === 1) {
            return nls.localize('singleDependentUninstallError', "Cannot uninstall '{0}' extension alone. '{1}' extension depends on this. Do you want to uninstall all these extensions?", extension.displayName, dependents[0].manifest.displayName);
        }
        if (dependents.length === 2) {
            return nls.localize('twoDependentsUninstallError', "Cannot uninstall '{0}' extension alone. '{1}' and '{2}' extensions depend on this. Do you want to uninstall all these extensions?", extension.displayName, dependents[0].manifest.displayName, dependents[1].manifest.displayName);
        }
        return nls.localize('multipleDependentsUninstallError', "Cannot uninstall '{0}' extension alone. '{1}', '{2}' and other extensions depend on this. Do you want to uninstall all these extensions?", extension.displayName, dependents[0].manifest.displayName, dependents[1].manifest.displayName);
    }
    isExtensionIgnoredToSync(extension) {
        return extension.local ? !this.isInstalledExtensionSynced(extension.local)
            : this.extensionsSyncManagementService.hasToNeverSyncExtension(extension.identifier.id);
    }
    async togglePreRelease(extension) {
        if (!extension.local) {
            return;
        }
        if (extension.preRelease !== extension.isPreReleaseVersion) {
            await this.extensionManagementService.updateMetadata(extension.local, { preRelease: !extension.preRelease });
            return;
        }
        await this.install(extension, { installPreReleaseVersion: !extension.preRelease, preRelease: !extension.preRelease });
    }
    async toggleExtensionIgnoredToSync(extension) {
        const extensionsIncludingPackedExtensions = [extension, ...this.getAllPackedExtensions(extension, this.local)];
        // Updated in sync to prevent race conditions
        for (const e of extensionsIncludingPackedExtensions) {
            const isIgnored = this.isExtensionIgnoredToSync(e);
            if (e.local && isIgnored && e.local.isMachineScoped) {
                await this.extensionManagementService.updateMetadata(e.local, { isMachineScoped: false });
            }
            else {
                await this.extensionsSyncManagementService.updateIgnoredExtensions(e.identifier.id, !isIgnored);
            }
        }
        await this.userDataAutoSyncService.triggerSync(['IgnoredExtensionsUpdated']);
    }
    async toggleApplyExtensionToAllProfiles(extension) {
        const extensionsIncludingPackedExtensions = [extension, ...this.getAllPackedExtensions(extension, this.local)];
        const allExtensionServers = this.getAllExtensionServers();
        await Promise.allSettled(extensionsIncludingPackedExtensions.map(async (e) => {
            if (!e.local || isApplicationScopedExtension(e.local.manifest) || e.isBuiltin) {
                return;
            }
            const isApplicationScoped = e.local.isApplicationScoped;
            await Promise.all(allExtensionServers.map(async (extensionServer) => {
                const local = extensionServer.local.find(local => areSameExtensions(e.identifier, local.identifier))?.local;
                if (local && local.isApplicationScoped === isApplicationScoped) {
                    await this.extensionManagementService.toggleApplicationScope(local, this.userDataProfileService.currentProfile.extensionsResource);
                }
            }));
        }));
    }
    getAllExtensionServers() {
        const extensions = [];
        if (this.localExtensions) {
            extensions.push(this.localExtensions);
        }
        if (this.remoteExtensions) {
            extensions.push(this.remoteExtensions);
        }
        if (this.webExtensions) {
            extensions.push(this.webExtensions);
        }
        return extensions;
    }
    isInstalledExtensionSynced(extension) {
        if (extension.isMachineScoped) {
            return false;
        }
        if (this.extensionsSyncManagementService.hasToAlwaysSyncExtension(extension.identifier.id)) {
            return true;
        }
        return !this.extensionsSyncManagementService.hasToNeverSyncExtension(extension.identifier.id);
    }
    doInstall(extension, installTask, progressLocation) {
        const title = extension ? nls.localize('installing named extension', "Installing '{0}' extension...", extension.displayName) : nls.localize('installing extension', 'Installing extension...');
        return this.withProgress({
            location: progressLocation ?? 5 /* ProgressLocation.Extensions */,
            title
        }, async () => {
            try {
                if (extension) {
                    this.installing.push(extension);
                    this._onChange.fire(extension);
                }
                const local = await installTask();
                return await this.waitAndGetInstalledExtension(local.identifier);
            }
            finally {
                if (extension) {
                    this.installing = this.installing.filter(e => e !== extension);
                    // Trigger the change without passing the extension because it is replaced by a new instance.
                    this._onChange.fire(undefined);
                }
            }
        });
    }
    async installFromVSIX(vsix, installOptions) {
        const manifest = await this.extensionManagementService.getManifest(vsix);
        const existingExtension = this.local.find(local => areSameExtensions(local.identifier, { id: getGalleryExtensionId(manifest.publisher, manifest.name) }));
        if (existingExtension) {
            installOptions = installOptions || {};
            if (existingExtension.latestVersion === manifest.version) {
                installOptions.pinned = installOptions.pinned ?? (existingExtension.local?.pinned || !this.shouldAutoUpdateExtension(existingExtension));
            }
            else {
                installOptions.installGivenVersion = true;
            }
        }
        return this.extensionManagementService.installVSIX(vsix, manifest, installOptions);
    }
    installFromGallery(extension, gallery, installOptions, servers) {
        installOptions = installOptions ?? {};
        installOptions.pinned = installOptions.pinned ?? (extension.local?.pinned || !this.shouldAutoUpdateExtension(extension));
        if (extension.local && !servers) {
            installOptions.productVersion = this.getProductVersion();
            installOptions.operation = 3 /* InstallOperation.Update */;
            return this.extensionManagementService.updateFromGallery(gallery, extension.local, installOptions);
        }
        else {
            return this.extensionManagementService.installFromGallery(gallery, installOptions, servers);
        }
    }
    async waitAndGetInstalledExtension(identifier) {
        let installedExtension = this.local.find(local => areSameExtensions(local.identifier, identifier));
        if (!installedExtension) {
            await Event.toPromise(Event.filter(this.onChange, e => !!e && this.local.some(local => areSameExtensions(local.identifier, identifier))));
        }
        installedExtension = this.local.find(local => areSameExtensions(local.identifier, identifier));
        if (!installedExtension) {
            // This should not happen
            throw new Error('Extension should have been installed');
        }
        return installedExtension;
    }
    async waitUntilExtensionIsEnabled(extension) {
        if (this.extensionService.extensions.find(e => ExtensionIdentifier.equals(e.identifier, extension.identifier.id))) {
            return;
        }
        if (!extension.local || !this.extensionService.canAddExtension(toExtensionDescription(extension.local))) {
            return;
        }
        await new Promise((c, e) => {
            const disposable = this.extensionService.onDidChangeExtensions(() => {
                try {
                    if (this.extensionService.extensions.find(e => ExtensionIdentifier.equals(e.identifier, extension.identifier.id))) {
                        disposable.dispose();
                        c();
                    }
                }
                catch (error) {
                    e(error);
                }
            });
        });
    }
    promptAndSetEnablement(extensions, enablementState) {
        const enable = enablementState === 11 /* EnablementState.EnabledGlobally */ || enablementState === 12 /* EnablementState.EnabledWorkspace */;
        if (enable) {
            const allDependenciesAndPackedExtensions = this.getExtensionsRecursively(extensions, this.local, enablementState, { dependencies: true, pack: true });
            return this.checkAndSetEnablement(extensions, allDependenciesAndPackedExtensions, enablementState);
        }
        else {
            const packedExtensions = this.getExtensionsRecursively(extensions, this.local, enablementState, { dependencies: false, pack: true });
            if (packedExtensions.length) {
                return this.checkAndSetEnablement(extensions, packedExtensions, enablementState);
            }
            return this.checkAndSetEnablement(extensions, [], enablementState);
        }
    }
    async checkAndSetEnablement(extensions, otherExtensions, enablementState) {
        const allExtensions = [...extensions, ...otherExtensions];
        const enable = enablementState === 11 /* EnablementState.EnabledGlobally */ || enablementState === 12 /* EnablementState.EnabledWorkspace */;
        if (!enable) {
            for (const extension of extensions) {
                const dependents = this.getDependentsAfterDisablement(extension, allExtensions, this.local);
                if (dependents.length) {
                    const { result } = await this.dialogService.prompt({
                        title: nls.localize('disableDependents', "Disable Extension with Dependents"),
                        type: Severity.Warning,
                        message: this.getDependentsErrorMessageForDisablement(extension, allExtensions, dependents),
                        buttons: [{
                                label: nls.localize('disable all', 'Disable All'),
                                run: () => true
                            }],
                        cancelButton: {
                            run: () => false
                        }
                    });
                    if (!result) {
                        throw new CancellationError();
                    }
                    await this.checkAndSetEnablement(dependents, [extension], enablementState);
                }
            }
        }
        return this.doSetEnablement(allExtensions, enablementState);
    }
    getExtensionsRecursively(extensions, installed, enablementState, options, checked = []) {
        const toCheck = extensions.filter(e => checked.indexOf(e) === -1);
        if (toCheck.length) {
            for (const extension of toCheck) {
                checked.push(extension);
            }
            const extensionsToEanbleOrDisable = installed.filter(i => {
                if (checked.indexOf(i) !== -1) {
                    return false;
                }
                const enable = enablementState === 11 /* EnablementState.EnabledGlobally */ || enablementState === 12 /* EnablementState.EnabledWorkspace */;
                const isExtensionEnabled = i.enablementState === 11 /* EnablementState.EnabledGlobally */ || i.enablementState === 12 /* EnablementState.EnabledWorkspace */;
                if (enable === isExtensionEnabled) {
                    return false;
                }
                return (enable || !i.isBuiltin) // Include all Extensions for enablement and only non builtin extensions for disablement
                    && (options.dependencies || options.pack)
                    && extensions.some(extension => (options.dependencies && extension.dependencies.some(id => areSameExtensions({ id }, i.identifier)))
                        || (options.pack && extension.extensionPack.some(id => areSameExtensions({ id }, i.identifier))));
            });
            if (extensionsToEanbleOrDisable.length) {
                extensionsToEanbleOrDisable.push(...this.getExtensionsRecursively(extensionsToEanbleOrDisable, installed, enablementState, options, checked));
            }
            return extensionsToEanbleOrDisable;
        }
        return [];
    }
    getDependentsAfterDisablement(extension, extensionsToDisable, installed) {
        return installed.filter(i => {
            if (i.dependencies.length === 0) {
                return false;
            }
            if (i === extension) {
                return false;
            }
            if (!this.extensionEnablementService.isEnabledEnablementState(i.enablementState)) {
                return false;
            }
            if (extensionsToDisable.indexOf(i) !== -1) {
                return false;
            }
            return i.dependencies.some(dep => [extension, ...extensionsToDisable].some(d => areSameExtensions(d.identifier, { id: dep })));
        });
    }
    getDependentsErrorMessageForDisablement(extension, allDisabledExtensions, dependents) {
        for (const e of [extension, ...allDisabledExtensions]) {
            const dependentsOfTheExtension = dependents.filter(d => d.dependencies.some(id => areSameExtensions({ id }, e.identifier)));
            if (dependentsOfTheExtension.length) {
                return this.getErrorMessageForDisablingAnExtensionWithDependents(e, dependentsOfTheExtension);
            }
        }
        return '';
    }
    getErrorMessageForDisablingAnExtensionWithDependents(extension, dependents) {
        if (dependents.length === 1) {
            return nls.localize('singleDependentError', "Cannot disable '{0}' extension alone. '{1}' extension depends on this. Do you want to disable all these extensions?", extension.displayName, dependents[0].displayName);
        }
        if (dependents.length === 2) {
            return nls.localize('twoDependentsError', "Cannot disable '{0}' extension alone. '{1}' and '{2}' extensions depend on this. Do you want to disable all these extensions?", extension.displayName, dependents[0].displayName, dependents[1].displayName);
        }
        return nls.localize('multipleDependentsError', "Cannot disable '{0}' extension alone. '{1}', '{2}' and other extensions depend on this. Do you want to disable all these extensions?", extension.displayName, dependents[0].displayName, dependents[1].displayName);
    }
    async doSetEnablement(extensions, enablementState) {
        return await this.extensionEnablementService.setEnablement(extensions.map(e => e.local), enablementState);
    }
    reportProgressFromOtherSources() {
        if (this.installed.some(e => e.state === 0 /* ExtensionState.Installing */ || e.state === 2 /* ExtensionState.Uninstalling */)) {
            if (!this._activityCallBack) {
                this.withProgress({ location: 5 /* ProgressLocation.Extensions */ }, () => new Promise(resolve => this._activityCallBack = resolve));
            }
        }
        else {
            this._activityCallBack?.();
            this._activityCallBack = undefined;
        }
    }
    withProgress(options, task) {
        return this.progressService.withProgress(options, async () => {
            const cancelableTask = createCancelablePromise(() => task());
            this.tasksInProgress.push(cancelableTask);
            try {
                return await cancelableTask;
            }
            finally {
                const index = this.tasksInProgress.indexOf(cancelableTask);
                if (index !== -1) {
                    this.tasksInProgress.splice(index, 1);
                }
            }
        });
    }
    onError(err) {
        if (isCancellationError(err)) {
            return;
        }
        const message = err && err.message || '';
        if (/getaddrinfo ENOTFOUND|getaddrinfo ENOENT|connect EACCES|connect ECONNREFUSED/.test(message)) {
            return;
        }
        this.notificationService.error(err);
    }
    handleURL(uri, options) {
        if (!/^extension/.test(uri.path)) {
            return Promise.resolve(false);
        }
        this.onOpenExtensionUrl(uri);
        return Promise.resolve(true);
    }
    onOpenExtensionUrl(uri) {
        const match = /^extension\/([^/]+)$/.exec(uri.path);
        if (!match) {
            return;
        }
        const extensionId = match[1];
        this.queryLocal().then(async (local) => {
            let extension = local.find(local => areSameExtensions(local.identifier, { id: extensionId }));
            if (!extension) {
                [extension] = await this.getExtensions([{ id: extensionId }], { source: 'uri' }, CancellationToken.None);
            }
            if (extension) {
                await this.hostService.focus(mainWindow);
                await this.open(extension);
            }
        }).then(undefined, error => this.onError(error));
    }
    getPublishersToAutoUpdate() {
        return this.getEnabledAutoUpdateExtensions().filter(id => !EXTENSION_IDENTIFIER_REGEX.test(id));
    }
    getEnabledAutoUpdateExtensions() {
        try {
            const parsedValue = JSON.parse(this.enabledAuotUpdateExtensionsValue);
            if (Array.isArray(parsedValue)) {
                return parsedValue;
            }
        }
        catch (e) { /* Ignore */ }
        return [];
    }
    setEnabledAutoUpdateExtensions(enabledAutoUpdateExtensions) {
        this.enabledAuotUpdateExtensionsValue = JSON.stringify(enabledAutoUpdateExtensions);
    }
    get enabledAuotUpdateExtensionsValue() {
        if (!this._enabledAutoUpdateExtensionsValue) {
            this._enabledAutoUpdateExtensionsValue = this.getEnabledAutoUpdateExtensionsValue();
        }
        return this._enabledAutoUpdateExtensionsValue;
    }
    set enabledAuotUpdateExtensionsValue(enabledAuotUpdateExtensionsValue) {
        if (this.enabledAuotUpdateExtensionsValue !== enabledAuotUpdateExtensionsValue) {
            this._enabledAutoUpdateExtensionsValue = enabledAuotUpdateExtensionsValue;
            this.setEnabledAutoUpdateExtensionsValue(enabledAuotUpdateExtensionsValue);
        }
    }
    getEnabledAutoUpdateExtensionsValue() {
        return this.storageService.get(EXTENSIONS_AUTO_UPDATE_KEY, -1 /* StorageScope.APPLICATION */, '[]');
    }
    setEnabledAutoUpdateExtensionsValue(value) {
        this.storageService.store(EXTENSIONS_AUTO_UPDATE_KEY, value, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
    }
    getDisabledAutoUpdateExtensions() {
        try {
            const parsedValue = JSON.parse(this.disabledAutoUpdateExtensionsValue);
            if (Array.isArray(parsedValue)) {
                return parsedValue;
            }
        }
        catch (e) { /* Ignore */ }
        return [];
    }
    setDisabledAutoUpdateExtensions(disabledAutoUpdateExtensions) {
        this.disabledAutoUpdateExtensionsValue = JSON.stringify(disabledAutoUpdateExtensions);
    }
    get disabledAutoUpdateExtensionsValue() {
        if (!this._disabledAutoUpdateExtensionsValue) {
            this._disabledAutoUpdateExtensionsValue = this.getDisabledAutoUpdateExtensionsValue();
        }
        return this._disabledAutoUpdateExtensionsValue;
    }
    set disabledAutoUpdateExtensionsValue(disabledAutoUpdateExtensionsValue) {
        if (this.disabledAutoUpdateExtensionsValue !== disabledAutoUpdateExtensionsValue) {
            this._disabledAutoUpdateExtensionsValue = disabledAutoUpdateExtensionsValue;
            this.setDisabledAutoUpdateExtensionsValue(disabledAutoUpdateExtensionsValue);
        }
    }
    getDisabledAutoUpdateExtensionsValue() {
        return this.storageService.get(EXTENSIONS_DONOT_AUTO_UPDATE_KEY, -1 /* StorageScope.APPLICATION */, '[]');
    }
    setDisabledAutoUpdateExtensionsValue(value) {
        this.storageService.store(EXTENSIONS_DONOT_AUTO_UPDATE_KEY, value, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
    }
    getDismissedNotifications() {
        try {
            const parsedValue = JSON.parse(this.dismissedNotificationsValue);
            if (Array.isArray(parsedValue)) {
                return parsedValue;
            }
        }
        catch (e) { /* Ignore */ }
        return [];
    }
    setDismissedNotifications(dismissedNotifications) {
        this.dismissedNotificationsValue = JSON.stringify(dismissedNotifications);
    }
    get dismissedNotificationsValue() {
        if (!this._dismissedNotificationsValue) {
            this._dismissedNotificationsValue = this.getDismissedNotificationsValue();
        }
        return this._dismissedNotificationsValue;
    }
    set dismissedNotificationsValue(dismissedNotificationsValue) {
        if (this.dismissedNotificationsValue !== dismissedNotificationsValue) {
            this._dismissedNotificationsValue = dismissedNotificationsValue;
            this.setDismissedNotificationsValue(dismissedNotificationsValue);
        }
    }
    getDismissedNotificationsValue() {
        return this.storageService.get(EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY, 0 /* StorageScope.PROFILE */, '[]');
    }
    setDismissedNotificationsValue(value) {
        this.storageService.store(EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY, value, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
    }
};
ExtensionsWorkbenchService = ExtensionsWorkbenchService_1 = __decorate([
    __param(0, IInstantiationService),
    __param(1, IEditorService),
    __param(2, IWorkbenchExtensionManagementService),
    __param(3, IExtensionGalleryService),
    __param(4, IExtensionGalleryManifestService),
    __param(5, IConfigurationService),
    __param(6, ITelemetryService),
    __param(7, INotificationService),
    __param(8, IURLService),
    __param(9, IWorkbenchExtensionEnablementService),
    __param(10, IHostService),
    __param(11, IProgressService),
    __param(12, IExtensionManagementServerService),
    __param(13, ILanguageService),
    __param(14, IIgnoredExtensionsManagementService),
    __param(15, IUserDataAutoSyncService),
    __param(16, IProductService),
    __param(17, IContextKeyService),
    __param(18, IExtensionManifestPropertiesService),
    __param(19, ILogService),
    __param(20, IExtensionService),
    __param(21, ILocaleService),
    __param(22, ILifecycleService),
    __param(23, IFileService),
    __param(24, IUserDataProfileService),
    __param(25, IUserDataProfilesService),
    __param(26, IStorageService),
    __param(27, IDialogService),
    __param(28, IUserDataSyncEnablementService),
    __param(29, IUpdateService),
    __param(30, IUriIdentityService),
    __param(31, IWorkspaceContextService),
    __param(32, IViewsService),
    __param(33, IFileDialogService),
    __param(34, IQuickInputService),
    __param(35, IAllowedExtensionsService)
], ExtensionsWorkbenchService);
export { ExtensionsWorkbenchService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2V4dGVuc2lvbnMvYnJvd3Nlci9leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEtBQUssTUFBTSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFELE9BQU8sRUFBcUIsUUFBUSxFQUFFLGdCQUFnQixFQUFFLHVCQUF1QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDMUgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0YsT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRyxPQUFPLEVBQVUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDNUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUNOLHdCQUF3QixFQUM2QyxpQkFBaUIsRUFDQSwwQkFBMEIsRUFBd0IsMEJBQTBCLEVBR2xLLHNCQUFzQixFQUN0Qix5QkFBeUIsRUFDekIsMEJBQTBCLEVBQzFCLDhDQUE4QyxFQUM5Qyx3QkFBd0IsRUFHeEIsbUNBQW1DLEVBQ25DLE1BQU0sd0VBQXdFLENBQUM7QUFDaEYsT0FBTyxFQUFFLG9DQUFvQyxFQUFtQixpQ0FBaUMsRUFBOEIsb0NBQW9DLEVBQXNCLE1BQU0scUVBQXFFLENBQUM7QUFDclEsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLDhCQUE4QixFQUFFLGlCQUFpQixFQUFFLGdCQUFnQixFQUFFLHFCQUFxQixFQUFFLDBCQUEwQixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDdFAsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQTJELDBCQUEwQixFQUFFLGdDQUFnQyxFQUFFLDRCQUE0QixFQUE0RywyQkFBMkIsRUFBRSxVQUFVLEVBQXlELE1BQU0seUJBQXlCLENBQUM7QUFDeFksT0FBTyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUcsT0FBTyxFQUFFLFdBQVcsRUFBZ0MsTUFBTSx3Q0FBd0MsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZUFBZSxFQUEyQixNQUFNLDhCQUE4QixDQUFDO0FBQ3hGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQW9CLGdCQUFnQixFQUFvQixNQUFNLGtEQUFrRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNoSSxPQUFPLEtBQUssU0FBUyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzFFLE9BQU8sRUFBdUYsbUJBQW1CLEVBQStDLDRCQUE0QixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDM1AsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNwSCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsOEJBQThCLEVBQWdCLE1BQU0sMERBQTBELENBQUM7QUFDbEosT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkcsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQy9GLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLDJFQUEyRSxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxpQkFBaUIsRUFBZ0QsV0FBVyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDekssT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDdkYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxpQkFBaUIsRUFBa0IsTUFBTSxpREFBaUQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDaEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBaUIsTUFBTSxnREFBZ0QsQ0FBQztBQUNuSCxPQUFPLEVBQUUsY0FBYyxFQUFhLE1BQU0sOENBQThDLENBQUM7QUFDekYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLGFBQWEsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2hGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQW1CLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3pGLE9BQU8sRUFBZ0Msc0NBQXNDLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSw2RUFBNkUsQ0FBQztBQUNyTSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFpQm5HLElBQU0sU0FBUyxHQUFmLE1BQU0sU0FBUztJQVFyQixZQUNTLGFBQXNELEVBQ3RELG9CQUFnRixFQUN4RSxNQUE4QyxFQUN2RCxLQUFrQyxFQUNqQyxRQUF1QyxFQUM5QixxQkFBd0csRUFDL0YsY0FBeUQsRUFDaEUsZ0JBQW9ELEVBQzFELFVBQXdDLEVBQ3ZDLFdBQTBDLEVBQ3ZDLGNBQWdEO1FBVnpELGtCQUFhLEdBQWIsYUFBYSxDQUF5QztRQUN0RCx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQTREO1FBQ3hFLFdBQU0sR0FBTixNQUFNLENBQXdDO1FBQ3ZELFVBQUssR0FBTCxLQUFLLENBQTZCO1FBQ2pDLGFBQVEsR0FBUixRQUFRLENBQStCO1FBQzlCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBbUY7UUFDOUUsbUJBQWMsR0FBZCxjQUFjLENBQTBCO1FBQy9DLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDekMsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUN0QixnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUN0QixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFqQjNELG9CQUFlLDRDQUFvRDtRQUVsRSwwQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBZSxDQUFDO0lBaUJ2RCxDQUFDO0lBRUQsSUFBSSxpQkFBaUI7UUFDcEIsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUNoQyxPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsQ0FBQztRQUNyRCxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLGlCQUFpQixFQUFFLENBQUM7WUFDbkMsT0FBTztnQkFDTixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsVUFBVSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVTtnQkFDakMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUTtnQkFDN0IsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUTtnQkFDN0IsWUFBWSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWTtnQkFDckMsU0FBUyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUzthQUMvQixDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxJQUFJLE9BQU87UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztJQUVELElBQUksT0FBTyxDQUFDLE9BQXNDO1FBQ2pELElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBSSxrQkFBa0I7UUFDckIsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDO0lBQ25DLENBQUM7SUFFRCxJQUFJLGtCQUFrQixDQUFDLE9BQWdCO1FBQ3RDLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksSUFBSTtRQUNQLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQywyQkFBbUIsQ0FBQztJQUMxRCxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1osT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ2xELENBQUM7SUFFRCxJQUFJLGlCQUFpQjtRQUNwQixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUM7UUFDckMsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDaEMsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsaUJBQWlCLENBQUM7UUFDckQsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksSUFBSTtRQUNQLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDMUIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLDhCQUE4QixFQUFFLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQztJQUMxRCxDQUFDO0lBRUQsSUFBSSxXQUFXO1FBQ2QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN0RCxDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsOEJBQThCLEVBQUUsRUFBRSxXQUFXLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQztJQUN4RSxDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ2IsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUM7UUFDMUMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUVELElBQUksSUFBSTtRQUNQLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFDbEYsQ0FBQztJQUVELElBQUksU0FBUztRQUNaLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFDL0IsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLDhCQUE4QixFQUFFLEVBQUUsU0FBUyxJQUFJLEVBQUUsQ0FBQztJQUMvRCxDQUFDO0lBRUQsSUFBSSxvQkFBb0I7UUFDdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLG9CQUFvQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQ3BFLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQztZQUN0QyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUM7UUFDeEMsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN2QixDQUFDO0lBRUQsSUFBSSxZQUFZO1FBQ2YsT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDeEYsQ0FBQztJQUVELElBQUksZUFBZTtRQUNsQixPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDO0lBQ3RDLENBQUM7SUFFRCxJQUFJLG9CQUFvQjtRQUN2QixPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUUsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDdEcsQ0FBQztJQUVELElBQUksT0FBTztRQUNWLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQ3RFLENBQUM7SUFFRCxJQUFJLE9BQU87UUFDVixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ3RGLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDVCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztJQUM3QixDQUFDO0lBRUQsSUFBSSxhQUFhO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsRUFBRSxFQUFFLE9BQU8sSUFBSSxFQUFFLENBQUM7SUFDbkcsQ0FBQztJQUVELElBQUksV0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsRUFBRSxFQUFFLFdBQVcsSUFBSSxFQUFFLENBQUM7SUFDM0csQ0FBQztJQUVELElBQUksR0FBRztRQUNOLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUM7SUFDbEMsQ0FBQztJQUVELElBQUksT0FBTztRQUNWLE9BQU8sSUFBSSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQ3pHLENBQUM7SUFFRCxJQUFJLGVBQWU7UUFDbEIsT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDO0lBQy9DLENBQUM7SUFFRCxJQUFZLFlBQVk7UUFDdkIsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzVDLE9BQU8sVUFBVSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JILENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsSUFBWSx3QkFBd0I7UUFDbkMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzNDLE9BQU8sVUFBVSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3SSxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELElBQVksY0FBYztRQUN6QixPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDdkMsQ0FBQztJQUVELElBQVksY0FBYztRQUN6QixJQUFJLElBQUksQ0FBQyxJQUFJLGlDQUF5QixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN0RCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUM1RCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQzVHLE9BQU8sVUFBVSxDQUFDLFlBQVksQ0FBQyw4REFBOEQsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDL0csQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ2hILE9BQU8sVUFBVSxDQUFDLFlBQVksQ0FBQyxpRUFBaUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEgsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELElBQUksVUFBVTtRQUNiLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN4RyxDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ2IsT0FBTyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2xHLENBQUM7SUFFRCxJQUFJLFVBQVU7UUFDYixPQUFPLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDeEYsQ0FBQztJQUVELElBQUksS0FBSztRQUNSLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBR0QsSUFBVyxXQUFXO1FBQ3JCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLGVBQWUsZ0RBQXdDLENBQUM7SUFDekYsQ0FBQztJQUVELElBQVcsaUJBQWlCO1FBQzNCLE9BQU8sSUFBSSxDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUM7SUFDdEMsQ0FBQztJQUlELElBQUksWUFBWTtRQUNmLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUM3RCxDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxJQUFJLFdBQVc7UUFDZCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDNUQsQ0FBQztJQUVELElBQUksU0FBUztRQUNaLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUM7SUFDakMsQ0FBQztJQUVELElBQUksUUFBUTtRQUNYLElBQUksQ0FBQztZQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNsQyxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7WUFDRCxvREFBb0Q7WUFDcEQsSUFBSSxJQUFJLENBQUMsSUFBSSxpQ0FBeUIsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDcEYsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLG1CQUFtQixFQUFFLENBQUM7Z0JBQzNFLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUNELElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNqRCxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFDRCxJQUFJLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO2dCQUNqQyxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7UUFDRixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNoQixZQUFZO1FBQ2IsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksc0JBQXNCO1FBQ3pCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPO2VBQ2pDLENBQUMsNEVBQThDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDO2VBQ25GLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLGNBQWMsbUNBQXVCO2VBQzdELElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLGNBQWM7ZUFDcEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQsSUFBSSxZQUFZO1FBQ2YsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELElBQUksYUFBYTtRQUNoQixNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQztRQUVoQyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxnQ0FBZ0MsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNsRCxDQUFDO2FBQU0sSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNsQixPQUFPLDhCQUE4QixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlDLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO0lBQ0YsQ0FBQztJQUVELElBQUksT0FBTztRQUNWLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxJQUFJLEtBQUssQ0FBQztJQUN2RSxDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ2IsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUM7SUFDakMsQ0FBQztJQUVELElBQUksbUJBQW1CO1FBQ3RCLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsbUJBQW1CLENBQUM7SUFDdkQsQ0FBQztJQUVELElBQUksb0JBQW9CO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLENBQUM7SUFDOUYsQ0FBQztJQUVELElBQUksaUJBQWlCO1FBQ3BCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQztJQUN0RSxDQUFDO0lBRU8sUUFBUTtRQUNmLE9BQU8sSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUF3QjtRQUN6QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDOUIsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU8sS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUN2QixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDNUIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDO1FBQ3hDLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxLQUFLLENBQUMsa0JBQWtCLENBQUMsUUFBMkIsaUJBQWlCLENBQUMsSUFBSTtRQUN6RSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDWixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUNsQyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUM7eUJBQ3JHLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTt3QkFDVixJQUFJLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO3dCQUM5QyxNQUFNLENBQUMsQ0FBQztvQkFDVCxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNOLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLHVCQUF1QixDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDM0csQ0FBQztZQUNGLENBQUM7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxTQUFTO1FBQ1IsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxDQUFDO1lBQ3ZDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLElBQUksaUNBQXlCLENBQUM7SUFDM0MsQ0FBQztJQUVELEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBd0I7UUFDdkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzlCLElBQUksS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDO1lBQ3RCLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2pFLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDaEMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNELENBQUM7WUFDRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsSUFBSSxpQ0FBeUIsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLElBQUk7OztFQUcxRCxJQUFJLENBQUMsV0FBVztDQUNqQixDQUFDLENBQUM7UUFDRCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLENBQUM7WUFDdkMsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbkYsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pDLENBQUM7UUFFRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsWUFBWTtRQUNYLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzNDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuRCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxJQUFJLGlDQUF5QixDQUFDO0lBQzNDLENBQUM7SUFFRCxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQXdCO1FBQzFDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM5QixJQUFJLEtBQUssRUFBRSxZQUFZLEVBQUUsQ0FBQztZQUN6QixNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNwRSxPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDakMsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlELENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLGlDQUF5QixFQUFFLENBQUM7WUFDeEMsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLG9EQUFvRCwrQkFBK0IsMkNBQTJDLENBQUMsQ0FBQztRQUN4SixDQUFDO1FBRUQsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELElBQUksVUFBVTtRQUNiLE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ25ELElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzFELE9BQU8sS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDbEMsQ0FBQztRQUNELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDM0IsQ0FBQztRQUNELElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixPQUFPLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO1FBQ3BELENBQUM7UUFDRCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDUCxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3pCLElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNELE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELElBQUksWUFBWTtRQUNmLE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ25ELElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMscUJBQXFCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDckUsT0FBTyxLQUFLLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDO1FBQzdDLENBQUM7UUFDRCxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUM7UUFDOUMsQ0FBQztRQUNELElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixPQUFPLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsSUFBSSxFQUFFLENBQUM7UUFDL0QsQ0FBQztRQUNELE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELElBQUksYUFBYTtRQUNoQixNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNuRCxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLGFBQWEsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM3RCxPQUFPLEtBQUssQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDO1FBQ3JDLENBQUM7UUFDRCxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxPQUFPLENBQUMsVUFBVSxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUM7UUFDL0MsQ0FBQztRQUNELElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixPQUFPLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxhQUFhLElBQUksRUFBRSxDQUFDO1FBQ3ZELENBQUM7UUFDRCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCw0QkFBNEIsQ0FBQyx5QkFBcUQ7UUFDakYsSUFBSSxDQUFDLFNBQVMsR0FBRywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xHLElBQUksQ0FBQyxlQUFlLEdBQUcseUJBQXlCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2xKLENBQUM7SUFFTyw4QkFBOEI7UUFDckMsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUM1QixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUM7UUFDeEMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztDQUNELENBQUE7QUE3ZVksU0FBUztJQWVuQixXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxXQUFXLENBQUE7SUFDWCxXQUFBLFlBQVksQ0FBQTtJQUNaLFlBQUEsZUFBZSxDQUFBO0dBbkJMLFNBQVMsQ0E2ZXJCOztBQUVELE1BQU0sMEJBQTBCLEdBQUcsdUJBQXVCLENBQUM7QUFDM0QsTUFBTSxnQ0FBZ0MsR0FBRyw0QkFBNEIsQ0FBQztBQUN0RSxNQUFNLHNDQUFzQyxHQUFHLG1DQUFtQyxDQUFDO0FBRW5GLElBQU0sVUFBVSxHQUFoQixNQUFNLFVBQVcsU0FBUSxVQUFVO0lBR2xDLElBQUksUUFBUSxLQUFLLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRy9DLElBQUksT0FBTyxLQUFLLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBTTdDLFlBQ1UsTUFBa0MsRUFDMUIsYUFBc0QsRUFDdEQsb0JBQWdGLEVBQ2hGLGlCQUEwQixFQUNqQixjQUF5RCxFQUM3QywwQkFBaUYsRUFDakYsbUNBQTBGLEVBQzdHLGdCQUFvRCxFQUNoRCxvQkFBNEQ7UUFFbkYsS0FBSyxFQUFFLENBQUM7UUFWQyxXQUFNLEdBQU4sTUFBTSxDQUE0QjtRQUMxQixrQkFBYSxHQUFiLGFBQWEsQ0FBeUM7UUFDdEQseUJBQW9CLEdBQXBCLG9CQUFvQixDQUE0RDtRQUNoRixzQkFBaUIsR0FBakIsaUJBQWlCLENBQVM7UUFDQSxtQkFBYyxHQUFkLGNBQWMsQ0FBMEI7UUFDNUIsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUFzQztRQUNoRSx3Q0FBbUMsR0FBbkMsbUNBQW1DLENBQXNDO1FBQzVGLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDL0IseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQW5CbkUsY0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQXNFLENBQUMsQ0FBQztRQUc5RyxhQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFHeEQsZUFBVSxHQUFnQixFQUFFLENBQUM7UUFDN0IsaUJBQVksR0FBZ0IsRUFBRSxDQUFDO1FBQy9CLGNBQVMsR0FBZ0IsRUFBRSxDQUFDO1FBY25DLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsMEJBQTBCLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNySCxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsMEJBQTBCLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxTQUFTLENBQUMsMEJBQTBCLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDdEYsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDOUUsSUFBSSxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ3ZCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDNUIsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDbEYsTUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDaEQsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ25CLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDckMsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDaEYsSUFBSSxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ3ZCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3pDLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ25GLElBQUksQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN2QixJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNGLENBQUM7SUFHRCxJQUFJLEtBQUs7UUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2xCLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ2pCLEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM3QixDQUFDO1lBQ0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDdEcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzdCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNwQixDQUFDO0lBRUQsS0FBSyxDQUFDLGNBQWMsQ0FBQyxjQUErQjtRQUNuRCxNQUFNLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDbkIsQ0FBQztJQUVELEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxpQkFBc0MsRUFBRSxjQUErQixFQUFFLGdDQUFtRDtRQUNwSyxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxtREFBbUQsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNySCxLQUFLLE1BQU0sQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLElBQUksVUFBVSxFQUFFLENBQUM7WUFDL0Msd0RBQXdEO1lBQ3hELElBQUksU0FBUyxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN6RCxTQUFTLENBQUMsS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7WUFDRCxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLGNBQWMsS0FBSyxPQUFPLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUM5SixTQUFTLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztnQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3BDLENBQUM7UUFDRixDQUFDO1FBQ0Qsb0VBQW9FO1FBQ3BFLElBQUksZ0NBQWdDLEVBQUUsQ0FBQztZQUN0QyxNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztZQUM3QixLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDcEMsb0RBQW9EO2dCQUNwRCxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDdkIsU0FBUztnQkFDVixDQUFDO2dCQUNELDBDQUEwQztnQkFDMUMsSUFBSSxTQUFTLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDbEMsU0FBUztnQkFDVixDQUFDO2dCQUNELHFEQUFxRDtnQkFDckQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ2hDLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCw2REFBNkQ7Z0JBQzdELElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDN0YsU0FBUztnQkFDVixDQUFDO2dCQUNELGlCQUFpQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNuQyxDQUFDO1lBQ0QsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMzSixNQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7Z0JBQ2hDLE1BQU0sVUFBVSxHQUFhLEVBQUUsQ0FBQztnQkFDaEMsS0FBSyxNQUFNLFNBQVMsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO29CQUMzQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ3pDLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUM3RixJQUFJLE9BQU8sRUFBRSxDQUFDO3dCQUNiLFNBQVMsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO29CQUM3QixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsU0FBUyxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQzt3QkFDcEMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUMxQyxDQUFDO29CQUNELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztnQkFDcEMsQ0FBQztnQkFXRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUE0RCwrQkFBK0IsRUFBRTtvQkFDNUgsVUFBVSxFQUFFLElBQUkscUJBQXFCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDM0QsVUFBVSxFQUFFLElBQUkscUJBQXFCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDM0QsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLG1EQUFtRCxDQUFDLGlCQUFzQyxFQUFFLGNBQStCO1FBQ3hJLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHlDQUF5QyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDM0YsTUFBTSxjQUFjLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDeEYsTUFBTSwyQkFBMkIsR0FBd0IsRUFBRSxDQUFDO1FBQzVELE1BQU0sa0NBQWtDLEdBQXFCLEVBQUUsQ0FBQztRQUNoRSxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO1lBQzVFLElBQUksU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNyQixJQUFJLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLGNBQWMsQ0FBQyxFQUFFLENBQUM7b0JBQzFILDJCQUEyQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztxQkFBTSxDQUFDO29CQUNQLGtDQUFrQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFDcEgsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxrQ0FBa0MsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMvQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLGtDQUFrQyxFQUFFLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pNLDJCQUEyQixDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyx5Q0FBeUMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFFTyx5Q0FBeUMsQ0FBQyxpQkFBc0M7UUFDdkYsTUFBTSxnQkFBZ0IsR0FBcUMsRUFBRSxDQUFDO1FBQzlELE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxFQUE2QixFQUFFLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztRQUNqRyxLQUFLLE1BQU0sT0FBTyxJQUFJLGlCQUFpQixFQUFFLENBQUM7WUFDekMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFDRCxLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4QyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDcEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNDLElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ2IsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQzVDLFNBQVM7Z0JBQ1YsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUM1QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7Z0JBQ2hFLElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ2IsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQzdDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sZ0JBQWdCLENBQUM7SUFDekIsQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjLENBQUMsY0FBK0IsRUFBRSxPQUEwQjtRQUN2RixJQUFJLG1CQUFtQixHQUFHLEtBQUssQ0FBQztRQUNoQyxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUt6RCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUEwRCwrQkFBK0IsQ0FBQyxDQUFDO1lBQzNILE1BQU0sdUJBQXVCLEdBQWtDLENBQUMsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxjQUFjLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxjQUFjLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsTixtQkFBbUIsR0FBRyxDQUFDLENBQUMsdUJBQXVCLEVBQUUsVUFBVSxFQUFFLG1CQUFtQixDQUFDO1FBQ2xGLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUM7SUFDNU4sQ0FBQztJQUVELFVBQVUsQ0FBQyxnQkFBbUM7UUFDN0MsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxLQUE0QjtRQUN0RCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLElBQUksTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7bUJBQzFGLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNsSixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsd0JBQXdCLENBQUMsY0FBZ0M7UUFDdEUsTUFBTSx5QkFBeUIsR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsMEJBQTBCLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUM5RyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsMEJBQTBCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDNUcsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM1QixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsbUNBQW1DLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNuRyxDQUFDO1FBRUQsZ0hBQWdIO1FBQ2hILE1BQU0sU0FBUyxHQUFHLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLEVBQUU7WUFDeEYsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUM3QixNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLGtCQUErQyxFQUNsRCxhQUEwQyxFQUMxQyxlQUE0QyxDQUFDO2dCQUM5QyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRSxDQUFDO29CQUNwQyxJQUFJLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO3dCQUNqQyxrQkFBa0IsR0FBRyxTQUFTLENBQUM7b0JBQ2hDLENBQUM7eUJBQU0sSUFBSSxTQUFTLENBQUMsSUFBSSwrQkFBdUIsRUFBRSxDQUFDO3dCQUNsRCxhQUFhLEdBQUcsU0FBUyxDQUFDO29CQUMzQixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsZUFBZSxHQUFHLFNBQVMsQ0FBQztvQkFDN0IsQ0FBQztnQkFDRixDQUFDO2dCQUNELE1BQU0sU0FBUyxHQUFHLGtCQUFrQixJQUFJLGFBQWEsSUFBSSxlQUFlLENBQUM7Z0JBQ3pFLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ2YsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDeEIsQ0FBQztZQUNGLENBQUM7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVQLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzNGLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN0QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUwsU0FBUyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDeEIsU0FBUyxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEYsU0FBUyxDQUFDLDRCQUE0QixDQUFDLHlCQUF5QixDQUFDLENBQUM7WUFDbEUsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLEtBQUs7UUFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDdkIsTUFBTSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFFTyxLQUFLLENBQUMsc0JBQXNCLENBQUMsT0FBMEM7UUFDOUUsTUFBTSxVQUFVLEdBQWdCLEVBQUUsQ0FBQztRQUNuQyxLQUFLLE1BQU0sS0FBSyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQzdCLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1lBQ2hDLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ2xFLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNsRSxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDakksSUFBSSxDQUFDLFVBQVUsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUVqSCxJQUFJLFNBQVMsR0FBMEIsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLG1CQUFtQjtnQkFDL0UsQ0FBQyxDQUFDLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDO29CQUNuSyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ2QsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZixJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNYLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxTQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDeEcsSUFBSSxTQUFTLEVBQUUsQ0FBQzt3QkFDZixTQUFTLEdBQUcsU0FBUyxDQUFDO29CQUN2QixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ2hDLENBQUM7b0JBQ0QsU0FBUyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7b0JBQ3hCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ3hCLFNBQVMsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO29CQUM3QixDQUFDO29CQUNELFNBQVMsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN2RixDQUFDO2dCQUNELFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDNUIsQ0FBQztZQUNELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNuRyxDQUFDO1FBRUQsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkIsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLDRCQUE0QixFQUFFLENBQUM7WUFDN0YsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDcEMsU0FBUyxDQUFDLDRCQUE0QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xELENBQUM7WUFDRCxJQUFJLENBQUMsbUNBQW1DLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdEQsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsNEJBQTRCLENBQUMsS0FBc0I7UUFDaEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzlGLElBQUksU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ3RCLFNBQVMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxtQ0FBbUMsQ0FBQyxVQUF1QjtRQUN4RSxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUM7UUFDL0YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNyQixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUM7WUFDdEMsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLGlCQUFpQixFQUFFLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1USxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ3BDLE1BQU0sVUFBVSxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDdEcsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsU0FBUyxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUNwQyxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxVQUFnQztRQUM1RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RixJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDO1lBQ2hILElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxZQUFZLEVBQUUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDN0UsQ0FBQztJQUNGLENBQUM7SUFFTyx1QkFBdUIsQ0FBQyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQThCO1FBQ2hGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ3RLLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNoRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDM0YsQ0FBQztRQUNELElBQUksV0FBVyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNqRCxDQUFDO0lBQ0YsQ0FBQztJQUVPLG1CQUFtQixDQUFDLGtCQUFpRDtRQUM1RSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2SCxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ3BDLElBQUksU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNyQixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM1RixJQUFJLGVBQWUsS0FBSyxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ25ELFNBQVMsQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO29CQUM1QyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxTQUFvQjtRQUNyQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsT0FBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUMzSSx5Q0FBaUM7UUFDbEMsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDeEYsMkNBQW1DO1FBQ3BDLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxPQUFPLElBQUksaUJBQWlCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUssT0FBTyxLQUFLLENBQUMsQ0FBQyxrQ0FBMEIsQ0FBQyxtQ0FBMkIsQ0FBQztJQUN0RSxDQUFDO0NBQ0QsQ0FBQTtBQTNYSyxVQUFVO0lBaUJiLFdBQUEsd0JBQXdCLENBQUE7SUFDeEIsV0FBQSxvQ0FBb0MsQ0FBQTtJQUNwQyxXQUFBLG9DQUFvQyxDQUFBO0lBQ3BDLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxxQkFBcUIsQ0FBQTtHQXJCbEIsVUFBVSxDQTJYZjtBQUVNLElBQU0sMEJBQTBCLEdBQWhDLE1BQU0sMEJBQTJCLFNBQVEsVUFBVTs7YUFFakMseUJBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxBQUF0QixDQUF1QixHQUFDLFdBQVc7SUFjL0UsSUFBSSxRQUFRLEtBQW9DLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBTzlFLElBQUksT0FBTyxLQUFLLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBTzdDLFlBQ3dCLG9CQUE0RCxFQUNuRSxhQUE4QyxFQUN4QiwwQkFBaUYsRUFDN0YsY0FBeUQsRUFDakQsK0JBQWtGLEVBQzdGLG9CQUE0RCxFQUNoRSxnQkFBb0QsRUFDakQsbUJBQTBELEVBQ25FLFVBQXVCLEVBQ0UsMEJBQWlGLEVBQ3pHLFdBQTBDLEVBQ3RDLGVBQWtELEVBQ2pDLGdDQUFvRixFQUNyRyxlQUFrRCxFQUMvQiwrQkFBcUYsRUFDaEcsdUJBQWtFLEVBQzNFLGNBQWdELEVBQzdDLGlCQUFxQyxFQUNwQixrQ0FBd0YsRUFDaEgsVUFBd0MsRUFDbEMsZ0JBQW9ELEVBQ3ZELGFBQThDLEVBQzNDLGdCQUFvRCxFQUN6RCxXQUEwQyxFQUMvQixzQkFBZ0UsRUFDL0QsdUJBQWtFLEVBQzNFLGNBQWdELEVBQ2pELGFBQThDLEVBQzlCLDZCQUE4RSxFQUM5RixhQUE4QyxFQUN6QyxrQkFBd0QsRUFDbkQsdUJBQWtFLEVBQzdFLFlBQTRDLEVBQ3ZDLGlCQUFzRCxFQUN0RCxpQkFBc0QsRUFDL0Msd0JBQW9FO1FBRS9GLEtBQUssRUFBRSxDQUFDO1FBckNnQyx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ2xELGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUNQLCtCQUEwQixHQUExQiwwQkFBMEIsQ0FBc0M7UUFDNUUsbUJBQWMsR0FBZCxjQUFjLENBQTBCO1FBQ2hDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBa0M7UUFDNUUseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUMvQyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW1CO1FBQ2hDLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBc0I7UUFFekIsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUFzQztRQUN4RixnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUNyQixvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7UUFDaEIscUNBQWdDLEdBQWhDLGdDQUFnQyxDQUFtQztRQUNwRixvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7UUFDZCxvQ0FBK0IsR0FBL0IsK0JBQStCLENBQXFDO1FBQy9FLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7UUFDMUQsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBRVgsdUNBQWtDLEdBQWxDLGtDQUFrQyxDQUFxQztRQUMvRixlQUFVLEdBQVYsVUFBVSxDQUFhO1FBQ2pCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDdEMsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQzFCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDeEMsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFDZCwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXlCO1FBQzlDLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7UUFDMUQsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQ2hDLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUNiLGtDQUE2QixHQUE3Qiw2QkFBNkIsQ0FBZ0M7UUFDN0Usa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ3hCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBcUI7UUFDbEMsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUEwQjtRQUM1RCxpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUN0QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQ3JDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFDOUIsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUEyQjtRQTNEL0Usb0JBQWUsR0FBc0IsSUFBSSxDQUFDO1FBQzFDLHFCQUFnQixHQUFzQixJQUFJLENBQUM7UUFDM0Msa0JBQWEsR0FBc0IsSUFBSSxDQUFDO1FBQ3hDLHNCQUFpQixHQUFpQixFQUFFLENBQUM7UUFLckMsY0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQTBCLENBQUMsQ0FBQztRQUlsRSx1Q0FBa0MsR0FBRyxJQUFJLE9BQU8sRUFBdUMsQ0FBQztRQUNoRyxzQ0FBaUMsR0FBRyxJQUFJLENBQUMsa0NBQWtDLENBQUMsS0FBSyxDQUFDO1FBRTFFLGFBQVEsR0FBRyxJQUFJLE9BQU8sRUFBUSxDQUFDO1FBR3hDLGVBQVUsR0FBaUIsRUFBRSxDQUFDO1FBQzlCLG9CQUFlLEdBQTZCLEVBQUUsQ0FBQztRQXdOdEMsa0NBQTZCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQTVLeEYsSUFBSSxDQUFDLCtCQUErQixHQUFHLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzlGLElBQUksZ0NBQWdDLENBQUMsOEJBQThCLEVBQUUsQ0FBQztZQUNyRSxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFDbkYsZ0NBQWdDLENBQUMsOEJBQThCLEVBQy9ELEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUNsQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQ2hDLENBQUMsZ0NBQWdDLENBQUMsK0JBQStCLENBQ2pFLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3RixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNuRCxDQUFDO1FBQ0QsSUFBSSxnQ0FBZ0MsQ0FBQywrQkFBK0IsRUFBRSxDQUFDO1lBQ3RFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQ3BGLGdDQUFnQyxDQUFDLCtCQUErQixFQUNoRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFDbEMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUNoQyxJQUFJLENBQ0osQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNqRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3BELENBQUM7UUFDRCxJQUFJLGdDQUFnQyxDQUFDLDRCQUE0QixFQUFFLENBQUM7WUFDbkUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQ2pGLGdDQUFnQyxDQUFDLDRCQUE0QixFQUM3RCxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFDbEMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUNoQyxDQUFDLENBQUMsZ0NBQWdDLENBQUMsK0JBQStCLElBQUksZ0NBQWdDLENBQUMsOEJBQThCLENBQUMsQ0FDdEksQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzlELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBTyw0QkFBMEIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3ZHLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLGdCQUFnQixDQUFPLElBQUksQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUNoQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixVQUFVLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWpDLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQzFDLENBQUM7SUFFTyxLQUFLLENBQUMsVUFBVTtRQUN2Qiw4QkFBOEI7UUFDOUIsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDNUIsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN4RSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV2SSxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLG1DQUEyQixDQUFDO1FBQzVELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM1QixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQzVCLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxrQ0FBa0MsRUFBRSxDQUFDO1FBQzFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsK0JBQXVCLHNDQUFzQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNwTCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLG9DQUEyQiwwQkFBMEIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsNkNBQTZDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbkwsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQixvQ0FBMkIsZ0NBQWdDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLDZDQUE2QyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3pMLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7WUFDdkUsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLDhCQUE4QixFQUFFLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxvQkFBb0I7UUFDM0Isc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3JFLElBQUksQ0FBQyxDQUFDLG9CQUFvQixDQUFDLDBCQUEwQixDQUFDLEVBQUUsQ0FBQztnQkFDeEQsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxDQUFDO29CQUNoQyxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQztnQkFDdkMsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFLENBQUM7Z0JBQzlELElBQUksSUFBSSxDQUFDLHlCQUF5QixFQUFFLEVBQUUsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO2dCQUNwRCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO1lBQ3ZGLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLEtBQUssdUJBQXVCLElBQUksa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pJLElBQUksQ0FBQyxlQUFlLENBQUMsOEJBQThCLENBQUMsQ0FBQztZQUN0RCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsK0JBQStCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5SSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ25ELElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSw4REFBaUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksa0VBQW1DLElBQUksQ0FBQyxDQUFDLElBQUksNENBQXlCLEVBQUUsQ0FBQztnQkFDN0ksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FHN0IsdUNBQXVDLENBQUMsQ0FBQztnQkFDNUMsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsRUFBRSxDQUFDO29CQUN0QyxJQUFJLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQ3hDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLHVDQUF1QyxDQUFDLEdBQUcsRUFBRTtZQUN6RixJQUFJLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxlQUFlLENBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNwRCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLDZCQUE2QjtRQUM3QixJQUFJLENBQUMsK0JBQStCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRW5FLG9CQUFvQjtRQUNwQixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFckMsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQ25DLCtDQUErQztZQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7WUFDcEMsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUNuQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNyRSxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pELElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQ3BDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLG1CQUFtQjtRQUMxQixPQUFPLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLEtBQUssQ0FBQztJQUM1QyxDQUFDO0lBRUQsa0JBQWtCO1FBQ2pCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQStCLDBCQUEwQixDQUFDLENBQUM7UUFDaEgsSUFBUyxVQUFVLEtBQUssd0JBQXdCLEVBQUUsQ0FBQztZQUNsRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxVQUFVLEtBQUssdUJBQXVCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzVGLENBQUM7SUFFRCxLQUFLLENBQUMsZ0NBQWdDLENBQUMsbUJBQTRCO1FBQ2xFLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDeEQsSUFBSSxvQkFBb0IsS0FBSyxtQkFBbUIsRUFBRSxDQUFDO1lBQ2xELE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztZQUMvQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSx3QkFBd0IsQ0FBQztZQUMvRSxPQUFPLEVBQUUsbUJBQW1CO2dCQUMzQixDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSx1REFBdUQsQ0FBQztnQkFDbEcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsd0RBQXdELENBQUM7WUFDckcsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0NBQXNDLEVBQUUsa0ZBQWtGLENBQUM7U0FDaEosQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN2QixPQUFPO1FBQ1IsQ0FBQztRQUVELG9GQUFvRjtRQUNwRixJQUFJLENBQUMsOEJBQThCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFeEMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDLDBCQUEwQixFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFFN0YsSUFBSSxDQUFDLCtCQUErQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBR08sMkJBQTJCO1FBQ2xDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO1FBQ3JELElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzlFLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDcEYsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLDJCQUEyQixDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQ3hGLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDcEMsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFTyxrQ0FBa0M7UUFDekMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FDdEQsQ0FBQyxTQUFTLENBQUMsU0FBUztZQUNwQixDQUFDLFNBQVMsQ0FBQyxlQUFlLDhDQUFxQztnQkFDOUQsU0FBUyxDQUFDLGVBQWUsNkNBQW9DLENBQUMsQ0FBQzthQUMvRCxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQXlELHFCQUFxQixFQUFFLEVBQUUsWUFBWSxFQUFFLElBQUkscUJBQXFCLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNsTixDQUFDO0lBRU8sS0FBSyxDQUFDLDRCQUE0QixDQUFDLEtBQTJDLEVBQUUsT0FBNkM7UUFDcEksTUFBTSxpQkFBaUIsR0FBaUIsRUFBRSxDQUFDO1FBQzNDLE1BQU0saUJBQWlCLEdBQTRCLEVBQUUsQ0FBQztRQUN0RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQzFCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUM1SCxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUNmLGlCQUFpQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNuQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDO1FBQ0QsTUFBTSxtQkFBbUIsR0FBNEIsRUFBRSxDQUFDO1FBQ3hELEtBQUssTUFBTSxJQUFJLElBQUksT0FBTyxFQUFFLENBQUM7WUFDNUIsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQztnQkFDNUUsbUJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hDLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzlCLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxJQUFJLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hDLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxLQUFLLE1BQU0sZ0JBQWdCLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUNsRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7SUFDRixDQUFDO0lBRU8sMkJBQTJCLENBQUMsTUFBZTtRQUNsRCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDO1lBQ3hDLFFBQVEscUNBQTZCO1lBQ3JDLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLHVDQUF1QyxDQUFDO1NBQ2xGLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLG9DQUFvQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUVPLEtBQUs7UUFDWixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDZixDQUFDO1FBQ0QsSUFBSSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRU8scUJBQXFCLENBQUMsU0FBc0I7UUFDbkQsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDNUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUdELElBQUksS0FBSztRQUNSLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN6QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDOUIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO2dCQUNqQixNQUFNLElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNqRSxLQUFLLE1BQU0sVUFBVSxJQUFJLElBQUksRUFBRSxDQUFDO29CQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDeEQsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3BCLENBQUM7SUFHRCxJQUFJLFNBQVM7UUFDWixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ3JCLEtBQUssTUFBTSxVQUFVLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQ2pELEtBQUssTUFBTSxTQUFTLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUMxQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDakMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxJQUFJLFFBQVE7UUFDWCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxLQUFLLHFDQUE2QixDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBbUM7UUFDbkQsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsZ0NBQWdDLENBQUMsOEJBQThCLEtBQUssTUFBTSxFQUFFLENBQUM7Z0JBQzdHLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztZQUN0RSxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLGdDQUFnQyxDQUFDLCtCQUErQixLQUFLLE1BQU0sRUFBRSxDQUFDO2dCQUMvRyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztZQUN2RSxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyw0QkFBNEIsS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDekcsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1lBQ3BFLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztZQUNyRSxDQUFDO1lBQ0QsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5QixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1lBQ3RFLENBQUM7WUFDRCxPQUFPLEtBQUssRUFBRSxDQUFDO2dCQUNkLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztZQUNuRSxDQUFDO1lBQ0QsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5QixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNuQixDQUFDO0lBSUQsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFTLEVBQUUsSUFBVTtRQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sZUFBZSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBa0IsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3ZGLE1BQU0sS0FBSyxHQUFzQixpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDM0YsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQ2pGLE9BQU8sQ0FBQyxpQkFBaUIsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBRW5KLE1BQU0seUJBQXlCLEdBQUcsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUN2RyxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5RCxJQUFJLENBQUMsa0NBQWtDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3pELE9BQU87WUFDTixTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO1lBQy9GLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztZQUNsQixRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7WUFDeEIsT0FBTyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ25DLE1BQU0sSUFBSSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ25ELElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDOUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1lBQ2xGLENBQUM7U0FDRCxDQUFDO0lBQ0gsQ0FBQztJQUlELEtBQUssQ0FBQyxhQUFhLENBQUMsY0FBZ0MsRUFBRSxJQUFTLEVBQUUsSUFBVTtRQUMxRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLDBCQUEwQixDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDOUcsTUFBTSx5QkFBeUIsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1FBQ3ZHLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlGLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzNELE9BQU8saUJBQWlCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUseUJBQXlCLENBQUMsQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFRCxLQUFLLENBQUMscUJBQXFCLENBQUMsU0FBZ0IsRUFBRSxpQkFBMEI7UUFDdkUsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDMUYsT0FBTyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUM7ZUFDckgsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM00sQ0FBQztJQUVPLHNDQUFzQztRQUM3QyxJQUNDLElBQUksQ0FBQywyQkFBMkIsS0FBSyxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQyw0REFBNEQsRUFDdEksQ0FBQztZQUNGLElBQUksQ0FBQyw0QkFBNEIsR0FBRyxTQUFTLENBQUM7WUFDOUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7UUFDckMsQ0FBQztJQUNGLENBQUM7SUFFTyw0QkFBNEI7UUFDbkMsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQztRQUNyRSxNQUFNLHNCQUFzQixHQUFhLEVBQUUsQ0FBQztRQUU1QyxJQUFJLHNCQUE2RSxDQUFDO1FBQ2xGLElBQUksc0JBQXNCLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbkMsc0VBQXNFO1lBQ3RFLEtBQUssTUFBTSxxQkFBcUIsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsRUFBRSxDQUFDO2dCQUN0RSxJQUFJLHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUsscUJBQXFCLENBQUMsRUFBRSxDQUFDO29CQUN2RSxzQkFBc0IsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztnQkFDcEQsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JFLHNCQUFzQixHQUFHO29CQUN4QixPQUFPLEVBQUUsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTztvQkFDMUMsUUFBUSxFQUFFLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVE7b0JBQzVDLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVO29CQUNoRCxHQUFHLEVBQUUsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztvQkFDbEMsT0FBTyxFQUFFLEdBQUcsRUFBRTt3QkFDYixJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQ3JHLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO29CQUNyQyxDQUFDO2lCQUNELENBQUM7WUFDSCxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBRXZELElBQUksSUFBSSxDQUFDLHNCQUFzQixFQUFFLEdBQUcsS0FBSyxzQkFBc0IsRUFBRSxHQUFHLEVBQUUsQ0FBQztZQUN0RSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsc0JBQXNCLENBQUM7WUFDckQsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUMzRSxDQUFDO0lBQ0YsQ0FBQztJQUVPLDhCQUE4QjtRQUNyQyxNQUFNLHNCQUFzQixHQUFzRSxFQUFFLENBQUM7UUFFckcsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLGdEQUF3QyxDQUFDLENBQUM7UUFDL0csSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUM7Z0JBQzNCLE9BQU8sRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQUMsTUFBTTtvQkFDNUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsaUNBQWlDLEVBQUUseUZBQXlGLENBQUM7b0JBQzVJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLDZFQUE2RSxDQUFDO2dCQUN2SCxRQUFRLEVBQUUsUUFBUSxDQUFDLE9BQU87Z0JBQzFCLFVBQVUsRUFBRSxvQkFBb0I7Z0JBQ2hDLEdBQUcsRUFBRSx1QkFBdUIsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQzthQUNwSyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLHVEQUErQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDM0ksSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM5QixJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLE1BQU07Z0JBQzFFLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLHlCQUF5QixDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ3RMLEVBQUUsQ0FBQztnQkFDSCxzQkFBc0IsQ0FBQyxJQUFJLENBQUM7b0JBQzNCLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLHNGQUFzRixDQUFDO29CQUN2SSxRQUFRLEVBQUUsUUFBUSxDQUFDLE9BQU87b0JBQzFCLFVBQVUsRUFBRSxpQkFBaUI7b0JBQzdCLEdBQUcsRUFBRSx5QkFBeUIsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO2lCQUNyTSxDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFNLENBQUM7Z0JBQ1Asc0JBQXNCLENBQUMsSUFBSSxDQUFDO29CQUMzQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSwyQ0FBMkMsQ0FBQztvQkFDdkYsUUFBUSxFQUFFLFFBQVEsQ0FBQyxPQUFPO29CQUMxQixVQUFVLEVBQUUsaUJBQWlCO29CQUM3QixHQUFHLEVBQUUsb0JBQW9CLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztpQkFDaE0sQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7UUFFRCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLElBQUksQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzFJLElBQUksb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakMsc0JBQXNCLENBQUMsSUFBSSxDQUFDO2dCQUMzQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSwwRUFBMEUsQ0FBQztnQkFDMUgsUUFBUSxFQUFFLFFBQVEsQ0FBQyxPQUFPO2dCQUMxQixVQUFVLEVBQUUsb0JBQW9CO2dCQUNoQyxHQUFHLEVBQUUsdUJBQXVCLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7YUFDcEssQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUVELE9BQU8sc0JBQXNCLENBQUM7SUFDL0IsQ0FBQztJQUVELHlCQUF5QjtRQUN4QixPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztJQUNwQyxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsSUFBWTtRQUNwQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7UUFFM0QsTUFBTSxjQUFjLEdBQUcsbUJBQW1CLENBQUM7UUFDM0MsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDL0IsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFO2dCQUU5Qyx1QkFBdUI7Z0JBQ3ZCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLElBQUksRUFBRSxDQUFDO2dCQUMzRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUVuQyxnQkFBZ0I7Z0JBQ2hCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsb0NBQW9DLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbEcsTUFBTSxZQUFZLEdBQUcsVUFBVSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNwRixNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFFakUseUJBQXlCO2dCQUN6QixPQUFPLGNBQWMsR0FBRyxpQkFBaUIsR0FBRyxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsU0FBUyxHQUFHLEdBQUcsQ0FBQztZQUM3SCxDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFTyxXQUFXLENBQUMsT0FBMEIsRUFBRSx5QkFBcUQ7UUFDcEcsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLG9DQUFvQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25FLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixTQUFTLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3BLLFNBQVUsQ0FBQyw0QkFBNEIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQ2hGLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU8sb0NBQW9DLENBQUMsT0FBMEI7UUFDdEUsS0FBSyxNQUFNLFNBQVMsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDcEMsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMseUJBQXlCO2dCQUN6RCxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQzNELE9BQU8sU0FBUyxDQUFDO2dCQUNsQixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUNuRCxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQywrQkFBK0I7b0JBQ2pHLE9BQU8sU0FBUyxDQUFDO2dCQUNsQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTyxxQ0FBcUMsQ0FBQyxRQUFhO1FBQzFELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzdILENBQUM7SUFFRCxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQThCLEVBQUUsT0FBaUM7UUFDM0UsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxNQUFNLEVBQUUsR0FBRyxTQUFTLENBQUM7WUFDckIsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3SixDQUFDO1FBQ0QsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDdEQsQ0FBQztRQUNELE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxlQUFlLEVBQUUsU0FBUyxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDckssQ0FBQztJQUVELEtBQUssQ0FBQyxVQUFVLENBQUMsV0FBbUIsRUFBRSxhQUF1QjtRQUM1RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLG9CQUFvQixFQUFrQyxDQUFDO1FBQ2hKLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDcEIsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDM0IsQ0FBQztJQUNGLENBQUM7SUFFRCx5QkFBeUIsQ0FBQyxTQUFxQjtRQUM5QyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3JFLEtBQUssTUFBTSxFQUFFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7WUFDaEQsSUFBSSxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUNyRCxPQUFPLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdCLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxPQUFnQixLQUFLO1FBQ2xELE1BQU0sS0FBSyxHQUFzQixFQUFFLENBQUM7UUFDcEMsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBRTlCLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMxQyxLQUFLLE1BQU0sU0FBUyxJQUFJLGlCQUFpQixFQUFFLENBQUM7WUFDM0MsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLFlBQVksQ0FBQztZQUM1QyxJQUFJLENBQUMsWUFBWSxJQUFJLFlBQVksQ0FBQyxNQUFNLDJFQUFpRCxFQUFFLENBQUM7Z0JBQzNGLFNBQVM7WUFDVixDQUFDO1lBQ0QsSUFBSSxTQUFTLENBQUMsS0FBSyx1Q0FBK0IsRUFBRSxDQUFDO2dCQUNwRCxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3ZDLFNBQVM7WUFDVixDQUFDO1lBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDdEIsU0FBUztZQUNWLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3RSxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUNmLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUN2SixJQUFJLGdCQUFnQixFQUFFLENBQUM7b0JBQ3RCLFFBQVEsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO2dCQUNELEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzdCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEMsQ0FBQztRQUNGLENBQUM7UUFFRCxLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMxRCxJQUFJLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUNsQyxTQUFTO1lBQ1YsQ0FBQztZQUNELElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLFVBQVUsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNuSixTQUFTO1lBQ1YsQ0FBQztZQUNELHFGQUFxRjtZQUNyRixRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDckMsSUFBSSxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSwrQkFBK0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3BILE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQ3JFLElBQUksSUFBSSxFQUFFLENBQUM7b0JBQ1YsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQzt3QkFDL0IsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJO3dCQUN2QixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxtREFBbUQsQ0FBQzt3QkFDbkcsUUFBUSxFQUFFLG9CQUFvQixDQUFDLE1BQU07cUJBQ3JDLENBQUMsQ0FBQztnQkFDSixDQUFDO2dCQVdELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQWtFLHdCQUF3QixFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzlLLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVPLGVBQWUsQ0FBQyxTQUFxQjtRQUM1QyxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsS0FBSyx1Q0FBK0IsQ0FBQztRQUNyRSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUN6SSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsK0JBQStCLENBQUMsQ0FBQyw4REFBeUMsQ0FBQyx1RUFBNkMsQ0FBQztRQUNwTCxNQUFNLGlCQUFpQixHQUFHLFlBQVksaUVBQTRDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLG9CQUFvQixDQUFDLENBQUM7UUFFeEwsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQixNQUFNLHlCQUF5QixHQUFHLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pILE1BQU0sc0JBQXNCLEdBQUcsZ0JBQWdCO21CQUMzQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyw0QkFBNEIsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO21CQUM3SSxDQUFDLENBQUMsU0FBUyxDQUFDLGlCQUFpQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1lBQ3ZKLElBQUksQ0FBQyx5QkFBeUIsSUFBSSxzQkFBc0IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQ2xHLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHNCQUFzQixFQUFFLDhEQUE4RCxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQztZQUNsSyxDQUFDO1lBQ0QsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELElBQUksU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3JCLE1BQU0sc0JBQXNCLEdBQUcsZ0JBQWdCLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsNEJBQTRCLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztZQUMxSyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUU3RSx1QkFBdUI7WUFDdkIsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO2dCQUN0QixJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNmLDREQUE0RDtvQkFDNUQsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQ3BGLE9BQU8sU0FBUyxDQUFDO29CQUNsQixDQUFDO29CQUNELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLDRCQUE0QixDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7b0JBRWpJLElBQUksc0JBQXNCLEVBQUUsQ0FBQzt3QkFDNUIsZ0hBQWdIO3dCQUNoSCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsa0JBQWtCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxLQUFLLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLGNBQWMsS0FBSyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDOzRCQUNwSyxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDOzRCQUM5RCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDOzRCQUM1RCxJQUFJLG9CQUFvQjttQ0FDcEIsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUscUJBQXFCLENBQUMsSUFBSSxDQUFDO21DQUNsSCxhQUFhLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxvQkFBb0IsQ0FBQyxPQUFPLEVBQUUsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEVBQ2pILENBQUM7Z0NBQ0YsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7Z0NBQ3ZDLElBQUksS0FBSyxDQUFDLElBQUksa0VBQW1DLEVBQUUsQ0FBQztvQ0FDbkQsT0FBTyxFQUFFLE1BQU0sa0VBQTJDLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsb0RBQW9ELEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dDQUNyTSxDQUFDO2dDQUNELElBQUksS0FBSyxDQUFDLElBQUksNENBQXlCLEVBQUUsQ0FBQztvQ0FDekMsT0FBTyxFQUFFLE1BQU0sNERBQXdDLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsb0RBQW9ELEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dDQUNoTSxDQUFDO2dDQUNELElBQUksS0FBSyxDQUFDLElBQUksa0NBQW9CLEVBQUUsQ0FBQztvQ0FDcEMsT0FBTyxFQUFFLE1BQU0sa0VBQTJDLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUscURBQXFELEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dDQUNyTSxDQUFDO2dDQUNELE9BQU8sU0FBUyxDQUFDOzRCQUNsQixDQUFDOzRCQUNELE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLDZDQUE2QyxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQzt3QkFDOUksQ0FBQzt3QkFFRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7NEJBQ3ZDLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFDckosSUFBSSxzQkFBc0IsRUFBRSxDQUFDO2dDQUM1QiwwRUFBMEU7Z0NBQzFFLElBQUksc0JBQXNCLEtBQUssSUFBSSxDQUFDLGdDQUFnQyxDQUFDLCtCQUErQixJQUFJLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLHNCQUFzQixDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsOEJBQThCLEVBQUUsQ0FBQztvQ0FDeFMsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsOENBQThDLEVBQUUsaUJBQWlCLENBQUMsRUFBRSxDQUFDO2dDQUM1SSxDQUFDO2dDQUVELGlGQUFpRjtnQ0FDakYsSUFBSSxzQkFBc0IsS0FBSyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsOEJBQThCLElBQUksSUFBSSxDQUFDLGtDQUFrQyxDQUFDLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksc0JBQXNCLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQywrQkFBK0IsRUFBRSxDQUFDO29DQUMvUyxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsNkNBQTZDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLCtCQUErQixFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0NBQ3hOLENBQUM7NEJBQ0YsQ0FBQzt3QkFDRixDQUFDO29CQUVGLENBQUM7eUJBQU0sQ0FBQzt3QkFFUCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLGdDQUFnQyxDQUFDLDhCQUE4QixJQUFJLHNCQUFzQixLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQywrQkFBK0IsRUFBRSxDQUFDOzRCQUNuTSwwRUFBMEU7NEJBQzFFLElBQUksSUFBSSxDQUFDLGtDQUFrQyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQ0FDMUYsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsc0NBQXNDLEVBQUUsaUJBQWlCLENBQUMsRUFBRSxDQUFDOzRCQUN2SSxDQUFDO3dCQUNGLENBQUM7d0JBQ0QsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQywrQkFBK0IsSUFBSSxzQkFBc0IsS0FBSyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsOEJBQThCLEVBQUUsQ0FBQzs0QkFDbk0saUZBQWlGOzRCQUNqRixJQUFJLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyx5QkFBeUIsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0NBQ2pHLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLHNDQUFzQyxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQzs0QkFDdkksQ0FBQzt3QkFDRixDQUFDO29CQUNGLENBQUM7b0JBQ0QsT0FBTyxTQUFTLENBQUM7Z0JBQ2xCLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxJQUFJLHNCQUFzQixFQUFFLENBQUM7d0JBQzVCLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLHVDQUF1QyxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQztvQkFDekksQ0FBQztnQkFDRixDQUFDO2dCQUNELE9BQU8sU0FBUyxDQUFDO1lBQ2xCLENBQUM7WUFFRCwyQkFBMkI7aUJBQ3RCLENBQUM7Z0JBQ0wsSUFBSSxTQUFTLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ2xHLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLHNDQUFzQyxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQztnQkFDdkksQ0FBQztnQkFFRCxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDdlIsSUFBSSxXQUFXLElBQUksU0FBUyxDQUFDLGVBQWUsb0RBQTRDLEVBQUUsQ0FBQztvQkFDMUYsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzVJLDRDQUE0QztvQkFDNUMsSUFBSSxzQkFBc0IsSUFBSSxzQkFBc0IsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO3dCQUN2SSxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSxzQ0FBc0MsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZJLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFVBQXdCO1FBQ25ELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0QixDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2hILElBQUksaUJBQWlCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE9BQU8saUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUVELE1BQU0sa0JBQWtCLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO1FBQ3JGLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDO1FBRTVGLGlEQUFpRDtRQUNqRCw0Q0FBNEM7UUFDNUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsT0FBTyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QixDQUFDO1FBRUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTFGLElBQUksU0FBUyxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNuRCxLQUFLLE1BQU0sYUFBYSxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUM1QyxRQUFRLGFBQWEsRUFBRSxDQUFDO29CQUN2QixLQUFLLElBQUk7d0JBQ1IsNERBQTREO3dCQUM1RCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLGdDQUFnQyxDQUFDLDhCQUE4QixFQUFFLENBQUM7NEJBQy9GLE9BQU8sSUFBSSxDQUFDO3dCQUNiLENBQUM7d0JBQ0QsT0FBTyxLQUFLLENBQUM7b0JBQ2QsS0FBSyxXQUFXO3dCQUNmLGlEQUFpRDt3QkFDakQsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQywrQkFBK0IsRUFBRSxDQUFDOzRCQUNoRyxPQUFPLElBQUksQ0FBQzt3QkFDYixDQUFDO3dCQUNELE9BQU8sS0FBSyxDQUFDO29CQUNkLEtBQUssS0FBSzt3QkFDVCxvQ0FBb0M7d0JBQ3BDLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsNEJBQTRCLEVBQUUsQ0FBQzs0QkFDN0YsT0FBTyxJQUFJLENBQUM7d0JBQ2IsQ0FBQzt3QkFDRCxPQUFPLEtBQUssQ0FBQztnQkFDZixDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyw4QkFBOEIsRUFBRSxDQUFDO1lBQ3hGLFNBQVMsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQy9DLEtBQUssTUFBTSxhQUFhLElBQUksY0FBYyxFQUFFLENBQUM7b0JBQzVDLFFBQVEsYUFBYSxFQUFFLENBQUM7d0JBQ3ZCLEtBQUssV0FBVzs0QkFDZixnREFBZ0Q7NEJBQ2hELElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsOEJBQThCLEVBQUUsQ0FBQztnQ0FDL0YsT0FBTyxJQUFJLENBQUM7NEJBQ2IsQ0FBQzs0QkFDRCxPQUFPLEtBQUssQ0FBQzt3QkFDZCxLQUFLLEtBQUs7NEJBQ1QsMENBQTBDOzRCQUMxQyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLGdDQUFnQyxDQUFDLDhCQUE4QixFQUFFLENBQUM7Z0NBQy9GLE9BQU8sSUFBSSxDQUFDOzRCQUNiLENBQUM7NEJBQ0QsT0FBTyxLQUFLLENBQUM7b0JBQ2YsQ0FBQztnQkFDRixDQUFDO2dCQUNELE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsZ0NBQWdDLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztZQUN0RixTQUFTLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUMvQyxLQUFLLE1BQU0sYUFBYSxJQUFJLGNBQWMsRUFBRSxDQUFDO29CQUM1QyxRQUFRLGFBQWEsRUFBRSxDQUFDO3dCQUN2QixLQUFLLEtBQUs7NEJBQ1Qsb0NBQW9DOzRCQUNwQyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLGdDQUFnQyxDQUFDLDRCQUE0QixFQUFFLENBQUM7Z0NBQzdGLE9BQU8sSUFBSSxDQUFDOzRCQUNiLENBQUM7NEJBQ0QsT0FBTyxLQUFLLENBQUM7b0JBQ2YsQ0FBQztnQkFDRixDQUFDO2dCQUNELE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsZ0NBQWdDLENBQUMsK0JBQStCLEVBQUUsQ0FBQztZQUN6RixTQUFTLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUMvQyxLQUFLLE1BQU0sYUFBYSxJQUFJLGNBQWMsRUFBRSxDQUFDO29CQUM1QyxRQUFRLGFBQWEsRUFBRSxDQUFDO3dCQUN2QixLQUFLLEtBQUs7NEJBQ1QsMkNBQTJDOzRCQUMzQyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLGdDQUFnQyxDQUFDLCtCQUErQixFQUFFLENBQUM7Z0NBQ2hHLE9BQU8sSUFBSSxDQUFDOzRCQUNiLENBQUM7NEJBQ0QsT0FBTyxLQUFLLENBQUM7b0JBQ2YsQ0FBQztnQkFDRixDQUFDO2dCQUNELE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsT0FBTyxTQUFTLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxTQUFvQjtRQUM3QyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzlJLHlDQUFpQztRQUNsQyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakUsSUFBSSxLQUFLLHVDQUErQixFQUFFLENBQUM7Z0JBQzFDLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzlELElBQUksS0FBSyx1Q0FBK0IsRUFBRSxDQUFDO2dCQUMxQyxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFELENBQUM7UUFDRCwwQ0FBa0M7SUFDbkMsQ0FBQztJQUVELEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBZSxFQUFFLFdBQXFCO1FBQzNELElBQUksTUFBTSxFQUFFLENBQUM7WUFDWixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNoRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUM7WUFDdEMsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBaUIsRUFBRSxDQUFDO1FBQ3BDLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzFCLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNCLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3hCLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3hCLE9BQU87UUFDUixDQUFDO1FBQ0QsTUFBTSxLQUFLLEdBQXFCLEVBQUUsQ0FBQztRQUNuQyxLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNwQyxJQUFJLFdBQVcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDekMsMEZBQTBGO2dCQUMxRixTQUFTO1lBQ1YsQ0FBQztZQUNELElBQUksU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksaUNBQXlCLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN2SSx5SEFBeUg7Z0JBQ3pILFNBQVM7WUFDVixDQUFDO1lBQ0QsSUFBSSxTQUFTLENBQUMsS0FBSyxFQUFFLE1BQU0sS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDNUMsU0FBUztZQUNWLENBQUM7WUFDRCxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxTQUFTLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ3BGLENBQUM7UUFDRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQixNQUFNLGNBQWMsR0FBRyxNQUFNLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsMEJBQTBCLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQVNqRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUE0RSxtQ0FBbUMsRUFBRTtnQkFDaEosS0FBSyxFQUFFLEtBQUssQ0FBQyxNQUFNO2FBQ25CLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDMUYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcE0sSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxJQUFJLENBQUMsa0NBQWtDLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDekUsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVM7UUFDZCxNQUFNLFFBQVEsR0FBMkIsRUFBRSxDQUFDO1FBQzVDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUU7WUFDbkMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3ZCLFFBQVEsQ0FBQyxJQUFJLENBQUM7b0JBQ2IsU0FBUyxFQUFFLFNBQVMsQ0FBQyxPQUFPO29CQUM1QixPQUFPLEVBQUU7d0JBQ1IsU0FBUyxpQ0FBeUI7d0JBQ2xDLHdCQUF3QixFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsbUJBQW1CO3dCQUM5RCxlQUFlLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxrQkFBa0I7d0JBQzlFLG1CQUFtQixFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsbUJBQW1CO3dCQUN6RCxPQUFPLEVBQUUsRUFBRSxDQUFDLDhDQUE4QyxDQUFDLEVBQUUsSUFBSSxFQUFFO3FCQUNuRTtpQkFDRCxDQUFDLENBQUM7WUFDSixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQywwQkFBMEIsQ0FBQyx3QkFBd0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBRUQsS0FBSyxDQUFDLFlBQVksQ0FBQyxXQUFtQixFQUFFLFdBQTZDO1FBQ3BGLElBQUksT0FBMkIsQ0FBQztRQUNoQyxJQUFJLFdBQVcsS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUMzQixPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDeEQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLE9BQU87WUFDUixDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLFdBQVcsS0FBSyxZQUFZLEVBQUUsQ0FBQztRQUM3SCxNQUFNLFlBQVksR0FBMkIsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDO1FBRWpGLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxhQUFhLENBQUMsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEgsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHFCQUFxQixFQUFFLDRCQUE0QixFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDakcsQ0FBQztRQUVELElBQUksY0FBYyxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUM7UUFDaEUsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ25CLEtBQUssTUFBTSxjQUFjLElBQUksZ0JBQWdCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUNsRSxJQUFJLGNBQWMsMkNBQTJCLElBQUksY0FBYywrQ0FBNkIsRUFBRSxDQUFDO2dCQUM5RixPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNaLEtBQUssRUFBRSxjQUFjLCtDQUE2QixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsY0FBYyxDQUFDO29CQUMzSSxFQUFFLEVBQUUsY0FBYztpQkFDbEIsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDeEIsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxvRUFBb0UsQ0FBQyxDQUFDO1lBQzNILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNuSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2IsT0FBTztZQUNSLENBQUM7WUFDRCxjQUFjLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQztRQUM1QixDQUFDO1FBRUQsSUFBSSxjQUFjLEtBQUssZ0JBQWdCLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ25FLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsYUFBYSxDQUFDLEVBQUUsRUFBRSxHQUFHLFlBQVksRUFBRSxjQUFjLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1SSxDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDO1lBQzFELEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFLG9DQUFvQyxDQUFDO1lBQzNFLGNBQWMsRUFBRSxLQUFLO1lBQ3JCLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsYUFBYSxFQUFFLEtBQUs7WUFDcEIsU0FBUyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQztTQUMvQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNsQixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLEVBQUUsUUFBUSx3Q0FBK0IsRUFBRSxFQUFFLEtBQUssRUFBQyxRQUFRLEVBQUMsRUFBRTtZQUMvRixRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUscUJBQXFCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDcEYsTUFBTSxJQUFJLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLGdCQUFnQixDQUFDLE9BQU8sR0FBRyxjQUFjLCtDQUE2QixJQUFJLGNBQWMsK0NBQTZCLElBQUksY0FBYywyQ0FBMkIsQ0FBQyxDQUFDLENBQUMsSUFBSSxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUM7WUFDeFAsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGdDQUF3QixDQUFDO1lBQ3RJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDLENBQUM7UUFDdkcsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLHFCQUFxQixDQUFDLFdBQW1CO1FBQ3RELE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNsRixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsdUNBQXVDLENBQUMsQ0FBQyxDQUFDO1lBQ3BHLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN0QyxPQUFPO2dCQUNOLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTztnQkFDYixLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU87Z0JBQ2hCLFdBQVcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQy9JLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUU7YUFDOUYsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEtBQUssRUFDbkQ7WUFDQyxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsNEJBQTRCLENBQUM7WUFDeEUsYUFBYSxFQUFFLElBQUk7U0FDbkIsQ0FBQyxDQUFDO1FBQ0osT0FBTyxJQUFJLEVBQUUsRUFBRSxDQUFDO0lBQ2pCLENBQUM7SUFFTyxLQUFLLENBQUMsa0NBQWtDLENBQUMsT0FBNEIsRUFBRSxnQ0FBbUQ7UUFDakksTUFBTSxVQUFVLEdBQWlCLEVBQUUsQ0FBQztRQUNwQyxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUMxQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN4QixPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGtDQUFrQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzSyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsb0NBQW9DLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQy9HLElBQUksQ0FBQyw4QkFBOEIsRUFBRSxDQUFDO1FBQ3ZDLENBQUM7SUFDRixDQUFDO0lBRU8seUJBQXlCO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFTyx5QkFBeUIsQ0FBQyxTQUFTLEdBQUcsS0FBSztRQUNsRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRTtZQUMzQyxJQUFJLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLENBQUM7Z0JBQ3RDLE1BQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzlCLENBQUM7WUFDRCxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNsQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFFTyx1QkFBdUI7UUFDOUIsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsQ0FBQztZQUNqRixPQUFPLElBQUksR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDckMsQ0FBQztRQUNELE9BQU8sNEJBQTBCLENBQUMsb0JBQW9CLENBQUM7SUFDeEQsQ0FBQztJQUVPLDhCQUE4QjtRQUNyQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO2FBQy9ELElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRU8sS0FBSyxDQUFDLDJCQUEyQjtRQUN4QyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hELE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsd0JBQXdCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsSSxDQUFDO0lBRU8sS0FBSyxDQUFDLDJCQUEyQjtRQUN4QyxNQUFNLEtBQUssR0FBcUIsRUFBRSxDQUFDO1FBQ25DLEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3BDLElBQUksU0FBUyxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBSSxTQUFTLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDeEYsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsU0FBUyxDQUFDLFVBQVUsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDckUsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQixNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pHLElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sSUFBSSxDQUFDLGtDQUFrQyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDbEUsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQjtRQUNqQyxNQUFNLFFBQVEsR0FBaUIsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sa0JBQWtCLEdBQUcsRUFBRSxDQUFDO1FBQzlCLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQztRQUMzQixLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hELGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNqRCxTQUFTO1lBQ1YsQ0FBQztZQUNELElBQUksTUFBTSxJQUFJLENBQUMsNEJBQTRCLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDeEQsZUFBZSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM5QyxTQUFTO1lBQ1YsQ0FBQztZQUNELFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUVELElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMscUNBQXFDLEVBQUUsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUVELElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLDZDQUE2QyxFQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNqRyxDQUFDO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ2hELE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsd0JBQXdCLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNKLENBQUM7SUFFTyxpQkFBaUI7UUFDeEIsT0FBTyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsSUFBSSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztJQUMxRSxDQUFDO0lBRU8sd0JBQXdCO1FBQy9CLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDakYsQ0FBQztJQUVPLHVCQUF1QjtRQUM5QixRQUFRLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3ZDLG1FQUFvQztZQUNwQyw2Q0FBMEI7WUFDMUIseUNBQXdCO1lBQ3hCLGtDQUFvQixDQUFDLENBQUMsQ0FBQztnQkFDdEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztnQkFDL0QsSUFBSSxPQUFPLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO29CQUN0QyxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNySixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU8seUJBQXlCLENBQUMsU0FBcUI7UUFDdEQsSUFBSSxTQUFTLENBQUMsZUFBZSxFQUFFLGVBQWUsRUFBRSxDQUFDO1lBQ2hELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBRWxELElBQUksZUFBZSxLQUFLLEtBQUssRUFBRSxDQUFDO1lBQy9CLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixFQUFFLENBQUM7WUFDckUsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDMUQsSUFBSSxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztnQkFDbEQsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsK0JBQStCLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLElBQUksV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUN0SCxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLDRCQUE0QixHQUFHLElBQUksQ0FBQywrQkFBK0IsRUFBRSxDQUFDO1FBQzVFLElBQUksNEJBQTRCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUNsRixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxJQUFJLGVBQWUsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLGVBQWUsS0FBSyx1QkFBdUIsRUFBRSxDQUFDO1lBQ2pELE9BQU8sU0FBUyxDQUFDLGVBQWUsNkNBQXFDLElBQUksU0FBUyxDQUFDLGVBQWUsK0NBQXNDLENBQUM7UUFDMUksQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxTQUFxQjtRQUN2RCxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3pCLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDNUMsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDOUcsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLDZDQUE2QyxFQUFFLGlGQUFpRixDQUFDLENBQUM7UUFDdkosQ0FBQztRQUVELElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuSCxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDM0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNoRCxPQUFPO1lBQ1IsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxRQUFRLEdBQUcsU0FBUyxZQUFZLFNBQVM7Z0JBQzlDLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtnQkFDdEMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwRixJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQztnQkFDM0MsT0FBTztZQUNSLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLHlCQUF5QixFQUFFLG1IQUFtSCxFQUFFLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM1TCxDQUFDO0lBRUQsc0JBQXNCLENBQUMsb0JBQXlDO1FBQy9ELElBQUksUUFBUSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztZQUNwQyxJQUFJLDBCQUEwQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7Z0JBQzNELE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztZQUMxRSxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFTywrQkFBK0IsQ0FBQyxTQUFpQjtRQUN4RCxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBQ2hFLE9BQU8sc0JBQXNCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxLQUFLLENBQUMsNkJBQTZCLENBQUMsb0JBQXlDLEVBQUUsTUFBZTtRQUM3RixJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7WUFDaEMsSUFBSSxRQUFRLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO2dCQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7WUFDL0QsQ0FBQztZQUNELE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxDQUFDLCtCQUErQixFQUFFLENBQUM7WUFDNUUsTUFBTSxXQUFXLEdBQUcsb0JBQW9CLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyRSxNQUFNLGNBQWMsR0FBRyw0QkFBNEIsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDekUsSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDWixJQUFJLGNBQWMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUMzQiw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO1lBQ0YsQ0FBQztpQkFDSSxDQUFDO2dCQUNMLElBQUksY0FBYyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzNCLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDaEQsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLENBQUMsK0JBQStCLENBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNuRSxJQUFJLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxLQUFLLElBQUksb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3pFLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUNyRyxDQUFDO1lBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUMzQyxDQUFDO2FBRUksQ0FBQztZQUNMLE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixFQUFFLENBQUM7WUFDMUUsSUFBSSxRQUFRLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO2dCQUNwQyxJQUFJLDBCQUEwQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7b0JBQzNELE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztnQkFDMUUsQ0FBQztnQkFDRCxvQkFBb0IsR0FBRyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDMUQsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsS0FBSyxNQUFNLEVBQUUsQ0FBQztvQkFDbEUsSUFBSSxNQUFNLEVBQUUsQ0FBQzt3QkFDWiwyQkFBMkIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztvQkFDeEQsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLElBQUksMkJBQTJCLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQzs0QkFDaEUsMkJBQTJCLENBQUMsTUFBTSxDQUFDLDJCQUEyQixDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNsRyxDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxJQUFJLENBQUMsOEJBQThCLENBQUMsMkJBQTJCLENBQUMsQ0FBQztnQkFDakUsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ2hDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxvQkFBb0IsRUFBRSxDQUFDO3dCQUN4RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDeEIsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sV0FBVyxHQUFHLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ3JFLE1BQU0sNkJBQTZCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO2dCQUNoSCxNQUFNLDZCQUE2QixHQUFHLDJCQUEyQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDeEYsTUFBTSw4QkFBOEIsR0FBRywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsSUFBSSxXQUFXLEVBQUUsQ0FBQyxDQUFDO2dCQUUvRixJQUFJLE1BQU0sRUFBRSxDQUFDO29CQUNaLElBQUksOEJBQThCLEVBQUUsQ0FBQzt3QkFDcEMsMkJBQTJCLENBQUMsTUFBTSxDQUFDLDJCQUEyQixDQUFDLE9BQU8sQ0FBQyxJQUFJLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQy9GLENBQUM7b0JBQ0QsSUFBSSw2QkFBNkIsRUFBRSxDQUFDO3dCQUNuQyxJQUFJLDZCQUE2QixFQUFFLENBQUM7NEJBQ25DLDJCQUEyQixDQUFDLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3pGLENBQUM7b0JBQ0YsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLElBQUksQ0FBQyw2QkFBNkIsRUFBRSxDQUFDOzRCQUNwQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBQy9DLENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO2dCQUNELHVCQUF1QjtxQkFDbEIsQ0FBQztvQkFDTCxJQUFJLDZCQUE2QixFQUFFLENBQUM7d0JBQ25DLDJCQUEyQixDQUFDLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3pGLENBQUM7b0JBQ0QsSUFBSSw2QkFBNkIsRUFBRSxDQUFDO3dCQUNuQyxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQzs0QkFDckMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLElBQUksV0FBVyxFQUFFLENBQUMsQ0FBQzt3QkFDckQsQ0FBQztvQkFDRixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSw4QkFBOEIsRUFBRSxDQUFDOzRCQUNwQywyQkFBMkIsQ0FBQyxNQUFNLENBQUMsMkJBQTJCLENBQUMsT0FBTyxDQUFDLElBQUksV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDL0YsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLDhCQUE4QixDQUFDLDJCQUEyQixDQUFDLENBQUM7Z0JBQ2pFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDM0MsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDN0IsQ0FBQztJQUNGLENBQUM7SUFFTyw2Q0FBNkM7UUFDcEQsSUFDQyxJQUFJLENBQUMsZ0NBQWdDLEtBQUssSUFBSSxDQUFDLG1DQUFtQyxFQUFFLENBQUMsNERBQTREO2VBQzlJLElBQUksQ0FBQyxpQ0FBaUMsS0FBSyxJQUFJLENBQUMsb0NBQW9DLEVBQUUsQ0FBQyw0REFBNEQsRUFDckosQ0FBQztZQUNGLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDaEUsTUFBTSxPQUFPLEdBQUcsQ0FBQyxVQUF3QixFQUFrQixFQUFFO2dCQUM1RCxNQUFNLGdCQUFnQixHQUFpQixFQUFFLENBQUM7Z0JBQzFDLE1BQU0sbUJBQW1CLEdBQWlCLEVBQUUsQ0FBQztnQkFDN0MsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxJQUFJLENBQUMseUJBQXlCLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQzt3QkFDL0MsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUNsQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUNyQyxDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsT0FBTyxDQUFDLGdCQUFnQixFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFDaEQsQ0FBQyxDQUFDO1lBRUYsTUFBTSxDQUFDLG1CQUFtQixFQUFFLHNCQUFzQixDQUFDLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxpQ0FBaUMsR0FBRyxTQUFTLENBQUM7WUFDbkQsSUFBSSxDQUFDLGtDQUFrQyxHQUFHLFNBQVMsQ0FBQztZQUNwRCxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsbUJBQW1CLENBQUMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7WUFFeEUsS0FBSyxNQUFNLENBQUMsSUFBSSxtQkFBbUIsSUFBSSxFQUFFLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxtQkFBbUIsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLENBQUM7WUFDRixDQUFDO1lBQ0QsS0FBSyxNQUFNLENBQUMsSUFBSSxzQkFBc0IsSUFBSSxFQUFFLEVBQUUsQ0FBQztnQkFDOUMsSUFBSSxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDbkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsVUFBVSxDQUFDLFNBQXFCO1FBQ3JDLElBQUksQ0FBQyxDQUFDLFNBQVMsWUFBWSxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLE9BQU8sSUFBSSxjQUFjLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSwwQ0FBMEMsQ0FBQyxDQUFDLENBQUM7UUFDdEgsQ0FBQztRQUVELElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzNCLE9BQU8sSUFBSSxjQUFjLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsK0NBQStDLENBQUMsQ0FBQyxDQUFDO1FBQ3BILENBQUM7UUFFRCxJQUFJLFNBQVMsQ0FBQyxlQUFlLEVBQUUsZUFBZSxFQUFFLENBQUM7WUFDaEQsT0FBTyxJQUFJLGNBQWMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSwrQ0FBK0MsQ0FBQyxDQUFDLENBQUM7UUFDckgsQ0FBQztRQUVELElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxtQ0FBbUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFDLCtCQUErQixDQUFDLDJCQUEyQixFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNySyxPQUFPLElBQUksY0FBYyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLCtCQUErQixDQUFDLENBQUMsQ0FBQztZQUNyRyxDQUFDO1lBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNoSCxJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDMUIsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDbkgsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzNCLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDMUcsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ3hCLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELE9BQU8sV0FBVyxJQUFJLFlBQVksSUFBSSxTQUFTLElBQUksSUFBSSxjQUFjLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSwrRUFBK0UsRUFBRSxTQUFTLENBQUMsV0FBVyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1UCxDQUFDO1FBRUQsSUFBSSxTQUFTLENBQUMsaUJBQWlCLElBQUksTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzNILE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE9BQU8sSUFBSSxjQUFjLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSwrRUFBK0UsRUFBRSxTQUFTLENBQUMsV0FBVyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNoTixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUE4QixFQUFFLGlCQUEwQyxFQUFFLEVBQUUsZ0JBQTRDO1FBQ3ZJLElBQUksV0FBcUUsQ0FBQztRQUMxRSxJQUFJLFNBQWlDLENBQUM7UUFDdEMsSUFBSSxPQUFpRCxDQUFDO1FBRXRELElBQUksR0FBRyxZQUFZLEdBQUcsRUFBRSxDQUFDO1lBQ3hCLFdBQVcsR0FBRyxHQUFHLENBQUM7UUFDbkIsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLGVBQTJDLENBQUM7WUFDaEQsSUFBSSxPQUFzQyxDQUFDO1lBRTNDLGdCQUFnQjtZQUNoQixJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNuQixTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDL0UsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQztvQkFDM0IsZUFBZSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsY0FBYyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsY0FBYyxDQUFDLHdCQUF3QixJQUFJLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO2dCQUMxSyxDQUFDO1lBQ0YsQ0FBQztZQUNELHFCQUFxQjtpQkFDaEIsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3RCLFNBQVMsR0FBRyxHQUFHLENBQUM7Z0JBQ2hCLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDO2dCQUN0QixJQUFJLGNBQWMsQ0FBQyxPQUFPLElBQUksY0FBYyxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7b0JBQzNFLGVBQWUsR0FBRyxFQUFFLEVBQUUsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNwRixDQUFDO1lBQ0YsQ0FBQztZQUNELHNCQUFzQjtpQkFDakIsSUFBSSxHQUFHLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDaEMsU0FBUyxHQUFHLEdBQUcsQ0FBQztnQkFDaEIsV0FBVyxHQUFHLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQztZQUNyQyxDQUFDO1lBRUQsSUFBSSxlQUFlLEVBQUUsQ0FBQztnQkFDckIsTUFBTSxjQUFjLEdBQUcsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLDBCQUEwQixDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztnQkFDN0gsT0FBTyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUUsY0FBYyxFQUFFLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUgsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLElBQUksT0FBTyxFQUFFLENBQUM7Z0JBQzNCLFNBQVMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3BLLFNBQVUsQ0FBQyw0QkFBNEIsQ0FBQyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLENBQUM7WUFDM0gsQ0FBQztZQUVELElBQUksU0FBUyxFQUFFLFdBQVcsRUFBRSxDQUFDO2dCQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLCtDQUErQyxDQUFDLENBQUMsQ0FBQztZQUM3RixDQUFDO1lBRUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztnQkFDYixxQ0FBcUM7Z0JBQ3JDLDBFQUEwRTtnQkFDMUUsSUFBSSxjQUFjLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztvQkFDdEMsT0FBTyxHQUFHLEVBQUUsQ0FBQztvQkFDYixNQUFNLGtCQUFrQixHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNoRyxLQUFLLE1BQU0sZ0JBQWdCLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7d0JBQ3ZELElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQzs0QkFDcEosT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDdkMsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsNERBQTREO2dCQUM1RCwrREFBK0Q7Z0JBQy9ELGlFQUFpRTtxQkFDNUQsSUFBSSxjQUFjLENBQUMsTUFBTSxJQUFJLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQztvQkFDcEQsT0FBTyxHQUFHLEVBQUUsQ0FBQztvQkFDYixJQUFJLFNBQVMsQ0FBQyxlQUFlLG9EQUE0QyxFQUFFLENBQUM7d0JBQzNFLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUNqRyxJQUFJLGlCQUFpQixFQUFFLENBQUM7NEJBQ3ZCLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQzt3QkFDakMsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1lBRUQsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDbEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNkLE1BQU0sRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBYyxHQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQzt3QkFDakUsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsK0JBQStCLENBQUMsMkJBQTJCLEVBQUUsQ0FBQzt3QkFDMUYsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxzQ0FBc0MsQ0FBQyxRQUFRLDJFQUFpRCxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7d0JBQy9JLE1BQU0sa0JBQWtCLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxpREFBaUQsRUFBRSxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUM1SixJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQzs0QkFDNUIsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSw0RkFBNEYsRUFBRSxFQUFFLEVBQUUsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDOzRCQUM1SyxNQUFNLElBQUksd0JBQXdCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxJQUFJLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8seURBQXdDLENBQUM7d0JBQzlJLENBQUM7NkJBQU0sQ0FBQzs0QkFDUCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxtRUFBbUUsRUFBRSxFQUFFLENBQUMsQ0FBQzs0QkFDbkgsTUFBTSxJQUFJLHdCQUF3QixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLHlEQUF3QyxDQUFDO3dCQUM5SSxDQUFDO29CQUNGLENBQUM7b0JBQ0QsV0FBVyxHQUFHLE9BQU8sQ0FBQztnQkFDdkIsQ0FBQztnQkFDRCxJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDNUIsY0FBYyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztnQkFDM0MsQ0FBQztnQkFDRCxJQUFJLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO29CQUNsQyxjQUFjLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO2dCQUN6QyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLElBQUksY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNsQyxNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsNkJBQTZCLENBQUMsaUJBQWlCLDRDQUF5QixDQUFDO2dCQUNqTSxNQUFNLE9BQU8sR0FBNkIsRUFBRSxDQUFDO2dCQUM3QyxPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNaLEtBQUssRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxNQUFNO3dCQUNwRixDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEVBQUUscUJBQXFCLENBQUM7d0JBQ3hHLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLDhCQUE4QixFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSw2QkFBNkIsRUFBRSxjQUFjLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJO2lCQUNqTCxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3RILENBQUM7Z0JBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBVTtvQkFDdkQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsbUJBQW1CLENBQUM7b0JBQ2pFLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsdURBQXVELEVBQUUsU0FBUyxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSwwQ0FBMEMsQ0FBQztvQkFDN1AsTUFBTSxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTTtvQkFDbkgsWUFBWSxFQUFFLElBQUk7b0JBQ2xCLE9BQU87b0JBQ1AsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7d0JBQ3JCLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDO3dCQUM1RCxPQUFPLEVBQUUsSUFBSTtxQkFDYixDQUFDLENBQUMsQ0FBQyxTQUFTO2lCQUNiLENBQUMsQ0FBQztnQkFDSCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNwQixNQUFNLElBQUksaUJBQWlCLEVBQUUsQ0FBQztnQkFDL0IsQ0FBQztnQkFDRCxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNmLGNBQWMsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO2dCQUMxRCxDQUFDO1lBQ0YsQ0FBQztZQUNELElBQUksV0FBVyxZQUFZLEdBQUcsRUFBRSxDQUFDO2dCQUNoQyxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3hILENBQUM7aUJBQU0sSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDdEIsSUFBSSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztvQkFDakMsU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLHdCQUF3QixDQUFDLFdBQWlDLEVBQUUsY0FBYyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbEwsQ0FBQztxQkFBTSxDQUFDO29CQUNQLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFVLEVBQUUsV0FBZ0MsRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztnQkFDckssQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsNkJBQTZCLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMzQixJQUFJLFNBQVMsQ0FBQyxlQUFlLCtDQUFzQyxJQUFJLFNBQVMsQ0FBQyxlQUFlLDZDQUFxQyxFQUFFLENBQUM7Z0JBQ3ZJLElBQUksY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUNsQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO3dCQUMvQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxrQkFBa0IsQ0FBQzt3QkFDL0QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsd0JBQXdCLEVBQUUsMkNBQTJDLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQzt3QkFDbkgsTUFBTSxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTTt3QkFDbkgsYUFBYSxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsNkJBQTZCLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLDRCQUE0QixFQUFFLGNBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO3FCQUMxVCxDQUFDLENBQUM7b0JBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDdkIsTUFBTSxJQUFJLGlCQUFpQixFQUFFLENBQUM7b0JBQy9CLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxlQUFlLCtDQUFzQyxDQUFDLENBQUMsMkNBQWtDLENBQUMseUNBQWdDLENBQUMsQ0FBQztZQUMzSyxDQUFDO1lBQ0QsTUFBTSxJQUFJLENBQUMsMkJBQTJCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxLQUFLLENBQUMsZUFBZSxDQUFDLFNBQXFCLEVBQUUsTUFBa0MsRUFBRSxjQUErQjtRQUMvRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzFDLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUM7WUFDOUIsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUN4QyxDQUFDO1lBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDeEIsU0FBUyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxHQUFHLFNBQVMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDO1lBQzdJLENBQUM7WUFDRCxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDdkIsT0FBTyxNQUFNLENBQUMsMEJBQTBCLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxFQUFFLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxVQUFVLEVBQUUsR0FBRyxjQUFjLEVBQUUsQ0FBQyxDQUFDO1lBQ25KLENBQUM7WUFFRCxNQUFNLGNBQWMsR0FBRyxNQUFNLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ25GLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBQy9GLE1BQU0sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsNkRBQTZELEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3ZJLENBQUM7WUFFRCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDOUQsSUFBSSxDQUFDO2dCQUNKLE9BQU8sTUFBTSxNQUFNLENBQUMsMEJBQTBCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzlELENBQUM7b0JBQVMsQ0FBQztnQkFDVixJQUFJLENBQUM7b0JBQ0osTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEMsQ0FBQztnQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO29CQUNoQixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDOUIsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxjQUFjLENBQUMsU0FBcUI7UUFDbkMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN4QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBcUI7UUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUNyQyxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDekMsQ0FBQztRQUNELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBUSxDQUFDLENBQUM7UUFDN0MsSUFBSSxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDekIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLHFCQUFxQixHQUFHLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckYsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLHFCQUFxQixJQUFJLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZMLENBQUM7SUFFRCxhQUFhLENBQUMsVUFBcUMsRUFBRSxlQUFnQztRQUNwRixVQUFVLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25FLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsRUFBRSxlQUFlLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFhO1FBQzVCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzVHLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUM7WUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNsQyxDQUFDO1FBRUQsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLG1CQUFtQixJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzdGLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO2dCQUN0RCxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSxxQkFBcUIsQ0FBQztnQkFDeEUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO2dCQUNuQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQ0FBbUMsRUFBRSxvREFBb0QsRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDO2dCQUN2SSxhQUFhLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSwwQkFBMEIsQ0FBQzthQUMvRSxDQUFDLENBQUM7WUFDSCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2hCLE1BQU0sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQy9CLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxxQkFBcUIsR0FBNkIsQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN6RixLQUFLLE1BQU0sYUFBYSxJQUFJLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDaEYsSUFBSSxhQUFhLENBQUMsS0FBSyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDbEkscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQXNCLEVBQUUsQ0FBQztRQUN6QyxJQUFJLHlCQUErRCxDQUFDO1FBQ3BFLEtBQUssTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLHFCQUFxQixFQUFFLENBQUM7WUFDbkQsTUFBTSxtQkFBbUIsR0FBeUMsRUFBRSxDQUFDO1lBQ3JFLElBQUksU0FBUyxDQUFDLG1CQUFtQixJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN2RixJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztvQkFDaEMseUJBQXlCLEdBQUcsRUFBRSxDQUFDO29CQUMvQixNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFDLE9BQU8sRUFBQyxFQUFFO3dCQUNsRixNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxZQUFZLDZCQUFxQixPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQzt3QkFDckgsS0FBSyxNQUFNLEtBQUssSUFBSSxTQUFTLEVBQUUsQ0FBQzs0QkFDL0IseUJBQXlCLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7d0JBQ3RFLENBQUM7b0JBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDO2dCQUNELG1CQUFtQixDQUFDLElBQUksQ0FBQyxHQUFHLHlCQUF5QixDQUFDLENBQUM7WUFDeEQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLEtBQUssTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxLQUFLLEVBQUUsQ0FBQzt3QkFDWCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztvQkFDOUMsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUNELEtBQUssTUFBTSxDQUFDLEtBQUssRUFBRSxlQUFlLENBQUMsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO2dCQUM1RCxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7b0JBQy9ELFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDaEcsU0FBUztnQkFDVixDQUFDO2dCQUNELElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUMvRixTQUFTO2dCQUNWLENBQUM7Z0JBQ0QsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzdHLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDNUcsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDdkIscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxlQUFlLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ2hGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2dCQUNsRCxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxxQ0FBcUMsQ0FBQztnQkFDakYsSUFBSSxFQUFFLFFBQVEsQ0FBQyxPQUFPO2dCQUN0QixPQUFPLEVBQUUsSUFBSSxDQUFDLHVEQUF1RCxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUM7Z0JBQzVGLE9BQU8sRUFBRSxDQUFDO3dCQUNULEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUM7d0JBQ3BELEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJO3FCQUNmLENBQUM7Z0JBQ0YsWUFBWSxFQUFFO29CQUNiLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO2lCQUNoQjthQUNELENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDYixNQUFNLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztZQUN4QixRQUFRLHFDQUE2QjtZQUNyQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSwyQkFBMkIsQ0FBQztZQUN6RSxNQUFNLEVBQUUsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRTtTQUNwQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxtQkFBbUIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzVHLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxTQUFxQixFQUFFLFNBQXVCLEVBQUUsVUFBd0IsRUFBRTtRQUN4RyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDOUUsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN4QixNQUFNLGNBQWMsR0FBRyxTQUFTLENBQUMsYUFBYSxJQUFJLEVBQUUsQ0FBQztRQUNyRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMzQixNQUFNLGdCQUFnQixHQUFpQixFQUFFLENBQUM7WUFDMUMsS0FBSyxNQUFNLENBQUMsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDeEYsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMxQixDQUFDO1lBQ0YsQ0FBQztZQUNELE1BQU0sc0JBQXNCLEdBQWlCLEVBQUUsQ0FBQztZQUNoRCxLQUFLLE1BQU0sZUFBZSxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQ2hELHNCQUFzQixDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDbEcsQ0FBQztZQUNELE9BQU8sQ0FBQyxHQUFHLGdCQUFnQixFQUFFLEdBQUcsc0JBQXNCLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBQ0QsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRU8sdURBQXVELENBQUMsU0FBcUIsRUFBRSxVQUE2QjtRQUNuSCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDN0IsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLCtCQUErQixFQUFFLHlIQUF5SCxFQUFFLFNBQVMsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1TyxDQUFDO1FBQ0QsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzdCLE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxtSUFBbUksRUFDckwsU0FBUyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2pHLENBQUM7UUFDRCxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsa0NBQWtDLEVBQUUsMElBQTBJLEVBQ2pNLFNBQVMsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBRUQsd0JBQXdCLENBQUMsU0FBcUI7UUFDN0MsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO1lBQ3pFLENBQUMsQ0FBQyxJQUFJLENBQUMsK0JBQStCLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBRUQsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFNBQXFCO1FBQzNDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdEIsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLFNBQVMsQ0FBQyxVQUFVLEtBQUssU0FBUyxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDNUQsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztZQUM3RyxPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSx3QkFBd0IsRUFBRSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDdkgsQ0FBQztJQUVELEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxTQUFxQjtRQUN2RCxNQUFNLG1DQUFtQyxHQUFHLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMvRyw2Q0FBNkM7UUFDN0MsS0FBSyxNQUFNLENBQUMsSUFBSSxtQ0FBbUMsRUFBRSxDQUFDO1lBQ3JELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUksU0FBUyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3JELE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsZUFBZSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sSUFBSSxDQUFDLCtCQUErQixDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakcsQ0FBQztRQUNGLENBQUM7UUFDRCxNQUFNLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUVELEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxTQUFxQjtRQUM1RCxNQUFNLG1DQUFtQyxHQUFHLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMvRyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQzFELE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxtQ0FBbUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFDLENBQUMsRUFBQyxFQUFFO1lBQzFFLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUMvRSxPQUFPO1lBQ1IsQ0FBQztZQUNELE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQztZQUN4RCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBQyxlQUFlLEVBQUMsRUFBRTtnQkFDakUsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQztnQkFDNUcsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLG1CQUFtQixLQUFLLG1CQUFtQixFQUFFLENBQUM7b0JBQ2hFLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUM7Z0JBQ3BJLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxzQkFBc0I7UUFDN0IsTUFBTSxVQUFVLEdBQWlCLEVBQUUsQ0FBQztRQUNwQyxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUMxQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsT0FBTyxVQUFVLENBQUM7SUFDbkIsQ0FBQztJQUVPLDBCQUEwQixDQUFDLFNBQTBCO1FBQzVELElBQUksU0FBUyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQy9CLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLCtCQUErQixDQUFDLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUM1RixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDLHVCQUF1QixDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUVPLFNBQVMsQ0FBQyxTQUFpQyxFQUFFLFdBQTJDLEVBQUUsZ0JBQTRDO1FBQzdJLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSwrQkFBK0IsRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUMvTCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDeEIsUUFBUSxFQUFFLGdCQUFnQix1Q0FBK0I7WUFDekQsS0FBSztTQUNMLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDYixJQUFJLENBQUM7Z0JBQ0osSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDZixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ2hDLENBQUM7Z0JBQ0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxXQUFXLEVBQUUsQ0FBQztnQkFDbEMsT0FBTyxNQUFNLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEUsQ0FBQztvQkFBUyxDQUFDO2dCQUNWLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ2YsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQztvQkFDL0QsNkZBQTZGO29CQUM3RixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDaEMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQVMsRUFBRSxjQUE4QjtRQUN0RSxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekUsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUUscUJBQXFCLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUosSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZCLGNBQWMsR0FBRyxjQUFjLElBQUksRUFBRSxDQUFDO1lBQ3RDLElBQUksaUJBQWlCLENBQUMsYUFBYSxLQUFLLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDMUQsY0FBYyxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7WUFDMUksQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGNBQWMsQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7WUFDM0MsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBRU8sa0JBQWtCLENBQUMsU0FBcUIsRUFBRSxPQUEwQixFQUFFLGNBQXVDLEVBQUUsT0FBaUQ7UUFDdkssY0FBYyxHQUFHLGNBQWMsSUFBSSxFQUFFLENBQUM7UUFDdEMsY0FBYyxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUMsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUN6SCxJQUFJLFNBQVMsQ0FBQyxLQUFLLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQyxjQUFjLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3pELGNBQWMsQ0FBQyxTQUFTLGtDQUEwQixDQUFDO1lBQ25ELE9BQU8sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3BHLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxJQUFJLENBQUMsMEJBQTBCLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3RixDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxVQUFnQztRQUMxRSxJQUFJLGtCQUFrQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ25HLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzSSxDQUFDO1FBQ0Qsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDL0YsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDekIseUJBQXlCO1lBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBQ0QsT0FBTyxrQkFBa0IsQ0FBQztJQUMzQixDQUFDO0lBRU8sS0FBSyxDQUFDLDJCQUEyQixDQUFDLFNBQXFCO1FBQzlELElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNuSCxPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3pHLE9BQU87UUFDUixDQUFDO1FBQ0QsTUFBTSxJQUFJLE9BQU8sQ0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNoQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLENBQUMsR0FBRyxFQUFFO2dCQUNuRSxJQUFJLENBQUM7b0JBQ0osSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNuSCxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ3JCLENBQUMsRUFBRSxDQUFDO29CQUNMLENBQUM7Z0JBQ0YsQ0FBQztnQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO29CQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ1YsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sc0JBQXNCLENBQUMsVUFBd0IsRUFBRSxlQUFnQztRQUN4RixNQUFNLE1BQU0sR0FBRyxlQUFlLDZDQUFvQyxJQUFJLGVBQWUsOENBQXFDLENBQUM7UUFDM0gsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLE1BQU0sa0NBQWtDLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLGVBQWUsRUFBRSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDdEosT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsVUFBVSxFQUFFLGtDQUFrQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ3BHLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNySSxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM3QixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDbEYsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDcEUsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMscUJBQXFCLENBQUMsVUFBd0IsRUFBRSxlQUE2QixFQUFFLGVBQWdDO1FBQzVILE1BQU0sYUFBYSxHQUFHLENBQUMsR0FBRyxVQUFVLEVBQUUsR0FBRyxlQUFlLENBQUMsQ0FBQztRQUMxRCxNQUFNLE1BQU0sR0FBRyxlQUFlLDZDQUFvQyxJQUFJLGVBQWUsOENBQXFDLENBQUM7UUFDM0gsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDcEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM1RixJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7d0JBQ2xELEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLG1DQUFtQyxDQUFDO3dCQUM3RSxJQUFJLEVBQUUsUUFBUSxDQUFDLE9BQU87d0JBQ3RCLE9BQU8sRUFBRSxJQUFJLENBQUMsdUNBQXVDLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUM7d0JBQzNGLE9BQU8sRUFBRSxDQUFDO2dDQUNULEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxhQUFhLENBQUM7Z0NBQ2pELEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJOzZCQUNmLENBQUM7d0JBQ0YsWUFBWSxFQUFFOzRCQUNiLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO3lCQUNoQjtxQkFDRCxDQUFDLENBQUM7b0JBQ0gsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNiLE1BQU0sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO29CQUMvQixDQUFDO29CQUNELE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO2dCQUM1RSxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxVQUF3QixFQUFFLFNBQXVCLEVBQUUsZUFBZ0MsRUFBRSxPQUFpRCxFQUFFLFVBQXdCLEVBQUU7UUFDbE0sTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNwQixLQUFLLE1BQU0sU0FBUyxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNqQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3pCLENBQUM7WUFDRCxNQUFNLDJCQUEyQixHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3hELElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUMvQixPQUFPLEtBQUssQ0FBQztnQkFDZCxDQUFDO2dCQUNELE1BQU0sTUFBTSxHQUFHLGVBQWUsNkNBQW9DLElBQUksZUFBZSw4Q0FBcUMsQ0FBQztnQkFDM0gsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUMsZUFBZSw2Q0FBb0MsSUFBSSxDQUFDLENBQUMsZUFBZSw4Q0FBcUMsQ0FBQztnQkFDM0ksSUFBSSxNQUFNLEtBQUssa0JBQWtCLEVBQUUsQ0FBQztvQkFDbkMsT0FBTyxLQUFLLENBQUM7Z0JBQ2QsQ0FBQztnQkFDRCxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLHdGQUF3Rjt1QkFDcEgsQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUM7dUJBQ3RDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FDOUIsQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLFNBQVMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQzsyQkFDakcsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLFNBQVMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUNoRyxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFDSCxJQUFJLDJCQUEyQixDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUN4QywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsMkJBQTJCLEVBQUUsU0FBUyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMvSSxDQUFDO1lBQ0QsT0FBTywyQkFBMkIsQ0FBQztRQUNwQyxDQUFDO1FBQ0QsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRU8sNkJBQTZCLENBQUMsU0FBcUIsRUFBRSxtQkFBaUMsRUFBRSxTQUF1QjtRQUN0SCxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDM0IsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDakMsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3JCLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xGLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUNELElBQUksbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUNELE9BQU8sQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsRUFBRSxHQUFHLG1CQUFtQixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoSSxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTyx1Q0FBdUMsQ0FBQyxTQUFxQixFQUFFLHFCQUFtQyxFQUFFLFVBQXdCO1FBQ25JLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7WUFDdkQsTUFBTSx3QkFBd0IsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUgsSUFBSSx3QkFBd0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDckMsT0FBTyxJQUFJLENBQUMsb0RBQW9ELENBQUMsQ0FBQyxFQUFFLHdCQUF3QixDQUFDLENBQUM7WUFDL0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFTyxvREFBb0QsQ0FBQyxTQUFxQixFQUFFLFVBQXdCO1FBQzNHLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLEVBQUUscUhBQXFILEVBQUUsU0FBUyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdE4sQ0FBQztRQUNELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsK0hBQStILEVBQ3hLLFNBQVMsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUNELE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxzSUFBc0ksRUFDcEwsU0FBUyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxVQUF3QixFQUFFLGVBQWdDO1FBQ3ZGLE9BQU8sTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBTSxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDNUcsQ0FBQztJQU1PLDhCQUE4QjtRQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssc0NBQThCLElBQUksQ0FBQyxDQUFDLEtBQUssd0NBQWdDLENBQUMsRUFBRSxDQUFDO1lBQ2hILElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLFFBQVEscUNBQTZCLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQzlILENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFNBQVMsQ0FBQztRQUNwQyxDQUFDO0lBQ0YsQ0FBQztJQUVPLFlBQVksQ0FBSSxPQUF5QixFQUFFLElBQXNCO1FBQ3hFLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzVELE1BQU0sY0FBYyxHQUFHLHVCQUF1QixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDN0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDMUMsSUFBSSxDQUFDO2dCQUNKLE9BQU8sTUFBTSxjQUFjLENBQUM7WUFDN0IsQ0FBQztvQkFBUyxDQUFDO2dCQUNWLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUMzRCxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUNsQixJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sT0FBTyxDQUFDLEdBQVE7UUFDdkIsSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1FBRXpDLElBQUksOEVBQThFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDbEcsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxTQUFTLENBQUMsR0FBUSxFQUFFLE9BQXlCO1FBQzVDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2xDLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRU8sa0JBQWtCLENBQUMsR0FBUTtRQUNsQyxNQUFNLEtBQUssR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXBELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTdCLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFDLEtBQUssRUFBQyxFQUFFO1lBQ3BDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM5RixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2hCLENBQUMsU0FBUyxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxRyxDQUFDO1lBQ0QsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZixNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN6QyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDNUIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVPLHlCQUF5QjtRQUNoQyxPQUFPLElBQUksQ0FBQyw4QkFBOEIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDakcsQ0FBQztJQUVELDhCQUE4QjtRQUM3QixJQUFJLENBQUM7WUFDSixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQ3RFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLFdBQVcsQ0FBQztZQUNwQixDQUFDO1FBQ0YsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM1QixPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFTyw4QkFBOEIsQ0FBQywyQkFBcUM7UUFDM0UsSUFBSSxDQUFDLGdDQUFnQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBR0QsSUFBWSxnQ0FBZ0M7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDO1lBQzdDLElBQUksQ0FBQyxpQ0FBaUMsR0FBRyxJQUFJLENBQUMsbUNBQW1DLEVBQUUsQ0FBQztRQUNyRixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsaUNBQWlDLENBQUM7SUFDL0MsQ0FBQztJQUVELElBQVksZ0NBQWdDLENBQUMsZ0NBQXdDO1FBQ3BGLElBQUksSUFBSSxDQUFDLGdDQUFnQyxLQUFLLGdDQUFnQyxFQUFFLENBQUM7WUFDaEYsSUFBSSxDQUFDLGlDQUFpQyxHQUFHLGdDQUFnQyxDQUFDO1lBQzFFLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQzVFLENBQUM7SUFDRixDQUFDO0lBRU8sbUNBQW1DO1FBQzFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsMEJBQTBCLHFDQUE0QixJQUFJLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBRU8sbUNBQW1DLENBQUMsS0FBYTtRQUN4RCxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQywwQkFBMEIsRUFBRSxLQUFLLGdFQUErQyxDQUFDO0lBQzVHLENBQUM7SUFFRCwrQkFBK0I7UUFDOUIsSUFBSSxDQUFDO1lBQ0osTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUN2RSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztnQkFDaEMsT0FBTyxXQUFXLENBQUM7WUFDcEIsQ0FBQztRQUNGLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDNUIsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRU8sK0JBQStCLENBQUMsNEJBQXNDO1FBQzdFLElBQUksQ0FBQyxpQ0FBaUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUdELElBQVksaUNBQWlDO1FBQzVDLElBQUksQ0FBQyxJQUFJLENBQUMsa0NBQWtDLEVBQUUsQ0FBQztZQUM5QyxJQUFJLENBQUMsa0NBQWtDLEdBQUcsSUFBSSxDQUFDLG9DQUFvQyxFQUFFLENBQUM7UUFDdkYsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLGtDQUFrQyxDQUFDO0lBQ2hELENBQUM7SUFFRCxJQUFZLGlDQUFpQyxDQUFDLGlDQUF5QztRQUN0RixJQUFJLElBQUksQ0FBQyxpQ0FBaUMsS0FBSyxpQ0FBaUMsRUFBRSxDQUFDO1lBQ2xGLElBQUksQ0FBQyxrQ0FBa0MsR0FBRyxpQ0FBaUMsQ0FBQztZQUM1RSxJQUFJLENBQUMsb0NBQW9DLENBQUMsaUNBQWlDLENBQUMsQ0FBQztRQUM5RSxDQUFDO0lBQ0YsQ0FBQztJQUVPLG9DQUFvQztRQUMzQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxxQ0FBNEIsSUFBSSxDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVPLG9DQUFvQyxDQUFDLEtBQWE7UUFDekQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxnRUFBK0MsQ0FBQztJQUNsSCxDQUFDO0lBRU8seUJBQXlCO1FBQ2hDLElBQUksQ0FBQztZQUNKLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUM7WUFDakUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hDLE9BQU8sV0FBVyxDQUFDO1lBQ3BCLENBQUM7UUFDRixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzVCLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVPLHlCQUF5QixDQUFDLHNCQUFnQztRQUNqRSxJQUFJLENBQUMsMkJBQTJCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFHRCxJQUFZLDJCQUEyQjtRQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7WUFDeEMsSUFBSSxDQUFDLDRCQUE0QixHQUFHLElBQUksQ0FBQyw4QkFBOEIsRUFBRSxDQUFDO1FBQzNFLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyw0QkFBNEIsQ0FBQztJQUMxQyxDQUFDO0lBRUQsSUFBWSwyQkFBMkIsQ0FBQywyQkFBbUM7UUFDMUUsSUFBSSxJQUFJLENBQUMsMkJBQTJCLEtBQUssMkJBQTJCLEVBQUUsQ0FBQztZQUN0RSxJQUFJLENBQUMsNEJBQTRCLEdBQUcsMkJBQTJCLENBQUM7WUFDaEUsSUFBSSxDQUFDLDhCQUE4QixDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDbEUsQ0FBQztJQUNGLENBQUM7SUFFTyw4QkFBOEI7UUFDckMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxzQ0FBc0MsZ0NBQXdCLElBQUksQ0FBQyxDQUFDO0lBQ3BHLENBQUM7SUFFTyw4QkFBOEIsQ0FBQyxLQUFhO1FBQ25ELElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLEtBQUssMkRBQTJDLENBQUM7SUFDcEgsQ0FBQzs7QUFwdUVXLDBCQUEwQjtJQStCcEMsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsb0NBQW9DLENBQUE7SUFDcEMsV0FBQSx3QkFBd0IsQ0FBQTtJQUN4QixXQUFBLGdDQUFnQyxDQUFBO0lBQ2hDLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLG9CQUFvQixDQUFBO0lBQ3BCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxvQ0FBb0MsQ0FBQTtJQUNwQyxZQUFBLFlBQVksQ0FBQTtJQUNaLFlBQUEsZ0JBQWdCLENBQUE7SUFDaEIsWUFBQSxpQ0FBaUMsQ0FBQTtJQUNqQyxZQUFBLGdCQUFnQixDQUFBO0lBQ2hCLFlBQUEsbUNBQW1DLENBQUE7SUFDbkMsWUFBQSx3QkFBd0IsQ0FBQTtJQUN4QixZQUFBLGVBQWUsQ0FBQTtJQUNmLFlBQUEsa0JBQWtCLENBQUE7SUFDbEIsWUFBQSxtQ0FBbUMsQ0FBQTtJQUNuQyxZQUFBLFdBQVcsQ0FBQTtJQUNYLFlBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxjQUFjLENBQUE7SUFDZCxZQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFlBQUEsWUFBWSxDQUFBO0lBQ1osWUFBQSx1QkFBdUIsQ0FBQTtJQUN2QixZQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFlBQUEsZUFBZSxDQUFBO0lBQ2YsWUFBQSxjQUFjLENBQUE7SUFDZCxZQUFBLDhCQUE4QixDQUFBO0lBQzlCLFlBQUEsY0FBYyxDQUFBO0lBQ2QsWUFBQSxtQkFBbUIsQ0FBQTtJQUNuQixZQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFlBQUEsYUFBYSxDQUFBO0lBQ2IsWUFBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFlBQUEseUJBQXlCLENBQUE7R0FsRWYsMEJBQTBCLENBc3VFdEMifQ==