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
import './media/timelinePane.css';
import { localize, localize2 } from '../../../../nls.js';
import * as DOM from '../../../../base/browser/dom.js';
import * as css from '../../../../base/browser/cssValue.js';
import { ActionRunner } from '../../../../base/common/actions.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { fromNow } from '../../../../base/common/date.js';
import { debounce } from '../../../../base/common/decorators.js';
import { Emitter } from '../../../../base/common/event.js';
import { createMatches } from '../../../../base/common/filters.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { DisposableStore, Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { escapeRegExpCharacters } from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITimelineService } from '../common/timeline.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { SideBySideEditor, EditorResourceAccessor } from '../../../common/editor.js';
import { ICommandService, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { getContextMenuActions, createActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId, registerAction2, Action2, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from '../../../browser/parts/editor/editorCommands.js';
import { isString } from '../../../../base/common/types.js';
import { renderMarkdownAsPlaintext } from '../../../../base/browser/markdownRenderer.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IHoverService, WorkbenchHoverDelegate } from '../../../../platform/hover/browser/hover.js';
const ItemHeight = 22;
function isLoadMoreCommand(item) {
    return item instanceof LoadMoreCommand;
}
function isTimelineItem(item) {
    return !!item && !item.handle.startsWith('vscode-command:');
}
function updateRelativeTime(item, lastRelativeTime) {
    item.relativeTime = isTimelineItem(item) ? fromNow(item.timestamp) : undefined;
    item.relativeTimeFullWord = isTimelineItem(item) ? fromNow(item.timestamp, false, true) : undefined;
    if (lastRelativeTime === undefined || item.relativeTime !== lastRelativeTime) {
        lastRelativeTime = item.relativeTime;
        item.hideRelativeTime = false;
    }
    else {
        item.hideRelativeTime = true;
    }
    return lastRelativeTime;
}
class TimelineAggregate {
    constructor(timeline) {
        this._stale = false;
        this._requiresReset = false;
        this.source = timeline.source;
        this.items = timeline.items;
        this._cursor = timeline.paging?.cursor;
        this.lastRenderedIndex = -1;
    }
    get cursor() {
        return this._cursor;
    }
    get more() {
        return this._cursor !== undefined;
    }
    get newest() {
        return this.items[0];
    }
    get oldest() {
        return this.items[this.items.length - 1];
    }
    add(timeline, options) {
        let updated = false;
        if (timeline.items.length !== 0 && this.items.length !== 0) {
            updated = true;
            const ids = new Set();
            const timestamps = new Set();
            for (const item of timeline.items) {
                if (item.id === undefined) {
                    timestamps.add(item.timestamp);
                }
                else {
                    ids.add(item.id);
                }
            }
            // Remove any duplicate items
            let i = this.items.length;
            let item;
            while (i--) {
                item = this.items[i];
                if ((item.id !== undefined && ids.has(item.id)) || timestamps.has(item.timestamp)) {
                    this.items.splice(i, 1);
                }
            }
            if ((timeline.items[timeline.items.length - 1]?.timestamp ?? 0) >= (this.newest?.timestamp ?? 0)) {
                this.items.splice(0, 0, ...timeline.items);
            }
            else {
                this.items.push(...timeline.items);
            }
        }
        else if (timeline.items.length !== 0) {
            updated = true;
            this.items.push(...timeline.items);
        }
        // If we are not requesting more recent items than we have, then update the cursor
        if (options.cursor !== undefined || typeof options.limit !== 'object') {
            this._cursor = timeline.paging?.cursor;
        }
        if (updated) {
            this.items.sort((a, b) => (b.timestamp - a.timestamp) ||
                (a.source === undefined
                    ? b.source === undefined ? 0 : 1
                    : b.source === undefined ? -1 : b.source.localeCompare(a.source, undefined, { numeric: true, sensitivity: 'base' })));
        }
        return updated;
    }
    get stale() {
        return this._stale;
    }
    get requiresReset() {
        return this._requiresReset;
    }
    invalidate(requiresReset) {
        this._stale = true;
        this._requiresReset = requiresReset;
    }
}
class LoadMoreCommand {
    constructor(loading) {
        this.handle = 'vscode-command:loadMore';
        this.timestamp = 0;
        this.description = undefined;
        this.tooltip = undefined;
        this.contextValue = undefined;
        // Make things easier for duck typing
        this.id = undefined;
        this.icon = undefined;
        this.iconDark = undefined;
        this.source = undefined;
        this.relativeTime = undefined;
        this.relativeTimeFullWord = undefined;
        this.hideRelativeTime = undefined;
        this._loading = false;
        this._loading = loading;
    }
    get loading() {
        return this._loading;
    }
    set loading(value) {
        this._loading = value;
    }
    get ariaLabel() {
        return this.label;
    }
    get label() {
        return this.loading ? localize('timeline.loadingMore', "Loading...") : localize('timeline.loadMore', "Load more");
    }
    get themeIcon() {
        return undefined;
    }
}
export const TimelineFollowActiveEditorContext = new RawContextKey('timelineFollowActiveEditor', true, true);
export const TimelineExcludeSources = new RawContextKey('timelineExcludeSources', '[]', true);
export const TimelineViewFocusedContext = new RawContextKey('timelineFocused', true);
let TimelinePane = class TimelinePane extends ViewPane {
    static { this.TITLE = localize2('timeline', "Timeline"); }
    constructor(options, keybindingService, contextMenuService, contextKeyService, configurationService, storageService, viewDescriptorService, instantiationService, editorService, commandService, progressService, timelineService, openerService, themeService, hoverService, labelService, uriIdentityService, extensionService) {
        super({ ...options, titleMenuId: MenuId.TimelineTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.storageService = storageService;
        this.editorService = editorService;
        this.commandService = commandService;
        this.progressService = progressService;
        this.timelineService = timelineService;
        this.labelService = labelService;
        this.uriIdentityService = uriIdentityService;
        this.extensionService = extensionService;
        this.pendingRequests = new Map();
        this.timelinesBySource = new Map();
        this._followActiveEditor = true;
        this._isEmpty = true;
        this._maxItemCount = 0;
        this._visibleItemCount = 0;
        this._pendingRefresh = false;
        this.commands = this._register(this.instantiationService.createInstance(TimelinePaneCommands, this));
        this.followActiveEditorContext = TimelineFollowActiveEditorContext.bindTo(this.contextKeyService);
        this.timelineExcludeSourcesContext = TimelineExcludeSources.bindTo(this.contextKeyService);
        const excludedSourcesString = storageService.get('timeline.excludeSources', 0 /* StorageScope.PROFILE */, '[]');
        this.timelineExcludeSourcesContext.set(excludedSourcesString);
        this.excludedSources = new Set(JSON.parse(excludedSourcesString));
        this._register(storageService.onDidChangeValue(0 /* StorageScope.PROFILE */, 'timeline.excludeSources', this._store)(this.onStorageServiceChanged, this));
        this._register(configurationService.onDidChangeConfiguration(this.onConfigurationChanged, this));
        this._register(timelineService.onDidChangeProviders(this.onProvidersChanged, this));
        this._register(timelineService.onDidChangeTimeline(this.onTimelineChanged, this));
        this._register(timelineService.onDidChangeUri(uri => this.setUri(uri), this));
    }
    get followActiveEditor() {
        return this._followActiveEditor;
    }
    set followActiveEditor(value) {
        if (this._followActiveEditor === value) {
            return;
        }
        this._followActiveEditor = value;
        this.followActiveEditorContext.set(value);
        this.updateFilename(this._filename);
        if (value) {
            this.onActiveEditorChanged();
        }
    }
    get pageOnScroll() {
        if (this._pageOnScroll === undefined) {
            this._pageOnScroll = this.configurationService.getValue('timeline.pageOnScroll') ?? false;
        }
        return this._pageOnScroll;
    }
    get pageSize() {
        let pageSize = this.configurationService.getValue('timeline.pageSize');
        if (pageSize === undefined || pageSize === null) {
            // If we are paging when scrolling, then add an extra item to the end to make sure the "Load more" item is out of view
            pageSize = Math.max(20, Math.floor((this.tree?.renderHeight ?? 0 / ItemHeight) + (this.pageOnScroll ? 1 : -1)));
        }
        return pageSize;
    }
    reset() {
        this.loadTimeline(true);
    }
    setUri(uri) {
        this.setUriCore(uri, true);
    }
    setUriCore(uri, disableFollowing) {
        if (disableFollowing) {
            this.followActiveEditor = false;
        }
        this.uri = uri;
        this.updateFilename(uri ? this.labelService.getUriBasenameLabel(uri) : undefined);
        this.treeRenderer?.setUri(uri);
        this.loadTimeline(true);
    }
    onStorageServiceChanged() {
        const excludedSourcesString = this.storageService.get('timeline.excludeSources', 0 /* StorageScope.PROFILE */, '[]');
        this.timelineExcludeSourcesContext.set(excludedSourcesString);
        this.excludedSources = new Set(JSON.parse(excludedSourcesString));
        const missing = this.timelineService.getSources()
            .filter(({ id }) => !this.excludedSources.has(id) && !this.timelinesBySource.has(id));
        if (missing.length !== 0) {
            this.loadTimeline(true, missing.map(({ id }) => id));
        }
        else {
            this.refresh();
        }
    }
    onConfigurationChanged(e) {
        if (e.affectsConfiguration('timeline.pageOnScroll')) {
            this._pageOnScroll = undefined;
        }
    }
    onActiveEditorChanged() {
        if (!this.followActiveEditor || !this.isExpanded()) {
            return;
        }
        const uri = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
        if ((this.uriIdentityService.extUri.isEqual(uri, this.uri) && uri !== undefined) ||
            // Fallback to match on fsPath if we are dealing with files or git schemes
            (uri?.fsPath === this.uri?.fsPath && (uri?.scheme === Schemas.file || uri?.scheme === 'git') && (this.uri?.scheme === Schemas.file || this.uri?.scheme === 'git'))) {
            // If the uri hasn't changed, make sure we have valid caches
            for (const source of this.timelineService.getSources()) {
                if (this.excludedSources.has(source.id)) {
                    continue;
                }
                const timeline = this.timelinesBySource.get(source.id);
                if (timeline !== undefined && !timeline.stale) {
                    continue;
                }
                if (timeline !== undefined) {
                    this.updateTimeline(timeline, timeline.requiresReset);
                }
                else {
                    this.loadTimelineForSource(source.id, uri, true);
                }
            }
            return;
        }
        this.setUriCore(uri, false);
    }
    onProvidersChanged(e) {
        if (e.removed) {
            for (const source of e.removed) {
                this.timelinesBySource.delete(source);
            }
            this.refresh();
        }
        if (e.added) {
            this.loadTimeline(true, e.added);
        }
    }
    onTimelineChanged(e) {
        if (e?.uri === undefined || this.uriIdentityService.extUri.isEqual(URI.revive(e.uri), this.uri)) {
            const timeline = this.timelinesBySource.get(e.id);
            if (timeline === undefined) {
                return;
            }
            if (this.isBodyVisible()) {
                this.updateTimeline(timeline, e.reset);
            }
            else {
                timeline.invalidate(e.reset);
            }
        }
    }
    updateFilename(filename) {
        this._filename = filename;
        if (this.followActiveEditor || !filename) {
            this.updateTitleDescription(filename);
        }
        else {
            this.updateTitleDescription(`${filename} (pinned)`);
        }
    }
    get message() {
        return this._message;
    }
    set message(message) {
        this._message = message;
        this.updateMessage();
    }
    updateMessage() {
        if (this._message !== undefined) {
            this.showMessage(this._message);
        }
        else {
            this.hideMessage();
        }
    }
    showMessage(message) {
        if (!this.$message) {
            return;
        }
        this.$message.classList.remove('hide');
        this.resetMessageElement();
        this.$message.textContent = message;
    }
    hideMessage() {
        this.resetMessageElement();
        this.$message.classList.add('hide');
    }
    resetMessageElement() {
        DOM.clearNode(this.$message);
    }
    get hasVisibleItems() {
        return this._visibleItemCount > 0;
    }
    clear(cancelPending) {
        this._visibleItemCount = 0;
        this._maxItemCount = this.pageSize;
        this.timelinesBySource.clear();
        if (cancelPending) {
            for (const pendingRequest of this.pendingRequests.values()) {
                pendingRequest.request.tokenSource.cancel();
                pendingRequest.dispose();
            }
            this.pendingRequests.clear();
            if (!this.isBodyVisible() && this.tree) {
                this.tree.setChildren(null, undefined);
                this._isEmpty = true;
            }
        }
    }
    async loadTimeline(reset, sources) {
        // If we have no source, we are resetting all sources, so cancel everything in flight and reset caches
        if (sources === undefined) {
            if (reset) {
                this.clear(true);
            }
            // TODO@eamodio: Are these the right the list of schemes to exclude? Is there a better way?
            if (this.uri?.scheme === Schemas.vscodeSettings || this.uri?.scheme === Schemas.webviewPanel || this.uri?.scheme === Schemas.walkThrough) {
                this.uri = undefined;
                this.clear(false);
                this.refresh();
                return;
            }
            if (this._isEmpty && this.uri !== undefined) {
                this.setLoadingUriMessage();
            }
        }
        if (this.uri === undefined) {
            this.clear(false);
            this.refresh();
            return;
        }
        if (!this.isBodyVisible()) {
            return;
        }
        let hasPendingRequests = false;
        for (const source of sources ?? this.timelineService.getSources().map(s => s.id)) {
            const requested = this.loadTimelineForSource(source, this.uri, reset);
            if (requested) {
                hasPendingRequests = true;
            }
        }
        if (!hasPendingRequests) {
            this.refresh();
        }
        else if (this._isEmpty) {
            this.setLoadingUriMessage();
        }
    }
    loadTimelineForSource(source, uri, reset, options) {
        if (this.excludedSources.has(source)) {
            return false;
        }
        const timeline = this.timelinesBySource.get(source);
        // If we are paging, and there are no more items or we have enough cached items to cover the next page,
        // don't bother querying for more
        if (!reset &&
            options?.cursor !== undefined &&
            timeline !== undefined &&
            (!timeline?.more || timeline.items.length > timeline.lastRenderedIndex + this.pageSize)) {
            return false;
        }
        if (options === undefined) {
            if (!reset &&
                timeline !== undefined &&
                timeline.items.length > 0 &&
                !timeline.more) {
                // If we are not resetting, have item(s), and already know there are no more to fetch, we're done here
                return false;
            }
            options = { cursor: reset ? undefined : timeline?.cursor, limit: this.pageSize };
        }
        const pendingRequest = this.pendingRequests.get(source);
        if (pendingRequest !== undefined) {
            options.cursor = pendingRequest.request.options.cursor;
            // TODO@eamodio deal with concurrent requests better
            if (typeof options.limit === 'number') {
                if (typeof pendingRequest.request.options.limit === 'number') {
                    options.limit += pendingRequest.request.options.limit;
                }
                else {
                    options.limit = pendingRequest.request.options.limit;
                }
            }
        }
        pendingRequest?.request?.tokenSource.cancel();
        pendingRequest?.dispose();
        options.cacheResults = true;
        options.resetCache = reset;
        const tokenSource = new CancellationTokenSource();
        const newRequest = this.timelineService.getTimeline(source, uri, options, tokenSource);
        if (newRequest === undefined) {
            tokenSource.dispose();
            return false;
        }
        const disposables = new DisposableStore();
        this.pendingRequests.set(source, { request: newRequest, dispose: () => disposables.dispose() });
        disposables.add(tokenSource);
        disposables.add(tokenSource.token.onCancellationRequested(() => this.pendingRequests.delete(source)));
        this.handleRequest(newRequest);
        return true;
    }
    updateTimeline(timeline, reset) {
        if (reset) {
            this.timelinesBySource.delete(timeline.source);
            // Override the limit, to re-query for all our existing cached (possibly visible) items to keep visual continuity
            const { oldest } = timeline;
            this.loadTimelineForSource(timeline.source, this.uri, true, oldest !== undefined ? { limit: { timestamp: oldest.timestamp, id: oldest.id } } : undefined);
        }
        else {
            // Override the limit, to query for any newer items
            const { newest } = timeline;
            this.loadTimelineForSource(timeline.source, this.uri, false, newest !== undefined ? { limit: { timestamp: newest.timestamp, id: newest.id } } : { limit: this.pageSize });
        }
    }
    async handleRequest(request) {
        let response;
        try {
            response = await this.progressService.withProgress({ location: this.id }, () => request.result);
        }
        catch {
            // Ignore
        }
        // If the request was cancelled then it was already deleted from the pendingRequests map
        if (!request.tokenSource.token.isCancellationRequested) {
            this.pendingRequests.get(request.source)?.dispose();
            this.pendingRequests.delete(request.source);
        }
        if (response === undefined || request.uri !== this.uri) {
            if (this.pendingRequests.size === 0 && this._pendingRefresh) {
                this.refresh();
            }
            return;
        }
        const source = request.source;
        let updated = false;
        const timeline = this.timelinesBySource.get(source);
        if (timeline === undefined) {
            this.timelinesBySource.set(source, new TimelineAggregate(response));
            updated = true;
        }
        else {
            updated = timeline.add(response, request.options);
        }
        if (updated) {
            this._pendingRefresh = true;
            // If we have visible items already and there are other pending requests, debounce for a bit to wait for other requests
            if (this.hasVisibleItems && this.pendingRequests.size !== 0) {
                this.refreshDebounced();
            }
            else {
                this.refresh();
            }
        }
        else if (this.pendingRequests.size === 0) {
            if (this._pendingRefresh) {
                this.refresh();
            }
            else {
                this.tree.rerender();
            }
        }
    }
    *getItems() {
        let more = false;
        if (this.uri === undefined || this.timelinesBySource.size === 0) {
            this._visibleItemCount = 0;
            return;
        }
        const maxCount = this._maxItemCount;
        let count = 0;
        if (this.timelinesBySource.size === 1) {
            const [source, timeline] = Iterable.first(this.timelinesBySource);
            timeline.lastRenderedIndex = -1;
            if (this.excludedSources.has(source)) {
                this._visibleItemCount = 0;
                return;
            }
            if (timeline.items.length !== 0) {
                // If we have any items, just say we have one for now -- the real count will be updated below
                this._visibleItemCount = 1;
            }
            more = timeline.more;
            let lastRelativeTime;
            for (const item of timeline.items) {
                item.relativeTime = undefined;
                item.hideRelativeTime = undefined;
                count++;
                if (count > maxCount) {
                    more = true;
                    break;
                }
                lastRelativeTime = updateRelativeTime(item, lastRelativeTime);
                yield { element: item };
            }
            timeline.lastRenderedIndex = count - 1;
        }
        else {
            const sources = [];
            let hasAnyItems = false;
            let mostRecentEnd = 0;
            for (const [source, timeline] of this.timelinesBySource) {
                timeline.lastRenderedIndex = -1;
                if (this.excludedSources.has(source) || timeline.stale) {
                    continue;
                }
                if (timeline.items.length !== 0) {
                    hasAnyItems = true;
                }
                if (timeline.more) {
                    more = true;
                    const last = timeline.items[Math.min(maxCount, timeline.items.length - 1)];
                    if (last.timestamp > mostRecentEnd) {
                        mostRecentEnd = last.timestamp;
                    }
                }
                const iterator = timeline.items[Symbol.iterator]();
                sources.push({ timeline, iterator, nextItem: iterator.next() });
            }
            this._visibleItemCount = hasAnyItems ? 1 : 0;
            function getNextMostRecentSource() {
                return sources
                    .filter(source => !source.nextItem.done)
                    .reduce((previous, current) => (previous === undefined || current.nextItem.value.timestamp >= previous.nextItem.value.timestamp) ? current : previous, undefined);
            }
            let lastRelativeTime;
            let nextSource;
            while (nextSource = getNextMostRecentSource()) {
                nextSource.timeline.lastRenderedIndex++;
                const item = nextSource.nextItem.value;
                item.relativeTime = undefined;
                item.hideRelativeTime = undefined;
                if (item.timestamp >= mostRecentEnd) {
                    count++;
                    if (count > maxCount) {
                        more = true;
                        break;
                    }
                    lastRelativeTime = updateRelativeTime(item, lastRelativeTime);
                    yield { element: item };
                }
                nextSource.nextItem = nextSource.iterator.next();
            }
        }
        this._visibleItemCount = count;
        if (count > 0) {
            if (more) {
                yield {
                    element: new LoadMoreCommand(this.pendingRequests.size !== 0)
                };
            }
            else if (this.pendingRequests.size !== 0) {
                yield {
                    element: new LoadMoreCommand(true)
                };
            }
        }
    }
    refresh() {
        if (!this.isBodyVisible()) {
            return;
        }
        this.tree.setChildren(null, this.getItems());
        this._isEmpty = !this.hasVisibleItems;
        if (this.uri === undefined) {
            this.updateFilename(undefined);
            this.message = localize('timeline.editorCannotProvideTimeline', "The active editor cannot provide timeline information.");
        }
        else if (this._isEmpty) {
            if (this.pendingRequests.size !== 0) {
                this.setLoadingUriMessage();
            }
            else {
                this.updateFilename(this.labelService.getUriBasenameLabel(this.uri));
                const scmProviderCount = this.contextKeyService.getContextKeyValue('scm.providerCount');
                if (this.timelineService.getSources().filter(({ id }) => !this.excludedSources.has(id)).length === 0) {
                    this.message = localize('timeline.noTimelineSourcesEnabled', "All timeline sources have been filtered out.");
                }
                else {
                    if (this.configurationService.getValue('workbench.localHistory.enabled') && !this.excludedSources.has('timeline.localHistory')) {
                        this.message = localize('timeline.noLocalHistoryYet', "Local History will track recent changes as you save them unless the file has been excluded or is too large.");
                    }
                    else if (this.excludedSources.size > 0) {
                        this.message = localize('timeline.noTimelineInfoFromEnabledSources', "No filtered timeline information was provided.");
                    }
                    else {
                        this.message = localize('timeline.noTimelineInfo', "No timeline information was provided.");
                    }
                }
                if (!scmProviderCount || scmProviderCount === 0) {
                    this.message += ' ' + localize('timeline.noSCM', "Source Control has not been configured.");
                }
            }
        }
        else {
            this.updateFilename(this.labelService.getUriBasenameLabel(this.uri));
            this.message = undefined;
        }
        this._pendingRefresh = false;
    }
    refreshDebounced() {
        this.refresh();
    }
    focus() {
        super.focus();
        this.tree.domFocus();
    }
    setExpanded(expanded) {
        const changed = super.setExpanded(expanded);
        if (changed && this.isBodyVisible()) {
            if (!this.followActiveEditor) {
                this.setUriCore(this.uri, true);
            }
            else {
                this.onActiveEditorChanged();
            }
        }
        return changed;
    }
    setVisible(visible) {
        if (visible) {
            this.extensionService.activateByEvent('onView:timeline');
            this.visibilityDisposables = new DisposableStore();
            this.editorService.onDidActiveEditorChange(this.onActiveEditorChanged, this, this.visibilityDisposables);
            // Refresh the view on focus to update the relative timestamps
            this.onDidFocus(() => this.refreshDebounced(), this, this.visibilityDisposables);
            super.setVisible(visible);
            this.onActiveEditorChanged();
        }
        else {
            this.visibilityDisposables?.dispose();
            super.setVisible(visible);
        }
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this.tree.layout(height, width);
    }
    renderHeaderTitle(container) {
        super.renderHeaderTitle(container, this.title);
        container.classList.add('timeline-view');
    }
    renderBody(container) {
        super.renderBody(container);
        this.$container = container;
        container.classList.add('tree-explorer-viewlet-tree-view', 'timeline-tree-view');
        this.$message = DOM.append(this.$container, DOM.$('.message'));
        this.$message.classList.add('timeline-subtle');
        this.message = localize('timeline.editorCannotProvideTimeline', "The active editor cannot provide timeline information.");
        this.$tree = document.createElement('div');
        this.$tree.classList.add('customview-tree', 'file-icon-themable-tree', 'hide-arrows');
        // this.treeElement.classList.add('show-file-icons');
        container.appendChild(this.$tree);
        this.treeRenderer = this.instantiationService.createInstance(TimelineTreeRenderer, this.commands);
        this._register(this.treeRenderer.onDidScrollToEnd(item => {
            if (this.pageOnScroll) {
                this.loadMore(item);
            }
        }));
        this.tree = this.instantiationService.createInstance((WorkbenchObjectTree), 'TimelinePane', this.$tree, new TimelineListVirtualDelegate(), [this.treeRenderer], {
            identityProvider: new TimelineIdentityProvider(),
            accessibilityProvider: {
                getAriaLabel(element) {
                    if (isLoadMoreCommand(element)) {
                        return element.ariaLabel;
                    }
                    return element.accessibilityInformation ? element.accessibilityInformation.label : localize('timeline.aria.item', "{0}: {1}", element.relativeTimeFullWord ?? '', element.label);
                },
                getRole(element) {
                    if (isLoadMoreCommand(element)) {
                        return 'treeitem';
                    }
                    return element.accessibilityInformation && element.accessibilityInformation.role ? element.accessibilityInformation.role : 'treeitem';
                },
                getWidgetAriaLabel() {
                    return localize('timeline', "Timeline");
                }
            },
            keyboardNavigationLabelProvider: new TimelineKeyboardNavigationLabelProvider(),
            multipleSelectionSupport: false,
            overrideStyles: this.getLocationBasedColors().listOverrideStyles,
        });
        TimelineViewFocusedContext.bindTo(this.tree.contextKeyService);
        this._register(this.tree.onContextMenu(e => this.onContextMenu(this.commands, e)));
        this._register(this.tree.onDidChangeSelection(e => this.ensureValidItems()));
        this._register(this.tree.onDidOpen(e => {
            if (!e.browserEvent || !this.ensureValidItems()) {
                return;
            }
            const selection = this.tree.getSelection();
            let item;
            if (selection.length === 1) {
                item = selection[0];
            }
            if (item === null) {
                return;
            }
            if (isTimelineItem(item)) {
                if (item.command) {
                    let args = item.command.arguments ?? [];
                    if (item.command.id === API_OPEN_EDITOR_COMMAND_ID || item.command.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
                        // Some commands owned by us should receive the
                        // `IOpenEvent` as context to open properly
                        args = [...args, e];
                    }
                    this.commandService.executeCommand(item.command.id, ...args);
                }
            }
            else if (isLoadMoreCommand(item)) {
                this.loadMore(item);
            }
        }));
    }
    loadMore(item) {
        if (item.loading) {
            return;
        }
        item.loading = true;
        this.tree.rerender(item);
        if (this.pendingRequests.size !== 0) {
            return;
        }
        this._maxItemCount = this._visibleItemCount + this.pageSize;
        this.loadTimeline(false);
    }
    ensureValidItems() {
        // If we don't have any non-excluded timelines, clear the tree and show the loading message
        if (!this.hasVisibleItems || !this.timelineService.getSources().some(({ id }) => !this.excludedSources.has(id) && this.timelinesBySource.has(id))) {
            this.tree.setChildren(null, undefined);
            this._isEmpty = true;
            this.setLoadingUriMessage();
            return false;
        }
        return true;
    }
    setLoadingUriMessage() {
        const file = this.uri && this.labelService.getUriBasenameLabel(this.uri);
        this.updateFilename(file);
        this.message = file ? localize('timeline.loading', "Loading timeline for {0}...", file) : '';
    }
    onContextMenu(commands, treeEvent) {
        const item = treeEvent.element;
        if (item === null) {
            return;
        }
        const event = treeEvent.browserEvent;
        event.preventDefault();
        event.stopPropagation();
        if (!this.ensureValidItems()) {
            return;
        }
        this.tree.setFocus([item]);
        const actions = commands.getItemContextActions(item);
        if (!actions.length) {
            return;
        }
        this.contextMenuService.showContextMenu({
            getAnchor: () => treeEvent.anchor,
            getActions: () => actions,
            getActionViewItem: (action) => {
                const keybinding = this.keybindingService.lookupKeybinding(action.id);
                if (keybinding) {
                    return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
                }
                return undefined;
            },
            onHide: (wasCancelled) => {
                if (wasCancelled) {
                    this.tree.domFocus();
                }
            },
            getActionsContext: () => ({ uri: this.uri, item }),
            actionRunner: new TimelineActionRunner()
        });
    }
};
__decorate([
    debounce(500)
], TimelinePane.prototype, "refreshDebounced", null);
TimelinePane = __decorate([
    __param(1, IKeybindingService),
    __param(2, IContextMenuService),
    __param(3, IContextKeyService),
    __param(4, IConfigurationService),
    __param(5, IStorageService),
    __param(6, IViewDescriptorService),
    __param(7, IInstantiationService),
    __param(8, IEditorService),
    __param(9, ICommandService),
    __param(10, IProgressService),
    __param(11, ITimelineService),
    __param(12, IOpenerService),
    __param(13, IThemeService),
    __param(14, IHoverService),
    __param(15, ILabelService),
    __param(16, IUriIdentityService),
    __param(17, IExtensionService)
], TimelinePane);
export { TimelinePane };
class TimelineElementTemplate {
    static { this.id = 'TimelineElementTemplate'; }
    constructor(container, actionViewItemProvider, hoverDelegate) {
        container.classList.add('custom-view-tree-node-item');
        this.icon = DOM.append(container, DOM.$('.custom-view-tree-node-item-icon'));
        this.iconLabel = new IconLabel(container, { supportHighlights: true, supportIcons: true, hoverDelegate });
        const timestampContainer = DOM.append(this.iconLabel.element, DOM.$('.timeline-timestamp-container'));
        this.timestamp = DOM.append(timestampContainer, DOM.$('span.timeline-timestamp'));
        const actionsContainer = DOM.append(this.iconLabel.element, DOM.$('.actions'));
        this.actionBar = new ActionBar(actionsContainer, { actionViewItemProvider });
    }
    dispose() {
        this.iconLabel.dispose();
        this.actionBar.dispose();
    }
    reset() {
        this.icon.className = '';
        this.icon.style.backgroundImage = '';
        this.actionBar.clear();
    }
}
export class TimelineIdentityProvider {
    getId(item) {
        return item.handle;
    }
}
class TimelineActionRunner extends ActionRunner {
    async runAction(action, { uri, item }) {
        if (!isTimelineItem(item)) {
            // TODO@eamodio do we need to do anything else?
            await action.run();
            return;
        }
        await action.run({
            $mid: 12 /* MarshalledId.TimelineActionContext */,
            handle: item.handle,
            source: item.source,
            uri
        }, uri, item.source);
    }
}
export class TimelineKeyboardNavigationLabelProvider {
    getKeyboardNavigationLabel(element) {
        return element.label;
    }
}
export class TimelineListVirtualDelegate {
    getHeight(_element) {
        return ItemHeight;
    }
    getTemplateId(element) {
        return TimelineElementTemplate.id;
    }
}
let TimelineTreeRenderer = class TimelineTreeRenderer {
    constructor(commands, instantiationService, themeService) {
        this.commands = commands;
        this.instantiationService = instantiationService;
        this.themeService = themeService;
        this._onDidScrollToEnd = new Emitter();
        this.onDidScrollToEnd = this._onDidScrollToEnd.event;
        this.templateId = TimelineElementTemplate.id;
        this.actionViewItemProvider = createActionViewItem.bind(undefined, this.instantiationService);
        this._hoverDelegate = this.instantiationService.createInstance(WorkbenchHoverDelegate, 'element', { instantHover: true }, {
            position: {
                hoverPosition: 1 /* HoverPosition.RIGHT */ // Will flip when there's no space
            }
        });
    }
    setUri(uri) {
        this.uri = uri;
    }
    renderTemplate(container) {
        return new TimelineElementTemplate(container, this.actionViewItemProvider, this._hoverDelegate);
    }
    renderElement(node, index, template) {
        template.reset();
        const { element: item } = node;
        const theme = this.themeService.getColorTheme();
        const icon = theme.type === ColorScheme.LIGHT ? item.icon : item.iconDark;
        const iconUrl = icon ? URI.revive(icon) : null;
        if (iconUrl) {
            template.icon.className = 'custom-view-tree-node-item-icon';
            template.icon.style.backgroundImage = css.asCSSUrl(iconUrl);
            template.icon.style.color = '';
        }
        else if (item.themeIcon) {
            template.icon.className = `custom-view-tree-node-item-icon ${ThemeIcon.asClassName(item.themeIcon)}`;
            if (item.themeIcon.color) {
                template.icon.style.color = theme.getColor(item.themeIcon.color.id)?.toString() ?? '';
            }
            else {
                template.icon.style.color = '';
            }
            template.icon.style.backgroundImage = '';
        }
        else {
            template.icon.className = 'custom-view-tree-node-item-icon';
            template.icon.style.backgroundImage = '';
            template.icon.style.color = '';
        }
        const tooltip = item.tooltip
            ? isString(item.tooltip)
                ? item.tooltip
                : { markdown: item.tooltip, markdownNotSupportedFallback: renderMarkdownAsPlaintext(item.tooltip) }
            : undefined;
        template.iconLabel.setLabel(item.label, item.description, {
            title: tooltip,
            matches: createMatches(node.filterData)
        });
        template.timestamp.textContent = item.relativeTime ?? '';
        template.timestamp.ariaLabel = item.relativeTimeFullWord ?? '';
        template.timestamp.parentElement.classList.toggle('timeline-timestamp--duplicate', isTimelineItem(item) && item.hideRelativeTime);
        template.actionBar.context = { uri: this.uri, item };
        template.actionBar.actionRunner = new TimelineActionRunner();
        template.actionBar.push(this.commands.getItemActions(item), { icon: true, label: false });
        // If we are rendering the load more item, we've scrolled to the end, so trigger an event
        if (isLoadMoreCommand(item)) {
            setTimeout(() => this._onDidScrollToEnd.fire(item), 0);
        }
    }
    disposeElement(element, index, templateData) {
        templateData.actionBar.actionRunner.dispose();
    }
    disposeTemplate(template) {
        template.dispose();
    }
};
TimelineTreeRenderer = __decorate([
    __param(1, IInstantiationService),
    __param(2, IThemeService)
], TimelineTreeRenderer);
const timelineRefresh = registerIcon('timeline-refresh', Codicon.refresh, localize('timelineRefresh', 'Icon for the refresh timeline action.'));
const timelinePin = registerIcon('timeline-pin', Codicon.pin, localize('timelinePin', 'Icon for the pin timeline action.'));
const timelineUnpin = registerIcon('timeline-unpin', Codicon.pinned, localize('timelineUnpin', 'Icon for the unpin timeline action.'));
let TimelinePaneCommands = class TimelinePaneCommands extends Disposable {
    constructor(pane, timelineService, storageService, contextKeyService, menuService) {
        super();
        this.pane = pane;
        this.timelineService = timelineService;
        this.storageService = storageService;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this._register(this.sourceDisposables = new DisposableStore());
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'timeline.refresh',
                    title: localize2('refresh', "Refresh"),
                    icon: timelineRefresh,
                    category: localize2('timeline', "Timeline"),
                    menu: {
                        id: MenuId.TimelineTitle,
                        group: 'navigation',
                        order: 99,
                    }
                });
            }
            run(accessor, ...args) {
                pane.reset();
            }
        }));
        this._register(CommandsRegistry.registerCommand('timeline.toggleFollowActiveEditor', (accessor, ...args) => pane.followActiveEditor = !pane.followActiveEditor));
        this._register(MenuRegistry.appendMenuItem(MenuId.TimelineTitle, ({
            command: {
                id: 'timeline.toggleFollowActiveEditor',
                title: localize2('timeline.toggleFollowActiveEditorCommand.follow', 'Pin the Current Timeline'),
                icon: timelinePin,
                category: localize2('timeline', "Timeline"),
            },
            group: 'navigation',
            order: 98,
            when: TimelineFollowActiveEditorContext
        })));
        this._register(MenuRegistry.appendMenuItem(MenuId.TimelineTitle, ({
            command: {
                id: 'timeline.toggleFollowActiveEditor',
                title: localize2('timeline.toggleFollowActiveEditorCommand.unfollow', 'Unpin the Current Timeline'),
                icon: timelineUnpin,
                category: localize2('timeline', "Timeline"),
            },
            group: 'navigation',
            order: 98,
            when: TimelineFollowActiveEditorContext.toNegated()
        })));
        this._register(timelineService.onDidChangeProviders(() => this.updateTimelineSourceFilters()));
        this.updateTimelineSourceFilters();
    }
    getItemActions(element) {
        return this.getActions(MenuId.TimelineItemContext, { key: 'timelineItem', value: element.contextValue }).primary;
    }
    getItemContextActions(element) {
        return this.getActions(MenuId.TimelineItemContext, { key: 'timelineItem', value: element.contextValue }).secondary;
    }
    getActions(menuId, context) {
        const contextKeyService = this.contextKeyService.createOverlay([
            ['view', this.pane.id],
            [context.key, context.value],
        ]);
        const menu = this.menuService.getMenuActions(menuId, contextKeyService, { shouldForwardArgs: true });
        return getContextMenuActions(menu, 'inline');
    }
    updateTimelineSourceFilters() {
        this.sourceDisposables.clear();
        const excluded = new Set(JSON.parse(this.storageService.get('timeline.excludeSources', 0 /* StorageScope.PROFILE */, '[]')));
        for (const source of this.timelineService.getSources()) {
            this.sourceDisposables.add(registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: `timeline.toggleExcludeSource:${source.id}`,
                        title: source.label,
                        menu: {
                            id: MenuId.TimelineFilterSubMenu,
                            group: 'navigation',
                        },
                        toggled: ContextKeyExpr.regex(`timelineExcludeSources`, new RegExp(`\\b${escapeRegExpCharacters(source.id)}\\b`)).negate()
                    });
                }
                run(accessor, ...args) {
                    if (excluded.has(source.id)) {
                        excluded.delete(source.id);
                    }
                    else {
                        excluded.add(source.id);
                    }
                    const storageService = accessor.get(IStorageService);
                    storageService.store('timeline.excludeSources', JSON.stringify([...excluded.keys()]), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
                }
            }));
        }
    }
};
TimelinePaneCommands = __decorate([
    __param(1, ITimelineService),
    __param(2, IStorageService),
    __param(3, IContextKeyService),
    __param(4, IMenuService)
], TimelinePaneCommands);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZWxpbmVQYW5lLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90aW1lbGluZS9icm93c2VyL3RpbWVsaW5lUGFuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLDBCQUEwQixDQUFDO0FBQ2xDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEtBQUssR0FBRyxNQUFNLHNDQUFzQyxDQUFDO0FBQzVELE9BQU8sRUFBVyxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQWMsYUFBYSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDL0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQWUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFNB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