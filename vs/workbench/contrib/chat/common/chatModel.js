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
var ChatModel_1;
import { asArray } from '../../../../base/common/arrays.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString, isMarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { revive } from '../../../../base/common/marshalling.js';
import { Schemas } from '../../../../base/common/network.js';
import { equals } from '../../../../base/common/objects.js';
import { ObservablePromise, observableFromEvent, observableSignalFromEvent, observableValue } from '../../../../base/common/observable.js';
import { basename, isEqual } from '../../../../base/common/resources.js';
import { URI, isUriComponents } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { OffsetRange } from '../../../../editor/common/core/ranges/offsetRange.js';
import { TextEdit, isLocation } from '../../../../editor/common/languages.js';
import { localize } from '../../../../nls.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { CellUri } from '../../notebook/common/notebookCommon.js';
import { IChatAgentService, reviveSerializedAgent } from './chatAgents.js';
import { IChatEditingService } from './chatEditingService.js';
import { ChatRequestTextPart, reviveParsedChatRequest } from './chatParserTypes.js';
import { isIUsedContext } from './chatService.js';
import { ChatAgentLocation, ChatMode } from './constants.js';
export var OmittedState;
(function (OmittedState) {
    OmittedState[OmittedState["NotOmitted"] = 0] = "NotOmitted";
    OmittedState[OmittedState["Partial"] = 1] = "Partial";
    OmittedState[OmittedState["Full"] = 2] = "Full";
})(OmittedState || (OmittedState = {}));
export var IDiagnosticVariableEntryFilterData;
(function (IDiagnosticVariableEntryFilterData) {
    IDiagnosticVariableEntryFilterData.icon = Codicon.error;
    function fromMarker(marker) {
        return {
            filterUri: marker.resource,
            owner: marker.owner,
            problemMessage: marker.message,
            filterRange: { startLineNumber: marker.startLineNumber, endLineNumber: marker.endLineNumber, startColumn: marker.startColumn, endColumn: marker.endColumn }
        };
    }
    IDiagnosticVariableEntryFilterData.fromMarker = fromMarker;
    function toEntry(data) {
        return {
            id: id(data),
            name: label(data),
            icon: IDiagnosticVariableEntryFilterData.icon,
            value: data,
            kind: 'diagnostic',
            ...data,
        };
    }
    IDiagnosticVariableEntryFilterData.toEntry = toEntry;
    function id(data) {
        return [data.filterUri, data.owner, data.filterSeverity, data.filterRange?.startLineNumber].join(':');
    }
    IDiagnosticVariableEntryFilterData.id = id;
    function label(data) {
        let TrimThreshold;
        (function (TrimThreshold) {
            TrimThreshold[TrimThreshold["MaxChars"] = 30] = "MaxChars";
            TrimThreshold[TrimThreshold["MaxSpaceLookback"] = 10] = "MaxSpaceLookback";
        })(TrimThreshold || (TrimThreshold = {}));
        if (data.problemMessage) {
            if (data.problemMessage.length < 30 /* TrimThreshold.MaxChars */) {
                return data.problemMessage;
            }
            // Trim the message, on a space if it would not lose too much
            // data (MaxSpaceLookback) or just blindly otherwise.
            const lastSpace = data.problemMessage.lastIndexOf(' ', 30 /* TrimThreshold.MaxChars */);
            if (lastSpace === -1 || lastSpace + 10 /* TrimThreshold.MaxSpaceLookback */ < 30 /* TrimThreshold.MaxChars */) {
                return data.problemMessage.substring(0, 30 /* TrimThreshold.MaxChars */) + '…';
            }
            return data.problemMessage.substring(0, lastSpace) + '…';
        }
        let labelStr = localize('chat.attachment.problems.all', "All Problems");
        if (data.filterUri) {
            labelStr = localize('chat.attachment.problems.inFile', "Problems in {0}", basename(data.filterUri));
        }
        return labelStr;
    }
    IDiagnosticVariableEntryFilterData.label = label;
})(IDiagnosticVariableEntryFilterData || (IDiagnosticVariableEntryFilterData = {}));
export var IChatRequestVariableEntry;
(function (IChatRequestVariableEntry) {
    /**
     * Returns URI of the passed variant entry. Return undefined if not found.
     */
    function toUri(entry) {
        return URI.isUri(entry.value)
            ? entry.value
            : isLocation(entry.value)
                ? entry.value.uri
                : undefined;
    }
    IChatRequestVariableEntry.toUri = toUri;
})(IChatRequestVariableEntry || (IChatRequestVariableEntry = {}));
export function isImplicitVariableEntry(obj) {
    return obj.kind === 'implicit';
}
export function isPasteVariableEntry(obj) {
    return obj.kind === 'paste';
}
export function isImageVariableEntry(obj) {
    return obj.kind === 'image';
}
export function isNotebookOutputVariableEntry(obj) {
    return obj.kind === 'notebookOutput';
}
export function isElementVariableEntry(obj) {
    return obj.kind === 'element';
}
export function isDiagnosticsVariableEntry(obj) {
    return obj.kind === 'diagnostic';
}
export function isChatRequestFileEntry(obj) {
    return obj.kind === 'file';
}
export function isChatRequestVariableEntry(obj) {
    const entry = obj;
    return typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string';
}
export function isSCMHistoryItemVariableEntry(obj) {
    return obj.kind === 'scmHistoryItem';
}
export const CHAT_ATTACHABLE_IMAGE_MIME_TYPES = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
};
export function getAttachableImageExtension(mimeType) {
    return Object.entries(CHAT_ATTACHABLE_IMAGE_MIME_TYPES).find(([_, value]) => value === mimeType)?.[0];
}
export function isCellTextEditOperation(value) {
    const candidate = value;
    return !!candidate && !!candidate.edit && !!candidate.uri && URI.isUri(candidate.uri);
}
const nonHistoryKinds = new Set(['toolInvocation', 'toolInvocationSerialized', 'undoStop', 'prepareToolInvocation']);
function isChatProgressHistoryResponseContent(content) {
    return !nonHistoryKinds.has(content.kind);
}
export function toChatHistoryContent(content) {
    return content.filter(isChatProgressHistoryResponseContent);
}
const defaultChatResponseModelChangeReason = { reason: 'other' };
export class ChatRequestModel {
    get session() {
        return this._session;
    }
    get username() {
        return this.session.requesterUsername;
    }
    get avatarIconUri() {
        return this.session.requesterAvatarIconUri;
    }
    get attempt() {
        return this._attempt;
    }
    get variableData() {
        return this._variableData;
    }
    set variableData(v) {
        this._variableData = v;
    }
    get confirmation() {
        return this._confirmation;
    }
    get locationData() {
        return this._locationData;
    }
    get attachedContext() {
        return this._attachedContext;
    }
    get editedFileEvents() {
        return this._editedFileEvents;
    }
    constructor(params) {
        this._session = params.session;
        this.message = params.message;
        this._variableData = params.variableData;
        this.timestamp = params.timestamp;
        this._attempt = params.attempt ?? 0;
        this._confirmation = params.confirmation;
        this._locationData = params.locationData;
        this._attachedContext = params.attachedContext;
        this.isCompleteAddedRequest = params.isCompleteAddedRequest ?? false;
        this.modelId = params.modelId;
        this.id = params.restoredId ?? 'request_' + generateUuid();
        this._editedFileEvents = params.editedFileEvents;
    }
    adoptTo(session) {
        this._session = session;
    }
}
class AbstractResponse {
    get value() {
        return this._responseParts;
    }
    constructor(value) {
        /**
         * A stringified representation of response data which might be presented to a screenreader or used when copying a response.
         */
        this._responseRepr = '';
        /**
         * Just the markdown content of the response, used for determining the rendering rate of markdown
         */
        this._markdownContent = '';
        this._responseParts = value;
        this._updateRepr();
    }
    toString() {
        return this._responseRepr;
    }
    /**
     * _Just_ the content of markdown parts in the response
     */
    getMarkdown() {
        return this._markdownContent;
    }
    _updateRepr() {
        this._responseRepr = this.partsToRepr(this._responseParts);
        this._markdownContent = this._responseParts.map(part => {
            if (part.kind === 'inlineReference') {
                return this.inlineRefToRepr(part);
            }
            else if (part.kind === 'markdownContent' || part.kind === 'markdownVuln') {
                return part.content.value;
            }
            else {
                return '';
            }
        })
            .filter(s => s.length > 0)
            .join('');
    }
    partsToRepr(parts) {
        const blocks = [];
        let currentBlockSegments = [];
        for (const part of parts) {
            let segment;
            switch (part.kind) {
                case 'treeData':
                case 'progressMessage':
                case 'codeblockUri':
                case 'toolInvocation':
                case 'toolInvocationSerialized':
                case 'extensions':
                case 'undoStop':
                case 'prepareToolInvocation':
                    // Ignore
                    continue;
                case 'inlineReference':
                    segment = { text: this.inlineRefToRepr(part) };
                    break;
                case 'command':
                    segment = { text: part.command.title, isBlock: true };
                    break;
                case 'textEditGroup':
                case 'notebookEditGroup':
                    segment = { text: localize('editsSummary', "Made changes."), isBlock: true };
                    break;
                case 'confirmation':
                    segment = { text: `${part.title}\n${part.message}`, isBlock: true };
                    break;
                default:
                    segment = { text: part.content.value };
                    break;
            }
            if (segment.isBlock) {
                if (currentBlockSegments.length) {
                    blocks.push(currentBlockSegments.join(''));
                    currentBlockSegments = [];
                }
                blocks.push(segment.text);
            }
            else {
                currentBlockSegments.push(segment.text);
            }
        }
        if (currentBlockSegments.length) {
            blocks.push(currentBlockSegments.join(''));
        }
        return blocks.join('\n\n');
    }
    inlineRefToRepr(part) {
        if ('uri' in part.inlineReference) {
            return this.uriToRepr(part.inlineReference.uri);
        }
        return 'name' in part.inlineReference
            ? '`' + part.inlineReference.name + '`'
            : this.uriToRepr(part.inlineReference);
    }
    uriToRepr(uri) {
        if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
            return uri.toString(false);
        }
        return basename(uri);
    }
}
/** A view of a subset of a response */
class ResponseView extends AbstractResponse {
    constructor(_response, undoStop) {
        let idx = _response.value.findIndex(v => v.kind === 'undoStop' && v.id === undoStop);
        // Undo stops are inserted before `codeblockUri`'s, which are preceeded by a
        // markdownContent containing the opening code fence. Adjust the index
        // backwards to avoid a buggy response if it looked like this happened.
        if (_response.value[idx + 1]?.kind === 'codeblockUri' && _response.value[idx - 1]?.kind === 'markdownContent') {
            idx--;
        }
        super(idx === -1 ? _response.value.slice() : _response.value.slice(0, idx));
        this.undoStop = undoStop;
    }
}
export class Response extends AbstractResponse {
    get onDidChangeValue() {
        return this._onDidChangeValue.event;
    }
    constructor(value) {
        super(asArray(value).map((v) => (isMarkdownString(v) ?
            { content: v, kind: 'markdownContent' } :
            'kind' in v ? v : { kind: 'treeData', treeData: v })));
        this._onDidChangeValue = new Emitter();
        this._citations = [];
    }
    dispose() {
        this._onDidChangeValue.dispose();
    }
    clear() {
        this._responseParts = [];
        this._updateRepr(true);
    }
    updateContent(progress, quiet) {
        if (progress.kind === 'markdownContent') {
            // last response which is NOT a text edit group because we do want to support heterogenous streaming but not have
            // the MD be chopped up by text edit groups (and likely other non-renderable parts)
            const lastResponsePart = this._responseParts
                .filter(p => p.kind !== 'textEditGroup')
                .at(-1);
            if (!lastResponsePart || lastResponsePart.kind !== 'markdownContent' || !canMergeMarkdownStrings(lastResponsePart.content, progress.content)) {
                // The last part can't be merged with- not markdown, or markdown with different permissions
                this._responseParts.push(progress);
            }
            else {
                // Don't modify the current object, since it's being diffed by the renderer
                const idx = this._responseParts.indexOf(lastResponsePart);
                this._responseParts[idx] = { ...lastResponsePart, content: appendMarkdownString(lastResponsePart.content, progress.content) };
            }
            this._updateRepr(quiet);
        }
        else if (progress.kind === 'textEdit' || progress.kind === 'notebookEdit') {
            // If the progress.uri is a cell Uri, its possible its part of the inline chat.
            // Old approach of notebook inline chat would not start and end with notebook Uri, so we need to check for old approach.
            const useOldApproachForInlineNotebook = progress.uri.scheme === Schemas.vscodeNotebookCell && !this._responseParts.find(part => part.kind === 'notebookEditGroup');
            // merge edits for the same file no matter when they come in
            const notebookUri = useOldApproachForInlineNotebook ? undefined : CellUri.parse(progress.uri)?.notebook;
            const uri = notebookUri ?? progress.uri;
            let found = false;
            const groupKind = progress.kind === 'textEdit' && !notebookUri ? 'textEditGroup' : 'notebookEditGroup';
            const edits = groupKind === 'textEditGroup' ? progress.edits : progress.edits.map(edit => TextEdit.isTextEdit(edit) ? { uri: progress.uri, edit } : edit);
            for (let i = 0; !found && i < this._responseParts.length; i++) {
                const candidate = this._responseParts[i];
                if (candidate.kind === groupKind && !candidate.done && isEqual(candidate.uri, uri)) {
                    candidate.edits.push(edits);
                    candidate.done = progress.done;
                    found = true;
                }
            }
            if (!found) {
                this._responseParts.push({
                    kind: groupKind,
                    uri,
                    edits: groupKind === 'textEditGroup' ? [edits] : edits,
                    done: progress.done
                });
            }
            this._updateRepr(quiet);
        }
        else if (progress.kind === 'progressTask') {
            // Add a new resolving part
            const responsePosition = this._responseParts.push(progress) - 1;
            this._updateRepr(quiet);
            const disp = progress.onDidAddProgress(() => {
                this._updateRepr(false);
            });
            progress.task?.().then((content) => {
                // Stop listening for progress updates once the task settles
                disp.dispose();
                // Replace the resolving part's content with the resolved response
                if (typeof content === 'string') {
                    this._responseParts[responsePosition].content = new MarkdownString(content);
                }
                this._updateRepr(false);
            });
        }
        else if (progress.kind === 'toolInvocation') {
            if (progress.confirmationMessages) {
                progress.confirmed.p.then(() => {
                    this._updateRepr(false);
                });
            }
            progress.isCompletePromise.then(() => {
                this._updateRepr(false);
            });
            this._responseParts.push(progress);
            this._updateRepr(quiet);
        }
        else {
            this._responseParts.push(progress);
            this._updateRepr(quiet);
        }
    }
    addCitation(citation) {
        this._citations.push(citation);
        this._updateRepr();
    }
    _updateRepr(quiet) {
        super._updateRepr();
        if (!this._onDidChangeValue) {
            return; // called from parent constructor
        }
        this._responseRepr += this._citations.length ? '\n\n' + getCodeCitationsMessage(this._citations) : '';
        if (!quiet) {
            this._onDidChangeValue.fire();
        }
    }
}
export class ChatResponseModel extends Disposable {
    get session() {
        return this._session;
    }
    get shouldBeRemovedOnSend() {
        return this._shouldBeRemovedOnSend;
    }
    get isComplete() {
        return this._isComplete;
    }
    set shouldBeRemovedOnSend(disablement) {
        this._shouldBeRemovedOnSend = disablement;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    get isCanceled() {
        return this._isCanceled;
    }
    get vote() {
        return this._vote;
    }
    get voteDownReason() {
        return this._voteDownReason;
    }
    get followups() {
        return this._followups;
    }
    get entireResponse() {
        return this._finalizedResponse || this._response;
    }
    get result() {
        return this._result;
    }
    get username() {
        return this.session.responderUsername;
    }
    get avatarIcon() {
        return this.session.responderAvatarIcon;
    }
    get agent() {
        return this._agent;
    }
    get slashCommand() {
        return this._slashCommand;
    }
    get agentOrSlashCommandDetected() {
        return this._agentOrSlashCommandDetected ?? false;
    }
    get usedContext() {
        return this._usedContext;
    }
    get contentReferences() {
        return Array.from(this._contentReferences);
    }
    get codeCitations() {
        return this._codeCitations;
    }
    get progressMessages() {
        return this._progressMessages;
    }
    get isStale() {
        return this._isStale;
    }
    get isPaused() {
        return this._isPaused;
    }
    get response() {
        const undoStop = this._shouldBeRemovedOnSend?.afterUndoStop;
        if (!undoStop) {
            return this._finalizedResponse || this._response;
        }
        if (this._responseView?.undoStop !== undoStop) {
            this._responseView = new ResponseView(this._response, undoStop);
        }
        return this._responseView;
    }
    constructor(params) {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._contentReferences = [];
        this._codeCitations = [];
        this._progressMessages = [];
        this._isStale = false;
        this._isPaused = observableValue('isPaused', false);
        this._session = params.session;
        this._agent = params.agent;
        this._slashCommand = params.slashCommand;
        this.requestId = params.requestId;
        this._isComplete = params.isComplete ?? false;
        this._isCanceled = params.isCanceled ?? false;
        this._vote = params.vote;
        this._voteDownReason = params.voteDownReason;
        this._result = params.result;
        this._followups = params.followups ? [...params.followups] : undefined;
        this.isCompleteAddedRequest = params.isCompleteAddedRequest ?? false;
        this._shouldBeRemovedOnSend = params.shouldBeRemovedOnSend;
        // If we are creating a response with some existing content, consider it stale
        this._isStale = Array.isArray(params.responseContent) && (params.responseContent.length !== 0 || isMarkdownString(params.responseContent) && params.responseContent.value.length !== 0);
        this._response = this._register(new Response(params.responseContent));
        const signal = observableSignalFromEvent(this, this.onDidChange);
        this.isPendingConfirmation = signal.map((_value, r) => {
            signal.read(r);
            return this._response.value.some(part => part.kind === 'toolInvocation' && part.isConfirmed === undefined
                || part.kind === 'confirmation' && part.isUsed === false);
        });
        this.isInProgress = signal.map((_value, r) => {
            signal.read(r);
            return !this.isPendingConfirmation.read(r)
                && !this.shouldBeRemovedOnSend
                && !this._isComplete;
        });
        this._register(this._response.onDidChangeValue(() => this._onDidChange.fire(defaultChatResponseModelChangeReason)));
        this.id = params.restoredId ?? 'response_' + generateUuid();
    }
    /**
     * Apply a progress update to the actual response content.
     */
    updateContent(responsePart, quiet) {
        this.bufferWhenPaused(() => this._response.updateContent(responsePart, quiet));
    }
    /**
     * Adds an undo stop at the current position in the stream.
     */
    addUndoStop(undoStop) {
        this.bufferWhenPaused(() => {
            this._onDidChange.fire({ reason: 'undoStop', id: undoStop.id });
            this._response.updateContent(undoStop, true);
        });
    }
    /**
     * Apply one of the progress updates that are not part of the actual response content.
     */
    applyReference(progress) {
        if (progress.kind === 'usedContext') {
            this._usedContext = progress;
        }
        else if (progress.kind === 'reference') {
            this._contentReferences.push(progress);
            this._onDidChange.fire(defaultChatResponseModelChangeReason);
        }
    }
    applyCodeCitation(progress) {
        this._codeCitations.push(progress);
        this._response.addCitation(progress);
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setAgent(agent, slashCommand) {
        this._agent = agent;
        this._slashCommand = slashCommand;
        this._agentOrSlashCommandDetected = !agent.isDefault || !!slashCommand;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setResult(result) {
        this._result = result;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    complete() {
        if (this._result?.errorDetails?.responseIsRedacted) {
            this._response.clear();
        }
        this._isComplete = true;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    cancel() {
        this._isComplete = true;
        this._isCanceled = true;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setFollowups(followups) {
        this._followups = followups;
        this._onDidChange.fire(defaultChatResponseModelChangeReason); // Fire so that command followups get rendered on the row
    }
    setVote(vote) {
        this._vote = vote;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setVoteDownReason(reason) {
        this._voteDownReason = reason;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setEditApplied(edit, editCount) {
        if (!this.response.value.includes(edit)) {
            return false;
        }
        if (!edit.state) {
            return false;
        }
        edit.state.applied = editCount; // must not be edit.edits.length
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
        return true;
    }
    adoptTo(session) {
        this._session = session;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setPaused(isPause, tx) {
        this._isPaused.set(isPause, tx);
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
        this.bufferedPauseContent?.forEach(f => f());
        this.bufferedPauseContent = undefined;
    }
    finalizeUndoState() {
        this._finalizedResponse = this.response;
        this._responseView = undefined;
        this._shouldBeRemovedOnSend = undefined;
    }
    bufferWhenPaused(apply) {
        if (!this._isPaused.get()) {
            apply();
        }
        else {
            this.bufferedPauseContent ??= [];
            this.bufferedPauseContent.push(apply);
        }
    }
}
export var ChatPauseState;
(function (ChatPauseState) {
    ChatPauseState[ChatPauseState["NotPausable"] = 0] = "NotPausable";
    ChatPauseState[ChatPauseState["Paused"] = 1] = "Paused";
    ChatPauseState[ChatPauseState["Unpaused"] = 2] = "Unpaused";
})(ChatPauseState || (ChatPauseState = {}));
/**
 * Normalize chat data from storage to the current format.
 * TODO- ChatModel#_deserialize and reviveSerializedAgent also still do some normalization and maybe that should be done in here too.
 */
export function normalizeSerializableChatData(raw) {
    normalizeOldFields(raw);
    if (!('version' in raw)) {
        return {
            version: 3,
            ...raw,
            lastMessageDate: raw.creationDate,
            customTitle: undefined,
        };
    }
    if (raw.version === 2) {
        return {
            ...raw,
            version: 3,
            customTitle: raw.computedTitle
        };
    }
    return raw;
}
function normalizeOldFields(raw) {
    // Fill in fields that very old chat data may be missing
    if (!raw.sessionId) {
        raw.sessionId = generateUuid();
    }
    if (!raw.creationDate) {
        raw.creationDate = getLastYearDate();
    }
    if ('version' in raw && (raw.version === 2 || raw.version === 3)) {
        if (!raw.lastMessageDate) {
            // A bug led to not porting creationDate properly, and that was copied to lastMessageDate, so fix that up if missing.
            raw.lastMessageDate = getLastYearDate();
        }
    }
    if (raw.initialLocation === 'editing-session') {
        raw.initialLocation = ChatAgentLocation.Panel;
    }
}
function getLastYearDate() {
    const lastYearDate = new Date();
    lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
    return lastYearDate.getTime();
}
export function isExportableSessionData(obj) {
    const data = obj;
    return typeof data === 'object' &&
        typeof data.requesterUsername === 'string';
}
export function isSerializableSessionData(obj) {
    const data = obj;
    return isExportableSessionData(obj) &&
        typeof data.creationDate === 'number' &&
        typeof data.sessionId === 'string' &&
        obj.requests.every((request) => !request.usedContext /* for backward compat allow missing usedContext */ || isIUsedContext(request.usedContext));
}
export var ChatRequestRemovalReason;
(function (ChatRequestRemovalReason) {
    /**
     * "Normal" remove
     */
    ChatRequestRemovalReason[ChatRequestRemovalReason["Removal"] = 0] = "Removal";
    /**
     * Removed because the request will be resent
     */
    ChatRequestRemovalReason[ChatRequestRemovalReason["Resend"] = 1] = "Resend";
    /**
     * Remove because the request is moving to another model
     */
    ChatRequestRemovalReason[ChatRequestRemovalReason["Adoption"] = 2] = "Adoption";
})(ChatRequestRemovalReason || (ChatRequestRemovalReason = {}));
let ChatModel = ChatModel_1 = class ChatModel extends Disposable {
    static getDefaultTitle(requests) {
        const firstRequestMessage = requests.at(0)?.message ?? '';
        const message = typeof firstRequestMessage === 'string' ?
            firstRequestMessage :
            firstRequestMessage.text;
        return message.split('\n')[0].substring(0, 50);
    }
    get sessionId() {
        return this._sessionId;
    }
    get requestInProgress() {
        return this.requestInProgressObs.get();
    }
    get requestPausibility() {
        const lastRequest = this.lastRequest;
        if (!lastRequest?.response?.agent || lastRequest.response.isComplete || lastRequest.response.isPendingConfirmation.get()) {
            return 0 /* ChatPauseState.NotPausable */;
        }
        return lastRequest.response.isPaused.get() ? 1 /* ChatPauseState.Paused */ : 2 /* ChatPauseState.Unpaused */;
    }
    get hasRequests() {
        return this._requests.length > 0;
    }
    get lastRequest() {
        return this._requests.at(-1);
    }
    get creationDate() {
        return this._creationDate;
    }
    get lastMessageDate() {
        return this._lastMessageDate;
    }
    get _defaultAgent() {
        return this.chatAgentService.getDefaultAgent(ChatAgentLocation.Panel, ChatMode.Ask);
    }
    get requesterUsername() {
        return this._defaultAgent?.metadata.requester?.name ??
            this.initialData?.requesterUsername ?? '';
    }
    get responderUsername() {
        return this._defaultAgent?.fullName ??
            this.initialData?.responderUsername ?? '';
    }
    get requesterAvatarIconUri() {
        return this._defaultAgent?.metadata.requester?.icon ??
            this._initialRequesterAvatarIconUri;
    }
    get responderAvatarIcon() {
        return this._defaultAgent?.metadata.themeIcon ??
            this._initialResponderAvatarIconUri;
    }
    get isImported() {
        return this._isImported;
    }
    get customTitle() {
        return this._customTitle;
    }
    get title() {
        return this._customTitle || ChatModel_1.getDefaultTitle(this._requests);
    }
    get initialLocation() {
        return this._initialLocation;
    }
    get editingSessionObs() {
        return this._editingSession;
    }
    get editingSession() {
        return this._editingSession?.promiseResult.get()?.data;
    }
    constructor(initialData, _initialLocation, logService, chatAgentService, chatEditingService) {
        super();
        this.initialData = initialData;
        this._initialLocation = _initialLocation;
        this.logService = logService;
        this.chatAgentService = chatAgentService;
        this.chatEditingService = chatEditingService;
        this._onDidDispose = this._register(new Emitter());
        this.onDidDispose = this._onDidDispose.event;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._isImported = false;
        this.currentEditedFileEvents = new ResourceMap();
        this._checkpoint = undefined;
        const isValid = isSerializableSessionData(initialData);
        if (initialData && !isValid) {
            this.logService.warn(`ChatModel#constructor: Loaded malformed session data: ${JSON.stringify(initialData)}`);
        }
        this._isImported = (!!initialData && !isValid) || (initialData?.isImported ?? false);
        this._sessionId = (isValid && initialData.sessionId) || generateUuid();
        this._requests = initialData ? this._deserialize(initialData) : [];
        this._creationDate = (isValid && initialData.creationDate) || Date.now();
        this._lastMessageDate = (isValid && initialData.lastMessageDate) || this._creationDate;
        this._customTitle = isValid ? initialData.customTitle : undefined;
        this._initialRequesterAvatarIconUri = initialData?.requesterAvatarIconUri && URI.revive(initialData.requesterAvatarIconUri);
        this._initialResponderAvatarIconUri = isUriComponents(initialData?.responderAvatarIconUri) ? URI.revive(initialData.responderAvatarIconUri) : initialData?.responderAvatarIconUri;
        const lastResponse = observableFromEvent(this, this.onDidChange, () => this._requests.at(-1)?.response);
        this.requestInProgressObs = lastResponse.map((response, r) => {
            return response?.isInProgress.read(r) ?? false;
        });
    }
    startEditingSession(isGlobalEditingSession) {
        const editingSessionPromise = isGlobalEditingSession ?
            this.chatEditingService.startOrContinueGlobalEditingSession(this) :
            this.chatEditingService.createEditingSession(this);
        this._editingSession = new ObservablePromise(editingSessionPromise);
        this._editingSession.promise.then(editingSession => {
            this._store.isDisposed ? editingSession.dispose() : this._register(editingSession);
        });
    }
    notifyEditingAction(action) {
        const state = action.outcome === 'accepted' ? ChatRequestEditedFileEventKind.Keep :
            action.outcome === 'rejected' ? ChatRequestEditedFileEventKind.Undo :
                action.outcome === 'userModified' ? ChatRequestEditedFileEventKind.UserModification : null;
        if (state === null) {
            return;
        }
        if (!this.currentEditedFileEvents.has(action.uri) || this.currentEditedFileEvents.get(action.uri)?.eventKind === ChatRequestEditedFileEventKind.Keep) {
            this.currentEditedFileEvents.set(action.uri, { eventKind: state, uri: action.uri });
        }
    }
    _deserialize(obj) {
        const requests = obj.requests;
        if (!Array.isArray(requests)) {
            this.logService.error(`Ignoring malformed session data: ${JSON.stringify(obj)}`);
            return [];
        }
        try {
            return requests.map((raw) => {
                const parsedRequest = typeof raw.message === 'string'
                    ? this.getParsedRequestFromString(raw.message)
                    : reviveParsedChatRequest(raw.message);
                // Old messages don't have variableData, or have it in the wrong (non-array) shape
                const variableData = this.reviveVariableData(raw.variableData);
                const request = new ChatRequestModel({
                    session: this,
                    message: parsedRequest,
                    variableData,
                    timestamp: raw.timestamp ?? -1,
                    restoredId: raw.requestId,
                    confirmation: raw.confirmation,
                    editedFileEvents: raw.editedFileEvents,
                });
                request.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
                if (raw.response || raw.result || raw.responseErrorDetails) {
                    const agent = (raw.agent && 'metadata' in raw.agent) ? // Check for the new format, ignore entries in the old format
                        reviveSerializedAgent(raw.agent) : undefined;
                    // Port entries from old format
                    const result = 'responseErrorDetails' in raw ?
                        // eslint-disable-next-line local/code-no-dangerous-type-assertions
                        { errorDetails: raw.responseErrorDetails } : raw.result;
                    request.response = new ChatResponseModel({
                        responseContent: raw.response ?? [new MarkdownString(raw.response)],
                        session: this,
                        agent,
                        slashCommand: raw.slashCommand,
                        requestId: request.id,
                        isComplete: true,
                        isCanceled: raw.isCanceled,
                        vote: raw.vote,
                        voteDownReason: raw.voteDownReason,
                        result,
                        followups: raw.followups,
                        restoredId: raw.responseId
                    });
                    request.response.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
                    if (raw.usedContext) { // @ulugbekna: if this's a new vscode sessions, doc versions are incorrect anyway?
                        request.response.applyReference(revive(raw.usedContext));
                    }
                    raw.contentReferences?.forEach(r => request.response.applyReference(revive(r)));
                    raw.codeCitations?.forEach(c => request.response.applyCodeCitation(revive(c)));
                }
                return request;
            });
        }
        catch (error) {
            this.logService.error('Failed to parse chat data', error);
            return [];
        }
    }
    reviveVariableData(raw) {
        const variableData = raw && Array.isArray(raw.variables)
            ? raw :
            { variables: [] };
        variableData.variables = variableData.variables.map((v) => {
            // Old variables format
            if (v && 'values' in v && Array.isArray(v.values)) {
                return {
                    kind: 'generic',
                    id: v.id ?? '',
                    name: v.name,
                    value: v.values[0]?.value,
                    range: v.range,
                    modelDescription: v.modelDescription,
                    references: v.references
                };
            }
            else {
                return v;
            }
        });
        return variableData;
    }
    getParsedRequestFromString(message) {
        // TODO These offsets won't be used, but chat replies need to go through the parser as well
        const parts = [new ChatRequestTextPart(new OffsetRange(0, message.length), { startColumn: 1, startLineNumber: 1, endColumn: 1, endLineNumber: 1 }, message)];
        return {
            text: message,
            parts
        };
    }
    toggleLastRequestPaused(isPaused) {
        if (this.requestPausibility !== 0 /* ChatPauseState.NotPausable */ && this.lastRequest?.response?.agent) {
            const pausedValue = isPaused ?? !this.lastRequest.response.isPaused.get();
            this.lastRequest.response.setPaused(pausedValue);
            this.chatAgentService.setRequestPaused(this.lastRequest.response.agent.id, this.lastRequest.id, pausedValue);
            this._onDidChange.fire({ kind: 'changedRequest', request: this.lastRequest });
        }
    }
    getRequests() {
        return this._requests;
    }
    get checkpoint() {
        return this._checkpoint;
    }
    setDisabledRequests(requestIds) {
        this._requests.forEach((request) => {
            const shouldBeRemovedOnSend = requestIds.find(r => r.requestId === request.id);
            request.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
            if (request.response) {
                request.response.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
            }
        });
        this._onDidChange.fire({
            kind: 'setHidden',
            hiddenRequestIds: requestIds,
        });
    }
    addRequest(message, variableData, attempt, chatAgent, slashCommand, confirmation, locationData, attachments, isCompleteAddedRequest, modelId) {
        const editedFileEvents = [...this.currentEditedFileEvents.values()];
        this.currentEditedFileEvents.clear();
        const request = new ChatRequestModel({
            session: this,
            message,
            variableData,
            timestamp: Date.now(),
            attempt,
            confirmation,
            locationData,
            attachedContext: attachments,
            isCompleteAddedRequest,
            modelId,
            editedFileEvents: editedFileEvents.length ? editedFileEvents : undefined,
        });
        request.response = new ChatResponseModel({
            responseContent: [],
            session: this,
            agent: chatAgent,
            slashCommand,
            requestId: request.id,
            isCompleteAddedRequest
        });
        this._requests.push(request);
        this._lastMessageDate = Date.now();
        this._onDidChange.fire({ kind: 'addRequest', request });
        return request;
    }
    setCustomTitle(title) {
        this._customTitle = title;
    }
    updateRequest(request, variableData) {
        request.variableData = variableData;
        this._onDidChange.fire({ kind: 'changedRequest', request });
    }
    adoptRequest(request) {
        // this doesn't use `removeRequest` because it must not dispose the request object
        const oldOwner = request.session;
        const index = oldOwner._requests.findIndex((candidate) => candidate.id === request.id);
        if (index === -1) {
            return;
        }
        oldOwner._requests.splice(index, 1);
        request.adoptTo(this);
        request.response?.adoptTo(this);
        this._requests.push(request);
        oldOwner._onDidChange.fire({ kind: 'removeRequest', requestId: request.id, responseId: request.response?.id, reason: 2 /* ChatRequestRemovalReason.Adoption */ });
        this._onDidChange.fire({ kind: 'addRequest', request });
    }
    acceptResponseProgress(request, progress, quiet) {
        if (!request.response) {
            request.response = new ChatResponseModel({
                responseContent: [],
                session: this,
                requestId: request.id
            });
        }
        if (request.response.isComplete) {
            throw new Error('acceptResponseProgress: Adding progress to a completed response');
        }
        if (progress.kind === 'usedContext' || progress.kind === 'reference') {
            request.response.applyReference(progress);
        }
        else if (progress.kind === 'codeCitation') {
            request.response.applyCodeCitation(progress);
        }
        else if (progress.kind === 'move') {
            this._onDidChange.fire({ kind: 'move', target: progress.uri, range: progress.range });
        }
        else if (progress.kind === 'codeblockUri' && progress.isEdit) {
            request.response.addUndoStop({ id: generateUuid(), kind: 'undoStop' });
            request.response.updateContent(progress, quiet);
        }
        else if (progress.kind === 'progressTaskResult') {
            // Should have been handled upstream, not sent to model
            this.logService.error(`Couldn't handle progress: ${JSON.stringify(progress)}`);
        }
        else {
            request.response.updateContent(progress, quiet);
        }
    }
    removeRequest(id, reason = 0 /* ChatRequestRemovalReason.Removal */) {
        const index = this._requests.findIndex(request => request.id === id);
        const request = this._requests[index];
        if (index !== -1) {
            this._onDidChange.fire({ kind: 'removeRequest', requestId: request.id, responseId: request.response?.id, reason });
            this._requests.splice(index, 1);
            request.response?.dispose();
        }
    }
    cancelRequest(request) {
        if (request.response) {
            request.response.cancel();
        }
    }
    setResponse(request, result) {
        if (!request.response) {
            request.response = new ChatResponseModel({
                responseContent: [],
                session: this,
                requestId: request.id
            });
        }
        request.response.setResult(result);
    }
    completeResponse(request) {
        if (!request.response) {
            throw new Error('Call setResponse before completeResponse');
        }
        request.response.complete();
        this._onDidChange.fire({ kind: 'completedRequest', request });
    }
    setFollowups(request, followups) {
        if (!request.response) {
            // Maybe something went wrong?
            return;
        }
        request.response.setFollowups(followups);
    }
    setResponseModel(request, response) {
        request.response = response;
        this._onDidChange.fire({ kind: 'addResponse', response });
    }
    toExport() {
        return {
            requesterUsername: this.requesterUsername,
            requesterAvatarIconUri: this.requesterAvatarIconUri,
            responderUsername: this.responderUsername,
            responderAvatarIconUri: this.responderAvatarIcon,
            initialLocation: this.initialLocation,
            requests: this._requests.map((r) => {
                const message = {
                    ...r.message,
                    parts: r.message.parts.map((p) => p && 'toJSON' in p ? p.toJSON() : p)
                };
                const agent = r.response?.agent;
                const agentJson = agent && 'toJSON' in agent ? agent.toJSON() :
                    agent ? { ...agent } : undefined;
                return {
                    requestId: r.id,
                    message,
                    variableData: r.variableData,
                    response: r.response ?
                        r.response.entireResponse.value.map(item => {
                            // Keeping the shape of the persisted data the same for back compat
                            if (item.kind === 'treeData') {
                                return item.treeData;
                            }
                            else if (item.kind === 'markdownContent') {
                                return item.content;
                            }
                            else {
                                return item; // TODO
                            }
                        })
                        : undefined,
                    responseId: r.response?.id,
                    shouldBeRemovedOnSend: r.shouldBeRemovedOnSend,
                    result: r.response?.result,
                    followups: r.response?.followups,
                    isCanceled: r.response?.isCanceled,
                    vote: r.response?.vote,
                    voteDownReason: r.response?.voteDownReason,
                    agent: agentJson,
                    slashCommand: r.response?.slashCommand,
                    usedContext: r.response?.usedContext,
                    contentReferences: r.response?.contentReferences,
                    codeCitations: r.response?.codeCitations,
                    timestamp: r.timestamp,
                    confirmation: r.confirmation,
                    editedFileEvents: r.editedFileEvents,
                };
            }),
        };
    }
    toJSON() {
        return {
            version: 3,
            ...this.toExport(),
            sessionId: this.sessionId,
            creationDate: this._creationDate,
            isImported: this._isImported,
            lastMessageDate: this._lastMessageDate,
            customTitle: this._customTitle
        };
    }
    dispose() {
        this._requests.forEach(r => r.response?.dispose());
        this._onDidDispose.fire();
        super.dispose();
    }
};
ChatModel = ChatModel_1 = __decorate([
    __param(2, ILogService),
    __param(3, IChatAgentService),
    __param(4, IChatEditingService)
], ChatModel);
export { ChatModel };
export function updateRanges(variableData, diff) {
    return {
        variables: variableData.variables.map(v => ({
            ...v,
            range: v.range && {
                start: v.range.start - diff,
                endExclusive: v.range.endExclusive - diff
            }
        }))
    };
}
export function canMergeMarkdownStrings(md1, md2) {
    if (md1.baseUri && md2.baseUri) {
        const baseUriEquals = md1.baseUri.scheme === md2.baseUri.scheme
            && md1.baseUri.authority === md2.baseUri.authority
            && md1.baseUri.path === md2.baseUri.path
            && md1.baseUri.query === md2.baseUri.query
            && md1.baseUri.fragment === md2.baseUri.fragment;
        if (!baseUriEquals) {
            return false;
        }
    }
    else if (md1.baseUri || md2.baseUri) {
        return false;
    }
    return equals(md1.isTrusted, md2.isTrusted) &&
        md1.supportHtml === md2.supportHtml &&
        md1.supportThemeIcons === md2.supportThemeIcons;
}
export function appendMarkdownString(md1, md2) {
    const appendedValue = typeof md2 === 'string' ? md2 : md2.value;
    return {
        value: md1.value + appendedValue,
        isTrusted: md1.isTrusted,
        supportThemeIcons: md1.supportThemeIcons,
        supportHtml: md1.supportHtml,
        baseUri: md1.baseUri
    };
}
export function getCodeCitationsMessage(citations) {
    if (citations.length === 0) {
        return '';
    }
    const licenseTypes = citations.reduce((set, c) => set.add(c.license), new Set());
    const label = licenseTypes.size === 1 ?
        localize('codeCitation', "Similar code found with 1 license type", licenseTypes.size) :
        localize('codeCitations', "Similar code found with {0} license types", licenseTypes.size);
    return label;
}
export var ChatRequestEditedFileEventKind;
(function (ChatRequestEditedFileEventKind) {
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["Keep"] = 1] = "Keep";
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["Undo"] = 2] = "Undo";
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["UserModification"] = 3] = "UserModification";
})(ChatRequestEditedFileEventKind || (ChatRequestEditedFileEventKind = {}));
/** URI for a resource embedded in a chat request/response */
export var ChatResponseResource;
(function (ChatResponseResource) {
    ChatResponseResource.scheme = 'vscode-chat-response-resource';
    function createUri(sessionId, requestId, toolCallId, index, basename) {
        return URI.from({
            scheme: ChatResponseResource.scheme,
            authority: sessionId,
            path: `/tool/${requestId}/${toolCallId}/${index}` + (basename ? `/${basename}` : ''),
        });
    }
    ChatResponseResource.createUri = createUri;
    function parseUri(uri) {
        if (uri.scheme !== ChatResponseResource.scheme) {
            return undefined;
        }
        const parts = uri.path.split('/');
        if (parts.length < 5) {
            return undefined;
        }
        const [, kind, requestId, toolCallId, index] = parts;
        if (kind !== 'tool') {
            return undefined;
        }
        return {
            sessionId: uri.authority,
            requestId: requestId,
            toolCallId: toolCallId,
            index: Number(index),
        };
    }
    ChatResponseResource.parseUri = parseUri;
})(ChatResponseResource || (ChatResponseResource = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0TW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBbUIsY0FBYyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDM0csT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RCxPQUFPLEVBQTZCLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3RLLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFekUsT0FBTyxFQUFFLEdBQUcsRUFBeUIsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0YsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRS9ELE9BQU8sRUFBZ0IsV0FBVyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDakcsT0FBTyxFQUF3QixRQUFRLEVBQUUsVUFBVSxFQUFF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