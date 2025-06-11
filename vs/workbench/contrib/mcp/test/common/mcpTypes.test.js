/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { McpResourceURI } from '../../common/mcpTypes.js';
import * as assert from 'assert';
suite('MCP Types', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('McpResourceURI - round trips', () => {
        const roundTrip = (uri) => {
            const from = McpResourceURI.fromServer({ label: '', id: 'my-id' }, uri);
            const to = McpResourceURI.toServer(from);
            assert.strictEqual(to.definitionId, 'my-id');
            assert.strictEqual(to.resourceURI.toString(true), uri, `expected to round trip ${uri}`);
        };
        roundTrip('file:///path/to/file.txt');
        roundTrip('custom-scheme://my-path/to/resource.txt');
        roundTrip('custom-scheme://my-path');
        roundTrip('custom-scheme://my-path/');
        roundTrip('custom-scheme://my-path/?with=query&params=here');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwVHlwZXMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL3Rlc3QvY29tbW9uL21jcFR5cGVzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzFELE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBRWpDLEtBQUssQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLDhCQUE4QixFQUFFLEdBQUcsRUFBRTtRQUN6QyxNQUFNLFNBQVMsR0FBRyxDQUFDLEdBQVcsRUFBRSxFQUFFO1lBQ2pDLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN4RSxNQUFNLEVBQUUsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM3QyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSwwQkFBMEIsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUN6RixDQUFDLENBQUM7UUFFRixTQUFTLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN0QyxTQUFTLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUNyRCxTQUFTLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUNyQyxTQUFTLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN0QyxTQUFTLENBQUMsaURBQWlELENBQUMsQ0FBQztJQUM5RCxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=