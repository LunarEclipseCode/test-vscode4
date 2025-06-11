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
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { codiconsLibrary } from '../../../../../../base/common/codiconsLibrary.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { ILanguageFeaturesService } from '../../../../../../editor/common/services/languageFeatures.js';
import { localize } from '../../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { registerWorkbenchContribution2 } from '../../../../../common/contributions.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { IChatWidgetService, showChatView } from '../../../../chat/browser/chat.js';
import { ChatInputPart } from '../../../../chat/browser/chatInputPart.js';
import { ChatDynamicVariableModel } from '../../../../chat/browser/contrib/chatDynamicVariables.js';
import { computeCompletionRanges } from '../../../../chat/browser/contrib/chatInputCompletions.js';
import { IChatAgentService } from '../../../../chat/common/chatAgents.js';
import { ChatAgentLocation } from '../../../../chat/common/constants.js';
import { ChatContextKeys } from '../../../../chat/common/chatContextKeys.js';
import { chatVariableLeader } from '../../../../chat/common/chatParserTypes.js';
import { NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from '../../../common/notebookContextKeys.js';
import { INotebookKernelService } from '../../../common/notebookKernelService.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import * as icons from '../../notebookIcons.js';
import { getOutputViewModelFromId } from '../cellOutputActions.js';
import { NOTEBOOK_ACTIONS_CATEGORY } from '../coreActions.js';
import './cellChatActions.js';
import { CTX_NOTEBOOK_CHAT_HAS_AGENT } from './notebookChatContext.js';
import { IViewsService } from '../../../../../services/views/common/viewsService.js';
import { createNotebookOutputVariableEntry, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST } from '../../contrib/chat/notebookChatUtils.js';
import { IChatContextPickService } from '../../../../chat/browser/chatContextPickService.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
const NotebookKernelVariableKey = 'kernelVariable';
let NotebookChatContribution = class NotebookChatContribution extends Disposable {
    static { this.ID = 'workbench.contrib.notebookChatContribution'; }
    constructor(contextKeyService, chatAgentService, editorService, chatWidgetService, notebookKernelService, languageFeaturesService, chatContextPickService) {
        super();
        this.editorService = editorService;
        this.chatWidgetService = chatWidgetService;
        this.notebookKernelService = notebookKernelService;
        this.languageFeaturesService = languageFeaturesService;
        this._register(chatContextPickService.registerChatContextItem(new KernelVariableContextPicker(this.editorService, this.notebookKernelService)));
        this._ctxHasProvider = CTX_NOTEBOOK_CHAT_HAS_AGENT.bindTo(contextKeyService);
        const updateNotebookAgentStatus = () => {
            const hasNotebookAgent = Boolean(chatAgentService.getDefaultAgent(ChatAgentLocation.Notebook));
            this._ctxHasProvider.set(hasNotebookAgent);
        };
        updateNotebookAgentStatus();
        this._register(chatAgentService.onDidChangeAgents(updateNotebookAgentStatus));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
            _debugDisplayName: 'chatKernelDynamicCompletions',
            triggerCharacters: [chatVariableLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.supportsFileReferences) {
                    return null;
                }
                if (widget.location !== ChatAgentLocation.Notebook) {
                    return null;
                }
                const variableNameDef = new RegExp(`${chatVariableLeader}\\w*`, 'g');
                const range = computeCompletionRanges(model, position, variableNameDef, true);
                if (!range) {
                    return null;
                }
                const result = { suggestions: [] };
                const afterRange = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + `${chatVariableLeader}${NotebookKernelVariableKey}:`.length);
                result.suggestions.push({
                    label: `${chatVariableLeader}${NotebookKernelVariableKey}`,
                    insertText: `${chatVariableLeader}${NotebookKernelVariableKey}:`,
                    detail: localize('pickKernelVariableLabel', "Pick a variable from the kernel"),
                    range,
                    kind: 18 /* CompletionItemKind.Text */,
                    command: { id: SelectAndInsertKernelVariableAction.ID, title: SelectAndInsertKernelVariableAction.ID, arguments: [{ widget, range: afterRange }] },
                    sortText: 'z'
                });
                await this.addKernelVariableCompletion(widget, result, range, token);
                return result;
            }
        }));
        // output context
        NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.bindTo(contextKeyService).set(NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST);
    }
    async addKernelVariableCompletion(widget, result, info, token) {
        let pattern;
        if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
            pattern = info.varWord.word.toLowerCase().slice(1);
        }
        const notebook = getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
        if (!notebook) {
            return;
        }
        const selectedKernel = this.notebookKernelService.getMatchingKernel(notebook).selected;
        const hasVariableProvider = selectedKernel?.hasVariableProvider;
        if (!hasVariableProvider) {
            return;
        }
        const variables = await selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, CancellationToken.None);
        for await (const variable of variables) {
            if (pattern && !variable.name.toLowerCase().includes(pattern)) {
                continue;
            }
            result.suggestions.push({
                label: { label: variable.name, description: variable.type },
                insertText: `${chatVariableLeader}${NotebookKernelVariableKey}:${variable.name} `,
                filterText: `${chatVariableLeader}${variable.name}`,
                range: info,
                kind: 4 /* CompletionItemKind.Variable */,
                sortText: 'z',
                command: { id: SelectAndInsertKernelVariableAction.ID, title: SelectAndInsertKernelVariableAction.ID, arguments: [{ widget, range: info.insert, variable: variable.name }] },
                detail: variable.type,
                documentation: variable.value,
            });
        }
    }
};
NotebookChatContribution = __decorate([
    __param(0, IContextKeyService),
    __param(1, IChatAgentService),
    __param(2, IEditorService),
    __param(3, IChatWidgetService),
    __param(4, INotebookKernelService),
    __param(5, ILanguageFeaturesService),
    __param(6, IChatContextPickService)
], NotebookChatContribution);
export class SelectAndInsertKernelVariableAction extends Action2 {
    constructor() {
        super({
            id: SelectAndInsertKernelVariableAction.ID,
            title: '' // not displayed
        });
    }
    static { this.ID = 'notebook.chat.selectAndInsertKernelVariable'; }
    async run(accessor, ...args) {
        const editorService = accessor.get(IEditorService);
        const notebookKernelService = accessor.get(INotebookKernelService);
        const quickInputService = accessor.get(IQuickInputService);
        const notebook = getNotebookEditorFromEditorPane(editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
        if (!notebook) {
            return;
        }
        const context = args[0];
        if (!context || !('widget' in context) || !('range' in context)) {
            return;
        }
        const widget = context.widget;
        const range = context.range;
        const variable = context.variable;
        if (variable !== undefined) {
            this.addVariableReference(widget, variable, range, false);
            return;
        }
        const selectedKernel = notebookKernelService.getMatchingKernel(notebook).selected;
        const hasVariableProvider = selectedKernel?.hasVariableProvider;
        if (!hasVariableProvider) {
            return;
        }
        const variables = await selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, CancellationToken.None);
        const quickPickItems = [];
        for await (const variable of variables) {
            quickPickItems.push({
                label: variable.name,
                description: variable.value,
                detail: variable.type,
            });
        }
        const pickedVariable = await quickInputService.pick(quickPickItems, { placeHolder: localize('selectKernelVariablePlaceholder', "Select a kernel variable") });
        if (!pickedVariable) {
            return;
        }
        this.addVariableReference(widget, pickedVariable.label, range, true);
    }
    addVariableReference(widget, variableName, range, updateText) {
        if (range) {
            const text = `#kernelVariable:${variableName}`;
            if (updateText) {
                const editor = widget.inputEditor;
                const success = editor.executeEdits('chatInsertFile', [{ range, text: text + ' ' }]);
                if (!success) {
                    return;
                }
            }
            widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
                id: 'vscode.notebook.variable',
                range: { startLineNumber: range.startLineNumber, startColumn: range.startColumn, endLineNumber: range.endLineNumber, endColumn: range.startColumn + text.length },
                data: variableName,
                fullName: variableName,
                icon: codiconsLibrary.variable,
            });
        }
        else {
            widget.attachmentModel.addContext({
                id: 'vscode.notebook.variable',
                name: variableName,
                value: variableName,
                icon: codiconsLibrary.variable,
                kind: 'generic'
            });
        }
    }
}
let KernelVariableContextPicker = class KernelVariableContextPicker {
    constructor(editorService, notebookKernelService) {
        this.editorService = editorService;
        this.notebookKernelService = notebookKernelService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.notebook.kernelVariable', 'Kernel Variable...');
        this.icon = Codicon.serverEnvironment;
    }
    isEnabled(widget) {
        return widget.location === ChatAgentLocation.Notebook && Boolean(getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument);
    }
    asPicker() {
        const picks = (async () => {
            const notebook = getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
            if (!notebook) {
                return [];
            }
            const selectedKernel = this.notebookKernelService.getMatchingKernel(notebook).selected;
            const hasVariableProvider = selectedKernel?.hasVariableProvider;
            if (!hasVariableProvider) {
                return [];
            }
            const variables = selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, CancellationToken.None);
            const result = [];
            for await (const variable of variables) {
                result.push({
                    label: variable.name,
                    description: variable.value,
                    asAttachment: () => {
                        return {
                            kind: 'generic',
                            id: 'vscode.notebook.variable',
                            name: variable.name,
                            value: variable.value,
                            icon: codiconsLibrary.variable,
                        };
                    },
                });
            }
            return result;
        })();
        return {
            placeholder: localize('chatContext.notebook.kernelVariable.placeholder', 'Select a kernel variable'),
            picks
        };
    }
};
KernelVariableContextPicker = __decorate([
    __param(0, IEditorService),
    __param(1, INotebookKernelService)
], KernelVariableContextPicker);
registerAction2(class CopyCellOutputAction extends Action2 {
    constructor() {
        super({
            id: 'notebook.cellOutput.addToChat',
            title: localize('notebookActions.addOutputToChat', "Add Cell Output to Chat"),
            menu: {
                id: MenuId.NotebookOutputToolbar,
                when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, ContextKeyExpr.in(NOTEBOOK_CELL_OUTPUT_MIMETYPE.key, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.key)),
                order: 10,
                group: 'notebook_chat_actions'
            },
            category: NOTEBOOK_ACTIONS_CATEGORY,
            icon: icons.copyIcon,
            precondition: ChatContextKeys.enabled
        });
    }
    getNoteboookEditor(editorService, outputContext) {
        if (outputContext && 'notebookEditor' in outputContext) {
            return outputContext.notebookEditor;
        }
        return getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    }
    async run(accessor, outputContext) {
        const notebookEditor = this.getNoteboookEditor(accessor.get(IEditorService), outputContext);
        const viewService = accessor.get(IViewsService);
        if (!notebookEditor) {
            return;
        }
        let outputViewModel;
        if (outputContext && 'outputId' in outputContext && typeof outputContext.outputId === 'string') {
            outputViewModel = getOutputViewModelFromId(outputContext.outputId, notebookEditor);
        }
        else if (outputContext && 'outputViewModel' in outputContext) {
            outputViewModel = outputContext.outputViewModel;
        }
        if (!outputViewModel) {
            // not able to find the output from the provided context, use the active cell
            const activeCell = notebookEditor.getActiveCell();
            if (!activeCell) {
                return;
            }
            if (activeCell.focusedOutputId !== undefined) {
                outputViewModel = activeCell.outputsViewModels.find(output => {
                    return output.model.outputId === activeCell.focusedOutputId;
                });
            }
            else {
                outputViewModel = activeCell.outputsViewModels.find(output => output.pickedMimeType?.isTrusted);
            }
        }
        if (!outputViewModel) {
            return;
        }
        const mimeType = outputViewModel.pickedMimeType?.mimeType;
        const chatWidgetService = accessor.get(IChatWidgetService);
        let widget = chatWidgetService.lastFocusedWidget;
        if (!widget) {
            const widgets = chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Panel);
            if (widgets.length === 0) {
                return;
            }
            widget = widgets[0];
        }
        if (mimeType && NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST.includes(mimeType)) {
            const entry = createNotebookOutputVariableEntry(outputViewModel, mimeType, notebookEditor);
            if (!entry) {
                return;
            }
            widget.attachmentModel.addContext(entry);
            (await showChatView(viewService))?.focusInput();
        }
    }
});
registerAction2(SelectAndInsertKernelVariableAction);
registerWorkbenchContribution2(NotebookChatContribution.ID, NotebookChatContribution, 2 /* WorkbenchPhase.BlockRestore */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2suY2hhdC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJvbGxlci9jaGF0L25vdGVib29rLmNoYXQuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFeEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBSXRFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN4RyxPQUFPLEVBQUUsY0FBYyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFN0gsT0FBTyxFQUFFLGtCQUFrQixFQUF1QyxNQUFNLDREQUE0RCxDQUFDO0FBQ3JJLE9BQU8sRUFBMEIsOEJBQThCLEVBQWtCLE1BQU0sd0NBQXdDLENBQUM7QUFDaEksT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3hGLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxZQUFZLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNqRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMERBQTBELENB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