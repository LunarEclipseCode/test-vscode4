/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertNever } from '../../../../../base/common/assert.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { diffSets } from '../../../../../base/common/collections.js';
import { Event } from '../../../../../base/common/event.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { AddConfigurationAction } from '../../../mcp/browser/mcpCommands.js';
import { IMcpRegistry } from '../../../mcp/common/mcpRegistryTypes.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
import { ToolSet, ToolDataSource, ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { ConfigureToolSets } from '../tools/toolSetsContribution.js';
var BucketOrdinal;
(function (BucketOrdinal) {
    BucketOrdinal[BucketOrdinal["User"] = 0] = "User";
    BucketOrdinal[BucketOrdinal["BuiltIn"] = 1] = "BuiltIn";
    BucketOrdinal[BucketOrdinal["Mcp"] = 2] = "Mcp";
    BucketOrdinal[BucketOrdinal["Extension"] = 3] = "Extension";
})(BucketOrdinal || (BucketOrdinal = {}));
function isBucketPick(obj) {
    return Boolean(obj.children);
}
function isToolSetPick(obj) {
    return Boolean(obj.toolset);
}
function isToolPick(obj) {
    return Boolean(obj.tool);
}
function isCallbackPick(obj) {
    return Boolean(obj.run);
}
function isActionableButton(obj) {
    return typeof obj.action === 'function';
}
export async function showToolsPicker(accessor, placeHolder, toolsEntries, onUpdate) {
    const quickPickService = accessor.get(IQuickInputService);
    const mcpService = accessor.get(IMcpService);
    const mcpRegistry = accessor.get(IMcpRegistry);
    const commandService = accessor.get(ICommandService);
    const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const editorService = accessor.get(IEditorService);
    const toolsService = accessor.get(ILanguageModelToolsService);
    const mcpServerByTool = new Map();
    for (const server of mcpService.servers.get()) {
        for (const tool of server.tools.get()) {
            mcpServerByTool.set(tool.id, server);
        }
    }
    const builtinBucket = {
        type: 'item',
        children: [],
        label: localize('defaultBucketLabel', "Built-In"),
        ordinal: 1 /* BucketOrdinal.BuiltIn */,
        picked: false,
    };
    const userBucket = {
        type: 'item',
        children: [],
        label: localize('userBucket', "User Defined Tool Sets"),
        ordinal: 0 /* BucketOrdinal.User */,
        alwaysShow: true,
        picked: false,
    };
    const addMcpPick = { type: 'item', label: localize('addServer', "Add MCP Server..."), iconClass: ThemeIcon.asClassName(Codicon.add), pickable: false, run: () => commandService.executeCommand(AddConfigurationAction.ID) };
    const configureToolSetsPick = { type: 'item', label: localize('configToolSet', "Configure Tool Sets..."), iconClass: ThemeIcon.asClassName(Codicon.gear), pickable: false, run: () => commandService.executeCommand(ConfigureToolSets.ID) };
    const addExpPick = { type: 'item', label: localize('addExtension', "Install Extension..."), iconClass: ThemeIcon.asClassName(Codicon.add), pickable: false, run: () => extensionWorkbenchService.openSearch('@tag:language-model-tools') };
    const addPick = {
        type: 'item', label: localize('addAny', "Add More Tools..."), iconClass: ThemeIcon.asClassName(Codicon.add), pickable: false, run: async () => {
            const pick = await quickPickService.pick([addMcpPick, addExpPick], {
                canPickMany: false,
                placeHolder: localize('noTools', "Add tools to chat")
            });
            pick?.run();
        }
    };
    const toolBuckets = new Map();
    if (!toolsEntries) {
        const defaultEntries = new Map();
        for (const tool of toolsService.getTools()) {
            defaultEntries.set(tool, false);
        }
        for (const toolSet of toolsService.toolSets.get()) {
            defaultEntries.set(toolSet, false);
        }
        toolsEntries = defaultEntries;
    }
    for (const [toolSetOrTool, picked] of toolsEntries) {
        let bucket;
        const buttons = [];
        if (toolSetOrTool.source.type === 'mcp') {
            const key = ToolDataSource.toKey(toolSetOrTool.source);
            const { definitionId } = toolSetOrTool.source;
            const mcpServer = mcpService.servers.get().find(candidate => candidate.definition.id === definitionId);
            if (!mcpServer) {
                continue;
            }
            const buttons = [];
            bucket = toolBuckets.get(key) ?? {
                type: 'item',
                label: localize('mcplabel', "MCP Server: {0}", toolSetOrTool.source.label),
                ordinal: 2 /* BucketOrdinal.Mcp */,
                picked: false,
                alwaysShow: true,
                children: [],
                buttons
            };
            toolBuckets.set(key, bucket);
            const collection = mcpRegistry.collections.get().find(c => c.id === mcpServer.collection.id);
            if (collection?.presentation?.origin) {
                buttons.push({
                    iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                    tooltip: localize('configMcpCol', "Configure {0}", collection.label),
                    action: () => editorService.openEditor({
                        resource: collection.presentation.origin,
                    })
                });
            }
            if (mcpServer.connectionState.get().state === 3 /* McpConnectionState.Kind.Error */) {
                buttons.push({
                    iconClass: ThemeIcon.asClassName(Codicon.warning),
                    tooltip: localize('mcpShowOutput', "Show Output"),
                    action: () => mcpServer.showOutput(),
                });
            }
        }
        else if (toolSetOrTool.source.type === 'extension') {
            const key = ToolDataSource.toKey(toolSetOrTool.source);
            bucket = toolBuckets.get(key) ?? {
                type: 'item',
                label: localize('ext', 'Extension: {0}', toolSetOrTool.source.label),
                ordinal: 3 /* BucketOrdinal.Extension */,
                picked: false,
                alwaysShow: true,
                children: []
            };
            toolBuckets.set(key, bucket);
        }
        else if (toolSetOrTool.source.type === 'internal') {
            bucket = builtinBucket;
        }
        else if (toolSetOrTool.source.type === 'user') {
            bucket = userBucket;
            buttons.push({
                iconClass: ThemeIcon.asClassName(Codicon.edit),
                tooltip: localize('editUserBucket', "Edit Tool Set"),
                action: () => {
                    assertType(toolSetOrTool.source.type === 'user');
                    editorService.openEditor({ resource: toolSetOrTool.source.file });
                }
            });
        }
        else {
            assertNever(toolSetOrTool.source);
        }
        if (toolSetOrTool instanceof ToolSet) {
            if (toolSetOrTool.source.type !== 'mcp') { // don't show the MCP toolset
                bucket.children.push({
                    parent: bucket,
                    type: 'item',
                    picked,
                    toolset: toolSetOrTool,
                    label: toolSetOrTool.referenceName,
                    description: toolSetOrTool.description,
                    indented: true,
                    buttons
                });
            }
            else {
                // stash the MCP toolset into the bucket item
                bucket.toolset = toolSetOrTool;
            }
        }
        else if (toolSetOrTool.canBeReferencedInPrompt) {
            bucket.children.push({
                parent: bucket,
                type: 'item',
                picked,
                tool: toolSetOrTool,
                label: toolSetOrTool.toolReferenceName ?? toolSetOrTool.displayName,
                description: toolSetOrTool.userDescription ?? toolSetOrTool.modelDescription,
                indented: true,
            });
        }
        if (picked) {
            bucket.picked = true;
        }
    }
    for (const bucket of [builtinBucket, userBucket]) {
        if (bucket.children.length > 0) {
            toolBuckets.set(generateUuid(), bucket);
        }
    }
    const store = new DisposableStore();
    const picks = [];
    for (const bucket of Array.from(toolBuckets.values()).sort((a, b) => a.ordinal - b.ordinal)) {
        picks.push({
            type: 'separator',
            label: bucket.status
        });
        picks.push(bucket);
        picks.push(...bucket.children.sort((a, b) => a.label.localeCompare(b.label)));
    }
    const picker = store.add(quickPickService.createQuickPick({ useSeparators: true }));
    picker.placeholder = placeHolder;
    picker.canSelectMany = true;
    picker.keepScrollPosition = true;
    picker.sortByLabel = false;
    picker.matchOnDescription = true;
    if (picks.length === 0) {
        picker.placeholder = localize('noTools', "Add tools to chat");
        picker.canSelectMany = false;
        picks.push(addMcpPick, addExpPick);
    }
    else {
        picks.push({ type: 'separator' }, configureToolSetsPick, addPick);
    }
    let lastSelectedItems = new Set();
    let ignoreEvent = false;
    const result = new Map();
    const _update = () => {
        ignoreEvent = true;
        try {
            const items = picks.filter((p) => p.type === 'item' && Boolean(p.picked));
            lastSelectedItems = new Set(items);
            picker.selectedItems = items;
            result.clear();
            for (const item of picks) {
                if (item.type !== 'item') {
                    continue;
                }
                if (isToolSetPick(item)) {
                    result.set(item.toolset, item.picked);
                }
                else if (isToolPick(item)) {
                    result.set(item.tool, item.picked);
                }
                else if (isBucketPick(item)) {
                    if (item.toolset) {
                        result.set(item.toolset, item.picked);
                    }
                    for (const child of item.children) {
                        if (isToolSetPick(child)) {
                            result.set(child.toolset, item.picked);
                        }
                        else if (isToolPick(child)) {
                            result.set(child.tool, item.picked);
                        }
                    }
                }
            }
            if (onUpdate) {
                let didChange = toolsEntries.size !== result.size;
                for (const [key, value] of toolsEntries) {
                    if (didChange) {
                        break;
                    }
                    didChange = result.get(key) !== value;
                }
                if (didChange) {
                    onUpdate(result);
                }
            }
        }
        finally {
            ignoreEvent = false;
        }
    };
    _update();
    picker.items = picks;
    picker.show();
    store.add(picker.onDidTriggerItemButton(e => {
        if (isActionableButton(e.button)) {
            e.button.action();
            store.dispose();
        }
    }));
    store.add(picker.onDidChangeSelection(selectedPicks => {
        if (ignoreEvent) {
            return;
        }
        const addPick = selectedPicks.find(isCallbackPick);
        if (addPick) {
            addPick.run();
            picker.hide();
            return;
        }
        const { added, removed } = diffSets(lastSelectedItems, new Set(selectedPicks));
        for (const item of added) {
            item.picked = true;
            if (isBucketPick(item)) {
                // add server -> add back tools
                for (const toolPick of item.children) {
                    toolPick.picked = true;
                }
            }
            else if (isToolPick(item) || isToolSetPick(item)) {
                // add server when tool is picked
                item.parent.picked = true;
            }
        }
        for (const item of removed) {
            item.picked = false;
            if (isBucketPick(item)) {
                // removed server -> remove tools
                for (const toolPick of item.children) {
                    toolPick.picked = false;
                }
            }
            else if ((isToolPick(item) || isToolSetPick(item)) && item.parent.children.every(child => !child.picked)) {
                // remove LAST tool -> remove server
                item.parent.picked = false;
            }
        }
        _update();
    }));
    let didAccept = false;
    store.add(picker.onDidAccept(() => {
        picker.activeItems.find(isCallbackPick)?.run();
        didAccept = true;
    }));
    await Promise.race([Event.toPromise(Event.any(picker.onDidAccept, picker.onDidHide))]);
    store.dispose();
    const mcpToolSets = new Set();
    for (const item of toolsService.toolSets.get()) {
        if (item.source.type === 'mcp') {
            mcpToolSets.add(item);
            if (Iterable.every(item.getTools(), tool => result.get(tool))) {
                // ALL tools from the MCP tool set are here, replace them with just the toolset
                // but only when computing the final result
                for (const tool of item.getTools()) {
                    result.delete(tool);
                }
                result.set(item, true);
            }
        }
    }
    return didAccept ? result : undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xQaWNrZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRUb29sUGlja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFFdEYsT0FBTyxFQUFxQixrQkFBa0IsRUFBdUMsTUFBTSx5REFBeUQsQ0FBQztBQUNySixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDdkYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3ZF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