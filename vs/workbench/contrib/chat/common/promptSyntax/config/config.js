/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ContextKeyExpr } from '../../../../../../platform/contextkey/common/contextkey.js';
import { PromptsType } from '../promptTypes.js';
import { getPromptFileDefaultLocation } from './promptFileLocations.js';
/**
 * Configuration helper for the `reusable prompts` feature.
 * @see {@link PromptsConfig.KEY}, {@link PromptsConfig.PROMPT_LOCATIONS_KEY}, {@link PromptsConfig.INSTRUCTIONS_LOCATION_KEY} or {@link PromptsConfig.MODE_LOCATION_KEY}.
 *
 * ### Functions
 *
 * - {@link enabled} allows to check if the feature is enabled
 * - {@link getLocationsValue} allows to current read configuration value
 * - {@link promptSourceFolders} gets list of source folders for prompt files
 *
 * ### File Paths Resolution
 *
 * We resolve only `*.prompt.md` files inside the resulting source folders. Relative paths are resolved
 * relative to:
 *
 * - the current workspace `root`, if applicable, in other words one of the workspace folders
 *   can be used as a prompt files source folder
 * - root of each top-level folder in the workspace (if there are multiple workspace folders)
 * - current root folder (if a single folder is open)
 */
export var PromptsConfig;
(function (PromptsConfig) {
    /**
     * Configuration key for the `reusable prompts` feature
     * (also known as `prompt files`, `prompt instructions`, etc.).
     */
    PromptsConfig.KEY = 'chat.promptFiles';
    /**
     * Configuration key for the locations of reusable prompt files.
     */
    PromptsConfig.PROMPT_LOCATIONS_KEY = 'chat.promptFilesLocations';
    /**
     * Configuration key for the locations of instructions files.
     */
    PromptsConfig.INSTRUCTIONS_LOCATION_KEY = 'chat.instructionsFilesLocations';
    /**
     * Configuration key for the locations of mode files.
     */
    PromptsConfig.MODE_LOCATION_KEY = 'chat.modeFilesLocations';
    /**
     * Checks if the feature is enabled.
     * @see {@link PromptsConfig.KEY}.
     */
    function enabled(configService) {
        const enabledValue = configService.getValue(PromptsConfig.KEY);
        return asBoolean(enabledValue) ?? false;
    }
    PromptsConfig.enabled = enabled;
    /**
     * Context key expression for the `reusable prompts` feature `enabled` status.
     */
    PromptsConfig.enabledCtx = ContextKeyExpr.equals(`config.${PromptsConfig.KEY}`, true);
    /**
     * Get value of the `reusable prompt locations` configuration setting.
     * @see {@link PROMPT_LOCATIONS_CONFIG_KEY}, {@link INSTRUCTIONS_LOCATIONS_CONFIG_KEY}, {@link MODE_LOCATIONS_CONFIG_KEY}.
     */
    function getLocationsValue(configService, type) {
        const key = getPromptFileLocationsConfigKey(type);
        const configValue = configService.getValue(key);
        if (configValue === undefined || configValue === null || Array.isArray(configValue)) {
            return undefined;
        }
        // note! this would be also true for `null` and `array`,
        // 		 but those cases are already handled above
        if (typeof configValue === 'object') {
            const paths = {};
            for (const [path, value] of Object.entries(configValue)) {
                const cleanPath = path.trim();
                const booleanValue = asBoolean(value);
                // if value can be mapped to a boolean, and the clean
                // path is not empty, add it to the map
                if ((booleanValue !== undefined) && cleanPath) {
                    paths[cleanPath] = booleanValue;
                }
            }
            return paths;
        }
        return undefined;
    }
    PromptsConfig.getLocationsValue = getLocationsValue;
    /**
     * Gets list of source folders for prompt files.
     * Defaults to {@link PROMPT_DEFAULT_SOURCE_FOLDER}, {@link INSTRUCTIONS_DEFAULT_SOURCE_FOLDER} or {@link MODE_DEFAULT_SOURCE_FOLDER}.
     */
    function promptSourceFolders(configService, type) {
        const value = getLocationsValue(configService, type);
        const defaultSourceFolder = getPromptFileDefaultLocation(type);
        // note! the `value &&` part handles the `undefined`, `null`, and `false` cases
        if (value && (typeof value === 'object')) {
            const paths = [];
            // if the default source folder is not explicitly disabled, add it
            if (value[defaultSourceFolder] !== false) {
                paths.push(defaultSourceFolder);
            }
            // copy all the enabled paths to the result list
            for (const [path, enabledValue] of Object.entries(value)) {
                // we already added the default source folder, so skip it
                if ((enabledValue === false) || (path === defaultSourceFolder)) {
                    continue;
                }
                paths.push(path);
            }
            return paths;
        }
        // `undefined`, `null`, and `false` cases
        return [];
    }
    PromptsConfig.promptSourceFolders = promptSourceFolders;
})(PromptsConfig || (PromptsConfig = {}));
export function getPromptFileLocationsConfigKey(type) {
    switch (type) {
        case PromptsType.instructions:
            return PromptsConfig.INSTRUCTIONS_LOCATION_KEY;
        case PromptsType.prompt:
            return PromptsConfig.PROMPT_LOCATIONS_KEY;
        case PromptsType.mode:
            return PromptsConfig.MODE_LOCATION_KEY;
        default:
            throw new Error('Unknown prompt type');
    }
}
/**
 * Helper to parse an input value of `any` type into a boolean.
 *
 * @param value - input value to parse
 * @returns `true` if the value is the boolean `true` value or a string that can
 * 			be clearly mapped to a boolean (e.g., `"true"`, `"TRUE"`, `"FaLSe"`, etc.),
 * 			`undefined` for rest of the values
 */
