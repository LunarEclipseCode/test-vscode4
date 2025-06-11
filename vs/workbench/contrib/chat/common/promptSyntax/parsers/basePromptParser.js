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
import { TopError } from './topError.js';
import { ChatMode } from '../../constants.js';
import { ModeHeader } from './promptHeader/modeHeader.js';
import { URI } from '../../../../../../base/common/uri.js';
import { PromptToken } from '../codecs/tokens/promptToken.js';
import * as path from '../../../../../../base/common/path.js';
import { ChatPromptCodec } from '../codecs/chatPromptCodec.js';
import { FileReference } from '../codecs/tokens/fileReference.js';
import { assertDefined } from '../../../../../../base/common/types.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { DeferredPromise } from '../../../../../../base/common/async.js';
import { InstructionsHeader } from './promptHeader/instructionsHeader.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { PromptVariableWithData } from '../codecs/tokens/promptVariable.js';
import { assert, assertNever } from '../../../../../../base/common/assert.js';
import { basename, dirname } from '../../../../../../base/common/resources.js';
import { BaseToken } from '../codecs/base/baseToken.js';
import { PromptHeader } from './promptHeader/promptHeader.js';
import { ObservableDisposable } from '../utils/observableDisposable.js';
import { PromptsType, INSTRUCTIONS_LANGUAGE_ID, MODE_LANGUAGE_ID, PROMPT_LANGUAGE_ID } from '../promptTypes.js';
import { LinesDecoder } from '../codecs/base/linesCodec/linesDecoder.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { MarkdownLink } from '../codecs/base/markdownCodec/tokens/markdownLink.js';
import { MarkdownToken } from '../codecs/base/markdownCodec/tokens/markdownToken.js';
import { isPromptOrInstructionsFile } from '../config/promptFileLocations.js';
import { FrontMatterHeader } from '../codecs/base/markdownExtensionsCodec/tokens/frontMatterHeader.js';
import { NotPromptFile, RecursiveReference, FolderReference, ResolveError } from '../../promptFileReferenceErrors.js';
import { DEFAULT_OPTIONS as CONTENTS_PROVIDER_DEFAULT_OPTIONS } from '../contentProviders/promptContentsProviderBase.js';
/**
 * Default {@link IPromptContentsProviderOptions} options.
 */
const DEFAULT_OPTIONS = {
    ...CONTENTS_PROVIDER_DEFAULT_OPTIONS,
    seenReferences: [],
};
/**
 * Base prompt parser class that provides a common interface for all
 * prompt parsers that are responsible for parsing chat prompt syntax.
 */
