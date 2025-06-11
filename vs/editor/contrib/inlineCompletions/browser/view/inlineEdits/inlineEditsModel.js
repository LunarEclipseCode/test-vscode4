/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { derived } from '../../../../../../base/common/observable.js';
import { localize } from '../../../../../../nls.js';
import { observableCodeEditor } from '../../../../../browser/observableCodeEditor.js';
import { TextEdit } from '../../../../../common/core/edits/textEdit.js';
import { StringText } from '../../../../../common/core/text/abstractText.js';
import { InlineEditTabAction } from './inlineEditsViewInterface.js';
import { InlineEditWithChanges } from './inlineEditWithChanges.js';
export class InlineEditModel {
    constructor(_model, inlineEdit, tabAction) {
        this._model = _model;
        this.inlineEdit = inlineEdit;
        this.tabAction = tabAction;
        this.action = this.inlineEdit.inlineCompletion.action;
        this.displayName = this.inlineEdit.inlineCompletion.source.provider.displayName ?? localize('inlineEdit', "Inline Edit");
        this.extensionCommands = this.inlineEdit.inlineCompletion.source.inlineSuggestions.commands ?? [];
        this.displayLocation = this.inlineEdit.inlineCompletion.displayLocation;
        this.showCollapsed = this._model.showCollapsed;
    }
    accept() {
        this._model.accept();
    }
    jump() {
        this._model.jump();
    }
    abort(reason) {
        console.error(reason); // TODO: add logs/telemetry
        this._model.stop();
    }
    handleInlineEditShown() {
        this._model.handleInlineSuggestionShown(this.inlineEdit.inlineCompletion);
    }
}
export class InlineEditHost {
    constructor(_model) {
        this._model = _model;
        this.onDidAccept = this._model.onDidAccept;
        this.inAcceptFlow = this._model.inAcceptFlow;
    }
}
export class GhostTextIndicator {
    constructor(editor, model, lineRange, inlineCompletion) {
        this.lineRange = lineRange;
        const editorObs = observableCodeEditor(editor);
        const tabAction = derived(this, reader => {
            if (editorObs.isFocused.read(reader)) {
                if (inlineCompletion.showInlineEditMenu) {
                    return InlineEditTabAction.Accept;
                }
            }
            return InlineEditTabAction.Inactive;
        });
        this.model = new InlineEditModel(model, new InlineEditWithChanges(new StringText(''), new TextEdit([inlineCompletion.getSingleTextEdit()]), model.primaryPosition.get(), inlineCompletion.source.inlineSuggestions.commands ?? [], inlineCompletion), tabAction);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci92aWV3L2lubGluZUVkaXRzL2lubGluZUVkaXRzTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBZSxNQUFNLDZDQUE2QyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUVwRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUV0RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBSTdFLE9BQU8sRUFBcUMsbUJBQW1CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN2RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUVuRSxNQUFNLE9BQU8sZUFBZTtJQVMzQixZQUNrQixNQUE4QixFQUN0QyxVQUFpQyxFQUNqQyxTQUEyQztRQUZuQyxXQUFNLEdBQU4sTUFBTSxDQUF3QjtRQUN0QyxlQUFVLEdBQVYsVUFBVSxDQUF1QjtRQUNqQyxjQUFTLEdBQVQsU0FBUyxDQUFrQztRQUVwRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDO1FBQ3RELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsSUFBSSxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3pILElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBRWxHLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUM7UUFDeEUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztJQUNoRCxDQUFDO0lBRUQsTUFBTTtRQUNMLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVELElBQUk7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxLQUFLLENBQUMsTUFBYztRQUNuQixPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsMkJBQTJCO1FBQ2xELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVELHFCQUFxQjtRQUNwQixJQUFJLENBQUMsTUFBTSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUMzRSxDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sY0FBYztJQUkxQixZQUNrQixNQUE4QjtRQUE5QixXQUFNLEdBQU4sTUFBTSxDQUF3QjtRQUUvQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO1FBQzNDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7SUFDOUMsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLGtCQUFrQjtJQUk5QixZQUNDLE1BQW1CLEVBQ25CLEtBQTZCLEVBQ3BCLFNBQW9CLEVBQzdCLGdCQUFzQztRQUQ3QixjQUFTLEdBQVQsU0FBUyxDQUFXO1FBRzdCLE1BQU0sU0FBUyxHQUFHLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBc0IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1lBQzdELElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO29CQUN6QyxPQUFPLG1CQUFtQixDQUFDLE1BQU0sQ0FBQztnQkFDbkMsQ0FBQztZQUNGLENBQUM7WUFDRCxPQUFPLG1CQUFtQixDQUFDLFFBQVEsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxlQUFlLENBQy9CLEtBQUssRUFDTCxJQUFJLHFCQUFxQixDQUN4QixJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFDbEIsSUFBSSxRQUFRLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsRUFDcEQsS0FBSyxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsRUFDM0IsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQ3hELGdCQUFnQixDQUNoQixFQUNELFNBQVMsQ0FDVCxDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=