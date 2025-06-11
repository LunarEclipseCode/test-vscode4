/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as sinon from 'sinon';
import { timeout } from '../../../../../../../base/common/async.js';
import { Schemas } from '../../../../../../../base/common/network.js';
import { assertDefined } from '../../../../../../../base/common/types.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { randomBoolean } from '../../../../../../../base/test/common/testUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../../editor/common/services/model.js';
import { createTextModel } from '../../../../../../../editor/test/common/testTextModel.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { TestInstantiationService } from '../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../../platform/log/common/log.js';
import { IWorkspacesService } from '../../../../../../../platform/workspaces/common/workspaces.js';
import { INSTRUCTION_FILE_EXTENSION, PROMPT_FILE_EXTENSION } from '../../../../common/promptSyntax/config/promptFileLocations.js';
import { INSTRUCTIONS_LANGUAGE_ID, PROMPT_LANGUAGE_ID, PromptsType } from '../../../../common/promptSyntax/promptTypes.js';
import { TextModelPromptParser } from '../../../../common/promptSyntax/parsers/textModelPromptParser.js';
import { PromptsService } from '../../../../common/promptSyntax/service/promptsServiceImpl.js';
import { MockFilesystem } from '../testUtils/mockFilesystem.js';
/**
 * Helper class to assert the properties of a link.
 */
class ExpectedLink {
    constructor(uri, fullRange, linkRange) {
        this.uri = uri;
        this.fullRange = fullRange;
        this.linkRange = linkRange;
    }
    /**
     * Assert a provided link has the same properties as this object.
     */
    assertEqual(link) {
        assert.strictEqual(link.type, 'file', 'Link must have correct type.');
        assert.strictEqual(link.uri.toString(), this.uri.toString(), 'Link must have correct URI.');
        assert(this.fullRange.equalsRange(link.range), `Full range must be '${this.fullRange}', got '${link.range}'.`);
        assertDefined(link.linkRange, 'Link must have a link range.');
        assert(this.linkRange.equalsRange(link.linkRange), `Link range must be '${this.linkRange}', got '${link.linkRange}'.`);
    }
}
/**
 * Asserts that provided links are equal to the expected links.
 * @param links Links to assert.
 * @param expectedLinks Expected links to compare against.
 */
