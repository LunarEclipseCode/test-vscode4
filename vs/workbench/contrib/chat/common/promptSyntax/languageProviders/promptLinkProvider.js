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
import { assert } from '../../../../../../base/common/assert.js';
import { assertDefined } from '../../../../../../base/common/types.js';
import { CancellationError } from '../../../../../../base/common/errors.js';
import { FolderReference, NotPromptFile } from '../../promptFileReferenceErrors.js';
/**
 * Provides link references for prompt files.
 */
let PromptLinkProvider = class PromptLinkProvider {
    constructor(promptsService) {
        this.promptsService = promptsService;
    }
    /**
     * Provide list of links for the provided text model.
     */
    async provideLinks(model, token) {
        assert(!token.isCancellationRequested, new CancellationError());
        const parser = this.promptsService.getSyntaxParserFor(model);
        assert(parser.isDisposed === false, 'Prompt parser must not be disposed.');
        // start the parser in case it was not started yet,
        // and wait for it to settle to a final result
        const { references } = await parser
            .start()
            .settled();
        // validate that the cancellation was not yet requested
        assert(!token.isCancellationRequested, new CancellationError());
        // filter out references that are not valid links
        const links = references
            .filter((reference) => {
            const { errorCondition, linkRange } = reference;
            if (!errorCondition && linkRange) {
                return true;
            }
            // don't provide links for folder references
            if (errorCondition instanceof FolderReference) {
                return false;
            }
            return errorCondition instanceof NotPromptFile;
        })
            .map((reference) => {
            const { uri, linkRange } = reference;
            // must always be true because of the filter above
            assertDefined(linkRange, 'Link range must be defined.');
            return {
                range: linkRange,
                url: uri,
            };
        });
        return {
            links,
        };
    }
};
PromptLinkProvider = __decorate([
    __param(0, IPromptsService)
], PromptLinkProvider);
export { PromptLinkProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0TGlua1Byb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvbGFuZ3VhZ2VQcm92aWRlcnMvcHJvbXB0TGlua1Byb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFakUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRTVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFHcEY7O0dBRUc7QUFDSSxJQUFNLGtCQUFrQixHQUF4QixNQUFNLGtCQUFrQjtJQUM5QixZQUNtQyxjQUErQjtRQUEvQixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7SUFFbEUsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLFlBQVksQ0FDeEIsS0FBaUIsRUFDakIsS0FBd0I7UUFFeEIsTUFBTSxDQUNMLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUM5QixJQUFJLGlCQUFpQixFQUFFLENBQ3ZCLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdELE1BQU0sQ0FDTCxNQUFNLENBQUMsVUFBVSxLQUFLLEtBQUssRUFDM0IscUNBQXFDLENBQ3JDLENBQUM7UUFFRixtREFBbUQ7UUFDbkQsOENBQThDO1FBQzlDLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxNQUFNLE1BQU07YUFDakMsS0FBSyxFQUFFO2FBQ1AsT0FBTyxFQUFFLENBQUM7UUFFWix1REFBdUQ7UUFDdkQsTUFBTSxDQUNMLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUM5QixJQUFJLGlCQUFpQixFQUFFLENBQ3ZCLENBQUM7UUFFRixpREFBaUQ7UUFDakQsTUFBTSxLQUFLLEdBQVksVUFBVTthQUMvQixNQUFNLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRTtZQUNyQixNQUFNLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxHQUFHLFNBQVMsQ0FBQztZQUNoRCxJQUFJLENBQUMsY0FBYyxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUNsQyxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFFRCw0Q0FBNEM7WUFDNUMsSUFBSSxjQUFjLFlBQVksZUFBZSxFQUFFLENBQUM7Z0JBQy9DLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUVELE9BQU8sY0FBYyxZQUFZLGFBQWEsQ0FBQztRQUNoRCxDQUFDLENBQUM7YUFDRCxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRTtZQUNsQixNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxHQUFHLFNBQVMsQ0FBQztZQUVyQyxrREFBa0Q7WUFDbEQsYUFBYSxDQUNaLFNBQVMsRUFDVCw2QkFBNkIsQ0FDN0IsQ0FBQztZQUVGLE9BQU87Z0JBQ04sS0FBSyxFQUFFLFNBQVM7Z0JBQ2hCLEdBQUcsRUFBRSxHQUFHO2FBQ1IsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUosT0FBTztZQUNOLEtBQUs7U0FDTCxDQUFDO0lBQ0gsQ0FBQztDQUNELENBQUE7QUF0RVksa0JBQWtCO0lBRTVCLFdBQUEsZUFBZSxDQUFBO0dBRkwsa0JBQWtCLENBc0U5QiJ9