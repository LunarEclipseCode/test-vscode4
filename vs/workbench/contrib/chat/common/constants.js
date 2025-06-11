/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export var ChatConfiguration;
(function (ChatConfiguration) {
    ChatConfiguration["UseFileStorage"] = "chat.useFileStorage";
    ChatConfiguration["AgentEnabled"] = "chat.agent.enabled";
    ChatConfiguration["Edits2Enabled"] = "chat.edits2.enabled";
    ChatConfiguration["ExtensionToolsEnabled"] = "chat.extensionTools.enabled";
})(ChatConfiguration || (ChatConfiguration = {}));
export var ChatMode;
(function (ChatMode) {
    ChatMode["Ask"] = "ask";
    ChatMode["Edit"] = "edit";
    ChatMode["Agent"] = "agent";
})(ChatMode || (ChatMode = {}));
export function modeToString(mode) {
    switch (mode) {
        case ChatMode.Agent:
            return 'Agent';
        case ChatMode.Edit:
            return 'Edit';
        case ChatMode.Ask:
        default:
            return 'Ask';
    }
}
export function validateChatMode(mode) {
    switch (mode) {
        case ChatMode.Ask:
        case ChatMode.Edit:
        case ChatMode.Agent:
            return mode;
        default:
            return undefined;
    }
}
export function isChatMode(mode) {
    return !!validateChatMode(mode);
}
export var ChatAgentLocation;
(function (ChatAgentLocation) {
    ChatAgentLocation["Panel"] = "panel";
    ChatAgentLocation["Terminal"] = "terminal";
    ChatAgentLocation["Notebook"] = "notebook";
    ChatAgentLocation["Editor"] = "editor";
})(ChatAgentLocation || (ChatAgentLocation = {}));
(function (ChatAgentLocation) {
    function fromRaw(value) {
        switch (value) {
            case 'panel': return ChatAgentLocation.Panel;
            case 'terminal': return ChatAgentLocation.Terminal;
            case 'notebook': return ChatAgentLocation.Notebook;
            case 'editor': return ChatAgentLocation.Editor;
        }
        return ChatAgentLocation.Panel;
    }
    ChatAgentLocation.fromRaw = fromRaw;
})(ChatAgentLocation || (ChatAgentLocation = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jb25zdGFudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsTUFBTSxDQUFOLElBQVksaUJBS1g7QUFMRCxXQUFZLGlCQUFpQjtJQUM1QiwyREFBc0MsQ0FBQTtJQUN0Qyx3REFBbUMsQ0FBQTtJQUNuQywwREFBcUMsQ0FBQTtJQUNyQywwRUFBcUQsQ0FBQTtBQUN0RCxDQUFDLEVBTFcsaUJBQWlCLEtBQWpCLGlCQUFpQixRQUs1QjtBQUVELE1BQU0sQ0FBTixJQUFZLFFBSVg7QUFKRCxXQUFZLFFBQVE7SUFDbkIsdUJBQVcsQ0FBQTtJQUNYLHlCQUFhLENBQUE7SUFDYiwyQkFBZSxDQUFBO0FBQ2hCLENBQUMsRUFKVyxRQUFRLEtBQVIsUUFBUSxRQUluQjtBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsSUFBYztJQUMxQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2QsS0FBSyxRQUFRLENBQUMsS0FBSztZQUNsQixPQUFPLE9BQU8sQ0FBQztRQUNoQixLQUFLLFFBQVEsQ0FBQyxJQUFJO1lBQ2pCLE9BQU8sTUFBTSxDQUFDO1FBQ2YsS0FBSyxRQUFRLENBQUMsR0FBRyxDQUFDO1FBQ2xCO1lBQ0MsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxJQUFhO0lBQzdDLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDZCxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUM7UUFDbEIsS0FBSyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQ25CLEtBQUssUUFBUSxDQUFDLEtBQUs7WUFDbEIsT0FBTyxJQUFnQixDQUFDO1FBQ3pCO1lBQ0MsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLFVBQVUsVUFBVSxDQUFDLElBQWE7SUFDdkMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUlELE1BQU0sQ0FBTixJQUFZLGlCQUtYO0FBTEQsV0FBWSxpQkFBaUI7SUFDNUIsb0NBQWUsQ0FBQTtJQUNmLDBDQUFxQixDQUFBO0lBQ3JCLDBDQUFxQixDQUFBO0lBQ3JCLHNDQUFpQixDQUFBO0FBQ2xCLENBQUMsRUFMVyxpQkFBaUIsS0FBakIsaUJBQWlCLFFBSzVCO0FBRUQsV0FBaUIsaUJBQWlCO0lBQ2pDLFNBQWdCLE9BQU8sQ0FBQyxLQUEwQztRQUNqRSxRQUFRLEtBQUssRUFBRSxDQUFDO1lBQ2YsS0FBSyxPQUFPLENBQUMsQ0FBQyxPQUFPLGlCQUFpQixDQUFDLEtBQUssQ0FBQztZQUM3QyxLQUFLLFVBQVUsQ0FBQyxDQUFDLE9BQU8saUJBQWlCLENBQUMsUUFBUSxDQUFDO1lBQ25ELEtBQUssVUFBVSxDQUFDLENBQUMsT0FBTyxpQkFBaUIsQ0FBQyxRQUFRLENBQUM7WUFDbkQsS0FBSyxRQUFRLENBQUMsQ0FBQyxPQUFPLGlCQUFpQixDQUFDLE1BQU0sQ0FBQztRQUNoRCxDQUFDO1FBQ0QsT0FBTyxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7SUFDaEMsQ0FBQztJQVJlLHlCQUFPLFVBUXRCLENBQUE7QUFDRixDQUFDLEVBVmdCLGlCQUFpQixLQUFqQixpQkFBaUIsUUFVakMifQ==