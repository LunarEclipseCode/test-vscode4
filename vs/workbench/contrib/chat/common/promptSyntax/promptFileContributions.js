/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ConfigMigration } from './config/configMigration.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../../common/contributions.js';
import { PromptLinkProvider } from './languageProviders/promptLinkProvider.js';
import { PromptLinkDiagnosticsInstanceManager } from './languageProviders/promptLinkDiagnosticsProvider.js';
import { PromptHeaderDiagnosticsInstanceManager } from './languageProviders/promptHeaderDiagnosticsProvider.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { PromptPathAutocompletion } from './languageProviders/promptPathAutocompletion.js';
/**
 * Function that registers all prompt-file related contributions.
 */
export function registerPromptFileContributions() {
    // all language constributions
    registerContribution(PromptLinkProvider);
    registerContribution(PromptLinkDiagnosticsInstanceManager);
    registerContribution(PromptHeaderDiagnosticsInstanceManager);
    /**
     * PromptDecorationsProviderInstanceManager is currently disabled because the only currently
     * available decoration is the Front Matter header, which we decided to disable for now.
     * Add it back when more decorations are needed.
     */
    // registerContribution(PromptDecorationsProviderInstanceManager); ,
    /**
     * We restrict this provider to `Unix` machines for now because of
     * the filesystem paths differences on `Windows` operating system.
     *
     * Notes on `Windows` support:
     * 	- we add the `./` for the first path component, which may not work on `Windows`
     * 	- the first path component of the absolute paths must be a drive letter
     */
    if (!isWindows) {
        registerContribution(PromptPathAutocompletion);
    }
    registerContribution(ConfigMigration);
}
/**
 * Register a specific workbench contribution.
 */
function registerContribution(contribution) {
    Registry.as(Extensions.Workbench).registerWorkbenchContribution(contribution, 4 /* LifecyclePhase.Eventually */);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZUNvbnRyaWJ1dGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9wcm9tcHRGaWxlQ29udHJpYnV0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDOUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRS9FLE9BQU8sRUFBbUMsVUFBVSxFQUEwQixNQUFNLHFDQUFxQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxzQ0FBc0MsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ2hILE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUczRjs7R0FFRztBQUNILE1BQU0sVUFBVSwrQkFBK0I7SUFFOUMsOEJBQThCO0lBRTlCLG9CQUFvQixDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDekMsb0JBQW9CLENBQUMsb0NBQW9DLENBQUMsQ0FBQztJQUMzRCxvQkFBb0IsQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0lBQzdEOzs7O09BSUc7SUFDSCxvRUFBb0U7SUFHcEU7Ozs7Ozs7T0FPRztJQUNILElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNoQixvQkFBb0IsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRCxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBT0Q7O0dBRUc7QUFDSCxTQUFTLG9CQUFvQixDQUFDLFlBQTJCO0lBQ3hELFFBQVEsQ0FBQyxFQUFFLENBQWtDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLG9DQUE0QixDQUFDO0FBQzNJLENBQUMifQ==