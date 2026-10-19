/* ============================================================
   PHOTO EDITOR — crop / circle / contrast / brightness / rotate
   Usage: PhotoEditor.open(file).then(blob => ...)
   ============================================================ */
const PhotoEditor = (() => {
    let state = {
        img: null, canvas: null, ctx: null,
        rotation: 0, zoom: 1, offsetX: 0, offsetY: 0,
        brightness: 100, contrast: 100, circle: false,
        dragging: false, lastX: 0, lastY: 0,
    };
    const OUT_SIZE = 512;

    function buildUI() {
        let overlay = document.getElementById('photoEditorOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'photoEditorOverlay';
        overlay.className = 'photo-editor-overlay';
        overlay.innerHTML = `
            <div class="photo-editor-panel">
                <div class="photo-editor-header">
                    <h3>Edit Photo</h3>
                    <button class="photo-editor-close" id="peClose" type="button"><i class="fas fa-times"></i></button>
                </div>
                <div class="photo-editor-body">
                    <div class="photo-editor-stage">
                        <canvas id="peCanvas" width="480" height="480"></canvas>
                        <div class="photo-editor-hint">Drag to reposition · Scroll to zoom</div>
                    </div>
                    <div class="photo-editor-controls">
                        <label>Brightness <input type="range" id="peBrightness" min="50" max="150" value="100"></label>
                        <label>Contrast <input type="range" id="peContrast" min="50" max="150" value="100"></label>
                        <label>Zoom <input type="range" id="peZoom" min="100" max="300" value="100"></label>
                        <label>Rotate <input type="range" id="peRotate" min="0" max="360" value="0"></label>
                        <label class="pe-checkbox">
                            <input type="checkbox" id="peCircle"> Circle mask
                        </label>
                        <button class="btn btn-outline btn-sm" id="peReset" type="button">
                            <i class="fas fa-undo"></i> Reset
                        </button>
                    </div>
                </div>
                <div class="photo-editor-footer">
                    <button class="btn btn-outline" id="peCancel" type="button">Cancel</button>
                    <button class="btn btn-primary" id="peApply" type="button">
                        <i class="fas fa-check"></i> Apply &amp; Upload
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function reset() {
        state.rotation = 0;
        state.zoom = 1;
        state.offsetX = 0;
        state.offsetY = 0;
        state.brightness = 100;
        state.contrast = 100;
        state.circle = false;
    }

    function draw() {
        const { canvas, ctx, img } = state;
        if (!img || !ctx) return;
        const size = canvas.width;
        ctx.clearRect(0, 0, size, size);

        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((state.rotation * Math.PI) / 180);
        ctx.scale(state.zoom, state.zoom);
        ctx.translate(-size / 2 + state.offsetX, -size / 2 + state.offsetY);

        ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%)`;
        const iw = img.width, ih = img.height;
        const scale = Math.max(size / iw, size / ih);
        const w = iw * scale, h = ih * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        ctx.restore();

        if (state.circle) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-in';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = 'rgba(59,130,246,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(59,130,246,0.6)';
            ctx.lineWidth = 2;
            const m = 10, L = 22;
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
            const out = document.createElement('canvas');
            out.width = out.height = OUT_SIZE;
            const octx = out.getContext('2d');
            octx.drawImage(state.canvas, 0, 0, state.canvas.width, state.canvas.height, 0, 0, OUT_SIZE, OUT_SIZE);
            out.toBlob((blob) => {
                const ext = (originalFile.type || '').includes('png') ? 'png' : 'jpg';
                const name = `edited_${Date.now()}.${ext}`;
                resolve(new File([blob], name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.92);
        });
    }

    function open(file) {
        reset();
        return new Promise((resolve, reject) => {
            const overlay = buildUI();
            overlay.classList.add('open');
            document.body.classList.add('modal-open');

            const canvas = document.getElementById('peCanvas');
            const ctx = canvas.getContext('2d');
            state.canvas = canvas;
            state.ctx = ctx;

            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                state.img = img;
                draw();
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
            img.src = url;
            state._url = url;

            const close = (result) => {
                overlay.classList.remove('open');
                document.body.classList.remove('modal-open');
                URL.revokeObjectURL(state._url);
                state.img = null;
                resolve(result);
            };

            const bright = document.getElementById('peBrightness');
            const contrast = document.getElementById('peContrast');
            const zoom = document.getElementById('peZoom');
            const rotate = document.getElementById('peRotate');
            const circle = document.getElementById('peCircle');

            bright.oninput = () => { state.brightness = +bright.value; draw(); };
            contrast.oninput = () => { state.contrast = +contrast.value; draw(); };
            zoom.oninput = () => { state.zoom = +zoom.value / 100; draw(); };
            rotate.oninput = () => { state.rotation = +rotate.value; draw(); };
            circle.onchange = () => { state.circle = circle.checked; draw(); };

            document.getElementById('peReset').onclick = () => {
                reset();
                bright.value = 100; contrast.value = 100; zoom.value = 100; rotate.value = 0;
                circle.checked = false;
                draw();
            };

            document.getElementById('peCancel').onclick = () => close(null);
            document.getElementById('peClose').onclick = () => close(null);

            document.getElementById('peApply').onclick = async () => {
                const f = await exportFile(file);
                close(f);
            };

            canvas.onmousedown = (e) => {
                state.dragging = true;
                state.lastX = e.clientX; state.lastY = e.clientY;
            };
            window.onmouseup = () => state.dragging = false;
            canvas.onmousemove = (e) => {
                if (!state.dragging) return;
                state.offsetX += e.clientX - state.lastX;
                state.offsetY += e.clientY - state.lastY;
                state.lastX = e.clientX; state.lastY = e.clientY;
                draw();
            };
            canvas.onwheel = (e) => {
                e.preventDefault();
                state.zoom = Math.max(1, Math.min(3, state.zoom - e.deltaY * 0.001));
                zoom.value = Math.round(state.zoom * 100);
                draw();
            };
            canvas.ontouchstart = (e) => {
                const t = e.touches[0];
                state.dragging = true; state.lastX = t.clientX; state.lastY = t.clientY;
            };
            canvas.ontouchmove = (e) => {
                if (!state.dragging) return;
                e.preventDefault();
                const t = e.touches[0];
                state.offsetX += t.clientX - state.lastX;
                state.offsetY += t.clientY - state.lastY;
                state.lastX = t.clientX; state.lastY = t.clientY;
                draw();
            };
            canvas.ontouchend = () => state.dragging = false;
        });
    }

    return { open };
})();

window.PhotoEditor = PhotoEditor;
