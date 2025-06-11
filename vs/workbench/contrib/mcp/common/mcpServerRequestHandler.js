/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../../../base/common/arrays.js';
import { DeferredPromise, IntervalTimer } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { canLog, log, LogLevel } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { McpError, MpcResponseError } from './mcpTypes.js';
import { MCP } from './modelContextProtocol.js';
/**
 * Request handler for communicating with an MCP server.
 *
 * Handles sending requests and receiving responses, with automatic
 * handling of ping requests and typed client request methods.
 */
export class McpServerRequestHandler extends Disposable {
    set roots(roots) {
        if (!equals(this._roots, roots)) {
            this._roots = roots;
            if (this._hasAnnouncedRoots) {
                this.sendNotification({ method: 'notifications/roots/list_changed' });
                this._hasAnnouncedRoots = false;
            }
        }
    }
    get capabilities() {
        return this._serverInit.capabilities;
    }
    get serverInfo() {
        return this._serverInit.serverInfo;
    }
    /**
     * Connects to the MCP server and does the initialization handshake.
     * @throws MpcResponseError if the server fails to initialize.
     */
    static async create(instaService, opts, token) {
        const mcp = new McpServerRequestHandler(opts);
        const store = new DisposableStore();
        try {
            const timer = store.add(new IntervalTimer());
            timer.cancelAndSet(() => {
                opts.logger.info('Waiting for server to respond to `initialize` request...');
            }, 5000);
            await instaService.invokeFunction(async (accessor) => {
                const productService = accessor.get(IProductService);
                const initialized = await mcp.sendRequest({
                    method: 'initialize',
                    params: {
                        protocolVersion: MCP.LATEST_PROTOCOL_VERSION,
                        capabilities: {
                            roots: { listChanged: true },
                            sampling: opts.createMessageRequestHandler ? {} : undefined,
                        },
                        clientInfo: {
                            name: productService.nameLong,
                            version: productService.version,
                        }
                    }
                }, token);
                mcp._serverInit = initialized;
                mcp.sendNotification({
                    method: 'notifications/initialized'
                });
            });
            return mcp;
        }
        catch (e) {
            mcp.dispose();
            throw e;
        }
        finally {
            store.dispose();
        }
    }
    constructor({ launch, logger, createMessageRequestHandler, requestLogLevel = LogLevel.Debug, }) {
        super();
        this._nextRequestId = 1;
        this._pendingRequests = new Map();
        this._hasAnnouncedRoots = false;
        this._roots = [];
        // Event emitters for server notifications
        this._onDidReceiveCancelledNotification = this._register(new Emitter());
        this.onDidReceiveCancelledNotification = this._onDidReceiveCancelledNotification.event;
        this._onDidReceiveProgressNotification = this._register(new Emitter());
        this.onDidReceiveProgressNotification = this._onDidReceiveProgressNotification.event;
        this._onDidChangeResourceList = this._register(new Emitter());
        this.onDidChangeResourceList = this._onDidChangeResourceList.event;
        this._onDidUpdateResource = this._register(new Emitter());
        this.onDidUpdateResource = this._onDidUpdateResource.event;
        this._onDidChangeToolList = this._register(new Emitter());
        this.onDidChangeToolList = this._onDidChangeToolList.event;
        this._onDidChangePromptList = this._register(new Emitter());
        this.onDidChangePromptList = this._onDidChangePromptList.event;
        this._launch = launch;
        this.logger = logger;
        this._requestLogLevel = requestLogLevel;
        this._createMessageRequestHandler = createMessageRequestHandler;
        this._register(launch.onDidReceiveMessage(message => this.handleMessage(message)));
        this._register(autorun(reader => {
            const state = launch.state.read(reader).state;
            // the handler will get disposed when the launch stops, but if we're still
            // create()'ing we need to make sure to cancel the initialize request.
            if (state === 3 /* McpConnectionState.Kind.Error */ || state === 0 /* McpConnectionState.Kind.Stopped */) {
                this.cancelAllRequests();
            }
        }));
    }
    /**
     * Send a client request to the server and return the response.
     *
     * @param request The request to send
     * @param token Cancellation token
     * @param timeoutMs Optional timeout in milliseconds
     * @returns A promise that resolves with the response
     */
    async sendRequest(request, token = CancellationToken.None) {
        if (this._store.isDisposed) {
            return Promise.reject(new CancellationError());
        }
        const id = this._nextRequestId++;
        // Create the full JSON-RPC request
        const jsonRpcRequest = {
            jsonrpc: MCP.JSONRPC_VERSION,
            id,
            ...request
        };
        const promise = new DeferredPromise();
        // Store the pending request
        this._pendingRequests.set(id, { promise });
        // Set up cancellation
        const cancelListener = token.onCancellationRequested(() => {
            if (!promise.isSettled) {
                this._pendingRequests.delete(id);
                this.sendNotification({ method: 'notifications/cancelled', params: { requestId: id } });
                promise.cancel();
            }
            cancelListener.dispose();
        });
        // Send the request
        this.send(jsonRpcRequest);
        const ret = promise.p.finally(() => {
            cancelListener.dispose();
            this._pendingRequests.delete(id);
        });
        return ret;
    }
    send(mcp) {
        if (canLog(this.logger.getLevel(), this._requestLogLevel)) { // avoid building the string if we don't need to
            log(this.logger, this._requestLogLevel, `[editor -> server] ${JSON.stringify(mcp)}`);
        }
        this._launch.send(mcp);
    }
    /**
     * Handles paginated requests by making multiple requests until all items are retrieved.
     *
     * @param method The method name to call
     * @param getItems Function to extract the array of items from a result
     * @param initialParams Initial parameters
     * @param token Cancellation token
     * @returns Promise with all items combined
     */
    async *sendRequestPaginated(method, getItems, initialParams, token = CancellationToken.None) {
        let nextCursor = undefined;
        do {
            const params = {
                ...initialParams,
                cursor: nextCursor
            };
            const result = await this.sendRequest({ method, params }, token);
            yield getItems(result);
            nextCursor = result.nextCursor;
        } while (nextCursor !== undefined && !token.isCancellationRequested);
    }
    sendNotification(notification) {
        this.send({ ...notification, jsonrpc: MCP.JSONRPC_VERSION });
    }
    /**
     * Handle incoming messages from the server
     */
    handleMessage(message) {
        if (canLog(this.logger.getLevel(), this._requestLogLevel)) { // avoid building the string if we don't need to
            log(this.logger, this._requestLogLevel, `[server -> editor] ${JSON.stringify(message)}`);
        }
        // Handle responses to our requests
        if ('id' in message) {
            if ('result' in message) {
                this.handleResult(message);
            }
            else if ('error' in message) {
                this.handleError(message);
            }
        }
        // Handle requests from the server
        if ('method' in message) {
            if ('id' in message) {
                this.handleServerRequest(message);
            }
            else {
                this.handleServerNotification(message);
            }
        }
    }
    /**
     * Handle successful responses
     */
    handleResult(response) {
        const request = this._pendingRequests.get(response.id);
        if (request) {
            this._pendingRequests.delete(response.id);
            request.promise.complete(response.result);
        }
    }
    /**
     * Handle error responses
     */
    handleError(response) {
        const request = this._pendingRequests.get(response.id);
        if (request) {
            this._pendingRequests.delete(response.id);
            request.promise.error(new MpcResponseError(response.error.message, response.error.code, response.error.data));
        }
    }
    /**
     * Handle incoming server requests
     */
    async handleServerRequest(request) {
        try {
            let response;
            if (request.method === 'ping') {
                response = this.handlePing(request);
            }
            else if (request.method === 'roots/list') {
                response = this.handleRootsList(request);
            }
            else if (request.method === 'sampling/createMessage' && this._createMessageRequestHandler) {
                response = await this._createMessageRequestHandler(request.params);
            }
            else {
                throw McpError.methodNotFound(request.method);
            }
            this.respondToRequest(request, response);
        }
        catch (e) {
            if (!(e instanceof McpError)) {
                this.logger.error(`Error handling request ${request.method}:`, e);
                e = McpError.unknown(e);
            }
            const errorResponse = {
                jsonrpc: MCP.JSONRPC_VERSION,
                id: request.id,
                error: {
                    code: e.code,
                    message: e.message,
                    data: e.data,
                }
            };
            this.send(errorResponse);
        }
    }
    /**
     * Handle incoming server notifications
     */
    handleServerNotification(request) {
        switch (request.method) {
            case 'notifications/message':
                return this.handleLoggingNotification(request);
            case 'notifications/cancelled':
                this._onDidReceiveCancelledNotification.fire(request);
                return this.handleCancelledNotification(request);
            case 'notifications/progress':
                this._onDidReceiveProgressNotification.fire(request);
                return;
            case 'notifications/resources/list_changed':
                this._onDidChangeResourceList.fire();
                return;
            case 'notifications/resources/updated':
                this._onDidUpdateResource.fire(request);
                return;
            case 'notifications/tools/list_changed':
                this._onDidChangeToolList.fire();
                return;
            case 'notifications/prompts/list_changed':
                this._onDidChangePromptList.fire();
                return;
        }
    }
    handleCancelledNotification(request) {
        const pendingRequest = this._pendingRequests.get(request.params.requestId);
        if (pendingRequest) {
            this._pendingRequests.delete(request.params.requestId);
            pendingRequest.promise.cancel();
        }
    }
    handleLoggingNotification(request) {
        let contents = typeof request.params.data === 'string' ? request.params.data : JSON.stringify(request.params.data);
        if (request.params.logger) {
            contents = `${request.params.logger}: ${contents}`;
        }
        switch (request.params?.level) {
            case 'debug':
                this.logger.debug(contents);
                break;
            case 'info':
            case 'notice':
                this.logger.info(contents);
                break;
            case 'warning':
                this.logger.warn(contents);
                break;
            case 'error':
            case 'critical':
            case 'alert':
            case 'emergency':
                this.logger.error(contents);
                break;
            default:
                this.logger.info(contents);
                break;
        }
    }
    /**
     * Send a generic response to a request
     */
    respondToRequest(request, result) {
        const response = {
            jsonrpc: MCP.JSONRPC_VERSION,
            id: request.id,
            result
        };
        this.send(response);
    }
    /**
     * Send a response to a ping request
     */
    handlePing(_request) {
        return {};
    }
    /**
     * Send a response to a roots/list request
     */
    handleRootsList(_request) {
        this._hasAnnouncedRoots = true;
        return { roots: this._roots };
    }
    cancelAllRequests() {
        this._pendingRequests.forEach(pending => pending.promise.cancel());
        this._pendingRequests.clear();
    }
    dispose() {
        this.cancelAllRequests();
        super.dispose();
    }
    /**
     * Send an initialize request
     */
    initialize(params, token) {
        return this.sendRequest({ method: 'initialize', params }, token);
    }
    /**
     * List available resources
     */
    listResources(params, token) {
        return Iterable.asyncToArrayFlat(this.listResourcesIterable(params, token));
    }
    /**
     * List available resources (iterable)
     */
    listResourcesIterable(params, token) {
        return this.sendRequestPaginated('resources/list', result => result.resources, params, token);
    }
    /**
     * Read a specific resource
     */
    readResource(params, token) {
        return this.sendRequest({ method: 'resources/read', params }, token);
    }
    /**
     * List available resource templates
     */
    listResourceTemplates(params, token) {
        return Iterable.asyncToArrayFlat(this.sendRequestPaginated('resources/templates/list', result => result.resourceTemplates, params, token));
    }
    /**
     * Subscribe to resource updates
     */
    subscribe(params, token) {
        return this.sendRequest({ method: 'resources/subscribe', params }, token);
    }
    /**
     * Unsubscribe from resource updates
     */
    unsubscribe(params, token) {
        return this.sendRequest({ method: 'resources/unsubscribe', params }, token);
    }
    /**
     * List available prompts
     */
    listPrompts(params, token) {
        return Iterable.asyncToArrayFlat(this.sendRequestPaginated('prompts/list', result => result.prompts, params, token));
    }
    /**
     * Get a specific prompt
     */
    getPrompt(params, token) {
        return this.sendRequest({ method: 'prompts/get', params }, token);
    }
    /**
     * List available tools
     */
    listTools(params, token) {
        return Iterable.asyncToArrayFlat(this.sendRequestPaginated('tools/list', result => result.tools, params, token));
    }
    /**
     * Call a specific tool
     */
    callTool(params, token) {
        return this.sendRequest({ method: 'tools/call', params }, token);
    }
    /**
     * Set the logging level
     */
    setLevel(params, token) {
        return this.sendRequest({ method: 'logging/setLevel', params }, token);
    }
    /**
     * Find completions for an argument
     */
    complete(params, token) {
        return this.sendRequest({ method: 'completion/complete', params }, token);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyUmVxdWVzdEhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9jb21tb24vbWNwU2VydmVyUmVxdWVzdEhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVoRSxPQUFPLEVBQUUsTUFBTSxFQUFXLEdBQUcsRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFFeEYsT0FBTyxFQUF5QyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBdUJoRDs7Ozs7R0FLRztBQUNILE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxVQUFVO0lBT3RELElBQVcsS0FBSyxDQUFDLEtBQWlCO1FBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxL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