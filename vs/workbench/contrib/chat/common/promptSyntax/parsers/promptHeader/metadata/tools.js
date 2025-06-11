/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PromptMetadataRecord } from './base/record.js';
import { localize } from '../../../../../../../../nls.js';
import { PromptMetadataError, PromptMetadataWarning } from '../diagnostics.js';
import { FrontMatterSequence } from '../../../codecs/base/frontMatterCodec/tokens/frontMatterSequence.js';
import { FrontMatterArray, FrontMatterRecord, FrontMatterString } from '../../../codecs/base/frontMatterCodec/tokens/index.js';
/**
 * Name of the metadata record in the prompt header.
 */
const RECORD_NAME = 'tools';
/**
 * Prompt `tools` metadata record inside the prompt header.
 */
export class PromptToolsMetadata extends PromptMetadataRecord {
    /**
     * List of all valid tool names that were found in
     * this metadata record.
     */
    get value() {
        if (this.validToolNames === undefined) {
            return [];
        }
        return [...this.validToolNames.values()];
    }
    get recordName() {
        return RECORD_NAME;
    }
    constructor(recordToken, languageId) {
        super(RECORD_NAME, recordToken, languageId);
    }
    /**
     * Validate the metadata record and collect all issues
     * related to its content.
     */
    validate() {
        const { valueToken } = this.recordToken;
        // validate that the record value is an array
        if ((valueToken instanceof FrontMatterArray) === false) {
            this.issues.push(new PromptMetadataError(valueToken.range, localize('prompt.header.metadata.tools.diagnostics.invalid-value-type', "The '{0}' metadata must be an array of tool names, got '{2}'.", RECORD_NAME, valueToken.valueTypeName.toString())));
            delete this.valueToken;
            return this.issues;
        }
        this.valueToken = valueToken;
        // validate that all array items
        this.validToolNames = new Set();
        for (const item of this.valueToken.items) {
            this.issues.push(...this.validateToolName(item, this.validToolNames));
        }
        return this.issues;
    }
    /**
     * Validate an individual provided value token that is used
     * for a tool name.
     */
    validateToolName(valueToken, validToolNames) {
        const issues = [];
        // tool name must be a quoted or an unquoted 'string'
        if ((valueToken instanceof FrontMatterString) === false &&
            (valueToken instanceof FrontMatterSequence) === false) {
            issues.push(new PromptMetadataWarning(valueToken.range, localize('prompt.header.metadata.tools.diagnostics.invalid-tool-name-type', "Unexpected tool name '{0}', expected '{1}'.", valueToken.text, 'string')));
            return issues;
        }
        const cleanToolName = valueToken.cleanText.trim();
        // the tool name should not be empty
        if (cleanToolName.length === 0) {
            issues.push(new PromptMetadataWarning(valueToken.range, localize('prompt.header.metadata.tools.diagnostics.empty-tool-name', "Tool name cannot be empty.")));
            return issues;
        }
        // the tool name should not be duplicated
        if (validToolNames.has(cleanToolName)) {
            issues.push(new PromptMetadataWarning(valueToken.range, localize('prompt.header.metadata.tools.diagnostics.duplicate-tool-name', "Duplicate tool name '{0}'.", cleanToolName)));
            return issues;
        }
        validToolNames.add(cleanToolName);
        return issues;
    }
    /**
     * Check if a provided front matter token is a metadata record
     * with name equal to `tools`.
     */
    static isToolsRecord(token) {
        if ((token instanceof FrontMatterRecord) === false) {
            return false;
        }
        if (token.nameToken.text === RECORD_NAME) {
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9wYXJzZXJzL3Byb21wdEhlYWRlci9tZXRhZGF0YS90b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUE0QixtQkFBbUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3pHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzFHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBMkMsTUFBTSx1REFBdUQsQ0FBQztBQUV4Szs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQztBQUU1Qjs7R0FFRztBQUNILE1BQU0sT0FBTyxtQkFBb0IsU0FBUSxvQkFBOEI7SUFFdEU7OztPQUdHO0lBQ0gsSUFBb0IsS0FBSztRQUN4QixJQUFJLElBQUksQ0FBQyxjQUFjLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDdkMsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxJQUFvQixVQUFVO1FBQzdCLE9BQU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFhRCxZQUNDLFdBQThCLEVBQzlCLFVBQWtCO1FBRWxCLEtBQUssQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7O09BR0c7SUFDYSxRQUFR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