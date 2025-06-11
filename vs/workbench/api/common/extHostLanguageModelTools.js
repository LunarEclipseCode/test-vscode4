/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { raceCancellation } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { CancellationError } from '../../../base/common/errors.js';
import { toDisposable } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { isToolInvocationContext } from '../../contrib/chat/common/languageModelToolsService.js';
import { ExtensionEditToolId, InternalEditToolId } from '../../contrib/chat/common/tools/editFileTool.js';
import { InternalFetchWebPageToolId } from '../../contrib/chat/common/tools/tools.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { MainContext } from './extHost.protocol.js';
import * as typeConvert from './extHostTypeConverters.js';
import { SearchExtensionsToolId } from '../../contrib/extensions/common/searchExtensionsTool.js';
class Tool {
    constructor(data) {
        this._data = data;
    }
    update(newData) {
        this._data = newData;
    }
    get data() {
        return this._data;
    }
    get apiObject() {
        if (!this._apiObject) {
            const that = this;
            this._apiObject = Object.freeze({
                get name() { return that._data.id; },
                get description() { return that._data.modelDescription; },
                get inputSchema() { return that._data.inputSchema; },
                get tags() { return that._data.tags ?? []; },
            });
        }
        return this._apiObject;
    }
}
export class ExtHostLanguageModelTools {
    constructor(mainContext, _languageModels) {
        this._languageModels = _languageModels;
        /** A map of tools that were registered in this EH */
        this._registeredTools = new Map();
        this._tokenCountFuncs = new Map();
        /** A map of all known tools, from other EHs or registered in vscode core */
        this._allTools = new Map();
        this._proxy = mainContext.getProxy(MainContext.MainThreadLanguageModelTools);
        this._proxy.$getTools().then(tools => {
            for (const tool of tools) {
                this._allTools.set(tool.id, new Tool(revive(tool)));
            }
        });
    }
    async $countTokensForInvocation(callId, input, token) {
        const fn = this._tokenCountFuncs.get(callId);
        if (!fn) {
            throw new Error(`Tool invocation call ${callId} not found`);
        }
        return await fn(input, token);
    }
    async invokeTool(extension, toolId, options, token) {
        const callId = generateUuid();
        if (options.tokenizationOptions) {
            this._tokenCountFuncs.set(callId, options.tokenizationOptions.countTokens);
        }
        try {
            if (options.toolInvocationToken && !isToolInvocationContext(options.toolInvocationToken)) {
                throw new Error(`Invalid tool invocation token`);
            }
            if ((toolId === InternalEditToolId || toolId === ExtensionEditToolId) && !isProposedApiEnabled(extension, 'chatParticipantPrivate')) {
                throw new Error(`Invalid tool: ${toolId}`);
            }
            // Making the round trip here because not all tools were necessarily registered in this EH
            const result = await this._proxy.$invokeTool({
                toolId,
                callId,
                parameters: options.input,
                tokenBudget: options.tokenizationOptions?.tokenBudget,
                context: options.toolInvocationToken,
                chatRequestId: isProposedApiEnabled(extension, 'chatParticipantPrivate') ? options.chatRequestId : undefined,
                chatInteractionId: isProposedApiEnabled(extension, 'chatParticipantPrivate') ? options.chatInteractionId : undefined,
            }, token);
            const dto = result instanceof SerializableObjectWithBuffers ? result.value : result;
            return typeConvert.LanguageModelToolResult2.to(revive(dto));
        }
        finally {
            this._tokenCountFuncs.delete(callId);
        }
    }
    $onDidChangeTools(tools) {
        const oldTools = new Set(this._registeredTools.keys());
        for (const tool of tools) {
            oldTools.delete(tool.id);
            const existing = this._allTools.get(tool.id);
            if (existing) {
                existing.update(tool);
            }
            else {
                this._allTools.set(tool.id, new Tool(revive(tool)));
            }
        }
        for (const id of oldTools) {
            this._allTools.delete(id);
        }
    }
    getTools(extension) {
        return Array.from(this._allTools.values())
            .map(tool => tool.apiObject)
            .filter(tool => {
            switch (tool.name) {
                case InternalEditToolId:
                case ExtensionEditToolId:
                case InternalFetchWebPageToolId:
                case SearchExtensionsToolId:
                    return isProposedApiEnabled(extension, 'chatParticipantPrivate');
                default:
                    return true;
            }
        });
    }
    async $invokeTool(dto, token) {
        const item = this._registeredTools.get(dto.toolId);
        if (!item) {
            throw new Error(`Unknown tool ${dto.toolId}`);
        }
        const options = {
            input: dto.parameters,
            toolInvocationToken: dto.context,
        };
        if (isProposedApiEnabled(item.extension, 'chatParticipantPrivate')) {
            options.chatRequestId = dto.chatRequestId;
            options.chatInteractionId = dto.chatInteractionId;
            options.chatSessionId = dto.context?.sessionId;
            if (dto.toolSpecificData?.kind === 'terminal') {
                options.terminalCommand = dto.toolSpecificData.command;
            }
        }
        if (isProposedApiEnabled(item.extension, 'chatParticipantAdditions') && dto.modelId) {
            options.model = await this.getModel(dto.modelId, item.extension);
        }
        if (dto.tokenBudget !== undefined) {
            options.tokenizationOptions = {
                tokenBudget: dto.tokenBudget,
                countTokens: this._tokenCountFuncs.get(dto.callId) || ((value, token = CancellationToken.None) => this._proxy.$countTokensForInvocation(dto.callId, value, token))
            };
        }
        let progress;
        if (isProposedApiEnabled(item.extension, 'toolProgress')) {
            progress = {
                report: value => {
                    this._proxy.$acceptToolProgress(dto.callId, {
                        message: typeConvert.MarkdownString.fromStrict(value.message),
                        increment: value.increment,
                        total: 100,
                    });
                }
            };
        }
        // todo: 'any' cast because TS can't handle the overloads
        const extensionResult = await raceCancellation(Promise.resolve(item.tool.invoke(options, token, progress)), token);
        if (!extensionResult) {
            throw new CancellationError();
        }
        return typeConvert.LanguageModelToolResult2.from(extensionResult, item.extension);
    }
    async getModel(modelId, extension) {
        let model;
        if (modelId) {
            model = await this._languageModels.getLanguageModelByIdentifier(extension, modelId);
        }
        if (!model) {
            model = await this._languageModels.getDefaultLanguageModel(extension);
            if (!model) {
                throw new Error('Language model unavailable');
            }
        }
        return model;
    }
    async $prepareToolInvocation(toolId, input, token) {
        const item = this._registeredTools.get(toolId);
        if (!item) {
            throw new Error(`Unknown tool ${toolId}`);
        }
        const options = { input };
        if (isProposedApiEnabled(item.extension, 'chatParticipantPrivate') && item.tool.prepareInvocation2) {
            const result = await item.tool.prepareInvocation2(options, token);
            if (!result) {
                return undefined;
            }
            return {
                confirmationMessages: result.confirmationMessages ? {
                    title: typeof result.confirmationMessages.title === 'string' ? result.confirmationMessages.title : typeConvert.MarkdownString.from(result.confirmationMessages.title),
                    message: typeof result.confirmationMessages.message === 'string' ? result.confirmationMessages.message : typeConvert.MarkdownString.from(result.confirmationMessages.message),
                } : undefined,
                toolSpecificData: {
                    kind: 'terminal',
                    language: result.language,
                    command: result.command,
                },
                presentation: result.presentation
            };
        }
        else if (item.tool.prepareInvocation) {
            const result = await item.tool.prepareInvocation(options, token);
            if (!result) {
                return undefined;
            }
            if (result.pastTenseMessage || result.presentation) {
                checkProposedApiEnabled(item.extension, 'chatParticipantPrivate');
            }
            return {
                confirmationMessages: result.confirmationMessages ? {
                    title: typeof result.confirmationMessages.title === 'string' ? result.confirmationMessages.title : typeConvert.MarkdownString.from(result.confirmationMessages.title),
                    message: typeof result.confirmationMessages.message === 'string' ? result.confirmationMessages.message : typeConvert.MarkdownString.from(result.confirmationMessages.message),
                } : undefined,
                invocationMessage: typeConvert.MarkdownString.fromStrict(result.invocationMessage),
                pastTenseMessage: typeConvert.MarkdownString.fromStrict(result.pastTenseMessage),
                presentation: result.presentation
            };
        }
        return undefined;
    }
    registerTool(extension, id, tool) {
        this._registeredTools.set(id, { extension, tool });
        this._proxy.$registerTool(id);
        return toDisposable(() => {
            this._registeredTools.delete(id);
            this._proxy.$unregisterTool(id);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdExhbmd1YWdlTW9kZWxUb29scy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdExhbmd1YWdlTW9kZWxUb29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuRSxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxPQUFPLEVBQTJCLHVCQUF1QixFQUF3RCxNQUFNLHdEQUF3RCxDQUFDO0FBQ2hMLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9HLE9BQU8sRUFBTyw2QkFBNkIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3pHLE9BQU8sRUFBOEQsV0FBVyxFQUFxQyxNQUFNLHVCQUF1QixDQUFDO0FBRW5KLE9BQU8sS0FBSyxXQUFXLE1BQU0sNEJBQTRCLENBQUM7QUFDMUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFakcsTUFBTSxJQUFJO0lBS1QsWUFBWSxJQUFrQjtRQUM3QixJQUFJLENBQUMsS0FBSyxH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