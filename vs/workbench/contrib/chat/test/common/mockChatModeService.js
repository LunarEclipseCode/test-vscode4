/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
import { ChatMode2 } from '../../common/chatModes.js';
export class MockChatModeService {
    constructor() {
        this._modes = { builtin: [ChatMode2.Ask] };
        this.onDidChangeChatModes = Event.None;
    }
    getModes() {
        return this._modes;
    }
    async getModesAsync() {
        return this._modes;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRNb2RlU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9tb2NrQ2hhdE1vZGVTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsU0FBUyxFQUErQixNQUFNLDJCQUEyQixDQUFDO0FBRW5GLE1BQU0sT0FBTyxtQkFBbUI7SUFBaEM7UUFHUyxXQUFNLEdBQXFFLEVBQUUsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFFaEcseUJBQW9CLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztJQVNuRCxDQUFDO0lBUEEsUUFBUTtRQUNQLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNwQixDQUFDO0lBRUQsS0FBSyxDQUFDLGFBQWE7UUFDbEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3BCLENBQUM7Q0FDRCJ9