function assertLinks(links, expectedLinks) {
    for (let i = 0; i < links.length; i++) {
        try {
            expectedLinks[i].assertEqual(links[i]);
        }
        catch (error) {
            throw new Error(`link#${i}: ${error}`);
        }
    }
    assert.strictEqual(links.length, expectedLinks.length, `Links count must be correct.`);
}
suite('PromptsService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let service;
    let instaService;
    setup(async () => {
        instaService = disposables.add(new TestInstantiationService());
        instaService.stub(ILogService, new NullLogService());
        instaService.stub(IWorkspacesService, {});
        instaService.stub(IConfigurationService, new TestConfigurationService());
        const fileService = disposables.add(instaService.createInstance(FileService));
        instaService.stub(IFileService, fileService);
        instaService.stub(IModelService, { getModel() { return null; } });
        instaService.stub(ILanguageService, {
            guessLanguageIdByFilepathOrFirstLine(uri) {
                if (uri.path.endsWith(PROMPT_FILE_EXTENSION)) {
                    return PROMPT_LANGUAGE_ID;
                }
                if (uri.path.endsWith(INSTRUCTION_FILE_EXTENSION)) {
                    return INSTRUCTIONS_LANGUAGE_ID;
                }
                return 'plaintext';
            }
        });
        const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        service = disposables.add(instaService.createInstance(PromptsService));
    });
    suite('getParserFor', () => {
        test('provides cached parser instance', async () => {
            // both languages must yield the same result
            const languageId = (randomBoolean())
                ? PROMPT_LANGUAGE_ID
                : INSTRUCTIONS_LANGUAGE_ID;
            /**
             * Create a text model, get a parser for it, and perform basic assertions.
             */
            const model1 = disposables.add(createTextModel('test1\n\t#file:./file.md\n\n\n   [bin file](/root/tmp.bin)\t\n', languageId, undefined, URI.file('/Users/vscode/repos/test/file1.txt')));
            const parser1 = service.getSyntaxParserFor(model1);
            assert.strictEqual(parser1.uri.toString(), model1.uri.toString(), 'Must create parser1 with the correct URI.');
            assert(!parser1.isDisposed, 'Parser1 must not be disposed.');
            assert(parser1 instanceof TextModelPromptParser, 'Parser1 must be an instance of TextModelPromptParser.');
            /**
             * Validate that all links of the model are correctly parsed.
             */
            await parser1.settled();
            assertLinks(parser1.allReferences, [
                new ExpectedLink(URI.file('/Users/vscode/repos/test/file.md'), new Range(2, 2, 2, 2 + 15), new Range(2, 8, 2, 8 + 9)),
                new ExpectedLink(URI.file('/root/tmp.bin'), new Range(5, 4, 5, 4 + 25), new Range(5, 15, 5, 15 + 13)),
            ]);
            // wait for some random amount of time
            await timeout(5);
            /**
             * Next, get parser for the same exact model and
             * validate that the same cached object is returned.
             */
            // get the same parser again, the call must return the same object
            const parser1_1 = service.getSyntaxParserFor(model1);
            assert.strictEqual(parser1, parser1_1, 'Must return the same parser object.');
            assert.strictEqual(parser1_1.uri.toString(), model1.uri.toString(), 'Must create parser1_1 with the correct URI.');
            /**
             * Get parser for a different model and perform basic assertions.
             */
            const model2 = disposables.add(createTextModel('some text #file:/absolute/path.txt  \t\ntest-text2', languageId, undefined, URI.file('/Users/vscode/repos/test/some-folder/file.md')));
            // wait for some random amount of time
            await timeout(5);
            const parser2 = service.getSyntaxParserFor(model2);
            assert.strictEqual(parser2.uri.toString(), model2.uri.toString(), 'Must create parser2 with the correct URI.');
            assert(!parser2.isDisposed, 'Parser2 must not be disposed.');
            assert(parser2 instanceof TextModelPromptParser, 'Parser2 must be an instance of TextModelPromptParser.');
            assert(!parser2.isDisposed, 'Parser2 must not be disposed.');
            assert(!parser1.isDisposed, 'Parser1 must not be disposed.');
            assert(!parser1_1.isDisposed, 'Parser1_1 must not be disposed.');
            /**
             * Validate that all links of the model 2 are correctly parsed.
             */
            await parser2.settled();
            assert.notStrictEqual(parser1.uri.toString(), parser2.uri.toString(), 'Parser2 must have its own URI.');
            assertLinks(parser2.allReferences, [
                new ExpectedLink(URI.file('/absolute/path.txt'), new Range(1, 11, 1, 11 + 24), new Range(1, 17, 1, 17 + 18)),
            ]);
            /**
             * Validate the first parser was not affected by the presence
             * of the second parser.
             */
            await parser1_1.settled();
            // parser1_1 has the same exact links as before
            assertLinks(parser1_1.allReferences, [
                new ExpectedLink(URI.file('/Users/vscode/repos/test/file.md'), new Range(2, 2, 2, 2 + 15), new Range(2, 8, 2, 8 + 9)),
                new ExpectedLink(URI.file('/root/tmp.bin'), new Range(5, 4, 5, 4 + 25), new Range(5, 15, 5, 15 + 13)),
            ]);
            // wait for some random amount of time
            await timeout(5);
            /**
             * Dispose the first parser, perform basic validations, and confirm
             * that the second parser is not affected by the disposal of the first one.
             */
            parser1.dispose();
            assert(parser1.isDisposed, 'Parser1 must be disposed.');
            assert(parser1_1.isDisposed, 'Parser1_1 must be disposed.');
            assert(!parser2.isDisposed, 'Parser2 must not be disposed.');
            /**
             * Get parser for the first model again. Confirm that we get
             * a new non-disposed parser object back with correct properties.
             */
            const parser1_2 = service.getSyntaxParserFor(model1);
            assert(!parser1_2.isDisposed, 'Parser1_2 must not be disposed.');
            assert.notStrictEqual(parser1_2, parser1, 'Must create a new parser object for the model1.');
            assert.strictEqual(parser1_2.uri.toString(), model1.uri.toString(), 'Must create parser1_2 with the correct URI.');
            /**
             * Validate that the contents of the second parser did not change.
             */
            await parser1_2.settled();
            // parser1_2 must have the same exact links as before
            assertLinks(parser1_2.allReferences, [
                new ExpectedLink(URI.file('/Users/vscode/repos/test/file.md'), new Range(2, 2, 2, 2 + 15), new Range(2, 8, 2, 8 + 9)),
                new ExpectedLink(URI.file('/root/tmp.bin'), new Range(5, 4, 5, 4 + 25), new Range(5, 15, 5, 15 + 13)),
            ]);
            // wait for some random amount of time
            await timeout(5);
            /**
             * This time dispose model of the second parser instead of
             * the parser itself. Validate that the parser is disposed too, but
             * the newly created first parser is not affected.
             */
            // dispose the `model` of the second parser now
            model2.dispose();
            // assert that the parser is also disposed
            assert(parser2.isDisposed, 'Parser2 must be disposed.');
            // sanity check that the other parser is not affected
            assert(!parser1_2.isDisposed, 'Parser1_2 must not be disposed.');
            /**
             * Create a new second parser with new model - we cannot use
             * the old one because it was disposed. This new model also has
             * a different second link.
             */
            // we cannot use the same model since it was already disposed
            const model2_1 = disposables.add(createTextModel('some text #file:/absolute/path.txt  \n [caption](.copilot/prompts/test.prompt.md)\t\n\t\n more text', languageId, undefined, URI.file('/Users/vscode/repos/test/some-folder/file.md')));
            const parser2_1 = service.getSyntaxParserFor(model2_1);
            assert(!parser2_1.isDisposed, 'Parser2_1 must not be disposed.');
            assert.notStrictEqual(parser2_1, parser2, 'Parser2_1 must be a new object.');
            assert.strictEqual(parser2_1.uri.toString(), model2.uri.toString(), 'Must create parser2_1 with the correct URI.');
            /**
             * Validate that new model2 contents are parsed correctly.
             */
            await parser2_1.settled();
            // parser2_1 must have 2 links now
            assertLinks(parser2_1.allReferences, [
                // the first link didn't change
                new ExpectedLink(URI.file('/absolute/path.txt'), new Range(1, 11, 1, 11 + 24), new Range(1, 17, 1, 17 + 18)),
                // the second link is new
                new ExpectedLink(URI.file('/Users/vscode/repos/test/some-folder/.copilot/prompts/test.prompt.md'), new Range(2, 2, 2, 2 + 42), new Range(2, 12, 2, 12 + 31)),
            ]);
        });
        test('auto-updated on model changes', async () => {
            const langId = 'bazLang';
            const model = disposables.add(createTextModel(' \t #file:../file.md\ntest1\n\t\n  [another file](/Users/root/tmp/file2.txt)\t\n', langId, undefined, URI.file('/repos/test/file1.txt')));
            const parser = service.getSyntaxParserFor(model);
            // sanity checks
            assert(parser.isDisposed === false, 'Parser must not be disposed.');
            assert(parser instanceof TextModelPromptParser, 'Parser must be an instance of TextModelPromptParser.');
            await parser.settled();
            assertLinks(parser.allReferences, [
                new ExpectedLink(URI.file('/repos/file.md'), new Range(1, 4, 1, 4 + 16), new Range(1, 10, 1, 10 + 10)),
                new ExpectedLink(URI.file('/Users/root/tmp/file2.txt'), new Range(4, 3, 4, 3 + 41), new Range(4, 18, 4, 18 + 25)),
            ]);
            model.applyEdits([
                {
                    range: new Range(4, 18, 4, 18 + 25),
                    text: '/Users/root/tmp/file3.txt',
                },
            ]);
            await parser.settled();
            assertLinks(parser.allReferences, [
                // link1 didn't change
                new ExpectedLink(URI.file('/repos/file.md'), new Range(1, 4, 1, 4 + 16), new Range(1, 10, 1, 10 + 10)),
                // link2 changed in the file name only
                new ExpectedLink(URI.file('/Users/root/tmp/file3.txt'), new Range(4, 3, 4, 3 + 41), new Range(4, 18, 4, 18 + 25)),
            ]);
        });
        test('throws if a disposed model provided', async function () {
            const model = disposables.add(createTextModel('test1\ntest2\n\ntest3\t\n', 'barLang', undefined, URI.parse('./github/prompts/file.prompt.md')));
            // dispose the model before using it
            model.dispose();
            assert.throws(() => {
                service.getSyntaxParserFor(model);
            }, 'Cannot create a prompt parser for a disposed model.');
        });
    });
    suite('getAllMetadata', () => {
        test('explicit', async function () {
            const rootFolderName = 'resolves-nested-file-references';
            const rootFolder = `/${rootFolderName}`;
            const rootFileName = 'file2.prompt.md';
            const rootFolderUri = URI.file(rootFolder);
            const rootFileUri = URI.joinPath(rootFolderUri, rootFileName);
            await (instaService.createInstance(MockFilesystem, 
            // the file structure to be created on the disk for the test
            [{
                    name: rootFolderName,
                    children: [
                        {
                            name: 'file1.prompt.md',
                            contents: [
                                '## Some Header',
                                'some contents',
                                ' ',
                            ],
                        },
                        {
                            name: rootFileName,
                            contents: [
                                '---',
                                'description: \'Root prompt description.\'',
                                'tools: [\'my-tool1\', , true]',
                                'mode: "agent" ',
                                '---',
                                '## Files',
                                '\t- this file #file:folder1/file3.prompt.md ',
                                '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                ' ',
                            ],
                        },
                        {
                            name: 'folder1',
                            children: [
                                {
                                    name: 'file3.prompt.md',
                                    contents: [
                                        '---',
                                        'tools: [ false, \'my-tool1\' , ]',
                                        'mode: \'edit\'',
                                        '---',
                                        '',
                                        '[](./some-other-folder/non-existing-folder)',
                                        `\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.instructions.md contents`,
                                        ' some more\t content',
                                    ],
                                },
                                {
                                    name: 'some-other-folder',
                                    children: [
                                        {
                                            name: 'file4.prompt.md',
                                            contents: [
                                                '---',
                                                'tools: [\'my-tool1\', "my-tool2", true, , ]',
                                                'something: true',
                                                'mode: \'ask\'\t',
                                                'description: "File 4 splendid description."',
                                                '---',
                                                'this file has a non-existing #file:./some-non-existing/file.prompt.md\t\treference',
                                                '',
                                                '',
                                                'and some',
                                                ' non-prompt #file:./some-non-prompt-file.md\t\t \t[](../../folder1/)\t',
                                            ],
                                        },
                                        {
                                            name: 'file.txt',
                                            contents: [
                                                '---',
                                                'description: "Non-prompt file description".',
                                                'tools: ["my-tool-24"]',
                                                '---',
                                            ],
                                        },
                                        {
                                            name: 'yetAnotherFolder🤭',
                                            children: [
                                                {
                                                    name: 'another-file.instructions.md',
                                                    contents: [
                                                        '---',
                                                        'description: "Another file description."',
                                                        'tools: [\'my-tool3\', false, "my-tool2" ]',
                                                        'applyTo: "**/*.tsx"',
                                                        '---',
                                                        `[](${rootFolder}/folder1/some-other-folder)`,
                                                        'another-file.instructions.md contents\t [#file:file.txt](../file.txt)',
                                                    ],
                                                },
                                                {
                                                    name: 'one_more_file_just_in_case.prompt.md',
                                                    contents: 'one_more_file_just_in_case.prompt.md contents',
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }])).mock();
            const metadata = await service
                .getAllMetadata([rootFileUri]);
            assert.deepStrictEqual(metadata, [{
                    uri: rootFileUri,
                    metadata: {
                        promptType: PromptsType.prompt,
                        description: 'Root prompt description.',
                        tools: ['my-tool1'],
                        mode: 'agent',
                    },
                    children: [
                        {
                            uri: URI.joinPath(rootFolderUri, 'folder1/file3.prompt.md'),
                            metadata: {
                                promptType: PromptsType.prompt,
                                tools: ['my-tool1'],
                                mode: 'agent',
                            },
                            children: [
                                {
                                    uri: URI.joinPath(rootFolderUri, 'folder1/some-other-folder/yetAnotherFolder🤭/another-file.instructions.md'),
                                    metadata: {
                                        promptType: PromptsType.instructions,
                                        description: 'Another file description.',
                                        applyTo: '**/*.tsx',
                                    },
                                    children: undefined,
                                },
                            ],
                        },
                        {
                            uri: URI.joinPath(rootFolderUri, 'folder1/some-other-folder/file4.prompt.md'),
                            metadata: {
                                promptType: PromptsType.prompt,
                                tools: ['my-tool1', 'my-tool2'],
                                description: 'File 4 splendid description.',
                                mode: 'agent',
                            },
                            children: undefined,
                        }
                    ],
                }]);
        });
    });
    suite('findInstructionFilesFor', () => {
        teardown(() => {
            sinon.restore();
        });
        test('finds correct instruction files', async () => {
            const rootFolderName = 'finds-instruction-files';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            const userPromptsFolderName = '/tmp/user-data/prompts';
            const userPromptsFolderUri = URI.file(userPromptsFolderName);
            sinon.stub(service, 'listPromptFiles')
                .returns(Promise.resolve([
                // local instructions
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file3.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file4.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                // user instructions
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file10.instructions.md'),
                    storage: 'user',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file11.instructions.md'),
                    storage: 'user',
                    type: PromptsType.instructions,
                },
            ]));
            // mock current workspace file structure
            await (instaService.createInstance(MockFilesystem, [{
                    name: rootFolderName,
                    children: [
                        {
                            name: 'file1.prompt.md',
                            contents: [
                                '## Some Header',
                                'some contents',
                                ' ',
                            ],
                        },
                        {
                            name: '.github/prompts',
                            children: [
                                {
                                    name: 'file1.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 1.\'',
                                        'applyTo: "**/*.tsx"',
                                        '---',
                                        'Some instructions 1 contents.',
                                    ],
                                },
                                {
                                    name: 'file2.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 2.\'',
                                        'applyTo: "**/folder1/*.tsx"',
                                        '---',
                                        'Some instructions 2 contents.',
                                    ],
                                },
                                {
                                    name: 'file3.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 3.\'',
                                        'applyTo: "**/folder2/*.tsx"',
                                        '---',
                                        'Some instructions 3 contents.',
                                    ],
                                },
                                {
                                    name: 'file4.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 4.\'',
                                        'applyTo: "src/build/*.tsx"',
                                        '---',
                                        'Some instructions 4 contents.',
                                    ],
                                },
                                {
                                    name: 'file5.prompt.md',
                                    contents: [
                                        '---',
                                        'description: \'Prompt file 5.\'',
                                        '---',
                                        'Some prompt 5 contents.',
                                    ],
                                },
                            ],
                        },
                        {
                            name: 'folder1',
                            children: [
                                {
                                    name: 'main.tsx',
                                    contents: 'console.log("Haalou!")',
                                },
                            ],
                        },
                    ],
                }])).mock();
            // mock user data instructions
            await (instaService.createInstance(MockFilesystem, [
                {
                    name: userPromptsFolderName,
                    children: [
                        {
                            name: 'file10.instructions.md',
                            contents: [
                                '---',
                                'description: \'Instructions file 10.\'',
                                'applyTo: "**/folder1/*.tsx"',
                                '---',
                                'Some instructions 10 contents.',
                            ],
                        },
                        {
                            name: 'file11.instructions.md',
                            contents: [
                                '---',
                                'description: \'Instructions file 11.\'',
                                'applyTo: "**/folder1/*.py"',
                                '---',
                                'Some instructions 11 contents.',
                            ],
                        },
                        {
                            name: 'file12.prompt.md',
                            contents: [
                                '---',
                                'description: \'Prompt file 12.\'',
                                '---',
                                'Some prompt 12 contents.',
                            ],
                        },
                    ],
                }
            ])).mock();
            const instructions = await service
                .findInstructionFilesFor([
                URI.joinPath(rootFolderUri, 'folder1/main.tsx'),
            ]);
            assert.deepStrictEqual(instructions.map(i => i.path), [
                // local instructions
                URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md').path,
                URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md').path,
                // user instructions
                URI.joinPath(userPromptsFolderUri, 'file10.instructions.md').path,
            ], 'Must find correct instruction files.');
        });
        test('does not have duplicates', async () => {
            const rootFolderName = 'finds-instruction-files-without-duplicates';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            const userPromptsFolderName = '/tmp/user-data/prompts';
            const userPromptsFolderUri = URI.file(userPromptsFolderName);
            sinon.stub(service, 'listPromptFiles')
                .returns(Promise.resolve([
                // local instructions
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file3.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file4.instructions.md'),
                    storage: 'local',
                    type: PromptsType.instructions,
                },
                // user instructions
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file10.instructions.md'),
                    storage: 'user',
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file11.instructions.md'),
                    storage: 'user',
                    type: PromptsType.instructions,
                },
            ]));
            // mock current workspace file structure
            await (instaService.createInstance(MockFilesystem, [{
                    name: rootFolderName,
                    children: [
                        {
                            name: 'file1.prompt.md',
                            contents: [
                                '## Some Header',
                                'some contents',
                                ' ',
                            ],
                        },
                        {
                            name: '.github/prompts',
                            children: [
                                {
                                    name: 'file1.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 1.\'',
                                        'applyTo: "**/*.tsx"',
                                        '---',
                                        'Some instructions 1 contents.',
                                    ],
                                },
                                {
                                    name: 'file2.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 2.\'',
                                        'applyTo: "**/folder1/*.tsx"',
                                        '---',
                                        'Some instructions 2 contents. [](./file1.instructions.md)',
                                    ],
                                },
                                {
                                    name: 'file3.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 3.\'',
                                        'applyTo: "**/folder2/*.tsx"',
                                        '---',
                                        'Some instructions 3 contents.',
                                    ],
                                },
                                {
                                    name: 'file4.instructions.md',
                                    contents: [
                                        '---',
                                        'description: \'Instructions file 4.\'',
                                        'applyTo: "src/build/*.tsx"',
                                        '---',
                                        '[](./file3.instructions.md) Some instructions 4 contents.',
                                    ],
                                },
                                {
                                    name: 'file5.prompt.md',
                                    contents: [
                                        '---',
                                        'description: \'Prompt file 5.\'',
                                        '---',
                                        'Some prompt 5 contents.',
                                    ],
                                },
                            ],
                        },
                        {
                            name: 'folder1',
                            children: [
                                {
                                    name: 'main.tsx',
                                    contents: 'console.log("Haalou!")',
                                },
                            ],
                        },
                    ],
                }])).mock();
            // mock user data instructions
            await (instaService.createInstance(MockFilesystem, [
                {
                    name: userPromptsFolderName,
                    children: [
                        {
                            name: 'file10.instructions.md',
                            contents: [
                                '---',
                                'description: \'Instructions file 10.\'',
                                'applyTo: "**/folder1/*.tsx"',
                                '---',
                                'Some instructions 10 contents.',
                            ],
                        },
                        {
                            name: 'file11.instructions.md',
                            contents: [
                                '---',
                                'description: \'Instructions file 11.\'',
                                'applyTo: "**/folder1/*.py"',
                                '---',
                                'Some instructions 11 contents.',
                            ],
                        },
                        {
                            name: 'file12.prompt.md',
                            contents: [
                                '---',
                                'description: \'Prompt file 12.\'',
                                '---',
                                'Some prompt 12 contents.',
                            ],
                        },
                    ],
                }
            ])).mock();
            const instructions = await service
                .findInstructionFilesFor([
                URI.joinPath(rootFolderUri, 'folder1/main.tsx'),
                URI.joinPath(rootFolderUri, 'folder1/index.tsx'),
                URI.joinPath(rootFolderUri, 'folder1/constants.tsx'),
            ]);
            assert.deepStrictEqual(instructions.map(i => i.path), [
                // local instructions
                URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md').path,
                URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md').path,
                // user instructions
                URI.joinPath(userPromptsFolderUri, 'file10.instructions.md').path,
            ], 'Must find correct instruction files.');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0c1NlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9wcm9tcHRTeW50YXgvc2VydmljZS9wcm9tcHRzU2VydmljZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUMvQixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM1RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDckYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHFGQUFxRixDQUFDO0FBQy9ILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDeEYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFDdEgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0scUZBQXFGLENBQUM7QUFDL0gsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNuRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNsSSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsa0JBQWtCLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDM0gsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFFekcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRS9GLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVoRTs7R0FFRztBQUNILE1BQU0sWUFBWTtJQUNqQixZQUNpQixHQUFRLEVBQ1IsU0FBZ0IsRUFDaEIsU0FBZ0I7UUFGaEIsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUNSLGNBQVMsR0FBVCxTQUFTLENBQU87UUFDaEIsY0FBUyxHQUFULFNBQVMsQ0FBTztJQUM3QixDQUFDO0lBRUw7O09BRUc7SUFDSSxXQUFXLENBQUMsSUFBMEI7UUFDNUMsTUFBTSxDQUFDLFdBQVcsQ0FDakIsSUFBSSxDQUFDLElBQUksRUFDVCxNQUFNLEVBQ04sOEJBQThCLENBQzlCLENBQUM7UUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUNuQixJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUNuQiw2QkFBNkIsQ0FDN0IsQ0FBQztRQUVGLE1BQU0sQ0FDTCxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQ3RDLHVCQUF1QixJQUFJLENBQUMsU0FBUyxXQUFXLElBQUksQ0FBQyxLQUFLLElBQUksQ0FDOUQsQ0FBQztRQUVGLGFBQWEsQ0FDWixJQUFJLENBQUMsU0FBUyxFQUNkLDhCQUE4QixDQUM5QixDQUFDO1FBRUYsTUFBTSxDQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFDMUMsdUJBQXVCLElBQUksQ0FBQyxTQUFTLFdBQVcsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUNsRSxDQUFDO0lBQ0gsQ0FBQztDQUNEO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsV0FBVyxDQUNuQixLQUFzQyxFQUN0QyxhQUFzQztJQUV0QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQztZQUNKLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7SUFDRixDQUFDO0lBRUQsTUFBTSxDQUFDLFdBQVcsQ0FDakIsS0FBSyxDQUFDLE1BQU0sRUFDWixhQUFhLENBQUMsTUFBTSxFQUNwQiw4QkFBOEIsQ0FDOUIsQ0FBQztBQUNILENBQUM7QUFFRCxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFO0lBQzVCLE1BQU0sV0FBVyxHQUFHLHVDQUF1QyxFQUFFLENBQUM7SUFFOUQsSUFBSSxPQUF3QixDQUFDO0lBQzdCLElBQUksWUFBc0MsQ0FBQztJQUUzQyxLQUFLLENBQUMsS0FBSyxJQUFJLEVBQUU7UUFDaEIsWUFBWSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7UUFDL0QsWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxjQUFjLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELFlBQVksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDMUMsWUFBWSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLHdCQUF3QixFQUFFLENBQUMsQ0FBQztRQUV6RSxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUM5RSxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUM3QyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLFFBQVEsS0FBSyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEUsWUFBWSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUNuQyxvQ0FBb0MsQ0FBQyxHQUFRO2dCQUM1QyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQztvQkFDOUMsT0FBTyxrQkFBa0IsQ0FBQztnQkFDM0IsQ0FBQztnQkFFRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLDBCQUEwQixDQUFDLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyx3QkFBd0IsQ0FBQztnQkFDakMsQ0FBQztnQkFFRCxPQUFPLFdBQVcsQ0FBQztZQUNwQixDQUFDO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxrQkFBa0IsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBRWhGLE9BQU8sR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUN4RSxDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO1FBQzFCLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNsRCw0Q0FBNEM7WUFDNUMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDbkMsQ0FBQyxDQUFDLGtCQUFrQjtnQkFDcEIsQ0FBQyxDQUFDLHdCQUF3QixDQUFDO1lBRTVCOztlQUVHO1lBRUgsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQzdDLGdFQUFnRSxFQUNoRSxVQUFVLEVBQ1YsU0FBUyxFQUNULEdBQUcsQ0FBQyxJQUFJLENBQUMsb0NBQW9DLENBQUMsQ0FDOUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ25ELE1BQU0sQ0FBQyxXQUFXLENBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQ3RCLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQ3JCLDJDQUEyQyxDQUMzQyxDQUFDO1lBRUYsTUFBTSxDQUNMLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFDbkIsK0JBQStCLENBQy9CLENBQUM7WUFFRixNQUFNLENBQ0wsT0FBTyxZQUFZLHFCQUFxQixFQUN4Qyx1REFBdUQsQ0FDdkQsQ0FBQztZQUVGOztlQUVHO1lBRUgsTUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDeEIsV0FBVyxDQUNWLE9BQU8sQ0FBQyxhQUFhLEVBQ3JCO2dCQUNDLElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLENBQUMsRUFDNUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUMxQixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQ3pCO2dCQUNELElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQ3pCLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsRUFDMUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUM1QjthQUNELENBQ0QsQ0FBQztZQUVGLHNDQUFzQztZQUN0QyxNQUFNLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVqQjs7O2VBR0c7WUFFSCxrRUFBa0U7WUFDbEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JELE1BQU0sQ0FBQyxXQUFXLENBQ2pCLE9BQU8sRUFDUCxTQUFTLEVBQ1QscUNBQXFDLENBQ3JDLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUN4QixNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUNyQiw2Q0FBNkMsQ0FDN0MsQ0FBQztZQUVGOztlQUVHO1lBRUgsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQzdDLG9EQUFvRCxFQUNwRCxVQUFVLEVBQ1YsU0FBUyxFQUNULEdBQUcsQ0FBQyxJQUFJLENBQUMsOENBQThDLENBQUMsQ0FDeEQsQ0FBQyxDQUFDO1lBRUgsc0NBQXNDO1lBQ3RDLE1BQU0sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWpCLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVuRCxNQUFNLENBQUMsV0FBVyxDQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUN0QixNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUNyQiwyQ0FBMkMsQ0FDM0MsQ0FBQztZQUVGLE1BQU0sQ0FDTCxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQ25CLCtCQUErQixDQUMvQixDQUFDO1lBRUYsTUFBTSxDQUNMLE9BQU8sWUFBWSxxQkFBcUIsRUFDeEMsdURBQXVELENBQ3ZELENBQUM7WUFFRixNQUFNLENBQ0wsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUNuQiwrQkFBK0IsQ0FDL0IsQ0FBQztZQUVGLE1BQU0sQ0FDTCxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQ25CLCtCQUErQixDQUMvQixDQUFDO1lBRUYsTUFBTSxDQUNMLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFDckIsaUNBQWlDLENBQ2pDLENBQUM7WUFFRjs7ZUFFRztZQUVILE1BQU0sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBRXhCLE1BQU0sQ0FBQyxjQUFjLENBQ3BCLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQ3RCLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQ3RCLGdDQUFnQyxDQUNoQyxDQUFDO1lBRUYsV0FBVyxDQUNWLE9BQU8sQ0FBQyxhQUFhLEVBQ3JCO2dCQUNDLElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFDOUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUM1QixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQzVCO2FBQ0QsQ0FDRCxDQUFDO1lBRUY7OztlQUdHO1lBRUgsTUFBTSxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFMUIsK0NBQStDO1lBQy9DLFdBQVcsQ0FDVixTQUFTLENBQUMsYUFBYSxFQUN2QjtnQkFDQyxJQUFJLFlBQVksQ0FDZixHQUFHLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLEVBQzVDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsRUFDMUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUN6QjtnQkFDRCxJQUFJLFlBQVksQ0FDZixHQUFHLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUN6QixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQzFCLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FDNUI7YUFDRCxDQUNELENBQUM7WUFFRixzQ0FBc0M7WUFDdEMsTUFBTSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFakI7OztlQUdHO1lBQ0gsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBRWxCLE1BQU0sQ0FDTCxPQUFPLENBQUMsVUFBVSxFQUNsQiwyQkFBMkIsQ0FDM0IsQ0FBQztZQUVGLE1BQU0sQ0FDTCxTQUFTLENBQUMsVUFBVSxFQUNwQiw2QkFBNkIsQ0FDN0IsQ0FBQztZQUVGLE1BQU0sQ0FDTCxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQ25CLCtCQUErQixDQUMvQixDQUFDO1lBR0Y7OztlQUdHO1lBRUgsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXJELE1BQU0sQ0FDTCxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQ3JCLGlDQUFpQyxDQUNqQyxDQUFDO1lBRUYsTUFBTSxDQUFDLGNBQWMsQ0FDcEIsU0FBUyxFQUNULE9BQU8sRUFDUCxpREFBaUQsQ0FDakQsQ0FBQztZQUVGLE1BQU0sQ0FBQyxXQUFXLENBQ2pCLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQ3hCLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQ3JCLDZDQUE2QyxDQUM3QyxDQUFDO1lBRUY7O2VBRUc7WUFFSCxNQUFNLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUUxQixxREFBcUQ7WUFDckQsV0FBVyxDQUNWLFNBQVMsQ0FBQyxhQUFhLEVBQ3ZCO2dCQUNDLElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLENBQUMsRUFDNUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUMxQixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQ3pCO2dCQUNELElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQ3pCLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsRUFDMUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUM1QjthQUNELENBQ0QsQ0FBQztZQUVGLHNDQUFzQztZQUN0QyxNQUFNLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVqQjs7OztlQUlHO1lBRUgsK0NBQStDO1lBQy9DLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUVqQiwwQ0FBMEM7WUFDMUMsTUFBTSxDQUNMLE9BQU8sQ0FBQyxVQUFVLEVBQ2xCLDJCQUEyQixDQUMzQixDQUFDO1lBRUYscURBQXFEO1lBQ3JELE1BQU0sQ0FDTCxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQ3JCLGlDQUFpQyxDQUNqQyxDQUFDO1lBRUY7Ozs7ZUFJRztZQUVILDZEQUE2RDtZQUM3RCxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FDL0MscUdBQXFHLEVBQ3JHLFVBQVUsRUFDVixTQUFTLEVBQ1QsR0FBRyxDQUFDLElBQUksQ0FBQyw4Q0FBOEMsQ0FBQyxDQUN4RCxDQUFDLENBQUM7WUFDSCxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFdkQsTUFBTSxDQUNMLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFDckIsaUNBQWlDLENBQ2pDLENBQUM7WUFFRixNQUFNLENBQUMsY0FBYyxDQUNwQixTQUFTLEVBQ1QsT0FBTyxFQUNQLGlDQUFpQyxDQUNqQyxDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFDeEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFDckIsNkNBQTZDLENBQzdDLENBQUM7WUFFRjs7ZUFFRztZQUVILE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBRTFCLGtDQUFrQztZQUNsQyxXQUFXLENBQ1YsU0FBUyxDQUFDLGFBQWEsRUFDdkI7Z0JBQ0MsK0JBQStCO2dCQUMvQixJQUFJLFlBQVksQ0FDZixHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEVBQzlCLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFDNUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUM1QjtnQkFDRCx5QkFBeUI7Z0JBQ3pCLElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsc0VBQXNFLENBQUMsRUFDaEYsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUMxQixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQzVCO2FBQ0QsQ0FDRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsK0JBQStCLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDaEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDO1lBRXpCLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUM1QyxrRkFBa0YsRUFDbEYsTUFBTSxFQUNOLFNBQVMsRUFDVCxHQUFHLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQ2pDLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUVqRCxnQkFBZ0I7WUFDaEIsTUFBTSxDQUNMLE1BQU0sQ0FBQyxVQUFVLEtBQUssS0FBSyxFQUMzQiw4QkFBOEIsQ0FDOUIsQ0FBQztZQUNGLE1BQU0sQ0FDTCxNQUFNLFlBQVkscUJBQXFCLEVBQ3ZDLHNEQUFzRCxDQUN0RCxDQUFDO1lBRUYsTUFBTSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFdkIsV0FBVyxDQUNWLE1BQU0sQ0FBQyxhQUFhLEVBQ3BCO2dCQUNDLElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFDMUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUMxQixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQzVCO2dCQUNELElBQUksWUFBWSxDQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsRUFDckMsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUMxQixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQzVCO2FBQ0QsQ0FDRCxDQUFDO1lBRUYsS0FBSyxDQUFDLFVBQVUsQ0FBQztnQkFDaEI7b0JBQ0MsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUM7b0JBQ25DLElBQUksRUFBRSwyQkFBMkI7aUJBQ2pDO2FBQ0QsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFdkIsV0FBVyxDQUNWLE1BQU0sQ0FBQyxhQUFhLEVBQ3BCO2dCQUNDLHNCQUFzQjtnQkFDdEIsSUFBSSxZQUFZLENBQ2YsR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUMxQixJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQzFCLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FDNUI7Z0JBQ0Qsc0NBQXNDO2dCQUN0QyxJQUFJLFlBQVksQ0FDZixHQUFHLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLEVBQ3JDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsRUFDMUIsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUM1QjthQUNELENBQ0QsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHFDQUFxQyxFQUFFLEtBQUs7WUFDaEQsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQzVDLDJCQUEyQixFQUMzQixTQUFTLEVBQ1QsU0FBUyxFQUNULEdBQUcsQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FDNUMsQ0FBQyxDQUFDO1lBRUgsb0NBQW9DO1lBQ3BDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUVoQixNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRTtnQkFDbEIsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25DLENBQUMsRUFBRSxxREFBcUQsQ0FBQyxDQUFDO1FBQzNELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFO1FBQzVCLElBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSztZQUNyQixNQUFNLGNBQWMsR0FBRyxpQ0FBaUMsQ0FBQztZQUN6RCxNQUFNLFVBQVUsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO1lBRXhDLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDO1lBRXZDLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDM0MsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFFOUQsTUFBTSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsY0FBYztZQUNoRCw0REFBNEQ7WUFDNUQsQ0FBQztvQkFDQSxJQUFJLEVBQUUsY0FBYztvQkFDcEIsUUFBUSxFQUFFO3dCQUNUOzRCQUNDLElBQUksRUFBRSxpQkFBaUI7NEJBQ3ZCLFFBQVEsRUFBRTtnQ0FDVCxnQkFBZ0I7Z0NBQ2hCLGVBQWU7Z0NBQ2YsR0FBRzs2QkFDSDt5QkFDRDt3QkFDRDs0QkFDQyxJQUFJLEVBQUUsWUFBWTs0QkFDbEIsUUFBUSxFQUFFO2dDQUNULEtBQUs7Z0NBQ0wsMkNBQTJDO2dDQUMzQywrQkFBK0I7Z0NBQy9CLGdCQUFnQjtnQ0FDaEIsS0FBSztnQ0FDTCxVQUFVO2dDQUNWLDhDQUE4QztnQ0FDOUMsc0ZBQXNGO2dDQUN0RixHQUFHOzZCQUNIO3lCQUNEO3dCQUNEOzRCQUNDLElBQUksRUFBRSxTQUFTOzRCQUNmLFFBQVEsRUFBRTtnQ0FDVDtvQ0FDQyxJQUFJLEVBQUUsaUJBQWlCO29DQUN2QixRQUFRLEVBQUU7d0NBQ1QsS0FBSzt3Q0FDTCxrQ0FBa0M7d0NBQ2xDLGdCQUFnQjt3Q0FDaEIsS0FBSzt3Q0FDTCxFQUFFO3dDQUNGLDZDQUE2Qzt3Q0FDN0MsbUNBQW1DLFVBQVUscUZBQXFGO3dDQUNsSSxzQkFBc0I7cUNBQ3RCO2lDQUNEO2dDQUNEO29DQUNDLElBQUksRUFBRSxtQkFBbUI7b0NBQ3pCLFFBQVEsRUFBRTt3Q0FDVDs0Q0FDQyxJQUFJLEVBQUUsaUJBQWlCOzRDQUN2QixRQUFRLEVBQUU7Z0RBQ1QsS0FBSztnREFDTCw2Q0FBNkM7Z0RBQzdDLGlCQUFpQjtnREFDakIsaUJBQWlCO2dEQUNqQiw2Q0FBNkM7Z0RBQzdDLEtBQUs7Z0RBQ0wsb0ZBQW9GO2dEQUNwRixFQUFFO2dEQUNGLEVBQUU7Z0RBQ0YsVUFBVTtnREFDVix3RUFBd0U7NkNBQ3hFO3lDQUNEO3dDQUNEOzRDQUNDLElBQUksRUFBRSxVQUFVOzRDQUNoQixRQUFRLEVBQUU7Z0RBQ1QsS0FBSztnREFDTCw2Q0FBNkM7Z0RBQzdDLHVCQUF1QjtnREFDdkIsS0FBSzs2Q0FDTDt5Q0FDRDt3Q0FDRDs0Q0FDQyxJQUFJLEVBQUUsb0JBQW9COzRDQUMxQixRQUFRLEVBQUU7Z0RBQ1Q7b0RBQ0MsSUFBSSxFQUFFLDhCQUE4QjtvREFDcEMsUUFBUSxFQUFFO3dEQUNULEtBQUs7d0RBQ0wsMENBQTBDO3dEQUMxQywyQ0FBMkM7d0RBQzNDLHFCQUFxQjt3REFDckIsS0FBSzt3REFDTCxNQUFNLFVBQVUsNkJBQTZCO3dEQUM3Qyx1RUFBdUU7cURBQ3ZFO2lEQUNEO2dEQUNEO29EQUNDLElBQUksRUFBRSxzQ0FBc0M7b0RBQzVDLFFBQVEsRUFBRSwrQ0FBK0M7aURBQ3pEOzZDQUNEO3lDQUNEO3FDQUNEO2lDQUNEOzZCQUNEO3lCQUNEO3FCQUNEO2lCQUNELENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7WUFFYixNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU87aUJBQzVCLGNBQWMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFFaEMsTUFBTSxDQUFDLGVBQWUsQ0FDckIsUUFBUSxFQUNSLENBQUM7b0JBQ0EsR0FBRyxFQUFFLFdBQVc7b0JBQ2hCLFFBQVEsRUFBRTt3QkFDVCxVQUFVLEVBQUUsV0FBVyxDQUFDLE1BQU07d0JBQzlCLFdBQVcsRUFBRSwwQkFBMEI7d0JBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQzt3QkFDbkIsSUFBSSxFQUFFLE9BQU87cUJBQ2I7b0JBQ0QsUUFBUSxFQUFFO3dCQUNUOzRCQUNDLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSx5QkFBeUIsQ0FBQzs0QkFDM0QsUUFBUSxFQUFFO2dDQUNULFVBQVUsRUFBRSxXQUFXLENBQUMsTUFBTTtnQ0FDOUIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDO2dDQUNuQixJQUFJLEVBQUUsT0FBTzs2QkFDYjs0QkFDRCxRQUFRLEVBQUU7Z0NBQ1Q7b0NBQ0MsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLDJFQUEyRSxDQUFDO29DQUM3RyxRQUFRLEVBQUU7d0NBQ1QsVUFBVSxFQUFFLFdBQVcsQ0FBQyxZQUFZO3dDQUNwQyxXQUFXLEVBQUUsMkJBQTJCO3dDQUN4QyxPQUFPLEVBQUUsVUFBVTtxQ0FDbkI7b0NBQ0QsUUFBUSxFQUFFLFNBQVM7aUNBQ25COzZCQUNEO3lCQUNEO3dCQUNEOzRCQUNDLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSwyQ0FBMkMsQ0FBQzs0QkFDN0UsUUFBUSxFQUFFO2dDQUNULFVBQVUsRUFBRSxXQUFXLENBQUMsTUFBTTtnQ0FDOUIsS0FBSyxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQztnQ0FDL0IsV0FBVyxFQUFFLDhCQUE4QjtnQ0FDM0MsSUFBSSxFQUFFLE9BQU87NkJBQ2I7NEJBQ0QsUUFBUSxFQUFFLFNBQVM7eUJBQ25CO3FCQUNEO2lCQUNELENBQUMsQ0FDRixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUU7UUFDckMsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNiLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNsRCxNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQztZQUNqRCxNQUFNLFVBQVUsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQ3hDLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFM0MsTUFBTSxxQkFBcUIsR0FBRyx3QkFBd0IsQ0FBQztZQUN2RCxNQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUU3RCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQztpQkFDcEMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7Z0JBQ3hCLHFCQUFxQjtnQkFDckI7b0JBQ0MsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLHVDQUF1QyxDQUFDO29CQUN6RSxPQUFPLEVBQUUsT0FBTztvQkFDaEIsSUFBSSxFQUFFLFdBQVcsQ0FBQyxZQUFZO2lCQUM5QjtnQkFDRDtvQkFDQyxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsdUNBQXVDLENBQUM7b0JBQ3pFLE9BQU8sRUFBRSxPQUFPO29CQUNoQixJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQzlCO2dCQUNEO29CQUNDLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSx1Q0FBdUMsQ0FBQztvQkFDekUsT0FBTyxFQUFFLE9BQU87b0JBQ2hCLElBQUksRUFBRSxXQUFXLENBQUMsWUFBWTtpQkFDOUI7Z0JBQ0Q7b0JBQ0MsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLHVDQUF1QyxDQUFDO29CQUN6RSxPQUFPLEVBQUUsT0FBTztvQkFDaEIsSUFBSSxFQUFFLFdBQVcsQ0FBQyxZQUFZO2lCQUM5QjtnQkFDRCxvQkFBb0I7Z0JBQ3BCO29CQUNDLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLHdCQUF3QixDQUFDO29CQUNqRSxPQUFPLEVBQUUsTUFBTTtvQkFDZixJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQzlCO2dCQUNEO29CQUNDLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLHdCQUF3QixDQUFDO29CQUNqRSxPQUFPLEVBQUUsTUFBTTtvQkFDZixJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQzlCO2FBQ0QsQ0FBQyxDQUFDLENBQUM7WUFFTCx3Q0FBd0M7WUFDeEMsTUFBTSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUNoRCxDQUFDO29CQUNBLElBQUksRUFBRSxjQUFjO29CQUNwQixRQUFRLEVBQUU7d0JBQ1Q7NEJBQ0MsSUFBSSxFQUFFLGlCQUFpQjs0QkFDdkIsUUFBUSxFQUFFO2dDQUNULGdCQUFnQjtnQ0FDaEIsZUFBZTtnQ0FDZixHQUFHOzZCQUNIO3lCQUNEO3dCQUNEOzRCQUNDLElBQUksRUFBRSxpQkFBaUI7NEJBQ3ZCLFFBQVEsRUFBRTtnQ0FDVDtvQ0FDQyxJQUFJLEVBQUUsdUJBQXVCO29DQUM3QixRQUFRLEVBQUU7d0NBQ1QsS0FBSzt3Q0FDTCx1Q0FBdUM7d0NBQ3ZDLHFCQUFxQjt3Q0FDckIsS0FBSzt3Q0FDTCwrQkFBK0I7cUNBQy9CO2lDQUNEO2dDQUNEO29DQUNDLElBQUksRUFBRSx1QkFBdUI7b0NBQzdCLFFBQVEsRUFBRTt3Q0FDVCxLQUFLO3dDQUNMLHVDQUF1Qzt3Q0FDdkMsNkJBQTZCO3dDQUM3QixLQUFLO3dDQUNMLCtCQUErQjtxQ0FDL0I7aUNBQ0Q7Z0NBQ0Q7b0NBQ0MsSUFBSSxFQUFFLHVCQUF1QjtvQ0FDN0IsUUFBUSxFQUFFO3dDQUNULEtBQUs7d0NBQ0wsdUNBQXVDO3dDQUN2Qyw2QkFBNkI7d0NBQzdCLEtBQUs7d0NBQ0wsK0JBQStCO3FDQUMvQjtpQ0FDRDtnQ0FDRDtvQ0FDQyxJQUFJLEVBQUUsdUJBQXVCO29DQUM3QixRQUFRLEVBQUU7d0NBQ1QsS0FBSzt3Q0FDTCx1Q0FBdUM7d0NBQ3ZDLDRCQUE0Qjt3Q0FDNUIsS0FBSzt3Q0FDTCwrQkFBK0I7cUNBQy9CO2lDQUNEO2dDQUNEO29DQUNDLElBQUksRUFBRSxpQkFBaUI7b0NBQ3ZCLFFBQVEsRUFBRTt3Q0FDVCxLQUFLO3dDQUNMLGlDQUFpQzt3Q0FDakMsS0FBSzt3Q0FDTCx5QkFBeUI7cUNBQ3pCO2lDQUNEOzZCQUNEO3lCQUNEO3dCQUNEOzRCQUNDLElBQUksRUFBRSxTQUFTOzRCQUNmLFFBQVEsRUFBRTtnQ0FDVDtvQ0FDQyxJQUFJLEVBQUUsVUFBVTtvQ0FDaEIsUUFBUSxFQUFFLHdCQUF3QjtpQ0FDbEM7NkJBQ0Q7eUJBQ0Q7cUJBQ0Q7aUJBQ0QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUViLDhCQUE4QjtZQUM5QixNQUFNLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUU7Z0JBQ2xEO29CQUNDLElBQUksRUFBRSxxQkFBcUI7b0JBQzNCLFFBQVEsRUFBRTt3QkFDVDs0QkFDQyxJQUFJLEVBQUUsd0JBQXdCOzRCQUM5QixRQUFRLEVBQUU7Z0NBQ1QsS0FBSztnQ0FDTCx3Q0FBd0M7Z0NBQ3hDLDZCQUE2QjtnQ0FDN0IsS0FBSztnQ0FDTCxnQ0FBZ0M7NkJBQ2hDO3lCQUNEO3dCQUNEOzRCQUNDLElBQUksRUFBRSx3QkFBd0I7NEJBQzlCLFFBQVEsRUFBRTtnQ0FDVCxLQUFLO2dDQUNMLHdDQUF3QztnQ0FDeEMsNEJBQTRCO2dDQUM1QixLQUFLO2dDQUNMLGdDQUFnQzs2QkFDaEM7eUJBQ0Q7d0JBQ0Q7NEJBQ0MsSUFBSSxFQUFFLGtCQUFrQjs0QkFDeEIsUUFBUSxFQUFFO2dDQUNULEtBQUs7Z0NBQ0wsa0NBQWtDO2dDQUNsQyxLQUFLO2dDQUNMLDBCQUEwQjs2QkFDMUI7eUJBQ0Q7cUJBQ0Q7aUJBQ0Q7YUFDRCxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUVYLE1BQU0sWUFBWSxHQUFHLE1BQU0sT0FBTztpQkFDaEMsdUJBQXVCLENBQUM7Z0JBQ3hCLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLGtCQUFrQixDQUFDO2FBQy9DLENBQUMsQ0FBQztZQUVKLE1BQU0sQ0FBQyxlQUFlLENBQ3JCLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQzdCO2dCQUNDLHFCQUFxQjtnQkFDckIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsdUNBQXVDLENBQUMsQ0FBQyxJQUFJO2dCQUN6RSxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDLElBQUk7Z0JBQ3pFLG9CQUFvQjtnQkFDcEIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDLElBQUk7YUFDakUsRUFDRCxzQ0FBc0MsQ0FDdEMsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDBCQUEwQixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzNDLE1BQU0sY0FBYyxHQUFHLDRDQUE0QyxDQUFDO1lBQ3BFLE1BQU0sVUFBVSxHQUFHLElBQUksY0FBYyxFQUFFLENBQUM7WUFDeEMsTUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUUzQyxNQUFNLHFCQUFxQixHQUFHLHdCQUF3QixDQUFDO1lBQ3ZELE1BQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBRTdELEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDO2lCQUNwQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztnQkFDeEIscUJBQXFCO2dCQUNyQjtvQkFDQyxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsdUNBQXVDLENBQUM7b0JBQ3pFLE9BQU8sRUFBRSxPQUFPO29CQUNoQixJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQzlCO2dCQUNEO29CQUNDLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSx1Q0FBdUMsQ0FBQztvQkFDekUsT0FBTyxFQUFFLE9BQU87b0JBQ2hCLElBQUksRUFBRSxXQUFXLENBQUMsWUFBWTtpQkFDOUI7Z0JBQ0Q7b0JBQ0MsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLHVDQUF1QyxDQUFDO29CQUN6RSxPQUFPLEVBQUUsT0FBTztvQkFDaEIsSUFBSSxFQUFFLFdBQVcsQ0FBQyxZQUFZO2lCQUM5QjtnQkFDRDtvQkFDQyxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsdUNBQXVDLENBQUM7b0JBQ3pFLE9BQU8sRUFBRSxPQUFPO29CQUNoQixJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQzlCO2dCQUNELG9CQUFvQjtnQkFDcEI7b0JBQ0MsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsd0JBQXdCLENBQUM7b0JBQ2pFLE9BQU8sRUFBRSxNQUFNO29CQUNmLElBQUksRUFBRSxXQUFXLENBQUMsWUFBWTtpQkFDOUI7Z0JBQ0Q7b0JBQ0MsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsd0JBQXdCLENBQUM7b0JBQ2pFLE9BQU8sRUFBRSxNQUFNO29CQUNmLElBQUksRUFBRSxXQUFXLENBQUMsWUFBWTtpQkFDOUI7YUFDRCxDQUFDLENBQUMsQ0FBQztZQUVMLHdDQUF3QztZQUN4QyxNQUFNLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQ2hELENBQUM7b0JBQ0EsSUFBSSxFQUFFLGNBQWM7b0JBQ3BCLFFBQVEsRUFBRTt3QkFDVDs0QkFDQyxJQUFJLEVBQUUsaUJBQWlCOzRCQUN2QixRQUFRLEVBQUU7Z0NBQ1QsZ0JBQWdCO2dDQUNoQixlQUFlO2dDQUNmLEdBQUc7NkJBQ0g7eUJBQ0Q7d0JBQ0Q7NEJBQ0MsSUFBSSxFQUFFLGlCQUFpQjs0QkFDdkIsUUFBUSxFQUFFO2dDQUNUO29DQUNDLElBQUksRUFBRSx1QkFBdUI7b0NBQzdCLFFBQVEsRUFBRTt3Q0FDVCxLQUFLO3dDQUNMLHVDQUF1Qzt3Q0FDdkMscUJBQXFCO3dDQUNyQixLQUFLO3dDQUNMLCtCQUErQjtxQ0FDL0I7aUNBQ0Q7Z0NBQ0Q7b0NBQ0MsSUFBSSxFQUFFLHVCQUF1QjtvQ0FDN0IsUUFBUSxFQUFFO3dDQUNULEtBQUs7d0NBQ0wsdUNBQXVDO3dDQUN2Qyw2QkFBNkI7d0NBQzdCLEtBQUs7d0NBQ0wsMkRBQTJEO3FDQUMzRDtpQ0FDRDtnQ0FDRDtvQ0FDQyxJQUFJLEVBQUUsdUJBQXVCO29DQUM3QixRQUFRLEVBQUU7d0NBQ1QsS0FBSzt3Q0FDTCx1Q0FBdUM7d0NBQ3ZDLDZCQUE2Qjt3Q0FDN0IsS0FBSzt3Q0FDTCwrQkFBK0I7cUNBQy9CO2lDQUNEO2dDQUNEO29DQUNDLElBQUksRUFBRSx1QkFBdUI7b0NBQzdCLFFBQVEsRUFBRTt3Q0FDVCxLQUFLO3dDQUNMLHVDQUF1Qzt3Q0FDdkMsNEJBQTRCO3dDQUM1QixLQUFLO3dDQUNMLDJEQUEyRDtxQ0FDM0Q7aUNBQ0Q7Z0NBQ0Q7b0NBQ0MsSUFBSSxFQUFFLGlCQUFpQjtvQ0FDdkIsUUFBUSxFQUFFO3dDQUNULEtBQUs7d0NBQ0wsaUNBQWlDO3dDQUNqQyxLQUFLO3dDQUNMLHlCQUF5QjtxQ0FDekI7aUNBQ0Q7NkJBQ0Q7eUJBQ0Q7d0JBQ0Q7NEJBQ0MsSUFBSSxFQUFFLFNBQVM7NEJBQ2YsUUFBUSxFQUFFO2dDQUNUO29DQUNDLElBQUksRUFBRSxVQUFVO29DQUNoQixRQUFRLEVBQUUsd0JBQXdCO2lDQUNsQzs2QkFDRDt5QkFDRDtxQkFDRDtpQkFDRCxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBRWIsOEJBQThCO1lBQzlCLE1BQU0sQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRTtnQkFDbEQ7b0JBQ0MsSUFBSSxFQUFFLHFCQUFxQjtvQkFDM0IsUUFBUSxFQUFFO3dCQUNUOzRCQUNDLElBQUksRUFBRSx3QkFBd0I7NEJBQzlCLFFBQVEsRUFBRTtnQ0FDVCxLQUFLO2dDQUNMLHdDQUF3QztnQ0FDeEMsNkJBQTZCO2dDQUM3QixLQUFLO2dDQUNMLGdDQUFnQzs2QkFDaEM7eUJBQ0Q7d0JBQ0Q7NEJBQ0MsSUFBSSxFQUFFLHdCQUF3Qjs0QkFDOUIsUUFBUSxFQUFFO2dDQUNULEtBQUs7Z0NBQ0wsd0NBQXdDO2dDQUN4Qyw0QkFBNEI7Z0NBQzVCLEtBQUs7Z0NBQ0wsZ0NBQWdDOzZCQUNoQzt5QkFDRDt3QkFDRDs0QkFDQyxJQUFJLEVBQUUsa0JBQWtCOzRCQUN4QixRQUFRLEVBQUU7Z0NBQ1QsS0FBSztnQ0FDTCxrQ0FBa0M7Z0NBQ2xDLEtBQUs7Z0NBQ0wsMEJBQTBCOzZCQUMxQjt5QkFDRDtxQkFDRDtpQkFDRDthQUNELENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBRVgsTUFBTSxZQUFZLEdBQUcsTUFBTSxPQUFPO2lCQUNoQyx1QkFBdUIsQ0FBQztnQkFDeEIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUM7Z0JBQy9DLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLG1CQUFtQixDQUFDO2dCQUNoRCxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSx1QkFBdUIsQ0FBQzthQUNwRCxDQUFDLENBQUM7WUFFSixNQUFNLENBQUMsZUFBZSxDQUNyQixZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUM3QjtnQkFDQyxxQkFBcUI7Z0JBQ3JCLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLHVDQUF1QyxDQUFDLENBQUMsSUFBSTtnQkFDekUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsdUNBQXVDLENBQUMsQ0FBQyxJQUFJO2dCQUN6RSxvQkFBb0I7Z0JBQ3BCLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsd0JBQXdCLENBQUMsQ0FBQyxJQUFJO2FBQ2pFLEVBQ0Qsc0NBQXNDLENBQ3RDLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMifQ==