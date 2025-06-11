/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { timeout } from '../../../../../base/common/async.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { CoreEditingCommands, CoreNavigationCommands } from '../../../../browser/coreCommands.js';
import { withAsyncTestCodeEditor } from '../../../../test/browser/testCodeEditor.js';
import { autorun, derived } from '../../../../../base/common/observable.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ILanguageFeaturesService } from '../../../../common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../../../common/services/languageFeaturesService.js';
import { InlineCompletionsController } from '../../browser/controller/inlineCompletionsController.js';
import { Range } from '../../../../common/core/range.js';
import { TextEdit } from '../../../../common/core/edits/textEdit.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { PositionOffsetTransformer } from '../../../../common/core/text/positionToOffset.js';
export class MockInlineCompletionsProvider {
    constructor() {
        this.returnValue = [];
        this.delayMs = 0;
        this.callHistory = new Array();
        this.calledTwiceIn50Ms = false;
        this.lastTimeMs = undefined;
    }
    setReturnValue(value, delayMs = 0) {
        this.returnValue = value ? [value] : [];
        this.delayMs = delayMs;
    }
    setReturnValues(values, delayMs = 0) {
        this.returnValue = values;
        this.delayMs = delayMs;
    }
    getAndClearCallHistory() {
        const history = [...this.callHistory];
        this.callHistory = [];
        return history;
    }
    assertNotCalledTwiceWithin50ms() {
        if (this.calledTwiceIn50Ms) {
            throw new Error('provideInlineCompletions has been called at least twice within 50ms. This should not happen.');
        }
    }
    async provideInlineCompletions(model, position, context, token) {
        const currentTimeMs = new Date().getTime();
        if (this.lastTimeMs && currentTimeMs - this.lastTimeMs < 50) {
            this.calledTwiceIn50Ms = true;
        }
        this.lastTimeMs = currentTimeMs;
        this.callHistory.push({
            position: position.toString(),
            triggerKind: context.triggerKind,
            text: model.getValue()
        });
        const result = new Array();
        for (const v of this.returnValue) {
            const x = { ...v };
            if (!x.range) {
                x.range = model.getFullModelRange();
            }
            result.push(x);
        }
        if (this.delayMs > 0) {
            await timeout(this.delayMs);
        }
        return { items: result };
    }
    freeInlineCompletions() { }
    handleItemDidShow() { }
}
export class MockSearchReplaceCompletionsProvider {
    constructor() {
        this._map = new Map();
    }
    add(search, replace) {
        this._map.set(search, replace);
    }
    async provideInlineCompletions(model, position, context, token) {
        const text = model.getValue();
        for (const [search, replace] of this._map) {
            const idx = text.indexOf(search);
            // replace idx...idx+text.length with replace
            if (idx !== -1) {
                const range = Range.fromPositions(model.getPositionAt(idx), model.getPositionAt(idx + search.length));
                return {
                    items: [
                        { range, insertText: replace, isInlineEdit: true }
                    ]
                };
            }
        }
        return { items: [] };
    }
    freeInlineCompletions() { }
    handleItemDidShow() { }
}
export class InlineEditContext extends Disposable {
    constructor(model, editor) {
        super();
        this.editor = editor;
        this.prettyViewStates = new Array();
        const edit = derived(reader => {
            const state = model.state.read(reader);
            return state ? new TextEdit(state.edits) : undefined;
        });
        this._register(autorun(reader => {
            /** @description update */
            const e = edit.read(reader);
            let view;
            if (e) {
                view = e.toString(this.editor.getValue());
            }
            else {
                view = undefined;
            }
            this.prettyViewStates.push(view);
        }));
    }
    getAndClearViewStates() {
        const arr = [...this.prettyViewStates];
        this.prettyViewStates.length = 0;
        return arr;
    }
}
export class GhostTextContext extends Disposable {
    get currentPrettyViewState() {
        return this._currentPrettyViewState;
    }
    constructor(model, editor) {
        super();
        this.editor = editor;
        this.prettyViewStates = new Array();
        this._register(autorun(reader => {
            /** @description update */
            const ghostText = model.primaryGhostText.read(reader);
            let view;
            if (ghostText) {
                view = ghostText.render(this.editor.getValue(), true);
            }
            else {
                view = this.editor.getValue();
            }
            if (this._currentPrettyViewState !== view) {
                this.prettyViewStates.push(view);
            }
            this._currentPrettyViewState = view;
        }));
    }
    getAndClearViewStates() {
        const arr = [...this.prettyViewStates];
        this.prettyViewStates.length = 0;
        return arr;
    }
    keyboardType(text) {
        this.editor.trigger('keyboard', 'type', { text });
    }
    cursorUp() {
        CoreNavigationCommands.CursorUp.runEditorCommand(null, this.editor, null);
    }
    cursorRight() {
        CoreNavigationCommands.CursorRight.runEditorCommand(null, this.editor, null);
    }
    cursorLeft() {
        CoreNavigationCommands.CursorLeft.runEditorCommand(null, this.editor, null);
    }
    cursorDown() {
        CoreNavigationCommands.CursorDown.runEditorCommand(null, this.editor, null);
    }
    cursorLineEnd() {
        CoreNavigationCommands.CursorLineEnd.runEditorCommand(null, this.editor, null);
    }
    leftDelete() {
        CoreEditingCommands.DeleteLeft.runEditorCommand(null, this.editor, null);
    }
}
export async function withAsyncTestCodeEditorAndInlineCompletionsModel(text, options, callback) {
    return await runWithFakedTimers({
        useFakeTimers: options.fakeClock,
    }, async () => {
        const disposableStore = new DisposableStore();
        try {
            if (options.provider) {
                const languageFeaturesService = new LanguageFeaturesService();
                if (!options.serviceCollection) {
                    options.serviceCollection = new ServiceCollection();
                }
                options.serviceCollection.set(ILanguageFeaturesService, languageFeaturesService);
                options.serviceCollection.set(IAccessibilitySignalService, {
                    playSignal: async () => { },
                    isSoundEnabled(signal) { return false; },
                });
                const d = languageFeaturesService.inlineCompletionsProvider.register({ pattern: '**' }, options.provider);
                disposableStore.add(d);
            }
            let result;
            await withAsyncTestCodeEditor(text, options, async (editor, editorViewModel, instantiationService) => {
                const controller = instantiationService.createInstance(InlineCompletionsController, editor);
                controller.testOnlyDisableUi();
                const model = controller.model.get();
                const context = new GhostTextContext(model, editor);
                try {
                    result = await callback({ editor, editorViewModel, model, context, store: disposableStore });
                }
                finally {
                    context.dispose();
                    model.dispose();
                    controller.dispose();
                }
            });
            if (options.provider instanceof MockInlineCompletionsProvider) {
                options.provider.assertNotCalledTwiceWithin50ms();
            }
            return result;
        }
        finally {
            disposableStore.dispose();
        }
    });
}
export class AnnotatedString {
    constructor(src, annotations = ['↓']) {
        const markers = findMarkers(src, annotations);
        this.value = markers.textWithoutMarkers;
        this.markers = markers.results;
    }
    getMarkerOffset(markerIdx = 0) {
        if (markerIdx >= this.markers.length) {
            throw new BugIndicatingError(`Marker index ${markerIdx} out of bounds`);
        }
        return this.markers[markerIdx].idx;
    }
}
function findMarkers(text, markers) {
    const results = [];
    let textWithoutMarkers = '';
    markers.sort((a, b) => b.length - a.length);
    let pos = 0;
    for (let i = 0; i < text.length;) {
        let foundMarker = false;
        for (const marker of markers) {
            if (text.startsWith(marker, i)) {
                results.push({ mark: marker, idx: pos });
                i += marker.length;
                foundMarker = true;
                break;
            }
        }
        if (!foundMarker) {
            textWithoutMarkers += text[i];
            pos++;
            i++;
        }
    }
    return { results, textWithoutMarkers };
}
export class AnnotatedText extends AnnotatedString {
    constructor() {
        super(...arguments);
        this._transformer = new PositionOffsetTransformer(this.value);
    }
    getMarkerPosition(markerIdx = 0) {
        return this._transformer.getPosition(this.getMarkerOffset(markerIdx));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL3Rlc3QvYnJvd3Nlci91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUlsRyxPQUFPLEVBQXVELHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFMUksT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxtRkFBbUYsQ0FBQztBQUNoSSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUMzRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUVqRyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRTdGLE1BQU0sT0FB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