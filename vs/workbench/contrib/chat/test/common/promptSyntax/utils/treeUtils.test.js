/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { randomInt } from '../../../../../../../base/common/numbers.js';
import { Range } from '../../../../../../../editor/common/core/range.js';
import { BaseToken } from '../../../../common/promptSyntax/codecs/base/baseToken.js';
import { CompositeToken } from '../../../../common/promptSyntax/codecs/base/compositeToken.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { curry, difference, flatten, forEach, map } from '../../../../common/promptSyntax/utils/treeUtils.js';
import { ExclamationMark, Space, Tab, VerticalTab, Word } from '../../../../common/promptSyntax/codecs/base/simpleCodec/tokens/tokens.js';
suite('tree utilities', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('flatten', () => {
        const tree = {
            id: '1',
            children: [
                {
                    id: '1.1',
                },
                {
                    id: '1.2',
                    children: [
                        {
                            id: '1.2.1',
                            children: [
                                {
                                    id: '1.2.1.1',
                                },
                                {
                                    id: '1.2.1.2',
                                },
                                {
                                    id: '1.2.1.3',
                                }
                            ],
                        },
                        {
                            id: '1.2.2',
                        },
                    ]
                },
            ],
        };
        assert.deepStrictEqual(flatten(tree), [
            tree,
            tree.children[0],
            tree.children[1],
            tree.children[1].children[0],
            tree.children[1].children[0].children[0],
            tree.children[1].children[0].children[1],
            tree.children[1].children[0].children[2],
            tree.children[1].children[1],
        ]);
        assert.deepStrictEqual(flatten({}), [{}]);
    });
    suite('forEach', () => {
        test('iterates though all nodes', () => {
            const tree = {
                id: '1',
                children: [
                    {
                        id: '1.1',
                    },
                    {
                        id: '1.2',
                        children: [
                            {
                                id: '1.2.1',
                                children: [
                                    {
                                        id: '1.2.1.1',
                                    },
                                    {
                                        id: '1.2.1.2',
                                    },
                                    {
                                        id: '1.2.1.3',
                                    }
                                ],
                            },
                            {
                                id: '1.2.2',
                            },
                        ]
                    },
                ],
            };
            const treeCopy = JSON.parse(JSON.stringify(tree));
            const seenIds = [];
            forEach((node) => {
                seenIds.push(node.id);
                return false;
            }, tree);
            assert.deepStrictEqual(seenIds, [
                '1',
                '1.1',
                '1.2',
                '1.2.1',
                '1.2.1.1',
                '1.2.1.2',
                '1.2.1.3',
                '1.2.2',
            ]);
            assert.deepStrictEqual(treeCopy, tree, 'forEach should not modify the tree');
        });
        test('can be stopped prematurely', () => {
            const tree = {
                id: '1',
                children: [
                    {
                        id: '1.1',
                    },
                    {
                        id: '1.2',
                        children: [
                            {
                                id: '1.2.1',
                                children: [
                                    {
                                        id: '1.2.1.1',
                                    },
                                    {
                                        id: '1.2.1.2',
                                    },
                                    {
                                        id: '1.2.1.3',
                                        children: [
                                            {
                                                id: '1.2.1.3.1',
                                            },
                                        ],
                                    }
                                ],
                            },
                            {
                                id: '1.2.2',
                            },
                        ]
                    },
                ],
            };
            const treeCopy = JSON.parse(JSON.stringify(tree));
            const seenIds = [];
            forEach((node) => {
                seenIds.push(node.id);
                if (node.id === '1.2.1') {
                    return true; // stop traversing
                }
                return false;
            }, tree);
            assert.deepStrictEqual(seenIds, [
                '1',
                '1.1',
                '1.2',
                '1.2.1',
            ]);
            assert.deepStrictEqual(treeCopy, tree, 'forEach should not modify the tree');
        });
    });
    suite('map', () => {
        test('maps a tree', () => {
            const tree = {
                id: '1',
                children: [
                    {
                        id: '1.1',
                    },
                    {
                        id: '1.2',
                        children: [
                            {
                                id: '1.2.1',
                                children: [
                                    {
                                        id: '1.2.1.1',
                                    },
                                    {
                                        id: '1.2.1.2',
                                    },
                                    {
                                        id: '1.2.1.3',
                                    }
                                ],
                            },
                            {
                                id: '1.2.2',
                            },
                        ]
                    },
                ],
            };
            const treeCopy = JSON.parse(JSON.stringify(tree));
            const newRootNode = {
                newId: '__1__',
            };
            const newChildNode = {
                newId: '__1.2.1.3__',
            };
            const newTree = map((node) => {
                if (node.id === '1') {
                    return newRootNode;
                }
                if (node.id === '1.2.1.3') {
                    return newChildNode;
                }
                return {
                    newId: `__${node.id}__`,
                };
            }, tree);
            assert.deepStrictEqual(newTree, {
                newId: '__1__',
                children: [
                    {
                        newId: '__1.1__',
                    },
                    {
                        newId: '__1.2__',
                        children: [
                            {
                                newId: '__1.2.1__',
                                children: [
                                    {
                                        newId: '__1.2.1.1__',
                                    },
                                    {
                                        newId: '__1.2.1.2__',
                                    },
                                    {
                                        newId: '__1.2.1.3__',
                                    },
                                ],
                            },
                            {
                                newId: '__1.2.2__',
                            },
                        ]
                    },
                ],
            });
            assert(newRootNode === newTree, 'Map should not replace return node reference (root node).');
            assert(newChildNode === newTree.children[1].children[0].children[2], 'Map should not replace return node reference (child node).');
            assert.deepStrictEqual(treeCopy, tree, 'forEach should not modify the tree');
        });
        test('callback can control resulting children', () => {
            const tree = {
                id: '1',
                children: [
                    { id: '1.1' },
                    {
                        id: '1.2',
                        children: [
                            {
                                id: '1.2.1',
                                children: [
                                    { id: '1.2.1.1' },
                                    { id: '1.2.1.2' },
                                    {
                                        id: '1.2.1.3',
                                        children: [
                                            {
                                                id: '1.2.1.3.1',
                                            },
                                            {
                                                id: '1.2.1.3.2',
                                            },
                                        ],
                                    }
                                ],
                            },
                            {
                                id: '1.2.2',
                                children: [
                                    { id: '1.2.2.1' },
                                    { id: '1.2.2.2' },
                                    { id: '1.2.2.3' },
                                ],
                            },
                            {
                                id: '1.2.3',
                                children: [
                                    { id: '1.2.3.1' },
                                    { id: '1.2.3.2' },
                                    { id: '1.2.3.3' },
                                    { id: '1.2.3.4' },
                                ],
                            },
                        ]
                    },
                ],
            };
            const treeCopy = JSON.parse(JSON.stringify(tree));
            const newNodeWithoutChildren = {
                newId: '__1.2.1.3__',
                children: undefined,
            };
            const newTree = map((node, newChildren) => {
                // validates that explicitly setting `children` to
                // `undefined` will be preserved on the resulting new node
                if (node.id === '1.2.1.3') {
                    return newNodeWithoutChildren;
                }
                // validates that setting `children` to a new array
                // will be preserved on the resulting new node
                if (node.id === '1.2.2') {
                    assert.deepStrictEqual(newChildren, [
                        { newId: '__1.2.2.1__' },
                        { newId: '__1.2.2.2__' },
                        { newId: '__1.2.2.3__' },
                    ], `Node '${node.id}' must have correct new children.`);
                    return {
                        newId: `__${node.id}__`,
                        children: [newChildren[2]],
                    };
                }
                // validates that modifying `newChildren` directly
                // will be preserved on the resulting new node
                if (node.id === '1.2.3') {
                    assert.deepStrictEqual(newChildren, [
                        { newId: '__1.2.3.1__' },
                        { newId: '__1.2.3.2__' },
                        { newId: '__1.2.3.3__' },
                        { newId: '__1.2.3.4__' },
                    ], `Node '${node.id}' must have correct new children.`);
                    newChildren.length = 2;
                    return {
                        newId: `__${node.id}__`,
                    };
                }
                // convert to a new node in all other cases
                return {
                    newId: `__${node.id}__`,
                };
            }, tree);
            assert.deepStrictEqual(newTree, {
                newId: '__1__',
                children: [
                    { newId: '__1.1__' },
                    {
                        newId: '__1.2__',
                        children: [
                            {
                                newId: '__1.2.1__',
                                children: [
                                    { newId: '__1.2.1.1__' },
                                    { newId: '__1.2.1.2__' },
                                    {
                                        newId: '__1.2.1.3__',
                                        children: undefined,
                                    },
                                ],
                            },
                            {
                                newId: '__1.2.2__',
                                children: [
                                    { newId: '__1.2.2.3__' },
                                ],
                            },
                            {
                                newId: '__1.2.3__',
                                children: [
                                    { newId: '__1.2.3.1__' },
                                    { newId: '__1.2.3.2__' },
                                ],
                            },
                        ]
                    },
                ],
            });
            assert(newNodeWithoutChildren === newTree.children[1].children[0].children[2], 'Map should not replace return node reference (node without children).');
            assert.deepStrictEqual(treeCopy, tree, 'forEach should not modify the tree');
        });
    });
    test('curry', () => {
        const originalFunction = (a, b, c) => {
            return a + b + c;
        };
        const firstArgument = randomInt(100, -100);
        const curriedFunction = curry(originalFunction, firstArgument);
        let iterations = 10;
        while (iterations-- > 0) {
            const secondArgument = randomInt(100, -100);
            const thirdArgument = randomInt(100, -100);
            assert.strictEqual(curriedFunction(secondArgument, thirdArgument), originalFunction(firstArgument, secondArgument, thirdArgument), 'Curried and original functions must yield the same result.');
            // a sanity check to ensure we don't compare ambiguous infinities
            assert(isFinite(originalFunction(firstArgument, secondArgument, thirdArgument)), 'Function results must be finite.');
        }
    });
    suite('difference', () => {
        class TestCompositeToken extends CompositeToken {
            toString() {
                return `CompositeToken:\n${BaseToken.render(this.children, '\n')})`;
            }
        }
        test('tree roots differ (no children)', () => {
            const tree1 = new Word(new Range(1, 1, 1, 1 + 5), 'hello');
            const tree2 = new Word(new Range(1, 1, 1, 1 + 5), 'halou');
            assert.deepStrictEqual(difference(tree1, tree2), {
                index: 0,
                object1: tree1,
                object2: tree2,
            }, 'Unexpected difference between token trees.');
        });
        test('returns tree difference (single children level)', () => {
            const tree1 = asTreeNode(new Word(new Range(1, 1, 1, 1 + 5), 'hello'), [
                new Space(new Range(1, 6, 1, 7)),
                new Word(new Range(1, 7, 1, 7 + 5), 'world'),
            ]);
            const tree2 = asTreeNode(new Word(new Range(1, 1, 1, 1 + 5), 'hello'), [
                new Space(new Range(1, 6, 1, 7)),
                new Word(new Range(1, 7, 1, 7 + 6), 'world!'),
            ]);
            assert.deepStrictEqual(difference(tree1, tree2), {
                index: 0,
                object1: tree1,
                object2: tree2,
                children: [
                    {
                        index: 1,
                        object1: new Word(new Range(1, 7, 1, 7 + 5), 'world'),
                        object2: new Word(new Range(1, 7, 1, 7 + 6), 'world!'),
                    }
                ],
            }, 'Unexpected difference between token trees.');
        });
        test('returns tree difference (multiple children levels)', () => {
            const compositeToken1 = new TestCompositeToken([
                new VerticalTab(new Range(1, 13, 1, 14)),
                new Space(new Range(1, 14, 1, 15)),
                new Word(new Range(1, 15, 1, 15 + 5), 'again'),
                new ExclamationMark(new Range(1, 20, 1, 21)),
            ]);
            const tree1 = asTreeNode(new Word(new Range(1, 1, 1, 1 + 5), 'hello'), [
                new Space(new Range(1, 6, 1, 7)),
                new Word(new Range(1, 7, 1, 7 + 5), 'world'),
                compositeToken1,
            ]);
            const compositeToken2 = new TestCompositeToken([
                new VerticalTab(new Range(1, 13, 1, 14)),
                new Space(new Range(1, 14, 1, 15)),
                new Word(new Range(1, 15, 1, 15 + 5), 'again'),
                new Tab(new Range(1, 20, 1, 21)),
                new ExclamationMark(new Range(1, 21, 1, 22)),
            ]);
            const tree2 = asTreeNode(new Word(new Range(1, 1, 1, 1 + 5), 'hello'), [
                new Space(new Range(1, 6, 1, 7)),
                new Word(new Range(1, 7, 1, 7 + 5), 'world'),
                compositeToken2,
            ]);
            assert.deepStrictEqual(difference(tree1, tree2), {
                index: 0,
                object1: tree1,
                object2: tree2,
                children: [
                    {
                        index: 2,
                        object1: compositeToken1,
                        object2: compositeToken2,
                        children: [
                            {
                                index: 3,
                                object1: compositeToken1.children[3],
                                object2: compositeToken2.children[3],
                            },
                            {
                                index: 4,
                                object1: null,
                                object2: compositeToken2.children[4],
                            },
                        ],
                    }
                ],
            }, 'Unexpected difference between token trees.');
        });
        test('returns null for equal trees', () => {
            const tree1 = new TestCompositeToken([
                asTreeNode(new Word(new Range(1, 1, 1, 1 + 5), 'hello'), []),
                asTreeNode(new Space(new Range(1, 6, 1, 7)), []),
                asTreeNode(new Word(new Range(1, 7, 1, 7 + 6), 'world!'), []),
            ]);
            const tree2 = new TestCompositeToken([
                asTreeNode(new Word(new Range(1, 1, 1, 1 + 5), 'hello'), []),
                asTreeNode(new Space(new Range(1, 6, 1, 7)), []),
                asTreeNode(new Word(new Range(1, 7, 1, 7 + 6), 'world!'), []),
            ]);
            assert.strictEqual(difference(tree1, tree2), null, 'Unexpected difference between token trees.');
            assert.strictEqual(difference(tree1, tree1), null, 'Must be a null difference when compared with itself.');
        });
    });
});
/**
 * Add provided 'children' list to a given object hence
 * allowing the object to be used as a general tree node.
 */
