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
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { themeColorFromId } from '../../../../../base/common/themables.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { inputPlaceholderForeground } from '../../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IChatAgentService } from '../../common/chatAgents.js';
import { chatSlashCommandBackground, chatSlashCommandForeground } from '../../common/chatColors.js';
import { IChatModeService } from '../../common/chatModes.js';
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashCommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, ChatRequestToolSetPart, chatAgentLeader, chatSubcommandLeader } from '../../common/chatParserTypes.js';
import { ChatRequestParser } from '../../common/chatRequestParser.js';
import { ChatWidget } from '../chatWidget.js';
import { dynamicVariableDecorationType } from './chatDynamicVariables.js';
const decorationDescription = 'chat';
const placeholderDecorationType = 'chat-session-detail';
const slashCommandTextDecorationType = 'chat-session-text';
const variableTextDecorationType = 'chat-variable-text';
function agentAndCommandToKey(agent, subcommand) {
    return subcommand ? `${agent.id}__${subcommand}` : agent.id;
}
let InputEditorDecorations = class InputEditorDecorations extends Disposable {
    constructor(widget, codeEditorService, themeService, chatAgentService, chatModeService) {
        super();
        this.widget = widget;
        this.codeEditorService = codeEditorService;
        this.themeService = themeService;
        this.chatAgentService = chatAgentService;
        this.chatModeService = chatModeService;
        this.id = 'inputEditorDecorations';
        this.previouslyUsedAgents = new Set();
        this.viewModelDisposables = this._register(new MutableDisposable());
        this.codeEditorService.registerDecorationType(decorationDescription, placeholderDecorationType, {});
        this.registeredDecorationTypes();
        this.updateInputEditorDecorations();
        this._register(this.widget.inputEditor.onDidChangeModelContent(() => this.updateInputEditorDecorations()));
        this._register(this.widget.onDidChangeParsedInput(() => this.updateInputEditorDecorations()));
        this._register(this.widget.onDidChangeViewModel(() => {
            this.registerViewModelListeners();
            this.previouslyUsedAgents.clear();
            this.updateInputEditorDecorations();
        }));
        this._register(this.widget.onDidSubmitAgent((e) => {
            this.previouslyUsedAgents.add(agentAndCommandToKey(e.agent, e.slashCommand?.name));
        }));
        this._register(this.chatAgentService.onDidChangeAgents(() => this.updateInputEditorDecorations()));
        this._register(this.chatModeService.onDidChangeChatModes(() => this.updateInputEditorDecorations()));
        this.registerViewModelListeners();
    }
    registerViewModelListeners() {
        this.viewModelDisposables.value = this.widget.viewModel?.onDidChange(e => {
            if (e?.kind === 'changePlaceholder' || e?.kind === 'initialize') {
                this.updateInputEditorDecorations();
            }
        });
    }
    registeredDecorationTypes() {
        this.codeEditorService.registerDecorationType(decorationDescription, slashCommandTextDecorationType, {
            color: themeColorFromId(chatSlashCommandForeground),
            backgroundColor: themeColorFromId(chatSlashCommandBackground),
            borderRadius: '3px'
        });
        this.codeEditorService.registerDecorationType(decorationDescription, variableTextDecorationType, {
            color: themeColorFromId(chatSlashCommandForeground),
            backgroundColor: themeColorFromId(chatSlashCommandBackground),
            borderRadius: '3px'
        });
        this.codeEditorService.registerDecorationType(decorationDescription, dynamicVariableDecorationType, {
            color: themeColorFromId(chatSlashCommandForeground),
            backgroundColor: themeColorFromId(chatSlashCommandBackground),
            borderRadius: '3px',
            rangeBehavior: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */
        });
        this._register(toDisposable(() => {
            this.codeEditorService.removeDecorationType(variableTextDecorationType);
            this.codeEditorService.removeDecorationType(dynamicVariableDecorationType);
            this.codeEditorService.removeDecorationType(slashCommandTextDecorationType);
        }));
    }
    getPlaceholderColor() {
        const theme = this.themeService.getColorTheme();
        const transparentForeground = theme.getColor(inputPlaceholderForeground);
        return transparentForeground?.toString();
    }
    async updateInputEditorDecorations() {
        const inputValue = this.widget.inputEditor.getValue();
        const viewModel = this.widget.viewModel;
        if (!viewModel) {
            return;
        }
        if (!inputValue) {
            const description = this.widget.input.currentMode2.description;
            const decoration = [
                {
                    range: {
                        startLineNumber: 1,
                        endLineNumber: 1,
                        startColumn: 1,
                        endColumn: 1000
                    },
                    renderOptions: {
                        after: {
                            contentText: viewModel.inputPlaceholder || (description ?? ''),
                            color: this.getPlaceholderColor()
                        }
                    }
                }
            ];
            this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, decoration);
            return;
        }
        const parsedRequest = this.widget.parsedInput.parts;
        let placeholderDecoration;
        const agentPart = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
        const agentSubcommandPart = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
        const slashCommandPart = parsedRequest.find((p) => p instanceof ChatRequestSlashCommandPart);
        const slashPromptPart = parsedRequest.find((p) => p instanceof ChatRequestSlashPromptPart);
        const exactlyOneSpaceAfterPart = (part) => {
            const partIdx = parsedRequest.indexOf(part);
            if (parsedRequest.length > partIdx + 2) {
                return false;
            }
            const nextPart = parsedRequest[partIdx + 1];
            return nextPart && nextPart instanceof ChatRequestTextPart && nextPart.text === ' ';
        };
        const getRangeForPlaceholder = (part) => ({
            startLineNumber: part.editorRange.startLineNumber,
            endLineNumber: part.editorRange.endLineNumber,
            startColumn: part.editorRange.endColumn + 1,
            endColumn: 1000
        });
        const onlyAgentAndWhitespace = agentPart && parsedRequest.every(p => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart);
        if (onlyAgentAndWhitespace) {
            // Agent reference with no other text - show the placeholder
            const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, undefined));
            const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentPart.agent.metadata.followupPlaceholder;
            if (agentPart.agent.description && exactlyOneSpaceAfterPart(agentPart)) {
                placeholderDecoration = [{
                        range: getRangeForPlaceholder(agentPart),
                        renderOptions: {
                            after: {
                                contentText: shouldRenderFollowupPlaceholder ? agentPart.agent.metadata.followupPlaceholder : agentPart.agent.description,
                                color: this.getPlaceholderColor(),
                            }
                        }
                    }];
            }
        }
        const onlyAgentAndAgentCommandAndWhitespace = agentPart && agentSubcommandPart && parsedRequest.every(p => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart);
        if (onlyAgentAndAgentCommandAndWhitespace) {
            // Agent reference and subcommand with no other text - show the placeholder
            const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, agentSubcommandPart.command.name));
            const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentSubcommandPart.command.followupPlaceholder;
            if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(agentSubcommandPart)) {
                placeholderDecoration = [{
                        range: getRangeForPlaceholder(agentSubcommandPart),
                        renderOptions: {
                            after: {
                                contentText: shouldRenderFollowupPlaceholder ? agentSubcommandPart.command.followupPlaceholder : agentSubcommandPart.command.description,
                                color: this.getPlaceholderColor(),
                            }
                        }
                    }];
            }
        }
        const onlyAgentCommandAndWhitespace = agentSubcommandPart && parsedRequest.every(p => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentSubcommandPart);
        if (onlyAgentCommandAndWhitespace) {
            // Agent subcommand with no other text - show the placeholder
            if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(agentSubcommandPart)) {
                placeholderDecoration = [{
                        range: getRangeForPlaceholder(agentSubcommandPart),
                        renderOptions: {
                            after: {
                                contentText: agentSubcommandPart.command.description,
                                color: this.getPlaceholderColor(),
                            }
                        }
                    }];
            }
        }
        this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, placeholderDecoration ?? []);
        const textDecorations = [];
        if (agentPart) {
            textDecorations.push({ range: agentPart.editorRange });
        }
        if (agentSubcommandPart) {
            textDecorations.push({ range: agentSubcommandPart.editorRange, hoverMessage: new MarkdownString(agentSubcommandPart.command.description) });
        }
        if (slashCommandPart) {
            textDecorations.push({ range: slashCommandPart.editorRange });
        }
        if (slashPromptPart) {
            textDecorations.push({ range: slashPromptPart.editorRange });
        }
        this.widget.inputEditor.setDecorationsByType(decorationDescription, slashCommandTextDecorationType, textDecorations);
        const varDecorations = [];
        const toolParts = parsedRequest.filter((p) => p instanceof ChatRequestToolPart || p instanceof ChatRequestToolSetPart);
        for (const tool of toolParts) {
            varDecorations.push({ range: tool.editorRange });
        }
        this.widget.inputEditor.setDecorationsByType(decorationDescription, variableTextDecorationType, varDecorations);
    }
};
InputEditorDecorations = __decorate([
    __param(1, ICodeEditorService),
    __param(2, IThemeService),
    __param(3, IChatAgentService),
    __param(4, IChatModeService)
], InputEditorDecorations);
class InputEditorSlashCommandMode extends Disposable {
    constructor(widget) {
        super();
        this.widget = widget;
        this.id = 'InputEditorSlashCommandMode';
        this._register(this.widget.onDidChangeAgent(e => {
            if (e.slashCommand && e.slashCommand.isSticky || !e.slashCommand && e.agent.metadata.isSticky) {
                this.repopulateAgentCommand(e.agent, e.slashCommand);
            }
        }));
        this._register(this.widget.onDidSubmitAgent(e => {
            this.repopulateAgentCommand(e.agent, e.slashCommand);
        }));
    }
    async repopulateAgentCommand(agent, slashCommand) {
        // Make sure we don't repopulate if the user already has something in the input
        if (this.widget.inputEditor.getValue().trim()) {
            return;
        }
        let value;
        if (slashCommand && slashCommand.isSticky) {
            value = `${chatAgentLeader}${agent.name} ${chatSubcommandLeader}${slashCommand.name} `;
        }
        else if (agent.metadata.isSticky) {
            value = `${chatAgentLeader}${agent.name} `;
        }
        if (value) {
            this.widget.inputEditor.setValue(value);
            this.widget.inputEditor.setPosition({ lineNumber: 1, column: value.length + 1 });
        }
    }
}
ChatWidget.CONTRIBS.push(InputEditorDecorations, InputEditorSlashCommandMode);
let ChatTokenDeleter = class ChatTokenDeleter extends Disposable {
    constructor(widget, instantiationService) {
        super();
        this.widget = widget;
        this.instantiationService = instantiationService;
        this.id = 'chatTokenDeleter';
        const parser = this.instantiationService.createInstance(ChatRequestParser);
        const inputValue = this.widget.inputEditor.getValue();
        let previousInputValue;
        let previousSelectedAgent;
        // A simple heuristic to delete the previous token when the user presses backspace.
        // The sophisticated way to do this would be to have a parse tree that can be updated incrementally.
        this._register(this.widget.inputEditor.onDidChangeModelContent(e => {
            if (!previousInputValue) {
                previousInputValue = inputValue;
                previousSelectedAgent = this.widget.lastSelectedAgent;
            }
            // Don't try to handle multicursor edits right now
            const change = e.changes[0];
            // If this was a simple delete, try to find out whether it was inside a token
            if (!change.text && this.widget.viewModel) {
                const previousParsedValue = parser.parseChatRequest(this.widget.viewModel.sessionId, previousInputValue, widget.location, { selectedAgent: previousSelectedAgent, mode: this.widget.input.currentMode });
                // For dynamic variables, this has to happen in ChatDynamicVariableModel with the other bookkeeping
                const deletableTokens = previousParsedValue.parts.filter(p => p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart || p instanceof ChatRequestSlashCommandPart || p instanceof ChatRequestSlashPromptPart || p instanceof ChatRequestToolPart);
                deletableTokens.forEach(token => {
                    const deletedRangeOfToken = Range.intersectRanges(token.editorRange, change.range);
                    // Part of this token was deleted, or the space after it was deleted, and the deletion range doesn't go off the front of the token, for simpler math
                    if (deletedRangeOfToken && Range.compareRangesUsingStarts(token.editorRange, change.range) < 0) {
                        // Assume single line tokens
                        const length = deletedRangeOfToken.endColumn - deletedRangeOfToken.startColumn;
                        const rangeToDelete = new Range(token.editorRange.startLineNumber, token.editorRange.startColumn, token.editorRange.endLineNumber, token.editorRange.endColumn - length);
                        this.widget.inputEditor.executeEdits(this.id, [{
                                range: rangeToDelete,
                                text: '',
                            }]);
                        this.widget.refreshParsedInput();
                    }
                });
            }
            previousInputValue = this.widget.inputEditor.getValue();
            previousSelectedAgent = this.widget.lastSelectedAgent;
        }));
    }
};
ChatTokenDeleter = __decorate([
    __param(1, IInstantiationService)
], ChatTokenDeleter);
ChatWidget.CONTRIBS.push(ChatTokenDeleter);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdElucHV0RWRpdG9yQ29udHJpYi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NvbnRyaWIvY2hhdElucHV0RWRpdG9yQ29udHJpYi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFHbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBcUMsaUJBQWlCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNsRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNwRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsOEJBQThCLEVBQUUsMkJBQTJCLEVBQUUsMEJBQTBCLEVBQUUsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQUUsc0JBQXNCLEVBQTBCLGVBQWUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2pTLE9BQU8sRUFB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