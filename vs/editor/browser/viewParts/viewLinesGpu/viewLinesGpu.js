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
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { autorun, runOnChange } from '../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { TextureAtlasPage } from '../../gpu/atlas/textureAtlasPage.js';
import { GPULifecycle } from '../../gpu/gpuDisposable.js';
import { quadVertices } from '../../gpu/gpuUtils.js';
import { ViewGpuContext } from '../../gpu/viewGpuContext.js';
import { FloatHorizontalRange, HorizontalPosition, HorizontalRange, LineVisibleRanges, VisibleRanges } from '../../view/renderingContext.js';
import { ViewPart } from '../../view/viewPart.js';
import { ViewLineOptions } from '../viewLines/viewLineOptions.js';
import { CursorColumns } from '../../../common/core/cursorColumns.js';
import { TextureAtlas } from '../../gpu/atlas/textureAtlas.js';
import { createContentSegmenter } from '../../gpu/contentSegmenter.js';
import { ViewportRenderStrategy } from '../../gpu/renderStrategy/viewportRenderStrategy.js';
import { FullFileRenderStrategy } from '../../gpu/renderStrategy/fullFileRenderStrategy.js';
import { MutableDisposable } from '../../../../base/common/lifecycle.js';
import { GlyphRasterizer } from '../../gpu/raster/glyphRasterizer.js';
var GlyphStorageBufferInfo;
(function (GlyphStorageBufferInfo) {
    GlyphStorageBufferInfo[GlyphStorageBufferInfo["FloatsPerEntry"] = 6] = "FloatsPerEntry";
    GlyphStorageBufferInfo[GlyphStorageBufferInfo["BytesPerEntry"] = 24] = "BytesPerEntry";
    GlyphStorageBufferInfo[GlyphStorageBufferInfo["Offset_TexturePosition"] = 0] = "Offset_TexturePosition";
    GlyphStorageBufferInfo[GlyphStorageBufferInfo["Offset_TextureSize"] = 2] = "Offset_TextureSize";
    GlyphStorageBufferInfo[GlyphStorageBufferInfo["Offset_OriginPosition"] = 4] = "Offset_OriginPosition";
})(GlyphStorageBufferInfo || (GlyphStorageBufferInfo = {}));
/**
 * The GPU implementation of the ViewLines part.
 */
