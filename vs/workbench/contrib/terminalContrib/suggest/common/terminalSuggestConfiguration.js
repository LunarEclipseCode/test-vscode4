/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
export var TerminalSuggestSettingId;
(function (TerminalSuggestSettingId) {
    TerminalSuggestSettingId["Enabled"] = "terminal.integrated.suggest.enabled";
    TerminalSuggestSettingId["QuickSuggestions"] = "terminal.integrated.suggest.quickSuggestions";
    TerminalSuggestSettingId["SuggestOnTriggerCharacters"] = "terminal.integrated.suggest.suggestOnTriggerCharacters";
    TerminalSuggestSettingId["RunOnEnter"] = "terminal.integrated.suggest.runOnEnter";
    TerminalSuggestSettingId["WindowsExecutableExtensions"] = "terminal.integrated.suggest.windowsExecutableExtensions";
    TerminalSuggestSettingId["Providers"] = "terminal.integrated.suggest.providers";
    TerminalSuggestSettingId["ShowStatusBar"] = "terminal.integrated.suggest.showStatusBar";
    TerminalSuggestSettingId["CdPath"] = "terminal.integrated.suggest.cdPath";
    TerminalSuggestSettingId["InlineSuggestion"] = "terminal.integrated.suggest.inlineSuggestion";
    TerminalSuggestSettingId["UpArrowNavigatesHistory"] = "terminal.integrated.suggest.upArrowNavigatesHistory";
})(TerminalSuggestSettingId || (TerminalSuggestSettingId = {}));
export const windowsDefaultExecutableExtensions = [
    'exe', // Executable file
    'bat', // Batch file
    'cmd', // Command script
    'com', // Command file
    'msi', // Windows Installer package
    'ps1', // PowerShell script
    'vbs', // VBScript file
    'js', // JScript file
    'jar', // Java Archive (requires Java runtime)
    'py', // Python script (requires Python interpreter)
    'rb', // Ruby script (requires Ruby interpreter)
    'pl', // Perl script (requires Perl interpreter)
    'sh', // Shell script (via WSL or third-party tools)
];
export const terminalSuggestConfigSection = 'terminal.integrated.suggest';
export const terminalSuggestConfiguration = {
    ["terminal.integrated.suggest.enabled" /* TerminalSuggestSettingId.Enabled */]: {
        restricted: true,
        markdownDescription: localize('suggest.enabled', "Enables terminal intellisense suggestions (preview) for supported shells ({0}) when {1} is set to {2}.\n\nIf shell integration is installed manually, {3} needs to be set to {4} before calling the shell integration script.", 'PowerShell v7+, zsh, bash, fish', `\`#${"terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */}#\``, '`true`', '`VSCODE_SUGGEST`', '`1`'),
        type: 'boolean',
        default: false,
        tags: ['preview'],
    },
    ["terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */]: {
        restricted: true,
        markdownDescription: localize('suggest.providers', "Providers are enabled by default. Omit them by setting the id of the provider to `false`."),
        type: 'object',
        properties: {},
        default: {
            'terminal-suggest': true,
            'pwsh-shell-integration': true,
            'lsp': true,
        },
        tags: ['preview'],
    },
    ["terminal.integrated.suggest.quickSuggestions" /* TerminalSuggestSettingId.QuickSuggestions */]: {
        restricted: true,
        markdownDescription: localize('suggest.quickSuggestions', "Controls whether suggestions should automatically show up while typing. Also be aware of the {0}-setting which controls if suggestions are triggered by special characters.", `\`#${"terminal.integrated.suggest.suggestOnTriggerCharacters" /* TerminalSuggestSettingId.SuggestOnTriggerCharacters */}#\``),
        type: 'object',
        properties: {
            commands: {
                description: localize('suggest.quickSuggestions.commands', 'Enable quick suggestions for commands, the first word in a command line input.'),
                type: 'string',
                enum: ['off', 'on'],
            },
            arguments: {
                description: localize('suggest.quickSuggestions.arguments', 'Enable quick suggestions for arguments, anything after the first word in a command line input.'),
                type: 'string',
                enum: ['off', 'on'],
            },
            unknown: {
                description: localize('suggest.quickSuggestions.unknown', 'Enable quick suggestions when it\'s unclear what the best suggestion is, if this is on files and folders will be suggested as a fallback.'),
                type: 'string',
                enum: ['off', 'on'],
            },
        },
        default: {
            commands: 'on',
            arguments: 'on',
            unknown: 'off',
        },
        tags: ['preview']
    },
    ["terminal.integrated.suggest.suggestOnTriggerCharacters" /* TerminalSuggestSettingId.SuggestOnTriggerCharacters */]: {
        restricted: true,
        markdownDescription: localize('suggest.suggestOnTriggerCharacters', "Controls whether suggestions should automatically show up when typing trigger characters."),
        type: 'boolean',
        default: true,
        tags: ['preview']
    },
    ["terminal.integrated.suggest.runOnEnter" /* TerminalSuggestSettingId.RunOnEnter */]: {
        restricted: true,
        markdownDescription: localize('suggest.runOnEnter', "Controls whether suggestions should run immediately when `Enter` (not `Tab`) is used to accept the result."),
        enum: ['ignore', 'never', 'exactMatch', 'exactMatchIgnoreExtension', 'always'],
        markdownEnumDescriptions: [
            localize('runOnEnter.ignore', "Ignore suggestions and send the enter directly to the shell without completing. This is used as the default value so the suggest widget is as unobtrusive as possible."),
            localize('runOnEnter.never', "Never run on `Enter`."),
            localize('runOnEnter.exactMatch', "Run on `Enter` when the suggestion is typed in its entirety."),
            localize('runOnEnter.exactMatchIgnoreExtension', "Run on `Enter` when the suggestion is typed in its entirety or when a file is typed without its extension included."),
            localize('runOnEnter.always', "Always run on `Enter`.")
        ],
        default: 'ignore',
        tags: ['preview']
    },
    ["terminal.integrated.suggest.windowsExecutableExtensions" /* TerminalSuggestSettingId.WindowsExecutableExtensions */]: {
        restricted: true,
        markdownDescription: localize("terminalWindowsExecutableSuggestionSetting", "A set of windows command executable extensions that will be included as suggestions in the terminal.\n\nMany executables are included by default, listed below:\n\n{0}.\n\nTo exclude an extension, set it to `false`\n\n. To include one not in the list, add it and set it to `true`.", windowsDefaultExecutableExtensions.sort().map(extension => `- ${extension}`).join('\n')),
        type: 'object',
        default: {},
        tags: ['preview']
    },
    ["terminal.integrated.suggest.showStatusBar" /* TerminalSuggestSettingId.ShowStatusBar */]: {
        restricted: true,
        markdownDescription: localize('suggest.showStatusBar', "Controls whether the terminal suggestions status bar should be shown."),
        type: 'boolean',
        default: true,
        tags: ['preview']
    },
    ["terminal.integrated.suggest.cdPath" /* TerminalSuggestSettingId.CdPath */]: {
        restricted: true,
        markdownDescription: localize('suggest.cdPath', "Controls whether to enable $CDPATH support which exposes children of the folders in the $CDPATH variable regardless of the current working directory. $CDPATH is expected to be semi colon-separated on Windows and colon-separated on other platforms."),
        type: 'string',
        enum: ['off', 'relative', 'absolute'],
        markdownEnumDescriptions: [
            localize('suggest.cdPath.off', "Disable the feature."),
            localize('suggest.cdPath.relative', "Enable the feature and use relative paths."),
            localize('suggest.cdPath.absolute', "Enable the feature and use absolute paths. This is useful when the shell doesn't natively support `$CDPATH`."),
        ],
        default: 'absolute',
        tags: ['preview']
    },
    ["terminal.integrated.suggest.inlineSuggestion" /* TerminalSuggestSettingId.InlineSuggestion */]: {
        restricted: true,
        markdownDescription: localize('suggest.inlineSuggestion', "Controls whether the shell's inline suggestion should be detected and how it is scored."),
        type: 'string',
        enum: ['off', 'alwaysOnTopExceptExactMatch', 'alwaysOnTop'],
        markdownEnumDescriptions: [
            localize('suggest.inlineSuggestion.off', "Disable the feature."),
            localize('suggest.inlineSuggestion.alwaysOnTopExceptExactMatch', "Enable the feature and sort the inline suggestion without forcing it to be on top. This means that exact matches will be will be above the inline suggestion."),
            localize('suggest.inlineSuggestion.alwaysOnTop', "Enable the feature and always put the inline suggestion on top."),
        ],
        default: 'alwaysOnTop',
        tags: ['preview']
    },
    ["terminal.integrated.suggest.upArrowNavigatesHistory" /* TerminalSuggestSettingId.UpArrowNavigatesHistory */]: {
        restricted: true,
        markdownDescription: localize('suggest.upArrowNavigatesHistory', "Determines whether the up arrow key navigates the command history when focus is on the first suggestion and navigation has not yet occurred. When set to false, the up arrow will move focus to the last suggestion instead."),
        type: 'boolean',
        default: true,
        tags: ['preview']
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0Q29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvY29tbW9uL3Rlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBSWpELE1BQU0sQ0FBTixJQUFrQix3QkFXakI7QUFYRCxXQUFrQix3QkFBd0I7SUFDekMsMkVBQStDLENBQUE7SUFDL0MsNkZBQWlFLENBQUE7SUFDakUsaUhBQXFGLENBQUE7SUFDckYsaUZBQXFELENBQUE7SUFDckQsbUhBQXVGLENBQUE7SUFDdkYsK0VBQW1ELENBQUE7SUFDbkQsdUZBQTJELENBQUE7SUFDM0QseUVBQTZDLENBQUE7SUFDN0MsNkZBQWlFLENBQUE7SUFDakUsMkdBQStFLENBQUE7QUFDaEYsQ0FBQyxFQVhpQix3QkFBd0IsS0FBeEIsd0JBQXdCLFFBV3pDO0FBRUQsTUFBTSxDQUFDLE1BQU0sa0NBQWtDLEdBQWE7SUFDM0QsS0FBSyxFQUFJLGtCQUFrQjtJQUMzQixLQUFLLEVBQUksYUFBYTtJQUN0QixLQUFLLEVBQUksaUJBQWlCO0lBQzFCLEtBQUssRUFBSSxlQUFlO0lBRXhCLEtBQUssRUFBSSw0QkFBNEI7SUFFckMsS0FBSyxFQUFJLG9CQUFvQjtJQUU3QixLQUFLLEVBQUksZ0JBQWdCO0lBQ3pCLElBQUksRUFBSyxlQUFlO0lBQ3hCLEtBQUssRUFBSSx1Q0FBdUM7SUFDaEQsSUFBSSxFQUFLLDhDQUE4QztJQUN2RCxJQUFJLEVBQUssMENBQTBDO0lBQ25ELElBQUksRUFBSywwQ0FBMEM7SUFDbkQsSUFBSSxFQUFLLDhDQUE4QztDQUN2RCxDQUFDO0FBRUYsTUFBTSxDQUFD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