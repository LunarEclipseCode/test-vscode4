/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChatMode } from '../../../constants.js';
import { localize } from '../../../../../../../nls.js';
import { PromptMetadataWarning } from './diagnostics.js';
import { assert } from '../../../../../../../base/common/assert.js';
import { assertDefined } from '../../../../../../../base/common/types.js';
import { PromptToolsMetadata, PromptModeMetadata } from './metadata/index.js';
import { HeaderBase } from './headerBase.js';
/**
 * Header object for prompt files.
 */
export class PromptHeader extends HeaderBase {
    handleToken(token) {
        // if the record might be a "tools" metadata
        // add it to the list of parsed metadata records
        if (PromptToolsMetadata.isToolsRecord(token)) {
            const metadata = new PromptToolsMetadata(token, this.languageId);
            this.issues.push(...metadata.validate());
            this.meta.tools = metadata;
            this.validateToolsAndModeCompatibility();
            return true;
        }
        // if the record might be a "mode" metadata
        // add it to the list of parsed metadata records
        if (PromptModeMetadata.isModeRecord(token)) {
            const metadata = new PromptModeMetadata(token, this.languageId);
            this.issues.push(...metadata.validate());
            this.meta.mode = metadata;
            this.validateToolsAndModeCompatibility();
            return true;
        }
        return false;
    }
    /**
     * Check if value of `tools` and `mode` metadata
     * are compatible with each other.
     */
    get toolsAndModeCompatible() {
        const { tools, mode } = this.meta;
        // if 'tools' is not set, then the mode metadata
        // can have any value so skip the validation
        if (tools === undefined) {
            return true;
        }
        // if 'mode' is not set or invalid it will be ignored,
        // therefore treat it as if it was not set
        if (mode?.value === undefined) {
            return true;
        }
        // when mode is set, valid, and tools are present,
        // the only valid value for the mode is 'agent'
        return (mode.value === ChatMode.Agent);
    }
    /**
     * Validate that the `tools` and `mode` metadata are compatible
     * with each other. If not, add a warning diagnostic.
     */
    validateToolsAndModeCompatibility() {
        if (this.toolsAndModeCompatible === true) {
            return;
        }
        const { tools, mode } = this.meta;
        // sanity checks on the behavior of the `toolsAndModeCompatible` getter
        assertDefined(tools, 'Tools metadata must have been present.');
        assertDefined(mode, 'Mode metadata must have been present.');
        assert(mode.value !== ChatMode.Agent, 'Mode metadata must not be agent mode.');
        this.issues.push(new PromptMetadataWarning(mode.range, localize('prompt.header.metadata.mode.diagnostics.incompatible-with-tools', "Record '{0}' is implied to have the '{1}' value if '{2}' record is present so the specified value will be ignored.", mode.recordName, ChatMode.Agent, tools.recordName)));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0SGVhZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy9wcm9tcHRIZWFkZXIvcHJvbXB0SGVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDekQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUM5RSxPQUFPLEVBQUUsVUFBVSxFQUFxQyxNQUFNLGlCQUFpQixDQUFDO0FBd0JoRjs7R0FFRztBQUNILE1BQU0sT0FBTyxZQUFhLFNBQVEsVUFBMkI7SUFDekMsV0FBVyxDQUFDLEtBQXdCO1FBQ3RELDRDQUE0QztRQUM1QyxnREFBZ0Q7UUFDaEQsSUFBSSxtQkFBbUIsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM5QyxNQUFNLFFBQVEsR0FBRyxJQUFJLG1CQUFtQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFakUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUN6QyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUM7WUFFM0IsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLENBQUM7WUFDekMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsMkNBQTJDO1FBQzNDLGdEQUFnRDtRQUNoRCxJQUFJLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksa0JBQWtCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVoRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQztZQUUxQixJQUFJLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztZQUN6QyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxJQUFZLHNCQUFzQjtRQUNqQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFFbEMsZ0RBQWdEO1FBQ2hELDRDQUE0QztRQUM1QyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN6QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsMENBQTBDO1FBQzFDLElBQUksSUFBSSxFQUFFLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMvQixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxrREFBa0Q7UUFDbEQsK0NBQStDO1FBQy9DLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssaUNBQWlDO1FBQ3hDLElBQUksSUFBSSxDQUFDLHNCQUFzQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQzFDLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBRWxDLHVFQUF1RTtRQUN2RSxhQUFhLENBQ1osS0FBSyxFQUNMLHdDQUF3QyxDQUN4QyxDQUFDO1FBQ0YsYUFBYSxDQUNaLElBQUksRUFDSix1Q0FBdUMsQ0FDdkMsQ0FBQztRQUNGLE1BQU0sQ0FDTCxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxLQUFLLEVBQzdCLHVDQUF1QyxDQUN2QyxDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2YsSUFBSSxxQkFBcUIsQ0FDeEIsSUFBSSxDQUFDLEtBQUssRUFDVixRQUFRLENBQ1AsaUVBQWlFLEVBQ2pFLG9IQUFvSCxFQUNwSCxJQUFJLENBQUMsVUFBVSxFQUNmLFFBQVEsQ0FBQyxLQUFLLEVBQ2QsS0FBSyxDQUFDLFVBQVUsQ0FDaEIsQ0FDRCxDQUNELENBQUM7SUFDSCxDQUFDO0NBQ0QifQ==