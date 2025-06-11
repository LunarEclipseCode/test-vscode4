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
var SettingsEditor2_1;
import * as DOM from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import * as aria from '../../../../base/browser/ui/aria/aria.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Sizing, SplitView } from '../../../../base/browser/ui/splitview/splitview.js';
import { ToggleActionViewItem } from '../../../../base/browser/ui/toggle/toggle.js';
import { Action } from '../../../../base/common/actions.js';
import { Delayer, raceTimeout } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Color } from '../../../../base/common/color.js';
import { fromNow } from '../../../../base/common/date.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore, dispose, MutableDisposable } from '../../../../base/common/lifecycle.js';
import * as platform from '../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IExtensionGalleryService, IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IEditorProgressService } from '../../../../platform/progress/common/progress.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles, defaultToggleStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { asCssVariable, badgeBackground, badgeForeground, contrastBorder, editorForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUserDataSyncEnablementService, IUserDataSyncService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { registerNavigableContainer } from '../../../browser/actions/widgetNavigationCommands.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IAiSettingsSearchService } from '../../../services/aiSettingsSearch/common/aiSettingsSearch.js';
import { APPLICATION_SCOPES, IWorkbenchConfigurationService } from '../../../services/configuration/common/configuration.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IPreferencesService, SettingMatchType, SettingValueType, validateSettingsEditorOptions } from '../../../services/preferences/common/preferences.js';
import { nullRange, Settings2EditorModel } from '../../../services/preferences/common/preferencesModels.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IUserDataSyncWorkbenchService } from '../../../services/userDataSync/common/userDataSync.js';
import { SuggestEnabledInput } from '../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js';
import { CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS, CONTEXT_SETTINGS_SEARCH_FOCUS, CONTEXT_TOC_ROW_FOCUS, ENABLE_LANGUAGE_FILTER, EXTENSION_FETCH_TIMEOUT_MS, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, getExperimentalExtensionToggleData, ID_SETTING_TAG, IPreferencesSearchService, LANGUAGE_SETTING_TAG, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS, SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, WORKSPACE_TRUST_SETTING_TAG } from '../common/preferences.js';
import { settingsHeaderBorder, settingsSashBorder, settingsTextInputBorder } from '../common/settingsEditorColorRegistry.js';
import './media/settingsEditor2.css';
import { preferencesAiResultsIcon, preferencesClearInputIcon, preferencesFilterIcon } from './preferencesIcons.js';
import { SettingsTargetsWidget } from './preferencesWidgets.js';
import { getCommonlyUsedData, tocData } from './settingsLayout.js';
import { SettingsSearchFilterDropdownMenuActionViewItem } from './settingsSearchMenu.js';
import { AbstractSettingRenderer, createTocTreeForExtensionSettings, resolveConfiguredUntrustedSettings, resolveSettingsTree, SettingsTree, SettingTreeRenderers } from './settingsTree.js';
import { parseQuery, SearchResultModel, SettingsTreeGroupElement, SettingsTreeModel, SettingsTreeSettingElement } from './settingsTreeModels.js';
import { createTOCIterator, TOCTree, TOCTreeModel } from './tocTree.js';
export var SettingsFocusContext;
(function (SettingsFocusContext) {
    SettingsFocusContext[SettingsFocusContext["Search"] = 0] = "Search";
    SettingsFocusContext[SettingsFocusContext["TableOfContents"] = 1] = "TableOfContents";
    SettingsFocusContext[SettingsFocusContext["SettingTree"] = 2] = "SettingTree";
    SettingsFocusContext[SettingsFocusContext["SettingControl"] = 3] = "SettingControl";
})(SettingsFocusContext || (SettingsFocusContext = {}));
export function createGroupIterator(group) {
    return Iterable.map(group.children, g => {
        return {
            element: g,
            children: g instanceof SettingsTreeGroupElement ?
                createGroupIterator(g) :
                undefined
        };
    });
}
const $ = DOM.$;
const searchBoxLabel = localize('SearchSettings.AriaLabel', "Search settings");
const SEARCH_TOC_BEHAVIOR_KEY = 'workbench.settings.settingsSearchTocBehavior';
const SETTINGS_EDITOR_STATE_KEY = 'settingsEditorState';
let SettingsEditor2 = class SettingsEditor2 extends EditorPane {
    static { SettingsEditor2_1 = this; }
    static { this.ID = 'workbench.editor.settings2'; }
    static { this.NUM_INSTANCES = 0; }
    static { this.SEARCH_DEBOUNCE = 200; }
    static { this.SETTING_UPDATE_FAST_DEBOUNCE = 200; }
    static { this.SETTING_UPDATE_SLOW_DEBOUNCE = 1000; }
    static { this.CONFIG_SCHEMA_UPDATE_DELAYER = 500; }
    static { this.TOC_MIN_WIDTH = 100; }
    static { this.TOC_RESET_WIDTH = 200; }
    static { this.EDITOR_MIN_WIDTH = 500; }
    // Below NARROW_TOTAL_WIDTH, we only render the editor rather than the ToC.
    static { this.NARROW_TOTAL_WIDTH = this.TOC_RESET_WIDTH + this.EDITOR_MIN_WIDTH; }
    static { this.SUGGESTIONS = [
        `@${MODIFIED_SETTING_TAG}`,
        '@tag:notebookLayout',
        '@tag:notebookOutputLayout',
        `@tag:${REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG}`,
        `@tag:${WORKSPACE_TRUST_SETTING_TAG}`,
        '@tag:sync',
        '@tag:usesOnlineServices',
        '@tag:telemetry',
        '@tag:accessibility',
        '@tag:preview',
        '@tag:experimental',
        `@${ID_SETTING_TAG}`,
        `@${EXTENSION_SETTING_TAG}`,
        `@${FEATURE_SETTING_TAG}scm`,
        `@${FEATURE_SETTING_TAG}explorer`,
        `@${FEATURE_SETTING_TAG}search`,
        `@${FEATURE_SETTING_TAG}debug`,
        `@${FEATURE_SETTING_TAG}extensions`,
        `@${FEATURE_SETTING_TAG}terminal`,
        `@${FEATURE_SETTING_TAG}task`,
        `@${FEATURE_SETTING_TAG}problems`,
        `@${FEATURE_SETTING_TAG}output`,
        `@${FEATURE_SETTING_TAG}comments`,
        `@${FEATURE_SETTING_TAG}remote`,
        `@${FEATURE_SETTING_TAG}timeline`,
        `@${FEATURE_SETTING_TAG}notebook`,
        `@${POLICY_SETTING_TAG}`
    ]; }
    static shouldSettingUpdateFast(type) {
        if (Array.isArray(type)) {
            // nullable integer/number or complex
            return false;
        }
        return type === SettingValueType.Enum ||
            type === SettingValueType.Array ||
            type === SettingValueType.BooleanObject ||
            type === SettingValueType.Object ||
            type === SettingValueType.Complex ||
            type === SettingValueType.Boolean ||
            type === SettingValueType.Exclude ||
            type === SettingValueType.Include;
    }
    constructor(group, telemetryService, configurationService, textResourceConfigurationService, themeService, preferencesService, instantiationService, preferencesSearchService, logService, contextKeyService, storageService, editorGroupService, userDataSyncWorkbenchService, userDataSyncEnablementService, workspaceTrustManagementService, extensionService, languageService, extensionManagementService, productService, extensionGalleryService, editorProgressService, userDataProfileService, aiSettingsSearchService) {
        super(SettingsEditor2_1.ID, group, telemetryService, themeService, storageService);
        this.configurationService = configurationService;
        this.preferencesService = preferencesService;
        this.instantiationService = instantiationService;
        this.preferencesSearchService = preferencesSearchService;
        this.logService = logService;
        this.contextKeyService = contextKeyService;
        this.storageService = storageService;
        this.editorGroupService = editorGroupService;
        this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.workspaceTrustManagementService = workspaceTrustManagementService;
        this.extensionService = extensionService;
        this.languageService = languageService;
        this.extensionManagementService = extensionManagementService;
        this.productService = productService;
        this.extensionGalleryService = extensionGalleryService;
        this.editorProgressService = editorProgressService;
        this.aiSettingsSearchService = aiSettingsSearchService;
        this.settingsTreeModel = this._register(new MutableDisposable());
        this.searchInProgress = null;
        this.showAiResultsAction = null;
        this.pendingSettingUpdate = null;
        this._searchResultModel = this._register(new MutableDisposable());
        this.searchResultLabel = null;
        this.lastSyncedLabel = null;
        this.settingsOrderByTocIndex = null;
        this._currentFocusContext = 0 /* SettingsFocusContext.Search */;
        /** Don't spam warnings */
        this.hasWarnedMissingSettings = false;
        this.tocTreeDisposed = false;
        this.tocFocusedElement = null;
        this.treeFocusedElement = null;
        this.settingsTreeScrollTop = 0;
        this.installedExtensionIds = [];
        this.dismissedExtensionSettings = [];
        this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY = 'settingsEditor2.dismissedExtensionSettings';
        this.DISMISSED_EXTENSION_SETTINGS_DELIMITER = '\t';
        this.searchDelayer = new Delayer(300);
        this.aiSearchDelayer = new Delayer(2000);
        this.viewState = { settingsTarget: 3 /* ConfigurationTarget.USER_LOCAL */ };
        this.settingFastUpdateDelayer = new Delayer(SettingsEditor2_1.SETTING_UPDATE_FAST_DEBOUNCE);
        this.settingSlowUpdateDelayer = new Delayer(SettingsEditor2_1.SETTING_UPDATE_SLOW_DEBOUNCE);
        this.searchInputDelayer = new Delayer(SettingsEditor2_1.SEARCH_DEBOUNCE);
        this.updatedConfigSchemaDelayer = new Delayer(SettingsEditor2_1.CONFIG_SCHEMA_UPDATE_DELAYER);
        this.inSettingsEditorContextKey = CONTEXT_SETTINGS_EDITOR.bindTo(contextKeyService);
        this.searchFocusContextKey = CONTEXT_SETTINGS_SEARCH_FOCUS.bindTo(contextKeyService);
        this.tocRowFocused = CONTEXT_TOC_ROW_FOCUS.bindTo(contextKeyService);
        this.settingRowFocused = CONTEXT_SETTINGS_ROW_FOCUS.bindTo(contextKeyService);
        this.scheduledRefreshes = new Map();
        this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, SETTINGS_EDITOR_STATE_KEY);
        this.dismissedExtensionSettings = this.storageService
            .get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, 0 /* StorageScope.PROFILE */, '')
            .split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.source !== 7 /* ConfigurationTarget.DEFAULT */) {
                this.onConfigUpdate(e.affectedKeys);
            }
        }));
        this._register(userDataProfileService.onDidChangeCurrentProfile(e => {
            e.join(this.whenCurrentProfileChanged());
        }));
        this._register(workspaceTrustManagementService.onDidChangeTrust(() => {
            this.searchResultModel?.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
            if (this.settingsTreeModel.value) {
                this.settingsTreeModel.value.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
                this.renderTree();
            }
        }));
        this._register(configurationService.onDidChangeRestrictedSettings(e => {
            if (e.default.length && this.currentSettingsModel) {
                this.updateElementsByKey(new Set(e.default));
            }
        }));
        this._register(extensionManagementService.onDidInstallExtensions(() => {
            this.refreshInstalledExtensionsList();
        }));
        this._register(extensionManagementService.onDidUninstallExtension(() => {
            this.refreshInstalledExtensionsList();
        }));
        this.modelDisposables = this._register(new DisposableStore());
        if (ENABLE_LANGUAGE_FILTER && !SettingsEditor2_1.SUGGESTIONS.includes(`@${LANGUAGE_SETTING_TAG}`)) {
            SettingsEditor2_1.SUGGESTIONS.push(`@${LANGUAGE_SETTING_TAG}`);
        }
        this.inputChangeListener = this._register(new MutableDisposable());
    }
    async whenCurrentProfileChanged() {
        this.updatedConfigSchemaDelayer.trigger(() => {
            this.dismissedExtensionSettings = this.storageService
                .get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, 0 /* StorageScope.PROFILE */, '')
                .split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
            this.onConfigUpdate(undefined, true);
        });
    }
    get minimumWidth() { return SettingsEditor2_1.EDITOR_MIN_WIDTH; }
    get maximumWidth() { return Number.POSITIVE_INFINITY; }
    get minimumHeight() { return 180; }
    // these setters need to exist because this extends from EditorPane
    set minimumWidth(value) { }
    set maximumWidth(value) { }
    get currentSettingsModel() {
        return this.searchResultModel || this.settingsTreeModel.value;
    }
    get searchResultModel() {
        return this._searchResultModel.value ?? null;
    }
    set searchResultModel(value) {
        this._searchResultModel.value = value ?? undefined;
        this.rootElement.classList.toggle('search-mode', !!this._searchResultModel.value);
    }
    get focusedSettingDOMElement() {
        const focused = this.settingsTree.getFocus()[0];
        if (!(focused instanceof SettingsTreeSettingElement)) {
            return;
        }
        return this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), focused.setting.key)[0];
    }
    get currentFocusContext() {
        return this._currentFocusContext;
    }
    createEditor(parent) {
        parent.setAttribute('tabindex', '-1');
        this.rootElement = DOM.append(parent, $('.settings-editor', { tabindex: '-1' }));
        this.createHeader(this.rootElement);
        this.createBody(this.rootElement);
        this.addCtrlAInterceptor(this.rootElement);
        this.updateStyles();
        this._register(registerNavigableContainer({
            name: 'settingsEditor2',
            focusNotifiers: [this],
            focusNextWidget: () => {
                if (this.searchWidget.inputWidget.hasWidgetFocus()) {
                    this.focusTOC();
                }
            },
            focusPreviousWidget: () => {
                if (!this.searchWidget.inputWidget.hasWidgetFocus()) {
                    this.focusSearch();
                }
            }
        }));
    }
    async setInput(input, options, context, token) {
        this.inSettingsEditorContextKey.set(true);
        await super.setInput(input, options, context, token);
        if (!this.input) {
            return;
        }
        const model = await this.input.resolve();
        if (token.isCancellationRequested || !(model instanceof Settings2EditorModel)) {
            return;
        }
        this.modelDisposables.clear();
        this.modelDisposables.add(model.onDidChangeGroups(() => {
            this.updatedConfigSchemaDelayer.trigger(() => {
                this.onConfigUpdate(undefined, false, true);
            });
        }));
        this.defaultSettingsEditorModel = model;
        options = options || validateSettingsEditorOptions({});
        if (!this.viewState.settingsTarget || !this.settingsTargetsWidget.settingsTarget) {
            const optionsHasViewStateTarget = options.viewState && options.viewState.settingsTarget;
            if (!options.target && !optionsHasViewStateTarget) {
                options.target = 3 /* ConfigurationTarget.USER_LOCAL */;
            }
        }
        this._setOptions(options);
        // Don't block setInput on render (which can trigger an async search)
        this.onConfigUpdate(undefined, true).then(() => {
            // This event runs when the editor closes.
            this.inputChangeListener.value = input.onWillDispose(() => {
                this.searchWidget.setValue('');
            });
            // Init TOC selection
            this.updateTreeScrollSync();
        });
        await this.refreshInstalledExtensionsList();
    }
    async refreshInstalledExtensionsList() {
        const installedExtensions = await this.extensionManagementService.getInstalled();
        this.installedExtensionIds = installedExtensions
            .filter(ext => ext.manifest.contributes?.configuration)
            .map(ext => ext.identifier.id);
    }
    restoreCachedState() {
        const cachedState = this.input && this.editorMemento.loadEditorState(this.group, this.input);
        if (cachedState && typeof cachedState.target === 'object') {
            cachedState.target = URI.revive(cachedState.target);
        }
        if (cachedState) {
            const settingsTarget = cachedState.target;
            this.settingsTargetsWidget.settingsTarget = settingsTarget;
            this.viewState.settingsTarget = settingsTarget;
            if (!this.searchWidget.getValue()) {
                this.searchWidget.setValue(cachedState.searchQuery);
            }
        }
        if (this.input) {
            this.editorMemento.clearEditorState(this.input, this.group);
        }
        return cachedState ?? null;
    }
    getViewState() {
        return this.viewState;
    }
    setOptions(options) {
        super.setOptions(options);
        if (options) {
            this._setOptions(options);
        }
    }
    _setOptions(options) {
        if (options.focusSearch && !platform.isIOS) {
            // isIOS - #122044
            this.focusSearch();
        }
        const recoveredViewState = options.viewState ?
            options.viewState : undefined;
        const query = recoveredViewState?.query ?? options.query;
        if (query !== undefined) {
            this.searchWidget.setValue(query);
            this.viewState.query = query;
        }
        const target = options.folderUri ?? recoveredViewState?.settingsTarget ?? options.target;
        if (target) {
            this.settingsTargetsWidget.updateTarget(target);
        }
    }
    clearInput() {
        this.inSettingsEditorContextKey.set(false);
        super.clearInput();
    }
    layout(dimension) {
        this.dimension = dimension;
        if (!this.isVisible()) {
            return;
        }
        this.layoutSplitView(dimension);
        const innerWidth = Math.min(this.headerContainer.clientWidth, dimension.width) - 24 * 2; // 24px padding on left and right;
        // minus padding inside inputbox, countElement width, controls width, extra padding before countElement
        const monacoWidth = innerWidth - 10 - this.countElement.clientWidth - this.controlsElement.clientWidth - 12;
        this.searchWidget.layout(new DOM.Dimension(monacoWidth, 20));
        this.rootElement.classList.toggle('narrow-width', dimension.width < SettingsEditor2_1.NARROW_TOTAL_WIDTH);
    }
    focus() {
        super.focus();
        if (this._currentFocusContext === 0 /* SettingsFocusContext.Search */) {
            if (!platform.isIOS) {
                // #122044
                this.focusSearch();
            }
        }
        else if (this._currentFocusContext === 3 /* SettingsFocusContext.SettingControl */) {
            const element = this.focusedSettingDOMElement;
            if (element) {
                const control = element.querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
                if (control) {
                    control.focus();
                    return;
                }
            }
        }
        else if (this._currentFocusContext === 2 /* SettingsFocusContext.SettingTree */) {
            this.settingsTree.domFocus();
        }
        else if (this._currentFocusContext === 1 /* SettingsFocusContext.TableOfContents */) {
            this.tocTree.domFocus();
        }
    }
    setEditorVisible(visible) {
        super.setEditorVisible(visible);
        if (!visible) {
            // Wait for editor to be removed from DOM #106303
            setTimeout(() => {
                this.searchWidget.onHide();
                this.settingRenderers.cancelSuggesters();
            }, 0);
        }
    }
    focusSettings(focusSettingInput = false) {
        const focused = this.settingsTree.getFocus();
        if (!focused.length) {
            this.settingsTree.focusFirst();
        }
        this.settingsTree.domFocus();
        if (focusSettingInput) {
            const controlInFocusedRow = this.settingsTree.getHTMLElement().querySelector(`.focused ${AbstractSettingRenderer.CONTROL_SELECTOR}`);
            if (controlInFocusedRow) {
                controlInFocusedRow.focus();
            }
        }
    }
    focusTOC() {
        this.tocTree.domFocus();
    }
    showContextMenu() {
        const focused = this.settingsTree.getFocus()[0];
        const rowElement = this.focusedSettingDOMElement;
        if (rowElement && focused instanceof SettingsTreeSettingElement) {
            this.settingRenderers.showContextMenu(focused, rowElement);
        }
    }
    focusSearch(filter, selectAll = true) {
        if (filter && this.searchWidget) {
            this.searchWidget.setValue(filter);
        }
        // Do not select all if the user is already searching.
        this.searchWidget.focus(selectAll && !this.searchInputDelayer.isTriggered);
    }
    clearSearchResults() {
        this.searchWidget.setValue('');
        this.focusSearch();
    }
    clearSearchFilters() {
        const query = this.searchWidget.getValue();
        const splitQuery = query.split(' ').filter(word => {
            return word.length && !SettingsEditor2_1.SUGGESTIONS.some(suggestion => word.startsWith(suggestion));
        });
        this.searchWidget.setValue(splitQuery.join(' '));
    }
    updateInputAriaLabel() {
        let label = searchBoxLabel;
        if (this.searchResultLabel) {
            label += `. ${this.searchResultLabel}`;
        }
        if (this.lastSyncedLabel) {
            label += `. ${this.lastSyncedLabel}`;
        }
        this.searchWidget.updateAriaLabel(label);
    }
    /**
     * Render the header of the Settings editor, which includes the content above the splitview.
     */
    createHeader(parent) {
        this.headerContainer = DOM.append(parent, $('.settings-header'));
        const searchContainer = DOM.append(this.headerContainer, $('.search-container'));
        const clearInputAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, localize('clearInput', "Clear Settings Search Input"), ThemeIcon.asClassName(preferencesClearInputIcon), false, async () => this.clearSearchResults()));
        const setupHidden = this.contextKeyService.getContextKeyValue('chatSetupHidden');
        const showSuggestions = this.configurationService.getValue('workbench.settings.showAISearchToggle');
        if (!setupHidden && showSuggestions) {
            const showAiResultActionClassNames = ['action-label', ThemeIcon.asClassName(preferencesAiResultsIcon)];
            const searchServiceEnabled = this.aiSettingsSearchService.isEnabled();
            this.showAiResultsAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS, searchServiceEnabled
                ? localize('showAiResultsDescription', "Search settings with AI")
                : localize('showAiResultsNotReady', "AI search functionality loading..."), showAiResultActionClassNames.join(' '), searchServiceEnabled));
            this._register(this.aiSettingsSearchService.onProviderRegistered(() => {
                if (this.showAiResultsAction) {
                    this.showAiResultsAction.label = localize('showAiResultsDescription', "Search settings with AI");
                    this.showAiResultsAction.enabled = true;
                }
            }));
            this._register(this.showAiResultsAction.onDidChange(() => {
                this.onSearchInputChanged(true);
            }));
        }
        const filterAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, localize('filterInput', "Filter Settings"), ThemeIcon.asClassName(preferencesFilterIcon)));
        this.searchWidget = this._register(this.instantiationService.createInstance(SuggestEnabledInput, `${SettingsEditor2_1.ID}.searchbox`, searchContainer, {
            triggerCharacters: ['@', ':'],
            provideResults: (query) => {
                // Based on testing, the trigger character is always at the end of the query.
                // for the ':' trigger, only return suggestions if there was a '@' before it in the same word.
                const queryParts = query.split(/\s/g);
                if (queryParts[queryParts.length - 1].startsWith(`@${LANGUAGE_SETTING_TAG}`)) {
                    const sortedLanguages = this.languageService.getRegisteredLanguageIds().map(languageId => {
                        return `@${LANGUAGE_SETTING_TAG}${languageId} `;
                    }).sort();
                    return sortedLanguages.filter(langFilter => !query.includes(langFilter));
                }
                else if (queryParts[queryParts.length - 1].startsWith(`@${EXTENSION_SETTING_TAG}`)) {
                    const installedExtensionsTags = this.installedExtensionIds.map(extensionId => {
                        return `@${EXTENSION_SETTING_TAG}${extensionId} `;
                    }).sort();
                    return installedExtensionsTags.filter(extFilter => !query.includes(extFilter));
                }
                else if (queryParts[queryParts.length - 1].startsWith('@')) {
                    return SettingsEditor2_1.SUGGESTIONS.filter(tag => !query.includes(tag)).map(tag => tag.endsWith(':') ? tag : tag + ' ');
                }
                return [];
            }
        }, searchBoxLabel, 'settingseditor:searchinput' + SettingsEditor2_1.NUM_INSTANCES++, {
            placeholderText: searchBoxLabel,
            focusContextKey: this.searchFocusContextKey,
            styleOverrides: {
                inputBorder: settingsTextInputBorder
            }
            // TODO: Aria-live
        }));
        this._register(this.searchWidget.onDidFocus(() => {
            this._currentFocusContext = 0 /* SettingsFocusContext.Search */;
        }));
        this.countElement = DOM.append(searchContainer, DOM.$('.settings-count-widget.monaco-count-badge.long'));
        this.countElement.style.backgroundColor = asCssVariable(badgeBackground);
        this.countElement.style.color = asCssVariable(badgeForeground);
        this.countElement.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
        this._register(this.searchWidget.onInputDidChange(() => {
            const searchVal = this.searchWidget.getValue();
            clearInputAction.enabled = !!searchVal;
            this.searchInputDelayer.trigger(() => this.onSearchInputChanged(true));
        }));
        const headerControlsContainer = DOM.append(this.headerContainer, $('.settings-header-controls'));
        headerControlsContainer.style.borderColor = asCssVariable(settingsHeaderBorder);
        const targetWidgetContainer = DOM.append(headerControlsContainer, $('.settings-target-container'));
        this.settingsTargetsWidget = this._register(this.instantiationService.createInstance(SettingsTargetsWidget, targetWidgetContainer, { enableRemoteSettings: true }));
        this.settingsTargetsWidget.settingsTarget = 3 /* ConfigurationTarget.USER_LOCAL */;
        this._register(this.settingsTargetsWidget.onDidTargetChange(target => this.onDidSettingsTargetChange(target)));
        this._register(DOM.addDisposableListener(targetWidgetContainer, DOM.EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.keyCode === 18 /* KeyCode.DownArrow */) {
                this.focusSettings();
            }
        }));
        if (this.userDataSyncWorkbenchService.enabled && this.userDataSyncEnablementService.canToggleEnablement()) {
            const syncControls = this._register(this.instantiationService.createInstance(SyncControls, this.window, headerControlsContainer));
            this._register(syncControls.onDidChangeLastSyncedLabel(lastSyncedLabel => {
                this.lastSyncedLabel = lastSyncedLabel;
                this.updateInputAriaLabel();
            }));
        }
        this.controlsElement = DOM.append(searchContainer, DOM.$('.settings-clear-widget'));
        const actionBar = this._register(new ActionBar(this.controlsElement, {
            actionViewItemProvider: (action, options) => {
                if (action.id === filterAction.id) {
                    return this.instantiationService.createInstance(SettingsSearchFilterDropdownMenuActionViewItem, action, options, this.actionRunner, this.searchWidget);
                }
                if (this.showAiResultsAction && action.id === this.showAiResultsAction.id) {
                    return new ToggleActionViewItem(null, action, { ...options, keybinding: 'Ctrl+I', toggleStyles: defaultToggleStyles });
                }
                return undefined;
            }
        }));
        if (!this.showAiResultsAction) {
            const actionsToPush = [clearInputAction, filterAction];
            actionBar.push(actionsToPush, { label: false, icon: true });
        }
        else {
            const actionsToPush = [clearInputAction, this.showAiResultsAction, filterAction];
            searchContainer.classList.add('with-ai-toggle');
            actionBar.push(actionsToPush, { label: false, icon: true });
        }
    }
    toggleAiSearch() {
        if (this.showAiResultsAction && this.showAiResultsAction.enabled) {
            this.showAiResultsAction.checked = !this.showAiResultsAction.checked;
        }
    }
    onDidSettingsTargetChange(target) {
        this.viewState.settingsTarget = target;
        // TODO Instead of rebuilding the whole model, refresh and uncache the inspected setting value
        this.onConfigUpdate(undefined, true);
    }
    onDidDismissExtensionSetting(extensionId) {
        if (!this.dismissedExtensionSettings.includes(extensionId)) {
            this.dismissedExtensionSettings.push(extensionId);
        }
        this.storageService.store(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, this.dismissedExtensionSettings.join(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        this.onConfigUpdate(undefined, true);
    }
    onDidClickSetting(evt, recursed) {
        const targetElement = this.currentSettingsModel?.getElementsByName(evt.targetKey)?.[0];
        let revealFailed = false;
        if (targetElement) {
            let sourceTop = 0.5;
            try {
                const _sourceTop = this.settingsTree.getRelativeTop(evt.source);
                if (_sourceTop !== null) {
                    sourceTop = _sourceTop;
                }
            }
            catch {
                // e.g. clicked a searched element, now the search has been cleared
            }
            // If we search for something and focus on a category, the settings tree
            // only renders settings in that category.
            // If the target display category is different than the source's, unfocus the category
            // so that we can render all found settings again.
            // Then, the reveal call will correctly find the target setting.
            if (this.viewState.filterToCategory && evt.source.displayCategory !== targetElement.displayCategory) {
                this.tocTree.setFocus([]);
            }
            try {
                this.settingsTree.reveal(targetElement, sourceTop);
            }
            catch (_) {
                // The listwidget couldn't find the setting to reveal,
                // even though it's in the model, meaning there might be a filter
                // preventing it from showing up.
                revealFailed = true;
            }
            if (!revealFailed) {
                // We need to shift focus from the setting that contains the link to the setting that's
                // linked. Clicking on the link sets focus on the setting that contains the link,
                // which is why we need the setTimeout.
                setTimeout(() => {
                    this.settingsTree.setFocus([targetElement]);
                }, 50);
                const domElements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), evt.targetKey);
                if (domElements && domElements[0]) {
                    const control = domElements[0].querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
                    if (control) {
                        control.focus();
                    }
                }
            }
        }
        if (!recursed && (!targetElement || revealFailed)) {
            // We'll call this event handler again after clearing the search query,
            // so that more settings show up in the list.
            const p = this.triggerSearch('', true);
            p.then(() => {
                this.searchWidget.setValue('');
                this.onDidClickSetting(evt, true);
            });
        }
    }
    switchToSettingsFile() {
        const query = parseQuery(this.searchWidget.getValue()).query;
        return this.openSettingsFile({ query });
    }
    async openSettingsFile(options) {
        const currentSettingsTarget = this.settingsTargetsWidget.settingsTarget;
        const openOptions = { jsonEditor: true, groupId: this.group.id, ...options };
        if (currentSettingsTarget === 3 /* ConfigurationTarget.USER_LOCAL */) {
            if (options?.revealSetting) {
                const configurationProperties = Registry.as(Extensions.Configuration).getConfigurationProperties();
                const configurationScope = configurationProperties[options?.revealSetting.key]?.scope;
                if (configurationScope && APPLICATION_SCOPES.includes(configurationScope)) {
                    return this.preferencesService.openApplicationSettings(openOptions);
                }
            }
            return this.preferencesService.openUserSettings(openOptions);
        }
        else if (currentSettingsTarget === 4 /* ConfigurationTarget.USER_REMOTE */) {
            return this.preferencesService.openRemoteSettings(openOptions);
        }
        else if (currentSettingsTarget === 5 /* ConfigurationTarget.WORKSPACE */) {
            return this.preferencesService.openWorkspaceSettings(openOptions);
        }
        else if (URI.isUri(currentSettingsTarget)) {
            return this.preferencesService.openFolderSettings({ folderUri: currentSettingsTarget, ...openOptions });
        }
        return undefined;
    }
    createBody(parent) {
        this.bodyContainer = DOM.append(parent, $('.settings-body'));
        this.noResultsMessage = DOM.append(this.bodyContainer, $('.no-results-message'));
        this.noResultsMessage.innerText = localize('noResults', "No Settings Found");
        this.clearFilterLinkContainer = $('span.clear-search-filters');
        this.clearFilterLinkContainer.textContent = ' - ';
        const clearFilterLink = DOM.append(this.clearFilterLinkContainer, $('a.pointer.prominent', { tabindex: 0 }, localize('clearSearchFilters', 'Clear Filters')));
        this._register(DOM.addDisposableListener(clearFilterLink, DOM.EventType.CLICK, (e) => {
            DOM.EventHelper.stop(e, false);
            this.clearSearchFilters();
        }));
        DOM.append(this.noResultsMessage, this.clearFilterLinkContainer);
        this.noResultsMessage.style.color = asCssVariable(editorForeground);
        this.tocTreeContainer = $('.settings-toc-container');
        this.settingsTreeContainer = $('.settings-tree-container');
        this.createTOC(this.tocTreeContainer);
        this.createSettingsTree(this.settingsTreeContainer);
        this.splitView = this._register(new SplitView(this.bodyContainer, {
            orientation: 1 /* Orientation.HORIZONTAL */,
            proportionalLayout: true
        }));
        const startingWidth = this.storageService.getNumber('settingsEditor2.splitViewWidth', 0 /* StorageScope.PROFILE */, SettingsEditor2_1.TOC_RESET_WIDTH);
        this.splitView.addView({
            onDidChange: Event.None,
            element: this.tocTreeContainer,
            minimumSize: SettingsEditor2_1.TOC_MIN_WIDTH,
            maximumSize: Number.POSITIVE_INFINITY,
            layout: (width, _, height) => {
                this.tocTreeContainer.style.width = `${width}px`;
                this.tocTree.layout(height, width);
            }
        }, startingWidth, undefined, true);
        this.splitView.addView({
            onDidChange: Event.None,
            element: this.settingsTreeContainer,
            minimumSize: SettingsEditor2_1.EDITOR_MIN_WIDTH,
            maximumSize: Number.POSITIVE_INFINITY,
            layout: (width, _, height) => {
                this.settingsTreeContainer.style.width = `${width}px`;
                this.settingsTree.layout(height, width);
            }
        }, Sizing.Distribute, undefined, true);
        this._register(this.splitView.onDidSashReset(() => {
            const totalSize = this.splitView.getViewSize(0) + this.splitView.getViewSize(1);
            this.splitView.resizeView(0, SettingsEditor2_1.TOC_RESET_WIDTH);
            this.splitView.resizeView(1, totalSize - SettingsEditor2_1.TOC_RESET_WIDTH);
        }));
        this._register(this.splitView.onDidSashChange(() => {
            const width = this.splitView.getViewSize(0);
            this.storageService.store('settingsEditor2.splitViewWidth', width, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        }));
        const borderColor = this.theme.getColor(settingsSashBorder);
        this.splitView.style({ separatorBorder: borderColor });
    }
    addCtrlAInterceptor(container) {
        this._register(DOM.addStandardDisposableListener(container, DOM.EventType.KEY_DOWN, (e) => {
            if (e.keyCode === 31 /* KeyCode.KeyA */ &&
                (platform.isMacintosh ? e.metaKey : e.ctrlKey) &&
                !DOM.isEditableElement(e.target)) {
                // Avoid browser ctrl+a
                e.browserEvent.stopPropagation();
                e.browserEvent.preventDefault();
            }
        }));
    }
    createTOC(container) {
        this.tocTreeModel = this.instantiationService.createInstance(TOCTreeModel, this.viewState);
        this.tocTree = this._register(this.instantiationService.createInstance(TOCTree, DOM.append(container, $('.settings-toc-wrapper', {
            'role': 'navigation',
            'aria-label': localize('settings', "Settings"),
        })), this.viewState));
        this.tocTreeDisposed = false;
        this._register(this.tocTree.onDidFocus(() => {
            this._currentFocusContext = 1 /* SettingsFocusContext.TableOfContents */;
        }));
        this._register(this.tocTree.onDidChangeFocus(e => {
            const element = e.elements?.[0] ?? null;
            if (this.tocFocusedElement === element) {
                return;
            }
            this.tocFocusedElement = element;
            this.tocTree.setSelection(element ? [element] : []);
            if (this.searchResultModel) {
                if (this.viewState.filterToCategory !== element) {
                    this.viewState.filterToCategory = element ?? undefined;
                    // Force render in this case, because
                    // onDidClickSetting relies on the updated view.
                    this.renderTree(undefined, true);
                    this.settingsTree.scrollTop = 0;
                }
            }
            else if (element && (!e.browserEvent || !e.browserEvent.fromScroll)) {
                this.settingsTree.reveal(element, 0);
                this.settingsTree.setFocus([element]);
            }
        }));
        this._register(this.tocTree.onDidFocus(() => {
            this.tocRowFocused.set(true);
        }));
        this._register(this.tocTree.onDidBlur(() => {
            this.tocRowFocused.set(false);
        }));
        this._register(this.tocTree.onDidDispose(() => {
            this.tocTreeDisposed = true;
        }));
    }
    applyFilter(filter) {
        if (this.searchWidget && !this.searchWidget.getValue().includes(filter)) {
            // Prepend the filter to the query.
            const newQuery = `${filter} ${this.searchWidget.getValue().trimStart()}`;
            this.focusSearch(newQuery, false);
        }
    }
    removeLanguageFilters() {
        if (this.searchWidget && this.searchWidget.getValue().includes(`@${LANGUAGE_SETTING_TAG}`)) {
            const query = this.searchWidget.getValue().split(' ');
            const newQuery = query.filter(word => !word.startsWith(`@${LANGUAGE_SETTING_TAG}`)).join(' ');
            this.focusSearch(newQuery, false);
        }
    }
    createSettingsTree(container) {
        this.settingRenderers = this._register(this.instantiationService.createInstance(SettingTreeRenderers));
        this._register(this.settingRenderers.onDidChangeSetting(e => this.onDidChangeSetting(e.key, e.value, e.type, e.manualReset, e.scope)));
        this._register(this.settingRenderers.onDidDismissExtensionSetting((e) => this.onDidDismissExtensionSetting(e)));
        this._register(this.settingRenderers.onDidOpenSettings(settingKey => {
            this.openSettingsFile({ revealSetting: { key: settingKey, edit: true } });
        }));
        this._register(this.settingRenderers.onDidClickSettingLink(settingName => this.onDidClickSetting(settingName)));
        this._register(this.settingRenderers.onDidFocusSetting(element => {
            this.settingsTree.setFocus([element]);
            this._currentFocusContext = 3 /* SettingsFocusContext.SettingControl */;
            this.settingRowFocused.set(false);
        }));
        this._register(this.settingRenderers.onDidChangeSettingHeight((params) => {
            const { element, height } = params;
            try {
                this.settingsTree.updateElementHeight(element, height);
            }
            catch (e) {
                // the element was not found
            }
        }));
        this._register(this.settingRenderers.onApplyFilter((filter) => this.applyFilter(filter)));
        this._register(this.settingRenderers.onDidClickOverrideElement((element) => {
            this.removeLanguageFilters();
            if (element.language) {
                this.applyFilter(`@${LANGUAGE_SETTING_TAG}${element.language}`);
            }
            if (element.scope === 'workspace') {
                this.settingsTargetsWidget.updateTarget(5 /* ConfigurationTarget.WORKSPACE */);
            }
            else if (element.scope === 'user') {
                this.settingsTargetsWidget.updateTarget(3 /* ConfigurationTarget.USER_LOCAL */);
            }
            else if (element.scope === 'remote') {
                this.settingsTargetsWidget.updateTarget(4 /* ConfigurationTarget.USER_REMOTE */);
            }
            this.applyFilter(`@${ID_SETTING_TAG}${element.settingKey}`);
        }));
        this.settingsTree = this._register(this.instantiationService.createInstance(SettingsTree, container, this.viewState, this.settingRenderers.allRenderers));
        this._register(this.settingsTree.onDidScroll(() => {
            if (this.settingsTree.scrollTop === this.settingsTreeScrollTop) {
                return;
            }
            this.settingsTreeScrollTop = this.settingsTree.scrollTop;
            // setTimeout because calling setChildren on the settingsTree can trigger onDidScroll, so it fires when
            // setChildren has called on the settings tree but not the toc tree yet, so their rendered elements are out of sync
            setTimeout(() => {
                this.updateTreeScrollSync();
            }, 0);
        }));
        this._register(this.settingsTree.onDidFocus(() => {
            const classList = container.ownerDocument.activeElement?.classList;
            if (classList && classList.contains('monaco-list') && classList.contains('settings-editor-tree')) {
                this._currentFocusContext = 2 /* SettingsFocusContext.SettingTree */;
                this.settingRowFocused.set(true);
                this.treeFocusedElement ??= this.settingsTree.firstVisibleElement ?? null;
                if (this.treeFocusedElement) {
                    this.treeFocusedElement.tabbable = true;
                }
            }
        }));
        this._register(this.settingsTree.onDidBlur(() => {
            this.settingRowFocused.set(false);
            // Clear out the focused element, otherwise it could be
            // out of date during the next onDidFocus event.
            this.treeFocusedElement = null;
        }));
        // There is no different select state in the settings tree
        this._register(this.settingsTree.onDidChangeFocus(e => {
            const element = e.elements[0];
            if (this.treeFocusedElement === element) {
                return;
            }
            if (this.treeFocusedElement) {
                this.treeFocusedElement.tabbable = false;
            }
            this.treeFocusedElement = element;
            if (this.treeFocusedElement) {
                this.treeFocusedElement.tabbable = true;
            }
            this.settingsTree.setSelection(element ? [element] : []);
        }));
    }
    onDidChangeSetting(key, value, type, manualReset, scope) {
        const parsedQuery = parseQuery(this.searchWidget.getValue());
        const languageFilter = parsedQuery.languageFilter;
        if (manualReset || (this.pendingSettingUpdate && this.pendingSettingUpdate.key !== key)) {
            this.updateChangedSetting(key, value, manualReset, languageFilter, scope);
        }
        this.pendingSettingUpdate = { key, value, languageFilter };
        if (SettingsEditor2_1.shouldSettingUpdateFast(type)) {
            this.settingFastUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
        }
        else {
            this.settingSlowUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
        }
    }
    updateTreeScrollSync() {
        this.settingRenderers.cancelSuggesters();
        if (this.searchResultModel) {
            return;
        }
        if (!this.tocTreeModel) {
            return;
        }
        const elementToSync = this.settingsTree.firstVisibleElement;
        const element = elementToSync instanceof SettingsTreeSettingElement ? elementToSync.parent :
            elementToSync instanceof SettingsTreeGroupElement ? elementToSync :
                null;
        // It's possible for this to be called when the TOC and settings tree are out of sync - e.g. when the settings tree has deferred a refresh because
        // it is focused. So, bail if element doesn't exist in the TOC.
        let nodeExists = true;
        try {
            this.tocTree.getNode(element);
        }
        catch (e) {
            nodeExists = false;
        }
        if (!nodeExists) {
            return;
        }
        if (element && this.tocTree.getSelection()[0] !== element) {
            const ancestors = this.getAncestors(element);
            ancestors.forEach(e => this.tocTree.expand(e));
            this.tocTree.reveal(element);
            const elementTop = this.tocTree.getRelativeTop(element);
            if (typeof elementTop !== 'number') {
                return;
            }
            this.tocTree.collapseAll();
            ancestors.forEach(e => this.tocTree.expand(e));
            if (elementTop < 0 || elementTop > 1) {
                this.tocTree.reveal(element);
            }
            else {
                this.tocTree.reveal(element, elementTop);
            }
            this.tocTree.expand(element);
            this.tocTree.setSelection([element]);
            const fakeKeyboardEvent = new KeyboardEvent('keydown');
            fakeKeyboardEvent.fromScroll = true;
            this.tocTree.setFocus([element], fakeKeyboardEvent);
        }
    }
    getAncestors(element) {
        const ancestors = [];
        while (element.parent) {
            if (element.parent.id !== 'root') {
                ancestors.push(element.parent);
            }
            element = element.parent;
        }
        return ancestors.reverse();
    }
    updateChangedSetting(key, value, manualReset, languageFilter, scope) {
        // ConfigurationService displays the error if this fails.
        // Force a render afterwards because onDidConfigurationUpdate doesn't fire if the update doesn't result in an effective setting value change.
        const settingsTarget = this.settingsTargetsWidget.settingsTarget;
        const resource = URI.isUri(settingsTarget) ? settingsTarget : undefined;
        const configurationTarget = (resource ? 6 /* ConfigurationTarget.WORKSPACE_FOLDER */ : settingsTarget) ?? 3 /* ConfigurationTarget.USER_LOCAL */;
        const overrides = { resource, overrideIdentifiers: languageFilter ? [languageFilter] : undefined };
        const configurationTargetIsWorkspace = configurationTarget === 5 /* ConfigurationTarget.WORKSPACE */ || configurationTarget === 6 /* ConfigurationTarget.WORKSPACE_FOLDER */;
        const userPassedInManualReset = configurationTargetIsWorkspace || !!languageFilter;
        const isManualReset = userPassedInManualReset ? manualReset : value === undefined;
        // If the user is changing the value back to the default, and we're not targeting a workspace scope, do a 'reset' instead
        const inspected = this.configurationService.inspect(key, overrides);
        if (!userPassedInManualReset && inspected.defaultValue === value) {
            value = undefined;
        }
        return this.configurationService.updateValue(key, value, overrides, configurationTarget, { handleDirtyFile: 'save' })
            .then(() => {
            const query = this.searchWidget.getValue();
            if (query.includes(`@${MODIFIED_SETTING_TAG}`)) {
                // The user might have reset a setting.
                this.refreshTOCTree();
            }
            this.renderTree(key, isManualReset);
            this.pendingSettingUpdate = null;
            const reportModifiedProps = {
                key,
                query,
                searchResults: this.searchResultModel?.getUniqueSearchResults() ?? null,
                rawResults: this.searchResultModel?.getRawResults() ?? null,
                showConfiguredOnly: !!this.viewState.tagFilters && this.viewState.tagFilters.has(MODIFIED_SETTING_TAG),
                isReset: typeof value === 'undefined',
                settingsTarget: this.settingsTargetsWidget.settingsTarget
            };
            return this.reportModifiedSetting(reportModifiedProps);
        });
    }
    reportModifiedSetting(props) {
        let groupId = undefined;
        let providerName = undefined;
        let nlpIndex = undefined;
        let displayIndex = undefined;
        if (props.searchResults) {
            displayIndex = props.searchResults.filterMatches.findIndex(m => m.setting.key === props.key);
            if (this.searchResultModel) {
                providerName = props.searchResults.filterMatches.find(m => m.setting.key === props.key)?.providerName;
                const rawResults = this.searchResultModel.getRawResults();
                if (rawResults[0 /* SearchResultIdx.Local */] && displayIndex >= 0) {
                    const settingInLocalResults = rawResults[0 /* SearchResultIdx.Local */].filterMatches.some(m => m.setting.key === props.key);
                    groupId = settingInLocalResults ? 'local' : 'remote';
                }
                if (rawResults[1 /* SearchResultIdx.Remote */]) {
                    const _nlpIndex = rawResults[1 /* SearchResultIdx.Remote */].filterMatches.findIndex(m => m.setting.key === props.key);
                    nlpIndex = _nlpIndex >= 0 ? _nlpIndex : undefined;
                }
            }
        }
        const reportedTarget = props.settingsTarget === 3 /* ConfigurationTarget.USER_LOCAL */ ? 'user' :
            props.settingsTarget === 4 /* ConfigurationTarget.USER_REMOTE */ ? 'user_remote' :
                props.settingsTarget === 5 /* ConfigurationTarget.WORKSPACE */ ? 'workspace' :
                    'folder';
        const data = {
            key: props.key,
            groupId,
            providerName,
            nlpIndex,
            displayIndex,
            showConfiguredOnly: props.showConfiguredOnly,
            isReset: props.isReset,
            target: reportedTarget
        };
        this.telemetryService.publicLog2('settingsEditor.settingModified', data);
    }
    scheduleRefresh(element, key = '') {
        if (key && this.scheduledRefreshes.has(key)) {
            return;
        }
        if (!key) {
            dispose(this.scheduledRefreshes.values());
            this.scheduledRefreshes.clear();
        }
        const store = new DisposableStore();
        const scheduledRefreshTracker = DOM.trackFocus(element);
        store.add(scheduledRefreshTracker);
        store.add(scheduledRefreshTracker.onDidBlur(() => {
            this.scheduledRefreshes.get(key)?.dispose();
            this.scheduledRefreshes.delete(key);
            this.onConfigUpdate(new Set([key]));
        }));
        this.scheduledRefreshes.set(key, store);
    }
    createSettingsOrderByTocIndex(resolvedSettingsRoot) {
        const index = new Map();
        function indexSettings(resolvedSettingsRoot, counter = 0) {
            if (resolvedSettingsRoot.settings) {
                for (const setting of resolvedSettingsRoot.settings) {
                    if (!index.has(setting.key)) {
                        index.set(setting.key, counter++);
                    }
                }
            }
            if (resolvedSettingsRoot.children) {
                for (const child of resolvedSettingsRoot.children) {
                    counter = indexSettings(child, counter);
                }
            }
            return counter;
        }
        indexSettings(resolvedSettingsRoot);
        return index;
    }
    refreshModels(resolvedSettingsRoot) {
        // Both calls to refreshModels require a valid settingsTreeModel.
        this.settingsTreeModel.value.update(resolvedSettingsRoot);
        this.tocTreeModel.settingsTreeRoot = this.settingsTreeModel.value.root;
        this.settingsOrderByTocIndex = this.createSettingsOrderByTocIndex(resolvedSettingsRoot);
    }
    async onConfigUpdate(keys, forceRefresh = false, schemaChange = false) {
        if (keys && this.settingsTreeModel) {
            return this.updateElementsByKey(keys);
        }
        if (!this.defaultSettingsEditorModel) {
            return;
        }
        const groups = this.defaultSettingsEditorModel.settingsGroups.slice(1); // Without commonlyUsed
        const coreSettings = groups.filter(g => !g.extensionInfo);
        const settingsResult = resolveSettingsTree(tocData, coreSettings, this.logService);
        const resolvedSettingsRoot = settingsResult.tree;
        // Warn for settings not included in layout
        if (settingsResult.leftoverSettings.size && !this.hasWarnedMissingSettings) {
            const settingKeyList = [];
            settingsResult.leftoverSettings.forEach(s => {
                settingKeyList.push(s.key);
            });
            this.logService.warn(`SettingsEditor2: Settings not included in settingsLayout.ts: ${settingKeyList.join(', ')}`);
            this.hasWarnedMissingSettings = true;
        }
        const additionalGroups = [];
        let setAdditionalGroups = false;
        const toggleData = await getExperimentalExtensionToggleData(this.contextKeyService, this.extensionGalleryService, this.productService);
        if (toggleData && groups.filter(g => g.extensionInfo).length) {
            for (const key in toggleData.settingsEditorRecommendedExtensions) {
                const extension = toggleData.recommendedExtensionsGalleryInfo[key];
                if (!extension) {
                    continue;
                }
                const extensionId = extension.identifier.id;
                // prevent race between extension update handler and this (onConfigUpdate) handler
                await this.refreshInstalledExtensionsList();
                const extensionInstalled = this.installedExtensionIds.includes(extensionId);
                // Drill down to see whether the group and setting already exist
                // and need to be removed.
                const matchingGroupIndex = groups.findIndex(g => g.extensionInfo && g.extensionInfo.id.toLowerCase() === extensionId.toLowerCase() &&
                    g.sections.length === 1 && g.sections[0].settings.length === 1 && g.sections[0].settings[0].displayExtensionId);
                if (extensionInstalled || this.dismissedExtensionSettings.includes(extensionId)) {
                    if (matchingGroupIndex !== -1) {
                        groups.splice(matchingGroupIndex, 1);
                        setAdditionalGroups = true;
                    }
                    continue;
                }
                if (matchingGroupIndex !== -1) {
                    continue;
                }
                // Create the entry. extensionInstalled is false in this case.
                let manifest = null;
                try {
                    manifest = await raceTimeout(this.extensionGalleryService.getManifest(extension, CancellationToken.None), EXTENSION_FETCH_TIMEOUT_MS) ?? null;
                }
                catch (e) {
                    // Likely a networking issue.
                    // Skip adding a button for this extension to the Settings editor.
                    continue;
                }
                if (manifest === null) {
                    continue;
                }
                const contributesConfiguration = manifest?.contributes?.configuration;
                let groupTitle;
                if (!Array.isArray(contributesConfiguration)) {
                    groupTitle = contributesConfiguration?.title;
                }
                else if (contributesConfiguration.length === 1) {
                    groupTitle = contributesConfiguration[0].title;
                }
                const recommendationInfo = toggleData.settingsEditorRecommendedExtensions[key];
                const extensionName = extension.displayName ?? extension.name ?? extensionId;
                const settingKey = `${key}.manageExtension`;
                const setting = {
                    range: nullRange,
                    key: settingKey,
                    keyRange: nullRange,
                    value: null,
                    valueRange: nullRange,
                    description: [recommendationInfo.onSettingsEditorOpen?.descriptionOverride ?? extension.description],
                    descriptionIsMarkdown: false,
                    descriptionRanges: [],
                    scope: 4 /* ConfigurationScope.WINDOW */,
                    type: 'null',
                    displayExtensionId: extensionId,
                    extensionGroupTitle: groupTitle ?? extensionName,
                    categoryLabel: 'Extensions',
                    title: extensionName
                };
                const additionalGroup = {
                    sections: [{
                            settings: [setting],
                        }],
                    id: extensionId,
                    title: setting.extensionGroupTitle,
                    titleRange: nullRange,
                    range: nullRange,
                    extensionInfo: {
                        id: extensionId,
                        displayName: extension.displayName,
                    }
                };
                groups.push(additionalGroup);
                additionalGroups.push(additionalGroup);
                setAdditionalGroups = true;
            }
        }
        resolvedSettingsRoot.children.push(await createTocTreeForExtensionSettings(this.extensionService, groups.filter(g => g.extensionInfo)));
        const commonlyUsedDataToUse = getCommonlyUsedData(toggleData);
        const commonlyUsed = resolveSettingsTree(commonlyUsedDataToUse, groups, this.logService);
        resolvedSettingsRoot.children.unshift(commonlyUsed.tree);
        if (toggleData && setAdditionalGroups) {
            // Add the additional groups to the model to help with searching.
            this.defaultSettingsEditorModel.setAdditionalGroups(additionalGroups);
        }
        if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && (this.viewState.settingsTarget instanceof URI || this.viewState.settingsTarget === 5 /* ConfigurationTarget.WORKSPACE */)) {
            const configuredUntrustedWorkspaceSettings = resolveConfiguredUntrustedSettings(groups, this.viewState.settingsTarget, this.viewState.languageFilter, this.configurationService);
            if (configuredUntrustedWorkspaceSettings.length) {
                resolvedSettingsRoot.children.unshift({
                    id: 'workspaceTrust',
                    label: localize('settings require trust', "Workspace Trust"),
                    settings: configuredUntrustedWorkspaceSettings
                });
            }
        }
        this.searchResultModel?.updateChildren();
        if (this.settingsTreeModel.value) {
            this.refreshModels(resolvedSettingsRoot);
            if (schemaChange && this.searchResultModel) {
                // If an extension's settings were just loaded and a search is active, retrigger the search so it shows up
                return await this.onSearchInputChanged(false);
            }
            this.refreshTOCTree();
            this.renderTree(undefined, forceRefresh);
        }
        else {
            this.settingsTreeModel.value = this.instantiationService.createInstance(SettingsTreeModel, this.viewState, this.workspaceTrustManagementService.isWorkspaceTrusted());
            this.refreshModels(resolvedSettingsRoot);
            // Don't restore the cached state if we already have a query value from calling _setOptions().
            const cachedState = !this.viewState.query ? this.restoreCachedState() : undefined;
            if (cachedState?.searchQuery || this.searchWidget.getValue()) {
                await this.onSearchInputChanged(true);
            }
            else {
                this.refreshTOCTree();
                this.refreshTree();
                this.tocTree.collapseAll();
            }
        }
    }
    updateElementsByKey(keys) {
        if (keys.size) {
            if (this.searchResultModel) {
                keys.forEach(key => this.searchResultModel.updateElementsByName(key));
            }
            if (this.settingsTreeModel.value) {
                keys.forEach(key => this.settingsTreeModel.value.updateElementsByName(key));
            }
            keys.forEach(key => this.renderTree(key));
        }
        else {
            this.renderTree();
        }
    }
    getActiveControlInSettingsTree() {
        const element = this.settingsTree.getHTMLElement();
        const activeElement = element.ownerDocument.activeElement;
        return (activeElement && DOM.isAncestorOfActiveElement(element)) ?
            activeElement :
            null;
    }
    renderTree(key, force = false) {
        if (!force && key && this.scheduledRefreshes.has(key)) {
            this.updateModifiedLabelForKey(key);
            return;
        }
        // If the context view is focused, delay rendering settings
        if (this.contextViewFocused()) {
            const element = this.window.document.querySelector('.context-view');
            if (element) {
                this.scheduleRefresh(element, key);
            }
            return;
        }
        // If a setting control is currently focused, schedule a refresh for later
        const activeElement = this.getActiveControlInSettingsTree();
        const focusedSetting = activeElement && this.settingRenderers.getSettingDOMElementForDOMElement(activeElement);
        if (focusedSetting && !force) {
            // If a single setting is being refreshed, it's ok to refresh now if that is not the focused setting
            if (key) {
                const focusedKey = focusedSetting.getAttribute(AbstractSettingRenderer.SETTING_KEY_ATTR);
                if (focusedKey === key &&
                    // update `list`s live, as they have a separate "submit edit" step built in before this
                    (focusedSetting.parentElement && !focusedSetting.parentElement.classList.contains('setting-item-list'))) {
                    this.updateModifiedLabelForKey(key);
                    this.scheduleRefresh(focusedSetting, key);
                    return;
                }
            }
            else {
                this.scheduleRefresh(focusedSetting);
                return;
            }
        }
        this.renderResultCountMessages();
        if (key) {
            const elements = this.currentSettingsModel?.getElementsByName(key);
            if (elements?.length) {
                if (elements.length >= 2) {
                    console.warn('More than one setting with key ' + key + ' found');
                }
                this.refreshSingleElement(elements[0]);
            }
            else {
                // Refresh requested for a key that we don't know about
                return;
            }
        }
        else {
            this.refreshTree();
        }
        return;
    }
    contextViewFocused() {
        return !!DOM.findParentWithClass(this.rootElement.ownerDocument.activeElement, 'context-view');
    }
    refreshSingleElement(element) {
        if (this.isVisible()) {
            if (!element.setting.deprecationMessage || element.isConfigured) {
                this.settingsTree.rerender(element);
            }
        }
    }
    refreshTree() {
        if (this.isVisible() && this.currentSettingsModel) {
            this.settingsTree.setChildren(null, createGroupIterator(this.currentSettingsModel.root));
        }
    }
    refreshTOCTree() {
        if (this.isVisible()) {
            this.tocTreeModel.update();
            this.tocTree.setChildren(null, createTOCIterator(this.tocTreeModel, this.tocTree));
        }
    }
    updateModifiedLabelForKey(key) {
        if (!this.currentSettingsModel) {
            return;
        }
        const dataElements = this.currentSettingsModel.getElementsByName(key);
        const isModified = dataElements && dataElements[0] && dataElements[0].isConfigured; // all elements are either configured or not
        const elements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), key);
        if (elements && elements[0]) {
            elements[0].classList.toggle('is-configured', !!isModified);
        }
    }
    async onSearchInputChanged(expandResults) {
        if (!this.currentSettingsModel) {
            // Initializing search widget value
            return;
        }
        const query = this.searchWidget.getValue().trim();
        this.viewState.query = query;
        await this.triggerSearch(query.replace(/\u203A/g, ' '), expandResults);
    }
    parseSettingFromJSON(query) {
        const match = query.match(/"([a-zA-Z.]+)": /);
        return match && match[1];
    }
    /**
     * Toggles the visibility of the Settings editor table of contents during a search
     * depending on the behavior.
     */
    toggleTocBySearchBehaviorType() {
        const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
        const hideToc = tocBehavior === 'hide';
        if (hideToc) {
            this.splitView.setViewVisible(0, false);
            this.splitView.style({
                separatorBorder: Color.transparent
            });
        }
        else {
            this.layoutSplitView(this.dimension);
        }
    }
    async triggerSearch(query, expandResults) {
        const progressRunner = this.editorProgressService.show(true, 800);
        this.viewState.tagFilters = new Set();
        this.viewState.extensionFilters = new Set();
        this.viewState.featureFilters = new Set();
        this.viewState.idFilters = new Set();
        this.viewState.languageFilter = undefined;
        if (query) {
            const parsedQuery = parseQuery(query);
            query = parsedQuery.query;
            parsedQuery.tags.forEach(tag => this.viewState.tagFilters.add(tag));
            parsedQuery.extensionFilters.forEach(extensionId => this.viewState.extensionFilters.add(extensionId));
            parsedQuery.featureFilters.forEach(feature => this.viewState.featureFilters.add(feature));
            parsedQuery.idFilters.forEach(id => this.viewState.idFilters.add(id));
            this.viewState.languageFilter = parsedQuery.languageFilter;
        }
        this.settingsTargetsWidget.updateLanguageFilterIndicators(this.viewState.languageFilter);
        if (query && query !== '@') {
            query = this.parseSettingFromJSON(query) || query;
            await this.triggerFilterPreferences(query, expandResults, progressRunner);
            this.toggleTocBySearchBehaviorType();
        }
        else {
            if (this.viewState.tagFilters.size || this.viewState.extensionFilters.size || this.viewState.featureFilters.size || this.viewState.idFilters.size || this.viewState.languageFilter) {
                this.searchResultModel = this.createFilterModel();
            }
            else {
                this.searchResultModel = null;
            }
            this.searchDelayer.cancel();
            this.aiSearchDelayer.cancel();
            if (this.searchInProgress) {
                this.searchInProgress.dispose(true);
                this.searchInProgress = null;
            }
            if (expandResults) {
                this.tocTree.setFocus([]);
                this.viewState.filterToCategory = undefined;
            }
            this.tocTreeModel.currentSearchModel = this.searchResultModel;
            if (this.searchResultModel) {
                // Added a filter model
                if (expandResults) {
                    this.tocTree.setSelection([]);
                    this.tocTree.expandAll();
                }
                this.refreshTOCTree();
                this.renderResultCountMessages();
                this.refreshTree();
                this.toggleTocBySearchBehaviorType();
            }
            else if (!this.tocTreeDisposed) {
                // Leaving search mode
                this.tocTree.collapseAll();
                this.refreshTOCTree();
                this.renderResultCountMessages();
                this.refreshTree();
                this.layoutSplitView(this.dimension);
            }
            progressRunner.done();
        }
    }
    /**
     * Return a fake SearchResultModel which can hold a flat list of all settings, to be filtered (@modified etc)
     */
    createFilterModel() {
        const filterModel = this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
        const fullResult = {
            filterMatches: [],
            exactMatch: false,
        };
        for (const g of this.defaultSettingsEditorModel.settingsGroups.slice(1)) {
            for (const sect of g.sections) {
                for (const setting of sect.settings) {
                    fullResult.filterMatches.push({
                        setting,
                        matches: [],
                        matchType: SettingMatchType.None,
                        keyMatchScore: 0,
                        score: 0,
                        providerName: 'filterModel'
                    });
                }
            }
        }
        filterModel.setResult(0, fullResult);
        return filterModel;
    }
    async triggerFilterPreferences(query, expandResults, progressRunner) {
        if (this.searchInProgress) {
            this.searchInProgress.dispose(true);
            this.searchInProgress = null;
        }
        const searchInProgress = this.searchInProgress = new CancellationTokenSource();
        if (this.showAiResultsAction?.checked) {
            return this.searchDelayer.trigger(async () => {
                // Use both embeddings and LLM results from the AI search.
                if (searchInProgress.token.isCancellationRequested) {
                    return;
                }
                const embeddingsResults = await this.doAiSearch(query, searchInProgress.token);
                if (!this.searchResultModel || searchInProgress.token.isCancellationRequested) {
                    return;
                }
                this.searchResultModel.showAiResults = true;
                if (embeddingsResults?.filterMatches.length) {
                    this.aiSearchDelayer.trigger(async () => {
                        await this.getLLMRankedResults(query, searchInProgress.token);
                        if (searchInProgress.token.isCancellationRequested) {
                            return;
                        }
                        this.onDidFinishSearch(expandResults, progressRunner);
                    });
                }
                else {
                    this.onDidFinishSearch(expandResults, progressRunner);
                }
            });
        }
        // Use the local search algorithm and only the embeddings from the AI search.
        return this.searchDelayer.trigger(async () => {
            if (searchInProgress.token.isCancellationRequested) {
                return;
            }
            const localResults = await this.doLocalSearch(query, searchInProgress.token);
            if (!this.searchResultModel || searchInProgress.token.isCancellationRequested) {
                return;
            }
            this.searchResultModel.showAiResults = false;
            if (localResults && localResults.filterMatches.length > 0) {
                // The remote results might take a while and
                // are always appended to the end anyway, so
                // show some results now.
                this.onDidFinishSearch(expandResults, undefined);
            }
            if (!localResults || !localResults.exactMatch) {
                await this.doRemoteSearch(query, searchInProgress.token);
            }
            if (searchInProgress.token.isCancellationRequested) {
                return;
            }
            this.onDidFinishSearch(expandResults, progressRunner);
        });
    }
    onDidFinishSearch(expandResults, progressRunner) {
        this.tocTreeModel.currentSearchModel = this.searchResultModel;
        if (expandResults) {
            this.tocTree.setFocus([]);
            this.viewState.filterToCategory = undefined;
            this.tocTree.expandAll();
            this.settingsTree.scrollTop = 0;
        }
        this.refreshTOCTree();
        this.renderTree(undefined, true);
        progressRunner?.done();
    }
    doLocalSearch(query, token) {
        const localSearchProvider = this.preferencesSearchService.getLocalSearchProvider(query);
        return this.searchWithProvider(0 /* SearchResultIdx.Local */, localSearchProvider, token);
    }
    doRemoteSearch(query, token) {
        const remoteSearchProvider = this.preferencesSearchService.getRemoteSearchProvider(query);
        if (!remoteSearchProvider) {
            return Promise.resolve(null);
        }
        return this.searchWithProvider(1 /* SearchResultIdx.Remote */, remoteSearchProvider, token);
    }
    doAiSearch(query, token) {
        const aiSearchProvider = this.preferencesSearchService.getAiSearchProvider(query);
        return this.searchWithProvider(3 /* SearchResultIdx.Embeddings */, aiSearchProvider, token);
    }
    async getLLMRankedResults(query, token) {
        const aiSearchProvider = this.preferencesSearchService.getAiSearchProvider(query);
        const result = await aiSearchProvider.getLLMRankedResults(token);
        // This function has to be called after doAiSearch is called and done.
        this.searchResultModel.setResult(4 /* SearchResultIdx.AiSelected */, result);
        return result;
    }
    async searchWithProvider(type, searchProvider, token) {
        const result = await this._searchPreferencesModel(this.defaultSettingsEditorModel, searchProvider, token);
        if (token.isCancellationRequested) {
            // Handle cancellation like this because cancellation is lost inside the search provider due to async/await
            return null;
        }
        this.searchResultModel ??= this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
        this.searchResultModel.setResult(type, result);
        return result;
    }
    renderResultCountMessages() {
        if (!this.currentSettingsModel) {
            return;
        }
        this.clearFilterLinkContainer.style.display = this.viewState.tagFilters && this.viewState.tagFilters.size > 0
            ? 'initial'
            : 'none';
        if (!this.searchResultModel) {
            if (this.countElement.style.display !== 'none') {
                this.searchResultLabel = null;
                this.updateInputAriaLabel();
                this.countElement.style.display = 'none';
                this.countElement.innerText = '';
                this.layout(this.dimension);
            }
            this.rootElement.classList.remove('no-results');
            this.splitView.el.style.visibility = 'visible';
            return;
        }
        else {
            const count = this.searchResultModel.getUniqueResultsCount();
            let resultString;
            switch (count) {
                case 0:
                    resultString = localize('noResults', "No Settings Found");
                    break;
                case 1:
                    resultString = localize('oneResult', "1 Setting Found");
                    break;
                default: resultString = localize('moreThanOneResult', "{0} Settings Found", count);
            }
            this.searchResultLabel = resultString;
            this.updateInputAriaLabel();
            this.countElement.innerText = resultString;
            aria.status(resultString);
            if (this.countElement.style.display !== 'block') {
                this.countElement.style.display = 'block';
                this.layout(this.dimension);
            }
            this.rootElement.classList.toggle('no-results', count === 0);
            this.splitView.el.style.visibility = count === 0 ? 'hidden' : 'visible';
        }
    }
    async _searchPreferencesModel(model, provider, token) {
        try {
            return await provider.searchModel(model, token);
        }
        catch (err) {
            if (isCancellationError(err)) {
                return Promise.reject(err);
            }
            else {
                return null;
            }
        }
    }
    layoutSplitView(dimension) {
        if (!this.isVisible()) {
            return;
        }
        const listHeight = dimension.height - (72 + 11 + 14 /* header height + editor padding */);
        this.splitView.el.style.height = `${listHeight}px`;
        // We call layout first so the splitView has an idea of how much
        // space it has, otherwise setViewVisible results in the first panel
        // showing up at the minimum size whenever the Settings editor
        // opens for the first time.
        this.splitView.layout(this.bodyContainer.clientWidth, listHeight);
        const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
        const hideTocForSearch = tocBehavior === 'hide' && this.searchResultModel;
        if (!hideTocForSearch) {
            const firstViewWasVisible = this.splitView.isViewVisible(0);
            const firstViewVisible = this.bodyContainer.clientWidth >= SettingsEditor2_1.NARROW_TOTAL_WIDTH;
            this.splitView.setViewVisible(0, firstViewVisible);
            // If the first view is again visible, and we have enough space, immediately set the
            // editor to use the reset width rather than the cached min width
            if (!firstViewWasVisible && firstViewVisible && this.bodyContainer.clientWidth >= SettingsEditor2_1.EDITOR_MIN_WIDTH + SettingsEditor2_1.TOC_RESET_WIDTH) {
                this.splitView.resizeView(0, SettingsEditor2_1.TOC_RESET_WIDTH);
            }
            this.splitView.style({
                separatorBorder: firstViewVisible ? this.theme.getColor(settingsSashBorder) : Color.transparent
            });
        }
    }
    saveState() {
        if (this.isVisible()) {
            const searchQuery = this.searchWidget.getValue().trim();
            const target = this.settingsTargetsWidget.settingsTarget;
            if (this.input) {
                this.editorMemento.saveEditorState(this.group, this.input, { searchQuery, target });
            }
        }
        else if (this.input) {
            this.editorMemento.clearEditorState(this.input, this.group);
        }
        super.saveState();
    }
};
SettingsEditor2 = SettingsEditor2_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IWorkbenchConfigurationService),
    __param(3, ITextResourceConfigurationService),
    __param(4, IThemeService),
    __param(5, IPreferencesService),
    __param(6, IInstantiationService),
    __param(7, IPreferencesSearchService),
    __param(8, ILogService),
    __param(9, IContextKeyService),
    __param(10, IStorageService),
    __param(11, IEditorGroupsService),
    __param(12, IUserDataSyncWorkbenchService),
    __param(13, IUserDataSyncEnablementService),
    __param(14, IWorkspaceTrustManagementService),
    __param(15, IExtensionService),
    __param(16, ILanguageService),
    __param(17, IExtensionManagementService),
    __param(18, IProductService),
    __param(19, IExtensionGalleryService),
    __param(20, IEditorProgressService),
    __param(21, IUserDataProfileService),
    __param(22, IAiSettingsSearchService)
], SettingsEditor2);
export { SettingsEditor2 };
let SyncControls = class SyncControls extends Disposable {
    constructor(window, container, commandService, userDataSyncService, userDataSyncEnablementService, telemetryService) {
        super();
        this.commandService = commandService;
        this.userDataSyncService = userDataSyncService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this._onDidChangeLastSyncedLabel = this._register(new Emitter());
        this.onDidChangeLastSyncedLabel = this._onDidChangeLastSyncedLabel.event;
        const headerRightControlsContainer = DOM.append(container, $('.settings-right-controls'));
        const turnOnSyncButtonContainer = DOM.append(headerRightControlsContainer, $('.turn-on-sync'));
        this.turnOnSyncButton = this._register(new Button(turnOnSyncButtonContainer, { title: true, ...defaultButtonStyles }));
        this.lastSyncedLabel = DOM.append(headerRightControlsContainer, $('.last-synced-label'));
        DOM.hide(this.lastSyncedLabel);
        this.turnOnSyncButton.enabled = true;
        this.turnOnSyncButton.label = localize('turnOnSyncButton', "Backup and Sync Settings");
        DOM.hide(this.turnOnSyncButton.element);
        this._register(this.turnOnSyncButton.onDidClick(async () => {
            await this.commandService.executeCommand('workbench.userDataSync.actions.turnOn');
        }));
        this.updateLastSyncedTime();
        this._register(this.userDataSyncService.onDidChangeLastSyncTime(() => {
            this.updateLastSyncedTime();
        }));
        const updateLastSyncedTimer = this._register(new DOM.WindowIntervalTimer());
        updateLastSyncedTimer.cancelAndSet(() => this.updateLastSyncedTime(), 60 * 1000, window);
        this.update();
        this._register(this.userDataSyncService.onDidChangeStatus(() => {
            this.update();
        }));
        this._register(this.userDataSyncEnablementService.onDidChangeEnablement(() => {
            this.update();
        }));
    }
    updateLastSyncedTime() {
        const last = this.userDataSyncService.lastSyncTime;
        let label;
        if (typeof last === 'number') {
            const d = fromNow(last, true, undefined, true);
            label = localize('lastSyncedLabel', "Last synced: {0}", d);
        }
        else {
            label = '';
        }
        this.lastSyncedLabel.textContent = label;
        this._onDidChangeLastSyncedLabel.fire(label);
    }
    update() {
        if (this.userDataSyncService.status === "uninitialized" /* SyncStatus.Uninitialized */) {
            return;
        }
        if (this.userDataSyncEnablementService.isEnabled() || this.userDataSyncService.status !== "idle" /* SyncStatus.Idle */) {
            DOM.show(this.lastSyncedLabel);
            DOM.hide(this.turnOnSyncButton.element);
        }
        else {
            DOM.hide(this.lastSyncedLabel);
            DOM.show(this.turnOnSyncButton.element);
        }
    }
};
SyncControls = __decorate([
    __param(2, ICommandService),
    __param(3, IUserDataSyncService),
    __param(4, IUserDataSyncEnablementService),
    __param(5, ITelemetryService)
], SyncControls);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3NFZGl0b3IyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzRWRpdG9yMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNsRixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDL0UsT0FBTyxLQUFLLElBQUksTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDdEUsT0FBTyxFQUFlLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNwRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUdwRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRS9E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