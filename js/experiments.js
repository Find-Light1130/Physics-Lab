function getControlPoints(x0, y0, x1, y1, x2, y2, t) {
    const d01 = Math.hypot(x1 - x0, y1 - y0);
    const d12 = Math.hypot(x2 - x1, y2 - y1);
    const fa = t * d01 / (d01 + d12);
    const fb = t * d12 / (d01 + d12);
    return { cp1x: x1 - fa * (x2 - x0), cp1y: y1 - fa * (y2 - y0), cp2x: x1 + fb * (x2 - x0), cp2y: y1 + fb * (y2 - y0) };
}

// ==================== 【核心修复】图表绘制引擎 ====================
function drawLineChart(c, canv, xData, yData, color) {
    c.clearRect(0, 0, canv.width, canv.height);
    if (xData.length < 2) return;
    c.lineJoin = 'round'; c.lineCap = 'round'; c.imageSmoothingEnabled = true;
    const isDark = document.body.classList.contains('dark');

    // 【修复】强制 Y 轴以 0 为中心上下对称，解决图像被压在最底部或最顶部的问题
    let maxAbs = Math.max(...yData.map(v => Math.abs(v)), 1);
    let range = maxAbs * 2 + maxAbs * 0.2; // 上下两端各留 10% 的视觉边距
    let minData = -range / 2;
    let maxData = range / 2;

    const padding = 6, w = canv.width - padding * 2, h = canv.height - padding * 2;
    const zeroY = canv.height - padding - ((0 - minData) / (maxData - minData)) * h;

    c.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    c.lineWidth = 1; c.beginPath(); c.moveTo(padding, padding); c.lineTo(padding, canv.height - padding); c.stroke();
    c.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'; c.setLineDash([4,4]); c.beginPath(); c.moveTo(padding, zeroY); c.lineTo(canv.width - padding, zeroY); c.stroke(); c.setLineDash([]);
    
    const points = [];
    for (let i = 0; i < xData.length; i++) {
        const px = padding + (i / (xData.length - 1)) * w;
        const py = canv.height - padding - ((yData[i] - minData) / (maxData - minData)) * h;
        points.push({ x: px, y: py });
    }
    c.strokeStyle = color; c.lineWidth = 2.5; c.beginPath(); c.moveTo(points[0].x, points[0].y);
    if (points.length > 4) {
        for (let i = 0; i < points.length - 2; i++) {
            const cp = getControlPoints(points[i].x, points[i].y, points[i+1].x, points[i+1].y, points[i+2].x, points[i+2].y, 0.5);
            c.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, points[i+2].x, points[i+2].y);
        }
    } else { for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y); }
    c.stroke(); c.lineTo(points[points.length - 1].x, zeroY); c.lineTo(points[0].x, zeroY); c.closePath();
    const gradient = c.createLinearGradient(0, 0, 0, canv.height); gradient.addColorStop(0, color + '40'); gradient.addColorStop(1, color + '05'); c.fillStyle = gradient; c.fill();
}

// ==================== 统一物理风格绘图工具 ====================
function drawPhysicsHatch(c, startX, endX, lineY, isDark, spacing = 28) {
    const color = isDark ? '#94a3b8' : '#475569';
    c.strokeStyle = color;
    c.lineWidth = 2.0;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(startX, lineY);
    c.lineTo(endX, lineY);
    c.stroke();
    for (let x = startX + spacing/2; x < endX - spacing/2; x += spacing) {
        c.beginPath();
        c.moveTo(x, lineY);
        c.lineTo(x - 8, lineY - 14);
        c.stroke();
    }
}

