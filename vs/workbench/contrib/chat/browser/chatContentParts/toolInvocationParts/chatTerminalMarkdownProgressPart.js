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
import { Codicon } from '../../../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ChatMarkdownContentPart } from '../chatMarkdownContentPart.js';
import { ChatCustomProgressPart } from '../chatProgressContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
let ChatTerminalMarkdownProgressPart = class ChatTerminalMarkdownProgressPart extends BaseChatToolInvocationSubPart {
    get codeblocks() {
        return this.markdownPart?.codeblocks ?? [];
    }
    constructor(toolInvocation, terminalData, context, renderer, editorPool, currentWidthDelegate, codeBlockStartIndex, codeBlockModelCollection, instantiationService) {
        super(toolInvocation);
        const content = new MarkdownString(`\`\`\`${terminalData.language}\n${terminalData.command}\n\`\`\``);
        const chatMarkdownContent = {
            kind: 'markdownContent',
            content: content,
        };
        const codeBlockRenderOptions = {
            hideToolbar: true,
            reserveWidth: 19,
            verticalPadding: 5,
            editorOptions: {
                wordWrap: 'on'
            }
        };
        this.markdownPart = this._register(instantiationService.createInstance(ChatMarkdownContentPart, chatMarkdownContent, context, editorPool, false, codeBlockStartIndex, renderer, currentWidthDelegate(), codeBlockModelCollection, { codeBlockRenderOptions }));
        this._register(this.markdownPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        const icon = !toolInvocation.isConfirmed ?
            Codicon.error :
            toolInvocation.isComplete ?
                Codicon.check : ThemeIcon.modify(Codicon.loading, 'spin');
        const progressPart = instantiationService.createInstance(ChatCustomProgressPart, this.markdownPart.domNode, icon);
        this.domNode = progressPart.domNode;
    }
};
ChatTerminalMarkdownProgressPart = __decorate([
    __param(8, IInstantiationService)
], ChatTerminalMarkdownProgressPart);
export { ChatTerminalMarkdownProgressPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRlcm1pbmFsTWFya2Rvd25Qcm9ncmVzc1BhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL3Rvb2xJbnZvY2F0aW9uUGFydHMvY2hhdFRlcm1pbmFsTWFya2Rvd25Qcm9ncmVzc1BhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFdkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFNekcsT0FBTyxFQUFFLHVCQUF1QixFQUFjLE1BQU0sK0JBQStCLENBQUM7QUFDcEYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdkUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFeEUsSUFBTSxnQ0FBZ0MsR0FBdEMsTUFBTSxnQ0FBaUMsU0FBUSw2QkFBNkI7SUFJbEYsSUFBVyxVQUFVO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLFlBQVksRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFFRCxZQUNDLGNBQW1FLEVBQ25FLFlBQTZDLEVBQzdDLE9BQXNDLEVBQ3RDLFFBQTBCLEVBQzFCLFVBQXNCLEVBQ3RCLG9CQUFrQyxFQUNsQyxtQkFBMkIsRUFDM0Isd0JBQWtELEVBQzNCLG9CQUEyQztRQUVsRSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFdEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxjQUFjLENBQUMsU0FBUyxZQUFZLENBQUMsUUFBUSxLQUFLLFlBQVksQ0FBQyxPQUFPLFVBQVUsQ0FBQyxDQUFDO1FBQ3RHLE1BQU0sbUJBQW1CLEdBQXlCO1lBQ2pELElBQUksRUFBRSxpQkFBaUI7WUFDdkIsT0FBTyxFQUFFLE9BQU87U0FDaEIsQ0FBQztRQUVGLE1BQU0sc0JBQXNCLEdBQTRCO1lBQ3ZELFdBQVcsRUFBRSxJQUFJO1lBQ2pCLFlBQVksRUFBRSxFQUFFO1lBQ2hCLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLGFBQWEsRUFBRTtnQkFDZCxRQUFRLEVBQUUsSUFBSTthQUNkO1NBQ0QsQ0FBQztRQUNGLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsdUJBQXVCLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLG9CQUFvQixFQUFFLEVBQUUsd0JBQXdCLEVBQUUsRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMvUCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxRixNQUFNLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN6QyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDZixjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQzFCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM1RCxNQUFNLFlBQVksR0FBRyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEgsSUFBSSxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBQ3JDLENBQUM7Q0FDRCxDQUFBO0FBNUNZLGdDQUFnQztJQWlCMUMsV0FBQSxxQkFBcUIsQ0FBQTtHQWpCWCxnQ0FBZ0MsQ0E0QzVDIn0=