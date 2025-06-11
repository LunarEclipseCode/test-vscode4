/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../../base/browser/dom.js';
import { createFastDomNode } from '../../../../base/browser/fastDomNode.js';
import * as strings from '../../../../base/common/strings.js';
import { applyFontInfo } from '../../config/domFontInfo.js';
import { TextEditorCursorStyle } from '../../../common/config/editorOptions.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../base/browser/ui/mouseCursor/mouseCursor.js';
class ViewCursorRenderData {
    constructor(top, left, paddingLeft, width, height, textContent, textContentClassName) {
        this.top = top;
        this.left = left;
        this.paddingLeft = paddingLeft;
        this.width = width;
        this.height = height;
        this.textContent = textContent;
        this.textContentClassName = textContentClassName;
    }
}
export var CursorPlurality;
(function (CursorPlurality) {
    CursorPlurality[CursorPlurality["Single"] = 0] = "Single";
    CursorPlurality[CursorPlurality["MultiPrimary"] = 1] = "MultiPrimary";
    CursorPlurality[CursorPlurality["MultiSecondary"] = 2] = "MultiSecondary";
})(CursorPlurality || (CursorPlurality = {}));
export class ViewCursor {
    constructor(context, plurality) {
        this._context = context;
        const options = this._context.configuration.options;
        const fontInfo = options.get(55 /* EditorOption.fontInfo */);
        this._cursorStyle = options.get(150 /* EditorOption.effectiveCursorStyle */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._lineCursorWidth = Math.min(options.get(34 /* EditorOption.cursorWidth */), this._typicalHalfwidthCharacterWidth);
        this._isVisible = true;
        // Create the dom node
        this._domNode = createFastDomNode(document.createElement('div'));
        this._domNode.setClassName(`cursor ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
        this._domNode.setHeight(this._context.viewLayout.getLineHeightForLineNumber(1));
        this._domNode.setTop(0);
        this._domNode.setLeft(0);
        applyFontInfo(this._domNode, fontInfo);
        this._domNode.setDisplay('none');
        this._position = new Position(1, 1);
        this._pluralityClass = '';
        this.setPlurality(plurality);
        this._lastRenderedContent = '';
        this._renderData = null;
    }
    getDomNode() {
        return this._domNode;
    }
    getPosition() {
        return this._position;
    }
    setPlurality(plurality) {
        switch (plurality) {
            default:
            case CursorPlurality.Single:
                this._pluralityClass = '';
                break;
            case CursorPlurality.MultiPrimary:
                this._pluralityClass = 'cursor-primary';
                break;
            case CursorPlurality.MultiSecondary:
                this._pluralityClass = 'cursor-secondary';
                break;
        }
    }
    show() {
        if (!this._isVisible) {
            this._domNode.setVisibility('inherit');
            this._isVisible = true;
        }
    }
    hide() {
        if (this._isVisible) {
            this._domNode.setVisibility('hidden');
            this._isVisible = false;
        }
    }
    onConfigurationChanged(e) {
        const options = this._context.configuration.options;
        const fontInfo = options.get(55 /* EditorOption.fontInfo */);
        this._cursorStyle = options.get(150 /* EditorOption.effectiveCursorStyle */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._lineCursorWidth = Math.min(options.get(34 /* EditorOption.cursorWidth */), this._typicalHalfwidthCharacterWidth);
        applyFontInfo(this._domNode, fontInfo);
        return true;
    }
    onCursorPositionChanged(position, pauseAnimation) {
        if (pauseAnimation) {
            this._domNode.domNode.style.transitionProperty = 'none';
        }
        else {
            this._domNode.domNode.style.transitionProperty = '';
        }
        this._position = position;
        return true;
    }
    /**
     * If `this._position` is inside a grapheme, returns the position where the grapheme starts.
     * Also returns the next grapheme.
     */
    _getGraphemeAwarePosition() {
        const { lineNumber, column } = this._position;
        const lineContent = this._context.viewModel.getLineContent(lineNumber);
        const [startOffset, endOffset] = strings.getCharContainingOffset(lineContent, column - 1);
        return [new Position(lineNumber, startOffset + 1), lineContent.substring(startOffset, endOffset)];
    }
    _prepareRender(ctx) {
        let textContent = '';
        let textContentClassName = '';
        const [position, nextGrapheme] = this._getGraphemeAwarePosition();
        if (this._cursorStyle === TextEditorCursorStyle.Line || this._cursorStyle === TextEditorCursorStyle.LineThin) {
            const visibleRange = ctx.visibleRangeForPosition(position);
            if (!visibleRange || visibleRange.outsideRenderedLine) {
                // Outside viewport
                return null;
            }
            const window = dom.getWindow(this._domNode.domNode);
            let width;
            if (this._cursorStyle === TextEditorCursorStyle.Line) {
                width = dom.computeScreenAwareSize(window, this._lineCursorWidth > 0 ? this._lineCursorWidth : 2);
                if (width > 2) {
                    textContent = nextGrapheme;
                    textContentClassName = this._getTokenClassName(position);
                }
            }
            else {
                width = dom.computeScreenAwareSize(window, 1);
            }
            let left = visibleRange.left;
            let paddingLeft = 0;
            if (width >= 2 && left >= 1) {
                // shift the cursor a bit between the characters
                paddingLeft = 1;
                left -= paddingLeft;
            }
            const top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.bigNumbersDelta;
            const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(position.lineNumber);
            return new ViewCursorRenderData(top, left, paddingLeft, width, lineHeight, textContent, textContentClassName);
        }
        const visibleRangeForCharacter = ctx.linesVisibleRangesForRange(new Range(position.lineNumber, position.column, position.lineNumber, position.column + nextGrapheme.length), false);
        if (!visibleRangeForCharacter || visibleRangeForCharacter.length === 0) {
            // Outside viewport
            return null;
        }
        const firstVisibleRangeForCharacter = visibleRangeForCharacter[0];
        if (firstVisibleRangeForCharacter.outsideRenderedLine || firstVisibleRangeForCharacter.ranges.length === 0) {
            // Outside viewport
            return null;
        }
        const range = firstVisibleRangeForCharacter.ranges[0];
        const width = (nextGrapheme === '\t'
            ? this._typicalHalfwidthCharacterWidth
            : (range.width < 1
                ? this._typicalHalfwidthCharacterWidth
                : range.width));
        if (this._cursorStyle === TextEditorCursorStyle.Block) {
            textContent = nextGrapheme;
            textContentClassName = this._getTokenClassName(position);
        }
        let top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.bigNumbersDelta;
        const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(position.lineNumber);
        let height = lineHeight;
        // Underline might interfere with clicking
        if (this._cursorStyle === TextEditorCursorStyle.Underline || this._cursorStyle === TextEditorCursorStyle.UnderlineThin) {
            top += lineHeight - 2;
            height = 2;
        }
        return new ViewCursorRenderData(top, range.left, 0, width, height, textContent, textContentClassName);
    }
    _getTokenClassName(position) {
        const lineData = this._context.viewModel.getViewLineData(position.lineNumber);
        const tokenIndex = lineData.tokens.findTokenIndexAtOffset(position.column - 1);
        return lineData.tokens.getClassName(tokenIndex);
    }
    prepareRender(ctx) {
        this._renderData = this._prepareRender(ctx);
    }
    render(ctx) {
        if (!this._renderData) {
            this._domNode.setDisplay('none');
            return null;
        }
        if (this._lastRenderedContent !== this._renderData.textContent) {
            this._lastRenderedContent = this._renderData.textContent;
            this._domNode.domNode.textContent = this._lastRenderedContent;
        }
        this._domNode.setClassName(`cursor ${this._pluralityClass} ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME} ${this._renderData.textContentClassName}`);
        this._domNode.setDisplay('block');
        this._domNode.setTop(this._renderData.top);
        this._domNode.setLeft(this._renderData.left);
        this._domNode.setPaddingLeft(this._renderData.paddingLeft);
        this._domNode.setWidth(this._renderData.width);
        this._domNode.setLineHeight(this._renderData.height);
        this._domNode.setHeight(this._renderData.height);
        return {
            domNode: this._domNode.domNode,
            position: this._position,
            contentLeft: this._renderData.left,
            height: this._renderData.height,
            width: 2
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0N1cnNvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvdmlld1BhcnRzL3ZpZXdDdXJzb3JzL3ZpZXdDdXJzb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RixPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUM1RCxPQUFPLEVBQUUscUJBQXFCLEVBQWdCLE1BQU0seUNBQXlDLENBQUM7QUFDOUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUl0RCxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQVUxRyxNQUFNLG9CQUFvQjtJQUN6QixZQUNpQixHQUFXLEVBQ1gsSUFBWSxFQUNaLFdBQW1CLEVBQ25CLEtBQWEsRUFDYixNQUFjLEVBQ2QsV0FBbUIsRUFDbkIsb0JBQTRCO1FBTjVCLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQ1osZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFDbkIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUNiLFdBQU0sR0FBTixNQUFNLENBQVE7UUFDZCxnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUNuQix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQVE7SUFDekMsQ0FBQztDQUNMO0FBRUQsTUFBTSxDQUFOLElBQVksZUFJWDtBQUpELFdBQVksZUFBZTtJQUMxQix5REFBTSxDQUFBO0lBQ04scUVBQVks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