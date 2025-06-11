/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as path from '../../../../../base/common/path.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { deserializeSearchError, SearchErrorCode } from '../../common/search.js';
import { TextSearchEngineAdapter } from '../../node/textSearchAdapter.js';
import { flakySuite } from '../../../../../base/test/node/testUtils.js';
import { FileAccess } from '../../../../../base/common/network.js';
const TEST_FIXTURES = path.normalize(FileAccess.asFileUri('vs/workbench/services/search/test/node/fixtures').fsPath);
const EXAMPLES_FIXTURES = path.join(TEST_FIXTURES, 'examples');
const MORE_FIXTURES = path.join(TEST_FIXTURES, 'more');
const TEST_ROOT_FOLDER = { folder: URI.file(TEST_FIXTURES) };
const ROOT_FOLDER_QUERY = [
    TEST_ROOT_FOLDER
];
const MULTIROOT_QUERIES = [
    { folder: URI.file(EXAMPLES_FIXTURES) },
    { folder: URI.file(MORE_FIXTURES) }
];
function doSearchTest(query, expectedResultCount) {
    const engine = new TextSearchEngineAdapter(query);
    let c = 0;
    const results = [];
    return engine.search(new CancellationTokenSource().token, _results => {
        if (_results) {
            c += _results.reduce((acc, cur) => acc + cur.numMatches, 0);
            results.push(..._results);
        }
    }, () => { }).then(() => {
        if (typeof expectedResultCount === 'function') {
            assert(expectedResultCount(c));
        }
        else {
            assert.strictEqual(c, expectedResultCount, `rg ${c} !== ${expectedResultCount}`);
        }
        return results;
    });
}
flakySuite('TextSearch-integration', function () {
    test('Text: GameOfLife', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'GameOfLife' },
        };
        return doSearchTest(config, 4);
    });
    test('Text: GameOfLife (RegExp)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'Game.?fL\\w?fe', isRegExp: true }
        };
        return doSearchTest(config, 4);
    });
    test('Text: GameOfLife (unicode escape sequences)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'G\\u{0061}m\\u0065OfLife', isRegExp: true }
        };
        return doSearchTest(config, 4);
    });
    test('Text: GameOfLife (unicode escape sequences, force PCRE2)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: '(?<!a)G\\u{0061}m\\u0065OfLife', isRegExp: true }
        };
        return doSearchTest(config, 4);
    });
    test('Text: GameOfLife (PCRE2 RegExp)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            usePCRE2: true,
            contentPattern: { pattern: 'Life(?!P)', isRegExp: true }
        };
        return doSearchTest(config, 8);
    });
    test('Text: GameOfLife (RegExp to EOL)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'GameOfLife.*', isRegExp: true }
        };
        return doSearchTest(config, 4);
    });
    test('Text: GameOfLife (Word Match, Case Sensitive)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'GameOfLife', isWordMatch: true, isCaseSensitive: true }
        };
        return doSearchTest(config, 4);
    });
    test('Text: GameOfLife (Word Match, Spaces)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: ' GameOfLife ', isWordMatch: true }
        };
        return doSearchTest(config, 1);
    });
    test('Text: GameOfLife (Word Match, Punctuation and Spaces)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: ', as =', isWordMatch: true }
        };
        return doSearchTest(config, 1);
    });
    test('Text: Helvetica (UTF 16)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'Helvetica' }
        };
        return doSearchTest(config, 3);
    });
    test('Text: e', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'e' }
        };
        return doSearchTest(config, 785);
    });
    test('Text: e (with excludes)', () => {
        const config = {
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'e' },
            excludePattern: { '**/examples': true }
        };
        return doSearchTest(config, 391);
    });
    test('Text: e (with includes)', () => {
        const config = {
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'e' },
            includePattern: { '**/examples/**': true }
        };
        return doSearchTest(config, 394);
    });
    // TODO
    // test('Text: e (with absolute path excludes)', () => {
    // 	const config: any = {
    // 		folderQueries: ROOT_FOLDER_QUERY,
    // 		contentPattern: { pattern: 'e' },
    // 		excludePattern: makeExpression(path.join(TEST_FIXTURES, '**/examples'))
    // 	};
    // 	return doSearchTest(config, 394);
    // });
    // test('Text: e (with mixed absolute/relative path excludes)', () => {
    // 	const config: any = {
    // 		folderQueries: ROOT_FOLDER_QUERY,
    // 		contentPattern: { pattern: 'e' },
    // 		excludePattern: makeExpression(path.join(TEST_FIXTURES, '**/examples'), '*.css')
    // 	};
    // 	return doSearchTest(config, 310);
    // });
    test('Text: sibling exclude', () => {
        const config = {
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'm' },
            includePattern: makeExpression('**/site*'),
            excludePattern: { '*.css': { when: '$(basename).less' } }
        };
        return doSearchTest(config, 1);
    });
    test('Text: e (with includes and exclude)', () => {
        const config = {
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'e' },
            includePattern: { '**/examples/**': true },
            excludePattern: { '**/examples/small.js': true }
        };
        return doSearchTest(config, 371);
    });
    test('Text: a (capped)', () => {
        const maxResults = 520;
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'a' },
            maxResults
        };
        return doSearchTest(config, maxResults);
    });
    test('Text: a (no results)', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'ahsogehtdas' }
        };
        return doSearchTest(config, 0);
    });
    test('Text: -size', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: '-size' }
        };
        return doSearchTest(config, 9);
    });
    test('Multiroot: Conway', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: MULTIROOT_QUERIES,
            contentPattern: { pattern: 'conway' }
        };
        return doSearchTest(config, 8);
    });
    test('Multiroot: e with partial global exclude', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: MULTIROOT_QUERIES,
            contentPattern: { pattern: 'e' },
            excludePattern: makeExpression('**/*.txt')
        };
        return doSearchTest(config, 394);
    });
    test('Multiroot: e with global excludes', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: MULTIROOT_QUERIES,
            contentPattern: { pattern: 'e' },
            excludePattern: makeExpression('**/*.txt', '**/*.js')
        };
        return doSearchTest(config, 0);
    });
    test('Multiroot: e with folder exclude', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: [
                {
                    folder: URI.file(EXAMPLES_FIXTURES), excludePattern: [{
                            pattern: makeExpression('**/e*.js')
                        }]
                },
                { folder: URI.file(MORE_FIXTURES) }
            ],
            contentPattern: { pattern: 'e' }
        };
        return doSearchTest(config, 298);
    });
    test('Text: 语', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: '语' }
        };
        return doSearchTest(config, 1).then(results => {
            const matchRange = results[0].results[0].rangeLocations.map(e => e.source);
            assert.deepStrictEqual(matchRange, [{
                    startLineNumber: 0,
                    startColumn: 1,
                    endLineNumber: 0,
                    endColumn: 2
                }]);
        });
    });
    test('Multiple matches on line: h\\d,', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'h\\d,', isRegExp: true }
        };
        return doSearchTest(config, 15).then(results => {
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].results.length, 1);
            const match = results[0].results[0];
            assert.strictEqual(match.rangeLocations.map(e => e.source).length, 5);
        });
    });
    test('Search with context matches', () => {
        const config = {
            type: 2 /* QueryType.Text */,
            folderQueries: ROOT_FOLDER_QUERY,
            contentPattern: { pattern: 'compiler.typeCheck();' },
            surroundingContext: 1,
        };
        return doSearchTest(config, 3).then(results => {
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].results[0].lineNumber, 24);
            assert.strictEqual(results[0].results[0].text, '        compiler.addUnit(prog,"input.ts");');
            // assert.strictEqual((<ITextSearchMatch>results[1].results[0]).preview.text, '        compiler.typeCheck();\n'); // See https://github.com/BurntSushi/ripgrep/issues/1095
            assert.strictEqual(results[2].results[0].lineNumber, 26);
            assert.strictEqual(results[2].results[0].text, '        compiler.emit();');
        });
    });
    suite('error messages', () => {
        test('invalid encoding', () => {
            const config = {
                type: 2 /* QueryType.Text */,
                folderQueries: [
                    {
                        ...TEST_ROOT_FOLDER,
                        fileEncoding: 'invalidEncoding'
                    }
                ],
                contentPattern: { pattern: 'test' },
            };
            return doSearchTest(config, 0).then(() => {
                throw new Error('expected fail');
            }, err => {
                const searchError = deserializeSearchError(err);
                assert.strictEqual(searchError.message, 'Unknown encoding: invalidEncoding');
                assert.strictEqual(searchError.code, SearchErrorCode.unknownEncoding);
            });
        });
        test('invalid regex case 1', () => {
            const config = {
                type: 2 /* QueryType.Text */,
                folderQueries: ROOT_FOLDER_QUERY,
                contentPattern: { pattern: ')', isRegExp: true },
            };
            return doSearchTest(config, 0).then(() => {
                throw new Error('expected fail');
            }, err => {
                const searchError = deserializeSearchError(err);
                const regexParseErrorForUnclosedParenthesis = 'Regex parse error: unmatched closing parenthesis';
                assert.strictEqual(searchError.message, regexParseErrorForUnclosedParenthesis);
                assert.strictEqual(searchError.code, SearchErrorCode.regexParseError);
            });
        });
        test('invalid regex case 2', () => {
            const config = {
                type: 2 /* QueryType.Text */,
                folderQueries: ROOT_FOLDER_QUERY,
                contentPattern: { pattern: '(?<!a.*)', isRegExp: true },
            };
            return doSearchTest(config, 0).then(() => {
                throw new Error('expected fail');
            }, err => {
                const searchError = deserializeSearchError(err);
                const regexParseErrorForLookAround = 'Regex parse error: lookbehind assertion is not fixed length';
                assert.strictEqual(searchError.message, regexParseErrorForLookAround);
                assert.strictEqual(searchError.code, SearchErrorCode.regexParseError);
            });
        });
        test('invalid glob', () => {
            const config = {
                type: 2 /* QueryType.Text */,
                folderQueries: ROOT_FOLDER_QUERY,
                contentPattern: { pattern: 'foo' },
                includePattern: {
                    '{{}': true
                }
            };
            return doSearchTest(config, 0).then(() => {
                throw new Error('expected fail');
            }, err => {
                const searchError = deserializeSearchError(err);
                assert.strictEqual(searchError.message, 'Error parsing glob \'/{{}\': nested alternate groups are not allowed');
                assert.strictEqual(searchError.code, SearchErrorCode.globParseError);
            });
        });
    });
});
function makeExpression(...patterns) {
    return patterns.reduce((glob, pattern) => {
        // glob.ts needs forward slashes
        pattern = pattern.replace(/\\/g, '/');
        glob[pattern] = true;
        return glob;
    }, Object.create(null));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dFNlYXJjaC5pbnRlZ3JhdGlvblRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zZWFyY2gvdGVzdC9ub2RlL3RleHRTZWFyY2guaW50ZWdyYXRpb25UZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEtBQUssSUFBSSxNQUFNLG9DQUFvQyxDQUFDO0FBQzNELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRXJGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsc0JBQXNCLEVBQTJGLGVBQWUsRUFBd0IsTUFBTSx3QkFBd0IsQ0FBQztBQUNoTSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRW5FLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxpREFBaUQsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3JILE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDL0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDdkQsTUFBTSxnQkFBZ0IsR0FBaUIsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO0FBQzNFLE1BQU0saUJBQWlCLEdBQW1CO0lBQ3pD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