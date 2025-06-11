var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getWindow, n } from '../../../../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../../../../base/browser/mouseEvent.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived, observableValue } from '../../../../../../../base/common/observable.js';
import { editorBackground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { LineSource, renderLines, RenderOptions } from '../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js';
import { LineRange } from '../../../../../../common/core/ranges/lineRange.js';
import { ILanguageService } from '../../../../../../common/languages/language.js';
import { LineTokens } from '../../../../../../common/tokens/lineTokens.js';
import { TokenArray } from '../../../../../../common/tokens/tokenArray.js';
import { InlineEditTabAction } from '../inlineEditsViewInterface.js';
import { getEditorBlendedColor, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorsuccessfulBackground } from '../theme.js';
import { maxContentWidthInRange, rectToProps } from '../utils/utils.js';
let InlineEditsCustomView = class InlineEditsCustomView extends Disposable {
    constructor(_editor, displayLocation, tabAction, themeService, _languageService) {
        super();
        this._editor = _editor;
        this._languageService = _languageService;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._isHovered = observableValue(this, false);
        this.isHovered = this._isHovered;
        this._viewRef = n.ref();
        this._editorObs = observableCodeEditor(this._editor);
        /* const styles = derived(reader => ({
            background: getEditorBlendedColor(modifiedChangedLineBackgroundColor, themeService).read(reader).toString(),
            border: asCssVariable(getModifiedBorderColor(tabAction).read(reader)),
        })); */
        const styles = tabAction.map((v, reader) => {
            let border;
            switch (v) {
                case InlineEditTabAction.Inactive:
                    border = inlineEditIndicatorSecondaryBackground;
                    break;
                case InlineEditTabAction.Jump:
                    border = inlineEditIndicatorPrimaryBackground;
                    break;
                case InlineEditTabAction.Accept:
                    border = inlineEditIndicatorsuccessfulBackground;
                    break;
            }
            return {
                border: getEditorBlendedColor(border, themeService).read(reader).toString(),
                background: asCssVariable(editorBackground)
            };
        });
        /* const styles = derived(reader => ({
            background: asCssVariable(editorBackground),
            border: asCssVariable(getModifiedBorderColor(tabAction).read(reader)),
        })); */
        const state = displayLocation.map(dl => dl ? this.getState(dl) : undefined);
        const view = state.map(s => s ? this.getRendering(s, styles) : undefined);
        const overlay = n.div({
            class: 'inline-edits-custom-view',
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
                display: 'block',
            },
        }, [view]).keepUpdated(this._store);
        this._register(this._editorObs.createOverlayWidget({
            domNode: overlay.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: constObservable(0),
        }));
        this._register(autorun((reader) => {
            const v = view.read(reader);
            if (!v) {
                this._isHovered.set(false, undefined);
                return;
            }
            this._isHovered.set(overlay.isHovered.read(reader), undefined);
        }));
    }
    getState(displayLocation) {
        const contentState = derived((reader) => {
            const startLineNumber = displayLocation.range.startLineNumber;
            const endLineNumber = displayLocation.range.endLineNumber;
            const startColumn = displayLocation.range.startColumn;
            const endColumn = displayLocation.range.endColumn;
            const lineCount = this._editor.getModel()?.getLineCount() ?? 0;
            const lineWidth = maxContentWidthInRange(this._editorObs, new LineRange(startLineNumber, startLineNumber + 1), reader);
            const lineWidthBelow = startLineNumber + 1 <= lineCount ? maxContentWidthInRange(this._editorObs, new LineRange(startLineNumber + 1, startLineNumber + 2), reader) : undefined;
            const lineWidthAbove = startLineNumber - 1 >= 1 ? maxContentWidthInRange(this._editorObs, new LineRange(startLineNumber - 1, startLineNumber), reader) : undefined;
            const startContentLeftOffset = this._editor.getOffsetForColumn(startLineNumber, startColumn);
            const endContentLeftOffset = this._editor.getOffsetForColumn(endLineNumber, endColumn);
            return {
                lineWidth,
                lineWidthBelow,
                lineWidthAbove,
                startContentLeftOffset,
                endContentLeftOffset
            };
        });
        const minEndOfLinePadding = 14;
        const paddingVertically = 0;
        const paddingHorizontally = 4;
        const horizontalOffsetWhenAboveBelow = 4;
        const verticalOffsetWhenAboveBelow = 2;
        // !! minEndOfLinePadding should always be larger than paddingHorizontally + horizontalOffsetWhenAboveBelow
        const rect = derived((reader) => {
            const w = this._editorObs.getOption(55 /* EditorOption.fontInfo */).read(reader).typicalHalfwidthCharacterWidth;
            const startLineNumber = displayLocation.range.startLineNumber;
            const endLineNumber = displayLocation.range.endLineNumber;
            const { lineWidth, lineWidthBelow, lineWidthAbove, startContentLeftOffset, endContentLeftOffset } = contentState.read(reader);
            const contentLeft = this._editorObs.layoutInfoContentLeft.read(reader);
            const lineHeight = this._editorObs.getOption(71 /* EditorOption.lineHeight */).read(reader);
            const scrollTop = this._editorObs.scrollTop.read(reader);
            const scrollLeft = this._editorObs.scrollLeft.read(reader);
            let position;
            if (startLineNumber === endLineNumber && endContentLeftOffset + 5 * w >= lineWidth) {
                position = 'end'; // Render at the end of the line if the range ends almost at the end of the line
            }
            else if (lineWidthBelow !== undefined && lineWidthBelow + minEndOfLinePadding - horizontalOffsetWhenAboveBelow - paddingHorizontally < startContentLeftOffset) {
                position = 'below'; // Render Below if possible
            }
            else if (lineWidthAbove !== undefined && lineWidthAbove + minEndOfLinePadding - horizontalOffsetWhenAboveBelow - paddingHorizontally < startContentLeftOffset) {
                position = 'above'; // Render Above if possible
            }
            else {
                position = 'end'; // Render at the end of the line otherwise
            }
            let topOfLine;
            let contentStartOffset;
            let deltaX = 0;
            let deltaY = 0;
            switch (position) {
                case 'end': {
                    topOfLine = this._editorObs.editor.getTopForLineNumber(startLineNumber);
                    contentStartOffset = lineWidth;
                    deltaX = paddingHorizontally + minEndOfLinePadding;
                    break;
                }
                case 'below': {
                    topOfLine = this._editorObs.editor.getTopForLineNumber(startLineNumber + 1);
                    contentStartOffset = startContentLeftOffset;
                    deltaX = paddingHorizontally + horizontalOffsetWhenAboveBelow;
                    deltaY = paddingVertically + verticalOffsetWhenAboveBelow;
                    break;
                }
                case 'above': {
                    topOfLine = this._editorObs.editor.getTopForLineNumber(startLineNumber - 1);
                    contentStartOffset = startContentLeftOffset;
                    deltaX = paddingHorizontally + horizontalOffsetWhenAboveBelow;
                    deltaY = -paddingVertically + verticalOffsetWhenAboveBelow;
                    break;
                }
            }
            const textRect = Rect.fromLeftTopWidthHeight(contentLeft + contentStartOffset - scrollLeft, topOfLine - scrollTop, w * displayLocation.label.length, lineHeight);
            return textRect.withMargin(paddingVertically, paddingHorizontally).translateX(deltaX).translateY(deltaY);
        });
        return {
            rect,
            label: displayLocation.label
        };
    }
    getRendering(state, styles) {
        const line = document.createElement('div');
        const t = this._editor.getModel().tokenization.tokenizeLinesAt(1, [state.label])?.[0];
        let tokens;
        if (t) {
            tokens = TokenArray.fromLineTokens(t).toLineTokens(state.label, this._languageService.languageIdCodec);
        }
        else {
            tokens = LineTokens.createEmpty(state.label, this._languageService.languageIdCodec);
        }
        const result = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor).withSetWidth(false).withScrollBeyondLastColumn(0), [], line, true);
        line.style.width = `${result.minWidthInPx}px`;
        const rect = state.rect.map(r => r.withMargin(0, 4));
        return n.div({
            class: 'collapsedView',
            ref: this._viewRef,
            style: {
                position: 'absolute',
                ...rectToProps(reader => rect.read(reader)),
                overflow: 'hidden',
                boxSizing: 'border-box',
                cursor: 'pointer',
                border: styles.map(s => `1px solid ${s.border}`),
                borderRadius: '4px',
                backgroundColor: styles.map(s => s.background),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
            },
            onclick: (e) => { this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e)); }
        }, [
            line
        ]);
    }
};
InlineEditsCustomView = __decorate([
    __param(3, IThemeService),
    __param(4, ILanguageService)
], InlineEditsCustomView);
export { InlineEditsCustomView };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNDdXN0b21WaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c0N1c3RvbVZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN4RSxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNsRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqSSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUMvRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDekYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRTNGLE9BQU8sRUFBd0Isb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkZBQTJGLENBQUM7QUFFbkosT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRTlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2xGLE9BQU8sRUFB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