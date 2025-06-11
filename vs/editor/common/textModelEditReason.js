/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class TextModelEditReason {
    static { this._nextMetadataId = 0; }
    static { this._metaDataMap = new Map(); }
    /**
     * Sets the reason for all text model edits done in the callback.
    */
    static editWithReason(reason, runner) {
        const id = this._nextMetadataId++;
        this._metaDataMap.set(id, reason.metadata);
        try {
            const result = runner();
            return result;
        }
        finally {
            this._metaDataMap.delete(id);
        }
    }
    static _getCurrentMetadata() {
        const result = {};
        for (const metadata of this._metaDataMap.values()) {
            Object.assign(result, metadata);
        }
        return result;
    }
    constructor(metadata) {
        this.metadata = metadata;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1vZGVsRWRpdFJlYXNvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi90ZXh0TW9kZWxFZGl0UmVhc29uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE1BQU0sT0FBTyxtQkFBbUI7YUFDaEIsb0JBQWUsR0FBRyxDQUFDLENBQUM7YUFDcEIsaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBd0MsQ0FBQztJQUU5RTs7TUFFRTtJQUNLLE1BQU0sQ0FBQyxjQUFjLENBQUksTUFBMkIsRUFBRSxNQUFlO1FBQzNFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQztZQUNKLE1BQU0sTUFBTSxHQUFHLE1BQU0sRUFBRSxDQUFDO1lBQ3hCLE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztnQkFBUyxDQUFDO1lBQ1YsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDOUIsQ0FBQztJQUNGLENBQUM7SUFFTSxNQUFNLENBQUMsbUJBQW1CO1FBQ2hDLE1BQU0sTUFBTSxHQUFpQyxFQUFFLENBQUM7UUFDaEQsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7WUFDbkQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVELFlBQTRCLFFBQXNDO1FBQXRDLGFBQVEsR0FBUixRQUFRLENBQThCO0lBQUksQ0FBQyJ9