let BasePromptParser = class BasePromptParser extends ObservableDisposable {
    /**
     * List of all tokens that were parsed from the prompt contents so far.
     */
    get tokens() {
        return [...this.receivedTokens];
    }
    /**
     * Reference to the prompt header object that holds metadata associated
     * with the prompt.
     */
    get header() {
        return this.promptHeader;
    }
    /**
     * Get contents of the prompt body.
     */
    async getBody() {
        const startLineNumber = (this.header !== undefined)
            ? this.header.range.endLineNumber + 1
            : 1;
        const decoder = new LinesDecoder(await this.promptContentsProvider.contents);
        const tokens = (await decoder.consumeAll())
            .filter(({ range }) => {
            return (range.startLineNumber >= startLineNumber);
        });
        return BaseToken.render(tokens);
    }
    /**
     * Event that is fired when the current prompt parser is settled.
     */
    onSettled(callback) {
        const disposable = this._onSettled.event(callback);
        const streamEnded = (this.stream?.ended && (this.stream.isDisposed === false));
        // if already in the error state or stream has already ended,
        // invoke the callback immediately but asynchronously
        if (streamEnded || this.errorCondition) {
            setTimeout(callback.bind(undefined, this.errorCondition));
            return disposable;
        }
        return disposable;
    }
    /**
     * If file reference resolution fails, this attribute will be set
     * to an error instance that describes the error condition.
     */
    get errorCondition() {
        return this._errorCondition;
    }
    /**
     * Whether file references resolution failed.
     * Set to `undefined` if the `resolve` method hasn't been ever called yet.
     */
    get resolveFailed() {
        if (!this.firstParseResult.gotFirstResult) {
            return undefined;
        }
        return !!this._errorCondition;
    }
    /**
     * Returned promise is resolved when the parser process is settled.
     * The settled state means that the prompt parser stream exists and
     * has ended, or an error condition has been set in case of failure.
     *
     * Furthermore, this function can be called multiple times and will
     * block until the latest prompt contents parsing logic is settled
     * (e.g., for every `onContentChanged` event of the prompt source).
     */
    async settled() {
        assert(this.started, 'Cannot wait on the parser that did not start yet.');
        await this.firstParseResult.promise;
        if (this.errorCondition) {
            return this;
        }
        // by the time when the `firstParseResult` promise is resolved,
        // this object may have been already disposed, hence noop
        if (this.isDisposed) {
            return this;
        }
        assertDefined(this.stream, 'No stream reference found.');
        await this.stream.settled;
        // if prompt header exists, also wait for it to be settled
        if (this.promptHeader) {
            await this.promptHeader.settled;
        }
        return this;
    }
    /**
     * Same as {@link settled} but also waits for all possible
     * nested child prompt references and their children to be settled.
     */
    async allSettled() {
        await this.settled();
        await Promise.allSettled(this.references.map((reference) => {
            return reference.allSettled();
        }));
        return this;
    }
    constructor(promptContentsProvider, options, instantiationService, workspaceService, logService) {
        super();
        this.promptContentsProvider = promptContentsProvider;
        this.instantiationService = instantiationService;
        this.workspaceService = workspaceService;
        this.logService = logService;
        /**
         * Private field behind the readonly {@link tokens} property.
         */
        this.receivedTokens = [];
        /**
         * List of file references in the current branch of the file reference tree.
         */
        this._references = [];
        /**
         * The event is fired when lines or their content change.
         */
        this._onUpdate = this._register(new Emitter());
        /**
         * Subscribe to the event that is fired the parser state or contents
         * changes, including changes in the possible prompt child references.
         */
        this.onUpdate = this._onUpdate.event;
        /**
         * Event that is fired when the current prompt parser is settled.
         */
        this._onSettled = this._register(new Emitter());
        /**
         * The promise is resolved when at least one parse result (a stream or
         * an error) has been received from the prompt contents provider.
         */
        this.firstParseResult = new FirstParseResult();
        /**
         * Private attribute to track if the {@link start}
         * method has been already called at least once.
         */
        this.started = false;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
        };
        const seenReferences = [...this.options.seenReferences];
        // to prevent infinite file recursion, we keep track of all references in
        // the current branch of the file reference tree and check if the current
        // file reference has been already seen before
        if (seenReferences.includes(this.uri.path)) {
            seenReferences.push(this.uri.path);
            this._errorCondition = new RecursiveReference(this.uri, seenReferences);
            this._onUpdate.fire();
            this.firstParseResult.end();
            return this;
        }
        // we don't care if reading the file fails below, hence can add the path
        // of the current reference to the `seenReferences` set immediately, -
        // even if the file doesn't exist, we would never end up in the recursion
        seenReferences.push(this.uri.path);
        this._register(this.promptContentsProvider.onContentChanged((streamOrError) => {
            // process the received message
            this.onContentsChanged(streamOrError, seenReferences);
            // indicate that we've received at least one `onContentChanged` event
            this.firstParseResult.end();
        }));
        // dispose self when contents provider is disposed
        this._register(this.promptContentsProvider.onDispose(this.dispose.bind(this)));
    }
    /**
     * Handler the event event that is triggered when prompt contents change.
     *
     * @param streamOrError Either a binary stream of file contents, or an error object
     * 						that was generated during the reference resolve attempt.
     * @param seenReferences List of parent references that we've have already seen
     * 					 	during the process of traversing the references tree. It's
     * 						used to prevent the tree navigation to fall into an infinite
     * 						references recursion.
     */
    onContentsChanged(streamOrError, seenReferences) {
        // dispose and cleanup the previously received stream
        // object or an error condition, if any received yet
        this.stream?.dispose();
        delete this.stream;
        delete this._errorCondition;
        this.receivedTokens = [];
        // cleanup current prompt header object
        this.promptHeader?.dispose();
        delete this.promptHeader;
        // dispose all currently existing references
        this.disposeReferences();
        // if an error received, set up the error condition and stop
        if (streamOrError instanceof ResolveError) {
            this._errorCondition = streamOrError;
            this._onUpdate.fire();
            // when error received fire the 'onSettled' event immediately
            this._onSettled.fire(streamOrError);
            return;
        }
        // decode the byte stream to a stream of prompt tokens
        this.stream = ChatPromptCodec.decode(streamOrError);
        /**
         * !NOTE! The order of event subscriptions below is critical here because
         *        the `data` event is also starts the stream, hence changing
         *        the order of event subscriptions can lead to race conditions.
         *        See {@link ReadableStreamEvents} for more info.
         */
        // on error or stream end, dispose the stream and fire the update event
        this.stream.on('error', this.onStreamEnd.bind(this, this.stream));
        this.stream.on('end', this.onStreamEnd.bind(this, this.stream));
        // when some tokens received, process and store the references
        this.stream.on('data', (token) => {
            // store all markdown and prompt token references
            if ((token instanceof MarkdownToken) || (token instanceof PromptToken)) {
                this.receivedTokens.push(token);
            }
            // if a prompt header token received, create a new prompt header instance
            if (token instanceof FrontMatterHeader) {
                return this.createHeader(token);
            }
            // try to convert a prompt variable with data token into a file reference
            if (token instanceof PromptVariableWithData) {
                try {
                    this.handleLinkToken(FileReference.from(token), [...seenReferences]);
                }
                catch (error) {
                    // the `FileReference.from` call might throw if the `PromptVariableWithData` token
                    // can not be converted into a valid `#file` reference, hence we ignore the error
                }
            }
            // note! the `isURL` is a simple check and needs to be improved to truly
            // 		 handle only file references, ignoring broken URLs or references
            if (token instanceof MarkdownLink && !token.isURL) {
                this.handleLinkToken(token, [...seenReferences]);
            }
        });
        // calling `start` on a disposed stream throws, so we warn and return instead
        if (this.stream.isDisposed) {
            this.logService.warn(`[prompt parser][${basename(this.uri)}] cannot start stream that has been already disposed, aborting`);
            return;
        }
        // start receiving data on the stream
        this.stream.start();
    }
    /**
     * Create header object base on the target prompt file language ID.
     * The language ID is important here, because it defines what type
     * of metadata is valid for a prompt file and what type of related
     * diagnostics we would show to the user.
     */
    createHeader(headerToken) {
        const { languageId } = this.promptContentsProvider;
        if (languageId === PROMPT_LANGUAGE_ID) {
            this.promptHeader = new PromptHeader(headerToken, languageId);
        }
        if (languageId === INSTRUCTIONS_LANGUAGE_ID) {
            this.promptHeader = new InstructionsHeader(headerToken, languageId);
        }
        if (languageId === MODE_LANGUAGE_ID) {
            this.promptHeader = new ModeHeader(headerToken, languageId);
        }
        this.promptHeader?.start();
    }
    /**
     * Handle a new reference token inside prompt contents.
     */
    handleLinkToken(token, seenReferences) {
        const { parentFolder } = this;
        const referenceUri = ((parentFolder !== null) && (path.isAbsolute(token.path) === false))
            ? URI.joinPath(parentFolder, token.path)
            : URI.file(token.path);
        const contentProvider = this.promptContentsProvider.createNew({ uri: referenceUri });
        const reference = this.instantiationService
            .createInstance(PromptReference, contentProvider, token, { seenReferences });
        this._references.push(reference);
        reference.addDisposables(
        // the content provider is exclusively owned by the reference
        // hence dispose it when the reference is disposed
        reference.onDispose(contentProvider.dispose.bind(contentProvider)), reference.onUpdate(this._onUpdate.fire));
        this._onUpdate.fire();
        reference.start();
        return this;
    }
    /**
     * Handle the `stream` end event.
     *
     * @param stream The stream that has ended.
     * @param error Optional error object if stream ended with an error.
     */
    onStreamEnd(stream, error) {
        // decoders can fire the 'end' event also when they are get disposed,
        // but because we dispose them when a new stream is received, we can
        // safely ignore the event in this case
        if (stream.isDisposed === true) {
            return this;
        }
        if (error) {
            this.logService.warn(`[prompt parser][${basename(this.uri)}] received an error on the chat prompt decoder stream: ${error}`);
        }
        this._onUpdate.fire();
        this._onSettled.fire(error);
        return this;
    }
    /**
     * Dispose all currently held references.
     */
    disposeReferences() {
        for (const reference of [...this._references]) {
            reference.dispose();
        }
        this._references.length = 0;
    }
    /**
     * Start the prompt parser.
     */
    start() {
        // if already started, nothing to do
        if (this.started) {
            return this;
        }
        this.started = true;
        // if already in the error state that could be set
        // in the constructor, then nothing to do
        if (this.errorCondition) {
            return this;
        }
        this.promptContentsProvider.start();
        return this;
    }
    /**
     * Associated URI of the prompt.
     */
    get uri() {
        return this.promptContentsProvider.uri;
    }
    /**
     * Get the parent folder URI of the prompt.
     * For instance, if prompt URI points to a file on a disk, this
     * function will return the folder URI that contains that file,
     * but if the URI points to an `untitled` document, will try to
     * use a different folder URI based on the workspace state.
     */
    get parentFolder() {
        if (this.uri.scheme === 'file') {
            return dirname(this.uri);
        }
        const { folders } = this.workspaceService.getWorkspace();
        // single-root workspace, use root folder URI
        if (folders.length === 1) {
            return folders[0].uri;
        }
        // if a multi-root workspace, or no workspace at all
        return null;
    }
    /**
     * Get a list of immediate child references of the prompt.
     */
    get references() {
        return [...this._references];
    }
    /**
     * Get a list of all references of the prompt, including
     * all possible nested references its children may have.
     */
    get allReferences() {
        const result = [];
        for (const reference of this.references) {
            result.push(reference);
            if (reference.type === 'file') {
                result.push(...reference.allReferences);
            }
        }
        return result;
    }
    /**
     * Get list of all valid references.
     */
    get allValidReferences() {
        return this.allReferences
            // filter out unresolved references
            .filter((reference) => {
            const { errorCondition } = reference;
            // include all references without errors
            if (!errorCondition) {
                return true;
            }
            // filter out folder references from the list
            if (errorCondition instanceof FolderReference) {
                return false;
            }
            // include non-prompt file references
            return (errorCondition instanceof NotPromptFile);
        });
    }
    /**
     * Valid metadata records defined in the prompt header.
     */
    get metadata() {
        const { promptType } = this.promptContentsProvider;
        if (promptType === 'non-prompt') {
            return null;
        }
        if (this.header === undefined) {
            return { promptType };
        }
        if (this.header instanceof InstructionsHeader) {
            return { promptType, ...this.header.metadata };
        }
        const { tools, mode, description } = this.header.metadata;
        // compute resulting mode based on presence
        // of `tools` metadata in the prompt header
        const resultingMode = (tools !== undefined)
            ? ChatMode.Agent
            : mode;
        const result = {};
        if (description !== undefined) {
            result.description = description;
        }
        if (tools !== undefined) {
            result.tools = tools;
        }
        if (resultingMode !== undefined) {
            result.mode = resultingMode;
        }
        return { promptType, ...result };
    }
    /**
     * Entire associated `tools` metadata for this reference and
     * all possible nested child references.
     */
    get allToolsMetadata() {
        let hasTools = false;
        const result = [];
        if (this.metadata?.promptType !== PromptsType.prompt) {
            return null;
        }
        const { tools, mode } = this.metadata;
        if (tools !== undefined) {
            result.push(...tools);
            hasTools = true;
        }
        const isRootInAgentMode = ((hasTools === true) || (mode === ChatMode.Agent));
        // the top-level mode defines the overall mode for all
        // nested prompt references, therefore if mode of
        // the top-level prompt is not equal to `agent`, then
        // ignore all `tools` metadata of the nested references
        if (isRootInAgentMode === false) {
            return null;
        }
        for (const reference of this.references) {
            const { allToolsMetadata } = reference;
            if (allToolsMetadata === null) {
                continue;
            }
            result.push(...allToolsMetadata);
            hasTools = true;
        }
        if (hasTools === false) {
            return null;
        }
        // return unique list of tools
        return [...new Set(result)];
    }
    /**
     * Get list of errors for the direct links of the current reference.
     */
    get errors() {
        const childErrors = [];
        for (const reference of this.references) {
            const { errorCondition } = reference;
            if (errorCondition && (!(errorCondition instanceof NotPromptFile))) {
                childErrors.push(errorCondition);
            }
        }
        return childErrors;
    }
    /**
     * List of all errors that occurred while resolving the current
     * reference including all possible errors of nested children.
     */
    get allErrors() {
        const result = [];
        for (const reference of this.references) {
            const { errorCondition } = reference;
            if (errorCondition && (!(errorCondition instanceof NotPromptFile))) {
                result.push({
                    originalError: errorCondition,
                    parentUri: this.uri,
                });
            }
            // recursively collect all possible errors of its children
            result.push(...reference.allErrors);
        }
        return result;
    }
    /**
     * The top most error of the current reference or any of its
     * possible child reference errors.
     */
    get topError() {
        if (this.errorCondition) {
            return new TopError({
                errorSubject: 'root',
                errorsCount: 1,
                originalError: this.errorCondition,
            });
        }
        const childErrors = [...this.errors];
        const nestedErrors = [];
        for (const reference of this.references) {
            nestedErrors.push(...reference.allErrors);
        }
        if (childErrors.length === 0 && nestedErrors.length === 0) {
            return undefined;
        }
        const firstDirectChildError = childErrors[0];
        const firstNestedChildError = nestedErrors[0];
        const hasDirectChildError = (firstDirectChildError !== undefined);
        const firstChildError = (hasDirectChildError)
            ? {
                originalError: firstDirectChildError,
                parentUri: this.uri,
            }
            : firstNestedChildError;
        const totalErrorsCount = childErrors.length + nestedErrors.length;
        const subject = (hasDirectChildError)
            ? 'child'
            : 'indirect-child';
        return new TopError({
            errorSubject: subject,
            originalError: firstChildError.originalError,
            parentUri: firstChildError.parentUri,
            errorsCount: totalErrorsCount,
        });
    }
    /**
     * Check if the current reference points to a given resource.
     */
    sameUri(otherUri) {
        return this.uri.toString() === otherUri.toString();
    }
    /**
     * Check if the current reference points to a prompt snippet file.
     */
    get isPromptFile() {
        return isPromptOrInstructionsFile(this.uri);
    }
    /**
     * Returns a string representation of this object.
     */
    toString() {
        return `prompt:${this.uri.path}`;
    }
    /**
     * @inheritdoc
     */
    dispose() {
        if (this.isDisposed) {
            return;
        }
        this.disposeReferences();
        this.stream?.dispose();
        delete this.stream;
        this.promptHeader?.dispose();
        delete this.promptHeader;
        super.dispose();
    }
};
BasePromptParser = __decorate([
    __param(2, IInstantiationService),
    __param(3, IWorkspaceContextService),
    __param(4, ILogService)
], BasePromptParser);
export { BasePromptParser };
/**
 * Prompt reference object represents any reference inside prompt text
 * contents. For instance the file variable(`#file:/path/to/file.md`) or
 * a markdown link(`[#file:file.md](/path/to/file.md)`).
 */
let PromptReference = class PromptReference extends ObservableDisposable {
    constructor(promptContentsProvider, token, options, instantiationService) {
        super();
        this.promptContentsProvider = promptContentsProvider;
        this.token = token;
        this.parser = this._register(instantiationService.createInstance(BasePromptParser, this.promptContentsProvider, options));
    }
    /**
     * Get the range of the `link` part of the reference.
     */
    get linkRange() {
        // `#file:` references
        if (this.token instanceof FileReference) {
            return this.token.dataRange;
        }
        // `markdown link` references
        if (this.token instanceof MarkdownLink) {
            return this.token.linkRange;
        }
        return undefined;
    }
    /**
     * Type of the reference, - either a prompt `#file` variable,
     * or a `markdown link` reference (`[caption](/path/to/file.md)`).
     */
    get type() {
        if (this.token instanceof FileReference) {
            return 'file';
        }
        if (this.token instanceof MarkdownLink) {
            return 'file';
        }
        assertNever(this.token, `Unknown token type '${this.token}'.`);
    }
    /**
     * Subtype of the reference, - either a prompt `#file` variable,
     * or a `markdown link` reference (`[caption](/path/to/file.md)`).
     */
    get subtype() {
        if (this.token instanceof FileReference) {
            return 'prompt';
        }
        if (this.token instanceof MarkdownLink) {
            return 'markdown';
        }
        assertNever(this.token, `Unknown token type '${this.token}'.`);
    }
    /**
     * Start parsing the reference contents.
     */
    start() {
        this.parser.start();
        return this;
    }
    /**
     * Subscribe to the `onUpdate` event that is fired when prompt tokens are updated.
     */
    onUpdate(...args) {
        return this.parser.onUpdate(...args);
    }
    get range() {
        return this.token.range;
    }
    get path() {
        return this.token.path;
    }
    get text() {
        return this.token.text;
    }
    get resolveFailed() {
        return this.parser.resolveFailed;
    }
    get errorCondition() {
        return this.parser.errorCondition;
    }
    get topError() {
        return this.parser.topError;
    }
    get uri() {
        return this.parser.uri;
    }
    get isPromptFile() {
        return this.parser.isPromptFile;
    }
    get errors() {
        return this.parser.errors;
    }
    get allErrors() {
        return this.parser.allErrors;
    }
    get references() {
        return this.parser.references;
    }
    get allReferences() {
        return this.parser.allReferences;
    }
    get metadata() {
        return this.parser.metadata;
    }
    get allToolsMetadata() {
        return this.parser.allToolsMetadata;
    }
    get allValidReferences() {
        return this.parser.allValidReferences;
    }
    async settled() {
        await this.parser.settled();
        return this;
    }
    async allSettled() {
        await this.parser.allSettled();
        return this;
    }
    /**
     * Returns a string representation of this object.
     */
    toString() {
        return `prompt-reference/${this.type}:${this.subtype}/${this.token}`;
    }
};
PromptReference = __decorate([
    __param(3, IInstantiationService)
], PromptReference);
export { PromptReference };
/**
 * A tiny utility object that helps us to track existence
 * of at least one parse result from the content provider.
 */
class FirstParseResult extends DeferredPromise {
    constructor() {
        super(...arguments);
        /**
         * Private attribute to track if we have
         * received at least one result.
         */
        this._gotResult = false;
    }
    /**
     * Whether we've received at least one result.
     */
    get gotFirstResult() {
        return this._gotResult;
    }
    /**
     * Get underlying promise reference.
     */
    get promise() {
        return this.p;
    }
    /**
     * Complete the underlying promise.
     */
    end() {
        this._gotResult = true;
        super.complete(void 0)
            .catch(() => {
            // the complete method is never fails
            // so we can ignore the error here
        });
        return;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZVByb21wdFBhcnNlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvYmFzZVByb21wdFBhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUU5QyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDMUQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM5RCxPQUFPLEtBQUssSUFBSSxNQUFNLHVDQUF1QyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFbEUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBUyxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDekUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSTVFLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFFBQVEsRUFB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