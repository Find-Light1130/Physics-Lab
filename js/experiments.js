function getControlPoints(x0, y0, x1, y1, x2, y2, t) {
    const d01 = Math.hypot(x1 - x0, y1 - y0);
    const d12 = Math.hypot(x2 - x1, y2 - y1);
    const fa = t * d01 / (d01 + d12);
    const fb = t * d12 / (d01 + d12);
    return { cp1x: x1 - fa * (x2 - x0), cp1y: y1 - fa * (y2 - y0), cp2x: x1 + fb * (x2 - x0), cp2y: y1 + fb * (y2 - y0) };
}

function drawLineChart(c, canv, xData, yData, color, xLabel = 't / s', yLabel = 'v / (m·s⁻¹)') {
    c.clearRect(0, 0, canv.width, canv.height);
    if (xData.length < 2) return;
    c.lineJoin = 'round'; c.lineCap = 'round'; c.imageSmoothingEnabled = true;
    const isDark = document.body.classList.contains('dark');

    let maxAbs = Math.max(...yData.map(v => Math.abs(v)), 1);
    let range = maxAbs * 2 + maxAbs * 0.2;
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
    c.stroke(); 
    c.lineTo(points[points.length - 1].x, zeroY); c.lineTo(points[0].x, zeroY); c.closePath();
    const gradient = c.createLinearGradient(0, 0, 0, canv.height); gradient.addColorStop(0, color + '40'); gradient.addColorStop(1, color + '05'); c.fillStyle = gradient; c.fill();

    const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    c.fillStyle = labelColor;
    c.font = '10px "Inter", sans-serif';
    c.textAlign = 'right';
    c.textBaseline = 'bottom';
    c.fillText(xLabel, canv.width - padding, canv.height - 2);
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(yLabel, padding + 10, padding);
}

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

