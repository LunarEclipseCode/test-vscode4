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
import { ChatMode } from '../../../../common/constants.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { Schemas } from '../../../../../../../base/common/network.js';
import { ExpectedReference } from '../testUtils/expectedReference.js';
import { Range } from '../../../../../../../editor/common/core/range.js';
import { assertDefined } from '../../../../../../../base/common/types.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { OpenFailed } from '../../../../common/promptFileReferenceErrors.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { randomBoolean } from '../../../../../../../base/test/common/testUtils.js';
import { PROMPT_LANGUAGE_ID, INSTRUCTIONS_LANGUAGE_ID, MODE_LANGUAGE_ID, PromptsType } from '../../../../common/promptSyntax/promptTypes.js';
import { FileService } from '../../../../../../../platform/files/common/fileService.js';
import { createTextModel } from '../../../../../../../editor/test/common/testTextModel.js';
import { ILogService, NullLogService } from '../../../../../../../platform/log/common/log.js';
import { TextModelPromptParser } from '../../../../common/promptSyntax/parsers/textModelPromptParser.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { InMemoryFileSystemProvider } from '../../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { ExpectedDiagnosticError, ExpectedDiagnosticWarning } from '../testUtils/expectedDiagnostic.js';
import { TestInstantiationService } from '../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
/**
 * Test helper to run unit tests for the {@link TextModelPromptParser}
 * class using different test input parameters
 */
