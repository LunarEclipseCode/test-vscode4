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
import * as browser from '../../../../../base/browser/browser.js';
import * as dom from '../../../../../base/browser/dom.js';
import { DomEmitter } from '../../../../../base/browser/event.js';
import { StandardKeyboardEvent } from '../../../../../base/browser/keyboardEvent.js';
import { inputLatency } from '../../../../../base/browser/performance.js';
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import * as strings from '../../../../../base/common/strings.js';
import { Selection } from '../../../../common/core/selection.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ClipboardEventUtils, InMemoryClipboardMetadataManager } from '../clipboardUtils.js';
import { _debugComposition, TextAreaState } from './textAreaEditContextState.js';
export var TextAreaSyntethicEvents;
(function (TextAreaSyntethicEvents) {
    TextAreaSyntethicEvents.Tap = '-monaco-textarea-synthetic-tap';
})(TextAreaSyntethicEvents || (TextAreaSyntethicEvents = {}));
class CompositionContext {
    constructor() {
        this._lastTypeTextLength = 0;
    }
    handleCompositionUpdate(text) {
        text = text || '';
        const typeInput = {
            text: text,
            replacePrevCharCnt: this._lastTypeTextLength,
            replaceNextCharCnt: 0,
            positionDelta: 0
        };
        this._lastTypeTextLength = text.length;
        return typeInput;
    }
}
/**
 * Writes screen reader content to the textarea and is able to analyze its input events to generate:
 *  - onCut
 *  - onPaste
 *  - onType
 *
 * Composition events are generated for presentation purposes (composition input is reflected in onType).
 */
let TextAreaInput = class TextAreaInput extends Disposable {
    get textAreaState() {
        return this._textAreaState;
    }
    constructor(_host, _textArea, _OS, _browser, _accessibilityService, _logService) {
        super();
        this._host = _host;
        this._textArea = _textArea;
        this._OS = _OS;
        this._browser = _browser;
        this._accessibilityService = _accessibilityService;
        this._logService = _logService;
        this._onFocus = this._register(new Emitter());
        this.onFocus = this._onFocus.event;
        this._onBlur = this._register(new Emitter());
        this.onBlur = this._onBlur.event;
        this._onKeyDown = this._register(new Emitter());
        this.onKeyDown = this._onKeyDown.event;
        this._onKeyUp = this._register(new Emitter());
        this.onKeyUp = this._onKeyUp.event;
        this._onCut = this._register(new Emitter());
        this.onCut = this._onCut.event;
        this._onPaste = this._register(new Emitter());
        this.onPaste = this._onPaste.event;
        this._onType = this._register(new Emitter());
        this.onType = this._onType.event;
        this._onCompositionStart = this._register(new Emitter());
        this.onCompositionStart = this._onCompositionStart.event;
        this._onCompositionUpdate = this._register(new Emitter());
        this.onCompositionUpdate = this._onCompositionUpdate.event;
        this._onCompositionEnd = this._register(new Emitter());
        this.onCompositionEnd = this._onCompositionEnd.event;
        this._onSelectionChangeRequest = this._register(new Emitter());
        this.onSelectionChangeRequest = this._onSelectionChangeRequest.event;
        this._asyncFocusGainWriteScreenReaderContent = this._register(new MutableDisposable());
        this._asyncTriggerCut = this._register(new RunOnceScheduler(() => this._onCut.fire(), 0));
        this._textAreaState = TextAreaState.EMPTY;
        this._selectionChangeListener = null;
        if (this._accessibilityService.isScreenReaderOptimized()) {
            this.writeNativeTextAreaContent('ctor');
        }
        this._register(Event.runAndSubscribe(this._accessibilityService.onDidChangeScreenReaderOptimized, () => {
            if (this._accessibilityService.isScreenReaderOptimized() && !this._asyncFocusGainWriteScreenReaderContent.value) {
                this._asyncFocusGainWriteScreenReaderContent.value = this._register(new RunOnceScheduler(() => this.writeNativeTextAreaContent('asyncFocusGain'), 0));
            }
            else {
                this._asyncFocusGainWriteScreenReaderContent.clear();
            }
        }));
        this._hasFocus = false;
        this._currentComposition = null;
        let lastKeyDown = null;
        this._register(this._textArea.onKeyDown((_e) => {
            const e = new StandardKeyboardEvent(_e);
            if (e.keyCode === 114 /* KeyCode.KEY_IN_COMPOSITION */
                || (this._currentComposition && e.keyCode === 1 /* KeyCode.Backspace */)) {
                // Stop propagation for keyDown events if the IME is processing key input
                e.stopPropagation();
            }
            if (e.equals(9 /* KeyCode.Escape */)) {
                // Prevent default always for `Esc`, otherwise it will generate a keypress
                // See https://msdn.microsoft.com/en-us/library/ie/ms536939(v=vs.85).aspx
                e.preventDefault();
            }
            lastKeyDown = e;
            this._onKeyDown.fire(e);
        }));
        this._register(this._textArea.onKeyUp((_e) => {
            const e = new StandardKeyboardEvent(_e);
            this._onKeyUp.fire(e);
        }));
        this._register(this._textArea.onCompositionStart((e) => {
            if (_debugComposition) {
                console.log(`[compositionstart]`, e);
            }
            const currentComposition = new CompositionContext();
            if (this._currentComposition) {
                // simply reset the composition context
                this._currentComposition = currentComposition;
                return;
            }
            this._currentComposition = currentComposition;
            if (this._OS === 2 /* OperatingSystem.Macintosh */
                && lastKeyDown
                && lastKeyDown.equals(114 /* KeyCode.KEY_IN_COMPOSITION */)
                && this._textAreaState.selectionStart === this._textAreaState.selectionEnd
                && this._textAreaState.selectionStart > 0
                && this._textAreaState.value.substr(this._textAreaState.selectionStart - 1, 1) === e.data
                && (lastKeyDown.code === 'ArrowRight' || lastKeyDown.code === 'ArrowLeft')) {
                // Handling long press case on Chromium/Safari macOS + arrow key => pretend the character was selected
                if (_debugComposition) {
                    console.log(`[compositionstart] Handling long press case on macOS + arrow key`, e);
                }
                // Pretend the previous character was composed (in order to get it removed by subsequent compositionupdate events)
                currentComposition.handleCompositionUpdate('x');
                this._onCompositionStart.fire({ data: e.data });
                return;
            }
            if (this._browser.isAndroid) {
                // when tapping on the editor, Android enters composition mode to edit the current word
                // so we cannot clear the textarea on Android and we must pretend the current word was selected
                this._onCompositionStart.fire({ data: e.data });
                return;
            }
            this._onCompositionStart.fire({ data: e.data });
        }));
        this._register(this._textArea.onCompositionUpdate((e) => {
            if (_debugComposition) {
                console.log(`[compositionupdate]`, e);
            }
            const currentComposition = this._currentComposition;
            if (!currentComposition) {
                // should not be possible to receive a 'compositionupdate' without a 'compositionstart'
                return;
            }
            if (this._browser.isAndroid) {
                // On Android, the data sent with the composition update event is unusable.
                // For example, if the cursor is in the middle of a word like Mic|osoft
                // and Microsoft is chosen from the keyboard's suggestions, the e.data will contain "Microsoft".
                // This is not really usable because it doesn't tell us where the edit began and where it ended.
                const newState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
                const typeInput = TextAreaState.deduceAndroidCompositionInput(this._textAreaState, newState);
                this._textAreaState = newState;
                this._onType.fire(typeInput);
                this._onCompositionUpdate.fire(e);
                return;
            }
            const typeInput = currentComposition.handleCompositionUpdate(e.data);
            this._textAreaState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
            this._onType.fire(typeInput);
            this._onCompositionUpdate.fire(e);
        }));
        this._register(this._textArea.onCompositionEnd((e) => {
            if (_debugComposition) {
                console.log(`[compositionend]`, e);
            }
            const currentComposition = this._currentComposition;
            if (!currentComposition) {
                // https://github.com/microsoft/monaco-editor/issues/1663
                // On iOS 13.2, Chinese system IME randomly trigger an additional compositionend event with empty data
                return;
            }
            this._currentComposition = null;
            if (this._browser.isAndroid) {
                // On Android, the data sent with the composition update event is unusable.
                // For example, if the cursor is in the middle of a word like Mic|osoft
                // and Microsoft is chosen from the keyboard's suggestions, the e.data will contain "Microsoft".
                // This is not really usable because it doesn't tell us where the edit began and where it ended.
                const newState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
                const typeInput = TextAreaState.deduceAndroidCompositionInput(this._textAreaState, newState);
                this._textAreaState = newState;
                this._onType.fire(typeInput);
                this._onCompositionEnd.fire();
                return;
            }
            const typeInput = currentComposition.handleCompositionUpdate(e.data);
            this._textAreaState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
            this._onType.fire(typeInput);
            this._onCompositionEnd.fire();
        }));
        this._register(this._textArea.onInput((e) => {
            if (_debugComposition) {
                console.log(`[input]`, e);
            }
            // Pretend here we touched the text area, as the `input` event will most likely
            // result in a `selectionchange` event which we want to ignore
            this._textArea.setIgnoreSelectionChangeTime('received input event');
            if (this._currentComposition) {
                return;
            }
            const newState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
            const typeInput = TextAreaState.deduceInput(this._textAreaState, newState, /*couldBeEmojiInput*/ this._OS === 2 /* OperatingSystem.Macintosh */);
            if (typeInput.replacePrevCharCnt === 0 && typeInput.text.length === 1) {
                // one character was typed
                if (strings.isHighSurrogate(typeInput.text.charCodeAt(0))
                    || typeInput.text.charCodeAt(0) === 0x7f /* Delete */) {
                    // Ignore invalid input but keep it around for next time
                    return;
                }
            }
            this._textAreaState = newState;
            if (typeInput.text !== ''
                || typeInput.replacePrevCharCnt !== 0
                || typeInput.replaceNextCharCnt !== 0
                || typeInput.positionDelta !== 0) {
                this._onType.fire(typeInput);
            }
        }));
        // --- Clipboard operations
        this._register(this._textArea.onCut((e) => {
            // Pretend here we touched the text area, as the `cut` event will most likely
            // result in a `selectionchange` event which we want to ignore
            this._textArea.setIgnoreSelectionChangeTime('received cut event');
            this._ensureClipboardGetsEditorSelection(e);
            this._asyncTriggerCut.schedule();
        }));
        this._register(this._textArea.onCopy((e) => {
            this._ensureClipboardGetsEditorSelection(e);
        }));
        this._register(this._textArea.onPaste((e) => {
            // Pretend here we touched the text area, as the `paste` event will most likely
            // result in a `selectionchange` event which we want to ignore
            this._textArea.setIgnoreSelectionChangeTime('received paste event');
            e.preventDefault();
            if (!e.clipboardData) {
                return;
            }
            let [text, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
            if (!text) {
                return;
            }
            // try the in-memory store
            metadata = metadata || InMemoryClipboardMetadataManager.INSTANCE.get(text);
            this._onPaste.fire({
                text: text,
                metadata: metadata
            });
        }));
        this._register(this._textArea.onFocus(() => {
            const hadFocus = this._hasFocus;
            this._setHasFocus(true);
            if (this._accessibilityService.isScreenReaderOptimized() && this._browser.isSafari && !hadFocus && this._hasFocus) {
                // When "tabbing into" the textarea, immediately after dispatching the 'focus' event,
                // Safari will always move the selection at offset 0 in the textarea
                if (!this._asyncFocusGainWriteScreenReaderContent.value) {
                    this._asyncFocusGainWriteScreenReaderContent.value = new RunOnceScheduler(() => this.writeNativeTextAreaContent('asyncFocusGain'), 0);
                }
                this._asyncFocusGainWriteScreenReaderContent.value.schedule();
            }
        }));
        this._register(this._textArea.onBlur(() => {
            if (this._currentComposition) {
                // See https://github.com/microsoft/vscode/issues/112621
                // where compositionend is not triggered when the editor
                // is taken off-dom during a composition
                // Clear the flag to be able to write to the textarea
                this._currentComposition = null;
                // Clear the textarea to avoid an unwanted cursor type
                this.writeNativeTextAreaContent('blurWithoutCompositionEnd');
                // Fire artificial composition end
                this._onCompositionEnd.fire();
            }
            this._setHasFocus(false);
        }));
        this._register(this._textArea.onSyntheticTap(() => {
            if (this._browser.isAndroid && this._currentComposition) {
                // on Android, tapping does not cancel the current composition, so the
                // textarea is stuck showing the old composition
                // Clear the flag to be able to write to the textarea
                this._currentComposition = null;
                // Clear the textarea to avoid an unwanted cursor type
                this.writeNativeTextAreaContent('tapWithoutCompositionEnd');
                // Fire artificial composition end
                this._onCompositionEnd.fire();
            }
        }));
    }
    _initializeFromTest() {
        this._hasFocus = true;
        this._textAreaState = TextAreaState.readFromTextArea(this._textArea, null);
    }
    _installSelectionChangeListener() {
        // See https://github.com/microsoft/vscode/issues/27216 and https://github.com/microsoft/vscode/issues/98256
        // When using a Braille display, it is possible for users to reposition the
        // system caret. This is reflected in Chrome as a `selectionchange` event.
        //
        // The `selectionchange` event appears to be emitted under numerous other circumstances,
        // so it is quite a challenge to distinguish a `selectionchange` coming in from a user
        // using a Braille display from all the other cases.
        //
        // The problems with the `selectionchange` event are:
        //  * the event is emitted when the textarea is focused programmatically -- textarea.focus()
        //  * the event is emitted when the selection is changed in the textarea programmatically -- textarea.setSelectionRange(...)
        //  * the event is emitted when the value of the textarea is changed programmatically -- textarea.value = '...'
        //  * the event is emitted when tabbing into the textarea
        //  * the event is emitted asynchronously (sometimes with a delay as high as a few tens of ms)
        //  * the event sometimes comes in bursts for a single logical textarea operation
        // `selectionchange` events often come multiple times for a single logical change
        // so throttle multiple `selectionchange` events that burst in a short period of time.
        let previousSelectionChangeEventTime = 0;
        return dom.addDisposableListener(this._textArea.ownerDocument, 'selectionchange', (e) => {
            inputLatency.onSelectionChange();
            if (!this._hasFocus) {
                return;
            }
            if (this._currentComposition) {
                return;
            }
            if (!this._browser.isChrome) {
                // Support only for Chrome until testing happens on other browsers
                return;
            }
            const now = Date.now();
            const delta1 = now - previousSelectionChangeEventTime;
            previousSelectionChangeEventTime = now;
            if (delta1 < 5) {
                // received another `selectionchange` event within 5ms of the previous `selectionchange` event
                // => ignore it
                return;
            }
            const delta2 = now - this._textArea.getIgnoreSelectionChangeTime();
            this._textArea.resetSelectionChangeTime();
            if (delta2 < 100) {
                // received a `selectionchange` event within 100ms since we touched the textarea
                // => ignore it, since we caused it
                return;
            }
            if (!this._textAreaState.selection) {
                // Cannot correlate a position in the textarea with a position in the editor...
                return;
            }
            const newValue = this._textArea.getValue();
            if (this._textAreaState.value !== newValue) {
                // Cannot correlate a position in the textarea with a position in the editor...
                return;
            }
            const newSelectionStart = this._textArea.getSelectionStart();
            const newSelectionEnd = this._textArea.getSelectionEnd();
            if (this._textAreaState.selectionStart === newSelectionStart && this._textAreaState.selectionEnd === newSelectionEnd) {
                // Nothing to do...
                return;
            }
            const _newSelectionStartPosition = this._textAreaState.deduceEditorPosition(newSelectionStart);
            const newSelectionStartPosition = this._host.deduceModelPosition(_newSelectionStartPosition[0], _newSelectionStartPosition[1], _newSelectionStartPosition[2]);
            const _newSelectionEndPosition = this._textAreaState.deduceEditorPosition(newSelectionEnd);
            const newSelectionEndPosition = this._host.deduceModelPosition(_newSelectionEndPosition[0], _newSelectionEndPosition[1], _newSelectionEndPosition[2]);
            const newSelection = new Selection(newSelectionStartPosition.lineNumber, newSelectionStartPosition.column, newSelectionEndPosition.lineNumber, newSelectionEndPosition.column);
            this._onSelectionChangeRequest.fire(newSelection);
        });
    }
    dispose() {
        super.dispose();
        if (this._selectionChangeListener) {
            this._selectionChangeListener.dispose();
            this._selectionChangeListener = null;
        }
    }
    focusTextArea() {
        // Setting this._hasFocus and writing the screen reader content
        // will result in a focus() and setSelectionRange() in the textarea
        this._setHasFocus(true);
        // If the editor is off DOM, focus cannot be really set, so let's double check that we have managed to set the focus
        this.refreshFocusState();
    }
    isFocused() {
        return this._hasFocus;
    }
    refreshFocusState() {
        this._setHasFocus(this._textArea.hasFocus());
    }
    _setHasFocus(newHasFocus) {
        if (this._hasFocus === newHasFocus) {
            // no change
            return;
        }
        this._hasFocus = newHasFocus;
        if (this._selectionChangeListener) {
            this._selectionChangeListener.dispose();
            this._selectionChangeListener = null;
        }
        if (this._hasFocus) {
            this._selectionChangeListener = this._installSelectionChangeListener();
        }
        if (this._hasFocus) {
            this.writeNativeTextAreaContent('focusgain');
        }
        if (this._hasFocus) {
            this._onFocus.fire();
        }
        else {
            this._onBlur.fire();
        }
    }
    _setAndWriteTextAreaState(reason, textAreaState) {
        if (!this._hasFocus) {
            textAreaState = textAreaState.collapseSelection();
        }
        if (!textAreaState.isWrittenToTextArea(this._textArea, this._hasFocus)) {
            this._logService.trace(`writeTextAreaState(reason: ${reason})`);
        }
        textAreaState.writeToTextArea(reason, this._textArea, this._hasFocus);
        this._textAreaState = textAreaState;
    }
    writeNativeTextAreaContent(reason) {
        if ((!this._accessibilityService.isScreenReaderOptimized() && reason === 'render') || this._currentComposition) {
            // Do not write to the text on render unless a screen reader is being used #192278
            // Do not write to the text area when doing composition
            return;
        }
        this._setAndWriteTextAreaState(reason, this._host.getScreenReaderContent());
    }
    _ensureClipboardGetsEditorSelection(e) {
        const dataToCopy = this._host.getDataToCopy();
        const storedMetadata = {
            version: 1,
            isFromEmptySelection: dataToCopy.isFromEmptySelection,
            multicursorText: dataToCopy.multicursorText,
            mode: dataToCopy.mode
        };
        InMemoryClipboardMetadataManager.INSTANCE.set(
        // When writing "LINE\r\n" to the clipboard and then pasting,
        // Firefox pastes "LINE\n", so let's work around this quirk
        (this._browser.isFirefox ? dataToCopy.text.replace(/\r\n/g, '\n') : dataToCopy.text), storedMetadata);
        e.preventDefault();
        if (e.clipboardData) {
            ClipboardEventUtils.setTextData(e.clipboardData, dataToCopy.text, dataToCopy.html, storedMetadata);
        }
    }
};
TextAreaInput = __decorate([
    __param(4, IAccessibilityService),
    __param(5, ILogService)
], TextAreaInput);
export { TextAreaInput };
export class TextAreaWrapper extends Disposable {
    get ownerDocument() {
        return this._actual.ownerDocument;
    }
    constructor(_actual) {
        super();
        this._actual = _actual;
        this._onSyntheticTap = this._register(new Emitter());
        this.onSyntheticTap = this._onSyntheticTap.event;
        this._ignoreSelectionChangeTime = 0;
        this.onKeyDown = this._register(new DomEmitter(this._actual, 'keydown')).event;
        this.onKeyPress = this._register(new DomEmitter(this._actual, 'keypress')).event;
        this.onKeyUp = this._register(new DomEmitter(this._actual, 'keyup')).event;
        this.onCompositionStart = this._register(new DomEmitter(this._actual, 'compositionstart')).event;
        this.onCompositionUpdate = this._register(new DomEmitter(this._actual, 'compositionupdate')).event;
        this.onCompositionEnd = this._register(new DomEmitter(this._actual, 'compositionend')).event;
        this.onBeforeInput = this._register(new DomEmitter(this._actual, 'beforeinput')).event;
        this.onInput = this._register(new DomEmitter(this._actual, 'input')).event;
        this.onCut = this._register(new DomEmitter(this._actual, 'cut')).event;
        this.onCopy = this._register(new DomEmitter(this._actual, 'copy')).event;
        this.onPaste = this._register(new DomEmitter(this._actual, 'paste')).event;
        this.onFocus = this._register(new DomEmitter(this._actual, 'focus')).event;
        this.onBlur = this._register(new DomEmitter(this._actual, 'blur')).event;
        this._register(this.onKeyDown(() => inputLatency.onKeyDown()));
        this._register(this.onBeforeInput(() => inputLatency.onBeforeInput()));
        this._register(this.onInput(() => inputLatency.onInput()));
        this._register(this.onKeyUp(() => inputLatency.onKeyUp()));
        this._register(dom.addDisposableListener(this._actual, TextAreaSyntethicEvents.Tap, () => this._onSyntheticTap.fire()));
    }
    hasFocus() {
        const shadowRoot = dom.getShadowRoot(this._actual);
        if (shadowRoot) {
            return shadowRoot.activeElement === this._actual;
        }
        else if (this._actual.isConnected) {
            return dom.getActiveElement() === this._actual;
        }
        else {
            return false;
        }
    }
    setIgnoreSelectionChangeTime(reason) {
        this._ignoreSelectionChangeTime = Date.now();
    }
    getIgnoreSelectionChangeTime() {
        return this._ignoreSelectionChangeTime;
    }
    resetSelectionChangeTime() {
        this._ignoreSelectionChangeTime = 0;
    }
    getValue() {
        // console.log('current value: ' + this._textArea.value);
        return this._actual.value;
    }
    setValue(reason, value) {
        const textArea = this._actual;
        if (textArea.value === value) {
            // No change
            return;
        }
        // console.log('reason: ' + reason + ', current value: ' + textArea.value + ' => new value: ' + value);
        this.setIgnoreSelectionChangeTime('setValue');
        textArea.value = value;
    }
    getSelectionStart() {
        return this._actual.selectionDirection === 'backward' ? this._actual.selectionEnd : this._actual.selectionStart;
    }
    getSelectionEnd() {
        return this._actual.selectionDirection === 'backward' ? this._actual.selectionStart : this._actual.selectionEnd;
    }
    setSelectionRange(reason, selectionStart, selectionEnd) {
        const textArea = this._actual;
        let activeElement = null;
        const shadowRoot = dom.getShadowRoot(textArea);
        if (shadowRoot) {
            activeElement = shadowRoot.activeElement;
        }
        else {
            activeElement = dom.getActiveElement();
        }
        const activeWindow = dom.getWindow(activeElement);
        const currentIsFocused = (activeElement === textArea);
        const currentSelectionStart = textArea.selectionStart;
        const currentSelectionEnd = textArea.selectionEnd;
        if (currentIsFocused && currentSelectionStart === selectionStart && currentSelectionEnd === selectionEnd) {
            // No change
            // Firefox iframe bug https://github.com/microsoft/monaco-editor/issues/643#issuecomment-367871377
            if (browser.isFirefox && activeWindow.parent !== activeWindow) {
                textArea.focus();
            }
            return;
        }
        // console.log('reason: ' + reason + ', setSelectionRange: ' + selectionStart + ' -> ' + selectionEnd);
        if (currentIsFocused) {
            // No need to focus, only need to change the selection range
            this.setIgnoreSelectionChangeTime('setSelectionRange');
            textArea.setSelectionRange(selectionStart, selectionEnd);
            if (browser.isFirefox && activeWindow.parent !== activeWindow) {
                textArea.focus();
            }
            return;
        }
        // If the focus is outside the textarea, browsers will try really hard to reveal the textarea.
        // Here, we try to undo the browser's desperate reveal.
        try {
            const scrollState = dom.saveParentsScrollTop(textArea);
            this.setIgnoreSelectionChangeTime('setSelectionRange');
            textArea.focus();
            textArea.setSelectionRange(selectionStart, selectionEnd);
            dom.restoreParentsScrollTop(textArea, scrollState);
        }
        catch (e) {
            // Sometimes IE throws when setting selection (e.g. textarea is off-DOM)
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEFyZWFFZGl0Q29udGV4dElucHV0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L3RleHRBcmVhL3RleHRBcmVhRWRpdENvbnRleHRJbnB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssT0FBTyxNQUFNLHdDQUF3QyxDQUFDO0FBQ2xFLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBa0IscUJBQXFCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVyRSxPQUFPLEVBQUUsVUFBVSxFQUFlLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFckcsT0FBTyxLQUFLLE9BQU8sTUFBTSx1Q0FBdUMsQ0FBQztBQUVqRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBdUIsbUJBQW1CLEVBQTJCLGdDQUFnQyxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDM0ksT0FBTyxFQUFFLGlCQUFpQixFQUErQixhQUFhLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUU5RyxNQUFNLEtBQVcsdUJB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