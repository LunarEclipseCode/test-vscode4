/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PromptToken } from './promptToken.js';
import { assert } from '../../../../../../../base/common/assert.js';
import { Range } from '../../../../../../../editor/common/core/range.js';
import { INVALID_NAME_CHARACTERS, STOP_CHARACTERS } from '../parsers/promptVariableParser.js';
/**
 * All prompt variables start with `#` character.
 */
const START_CHARACTER = '#';
/**
 * Character that separates name of a prompt variable from its data.
 */
const DATA_SEPARATOR = ':';
/**
 * Represents a `#variable` token in a prompt text.
 */
export class PromptVariable extends PromptToken {
    constructor(range, 
    /**
     * The name of a prompt variable, excluding the `#` character at the start.
     */
    name) {
        // sanity check of characters used in the provided variable name
        for (const character of name) {
            assert((INVALID_NAME_CHARACTERS.includes(character) === false) &&
                (STOP_CHARACTERS.includes(character) === false), `Variable 'name' cannot contain character '${character}', got '${name}'.`);
        }
        super(range);
        this.name = name;
    }
    /**
     * Get full text of the token.
     */
    get text() {
        return `${START_CHARACTER}${this.name}`;
    }
    /**
     * Return a string representation of the token.
     */
    toString() {
        return `${this.text}${this.range}`;
    }
}
/**
 * Represents a {@link PromptVariable} with additional data token in a prompt text.
 * (e.g., `#variable:/path/to/file.md`)
 */
export class PromptVariableWithData extends PromptVariable {
    constructor(fullRange, 
    /**
     * The name of the variable, excluding the starting `#` character.
     */
    name, 
    /**
     * The data of the variable, excluding the starting {@link DATA_SEPARATOR} character.
     */
    data) {
        super(fullRange, name);
        this.data = data;
        // sanity check of characters used in the provided variable data
        for (const character of data) {
            assert((STOP_CHARACTERS.includes(character) === false), `Variable 'data' cannot contain character '${character}', got '${data}'.`);
        }
    }
    /**
     * Get full text of the token.
     */
    get text() {
        return `${START_CHARACTER}${this.name}${DATA_SEPARATOR}${this.data}`;
    }
    /**
     * Range of the `data` part of the variable.
     */
    get dataRange() {
        const { range } = this;
        // calculate the start column number of the `data` part of the variable
        const dataStartColumn = range.startColumn +
            START_CHARACTER.length + this.name.length +
            DATA_SEPARATOR.length;
        // create `range` of the `data` part of the variable
        const result = new Range(range.startLineNumber, dataStartColumn, range.endLineNumber, range.endColumn);
        // if the resulting range is empty, return `undefined`
        // because there is no `data` part present in the variable
        if (result.isEmpty()) {
            return undefined;
        }
        return result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VmFyaWFibGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvdG9rZW5zL3Byb21wdFZhcmlhYmxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUMvQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDcEUsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxlQUFlLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUU5Rjs7R0FFRztBQUNILE1BQU0sZUFBZSxHQUFXLEdBQUcsQ0FBQztBQUVwQzs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFXLEdBQUcsQ0FBQztBQUVuQzs7R0FFRztBQUNILE1BQU0sT0FBTyxjQUFlLFNBQVEsV0FBVztJQUM5QyxZQUNDLEtBQVk7SUFDWjs7T0FFRztJQUNhLElBQVk7UUFFNUIsZ0VBQWdFO1FBQ2hFLEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxFQUFFLENBQUM7WUFDOUIsTUFBTSxDQUNMLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssQ0FBQztnQkFDdkQsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUMvQyw2Q0FBNkMsU0FBUyxXQUFXLElBQUksSUFBSSxDQUN6RSxDQUFDO1FBQ0gsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQVhHLFNBQUksR0FBSixJQUFJLENBQVE7SUFZN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBVyxJQUFJO1FBQ2QsT0FBTyxHQUFHLGVBQWUsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ2EsUUFBUTtRQUN2QixPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDcEMsQ0FBQztDQUNEO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLHNCQUF1QixTQUFRLGNBQWM7SUFDekQsWUFDQyxTQUFnQjtJQUNoQjs7T0FFRztJQUNILElBQVk7SUFFWjs7T0FFRztJQUNhLElBQVk7UUFFNUIsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUZQLFNBQUksR0FBSixJQUFJLENBQVE7UUFJNUIsZ0VBQWdFO1FBQ2hFLEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxFQUFFLENBQUM7WUFDOUIsTUFBTSxDQUNMLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxLQUFLLENBQUMsRUFDL0MsNkNBQTZDLFNBQVMsV0FBVyxJQUFJLElBQUksQ0FDekUsQ0FBQztRQUNILENBQUM7SUFDRixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFvQixJQUFJO1FBQ3ZCLE9BQU8sR0FBRyxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3RFLENBQUM7SUFFRDs7T0FFRztJQUNILElBQVcsU0FBUztRQUNuQixNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRXZCLHVFQUF1RTtRQUN2RSxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsV0FBVztZQUN4QyxlQUFlLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUN6QyxjQUFjLENBQUMsTUFBTSxDQUFDO1FBRXZCLG9EQUFvRDtRQUNwRCxNQUFNLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FDdkIsS0FBSyxDQUFDLGVBQWUsRUFDckIsZUFBZSxFQUNmLEtBQUssQ0FBQyxhQUFhLEVBQ25CLEtBQUssQ0FBQyxTQUFTLENBQ2YsQ0FBQztRQUVGLHNEQUFzRDtRQUN0RCwwREFBMEQ7UUFDMUQsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUN0QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0NBQ0QifQ==