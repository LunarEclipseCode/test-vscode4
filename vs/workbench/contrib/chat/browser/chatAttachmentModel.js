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
import { URI } from '../../../../base/common/uri.js';
import { Emitter } from '../../../../base/common/event.js';
import { basename } from '../../../../base/common/resources.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ChatPromptAttachmentsCollection } from './chatAttachmentModel/chatPromptAttachmentsCollection.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ISharedWebContentExtractorService } from '../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { Schemas } from '../../../../base/common/network.js';
import { resolveImageEditorAttachContext } from './chatAttachmentResolve.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { equals } from '../../../../base/common/objects.js';
import { Iterable } from '../../../../base/common/iterator.js';
let ChatAttachmentModel = class ChatAttachmentModel extends Disposable {
    constructor(instaService, fileService, dialogService, webContentExtractorService) {
        super();
        this.fileService = fileService;
        this.dialogService = dialogService;
        this.webContentExtractorService = webContentExtractorService;
        this._attachments = new Map();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.promptInstructions = this._register(instaService.createInstance(ChatPromptAttachmentsCollection));
    }
    get attachments() {
        return Array.from(this._attachments.values());
    }
    get size() {
        return this._attachments.size;
    }
    get fileAttachments() {
        return this.attachments.filter(file => file.kind === 'file' && URI.isUri(file.value))
            .map(file => file.value);
    }
    getAttachmentIDs() {
        return new Set(this._attachments.keys());
    }
    async addFile(uri, range) {
        if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(uri.path)) {
            const context = await this.asImageVariableEntry(uri);
            if (context) {
                this.addContext(context);
            }
            return;
        }
        else {
            this.addContext(this.asFileVariableEntry(uri, range));
        }
    }
    addFolder(uri) {
        this.addContext({
            kind: 'directory',
            value: uri,
            id: uri.toString(),
            name: basename(uri),
        });
    }
    clear(clearStickyAttachments = false) {
        const deleted = Array.from(this._attachments.keys());
        this._attachments.clear();
        if (clearStickyAttachments) {
            this.promptInstructions.clear();
        }
        this._onDidChange.fire({ deleted, added: [], updated: [] });
    }
    addContext(...attachments) {
        attachments = attachments.filter(attachment => !this._attachments.has(attachment.id));
        this.updateContext(Iterable.empty(), attachments);
    }
    clearAndSetContext(...attachments) {
        this.updateContext(Array.from(this._attachments.keys()), attachments);
    }
    delete(...variableEntryIds) {
        this.updateContext(variableEntryIds, Iterable.empty());
    }
    updateContext(toDelete, upsert) {
        const deleted = [];
        const added = [];
        const updated = [];
        for (const id of toDelete) {
            if (this._attachments.delete(id)) {
                deleted.push(id);
            }
        }
        for (const item of upsert) {
            if (item.kind === 'promptFile') {
                // TODO@jrieken @aeschli @legomushroom Let's make instructions normal
                // attachment types so that this isn't needed
                this.promptInstructions.add(item.value);
                continue;
            }
            const oldItem = this._attachments.get(item.id);
            if (!oldItem) {
                this._attachments.set(item.id, item);
                added.push(item);
            }
            else if (!equals(oldItem, item)) {
                this._attachments.set(item.id, item);
                updated.push(item);
            }
        }
        if (deleted.length > 0 || added.length > 0 || updated.length > 0) {
            this._onDidChange.fire({ deleted, added, updated });
        }
    }
    // ---- create utils
    asFileVariableEntry(uri, range) {
        return {
            kind: 'file',
            value: range ? { uri, range } : uri,
            id: uri.toString() + (range?.toString() ?? ''),
            name: basename(uri),
        };
    }
    // Gets an image variable for a given URI, which may be a file or a web URL
    async asImageVariableEntry(uri) {
        if (uri.scheme === Schemas.file && await this.fileService.canHandleResource(uri)) {
            return await resolveImageEditorAttachContext(this.fileService, this.dialogService, uri);
        }
        else if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
            const extractedImages = await this.webContentExtractorService.readImage(uri, CancellationToken.None);
            if (extractedImages) {
                return await resolveImageEditorAttachContext(this.fileService, this.dialogService, uri, extractedImages);
            }
        }
        return undefined;
    }
};
ChatAttachmentModel = __decorate([
    __param(0, IInstantiationService),
    __param(1, IFileService),
    __param(2, IDialogService),
    __param(3, ISharedWebContentExtractorService)
], ChatAttachmentModel);
export { ChatAttachmentModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEF0dGFjaG1lbnRNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRBdHRhY2htZW50TW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFaEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFDM0gsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzdFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFReEQsSUFBTSxtQkFBbUIsR0FBekIsTUFBTSxtQkFBb0IsU0FBUSxVQUFVO0lBUWxELFlBQ3dCLFlBQW1DLEVBQzVDLFdBQTBDLEVB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