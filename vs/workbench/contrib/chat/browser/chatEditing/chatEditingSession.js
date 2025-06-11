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
import { equals as arraysEqual, binarySearch2 } from '../../../../../base/common/arrays.js';
import { findLast } from '../../../../../base/common/arraysFind.js';
import { DeferredPromise, Sequencer, SequencerByKey, timeout } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { Disposable, DisposableStore, dispose } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { autorun, derived, derivedOpts, ObservablePromise, observableValue, transaction } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { IBulkEditService } from '../../../../../editor/browser/services/bulkEditService.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { EditorActivation } from '../../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { MultiDiffEditorInput } from '../../../multiDiffEditor/browser/multiDiffEditorInput.js';
import { CellUri } from '../../../notebook/common/notebookCommon.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { getMultiDiffSourceUri } from '../../common/chatEditingService.js';
import { IChatService } from '../../common/chatService.js';
import { ChatEditingModifiedDocumentEntry } from './chatEditingModifiedDocumentEntry.js';
import { AbstractChatEditingModifiedFileEntry } from './chatEditingModifiedFileEntry.js';
import { ChatEditingModifiedNotebookEntry } from './chatEditingModifiedNotebookEntry.js';
import { ChatEditingSessionStorage } from './chatEditingSessionStorage.js';
import { ChatEditingTextModelContentProvider } from './chatEditingTextModelContentProviders.js';
import { ChatEditingModifiedNotebookDiff } from './notebook/chatEditingModifiedNotebookDiff.js';
const POST_EDIT_STOP_ID = 'd19944f6-f46c-4e17-911b-79a8e843c7c0'; // randomly generated
class ThrottledSequencer extends Sequencer {
    constructor(_minDuration, _maxOverallDelay) {
        super();
        this._minDuration = _minDuration;
        this._maxOverallDelay = _maxOverallDelay;
        this._size = 0;
    }
    queue(promiseTask) {
        this._size += 1;
        const noDelay = this._size * this._minDuration > this._maxOverallDelay;
        return super.queue(async () => {
            try {
                const p1 = promiseTask();
                const p2 = noDelay
                    ? Promise.resolve(undefined)
                    : timeout(this._minDuration, CancellationToken.None);
                const [result] = await Promise.all([p1, p2]);
                return result;
            }
            finally {
                this._size -= 1;
            }
        });
    }
}
function getMaxHistoryIndex(history) {
    const lastHistory = history.at(-1);
    return lastHistory ? lastHistory.startIndex + lastHistory.stops.length : 0;
}
function snapshotsEqualForDiff(a, b) {
    if (!a || !b) {
        return a === b;
    }
    return isEqual(a.snapshotUri, b.snapshotUri) && a.current === b.current;
}
function getCurrentAndNextStop(requestId, stopId, history) {
    const snapshotIndex = history.findIndex(s => s.requestId === requestId);
    if (snapshotIndex === -1) {
        return undefined;
    }
    const snapshot = history[snapshotIndex];
    const stopIndex = snapshot.stops.findIndex(s => s.stopId === stopId);
    if (stopIndex === -1) {
        return undefined;
    }
    const current = snapshot.stops[stopIndex].entries;
    const next = stopIndex < snapshot.stops.length - 1
        ? snapshot.stops[stopIndex + 1].entries
        : snapshot.postEdit || history[snapshotIndex + 1]?.stops[0].entries;
    if (!next) {
        return undefined;
    }
    return { current, next };
}
function getFirstAndLastStop(uri, history) {
    let firstStopWithUri;
    for (const snapshot of history) {
        const stop = snapshot.stops.find(s => s.entries.has(uri));
        if (stop) {
            firstStopWithUri = stop;
            break;
        }
    }
    let lastStopWithUri;
    for (let i = history.length - 1; i >= 0; i--) {
        const snapshot = history[i];
        if (snapshot.postEdit?.has(uri)) {
            lastStopWithUri = snapshot.postEdit;
            break;
        }
        const stop = findLast(snapshot.stops, s => s.entries.has(uri));
        if (stop) {
            lastStopWithUri = stop.entries;
            break;
        }
    }
    if (!firstStopWithUri || !lastStopWithUri) {
        return undefined;
    }
    return { current: firstStopWithUri.entries, next: lastStopWithUri };
}
let ChatEditingSession = class ChatEditingSession extends Disposable {
    get entries() {
        this._assertNotDisposed();
        return this._entriesObs;
    }
    get state() {
        return this._state;
    }
    get onDidDispose() {
        this._assertNotDisposed();
        return this._onDidDispose.event;
    }
    constructor(chatSessionId, isGlobalEditingSession, _lookupExternalEntry, _instantiationService, _modelService, _languageService, _textModelService, _bulkEditService, _editorGroupsService, _editorService, _chatService, _notebookService, _editorWorkerService, _configurationService, _accessibilitySignalService) {
        super();
        this.chatSessionId = chatSessionId;
        this.isGlobalEditingSession = isGlobalEditingSession;
        this._lookupExternalEntry = _lookupExternalEntry;
        this._instantiationService = _instantiationService;
        this._modelService = _modelService;
        this._languageService = _languageService;
        this._textModelService = _textModelService;
        this._bulkEditService = _bulkEditService;
        this._editorGroupsService = _editorGroupsService;
        this._editorService = _editorService;
        this._chatService = _chatService;
        this._notebookService = _notebookService;
        this._editorWorkerService = _editorWorkerService;
        this._configurationService = _configurationService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._state = observableValue(this, 0 /* ChatEditingSessionState.Initial */);
        this._linearHistory = observableValue(this, []);
        this._linearHistoryIndex = observableValue(this, 0);
        /**
         * Contains the contents of a file when the AI first began doing edits to it.
         */
        this._initialFileContents = new ResourceMap();
        this._entriesObs = observableValue(this, []);
        this.canUndo = derived((r) => {
            if (this.state.read(r) !== 2 /* ChatEditingSessionState.Idle */) {
                return false;
            }
            const linearHistoryIndex = this._linearHistoryIndex.read(r);
            return linearHistoryIndex > 0;
        });
        this.canRedo = derived((r) => {
            if (this.state.read(r) !== 2 /* ChatEditingSessionState.Idle */) {
                return false;
            }
            const linearHistoryIndex = this._linearHistoryIndex.read(r);
            return linearHistoryIndex < getMaxHistoryIndex(this._linearHistory.read(r));
        });
        // public hiddenRequestIds = derived<string[]>((r) => {
        // 	const linearHistory = this._linearHistory.read(r);
        // 	const linearHistoryIndex = this._linearHistoryIndex.read(r);
        // 	return linearHistory.slice(linearHistoryIndex).map(s => s.requestId).filter((r): r is string => !!r);
        // });
        this._onDidDispose = new Emitter();
        this._diffsBetweenStops = new Map();
        this._fullDiffs = new Map();
        this._streamingEditLocks = new SequencerByKey();
        this._ignoreTrimWhitespaceObservable = observableConfigValue('diffEditor.ignoreTrimWhitespace', true, this._configurationService);
    }
    async init() {
        const restoredSessionState = await this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionId).restoreState();
        if (restoredSessionState) {
            for (const [uri, content] of restoredSessionState.initialFileContents) {
                this._initialFileContents.set(uri, content);
            }
            this._pendingSnapshot = restoredSessionState.pendingSnapshot;
            await this._restoreSnapshot(restoredSessionState.recentSnapshot, false);
            transaction(async (tx) => {
                this._linearHistory.set(restoredSessionState.linearHistory, tx);
                this._linearHistoryIndex.set(restoredSessionState.linearHistoryIndex, tx);
                this._state.set(2 /* ChatEditingSessionState.Idle */, tx);
            });
        }
        else {
            this._state.set(2 /* ChatEditingSessionState.Idle */, undefined);
        }
        this._register(autorun(reader => {
            const entries = this.entries.read(reader);
            entries.forEach(entry => {
                entry.state.read(reader);
            });
        }));
    }
    _getEntry(uri) {
        uri = CellUri.parse(uri)?.notebook ?? uri;
        return this._entriesObs.get().find(e => isEqual(e.modifiedURI, uri));
    }
    getEntry(uri) {
        return this._getEntry(uri);
    }
    readEntry(uri, reader) {
        uri = CellUri.parse(uri)?.notebook ?? uri;
        return this._entriesObs.read(reader).find(e => isEqual(e.modifiedURI, uri));
    }
    storeState() {
        const storage = this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionId);
        const state = {
            initialFileContents: this._initialFileContents,
            pendingSnapshot: this._pendingSnapshot,
            recentSnapshot: this._createSnapshot(undefined, undefined),
            linearHistoryIndex: this._linearHistoryIndex.get(),
            linearHistory: this._linearHistory.get(),
        };
        return storage.storeState(state);
    }
    _findSnapshot(requestId) {
        return this._linearHistory.get().find(s => s.requestId === requestId);
    }
    _findEditStop(requestId, undoStop) {
        const snapshot = this._findSnapshot(requestId);
        if (!snapshot) {
            return undefined;
        }
        const idx = snapshot.stops.findIndex(s => s.stopId === undoStop);
        return idx === -1 ? undefined : { stop: snapshot.stops[idx], snapshot, historyIndex: snapshot.startIndex + idx };
    }
    _ensurePendingSnapshot() {
        this._pendingSnapshot ??= this._createSnapshot(undefined, undefined);
    }
    /**
     * Gets diff for text entries between stops.
     * @param entriesContent Observable that observes either snapshot entry
     * @param modelUrisObservable Observable that observes only the snapshot URIs.
     */
    _entryDiffBetweenTextStops(entriesContent, modelUrisObservable) {
        const modelRefsPromise = derived(this, (reader) => {
            const modelUris = modelUrisObservable.read(reader);
            if (!modelUris) {
                return undefined;
            }
            const store = reader.store.add(new DisposableStore());
            const promise = Promise.all(modelUris.map(u => this._textModelService.createModelReference(u))).then(refs => {
                if (store.isDisposed) {
                    refs.forEach(r => r.dispose());
                }
                else {
                    refs.forEach(r => store.add(r));
                }
                return refs;
            });
            return new ObservablePromise(promise);
        });
        return derived((reader) => {
            const refs2 = modelRefsPromise.read(reader)?.promiseResult.read(reader);
            const refs = refs2?.data;
            if (!refs) {
                return;
            }
            const entries = entriesContent.read(reader); // trigger re-diffing when contents change
            if (entries?.before && ChatEditingModifiedNotebookEntry.canHandleSnapshot(entries.before)) {
                const diffService = this._instantiationService.createInstance(ChatEditingModifiedNotebookDiff, entries.before, entries.after);
                return new ObservablePromise(diffService.computeDiff());
            }
            const ignoreTrimWhitespace = this._ignoreTrimWhitespaceObservable.read(reader);
            const promise = this._editorWorkerService.computeDiff(refs[0].object.textEditorModel.uri, refs[1].object.textEditorModel.uri, { ignoreTrimWhitespace, computeMoves: false, maxComputationTimeMs: 3000 }, 'advanced').then((diff) => {
                const entryDiff = {
                    originalURI: refs[0].object.textEditorModel.uri,
                    modifiedURI: refs[1].object.textEditorModel.uri,
                    identical: !!diff?.identical,
                    quitEarly: !diff || diff.quitEarly,
                    added: 0,
                    removed: 0,
                };
                if (diff) {
                    for (const change of diff.changes) {
                        entryDiff.removed += change.original.endLineNumberExclusive - change.original.startLineNumber;
                        entryDiff.added += change.modified.endLineNumberExclusive - change.modified.startLineNumber;
                    }
                }
                return entryDiff;
            });
            return new ObservablePromise(promise);
        });
    }
    _createDiffBetweenStopsObservable(uri, requestId, stopId) {
        const entries = derivedOpts({
            equalsFn: (a, b) => snapshotsEqualForDiff(a?.before, b?.before) && snapshotsEqualForDiff(a?.after, b?.after),
        }, reader => {
            const stops = requestId ?
                getCurrentAndNextStop(requestId, stopId, this._linearHistory.read(reader)) :
                getFirstAndLastStop(uri, this._linearHistory.read(reader));
            if (!stops) {
                return undefined;
            }
            const before = stops.current.get(uri);
            const after = stops.next.get(uri);
            if (!before || !after) {
                return undefined;
            }
            return { before, after };
        });
        // Separate observable for model refs to avoid unnecessary disposal
        const modelUrisObservable = derivedOpts({ equalsFn: (a, b) => arraysEqual(a, b, isEqual) }, reader => {
            const entriesValue = entries.read(reader);
            if (!entriesValue) {
                return undefined;
            }
            return [entriesValue.before.snapshotUri, entriesValue.after.snapshotUri];
        });
        const diff = this._entryDiffBetweenTextStops(entries, modelUrisObservable);
        return derived(reader => {
            return diff.read(reader)?.promiseResult.read(reader)?.data || undefined;
        });
    }
    getEntryDiffBetweenStops(uri, requestId, stopId) {
        if (requestId) {
            const key = `${uri}\0${requestId}\0${stopId}`;
            let observable = this._diffsBetweenStops.get(key);
            if (!observable) {
                observable = this._createDiffBetweenStopsObservable(uri, requestId, stopId);
                this._diffsBetweenStops.set(key, observable);
            }
            return observable;
        }
        else {
            const key = uri.toString();
            let observable = this._fullDiffs.get(key);
            if (!observable) {
                observable = this._createDiffBetweenStopsObservable(uri, requestId, stopId);
                this._fullDiffs.set(key, observable);
            }
            return observable;
        }
    }
    createSnapshot(requestId, undoStop, makeEmpty = undoStop !== undefined) {
        const snapshot = makeEmpty ? this._createEmptySnapshot(undoStop) : this._createSnapshot(requestId, undoStop);
        const linearHistoryPtr = this._linearHistoryIndex.get();
        const newLinearHistory = [];
        for (const entry of this._linearHistory.get()) {
            if (linearHistoryPtr - entry.startIndex < entry.stops.length) {
                newLinearHistory.push({ requestId: entry.requestId, stops: entry.stops.slice(0, linearHistoryPtr - entry.startIndex), startIndex: entry.startIndex, postEdit: undefined });
            }
            else {
                newLinearHistory.push(entry);
            }
        }
        const lastEntry = newLinearHistory.at(-1);
        if (requestId && lastEntry?.requestId === requestId) {
            newLinearHistory[newLinearHistory.length - 1] = { ...lastEntry, stops: [...lastEntry.stops, snapshot], postEdit: undefined };
        }
        else {
            newLinearHistory.push({ requestId, startIndex: lastEntry ? lastEntry.startIndex + lastEntry.stops.length : 0, stops: [snapshot], postEdit: undefined });
        }
        transaction((tx) => {
            const last = newLinearHistory[newLinearHistory.length - 1];
            this._linearHistory.set(newLinearHistory, tx);
            this._linearHistoryIndex.set(last.startIndex + last.stops.length, tx);
        });
    }
    _createEmptySnapshot(undoStop) {
        return {
            stopId: undoStop,
            entries: new ResourceMap(),
        };
    }
    _createSnapshot(requestId, undoStop) {
        const entries = new ResourceMap();
        for (const entry of this._entriesObs.get()) {
            entries.set(entry.modifiedURI, entry.createSnapshot(requestId, undoStop));
        }
        return {
            stopId: undoStop,
            entries,
        };
    }
    getSnapshot(requestId, undoStop, snapshotUri) {
        const entries = undoStop === POST_EDIT_STOP_ID
            ? this._findSnapshot(requestId)?.postEdit
            : this._findEditStop(requestId, undoStop)?.stop.entries;
        return entries && [...entries.values()].find((e) => isEqual(e.snapshotUri, snapshotUri));
    }
    async getSnapshotModel(requestId, undoStop, snapshotUri) {
        const snapshotEntry = this.getSnapshot(requestId, undoStop, snapshotUri);
        if (!snapshotEntry) {
            return null;
        }
        return this._modelService.createModel(snapshotEntry.current, this._languageService.createById(snapshotEntry.languageId), snapshotUri, false);
    }
    getSnapshotUri(requestId, uri, stopId) {
        const stops = getCurrentAndNextStop(requestId, stopId, this._linearHistory.get());
        return stops?.next.get(uri)?.snapshotUri;
    }
    async restoreSnapshot(requestId, stopId) {
        if (requestId !== undefined) {
            const stopRef = this._findEditStop(requestId, stopId);
            if (stopRef) {
                this._ensurePendingSnapshot();
                this._linearHistoryIndex.set(stopRef.historyIndex, undefined);
                await this._restoreSnapshot(stopRef.stop);
                this._updateRequestHiddenState();
            }
        }
        else {
            const pendingSnapshot = this._pendingSnapshot;
            if (!pendingSnapshot) {
                return; // We don't have a pending snapshot that we can restore
            }
            this._pendingSnapshot = undefined;
            await this._restoreSnapshot(pendingSnapshot, undefined);
        }
    }
    async _restoreSnapshot({ entries }, restoreResolvedToDisk = true) {
        // Reset all the files which are modified in this session state
        // but which are not found in the snapshot
        for (const entry of this._entriesObs.get()) {
            const snapshotEntry = entries.get(entry.modifiedURI);
            if (!snapshotEntry) {
                entry.resetToInitialContent();
                entry.dispose();
            }
        }
        const entriesArr = [];
        // Restore all entries from the snapshot
        for (const snapshotEntry of entries.values()) {
            const entry = await this._getOrCreateModifiedFileEntry(snapshotEntry.resource, snapshotEntry.telemetryInfo);
            const restoreToDisk = snapshotEntry.state === 0 /* ModifiedFileEntryState.Modified */ || restoreResolvedToDisk;
            entry.restoreFromSnapshot(snapshotEntry, restoreToDisk);
            entriesArr.push(entry);
        }
        this._entriesObs.set(entriesArr, undefined);
    }
    _assertNotDisposed() {
        if (this._state.get() === 3 /* ChatEditingSessionState.Disposed */) {
            throw new BugIndicatingError(`Cannot access a disposed editing session`);
        }
    }
    async accept(...uris) {
        this._assertNotDisposed();
        if (uris.length === 0) {
            await Promise.all(this._entriesObs.get().map(entry => entry.accept()));
        }
        for (const uri of uris) {
            const entry = this._entriesObs.get().find(e => isEqual(e.modifiedURI, uri));
            if (entry) {
                await entry.accept();
            }
        }
        this._accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
    }
    async reject(...uris) {
        this._assertNotDisposed();
        if (uris.length === 0) {
            await Promise.all(this._entriesObs.get().map(entry => entry.reject()));
        }
        for (const uri of uris) {
            const entry = this._entriesObs.get().find(e => isEqual(e.modifiedURI, uri));
            if (entry) {
                await entry.reject();
            }
        }
        this._accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
    }
    async show(previousChanges) {
        this._assertNotDisposed();
        if (this._editorPane) {
            if (this._editorPane.isVisible()) {
                return;
            }
            else if (this._editorPane.input) {
                await this._editorGroupsService.activeGroup.openEditor(this._editorPane.input, { pinned: true, activation: EditorActivation.ACTIVATE });
                return;
            }
        }
        const input = MultiDiffEditorInput.fromResourceMultiDiffEditorInput({
            multiDiffSource: getMultiDiffSourceUri(this, previousChanges),
            label: localize('multiDiffEditorInput.name', "Suggested Edits")
        }, this._instantiationService);
        this._editorPane = await this._editorGroupsService.activeGroup.openEditor(input, { pinned: true, activation: EditorActivation.ACTIVATE });
    }
    async stop(clearState = false) {
        this._stopPromise ??= Promise.allSettled([this._performStop(), this.storeState()]).then(() => { });
        await this._stopPromise;
        if (clearState) {
            await this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionId).clearState();
        }
    }
    async _performStop() {
        // Close out all open files
        const schemes = [AbstractChatEditingModifiedFileEntry.scheme, ChatEditingTextModelContentProvider.scheme];
        await Promise.allSettled(this._editorGroupsService.groups.flatMap(async (g) => {
            return g.editors.map(async (e) => {
                if ((e instanceof MultiDiffEditorInput && e.initialResources?.some(r => r.originalUri && schemes.indexOf(r.originalUri.scheme) !== -1))
                    || (e instanceof DiffEditorInput && e.original.resource && schemes.indexOf(e.original.resource.scheme) !== -1)) {
                    await g.closeEditor(e);
                }
            });
        }));
    }
    dispose() {
        this._assertNotDisposed();
        this._chatService.cancelCurrentRequestForSession(this.chatSessionId);
        dispose(this._entriesObs.get());
        super.dispose();
        this._state.set(3 /* ChatEditingSessionState.Disposed */, undefined);
        this._onDidDispose.fire();
        this._onDidDispose.dispose();
    }
    get isDisposed() {
        return this._state.get() === 3 /* ChatEditingSessionState.Disposed */;
    }
    startStreamingEdits(resource, responseModel, inUndoStop) {
        const completePromise = new DeferredPromise();
        const startPromise = new DeferredPromise();
        // Sequence all edits made this this resource in this streaming edits instance,
        // and also sequence the resource overall in the rare (currently invalid?) case
        // that edits are made in parallel to the same resource,
        const sequencer = new ThrottledSequencer(15, 1000);
        sequencer.queue(() => startPromise.p);
        this._streamingEditLocks.queue(resource.toString(), async () => {
            if (!this.isDisposed) {
                await this._acceptStreamingEditsStart(responseModel, inUndoStop, resource);
            }
            startPromise.complete();
            return completePromise.p;
        });
        let didComplete = false;
        return {
            pushText: (edits, isLastEdits) => {
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(resource, edits, isLastEdits, responseModel);
                    }
                });
            },
            pushNotebookCellText: (cell, edits, isLastEdits) => {
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(cell, edits, isLastEdits, responseModel);
                    }
                });
            },
            pushNotebook: (edits, isLastEdits) => {
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(resource, edits, isLastEdits, responseModel);
                    }
                });
            },
            complete: () => {
                if (didComplete) {
                    return;
                }
                didComplete = true;
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(resource, [], true, responseModel);
                        await this._resolve(responseModel.requestId, inUndoStop, resource);
                        completePromise.complete();
                    }
                });
            },
        };
    }
    _getHistoryEntryByLinearIndex(index) {
        const history = this._linearHistory.get();
        const searchedIndex = binarySearch2(history.length, (e) => history[e].startIndex - index);
        const entry = history[searchedIndex < 0 ? (~searchedIndex) - 1 : searchedIndex];
        if (!entry || index - entry.startIndex >= entry.stops.length) {
            return undefined;
        }
        return {
            entry,
            stop: entry.stops[index - entry.startIndex]
        };
    }
    async undoInteraction() {
        const newIndex = this._linearHistoryIndex.get() - 1;
        const previousSnapshot = this._getHistoryEntryByLinearIndex(newIndex);
        if (!previousSnapshot) {
            return;
        }
        this._ensurePendingSnapshot();
        await this._restoreSnapshot(previousSnapshot.stop);
        this._linearHistoryIndex.set(newIndex, undefined);
        this._updateRequestHiddenState();
    }
    async redoInteraction() {
        const maxIndex = getMaxHistoryIndex(this._linearHistory.get());
        const newIndex = this._linearHistoryIndex.get() + 1;
        if (newIndex > maxIndex) {
            return;
        }
        const nextSnapshot = newIndex === maxIndex ? this._pendingSnapshot : this._getHistoryEntryByLinearIndex(newIndex)?.stop;
        if (!nextSnapshot) {
            return;
        }
        await this._restoreSnapshot(nextSnapshot);
        this._linearHistoryIndex.set(newIndex, undefined);
        this._updateRequestHiddenState();
    }
    _updateRequestHiddenState() {
        const history = this._linearHistory.get();
        const index = this._linearHistoryIndex.get();
        const undoRequests = [];
        for (const entry of history) {
            if (!entry.requestId) {
                // ignored
            }
            else if (entry.startIndex >= index) {
                undoRequests.push({ requestId: entry.requestId });
            }
            else if (entry.startIndex + entry.stops.length > index) {
                undoRequests.push({ requestId: entry.requestId, afterUndoStop: entry.stops[index - entry.startIndex].stopId });
            }
        }
        this._chatService.getSession(this.chatSessionId)?.setDisabledRequests(undoRequests);
    }
    async _acceptStreamingEditsStart(responseModel, undoStop, resource) {
        const entry = await this._getOrCreateModifiedFileEntry(resource, this._getTelemetryInfoForModel(responseModel));
        transaction((tx) => {
            this._state.set(1 /* ChatEditingSessionState.StreamingEdits */, tx);
            entry.acceptStreamingEditsStart(responseModel, tx);
            this.ensureEditInUndoStopMatches(responseModel.requestId, undoStop, entry, false, tx);
        });
    }
    /**
     * Ensures the state of the file in the given snapshot matches the current
     * state of the {@param entry}. This is used to handle concurrent file edits.
     *
     * Given the case of two different edits, we will place and undo stop right
     * before we `textEditGroup` in the underlying markdown stream, but at the
     * time those are added the edits haven't been made yet, so both files will
     * simply have the unmodified state.
     *
     * This method is called after each edit, so after the first file finishes
     * being edits, it will update its content in the second undo snapshot such
     * that it can be undone successfully.
     *
     * We ensure that the same file is not concurrently edited via the
     * {@link _streamingEditLocks}, avoiding race conditions.
     *
     * @param next If true, this will edit the snapshot _after_ the undo stop
     */
    ensureEditInUndoStopMatches(requestId, undoStop, entry, next, tx) {
        const history = this._linearHistory.get();
        const snapIndex = history.findIndex(s => s.requestId === requestId);
        if (snapIndex === -1) {
            return;
        }
        const snap = history[snapIndex];
        let stopIndex = snap.stops.findIndex(s => s.stopId === undoStop);
        if (stopIndex === -1) {
            return;
        }
        // special case: put the last change in the pendingSnapshot as needed
        if (next) {
            if (stopIndex === snap.stops.length - 1) {
                const postEdit = new ResourceMap(snap.postEdit || this._createEmptySnapshot(undefined).entries);
                if (!snap.postEdit || !entry.equalsSnapshot(postEdit.get(entry.modifiedURI))) {
                    postEdit.set(entry.modifiedURI, entry.createSnapshot(requestId, POST_EDIT_STOP_ID));
                    const newHistory = history.slice();
                    newHistory[snapIndex] = { ...snap, postEdit };
                    this._linearHistory.set(newHistory, tx);
                }
                return;
            }
            stopIndex++;
        }
        const stop = snap.stops[stopIndex];
        if (entry.equalsSnapshot(stop.entries.get(entry.modifiedURI))) {
            return;
        }
        const newMap = new ResourceMap(stop.entries);
        newMap.set(entry.modifiedURI, entry.createSnapshot(requestId, stop.stopId));
        const newStop = snap.stops.slice();
        newStop[stopIndex] = { ...stop, entries: newMap };
        const newHistory = history.slice();
        newHistory[snapIndex] = { ...snap, stops: newStop };
        this._linearHistory.set(newHistory, tx);
    }
    async _acceptEdits(resource, textEdits, isLastEdits, responseModel) {
        this._fullDiffs.delete(resource.toString());
        const entry = await this._getOrCreateModifiedFileEntry(resource, this._getTelemetryInfoForModel(responseModel));
        await entry.acceptAgentEdits(resource, textEdits, isLastEdits, responseModel);
    }
    _getTelemetryInfoForModel(responseModel) {
        // Make these getters because the response result is not available when the file first starts to be edited
        return new class {
            get agentId() { return responseModel.agent?.id; }
            get command() { return responseModel.slashCommand?.name; }
            get sessionId() { return responseModel.session.sessionId; }
            get requestId() { return responseModel.requestId; }
            get result() { return responseModel.result; }
        };
    }
    async _resolve(requestId, undoStop, resource) {
        const hasOtherTasks = Iterable.some(this._streamingEditLocks.keys(), k => k !== resource.toString());
        if (!hasOtherTasks) {
            this._state.set(2 /* ChatEditingSessionState.Idle */, undefined);
        }
        const entry = this._getEntry(resource);
        if (!entry) {
            return;
        }
        this.ensureEditInUndoStopMatches(requestId, undoStop, entry, /* next= */ true, undefined);
        return entry.acceptStreamingEditsEnd();
    }
    /**
     * Retrieves or creates a modified file entry.
     *
     * @returns The modified file entry.
     */
    async _getOrCreateModifiedFileEntry(resource, telemetryInfo) {
        resource = CellUri.parse(resource)?.notebook ?? resource;
        const existingEntry = this._entriesObs.get().find(e => isEqual(e.modifiedURI, resource));
        if (existingEntry) {
            if (telemetryInfo.requestId !== existingEntry.telemetryInfo.requestId) {
                existingEntry.updateTelemetryInfo(telemetryInfo);
            }
            return existingEntry;
        }
        let entry;
        const existingExternalEntry = this._lookupExternalEntry(resource);
        if (existingExternalEntry) {
            entry = existingExternalEntry;
        }
        else {
            const initialContent = this._initialFileContents.get(resource);
            // This gets manually disposed in .dispose() or in .restoreSnapshot()
            entry = await this._createModifiedFileEntry(resource, telemetryInfo, false, initialContent);
            if (!initialContent) {
                this._initialFileContents.set(resource, entry.initialContent);
            }
        }
        // If an entry is deleted e.g. reverting a created file,
        // remove it from the entries and don't show it in the working set anymore
        // so that it can be recreated e.g. through retry
        const listener = entry.onDidDelete(() => {
            const newEntries = this._entriesObs.get().filter(e => !isEqual(e.modifiedURI, entry.modifiedURI));
            this._entriesObs.set(newEntries, undefined);
            this._editorService.closeEditors(this._editorService.findEditors(entry.modifiedURI));
            if (!existingExternalEntry) {
                // don't dispose entries that are not yours!
                entry.dispose();
            }
            this._store.delete(listener);
        });
        this._store.add(listener);
        const entriesArr = [...this._entriesObs.get(), entry];
        this._entriesObs.set(entriesArr, undefined);
        return entry;
    }
    async _createModifiedFileEntry(resource, telemetryInfo, mustExist = false, initialContent) {
        const multiDiffEntryDelegate = { collapse: (transaction) => this._collapse(resource, transaction) };
        const chatKind = mustExist ? 0 /* ChatEditKind.Created */ : 1 /* ChatEditKind.Modified */;
        const notebookUri = CellUri.parse(resource)?.notebook || resource;
        try {
            if (this._notebookService.hasSupportedNotebooks(notebookUri)) {
                return await ChatEditingModifiedNotebookEntry.create(notebookUri, multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent, this._instantiationService);
            }
            else {
                const ref = await this._textModelService.createModelReference(resource);
                return this._instantiationService.createInstance(ChatEditingModifiedDocumentEntry, ref, multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent);
            }
        }
        catch (err) {
            if (mustExist) {
                throw err;
            }
            // this file does not exist yet, create it and try again
            await this._bulkEditService.apply({ edits: [{ newResource: resource }] });
            this._editorService.openEditor({ resource, options: { inactive: true, preserveFocus: true, pinned: true } });
            if (this._notebookService.hasSupportedNotebooks(notebookUri)) {
                return await ChatEditingModifiedNotebookEntry.create(resource, multiDiffEntryDelegate, telemetryInfo, 0 /* ChatEditKind.Created */, initialContent, this._instantiationService);
            }
            else {
                return this._createModifiedFileEntry(resource, telemetryInfo, true, initialContent);
            }
        }
    }
    _collapse(resource, transaction) {
        const multiDiffItem = this._editorPane?.findDocumentDiffItem(resource);
        if (multiDiffItem) {
            this._editorPane?.viewModel?.items.get().find((documentDiffItem) => isEqual(documentDiffItem.originalUri, multiDiffItem.originalUri) &&
                isEqual(documentDiffItem.modifiedUri, multiDiffItem.modifiedUri))
                ?.collapsed.set(true, transaction);
        }
    }
};
ChatEditingSession = __decorate([
    __param(3, IInstantiationService),
    __param(4, IModelService),
    __param(5, ILanguageService),
    __param(6, ITextModelService),
    __param(7, IBulkEditService),
    __param(8, IEditorGroupsService),
    __param(9, IEditorService),
    __param(10, IChatService),
    __param(11, INotebookService),
    __param(12, IEditorWorkerService),
    __param(13, IConfigurationService),
    __param(14, IAccessibilitySignalService)
], ChatEditingSession);
export { ChatEditingSession };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXNzaW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdTZXNzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxNQUFNLElBQUksV0FBVyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsZUFBZSxFQUFTLFNBQVMsRUFBRSxjQUFjLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDMUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMvRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFzQyxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDOUssT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBRTdGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9E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