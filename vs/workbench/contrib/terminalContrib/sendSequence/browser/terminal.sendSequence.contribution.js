/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../../base/common/network.js';
import { isIOS, isWindows } from '../../../../../base/common/platform.js';
import { isObject, isString } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../../platform/accessibility/common/accessibility.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { registerTerminalAction } from '../../../terminal/browser/terminalActions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
export var TerminalSendSequenceCommandId;
(function (TerminalSendSequenceCommandId) {
    TerminalSendSequenceCommandId["SendSequence"] = "workbench.action.terminal.sendSequence";
})(TerminalSendSequenceCommandId || (TerminalSendSequenceCommandId = {}));
function toOptionalString(obj) {
    return isString(obj) ? obj : undefined;
}
export const terminalSendSequenceCommand = async (accessor, args) => {
    const quickInputService = accessor.get(IQuickInputService);
    const configurationResolverService = accessor.get(IConfigurationResolverService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const historyService = accessor.get(IHistoryService);
    const terminalService = accessor.get(ITerminalService);
    const instance = terminalService.activeInstance;
    if (instance) {
        let text = isObject(args) && 'text' in args ? toOptionalString(args.text) : undefined;
        // If no text provided, prompt user for input and process special characters
        if (!text) {
            text = await quickInputService.input({
                value: '',
                placeHolder: 'Enter sequence to send (supports \\n, \\r, \\xAB)',
                prompt: localize('workbench.action.terminal.sendSequence.prompt', "Enter sequence to send to the terminal"),
            });
            if (!text) {
                return;
            }
            // Process escape sequences
            let processedText = text
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r');
            // Process hex escape sequences (\xNN)
            while (true) {
                const match = processedText.match(/\\x([0-9a-fA-F]{2})/);
                if (match === null || match.index === undefined || match.length < 2) {
                    break;
                }
                processedText = processedText.slice(0, match.index) + String.fromCharCode(parseInt(match[1], 16)) + processedText.slice(match.index + 4);
            }
            text = processedText;
        }
        const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot(instance.isRemote ? Schemas.vscodeRemote : Schemas.file);
        const lastActiveWorkspaceRoot = activeWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? undefined : undefined;
        const resolvedText = await configurationResolverService.resolveAsync(lastActiveWorkspaceRoot, text);
        instance.sendText(resolvedText, false);
    }
};
const sendSequenceString = localize2('sendSequence', "Send Sequence");
registerTerminalAction({
    id: "workbench.action.terminal.sendSequence" /* TerminalSendSequenceCommandId.SendSequence */,
    title: sendSequenceString,
    f1: true,
    metadata: {
        description: sendSequenceString.value,
        args: [{
                name: 'args',
                schema: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        text: {
                            description: localize('sendSequence.text.desc', "The sequence of text to send to the terminal"),
                            type: 'string'
                        }
                    },
                }
            }]
    },
    run: (c, accessor, args) => terminalSendSequenceCommand(accessor, args)
});
export function registerSendSequenceKeybinding(text, rule) {
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: "workbench.action.terminal.sendSequence" /* TerminalSendSequenceCommandId.SendSequence */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: rule.when || TerminalContextKeys.focus,
        primary: rule.primary,
        mac: rule.mac,
        linux: rule.linux,
        win: rule.win,
        handler: terminalSendSequenceCommand,
        args: { text }
    });
}
var Constants;
(function (Constants) {
    /** The text representation of `^<letter>` is `'A'.charCodeAt(0) + 1`. */
    Constants[Constants["CtrlLetterOffset"] = 64] = "CtrlLetterOffset";
})(Constants || (Constants = {}));
// An extra Windows-only ctrl+v keybinding is used for pwsh that sends ctrl+v directly to the
// shell, this gets handled by PSReadLine which properly handles multi-line pastes. This is
// disabled in accessibility mode as PowerShell does not run PSReadLine when it detects a screen
// reader. This works even when clipboard.readText is not supported.
if (isWindows) {
    registerSendSequenceKeybinding(String.fromCharCode('V'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
        when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
        primary: 2048 /* KeyMod.CtrlCmd */ | 52 /* KeyCode.KeyV */
    });
}
// Map certain keybindings in pwsh to unused keys which get handled by PSReadLine handlers in the
// shell integration script. This allows keystrokes that cannot be sent via VT sequences to work.
// See https://github.com/microsoft/terminal/issues/879#issuecomment-497775007
registerSendSequenceKeybinding('\x1b[24~a', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */ }
});
registerSendSequenceKeybinding('\x1b[24~b', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    primary: 512 /* KeyMod.Alt */ | 10 /* KeyCode.Space */
});
registerSendSequenceKeybinding('\x1b[24~c', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    primary: 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */
});
registerSendSequenceKeybinding('\x1b[24~d', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    mac: { primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */ }
});
// Always on pwsh keybindings
registerSendSequenceKeybinding('\x1b[1;2H', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */)),
    mac: { primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */ }
});
// Map ctrl+alt+r -> ctrl+r when in accessibility mode due to default run recent command keybinding
registerSendSequenceKeybinding('\x12', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED),
    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 48 /* KeyCode.KeyR */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 48 /* KeyCode.KeyR */ }
});
// Map ctrl+alt+g -> ctrl+g due to default go to recent directory keybinding
registerSendSequenceKeybinding('\x07', {
    when: TerminalContextKeys.focus,
    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 37 /* KeyCode.KeyG */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 37 /* KeyCode.KeyG */ }
});
// send ctrl+c to the iPad when the terminal is focused and ctrl+c is pressed to kill the process (work around for #114009)
if (isIOS) {
    registerSendSequenceKeybinding(String.fromCharCode('C'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
        when: ContextKeyExpr.and(TerminalContextKeys.focus),
        primary: 256 /* KeyMod.WinCtrl */ | 33 /* KeyCode.KeyC */
    });
}
// Delete word left: ctrl+w
registerSendSequenceKeybinding(String.fromCharCode('W'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
    primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
    mac: { primary: 512 /* KeyMod.Alt */ | 1 /* KeyCode.Backspace */ }
});
if (isWindows) {
    // Delete word left: ctrl+h
    // Windows cmd.exe requires ^H to delete full word left
    registerSendSequenceKeybinding(String.fromCharCode('H'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
        when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "cmd" /* WindowsShellType.CommandPrompt */)),
        primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
    });
}
// Delete word right: alt+d [27, 100]
registerSendSequenceKeybinding('\u001bd', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 20 /* KeyCode.Delete */,
    mac: { primary: 512 /* KeyMod.Alt */ | 20 /* KeyCode.Delete */ }
});
// Delete to line start: ctrl+u
registerSendSequenceKeybinding('\u0015', {
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */ }
});
// Move to line start: ctrl+A
registerSendSequenceKeybinding(String.fromCharCode('A'.charCodeAt(0) - 64), {
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */ }
});
// Move to line end: ctrl+E
registerSendSequenceKeybinding(String.fromCharCode('E'.charCodeAt(0) - 64), {
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */ }
});
// NUL: ctrl+shift+2
registerSendSequenceKeybinding('\u0000', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 23 /* KeyCode.Digit2 */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 23 /* KeyCode.Digit2 */ }
});
// RS: ctrl+shift+6
registerSendSequenceKeybinding('\u001e', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 27 /* KeyCode.Digit6 */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 27 /* KeyCode.Digit6 */ }
});
// US (Undo): ctrl+/
registerSendSequenceKeybinding('\u001f', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 90 /* KeyCode.Slash */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 90 /* KeyCode.Slash */ }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuc2VuZFNlcXVlbmNlLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3NlbmRTZXF1ZW5jZS9icm93c2VyL3Rlcm1pbmFsLnNlbmRTZXF1ZW5jZS5jb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxjQUFjLEVBQTZCLE1BQU0seURBQXlELENBQUM7QUFFcEgsT0FBTyxFQUFFLG1CQUFtQixFQUF1QyxNQUFNLGtFQUFrRSxDQUFDO0FBQzVJLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRTdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBQzNILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUUsbUJBQW1CLEVBQTZCLE1BQU0sZ0RBQWdE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