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
import { distinct, isNonEmptyArray } from '../../../base/common/arrays.js';
import { Barrier, createCancelablePromise } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { CancellationError, getErrorMessage, isCancellationError } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { isWeb } from '../../../base/common/platform.js';
import { URI } from '../../../base/common/uri.js';
import * as nls from '../../../nls.js';
import { ExtensionManagementError, IExtensionGalleryService, isTargetPlatformCompatible, TargetPlatformToString, EXTENSION_INSTALL_DEP_PACK_CONTEXT, ExtensionGalleryError, EXTENSION_INSTALL_SOURCE_CONTEXT, ExtensionSignatureVerificationCode, IAllowedExtensionsService } from './extensionManagement.js';
import { areSameExtensions, ExtensionKey, getGalleryExtensionId, getGalleryExtensionTelemetryData, getLocalExtensionTelemetryData, isMalicious } from './extensionManagementUtil.js';
import { isApplicationScopedExtension } from '../../extensions/common/extensions.js';
import { areApiProposalsCompatible } from '../../extensions/common/extensionValidator.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
import { MarkdownString } from '../../../base/common/htmlContent.js';
let CommontExtensionManagementService = class CommontExtensionManagementService extends Disposable {
    constructor(productService, allowedExtensionsService) {
        super();
        this.productService = productService;
        this.allowedExtensionsService = allowedExtensionsService;
        this.preferPreReleases = this.productService.quality !== 'stable';
    }
    async canInstall(extension) {
        const allowedToInstall = this.allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName });
        if (allowedToInstall !== true) {
            return new MarkdownString(nls.localize('not allowed to install', "This extension cannot be installed because {0}", allowedToInstall.value));
        }
        if (!(await this.isExtensionPlatformCompatible(extension))) {
            const learnLink = isWeb ? 'https://aka.ms/vscode-web-extensions-guide' : 'https://aka.ms/vscode-platform-specific-extensions';
            return new MarkdownString(`${nls.localize('incompatible platform', "The '{0}' extension is not available in {1} for the {2}.", extension.displayName ?? extension.identifier.id, this.productService.nameLong, TargetPlatformToString(await this.getTargetPlatform()))} [${nls.localize('learn why', "Learn Why")}](${learnLink})`);
        }
        return true;
    }
    async isExtensionPlatformCompatible(extension) {
        const currentTargetPlatform = await this.getTargetPlatform();
        return extension.allTargetPlatforms.some(targetPlatform => isTargetPlatformCompatible(targetPlatform, extension.allTargetPlatforms, currentTargetPlatform));
    }
};
CommontExtensionManagementService = __decorate([
    __param(0, IProductService),
    __param(1, IAllowedExtensionsService)
], CommontExtensionManagementService);
export { CommontExtensionManagementService };
let AbstractExtensionManagementService = class AbstractExtensionManagementService extends CommontExtensionManagementService {
    get onInstallExtension() { return this._onInstallExtension.event; }
    get onDidInstallExtensions() { return this._onDidInstallExtensions.event; }
    get onUninstallExtension() { return this._onUninstallExtension.event; }
    get onDidUninstallExtension() { return this._onDidUninstallExtension.event; }
    get onDidUpdateExtensionMetadata() { return this._onDidUpdateExtensionMetadata.event; }
    constructor(galleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService) {
        super(productService, allowedExtensionsService);
        this.galleryService = galleryService;
        this.telemetryService = telemetryService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this.userDataProfilesService = userDataProfilesService;
        this.lastReportTimestamp = 0;
        this.installingExtensions = new Map();
        this.uninstallingExtensions = new Map();
        this._onInstallExtension = this._register(new Emitter());
        this._onDidInstallExtensions = this._register(new Emitter());
        this._onUninstallExtension = this._register(new Emitter());
        this._onDidUninstallExtension = this._register(new Emitter());
        this._onDidUpdateExtensionMetadata = this._register(new Emitter());
        this.participants = [];
        this._register(toDisposable(() => {
            this.installingExtensions.forEach(({ task }) => task.cancel());
            this.uninstallingExtensions.forEach(promise => promise.cancel());
            this.installingExtensions.clear();
            this.uninstallingExtensions.clear();
        }));
    }
    async installFromGallery(extension, options = {}) {
        try {
            const results = await this.installGalleryExtensions([{ extension, options }]);
            const result = results.find(({ identifier }) => areSameExtensions(identifier, extension.identifier));
            if (result?.local) {
                return result?.local;
            }
            if (result?.error) {
                throw result.error;
            }
            throw new ExtensionManagementError(`Unknown error while installing extension ${extension.identifier.id}`, "Unknown" /* ExtensionManagementErrorCode.Unknown */);
        }
        catch (error) {
            throw toExtensionManagementError(error);
        }
    }
    async installGalleryExtensions(extensions) {
        if (!this.galleryService.isEnabled()) {
            throw new ExtensionManagementError(nls.localize('MarketPlaceDisabled', "Marketplace is not enabled"), "NotAllowed" /* ExtensionManagementErrorCode.NotAllowed */);
        }
        const results = [];
        const installableExtensions = [];
        await Promise.allSettled(extensions.map(async ({ extension, options }) => {
            try {
                const compatible = await this.checkAndGetCompatibleVersion(extension, !!options?.installGivenVersion, !!options?.installPreReleaseVersion, options.productVersion ?? { version: this.productService.version, date: this.productService.date });
                installableExtensions.push({ ...compatible, options });
            }
            catch (error) {
                results.push({ identifier: extension.identifier, operation: 2 /* InstallOperation.Install */, source: extension, error, profileLocation: options.profileLocation ?? this.getCurrentExtensionsManifestLocation() });
            }
        }));
        if (installableExtensions.length) {
            results.push(...await this.installExtensions(installableExtensions));
        }
        return results;
    }
    async uninstall(extension, options) {
        this.logService.trace('ExtensionManagementService#uninstall', extension.identifier.id);
        return this.uninstallExtensions([{ extension, options }]);
    }
    async toggleApplicationScope(extension, fromProfileLocation) {
        if (isApplicationScopedExtension(extension.manifest) || extension.isBuiltin) {
            return extension;
        }
        if (extension.isApplicationScoped) {
            let local = await this.updateMetadata(extension, { isApplicationScoped: false }, this.userDataProfilesService.defaultProfile.extensionsResource);
            if (!this.uriIdentityService.extUri.isEqual(fromProfileLocation, this.userDataProfilesService.defaultProfile.extensionsResource)) {
                local = await this.copyExtension(extension, this.userDataProfilesService.defaultProfile.extensionsResource, fromProfileLocation);
            }
            for (const profile of this.userDataProfilesService.profiles) {
                const existing = (await this.getInstalled(1 /* ExtensionType.User */, profile.extensionsResource))
                    .find(e => areSameExtensions(e.identifier, extension.identifier));
                if (existing) {
                    this._onDidUpdateExtensionMetadata.fire({ local: existing, profileLocation: profile.extensionsResource });
                }
                else {
                    this._onDidUninstallExtension.fire({ identifier: extension.identifier, profileLocation: profile.extensionsResource });
                }
            }
            return local;
        }
        else {
            const local = this.uriIdentityService.extUri.isEqual(fromProfileLocation, this.userDataProfilesService.defaultProfile.extensionsResource)
                ? await this.updateMetadata(extension, { isApplicationScoped: true }, this.userDataProfilesService.defaultProfile.extensionsResource)
                : await this.copyExtension(extension, fromProfileLocation, this.userDataProfilesService.defaultProfile.extensionsResource, { isApplicationScoped: true });
            this._onDidInstallExtensions.fire([{ identifier: local.identifier, operation: 2 /* InstallOperation.Install */, local, profileLocation: this.userDataProfilesService.defaultProfile.extensionsResource, applicationScoped: true }]);
            return local;
        }
    }
    getExtensionsControlManifest() {
        const now = new Date().getTime();
        if (!this.extensionsControlManifest || now - this.lastReportTimestamp > 1000 * 60 * 5) { // 5 minute cache freshness
            this.extensionsControlManifest = this.updateControlCache();
            this.lastReportTimestamp = now;
        }
        return this.extensionsControlManifest;
    }
    registerParticipant(participant) {
        this.participants.push(participant);
    }
    async resetPinnedStateForAllUserExtensions(pinned) {
        try {
            await this.joinAllSettled(this.userDataProfilesService.profiles.map(async (profile) => {
                const extensions = await this.getInstalled(1 /* ExtensionType.User */, profile.extensionsResource);
                await this.joinAllSettled(extensions.map(async (extension) => {
                    if (extension.pinned !== pinned) {
                        await this.updateMetadata(extension, { pinned }, profile.extensionsResource);
                    }
                }));
            }));
        }
        catch (error) {
            this.logService.error('Error while resetting pinned state for all user extensions', getErrorMessage(error));
            throw error;
        }
    }
    async installExtensions(extensions) {
        const installExtensionResultsMap = new Map();
        const installingExtensionsMap = new Map();
        const alreadyRequestedInstallations = [];
        const getInstallExtensionTaskKey = (extension, profileLocation) => `${ExtensionKey.create(extension).toString()}-${profileLocation.toString()}`;
        const createInstallExtensionTask = (manifest, extension, options, root) => {
            if (!URI.isUri(extension)) {
                if (installingExtensionsMap.has(`${extension.identifier.id.toLowerCase()}-${options.profileLocation.toString()}`)) {
                    return;
                }
                const existingInstallingExtension = this.installingExtensions.get(getInstallExtensionTaskKey(extension, options.profileLocation));
                if (existingInstallingExtension) {
                    if (root && this.canWaitForTask(root, existingInstallingExtension.task)) {
                        const identifier = existingInstallingExtension.task.identifier;
                        this.logService.info('Waiting for already requested installing extension', identifier.id, root.identifier.id, options.profileLocation.toString());
                        existingInstallingExtension.waitingTasks.push(root);
                        // add promise that waits until the extension is completely installed, ie., onDidInstallExtensions event is triggered for this extension
                        alreadyRequestedInstallations.push(Event.toPromise(Event.filter(this.onDidInstallExtensions, results => results.some(result => areSameExtensions(result.identifier, identifier)))).then(results => {
                            this.logService.info('Finished waiting for already requested installing extension', identifier.id, root.identifier.id, options.profileLocation.toString());
                            const result = results.find(result => areSameExtensions(result.identifier, identifier));
                            if (!result?.local) {
                                // Extension failed to install
                                throw new Error(`Extension ${identifier.id} is not installed`);
                            }
                        }));
                    }
                    return;
                }
            }
            const installExtensionTask = this.createInstallExtensionTask(manifest, extension, options);
            const key = `${getGalleryExtensionId(manifest.publisher, manifest.name)}-${options.profileLocation.toString()}`;
            installingExtensionsMap.set(key, { task: installExtensionTask, root });
            this._onInstallExtension.fire({ identifier: installExtensionTask.identifier, source: extension, profileLocation: options.profileLocation });
            this.logService.info('Installing extension:', installExtensionTask.identifier.id, options);
            // only cache gallery extensions tasks
            if (!URI.isUri(extension)) {
                this.installingExtensions.set(getInstallExtensionTaskKey(extension, options.profileLocation), { task: installExtensionTask, waitingTasks: [] });
            }
        };
        try {
            // Start installing extensions
            for (const { manifest, extension, options } of extensions) {
                const isApplicationScoped = options.isApplicationScoped || options.isBuiltin || isApplicationScopedExtension(manifest);
                const installExtensionTaskOptions = {
                    ...options,
                    isApplicationScoped,
                    profileLocation: isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : options.profileLocation ?? this.getCurrentExtensionsManifestLocation(),
                    productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date }
                };
                const existingInstallExtensionTask = !URI.isUri(extension) ? this.installingExtensions.get(getInstallExtensionTaskKey(extension, installExtensionTaskOptions.profileLocation)) : undefined;
                if (existingInstallExtensionTask) {
                    this.logService.info('Extension is already requested to install', existingInstallExtensionTask.task.identifier.id, installExtensionTaskOptions.profileLocation.toString());
                    alreadyRequestedInstallations.push(existingInstallExtensionTask.task.waitUntilTaskIsFinished());
                }
                else {
                    createInstallExtensionTask(manifest, extension, installExtensionTaskOptions, undefined);
                }
            }
            // collect and start installing all dependencies and pack extensions
            await Promise.all([...installingExtensionsMap.values()].map(async ({ task }) => {
                if (task.options.donotIncludePackAndDependencies) {
                    this.logService.info('Installing the extension without checking dependencies and pack', task.identifier.id);
                }
                else {
                    try {
                        let preferPreRelease = this.preferPreReleases;
                        if (task.options.installPreReleaseVersion) {
                            preferPreRelease = true;
                        }
                        else if (!URI.isUri(task.source) && task.source.hasPreReleaseVersion) {
                            // Explicitly asked to install the release version
                            preferPreRelease = false;
                        }
                        const installed = await this.getInstalled(undefined, task.options.profileLocation, task.options.productVersion);
                        const allDepsAndPackExtensionsToInstall = await this.getAllDepsAndPackExtensions(task.identifier, task.manifest, preferPreRelease, task.options.productVersion, installed);
                        const options = { ...task.options, pinned: false, installGivenVersion: false, context: { ...task.options.context, [EXTENSION_INSTALL_DEP_PACK_CONTEXT]: true } };
                        for (const { gallery, manifest } of distinct(allDepsAndPackExtensionsToInstall, ({ gallery }) => gallery.identifier.id)) {
                            const existing = installed.find(e => areSameExtensions(e.identifier, gallery.identifier));
                            // Skip if the extension is already installed and has the same application scope
                            if (existing && existing.isApplicationScoped === !!options.isApplicationScoped) {
                                continue;
                            }
                            createInstallExtensionTask(manifest, gallery, options, task);
                        }
                    }
                    catch (error) {
                        // Installing through VSIX
                        if (URI.isUri(task.source)) {
                            // Ignore installing dependencies and packs
                            if (isNonEmptyArray(task.manifest.extensionDependencies)) {
                                this.logService.warn(`Cannot install dependencies of extension:`, task.identifier.id, error.message);
                            }
                            if (isNonEmptyArray(task.manifest.extensionPack)) {
                                this.logService.warn(`Cannot install packed extensions of extension:`, task.identifier.id, error.message);
                            }
                        }
                        else {
                            this.logService.error('Error while preparing to install dependencies and extension packs of the extension:', task.identifier.id);
                            throw error;
                        }
                    }
                }
            }));
            const otherProfilesToUpdate = await this.getOtherProfilesToUpdateExtension([...installingExtensionsMap.values()].map(({ task }) => task));
            for (const [profileLocation, task] of otherProfilesToUpdate) {
                createInstallExtensionTask(task.manifest, task.source, { ...task.options, profileLocation }, undefined);
            }
            // Install extensions in parallel and wait until all extensions are installed / failed
            await this.joinAllSettled([...installingExtensionsMap.entries()].map(async ([key, { task }]) => {
                const startTime = new Date().getTime();
                let local;
                try {
                    local = await task.run();
                    await this.joinAllSettled(this.participants.map(participant => participant.postInstall(local, task.source, task.options, CancellationToken.None)), "PostInstall" /* ExtensionManagementErrorCode.PostInstall */);
                }
                catch (e) {
                    const error = toExtensionManagementError(e);
                    if (!URI.isUri(task.source)) {
                        reportTelemetry(this.telemetryService, task.operation === 3 /* InstallOperation.Update */ ? 'extensionGallery:update' : 'extensionGallery:install', {
                            extensionData: getGalleryExtensionTelemetryData(task.source),
                            error,
                            source: task.options.context?.[EXTENSION_INSTALL_SOURCE_CONTEXT]
                        });
                    }
                    installExtensionResultsMap.set(key, { error, identifier: task.identifier, operation: task.operation, source: task.source, context: task.options.context, profileLocation: task.options.profileLocation, applicationScoped: task.options.isApplicationScoped });
                    this.logService.error('Error while installing the extension', task.identifier.id, getErrorMessage(error), task.options.profileLocation.toString());
                    throw error;
                }
                if (!URI.isUri(task.source)) {
                    const isUpdate = task.operation === 3 /* InstallOperation.Update */;
                    const durationSinceUpdate = isUpdate ? undefined : (new Date().getTime() - task.source.lastUpdated) / 1000;
                    reportTelemetry(this.telemetryService, isUpdate ? 'extensionGallery:update' : 'extensionGallery:install', {
                        extensionData: getGalleryExtensionTelemetryData(task.source),
                        verificationStatus: task.verificationStatus,
                        duration: new Date().getTime() - startTime,
                        durationSinceUpdate,
                        source: task.options.context?.[EXTENSION_INSTALL_SOURCE_CONTEXT]
                    });
                    // In web, report extension install statistics explicitly. In Desktop, statistics are automatically updated while downloading the VSIX.
                    if (isWeb && task.operation !== 3 /* InstallOperation.Update */) {
                        try {
                            await this.galleryService.reportStatistic(local.manifest.publisher, local.manifest.name, local.manifest.version, "install" /* StatisticType.Install */);
                        }
                        catch (error) { /* ignore */ }
                    }
                }
                installExtensionResultsMap.set(key, { local, identifier: task.identifier, operation: task.operation, source: task.source, context: task.options.context, profileLocation: task.options.profileLocation, applicationScoped: local.isApplicationScoped });
            }));
            if (alreadyRequestedInstallations.length) {
                await this.joinAllSettled(alreadyRequestedInstallations);
            }
        }
        catch (error) {
            const getAllDepsAndPacks = (extension, profileLocation, allDepsOrPacks) => {
                const depsOrPacks = [];
                if (extension.manifest.extensionDependencies?.length) {
                    depsOrPacks.push(...extension.manifest.extensionDependencies);
                }
                if (extension.manifest.extensionPack?.length) {
                    depsOrPacks.push(...extension.manifest.extensionPack);
                }
                for (const id of depsOrPacks) {
                    if (allDepsOrPacks.includes(id.toLowerCase())) {
                        continue;
                    }
                    allDepsOrPacks.push(id.toLowerCase());
                    const installed = installExtensionResultsMap.get(`${id.toLowerCase()}-${profileLocation.toString()}`);
                    if (installed?.local) {
                        allDepsOrPacks = getAllDepsAndPacks(installed.local, profileLocation, allDepsOrPacks);
                    }
                }
                return allDepsOrPacks;
            };
            const getErrorResult = (task) => ({ identifier: task.identifier, operation: 2 /* InstallOperation.Install */, source: task.source, context: task.options.context, profileLocation: task.options.profileLocation, error });
            const rollbackTasks = [];
            for (const [key, { task, root }] of installingExtensionsMap) {
                const result = installExtensionResultsMap.get(key);
                if (!result) {
                    task.cancel();
                    installExtensionResultsMap.set(key, getErrorResult(task));
                }
                // If the extension is installed by a root task and the root task is failed, then uninstall the extension
                else if (result.local && root && !installExtensionResultsMap.get(`${root.identifier.id.toLowerCase()}-${task.options.profileLocation.toString()}`)?.local) {
                    rollbackTasks.push(this.createUninstallExtensionTask(result.local, { versionOnly: true, profileLocation: task.options.profileLocation }));
                    installExtensionResultsMap.set(key, getErrorResult(task));
                }
            }
            for (const [key, { task }] of installingExtensionsMap) {
                const result = installExtensionResultsMap.get(key);
                if (!result?.local) {
                    continue;
                }
                if (task.options.donotIncludePackAndDependencies) {
                    continue;
                }
                const depsOrPacks = getAllDepsAndPacks(result.local, task.options.profileLocation, [result.local.identifier.id.toLowerCase()]).slice(1);
                if (depsOrPacks.some(depOrPack => installingExtensionsMap.has(`${depOrPack.toLowerCase()}-${task.options.profileLocation.toString()}`) && !installExtensionResultsMap.get(`${depOrPack.toLowerCase()}-${task.options.profileLocation.toString()}`)?.local)) {
                    rollbackTasks.push(this.createUninstallExtensionTask(result.local, { versionOnly: true, profileLocation: task.options.profileLocation }));
                    installExtensionResultsMap.set(key, getErrorResult(task));
                }
            }
            if (rollbackTasks.length) {
                await Promise.allSettled(rollbackTasks.map(async (rollbackTask) => {
                    try {
                        await rollbackTask.run();
                        this.logService.info('Rollback: Uninstalled extension', rollbackTask.extension.identifier.id);
                    }
                    catch (error) {
                        this.logService.warn('Rollback: Error while uninstalling extension', rollbackTask.extension.identifier.id, getErrorMessage(error));
                    }
                }));
            }
        }
        finally {
            // Finally, remove all the tasks from the cache
            for (const { task } of installingExtensionsMap.values()) {
                if (task.source && !URI.isUri(task.source)) {
                    this.installingExtensions.delete(getInstallExtensionTaskKey(task.source, task.options.profileLocation));
                }
            }
        }
        const results = [...installExtensionResultsMap.values()];
        for (const result of results) {
            if (result.local) {
                this.logService.info(`Extension installed successfully:`, result.identifier.id, result.profileLocation.toString());
            }
        }
        this._onDidInstallExtensions.fire(results);
        return results;
    }
    async getOtherProfilesToUpdateExtension(tasks) {
        const otherProfilesToUpdate = [];
        const profileExtensionsCache = new ResourceMap();
        for (const task of tasks) {
            if (task.operation !== 3 /* InstallOperation.Update */
                || task.options.isApplicationScoped
                || task.options.pinned
                || task.options.installGivenVersion
                || URI.isUri(task.source)) {
                continue;
            }
            for (const profile of this.userDataProfilesService.profiles) {
                if (this.uriIdentityService.extUri.isEqual(profile.extensionsResource, task.options.profileLocation)) {
                    continue;
                }
                let installedExtensions = profileExtensionsCache.get(profile.extensionsResource);
                if (!installedExtensions) {
                    installedExtensions = await this.getInstalled(1 /* ExtensionType.User */, profile.extensionsResource);
                    profileExtensionsCache.set(profile.extensionsResource, installedExtensions);
                }
                const installedExtension = installedExtensions.find(e => areSameExtensions(e.identifier, task.identifier));
                if (installedExtension && !installedExtension.pinned) {
                    otherProfilesToUpdate.push([profile.extensionsResource, task]);
                }
            }
        }
        return otherProfilesToUpdate;
    }
    canWaitForTask(taskToWait, taskToWaitFor) {
        for (const [, { task, waitingTasks }] of this.installingExtensions.entries()) {
            if (task === taskToWait) {
                // Cannot be waited, If taskToWaitFor is waiting for taskToWait
                if (waitingTasks.includes(taskToWaitFor)) {
                    return false;
                }
                // Cannot be waited, If taskToWaitFor is waiting for tasks waiting for taskToWait
                if (waitingTasks.some(waitingTask => this.canWaitForTask(waitingTask, taskToWaitFor))) {
                    return false;
                }
            }
            // Cannot be waited, if the taskToWait cannot be waited for the task created the taskToWaitFor
            // Because, the task waits for the tasks it created
            if (task === taskToWaitFor && waitingTasks[0] && !this.canWaitForTask(taskToWait, waitingTasks[0])) {
                return false;
            }
        }
        return true;
    }
    async joinAllSettled(promises, errorCode) {
        const results = [];
        const errors = [];
        const promiseResults = await Promise.allSettled(promises);
        for (const r of promiseResults) {
            if (r.status === 'fulfilled') {
                results.push(r.value);
            }
            else {
                errors.push(toExtensionManagementError(r.reason, errorCode));
            }
        }
        if (!errors.length) {
            return results;
        }
        // Throw if there are errors
        if (errors.length === 1) {
            throw errors[0];
        }
        let error = new ExtensionManagementError('', "Unknown" /* ExtensionManagementErrorCode.Unknown */);
        for (const current of errors) {
            error = new ExtensionManagementError(error.message ? `${error.message}, ${current.message}` : current.message, current.code !== "Unknown" /* ExtensionManagementErrorCode.Unknown */ && current.code !== "Internal" /* ExtensionManagementErrorCode.Internal */ ? current.code : error.code);
        }
        throw error;
    }
    async getAllDepsAndPackExtensions(extensionIdentifier, manifest, preferPreRelease, productVersion, installed) {
        if (!this.galleryService.isEnabled()) {
            return [];
        }
        const knownIdentifiers = [];
        const allDependenciesAndPacks = [];
        const collectDependenciesAndPackExtensionsToInstall = async (extensionIdentifier, manifest) => {
            knownIdentifiers.push(extensionIdentifier);
            const dependecies = manifest.extensionDependencies || [];
            const dependenciesAndPackExtensions = [...dependecies];
            if (manifest.extensionPack) {
                const existing = installed.find(e => areSameExtensions(e.identifier, extensionIdentifier));
                for (const extension of manifest.extensionPack) {
                    // add only those extensions which are new in currently installed extension
                    if (!(existing && existing.manifest.extensionPack && existing.manifest.extensionPack.some(old => areSameExtensions({ id: old }, { id: extension })))) {
                        if (dependenciesAndPackExtensions.every(e => !areSameExtensions({ id: e }, { id: extension }))) {
                            dependenciesAndPackExtensions.push(extension);
                        }
                    }
                }
            }
            if (dependenciesAndPackExtensions.length) {
                // filter out known extensions
                const ids = dependenciesAndPackExtensions.filter(id => knownIdentifiers.every(galleryIdentifier => !areSameExtensions(galleryIdentifier, { id })));
                if (ids.length) {
                    const galleryExtensions = await this.galleryService.getExtensions(ids.map(id => ({ id, preRelease: preferPreRelease })), CancellationToken.None);
                    for (const galleryExtension of galleryExtensions) {
                        if (knownIdentifiers.find(identifier => areSameExtensions(identifier, galleryExtension.identifier))) {
                            continue;
                        }
                        const isDependency = dependecies.some(id => areSameExtensions({ id }, galleryExtension.identifier));
                        let compatible;
                        try {
                            compatible = await this.checkAndGetCompatibleVersion(galleryExtension, false, preferPreRelease, productVersion);
                        }
                        catch (error) {
                            if (!isDependency) {
                                this.logService.info('Skipping the packed extension as it cannot be installed', galleryExtension.identifier.id, getErrorMessage(error));
                                continue;
                            }
                            else {
                                throw error;
                            }
                        }
                        allDependenciesAndPacks.push({ gallery: compatible.extension, manifest: compatible.manifest });
                        await collectDependenciesAndPackExtensionsToInstall(compatible.extension.identifier, compatible.manifest);
                    }
                }
            }
        };
        await collectDependenciesAndPackExtensionsToInstall(extensionIdentifier, manifest);
        return allDependenciesAndPacks;
    }
    async checkAndGetCompatibleVersion(extension, sameVersion, installPreRelease, productVersion) {
        let compatibleExtension;
        const extensionsControlManifest = await this.getExtensionsControlManifest();
        if (isMalicious(extension.identifier, extensionsControlManifest.malicious)) {
            throw new ExtensionManagementError(nls.localize('malicious extension', "Can't install '{0}' extension since it was reported to be problematic.", extension.identifier.id), "Malicious" /* ExtensionManagementErrorCode.Malicious */);
        }
        const deprecationInfo = extensionsControlManifest.deprecated[extension.identifier.id.toLowerCase()];
        if (deprecationInfo?.extension?.autoMigrate) {
            this.logService.info(`The '${extension.identifier.id}' extension is deprecated, fetching the compatible '${deprecationInfo.extension.id}' extension instead.`);
            compatibleExtension = (await this.galleryService.getExtensions([{ id: deprecationInfo.extension.id, preRelease: deprecationInfo.extension.preRelease }], { targetPlatform: await this.getTargetPlatform(), compatible: true, productVersion }, CancellationToken.None))[0];
            if (!compatibleExtension) {
                throw new ExtensionManagementError(nls.localize('notFoundDeprecatedReplacementExtension', "Can't install '{0}' extension since it was deprecated and the replacement extension '{1}' can't be found.", extension.identifier.id, deprecationInfo.extension.id), "Deprecated" /* ExtensionManagementErrorCode.Deprecated */);
            }
        }
        else {
            if (await this.canInstall(extension) !== true) {
                const targetPlatform = await this.getTargetPlatform();
                throw new ExtensionManagementError(nls.localize('incompatible platform', "The '{0}' extension is not available in {1} for the {2}.", extension.identifier.id, this.productService.nameLong, TargetPlatformToString(targetPlatform)), "IncompatibleTargetPlatform" /* ExtensionManagementErrorCode.IncompatibleTargetPlatform */);
            }
            compatibleExtension = await this.getCompatibleVersion(extension, sameVersion, installPreRelease, productVersion);
            if (!compatibleExtension) {
                const incompatibleApiProposalsMessages = [];
                if (!areApiProposalsCompatible(extension.properties.enabledApiProposals ?? [], incompatibleApiProposalsMessages)) {
                    throw new ExtensionManagementError(nls.localize('incompatibleAPI', "Can't install '{0}' extension. {1}", extension.displayName ?? extension.identifier.id, incompatibleApiProposalsMessages[0]), "IncompatibleApi" /* ExtensionManagementErrorCode.IncompatibleApi */);
                }
                /** If no compatible release version is found, check if the extension has a release version or not and throw relevant error */
                if (!installPreRelease && extension.hasPreReleaseVersion && extension.properties.isPreReleaseVersion && (await this.galleryService.getExtensions([extension.identifier], CancellationToken.None))[0]) {
                    throw new ExtensionManagementError(nls.localize('notFoundReleaseExtension', "Can't install release version of '{0}' extension because it has no release version.", extension.displayName ?? extension.identifier.id), "ReleaseVersionNotFound" /* ExtensionManagementErrorCode.ReleaseVersionNotFound */);
                }
                throw new ExtensionManagementError(nls.localize('notFoundCompatibleDependency', "Can't install '{0}' extension because it is not compatible with the current version of {1} (version {2}).", extension.identifier.id, this.productService.nameLong, this.productService.version), "Incompatible" /* ExtensionManagementErrorCode.Incompatible */);
            }
        }
        this.logService.info('Getting Manifest...', compatibleExtension.identifier.id);
        const manifest = await this.galleryService.getManifest(compatibleExtension, CancellationToken.None);
        if (manifest === null) {
            throw new ExtensionManagementError(`Missing manifest for extension ${compatibleExtension.identifier.id}`, "Invalid" /* ExtensionManagementErrorCode.Invalid */);
        }
        if (manifest.version !== compatibleExtension.version) {
            throw new ExtensionManagementError(`Cannot install '${compatibleExtension.identifier.id}' extension because of version mismatch in Marketplace`, "Invalid" /* ExtensionManagementErrorCode.Invalid */);
        }
        return { extension: compatibleExtension, manifest };
    }
    async getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion) {
        const targetPlatform = await this.getTargetPlatform();
        let compatibleExtension = null;
        if (!sameVersion && extension.hasPreReleaseVersion && extension.properties.isPreReleaseVersion !== includePreRelease) {
            compatibleExtension = (await this.galleryService.getExtensions([{ ...extension.identifier, preRelease: includePreRelease }], { targetPlatform, compatible: true, productVersion }, CancellationToken.None))[0] || null;
        }
        if (!compatibleExtension && await this.galleryService.isExtensionCompatible(extension, includePreRelease, targetPlatform, productVersion)) {
            compatibleExtension = extension;
        }
        if (!compatibleExtension) {
            if (sameVersion) {
                compatibleExtension = (await this.galleryService.getExtensions([{ ...extension.identifier, version: extension.version }], { targetPlatform, compatible: true, productVersion }, CancellationToken.None))[0] || null;
            }
            else {
                compatibleExtension = await this.galleryService.getCompatibleExtension(extension, includePreRelease, targetPlatform, productVersion);
            }
        }
        return compatibleExtension;
    }
    async uninstallExtensions(extensions) {
        const getUninstallExtensionTaskKey = (extension, uninstallOptions) => `${extension.identifier.id.toLowerCase()}${uninstallOptions.versionOnly ? `-${extension.manifest.version}` : ''}@${uninstallOptions.profileLocation.toString()}`;
        const createUninstallExtensionTask = (extension, uninstallOptions) => {
            const uninstallExtensionTask = this.createUninstallExtensionTask(extension, uninstallOptions);
            this.uninstallingExtensions.set(getUninstallExtensionTaskKey(uninstallExtensionTask.extension, uninstallOptions), uninstallExtensionTask);
            this.logService.info('Uninstalling extension from the profile:', `${extension.identifier.id}@${extension.manifest.version}`, uninstallOptions.profileLocation.toString());
            this._onUninstallExtension.fire({ identifier: extension.identifier, profileLocation: uninstallOptions.profileLocation, applicationScoped: extension.isApplicationScoped });
            return uninstallExtensionTask;
        };
        const postUninstallExtension = (extension, uninstallOptions, error) => {
            if (error) {
                this.logService.error('Failed to uninstall extension from the profile:', `${extension.identifier.id}@${extension.manifest.version}`, uninstallOptions.profileLocation.toString(), error.message);
            }
            else {
                this.logService.info('Successfully uninstalled extension from the profile', `${extension.identifier.id}@${extension.manifest.version}`, uninstallOptions.profileLocation.toString());
            }
            reportTelemetry(this.telemetryService, 'extensionGallery:uninstall', { extensionData: getLocalExtensionTelemetryData(extension), error });
            this._onDidUninstallExtension.fire({ identifier: extension.identifier, error: error?.code, profileLocation: uninstallOptions.profileLocation, applicationScoped: extension.isApplicationScoped });
        };
        const allTasks = [];
        const processedTasks = [];
        const alreadyRequestedUninstalls = [];
        const extensionsToRemove = [];
        const installedExtensionsMap = new ResourceMap();
        const getInstalledExtensions = async (profileLocation) => {
            let installed = installedExtensionsMap.get(profileLocation);
            if (!installed) {
                installedExtensionsMap.set(profileLocation, installed = await this.getInstalled(1 /* ExtensionType.User */, profileLocation));
            }
            return installed;
        };
        for (const { extension, options } of extensions) {
            const uninstallOptions = {
                ...options,
                profileLocation: extension.isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : options?.profileLocation ?? this.getCurrentExtensionsManifestLocation()
            };
            const uninstallExtensionTask = this.uninstallingExtensions.get(getUninstallExtensionTaskKey(extension, uninstallOptions));
            if (uninstallExtensionTask) {
                this.logService.info('Extensions is already requested to uninstall', extension.identifier.id);
                alreadyRequestedUninstalls.push(uninstallExtensionTask.waitUntilTaskIsFinished());
            }
            else {
                allTasks.push(createUninstallExtensionTask(extension, uninstallOptions));
            }
            if (uninstallOptions.remove || extension.isApplicationScoped) {
                if (uninstallOptions.remove) {
                    extensionsToRemove.push(extension);
                }
                for (const profile of this.userDataProfilesService.profiles) {
                    if (this.uriIdentityService.extUri.isEqual(profile.extensionsResource, uninstallOptions.profileLocation)) {
                        continue;
                    }
                    const installed = await getInstalledExtensions(profile.extensionsResource);
                    const profileExtension = installed.find(e => areSameExtensions(e.identifier, extension.identifier));
                    if (profileExtension) {
                        const uninstallOptionsWithProfile = { ...uninstallOptions, profileLocation: profile.extensionsResource };
                        const uninstallExtensionTask = this.uninstallingExtensions.get(getUninstallExtensionTaskKey(profileExtension, uninstallOptionsWithProfile));
                        if (uninstallExtensionTask) {
                            this.logService.info('Extensions is already requested to uninstall', profileExtension.identifier.id);
                            alreadyRequestedUninstalls.push(uninstallExtensionTask.waitUntilTaskIsFinished());
                        }
                        else {
                            allTasks.push(createUninstallExtensionTask(profileExtension, uninstallOptionsWithProfile));
                        }
                    }
                }
            }
        }
        try {
            for (const task of allTasks.slice(0)) {
                const installed = await getInstalledExtensions(task.options.profileLocation);
                if (task.options.donotIncludePack) {
                    this.logService.info('Uninstalling the extension without including packed extension', `${task.extension.identifier.id}@${task.extension.manifest.version}`);
                }
                else {
                    const packedExtensions = this.getAllPackExtensionsToUninstall(task.extension, installed);
                    for (const packedExtension of packedExtensions) {
                        if (this.uninstallingExtensions.has(getUninstallExtensionTaskKey(packedExtension, task.options))) {
                            this.logService.info('Extensions is already requested to uninstall', packedExtension.identifier.id);
                        }
                        else {
                            allTasks.push(createUninstallExtensionTask(packedExtension, task.options));
                        }
                    }
                }
                if (task.options.donotCheckDependents) {
                    this.logService.info('Uninstalling the extension without checking dependents', `${task.extension.identifier.id}@${task.extension.manifest.version}`);
                }
                else {
                    this.checkForDependents(allTasks.map(task => task.extension), installed, task.extension);
                }
            }
            // Uninstall extensions in parallel and wait until all extensions are uninstalled / failed
            await this.joinAllSettled(allTasks.map(async (task) => {
                try {
                    await task.run();
                    await this.joinAllSettled(this.participants.map(participant => participant.postUninstall(task.extension, task.options, CancellationToken.None)));
                    // only report if extension has a mapped gallery extension. UUID identifies the gallery extension.
                    if (task.extension.identifier.uuid) {
                        try {
                            await this.galleryService.reportStatistic(task.extension.manifest.publisher, task.extension.manifest.name, task.extension.manifest.version, "uninstall" /* StatisticType.Uninstall */);
                        }
                        catch (error) { /* ignore */ }
                    }
                }
                catch (e) {
                    const error = toExtensionManagementError(e);
                    postUninstallExtension(task.extension, task.options, error);
                    throw error;
                }
                finally {
                    processedTasks.push(task);
                }
            }));
            if (alreadyRequestedUninstalls.length) {
                await this.joinAllSettled(alreadyRequestedUninstalls);
            }
            for (const task of allTasks) {
                postUninstallExtension(task.extension, task.options);
            }
            if (extensionsToRemove.length) {
                await this.joinAllSettled(extensionsToRemove.map(extension => this.deleteExtension(extension)));
            }
        }
        catch (e) {
            const error = toExtensionManagementError(e);
            for (const task of allTasks) {
                // cancel the tasks
                try {
                    task.cancel();
                }
                catch (error) { /* ignore */ }
                if (!processedTasks.includes(task)) {
                    postUninstallExtension(task.extension, task.options, error);
                }
            }
            throw error;
        }
        finally {
            // Remove tasks from cache
            for (const task of allTasks) {
                if (!this.uninstallingExtensions.delete(getUninstallExtensionTaskKey(task.extension, task.options))) {
                    this.logService.warn('Uninstallation task is not found in the cache', task.extension.identifier.id);
                }
            }
        }
    }
    checkForDependents(extensionsToUninstall, installed, extensionToUninstall) {
        for (const extension of extensionsToUninstall) {
            const dependents = this.getDependents(extension, installed);
            if (dependents.length) {
                const remainingDependents = dependents.filter(dependent => !extensionsToUninstall.some(e => areSameExtensions(e.identifier, dependent.identifier)));
                if (remainingDependents.length) {
                    throw new Error(this.getDependentsErrorMessage(extension, remainingDependents, extensionToUninstall));
                }
            }
        }
    }
    getDependentsErrorMessage(dependingExtension, dependents, extensionToUninstall) {
        if (extensionToUninstall === dependingExtension) {
            if (dependents.length === 1) {
                return nls.localize('singleDependentError', "Cannot uninstall '{0}' extension. '{1}' extension depends on this.", extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name, dependents[0].manifest.displayName || dependents[0].manifest.name);
            }
            if (dependents.length === 2) {
                return nls.localize('twoDependentsError', "Cannot uninstall '{0}' extension. '{1}' and '{2}' extensions depend on this.", extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name, dependents[0].manifest.displayName || dependents[0].manifest.name, dependents[1].manifest.displayName || dependents[1].manifest.name);
            }
            return nls.localize('multipleDependentsError', "Cannot uninstall '{0}' extension. '{1}', '{2}' and other extension depend on this.", extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name, dependents[0].manifest.displayName || dependents[0].manifest.name, dependents[1].manifest.displayName || dependents[1].manifest.name);
        }
        if (dependents.length === 1) {
            return nls.localize('singleIndirectDependentError', "Cannot uninstall '{0}' extension . It includes uninstalling '{1}' extension and '{2}' extension depends on this.", extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name, dependingExtension.manifest.displayName
                || dependingExtension.manifest.name, dependents[0].manifest.displayName || dependents[0].manifest.name);
        }
        if (dependents.length === 2) {
            return nls.localize('twoIndirectDependentsError', "Cannot uninstall '{0}' extension. It includes uninstalling '{1}' extension and '{2}' and '{3}' extensions depend on this.", extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name, dependingExtension.manifest.displayName
                || dependingExtension.manifest.name, dependents[0].manifest.displayName || dependents[0].manifest.name, dependents[1].manifest.displayName || dependents[1].manifest.name);
        }
        return nls.localize('multipleIndirectDependentsError', "Cannot uninstall '{0}' extension. It includes uninstalling '{1}' extension and '{2}', '{3}' and other extensions depend on this.", extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name, dependingExtension.manifest.displayName
            || dependingExtension.manifest.name, dependents[0].manifest.displayName || dependents[0].manifest.name, dependents[1].manifest.displayName || dependents[1].manifest.name);
    }
    getAllPackExtensionsToUninstall(extension, installed, checked = []) {
        if (checked.indexOf(extension) !== -1) {
            return [];
        }
        checked.push(extension);
        const extensionsPack = extension.manifest.extensionPack ? extension.manifest.extensionPack : [];
        if (extensionsPack.length) {
            const packedExtensions = installed.filter(i => !i.isBuiltin && extensionsPack.some(id => areSameExtensions({ id }, i.identifier)));
            const packOfPackedExtensions = [];
            for (const packedExtension of packedExtensions) {
                packOfPackedExtensions.push(...this.getAllPackExtensionsToUninstall(packedExtension, installed, checked));
            }
            return [...packedExtensions, ...packOfPackedExtensions];
        }
        return [];
    }
    getDependents(extension, installed) {
        return installed.filter(e => e.manifest.extensionDependencies && e.manifest.extensionDependencies.some(id => areSameExtensions({ id }, extension.identifier)));
    }
    async updateControlCache() {
        try {
            this.logService.trace('ExtensionManagementService.updateControlCache');
            return await this.galleryService.getExtensionsControlManifest();
        }
        catch (err) {
            this.logService.trace('ExtensionManagementService.refreshControlCache - failed to get extension control manifest', getErrorMessage(err));
            return { malicious: [], deprecated: {}, search: [] };
        }
    }
};
AbstractExtensionManagementService = __decorate([
    __param(0, IExtensionGalleryService),
    __param(1, ITelemetryService),
    __param(2, IUriIdentityService),
    __param(3, ILogService),
    __param(4, IProductService),
    __param(5, IAllowedExtensionsService),
    __param(6, IUserDataProfilesService)
], AbstractExtensionManagementService);
export { AbstractExtensionManagementService };
export function toExtensionManagementError(error, code) {
    if (error instanceof ExtensionManagementError) {
        return error;
    }
    let extensionManagementError;
    if (error instanceof ExtensionGalleryError) {
        extensionManagementError = new ExtensionManagementError(error.message, error.code === "DownloadFailedWriting" /* ExtensionGalleryErrorCode.DownloadFailedWriting */ ? "DownloadFailedWriting" /* ExtensionManagementErrorCode.DownloadFailedWriting */ : "Gallery" /* ExtensionManagementErrorCode.Gallery */);
    }
    else {
        extensionManagementError = new ExtensionManagementError(error.message, isCancellationError(error) ? "Cancelled" /* ExtensionManagementErrorCode.Cancelled */ : (code ?? "Internal" /* ExtensionManagementErrorCode.Internal */));
    }
    extensionManagementError.stack = error.stack;
    return extensionManagementError;
}
function reportTelemetry(telemetryService, eventName, { extensionData, verificationStatus, duration, error, source, durationSinceUpdate }) {
    /* __GDPR__
        "extensionGallery:install" : {
            "owner": "sandy081",
            "success": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
            "duration" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
            "durationSinceUpdate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
            "errorcode": { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth" },
            "recommendationReason": { "retiredFromVersion": "1.23.0", "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
            "verificationStatus" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
            "source": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
            "${include}": [
                "${GalleryExtensionTelemetryData}"
            ]
        }
    */
    /* __GDPR__
        "extensionGallery:uninstall" : {
            "owner": "sandy081",
            "success": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
            "duration" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
            "errorcode": { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth" },
            "${include}": [
                "${GalleryExtensionTelemetryData}"
            ]
        }
    */
    /* __GDPR__
        "extensionGallery:update" : {
            "owner": "sandy081",
            "success": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
            "duration" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
            "errorcode": { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth" },
            "verificationStatus" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
            "source": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
            "${include}": [
                "${GalleryExtensionTelemetryData}"
            ]
        }
    */
    telemetryService.publicLog(eventName, {
        ...extensionData,
        source,
        duration,
        durationSinceUpdate,
        success: !error,
        errorcode: error?.code,
        verificationStatus: verificationStatus === ExtensionSignatureVerificationCode.Success ? 'Verified' : (verificationStatus ?? 'Unverified')
    });
}
export class AbstractExtensionTask {
    constructor() {
        this.barrier = new Barrier();
    }
    async waitUntilTaskIsFinished() {
        await this.barrier.wait();
        return this.cancellablePromise;
    }
    run() {
        if (!this.cancellablePromise) {
            this.cancellablePromise = createCancelablePromise(token => this.doRun(token));
        }
        this.barrier.open();
        return this.cancellablePromise;
    }
    cancel() {
        if (!this.cancellablePromise) {
            this.cancellablePromise = createCancelablePromise(token => {
                return new Promise((c, e) => {
                    const disposable = token.onCancellationRequested(() => {
                        disposable.dispose();
                        e(new CancellationError());
                    });
                });
            });
            this.barrier.open();
        }
        this.cancellablePromise.cancel();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vYWJzdHJhY3RFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDcEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDMUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEtBQUssR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFDTix3QkFBd0IsRUFBRSx3QkFBd0IsRUFDUCwwQkFBMEIsRUFBRSxzQkFBc0IsRUFDc0csa0NBQWtDLEVBQUUscUJBQXFCLEVBRTVQLGdDQUFnQyxFQUdoQyxrQ0FBa0MsRUFDbEMseUJBQXlCLEVBQ3pCLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxFQUFF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