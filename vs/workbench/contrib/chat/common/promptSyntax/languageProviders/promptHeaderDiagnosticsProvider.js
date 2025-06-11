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
import { IPromptsService } from '../service/promptsService.js';
import { ProviderInstanceBase } from './providerInstanceBase.js';
import { assertNever } from '../../../../../../base/common/assert.js';
import { ProviderInstanceManagerBase } from './providerInstanceManagerBase.js';
import { PromptMetadataError, PromptMetadataWarning } from '../parsers/promptHeader/diagnostics.js';
import { IMarkerService, MarkerSeverity } from '../../../../../../platform/markers/common/markers.js';
/**
 * Unique ID of the markers provider class.
 */
const MARKERS_OWNER_ID = 'prompts-header-diagnostics-provider';
/**
 * Prompt header diagnostics provider for an individual text model
 * of a prompt file.
 */
let PromptHeaderDiagnosticsProvider = class PromptHeaderDiagnosticsProvider extends ProviderInstanceBase {
    constructor(model, promptsService, markerService) {
        super(model, promptsService);
        this.markerService = markerService;
    }
    /**
     * Update diagnostic markers for the current editor.
     */
    onPromptSettled(_error, token) {
        // clean up all previously added markers
        this.markerService.remove(MARKERS_OWNER_ID, [this.model.uri]);
        const { header } = this.parser;
        if (header === undefined) {
            return this;
        }
        // header parsing process is separate from the prompt parsing one, hence
        // apply markers only after the header is settled and so has diagnostics
        header.settled.then(() => {
            // by the time the promise finishes, the token might have been cancelled
            // already due to a new 'onSettle' event, hence don't apply outdated markers
            if (token.isCancellationRequested) {
                return;
            }
            const markers = [];
            for (const diagnostic of header.diagnostics) {
                markers.push(toMarker(diagnostic));
            }
            this.markerService.changeOne(MARKERS_OWNER_ID, this.model.uri, markers);
        });
        return this;
    }
    /**
     * Returns a string representation of this object.
     */
    toString() {
        return `prompt-header-diagnostics:${this.model.uri.path}`;
    }
};
PromptHeaderDiagnosticsProvider = __decorate([
    __param(1, IPromptsService),
    __param(2, IMarkerService)
], PromptHeaderDiagnosticsProvider);
/**
 * Convert a provided diagnostic object into a marker data object.
 */
function toMarker(diagnostic) {
    if (diagnostic instanceof PromptMetadataWarning) {
        return {
            message: diagnostic.message,
            severity: MarkerSeverity.Warning,
            ...diagnostic.range,
        };
    }
    if (diagnostic instanceof PromptMetadataError) {
        return {
            message: diagnostic.message,
            severity: MarkerSeverity.Error,
            ...diagnostic.range,
        };
    }
    assertNever(diagnostic, `Unknown prompt metadata diagnostic type '${diagnostic}'.`);
}
/**
 * The class that manages creation and disposal of {@link PromptHeaderDiagnosticsProvider}
 * classes for each specific editor text model.
 */
export class PromptHeaderDiagnosticsInstanceManager extends ProviderInstanceManagerBase {
    get InstanceClass() {
        return PromptHeaderDiagnosticsProvider;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0SGVhZGVyRGlhZ25vc3RpY3NQcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L2xhbmd1YWdlUHJvdmlkZXJzL3Byb21wdEhlYWRlckRpYWdub3N0aWNzUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRWpFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUV0RSxPQUFPLEVBQUUsMkJBQTJCLEVBQWtCLE1BQU0sa0NBQWtDLENBQUM7QUFDL0YsT0FBTyxFQUFlLG1CQUFtQixFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakgsT0FBTyxFQUFlLGNBQWMsRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUVuSDs7R0FFRztBQUNILE1BQU0sZ0JBQWdCLEdBQUcscUNBQXFDLENBQUM7QUFFL0Q7OztHQUdHO0FBQ0gsSUFBTSwrQkFBK0IsR0FBckMsTUFBTSwrQkFBZ0MsU0FBUSxvQkFBb0I7SUFDakUsWUFDQyxLQUFpQixFQUNBLGNBQStCLEVBQ2YsYUFBNkI7UUFFOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsQ0FBQztRQUZJLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtJQUcvRCxDQUFDO0lBRUQ7O09BRUc7SUFDZ0IsZUFBZSxDQUNqQyxNQUF5QixFQUN6QixLQUF3QjtRQUV4Qix3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFOUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDL0IsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsd0VBQXdFO1FBQ3hFLHdFQUF3RTtRQUN4RSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDeEIsd0VBQXdFO1lBQ3hFLDRFQUE0RTtZQUM1RSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO2dCQUNuQyxPQUFPO1lBQ1IsQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFrQixFQUFFLENBQUM7WUFDbEMsS0FBSyxNQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzdDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDcEMsQ0FBQztZQUVELElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUMzQixnQkFBZ0IsRUFDaEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQ2QsT0FBTyxDQUNQLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVEOztPQUVHO0lBQ2EsUUFBUTtRQUN2QixPQUFPLDZCQUE2QixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMzRCxDQUFDO0NBQ0QsQ0FBQTtBQXRESywrQkFBK0I7SUFHbEMsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLGNBQWMsQ0FBQTtHQUpYLCtCQUErQixDQXNEcEM7QUFFRDs7R0FFRztBQUNILFNBQVMsUUFBUSxDQUFDLFVBQXVCO0lBQ3hDLElBQUksVUFBVSxZQUFZLHFCQUFxQixFQUFFLENBQUM7UUFDakQsT0FBTztZQUNOLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTztZQUMzQixRQUFRLEVBQUUsY0FBYyxDQUFDLE9BQU87WUFDaEMsR0FBRyxVQUFVLENBQUMsS0FBSztTQUNuQixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksVUFBVSxZQUFZLG1CQUFtQixFQUFFLENBQUM7UUFDL0MsT0FBTztZQUNOLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTztZQUMzQixRQUFRLEVBQUUsY0FBYyxDQUFDLEtBQUs7WUFDOUIsR0FBRyxVQUFVLENBQUMsS0FBSztTQUNuQixDQUFDO0lBQ0gsQ0FBQztJQUVELFdBQVcsQ0FDVixVQUFVLEVBQ1YsNENBQTRDLFVBQVUsSUFBSSxDQUMxRCxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sT0FBTyxzQ0FBdUMsU0FBUSwyQkFBNEQ7SUFDdkgsSUFBdUIsYUFBYTtRQUNuQyxPQUFPLCtCQUErQixDQUFDO0lBQ3hDLENBQUM7Q0FDRCJ9