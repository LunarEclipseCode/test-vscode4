"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/// <reference lib="webworker" />
const sw = self;
const VERSION = 4;
const resourceCacheName = `vscode-resource-cache-${VERSION}`;
const rootPath = sw.location.pathname.replace(/\/service-worker.js$/, '');
const searchParams = new URL(location.toString()).searchParams;
const remoteAuthority = searchParams.get('remoteAuthority');
let outerIframeMessagePort;
/**
 * Origin used for resources
 */
const resourceBaseAuthority = searchParams.get('vscode-resource-base-authority');
const resolveTimeout = 30_000;
class RequestStore {
    constructor() {
        this.map = new Map();
        this.requestPool = 0;
    }
    create() {
        const requestId = ++this.requestPool;
        let resolve;
        const promise = new Promise(r => resolve = r);
        const entry = { resolve: resolve, promise };
        this.map.set(requestId, entry);
        const dispose = () => {
            clearTimeout(timeout);
            const existingEntry = this.map.get(requestId);
            if (existingEntry === entry) {
                existingEntry.resolve({ status: 'timeout' });
                this.map.delete(requestId);
            }
        };
        const timeout = setTimeout(dispose, resolveTimeout);
        return { requestId, promise };
    }
    resolve(requestId, result) {
        const entry = this.map.get(requestId);
        if (!entry) {
            return false;
        }
        entry.resolve({ status: 'ok', value: result });
        this.map.delete(requestId);
        return true;
    }
}
/**
 * Map of requested paths to responses.
 */
const resourceRequestStore = new RequestStore();
/**
 * Map of requested localhost origins to optional redirects.
 */
