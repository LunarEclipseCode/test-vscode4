/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { isBoolean, isString } from '../../../../base/common/types.js';
export const IWorkbenchThemeService = refineServiceDecorator(IThemeService);
export const THEME_SCOPE_OPEN_PAREN = '[';
export const THEME_SCOPE_CLOSE_PAREN = ']';
export const THEME_SCOPE_WILDCARD = '*';
export const themeScopeRegex = /\[(.+?)\]/g;
export var ThemeSettings;
(function (ThemeSettings) {
    ThemeSettings["COLOR_THEME"] = "workbench.colorTheme";
    ThemeSettings["FILE_ICON_THEME"] = "workbench.iconTheme";
    ThemeSettings["PRODUCT_ICON_THEME"] = "workbench.productIconTheme";
    ThemeSettings["COLOR_CUSTOMIZATIONS"] = "workbench.colorCustomizations";
    ThemeSettings["TOKEN_COLOR_CUSTOMIZATIONS"] = "editor.tokenColorCustomizations";
    ThemeSettings["SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS"] = "editor.semanticTokenColorCustomizations";
    ThemeSettings["PREFERRED_DARK_THEME"] = "workbench.preferredDarkColorTheme";
    ThemeSettings["PREFERRED_LIGHT_THEME"] = "workbench.preferredLightColorTheme";
    ThemeSettings["PREFERRED_HC_DARK_THEME"] = "workbench.preferredHighContrastColorTheme";
    ThemeSettings["PREFERRED_HC_LIGHT_THEME"] = "workbench.preferredHighContrastLightColorTheme";
    ThemeSettings["DETECT_COLOR_SCHEME"] = "window.autoDetectColorScheme";
    ThemeSettings["DETECT_HC"] = "window.autoDetectHighContrast";
    ThemeSettings["SYSTEM_COLOR_THEME"] = "window.systemColorTheme";
})(ThemeSettings || (ThemeSettings = {}));
export var ThemeSettingDefaults;
(function (ThemeSettingDefaults) {
    ThemeSettingDefaults["COLOR_THEME_DARK"] = "Default Dark Modern";
    ThemeSettingDefaults["COLOR_THEME_LIGHT"] = "Default Light Modern";
    ThemeSettingDefaults["COLOR_THEME_HC_DARK"] = "Default High Contrast";
    ThemeSettingDefaults["COLOR_THEME_HC_LIGHT"] = "Default High Contrast Light";
    ThemeSettingDefaults["COLOR_THEME_DARK_OLD"] = "Default Dark+";
    ThemeSettingDefaults["COLOR_THEME_LIGHT_OLD"] = "Default Light+";
    ThemeSettingDefaults["FILE_ICON_THEME"] = "vs-seti";
    ThemeSettingDefaults["PRODUCT_ICON_THEME"] = "Default";
})(ThemeSettingDefaults || (ThemeSettingDefaults = {}));
export const COLOR_THEME_DARK_INITIAL_COLORS = {
    'activityBar.activeBorder': '#0078d4',
    'activityBar.background': '#181818',
    'activityBar.border': '#2b2b2b',
    'activityBar.foreground': '#d7d7d7',
    'activityBar.inactiveForeground': '#868686',
    'editorGroup.border': '#ffffff17',
    'editorGroupHeader.tabsBackground': '#181818',
    'editorGroupHeader.tabsBorder': '#2b2b2b',
    'statusBar.background': '#181818',
    'statusBar.border': '#2b2b2b',
    'statusBar.foreground': '#cccccc',
    'statusBar.noFolderBackground': '#1f1f1f',
    'tab.activeBackground': '#1f1f1f',
    'tab.activeBorder': '#1f1f1f',
    'tab.activeBorderTop': '#0078d4',
    'tab.activeForeground': '#ffffff',
    'tab.border': '#2b2b2b',
    'textLink.foreground': '#4daafc',
    'titleBar.activeBackground': '#181818',
    'titleBar.activeForeground': '#cccccc',
    'titleBar.border': '#2b2b2b',
    'titleBar.inactiveBackground': '#1f1f1f',
    'titleBar.inactiveForeground': '#9d9d9d',
    'welcomePage.tileBackground': '#2b2b2b'
};
export const COLOR_THEME_LIGHT_INITIAL_COLORS = {
    'activityBar.activeBorder': '#005FB8',
    'activityBar.background': '#f8f8f8',
    'activityBar.border': '#e5e5e5',
    'activityBar.foreground': '#1f1f1f',
    'activityBar.inactiveForeground': '#616161',
    'editorGroup.border': '#e5e5e5',
    'editorGroupHeader.tabsBackground': '#f8f8f8',
    'editorGroupHeader.tabsBorder': '#e5e5e5',
    'statusBar.background': '#f8f8f8',
    'statusBar.border': '#e5e5e5',
    'statusBar.foreground': '#3b3b3b',
    'statusBar.noFolderBackground': '#f8f8f8',
    'tab.activeBackground': '#ffffff',
    'tab.activeBorder': '#f8f8f8',
    'tab.activeBorderTop': '#005fb8',
    'tab.activeForeground': '#3b3b3b',
    'tab.border': '#e5e5e5',
    'textLink.foreground': '#005fb8',
    'titleBar.activeBackground': '#f8f8f8',
    'titleBar.activeForeground': '#1e1e1e',
    'titleBar.border': '#E5E5E5',
    'titleBar.inactiveBackground': '#f8f8f8',
    'titleBar.inactiveForeground': '#8b949e',
    'welcomePage.tileBackground': '#f3f3f3'
};
export var ExtensionData;
(function (ExtensionData) {
    function toJSONObject(d) {
        return d && { _extensionId: d.extensionId, _extensionIsBuiltin: d.extensionIsBuiltin, _extensionName: d.extensionName, _extensionPublisher: d.extensionPublisher };
    }
    ExtensionData.toJSONObject = toJSONObject;
    function fromJSONObject(o) {
        if (o && isString(o._extensionId) && isBoolean(o._extensionIsBuiltin) && isString(o._extensionName) && isString(o._extensionPublisher)) {
            return { extensionId: o._extensionId, extensionIsBuiltin: o._extensionIsBuiltin, extensionName: o._extensionName, extensionPublisher: o._extensionPublisher };
        }
        return undefined;
    }
    ExtensionData.fromJSONObject = fromJSONObject;
    function fromName(publisher, name, isBuiltin = false) {
        return { extensionPublisher: publisher, extensionId: `${publisher}.${name}`, extensionName: name, extensionIsBuiltin: isBuiltin };
    }
    ExtensionData.fromName = fromName;
})(ExtensionData || (ExtensionData = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoVGhlbWVTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi93b3JrYmVuY2hUaGVtZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFHcEcsT0FBTyxFQUFlLGFBQWEsRUFBcUMsTUFBTSxtREFBbUQsQ0FBQztBQUVsSSxPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBSXZFLE1BQU0sQ0FBQyxNQUFNLHNCQUFzQixHQUFHLHNCQUFzQixDQUF3QyxhQUFhLENBQUMsQ0FBQztBQUVuSCxNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLENBQUM7QUFDMUMsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxDQUFDO0FBQzNDLE1BQU0sQ0FBQyxNQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQztBQUV4QyxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsWUFBWSxDQUFDO0FBRTVDLE1BQU0sQ0FBTixJQUFZLGFBZ0JYO0FBaEJELFdBQVksYUFBYTtJQUN4QixxREFBb0MsQ0FBQTtJQUNwQyx3REFBdUMsQ0FBQTtJQUN2QyxrRUFBaUQsQ0FBQTtJQUNqRCx1RUFBc0QsQ0FBQTtJQUN0RCwrRUFBOEQsQ0FBQTtJQUM5RCxnR0FBK0UsQ0FBQTtJQUUvRSwyRUFBMEQsQ0FBQTtJQUMxRCw2RUFBNEQsQ0FBQTtJQUM1RCxzRkFBcUUsQ0FBQTtJQUNyRSw0RkFBMkUsQ0FBQTtJQUMzRSxxRUFBb0QsQ0FBQTtJQUNwRCw0REFBMkMsQ0FBQTtJQUUzQywrREFBOEMsQ0FBQTtBQUMvQyxDQUFDLEVBaEJXLGFBQWEsS0FBYixhQUFhLFFBZ0J4QjtBQUVE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