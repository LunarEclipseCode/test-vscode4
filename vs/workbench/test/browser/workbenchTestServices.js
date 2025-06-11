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
import { FileEditorInput } from '../../contrib/files/browser/editors/fileEditorInput.js';
import { TestInstantiationService } from '../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { basename, isEqual } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../platform/telemetry/common/telemetryUtils.js';
import { EditorInput } from '../../common/editor/editorInput.js';
import { EditorExtensions, EditorExtensions as Extensions } from '../../common/editor.js';
import { DEFAULT_EDITOR_PART_OPTIONS } from '../../browser/parts/editor/editor.js';
import { Event, Emitter } from '../../../base/common/event.js';
import { IWorkingCopyBackupService } from '../../services/workingCopy/common/workingCopyBackup.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IWorkbenchLayoutService } from '../../services/layout/browser/layoutService.js';
import { TextModelResolverService } from '../../services/textmodelResolver/common/textModelResolverService.js';
import { ITextModelService } from '../../../editor/common/services/resolverService.js';
import { IUntitledTextEditorService, UntitledTextEditorService } from '../../services/untitled/common/untitledTextEditorService.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { ILifecycleService } from '../../services/lifecycle/common/lifecycle.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { IFileService } from '../../../platform/files/common/files.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { LanguageService } from '../../../editor/common/services/languageService.js';
import { ModelService } from '../../../editor/common/services/modelService.js';
import { ITextFileService } from '../../services/textfile/common/textfiles.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { IHistoryService } from '../../services/history/common/history.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { TestConfigurationService } from '../../../platform/configuration/test/common/testConfigurationService.js';
import { TestWorkspace } from '../../../platform/workspace/test/common/testWorkspace.js';
import { IEnvironmentService } from '../../../platform/environment/common/environment.js';
import { IThemeService } from '../../../platform/theme/common/themeService.js';
import { TestThemeService } from '../../../platform/theme/test/common/testThemeService.js';
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from '../../../editor/common/services/textResourceConfiguration.js';
import { Position as EditorPosition } from '../../../editor/common/core/position.js';
import { IMenuService } from '../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { MockContextKeyService, MockKeybindingService } from '../../../platform/keybinding/test/common/mockKeybindingService.js';
import { Range } from '../../../editor/common/core/range.js';
import { IDialogService, IFileDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../platform/notification/test/common/testNotificationService.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { IDecorationsService } from '../../services/decorations/common/decorations.js';
import { toDisposable, Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { ICodeEditorService } from '../../../editor/browser/services/codeEditorService.js';
import { EditorPaneDescriptor } from '../../browser/editor.js';
import { ILoggerService, ILogService, NullLogService } from '../../../platform/log/common/log.js';
import { ILabelService } from '../../../platform/label/common/label.js';
import { DeferredPromise, timeout } from '../../../base/common/async.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { LabelService } from '../../services/label/common/labelService.js';
import { bufferToStream, VSBuffer } from '../../../base/common/buffer.js';
import { Schemas } from '../../../base/common/network.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import product from '../../../platform/product/common/product.js';
import { IHostService } from '../../services/host/browser/host.js';
import { IWorkingCopyService, WorkingCopyService } from '../../services/workingCopy/common/workingCopyService.js';
import { IFilesConfigurationService, FilesConfigurationService } from '../../services/filesConfiguration/common/filesConfigurationService.js';
import { IAccessibilityService } from '../../../platform/accessibility/common/accessibility.js';
import { BrowserWorkbenchEnvironmentService } from '../../services/environment/browser/environmentService.js';
import { BrowserTextFileService } from '../../services/textfile/browser/browserTextFileService.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { createTextBufferFactoryFromStream } from '../../../editor/common/model/textModel.js';
import { IPathService } from '../../services/path/common/pathService.js';
import { IProgressService, Progress } from '../../../platform/progress/common/progress.js';
import { IWorkingCopyFileService, WorkingCopyFileService } from '../../services/workingCopy/common/workingCopyFileService.js';
import { UndoRedoService } from '../../../platform/undoRedo/common/undoRedoService.js';
import { IUndoRedoService } from '../../../platform/undoRedo/common/undoRedo.js';
import { TextFileEditorModel } from '../../services/textfile/common/textFileEditorModel.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { EditorPane } from '../../browser/parts/editor/editorPane.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { TestDialogService } from '../../../platform/dialogs/test/common/testDialogService.js';
import { CodeEditorService } from '../../services/editor/browser/codeEditorService.js';
import { MainEditorPart } from '../../browser/parts/editor/editorPart.js';
import { IQuickInputService } from '../../../platform/quickinput/common/quickInput.js';
import { QuickInputService } from '../../services/quickinput/browser/quickInputService.js';
import { IListService } from '../../../platform/list/browser/listService.js';
import { win32, posix } from '../../../base/common/path.js';
import { TestContextService, TestStorageService, TestTextResourcePropertiesService, TestExtensionService, TestProductService, createFileStat, TestLoggerService, TestWorkspaceTrustManagementService, TestWorkspaceTrustRequestService, TestMarkerService, TestHistoryService } from '../common/workbenchTestServices.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../../platform/uriIdentity/common/uriIdentityService.js';
import { InMemoryFileSystemProvider } from '../../../platform/files/common/inMemoryFilesystemProvider.js';
import { newWriteableStream } from '../../../base/common/stream.js';
import { EncodingOracle } from '../../services/textfile/browser/textFileService.js';
import { UTF16le, UTF16be, UTF8_with_bom } from '../../services/textfile/common/encoding.js';
import { ColorScheme } from '../../../platform/theme/common/theme.js';
import { Iterable } from '../../../base/common/iterator.js';
import { InMemoryWorkingCopyBackupService } from '../../services/workingCopy/common/workingCopyBackupService.js';
import { BrowserWorkingCopyBackupService } from '../../services/workingCopy/browser/workingCopyBackupService.js';
import { FileService } from '../../../platform/files/common/fileService.js';
import { TextResourceEditor } from '../../browser/parts/editor/textResourceEditor.js';
import { TestCodeEditor } from '../../../editor/test/browser/testCodeEditor.js';
import { TextFileEditor } from '../../contrib/files/browser/editors/textFileEditor.js';
import { TextResourceEditorInput } from '../../common/editor/textResourceEditorInput.js';
import { UntitledTextEditorInput } from '../../services/untitled/common/untitledTextEditorInput.js';
import { SideBySideEditor } from '../../browser/parts/editor/sideBySideEditor.js';
import { IWorkspacesService } from '../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from '../../../platform/workspace/common/workspaceTrust.js';
import { ITerminalLogService } from '../../../platform/terminal/common/terminal.js';
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService } from '../../contrib/terminal/browser/terminal.js';
import { assertReturnsDefined, upcast } from '../../../base/common/types.js';
import { ITerminalProfileResolverService, ITerminalProfileService } from '../../contrib/terminal/common/terminal.js';
import { EditorResolverService } from '../../services/editor/browser/editorResolverService.js';
import { FILE_EDITOR_INPUT_ID } from '../../contrib/files/common/files.js';
import { IEditorResolverService } from '../../services/editor/common/editorResolverService.js';
import { IWorkingCopyEditorService, WorkingCopyEditorService } from '../../services/workingCopy/common/workingCopyEditorService.js';
import { IElevatedFileService } from '../../services/files/common/elevatedFileService.js';
import { BrowserElevatedFileService } from '../../services/files/browser/elevatedFileService.js';
import { IEditorWorkerService } from '../../../editor/common/services/editorWorker.js';
import { ResourceMap } from '../../../base/common/map.js';
import { SideBySideEditorInput } from '../../common/editor/sideBySideEditorInput.js';
import { ITextEditorService, TextEditorService } from '../../services/textfile/common/textEditorService.js';
import { IPaneCompositePartService } from '../../services/panecomposite/browser/panecomposite.js';
import { ILanguageConfigurationService } from '../../../editor/common/languages/languageConfigurationRegistry.js';
import { TestLanguageConfigurationService } from '../../../editor/test/common/modes/testLanguageConfigurationService.js';
import { env } from '../../../base/common/process.js';
import { isValidBasename } from '../../../base/common/extpath.js';
import { TestAccessibilityService } from '../../../platform/accessibility/test/common/testAccessibilityService.js';
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from '../../../editor/common/services/languageFeatureDebounce.js';
import { ILanguageFeaturesService } from '../../../editor/common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../../editor/common/services/languageFeaturesService.js';
import { TextEditorPaneSelection } from '../../browser/parts/editor/textEditor.js';
import { Selection } from '../../../editor/common/core/selection.js';
import { TestEditorWorkerService } from '../../../editor/test/common/services/testEditorWorkerService.js';
import { IRemoteAgentService } from '../../services/remote/common/remoteAgentService.js';
import { ILanguageDetectionService } from '../../services/languageDetection/common/languageDetectionWorkerService.js';
import { IUserDataProfilesService, toUserDataProfile, UserDataProfilesService } from '../../../platform/userDataProfile/common/userDataProfile.js';
import { UserDataProfileService } from '../../services/userDataProfile/common/userDataProfileService.js';
import { IUserDataProfileService } from '../../services/userDataProfile/common/userDataProfile.js';
import { Codicon } from '../../../base/common/codicons.js';
import { IRemoteSocketFactoryService, RemoteSocketFactoryService } from '../../../platform/remote/common/remoteSocketFactoryService.js';
import { EditorParts } from '../../browser/parts/editor/editorParts.js';
import { mainWindow } from '../../../base/browser/window.js';
import { IMarkerService } from '../../../platform/markers/common/markers.js';
import { IAccessibilitySignalService } from '../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IEditorPaneService } from '../../services/editor/common/editorPaneService.js';
import { EditorPaneService } from '../../services/editor/browser/editorPaneService.js';
import { IContextMenuService, IContextViewService } from '../../../platform/contextview/browser/contextView.js';
import { ContextViewService } from '../../../platform/contextview/browser/contextViewService.js';
import { CustomEditorLabelService, ICustomEditorLabelService } from '../../services/editor/common/customEditorLabelService.js';
import { TerminalConfigurationService } from '../../contrib/terminal/browser/terminalConfigurationService.js';
import { TerminalLogService } from '../../../platform/terminal/common/terminalLogService.js';
import { IEnvironmentVariableService } from '../../contrib/terminal/common/environmentVariable.js';
import { EnvironmentVariableService } from '../../contrib/terminal/common/environmentVariableService.js';
import { ContextMenuService } from '../../../platform/contextview/browser/contextMenuService.js';
import { IHoverService } from '../../../platform/hover/browser/hover.js';
import { NullHoverService } from '../../../platform/hover/test/browser/nullHoverService.js';
import { IActionViewItemService, NullActionViewItemService } from '../../../platform/actions/browser/actionViewItemService.js';
import { ITreeSitterLibraryService } from '../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { TestTreeSitterLibraryService } from '../../../editor/test/common/services/testTreeSitterLibraryService.js';
export function createFileEditorInput(instantiationService, resource) {
    return instantiationService.createInstance(FileEditorInput, resource, undefined, undefined, undefined, undefined, undefined, undefined);
}
Registry.as(EditorExtensions.EditorFactory).registerFileEditorFactory({
    typeId: FILE_EDITOR_INPUT_ID,
    createFileEditor: (resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService) => {
        return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents);
    },
    isFileEditor: (obj) => {
        return obj instanceof FileEditorInput;
    }
});
export class TestTextResourceEditor extends TextResourceEditor {
    createEditorControl(parent, configuration) {
        this.editorControl = this._register(this.instantiationService.createInstance(TestCodeEditor, parent, configuration, {}));
    }
}
export class TestTextFileEditor extends TextFileEditor {
    createEditorControl(parent, configuration) {
        this.editorControl = this._register(this.instantiationService.createInstance(TestCodeEditor, parent, configuration, { contributions: [] }));
    }
    setSelection(selection, reason) {
        this._options = selection ? upcast({ selection }) : undefined;
        this._onDidChangeSelection.fire({ reason });
    }
    getSelection() {
        const options = this.options;
        if (!options) {
            return undefined;
        }
        const textSelection = options.selection;
        if (!textSelection) {
            return undefined;
        }
        return new TextEditorPaneSelection(new Selection(textSelection.startLineNumber, textSelection.startColumn, textSelection.endLineNumber ?? textSelection.startLineNumber, textSelection.endColumn ?? textSelection.startColumn));
    }
}
export class TestWorkingCopyService extends WorkingCopyService {
    testUnregisterWorkingCopy(workingCopy) {
        return super.unregisterWorkingCopy(workingCopy);
    }
}
export function workbenchInstantiationService(overrides, disposables = new DisposableStore()) {
    const instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection([ILifecycleService, disposables.add(new TestLifecycleService())], [IActionViewItemService, new SyncDescriptor(NullActionViewItemService)])));
    instantiationService.stub(IProductService, TestProductService);
    instantiationService.stub(IEditorWorkerService, new TestEditorWorkerService());
    instantiationService.stub(IWorkingCopyService, disposables.add(new TestWorkingCopyService()));
    const environmentService = overrides?.environmentService ? overrides.environmentService(instantiationService) : TestEnvironmentService;
    instantiationService.stub(IEnvironmentService, environmentService);
    instantiationService.stub(IWorkbenchEnvironmentService, environmentService);
    instantiationService.stub(ILogService, new NullLogService());
    const contextKeyService = overrides?.contextKeyService ? overrides.contextKeyService(instantiationService) : instantiationService.createInstance(MockContextKeyService);
    instantiationService.stub(IContextKeyService, contextKeyService);
    instantiationService.stub(IProgressService, new TestProgressService());
    const workspaceContextService = new TestContextService(TestWorkspace);
    instantiationService.stub(IWorkspaceContextService, workspaceContextService);
    const configService = overrides?.configurationService ? overrides.configurationService(instantiationService) : new TestConfigurationService({
        files: {
            participants: {
                timeout: 60000
            }
        }
    });
    instantiationService.stub(IConfigurationService, configService);
    const textResourceConfigurationService = new TestTextResourceConfigurationService(configService);
    instantiationService.stub(ITextResourceConfigurationService, textResourceConfigurationService);
    instantiationService.stub(IUntitledTextEditorService, disposables.add(instantiationService.createInstance(UntitledTextEditorService)));
    instantiationService.stub(IStorageService, disposables.add(new TestStorageService()));
    instantiationService.stub(IRemoteAgentService, new TestRemoteAgentService());
    instantiationService.stub(ILanguageDetectionService, new TestLanguageDetectionService());
    instantiationService.stub(IPathService, overrides?.pathService ? overrides.pathService(instantiationService) : new TestPathService());
    const layoutService = new TestLayoutService();
    instantiationService.stub(IWorkbenchLayoutService, layoutService);
    instantiationService.stub(IDialogService, new TestDialogService());
    const accessibilityService = new TestAccessibilityService();
    instantiationService.stub(IAccessibilityService, accessibilityService);
    instantiationService.stub(IAccessibilitySignalService, {
        playSignal: async () => { },
        isSoundEnabled(signal) { return false; },
    });
    instantiationService.stub(IFileDialogService, instantiationService.createInstance(TestFileDialogService));
    instantiationService.stub(ILanguageService, disposables.add(instantiationService.createInstance(LanguageService)));
    instantiationService.stub(ILanguageFeaturesService, new LanguageFeaturesService());
    instantiationService.stub(ILanguageFeatureDebounceService, instantiationService.createInstance(LanguageFeatureDebounceService));
    instantiationService.stub(IHistoryService, new TestHistoryService());
    instantiationService.stub(ITextResourcePropertiesService, new TestTextResourcePropertiesService(configService));
    instantiationService.stub(IUndoRedoService, instantiationService.createInstance(UndoRedoService));
    const themeService = new TestThemeService();
    instantiationService.stub(IThemeService, themeService);
    instantiationService.stub(ILanguageConfigurationService, disposables.add(new TestLanguageConfigurationService()));
    instantiationService.stub(ITreeSitterLibraryService, new TestTreeSitterLibraryService());
    instantiationService.stub(IModelService, disposables.add(instantiationService.createInstance(ModelService)));
    const fileService = overrides?.fileService ? overrides.fileService(instantiationService) : disposables.add(new TestFileService());
    instantiationService.stub(IFileService, fileService);
    instantiationService.stub(IUriIdentityService, disposables.add(new UriIdentityService(fileService)));
    const markerService = new TestMarkerService();
    instantiationService.stub(IMarkerService, markerService);
    instantiationService.stub(IFilesConfigurationService, disposables.add(instantiationService.createInstance(TestFilesConfigurationService)));
    const userDataProfilesService = instantiationService.stub(IUserDataProfilesService, disposables.add(instantiationService.createInstance(UserDataProfilesService)));
    instantiationService.stub(IUserDataProfileService, disposables.add(new UserDataProfileService(userDataProfilesService.defaultProfile)));
    instantiationService.stub(IWorkingCopyBackupService, overrides?.workingCopyBackupService ? overrides?.workingCopyBackupService(instantiationService) : disposables.add(new TestWorkingCopyBackupService()));
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(INotificationService, new TestNotificationService());
    instantiationService.stub(IUntitledTextEditorService, disposables.add(instantiationService.createInstance(UntitledTextEditorService)));
    instantiationService.stub(IMenuService, new TestMenuService());
    const keybindingService = new MockKeybindingService();
    instantiationService.stub(IKeybindingService, keybindingService);
    instantiationService.stub(IDecorationsService, new TestDecorationsService());
    instantiationService.stub(IExtensionService, new TestExtensionService());
    instantiationService.stub(IWorkingCopyFileService, disposables.add(instantiationService.createInstance(WorkingCopyFileService)));
    instantiationService.stub(ITextFileService, overrides?.textFileService ? overrides.textFileService(instantiationService) : disposables.add(instantiationService.createInstance(TestTextFileService)));
    instantiationService.stub(IHostService, instantiationService.createInstance(TestHostService));
    instantiationService.stub(ITextModelService, disposables.add(instantiationService.createInstance(TextModelResolverService)));
    instantiationService.stub(ILoggerService, disposables.add(new TestLoggerService(TestEnvironmentService.logsHome)));
    const editorGroupService = new TestEditorGroupsService([new TestEditorGroupView(0)]);
    instantiationService.stub(IEditorGroupsService, editorGroupService);
    instantiationService.stub(ILabelService, disposables.add(instantiationService.createInstance(LabelService)));
    const editorService = overrides?.editorService ? overrides.editorService(instantiationService) : disposables.add(new TestEditorService(editorGroupService));
    instantiationService.stub(IEditorService, editorService);
    instantiationService.stub(IEditorPaneService, new EditorPaneService());
    instantiationService.stub(IWorkingCopyEditorService, disposables.add(instantiationService.createInstance(WorkingCopyEditorService)));
    instantiationService.stub(IEditorResolverService, disposables.add(instantiationService.createInstance(EditorResolverService)));
    const textEditorService = overrides?.textEditorService ? overrides.textEditorService(instantiationService) : disposables.add(instantiationService.createInstance(TextEditorService));
    instantiationService.stub(ITextEditorService, textEditorService);
    instantiationService.stub(ICodeEditorService, disposables.add(new CodeEditorService(editorService, themeService, configService)));
    instantiationService.stub(IPaneCompositePartService, disposables.add(new TestPaneCompositeService()));
    instantiationService.stub(IListService, new TestListService());
    instantiationService.stub(IContextViewService, disposables.add(instantiationService.createInstance(ContextViewService)));
    instantiationService.stub(IContextMenuService, disposables.add(instantiationService.createInstance(ContextMenuService)));
    instantiationService.stub(IQuickInputService, disposables.add(new QuickInputService(configService, instantiationService, keybindingService, contextKeyService, themeService, layoutService)));
    instantiationService.stub(IWorkspacesService, new TestWorkspacesService());
    instantiationService.stub(IWorkspaceTrustManagementService, disposables.add(new TestWorkspaceTrustManagementService()));
    instantiationService.stub(IWorkspaceTrustRequestService, disposables.add(new TestWorkspaceTrustRequestService(false)));
    instantiationService.stub(ITerminalInstanceService, new TestTerminalInstanceService());
    instantiationService.stub(ITerminalEditorService, new TestTerminalEditorService());
    instantiationService.stub(ITerminalGroupService, new TestTerminalGroupService());
    instantiationService.stub(ITerminalProfileService, new TestTerminalProfileService());
    instantiationService.stub(ITerminalProfileResolverService, new TestTerminalProfileResolverService());
    instantiationService.stub(ITerminalConfigurationService, disposables.add(instantiationService.createInstance(TestTerminalConfigurationService)));
    instantiationService.stub(ITerminalLogService, disposables.add(instantiationService.createInstance(TerminalLogService)));
    instantiationService.stub(IEnvironmentVariableService, disposables.add(instantiationService.createInstance(EnvironmentVariableService)));
    instantiationService.stub(IElevatedFileService, new BrowserElevatedFileService());
    instantiationService.stub(IRemoteSocketFactoryService, new RemoteSocketFactoryService());
    instantiationService.stub(ICustomEditorLabelService, disposables.add(new CustomEditorLabelService(configService, workspaceContextService)));
    instantiationService.stub(IHoverService, NullHoverService);
    return instantiationService;
}
let TestServiceAccessor = class TestServiceAccessor {
    constructor(lifecycleService, textFileService, textEditorService, workingCopyFileService, filesConfigurationService, contextService, modelService, fileService, fileDialogService, dialogService, workingCopyService, editorService, editorPaneService, environmentService, pathService, editorGroupService, editorResolverService, languageService, textModelResolverService, untitledTextEditorService, testConfigurationService, workingCopyBackupService, hostService, quickInputService, labelService, logService, uriIdentityService, instantitionService, notificationService, workingCopyEditorService, instantiationService, elevatedFileService, workspaceTrustRequestService, decorationsService, progressService) {
        this.lifecycleService = lifecycleService;
        this.textFileService = textFileService;
        this.textEditorService = textEditorService;
        this.workingCopyFileService = workingCopyFileService;
        this.filesConfigurationService = filesConfigurationService;
        this.contextService = contextService;
        this.modelService = modelService;
        this.fileService = fileService;
        this.fileDialogService = fileDialogService;
        this.dialogService = dialogService;
        this.workingCopyService = workingCopyService;
        this.editorService = editorService;
        this.editorPaneService = editorPaneService;
        this.environmentService = environmentService;
        this.pathService = pathService;
        this.editorGroupService = editorGroupService;
        this.editorResolverService = editorResolverService;
        this.languageService = languageService;
        this.textModelResolverService = textModelResolverService;
        this.untitledTextEditorService = untitledTextEditorService;
        this.testConfigurationService = testConfigurationService;
        this.workingCopyBackupService = workingCopyBackupService;
        this.hostService = hostService;
        this.quickInputService = quickInputService;
        this.labelService = labelService;
        this.logService = logService;
        this.uriIdentityService = uriIdentityService;
        this.instantitionService = instantitionService;
        this.notificationService = notificationService;
        this.workingCopyEditorService = workingCopyEditorService;
        this.instantiationService = instantiationService;
        this.elevatedFileService = elevatedFileService;
        this.workspaceTrustRequestService = workspaceTrustRequestService;
        this.decorationsService = decorationsService;
        this.progressService = progressService;
    }
};
TestServiceAccessor = __decorate([
    __param(0, ILifecycleService),
    __param(1, ITextFileService),
    __param(2, ITextEditorService),
    __param(3, IWorkingCopyFileService),
    __param(4, IFilesConfigurationService),
    __param(5, IWorkspaceContextService),
    __param(6, IModelService),
    __param(7, IFileService),
    __param(8, IFileDialogService),
    __param(9, IDialogService),
    __param(10, IWorkingCopyService),
    __param(11, IEditorService),
    __param(12, IEditorPaneService),
    __param(13, IWorkbenchEnvironmentService),
    __param(14, IPathService),
    __param(15, IEditorGroupsService),
    __param(16, IEditorResolverService),
    __param(17, ILanguageService),
    __param(18, ITextModelService),
    __param(19, IUntitledTextEditorService),
    __param(20, IConfigurationService),
    __param(21, IWorkingCopyBackupService),
    __param(22, IHostService),
    __param(23, IQuickInputService),
    __param(24, ILabelService),
    __param(25, ILogService),
    __param(26, IUriIdentityService),
    __param(27, IInstantiationService),
    __param(28, INotificationService),
    __param(29, IWorkingCopyEditorService),
    __param(30, IInstantiationService),
    __param(31, IElevatedFileService),
    __param(32, IWorkspaceTrustRequestService),
    __param(33, IDecorationsService),
    __param(34, IProgressService)
], TestServiceAccessor);
export { TestServiceAccessor };
let TestTextFileService = class TestTextFileService extends BrowserTextFileService {
    constructor(fileService, untitledTextEditorService, lifecycleService, instantiationService, modelService, environmentService, dialogService, fileDialogService, textResourceConfigurationService, filesConfigurationService, codeEditorService, pathService, workingCopyFileService, uriIdentityService, languageService, logService, elevatedFileService, decorationsService) {
        super(fileService, untitledTextEditorService, lifecycleService, instantiationService, modelService, environmentService, dialogService, fileDialogService, textResourceConfigurationService, filesConfigurationService, codeEditorService, pathService, workingCopyFileService, uriIdentityService, languageService, elevatedFileService, logService, decorationsService);
        this.readStreamError = undefined;
        this.writeError = undefined;
    }
    setReadStreamErrorOnce(error) {
        this.readStreamError = error;
    }
    async readStream(resource, options) {
        if (this.readStreamError) {
            const error = this.readStreamError;
            this.readStreamError = undefined;
            throw error;
        }
        const content = await this.fileService.readFileStream(resource, options);
        return {
            resource: content.resource,
            name: content.name,
            mtime: content.mtime,
            ctime: content.ctime,
            etag: content.etag,
            encoding: 'utf8',
            value: await createTextBufferFactoryFromStream(content.value),
            size: 10,
            readonly: false,
            locked: false
        };
    }
    setWriteErrorOnce(error) {
        this.writeError = error;
    }
    async write(resource, value, options) {
        if (this.writeError) {
            const error = this.writeError;
            this.writeError = undefined;
            throw error;
        }
        return super.write(resource, value, options);
    }
};
TestTextFileService = __decorate([
    __param(0, IFileService),
    __param(1, IUntitledTextEditorService),
    __param(2, ILifecycleService),
    __param(3, IInstantiationService),
    __param(4, IModelService),
    __param(5, IWorkbenchEnvironmentService),
    __param(6, IDialogService),
    __param(7, IFileDialogService),
    __param(8, ITextResourceConfigurationService),
    __param(9, IFilesConfigurationService),
    __param(10, ICodeEditorService),
    __param(11, IPathService),
    __param(12, IWorkingCopyFileService),
    __param(13, IUriIdentityService),
    __param(14, ILanguageService),
    __param(15, ILogService),
    __param(16, IElevatedFileService),
    __param(17, IDecorationsService)
], TestTextFileService);
export { TestTextFileService };
export class TestBrowserTextFileServiceWithEncodingOverrides extends BrowserTextFileService {
    get encoding() {
        if (!this._testEncoding) {
            this._testEncoding = this._register(this.instantiationService.createInstance(TestEncodingOracle));
        }
        return this._testEncoding;
    }
}
export class TestEncodingOracle extends EncodingOracle {
    get encodingOverrides() {
        return [
            { extension: 'utf16le', encoding: UTF16le },
            { extension: 'utf16be', encoding: UTF16be },
            { extension: 'utf8bom', encoding: UTF8_with_bom }
        ];
    }
    set encodingOverrides(overrides) { }
}
class TestEnvironmentServiceWithArgs extends BrowserWorkbenchEnvironmentService {
    constructor() {
        super(...arguments);
        this.args = [];
    }
}
export const TestEnvironmentService = new TestEnvironmentServiceWithArgs('', URI.file('tests').with({ scheme: 'vscode-tests' }), Object.create(null), TestProductService);
export class TestProgressService {
    withProgress(options, task, onDidCancel) {
        return task(Progress.None);
    }
}
export class TestDecorationsService {
    constructor() {
        this.onDidChangeDecorations = Event.None;
    }
    registerDecorationsProvider(_provider) { return Disposable.None; }
    getDecoration(_uri, _includeChildren, _overwrite) { return undefined; }
}
export class TestMenuService {
    createMenu(_id, _scopedKeybindingService) {
        return {
            onDidChange: Event.None,
            dispose: () => undefined,
            getActions: () => []
        };
    }
    getMenuActions(id, contextKeyService, options) {
        throw new Error('Method not implemented.');
    }
    getMenuContexts(id) {
        throw new Error('Method not implemented.');
    }
    resetHiddenStates() {
        // nothing
    }
}
let TestFileDialogService = class TestFileDialogService {
    constructor(pathService) {
        this.pathService = pathService;
    }
    async defaultFilePath(_schemeFilter) { return this.pathService.userHome(); }
    async defaultFolderPath(_schemeFilter) { return this.pathService.userHome(); }
    async defaultWorkspacePath(_schemeFilter) { return this.pathService.userHome(); }
    async preferredHome(_schemeFilter) { return this.pathService.userHome(); }
    pickFileFolderAndOpen(_options) { return Promise.resolve(0); }
    pickFileAndOpen(_options) { return Promise.resolve(0); }
    pickFolderAndOpen(_options) { return Promise.resolve(0); }
    pickWorkspaceAndOpen(_options) { return Promise.resolve(0); }
    setPickFileToSave(path) { this.fileToSave = path; }
    pickFileToSave(defaultUri, availableFileSystems) { return Promise.resolve(this.fileToSave); }
    showSaveDialog(_options) { return Promise.resolve(undefined); }
    showOpenDialog(_options) { return Promise.resolve(undefined); }
    setConfirmResult(result) { this.confirmResult = result; }
    showSaveConfirm(fileNamesOrResources) { return Promise.resolve(this.confirmResult); }
};
TestFileDialogService = __decorate([
    __param(0, IPathService)
], TestFileDialogService);
export { TestFileDialogService };
export class TestLayoutService {
    constructor() {
        this.openedDefaultEditors = false;
        this.mainContainerDimension = { width: 800, height: 600 };
        this.activeContainerDimension = { width: 800, height: 600 };
        this.mainContainerOffset = { top: 0, quickPickTop: 0 };
        this.activeContainerOffset = { top: 0, quickPickTop: 0 };
        this.mainContainer = mainWindow.document.body;
        this.containers = [mainWindow.document.body];
        this.activeContainer = mainWindow.document.body;
        this.onDidChangeZenMode = Event.None;
        this.onDidChangeMainEditorCenteredLayout = Event.None;
        this.onDidChangeWindowMaximized = Event.None;
        this.onDidChangePanelPosition = Event.None;
        this.onDidChangePanelAlignment = Event.None;
        this.onDidChangePartVisibility = Event.None;
        this.onDidLayoutMainContainer = Event.None;
        this.onDidLayoutActiveContainer = Event.None;
        this.onDidLayoutContainer = Event.None;
        this.onDidChangeNotificationsVisibility = Event.None;
        this.onDidAddContainer = Event.None;
        this.onDidChangeActiveContainer = Event.None;
        this.whenReady = Promise.resolve(undefined);
        this.whenRestored = Promise.resolve(undefined);
    }
    layout() { }
    isRestored() { return true; }
    hasFocus(_part) { return false; }
    focusPart(_part) { }
    hasMainWindowBorder() { return false; }
    getMainWindowBorderRadius() { return undefined; }
    isVisible(_part) { return true; }
    getContainer() { return mainWindow.document.body; }
    whenContainerStylesLoaded() { return undefined; }
    isTitleBarHidden() { return false; }
    isStatusBarHidden() { return false; }
    isActivityBarHidden() { return false; }
    setActivityBarHidden(_hidden) { }
    setBannerHidden(_hidden) { }
    isSideBarHidden() { return false; }
    async setEditorHidden(_hidden) { }
    async setSideBarHidden(_hidden) { }
    async setAuxiliaryBarHidden(_hidden) { }
    async setPartHidden(_hidden, part) { }
    isPanelHidden() { return false; }
    async setPanelHidden(_hidden) { }
    toggleMaximizedPanel() { }
    isPanelMaximized() { return false; }
    getMenubarVisibility() { throw new Error('not implemented'); }
    toggleMenuBar() { }
    getSideBarPosition() { return 0; }
    getPanelPosition() { return 0; }
    getPanelAlignment() { return 'center'; }
    async setPanelPosition(_position) { }
    async setPanelAlignment(_alignment) { }
    addClass(_clazz) { }
    removeClass(_clazz) { }
    getMaximumEditorDimensions() { throw new Error('not implemented'); }
    toggleZenMode() { }
    isMainEditorLayoutCentered() { return false; }
    centerMainEditorLayout(_active) { }
    resizePart(_part, _sizeChangeWidth, _sizeChangeHeight) { }
    getSize(part) { throw new Error('Method not implemented.'); }
    setSize(part, size) { throw new Error('Method not implemented.'); }
    registerPart(part) { return Disposable.None; }
    isWindowMaximized(targetWindow) { return false; }
    updateWindowMaximizedState(targetWindow, maximized) { }
    getVisibleNeighborPart(part, direction) { return undefined; }
    focus() { }
}
const activeViewlet = {};
export class TestPaneCompositeService extends Disposable {
    constructor() {
        super();
        this.parts = new Map();
        this.parts.set(1 /* ViewContainerLocation.Panel */, new TestPanelPart());
        this.parts.set(0 /* ViewContainerLocation.Sidebar */, new TestSideBarPart());
        this.onDidPaneCompositeOpen = Event.any(...([1 /* ViewContainerLocation.Panel */, 0 /* ViewContainerLocation.Sidebar */].map(loc => Event.map(this.parts.get(loc).onDidPaneCompositeOpen, composite => { return { composite, viewContainerLocation: loc }; }))));
        this.onDidPaneCompositeClose = Event.any(...([1 /* ViewContainerLocation.Panel */, 0 /* ViewContainerLocation.Sidebar */].map(loc => Event.map(this.parts.get(loc).onDidPaneCompositeClose, composite => { return { composite, viewContainerLocation: loc }; }))));
    }
    openPaneComposite(id, viewContainerLocation, focus) {
        return this.getPartByLocation(viewContainerLocation).openPaneComposite(id, focus);
    }
    getActivePaneComposite(viewContainerLocation) {
        return this.getPartByLocation(viewContainerLocation).getActivePaneComposite();
    }
    getPaneComposite(id, viewContainerLocation) {
        return this.getPartByLocation(viewContainerLocation).getPaneComposite(id);
    }
    getPaneComposites(viewContainerLocation) {
        return this.getPartByLocation(viewContainerLocation).getPaneComposites();
    }
    getProgressIndicator(id, viewContainerLocation) {
        return this.getPartByLocation(viewContainerLocation).getProgressIndicator(id);
    }
    hideActivePaneComposite(viewContainerLocation) {
        this.getPartByLocation(viewContainerLocation).hideActivePaneComposite();
    }
    getLastActivePaneCompositeId(viewContainerLocation) {
        return this.getPartByLocation(viewContainerLocation).getLastActivePaneCompositeId();
    }
    getPinnedPaneCompositeIds(viewContainerLocation) {
        throw new Error('Method not implemented.');
    }
    getVisiblePaneCompositeIds(viewContainerLocation) {
        throw new Error('Method not implemented.');
    }
    getPaneCompositeIds(viewContainerLocation) {
        throw new Error('Method not implemented.');
    }
    getPartByLocation(viewContainerLocation) {
        return assertReturnsDefined(this.parts.get(viewContainerLocation));
    }
}
export class TestSideBarPart {
    constructor() {
        this.onDidViewletRegisterEmitter = new Emitter();
        this.onDidViewletDeregisterEmitter = new Emitter();
        this.onDidViewletOpenEmitter = new Emitter();
        this.onDidViewletCloseEmitter = new Emitter();
        this.partId = "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */;
        this.element = undefined;
        this.minimumWidth = 0;
        this.maximumWidth = 0;
        this.minimumHeight = 0;
        this.maximumHeight = 0;
        this.onDidChange = Event.None;
        this.onDidPaneCompositeOpen = this.onDidViewletOpenEmitter.event;
        this.onDidPaneCompositeClose = this.onDidViewletCloseEmitter.event;
    }
    openPaneComposite(id, focus) { return Promise.resolve(undefined); }
    getPaneComposites() { return []; }
    getAllViewlets() { return []; }
    getActivePaneComposite() { return activeViewlet; }
    getDefaultViewletId() { return 'workbench.view.explorer'; }
    getPaneComposite(id) { return undefined; }
    getProgressIndicator(id) { return undefined; }
    hideActivePaneComposite() { }
    getLastActivePaneCompositeId() { return undefined; }
    dispose() { }
    getPinnedPaneCompositeIds() { return []; }
    getVisiblePaneCompositeIds() { return []; }
    getPaneCompositeIds() { return []; }
    layout(width, height, top, left) { }
}
export class TestPanelPart {
    constructor() {
        this.element = undefined;
        this.minimumWidth = 0;
        this.maximumWidth = 0;
        this.minimumHeight = 0;
        this.maximumHeight = 0;
        this.onDidChange = Event.None;
        this.onDidPaneCompositeOpen = new Emitter().event;
        this.onDidPaneCompositeClose = new Emitter().event;
        this.partId = "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */;
    }
    async openPaneComposite(id, focus) { return undefined; }
    getPaneComposite(id) { return activeViewlet; }
    getPaneComposites() { return []; }
    getPinnedPaneCompositeIds() { return []; }
    getVisiblePaneCompositeIds() { return []; }
    getPaneCompositeIds() { return []; }
    getActivePaneComposite() { return activeViewlet; }
    setPanelEnablement(id, enabled) { }
    dispose() { }
    getProgressIndicator(id) { return null; }
    hideActivePaneComposite() { }
    getLastActivePaneCompositeId() { return undefined; }
    layout(width, height, top, left) { }
}
export class TestViewsService {
    constructor() {
        this.onDidChangeViewContainerVisibility = new Emitter().event;
        this.onDidChangeViewVisibilityEmitter = new Emitter();
        this.onDidChangeViewVisibility = this.onDidChangeViewVisibilityEmitter.event;
        this.onDidChangeFocusedViewEmitter = new Emitter();
        this.onDidChangeFocusedView = this.onDidChangeFocusedViewEmitter.event;
    }
    isViewContainerVisible(id) { return true; }
    isViewContainerActive(id) { return true; }
    getVisibleViewContainer() { return null; }
    openViewContainer(id, focus) { return Promise.resolve(null); }
    closeViewContainer(id) { }
    isViewVisible(id) { return true; }
    getActiveViewWithId(id) { return null; }
    getViewWithId(id) { return null; }
    openView(id, focus) { return Promise.resolve(null); }
    closeView(id) { }
    getViewProgressIndicator(id) { return null; }
    getActiveViewPaneContainerWithId(id) { return null; }
    getFocusedViewName() { return ''; }
    getFocusedView() { return null; }
}
export class TestEditorGroupsService {
    constructor(groups = []) {
        this.groups = groups;
        this.parts = [this];
        this.windowId = mainWindow.vscodeWindowId;
        this.onDidCreateAuxiliaryEditorPart = Event.None;
        this.onDidChangeActiveGroup = Event.None;
        this.onDidActivateGroup = Event.None;
        this.onDidAddGroup = Event.None;
        this.onDidRemoveGroup = Event.None;
        this.onDidMoveGroup = Event.None;
        this.onDidChangeGroupIndex = Event.None;
        this.onDidChangeGroupLabel = Event.None;
        this.onDidChangeGroupLocked = Event.None;
        this.onDidChangeGroupMaximized = Event.None;
        this.onDidLayout = Event.None;
        this.onDidChangeEditorPartOptions = Event.None;
        this.onDidScroll = Event.None;
        this.onWillDispose = Event.None;
        this.orientation = 0 /* GroupOrientation.HORIZONTAL */;
        this.isReady = true;
        this.whenReady = Promise.resolve(undefined);
        this.whenRestored = Promise.resolve(undefined);
        this.hasRestorableState = false;
        this.contentDimension = { width: 800, height: 600 };
        this.mainPart = this;
    }
    get activeGroup() { return this.groups[0]; }
    get sideGroup() { return this.groups[0]; }
    get count() { return this.groups.length; }
    getPart(group) { return this; }
    saveWorkingSet(name) { throw new Error('Method not implemented.'); }
    getWorkingSets() { throw new Error('Method not implemented.'); }
    applyWorkingSet(workingSet, options) { throw new Error('Method not implemented.'); }
    deleteWorkingSet(workingSet) { throw new Error('Method not implemented.'); }
    getGroups(_order) { return this.groups; }
    getGroup(identifier) { return this.groups.find(group => group.id === identifier); }
    getLabel(_identifier) { return 'Group 1'; }
    findGroup(_scope, _source, _wrap) { throw new Error('not implemented'); }
    activateGroup(_group) { throw new Error('not implemented'); }
    restoreGroup(_group) { throw new Error('not implemented'); }
    getSize(_group) { return { width: 100, height: 100 }; }
    setSize(_group, _size) { }
    arrangeGroups(_arrangement) { }
    toggleMaximizeGroup() { }
    hasMaximizedGroup() { throw new Error('not implemented'); }
    toggleExpandGroup() { }
    applyLayout(_layout) { }
    getLayout() { throw new Error('not implemented'); }
    setGroupOrientation(_orientation) { }
    addGroup(_location, _direction) { throw new Error('not implemented'); }
    removeGroup(_group) { }
    moveGroup(_group, _location, _direction) { throw new Error('not implemented'); }
    mergeGroup(_group, _target, _options) { throw new Error('not implemented'); }
    mergeAllGroups(_group, _options) { throw new Error('not implemented'); }
    copyGroup(_group, _location, _direction) { throw new Error('not implemented'); }
    centerLayout(active) { }
    isLayoutCentered() { return false; }
    createEditorDropTarget(container, delegate) { return Disposable.None; }
    registerContextKeyProvider(_provider) { throw new Error('not implemented'); }
    getScopedInstantiationService(part) { throw new Error('Method not implemented.'); }
    enforcePartOptions(options) { return Disposable.None; }
    registerEditorPart(part) { return Disposable.None; }
    createAuxiliaryEditorPart() { throw new Error('Method not implemented.'); }
}
export class TestEditorGroupView {
    constructor(id) {
        this.id = id;
        this.windowId = mainWindow.vscodeWindowId;
        this.groupsView = undefined;
        this.selectedEditors = [];
        this.editors = [];
        this.whenRestored = Promise.resolve(undefined);
        this.isEmpty = true;
        this.onWillDispose = Event.None;
        this.onDidModelChange = Event.None;
        this.onWillCloseEditor = Event.None;
        this.onDidCloseEditor = Event.None;
        this.onDidOpenEditorFail = Event.None;
        this.onDidFocus = Event.None;
        this.onDidChange = Event.None;
        this.onWillMoveEditor = Event.None;
        this.onWillOpenEditor = Event.None;
        this.onDidActiveEditorChange = Event.None;
    }
    getEditors(_order) { return []; }
    findEditors(_resource) { return []; }
    getEditorByIndex(_index) { throw new Error('not implemented'); }
    getIndexOfEditor(_editor) { return -1; }
    isFirst(editor) { return false; }
    isLast(editor) { return false; }
    openEditor(_editor, _options) { throw new Error('not implemented'); }
    openEditors(_editors) { throw new Error('not implemented'); }
    isPinned(_editor) { return false; }
    isSticky(_editor) { return false; }
    isTransient(_editor) { return false; }
    isActive(_editor) { return false; }
    setSelection(_activeSelectedEditor, _inactiveSelectedEditors) { throw new Error('not implemented'); }
    isSelected(_editor) { return false; }
    contains(candidate) { return false; }
    moveEditor(_editor, _target, _options) { return true; }
    moveEditors(_editors, _target) { return true; }
    copyEditor(_editor, _target, _options) { }
    copyEditors(_editors, _target) { }
    async closeEditor(_editor, options) { return true; }
    async closeEditors(_editors, options) { return true; }
    closeAllEditors(options) { return true; }
    async replaceEditors(_editors) { }
    pinEditor(_editor) { }
    stickEditor(editor) { }
    unstickEditor(editor) { }
    lock(locked) { }
    focus() { }
    get scopedContextKeyService() { throw new Error('not implemented'); }
    setActive(_isActive) { }
    notifyIndexChanged(_index) { }
    notifyLabelChanged(_label) { }
    dispose() { }
    toJSON() { return Object.create(null); }
    layout(_width, _height) { }
    relayout() { }
    createEditorActions(_menuDisposable) { throw new Error('not implemented'); }
}
export class TestEditorGroupAccessor {
    constructor() {
        this.label = '';
        this.windowId = mainWindow.vscodeWindowId;
        this.groups = [];
        this.partOptions = { ...DEFAULT_EDITOR_PART_OPTIONS };
        this.onDidChangeEditorPartOptions = Event.None;
        this.onDidVisibilityChange = Event.None;
    }
    getGroup(identifier) { throw new Error('Method not implemented.'); }
    getGroups(order) { throw new Error('Method not implemented.'); }
    activateGroup(identifier) { throw new Error('Method not implemented.'); }
    restoreGroup(identifier) { throw new Error('Method not implemented.'); }
    addGroup(location, direction) { throw new Error('Method not implemented.'); }
    mergeGroup(group, target, options) { throw new Error('Method not implemented.'); }
    moveGroup(group, location, direction) { throw new Error('Method not implemented.'); }
    copyGroup(group, location, direction) { throw new Error('Method not implemented.'); }
    removeGroup(group) { throw new Error('Method not implemented.'); }
    arrangeGroups(arrangement, target) { throw new Error('Method not implemented.'); }
    toggleMaximizeGroup(group) { throw new Error('Method not implemented.'); }
    toggleExpandGroup(group) { throw new Error('Method not implemented.'); }
}
export class TestEditorService extends Disposable {
    get activeTextEditorControl() { return this._activeTextEditorControl; }
    set activeTextEditorControl(value) { this._activeTextEditorControl = value; }
    get activeEditor() { return this._activeEditor; }
    set activeEditor(value) { this._activeEditor = value; }
    getVisibleTextEditorControls(order) { return this.visibleTextEditorControls; }
    constructor(editorGroupService) {
        super();
        this.editorGroupService = editorGroupService;
        this.onDidActiveEditorChange = Event.None;
        this.onDidVisibleEditorsChange = Event.None;
        this.onDidEditorsChange = Event.None;
        this.onWillOpenEditor = Event.None;
        this.onDidCloseEditor = Event.None;
        this.onDidOpenEditorFail = Event.None;
        this.onDidMostRecentlyActiveEditorsChange = Event.None;
        this.editors = [];
        this.mostRecentlyActiveEditors = [];
        this.visibleEditorPanes = [];
        this.visibleTextEditorControls = [];
        this.visibleEditors = [];
        this.count = this.editors.length;
    }
    createScoped(editorGroupsContainer) { return this; }
    getEditors() { return []; }
    findEditors() { return []; }
    async openEditor(editor, optionsOrGroup, group) {
        // openEditor takes ownership of the input, register it to the TestEditorService
        // so it's not marked as leaked during tests.
        if ('dispose' in editor) {
            this._register(editor);
        }
        return undefined;
    }
    async closeEditor(editor, options) { }
    async closeEditors(editors, options) { }
    doResolveEditorOpenRequest(editor) {
        if (!this.editorGroupService) {
            return undefined;
        }
        return [this.editorGroupService.activeGroup, editor, undefined];
    }
    openEditors(_editors, _group) { throw new Error('not implemented'); }
    isOpened(_editor) { return false; }
    isVisible(_editor) { return false; }
    replaceEditors(_editors, _group) { return Promise.resolve(undefined); }
    save(editors, options) { throw new Error('Method not implemented.'); }
    saveAll(options) { throw new Error('Method not implemented.'); }
    revert(editors, options) { throw new Error('Method not implemented.'); }
    revertAll(options) { throw new Error('Method not implemented.'); }
}
export class TestFileService {
    constructor() {
        this._onDidFilesChange = new Emitter();
        this._onDidRunOperation = new Emitter();
        this._onDidChangeFileSystemProviderCapabilities = new Emitter();
        this._onWillActivateFileSystemProvider = new Emitter();
        this.onWillActivateFileSystemProvider = this._onWillActivateFileSystemProvider.event;
        this.onDidWatchError = Event.None;
        this.content = 'Hello Html';
        this.readonly = false;
        this.notExistsSet = new ResourceMap();
        this.readShouldThrowError = undefined;
        this.writeShouldThrowError = undefined;
        this.onDidChangeFileSystemProviderRegistrations = Event.None;
        this.providers = new Map();
        this.watches = [];
    }
    get onDidFilesChange() { return this._onDidFilesChange.event; }
    fireFileChanges(event) { this._onDidFilesChange.fire(event); }
    get onDidRunOperation() { return this._onDidRunOperation.event; }
    fireAfterOperation(event) { this._onDidRunOperation.fire(event); }
    get onDidChangeFileSystemProviderCapabilities() { return this._onDidChangeFileSystemProviderCapabilities.event; }
    fireFileSystemProviderCapabilitiesChangeEvent(event) { this._onDidChangeFileSystemProviderCapabilities.fire(event); }
    setContent(content) { this.content = content; }
    getContent() { return this.content; }
    getLastReadFileUri() { return this.lastReadFileUri; }
    async resolve(resource, _options) {
        return createFileStat(resource, this.readonly);
    }
    stat(resource) {
        return this.resolve(resource, { resolveMetadata: true });
    }
    async resolveAll(toResolve) {
        const stats = await Promise.all(toResolve.map(resourceAndOption => this.resolve(resourceAndOption.resource, resourceAndOption.options)));
        return stats.map(stat => ({ stat, success: true }));
    }
    async exists(_resource) { return !this.notExistsSet.has(_resource); }
    async readFile(resource, options) {
        if (this.readShouldThrowError) {
            throw this.readShouldThrowError;
        }
        this.lastReadFileUri = resource;
        return {
            ...createFileStat(resource, this.readonly),
            value: VSBuffer.fromString(this.content)
        };
    }
    async readFileStream(resource, options) {
        if (this.readShouldThrowError) {
            throw this.readShouldThrowError;
        }
        this.lastReadFileUri = resource;
        return {
            ...createFileStat(resource, this.readonly),
            value: bufferToStream(VSBuffer.fromString(this.content))
        };
    }
    async writeFile(resource, bufferOrReadable, options) {
        await timeout(0);
        if (this.writeShouldThrowError) {
            throw this.writeShouldThrowError;
        }
        return createFileStat(resource, this.readonly);
    }
    move(_source, _target, _overwrite) { return Promise.resolve(null); }
    copy(_source, _target, _overwrite) { return Promise.resolve(null); }
    async cloneFile(_source, _target) { }
    createFile(_resource, _content, _options) { return Promise.resolve(null); }
    createFolder(_resource) { return Promise.resolve(null); }
    registerProvider(scheme, provider) {
        this.providers.set(scheme, provider);
        return toDisposable(() => this.providers.delete(scheme));
    }
    getProvider(scheme) {
        return this.providers.get(scheme);
    }
    async activateProvider(_scheme) {
        this._onWillActivateFileSystemProvider.fire({ scheme: _scheme, join: () => { } });
    }
    async canHandleResource(resource) { return this.hasProvider(resource); }
    hasProvider(resource) { return resource.scheme === Schemas.file || this.providers.has(resource.scheme); }
    listCapabilities() {
        return [
            { scheme: Schemas.file, capabilities: 4 /* FileSystemProviderCapabilities.FileOpenReadWriteClose */ },
            ...Iterable.map(this.providers, ([scheme, p]) => { return { scheme, capabilities: p.capabilities }; })
        ];
    }
    hasCapability(resource, capability) {
        if (capability === 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */ && isLinux) {
            return true;
        }
        const provider = this.getProvider(resource.scheme);
        return !!(provider && (provider.capabilities & capability));
    }
    async del(_resource, _options) { }
    createWatcher(resource, options) {
        return {
            onDidChange: Event.None,
            dispose: () => { }
        };
    }
    watch(_resource) {
        this.watches.push(_resource);
        return toDisposable(() => this.watches.splice(this.watches.indexOf(_resource), 1));
    }
    getWriteEncoding(_resource) { return { encoding: 'utf8', hasBOM: false }; }
    dispose() { }
    async canCreateFile(source, options) { return true; }
    async canMove(source, target, overwrite) { return true; }
    async canCopy(source, target, overwrite) { return true; }
    async canDelete(resource, options) { return true; }
}
export class TestWorkingCopyBackupService extends InMemoryWorkingCopyBackupService {
    constructor() {
        super();
        this.resolved = new Set();
    }
    parseBackupContent(textBufferFactory) {
        const textBuffer = textBufferFactory.create(1 /* DefaultEndOfLine.LF */).textBuffer;
        const lineCount = textBuffer.getLineCount();
        const range = new Range(1, 1, lineCount, textBuffer.getLineLength(lineCount) + 1);
        return textBuffer.getValueInRange(range, 0 /* EndOfLinePreference.TextDefined */);
    }
    async resolve(identifier) {
        this.resolved.add(identifier);
        return super.resolve(identifier);
    }
}
export function toUntypedWorkingCopyId(resource) {
    return toTypedWorkingCopyId(resource, '');
}
export function toTypedWorkingCopyId(resource, typeId = 'testBackupTypeId') {
    return { typeId, resource };
}
export class InMemoryTestWorkingCopyBackupService extends BrowserWorkingCopyBackupService {
    constructor() {
        const disposables = new DisposableStore();
        const environmentService = TestEnvironmentService;
        const logService = new NullLogService();
        const fileService = disposables.add(new FileService(logService));
        disposables.add(fileService.registerProvider(Schemas.file, disposables.add(new InMemoryFileSystemProvider())));
        disposables.add(fileService.registerProvider(Schemas.vscodeUserData, disposables.add(new InMemoryFileSystemProvider())));
        super(new TestContextService(TestWorkspace), environmentService, fileService, logService);
        this.backupResourceJoiners = [];
        this.discardBackupJoiners = [];
        this.discardedBackups = [];
        this._register(disposables);
    }
    testGetFileService() {
        return this.fileService;
    }
    joinBackupResource() {
        return new Promise(resolve => this.backupResourceJoiners.push(resolve));
    }
    joinDiscardBackup() {
        return new Promise(resolve => this.discardBackupJoiners.push(resolve));
    }
    async backup(identifier, content, versionId, meta, token) {
        await super.backup(identifier, content, versionId, meta, token);
        while (this.backupResourceJoiners.length) {
            this.backupResourceJoiners.pop()();
        }
    }
    async discardBackup(identifier) {
        await super.discardBackup(identifier);
        this.discardedBackups.push(identifier);
        while (this.discardBackupJoiners.length) {
            this.discardBackupJoiners.pop()();
        }
    }
    async getBackupContents(identifier) {
        const backupResource = this.toBackupResource(identifier);
        const fileContents = await this.fileService.readFile(backupResource);
        return fileContents.value.toString();
    }
}
export class TestLifecycleService extends Disposable {
    constructor() {
        super(...arguments);
        this.usePhases = false;
        this.whenStarted = new DeferredPromise();
        this.whenReady = new DeferredPromise();
        this.whenRestored = new DeferredPromise();
        this.whenEventually = new DeferredPromise();
        this.willShutdown = false;
        this._onBeforeShutdown = this._register(new Emitter());
        this._onBeforeShutdownError = this._register(new Emitter());
        this._onShutdownVeto = this._register(new Emitter());
        this._onWillShutdown = this._register(new Emitter());
        this._onDidShutdown = this._register(new Emitter());
        this.shutdownJoiners = [];
    }
    get phase() { return this._phase; }
    set phase(value) {
        this._phase = value;
        if (value === 1 /* LifecyclePhase.Starting */) {
            this.whenStarted.complete();
        }
        else if (value === 2 /* LifecyclePhase.Ready */) {
            this.whenReady.complete();
        }
        else if (value === 3 /* LifecyclePhase.Restored */) {
            this.whenRestored.complete();
        }
        else if (value === 4 /* LifecyclePhase.Eventually */) {
            this.whenEventually.complete();
        }
    }
    async when(phase) {
        if (!this.usePhases) {
            return;
        }
        if (phase === 1 /* LifecyclePhase.Starting */) {
            await this.whenStarted.p;
        }
        else if (phase === 2 /* LifecyclePhase.Ready */) {
            await this.whenReady.p;
        }
        else if (phase === 3 /* LifecyclePhase.Restored */) {
            await this.whenRestored.p;
        }
        else if (phase === 4 /* LifecyclePhase.Eventually */) {
            await this.whenEventually.p;
        }
    }
    get onBeforeShutdown() { return this._onBeforeShutdown.event; }
    get onBeforeShutdownError() { return this._onBeforeShutdownError.event; }
    get onShutdownVeto() { return this._onShutdownVeto.event; }
    get onWillShutdown() { return this._onWillShutdown.event; }
    get onDidShutdown() { return this._onDidShutdown.event; }
    fireShutdown(reason = 2 /* ShutdownReason.QUIT */) {
        this.shutdownJoiners = [];
        this._onWillShutdown.fire({
            join: p => {
                this.shutdownJoiners.push(typeof p === 'function' ? p() : p);
            },
            joiners: () => [],
            force: () => { },
            token: CancellationToken.None,
            reason
        });
    }
    fireBeforeShutdown(event) { this._onBeforeShutdown.fire(event); }
    fireWillShutdown(event) { this._onWillShutdown.fire(event); }
    async shutdown() {
        this.fireShutdown();
    }
}
export class TestBeforeShutdownEvent {
    constructor() {
        this.reason = 1 /* ShutdownReason.CLOSE */;
    }
    veto(value) {
        this.value = value;
    }
    finalVeto(vetoFn) {
        this.value = vetoFn();
        this.finalValue = vetoFn;
    }
}
export class TestWillShutdownEvent {
    constructor() {
        this.value = [];
        this.joiners = () => [];
        this.reason = 1 /* ShutdownReason.CLOSE */;
        this.token = CancellationToken.None;
    }
    join(promise, joiner) {
        this.value.push(typeof promise === 'function' ? promise() : promise);
    }
    force() { }
}
export class TestTextResourceConfigurationService {
    constructor(configurationService = new TestConfigurationService()) {
        this.configurationService = configurationService;
    }
    onDidChangeConfiguration() {
        return { dispose() { } };
    }
    getValue(resource, arg2, arg3) {
        const position = EditorPosition.isIPosition(arg2) ? arg2 : null;
        const section = position ? (typeof arg3 === 'string' ? arg3 : undefined) : (typeof arg2 === 'string' ? arg2 : undefined);
        return this.configurationService.getValue(section, { resource });
    }
    inspect(resource, position, section) {
        return this.configurationService.inspect(section, { resource });
    }
    updateValue(resource, key, value, configurationTarget) {
        return this.configurationService.updateValue(key, value);
    }
}
export class RemoteFileSystemProvider {
    constructor(wrappedFsp, remoteAuthority) {
        this.wrappedFsp = wrappedFsp;
        this.remoteAuthority = remoteAuthority;
        this.capabilities = this.wrappedFsp.capabilities;
        this.onDidChangeCapabilities = this.wrappedFsp.onDidChangeCapabilities;
        this.onDidChangeFile = Event.map(this.wrappedFsp.onDidChangeFile, changes => changes.map(c => {
            return {
                type: c.type,
                resource: c.resource.with({ scheme: Schemas.vscodeRemote, authority: this.remoteAuthority }),
            };
        }));
    }
    watch(resource, opts) { return this.wrappedFsp.watch(this.toFileResource(resource), opts); }
    stat(resource) { return this.wrappedFsp.stat(this.toFileResource(resource)); }
    mkdir(resource) { return this.wrappedFsp.mkdir(this.toFileResource(resource)); }
    readdir(resource) { return this.wrappedFsp.readdir(this.toFileResource(resource)); }
    delete(resource, opts) { return this.wrappedFsp.delete(this.toFileResource(resource), opts); }
    rename(from, to, opts) { return this.wrappedFsp.rename(this.toFileResource(from), this.toFileResource(to), opts); }
    copy(from, to, opts) { return this.wrappedFsp.copy(this.toFileResource(from), this.toFileResource(to), opts); }
    readFile(resource) { return this.wrappedFsp.readFile(this.toFileResource(resource)); }
    writeFile(resource, content, opts) { return this.wrappedFsp.writeFile(this.toFileResource(resource), content, opts); }
    open(resource, opts) { return this.wrappedFsp.open(this.toFileResource(resource), opts); }
    close(fd) { return this.wrappedFsp.close(fd); }
    read(fd, pos, data, offset, length) { return this.wrappedFsp.read(fd, pos, data, offset, length); }
    write(fd, pos, data, offset, length) { return this.wrappedFsp.write(fd, pos, data, offset, length); }
    readFileStream(resource, opts, token) { return this.wrappedFsp.readFileStream(this.toFileResource(resource), opts, token); }
    toFileResource(resource) { return resource.with({ scheme: Schemas.file, authority: '' }); }
}
export class TestInMemoryFileSystemProvider extends InMemoryFileSystemProvider {
    get capabilities() {
        return 2 /* FileSystemProviderCapabilities.FileReadWrite */
            | 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */
            | 16 /* FileSystemProviderCapabilities.FileReadStream */;
    }
    readFileStream(resource) {
        const BUFFER_SIZE = 64 * 1024;
        const stream = newWriteableStream(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);
        (async () => {
            try {
                const data = await this.readFile(resource);
                let offset = 0;
                while (offset < data.length) {
                    await timeout(0);
                    await stream.write(data.subarray(offset, offset + BUFFER_SIZE));
                    offset += BUFFER_SIZE;
                }
                await timeout(0);
                stream.end();
            }
            catch (error) {
                stream.end(error);
            }
        })();
        return stream;
    }
}
export const productService = { _serviceBrand: undefined, ...product };
export class TestHostService {
    constructor() {
        this._hasFocus = true;
        this._onDidChangeFocus = new Emitter();
        this.onDidChangeFocus = this._onDidChangeFocus.event;
        this._onDidChangeWindow = new Emitter();
        this.onDidChangeActiveWindow = this._onDidChangeWindow.event;
        this.onDidChangeFullScreen = Event.None;
        this.colorScheme = ColorScheme.DARK;
        this.onDidChangeColorScheme = Event.None;
    }
    get hasFocus() { return this._hasFocus; }
    async hadLastFocus() { return this._hasFocus; }
    setFocus(focus) {
        this._hasFocus = focus;
        this._onDidChangeFocus.fire(this._hasFocus);
    }
    async restart() { }
    async reload() { }
    async close() { }
    async withExpectedShutdown(expectedShutdownTask) {
        return await expectedShutdownTask();
    }
    async focus() { }
    async moveTop() { }
    async getCursorScreenPoint() { return undefined; }
    async openWindow(arg1, arg2) { }
    async toggleFullScreen() { }
    async getScreenshot(rect) { return undefined; }
    async getNativeWindowHandle(_windowId) { return undefined; }
}
export class TestFilesConfigurationService extends FilesConfigurationService {
    testOnFilesConfigurationChange(configuration) {
        super.onFilesConfigurationChange(configuration, true);
    }
}
export class TestReadonlyTextFileEditorModel extends TextFileEditorModel {
    isReadonly() {
        return true;
    }
}
export class TestEditorInput extends EditorInput {
    constructor(resource, _typeId) {
        super();
        this.resource = resource;
        this._typeId = _typeId;
    }
    get typeId() {
        return this._typeId;
    }
    get editorId() {
        return this._typeId;
    }
    resolve() {
        return Promise.resolve(null);
    }
}
export function registerTestEditor(id, inputs, serializerInputId) {
    const disposables = new DisposableStore();
    class TestEditor extends EditorPane {
        constructor(group) {
            super(id, group, NullTelemetryService, new TestThemeService(), disposables.add(new TestStorageService()));
            this._scopedContextKeyService = new MockContextKeyService();
        }
        async setInput(input, options, context, token) {
            super.setInput(input, options, context, token);
            await input.resolve();
        }
        getId() { return id; }
        layout() { }
        createEditor() { }
        get scopedContextKeyService() {
            return this._scopedContextKeyService;
        }
    }
    disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TestEditor, id, 'Test Editor Control'), inputs));
    if (serializerInputId) {
        class EditorsObserverTestEditorInputSerializer {
            canSerialize(editorInput) {
                return true;
            }
            serialize(editorInput) {
                const testEditorInput = editorInput;
                const testInput = {
                    resource: testEditorInput.resource.toString()
                };
                return JSON.stringify(testInput);
            }
            deserialize(instantiationService, serializedEditorInput) {
                const testInput = JSON.parse(serializedEditorInput);
                return new TestFileEditorInput(URI.parse(testInput.resource), serializerInputId);
            }
        }
        disposables.add(Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(serializerInputId, EditorsObserverTestEditorInputSerializer));
    }
    return disposables;
}
export function registerTestFileEditor() {
    const disposables = new DisposableStore();
    disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TestTextFileEditor, TestTextFileEditor.ID, 'Text File Editor'), [new SyncDescriptor(FileEditorInput)]));
    return disposables;
}
export function registerTestResourceEditor() {
    const disposables = new DisposableStore();
    disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TestTextResourceEditor, TestTextResourceEditor.ID, 'Text Editor'), [
        new SyncDescriptor(UntitledTextEditorInput),
        new SyncDescriptor(TextResourceEditorInput)
    ]));
    return disposables;
}
export function registerTestSideBySideEditor() {
    const disposables = new DisposableStore();
    disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(SideBySideEditor, SideBySideEditor.ID, 'Text Editor'), [
        new SyncDescriptor(SideBySideEditorInput)
    ]));
    return disposables;
}
export class TestFileEditorInput extends EditorInput {
    constructor(resource, _typeId) {
        super();
        this.resource = resource;
        this._typeId = _typeId;
        this.gotDisposed = false;
        this.gotSaved = false;
        this.gotSavedAs = false;
        this.gotReverted = false;
        this.dirty = false;
        this.fails = false;
        this.disableToUntyped = false;
        this._capabilities = 0 /* EditorInputCapabilities.None */;
        this.movedEditor = undefined;
        this.moveDisabledReason = undefined;
        this.preferredResource = this.resource;
    }
    get typeId() { return this._typeId; }
    get editorId() { return this._typeId; }
    get capabilities() { return this._capabilities; }
    set capabilities(capabilities) {
        if (this._capabilities !== capabilities) {
            this._capabilities = capabilities;
            this._onDidChangeCapabilities.fire();
        }
    }
    resolve() { return !this.fails ? Promise.resolve(null) : Promise.reject(new Error('fails')); }
    matches(other) {
        if (super.matches(other)) {
            return true;
        }
        if (other instanceof EditorInput) {
            return !!(other?.resource && this.resource.toString() === other.resource.toString() && other instanceof TestFileEditorInput && other.typeId === this.typeId);
        }
        return isEqual(this.resource, other.resource) && (this.editorId === other.options?.override || other.options?.override === undefined);
    }
    setPreferredResource(resource) { }
    async setEncoding(encoding) { }
    getEncoding() { return undefined; }
    setPreferredName(name) { }
    setPreferredDescription(description) { }
    setPreferredEncoding(encoding) { }
    setPreferredContents(contents) { }
    setLanguageId(languageId, source) { }
    setPreferredLanguageId(languageId) { }
    setForceOpenAsBinary() { }
    setFailToOpen() {
        this.fails = true;
    }
    async save(groupId, options) {
        this.gotSaved = true;
        this.dirty = false;
        return this;
    }
    async saveAs(groupId, options) {
        this.gotSavedAs = true;
        return this;
    }
    async revert(group, options) {
        this.gotReverted = true;
        this.gotSaved = false;
        this.gotSavedAs = false;
        this.dirty = false;
    }
    toUntyped() {
        if (this.disableToUntyped) {
            return undefined;
        }
        return { resource: this.resource };
    }
    setModified() { this.modified = true; }
    isModified() {
        return this.modified === undefined ? this.dirty : this.modified;
    }
    setDirty() { this.dirty = true; }
    isDirty() {
        return this.dirty;
    }
    isResolved() { return false; }
    dispose() {
        super.dispose();
        this.gotDisposed = true;
    }
    async rename() { return this.movedEditor; }
    setMoveDisabled(reason) {
        this.moveDisabledReason = reason;
    }
    canMove(sourceGroup, targetGroup) {
        if (typeof this.moveDisabledReason === 'string') {
            return this.moveDisabledReason;
        }
        return super.canMove(sourceGroup, targetGroup);
    }
}
export class TestSingletonFileEditorInput extends TestFileEditorInput {
    get capabilities() { return 8 /* EditorInputCapabilities.Singleton */; }
}
export class TestEditorPart extends MainEditorPart {
    constructor() {
        super(...arguments);
        this.mainPart = this;
        this.parts = [this];
        this.onDidCreateAuxiliaryEditorPart = Event.None;
    }
    testSaveState() {
        return super.saveState();
    }
    clearState() {
        const workspaceMemento = this.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        for (const key of Object.keys(workspaceMemento)) {
            delete workspaceMemento[key];
        }
        const profileMemento = this.getMemento(0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        for (const key of Object.keys(profileMemento)) {
            delete profileMemento[key];
        }
    }
    registerEditorPart(part) {
        return Disposable.None;
    }
    createAuxiliaryEditorPart() {
        throw new Error('Method not implemented.');
    }
    getScopedInstantiationService(part) {
        throw new Error('Method not implemented.');
    }
    getPart(group) { return this; }
    saveWorkingSet(name) { throw new Error('Method not implemented.'); }
    getWorkingSets() { throw new Error('Method not implemented.'); }
    applyWorkingSet(workingSet, options) { throw new Error('Method not implemented.'); }
    deleteWorkingSet(workingSet) { throw new Error('Method not implemented.'); }
    registerContextKeyProvider(provider) { throw new Error('Method not implemented.'); }
}
export class TestEditorParts extends EditorParts {
    createMainEditorPart() {
        this.testMainPart = this.instantiationService.createInstance(TestEditorPart, this);
        return this.testMainPart;
    }
}
export async function createEditorParts(instantiationService, disposables) {
    const parts = instantiationService.createInstance(TestEditorParts);
    const part = disposables.add(parts).testMainPart;
    part.create(document.createElement('div'));
    part.layout(1080, 800, 0, 0);
    await parts.whenReady;
    return parts;
}
export async function createEditorPart(instantiationService, disposables) {
    return (await createEditorParts(instantiationService, disposables)).testMainPart;
}
export class TestListService {
    constructor() {
        this.lastFocusedList = undefined;
    }
    register() {
        return Disposable.None;
    }
}
export class TestPathService {
    constructor(fallbackUserHome = URI.from({ scheme: Schemas.file, path: '/' }), defaultUriScheme = Schemas.file) {
        this.fallbackUserHome = fallbackUserHome;
        this.defaultUriScheme = defaultUriScheme;
    }
    hasValidBasename(resource, arg2, name) {
        if (typeof arg2 === 'string' || typeof arg2 === 'undefined') {
            return isValidBasename(arg2 ?? basename(resource));
        }
        return isValidBasename(name ?? basename(resource));
    }
    get path() { return Promise.resolve(isWindows ? win32 : posix); }
    userHome(options) {
        return options?.preferLocal ? this.fallbackUserHome : Promise.resolve(this.fallbackUserHome);
    }
    get resolvedUserHome() { return this.fallbackUserHome; }
    async fileURI(path) {
        return URI.file(path);
    }
}
export function getLastResolvedFileStat(model) {
    const candidate = model;
    return candidate?.lastResolvedFileStat;
}
export class TestWorkspacesService {
    constructor() {
        this.onDidChangeRecentlyOpened = Event.None;
    }
    async createUntitledWorkspace(folders, remoteAuthority) { throw new Error('Method not implemented.'); }
    async deleteUntitledWorkspace(workspace) { }
    async addRecentlyOpened(recents) { }
    async removeRecentlyOpened(workspaces) { }
    async clearRecentlyOpened() { }
    async getRecentlyOpened() { return { files: [], workspaces: [] }; }
    async getDirtyWorkspaces() { return []; }
    async enterWorkspace(path) { throw new Error('Method not implemented.'); }
    async getWorkspaceIdentifier(workspacePath) { throw new Error('Method not implemented.'); }
}
export class TestTerminalInstanceService {
    constructor() {
        this.onDidCreateInstance = Event.None;
        this.onDidRegisterBackend = Event.None;
    }
    convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile, cwd) { throw new Error('Method not implemented.'); }
    preparePathForTerminalAsync(path, executable, title, shellType, remoteAuthority) { throw new Error('Method not implemented.'); }
    createInstance(options, target) { throw new Error('Method not implemented.'); }
    async getBackend(remoteAuthority) { throw new Error('Method not implemented.'); }
    didRegisterBackend(backend) { throw new Error('Method not implemented.'); }
    getRegisteredBackends() { throw new Error('Method not implemented.'); }
}
export class TestTerminalEditorService {
    constructor() {
        this.instances = [];
        this.onDidDisposeInstance = Event.None;
        this.onDidFocusInstance = Event.None;
        this.onDidChangeInstanceCapability = Event.None;
        this.onDidChangeActiveInstance = Event.None;
        this.onDidChangeInstances = Event.None;
    }
    openEditor(instance, editorOptions) { throw new Error('Method not implemented.'); }
    detachInstance(instance) { throw new Error('Method not implemented.'); }
    splitInstance(instanceToSplit, shellLaunchConfig) { throw new Error('Method not implemented.'); }
    revealActiveEditor(preserveFocus) { throw new Error('Method not implemented.'); }
    resolveResource(instance) { throw new Error('Method not implemented.'); }
    reviveInput(deserializedInput) { throw new Error('Method not implemented.'); }
    getInputFromResource(resource) { throw new Error('Method not implemented.'); }
    setActiveInstance(instance) { throw new Error('Method not implemented.'); }
    focusActiveInstance() { throw new Error('Method not implemented.'); }
    focusInstance(instance) { throw new Error('Method not implemented.'); }
    getInstanceFromResource(resource) { throw new Error('Method not implemented.'); }
    focusFindWidget() { throw new Error('Method not implemented.'); }
    hideFindWidget() { throw new Error('Method not implemented.'); }
    findNext() { throw new Error('Method not implemented.'); }
    findPrevious() { throw new Error('Method not implemented.'); }
}
export class TestTerminalGroupService {
    constructor() {
        this.instances = [];
        this.groups = [];
        this.activeGroupIndex = 0;
        this.lastAccessedMenu = 'inline-tab';
        this.onDidChangeActiveGroup = Event.None;
        this.onDidDisposeGroup = Event.None;
        this.onDidShow = Event.None;
        this.onDidChangeGroups = Event.None;
        this.onDidChangePanelOrientation = Event.None;
        this.onDidDisposeInstance = Event.None;
        this.onDidFocusInstance = Event.None;
        this.onDidChangeInstanceCapability = Event.None;
        this.onDidChangeActiveInstance = Event.None;
        this.onDidChangeInstances = Event.None;
    }
    createGroup(instance) { throw new Error('Method not implemented.'); }
    getGroupForInstance(instance) { throw new Error('Method not implemented.'); }
    moveGroup(source, target) { throw new Error('Method not implemented.'); }
    moveGroupToEnd(source) { throw new Error('Method not implemented.'); }
    moveInstance(source, target, side) { throw new Error('Method not implemented.'); }
    unsplitInstance(instance) { throw new Error('Method not implemented.'); }
    joinInstances(instances) { throw new Error('Method not implemented.'); }
    instanceIsSplit(instance) { throw new Error('Method not implemented.'); }
    getGroupLabels() { throw new Error('Method not implemented.'); }
    setActiveGroupByIndex(index) { throw new Error('Method not implemented.'); }
    setActiveGroupToNext() { throw new Error('Method not implemented.'); }
    setActiveGroupToPrevious() { throw new Error('Method not implemented.'); }
    setActiveInstanceByIndex(terminalIndex) { throw new Error('Method not implemented.'); }
    setContainer(container) { throw new Error('Method not implemented.'); }
    showPanel(focus) { throw new Error('Method not implemented.'); }
    hidePanel() { throw new Error('Method not implemented.'); }
    focusTabs() { throw new Error('Method not implemented.'); }
    focusHover() { throw new Error('Method not implemented.'); }
    setActiveInstance(instance) { throw new Error('Method not implemented.'); }
    focusActiveInstance() { throw new Error('Method not implemented.'); }
    focusInstance(instance) { throw new Error('Method not implemented.'); }
    getInstanceFromResource(resource) { throw new Error('Method not implemented.'); }
    focusFindWidget() { throw new Error('Method not implemented.'); }
    hideFindWidget() { throw new Error('Method not implemented.'); }
    findNext() { throw new Error('Method not implemented.'); }
    findPrevious() { throw new Error('Method not implemented.'); }
    updateVisibility() { throw new Error('Method not implemented.'); }
}
export class TestTerminalProfileService {
    constructor() {
        this.availableProfiles = [];
        this.contributedProfiles = [];
        this.profilesReady = Promise.resolve();
        this.onDidChangeAvailableProfiles = Event.None;
    }
    getPlatformKey() { throw new Error('Method not implemented.'); }
    refreshAvailableProfiles() { throw new Error('Method not implemented.'); }
    getDefaultProfileName() { throw new Error('Method not implemented.'); }
    getDefaultProfile() { throw new Error('Method not implemented.'); }
    getContributedDefaultProfile(shellLaunchConfig) { throw new Error('Method not implemented.'); }
    registerContributedProfile(args) { throw new Error('Method not implemented.'); }
    getContributedProfileProvider(extensionIdentifier, id) { throw new Error('Method not implemented.'); }
    registerTerminalProfileProvider(extensionIdentifier, id, profileProvider) { throw new Error('Method not implemented.'); }
}
export class TestTerminalProfileResolverService {
    constructor() {
        this.defaultProfileName = '';
    }
    resolveIcon(shellLaunchConfig) { }
    async resolveShellLaunchConfig(shellLaunchConfig, options) { }
    async getDefaultProfile(options) { return { path: '/default', profileName: 'Default', isDefault: true }; }
    async getDefaultShell(options) { return '/default'; }
    async getDefaultShellArgs(options) { return []; }
    getDefaultIcon() { return Codicon.terminal; }
    async getEnvironment() { return env; }
    getSafeConfigValue(key, os) { return undefined; }
    getSafeConfigValueFullKey(key) { return undefined; }
    createProfileFromShellAndShellArgs(shell, shellArgs) { throw new Error('Method not implemented.'); }
}
export class TestTerminalConfigurationService extends TerminalConfigurationService {
    get fontMetrics() { return this._fontMetrics; }
    setConfig(config) { this._config = config; }
}
export class TestQuickInputService {
    constructor() {
        this.onShow = Event.None;
        this.onHide = Event.None;
        this.currentQuickInput = undefined;
        this.quickAccess = undefined;
    }
    async pick(picks, options, token) {
        if (Array.isArray(picks)) {
            return { label: 'selectedPick', description: 'pick description', value: 'selectedPick' };
        }
        else {
            return undefined;
        }
    }
    async input(options, token) { return options ? 'resolved' + options.prompt : 'resolved'; }
    createQuickPick() { throw new Error('not implemented.'); }
    createInputBox() { throw new Error('not implemented.'); }
    createQuickWidget() { throw new Error('Method not implemented.'); }
    focus() { throw new Error('not implemented.'); }
    toggle() { throw new Error('not implemented.'); }
    navigate(next, quickNavigate) { throw new Error('not implemented.'); }
    accept() { throw new Error('not implemented.'); }
    back() { throw new Error('not implemented.'); }
    cancel() { throw new Error('not implemented.'); }
    setAlignment(alignment) { throw new Error('not implemented.'); }
    toggleHover() { throw new Error('not implemented.'); }
}
class TestLanguageDetectionService {
    isEnabledForLanguage(languageId) { return false; }
    async detectLanguage(resource, supportedLangs) { return undefined; }
}
export class TestRemoteAgentService {
    getConnection() { return null; }
    async getEnvironment() { return null; }
    async getRawEnvironment() { return null; }
    async getExtensionHostExitInfo(reconnectionToken) { return null; }
    async getDiagnosticInfo(options) { return undefined; }
    async updateTelemetryLevel(telemetryLevel) { }
    async logTelemetry(eventName, data) { }
    async flushTelemetry() { }
    async getRoundTripTime() { return undefined; }
    async endConnection() { }
}
export class TestRemoteExtensionsScannerService {
    async whenExtensionsReady() { return { failed: [] }; }
    scanExtensions() { throw new Error('Method not implemented.'); }
}
export class TestWorkbenchExtensionEnablementService {
    constructor() {
        this.onEnablementChanged = Event.None;
    }
    getEnablementState(extension) { return 11 /* EnablementState.EnabledGlobally */; }
    getEnablementStates(extensions, workspaceTypeOverrides) { return []; }
    getDependenciesEnablementStates(extension) { return []; }
    canChangeEnablement(extension) { return true; }
    canChangeWorkspaceEnablement(extension) { return true; }
    isEnabled(extension) { return true; }
    isEnabledEnablementState(enablementState) { return true; }
    isDisabledGlobally(extension) { return false; }
    async setEnablement(extensions, state) { return []; }
    async updateExtensionsEnablementsWhenWorkspaceTrustChanges() { }
}
export class TestWorkbenchExtensionManagementService {
    constructor() {
        this.onInstallExtension = Event.None;
        this.onDidInstallExtensions = Event.None;
        this.onUninstallExtension = Event.None;
        this.onDidUninstallExtension = Event.None;
        this.onDidUpdateExtensionMetadata = Event.None;
        this.onProfileAwareInstallExtension = Event.None;
        this.onProfileAwareDidInstallExtensions = Event.None;
        this.onProfileAwareUninstallExtension = Event.None;
        this.onProfileAwareDidUninstallExtension = Event.None;
        this.onDidProfileAwareUninstallExtensions = Event.None;
        this.onProfileAwareDidUpdateExtensionMetadata = Event.None;
        this.onDidChangeProfile = Event.None;
        this.onDidEnableExtensions = Event.None;
        this.preferPreReleases = true;
    }
    installVSIX(location, manifest, installOptions) {
        throw new Error('Method not implemented.');
    }
    installFromLocation(location) {
        throw new Error('Method not implemented.');
    }
    installGalleryExtensions(extensions) {
        throw new Error('Method not implemented.');
    }
    async updateFromGallery(gallery, extension, installOptions) { return extension; }
    zip(extension) {
        throw new Error('Method not implemented.');
    }
    getManifest(vsix) {
        throw new Error('Method not implemented.');
    }
    install(vsix, options) {
        throw new Error('Method not implemented.');
    }
    isAllowed() { return true; }
    async canInstall(extension) { return true; }
    installFromGallery(extension, options) {
        throw new Error('Method not implemented.');
    }
    uninstall(extension, options) {
        throw new Error('Method not implemented.');
    }
    uninstallExtensions(extensions) {
        throw new Error('Method not implemented.');
    }
    async getInstalled(type) { return []; }
    getExtensionsControlManifest() {
        throw new Error('Method not implemented.');
    }
    async updateMetadata(local, metadata) { return local; }
    registerParticipant(pariticipant) { }
    async getTargetPlatform() { return "undefined" /* TargetPlatform.UNDEFINED */; }
    async cleanUp() { }
    download() {
        throw new Error('Method not implemented.');
    }
    copyExtensions() { throw new Error('Not Supported'); }
    toggleApplicationScope() { throw new Error('Not Supported'); }
    installExtensionsFromProfile() { throw new Error('Not Supported'); }
    whenProfileChanged(from, to) { throw new Error('Not Supported'); }
    getInstalledWorkspaceExtensionLocations() { throw new Error('Method not implemented.'); }
    getInstalledWorkspaceExtensions() { throw new Error('Method not implemented.'); }
    installResourceExtension() { throw new Error('Method not implemented.'); }
    getExtensions() { throw new Error('Method not implemented.'); }
    resetPinnedStateForAllUserExtensions(pinned) { throw new Error('Method not implemented.'); }
    getInstallableServers(extension) { throw new Error('Method not implemented.'); }
    isPublisherTrusted(extension) { return false; }
    getTrustedPublishers() { return []; }
    trustPublishers() { }
    untrustPublishers() { }
    async requestPublisherTrust(extensions) { }
}
export class TestUserDataProfileService {
    constructor() {
        this.onDidChangeCurrentProfile = Event.None;
        this.currentProfile = toUserDataProfile('test', 'test', URI.file('tests').with({ scheme: 'vscode-tests' }), URI.file('tests').with({ scheme: 'vscode-tests' }));
    }
    async updateCurrentProfile() { }
}
export class TestWebExtensionsScannerService {
    constructor() {
        this.onDidChangeProfile = Event.None;
    }
    async scanSystemExtensions() { return []; }
    async scanUserExtensions() { return []; }
    async scanExtensionsUnderDevelopment() { return []; }
    async copyExtensions() {
        throw new Error('Method not implemented.');
    }
    scanExistingExtension(extensionLocation, extensionType) {
        throw new Error('Method not implemented.');
    }
    addExtension(location, metadata) {
        throw new Error('Method not implemented.');
    }
    addExtensionFromGallery(galleryExtension, metadata) {
        throw new Error('Method not implemented.');
    }
    removeExtension() {
        throw new Error('Method not implemented.');
    }
    updateMetadata(extension, metaData, profileLocation) {
        throw new Error('Method not implemented.');
    }
    scanExtensionManifest(extensionLocation) {
        throw new Error('Method not implemented.');
    }
}
export async function workbenchTeardown(instantiationService) {
    return instantiationService.invokeFunction(async (accessor) => {
        const workingCopyService = accessor.get(IWorkingCopyService);
        const editorGroupService = accessor.get(IEditorGroupsService);
        for (const workingCopy of workingCopyService.workingCopies) {
            await workingCopy.revert();
        }
        for (const group of editorGroupService.groups) {
            await group.closeAllEditors();
        }
        for (const group of editorGroupService.groups) {
            editorGroupService.removeGroup(group);
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDekYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFDbkgsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFrQixpQkFBaUIsRUFBa0IsTUFBTSxpREFBaUQsQ0FBQztBQUNwSCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDakUsT0FBTyxFQUF5USxnQkFBZ0IsRUFBMEYsZ0JBQWdCLElBQUksVUFBVSxFQUE4TCxNQUFNLHdCQUF3QixDQUFDO0FBQ3JuQixPQUFPLEVBQW1GLDJCQUEyQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDcEssT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQThCLHlCQUF5QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDL0gsT0FBTyxFQUFFLHFCQUFxQixFQUE0QyxNQUFNLHlEQUF5RCxDQUFDO0FBQzFJLE9BQU8sRUFBRSx1QkFBdUIsRUFBbUQsTUFBTSxnREFBZ0QsQ0FBQztBQUMxSSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUMvRyxPQUFPLEVBQUUsaUJBQWlC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