// ==================== 1. 匀变速直线运动模块 ====================
const UniformModule = {
    id: 'uniform', title: '匀变速直线运动', desc: '斜面木块下滑实验',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
    state: null, speed: 1, initValues: { v0: 0, a: 4 }, slopeConfig: { startX: 100, startY: 80, endX: 700, endY: 380, pixelPerMeter: 30 },
    createState() {
        const self = this;
        return {
            init() {
                self.state = { s: 0, v: self.initValues.v0, t: 0, lastTime: 0, playing: false, animId: null, history: { v: [], s: [], t: [] } };
                self.slopeConfig.angle = Math.atan2(self.slopeConfig.endY - self.slopeConfig.startY, self.slopeConfig.endX - self.slopeConfig.startX);
                self.slopeConfig.totalPixelLength = Math.hypot(self.slopeConfig.endX - self.slopeConfig.startX, self.slopeConfig.endY - self.slopeConfig.startY);
                self.slopeConfig.maxDistance = self.slopeConfig.totalPixelLength / self.slopeConfig.pixelPerMeter;
                const maxS = self.slopeConfig.maxDistance;
                if (self.initValues.a >= 0) {
                    self.state.s = 0; self.state.v = self.initValues.v0;
                } else {
                    self.state.s = maxS; self.state.v = -self.initValues.v0;
                }
            },
            setSpeed(s) { self.speed = s; }, destroy() { if(this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    renderParams() {
        const p = [{ id: 'v0', name: '初速度 v₀', min: 0, max: 5, def: this.initValues.v0, unit: 'm/s' }, { id: 'a', name: '加速度 a', min: -5, max: 10, def: this.initValues.a, unit: 'm/s²' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center justify-between w-24"><input type="number" id="num-${p.id}" class="param-input w-16" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('uniform').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted text-right w-8">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('uniform').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 速度公式：$v = v_0 + at$</p><p>• 位移公式：$s = v_0 t + \\frac{1}{2} a t^2$</p><p>• 速度位移关系：$v^2 - v_0^2 = 2 a s$</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.lastTime = 0; this.state.history = { v: [], s: [], t: [] }; const maxS = this.slopeConfig.maxDistance; if (this.initValues.a >= 0) { this.state.s = 0; this.state.v = this.initValues.v0; } else { this.state.s = maxS; this.state.v = -this.initValues.v0; } this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now; this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) { this.state.t += dt; const maxS = this.slopeConfig.maxDistance; const newV = this.state.v + this.initValues.a * dt; const newS = this.state.s + this.state.v * dt + 0.5 * this.initValues.a * dt * dt; if ((newS >= maxS && newV > 0) || (newS <= 0 && newV < 0)) { this.reset(); return; } this.state.v = newV; this.state.s = Math.max(0, Math.min(maxS, newS)); this.state.history.t.push(this.state.t); this.state.history.v.push(this.state.v); this.state.history.s.push(this.state.s); if (this.state.history.t.length > 800) { this.state.history.t.shift(); this.state.history.v.shift(); this.state.history.s.shift(); } },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d');
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        this.drawGrid(c);
        const { startX, startY, endX, endY, angle, pixelPerMeter } = this.slopeConfig;
        const isDark = document.body.classList.contains('dark');

        const trackShadow = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
        c.strokeStyle = trackShadow; c.lineWidth = 16;
        c.beginPath(); c.moveTo(startX, startY + 6); c.lineTo(endX, endY + 6); c.stroke();

        const slopeColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
        c.strokeStyle = slopeColor; c.lineWidth=2; 
        c.beginPath(); c.moveTo(startX,startY); c.lineTo(endX,endY); c.stroke();

        c.textRendering = 'geometricPrecision';
        c.font = '12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        c.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
        c.textAlign = 'center';
        c.textBaseline = 'middle';

        for (let i = 0; i <= 6; i++) { const s = i*3; const px = startX + s*pixelPerMeter*Math.cos(angle); const py = startY + s*pixelPerMeter*Math.sin(angle); if(px>endX) break; const perpX=-Math.sin(angle)*8; const perpY=Math.cos(angle)*8; c.beginPath(); c.moveTo(px, py); c.lineTo(px+perpX, py+perpY); c.stroke(); c.save(); c.translate(px+perpX*1.5, py+perpY*1.5); c.rotate(angle); c.fillText(s+'m', 0, 4); c.restore(); }
        
        const pd = this.state.s * pixelPerMeter; const bx = startX + pd*Math.cos(angle); const by = startY + pd*Math.sin(angle);
        c.save(); c.translate(bx, by); c.rotate(angle);
        c.shadowColor = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.2)';
        c.shadowBlur = 16; c.shadowOffsetX = 2; c.shadowOffsetY = 6;
        const g = c.createLinearGradient(0, -18, 0, 18); 
        g.addColorStop(0, '#f1f5f9'); g.addColorStop(1, '#64748b');
        c.fillStyle = g; c.fillRect(-20, -16, 40, 32);
        c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
        c.strokeStyle = '#475569'; c.lineWidth=2; c.strokeRect(-20, -16, 40, 32);
        c.restore();

        if (Math.abs(this.state.v) > 0.1) { const len = this.state.v*8; c.save(); c.translate(bx, by); c.rotate(angle); c.strokeStyle='#ef4444'; c.lineWidth=3; c.beginPath(); c.moveTo(0,-25); c.lineTo(len,-25); c.stroke(); const d=this.state.v>0?1:-1; c.beginPath(); c.moveTo(len,-25); c.lineTo(len-8*d,-30); c.lineTo(len-8*d,-20); c.closePath(); c.fillStyle='#ef4444'; c.fill(); c.restore(); }
        drawLineChart(document.getElementById('vtChart').getContext('2d'), document.getElementById('vtChart'), this.state.history.t, this.state.history.v, '#fbbf24');
        drawLineChart(document.getElementById('stChart').getContext('2d'), document.getElementById('stChart'), this.state.history.t, this.state.history.s, '#4ade80');
        this.updateDataPanel();
    },
    updateDataPanel() { 
        const dataItem = (label, value, unit) => `
            <div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2">
                <span class="text-secondary text-sm">${label}</span>
                <span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span>
            </div>
        `;
        document.getElementById('data-container').innerHTML = dataItem('时间 t', this.state.t.toFixed(2), 's') + dataItem('速度 v', this.state.v.toFixed(2), 'm/s') + dataItem('位移 s', this.state.s.toFixed(2), 'm') + dataItem('加速度 a', this.initValues.a.toFixed(2), 'm/s²');
    }
};

// ==================== 2. 自由落体实验模块 ====================
const FreefallModule = {
    id: 'freefall', title: '自由落体实验', desc: '重力加速度测量',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>`,
    state: null, speed: 1, initValues: { h: 100, g: 9.8 },
    createState() {
        const self = this;
        return {
            init() { self.state = { t: 0, s: 0, v: 0, lastTime: 0, playing: false, animId: null, trails: [], history: { v: [], s: [], t: [] } }; self.computeTrails(); },
            setSpeed(s) { self.speed = s; }, destroy() { if (this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    computeTrails() { const T = Math.sqrt(2 * this.initValues.h / this.initValues.g); this.state.trails = [1, 2, 3, 4, 5].map(i => ({ time: (i - 0.5) * T / 5, generated: false, x: 400, y: 0 })); },
    renderParams() {
        const p = [{ id: 'h', name: '下落高度 h', min: 10, max: 200, def: this.initValues.h, unit: 'm' }, { id: 'g', name: '重力加速度 g', min: 1, max: 20, def: this.initValues.g, unit: 'm/s²' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center justify-between w-24"><input type="number" id="num-${p.id}" class="param-input w-16" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('freefall').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted text-right w-8">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('freefall').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 速度公式：$v = g t$</p><p>• 位移公式：$h = \\frac{1}{2} g t^2$</p><p>• 落地时间：$t = \\sqrt{\\frac{2h}{g}}$</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.s = 0; this.state.v = 0; this.state.lastTime = 0; this.state.history = { v: [], s: [], t: [] }; this.computeTrails(); this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now; this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) { this.state.t += dt; const v = this.state.v + this.initValues.g * dt; const s = this.state.s + this.state.v * dt + 0.5 * this.initValues.g * dt * dt; if (s >= this.initValues.h) { this.reset(); return; } this.state.v = v; this.state.s = s; this.state.history.t.push(this.state.t); this.state.history.v.push(this.state.v); this.state.history.s.push(this.state.s); if (this.state.history.t.length > 800) { this.state.history.t.shift(); this.state.history.v.shift(); this.state.history.s.shift(); } const scale = 350 / this.initValues.h; const startY = 50; for (let i = 0; i < this.state.trails.length; i++) { if (!this.state.trails[i].generated && this.state.t >= this.state.trails[i].time) { this.state.trails[i].generated = true; this.state.trails[i].y = startY + this.state.s * scale; } } },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d');
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        this.drawGrid(c);
        const vals = this.initValues; const isDark = document.body.classList.contains('dark');
        const scale = 350 / vals.h; const startY = 50; const groundY = startY + 350;
        const bx = 400; const by = startY + this.state.s * scale;

        c.textRendering = 'geometricPrecision';
        c.font = '13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const textColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
        const lineColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        c.fillStyle = textColor;
        c.strokeStyle = lineColor;
        c.lineWidth = 1.5;
        c.textAlign = 'right';
        c.textBaseline = 'middle';

        for (let i = 0; i <= 5; i++) {
            const y = startY + i * 70;
            c.beginPath(); c.moveTo(55, y); c.lineTo(85, y); c.stroke();
            const text = Math.round(vals.h - i * vals.h / 5) + 'm';
            c.fillText(text, 42, y);
        }

        const hatchColor = isDark ? '#94a3b8' : '#475569';
        c.strokeStyle = hatchColor;
        c.lineWidth = 2.0;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(55, groundY);
        c.lineTo(760, groundY);
        c.stroke();

        const spacing = 24;
        for (let x = 55 + spacing/2 + 2 * spacing; x < 760 - spacing/2; x += spacing) {
            c.beginPath();
            c.moveTo(x, groundY);
            c.lineTo(x - 8, groundY - 14);
            c.stroke();
        }

        if (this.state.trails) { 
            for (let i=0;i<this.state.trails.length;i++) { 
                if (this.state.trails[i].generated) { 
                    const gr = c.createRadialGradient(this.state.trails[i].x-4, this.state.trails[i].y-4,0,this.state.trails[i].x,this.state.trails[i].y,18); 
                    gr.addColorStop(0, 'rgba(241, 245, 249, 0.4)');
                    gr.addColorStop(1, 'rgba(100, 116, 139, 0.15)');
                    c.fillStyle=gr; c.beginPath(); c.arc(this.state.trails[i].x, this.state.trails[i].y, 18,0,Math.PI*2); c.fill(); 
                } 
            } 
        }
        
        const gr = c.createRadialGradient(bx-5,by-5,0,bx,by,18);
        gr.addColorStop(0, '#f1f5f9'); gr.addColorStop(1, '#64748b');
        c.fillStyle=gr; c.beginPath(); c.arc(bx,by,18,0,Math.PI*2); c.fill();
        if (this.state.v > 0.1) { const len=Math.min(this.state.v*3,80); c.strokeStyle='#fbbf24'; c.lineWidth=3; c.beginPath(); c.moveTo(bx+30,by); c.lineTo(bx+30,by+len); c.stroke(); c.beginPath(); c.moveTo(bx+30,by+len); c.lineTo(bx+25,by+len-8); c.lineTo(bx+35,by+len-8); c.closePath(); c.fillStyle='#fbbf24'; c.fill(); }
        drawLineChart(document.getElementById('vtChart').getContext('2d'), document.getElementById('vtChart'), this.state.history.t, this.state.history.v, '#fbbf24');
        drawLineChart(document.getElementById('stChart').getContext('2d'), document.getElementById('stChart'), this.state.history.t, this.state.history.s, '#4ade80');
        this.updateDataPanel();
    },
    updateDataPanel() {
        const dataItem = (label, value, unit) => `
            <div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2">
                <span class="text-secondary text-sm">${label}</span>
                <span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span>
            </div>
        `;
        const t = Math.sqrt(2 * this.initValues.h / this.initValues.g);
        document.getElementById('data-container').innerHTML = dataItem('下落时间', this.state.t.toFixed(2), 's') + dataItem('瞬时速度', this.state.v.toFixed(2), 'm/s') + dataItem('下落距离', this.state.s.toFixed(2), 'm') + dataItem('理论落地时间', t.toFixed(2), 's');
    }
};

// ==================== 3. 单摆实验模块 ====================
const PendulumModule = {
    id: 'pendulum', title: '单摆实验', desc: '简谐运动周期研究',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    state: null, speed: 1, initValues: { L: 1.5, theta0: 15, g: 9.8 },
    createState() {
        const self = this;
        return {
            init() { const th = self.initValues.theta0 * Math.PI / 180; self.state = { theta: th, omega: 0, t: 0, lastTime: 0, playing: false, animId: null, initialEnergy: self.initValues.g * self.initValues.L * (1 - Math.cos(th)), history: { v: [], s: [], t: [] } }; },
            setSpeed(s) { self.speed = s; }, destroy() { if (this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    renderParams() {
        const p = [{ id: 'L', name: '摆长 L', min: 0.5, max: 3, def: this.initValues.L, unit: 'm' }, { id: 'theta0', name: '摆角 θ₀', min: 5, max: 45, def: this.initValues.theta0, unit: '°' }, { id: 'g', name: '重力加速度 g', min: 1, max: 20, def: this.initValues.g, unit: 'm/s²' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center justify-between w-24"><input type="number" id="num-${p.id}" class="param-input w-16" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('pendulum').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted text-right w-8">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('pendulum').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 周期公式：$T = 2\\pi \\sqrt{\\frac{L}{g}}$</p><p>• 角位移：$\\theta(t) = \\theta_0 \\cos(\\omega t)$</p><p>• 速度：$v(t) = -L \\omega \\theta_0 \\sin(\\omega t)$</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.lastTime = 0; this.state.history = { v: [], s: [], t: [] }; const th = this.initValues.theta0 * Math.PI / 180; this.state.theta = th; this.state.omega = 0; this.state.initialEnergy = this.initValues.g * this.initValues.L * (1 - Math.cos(th)); this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now; this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) { this.state.t += dt; const alpha = -(this.initValues.g / this.initValues.L) * Math.sin(this.state.theta); this.state.omega += alpha * dt; this.state.theta += this.state.omega * dt; const currentEnergy = 0.5 * this.initValues.L * this.initValues.L * this.state.omega * this.state.omega + this.initValues.g * this.initValues.L * (1 - Math.cos(this.state.theta)); if (currentEnergy > 1e-6) this.state.omega *= Math.sqrt(this.state.initialEnergy / currentEnergy); const v = this.state.omega * this.initValues.L; const s = this.state.theta * this.initValues.L; const h = this.state.history; h.t.push(this.state.t); h.v.push(v); h.s.push(s); if (h.t.length > 800) { h.t.shift(); h.v.shift(); h.s.shift(); } },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d');
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        this.drawGrid(c);
        const isDark = document.body.classList.contains('dark');
        const pivotX = 400, pivotY = 65, pL = this.initValues.L * 120;
        const bx = pivotX + pL * Math.sin(this.state.theta); const by = pivotY + pL * Math.cos(this.state.theta);

        drawPhysicsHatch(c, 200, 600, pivotY, isDark, 24);

        c.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(pivotX,pivotY); c.lineTo(bx,by); c.stroke();

        const gr = c.createRadialGradient(bx - 5, by - 5, 0, bx, by, 22);
        gr.addColorStop(0, '#f1f5f9'); gr.addColorStop(1, '#64748b');
        c.fillStyle = gr; c.beginPath(); c.arc(bx, by, 22, 0, Math.PI * 2); c.fill();

        c.strokeStyle = 'rgba(251, 191, 36, 0.5)'; c.lineWidth=2; c.beginPath(); c.arc(pivotX,pivotY,40,Math.PI/2,Math.PI/2-this.state.theta,this.state.theta>0); c.stroke();

        c.setLineDash([5,5]); c.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'; c.beginPath(); c.moveTo(pivotX,pivotY); c.lineTo(pivotX,pivotY+pL+30); c.stroke(); c.setLineDash([]);

        const vMag = Math.abs(this.state.omega * this.initValues.L); 
        if (vMag > 0.05) { 
            const d = this.state.omega>0?1:-1; 
            const vx = bx + d*Math.cos(this.state.theta)*vMag*20; 
            const vy = by - d*Math.sin(this.state.theta)*vMag*20; 
            c.strokeStyle='#fbbf24'; 
            c.lineWidth=3; 
            c.fillStyle='#fbbf24';
            c.beginPath(); 
            c.moveTo(bx,by); 
            c.lineTo(vx,vy); 
            c.stroke();
            const angle = Math.atan2(vy - by, vx - bx);
            const headLen = 12; 
            const headAngle = Math.PI / 6; 
            const x1 = vx - headLen * Math.cos(angle - headAngle);
            const y1 = vy - headLen * Math.sin(angle - headAngle);
            const x2 = vx - headLen * Math.cos(angle + headAngle);
            const y2 = vy - headLen * Math.sin(angle + headAngle);
            c.beginPath();
            c.moveTo(vx, vy);
            c.lineTo(x1, y1);
            c.lineTo(x2, y2);
            c.closePath();
            c.fill();
        }

        drawLineChart(document.getElementById('vtChart').getContext('2d'), document.getElementById('vtChart'), this.state.history.t, this.state.history.v, '#fbbf24');
        drawLineChart(document.getElementById('stChart').getContext('2d'), document.getElementById('stChart'), this.state.history.t, this.state.history.s, '#4ade80');
        this.updateDataPanel();
    },
    updateDataPanel() {
        const dataItem = (label, value, unit) => `
            <div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2">
                <span class="text-secondary text-sm">${label}</span>
                <span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span>
            </div>
        `;
        const T = 2 * Math.PI * Math.sqrt(this.initValues.L / this.initValues.g);
        document.getElementById('data-container').innerHTML = dataItem('运行时间', this.state.t.toFixed(2), 's') + dataItem('理论周期 T', T.toFixed(3), 's') + dataItem('摆角 θ', (this.state.theta * 180 / Math.PI).toFixed(1), '°') + dataItem('角速度 ω', this.state.omega.toFixed(3), 'rad/s');
    }
};

App.registerModule(UniformModule);
App.registerModule(FreefallModule);
App.registerModule(PendulumModule);