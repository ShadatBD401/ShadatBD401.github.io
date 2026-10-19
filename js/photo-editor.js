const PhotoEditor = (() => {
    let state = {
        img: null, canvas: null, ctx: null,
        rotation: 0, zoom: 1, offsetX: 0, offsetY: 0,
        brightness: 100, contrast: 100, saturation: 100, 
        circle: false, grayscale: false, sepia: false,
        dragging: false, lastX: 0, lastY: 0,
    };
    // Using 1024x1024 to prevent blurriness
    const OUT_SIZE = 1024;

    function buildUI() {
        let overlay = document.getElementById('photoEditorOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'photoEditorOverlay';
        overlay.className = 'photo-editor-overlay';
        overlay.innerHTML = `
            <div class="photo-editor-panel">
                <div class="photo-editor-header">
                    <h3 id="peHeaderTitle">Edit Photo</h3>
                    <button class="photo-editor-close" id="peClose" type="button"><i class="fas fa-times"></i></button>
                </div>
                
                <!-- MAIN EDITOR VIEW -->
                <div class="photo-editor-body" id="peMainView">
                    <div class="photo-editor-stage">
                        <canvas id="peCanvas" width="1024" height="1024"></canvas>
                        <div class="photo-editor-hint">Drag image to reposition · Scroll to zoom</div>
                    </div>
                    <div class="photo-editor-controls">
                        <label>Brightness <input type="range" id="peBrightness" min="50" max="150" value="100"></label>
                        <label>Contrast <input type="range" id="peContrast" min="50" max="150" value="100"></label>
                        <label>Saturation <input type="range" id="peSaturation" min="0" max="200" value="100"></label>
                        <label>Zoom <input type="range" id="peZoom" min="100" max="300" value="100"></label>
                        <label>Rotate <input type="range" id="peRotate" min="0" max="360" value="0"></label>
                        
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <label class="pe-checkbox"><input type="checkbox" id="peGrayscale"> Grayscale</label>
                            <label class="pe-checkbox"><input type="checkbox" id="peSepia"> Sepia</label>
                        </div>
                        <label class="pe-checkbox"><input type="checkbox" id="peCircle"> Circle mask</label>
                        
                        <button class="btn btn-outline btn-sm" id="peReset" type="button" style="margin-top:10px;">
                            <i class="fas fa-undo"></i> Reset Filters
                        </button>
                    </div>
                </div>

                <!-- PREVIEW VIEW -->
                <div class="photo-editor-preview-view" id="pePreviewView" style="display:none;">
                    <p style="text-align:center; color:var(--text-secondary); margin-bottom:15px;">Preview</p>
                    <div class="photo-editor-stage" style="background: var(--bg-primary); border-radius: 50%; width: 300px; height: 300px; margin: 0 auto; overflow: hidden; border: 4px solid var(--border-color);">
                        <canvas id="pePreviewCanvas" width="300" height="300" style="border:none; border-radius:0;"></canvas>
                    </div>
                </div>

                <div class="photo-editor-footer">
                    <button class="btn btn-outline" id="peCancel" type="button">Cancel</button>
                    <button class="btn btn-outline" id="peShowPreview" type="button">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                    <button class="btn btn-primary" id="peApply" type="button" id="peApplyBtn">
                        <i class="fas fa-check"></i> Apply &amp; Upload
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function reset() {
        state.rotation = 0; state.zoom = 1; state.offsetX = 0; state.offsetY = 0;
        state.brightness = 100; state.contrast = 100; state.saturation = 100;
        state.circle = false; state.grayscale = false; state.sepia = false;
    }

    function getFilterString() {
        let filters = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
        if (state.grayscale) filters += ' grayscale(100%)';
        if (state.sepia) filters += ' sepia(100%)';
        return filters;
    }

    function draw(targetCanvas, isPreview = false) {
        const canvas = targetCanvas || state.canvas;
        const ctx = canvas.getContext('2d');
        if (!state.img || !ctx) return;
        
        const size = canvas.width;
        ctx.clearRect(0, 0, size, size);

        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((state.rotation * Math.PI) / 180);
        // If preview, zoom out slightly to fit
        const currentZoom = isPreview ? (state.zoom * (size/1024)) : state.zoom;
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-size / 2 + (state.offsetX * (size/1024)), -size / 2 + (state.offsetY * (size/1024)));

        ctx.filter = getFilterString();
        
        // Calculate cover scale
        const iw = state.img.width, ih = state.img.height;
        const scale = Math.max(size / iw, size / ih);
        const w = iw * scale, h = ih * scale;
        
        ctx.drawImage(state.img, (size - w) / 2, (size - h) / 2, w, h);
        ctx.restore();

        if (state.circle) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-in';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            if (!isPreview) {
                ctx.strokeStyle = 'rgba(59,130,246,0.7)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (!isPreview) {
            ctx.strokeStyle = 'rgba(59,130,246,0.6)';
            ctx.lineWidth = 2;
            const m = 15, L = 30;
            ctx.beginPath();
            ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
            ctx.moveTo(size - m - L, m); ctx.lineTo(size - m, m); ctx.lineTo(size - m, m + L);
            ctx.moveTo(m, size - m - L); ctx.lineTo(m, size - m); ctx.lineTo(m + L, size - m);
            ctx.moveTo(size - m - L, size - m); ctx.lineTo(size - m, size - m); ctx.lineTo(size - m, size - m - L);
            ctx.stroke();
        }
    }

    function exportFile(originalFile) {
        return new Promise((resolve) => {
            // We already have the 1024x1024 canvas, just export it
            state.canvas.toBlob((blob) => {
                const ext = (originalFile.type || '').includes('png') ? 'png' : 'jpg';
                const name = `edited_${Date.now()}.${ext}`;
                resolve(new File([blob], name, { type: 'image/jpeg', quality: 0.95 }));
            }, 'image/jpeg', 0.95); // 0.95 quality keeps it crisp
        });
    }

    function open(file) {
        reset();
        return new Promise((resolve, reject) => {
            const overlay = buildUI();
            overlay.classList.add('open');
            document.body.classList.add('modal-open');

            const canvas = document.getElementById('peCanvas');
            const previewCanvas = document.getElementById('pePreviewCanvas');
            state.canvas = canvas;
            state.ctx = canvas.getContext('2d');

            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => { state.img = img; draw(); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
            img.src = url;
            state._url = url;

            const close = (result) => {
                overlay.classList.remove('open');
                document.body.classList.remove('modal-open');
                URL.revokeObjectURL(state._url);
                state.img = null;
                document.getElementById('peMainView').style.display = 'grid';
                document.getElementById('pePreviewView').style.display = 'none';
                resolve(result);
            };

            // UI Elements
            const bright = document.getElementById('peBrightness');
            const contrast = document.getElementById('peContrast');
            const saturation = document.getElementById('peSaturation');
            const zoom = document.getElementById('peZoom');
            const rotate = document.getElementById('peRotate');
            const circle = document.getElementById('peCircle');
            const grayscale = document.getElementById('peGrayscale');
            const sepia = document.getElementById('peSepia');

            const updateAll = () => { draw(); };

            bright.oninput = () => { state.brightness = +bright.value; updateAll(); };
            contrast.oninput = () => { state.contrast = +contrast.value; updateAll(); };
            saturation.oninput = () => { state.saturation = +saturation.value; updateAll(); };
            zoom.oninput = () => { state.zoom = +zoom.value / 100; updateAll(); };
            rotate.oninput = () => { state.rotation = +rotate.value; updateAll(); };
            circle.onchange = () => { state.circle = circle.checked; updateAll(); };
            grayscale.onchange = () => { state.grayscale = grayscale.checked; updateAll(); };
            sepia.onchange = () => { state.sepia = sepia.checked; updateAll(); };

            document.getElementById('peReset').onclick = () => {
                reset();
                bright.value = 100; contrast.value = 100; saturation.value = 100; 
                zoom.value = 100; rotate.value = 0;
                circle.checked = false; grayscale.checked = false; sepia.checked = false;
                updateAll();
            };

            // Preview Logic
            const btnPreview = document.getElementById('peShowPreview');
            btnPreview.onclick = () => {
                const mainView = document.getElementById('peMainView');
                const prevView = document.getElementById('pePreviewView');
                
                if (prevView.style.display === 'none') {
                    draw(previewCanvas, true);
                    mainView.style.display = 'none';
                    prevView.style.display = 'block';
                    btnPreview.innerHTML = '<i class="fas fa-edit"></i> Back to Edit';
                    document.getElementById('peHeaderTitle').textContent = 'Preview';
                } else {
                    mainView.style.display = 'grid';
                    prevView.style.display = 'none';
                    btnPreview.innerHTML = '<i class="fas fa-eye"></i> Preview';
                    document.getElementById('peHeaderTitle').textContent = 'Edit Photo';
                }
            };

            document.getElementById('peCancel').onclick = () => close(null);
            document.getElementById('peClose').onclick = () => close(null);

            document.getElementById('peApply').onclick = async () => {
                const f = await exportFile(file);
                close(f);
            };

            // Drag Logic
            canvas.onmousedown = (e) => { state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY; };
            window.onmouseup = () => state.dragging = false;
            canvas.onmousemove = (e) => {
                if (!state.dragging) return;
                state.offsetX += e.clientX - state.lastX;
                state.offsetY += e.clientY - state.lastY;
                state.lastX = e.clientX; state.lastY = e.clientY;
                draw();
            };
            // Scroll Zoom
            canvas.onwheel = (e) => {
                e.preventDefault();
                state.zoom = Math.max(1, Math.min(3, state.zoom - e.deltaY * 0.001));
                zoom.value = Math.round(state.zoom * 100);
                draw();
            };
        });
    }

    return { open };
})();

window.PhotoEditor = PhotoEditor;