function asTreeNode(item, children) {
    return new Proxy(item, {
        get(target, prop, _receiver) {
            if (prop === 'children') {
                return children;
            }
            // tokens equality uses the 'constructor' property for
            // comparison, hence we need to return the original one
            if (prop === 'constructor') {
                return target.constructor;
            }
            const result = Reflect.get(target, prop);
            if (typeof result === 'function') {
                return result.bind(target);
            }
            return result;
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVV0aWxzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vcHJvbXB0U3ludGF4L3V0aWxzL3RyZWVVdGlscy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDeEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNyRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDL0YsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDekcsT0FBTyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQVMsTUFBTSxvREFBb0QsQ0FBQztBQUNySCxPQUFPLEVBQUUsZUFBZSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxNQUFNLDBFQUEwRSxDQUFDO0FBRTFJLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7SUFDNUIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRTtRQUNwQixNQUFNLElBQUksR0FBRztZQUNaLEVBQUUsRUFBRSxHQUFHO1lBQ1AsUUFBUSxFQUFFO2dCQUNUO29CQUNDLEVBQUUsRUFBRSxLQUFLO2lCQUNUO2dCQUNEO29CQUNDLEVBQUUsRUFBRSxLQUFLO29CQUNULFFBQVEsRUFBRTt3QkFDVDs0QkFDQyxFQUFFLEVBQUUsT0FBTzs0QkFDWCxRQUFRLEVBQUU7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