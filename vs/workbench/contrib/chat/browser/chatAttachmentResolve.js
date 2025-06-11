/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { SymbolKinds } from '../../../../editor/common/languages.js';
import { localize } from '../../../../nls.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { isUntitledResourceEditorInput } from '../../../common/editor.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { createNotebookOutputVariableEntry, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST } from '../../notebook/browser/contrib/chat/notebookChatUtils.js';
import { getOutputViewModelFromId } from '../../notebook/browser/controller/cellOutputActions.js';
import { getNotebookEditorFromEditorPane } from '../../notebook/browser/notebookBrowser.js';
import { CHAT_ATTACHABLE_IMAGE_MIME_TYPES, getAttachableImageExtension, IDiagnosticVariableEntryFilterData } from '../common/chatModel.js';
import { imageToHash } from './chatPasteProviders.js';
import { resizeImage } from './imageUtils.js';
// --- EDITORS ---
export async function resolveEditorAttachContext(editor, fileService, editorService, textModelService, extensionService, dialogService) {
    // untitled editor
    if (isUntitledResourceEditorInput(editor)) {
        return await resolveUntitledEditorAttachContext(editor, editorService, textModelService);
    }
    if (!editor.resource) {
        return undefined;
    }
    let stat;
    try {
        stat = await fileService.stat(editor.resource);
    }
    catch {
        return undefined;
    }
    if (!stat.isDirectory && !stat.isFile) {
        return undefined;
    }
    const imageContext = await resolveImageEditorAttachContext(fileService, dialogService, editor.resource);
    if (imageContext) {
        return extensionService.extensions.some(ext => isProposedApiEnabled(ext, 'chatReferenceBinaryData')) ? imageContext : undefined;
    }
    return await resolveResourceAttachContext(editor.resource, stat.isDirectory, textModelService);
}
async function resolveUntitledEditorAttachContext(editor, editorService, textModelService) {
    // If the resource is known, we can use it directly
    if (editor.resource) {
        return await resolveResourceAttachContext(editor.resource, false, textModelService);
    }
    // Otherwise, we need to check if the contents are already open in another editor
    const openUntitledEditors = editorService.editors.filter(editor => editor instanceof UntitledTextEditorInput);
    for (const canidate of openUntitledEditors) {
        const model = await canidate.resolve();
        const contents = model.textEditorModel?.getValue();
        if (contents === editor.contents) {
            return await resolveResourceAttachContext(canidate.resource, false, textModelService);
        }
    }
    return undefined;
}
export async function resolveResourceAttachContext(resource, isDirectory, textModelService) {
    let omittedState = 0 /* OmittedState.NotOmitted */;
    if (!isDirectory) {
        try {
            const createdModel = await textModelService.createModelReference(resource);
            createdModel.dispose();
        }
        catch {
            omittedState = 2 /* OmittedState.Full */;
        }
        if (/\.(svg)$/i.test(resource.path)) {
            omittedState = 2 /* OmittedState.Full */;
        }
    }
    return {
        kind: isDirectory ? 'directory' : 'file',
        value: resource,
        id: resource.toString(),
        name: basename(resource),
        omittedState
    };
}
const SUPPORTED_IMAGE_EXTENSIONS_REGEX = new RegExp(`\\.(${Object.keys(CHAT_ATTACHABLE_IMAGE_MIME_TYPES).join('|')})$`, 'i');
function getMimeTypeFromPath(match) {
    const ext = match[1].toLowerCase();
    return CHAT_ATTACHABLE_IMAGE_MIME_TYPES[ext];
}
export async function resolveImageEditorAttachContext(fileService, dialogService, resource, data, mimeType) {
    if (!resource) {
        return undefined;
    }
    if (mimeType) {
        if (!getAttachableImageExtension(mimeType)) {
            return undefined;
        }
    }
    else {
        const match = SUPPORTED_IMAGE_EXTENSIONS_REGEX.exec(resource.path);
        if (!match) {
            return undefined;
        }
        mimeType = getMimeTypeFromPath(match);
    }
    const fileName = basename(resource);
    let dataBuffer;
    if (data) {
        dataBuffer = data;
    }
    else {
        let stat;
        try {
            stat = await fileService.stat(resource);
        }
        catch {
            return undefined;
        }
        const readFile = await fileService.readFile(resource);
        if (stat.size > 30 * 1024 * 1024) { // 30 MB
            dialogService.error(localize('imageTooLarge', 'Image is too large'), localize('imageTooLargeMessage', 'The image {0} is too large to be attached.', fileName));
            throw new Error('Image is too large');
        }
        dataBuffer = readFile.value;
    }
    const isPartiallyOmitted = /\.gif$/i.test(resource.path);
    const imageFileContext = await resolveImageAttachContext([{
            id: resource.toString(),
            name: fileName,
            data: dataBuffer.buffer,
            icon: Codicon.fileMedia,
            resource: resource,
            mimeType: mimeType,
            omittedState: isPartiallyOmitted ? 1 /* OmittedState.Partial */ : 0 /* OmittedState.NotOmitted */
        }]);
    return imageFileContext[0];
}
export async function resolveImageAttachContext(images) {
    return Promise.all(images.map(async (image) => ({
        id: image.id || await imageToHash(image.data),
        name: image.name,
        fullName: image.resource ? image.resource.path : undefined,
        value: await resizeImage(image.data, image.mimeType),
        icon: image.icon,
        kind: 'image',
        isFile: false,
        isDirectory: false,
        omittedState: image.omittedState || 0 /* OmittedState.NotOmitted */,
        references: image.resource ? [{ reference: image.resource, kind: 'reference' }] : []
    })));
}
// --- MARKERS ---
export function resolveMarkerAttachContext(markers) {
    return markers.map((marker) => {
        let filter;
        if (!('severity' in marker)) {
            filter = { filterUri: URI.revive(marker.uri), filterSeverity: MarkerSeverity.Warning };
        }
        else {
            filter = IDiagnosticVariableEntryFilterData.fromMarker(marker);
        }
        return IDiagnosticVariableEntryFilterData.toEntry(filter);
    });
}
// --- SYMBOLS ---
export function resolveSymbolsAttachContext(symbols) {
    return symbols.map(symbol => {
        const resource = URI.file(symbol.fsPath);
        return {
            kind: 'symbol',
            id: symbolId(resource, symbol.range),
            value: { uri: resource, range: symbol.range },
            symbolKind: symbol.kind,
            icon: SymbolKinds.toIcon(symbol.kind),
            fullName: symbol.name,
            name: symbol.name,
        };
    });
}
function symbolId(resource, range) {
    let rangePart = '';
    if (range) {
        rangePart = `:${range.startLineNumber}`;
        if (range.startLineNumber !== range.endLineNumber) {
            rangePart += `-${range.endLineNumber}`;
        }
    }
    return resource.fsPath + rangePart;
}
// --- NOTEBOOKS ---
export function resolveNotebookOutputAttachContext(data, editorService) {
    const notebookEditor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!notebookEditor) {
        return [];
    }
    const outputViewModel = getOutputViewModelFromId(data.outputId, notebookEditor);
    if (!outputViewModel) {
        return [];
    }
    const mimeType = outputViewModel.pickedMimeType?.mimeType;
    if (mimeType && NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST.includes(mimeType)) {
        const entry = createNotebookOutputVariableEntry(outputViewModel, mimeType, notebookEditor);
        if (!entry) {
            return [];
        }
        return [entry];
    }
    return [];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEF0dGFjaG1lbnRSZXNvbHZlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEF0dGFjaG1lbnRSZXNvbHZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFaEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXJELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFJOUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRzFFLE9BQU8sRUFBcUIsb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUM1RyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN2RyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsa0RBQWtELEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNqSyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNsRyxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1RixPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsMkJBQTJCLEVBQXVELGtDQUFrQyxFQUFzQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3BPLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0saUJBQWlCLENB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