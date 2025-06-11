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
import * as dom from '../../../../base/browser/dom.js';
import * as nls from '../../../../nls.js';
import { renderMarkdown } from '../../../../base/browser/markdownRenderer.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { CommentNode, ResourceWithCommentThreads } from '../common/commentModel.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IListService, WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { TimestampWidget } from './timestamp.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { commentViewThreadStateColorVar, getCommentThreadStateIconColor } from './commentColors.js';
import { CommentThreadApplicability, CommentThreadState } from '../../../../editor/common/languages.js';
import { FilterOptions } from './commentsFilterOptions.js';
import { basename } from '../../../../base/common/resources.js';
import { openLinkFromMarkdown } from '../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { CommentsModel } from './commentsModel.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { createActionViewItem, getContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
export const COMMENTS_VIEW_ID = 'workbench.panel.comments';
export const COMMENTS_VIEW_STORAGE_ID = 'Comments';
export const COMMENTS_VIEW_TITLE = nls.localize2('comments.view.title', "Comments");
class CommentsModelVirtualDelegate {
    static { this.RESOURCE_ID = 'resource-with-comments'; }
    static { this.COMMENT_ID = 'comment-node'; }
    getHeight(element) {
        if ((element instanceof CommentNode) && element.hasReply()) {
            return 44;
        }
        return 22;
    }
    getTemplateId(element) {
        if (element instanceof ResourceWithCommentThreads) {
            return CommentsModelVirtualDelegate.RESOURCE_ID;
        }
        if (element instanceof CommentNode) {
            return CommentsModelVirtualDelegate.COMMENT_ID;
        }
        return '';
    }
}
export class ResourceWithCommentsRenderer {
    constructor(labels) {
        this.labels = labels;
        this.templateId = 'resource-with-comments';
    }
    renderTemplate(container) {
        const labelContainer = dom.append(container, dom.$('.resource-container'));
        const resourceLabel = this.labels.create(labelContainer);
        const separator = dom.append(labelContainer, dom.$('.separator'));
        const owner = labelContainer.appendChild(dom.$('.owner'));
        return { resourceLabel, owner, separator };
    }
    renderElement(node, index, templateData) {
        templateData.resourceLabel.setFile(node.element.resource);
        templateData.separator.innerText = '\u00b7';
        if (node.element.ownerLabel) {
            templateData.owner.innerText = node.element.ownerLabel;
            templateData.separator.style.display = 'inline';
        }
        else {
            templateData.owner.innerText = '';
            templateData.separator.style.display = 'none';
        }
    }
    disposeTemplate(templateData) {
        templateData.resourceLabel.dispose();
    }
}
let CommentsMenus = class CommentsMenus {
    constructor(menuService) {
        this.menuService = menuService;
    }
    getResourceActions(element) {
        const actions = this.getActions(MenuId.CommentsViewThreadActions, element);
        return { actions: actions.primary };
    }
    getResourceContextActions(element) {
        return this.getActions(MenuId.CommentsViewThreadActions, element).secondary;
    }
    setContextKeyService(service) {
        this.contextKeyService = service;
    }
    getActions(menuId, element) {
        if (!this.contextKeyService) {
            return { primary: [], secondary: [] };
        }
        const overlay = [
            ['commentController', element.owner],
            ['resourceScheme', element.resource.scheme],
            ['commentThread', element.contextValue],
            ['canReply', element.thread.canReply]
        ];
        const contextKeyService = this.contextKeyService.createOverlay(overlay);
        const menu = this.menuService.getMenuActions(menuId, contextKeyService, { shouldForwardArgs: true });
        return getContextMenuActions(menu, 'inline');
    }
    dispose() {
        this.contextKeyService = undefined;
    }
};
CommentsMenus = __decorate([
    __param(0, IMenuService)
], CommentsMenus);
export { CommentsMenus };
let CommentNodeRenderer = class CommentNodeRenderer {
    constructor(actionViewItemProvider, menus, openerService, configurationService, hoverService, themeService) {
        this.actionViewItemProvider = actionViewItemProvider;
        this.menus = menus;
        this.openerService = openerService;
        this.configurationService = configurationService;
        this.hoverService = hoverService;
        this.themeService = themeService;
        this.templateId = 'comment-node';
    }
    renderTemplate(container) {
        const threadContainer = dom.append(container, dom.$('.comment-thread-container'));
        const metadataContainer = dom.append(threadContainer, dom.$('.comment-metadata-container'));
        const metadata = dom.append(metadataContainer, dom.$('.comment-metadata'));
        const icon = dom.append(metadata, dom.$('.icon'));
        const userNames = dom.append(metadata, dom.$('.user'));
        const timestamp = new TimestampWidget(this.configurationService, this.hoverService, dom.append(metadata, dom.$('.timestamp-container')));
        const relevance = dom.append(metadata, dom.$('.relevance'));
        const separator = dom.append(metadata, dom.$('.separator'));
        const commentPreview = dom.append(metadata, dom.$('.text'));
        const rangeContainer = dom.append(metadata, dom.$('.range'));
        const range = dom.$('p');
        rangeContainer.appendChild(range);
        const threadMetadata = {
            icon,
            userNames,
            timestamp,
            relevance,
            separator,
            commentPreview,
            range
        };
        threadMetadata.separator.innerText = '\u00b7';
        const actionsContainer = dom.append(metadataContainer, dom.$('.actions'));
        const actionBar = new ActionBar(actionsContainer, {
            actionViewItemProvider: this.actionViewItemProvider
        });
        const snippetContainer = dom.append(threadContainer, dom.$('.comment-snippet-container'));
        const repliesMetadata = {
            container: snippetContainer,
            icon: dom.append(snippetContainer, dom.$('.icon')),
            count: dom.append(snippetContainer, dom.$('.count')),
            lastReplyDetail: dom.append(snippetContainer, dom.$('.reply-detail')),
            separator: dom.append(snippetContainer, dom.$('.separator')),
            timestamp: new TimestampWidget(this.configurationService, this.hoverService, dom.append(snippetContainer, dom.$('.timestamp-container'))),
        };
        repliesMetadata.separator.innerText = '\u00b7';
        repliesMetadata.icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.indent));
        const disposables = [threadMetadata.timestamp, repliesMetadata.timestamp];
        return { threadMetadata, repliesMetadata, actionBar, disposables };
    }
    getCountString(commentCount) {
        if (commentCount > 2) {
            return nls.localize('commentsCountReplies', "{0} replies", commentCount - 1);
        }
        else if (commentCount === 2) {
            return nls.localize('commentsCountReply', "1 reply");
        }
        else {
            return nls.localize('commentCount', "1 comment");
        }
    }
    getRenderedComment(commentBody, disposables) {
        const renderedComment = renderMarkdown(commentBody, {
            inline: true,
            actionHandler: {
                callback: (link) => openLinkFromMarkdown(this.openerService, link, commentBody.isTrusted),
                disposables: disposables
            }
        });
        const images = renderedComment.element.getElementsByTagName('img');
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const textDescription = dom.$('');
            textDescription.textContent = image.alt ? nls.localize('imageWithLabel', "Image: {0}", image.alt) : nls.localize('image', "Image");
            image.parentNode.replaceChild(textDescription, image);
        }
        const headings = [...renderedComment.element.getElementsByTagName('h1'), ...renderedComment.element.getElementsByTagName('h2'), ...renderedComment.element.getElementsByTagName('h3'), ...renderedComment.element.getElementsByTagName('h4'), ...renderedComment.element.getElementsByTagName('h5'), ...renderedComment.element.getElementsByTagName('h6')];
        for (const heading of headings) {
            const textNode = document.createTextNode(heading.textContent || '');
            heading.parentNode.replaceChild(textNode, heading);
        }
        while ((renderedComment.element.children.length > 1) && (renderedComment.element.firstElementChild?.tagName === 'HR')) {
            renderedComment.element.removeChild(renderedComment.element.firstElementChild);
        }
        return renderedComment;
    }
    getIcon(threadState) {
        if (threadState === CommentThreadState.Unresolved) {
            return Codicon.commentUnresolved;
        }
        else {
            return Codicon.comment;
        }
    }
    renderElement(node, index, templateData) {
        templateData.actionBar.clear();
        const commentCount = node.element.replies.length + 1;
        if (node.element.threadRelevance === CommentThreadApplicability.Outdated) {
            templateData.threadMetadata.relevance.style.display = '';
            templateData.threadMetadata.relevance.innerText = nls.localize('outdated', "Outdated");
            templateData.threadMetadata.separator.style.display = 'none';
        }
        else {
            templateData.threadMetadata.relevance.innerText = '';
            templateData.threadMetadata.relevance.style.display = 'none';
            templateData.threadMetadata.separator.style.display = '';
        }
        templateData.threadMetadata.icon.classList.remove(...Array.from(templateData.threadMetadata.icon.classList.values())
            .filter(value => value.startsWith('codicon')));
        templateData.threadMetadata.icon.classList.add(...ThemeIcon.asClassNameArray(this.getIcon(node.element.threadState)));
        if (node.element.threadState !== undefined) {
            const color = this.getCommentThreadWidgetStateColor(node.element.threadState, this.themeService.getColorTheme());
            templateData.threadMetadata.icon.style.setProperty(commentViewThreadStateColorVar, `${color}`);
            templateData.threadMetadata.icon.style.color = `var(${commentViewThreadStateColorVar})`;
        }
        templateData.threadMetadata.userNames.textContent = node.element.comment.userName;
        templateData.threadMetadata.timestamp.setTimestamp(node.element.comment.timestamp ? new Date(node.element.comment.timestamp) : undefined);
        const originalComment = node.element;
        templateData.threadMetadata.commentPreview.innerText = '';
        templateData.threadMetadata.commentPreview.style.height = '22px';
        if (typeof originalComment.comment.body === 'string') {
            templateData.threadMetadata.commentPreview.innerText = originalComment.comment.body;
        }
        else {
            const disposables = new DisposableStore();
            templateData.disposables.push(disposables);
            const renderedComment = this.getRenderedComment(originalComment.comment.body, disposables);
            templateData.disposables.push(renderedComment);
            for (let i = renderedComment.element.children.length - 1; i >= 1; i--) {
                renderedComment.element.removeChild(renderedComment.element.children[i]);
            }
            templateData.threadMetadata.commentPreview.appendChild(renderedComment.element);
            templateData.disposables.push(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), templateData.threadMetadata.commentPreview, renderedComment.element.textContent ?? ''));
        }
        if (node.element.range) {
            if (node.element.range.startLineNumber === node.element.range.endLineNumber) {
                templateData.threadMetadata.range.textContent = nls.localize('commentLine', "[Ln {0}]", node.element.range.startLineNumber);
            }
            else {
                templateData.threadMetadata.range.textContent = nls.localize('commentRange', "[Ln {0}-{1}]", node.element.range.startLineNumber, node.element.range.endLineNumber);
            }
        }
        const menuActions = this.menus.getResourceActions(node.element);
        templateData.actionBar.push(menuActions.actions, { icon: true, label: false });
        templateData.actionBar.context = {
            commentControlHandle: node.element.controllerHandle,
            commentThreadHandle: node.element.threadHandle,
            $mid: 7 /* MarshalledId.CommentThread */
        };
        if (!node.element.hasReply()) {
            templateData.repliesMetadata.container.style.display = 'none';
            return;
        }
        templateData.repliesMetadata.container.style.display = '';
        templateData.repliesMetadata.count.textContent = this.getCountString(commentCount);
        const lastComment = node.element.replies[node.element.replies.length - 1].comment;
        templateData.repliesMetadata.lastReplyDetail.textContent = nls.localize('lastReplyFrom', "Last reply from {0}", lastComment.userName);
        templateData.repliesMetadata.timestamp.setTimestamp(lastComment.timestamp ? new Date(lastComment.timestamp) : undefined);
    }
    getCommentThreadWidgetStateColor(state, theme) {
        return (state !== undefined) ? getCommentThreadStateIconColor(state, theme) : undefined;
    }
    disposeTemplate(templateData) {
        templateData.disposables.forEach(disposeable => disposeable.dispose());
        templateData.actionBar.dispose();
    }
};
CommentNodeRenderer = __decorate([
    __param(2, IOpenerService),
    __param(3, IConfigurationService),
    __param(4, IHoverService),
    __param(5, IThemeService)
], CommentNodeRenderer);
export { CommentNodeRenderer };
var FilterDataType;
(function (FilterDataType) {
    FilterDataType[FilterDataType["Resource"] = 0] = "Resource";
    FilterDataType[FilterDataType["Comment"] = 1] = "Comment";
})(FilterDataType || (FilterDataType = {}));
export class Filter {
    constructor(options) {
        this.options = options;
    }
    filter(element, parentVisibility) {
        if (this.options.filter === '' && this.options.showResolved && this.options.showUnresolved) {
            return 1 /* TreeVisibility.Visible */;
        }
        if (element instanceof ResourceWithCommentThreads) {
            return this.filterResourceMarkers(element);
        }
        else {
            return this.filterCommentNode(element, parentVisibility);
        }
    }
    filterResourceMarkers(resourceMarkers) {
        // Filter by text. Do not apply negated filters on resources instead use exclude patterns
        if (this.options.textFilter.text && !this.options.textFilter.negate) {
            const uriMatches = FilterOptions._filter(this.options.textFilter.text, basename(resourceMarkers.resource));
            if (uriMatches) {
                return { visibility: true, data: { type: 0 /* FilterDataType.Resource */, uriMatches: uriMatches || [] } };
            }
        }
        return 2 /* TreeVisibility.Recurse */;
    }
    filterCommentNode(comment, parentVisibility) {
        const matchesResolvedState = (comment.threadState === undefined) || (this.options.showResolved && CommentThreadState.Resolved === comment.threadState) ||
            (this.options.showUnresolved && CommentThreadState.Unresolved === comment.threadState);
        if (!matchesResolvedState) {
            return false;
        }
        if (!this.options.textFilter.text) {
            return true;
        }
        const textMatches = 
        // Check body of comment for value
        FilterOptions._messageFilter(this.options.textFilter.text, typeof comment.comment.body === 'string' ? comment.comment.body : comment.comment.body.value)
            // Check first user for value
            || FilterOptions._messageFilter(this.options.textFilter.text, comment.comment.userName)
            // Check all replies for value
            || comment.replies.map(reply => {
                // Check user for value
                return FilterOptions._messageFilter(this.options.textFilter.text, reply.comment.userName)
                    // Check body of reply for value
                    || FilterOptions._messageFilter(this.options.textFilter.text, typeof reply.comment.body === 'string' ? reply.comment.body : reply.comment.body.value);
            }).filter(value => !!value).flat();
        // Matched and not negated
        if (textMatches.length && !this.options.textFilter.negate) {
            return { visibility: true, data: { type: 1 /* FilterDataType.Comment */, textMatches } };
        }
        // Matched and negated - exclude it only if parent visibility is not set
        if (textMatches.length && this.options.textFilter.negate && parentVisibility === 2 /* TreeVisibility.Recurse */) {
            return false;
        }
        // Not matched and negated - include it only if parent visibility is not set
        if ((textMatches.length === 0) && this.options.textFilter.negate && parentVisibility === 2 /* TreeVisibility.Recurse */) {
            return true;
        }
        return parentVisibility;
    }
}
let CommentsList = class CommentsList extends WorkbenchObjectTree {
    constructor(labels, container, options, contextKeyService, listService, instantiationService, configurationService, contextMenuService, keybindingService) {
        const delegate = new CommentsModelVirtualDelegate();
        const actionViewItemProvider = createActionViewItem.bind(undefined, instantiationService);
        const menus = instantiationService.createInstance(CommentsMenus);
        menus.setContextKeyService(contextKeyService);
        const renderers = [
            instantiationService.createInstance(ResourceWithCommentsRenderer, labels),
            instantiationService.createInstance(CommentNodeRenderer, actionViewItemProvider, menus)
        ];
        super('CommentsTree', container, delegate, renderers, {
            accessibilityProvider: options.accessibilityProvider,
            identityProvider: {
                getId: (element) => {
                    if (element instanceof CommentsModel) {
                        return 'root';
                    }
                    if (element instanceof ResourceWithCommentThreads) {
                        return `${element.uniqueOwner}-${element.id}`;
                    }
                    if (element instanceof CommentNode) {
                        return `${element.uniqueOwner}-${element.resource.toString()}-${element.threadId}-${element.comment.uniqueIdInThread}` + (element.isRoot ? '-root' : '');
                    }
                    return '';
                }
            },
            expandOnlyOnTwistieClick: true,
            collapseByDefault: false,
            overrideStyles: options.overrideStyles,
            filter: options.filter,
            sorter: options.sorter,
            findWidgetEnabled: false,
            multipleSelectionSupport: false,
        }, instantiationService, contextKeyService, listService, configurationService);
        this.contextMenuService = contextMenuService;
        this.keybindingService = keybindingService;
        this.menus = menus;
        this.disposables.add(this.onContextMenu(e => this.commentsOnContextMenu(e)));
    }
    commentsOnContextMenu(treeEvent) {
        const node = treeEvent.element;
        if (!(node instanceof CommentNode)) {
            return;
        }
        const event = treeEvent.browserEvent;
        event.preventDefault();
        event.stopPropagation();
        this.setFocus([node]);
        const actions = this.menus.getResourceContextActions(node);
        if (!actions.length) {
            return;
        }
        this.contextMenuService.showContextMenu({
            getAnchor: () => treeEvent.anchor,
            getActions: () => actions,
            getActionViewItem: (action) => {
                const keybinding = this.keybindingService.lookupKeybinding(action.id);
                if (keybinding) {
                    return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
                }
                return undefined;
            },
            onHide: (wasCancelled) => {
                if (wasCancelled) {
                    this.domFocus();
                }
            },
            getActionsContext: () => ({
                commentControlHandle: node.controllerHandle,
                commentThreadHandle: node.threadHandle,
                $mid: 7 /* MarshalledId.CommentThread */,
                thread: node.thread
            })
        });
    }
    filterComments() {
        this.refilter();
    }
    getVisibleItemCount() {
        let filtered = 0;
        const root = this.getNode();
        for (const resourceNode of root.children) {
            for (const commentNode of resourceNode.children) {
                if (commentNode.visible && resourceNode.visible) {
                    filtered++;
                }
            }
        }
        return filtered;
    }
};
CommentsList = __decorate([
    __param(3, IContextKeyService),
    __param(4, IListService),
    __param(5, IInstantiationService),
    __param(6, IConfigurationService),
    __param(7, IContextMenuService),
    __param(8, IKeybindingService)
], CommentsList);
export { CommentsList };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudHNUcmVlVmlld2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRzVHJlZVZpZXdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBZSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNwRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFOUUsT0FBTyxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBR3BGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxZQUFZLEVBQWtDLG1CQUFtQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDckksT0FBTyxFQUFlLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRWpFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSw4QkFBOEIsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3BHLE9B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