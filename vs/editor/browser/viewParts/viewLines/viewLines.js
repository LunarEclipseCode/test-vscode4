/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../base/browser/ui/mouseCursor/mouseCursor.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import * as platform from '../../../../base/common/platform.js';
import './viewLines.css';
import { applyFontInfo } from '../../config/domFontInfo.js';
import { HorizontalPosition, HorizontalRange, LineVisibleRanges } from '../../view/renderingContext.js';
import { VisibleLinesCollection } from '../../view/viewLayer.js';
import { PartFingerprints, ViewPart } from '../../view/viewPart.js';
import { DomReadingContext } from './domReadingContext.js';
import { ViewLine } from './viewLine.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { ViewLineOptions } from './viewLineOptions.js';
class LastRenderedData {
    constructor() {
        this._currentVisibleRange = new Range(1, 1, 1, 1);
    }
    getCurrentVisibleRange() {
        return this._currentVisibleRange;
    }
    setCurrentVisibleRange(currentVisibleRange) {
        this._currentVisibleRange = currentVisibleRange;
    }
}
class HorizontalRevealRangeRequest {
    constructor(minimalReveal, lineNumber, startColumn, endColumn, startScrollTop, stopScrollTop, scrollType) {
        this.minimalReveal = minimalReveal;
        this.lineNumber = lineNumber;
        this.startColumn = startColumn;
        this.endColumn = endColumn;
        this.startScrollTop = startScrollTop;
        this.stopScrollTop = stopScrollTop;
        this.scrollType = scrollType;
        this.type = 'range';
        this.minLineNumber = lineNumber;
        this.maxLineNumber = lineNumber;
    }
}
class HorizontalRevealSelectionsRequest {
    constructor(minimalReveal, selections, startScrollTop, stopScrollTop, scrollType) {
        this.minimalReveal = minimalReveal;
        this.selections = selections;
        this.startScrollTop = startScrollTop;
        this.stopScrollTop = stopScrollTop;
        this.scrollType = scrollType;
        this.type = 'selections';
        let minLineNumber = selections[0].startLineNumber;
        let maxLineNumber = selections[0].endLineNumber;
        for (let i = 1, len = selections.length; i < len; i++) {
            const selection = selections[i];
            minLineNumber = Math.min(minLineNumber, selection.startLineNumber);
            maxLineNumber = Math.max(maxLineNumber, selection.endLineNumber);
        }
        this.minLineNumber = minLineNumber;
        this.maxLineNumber = maxLineNumber;
    }
}
/**
 * The view lines part is responsible for rendering the actual content of a
 * file.
 */
