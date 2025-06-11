/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { ResourceMap } from '../../../../../base/common/map.js';
import { cloneAndChange } from '../../../../../base/common/objects.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { StringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../../editor/common/core/ranges/offsetRange.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { TestEnvironmentService } from '../../../../test/browser/workbenchTestServices.js';
import { ChatEditingSessionStorage } from '../../browser/chatEditing/chatEditingSessionStorage.js';
import { ChatEditingSnapshotTextModelContentProvider } from '../../browser/chatEditing/chatEditingTextModelContentProviders.js';
suite('ChatEditingSessionStorage', () => {
    const ds = ensureNoDisposablesAreLeakedInTestSuite();
    const sessionId = generateUuid();
    let fs;
    let storage;
    class TestChatEditingSessionStorage extends ChatEditingSessionStorage {
        get storageLocation() {
            return super._getStorageLocation();
        }
    }
    setup(() => {
        fs = ds.add(new FileService(new NullLogService()));
        ds.add(fs.registerProvider(TestEnvironmentService.workspaceStorageHome.scheme, ds.add(new InMemoryFileSystemProvider())));
        storage = new TestChatEditingSessionStorage(sessionId, fs, TestEnvironmentService, new NullLogService(), { getWorkspace: () => ({ id: 'workspaceId' }) });
    });
    function makeStop(requestId, before, after) {
        const stopId = generateUuid();
        const resource = URI.file('/foo.js');
        return {
            stopId,
            entries: new ResourceMap([
                [resource, { resource, languageId: 'javascript', snapshotUri: ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(sessionId, requestId, stopId, resource.path), original: `contents${before}}`, current: `contents${after}`, originalToCurrentEdit: StringEdit.replace(OffsetRange.ofLength(42), 'newtext'), state: 0 /* ModifiedFileEntryState.Modified */, telemetryInfo: { agentId: 'agentId', command: 'cmd', requestId: generateUuid(), result: undefined, sessionId } }],
            ]),
        };
    }
    function generateState() {
        const initialFileContents = new ResourceMap();
        for (let i = 0; i < 10; i++) {
            initialFileContents.set(URI.file(`/foo${i}.js`), `fileContents${Math.floor(i / 2)}`);
        }
        const r1 = generateUuid();
        const r2 = generateUuid();
        return {
            initialFileContents,
            pendingSnapshot: makeStop(undefined, 'd', 'e'),
            recentSnapshot: makeStop(undefined, 'd', 'e'),
            linearHistoryIndex: 3,
            linearHistory: [
                { startIndex: 0, requestId: r1, stops: [makeStop(r1, 'a', 'b')], postEdit: makeStop(r1, 'b', 'c').entries },
                { startIndex: 1, requestId: r2, stops: [makeStop(r2, 'c', 'd'), makeStop(r2, 'd', 'd')], postEdit: makeStop(r2, 'd', 'd').entries },
            ]
        };
    }
    test('state is empty initially', async () => {
        const s = await storage.restoreState();
        assert.strictEqual(s, undefined);
    });
    test('round trips state', async () => {
        const original = generateState();
        await storage.storeState(original);
        const changer = (x) => {
            return URI.isUri(x) ? x.toString() : x instanceof Map ? cloneAndChange([...x.values()], changer) : undefined;
        };
        const restored = await storage.restoreState();
        assert.deepStrictEqual(cloneAndChange(restored, changer), cloneAndChange(original, changer));
    });
    test('clears state', async () => {
        await storage.storeState(generateState());
        await storage.clearState();
        const s = await storage.restoreState();
        assert.strictEqual(s, undefined);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvYnJvd3Nlci9jaGF0RWRpdGluZ1Nlc3Npb25TdG9yYWdlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDakMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDdEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ2hILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUUzRixPQUFPLEVBQUUseUJBQXlCLEVBQStDLE1BQU0sd0RBQXdELENBQUM7QUFDaEosT0FBTyxFQUFFLDJDQUEyQyxFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFHaEksS0FBSyxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtJQUN2QyxNQUFNLEVBQUUsR0FBRyx1Q0FBdUMs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Q0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDOUcsQ0FBQyxDQUFDO1FBRUYsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDOUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFFLGNBQWMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUM5RixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxjQUFjLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDL0IsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDMUMsTUFBTSxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDM0IsTUFBTSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDdkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDbEMsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9