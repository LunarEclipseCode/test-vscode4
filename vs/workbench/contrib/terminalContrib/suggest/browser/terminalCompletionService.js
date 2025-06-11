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
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { basename } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { TerminalCompletionItemKind } from './terminalCompletionItem.js';
import { env as processEnv } from '../../../../../base/common/process.js';
import { timeout } from '../../../../../base/common/async.js';
import { gitBashToWindowsPath } from './terminalGitBashHelpers.js';
export const ITerminalCompletionService = createDecorator('terminalCompletionService');
/**
 * Represents a collection of {@link CompletionItem completion items} to be presented
 * in the terminal.
 */
export class TerminalCompletionList {
    /**
     * Creates a new completion list.
     *
     * @param items The completion items.
     * @param isIncomplete The list is not complete.
     */
    constructor(items, resourceRequestConfig) {
        this.items = items;
        this.resourceRequestConfig = resourceRequestConfig;
    }
}
let TerminalCompletionService = class TerminalCompletionService extends Disposable {
    get providers() {
        return this._providersGenerator();
    }
    *_providersGenerator() {
        for (const providerMap of this._providers.values()) {
            for (const provider of providerMap.values()) {
                yield provider;
            }
        }
    }
    /** Overrides the environment for testing purposes. */
    set processEnv(env) { this._processEnv = env; }
    constructor(_configurationService, _fileService) {
        super();
        this._configurationService = _configurationService;
        this._fileService = _fileService;
        this._providers = new Map();
        this._processEnv = processEnv;
    }
    registerTerminalCompletionProvider(extensionIdentifier, id, provider, ...triggerCharacters) {
        let extMap = this._providers.get(extensionIdentifier);
        if (!extMap) {
            extMap = new Map();
            this._providers.set(extensionIdentifier, extMap);
        }
        provider.triggerCharacters = triggerCharacters;
        provider.id = id;
        extMap.set(id, provider);
        return toDisposable(() => {
            const extMap = this._providers.get(extensionIdentifier);
            if (extMap) {
                extMap.delete(id);
                if (extMap.size === 0) {
                    this._providers.delete(extensionIdentifier);
                }
            }
        });
    }
    async provideCompletions(promptValue, cursorPosition, allowFallbackCompletions, shellType, capabilities, token, triggerCharacter, skipExtensionCompletions) {
        if (!this._providers || !this._providers.values || cursorPosition < 0) {
            return undefined;
        }
        let providers;
        if (triggerCharacter) {
            const providersToRequest = [];
            for (const provider of this.providers) {
                if (!provider.triggerCharacters) {
                    continue;
                }
                for (const char of provider.triggerCharacters) {
                    if (promptValue.substring(0, cursorPosition)?.endsWith(char)) {
                        providersToRequest.push(provider);
                        break;
                    }
                }
            }
            providers = providersToRequest;
        }
        else {
            providers = [...this._providers.values()].flatMap(providerMap => [...providerMap.values()]);
        }
        if (skipExtensionCompletions) {
            providers = providers.filter(p => p.isBuiltin);
            return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token);
        }
        const providerConfig = this._configurationService.getValue("terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */);
        providers = providers.filter(p => {
            const providerId = p.id;
            return providerId && providerId in providerConfig && providerConfig[providerId] !== false;
        });
        if (!providers.length) {
            return;
        }
        return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token);
    }
    async _collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token) {
        const completionPromises = providers.map(async (provider) => {
            if (provider.shellTypes && !provider.shellTypes.includes(shellType)) {
                return undefined;
            }
            const completions = await Promise.race([
                provider.provideCompletions(promptValue, cursorPosition, allowFallbackCompletions, token),
                timeout(5000)
            ]);
            if (!completions) {
                return undefined;
            }
            const completionItems = Array.isArray(completions) ? completions : completions.items ?? [];
            if (shellType === "pwsh" /* GeneralShellType.PowerShell */) {
                for (const completion of completionItems) {
                    completion.isFileOverride ??= completion.kind === TerminalCompletionItemKind.Method && completion.replacementIndex === 0;
                }
            }
            if (provider.isBuiltin) {
                //TODO: why is this needed?
                for (const item of completionItems) {
                    item.provider ??= provider.id;
                }
            }
            if (Array.isArray(completions)) {
                return completionItems;
            }
            if (completions.resourceRequestConfig) {
                const resourceCompletions = await this.resolveResources(completions.resourceRequestConfig, promptValue, cursorPosition, provider.id, capabilities, shellType);
                if (resourceCompletions) {
                    completionItems.push(...resourceCompletions);
                }
            }
            return completionItems;
        });
        const results = await Promise.all(completionPromises);
        return results.filter(result => !!result).flat();
    }
    async resolveResources(resourceRequestConfig, promptValue, cursorPosition, provider, capabilities, shellType) {
        const useWindowsStylePath = resourceRequestConfig.pathSeparator === '\\';
        if (useWindowsStylePath) {
            // for tests, make sure the right path separator is used
            promptValue = promptValue.replaceAll(/[\\/]/g, resourceRequestConfig.pathSeparator);
        }
        // Files requested implies folders requested since the file could be in any folder. We could
        // provide diagnostics when a folder is provided where a file is expected.
        const foldersRequested = (resourceRequestConfig.foldersRequested || resourceRequestConfig.filesRequested) ?? false;
        const filesRequested = resourceRequestConfig.filesRequested ?? false;
        const fileExtensions = resourceRequestConfig.fileExtensions ?? undefined;
        const cwd = URI.revive(resourceRequestConfig.cwd);
        if (!cwd || (!foldersRequested && !filesRequested)) {
            return;
        }
        const resourceCompletions = [];
        const cursorPrefix = promptValue.substring(0, cursorPosition);
        // TODO: Leverage Fig's tokens array here?
        // The last word (or argument). When the cursor is following a space it will be the empty
        // string
        const lastWord = cursorPrefix.endsWith(' ') ? '' : cursorPrefix.split(/(?<!\\) /).at(-1) ?? '';
        // Get the nearest folder path from the prefix. This ignores everything after the `/` as
        // they are what triggers changes in the directory.
        let lastSlashIndex;
        if (useWindowsStylePath) {
            // TODO: Flesh out escaped path logic, it currently only partially works
            let lastBackslashIndex = -1;
            for (let i = lastWord.length - 1; i >= 0; i--) {
                if (lastWord[i] === '\\') {
                    if (i === lastWord.length - 1 || lastWord[i + 1] !== ' ') {
                        lastBackslashIndex = i;
                        break;
                    }
                }
            }
            lastSlashIndex = Math.max(lastBackslashIndex, lastWord.lastIndexOf('/'));
        }
        else {
            lastSlashIndex = lastWord.lastIndexOf(resourceRequestConfig.pathSeparator);
        }
        // The _complete_ folder of the last word. For example if the last word is `./src/file`,
        // this will be `./src/`. This also always ends in the path separator if it is not the empty
        // string and path separators are normalized on Windows.
        let lastWordFolder = lastSlashIndex === -1 ? '' : lastWord.slice(0, lastSlashIndex + 1);
        if (useWindowsStylePath) {
            lastWordFolder = lastWordFolder.replaceAll('/', '\\');
        }
        // Determine the current folder being shown
        let lastWordFolderResource;
        const lastWordFolderHasDotPrefix = !!lastWordFolder.match(/^\.\.?[\\\/]/);
        const lastWordFolderHasTildePrefix = !!lastWordFolder.match(/^~[\\\/]?/);
        const isAbsolutePath = useWindowsStylePath
            ? /^[a-zA-Z]:[\\\/]/.test(lastWord)
            : lastWord.startsWith(resourceRequestConfig.pathSeparator);
        const type = lastWordFolderHasTildePrefix ? 'tilde' : isAbsolutePath ? 'absolute' : 'relative';
        switch (type) {
            case 'tilde': {
                const home = this._getHomeDir(useWindowsStylePath, capabilities);
                if (home) {
                    lastWordFolderResource = URI.joinPath(URI.file(home), lastWordFolder.slice(1).replaceAll('\\ ', ' '));
                }
                if (!lastWordFolderResource) {
                    // Use less strong wording here as it's not as strong of a concept on Windows
                    // and could be misleading
                    if (lastWord.match(/^~[\\\/]$/)) {
                        lastWordFolderResource = useWindowsStylePath ? 'Home directory' : '$HOME';
                    }
                }
                break;
            }
            case 'absolute': {
                if (shellType === "gitbash" /* WindowsShellType.GitBash */) {
                    lastWordFolderResource = URI.file(gitBashToWindowsPath(lastWordFolder, this._processEnv.SystemDrive));
                }
                else {
                    lastWordFolderResource = URI.file(lastWordFolder.replaceAll('\\ ', ' '));
                }
                break;
            }
            case 'relative': {
                lastWordFolderResource = cwd;
                break;
            }
        }
        // Assemble completions based on the resource of lastWordFolder. Note that on Windows the
        // path seprators are normalized to `\`.
        if (!lastWordFolderResource) {
            return undefined;
        }
        // Early exit with basic completion if we don't know the resource
        if (typeof lastWordFolderResource === 'string') {
            resourceCompletions.push({
                label: lastWordFolder,
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: lastWordFolderResource,
                replacementIndex: cursorPosition - lastWord.length,
                replacementLength: lastWord.length
            });
            return resourceCompletions;
        }
        const stat = await this._fileService.resolve(lastWordFolderResource, { resolveSingleChildDescendants: true });
        if (!stat?.children) {
            return;
        }
        // Add current directory. This should be shown at the top because it will be an exact
        // match and therefore highlight the detail, plus it improves the experience when
        // runOnEnter is used.
        //
        // - (relative) `|`       -> `.`
        //   this does not have the trailing `/` intentionally as it's common to complete the
        //   current working directory and we do not want to complete `./` when `runOnEnter` is
        //   used.
        // - (relative) `./src/|` -> `./src/`
        // - (absolute) `/src/|`  -> `/src/`
        // - (tilde)    `~/|`     -> `~/`
        // - (tilde)    `~/src/|` -> `~/src/`
        if (foldersRequested) {
            let label;
            switch (type) {
                case 'tilde': {
                    label = lastWordFolder;
                    break;
                }
                case 'absolute': {
                    label = lastWordFolder;
                    break;
                }
                case 'relative': {
                    label = '.';
                    if (lastWordFolder.length > 0) {
                        label = addPathRelativePrefix(lastWordFolder, resourceRequestConfig, lastWordFolderHasDotPrefix);
                    }
                    break;
                }
            }
            resourceCompletions.push({
                label,
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: getFriendlyPath(lastWordFolderResource, resourceRequestConfig.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
                replacementIndex: cursorPosition - lastWord.length,
                replacementLength: lastWord.length
            });
        }
        // Add all direct children files or folders
        //
        // - (relative) `cd ./src/`  -> `cd ./src/folder1/`, ...
        // - (absolute) `cd c:/src/` -> `cd c:/src/folder1/`, ...
        // - (tilde)    `cd ~/src/`  -> `cd ~/src/folder1/`, ...
        for (const child of stat.children) {
            let kind;
            if (foldersRequested && child.isDirectory) {
                kind = TerminalCompletionItemKind.Folder;
            }
            else if (filesRequested && child.isFile) {
                kind = TerminalCompletionItemKind.File;
            }
            if (kind === undefined) {
                continue;
            }
            let label = lastWordFolder;
            if (label.length > 0 && !label.endsWith(resourceRequestConfig.pathSeparator)) {
                label += resourceRequestConfig.pathSeparator;
            }
            label += child.name;
            if (type === 'relative') {
                label = addPathRelativePrefix(label, resourceRequestConfig, lastWordFolderHasDotPrefix);
            }
            if (child.isDirectory && !label.endsWith(resourceRequestConfig.pathSeparator)) {
                label += resourceRequestConfig.pathSeparator;
            }
            if (child.isFile && fileExtensions) {
                const extension = child.name.split('.').length > 1 ? child.name.split('.').at(-1) : undefined;
                if (extension && !fileExtensions.includes(extension)) {
                    continue;
                }
            }
            resourceCompletions.push({
                label,
                provider,
                kind,
                detail: getFriendlyPath(child.resource, resourceRequestConfig.pathSeparator, kind, shellType),
                replacementIndex: cursorPosition - lastWord.length,
                replacementLength: lastWord.length
            });
        }
        // Support $CDPATH specially for the `cd` command only
        //
        // - (relative) `|` -> `/foo/vscode` (CDPATH has /foo which contains vscode folder)
        if (type === 'relative' && foldersRequested) {
            if (promptValue.startsWith('cd ')) {
                const config = this._configurationService.getValue("terminal.integrated.suggest.cdPath" /* TerminalSuggestSettingId.CdPath */);
                if (config === 'absolute' || config === 'relative') {
                    const cdPath = this._getEnvVar('CDPATH', capabilities);
                    if (cdPath) {
                        const cdPathEntries = cdPath.split(useWindowsStylePath ? ';' : ':');
                        for (const cdPathEntry of cdPathEntries) {
                            try {
                                const fileStat = await this._fileService.resolve(URI.file(cdPathEntry), { resolveSingleChildDescendants: true });
                                if (fileStat?.children) {
                                    for (const child of fileStat.children) {
                                        if (!child.isDirectory) {
                                            continue;
                                        }
                                        const useRelative = config === 'relative';
                                        const kind = TerminalCompletionItemKind.Folder;
                                        const label = useRelative ? basename(child.resource.fsPath) : getFriendlyPath(child.resource, resourceRequestConfig.pathSeparator, kind, shellType);
                                        const detail = useRelative ? `CDPATH ${getFriendlyPath(child.resource, resourceRequestConfig.pathSeparator, kind, shellType)}` : `CDPATH`;
                                        resourceCompletions.push({
                                            label,
                                            provider,
                                            kind,
                                            detail,
                                            replacementIndex: cursorPosition - lastWord.length,
                                            replacementLength: lastWord.length
                                        });
                                    }
                                }
                            }
                            catch { /* ignore */ }
                        }
                    }
                }
            }
        }
        // Add parent directory to the bottom of the list because it's not as useful as other suggestions
        //
        // - (relative) `|` -> `../`
        // - (relative) `./src/|` -> `./src/../`
        if (type === 'relative' && foldersRequested) {
            let label = `..${resourceRequestConfig.pathSeparator}`;
            if (lastWordFolder.length > 0) {
                label = addPathRelativePrefix(lastWordFolder + label, resourceRequestConfig, lastWordFolderHasDotPrefix);
            }
            const parentDir = URI.joinPath(cwd, '..' + resourceRequestConfig.pathSeparator);
            resourceCompletions.push({
                label,
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: getFriendlyPath(parentDir, resourceRequestConfig.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
                replacementIndex: cursorPosition - lastWord.length,
                replacementLength: lastWord.length
            });
        }
        // Add tilde for home directory for relative paths when there is no path separator in the
        // input.
        //
        // - (relative) `|` -> `~`
        if (type === 'relative' && !lastWordFolder.match(/[\\\/]/)) {
            let homeResource;
            const home = this._getHomeDir(useWindowsStylePath, capabilities);
            if (home) {
                homeResource = URI.joinPath(URI.file(home), lastWordFolder.slice(1).replaceAll('\\ ', ' '));
            }
            if (!homeResource) {
                // Use less strong wording here as it's not as strong of a concept on Windows
                // and could be misleading
                homeResource = useWindowsStylePath ? 'Home directory' : '$HOME';
            }
            resourceCompletions.push({
                label: '~',
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: typeof homeResource === 'string' ? homeResource : getFriendlyPath(homeResource, resourceRequestConfig.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
                replacementIndex: cursorPosition - lastWord.length,
                replacementLength: lastWord.length
            });
        }
        return resourceCompletions;
    }
    _getEnvVar(key, capabilities) {
        const env = capabilities.get(5 /* TerminalCapability.ShellEnvDetection */)?.env?.value;
        if (env) {
            return env[key];
        }
        return this._processEnv[key];
    }
    _getHomeDir(useWindowsStylePath, capabilities) {
        return useWindowsStylePath ? this._getEnvVar('USERPROFILE', capabilities) : this._getEnvVar('HOME', capabilities);
    }
};
TerminalCompletionService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IFileService)
], TerminalCompletionService);
export { TerminalCompletionService };
function getFriendlyPath(uri, pathSeparator, kind, shellType) {
    let path = uri.fsPath;
    const sep = shellType === "gitbash" /* WindowsShellType.GitBash */ ? '\\' : pathSeparator;
    // Ensure folders end with the path separator to differentiate presentation from files
    if (kind === TerminalCompletionItemKind.Folder && !path.endsWith(sep)) {
        path += sep;
    }
    // Ensure drive is capitalized on Windows
    if (sep === '\\' && path.match(/^[a-zA-Z]:\\/)) {
        path = `${path[0].toUpperCase()}:${path.slice(2)}`;
    }
    return path;
}
/**
 * Normalize suggestion to add a ./ prefix to the start of the path if there isn't one already. We
 * may want to change this behavior in the future to go with whatever format the user has.
 */
function addPathRelativePrefix(text, resourceRequestConfig, lastWordFolderHasDotPrefix) {
    if (!lastWordFolderHasDotPrefix) {
        return `.${resourceRequestConfig.pathSeparator}${text}`;
    }
    return text;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvYnJvd3Nlci90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxVQUFVLEVBQWUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUloRyxPQUFPLEVBQUUsMEJBQTBCLEVBQTRCLE1BQU0sNkJBQTZCLENBQUM7QUFDbkcsT0FBTyxFQUFFLEdBQUcsSUFBSSxVQUFVLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUUxRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFbkUsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsZUFBZSxDQUE2QiwyQkFBMkIsQ0FBQyxDQUFDO0FBRW5IOzs7R0FHRztBQUNILE1BQU0sT0FBTyxzQkFBc0I7SUFZbEM7Ozs7O09BS0c7SUFDSCxZQUFZLEtBQTZCLEVBQUUscUJBQXFEO1FBQy9GLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxxQkFBcUIsR0FB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