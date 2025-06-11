/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert, { notStrictEqual, strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TerminalCompletionModel } from '../../browser/terminalCompletionModel.js';
import { LineContext } from '../../../../../services/suggest/browser/simpleCompletionModel.js';
import { TerminalCompletionItem, TerminalCompletionItemKind } from '../../browser/terminalCompletionItem.js';
function createItem(options) {
    return new TerminalCompletionItem({
        ...options,
        kind: options.kind ?? TerminalCompletionItemKind.Method,
        label: options.label || 'defaultLabel',
        provider: options.provider || 'defaultProvider',
        replacementIndex: options.replacementIndex || 0,
        replacementLength: options.replacementLength || 1,
    });
}
function createFileItems(...labels) {
    return labels.map(label => createItem({ label, kind: TerminalCompletionItemKind.File }));
}
function createFileItemsModel(...labels) {
    return new TerminalCompletionModel(createFileItems(...labels), new LineContext('', 0));
}
function createFolderItems(...labels) {
    return labels.map(label => createItem({ label, kind: TerminalCompletionItemKind.Folder }));
}
function createFolderItemsModel(...labels) {
    return new TerminalCompletionModel(createFolderItems(...labels), new LineContext('', 0));
}
function assertItems(model, labels) {
    assert.deepStrictEqual(model.items.map(i => i.completion.label), labels);
    assert.strictEqual(model.items.length, labels.length); // sanity check
}
suite('TerminalCompletionModel', function () {
    ensureNoDisposablesAreLeakedInTestSuite();
    let model;
    test('should handle an empty list', function () {
        model = new TerminalCompletionModel([], new LineContext('', 0));
        assert.strictEqual(model.items.length, 0);
    });
    test('should handle a list with one item', function () {
        model = new TerminalCompletionModel([
            createItem({ label: 'a' }),
        ], new LineContext('', 0));
        assert.strictEqual(model.items.length, 1);
        assert.strictEqual(model.items[0].completion.label, 'a');
    });
    test('should sort alphabetically', function () {
        model = new TerminalCompletionModel([
            createItem({ label: 'b' }),
            createItem({ label: 'z' }),
            createItem({ label: 'a' }),
        ], new LineContext('', 0));
        assert.strictEqual(model.items.length, 3);
        assert.strictEqual(model.items[0].completion.label, 'a');
        assert.strictEqual(model.items[1].completion.label, 'b');
        assert.strictEqual(model.items[2].completion.label, 'z');
    });
    test('fuzzy matching', () => {
        const initial = [
            '.\\.eslintrc',
            '.\\resources\\',
            '.\\scripts\\',
            '.\\src\\',
        ];
        const expected = [
            '.\\scripts\\',
            '.\\src\\',
            '.\\.eslintrc',
            '.\\resources\\',
        ];
        model = new TerminalCompletionModel(initial.map(e => (createItem({ label: e }))), new LineContext('s', 0));
        assertItems(model, expected);
    });
    suite('files and folders', () => {
        test('should deprioritize files that start with underscore', function () {
            const initial = ['_a', 'a', 'z'];
            const expected = ['a', 'z', '_a'];
            assertItems(createFileItemsModel(...initial), expected);
            assertItems(createFolderItemsModel(...initial), expected);
        });
        test('should ignore the dot in dotfiles when sorting', function () {
            const initial = ['b', '.a', 'a', '.b'];
            const expected = ['.a', 'a', 'b', '.b'];
            assertItems(createFileItemsModel(...initial), expected);
            assertItems(createFolderItemsModel(...initial), expected);
        });
        test('should handle many files and folders correctly', function () {
            // This is VS Code's root directory with some python items added that have special
            // sorting
            const items = [
                ...createFolderItems('__pycache', '.build', '.configurations', '.devcontainer', '.eslint-plugin-local', '.github', '.profile-oss', '.vscode', '.vscode-test', 'build', 'cli', 'extensions', 'node_modules', 'out', 'remote', 'resources', 'scripts', 'src', 'test'),
                ...createFileItems('__init__.py', '.editorconfig', '.eslint-ignore', '.git-blame-ignore-revs', '.gitattributes', '.gitignore', '.lsifrc.json', '.mailmap', '.mention-bot', '.npmrc', '.nvmrc', '.vscode-test.js', 'cglicenses.json', 'cgmanifest.json', 'CodeQL.yml', 'CONTRIBUTING.md', 'eslint.config.js', 'gulpfile.js', 'LICENSE.txt', 'package-lock.json', 'package.json', 'product.json', 'README.md', 'SECURITY.md', 'ThirdPartyNotices.txt', 'tsfmt.json')
            ];
            const model = new TerminalCompletionModel(items, new LineContext('', 0));
            assertItems(model, [
                '.build',
                'build',
                'cglicenses.json',
                'cgmanifest.json',
                'cli',
                'CodeQL.yml',
                '.configurations',
                'CONTRIBUTING.md',
                '.devcontainer',
                '.editorconfig',
                'eslint.config.js',
                '.eslint-ignore',
                '.eslint-plugin-local',
                'extensions',
                '.gitattributes',
                '.git-blame-ignore-revs',
                '.github',
                '.gitignore',
                'gulpfile.js',
                'LICENSE.txt',
                '.lsifrc.json',
                '.mailmap',
                '.mention-bot',
                'node_modules',
                '.npmrc',
                '.nvmrc',
                'out',
                'package.json',
                'package-lock.json',
                'product.json',
                '.profile-oss',
                'README.md',
                'remote',
                'resources',
                'scripts',
                'SECURITY.md',
                'src',
                'test',
                'ThirdPartyNotices.txt',
                'tsfmt.json',
                '.vscode',
                '.vscode-test',
                '.vscode-test.js',
                '__init__.py',
                '__pycache',
            ]);
        });
    });
    suite('inline completions', () => {
        function createItems(kind) {
            return [
                ...createFolderItems('a', 'c'),
                ...createFileItems('b', 'd'),
                new TerminalCompletionItem({
                    label: 'ab',
                    provider: 'core',
                    replacementIndex: 0,
                    replacementLength: 0,
                    kind
                })
            ];
        }
        suite('InlineSuggestion', () => {
            test('should put on top generally', function () {
                const model = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestion), new LineContext('', 0));
                strictEqual(model.items[0].completion.label, 'ab');
            });
            test('should NOT put on top when there\'s an exact match of another item', function () {
                const model = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestion), new LineContext('a', 0));
                notStrictEqual(model.items[0].completion.label, 'ab');
                strictEqual(model.items[1].completion.label, 'ab');
            });
        });
        suite('InlineSuggestionAlwaysOnTop', () => {
            test('should put on top generally', function () {
                const model = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop), new LineContext('', 0));
                strictEqual(model.items[0].completion.label, 'ab');
            });
            test('should put on top even if there\'s an exact match of another item', function () {
                const model = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop), new LineContext('a', 0));
                strictEqual(model.items[0].completion.label, 'ab');
            });
        });
    });
    suite('lsp priority sorting', () => {
        suite('Sort Python provider items', () => {
            test('Prioritize items with "python" in provider name when inside REPL', () => {
                const items = [
                    createItem({ label: 'b_default_provider', provider: 'defaultProvider' }),
                    createItem({ label: 'a_python_provider', provider: 'ms-python.python' })
                ];
                const model = new TerminalCompletionModel(items, new LineContext('', 0));
                assertItems(model, ['a_python_provider', 'b_default_provider']);
            });
            test('should sort "python" provider items above others', () => {
                const items = [
                    createItem({ label: 'z_default', provider: 'default' }),
                    createItem({ label: 'c_python', provider: 'ms-python.pylance' }),
                    createItem({ label: 'a_default', provider: 'default' }),
                    createItem({ label: 'b_python', provider: 'ms-python.python' })
                ];
                const model = new TerminalCompletionModel(items, new LineContext('', 0));
                assertItems(model, ['b_python', 'c_python', 'a_default', 'z_default']);
            });
            test('InlineSuggestionAlwaysOnTop should still be prioritized over "python" provider', () => {
                const items = [
                    createItem({ label: 'b_python', provider: 'python_provider' }),
                    new TerminalCompletionItem({
                        label: 'a_always_on_top',
                        provider: 'core',
                        replacementIndex: 0,
                        replacementLength: 0,
                        kind: TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop
                    }),
                    createItem({ label: 'c_default', provider: 'default_provider' })
                ];
                const model = new TerminalCompletionModel(items, new LineContext('', 0));
                assertItems(model, ['a_always_on_top', 'b_python', 'c_default']);
            });
        });
    });
    suite('git branch priority sorting', () => {
        test('should prioritize main and master branches for git commands', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'feature-branch' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'master' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'development' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'main' })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('git checkout ', 0));
            assertItems(model, ['main', 'master', 'development', 'feature-branch']);
        });
        test('should prioritize main and master branches for git switch command', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'feature-branch' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'main' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'another-feature' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'master' })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('git switch ', 0));
            assertItems(model, ['main', 'master', 'another-feature', 'feature-branch']);
        });
        test('should not prioritize main and master for non-git commands', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'feature-branch' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'master' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'main' })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('ls ', 0));
            assertItems(model, ['feature-branch', 'main', 'master']);
        });
        test('should handle git commands with leading whitespace', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'feature-branch' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'master' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'main' })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('  git checkout ', 0));
            assertItems(model, ['main', 'master', 'feature-branch']);
        });
        test('should work with complex label objects', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: { label: 'feature-branch', description: 'Feature branch' } }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: { label: 'master', description: 'Master branch' } }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: { label: 'main', description: 'Main branch' } })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('git checkout ', 0));
            assertItems(model, [
                { label: "main", description: "Main branch" },
                { label: "master", description: "Master branch" },
                { label: "feature-branch", description: "Feature branch" },
            ]);
        });
        test('should not prioritize branches with similar names', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'mainline' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'masterpiece' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'main' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'master' })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('git checkout ', 0));
            assertItems(model, ['main', 'master', 'mainline', 'masterpiece']);
        });
        test('should prioritize for git branch -d', () => {
            const items = [
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'main' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'master' }),
                createItem({ kind: TerminalCompletionItemKind.Argument, label: 'dev' })
            ];
            const model = new TerminalCompletionModel(items, new LineContext('git branch -d ', 0));
            assertItems(model, ['main', 'master', 'dev']);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uTW9kZWwudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvdGVzdC9icm93c2VyL3Rlcm1pbmFsQ29tcGxldGlvbk1vZGVsLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxNQUFNLEVBQUUsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQzdELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUMvRixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsMEJBQTBCLEVBQTRCLE1BQU0seUNBQXlDLENBQUM7QUFHdkksU0FBUyxVQUFVLENBQUMsT0FBcUM7SUFDeEQsT0FBTyxJQUFJLHNCQUFzQixDQUFDO1FBQ2pDLEdBQUcsT0FBTztRQUNWLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxJQUFJLDBCQUEwQixDQUFDLE1BQU07UUFDdkQsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLElBQUksY0FBYztRQUN0QyxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVEsSUFBSSxpQkFBaUI7UUFDL0MsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixJQUFJLENBQUM7UUFDL0MsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLGlCQUFpQixJQUFJLENBQUM7S0FDakQsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLEdBQUcsTUFBZ0I7SUFDM0MsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSwwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDMUYsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsR0FBRyxNQUFnQjtJQUNoRCxPQUFPLElBQUksdUJBQXVCLENBQ2pDLGVBQWUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxFQUMxQixJQUFJLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQ3RCLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxHQUFHLE1BQWdCO0lBQzdDLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsMEJBQTBCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLEdBQUcsTUFBZ0I7SUFDbEQsT0FBTyxJQUFJLHVCQUF1QixDQUNqQyxpQkFBaUIsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxFQUM1QixJQUFJLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQ3RCLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxXQUFXLENBQUMsS0FBOEIsRUFBRSxNQUF3QztJQUM1RixNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN6RSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGVBQWU7QUFDdkUsQ0FBQztBQUVELEtBQUssQ0FBQyx5QkFBeUIsRUFBRTtJQUNoQyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksS0FBOEIsQ0FBQztJQUVuQyxJQUFJLENBQUMsNkJBQTZCLEVBQUU7UUFDbkMsS0FBSyxHQUFHLElBQUksdUJBQXVCLENBQUMsRUFBRSxFQUFFLElBQUksV0FBVyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWhFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0MsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsb0NBQW9DLEVBQUU7UUFDMUMsS0FBSyxHQUFHLElBQUksdUJBQXVCLENBQUM7WUFDbkMsVUFBVSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDO1NBQzFCLEVBQUUsSUFBSSxXQUFXLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0IsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMxRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw0QkFBNEIsRUFBRTtRQUNsQyxLQUFLLEdBQUcsSUFBSSx1QkFBdUIsQ0FBQztZQUNuQyxVQUFVLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUM7WUFDMUIsVUFBVSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDO1lBQzFCLFVBQVUsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQztTQUMxQixFQUFFLElBQUksV0FBVyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTNCLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFL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