/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from 'child_process';
import { homedir } from 'os';
import { basename, dirname, extname, isAbsolute, join } from '../../../base/common/path.js';
import { localize } from '../../../nls.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { CancellationError, isCancellationError } from '../../../base/common/errors.js';
import { isMacintosh, isWindows, OS } from '../../../base/common/platform.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { getSystemShell } from '../../../base/node/shell.js';
import { isLaunchedFromCli } from '../../environment/node/argvHelper.js';
import { first, Promises } from '../../../base/common/async.js';
import { clamp } from '../../../base/common/numbers.js';
import { findExecutable, getWindowPathExtensions } from '../../../base/node/processes.js';
import { equalsIgnoreCase } from '../../../base/common/strings.js';
import { Promises as FSPromises } from '../../../base/node/pfs.js';
let shellEnvPromise = undefined;
/**
 * Resolves the shell environment by spawning a shell. This call will cache
 * the shell spawning so that subsequent invocations use that cached result.
 *
 * Will throw an error if:
 * - we hit a timeout of `MAX_SHELL_RESOLVE_TIME`
 * - any other error from spawning a shell to figure out the environment
 */
export async function getResolvedShellEnv(configurationService, logService, args, env) {
    // Skip if --force-disable-user-env
    if (args['force-disable-user-env']) {
        logService.trace('resolveShellEnv(): skipped (--force-disable-user-env)');
        return {};
    }
    // Skip if running from CLI already
    else if (isLaunchedFromCli(env) && !args['force-user-env']) {
        logService.trace('resolveShellEnv(): skipped (VSCODE_CLI is set)');
        return {};
    }
    // Otherwise resolve
    else {
        if (isLaunchedFromCli(env)) {
            logService.trace('resolveShellEnv(): running (--force-user-env)');
        }
        else {
            logService.trace('resolveShellEnv(): running');
        }
        // Call this only once and cache the promise for
        // subsequent calls since this operation can be
        // expensive (spawns a process).
        if (!shellEnvPromise) {
            shellEnvPromise = Promises.withAsyncBody(async (resolve, reject) => {
                const cts = new CancellationTokenSource();
                let timeoutValue = 10000; // default to 10 seconds
                const configuredTimeoutValue = configurationService.getValue('application.shellEnvironmentResolutionTimeout');
                if (typeof configuredTimeoutValue === 'number') {
                    timeoutValue = clamp(configuredTimeoutValue, 1, 120) * 1000 /* convert from seconds */;
                }
                // Give up resolving shell env after some time
                const timeout = setTimeout(() => {
                    cts.dispose(true);
                    reject(new Error(localize('resolveShellEnvTimeout', "Unable to resolve your shell environment in a reasonable time. Please review your shell configuration and restart.")));
                }, timeoutValue);
                // Resolve shell env and handle errors
                try {
                    resolve(await doResolveShellEnv(logService, cts.token));
                }
                catch (error) {
                    if (!isCancellationError(error) && !cts.token.isCancellationRequested) {
                        reject(new Error(localize('resolveShellEnvError', "Unable to resolve your shell environment: {0}", toErrorMessage(error))));
                    }
                    else {
                        resolve({});
                    }
                }
                finally {
                    clearTimeout(timeout);
                    cts.dispose();
                }
            });
        }
        return shellEnvPromise;
    }
}
async function doResolveShellEnv(logService, token) {
    const runAsNode = process.env['ELECTRON_RUN_AS_NODE'];
    logService.trace('doResolveShellEnv#runAsNode', runAsNode);
    const noAttach = process.env['ELECTRON_NO_ATTACH_CONSOLE'];
    logService.trace('doResolveShellEnv#noAttach', noAttach);
    const mark = generateUuid().replace(/-/g, '').substr(0, 12);
    const regex = new RegExp(mark + '([\\s\\S]*?)' + mark);
    const env = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_NO_ATTACH_CONSOLE: '1',
        VSCODE_RESOLVING_ENVIRONMENT: '1'
    };
    logService.trace('doResolveShellEnv#env', env);
    const systemShell = await getSystemShell(OS, env); // note: windows always resolves a powershell instance
    logService.trace('doResolveShellEnv#shell', systemShell);
    let name = basename(systemShell);
    if (isWindows) {
        const nameExt = extname(name);
        if (getWindowPathExtensions().some(e => equalsIgnoreCase(e, nameExt))) {
            name = name.substring(0, name.length - nameExt.length); // remove any .exe/.cmd/... from the name for matching logic on Windows
        }
    }
    let command, shellArgs;
    const extraArgs = '';
    if (/^(?:pwsh|powershell)(?:-preview)?$/.test(name)) {
        const profilePaths = await getPowershellProfilePaths(systemShell);
        const profilePathThatExists = await first(profilePaths.map(profilePath => async () => (await FSPromises.exists(profilePath)) ? profilePath : undefined));
        if (!profilePathThatExists) {
            logService.trace('doResolveShellEnv#noPowershellProfile after testing paths', profilePaths);
            return {};
        }
        logService.trace('doResolveShellEnv#powershellProfile found in', profilePathThatExists);
        // Older versions of PowerShell removes double quotes sometimes
        // so we use "double single quotes" which is how you escape single
        // quotes inside of a single quoted string.
        command = `Write-Output '${mark}'; [System.Environment]::GetEnvironmentVariables() | ConvertTo-Json -Compress; Write-Output '${mark}'`;
        // -Login is not a supported argument on PowerShell 5, which is a version of
        // powershell that is exclusive to Windows. Providing it would error. Also,
        // -Login is documented as a no-op on Windows on Powershell 7, so simply omit
        // it to avoid causing errors or requiring a version check.
        shellArgs = isWindows ? ['-Command'] : ['-Login', '-Command'];
    }
    else if (name === 'nu') { // nushell requires ^ before quoted path to treat it as a command
        command = `^'${process.execPath}' ${extraArgs} -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
        shellArgs = ['-i', '-l', '-c'];
    }
    else if (name === 'xonsh') { // #200374: native implementation is shorter
        command = `import os, json; print("${mark}", json.dumps(dict(os.environ)), "${mark}")`;
        shellArgs = ['-i', '-l', '-c'];
    }
    else {
        command = `'${process.execPath}' ${extraArgs} -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
        if (name === 'tcsh' || name === 'csh') {
            shellArgs = ['-ic'];
        }
        else {
            shellArgs = ['-i', '-l', '-c'];
        }
    }
    return new Promise((resolve, reject) => {
        if (token.isCancellationRequested) {
            return reject(new CancellationError());
        }
        logService.trace('doResolveShellEnv#spawn', JSON.stringify(shellArgs), command);
        const child = spawn(systemShell, [...shellArgs, command], {
            detached: !isWindows,
            stdio: ['ignore', 'pipe', 'pipe'],
            env
        });
        token.onCancellationRequested(() => {
            child.kill();
            return reject(new CancellationError());
        });
        child.on('error', err => {
            logService.error('doResolveShellEnv#errorChildProcess', toErrorMessage(err));
            reject(err);
        });
        const buffers = [];
        child.stdout.on('data', b => buffers.push(b));
        const stderr = [];
        child.stderr.on('data', b => stderr.push(b));
        child.on('close', (code, signal) => {
            const raw = Buffer.concat(buffers).toString('utf8');
            logService.trace('doResolveShellEnv#raw', raw);
            const stderrStr = Buffer.concat(stderr).toString('utf8');
            if (stderrStr.trim()) {
                logService.trace('doResolveShellEnv#stderr', stderrStr);
            }
            if (code || signal) {
                return reject(new Error(localize('resolveShellEnvExitError', "Unexpected exit code from spawned shell (code {0}, signal {1})", code, signal)));
            }
            const match = regex.exec(raw);
            const rawStripped = match ? match[1] : '{}';
            try {
                const env = JSON.parse(rawStripped);
                if (runAsNode) {
                    env['ELECTRON_RUN_AS_NODE'] = runAsNode;
                }
                else {
                    delete env['ELECTRON_RUN_AS_NODE'];
                }
                if (noAttach) {
                    env['ELECTRON_NO_ATTACH_CONSOLE'] = noAttach;
                }
                else {
                    delete env['ELECTRON_NO_ATTACH_CONSOLE'];
                }
                delete env['VSCODE_RESOLVING_ENVIRONMENT'];
                // https://github.com/microsoft/vscode/issues/22593#issuecomment-336050758
                delete env['XDG_RUNTIME_DIR'];
                logService.trace('doResolveShellEnv#result', env);
                resolve(env);
            }
            catch (err) {
                logService.error('doResolveShellEnv#errorCaught', toErrorMessage(err));
                reject(err);
            }
        });
    });
}
/**
 * Returns powershell profile paths that are used to source its environment.
 * This is used to determine whether we should resolve a powershell environment,
 * potentially saving us from spawning a powershell process.
 *
 * @see https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.5
 */
