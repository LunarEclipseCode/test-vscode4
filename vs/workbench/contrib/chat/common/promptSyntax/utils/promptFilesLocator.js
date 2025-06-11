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
import { URI } from '../../../../../../base/common/uri.js';
import { assert } from '../../../../../../base/common/assert.js';
import { isAbsolute } from '../../../../../../base/common/path.js';
import { ResourceSet } from '../../../../../../base/common/map.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { getPromptFileLocationsConfigKey, PromptsConfig } from '../config/config.js';
import { basename, dirname, joinPath } from '../../../../../../base/common/resources.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { getPromptFileExtension, getPromptFileType } from '../config/promptFileLocations.js';
import { IWorkbenchEnvironmentService } from '../../../../../services/environment/common/environmentService.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { getExcludes, ISearchService } from '../../../../../services/search/common/search.js';
import { isCancellationError } from '../../../../../../base/common/errors.js';
import { IUserDataProfileService } from '../../../../../services/userDataProfile/common/userDataProfile.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
/**
 * Utility class to locate prompt files.
 */
let PromptFilesLocator = class PromptFilesLocator extends Disposable {
    constructor(fileService, configService, workspaceService, environmentService, searchService, userDataService) {
        super();
        this.fileService = fileService;
        this.configService = configService;
        this.workspaceService = workspaceService;
        this.environmentService = environmentService;
        this.searchService = searchService;
        this.userDataService = userDataService;
    }
    /**
     * List all prompt files from the filesystem.
     *
     * @returns List of prompt files found in the workspace.
     */
    async listFiles(type, storage, token) {
        if (storage === 'local') {
            return await this.listFilesInLocal(type, token);
        }
        else {
            return await this.listFilesInUserData(type, token);
        }
    }
    async listFilesInUserData(type, token) {
        const files = await this.resolveFilesAtLocation(this.userDataService.currentProfile.promptsHome, token);
        return files.filter(file => getPromptFileType(file) === type);
    }
    createFilesUpdatedEvent(type) {
        const disoposables = new DisposableStore();
        const eventEmitter = disoposables.add(new Emitter());
        const key = getPromptFileLocationsConfigKey(type);
        const userDataFolder = this.userDataService.currentProfile.promptsHome;
        let parentFolders = this.getLocalParentFolders(type).map(folder => folder.parent);
        disoposables.add(this.configService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(key)) {
                parentFolders = this.getLocalParentFolders(type).map(folder => folder.parent);
                eventEmitter.fire();
            }
        }));
        disoposables.add(this.fileService.onDidFilesChange(e => {
            if (e.contains(userDataFolder)) {
                eventEmitter.fire();
                return;
            }
            if (parentFolders.some(folder => e.affects(folder))) {
                eventEmitter.fire();
                return;
            }
        }));
        disoposables.add(this.fileService.watch(userDataFolder));
        return { event: eventEmitter.event, dispose: () => disoposables.dispose() };
    }
    /**
     * Get all possible unambiguous prompt file source folders based on
     * the current workspace folder structure.
     *
     * This method is currently primarily used by the `> Create Prompt`
     * command that providers users with the list of destination folders
     * for a newly created prompt file. Because such a list cannot contain
     * paths that include `glob pattern` in them, we need to process config
     * values and try to create a list of clear and unambiguous locations.
     *
     * @returns List of possible unambiguous prompt file folders.
     */
    getConfigBasedSourceFolders(type) {
        const configuredLocations = PromptsConfig.promptSourceFolders(this.configService, type);
        const absoluteLocations = this.toAbsoluteLocations(configuredLocations);
        // locations in the settings can contain glob patterns so we need
        // to process them to get "clean" paths; the goal here is to have
        // a list of unambiguous folder paths where prompt files are stored
        const result = new ResourceSet();
        for (let absoluteLocation of absoluteLocations) {
            const baseName = basename(absoluteLocation);
            // if a path ends with a well-known "any file" pattern, remove
            // it so we can get the dirname path of that setting value
            const filePatterns = ['*.md', `*${getPromptFileExtension(type)}`];
            for (const filePattern of filePatterns) {
                if (baseName === filePattern) {
                    absoluteLocation = dirname(absoluteLocation);
                    continue;
                }
            }
            // likewise, if the pattern ends with single `*` (any file name)
            // remove it to get the dirname path of the setting value
            if (baseName === '*') {
                absoluteLocation = dirname(absoluteLocation);
            }
            // if after replacing the "file name" glob pattern, the path
            // still contains a glob pattern, then ignore the path
            if (isValidGlob(absoluteLocation.path) === true) {
                continue;
            }
            result.add(absoluteLocation);
        }
        return [...result];
    }
    /**
     * Finds all existent prompt files in the configured local source folders.
     *
     * @returns List of prompt files found in the local source folders.
     */
    async listFilesInLocal(type, token) {
        // find all prompt files in the provided locations, then match
        // the found file paths against (possible) glob patterns
        const paths = new ResourceSet();
        for (const { parent, filePattern } of this.getLocalParentFolders(type)) {
            const files = (filePattern === undefined)
                ? await this.resolveFilesAtLocation(parent, token) // if the location does not contain a glob pattern, resolve the location directly
                : await this.searchFilesInLocation(parent, filePattern, token);
            for (const file of files) {
                if (getPromptFileType(file) === type) {
                    paths.add(file);
                }
            }
            if (token.isCancellationRequested) {
                return [];
            }
        }
        return [...paths];
    }
    getLocalParentFolders(type) {
        const configuredLocations = PromptsConfig.promptSourceFolders(this.configService, type);
        const absoluteLocations = this.toAbsoluteLocations(configuredLocations);
        return absoluteLocations.map(firstNonGlobParentAndPattern);
    }
    /**
     * Converts locations defined in `settings` to absolute filesystem path URIs.
     * This conversion is needed because locations in settings can be relative,
     * hence we need to resolve them based on the current workspace folders.
     */
    toAbsoluteLocations(configuredLocations) {
        const result = new ResourceSet();
        const { folders } = this.workspaceService.getWorkspace();
        for (const configuredLocation of configuredLocations) {
            if (isAbsolute(configuredLocation)) {
                const remoteAuthority = this.environmentService.remoteAuthority;
                if (remoteAuthority) {
                    // if the location is absolute and we are in a remote environment,
                    // we need to convert it to a file URI with the remote authority
                    result.add(URI.from({ scheme: Schemas.vscodeRemote, authority: remoteAuthority, path: configuredLocation }));
                }
                else {
                    result.add(URI.file(configuredLocation));
                }
            }
            else {
                for (const workspaceFolder of folders) {
                    const absolutePath = joinPath(workspaceFolder.uri, configuredLocation);
                    // a sanity check on the expected outcome of the `joinPath()` call
                    assert(isAbsolute(absolutePath.path), `Provided location must be an absolute path, got '${absolutePath.path}'.`);
                    result.add(absolutePath);
                }
            }
        }
        return [...result];
    }
    /**
     * Uses the file service to resolve the provided location and return either the file at the location of files in the directory.
     */
    async resolveFilesAtLocation(location, token) {
        try {
            const info = await this.fileService.resolve(location);
            if (info.isFile) {
                return [info.resource];
            }
            else if (info.isDirectory && info.children) {
                const result = [];
                for (const child of info.children) {
                    if (child.isFile) {
                        result.push(child.resource);
                    }
                }
                return result;
            }
        }
        catch (error) {
        }
        return [];
    }
    /**
     * Uses the search service to find all files at the provided location
     */
    async searchFilesInLocation(folder, filePattern, token) {
        const disregardIgnoreFiles = this.configService.getValue('explorer.excludeGitIgnore');
        const workspaceRoot = this.workspaceService.getWorkspaceFolder(folder);
        const getExcludePattern = (folder) => getExcludes(this.configService.getValue({ resource: folder })) || {};
        const searchOptions = {
            folderQueries: [{ folder, disregardIgnoreFiles }],
            type: 1 /* QueryType.File */,
            shouldGlobMatchFilePattern: true,
            excludePattern: workspaceRoot ? getExcludePattern(workspaceRoot.uri) : undefined,
            sortByScore: true,
            filePattern
        };
        try {
            const searchResult = await this.searchService.fileSearch(searchOptions, token);
            if (token?.isCancellationRequested) {
                return [];
            }
            return searchResult.results.map(r => r.resource);
        }
        catch (e) {
            if (!isCancellationError(e)) {
                throw e;
            }
        }
        return [];
    }
};
PromptFilesLocator = __decorate([
    __param(0, IFileService),
    __param(1, IConfigurationService),
    __param(2, IWorkspaceContextService),
    __param(3, IWorkbenchEnvironmentService),
    __param(4, ISearchService),
    __param(5, IUserDataProfileService)
], PromptFilesLocator);
export { PromptFilesLocator };
/**
 * Checks if the provided `pattern` could be a valid glob pattern.
 */
