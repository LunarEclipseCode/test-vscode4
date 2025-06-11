/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
export var PackageType;
(function (PackageType) {
    PackageType["NODE"] = "npm";
    PackageType["DOCKER"] = "docker";
    PackageType["PYTHON"] = "pypi";
    PackageType["REMOTE"] = "remote";
})(PackageType || (PackageType = {}));
export const IMcpGalleryService = createDecorator('IMcpGalleryService');
export const IMcpManagementService = createDecorator('IMcpManagementService');
export const mcpGalleryServiceUrlConfig = 'chat.mcp.gallery.serviceUrl';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbWNwL2NvbW1vbi9tY3BNYW5hZ2VtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBTWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQXFEOUUsTUFBTSxDQUFOLElBQWtCLFdBS2pCO0FBTEQsV0FBa0IsV0FBVztJQUM1QiwyQkFBWSxDQUFBO0lBQ1osZ0NBQWlCLENBQUE7SUFDakIsOEJBQWUsQ0FBQTtJQUNmLGdDQUFpQixDQUFBO0FBQ2xCLENBQUMsRUFMaUIsV0FBVyxLQUFYLFdBQVcsUUFLNUI7QUFtRkQsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxDQUFxQixvQkFBb0IsQ0FBQyxDQUFDO0FBUzVGLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLGVBQWUsQ0FBd0IsdUJBQXVCLENBQUMsQ0FBQztBQVlyRyxNQUFNLENBQUMsTUFBTSwwQkFBMEIsR0FBRyw2QkFBNkIsQ0FBQyJ9