export class ViewLines extends ViewPart {
    /**
     * Adds this amount of pixels to the right of lines (no-one wants to type near the edge of the viewport)
     */
    static { this.HORIZONTAL_EXTRA_PX = 30; }
    constructor(context, viewGpuContext, linesContent) {
        super(context);
        const conf = this._context.configuration;
        const options = this._context.configuration.options;
        const fontInfo = options.get(55 /* EditorOption.fontInfo */);
        const wrappingInfo = options.get(155 /* EditorOption.wrappingInfo */);
        this._lineHeight = options.get(71 /* EditorOption.lineHeight */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._isViewportWrapping = wrappingInfo.isViewportWrapping;
        this._revealHorizontalRightPadding = options.get(108 /* EditorOption.revealHorizontalRightPadding */);
        this._cursorSurroundingLines = options.get(32 /* EditorOption.cursorSurroundingLines */);
        this._cursorSurroundingLinesStyle = options.get(33 /* EditorOption.cursorSurroundingLinesStyle */);
        this._canUseLayerHinting = !options.get(35 /* EditorOption.disableLayerHinting */);
        this._viewLineOptions = new ViewLineOptions(conf, this._context.theme.type);
        this._linesContent = linesContent;
        this._textRangeRestingSpot = document.createElement('div');
        this._visibleLines = new VisibleLinesCollection(this._context, {
            createLine: () => new ViewLine(viewGpuContext, this._viewLineOptions),
        });
        this.domNode = this._visibleLines.domNode;
        PartFingerprints.write(this.domNode, 8 /* PartFingerprint.ViewLines */);
        this.domNode.setClassName(`view-lines ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
        applyFontInfo(this.domNode, fontInfo);
        // --- width & height
        this._maxLineWidth = 0;
        this._asyncUpdateLineWidths = new RunOnceScheduler(() => {
            this._updateLineWidthsSlow();
        }, 200);
        this._asyncCheckMonospaceFontAssumptions = new RunOnceScheduler(() => {
            this._checkMonospaceFontAssumptions();
        }, 2000);
        this._lastRenderedData = new LastRenderedData();
        this._horizontalRevealRequest = null;
        // sticky scroll widget
        this._stickyScrollEnabled = options.get(123 /* EditorOption.stickyScroll */).enabled;
        this._maxNumberStickyLines = options.get(123 /* EditorOption.stickyScroll */).maxLineCount;
    }
    dispose() {
        this._asyncUpdateLineWidths.dispose();
        this._asyncCheckMonospaceFontAssumptions.dispose();
        super.dispose();
    }
    getDomNode() {
        return this.domNode;
    }
    // ---- begin view event handlers
    onConfigurationChanged(e) {
        this._visibleLines.onConfigurationChanged(e);
        if (e.hasChanged(155 /* EditorOption.wrappingInfo */)) {
            this._maxLineWidth = 0;
        }
        const options = this._context.configuration.options;
        const fontInfo = options.get(55 /* EditorOption.fontInfo */);
        const wrappingInfo = options.get(155 /* EditorOption.wrappingInfo */);
        this._lineHeight = options.get(71 /* EditorOption.lineHeight */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._isViewportWrapping = wrappingInfo.isViewportWrapping;
        this._revealHorizontalRightPadding = options.get(108 /* EditorOption.revealHorizontalRightPadding */);
        this._cursorSurroundingLines = options.get(32 /* EditorOption.cursorSurroundingLines */);
        this._cursorSurroundingLinesStyle = options.get(33 /* EditorOption.cursorSurroundingLinesStyle */);
        this._canUseLayerHinting = !options.get(35 /* EditorOption.disableLayerHinting */);
        // sticky scroll
        this._stickyScrollEnabled = options.get(123 /* EditorOption.stickyScroll */).enabled;
        this._maxNumberStickyLines = options.get(123 /* EditorOption.stickyScroll */).maxLineCount;
        applyFontInfo(this.domNode, fontInfo);
        this._onOptionsMaybeChanged();
        if (e.hasChanged(154 /* EditorOption.layoutInfo */)) {
            this._maxLineWidth = 0;
        }
        return true;
    }
    _onOptionsMaybeChanged() {
        const conf = this._context.configuration;
        const newViewLineOptions = new ViewLineOptions(conf, this._context.theme.type);
        if (!this._viewLineOptions.equals(newViewLineOptions)) {
            this._viewLineOptions = newViewLineOptions;
            const startLineNumber = this._visibleLines.getStartLineNumber();
            const endLineNumber = this._visibleLines.getEndLineNumber();
            for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
                const line = this._visibleLines.getVisibleLine(lineNumber);
                line.onOptionsChanged(this._viewLineOptions);
            }
            return true;
        }
        return false;
    }
    onCursorStateChanged(e) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        let r = false;
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            r = this._visibleLines.getVisibleLine(lineNumber).onSelectionChanged() || r;
        }
        return r;
    }
    onDecorationsChanged(e) {
        if (true /*e.inlineDecorationsChanged*/) {
            const rendStartLineNumber = this._visibleLines.getStartLineNumber();
            const rendEndLineNumber = this._visibleLines.getEndLineNumber();
            for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
                this._visibleLines.getVisibleLine(lineNumber).onDecorationsChanged();
            }
        }
        return true;
    }
    onFlushed(e) {
        const shouldRender = this._visibleLines.onFlushed(e, this._viewLineOptions.useGpu);
        this._maxLineWidth = 0;
        return shouldRender;
    }
    onLinesChanged(e) {
        return this._visibleLines.onLinesChanged(e);
    }
    onLinesDeleted(e) {
        return this._visibleLines.onLinesDeleted(e);
    }
    onLinesInserted(e) {
        return this._visibleLines.onLinesInserted(e);
    }
    onRevealRangeRequest(e) {
        // Using the future viewport here in order to handle multiple
        // incoming reveal range requests that might all desire to be animated
        const desiredScrollTop = this._computeScrollTopToRevealRange(this._context.viewLayout.getFutureViewport(), e.source, e.minimalReveal, e.range, e.selections, e.verticalType);
        if (desiredScrollTop === -1) {
            // marker to abort the reveal range request
            return false;
        }
        // validate the new desired scroll top
        let newScrollPosition = this._context.viewLayout.validateScrollPosition({ scrollTop: desiredScrollTop });
        if (e.revealHorizontal) {
            if (e.range && e.range.startLineNumber !== e.range.endLineNumber) {
                // Two or more lines? => scroll to base (That's how you see most of the two lines)
                newScrollPosition = {
                    scrollTop: newScrollPosition.scrollTop,
                    scrollLeft: 0
                };
            }
            else if (e.range) {
                // We don't necessarily know the horizontal offset of this range since the line might not be in the view...
                this._horizontalRevealRequest = new HorizontalRevealRangeRequest(e.minimalReveal, e.range.startLineNumber, e.range.startColumn, e.range.endColumn, this._context.viewLayout.getCurrentScrollTop(), newScrollPosition.scrollTop, e.scrollType);
            }
            else if (e.selections && e.selections.length > 0) {
                this._horizontalRevealRequest = new HorizontalRevealSelectionsRequest(e.minimalReveal, e.selections, this._context.viewLayout.getCurrentScrollTop(), newScrollPosition.scrollTop, e.scrollType);
            }
        }
        else {
            this._horizontalRevealRequest = null;
        }
        const scrollTopDelta = Math.abs(this._context.viewLayout.getCurrentScrollTop() - newScrollPosition.scrollTop);
        const scrollType = (scrollTopDelta <= this._lineHeight ? 1 /* ScrollType.Immediate */ : e.scrollType);
        this._context.viewModel.viewLayout.setScrollPosition(newScrollPosition, scrollType);
        return true;
    }
    onScrollChanged(e) {
        if (this._horizontalRevealRequest && e.scrollLeftChanged) {
            // cancel any outstanding horizontal reveal request if someone else scrolls horizontally.
            this._horizontalRevealRequest = null;
        }
        if (this._horizontalRevealRequest && e.scrollTopChanged) {
            const min = Math.min(this._horizontalRevealRequest.startScrollTop, this._horizontalRevealRequest.stopScrollTop);
            const max = Math.max(this._horizontalRevealRequest.startScrollTop, this._horizontalRevealRequest.stopScrollTop);
            if (e.scrollTop < min || e.scrollTop > max) {
                // cancel any outstanding horizontal reveal request if someone else scrolls vertically.
                this._horizontalRevealRequest = null;
            }
        }
        this.domNode.setWidth(e.scrollWidth);
        return this._visibleLines.onScrollChanged(e) || true;
    }
    onTokensChanged(e) {
        return this._visibleLines.onTokensChanged(e);
    }
    onZonesChanged(e) {
        this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
        return this._visibleLines.onZonesChanged(e);
    }
    onThemeChanged(e) {
        return this._onOptionsMaybeChanged();
    }
    // ---- end view event handlers
    // ----------- HELPERS FOR OTHERS
    getPositionFromDOMInfo(spanNode, offset) {
        const viewLineDomNode = this._getViewLineDomNode(spanNode);
        if (viewLineDomNode === null) {
            // Couldn't find view line node
            return null;
        }
        const lineNumber = this._getLineNumberFor(viewLineDomNode);
        if (lineNumber === -1) {
            // Couldn't find view line node
            return null;
        }
        if (lineNumber < 1 || lineNumber > this._context.viewModel.getLineCount()) {
            // lineNumber is outside range
            return null;
        }
        if (this._context.viewModel.getLineMaxColumn(lineNumber) === 1) {
            // Line is empty
            return new Position(lineNumber, 1);
        }
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
            // Couldn't find line
            return null;
        }
        let column = this._visibleLines.getVisibleLine(lineNumber).getColumnOfNodeOffset(spanNode, offset);
        const minColumn = this._context.viewModel.getLineMinColumn(lineNumber);
        if (column < minColumn) {
            column = minColumn;
        }
        return new Position(lineNumber, column);
    }
    _getViewLineDomNode(node) {
        while (node && node.nodeType === 1) {
            if (node.className === ViewLine.CLASS_NAME) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }
    /**
     * @returns the line number of this view line dom node.
     */
    _getLineNumberFor(domNode) {
        const startLineNumber = this._visibleLines.getStartLineNumber();
        const endLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const line = this._visibleLines.getVisibleLine(lineNumber);
            if (domNode === line.getDomNode()) {
                return lineNumber;
            }
        }
        return -1;
    }
    getLineWidth(lineNumber) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
            // Couldn't find line
            return -1;
        }
        const context = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
        const result = this._visibleLines.getVisibleLine(lineNumber).getWidth(context);
        this._updateLineWidthsSlowIfDomDidLayout(context);
        return result;
    }
    linesVisibleRangesForRange(_range, includeNewLines) {
        if (this.shouldRender()) {
            // Cannot read from the DOM because it is dirty
            // i.e. the model & the dom are out of sync, so I'd be reading something stale
            return null;
        }
        const originalEndLineNumber = _range.endLineNumber;
        const range = Range.intersectRanges(_range, this._lastRenderedData.getCurrentVisibleRange());
        if (!range) {
            return null;
        }
        const visibleRanges = [];
        let visibleRangesLen = 0;
        const domReadingContext = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
        let nextLineModelLineNumber = 0;
        if (includeNewLines) {
            nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(range.startLineNumber, 1)).lineNumber;
        }
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
            if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
                continue;
            }
            const startColumn = lineNumber === range.startLineNumber ? range.startColumn : 1;
            const continuesInNextLine = lineNumber !== originalEndLineNumber;
            const endColumn = continuesInNextLine ? this._context.viewModel.getLineMaxColumn(lineNumber) : range.endColumn;
            const visibleRangesForLine = this._visibleLines.getVisibleLine(lineNumber).getVisibleRangesForRange(lineNumber, startColumn, endColumn, domReadingContext);
            if (!visibleRangesForLine) {
                continue;
            }
            if (includeNewLines && lineNumber < originalEndLineNumber) {
                const currentLineModelLineNumber = nextLineModelLineNumber;
                nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber + 1, 1)).lineNumber;
                if (currentLineModelLineNumber !== nextLineModelLineNumber) {
                    visibleRangesForLine.ranges[visibleRangesForLine.ranges.length - 1].width += this._typicalHalfwidthCharacterWidth;
                }
            }
            visibleRanges[visibleRangesLen++] = new LineVisibleRanges(visibleRangesForLine.outsideRenderedLine, lineNumber, HorizontalRange.from(visibleRangesForLine.ranges), continuesInNextLine);
        }
        this._updateLineWidthsSlowIfDomDidLayout(domReadingContext);
        if (visibleRangesLen === 0) {
            return null;
        }
        return visibleRanges;
    }
    _visibleRangesForLineRange(lineNumber, startColumn, endColumn) {
        if (this.shouldRender()) {
            // Cannot read from the DOM because it is dirty
            // i.e. the model & the dom are out of sync, so I'd be reading something stale
            return null;
        }
        if (lineNumber < this._visibleLines.getStartLineNumber() || lineNumber > this._visibleLines.getEndLineNumber()) {
            return null;
        }
        const domReadingContext = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
        const result = this._visibleLines.getVisibleLine(lineNumber).getVisibleRangesForRange(lineNumber, startColumn, endColumn, domReadingContext);
        this._updateLineWidthsSlowIfDomDidLayout(domReadingContext);
        return result;
    }
    visibleRangeForPosition(position) {
        const visibleRanges = this._visibleRangesForLineRange(position.lineNumber, position.column, position.column);
        if (!visibleRanges) {
            return null;
        }
        return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
    }
    // --- implementation
    updateLineWidths() {
        this._updateLineWidths(false);
    }
    /**
     * Updates the max line width if it is fast to compute.
     * Returns true if all lines were taken into account.
     * Returns false if some lines need to be reevaluated (in a slow fashion).
     */
    _updateLineWidthsFast() {
        return this._updateLineWidths(true);
    }
    _updateLineWidthsSlow() {
        this._updateLineWidths(false);
    }
    /**
     * Update the line widths using DOM layout information after someone else
     * has caused a synchronous layout.
     */
    _updateLineWidthsSlowIfDomDidLayout(domReadingContext) {
        if (!domReadingContext.didDomLayout) {
            // only proceed if we just did a layout
            return;
        }
        if (this._asyncUpdateLineWidths.isScheduled()) {
            // reading widths is not scheduled => widths are up-to-date
            return;
        }
        this._asyncUpdateLineWidths.cancel();
        this._updateLineWidthsSlow();
    }
    _updateLineWidths(fast) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        let localMaxLineWidth = 1;
        let allWidthsComputed = true;
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
            if (fast && !visibleLine.getWidthIsFast()) {
                // Cannot compute width in a fast way for this line
                allWidthsComputed = false;
                continue;
            }
            localMaxLineWidth = Math.max(localMaxLineWidth, visibleLine.getWidth(null));
        }
        if (allWidthsComputed && rendStartLineNumber === 1 && rendEndLineNumber === this._context.viewModel.getLineCount()) {
            // we know the max line width for all the lines
            this._maxLineWidth = 0;
        }
        this._ensureMaxLineWidth(localMaxLineWidth);
        return allWidthsComputed;
    }
    _checkMonospaceFontAssumptions() {
        // Problems with monospace assumptions are more apparent for longer lines,
        // as small rounding errors start to sum up, so we will select the longest
        // line for a closer inspection
        let longestLineNumber = -1;
        let longestWidth = -1;
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
            if (visibleLine.needsMonospaceFontCheck()) {
                const lineWidth = visibleLine.getWidth(null);
                if (lineWidth > longestWidth) {
                    longestWidth = lineWidth;
                    longestLineNumber = lineNumber;
                }
            }
        }
        if (longestLineNumber === -1) {
            return;
        }
        if (!this._visibleLines.getVisibleLine(longestLineNumber).monospaceAssumptionsAreValid()) {
            for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
                const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
                visibleLine.onMonospaceAssumptionsInvalidated();
            }
        }
    }
    prepareRender() {
        throw new Error('Not supported');
    }
    render() {
        throw new Error('Not supported');
    }
    renderText(viewportData) {
        // (1) render lines - ensures lines are in the DOM
        this._visibleLines.renderLines(viewportData);
        this._lastRenderedData.setCurrentVisibleRange(viewportData.visibleRange);
        this.domNode.setWidth(this._context.viewLayout.getScrollWidth());
        this.domNode.setHeight(Math.min(this._context.viewLayout.getScrollHeight(), 1000000));
        // (2) compute horizontal scroll position:
        //  - this must happen after the lines are in the DOM since it might need a line that rendered just now
        //  - it might change `scrollWidth` and `scrollLeft`
        if (this._horizontalRevealRequest) {
            const horizontalRevealRequest = this._horizontalRevealRequest;
            // Check that we have the line that contains the horizontal range in the viewport
            if (viewportData.startLineNumber <= horizontalRevealRequest.minLineNumber && horizontalRevealRequest.maxLineNumber <= viewportData.endLineNumber) {
                this._horizontalRevealRequest = null;
                // allow `visibleRangesForRange2` to work
                this.onDidRender();
                // compute new scroll position
                const newScrollLeft = this._computeScrollLeftToReveal(horizontalRevealRequest);
                if (newScrollLeft) {
                    if (!this._isViewportWrapping) {
                        // ensure `scrollWidth` is large enough
                        this._ensureMaxLineWidth(newScrollLeft.maxHorizontalOffset);
                    }
                    // set `scrollLeft`
                    this._context.viewModel.viewLayout.setScrollPosition({
                        scrollLeft: newScrollLeft.scrollLeft
                    }, horizontalRevealRequest.scrollType);
                }
            }
        }
        // Update max line width (not so important, it is just so the horizontal scrollbar doesn't get too small)
        if (!this._updateLineWidthsFast()) {
            // Computing the width of some lines would be slow => delay it
            this._asyncUpdateLineWidths.schedule();
        }
        else {
            this._asyncUpdateLineWidths.cancel();
        }
        if (platform.isLinux && !this._asyncCheckMonospaceFontAssumptions.isScheduled()) {
            const rendStartLineNumber = this._visibleLines.getStartLineNumber();
            const rendEndLineNumber = this._visibleLines.getEndLineNumber();
            for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
                const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
                if (visibleLine.needsMonospaceFontCheck()) {
                    this._asyncCheckMonospaceFontAssumptions.schedule();
                    break;
                }
            }
        }
        // (3) handle scrolling
        this._linesContent.setLayerHinting(this._canUseLayerHinting);
        this._linesContent.setContain('strict');
        const adjustedScrollTop = this._context.viewLayout.getCurrentScrollTop() - viewportData.bigNumbersDelta;
        this._linesContent.setTop(-adjustedScrollTop);
        this._linesContent.setLeft(-this._context.viewLayout.getCurrentScrollLeft());
    }
    // --- width
    _ensureMaxLineWidth(lineWidth) {
        const iLineWidth = Math.ceil(lineWidth);
        if (this._maxLineWidth < iLineWidth) {
            this._maxLineWidth = iLineWidth;
            this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
        }
    }
    _computeScrollTopToRevealRange(viewport, source, minimalReveal, range, selections, verticalType) {
        const viewportStartY = viewport.top;
        const viewportHeight = viewport.height;
        const viewportEndY = viewportStartY + viewportHeight;
        let boxIsSingleRange;
        let boxStartY;
        let boxEndY;
        if (selections && selections.length > 0) {
            let minLineNumber = selections[0].startLineNumber;
            let maxLineNumber = selections[0].endLineNumber;
            for (let i = 1, len = selections.length; i < len; i++) {
                const selection = selections[i];
                minLineNumber = Math.min(minLineNumber, selection.startLineNumber);
                maxLineNumber = Math.max(maxLineNumber, selection.endLineNumber);
            }
            boxIsSingleRange = false;
            boxStartY = this._context.viewLayout.getVerticalOffsetForLineNumber(minLineNumber);
            boxEndY = this._context.viewLayout.getVerticalOffsetForLineNumber(maxLineNumber) + this._lineHeight;
        }
        else if (range) {
            boxIsSingleRange = true;
            boxStartY = this._context.viewLayout.getVerticalOffsetForLineNumber(range.startLineNumber);
            boxEndY = this._context.viewLayout.getVerticalOffsetForLineNumber(range.endLineNumber) + this._lineHeight;
        }
        else {
            return -1;
        }
        const shouldIgnoreScrollOff = (source === 'mouse' || minimalReveal) && this._cursorSurroundingLinesStyle === 'default';
        let paddingTop = 0;
        let paddingBottom = 0;
        if (!shouldIgnoreScrollOff) {
            const maxLinesInViewport = (viewportHeight / this._lineHeight);
            const surroundingLines = Math.max(this._cursorSurroundingLines, this._stickyScrollEnabled ? this._maxNumberStickyLines : 0);
            const context = Math.min(maxLinesInViewport / 2, surroundingLines);
            paddingTop = context * this._lineHeight;
            paddingBottom = Math.max(0, (context - 1)) * this._lineHeight;
        }
        else {
            if (!minimalReveal) {
                // Reveal one more line above (this case is hit when dragging)
                paddingTop = this._lineHeight;
            }
        }
        if (!minimalReveal) {
            if (verticalType === 0 /* viewEvents.VerticalRevealType.Simple */ || verticalType === 4 /* viewEvents.VerticalRevealType.Bottom */) {
                // Reveal one line more when the last line would be covered by the scrollbar - arrow down case or revealing a line explicitly at bottom
                paddingBottom += this._lineHeight;
            }
        }
        boxStartY -= paddingTop;
        boxEndY += paddingBottom;
        let newScrollTop;
        if (boxEndY - boxStartY > viewportHeight) {
            // the box is larger than the viewport ... scroll to its top
            if (!boxIsSingleRange) {
                // do not reveal multiple cursors if there are more than fit the viewport
                return -1;
            }
            newScrollTop = boxStartY;
        }
        else if (verticalType === 5 /* viewEvents.VerticalRevealType.NearTop */ || verticalType === 6 /* viewEvents.VerticalRevealType.NearTopIfOutsideViewport */) {
            if (verticalType === 6 /* viewEvents.VerticalRevealType.NearTopIfOutsideViewport */ && viewportStartY <= boxStartY && boxEndY <= viewportEndY) {
                // Box is already in the viewport... do nothing
                newScrollTop = viewportStartY;
            }
            else {
                // We want a gap that is 20% of the viewport, but with a minimum of 5 lines
                const desiredGapAbove = Math.max(5 * this._lineHeight, viewportHeight * 0.2);
                // Try to scroll just above the box with the desired gap
                const desiredScrollTop = boxStartY - desiredGapAbove;
                // But ensure that the box is not pushed out of viewport
                const minScrollTop = boxEndY - viewportHeight;
                newScrollTop = Math.max(minScrollTop, desiredScrollTop);
            }
        }
        else if (verticalType === 1 /* viewEvents.VerticalRevealType.Center */ || verticalType === 2 /* viewEvents.VerticalRevealType.CenterIfOutsideViewport */) {
            if (verticalType === 2 /* viewEvents.VerticalRevealType.CenterIfOutsideViewport */ && viewportStartY <= boxStartY && boxEndY <= viewportEndY) {
                // Box is already in the viewport... do nothing
                newScrollTop = viewportStartY;
            }
            else {
                // Box is outside the viewport... center it
                const boxMiddleY = (boxStartY + boxEndY) / 2;
                newScrollTop = Math.max(0, boxMiddleY - viewportHeight / 2);
            }
        }
        else {
            newScrollTop = this._computeMinimumScrolling(viewportStartY, viewportEndY, boxStartY, boxEndY, verticalType === 3 /* viewEvents.VerticalRevealType.Top */, verticalType === 4 /* viewEvents.VerticalRevealType.Bottom */);
        }
        return newScrollTop;
    }
    _computeScrollLeftToReveal(horizontalRevealRequest) {
        const viewport = this._context.viewLayout.getCurrentViewport();
        const layoutInfo = this._context.configuration.options.get(154 /* EditorOption.layoutInfo */);
        const viewportStartX = viewport.left;
        const viewportEndX = viewportStartX + viewport.width - layoutInfo.verticalScrollbarWidth;
        let boxStartX = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
        let boxEndX = 0;
        if (horizontalRevealRequest.type === 'range') {
            const visibleRanges = this._visibleRangesForLineRange(horizontalRevealRequest.lineNumber, horizontalRevealRequest.startColumn, horizontalRevealRequest.endColumn);
            if (!visibleRanges) {
                return null;
            }
            for (const visibleRange of visibleRanges.ranges) {
                boxStartX = Math.min(boxStartX, Math.round(visibleRange.left));
                boxEndX = Math.max(boxEndX, Math.round(visibleRange.left + visibleRange.width));
            }
        }
        else {
            for (const selection of horizontalRevealRequest.selections) {
                if (selection.startLineNumber !== selection.endLineNumber) {
                    return null;
                }
                const visibleRanges = this._visibleRangesForLineRange(selection.startLineNumber, selection.startColumn, selection.endColumn);
                if (!visibleRanges) {
                    return null;
                }
                for (const visibleRange of visibleRanges.ranges) {
                    boxStartX = Math.min(boxStartX, Math.round(visibleRange.left));
                    boxEndX = Math.max(boxEndX, Math.round(visibleRange.left + visibleRange.width));
                }
            }
        }
        if (!horizontalRevealRequest.minimalReveal) {
            boxStartX = Math.max(0, boxStartX - ViewLines.HORIZONTAL_EXTRA_PX);
            boxEndX += this._revealHorizontalRightPadding;
        }
        if (horizontalRevealRequest.type === 'selections' && boxEndX - boxStartX > viewport.width) {
            return null;
        }
        const newScrollLeft = this._computeMinimumScrolling(viewportStartX, viewportEndX, boxStartX, boxEndX);
        return {
            scrollLeft: newScrollLeft,
            maxHorizontalOffset: boxEndX
        };
    }
    _computeMinimumScrolling(viewportStart, viewportEnd, boxStart, boxEnd, revealAtStart, revealAtEnd) {
        viewportStart = viewportStart | 0;
        viewportEnd = viewportEnd | 0;
        boxStart = boxStart | 0;
        boxEnd = boxEnd | 0;
        revealAtStart = !!revealAtStart;
        revealAtEnd = !!revealAtEnd;
        const viewportLength = viewportEnd - viewportStart;
        const boxLength = boxEnd - boxStart;
        if (boxLength < viewportLength) {
            // The box would fit in the viewport
            if (revealAtStart) {
                return boxStart;
            }
            if (revealAtEnd) {
                return Math.max(0, boxEnd - viewportLength);
            }
            if (boxStart < viewportStart) {
                // The box is above the viewport
                return boxStart;
            }
            else if (boxEnd > viewportEnd) {
                // The box is below the viewport
                return Math.max(0, boxEnd - viewportLength);
            }
        }
        else {
            // The box would not fit in the viewport
            // Reveal the beginning of the box
            return boxStart;
        }
        return viewportStart;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xpbmVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvdmlld0xpbmVzL3ZpZXdMaW5lcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUMxRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEtBQUssUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBRWhFLE9BQU8saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzVELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQWMsaUJBQWlCLEVBQWlCLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkksT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDakUsT0FBTyxFQUFtQixnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNyRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRXpDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFPdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBR3ZELE1BQU0sZ0JBQWdCO0lBSXJCO1FBQ0MsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFTSxzQkFBc0I7UUFD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