const localhostRequestStore = new RequestStore();
const unauthorized = () => new Response('Unauthorized', { status: 401, });
const notFound = () => new Response('Not Found', { status: 404, });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405, });
const requestTimeout = () => new Response('Request Timeout', { status: 408, });
sw.addEventListener('message', async (event) => {
    if (!event.source) {
        return;
    }
    const source = event.source;
    switch (event.data.channel) {
        case 'version': {
            outerIframeMessagePort = event.ports[0];
            sw.clients.get(source.id).then(client => {
                if (client) {
                    client.postMessage({
                        channel: 'version',
                        version: VERSION
                    });
                }
            });
            return;
        }
        case 'did-load-resource': {
            const response = event.data.data;
            if (!resourceRequestStore.resolve(response.id, response)) {
                console.log('Could not resolve unknown resource', response.path);
            }
            return;
        }
        case 'did-load-localhost': {
            const data = event.data.data;
            if (!localhostRequestStore.resolve(data.id, data.location)) {
                console.log('Could not resolve unknown localhost', data.origin);
            }
            return;
        }
        default: {
            console.log('Unknown message');
            return;
        }
    }
});
sw.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (typeof resourceBaseAuthority === 'string' && requestUrl.protocol === 'https:' && requestUrl.hostname.endsWith('.' + resourceBaseAuthority)) {
        switch (event.request.method) {
            case 'GET':
            case 'HEAD': {
                const firstHostSegment = requestUrl.hostname.slice(0, requestUrl.hostname.length - (resourceBaseAuthority.length + 1));
                const scheme = firstHostSegment.split('+', 1)[0];
                const authority = firstHostSegment.slice(scheme.length + 1); // may be empty
                return event.respondWith(processResourceRequest(event, {
                    scheme,
                    authority,
                    path: requestUrl.pathname,
                    query: requestUrl.search.replace(/^\?/, ''),
                }));
            }
            default: {
                return event.respondWith(methodNotAllowed());
            }
        }
    }
    // If we're making a request against the remote authority, we want to go
    // through VS Code itself so that we are authenticated properly.  If the
    // service worker is hosted on the same origin we will have cookies and
    // authentication will not be an issue.
    if (requestUrl.origin !== sw.origin && requestUrl.host === remoteAuthority) {
        switch (event.request.method) {
            case 'GET':
            case 'HEAD': {
                return event.respondWith(processResourceRequest(event, {
                    path: requestUrl.pathname,
                    scheme: requestUrl.protocol.slice(0, requestUrl.protocol.length - 1),
                    authority: requestUrl.host,
                    query: requestUrl.search.replace(/^\?/, ''),
                }));
            }
            default: {
                return event.respondWith(methodNotAllowed());
            }
        }
    }
    // See if it's a localhost request
    if (requestUrl.origin !== sw.origin && requestUrl.host.match(/^(localhost|127.0.0.1|0.0.0.0):(\d+)$/)) {
        return event.respondWith(processLocalhostRequest(event, requestUrl));
    }
});
sw.addEventListener('install', (event) => {
    event.waitUntil(sw.skipWaiting()); // Activate worker immediately
});
sw.addEventListener('activate', (event) => {
    event.waitUntil(sw.clients.claim()); // Become available to all pages
});
async function processResourceRequest(event, requestUrlComponents) {
    let client = await sw.clients.get(event.clientId);
    if (!client) {
        client = await getWorkerClientForId(event.clientId);
        if (!client) {
            console.error('Could not find inner client for request');
            return notFound();
        }
    }
    const webviewId = getWebviewIdForClient(client);
    // Refs https://github.com/microsoft/vscode/issues/244143
    // With PlzDedicatedWorker, worker subresources and blob wokers
    // will use clients different from the window client.
    // Since we cannot different a worker main resource from a worker subresource
    // we will use message channel to the outer iframe provided at the time
    // of service worker controller version initialization.
    if (!webviewId && client.type !== 'worker' && client.type !== 'sharedworker') {
        console.error('Could not resolve webview id');
        return notFound();
    }
    const shouldTryCaching = (event.request.method === 'GET');
    const resolveResourceEntry = (result, cachedResponse) => {
        if (result.status === 'timeout') {
            return requestTimeout();
        }
        const entry = result.value;
        if (entry.status === 304) { // Not modified
            if (cachedResponse) {
                return cachedResponse.clone();
            }
            else {
                throw new Error('No cache found');
            }
        }
        if (entry.status === 401) {
            return unauthorized();
        }
        if (entry.status !== 200) {
            return notFound();
        }
        const commonHeaders = {
            'Access-Control-Allow-Origin': '*',
        };
        const byteLength = entry.data.byteLength;
        const range = event.request.headers.get('range');
        if (range) {
            // To support seeking for videos, we need to handle range requests
            const bytes = range.match(/^bytes\=(\d+)\-(\d+)?$/g);
            if (bytes) {
                // TODO: Right now we are always reading the full file content. This is a bad idea
                // for large video files :)
                const start = Number(bytes[1]);
                const end = Number(bytes[2]) || byteLength - 1;
                return new Response(entry.data.slice(start, end + 1), {
                    status: 206,
                    headers: {
                        ...commonHeaders,
                        'Content-range': `bytes 0-${end}/${byteLength}`,
                    }
                });
            }
            else {
                // We don't understand the requested bytes
                return new Response(null, {
                    status: 416,
                    headers: {
                        ...commonHeaders,
                        'Content-range': `*/${byteLength}`
                    }
                });
            }
        }
        const headers = {
            ...commonHeaders,
            'Content-Type': entry.mime,
            'Content-Length': byteLength.toString(),
        };
        if (entry.etag) {
            headers['ETag'] = entry.etag;
            headers['Cache-Control'] = 'no-cache';
        }
        if (entry.mtime) {
            headers['Last-Modified'] = new Date(entry.mtime).toUTCString();
        }
        // support COI requests, see network.ts#COI.getHeadersFromQuery(...)
        const coiRequest = new URL(event.request.url).searchParams.get('vscode-coi');
        if (coiRequest === '3') {
            headers['Cross-Origin-Opener-Policy'] = 'same-origin';
            headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        }
        else if (coiRequest === '2') {
            headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        }
        else if (coiRequest === '1') {
            headers['Cross-Origin-Opener-Policy'] = 'same-origin';
        }
        const response = new Response(entry.data, {
            status: 200,
            headers
        });
        if (shouldTryCaching && entry.etag) {
            caches.open(resourceCacheName).then(cache => {
                return cache.put(event.request, response);
            });
        }
        return response.clone();
    };
    let cached;
    if (shouldTryCaching) {
        const cache = await caches.open(resourceCacheName);
        cached = await cache.match(event.request);
    }
    const { requestId, promise } = resourceRequestStore.create();
    if (webviewId) {
        const parentClients = await getOuterIframeClient(webviewId);
        if (!parentClients.length) {
            console.log('Could not find parent client for request');
            return notFound();
        }
        for (const parentClient of parentClients) {
            parentClient.postMessage({
                channel: 'load-resource',
                id: requestId,
                scheme: requestUrlComponents.scheme,
                authority: requestUrlComponents.authority,
                path: requestUrlComponents.path,
                query: requestUrlComponents.query,
                ifNoneMatch: cached?.headers.get('ETag'),
            });
        }
    }
    else if (client.type === 'worker' || client.type === 'sharedworker') {
        outerIframeMessagePort?.postMessage({
            channel: 'load-resource',
            id: requestId,
            scheme: requestUrlComponents.scheme,
            authority: requestUrlComponents.authority,
            path: requestUrlComponents.path,
            query: requestUrlComponents.query,
            ifNoneMatch: cached?.headers.get('ETag'),
        });
    }
    return promise.then(entry => resolveResourceEntry(entry, cached));
}
async function processLocalhostRequest(event, requestUrl) {
    const client = await sw.clients.get(event.clientId);
    if (!client) {
        // This is expected when requesting resources on other localhost ports
        // that are not spawned by vs code
        return fetch(event.request);
    }
    const webviewId = getWebviewIdForClient(client);
    // Refs https://github.com/microsoft/vscode/issues/244143
    // With PlzDedicatedWorker, worker subresources and blob wokers
    // will use clients different from the window client.
    // Since we cannot different a worker main resource from a worker subresource
    // we will use message channel to the outer iframe provided at the time
    // of service worker controller version initialization.
    if (!webviewId && client.type !== 'worker' && client.type !== 'sharedworker') {
        console.error('Could not resolve webview id');
        return fetch(event.request);
    }
    const origin = requestUrl.origin;
    const resolveRedirect = async (result) => {
        if (result.status !== 'ok' || !result.value) {
            return fetch(event.request);
        }
        const redirectOrigin = result.value;
        const location = event.request.url.replace(new RegExp(`^${requestUrl.origin}(/|$)`), `${redirectOrigin}$1`);
        return new Response(null, {
            status: 302,
            headers: {
                Location: location
            }
        });
    };
    const { requestId, promise } = localhostRequestStore.create();
    if (webviewId) {
        const parentClients = await getOuterIframeClient(webviewId);
        if (!parentClients.length) {
            console.log('Could not find parent client for request');
            return notFound();
        }
        for (const parentClient of parentClients) {
            parentClient.postMessage({
                channel: 'load-localhost',
                origin: origin,
                id: requestId,
            });
        }
    }
    else if (client.type === 'worker' || client.type === 'sharedworker') {
        outerIframeMessagePort?.postMessage({
            channel: 'load-localhost',
            origin: origin,
            id: requestId,
        });
    }
    return promise.then(resolveRedirect);
}
function getWebviewIdForClient(client) {
    const requesterClientUrl = new URL(client.url);
    return requesterClientUrl.searchParams.get('id');
}
async function getOuterIframeClient(webviewId) {
    const allClients = await sw.clients.matchAll({ includeUncontrolled: true });
    return allClients.filter(client => {
        const clientUrl = new URL(client.url);
        const hasExpectedPathName = (clientUrl.pathname === `${rootPath}/` || clientUrl.pathname === `${rootPath}/index.html` || clientUrl.pathname === `${rootPath}/index-no-csp.html`);
        return hasExpectedPathName && clientUrl.searchParams.get('id') === webviewId;
    });
}
async function getWorkerClientForId(clientId) {
    const allDedicatedWorkerClients = await sw.clients.matchAll({ type: 'worker' });
    const allSharedWorkerClients = await sw.clients.matchAll({ type: 'sharedworker' });
    const allWorkerClients = [...allDedicatedWorkerClients, ...allSharedWorkerClients];
    return allWorkerClients.find(client => {
        return client.id === clientId;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3dlYnZpZXcvYnJvd3Nlci9wcmUvc2VydmljZS13b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHO0FBQ2hHLGlDQUFpQztBQUVqQyxNQUFNLEVBQUUsR0FBNkIsSUFBdUMsQ0FBQztBQUU3RSxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFFbEIsTUFBTSxpQkFBaUIsR0FBRyx5QkFBeUIsT0FBTyxFQUFFLENBQUM7QUFFN0QsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLHNCQUFzQixFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBRTFFLE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQztBQUUvRCxNQUFNLGVBQWUsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFFNUQsSUFBSSxzQkFBK0MsQ0FBQztBQUVwRDs7R0FFRztBQUNILE1BQU0scUJBQXFCLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0FBRWpGLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQztBQWM5QixNQUFNLFlBQVk7SUFBbEI7UUFDUyxRQUFHLEdBQXNDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDbkQsZ0JBQVcsR0FBVyxDQUFDLENBQUM7SUFnQ2pDLENBQUM7SUE5QkEsTUFBTTtRQUNMLE1BQU0sU0FBUyxHQUFHLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUVyQyxJQUFJLE9BQTJDLENBQUM7UUFDaEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQXdCLENBQUMsQ0FBQyxFQUFFLENBQUMs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