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
var InlineCompletionsSource_1;
import { compareUndefinedSmallest, numberComparator } from '../../../../../base/common/arrays.js';
import { findLastMax } from '../../../../../base/common/arraysFind.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { equalsIfDefined, itemEquals } from '../../../../../base/common/equals.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { derived, observableValue, recordChanges, transaction } from '../../../../../base/common/observable.js';
// eslint-disable-next-line local/code-no-deep-import-of-internal
import { observableReducerSettable } from '../../../../../base/common/observableInternal/experimental/reducer.js';
import { isDefined } from '../../../../../base/common/types.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
import { StringEdit } from '../../../../common/core/edits/stringEdit.js';
import { InlineCompletionEndOfLifeReasonKind, InlineCompletionTriggerKind } from '../../../../common/languages.js';
import { ILanguageConfigurationService } from '../../../../common/languages/languageConfigurationRegistry.js';
import { offsetEditFromContentChanges } from '../../../../common/model/textModelStringEdit.js';
import { formatRecordableLogEntry, StructuredLogger } from '../structuredLogger.js';
import { wait } from '../utils.js';
import { InlineSuggestionItem } from './inlineSuggestionItem.js';
import { provideInlineCompletions } from './provideInlineCompletions.js';
let InlineCompletionsSource = class InlineCompletionsSource extends Disposable {
    static { InlineCompletionsSource_1 = this; }
    static { this._requestId = 0; }
    constructor(_textModel, _versionId, _debounceValue, _languageConfigurationService, _logService, _configurationService, _instantiationService) {
        super();
        this._textModel = _textModel;
        this._versionId = _versionId;
        this._debounceValue = _debounceValue;
        this._languageConfigurationService = _languageConfigurationService;
        this._logService = _logService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._updateOperation = this._register(new MutableDisposable());
        this._loggingEnabled = observableConfigValue('editor.inlineSuggest.logFetch', false, this._configurationService).recomputeInitiallyAndOnChange(this._store);
        this._structuredFetchLogger = this._register(this._instantiationService.createInstance(StructuredLogger.cast(), 'editor.inlineSuggest.logFetch.commandId'));
        this._state = observableReducerSettable(this, {
            initial: () => ({
                inlineCompletions: InlineCompletionsState.createEmpty(),
                suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty(),
            }),
            disposeFinal: (values) => {
                values.inlineCompletions.dispose();
                values.suggestWidgetInlineCompletions.dispose();
            },
            changeTracker: recordChanges({ versionId: this._versionId }),
            update: (reader, previousValue, changes) => {
                const edit = StringEdit.compose(changes.changes.map(c => c.change ? offsetEditFromContentChanges(c.change.changes) : StringEdit.empty).filter(isDefined));
                if (edit.isEmpty()) {
                    return previousValue;
                }
                try {
                    return {
                        inlineCompletions: previousValue.inlineCompletions.createStateWithAppliedEdit(edit, this._textModel),
                        suggestWidgetInlineCompletions: previousValue.suggestWidgetInlineCompletions.createStateWithAppliedEdit(edit, this._textModel),
                    };
                }
                finally {
                    previousValue.inlineCompletions.dispose();
                    previousValue.suggestWidgetInlineCompletions.dispose();
                }
            }
        });
        this.inlineCompletions = this._state.map(this, v => v.inlineCompletions);
        this.suggestWidgetInlineCompletions = this._state.map(this, v => v.suggestWidgetInlineCompletions);
        this.clearOperationOnTextModelChange = derived(this, reader => {
            this._versionId.read(reader);
            this._updateOperation.clear();
            return undefined; // always constant
        });
        this._loadingCount = observableValue(this, 0);
        this.loading = this._loadingCount.map(this, v => v > 0);
        this.clearOperationOnTextModelChange.recomputeInitiallyAndOnChange(this._store);
    }
    _log(entry) {
        if (this._loggingEnabled.get()) {
            this._logService.info(formatRecordableLogEntry(entry));
        }
        this._structuredFetchLogger.log(entry);
    }
    fetch(providers, position, context, activeInlineCompletion, withDebounce, userJumpedToActiveCompletion, providerhasChangedCompletion) {
        const request = new UpdateRequest(position, context, this._textModel.getVersionId());
        const target = context.selectedSuggestionInfo ? this.suggestWidgetInlineCompletions.get() : this.inlineCompletions.get();
        if (!providerhasChangedCompletion && this._updateOperation.value?.request.satisfies(request)) {
            return this._updateOperation.value.promise;
        }
        else if (target?.request?.satisfies(request)) {
            return Promise.resolve(true);
        }
        const updateOngoing = !!this._updateOperation.value;
        this._updateOperation.clear();
        const source = new CancellationTokenSource();
        const promise = (async () => {
            this._loadingCount.set(this._loadingCount.get() + 1, undefined);
            try {
                const recommendedDebounceValue = this._debounceValue.get(this._textModel);
                const debounceValue = findLastMax(providers.map(p => p.debounceDelayMs), compareUndefinedSmallest(numberComparator)) ?? recommendedDebounceValue;
                // Debounce in any case if update is ongoing
                const shouldDebounce = updateOngoing || (withDebounce && context.triggerKind === InlineCompletionTriggerKind.Automatic);
                if (shouldDebounce) {
                    // This debounces the operation
                    await wait(debounceValue, source.token);
                }
                if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId) {
                    return false;
                }
                const requestId = InlineCompletionsSource_1._requestId++;
                if (this._loggingEnabled.get() || this._structuredFetchLogger.isEnabled.get()) {
                    this._log({ sourceId: 'InlineCompletions.fetch', kind: 'start', requestId, modelUri: this._textModel.uri.toString(), modelVersion: this._textModel.getVersionId(), context: { triggerKind: context.triggerKind }, time: Date.now() });
                }
                const startTime = new Date();
                let providerResult = undefined;
                let error = undefined;
                try {
                    providerResult = await provideInlineCompletions(providers, position, this._textModel, context, source.token, this._languageConfigurationService);
                }
                catch (e) {
                    error = e;
                    throw e;
                }
                finally {
                    if (this._loggingEnabled.get() || this._structuredFetchLogger.isEnabled.get()) {
                        if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId) {
                            error = 'canceled';
                        }
                        const result = providerResult?.completions.map(c => ({
                            range: c.range.toString(),
                            text: c.insertText,
                            isInlineEdit: !!c.isInlineEdit,
                            source: c.source.provider.groupId,
                        }));
                        this._log({ sourceId: 'InlineCompletions.fetch', kind: 'end', requestId, durationMs: (Date.now() - startTime.getTime()), error, result, time: Date.now() });
                    }
                }
                if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId || userJumpedToActiveCompletion.get() /* In the meantime the user showed interest for the active completion so dont hide it */) {
                    providerResult.dispose();
                    return false;
                }
                const endTime = new Date();
                this._debounceValue.update(this._textModel, endTime.getTime() - startTime.getTime());
                this._updateOperation.clear();
                transaction(tx => {
                    const v = this._state.get();
                    /** @description Update completions with provider result */
                    if (context.selectedSuggestionInfo) {
                        this._state.set({
                            inlineCompletions: InlineCompletionsState.createEmpty(),
                            suggestWidgetInlineCompletions: v.suggestWidgetInlineCompletions.createStateWithAppliedResults(providerResult, request, this._textModel, activeInlineCompletion),
                        }, tx);
                    }
                    else {
                        this._state.set({
                            inlineCompletions: v.inlineCompletions.createStateWithAppliedResults(providerResult, request, this._textModel, activeInlineCompletion),
                            suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty(),
                        }, tx);
                    }
                    providerResult.dispose();
                    v.inlineCompletions.dispose();
                    v.suggestWidgetInlineCompletions.dispose();
                });
            }
            finally {
                this._loadingCount.set(this._loadingCount.get() - 1, undefined);
            }
            return true;
        })();
        const updateOperation = new UpdateOperation(request, source, promise);
        this._updateOperation.value = updateOperation;
        return promise;
    }
    clear(tx) {
        this._updateOperation.clear();
        const v = this._state.get();
        this._state.set({
            inlineCompletions: InlineCompletionsState.createEmpty(),
            suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty()
        }, tx);
        v.inlineCompletions.dispose();
        v.suggestWidgetInlineCompletions.dispose();
    }
    seedInlineCompletionsWithSuggestWidget() {
        const inlineCompletions = this.inlineCompletions.get();
        const suggestWidgetInlineCompletions = this.suggestWidgetInlineCompletions.get();
        if (!suggestWidgetInlineCompletions) {
            return;
        }
        transaction(tx => {
            /** @description Seed inline completions with (newer) suggest widget inline completions */
            if (!inlineCompletions || (suggestWidgetInlineCompletions.request?.versionId ?? -1) > (inlineCompletions.request?.versionId ?? -1)) {
                inlineCompletions?.dispose();
                const s = this._state.get();
                this._state.set({
                    inlineCompletions: suggestWidgetInlineCompletions.clone(),
                    suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty(),
                }, tx);
                s.inlineCompletions.dispose();
                s.suggestWidgetInlineCompletions.dispose();
            }
            this.clearSuggestWidgetInlineCompletions(tx);
        });
    }
    clearSuggestWidgetInlineCompletions(tx) {
        if (this._updateOperation.value?.request.context.selectedSuggestionInfo) {
            this._updateOperation.clear();
        }
    }
    cancelUpdate() {
        this._updateOperation.clear();
    }
};
InlineCompletionsSource = InlineCompletionsSource_1 = __decorate([
    __param(3, ILanguageConfigurationService),
    __param(4, ILogService),
    __param(5, IConfigurationService),
    __param(6, IInstantiationService)
], InlineCompletionsSource);
export { InlineCompletionsSource };
class UpdateRequest {
    constructor(position, context, versionId) {
        this.position = position;
        this.context = context;
        this.versionId = versionId;
    }
    satisfies(other) {
        return this.position.equals(other.position)
            && equalsIfDefined(this.context.selectedSuggestionInfo, other.context.selectedSuggestionInfo, itemEquals())
            && (other.context.triggerKind === InlineCompletionTriggerKind.Automatic
                || this.context.triggerKind === InlineCompletionTriggerKind.Explicit)
            && this.versionId === other.versionId;
    }
    get isExplicitRequest() {
        return this.context.triggerKind === InlineCompletionTriggerKind.Explicit;
    }
}
class UpdateOperation {
    constructor(request, cancellationTokenSource, promise) {
        this.request = request;
        this.cancellationTokenSource = cancellationTokenSource;
        this.promise = promise;
    }
    dispose() {
        this.cancellationTokenSource.cancel();
    }
}
class InlineCompletionsState extends Disposable {
    static createEmpty() {
        return new InlineCompletionsState([], undefined);
    }
    constructor(inlineCompletions, request) {
        for (const inlineCompletion of inlineCompletions) {
            inlineCompletion.addRef();
        }
        super();
        this.inlineCompletions = inlineCompletions;
        this.request = request;
        this._register({
            dispose: () => {
                for (const inlineCompletion of this.inlineCompletions) {
                    inlineCompletion.removeRef();
                }
            }
        });
    }
    _findById(id) {
        return this.inlineCompletions.find(i => i.identity === id);
    }
    _findByHash(hash) {
        return this.inlineCompletions.find(i => i.hash === hash);
    }
    /**
     * Applies the edit on the state.
    */
    createStateWithAppliedEdit(edit, textModel) {
        const newInlineCompletions = this.inlineCompletions.map(i => i.withEdit(edit, textModel)).filter(isDefined);
        return new InlineCompletionsState(newInlineCompletions, this.request);
    }
    createStateWithAppliedResults(update, request, textModel, itemToPreserve) {
        const items = [];
        for (const item of update.completions) {
            const i = InlineSuggestionItem.create(item, textModel);
            const oldItem = this._findByHash(i.hash);
            if (oldItem) {
                items.push(i.withIdentity(oldItem.identity));
                oldItem.setEndOfLifeReason({ kind: InlineCompletionEndOfLifeReasonKind.Ignored, userTypingDisagreed: false, supersededBy: i.getSourceCompletion() });
            }
            else {
                items.push(i);
            }
        }
        if (itemToPreserve) {
            const item = this._findById(itemToPreserve);
            if (item && !update.has(item.getSingleTextEdit()) && item.canBeReused(textModel, request.position)) {
                items.unshift(item);
            }
        }
        return new InlineCompletionsState(items, request);
    }
    clone() {
        return new InlineCompletionsState(this.inlineCompletions, this.request);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnNTb3VyY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvbW9kZWwvaW5saW5lQ29tcGxldGlvbnNTb3VyY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsZUFBZSxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxVQUFVLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsT0FBTyxFQUFvRCxlQUFlLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xLLGlFQUFpRTtBQUNqRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUNsSCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQzdHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV6RSxPQUFPLEVBQUUs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