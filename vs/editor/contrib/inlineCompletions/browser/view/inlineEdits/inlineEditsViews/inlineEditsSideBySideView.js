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
import { $, getWindow, n } from '../../../../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../../../../base/browser/mouseEvent.js';
import { Color } from '../../../../../../../base/common/color.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived, derivedObservableWithCache, observableFromEvent } from '../../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { editorBackground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable, asCssVariableWithDefault } from '../../../../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { EmbeddedCodeEditorWidget } from '../../../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { Position } from '../../../../../../common/core/position.js';
import { Range } from '../../../../../../common/core/range.js';
import { StickyScrollController } from '../../../../../stickyScroll/browser/stickyScrollController.js';
import { InlineCompletionContextKeys } from '../../../controller/inlineCompletionContextKeys.js';
import { getEditorBlendedColor, getModifiedBorderColor, getOriginalBorderColor, modifiedBackgroundColor, originalBackgroundColor } from '../theme.js';
import { PathBuilder, getContentRenderWidth, getOffsetForPos, mapOutFalsy, maxContentWidthInRange } from '../utils/utils.js';
const HORIZONTAL_PADDING = 0;
const VERTICAL_PADDING = 0;
const ENABLE_OVERFLOW = false;
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const BORDER_RADIUS = 4;
const ORIGINAL_END_PADDING = 20;
const MODIFIED_END_PADDING = 12;
let InlineEditsSideBySideView = class InlineEditsSideBySideView extends Disposable {
    // This is an approximation and should be improved by using the real parameters used bellow
    static fitsInsideViewport(editor, textModel, edit, reader) {
        const editorObs = observableCodeEditor(editor);
        const editorWidth = editorObs.layoutInfoWidth.read(reader);
        const editorContentLeft = editorObs.layoutInfoContentLeft.read(reader);
        const editorVerticalScrollbar = editor.getLayoutInfo().verticalScrollbarWidth;
        const minimapWidth = editorObs.layoutInfoMinimap.read(reader).minimapLeft !== 0 ? editorObs.layoutInfoMinimap.read(reader).minimapWidth : 0;
        const maxOriginalContent = maxContentWidthInRange(editorObs, edit.displayRange, undefined /* do not reconsider on each layout info change */);
        const maxModifiedContent = edit.lineEdit.newLines.reduce((max, line) => Math.max(max, getContentRenderWidth(line, editor, textModel)), 0);
        const originalPadding = ORIGINAL_END_PADDING; // padding after last line of original editor
        const modifiedPadding = MODIFIED_END_PADDING + 2 * BORDER_WIDTH; // padding after last line of modified editor
        return maxOriginalContent + maxModifiedContent + originalPadding + modifiedPadding < editorWidth - editorContentLeft - editorVerticalScrollbar - minimapWidth;
    }
    constructor(_editor, _edit, _previewTextModel, _uiState, _tabAction, _instantiationService, _themeService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._previewTextModel = _previewTextModel;
        this._uiState = _uiState;
        this._tabAction = _tabAction;
        this._instantiationService = _instantiationService;
        this._themeService = _themeService;
        this._editorObs = observableCodeEditor(this._editor);
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._display = derived(this, reader => !!this._uiState.read(reader) ? 'block' : 'none');
        this.previewRef = n.ref();
        this._editorContainer = n.div({
            class: ['editorContainer'],
            style: { position: 'absolute', overflow: 'hidden', cursor: 'pointer' },
            onmousedown: e => {
                e.preventDefault(); // This prevents that the editor loses focus
            },
            onclick: (e) => {
                this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e));
            }
        }, [
            n.div({ class: 'preview', style: { pointerEvents: 'none' }, ref: this.previewRef }),
        ]).keepUpdated(this._store);
        this.isHovered = this._editorContainer.didMouseMoveDuringHover;
        this.previewEditor = this._register(this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this.previewRef.element, {
            glyphMargin: false,
            lineNumbers: 'off',
            minimap: { enabled: false },
            guides: {
                indentation: false,
                bracketPairs: false,
                bracketPairsHorizontal: false,
                highlightActiveIndentation: false,
            },
            rulers: [],
            padding: { top: 0, bottom: 0 },
            folding: false,
            selectOnLineNumbers: false,
            selectionHighlight: false,
            columnSelection: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            revealHorizontalRightPadding: 0,
            bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
                handleMouseWheel: false,
            },
            readOnly: true,
            wordWrap: 'off',
            wordWrapOverride1: 'off',
            wordWrapOverride2: 'off',
        }, {
            contextKeyValues: {
                [InlineCompletionContextKeys.inInlineEditsPreviewEditor.key]: true,
            },
            contributions: [],
        }, this._editor));
        this._previewEditorObs = observableCodeEditor(this.previewEditor);
        this._activeViewZones = [];
        this._updatePreviewEditor = derived(reader => {
            this._editorContainer.readEffect(reader);
            this._previewEditorObs.model.read(reader); // update when the model is set
            // Setting this here explicitly to make sure that the preview editor is
            // visible when needed, we're also checking that these fields are defined
            // because of the auto run initial
            // Before removing these, verify with a non-monospace font family
            this._display.read(reader);
            if (this._nonOverflowView) {
                this._nonOverflowView.element.style.display = this._display.read(reader);
            }
            const uiState = this._uiState.read(reader);
            const edit = this._edit.read(reader);
            if (!uiState || !edit) {
                return;
            }
            const range = edit.originalLineRange;
            const hiddenAreas = [];
            if (range.startLineNumber > 1) {
                hiddenAreas.push(new Range(1, 1, range.startLineNumber - 1, 1));
            }
            if (range.startLineNumber + uiState.newTextLineCount < this._previewTextModel.getLineCount() + 1) {
                hiddenAreas.push(new Range(range.startLineNumber + uiState.newTextLineCount, 1, this._previewTextModel.getLineCount() + 1, 1));
            }
            this.previewEditor.setHiddenAreas(hiddenAreas, undefined, true);
            // TODO: is this the proper way to handle viewzones?
            const previousViewZones = [...this._activeViewZones];
            this._activeViewZones = [];
            const reducedLinesCount = (range.endLineNumberExclusive - range.startLineNumber) - uiState.newTextLineCount;
            this.previewEditor.changeViewZones((changeAccessor) => {
                previousViewZones.forEach(id => changeAccessor.removeZone(id));
                if (reducedLinesCount > 0) {
                    this._activeViewZones.push(changeAccessor.addZone({
                        afterLineNumber: range.startLineNumber + uiState.newTextLineCount - 1,
                        heightInLines: reducedLinesCount,
                        showInHiddenAreas: true,
                        domNode: $('div.diagonal-fill.inline-edits-view-zone'),
                    }));
                }
            });
        });
        this._previewEditorWidth = derived(this, reader => {
            const edit = this._edit.read(reader);
            if (!edit) {
                return 0;
            }
            this._updatePreviewEditor.read(reader);
            return maxContentWidthInRange(this._previewEditorObs, edit.modifiedLineRange, reader);
        });
        this._cursorPosIfTouchesEdit = derived(this, reader => {
            const cursorPos = this._editorObs.cursorPosition.read(reader);
            const edit = this._edit.read(reader);
            if (!edit || !cursorPos) {
                return undefined;
            }
            return edit.modifiedLineRange.contains(cursorPos.lineNumber) ? cursorPos : undefined;
        });
        this._originalStartPosition = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            return inlineEdit ? new Position(inlineEdit.originalLineRange.startLineNumber, 1) : null;
        });
        this._originalEndPosition = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            return inlineEdit ? new Position(inlineEdit.originalLineRange.endLineNumberExclusive, 1) : null;
        });
        this._originalVerticalStartPosition = this._editorObs.observePosition(this._originalStartPosition, this._store).map(p => p?.y);
        this._originalVerticalEndPosition = this._editorObs.observePosition(this._originalEndPosition, this._store).map(p => p?.y);
        this._originalDisplayRange = this._edit.map(e => e?.displayRange);
        this._editorMaxContentWidthInRange = derived(this, reader => {
            const originalDisplayRange = this._originalDisplayRange.read(reader);
            if (!originalDisplayRange) {
                return constObservable(0);
            }
            this._editorObs.versionId.read(reader);
            // Take the max value that we observed.
            // Reset when either the edit changes or the editor text version.
            return derivedObservableWithCache(this, (reader, lastValue) => {
                const maxWidth = maxContentWidthInRange(this._editorObs, originalDisplayRange, reader);
                return Math.max(maxWidth, lastValue ?? 0);
            });
        }).map((v, r) => v.read(r));
        this._previewEditorLayoutInfo = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            if (!inlineEdit) {
                return null;
            }
            const state = this._uiState.read(reader);
            if (!state) {
                return null;
            }
            const range = inlineEdit.originalLineRange;
            const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
            const editorContentMaxWidthInRange = this._editorMaxContentWidthInRange.read(reader);
            const editorLayout = this._editorObs.layoutInfo.read(reader);
            const previewContentWidth = this._previewEditorWidth.read(reader);
            const editorContentAreaWidth = editorLayout.contentWidth - editorLayout.verticalScrollbarWidth;
            const editorBoundingClientRect = this._editor.getContainerDomNode().getBoundingClientRect();
            const clientContentAreaRight = editorLayout.contentLeft + editorLayout.contentWidth + editorBoundingClientRect.left;
            const remainingWidthRightOfContent = getWindow(this._editor.getContainerDomNode()).innerWidth - clientContentAreaRight;
            const remainingWidthRightOfEditor = getWindow(this._editor.getContainerDomNode()).innerWidth - editorBoundingClientRect.right;
            const desiredMinimumWidth = Math.min(editorLayout.contentWidth * 0.3, previewContentWidth, 100);
            const IN_EDITOR_DISPLACEMENT = 0;
            const maximumAvailableWidth = IN_EDITOR_DISPLACEMENT + remainingWidthRightOfContent;
            const cursorPos = this._cursorPosIfTouchesEdit.read(reader);
            const maxPreviewEditorLeft = Math.max(
            // We're starting from the content area right and moving it left by IN_EDITOR_DISPLACEMENT and also by an amount to ensure some minimum desired width
            editorContentAreaWidth + horizontalScrollOffset - IN_EDITOR_DISPLACEMENT - Math.max(0, desiredMinimumWidth - maximumAvailableWidth), 
            // But we don't want that the moving left ends up covering the cursor, so this will push it to the right again
            Math.min(cursorPos ? getOffsetForPos(this._editorObs, cursorPos, reader) + 50 : 0, editorContentAreaWidth + horizontalScrollOffset));
            const previewEditorLeftInTextArea = Math.min(editorContentMaxWidthInRange + ORIGINAL_END_PADDING, maxPreviewEditorLeft);
            const maxContentWidth = editorContentMaxWidthInRange + ORIGINAL_END_PADDING + previewContentWidth + 70;
            const dist = maxPreviewEditorLeft - previewEditorLeftInTextArea;
            let desiredPreviewEditorScrollLeft;
            let codeRight;
            if (previewEditorLeftInTextArea > horizontalScrollOffset) {
                desiredPreviewEditorScrollLeft = 0;
                codeRight = editorLayout.contentLeft + previewEditorLeftInTextArea - horizontalScrollOffset;
            }
            else {
                desiredPreviewEditorScrollLeft = horizontalScrollOffset - previewEditorLeftInTextArea;
                codeRight = editorLayout.contentLeft;
            }
            const selectionTop = this._originalVerticalStartPosition.read(reader) ?? this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
            const selectionBottom = this._originalVerticalEndPosition.read(reader) ?? this._editor.getBottomForLineNumber(range.endLineNumberExclusive - 1) - this._editorObs.scrollTop.read(reader);
            // TODO: const { prefixLeftOffset } = getPrefixTrim(inlineEdit.edit.edits.map(e => e.range), inlineEdit.originalLineRange, [], this._editor);
            const codeLeft = editorLayout.contentLeft - horizontalScrollOffset;
            let codeRect = Rect.fromLeftTopRightBottom(codeLeft, selectionTop, codeRight, selectionBottom);
            const isInsertion = codeRect.height === 0;
            if (!isInsertion) {
                codeRect = codeRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING);
            }
            const editHeight = this._editor.getOption(71 /* EditorOption.lineHeight */) * inlineEdit.modifiedLineRange.length;
            const codeHeight = selectionBottom - selectionTop;
            const previewEditorHeight = Math.max(codeHeight, editHeight);
            const clipped = dist === 0;
            const codeEditDist = 0;
            const previewEditorWidth = Math.min(previewContentWidth + MODIFIED_END_PADDING, remainingWidthRightOfEditor + editorLayout.width - editorLayout.contentLeft - codeEditDist);
            let editRect = Rect.fromLeftTopWidthHeight(codeRect.right + codeEditDist, selectionTop, previewEditorWidth, previewEditorHeight);
            if (!isInsertion) {
                editRect = editRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING).translateX(HORIZONTAL_PADDING + BORDER_WIDTH);
            }
            else {
                // Align top of edit with insertion line
                editRect = editRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING).translateY(VERTICAL_PADDING);
            }
            // debugView(debugLogRects({ codeRect, editRect }, this._editor.getDomNode()!), reader);
            return {
                codeRect,
                editRect,
                codeScrollLeft: horizontalScrollOffset,
                contentLeft: editorLayout.contentLeft,
                isInsertion,
                maxContentWidth,
                shouldShowShadow: clipped,
                desiredPreviewEditorScrollLeft,
                previewEditorWidth,
            };
        });
        this._stickyScrollController = StickyScrollController.get(this._editorObs.editor);
        this._stickyScrollHeight = this._stickyScrollController ? observableFromEvent(this._stickyScrollController.onDidChangeStickyScrollHeight, () => this._stickyScrollController.stickyScrollWidgetHeight) : constObservable(0);
        this._shouldOverflow = derived(reader => {
            if (!ENABLE_OVERFLOW) {
                return false;
            }
            const range = this._edit.read(reader)?.originalLineRange;
            if (!range) {
                return false;
            }
            const stickyScrollHeight = this._stickyScrollHeight.read(reader);
            const top = this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
            if (top <= stickyScrollHeight) {
                return false;
            }
            const bottom = this._editor.getTopForLineNumber(range.endLineNumberExclusive) - this._editorObs.scrollTop.read(reader);
            if (bottom >= this._editorObs.layoutInfo.read(reader).height) {
                return false;
            }
            return true;
        });
        this._originalBackgroundColor = observableFromEvent(this, this._themeService.onDidColorThemeChange, () => {
            return this._themeService.getColorTheme().getColor(originalBackgroundColor) ?? Color.transparent;
        });
        this._backgroundSvg = n.svg({
            transform: 'translate(-0.5 -0.5)',
            style: { overflow: 'visible', pointerEvents: 'none', position: 'absolute' },
        }, [
            n.svgElem('path', {
                class: 'rightOfModifiedBackgroundCoverUp',
                d: derived(reader => {
                    const layoutInfo = this._previewEditorLayoutInfo.read(reader);
                    if (!layoutInfo) {
                        return undefined;
                    }
                    const originalBackgroundColor = this._originalBackgroundColor.read(reader);
                    if (originalBackgroundColor.isTransparent()) {
                        return undefined;
                    }
                    return new PathBuilder()
                        .moveTo(layoutInfo.codeRect.getRightTop())
                        .lineTo(layoutInfo.codeRect.getRightTop().deltaX(1000))
                        .lineTo(layoutInfo.codeRect.getRightBottom().deltaX(1000))
                        .lineTo(layoutInfo.codeRect.getRightBottom())
                        .build();
                }),
                style: {
                    fill: asCssVariableWithDefault(editorBackground, 'transparent'),
                }
            }),
        ]).keepUpdated(this._store);
        this._originalOverlay = n.div({
            style: { pointerEvents: 'none', display: this._previewEditorLayoutInfo.map(layoutInfo => layoutInfo?.isInsertion ? 'none' : 'block') },
        }, derived(reader => {
            const layoutInfoObs = mapOutFalsy(this._previewEditorLayoutInfo).read(reader);
            if (!layoutInfoObs) {
                return undefined;
            }
            const borderStyling = getOriginalBorderColor(this._tabAction).map(bc => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`);
            const borderStylingSeparator = `${BORDER_WIDTH + WIDGET_SEPARATOR_WIDTH}px solid ${asCssVariable(editorBackground)}`;
            const hasBorderLeft = layoutInfoObs.read(reader).codeScrollLeft !== 0;
            const isModifiedLower = layoutInfoObs.map(layoutInfo => layoutInfo.codeRect.bottom < layoutInfo.editRect.bottom);
            const transitionRectSize = BORDER_RADIUS * 2 + BORDER_WIDTH * 2;
            // Create an overlay which hides the left hand side of the original overlay when it overflows to the left
            // such that there is a smooth transition at the edge of content left
            const overlayHider = layoutInfoObs.map(layoutInfo => Rect.fromLeftTopRightBottom(layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH, layoutInfo.codeRect.top, layoutInfo.contentLeft, layoutInfo.codeRect.bottom + transitionRectSize)).read(reader);
            const intersectionLine = new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER);
            const overlayRect = layoutInfoObs.map(layoutInfo => layoutInfo.codeRect.intersectHorizontal(intersectionLine));
            const separatorRect = overlayRect.map(overlayRect => overlayRect.withMargin(WIDGET_SEPARATOR_WIDTH, 0, WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH).intersectHorizontal(intersectionLine));
            const transitionRect = overlayRect.map(overlayRect => Rect.fromLeftTopWidthHeight(overlayRect.right - transitionRectSize + BORDER_WIDTH, overlayRect.bottom - BORDER_WIDTH, transitionRectSize, transitionRectSize).intersectHorizontal(intersectionLine));
            return [
                n.div({
                    class: 'originalSeparatorSideBySide',
                    style: {
                        ...separatorRect.read(reader).toStyles(),
                        boxSizing: 'border-box',
                        borderRadius: `${BORDER_RADIUS}px 0 0 ${BORDER_RADIUS}px`,
                        borderTop: borderStylingSeparator,
                        borderBottom: borderStylingSeparator,
                        borderLeft: hasBorderLeft ? 'none' : borderStylingSeparator,
                    }
                }),
                n.div({
                    class: 'originalOverlaySideBySide',
                    style: {
                        ...overlayRect.read(reader).toStyles(),
                        boxSizing: 'border-box',
                        borderRadius: `${BORDER_RADIUS}px 0 0 ${BORDER_RADIUS}px`,
                        borderTop: borderStyling,
                        borderBottom: borderStyling,
                        borderLeft: hasBorderLeft ? 'none' : borderStyling,
                        backgroundColor: asCssVariable(originalBackgroundColor),
                    }
                }),
                n.div({
                    class: 'originalCornerCutoutSideBySide',
                    style: {
                        pointerEvents: 'none',
                        display: isModifiedLower.map(isLower => isLower ? 'block' : 'none'),
                        ...transitionRect.read(reader).toStyles(),
                    }
                }, [
                    n.div({
                        class: 'originalCornerCutoutBackground',
                        style: {
                            position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%',
                            backgroundColor: getEditorBlendedColor(originalBackgroundColor, this._themeService).map(c => c.toString()),
                        }
                    }),
                    n.div({
                        class: 'originalCornerCutoutBorder',
                        style: {
                            position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%',
                            boxSizing: 'border-box',
                            borderTop: borderStyling,
                            borderRight: borderStyling,
                            borderRadius: `0 100% 0 0`,
                            backgroundColor: asCssVariable(editorBackground)
                        }
                    })
                ]),
                n.div({
                    class: 'originalOverlaySideBySideHider',
                    style: {
                        ...overlayHider.toStyles(),
                        backgroundColor: asCssVariable(editorBackground),
                    }
                }),
            ];
        })).keepUpdated(this._store);
        this._modifiedOverlay = n.div({
            style: { pointerEvents: 'none', }
        }, derived(reader => {
            const layoutInfoObs = mapOutFalsy(this._previewEditorLayoutInfo).read(reader);
            if (!layoutInfoObs) {
                return undefined;
            }
            const isModifiedLower = layoutInfoObs.map(layoutInfo => layoutInfo.codeRect.bottom < layoutInfo.editRect.bottom);
            const borderRadius = isModifiedLower.map(isLower => `0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px ${isLower ? BORDER_RADIUS : 0}px`);
            const borderStyling = getEditorBlendedColor(getModifiedBorderColor(this._tabAction), this._themeService).map(c => `1px solid ${c.toString()}`);
            const borderStylingSeparator = `${BORDER_WIDTH + WIDGET_SEPARATOR_WIDTH}px solid ${asCssVariable(editorBackground)}`;
            const overlayRect = layoutInfoObs.map(layoutInfo => layoutInfo.editRect.withMargin(0, BORDER_WIDTH));
            const separatorRect = overlayRect.map(overlayRect => overlayRect.withMargin(WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH, 0));
            const insertionRect = derived(reader => {
                const overlay = overlayRect.read(reader);
                const layoutinfo = layoutInfoObs.read(reader);
                if (!layoutinfo.isInsertion || layoutinfo.contentLeft >= overlay.left) {
                    return Rect.fromLeftTopWidthHeight(overlay.left, overlay.top, 0, 0);
                }
                return new Rect(layoutinfo.contentLeft, overlay.top, overlay.left, overlay.top + BORDER_WIDTH * 2);
            });
            return [
                n.div({
                    class: 'modifiedInsertionSideBySide',
                    style: {
                        ...insertionRect.read(reader).toStyles(),
                        backgroundColor: getModifiedBorderColor(this._tabAction).map(c => asCssVariable(c)),
                    }
                }),
                n.div({
                    class: 'modifiedSeparatorSideBySide',
                    style: {
                        ...separatorRect.read(reader).toStyles(),
                        borderRadius,
                        borderTop: borderStylingSeparator,
                        borderBottom: borderStylingSeparator,
                        borderRight: borderStylingSeparator,
                        boxSizing: 'border-box',
                    }
                }),
                n.div({
                    class: 'modifiedOverlaySideBySide',
                    style: {
                        ...overlayRect.read(reader).toStyles(),
                        borderRadius,
                        border: borderStyling,
                        boxSizing: 'border-box',
                        backgroundColor: asCssVariable(modifiedBackgroundColor),
                    }
                })
            ];
        })).keepUpdated(this._store);
        this._nonOverflowView = n.div({
            class: 'inline-edits-view',
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
                display: this._display,
            },
        }, [
            this._backgroundSvg,
            derived(this, reader => this._shouldOverflow.read(reader) ? [] : [this._editorContainer, this._originalOverlay, this._modifiedOverlay]),
        ]).keepUpdated(this._store);
        this._register(this._editorObs.createOverlayWidget({
            domNode: this._nonOverflowView.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: derived(reader => {
                const x = this._previewEditorLayoutInfo.read(reader)?.maxContentWidth;
                if (x === undefined) {
                    return 0;
                }
                return x;
            }),
        }));
        this.previewEditor.setModel(this._previewTextModel);
        this._register(autorun(reader => {
            const layoutInfo = this._previewEditorLayoutInfo.read(reader);
            if (!layoutInfo) {
                return;
            }
            const editorRect = layoutInfo.editRect.withMargin(-VERTICAL_PADDING, -HORIZONTAL_PADDING);
            this.previewEditor.layout({ height: editorRect.height, width: layoutInfo.previewEditorWidth + 15 /* Make sure editor does not scroll horizontally */ });
            this._editorContainer.element.style.top = `${editorRect.top}px`;
            this._editorContainer.element.style.left = `${editorRect.left}px`;
            this._editorContainer.element.style.width = `${layoutInfo.previewEditorWidth + HORIZONTAL_PADDING}px`; // Set width to clip view zone
            //this._editorContainer.element.style.borderRadius = `0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px 0`;
        }));
        this._register(autorun(reader => {
            const layoutInfo = this._previewEditorLayoutInfo.read(reader);
            if (!layoutInfo) {
                return;
            }
            this._previewEditorObs.editor.setScrollLeft(layoutInfo.desiredPreviewEditorScrollLeft);
        }));
        this._updatePreviewEditor.recomputeInitiallyAndOnChange(this._store);
    }
};
InlineEditsSideBySideView = __decorate([
    __param(5, IInstantiationService),
    __param(6, IThemeService)
], InlineEditsSideBySideView);
export { InlineEditsSideBySideView };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNTaWRlQnlTaWRlVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci92aWV3L2lubGluZUVkaXRzL2lubGluZUVkaXRzVmlld3MvaW5saW5lRWRpdHNTaWRlQnlTaWRlVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUMzRSxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNsRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMzRSxPQUFPLEVBQXdCLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDMUssT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDL0YsT0FBTyxFQUFFLGFBQWEsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUUzRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0s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