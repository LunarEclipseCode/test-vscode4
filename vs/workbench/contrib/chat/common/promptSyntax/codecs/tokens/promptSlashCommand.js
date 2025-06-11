/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PromptToken } from './promptToken.js';
import { assert } from '../../../../../../../base/common/assert.js';
import { INVALID_NAME_CHARACTERS, STOP_CHARACTERS } from '../parsers/promptSlashCommandParser.js';
/**
 * All prompt at-mentions start with `/` character.
 */
const START_CHARACTER = '/';
/**
 * Represents a `/command` token in a prompt text.
 */
export class PromptSlashCommand extends PromptToken {
    constructor(range, 
    /**
     * The name of a command, excluding the `/` character at the start.
     */
    name) {
        // sanity check of characters used in the provided command name
        for (const character of name) {
            assert((INVALID_NAME_CHARACTERS.includes(character) === false) &&
                (STOP_CHARACTERS.includes(character) === false), `Slash command 'name' cannot contain character '${character}', got '${name}'.`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0U2xhc2hDb21tYW5kLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29kZWNzL3Rva2Vucy9wcm9tcHRTbGFzaENvbW1hbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUVwRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsZUFBZSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFbEc7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBVyxHQUFHLENBQUM7QUFFcEM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sa0JBQW1CLFNBQVEsV0FBVztJQUNsRCxZQUNDLEtBQVk7SUFDWjs7T0FFRztJQUNhLElBQVk7UUFFNUIsK0RBQStEO1FBQy9ELEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxFQUFFLENBQUM7WUFDOUIsTUFBTSxDQUNMLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssQ0FBQztnQkFDdkQsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUMvQyxrREFBa0QsU0FBUyxXQUFXLElBQUksSUFBSSxDQUM5RSxDQUFDO1FBQ0gsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQVhHLFNBQUksR0FBSixJQUFJLENBQVE7SUFZN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBVyxJQUFJO1FBQ2QsT0FBTyxHQUFHLGVBQWUsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ2EsUUFBUTtRQUN2QixPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDcEMsQ0FBQztDQUNEIn0=