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
import assert from 'assert';
import { timeout } from '../../../../../../base/common/async.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { assertDefined } from '../../../../../../base/common/types.js';
import { URI } from '../../../../../../base/common/uri.js';
import { randomBoolean } from '../../../../../../base/test/common/testUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { ConfigurationService } from '../../../../../../platform/configuration/common/configurationService.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import { NullPolicyService } from '../../../../../../platform/policy/common/policy.js';
import { ChatMode } from '../../../common/constants.js';
import { FolderReference, NotPromptFile, OpenFailed, RecursiveReference } from '../../../common/promptFileReferenceErrors.js';
import { MarkdownLink } from '../../../common/promptSyntax/codecs/base/markdownCodec/tokens/markdownLink.js';
import { FileReference } from '../../../common/promptSyntax/codecs/tokens/fileReference.js';
import { getPromptFileType } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { FilePromptParser } from '../../../common/promptSyntax/parsers/filePromptParser.js';
import { MockFilesystem } from './testUtils/mockFilesystem.js';
/**
 * Represents a file reference with an expected
 * error condition value for testing purposes.
 */
class ExpectedReference {
    constructor(dirname, linkToken, errorCondition) {
        this.linkToken = linkToken;
        this.errorCondition = errorCondition;
        this.uri = (linkToken.path.startsWith('/'))
            ? URI.file(linkToken.path)
            : URI.joinPath(dirname, linkToken.path);
    }
    /**
     * Range of the underlying file reference token.
     */
    get range() {
        return this.linkToken.range;
    }
    /**
     * String representation of the expected reference.
     */
    toString() {
        return `file-prompt:${this.uri.path}`;
    }
}
/**
 * A reusable test utility to test the `PromptFileReference` class.
 */
let TestPromptFileReference = class TestPromptFileReference extends Disposable {
    constructor(fileStructure, rootFileUri, expectedReferences, fileService, instantiationService) {
        super();
        this.fileStructure = fileStructure;
        this.rootFileUri = rootFileUri;
        this.expectedReferences = expectedReferences;
        this.fileService = fileService;
        this.instantiationService = instantiationService;
        // create in-memory file system
        const fileSystemProvider = this._register(new InMemoryFileSystemProvider());
        this._register(this.fileService.registerProvider(Schemas.file, fileSystemProvider));
    }
    /**
     * Run the test.
     */
    async run(options = {}) {
        // create the files structure on the disk
        await (this.instantiationService.createInstance(MockFilesystem, this.fileStructure)).mock();
        // randomly test with and without delay to ensure that the file
        // reference resolution is not susceptible to race conditions
        if (randomBoolean()) {
            await timeout(5);
        }
        // start resolving references for the specified root file
        const rootReference = this._register(this.instantiationService.createInstance(FilePromptParser, this.rootFileUri, options)).start();
        // wait until entire prompts tree is resolved
        await rootReference.allSettled();
        // resolve the root file reference including all nested references
        const resolvedReferences = rootReference.allReferences;
        for (let i = 0; i < this.expectedReferences.length; i++) {
            const expectedReference = this.expectedReferences[i];
            const resolvedReference = resolvedReferences[i];
            if (expectedReference.linkToken instanceof MarkdownLink) {
                assert(resolvedReference?.subtype === 'markdown', [
                    `Expected ${i}th resolved reference to be a markdown link`,
                    `got '${resolvedReference}'.`,
                ].join(', '));
            }
            if (expectedReference.linkToken instanceof FileReference) {
                assert(resolvedReference?.subtype === 'prompt', [
                    `Expected ${i}th resolved reference to be a #file: link`,
                    `got '${resolvedReference}'.`,
                ].join(', '));
            }
            assert((resolvedReference) &&
                (resolvedReference.uri.toString() === expectedReference.uri.toString()), [
                `Expected ${i}th resolved reference URI to be '${expectedReference.uri}'`,
                `got '${resolvedReference?.uri}'.`,
            ].join(', '));
            assert((resolvedReference) &&
                (resolvedReference.range.equalsRange(expectedReference.range)), [
                `Expected ${i}th resolved reference range to be '${expectedReference.range}'`,
                `got '${resolvedReference?.range}'.`,
            ].join(', '));
            if (expectedReference.errorCondition === undefined) {
                assert(resolvedReference.errorCondition === undefined, [
                    `Expected ${i}th error condition to be 'undefined'`,
                    `got '${resolvedReference.errorCondition}'.`,
                ].join(', '));
                continue;
            }
            assert(expectedReference.errorCondition.equal(resolvedReference.errorCondition), [
                `Expected ${i}th error condition to be '${expectedReference.errorCondition}'`,
                `got '${resolvedReference.errorCondition}'.`,
            ].join(', '));
        }
        assert.strictEqual(resolvedReferences.length, this.expectedReferences.length, [
            `\nExpected(${this.expectedReferences.length}): [\n ${this.expectedReferences.join('\n ')}\n]`,
            `Received(${resolvedReferences.length}): [\n ${resolvedReferences.join('\n ')}\n]`,
        ].join('\n'));
        return rootReference;
    }
};
TestPromptFileReference = __decorate([
    __param(3, IFileService),
    __param(4, IInstantiationService)
], TestPromptFileReference);
/**
 * Create expected file reference for testing purposes.
 *
 * Note! This utility also use for `markdown links` at the moment.
 *
 * @param filePath The expected path of the file reference (without the `#file:` prefix).
 * @param lineNumber The expected line number of the file reference.
 * @param startColumnNumber The expected start column number of the file reference.
 */
