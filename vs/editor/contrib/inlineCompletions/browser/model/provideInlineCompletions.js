/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertNever } from '../../../../../base/common/assert.js';
import { AsyncIterableObject, DeferredPromise } from '../../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { onUnexpectedExternalError } from '../../../../../base/common/errors.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { SetMap } from '../../../../../base/common/map.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { StringReplacement } from '../../../../common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { TextReplacement } from '../../../../common/core/edits/textEdit.js';
import { InlineCompletionEndOfLifeReasonKind, InlineCompletionTriggerKind } from '../../../../common/languages.js';
import { fixBracketsInLine } from '../../../../common/model/bracketPairsTextModelPart/fixBrackets.js';
import { TextModelText } from '../../../../common/model/textModelText.js';
import { SnippetParser, Text } from '../../../snippet/browser/snippetParser.js';
import { getReadonlyEmptyArray } from '../utils.js';
export async function provideInlineCompletions(providers, positionOrRange, model, context, baseToken = CancellationToken.None, languageConfigurationService) {
    const requestUuid = generateUuid();
    const tokenSource = new CancellationTokenSource(baseToken);
    const token = tokenSource.token;
    const contextWithUuid = { ...context, requestUuid: requestUuid };
    const defaultReplaceRange = positionOrRange instanceof Position ? getDefaultRange(positionOrRange, model) : positionOrRange;
    const multiMap = new SetMap();
    for (const provider of providers) {
        if (provider.groupId) {
            multiMap.add(provider.groupId, provider);
        }
    }
    function getPreferredProviders(provider) {
        if (!provider.yieldsToGroupIds) {
            return [];
        }
        const result = [];
        for (const groupId of provider.yieldsToGroupIds || []) {
            const providers = multiMap.get(groupId);
            for (const p of providers) {
                result.push(p);
            }
        }
        return result;
    }
    function findPreferredProviderCircle(provider, stack, seen) {
        stack = [...stack, provider];
        if (seen.has(provider)) {
            return stack;
        }
        seen.add(provider);
        try {
            const preferred = getPreferredProviders(provider);
            for (const p of preferred) {
                const c = findPreferredProviderCircle(p, stack, seen);
                if (c) {
                    return c;
                }
            }
        }
        finally {
            seen.delete(provider);
        }
        return undefined;
    }
    function queryProviderOrPreferredProvider(provider, states) {
        const state = states.get(provider);
        if (state) {
            return state;
        }
        const circle = findPreferredProviderCircle(provider, [], new Set());
        if (circle) {
            onUnexpectedExternalError(new Error(`Inline completions: cyclic yield-to dependency detected.`
                + ` Path: ${circle.map(s => s.toString ? s.toString() : ('' + s)).join(' -> ')}`));
        }
        const deferredPromise = new DeferredPromise();
        states.set(provider, deferredPromise.p);
        (async () => {
            if (!circle) {
                const preferred = getPreferredProviders(provider);
                for (const p of preferred) {
                    const result = await queryProviderOrPreferredProvider(p, states);
                    if (result && result.inlineSuggestions.items.length > 0) {
                        // Skip provider
                        return undefined;
                    }
                }
            }
            return query(provider);
        })().then(c => deferredPromise.complete(c), e => deferredPromise.error(e));
        return deferredPromise.p;
    }
    async function query(provider) {
        let result;
        try {
            if (positionOrRange instanceof Position) {
                result = await provider.provideInlineCompletions(model, positionOrRange, contextWithUuid, token);
            }
            else {
                result = await provider.provideInlineEditsForRange?.(model, positionOrRange, contextWithUuid, token);
            }
        }
        catch (e) {
            onUnexpectedExternalError(e);
            return undefined;
        }
        if (!result) {
            return undefined;
        }
        const data = [];
        const list = new InlineSuggestionList(result, data, provider);
        for (const item of result.items) {
            data.push(createInlineCompletionItem(item, list, defaultReplaceRange, model, languageConfigurationService, contextWithUuid));
        }
        runWhenCancelled(token, () => list.removeRef());
        return list;
    }
    const states = new Map();
    const inlineCompletionLists = AsyncIterableObject.fromPromisesResolveOrder(providers.map(p => queryProviderOrPreferredProvider(p, states)));
    if (token.isCancellationRequested) {
        tokenSource.dispose(true);
        // result has been disposed before we could call addRef! So we have to discard everything.
        return new InlineCompletionProviderResult([], new Set(), []);
    }
    const result = await addRefAndCreateResult(contextWithUuid, inlineCompletionLists, model);
    tokenSource.dispose(true); // This disposes results that are not referenced by now.
    return result;
}
/** If the token does not leak, this will not leak either. */
function runWhenCancelled(token, callback) {
    if (token.isCancellationRequested) {
        callback();
        return Disposable.None;
    }
    else {
        const listener = token.onCancellationRequested(() => {
            listener.dispose();
            callback();
        });
        return { dispose: () => listener.dispose() };
    }
}
async function addRefAndCreateResult(context, inlineCompletionLists, model) {
    // for deduplication
    const itemsByHash = new Map();
    let shouldStop = false;
    const lists = [];
    for await (const completions of inlineCompletionLists) {
        if (!completions) {
            continue;
        }
        completions.addRef();
        lists.push(completions);
        for (const item of completions.inlineSuggestionsData) {
            if (!context.includeInlineEdits && (item.isInlineEdit || item.showInlineEditMenu)) {
                continue;
            }
            if (!context.includeInlineCompletions && !(item.isInlineEdit || item.showInlineEditMenu)) {
                continue;
            }
            itemsByHash.set(createHashFromSingleTextEdit(item.getSingleTextEdit()), item);
            // Stop after first visible inline completion
            if (!(item.isInlineEdit || item.showInlineEditMenu) && context.triggerKind === InlineCompletionTriggerKind.Automatic) {
                const minifiedEdit = item.getSingleTextEdit().removeCommonPrefix(new TextModelText(model));
                if (!minifiedEdit.isEmpty) {
                    shouldStop = true;
                }
            }
        }
        if (shouldStop) {
            break;
        }
    }
    return new InlineCompletionProviderResult(Array.from(itemsByHash.values()), new Set(itemsByHash.keys()), lists);
}
export class InlineCompletionProviderResult {
    constructor(
    /**
     * Free of duplicates.
     */
    completions, hashs, providerResults) {
        this.completions = completions;
        this.hashs = hashs;
        this.providerResults = providerResults;
    }
    has(edit) {
        return this.hashs.has(createHashFromSingleTextEdit(edit));
    }
    // TODO: This is not complete as it does not take the textmodel into account
    isEmpty() {
        return this.completions.length === 0
            || this.completions.every(c => c.range.isEmpty() && c.insertText.length === 0);
    }
    dispose() {
        for (const result of this.providerResults) {
            result.removeRef();
        }
    }
}
function createHashFromSingleTextEdit(edit) {
    return JSON.stringify([edit.text, edit.range.getStartPosition().toString()]);
}
function createInlineCompletionItem(inlineCompletion, source, defaultReplaceRange, textModel, languageConfigurationService, context) {
    let insertText;
    let snippetInfo;
    let range = inlineCompletion.range ? Range.lift(inlineCompletion.range) : defaultReplaceRange;
    if (typeof inlineCompletion.insertText === 'string') {
        insertText = inlineCompletion.insertText;
        if (languageConfigurationService && inlineCompletion.completeBracketPairs) {
            insertText = closeBrackets(insertText, range.getStartPosition(), textModel, languageConfigurationService);
            // Modify range depending on if brackets are added or removed
            const diff = insertText.length - inlineCompletion.insertText.length;
            if (diff !== 0) {
                range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + diff);
            }
        }
        snippetInfo = undefined;
    }
    else if ('snippet' in inlineCompletion.insertText) {
        const preBracketCompletionLength = inlineCompletion.insertText.snippet.length;
        if (languageConfigurationService && inlineCompletion.completeBracketPairs) {
            inlineCompletion.insertText.snippet = closeBrackets(inlineCompletion.insertText.snippet, range.getStartPosition(), textModel, languageConfigurationService);
            // Modify range depending on if brackets are added or removed
            const diff = inlineCompletion.insertText.snippet.length - preBracketCompletionLength;
            if (diff !== 0) {
                range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + diff);
            }
        }
        const snippet = new SnippetParser().parse(inlineCompletion.insertText.snippet);
        if (snippet.children.length === 1 && snippet.children[0] instanceof Text) {
            insertText = snippet.children[0].value;
            snippetInfo = undefined;
        }
        else {
            insertText = snippet.toString();
            snippetInfo = {
                snippet: inlineCompletion.insertText.snippet,
                range: range
            };
        }
    }
    else {
        assertNever(inlineCompletion.insertText);
    }
    const displayLocation = inlineCompletion.displayLocation ? {
        range: Range.lift(inlineCompletion.displayLocation.range),
        label: inlineCompletion.displayLocation.label
    } : undefined;
    return new InlineSuggestData(range, insertText, snippetInfo, displayLocation, inlineCompletion.additionalTextEdits || getReadonlyEmptyArray(), inlineCompletion, source, context, inlineCompletion.isInlineEdit ?? false);
}
export class InlineSuggestData {
    constructor(range, insertText, snippetInfo, displayLocation, additionalTextEdits, sourceInlineCompletion, source, context, isInlineEdit) {
        this.range = range;
        this.insertText = insertText;
        this.snippetInfo = snippetInfo;
        this.displayLocation = displayLocation;
        this.additionalTextEdits = additionalTextEdits;
        this.sourceInlineCompletion = sourceInlineCompletion;
        this.source = source;
        this.context = context;
        this.isInlineEdit = isInlineEdit;
        this._didShow = false;
        this._didReportEndOfLife = false;
        this._lastSetEndOfLifeReason = undefined;
    }
    get showInlineEditMenu() { return this.sourceInlineCompletion.showInlineEditMenu ?? false; }
    getSingleTextEdit() {
        return new TextReplacement(this.range, this.insertText);
    }
    async reportInlineEditShown(commandService, updatedInsertText) {
        if (this._didShow) {
            return;
        }
        this._didShow = true;
        this.source.provider.handleItemDidShow?.(this.source.inlineSuggestions, this.sourceInlineCompletion, updatedInsertText);
        if (this.sourceInlineCompletion.shownCommand) {
            await commandService.executeCommand(this.sourceInlineCompletion.shownCommand.id, ...(this.sourceInlineCompletion.shownCommand.arguments || []));
        }
    }
    reportPartialAccept(acceptedCharacters, info) {
        this.source.provider.handlePartialAccept?.(this.source.inlineSuggestions, this.sourceInlineCompletion, acceptedCharacters, info);
    }
    /**
     * Sends the end of life event to the provider.
     * If no reason is provided, the last set reason is used.
     * If no reason was set, the default reason is used.
    */
    reportEndOfLife(reason) {
        if (this._didReportEndOfLife) {
            return;
        }
        this._didReportEndOfLife = true;
        if (!reason) {
            reason = this._lastSetEndOfLifeReason ?? { kind: InlineCompletionEndOfLifeReasonKind.Ignored, userTypingDisagreed: false, supersededBy: undefined };
        }
        if (reason.kind === InlineCompletionEndOfLifeReasonKind.Rejected && this.source.provider.handleRejection) {
            this.source.provider.handleRejection(this.source.inlineSuggestions, this.sourceInlineCompletion);
        }
        if (this.source.provider.handleEndOfLifetime) {
            this.source.provider.handleEndOfLifetime(this.source.inlineSuggestions, this.sourceInlineCompletion, reason);
        }
    }
    /**
     * Sets the end of life reason, but does not send the event to the provider yet.
    */
    setEndOfLifeReason(reason) {
        this._lastSetEndOfLifeReason = reason;
    }
}
/**
 * A ref counted pointer to the computed `InlineCompletions` and the `InlineCompletionsProvider` that
 * computed them.
 */
