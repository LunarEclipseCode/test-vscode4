/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isWindows } from '../../../../../base/common/platform.js';
import { count } from '../../../../../base/common/strings.js';
import { SimpleCompletionModel } from '../../../../services/suggest/browser/simpleCompletionModel.js';
import { TerminalCompletionItemKind } from './terminalCompletionItem.js';
export class TerminalCompletionModel extends SimpleCompletionModel {
    constructor(items, lineContext) {
        super(items, lineContext, compareCompletionsFn);
    }
}
const compareCompletionsFn = (leadingLineContent, a, b) => {
    // Boost always on top inline completions
    if (a.completion.kind === TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop && a.completion.kind !== b.completion.kind) {
        return -1;
    }
    if (b.completion.kind === TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop && a.completion.kind !== b.completion.kind) {
        return 1;
    }
    // Boost LSP provider completions
    const lspProviderId = 'python';
    const aIsLsp = a.completion.provider.includes(lspProviderId);
    const bIsLsp = b.completion.provider.includes(lspProviderId);
    if (aIsLsp && !bIsLsp) {
        return -1;
    }
    if (bIsLsp && !aIsLsp) {
        return 1;
    }
    // Sort by the score
    let score = b.score[0] - a.score[0];
    if (score !== 0) {
        return score;
    }
    // Boost inline completions
    if (a.completion.kind === TerminalCompletionItemKind.InlineSuggestion && a.completion.kind !== b.completion.kind) {
        return -1;
    }
    if (b.completion.kind === TerminalCompletionItemKind.InlineSuggestion && a.completion.kind !== b.completion.kind) {
        return 1;
    }
    // Sort by underscore penalty (eg. `__init__/` should be penalized)
    if (a.underscorePenalty !== b.underscorePenalty) {
        return a.underscorePenalty - b.underscorePenalty;
    }
    // Sort files of the same name by extension
    const isArg = leadingLineContent.includes(' ');
    if (!isArg && a.completion.kind === TerminalCompletionItemKind.File && b.completion.kind === TerminalCompletionItemKind.File) {
        // If the file name excluding the extension is different, just do a regular sort
        if (a.labelLowExcludeFileExt !== b.labelLowExcludeFileExt) {
            return a.labelLowExcludeFileExt.localeCompare(b.labelLowExcludeFileExt, undefined, { ignorePunctuation: true });
        }
        // Then by label length ascending (excluding file extension if it's a file)
        score = a.labelLowExcludeFileExt.length - b.labelLowExcludeFileExt.length;
        if (score !== 0) {
            return score;
        }
        // If they're files at the start of the command line, boost extensions depending on the operating system
        score = fileExtScore(b.fileExtLow) - fileExtScore(a.fileExtLow);
        if (score !== 0) {
            return score;
        }
        // Then by file extension length ascending
        score = a.fileExtLow.length - b.fileExtLow.length;
        if (score !== 0) {
            return score;
        }
    }
    // Boost main and master branches for git commands
    // HACK: Currently this just matches leading line content, it should eventually check the
    //       completion type is a branch
    if (a.completion.kind === TerminalCompletionItemKind.Argument && b.completion.kind === TerminalCompletionItemKind.Argument && /^\s*git\b/.test(leadingLineContent)) {
        const aLabel = typeof a.completion.label === 'string' ? a.completion.label : a.completion.label.label;
        const bLabel = typeof b.completion.label === 'string' ? b.completion.label : b.completion.label.label;
        const aIsMainOrMaster = aLabel === 'main' || aLabel === 'master';
        const bIsMainOrMaster = bLabel === 'main' || bLabel === 'master';
        if (aIsMainOrMaster && !bIsMainOrMaster) {
            return -1;
        }
        if (bIsMainOrMaster && !aIsMainOrMaster) {
            return 1;
        }
    }
    // Sort by more detailed completions
    if (a.completion.kind === TerminalCompletionItemKind.Method && b.completion.kind === TerminalCompletionItemKind.Method) {
        if (typeof a.completion.label !== 'string' && a.completion.label.description && typeof b.completion.label !== 'string' && b.completion.label.description) {
            score = 0;
        }
        else if (typeof a.completion.label !== 'string' && a.completion.label.description) {
            score = -2;
        }
        else if (typeof b.completion.label !== 'string' && b.completion.label.description) {
            score = 2;
        }
        score += (b.completion.detail ? 1 : 0) + (b.completion.documentation ? 2 : 0) - (a.completion.detail ? 1 : 0) - (a.completion.documentation ? 2 : 0);
        if (score !== 0) {
            return score;
        }
    }
    // Sort by folder depth (eg. `vscode/` should come before `vscode-.../`)
    if (a.completion.kind === TerminalCompletionItemKind.Folder && b.completion.kind === TerminalCompletionItemKind.Folder) {
        if (a.labelLowNormalizedPath && b.labelLowNormalizedPath) {
            // Directories
            // Count depth of path (number of / or \ occurrences)
            score = count(a.labelLowNormalizedPath, '/') - count(b.labelLowNormalizedPath, '/');
            if (score !== 0) {
                return score;
            }
            // Ensure shorter prefixes appear first
            if (b.labelLowNormalizedPath.startsWith(a.labelLowNormalizedPath)) {
                return -1; // `a` is a prefix of `b`, so `a` should come first
            }
            if (a.labelLowNormalizedPath.startsWith(b.labelLowNormalizedPath)) {
                return 1; // `b` is a prefix of `a`, so `b` should come first
            }
        }
    }
    if (a.completion.kind !== b.completion.kind) {
        // Sort by kind
        if ((a.completion.kind === TerminalCompletionItemKind.Method || a.completion.kind === TerminalCompletionItemKind.Alias) && (b.completion.kind !== TerminalCompletionItemKind.Method && b.completion.kind !== TerminalCompletionItemKind.Alias)) {
            return -1; // Methods and aliases should come first
        }
        if ((b.completion.kind === TerminalCompletionItemKind.Method || b.completion.kind === TerminalCompletionItemKind.Alias) && (a.completion.kind !== TerminalCompletionItemKind.Method && a.completion.kind !== TerminalCompletionItemKind.Alias)) {
            return 1; // Methods and aliases should come first
        }
        if ((a.completion.kind === TerminalCompletionItemKind.File || a.completion.kind === TerminalCompletionItemKind.Folder) && (b.completion.kind !== TerminalCompletionItemKind.File && b.completion.kind !== TerminalCompletionItemKind.Folder)) {
            return 1; // Resources should come last
        }
        if ((b.completion.kind === TerminalCompletionItemKind.File || b.completion.kind === TerminalCompletionItemKind.Folder) && (a.completion.kind !== TerminalCompletionItemKind.File && a.completion.kind !== TerminalCompletionItemKind.Folder)) {
            return -1; // Resources should come last
        }
    }
    // Sort alphabetically, ignoring punctuation causes dot files to be mixed in rather than
    // all at the top
    return a.labelLow.localeCompare(b.labelLow, undefined, { ignorePunctuation: true });
};
// TODO: This should be based on the process OS, not the local OS
// File score boosts for specific file extensions on Windows. This only applies when the file is the
// _first_ part of the command line.
const fileExtScores = new Map(isWindows ? [
    // Windows - .ps1 > .exe > .bat > .cmd. This is the command precedence when running the files
    //           without an extension, tested manually in pwsh v7.4.4
    ['ps1', 0.09],
    ['exe', 0.08],
    ['bat', 0.07],
    ['cmd', 0.07],
    ['msi', 0.06],
    ['com', 0.06],
    // Non-Windows
    ['sh', -0.05],
    ['bash', -0.05],
    ['zsh', -0.05],
    ['fish', -0.05],
    ['csh', -0.06], // C shell
    ['ksh', -0.06], // Korn shell
    // Scripting language files are excluded here as the standard behavior on Windows will just open
    // the file in a text editor, not run the file
] : [
    // Pwsh
    ['ps1', 0.05],
    // Windows
    ['bat', -0.05],
    ['cmd', -0.05],
    ['exe', -0.05],
    // Non-Windows
    ['sh', 0.05],
    ['bash', 0.05],
    ['zsh', 0.05],
    ['fish', 0.05],
    ['csh', 0.04], // C shell
    ['ksh', 0.04], // Korn shell
    // Scripting languages
    ['py', 0.05], // Python
    ['pl', 0.05], // Perl
]);
function fileExtScore(ext) {
    return fileExtScores.get(ext) || 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvdGVybWluYWxDb21wbGV0aW9uTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUscUJBQXFCLEVBQW9CLE1BQU0sK0RBQStELENBQUM7QUFDeEgsT0FBTyxFQUFFLDBCQUEwQixFQUErQixNQUFNLDZCQUE2QixDQUFDO0FBRXRHLE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxxQkFBNkM7SUFDekYsWUFDQyxLQUErQixFQUMvQixXQUF3QjtRQUV4QixLQUFLLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQ2pELENBQUM7Q0FDRDtBQUVELE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxrQkFBMEIsRUFBRSxDQUF5QixFQUFFLENBQXlCLEVBQUUsRUFBRTtJQUNqSCx5Q0FBeUM7SUFDekMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSywwQkFBMEIsQ0FBQywyQkFBMkIsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzdILE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBQ0QsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSywwQkFBMEIsQ0FBQywyQkFBMkIsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLElB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