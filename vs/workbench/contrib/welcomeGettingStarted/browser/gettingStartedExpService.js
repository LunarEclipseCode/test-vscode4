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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
export const IGettingStartedExperimentService = createDecorator('gettingStartedExperimentService');
const EXPERIMENT_STORAGE_KEY = 'gettingStartedExperiment';
export var GettingStartedExperimentGroup;
(function (GettingStartedExperimentGroup) {
    GettingStartedExperimentGroup["New"] = "newExp";
    GettingStartedExperimentGroup["Control"] = "controlExp";
    GettingStartedExperimentGroup["Default"] = "defaultExp";
})(GettingStartedExperimentGroup || (GettingStartedExperimentGroup = {}));
const STABLE_EXPERIMENT_GROUPS = [
    // Bump the iteration each time we change group allocations
    { name: GettingStartedExperimentGroup.New, min: 0.0, max: 0.2, iteration: 1, walkthroughId: 'NewWelcomeExperience' },
    { name: GettingStartedExperimentGroup.Control, min: 0.2, max: 0.4, iteration: 1, walkthroughId: 'Setup' },
    { name: GettingStartedExperimentGroup.Default, min: 0.4, max: 1, iteration: 1, walkthroughId: 'Setup' }
];
const INSIDERS_EXPERIMENT_GROUPS = [
    // Bump the iteration each time we change group allocations
    { name: GettingStartedExperimentGroup.New, min: 0.0, max: 0.3, iteration: 1, walkthroughId: 'NewWelcomeExperience' },
    { name: GettingStartedExperimentGroup.Control, min: 0.3, max: 0.6, iteration: 1, walkthroughId: 'Setup' },
    { name: GettingStartedExperimentGroup.Default, min: 0.6, max: 1, iteration: 1, walkthroughId: 'Setup' }
];
let GettingStartedExperimentService = class GettingStartedExperimentService extends Disposable {
    constructor(storageService, telemetryService, productService) {
        super();
        this.storageService = storageService;
        this.telemetryService = telemetryService;
        this.productService = productService;
        this.experiment = this.getOrCreateExperiment();
        this.sendExperimentTelemetry();
    }
    getExperimentAllocation() {
        const quality = this.productService.quality;
        if (quality === 'stable') {
            return STABLE_EXPERIMENT_GROUPS;
        }
        else if (quality === 'insider') {
            return INSIDERS_EXPERIMENT_GROUPS;
        }
        return;
    }
    getOrCreateExperiment() {
        const storedExperiment = this.storageService.get(EXPERIMENT_STORAGE_KEY, -1 /* StorageScope.APPLICATION */);
        if (storedExperiment) {
            try {
                return JSON.parse(storedExperiment);
            }
            catch (e) {
                this.storageService.remove(EXPERIMENT_STORAGE_KEY, -1 /* StorageScope.APPLICATION */);
            }
        }
        const newExperiment = this.createNewExperiment();
        if (!newExperiment) {
            return;
        }
        this.storageService.store(EXPERIMENT_STORAGE_KEY, JSON.stringify(newExperiment), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        return newExperiment;
    }
    createNewExperiment() {
        const cohort = Math.random();
        const experimentGroups = this.getExperimentAllocation();
        if (!experimentGroups) {
            return;
        }
        for (const group of experimentGroups) {
            if (cohort >= group.min && cohort < group.max) {
                return { cohort, experimentGroup: group.name, walkthroughId: group.walkthroughId, iteration: group.iteration };
            }
        }
        return;
    }
    sendExperimentTelemetry() {
        if (!this.experiment) {
            return;
        }
        this.telemetryService.publicLog2('gettingStarted.experimentCohort', {
            cohort: this.experiment.cohort,
            experimentGroup: this.experiment.experimentGroup,
            iteration: this.experiment.iteration,
            walkthroughId: this.experiment.walkthroughId
        });
    }
    getCurrentExperiment() {
        return this.experiment;
    }
};
GettingStartedExperimentService = __decorate([
    __param(0, IStorageService),
    __param(1, ITelemetryService),
    __param(2, IProductService)
], GettingStartedExperimentService);
export { GettingStartedExperimentService };
registerSingleton(IGettingStartedExperimentService, GettingStartedExperimentService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dGluZ1N0YXJ0ZWRFeHBTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZEV4cFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFTeEYsTUFBTSxDQUFDLE1BQU0sZ0NBQWdDLEdBQUcsZUFBZSxDQUFtQyxpQ0FBaUMsQ0FBQyxDQUFDO0FBT3JJLE1BQU0sc0JBQXNCLEdBQUcsMEJBQTBCLENBQUM7QUFVMUQsTUFBTSxDQUFOLElBQVksNkJBSVg7QUFKRCxXQUFZLDZCQUE2QjtJQUN4QywrQ0FBYyxDQUFBO0lBQ2QsdURBQXNCLENBQUE7SUFDdEIsdURBQXNCLENBQUE7QUFDdkIsQ0FBQyxFQUpXLDZCQUE2QixLQUE3Qiw2QkFBNkIsUUFJeEM7QUFFRCxNQUFNLHdCQUF3QixHQUFnQztJQUM3RCwyREFBMkQ7SUFDM0QsRUFBRSxJQUFJLEVBQUUsNkJBQTZCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxzQkFBc0IsRUFBRTtJQUNw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