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
var MainThreadLanguageFeatures_1;
import { createStringDataTransferItem, VSDataTransfer } from '../../../base/common/dataTransfer.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { HierarchicalKind } from '../../../base/common/hierarchicalKind.js';
import { combinedDisposable, Disposable, DisposableMap, toDisposable } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { revive } from '../../../base/common/marshalling.js';
import { mixin } from '../../../base/common/objects.js';
import { URI } from '../../../base/common/uri.js';
import * as languages from '../../../editor/common/languages.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { ILanguageConfigurationService } from '../../../editor/common/languages/languageConfigurationRegistry.js';
import { ILanguageFeaturesService } from '../../../editor/common/services/languageFeatures.js';
import { decodeSemanticTokensDto } from '../../../editor/common/services/semanticTokensDto.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
import { reviveWorkspaceEditDto } from './mainThreadBulkEdits.js';
import * as typeConvert from '../common/extHostTypeConverters.js';
import { DataTransferFileCache } from '../common/shared/dataTransferCache.js';
import * as callh from '../../contrib/callHierarchy/common/callHierarchy.js';
import * as search from '../../contrib/search/common/search.js';
import * as typeh from '../../contrib/typeHierarchy/common/typeHierarchy.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
let MainThreadLanguageFeatures = MainThreadLanguageFeatures_1 = class MainThreadLanguageFeatures extends Disposable {
    constructor(extHostContext, _languageService, _languageConfigurationService, _languageFeaturesService, _uriIdentService) {
        super();
        this._languageService = _languageService;
        this._languageConfigurationService = _languageConfigurationService;
        this._languageFeaturesService = _languageFeaturesService;
        this._uriIdentService = _uriIdentService;
        this._registrations = this._register(new DisposableMap());
        // --- copy paste action provider
        this._pasteEditProviders = new Map();
        // --- document drop Edits
        this._documentOnDropEditProviders = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageFeatures);
        if (this._languageService) {
            const updateAllWordDefinitions = () => {
                const wordDefinitionDtos = [];
                for (const languageId of _languageService.getRegisteredLanguageIds()) {
                    const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(languageId).getWordDefinition();
                    wordDefinitionDtos.push({
                        languageId: languageId,
                        regexSource: wordDefinition.source,
                        regexFlags: wordDefinition.flags
                    });
                }
                this._proxy.$setWordDefinitions(wordDefinitionDtos);
            };
            this._register(this._languageConfigurationService.onDidChange((e) => {
                if (!e.languageId) {
                    updateAllWordDefinitions();
                }
                else {
                    const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(e.languageId).getWordDefinition();
                    this._proxy.$setWordDefinitions([{
                            languageId: e.languageId,
                            regexSource: wordDefinition.source,
                            regexFlags: wordDefinition.flags
                        }]);
                }
            }));
            updateAllWordDefinitions();
        }
    }
    $unregister(handle) {
        this._registrations.deleteAndDispose(handle);
    }
    static _reviveLocationDto(data) {
        if (!data) {
            return data;
        }
        else if (Array.isArray(data)) {
            data.forEach(l => MainThreadLanguageFeatures_1._reviveLocationDto(l));
            return data;
        }
        else {
            data.uri = URI.revive(data.uri);
            return data;
        }
    }
    static _reviveLocationLinkDto(data) {
        if (!data) {
            return data;
        }
        else if (Array.isArray(data)) {
            data.forEach(l => MainThreadLanguageFeatures_1._reviveLocationLinkDto(l));
            return data;
        }
        else {
            data.uri = URI.revive(data.uri);
            return data;
        }
    }
    static _reviveWorkspaceSymbolDto(data) {
        if (!data) {
            return data;
        }
        else if (Array.isArray(data)) {
            data.forEach(MainThreadLanguageFeatures_1._reviveWorkspaceSymbolDto);
            return data;
        }
        else {
            data.location = MainThreadLanguageFeatures_1._reviveLocationDto(data.location);
            return data;
        }
    }
    static _reviveCodeActionDto(data, uriIdentService) {
        data?.forEach(code => reviveWorkspaceEditDto(code.edit, uriIdentService));
        return data;
    }
    static _reviveLinkDTO(data) {
        if (data.url && typeof data.url !== 'string') {
            data.url = URI.revive(data.url);
        }
        return data;
    }
    static _reviveCallHierarchyItemDto(data) {
        if (data) {
            data.uri = URI.revive(data.uri);
        }
        return data;
    }
    static _reviveTypeHierarchyItemDto(data) {
        if (data) {
            data.uri = URI.revive(data.uri);
        }
        return data;
    }
    //#endregion
    // --- outline
    $registerDocumentSymbolProvider(handle, selector, displayName) {
        this._registrations.set(handle, this._languageFeaturesService.documentSymbolProvider.register(selector, {
            displayName,
            provideDocumentSymbols: (model, token) => {
                return this._proxy.$provideDocumentSymbols(handle, model.uri, token);
            }
        }));
    }
    // --- code lens
    $registerCodeLensSupport(handle, selector, eventHandle) {
        const provider = {
            provideCodeLenses: async (model, token) => {
                const listDto = await this._proxy.$provideCodeLenses(handle, model.uri, token);
                if (!listDto) {
                    return undefined;
                }
                return {
                    lenses: listDto.lenses,
                    dispose: () => listDto.cacheId && this._proxy.$releaseCodeLenses(handle, listDto.cacheId)
                };
            },
            resolveCodeLens: async (model, codeLens, token) => {
                const result = await this._proxy.$resolveCodeLens(handle, codeLens, token);
                if (!result) {
                    return undefined;
                }
                return {
                    ...result,
                    range: model.validateRange(result.range),
                };
            }
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChange = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.codeLensProvider.register(selector, provider));
    }
    $emitCodeLensEvent(eventHandle, event) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    // --- declaration
    $registerDefinitionSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.definitionProvider.register(selector, {
            provideDefinition: (model, position, token) => {
                return this._proxy.$provideDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    $registerDeclarationSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.declarationProvider.register(selector, {
            provideDeclaration: (model, position, token) => {
                return this._proxy.$provideDeclaration(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    $registerImplementationSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.implementationProvider.register(selector, {
            provideImplementation: (model, position, token) => {
                return this._proxy.$provideImplementation(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    $registerTypeDefinitionSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.typeDefinitionProvider.register(selector, {
            provideTypeDefinition: (model, position, token) => {
                return this._proxy.$provideTypeDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    // --- extra info
    $registerHoverProvider(handle, selector) {
        /*
        const hoverFinalizationRegistry = new FinalizationRegistry((hoverId: number) => {
            this._proxy.$releaseHover(handle, hoverId);
        });
        */
        this._registrations.set(handle, this._languageFeaturesService.hoverProvider.register(selector, {
            provideHover: async (model, position, token, context) => {
                const serializedContext = {
                    verbosityRequest: context?.verbosityRequest ? {
                        verbosityDelta: context.verbosityRequest.verbosityDelta,
                        previousHover: { id: context.verbosityRequest.previousHover.id }
                    } : undefined,
                };
                const hover = await this._proxy.$provideHover(handle, model.uri, position, serializedContext, token);
                // hoverFinalizationRegistry.register(hover, hover.id);
                return hover;
            }
        }));
    }
    // --- debug hover
    $registerEvaluatableExpressionProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.evaluatableExpressionProvider.register(selector, {
            provideEvaluatableExpression: (model, position, token) => {
                return this._proxy.$provideEvaluatableExpression(handle, model.uri, position, token);
            }
        }));
    }
    // --- inline values
    $registerInlineValuesProvider(handle, selector, eventHandle) {
        const provider = {
            provideInlineValues: (model, viewPort, context, token) => {
                return this._proxy.$provideInlineValues(handle, model.uri, viewPort, context, token);
            }
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChangeInlineValues = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.inlineValuesProvider.register(selector, provider));
    }
    $emitInlineValuesEvent(eventHandle, event) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    // --- occurrences
    $registerDocumentHighlightProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.documentHighlightProvider.register(selector, {
            provideDocumentHighlights: (model, position, token) => {
                return this._proxy.$provideDocumentHighlights(handle, model.uri, position, token);
            }
        }));
    }
    $registerMultiDocumentHighlightProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.multiDocumentHighlightProvider.register(selector, {
            selector: selector,
            provideMultiDocumentHighlights: (model, position, otherModels, token) => {
                return this._proxy.$provideMultiDocumentHighlights(handle, model.uri, position, otherModels.map(model => model.uri), token).then(dto => {
                    // dto should be non-null + non-undefined
                    // dto length of 0 is valid, just no highlights, pass this through.
                    if (dto === undefined || dto === null) {
                        return undefined;
                    }
                    const result = new ResourceMap();
                    dto?.forEach(value => {
                        // check if the URI exists already, if so, combine the highlights, otherwise create a new entry
                        const uri = URI.revive(value.uri);
                        if (result.has(uri)) {
                            result.get(uri).push(...value.highlights);
                        }
                        else {
                            result.set(uri, value.highlights);
                        }
                    });
                    return result;
                });
            }
        }));
    }
    // --- linked editing
    $registerLinkedEditingRangeProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.linkedEditingRangeProvider.register(selector, {
            provideLinkedEditingRanges: async (model, position, token) => {
                const res = await this._proxy.$provideLinkedEditingRanges(handle, model.uri, position, token);
                if (res) {
                    return {
                        ranges: res.ranges,
                        wordPattern: res.wordPattern ? MainThreadLanguageFeatures_1._reviveRegExp(res.wordPattern) : undefined
                    };
                }
                return undefined;
            }
        }));
    }
    // --- references
    $registerReferenceSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.referenceProvider.register(selector, {
            provideReferences: (model, position, context, token) => {
                return this._proxy.$provideReferences(handle, model.uri, position, context, token).then(MainThreadLanguageFeatures_1._reviveLocationDto);
            }
        }));
    }
    // --- code actions
    $registerCodeActionSupport(handle, selector, metadata, displayName, extensionId, supportsResolve) {
        const provider = {
            provideCodeActions: async (model, rangeOrSelection, context, token) => {
                const listDto = await this._proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, context, token);
                if (!listDto) {
                    return undefined;
                }
                return {
                    actions: MainThreadLanguageFeatures_1._reviveCodeActionDto(listDto.actions, this._uriIdentService),
                    dispose: () => {
                        if (typeof listDto.cacheId === 'number') {
                            this._proxy.$releaseCodeActions(handle, listDto.cacheId);
                        }
                    }
                };
            },
            providedCodeActionKinds: metadata.providedKinds,
            documentation: metadata.documentation,
            displayName,
            extensionId,
        };
        if (supportsResolve) {
            provider.resolveCodeAction = async (codeAction, token) => {
                const resolved = await this._proxy.$resolveCodeAction(handle, codeAction.cacheId, token);
                if (resolved.edit) {
                    codeAction.edit = reviveWorkspaceEditDto(resolved.edit, this._uriIdentService);
                }
                if (resolved.command) {
                    codeAction.command = resolved.command;
                }
                return codeAction;
            };
        }
        this._registrations.set(handle, this._languageFeaturesService.codeActionProvider.register(selector, provider));
    }
    $registerPasteEditProvider(handle, selector, metadata) {
        const provider = new MainThreadPasteEditProvider(handle, this._proxy, metadata, this._uriIdentService);
        this._pasteEditProviders.set(handle, provider);
        this._registrations.set(handle, combinedDisposable(this._languageFeaturesService.documentPasteEditProvider.register(selector, provider), toDisposable(() => this._pasteEditProviders.delete(handle))));
    }
    $resolvePasteFileData(handle, requestId, dataId) {
        const provider = this._pasteEditProviders.get(handle);
        if (!provider) {
            throw new Error('Could not find provider');
        }
        return provider.resolveFileData(requestId, dataId);
    }
    // --- formatting
    $registerDocumentFormattingSupport(handle, selector, extensionId, displayName) {
        this._registrations.set(handle, this._languageFeaturesService.documentFormattingEditProvider.register(selector, {
            extensionId,
            displayName,
            provideDocumentFormattingEdits: (model, options, token) => {
                return this._proxy.$provideDocumentFormattingEdits(handle, model.uri, options, token);
            }
        }));
    }
    $registerRangeFormattingSupport(handle, selector, extensionId, displayName, supportsRanges) {
        this._registrations.set(handle, this._languageFeaturesService.documentRangeFormattingEditProvider.register(selector, {
            extensionId,
            displayName,
            provideDocumentRangeFormattingEdits: (model, range, options, token) => {
                return this._proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options, token);
            },
            provideDocumentRangesFormattingEdits: !supportsRanges
                ? undefined
                : (model, ranges, options, token) => {
                    return this._proxy.$provideDocumentRangesFormattingEdits(handle, model.uri, ranges, options, token);
                },
        }));
    }
    $registerOnTypeFormattingSupport(handle, selector, autoFormatTriggerCharacters, extensionId) {
        this._registrations.set(handle, this._languageFeaturesService.onTypeFormattingEditProvider.register(selector, {
            extensionId,
            autoFormatTriggerCharacters,
            provideOnTypeFormattingEdits: (model, position, ch, options, token) => {
                return this._proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options, token);
            }
        }));
    }
    // --- navigate type
    $registerNavigateTypeSupport(handle, supportsResolve) {
        let lastResultId;
        const provider = {
            provideWorkspaceSymbols: async (search, token) => {
                const result = await this._proxy.$provideWorkspaceSymbols(handle, search, token);
                if (lastResultId !== undefined) {
                    this._proxy.$releaseWorkspaceSymbols(handle, lastResultId);
                }
                lastResultId = result.cacheId;
                return MainThreadLanguageFeatures_1._reviveWorkspaceSymbolDto(result.symbols);
            }
        };
        if (supportsResolve) {
            provider.resolveWorkspaceSymbol = async (item, token) => {
                const resolvedItem = await this._proxy.$resolveWorkspaceSymbol(handle, item, token);
                return resolvedItem && MainThreadLanguageFeatures_1._reviveWorkspaceSymbolDto(resolvedItem);
            };
        }
        this._registrations.set(handle, search.WorkspaceSymbolProviderRegistry.register(provider));
    }
    // --- rename
    $registerRenameSupport(handle, selector, supportResolveLocation) {
        this._registrations.set(handle, this._languageFeaturesService.renameProvider.register(selector, {
            provideRenameEdits: (model, position, newName, token) => {
                return this._proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then(data => reviveWorkspaceEditDto(data, this._uriIdentService));
            },
            resolveRenameLocation: supportResolveLocation
                ? (model, position, token) => this._proxy.$resolveRenameLocation(handle, model.uri, position, token)
                : undefined
        }));
    }
    $registerNewSymbolNamesProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.newSymbolNamesProvider.register(selector, {
            supportsAutomaticNewSymbolNamesTriggerKind: this._proxy.$supportsAutomaticNewSymbolNamesTriggerKind(handle),
            provideNewSymbolNames: (model, range, triggerKind, token) => {
                return this._proxy.$provideNewSymbolNames(handle, model.uri, range, triggerKind, token);
            }
        }));
    }
    // --- semantic tokens
    $registerDocumentSemanticTokensProvider(handle, selector, legend, eventHandle) {
        let event = undefined;
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            event = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.documentSemanticTokensProvider.register(selector, new MainThreadDocumentSemanticTokensProvider(this._proxy, handle, legend, event)));
    }
    $emitDocumentSemanticTokensEvent(eventHandle) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    $registerDocumentRangeSemanticTokensProvider(handle, selector, legend) {
        this._registrations.set(handle, this._languageFeaturesService.documentRangeSemanticTokensProvider.register(selector, new MainThreadDocumentRangeSemanticTokensProvider(this._proxy, handle, legend)));
    }
    // --- suggest
    static _inflateSuggestDto(defaultRange, data, extensionId) {
        const label = data["a" /* ISuggestDataDtoField.label */];
        const commandId = data["o" /* ISuggestDataDtoField.commandId */];
        const commandIdent = data["n" /* ISuggestDataDtoField.commandIdent */];
        const commitChars = data["k" /* ISuggestDataDtoField.commitCharacters */];
        let command;
        if (commandId) {
            command = {
                $ident: commandIdent,
                id: commandId,
                title: '',
                arguments: commandIdent ? [commandIdent] : data["p" /* ISuggestDataDtoField.commandArguments */], // Automatically fill in ident as first argument
            };
        }
        return {
            label,
            extensionId,
            kind: data["b" /* ISuggestDataDtoField.kind */] ?? 9 /* languages.CompletionItemKind.Property */,
            tags: data["m" /* ISuggestDataDtoField.kindModifier */],
            detail: data["c" /* ISuggestDataDtoField.detail */],
            documentation: data["d" /* ISuggestDataDtoField.documentation */],
            sortText: data["e" /* ISuggestDataDtoField.sortText */],
            filterText: data["f" /* ISuggestDataDtoField.filterText */],
            preselect: data["g" /* ISuggestDataDtoField.preselect */],
            insertText: data["h" /* ISuggestDataDtoField.insertText */] ?? (typeof label === 'string' ? label : label.label),
            range: data["j" /* ISuggestDataDtoField.range */] ?? defaultRange,
            insertTextRules: data["i" /* ISuggestDataDtoField.insertTextRules */],
            commitCharacters: commitChars ? Array.from(commitChars) : undefined,
            additionalTextEdits: data["l" /* ISuggestDataDtoField.additionalTextEdits */],
            command,
            // not-standard
            _id: data.x,
        };
    }
    $registerCompletionsProvider(handle, selector, triggerCharacters, supportsResolveDetails, extensionId) {
        const provider = {
            triggerCharacters,
            _debugDisplayName: `${extensionId.value}(${triggerCharacters.join('')})`,
            provideCompletionItems: async (model, position, context, token) => {
                const result = await this._proxy.$provideCompletionItems(handle, model.uri, position, context, token);
                if (!result) {
                    return result;
                }
                return {
                    suggestions: result["b" /* ISuggestResultDtoField.completions */].map(d => MainThreadLanguageFeatures_1._inflateSuggestDto(result["a" /* ISuggestResultDtoField.defaultRanges */], d, extensionId)),
                    incomplete: result["c" /* ISuggestResultDtoField.isIncomplete */] || false,
                    duration: result["d" /* ISuggestResultDtoField.duration */],
                    dispose: () => {
                        if (typeof result.x === 'number') {
                            this._proxy.$releaseCompletionItems(handle, result.x);
                        }
                    }
                };
            }
        };
        if (supportsResolveDetails) {
            provider.resolveCompletionItem = (suggestion, token) => {
                return this._proxy.$resolveCompletionItem(handle, suggestion._id, token).then(result => {
                    if (!result) {
                        return suggestion;
                    }
                    const newSuggestion = MainThreadLanguageFeatures_1._inflateSuggestDto(suggestion.range, result, extensionId);
                    return mixin(suggestion, newSuggestion, true);
                });
            };
        }
        this._registrations.set(handle, this._languageFeaturesService.completionProvider.register(selector, provider));
    }
    $registerInlineCompletionsSupport(handle, selector, supportsHandleEvents, extensionId, yieldsToExtensionIds, displayName, debounceDelayMs, eventHandle) {
        const provider = {
            provideInlineCompletions: async (model, position, context, token) => {
                return this._proxy.$provideInlineCompletions(handle, model.uri, position, context, token);
            },
            provideInlineEditsForRange: async (model, range, context, token) => {
                return this._proxy.$provideInlineEditsForRange(handle, model.uri, range, context, token);
            },
            handleItemDidShow: async (completions, item, updatedInsertText) => {
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionDidShow(handle, completions.pid, item.idx, updatedInsertText);
                }
            },
            handlePartialAccept: async (completions, item, acceptedCharacters, info) => {
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionPartialAccept(handle, completions.pid, item.idx, acceptedCharacters, info);
                }
            },
            handleEndOfLifetime: async (completions, item, reason) => {
                function mapReason(reason, f) {
                    if (reason.kind === languages.InlineCompletionEndOfLifeReasonKind.Ignored) {
                        return {
                            ...reason,
                            supersededBy: reason.supersededBy ? f(reason.supersededBy) : undefined,
                        };
                    }
                    return reason;
                }
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionEndOfLifetime(handle, completions.pid, item.idx, mapReason(reason, i => ({ pid: completions.pid, idx: i.idx })));
                }
            },
            freeInlineCompletions: (completions) => {
                this._proxy.$freeInlineCompletionsList(handle, completions.pid);
            },
            handleRejection: async (completions, item) => {
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionRejection(handle, completions.pid, item.idx);
                }
            },
            groupId: extensionId,
            yieldsToGroupIds: yieldsToExtensionIds,
            debounceDelayMs,
            displayName,
            toString() {
                return `InlineCompletionsProvider(${extensionId})`;
            },
        };
        this._registrations.set(handle, this._languageFeaturesService.inlineCompletionsProvider.register(selector, provider));
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChangeInlineCompletions = emitter.event;
        }
    }
    $emitInlineCompletionsChange(handle) {
        const obj = this._registrations.get(handle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    $registerInlineEditProvider(handle, selector, extensionId, displayName) {
        const provider = {
            displayName,
            provideInlineEdit: async (model, context, token) => {
                return this._proxy.$provideInlineEdit(handle, model.uri, context, token);
            },
            freeInlineEdit: (edit) => {
                this._proxy.$freeInlineEdit(handle, edit.pid);
            }
        };
        this._registrations.set(handle, this._languageFeaturesService.inlineEditProvider.register(selector, provider));
    }
    // --- parameter hints
    $registerSignatureHelpProvider(handle, selector, metadata) {
        this._registrations.set(handle, this._languageFeaturesService.signatureHelpProvider.register(selector, {
            signatureHelpTriggerCharacters: metadata.triggerCharacters,
            signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
            provideSignatureHelp: async (model, position, token, context) => {
                const result = await this._proxy.$provideSignatureHelp(handle, model.uri, position, context, token);
                if (!result) {
                    return undefined;
                }
                return {
                    value: result,
                    dispose: () => {
                        this._proxy.$releaseSignatureHelp(handle, result.id);
                    }
                };
            }
        }));
    }
    // --- inline hints
    $registerInlayHintsProvider(handle, selector, supportsResolve, eventHandle, displayName) {
        const provider = {
            displayName,
            provideInlayHints: async (model, range, token) => {
                const result = await this._proxy.$provideInlayHints(handle, model.uri, range, token);
                if (!result) {
                    return;
                }
                return {
                    hints: revive(result.hints),
                    dispose: () => {
                        if (result.cacheId) {
                            this._proxy.$releaseInlayHints(handle, result.cacheId);
                        }
                    }
                };
            }
        };
        if (supportsResolve) {
            provider.resolveInlayHint = async (hint, token) => {
                const dto = hint;
                if (!dto.cacheId) {
                    return hint;
                }
                const result = await this._proxy.$resolveInlayHint(handle, dto.cacheId, token);
                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }
                if (!result) {
                    return hint;
                }
                return {
                    ...hint,
                    tooltip: result.tooltip,
                    label: revive(result.label),
                    textEdits: result.textEdits
                };
            };
        }
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChangeInlayHints = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.inlayHintsProvider.register(selector, provider));
    }
    $emitInlayHintsEvent(eventHandle) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    // --- links
    $registerDocumentLinkProvider(handle, selector, supportsResolve) {
        const provider = {
            provideLinks: (model, token) => {
                return this._proxy.$provideDocumentLinks(handle, model.uri, token).then(dto => {
                    if (!dto) {
                        return undefined;
                    }
                    return {
                        links: dto.links.map(MainThreadLanguageFeatures_1._reviveLinkDTO),
                        dispose: () => {
                            if (typeof dto.cacheId === 'number') {
                                this._proxy.$releaseDocumentLinks(handle, dto.cacheId);
                            }
                        }
                    };
                });
            }
        };
        if (supportsResolve) {
            provider.resolveLink = (link, token) => {
                const dto = link;
                if (!dto.cacheId) {
                    return link;
                }
                return this._proxy.$resolveDocumentLink(handle, dto.cacheId, token).then(obj => {
                    return obj && MainThreadLanguageFeatures_1._reviveLinkDTO(obj);
                });
            };
        }
        this._registrations.set(handle, this._languageFeaturesService.linkProvider.register(selector, provider));
    }
    // --- colors
    $registerDocumentColorProvider(handle, selector) {
        const proxy = this._proxy;
        this._registrations.set(handle, this._languageFeaturesService.colorProvider.register(selector, {
            provideDocumentColors: (model, token) => {
                return proxy.$provideDocumentColors(handle, model.uri, token)
                    .then(documentColors => {
                    return documentColors.map(documentColor => {
                        const [red, green, blue, alpha] = documentColor.color;
                        const color = {
                            red: red,
                            green: green,
                            blue: blue,
                            alpha
                        };
                        return {
                            color,
                            range: documentColor.range
                        };
                    });
                });
            },
            provideColorPresentations: (model, colorInfo, token) => {
                return proxy.$provideColorPresentations(handle, model.uri, {
                    color: [colorInfo.color.red, colorInfo.color.green, colorInfo.color.blue, colorInfo.color.alpha],
                    range: colorInfo.range
                }, token);
            }
        }));
    }
    // --- folding
    $registerFoldingRangeProvider(handle, selector, extensionId, eventHandle) {
        const provider = {
            id: extensionId.value,
            provideFoldingRanges: (model, context, token) => {
                return this._proxy.$provideFoldingRanges(handle, model.uri, context, token);
            }
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChange = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.foldingRangeProvider.register(selector, provider));
    }
    $emitFoldingRangeEvent(eventHandle, event) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    // -- smart select
    $registerSelectionRangeProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.selectionRangeProvider.register(selector, {
            provideSelectionRanges: (model, positions, token) => {
                return this._proxy.$provideSelectionRanges(handle, model.uri, positions, token);
            }
        }));
    }
    // --- call hierarchy
    $registerCallHierarchyProvider(handle, selector) {
        this._registrations.set(handle, callh.CallHierarchyProviderRegistry.register(selector, {
            prepareCallHierarchy: async (document, position, token) => {
                const items = await this._proxy.$prepareCallHierarchy(handle, document.uri, position, token);
                if (!items || items.length === 0) {
                    return undefined;
                }
                return {
                    dispose: () => {
                        for (const item of items) {
                            this._proxy.$releaseCallHierarchy(handle, item._sessionId);
                        }
                    },
                    roots: items.map(MainThreadLanguageFeatures_1._reviveCallHierarchyItemDto)
                };
            },
            provideOutgoingCalls: async (item, token) => {
                const outgoing = await this._proxy.$provideCallHierarchyOutgoingCalls(handle, item._sessionId, item._itemId, token);
                if (!outgoing) {
                    return outgoing;
                }
                outgoing.forEach(value => {
                    value.to = MainThreadLanguageFeatures_1._reviveCallHierarchyItemDto(value.to);
                });
                return outgoing;
            },
            provideIncomingCalls: async (item, token) => {
                const incoming = await this._proxy.$provideCallHierarchyIncomingCalls(handle, item._sessionId, item._itemId, token);
                if (!incoming) {
                    return incoming;
                }
                incoming.forEach(value => {
                    value.from = MainThreadLanguageFeatures_1._reviveCallHierarchyItemDto(value.from);
                });
                return incoming;
            }
        }));
    }
    // --- configuration
    static _reviveRegExp(regExp) {
        return new RegExp(regExp.pattern, regExp.flags);
    }
    static _reviveIndentationRule(indentationRule) {
        return {
            decreaseIndentPattern: MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.decreaseIndentPattern),
            increaseIndentPattern: MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.increaseIndentPattern),
            indentNextLinePattern: indentationRule.indentNextLinePattern ? MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.indentNextLinePattern) : undefined,
            unIndentedLinePattern: indentationRule.unIndentedLinePattern ? MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.unIndentedLinePattern) : undefined,
        };
    }
    static _reviveOnEnterRule(onEnterRule) {
        return {
            beforeText: MainThreadLanguageFeatures_1._reviveRegExp(onEnterRule.beforeText),
            afterText: onEnterRule.afterText ? MainThreadLanguageFeatures_1._reviveRegExp(onEnterRule.afterText) : undefined,
            previousLineText: onEnterRule.previousLineText ? MainThreadLanguageFeatures_1._reviveRegExp(onEnterRule.previousLineText) : undefined,
            action: onEnterRule.action
        };
    }
    static _reviveOnEnterRules(onEnterRules) {
        return onEnterRules.map(MainThreadLanguageFeatures_1._reviveOnEnterRule);
    }
    $setLanguageConfiguration(handle, languageId, _configuration) {
        const configuration = {
            comments: _configuration.comments,
            brackets: _configuration.brackets,
            wordPattern: _configuration.wordPattern ? MainThreadLanguageFeatures_1._reviveRegExp(_configuration.wordPattern) : undefined,
            indentationRules: _configuration.indentationRules ? MainThreadLanguageFeatures_1._reviveIndentationRule(_configuration.indentationRules) : undefined,
            onEnterRules: _configuration.onEnterRules ? MainThreadLanguageFeatures_1._reviveOnEnterRules(_configuration.onEnterRules) : undefined,
            autoClosingPairs: undefined,
            surroundingPairs: undefined,
            __electricCharacterSupport: undefined
        };
        if (_configuration.autoClosingPairs) {
            configuration.autoClosingPairs = _configuration.autoClosingPairs;
        }
        else if (_configuration.__characterPairSupport) {
            // backwards compatibility
            configuration.autoClosingPairs = _configuration.__characterPairSupport.autoClosingPairs;
        }
        if (_configuration.__electricCharacterSupport && _configuration.__electricCharacterSupport.docComment) {
            configuration.__electricCharacterSupport = {
                docComment: {
                    open: _configuration.__electricCharacterSupport.docComment.open,
                    close: _configuration.__electricCharacterSupport.docComment.close
                }
            };
        }
        if (this._languageService.isRegisteredLanguageId(languageId)) {
            this._registrations.set(handle, this._languageConfigurationService.register(languageId, configuration, 100));
        }
    }
    // --- type hierarchy
    $registerTypeHierarchyProvider(handle, selector) {
        this._registrations.set(handle, typeh.TypeHierarchyProviderRegistry.register(selector, {
            prepareTypeHierarchy: async (document, position, token) => {
                const items = await this._proxy.$prepareTypeHierarchy(handle, document.uri, position, token);
                if (!items) {
                    return undefined;
                }
                return {
                    dispose: () => {
                        for (const item of items) {
                            this._proxy.$releaseTypeHierarchy(handle, item._sessionId);
                        }
                    },
                    roots: items.map(MainThreadLanguageFeatures_1._reviveTypeHierarchyItemDto)
                };
            },
            provideSupertypes: async (item, token) => {
                const supertypes = await this._proxy.$provideTypeHierarchySupertypes(handle, item._sessionId, item._itemId, token);
                if (!supertypes) {
                    return supertypes;
                }
                return supertypes.map(MainThreadLanguageFeatures_1._reviveTypeHierarchyItemDto);
            },
            provideSubtypes: async (item, token) => {
                const subtypes = await this._proxy.$provideTypeHierarchySubtypes(handle, item._sessionId, item._itemId, token);
                if (!subtypes) {
                    return subtypes;
                }
                return subtypes.map(MainThreadLanguageFeatures_1._reviveTypeHierarchyItemDto);
            }
        }));
    }
    $registerDocumentOnDropEditProvider(handle, selector, metadata) {
        const provider = new MainThreadDocumentOnDropEditProvider(handle, this._proxy, metadata, this._uriIdentService);
        this._documentOnDropEditProviders.set(handle, provider);
        this._registrations.set(handle, combinedDisposable(this._languageFeaturesService.documentDropEditProvider.register(selector, provider), toDisposable(() => this._documentOnDropEditProviders.delete(handle))));
    }
    async $resolveDocumentOnDropFileData(handle, requestId, dataId) {
        const provider = this._documentOnDropEditProviders.get(handle);
        if (!provider) {
            throw new Error('Could not find provider');
        }
        return provider.resolveDocumentOnDropFileData(requestId, dataId);
    }
};
MainThreadLanguageFeatures = MainThreadLanguageFeatures_1 = __decorate([
    extHostNamedCustomer(MainContext.MainThreadLanguageFeatures),
    __param(1, ILanguageService),
    __param(2, ILanguageConfigurationService),
    __param(3, ILanguageFeaturesService),
    __param(4, IUriIdentityService)
], MainThreadLanguageFeatures);
export { MainThreadLanguageFeatures };
let MainThreadPasteEditProvider = class MainThreadPasteEditProvider {
    constructor(_handle, _proxy, metadata, _uriIdentService) {
        this._handle = _handle;
        this._proxy = _proxy;
        this._uriIdentService = _uriIdentService;
        this.dataTransfers = new DataTransferFileCache();
        this.copyMimeTypes = metadata.copyMimeTypes ?? [];
        this.pasteMimeTypes = metadata.pasteMimeTypes ?? [];
        this.providedPasteEditKinds = metadata.providedPasteEditKinds?.map(kind => new HierarchicalKind(kind)) ?? [];
        if (metadata.supportsCopy) {
            this.prepareDocumentPaste = async (model, selections, dataTransfer, token) => {
                const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
                if (token.isCancellationRequested) {
                    return undefined;
                }
                const newDataTransfer = await this._proxy.$prepareDocumentPaste(_handle, model.uri, selections, dataTransferDto, token);
                if (!newDataTransfer) {
                    return undefined;
                }
                const dataTransferOut = new VSDataTransfer();
                for (const [type, item] of newDataTransfer.items) {
                    dataTransferOut.replace(type, createStringDataTransferItem(item.asString, item.id));
                }
                return dataTransferOut;
            };
        }
        if (metadata.supportsPaste) {
            this.provideDocumentPasteEdits = async (model, selections, dataTransfer, context, token) => {
                const request = this.dataTransfers.add(dataTransfer);
                try {
                    const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
                    if (token.isCancellationRequested) {
                        return;
                    }
                    const edits = await this._proxy.$providePasteEdits(this._handle, request.id, model.uri, selections, dataTransferDto, {
                        only: context.only?.value,
                        triggerKind: context.triggerKind,
                    }, token);
                    if (!edits) {
                        return;
                    }
                    return {
                        edits: edits.map((edit) => {
                            return {
                                ...edit,
                                kind: edit.kind ? new HierarchicalKind(edit.kind.value) : new HierarchicalKind(''),
                                yieldTo: edit.yieldTo?.map(x => ({ kind: new HierarchicalKind(x) })),
                                additionalEdit: edit.additionalEdit ? reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, dataId => this.resolveFileData(request.id, dataId)) : undefined,
                            };
                        }),
                        dispose: () => {
                            this._proxy.$releasePasteEdits(this._handle, request.id);
                        },
                    };
                }
                finally {
                    request.dispose();
                }
            };
        }
        if (metadata.supportsResolve) {
            this.resolveDocumentPasteEdit = async (edit, token) => {
                const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
                if (typeof resolved.insertText !== 'undefined') {
                    edit.insertText = resolved.insertText;
                }
                if (resolved.additionalEdit) {
                    edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
                }
                return edit;
            };
        }
    }
    resolveFileData(requestId, dataId) {
        return this.dataTransfers.resolveFileData(requestId, dataId);
    }
};
MainThreadPasteEditProvider = __decorate([
    __param(3, IUriIdentityService)
], MainThreadPasteEditProvider);
let MainThreadDocumentOnDropEditProvider = class MainThreadDocumentOnDropEditProvider {
    constructor(_handle, _proxy, metadata, _uriIdentService) {
        this._handle = _handle;
        this._proxy = _proxy;
        this._uriIdentService = _uriIdentService;
        this.dataTransfers = new DataTransferFileCache();
        this.dropMimeTypes = metadata?.dropMimeTypes ?? ['*/*'];
        this.providedDropEditKinds = metadata?.providedDropKinds?.map(kind => new HierarchicalKind(kind));
        if (metadata?.supportsResolve) {
            this.resolveDocumentDropEdit = async (edit, token) => {
                const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
                if (resolved.additionalEdit) {
                    edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
                }
                return edit;
            };
        }
    }
    async provideDocumentDropEdits(model, position, dataTransfer, token) {
        const request = this.dataTransfers.add(dataTransfer);
        try {
            const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
            if (token.isCancellationRequested) {
                return;
            }
            const edits = await this._proxy.$provideDocumentOnDropEdits(this._handle, request.id, model.uri, position, dataTransferDto, token);
            if (!edits) {
                return;
            }
            return {
                edits: edits.map(edit => {
                    return {
                        ...edit,
                        yieldTo: edit.yieldTo?.map(x => ({ kind: new HierarchicalKind(x) })),
                        kind: edit.kind ? new HierarchicalKind(edit.kind) : undefined,
                        additionalEdit: reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, dataId => this.resolveDocumentOnDropFileData(request.id, dataId)),
                    };
                }),
                dispose: () => {
                    this._proxy.$releaseDocumentOnDropEdits(this._handle, request.id);
                },
            };
        }
        finally {
            request.dispose();
        }
    }
    resolveDocumentOnDropFileData(requestId, dataId) {
        return this.dataTransfers.resolveFileData(requestId, dataId);
    }
};
MainThreadDocumentOnDropEditProvider = __decorate([
    __param(3, IUriIdentityService)
], MainThreadDocumentOnDropEditProvider);
export class MainThreadDocumentSemanticTokensProvider {
    constructor(_proxy, _handle, _legend, onDidChange) {
        this._proxy = _proxy;
        this._handle = _handle;
        this._legend = _legend;
        this.onDidChange = onDidChange;
    }
    releaseDocumentSemanticTokens(resultId) {
        if (resultId) {
            this._proxy.$releaseDocumentSemanticTokens(this._handle, parseInt(resultId, 10));
        }
    }
    getLegend() {
        return this._legend;
    }
    async provideDocumentSemanticTokens(model, lastResultId, token) {
        const nLastResultId = lastResultId ? parseInt(lastResultId, 10) : 0;
        const encodedDto = await this._proxy.$provideDocumentSemanticTokens(this._handle, model.uri, nLastResultId, token);
        if (!encodedDto) {
            return null;
        }
        if (token.isCancellationRequested) {
            return null;
        }
        const dto = decodeSemanticTokensDto(encodedDto);
        if (dto.type === 'full') {
            return {
                resultId: String(dto.id),
                data: dto.data
            };
        }
        return {
            resultId: String(dto.id),
            edits: dto.deltas
        };
    }
}
export class MainThreadDocumentRangeSemanticTokensProvider {
    constructor(_proxy, _handle, _legend) {
        this._proxy = _proxy;
        this._handle = _handle;
        this._legend = _legend;
    }
    getLegend() {
        return this._legend;
    }
    async provideDocumentRangeSemanticTokens(model, range, token) {
        const encodedDto = await this._proxy.$provideDocumentRangeSemanticTokens(this._handle, model.uri, range, token);
        if (!encodedDto) {
            return null;
        }
        if (token.isCancellationRequested) {
            return null;
        }
        const dto = decodeSemanticTokensDto(encodedDto);
        if (dto.type === 'full') {
            return {
                resultId: String(dto.id),
                data: dto.data
            };
        }
        throw new Error(`Unexpected`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFJaEcsT0FBTyxFQUFFLDRCQUE0QixFQUEyQixjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM3SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBSWxELE9BQU8sS0FBSyxTQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDakUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFaEYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFFbEgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDL0YsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFL0YsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1B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