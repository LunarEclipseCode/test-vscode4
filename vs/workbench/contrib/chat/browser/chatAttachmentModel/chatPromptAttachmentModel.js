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
import { Emitter } from '../../../../../base/common/event.js';
import { PromptParser } from '../../common/promptSyntax/parsers/promptParser.js';
import { ObservableDisposable } from '../../common/promptSyntax/utils/observableDisposable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
/**
 * Model for a single chat prompt instructions attachment.
 */
let ChatPromptAttachmentModel = class ChatPromptAttachmentModel extends ObservableDisposable {
    /**
     * Get the prompt instructions reference instance.
     */
    get reference() {
        return this._reference;
    }
    /**
     * Get `URI` for the main reference and `URI`s of all valid child
     * references it may contain, including reference of this model itself.
     */
    get references() {
        const { reference } = this;
        const { errorCondition } = reference;
        // return no references if the attachment is disabled
        // or if this object itself has an error
        if (errorCondition) {
            return [];
        }
        // otherwise return `URI` for the main reference and
        // all valid child `URI` references it may contain
        return [
            ...reference.allValidReferences.map(ref => ref.uri),
            reference.uri,
        ];
    }
    /**
     * Get list of all tools associated with the prompt.
     *
     * Note! This property returns pont-in-time state of the tools metadata
     *       and does not take into account if the prompt or its nested child
     *       references are still being resolved. Please use the {@link settled}
     *       or {@link allSettled} properties if you need to retrieve the final
     *       list of the tools available.
     */
    get toolsMetadata() {
        return this.reference.allToolsMetadata;
    }
    /**
     * Promise that resolves when the prompt is fully parsed,
     * including all its possible nested child references.
     */
    get allSettled() {
        return this.reference.allSettled();
    }
    /**
     * Get the top-level error of the prompt instructions
     * reference, if any.
     */
    get topError() {
        return this.reference.topError;
    }
    constructor(uri, instantiationService) {
        super();
        this.uri = uri;
        this.instantiationService = instantiationService;
        /**
         * Event that fires when the error condition of the prompt
         * reference changes.
         *
         * See {@link onUpdate}.
         */
        this._onUpdate = this._register(new Emitter());
        /**
         * Subscribe to the event that fires when the underlying prompt
         * reference instance is updated.
         * See {@link BasePromptParser.onUpdate}.
         */
        this.onUpdate = this._onUpdate.event;
        this._reference = this._register(this.instantiationService.createInstance(PromptParser, this.uri, 
        // in this case we know that the attached file must have been a
        // prompt file, hence we pass the `allowNonPromptFiles` option
        // to the provider to allow for non-prompt files to be attached
        { allowNonPromptFiles: true }));
        this._register(this._reference.onUpdate(this._onUpdate.fire.bind(this._onUpdate)));
    }
    /**
     * Start resolving the prompt instructions reference and child references
     * that it may contain.
     */
    resolve() {
        this._reference.start();
        return this;
    }
};
ChatPromptAttachmentModel = __decorate([
    __param(1, IInstantiationService)
], ChatPromptAttachmentModel);
export { ChatPromptAttachmentModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFByb21wdEF0dGFjaG1lbnRNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRBdHRhY2htZW50TW9kZWwvY2hhdFByb21wdEF0dGFjaG1lbnRNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRWpGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRS9GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBT3RHOztHQUVHO0FBQ0ksSUFBTSx5QkFBeUIsR0FBL0IsTUFBTSx5QkFBMEIsU0FBUSxvQkFBb0I7SUFPbEU7O09BRUc7SUFDSCxJQUFXLFNBQVM7UUFDbkIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxJQUFXLFVBQVU7UUFDcEIsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUMzQixNQUFNLEVBQUUsY0FBYyxFQUFFLEdBQUcsU0FBUyxDQUFDO1FBRXJDLHFEQUFxRDtRQUNyRCx3Q0FBd0M7UUFDeEMsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwQixPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUM7UUFFRCxvREFBb0Q7UUFDcEQsa0RBQWtEO1FBQ2xELE9BQU87WUFDTixHQUFHLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1lBQ25ELFNBQVMsQ0FBQyxHQUFHO1NBQ2IsQ0FBQztJQUNILENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILElBQVcsYUFBYTtRQUN2QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7SUFDeEMsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQVcsVUFBVTtRQUNwQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEMsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQVcsUUFBUTtRQUNsQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO0lBQ2hDLENBQUM7SUFnQkQsWUFDaUIsR0FBUSxFQUNELG9CQUE0RDtRQUVuRixLQUFLLEVBQUUsQ0FBQztRQUhRLFFBQUcsR0FBSCxHQUFHLENBQUs7UUFDZ0IseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQWhCcEY7Ozs7O1dBS0c7UUFDTyxjQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDMUQ7Ozs7V0FJRztRQUNhLGFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQztRQVEvQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQy9CLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQ3ZDLFlBQVksRUFDWixJQUFJLENBQUMsR0FBRztRQUNSLCtEQUErRDtRQUMvRCw4REFBOEQ7UUFDOUQsK0RBQStEO1FBQy9ELEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLENBQzdCLENBQ0QsQ0FBQztRQUVGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQ3RDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQ3hDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSSxPQUFPO1FBQ2IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV4QixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7Q0FDRCxDQUFBO0FBOUdZLHlCQUF5QjtJQWlGbkMsV0FBQSxxQkFBcUIsQ0FBQTtHQWpGWCx5QkFBeUIsQ0E4R3JDIn0=