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
import { $ } from '../../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { MarkdownRenderer } from '../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { REVEAL_IN_EXPLORER_COMMAND_ID } from '../../files/browser/fileConstants.js';
const allowedHtmlTags = [
    'b',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
    'a',
    'img',
    // TODO@roblourens when we sanitize attributes in markdown source, we can ban these elements at that step. microsoft/vscode-copilot#5091
    // Not in the official list, but used for codicons and other vscode markdown extensions
    'span',
    'div',
];
/**
 * This wraps the MarkdownRenderer and applies sanitizer options needed for Chat.
 */
let ChatMarkdownRenderer = class ChatMarkdownRenderer extends MarkdownRenderer {
    constructor(options, languageService, openerService, hoverService, fileService, commandService) {
        super(options ?? {}, languageService, openerService);
        this.hoverService = hoverService;
        this.fileService = fileService;
        this.commandService = commandService;
    }
    render(markdown, options, markedOptions) {
        options = {
            ...options,
            remoteImageIsAllowed: (_uri) => false,
            sanitizerOptions: {
                replaceWithPlaintext: true,
                allowedTags: allowedHtmlTags,
            }
        };
        const mdWithBody = (markdown && markdown.supportHtml) ?
            {
                ...markdown,
                // dompurify uses DOMParser, which strips leading comments. Wrapping it all in 'body' prevents this.
                // The \n\n prevents marked.js from parsing the body contents as just text in an 'html' token, instead of actual markdown.
                value: `<body>\n\n${markdown.value}</body>`,
            }
            : markdown;
        const result = super.render(mdWithBody, options, markedOptions);
        // In some cases, the renderer can return text that is not inside a <p>,
        // but our CSS expects text to be in a <p> for margin to be applied properly.
        // So just normalize it.
        const lastChild = result.element.lastChild;
        if (lastChild?.nodeType === Node.TEXT_NODE && lastChild.textContent?.trim()) {
            lastChild.replaceWith($('p', undefined, lastChild.textContent));
        }
        return this.attachCustomHover(result);
    }
    attachCustomHover(result) {
        const store = new DisposableStore();
        result.element.querySelectorAll('a').forEach((element) => {
            if (element.title) {
                const title = element.title;
                element.title = '';
                store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), element, title));
            }
        });
        return {
            element: result.element,
            dispose: () => {
                result.dispose();
                store.dispose();
            }
        };
    }
    async openMarkdownLink(link, markdown) {
        try {
            const uri = URI.parse(link);
            if ((await this.fileService.stat(uri)).isDirectory) {
                return this.commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, uri);
            }
        }
        catch {
            // noop
        }
        return super.openMarkdownLink(link, markdown);
    }
};
ChatMarkdownRenderer = __decorate([
    __param(1, ILanguageService),
    __param(2, IOpenerService),
    __param(3, IHoverService),
    __param(4, IFileService),
    __param(5, ICommandService)
], ChatMarkdownRenderer);
export { ChatMarkdownRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1hcmtkb3duUmVuZGVyZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0TWFya2Rvd25SZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFcEQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFcEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQW1ELGdCQUFnQixFQUFFLE1BQU0sZ0ZBQWdGLENBQUM7QUFDbkssT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXJGLE1BQU0sZUFBZSxHQUFHO0lBQ3ZCLEdBQUc7SUFDSCxZQUFZO0lBQ1osSUFBSTtJQUNKLE1BQU07SUFDTixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLEdBQUc7SUFDSCxJQUFJO0lBQ0osSUFBSTtJQUNKLEdBQUc7SUFDSCxLQUFLO0lBQ0wsUUFBUTtJQUNS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