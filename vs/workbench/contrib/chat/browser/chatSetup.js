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
var SetupAgent_1, ChatSetup_1;
import './media/chatSetup.css';
import { $ } from '../../../../base/browser/dom.js';
import { Dialog, DialogContentsAlignment } from '../../../../base/browser/ui/dialog/dialog.js';
import { toAction } from '../../../../base/common/actions.js';
import { timeout } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore, markAsSingleton, MutableDisposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { equalsIgnoreCase } from '../../../../base/common/strings.js';
import { isObject } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { MarkdownRenderer } from '../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { createWorkbenchDialogOptions } from '../../../../platform/dialogs/browser/dialog.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import product from '../../../../platform/product/common/product.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceTrustRequestService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IActivityService, ProgressBadge } from '../../../services/activity/common/activity.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { ExtensionUrlHandlerOverrideRegistry } from '../../../services/extensions/browser/extensionUrlHandler.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../chat/common/languageModelToolsService.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { ChatEntitlement, ChatEntitlementRequests, IChatEntitlementService, isProUser } from '../common/chatEntitlementService.js';
import { ChatRequestModel } from '../common/chatModel.js';
import { ChatRequestAgentPart, ChatRequestToolPart } from '../common/chatParserTypes.js';
import { IChatService } from '../common/chatService.js';
import { ChatAgentLocation, ChatConfiguration, ChatMode, validateChatMode } from '../common/constants.js';
import { ILanguageModelsService } from '../common/languageModels.js';
import { CHAT_CATEGORY, CHAT_OPEN_ACTION_ID, CHAT_SETUP_ACTION_ID } from './actions/chatActions.js';
import { ChatViewId, IChatWidgetService, showCopilotView } from './chat.js';
import { CHAT_SIDEBAR_PANEL_ID } from './chatViewPane.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ChatMode2 } from '../common/chatModes.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
const defaultChat = {
    extensionId: product.defaultChatAgent?.extensionId ?? '',
    chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? '',
    documentationUrl: product.defaultChatAgent?.documentationUrl ?? '',
    skusDocumentationUrl: product.defaultChatAgent?.skusDocumentationUrl ?? '',
    publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? '',
    manageOveragesUrl: product.defaultChatAgent?.manageOverageUrl ?? '',
    upgradePlanUrl: product.defaultChatAgent?.upgradePlanUrl ?? '',
    signUpUrl: product.defaultChatAgent?.signUpUrl ?? '',
    providerName: product.defaultChatAgent?.providerName ?? '',
    enterpriseProviderId: product.defaultChatAgent?.enterpriseProviderId ?? '',
    enterpriseProviderName: product.defaultChatAgent?.enterpriseProviderName ?? '',
    alternativeProviderId: product.defaultChatAgent?.alternativeProviderId ?? '',
    alternativeProviderName: product.defaultChatAgent?.alternativeProviderName ?? '',
    providerUriSetting: product.defaultChatAgent?.providerUriSetting ?? '',
    providerScopes: product.defaultChatAgent?.providerScopes ?? [[]],
    manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? '',
    completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? '',
    walkthroughCommand: product.defaultChatAgent?.walkthroughCommand ?? '',
    completionsRefreshTokenCommand: product.defaultChatAgent?.completionsRefreshTokenCommand ?? '',
    chatRefreshTokenCommand: product.defaultChatAgent?.chatRefreshTokenCommand ?? '',
};
//#region Contribution
const ToolsAgentContextKey = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ChatConfiguration.AgentEnabled}`, true), ChatContextKeys.Editing.agentModeDisallowed.negate(), ContextKeyExpr.not(`previewFeaturesDisabled`) // Set by extension
);
let SetupAgent = class SetupAgent extends Disposable {
    static { SetupAgent_1 = this; }
    static registerDefaultAgents(instantiationService, location, mode, context, controller) {
        return instantiationService.invokeFunction(accessor => {
            const chatAgentService = accessor.get(IChatAgentService);
            let id;
            let description = ChatMode2.Ask.description;
            switch (location) {
                case ChatAgentLocation.Panel:
                    if (mode === ChatMode.Ask) {
                        id = 'setup.chat';
                    }
                    else if (mode === ChatMode.Edit) {
                        id = 'setup.edits';
                        description = ChatMode2.Edit.description;
                    }
                    else {
                        id = 'setup.agent';
                        description = ChatMode2.Agent.description;
                    }
                    break;
                case ChatAgentLocation.Terminal:
                    id = 'setup.terminal';
                    break;
                case ChatAgentLocation.Editor:
                    id = 'setup.editor';
                    break;
                case ChatAgentLocation.Notebook:
                    id = 'setup.notebook';
                    break;
            }
            return SetupAgent_1.doRegisterAgent(instantiationService, chatAgentService, id, `${defaultChat.providerName} Copilot`, true, description, location, mode, context, controller);
        });
    }
    static registerVSCodeAgent(instantiationService, context, controller) {
        return instantiationService.invokeFunction(accessor => {
            const chatAgentService = accessor.get(IChatAgentService);
            const disposables = new DisposableStore();
            const { agent, disposable } = SetupAgent_1.doRegisterAgent(instantiationService, chatAgentService, 'setup.vscode', 'vscode', false, localize2('vscodeAgentDescription', "Ask questions about VS Code").value, ChatAgentLocation.Panel, undefined, context, controller);
            disposables.add(disposable);
            disposables.add(SetupTool.registerTool(instantiationService, {
                id: 'setup.tools.createNewWorkspace',
                source: ToolDataSource.Internal,
                icon: Codicon.newFolder,
                displayName: localize('setupToolDisplayName', "New Workspace"),
                modelDescription: localize('setupToolsDescription', "Scaffold a new workspace in VS Code"),
                userDescription: localize('setupToolsDescription', "Scaffold a new workspace in VS Code"),
                canBeReferencedInPrompt: true,
                toolReferenceName: 'new',
                when: ContextKeyExpr.true(),
            }).disposable);
            return { agent, disposable: disposables };
        });
    }
    static doRegisterAgent(instantiationService, chatAgentService, id, name, isDefault, description, location, mode, context, controller) {
        const disposables = new DisposableStore();
        disposables.add(chatAgentService.registerAgent(id, {
            id,
            name,
            isDefault,
            isCore: true,
            modes: mode ? [mode] : [ChatMode.Ask],
            when: mode === ChatMode.Agent ? ToolsAgentContextKey?.serialize() : undefined,
            slashCommands: [],
            disambiguation: [],
            locations: [location],
            metadata: { helpTextPrefix: SetupAgent_1.SETUP_NEEDED_MESSAGE },
            description,
            extensionId: nullExtensionDescription.identifier,
            extensionDisplayName: nullExtensionDescription.name,
            extensionPublisherId: nullExtensionDescription.publisher
        }));
        const agent = disposables.add(instantiationService.createInstance(SetupAgent_1, context, controller, location));
        disposables.add(chatAgentService.registerAgentImplementation(id, agent));
        if (mode === ChatMode.Agent) {
            chatAgentService.updateAgent(id, { themeIcon: Codicon.tools });
        }
        return { agent, disposable: disposables };
    }
    static { this.SETUP_NEEDED_MESSAGE = new MarkdownString(localize('settingUpCopilotNeeded', "You need to set up Copilot and be signed in to use Chat.")); }
    constructor(context, controller, location, instantiationService, logService, configurationService, telemetryService, environmentService) {
        super();
        this.context = context;
        this.controller = controller;
        this.location = location;
        this.instantiationService = instantiationService;
        this.logService = logService;
        this.configurationService = configurationService;
        this.telemetryService = telemetryService;
        this.environmentService = environmentService;
        this._onUnresolvableError = this._register(new Emitter());
        this.onUnresolvableError = this._onUnresolvableError.event;
        this.pendingForwardedRequests = new Map();
    }
    async invoke(request, progress) {
        return this.instantiationService.invokeFunction(async (accessor /* using accessor for lazy loading */) => {
            const chatService = accessor.get(IChatService);
            const languageModelsService = accessor.get(ILanguageModelsService);
            const chatWidgetService = accessor.get(IChatWidgetService);
            const chatAgentService = accessor.get(IChatAgentService);
            const languageModelToolsService = accessor.get(ILanguageModelToolsService);
            return this.doInvoke(request, part => progress([part]), chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
        });
    }
    async doInvoke(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService) {
        if (!this.context.state.installed || this.context.state.disabled || this.context.state.entitlement === ChatEntitlement.Available || this.context.state.entitlement === ChatEntitlement.Unknown) {
            return this.doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
        }
        return this.doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
    }
    async doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService) {
        const requestModel = chatWidgetService.getWidgetBySessionId(request.sessionId)?.viewModel?.model.getRequests().at(-1);
        if (!requestModel) {
            this.logService.error('[chat setup] Request model not found, cannot redispatch request.');
            return {}; // this should not happen
        }
        progress({
            kind: 'progressMessage',
            content: new MarkdownString(localize('waitingCopilot', "Getting Copilot ready.")),
        });
        await this.forwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
        return {};
    }
    async forwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
        try {
            await this.doForwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
        }
        catch (error) {
            progress({
                kind: 'warning',
                content: new MarkdownString(localize('copilotUnavailableWarning', "Copilot failed to get a response. Please try again."))
            });
        }
    }
    async doForwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
        if (this.pendingForwardedRequests.has(requestModel.session.sessionId)) {
            throw new Error('Request already in progress');
        }
        const forwardRequest = this.doForwardRequestToCopilotWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
        this.pendingForwardedRequests.set(requestModel.session.sessionId, forwardRequest);
        try {
            await forwardRequest;
        }
        finally {
            this.pendingForwardedRequests.delete(requestModel.session.sessionId);
        }
    }
    async doForwardRequestToCopilotWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
        const widget = chatWidgetService.getWidgetBySessionId(requestModel.session.sessionId);
        const mode = widget?.input.currentMode;
        const languageModel = widget?.input.currentLanguageModel;
        // We need a signal to know when we can resend the request to
        // Copilot. Waiting for the registration of the agent is not
        // enough, we also need a language/tools model to be available.
        const whenAgentReady = this.whenAgentReady(chatAgentService, mode);
        const whenLanguageModelReady = this.whenLanguageModelReady(languageModelsService);
        const whenToolsModelReady = this.whenToolsModelReady(languageModelToolsService, requestModel);
        if (whenLanguageModelReady instanceof Promise || whenAgentReady instanceof Promise || whenToolsModelReady instanceof Promise) {
            const timeoutHandle = setTimeout(() => {
                progress({
                    kind: 'progressMessage',
                    content: new MarkdownString(localize('waitingCopilot2', "Copilot is almost ready.")),
                });
            }, 10000);
            try {
                const ready = await Promise.race([
                    timeout(this.environmentService.remoteAuthority ? 60000 /* increase for remote scenarios */ : 20000).then(() => 'timedout'),
                    this.whenDefaultAgentFailed(chatService).then(() => 'error'),
                    Promise.allSettled([whenLanguageModelReady, whenAgentReady, whenToolsModelReady])
                ]);
                if (ready === 'error' || ready === 'timedout') {
                    let warningMessage;
                    if (ready === 'timedout') {
                        warningMessage = localize('copilotTookLongWarning', "Copilot took too long to get ready. Please ensure you are signed in to {0} and that the extension `{1}` is installed and enabled.", defaultChat.providerName, defaultChat.chatExtensionId);
                    }
                    else {
                        warningMessage = localize('copilotFailedWarning', "Copilot failed to get ready. Please ensure you are signed in to {0} and that the extension `{1}` is installed and enabled.", defaultChat.providerName, defaultChat.chatExtensionId);
                    }
                    progress({
                        kind: 'warning',
                        content: new MarkdownString(warningMessage)
                    });
                    // This means Copilot is unhealthy and we cannot retry the
                    // request. Signal this to the outside via an event.
                    this._onUnresolvableError.fire();
                    return;
                }
            }
            finally {
                clearTimeout(timeoutHandle);
            }
        }
        await chatService.resendRequest(requestModel, {
            mode,
            userSelectedModelId: languageModel,
            userSelectedTools: widget?.getUserSelectedTools()
        });
    }
    whenLanguageModelReady(languageModelsService) {
        for (const id of languageModelsService.getLanguageModelIds()) {
            const model = languageModelsService.lookupLanguageModel(id);
            if (model && model.isDefault) {
                return; // we have language models!
            }
        }
        return Event.toPromise(Event.filter(languageModelsService.onDidChangeLanguageModels, e => e.added?.some(added => added.metadata.isDefault) ?? false));
    }
    whenToolsModelReady(languageModelToolsService, requestModel) {
        const needsToolsModel = requestModel.message.parts.some(part => part instanceof ChatRequestToolPart);
        if (!needsToolsModel) {
            return; // No tools in this request, no need to check
        }
        // check that tools other than setup. and internal tools are registered.
        for (const tool of languageModelToolsService.getTools()) {
            if (tool.source.type !== 'internal') {
                return; // we have tools!
            }
        }
        return Event.toPromise(Event.filter(languageModelToolsService.onDidChangeTools, () => {
            for (const tool of languageModelToolsService.getTools()) {
                if (tool.source.type !== 'internal') {
                    return true; // we have tools!
                }
            }
            return false; // no external tools found
        }));
    }
    whenAgentReady(chatAgentService, mode) {
        const defaultAgent = chatAgentService.getDefaultAgent(this.location, mode);
        if (defaultAgent && !defaultAgent.isCore) {
            return; // we have a default agent from an extension!
        }
        return Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
            const defaultAgent = chatAgentService.getDefaultAgent(this.location, mode);
            return Boolean(defaultAgent && !defaultAgent.isCore);
        }));
    }
    async whenDefaultAgentFailed(chatService) {
        return new Promise(resolve => {
            chatService.activateDefaultAgent(this.location).catch(() => resolve());
        });
    }
    async doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService) {
        this.telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'chat' });
        const requestModel = chatWidgetService.getWidgetBySessionId(request.sessionId)?.viewModel?.model.getRequests().at(-1);
        const setupListener = Event.runAndSubscribe(this.controller.value.onDidChange, (() => {
            switch (this.controller.value.step) {
                case ChatSetupStep.SigningIn:
                    progress({
                        kind: 'progressMessage',
                        content: new MarkdownString(localize('setupChatSignIn2', "Signing in to {0}.", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId ? defaultChat.enterpriseProviderName : defaultChat.providerName)),
                    });
                    break;
                case ChatSetupStep.Installing:
                    progress({
                        kind: 'progressMessage',
                        content: new MarkdownString(localize('installingCopilot', "Getting Copilot ready.")),
                    });
                    break;
            }
        }));
        let result = undefined;
        try {
            result = await ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run({ disableChatViewReveal: true /* we are already in a chat context */ });
        }
        catch (error) {
            this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
        }
        finally {
            setupListener.dispose();
        }
        // User has agreed to run the setup
        if (typeof result?.success === 'boolean') {
            if (result.success) {
                if (result.dialogSkipped) {
                    progress({
                        kind: 'markdownContent',
                        content: new MarkdownString(localize('copilotSetupSuccess', "Copilot setup finished successfully."))
                    });
                }
                else if (requestModel) {
                    let newRequest = this.replaceAgentInRequestModel(requestModel, chatAgentService); // Replace agent part with the actual Copilot agent...
                    newRequest = this.replaceToolInRequestModel(newRequest); // ...then replace any tool parts with the actual Copilot tools
                    await this.forwardRequestToCopilot(newRequest, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
                }
            }
            else {
                progress({
                    kind: 'warning',
                    content: new MarkdownString(localize('copilotSetupError', "Copilot setup failed."))
                });
            }
        }
        // User has cancelled the setup
        else {
            progress({
                kind: 'markdownContent',
                content: SetupAgent_1.SETUP_NEEDED_MESSAGE,
            });
        }
        return {};
    }
    replaceAgentInRequestModel(requestModel, chatAgentService) {
        const agentPart = requestModel.message.parts.find((r) => r instanceof ChatRequestAgentPart);
        if (!agentPart) {
            return requestModel;
        }
        const agentId = agentPart.agent.id.replace(/setup\./, `${defaultChat.extensionId}.`.toLowerCase());
        const githubAgent = chatAgentService.getAgent(agentId);
        if (!githubAgent) {
            return requestModel;
        }
        const newAgentPart = new ChatRequestAgentPart(agentPart.range, agentPart.editorRange, githubAgent);
        return new ChatRequestModel({
            session: requestModel.session,
            message: {
                parts: requestModel.message.parts.map(part => {
                    if (part instanceof ChatRequestAgentPart) {
                        return newAgentPart;
                    }
                    return part;
                }),
                text: requestModel.message.text
            },
            variableData: requestModel.variableData,
            timestamp: Date.now(),
            attempt: requestModel.attempt,
            confirmation: requestModel.confirmation,
            locationData: requestModel.locationData,
            attachedContext: requestModel.attachedContext,
            isCompleteAddedRequest: requestModel.isCompleteAddedRequest,
        });
    }
    replaceToolInRequestModel(requestModel) {
        const toolPart = requestModel.message.parts.find((r) => r instanceof ChatRequestToolPart);
        if (!toolPart) {
            return requestModel;
        }
        const toolId = toolPart.toolId.replace(/setup.tools\./, `copilot_`.toLowerCase());
        const newToolPart = new ChatRequestToolPart(toolPart.range, toolPart.editorRange, toolPart.toolName, toolId, toolPart.displayName, toolPart.icon);
        const chatRequestToolEntry = {
            id: toolId,
            name: 'new',
            range: toolPart.range,
            kind: 'tool',
            value: undefined
        };
        const variableData = {
            variables: [chatRequestToolEntry]
        };
        return new ChatRequestModel({
            session: requestModel.session,
            message: {
                parts: requestModel.message.parts.map(part => {
                    if (part instanceof ChatRequestToolPart) {
                        return newToolPart;
                    }
                    return part;
                }),
                text: requestModel.message.text
            },
            variableData: variableData,
            timestamp: Date.now(),
            attempt: requestModel.attempt,
            confirmation: requestModel.confirmation,
            locationData: requestModel.locationData,
            attachedContext: [chatRequestToolEntry],
            isCompleteAddedRequest: requestModel.isCompleteAddedRequest,
        });
    }
};
SetupAgent = SetupAgent_1 = __decorate([
    __param(3, IInstantiationService),
    __param(4, ILogService),
    __param(5, IConfigurationService),
    __param(6, ITelemetryService),
    __param(7, IWorkbenchEnvironmentService)
], SetupAgent);
class SetupTool extends Disposable {
    static registerTool(instantiationService, toolData) {
        return instantiationService.invokeFunction(accessor => {
            const toolService = accessor.get(ILanguageModelToolsService);
            const disposables = new DisposableStore();
            disposables.add(toolService.registerToolData(toolData));
            const tool = instantiationService.createInstance(SetupTool);
            disposables.add(toolService.registerToolImplementation(toolData.id, tool));
            return { tool, disposable: disposables };
        });
    }
    async invoke(invocation, countTokens, progress, token) {
        const result = {
            content: [
                {
                    kind: 'text',
                    value: ''
                }
            ]
        };
        return result;
    }
    async prepareToolInvocation(parameters, token) {
        return undefined;
    }
}
var ChatSetupStrategy;
(function (ChatSetupStrategy) {
    ChatSetupStrategy[ChatSetupStrategy["Canceled"] = 0] = "Canceled";
    ChatSetupStrategy[ChatSetupStrategy["DefaultSetup"] = 1] = "DefaultSetup";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithoutEnterpriseProvider"] = 2] = "SetupWithoutEnterpriseProvider";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithEnterpriseProvider"] = 3] = "SetupWithEnterpriseProvider";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithAccountCreate"] = 4] = "SetupWithAccountCreate";
})(ChatSetupStrategy || (ChatSetupStrategy = {}));
let ChatSetup = class ChatSetup {
    static { ChatSetup_1 = this; }
    static { this.instance = undefined; }
    static getInstance(instantiationService, context, controller) {
        let instance = ChatSetup_1.instance;
        if (!instance) {
            instance = ChatSetup_1.instance = instantiationService.invokeFunction(accessor => {
                return new ChatSetup_1(context, controller, instantiationService, accessor.get(ITelemetryService), accessor.get(IWorkbenchLayoutService), accessor.get(IKeybindingService), accessor.get(IChatEntitlementService), accessor.get(ILogService), accessor.get(IConfigurationService), accessor.get(IViewsService), accessor.get(IProductService), accessor.get(IOpenerService), accessor.get(IContextMenuService));
            });
        }
        return instance;
    }
    constructor(context, controller, instantiationService, telemetryService, layoutService, keybindingService, chatEntitlementService, logService, configurationService, viewsService, productService, openerService, contextMenuService) {
        this.context = context;
        this.controller = controller;
        this.instantiationService = instantiationService;
        this.telemetryService = telemetryService;
        this.layoutService = layoutService;
        this.keybindingService = keybindingService;
        this.chatEntitlementService = chatEntitlementService;
        this.logService = logService;
        this.configurationService = configurationService;
        this.viewsService = viewsService;
        this.productService = productService;
        this.openerService = openerService;
        this.contextMenuService = contextMenuService;
        this.pendingRun = undefined;
        this.skipDialogOnce = false;
    }
    skipDialog() {
        this.skipDialogOnce = true;
    }
    async run(options) {
        if (this.pendingRun) {
            return this.pendingRun;
        }
        this.pendingRun = this.doRun(options);
        try {
            return await this.pendingRun;
        }
        finally {
            this.pendingRun = undefined;
        }
    }
    async doRun(options) {
        this.context.update({ later: false });
        const dialogSkipped = this.skipDialogOnce;
        this.skipDialogOnce = false;
        let setupStrategy;
        if (dialogSkipped || isProUser(this.chatEntitlementService.entitlement) || this.chatEntitlementService.entitlement === ChatEntitlement.Free) {
            setupStrategy = ChatSetupStrategy.DefaultSetup; // existing pro/free users setup without a dialog
        }
        else {
            setupStrategy = await this.showDialog();
        }
        if (setupStrategy === ChatSetupStrategy.DefaultSetup && ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId) {
            setupStrategy = ChatSetupStrategy.SetupWithEnterpriseProvider; // users with a configured provider go through provider setup
        }
        if (setupStrategy !== ChatSetupStrategy.Canceled && !options?.disableChatViewReveal) {
            // Show the chat view now to better indicate progress
            // while installing the extension or returning from sign in
            showCopilotView(this.viewsService, this.layoutService);
        }
        let success = undefined;
        try {
            switch (setupStrategy) {
                case ChatSetupStrategy.SetupWithEnterpriseProvider:
                    success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: true });
                    break;
                case ChatSetupStrategy.SetupWithoutEnterpriseProvider:
                    success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false });
                    break;
                case ChatSetupStrategy.DefaultSetup:
                    success = await this.controller.value.setup();
                    break;
                case ChatSetupStrategy.SetupWithAccountCreate:
                    this.openerService.open(URI.parse(defaultChat.signUpUrl));
                    return this.doRun(options); // open dialog again
                case ChatSetupStrategy.Canceled:
                    this.context.update({ later: true });
                    this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedMaybeLater', installDuration: 0, signUpErrorCode: undefined });
                    break;
            }
        }
        catch (error) {
            this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
            success = false;
        }
        return { success, dialogSkipped };
    }
    async showDialog() {
        let dialogVariant = this.configurationService.getValue('chat.setup.signInDialogVariant');
        if (this.context.state.entitlement !== ChatEntitlement.Unknown && (dialogVariant === 'input-email' || dialogVariant === 'account-create')) {
            dialogVariant = this.productService.quality !== 'stable' ? 'modern' : 'default'; // fallback to modern/default for users that are signed in already
        }
        if (dialogVariant === 'default') {
            return this.showLegacyDialog();
        }
        const disposables = new DisposableStore();
        const buttons = this.getButtons(dialogVariant);
        let icon;
        switch (dialogVariant) {
            case 'brand-gh':
                icon = Codicon.github;
                break;
            case 'brand-vsc':
                icon = this.productService.quality === 'stable' ? Codicon.vscode : this.productService.quality === 'insider' ? Codicon.vscodeInsiders : Codicon.codeOss;
                break;
            default:
                icon = Codicon.copilotLarge;
                break;
        }
        const dialog = disposables.add(new Dialog(this.layoutService.activeContainer, this.getDialogTitle(dialogVariant), buttons.map(button => button[0]), createWorkbenchDialogOptions({
            type: 'none',
            extraClasses: coalesce([
                'chat-setup-dialog',
                dialogVariant === 'style-glow' ? 'chat-setup-glow' : undefined,
                dialogVariant === 'input-email' ? 'chat-setup-input-email' : undefined
            ]),
            detail: ' ', // workaround allowing us to render the message in large
            icon,
            alignment: DialogContentsAlignment.Vertical,
            cancelId: buttons.length - 1,
            inputs: this.getInputs(dialogVariant),
            disableCloseButton: true,
            renderFooter: this.telemetryService.telemetryLevel !== 0 /* TelemetryLevel.NONE */ ? footer => footer.appendChild(this.createDialogFooter(disposables)) : undefined,
            buttonOptions: buttons.map(button => button[2])
        }, this.keybindingService, this.layoutService)));
        const { button } = await dialog.show();
        disposables.dispose();
        return buttons[button]?.[1] ?? ChatSetupStrategy.Canceled;
    }
    getInputs(variant) {
        if (variant !== 'input-email') {
            return undefined;
        }
        return [{ placeholder: localize('emailOrUserIdPlaceholder', "Enter your email or {0} username", defaultChat.providerName) }];
    }
    getButtons(variant) {
        let buttons;
        if (this.context.state.entitlement === ChatEntitlement.Unknown) {
            const supportAlternateProvider = this.configurationService.getValue('chat.setup.signInWithAlternateProvider') === true && defaultChat.alternativeProviderId;
            switch (variant) {
                case 'input-email':
                    buttons = coalesce([
                        [localize('continueWithEmailOrUserId', "Continue"), ChatSetupStrategy.SetupWithoutEnterpriseProvider, undefined],
                        [localize('createAccount', "Create a New Account"), ChatSetupStrategy.SetupWithAccountCreate, {
                                styleButton: button => {
                                    button.element.classList.add('link-button');
                                    const separator = button.element.parentElement?.appendChild($('.buttons-separator'));
                                    separator?.appendChild($('.buttons-separator-left'));
                                    separator?.appendChild($('.buttons-separator-center', undefined, localize('or', "Or")));
                                    separator?.appendChild($('.buttons-separator-right'));
                                }
                            }],
                        supportAlternateProvider ? [localize('continueWith', "Continue with {0}", defaultChat.alternativeProviderName), ChatSetupStrategy.SetupWithoutEnterpriseProvider, {
                                styleButton: button => {
                                    button.element.classList.add('continue-button', 'alternate');
                                }
                            }] : undefined,
                        [localize('continueWith', "Continue with {0}", defaultChat.enterpriseProviderName), ChatSetupStrategy.SetupWithEnterpriseProvider, {
                                styleButton: button => {
                                    button.element.classList.add('continue-button', 'default');
                                }
                            }]
                    ]);
                    break;
                default:
                    if (ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId) {
                        buttons = coalesce([
                            [localize('continueWith', "Continue with {0}", defaultChat.enterpriseProviderName), ChatSetupStrategy.SetupWithEnterpriseProvider, {
                                    styleButton: button => {
                                        button.element.classList.add('continue-button', 'default');
                                    }
                                }],
                            supportAlternateProvider ? [localize('continueWith', "Continue with {0}", defaultChat.alternativeProviderName), ChatSetupStrategy.SetupWithoutEnterpriseProvider, {
                                    styleButton: button => {
                                        button.element.classList.add('continue-button', 'alternate');
                                    }
                                }] : undefined,
                            [variant !== 'account-create' ? localize('signInWithProvider', "Sign in with a {0} account", defaultChat.providerName) : localize('continueWithProvider', "Continue with {0}", defaultChat.providerName), ChatSetupStrategy.SetupWithoutEnterpriseProvider, {
                                    styleButton: button => {
                                        if (variant !== 'account-create') {
                                            button.element.classList.add('link-button');
                                        }
                                        else {
                                            button.element.classList.add('continue-button', 'default');
                                        }
                                    }
                                }]
                        ]);
                    }
                    else {
                        buttons = coalesce([
                            [localize('continueWith', "Continue with {0}", defaultChat.providerName), ChatSetupStrategy.SetupWithoutEnterpriseProvider, {
                                    styleButton: button => {
                                        button.element.classList.add('continue-button', 'default');
                                    }
                                }],
                            supportAlternateProvider ? [localize('continueWith', "Continue with {0}", defaultChat.alternativeProviderName), ChatSetupStrategy.SetupWithoutEnterpriseProvider, {
                                    styleButton: button => {
                                        button.element.classList.add('continue-button', 'alternate');
                                    }
                                }] : undefined,
                            [variant !== 'account-create' ? localize('signInWithProvider', "Sign in with a {0} account", defaultChat.enterpriseProviderName) : localize('continueWithProvider', "Continue with {0}", defaultChat.enterpriseProviderName), ChatSetupStrategy.SetupWithEnterpriseProvider, {
                                    styleButton: button => {
                                        if (variant !== 'account-create') {
                                            button.element.classList.add('link-button');
                                        }
                                        else {
                                            button.element.classList.add('continue-button', 'default');
                                        }
                                    }
                                }]
                        ]);
                    }
                    if (supportAlternateProvider && variant === 'alt-first') {
                        [buttons[0], buttons[1]] = [buttons[1], buttons[0]];
                    }
                    if (variant === 'account-create') {
                        buttons.push([localize('createAccount', "Create a New Account"), ChatSetupStrategy.SetupWithAccountCreate, {
                                styleButton: button => {
                                    button.element.classList.add('link-button');
                                }
                            }]);
                    }
                    break;
            }
        }
        else {
            buttons = [[localize('setupCopilotButton', "Set up Copilot"), ChatSetupStrategy.DefaultSetup, undefined]];
        }
        buttons.push([localize('skipForNow', "Skip for now"), ChatSetupStrategy.Canceled, { styleButton: button => button.element.classList.add('link-button', 'skip-button') }]);
        return buttons;
    }
    getDialogTitle(variant) {
        if (this.context.state.entitlement === ChatEntitlement.Unknown) {
            switch (variant) {
                case 'brand-gh':
                    return localize('signInGH', "Sign in to use {0} Copilot", defaultChat.providerName);
                case 'brand-vsc':
                    return localize('signInVSC', "Sign in to use AI");
                default:
                    return localize('signIn', "Sign in to use Copilot");
            }
        }
        switch (variant) {
            case 'brand-gh':
                return localize('startUsingGh', "Start using {0} Copilot", defaultChat.providerName);
            case 'brand-vsc':
                return localize('startUsingVSC', "Start using AI");
            default:
                return localize('startUsing', "Start using Copilot");
        }
    }
    createDialogFooter(disposables) {
        const element = $('.chat-setup-dialog-footer');
        const markdown = this.instantiationService.createInstance(MarkdownRenderer, {});
        // SKU Settings
        const settings = localize({ key: 'settings', comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "{0} Copilot Free, Pro and Pro+ may show [public code]({1}) suggestions and we may use your data for product improvement. You can change these [settings]({2}) at any time.", defaultChat.providerName, defaultChat.publicCodeMatchesUrl, defaultChat.manageSettingsUrl);
        element.appendChild($('p', undefined, disposables.add(markdown.render(new MarkdownString(settings, { isTrusted: true }))).element));
        return element;
    }
    async showLegacyDialog() {
        const disposables = new DisposableStore();
        let result = undefined;
        const buttons = [this.getLegacyPrimaryButton(), localize('maybeLater', "Maybe Later")];
        const dialog = disposables.add(new Dialog(this.layoutService.activeContainer, this.getLegacyDialogTitle(), buttons, createWorkbenchDialogOptions({
            type: 'none',
            icon: Codicon.copilotLarge,
            cancelId: buttons.length - 1,
            renderBody: body => body.appendChild(this.createLegacyDialog(disposables)),
            primaryButtonDropdown: {
                contextMenuProvider: this.contextMenuService,
                addPrimaryActionToDropdown: false,
                actions: [
                    toAction({ id: 'setupWithProvider', label: localize('setupWithProvider', "Sign in with a {0} Account", defaultChat.providerName), run: () => result = ChatSetupStrategy.SetupWithoutEnterpriseProvider }),
                    toAction({ id: 'setupWithEnterpriseProvider', label: localize('setupWithEnterpriseProvider', "Sign in with a {0} Account", defaultChat.enterpriseProviderName), run: () => result = ChatSetupStrategy.SetupWithEnterpriseProvider }),
                ]
            }
        }, this.keybindingService, this.layoutService)));
        const { button } = await dialog.show();
        disposables.dispose();
        return button === 0 ? result ?? ChatSetupStrategy.DefaultSetup : ChatSetupStrategy.Canceled;
    }
    getLegacyPrimaryButton() {
        if (this.context.state.entitlement === ChatEntitlement.Unknown) {
            if (ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId) {
                return localize('setupWithProviderShort', "Sign in with {0}", defaultChat.enterpriseProviderName);
            }
            return localize('signInButton', "Sign in");
        }
        return localize('useCopilotButton', "Use Copilot");
    }
    getLegacyDialogTitle() {
        if (this.context.state.entitlement === ChatEntitlement.Unknown) {
            return this.context.state.registered ? localize('signUp', "Sign in to use Copilot") : localize('signUpFree', "Sign in to use Copilot for free");
        }
        if (isProUser(this.context.state.entitlement)) {
            return localize('copilotProTitle', "Start using Copilot Pro");
        }
        return this.context.state.registered ? localize('copilotTitle', "Start using Copilot") : localize('copilotFreeTitle', "Start using Copilot for free");
    }
    createLegacyDialog(disposables) {
        const element = $('.chat-setup-dialog-legacy');
        const markdown = this.instantiationService.createInstance(MarkdownRenderer, {});
        // Header
        const header = localize({ key: 'headerDialog', comment: ['{Locked="[Copilot]({0})"}'] }, "[Copilot]({0}) is your AI pair programmer. Write code faster with completions, fix bugs and build new features across multiple files, and learn about your codebase through chat.", defaultChat.documentationUrl);
        element.appendChild($('p.setup-header', undefined, disposables.add(markdown.render(new MarkdownString(header, { isTrusted: true }))).element));
        // SKU Settings
        if (this.telemetryService.telemetryLevel !== 0 /* TelemetryLevel.NONE */) {
            const settings = localize({ key: 'settings', comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "{0} Copilot Free, Pro and Pro+ may show [public code]({1}) suggestions and we may use your data for product improvement. You can change these [settings]({2}) at any time.", defaultChat.providerName, defaultChat.publicCodeMatchesUrl, defaultChat.manageSettingsUrl);
            element.appendChild($('p.setup-settings', undefined, disposables.add(markdown.render(new MarkdownString(settings, { isTrusted: true }))).element));
        }
        return element;
    }
};
ChatSetup = ChatSetup_1 = __decorate([
    __param(2, IInstantiationService),
    __param(3, ITelemetryService),
    __param(4, ILayoutService),
    __param(5, IKeybindingService),
    __param(6, IChatEntitlementService),
    __param(7, ILogService),
    __param(8, IConfigurationService),
    __param(9, IViewsService),
    __param(10, IProductService),
    __param(11, IOpenerService),
    __param(12, IContextMenuService)
], ChatSetup);
let ChatSetupContribution = class ChatSetupContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatSetup'; }
    constructor(productService, instantiationService, commandService, telemetryService, chatEntitlementService, logService) {
        super();
        this.productService = productService;
        this.instantiationService = instantiationService;
        this.commandService = commandService;
        this.telemetryService = telemetryService;
        this.logService = logService;
        const context = chatEntitlementService.context?.value;
        const requests = chatEntitlementService.requests?.value;
        if (!context || !requests) {
            return; // disabled
        }
        const controller = new Lazy(() => this._register(this.instantiationService.createInstance(ChatSetupController, context, requests)));
        this.registerSetupAgents(context, controller);
        this.registerActions(context, requests, controller);
        this.registerUrlLinkHandler();
    }
    registerSetupAgents(context, controller) {
        const defaultAgentDisposables = markAsSingleton(new MutableDisposable()); // prevents flicker on window reload
        const vscodeAgentDisposables = markAsSingleton(new MutableDisposable());
        const updateRegistration = () => {
            if (!context.state.hidden && !context.state.disabled) {
                // Default Agents (always, even if installed to allow for speedy requests right on startup)
                if (!defaultAgentDisposables.value) {
                    const disposables = defaultAgentDisposables.value = new DisposableStore();
                    // Panel Agents
                    const panelAgentDisposables = disposables.add(new DisposableStore());
                    for (const mode of [ChatMode.Ask, ChatMode.Edit, ChatMode.Agent]) {
                        const { agent, disposable } = SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Panel, mode, context, controller);
                        panelAgentDisposables.add(disposable);
                        panelAgentDisposables.add(agent.onUnresolvableError(() => {
                            // An unresolvable error from our agent registrations means that
                            // Copilot is unhealthy for some reason. We clear our panel
                            // registration to give Copilot a chance to show a custom message
                            // to the user from the views and stop pretending as if there was
                            // a functional agent.
                            this.logService.error('[chat setup] Unresolvable error from Copilot agent registration, clearing registration.');
                            panelAgentDisposables.dispose();
                        }));
                    }
                    // Inline Agents
                    disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Terminal, undefined, context, controller).disposable);
                    disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Notebook, undefined, context, controller).disposable);
                    disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Editor, undefined, context, controller).disposable);
                }
                // VSCode Agent + Tool (unless installed and enabled)
                if (!(context.state.installed && !context.state.disabled) && !vscodeAgentDisposables.value) {
                    const disposables = vscodeAgentDisposables.value = new DisposableStore();
                    disposables.add(SetupAgent.registerVSCodeAgent(this.instantiationService, context, controller).disposable);
                }
            }
            else {
                defaultAgentDisposables.clear();
                vscodeAgentDisposables.clear();
            }
            if (context.state.installed && !context.state.disabled) {
                vscodeAgentDisposables.clear(); // we need to do this to prevent showing duplicate agent/tool entries in the list
            }
        };
        this._register(Event.runAndSubscribe(context.onDidChange, () => updateRegistration()));
    }
    registerActions(context, requests, controller) {
        const chatSetupTriggerContext = ContextKeyExpr.or(ChatContextKeys.Setup.installed.negate(), ChatContextKeys.Entitlement.canSignUp);
        const CHAT_SETUP_ACTION_LABEL = localize2('triggerChatSetup', "Use AI Features with Copilot for free...");
        class ChatSetupTriggerAction extends Action2 {
            constructor() {
                super({
                    id: CHAT_SETUP_ACTION_ID,
                    title: CHAT_SETUP_ACTION_LABEL,
                    category: CHAT_CATEGORY,
                    f1: true,
                    precondition: chatSetupTriggerContext
                });
            }
            async run(accessor, mode) {
                const viewsService = accessor.get(IViewsService);
                const layoutService = accessor.get(IWorkbenchLayoutService);
                const instantiationService = accessor.get(IInstantiationService);
                const dialogService = accessor.get(IDialogService);
                const commandService = accessor.get(ICommandService);
                const lifecycleService = accessor.get(ILifecycleService);
                await context.update({ hidden: false });
                if (mode) {
                    const chatWidget = await showCopilotView(viewsService, layoutService);
                    chatWidget?.input.setChatMode(mode);
                }
                const setup = ChatSetup.getInstance(instantiationService, context, controller);
                const { success } = await setup.run();
                if (success === false && !lifecycleService.willShutdown) {
                    const { confirmed } = await dialogService.confirm({
                        type: Severity.Error,
                        message: localize('setupErrorDialog', "Copilot setup failed. Would you like to try again?"),
                        primaryButton: localize('retry', "Retry"),
                    });
                    if (confirmed) {
                        return Boolean(await commandService.executeCommand(CHAT_SETUP_ACTION_ID));
                    }
                }
                return Boolean(success);
            }
        }
        class ChatSetupTriggerWithoutDialogAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.triggerSetupWithoutDialog',
                    title: CHAT_SETUP_ACTION_LABEL,
                    precondition: chatSetupTriggerContext
                });
            }
            async run(accessor) {
                const viewsService = accessor.get(IViewsService);
                const layoutService = accessor.get(IWorkbenchLayoutService);
                const instantiationService = accessor.get(IInstantiationService);
                await context.update({ hidden: false });
                const chatWidget = await showCopilotView(viewsService, layoutService);
                ChatSetup.getInstance(instantiationService, context, controller).skipDialog();
                chatWidget?.acceptInput(localize('setupCopilot', "Set up Copilot."));
            }
        }
        class ChatSetupFromAccountsAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.triggerSetupFromAccounts',
                    title: localize2('triggerChatSetupFromAccounts', "Sign in to use Copilot..."),
                    menu: {
                        id: MenuId.AccountsContext,
                        group: '2_copilot',
                        when: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.installed.negate(), ChatContextKeys.Entitlement.signedOut)
                    }
                });
            }
            async run(accessor) {
                const commandService = accessor.get(ICommandService);
                const telemetryService = accessor.get(ITelemetryService);
                telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'accounts' });
                return commandService.executeCommand(CHAT_SETUP_ACTION_ID);
            }
        }
        class ChatSetupHideAction extends Action2 {
            static { this.ID = 'workbench.action.chat.hideSetup'; }
            static { this.TITLE = localize2('hideChatSetup', "Hide Copilot"); }
            constructor() {
                super({
                    id: ChatSetupHideAction.ID,
                    title: ChatSetupHideAction.TITLE,
                    f1: true,
                    category: CHAT_CATEGORY,
                    precondition: ContextKeyExpr.and(ChatContextKeys.Setup.installed.negate(), ChatContextKeys.Setup.hidden.negate()),
                    menu: {
                        id: MenuId.ChatTitleBarMenu,
                        group: 'z_hide',
                        order: 1,
                        when: ChatContextKeys.Setup.installed.negate()
                    }
                });
            }
            async run(accessor) {
                const viewsDescriptorService = accessor.get(IViewDescriptorService);
                const layoutService = accessor.get(IWorkbenchLayoutService);
                const dialogService = accessor.get(IDialogService);
                const { confirmed } = await dialogService.confirm({
                    message: localize('hideChatSetupConfirm', "Are you sure you want to hide Copilot?"),
                    detail: localize('hideChatSetupDetail', "You can restore Copilot by running the '{0}' command.", CHAT_SETUP_ACTION_LABEL.value),
                    primaryButton: localize('hideChatSetupButton', "Hide Copilot")
                });
                if (!confirmed) {
                    return;
                }
                const location = viewsDescriptorService.getViewLocationById(ChatViewId);
                await context.update({ hidden: true });
                if (location === 2 /* ViewContainerLocation.AuxiliaryBar */) {
                    const activeContainers = viewsDescriptorService.getViewContainersByLocation(location).filter(container => viewsDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);
                    if (activeContainers.length === 0) {
                        layoutService.setPartHidden(true, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */); // hide if there are no views in the secondary sidebar
                    }
                }
            }
        }
        const windowFocusListener = this._register(new MutableDisposable());
        class UpgradePlanAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.upgradePlan',
                    title: localize2('managePlan', "Upgrade to Copilot Pro"),
                    category: localize2('chat.category', 'Chat'),
                    f1: true,
                    precondition: ContextKeyExpr.or(ChatContextKeys.Entitlement.canSignUp, ChatContextKeys.Entitlement.free),
                    menu: {
                        id: MenuId.ChatTitleBarMenu,
                        group: 'a_first',
                        order: 1,
                        when: ContextKeyExpr.and(ChatContextKeys.Entitlement.free, ContextKeyExpr.or(ChatContextKeys.chatQuotaExceeded, ChatContextKeys.completionsQuotaExceeded))
                    }
                });
            }
            async run(accessor, from) {
                const openerService = accessor.get(IOpenerService);
                const hostService = accessor.get(IHostService);
                const commandService = accessor.get(ICommandService);
                openerService.open(URI.parse(defaultChat.upgradePlanUrl));
                const entitlement = context.state.entitlement;
                if (!isProUser(entitlement)) {
                    // If the user is not yet Pro, we listen to window focus to refresh the token
                    // when the user has come back to the window assuming the user signed up.
                    windowFocusListener.value = hostService.onDidChangeFocus(focus => this.onWindowFocus(focus, commandService));
                }
            }
            async onWindowFocus(focus, commandService) {
                if (focus) {
                    windowFocusListener.clear();
                    const entitlements = await requests.forceResolveEntitlement(undefined);
                    if (entitlements?.entitlement && isProUser(entitlements?.entitlement)) {
                        refreshTokens(commandService);
                    }
                }
            }
        }
        class EnableOveragesAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.manageOverages',
                    title: localize2('manageOverages', "Manage Copilot Overages"),
                    category: localize2('chat.category', 'Chat'),
                    f1: true,
                    precondition: ContextKeyExpr.or(ChatContextKeys.Entitlement.pro, ChatContextKeys.Entitlement.proPlus),
                    menu: {
                        id: MenuId.ChatTitleBarMenu,
                        group: 'a_first',
                        order: 1,
                        when: ContextKeyExpr.and(ContextKeyExpr.or(ChatContextKeys.Entitlement.pro, ChatContextKeys.Entitlement.proPlus), ContextKeyExpr.or(ChatContextKeys.chatQuotaExceeded, ChatContextKeys.completionsQuotaExceeded))
                    }
                });
            }
            async run(accessor, from) {
                const openerService = accessor.get(IOpenerService);
                openerService.open(URI.parse(defaultChat.manageOveragesUrl));
            }
        }
        registerAction2(ChatSetupTriggerAction);
        registerAction2(ChatSetupFromAccountsAction);
        registerAction2(ChatSetupTriggerWithoutDialogAction);
        registerAction2(ChatSetupHideAction);
        registerAction2(UpgradePlanAction);
        registerAction2(EnableOveragesAction);
    }
    registerUrlLinkHandler() {
        this._register(ExtensionUrlHandlerOverrideRegistry.registerHandler({
            canHandleURL: url => {
                return url.scheme === this.productService.urlProtocol && equalsIgnoreCase(url.authority, defaultChat.chatExtensionId);
            },
            handleURL: async (url) => {
                const params = new URLSearchParams(url.query);
                this.telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'url', detail: params.get('referrer') ?? undefined });
                await this.commandService.executeCommand(CHAT_SETUP_ACTION_ID, validateChatMode(params.get('mode')));
                return true;
            }
        }));
    }
};
ChatSetupContribution = __decorate([
    __param(0, IProductService),
    __param(1, IInstantiationService),
    __param(2, ICommandService),
    __param(3, ITelemetryService),
    __param(4, IChatEntitlementService),
    __param(5, ILogService)
], ChatSetupContribution);
export { ChatSetupContribution };
var ChatSetupStep;
(function (ChatSetupStep) {
    ChatSetupStep[ChatSetupStep["Initial"] = 1] = "Initial";
    ChatSetupStep[ChatSetupStep["SigningIn"] = 2] = "SigningIn";
    ChatSetupStep[ChatSetupStep["Installing"] = 3] = "Installing";
})(ChatSetupStep || (ChatSetupStep = {}));
let ChatSetupController = class ChatSetupController extends Disposable {
    get step() { return this._step; }
    constructor(context, requests, telemetryService, authenticationService, extensionsWorkbenchService, productService, logService, progressService, activityService, commandService, workspaceTrustRequestService, dialogService, configurationService, lifecycleService, quickInputService) {
        super();
        this.context = context;
        this.requests = requests;
        this.telemetryService = telemetryService;
        this.authenticationService = authenticationService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.productService = productService;
        this.logService = logService;
        this.progressService = progressService;
        this.activityService = activityService;
        this.commandService = commandService;
        this.workspaceTrustRequestService = workspaceTrustRequestService;
        this.dialogService = dialogService;
        this.configurationService = configurationService;
        this.lifecycleService = lifecycleService;
        this.quickInputService = quickInputService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._step = ChatSetupStep.Initial;
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.context.onDidChange(() => this._onDidChange.fire()));
    }
    setStep(step) {
        if (this._step === step) {
            return;
        }
        this._step = step;
        this._onDidChange.fire();
    }
    async setup(options) {
        const watch = new StopWatch(false);
        const title = localize('setupChatProgress', "Getting Copilot ready...");
        const badge = this.activityService.showViewContainerActivity(CHAT_SIDEBAR_PANEL_ID, {
            badge: new ProgressBadge(() => title),
        });
        try {
            return await this.progressService.withProgress({
                location: 10 /* ProgressLocation.Window */,
                command: CHAT_OPEN_ACTION_ID,
                title,
            }, () => this.doSetup(options ?? {}, watch));
        }
        finally {
            badge.dispose();
        }
    }
    async doSetup(options, watch) {
        this.context.suspend(); // reduces flicker
        let success = false;
        try {
            const providerId = ChatEntitlementRequests.providerId(this.configurationService);
            let session;
            let entitlement;
            // Entitlement Unknown or `forceSignIn`: we need to sign-in user
            if (this.context.state.entitlement === ChatEntitlement.Unknown || options.forceSignIn) {
                this.setStep(ChatSetupStep.SigningIn);
                const result = await this.signIn(providerId);
                if (!result.session) {
                    this.doInstall(); // still install the extension in the background to remind the user to sign-in eventually
                    this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedNotSignedIn', installDuration: watch.elapsed(), signUpErrorCode: undefined });
                    return undefined; // treat as cancelled because signing in already triggers an error dialog
                }
                session = result.session;
                entitlement = result.entitlement;
            }
            const trusted = await this.workspaceTrustRequestService.requestWorkspaceTrust({
                message: localize('copilotWorkspaceTrust', "Copilot is currently only supported in trusted workspaces.")
            });
            if (!trusted) {
                this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedNotTrusted', installDuration: watch.elapsed(), signUpErrorCode: undefined });
                return false;
            }
            // Install
            this.setStep(ChatSetupStep.Installing);
            success = await this.install(session, entitlement ?? this.context.state.entitlement, providerId, watch);
        }
        finally {
            this.setStep(ChatSetupStep.Initial);
            this.context.resume();
        }
        return success;
    }
    async signIn(providerId) {
        let session;
        let entitlements;
        try {
            ({ session, entitlements } = await this.requests.signIn());
        }
        catch (e) {
            this.logService.error(`[chat setup] signIn: error ${e}`);
        }
        if (!session && !this.lifecycleService.willShutdown) {
            const { confirmed } = await this.dialogService.confirm({
                type: Severity.Error,
                message: localize('unknownSignInError', "Failed to sign in to {0}. Would you like to try again?", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId ? defaultChat.enterpriseProviderName : defaultChat.providerName),
                detail: localize('unknownSignInErrorDetail', "You must be signed in to use Copilot."),
                primaryButton: localize('retry', "Retry")
            });
            if (confirmed) {
                return this.signIn(providerId);
            }
        }
        return { session, entitlement: entitlements?.entitlement };
    }
    async install(session, entitlement, providerId, watch) {
        const wasRunning = this.context.state.installed && !this.context.state.disabled;
        let signUpResult = undefined;
        try {
            if (entitlement !== ChatEntitlement.Free && // User is not signed up to Copilot Free
                !isProUser(entitlement) && // User is not signed up for a Copilot subscription
                entitlement !== ChatEntitlement.Unavailable // User is eligible for Copilot Free
            ) {
                if (!session) {
                    try {
                        session = (await this.authenticationService.getSessions(providerId)).at(0);
                    }
                    catch (error) {
                        // ignore - errors can throw if a provider is not registered
                    }
                    if (!session) {
                        this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedNoSession', installDuration: watch.elapsed(), signUpErrorCode: undefined });
                        return false; // unexpected
                    }
                }
                signUpResult = await this.requests.signUpFree(session);
                if (typeof signUpResult !== 'boolean' /* error */) {
                    this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedSignUp', installDuration: watch.elapsed(), signUpErrorCode: signUpResult.errorCode });
                }
            }
            await this.doInstallWithRetry();
        }
        catch (error) {
            this.logService.error(`[chat setup] install: error ${error}`);
            this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: isCancellationError(error) ? 'cancelled' : 'failedInstall', installDuration: watch.elapsed(), signUpErrorCode: undefined });
            return false;
        }
        if (typeof signUpResult === 'boolean') {
            this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: wasRunning && !signUpResult ? 'alreadyInstalled' : 'installed', installDuration: watch.elapsed(), signUpErrorCode: undefined });
        }
        if (wasRunning && signUpResult === true) {
            refreshTokens(this.commandService);
        }
        return true;
    }
    async doInstallWithRetry() {
        let error;
        try {
            await this.doInstall();
        }
        catch (e) {
            this.logService.error(`[chat setup] install: error ${error}`);
            error = e;
        }
        if (error) {
            if (!this.lifecycleService.willShutdown) {
                const { confirmed } = await this.dialogService.confirm({
                    type: Severity.Error,
                    message: localize('unknownSetupError', "An error occurred while setting up Copilot. Would you like to try again?"),
                    detail: error && !isCancellationError(error) ? toErrorMessage(error) : undefined,
                    primaryButton: localize('retry', "Retry")
                });
                if (confirmed) {
                    return this.doInstallWithRetry();
                }
            }
            throw error;
        }
    }
    async doInstall() {
        await this.extensionsWorkbenchService.install(defaultChat.extensionId, {
            enable: true,
            isApplicationScoped: true, // install into all profiles
            isMachineScoped: false, // do not ask to sync
            installEverywhere: true, // install in local and remote
            installPreReleaseVersion: this.productService.quality !== 'stable'
        }, ChatViewId);
    }
    async setupWithProvider(options) {
        const registry = Registry.as(ConfigurationExtensions.Configuration);
        registry.registerConfiguration({
            'id': 'copilot.setup',
            'type': 'object',
            'properties': {
                [defaultChat.completionsAdvancedSetting]: {
                    'type': 'object',
                    'properties': {
                        'authProvider': {
                            'type': 'string'
                        }
                    }
                },
                [defaultChat.providerUriSetting]: {
                    'type': 'string'
                }
            }
        });
        if (options.useEnterpriseProvider) {
            const success = await this.handleEnterpriseInstance();
            if (!success) {
                return success; // not properly configured, abort
            }
        }
        let existingAdvancedSetting = this.configurationService.inspect(defaultChat.completionsAdvancedSetting).user?.value;
        if (!isObject(existingAdvancedSetting)) {
            existingAdvancedSetting = {};
        }
        if (options.useEnterpriseProvider) {
            await this.configurationService.updateValue(`${defaultChat.completionsAdvancedSetting}`, {
                ...existingAdvancedSetting,
                'authProvider': defaultChat.enterpriseProviderId
            }, 2 /* ConfigurationTarget.USER */);
        }
        else {
            await this.configurationService.updateValue(`${defaultChat.completionsAdvancedSetting}`, Object.keys(existingAdvancedSetting).length > 0 ? {
                ...existingAdvancedSetting,
                'authProvider': undefined
            } : undefined, 2 /* ConfigurationTarget.USER */);
        }
        return this.setup({ ...options, forceSignIn: true });
    }
    async handleEnterpriseInstance() {
        const domainRegEx = /^[a-zA-Z\-_]+$/;
        const fullUriRegEx = /^(https:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.ghe\.com\/?$/;
        const uri = this.configurationService.getValue(defaultChat.providerUriSetting);
        if (typeof uri === 'string' && fullUriRegEx.test(uri)) {
            return true; // already setup with a valid URI
        }
        let isSingleWord = false;
        const result = await this.quickInputService.input({
            prompt: localize('enterpriseInstance', "What is your {0} instance?", defaultChat.enterpriseProviderName),
            placeHolder: localize('enterpriseInstancePlaceholder', 'i.e. "octocat" or "https://octocat.ghe.com"...'),
            ignoreFocusLost: true,
            value: uri,
            validateInput: async (value) => {
                isSingleWord = false;
                if (!value) {
                    return undefined;
                }
                if (domainRegEx.test(value)) {
                    isSingleWord = true;
                    return {
                        content: localize('willResolveTo', "Will resolve to {0}", `https://${value}.ghe.com`),
                        severity: Severity.Info
                    };
                }
                if (!fullUriRegEx.test(value)) {
                    return {
                        content: localize('invalidEnterpriseInstance', 'You must enter a valid {0} instance (i.e. "octocat" or "https://octocat.ghe.com")', defaultChat.enterpriseProviderName),
                        severity: Severity.Error
                    };
                }
                return undefined;
            }
        });
        if (!result) {
            return undefined; // canceled
        }
        let resolvedUri = result;
        if (isSingleWord) {
            resolvedUri = `https://${resolvedUri}.ghe.com`;
        }
        else {
            const normalizedUri = result.toLowerCase();
            const hasHttps = normalizedUri.startsWith('https://');
            if (!hasHttps) {
                resolvedUri = `https://${result}`;
            }
        }
        await this.configurationService.updateValue(defaultChat.providerUriSetting, resolvedUri, 2 /* ConfigurationTarget.USER */);
        return true;
    }
};
ChatSetupController = __decorate([
    __param(2, ITelemetryService),
    __param(3, IAuthenticationService),
    __param(4, IExtensionsWorkbenchService),
    __param(5, IProductService),
    __param(6, ILogService),
    __param(7, IProgressService),
    __param(8, IActivityService),
    __param(9, ICommandService),
    __param(10, IWorkspaceTrustRequestService),
    __param(11, IDialogService),
    __param(12, IConfigurationService),
    __param(13, ILifecycleService),
    __param(14, IQuickInputService)
], ChatSetupController);
//#endregion
function refreshTokens(commandService) {
    // ugly, but we need to signal to the extension that entitlements changed
    commandService.executeCommand(defaultChat.completionsRefreshTokenCommand);
    commandService.executeCommand(defaultChat.chatRefreshTokenCommand);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNldHVwLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNldHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLHVCQUF1QixDQUFDO0FBQy9CLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNwRCxPQUFPLEVBQUUsTUFBTSxFQUFFLHVCQUF1QixFQUF1QixNQUFNLDhDQUE4QyxDQUFDO0FBQ3BILE9BQU8sRUFBRSxRQUFRLEVBQXVFLE1BQU0sb0NBQW9DLENBQUM7QUFDbkksT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTNELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BJLE9BQU8sUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NB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