let TextModelPromptParserTest = class TextModelPromptParserTest extends Disposable {
    constructor(uri, initialContents, languageId = PROMPT_LANGUAGE_ID, fileService, instantiationService) {
        super();
        // create in-memory file system for this test instance
        const fileSystemProvider = this._register(new InMemoryFileSystemProvider());
        this._register(fileService.registerProvider(Schemas.file, fileSystemProvider));
        // both line endings should yield the same results
        const lineEnding = (randomBoolean()) ? '\r\n' : '\n';
        // create the underlying model
        this.model = this._register(createTextModel(initialContents.join(lineEnding), languageId, undefined, uri));
        // create the parser instance
        this.parser = this._register(instantiationService.createInstance(TextModelPromptParser, this.model, {})).start();
    }
    /**
     * Wait for the prompt parsing/resolve process to finish.
     */
    allSettled() {
        return this.parser.allSettled();
    }
    /**
     * Validate the current state of the parser.
     */
    async validateReferences(expectedReferences) {
        await this.parser.allSettled();
        const { references } = this.parser;
        for (let i = 0; i < expectedReferences.length; i++) {
            const reference = references[i];
            assertDefined(reference, `Expected reference #${i} be ${expectedReferences[i]}, got 'undefined'.`);
            expectedReferences[i].validateEqual(reference);
        }
        assert.strictEqual(expectedReferences.length, references.length, `[${this.model.uri}] Unexpected number of references.`);
    }
    /**
     * Validate list of diagnostic objects of the prompt header.
     */
    async validateHeaderDiagnostics(expectedDiagnostics) {
        await this.parser.allSettled();
        const { header } = this.parser;
        assertDefined(header, 'Prompt header must be defined.');
        const { diagnostics } = header;
        for (let i = 0; i < expectedDiagnostics.length; i++) {
            const diagnostic = diagnostics[i];
            assertDefined(diagnostic, `Expected diagnostic #${i} be ${expectedDiagnostics[i]}, got 'undefined'.`);
            try {
                expectedDiagnostics[i].validateEqual(diagnostic);
            }
            catch (_error) {
                throw new Error(`Expected diagnostic #${i} to be ${expectedDiagnostics[i]}, got '${diagnostic}'.`);
            }
        }
        assert.strictEqual(expectedDiagnostics.length, diagnostics.length, `Expected '${expectedDiagnostics.length}' diagnostic objects, got '${diagnostics.length}'.`);
    }
};
TextModelPromptParserTest = __decorate([
    __param(3, IFileService),
    __param(4, IInstantiationService)
], TextModelPromptParserTest);
suite('TextModelPromptParser', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    setup(async () => {
        instantiationService = disposables.add(new TestInstantiationService());
        instantiationService.stub(ILogService, new NullLogService());
        instantiationService.stub(IFileService, disposables.add(instantiationService.createInstance(FileService)));
    });
    /**
     * Create a new test instance with provided input parameters.
     */
    const createTest = (uri, initialContents, languageId = PROMPT_LANGUAGE_ID) => {
        return disposables.add(instantiationService.createInstance(TextModelPromptParserTest, uri, initialContents, languageId));
    };
    test('core logic #1', async () => {
        const test = createTest(URI.file('/foo/bar.md'), [
            /* 01 */ "The quick brown fox tries #file:/abs/path/to/file.md online yoga for the first time.",
            /* 02 */ "Maria discovered a stray turtle roaming in her kitchen.",
            /* 03 */ "Why did the robot write a poem about existential dread?",
            /* 04 */ "Sundays are made for two things: pancakes and procrastination.",
            /* 05 */ "Sometimes, the best code is the one you never have to write.",
            /* 06 */ "A lone kangaroo once hopped into the local cafe, seeking free Wi-Fi.",
            /* 07 */ "Critical #file:./folder/binary.file thinking is like coffee; best served strong [md link](/etc/hosts/random-file.txt) and without sugar.",
            /* 08 */ "Music is the mind's way of doodling in the air.",
            /* 09 */ "Stargazing is just turning your eyes into cosmic explorers.",
            /* 10 */ "Never trust a balloon salesman who hates birthdays.",
            /* 11 */ "Running backward can be surprisingly enlightening.",
            /* 12 */ "There's an art to whispering loudly.",
        ]);
        await test.validateReferences([
            new ExpectedReference({
                uri: URI.file('/abs/path/to/file.md'),
                text: '#file:/abs/path/to/file.md',
                path: '/abs/path/to/file.md',
                startLine: 1,
                startColumn: 27,
                pathStartColumn: 33,
                childrenOrError: new OpenFailed(URI.file('/abs/path/to/file.md'), 'File not found.'),
            }),
            new ExpectedReference({
                uri: URI.file('/foo/folder/binary.file'),
                text: '#file:./folder/binary.file',
                path: './folder/binary.file',
                startLine: 7,
                startColumn: 10,
                pathStartColumn: 16,
                childrenOrError: new OpenFailed(URI.file('/foo/folder/binary.file'), 'File not found.'),
            }),
            new ExpectedReference({
                uri: URI.file('/etc/hosts/random-file.txt'),
                text: '[md link](/etc/hosts/random-file.txt)',
                path: '/etc/hosts/random-file.txt',
                startLine: 7,
                startColumn: 81,
                pathStartColumn: 91,
                childrenOrError: new OpenFailed(URI.file('/etc/hosts/random-file.txt'), 'File not found.'),
            }),
        ]);
    });
    test('core logic #2', async () => {
        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
            /* 01 */ "The penguin wore sunglasses but never left the iceberg.",
            /* 02 */ "I once saw a cloud that looked like an antique teapot.",
            /* 03 */ "Midnight snacks are the secret to eternal [link text](./foo-bar-baz/another-file.ts) happiness.",
            /* 04 */ "A stray sock in the hallway is a sign of chaotic creativity.",
            /* 05 */ "Dogs dream in colorful squeaks and belly rubs.",
            /* 06 */ "Never [caption](../../../c/file_name.prompt.md)\t underestimate the power of a well-timed nap.",
            /* 07 */ "The cactus on my desk has a thriving Instagram account.",
            /* 08 */ "In an alternate universe, pigeons deliver sushi by drone.",
            /* 09 */ "Lunar rainbows only appear when you sing in falsetto.",
            /* 10 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
            /* 11 */ "Sometimes, the best advice comes \t\t#file:../../main.rs\t#file:./somefolder/../samefile.jpeg\tfrom a talking dishwasher.",
            /* 12 */ "Paper airplanes believe they can fly until proven otherwise.",
            /* 13 */ "A library without stories is just a room full of silent trees.",
            /* 14 */ "The invisible cat meows only when it sees a postman.",
            /* 15 */ "Code reviews are like detective novels without the plot twists."
        ]);
        await test.validateReferences([
            new ExpectedReference({
                uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                text: '[link text](./foo-bar-baz/another-file.ts)',
                path: './foo-bar-baz/another-file.ts',
                startLine: 3,
                startColumn: 43,
                pathStartColumn: 55,
                childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
            }),
            new ExpectedReference({
                uri: URI.file('/absolute/c/file_name.prompt.md'),
                text: '[caption](../../../c/file_name.prompt.md)',
                path: '../../../c/file_name.prompt.md',
                startLine: 6,
                startColumn: 7,
                pathStartColumn: 17,
                childrenOrError: new OpenFailed(URI.file('/absolute/c/file_name.prompt.md'), 'File not found.'),
            }),
            new ExpectedReference({
                uri: URI.file('/absolute/folder/main.rs'),
                text: '#file:../../main.rs',
                path: '../../main.rs',
                startLine: 11,
                startColumn: 36,
                pathStartColumn: 42,
                childrenOrError: new OpenFailed(URI.file('/absolute/folder/main.rs'), 'File not found.'),
            }),
            new ExpectedReference({
                uri: URI.file('/absolute/folder/and/a/samefile.jpeg'),
                text: '#file:./somefolder/../samefile.jpeg',
                path: './somefolder/../samefile.jpeg',
                startLine: 11,
                startColumn: 56,
                pathStartColumn: 62,
                childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/samefile.jpeg'), 'File not found.'),
            }),
        ]);
    });
    suite('header', () => {
        suite(' • metadata', () => {
            suite(' • instructions', () => {
                test(`• empty header`, async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                        /* 01 */ "---",
                        /* 02 */ "",
                        /* 03 */ "---",
                        /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        /* 05 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                        /* 06 */ "In an alternate universe, pigeons deliver sushi by drone.",
                        /* 07 */ "Lunar rainbows only appear when you sing in falsetto.",
                        /* 08 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                    ], INSTRUCTIONS_LANGUAGE_ID);
                    await test.validateReferences([
                        new ExpectedReference({
                            uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                            text: '[text](./foo-bar-baz/another-file.ts)',
                            path: './foo-bar-baz/another-file.ts',
                            startLine: 5,
                            startColumn: 43,
                            pathStartColumn: 50,
                            childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                        }),
                    ]);
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Prompt header must be defined.');
                    assert.deepStrictEqual(metadata, {
                        promptType: PromptsType.instructions,
                    }, 'Must have empty metadata.');
                });
                test(`• has correct 'instructions' metadata`, async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/filename.instructions.md'), [
                        /* 01 */ "---",
                        /* 02 */ "description: 'My prompt.'\t\t",
                        /* 03 */ "	something: true", /* unknown metadata record */
                        /* 04 */ "	tools: [ 'tool_name1', \"tool_name2\", 'tool_name1', true, false, '', 'tool_name2' ]\t\t",
                        /* 05 */ "	tools: [ 'tool_name3', \"tool_name4\" ]", /* duplicate `tools` record is ignored */
                        /* 06 */ "	tools: 'tool_name5'", /* duplicate `tools` record with invalid value is ignored */
                        /* 07 */ "	mode: 'agent'",
                        /* 07 */ "	applyTo: 'frontend/**/*spec.ts'",
                        /* 08 */ "---",
                        /* 09 */ "The cactus on my desk has a thriving Instagram account.",
                        /* 10 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                        /* 11 */ "In an alternate universe, pigeons deliver sushi by drone.",
                        /* 12 */ "Lunar rainbows only appear when you sing in falsetto.",
                        /* 13 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                    ], INSTRUCTIONS_LANGUAGE_ID);
                    await test.validateReferences([
                        new ExpectedReference({
                            uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                            text: '[text](./foo-bar-baz/another-file.ts)',
                            path: './foo-bar-baz/another-file.ts',
                            startLine: 11,
                            startColumn: 43,
                            pathStartColumn: 50,
                            childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                        }),
                    ]);
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Prompt header must be defined.');
                    assert(metadata?.promptType === PromptsType.instructions, `Must be a 'instructions' metadata, got '${JSON.stringify(metadata)}'.`);
                    assert.deepStrictEqual(metadata, {
                        promptType: PromptsType.instructions,
                        description: 'My prompt.',
                        applyTo: 'frontend/**/*spec.ts',
                    }, 'Must have correct metadata.');
                });
            });
            suite(' • prompts', () => {
                test(`• empty header`, async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                        /* 01 */ "---",
                        /* 02 */ "",
                        /* 03 */ "---",
                        /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        /* 05 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                        /* 06 */ "In an alternate universe, pigeons deliver sushi by drone.",
                        /* 07 */ "Lunar rainbows only appear when you sing in falsetto.",
                        /* 08 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                    ], PROMPT_LANGUAGE_ID);
                    await test.validateReferences([
                        new ExpectedReference({
                            uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                            text: '[text](./foo-bar-baz/another-file.ts)',
                            path: './foo-bar-baz/another-file.ts',
                            startLine: 5,
                            startColumn: 43,
                            pathStartColumn: 50,
                            childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                        }),
                    ]);
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Prompt header must be defined.');
                    assert.deepStrictEqual(metadata, {
                        promptType: PromptsType.prompt,
                    }, 'Must have empty metadata.');
                });
                test(`• has correct 'prompt' metadata`, async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                        /* 01 */ "---",
                        /* 02 */ "description: 'My prompt.'\t\t",
                        /* 03 */ "	something: true", /* unknown metadata record */
                        /* 04 */ "	tools: [ 'tool_name1', \"tool_name2\", 'tool_name1', true, false, '', 'tool_name2' ]\t\t",
                        /* 05 */ "	tools: [ 'tool_name3', \"tool_name4\" ]", /* duplicate `tools` record is ignored */
                        /* 06 */ "	tools: 'tool_name5'", /* duplicate `tools` record with invalid value is ignored */
                        /* 07 */ "	mode: 'agent'",
                        /* 07 */ "	applyTo: 'frontend/**/*spec.ts'",
                        /* 08 */ "---",
                        /* 09 */ "The cactus on my desk has a thriving Instagram account.",
                        /* 10 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                        /* 11 */ "In an alternate universe, pigeons deliver sushi by drone.",
                        /* 12 */ "Lunar rainbows only appear when you sing in falsetto.",
                        /* 13 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                    ], PROMPT_LANGUAGE_ID);
                    await test.validateReferences([
                        new ExpectedReference({
                            uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                            text: '[text](./foo-bar-baz/another-file.ts)',
                            path: './foo-bar-baz/another-file.ts',
                            startLine: 11,
                            startColumn: 43,
                            pathStartColumn: 50,
                            childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                        }),
                    ]);
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Prompt header must be defined.');
                    assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                    assert.deepStrictEqual(metadata, {
                        promptType: PromptsType.prompt,
                        mode: 'agent',
                        description: 'My prompt.',
                        tools: ['tool_name1', 'tool_name2'],
                    }, 'Must have correct metadata.');
                });
            });
            suite(' • modes', () => {
                test(`• empty header`, async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                        /* 01 */ "---",
                        /* 02 */ "",
                        /* 03 */ "---",
                        /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        /* 05 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                        /* 06 */ "In an alternate universe, pigeons deliver sushi by drone.",
                        /* 07 */ "Lunar rainbows only appear when you sing in falsetto.",
                        /* 08 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                    ], MODE_LANGUAGE_ID);
                    await test.validateReferences([
                        new ExpectedReference({
                            uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                            text: '[text](./foo-bar-baz/another-file.ts)',
                            path: './foo-bar-baz/another-file.ts',
                            startLine: 5,
                            startColumn: 43,
                            pathStartColumn: 50,
                            childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                        }),
                    ]);
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Prompt header must be defined.');
                    assert.deepStrictEqual(metadata, {
                        promptType: PromptsType.mode,
                    }, 'Must have empty metadata.');
                });
                test(`• has correct metadata`, async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                        /* 01 */ "---",
                        /* 02 */ "description: 'My mode.'\t\t",
                        /* 03 */ "	something: true", /* unknown metadata record */
                        /* 04 */ "	tools: [ 'tool_name1', \"tool_name2\", 'tool_name1', true, false, '', 'tool_name2' ]\t\t",
                        /* 05 */ "	tools: [ 'tool_name3', \"tool_name4\" ]", /* duplicate `tools` record is ignored */
                        /* 06 */ "	tools: 'tool_name5'", /* duplicate `tools` record with invalid value is ignored */
                        /* 07 */ "	applyTo: 'frontend/**/*spec.ts'",
                        /* 08 */ "---",
                        /* 09 */ "The cactus on my desk has a thriving Instagram account.",
                        /* 10 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                        /* 11 */ "In an alternate universe, pigeons deliver sushi by drone.",
                        /* 12 */ "Lunar rainbows only appear when you sing in falsetto.",
                        /* 13 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                    ], MODE_LANGUAGE_ID);
                    await test.validateReferences([
                        new ExpectedReference({
                            uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                            text: '[text](./foo-bar-baz/another-file.ts)',
                            path: './foo-bar-baz/another-file.ts',
                            startLine: 10,
                            startColumn: 43,
                            pathStartColumn: 50,
                            childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                        }),
                    ]);
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Mode header must be defined.');
                    assert.deepStrictEqual(metadata, {
                        promptType: PromptsType.mode,
                        mode: 'agent',
                        description: 'My mode.',
                        tools: ['tool_name1', 'tool_name2'],
                    }, 'Must have correct metadata.');
                });
            });
        });
        suite('diagnostics', () => {
            test('core logic', async () => {
                const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                    /* 01 */ "---",
                    /* 02 */ "	description: true \t ",
                    /* 03 */ "	mode: \"ask\"",
                    /* 04 */ "	something: true", /* unknown metadata record */
                    /* 05 */ "tools: [ 'tool_name1', \"tool_name2\", 'tool_name1', true, false, '', ,'tool_name2' ] ",
                    /* 06 */ "  tools: [ 'tool_name3', \"tool_name4\" ]  \t\t  ", /* duplicate `tools` record is ignored */
                    /* 07 */ "tools: 'tool_name5'", /* duplicate `tools` record with invalid value is ignored */
                    /* 08 */ "---",
                    /* 09 */ "The cactus on my desk has a thriving Instagram account.",
                    /* 10 */ "Midnight snacks are the secret to eternal [text](./foo-bar-baz/another-file.ts) happiness.",
                    /* 11 */ "In an alternate universe, pigeons deliver sushi by drone.",
                    /* 12 */ "Lunar rainbows only appear when you sing in falsetto.",
                    /* 13 */ "Carrots have secret telepathic abilities, but only on Tuesdays.",
                ], PROMPT_LANGUAGE_ID);
                await test.validateReferences([
                    new ExpectedReference({
                        uri: URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'),
                        text: '[text](./foo-bar-baz/another-file.ts)',
                        path: './foo-bar-baz/another-file.ts',
                        startLine: 10,
                        startColumn: 43,
                        pathStartColumn: 50,
                        childrenOrError: new OpenFailed(URI.file('/absolute/folder/and/a/foo-bar-baz/another-file.ts'), 'File not found.'),
                    }),
                ]);
                const { header, metadata } = test.parser;
                assertDefined(header, 'Prompt header must be defined.');
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    mode: 'agent',
                    tools: ['tool_name1', 'tool_name2'],
                }, 'Must have correct metadata.');
                await test.validateHeaderDiagnostics([
                    new ExpectedDiagnosticError(new Range(2, 15, 2, 15 + 4), 'The \'description\' metadata must be a \'string\', got \'boolean\'.'),
                    new ExpectedDiagnosticWarning(new Range(4, 2, 4, 2 + 15), 'Unknown metadata \'something\' will be ignored.'),
                    new ExpectedDiagnosticWarning(new Range(5, 38, 5, 38 + 12), 'Duplicate tool name \'tool_name1\'.'),
                    new ExpectedDiagnosticWarning(new Range(5, 52, 5, 52 + 4), 'Unexpected tool name \'true\', expected \'string\'.'),
                    new ExpectedDiagnosticWarning(new Range(5, 58, 5, 58 + 5), 'Unexpected tool name \'false\', expected \'string\'.'),
                    new ExpectedDiagnosticWarning(new Range(5, 65, 5, 65 + 2), 'Tool name cannot be empty.'),
                    new ExpectedDiagnosticWarning(new Range(5, 70, 5, 70 + 12), 'Duplicate tool name \'tool_name2\'.'),
                    new ExpectedDiagnosticWarning(new Range(3, 2, 3, 2 + 11), `Record 'mode' is implied to have the 'agent' value if 'tools' record is present so the specified value will be ignored.`),
                    new ExpectedDiagnosticWarning(new Range(6, 3, 6, 3 + 37), `Duplicate metadata 'tools' will be ignored.`),
                    new ExpectedDiagnosticWarning(new Range(7, 1, 7, 1 + 19), `Duplicate metadata 'tools' will be ignored.`),
                ]);
            });
            suite('tools metadata', () => {
                test('tool names can be quoted and non-quoted string', async () => {
                    const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                        /* 01 */ "---",
                        /* 02 */ "tools: [tool1, 'tool2', \"tool3\", tool-4]",
                        /* 03 */ "---",
                        /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                    ], PROMPT_LANGUAGE_ID);
                    await test.allSettled();
                    const { header, metadata } = test.parser;
                    assertDefined(header, 'Prompt header must be defined.');
                    assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                    const { tools } = metadata;
                    assert.deepStrictEqual(tools, ['tool1', 'tool2', 'tool3', 'tool-4'], 'Mode metadata must have correct value.');
                    await test.validateHeaderDiagnostics([]);
                });
            });
            suite('applyTo metadata', () => {
                suite('language', () => {
                    test('prompt', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "applyTo: '**/*'",
                            /* 03 */ "mode: \"ask\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert.deepStrictEqual(metadata, {
                            promptType: PromptsType.prompt,
                            mode: ChatMode.Ask,
                        }, 'Must have correct metadata.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 1, 2, 1 + 15), `Unknown metadata 'applyTo' will be ignored.`),
                        ]);
                    });
                    test('instructions', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "applyTo: '**/*'",
                            /* 03 */ "mode: \"edit\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert.deepStrictEqual(metadata, {
                            promptType: PromptsType.instructions,
                            applyTo: '**/*',
                        }, 'Must have correct metadata.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(3, 1, 3, 13), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                });
            });
            test('invalid glob pattern', async () => {
                const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                    /* 01 */ "---",
                    /* 02 */ "mode: \"agent\"",
                    /* 03 */ "applyTo: ''",
                    /* 04 */ "---",
                    /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                ], INSTRUCTIONS_LANGUAGE_ID);
                await test.allSettled();
                const { header, metadata } = test.parser;
                assertDefined(header, 'Prompt header must be defined.');
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.instructions,
                }, 'Must have correct metadata.');
                await test.validateHeaderDiagnostics([
                    new ExpectedDiagnosticWarning(new Range(2, 1, 2, 14), `Unknown metadata 'mode' will be ignored.`),
                    new ExpectedDiagnosticWarning(new Range(3, 10, 3, 10 + 2), `Invalid glob pattern ''.`),
                ]);
            });
            suite('mode', () => {
                suite('invalid', () => {
                    test('quoted string value', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "mode: \"my-mode\"",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 1, 2, 7 + 9), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('single-token unquoted-string value', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "mode: myMode ",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 1, 2, 7 + 6), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('unquoted string value', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "mode: my-mode",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 1, 2, 7 + 7), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('multi-token unquoted-string value', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "mode: my mode is your mode\t \t",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 1, 2, 7 + 20), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('after a description metadata', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ "description: my clear but concise description",
                            /* 03 */ "mode: mode24",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(3, 1, 3, 7 + 6), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('boolean value', async () => {
                        const booleanValue = randomBoolean();
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ `	mode: \t${booleanValue}\t`,
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 2, 2, 9 + `${booleanValue}`.length), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('empty quoted string value', async () => {
                        const quotedString = (randomBoolean())
                            ? `''`
                            : '""';
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ `		mode: ${quotedString}`,
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 3, 2, 9 + `${quotedString}`.length), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('empty value', async () => {
                        const value = (randomBoolean())
                            ? '\t\t  \t\t'
                            : ' \t \v \t ';
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ `	\vmode: ${value}`,
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 3, 2, 9), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                    test('void value', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/my.prompt.md'), [
                            /* 01 */ "---",
                            /* 02 */ `	mode: `,
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], INSTRUCTIONS_LANGUAGE_ID);
                        await test.allSettled();
                        const { header } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(2, 2, 2, 8), `Unknown metadata 'mode' will be ignored.`),
                        ]);
                    });
                });
            });
            suite('tools and mode compatibility', () => {
                suite('tools is set', () => {
                    test('ask mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "tools: [ 'tool_name3', \"tool_name4\" ]  \t\t  ",
                            /* 03 */ "mode: \"ask\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assertDefined(tools, 'Tools metadata must be defined.');
                        assert.strictEqual(mode, ChatMode.Agent, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(3, 1, 3, 1 + 11), 'Record \'mode\' is implied to have the \'agent\' value if \'tools\' record is present so the specified value will be ignored.'),
                        ]);
                    });
                    test('edit mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "tools: [ 'tool_name3', \"tool_name4\" ]  \t\t  ",
                            /* 03 */ "mode: \"edit\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assertDefined(tools, 'Tools metadata must be defined.');
                        assert.strictEqual(mode, ChatMode.Agent, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticWarning(new Range(3, 1, 3, 1 + 12), 'Record \'mode\' is implied to have the \'agent\' value if \'tools\' record is present so the specified value will be ignored.'),
                        ]);
                    });
                    test('agent mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "tools: [ 'tool_name3', \"tool_name4\" ]  \t\t  ",
                            /* 03 */ "mode: \"agent\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assertDefined(tools, 'Tools metadata must be defined.');
                        assert.strictEqual(mode, ChatMode.Agent, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([]);
                    });
                    test('no mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "tools: [ 'tool_name3', \"tool_name4\" ]  \t\t  ",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assertDefined(tools, 'Tools metadata must be defined.');
                        assert.strictEqual(mode, ChatMode.Agent, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([]);
                    });
                    test('invalid mode', async () => {
                        const value = (randomBoolean())
                            ? 'unknown mode  '
                            : 'unknown';
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "tools: [ 'tool_name3', \"tool_name4\" ]  \t\t  ",
                            /* 03 */ `mode:  \t\t${value}`,
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assertDefined(tools, 'Tools metadata must be defined.');
                        assert.strictEqual(mode, ChatMode.Agent, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticError(new Range(3, 10, 3, 10 + value.trim().length), `The 'mode' metadata must be one of 'ask' | 'edit' | 'agent', got '${value.trim()}'.`),
                        ]);
                    });
                });
                suite('tools is not set', () => {
                    test('ask mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "description: ['my prompt', 'description.']",
                            /* 03 */ "mode: \"ask\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assert(tools === undefined, 'Tools metadata must not be defined.');
                        assert.strictEqual(mode, ChatMode.Ask, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([
                            new ExpectedDiagnosticError(new Range(2, 14, 2, 14 + 29), `The 'description' metadata must be a 'string', got 'array'.`),
                        ]);
                    });
                    test('edit mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "description: my prompt description. \t\t  \t\t   ",
                            /* 03 */ "mode: \"edit\"",
                            /* 04 */ "---",
                            /* 05 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assert(tools === undefined, 'Tools metadata must not be defined.');
                        assert.strictEqual(mode, ChatMode.Edit, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([]);
                    });
                    test('agent mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "mode: \"agent\"",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assert(metadata?.promptType === PromptsType.prompt, `Must be a 'prompt' metadata, got '${JSON.stringify(metadata)}'.`);
                        const { tools, mode } = metadata;
                        assert(tools === undefined, 'Tools metadata must not be defined.');
                        assert.strictEqual(mode, ChatMode.Agent, 'Mode metadata must have correct value.');
                        await test.validateHeaderDiagnostics([]);
                    });
                    test('no mode', async () => {
                        const test = createTest(URI.file('/absolute/folder/and/a/filename.txt'), [
                            /* 01 */ "---",
                            /* 02 */ "description: 'My prompt.'",
                            /* 03 */ "---",
                            /* 04 */ "The cactus on my desk has a thriving Instagram account.",
                        ], PROMPT_LANGUAGE_ID);
                        await test.allSettled();
                        const { header, metadata } = test.parser;
                        assertDefined(header, 'Prompt header must be defined.');
                        assertDefined(metadata, 'Prompt metadata and metadata must be defined.');
                        assert(('tools' in metadata) === false, 'Tools metadata must not be defined.');
                        assert(('mode' in metadata) === false, 'Mode metadata must not be defined.');
                        await test.validateHeaderDiagnostics([]);
                    });
                });
            });
        });
    });
    test('gets disposed with the model', async () => {
        const test = createTest(URI.file('/some/path/file.prompt.md'), [
            'line1',
            'line2',
            'line3',
        ]);
        // no references in the model contents
        await test.validateReferences([]);
        test.model.dispose();
        assert(test.parser.isDisposed, 'The parser should be disposed with its model.');
    });
    test('toString()', async () => {
        const modelUri = URI.file('/Users/legomushroom/repos/prompt-snippets/README.md');
        const test = createTest(modelUri, [
            'line1',
            'line2',
            'line3',
        ]);
        assert.strictEqual(test.parser.toString(), `text-model-prompt:${modelUri.path}`, 'The parser should provide correct `toString()` implementation.');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1vZGVsUHJvbXB0UGFyc2VyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvdGV4dE1vZGVsUHJvbXB0UGFyc2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUV6RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM3RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbkYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM3SSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDeEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxXQUFXLEVB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