function createTestFileReference(filePath, lineNumber, startColumnNumber) {
    const range = new Range(lineNumber, startColumnNumber, lineNumber, startColumnNumber + `#file:${filePath}`.length);
    return new FileReference(range, filePath);
}
suite('PromptFileReference', function () {
    const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    setup(async () => {
        const nullPolicyService = new NullPolicyService();
        const nullLogService = testDisposables.add(new NullLogService());
        const nullFileService = testDisposables.add(new FileService(nullLogService));
        const nullConfigService = testDisposables.add(new ConfigurationService(URI.file('/config.json'), nullFileService, nullPolicyService, nullLogService));
        instantiationService = testDisposables.add(new TestInstantiationService());
        instantiationService.stub(IFileService, nullFileService);
        instantiationService.stub(ILogService, nullLogService);
        instantiationService.stub(IConfigurationService, nullConfigService);
        instantiationService.stub(IModelService, { getModel() { return null; } });
        instantiationService.stub(ILanguageService, {
            guessLanguageIdByFilepathOrFirstLine(uri) {
                return getPromptFileType(uri) ?? null;
            }
        });
    });
    test('resolves nested file references', async function () {
        const rootFolderName = 'resolves-nested-file-references';
        const rootFolder = `/${rootFolderName}`;
        const rootUri = URI.file(rootFolder);
        const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
        /**
         * The file structure to be created on the disk for the test.
         */
        [{
                name: rootFolderName,
                children: [
                    {
                        name: 'file1.prompt.md',
                        contents: '## Some Header\nsome contents\n ',
                    },
                    {
                        name: 'file2.prompt.md',
                        contents: '## Files\n\t- this file #file:folder1/file3.prompt.md \n\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!\n ',
                    },
                    {
                        name: 'folder1',
                        children: [
                            {
                                name: 'file3.prompt.md',
                                contents: `\n[](./some-other-folder/non-existing-folder)\n\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md contents\n some more\t content`,
                            },
                            {
                                name: 'some-other-folder',
                                children: [
                                    {
                                        name: 'file4.prompt.md',
                                        contents: 'this file has a non-existing #file:./some-non-existing/file.prompt.md\t\treference\n\n\nand some\n non-prompt #file:./some-non-prompt-file.md\t\t \t[](../../folder1/)\t',
                                    },
                                    {
                                        name: 'file.txt',
                                        contents: 'contents of a non-prompt-snippet file',
                                    },
                                    {
                                        name: 'yetAnotherFolder🤭',
                                        children: [
                                            {
                                                name: 'another-file.prompt.md',
                                                contents: `[caption](${rootFolder}/folder1/some-other-folder)\nanother-file.prompt.md contents\t [#file:file.txt](../file.txt)`,
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
            }], 
        /**
         * The root file path to start the resolve process from.
         */
        URI.file(`/${rootFolderName}/file2.prompt.md`), 
        /**
         * The expected references to be resolved.
         */
        [
            new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 2, 14)),
            new ExpectedReference(URI.joinPath(rootUri, './folder1'), new MarkdownLink(2, 1, '[]', '(./some-other-folder/non-existing-folder)'), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/non-existing-folder'), 'Reference to non-existing file cannot be opened.')),
            new ExpectedReference(URI.joinPath(rootUri, './folder1'), createTestFileReference(`/${rootFolderName}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md`, 3, 26)),
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), new MarkdownLink(1, 1, '[caption]', `(/${rootFolderName}/folder1/some-other-folder)`), new FolderReference(URI.joinPath(rootUri, './folder1/some-other-folder'), 'This folder is not a prompt file!')),
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder/yetAnotherFolder🤭'), new MarkdownLink(2, 34, '[#file:file.txt]', '(../file.txt)'), new NotPromptFile(URI.joinPath(rootUri, './folder1/some-other-folder/file.txt'), 'Ughh oh, that is not a prompt file!')),
            new ExpectedReference(rootUri, new MarkdownLink(3, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('./some-non-existing/file.prompt.md', 1, 30), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/some-non-existing/file.prompt.md'), 'Failed to open non-existing prompt snippets file')),
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('./some-non-prompt-file.md', 5, 13), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/some-non-prompt-file.md'), 'Oh no!')),
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), new MarkdownLink(5, 48, '[]', '(../../folder1/)'), new FolderReference(URI.joinPath(rootUri, './folder1/'), 'Uggh ohh!')),
        ]));
        await test.run();
    });
    test('does not fall into infinite reference recursion', async function () {
        const rootFolderName = 'infinite-recursion';
        const rootFolder = `/${rootFolderName}`;
        const rootUri = URI.file(rootFolder);
        const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
        /**
         * The file structure to be created on the disk for the test.
         */
        [{
                name: rootFolderName,
                children: [
                    {
                        name: 'file1.md',
                        contents: '## Some Header\nsome contents\n ',
                    },
                    {
                        name: 'file2.prompt.md',
                        contents: `## Files\n\t- this file #file:folder1/file3.prompt.md \n\t- also this #file:./folder1/some-other-folder/file4.prompt.md\n\n#file:${rootFolder}/folder1/some-other-folder/file5.prompt.md\t please!\n\t[some (snippet!) #name))](./file1.md)`,
                    },
                    {
                        name: 'folder1',
                        children: [
                            {
                                name: 'file3.prompt.md',
                                contents: `\n\n\t- some seemingly random [another-file.prompt.md](${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md) contents\n some more\t content`,
                            },
                            {
                                name: 'some-other-folder',
                                children: [
                                    {
                                        name: 'file4.prompt.md',
                                        contents: 'this file has a non-existing #file:../some-non-existing/file.prompt.md\t\treference',
                                    },
                                    {
                                        name: 'file5.prompt.md',
                                        contents: 'this file has a relative recursive #file:../../file2.prompt.md\nreference\n ',
                                    },
                                    {
                                        name: 'yetAnotherFolder🤭',
                                        children: [
                                            {
                                                name: 'another-file.prompt.md',
                                                // absolute path with recursion
                                                contents: `some test goes\t\nhere #file:${rootFolder}/file2.prompt.md`,
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
            }], 
        /**
         * The root file path to start the resolve process from.
         */
        URI.file(`/${rootFolderName}/file2.prompt.md`), 
        /**
         * The expected references to be resolved.
         */
        [
            new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 2, 14)),
            new ExpectedReference(URI.joinPath(rootUri, './folder1'), new MarkdownLink(3, 26, '[another-file.prompt.md]', `(${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md)`)),
            /**
             * This reference should be resolved with a recursive
             * reference error condition. (the absolute reference case)
             */
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder/yetAnotherFolder🤭'), createTestFileReference(`${rootFolder}/file2.prompt.md`, 2, 6), new RecursiveReference(URI.joinPath(rootUri, './file2.prompt.md'), [
                '/infinite-recursion/file2.prompt.md',
                '/infinite-recursion/folder1/file3.prompt.md',
                '/infinite-recursion/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md',
                '/infinite-recursion/file2.prompt.md',
            ])),
            new ExpectedReference(rootUri, createTestFileReference('./folder1/some-other-folder/file4.prompt.md', 3, 14), undefined),
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('../some-non-existing/file.prompt.md', 1, 30), new OpenFailed(URI.joinPath(rootUri, './folder1/some-non-existing/file.prompt.md'), 'Uggh ohh!')),
            new ExpectedReference(rootUri, createTestFileReference(`${rootFolder}/folder1/some-other-folder/file5.prompt.md`, 5, 1), undefined),
            /**
             * This reference should be resolved with a recursive
             * reference error condition. (the relative reference case)
             */
            new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('../../file2.prompt.md', 1, 36), new RecursiveReference(URI.joinPath(rootUri, './file2.prompt.md'), [
                '/infinite-recursion/file2.prompt.md',
                '/infinite-recursion/folder1/some-other-folder/file5.prompt.md',
                '/infinite-recursion/file2.prompt.md',
            ])),
            new ExpectedReference(rootUri, new MarkdownLink(6, 2, '[some (snippet!) #name))]', '(./file1.md)'), new NotPromptFile(URI.joinPath(rootUri, './file1.md'), 'Uggh oh!')),
        ]));
        await test.run();
    });
    suite('options', () => {
        test('allowNonPromptFiles', async function () {
            const rootFolderName = 'resolves-nested-file-references';
            const rootFolder = `/${rootFolderName}`;
            const rootUri = URI.file(rootFolder);
            const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
            /**
             * The file structure to be created on the disk for the test.
             */
            [{
                    name: rootFolderName,
                    children: [
                        {
                            name: 'file1.prompt.md',
                            contents: '## Some Header\nsome contents\n ',
                        },
                        {
                            name: 'file2.md',
                            contents: '## Files\n\t- this file #file:folder1/file3.prompt.md \n\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!\n ',
                        },
                        {
                            name: 'folder1',
                            children: [
                                {
                                    name: 'file3.prompt.md',
                                    contents: `\n[](./some-other-folder/non-existing-folder)\n\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md contents\n some more\t content`,
                                },
                                {
                                    name: 'some-other-folder',
                                    children: [
                                        {
                                            name: 'file4.prompt.md',
                                            contents: 'this file has a non-existing #file:./some-non-existing/file.prompt.md\t\treference\n\n\nand some\n non-prompt #file:./some-non-prompt-file.md\t\t \t[](../../folder1/)\t',
                                        },
                                        {
                                            name: 'file.txt',
                                            contents: 'contents of a non-prompt-snippet file',
                                        },
                                        {
                                            name: 'yetAnotherFolder🤭',
                                            children: [
                                                {
                                                    name: 'another-file.prompt.md',
                                                    contents: `[](${rootFolder}/folder1/some-other-folder)\nanother-file.prompt.md contents\t [#file:file.txt](../file.txt)`,
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
                }], 
            /**
             * The root file path to start the resolve process from.
             */
            URI.file(`/${rootFolderName}/file2.md`), 
            /**
             * The expected references to be resolved.
             */
            [
                new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 2, 14)),
                new ExpectedReference(URI.joinPath(rootUri, './folder1'), new MarkdownLink(2, 1, '[]', '(./some-other-folder/non-existing-folder)'), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/non-existing-folder'), 'Reference to non-existing file cannot be opened.')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1'), createTestFileReference(`/${rootFolderName}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md`, 3, 26)),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), new MarkdownLink(1, 1, '[]', `(/${rootFolderName}/folder1/some-other-folder)`), new FolderReference(URI.joinPath(rootUri, './folder1/some-other-folder'), 'This folder is not a prompt file!')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder/yetAnotherFolder🤭'), new MarkdownLink(2, 34, '[#file:file.txt]', '(../file.txt)'), new NotPromptFile(URI.joinPath(rootUri, './folder1/some-other-folder/file.txt'), 'Ughh oh, that is not a prompt file!')),
                new ExpectedReference(rootUri, new MarkdownLink(3, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('./some-non-existing/file.prompt.md', 1, 30), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/some-non-existing/file.prompt.md'), 'Failed to open non-existing prompt snippets file')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder/'), createTestFileReference('./some-non-prompt-file.md', 5, 13), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/some-non-prompt-file.md'), 'Oh no!')),
                new ExpectedReference(URI.joinPath(rootUri, './some-other-folder/folder1/'), new MarkdownLink(5, 48, '[]', '(../../folder1/)'), new FolderReference(URI.joinPath(rootUri, './folder1'), 'Uggh ohh!')),
            ]));
            await test.run({ allowNonPromptFiles: true });
        });
    });
    suite('metadata', () => {
        test('tools', async function () {
            const rootFolderName = 'resolves-nested-file-references';
            const rootFolder = `/${rootFolderName}`;
            const rootUri = URI.file(rootFolder);
            const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
            /**
             * The file structure to be created on the disk for the test.
             */
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
                            name: 'file2.prompt.md',
                            contents: [
                                '---',
                                'description: \'Root prompt description.\'',
                                'tools: [\'my-tool1\']',
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
                                        '---',
                                        '',
                                        '[](./some-other-folder/non-existing-folder)',
                                        `\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md contents`,
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
                                            contents: 'contents of a non-prompt-snippet file',
                                        },
                                        {
                                            name: 'yetAnotherFolder🤭',
                                            children: [
                                                {
                                                    name: 'another-file.prompt.md',
                                                    contents: [
                                                        '---',
                                                        'tools: [\'my-tool3\', false, "my-tool2" ]',
                                                        '---',
                                                        `[](${rootFolder}/folder1/some-other-folder)`,
                                                        'another-file.prompt.md contents\t [#file:file.txt](../file.txt)',
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
                }], 
            /**
             * The root file path to start the resolve process from.
             */
            URI.file(`/${rootFolderName}/file2.prompt.md`), 
            /**
             * The expected references to be resolved.
             */
            [
                new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 7, 14)),
                new ExpectedReference(URI.joinPath(rootUri, './folder1'), new MarkdownLink(5, 1, '[]', '(./some-other-folder/non-existing-folder)'), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/non-existing-folder'), 'Reference to non-existing file cannot be opened.')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1'), createTestFileReference(`/${rootFolderName}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md`, 6, 26)),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), new MarkdownLink(4, 1, '[]', `(/${rootFolderName}/folder1/some-other-folder)`), new FolderReference(URI.joinPath(rootUri, './folder1/some-other-folder'), 'This folder is not a prompt file!')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder/yetAnotherFolder🤭'), new MarkdownLink(5, 34, '[#file:file.txt]', '(../file.txt)'), new NotPromptFile(URI.joinPath(rootUri, './folder1/some-other-folder/file.txt'), 'Ughh oh, that is not a prompt file!')),
                new ExpectedReference(rootUri, new MarkdownLink(8, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('./some-non-existing/file.prompt.md', 6, 30), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/some-non-existing/file.prompt.md'), 'Failed to open non-existing prompt snippets file')),
                new ExpectedReference(URI.joinPath(rootUri, './folder1/some-other-folder'), createTestFileReference('./some-non-prompt-file.md', 10, 13), new OpenFailed(URI.joinPath(rootUri, './folder1/some-other-folder/some-non-prompt-file.md'), 'Oh no!')),
                new ExpectedReference(URI.joinPath(rootUri, './some-other-folder/folder1'), new MarkdownLink(10, 48, '[]', '(../../folder1/)'), new FolderReference(URI.joinPath(rootUri, './folder1'), 'Uggh ohh!')),
            ]));
            const rootReference = await test.run();
            const { metadata, allToolsMetadata } = rootReference;
            assert.deepStrictEqual(metadata, {
                promptType: PromptsType.prompt,
                mode: 'agent',
                description: 'Root prompt description.',
                tools: ['my-tool1'],
            }, 'Must have correct metadata.');
            assertDefined(allToolsMetadata, 'All tools metadata must be defined.');
            assert.deepStrictEqual(allToolsMetadata, ['my-tool1', 'my-tool3', 'my-tool2'], 'Must have correct all tools metadata.');
        });
        suite('applyTo', () => {
            test('prompt language', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = URI.file(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
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
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'applyTo: \'**/*\'',
                                    'tools: [ false, \'my-tool12\' , ]',
                                    'description: \'Description of my prompt.\'',
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
                                            '---',
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
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'mode: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                URI.file(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 7, 14)),
                    new ExpectedReference(rootUri, new MarkdownLink(8, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const rootReference = await test.run();
                const { metadata, allToolsMetadata } = rootReference;
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    mode: ChatMode.Agent,
                    description: 'Description of my prompt.',
                    tools: ['my-tool12'],
                }, 'Must have correct metadata.');
                assert.deepStrictEqual(allToolsMetadata, [
                    'my-tool12',
                    'my-tool1',
                    'my-tool2',
                    'my-tool3',
                ], 'Must have correct all tools metadata.');
            });
            test('instructions language', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = URI.file(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
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
                                name: 'file2.instructions.md',
                                contents: [
                                    '---',
                                    'applyTo: \'**/*\'',
                                    'tools: [ false, \'my-tool12\' , ]',
                                    'description: \'Description of my instructions file.\'',
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
                                            '---',
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
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'mode: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                URI.file(`/${rootFolderName}/file2.instructions.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 7, 14)),
                    new ExpectedReference(rootUri, new MarkdownLink(8, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const rootReference = await test.run();
                const { metadata, allToolsMetadata } = rootReference;
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.instructions,
                    applyTo: '**/*',
                    description: 'Description of my instructions file.',
                }, 'Must have correct metadata.');
                assert.strictEqual(allToolsMetadata, null, 'Must have correct all tools metadata.');
            });
        });
        suite('tools and mode compatibility', () => {
            test('tools are ignored if root prompt is in the ask mode', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = URI.file(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
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
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'description: \'Description of my prompt.\'',
                                    'mode: "ask" ',
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
                                            'mode: \'agent\'\t',
                                            '---',
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
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                URI.file(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, new MarkdownLink(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const rootReference = await test.run();
                const { metadata, allToolsMetadata } = rootReference;
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    mode: ChatMode.Ask,
                    description: 'Description of my prompt.',
                }, 'Must have correct metadata.');
                assert.strictEqual(allToolsMetadata, null, 'Must have correct all tools metadata.');
            });
            test('tools are ignored if root prompt is in the edit mode', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = URI.file(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
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
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'description: \'Description of my prompt.\'',
                                    'mode:\t\t"edit"\t\t',
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
                                            '---',
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
                                                    'mode: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                URI.file(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, new MarkdownLink(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const rootReference = await test.run();
                const { metadata, allToolsMetadata } = rootReference;
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    mode: ChatMode.Edit,
                    description: 'Description of my prompt.',
                }, 'Must have correct metadata.');
                assert.strictEqual(allToolsMetadata, null, 'Must have correct all tools metadata.');
            });
            test('tools are not ignored if root prompt is in the agent mode', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = URI.file(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
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
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'description: \'Description of my prompt.\'',
                                    'mode: \t\t "agent" \t\t ',
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
                                            '---',
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
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'mode: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                URI.file(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, new MarkdownLink(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const rootReference = await test.run();
                const { metadata, allToolsMetadata } = rootReference;
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    mode: ChatMode.Agent,
                    description: 'Description of my prompt.',
                }, 'Must have correct metadata.');
                assert.deepStrictEqual(allToolsMetadata, [
                    'my-tool1',
                    'my-tool2',
                    'my-tool3',
                ], 'Must have correct all tools metadata.');
            });
            test('tools are not ignored if root prompt implicitly in the agent mode', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = URI.file(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
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
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'tools: [ false, \'my-tool12\' , ]',
                                    'description: \'Description of the prompt file.\'',
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
                                            '---',
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
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'mode: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                URI.file(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createTestFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, new MarkdownLink(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const rootReference = await test.run();
                const { metadata, allToolsMetadata } = rootReference;
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    mode: ChatMode.Agent,
                    tools: ['my-tool12'],
                    description: 'Description of the prompt file.',
                }, 'Must have correct metadata.');
                assert.deepStrictEqual(allToolsMetadata, [
                    'my-tool12',
                    'my-tool1',
                    'my-tool2',
                    'my-tool3',
                ], 'Must have correct all tools metadata.');
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZVJlZmVyZW5jZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9wcm9tcHRGaWxlUmVmZXJlbmNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0QsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFDL0csT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNyRixPQUFPLEVBQUUsMEJBQTBC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