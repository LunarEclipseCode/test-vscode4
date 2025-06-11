/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../common/core/range.js';
import { MockInlineCompletionsProvider, withAsyncTestCodeEditorAndInlineCompletionsModel } from './utils.js';
import { Selection } from '../../../../common/core/selection.js';
suite('Inline Completions', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Does not trigger automatically if disabled', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: false } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            await timeout(1000);
            // Provider is not called, no ghost text is shown.
            assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['']);
        });
    });
    test('Ghost text is shown after trigger', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 1, }
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]']);
        });
    });
    test('Ghost text is shown automatically when configured', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            await timeout(1000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 0, }
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]']);
        });
    });
    test('Ghost text is updated automatically', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            context.keyboardType('foo');
            model.triggerExplicitly();
            await timeout(1000);
            provider.setReturnValue({ insertText: 'foobizz', range: new Range(1, 1, 1, 6) });
            context.keyboardType('b');
            context.keyboardType('i');
            await timeout(1000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 1, },
                { position: '(1,6)', text: 'foobi', triggerKind: 0, }
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]', 'foob[ar]', 'foobi', 'foobi[zz]']);
        });
    });
    test('Unindent whitespace', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('  ');
            provider.setReturnValue({ insertText: 'foo', range: new Range(1, 2, 1, 3) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', '  [foo]']);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,3)', text: '  ', triggerKind: 1, },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), [' foo']);
        });
    });
    test('Unindent tab', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('\t\t');
            provider.setReturnValue({ insertText: 'foo', range: new Range(1, 2, 1, 3) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', '\t\t[foo]']);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,3)', text: '\t\t', triggerKind: 1, },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['\tfoo']);
        });
    });
    test('No unindent after indentation', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('buzz  ');
            provider.setReturnValue({ insertText: 'foo', range: new Range(1, 6, 1, 7) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['']);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,7)', text: 'buzz  ', triggerKind: 1, },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), []);
        });
    });
    test('Next/previous', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar1', range: new Range(1, 1, 1, 4) });
            model.trigger();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar1]']);
            provider.setReturnValues([
                { insertText: 'foobar1', range: new Range(1, 1, 1, 4) },
                { insertText: 'foobizz2', range: new Range(1, 1, 1, 4) },
                { insertText: 'foobuzz3', range: new Range(1, 1, 1, 4) }
            ]);
            model.next();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bizz2]']);
            model.next();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[buzz3]']);
            model.next();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bar1]']);
            model.previous();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[buzz3]']);
            model.previous();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bizz2]']);
            model.previous();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bar1]']);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 0, },
                { position: '(1,4)', text: 'foo', triggerKind: 1, },
            ]);
        });
    });
    test('Calling the provider is debounced', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            model.trigger();
            context.keyboardType('f');
            await timeout(40);
            context.keyboardType('o');
            await timeout(40);
            context.keyboardType('o');
            await timeout(40);
            // The provider is not called
            assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
            await timeout(400);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 0, }
            ]);
            provider.assertNotCalledTwiceWithin50ms();
        });
    });
    test('Backspace is debounced', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            await timeout(1000);
            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 3; i++) {
                    context.leftDelete();
                    await timeout(5);
                }
                context.keyboardType('bar');
            }
            await timeout(400);
            provider.assertNotCalledTwiceWithin50ms();
        });
    });
    suite('Forward Stability', () => {
        test('Typing agrees', async function () {
            // The user types the text as suggested and the provider is forward-stable
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
                provider.setReturnValue({ insertText: 'foobar', });
                context.keyboardType('foo');
                model.trigger();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,4)', text: 'foo', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]']);
                context.keyboardType('b');
                assert.deepStrictEqual(context.getAndClearViewStates(), (["foob[ar]"]));
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,5)', text: 'foob', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), []);
                context.keyboardType('a');
                assert.deepStrictEqual(context.getAndClearViewStates(), (["fooba[r]"]));
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,6)', text: 'fooba', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), []);
            });
        });
        async function setupScenario({ editor, editorViewModel, model, context, store }, provider) {
            assert.deepStrictEqual(context.getAndClearViewStates(), ['']);
            provider.setReturnValue({ insertText: 'foo bar' });
            context.keyboardType('f');
            model.triggerExplicitly();
            await timeout(10000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: "(1,2)", triggerKind: 1, text: "f" }]));
            assert.deepStrictEqual(context.getAndClearViewStates(), (["f[oo bar]"]));
            provider.setReturnValue({ insertText: 'foo baz' });
            await timeout(10000);
        }
        test('Support forward instability', async function () {
            // The user types the text as suggested and the provider reports a different suggestion.
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async (ctx) => {
                await setupScenario(ctx, provider);
                ctx.context.keyboardType('o');
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ['fo[o bar]']);
                await timeout(10000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,3)', text: 'fo', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ['fo[o baz]']);
            });
        });
        test('when accepting word by word', async function () {
            // The user types the text as suggested and the provider reports a different suggestion.
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async (ctx) => {
                await setupScenario(ctx, provider);
                await ctx.model.acceptNextWord();
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (["foo[ bar]"]));
                await timeout(10000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: "(1,4)", triggerKind: 0, text: "foo" }]));
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ([]));
                await ctx.model.triggerExplicitly(); // reset to provider truth
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (["foo[ baz]"]));
            });
        });
        test('when accepting undo', async function () {
            // The user types the text as suggested and the provider reports a different suggestion.
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async (ctx) => {
                await setupScenario(ctx, provider);
                await ctx.model.acceptNextWord();
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (["foo[ bar]"]));
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ([]));
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: "(1,4)", triggerKind: 0, text: "foo" }]));
                await ctx.editor.getModel().undo();
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (["f[oo bar]"]));
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: "(1,2)", triggerKind: 0, text: "f" }]));
                await ctx.editor.getModel().redo();
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (["foo[ bar]"]));
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: "(1,4)", triggerKind: 0, text: "foo" }]));
            });
        });
        test('Support backward instability', async function () {
            // The user deletes text and the suggestion changes
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
                context.keyboardType('fooba');
                provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 6) });
                model.triggerExplicitly();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,6)', text: 'fooba', triggerKind: 1, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'fooba[r]']);
                provider.setReturnValue({ insertText: 'foobaz', range: new Range(1, 1, 1, 5) });
                context.leftDelete();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,5)', text: 'foob', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), [
                    'foob[ar]',
                    'foob[az]'
                ]);
            });
        });
    });
    test('No race conditions', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('h');
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(1, 1, 1, 2) }, 1000);
            model.triggerExplicitly();
            await timeout(1030);
            context.keyboardType('ello');
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(1, 1, 1, 6) }, 1000);
            // after 20ms: Inline completion provider answers back
            // after 50ms: Debounce is triggered
            await timeout(2000);
            assert.deepStrictEqual(context.getAndClearViewStates(), [
                '',
                'hello[world]',
            ]);
        });
    });
    test('Do not reuse cache from previous session (#132516)', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('hello\n');
            context.cursorLeft();
            context.keyboardType('x');
            context.leftDelete();
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(1, 1, 1, 6) }, 1000);
            await timeout(2000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                {
                    position: '(1,6)',
                    text: 'hello\n',
                    triggerKind: 0,
                }
            ]);
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(2, 1, 2, 6) }, 1000);
            context.cursorDown();
            context.keyboardType('hello');
            await timeout(40);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
            // Update ghost text
            context.keyboardType('w');
            context.leftDelete();
            await timeout(2000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(2,6)', triggerKind: 0, text: 'hello\nhello' },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), [
                '',
                'hello[world]\n',
                'hello\n',
                'hello\nhello[world]',
            ]);
        });
    });
    test('Additional Text Edits', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('buzz\nbaz');
            provider.setReturnValue({
                insertText: 'bazz',
                range: new Range(2, 1, 2, 4),
                additionalTextEdits: [{
                        range: new Range(1, 1, 1, 5),
                        text: 'bla'
                    }],
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: "(2,4)", triggerKind: 1, text: "buzz\nbaz" }]));
            assert.deepStrictEqual(context.getAndClearViewStates(), [
                '',
                'buzz\nbaz[z]',
                'bla\nbazz',
            ]);
        });
    });
});
suite('Multi Cursor Support', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Basic', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('console\nconsole\n');
            editor.setSelections([
                new Selection(1, 1000, 1, 1000),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: 'console.log("hello");',
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello");`,
                `console.log("hello");`,
                ``
            ].join('\n'));
        });
    });
    test('Multi Part', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('console.log()\nconsole.log\n');
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: 'console.log("hello");',
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello");`,
                `console.log("hello");`,
                ``
            ].join('\n'));
        });
    });
    test('Multi Part and Different Cursor Columns', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('console.log()\nconsole.warn\n');
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(2, 14, 2, 14),
            ]);
            provider.setReturnValue({
                insertText: 'console.log("hello");',
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello");`,
                `console.warn("hello");`,
                ``
            ].join('\n'));
        });
    });
    async function acceptNextWord(model, editor, timesToAccept = 1) {
        for (let i = 0; i < timesToAccept; i++) {
            model.triggerExplicitly();
            await timeout(1000);
            await model.acceptNextWord();
        }
    }
    test('Basic Partial Completion', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('let\nlet\n');
            editor.setSelections([
                new Selection(1, 1000, 1, 1000),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: `let a = 'some word'; `,
                range: new Range(1, 1, 1, 1000),
            });
            await acceptNextWord(model, editor, 2);
            assert.deepStrictEqual(editor.getValue(), [
                `let a`,
                `let a`,
                ``
            ].join('\n'));
        });
    });
    test('Partial Multi-Part Completion', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('for ()\nfor \n');
            editor.setSelections([
                new Selection(1, 5, 1, 5),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: `for (let i = 0; i < 10; i++) {`,
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            await acceptNextWord(model, editor, 3);
            assert.deepStrictEqual(editor.getValue(), [
                `for (let i)`,
                `for (let i`,
                ``
            ].join('\n'));
        });
    });
    test('Partial Mutli-Part and Different Cursor Columns Completion', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType(`console.log()\nconsole.warnnnn\n`);
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(2, 16, 2, 16),
            ]);
            provider.setReturnValue({
                insertText: `console.log("hello" + " " + "world");`,
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            await acceptNextWord(model, editor, 4);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello" + )`,
                `console.warnnnn("hello" + `,
                ``
            ].join('\n'));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvdGVzdC9icm93c2VyL2lubGluZUNvbXBsZXRpb25zLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFekQsT0FBTyxFQUFxRCw2QkFBNkIsRUFBRSxnREFBZ0QsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVoSyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFakUsS0FBSyxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRTtJQUNoQyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxLQUFLO1FBQ3ZELE1BQU0sUUFBUSxHQUFHLElBQUksNkJBQTZCLEVBQUUsQ0FBQztRQUNyRCxNQUFNLGdEQUFnRCxDQUFDLEVBQUUsRUFDeEQsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFDaEUsS0FBSyxFQUFFLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRTtZQUNyRCxPQUFPLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzVCLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXBCLGtEQUFrRDtZQUNsRCxNQUFN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