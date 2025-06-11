/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from '../../../base/common/buffer.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { canceled } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { newWriteableStream } from '../../../base/common/stream.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { createFileSystemProviderError, FileSystemProviderErrorCode } from './files.js';
import { reviveFileChanges } from './watcher.js';
export const LOCAL_FILE_SYSTEM_CHANNEL_NAME = 'localFilesystem';
/**
 * An implementation of a local disk file system provider
 * that is backed by a `IChannel` and thus implemented via
 * IPC on a different process.
 */
export class DiskFileSystemProviderClient extends Disposable {
    constructor(channel, extraCapabilities) {
        super();
        this.channel = channel;
        this.extraCapabilities = extraCapabilities;
        //#region File Capabilities
        this.onDidChangeCapabilities = Event.None;
        //#endregion
        //#region File Watching
        this._onDidChange = this._register(new Emitter());
        this.onDidChangeFile = this._onDidChange.event;
        this._onDidWatchError = this._register(new Emitter());
        this.onDidWatchError = this._onDidWatchError.event;
        // The contract for file watching via remote is to identify us
        // via a unique but readonly session ID. Since the remote is
        // managing potentially many watchers from different clients,
        // this helps the server to properly partition events to the right
        // clients.
        this.sessionId = generateUuid();
        this.registerFileChangeListeners();
    }
    get capabilities() {
        if (!this._capabilities) {
            this._capabilities =
                2 /* FileSystemProviderCapabilities.FileReadWrite */ |
                    4 /* FileSystemProviderCapabilities.FileOpenReadWriteClose */ |
                    16 /* FileSystemProviderCapabilities.FileReadStream */ |
                    8 /* FileSystemProviderCapabilities.FileFolderCopy */ |
                    8192 /* FileSystemProviderCapabilities.FileWriteUnlock */ |
                    16384 /* FileSystemProviderCapabilities.FileAtomicRead */ |
                    32768 /* FileSystemProviderCapabilities.FileAtomicWrite */ |
                    65536 /* FileSystemProviderCapabilities.FileAtomicDelete */ |
                    131072 /* FileSystemProviderCapabilities.FileClone */;
            if (this.extraCapabilities.pathCaseSensitive) {
                this._capabilities |= 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */;
            }
            if (this.extraCapabilities.trash) {
                this._capabilities |= 4096 /* FileSystemProviderCapabilities.Trash */;
            }
        }
        return this._capabilities;
    }
    //#endregion
    //#region File Metadata Resolving
    stat(resource) {
        return this.channel.call('stat', [resource]);
    }
    readdir(resource) {
        return this.channel.call('readdir', [resource]);
    }
    //#endregion
    //#region File Reading/Writing
    async readFile(resource, opts) {
        const { buffer } = await this.channel.call('readFile', [resource, opts]);
        return buffer;
    }
    readFileStream(resource, opts, token) {
        const stream = newWriteableStream(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);
        const disposables = new DisposableStore();
        // Reading as file stream goes through an event to the remote side
        disposables.add(this.channel.listen('readFileStream', [resource, opts])(dataOrErrorOrEnd => {
            // data
            if (dataOrErrorOrEnd instanceof VSBuffer) {
                stream.write(dataOrErrorOrEnd.buffer);
            }
            // end or error
            else {
                if (dataOrErrorOrEnd === 'end') {
                    stream.end();
                }
                else {
                    let error;
                    // Take Error as is if type matches
                    if (dataOrErrorOrEnd instanceof Error) {
                        error = dataOrErrorOrEnd;
                    }
                    // Otherwise, try to deserialize into an error.
                    // Since we communicate via IPC, we cannot be sure
                    // that Error objects are properly serialized.
                    else {
                        const errorCandidate = dataOrErrorOrEnd;
                        error = createFileSystemProviderError(errorCandidate.message ?? toErrorMessage(errorCandidate), errorCandidate.code ?? FileSystemProviderErrorCode.Unknown);
                    }
                    stream.error(error);
                    stream.end();
                }
                // Signal to the remote side that we no longer listen
                disposables.dispose();
            }
        }));
        // Support cancellation
        disposables.add(token.onCancellationRequested(() => {
            // Ensure to end the stream properly with an error
            // to indicate the cancellation.
            stream.error(canceled());
            stream.end();
            // Ensure to dispose the listener upon cancellation. This will
            // bubble through the remote side as event and allows to stop
            // reading the file.
            disposables.dispose();
        }));
        return stream;
    }
    writeFile(resource, content, opts) {
        return this.channel.call('writeFile', [resource, VSBuffer.wrap(content), opts]);
    }
    open(resource, opts) {
        return this.channel.call('open', [resource, opts]);
    }
    close(fd) {
        return this.channel.call('close', [fd]);
    }
    async read(fd, pos, data, offset, length) {
        const [bytes, bytesRead] = await this.channel.call('read', [fd, pos, length]);
        // copy back the data that was written into the buffer on the remote
        // side. we need to do this because buffers are not referenced by
        // pointer, but only by value and as such cannot be directly written
        // to from the other process.
        data.set(bytes.buffer.slice(0, bytesRead), offset);
        return bytesRead;
    }
    write(fd, pos, data, offset, length) {
        return this.channel.call('write', [fd, pos, VSBuffer.wrap(data), offset, length]);
    }
    //#endregion
    //#region Move/Copy/Delete/Create Folder
    mkdir(resource) {
        return this.channel.call('mkdir', [resource]);
    }
    delete(resource, opts) {
        return this.channel.call('delete', [resource, opts]);
    }
    rename(resource, target, opts) {
        return this.channel.call('rename', [resource, target, opts]);
    }
    copy(resource, target, opts) {
        return this.channel.call('copy', [resource, target, opts]);
    }
    //#endregion
    //#region Clone File
    cloneFile(resource, target) {
        return this.channel.call('cloneFile', [resource, target]);
    }
    registerFileChangeListeners() {
        // The contract for file changes is that there is one listener
        // for both events and errors from the watcher. So we need to
        // unwrap the event from the remote and emit through the proper
        // emitter.
        this._register(this.channel.listen('fileChange', [this.sessionId])(eventsOrError => {
            if (Array.isArray(eventsOrError)) {
                const events = eventsOrError;
                this._onDidChange.fire(reviveFileChanges(events));
            }
            else {
                const error = eventsOrError;
                this._onDidWatchError.fire(error);
            }
        }));
    }
    watch(resource, opts) {
        // Generate a request UUID to correlate the watcher
        // back to us when we ask to dispose the watcher later.
        const req = generateUuid();
        this.channel.call('watch', [this.sessionId, req, resource, opts]);
        return toDisposable(() => this.channel.call('unwatch', [this.sessionId, req]));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlza0ZpbGVTeXN0ZW1Qcm92aWRlckNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZmlsZXMvY29tbW9uL2Rpc2tGaWxlU3lzdGVtUHJvdmlkZXJDbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRTFELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRyxPQUFPLEVBQUUsa0JBQWtCLEVBQW9ELE1BQU0sZ0NBQWdDLENBQUM7QUFFdEgsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRTVELE9BQU8sRUFBRSw2QkFBNkIsRUFBK0ksMkJBQTJCLEVBQWdZLE1BQU0sWUFBWSxDQUFDO0FBQ25tQixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFFakQsTUFBTSxDQUFDLE1BQU0sOEJBQThCLEdBQUcsaUJBQWlCLENBQUM7QUFFaEU7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyw0QkFBNkIsU0FBUSxVQUFVO0lBUTNELFlBQ2tCLE9BQWlCLEVBQ2pCLGlCQUFtRTtRQUVwRixLQUFLLEVBQUUsQ0FBQztRQUhTLFlBQU8sR0FBUCxPQUFPLENBQVU7UUFDakIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFrRDtRQU9yRiwyQkFBMkI7UUFFbEIsNEJBQXVCLEdBQWdCLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFxSzNELFlBQVk7UUFFWix1QkFBdUI7UUFFTixpQkFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQTBCLENBQUMsQ0FBQztRQUM3RSxvQkFBZSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBRWxDLHFCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVUsQ0FBQyxDQUFDO1FBQ2pFLG9CQUFlLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztRQUV2RCw4REFBOEQ7UUFDOUQsNERBQTREO1FBQzVELDZEQUE2RDtRQUM3RCxrRUFBa0U7UUFDbEUsV0FBVztRQUNNLGNBQVMsR0FBRyxZQUFZLEVBQUUsQ0FBQztRQXpMM0MsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7SUFDcEMsQ0FBQztJQU9ELElBQUksWUFBWTtRQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLGFBQWE7Z0JBQ2pCO2lGQUNxRDswRUFDUjt5RUFDQTs2RUFDQzs2RUFDRDs4RUFDQzsrRUFDQzt5RUFDUCxDQUFDO1lBRTFDLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQzlDLElBQUksQ0FBQyxhQUFhLCtEQUFvRCxDQUFDO1lBQ3hFLENBQUM7WUFFRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLGFBQWEsbURBQXdDLENBQUM7WUFDNUQsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDM0IsQ0FBQztJQUVELFlBQVk7SUFFWixpQ0FBaUM7SUFFakMsSUFBSSxDQUFDLFFBQWE7UUFDakIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxPQUFPLENBQUMsUUFBYTtRQUNwQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVELFlBQVk7SUFFWiw4QkFBOEI7SUFFOUIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFhLEVBQUUsSUFBNkI7UUFDMUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFhLENBQUM7UUFFckYsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsY0FBYyxDQUFDLFFBQWEsRUFBRSxJQUE0QixFQUFFLEtBQXdCO1FBQ25GLE1BQU0sTUFBTSxHQUFHLGtCQUFrQixDQUFhLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckgsTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUUxQyxrRUFBa0U7UUFDbEUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBdUMsZ0JBQWdCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBRWhJLE9BQU87WUFDUCxJQUFJLGdCQUFnQixZQUFZLFFBQVEsRUFBRSxDQUFDO2dCQUMxQyxNQUFNLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFFRCxlQUFlO2lCQUNWLENBQUM7Z0JBQ0wsSUFBSSxnQkFBZ0IsS0FBSyxLQUFLLEVBQUUsQ0FBQztvQkFDaEMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNkLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxJQUFJLEtBQVksQ0FBQztvQkFFakIsbUNBQW1DO29CQUNuQyxJQUFJLGdCQUFnQixZQUFZLEtBQUssRUFBRSxDQUFDO3dCQUN2QyxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7b0JBQzFCLENBQUM7b0JBRUQsK0NBQStDO29CQUMvQyxrREFBa0Q7b0JBQ2xELDhDQUE4Qzt5QkFDekMsQ0FBQzt3QkFDTCxNQUFNLGNBQWMsR0FBRyxnQkFBNEMsQ0FBQzt3QkFFcEUsS0FBSyxHQUFHLDZCQUE2QixDQUFDLGNBQWMsQ0FBQyxPQUFPLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLElBQUksMkJBQTJCLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQzdKLENBQUM7b0JBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDcEIsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNkLENBQUM7Z0JBRUQscURBQXFEO2dCQUNyRCxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSix1QkFBdUI7UUFDdkIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO1lBRWxELGtEQUFrRDtZQUNsRCxnQ0FBZ0M7WUFDaEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3pCLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUViLDhEQUE4RDtZQUM5RCw2REFBNkQ7WUFDN0Qsb0JBQW9CO1lBQ3BCLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsU0FBUyxDQUFDLFFBQWEsRUFBRSxPQUFtQixFQUFFLElBQXVCO1FBQ3BFLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBRUQsSUFBSSxDQUFDLFFBQWEsRUFBRSxJQUFzQjtRQUN6QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRCxLQUFLLENBQUMsRUFBVTtRQUNmLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFVLEVBQUUsR0FBVyxFQUFFLElBQWdCLEVBQUUsTUFBYyxFQUFFLE1BQWM7UUFDbkYsTUFBTSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsR0FBdUIsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFFbEcsb0VBQW9FO1FBQ3BFLGlFQUFpRTtRQUNqRSxvRUFBb0U7UUFDcEUsNkJBQTZCO1FBQzdCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRW5ELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxLQUFLLENBQUMsRUFBVSxFQUFFLEdBQVcsRUFBRSxJQUFnQixFQUFFLE1BQWMsRUFBRSxNQUFjO1FBQzlFLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRCxZQUFZO0lBRVosd0NBQXdDO0lBRXhDLEtBQUssQ0FBQyxRQUFhO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsTUFBTSxDQUFDLFFBQWEsRUFBRSxJQUF3QjtRQUM3QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRCxNQUFNLENBQUMsUUFBYSxFQUFFLE1BQVcsRUFBRSxJQUEyQjtRQUM3RCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsSUFBSSxDQUFDLFFBQWEsRUFBRSxNQUFXLEVBQUUsSUFBMkI7UUFDM0QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVELFlBQVk7SUFFWixvQkFBb0I7SUFFcEIsU0FBUyxDQUFDLFFBQWEsRUFBRSxNQUFXO1FBQ25DLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQW1CTywyQkFBMkI7UUFFbEMsOERBQThEO1FBQzlELDZEQUE2RDtRQUM3RCwrREFBK0Q7UUFDL0QsV0FBVztRQUNYLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQXlCLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxFQUFFO1lBQzFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDbkQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxLQUFLLENBQUMsUUFBYSxFQUFFLElBQW1CO1FBRXZDLG1EQUFtRDtRQUNuRCx1REFBdUQ7UUFDdkQsTUFBTSxHQUFHLEdBQUcsWUFBWSxFQUFFLENBQUM7UUFFM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbEUsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEYsQ0FBQztDQUdEIn0=