/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { asArray, coalesce, isFalsyOrEmpty, isNonEmptyArray } from '../../../base/common/arrays.js';
import { raceCancellationError } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { NotImplementedError, isCancellationError } from '../../../base/common/errors.js';
import { IdGenerator } from '../../../base/common/idGenerator.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { equals, mixin } from '../../../base/common/objects.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { regExpLeadsToEndlessLoop } from '../../../base/common/strings.js';
import { assertType, isObject } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { Range as EditorRange } from '../../../editor/common/core/range.js';
import { Selection } from '../../../editor/common/core/selection.js';
import * as languages from '../../../editor/common/languages.js';
import { encodeSemanticTokensDto } from '../../../editor/common/services/semanticTokensDto.js';
import { localize } from '../../../nls.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { Cache } from './cache.js';
import * as extHostProtocol from './extHost.protocol.js';
import * as typeConvert from './extHostTypeConverters.js';
import { CodeAction, CodeActionKind, CompletionList, DataTransfer, Disposable, DocumentDropOrPasteEditKind, DocumentSymbol, InlineCompletionTriggerKind, InlineEditTriggerKind, InternalDataTransferItem, Location, NewSymbolNameTriggerKind, Range, SemanticTokens, SemanticTokensEdit, SemanticTokensEdits, SnippetString, SyntaxTokenType } from './extHostTypes.js';
// --- adapter
class DocumentSymbolAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDocumentSymbols(resource, token) {
        const doc = this._documents.getDocument(resource);
        const value = await this._provider.provideDocumentSymbols(doc, token);
        if (isFalsyOrEmpty(value)) {
            return undefined;
        }
        else if (value[0] instanceof DocumentSymbol) {
            return value.map(typeConvert.DocumentSymbol.from);
        }
        else {
            return DocumentSymbolAdapter._asDocumentSymbolTree(value);
        }
    }
    static _asDocumentSymbolTree(infos) {
        // first sort by start (and end) and then loop over all elements
        // and build a tree based on containment.
        infos = infos.slice(0).sort((a, b) => {
            let res = a.location.range.start.compareTo(b.location.range.start);
            if (res === 0) {
                res = b.location.range.end.compareTo(a.location.range.end);
            }
            return res;
        });
        const res = [];
        const parentStack = [];
        for (const info of infos) {
            const element = {
                name: info.name || '!!MISSING: name!!',
                kind: typeConvert.SymbolKind.from(info.kind),
                tags: info.tags?.map(typeConvert.SymbolTag.from) || [],
                detail: '',
                containerName: info.containerName,
                range: typeConvert.Range.from(info.location.range),
                selectionRange: typeConvert.Range.from(info.location.range),
                children: []
            };
            while (true) {
                if (parentStack.length === 0) {
                    parentStack.push(element);
                    res.push(element);
                    break;
                }
                const parent = parentStack[parentStack.length - 1];
                if (EditorRange.containsRange(parent.range, element.range) && !EditorRange.equalsRange(parent.range, element.range)) {
                    parent.children?.push(element);
                    parentStack.push(element);
                    break;
                }
                parentStack.pop();
            }
        }
        return res;
    }
}
class CodeLensAdapter {
    constructor(_documents, _commands, _provider, _extension, _extTelemetry, _logService) {
        this._documents = _documents;
        this._commands = _commands;
        this._provider = _provider;
        this._extension = _extension;
        this._extTelemetry = _extTelemetry;
        this._logService = _logService;
        this._cache = new Cache('CodeLens');
        this._disposables = new Map();
    }
    async provideCodeLenses(resource, token) {
        const doc = this._documents.getDocument(resource);
        const lenses = await this._provider.provideCodeLenses(doc, token);
        if (!lenses || token.isCancellationRequested) {
            return undefined;
        }
        const cacheId = this._cache.add(lenses);
        const disposables = new DisposableStore();
        this._disposables.set(cacheId, disposables);
        const result = {
            cacheId,
            lenses: [],
        };
        for (let i = 0; i < lenses.length; i++) {
            if (!Range.isRange(lenses[i].range)) {
                console.warn('INVALID code lens, range is not defined', this._extension.identifier.value);
                continue;
            }
            result.lenses.push({
                cacheId: [cacheId, i],
                range: typeConvert.Range.from(lenses[i].range),
                command: this._commands.toInternal(lenses[i].command, disposables)
            });
        }
        return result;
    }
    async resolveCodeLens(symbol, token) {
        const lens = symbol.cacheId && this._cache.get(...symbol.cacheId);
        if (!lens) {
            return undefined;
        }
        let resolvedLens;
        if (typeof this._provider.resolveCodeLens !== 'function' || lens.isResolved) {
            resolvedLens = lens;
        }
        else {
            resolvedLens = await this._provider.resolveCodeLens(lens, token);
        }
        if (!resolvedLens) {
            resolvedLens = lens;
        }
        if (token.isCancellationRequested) {
            return undefined;
        }
        const disposables = symbol.cacheId && this._disposables.get(symbol.cacheId[0]);
        if (!disposables) {
            // disposed in the meantime
            return undefined;
        }
        if (!resolvedLens.command) {
            const error = new Error('INVALID code lens resolved, lacks command: ' + this._extension.identifier.value);
            this._extTelemetry.onExtensionError(this._extension.identifier, error);
            this._logService.error(error);
            return undefined;
        }
        symbol.command = this._commands.toInternal(resolvedLens.command, disposables);
        return symbol;
    }
    releaseCodeLenses(cachedId) {
        this._disposables.get(cachedId)?.dispose();
        this._disposables.delete(cachedId);
        this._cache.delete(cachedId);
    }
}
function convertToLocationLinks(value) {
    if (Array.isArray(value)) {
        return value.map(typeConvert.DefinitionLink.from);
    }
    else if (value) {
        return [typeConvert.DefinitionLink.from(value)];
    }
    return [];
}
class DefinitionAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDefinition(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideDefinition(doc, pos, token);
        return convertToLocationLinks(value);
    }
}
class DeclarationAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDeclaration(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideDeclaration(doc, pos, token);
        return convertToLocationLinks(value);
    }
}
class ImplementationAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideImplementation(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideImplementation(doc, pos, token);
        return convertToLocationLinks(value);
    }
}
class TypeDefinitionAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideTypeDefinition(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideTypeDefinition(doc, pos, token);
        return convertToLocationLinks(value);
    }
}
class HoverAdapter {
    static { this.HOVER_MAP_MAX_SIZE = 10; }
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this._hoverCounter = 0;
        this._hoverMap = new Map();
    }
    async provideHover(resource, position, context, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        let value;
        if (context && context.verbosityRequest) {
            const previousHoverId = context.verbosityRequest.previousHover.id;
            const previousHover = this._hoverMap.get(previousHoverId);
            if (!previousHover) {
                throw new Error(`Hover with id ${previousHoverId} not found`);
            }
            const hoverContext = { verbosityDelta: context.verbosityRequest.verbosityDelta, previousHover };
            value = await this._provider.provideHover(doc, pos, token, hoverContext);
        }
        else {
            value = await this._provider.provideHover(doc, pos, token);
        }
        if (!value || isFalsyOrEmpty(value.contents)) {
            return undefined;
        }
        if (!value.range) {
            value.range = doc.getWordRangeAtPosition(pos);
        }
        if (!value.range) {
            value.range = new Range(pos, pos);
        }
        const convertedHover = typeConvert.Hover.from(value);
        const id = this._hoverCounter;
        // Check if hover map has more than 10 elements and if yes, remove oldest from the map
        if (this._hoverMap.size === HoverAdapter.HOVER_MAP_MAX_SIZE) {
            const minimumId = Math.min(...this._hoverMap.keys());
            this._hoverMap.delete(minimumId);
        }
        this._hoverMap.set(id, value);
        this._hoverCounter += 1;
        const hover = {
            ...convertedHover,
            id
        };
        return hover;
    }
    releaseHover(id) {
        this._hoverMap.delete(id);
    }
}
class EvaluatableExpressionAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideEvaluatableExpression(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideEvaluatableExpression(doc, pos, token);
        if (value) {
            return typeConvert.EvaluatableExpression.from(value);
        }
        return undefined;
    }
}
class InlineValuesAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideInlineValues(resource, viewPort, context, token) {
        const doc = this._documents.getDocument(resource);
        const value = await this._provider.provideInlineValues(doc, typeConvert.Range.to(viewPort), typeConvert.InlineValueContext.to(context), token);
        if (Array.isArray(value)) {
            return value.map(iv => typeConvert.InlineValue.from(iv));
        }
        return undefined;
    }
}
class DocumentHighlightAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDocumentHighlights(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideDocumentHighlights(doc, pos, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.DocumentHighlight.from);
        }
        return undefined;
    }
}
class MultiDocumentHighlightAdapter {
    constructor(_documents, _provider, _logService) {
        this._documents = _documents;
        this._provider = _provider;
        this._logService = _logService;
    }
    async provideMultiDocumentHighlights(resource, position, otherResources, token) {
        const doc = this._documents.getDocument(resource);
        const otherDocuments = otherResources.map(r => {
            try {
                return this._documents.getDocument(r);
            }
            catch (err) {
                this._logService.error('Error: Unable to retrieve document from URI: ' + r + '. Error message: ' + err);
                return undefined;
            }
        }).filter(doc => doc !== undefined);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideMultiDocumentHighlights(doc, pos, otherDocuments, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.MultiDocumentHighlight.from);
        }
        return undefined;
    }
}
class LinkedEditingRangeAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideLinkedEditingRanges(resource, position, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideLinkedEditingRanges(doc, pos, token);
        if (value && Array.isArray(value.ranges)) {
            return {
                ranges: coalesce(value.ranges.map(typeConvert.Range.from)),
                wordPattern: value.wordPattern
            };
        }
        return undefined;
    }
}
class ReferenceAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideReferences(resource, position, context, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideReferences(doc, pos, context, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.location.from);
        }
        return undefined;
    }
}
class CodeActionAdapter {
    static { this._maxCodeActionsPerFile = 1000; }
    constructor(_documents, _commands, _diagnostics, _provider, _logService, _extension, _apiDeprecation) {
        this._documents = _documents;
        this._commands = _commands;
        this._diagnostics = _diagnostics;
        this._provider = _provider;
        this._logService = _logService;
        this._extension = _extension;
        this._apiDeprecation = _apiDeprecation;
        this._cache = new Cache('CodeAction');
        this._disposables = new Map();
    }
    async provideCodeActions(resource, rangeOrSelection, context, token) {
        const doc = this._documents.getDocument(resource);
        const ran = Selection.isISelection(rangeOrSelection)
            ? typeConvert.Selection.to(rangeOrSelection)
            : typeConvert.Range.to(rangeOrSelection);
        const allDiagnostics = [];
        for (const diagnostic of this._diagnostics.getDiagnostics(resource)) {
            if (ran.intersection(diagnostic.range)) {
                const newLen = allDiagnostics.push(diagnostic);
                if (newLen > CodeActionAdapter._maxCodeActionsPerFile) {
                    break;
                }
            }
        }
        const codeActionContext = {
            diagnostics: allDiagnostics,
            only: context.only ? new CodeActionKind(context.only) : undefined,
            triggerKind: typeConvert.CodeActionTriggerKind.to(context.trigger),
        };
        const commandsOrActions = await this._provider.provideCodeActions(doc, ran, codeActionContext, token);
        if (!isNonEmptyArray(commandsOrActions) || token.isCancellationRequested) {
            return undefined;
        }
        const cacheId = this._cache.add(commandsOrActions);
        const disposables = new DisposableStore();
        this._disposables.set(cacheId, disposables);
        const actions = [];
        for (let i = 0; i < commandsOrActions.length; i++) {
            const candidate = commandsOrActions[i];
            if (!candidate) {
                continue;
            }
            if (CodeActionAdapter._isCommand(candidate) && !(candidate instanceof CodeAction)) {
                // old school: synthetic code action
                this._apiDeprecation.report('CodeActionProvider.provideCodeActions - return commands', this._extension, `Return 'CodeAction' instances instead.`);
                actions.push({
                    _isSynthetic: true,
                    title: candidate.title,
                    command: this._commands.toInternal(candidate, disposables),
                });
            }
            else {
                const toConvert = candidate;
                // new school: convert code action
                if (codeActionContext.only) {
                    if (!toConvert.kind) {
                        this._logService.warn(`${this._extension.identifier.value} - Code actions of kind '${codeActionContext.only.value}' requested but returned code action does not have a 'kind'. Code action will be dropped. Please set 'CodeAction.kind'.`);
                    }
                    else if (!codeActionContext.only.contains(toConvert.kind)) {
                        this._logService.warn(`${this._extension.identifier.value} - Code actions of kind '${codeActionContext.only.value}' requested but returned code action is of kind '${toConvert.kind.value}'. Code action will be dropped. Please check 'CodeActionContext.only' to only return requested code actions.`);
                    }
                }
                // Ensures that this is either a Range[] or an empty array so we don't get Array<Range | undefined>
                const range = toConvert.ranges ?? [];
                actions.push({
                    cacheId: [cacheId, i],
                    title: toConvert.title,
                    command: toConvert.command && this._commands.toInternal(toConvert.command, disposables),
                    diagnostics: toConvert.diagnostics && toConvert.diagnostics.map(typeConvert.Diagnostic.from),
                    edit: toConvert.edit && typeConvert.WorkspaceEdit.from(toConvert.edit, undefined),
                    kind: toConvert.kind && toConvert.kind.value,
                    isPreferred: toConvert.isPreferred,
                    isAI: isProposedApiEnabled(this._extension, 'codeActionAI') ? toConvert.isAI : false,
                    ranges: isProposedApiEnabled(this._extension, 'codeActionRanges') ? coalesce(range.map(typeConvert.Range.from)) : undefined,
                    disabled: toConvert.disabled?.reason
                });
            }
        }
        return { cacheId, actions };
    }
    async resolveCodeAction(id, token) {
        const [sessionId, itemId] = id;
        const item = this._cache.get(sessionId, itemId);
        if (!item || CodeActionAdapter._isCommand(item)) {
            return {}; // code actions only!
        }
        if (!this._provider.resolveCodeAction) {
            return {}; // this should not happen...
        }
        const resolvedItem = (await this._provider.resolveCodeAction(item, token)) ?? item;
        let resolvedEdit;
        if (resolvedItem.edit) {
            resolvedEdit = typeConvert.WorkspaceEdit.from(resolvedItem.edit, undefined);
        }
        let resolvedCommand;
        if (resolvedItem.command) {
            const disposables = this._disposables.get(sessionId);
            if (disposables) {
                resolvedCommand = this._commands.toInternal(resolvedItem.command, disposables);
            }
        }
        return { edit: resolvedEdit, command: resolvedCommand };
    }
    releaseCodeActions(cachedId) {
        this._disposables.get(cachedId)?.dispose();
        this._disposables.delete(cachedId);
        this._cache.delete(cachedId);
    }
    static _isCommand(thing) {
        return typeof thing.command === 'string' && typeof thing.title === 'string';
    }
}
class DocumentPasteEditProvider {
    constructor(_proxy, _documents, _provider, _handle, _extension) {
        this._proxy = _proxy;
        this._documents = _documents;
        this._provider = _provider;
        this._handle = _handle;
        this._extension = _extension;
        this._editsCache = new Cache('DocumentPasteEdit.edits');
    }
    async prepareDocumentPaste(resource, ranges, dataTransferDto, token) {
        if (!this._provider.prepareDocumentPaste) {
            return;
        }
        this._cachedPrepare = undefined;
        const doc = this._documents.getDocument(resource);
        const vscodeRanges = ranges.map(range => typeConvert.Range.to(range));
        const dataTransfer = typeConvert.DataTransfer.toDataTransfer(dataTransferDto, () => {
            throw new NotImplementedError();
        });
        await this._provider.prepareDocumentPaste(doc, vscodeRanges, dataTransfer, token);
        if (token.isCancellationRequested) {
            return;
        }
        // Only send back values that have been added to the data transfer
        const newEntries = Array.from(dataTransfer).filter(([, value]) => !(value instanceof InternalDataTransferItem));
        // Store off original data transfer items so we can retrieve them on paste
        const newCache = new Map();
        const items = await Promise.all(Array.from(newEntries, async ([mime, value]) => {
            const id = generateUuid();
            newCache.set(id, value);
            return [mime, await typeConvert.DataTransferItem.from(mime, value, id)];
        }));
        this._cachedPrepare = newCache;
        return { items };
    }
    async providePasteEdits(requestId, resource, ranges, dataTransferDto, context, token) {
        if (!this._provider.provideDocumentPasteEdits) {
            return [];
        }
        const doc = this._documents.getDocument(resource);
        const vscodeRanges = ranges.map(range => typeConvert.Range.to(range));
        const items = dataTransferDto.items.map(([mime, value]) => {
            const cached = this._cachedPrepare?.get(value.id);
            if (cached) {
                return [mime, cached];
            }
            return [
                mime,
                typeConvert.DataTransferItem.to(mime, value, async (id) => {
                    return (await this._proxy.$resolvePasteFileData(this._handle, requestId, id)).buffer;
                })
            ];
        });
        const dataTransfer = new DataTransfer(items);
        const edits = await this._provider.provideDocumentPasteEdits(doc, vscodeRanges, dataTransfer, {
            only: context.only ? new DocumentDropOrPasteEditKind(context.only) : undefined,
            triggerKind: context.triggerKind,
        }, token);
        if (!edits || token.isCancellationRequested) {
            return [];
        }
        const cacheId = this._editsCache.add(edits);
        return edits.map((edit, i) => ({
            _cacheId: [cacheId, i],
            title: edit.title ?? localize('defaultPasteLabel', "Paste using '{0}' extension", this._extension.displayName || this._extension.name),
            kind: edit.kind,
            yieldTo: edit.yieldTo?.map(x => x.value),
            insertText: typeof edit.insertText === 'string' ? edit.insertText : { snippet: edit.insertText.value },
            additionalEdit: edit.additionalEdit ? typeConvert.WorkspaceEdit.from(edit.additionalEdit, undefined) : undefined,
        }));
    }
    async resolvePasteEdit(id, token) {
        const [sessionId, itemId] = id;
        const item = this._editsCache.get(sessionId, itemId);
        if (!item || !this._provider.resolveDocumentPasteEdit) {
            return {}; // this should not happen...
        }
        const resolvedItem = (await this._provider.resolveDocumentPasteEdit(item, token)) ?? item;
        return {
            insertText: resolvedItem.insertText,
            additionalEdit: resolvedItem.additionalEdit ? typeConvert.WorkspaceEdit.from(resolvedItem.additionalEdit, undefined) : undefined
        };
    }
    releasePasteEdits(id) {
        this._editsCache.delete(id);
    }
}
class DocumentFormattingAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDocumentFormattingEdits(resource, options, token) {
        const document = this._documents.getDocument(resource);
        const value = await this._provider.provideDocumentFormattingEdits(document, options, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.TextEdit.from);
        }
        return undefined;
    }
}
class RangeFormattingAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDocumentRangeFormattingEdits(resource, range, options, token) {
        const document = this._documents.getDocument(resource);
        const ran = typeConvert.Range.to(range);
        const value = await this._provider.provideDocumentRangeFormattingEdits(document, ran, options, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.TextEdit.from);
        }
        return undefined;
    }
    async provideDocumentRangesFormattingEdits(resource, ranges, options, token) {
        assertType(typeof this._provider.provideDocumentRangesFormattingEdits === 'function', 'INVALID invocation of `provideDocumentRangesFormattingEdits`');
        const document = this._documents.getDocument(resource);
        const _ranges = ranges.map(typeConvert.Range.to);
        const value = await this._provider.provideDocumentRangesFormattingEdits(document, _ranges, options, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.TextEdit.from);
        }
        return undefined;
    }
}
class OnTypeFormattingAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this.autoFormatTriggerCharacters = []; // not here
    }
    async provideOnTypeFormattingEdits(resource, position, ch, options, token) {
        const document = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const value = await this._provider.provideOnTypeFormattingEdits(document, pos, ch, options, token);
        if (Array.isArray(value)) {
            return value.map(typeConvert.TextEdit.from);
        }
        return undefined;
    }
}
class NavigateTypeAdapter {
    constructor(_provider, _logService) {
        this._provider = _provider;
        this._logService = _logService;
        this._cache = new Cache('WorkspaceSymbols');
    }
    async provideWorkspaceSymbols(search, token) {
        const value = await this._provider.provideWorkspaceSymbols(search, token);
        if (!isNonEmptyArray(value)) {
            return { symbols: [] };
        }
        const sid = this._cache.add(value);
        const result = {
            cacheId: sid,
            symbols: []
        };
        for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (!item || !item.name) {
                this._logService.warn('INVALID SymbolInformation', item);
                continue;
            }
            result.symbols.push({
                ...typeConvert.WorkspaceSymbol.from(item),
                cacheId: [sid, i]
            });
        }
        return result;
    }
    async resolveWorkspaceSymbol(symbol, token) {
        if (typeof this._provider.resolveWorkspaceSymbol !== 'function') {
            return symbol;
        }
        if (!symbol.cacheId) {
            return symbol;
        }
        const item = this._cache.get(...symbol.cacheId);
        if (item) {
            const value = await this._provider.resolveWorkspaceSymbol(item, token);
            return value && mixin(symbol, typeConvert.WorkspaceSymbol.from(value), true);
        }
        return undefined;
    }
    releaseWorkspaceSymbols(id) {
        this._cache.delete(id);
    }
}
class RenameAdapter {
    static supportsResolving(provider) {
        return typeof provider.prepareRename === 'function';
    }
    constructor(_documents, _provider, _logService) {
        this._documents = _documents;
        this._provider = _provider;
        this._logService = _logService;
    }
    async provideRenameEdits(resource, position, newName, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        try {
            const value = await this._provider.provideRenameEdits(doc, pos, newName, token);
            if (!value) {
                return undefined;
            }
            return typeConvert.WorkspaceEdit.from(value);
        }
        catch (err) {
            const rejectReason = RenameAdapter._asMessage(err);
            if (rejectReason) {
                return { rejectReason, edits: undefined };
            }
            else {
                // generic error
                return Promise.reject(err);
            }
        }
    }
    async resolveRenameLocation(resource, position, token) {
        if (typeof this._provider.prepareRename !== 'function') {
            return Promise.resolve(undefined);
        }
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        try {
            const rangeOrLocation = await this._provider.prepareRename(doc, pos, token);
            let range;
            let text;
            if (Range.isRange(rangeOrLocation)) {
                range = rangeOrLocation;
                text = doc.getText(rangeOrLocation);
            }
            else if (isObject(rangeOrLocation)) {
                range = rangeOrLocation.range;
                text = rangeOrLocation.placeholder;
            }
            if (!range || !text) {
                return undefined;
            }
            if (range.start.line > pos.line || range.end.line < pos.line) {
                this._logService.warn('INVALID rename location: position line must be within range start/end lines');
                return undefined;
            }
            return { range: typeConvert.Range.from(range), text };
        }
        catch (err) {
            const rejectReason = RenameAdapter._asMessage(err);
            if (rejectReason) {
                return { rejectReason, range: undefined, text: undefined };
            }
            else {
                return Promise.reject(err);
            }
        }
    }
    static _asMessage(err) {
        if (typeof err === 'string') {
            return err;
        }
        else if (err instanceof Error && typeof err.message === 'string') {
            return err.message;
        }
        else {
            return undefined;
        }
    }
}
class NewSymbolNamesAdapter {
    static { this.languageTriggerKindToVSCodeTriggerKind = {
        [languages.NewSymbolNameTriggerKind.Invoke]: NewSymbolNameTriggerKind.Invoke,
        [languages.NewSymbolNameTriggerKind.Automatic]: NewSymbolNameTriggerKind.Automatic,
    }; }
    constructor(_documents, _provider, _logService) {
        this._documents = _documents;
        this._provider = _provider;
        this._logService = _logService;
    }
    async supportsAutomaticNewSymbolNamesTriggerKind() {
        return this._provider.supportsAutomaticTriggerKind;
    }
    async provideNewSymbolNames(resource, range, triggerKind, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Range.to(range);
        try {
            const kind = NewSymbolNamesAdapter.languageTriggerKindToVSCodeTriggerKind[triggerKind];
            const value = await this._provider.provideNewSymbolNames(doc, pos, kind, token);
            if (!value) {
                return undefined;
            }
            return value.map(v => typeof v === 'string' /* @ulugbekna: for backward compatibility because `value` used to be just `string[]` */
                ? { newSymbolName: v }
                : { newSymbolName: v.newSymbolName, tags: v.tags });
        }
        catch (err) {
            this._logService.error(NewSymbolNamesAdapter._asMessage(err) ?? JSON.stringify(err, null, '\t') /* @ulugbekna: assuming `err` doesn't have circular references that could result in an exception when converting to JSON */);
            return undefined;
        }
    }
    // @ulugbekna: this method is also defined in RenameAdapter but seems OK to be duplicated
    static _asMessage(err) {
        if (typeof err === 'string') {
            return err;
        }
        else if (err instanceof Error && typeof err.message === 'string') {
            return err.message;
        }
        else {
            return undefined;
        }
    }
}
class SemanticTokensPreviousResult {
    constructor(resultId, tokens) {
        this.resultId = resultId;
        this.tokens = tokens;
    }
}
class DocumentSemanticTokensAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this._nextResultId = 1;
        this._previousResults = new Map();
    }
    async provideDocumentSemanticTokens(resource, previousResultId, token) {
        const doc = this._documents.getDocument(resource);
        const previousResult = (previousResultId !== 0 ? this._previousResults.get(previousResultId) : null);
        let value = typeof previousResult?.resultId === 'string' && typeof this._provider.provideDocumentSemanticTokensEdits === 'function'
            ? await this._provider.provideDocumentSemanticTokensEdits(doc, previousResult.resultId, token)
            : await this._provider.provideDocumentSemanticTokens(doc, token);
        if (previousResult) {
            this._previousResults.delete(previousResultId);
        }
        if (!value) {
            return null;
        }
        value = DocumentSemanticTokensAdapter._fixProvidedSemanticTokens(value);
        return this._send(DocumentSemanticTokensAdapter._convertToEdits(previousResult, value), value);
    }
    async releaseDocumentSemanticColoring(semanticColoringResultId) {
        this._previousResults.delete(semanticColoringResultId);
    }
    static _fixProvidedSemanticTokens(v) {
        if (DocumentSemanticTokensAdapter._isSemanticTokens(v)) {
            if (DocumentSemanticTokensAdapter._isCorrectSemanticTokens(v)) {
                return v;
            }
            return new SemanticTokens(new Uint32Array(v.data), v.resultId);
        }
        else if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(v)) {
            if (DocumentSemanticTokensAdapter._isCorrectSemanticTokensEdits(v)) {
                return v;
            }
            return new SemanticTokensEdits(v.edits.map(edit => new SemanticTokensEdit(edit.start, edit.deleteCount, edit.data ? new Uint32Array(edit.data) : edit.data)), v.resultId);
        }
        return v;
    }
    static _isSemanticTokens(v) {
        return v && !!(v.data);
    }
    static _isCorrectSemanticTokens(v) {
        return (v.data instanceof Uint32Array);
    }
    static _isSemanticTokensEdits(v) {
        return v && Array.isArray(v.edits);
    }
    static _isCorrectSemanticTokensEdits(v) {
        for (const edit of v.edits) {
            if (!(edit.data instanceof Uint32Array)) {
                return false;
            }
        }
        return true;
    }
    static _convertToEdits(previousResult, newResult) {
        if (!DocumentSemanticTokensAdapter._isSemanticTokens(newResult)) {
            return newResult;
        }
        if (!previousResult || !previousResult.tokens) {
            return newResult;
        }
        const oldData = previousResult.tokens;
        const oldLength = oldData.length;
        const newData = newResult.data;
        const newLength = newData.length;
        let commonPrefixLength = 0;
        const maxCommonPrefixLength = Math.min(oldLength, newLength);
        while (commonPrefixLength < maxCommonPrefixLength && oldData[commonPrefixLength] === newData[commonPrefixLength]) {
            commonPrefixLength++;
        }
        if (commonPrefixLength === oldLength && commonPrefixLength === newLength) {
            // complete overlap!
            return new SemanticTokensEdits([], newResult.resultId);
        }
        let commonSuffixLength = 0;
        const maxCommonSuffixLength = maxCommonPrefixLength - commonPrefixLength;
        while (commonSuffixLength < maxCommonSuffixLength && oldData[oldLength - commonSuffixLength - 1] === newData[newLength - commonSuffixLength - 1]) {
            commonSuffixLength++;
        }
        return new SemanticTokensEdits([{
                start: commonPrefixLength,
                deleteCount: (oldLength - commonPrefixLength - commonSuffixLength),
                data: newData.subarray(commonPrefixLength, newLength - commonSuffixLength)
            }], newResult.resultId);
    }
    _send(value, original) {
        if (DocumentSemanticTokensAdapter._isSemanticTokens(value)) {
            const myId = this._nextResultId++;
            this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId, value.data));
            return encodeSemanticTokensDto({
                id: myId,
                type: 'full',
                data: value.data
            });
        }
        if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(value)) {
            const myId = this._nextResultId++;
            if (DocumentSemanticTokensAdapter._isSemanticTokens(original)) {
                // store the original
                this._previousResults.set(myId, new SemanticTokensPreviousResult(original.resultId, original.data));
            }
            else {
                this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId));
            }
            return encodeSemanticTokensDto({
                id: myId,
                type: 'delta',
                deltas: (value.edits || []).map(edit => ({ start: edit.start, deleteCount: edit.deleteCount, data: edit.data }))
            });
        }
        return null;
    }
}
class DocumentRangeSemanticTokensAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideDocumentRangeSemanticTokens(resource, range, token) {
        const doc = this._documents.getDocument(resource);
        const value = await this._provider.provideDocumentRangeSemanticTokens(doc, typeConvert.Range.to(range), token);
        if (!value) {
            return null;
        }
        return this._send(value);
    }
    _send(value) {
        return encodeSemanticTokensDto({
            id: 0,
            type: 'full',
            data: value.data
        });
    }
}
class CompletionsAdapter {
    static supportsResolving(provider) {
        return typeof provider.resolveCompletionItem === 'function';
    }
    constructor(_documents, _commands, _provider, _apiDeprecation, _extension) {
        this._documents = _documents;
        this._commands = _commands;
        this._provider = _provider;
        this._apiDeprecation = _apiDeprecation;
        this._extension = _extension;
        this._cache = new Cache('CompletionItem');
        this._disposables = new Map();
    }
    async provideCompletionItems(resource, position, context, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        // The default insert/replace ranges. It's important to compute them
        // before asynchronously asking the provider for its results. See
        // https://github.com/microsoft/vscode/issues/83400#issuecomment-546851421
        const replaceRange = doc.getWordRangeAtPosition(pos) || new Range(pos, pos);
        const insertRange = replaceRange.with({ end: pos });
        const sw = new StopWatch();
        const itemsOrList = await this._provider.provideCompletionItems(doc, pos, token, typeConvert.CompletionContext.to(context));
        if (!itemsOrList) {
            // undefined and null are valid results
            return undefined;
        }
        if (token.isCancellationRequested) {
            // cancelled -> return without further ado, esp no caching
            // of results as they will leak
            return undefined;
        }
        const list = Array.isArray(itemsOrList) ? new CompletionList(itemsOrList) : itemsOrList;
        // keep result for providers that support resolving
        const pid = CompletionsAdapter.supportsResolving(this._provider) ? this._cache.add(list.items) : this._cache.add([]);
        const disposables = new DisposableStore();
        this._disposables.set(pid, disposables);
        const completions = [];
        const result = {
            x: pid,
            ["b" /* extHostProtocol.ISuggestResultDtoField.completions */]: completions,
            ["a" /* extHostProtocol.ISuggestResultDtoField.defaultRanges */]: { replace: typeConvert.Range.from(replaceRange), insert: typeConvert.Range.from(insertRange) },
            ["c" /* extHostProtocol.ISuggestResultDtoField.isIncomplete */]: list.isIncomplete || undefined,
            ["d" /* extHostProtocol.ISuggestResultDtoField.duration */]: sw.elapsed()
        };
        for (let i = 0; i < list.items.length; i++) {
            const item = list.items[i];
            // check for bad completion item first
            const dto = this._convertCompletionItem(item, [pid, i], insertRange, replaceRange);
            completions.push(dto);
        }
        return result;
    }
    async resolveCompletionItem(id, token) {
        if (typeof this._provider.resolveCompletionItem !== 'function') {
            return undefined;
        }
        const item = this._cache.get(...id);
        if (!item) {
            return undefined;
        }
        const dto1 = this._convertCompletionItem(item, id);
        const resolvedItem = await this._provider.resolveCompletionItem(item, token);
        if (!resolvedItem) {
            return undefined;
        }
        const dto2 = this._convertCompletionItem(resolvedItem, id);
        if (dto1["h" /* extHostProtocol.ISuggestDataDtoField.insertText */] !== dto2["h" /* extHostProtocol.ISuggestDataDtoField.insertText */]
            || dto1["i" /* extHostProtocol.ISuggestDataDtoField.insertTextRules */] !== dto2["i" /* extHostProtocol.ISuggestDataDtoField.insertTextRules */]) {
            this._apiDeprecation.report('CompletionItem.insertText', this._extension, 'extension MAY NOT change \'insertText\' of a CompletionItem during resolve');
        }
        if (dto1["n" /* extHostProtocol.ISuggestDataDtoField.commandIdent */] !== dto2["n" /* extHostProtocol.ISuggestDataDtoField.commandIdent */]
            || dto1["o" /* extHostProtocol.ISuggestDataDtoField.commandId */] !== dto2["o" /* extHostProtocol.ISuggestDataDtoField.commandId */]
            || !equals(dto1["p" /* extHostProtocol.ISuggestDataDtoField.commandArguments */], dto2["p" /* extHostProtocol.ISuggestDataDtoField.commandArguments */])) {
            this._apiDeprecation.report('CompletionItem.command', this._extension, 'extension MAY NOT change \'command\' of a CompletionItem during resolve');
        }
        return {
            ...dto1,
            ["d" /* extHostProtocol.ISuggestDataDtoField.documentation */]: dto2["d" /* extHostProtocol.ISuggestDataDtoField.documentation */],
            ["c" /* extHostProtocol.ISuggestDataDtoField.detail */]: dto2["c" /* extHostProtocol.ISuggestDataDtoField.detail */],
            ["l" /* extHostProtocol.ISuggestDataDtoField.additionalTextEdits */]: dto2["l" /* extHostProtocol.ISuggestDataDtoField.additionalTextEdits */],
            // (fishy) async insertText
            ["h" /* extHostProtocol.ISuggestDataDtoField.insertText */]: dto2["h" /* extHostProtocol.ISuggestDataDtoField.insertText */],
            ["i" /* extHostProtocol.ISuggestDataDtoField.insertTextRules */]: dto2["i" /* extHostProtocol.ISuggestDataDtoField.insertTextRules */],
            // (fishy) async command
            ["n" /* extHostProtocol.ISuggestDataDtoField.commandIdent */]: dto2["n" /* extHostProtocol.ISuggestDataDtoField.commandIdent */],
            ["o" /* extHostProtocol.ISuggestDataDtoField.commandId */]: dto2["o" /* extHostProtocol.ISuggestDataDtoField.commandId */],
            ["p" /* extHostProtocol.ISuggestDataDtoField.commandArguments */]: dto2["p" /* extHostProtocol.ISuggestDataDtoField.commandArguments */],
        };
    }
    releaseCompletionItems(id) {
        this._disposables.get(id)?.dispose();
        this._disposables.delete(id);
        this._cache.delete(id);
    }
    _convertCompletionItem(item, id, defaultInsertRange, defaultReplaceRange) {
        const disposables = this._disposables.get(id[0]);
        if (!disposables) {
            throw Error('DisposableStore is missing...');
        }
        const command = this._commands.toInternal(item.command, disposables);
        const result = {
            //
            x: id,
            //
            ["a" /* extHostProtocol.ISuggestDataDtoField.label */]: item.label,
            ["b" /* extHostProtocol.ISuggestDataDtoField.kind */]: item.kind !== undefined ? typeConvert.CompletionItemKind.from(item.kind) : undefined,
            ["m" /* extHostProtocol.ISuggestDataDtoField.kindModifier */]: item.tags && item.tags.map(typeConvert.CompletionItemTag.from),
            ["c" /* extHostProtocol.ISuggestDataDtoField.detail */]: item.detail,
            ["d" /* extHostProtocol.ISuggestDataDtoField.documentation */]: typeof item.documentation === 'undefined' ? undefined : typeConvert.MarkdownString.fromStrict(item.documentation),
            ["e" /* extHostProtocol.ISuggestDataDtoField.sortText */]: item.sortText !== item.label ? item.sortText : undefined,
            ["f" /* extHostProtocol.ISuggestDataDtoField.filterText */]: item.filterText !== item.label ? item.filterText : undefined,
            ["g" /* extHostProtocol.ISuggestDataDtoField.preselect */]: item.preselect || undefined,
            ["i" /* extHostProtocol.ISuggestDataDtoField.insertTextRules */]: item.keepWhitespace ? 1 /* languages.CompletionItemInsertTextRule.KeepWhitespace */ : 0 /* languages.CompletionItemInsertTextRule.None */,
            ["k" /* extHostProtocol.ISuggestDataDtoField.commitCharacters */]: item.commitCharacters?.join(''),
            ["l" /* extHostProtocol.ISuggestDataDtoField.additionalTextEdits */]: item.additionalTextEdits && item.additionalTextEdits.map(typeConvert.TextEdit.from),
            ["n" /* extHostProtocol.ISuggestDataDtoField.commandIdent */]: command?.$ident,
            ["o" /* extHostProtocol.ISuggestDataDtoField.commandId */]: command?.id,
            ["p" /* extHostProtocol.ISuggestDataDtoField.commandArguments */]: command?.$ident ? undefined : command?.arguments, // filled in on main side from $ident
        };
        // 'insertText'-logic
        if (item.textEdit) {
            this._apiDeprecation.report('CompletionItem.textEdit', this._extension, `Use 'CompletionItem.insertText' and 'CompletionItem.range' instead.`);
            result["h" /* extHostProtocol.ISuggestDataDtoField.insertText */] = item.textEdit.newText;
        }
        else if (typeof item.insertText === 'string') {
            result["h" /* extHostProtocol.ISuggestDataDtoField.insertText */] = item.insertText;
        }
        else if (item.insertText instanceof SnippetString) {
            result["h" /* extHostProtocol.ISuggestDataDtoField.insertText */] = item.insertText.value;
            result["i" /* extHostProtocol.ISuggestDataDtoField.insertTextRules */] |= 4 /* languages.CompletionItemInsertTextRule.InsertAsSnippet */;
        }
        // 'overwrite[Before|After]'-logic
        let range;
        if (item.textEdit) {
            range = item.textEdit.range;
        }
        else if (item.range) {
            range = item.range;
        }
        if (Range.isRange(range)) {
            // "old" range
            result["j" /* extHostProtocol.ISuggestDataDtoField.range */] = typeConvert.Range.from(range);
        }
        else if (range && (!defaultInsertRange?.isEqual(range.inserting) || !defaultReplaceRange?.isEqual(range.replacing))) {
            // ONLY send range when it's different from the default ranges (safe bandwidth)
            result["j" /* extHostProtocol.ISuggestDataDtoField.range */] = {
                insert: typeConvert.Range.from(range.inserting),
                replace: typeConvert.Range.from(range.replacing)
            };
        }
        return result;
    }
}
class InlineCompletionAdapter {
    constructor(_extension, _documents, _provider, _commands) {
        this._extension = _extension;
        this._documents = _documents;
        this._provider = _provider;
        this._commands = _commands;
        this._references = new ReferenceMap();
        this.languageTriggerKindToVSCodeTriggerKind = {
            [languages.InlineCompletionTriggerKind.Automatic]: InlineCompletionTriggerKind.Automatic,
            [languages.InlineCompletionTriggerKind.Explicit]: InlineCompletionTriggerKind.Invoke,
        };
        this._isAdditionsProposedApiEnabled = isProposedApiEnabled(this._extension, 'inlineCompletionsAdditions');
    }
    get supportsHandleEvents() {
        return isProposedApiEnabled(this._extension, 'inlineCompletionsAdditions')
            && (typeof this._provider.handleDidShowCompletionItem === 'function'
                || typeof this._provider.handleDidPartiallyAcceptCompletionItem === 'function'
                || typeof this._provider.handleDidRejectCompletionItem === 'function'
                || typeof this._provider.handleEndOfLifetime === 'function');
    }
    async provideInlineCompletions(resource, position, context, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const result = await this._provider.provideInlineCompletionItems(doc, pos, {
            selectedCompletionInfo: context.selectedSuggestionInfo
                ? {
                    range: typeConvert.Range.to(context.selectedSuggestionInfo.range),
                    text: context.selectedSuggestionInfo.text
                }
                : undefined,
            triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
            requestUuid: context.requestUuid,
        }, token);
        if (!result) {
            // undefined and null are valid results
            return undefined;
        }
        if (token.isCancellationRequested) {
            // cancelled -> return without further ado, esp no caching
            // of results as they will leak
            return undefined;
        }
        const normalizedResult = Array.isArray(result) ? result : result.items;
        const commands = this._isAdditionsProposedApiEnabled ? Array.isArray(result) ? [] : result.commands || [] : [];
        const enableForwardStability = this._isAdditionsProposedApiEnabled && !Array.isArray(result) ? result.enableForwardStability : undefined;
        let disposableStore = undefined;
        const pid = this._references.createReferenceId({
            dispose() {
                disposableStore?.dispose();
            },
            items: normalizedResult
        });
        return {
            pid,
            items: normalizedResult.map((item, idx) => {
                let command = undefined;
                if (item.command) {
                    if (!disposableStore) {
                        disposableStore = new DisposableStore();
                    }
                    command = this._commands.toInternal(item.command, disposableStore);
                }
                let action = undefined;
                if (item.action) {
                    if (!disposableStore) {
                        disposableStore = new DisposableStore();
                    }
                    action = this._commands.toInternal(item.action, disposableStore);
                }
                const insertText = item.insertText;
                return ({
                    insertText: typeof insertText === 'string' ? insertText : { snippet: insertText.value },
                    filterText: item.filterText,
                    range: item.range ? typeConvert.Range.from(item.range) : undefined,
                    showRange: (this._isAdditionsProposedApiEnabled && item.showRange) ? typeConvert.Range.from(item.showRange) : undefined,
                    command,
                    action,
                    idx: idx,
                    completeBracketPairs: this._isAdditionsProposedApiEnabled ? item.completeBracketPairs : false,
                    isInlineEdit: this._isAdditionsProposedApiEnabled ? item.isInlineEdit : false,
                    showInlineEditMenu: this._isAdditionsProposedApiEnabled ? item.showInlineEditMenu : false,
                    displayLocation: (item.displayLocation && this._isAdditionsProposedApiEnabled) ? {
                        range: typeConvert.Range.from(item.displayLocation.range),
                        label: item.displayLocation.label,
                    } : undefined,
                    warning: (item.warning && this._isAdditionsProposedApiEnabled) ? {
                        message: typeConvert.MarkdownString.from(item.warning.message),
                        icon: item.warning.icon ? typeConvert.IconPath.fromThemeIcon(item.warning.icon) : undefined,
                    } : undefined,
                });
            }),
            commands: commands.map(c => {
                if (!disposableStore) {
                    disposableStore = new DisposableStore();
                }
                return this._commands.toInternal(c, disposableStore);
            }),
            suppressSuggestions: false,
            enableForwardStability,
        };
    }
    async provideInlineEditsForRange(resource, range, context, token) {
        if (!this._provider.provideInlineEditsForRange) {
            return undefined;
        }
        checkProposedApiEnabled(this._extension, 'inlineCompletionsAdditions');
        const doc = this._documents.getDocument(resource);
        const r = typeConvert.Range.to(range);
        const result = await this._provider.provideInlineEditsForRange(doc, r, {
            selectedCompletionInfo: context.selectedSuggestionInfo
                ? {
                    range: typeConvert.Range.to(context.selectedSuggestionInfo.range),
                    text: context.selectedSuggestionInfo.text
                }
                : undefined,
            triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
            userPrompt: context.userPrompt,
            requestUuid: context.requestUuid,
        }, token);
        if (!result) {
            // undefined and null are valid results
            return undefined;
        }
        if (token.isCancellationRequested) {
            // cancelled -> return without further ado, esp no caching
            // of results as they will leak
            return undefined;
        }
        const normalizedResult = Array.isArray(result) ? result : result.items;
        const commands = this._isAdditionsProposedApiEnabled ? Array.isArray(result) ? [] : result.commands || [] : [];
        const enableForwardStability = this._isAdditionsProposedApiEnabled && !Array.isArray(result) ? result.enableForwardStability : undefined;
        let disposableStore = undefined;
        const pid = this._references.createReferenceId({
            dispose() {
                disposableStore?.dispose();
            },
            items: normalizedResult
        });
        return {
            pid,
            items: normalizedResult.map((item, idx) => {
                let command = undefined;
                if (item.command) {
                    if (!disposableStore) {
                        disposableStore = new DisposableStore();
                    }
                    command = this._commands.toInternal(item.command, disposableStore);
                }
                let action = undefined;
                if (item.action) {
                    if (!disposableStore) {
                        disposableStore = new DisposableStore();
                    }
                    action = this._commands.toInternal(item.action, disposableStore);
                }
                const insertText = item.insertText;
                return ({
                    insertText: typeof insertText === 'string' ? insertText : { snippet: insertText.value },
                    filterText: item.filterText,
                    range: item.range ? typeConvert.Range.from(item.range) : undefined,
                    command,
                    action,
                    idx: idx,
                    completeBracketPairs: this._isAdditionsProposedApiEnabled ? item.completeBracketPairs : false,
                });
            }),
            commands: commands.map(c => {
                if (!disposableStore) {
                    disposableStore = new DisposableStore();
                }
                return this._commands.toInternal(c, disposableStore);
            }),
            suppressSuggestions: false,
            enableForwardStability,
        };
    }
    disposeCompletions(pid) {
        const data = this._references.disposeReferenceId(pid);
        data?.dispose();
    }
    handleDidShowCompletionItem(pid, idx, updatedInsertText) {
        const completionItem = this._references.get(pid)?.items[idx];
        if (completionItem) {
            if (this._provider.handleDidShowCompletionItem && this._isAdditionsProposedApiEnabled) {
                this._provider.handleDidShowCompletionItem(completionItem, updatedInsertText);
            }
        }
    }
    handlePartialAccept(pid, idx, acceptedCharacters, info) {
        const completionItem = this._references.get(pid)?.items[idx];
        if (completionItem) {
            if (this._provider.handleDidPartiallyAcceptCompletionItem && this._isAdditionsProposedApiEnabled) {
                this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, acceptedCharacters);
                this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, typeConvert.PartialAcceptInfo.to(info));
            }
        }
    }
    handleEndOfLifetime(pid, idx, reason) {
        const completionItem = this._references.get(pid)?.items[idx];
        if (completionItem) {
            if (this._provider.handleEndOfLifetime && this._isAdditionsProposedApiEnabled) {
                const r = typeConvert.InlineCompletionEndOfLifeReason.to(reason, ref => this._references.get(ref.pid)?.items[ref.idx]);
                this._provider.handleEndOfLifetime(completionItem, r);
            }
        }
    }
    handleRejection(pid, idx) {
        const completionItem = this._references.get(pid)?.items[idx];
        if (completionItem) {
            if (this._provider.handleDidRejectCompletionItem && this._isAdditionsProposedApiEnabled) {
                this._provider.handleDidRejectCompletionItem(completionItem);
            }
        }
    }
}
class InlineEditAdapter {
    async provideInlineEdits(uri, context, token) {
        const doc = this._documents.getDocument(uri);
        const result = await this._provider.provideInlineEdit(doc, {
            triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
            requestUuid: context.requestUuid,
        }, token);
        if (!result) {
            // undefined and null are valid results
            return undefined;
        }
        if (token.isCancellationRequested) {
            // cancelled -> return without further ado, esp no caching
            // of results as they will leak
            return undefined;
        }
        let disposableStore = undefined;
        const pid = this._references.createReferenceId({
            dispose() {
                disposableStore?.dispose();
            },
            item: result
        });
        let acceptCommand = undefined;
        if (result.accepted) {
            if (!disposableStore) {
                disposableStore = new DisposableStore();
            }
            acceptCommand = this._commands.toInternal(result.accepted, disposableStore);
        }
        let rejectCommand = undefined;
        if (result.rejected) {
            if (!disposableStore) {
                disposableStore = new DisposableStore();
            }
            rejectCommand = this._commands.toInternal(result.rejected, disposableStore);
        }
        let shownCommand = undefined;
        if (result.shown) {
            if (!disposableStore) {
                disposableStore = new DisposableStore();
            }
            shownCommand = this._commands.toInternal(result.shown, disposableStore);
        }
        let action = undefined;
        if (result.action) {
            if (!disposableStore) {
                disposableStore = new DisposableStore();
            }
            action = this._commands.toInternal(result.action, disposableStore);
        }
        if (!disposableStore) {
            disposableStore = new DisposableStore();
        }
        const langResult = {
            pid,
            text: result.text,
            range: typeConvert.Range.from(result.range),
            showRange: typeConvert.Range.from(result.showRange),
            accepted: acceptCommand,
            rejected: rejectCommand,
            shown: shownCommand,
            action,
            commands: result.commands?.map(c => this._commands.toInternal(c, disposableStore)),
        };
        return langResult;
    }
    disposeEdit(pid) {
        const data = this._references.disposeReferenceId(pid);
        data?.dispose();
    }
    constructor(_extension, _documents, _provider, _commands) {
        this._documents = _documents;
        this._provider = _provider;
        this._commands = _commands;
        this._references = new ReferenceMap();
        this.languageTriggerKindToVSCodeTriggerKind = {
            [languages.InlineEditTriggerKind.Automatic]: InlineEditTriggerKind.Automatic,
            [languages.InlineEditTriggerKind.Invoke]: InlineEditTriggerKind.Invoke,
        };
    }
}
class ReferenceMap {
    constructor() {
        this._references = new Map();
        this._idPool = 1;
    }
    createReferenceId(value) {
        const id = this._idPool++;
        this._references.set(id, value);
        return id;
    }
    disposeReferenceId(referenceId) {
        const value = this._references.get(referenceId);
        this._references.delete(referenceId);
        return value;
    }
    get(referenceId) {
        return this._references.get(referenceId);
    }
}
class SignatureHelpAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this._cache = new Cache('SignatureHelp');
    }
    async provideSignatureHelp(resource, position, context, token) {
        const doc = this._documents.getDocument(resource);
        const pos = typeConvert.Position.to(position);
        const vscodeContext = this.reviveContext(context);
        const value = await this._provider.provideSignatureHelp(doc, pos, token, vscodeContext);
        if (value) {
            const id = this._cache.add([value]);
            return { ...typeConvert.SignatureHelp.from(value), id };
        }
        return undefined;
    }
    reviveContext(context) {
        let activeSignatureHelp = undefined;
        if (context.activeSignatureHelp) {
            const revivedSignatureHelp = typeConvert.SignatureHelp.to(context.activeSignatureHelp);
            const saved = this._cache.get(context.activeSignatureHelp.id, 0);
            if (saved) {
                activeSignatureHelp = saved;
                activeSignatureHelp.activeSignature = revivedSignatureHelp.activeSignature;
                activeSignatureHelp.activeParameter = revivedSignatureHelp.activeParameter;
            }
            else {
                activeSignatureHelp = revivedSignatureHelp;
            }
        }
        return { ...context, activeSignatureHelp };
    }
    releaseSignatureHelp(id) {
        this._cache.delete(id);
    }
}
class InlayHintsAdapter {
    constructor(_documents, _commands, _provider, _logService, _extension) {
        this._documents = _documents;
        this._commands = _commands;
        this._provider = _provider;
        this._logService = _logService;
        this._extension = _extension;
        this._cache = new Cache('InlayHints');
        this._disposables = new Map();
    }
    async provideInlayHints(resource, ran, token) {
        const doc = this._documents.getDocument(resource);
        const range = typeConvert.Range.to(ran);
        const hints = await this._provider.provideInlayHints(doc, range, token);
        if (!Array.isArray(hints) || hints.length === 0) {
            // bad result
            this._logService.trace(`[InlayHints] NO inlay hints from '${this._extension.identifier.value}' for range ${JSON.stringify(ran)}`);
            return undefined;
        }
        if (token.isCancellationRequested) {
            // cancelled -> return without further ado, esp no caching
            // of results as they will leak
            return undefined;
        }
        const pid = this._cache.add(hints);
        this._disposables.set(pid, new DisposableStore());
        const result = { hints: [], cacheId: pid };
        for (let i = 0; i < hints.length; i++) {
            if (this._isValidInlayHint(hints[i], range)) {
                result.hints.push(this._convertInlayHint(hints[i], [pid, i]));
            }
        }
        this._logService.trace(`[InlayHints] ${result.hints.length} inlay hints from '${this._extension.identifier.value}' for range ${JSON.stringify(ran)}`);
        return result;
    }
    async resolveInlayHint(id, token) {
        if (typeof this._provider.resolveInlayHint !== 'function') {
            return undefined;
        }
        const item = this._cache.get(...id);
        if (!item) {
            return undefined;
        }
        const hint = await this._provider.resolveInlayHint(item, token);
        if (!hint) {
            return undefined;
        }
        if (!this._isValidInlayHint(hint)) {
            return undefined;
        }
        return this._convertInlayHint(hint, id);
    }
    releaseHints(id) {
        this._disposables.get(id)?.dispose();
        this._disposables.delete(id);
        this._cache.delete(id);
    }
    _isValidInlayHint(hint, range) {
        if (hint.label.length === 0 || Array.isArray(hint.label) && hint.label.every(part => part.value.length === 0)) {
            console.log('INVALID inlay hint, empty label', hint);
            return false;
        }
        if (range && !range.contains(hint.position)) {
            // console.log('INVALID inlay hint, position outside range', range, hint);
            return false;
        }
        return true;
    }
    _convertInlayHint(hint, id) {
        const disposables = this._disposables.get(id[0]);
        if (!disposables) {
            throw Error('DisposableStore is missing...');
        }
        const result = {
            label: '', // fill-in below
            cacheId: id,
            tooltip: typeConvert.MarkdownString.fromStrict(hint.tooltip),
            position: typeConvert.Position.from(hint.position),
            textEdits: hint.textEdits && hint.textEdits.map(typeConvert.TextEdit.from),
            kind: hint.kind && typeConvert.InlayHintKind.from(hint.kind),
            paddingLeft: hint.paddingLeft,
            paddingRight: hint.paddingRight,
        };
        if (typeof hint.label === 'string') {
            result.label = hint.label;
        }
        else {
            const parts = [];
            result.label = parts;
            for (const part of hint.label) {
                if (!part.value) {
                    console.warn('INVALID inlay hint, empty label part', this._extension.identifier.value);
                    continue;
                }
                const part2 = {
                    label: part.value,
                    tooltip: typeConvert.MarkdownString.fromStrict(part.tooltip)
                };
                if (Location.isLocation(part.location)) {
                    part2.location = typeConvert.location.from(part.location);
                }
                if (part.command) {
                    part2.command = this._commands.toInternal(part.command, disposables);
                }
                parts.push(part2);
            }
        }
        return result;
    }
}
class LinkProviderAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this._cache = new Cache('DocumentLink');
    }
    async provideLinks(resource, token) {
        const doc = this._documents.getDocument(resource);
        const links = await this._provider.provideDocumentLinks(doc, token);
        if (!Array.isArray(links) || links.length === 0) {
            // bad result
            return undefined;
        }
        if (token.isCancellationRequested) {
            // cancelled -> return without further ado, esp no caching
            // of results as they will leak
            return undefined;
        }
        if (typeof this._provider.resolveDocumentLink !== 'function') {
            // no resolve -> no caching
            return { links: links.filter(LinkProviderAdapter._validateLink).map(typeConvert.DocumentLink.from) };
        }
        else {
            // cache links for future resolving
            const pid = this._cache.add(links);
            const result = { links: [], cacheId: pid };
            for (let i = 0; i < links.length; i++) {
                if (!LinkProviderAdapter._validateLink(links[i])) {
                    continue;
                }
                const dto = typeConvert.DocumentLink.from(links[i]);
                dto.cacheId = [pid, i];
                result.links.push(dto);
            }
            return result;
        }
    }
    static _validateLink(link) {
        if (link.target && link.target.path.length > 50_000) {
            console.warn('DROPPING link because it is too long');
            return false;
        }
        return true;
    }
    async resolveLink(id, token) {
        if (typeof this._provider.resolveDocumentLink !== 'function') {
            return undefined;
        }
        const item = this._cache.get(...id);
        if (!item) {
            return undefined;
        }
        const link = await this._provider.resolveDocumentLink(item, token);
        if (!link || !LinkProviderAdapter._validateLink(link)) {
            return undefined;
        }
        return typeConvert.DocumentLink.from(link);
    }
    releaseLinks(id) {
        this._cache.delete(id);
    }
}
class ColorProviderAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideColors(resource, token) {
        const doc = this._documents.getDocument(resource);
        const colors = await this._provider.provideDocumentColors(doc, token);
        if (!Array.isArray(colors)) {
            return [];
        }
        const colorInfos = colors.map(ci => {
            return {
                color: typeConvert.Color.from(ci.color),
                range: typeConvert.Range.from(ci.range)
            };
        });
        return colorInfos;
    }
    async provideColorPresentations(resource, raw, token) {
        const document = this._documents.getDocument(resource);
        const range = typeConvert.Range.to(raw.range);
        const color = typeConvert.Color.to(raw.color);
        const value = await this._provider.provideColorPresentations(color, { document, range }, token);
        if (!Array.isArray(value)) {
            return undefined;
        }
        return value.map(typeConvert.ColorPresentation.from);
    }
}
class FoldingProviderAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
    }
    async provideFoldingRanges(resource, context, token) {
        const doc = this._documents.getDocument(resource);
        const ranges = await this._provider.provideFoldingRanges(doc, context, token);
        if (!Array.isArray(ranges)) {
            return undefined;
        }
        return ranges.map(typeConvert.FoldingRange.from);
    }
}
class SelectionRangeAdapter {
    constructor(_documents, _provider, _logService) {
        this._documents = _documents;
        this._provider = _provider;
        this._logService = _logService;
    }
    async provideSelectionRanges(resource, pos, token) {
        const document = this._documents.getDocument(resource);
        const positions = pos.map(typeConvert.Position.to);
        const allProviderRanges = await this._provider.provideSelectionRanges(document, positions, token);
        if (!isNonEmptyArray(allProviderRanges)) {
            return [];
        }
        if (allProviderRanges.length !== positions.length) {
            this._logService.warn('BAD selection ranges, provider must return ranges for each position');
            return [];
        }
        const allResults = [];
        for (let i = 0; i < positions.length; i++) {
            const oneResult = [];
            allResults.push(oneResult);
            let last = positions[i];
            let selectionRange = allProviderRanges[i];
            while (true) {
                if (!selectionRange.range.contains(last)) {
                    throw new Error('INVALID selection range, must contain the previous range');
                }
                oneResult.push(typeConvert.SelectionRange.from(selectionRange));
                if (!selectionRange.parent) {
                    break;
                }
                last = selectionRange.range;
                selectionRange = selectionRange.parent;
            }
        }
        return allResults;
    }
}
class CallHierarchyAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this._idPool = new IdGenerator('');
        this._cache = new Map();
    }
    async prepareSession(uri, position, token) {
        const doc = this._documents.getDocument(uri);
        const pos = typeConvert.Position.to(position);
        const items = await this._provider.prepareCallHierarchy(doc, pos, token);
        if (!items) {
            return undefined;
        }
        const sessionId = this._idPool.nextId();
        this._cache.set(sessionId, new Map());
        if (Array.isArray(items)) {
            return items.map(item => this._cacheAndConvertItem(sessionId, item));
        }
        else {
            return [this._cacheAndConvertItem(sessionId, items)];
        }
    }
    async provideCallsTo(sessionId, itemId, token) {
        const item = this._itemFromCache(sessionId, itemId);
        if (!item) {
            throw new Error('missing call hierarchy item');
        }
        const calls = await this._provider.provideCallHierarchyIncomingCalls(item, token);
        if (!calls) {
            return undefined;
        }
        return calls.map(call => {
            return {
                from: this._cacheAndConvertItem(sessionId, call.from),
                fromRanges: call.fromRanges.map(r => typeConvert.Range.from(r))
            };
        });
    }
    async provideCallsFrom(sessionId, itemId, token) {
        const item = this._itemFromCache(sessionId, itemId);
        if (!item) {
            throw new Error('missing call hierarchy item');
        }
        const calls = await this._provider.provideCallHierarchyOutgoingCalls(item, token);
        if (!calls) {
            return undefined;
        }
        return calls.map(call => {
            return {
                to: this._cacheAndConvertItem(sessionId, call.to),
                fromRanges: call.fromRanges.map(r => typeConvert.Range.from(r))
            };
        });
    }
    releaseSession(sessionId) {
        this._cache.delete(sessionId);
    }
    _cacheAndConvertItem(sessionId, item) {
        const map = this._cache.get(sessionId);
        const dto = typeConvert.CallHierarchyItem.from(item, sessionId, map.size.toString(36));
        map.set(dto._itemId, item);
        return dto;
    }
    _itemFromCache(sessionId, itemId) {
        const map = this._cache.get(sessionId);
        return map?.get(itemId);
    }
}
class TypeHierarchyAdapter {
    constructor(_documents, _provider) {
        this._documents = _documents;
        this._provider = _provider;
        this._idPool = new IdGenerator('');
        this._cache = new Map();
    }
    async prepareSession(uri, position, token) {
        const doc = this._documents.getDocument(uri);
        const pos = typeConvert.Position.to(position);
        const items = await this._provider.prepareTypeHierarchy(doc, pos, token);
        if (!items) {
            return undefined;
        }
        const sessionId = this._idPool.nextId();
        this._cache.set(sessionId, new Map());
        if (Array.isArray(items)) {
            return items.map(item => this._cacheAndConvertItem(sessionId, item));
        }
        else {
            return [this._cacheAndConvertItem(sessionId, items)];
        }
    }
    async provideSupertypes(sessionId, itemId, token) {
        const item = this._itemFromCache(sessionId, itemId);
        if (!item) {
            throw new Error('missing type hierarchy item');
        }
        const supertypes = await this._provider.provideTypeHierarchySupertypes(item, token);
        if (!supertypes) {
            return undefined;
        }
        return supertypes.map(supertype => {
            return this._cacheAndConvertItem(sessionId, supertype);
        });
    }
    async provideSubtypes(sessionId, itemId, token) {
        const item = this._itemFromCache(sessionId, itemId);
        if (!item) {
            throw new Error('missing type hierarchy item');
        }
        const subtypes = await this._provider.provideTypeHierarchySubtypes(item, token);
        if (!subtypes) {
            return undefined;
        }
        return subtypes.map(subtype => {
            return this._cacheAndConvertItem(sessionId, subtype);
        });
    }
    releaseSession(sessionId) {
        this._cache.delete(sessionId);
    }
    _cacheAndConvertItem(sessionId, item) {
        const map = this._cache.get(sessionId);
        const dto = typeConvert.TypeHierarchyItem.from(item, sessionId, map.size.toString(36));
        map.set(dto._itemId, item);
        return dto;
    }
    _itemFromCache(sessionId, itemId) {
        const map = this._cache.get(sessionId);
        return map?.get(itemId);
    }
}
class DocumentDropEditAdapter {
    constructor(_proxy, _documents, _provider, _handle, _extension) {
        this._proxy = _proxy;
        this._documents = _documents;
        this._provider = _provider;
        this._handle = _handle;
        this._extension = _extension;
        this._cache = new Cache('DocumentDropEdit');
    }
    async provideDocumentOnDropEdits(requestId, uri, position, dataTransferDto, token) {
        const doc = this._documents.getDocument(uri);
        const pos = typeConvert.Position.to(position);
        const dataTransfer = typeConvert.DataTransfer.toDataTransfer(dataTransferDto, async (id) => {
            return (await this._proxy.$resolveDocumentOnDropFileData(this._handle, requestId, id)).buffer;
        });
        const edits = await this._provider.provideDocumentDropEdits(doc, pos, dataTransfer, token);
        if (!edits) {
            return undefined;
        }
        const editsArray = asArray(edits);
        const cacheId = this._cache.add(editsArray);
        return editsArray.map((edit, i) => ({
            _cacheId: [cacheId, i],
            title: edit.title ?? localize('defaultDropLabel', "Drop using '{0}' extension", this._extension.displayName || this._extension.name),
            kind: edit.kind?.value,
            yieldTo: edit.yieldTo?.map(x => x.value),
            insertText: typeof edit.insertText === 'string' ? edit.insertText : { snippet: edit.insertText.value },
            additionalEdit: edit.additionalEdit ? typeConvert.WorkspaceEdit.from(edit.additionalEdit, undefined) : undefined,
        }));
    }
    async resolveDropEdit(id, token) {
        const [sessionId, itemId] = id;
        const item = this._cache.get(sessionId, itemId);
        if (!item || !this._provider.resolveDocumentDropEdit) {
            return {}; // this should not happen...
        }
        const resolvedItem = (await this._provider.resolveDocumentDropEdit(item, token)) ?? item;
        const additionalEdit = resolvedItem.additionalEdit ? typeConvert.WorkspaceEdit.from(resolvedItem.additionalEdit, undefined) : undefined;
        return { additionalEdit };
    }
    releaseDropEdits(id) {
        this._cache.delete(id);
    }
}
class AdapterData {
    constructor(adapter, extension) {
        this.adapter = adapter;
        this.extension = extension;
    }
}
export class ExtHostLanguageFeatures {
    static { this._handlePool = 0; }
    constructor(mainContext, _uriTransformer, _documents, _commands, _diagnostics, _logService, _apiDeprecation, _extensionTelemetry) {
        this._uriTransformer = _uriTransformer;
        this._documents = _documents;
        this._commands = _commands;
        this._diagnostics = _diagnostics;
        this._logService = _logService;
        this._apiDeprecation = _apiDeprecation;
        this._extensionTelemetry = _extensionTelemetry;
        this._adapter = new Map();
        this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadLanguageFeatures);
    }
    _transformDocumentSelector(selector, extension) {
        return typeConvert.DocumentSelector.from(selector, this._uriTransformer, extension);
    }
    _createDisposable(handle) {
        return new Disposable(() => {
            this._adapter.delete(handle);
            this._proxy.$unregister(handle);
        });
    }
    _nextHandle() {
        return ExtHostLanguageFeatures._handlePool++;
    }
    async _withAdapter(handle, ctor, callback, fallbackValue, tokenToRaceAgainst, doNotLog = false) {
        const data = this._adapter.get(handle);
        if (!data || !(data.adapter instanceof ctor)) {
            return fallbackValue;
        }
        const t1 = Date.now();
        if (!doNotLog) {
            this._logService.trace(`[${data.extension.identifier.value}] INVOKE provider '${callback.toString().replace(/[\r\n]/g, '')}'`);
        }
        const result = callback(data.adapter, data.extension);
        // logging,tracing
        Promise.resolve(result).catch(err => {
            if (!isCancellationError(err)) {
                this._logService.error(`[${data.extension.identifier.value}] provider FAILED`);
                this._logService.error(err);
                this._extensionTelemetry.onExtensionError(data.extension.identifier, err);
            }
        }).finally(() => {
            if (!doNotLog) {
                this._logService.trace(`[${data.extension.identifier.value}] provider DONE after ${Date.now() - t1}ms`);
            }
        });
        if (CancellationToken.isCancellationToken(tokenToRaceAgainst)) {
            return raceCancellationError(result, tokenToRaceAgainst);
        }
        return result;
    }
    _addNewAdapter(adapter, extension) {
        const handle = this._nextHandle();
        this._adapter.set(handle, new AdapterData(adapter, extension));
        return handle;
    }
    static _extLabel(ext) {
        return ext.displayName || ext.name;
    }
    static _extId(ext) {
        return ext.identifier.value;
    }
    // --- outline
    registerDocumentSymbolProvider(extension, selector, provider, metadata) {
        const handle = this._addNewAdapter(new DocumentSymbolAdapter(this._documents, provider), extension);
        const displayName = (metadata && metadata.label) || ExtHostLanguageFeatures._extLabel(extension);
        this._proxy.$registerDocumentSymbolProvider(handle, this._transformDocumentSelector(selector, extension), displayName);
        return this._createDisposable(handle);
    }
    $provideDocumentSymbols(handle, resource, token) {
        return this._withAdapter(handle, DocumentSymbolAdapter, adapter => adapter.provideDocumentSymbols(URI.revive(resource), token), undefined, token);
    }
    // --- code lens
    registerCodeLensProvider(extension, selector, provider) {
        const handle = this._nextHandle();
        const eventHandle = typeof provider.onDidChangeCodeLenses === 'function' ? this._nextHandle() : undefined;
        this._adapter.set(handle, new AdapterData(new CodeLensAdapter(this._documents, this._commands.converter, provider, extension, this._extensionTelemetry, this._logService), extension));
        this._proxy.$registerCodeLensSupport(handle, this._transformDocumentSelector(selector, extension), eventHandle);
        let result = this._createDisposable(handle);
        if (eventHandle !== undefined) {
            const subscription = provider.onDidChangeCodeLenses(_ => this._proxy.$emitCodeLensEvent(eventHandle));
            result = Disposable.from(result, subscription);
        }
        return result;
    }
    $provideCodeLenses(handle, resource, token) {
        return this._withAdapter(handle, CodeLensAdapter, adapter => adapter.provideCodeLenses(URI.revive(resource), token), undefined, token, resource.scheme === 'output');
    }
    $resolveCodeLens(handle, symbol, token) {
        return this._withAdapter(handle, CodeLensAdapter, adapter => adapter.resolveCodeLens(symbol, token), undefined, undefined, true);
    }
    $releaseCodeLenses(handle, cacheId) {
        this._withAdapter(handle, CodeLensAdapter, adapter => Promise.resolve(adapter.releaseCodeLenses(cacheId)), undefined, undefined, true);
    }
    // --- declaration
    registerDefinitionProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new DefinitionAdapter(this._documents, provider), extension);
        this._proxy.$registerDefinitionSupport(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideDefinition(handle, resource, position, token) {
        return this._withAdapter(handle, DefinitionAdapter, adapter => adapter.provideDefinition(URI.revive(resource), position, token), [], token);
    }
    registerDeclarationProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new DeclarationAdapter(this._documents, provider), extension);
        this._proxy.$registerDeclarationSupport(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideDeclaration(handle, resource, position, token) {
        return this._withAdapter(handle, DeclarationAdapter, adapter => adapter.provideDeclaration(URI.revive(resource), position, token), [], token);
    }
    registerImplementationProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new ImplementationAdapter(this._documents, provider), extension);
        this._proxy.$registerImplementationSupport(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideImplementation(handle, resource, position, token) {
        return this._withAdapter(handle, ImplementationAdapter, adapter => adapter.provideImplementation(URI.revive(resource), position, token), [], token);
    }
    registerTypeDefinitionProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new TypeDefinitionAdapter(this._documents, provider), extension);
        this._proxy.$registerTypeDefinitionSupport(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideTypeDefinition(handle, resource, position, token) {
        return this._withAdapter(handle, TypeDefinitionAdapter, adapter => adapter.provideTypeDefinition(URI.revive(resource), position, token), [], token);
    }
    // --- extra info
    registerHoverProvider(extension, selector, provider, extensionId) {
        const handle = this._addNewAdapter(new HoverAdapter(this._documents, provider), extension);
        this._proxy.$registerHoverProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideHover(handle, resource, position, context, token) {
        return this._withAdapter(handle, HoverAdapter, adapter => adapter.provideHover(URI.revive(resource), position, context, token), undefined, token);
    }
    $releaseHover(handle, id) {
        this._withAdapter(handle, HoverAdapter, adapter => Promise.resolve(adapter.releaseHover(id)), undefined, undefined);
    }
    // --- debug hover
    registerEvaluatableExpressionProvider(extension, selector, provider, extensionId) {
        const handle = this._addNewAdapter(new EvaluatableExpressionAdapter(this._documents, provider), extension);
        this._proxy.$registerEvaluatableExpressionProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideEvaluatableExpression(handle, resource, position, token) {
        return this._withAdapter(handle, EvaluatableExpressionAdapter, adapter => adapter.provideEvaluatableExpression(URI.revive(resource), position, token), undefined, token);
    }
    // --- debug inline values
    registerInlineValuesProvider(extension, selector, provider, extensionId) {
        const eventHandle = typeof provider.onDidChangeInlineValues === 'function' ? this._nextHandle() : undefined;
        const handle = this._addNewAdapter(new InlineValuesAdapter(this._documents, provider), extension);
        this._proxy.$registerInlineValuesProvider(handle, this._transformDocumentSelector(selector, extension), eventHandle);
        let result = this._createDisposable(handle);
        if (eventHandle !== undefined) {
            const subscription = provider.onDidChangeInlineValues(_ => this._proxy.$emitInlineValuesEvent(eventHandle));
            result = Disposable.from(result, subscription);
        }
        return result;
    }
    $provideInlineValues(handle, resource, range, context, token) {
        return this._withAdapter(handle, InlineValuesAdapter, adapter => adapter.provideInlineValues(URI.revive(resource), range, context, token), undefined, token);
    }
    // --- occurrences
    registerDocumentHighlightProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new DocumentHighlightAdapter(this._documents, provider), extension);
        this._proxy.$registerDocumentHighlightProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    registerMultiDocumentHighlightProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new MultiDocumentHighlightAdapter(this._documents, provider, this._logService), extension);
        this._proxy.$registerMultiDocumentHighlightProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideDocumentHighlights(handle, resource, position, token) {
        return this._withAdapter(handle, DocumentHighlightAdapter, adapter => adapter.provideDocumentHighlights(URI.revive(resource), position, token), undefined, token);
    }
    $provideMultiDocumentHighlights(handle, resource, position, otherModels, token) {
        return this._withAdapter(handle, MultiDocumentHighlightAdapter, adapter => adapter.provideMultiDocumentHighlights(URI.revive(resource), position, otherModels.map(model => URI.revive(model)), token), undefined, token);
    }
    // --- linked editing
    registerLinkedEditingRangeProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new LinkedEditingRangeAdapter(this._documents, provider), extension);
        this._proxy.$registerLinkedEditingRangeProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideLinkedEditingRanges(handle, resource, position, token) {
        return this._withAdapter(handle, LinkedEditingRangeAdapter, async (adapter) => {
            const res = await adapter.provideLinkedEditingRanges(URI.revive(resource), position, token);
            if (res) {
                return {
                    ranges: res.ranges,
                    wordPattern: res.wordPattern ? ExtHostLanguageFeatures._serializeRegExp(res.wordPattern) : undefined
                };
            }
            return undefined;
        }, undefined, token);
    }
    // --- references
    registerReferenceProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new ReferenceAdapter(this._documents, provider), extension);
        this._proxy.$registerReferenceSupport(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideReferences(handle, resource, position, context, token) {
        return this._withAdapter(handle, ReferenceAdapter, adapter => adapter.provideReferences(URI.revive(resource), position, context, token), undefined, token);
    }
    // --- code actions
    registerCodeActionProvider(extension, selector, provider, metadata) {
        const store = new DisposableStore();
        const handle = this._addNewAdapter(new CodeActionAdapter(this._documents, this._commands.converter, this._diagnostics, provider, this._logService, extension, this._apiDeprecation), extension);
        this._proxy.$registerCodeActionSupport(handle, this._transformDocumentSelector(selector, extension), {
            providedKinds: metadata?.providedCodeActionKinds?.map(kind => kind.value),
            documentation: metadata?.documentation?.map(x => ({
                kind: x.kind.value,
                command: this._commands.converter.toInternal(x.command, store),
            }))
        }, ExtHostLanguageFeatures._extLabel(extension), ExtHostLanguageFeatures._extId(extension), Boolean(provider.resolveCodeAction));
        store.add(this._createDisposable(handle));
        return store;
    }
    $provideCodeActions(handle, resource, rangeOrSelection, context, token) {
        return this._withAdapter(handle, CodeActionAdapter, adapter => adapter.provideCodeActions(URI.revive(resource), rangeOrSelection, context, token), undefined, token);
    }
    $resolveCodeAction(handle, id, token) {
        return this._withAdapter(handle, CodeActionAdapter, adapter => adapter.resolveCodeAction(id, token), {}, undefined);
    }
    $releaseCodeActions(handle, cacheId) {
        this._withAdapter(handle, CodeActionAdapter, adapter => Promise.resolve(adapter.releaseCodeActions(cacheId)), undefined, undefined);
    }
    // --- formatting
    registerDocumentFormattingEditProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new DocumentFormattingAdapter(this._documents, provider), extension);
        this._proxy.$registerDocumentFormattingSupport(handle, this._transformDocumentSelector(selector, extension), extension.identifier, extension.displayName || extension.name);
        return this._createDisposable(handle);
    }
    $provideDocumentFormattingEdits(handle, resource, options, token) {
        return this._withAdapter(handle, DocumentFormattingAdapter, adapter => adapter.provideDocumentFormattingEdits(URI.revive(resource), options, token), undefined, token);
    }
    registerDocumentRangeFormattingEditProvider(extension, selector, provider) {
        const canFormatMultipleRanges = typeof provider.provideDocumentRangesFormattingEdits === 'function';
        const handle = this._addNewAdapter(new RangeFormattingAdapter(this._documents, provider), extension);
        this._proxy.$registerRangeFormattingSupport(handle, this._transformDocumentSelector(selector, extension), extension.identifier, extension.displayName || extension.name, canFormatMultipleRanges);
        return this._createDisposable(handle);
    }
    $provideDocumentRangeFormattingEdits(handle, resource, range, options, token) {
        return this._withAdapter(handle, RangeFormattingAdapter, adapter => adapter.provideDocumentRangeFormattingEdits(URI.revive(resource), range, options, token), undefined, token);
    }
    $provideDocumentRangesFormattingEdits(handle, resource, ranges, options, token) {
        return this._withAdapter(handle, RangeFormattingAdapter, adapter => adapter.provideDocumentRangesFormattingEdits(URI.revive(resource), ranges, options, token), undefined, token);
    }
    registerOnTypeFormattingEditProvider(extension, selector, provider, triggerCharacters) {
        const handle = this._addNewAdapter(new OnTypeFormattingAdapter(this._documents, provider), extension);
        this._proxy.$registerOnTypeFormattingSupport(handle, this._transformDocumentSelector(selector, extension), triggerCharacters, extension.identifier);
        return this._createDisposable(handle);
    }
    $provideOnTypeFormattingEdits(handle, resource, position, ch, options, token) {
        return this._withAdapter(handle, OnTypeFormattingAdapter, adapter => adapter.provideOnTypeFormattingEdits(URI.revive(resource), position, ch, options, token), undefined, token);
    }
    // --- navigate types
    registerWorkspaceSymbolProvider(extension, provider) {
        const handle = this._addNewAdapter(new NavigateTypeAdapter(provider, this._logService), extension);
        this._proxy.$registerNavigateTypeSupport(handle, typeof provider.resolveWorkspaceSymbol === 'function');
        return this._createDisposable(handle);
    }
    $provideWorkspaceSymbols(handle, search, token) {
        return this._withAdapter(handle, NavigateTypeAdapter, adapter => adapter.provideWorkspaceSymbols(search, token), { symbols: [] }, token);
    }
    $resolveWorkspaceSymbol(handle, symbol, token) {
        return this._withAdapter(handle, NavigateTypeAdapter, adapter => adapter.resolveWorkspaceSymbol(symbol, token), undefined, undefined);
    }
    $releaseWorkspaceSymbols(handle, id) {
        this._withAdapter(handle, NavigateTypeAdapter, adapter => adapter.releaseWorkspaceSymbols(id), undefined, undefined);
    }
    // --- rename
    registerRenameProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new RenameAdapter(this._documents, provider, this._logService), extension);
        this._proxy.$registerRenameSupport(handle, this._transformDocumentSelector(selector, extension), RenameAdapter.supportsResolving(provider));
        return this._createDisposable(handle);
    }
    $provideRenameEdits(handle, resource, position, newName, token) {
        return this._withAdapter(handle, RenameAdapter, adapter => adapter.provideRenameEdits(URI.revive(resource), position, newName, token), undefined, token);
    }
    $resolveRenameLocation(handle, resource, position, token) {
        return this._withAdapter(handle, RenameAdapter, adapter => adapter.resolveRenameLocation(URI.revive(resource), position, token), undefined, token);
    }
    registerNewSymbolNamesProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new NewSymbolNamesAdapter(this._documents, provider, this._logService), extension);
        this._proxy.$registerNewSymbolNamesProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $supportsAutomaticNewSymbolNamesTriggerKind(handle) {
        return this._withAdapter(handle, NewSymbolNamesAdapter, adapter => adapter.supportsAutomaticNewSymbolNamesTriggerKind(), false, undefined);
    }
    $provideNewSymbolNames(handle, resource, range, triggerKind, token) {
        return this._withAdapter(handle, NewSymbolNamesAdapter, adapter => adapter.provideNewSymbolNames(URI.revive(resource), range, triggerKind, token), undefined, token);
    }
    //#region semantic coloring
    registerDocumentSemanticTokensProvider(extension, selector, provider, legend) {
        const handle = this._addNewAdapter(new DocumentSemanticTokensAdapter(this._documents, provider), extension);
        const eventHandle = (typeof provider.onDidChangeSemanticTokens === 'function' ? this._nextHandle() : undefined);
        this._proxy.$registerDocumentSemanticTokensProvider(handle, this._transformDocumentSelector(selector, extension), legend, eventHandle);
        let result = this._createDisposable(handle);
        if (eventHandle) {
            const subscription = provider.onDidChangeSemanticTokens(_ => this._proxy.$emitDocumentSemanticTokensEvent(eventHandle));
            result = Disposable.from(result, subscription);
        }
        return result;
    }
    $provideDocumentSemanticTokens(handle, resource, previousResultId, token) {
        return this._withAdapter(handle, DocumentSemanticTokensAdapter, adapter => adapter.provideDocumentSemanticTokens(URI.revive(resource), previousResultId, token), null, token);
    }
    $releaseDocumentSemanticTokens(handle, semanticColoringResultId) {
        this._withAdapter(handle, DocumentSemanticTokensAdapter, adapter => adapter.releaseDocumentSemanticColoring(semanticColoringResultId), undefined, undefined);
    }
    registerDocumentRangeSemanticTokensProvider(extension, selector, provider, legend) {
        const handle = this._addNewAdapter(new DocumentRangeSemanticTokensAdapter(this._documents, provider), extension);
        this._proxy.$registerDocumentRangeSemanticTokensProvider(handle, this._transformDocumentSelector(selector, extension), legend);
        return this._createDisposable(handle);
    }
    $provideDocumentRangeSemanticTokens(handle, resource, range, token) {
        return this._withAdapter(handle, DocumentRangeSemanticTokensAdapter, adapter => adapter.provideDocumentRangeSemanticTokens(URI.revive(resource), range, token), null, token);
    }
    //#endregion
    // --- suggestion
    registerCompletionItemProvider(extension, selector, provider, triggerCharacters) {
        const handle = this._addNewAdapter(new CompletionsAdapter(this._documents, this._commands.converter, provider, this._apiDeprecation, extension), extension);
        this._proxy.$registerCompletionsProvider(handle, this._transformDocumentSelector(selector, extension), triggerCharacters, CompletionsAdapter.supportsResolving(provider), extension.identifier);
        return this._createDisposable(handle);
    }
    $provideCompletionItems(handle, resource, position, context, token) {
        return this._withAdapter(handle, CompletionsAdapter, adapter => adapter.provideCompletionItems(URI.revive(resource), position, context, token), undefined, token);
    }
    $resolveCompletionItem(handle, id, token) {
        return this._withAdapter(handle, CompletionsAdapter, adapter => adapter.resolveCompletionItem(id, token), undefined, token);
    }
    $releaseCompletionItems(handle, id) {
        this._withAdapter(handle, CompletionsAdapter, adapter => adapter.releaseCompletionItems(id), undefined, undefined);
    }
    // --- ghost text
    registerInlineCompletionsProvider(extension, selector, provider, metadata) {
        const eventHandle = typeof provider.onDidChange === 'function' && isProposedApiEnabled(extension, 'inlineCompletionsAdditions') ? this._nextHandle() : undefined;
        const adapter = new InlineCompletionAdapter(extension, this._documents, provider, this._commands.converter);
        const handle = this._addNewAdapter(adapter, extension);
        let result = this._createDisposable(handle);
        if (eventHandle !== undefined) {
            const subscription = provider.onDidChange(_ => this._proxy.$emitInlineCompletionsChange(eventHandle));
            result = Disposable.from(result, subscription);
        }
        this._proxy.$registerInlineCompletionsSupport(handle, this._transformDocumentSelector(selector, extension), adapter.supportsHandleEvents, ExtensionIdentifier.toKey(extension.identifier.value), metadata?.yieldTo?.map(extId => ExtensionIdentifier.toKey(extId)) || [], metadata?.displayName, metadata?.debounceDelayMs, eventHandle);
        return result;
    }
    $provideInlineCompletions(handle, resource, position, context, token) {
        return this._withAdapter(handle, InlineCompletionAdapter, adapter => adapter.provideInlineCompletions(URI.revive(resource), position, context, token), undefined, token);
    }
    $provideInlineEditsForRange(handle, resource, range, context, token) {
        return this._withAdapter(handle, InlineCompletionAdapter, adapter => adapter.provideInlineEditsForRange(URI.revive(resource), range, context, token), undefined, token);
    }
    $handleInlineCompletionDidShow(handle, pid, idx, updatedInsertText) {
        this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
            adapter.handleDidShowCompletionItem(pid, idx, updatedInsertText);
        }, undefined, undefined);
    }
    $handleInlineCompletionPartialAccept(handle, pid, idx, acceptedCharacters, info) {
        this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
            adapter.handlePartialAccept(pid, idx, acceptedCharacters, info);
        }, undefined, undefined);
    }
    $handleInlineCompletionEndOfLifetime(handle, pid, idx, reason) {
        this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
            adapter.handleEndOfLifetime(pid, idx, reason);
        }, undefined, undefined);
    }
    $handleInlineCompletionRejection(handle, pid, idx) {
        this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
            adapter.handleRejection(pid, idx);
        }, undefined, undefined);
    }
    $freeInlineCompletionsList(handle, pid) {
        this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => { adapter.disposeCompletions(pid); }, undefined, undefined);
    }
    // --- inline edit
    registerInlineEditProvider(extension, selector, provider) {
        const adapter = new InlineEditAdapter(extension, this._documents, provider, this._commands.converter);
        const handle = this._addNewAdapter(adapter, extension);
        this._proxy.$registerInlineEditProvider(handle, this._transformDocumentSelector(selector, extension), extension.identifier, provider.displayName || extension.name);
        return this._createDisposable(handle);
    }
    $provideInlineEdit(handle, resource, context, token) {
        return this._withAdapter(handle, InlineEditAdapter, adapter => adapter.provideInlineEdits(URI.revive(resource), context, token), undefined, token);
    }
    $freeInlineEdit(handle, pid) {
        this._withAdapter(handle, InlineEditAdapter, async (adapter) => { adapter.disposeEdit(pid); }, undefined, undefined);
    }
    // --- parameter hints
    registerSignatureHelpProvider(extension, selector, provider, metadataOrTriggerChars) {
        const metadata = Array.isArray(metadataOrTriggerChars)
            ? { triggerCharacters: metadataOrTriggerChars, retriggerCharacters: [] }
            : metadataOrTriggerChars;
        const handle = this._addNewAdapter(new SignatureHelpAdapter(this._documents, provider), extension);
        this._proxy.$registerSignatureHelpProvider(handle, this._transformDocumentSelector(selector, extension), metadata);
        return this._createDisposable(handle);
    }
    $provideSignatureHelp(handle, resource, position, context, token) {
        return this._withAdapter(handle, SignatureHelpAdapter, adapter => adapter.provideSignatureHelp(URI.revive(resource), position, context, token), undefined, token);
    }
    $releaseSignatureHelp(handle, id) {
        this._withAdapter(handle, SignatureHelpAdapter, adapter => adapter.releaseSignatureHelp(id), undefined, undefined);
    }
    // --- inline hints
    registerInlayHintsProvider(extension, selector, provider) {
        const eventHandle = typeof provider.onDidChangeInlayHints === 'function' ? this._nextHandle() : undefined;
        const handle = this._addNewAdapter(new InlayHintsAdapter(this._documents, this._commands.converter, provider, this._logService, extension), extension);
        this._proxy.$registerInlayHintsProvider(handle, this._transformDocumentSelector(selector, extension), typeof provider.resolveInlayHint === 'function', eventHandle, ExtHostLanguageFeatures._extLabel(extension));
        let result = this._createDisposable(handle);
        if (eventHandle !== undefined) {
            const subscription = provider.onDidChangeInlayHints(uri => this._proxy.$emitInlayHintsEvent(eventHandle));
            result = Disposable.from(result, subscription);
        }
        return result;
    }
    $provideInlayHints(handle, resource, range, token) {
        return this._withAdapter(handle, InlayHintsAdapter, adapter => adapter.provideInlayHints(URI.revive(resource), range, token), undefined, token);
    }
    $resolveInlayHint(handle, id, token) {
        return this._withAdapter(handle, InlayHintsAdapter, adapter => adapter.resolveInlayHint(id, token), undefined, token);
    }
    $releaseInlayHints(handle, id) {
        this._withAdapter(handle, InlayHintsAdapter, adapter => adapter.releaseHints(id), undefined, undefined);
    }
    // --- links
    registerDocumentLinkProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new LinkProviderAdapter(this._documents, provider), extension);
        this._proxy.$registerDocumentLinkProvider(handle, this._transformDocumentSelector(selector, extension), typeof provider.resolveDocumentLink === 'function');
        return this._createDisposable(handle);
    }
    $provideDocumentLinks(handle, resource, token) {
        return this._withAdapter(handle, LinkProviderAdapter, adapter => adapter.provideLinks(URI.revive(resource), token), undefined, token, resource.scheme === 'output');
    }
    $resolveDocumentLink(handle, id, token) {
        return this._withAdapter(handle, LinkProviderAdapter, adapter => adapter.resolveLink(id, token), undefined, undefined, true);
    }
    $releaseDocumentLinks(handle, id) {
        this._withAdapter(handle, LinkProviderAdapter, adapter => adapter.releaseLinks(id), undefined, undefined, true);
    }
    registerColorProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new ColorProviderAdapter(this._documents, provider), extension);
        this._proxy.$registerDocumentColorProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideDocumentColors(handle, resource, token) {
        return this._withAdapter(handle, ColorProviderAdapter, adapter => adapter.provideColors(URI.revive(resource), token), [], token);
    }
    $provideColorPresentations(handle, resource, colorInfo, token) {
        return this._withAdapter(handle, ColorProviderAdapter, adapter => adapter.provideColorPresentations(URI.revive(resource), colorInfo, token), undefined, token);
    }
    registerFoldingRangeProvider(extension, selector, provider) {
        const handle = this._nextHandle();
        const eventHandle = typeof provider.onDidChangeFoldingRanges === 'function' ? this._nextHandle() : undefined;
        this._adapter.set(handle, new AdapterData(new FoldingProviderAdapter(this._documents, provider), extension));
        this._proxy.$registerFoldingRangeProvider(handle, this._transformDocumentSelector(selector, extension), extension.identifier, eventHandle);
        let result = this._createDisposable(handle);
        if (eventHandle !== undefined) {
            const subscription = provider.onDidChangeFoldingRanges(() => this._proxy.$emitFoldingRangeEvent(eventHandle));
            result = Disposable.from(result, subscription);
        }
        return result;
    }
    $provideFoldingRanges(handle, resource, context, token) {
        return this._withAdapter(handle, FoldingProviderAdapter, (adapter) => adapter.provideFoldingRanges(URI.revive(resource), context, token), undefined, token);
    }
    // --- smart select
    registerSelectionRangeProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new SelectionRangeAdapter(this._documents, provider, this._logService), extension);
        this._proxy.$registerSelectionRangeProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $provideSelectionRanges(handle, resource, positions, token) {
        return this._withAdapter(handle, SelectionRangeAdapter, adapter => adapter.provideSelectionRanges(URI.revive(resource), positions, token), [], token);
    }
    // --- call hierarchy
    registerCallHierarchyProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new CallHierarchyAdapter(this._documents, provider), extension);
        this._proxy.$registerCallHierarchyProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $prepareCallHierarchy(handle, resource, position, token) {
        return this._withAdapter(handle, CallHierarchyAdapter, adapter => Promise.resolve(adapter.prepareSession(URI.revive(resource), position, token)), undefined, token);
    }
    $provideCallHierarchyIncomingCalls(handle, sessionId, itemId, token) {
        return this._withAdapter(handle, CallHierarchyAdapter, adapter => adapter.provideCallsTo(sessionId, itemId, token), undefined, token);
    }
    $provideCallHierarchyOutgoingCalls(handle, sessionId, itemId, token) {
        return this._withAdapter(handle, CallHierarchyAdapter, adapter => adapter.provideCallsFrom(sessionId, itemId, token), undefined, token);
    }
    $releaseCallHierarchy(handle, sessionId) {
        this._withAdapter(handle, CallHierarchyAdapter, adapter => Promise.resolve(adapter.releaseSession(sessionId)), undefined, undefined);
    }
    // --- type hierarchy
    registerTypeHierarchyProvider(extension, selector, provider) {
        const handle = this._addNewAdapter(new TypeHierarchyAdapter(this._documents, provider), extension);
        this._proxy.$registerTypeHierarchyProvider(handle, this._transformDocumentSelector(selector, extension));
        return this._createDisposable(handle);
    }
    $prepareTypeHierarchy(handle, resource, position, token) {
        return this._withAdapter(handle, TypeHierarchyAdapter, adapter => Promise.resolve(adapter.prepareSession(URI.revive(resource), position, token)), undefined, token);
    }
    $provideTypeHierarchySupertypes(handle, sessionId, itemId, token) {
        return this._withAdapter(handle, TypeHierarchyAdapter, adapter => adapter.provideSupertypes(sessionId, itemId, token), undefined, token);
    }
    $provideTypeHierarchySubtypes(handle, sessionId, itemId, token) {
        return this._withAdapter(handle, TypeHierarchyAdapter, adapter => adapter.provideSubtypes(sessionId, itemId, token), undefined, token);
    }
    $releaseTypeHierarchy(handle, sessionId) {
        this._withAdapter(handle, TypeHierarchyAdapter, adapter => Promise.resolve(adapter.releaseSession(sessionId)), undefined, undefined);
    }
    // --- Document on drop
    registerDocumentOnDropEditProvider(extension, selector, provider, metadata) {
        const handle = this._nextHandle();
        this._adapter.set(handle, new AdapterData(new DocumentDropEditAdapter(this._proxy, this._documents, provider, handle, extension), extension));
        this._proxy.$registerDocumentOnDropEditProvider(handle, this._transformDocumentSelector(selector, extension), metadata ? {
            supportsResolve: !!provider.resolveDocumentDropEdit,
            dropMimeTypes: metadata.dropMimeTypes,
            providedDropKinds: metadata.providedDropEditKinds?.map(x => x.value),
        } : undefined);
        return this._createDisposable(handle);
    }
    $provideDocumentOnDropEdits(handle, requestId, resource, position, dataTransferDto, token) {
        return this._withAdapter(handle, DocumentDropEditAdapter, adapter => Promise.resolve(adapter.provideDocumentOnDropEdits(requestId, URI.revive(resource), position, dataTransferDto, token)), undefined, undefined);
    }
    $resolveDropEdit(handle, id, token) {
        return this._withAdapter(handle, DocumentDropEditAdapter, adapter => adapter.resolveDropEdit(id, token), {}, undefined);
    }
    $releaseDocumentOnDropEdits(handle, cacheId) {
        this._withAdapter(handle, DocumentDropEditAdapter, adapter => Promise.resolve(adapter.releaseDropEdits(cacheId)), undefined, undefined);
    }
    // --- copy/paste actions
    registerDocumentPasteEditProvider(extension, selector, provider, metadata) {
        const handle = this._nextHandle();
        this._adapter.set(handle, new AdapterData(new DocumentPasteEditProvider(this._proxy, this._documents, provider, handle, extension), extension));
        this._proxy.$registerPasteEditProvider(handle, this._transformDocumentSelector(selector, extension), {
            supportsCopy: !!provider.prepareDocumentPaste,
            supportsPaste: !!provider.provideDocumentPasteEdits,
            supportsResolve: !!provider.resolveDocumentPasteEdit,
            providedPasteEditKinds: metadata.providedPasteEditKinds?.map(x => x.value),
            copyMimeTypes: metadata.copyMimeTypes,
            pasteMimeTypes: metadata.pasteMimeTypes,
        });
        return this._createDisposable(handle);
    }
    $prepareDocumentPaste(handle, resource, ranges, dataTransfer, token) {
        return this._withAdapter(handle, DocumentPasteEditProvider, adapter => adapter.prepareDocumentPaste(URI.revive(resource), ranges, dataTransfer, token), undefined, token);
    }
    $providePasteEdits(handle, requestId, resource, ranges, dataTransferDto, context, token) {
        return this._withAdapter(handle, DocumentPasteEditProvider, adapter => adapter.providePasteEdits(requestId, URI.revive(resource), ranges, dataTransferDto, context, token), undefined, token);
    }
    $resolvePasteEdit(handle, id, token) {
        return this._withAdapter(handle, DocumentPasteEditProvider, adapter => adapter.resolvePasteEdit(id, token), {}, undefined);
    }
    $releasePasteEdits(handle, cacheId) {
        this._withAdapter(handle, DocumentPasteEditProvider, adapter => Promise.resolve(adapter.releasePasteEdits(cacheId)), undefined, undefined);
    }
    // --- configuration
    static _serializeRegExp(regExp) {
        return {
            pattern: regExp.source,
            flags: regExp.flags,
        };
    }
    static _serializeIndentationRule(indentationRule) {
        return {
            decreaseIndentPattern: ExtHostLanguageFeatures._serializeRegExp(indentationRule.decreaseIndentPattern),
            increaseIndentPattern: ExtHostLanguageFeatures._serializeRegExp(indentationRule.increaseIndentPattern),
            indentNextLinePattern: indentationRule.indentNextLinePattern ? ExtHostLanguageFeatures._serializeRegExp(indentationRule.indentNextLinePattern) : undefined,
            unIndentedLinePattern: indentationRule.unIndentedLinePattern ? ExtHostLanguageFeatures._serializeRegExp(indentationRule.unIndentedLinePattern) : undefined,
        };
    }
    static _serializeOnEnterRule(onEnterRule) {
        return {
            beforeText: ExtHostLanguageFeatures._serializeRegExp(onEnterRule.beforeText),
            afterText: onEnterRule.afterText ? ExtHostLanguageFeatures._serializeRegExp(onEnterRule.afterText) : undefined,
            previousLineText: onEnterRule.previousLineText ? ExtHostLanguageFeatures._serializeRegExp(onEnterRule.previousLineText) : undefined,
            action: onEnterRule.action
        };
    }
    static _serializeOnEnterRules(onEnterRules) {
        return onEnterRules.map(ExtHostLanguageFeatures._serializeOnEnterRule);
    }
    static _serializeAutoClosingPair(autoClosingPair) {
        return {
            open: autoClosingPair.open,
            close: autoClosingPair.close,
            notIn: autoClosingPair.notIn ? autoClosingPair.notIn.map(v => SyntaxTokenType.toString(v)) : undefined,
        };
    }
    static _serializeAutoClosingPairs(autoClosingPairs) {
        return autoClosingPairs.map(ExtHostLanguageFeatures._serializeAutoClosingPair);
    }
    setLanguageConfiguration(extension, languageId, configuration) {
        const { wordPattern } = configuration;
        // check for a valid word pattern
        if (wordPattern && regExpLeadsToEndlessLoop(wordPattern)) {
            throw new Error(`Invalid language configuration: wordPattern '${wordPattern}' is not allowed to match the empty string.`);
        }
        // word definition
        if (wordPattern) {
            this._documents.setWordDefinitionFor(languageId, wordPattern);
        }
        else {
            this._documents.setWordDefinitionFor(languageId, undefined);
        }
        if (configuration.__electricCharacterSupport) {
            this._apiDeprecation.report('LanguageConfiguration.__electricCharacterSupport', extension, `Do not use.`);
        }
        if (configuration.__characterPairSupport) {
            this._apiDeprecation.report('LanguageConfiguration.__characterPairSupport', extension, `Do not use.`);
        }
        const handle = this._nextHandle();
        const serializedConfiguration = {
            comments: configuration.comments,
            brackets: configuration.brackets,
            wordPattern: configuration.wordPattern ? ExtHostLanguageFeatures._serializeRegExp(configuration.wordPattern) : undefined,
            indentationRules: configuration.indentationRules ? ExtHostLanguageFeatures._serializeIndentationRule(configuration.indentationRules) : undefined,
            onEnterRules: configuration.onEnterRules ? ExtHostLanguageFeatures._serializeOnEnterRules(configuration.onEnterRules) : undefined,
            __electricCharacterSupport: configuration.__electricCharacterSupport,
            __characterPairSupport: configuration.__characterPairSupport,
            autoClosingPairs: configuration.autoClosingPairs ? ExtHostLanguageFeatures._serializeAutoClosingPairs(configuration.autoClosingPairs) : undefined,
        };
        this._proxy.$setLanguageConfiguration(handle, languageId, serializedConfiguration);
        return this._createDisposable(handle);
    }
    $setWordDefinitions(wordDefinitions) {
        for (const wordDefinition of wordDefinitions) {
            this._documents.setWordDefinitionFor(wordDefinition.languageId, new RegExp(wordDefinition.regexSource, wordDefinition.regexFlags));
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUV0RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDckUsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUVqRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFNUQsT0FBTyxFQUFFLEtBQUssSUFBSSxXQUFXLEVBQVUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNwRixPQUFPLEVBQWMsU0FBUyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDakYsT0FBTyxLQUFLLFNB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