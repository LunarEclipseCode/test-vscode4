/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { renderMarkdownAsPlaintext } from '../../../../base/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { isResponseVM } from '../common/chatViewModel.js';
import { IChatWidgetService } from './chat.js';
export class ChatResponseAccessibleView {
    constructor() {
        this.priority = 100;
        this.name = 'panelChat';
        this.type = "view" /* AccessibleViewType.View */;
        this.when = ChatContextKeys.inChatSession;
    }
    getProvider(accessor) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const chatInputFocused = widget.hasInputFocus();
        if (chatInputFocused) {
            widget.focusLastMessage();
        }
        const verifiedWidget = widget;
        const focusedItem = verifiedWidget.getFocus();
        if (!focusedItem) {
            return;
        }
        return new ChatResponseAccessibleProvider(verifiedWidget, focusedItem, chatInputFocused);
    }
}
class ChatResponseAccessibleProvider extends Disposable {
    constructor(_widget, item, _chatInputFocused) {
        super();
        this._widget = _widget;
        this._chatInputFocused = _chatInputFocused;
        this.id = "panelChat" /* AccessibleViewProviderId.PanelChat */;
        this.verbositySettingKey = "accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */;
        this.options = { type: "view" /* AccessibleViewType.View */ };
        this._focusedItem = item;
    }
    provideContent() {
        return this._getContent(this._focusedItem);
    }
    _getContent(item) {
        let responseContent = isResponseVM(item) ? item.response.toString() : '';
        if (!responseContent && 'errorDetails' in item && item.errorDetails) {
            responseContent = item.errorDetails.message;
        }
        if (isResponseVM(item)) {
            const toolInvocations = item.response.value.filter(item => item.kind === 'toolInvocation');
            for (const toolInvocation of toolInvocations) {
                if (toolInvocation.confirmationMessages) {
                    const title = typeof toolInvocation.confirmationMessages.title === 'string' ? toolInvocation.confirmationMessages.title : toolInvocation.confirmationMessages.title.value;
                    const message = typeof toolInvocation.confirmationMessages.message === 'string' ? toolInvocation.confirmationMessages.message : stripIcons(renderMarkdownAsPlaintext(toolInvocation.confirmationMessages.message));
                    let input = '';
                    if (toolInvocation.toolSpecificData) {
                        input = toolInvocation.toolSpecificData?.kind === 'terminal'
                            ? toolInvocation.toolSpecificData.command
                            : input = toolInvocation.toolSpecificData?.kind === 'extensions'
                                ? JSON.stringify(toolInvocation.toolSpecificData.extensions)
                                : JSON.stringify(toolInvocation.toolSpecificData.rawInput);
                    }
                    responseContent += `${title}`;
                    if (input) {
                        responseContent += `: ${input}`;
                    }
                    responseContent += `\n${message}\n`;
                }
                else if (toolInvocation.isComplete && toolInvocation.resultDetails && 'input' in toolInvocation.resultDetails) {
                    responseContent += toolInvocation.resultDetails.isError ? 'Errored ' : 'Completed ';
                    responseContent += `${`${typeof toolInvocation.invocationMessage === 'string' ? toolInvocation.invocationMessage : stripIcons(renderMarkdownAsPlaintext(toolInvocation.invocationMessage))} with input: ${toolInvocation.resultDetails.input}`}\n`;
                }
            }
            const pastConfirmations = item.response.value.filter(item => item.kind === 'toolInvocationSerialized');
            for (const pastConfirmation of pastConfirmations) {
                if (pastConfirmation.isComplete && pastConfirmation.resultDetails && 'input' in pastConfirmation.resultDetails) {
                    if (pastConfirmation.pastTenseMessage) {
                        responseContent += `\n${`${typeof pastConfirmation.pastTenseMessage === 'string' ? pastConfirmation.pastTenseMessage : stripIcons(renderMarkdownAsPlaintext(pastConfirmation.pastTenseMessage))} with input: ${pastConfirmation.resultDetails.input}`}\n`;
                    }
                }
            }
        }
        return renderMarkdownAsPlaintext(new MarkdownString(responseContent), true);
    }
    onClose() {
        this._widget.reveal(this._focusedItem);
        if (this._chatInputFocused) {
            this._widget.focusInput();
        }
        else {
            this._widget.focus(this._focusedItem);
        }
    }
    provideNextContent() {
        const next = this._widget.getSibling(this._focusedItem, 'next');
        if (next) {
            this._focusedItem = next;
            return this._getContent(next);
        }
        return;
    }
    providePreviousContent() {
        const previous = this._widget.getSibling(this._focusedItem, 'previous');
        if (previous) {
            this._focusedItem = previous;
            return this._getContent(previous);
        }
        return;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlc3BvbnNlQWNjZXNzaWJsZVZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0UmVzcG9uc2VBY2Nlc3NpYmxlVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN6RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUtsRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBNkIsa0JBQWtCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFMUUsTUFBTSxPQUFPLDBCQUEwQjtJQUF2QztRQUNVLGFBQVEsR0FBRyxHQUFHLENBQUM7UUFDZixTQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ25CLFNBQUksd0NBQTJCO1FBQy9CLFNBQUksR0FBRyxlQUFlLENBQUMsYUFBYSxDQUFDO0lBb0IvQyxDQUFDO0lBbkJBLFdBQVcsQ0FBQyxRQUEwQjtRQUNyQyxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLGlCQUFpQixDQUFDO1FBQy9DLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU87UUFDUixDQUFDO1FBQ0QsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDaEQsSUFBSSxnQkFB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