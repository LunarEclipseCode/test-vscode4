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
var InstallCountWidget_1;
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import * as platform from '../../../../base/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { verifiedPublisherIcon } from '../../../services/extensionManagement/common/extensionsIcons.js';
import { installCountIcon, starEmptyIcon, starFullIcon, starHalfIcon } from '../../extensions/browser/extensionsIcons.js';
import { mcpServerIcon } from '../common/mcpTypes.js';
export class McpServerWidget extends Disposable {
    constructor() {
        super(...arguments);
        this._mcpServer = null;
    }
    get mcpServer() { return this._mcpServer; }
    set mcpServer(mcpServer) { this._mcpServer = mcpServer; this.update(); }
    update() { this.render(); }
}
export function onClick(element, callback) {
    const disposables = new DisposableStore();
    disposables.add(dom.addDisposableListener(element, dom.EventType.CLICK, dom.finalHandler(callback)));
    disposables.add(dom.addDisposableListener(element, dom.EventType.KEY_UP, e => {
        const keyboardEvent = new StandardKeyboardEvent(e);
        if (keyboardEvent.equals(10 /* KeyCode.Space */) || keyboardEvent.equals(3 /* KeyCode.Enter */)) {
            e.preventDefault();
            e.stopPropagation();
            callback();
        }
    }));
    return disposables;
}
export class McpServerIconWidget extends McpServerWidget {
    constructor(container) {
        super();
        this.disposables = this._register(new DisposableStore());
        this.element = dom.append(container, dom.$('.extension-icon'));
        this.iconElement = dom.append(this.element, dom.$('img.icon', { alt: '' }));
        this.iconElement.style.display = 'none';
        this.defaultIconElement = dom.append(this.element, dom.$(ThemeIcon.asCSSSelector(mcpServerIcon)));
        this.defaultIconElement.style.display = 'none';
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.iconUrl = undefined;
        this.iconElement.src = '';
        this.iconElement.style.display = 'none';
        this.defaultIconElement.style.display = 'none';
        this.disposables.clear();
    }
    render() {
        if (!this.mcpServer) {
            this.clear();
            return;
        }
        if (this.mcpServer.iconUrl) {
            this.iconElement.style.display = 'inherit';
            this.defaultIconElement.style.display = 'none';
            if (this.iconUrl !== this.mcpServer.iconUrl) {
                this.iconUrl = this.mcpServer.iconUrl;
                this.disposables.add(dom.addDisposableListener(this.iconElement, 'error', () => {
                    this.iconElement.style.display = 'none';
                    this.defaultIconElement.style.display = 'inherit';
                }, { once: true }));
                this.iconElement.src = this.iconUrl;
                if (!this.iconElement.complete) {
                    this.iconElement.style.visibility = 'hidden';
                    this.iconElement.onload = () => this.iconElement.style.visibility = 'inherit';
                }
                else {
                    this.iconElement.style.visibility = 'inherit';
                }
            }
        }
        else {
            this.iconUrl = undefined;
            this.iconElement.style.display = 'none';
            this.iconElement.src = '';
            this.defaultIconElement.style.display = 'inherit';
        }
    }
}
let PublisherWidget = class PublisherWidget extends McpServerWidget {
    constructor(container, small, hoverService, openerService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.openerService = openerService;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.element?.remove();
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.mcpServer?.publisherDisplayName) {
            return;
        }
        this.element = dom.append(this.container, dom.$('.publisher'));
        const publisherDisplayName = dom.$('.publisher-name.ellipsis');
        publisherDisplayName.textContent = this.mcpServer.publisherDisplayName;
        const verifiedPublisher = dom.$('.verified-publisher');
        dom.append(verifiedPublisher, dom.$('span.extension-verified-publisher.clickable'), renderIcon(verifiedPublisherIcon));
        if (this.small) {
            if (this.mcpServer.gallery?.publisherDomain?.verified) {
                dom.append(this.element, verifiedPublisher);
            }
            dom.append(this.element, publisherDisplayName);
        }
        else {
            this.element.setAttribute('role', 'button');
            this.element.tabIndex = 0;
            this.containerHover = this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, localize('publisher', "Publisher ({0})", this.mcpServer.publisherDisplayName)));
            dom.append(this.element, publisherDisplayName);
            if (this.mcpServer.gallery?.publisherDomain?.verified) {
                dom.append(this.element, verifiedPublisher);
                const publisherDomainLink = URI.parse(this.mcpServer.gallery?.publisherDomain.link);
                verifiedPublisher.tabIndex = 0;
                verifiedPublisher.setAttribute('role', 'button');
                this.containerHover.update(localize('verified publisher', "This publisher has verified ownership of {0}", this.mcpServer.gallery?.publisherDomain.link));
                verifiedPublisher.setAttribute('role', 'link');
                dom.append(verifiedPublisher, dom.$('span.extension-verified-publisher-domain', undefined, publisherDomainLink.authority.startsWith('www.') ? publisherDomainLink.authority.substring(4) : publisherDomainLink.authority));
                this.disposables.add(onClick(verifiedPublisher, () => this.openerService.open(publisherDomainLink)));
            }
        }
    }
};
PublisherWidget = __decorate([
    __param(2, IHoverService),
    __param(3, IOpenerService)
], PublisherWidget);
export { PublisherWidget };
let InstallCountWidget = InstallCountWidget_1 = class InstallCountWidget extends McpServerWidget {
    constructor(container, small, hoverService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.container.innerText = '';
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.mcpServer?.installCount) {
            return;
        }
        const installLabel = InstallCountWidget_1.getInstallLabel(this.mcpServer, this.small);
        if (!installLabel) {
            return;
        }
        const parent = this.small ? this.container : dom.append(this.container, dom.$('span.install', { tabIndex: 0 }));
        dom.append(parent, dom.$('span' + ThemeIcon.asCSSSelector(installCountIcon)));
        const count = dom.append(parent, dom.$('span.count'));
        count.textContent = installLabel;
        if (!this.small) {
            this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.container, localize('install count', "Install count")));
        }
    }
    static getInstallLabel(extension, small) {
        const installCount = extension.installCount;
        if (!installCount) {
            return undefined;
        }
        let installLabel;
        if (small) {
            if (installCount > 1000000) {
                installLabel = `${Math.floor(installCount / 100000) / 10}M`;
            }
            else if (installCount > 1000) {
                installLabel = `${Math.floor(installCount / 1000)}K`;
            }
            else {
                installLabel = String(installCount);
            }
        }
        else {
            installLabel = installCount.toLocaleString(platform.language);
        }
        return installLabel;
    }
};
InstallCountWidget = InstallCountWidget_1 = __decorate([
    __param(2, IHoverService)
], InstallCountWidget);
export { InstallCountWidget };
let RatingsWidget = class RatingsWidget extends McpServerWidget {
    constructor(container, small, hoverService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.disposables = this._register(new DisposableStore());
        container.classList.add('extension-ratings');
        if (this.small) {
            container.classList.add('small');
        }
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.container.innerText = '';
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.mcpServer) {
            return;
        }
        if (this.mcpServer.rating === undefined) {
            return;
        }
        if (this.small && !this.mcpServer.ratingCount) {
            return;
        }
        if (!this.mcpServer.url) {
            return;
        }
        const rating = Math.round(this.mcpServer.rating * 2) / 2;
        if (this.small) {
            dom.append(this.container, dom.$('span' + ThemeIcon.asCSSSelector(starFullIcon)));
            const count = dom.append(this.container, dom.$('span.count'));
            count.textContent = String(rating);
        }
        else {
            const element = dom.append(this.container, dom.$('span.rating.clickable', { tabIndex: 0 }));
            for (let i = 1; i <= 5; i++) {
                if (rating >= i) {
                    dom.append(element, dom.$('span' + ThemeIcon.asCSSSelector(starFullIcon)));
                }
                else if (rating >= i - 0.5) {
                    dom.append(element, dom.$('span' + ThemeIcon.asCSSSelector(starHalfIcon)));
                }
                else {
                    dom.append(element, dom.$('span' + ThemeIcon.asCSSSelector(starEmptyIcon)));
                }
            }
            if (this.mcpServer.ratingCount) {
                const ratingCountElement = dom.append(element, dom.$('span', undefined, ` (${this.mcpServer.ratingCount})`));
                ratingCountElement.style.paddingLeft = '1px';
            }
            this.containerHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element, ''));
            this.containerHover.update(localize('ratedLabel', "Average rating: {0} out of 5", rating));
            element.setAttribute('role', 'link');
        }
    }
};
RatingsWidget = __decorate([
    __param(2, IHoverService)
], RatingsWidget);
export { RatingsWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyV2lkZ2V0cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwU2VydmVyV2lkZ2V0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUVsRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFFakYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDOUcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzFILE9BQU8sRUFBNEMsYUFBYSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFaEcsTUFBTSxPQUFnQixlQUFnQixTQUFRLFVBQVU7SUFBeEQ7O1FBQ1Ms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