let ViewLinesGpu = class ViewLinesGpu extends ViewPart {
    constructor(context, _viewGpuContext, _instantiationService, _logService) {
        super(context);
        this._viewGpuContext = _viewGpuContext;
        this._instantiationService = _instantiationService;
        this._logService = _logService;
        this._atlasGpuTextureVersions = [];
        this._initialized = false;
        this._glyphRasterizer = this._register(new MutableDisposable());
        this._renderStrategy = this._register(new MutableDisposable());
        this.canvas = this._viewGpuContext.canvas.domNode;
        // Re-render the following frame after canvas device pixel dimensions change, provided a
        // new render does not occur.
        this._register(autorun(reader => {
            this._viewGpuContext.canvasDevicePixelDimensions.read(reader);
            const lastViewportData = this._lastViewportData;
            if (lastViewportData) {
                setTimeout(() => {
                    if (lastViewportData === this._lastViewportData) {
                        this.renderText(lastViewportData);
                    }
                });
            }
        }));
        this.initWebgpu();
    }
    async initWebgpu() {
        // #region General
        this._device = ViewGpuContext.deviceSync || await ViewGpuContext.device;
        if (this._store.isDisposed) {
            return;
        }
        const atlas = ViewGpuContext.atlas;
        // Rerender when the texture atlas deletes glyphs
        this._register(atlas.onDidDeleteGlyphs(() => {
            this._atlasGpuTextureVersions.length = 0;
            this._atlasGpuTextureVersions[0] = 0;
            this._atlasGpuTextureVersions[1] = 0;
            this._renderStrategy.value.reset();
        }));
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this._viewGpuContext.ctx.configure({
            device: this._device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        });
        this._renderPassColorAttachment = {
            view: null, // Will be filled at render time
            loadOp: 'load',
            storeOp: 'store',
        };
        this._renderPassDescriptor = {
            label: 'Monaco render pass',
            colorAttachments: [this._renderPassColorAttachment],
        };
        // #endregion General
        // #region Uniforms
        let layoutInfoUniformBuffer;
        {
            let Info;
            (function (Info) {
                Info[Info["FloatsPerEntry"] = 6] = "FloatsPerEntry";
                Info[Info["BytesPerEntry"] = 24] = "BytesPerEntry";
                Info[Info["Offset_CanvasWidth____"] = 0] = "Offset_CanvasWidth____";
                Info[Info["Offset_CanvasHeight___"] = 1] = "Offset_CanvasHeight___";
                Info[Info["Offset_ViewportOffsetX"] = 2] = "Offset_ViewportOffsetX";
                Info[Info["Offset_ViewportOffsetY"] = 3] = "Offset_ViewportOffsetY";
                Info[Info["Offset_ViewportWidth__"] = 4] = "Offset_ViewportWidth__";
                Info[Info["Offset_ViewportHeight_"] = 5] = "Offset_ViewportHeight_";
            })(Info || (Info = {}));
            const bufferValues = new Float32Array(6 /* Info.FloatsPerEntry */);
            const updateBufferValues = (canvasDevicePixelWidth = this.canvas.width, canvasDevicePixelHeight = this.canvas.height) => {
                bufferValues[0 /* Info.Offset_CanvasWidth____ */] = canvasDevicePixelWidth;
                bufferValues[1 /* Info.Offset_CanvasHeight___ */] = canvasDevicePixelHeight;
                bufferValues[2 /* Info.Offset_ViewportOffsetX */] = Math.ceil(this._context.configuration.options.get(154 /* EditorOption.layoutInfo */).contentLeft * getActiveWindow().devicePixelRatio);
                bufferValues[3 /* Info.Offset_ViewportOffsetY */] = 0;
                bufferValues[4 /* Info.Offset_ViewportWidth__ */] = bufferValues[0 /* Info.Offset_CanvasWidth____ */] - bufferValues[2 /* Info.Offset_ViewportOffsetX */];
                bufferValues[5 /* Info.Offset_ViewportHeight_ */] = bufferValues[1 /* Info.Offset_CanvasHeight___ */] - bufferValues[3 /* Info.Offset_ViewportOffsetY */];
                return bufferValues;
            };
            layoutInfoUniformBuffer = this._register(GPULifecycle.createBuffer(this._device, {
                label: 'Monaco uniform buffer',
                size: 24 /* Info.BytesPerEntry */,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }, () => updateBufferValues())).object;
            this._register(runOnChange(this._viewGpuContext.canvasDevicePixelDimensions, ({ width, height }) => {
                this._device.queue.writeBuffer(layoutInfoUniformBuffer, 0, updateBufferValues(width, height));
            }));
            this._register(runOnChange(this._viewGpuContext.contentLeft, () => {
                this._device.queue.writeBuffer(layoutInfoUniformBuffer, 0, updateBufferValues());
            }));
        }
        let atlasInfoUniformBuffer;
        {
            let Info;
            (function (Info) {
                Info[Info["FloatsPerEntry"] = 2] = "FloatsPerEntry";
                Info[Info["BytesPerEntry"] = 8] = "BytesPerEntry";
                Info[Info["Offset_Width_"] = 0] = "Offset_Width_";
                Info[Info["Offset_Height"] = 1] = "Offset_Height";
            })(Info || (Info = {}));
            atlasInfoUniformBuffer = this._register(GPULifecycle.createBuffer(this._device, {
                label: 'Monaco atlas info uniform buffer',
                size: 8 /* Info.BytesPerEntry */,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }, () => {
                const values = new Float32Array(2 /* Info.FloatsPerEntry */);
                values[0 /* Info.Offset_Width_ */] = atlas.pageSize;
                values[1 /* Info.Offset_Height */] = atlas.pageSize;
                return values;
            })).object;
        }
        // #endregion Uniforms
        // #region Storage buffers
        const fontFamily = this._context.configuration.options.get(54 /* EditorOption.fontFamily */);
        const fontSize = this._context.configuration.options.get(57 /* EditorOption.fontSize */);
        this._glyphRasterizer.value = this._register(new GlyphRasterizer(fontSize, fontFamily, this._viewGpuContext.devicePixelRatio.get()));
        this._register(runOnChange(this._viewGpuContext.devicePixelRatio, () => {
            this._refreshGlyphRasterizer();
        }));
        this._renderStrategy.value = this._instantiationService.createInstance(FullFileRenderStrategy, this._context, this._viewGpuContext, this._device, this._glyphRasterizer);
        // this._renderStrategy.value = this._instantiationService.createInstance(ViewportRenderStrategy, this._context, this._viewGpuContext, this._device);
        this._glyphStorageBuffer = this._register(GPULifecycle.createBuffer(this._device, {
            label: 'Monaco glyph storage buffer',
            size: TextureAtlas.maximumPageCount * (TextureAtlasPage.maximumGlyphCount * 24 /* GlyphStorageBufferInfo.BytesPerEntry */),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })).object;
        this._atlasGpuTextureVersions[0] = 0;
        this._atlasGpuTextureVersions[1] = 0;
        this._atlasGpuTexture = this._register(GPULifecycle.createTexture(this._device, {
            label: 'Monaco atlas texture',
            format: 'rgba8unorm',
            size: { width: atlas.pageSize, height: atlas.pageSize, depthOrArrayLayers: TextureAtlas.maximumPageCount },
            dimension: '2d',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        })).object;
        this._updateAtlasStorageBufferAndTexture();
        // #endregion Storage buffers
        // #region Vertex buffer
        this._vertexBuffer = this._register(GPULifecycle.createBuffer(this._device, {
            label: 'Monaco vertex buffer',
            size: quadVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        }, quadVertices)).object;
        // #endregion Vertex buffer
        // #region Shader module
        const module = this._device.createShaderModule({
            label: 'Monaco shader module',
            code: this._renderStrategy.value.wgsl,
        });
        // #endregion Shader module
        // #region Pipeline
        this._pipeline = this._device.createRenderPipeline({
            label: 'Monaco render pipeline',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT, // 2 floats, 4 bytes each
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
                        ],
                    }
                ]
            },
            fragment: {
                module,
                targets: [
                    {
                        format: presentationFormat,
                        blend: {
                            color: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha'
                            },
                            alpha: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha'
                            },
                        },
                    }
                ],
            },
        });
        // #endregion Pipeline
        // #region Bind group
        this._rebuildBindGroup = () => {
            this._bindGroup = this._device.createBindGroup({
                label: 'Monaco bind group',
                layout: this._pipeline.getBindGroupLayout(0),
                entries: [
                    // TODO: Pass in generically as array?
                    { binding: 0 /* BindingId.GlyphInfo */, resource: { buffer: this._glyphStorageBuffer } },
                    {
                        binding: 2 /* BindingId.TextureSampler */, resource: this._device.createSampler({
                            label: 'Monaco atlas sampler',
                            magFilter: 'nearest',
                            minFilter: 'nearest',
                        })
                    },
                    { binding: 3 /* BindingId.Texture */, resource: this._atlasGpuTexture.createView() },
                    { binding: 4 /* BindingId.LayoutInfoUniform */, resource: { buffer: layoutInfoUniformBuffer } },
                    { binding: 5 /* BindingId.AtlasDimensionsUniform */, resource: { buffer: atlasInfoUniformBuffer } },
                    ...this._renderStrategy.value.bindGroupEntries
                ],
            });
        };
        this._rebuildBindGroup();
        // endregion Bind group
        this._initialized = true;
        // Render the initial viewport immediately after initialization
        if (this._initViewportData) {
            // HACK: Rendering multiple times in the same frame like this isn't ideal, but there
            //       isn't an easy way to merge viewport data
            for (const viewportData of this._initViewportData) {
                this.renderText(viewportData);
            }
            this._initViewportData = undefined;
        }
    }
    _refreshRenderStrategy(viewportData) {
        if (this._renderStrategy.value?.type === 'viewport') {
            return;
        }
        if (viewportData.endLineNumber < FullFileRenderStrategy.maxSupportedLines && this._viewportMaxColumn(viewportData) < FullFileRenderStrategy.maxSupportedColumns) {
            return;
        }
        this._logService.trace(`File is larger than ${FullFileRenderStrategy.maxSupportedLines} lines or ${FullFileRenderStrategy.maxSupportedColumns} columns, switching to viewport render strategy`);
        const viewportRenderStrategy = this._instantiationService.createInstance(ViewportRenderStrategy, this._context, this._viewGpuContext, this._device, this._glyphRasterizer);
        this._renderStrategy.value = viewportRenderStrategy;
        this._register(viewportRenderStrategy.onDidChangeBindGroupEntries(() => this._rebuildBindGroup?.()));
        this._rebuildBindGroup?.();
    }
    _viewportMaxColumn(viewportData) {
        let maxColumn = 0;
        let lineData;
        for (let i = viewportData.startLineNumber; i <= viewportData.endLineNumber; i++) {
            lineData = viewportData.getViewLineRenderingData(i);
            maxColumn = Math.max(maxColumn, lineData.maxColumn);
        }
        return maxColumn;
    }
    _updateAtlasStorageBufferAndTexture() {
        for (const [layerIndex, page] of ViewGpuContext.atlas.pages.entries()) {
            if (layerIndex >= TextureAtlas.maximumPageCount) {
                console.log(`Attempt to upload atlas page [${layerIndex}], only ${TextureAtlas.maximumPageCount} are supported currently`);
                continue;
            }
            // Skip the update if it's already the latest version
            if (page.version === this._atlasGpuTextureVersions[layerIndex]) {
                continue;
            }
            this._logService.trace('Updating atlas page[', layerIndex, '] from version ', this._atlasGpuTextureVersions[layerIndex], ' to version ', page.version);
            const entryCount = 6 /* GlyphStorageBufferInfo.FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount;
            const values = new Float32Array(entryCount);
            let entryOffset = 0;
            for (const glyph of page.glyphs) {
                values[entryOffset + 0 /* GlyphStorageBufferInfo.Offset_TexturePosition */] = glyph.x;
                values[entryOffset + 0 /* GlyphStorageBufferInfo.Offset_TexturePosition */ + 1] = glyph.y;
                values[entryOffset + 2 /* GlyphStorageBufferInfo.Offset_TextureSize */] = glyph.w;
                values[entryOffset + 2 /* GlyphStorageBufferInfo.Offset_TextureSize */ + 1] = glyph.h;
                values[entryOffset + 4 /* GlyphStorageBufferInfo.Offset_OriginPosition */] = glyph.originOffsetX;
                values[entryOffset + 4 /* GlyphStorageBufferInfo.Offset_OriginPosition */ + 1] = glyph.originOffsetY;
                entryOffset += 6 /* GlyphStorageBufferInfo.FloatsPerEntry */;
            }
            if (entryOffset / 6 /* GlyphStorageBufferInfo.FloatsPerEntry */ > TextureAtlasPage.maximumGlyphCount) {
                throw new Error(`Attempting to write more glyphs (${entryOffset / 6 /* GlyphStorageBufferInfo.FloatsPerEntry */}) than the GPUBuffer can hold (${TextureAtlasPage.maximumGlyphCount})`);
            }
            this._device.queue.writeBuffer(this._glyphStorageBuffer, layerIndex * 6 /* GlyphStorageBufferInfo.FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount * Float32Array.BYTES_PER_ELEMENT, values, 0, 6 /* GlyphStorageBufferInfo.FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount);
            if (page.usedArea.right - page.usedArea.left > 0 && page.usedArea.bottom - page.usedArea.top > 0) {
                this._device.queue.copyExternalImageToTexture({ source: page.source }, {
                    texture: this._atlasGpuTexture,
                    origin: {
                        x: page.usedArea.left,
                        y: page.usedArea.top,
                        z: layerIndex
                    }
                }, {
                    width: page.usedArea.right - page.usedArea.left + 1,
                    height: page.usedArea.bottom - page.usedArea.top + 1
                });
            }
            this._atlasGpuTextureVersions[layerIndex] = page.version;
        }
    }
    prepareRender(ctx) {
        throw new BugIndicatingError('Should not be called');
    }
    render(ctx) {
        throw new BugIndicatingError('Should not be called');
    }
    // #region Event handlers
    // Since ViewLinesGpu currently coordinates rendering to the canvas, it must listen to all
    // changed events that any GPU part listens to. This is because any drawing to the canvas will
    // clear it for that frame, so all parts must be rendered every time.
    //
    // Additionally, since this is intrinsically linked to ViewLines, it must also listen to events
    // from that side. Luckily rendering is cheap, it's only when uploaded data changes does it
    // start to cost.
    onConfigurationChanged(e) {
        this._refreshGlyphRasterizer();
        return true;
    }
    onCursorStateChanged(e) { return true; }
    onDecorationsChanged(e) { return true; }
    onFlushed(e) { return true; }
    onLinesChanged(e) { return true; }
    onLinesDeleted(e) { return true; }
    onLinesInserted(e) { return true; }
    onLineMappingChanged(e) { return true; }
    onRevealRangeRequest(e) { return true; }
    onScrollChanged(e) { return true; }
    onThemeChanged(e) { return true; }
    onZonesChanged(e) { return true; }
    // #endregion
    _refreshGlyphRasterizer() {
        const glyphRasterizer = this._glyphRasterizer.value;
        if (!glyphRasterizer) {
            return;
        }
        const fontFamily = this._context.configuration.options.get(54 /* EditorOption.fontFamily */);
        const fontSize = this._context.configuration.options.get(57 /* EditorOption.fontSize */);
        const devicePixelRatio = this._viewGpuContext.devicePixelRatio.get();
        if (glyphRasterizer.fontFamily !== fontFamily ||
            glyphRasterizer.fontSize !== fontSize ||
            glyphRasterizer.devicePixelRatio !== devicePixelRatio) {
            this._glyphRasterizer.value = new GlyphRasterizer(fontSize, fontFamily, devicePixelRatio);
        }
    }
    renderText(viewportData) {
        if (this._initialized) {
            this._refreshRenderStrategy(viewportData);
            return this._renderText(viewportData);
        }
        else {
            this._initViewportData = this._initViewportData ?? [];
            this._initViewportData.push(viewportData);
        }
    }
    _renderText(viewportData) {
        this._viewGpuContext.rectangleRenderer.draw(viewportData);
        const options = new ViewLineOptions(this._context.configuration, this._context.theme.type);
        this._renderStrategy.value.update(viewportData, options);
        this._updateAtlasStorageBufferAndTexture();
        const encoder = this._device.createCommandEncoder({ label: 'Monaco command encoder' });
        this._renderPassColorAttachment.view = this._viewGpuContext.ctx.getCurrentTexture().createView({ label: 'Monaco canvas texture view' });
        const pass = encoder.beginRenderPass(this._renderPassDescriptor);
        pass.setPipeline(this._pipeline);
        pass.setVertexBuffer(0, this._vertexBuffer);
        // Only draw the content area
        const contentLeft = Math.ceil(this._viewGpuContext.contentLeft.get() * this._viewGpuContext.devicePixelRatio.get());
        pass.setScissorRect(contentLeft, 0, this.canvas.width - contentLeft, this.canvas.height);
        pass.setBindGroup(0, this._bindGroup);
        this._renderStrategy.value.draw(pass, viewportData);
        pass.end();
        const commandBuffer = encoder.finish();
        this._device.queue.submit([commandBuffer]);
        this._lastViewportData = viewportData;
        this._lastViewLineOptions = options;
    }
    linesVisibleRangesForRange(_range, includeNewLines) {
        if (!this._lastViewportData) {
            return null;
        }
        const originalEndLineNumber = _range.endLineNumber;
        const range = Range.intersectRanges(_range, this._lastViewportData.visibleRange);
        if (!range) {
            return null;
        }
        const rendStartLineNumber = this._lastViewportData.startLineNumber;
        const rendEndLineNumber = this._lastViewportData.endLineNumber;
        const viewportData = this._lastViewportData;
        const viewLineOptions = this._lastViewLineOptions;
        if (!viewportData || !viewLineOptions) {
            return null;
        }
        const visibleRanges = [];
        let nextLineModelLineNumber = 0;
        if (includeNewLines) {
            nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(range.startLineNumber, 1)).lineNumber;
        }
        for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
            if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
                continue;
            }
            const startColumn = lineNumber === range.startLineNumber ? range.startColumn : 1;
            const continuesInNextLine = lineNumber !== originalEndLineNumber;
            const endColumn = continuesInNextLine ? this._context.viewModel.getLineMaxColumn(lineNumber) : range.endColumn;
            const visibleRangesForLine = this._visibleRangesForLineRange(lineNumber, startColumn, endColumn);
            if (!visibleRangesForLine) {
                continue;
            }
            if (includeNewLines && lineNumber < originalEndLineNumber) {
                const currentLineModelLineNumber = nextLineModelLineNumber;
                nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber + 1, 1)).lineNumber;
                if (currentLineModelLineNumber !== nextLineModelLineNumber) {
                    visibleRangesForLine.ranges[visibleRangesForLine.ranges.length - 1].width += viewLineOptions.spaceWidth;
                }
            }
            visibleRanges.push(new LineVisibleRanges(visibleRangesForLine.outsideRenderedLine, lineNumber, HorizontalRange.from(visibleRangesForLine.ranges), continuesInNextLine));
        }
        if (visibleRanges.length === 0) {
            return null;
        }
        return visibleRanges;
    }
    _visibleRangesForLineRange(lineNumber, startColumn, endColumn) {
        if (this.shouldRender()) {
            // Cannot read from the DOM because it is dirty
            // i.e. the model & the dom are out of sync, so I'd be reading something stale
            return null;
        }
        const viewportData = this._lastViewportData;
        const viewLineOptions = this._lastViewLineOptions;
        if (!viewportData || !viewLineOptions || lineNumber < viewportData.startLineNumber || lineNumber > viewportData.endLineNumber) {
            return null;
        }
        // Resolve tab widths for this line
        const lineData = viewportData.getViewLineRenderingData(lineNumber);
        const content = lineData.content;
        let contentSegmenter;
        if (!(lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations)) {
            contentSegmenter = createContentSegmenter(lineData, viewLineOptions);
        }
        let chars = '';
        let resolvedStartColumn = 0;
        let resolvedStartCssPixelOffset = 0;
        for (let x = 0; x < startColumn - 1; x++) {
            if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
                chars = content.charAt(x);
            }
            else {
                chars = contentSegmenter.getSegmentAtIndex(x);
                if (chars === undefined) {
                    continue;
                }
                resolvedStartCssPixelOffset += (this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / getActiveWindow().devicePixelRatio) - viewLineOptions.spaceWidth;
            }
            if (chars === '\t') {
                resolvedStartColumn = CursorColumns.nextRenderTabStop(resolvedStartColumn, lineData.tabSize);
            }
            else {
                resolvedStartColumn++;
            }
        }
        let resolvedEndColumn = resolvedStartColumn;
        let resolvedEndCssPixelOffset = 0;
        for (let x = startColumn - 1; x < endColumn - 1; x++) {
            if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
                chars = content.charAt(x);
            }
            else {
                chars = contentSegmenter.getSegmentAtIndex(x);
                if (chars === undefined) {
                    continue;
                }
                resolvedEndCssPixelOffset += (this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / getActiveWindow().devicePixelRatio) - viewLineOptions.spaceWidth;
            }
            if (chars === '\t') {
                resolvedEndColumn = CursorColumns.nextRenderTabStop(resolvedEndColumn, lineData.tabSize);
            }
            else {
                resolvedEndColumn++;
            }
        }
        // Visible horizontal range in _scaled_ pixels
        const result = new VisibleRanges(false, [new FloatHorizontalRange(resolvedStartColumn * viewLineOptions.spaceWidth + resolvedStartCssPixelOffset, (resolvedEndColumn - resolvedStartColumn) * viewLineOptions.spaceWidth + resolvedEndCssPixelOffset)
        ]);
        return result;
    }
    visibleRangeForPosition(position) {
        const visibleRanges = this._visibleRangesForLineRange(position.lineNumber, position.column, position.column);
        if (!visibleRanges) {
            return null;
        }
        return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
    }
    getLineWidth(lineNumber) {
        if (!this._lastViewportData || !this._lastViewLineOptions) {
            return undefined;
        }
        if (!this._viewGpuContext.canRender(this._lastViewLineOptions, this._lastViewportData, lineNumber)) {
            return undefined;
        }
        const lineData = this._lastViewportData.getViewLineRenderingData(lineNumber);
        const lineRange = this._visibleRangesForLineRange(lineNumber, 1, lineData.maxColumn);
        const lastRange = lineRange?.ranges.at(-1);
        if (lastRange) {
            return lastRange.width;
        }
        return undefined;
    }
    getPositionAtCoordinate(lineNumber, mouseContentHorizontalOffset) {
        if (!this._lastViewportData || !this._lastViewLineOptions) {
            return undefined;
        }
        if (!this._viewGpuContext.canRender(this._lastViewLineOptions, this._lastViewportData, lineNumber)) {
            return undefined;
        }
        const lineData = this._lastViewportData.getViewLineRenderingData(lineNumber);
        const content = lineData.content;
        const dpr = getActiveWindow().devicePixelRatio;
        const mouseContentHorizontalOffsetDevicePixels = mouseContentHorizontalOffset * dpr;
        const spaceWidthDevicePixels = this._lastViewLineOptions.spaceWidth * dpr;
        const contentSegmenter = createContentSegmenter(lineData, this._lastViewLineOptions);
        let widthSoFar = 0;
        let charWidth = 0;
        let tabXOffset = 0;
        let column = 0;
        for (let x = 0; x < content.length; x++) {
            const chars = contentSegmenter.getSegmentAtIndex(x);
            // Part of an earlier segment
            if (chars === undefined) {
                column++;
                continue;
            }
            // Get the width of the character
            if (chars === '\t') {
                // Find the pixel offset between the current position and the next tab stop
                const offsetBefore = x + tabXOffset;
                tabXOffset = CursorColumns.nextRenderTabStop(x + tabXOffset, lineData.tabSize);
                charWidth = spaceWidthDevicePixels * (tabXOffset - offsetBefore);
                // Convert back to offset excluding x and the current character
                tabXOffset -= x + 1;
            }
            else if (lineData.isBasicASCII && this._lastViewLineOptions.useMonospaceOptimizations) {
                charWidth = spaceWidthDevicePixels;
            }
            else {
                charWidth = this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width;
            }
            if (mouseContentHorizontalOffsetDevicePixels < widthSoFar + charWidth / 2) {
                break;
            }
            widthSoFar += charWidth;
            column++;
        }
        return new Position(lineNumber, column + 1);
    }
};
ViewLinesGpu = __decorate([
    __param(2, IInstantiationService),
    __param(3, ILogService)
], ViewLinesGpu);
export { ViewLinesGpu };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xpbmVzR3B1LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvdmlld0xpbmVzR3B1L3ZpZXdMaW5lc0dwdS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFckUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUd0RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUV2RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFjLGlCQUFpQixFQUFnRCxhQUFhLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN2TSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx1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