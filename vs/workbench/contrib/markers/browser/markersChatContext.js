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
import { groupBy } from '../../../../base/common/arrays.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { extUri } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IChatContextPickService } from '../../chat/browser/chatContextPickService.js';
import { IDiagnosticVariableEntryFilterData } from '../../chat/common/chatModel.js';
let MarkerChatContextPick = class MarkerChatContextPick {
    constructor(_markerService, _labelService) {
        this._markerService = _markerService;
        this._labelService = _labelService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.diagnstic', 'Problems...');
        this.icon = Codicon.error;
        this.ordinal = -100;
    }
    asPicker() {
        const markers = this._markerService.read({ severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info });
        const grouped = groupBy(markers, (a, b) => extUri.compare(a.resource, b.resource));
        const severities = new Set();
        const items = [];
        let pickCount = 0;
        for (const group of grouped) {
            const resource = group[0].resource;
            items.push({ type: 'separator', label: this._labelService.getUriLabel(resource, { relative: true }) });
            for (const marker of group) {
                pickCount++;
                severities.add(marker.severity);
                items.push({
                    label: marker.message,
                    description: localize('markers.panel.at.ln.col.number', "[Ln {0}, Col {1}]", '' + marker.startLineNumber, '' + marker.startColumn),
                    asAttachment() {
                        return IDiagnosticVariableEntryFilterData.toEntry(IDiagnosticVariableEntryFilterData.fromMarker(marker));
                    }
                });
            }
        }
        items.unshift({
            label: localize('markers.panel.allErrors', 'All Problems'),
            asAttachment() {
                return IDiagnosticVariableEntryFilterData.toEntry({
                    filterSeverity: MarkerSeverity.Info
                });
            },
        });
        return {
            placeholder: localize('chatContext.diagnstic.placeholder', 'Select a problem to attach'),
            picks: Promise.resolve(items)
        };
    }
};
MarkerChatContextPick = __decorate([
    __param(0, IMarkerService),
    __param(1, ILabelService)
], MarkerChatContextPick);
let MarkerChatContextContribution = class MarkerChatContextContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chat.markerChatContextContribution'; }
    constructor(contextPickService, instantiationService) {
        super();
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(MarkerChatContextPick)));
    }
};
MarkerChatContextContribution = __decorate([
    __param(0, IChatContextPickService),
    __param(1, IInstantiationService)
], MarkerChatContextContribution);
export { MarkerChatContextContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Vyc0NoYXRDb250ZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZXJzL2Jyb3dzZXIvbWFya2Vyc0NoYXRDb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFHaEcsT0FBTyxFQUFzRCx1QkFBdUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzNJLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXBGLElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXFCO0lBTzFCLFlBQ2lCLGNBQStDLEVBQ2hELGFBQTZDO1FBRDNCLG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtRQUMvQixrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQVBwRCxTQUFJLEdBQUcsWUFBWSxDQUFDO1FBQ3BCLFVBQUssR0FBRyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDekQsU0FBSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFDckIs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