export function asBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const cleanValue = value.trim().toLowerCase();
        if (cleanValue === 'true') {
            return true;
        }
        if (cleanValue === 'false') {
            return false;
        }
        return undefined;
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29uZmlnL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDNUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2hELE9BQU8sRUFBb0UsNEJBQTRCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUUxSTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRztBQUNILE1BQU0sS0FBVyxhQUFhLENBd0c3QjtBQXhHRCxXQUFpQixhQUFhO0lBQzdCOzs7T0FHRztJQUNVLGlCQUFHLEdBQUcsa0JBQWtCLENBQUM7SUFFdEM7O09BRUc7SUFDVSxrQ0FBb0IsR0FBRywyQkFBMkIsQ0FBQztJQUVoRTs7T0FFRztJQUNVLHVDQUF5QixHQUFHLGlDQUFpQyxDQUFDO0lBQzNFOztPQUVHO0lBQ1UsK0JBQWlCLEdBQUcseUJBQXlCLENBQUM7SUFFM0Q7OztPQUdHO0lBQ0gsU0FBZ0IsT0FBTyxDQUFDLGFBQW9DO1FBQzNELE1BQU0sWUFBWSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRS9ELE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLEtBQUssQ0FBQztJQUN6QyxDQUFDO0lBSmUscUJBQU8sVUFJdEIsQ0FBQTtJQUVEOztPQUVHO0lBQ1Usd0JBQVUsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLFVBQVUsYUFBYSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRXJGOzs7T0FHRztJQUNILFNBQWdCLGlCQUFpQixDQUFDLGFBQW9DLEVBQUUsSUFBaUI7UUFDeEYsTUFBTSxHQUFHLEdBQUcsK0JBQStCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEQsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVoRCxJQUFJLFdBQVcsS0FBSyxTQUFTLElBQUksV0FBVyxLQUFLLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDckYsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELHdEQUF3RDtRQUN4RCwrQ0FBK0M7UUFDL0MsSUFBSSxPQUFPLFdBQVcsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxNQUFNLEtBQUssR0FBNEIsRUFBRSxDQUFDO1lBRTFDLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUV0QyxxREFBcUQ7Z0JBQ3JELHVDQUF1QztnQkFDdkMsSUFBSSxDQUFDLFlBQVksS0FBSyxTQUFTLENBQUMsSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDL0MsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLFlBQVksQ0FBQztnQkFDakMsQ0FBQztZQUNGLENBQUM7WUFFRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBNUJlLCtCQUFpQixvQkE0QmhDLENBQUE7SUFFRDs7O09BR0c7SUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFvQyxFQUFFLElBQWlCO1FBQzFGLE1BQU0sS0FBSyxHQUFHLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNyRCxNQUFNLG1CQUFtQixHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9ELCtFQUErRTtRQUMvRSxJQUFJLEtBQUssSUFBSSxDQUFDLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDMUMsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO1lBRTNCLGtFQUFrRTtZQUNsRSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUMxQyxLQUFLLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDakMsQ0FBQztZQUVELGdEQUFnRDtZQUNoRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMxRCx5REFBeUQ7Z0JBQ3pELElBQUksQ0FBQyxZQUFZLEtBQUssS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssbUJBQW1CLENBQUMsRUFBRSxDQUFDO29CQUNoRSxTQUFTO2dCQUNWLENBQUM7Z0JBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQixDQUFDO1lBRUQsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQseUNBQXlDO1FBQ3pDLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQTVCZSxpQ0FBbUIsc0JBNEJsQyxDQUFBO0FBRUYsQ0FBQyxFQXhHZ0IsYUFBYSxLQUFiLGFBQWEsUUF3RzdCO0FBRUQsTUFBTSxVQUFVLCtCQUErQixDQUFDLElBQWlCO0lBQ2hFLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDZCxLQUFLLFdBQVcsQ0FBQyxZQUFZO1lBQzVCLE9BQU8sYUFBYSxDQUFDLHlCQUF5QixDQUFDO1FBQ2hELEtBQUssV0FBVyxDQUFDLE1BQU07WUFDdEIsT0FBTyxhQUFhLENBQUMsb0JBQW9CLENBQUM7UUFDM0MsS0FBSyxXQUFXLENBQUMsSUFBSTtZQUNwQixPQUFPLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQztRQUN4QztZQUNDLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN6QyxDQUFDO0FBQ0YsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsU0FBUyxDQUFDLEtBQWM7SUFDdkMsSUFBSSxPQUFPLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNoQyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUM5QyxJQUFJLFVBQVUsS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUMzQixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLFVBQVUsS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUM1QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQyJ9