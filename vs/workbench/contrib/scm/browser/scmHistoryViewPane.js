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
var HistoryItemRenderer_1, HistoryItemChangeRenderer_1, HistoryItemLoadMoreRenderer_1;
import './media/scm.css';
import { $, append, h, reset } from '../../../../base/browser/dom.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { createMatches } from '../../../../base/common/filters.js';
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, autorunWithStore, derived, observableValue, waitForState, constObservable, latestChangedValue, observableFromEvent, runOnChange, observableSignal } from '../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService, WorkbenchHoverDelegate } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchCompressibleAsyncDataTree } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { asCssVariable, foreground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewAction, ViewPane, ViewPaneShowActions } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { renderSCMHistoryItemGraph, toISCMHistoryItemViewModelArray, SWIMLANE_WIDTH, renderSCMHistoryGraphPlaceholder, historyItemHoverLabelForeground, historyItemHoverDefaultLabelBackground, getHistoryItemIndex } from './scmHistory.js';
import { getHistoryItemEditorTitle, getHistoryItemHoverContent, getProviderKey, isSCMHistoryItemChangeNode, isSCMHistoryItemChangeViewModelTreeElement, isSCMHistoryItemLoadMoreTreeElement, isSCMHistoryItemViewModelTreeElement, isSCMRepository } from './util.js';
import { HISTORY_VIEW_PANE_ID, ISCMService, ISCMViewService } from '../common/scm.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { Action2, IMenuService, isIMenuItem, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Sequencer, Throttler } from '../../../../base/common/async.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ActionRunner } from '../../../../base/common/actions.js';
import { delta, groupBy } from '../../../../base/common/arrays.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { ContextKeys } from './scmViewPane.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Event } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { clamp } from '../../../../base/common/numbers.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { compare } from '../../../../base/common/strings.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { groupBy as groupBy2 } from '../../../../base/common/collections.js';
import { getActionBarActions, getFlatContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { ResourceLabels } from '../../../browser/labels.js';
import { FileKind } from '../../../../platform/files/common/files.js';
import { WorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { basename } from '../../../../base/common/path.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ScmHistoryItemResolver } from '../../multiDiffEditor/browser/scmMultiDiffSourceResolver.js';
import { ResourceTree } from '../../../../base/common/resourceTree.js';
import { URI } from '../../../../base/common/uri.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
const PICK_REPOSITORY_ACTION_ID = 'workbench.scm.action.graph.pickRepository';
const PICK_HISTORY_ITEM_REFS_ACTION_ID = 'workbench.scm.action.graph.pickHistoryItemRefs';
class SCMRepositoryActionViewItem extends ActionViewItem {
    constructor(_repository, action, options) {
        super(null, action, { ...options, icon: false, label: true });
        this._repository = _repository;
    }
    updateLabel() {
        if (this.options.label && this.label) {
            this.label.classList.add('scm-graph-repository-picker');
            const icon = $('.icon');
            icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.repo));
            const name = $('.name');
            name.textContent = this._repository.provider.name;
            reset(this.label, icon, name);
        }
    }
    getTooltip() {
        return this._repository.provider.name;
    }
}
class SCMHistoryItemRefsActionViewItem extends ActionViewItem {
    constructor(_repository, _historyItemsFilter, action, options) {
        super(null, action, { ...options, icon: false, label: true });
        this._repository = _repository;
        this._historyItemsFilter = _historyItemsFilter;
    }
    updateLabel() {
        if (this.options.label && this.label) {
            this.label.classList.add('scm-graph-history-item-picker');
            const icon = $('.icon');
            icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.gitBranch));
            const name = $('.name');
            if (this._historyItemsFilter === 'all') {
                name.textContent = localize('all', "All");
            }
            else if (this._historyItemsFilter === 'auto') {
                name.textContent = localize('auto', "Auto");
            }
            else if (this._historyItemsFilter.length === 1) {
                name.textContent = this._historyItemsFilter[0].name;
            }
            else {
                name.textContent = localize('items', "{0} Items", this._historyItemsFilter.length);
            }
            reset(this.label, icon, name);
        }
    }
    getTooltip() {
        if (this._historyItemsFilter === 'all') {
            return localize('allHistoryItemRefs', "All history item references");
        }
        else if (this._historyItemsFilter === 'auto') {
            const historyProvider = this._repository.provider.historyProvider.get();
            return [
                historyProvider?.historyItemRef.get()?.name,
                historyProvider?.historyItemRemoteRef.get()?.name,
                historyProvider?.historyItemBaseRef.get()?.name
            ].filter(ref => !!ref).join(', ');
        }
        else if (this._historyItemsFilter.length === 1) {
            return this._historyItemsFilter[0].name;
        }
        else {
            return this._historyItemsFilter.map(ref => ref.name).join(', ');
        }
    }
}
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: PICK_REPOSITORY_ACTION_ID,
            title: localize('repositoryPicker', "Repository Picker"),
            viewId: HISTORY_VIEW_PANE_ID,
            f1: false,
            menu: {
                id: MenuId.SCMHistoryTitle,
                when: ContextKeyExpr.and(ContextKeyExpr.has('scm.providerCount'), ContextKeyExpr.greater('scm.providerCount', 1)),
                group: 'navigation',
                order: 0
            }
        });
    }
    async runInView(_, view) {
        view.pickRepository();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: PICK_HISTORY_ITEM_REFS_ACTION_ID,
            title: localize('referencePicker', "History Item Reference Picker"),
            icon: Codicon.gitBranch,
            viewId: HISTORY_VIEW_PANE_ID,
            precondition: ContextKeys.SCMHistoryItemCount.notEqualsTo(0),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryTitle,
                group: 'navigation',
                order: 1
            }
        });
    }
    async runInView(_, view) {
        view.pickHistoryItemRef();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.revealCurrentHistoryItem',
            title: localize('goToCurrentHistoryItem', "Go to Current History Item"),
            icon: Codicon.target,
            viewId: HISTORY_VIEW_PANE_ID,
            precondition: ContextKeyExpr.and(ContextKeys.SCMHistoryItemCount.notEqualsTo(0), ContextKeys.SCMCurrentHistoryItemRefInFilter.isEqualTo(true)),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryTitle,
                group: 'navigation',
                order: 2
            }
        });
    }
    async runInView(_, view) {
        view.revealCurrentHistoryItem();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.refresh',
            title: localize('refreshGraph', "Refresh"),
            viewId: HISTORY_VIEW_PANE_ID,
            f1: false,
            icon: Codicon.refresh,
            menu: {
                id: MenuId.SCMHistoryTitle,
                group: 'navigation',
                order: 1000
            }
        });
    }
    async runInView(_, view) {
        view.refresh();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.setListViewMode',
            title: localize('setListViewMode', "View as List"),
            viewId: HISTORY_VIEW_PANE_ID,
            toggled: ContextKeys.SCMHistoryViewMode.isEqualTo("list" /* ViewMode.List */),
            menu: { id: MenuId.SCMHistoryTitle, group: '9_viewmode', order: 1 },
            f1: false
        });
    }
    async runInView(_, view) {
        view.setViewMode("list" /* ViewMode.List */);
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.setTreeViewMode',
            title: localize('setTreeViewMode', "View as Tree"),
            viewId: HISTORY_VIEW_PANE_ID,
            toggled: ContextKeys.SCMHistoryViewMode.isEqualTo("tree" /* ViewMode.Tree */),
            menu: { id: MenuId.SCMHistoryTitle, group: '9_viewmode', order: 2 },
            f1: false
        });
    }
    async runInView(_, view) {
        view.setViewMode("tree" /* ViewMode.Tree */);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.viewChanges',
            title: localize('openChanges', "Open Changes"),
            icon: Codicon.diffMultiple,
            f1: false,
            menu: [
                {
                    id: MenuId.SCMHistoryItemContext,
                    when: ContextKeyExpr.equals('config.multiDiffEditor.experimental.enabled', true),
                    group: 'inline',
                    order: 1
                },
                {
                    id: MenuId.SCMHistoryItemContext,
                    when: ContextKeyExpr.equals('config.multiDiffEditor.experimental.enabled', true),
                    group: '0_view',
                    order: 1
                }
            ]
        });
    }
    async run(accessor, provider, ...historyItems) {
        const commandService = accessor.get(ICommandService);
        if (!provider || historyItems.length === 0) {
            return;
        }
        const historyItem = historyItems[0];
        const historyItemLast = historyItems[historyItems.length - 1];
        const historyProvider = provider.historyProvider.get();
        if (historyItems.length > 1) {
            const ancestor = await historyProvider?.resolveHistoryItemRefsCommonAncestor([historyItem.id, historyItemLast.id]);
            if (!ancestor || (ancestor !== historyItem.id && ancestor !== historyItemLast.id)) {
                return;
            }
        }
        const title = historyItems.length === 1 ?
            getHistoryItemEditorTitle(historyItem) :
            localize('historyItemChangesEditorTitle', "All Changes ({0} ↔ {1})", historyItemLast.displayId ?? historyItemLast.id, historyItem.displayId ?? historyItem.id);
        const multiDiffSourceUri = ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItem);
        commandService.executeCommand('_workbench.openMultiDiffEditor', { title, multiDiffSourceUri });
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.openFile',
            title: localize('openFile', "Open File"),
            icon: Codicon.goToFile,
            f1: false,
            menu: [
                {
                    id: MenuId.SCMHistoryItemChangeContext,
                    group: 'inline',
                    order: 1
                },
            ]
        });
    }
    async run(accessor, historyItem, historyItemChange) {
        const editorService = accessor.get(IEditorService);
        if (!historyItem || !historyItemChange.modifiedUri) {
            return;
        }
        await editorService.openEditor({
            resource: historyItemChange.modifiedUri,
            label: `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItem.displayId ?? historyItem.id})`,
        });
    }
});
class ListDelegate {
    getHeight() {
        return 22;
    }
    getTemplateId(element) {
        if (isSCMHistoryItemViewModelTreeElement(element)) {
            return HistoryItemRenderer.TEMPLATE_ID;
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(element) || isSCMHistoryItemChangeNode(element)) {
            return HistoryItemChangeRenderer.TEMPLATE_ID;
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
            return HistoryItemLoadMoreRenderer.TEMPLATE_ID;
        }
        else {
            throw new Error('Unknown element');
        }
    }
}
let HistoryItemRenderer = class HistoryItemRenderer {
    static { HistoryItemRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'history-item'; }
    get templateId() { return HistoryItemRenderer_1.TEMPLATE_ID; }
    constructor(hoverDelegate, _clipboardService, _commandService, _configurationService, _contextKeyService, _contextMenuService, _hoverService, _keybindingService, _menuService, _telemetryService, _themeService) {
        this.hoverDelegate = hoverDelegate;
        this._clipboardService = _clipboardService;
        this._commandService = _commandService;
        this._configurationService = _configurationService;
        this._contextKeyService = _contextKeyService;
        this._contextMenuService = _contextMenuService;
        this._hoverService = _hoverService;
        this._keybindingService = _keybindingService;
        this._menuService = _menuService;
        this._telemetryService = _telemetryService;
        this._themeService = _themeService;
        this._badgesConfig = observableConfigValue('scm.graph.badges', 'filter', this._configurationService);
    }
    renderTemplate(container) {
        // hack
        container.parentElement.parentElement.querySelector('.monaco-tl-twistie').classList.add('force-no-twistie');
        const element = append(container, $('.history-item'));
        const graphContainer = append(element, $('.graph-container'));
        const iconLabel = new IconLabel(element, {
            supportIcons: true, supportHighlights: true, supportDescriptionHighlights: true
        });
        const labelContainer = append(element, $('.label-container'));
        const actionsContainer = append(element, $('.actions'));
        const actionBar = new WorkbenchToolBar(actionsContainer, undefined, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
        return { element, graphContainer, label: iconLabel, labelContainer, actionBar, elementDisposables: new DisposableStore(), disposables: combinedDisposable(iconLabel, actionBar) };
    }
    renderElement(node, index, templateData) {
        const provider = node.element.repository.provider;
        const historyItemViewModel = node.element.historyItemViewModel;
        const historyItem = historyItemViewModel.historyItem;
        const historyItemHover = this._hoverService.setupManagedHover(this.hoverDelegate, templateData.element, getHistoryItemHoverContent(this._themeService, historyItem), {
            actions: this._getHoverActions(provider, historyItem),
        });
        templateData.elementDisposables.add(historyItemHover);
        templateData.graphContainer.textContent = '';
        templateData.graphContainer.classList.toggle('current', historyItemViewModel.isCurrent);
        templateData.graphContainer.appendChild(renderSCMHistoryItemGraph(historyItemViewModel));
        const historyItemRef = provider.historyProvider.get()?.historyItemRef?.get();
        const extraClasses = historyItemRef?.revision === historyItem.id ? ['history-item-current'] : [];
        const [matches, descriptionMatches] = this._processMatches(historyItemViewModel, node.filterData);
        templateData.label.setLabel(historyItem.subject, historyItem.author, { matches, descriptionMatches, extraClasses });
        this._renderBadges(historyItem, templateData);
        const actions = this._menuService.getMenuActions(MenuId.SCMHistoryItemContext, this._contextKeyService, { arg: provider, shouldForwardArgs: true });
        templateData.actionBar.context = historyItem;
        templateData.actionBar.setActions(getActionBarActions(actions, 'inline').primary);
    }
    renderCompressedElements(node, index, templateData) {
        throw new Error('Should never happen since node is incompressible');
    }
    _renderBadges(historyItem, templateData) {
        templateData.elementDisposables.add(autorun(reader => {
            const labelConfig = this._badgesConfig.read(reader);
            templateData.labelContainer.textContent = '';
            const references = historyItem.references ?
                historyItem.references.slice(0) : [];
            // If the first reference is colored, we render it
            // separately since we have to show the description
            // for the first colored reference.
            if (references.length > 0 && references[0].color) {
                this._renderBadge([references[0]], true, templateData);
                // Remove the rendered reference from the collection
                references.splice(0, 1);
            }
            // Group history item references by color
            const historyItemRefsByColor = groupBy2(references, ref => ref.color ? ref.color : '');
            for (const [key, historyItemRefs] of Object.entries(historyItemRefsByColor)) {
                // If needed skip badges without a color
                if (key === '' && labelConfig !== 'all') {
                    continue;
                }
                // Group history item references by icon
                const historyItemRefByIconId = groupBy2(historyItemRefs, ref => ThemeIcon.isThemeIcon(ref.icon) ? ref.icon.id : '');
                for (const [key, historyItemRefs] of Object.entries(historyItemRefByIconId)) {
                    // Skip badges without an icon
                    if (key === '') {
                        continue;
                    }
                    this._renderBadge(historyItemRefs, false, templateData);
                }
            }
        }));
    }
    _renderBadge(historyItemRefs, showDescription, templateData) {
        if (historyItemRefs.length === 0 || !ThemeIcon.isThemeIcon(historyItemRefs[0].icon)) {
            return;
        }
        const elements = h('div.label', {
            style: {
                color: historyItemRefs[0].color ? asCssVariable(historyItemHoverLabelForeground) : asCssVariable(foreground),
                backgroundColor: historyItemRefs[0].color ? asCssVariable(historyItemRefs[0].color) : asCssVariable(historyItemHoverDefaultLabelBackground)
            }
        }, [
            h('div.count@count', {
                style: {
                    display: historyItemRefs.length > 1 ? '' : 'none'
                }
            }),
            h('div.icon@icon'),
            h('div.description@description', {
                style: {
                    display: showDescription ? '' : 'none'
                }
            })
        ]);
        elements.count.textContent = historyItemRefs.length > 1 ? historyItemRefs.length.toString() : '';
        elements.icon.classList.add(...ThemeIcon.asClassNameArray(historyItemRefs[0].icon));
        elements.description.textContent = showDescription ? historyItemRefs[0].name : '';
        append(templateData.labelContainer, elements.root);
    }
    _getHoverActions(provider, historyItem) {
        const actions = this._menuService.getMenuActions(MenuId.SCMHistoryItemHover, this._contextKeyService, {
            arg: provider,
            shouldForwardArgs: true
        }).flatMap(item => item[1]);
        return [
            {
                commandId: 'workbench.scm.action.graph.copyHistoryItemId',
                iconClass: 'codicon.codicon-copy',
                label: historyItem.displayId ?? historyItem.id,
                run: () => this._clipboardService.writeText(historyItem.id)
            },
            ...actions.map(action => {
                const iconClass = ThemeIcon.isThemeIcon(action.item.icon)
                    ? ThemeIcon.asClassNameArray(action.item.icon).join('.')
                    : undefined;
                return {
                    commandId: action.id,
                    label: action.label,
                    iconClass,
                    run: () => action.run(historyItem)
                };
            })
        ];
    }
    _processMatches(historyItemViewModel, filterData) {
        if (!filterData) {
            return [undefined, undefined];
        }
        return [
            historyItemViewModel.historyItem.message === filterData.label ? createMatches(filterData.score) : undefined,
            historyItemViewModel.historyItem.author === filterData.label ? createMatches(filterData.score) : undefined
        ];
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
HistoryItemRenderer = HistoryItemRenderer_1 = __decorate([
    __param(1, IClipboardService),
    __param(2, ICommandService),
    __param(3, IConfigurationService),
    __param(4, IContextKeyService),
    __param(5, IContextMenuService),
    __param(6, IHoverService),
    __param(7, IKeybindingService),
    __param(8, IMenuService),
    __param(9, ITelemetryService),
    __param(10, IThemeService)
], HistoryItemRenderer);
let HistoryItemChangeRenderer = class HistoryItemChangeRenderer {
    static { HistoryItemChangeRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'history-item-change'; }
    get templateId() { return HistoryItemChangeRenderer_1.TEMPLATE_ID; }
    constructor(viewMode, resourceLabels, _commandService, _contextKeyService, _contextMenuService, _keybindingService, _labelService, _menuService, _telemetryService) {
        this.viewMode = viewMode;
        this.resourceLabels = resourceLabels;
        this._commandService = _commandService;
        this._contextKeyService = _contextKeyService;
        this._contextMenuService = _contextMenuService;
        this._keybindingService = _keybindingService;
        this._labelService = _labelService;
        this._menuService = _menuService;
        this._telemetryService = _telemetryService;
    }
    renderTemplate(container) {
        const rowElement = container.parentElement;
        const element = append(container, $('.history-item-change'));
        const graphPlaceholder = append(element, $('.graph-placeholder'));
        const labelContainer = append(element, $('.label-container'));
        const resourceLabel = this.resourceLabels.create(labelContainer, {
            supportDescriptionHighlights: true, supportHighlights: true
        });
        const disposables = new DisposableStore();
        const actionsContainer = append(resourceLabel.element, $('.actions'));
        const actionBar = new WorkbenchToolBar(actionsContainer, undefined, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
        disposables.add(actionBar);
        return { rowElement, element, graphPlaceholder, resourceLabel, actionBar, disposables };
    }
    renderElement(elementOrNode, index, templateData, details) {
        const historyItemViewModel = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.historyItemViewModel : elementOrNode.element.context.historyItemViewModel;
        const historyItemChange = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.historyItemChange : elementOrNode.element;
        const graphColumns = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.graphColumns : elementOrNode.element.context.historyItemViewModel.outputSwimlanes;
        this._renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns);
        const hidePath = this.viewMode() === "tree" /* ViewMode.Tree */;
        const fileKind = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? FileKind.FILE : FileKind.FOLDER;
        templateData.resourceLabel.setFile(historyItemChange.uri, { fileDecorations: { colors: false, badges: true }, fileKind, hidePath });
        if (fileKind === FileKind.FILE) {
            const actions = this._menuService.getMenuActions(MenuId.SCMHistoryItemChangeContext, this._contextKeyService, { arg: historyItemViewModel.historyItem, shouldForwardArgs: true });
            templateData.actionBar.context = historyItemChange;
            templateData.actionBar.setActions(getActionBarActions(actions, 'inline').primary);
        }
        else {
            templateData.actionBar.context = undefined;
            templateData.actionBar.setActions([]);
        }
    }
    renderCompressedElements(node, index, templateData, details) {
        const compressed = node.element;
        const historyItemViewModel = compressed.elements[0].context.historyItemViewModel;
        const graphColumns = compressed.elements[0].context.historyItemViewModel.outputSwimlanes;
        this._renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns);
        const label = compressed.elements.map(e => e.name);
        const folder = compressed.elements[compressed.elements.length - 1];
        templateData.resourceLabel.setResource({ resource: folder.uri, name: label }, {
            fileDecorations: { colors: false, badges: true },
            fileKind: FileKind.FOLDER,
            separator: this._labelService.getSeparator(folder.uri.scheme)
        });
        templateData.actionBar.context = undefined;
        templateData.actionBar.setActions([]);
    }
    _renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns) {
        const graphPlaceholderSvgWidth = SWIMLANE_WIDTH * (graphColumns.length + 1);
        const marginLeft = graphPlaceholderSvgWidth - 16 /* .monaco-tl-indent left */;
        templateData.rowElement.style.marginLeft = `${marginLeft}px`;
        templateData.graphPlaceholder.textContent = '';
        templateData.graphPlaceholder.style.left = `${-1 * marginLeft}px`;
        templateData.graphPlaceholder.style.width = `${graphPlaceholderSvgWidth}px`;
        templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(graphColumns, getHistoryItemIndex(historyItemViewModel)));
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
HistoryItemChangeRenderer = HistoryItemChangeRenderer_1 = __decorate([
    __param(2, ICommandService),
    __param(3, IContextKeyService),
    __param(4, IContextMenuService),
    __param(5, IKeybindingService),
    __param(6, ILabelService),
    __param(7, IMenuService),
    __param(8, ITelemetryService)
], HistoryItemChangeRenderer);
let HistoryItemLoadMoreRenderer = class HistoryItemLoadMoreRenderer {
    static { HistoryItemLoadMoreRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'historyItemLoadMore'; }
    get templateId() { return HistoryItemLoadMoreRenderer_1.TEMPLATE_ID; }
    constructor(_isLoadingMore, _loadMoreCallback, _configurationService) {
        this._isLoadingMore = _isLoadingMore;
        this._loadMoreCallback = _loadMoreCallback;
        this._configurationService = _configurationService;
    }
    renderTemplate(container) {
        // hack
        container.parentElement.parentElement.querySelector('.monaco-tl-twistie').classList.add('force-no-twistie');
        const element = append(container, $('.history-item-load-more'));
        const graphPlaceholder = append(element, $('.graph-placeholder'));
        const historyItemPlaceholderContainer = append(element, $('.history-item-placeholder'));
        const historyItemPlaceholderLabel = new IconLabel(historyItemPlaceholderContainer, { supportIcons: true });
        return { element, graphPlaceholder, historyItemPlaceholderContainer, historyItemPlaceholderLabel, elementDisposables: new DisposableStore(), disposables: historyItemPlaceholderLabel };
    }
    renderElement(element, index, templateData) {
        templateData.graphPlaceholder.textContent = '';
        templateData.graphPlaceholder.style.width = `${SWIMLANE_WIDTH * (element.element.graphColumns.length + 1)}px`;
        templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(element.element.graphColumns));
        const pageOnScroll = this._configurationService.getValue('scm.graph.pageOnScroll') === true;
        templateData.historyItemPlaceholderContainer.classList.toggle('shimmer', pageOnScroll);
        if (pageOnScroll) {
            templateData.historyItemPlaceholderLabel.setLabel('');
            this._loadMoreCallback();
        }
        else {
            templateData.elementDisposables.add(autorun(reader => {
                const isLoadingMore = this._isLoadingMore.read(reader);
                const icon = `$(${isLoadingMore ? 'loading~spin' : 'fold-down'})`;
                templateData.historyItemPlaceholderLabel.setLabel(localize('loadMore', "{0} Load More...", icon));
            }));
        }
    }
    renderCompressedElements(node, index, templateData) {
        throw new Error('Should never happen since node is incompressible');
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
HistoryItemLoadMoreRenderer = HistoryItemLoadMoreRenderer_1 = __decorate([
    __param(2, IConfigurationService)
], HistoryItemLoadMoreRenderer);
let HistoryItemHoverDelegate = class HistoryItemHoverDelegate extends WorkbenchHoverDelegate {
    constructor(_viewContainerLocation, layoutService, configurationService, hoverService) {
        super('element', { instantHover: true }, () => this.getHoverOptions(), configurationService, hoverService);
        this._viewContainerLocation = _viewContainerLocation;
        this.layoutService = layoutService;
    }
    getHoverOptions() {
        const sideBarPosition = this.layoutService.getSideBarPosition();
        let hoverPosition;
        if (this._viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */) {
            hoverPosition = sideBarPosition === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
        }
        else if (this._viewContainerLocation === 2 /* ViewContainerLocation.AuxiliaryBar */) {
            hoverPosition = sideBarPosition === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
        }
        else {
            hoverPosition = 1 /* HoverPosition.RIGHT */;
        }
        return { additionalClasses: ['history-item-hover'], position: { hoverPosition, forcePosition: true } };
    }
};
HistoryItemHoverDelegate = __decorate([
    __param(1, IWorkbenchLayoutService),
    __param(2, IConfigurationService),
    __param(3, IHoverService)
], HistoryItemHoverDelegate);
let SCMHistoryViewPaneActionRunner = class SCMHistoryViewPaneActionRunner extends ActionRunner {
    constructor(_progressService) {
        super();
        this._progressService = _progressService;
    }
    runAction(action, context) {
        return this._progressService.withProgress({ location: HISTORY_VIEW_PANE_ID }, async () => await super.runAction(action, context));
    }
};
SCMHistoryViewPaneActionRunner = __decorate([
    __param(0, IProgressService)
], SCMHistoryViewPaneActionRunner);
class SCMHistoryTreeAccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('scm history', "Source Control History");
    }
    getAriaLabel(element) {
        if (isSCMRepository(element)) {
            return `${element.provider.name} ${element.provider.label}`;
        }
        else if (isSCMHistoryItemViewModelTreeElement(element)) {
            const historyItem = element.historyItemViewModel.historyItem;
            return `${stripIcons(historyItem.message).trim()}${historyItem.author ? `, ${historyItem.author}` : ''}`;
        }
        else {
            return '';
        }
    }
}
class SCMHistoryTreeIdentityProvider {
    getId(element) {
        if (isSCMRepository(element)) {
            const provider = element.provider;
            return `repo:${provider.id}`;
        }
        else if (isSCMHistoryItemViewModelTreeElement(element)) {
            const provider = element.repository.provider;
            const historyItem = element.historyItemViewModel.historyItem;
            return `historyItem:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(',')}`;
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(element)) {
            const provider = element.repository.provider;
            const historyItem = element.historyItemViewModel.historyItem;
            return `historyItemChange:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(',')}/${element.historyItemChange.uri.fsPath}`;
        }
        else if (isSCMHistoryItemChangeNode(element)) {
            const provider = element.context.repository.provider;
            const historyItem = element.context.historyItemViewModel.historyItem;
            return `historyItemChangeFolder:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(',')}/${element.uri.fsPath}`;
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
            const provider = element.repository.provider;
            return `historyItemLoadMore:${provider.id}`;
        }
        else {
            throw new Error('Invalid tree element');
        }
    }
}
class SCMHistoryTreeKeyboardNavigationLabelProvider {
    getKeyboardNavigationLabel(element) {
        if (isSCMRepository(element)) {
            return undefined;
        }
        else if (isSCMHistoryItemViewModelTreeElement(element)) {
            // For a history item we want to match both the message and
            // the author. A match in the message takes precedence over
            // a match in the author.
            return [element.historyItemViewModel.historyItem.message, element.historyItemViewModel.historyItem.author];
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
            // We don't want to match the load more element
            return '';
        }
        else {
            throw new Error('Invalid tree element');
        }
    }
    getCompressedNodeKeyboardNavigationLabel(elements) {
        const folders = elements;
        return folders.map(e => e.name).join('/');
    }
}
class SCMHistoryTreeCompressionDelegate {
    isIncompressible(element) {
        if (ResourceTree.isResourceNode(element)) {
            return element.childrenCount === 0 || !element.parent || !element.parent.parent;
        }
        return true;
    }
}
class SCMHistoryTreeDataSource extends Disposable {
    constructor(viewMode) {
        super();
        this.viewMode = viewMode;
    }
    async getChildren(inputOrElement) {
        const children = [];
        if (inputOrElement instanceof SCMHistoryViewModel) {
            // History items
            const historyItems = await inputOrElement.getHistoryItems();
            children.push(...historyItems);
            // Load More element
            const repository = inputOrElement.repository.get();
            const lastHistoryItem = historyItems.at(-1);
            if (repository && lastHistoryItem && lastHistoryItem.historyItemViewModel.outputSwimlanes.length > 0) {
                children.push({
                    repository,
                    graphColumns: lastHistoryItem.historyItemViewModel.outputSwimlanes,
                    type: 'historyItemLoadMore'
                });
            }
        }
        else if (isSCMHistoryItemViewModelTreeElement(inputOrElement)) {
            // History item changes
            const historyItem = inputOrElement.historyItemViewModel.historyItem;
            const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : undefined;
            const historyProvider = inputOrElement.repository.provider.historyProvider.get();
            const historyItemChanges = await historyProvider?.provideHistoryItemChanges(historyItem.id, historyItemParentId) ?? [];
            if (this.viewMode() === "list" /* ViewMode.List */) {
                // List
                children.push(...historyItemChanges.map(change => ({
                    repository: inputOrElement.repository,
                    historyItemViewModel: inputOrElement.historyItemViewModel,
                    historyItemChange: change,
                    graphColumns: inputOrElement.historyItemViewModel.outputSwimlanes,
                    type: 'historyItemChangeViewModel'
                })));
            }
            else if (this.viewMode() === "tree" /* ViewMode.Tree */) {
                // Tree
                const rootUri = inputOrElement.repository.provider.rootUri ?? URI.file('/');
                const historyItemChangesTree = new ResourceTree(inputOrElement, rootUri);
                for (const change of historyItemChanges) {
                    historyItemChangesTree.add(change.uri, {
                        repository: inputOrElement.repository,
                        historyItemViewModel: inputOrElement.historyItemViewModel,
                        historyItemChange: change,
                        graphColumns: inputOrElement.historyItemViewModel.outputSwimlanes,
                        type: 'historyItemChangeViewModel'
                    });
                }
                for (const node of historyItemChangesTree.root.children) {
                    children.push(node.element ?? node);
                }
            }
        }
        else if (ResourceTree.isResourceNode(inputOrElement) && isSCMHistoryItemChangeNode(inputOrElement)) {
            // Tree
            for (const node of inputOrElement.children) {
                children.push(node.element && node.childrenCount === 0 ? node.element : node);
            }
        }
        return children;
    }
    hasChildren(inputOrElement) {
        return inputOrElement instanceof SCMHistoryViewModel ||
            isSCMHistoryItemViewModelTreeElement(inputOrElement) ||
            (isSCMHistoryItemChangeNode(inputOrElement) && inputOrElement.childrenCount > 0);
    }
}
let SCMHistoryViewModel = class SCMHistoryViewModel extends Disposable {
    constructor(_configurationService, _contextKeyService, _extensionService, _scmService, _scmViewService, _storageService) {
        super();
        this._configurationService = _configurationService;
        this._contextKeyService = _contextKeyService;
        this._extensionService = _extensionService;
        this._scmService = _scmService;
        this._scmViewService = _scmViewService;
        this._storageService = _storageService;
        this._selectedRepository = observableValue(this, 'auto');
        this.onDidChangeHistoryItemsFilter = observableSignal(this);
        this.isViewModelEmpty = observableValue(this, false);
        this._repositoryState = new Map();
        this._repositoryFilterState = new Map();
        this._repositoryFilterState = this._loadHistoryItemsFilterState();
        this.viewMode = observableValue(this, this._getViewMode());
        this._extensionService.onWillStop(this._saveHistoryItemsFilterState, this, this._store);
        this._storageService.onWillSaveState(this._saveHistoryItemsFilterState, this, this._store);
        this._scmHistoryItemCountCtx = ContextKeys.SCMHistoryItemCount.bindTo(this._contextKeyService);
        this._scmHistoryViewModeCtx = ContextKeys.SCMHistoryViewMode.bindTo(this._contextKeyService);
        this._scmHistoryViewModeCtx.set(this.viewMode.get());
        const firstRepository = this._scmService.repositoryCount > 0
            ? constObservable(Iterable.first(this._scmService.repositories))
            : observableFromEvent(this, Event.once(this._scmService.onDidAddRepository), repository => repository);
        const graphRepository = derived(reader => {
            const selectedRepository = this._selectedRepository.read(reader);
            if (selectedRepository !== 'auto') {
                return selectedRepository;
            }
            return this._scmViewService.activeRepository.read(reader);
        });
        this.repository = latestChangedValue(this, [firstRepository, graphRepository]);
        const closedRepository = observableFromEvent(this, this._scmService.onDidRemoveRepository, repository => repository);
        // Closed repository cleanup
        this._register(autorun(reader => {
            const repository = closedRepository.read(reader);
            if (!repository) {
                return;
            }
            if (this.repository.get() === repository) {
                this._selectedRepository.set(Iterable.first(this._scmService.repositories) ?? 'auto', undefined);
            }
            this._repositoryState.delete(repository);
        }));
    }
    clearRepositoryState() {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        this._repositoryState.delete(repository);
    }
    getHistoryItemsFilter() {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        const filterState = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? 'auto';
        if (filterState === 'all' || filterState === 'auto') {
            return filterState;
        }
        const repositoryState = this._repositoryState.get(repository);
        return repositoryState?.historyItemsFilter;
    }
    getCurrentHistoryItemTreeElement() {
        const repository = this.repository.get();
        if (!repository) {
            return undefined;
        }
        const state = this._repositoryState.get(repository);
        if (!state) {
            return undefined;
        }
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        return state.viewModels
            .find(viewModel => viewModel.historyItemViewModel.historyItem.id === historyItemRef?.revision);
    }
    loadMore(cursor) {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        const state = this._repositoryState.get(repository);
        if (!state) {
            return;
        }
        this._repositoryState.set(repository, { ...state, loadMore: cursor ?? true });
    }
    async getHistoryItems() {
        const repository = this.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        if (!repository || !historyProvider) {
            this._scmHistoryItemCountCtx.set(0);
            this.isViewModelEmpty.set(true, undefined);
            return [];
        }
        let state = this._repositoryState.get(repository);
        if (!state || state.loadMore !== false) {
            const historyItems = state?.viewModels
                .map(vm => vm.historyItemViewModel.historyItem) ?? [];
            const historyItemRefs = state?.historyItemsFilter ??
                await this._resolveHistoryItemFilter(repository, historyProvider);
            const limit = clamp(this._configurationService.getValue('scm.graph.pageSize'), 1, 1000);
            const historyItemRefIds = historyItemRefs.map(ref => ref.revision ?? ref.id);
            do {
                // Fetch the next page of history items
                historyItems.push(...(await historyProvider.provideHistoryItems({
                    historyItemRefs: historyItemRefIds, limit, skip: historyItems.length
                }) ?? []));
            } while (typeof state?.loadMore === 'string' && !historyItems.find(item => item.id === state?.loadMore));
            // Create the color map
            const colorMap = this._getGraphColorMap(historyItemRefs);
            const viewModels = toISCMHistoryItemViewModelArray(historyItems, colorMap, historyProvider.historyItemRef.get())
                .map(historyItemViewModel => ({
                repository,
                historyItemViewModel,
                type: 'historyItemViewModel'
            }));
            state = { historyItemsFilter: historyItemRefs, viewModels, loadMore: false };
            this._repositoryState.set(repository, state);
            this._scmHistoryItemCountCtx.set(viewModels.length);
            this.isViewModelEmpty.set(viewModels.length === 0, undefined);
        }
        return state.viewModels;
    }
    setRepository(repository) {
        this._selectedRepository.set(repository, undefined);
    }
    setHistoryItemsFilter(filter) {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        if (filter !== 'auto') {
            this._repositoryFilterState.set(getProviderKey(repository.provider), filter);
        }
        else {
            this._repositoryFilterState.delete(getProviderKey(repository.provider));
        }
        this._saveHistoryItemsFilterState();
        this.onDidChangeHistoryItemsFilter.trigger(undefined);
    }
    setViewMode(viewMode) {
        if (viewMode === this.viewMode.get()) {
            return;
        }
        this.viewMode.set(viewMode, undefined);
        this._scmHistoryViewModeCtx.set(viewMode);
        this._storageService.store('scm.graphView.viewMode', viewMode, 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
    }
    _getViewMode() {
        let mode = this._configurationService.getValue('scm.defaultViewMode') === 'list' ? "list" /* ViewMode.List */ : "tree" /* ViewMode.Tree */;
        const storageMode = this._storageService.get('scm.graphView.viewMode', 1 /* StorageScope.WORKSPACE */);
        if (typeof storageMode === 'string') {
            mode = storageMode;
        }
        return mode;
    }
    _getGraphColorMap(historyItemRefs) {
        const repository = this.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
        const historyItemBaseRef = historyProvider?.historyItemBaseRef.get();
        const colorMap = new Map();
        if (historyItemRef) {
            colorMap.set(historyItemRef.id, historyItemRef.color);
            if (historyItemRemoteRef) {
                colorMap.set(historyItemRemoteRef.id, historyItemRemoteRef.color);
            }
            if (historyItemBaseRef) {
                colorMap.set(historyItemBaseRef.id, historyItemBaseRef.color);
            }
        }
        // Add the remaining history item references to the color map
        // if not already present. These history item references will
        // be colored using the color of the history item to which they
        // point to.
        for (const ref of historyItemRefs) {
            if (!colorMap.has(ref.id)) {
                colorMap.set(ref.id, undefined);
            }
        }
        return colorMap;
    }
    async _resolveHistoryItemFilter(repository, historyProvider) {
        const historyItemRefs = [];
        const historyItemsFilter = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? 'auto';
        switch (historyItemsFilter) {
            case 'all':
                historyItemRefs.push(...(await historyProvider.provideHistoryItemRefs() ?? []));
                break;
            case 'auto':
                historyItemRefs.push(...[
                    historyProvider.historyItemRef.get(),
                    historyProvider.historyItemRemoteRef.get(),
                    historyProvider.historyItemBaseRef.get(),
                ].filter(ref => !!ref));
                break;
            default: {
                // Get the latest revisions for the history items references in the filer
                const refs = (await historyProvider.provideHistoryItemRefs(historyItemsFilter) ?? [])
                    .filter(ref => historyItemsFilter.some(filter => filter === ref.id));
                if (refs.length === 0) {
                    // Reset the filter
                    historyItemRefs.push(...[
                        historyProvider.historyItemRef.get(),
                        historyProvider.historyItemRemoteRef.get(),
                        historyProvider.historyItemBaseRef.get(),
                    ].filter(ref => !!ref));
                    this._repositoryFilterState.delete(getProviderKey(repository.provider));
                }
                else {
                    // Update filter
                    historyItemRefs.push(...refs);
                    this._repositoryFilterState.set(getProviderKey(repository.provider), refs.map(ref => ref.id));
                }
                this._saveHistoryItemsFilterState();
                break;
            }
        }
        return historyItemRefs;
    }
    _loadHistoryItemsFilterState() {
        try {
            const filterData = this._storageService.get('scm.graphView.referencesFilter', 1 /* StorageScope.WORKSPACE */);
            if (filterData) {
                return new Map(JSON.parse(filterData));
            }
        }
        catch { }
        return new Map();
    }
    _saveHistoryItemsFilterState() {
        const filter = Array.from(this._repositoryFilterState.entries());
        this._storageService.store('scm.graphView.referencesFilter', JSON.stringify(filter), 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
    }
    dispose() {
        this._repositoryState.clear();
        super.dispose();
    }
};
SCMHistoryViewModel = __decorate([
    __param(0, IConfigurationService),
    __param(1, IContextKeyService),
    __param(2, IExtensionService),
    __param(3, ISCMService),
    __param(4, ISCMViewService),
    __param(5, IStorageService)
], SCMHistoryViewModel);
let RepositoryPicker = class RepositoryPicker {
    constructor(_quickInputService, _scmViewService) {
        this._quickInputService = _quickInputService;
        this._scmViewService = _scmViewService;
        this._autoQuickPickItem = {
            label: localize('auto', "Auto"),
            description: localize('activeRepository', "Show the source control graph for the active repository"),
            repository: 'auto'
        };
    }
    async pickRepository() {
        const picks = [
            this._autoQuickPickItem,
            { type: 'separator' }
        ];
        picks.push(...this._scmViewService.repositories.map(r => ({
            label: r.provider.name,
            description: r.provider.rootUri?.fsPath,
            iconClass: ThemeIcon.asClassName(Codicon.repo),
            repository: r
        })));
        return this._quickInputService.pick(picks, {
            placeHolder: localize('scmGraphRepository', "Select the repository to view, type to filter all repositories")
        });
    }
};
RepositoryPicker = __decorate([
    __param(0, IQuickInputService),
    __param(1, ISCMViewService)
], RepositoryPicker);
let HistoryItemRefPicker = class HistoryItemRefPicker extends Disposable {
    constructor(_historyProvider, _historyItemsFilter, _quickInputService) {
        super();
        this._historyProvider = _historyProvider;
        this._historyItemsFilter = _historyItemsFilter;
        this._quickInputService = _quickInputService;
        this._allQuickPickItem = {
            id: 'all',
            label: localize('all', "All"),
            description: localize('allHistoryItemRefs', "All history item references"),
            historyItemRef: 'all'
        };
        this._autoQuickPickItem = {
            id: 'auto',
            label: localize('auto', "Auto"),
            description: localize('currentHistoryItemRef', "Current history item reference(s)"),
            historyItemRef: 'auto'
        };
    }
    async pickHistoryItemRef() {
        const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
        this._store.add(quickPick);
        quickPick.placeholder = localize('scmGraphHistoryItemRef', "Select one/more history item references to view, type to filter");
        quickPick.canSelectMany = true;
        quickPick.hideCheckAll = true;
        quickPick.busy = true;
        quickPick.show();
        const items = await this._createQuickPickItems();
        // Set initial selection
        let selectedItems = [];
        if (this._historyItemsFilter === 'all') {
            selectedItems.push(this._allQuickPickItem);
        }
        else if (this._historyItemsFilter === 'auto') {
            selectedItems.push(this._autoQuickPickItem);
        }
        else {
            let index = 0;
            while (index < items.length) {
                if (items[index].type === 'separator') {
                    index++;
                    continue;
                }
                if (this._historyItemsFilter.some(ref => ref.id === items[index].id)) {
                    const item = items.splice(index, 1);
                    selectedItems.push(...item);
                }
                else {
                    index++;
                }
            }
            // Insert the selected items after `All` and `Auto`
            items.splice(2, 0, { type: 'separator' }, ...selectedItems);
        }
        quickPick.items = items;
        quickPick.selectedItems = selectedItems;
        quickPick.busy = false;
        return new Promise(resolve => {
            this._store.add(quickPick.onDidChangeSelection(items => {
                const { added } = delta(selectedItems, items, (a, b) => compare(a.id ?? '', b.id ?? ''));
                if (added.length > 0) {
                    if (added[0].historyItemRef === 'all' || added[0].historyItemRef === 'auto') {
                        quickPick.selectedItems = [added[0]];
                    }
                    else {
                        // Remove 'all' and 'auto' items if present
                        quickPick.selectedItems = [...quickPick.selectedItems
                                .filter(i => i.historyItemRef !== 'all' && i.historyItemRef !== 'auto')];
                    }
                }
                selectedItems = [...quickPick.selectedItems];
            }));
            this._store.add(quickPick.onDidAccept(() => {
                if (selectedItems.length === 0) {
                    resolve(undefined);
                }
                else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === 'all') {
                    resolve('all');
                }
                else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === 'auto') {
                    resolve('auto');
                }
                else {
                    resolve(selectedItems.map(item => item.historyItemRef.id));
                }
                quickPick.hide();
            }));
            this._store.add(quickPick.onDidHide(() => {
                resolve(undefined);
                this.dispose();
            }));
        });
    }
    async _createQuickPickItems() {
        const picks = [
            this._allQuickPickItem, this._autoQuickPickItem
        ];
        const historyItemRefs = await this._historyProvider.provideHistoryItemRefs() ?? [];
        const historyItemRefsByCategory = groupBy(historyItemRefs, (a, b) => compare(a.category ?? '', b.category ?? ''));
        for (const refs of historyItemRefsByCategory) {
            if (refs.length === 0) {
                continue;
            }
            picks.push({ type: 'separator', label: refs[0].category });
            picks.push(...refs.map(ref => {
                return {
                    id: ref.id,
                    label: ref.name,
                    description: ref.description,
                    iconClass: ThemeIcon.isThemeIcon(ref.icon) ?
                        ThemeIcon.asClassName(ref.icon) : undefined,
                    historyItemRef: ref
                };
            }));
        }
        return picks;
    }
};
HistoryItemRefPicker = __decorate([
    __param(2, IQuickInputService)
], HistoryItemRefPicker);
let SCMHistoryViewPane = class SCMHistoryViewPane extends ViewPane {
    constructor(options, _editorService, _instantiationService, _menuService, _progressService, configurationService, contextMenuService, keybindingService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, hoverService) {
        super({
            ...options,
            titleMenuId: MenuId.SCMHistoryTitle,
            showActions: ViewPaneShowActions.WhenExpanded
        }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this._editorService = _editorService;
        this._instantiationService = _instantiationService;
        this._menuService = _menuService;
        this._progressService = _progressService;
        this._repositoryIsLoadingMore = observableValue(this, false);
        this._repositoryOutdated = observableValue(this, false);
        this._visibilityDisposables = new DisposableStore();
        this._treeOperationSequencer = new Sequencer();
        this._treeLoadMoreSequencer = new Sequencer();
        this._updateChildrenThrottler = new Throttler();
        this._contextMenuDisposables = new MutableDisposable();
        this._scmProviderCtx = ContextKeys.SCMProvider.bindTo(this.scopedContextKeyService);
        this._scmCurrentHistoryItemRefHasRemote = ContextKeys.SCMCurrentHistoryItemRefHasRemote.bindTo(this.scopedContextKeyService);
        this._scmCurrentHistoryItemRefInFilter = ContextKeys.SCMCurrentHistoryItemRefInFilter.bindTo(this.scopedContextKeyService);
        this._actionRunner = this.instantiationService.createInstance(SCMHistoryViewPaneActionRunner);
        this._register(this._actionRunner);
        this._register(this._updateChildrenThrottler);
    }
    renderHeaderTitle(container) {
        super.renderHeaderTitle(container, this.title);
        const element = h('div.scm-graph-view-badge-container', [
            h('div.scm-graph-view-badge.monaco-count-badge.long@badge')
        ]);
        element.badge.textContent = 'Outdated';
        container.appendChild(element.root);
        this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element.root, {
            markdown: {
                value: localize('scmGraphViewOutdated', "Please refresh the graph using the refresh action ($(refresh))."),
                supportThemeIcons: true
            },
            markdownNotSupportedFallback: undefined
        }));
        this._register(autorun(reader => {
            const outdated = this._repositoryOutdated.read(reader);
            element.root.style.display = outdated ? '' : 'none';
        }));
    }
    renderBody(container) {
        super.renderBody(container);
        this._treeContainer = append(container, $('.scm-view.scm-history-view.show-file-icons'));
        this._treeContainer.classList.add('file-icon-themable-tree');
        this._createTree(this._treeContainer);
        this.onDidChangeBodyVisibility(async (visible) => {
            if (!visible) {
                this._visibilityDisposables.clear();
                return;
            }
            // Create view model
            this._treeViewModel = this.instantiationService.createInstance(SCMHistoryViewModel);
            this._visibilityDisposables.add(this._treeViewModel);
            // Wait for first repository to be initialized
            const firstRepositoryInitialized = derived(this, reader => {
                const repository = this._treeViewModel.repository.read(reader);
                const historyProvider = repository?.provider.historyProvider.read(reader);
                const historyItemRef = historyProvider?.historyItemRef.read(reader);
                return historyItemRef !== undefined ? true : undefined;
            });
            await waitForState(firstRepositoryInitialized);
            // Initial rendering
            await this._progressService.withProgress({ location: this.id }, async () => {
                await this._treeOperationSequencer.queue(async () => {
                    await this._tree.setInput(this._treeViewModel);
                    this._tree.scrollTop = 0;
                });
            });
            this._visibilityDisposables.add(autorun(reader => {
                this._treeViewModel.isViewModelEmpty.read(reader);
                this._onDidChangeViewWelcomeState.fire();
            }));
            // Repository change
            let isFirstRun = true;
            this._visibilityDisposables.add(autorunWithStore((reader, store) => {
                const repository = this._treeViewModel.repository.read(reader);
                const historyProvider = repository?.provider.historyProvider.read(reader);
                if (!repository || !historyProvider) {
                    return;
                }
                // HistoryItemId changed (checkout)
                const historyItemRefId = derived(reader => {
                    return historyProvider.historyItemRef.read(reader)?.id;
                });
                store.add(runOnChange(historyItemRefId, async (historyItemRefIdValue) => {
                    await this.refresh();
                    // Update context key (needs to be done after the refresh call)
                    this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefIdValue));
                }));
                // HistoryItemRefs changed
                store.add(runOnChange(historyProvider.historyItemRefChanges, changes => {
                    if (changes.silent) {
                        // The history item reference changes occurred in the background (ex: Auto Fetch)
                        // If tree is scrolled to the top, we can safely refresh the tree, otherwise we
                        // will show a visual cue that the view is outdated.
                        if (this._tree.scrollTop === 0) {
                            this.refresh();
                            return;
                        }
                        // Show the "Outdated" badge on the view
                        this._repositoryOutdated.set(true, undefined);
                        return;
                    }
                    this.refresh();
                }));
                // HistoryItemRefs filter changed
                store.add(runOnChange(this._treeViewModel.onDidChangeHistoryItemsFilter, async () => {
                    await this.refresh();
                    // Update context key (needs to be done after the refresh call)
                    this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.get()));
                }));
                // HistoryItemRemoteRef changed
                store.add(autorun(reader => {
                    this._scmCurrentHistoryItemRefHasRemote.set(!!historyProvider.historyItemRemoteRef.read(reader));
                }));
                // ViewMode changed
                store.add(runOnChange(this._treeViewModel.viewMode, async () => {
                    await this._updateChildren();
                }));
                // Update context
                this._scmProviderCtx.set(repository.provider.contextValue);
                this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.get()));
                // We skip refreshing the graph on the first execution of the autorun
                // since the graph for the first repository is rendered when the tree
                // input is set.
                if (!isFirstRun) {
                    this.refresh();
                }
                isFirstRun = false;
            }));
            // FileIconTheme & viewMode change
            const fileIconThemeObs = observableFromEvent(this.themeService.onDidFileIconThemeChange, () => this.themeService.getFileIconTheme());
            this._visibilityDisposables.add(autorun(reader => {
                const fileIconTheme = fileIconThemeObs.read(reader);
                const viewMode = this._treeViewModel.viewMode.read(reader);
                this._updateIndentStyles(fileIconTheme, viewMode);
            }));
        }, this, this._store);
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this._tree.layout(height, width);
    }
    getActionRunner() {
        return this._actionRunner;
    }
    getActionsContext() {
        return this._treeViewModel?.repository.get()?.provider;
    }
    createActionViewItem(action, options) {
        if (action.id === PICK_REPOSITORY_ACTION_ID) {
            const repository = this._treeViewModel?.repository.get();
            if (repository) {
                return new SCMRepositoryActionViewItem(repository, action, options);
            }
        }
        else if (action.id === PICK_HISTORY_ITEM_REFS_ACTION_ID) {
            const repository = this._treeViewModel?.repository.get();
            const historyItemsFilter = this._treeViewModel?.getHistoryItemsFilter();
            if (repository && historyItemsFilter) {
                return new SCMHistoryItemRefsActionViewItem(repository, historyItemsFilter, action, options);
            }
        }
        return super.createActionViewItem(action, options);
    }
    focus() {
        super.focus();
        const fakeKeyboardEvent = new KeyboardEvent('keydown');
        this._tree.focusFirst(fakeKeyboardEvent);
        this._tree.domFocus();
    }
    shouldShowWelcome() {
        return this._treeViewModel?.isViewModelEmpty.get() === true;
    }
    async refresh() {
        this._treeViewModel.clearRepositoryState();
        await this._updateChildren();
        this.updateActions();
        this._repositoryOutdated.set(false, undefined);
        this._tree.scrollTop = 0;
    }
    async pickRepository() {
        const picker = this._instantiationService.createInstance(RepositoryPicker);
        const result = await picker.pickRepository();
        if (result) {
            this._treeViewModel.setRepository(result.repository);
        }
    }
    async pickHistoryItemRef() {
        const repository = this._treeViewModel.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemsFilter = this._treeViewModel.getHistoryItemsFilter();
        if (!historyProvider || !historyItemsFilter) {
            return;
        }
        const picker = this._instantiationService.createInstance(HistoryItemRefPicker, historyProvider, historyItemsFilter);
        const result = await picker.pickHistoryItemRef();
        if (result) {
            this._treeViewModel.setHistoryItemsFilter(result);
        }
    }
    async revealCurrentHistoryItem() {
        const repository = this._treeViewModel.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        if (!repository || !historyItemRef?.id || !historyItemRef?.revision) {
            return;
        }
        if (!this._isCurrentHistoryItemInFilter(historyItemRef.id)) {
            return;
        }
        const revealTreeNode = () => {
            const historyItemTreeElement = this._treeViewModel.getCurrentHistoryItemTreeElement();
            if (historyItemTreeElement && this._tree.hasNode(historyItemTreeElement)) {
                this._tree.reveal(historyItemTreeElement, 0.5);
                this._tree.setSelection([historyItemTreeElement]);
                this._tree.setFocus([historyItemTreeElement]);
                return true;
            }
            return false;
        };
        if (revealTreeNode()) {
            return;
        }
        // Fetch current history item
        await this._loadMore(historyItemRef.revision);
        // Reveal node
        revealTreeNode();
    }
    setViewMode(viewMode) {
        this._treeViewModel.setViewMode(viewMode);
    }
    _createTree(container) {
        this._treeIdentityProvider = new SCMHistoryTreeIdentityProvider();
        const historyItemHoverDelegate = this.instantiationService.createInstance(HistoryItemHoverDelegate, this.viewDescriptorService.getViewLocationById(this.id));
        this._register(historyItemHoverDelegate);
        const resourceLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
        this._register(resourceLabels);
        this._treeDataSource = this.instantiationService.createInstance(SCMHistoryTreeDataSource, () => this._treeViewModel.viewMode.get());
        this._register(this._treeDataSource);
        const compressionEnabled = observableConfigValue('scm.compactFolders', true, this.configurationService);
        this._tree = this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, 'SCM History Tree', container, new ListDelegate(), new SCMHistoryTreeCompressionDelegate(), [
            this.instantiationService.createInstance(HistoryItemRenderer, historyItemHoverDelegate),
            this.instantiationService.createInstance(HistoryItemChangeRenderer, () => this._treeViewModel.viewMode.get(), resourceLabels),
            this.instantiationService.createInstance(HistoryItemLoadMoreRenderer, this._repositoryIsLoadingMore, () => this._loadMore()),
        ], this._treeDataSource, {
            accessibilityProvider: new SCMHistoryTreeAccessibilityProvider(),
            identityProvider: this._treeIdentityProvider,
            collapseByDefault: (e) => !isSCMHistoryItemChangeNode(e),
            compressionEnabled: compressionEnabled.get(),
            keyboardNavigationLabelProvider: new SCMHistoryTreeKeyboardNavigationLabelProvider(),
            horizontalScrolling: false,
            multipleSelectionSupport: false
        });
        this._register(this._tree);
        this._tree.onDidOpen(this._onDidOpen, this, this._store);
        this._tree.onContextMenu(this._onContextMenu, this, this._store);
    }
    _isCurrentHistoryItemInFilter(historyItemRefId) {
        if (!historyItemRefId) {
            return false;
        }
        const historyItemFilter = this._treeViewModel.getHistoryItemsFilter();
        if (historyItemFilter === 'all' || historyItemFilter === 'auto') {
            return true;
        }
        return Array.isArray(historyItemFilter) && !!historyItemFilter.find(ref => ref.id === historyItemRefId);
    }
    async _onDidOpen(e) {
        if (!e.element) {
            return;
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(e.element)) {
            const historyItemChange = e.element.historyItemChange;
            const historyItem = e.element.historyItemViewModel.historyItem;
            const historyItemDisplayId = historyItem.displayId ?? historyItem.id;
            const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : undefined;
            const historyItemParentDisplayId = historyItemParentId && historyItem.displayId
                ? historyItemParentId.substring(0, historyItem.displayId.length)
                : historyItemParentId;
            if (historyItemChange.originalUri && historyItemChange.modifiedUri) {
                // Diff Editor
                const originalUriTitle = `${basename(historyItemChange.originalUri.fsPath)} (${historyItemParentDisplayId})`;
                const modifiedUriTitle = `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItemDisplayId})`;
                const title = `${originalUriTitle} ↔ ${modifiedUriTitle}`;
                await this._editorService.openEditor({
                    label: title,
                    original: { resource: historyItemChange.originalUri },
                    modified: { resource: historyItemChange.modifiedUri },
                    options: e.editorOptions
                });
            }
            else if (historyItemChange.modifiedUri) {
                await this._editorService.openEditor({
                    label: `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItemDisplayId})`,
                    resource: historyItemChange.modifiedUri,
                    options: e.editorOptions
                });
            }
            else if (historyItemChange.originalUri) {
                // Editor (Deleted)
                await this._editorService.openEditor({
                    label: `${basename(historyItemChange.originalUri.fsPath)} (${historyItemParentDisplayId})`,
                    resource: historyItemChange.originalUri,
                    options: e.editorOptions
                });
            }
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(e.element)) {
            const pageOnScroll = this.configurationService.getValue('scm.graph.pageOnScroll') === true;
            if (!pageOnScroll) {
                this._loadMore();
                this._tree.setSelection([]);
            }
        }
    }
    _onContextMenu(e) {
        const element = e.element;
        if (!element || !isSCMHistoryItemViewModelTreeElement(element)) {
            return;
        }
        this._contextMenuDisposables.value = new DisposableStore();
        const historyItemRefMenuItems = MenuRegistry.getMenuItems(MenuId.SCMHistoryItemRefContext).filter(item => isIMenuItem(item));
        // If there are any history item references we have to add a submenu item for each orignal action,
        // and a menu item for each history item ref that matches the `when` clause of the original action.
        if (historyItemRefMenuItems.length > 0 && element.historyItemViewModel.historyItem.references?.length) {
            const historyItemRefActions = new Map();
            for (const ref of element.historyItemViewModel.historyItem.references) {
                const contextKeyService = this.scopedContextKeyService.createOverlay([
                    ['scmHistoryItemRef', ref.id]
                ]);
                const menuActions = this._menuService.getMenuActions(MenuId.SCMHistoryItemRefContext, contextKeyService);
                for (const action of menuActions.flatMap(a => a[1])) {
                    if (!historyItemRefActions.has(action.id)) {
                        historyItemRefActions.set(action.id, []);
                    }
                    historyItemRefActions.get(action.id).push(ref);
                }
            }
            // Register submenu, menu items
            for (const historyItemRefMenuItem of historyItemRefMenuItems) {
                const actionId = historyItemRefMenuItem.command.id;
                if (!historyItemRefActions.has(actionId)) {
                    continue;
                }
                // Register the submenu for the original action
                this._contextMenuDisposables.value.add(MenuRegistry.appendMenuItem(MenuId.SCMHistoryItemContext, {
                    title: historyItemRefMenuItem.command.title,
                    submenu: MenuId.for(actionId),
                    group: historyItemRefMenuItem?.group,
                    order: historyItemRefMenuItem?.order
                }));
                // Register the action for the history item ref
                for (const historyItemRef of historyItemRefActions.get(actionId) ?? []) {
                    this._contextMenuDisposables.value.add(registerAction2(class extends Action2 {
                        constructor() {
                            super({
                                id: `${actionId}.${historyItemRef.id}`,
                                title: historyItemRef.name,
                                menu: {
                                    id: MenuId.for(actionId),
                                    group: historyItemRef.category
                                }
                            });
                        }
                        run(accessor, ...args) {
                            const commandService = accessor.get(ICommandService);
                            commandService.executeCommand(actionId, ...args, historyItemRef.id);
                        }
                    }));
                }
            }
        }
        const historyItemMenuActions = this._menuService.getMenuActions(MenuId.SCMHistoryItemContext, this.scopedContextKeyService, {
            arg: element.repository.provider,
            shouldForwardArgs: true
        }).filter(group => group[0] !== 'inline');
        this.contextMenuService.showContextMenu({
            contextKeyService: this.scopedContextKeyService,
            getAnchor: () => e.anchor,
            getActions: () => getFlatContextMenuActions(historyItemMenuActions),
            getActionsContext: () => element.historyItemViewModel.historyItem
        });
    }
    async _loadMore(cursor) {
        return this._treeLoadMoreSequencer.queue(async () => {
            if (this._repositoryIsLoadingMore.get()) {
                return;
            }
            this._repositoryIsLoadingMore.set(true, undefined);
            this._treeViewModel.loadMore(cursor);
            await this._updateChildren();
            this._repositoryIsLoadingMore.set(false, undefined);
        });
    }
    _updateChildren() {
        return this._updateChildrenThrottler.queue(() => this._treeOperationSequencer.queue(async () => {
            await this._progressService.withProgress({ location: this.id, delay: 100 }, async () => {
                await this._tree.updateChildren(undefined, undefined, undefined, {
                // diffIdentityProvider: this._treeIdentityProvider
                });
            });
        }));
    }
    _updateIndentStyles(theme, viewMode) {
        this._treeContainer.classList.toggle('list-view-mode', viewMode === "list" /* ViewMode.List */);
        this._treeContainer.classList.toggle('tree-view-mode', viewMode === "tree" /* ViewMode.Tree */);
        this._treeContainer.classList.toggle('align-icons-and-twisties', (viewMode === "list" /* ViewMode.List */ && theme.hasFileIcons) || (theme.hasFileIcons && !theme.hasFolderIcons));
        this._treeContainer.classList.toggle('hide-arrows', viewMode === "tree" /* ViewMode.Tree */ && theme.hidesExplorerArrows === true);
    }
    dispose() {
        this._contextMenuDisposables.dispose();
        this._visibilityDisposables.dispose();
        super.dispose();
    }
};
SCMHistoryViewPane = __decorate([
    __param(1, IEditorService),
    __param(2, IInstantiationService),
    __param(3, IMenuService),
    __param(4, IProgressService),
    __param(5, IConfigurationService),
    __param(6, IContextMenuService),
    __param(7, IKeybindingService),
    __param(8, IInstantiationService),
    __param(9, IViewDescriptorService),
    __param(10, IContextKeyService),
    __param(11, IOpenerService),
    __param(12, IThemeService),
    __param(13, IHoverService)
], SCMHistoryViewPane);
export { SCMHistoryViewPane };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtSGlzdG9yeVZpZXdQYW5lLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9zY21IaXN0b3J5Vmlld1BhbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBR3RFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUkvRSxPQUFPLEVBQUUsYUFBYSxFQUFzQixNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkksT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQWUsZUFBZSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsbUJBQW1CLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUF1QixNQUFNLHVDQUF1QyxDQUFDO0FBQ3JQLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3ZILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxhQUFhLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNw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