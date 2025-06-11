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
import { assertDefined } from '../../../../../../base/common/types.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { BasePromptParser } from './basePromptParser.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { TextModelContentsProvider } from '../contentProviders/textModelContentsProvider.js';
import { FilePromptContentProvider } from '../contentProviders/filePromptContentsProvider.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { Schemas } from '../../../../../../base/common/network.js';
/**
 * Get prompt contents provider object based on the prompt type.
 */
function getContentsProvider(uri, options, modelService, instaService) {
    // use text model contents provider for `untitled` documents
    if (uri.scheme === Schemas.untitled) {
        const model = modelService.getModel(uri);
        assertDefined(model, `Cannot find model of untitled document '${uri.path}'.`);
        return instaService
            .createInstance(TextModelContentsProvider, model, options);
    }
    return instaService
        .createInstance(FilePromptContentProvider, uri, options);
}
/**
 * General prompt parser class that automatically infers a prompt
 * contents provider type by the type of provided prompt URI.
 */
let PromptParser = class PromptParser extends BasePromptParser {
    constructor(uri, options, logService, modelService, instaService, workspaceService) {
        const contentsProvider = getContentsProvider(uri, options, modelService, instaService);
        super(contentsProvider, options, instaService, workspaceService, logService);
        this.contentsProvider = this._register(contentsProvider);
    }
    /**
     * Returns a string representation of this object.
     */
    toString() {
        const { sourceName } = this.contentsProvider;
        return `prompt-parser:${sourceName}:${this.uri.path}`;
    }
};
PromptParser = __decorate([
    __param(2, ILogService),
    __param(3, IModelService),
    __param(4, IInstantiationService),
    __param(5, IWorkspaceContextService)
], PromptParser);
export { PromptParser };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0UGFyc2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy9wcm9tcHRQYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXZFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQXdCLE1BQU0sdUJBQXVCLENBQUM7QUFDL0UsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRTs7R0FFRztBQUNILFNBQVMsbUJBQW1CLENBQzNCLEdBQVEsRUFDUixPQUFzQyxFQUN0QyxZQUEyQixFQUMzQixZQUFtQztJQUVuQyw0REFBNEQ7SUFDNUQsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNyQyxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXpDLGFBQWEsQ0FDWixLQUFLLEVBQ0wsMkNBQTJDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FDdkQsQ0FBQztRQUVGLE9BQU8sWUFBWTthQUNqQixjQUFjLENBQUMseUJBQXlCLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRCxPQUFPLFlBQVk7U0FDakIsY0FBYyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0ksSUFBTSxZQUFZLEdBQWxCLE1BQU0sWUFBYSxTQUFRLGdCQUF5QztJQU0xRSxZQUNDLEdBQVEsRUFDUixPQUFzQyxFQUN6QixVQUF1QixFQUNyQixZQUEyQixFQUNuQixZQUFtQyxFQUNoQyxnQkFBMEM7UUFFcEUsTUFBTSxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUV2RixLQUFLLENBQ0osZ0JBQWdCLEVBQ2hCLE9BQU8sRUFDUCxZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLFVBQVUsQ0FDVixDQUFDO1FBRUYsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQ7O09BRUc7SUFDYSxRQUFRO1FBQ3ZCLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7UUFFN0MsT0FBTyxpQkFBaUIsVUFBVSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDdkQsQ0FBQztDQUNELENBQUE7QUFuQ1ksWUFBWTtJQVN0QixXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHdCQUF3QixDQUFBO0dBWmQsWUFBWSxDQW1DeEIifQ==