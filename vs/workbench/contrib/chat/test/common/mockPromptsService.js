/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
export class MockPromptsService {
    constructor() {
        this.onDidChangeCustomChatModes = Event.None;
    }
    getAllMetadata(_files) {
        throw new Error('Method not implemented.');
    }
    getMetadata(_file) {
        throw new Error('Method not implemented.');
    }
    getSyntaxParserFor(_model) {
        throw new Error('Method not implemented.');
    }
    listPromptFiles(_type) {
        throw new Error('Method not implemented.');
    }
    getSourceFolders(_type) {
        throw new Error('Method not implemented.');
    }
    asPromptSlashCommand(command) {
        return undefined;
    }
    resolvePromptSlashCommand(_data) {
        throw new Error('Method not implemented.');
    }
    findPromptSlashCommands() {
        throw new Error('Method not implemented.');
    }
    findInstructionFilesFor(_files) {
        throw new Error('Method not implemented.');
    }
    getCustomChatModes() {
        throw new Error('Method not implemented.');
    }
    dispose() { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja1Byb21wdHNTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL21vY2tQcm9tcHRzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFPNUQsTUFBTSxPQUFPLGtCQUFrQjtJQUEvQjtRQStCQywrQkFBMEIsR0FBZ0IsS0FBSyxDQUFDLElBQUksQ0FBQztJQUt0RCxDQUFDO0lBaENBLGNBQWMsQ0FBQyxNQUFzQjtRQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELFdBQVcsQ0FBQyxLQUFVO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0Qsa0JBQWtCLENBQUMsTUFBa0I7UUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxlQUFlLENBQUMsS0FBa0I7UUFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxLQUFrQjtRQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELG9CQUFvQixDQUFDLE9BQWU7UUFDbkMsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUNELHlCQUF5QixDQUFDLEtBQThCO1FBQ3ZELE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsdUJBQXVCO1FBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsdUJBQXVCLENBQUMsTUFBc0I7UUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxrQkFBa0I7UUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxPQUFPLEtBQVcsQ0FBQztDQUNuQiJ9