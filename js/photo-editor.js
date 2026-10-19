/* ============================================================
   ADVANCED PHOTO EDITOR
   Features: Crop, Filters, Adjustments, Text, Draw, Stickers,
             Frames, Aspect Ratios, Undo/Redo, Rotate, Flip
   ============================================================ */

const PhotoEditor = (() => {
    const OUT_SIZE = 1200;
    const MAX_HISTORY = 40;

    let state = {
        img: null, canvas: null, ctx: null,
        rotation: 0, zoom: 1, offsetX: 0, offsetY: 0,
        brightness: 100, contrast: 100, saturation: 100,
        hue: 0, blur: 0, exposure: 100,
        grayscale: false, sepia: false, invert: false,
        vignette: 0, sharpen: 0,
        circle: false, frame: 'none',
        activeTool: 'adjust',           // adjust | crop | text | draw | filter
        aspect: 'free',                  // free | 1:1 | 4:3 | 16:9 | 3:2
        cropRect: null,
        texts: [],                        // {id, text, x, y, size, color, font, bold, italic}
        drawings: [],                     // {points:[{x,y}], color, size}
        activeTextId: null,
        drawing: null,
        history: [], historyIndex: -1,
        dragging: false, lastX: 0, lastY: 0,
        scale: 1,
    };

    // ---------- UI ----------
    function buildUI() {
        let overlay = document.getElementById('photoEditorOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'photoEditorOverlay';
        overlay.className = 'photo-editor-overlay';
        overlay.innerHTML = `
            <div class="photo-editor-panel pe-advanced">
                <div class="photo-editor-header">
                    <h3 id="peHeaderTitle"><i class="fas fa-magic"></i> Advanced Photo Editor</h3>
                    <div class="pe-header-actions">
                        <button class="pe-icon-btn" id="peUndo" title="Undo"><i class="fas fa-undo"></i></button>
                        <button class="pe-icon-btn" id="peRedo" title="Redo"><i class="fas fa-redo"></i></button>
                        <button class="photo-editor-close" id="peClose" type="button"><i class="fas fa-times"></i></button>
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
                            <canvas id="peCanvas" width="${OUT_SIZE}" height="${OUT_SIZE}"></canvas>
                            <div class="pe-stage-hint">Drag to move · Scroll to zoom</div>
                        </div>
                    </div>

                    <div class="pe-panel" id="pePanel">
                        <!-- filled by renderPanel() -->
                    </div>
                </div>

                <div class="photo-editor-footer">
                    <div class="pe-footer-left">
                        <button class="btn btn-outline btn-sm" id="peReset"><i class="fas fa-undo"></i> Reset All</button>
                        <span class="pe-info" id="peInfo"></span>
                    </div>
                    <div class="pe-footer-right">
                        <button class="btn btn-outline" id="peCancel">Cancel</button>
                        <button class="btn btn-primary" id="peApply"><i class="fas fa-check"></i> Apply</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // ---------- Panels ----------
    function renderPanel() {
        const panel = document.getElementById('pePanel');
        if (!panel) return;
        const tool = state.activeTool;

        if (tool === 'adjust') {
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
                    ${slider('sharpen', 'Sharpen', 0, 100, state.sharpen)}
                    <div class="pe-toggles">
                        <label class="pe-checkbox"><input type="checkbox" id="peGrayscale" ${state.grayscale?'checked':''}> Grayscale</label>
                        <label class="pe-checkbox"><input type="checkbox" id="peSepia" ${state.sepia?'checked':''}> Sepia</label>
                        <label class="pe-checkbox"><input type="checkbox" id="peInvert" ${state.invert?'checked':''}> Invert</label>
                    </div>
                </div>
                <div class="pe-panel-section">
                    <h4><i class="fas fa-shapes"></i> Shape</h4>
                    <label class="pe-checkbox"><input type="checkbox" id="peCircle" ${state.circle?'checked':''}> Circle mask</label>
                </div>
            `;
            bindPanel();
        }

        else if (tool === 'crop') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-crop-alt"></i> Aspect Ratio</h4>
                    <div class="pe-aspect-grid">
                        ${['free','1:1','4:3','3:2','16:9','9:16'].map(a =>
                            `<button class="pe-aspect-btn ${state.aspect===a?'active':''}" data-aspect="${a}">${a}</button>`
                        ).join('')}
                    </div>
                    <p class="pe-hint">Drag on canvas to define crop area.</p>
                    <div class="pe-row">
                        <button class="btn btn-outline btn-sm" id="peCropReset"><i class="fas fa-times"></i> Clear</button>
                        <button class="btn btn-primary btn-sm" id="peCropApply"><i class="fas fa-check"></i> Apply Crop</button>
                    </div>
                </div>
                <div class="pe-panel-section">
                    <h4><i class="fas fa-arrows-alt"></i> Transform</h4>
                    ${slider('rotation', 'Rotation', 0, 360, state.rotation)}
                    <div class="pe-row">
                        <button class="btn btn-outline btn-sm" id="peRotateL"><i class="fas fa-rotate-left"></i> -90°</button>
                        <button class="btn btn-outline btn-sm" id="peRotateR"><i class="fas fa-rotate-right"></i> +90°</button>
                        <button class="btn btn-outline btn-sm" id="peFlipH"><i class="fas fa-arrows-alt-h"></i> Flip H</button>
                        <button class="btn btn-outline btn-sm" id="peFlipV"><i class="fas fa-arrows-alt-v"></i> Flip V</button>
                    </div>
                </div>
            `;
            bindPanel();
            document.querySelectorAll('.pe-aspect-btn').forEach(b => {
                b.onclick = () => { state.aspect = b.dataset.aspect; state.cropRect = null; renderPanel(); draw(); };
            });
            document.getElementById('peRotateL').onclick = () => { state.rotation = (state.rotation - 90 + 360) % 360; saveHistory(); draw(); renderPanel(); };
            document.getElementById('peRotateR').onclick = () => { state.rotation = (state.rotation + 90) % 360; saveHistory(); draw(); renderPanel(); };
            document.getElementById('peFlipH').onclick = () => { state.flipH = !state.flipH; saveHistory(); draw(); };
            document.getElementById('peFlipV').onclick = () => { state.flipV = !state.flipV; saveHistory(); draw(); };
            document.getElementById('peCropReset').onclick = () => { state.cropRect = null; draw(); };
            document.getElementById('peCropApply').onclick = applyCrop;
        }

        else if (tool === 'filter') {
            const presets = [
                { name: 'Original', b:100, c:100, s:100, hue:0, sepia:false, gray:false, blur:0 },
                { name: 'Vivid',    b:110, c:120, s:150, hue:0, sepia:false, gray:false, blur:0 },
                { name: 'Vintage',  b:105, c:90,  s:70,  hue:0, sepia:true,  gray:false, blur:0 },
                { name: 'B&W',      b:105, c:110, s:0,   hue:0, sepia:false, gray:true,  blur:0 },
                { name: 'Cool',     b:100, c:105, s:110, hue:-15,sepia:false, gray:false, blur:0 },
                { name: 'Warm',     b:105, c:105, s:115, hue:15, sepia:false, gray:false, blur:0 },
                { name: 'Fade',     b:110, c:85,  s:80,  hue:0, sepia:false, gray:false, blur:0.3 },
                { name: 'Dramatic', b:95,  c:140, s:120, hue:0, sepia:false, gray:false, blur:0 },
                { name: 'Soft',     b:108, c:90,  s:105, hue:0, sepia:false, gray:false, blur:0.8 },
                { name: 'Retro',    b:105, c:95,  s:90,  hue:10, sepia:true, gray:false, blur:0.2 },
                { name: 'Cinema',   b:100, c:115, s:105, hue:-5, sepia:false, gray:false, blur:0 },
                { name: 'Neon',     b:115, c:135, s:170, hue:-20,sepia:false, gray:false, blur:0 },
            ];
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-magic"></i> Presets</h4>
                    <div class="pe-preset-grid">
                        ${presets.map((p, i) => `
                            <button class="pe-preset" data-preset="${i}">${p.name}</button>
                        `).join('')}
                    </div>
                </div>
            `;
            panel.querySelectorAll('.pe-preset').forEach(btn => {
                btn.onclick = () => {
                    const p = presets[+btn.dataset.preset];
                    state.brightness = p.b; state.contrast = p.c; state.saturation = p.s;
                    state.hue = p.hue; state.sepia = p.sepia; state.grayscale = p.gray;
                    state.blur = p.blur;
                    saveHistory(); draw();
                };
            });
        }

        else if (tool === 'text') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-font"></i> Add Text</h4>
                    <textarea id="peTextInput" rows="3" placeholder="Type your text here..."></textarea>
                    <div class="pe-row">
                        <label>Size <input type="range" id="peTextSize" min="12" max="200" value="48"></label>
                    </div>
                    <div class="pe-row">
                        <input type="color" id="peTextColor" value="#ffffff">
                        <select id="peTextFont">
                            <option value="Inter">Inter</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Arial">Arial</option>
                            <option value="Impact">Impact</option>
                            <option value="Courier New">Courier</option>
                        </select>
                    </div>
                    <div class="pe-toggles">
                        <label class="pe-checkbox"><input type="checkbox" id="peTextBold"> Bold</label>
                        <label class="pe-checkbox"><input type="checkbox" id="peTextItalic"> Italic</label>
                    </div>
                    <button class="btn btn-primary btn-sm" id="peAddText" style="margin-top:8px;">
                        <i class="fas fa-plus"></i> Add Text
                    </button>
                </div>
                <div class="pe-panel-section">
                    <h4>Layers (${state.texts.length})</h4>
                    <div class="pe-layers">
                        ${state.texts.map((t, i) => `
                            <div class="pe-layer ${state.activeTextId===t.id?'active':''}" data-id="${t.id}">
                                <span>${escapeHtml(t.text.slice(0,20))}</span>
                                <button class="pe-layer-del" data-del="${t.id}"><i class="fas fa-times"></i></button>
                            </div>
                        `).join('') || '<p class="pe-hint">No text layers yet.</p>'}
                    </div>
                </div>
            `;
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
                saveHistory(); draw(); renderPanel();
            };
            panel.querySelectorAll('.pe-layer').forEach(el => {
                el.onclick = (e) => {
                    if (e.target.closest('.pe-layer-del')) return;
                    state.activeTextId = el.dataset.id;
                    renderPanel();
                };
            });
            panel.querySelectorAll('.pe-layer-del').forEach(b => {
                b.onclick = (e) => {
                    e.stopPropagation();
                    state.texts = state.texts.filter(t => t.id !== b.dataset.del);
                    if (state.activeTextId === b.dataset.del) state.activeTextId = null;
                    saveHistory(); draw(); renderPanel();
                };
            });
        }

        else if (tool === 'draw') {
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-pen"></i> Draw</h4>
                    <div class="pe-row">
                        <input type="color" id="peDrawColor" value="#3b82f6">
                        <label>Size <input type="range" id="peDrawSize" min="1" max="40" value="6"></label>
                    </div>
                    <p class="pe-hint">Click and drag on the image to draw.</p>
                    <div class="pe-row">
                        <button class="btn btn-outline btn-sm" id="peClearDraw"><i class="fas fa-eraser"></i> Clear All</button>
                    </div>
                </div>
                <div class="pe-panel-section">
                    <h4>Strokes (${state.drawings.length})</h4>
                </div>
            `;
            bindPanel();
            document.getElementById('peClearDraw').onclick = () => {
                state.drawings = [];
                saveHistory(); draw(); renderPanel();
            };
        }

        else if (tool === 'sticker') {
            const stickers = ['😀','😎','🔥','❤️','⭐','✨','🎉','👍','💯','🚀','🌈','🎨','📷','💎','🌟','👑','🏆','🎯','💡','⚡','🌸','🍕','☕','🐱','🐶','🦄','🌊','🌙','☀️','🍀'];
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-smile"></i> Stickers</h4>
                    <div class="pe-sticker-grid">
                        ${stickers.map(s => `<button class="pe-sticker" data-sticker="${s}">${s}</button>`).join('')}
                    </div>
                </div>
                <div class="pe-panel-section">
                    <h4>Placed (${state.texts.filter(t=>t.isSticker).length})</h4>
                </div>
            `;
            panel.querySelectorAll('.pe-sticker').forEach(b => {
                b.onclick = () => {
                    const t = {
                        id: 'stk_' + Date.now(),
                        text: b.dataset.sticker,
                        isSticker: true,
                        x: 0.5, y: 0.5, size: 96,
                        color: '#fff', font: 'Arial', bold: false, italic: false
                    };
                    state.texts.push(t);
                    state.activeTextId = t.id;
                    saveHistory(); draw();
                };
            });
        }

        else if (tool === 'frame') {
            const frames = [
                { id: 'none', label: 'None' },
                { id: 'white', label: 'White Border' },
                { id: 'black', label: 'Black Border' },
                { id: 'polaroid', label: 'Polaroid' },
                { id: 'rounded', label: 'Rounded' },
                { id: 'gold', label: 'Gold' },
                { id: 'shadow', label: 'Shadow' },
            ];
            panel.innerHTML = `
                <div class="pe-panel-section">
                    <h4><i class="fas fa-border-all"></i> Frame Style</h4>
                    <div class="pe-frame-grid">
                        ${frames.map(f => `
                            <button class="pe-frame-btn ${state.frame===f.id?'active':''}" data-frame="${f.id}">${f.label}</button>
                        `).join('')}
                    </div>
                </div>
            `;
            panel.querySelectorAll('.pe-frame-btn').forEach(b => {
                b.onclick = () => { state.frame = b.dataset.frame; saveHistory(); draw(); renderPanel(); };
            });
        }
    }

    function slider(key, label, min, max, val) {
        return `<label class="pe-slider">
            <span>${label}</span>
            <input type="range" data-key="${key}" min="${min}" max="${max}" value="${val}">
            <span class="pe-slider-val" id="pe-val-${key}">${val}</span>
        </label>`;
    }

    function bindPanel() {
        document.querySelectorAll('#pePanel input[type=range]').forEach(inp => {
            const key = inp.dataset.key;
            if (!key) return;
            inp.oninput = () => {
                state[key] = +inp.value;
                const lbl = document.getElementById('pe-val-' + key);
                if (lbl) lbl.textContent = inp.value;
                draw();
            };
            inp.onchange = () => saveHistory();
        });
        document.querySelectorAll('#pePanel input[type=checkbox]').forEach(inp => {
            inp.onchange = () => {
                const key = inp.id.replace(/^pe/, '').replace(/^./, c => c.toLowerCase());
                state[key === 'grayScale' ? 'grayscale' : key] = inp.checked;
                draw(); saveHistory();
            };
        });
    }

    // ---------- Draw ----------
    function getFilterString() {
        let f = `brightness(${state.brightness * state.exposure / 100}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
        if (state.hue) f += ` hue-rotate(${state.hue}deg)`;
        if (state.blur) f += ` blur(${state.blur}px)`;
        if (state.grayscale) f += ' grayscale(100%)';
        if (state.sepia) f += ' sepia(100%)';
        if (state.invert) f += ' invert(100%)';
        return f;
    }

    function draw() {
        const canvas = state.canvas;
        const ctx = state.ctx;
        if (!canvas || !ctx || !state.img) return;
        const size = canvas.width;

        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((state.rotation * Math.PI) / 180);
        if (state.flipH) ctx.scale(-1, 1);
        if (state.flipV) ctx.scale(1, -1);
        ctx.scale(state.zoom, state.zoom);
        ctx.translate(-size / 2 + state.offsetX, -size / 2 + state.offsetY);

        ctx.filter = getFilterString();

        const iw = state.img.width, ih = state.img.height;
        const scale = Math.max(size / iw, size / ih);
        const w = iw * scale, h = ih * scale;
        ctx.drawImage(state.img, (size - w) / 2, (size - h) / 2, w, h);
        ctx.restore();

        // Sharpen pass (approximate with contrast on overlay)
        if (state.sharpen > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = state.sharpen / 500;
            ctx.filter = 'contrast(200%)';
            ctx.drawImage(canvas, 0, 0);
            ctx.restore();
        }

        // Vignette
        if (state.vignette > 0) {
            const grad = ctx.createRadialGradient(size/2, size/2, size*0.3, size/2, size/2, size*0.75);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, `rgba(0,0,0,${state.vignette/100})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
        }

        // Draw strokes
        state.drawings.forEach(stroke => {
            if (stroke.points.length < 2) return;
            ctx.save();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            stroke.points.forEach((p, i) => {
                const x = p.x * size, y = p.y * size;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        });

        // Draw text/stickers
        state.texts.forEach(t => {
            ctx.save();
            const x = t.x * size, y = t.y * size;
            ctx.font = `${t.italic?'italic ':''}${t.bold?'bold ':''}${t.isSticker? t.size : t.size * size / 1024}px ${t.font}`;
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
                const pad = 6;
                const w = m.width, h = t.isSticker ? t.size : t.size * size / 1024;
                ctx.strokeRect(x - w/2 - pad, y - h/2 - pad, w + pad*2, h + pad*2);
            }
            ctx.restore();
        });

        // Circle mask
        if (state.circle) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-in';
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }

        // Frame
        applyFrame(ctx, size);

        // Crop overlay
        if (state.cropRect && state.activeTool === 'crop') {
            const r = state.cropRect;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, size, size);
            ctx.clearRect(r.x, r.y, r.w, r.h);
            ctx.drawImage(canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            ctx.restore();
        }
    }

    function applyFrame(ctx, size) {
        if (state.frame === 'none') return;
        const f = state.frame;
        ctx.save();
        if (f === 'white' || f === 'black' || f === 'gold') {
            const color = f === 'white' ? '#fff' : f === 'black' ? '#000' : '#d4af37';
            const bw = size * 0.04;
            ctx.strokeStyle = color;
            ctx.lineWidth = bw;
            ctx.strokeRect(bw/2, bw/2, size - bw, size - bw);
        } else if (f === 'polaroid') {
            ctx.fillStyle = '#fff';
            const pad = size * 0.06;
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#0a0e17';
            const inner = size - pad * 2;
            // redraw image inside — already drawn; just white border
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, size, pad);
            ctx.fillRect(0, size - pad * 1.8, size, pad * 1.8);
            ctx.fillRect(0, 0, pad, size);
            ctx.fillRect(size - pad, 0, pad, size);
        } else if (f === 'rounded') {
            ctx.globalCompositeOperation = 'destination-in';
            const r = size * 0.05;
            roundRect(ctx, 0, 0, size, size, r);
            ctx.fill();
        } else if (f === 'shadow') {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.fillRect(size*0.05, size*0.05, size*0.9, size*0.9);
        }
        ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ---------- Crop ----------
    function applyCrop() {
        if (!state.cropRect) return;
        const r = state.cropRect;
        const tmp = document.createElement('canvas');
        tmp.width = r.w; tmp.height = r.h;
        tmp.getContext('2d').drawImage(state.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

        const newImg = new Image();
        newImg.onload = () => {
            state.img = newImg;
            state.cropRect = null;
            state.rotation = 0;
            state.zoom = 1;
            state.offsetX = 0; state.offsetY = 0;
            saveHistory(); draw();
        };
        newImg.src = tmp.toDataURL();
    }

    // ---------- History ----------
    function saveHistory() {
        if (!state.canvas) return;
        try {
            const snap = {
                imgData: state.canvas.toDataURL('image/jpeg', 0.7),
                texts: JSON.parse(JSON.stringify(state.texts)),
                drawings: JSON.parse(JSON.stringify(state.drawings)),
                filters: {
                    brightness: state.brightness, contrast: state.contrast,
                    saturation: state.saturation, hue: state.hue,
                    blur: state.blur, exposure: state.exposure,
                    grayscale: state.grayscale, sepia: state.sepia, invert: state.invert,
                    vignette: state.vignette, sharpen: state.sharpen,
                    circle: state.circle, frame: state.frame,
                }
            };
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snap);
            if (state.history.length > MAX_HISTORY) state.history.shift();
            state.historyIndex = state.history.length - 1;
        } catch(e) {}
    }

    function undo() {
        if (state.historyIndex <= 0) return;
        state.historyIndex--;
        restoreSnapshot(state.history[state.historyIndex]);
    }
    function redo() {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex++;
        restoreSnapshot(state.history[state.historyIndex]);
    }
    function restoreSnapshot(snap) {
        if (!snap) return;
        state.texts = JSON.parse(JSON.stringify(snap.texts || []));
        state.drawings = JSON.parse(JSON.stringify(snap.drawings || []));
        Object.assign(state, snap.filters || {});
        const img = new Image();
        img.onload = () => {
            state.img = img;
            draw();
            renderPanel();
        };
        img.src = snap.imgData;
    }

    // ---------- Event wiring ----------
    function wireEvents() {
        const canvas = state.canvas;
        const overlay = document.getElementById('photoEditorOverlay');

        // Tools
        document.querySelectorAll('.pe-tool').forEach(b => {
            b.onclick = () => {
                document.querySelectorAll('.pe-tool').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                state.activeTool = b.dataset.tool;
                state.cropRect = null;
                renderPanel();
                draw();
            };
        });

        // Undo/redo
        document.getElementById('peUndo').onclick = undo;
        document.getElementById('peRedo').onclick = redo;

        // Reset
        document.getElementById('peReset').onclick = () => {
            reset();
            saveHistory();
            renderPanel();
            draw();
        };

        // Canvas interaction
        canvas.onmousedown = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            if (state.activeTool === 'crop') {
                state.dragging = 'crop';
                state.cropStart = { x: x * canvas.width, y: y * canvas.height };
                return;
            }
            if (state.activeTool === 'draw') {
                state.dragging = 'draw';
                state.drawing = {
                    points: [{ x, y }],
                    color: document.getElementById('peDrawColor')?.value || '#3b82f6',
                    size: +(document.getElementById('peDrawSize')?.value || 6),
                };
                return;
            }
            if (state.activeTool === 'text' || state.activeTool === 'sticker') {
                const hit = findTextAt(x * canvas.width, y * canvas.height);
                if (hit) {
                    state.activeTextId = hit.id;
                    state.dragging = 'text';
                    state.dragTextStart = { x, y, tx: hit.x, ty: hit.y };
                    renderPanel();
                    draw();
                    return;
                }
            }
            state.dragging = 'pan';
            state.lastX = e.clientX; state.lastY = e.clientY;
        };

        window.addEventListener('mousemove', (e) => {
            if (!state.dragging) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            if (state.dragging === 'pan') {
                state.offsetX += e.clientX - state.lastX;
                state.offsetY += e.clientY - state.lastY;
                state.lastX = e.clientX; state.lastY = e.clientY;
                draw();
            } else if (state.dragging === 'draw' && state.drawing) {
                state.drawing.points.push({ x, y });
                const c = state.drawing;
                state.drawings.push(c);
                state.drawing = { ...c, points: [...c.points] };
                state.drawings.pop();
                state.drawings.push(state.drawing);
                draw();
            } else if (state.dragging === 'crop') {
                const s = state.cropStart;
                const ex = x * canvas.width, ey = y * canvas.height;
                state.cropRect = {
                    x: Math.min(s.x, ex), y: Math.min(s.y, ey),
                    w: Math.abs(ex - s.x), h: Math.abs(ey - s.y)
                };
                // enforce aspect ratio
                if (state.aspect !== 'free') {
                    const [aw, ah] = state.aspect.split(':').map(Number);
                    const targetRatio = aw / ah;
                    const curRatio = state.cropRect.w / state.cropRect.h;
                    if (curRatio > targetRatio) state.cropRect.w = state.cropRect.h * targetRatio;
                    else state.cropRect.h = state.cropRect.w / targetRatio;
                }
                draw();
            } else if (state.dragging === 'text') {
                const t = state.texts.find(t => t.id === state.activeTextId);
                if (t) {
                    const d = state.dragTextStart;
                    t.x = d.tx + (x - d.x);
                    t.y = d.ty + (y - d.y);
                    draw();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (state.dragging === 'draw') saveHistory();
            if (state.dragging === 'text') saveHistory();
            state.dragging = false;
            state.drawing = null;
        });

        // Scroll zoom
        canvas.onwheel = (e) => {
            e.preventDefault();
            state.zoom = Math.max(0.3, Math.min(4, state.zoom - e.deltaY * 0.001));
            draw();
        };

        // Footer actions
        document.getElementById('peCancel').onclick = () => close(null);
        document.getElementById('peClose').onclick = () => close(null);
        document.getElementById('peApply').onclick = async () => {
            const file = await exportFile(state._originalFile);
            close(file);
        };

        // Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close(null);
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
        });
    }

    function findTextAt(cx, cy) {
        const size = state.canvas.width;
        for (let i = state.texts.length - 1; i >= 0; i--) {
            const t = state.texts[i];
            const x = t.x * size, y = t.y * size;
            const s = t.isSticker ? t.size : t.size * size / 1024;
            if (Math.abs(cx - x) < s && Math.abs(cy - y) < s) return t;
        }
        return null;
    }

    // ---------- Utilities ----------
    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function reset() {
        state.rotation = 0; state.zoom = 1;
        state.offsetX = 0; state.offsetY = 0;
        state.brightness = 100; state.contrast = 100; state.saturation = 100;
        state.hue = 0; state.blur = 0; state.exposure = 100;
        state.grayscale = false; state.sepia = false; state.invert = false;
        state.vignette = 0; state.sharpen = 0;
        state.circle = false; state.frame = 'none';
        state.texts = []; state.drawings = [];
        state.activeTextId = null; state.cropRect = null;
        state.flipH = false; state.flipV = false;
    }

    function exportFile(originalFile) {
        return new Promise((resolve) => {
            const ext = (originalFile.type || '').includes('png') ? 'png' : 'jpg';
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            state.canvas.toBlob((blob) => {
                const name = `edited_${Date.now()}.${ext}`;
                resolve(new File([blob], name, { type: mime }));
            }, mime, 0.95);
        });
    }

    function close(result) {
        const overlay = document.getElementById('photoEditorOverlay');
        overlay.classList.remove('open');
        document.body.classList.remove('modal-open');
        if (state._url) URL.revokeObjectURL(state._url);
        state._resolve(result);
    }

    // ---------- Open ----------
    function open(file) {
        reset();
        return new Promise((resolve) => {
            state._resolve = resolve;
            state._originalFile = file;

            const overlay = buildUI();
            overlay.classList.add('open');
            document.body.classList.add('modal-open');

            state.canvas = document.getElementById('peCanvas');
            state.ctx = state.canvas.getContext('2d');

            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                state.img = img;
                draw();
                saveHistory();
                renderPanel();
                wireEvents();
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
            state._url = url;
        });
    }

    return { open };
})();

window.PhotoEditor = PhotoEditor;
