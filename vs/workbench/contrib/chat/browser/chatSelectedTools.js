/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived, observableFromEvent, ObservableMap, observableValue, transaction } from '../../../../base/common/observable.js';
import { observableMemento } from '../../../../platform/observable/common/observableMemento.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ChatMode } from '../common/constants.js';
import { ILanguageModelToolsService, ToolSet } from '../common/languageModelToolsService.js';
const storedTools = observableMemento({
    defaultValue: {},
    key: 'chat/selectedTools',
});
let ChatSelectedTools = class ChatSelectedTools extends Disposable {
    constructor(mode, _toolsService, storageService) {
        super();
        this._toolsService = _toolsService;
        this._sessionSelectedTools = observableValue(this, {});
        /**
         * All tools and tool sets with their enabled state.
         */
        this.entriesMap = new ObservableMap();
        /**
         * All enabled tools and tool sets.
         */
        this.entries = this.entriesMap.observable.map(function (value) {
            const result = new Set();
            for (const [item, enabled] of value) {
                if (enabled) {
                    result.add(item);
                }
            }
            return result;
        });
        this._selectedTools = this._store.add(storedTools(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */, storageService));
        this._allTools = observableFromEvent(_toolsService.onDidChangeTools, () => Array.from(_toolsService.getTools()));
        const disabledDataObs = derived(r => {
            const globalData = this._selectedTools.read(r);
            const sessionData = this._sessionSelectedTools.read(r);
            const toolSetIds = new Set();
            const toolIds = new Set();
            for (const data of [globalData, sessionData]) {
                if (data.disabledToolSets) {
                    for (const id of data.disabledToolSets) {
                        toolSetIds.add(id);
                    }
                }
                if (data.disabledTools) {
                    for (const id of data.disabledTools) {
                        toolIds.add(id);
                    }
                }
            }
            if (toolSetIds.size === 0 && toolIds.size === 0) {
                return undefined;
            }
            return { toolSetIds, toolIds };
        });
        this._store.add(autorun(r => {
            const tools = this._allTools.read(r).filter(t => t.canBeReferencedInPrompt);
            const toolSets = _toolsService.toolSets.read(r);
            const oldItems = new Set(this.entriesMap.keys());
            const disabledData = mode.read(r) === ChatMode.Agent
                ? disabledDataObs.read(r)
                : undefined;
            transaction(tx => {
                for (const tool of tools) {
                    const enabled = !disabledData || !disabledData.toolIds.has(tool.id);
                    this.entriesMap.set(tool, enabled, tx);
                    oldItems.delete(tool);
                }
                for (const toolSet of toolSets) {
                    const enabled = !disabledData || !disabledData.toolSetIds.has(toolSet.id);
                    this.entriesMap.set(toolSet, enabled, tx);
                    oldItems.delete(toolSet);
                }
                for (const item of oldItems) {
                    this.entriesMap.delete(item, tx);
                }
            });
        }));
    }
    resetSessionEnablementState() {
        this._sessionSelectedTools.set({}, undefined);
    }
    enable(toolSets, tools, sessionOnly) {
        const toolIds = new Set(tools.map(t => t.id));
        const toolsetIds = new Set(toolSets.map(t => t.id));
        const disabledTools = this._allTools.get().filter(tool => !toolIds.has(tool.id));
        const disabledToolSets = Array.from(this._toolsService.toolSets.get()).filter(toolset => !toolsetIds.has(toolset.id));
        this.disable(disabledToolSets, disabledTools, sessionOnly);
    }
    disable(disabledToolSets, disableTools, sessionOnly) {
        const target = sessionOnly
            ? this._sessionSelectedTools
            : this._selectedTools;
        target.set({
            disabledToolSets: disabledToolSets.map(t => t.id),
            disabledTools: disableTools.map(t => t.id)
        }, undefined);
    }
    asEnablementMap() {
        const result = new Map();
        const map = this.entriesMap;
        const _set = (tool, enabled) => {
            // ONLY disable a tool that isn't enabled yet
            const enabledNow = result.get(tool);
            if (enabled || !enabledNow) {
                result.set(tool, enabled);
            }
        };
        for (const [item, enabled] of map) {
            if (item instanceof ToolSet) {
                for (const tool of item.getTools()) {
                    _set(tool, map.get(tool) ?? enabled); // tools from tool set can be explicitly set
                }
            }
            else {
                if (item.canBeReferencedInPrompt) {
                    _set(item, enabled);
                }
            }
        }
        return result;
    }
};
ChatSelectedTools = __decorate([
    __param(1, ILanguageModelToolsService),
    __param(2, IStorageService)
], ChatSelectedTools);
export { ChatSelectedTools };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlbGVjdGVkVG9vbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0U2VsZWN0ZWRUb29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQWUsbUJBQW1CLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN4SixPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDbkgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFFLDBCQUEwQixFQUFhLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBZXhHLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFhO0lBQ2pELFlBQVksRUFBRSxFQUFFO0lBQ2hCLEdBQUcsRUFBRSxvQkFBb0I7Q0FDekIsQ0FBQyxDQUFDO0FBRUksSUFBTSxpQkFBaUIsR0FBdkIsTUFBTSxpQkFBa0IsU0FBUSxVQUFVO0lBMEJoRCxZQUNDLElBQTJCLEVBQ0MsYUFBMEQsRUFDckUsY0FBK0I7UUFFaEQsS0FBSyxFQUFFLENBQUM7UUFIcUMsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBeEJ0RSwwQkFBcUIsR0FBRyxlQUFlLENBQWEsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBSS9FOztXQUVHO1FBQ00sZUFBVSxHQUFHLElBQUksYUFBYSxFQUFnQyxDQUFDO1FBRXhFOztXQUVHO1FBQ00sWUFBTyxHQUFrRCxJQUFJLENBQUMs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