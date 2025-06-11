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
import { assert } from '../../../../../../base/common/assert.js';
import { cancelPreviousCalls } from '../../../../../../base/common/decorators/cancelPreviousCalls.js';
import { CancellationError } from '../../../../../../base/common/errors.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { FailedToResolveContentsStream, ResolveError } from '../../promptFileReferenceErrors.js';
import { INSTRUCTIONS_LANGUAGE_ID, MODE_LANGUAGE_ID, PROMPT_LANGUAGE_ID, PromptsType } from '../promptTypes.js';
import { ObservableDisposable } from '../utils/observableDisposable.js';
/**
 * Default {@link IPromptContentsProviderOptions} options.
 */
export const DEFAULT_OPTIONS = {
    allowNonPromptFiles: false,
};
/**
 * Base class for prompt contents providers. Classes that extend this one are responsible to:
 *
 * - implement the {@link getContentsStream} method to provide the contents stream
 *   of a prompt; this method should throw a `ResolveError` or its derivative if the contents
 *   cannot be parsed for any reason
 * - fire a {@link TChangeEvent} event on the {@link onChangeEmitter} event when
 * 	 prompt contents change
 * - misc:
 *   - provide the {@link uri} property that represents the URI of a prompt that
 *     the contents are for
 *   - implement the {@link toString} method to return a string representation of this
 *     provider type to aid with debugging/tracing
 */
export class PromptContentsProviderBase extends ObservableDisposable {
    /**
     * Prompt contents stream.
     */
    get contents() {
        return this.getContentsStream('full');
    }
    /**
     * Prompt type used to determine how to interpret file contents.
     */
    get promptType() {
        const { languageId } = this;
        if (languageId === PROMPT_LANGUAGE_ID) {
            return PromptsType.prompt;
        }
        if (languageId === INSTRUCTIONS_LANGUAGE_ID) {
            return PromptsType.instructions;
        }
        if (languageId === MODE_LANGUAGE_ID) {
            return PromptsType.mode;
        }
        return 'non-prompt';
    }
    constructor(options) {
        super();
        /**
         * Internal event emitter for the prompt contents change event. Classes that extend
         * this abstract class are responsible to use this emitter to fire the contents change
         * event when the prompt contents get modified.
         */
        this.onChangeEmitter = this._register(new Emitter());
        /**
         * Event emitter for the prompt contents change event.
         * See {@link onContentChanged} for more details.
         */
        this.onContentChangedEmitter = this._register(new Emitter());
        /**
         * Event that fires when the prompt contents change. The event is either
         * a `VSBufferReadableStream` stream with changed contents or an instance of
         * the `ResolveError` class representing a parsing failure case.
         *
         * `Note!` this field is meant to be used by the external consumers of the prompt
         *         contents provider that the classes that extend this abstract class.
         *         Please use the {@link onChangeEmitter} event to provide a change
         *         event in your prompt contents implementation instead.
         */
        this.onContentChanged = this.onContentChangedEmitter.event;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
        };
    }
    /**
     * Internal common implementation of the event that should be fired when
     * prompt contents change.
     */
    onContentsChanged(event, cancellationToken) {
        const promise = (cancellationToken?.isCancellationRequested)
            ? Promise.reject(new CancellationError())
            : this.getContentsStream(event, cancellationToken);
        promise
            .then((stream) => {
            if (cancellationToken?.isCancellationRequested || this.isDisposed) {
                stream.destroy();
                throw new CancellationError();
            }
            this.onContentChangedEmitter.fire(stream);
        })
            .catch((error) => {
            if (error instanceof ResolveError) {
                this.onContentChangedEmitter.fire(error);
                return;
            }
            this.onContentChangedEmitter.fire(new FailedToResolveContentsStream(this.uri, error));
        });
        return this;
    }
    /**
     * Start producing the prompt contents data.
     */
    start() {
        assert(!this.isDisposed, 'Cannot start contents provider that was already disposed.');
        // `'full'` means "everything has changed"
        this.onContentsChanged('full');
        // subscribe to the change event emitted by a child class
        this._register(this.onChangeEmitter.event(this.onContentsChanged, this));
        return this;
    }
}
__decorate([
    cancelPreviousCalls
], PromptContentsProviderBase.prototype, "onContentsChanged", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0Q29udGVudHNQcm92aWRlckJhc2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9jb250ZW50UHJvdmlkZXJzL3Byb21wdENvbnRlbnRzUHJvdmlkZXJCYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUdqRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFakUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNoSCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQWN4RTs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBbUM7SUFDOUQsbUJBQW1CLEVBQUUsS0FBSztDQUMxQixDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sT0FBZ0IsMEJBRXBCLFNBQVEsb0JBQW9CO0lBTzdCOztPQUVHO0lBQ0gsSUFBVyxRQUFRO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRDs7T0FFRztJQUNILElBQVcsVUFBVTtRQUNwQixNQUFNLEVBQUUsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRTVCLElB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