export function isValidGlob(pattern) {
    let squareBrackets = false;
    let squareBracketsCount = 0;
    let curlyBrackets = false;
    let curlyBracketsCount = 0;
    let previousCharacter;
    for (const char of pattern) {
        // skip all escaped characters
        if (previousCharacter === '\\') {
            previousCharacter = char;
            continue;
        }
        if (char === '*') {
            return true;
        }
        if (char === '?') {
            return true;
        }
        if (char === '[') {
            squareBrackets = true;
            squareBracketsCount++;
            previousCharacter = char;
            continue;
        }
        if (char === ']') {
            squareBrackets = true;
            squareBracketsCount--;
            previousCharacter = char;
            continue;
        }
        if (char === '{') {
            curlyBrackets = true;
            curlyBracketsCount++;
            continue;
        }
        if (char === '}') {
            curlyBrackets = true;
            curlyBracketsCount--;
            previousCharacter = char;
            continue;
        }
        previousCharacter = char;
    }
    // if square brackets exist and are in pairs, this is a `valid glob`
    if (squareBrackets && (squareBracketsCount === 0)) {
        return true;
    }
    // if curly brackets exist and are in pairs, this is a `valid glob`
    if (curlyBrackets && (curlyBracketsCount === 0)) {
        return true;
    }
    return false;
}
/**
 * Finds the first parent of the provided location that does not contain a `glob pattern`.
 *
 * Asumes that the location that is provided has a valid path (is abstract)
 *
 * ## Examples
 *
 * ```typescript
 * assert.strictDeepEqual(
 *     firstNonGlobParentAndPattern(URI.file('/home/user/{folder1,folder2}/file.md')).path,
 *     { parent: URI.file('/home/user'), filePattern: '{folder1,folder2}/file.md' },
 *     'Must find correct non-glob parent dirname.',
 * );
 * ```
 */
function firstNonGlobParentAndPattern(location) {
    const segments = location.path.split('/');
    let i = 0;
    while (i < segments.length && isValidGlob(segments[i]) === false) {
        i++;
    }
    if (i === segments.length) {
        // the path does not contain a glob pattern, so we can
        // just find all prompt files in the provided location
        return { parent: location };
    }
    const parent = location.with({ path: segments.slice(0, i).join('/') });
    if (i === segments.length - 1 && segments[i] === '*' || segments[i] === ``) {
        return { parent };
    }
    // the path contains a glob pattern, so we search in last folder that does not contain a glob pattern
    return {
        parent,
        filePattern: segments.slice(i).join('/')
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZXNMb2NhdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvdXRpbHMvcHJvbXB0RmlsZXNMb2NhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDaEYsT0FBTyxFQUFFLCtCQUErQixFQUFFLGFBQWEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3JGLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTdGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ2hILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsV0FBVyxFQUFvQyxjQUFjLEVBQWEsTUFBTSxpREFBaUQsQ0FBQztBQUUzSSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUU5RSxP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