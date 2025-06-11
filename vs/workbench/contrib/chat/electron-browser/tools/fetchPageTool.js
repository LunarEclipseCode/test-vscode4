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
import { ResourceSet } from '../../../../../base/common/map.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { IWebContentExtractorService } from '../../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { ToolDataSource } from '../../common/languageModelToolsService.js';
import { InternalFetchWebPageToolId } from '../../common/tools/tools.js';
export const FetchWebPageToolData = {
    id: InternalFetchWebPageToolId,
    displayName: 'Fetch Web Page',
    canBeReferencedInPrompt: false,
    modelDescription: localize('fetchWebPage.modelDescription', 'Fetches the main content from a web page. This tool is useful for summarizing or analyzing the content of a webpage.'),
    source: ToolDataSource.Internal,
    inputSchema: {
        type: 'object',
        properties: {
            urls: {
                type: 'array',
                items: {
                    type: 'string',
                },
                description: localize('fetchWebPage.urlsDescription', 'An array of URLs to fetch content from.')
            }
        },
        required: ['urls']
    }
};
let FetchWebPageTool = class FetchWebPageTool {
    constructor(_readerModeService) {
        this._readerModeService = _readerModeService;
        this._alreadyApprovedDomains = new ResourceSet();
    }
    async invoke(invocation, _countTokens, _progress, _token) {
        const parsedUriResults = this._parseUris(invocation.parameters.urls);
        const validUris = Array.from(parsedUriResults.values()).filter((uri) => !!uri);
        if (!validUris.length) {
            return {
                content: [{ kind: 'text', value: localize('fetchWebPage.noValidUrls', 'No valid URLs provided.') }]
            };
        }
        // We approved these via confirmation, so mark them as "approved" in this session
        // if they are not approved via the trusted domain service.
        for (const uri of validUris) {
            this._alreadyApprovedDomains.add(uri);
        }
        const contents = await this._readerModeService.extract(validUris);
        // Make an array that contains either the content or undefined for invalid URLs
        const contentsWithUndefined = [];
        let indexInContents = 0;
        parsedUriResults.forEach((uri) => {
            if (uri) {
                contentsWithUndefined.push(contents[indexInContents]);
                indexInContents++;
            }
            else {
                contentsWithUndefined.push(undefined);
            }
        });
        return {
            content: this._getPromptPartsForResults(contentsWithUndefined),
            // Have multiple results show in the dropdown
            toolResultDetails: validUris.length > 1 ? validUris : undefined
        };
    }
    async prepareToolInvocation(parameters, token) {
        const map = this._parseUris(parameters.urls);
        const invalid = new Array();
        const valid = new Array();
        map.forEach((uri, url) => {
            if (!uri) {
                invalid.push(url);
            }
            else {
                valid.push(uri);
            }
        });
        const urlsNeedingConfirmation = valid.filter(url => !this._alreadyApprovedDomains.has(url));
        const pastTenseMessage = invalid.length
            ? invalid.length > 1
                // If there are multiple invalid URLs, show them all
                ? new MarkdownString(localize('fetchWebPage.pastTenseMessage.plural', 'Fetched {0} web pages, but the following were invalid URLs:\n\n{1}\n\n', valid.length, invalid.map(url => `- ${url}`).join('\n')))
                // If there is only one invalid URL, show it
                : new MarkdownString(localize('fetchWebPage.pastTenseMessage.singular', 'Fetched web page, but the following was an invalid URL:\n\n{0}\n\n', invalid[0]))
            // No invalid URLs
            : new MarkdownString();
        const invocationMessage = new MarkdownString();
        if (valid.length > 1) {
            pastTenseMessage.appendMarkdown(localize('fetchWebPage.pastTenseMessageResult.plural', 'Fetched {0} web pages', valid.length));
            invocationMessage.appendMarkdown(localize('fetchWebPage.invocationMessage.plural', 'Fetching {0} web pages', valid.length));
        }
        else {
            const url = valid[0].toString();
            // If the URL is too long, show it as a link... otherwise, show it as plain text
            if (url.length > 400) {
                pastTenseMessage.appendMarkdown(localize({
                    key: 'fetchWebPage.pastTenseMessageResult.singularAsLink',
                    comment: [
                        // Make sure the link syntax is correct
                        '{Locked="]({0})"}',
                    ]
                }, 'Fetched [web page]({0})', url));
                invocationMessage.appendMarkdown(localize({
                    key: 'fetchWebPage.invocationMessage.singularAsLink',
                    comment: [
                        // Make sure the link syntax is correct
                        '{Locked="]({0})"}',
                    ]
                }, 'Fetching [web page]({0})', url));
            }
            else {
                pastTenseMessage.appendMarkdown(localize('fetchWebPage.pastTenseMessageResult.singular', 'Fetched {0}', url));
                invocationMessage.appendMarkdown(localize('fetchWebPage.invocationMessage.singular', 'Fetching {0}', url));
            }
        }
        const result = { invocationMessage, pastTenseMessage };
        if (urlsNeedingConfirmation.length) {
            let confirmationTitle;
            let confirmationMessage;
            if (urlsNeedingConfirmation.length === 1) {
                confirmationTitle = localize('fetchWebPage.confirmationTitle.singular', 'Fetch web page?');
                confirmationMessage = new MarkdownString(urlsNeedingConfirmation[0].toString() + '\n\n$(info) ' +
                    localize('fetchWebPage.confirmationMessage.singular', 'Web content may contain malicious code or attempt prompt injection attacks.'), { supportThemeIcons: true });
            }
            else {
                confirmationTitle = localize('fetchWebPage.confirmationTitle.plural', 'Fetch web pages?');
                confirmationMessage = new MarkdownString(urlsNeedingConfirmation.map(uri => `- ${uri.toString()}`).join('\n') + '\n\n$(info) ' +
                    localize('fetchWebPage.confirmationMessage.plural', 'Web content may contain malicious code or attempt prompt injection attacks.'), { supportThemeIcons: true });
            }
            result.confirmationMessages = { title: confirmationTitle, message: confirmationMessage, allowAutoConfirm: true };
        }
        return result;
    }
    _parseUris(urls) {
        const results = new Map();
        urls?.forEach(uri => {
            try {
                const uriObj = URI.parse(uri);
                results.set(uri, uriObj);
            }
            catch (e) {
                results.set(uri, undefined);
            }
        });
        return results;
    }
    _getPromptPartsForResults(results) {
        return results.map(value => ({
            kind: 'text',
            value: value || localize('fetchWebPage.invalidUrl', 'Invalid URL')
        }));
    }
};
FetchWebPageTool = __decorate([
    __param(0, IWebContentExtractorService)
], FetchWebPageTool);
export { FetchWebPageTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2hQYWdlVG9vbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9lbGVjdHJvbi1icm93c2VyL3Rvb2xzL2ZldGNoUGFnZVRvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDJFQUEyRSxDQUFDO0FBQ3hILE9BQU8sRUFBeUgsY0FBYyxFQUFnQixNQUFNLDJDQUEyQyxDQUFDO0FBQ2hOLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRXpFLE1BQU0sQ0FBQyxNQUFNLG9CQUFvQixHQUFjO0lBQzlDLEVBQUUsRUFBRSwwQkFBMEI7SUFDOUIsV0FBVyxFQUFFLGdCQUFnQjtJQUM3Qix1QkFBdUIsRUFBRSxLQUFLO0lBQzlCLGdCQUFnQixFQUFFLFFBQVEsQ0FBQywrQkFBK0IsRUFBRSxzSEFBc0gsQ0FBQztJQUNuTCxNQUFNLEVBQUUsY0FBYyxDQUFDLFFBQVE7SUFDL0IsV0FBVyxFQUFFO1FBQ1osSUFBSSxFQUFFLFFBQVE7UUFDZCxVQUFVLEVBQUU7WUFDWCxJQUFJLEVBQUU7Z0JBQ0wsSUFBSSxFQUFFLE9BQU87Z0JBQ2IsS0FBSyxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO2lCQUNkO2dCQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsOEJBQThCLEVBQUUseUNBQXlDLENBQUM7YUFDaEc7U0FDRDtRQUNE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