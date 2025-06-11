/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable, DisposableStore, dispose } from '../../../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../../../nls.js';
import { Categories } from '../../../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import { registerNotebookContribution } from '../../notebookEditorExtensions.js';
import { INotebookService } from '../../../common/notebookService.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { n } from '../../../../../../base/browser/dom.js';
export class TroubleshootController extends Disposable {
    static { this.id = 'workbench.notebook.troubleshoot'; }
    constructor(_notebookEditor) {
        super();
        this._notebookEditor = _notebookEditor;
        this._localStore = this._register(new DisposableStore());
        this._cellStateListeners = [];
        this._enabled = false;
        this._cellStatusItems = [];
        this._cellOverlayIds = [];
        this._register(this._notebookEditor.onDidChangeModel(() => {
            this._update();
        }));
        this._update();
    }
    toggle() {
        this._enabled = !this._enabled;
        this._update();
    }
    _update() {
        this._localStore.clear();
        this._cellStateListeners.forEach(listener => listener.dispose());
        this._removeCellOverlays();
        this._removeNotebookOverlay();
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        this._updateListener();
        if (this._enabled) {
            this._createNotebookOverlay();
            this._createCellOverlays();
        }
    }
    _log(cell, e) {
        if (this._enabled) {
            const oldHeight = this._notebookEditor.getViewHeight(cell);
            console.log(`cell#${cell.handle}`, e, `${oldHeight} -> ${cell.layoutInfo.totalHeight}`);
        }
    }
    _createCellOverlays() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        for (let i = 0; i < this._notebookEditor.getLength(); i++) {
            const cell = this._notebookEditor.cellAt(i);
            this._createCellOverlay(cell, i);
        }
        // Add listener for new cells
        this._localStore.add(this._notebookEditor.onDidChangeViewCells(e => {
            const addedCells = e.splices.reduce((acc, [, , newCells]) => [...acc, ...newCells], []);
            for (let i = 0; i < addedCells.length; i++) {
                const cellIndex = this._notebookEditor.getCellIndex(addedCells[i]);
                if (cellIndex !== undefined) {
                    this._createCellOverlay(addedCells[i], cellIndex);
                }
            }
        }));
    }
    _createNotebookOverlay() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        const listViewTop = this._notebookEditor.getLayoutInfo().listViewOffsetTop;
        const scrollTop = this._notebookEditor.scrollTop;
        const overlay = n.div({
            style: {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '1000'
            }
        }, [
            // Top line
            n.div({
                style: {
                    position: 'absolute',
                    top: `${listViewTop}px`,
                    left: '0',
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'rgba(0, 0, 255, 0.7)'
                }
            }),
            // Text label for the notebook overlay
            n.div({
                style: {
                    position: 'absolute',
                    top: `${listViewTop}px`,
                    left: '10px',
                    backgroundColor: 'rgba(0, 0, 255, 0.7)',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: '1001'
                }
            }, [`ScrollTop: ${scrollTop}px`])
        ]).keepUpdated(this._store);
        this._notebookOverlayDomNode = overlay.element;
        if (this._notebookOverlayDomNode) {
            this._notebookEditor.getDomNode().appendChild(this._notebookOverlayDomNode);
        }
        this._localStore.add(this._notebookEditor.onDidScroll(() => {
            const scrollTop = this._notebookEditor.scrollTop;
            const listViewTop = this._notebookEditor.getLayoutInfo().listViewOffsetTop;
            if (this._notebookOverlayDomNode) {
                // Update label
                const labelElement = this._notebookOverlayDomNode.querySelector('div:nth-child(2)');
                if (labelElement) {
                    labelElement.textContent = `ScrollTop: ${scrollTop}px`;
                    labelElement.style.top = `${listViewTop}px`;
                }
                // Update top line
                const topLineElement = this._notebookOverlayDomNode.querySelector('div:first-child');
                if (topLineElement) {
                    topLineElement.style.top = `${listViewTop}px`;
                }
            }
        }));
    }
    _createCellOverlay(cell, index) {
        const overlayContainer = document.createElement('div');
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = '0';
        overlayContainer.style.left = '0';
        overlayContainer.style.width = '100%';
        overlayContainer.style.height = '100%';
        overlayContainer.style.pointerEvents = 'none';
        overlayContainer.style.zIndex = '1000';
        const topLine = document.createElement('div');
        topLine.style.position = 'absolute';
        topLine.style.top = '0';
        topLine.style.left = '0';
        topLine.style.width = '100%';
        topLine.style.height = '2px';
        topLine.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        overlayContainer.appendChild(topLine);
        const cellTop = this._notebookEditor.getAbsoluteTopOfElement(cell);
        const label = document.createElement('div');
        label.textContent = `cell #${index} (handle: ${cell.handle}) | AbsoluteTopOfElement: ${cellTop}px`;
        label.style.position = 'absolute';
        label.style.top = '0px';
        label.style.right = '10px';
        label.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        label.style.color = 'white';
        label.style.fontSize = '11px';
        label.style.fontWeight = 'bold';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '3px';
        label.style.whiteSpace = 'nowrap';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '1001';
        overlayContainer.appendChild(label);
        let overlayId = undefined;
        this._notebookEditor.changeCellOverlays((accessor) => {
            overlayId = accessor.addOverlay({
                cell,
                domNode: overlayContainer
            });
        });
        if (overlayId) {
            this._cellOverlayIds.push(overlayId);
            // Update overlay when layout changes
            const updateLayout = () => {
                const scrollTop = this._notebookEditor.getAbsoluteTopOfElement(cell);
                // Update label text
                label.textContent = `cell #${index} (handle: ${cell.handle}) | AbsoluteTopOfElement: ${scrollTop}px`;
                // Refresh the overlay position
                if (overlayId) {
                    this._notebookEditor.changeCellOverlays((accessor) => {
                        accessor.layoutOverlay(overlayId);
                    });
                }
            };
            this._localStore.add(cell.onDidChangeLayout((e) => {
                updateLayout();
            }));
            this._localStore.add(this._notebookEditor.onDidChangeLayout(() => {
                updateLayout();
            }));
        }
    }
    _removeCellOverlays() {
        if (this._cellOverlayIds.length > 0) {
            this._notebookEditor.changeCellOverlays((accessor) => {
                for (const id of this._cellOverlayIds) {
                    accessor.removeOverlay(id);
                }
            });
            this._cellOverlayIds = [];
        }
    }
    _removeNotebookOverlay() {
        if (this._notebookOverlayDomNode) {
            this._notebookOverlayDomNode.remove();
            this._notebookOverlayDomNode = undefined;
        }
    }
    _updateListener() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        for (let i = 0; i < this._notebookEditor.getLength(); i++) {
            const cell = this._notebookEditor.cellAt(i);
            this._cellStateListeners.push(cell.onDidChangeLayout(e => {
                this._log(cell, e);
            }));
        }
        this._localStore.add(this._notebookEditor.onDidChangeViewCells(e => {
            [...e.splices].reverse().forEach(splice => {
                const [start, deleted, newCells] = splice;
                const deletedCells = this._cellStateListeners.splice(start, deleted, ...newCells.map(cell => {
                    return cell.onDidChangeLayout((e) => {
                        this._log(cell, e);
                    });
                }));
                dispose(deletedCells);
            });
        }));
        const vm = this._notebookEditor.getViewModel();
        let items = [];
        if (this._enabled) {
            items = this._getItemsForCells();
        }
        this._cellStatusItems = vm.deltaCellStatusBarItems(this._cellStatusItems, items);
    }
    _getItemsForCells() {
        const items = [];
        for (let i = 0; i < this._notebookEditor.getLength(); i++) {
            items.push({
                handle: i,
                items: [
                    {
                        text: `index: ${i}`,
                        alignment: 1 /* CellStatusbarAlignment.Left */,
                        priority: Number.MAX_SAFE_INTEGER
                    }
                ]
            });
        }
        return items;
    }
    dispose() {
        dispose(this._cellStateListeners);
        this._removeCellOverlays();
        this._removeNotebookOverlay();
        this._localStore.clear();
        super.dispose();
    }
}
registerNotebookContribution(TroubleshootController.id, TroubleshootController);
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.toggleLayoutTroubleshoot',
            title: localize2('workbench.notebook.toggleLayoutTroubleshoot', "Toggle Notebook Layout Troubleshoot"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        const controller = editor.getContribution(TroubleshootController.id);
        controller?.toggle();
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.inspectLayout',
            title: localize2('workbench.notebook.inspectLayout', "Inspect Notebook Layout"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor || !editor.hasModel()) {
            return;
        }
        for (let i = 0; i < editor.getLength(); i++) {
            const cell = editor.cellAt(i);
            console.log(`cell#${cell.handle}`, cell.layoutInfo);
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.clearNotebookEdtitorTypeCache',
            title: localize2('workbench.notebook.clearNotebookEdtitorTypeCache', "Clear Notebook Editor Type Cache"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const notebookService = accessor.get(INotebookService);
        notebookService.clearEditorCache();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvdHJvdWJsZXNob290L2xheW91dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDckQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFaEcsT0FBTyxFQUFFLCtCQUErQixFQUF3SSxNQUFNLDBCQUEwQixDQUFDO0FBQ2pOLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBR2pGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4RixPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFMUQsTUFBTSxPQUFPLHNCQUF1QixTQUFRLFVBQVU7YUFDOUMsT0FBRSxHQUFXLGlDQUFpQyxBQUE1QyxDQUE2QztJQVN0RCxZQUE2QixlQUFnQztRQUM1RCxLQUFLLEVBQUUsQ0FBQztRQURvQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFQNUMsZ0JBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZUFBZSxFQUFFLENBQUMsQ0FBQztRQUM3RCx3QkFBbUIsR0FBa0IsRUFBRSxDQUFDO1FBQ3hDLGFBQVEsR0FBWSxLQUFLLENBQUM7UUFDMUIscUJBQWdCLEdBQWEsRUFBRSxD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