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
import { Barrier } from '../../../base/common/async.js';
import { isUriComponents, URI } from '../../../base/common/uri.js';
import { Event, Emitter } from '../../../base/common/event.js';
import { observableValue, observableValueOpts, transaction } from '../../../base/common/observable.js';
import { DisposableStore, combinedDisposable, dispose, Disposable } from '../../../base/common/lifecycle.js';
import { ISCMService, ISCMViewService } from '../../contrib/scm/common/scm.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { IQuickDiffService } from '../../contrib/scm/common/quickDiff.js';
import { ResourceTree } from '../../../base/common/resourceTree.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { basename } from '../../../base/common/resources.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { ITextModelService } from '../../../editor/common/services/resolverService.js';
import { Schemas } from '../../../base/common/network.js';
import { structuralEquals } from '../../../base/common/equals.js';
import { historyItemBaseRefColor, historyItemRefColor, historyItemRemoteRefColor } from '../../contrib/scm/browser/scmHistory.js';
function getIconFromIconDto(iconDto) {
    if (iconDto === undefined) {
        return undefined;
    }
    else if (ThemeIcon.isThemeIcon(iconDto)) {
        return iconDto;
    }
    else if (isUriComponents(iconDto)) {
        return URI.revive(iconDto);
    }
    else {
        const icon = iconDto;
        return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
    }
}
function toISCMHistoryItem(historyItemDto) {
    const authorIcon = getIconFromIconDto(historyItemDto.authorIcon);
    const references = historyItemDto.references?.map(r => ({
        ...r, icon: getIconFromIconDto(r.icon)
    }));
    return { ...historyItemDto, authorIcon, references };
}
function toISCMHistoryItemRef(historyItemRefDto, color) {
    return historyItemRefDto ? { ...historyItemRefDto, icon: getIconFromIconDto(historyItemRefDto.icon), color: color } : undefined;
}
class SCMInputBoxContentProvider extends Disposable {
    constructor(textModelService, modelService, languageService) {
        super();
        this.modelService = modelService;
        this.languageService = languageService;
        this._register(textModelService.registerTextModelContentProvider(Schemas.vscodeSourceControl, this));
    }
    async provideTextContent(resource) {
        const existing = this.modelService.getModel(resource);
        if (existing) {
            return existing;
        }
        return this.modelService.createModel('', this.languageService.createById('scminput'), resource);
    }
}
class MainThreadSCMResourceGroup {
    get resourceTree() {
        if (!this._resourceTree) {
            const rootUri = this.provider.rootUri ?? URI.file('/');
            this._resourceTree = new ResourceTree(this, rootUri, this._uriIdentService.extUri);
            for (const resource of this.resources) {
                this._resourceTree.add(resource.sourceUri, resource);
            }
        }
        return this._resourceTree;
    }
    get hideWhenEmpty() { return !!this.features.hideWhenEmpty; }
    get contextValue() { return this.features.contextValue; }
    constructor(sourceControlHandle, handle, provider, features, label, id, multiDiffEditorEnableViewChanges, _uriIdentService) {
        this.sourceControlHandle = sourceControlHandle;
        this.handle = handle;
        this.provider = provider;
        this.features = features;
        this.label = label;
        this.id = id;
        this.multiDiffEditorEnableViewChanges = multiDiffEditorEnableViewChanges;
        this._uriIdentService = _uriIdentService;
        this.resources = [];
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
        this._onDidChangeResources = new Emitter();
        this.onDidChangeResources = this._onDidChangeResources.event;
    }
    toJSON() {
        return {
            $mid: 4 /* MarshalledId.ScmResourceGroup */,
            sourceControlHandle: this.sourceControlHandle,
            groupHandle: this.handle
        };
    }
    splice(start, deleteCount, toInsert) {
        this.resources.splice(start, deleteCount, ...toInsert);
        this._resourceTree = undefined;
        this._onDidChangeResources.fire();
    }
    $updateGroup(features) {
        this.features = { ...this.features, ...features };
        this._onDidChange.fire();
    }
    $updateGroupLabel(label) {
        this.label = label;
        this._onDidChange.fire();
    }
}
class MainThreadSCMResource {
    constructor(proxy, sourceControlHandle, groupHandle, handle, sourceUri, resourceGroup, decorations, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri) {
        this.proxy = proxy;
        this.sourceControlHandle = sourceControlHandle;
        this.groupHandle = groupHandle;
        this.handle = handle;
        this.sourceUri = sourceUri;
        this.resourceGroup = resourceGroup;
        this.decorations = decorations;
        this.contextValue = contextValue;
        this.command = command;
        this.multiDiffEditorOriginalUri = multiDiffEditorOriginalUri;
        this.multiDiffEditorModifiedUri = multiDiffEditorModifiedUri;
    }
    open(preserveFocus) {
        return this.proxy.$executeResourceCommand(this.sourceControlHandle, this.groupHandle, this.handle, preserveFocus);
    }
    toJSON() {
        return {
            $mid: 3 /* MarshalledId.ScmResource */,
            sourceControlHandle: this.sourceControlHandle,
            groupHandle: this.groupHandle,
            handle: this.handle
        };
    }
}
class MainThreadSCMHistoryProvider {
    get historyItemRef() { return this._historyItemRef; }
    get historyItemRemoteRef() { return this._historyItemRemoteRef; }
    get historyItemBaseRef() { return this._historyItemBaseRef; }
    get historyItemRefChanges() { return this._historyItemRefChanges; }
    constructor(proxy, handle) {
        this.proxy = proxy;
        this.handle = handle;
        this._historyItemRef = observableValueOpts({
            owner: this,
            equalsFn: structuralEquals
        }, undefined);
        this._historyItemRemoteRef = observableValueOpts({
            owner: this,
            equalsFn: structuralEquals
        }, undefined);
        this._historyItemBaseRef = observableValueOpts({
            owner: this,
            equalsFn: structuralEquals
        }, undefined);
        this._historyItemRefChanges = observableValue(this, { added: [], modified: [], removed: [], silent: false });
    }
    async resolveHistoryItemChatContext(historyItemId, token) {
        return this.proxy.$resolveHistoryItemChatContext(this.handle, historyItemId, token ?? CancellationToken.None);
    }
    async resolveHistoryItemRefsCommonAncestor(historyItemRefs, token) {
        return this.proxy.$resolveHistoryItemRefsCommonAncestor(this.handle, historyItemRefs, token ?? CancellationToken.None);
    }
    async provideHistoryItemRefs(historyItemsRefs, token) {
        const historyItemRefs = await this.proxy.$provideHistoryItemRefs(this.handle, historyItemsRefs, token ?? CancellationToken.None);
        return historyItemRefs?.map(ref => ({ ...ref, icon: getIconFromIconDto(ref.icon) }));
    }
    async provideHistoryItems(options, token) {
        const historyItems = await this.proxy.$provideHistoryItems(this.handle, options, token ?? CancellationToken.None);
        return historyItems?.map(historyItem => toISCMHistoryItem(historyItem));
    }
    async provideHistoryItemChanges(historyItemId, historyItemParentId, token) {
        const changes = await this.proxy.$provideHistoryItemChanges(this.handle, historyItemId, historyItemParentId, token ?? CancellationToken.None);
        return changes?.map(change => ({
            uri: URI.revive(change.uri),
            originalUri: change.originalUri && URI.revive(change.originalUri),
            modifiedUri: change.modifiedUri && URI.revive(change.modifiedUri)
        }));
    }
    $onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
        transaction(tx => {
            this._historyItemRef.set(toISCMHistoryItemRef(historyItemRef, historyItemRefColor), tx);
            this._historyItemRemoteRef.set(toISCMHistoryItemRef(historyItemRemoteRef, historyItemRemoteRefColor), tx);
            this._historyItemBaseRef.set(toISCMHistoryItemRef(historyItemBaseRef, historyItemBaseRefColor), tx);
        });
    }
    $onDidChangeHistoryItemRefs(historyItemRefs) {
        const added = historyItemRefs.added.map(ref => toISCMHistoryItemRef(ref));
        const modified = historyItemRefs.modified.map(ref => toISCMHistoryItemRef(ref));
        const removed = historyItemRefs.removed.map(ref => toISCMHistoryItemRef(ref));
        this._historyItemRefChanges.set({ added, modified, removed, silent: historyItemRefs.silent }, undefined);
    }
}
class MainThreadSCMProvider {
    static { this.ID_HANDLE = 0; }
    get id() { return this._id; }
    get handle() { return this._handle; }
    get label() { return this._label; }
    get rootUri() { return this._rootUri; }
    get inputBoxTextModel() { return this._inputBoxTextModel; }
    get contextValue() { return this._providerId; }
    get acceptInputCommand() { return this.features.acceptInputCommand; }
    get count() { return this._count; }
    get statusBarCommands() { return this._statusBarCommands; }
    get name() { return this._name ?? this._label; }
    get commitTemplate() { return this._commitTemplate; }
    get actionButton() { return this._actionButton; }
    get historyProvider() { return this._historyProvider; }
    constructor(proxy, _handle, _providerId, _label, _rootUri, _inputBoxTextModel, _quickDiffService, _uriIdentService, _workspaceContextService) {
        this.proxy = proxy;
        this._handle = _handle;
        this._providerId = _providerId;
        this._label = _label;
        this._rootUri = _rootUri;
        this._inputBoxTextModel = _inputBoxTextModel;
        this._quickDiffService = _quickDiffService;
        this._uriIdentService = _uriIdentService;
        this._workspaceContextService = _workspaceContextService;
        this._id = `scm${MainThreadSCMProvider.ID_HANDLE++}`;
        this.groups = [];
        this._onDidChangeResourceGroups = new Emitter();
        this.onDidChangeResourceGroups = this._onDidChangeResourceGroups.event;
        this._onDidChangeResources = new Emitter();
        this.onDidChangeResources = this._onDidChangeResources.event;
        this._groupsByHandle = Object.create(null);
        // get groups(): ISequence<ISCMResourceGroup> {
        // 	return {
        // 		elements: this._groups,
        // 		onDidSplice: this._onDidSplice.event
        // 	};
        // 	// return this._groups
        // 	// 	.filter(g => g.resources.elements.length > 0 || !g.features.hideWhenEmpty);
        // }
        this.features = {};
        this._count = observableValue(this, undefined);
        this._statusBarCommands = observableValue(this, undefined);
        this._commitTemplate = observableValue(this, '');
        this._actionButton = observableValue(this, undefined);
        this._historyProvider = observableValue(this, undefined);
        if (_rootUri) {
            const folder = this._workspaceContextService.getWorkspaceFolder(_rootUri);
            if (folder?.uri.toString() === _rootUri.toString()) {
                this._name = folder.name;
            }
            else if (_rootUri.path !== '/') {
                this._name = basename(_rootUri);
            }
        }
    }
    $updateSourceControl(features) {
        this.features = { ...this.features, ...features };
        if (typeof features.commitTemplate !== 'undefined') {
            this._commitTemplate.set(features.commitTemplate, undefined);
        }
        if (typeof features.actionButton !== 'undefined') {
            this._actionButton.set(features.actionButton ?? undefined, undefined);
        }
        if (typeof features.count !== 'undefined') {
            this._count.set(features.count, undefined);
        }
        if (typeof features.statusBarCommands !== 'undefined') {
            this._statusBarCommands.set(features.statusBarCommands, undefined);
        }
        if (features.hasQuickDiffProvider && !this._quickDiff) {
            this._quickDiff = this._quickDiffService.addQuickDiffProvider({
                id: `${this._providerId}.quickDiffProvider`,
                label: features.quickDiffLabel ?? this.label,
                rootUri: this.rootUri,
                kind: 'primary',
                getOriginalResource: async (uri) => {
                    if (!this.features.hasQuickDiffProvider) {
                        return null;
                    }
                    const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
                    return result && URI.revive(result);
                }
            });
        }
        else if (features.hasQuickDiffProvider === false && this._quickDiff) {
            this._quickDiff.dispose();
            this._quickDiff = undefined;
        }
        if (features.hasSecondaryQuickDiffProvider && !this._stagedQuickDiff) {
            this._stagedQuickDiff = this._quickDiffService.addQuickDiffProvider({
                id: `${this._providerId}.secondaryQuickDiffProvider`,
                label: features.secondaryQuickDiffLabel ?? this.label,
                rootUri: this.rootUri,
                kind: 'secondary',
                getOriginalResource: async (uri) => {
                    if (!this.features.hasSecondaryQuickDiffProvider) {
                        return null;
                    }
                    const result = await this.proxy.$provideSecondaryOriginalResource(this.handle, uri, CancellationToken.None);
                    return result && URI.revive(result);
                }
            });
        }
        else if (features.hasSecondaryQuickDiffProvider === false && this._stagedQuickDiff) {
            this._stagedQuickDiff.dispose();
            this._stagedQuickDiff = undefined;
        }
        if (features.hasHistoryProvider && !this.historyProvider.get()) {
            const historyProvider = new MainThreadSCMHistoryProvider(this.proxy, this.handle);
            this._historyProvider.set(historyProvider, undefined);
        }
        else if (features.hasHistoryProvider === false && this.historyProvider.get()) {
            this._historyProvider.set(undefined, undefined);
        }
    }
    $registerGroups(_groups) {
        const groups = _groups.map(([handle, id, label, features, multiDiffEditorEnableViewChanges]) => {
            const group = new MainThreadSCMResourceGroup(this.handle, handle, this, features, label, id, multiDiffEditorEnableViewChanges, this._uriIdentService);
            this._groupsByHandle[handle] = group;
            return group;
        });
        this.groups.splice(this.groups.length, 0, ...groups);
        this._onDidChangeResourceGroups.fire();
    }
    $updateGroup(handle, features) {
        const group = this._groupsByHandle[handle];
        if (!group) {
            return;
        }
        group.$updateGroup(features);
    }
    $updateGroupLabel(handle, label) {
        const group = this._groupsByHandle[handle];
        if (!group) {
            return;
        }
        group.$updateGroupLabel(label);
    }
    $spliceGroupResourceStates(splices) {
        for (const [groupHandle, groupSlices] of splices) {
            const group = this._groupsByHandle[groupHandle];
            if (!group) {
                console.warn(`SCM group ${groupHandle} not found in provider ${this.label}`);
                continue;
            }
            // reverse the splices sequence in order to apply them correctly
            groupSlices.reverse();
            for (const [start, deleteCount, rawResources] of groupSlices) {
                const resources = rawResources.map(rawResource => {
                    const [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri] = rawResource;
                    const [light, dark] = icons;
                    const icon = ThemeIcon.isThemeIcon(light) ? light : URI.revive(light);
                    const iconDark = (ThemeIcon.isThemeIcon(dark) ? dark : URI.revive(dark)) || icon;
                    const decorations = {
                        icon: icon,
                        iconDark: iconDark,
                        tooltip,
                        strikeThrough,
                        faded
                    };
                    return new MainThreadSCMResource(this.proxy, this.handle, groupHandle, handle, URI.revive(sourceUri), group, decorations, contextValue || undefined, command, URI.revive(multiDiffEditorOriginalUri), URI.revive(multiDiffEditorModifiedUri));
                });
                group.splice(start, deleteCount, resources);
            }
        }
        this._onDidChangeResources.fire();
    }
    $unregisterGroup(handle) {
        const group = this._groupsByHandle[handle];
        if (!group) {
            return;
        }
        delete this._groupsByHandle[handle];
        this.groups.splice(this.groups.indexOf(group), 1);
        this._onDidChangeResourceGroups.fire();
    }
    async getOriginalResource(uri) {
        if (!this.features.hasQuickDiffProvider) {
            return null;
        }
        const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
        return result && URI.revive(result);
    }
    $onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
        if (!this.historyProvider.get()) {
            return;
        }
        this._historyProvider.get()?.$onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
    }
    $onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs) {
        if (!this.historyProvider.get()) {
            return;
        }
        this._historyProvider.get()?.$onDidChangeHistoryItemRefs(historyItemRefs);
    }
    toJSON() {
        return {
            $mid: 5 /* MarshalledId.ScmProvider */,
            handle: this.handle
        };
    }
    dispose() {
        this._stagedQuickDiff?.dispose();
        this._quickDiff?.dispose();
    }
}
let MainThreadSCM = class MainThreadSCM {
    constructor(extHostContext, scmService, scmViewService, languageService, modelService, textModelService, quickDiffService, _uriIdentService, workspaceContextService) {
        this.scmService = scmService;
        this.scmViewService = scmViewService;
        this.languageService = languageService;
        this.modelService = modelService;
        this.textModelService = textModelService;
        this.quickDiffService = quickDiffService;
        this._uriIdentService = _uriIdentService;
        this.workspaceContextService = workspaceContextService;
        this._repositories = new Map();
        this._repositoryBarriers = new Map();
        this._repositoryDisposables = new Map();
        this._disposables = new DisposableStore();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSCM);
        this._disposables.add(new SCMInputBoxContentProvider(this.textModelService, this.modelService, this.languageService));
    }
    dispose() {
        dispose(this._repositories.values());
        this._repositories.clear();
        dispose(this._repositoryDisposables.values());
        this._repositoryDisposables.clear();
        this._disposables.dispose();
    }
    async $registerSourceControl(handle, id, label, rootUri, inputBoxDocumentUri) {
        this._repositoryBarriers.set(handle, new Barrier());
        const inputBoxTextModelRef = await this.textModelService.createModelReference(URI.revive(inputBoxDocumentUri));
        const provider = new MainThreadSCMProvider(this._proxy, handle, id, label, rootUri ? URI.revive(rootUri) : undefined, inputBoxTextModelRef.object.textEditorModel, this.quickDiffService, this._uriIdentService, this.workspaceContextService);
        const repository = this.scmService.registerSCMProvider(provider);
        this._repositories.set(handle, repository);
        const disposable = combinedDisposable(inputBoxTextModelRef, Event.filter(this.scmViewService.onDidFocusRepository, r => r === repository)(_ => this._proxy.$setSelectedSourceControl(handle)), repository.input.onDidChange(({ value }) => this._proxy.$onInputBoxValueChange(handle, value)));
        this._repositoryDisposables.set(handle, disposable);
        if (this.scmViewService.focusedRepository === repository) {
            setTimeout(() => this._proxy.$setSelectedSourceControl(handle), 0);
        }
        if (repository.input.value) {
            setTimeout(() => this._proxy.$onInputBoxValueChange(handle, repository.input.value), 0);
        }
        this._repositoryBarriers.get(handle)?.open();
    }
    async $updateSourceControl(handle, features) {
        await this._repositoryBarriers.get(handle)?.wait();
        const repository = this._repositories.get(handle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$updateSourceControl(features);
    }
    async $unregisterSourceControl(handle) {
        await this._repositoryBarriers.get(handle)?.wait();
        const repository = this._repositories.get(handle);
        if (!repository) {
            return;
        }
        this._repositoryDisposables.get(handle).dispose();
        this._repositoryDisposables.delete(handle);
        repository.dispose();
        this._repositories.delete(handle);
    }
    async $registerGroups(sourceControlHandle, groups, splices) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$registerGroups(groups);
        provider.$spliceGroupResourceStates(splices);
    }
    async $updateGroup(sourceControlHandle, groupHandle, features) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$updateGroup(groupHandle, features);
    }
    async $updateGroupLabel(sourceControlHandle, groupHandle, label) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$updateGroupLabel(groupHandle, label);
    }
    async $spliceResourceStates(sourceControlHandle, splices) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$spliceGroupResourceStates(splices);
    }
    async $unregisterGroup(sourceControlHandle, handle) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$unregisterGroup(handle);
    }
    async $setInputBoxValue(sourceControlHandle, value) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.setValue(value, false);
    }
    async $setInputBoxPlaceholder(sourceControlHandle, placeholder) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.placeholder = placeholder;
    }
    async $setInputBoxEnablement(sourceControlHandle, enabled) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.enabled = enabled;
    }
    async $setInputBoxVisibility(sourceControlHandle, visible) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.visible = visible;
    }
    async $showValidationMessage(sourceControlHandle, message, type) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.showValidationMessage(message, type);
    }
    async $setValidationProviderIsEnabled(sourceControlHandle, enabled) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        if (enabled) {
            repository.input.validateInput = async (value, pos) => {
                const result = await this._proxy.$validateInput(sourceControlHandle, value, pos);
                return result && { message: result[0], type: result[1] };
            };
        }
        else {
            repository.input.validateInput = async () => undefined;
        }
    }
    async $onDidChangeHistoryProviderCurrentHistoryItemRefs(sourceControlHandle, historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
    }
    async $onDidChangeHistoryProviderHistoryItemRefs(sourceControlHandle, historyItemRefs) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs);
    }
};
MainThreadSCM = __decorate([
    extHostNamedCustomer(MainContext.MainThreadSCM),
    __param(1, ISCMService),
    __param(2, ISCMViewService),
    __param(3, ILanguageService),
    __param(4, IModelService),
    __param(5, ITextModelService),
    __param(6, IQuickDiffService),
    __param(7, IUriIdentityService),
    __param(8, IWorkspaceContextService)
], MainThreadSCM);
export { MainThreadSCM };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFNDTS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL21haW5UaHJlYWRTQ00udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxlQUFlLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2xGLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFlLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNwSCxPQUFPLEVBQWUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxSCxPQUFPLEVBQUUsV0FBVyxFQUE0RyxlQUFlLEVBQW1ELE1BQU0saUNBQWlDLENBQUM7QUFDMU8sT0FBTyxFQUFFLGNBQWMsRUFBcUcsV0FBVyxFQUE2RSxNQUFNLCtCQUErQixDQUFDO0FBRTFQLE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUV6RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFOUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFMUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFD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