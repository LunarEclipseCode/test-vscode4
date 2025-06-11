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
import './textAreaEditContext.css';
import * as nls from '../../../../../nls.js';
import * as browser from '../../../../../base/browser/browser.js';
import { createFastDomNode } from '../../../../../base/browser/fastDomNode.js';
import * as platform from '../../../../../base/common/platform.js';
import * as strings from '../../../../../base/common/strings.js';
import { applyFontInfo } from '../../../config/domFontInfo.js';
import { PartFingerprints } from '../../../view/viewPart.js';
import { LineNumbersOverlay } from '../../../viewParts/lineNumbers/lineNumbers.js';
import { Margin } from '../../../viewParts/margin/margin.js';
import { EditorOptions } from '../../../../common/config/editorOptions.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { Selection } from '../../../../common/core/selection.js';
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../../base/browser/ui/mouseCursor/mouseCursor.js';
import { TokenizationRegistry } from '../../../../common/languages.js';
import { Color } from '../../../../../base/common/color.js';
import { IME } from '../../../../../base/common/ime.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { AbstractEditContext } from '../editContext.js';
import { TextAreaInput, TextAreaWrapper } from './textAreaEditContextInput.js';
import { ariaLabelForScreenReaderContent, newlinecount, PagedScreenReaderStrategy } from '../screenReaderUtils.js';
import { getDataToCopy } from '../clipboardUtils.js';
import { _debugComposition, TextAreaState } from './textAreaEditContextState.js';
import { getMapForWordSeparators } from '../../../../common/core/wordCharacterClassifier.js';
class VisibleTextAreaData {
    constructor(_context, modelLineNumber, distanceToModelLineStart, widthOfHiddenLineTextBefore, distanceToModelLineEnd) {
        this._context = _context;
        this.modelLineNumber = modelLineNumber;
        this.distanceToModelLineStart = distanceToModelLineStart;
        this.widthOfHiddenLineTextBefore = widthOfHiddenLineTextBefore;
        this.distanceToModelLineEnd = distanceToModelLineEnd;
        this._visibleTextAreaBrand = undefined;
        this.startPosition = null;
        this.endPosition = null;
        this.visibleTextareaStart = null;
        this.visibleTextareaEnd = null;
        /**
         * When doing composition, the currently composed text might be split up into
         * multiple tokens, then merged again into a single token, etc. Here we attempt
         * to keep the presentation of the <textarea> stable by using the previous used
         * style if multiple tokens come into play. This avoids flickering.
         */
        this._previousPresentation = null;
    }
    prepareRender(visibleRangeProvider) {
        const startModelPosition = new Position(this.modelLineNumber, this.distanceToModelLineStart + 1);
        const endModelPosition = new Position(this.modelLineNumber, this._context.viewModel.model.getLineMaxColumn(this.modelLineNumber) - this.distanceToModelLineEnd);
        this.startPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(startModelPosition);
        this.endPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(endModelPosition);
        if (this.startPosition.lineNumber === this.endPosition.lineNumber) {
            this.visibleTextareaStart = visibleRangeProvider.visibleRangeForPosition(this.startPosition);
            this.visibleTextareaEnd = visibleRangeProvider.visibleRangeForPosition(this.endPosition);
        }
        else {
            // TODO: what if the view positions are not on the same line?
            this.visibleTextareaStart = null;
            this.visibleTextareaEnd = null;
        }
    }
    definePresentation(tokenPresentation) {
        if (!this._previousPresentation) {
            // To avoid flickering, once set, always reuse a presentation throughout the entire IME session
            if (tokenPresentation) {
                this._previousPresentation = tokenPresentation;
            }
            else {
                this._previousPresentation = {
                    foreground: 1 /* ColorId.DefaultForeground */,
                    italic: false,
                    bold: false,
                    underline: false,
                    strikethrough: false,
                };
            }
        }
        return this._previousPresentation;
    }
}
const canUseZeroSizeTextarea = (browser.isFirefox);
let TextAreaEditContext = class TextAreaEditContext extends AbstractEditContext {
    constructor(context, overflowGuardContainer, viewController, visibleRangeProvider, _keybindingService, _instantiationService) {
        super(context);
        this._keybindingService = _keybindingService;
        this._instantiationService = _instantiationService;
        this._primaryCursorPosition = new Position(1, 1);
        this._primaryCursorVisibleRange = null;
        this._viewController = viewController;
        this._visibleRangeProvider = visibleRangeProvider;
        this._scrollLeft = 0;
        this._scrollTop = 0;
        const options = this._context.configuration.options;
        const layoutInfo = options.get(154 /* EditorOption.layoutInfo */);
        this._setAccessibilityOptions(options);
        this._contentLeft = layoutInfo.contentLeft;
        this._contentWidth = layoutInfo.contentWidth;
        this._contentHeight = layoutInfo.height;
        this._fontInfo = options.get(55 /* EditorOption.fontInfo */);
        this._emptySelectionClipboard = options.get(41 /* EditorOption.emptySelectionClipboard */);
        this._copyWithSyntaxHighlighting = options.get(28 /* EditorOption.copyWithSyntaxHighlighting */);
        this._visibleTextArea = null;
        this._selections = [new Selection(1, 1, 1, 1)];
        this._modelSelections = [new Selection(1, 1, 1, 1)];
        this._lastRenderPosition = null;
        // Text Area (The focus will always be in the textarea when the cursor is blinking)
        this.textArea = createFastDomNode(document.createElement('textarea'));
        PartFingerprints.write(this.textArea, 7 /* PartFingerprint.TextArea */);
        this.textArea.setClassName(`inputarea ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
        this.textArea.setAttribute('wrap', this._textAreaWrapping && !this._visibleTextArea ? 'on' : 'off');
        const { tabSize } = this._context.viewModel.model.getOptions();
        this.textArea.domNode.style.tabSize = `${tabSize * this._fontInfo.spaceWidth}px`;
        this.textArea.setAttribute('autocorrect', 'off');
        this.textArea.setAttribute('autocapitalize', 'off');
        this.textArea.setAttribute('autocomplete', 'off');
        this.textArea.setAttribute('spellcheck', 'false');
        this.textArea.setAttribute('aria-label', ariaLabelForScreenReaderContent(options, this._keybindingService));
        this.textArea.setAttribute('aria-required', options.get(6 /* EditorOption.ariaRequired */) ? 'true' : 'false');
        this.textArea.setAttribute('tabindex', String(options.get(132 /* EditorOption.tabIndex */)));
        this.textArea.setAttribute('role', 'textbox');
        this.textArea.setAttribute('aria-roledescription', nls.localize('editor', "editor"));
        this.textArea.setAttribute('aria-multiline', 'true');
        this.textArea.setAttribute('aria-autocomplete', options.get(99 /* EditorOption.readOnly */) ? 'none' : 'both');
        this._ensureReadOnlyAttribute();
        this.textAreaCover = createFastDomNode(document.createElement('div'));
        this.textAreaCover.setPosition('absolute');
        overflowGuardContainer.appendChild(this.textArea);
        overflowGuardContainer.appendChild(this.textAreaCover);
        const simpleModel = {
            getLineCount: () => {
                return this._context.viewModel.getLineCount();
            },
            getLineMaxColumn: (lineNumber) => {
                return this._context.viewModel.getLineMaxColumn(lineNumber);
            },
            getValueInRange: (range, eol) => {
                return this._context.viewModel.getValueInRange(range, eol);
            },
            getValueLengthInRange: (range, eol) => {
                return this._context.viewModel.getValueLengthInRange(range, eol);
            },
            modifyPosition: (position, offset) => {
                return this._context.viewModel.modifyPosition(position, offset);
            }
        };
        const textAreaInputHost = {
            getDataToCopy: () => {
                return getDataToCopy(this._context.viewModel, this._modelSelections, this._emptySelectionClipboard, this._copyWithSyntaxHighlighting);
            },
            getScreenReaderContent: () => {
                if (this._accessibilitySupport === 1 /* AccessibilitySupport.Disabled */) {
                    // We know for a fact that a screen reader is not attached
                    // On OSX, we write the character before the cursor to allow for "long-press" composition
                    // Also on OSX, we write the word before the cursor to allow for the Accessibility Keyboard to give good hints
                    const selection = this._selections[0];
                    if (platform.isMacintosh && selection.isEmpty()) {
                        const position = selection.getStartPosition();
                        let textBefore = this._getWordBeforePosition(position);
                        if (textBefore.length === 0) {
                            textBefore = this._getCharacterBeforePosition(position);
                        }
                        if (textBefore.length > 0) {
                            return new TextAreaState(textBefore, textBefore.length, textBefore.length, Range.fromPositions(position), 0);
                        }
                    }
                    // on macOS, write current selection into textarea will allow system text services pick selected text,
                    // but we still want to limit the amount of text given Chromium handles very poorly text even of a few
                    // thousand chars
                    // (https://github.com/microsoft/vscode/issues/27799)
                    const LIMIT_CHARS = 500;
                    if (platform.isMacintosh && !selection.isEmpty() && simpleModel.getValueLengthInRange(selection, 0 /* EndOfLinePreference.TextDefined */) < LIMIT_CHARS) {
                        const text = simpleModel.getValueInRange(selection, 0 /* EndOfLinePreference.TextDefined */);
                        return new TextAreaState(text, 0, text.length, selection, 0);
                    }
                    // on Safari, document.execCommand('cut') and document.execCommand('copy') will just not work
                    // if the textarea has no content selected. So if there is an editor selection, ensure something
                    // is selected in the textarea.
                    if (browser.isSafari && !selection.isEmpty()) {
                        const placeholderText = 'vscode-placeholder';
                        return new TextAreaState(placeholderText, 0, placeholderText.length, null, undefined);
                    }
                    return TextAreaState.EMPTY;
                }
                if (browser.isAndroid) {
                    // when tapping in the editor on a word, Android enters composition mode.
                    // in the `compositionstart` event we cannot clear the textarea, because
                    // it then forgets to ever send a `compositionend`.
                    // we therefore only write the current word in the textarea
                    const selection = this._selections[0];
                    if (selection.isEmpty()) {
                        const position = selection.getStartPosition();
                        const [wordAtPosition, positionOffsetInWord] = this._getAndroidWordAtPosition(position);
                        if (wordAtPosition.length > 0) {
                            return new TextAreaState(wordAtPosition, positionOffsetInWord, positionOffsetInWord, Range.fromPositions(position), 0);
                        }
                    }
                    return TextAreaState.EMPTY;
                }
                const screenReaderContentState = PagedScreenReaderStrategy.fromEditorSelection(simpleModel, this._selections[0], this._accessibilityPageSize, this._accessibilitySupport === 0 /* AccessibilitySupport.Unknown */);
                return TextAreaState.fromScreenReaderContentState(screenReaderContentState);
            },
            deduceModelPosition: (viewAnchorPosition, deltaOffset, lineFeedCnt) => {
                return this._context.viewModel.deduceModelPositionRelativeToViewPosition(viewAnchorPosition, deltaOffset, lineFeedCnt);
            }
        };
        const textAreaWrapper = this._register(new TextAreaWrapper(this.textArea.domNode));
        this._textAreaInput = this._register(this._instantiationService.createInstance(TextAreaInput, textAreaInputHost, textAreaWrapper, platform.OS, {
            isAndroid: browser.isAndroid,
            isChrome: browser.isChrome,
            isFirefox: browser.isFirefox,
            isSafari: browser.isSafari,
        }));
        this._register(this._textAreaInput.onKeyDown((e) => {
            this._viewController.emitKeyDown(e);
        }));
        this._register(this._textAreaInput.onKeyUp((e) => {
            this._viewController.emitKeyUp(e);
        }));
        this._register(this._textAreaInput.onPaste((e) => {
            let pasteOnNewLine = false;
            let multicursorText = null;
            let mode = null;
            if (e.metadata) {
                pasteOnNewLine = (this._emptySelectionClipboard && !!e.metadata.isFromEmptySelection);
                multicursorText = (typeof e.metadata.multicursorText !== 'undefined' ? e.metadata.multicursorText : null);
                mode = e.metadata.mode;
            }
            this._viewController.paste(e.text, pasteOnNewLine, multicursorText, mode);
        }));
        this._register(this._textAreaInput.onCut(() => {
            this._viewController.cut();
        }));
        this._register(this._textAreaInput.onType((e) => {
            if (e.replacePrevCharCnt || e.replaceNextCharCnt || e.positionDelta) {
                // must be handled through the new command
                if (_debugComposition) {
                    console.log(` => compositionType: <<${e.text}>>, ${e.replacePrevCharCnt}, ${e.replaceNextCharCnt}, ${e.positionDelta}`);
                }
                this._viewController.compositionType(e.text, e.replacePrevCharCnt, e.replaceNextCharCnt, e.positionDelta);
            }
            else {
                if (_debugComposition) {
                    console.log(` => type: <<${e.text}>>`);
                }
                this._viewController.type(e.text);
            }
        }));
        this._register(this._textAreaInput.onSelectionChangeRequest((modelSelection) => {
            this._viewController.setSelection(modelSelection);
        }));
        this._register(this._textAreaInput.onCompositionStart((e) => {
            // The textarea might contain some content when composition starts.
            //
            // When we make the textarea visible, it always has a height of 1 line,
            // so we don't need to worry too much about content on lines above or below
            // the selection.
            //
            // However, the text on the current line needs to be made visible because
            // some IME methods allow to move to other glyphs on the current line
            // (by pressing arrow keys).
            //
            // (1) The textarea might contain only some parts of the current line,
            // like the word before the selection. Also, the content inside the textarea
            // can grow or shrink as composition occurs. We therefore anchor the textarea
            // in terms of distance to a certain line start and line end.
            //
            // (2) Also, we should not make \t characters visible, because their rendering
            // inside the <textarea> will not align nicely with our rendering. We therefore
            // will hide (if necessary) some of the leading text on the current line.
            const ta = this.textArea.domNode;
            const modelSelection = this._modelSelections[0];
            const { distanceToModelLineStart, widthOfHiddenTextBefore } = (() => {
                // Find the text that is on the current line before the selection
                const textBeforeSelection = ta.value.substring(0, Math.min(ta.selectionStart, ta.selectionEnd));
                const lineFeedOffset1 = textBeforeSelection.lastIndexOf('\n');
                const lineTextBeforeSelection = textBeforeSelection.substring(lineFeedOffset1 + 1);
                // We now search to see if we should hide some part of it (if it contains \t)
                const tabOffset1 = lineTextBeforeSelection.lastIndexOf('\t');
                const desiredVisibleBeforeCharCount = lineTextBeforeSelection.length - tabOffset1 - 1;
                const startModelPosition = modelSelection.getStartPosition();
                const visibleBeforeCharCount = Math.min(startModelPosition.column - 1, desiredVisibleBeforeCharCount);
                const distanceToModelLineStart = startModelPosition.column - 1 - visibleBeforeCharCount;
                const hiddenLineTextBefore = lineTextBeforeSelection.substring(0, lineTextBeforeSelection.length - visibleBeforeCharCount);
                const { tabSize } = this._context.viewModel.model.getOptions();
                const widthOfHiddenTextBefore = measureText(this.textArea.domNode.ownerDocument, hiddenLineTextBefore, this._fontInfo, tabSize);
                return { distanceToModelLineStart, widthOfHiddenTextBefore };
            })();
            const { distanceToModelLineEnd } = (() => {
                // Find the text that is on the current line after the selection
                const textAfterSelection = ta.value.substring(Math.max(ta.selectionStart, ta.selectionEnd));
                const lineFeedOffset2 = textAfterSelection.indexOf('\n');
                const lineTextAfterSelection = lineFeedOffset2 === -1 ? textAfterSelection : textAfterSelection.substring(0, lineFeedOffset2);
                const tabOffset2 = lineTextAfterSelection.indexOf('\t');
                const desiredVisibleAfterCharCount = (tabOffset2 === -1 ? lineTextAfterSelection.length : lineTextAfterSelection.length - tabOffset2 - 1);
                const endModelPosition = modelSelection.getEndPosition();
                const visibleAfterCharCount = Math.min(this._context.viewModel.model.getLineMaxColumn(endModelPosition.lineNumber) - endModelPosition.column, desiredVisibleAfterCharCount);
                const distanceToModelLineEnd = this._context.viewModel.model.getLineMaxColumn(endModelPosition.lineNumber) - endModelPosition.column - visibleAfterCharCount;
                return { distanceToModelLineEnd };
            })();
            // Scroll to reveal the location in the editor where composition occurs
            this._context.viewModel.revealRange('keyboard', true, Range.fromPositions(this._selections[0].getStartPosition()), 0 /* viewEvents.VerticalRevealType.Simple */, 1 /* ScrollType.Immediate */);
            this._visibleTextArea = new VisibleTextAreaData(this._context, modelSelection.startLineNumber, distanceToModelLineStart, widthOfHiddenTextBefore, distanceToModelLineEnd);
            // We turn off wrapping if the <textarea> becomes visible for composition
            this.textArea.setAttribute('wrap', this._textAreaWrapping && !this._visibleTextArea ? 'on' : 'off');
            this._visibleTextArea.prepareRender(this._visibleRangeProvider);
            this._render();
            // Show the textarea
            this.textArea.setClassName(`inputarea ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME} ime-input`);
            this._viewController.compositionStart();
            this._context.viewModel.onCompositionStart();
        }));
        this._register(this._textAreaInput.onCompositionUpdate((e) => {
            if (!this._visibleTextArea) {
                return;
            }
            this._visibleTextArea.prepareRender(this._visibleRangeProvider);
            this._render();
        }));
        this._register(this._textAreaInput.onCompositionEnd(() => {
            this._visibleTextArea = null;
            // We turn on wrapping as necessary if the <textarea> hides after composition
            this.textArea.setAttribute('wrap', this._textAreaWrapping && !this._visibleTextArea ? 'on' : 'off');
            this._render();
            this.textArea.setClassName(`inputarea ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
            this._viewController.compositionEnd();
            this._context.viewModel.onCompositionEnd();
        }));
        this._register(this._textAreaInput.onFocus(() => {
            this._context.viewModel.setHasFocus(true);
        }));
        this._register(this._textAreaInput.onBlur(() => {
            this._context.viewModel.setHasFocus(false);
        }));
        this._register(IME.onDidChange(() => {
            this._ensureReadOnlyAttribute();
        }));
    }
    get domNode() {
        return this.textArea;
    }
    writeScreenReaderContent(reason) {
        this._textAreaInput.writeNativeTextAreaContent(reason);
    }
    getTextAreaDomNode() {
        return this.textArea.domNode;
    }
    dispose() {
        super.dispose();
        this.textArea.domNode.remove();
        this.textAreaCover.domNode.remove();
    }
    _getAndroidWordAtPosition(position) {
        const ANDROID_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:",.<>/?';
        const lineContent = this._context.viewModel.getLineContent(position.lineNumber);
        const wordSeparators = getMapForWordSeparators(ANDROID_WORD_SEPARATORS, []);
        let goingLeft = true;
        let startColumn = position.column;
        let goingRight = true;
        let endColumn = position.column;
        let distance = 0;
        while (distance < 50 && (goingLeft || goingRight)) {
            if (goingLeft && startColumn <= 1) {
                goingLeft = false;
            }
            if (goingLeft) {
                const charCode = lineContent.charCodeAt(startColumn - 2);
                const charClass = wordSeparators.get(charCode);
                if (charClass !== 0 /* WordCharacterClass.Regular */) {
                    goingLeft = false;
                }
                else {
                    startColumn--;
                }
            }
            if (goingRight && endColumn > lineContent.length) {
                goingRight = false;
            }
            if (goingRight) {
                const charCode = lineContent.charCodeAt(endColumn - 1);
                const charClass = wordSeparators.get(charCode);
                if (charClass !== 0 /* WordCharacterClass.Regular */) {
                    goingRight = false;
                }
                else {
                    endColumn++;
                }
            }
            distance++;
        }
        return [lineContent.substring(startColumn - 1, endColumn - 1), position.column - startColumn];
    }
    _getWordBeforePosition(position) {
        const lineContent = this._context.viewModel.getLineContent(position.lineNumber);
        const wordSeparators = getMapForWordSeparators(this._context.configuration.options.get(139 /* EditorOption.wordSeparators */), []);
        let column = position.column;
        let distance = 0;
        while (column > 1) {
            const charCode = lineContent.charCodeAt(column - 2);
            const charClass = wordSeparators.get(charCode);
            if (charClass !== 0 /* WordCharacterClass.Regular */ || distance > 50) {
                return lineContent.substring(column - 1, position.column - 1);
            }
            distance++;
            column--;
        }
        return lineContent.substring(0, position.column - 1);
    }
    _getCharacterBeforePosition(position) {
        if (position.column > 1) {
            const lineContent = this._context.viewModel.getLineContent(position.lineNumber);
            const charBefore = lineContent.charAt(position.column - 2);
            if (!strings.isHighSurrogate(charBefore.charCodeAt(0))) {
                return charBefore;
            }
        }
        return '';
    }
    _setAccessibilityOptions(options) {
        this._accessibilitySupport = options.get(2 /* EditorOption.accessibilitySupport */);
        const accessibilityPageSize = options.get(3 /* EditorOption.accessibilityPageSize */);
        if (this._accessibilitySupport === 2 /* AccessibilitySupport.Enabled */ && accessibilityPageSize === EditorOptions.accessibilityPageSize.defaultValue) {
            // If a screen reader is attached and the default value is not set we should automatically increase the page size to 500 for a better experience
            this._accessibilityPageSize = 500;
        }
        else {
            this._accessibilityPageSize = accessibilityPageSize;
        }
        // When wrapping is enabled and a screen reader might be attached,
        // we will size the textarea to match the width used for wrapping points computation (see `domLineBreaksComputer.ts`).
        // This is because screen readers will read the text in the textarea and we'd like that the
        // wrapping points in the textarea match the wrapping points in the editor.
        const layoutInfo = options.get(154 /* EditorOption.layoutInfo */);
        const wrappingColumn = layoutInfo.wrappingColumn;
        if (wrappingColumn !== -1 && this._accessibilitySupport !== 1 /* AccessibilitySupport.Disabled */) {
            const fontInfo = options.get(55 /* EditorOption.fontInfo */);
            this._textAreaWrapping = true;
            this._textAreaWidth = Math.round(wrappingColumn * fontInfo.typicalHalfwidthCharacterWidth);
        }
        else {
            this._textAreaWrapping = false;
            this._textAreaWidth = (canUseZeroSizeTextarea ? 0 : 1);
        }
    }
    // --- begin event handlers
    onConfigurationChanged(e) {
        const options = this._context.configuration.options;
        const layoutInfo = options.get(154 /* EditorOption.layoutInfo */);
        this._setAccessibilityOptions(options);
        this._contentLeft = layoutInfo.contentLeft;
        this._contentWidth = layoutInfo.contentWidth;
        this._contentHeight = layoutInfo.height;
        this._fontInfo = options.get(55 /* EditorOption.fontInfo */);
        this._emptySelectionClipboard = options.get(41 /* EditorOption.emptySelectionClipboard */);
        this._copyWithSyntaxHighlighting = options.get(28 /* EditorOption.copyWithSyntaxHighlighting */);
        this.textArea.setAttribute('wrap', this._textAreaWrapping && !this._visibleTextArea ? 'on' : 'off');
        const { tabSize } = this._context.viewModel.model.getOptions();
        this.textArea.domNode.style.tabSize = `${tabSize * this._fontInfo.spaceWidth}px`;
        this.textArea.setAttribute('aria-label', ariaLabelForScreenReaderContent(options, this._keybindingService));
        this.textArea.setAttribute('aria-required', options.get(6 /* EditorOption.ariaRequired */) ? 'true' : 'false');
        this.textArea.setAttribute('tabindex', String(options.get(132 /* EditorOption.tabIndex */)));
        if (e.hasChanged(37 /* EditorOption.domReadOnly */) || e.hasChanged(99 /* EditorOption.readOnly */)) {
            this._ensureReadOnlyAttribute();
        }
        if (e.hasChanged(2 /* EditorOption.accessibilitySupport */)) {
            this._textAreaInput.writeNativeTextAreaContent('strategy changed');
        }
        return true;
    }
    onCursorStateChanged(e) {
        this._selections = e.selections.slice(0);
        this._modelSelections = e.modelSelections.slice(0);
        // We must update the <textarea> synchronously, otherwise long press IME on macos breaks.
        // See https://github.com/microsoft/vscode/issues/165821
        this._textAreaInput.writeNativeTextAreaContent('selection changed');
        return true;
    }
    onDecorationsChanged(e) {
        // true for inline decorations that can end up relayouting text
        return true;
    }
    onFlushed(e) {
        return true;
    }
    onLinesChanged(e) {
        return true;
    }
    onLinesDeleted(e) {
        return true;
    }
    onLinesInserted(e) {
        return true;
    }
    onScrollChanged(e) {
        this._scrollLeft = e.scrollLeft;
        this._scrollTop = e.scrollTop;
        return true;
    }
    onZonesChanged(e) {
        return true;
    }
    // --- end event handlers
    // --- begin view API
    isFocused() {
        return this._textAreaInput.isFocused();
    }
    focus() {
        this._textAreaInput.focusTextArea();
    }
    refreshFocusState() {
        this._textAreaInput.refreshFocusState();
    }
    getLastRenderData() {
        return this._lastRenderPosition;
    }
    setAriaOptions(options) {
        if (options.activeDescendant) {
            this.textArea.setAttribute('aria-haspopup', 'true');
            this.textArea.setAttribute('aria-autocomplete', 'list');
            this.textArea.setAttribute('aria-activedescendant', options.activeDescendant);
        }
        else {
            this.textArea.setAttribute('aria-haspopup', 'false');
            this.textArea.setAttribute('aria-autocomplete', 'both');
            this.textArea.removeAttribute('aria-activedescendant');
        }
        if (options.role) {
            this.textArea.setAttribute('role', options.role);
        }
    }
    // --- end view API
    _ensureReadOnlyAttribute() {
        const options = this._context.configuration.options;
        // When someone requests to disable IME, we set the "readonly" attribute on the <textarea>.
        // This will prevent composition.
        const useReadOnly = !IME.enabled || (options.get(37 /* EditorOption.domReadOnly */) && options.get(99 /* EditorOption.readOnly */));
        if (useReadOnly) {
            this.textArea.setAttribute('readonly', 'true');
        }
        else {
            this.textArea.removeAttribute('readonly');
        }
    }
    prepareRender(ctx) {
        this._primaryCursorPosition = new Position(this._selections[0].positionLineNumber, this._selections[0].positionColumn);
        this._primaryCursorVisibleRange = ctx.visibleRangeForPosition(this._primaryCursorPosition);
        this._visibleTextArea?.prepareRender(ctx);
    }
    render(ctx) {
        this._textAreaInput.writeNativeTextAreaContent('render');
        this._render();
    }
    _render() {
        if (this._visibleTextArea) {
            // The text area is visible for composition reasons
            const visibleStart = this._visibleTextArea.visibleTextareaStart;
            const visibleEnd = this._visibleTextArea.visibleTextareaEnd;
            const startPosition = this._visibleTextArea.startPosition;
            const endPosition = this._visibleTextArea.endPosition;
            if (startPosition && endPosition && visibleStart && visibleEnd && visibleEnd.left >= this._scrollLeft && visibleStart.left <= this._scrollLeft + this._contentWidth) {
                const top = (this._context.viewLayout.getVerticalOffsetForLineNumber(this._primaryCursorPosition.lineNumber) - this._scrollTop);
                const lineCount = newlinecount(this.textArea.domNode.value.substr(0, this.textArea.domNode.selectionStart));
                let scrollLeft = this._visibleTextArea.widthOfHiddenLineTextBefore;
                let left = (this._contentLeft + visibleStart.left - this._scrollLeft);
                // See https://github.com/microsoft/vscode/issues/141725#issuecomment-1050670841
                // Here we are adding +1 to avoid flickering that might be caused by having a width that is too small.
                // This could be caused by rounding errors that might only show up with certain font families.
                // In other words, a pixel might be lost when doing something like
                //      `Math.round(end) - Math.round(start)`
                // vs
                //      `Math.round(end - start)`
                let width = visibleEnd.left - visibleStart.left + 1;
                if (left < this._contentLeft) {
                    // the textarea would be rendered on top of the margin,
                    // so reduce its width. We use the same technique as
                    // for hiding text before
                    const delta = (this._contentLeft - left);
                    left += delta;
                    scrollLeft += delta;
                    width -= delta;
                }
                if (width > this._contentWidth) {
                    // the textarea would be wider than the content width,
                    // so reduce its width.
                    width = this._contentWidth;
                }
                // Try to render the textarea with the color/font style to match the text under it
                const viewPosition = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(startPosition.lineNumber, 1));
                const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(viewPosition.lineNumber);
                const viewLineData = this._context.viewModel.getViewLineData(startPosition.lineNumber);
                const startTokenIndex = viewLineData.tokens.findTokenIndexAtOffset(startPosition.column - 1);
                const endTokenIndex = viewLineData.tokens.findTokenIndexAtOffset(endPosition.column - 1);
                const textareaSpansSingleToken = (startTokenIndex === endTokenIndex);
                const presentation = this._visibleTextArea.definePresentation((textareaSpansSingleToken ? viewLineData.tokens.getPresentation(startTokenIndex) : null));
                this.textArea.domNode.scrollTop = lineCount * lineHeight;
                this.textArea.domNode.scrollLeft = scrollLeft;
                this._doRender({
                    lastRenderPosition: null,
                    top: top,
                    left: left,
                    width: width,
                    height: lineHeight,
                    useCover: false,
                    color: (TokenizationRegistry.getColorMap() || [])[presentation.foreground],
                    italic: presentation.italic,
                    bold: presentation.bold,
                    underline: presentation.underline,
                    strikethrough: presentation.strikethrough
                });
            }
            return;
        }
        if (!this._primaryCursorVisibleRange) {
            // The primary cursor is outside the viewport => place textarea to the top left
            this._renderAtTopLeft();
            return;
        }
        const left = this._contentLeft + this._primaryCursorVisibleRange.left - this._scrollLeft;
        if (left < this._contentLeft || left > this._contentLeft + this._contentWidth) {
            // cursor is outside the viewport
            this._renderAtTopLeft();
            return;
        }
        const top = this._context.viewLayout.getVerticalOffsetForLineNumber(this._selections[0].positionLineNumber) - this._scrollTop;
        if (top < 0 || top > this._contentHeight) {
            // cursor is outside the viewport
            this._renderAtTopLeft();
            return;
        }
        // The primary cursor is in the viewport (at least vertically) => place textarea on the cursor
        if (platform.isMacintosh || this._accessibilitySupport === 2 /* AccessibilitySupport.Enabled */) {
            // For the popup emoji input, we will make the text area as high as the line height
            // We will also make the fontSize and lineHeight the correct dimensions to help with the placement of these pickers
            const lineNumber = this._primaryCursorPosition.lineNumber;
            const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(lineNumber);
            this._doRender({
                lastRenderPosition: this._primaryCursorPosition,
                top,
                left: this._textAreaWrapping ? this._contentLeft : left,
                width: this._textAreaWidth,
                height: lineHeight,
                useCover: false
            });
            // In case the textarea contains a word, we're going to try to align the textarea's cursor
            // with our cursor by scrolling the textarea as much as possible
            this.textArea.domNode.scrollLeft = this._primaryCursorVisibleRange.left;
            const lineCount = this._textAreaInput.textAreaState.newlineCountBeforeSelection ?? newlinecount(this.textArea.domNode.value.substring(0, this.textArea.domNode.selectionStart));
            this.textArea.domNode.scrollTop = lineCount * lineHeight;
            return;
        }
        this._doRender({
            lastRenderPosition: this._primaryCursorPosition,
            top: top,
            left: this._textAreaWrapping ? this._contentLeft : left,
            width: this._textAreaWidth,
            height: (canUseZeroSizeTextarea ? 0 : 1),
            useCover: false
        });
    }
    _renderAtTopLeft() {
        // (in WebKit the textarea is 1px by 1px because it cannot handle input to a 0x0 textarea)
        // specifically, when doing Korean IME, setting the textarea to 0x0 breaks IME badly.
        this._doRender({
            lastRenderPosition: null,
            top: 0,
            left: 0,
            width: this._textAreaWidth,
            height: (canUseZeroSizeTextarea ? 0 : 1),
            useCover: true
        });
    }
    _doRender(renderData) {
        this._lastRenderPosition = renderData.lastRenderPosition;
        const ta = this.textArea;
        const tac = this.textAreaCover;
        applyFontInfo(ta, this._fontInfo);
        ta.setTop(renderData.top);
        ta.setLeft(renderData.left);
        ta.setWidth(renderData.width);
        ta.setHeight(renderData.height);
        ta.setLineHeight(renderData.height);
        ta.setColor(renderData.color ? Color.Format.CSS.formatHex(renderData.color) : '');
        ta.setFontStyle(renderData.italic ? 'italic' : '');
        if (renderData.bold) {
            // fontWeight is also set by `applyFontInfo`, so only overwrite it if necessary
            ta.setFontWeight('bold');
        }
        ta.setTextDecoration(`${renderData.underline ? ' underline' : ''}${renderData.strikethrough ? ' line-through' : ''}`);
        tac.setTop(renderData.useCover ? renderData.top : 0);
        tac.setLeft(renderData.useCover ? renderData.left : 0);
        tac.setWidth(renderData.useCover ? renderData.width : 0);
        tac.setHeight(renderData.useCover ? renderData.height : 0);
        const options = this._context.configuration.options;
        if (options.get(62 /* EditorOption.glyphMargin */)) {
            tac.setClassName('monaco-editor-background textAreaCover ' + Margin.OUTER_CLASS_NAME);
        }
        else {
            if (options.get(72 /* EditorOption.lineNumbers */).renderType !== 0 /* RenderLineNumbersType.Off */) {
                tac.setClassName('monaco-editor-background textAreaCover ' + LineNumbersOverlay.CLASS_NAME);
            }
            else {
                tac.setClassName('monaco-editor-background textAreaCover');
            }
        }
    }
};
TextAreaEditContext = __decorate([
    __param(4, IKeybindingService),
    __param(5, IInstantiationService)
], TextAreaEditContext);
export { TextAreaEditContext };
function measureText(targetDocument, text, fontInfo, tabSize) {
    if (text.length === 0) {
        return 0;
    }
    const container = targetDocument.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-50000px';
    container.style.width = '50000px';
    const regularDomNode = targetDocument.createElement('span');
    applyFontInfo(regularDomNode, fontInfo);
    regularDomNode.style.whiteSpace = 'pre'; // just like the textarea
    regularDomNode.style.tabSize = `${tabSize * fontInfo.spaceWidth}px`; // just like the textarea
    regularDomNode.append(text);
    container.appendChild(regularDomNode);
    targetDocument.body.appendChild(container);
    const res = regularDomNode.offsetWidth;
    container.remove();
    return res;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEFyZWFFZGl0Q29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvY29udHJvbGxlci9lZGl0Q29udGV4dC90ZXh0QXJlYS90ZXh0QXJlYUVkaXRDb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sMkJBQTJCLENBQUM7QUFDbkMsT0FBTyxLQUFLLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQztBQUM3QyxPQUFPLEtBQUssT0FBTyxNQUFNLHdDQUF3QyxDQUFDO0FBQ2xFLE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRTVGLE9BQU8sS0FBSyxRQUFRLE1BQU0sd0NBQXdDLENBQUM7QUFDbkUsT0FBTyxLQUFLLE9BQU8sTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFL0QsT0FBTyxFQUFtQixnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzlFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RCxPQUFPLEVBQStELGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRXhJLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBUWpFLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXZFLE9BQU8sRUFB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