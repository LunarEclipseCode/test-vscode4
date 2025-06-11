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
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IChatAgentService } from './chatAgents.js';
import { ChatContextKeys } from './chatContextKeys.js';
import { ChatMode, modeToString } from './constants.js';
import { IPromptsService } from './promptSyntax/service/promptsService.js';
export const IChatModeService = createDecorator('chatModeService');
let ChatModeService = class ChatModeService extends Disposable {
    constructor(promptsService, chatAgentService, contextKeyService, logService) {
        super();
        this.promptsService = promptsService;
        this.chatAgentService = chatAgentService;
        this.logService = logService;
        this._onDidChangeChatModes = new Emitter();
        this.onDidChangeChatModes = this._onDidChangeChatModes.event;
        void this.refreshCustomPromptModes(true);
        this.hasCustomModes = ChatContextKeys.Modes.hasCustomChatModes.bindTo(contextKeyService);
        this._register(this.promptsService.onDidChangeCustomChatModes(() => {
            void this.refreshCustomPromptModes(true);
        }));
    }
    async refreshCustomPromptModes(fireChangeEvent) {
        try {
            const modes = await this.promptsService.getCustomChatModes();
            this.latestCustomPromptModes = modes.map(customMode => new CustomChatMode(customMode));
            this.hasCustomModes.set(modes.length > 0);
            if (fireChangeEvent) {
                this._onDidChangeChatModes.fire();
            }
        }
        catch (error) {
            this.logService.error(error, 'Failed to load custom chat modes');
            this.latestCustomPromptModes = [];
            this.hasCustomModes.set(false);
        }
    }
    getModes() {
        return { builtin: this.getBuiltinModes(), custom: this.latestCustomPromptModes };
    }
    async getModesAsync() {
        await this.refreshCustomPromptModes();
        return { builtin: this.getBuiltinModes(), custom: this.latestCustomPromptModes };
    }
    getBuiltinModes() {
        const builtinModes = [
            ChatMode2.Ask,
        ];
        if (this.chatAgentService.hasToolsAgent) {
            builtinModes.push(ChatMode2.Agent);
        }
        builtinModes.push(ChatMode2.Edit);
        return builtinModes;
    }
};
ChatModeService = __decorate([
    __param(0, IPromptsService),
    __param(1, IChatAgentService),
    __param(2, IContextKeyService),
    __param(3, ILogService)
], ChatModeService);
export { ChatModeService };
export function isIChatMode(mode) {
    if (typeof mode === 'object' && mode !== null) {
        const chatMode = mode;
        return typeof chatMode.id === 'string' &&
            typeof chatMode.kind === 'string';
    }
    return false;
}
export class CustomChatMode {
    get id() {
        return this.customChatMode.uri.toString();
    }
    get name() {
        return this.customChatMode.name;
    }
    get description() {
        return this.customChatMode.description;
    }
    get customTools() {
        return this.customChatMode.tools;
    }
    get body() {
        return this.customChatMode.body;
    }
    constructor(customChatMode) {
        this.customChatMode = customChatMode;
        this.kind = ChatMode.Agent;
    }
    /**
     * Getters are not json-stringified
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            kind: this.kind,
            customTools: this.customTools,
            body: this.body
        };
    }
}
export class BuiltinChatMode {
    constructor(kind, description) {
        this.kind = kind;
        this.description = description;
    }
    get id() {
        // Need a differentiator?
        return this.kind;
    }
    get name() {
        return modeToString(this.kind);
    }
    /**
     * Getters are not json-stringified
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            kind: this.kind
        };
    }
}
export var ChatMode2;
(function (ChatMode2) {
    ChatMode2.Ask = new BuiltinChatMode(ChatMode.Ask, localize('chatDescription', "Ask Copilot"));
    ChatMode2.Edit = new BuiltinChatMode(ChatMode.Edit, localize('editsDescription', "Edit files in your workspace"));
    ChatMode2.Agent = new BuiltinChatMode(ChatMode.Agent, localize('agentDescription', "Edit files in your workspace in agent mode"));
})(ChatMode2 || (ChatMode2 = {}));
export function validateChatMode2(mode) {
    switch (mode) {
        case ChatMode.Ask:
            return ChatMode2.Ask;
        case ChatMode.Edit:
            return ChatMode2.Edit;
        case ChatMode.Agent:
            return ChatMode2.Agent;
        default:
            if (isIChatMode(mode)) {
                return mode;
            }
            return undefined;
    }
}
export function isBuiltinChatMode(mode) {
    return mode.id === ChatMode2.Ask.id ||
        mode.id === ChatMode2.Edit.id ||
        mode.id === ChatMode2.Agent.id;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0TW9kZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDdkQsT0FBTyxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN4RCxPQUFPLEVBQW1CLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRTVGLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBbUIsaUJBQWlCLENBQUMsQ0FBQztBQVM5RSxJQUFNLGVBQWUsR0FBckIsTUFBTSxlQUFnQixTQUFRLFVBQVU7SUFTOUMsWUFDa0IsY0FBZ0QsRUFDOUMsZ0JBQW9ELEVBQ25ELGlCQUFxQyxFQUM1QyxVQUF3QztRQUVyRCxLQUFLLEVBQUUsQ0FBQztRQUwwQixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDN0IscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtRQUV6QyxlQUFVLEdBQVYsVUFBVSxDQUFh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