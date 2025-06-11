/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { typeCheck } from '../../../../../../../base/common/types.js';
import { randomInt } from '../../../../../../../base/common/numbers.js';
import { randomBoolean } from '../../../../../../../base/test/common/testUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { mockObject, mockService } from '../../promptSyntax/utils/mock.js';
suite('mockService', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('mockObject', () => {
        test('overrides properties and functions', () => {
            const mock = mockObject({
                bar: 'oh hi!',
                baz: 42,
                anotherMethod(arg) {
                    return isNaN(arg);
                },
            });
            typeCheck(mock);
            assert.strictEqual(mock.bar, 'oh hi!', 'bar should be overriden');
            assert.strictEqual(mock.baz, 42, 'baz should be overriden');
            assert(!(mock.anotherMethod(randomInt(100))), 'Must execute overriden method correctly 1.');
            assert(mock.anotherMethod(NaN), 'Must execute overriden method correctly 2.');
            assert.throws(() => {
                // property is not overriden so must throw
                // eslint-disable-next-line local/code-no-unused-expressions
                mock.foo;
            });
            assert.throws(() => {
                // function is not overriden so must throw
                mock.someMethod(randomBoolean());
            });
        });
        test('immutability of the overrides object', () => {
            const overrides = {
                baz: 4,
            };
            const mock = mockObject(overrides);
            typeCheck(mock);
            assert.strictEqual(mock.baz, 4, 'baz should be overridden');
            // overrides object must be immutable
            assert.throws(() => {
                overrides.foo = 'test';
            });
            assert.throws(() => {
                overrides.someMethod = (arg) => {
                    return `${arg}__${arg}`;
                };
            });
        });
    });
    suite('mockService', () => {
        test('overrides properties and functions', () => {
            const mock = mockService({
                id: 'ciao!',
                counter: 74,
                testMethod2(arg) {
                    return !isNaN(arg);
                },
            });
            typeCheck(mock);
            assert.strictEqual(mock.id, 'ciao!', 'id should be overridden');
            assert.strictEqual(mock.counter, 74, 'counter should be overridden');
            assert(mock.testMethod2(randomInt(100)), 'Must execute overridden method correctly 1.');
            assert(!(mock.testMethod2(NaN)), 'Must execute overridden method correctly 2.');
            assert.throws(() => {
                // property is not overridden so must throw
                // eslint-disable-next-line local/code-no-unused-expressions
                mock.prop1;
            });
            assert.throws(() => {
                // function is not overridden so must throw
                mock.method1(randomBoolean());
            });
        });
        test('immutability of the overrides object', () => {
            const overrides = {
                baz: false,
            };
            const mock = mockService(overrides);
            typeCheck(mock);
            assert.strictEqual(mock.baz, false, 'baz should be overridden');
            // overrides object must be immutable
            assert.throws(() => {
                overrides.foo = 'test';
            });
            assert.throws(() => {
                overrides.someMethod = (arg) => {
                    return `${arg}__${arg}`;
                };
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL2NvbmZpZy91dGlscy9tb2NrLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBRTVCLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFM0UsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7SUFDekIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRTtRQUN4QixJQUFJLENBQUMsb0NBQW9DLEVBQUUsR0FBRyxFQUFFO1lBUy9DLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBYztnQkFDcEMsR0FBRyxFQUFFLFFBQVE7Z0JBQ2IsR0FBRyxFQUFFLEVBQUU7Z0JBQ1AsYUFBYSxDQUFDLEdBQVc7b0JBQ3hCLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNuQixDQUFDO2FBQ0QsQ0FBQyxDQUFDO1lBRUgsU0FBUyxDQUFjLElBQUksQ0FBQyxDQUFDO1lBRTdCLE1BQU0sQ0FBQyxXQUFXLENBQ2pCLElBQUksQ0FBQyxHQUFHLEVBQ1IsUUFBUSxFQUNSLHlCQUF5QixDQUN6QixDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsSUFBSSxDQUFDLEdBQUcsRUFDUixF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