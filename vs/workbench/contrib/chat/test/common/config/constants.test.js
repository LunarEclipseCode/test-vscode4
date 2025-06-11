/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { getCleanPromptName, isPromptOrInstructionsFile } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { randomInt } from '../../../../../../base/common/numbers.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { URI } from '../../../../../../base/common/uri.js';
suite('Prompt Constants', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('getCleanPromptName', () => {
        test('returns a clean prompt name', () => {
            assert.strictEqual(getCleanPromptName(URI.file('/path/to/my-prompt.prompt.md')), 'my-prompt');
            assert.strictEqual(getCleanPromptName(URI.file('../common.prompt.md')), 'common');
            const expectedPromptName = `some-${randomInt(1000)}`;
            assert.strictEqual(getCleanPromptName(URI.file(`./${expectedPromptName}.prompt.md`)), expectedPromptName);
            assert.strictEqual(getCleanPromptName(URI.file('.github/copilot-instructions.md')), 'copilot-instructions');
            assert.strictEqual(getCleanPromptName(URI.file('/etc/prompts/my-prompt')), 'my-prompt');
            assert.strictEqual(getCleanPromptName(URI.file('../some-folder/frequent.txt')), 'frequent.txt');
            assert.strictEqual(getCleanPromptName(URI.parse('untitled:Untitled-1')), 'Untitled-1');
        });
    });
    suite('isPromptOrInstructionsFile', () => {
        test('returns `true` for prompt files', () => {
            assert(isPromptOrInstructionsFile(URI.file('/path/to/my-prompt.prompt.md')));
            assert(isPromptOrInstructionsFile(URI.file('../common.prompt.md')));
            assert(isPromptOrInstructionsFile(URI.file(`./some-${randomInt(1000)}.prompt.md`)));
            assert(isPromptOrInstructionsFile(URI.file('.github/copilot-instructions.md')));
        });
        test('returns `false` for non-prompt files', () => {
            assert(!isPromptOrInstructionsFile(URI.file('/path/to/my-prompt.prompt.md1')));
            assert(!isPromptOrInstructionsFile(URI.file('../common.md')));
            assert(!isPromptOrInstructionsFile(URI.file(`./some-${randomInt(1000)}.txt`)));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vY29uZmlnL2NvbnN0YW50cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM1SCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDckUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRzNELEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7SUFDOUIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1FBQ2hDLElBQUksQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7WUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FDakIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLEVBQzVELFdBQVcsQ0FDWCxDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQ25ELFFBQVEsQ0FDUixDQUFDO1lBRUYsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3JELE1BQU0sQ0FBQyxXQUFXLENBQ2pCLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxrQkFBa0IsWUFBWSxDQUFDLENBQUMsRUFDakUsa0JBQWtCLENBQ2xCLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLENBQUMsRUFDL0Qsc0JBQXNCLENBQ3RCLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUMsRUFDdEQsV0FBVyxDQUNYLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUMsRUFDM0QsY0FBYyxDQUNkLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFDcEQsWUFBWSxDQUNaLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsS0FBSyxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtRQUN4QyxJQUFJLENBQUMsaUNBQWlDLEVBQUUsR0FBRyxFQUFFO1lBQzVDLE1BQU0sQ0FDTCwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FDcEUsQ0FBQztZQUVGLE1BQU0sQ0FDTCwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FDM0QsQ0FBQztZQUVGLE1BQU0sQ0FDTCwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUMzRSxDQUFDO1lBRUYsTUFBTSxDQUNMLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQyxDQUN2RSxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsc0NBQXNDLEVBQUUsR0FBRyxFQUFFO1lBQ2pELE1BQU0sQ0FDTCxDQUFDLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUN0RSxDQUFDO1lBRUYsTUFBTSxDQUNMLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUNyRCxDQUFDO1lBRUYsTUFBTSxDQUNMLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FDdEUsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9