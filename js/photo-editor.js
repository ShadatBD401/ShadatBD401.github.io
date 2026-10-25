/* ============================================================
   ADVANCED PHOTO EDITOR — CORRECTED
   ============================================================ */
const PhotoEditor = (() => {
    const MAX_HISTORY = 30;
    const PREVIEW_MAX = 800;   // improved preview (was 640) — safe on all devices

    let state = {};

    function resetState(img) {
        state = {
            img,                       // HTMLImageElement (source)
            previewCanvas: null,
            previewCtx: null,
            previewW: 0,
            previewH: 0,
            rotation: 0,
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
            flipH: false,
            flipV: false,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            hue: 0,
            blur: 0,
            exposure: 100,
            grayscale: false,
            sepia: false,
            invert: false,
            vignette: 0,
            circle: false,
            frame: 'none',
            activeTool: 'adjust',
            aspect: 'free',
            cropRect: null,
            texts: [],
            drawings: [],
            activeTextId: null,
            drawing: null,
            dragging: false,
            dragStart: null,
            history: [],
            historyIndex: -1,
            originalFile: null,
            touched: false,         
           
        };
    }

    // ── Build UI ────────────────────────────────────────────
    function buildUI() {
        let overlay = document.getElementById('photoEditorOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'photoEditorOverlay';
        overlay.className = 'photo-editor-overlay';
        overlay.innerHTML = `
            <div class="photo-editor-panel">
                <div class="photo-editor-header">
                    <h3><i class="fas fa-magic"></i> Photo Editor</h3>
                    <div class="pe-header-actions">
                        <button class="pe-icon-btn" id="peUndo" title="Undo"><i class="fas fa-undo"></i></button>
                        <button class="pe-icon-btn" id="peRedo" title="Redo"><i class="fas fa-redo"></i></button>
                        <button class="photo-editor-close" id="peClose"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="pe-toolbar">
                    <button class="pe-tool active" data-tool="adjust"><i class="fas fa-sliders-h"></i><span>Adjust</span></button>
                    <button class="pe-tool" data-tool="crop"><i class="fas fa-crop-alt"></i><span>Crop</span></button>
                    <button class="pe-tool" data-tool="filter"><i class="fas fa-filter"></i><span>Filters</span></button>
                    <button class="pe-tool" data-tool="text"><i class="fas fa-font"></i><span>Text</span></button>
                    <button class="pe-tool" data-tool="draw"><i class="fas fa-pen"></i><span>Draw</span></button>
                    <button class="pe-tool" data-tool="sticker"><i class="fas fa-smile"></i><span>Stickers</span></button>
                    <button class="pe-tool" data-tool="frame"><i class="fas fa-border-all"></i><span>Frame</span></button>
                </div>
                <div class="pe-body">
                    <div class="pe-stage-wrap">
                        <div class="pe-stage">
                            <canvas id="peCanvas"></canvas>
                            <div class="pe-stage-hint">Drag to move · Scroll to zoom</div>
                        </div>
                    </div>
                    <div class="pe-panel" id="pePanel"></div>
                </div>
                <div class="photo-editor-footer">
                    <div class="pe-footer-left">
                        <button class="btn btn-outline btn-sm" id="peReset"><i class="fas fa-undo"></i> Reset</button>
                        <span class="pe-info" id="peInfo"></span>
                    </div>
                    <div class="pe-footer-right">
                        <button class="btn btn-outline" id="peCancel">Cancel</button>
                        <button class="btn btn-primary" id="peApply"><i class="fas fa-check"></i> Apply</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    // ── Filter string ───────────────────────────────────────
    function filterString() {
        let f = `brightness(${state.brightness * state.exposure / 100}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
        if (state.hue) f += ` hue-rotate(${state.hue}deg)`;
        if (state.blur) f += ` blur(${state.blur}px)`;
        if (state.grayscale) f += ' grayscale(100%)';
        if (state.sepia) f += ' sepia(100%)';
        if (state.invert) f += ' invert(100%)';
        return f;
    }

    // ── Draw preview (no cumulative filters!) ───────────────
    function drawPreview() {
        const c = state.previewCanvas;
        const ctx = state.previewCtx;
        if (!c || !ctx) return;
        const W = c.width, H = c.height;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, W, H);

        // Draw the image with transform + filter
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(state.rotation * Math.PI / 180);
        if (state.flipH) ctx.scale(-1, 1);
        if (state.flipV) ctx.scale(1, -1);
        ctx.scale(state.zoom, state.zoom);
        ctx.translate(-W / 2 + state.offsetX, -H / 2 + state.offsetY);

        ctx.filter = filterString();
        ctx.drawImage(state.img, 0, 0, W, H);
        ctx.filter = 'none';
        ctx.restore();

        // Draw strokes
        state.drawings.forEach(s => {
            if (s.points.length < 2) return;
            ctx.save();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            s.points.forEach((p, i) => {
                const x = p.x * W, y = p.y * H;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        });

        // Draw texts / stickers
        state.texts.forEach(t => {
            ctx.save();
            const x = t.x * W, y = t.y * H;
            const px = t.isSticker ? t.size : t.size * W / 1024;
            ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${px}px ${t.font || 'Inter'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (!t.isSticker) {
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 2;
            }
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, x, y);
            if (state.activeTextId === t.id) {
                const m = ctx.measureText(t.text);
                ctx.shadowColor = 'transparent';
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                const pad = 6, w = m.width, h = px;
                ctx.strokeRect(x - w / 2 - pad, y - h / 2 - pad, w + pad * 2, h + pad * 2);
            }
            ctx.restore();
        });

        // Crop overlay (preview only)
        if (state.cropRect && state.activeTool === 'crop') {
            const r = state.cropRect;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, H);
            ctx.clearRect(r.x, r.y, r.w, r.h);
            // Re-draw inside crop
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            drawPreviewToCropClip();
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            ctx.restore();
        }
    }

    // redraw the image only (used inside crop clip)
    function drawPreviewToCropClip() {
        const c = state.previewCanvas;
        const ctx = state.previewCtx;
        const W = c.width, H = c.height;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(state.rotation * Math.PI / 180);
        if (state.flipH) ctx.scale(-1, 1);
        if (state.flipV) ctx.scale(1, -1);
        ctx.scale(state.zoom, state.zoom);
        ctx.translate(-W / 2 + state.offsetX, -H / 2 + state.offsetY);
        ctx.filter = filterString();
        ctx.drawImage(state.img, 0, 0, W, H);
        ctx.filter = 'none';
        ctx.restore();
    }

    // ── Render controls panel ───────────────────────────────
    function renderPanel() {
        const panel = document.getElementById('pePanel');
        if (!panel) return;
        const t = state.activeTool;

        if (t === 'adjust') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-sun"></i> Light</h4>
                    ${slider('brightness', 'Brightness', 50, 150, state.brightness)}
                    ${slider('contrast', 'Contrast', 50, 150, state.contrast)}
                    ${slider('exposure', 'Exposure', 50, 150, state.exposure)}
                    ${slider('vignette', 'Vignette', 0, 100, state.vignette)}
                </div>
                <div class="pe-panel-section">
                    <h4><i class="fas fa-palette"></i> Color</h4>
                    ${slider('saturation', 'Saturation', 0, 200, state.saturation)}
                    ${slider('hue', 'Hue', -180, 180, state.hue)}
                </div>
                <div class="pe-panel-section">
                    <h4><i class="fas fa-eye"></i> Effects</h4>
                    ${slider('blur', 'Blur', 0, 10, state.blur)}
                    <div class="pe-toggles">
                        <label class="pe-checkbox"><input type="checkbox" data-key="grayscale" ${state.grayscale ? 'checked' : ''}> Grayscale</label>
                        <label class="pe-checkbox"><input type="checkbox" data-key="sepia" ${state.sepia ? 'checked' : ''}> Sepia</label>
                        <label class="pe-checkbox"><input type="checkbox" data-key="invert" ${state.invert ? 'checked' : ''}> Invert</label>
                        <label class="pe-checkbox"><input type="checkbox" data-key="circle" ${state.circle ? 'checked' : ''}> Circle</label>
                    </div>
                </div>`;
        } else if (t === 'crop') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-crop-alt"></i> Aspect</h4>
                    <div class="pe-aspect-grid">
                        ${['free','1:1','4:3','3:2','16:9','9:16'].map(a =>
                            `<button class="pe-aspect-btn ${state.aspect===a?'active':''}" data-aspect="${a}">${a}</button>`
                        ).join('')}
                    </div>
                    <p class="pe-hint">Drag on the preview to define crop area.</p>
                    <div class="pe-row">
                        <button class="btn btn-outline btn-sm" id="peCropReset"><i class="fas fa-times"></i> Clear</button>
                        <button class="btn btn-primary btn-sm" id="peCropApply"><i class="fas fa-check"></i> Apply</button>
                    </div>
                </div>
                <div class="pe-panel-section">
                    <h4><i class="fas fa-arrows-alt"></i> Transform</h4>
                    ${slider('rotation', 'Rotation', 0, 360, state.rotation)}
                    <div class="pe-row">
                        <button class="btn btn-outline btn-sm" id="peRotL"><i class="fas fa-rotate-left"></i> -90°</button>
                        <button class="btn btn-outline btn-sm" id="peRotR"><i class="fas fa-rotate-right"></i> +90°</button>
                        <button class="btn btn-outline btn-sm" id="peFlipH"><i class="fas fa-arrows-alt-h"></i> H</button>
                        <button class="btn btn-outline btn-sm" id="peFlipV"><i class="fas fa-arrows-alt-v"></i> V</button>
                    </div>
                </div>`;
            bindPanel();
            panel.querySelectorAll('.pe-aspect-btn').forEach(b => {
                b.onclick = () => {
                    state.aspect = b.dataset.aspect;
                    state.cropRect = null;
                    renderPanel(); drawPreview();
                };
            });
            document.getElementById('peRotL').onclick = () => { state.rotation = (state.rotation - 90 + 360) % 360; saveHistory(); drawPreview(); };
            document.getElementById('peRotR').onclick = () => { state.rotation = (state.rotation + 90) % 360; saveHistory(); drawPreview(); };
            document.getElementById('peFlipH').onclick = () => { state.flipH = !state.flipH; saveHistory(); drawPreview(); };
            document.getElementById('peFlipV').onclick = () => { state.flipV = !state.flipV; saveHistory(); drawPreview(); };
            document.getElementById('peCropReset').onclick = () => { state.cropRect = null; drawPreview(); };
            document.getElementById('peCropApply').onclick = applyCrop;
        } else if (t === 'filter') {
            const presets = [
                { n: 'Original', b:100, c:100, s:100, h:0, sep:false, gr:false, bl:0 },
                { n: 'Vivid',    b:110, c:120, s:150, h:0, sep:false, gr:false, bl:0 },
                { n: 'Vintage',  b:105, c:90,  s:70,  h:0, sep:true,  gr:false, bl:0 },
                { n: 'B&W',      b:105, c:110, s:0,   h:0, sep:false, gr:true,  bl:0 },
                { n: 'Cool',     b:100, c:105, s:110, h:-15, sep:false, gr:false, bl:0 },
                { n: 'Warm',     b:105, c:105, s:115, h:15,  sep:false, gr:false, bl:0 },
                { n: 'Fade',     b:110, c:85,  s:80,  h:0, sep:false, gr:false, bl:.3 },
                { n: 'Dramatic', b:95,  c:140, s:120, h:0, sep:false, gr:false, bl:0 },
                { n: 'Soft',     b:108, c:90,  s:105, h:0, sep:false, gr:false, bl:.8 },
                { n: 'Retro',    b:105, c:95,  s:90,  h:10, sep:true,  gr:false, bl:.2 },
                { n: 'Cinema',   b:100, c:115, s:105, h:-5, sep:false, gr:false, bl:0 },
                { n: 'Neon',     b:115, c:135, s:170, h:-20, sep:false, gr:false, bl:0 },
            ];
            panel.innerHTML = `<div class="pe-panel-section">
                <h4><i class="fas fa-magic"></i> Presets</h4>
                <div class="pe-preset-grid">
                    ${presets.map((p, i) => `<button class="pe-preset" data-preset="${i}">${p.n}</button>`).join('')}
                </div></div>`;
            panel.querySelectorAll('.pe-preset').forEach(b => {
                b.onclick = () => {
                    const p = presets[+b.dataset.preset];
                    state.brightness = p.b; state.contrast = p.c;
                    state.saturation = p.s; state.hue = p.h;
                    state.sepia = p.sep; state.grayscale = p.gr;
                    state.blur = p.bl;
                    saveHistory(); drawPreview();
                };
            });
        } else if (t === 'text') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-font"></i> Add Text</h4>
                    <textarea id="peTextInput" rows="2" placeholder="Type here..."></textarea>
                    <div class="pe-row"><label>Size <input type="range" id="peTextSize" min="12" max="200" value="48"></label></div>
                    <div class="pe-row">
                        <input type="color" id="peTextColor" value="#ffffff">
                        <select id="peTextFont">
                            <option value="Inter">Inter</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Impact">Impact</option>
                        </select>
                    </div>
                    <div class="pe-toggles">
                        <label class="pe-checkbox"><input type="checkbox" id="peTextBold"> Bold</label>
                        <label class="pe-checkbox"><input type="checkbox" id="peTextItalic"> Italic</label>
                    </div>
                    <button class="btn btn-primary btn-sm" id="peAddText" style="margin-top:8px;"><i class="fas fa-plus"></i> Add</button>
                </div>
                <div class="pe-panel-section">
                    <h4>Layers (${state.texts.length})</h4>
                    <div class="pe-layers">
                        ${state.texts.map(t => `
                            <div class="pe-layer ${state.activeTextId===t.id?'active':''}" data-id="${t.id}">
                                <span>${escapeHtml(t.text.slice(0,20))}</span>
                                <button class="pe-layer-del" data-del="${t.id}"><i class="fas fa-times"></i></button>
                            </div>`).join('') || '<p class="pe-hint">No text yet.</p>'}
                    </div>
                </div>`;
            bindPanel();
            document.getElementById('peAddText').onclick = () => {
                const text = document.getElementById('peTextInput').value.trim();
                if (!text) return;
                const t = {
                    id: 'txt_' + Date.now(),
                    text,
                    x: 0.5, y: 0.5,
                    size: +document.getElementById('peTextSize').value,
                    color: document.getElementById('peTextColor').value,
                    font: document.getElementById('peTextFont').value,
                    bold: document.getElementById('peTextBold').checked,
                    italic: document.getElementById('peTextItalic').checked,
                };
                state.texts.push(t);
                state.activeTextId = t.id;
                saveHistory(); drawPreview(); renderPanel();
            };
            panel.querySelectorAll('.pe-layer').forEach(el => {
                el.onclick = (e) => {
                    if (e.target.closest('.pe-layer-del')) return;
                    state.activeTextId = el.dataset.id;
                    renderPanel(); drawPreview();
                };
            });
            panel.querySelectorAll('.pe-layer-del').forEach(b => {
                b.onclick = (e) => {
                    e.stopPropagation();
                    state.texts = state.texts.filter(t => t.id !== b.dataset.del);
                    if (state.activeTextId === b.dataset.del) state.activeTextId = null;
                    saveHistory(); drawPreview(); renderPanel();
                };
            });
        } else if (t === 'draw') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-pen"></i> Draw</h4>
                    <div class="pe-row">
                        <input type="color" id="peDrawColor" value="#3b82f6">
                        <label>Size <input type="range" id="peDrawSize" min="1" max="40" value="6"></label>
                    </div>
                    <p class="pe-hint">Draw on the image.</p>
                    <button class="btn btn-outline btn-sm" id="peClearDraw"><i class="fas fa-eraser"></i> Clear</button>
                </div>
                <div class="pe-panel-section"><h4>Strokes (${state.drawings.length})</h4></div>`;
            bindPanel();
            document.getElementById('peClearDraw').onclick = () => {
                state.drawings = []; saveHistory(); drawPreview(); renderPanel();
            };
        } else if (t === 'sticker') {
            const stickers = ['😀','😎','🔥','❤️','⭐','✨','🎉','👍','💯','🚀','🌈','🎨','📷','💎','🌟','👑','🏆','🎯','💡','⚡','🌸','🍕','☕','🐱','🐶','🦄','🌊','🌙','☀️','🍀'];
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-smile"></i> Stickers</h4>
                    <div class="pe-sticker-grid">
                        ${stickers.map(s => `<button class="pe-sticker" data-sticker="${s}">${s}</button>`).join('')}
                    </div>
                </div>`;
            panel.querySelectorAll('.pe-sticker').forEach(b => {
                b.onclick = () => {
                    const t = {
                        id: 'stk_' + Date.now(),
                        text: b.dataset.sticker,
                        isSticker: true,
                        x: 0.5, y: 0.5, size: 96,
                        color: '#fff', font: 'Arial',
                    };
                    state.texts.push(t);
                    state.activeTextId = t.id;
                    saveHistory(); drawPreview();
                };
            });
        } else if (t === 'frame') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-border-all"></i> Frame</h4>
                    <div class="pe-frame-grid">
                        ${['none','white','black','rounded'].map(f =>
                            `<button class="pe-frame-btn ${state.frame===f?'active':''}" data-frame="${f}">${f}</button>`
                        ).join('')}
                    </div>
                </div>`;
            panel.querySelectorAll('.pe-frame-btn').forEach(b => {
                b.onclick = () => { state.frame = b.dataset.frame; saveHistory(); drawPreview(); renderPanel(); };
            });
        }
        updateInfo();
    }

    function slider(key, label, min, max, val) {
        return `<label class="pe-slider">
            <span>${label}</span>
            <input type="range" data-key="${key}" min="${min}" max="${max}" value="${val}">
            <span class="pe-slider-val" data-val="${key}">${val}</span>
        </label>`;
    }

    function bindPanel() {
        document.querySelectorAll('#pePanel input[type=range][data-key]').forEach(inp => {
            const key = inp.dataset.key;
            inp.oninput = () => {
                state[key] = +inp.value;
                const lbl = document.querySelector(`[data-val="${key}"]`);
                if (lbl) lbl.textContent = inp.value;
                drawPreview();
            };
            inp.onchange = () => saveHistory();
        });
        document.querySelectorAll('#pePanel input[type=checkbox][data-key]').forEach(inp => {
            inp.onchange = () => {
                state[inp.dataset.key] = inp.checked;
                saveHistory(); drawPreview();
            };
        });
    }

    function updateInfo() {
        const el = document.getElementById('peInfo');
        if (el) el.textContent = `${state.previewW}×${state.previewH} preview · ${EXPORT_SIZE}px export`;
    }

    // ── Crop (CORRECT IMPLEMENTATION) ───────────────────────
    function applyCrop() {
        if (!state.cropRect) return;
        const r = state.cropRect;
        const c = state.previewCanvas;
        // Capture the current preview into a temp canvas
        const temp = document.createElement('canvas');
        temp.width = r.w; temp.height = r.h;
        temp.getContext('2d').drawImage(c, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        // Now this becomes the new source image
        const newImg = new Image();
        newImg.onload = () => {
            state.img = newImg;
            state.cropRect = null;
            state.rotation = 0; state.zoom = 1;
            state.offsetX = 0; state.offsetY = 0;
            // Reset the preview canvas to fit new image aspect
            resizePreview(newImg);
            saveHistory(); drawPreview();
        };
        newImg.src = temp.toDataURL('image/png');
    }

    // ── History ─────────────────────────────────────────────
    function snapshot() {
        return {
            imgSrc: state.img.src,           // data:URL — safe
            rotation: state.rotation,
            zoom: state.zoom,
            offsetX: state.offsetX,
            offsetY: state.offsetY,
            flipH: state.flipH, flipV: state.flipV,
            brightness: state.brightness,
            contrast: state.contrast,
            saturation: state.saturation,
            hue: state.hue, blur: state.blur,
            exposure: state.exposure,
            grayscale: state.grayscale,
            sepia: state.sepia, invert: state.invert,
            vignette: state.vignette,
            circle: state.circle, frame: state.frame,
            texts: JSON.parse(JSON.stringify(state.texts)),
            drawings: JSON.parse(JSON.stringify(state.drawings)),
        };
    }

    function saveHistory() {
        try {
            const snap = snapshot();
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snap);
            if (state.history.length > MAX_HISTORY) state.history.shift();
            state.historyIndex = state.history.length - 1;
        } catch(e) { /* ignore */ }
    }

    function restore(snap) {
        if (!snap) return;
        const img = new Image();
        img.onload = () => {
            state.img = img;
            Object.assign(state, {
                rotation: snap.rotation, zoom: snap.zoom,
                offsetX: snap.offsetX, offsetY: snap.offsetY,
                flipH: snap.flipH, flipV: snap.flipV,
                brightness: snap.brightness, contrast: snap.contrast,
                saturation: snap.saturation, hue: snap.hue, blur: snap.blur,
                exposure: snap.exposure,
                grayscale: snap.grayscale, sepia: snap.sepia, invert: snap.invert,
                vignette: snap.vignette, circle: snap.circle, frame: snap.frame,
                texts: snap.texts, drawings: snap.drawings,
                activeTextId: null,
            });
            resizePreview(img);
            drawPreview();
            renderPanel();
        };
        img.src = snap.imgSrc;
    }

    function undo() {
        if (state.historyIndex <= 0) return;
        state.historyIndex--;
        restore(state.history[state.historyIndex]);
    }

    function redo() {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex++;
        restore(state.history[state.historyIndex]);
    }

    // ── Preview sizing ──────────────────────────────────────
    function resizePreview(img) {
        const ratio = img.width / img.height;
        let w = Math.min(img.width, PREVIEW_MAX);
        let h = w / ratio;
        if (h > PREVIEW_MAX) { h = PREVIEW_MAX; w = h * ratio; }
        state.previewW = Math.round(w);
        state.previewH = Math.round(h);
        state.previewCanvas.width = state.previewW;
        state.previewCanvas.height = state.previewH;
    }

    // ── Wire events ─────────────────────────────────────────
    function wire() {
        const canvas = state.previewCanvas;
        const overlay = document.getElementById('photoEditorOverlay');

        document.querySelectorAll('.pe-tool').forEach(b => {
            b.onclick = () => {
                document.querySelectorAll('.pe-tool').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                state.activeTool = b.dataset.tool;
                state.cropRect = null;
                renderPanel(); drawPreview();
            };
        });

        document.getElementById('peUndo').onclick = undo;
        document.getElementById('peRedo').onclick = redo;
        document.getElementById('peReset').onclick = () => {
            const orig = state.img;
            const origFile = state.originalFile;
            resetState(orig);
            state.originalFile = origFile;
            resizePreview(orig);
            saveHistory(); drawPreview(); renderPanel();
        };

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);

            if (state.activeTool === 'crop') {
                state.dragging = 'crop';
                state.dragStart = { x, y };
                return;
            }
            if (state.activeTool === 'draw') {
                state.dragging = 'draw';
                state.drawing = {
                    points: [{ x: x / canvas.width, y: y / canvas.height }],
                    color: document.getElementById('peDrawColor')?.value || '#3b82f6',
                    size: +(document.getElementById('peDrawSize')?.value || 6),
                };
                return;
            }
            if (state.activeTool === 'text' || state.activeTool === 'sticker') {
                const hit = findTextAt(x / canvas.width, y / canvas.height);
                if (hit) {
                    state.activeTextId = hit.id;
                    state.dragging = 'text';
                    state.dragStart = { x: x / canvas.width, y: y / canvas.height, tx: hit.x, ty: hit.y };
                    renderPanel(); drawPreview();
                    return;
                }
            }
            state.dragging = 'pan';
            state.dragStart = { x: e.clientX, y: e.clientY,
                                ox: state.offsetX, oy: state.offsetY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!state.dragging) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);

            if (state.dragging === 'pan') {
                state.offsetX = state.dragStart.ox + (e.clientX - state.dragStart.x);
                state.offsetY = state.dragStart.oy + (e.clientY - state.dragStart.y);
                drawPreview();
            } else if (state.dragging === 'draw' && state.drawing) {
                state.drawing.points.push({ x: x / canvas.width, y: y / canvas.height });
                if (!state.drawings.includes(state.drawing)) state.drawings.push(state.drawing);
                drawPreview();
            } else if (state.dragging === 'crop') {
                const s = state.dragStart;
                let w = Math.abs(x - s.x), h = Math.abs(y - s.y);
                let left = Math.min(x, s.x), top = Math.min(y, s.y);
                if (state.aspect !== 'free') {
                    const [aw, ah] = state.aspect.split(':').map(Number);
                    const target = aw / ah;
                    if (w / h > target) w = h * target;
                    else h = w / target;
                    if (x < s.x) left = s.x - w;
                    if (y < s.y) top = s.y - h;
                }
                state.cropRect = { x: left, y: top, w, h };
                drawPreview();
            } else if (state.dragging === 'text') {
                const t = state.texts.find(t => t.id === state.activeTextId);
                if (t) {
                    const d = state.dragStart;
                    t.x = Math.max(0, Math.min(1, d.tx + (x / canvas.width - d.x)));
                    t.y = Math.max(0, Math.min(1, d.ty + (y / canvas.height - d.y)));
                    drawPreview();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (state.dragging === 'draw' || state.dragging === 'text') saveHistory();
            state.dragging = false;
            state.drawing = null;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            state.zoom = Math.max(0.3, Math.min(4, state.zoom - e.deltaY * 0.001));
            drawPreview();
        }, { passive: false });

        document.getElementById('peCancel').onclick = () => close(null);
        document.getElementById('peClose').onclick = () => close(null);
        document.getElementById('peApply').onclick = async () => {
            const file = await exportFile();
            close(file);
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close(null);
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
        });
    }

    function findTextAt(nx, ny) {
        for (let i = state.texts.length - 1; i >= 0; i--) {
            const t = state.texts[i];
            const size = t.isSticker ? t.size / state.previewW : t.size / 1024;
            if (Math.abs(nx - t.x) < size && Math.abs(ny - t.y) < size) return t;
        }
        return null;
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
   
    // ── Export (full resolution, all effects baked) ─────────
    function exportFile() {
        return new Promise((resolve) => {
            const out = document.createElement('canvas');
            // ✅ Keep ORIGINAL pixel dimensions — no downscale
            out.width  = state.img.naturalWidth  || state.img.width;
            out.height = state.img.naturalHeight || state.img.height;
            const W = out.width, H = out.height;
            const ctx = out.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            const offX = state.offsetX * (W / state.previewW);
            const offY = state.offsetY * (H / state.previewH);

            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.rotate(state.rotation * Math.PI / 180);
            if (state.flipH) ctx.scale(-1, 1);
            if (state.flipV) ctx.scale(1, -1);
            ctx.scale(state.zoom, state.zoom);
            ctx.translate(-W / 2 + offX, -H / 2 + offY);
            ctx.filter = filterString();
            ctx.drawImage(state.img, 0, 0, W, H);
            ctx.filter = 'none';
            ctx.restore();

            state.drawings.forEach(s => {
                if (s.points.length < 2) return;
                ctx.save();
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.size * (W / state.previewW);
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                s.points.forEach((p, i) => {
                    const x = p.x * W, y = p.y * H;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.restore();
            });

            state.texts.forEach(t => {
                ctx.save();
                const x = t.x * W, y = t.y * H;
                const px = t.isSticker ? t.size * (W / state.previewW) : t.size * W / 1024;
                ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${px}px ${t.font || 'Inter'}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = t.color;
                ctx.fillText(t.text, x, y);
                ctx.restore();
            });

            if (state.vignette > 0) {
                const g = ctx.createRadialGradient(W/2, H/2, W*.3, W/2, H/2, W*.75);
                g.addColorStop(0, 'rgba(0,0,0,0)');
                g.addColorStop(1, `rgba(0,0,0,${state.vignette/100})`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }

            if (state.circle) {
                ctx.globalCompositeOperation = 'destination-in';
                ctx.beginPath();
                ctx.arc(W/2, H/2, Math.min(W, H)/2 - 2, 0, Math.PI*2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }

            if (state.frame !== 'none') {
                if (state.frame === 'white' || state.frame === 'black') {
                    const bw = Math.min(W, H) * 0.04;
                    ctx.strokeStyle = state.frame === 'white' ? '#fff' : '#000';
                    ctx.lineWidth = bw;
                    ctx.strokeRect(bw/2, bw/2, W-bw, H-bw);
                } else if (state.frame === 'rounded') {
                    ctx.globalCompositeOperation = 'destination-in';
                    const r = Math.min(W, H) * 0.05;
                    ctx.beginPath();
                    ctx.moveTo(r, 0);
                    ctx.arcTo(W, 0, W, H, r);
                    ctx.arcTo(W, H, 0, H, r);
                    ctx.arcTo(0, H, 0, 0, r);
                    ctx.arcTo(0, 0, W, 0, r);
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalCompositeOperation = 'source-over';
                }
            }

            // ✅ Lossless PNG — no JPEG re-compression
            out.toBlob((blob) => {
                const name = `edited_${Date.now()}.png`;
                resolve(new File([blob], name, { type: 'image/png' }));
            }, 'image/png');
        });
    }

    function close(result) {
        const overlay = document.getElementById('photoEditorOverlay');
        overlay.classList.remove('open');
        document.body.classList.remove('modal-open');
        if (state.resolve) state.resolve(result);
        state.resolve = null;
    }

    // ── Open ────────────────────────────────────────────────
    function open(file) {
        return new Promise((resolve) => {
            const overlay = buildUI();
            overlay.classList.add('open');
            document.body.classList.add('modal-open');

            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                resetState(img);
                state.originalFile = file;
                state.touched = false;
                state.resolve = resolve;
                state.previewCanvas = document.getElementById('peCanvas');
                state.previewCtx = state.previewCanvas.getContext('2d');
                resizePreview(img);
                drawPreview();
                saveHistory();
                renderPanel();
                // Wire events only ONCE
                if (!overlay._wired) {
                    wire();
                    overlay._wired = true;
                }
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }

    return { open };
})();

window.PhotoEditor = PhotoEditor;