export class InlineSuggestionList {
    constructor(inlineSuggestions, inlineSuggestionsData, provider) {
        this.inlineSuggestions = inlineSuggestions;
        this.inlineSuggestionsData = inlineSuggestionsData;
        this.provider = provider;
        this.refCount = 1;
    }
    addRef() {
        this.refCount++;
    }
    removeRef() {
        this.refCount--;
        if (this.refCount === 0) {
            for (const item of this.inlineSuggestionsData) {
                // Fallback if it has not been called before
                item.reportEndOfLife();
            }
            this.provider.freeInlineCompletions(this.inlineSuggestions);
        }
    }
}
function getDefaultRange(position, model) {
    const word = model.getWordAtPosition(position);
    const maxColumn = model.getLineMaxColumn(position.lineNumber);
    // By default, always replace up until the end of the current line.
    // This default might be subject to change!
    return word
        ? new Range(position.lineNumber, word.startColumn, position.lineNumber, maxColumn)
        : Range.fromPositions(position, position.with(undefined, maxColumn));
}
function closeBrackets(text, position, model, languageConfigurationService) {
    const currentLine = model.getLineContent(position.lineNumber);
    const edit = StringReplacement.replace(new OffsetRange(position.column - 1, currentLine.length), text);
    const proposedLineTokens = model.tokenization.tokenizeLinesAt(position.lineNumber, [edit.replace(currentLine)]);
    const textTokens = proposedLineTokens?.[0].sliceZeroCopy(edit.getRangeAfterReplace());
    if (!textTokens) {
        return text;
    }
    const fixedText = fixBracketsInLine(textTokens, languageConfigurationService);
    return fixedText;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZUlubGluZUNvbXBsZXRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL3Byb3ZpZGVJbmxpbmVDb21wbGV0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0QsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBR2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1RSxPQUFPLEVBQW1DLG1DQUFtQyxFQUE0SCwyQkFBMkIsRUFBcUIsTUFBTSxpQ0FBaUMsQ0FBQztBQUdqUyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsYUFBYSxF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