// ==================== 1. 匀变速直线运动 ====================
const UniformModule = {
    id: 'uniform', title: '匀变速直线运动', desc: '斜面木块下滑实验',
    // 【恢复】去除拆解类，恢复为合并的 SVG
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
    state: null, speed: 1, initValues: { v0: 0, a: 4 }, slopeConfig: { startX: 100, startY: 80, endX: 700, endY: 380, pixelPerMeter: 30 },
    createState() {
        const self = this;
        return {
            init() {
                self.state = { s: 0, v: self.initValues.v0, t: 0, lastTime: 0, playing: false, animId: null, history: { v: [], s: [], t: [] }, bounceTimer: 0 };
                self.slopeConfig.angle = Math.atan2(self.slopeConfig.endY - self.slopeConfig.startY, self.slopeConfig.endX - self.slopeConfig.startX);
                self.slopeConfig.totalPixelLength = Math.hypot(self.slopeConfig.endX - self.slopeConfig.startX, self.slopeConfig.endY - self.slopeConfig.startY);
                self.slopeConfig.maxDistance = self.slopeConfig.totalPixelLength / self.slopeConfig.pixelPerMeter;
                const maxS = self.slopeConfig.maxDistance;
                if (self.initValues.a >= 0) { self.state.s = 0; self.state.v = self.initValues.v0; } else { self.state.s = maxS; self.state.v = -self.initValues.v0; }
            },
            setSpeed(s) { self.speed = s; }, destroy() { if(this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    renderParams() {
        const p = [{ id: 'v0', name: '初速度 v₀', min: 0, max: 5, def: this.initValues.v0, unit: 'm/s' }, { id: 'a', name: '加速度 a', min: -5, max: 10, def: this.initValues.a, unit: 'm/s²' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md"><input type="number" id="num-${p.id}" class="param-input" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('uniform').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted ml-1">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('uniform').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 速度公式：$v = v_0 + at$</p><p>• 位移公式：$s = v_0 t + \\frac{1}{2} a t^2$</p><p>• 速度位移关系：$v^2 - v_0^2 = 2 a s$</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.lastTime = 0; this.state.history = { v: [], s: [], t: [] }; this.state.bounceTimer = 0; const maxS = this.slopeConfig.maxDistance; if (this.initValues.a >= 0) { this.state.s = 0; this.state.v = this.initValues.v0; } else { this.state.s = maxS; this.state.v = -this.initValues.v0; } this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now;
        if (this.state.bounceTimer > 0) { this.state.bounceTimer -= dt; if (this.state.bounceTimer <= 0) { this.state.bounceTimer = 0; this.reset(); return; } }
        this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; if (this.state.bounceTimer > 0) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) {
        const groundY = 430;
        const radius = 16;
        const { vx, g } = this.initValues;
        
        this.state.t += dt;
        let newVy = this.state.vy + g * dt;
        let newY = this.state.y + this.state.vy * dt;
        let newX = this.state.x + this.state.vx * dt;

        // 1. 落地碰撞
        if (newY >= groundY - radius) {
            this.state.y = groundY - radius;
            this.state.vx = 0;
            this.state.vy = 0;
            this.state.playing = false;
            document.getElementById('play-btn').innerHTML = '▶ 开始';
        } else {
            this.state.y = newY;
            this.state.vy = newVy;
            this.state.x = newX;
        }
        
        // 2. 轨迹记录
        if (this.state.playing || this.state.vy !== 0) {
            this.state.historyX.push(this.state.x);
            this.state.historyY.push(this.state.y);
            if (this.state.historyX.length > 800) {
                this.state.historyX.shift();
                this.state.historyY.shift();
            }
        }

        // 3. 【核心功能】四周边界检测与自动重置
        // 只要球离开画布四周 150 像素，就立刻触发重置
        if (this.state.y < -150 || this.state.y > 600 || 
            this.state.x < -150 || this.state.x > 950) {
            this.reset(); // 注意：这里调用的是 reset，会清空轨迹和时间
        }
    },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d');
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        this.drawGrid(c);
        const { startX, startY, endX, endY, angle, pixelPerMeter } = this.slopeConfig;
        const isDark = document.body.classList.contains('dark');

        const trackShadow = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
        c.strokeStyle = trackShadow; c.lineWidth = 16; c.beginPath(); c.moveTo(startX, startY + 6); c.lineTo(endX, endY + 6); c.stroke();
        const slopeColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'; c.strokeStyle = slopeColor; c.lineWidth=2; c.beginPath(); c.moveTo(startX,startY); c.lineTo(endX,endY); c.stroke();

        c.textRendering = 'geometricPrecision'; c.font = '12px "Inter", sans-serif'; c.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (let i = 0; i <= 6; i++) { const s = i*3; const px = startX + s*pixelPerMeter*Math.cos(angle); const py = startY + s*pixelPerMeter*Math.sin(angle); if(px>endX) break; const perpX=-Math.sin(angle)*8; const perpY=Math.cos(angle)*8; c.beginPath(); c.moveTo(px, py); c.lineTo(px+perpX, py+perpY); c.stroke(); c.save(); c.translate(px+perpX*1.5, py+perpY*1.5); c.rotate(angle); c.fillText(s+'m', 0, 4); c.restore(); }
        
        const pd = this.state.s * pixelPerMeter; const bx = startX + pd*Math.cos(angle); const by = startY + pd*Math.sin(angle);
        c.save(); c.translate(bx, by); c.rotate(angle);
        let scaleY = 1;
        if (this.state.bounceTimer > 0) { scaleY = 1 + 0.2 * Math.sin(this.state.bounceTimer * 25) * (this.state.bounceTimer / 0.3); }
        c.scale(1, scaleY);
        c.shadowColor = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.2)'; c.shadowBlur = 16; c.shadowOffsetX = 2; c.shadowOffsetY = 6;
        const g = c.createLinearGradient(0, -18, 0, 18); g.addColorStop(0, '#f1f5f9'); g.addColorStop(1, '#64748b');
        c.fillStyle = g; c.fillRect(-20, -16, 40, 32);
        c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; c.strokeStyle = '#475569'; c.lineWidth=2; c.strokeRect(-20, -16, 40, 32);
        c.restore();

        if (Math.abs(this.state.v) > 0.1) {
            const len = this.state.v * 8;
            const d = this.state.v > 0 ? 1 : -1;
            const ex = len, ey = -25;
            const headLen = 10;
            const baseX = ex - headLen * d;
            const baseY = ey;
            c.save(); c.translate(bx, by); c.rotate(angle);
            c.strokeStyle = '#ef4444'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(0, -25); c.lineTo(baseX, baseY); c.stroke();
            c.fillStyle = '#ef4444';
            const hw = 6;
            c.beginPath(); c.moveTo(ex, ey); c.lineTo(baseX, baseY - hw); c.lineTo(baseX, baseY + hw); c.closePath(); c.fill();
            c.restore();
        }
        
        drawLineChart(document.getElementById('vtChart').getContext('2d'), document.getElementById('vtChart'), this.state.history.t, this.state.history.v, '#fbbf24', 't / s', 'v / (m·s⁻¹)');
        drawLineChart(document.getElementById('stChart').getContext('2d'), document.getElementById('stChart'), this.state.history.t, this.state.history.s, '#4ade80', 't / s', 's / m');
        this.updateDataPanel();
    },
    updateDataPanel() { 
        const dataItem = (label, value, unit) => `<div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2"><span class="text-secondary text-sm">${label}</span><span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span></div>`;
        document.getElementById('data-container').innerHTML = dataItem('时间 t', this.state.t.toFixed(2), 's') + dataItem('速度 v', this.state.v.toFixed(2), 'm/s') + dataItem('位移 s', this.state.s.toFixed(2), 'm') + dataItem('加速度 a', this.initValues.a.toFixed(2), 'm/s²');
    }
};

// ==================== 2. 自由落体实验 ====================
const FreefallModule = {
    id: 'freefall', title: '自由落体实验', desc: '重力加速度测量',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>`,
    state: null, speed: 1, initValues: { h: 100, g: 9.8 },
    createState() {
        const self = this;
        return {
            init() { self.state = { t: 0, s: 0, v: 0, lastTime: 0, playing: false, animId: null, trails: [], history: { v: [], s: [], t: [] }, bounceTimer: 0 }; self.computeTrails(); },
            setSpeed(s) { self.speed = s; }, destroy() { if (this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    computeTrails() { const T = Math.sqrt(2 * this.initValues.h / this.initValues.g); this.state.trails = [1, 2, 3, 4, 5].map(i => ({ time: (i - 0.5) * T / 5, generated: false, x: 400, y: 0 })); },
    renderParams() {
        const p = [{ id: 'h', name: '下落高度 h', min: 10, max: 200, def: this.initValues.h, unit: 'm' }, { id: 'g', name: '重力加速度 g', min: 1, max: 20, def: this.initValues.g, unit: 'm/s²' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md"><input type="number" id="num-${p.id}" class="param-input" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('freefall').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted ml-1">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('freefall').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 速度公式：$v = g t$</p><p>• 位移公式：$h = \\frac{1}{2} g t^2$</p><p>• 落地时间：$t = \\sqrt{\\frac{2h}{g}}$</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.s = 0; this.state.v = 0; this.state.lastTime = 0; this.state.history = { v: [], s: [], t: [] }; this.state.bounceTimer = 0; this.computeTrails(); this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now;
        if (this.state.bounceTimer > 0) { this.state.bounceTimer -= dt; if (this.state.bounceTimer <= 0) { this.state.bounceTimer = 0; this.reset(); return; } }
        this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; if (this.state.bounceTimer > 0) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) { this.state.t += dt; const v = this.state.v + this.initValues.g * dt; const s = this.state.s + this.state.v * dt + 0.5 * this.initValues.g * dt * dt; 
        if (s >= this.initValues.h) { if (!this.state.bounceTimer) { this.state.bounceTimer = 0.3; this.state.v = 0; this.state.s = this.initValues.h; } return; } 
        this.state.v = v; this.state.s = s; 
        this.state.history.t.push(this.state.t); this.state.history.v.push(this.state.v); this.state.history.s.push(this.state.s); if (this.state.history.t.length > 800) { this.state.history.t.shift(); this.state.history.v.shift(); this.state.history.s.shift(); } 
        const scale = 350 / this.initValues.h; const startY = 50; for (let i = 0; i < this.state.trails.length; i++) { if (!this.state.trails[i].generated && this.state.t >= this.state.trails[i].time) { this.state.trails[i].generated = true; this.state.trails[i].y = startY + this.state.s * scale; } } 
    },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d');
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        this.drawGrid(c);
        const vals = this.initValues; const isDark = document.body.classList.contains('dark');
        const scale = 350 / vals.h; const startY = 50; const groundY = startY + 350;
        const bx = 400; const by = startY + this.state.s * scale;

        c.textRendering = 'geometricPrecision'; c.font = '13px "Inter", sans-serif';
        const textColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
        const lineColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        c.fillStyle = textColor; c.strokeStyle = lineColor; c.lineWidth = 1.5; c.textAlign = 'right'; c.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) { const y = startY + i * 70; c.beginPath(); c.moveTo(55, y); c.lineTo(85, y); c.stroke(); const text = Math.round(vals.h - i * vals.h / 5) + 'm'; c.fillText(text, 42, y); }

        const hatchColor = isDark ? '#94a3b8' : '#475569';
        c.strokeStyle = hatchColor; c.lineWidth = 2.0; c.lineCap = 'round'; c.beginPath(); c.moveTo(55, groundY); c.lineTo(760, groundY); c.stroke();
        const spacing = 24; for (let x = 55 + spacing/2 + 2 * spacing; x < 760 - spacing/2; x += spacing) { c.beginPath(); c.moveTo(x, groundY); c.lineTo(x - 8, groundY - 14); c.stroke(); }

        if (this.state.trails) { for (let i=0;i<this.state.trails.length;i++) { if (this.state.trails[i].generated) { const gr = c.createRadialGradient(this.state.trails[i].x-4, this.state.trails[i].y-4,0,this.state.trails[i].x,this.state.trails[i].y,18); gr.addColorStop(0, 'rgba(241, 245, 249, 0.4)'); gr.addColorStop(1, 'rgba(100, 116, 139, 0.15)'); c.fillStyle=gr; c.beginPath(); c.arc(this.state.trails[i].x, this.state.trails[i].y, 18,0,Math.PI*2); c.fill(); } } }
        
        let scaleY = 1;
        if (this.state.bounceTimer > 0) { scaleY = 1 + 0.2 * Math.sin(this.state.bounceTimer * 25) * (this.state.bounceTimer / 0.3); }
        c.save(); c.translate(bx, by); c.scale(1, scaleY);
        const gr = c.createRadialGradient(-5, -5, 0, 0, 0, 18); gr.addColorStop(0, '#f1f5f9'); gr.addColorStop(1, '#64748b'); c.fillStyle=gr; c.beginPath(); c.arc(0,0,18,0,Math.PI*2); c.fill(); 
        c.restore();

        if (this.state.v > 0.1) {
            const len = Math.min(this.state.v * 3, 80);
            const ex = bx + 30, ey = by + len;
            const headLen = 12;
            const baseY = ey - headLen;
            c.strokeStyle = '#fbbf24'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(bx + 30, by); c.lineTo(bx + 30, baseY); c.stroke();
            c.fillStyle = '#fbbf24';
            const hw = 6;
            c.beginPath(); c.moveTo(ex, ey); c.lineTo(bx + 30 - hw, baseY); c.lineTo(bx + 30 + hw, baseY); c.closePath(); c.fill();
        }
        drawLineChart(document.getElementById('vtChart').getContext('2d'), document.getElementById('vtChart'), this.state.history.t, this.state.history.v, '#fbbf24', 't / s', 'v / (m·s⁻¹)');
        drawLineChart(document.getElementById('stChart').getContext('2d'), document.getElementById('stChart'), this.state.history.t, this.state.history.s, '#4ade80', 't / s', 's / m');
        this.updateDataPanel();
    },
    updateDataPanel() { const t = Math.sqrt(2 * this.initValues.h / this.initValues.g); const dataItem = (label, value, unit) => `<div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2"><span class="text-secondary text-sm">${label}</span><span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span></div>`; document.getElementById('data-container').innerHTML = dataItem('下落时间', this.state.t.toFixed(2), 's') + dataItem('瞬时速度', this.state.v.toFixed(2), 'm/s') + dataItem('下落距离', this.state.s.toFixed(2), 'm') + dataItem('理论落地时间', t.toFixed(2), 's'); }
};

// ==================== 3. 单摆实验 ====================
const PendulumModule = {
    id: 'pendulum', title: '单摆实验', desc: '简谐运动周期研究',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    state: null, speed: 1, initValues: { L: 1.5, theta0: 15, g: 9.8 },
    createState() {
        const self = this;
        return { init() { const th = self.initValues.theta0 * Math.PI / 180; self.state = { theta: th, omega: 0, t: 0, lastTime: 0, playing: false, animId: null, initialEnergy: self.initValues.g * self.initValues.L * (1 - Math.cos(th)), history: { v: [], s: [], t: [] } }; }, setSpeed(s) { self.speed = s; }, destroy() { if (this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); } };
    },
    renderParams() {
        const p = [{ id: 'L', name: '摆长 L', min: 0.5, max: 3, def: this.initValues.L, unit: 'm' }, { id: 'theta0', name: '摆角 θ₀', min: 5, max: 45, def: this.initValues.theta0, unit: '°' }, { id: 'g', name: '重力加速度 g', min: 1, max: 20, def: this.initValues.g, unit: 'm/s²' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md"><input type="number" id="num-${p.id}" class="param-input" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('pendulum').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted ml-1">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('pendulum').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
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
        const c = document.getElementById('expCanvas').getContext('2d'); c.clearRect(0, 0, c.canvas.width, c.canvas.height); this.drawGrid(c); const isDark = document.body.classList.contains('dark'); const pivotX = 400, pivotY = 65, pL = this.initValues.L * 120; const bx = pivotX + pL * Math.sin(this.state.theta); const by = pivotY + pL * Math.cos(this.state.theta);
        drawPhysicsHatch(c, 200, 600, pivotY, isDark, 24);
        c.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(pivotX,pivotY); c.lineTo(bx,by); c.stroke();
        const gr = c.createRadialGradient(bx - 5, by - 5, 0, bx, by, 22); gr.addColorStop(0, '#f1f5f9'); gr.addColorStop(1, '#64748b'); c.fillStyle = gr; c.beginPath(); c.arc(bx, by, 22, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(251, 191, 36, 0.5)'; c.lineWidth=2; c.beginPath(); c.arc(pivotX,pivotY,40,Math.PI/2,Math.PI/2-this.state.theta,this.state.theta>0); c.stroke();
        c.setLineDash([5,5]); c.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'; c.beginPath(); c.moveTo(pivotX,pivotY); c.lineTo(pivotX,pivotY+pL+30); c.stroke(); c.setLineDash([]);
        const vMag = Math.abs(this.state.omega * this.initValues.L); 
        if (vMag > 0.05) { 
            const d = this.state.omega>0?1:-1; 
            const vx = bx + d*Math.cos(this.state.theta)*vMag*20; 
            const vy = by - d*Math.sin(this.state.theta)*vMag*20; 
            const angle = Math.atan2(vy - by, vx - bx);
            const headLen = 12;
            const ex = vx, ey = vy;
            const baseX = ex - headLen * Math.cos(angle);
            const baseY = ey - headLen * Math.sin(angle);
            c.strokeStyle = '#fbbf24'; c.lineWidth = 3; 
            c.beginPath(); c.moveTo(bx, by); c.lineTo(baseX, baseY); c.stroke(); 
            c.fillStyle = '#fbbf24';
            const hw = 6;
            const px1 = baseX - hw * Math.sin(angle);
            const py1 = baseY + hw * Math.cos(angle);
            const px2 = baseX + hw * Math.sin(angle);
            const py2 = baseY - hw * Math.cos(angle);
            c.beginPath(); c.moveTo(ex, ey); c.lineTo(px1, py1); c.lineTo(px2, py2); c.closePath(); c.fill();
        }
        drawLineChart(document.getElementById('vtChart').getContext('2d'), document.getElementById('vtChart'), this.state.history.t, this.state.history.v, '#fbbf24', 't / s', 'v / (m·s⁻¹)');
        drawLineChart(document.getElementById('stChart').getContext('2d'), document.getElementById('stChart'), this.state.history.t, this.state.history.s, '#4ade80', 't / s', 's / m');
        this.updateDataPanel();
    },
    updateDataPanel() { const T = 2 * Math.PI * Math.sqrt(this.initValues.L / this.initValues.g); const dataItem = (label, value, unit) => `<div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2"><span class="text-secondary text-sm">${label}</span><span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span></div>`; document.getElementById('data-container').innerHTML = dataItem('运行时间', this.state.t.toFixed(2), 's') + dataItem('理论周期 T', T.toFixed(3), 's') + dataItem('摆角 θ', (this.state.theta * 180 / Math.PI).toFixed(1), '°') + dataItem('角速度 ω', this.state.omega.toFixed(3), 'rad/s'); }
};

// ==================== 4. 双摆实验 ====================
const DoublePendulumModule = {
    id: 'doublependulum', title: '双摆实验', desc: '混沌动力学现象',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    state: null, speed: 1, 
    initValues: { L1: 1.2, L2: 1.0, theta1: 45, theta2: 45, g: 9.8 },
    createState() {
        const self = this;
        return {
            init() {
                const th1 = self.initValues.theta1 * Math.PI / 180;
                const th2 = self.initValues.theta2 * Math.PI / 180;
                self.state = { theta1: th1, omega1: 0, theta2: th2, omega2: 0, t: 0, lastTime: 0, playing: false, animId: null, historyX: [], historyY: [], _flyoutAlerted: false };
            },
            setSpeed(s) { self.speed = s; }, destroy() { if(this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    renderParams() {
        const p = [
            { id: 'L1', name: '上摆长 L₁', min: 0.5, max: 1.4, def: this.initValues.L1, unit: 'm' },
            { id: 'L2', name: '下摆长 L₂', min: 0.5, max: 1.4, def: this.initValues.L2, unit: 'm' },
            { id: 'theta1', name: '上摆角 θ₁', min: -45, max: 45, def: this.initValues.theta1, unit: '°' },
            { id: 'theta2', name: '下摆角 θ₂', min: -45, max: 45, def: this.initValues.theta2, unit: '°' },
            { id: 'g', name: '重力加速度 g', min: 1, max: 20, def: this.initValues.g, unit: 'm/s²' }
        ];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md"><input type="number" id="num-${p.id}" class="param-input" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('doublependulum').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted ml-1">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('doublependulum').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 双摆是典型的<b>混沌系统</b>，对初始条件极度敏感（蝴蝶效应）。</p><p>• 它的运动轨迹不可预测，极其复杂，但这正是非线性动力学的魅力所在。</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.lastTime = 0; this.state.historyX = []; this.state.historyY = []; this.state._flyoutAlerted = false; const th1 = this.initValues.theta1 * Math.PI / 180; const th2 = this.initValues.theta2 * Math.PI / 180; this.state.theta1 = th1; this.state.omega1 = 0; this.state.theta2 = th2; this.state.omega2 = 0; this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now; this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) {
        const steps = 50; const subDt = dt / steps; const g = this.initValues.g, L1 = this.initValues.L1, L2 = this.initValues.L2; const m1 = 1, m2 = 1;
        for(let i=0; i<steps; i++) {
            const { theta1, omega1, theta2, omega2 } = this.state; const dTheta = theta1 - theta2; const denom = m1 + m2 * Math.sin(dTheta) * Math.sin(dTheta); if (denom < 1e-9) continue;
            const alpha1 = (m2 * g * Math.sin(theta2) * Math.cos(dTheta) - m2 * Math.sin(dTheta) * Math.cos(dTheta) * (omega1 * omega1 * L1 * Math.cos(dTheta) + omega2 * omega2 * L2) - (m1 + m2) * g * Math.sin(theta1)) / (L1 * denom);
            const alpha2 = (m1 * g * Math.sin(theta1) * Math.cos(dTheta) - m1 * Math.sin(dTheta) * Math.cos(dTheta) * (omega1 * omega1 * L1 + omega2 * omega2 * L2 * Math.cos(dTheta)) - (m1 + m2) * g * Math.sin(theta2)) / (L2 * denom);
            this.state.omega1 += alpha1 * subDt; this.state.omega2 += alpha2 * subDt; this.state.theta1 += this.state.omega1 * subDt; this.state.theta2 += this.state.omega2 * subDt;
        }
        this.state.t += dt;
        if (this.state.theta1 > Math.PI) this.state.theta1 -= 2 * Math.PI; else if (this.state.theta1 < -Math.PI) this.state.theta1 += 2 * Math.PI;
        if (this.state.theta2 > Math.PI) this.state.theta2 -= 2 * Math.PI; else if (this.state.theta2 < -Math.PI) this.state.theta2 += 2 * Math.PI;
        if (!isFinite(this.state.theta1) || !isFinite(this.state.omega1)) { this.reset(); return; }
        const px = 400, py = 65; const pixL1 = L1 * 100, pixL2 = L2 * 100; const x1 = px + pixL1 * Math.sin(this.state.theta1); const y1 = py + pixL1 * Math.cos(this.state.theta1); const x2 = x1 + pixL2 * Math.sin(this.state.theta2); const y2 = y1 + pixL2 * Math.cos(this.state.theta2);
        const extremeMargin = 1500;
        if (x2 > -extremeMargin && x2 < 800 + extremeMargin && y2 > -extremeMargin && y2 < 450 + extremeMargin) {
            this.state.historyX.push(x2); this.state.historyY.push(y2);
        } else {
            if (!this.state._flyoutAlerted) { this.state._flyoutAlerted = true; alert("物理警告：双摆因能量过高飞出模拟边界，系统将自动重置。"); setTimeout(() => { if (this.state) { this.state._flyoutAlerted = false; } }, 3000); }
            this.reset(); return;
        }
        if (this.state.historyX.length > 800) { this.state.historyX.shift(); this.state.historyY.shift(); }
    },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d'); c.clearRect(0, 0, c.canvas.width, c.canvas.height); this.drawGrid(c); const isDark = document.body.classList.contains('dark');
        const px = 400, py = 65; const L1 = this.initValues.L1, L2 = this.initValues.L2; const pixL1 = L1 * 100, pixL2 = L2 * 100; const { theta1, theta2, historyX, historyY } = this.state;
        const x1 = px + pixL1 * Math.sin(theta1); const y1 = py + pixL1 * Math.cos(theta1); const x2 = x1 + pixL2 * Math.sin(theta2); const y2 = y1 + pixL2 * Math.cos(theta2);
        drawPhysicsHatch(c, 200, 600, py, isDark, 24);
        c.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(x1, y1); c.stroke();
        const gr1 = c.createRadialGradient(x1-5, y1-5, 0, x1, y1, 16); gr1.addColorStop(0, '#f1f5f9'); gr1.addColorStop(1, '#64748b'); c.fillStyle = gr1; c.beginPath(); c.arc(x1, y1, 16, 0, Math.PI*2); c.fill();
        c.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        if(historyX.length > 2) {
            c.beginPath(); c.moveTo(historyX[0], historyY[0]); for(let i=1; i<historyX.length; i++) { c.lineTo(historyX[i], historyY[i]); }
            c.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.5)'; c.lineWidth = 2.5; c.shadowColor = isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(200, 150, 0, 0.2)'; c.shadowBlur = 15; c.stroke(); c.shadowBlur = 0;
        }
        const gr2 = c.createRadialGradient(x2-6, y2-6, 0, x2, y2, 22); gr2.addColorStop(0, '#f1f5f9'); gr2.addColorStop(1, '#64748b'); c.fillStyle = gr2; c.beginPath(); c.arc(x2, y2, 22, 0, Math.PI*2); c.fill();
        this.updateDataPanel();
    },
    updateDataPanel() { 
        const dataItem = (label, value, unit) => `<div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2"><span class="text-secondary text-sm">${label}</span><span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span></div>`;
        document.getElementById('data-container').innerHTML = dataItem('运行时间', this.state.t.toFixed(2), 's') + dataItem('上摆角 θ₁', (this.state.theta1 * 180 / Math.PI).toFixed(1), '°') + dataItem('下摆角 θ₂', (this.state.theta2 * 180 / Math.PI).toFixed(1), '°') + dataItem('角速度 ω₁', this.state.omega1.toFixed(2), 'rad/s');
    }
};

// ==================== 5. 平抛运动实验 ====================
const ProjectileModule = {
    id: 'projectile', title: '平抛运动实验', desc: '二维运动合成与分解',
    icon: `<svg class="w-6 h-6 text-main" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`,
    state: null, speed: 1, initValues: { vx: 8, vy: 0, g: 9.8, h: 100 },
    createState() {
        const self = this;
        return {
            init() {
                const g = self.initValues.g, h = self.initValues.h; const startX = 100; const startY = 50 + (350 * (1 - h / 200));
                self.state = { x: startX, y: startY, vx: self.initValues.vx, vy: self.initValues.vy, t: 0, lastTime: 0, playing: false, animId: null, historyX: [], historyY: [], startX: startX, startY: startY };
            },
            setSpeed(s) { self.speed = s; }, destroy() { if(this.playing) this.togglePlay(); }, draw() { self.draw(); }, reset() { self.reset(); }, step() { self.step(); }, togglePlay() { self.togglePlay(); }
        };
    },
    renderParams() {
        const p = [{ id: 'vx', name: '水平初速 vₓ', min: -15, max: 25, def: this.initValues.vx, unit: 'm/s' }, { id: 'vy', name: '竖直初速 vᵧ', min: -20, max: 20, def: this.initValues.vy, unit: 'm/s' }, { id: 'g', name: '重力加速度 g', min: 1, max: 20, def: this.initValues.g, unit: 'm/s²' }, { id: 'h', name: '下落高度 h', min: 10, max: 200, def: this.initValues.h, unit: 'm' }];
        return p.map(p => `<div class="slider-container mb-5 last:mb-0"><div class="flex justify-between text-sm mb-2 items-center"><span class="text-main font-medium">${p.name}</span><div class="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md"><input type="number" id="num-${p.id}" class="param-input" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('projectile').updateParam('${p.id}', this.value)" /><span class="text-xs text-muted ml-1">${p.unit}</span></div></div><input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="0.1" value="${p.def}" oninput="App.getModule('projectile').updateParam('${p.id}', this.value)" style="background: linear-gradient(to right, #475569 0%, #475569 ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) ${((p.def - p.min) / (p.max - p.min)) * 100}%, rgba(0,0,0,0.10) 100%);"></div>`).join('');
    },
    updateParam(id, val) { const v = parseFloat(val); if (isNaN(v)) return; this.initValues[id] = v; document.getElementById(`num-${id}`).value = v.toFixed(1); const s = document.getElementById(`slider-${id}`); const pct = ((v - s.min) / (s.max - s.min)) * 100; s.style.background = `linear-gradient(to right, #475569 0%, #475569 ${pct}%, rgba(0,0,0,0.10) ${pct}%, rgba(0,0,0,0.10) 100%)`; this.reset(); },
    renderTheory() { return `<p>• 水平方向：匀速直线运动 $x = v_x t$</p><p>• 竖直方向：自由落体运动 $y = \\frac{1}{2} g t^2$</p><p>• 合速度：$v = \\sqrt{v_x^2 + v_y^2}$，箭头展示运动合成。</p>`; },
    reset() { if (this.state.playing) this.togglePlay(); this.state.t = 0; this.state.lastTime = 0; this.state.historyX = []; this.state.historyY = []; const startX = 100; const startY = 50 + (350 * (1 - this.initValues.h / 200)); this.state.x = startX; this.state.y = startY; this.state.vx = this.initValues.vx; this.state.vy = this.initValues.vy; this.state.startX = startX; this.state.startY = startY; this.draw(); },
    togglePlay() { this.state.playing = !this.state.playing; document.getElementById('play-btn').innerHTML = this.state.playing ? '⏸ 暂停' : '▶ 开始'; if (this.state.playing) { this.state.lastTime = performance.now(); this.loop(); } else if (this.state.animId) { cancelAnimationFrame(this.state.animId); this.state.animId = null; } },
    loop() { if (!this.state.playing) return; const now = performance.now(); let dt = (now - this.state.lastTime) / 1000 * this.speed; if (dt > 0.2) dt = 0.016 * this.speed; dt = Math.min(dt, 0.016 * this.speed); this.state.lastTime = now; this.updatePhysics(dt); this.draw(); this.state.animId = requestAnimationFrame(() => this.loop()); },
    step() { if (this.state.playing) return; this.updatePhysics(0.016 * this.speed); this.draw(); },
    updatePhysics(dt) {
        const groundY = 430; const radius = 16; const { vx, g } = this.initValues;
        this.state.t += dt; let newVy = this.state.vy + g * dt; let newY = this.state.y + this.state.vy * dt; let newX = this.state.x + this.state.vx * dt;
        if (newY >= groundY - radius) { this.state.y = groundY - radius; this.state.vx = 0; this.state.vy = 0; this.state.playing = false; document.getElementById('play-btn').innerHTML = '▶ 开始'; } else { this.state.y = newY; this.state.vy = newVy; this.state.x = newX; }
        if (this.state.playing || this.state.vy !== 0) { this.state.historyX.push(this.state.x); this.state.historyY.push(this.state.y); if (this.state.historyX.length > 800) { this.state.historyX.shift(); this.state.historyY.shift(); } }
        if (this.state.y < -50) { this.reset(); }
    },
    drawGrid(c) { const s = document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.strokeStyle = s; c.lineWidth = 1; for (let x=0; x<c.canvas.width; x+=40) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,c.canvas.height); c.stroke(); } for (let y=0; y<c.canvas.height; y+=40) { c.beginPath(); c.moveTo(0,y); c.lineTo(c.canvas.width,y); c.stroke(); } },
    draw() {
        const c = document.getElementById('expCanvas').getContext('2d'); c.clearRect(0, 0, c.canvas.width, c.canvas.height); this.drawGrid(c); const isDark = document.body.classList.contains('dark');
        const groundY = 430; drawPhysicsHatch(c, 40, 760, groundY, isDark, 24);
        const { historyX, historyY, x, y } = this.state;
        if (historyX.length > 2) { c.beginPath(); c.moveTo(historyX[0], historyY[0]); for(let i=1; i<historyX.length; i++) { c.lineTo(historyX[i], historyY[i]); } c.strokeStyle = isDark ? 'rgba(52, 211, 153, 0.6)' : 'rgba(16, 185, 129, 0.7)'; c.lineWidth = 2.5; c.shadowColor = isDark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(16, 185, 129, 0.2)'; c.shadowBlur = 12; c.stroke(); c.shadowBlur = 0; }
        c.save(); c.shadowColor = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'; c.shadowBlur = 12; const gr = c.createRadialGradient(x-5, y-5, 0, x, y, 16); gr.addColorStop(0, '#f1f5f9'); gr.addColorStop(1, '#64748b'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, 16, 0, Math.PI*2); c.fill(); c.shadowBlur = 0; c.restore();
        const { vx, vy } = this.state; const minSpeed = 0.5; const showVx = Math.abs(vx) > minSpeed; const showVy = Math.abs(vy) > minSpeed;
        if (showVx || showVy) {
            const arrowScale = 2.0; const maxLen = 120; const startX = x, startY = y + 24; const vxEnd = startX + vx * arrowScale; const vyEnd = startY + vy * arrowScale;
            const drawArrow = (startX, startY, endX, endY, color, label) => {
                const dx = endX - startX, dy = endY - startY;
                const mag = Math.hypot(dx, dy);
                if (mag < 2) return;
                const ux = dx / mag, uy = dy / mag;
                const len = Math.min(mag, maxLen);
                const ex = startX + ux * len;
                const ey = startY + uy * len;
                const headLen = 12;
                const ang = Math.atan2(uy, ux);
                const bx = ex - headLen * Math.cos(ang);
                const by = ey - headLen * Math.sin(ang);
                c.strokeStyle = color; c.lineWidth = 3;
                c.beginPath(); c.moveTo(startX, startY); c.lineTo(bx, by); c.stroke();
                const offset = 6;
                c.fillStyle = color;
                c.beginPath(); c.moveTo(ex, ey);
                c.lineTo(bx - offset * Math.sin(ang), by + offset * Math.cos(ang));
                c.lineTo(bx + offset * Math.sin(ang), by - offset * Math.cos(ang));
                c.closePath(); c.fill();
                c.font = 'bold 16px "Inter", sans-serif';
                c.textAlign = 'center'; c.textBaseline = 'bottom';
                const labelOffset = 20;
                const labelX = ex + Math.cos(ang) * labelOffset;
                const labelY = ey + Math.sin(ang) * labelOffset + 6;
                c.lineWidth = 4;
                c.strokeStyle = isDark ? '#0f172a' : '#ffffff';
                c.strokeText(label, labelX, labelY);
                c.fillStyle = color;
                c.fillText(label, labelX, labelY);
            };
            if (showVx && showVy) { drawArrow(startX, startY, vxEnd, startY, '#3b82f6', 'vₓ'); drawArrow(startX, startY, startX, vyEnd, '#ef4444', 'vᵧ'); drawArrow(startX, startY, vxEnd, vyEnd, '#fbbf24', 'v'); }
            else { drawArrow(startX, startY, vxEnd, vyEnd, '#fbbf24', 'v'); }
        }
        this.updateDataPanel();
    },
    updateDataPanel() { const dataItem = (label, value, unit) => `<div class="flex justify-between items-center py-2 border-t border-border-color first:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded px-2 -mx-2"><span class="text-secondary text-sm">${label}</span><span class="data-display font-medium text-main">${value} <span class="text-xs text-muted">${unit}</span></span></div>`; const t = this.state.t; const vx = this.initValues.vx; const vy = this.state.vy; const v = Math.hypot(vx, vy); document.getElementById('data-container').innerHTML = dataItem('运行时间', t.toFixed(2), 's') + dataItem('水平位移', (this.state.x - this.state.startX).toFixed(1), 'm') + dataItem('竖直位移', (this.state.y - this.state.startY).toFixed(1), 'm') + dataItem('合速度', v.toFixed(2), 'm/s'); }
};

// ==================== 注册所有实验模块 ====================
App.registerModule(UniformModule);
App.registerModule(FreefallModule);
App.registerModule(PendulumModule);
App.registerModule(DoublePendulumModule);
App.registerModule(ProjectileModule);