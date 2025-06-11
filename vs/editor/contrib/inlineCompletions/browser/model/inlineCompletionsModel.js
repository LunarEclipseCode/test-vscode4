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
import { mapFindFirst } from '../../../../../base/common/arraysFind.js';
import { itemsEquals } from '../../../../../base/common/equals.js';
import { BugIndicatingError, onUnexpectedError, onUnexpectedExternalError } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, autorunWithStore, constObservable, derived, derivedHandleChanges, derivedOpts, observableFromEvent, observableSignal, observableValue, recomputeInitiallyAndOnChange, subtransaction, transaction } from '../../../../../base/common/observable.js';
import { commonPrefixLength, firstNonWhitespaceIndex } from '../../../../../base/common/strings.js';
import { isDefined } from '../../../../../base/common/types.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { observableCodeEditor } from '../../../../browser/observableCodeEditor.js';
import { CursorColumns } from '../../../../common/core/cursorColumns.js';
import { EditOperation } from '../../../../common/core/editOperation.js';
import { LineRange } from '../../../../common/core/ranges/lineRange.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { Selection } from '../../../../common/core/selection.js';
import { TextReplacement, TextEdit } from '../../../../common/core/edits/textEdit.js';
import { TextLength } from '../../../../common/core/text/textLength.js';
import { InlineCompletionEndOfLifeReasonKind, InlineCompletionTriggerKind } from '../../../../common/languages.js';
import { ILanguageConfigurationService } from '../../../../common/languages/languageConfigurationRegistry.js';
import { TextModelText } from '../../../../common/model/textModelText.js';
import { ILanguageFeaturesService } from '../../../../common/services/languageFeatures.js';
import { SnippetController2 } from '../../../snippet/browser/snippetController2.js';
import { addPositions, getEndPositionsAfterApplying, removeTextReplacementCommonSuffixPrefix, substringPos, subtractPositions } from '../utils.js';
import { AnimatedValue, easeOutCubic, ObservableAnimatedValue } from './animation.js';
import { computeGhostText } from './computeGhostText.js';
import { GhostText, ghostTextOrReplacementEquals, ghostTextsOrReplacementsEqual } from './ghostText.js';
import { InlineCompletionsSource } from './inlineCompletionsSource.js';
import { InlineEdit } from './inlineEdit.js';
import { singleTextEditAugments, singleTextRemoveCommonPrefix } from './singleTextEditHelpers.js';
import { TextModelEditReason } from '../../../../common/textModelEditReason.js';
let InlineCompletionsModel = class InlineCompletionsModel extends Disposable {
    get isAcceptingPartially() { return this._isAcceptingPartially; }
    constructor(textModel, _selectedSuggestItem, _textModelVersionId, _positions, _debounceValue, _enabled, _editor, _instantiationService, _commandService, _languageConfigurationService, _accessibilityService, _languageFeaturesService) {
        super();
        this.textModel = textModel;
        this._selectedSuggestItem = _selectedSuggestItem;
        this._textModelVersionId = _textModelVersionId;
        this._positions = _positions;
        this._debounceValue = _debounceValue;
        this._enabled = _enabled;
        this._editor = _editor;
        this._instantiationService = _instantiationService;
        this._commandService = _commandService;
        this._languageConfigurationService = _languageConfigurationService;
        this._accessibilityService = _accessibilityService;
        this._languageFeaturesService = _languageFeaturesService;
        this._source = this._register(this._instantiationService.createInstance(InlineCompletionsSource, this.textModel, this._textModelVersionId, this._debounceValue));
        this._isActive = observableValue(this, false);
        this._onlyRequestInlineEditsSignal = observableSignal(this);
        this._forceUpdateExplicitlySignal = observableSignal(this);
        this._noDelaySignal = observableSignal(this);
        this._fetchSpecificProviderSignal = observableSignal(this);
        this._selectedInlineCompletionId = observableValue(this, undefined);
        this.primaryPosition = derived(this, reader => this._positions.read(reader)[0] ?? new Position(1, 1));
        this._isAcceptingPartially = false;
        this._onDidAccept = new Emitter();
        this.onDidAccept = this._onDidAccept.event;
        this._editorObs = observableCodeEditor(this._editor);
        this._suggestPreviewEnabled = this._editorObs.getOption(126 /* EditorOption.suggest */).map(v => v.preview);
        this._suggestPreviewMode = this._editorObs.getOption(126 /* EditorOption.suggest */).map(v => v.previewMode);
        this._inlineSuggestMode = this._editorObs.getOption(67 /* EditorOption.inlineSuggest */).map(v => v.mode);
        this._suppressedInlineCompletionGroupIds = this._editorObs.getOption(67 /* EditorOption.inlineSuggest */).map(v => new Set(v.experimental.suppressInlineSuggestions));
        this._inlineEditsEnabled = this._editorObs.getOption(67 /* EditorOption.inlineSuggest */).map(v => !!v.edits.enabled);
        this._inlineEditsShowCollapsedEnabled = this._editorObs.getOption(67 /* EditorOption.inlineSuggest */).map(s => s.edits.showCollapsed);
        this._lastShownInlineCompletionInfo = undefined;
        this._lastAcceptedInlineCompletionInfo = undefined;
        this._didUndoInlineEdits = derivedHandleChanges({
            owner: this,
            changeTracker: {
                createChangeSummary: () => ({ didUndo: false }),
                handleChange: (ctx, changeSummary) => {
                    changeSummary.didUndo = ctx.didChange(this._textModelVersionId) && !!ctx.change?.isUndoing;
                    return true;
                }
            }
        }, (reader, changeSummary) => {
            const versionId = this._textModelVersionId.read(reader);
            if (versionId !== null
                && this._lastAcceptedInlineCompletionInfo
                && this._lastAcceptedInlineCompletionInfo.textModelVersionIdAfter === versionId - 1
                && this._lastAcceptedInlineCompletionInfo.inlineCompletion.isInlineEdit
                && changeSummary.didUndo) {
                this._lastAcceptedInlineCompletionInfo = undefined;
                return true;
            }
            return false;
        });
        this._preserveCurrentCompletionReasons = new Set([
            VersionIdChangeReason.Redo,
            VersionIdChangeReason.Undo,
            VersionIdChangeReason.AcceptWord,
        ]);
        this.dontRefetchSignal = observableSignal(this);
        this._fetchInlineCompletionsPromise = derivedHandleChanges({
            owner: this,
            changeTracker: {
                createChangeSummary: () => ({
                    dontRefetch: false,
                    preserveCurrentCompletion: false,
                    inlineCompletionTriggerKind: InlineCompletionTriggerKind.Automatic,
                    onlyRequestInlineEdits: false,
                    shouldDebounce: true,
                    provider: undefined,
                }),
                handleChange: (ctx, changeSummary) => {
                    /** @description fetch inline completions */
                    if (ctx.didChange(this._textModelVersionId) && this._preserveCurrentCompletionReasons.has(this._getReason(ctx.change))) {
                        changeSummary.preserveCurrentCompletion = true;
                    }
                    else if (ctx.didChange(this._forceUpdateExplicitlySignal)) {
                        changeSummary.inlineCompletionTriggerKind = InlineCompletionTriggerKind.Explicit;
                    }
                    else if (ctx.didChange(this.dontRefetchSignal)) {
                        changeSummary.dontRefetch = true;
                    }
                    else if (ctx.didChange(this._onlyRequestInlineEditsSignal)) {
                        changeSummary.onlyRequestInlineEdits = true;
                    }
                    else if (ctx.didChange(this._fetchSpecificProviderSignal)) {
                        changeSummary.provider = ctx.change;
                    }
                    return true;
                },
            },
        }, (reader, changeSummary) => {
            this._source.clearOperationOnTextModelChange.read(reader); // Make sure the clear operation runs before the fetch operation
            this._noDelaySignal.read(reader);
            this.dontRefetchSignal.read(reader);
            this._onlyRequestInlineEditsSignal.read(reader);
            this._forceUpdateExplicitlySignal.read(reader);
            this._fetchSpecificProviderSignal.read(reader);
            const shouldUpdate = (this._enabled.read(reader) && this._selectedSuggestItem.read(reader)) || this._isActive.read(reader);
            if (!shouldUpdate) {
                this._source.cancelUpdate();
                return undefined;
            }
            this._textModelVersionId.read(reader); // Refetch on text change
            const suggestWidgetInlineCompletions = this._source.suggestWidgetInlineCompletions.get();
            const suggestItem = this._selectedSuggestItem.read(reader);
            if (suggestWidgetInlineCompletions && !suggestItem) {
                this._source.seedInlineCompletionsWithSuggestWidget();
            }
            const cursorPosition = this.primaryPosition.get();
            if (changeSummary.dontRefetch) {
                return Promise.resolve(true);
            }
            if (this._didUndoInlineEdits.read(reader) && changeSummary.inlineCompletionTriggerKind !== InlineCompletionTriggerKind.Explicit) {
                transaction(tx => {
                    this._source.clear(tx);
                });
                return undefined;
            }
            let context = {
                triggerKind: changeSummary.inlineCompletionTriggerKind,
                selectedSuggestionInfo: suggestItem?.toSelectedSuggestionInfo(),
                includeInlineCompletions: !changeSummary.onlyRequestInlineEdits,
                includeInlineEdits: this._inlineEditsEnabled.read(reader),
            };
            if (context.triggerKind === InlineCompletionTriggerKind.Automatic) {
                if (this.textModel.getAlternativeVersionId() === this._lastShownInlineCompletionInfo?.alternateTextModelVersionId) {
                    // When undoing back to a version where an inline edit/completion was shown,
                    // we want to show an inline edit (or completion) again if it was originally an inline edit (or completion).
                    context = {
                        ...context,
                        includeInlineCompletions: !this._lastShownInlineCompletionInfo.inlineCompletion.isInlineEdit,
                        includeInlineEdits: this._lastShownInlineCompletionInfo.inlineCompletion.isInlineEdit,
                    };
                }
            }
            const itemToPreserveCandidate = this.selectedInlineCompletion.get() ?? this._inlineCompletionItems.get()?.inlineEdit;
            const itemToPreserve = changeSummary.preserveCurrentCompletion || itemToPreserveCandidate?.forwardStable
                ? itemToPreserveCandidate : undefined;
            const userJumpedToActiveCompletion = this._jumpedToId.map(jumpedTo => !!jumpedTo && jumpedTo === this._inlineCompletionItems.get()?.inlineEdit?.semanticId);
            const providers = changeSummary.provider ? [changeSummary.provider] : this._languageFeaturesService.inlineCompletionsProvider.all(this.textModel);
            const suppressedProviderGroupIds = this._suppressedInlineCompletionGroupIds.get();
            const availableProviders = providers.filter(provider => !(provider.groupId && suppressedProviderGroupIds.has(provider.groupId)));
            return this._source.fetch(availableProviders, cursorPosition, context, itemToPreserve?.identity, changeSummary.shouldDebounce, userJumpedToActiveCompletion, !!changeSummary.provider);
        });
        this._inlineCompletionItems = derivedOpts({ owner: this }, reader => {
            const c = this._source.inlineCompletions.read(reader);
            if (!c) {
                return undefined;
            }
            const cursorPosition = this.primaryPosition.read(reader);
            let inlineEdit = undefined;
            const visibleCompletions = [];
            for (const completion of c.inlineCompletions) {
                if (!completion.isInlineEdit) {
                    if (completion.isVisible(this.textModel, cursorPosition)) {
                        visibleCompletions.push(completion);
                    }
                }
                else {
                    inlineEdit = completion;
                }
            }
            if (visibleCompletions.length !== 0) {
                // Don't show the inline edit if there is a visible completion
                inlineEdit = undefined;
            }
            return {
                inlineCompletions: visibleCompletions,
                inlineEdit,
            };
        });
        this._filteredInlineCompletionItems = derivedOpts({ owner: this, equalsFn: itemsEquals() }, reader => {
            const c = this._inlineCompletionItems.read(reader);
            return c?.inlineCompletions ?? [];
        });
        this.selectedInlineCompletionIndex = derived(this, (reader) => {
            const selectedInlineCompletionId = this._selectedInlineCompletionId.read(reader);
            const filteredCompletions = this._filteredInlineCompletionItems.read(reader);
            const idx = this._selectedInlineCompletionId === undefined ? -1
                : filteredCompletions.findIndex(v => v.semanticId === selectedInlineCompletionId);
            if (idx === -1) {
                // Reset the selection so that the selection does not jump back when it appears again
                this._selectedInlineCompletionId.set(undefined, undefined);
                return 0;
            }
            return idx;
        });
        this.selectedInlineCompletion = derived(this, (reader) => {
            const filteredCompletions = this._filteredInlineCompletionItems.read(reader);
            const idx = this.selectedInlineCompletionIndex.read(reader);
            return filteredCompletions[idx];
        });
        this.activeCommands = derivedOpts({ owner: this, equalsFn: itemsEquals() }, r => this.selectedInlineCompletion.read(r)?.source.inlineSuggestions.commands ?? []);
        this.lastTriggerKind = this._source.inlineCompletions.map(this, v => v?.request?.context.triggerKind);
        this.inlineCompletionsCount = derived(this, reader => {
            if (this.lastTriggerKind.read(reader) === InlineCompletionTriggerKind.Explicit) {
                return this._filteredInlineCompletionItems.read(reader).length;
            }
            else {
                return undefined;
            }
        });
        this._hasVisiblePeekWidgets = derived(this, reader => this._editorObs.openedPeekWidgets.read(reader) > 0);
        this.state = derivedOpts({
            owner: this,
            equalsFn: (a, b) => {
                if (!a || !b) {
                    return a === b;
                }
                if (a.kind === 'ghostText' && b.kind === 'ghostText') {
                    return ghostTextsOrReplacementsEqual(a.ghostTexts, b.ghostTexts)
                        && a.inlineCompletion === b.inlineCompletion
                        && a.suggestItem === b.suggestItem;
                }
                else if (a.kind === 'inlineEdit' && b.kind === 'inlineEdit') {
                    return a.inlineEdit.equals(b.inlineEdit);
                }
                return false;
            }
        }, (reader) => {
            const model = this.textModel;
            const item = this._inlineCompletionItems.read(reader);
            const inlineEditResult = item?.inlineEdit;
            if (inlineEditResult) {
                if (this._hasVisiblePeekWidgets.read(reader)) {
                    return undefined;
                }
                let edit = inlineEditResult.getSingleTextEdit();
                edit = singleTextRemoveCommonPrefix(edit, model);
                const cursorAtInlineEdit = this.primaryPosition.map(cursorPos => LineRange.fromRangeInclusive(inlineEditResult.targetRange).addMargin(1, 1).contains(cursorPos.lineNumber));
                const commands = inlineEditResult.source.inlineSuggestions.commands;
                const inlineEdit = new InlineEdit(edit, commands ?? [], inlineEditResult);
                const edits = inlineEditResult.updatedEdit;
                const e = edits ? TextEdit.fromStringEdit(edits, new TextModelText(this.textModel)).replacements : [edit];
                return { kind: 'inlineEdit', inlineEdit, inlineCompletion: inlineEditResult, edits: e, cursorAtInlineEdit };
            }
            const suggestItem = this._selectedSuggestItem.read(reader);
            if (suggestItem) {
                const suggestCompletionEdit = singleTextRemoveCommonPrefix(suggestItem.getSingleTextEdit(), model);
                const augmentation = this._computeAugmentation(suggestCompletionEdit, reader);
                const isSuggestionPreviewEnabled = this._suggestPreviewEnabled.read(reader);
                if (!isSuggestionPreviewEnabled && !augmentation) {
                    return undefined;
                }
                const fullEdit = augmentation?.edit ?? suggestCompletionEdit;
                const fullEditPreviewLength = augmentation ? augmentation.edit.text.length - suggestCompletionEdit.text.length : 0;
                const mode = this._suggestPreviewMode.read(reader);
                const positions = this._positions.read(reader);
                const edits = [fullEdit, ...getSecondaryEdits(this.textModel, positions, fullEdit)];
                const ghostTexts = edits
                    .map((edit, idx) => computeGhostText(edit, model, mode, positions[idx], fullEditPreviewLength))
                    .filter(isDefined);
                const primaryGhostText = ghostTexts[0] ?? new GhostText(fullEdit.range.endLineNumber, []);
                return { kind: 'ghostText', edits, primaryGhostText, ghostTexts, inlineCompletion: augmentation?.completion, suggestItem };
            }
            else {
                if (!this._isActive.read(reader)) {
                    return undefined;
                }
                const inlineCompletion = this.selectedInlineCompletion.read(reader);
                if (!inlineCompletion) {
                    return undefined;
                }
                const replacement = inlineCompletion.getSingleTextEdit();
                const mode = this._inlineSuggestMode.read(reader);
                const positions = this._positions.read(reader);
                const edits = [replacement, ...getSecondaryEdits(this.textModel, positions, replacement)];
                const ghostTexts = edits
                    .map((edit, idx) => computeGhostText(edit, model, mode, positions[idx], 0))
                    .filter(isDefined);
                if (!ghostTexts[0]) {
                    return undefined;
                }
                return { kind: 'ghostText', edits, primaryGhostText: ghostTexts[0], ghostTexts, inlineCompletion, suggestItem: undefined };
            }
        });
        this.status = derived(this, reader => {
            if (this._source.loading.read(reader)) {
                return 'loading';
            }
            const s = this.state.read(reader);
            if (s?.kind === 'ghostText') {
                return 'ghostText';
            }
            if (s?.kind === 'inlineEdit') {
                return 'inlineEdit';
            }
            return 'noSuggestion';
        });
        this.inlineCompletionState = derived(this, reader => {
            const s = this.state.read(reader);
            if (!s || s.kind !== 'ghostText') {
                return undefined;
            }
            if (this._editorObs.inComposition.read(reader)) {
                return undefined;
            }
            return s;
        });
        this.inlineEditState = derived(this, reader => {
            const s = this.state.read(reader);
            if (!s || s.kind !== 'inlineEdit') {
                return undefined;
            }
            return s;
        });
        this.inlineEditAvailable = derived(this, reader => {
            const s = this.inlineEditState.read(reader);
            return !!s;
        });
        this.warning = derived(this, reader => {
            return this.inlineCompletionState.read(reader)?.inlineCompletion?.warning;
        });
        this.ghostTexts = derivedOpts({ owner: this, equalsFn: ghostTextsOrReplacementsEqual }, reader => {
            const v = this.inlineCompletionState.read(reader);
            if (!v) {
                return undefined;
            }
            return v.ghostTexts;
        });
        this.primaryGhostText = derivedOpts({ owner: this, equalsFn: ghostTextOrReplacementEquals }, reader => {
            const v = this.inlineCompletionState.read(reader);
            if (!v) {
                return undefined;
            }
            return v?.primaryGhostText;
        });
        this._jumpedToId = observableValue(this, undefined);
        this._inAcceptFlow = observableValue(this, false);
        this.inAcceptFlow = this._inAcceptFlow;
        // When the suggestion appeared, was it inside the view port or not
        const appearedInsideViewport = derived(this, reader => {
            const state = this.state.read(reader);
            if (!state || !state.inlineCompletion) {
                return false;
            }
            const targetRange = state.inlineCompletion.targetRange;
            const visibleRanges = this._editorObs.editor.getVisibleRanges();
            if (visibleRanges.length < 1) {
                return false;
            }
            const viewportRange = new Range(visibleRanges[0].startLineNumber, visibleRanges[0].startColumn, visibleRanges[visibleRanges.length - 1].endLineNumber, visibleRanges[visibleRanges.length - 1].endColumn);
            return viewportRange.containsRange(targetRange);
        });
        this.showCollapsed = derived(this, reader => {
            const state = this.state.read(reader);
            if (!state || state.kind !== 'inlineEdit') {
                return false;
            }
            if (state.inlineCompletion.displayLocation) {
                return false;
            }
            const isCurrentModelVersion = state.inlineCompletion.updatedEditModelVersion === this._textModelVersionId.read(reader);
            return (this._inlineEditsShowCollapsedEnabled.read(reader) || !isCurrentModelVersion)
                && this._jumpedToId.read(reader) !== state.inlineCompletion.semanticId
                && !this._inAcceptFlow.read(reader);
        });
        this._tabShouldIndent = derived(this, reader => {
            if (this._inAcceptFlow.read(reader)) {
                return false;
            }
            function isMultiLine(range) {
                return range.startLineNumber !== range.endLineNumber;
            }
            function getNonIndentationRange(model, lineNumber) {
                const columnStart = model.getLineIndentColumn(lineNumber);
                const lastNonWsColumn = model.getLineLastNonWhitespaceColumn(lineNumber);
                const columnEnd = Math.max(lastNonWsColumn, columnStart);
                return new Range(lineNumber, columnStart, lineNumber, columnEnd);
            }
            const selections = this._editorObs.selections.read(reader);
            return selections?.some(s => {
                if (s.isEmpty()) {
                    return this.textModel.getLineLength(s.startLineNumber) === 0;
                }
                else {
                    return isMultiLine(s) || s.containsRange(getNonIndentationRange(this.textModel, s.startLineNumber));
                }
            });
        });
        this.tabShouldJumpToInlineEdit = derived(this, reader => {
            if (this._tabShouldIndent.read(reader)) {
                return false;
            }
            const s = this.inlineEditState.read(reader);
            if (!s) {
                return false;
            }
            if (this.showCollapsed.read(reader)) {
                return true;
            }
            if (this._inAcceptFlow.read(reader) && appearedInsideViewport.read(reader)) {
                return false;
            }
            return !s.cursorAtInlineEdit.read(reader);
        });
        this.tabShouldAcceptInlineEdit = derived(this, reader => {
            const s = this.inlineEditState.read(reader);
            if (!s) {
                return false;
            }
            if (this.showCollapsed.read(reader)) {
                return false;
            }
            if (this._inAcceptFlow.read(reader) && appearedInsideViewport.read(reader)) {
                return true;
            }
            if (s.inlineCompletion.targetRange.startLineNumber === this._editorObs.cursorLineNumber.read(reader)) {
                return true;
            }
            if (this._jumpedToId.read(reader) === s.inlineCompletion.semanticId) {
                return true;
            }
            if (this._tabShouldIndent.read(reader)) {
                return false;
            }
            return s.cursorAtInlineEdit.read(reader);
        });
        this._register(recomputeInitiallyAndOnChange(this._fetchInlineCompletionsPromise));
        this._register(autorun(reader => {
            /** @description call handleItemDidShow */
            const item = this.inlineCompletionState.read(reader);
            const completion = item?.inlineCompletion;
            if (completion) {
                this.handleInlineSuggestionShown(completion);
            }
        }));
        this._register(autorun(reader => {
            this._editorObs.versionId.read(reader);
            this._inAcceptFlow.set(false, undefined);
        }));
        this._register(autorun(reader => {
            const jumpToReset = this.state.map((s, reader) => !s || s.kind === 'inlineEdit' && !s.cursorAtInlineEdit.read(reader)).read(reader);
            if (jumpToReset) {
                this._jumpedToId.set(undefined, undefined);
            }
        }));
        const inlineEditSemanticId = this.inlineEditState.map(s => s?.inlineCompletion.semanticId);
        this._register(autorun(reader => {
            const id = inlineEditSemanticId.read(reader);
            if (id) {
                this._editor.pushUndoStop();
                this._lastShownInlineCompletionInfo = {
                    alternateTextModelVersionId: this.textModel.getAlternativeVersionId(),
                    inlineCompletion: this.state.get().inlineCompletion,
                };
            }
        }));
        const inlineCompletionProviders = observableFromEvent(this._languageFeaturesService.inlineCompletionsProvider.onDidChange, () => this._languageFeaturesService.inlineCompletionsProvider.all(textModel));
        this._register(autorunWithStore((reader, store) => {
            const providers = inlineCompletionProviders.read(reader);
            for (const provider of providers) {
                if (!provider.onDidChangeInlineCompletions) {
                    continue;
                }
                store.add(provider.onDidChangeInlineCompletions(() => {
                    if (!this._enabled.get()) {
                        return;
                    }
                    // If there is an active suggestion from a different provider, we ignore the update
                    const activeState = this.state.get();
                    if (activeState && (activeState.inlineCompletion || activeState.edits) && activeState.inlineCompletion?.source.provider !== provider) {
                        return;
                    }
                    transaction(tx => {
                        this._fetchSpecificProviderSignal.trigger(tx, provider);
                        this.trigger(tx);
                    });
                }));
            }
        }));
        this._didUndoInlineEdits.recomputeInitiallyAndOnChange(this._store);
    }
    debugGetSelectedSuggestItem() {
        return this._selectedSuggestItem;
    }
    getIndentationInfo(reader) {
        let startsWithIndentation = false;
        let startsWithIndentationLessThanTabSize = true;
        const ghostText = this?.primaryGhostText.read(reader);
        if (!!this?._selectedSuggestItem && ghostText && ghostText.parts.length > 0) {
            const { column, lines } = ghostText.parts[0];
            const firstLine = lines[0].line;
            const indentationEndColumn = this.textModel.getLineIndentColumn(ghostText.lineNumber);
            const inIndentation = column <= indentationEndColumn;
            if (inIndentation) {
                let firstNonWsIdx = firstNonWhitespaceIndex(firstLine);
                if (firstNonWsIdx === -1) {
                    firstNonWsIdx = firstLine.length - 1;
                }
                startsWithIndentation = firstNonWsIdx > 0;
                const tabSize = this.textModel.getOptions().tabSize;
                const visibleColumnIndentation = CursorColumns.visibleColumnFromColumn(firstLine, firstNonWsIdx + 1, tabSize);
                startsWithIndentationLessThanTabSize = visibleColumnIndentation < tabSize;
            }
        }
        return {
            startsWithIndentation,
            startsWithIndentationLessThanTabSize,
        };
    }
    _getReason(e) {
        if (e?.isUndoing) {
            return VersionIdChangeReason.Undo;
        }
        if (e?.isRedoing) {
            return VersionIdChangeReason.Redo;
        }
        if (this.isAcceptingPartially) {
            return VersionIdChangeReason.AcceptWord;
        }
        return VersionIdChangeReason.Other;
    }
    async trigger(tx, options) {
        subtransaction(tx, tx => {
            if (options?.onlyFetchInlineEdits) {
                this._onlyRequestInlineEditsSignal.trigger(tx);
            }
            if (options?.noDelay) {
                this._noDelaySignal.trigger(tx);
            }
            this._isActive.set(true, tx);
        });
        await this._fetchInlineCompletionsPromise.get();
    }
    async triggerExplicitly(tx, onlyFetchInlineEdits = false) {
        subtransaction(tx, tx => {
            if (onlyFetchInlineEdits) {
                this._onlyRequestInlineEditsSignal.trigger(tx);
            }
            this._isActive.set(true, tx);
            this._inAcceptFlow.set(true, tx);
            this._forceUpdateExplicitlySignal.trigger(tx);
        });
        await this._fetchInlineCompletionsPromise.get();
    }
    stop(stopReason = 'automatic', tx) {
        subtransaction(tx, tx => {
            if (stopReason === 'explicitCancel') {
                const inlineCompletion = this.state.get()?.inlineCompletion;
                if (inlineCompletion) {
                    inlineCompletion.reportEndOfLife({ kind: InlineCompletionEndOfLifeReasonKind.Rejected });
                }
            }
            this._isActive.set(false, tx);
            this._source.clear(tx);
        });
    }
    _computeAugmentation(suggestCompletion, reader) {
        const model = this.textModel;
        const suggestWidgetInlineCompletions = this._source.suggestWidgetInlineCompletions.read(reader);
        const candidateInlineCompletions = suggestWidgetInlineCompletions
            ? suggestWidgetInlineCompletions.inlineCompletions.filter(c => !c.isInlineEdit)
            : [this.selectedInlineCompletion.read(reader)].filter(isDefined);
        const augmentedCompletion = mapFindFirst(candidateInlineCompletions, completion => {
            let r = completion.getSingleTextEdit();
            r = singleTextRemoveCommonPrefix(r, model, Range.fromPositions(r.range.getStartPosition(), suggestCompletion.range.getEndPosition()));
            return singleTextEditAugments(r, suggestCompletion) ? { completion, edit: r } : undefined;
        });
        return augmentedCompletion;
    }
    async _deltaSelectedInlineCompletionIndex(delta) {
        await this.triggerExplicitly();
        const completions = this._filteredInlineCompletionItems.get() || [];
        if (completions.length > 0) {
            const newIdx = (this.selectedInlineCompletionIndex.get() + delta + completions.length) % completions.length;
            this._selectedInlineCompletionId.set(completions[newIdx].semanticId, undefined);
        }
        else {
            this._selectedInlineCompletionId.set(undefined, undefined);
        }
    }
    async next() { await this._deltaSelectedInlineCompletionIndex(1); }
    async previous() { await this._deltaSelectedInlineCompletionIndex(-1); }
    _getMetadata(completion, type = undefined) {
        return new TextModelEditReason({
            extensionId: completion.source.provider.groupId,
            nes: completion.isInlineEdit,
            type,
            requestUuid: completion.requestUuid,
        });
    }
    async accept(editor = this._editor) {
        if (editor.getModel() !== this.textModel) {
            throw new BugIndicatingError();
        }
        let completion;
        const state = this.state.get();
        if (state?.kind === 'ghostText') {
            if (!state || state.primaryGhostText.isEmpty() || !state.inlineCompletion) {
                return;
            }
            completion = state.inlineCompletion;
        }
        else if (state?.kind === 'inlineEdit') {
            completion = state.inlineCompletion;
        }
        else {
            return;
        }
        completion.reportEndOfLife({ kind: InlineCompletionEndOfLifeReasonKind.Accepted });
        if (completion.command) {
            // Make sure the completion list will not be disposed.
            completion.source.addRef();
        }
        editor.pushUndoStop();
        if (completion.snippetInfo) {
            TextModelEditReason.editWithReason(this._getMetadata(completion), () => {
                editor.executeEdits('inlineSuggestion.accept', [
                    EditOperation.replace(completion.editRange, ''),
                    ...completion.additionalTextEdits
                ]);
            });
            editor.setPosition(completion.snippetInfo.range.getStartPosition(), 'inlineCompletionAccept');
            SnippetController2.get(editor)?.insert(completion.snippetInfo.snippet, { undoStopBefore: false });
        }
        else {
            const edits = state.edits;
            // The cursor should move to the end of the edit, not the end of the range provided by the extension
            // Inline Edit diffs (human readable) the suggestion from the extension so it already removes common suffix/prefix
            // Inline Completions does diff the suggestion so it may contain common suffix
            let minimalEdits = edits;
            if (state.kind === 'ghostText') {
                minimalEdits = removeTextReplacementCommonSuffixPrefix(edits, this.textModel);
            }
            const selections = getEndPositionsAfterApplying(minimalEdits).map(p => Selection.fromPositions(p));
            TextModelEditReason.editWithReason(this._getMetadata(completion), () => {
                editor.executeEdits('inlineSuggestion.accept', [
                    ...edits.map(edit => EditOperation.replace(edit.range, edit.text)),
                    ...completion.additionalTextEdits
                ]);
            });
            if (completion.displayLocation === undefined) {
                // do not move the cursor when the completion is displayed in a different location
                editor.setSelections(state.kind === 'inlineEdit' ? selections.slice(-1) : selections, 'inlineCompletionAccept');
            }
            if (state.kind === 'inlineEdit' && !this._accessibilityService.isMotionReduced()) {
                // we can assume that edits is sorted!
                const editRanges = new TextEdit(edits).getNewRanges();
                const dec = this._store.add(new FadeoutDecoration(editor, editRanges, () => {
                    this._store.delete(dec);
                }));
            }
        }
        this._onDidAccept.fire();
        // Reset before invoking the command, as the command might cause a follow up trigger (which we don't want to reset).
        this.stop();
        if (completion.command) {
            await this._commandService
                .executeCommand(completion.command.id, ...(completion.command.arguments || []))
                .then(undefined, onUnexpectedExternalError);
            completion.source.removeRef();
        }
        this._inAcceptFlow.set(true, undefined);
        this._lastAcceptedInlineCompletionInfo = { textModelVersionIdAfter: this.textModel.getVersionId(), inlineCompletion: completion };
    }
    async acceptNextWord() {
        await this._acceptNext(this._editor, 'word', (pos, text) => {
            const langId = this.textModel.getLanguageIdAtPosition(pos.lineNumber, pos.column);
            const config = this._languageConfigurationService.getLanguageConfiguration(langId);
            const wordRegExp = new RegExp(config.wordDefinition.source, config.wordDefinition.flags.replace('g', ''));
            const m1 = text.match(wordRegExp);
            let acceptUntilIndexExclusive = 0;
            if (m1 && m1.index !== undefined) {
                if (m1.index === 0) {
                    acceptUntilIndexExclusive = m1[0].length;
                }
                else {
                    acceptUntilIndexExclusive = m1.index;
                }
            }
            else {
                acceptUntilIndexExclusive = text.length;
            }
            const wsRegExp = /\s+/g;
            const m2 = wsRegExp.exec(text);
            if (m2 && m2.index !== undefined) {
                if (m2.index + m2[0].length < acceptUntilIndexExclusive) {
                    acceptUntilIndexExclusive = m2.index + m2[0].length;
                }
            }
            return acceptUntilIndexExclusive;
        }, 0 /* PartialAcceptTriggerKind.Word */);
    }
    async acceptNextLine() {
        await this._acceptNext(this._editor, 'line', (pos, text) => {
            const m = text.match(/\n/);
            if (m && m.index !== undefined) {
                return m.index + 1;
            }
            return text.length;
        }, 1 /* PartialAcceptTriggerKind.Line */);
    }
    async _acceptNext(editor, type, getAcceptUntilIndex, kind) {
        if (editor.getModel() !== this.textModel) {
            throw new BugIndicatingError();
        }
        const state = this.inlineCompletionState.get();
        if (!state || state.primaryGhostText.isEmpty() || !state.inlineCompletion) {
            return;
        }
        const ghostText = state.primaryGhostText;
        const completion = state.inlineCompletion;
        if (completion.snippetInfo) {
            // not in WYSIWYG mode, partial commit might change completion, thus it is not supported
            await this.accept(editor);
            return;
        }
        const firstPart = ghostText.parts[0];
        const ghostTextPos = new Position(ghostText.lineNumber, firstPart.column);
        const ghostTextVal = firstPart.text;
        const acceptUntilIndexExclusive = getAcceptUntilIndex(ghostTextPos, ghostTextVal);
        if (acceptUntilIndexExclusive === ghostTextVal.length && ghostText.parts.length === 1) {
            this.accept(editor);
            return;
        }
        const partialGhostTextVal = ghostTextVal.substring(0, acceptUntilIndexExclusive);
        const positions = this._positions.get();
        const cursorPosition = positions[0];
        // Executing the edit might free the completion, so we have to hold a reference on it.
        completion.source.addRef();
        try {
            this._isAcceptingPartially = true;
            try {
                editor.pushUndoStop();
                const replaceRange = Range.fromPositions(cursorPosition, ghostTextPos);
                const newText = editor.getModel().getValueInRange(replaceRange) + partialGhostTextVal;
                const primaryEdit = new TextReplacement(replaceRange, newText);
                const edits = [primaryEdit, ...getSecondaryEdits(this.textModel, positions, primaryEdit)];
                const selections = getEndPositionsAfterApplying(edits).map(p => Selection.fromPositions(p));
                TextModelEditReason.editWithReason(this._getMetadata(completion, type), () => {
                    editor.executeEdits('inlineSuggestion.accept', edits.map(edit => EditOperation.replace(edit.range, edit.text)));
                });
                editor.setSelections(selections, 'inlineCompletionPartialAccept');
                editor.revealPositionInCenterIfOutsideViewport(editor.getPosition(), 1 /* ScrollType.Immediate */);
            }
            finally {
                this._isAcceptingPartially = false;
            }
            const acceptedRange = Range.fromPositions(completion.editRange.getStartPosition(), TextLength.ofText(partialGhostTextVal).addToPosition(ghostTextPos));
            // This assumes that the inline completion and the model use the same EOL style.
            const text = editor.getModel().getValueInRange(acceptedRange, 1 /* EndOfLinePreference.LF */);
            const acceptedLength = text.length;
            completion.reportPartialAccept(acceptedLength, { kind, acceptedLength: acceptedLength });
        }
        finally {
            completion.source.removeRef();
        }
    }
    handleSuggestAccepted(item) {
        const itemEdit = singleTextRemoveCommonPrefix(item.getSingleTextEdit(), this.textModel);
        const augmentedCompletion = this._computeAugmentation(itemEdit, undefined);
        if (!augmentedCompletion) {
            return;
        }
        // This assumes that the inline completion and the model use the same EOL style.
        const alreadyAcceptedLength = this.textModel.getValueInRange(augmentedCompletion.completion.editRange, 1 /* EndOfLinePreference.LF */).length;
        const acceptedLength = alreadyAcceptedLength + itemEdit.text.length;
        augmentedCompletion.completion.reportPartialAccept(itemEdit.text.length, {
            kind: 2 /* PartialAcceptTriggerKind.Suggest */,
            acceptedLength,
        });
    }
    extractReproSample() {
        const value = this.textModel.getValue();
        const item = this.state.get()?.inlineCompletion;
        return {
            documentValue: value,
            inlineCompletion: item?.getSourceCompletion(),
        };
    }
    jump() {
        const s = this.inlineEditState.get();
        if (!s) {
            return;
        }
        transaction(tx => {
            this._jumpedToId.set(s.inlineCompletion.semanticId, tx);
            this.dontRefetchSignal.trigger(tx);
            const targetRange = s.inlineCompletion.targetRange;
            const targetPosition = targetRange.getStartPosition();
            this._editor.setPosition(targetPosition, 'inlineCompletions.jump');
            // TODO: consider using view information to reveal it
            const isSingleLineChange = targetRange.isSingleLine() && (s.inlineCompletion.displayLocation || !s.inlineCompletion.insertText.includes('\n'));
            if (isSingleLineChange) {
                this._editor.revealPosition(targetPosition);
            }
            else {
                const revealRange = new Range(targetRange.startLineNumber - 1, 1, targetRange.endLineNumber + 1, 1);
                this._editor.revealRange(revealRange, 1 /* ScrollType.Immediate */);
            }
            this._editor.focus();
        });
    }
    async handleInlineSuggestionShown(inlineCompletion) {
        await inlineCompletion.reportInlineEditShown(this._commandService);
    }
};
InlineCompletionsModel = __decorate([
    __param(7, IInstantiationService),
    __param(8, ICommandService),
    __param(9, ILanguageConfigurationService),
    __param(10, IAccessibilityService),
    __param(11, ILanguageFeaturesService)
], InlineCompletionsModel);
export { InlineCompletionsModel };
export var VersionIdChangeReason;
(function (VersionIdChangeReason) {
    VersionIdChangeReason[VersionIdChangeReason["Undo"] = 0] = "Undo";
    VersionIdChangeReason[VersionIdChangeReason["Redo"] = 1] = "Redo";
    VersionIdChangeReason[VersionIdChangeReason["AcceptWord"] = 2] = "AcceptWord";
    VersionIdChangeReason[VersionIdChangeReason["Other"] = 3] = "Other";
})(VersionIdChangeReason || (VersionIdChangeReason = {}));
export function getSecondaryEdits(textModel, positions, primaryEdit) {
    if (positions.length === 1) {
        // No secondary cursor positions
        return [];
    }
    const primaryPosition = positions[0];
    const secondaryPositions = positions.slice(1);
    const primaryEditStartPosition = primaryEdit.range.getStartPosition();
    const primaryEditEndPosition = primaryEdit.range.getEndPosition();
    const replacedTextAfterPrimaryCursor = textModel.getValueInRange(Range.fromPositions(primaryPosition, primaryEditEndPosition));
    const positionWithinTextEdit = subtractPositions(primaryPosition, primaryEditStartPosition);
    if (positionWithinTextEdit.lineNumber < 1) {
        onUnexpectedError(new BugIndicatingError(`positionWithinTextEdit line number should be bigger than 0.
			Invalid subtraction between ${primaryPosition.toString()} and ${primaryEditStartPosition.toString()}`));
        return [];
    }
    const secondaryEditText = substringPos(primaryEdit.text, positionWithinTextEdit);
    return secondaryPositions.map(pos => {
        const posEnd = addPositions(subtractPositions(pos, primaryEditStartPosition), primaryEditEndPosition);
        const textAfterSecondaryCursor = textModel.getValueInRange(Range.fromPositions(pos, posEnd));
        const l = commonPrefixLength(replacedTextAfterPrimaryCursor, textAfterSecondaryCursor);
        const range = Range.fromPositions(pos, pos.delta(0, l));
        return new TextReplacement(range, secondaryEditText);
    });
}
class FadeoutDecoration extends Disposable {
    constructor(editor, ranges, onDispose) {
        super();
        if (onDispose) {
            this._register({ dispose: () => onDispose() });
        }
        this._register(observableCodeEditor(editor).setDecorations(constObservable(ranges.map(range => ({
            range: range,
            options: {
                description: 'animation',
                className: 'edits-fadeout-decoration',
                zIndex: 1,
            }
        })))));
        const animation = new AnimatedValue(1, 0, 1000, easeOutCubic);
        const val = new ObservableAnimatedValue(animation);
        this._register(autorun(reader => {
            const opacity = val.getValue(reader);
            editor.getContainerDomNode().style.setProperty('--animation-opacity', opacity.toString());
            if (animation.isFinished()) {
                this.dispose();
            }
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnNNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9tb2RlbC9pbmxpbmVDb21wbGV0aW9uc01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGlCQUFpQixFQUFFLHlCQUF5QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEgsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQTZELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsNkJBQTZCLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pVLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFFdEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1B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