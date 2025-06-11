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
import { DeferredPromise } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { memoize } from '../../../../base/common/decorators.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { ErrorNoTelemetry } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableMap } from '../../../../base/common/lifecycle.js';
import { revive } from '../../../../base/common/marshalling.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { URI } from '../../../../base/common/uri.js';
import { isLocation } from '../../../../editor/common/languages.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Progress } from '../../../../platform/progress/common/progress.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchAssignmentService } from '../../../services/assignment/common/assignmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IChatAgentService } from './chatAgents.js';
import { ChatModel, ChatRequestModel, isImageVariableEntry, normalizeSerializableChatData, toChatHistoryContent, updateRanges } from './chatModel.js';
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashCommandPart, chatAgentLeader, chatSubcommandLeader, getPromptText } from './chatParserTypes.js';
import { ChatRequestParser } from './chatRequestParser.js';
import { ChatServiceTelemetry } from './chatServiceTelemetry.js';
import { ChatSessionStore } from './chatSessionStore.js';
import { IChatSlashCommandService } from './chatSlashCommands.js';
import { IChatTransferService } from './chatTransferService.js';
import { ChatAgentLocation, ChatConfiguration, ChatMode } from './constants.js';
import { ILanguageModelsService } from './languageModels.js';
import { ILanguageModelToolsService } from './languageModelToolsService.js';
const serializedChatKey = 'interactive.sessions';
const globalChatKey = 'chat.workspaceTransfer';
const SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS = 1000 * 60;
const maxPersistedSessions = 25;
let CancellableRequest = class CancellableRequest {
    constructor(cancellationTokenSource, requestId, toolsService) {
        this.cancellationTokenSource = cancellationTokenSource;
        this.requestId = requestId;
        this.toolsService = toolsService;
    }
    dispose() {
        this.cancellationTokenSource.dispose();
    }
    cancel() {
        if (this.requestId) {
            this.toolsService.cancelToolCallsForRequest(this.requestId);
        }
        this.cancellationTokenSource.cancel();
    }
};
CancellableRequest = __decorate([
    __param(2, ILanguageModelToolsService)
], CancellableRequest);
let ChatService = class ChatService extends Disposable {
    get transferredSessionData() {
        return this._transferredSessionData;
    }
    get useFileStorage() {
        return this.configurationService.getValue(ChatConfiguration.UseFileStorage);
    }
    get edits2Enabled() {
        return this.configurationService.getValue(ChatConfiguration.Edits2Enabled);
    }
    get isEmptyWindow() {
        const workspace = this.workspaceContextService.getWorkspace();
        return !workspace.configuration && workspace.folders.length === 0;
    }
    constructor(storageService, logService, extensionService, instantiationService, telemetryService, workspaceContextService, chatSlashCommandService, chatAgentService, configurationService, experimentService, chatTransferService, languageModelsService) {
        super();
        this.storageService = storageService;
        this.logService = logService;
        this.extensionService = extensionService;
        this.instantiationService = instantiationService;
        this.telemetryService = telemetryService;
        this.workspaceContextService = workspaceContextService;
        this.chatSlashCommandService = chatSlashCommandService;
        this.chatAgentService = chatAgentService;
        this.configurationService = configurationService;
        this.experimentService = experimentService;
        this.chatTransferService = chatTransferService;
        this.languageModelsService = languageModelsService;
        this._sessionModels = this._register(new DisposableMap());
        this._pendingRequests = this._register(new DisposableMap());
        /** Just for empty windows, need to enforce that a chat was deleted, even though other windows still have it */
        this._deletedChatIds = new Set();
        this._onDidSubmitRequest = this._register(new Emitter());
        this.onDidSubmitRequest = this._onDidSubmitRequest.event;
        this._onDidPerformUserAction = this._register(new Emitter());
        this.onDidPerformUserAction = this._onDidPerformUserAction.event;
        this._onDidDisposeSession = this._register(new Emitter());
        this.onDidDisposeSession = this._onDidDisposeSession.event;
        this._sessionFollowupCancelTokens = this._register(new DisposableMap());
        this._chatServiceTelemetry = this.instantiationService.createInstance(ChatServiceTelemetry);
        const sessionData = storageService.get(serializedChatKey, this.isEmptyWindow ? -1 /* StorageScope.APPLICATION */ : 1 /* StorageScope.WORKSPACE */, '');
        if (sessionData) {
            this._persistedSessions = this.deserializeChats(sessionData);
            const countsForLog = Object.keys(this._persistedSessions).length;
            if (countsForLog > 0) {
                this.trace('constructor', `Restored ${countsForLog} persisted sessions`);
            }
        }
        else {
            this._persistedSessions = {};
        }
        const transferredData = this.getTransferredSessionData();
        const transferredChat = transferredData?.chat;
        if (transferredChat) {
            this.trace('constructor', `Transferred session ${transferredChat.sessionId}`);
            this._persistedSessions[transferredChat.sessionId] = transferredChat;
            this._transferredSessionData = {
                sessionId: transferredChat.sessionId,
                inputValue: transferredData.inputValue,
                location: transferredData.location,
                mode: transferredData.mode,
            };
        }
        this._chatSessionStore = this._register(this.instantiationService.createInstance(ChatSessionStore));
        if (this.useFileStorage) {
            this._chatSessionStore.migrateDataIfNeeded(() => this._persistedSessions);
        }
        this._register(storageService.onWillSaveState(() => this.saveState()));
    }
    isEnabled(location) {
        return this.chatAgentService.getContributedDefaultAgent(location) !== undefined;
    }
    saveState() {
        const liveChats = Array.from(this._sessionModels.values())
            .filter(session => session.initialLocation === ChatAgentLocation.Panel);
        if (this.useFileStorage) {
            this._chatSessionStore.storeSessions(liveChats);
        }
        else {
            if (this.isEmptyWindow) {
                this.syncEmptyWindowChats(liveChats);
            }
            else {
                let allSessions = liveChats;
                allSessions = allSessions.concat(Object.values(this._persistedSessions)
                    .filter(session => !this._sessionModels.has(session.sessionId))
                    .filter(session => session.requests.length));
                allSessions.sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0));
                allSessions = allSessions.slice(0, maxPersistedSessions);
                if (allSessions.length) {
                    this.trace('onWillSaveState', `Persisting ${allSessions.length} sessions`);
                }
                const serialized = JSON.stringify(allSessions);
                if (allSessions.length) {
                    this.trace('onWillSaveState', `Persisting ${serialized.length} chars`);
                }
                this.storageService.store(serializedChatKey, serialized, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            }
        }
        this._deletedChatIds.clear();
    }
    syncEmptyWindowChats(thisWindowChats) {
        // Note- an unavoidable race condition exists here. If there are multiple empty windows open, and the user quits the application, then the focused
        // window may lose active chats, because all windows are reading and writing to storageService at the same time. This can't be fixed without some
        // kind of locking, but in reality, the focused window will likely have run `saveState` at some point, like on a window focus change, and it will
        // generally be fine.
        const sessionData = this.storageService.get(serializedChatKey, -1 /* StorageScope.APPLICATION */, '');
        const originalPersistedSessions = this._persistedSessions;
        let persistedSessions;
        if (sessionData) {
            persistedSessions = this.deserializeChats(sessionData);
            const countsForLog = Object.keys(persistedSessions).length;
            if (countsForLog > 0) {
                this.trace('constructor', `Restored ${countsForLog} persisted sessions`);
            }
        }
        else {
            persistedSessions = {};
        }
        this._deletedChatIds.forEach(id => delete persistedSessions[id]);
        // Has the chat in this window been updated, and then closed? Overwrite the old persisted chats.
        Object.values(originalPersistedSessions).forEach(session => {
            const persistedSession = persistedSessions[session.sessionId];
            if (persistedSession && session.requests.length > persistedSession.requests.length) {
                // We will add a 'modified date' at some point, but comparing the number of requests is good enough
                persistedSessions[session.sessionId] = session;
            }
            else if (!persistedSession && session.isNew) {
                // This session was created in this window, and hasn't been persisted yet
                session.isNew = false;
                persistedSessions[session.sessionId] = session;
            }
        });
        this._persistedSessions = persistedSessions;
        // Add this window's active chat models to the set to persist.
        // Having the same session open in two empty windows at the same time can lead to data loss, this is acceptable
        const allSessions = { ...this._persistedSessions };
        for (const chat of thisWindowChats) {
            allSessions[chat.sessionId] = chat;
        }
        let sessionsList = Object.values(allSessions);
        sessionsList.sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0));
        sessionsList = sessionsList.slice(0, maxPersistedSessions);
        const data = JSON.stringify(sessionsList);
        this.storageService.store(serializedChatKey, data, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
    }
    notifyUserAction(action) {
        this._chatServiceTelemetry.notifyUserAction(action);
        this._onDidPerformUserAction.fire(action);
        if (action.action.kind === 'chatEditingSessionAction') {
            const model = this._sessionModels.get(action.sessionId);
            if (model) {
                model.notifyEditingAction(action.action);
            }
        }
    }
    async setChatSessionTitle(sessionId, title) {
        const model = this._sessionModels.get(sessionId);
        if (model) {
            model.setCustomTitle(title);
            return;
        }
        if (this.useFileStorage) {
            await this._chatSessionStore.setSessionTitle(sessionId, title);
            return;
        }
        const session = this._persistedSessions[sessionId];
        if (session) {
            session.customTitle = title;
        }
    }
    trace(method, message) {
        if (message) {
            this.logService.trace(`ChatService#${method}: ${message}`);
        }
        else {
            this.logService.trace(`ChatService#${method}`);
        }
    }
    error(method, message) {
        this.logService.error(`ChatService#${method} ${message}`);
    }
    deserializeChats(sessionData) {
        try {
            const arrayOfSessions = revive(JSON.parse(sessionData)); // Revive serialized URIs in session data
            if (!Array.isArray(arrayOfSessions)) {
                throw new Error('Expected array');
            }
            const sessions = arrayOfSessions.reduce((acc, session) => {
                // Revive serialized markdown strings in response data
                for (const request of session.requests) {
                    if (Array.isArray(request.response)) {
                        request.response = request.response.map((response) => {
                            if (typeof response === 'string') {
                                return new MarkdownString(response);
                            }
                            return response;
                        });
                    }
                    else if (typeof request.response === 'string') {
                        request.response = [new MarkdownString(request.response)];
                    }
                }
                acc[session.sessionId] = normalizeSerializableChatData(session);
                return acc;
            }, {});
            return sessions;
        }
        catch (err) {
            this.error('deserializeChats', `Malformed session data: ${err}. [${sessionData.substring(0, 20)}${sessionData.length > 20 ? '...' : ''}]`);
            return {};
        }
    }
    getTransferredSessionData() {
        const data = this.storageService.getObject(globalChatKey, 0 /* StorageScope.PROFILE */, []);
        const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
        if (!workspaceUri) {
            return;
        }
        const thisWorkspace = workspaceUri.toString();
        const currentTime = Date.now();
        // Only use transferred data if it was created recently
        const transferred = data.find(item => URI.revive(item.toWorkspace).toString() === thisWorkspace && (currentTime - item.timestampInMilliseconds < SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS));
        // Keep data that isn't for the current workspace and that hasn't expired yet
        const filtered = data.filter(item => URI.revive(item.toWorkspace).toString() !== thisWorkspace && (currentTime - item.timestampInMilliseconds < SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS));
        this.storageService.store(globalChatKey, JSON.stringify(filtered), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        return transferred;
    }
    /**
     * Returns an array of chat details for all persisted chat sessions that have at least one request.
     * Chat sessions that have already been loaded into the chat view are excluded from the result.
     * Imported chat sessions are also excluded from the result.
     */
    async getHistory() {
        if (this.useFileStorage) {
            const liveSessionItems = Array.from(this._sessionModels.values())
                .filter(session => !session.isImported)
                .map(session => {
                const title = session.title || localize('newChat', "New Chat");
                return {
                    sessionId: session.sessionId,
                    title,
                    lastMessageDate: session.lastMessageDate,
                    isActive: true,
                };
            });
            const index = await this._chatSessionStore.getIndex();
            const entries = Object.values(index)
                .filter(entry => !this._sessionModels.has(entry.sessionId) && !entry.isImported && !entry.isEmpty)
                .map((entry) => ({
                ...entry,
                isActive: this._sessionModels.has(entry.sessionId),
            }));
            return [...liveSessionItems, ...entries];
        }
        const persistedSessions = Object.values(this._persistedSessions)
            .filter(session => session.requests.length > 0)
            .filter(session => !this._sessionModels.has(session.sessionId));
        const persistedSessionItems = persistedSessions
            .filter(session => !session.isImported)
            .map(session => {
            const title = session.customTitle ?? ChatModel.getDefaultTitle(session.requests);
            return {
                sessionId: session.sessionId,
                title,
                lastMessageDate: session.lastMessageDate,
                isActive: false,
            };
        });
        const liveSessionItems = Array.from(this._sessionModels.values())
            .filter(session => !session.isImported)
            .map(session => {
            const title = session.title || localize('newChat', "New Chat");
            return {
                sessionId: session.sessionId,
                title,
                lastMessageDate: session.lastMessageDate,
                isActive: true,
            };
        });
        return [...liveSessionItems, ...persistedSessionItems];
    }
    async removeHistoryEntry(sessionId) {
        if (this.useFileStorage) {
            await this._chatSessionStore.deleteSession(sessionId);
            return;
        }
        if (this._persistedSessions[sessionId]) {
            this._deletedChatIds.add(sessionId);
            delete this._persistedSessions[sessionId];
            this.saveState();
        }
    }
    async clearAllHistoryEntries() {
        if (this.useFileStorage) {
            await this._chatSessionStore.clearAllSessions();
            return;
        }
        Object.values(this._persistedSessions).forEach(session => this._deletedChatIds.add(session.sessionId));
        this._persistedSessions = {};
        this.saveState();
    }
    startSession(location, token, isGlobalEditingSession = true) {
        this.trace('startSession');
        return this._startSession(undefined, location, isGlobalEditingSession, token);
    }
    _startSession(someSessionHistory, location, isGlobalEditingSession, token) {
        const model = this.instantiationService.createInstance(ChatModel, someSessionHistory, location);
        if (location === ChatAgentLocation.Panel) {
            model.startEditingSession(isGlobalEditingSession);
        }
        this._sessionModels.set(model.sessionId, model);
        this.initializeSession(model, token);
        return model;
    }
    initializeSession(model, token) {
        this.trace('initializeSession', `Initialize session ${model.sessionId}`);
        // Activate the default extension provided agent but do not wait
        // for it to be ready so that the session can be used immediately
        // without having to wait for the agent to be ready.
        this.activateDefaultAgent(model.initialLocation).catch(e => this.logService.error(e));
    }
    async activateDefaultAgent(location) {
        await this.extensionService.whenInstalledExtensionsRegistered();
        const defaultAgentData = this.chatAgentService.getContributedDefaultAgent(location) ?? this.chatAgentService.getContributedDefaultAgent(ChatAgentLocation.Panel);
        if (!defaultAgentData) {
            throw new ErrorNoTelemetry('No default agent contributed');
        }
        // Await activation of the extension provided agent
        // Using `activateById` as workaround for the issue
        // https://github.com/microsoft/vscode/issues/250590
        if (!defaultAgentData.isCore) {
            await this.extensionService.activateById(defaultAgentData.extensionId, {
                activationEvent: `onChatParticipant:${defaultAgentData.id}`,
                extensionId: defaultAgentData.extensionId,
                startup: false
            });
        }
        const defaultAgent = this.chatAgentService.getActivatedAgents().find(agent => agent.id === defaultAgentData.id);
        if (!defaultAgent) {
            throw new ErrorNoTelemetry('No default agent registered');
        }
    }
    getSession(sessionId) {
        return this._sessionModels.get(sessionId);
    }
    async getOrRestoreSession(sessionId) {
        this.trace('getOrRestoreSession', `sessionId: ${sessionId}`);
        const model = this._sessionModels.get(sessionId);
        if (model) {
            return model;
        }
        let sessionData;
        if (!this.useFileStorage || this.transferredSessionData?.sessionId === sessionId) {
            sessionData = revive(this._persistedSessions[sessionId]);
        }
        else {
            sessionData = revive(await this._chatSessionStore.readSession(sessionId));
        }
        if (!sessionData) {
            return undefined;
        }
        const session = this._startSession(sessionData, sessionData.initialLocation ?? ChatAgentLocation.Panel, true, CancellationToken.None);
        const isTransferred = this.transferredSessionData?.sessionId === sessionId;
        if (isTransferred) {
            // TODO
            // this.chatAgentService.toggleToolsAgentMode(this.transferredSessionData.toolsAgentModeEnabled);
            this._transferredSessionData = undefined;
        }
        return session;
    }
    /**
     * This is really just for migrating data from the edit session location to the panel.
     */
    isPersistedSessionEmpty(sessionId) {
        const session = this._persistedSessions[sessionId];
        if (session) {
            return session.requests.length === 0;
        }
        return this._chatSessionStore.isSessionEmpty(sessionId);
    }
    loadSessionFromContent(data) {
        return this._startSession(data, data.initialLocation ?? ChatAgentLocation.Panel, true, CancellationToken.None);
    }
    async resendRequest(request, options) {
        const model = this._sessionModels.get(request.session.sessionId);
        if (!model && model !== request.session) {
            throw new Error(`Unknown session: ${request.session.sessionId}`);
        }
        const cts = this._pendingRequests.get(request.session.sessionId);
        if (cts) {
            this.trace('resendRequest', `Session ${request.session.sessionId} already has a pending request, cancelling...`);
            cts.cancel();
        }
        const location = options?.location ?? model.initialLocation;
        const attempt = options?.attempt ?? 0;
        const enableCommandDetection = !options?.noCommandDetection;
        const defaultAgent = this.chatAgentService.getDefaultAgent(location, options?.mode);
        model.removeRequest(request.id, 1 /* ChatRequestRemovalReason.Resend */);
        const resendOptions = {
            ...options,
            locationData: request.locationData,
            attachedContext: request.attachedContext,
        };
        await this._sendRequestAsync(model, model.sessionId, request.message, attempt, enableCommandDetection, defaultAgent, location, resendOptions).responseCompletePromise;
    }
    async sendRequest(sessionId, request, options) {
        this.trace('sendRequest', `sessionId: ${sessionId}, message: ${request.substring(0, 20)}${request.length > 20 ? '[...]' : ''}}`);
        if (!request.trim() && !options?.slashCommand && !options?.agentId) {
            this.trace('sendRequest', 'Rejected empty message');
            return;
        }
        const model = this._sessionModels.get(sessionId);
        if (!model) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        if (this._pendingRequests.has(sessionId)) {
            this.trace('sendRequest', `Session ${sessionId} already has a pending request`);
            return;
        }
        const requests = model.getRequests();
        for (let i = requests.length - 1; i >= 0; i -= 1) {
            const request = requests[i];
            if (request.shouldBeRemovedOnSend) {
                if (request.shouldBeRemovedOnSend.afterUndoStop) {
                    request.response?.finalizeUndoState();
                }
                else {
                    this.removeRequest(sessionId, request.id);
                }
            }
        }
        const location = options?.location ?? model.initialLocation;
        const attempt = options?.attempt ?? 0;
        const defaultAgent = this.chatAgentService.getDefaultAgent(location, options?.mode);
        const parsedRequest = this.parseChatRequest(sessionId, request, location, options);
        const agent = parsedRequest.parts.find((r) => r instanceof ChatRequestAgentPart)?.agent ?? defaultAgent;
        const agentSlashCommandPart = parsedRequest.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
        // This method is only returning whether the request was accepted - don't block on the actual request
        return {
            ...this._sendRequestAsync(model, sessionId, parsedRequest, attempt, !options?.noCommandDetection, defaultAgent, location, options),
            agent,
            slashCommand: agentSlashCommandPart?.command,
        };
    }
    parseChatRequest(sessionId, request, location, options) {
        let parserContext = options?.parserContext;
        if (options?.agentId) {
            const agent = this.chatAgentService.getAgent(options.agentId);
            if (!agent) {
                throw new Error(`Unknown agent: ${options.agentId}`);
            }
            parserContext = { selectedAgent: agent, mode: options.mode };
            const commandPart = options.slashCommand ? ` ${chatSubcommandLeader}${options.slashCommand}` : '';
            request = `${chatAgentLeader}${agent.name}${commandPart} ${request}`;
        }
        const parsedRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(sessionId, request, location, parserContext);
        return parsedRequest;
    }
    refreshFollowupsCancellationToken(sessionId) {
        this._sessionFollowupCancelTokens.get(sessionId)?.cancel();
        const newTokenSource = new CancellationTokenSource();
        this._sessionFollowupCancelTokens.set(sessionId, newTokenSource);
        return newTokenSource.token;
    }
    _sendRequestAsync(model, sessionId, parsedRequest, attempt, enableCommandDetection, defaultAgent, location, options) {
        const followupsCancelToken = this.refreshFollowupsCancellationToken(sessionId);
        let request;
        const agentPart = 'kind' in parsedRequest ? undefined : parsedRequest.parts.find((r) => r instanceof ChatRequestAgentPart);
        const agentSlashCommandPart = 'kind' in parsedRequest ? undefined : parsedRequest.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
        const commandPart = 'kind' in parsedRequest ? undefined : parsedRequest.parts.find((r) => r instanceof ChatRequestSlashCommandPart);
        const requests = [...model.getRequests()];
        let gotProgress = false;
        const requestType = commandPart ? 'slashCommand' : 'string';
        const responseCreated = new DeferredPromise();
        let responseCreatedComplete = false;
        function completeResponseCreated() {
            if (!responseCreatedComplete && request?.response) {
                responseCreated.complete(request.response);
                responseCreatedComplete = true;
            }
        }
        const source = new CancellationTokenSource();
        const token = source.token;
        const sendRequestInternal = async () => {
            const progressCallback = (progress) => {
                if (token.isCancellationRequested) {
                    return;
                }
                gotProgress = true;
                for (let i = 0; i < progress.length; i++) {
                    const isLast = i === progress.length - 1;
                    const progressItem = progress[i];
                    if (progressItem.kind === 'markdownContent') {
                        this.trace('sendRequest', `Provider returned progress for session ${model.sessionId}, ${progressItem.content.value.length} chars`);
                    }
                    else {
                        this.trace('sendRequest', `Provider returned progress: ${JSON.stringify(progressItem)}`);
                    }
                    model.acceptResponseProgress(request, progressItem, !isLast);
                }
                completeResponseCreated();
            };
            let detectedAgent;
            let detectedCommand;
            const stopWatch = new StopWatch(false);
            const listener = token.onCancellationRequested(() => {
                this.trace('sendRequest', `Request for session ${model.sessionId} was cancelled`);
                this.telemetryService.publicLog2('interactiveSessionProviderInvoked', {
                    timeToFirstProgress: undefined,
                    // Normally timings happen inside the EH around the actual provider. For cancellation we can measure how long the user waited before cancelling
                    totalTime: stopWatch.elapsed(),
                    result: 'cancelled',
                    requestType,
                    agent: detectedAgent?.id ?? agentPart?.agent.id ?? '',
                    agentExtensionId: detectedAgent?.extensionId.value ?? agentPart?.agent.extensionId.value ?? '',
                    slashCommand: agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command,
                    chatSessionId: model.sessionId,
                    location,
                    citations: request?.response?.codeCitations.length ?? 0,
                    numCodeBlocks: getCodeBlocks(request.response?.response.toString() ?? '').length,
                    isParticipantDetected: !!detectedAgent,
                    enableCommandDetection,
                    attachmentKinds: this.attachmentKindsForTelemetry(request.variableData),
                    model: this.resolveModelId(options?.userSelectedModelId),
                });
                model.cancelRequest(request);
            });
            try {
                let rawResult;
                let agentOrCommandFollowups = undefined;
                let chatTitlePromise;
                if (agentPart || (defaultAgent && !commandPart)) {
                    const prepareChatAgentRequest = (agent, command, enableCommandDetection, chatRequest, isParticipantDetected) => {
                        const initVariableData = { variables: [] };
                        request = chatRequest ?? model.addRequest(parsedRequest, initVariableData, attempt, agent, command, options?.confirmation, options?.locationData, options?.attachedContext, undefined, options?.userSelectedModelId);
                        let variableData;
                        let message;
                        if (chatRequest) {
                            variableData = chatRequest.variableData;
                            message = getPromptText(request.message).message;
                        }
                        else {
                            variableData = { variables: this.prepareContext(request.attachedContext) };
                            model.updateRequest(request, variableData);
                            const promptTextResult = getPromptText(request.message);
                            variableData = updateRanges(variableData, promptTextResult.diff); // TODO bit of a hack
                            message = promptTextResult.message;
                        }
                        return {
                            sessionId,
                            requestId: request.id,
                            agentId: agent.id,
                            message,
                            command: command?.name,
                            variables: variableData,
                            enableCommandDetection,
                            isParticipantDetected,
                            attempt,
                            location,
                            locationData: request.locationData,
                            acceptedConfirmationData: options?.acceptedConfirmationData,
                            rejectedConfirmationData: options?.rejectedConfirmationData,
                            userSelectedModelId: options?.userSelectedModelId,
                            userSelectedTools: options?.userSelectedTools,
                            modeInstructions: options?.modeInstructions,
                            editedFileEvents: request.editedFileEvents
                        };
                    };
                    if (this.configurationService.getValue('chat.detectParticipant.enabled') !== false && this.chatAgentService.hasChatParticipantDetectionProviders() && !agentPart && !commandPart && !agentSlashCommandPart && enableCommandDetection && options?.mode !== ChatMode.Agent && options?.mode !== ChatMode.Edit) {
                        // We have no agent or command to scope history with, pass the full history to the participant detection provider
                        const defaultAgentHistory = this.getHistoryEntriesFromModel(requests, model.sessionId, location, defaultAgent.id);
                        // Prepare the request object that we will send to the participant detection provider
                        const chatAgentRequest = prepareChatAgentRequest(defaultAgent, undefined, enableCommandDetection, undefined, false);
                        const result = await this.chatAgentService.detectAgentOrCommand(chatAgentRequest, defaultAgentHistory, { location }, token);
                        if (result && this.chatAgentService.getAgent(result.agent.id)?.locations?.includes(location)) {
                            // Update the response in the ChatModel to reflect the detected agent and command
                            request.response?.setAgent(result.agent, result.command);
                            detectedAgent = result.agent;
                            detectedCommand = result.command;
                        }
                    }
                    const agent = (detectedAgent ?? agentPart?.agent ?? defaultAgent);
                    const command = detectedCommand ?? agentSlashCommandPart?.command;
                    await this.extensionService.activateByEvent(`onChatParticipant:${agent.id}`);
                    await this.checkAgentAllowed(agent);
                    // Recompute history in case the agent or command changed
                    const history = this.getHistoryEntriesFromModel(requests, model.sessionId, location, agent.id);
                    const requestProps = prepareChatAgentRequest(agent, command, enableCommandDetection, request /* Reuse the request object if we already created it for participant detection */, !!detectedAgent);
                    const pendingRequest = this._pendingRequests.get(sessionId);
                    if (pendingRequest && !pendingRequest.requestId) {
                        pendingRequest.requestId = requestProps.requestId;
                    }
                    completeResponseCreated();
                    const agentResult = await this.chatAgentService.invokeAgent(agent.id, requestProps, progressCallback, history, token);
                    rawResult = agentResult;
                    agentOrCommandFollowups = this.chatAgentService.getFollowups(agent.id, requestProps, agentResult, history, followupsCancelToken);
                    chatTitlePromise = model.getRequests().length === 1 && !model.customTitle ? this.chatAgentService.getChatTitle(defaultAgent.id, this.getHistoryEntriesFromModel(model.getRequests(), model.sessionId, location, agent.id), CancellationToken.None) : undefined;
                }
                else if (commandPart && this.chatSlashCommandService.hasCommand(commandPart.slashCommand.command)) {
                    if (commandPart.slashCommand.silent !== true) {
                        request = model.addRequest(parsedRequest, { variables: [] }, attempt);
                        completeResponseCreated();
                    }
                    // contributed slash commands
                    // TODO: spell this out in the UI
                    const history = [];
                    for (const modelRequest of model.getRequests()) {
                        if (!modelRequest.response) {
                            continue;
                        }
                        history.push({ role: 1 /* ChatMessageRole.User */, content: [{ type: 'text', value: modelRequest.message.text }] });
                        history.push({ role: 2 /* ChatMessageRole.Assistant */, content: [{ type: 'text', value: modelRequest.response.response.toString() }] });
                    }
                    const message = parsedRequest.text;
                    const commandResult = await this.chatSlashCommandService.executeCommand(commandPart.slashCommand.command, message.substring(commandPart.slashCommand.command.length + 1).trimStart(), new Progress(p => {
                        progressCallback([p]);
                    }), history, location, token);
                    agentOrCommandFollowups = Promise.resolve(commandResult?.followUp);
                    rawResult = {};
                }
                else {
                    throw new Error(`Cannot handle request`);
                }
                if (token.isCancellationRequested && !rawResult) {
                    return;
                }
                else {
                    if (!rawResult) {
                        this.trace('sendRequest', `Provider returned no response for session ${model.sessionId}`);
                        rawResult = { errorDetails: { message: localize('emptyResponse', "Provider returned null response") } };
                    }
                    const result = rawResult.errorDetails?.responseIsFiltered ? 'filtered' :
                        rawResult.errorDetails && gotProgress ? 'errorWithOutput' :
                            rawResult.errorDetails ? 'error' :
                                'success';
                    const commandForTelemetry = agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command;
                    this.telemetryService.publicLog2('interactiveSessionProviderInvoked', {
                        timeToFirstProgress: rawResult.timings?.firstProgress,
                        totalTime: rawResult.timings?.totalElapsed,
                        result,
                        requestType,
                        agent: detectedAgent?.id ?? agentPart?.agent.id ?? '',
                        agentExtensionId: detectedAgent?.extensionId.value ?? agentPart?.agent.extensionId.value ?? '',
                        slashCommand: commandForTelemetry,
                        chatSessionId: model.sessionId,
                        enableCommandDetection,
                        isParticipantDetected: !!detectedAgent,
                        location,
                        citations: request.response?.codeCitations.length ?? 0,
                        numCodeBlocks: getCodeBlocks(request.response?.response.toString() ?? '').length,
                        attachmentKinds: this.attachmentKindsForTelemetry(request.variableData),
                        model: this.resolveModelId(options?.userSelectedModelId),
                    });
                    model.setResponse(request, rawResult);
                    completeResponseCreated();
                    this.trace('sendRequest', `Provider returned response for session ${model.sessionId}`);
                    model.completeResponse(request);
                    if (agentOrCommandFollowups) {
                        agentOrCommandFollowups.then(followups => {
                            model.setFollowups(request, followups);
                            this._chatServiceTelemetry.retrievedFollowups(agentPart?.agent.id ?? '', commandForTelemetry, followups?.length ?? 0);
                        });
                    }
                    chatTitlePromise?.then(title => {
                        if (title) {
                            model.setCustomTitle(title);
                        }
                    });
                }
            }
            catch (err) {
                const result = 'error';
                this.telemetryService.publicLog2('interactiveSessionProviderInvoked', {
                    timeToFirstProgress: undefined,
                    totalTime: undefined,
                    result,
                    requestType,
                    agent: detectedAgent?.id ?? agentPart?.agent.id ?? '',
                    agentExtensionId: detectedAgent?.extensionId.value ?? agentPart?.agent.extensionId.value ?? '',
                    slashCommand: agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command,
                    chatSessionId: model.sessionId,
                    location,
                    citations: 0,
                    numCodeBlocks: 0,
                    enableCommandDetection,
                    isParticipantDetected: !!detectedAgent,
                    attachmentKinds: this.attachmentKindsForTelemetry(request.variableData),
                    model: this.resolveModelId(options?.userSelectedModelId)
                });
                this.logService.error(`Error while handling chat request: ${toErrorMessage(err, true)}`);
                if (request) {
                    const rawResult = { errorDetails: { message: err.message } };
                    model.setResponse(request, rawResult);
                    completeResponseCreated();
                    model.completeResponse(request);
                }
            }
            finally {
                listener.dispose();
            }
        };
        const rawResponsePromise = sendRequestInternal();
        // Note- requestId is not known at this point, assigned later
        this._pendingRequests.set(model.sessionId, this.instantiationService.createInstance(CancellableRequest, source, undefined));
        rawResponsePromise.finally(() => {
            this._pendingRequests.deleteAndDispose(model.sessionId);
        });
        this._onDidSubmitRequest.fire({ chatSessionId: model.sessionId });
        return {
            responseCreatedPromise: responseCreated.p,
            responseCompletePromise: rawResponsePromise,
        };
    }
    resolveModelId(userSelectedModelId) {
        return userSelectedModelId && this.languageModelsService.lookupLanguageModel(userSelectedModelId)?.id;
    }
    prepareContext(attachedContextVariables) {
        attachedContextVariables ??= [];
        // "reverse", high index first so that replacement is simple
        attachedContextVariables.sort((a, b) => {
            // If either range is undefined, sort it to the back
            if (!a.range && !b.range) {
                return 0; // Keep relative order if both ranges are undefined
            }
            if (!a.range) {
                return 1; // a goes after b
            }
            if (!b.range) {
                return -1; // a goes before b
            }
            return b.range.start - a.range.start;
        });
        return attachedContextVariables;
    }
    async checkAgentAllowed(agent) {
        if (agent.modes.includes(ChatMode.Agent)) {
            const enabled = await this.experimentService.getTreatment('chatAgentEnabled');
            if (enabled === false) {
                throw new Error('Agent is currently disabled');
            }
        }
    }
    attachmentKindsForTelemetry(variableData) {
        // TODO this shows why attachments still have to be cleaned up somewhat
        return variableData.variables.map(v => {
            if (v.kind === 'implicit') {
                return 'implicit';
            }
            else if (v.range) {
                // 'range' is range within the prompt text
                if (v.kind === 'tool') {
                    return 'toolInPrompt';
                }
                else if (v.kind === 'toolset') {
                    return 'toolsetInPrompt';
                }
                else {
                    return 'fileInPrompt';
                }
            }
            else if (v.kind === 'command') {
                return 'command';
            }
            else if (v.kind === 'symbol') {
                return 'symbol';
            }
            else if (isImageVariableEntry(v)) {
                return 'image';
            }
            else if (v.kind === 'directory') {
                return 'directory';
            }
            else if (v.kind === 'tool') {
                return 'tool';
            }
            else if (v.kind === 'toolset') {
                return 'toolset';
            }
            else {
                if (URI.isUri(v.value)) {
                    return 'file';
                }
                else if (isLocation(v.value)) {
                    return 'location';
                }
                else {
                    return 'otherAttachment';
                }
            }
        });
    }
    getHistoryEntriesFromModel(requests, sessionId, location, forAgentId) {
        const history = [];
        const agent = this.chatAgentService.getAgent(forAgentId);
        for (const request of requests) {
            if (!request.response) {
                continue;
            }
            if (forAgentId !== request.response.agent?.id && !agent?.isDefault) {
                // An agent only gets to see requests that were sent to this agent.
                // The default agent (the undefined case) gets to see all of them.
                continue;
            }
            const promptTextResult = getPromptText(request.message);
            const historyRequest = {
                sessionId: sessionId,
                requestId: request.id,
                agentId: request.response.agent?.id ?? '',
                message: promptTextResult.message,
                command: request.response.slashCommand?.name,
                variables: updateRanges(request.variableData, promptTextResult.diff), // TODO bit of a hack
                location: ChatAgentLocation.Panel,
                editedFileEvents: request.editedFileEvents,
            };
            history.push({ request: historyRequest, response: toChatHistoryContent(request.response.response.value), result: request.response.result ?? {} });
        }
        return history;
    }
    async removeRequest(sessionId, requestId) {
        const model = this._sessionModels.get(sessionId);
        if (!model) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        const pendingRequest = this._pendingRequests.get(sessionId);
        if (pendingRequest?.requestId === requestId) {
            pendingRequest.cancel();
            this._pendingRequests.deleteAndDispose(sessionId);
        }
        model.removeRequest(requestId);
    }
    async adoptRequest(sessionId, request) {
        if (!(request instanceof ChatRequestModel)) {
            throw new TypeError('Can only adopt requests of type ChatRequestModel');
        }
        const target = this._sessionModels.get(sessionId);
        if (!target) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        const oldOwner = request.session;
        target.adoptRequest(request);
        if (request.response && !request.response.isComplete) {
            const cts = this._pendingRequests.deleteAndLeak(oldOwner.sessionId);
            if (cts) {
                cts.requestId = request.id;
                this._pendingRequests.set(target.sessionId, cts);
            }
        }
    }
    async addCompleteRequest(sessionId, message, variableData, attempt, response) {
        this.trace('addCompleteRequest', `message: ${message}`);
        const model = this._sessionModels.get(sessionId);
        if (!model) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        const parsedRequest = typeof message === 'string' ?
            this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(sessionId, message) :
            message;
        const request = model.addRequest(parsedRequest, variableData || { variables: [] }, attempt ?? 0, undefined, undefined, undefined, undefined, undefined, true);
        if (typeof response.message === 'string') {
            // TODO is this possible?
            model.acceptResponseProgress(request, { content: new MarkdownString(response.message), kind: 'markdownContent' });
        }
        else {
            for (const part of response.message) {
                model.acceptResponseProgress(request, part, true);
            }
        }
        model.setResponse(request, response.result || {});
        if (response.followups !== undefined) {
            model.setFollowups(request, response.followups);
        }
        model.completeResponse(request);
    }
    cancelCurrentRequestForSession(sessionId) {
        this.trace('cancelCurrentRequestForSession', `sessionId: ${sessionId}`);
        this._pendingRequests.get(sessionId)?.cancel();
        this._pendingRequests.deleteAndDispose(sessionId);
    }
    async clearSession(sessionId) {
        this.trace('clearSession', `sessionId: ${sessionId}`);
        const model = this._sessionModels.get(sessionId);
        if (!model) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        if (model.initialLocation === ChatAgentLocation.Panel) {
            if (this.useFileStorage) {
                if (model.getRequests().length === 0) {
                    await this._chatSessionStore.deleteSession(sessionId);
                }
                else {
                    await this._chatSessionStore.storeSessions([model]);
                }
            }
            else {
                if (model.getRequests().length === 0) {
                    delete this._persistedSessions[sessionId];
                }
                else {
                    // Turn all the real objects into actual JSON, otherwise, calling 'revive' may fail when it tries to
                    // assign values to properties that are getters- microsoft/vscode-copilot-release#1233
                    const sessionData = JSON.parse(JSON.stringify(model));
                    sessionData.isNew = true;
                    this._persistedSessions[sessionId] = sessionData;
                }
            }
        }
        this._sessionModels.deleteAndDispose(sessionId);
        this._pendingRequests.get(sessionId)?.cancel();
        this._pendingRequests.deleteAndDispose(sessionId);
        this._onDidDisposeSession.fire({ sessionId, reason: 'cleared' });
    }
    hasSessions() {
        if (this.useFileStorage) {
            return this._chatSessionStore.hasSessions();
        }
        else {
            return Object.values(this._persistedSessions).length > 0;
        }
    }
    transferChatSession(transferredSessionData, toWorkspace) {
        const model = Iterable.find(this._sessionModels.values(), model => model.sessionId === transferredSessionData.sessionId);
        if (!model) {
            throw new Error(`Failed to transfer session. Unknown session ID: ${transferredSessionData.sessionId}`);
        }
        const existingRaw = this.storageService.getObject(globalChatKey, 0 /* StorageScope.PROFILE */, []);
        existingRaw.push({
            chat: model.toJSON(),
            timestampInMilliseconds: Date.now(),
            toWorkspace: toWorkspace,
            inputValue: transferredSessionData.inputValue,
            location: transferredSessionData.location,
            mode: transferredSessionData.mode,
        });
        this.storageService.store(globalChatKey, JSON.stringify(existingRaw), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        this.chatTransferService.addWorkspaceToTransferred(toWorkspace);
        this.trace('transferChatSession', `Transferred session ${model.sessionId} to workspace ${toWorkspace.toString()}`);
    }
    getChatStorageFolder() {
        return this._chatSessionStore.getChatStorageFolder();
    }
    logChatIndex() {
        this._chatSessionStore.logIndex();
    }
};
__decorate([
    memoize
], ChatService.prototype, "useFileStorage", null);
ChatService = __decorate([
    __param(0, IStorageService),
    __param(1, ILogService),
    __param(2, IExtensionService),
    __param(3, IInstantiationService),
    __param(4, ITelemetryService),
    __param(5, IWorkspaceContextService),
    __param(6, IChatSlashCommandService),
    __param(7, IChatAgentService),
    __param(8, IConfigurationService),
    __param(9, IWorkbenchAssignmentService),
    __param(10, IChatTransferService),
    __param(11, ILanguageModelsService)
], ChatService);
export { ChatService };
function getCodeBlocks(text) {
    const lines = text.split('\n');
    const codeBlockLanguages = [];
    let codeBlockState;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (codeBlockState) {
            if (new RegExp(`^\\s*${codeBlockState.delimiter}\\s*$`).test(line)) {
                codeBlockLanguages.push(codeBlockState.languageId);
                codeBlockState = undefined;
            }
        }
        else {
            const match = line.match(/^(\s*)(`{3,}|~{3,})(\w*)/);
            if (match) {
                codeBlockState = { delimiter: match[2], languageId: match[3] };
            }
        }
    }
    return codeBlockLanguages;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlcnZpY2VJbXBsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFB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