/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../../../base/common/event.js';
import { DeferredPromise } from '../../../../../../../base/common/async.js';
import { AsyncDecoder } from './asyncDecoder.js';
import { assert, assertNever } from '../../../../../../../base/common/assert.js';
import { DisposableMap } from '../../../../../../../base/common/lifecycle.js';
import { ObservableDisposable } from '../../utils/observableDisposable.js';
/**
 * Base decoder class that can be used to convert stream messages data type
 * from one type to another. For instance, a stream of binary data can be
 * "decoded" into a stream of well defined objects.
 * Intended to be a part of "codec" implementation rather than used directly.
 */
export class BaseDecoder extends ObservableDisposable {
    /**
     * @param stream The input stream to decode.
     */
    constructor(stream) {
        super();
        this.stream = stream;
        /**
         * Private attribute to track if the stream has ended.
         */
        this._ended = false;
        this._onData = this._register(new Emitter());
        this._onEnd = this._register(new Emitter());
        this._onError = this._register(new Emitter());
        /**
         * A store of currently registered event listeners.
         */
        this._listeners = this._register(new DisposableMap());
        /**
         * Private attribute to track if the stream has started.
         */
        this.started = false;
        /**
         * Promise that resolves when the stream has ended, either by
         * receiving the `end` event or by a disposal, but not when
         * the `error` event is received alone.
         */
        this.settledPromise = new DeferredPromise();
    }
    /**
     * Promise that resolves when the stream has ended, either by
     * receiving the `end` event or by a disposal, but not when
     * the `error` event is received alone.
     *
     * @throws If the stream was not yet started to prevent this
     * 		   promise to block the consumer calls indefinitely.
     */
    get settled() {
        // if the stream has not started yet, the promise might
        // block the consumer calls indefinitely if they forget
        // to call the `start()` method, or if the call happens
        // after await on the `settled` promise; to forbid this
        // confusion, we require the stream to be started first
        assert(this.started, [
            'Cannot get `settled` promise of a stream that has not been started.',
            'Please call `start()` first.',
        ].join(' '));
        return this.settledPromise.p;
    }
    /**
     * Start receiving data from the stream.
     * @throws if the decoder stream has already ended.
     */
    start() {
        assert(this._ended === false, 'Cannot start stream that has already ended.');
        assert(this.isDisposed === false, 'Cannot start stream that has already disposed.');
        // if already started, nothing to do
        if (this.started) {
            return this;
        }
        this.started = true;
        /**
         * !NOTE! The order of event subscriptions is critical here because
         *        the `data` event is also starts the stream, hence changing
         *        the order of event subscriptions can lead to race conditions.
         *        See {@link ReadableStreamEvents} for more info.
         */
        this.stream.on('end', this.onStreamEnd.bind(this));
        this.stream.on('error', this.onStreamError.bind(this));
        this.stream.on('data', this.tryOnStreamData.bind(this));
        // this allows to compose decoders together, - if a decoder
        // instance is passed as a readable stream to this decoder,
        // then we need to call `start` on it too
        if (this.stream instanceof BaseDecoder) {
            this.stream.start();
        }
        return this;
    }
    /**
     * Check if the decoder has been ended hence has
     * no more data to produce.
     */
    get ended() {
        return this._ended;
    }
    /**
     * Automatically catch and dispatch errors thrown inside `onStreamData`.
     */
    tryOnStreamData(data) {
        try {
            this.onStreamData(data);
        }
        catch (error) {
            this.onStreamError(error);
        }
    }
    on(event, callback) {
        if (event === 'data') {
            return this.onData(callback);
        }
        if (event === 'error') {
            return this.onError(callback);
        }
        if (event === 'end') {
            return this.onEnd(callback);
        }
        assertNever(event, `Invalid event name '${event}'`);
    }
    /**
     * Add listener for the `data` event.
     * @throws if the decoder stream has already ended.
     */
    onData(callback) {
        assert(!this.ended, 'Cannot subscribe to the `data` event because the decoder stream has already ended.');
        let currentListeners = this._listeners.get('data');
        if (!currentListeners) {
            currentListeners = new DisposableMap();
            this._listeners.set('data', currentListeners);
        }
        currentListeners.set(callback, this._onData.event(callback));
    }
    /**
     * Add listener for the `error` event.
     * @throws if the decoder stream has already ended.
     */
    onError(callback) {
        assert(!this.ended, 'Cannot subscribe to the `error` event because the decoder stream has already ended.');
        let currentListeners = this._listeners.get('error');
        if (!currentListeners) {
            currentListeners = new DisposableMap();
            this._listeners.set('error', currentListeners);
        }
        currentListeners.set(callback, this._onError.event(callback));
    }
    /**
     * Add listener for the `end` event.
     * @throws if the decoder stream has already ended.
     */
    onEnd(callback) {
        assert(!this.ended, 'Cannot subscribe to the `end` event because the decoder stream has already ended.');
        let currentListeners = this._listeners.get('end');
        if (!currentListeners) {
            currentListeners = new DisposableMap();
            this._listeners.set('end', currentListeners);
        }
        currentListeners.set(callback, this._onEnd.event(callback));
    }
    /**
     * Pauses the stream.
     */
    pause() {
        this.stream.pause();
    }
    /**
     * Resumes the stream if it has been paused.
     * @throws if the decoder stream has already ended.
     */
    resume() {
        assert(this.ended === false, 'Cannot resume the stream because it has already ended.');
        this.stream.resume();
    }
    /**
     * Destroys(disposes) the stream.
     */
    destroy() {
        this.dispose();
    }
    /**
     * Removes a previously-registered event listener for a specified event.
     *
     * Note!
     *  - the callback function must be the same as the one that was used when
     * 	  registering the event listener as it is used as an identifier to
     *    remove the listener
     *  - this method is idempotent and results in no-op if the listener is
     *    not found, therefore passing incorrect `callback` function may
     *    result in silent unexpected behavior
     */
    removeListener(eventName, callback) {
        const listeners = this._listeners.get(eventName);
        if (listeners === undefined) {
            return;
        }
        for (const [listener] of listeners) {
            if (listener !== callback) {
                continue;
            }
            listeners.deleteAndDispose(listener);
        }
    }
    /**
     * This method is called when the input stream ends.
     */
    onStreamEnd() {
        if (this._ended) {
            return;
        }
        this._ended = true;
        this._onEnd.fire();
        this.settledPromise.complete();
    }
    /**
     * This method is called when the input stream emits an error.
     * We re-emit the error here by default, but subclasses can
     * override this method to handle the error differently.
     */
    onStreamError(error) {
        this._onError.fire(error);
    }
    /**
     * Consume all messages from the stream, blocking until the stream finishes.
     * @throws if the decoder stream has already ended.
     */
    async consumeAll() {
        assert(!this._ended, 'Cannot consume all messages of the stream that has already ended.');
        const messages = [];
        for await (const maybeMessage of this) {
            if (maybeMessage === null) {
                break;
            }
            messages.push(maybeMessage);
        }
        return messages;
    }
    /**
     * Async iterator interface for the decoder.
     * @throws if the decoder stream has already ended.
     */
    [Symbol.asyncIterator]() {
        assert(!this._ended, 'Cannot iterate on messages of the stream that has already ended.');
        const asyncDecoder = this._register(new AsyncDecoder(this));
        return asyncDecoder[Symbol.asyncIterator]();
    }
    dispose() {
        this.settledPromise.complete();
        this._listeners.clearAndDisposeAll();
        this.stream.destroy();
        super.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZURlY29kZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvYmFzZS9iYXNlRGVjb2Rlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFcEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxhQUFhLEVBQWUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMzRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQU8zRTs7Ozs7R0FLRztBQUNILE1BQU0sT0FBZ0IsV0FHcEIsU0FBUSxvQkFBb0I7SUF3QjdCOztPQUVHO0lBQ0gsWUFDb0IsTUFBeUI7UUFFNUMsS0FBSyxFQUFFLENBQUM7UUFGVyxXQUFNLEdBQU4sTUFBTSxDQUFtQjtRQTNCN0M7O1dBRUc7UUFDSyxXQUFNLEdBQUcsS0FBSyxDQUFDO1FBRUosWUFBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQUssQ0FBQyxDQUFDO1FBQzdDLFdBQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUM3QyxhQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUyxDQUFDLENBQUM7UUFFakU7O1dBRUc7UUFDYyxlQUFVLEdBR3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBaUJ4Qzs7V0FFRztRQUNLLFlBQU8sR0FBRyxLQUFLLENBQUM7UUFFeEI7Ozs7V0FJRztRQUNLLG1CQUFjLEdBQUcsSUFBSSxlQUFlLEVBQVEsQ0FBQztJQVpyRCxDQUFDO0lBY0Q7Ozs7Ozs7T0FPRztJQUNILElBQVcsT0FBTztRQUNqQix1REFBdUQ7UUFDdkQsdURBQXVEO1FBQ3ZELHVEQUF1RDtRQUN2RCx1REFBdUQ7UUFDdkQsdURBQXVEO1FBQ3ZELE1BQU0sQ0FDTCxJQUFJLENBQUMsT0FBTyxFQUNaO1lBQ0MscUVBQXFFO1lBQ3JFLDhCQUE4QjtTQUM5QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FDWCxDQUFDO1FBRUYsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksS0FBSztRQUNYLE1BQU0sQ0FDTCxJQUFJLENBQUMsTUFBTSxLQUFLLEtBQUssRUFDckIsNkNBQTZDLENBQzdDLENBQUM7UUFDRixNQUFNLENBQ0wsSUFBSSxDQUFDLFVBQVUsS0FBSyxLQUFLLEVBQ3pCLGdEQUFnRCxDQUNoRCxDQUFDO1FBRUYsb0NBQW9DO1FBQ3BDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBRXBCOzs7OztXQUtHO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFeEQsMkRBQTJEO1FBQzNELDJEQUEyRDtRQUMzRCx5Q0FBeUM7UUFDekMsSUFBSSxJQUFJLENBQUMsTUFBTSxZQUFZLFdBQVcsRUFBRSxDQUFDO1lBQ3hDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDckIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQVcsS0FBSztRQUNmLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNwQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxlQUFlLENBQUMsSUFBTztRQUM5QixJQUFJLENBQUM7WUFDSixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0IsQ0FBQztJQUNGLENBQUM7SUFLTSxFQUFFLENBQUMsS0FBMkIsRUFBRSxRQUFpQjtRQUN2RCxJQUFJLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBNkIsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCxJQUFJLEtBQUssS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUN2QixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBa0MsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRCxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUNyQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBc0IsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFFRCxXQUFXLENBQUMsS0FBSyxFQUFFLHVCQUF1QixLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRDs7O09BR0c7SUFDSSxNQUFNLENBQUMsUUFBMkI7UUFDeEMsTUFBTSxDQUNMLENBQUMsSUFBSSxDQUFDLEtBQUssRUFDWCxvRkFBb0YsQ0FDcEYsQ0FBQztRQUVGLElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFbkQsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdkIsZ0JBQWdCLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFRDs7O09BR0c7SUFDSSxPQUFPLENBQUMsUUFBZ0M7UUFDOUMsTUFBTSxDQUNMLENBQUMsSUFBSSxDQUFDLEtBQUssRUFDWCxxRkFBcUYsQ0FDckYsQ0FBQztRQUVGLElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEQsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdkIsZ0JBQWdCLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBRUQsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQy9ELENBQUM7SUFFRDs7O09BR0c7SUFDSSxLQUFLLENBQUMsUUFBb0I7UUFDaEMsTUFBTSxDQUNMLENBQUMsSUFBSSxDQUFDLEtBQUssRUFDWCxtRkFBbUYsQ0FDbkYsQ0FBQztRQUVGLElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFbEQsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdkIsZ0JBQWdCLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUM5QyxDQUFDO1FBRUQsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUs7UUFDWCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3JCLENBQUM7SUFFRDs7O09BR0c7SUFDSSxNQUFNO1FBQ1osTUFBTSxDQUNMLElBQUksQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUNwQix3REFBd0QsQ0FDeEQsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVEOztPQUVHO0lBQ0ksT0FBTztRQUNiLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNoQixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7T0FVRztJQUNJLGNBQWMsQ0FBQyxTQUErQixFQUFFLFFBQWtCO1FBQ3hFLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2pELElBQUksU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzdCLE9BQU87UUFDUixDQUFDO1FBRUQsS0FBSyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksU0FBUyxFQUFFLENBQUM7WUFDcEMsSUFBSSxRQUFRLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQzNCLFNBQVM7WUFDVixDQUFDO1lBRUQsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7SUFDRixDQUFDO0lBRUQ7O09BRUc7SUFDTyxXQUFXO1FBQ3BCLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2pCLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssYUFBYSxDQUFDLEtBQVk7UUFDakMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVEOzs7T0FHRztJQUNJLEtBQUssQ0FBQyxVQUFVO1FBQ3RCLE1BQU0sQ0FDTCxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQ1osbUVBQW1FLENBQ25FLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFFcEIsSUFBSSxLQUFLLEVBQUUsTUFBTSxZQUFZLElBQUksSUFBSSxFQUFFLENBQUM7WUFDdkMsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzNCLE1BQU07WUFDUCxDQUFDO1lBRUQsUUFBUSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM3QixDQUFDO1FBRUQsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVEOzs7T0FHRztJQUNILENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztRQUNyQixNQUFNLENBQ0wsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUNaLGtFQUFrRSxDQUNsRSxDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRTVELE9BQU8sWUFBWSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO0lBQzdDLENBQUM7SUFFZSxPQUFPO1FBQ3RCLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFL0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFdEIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7Q0FDRCJ9