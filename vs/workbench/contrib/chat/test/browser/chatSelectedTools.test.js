/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { LanguageModelToolsService } from '../../browser/languageModelToolsService.js';
import { IChatService } from '../../common/chatService.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../common/languageModelToolsService.js';
import { MockChatService } from '../common/mockChatService.js';
import { ChatSelectedTools } from '../../browser/chatSelectedTools.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { ChatMode } from '../../common/constants.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
suite('ChatSelectedTools', () => {
    let store;
    let toolsService;
    let selectedTools;
    setup(() => {
        store = new DisposableStore();
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(new TestConfigurationService)),
        }, store);
        instaService.stub(IChatService, new MockChatService());
        instaService.stub(ILanguageModelToolsService, instaService.createInstance(LanguageModelToolsService));
        store.add(instaService);
        toolsService = instaService.get(ILanguageModelToolsService);
        selectedTools = store.add(instaService.createInstance(ChatSelectedTools, constObservable(ChatMode.Agent)));
    });
    teardown(function () {
        store.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Can\'t enable/disable MCP tools directly #18161', () => {
        return runWithFakedTimers({}, async () => {
            const toolData1 = {
                id: 'testTool1',
                modelDescription: 'Test Tool 1',
                displayName: 'Test Tool 1',
                canBeReferencedInPrompt: true,
                toolReferenceName: 't1',
                source: ToolDataSource.Internal,
            };
            const toolData2 = {
                id: 'testTool2',
                modelDescription: 'Test Tool 2',
                displayName: 'Test Tool 2',
                source: ToolDataSource.Internal,
                canBeReferencedInPrompt: true,
                toolReferenceName: 't2',
            };
            const toolData3 = {
                id: 'testTool3',
                modelDescription: 'Test Tool 3',
                displayName: 'Test Tool 3',
                source: ToolDataSource.Internal,
                canBeReferencedInPrompt: true,
                toolReferenceName: 't3',
            };
            const toolset = toolsService.createToolSet(ToolDataSource.Internal, 'mcp', 'mcp');
            store.add(toolsService.registerToolData(toolData1));
            store.add(toolsService.registerToolData(toolData2));
            store.add(toolsService.registerToolData(toolData3));
            store.add(toolset);
            store.add(toolset.addTool(toolData1));
            store.add(toolset.addTool(toolData2));
            store.add(toolset.addTool(toolData3));
            assert.strictEqual(Iterable.length(toolsService.getTools()), 3);
            const size = Iterable.length(toolset.getTools());
            assert.strictEqual(size, 3);
            await timeout(1000); // UGLY the tools service updates its state sync but emits the event async (750ms) delay. This affects the observable that depends on the event
            assert.strictEqual(selectedTools.entriesMap.size, 4); // 1 toolset, 3 tools
            selectedTools.disable([], [toolData2, toolData3], false);
            const map = selectedTools.asEnablementMap();
            assert.strictEqual(map.size, 3); // 3 tools
            assert.strictEqual(map.get(toolData1), true);
            assert.strictEqual(map.get(toolData2), false);
            assert.strictEqual(map.get(toolData3), false);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlbGVjdGVkVG9vbHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvY2hhdFNlbGVjdGVkVG9vbHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDcEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDdkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSwwQkFBMEIsRUFBYSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNsSCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdkUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO0lBRS9CLElBQUksS0FBc0IsQ0FBQztJQUUzQixJQUFJLFlBQXdDLENBQUM7SUFDN0MsSUFBSSxhQUFnQyxDQUFDO0lBRXJDLEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFFVixLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUU5QixNQUFNLFlBQVksR0FBRyw2QkFBNkIsQ0FBQztZQUNsRCxpQkFBaUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksaUJBQWlCLENBQUMsSUFBSSx3QkFBd0IsQ0FBQyxDQUFDO1NBQ3ZGLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDVixZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7UUFDdkQsWUFBWSxDQUFDLElBQUksQ0FBQywwQkFBMEIsRUFBRSxZQUFZLENBQUMsY0FBYyxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQztRQUV0RyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3hCLFlBQVksR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDNUQsYUFBYSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RyxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQztRQUNSLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDLENBQUMsQ0FBQztJQUVILHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLGlEQUFpRCxFQUFFLEdBQUcsRUFBRTtRQUU1RCxPQUFPLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUV4QyxNQUFNLFNBQVMsR0FBYztnQkFDNUIsRUFBRSxFQUFFLFdBQVc7Z0JBQ2YsZ0JBQWdCLEVBQUUsYUFBYTtnQkFDL0IsV0FBVyxFQUFFLGFBQWE7Z0JBQzFCLHVCQUF1QixFQUFFLElBQUk7Z0JBQzdCLGlCQUFpQixFQUFFLElBQUk7Z0JBQ3ZCLE1BQU0sRUFBRSxjQUFjLENBQUMsUUFBUTthQUMvQixDQUFDO1lBRUYsTUFBTSxTQUFTLEdBQWM7Z0JBQzVCLEVBQUUsRUFBRSxXQUFXO2dCQUNmLGdCQUFnQixFQUFFLGFBQWE7Z0JBQy9CLFdBQVcsRUFBRSxhQUFhO2dCQUMxQixNQUFNLEVBQUUsY0FBYyxDQUFDLFFBQVE7Z0JBQy9CLHVCQUF1QixFQUFFLElBQUk7Z0JBQzdCLGlCQUFpQixFQUFFLElBQUk7YUFDdkIsQ0FBQztZQUVGLE1BQU0sU0FBUyxHQUFjO2dCQUM1QixFQUFFLEVBQUUsV0FBVztnQkFDZixnQkFBZ0IsRUFBRSxhQUFhO2dCQUMvQixXQUFXLEVBQUUsYUFBYTtnQkFDMUIsTUFBTSxFQUFFLGNBQWMsQ0FBQyxRQUFRO2dCQUMvQix1QkFBdUIsRUFBRSxJQUFJO2dCQUM3QixpQkFBaUIsRUFBRSxJQUFJO2FBQ3ZCLENBQUM7WUFFRixNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsYUFBYSxDQUN6QyxjQUFjLENBQUMsUUFBUSxFQUN2QixLQUFLLEVBQUUsS0FBSyxDQUNaLENBQUM7WUFFRixLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3BELEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDcEQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUVwRCxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ25CLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBRXRDLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUVoRSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRTVCLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsK0lBQStJO1lBRXBLLE1BQU0sQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7WUFFM0UsYUFBYSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFekQsTUFBTSxHQUFHLEdBQUcsYUFBYSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzVDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVU7WUFFM0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM5QyxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0MsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=