async function getPowershellProfilePaths(psExecutable) {
    const paths = [];
    const userHome = homedir();
    if (isWindows) {
        // "The $PSHOME variable stores the installation directory for PowerShell" --
        // but this is not set ambiently on the operating system.
        let pshome = process.env.PSHOME;
        if (!pshome) {
            if (!isAbsolute(psExecutable)) {
                const found = await findExecutable(psExecutable);
                if (!found) {
                    return [];
                }
                pshome = dirname(found);
            }
            else {
                pshome = dirname(psExecutable);
            }
        }
        paths.push(join(pshome, 'Profile.ps1'), // All Users, All Hosts
        join(pshome, 'Microsoft.PowerShell_profile.ps1'), // All Users, Current Host
        join(userHome, 'Documents', 'PowerShell', 'Profile.ps1'), // Current User, All Hosts
        join(userHome, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'), // Current User, Current Host
        join(userHome, 'Documents', 'WindowsPowerShell', 'Profile.ps1'), // (Powershell 5) Current User, All Hosts
        join(userHome, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'));
    }
    else if (isMacintosh) {
        // note: powershell 7 is the first (and yet only) powershell version on posix,
        // so no need to look for any extra paths yet.
        paths.push('/usr/local/microsoft/powershell/7/profile.ps1', // All Users, All Hosts
        '/usr/local/microsoft/powershell/7/Microsoft.PowerShell_profile.ps1', // All Users, Current Host
        join(userHome, '.config', 'powershell', 'profile.ps1'), // Current User, All Hosts
        join(userHome, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1'));
    }
    else {
        paths.push('/opt/microsoft/powershell/7/profile.ps1', // All Users, All Hosts
        '/opt/microsoft/powershell/7/Microsoft.PowerShell_profile.ps1', // All Users, Current Host
        join(userHome, '.config', 'powershell', 'profile.ps1'), // Current User, All Hosts
        join(userHome, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1'));
    }
    return paths;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hlbGxFbnYuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3NoZWxsL25vZGUvc2hlbGxFbnYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN0QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDNUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEYsT0FBTyxFQUF1QixXQUFXLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFN0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFekUsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUVoRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLGNBQWMsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFN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