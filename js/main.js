// ==================== 全局状态 ====================
let currentExperiment = 'uniform';
let isPlaying = false;
let animationId = null;
let time = 0;
let lastTime = null;
let dataHistory = { v: [], s: [], t: [] };
let state = {};
let speedMultiplier = 1;          // 新增：速度倍率

const canvas = document.getElementById('experimentCanvas');
const ctx = canvas.getContext('2d');
const vtCanvas = document.getElementById('vtChart');
const vtCtx = vtCanvas.getContext('2d');
const stCanvas = document.getElementById('stChart');
const stCtx = stCanvas.getContext('2d');

// ==================== 斜面配置 ====================
const slopeConfig = {
    startX: 100,
    startY: 80,
    endX: 700,
    endY: 380,
    pixelPerMeter: 30
};
slopeConfig.angle = Math.atan2(slopeConfig.endY - slopeConfig.startY, slopeConfig.endX - slopeConfig.startX);
slopeConfig.totalPixelLength = Math.hypot(slopeConfig.endX - slopeConfig.startX, slopeConfig.endY - slopeConfig.startY);
slopeConfig.maxDistance = slopeConfig.totalPixelLength / slopeConfig.pixelPerMeter;

// ==================== 实验配置数据（移除 balance） ====================
const experiments = {
    uniform: {
        title: '匀变速直线运动实验（斜面木块）',
        params: [
            { id: 'v0', name: '初速度 v₀', min: 0, max: 5, step: 0.5, default: 0, unit: 'm/s' },
            { id: 'a', name: '加速度 a', min: -5, max: 10, step: 0.5, default: 4, unit: 'm/s²' }
        ],
        values: { v0: 0, a: 4 },
        theory: [
            '速度公式：$v = v_0 + at$',
            '位移公式：$s = v_0 t + \\frac{1}{2} a t^2$',
            '速度位移关系：$v^2 - v_0^2 = 2 a s$',
            '匀变速直线运动的v-t图像为倾斜直线，斜率表示加速度。'
        ]
    },
    freefall: {
        title: '自由落体实验',
        params: [
            { id: 'h', name: '下落高度 h', min: 10, max: 200, step: 5, default: 100, unit: 'm' },
            { id: 'g', name: '重力加速度 g', min: 1, max: 20, step: 0.5, default: 9.8, unit: 'm/s²' }
        ],
        values: { h: 100, g: 9.8 },
        theory: [
            '自由落体是初速度为零的匀加速直线运动',
            '速度公式：$v = g t$',
            '位移公式：$h = \\frac{1}{2} g t^2$',
            '下落时间：$t = \\sqrt{\\frac{2h}{g}}$',
            '自由落体运动规律与物体质量无关。'
        ]
    },
    pendulum: {
        title: '单摆实验',
        params: [
            { id: 'L', name: '摆长 L', min: 0.5, max: 3, step: 0.1, default: 1.5, unit: 'm' },
            { id: 'theta0', name: '摆角 θ₀', min: 5, max: 45, step: 1, default: 15, unit: '°' },
            { id: 'g', name: '重力加速度 g', min: 1, max: 20, step: 0.5, default: 9.8, unit: 'm/s²' }
        ],
        values: { L: 1.5, theta0: 15, g: 9.8 },
        theory: [
            '单摆周期公式：$T = 2\\pi \\sqrt{\\frac{L}{g}}$',
            '小角度下周期与振幅、摆球质量无关',
            '摆角小于5°时简谐运动近似成立',
            '角频率：$\\omega = \\sqrt{\\frac{g}{L}}$'
        ]
    }
};

// ==================== 实验切换 ====================
function switchExperiment(expId) {
    currentExperiment = expId;
    isPlaying = false;
    time = 0;
    lastTime = null;
    dataHistory = { v: [], s: [], t: [] };

    document.querySelectorAll('.acrylic-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.exp === expId) card.classList.add('active');
    });

    document.getElementById('exp-title').textContent = experiments[expId].title;
    document.getElementById('play-btn').innerHTML = '▶ 开始';

    renderParams();
    renderTheory();
    resetExperimentState();
    draw();

    renderMathInElement(document.getElementById('theory-container'), {
        delimiters: [{ left: '$', right: '$', display: false }],
        throwOnError: false
    });
}

// ==================== 参数面板渲染 ====================
function renderParams() {
    const container = document.getElementById('params-container');
    const exp = experiments[currentExperiment];

    container.innerHTML = exp.params.map(p => `
        <div class="slider-container">
            <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-700">${p.name}</span>
                <span class="data-display font-medium text-gray-800" id="val-${p.id}">${p.default} ${p.unit}</span>
            </div>
            <input type="range" id="slider-${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}"
                oninput="updateParam('${p.id}', this.value, '${p.unit}')">
        </div>
    `).join('');
}

function updateParam(id, value, unit) {
    experiments[currentExperiment].values[id] = parseFloat(value);
    document.getElementById(`val-${id}`).textContent = value + ' ' + unit;
    if (currentExperiment === 'freefall') {
        resetExperimentState();  // 重新计算虚影时刻
    }
    if (!isPlaying) {
        resetExperimentState();
    }
    draw();
}

// ==================== 原理面板渲染 ====================
function renderTheory() {
    const container = document.getElementById('theory-container');
    const exp = experiments[currentExperiment];
    container.innerHTML = exp.theory.map(t => `<p>• ${t}</p>`).join('');
}

// ==================== 播放控制 ====================
function togglePlay() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('play-btn');
    btn.innerHTML = isPlaying ? '⏸ 暂停' : '▶ 开始';

    if (isPlaying) {
        lastTime = null;
        animationId = requestAnimationFrame(animate);
    } else {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    }
}

// ==================== 速度倍率控制 ====================
function setSpeed(mult) {
    speedMultiplier = mult;
    // 更新按钮高亮
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.remove('active-speed');
        if (parseFloat(btn.dataset.speed) === mult) {
            btn.classList.add('active-speed');
        }
    });
}

// 绑定速度按钮事件（在 DOM 加载后执行）
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setSpeed(parseFloat(this.dataset.speed));
        });
    });
    // 默认激活 1×
    setSpeed(1);
});

// ==================== 重置实验 ====================
function resetExperiment() {
    // 若正在播放则暂停
    if (isPlaying) {
        togglePlay(); // 暂停
    }
    time = 0;
    lastTime = null;
    dataHistory = { v: [], s: [], t: [] };
    resetExperimentState();  // 内部会重新计算虚影（自由落体）
    draw();
}

// ==================== 步进（逐帧） ====================
function stepForward() {
    if (isPlaying) return; // 播放时步进无效
    const dt = 0.02 * speedMultiplier; // 固定小步长，受倍率影响
    updatePhysics(dt);
    draw();
}

// ==================== 自由落体虚影时刻计算 ====================
function computeFreefallTrails() {
    const vals = experiments.freefall.values;
    const h = vals.h;
    const g = vals.g;
    const T = Math.sqrt(2 * h / g);
    const times = [];
    for (let i = 1; i <= 5; i++) {
        times.push((i - 0.5) * T / 5);
    }
    state.trails = times.map(t => ({
        time: t,
        generated: false,
        x: 400,
        y: 0
    }));
}

// ==================== 实验状态重置 ====================
function resetExperimentState() {
    const vals = experiments[currentExperiment].values;

    switch (currentExperiment) {
        case 'uniform':
            state = { s: 0, v: vals.v0 };
            break;
        case 'freefall':
            state = { s: 0, v: 0 };
            computeFreefallTrails();
            break;
        case 'pendulum':
            const theta0 = vals.theta0 * Math.PI / 180;
            state = {
                theta: theta0,
                omega: 0,
                initialEnergy: vals.g * vals.L * (1 - Math.cos(theta0))
            };
            break;
    }
}

// ==================== 物理更新 ====================
function updatePhysics(dt) {
    const vals = experiments[currentExperiment].values;
    time += dt;

    switch (currentExperiment) {
        case 'uniform': {
            const maxS = slopeConfig.maxDistance;
            const newV = state.v + vals.a * dt;
            const newS = state.s + state.v * dt + 0.5 * vals.a * dt * dt;

            if ((newS >= maxS && newV > 0) || (newS <= 0 && newV < 0)) {
                time = 0;
                resetExperimentState();
                dataHistory = { v: [], s: [], t: [] };
            } else {
                state.v = newV;
                state.s = Math.max(0, Math.min(maxS, newS));
            }

            dataHistory.t.push(time);
            dataHistory.v.push(state.v);
            dataHistory.s.push(state.s);
            break;
        }

        case 'freefall': {
            const newV = state.v + vals.g * dt;
            const newS = state.s + state.v * dt + 0.5 * vals.g * dt * dt;

            if (newS >= vals.h) {
                time = 0;
                resetExperimentState();
                dataHistory = { v: [], s: [], t: [] };
            } else {
                state.v = newV;
                state.s = newS;

                // 检查虚影生成
                const scale = 350 / vals.h;
                const startY = 50;
                for (let i = 0; i < state.trails.length; i++) {
                    const trail = state.trails[i];
                    if (!trail.generated && time >= trail.time) {
                        const y = startY + state.s * scale;
                        trail.generated = true;
                        trail.y = y;
                    }
                }
            }

            dataHistory.t.push(time);
            dataHistory.v.push(state.v);
            dataHistory.s.push(state.s);
            break;
        }

        case 'pendulum': {
            const alpha = -(vals.g / vals.L) * Math.sin(state.theta);
            state.omega += alpha * dt;
            state.theta += state.omega * dt;

            const currentEnergy = 0.5 * vals.L * vals.L * state.omega * state.omega
                                + vals.g * vals.L * (1 - Math.cos(state.theta));
            if (currentEnergy > 1e-6) {
                const energyScale = Math.sqrt(state.initialEnergy / currentEnergy);
                state.omega *= energyScale;
            }

            const linearV = state.omega * vals.L;
            const arc = state.theta * vals.L;

            dataHistory.t.push(time);
            dataHistory.v.push(Math.abs(linearV));
            dataHistory.s.push(arc);
            break;
        }
    }

    if (dataHistory.t.length > 200) {
        dataHistory.t.shift();
        dataHistory.v.shift();
        dataHistory.s.shift();
    }
}

// ==================== 主绘制入口 ====================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    switch (currentExperiment) {
        case 'uniform': drawUniformMotion(); break;
        case 'freefall': drawFreeFall(); break;
        case 'pendulum': drawPendulum(); break;
    }

    drawCharts();
    updateDataDisplay();
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// ==================== 匀变速直线运动绘制 ====================
function drawUniformMotion() {
    const { startX, startY, endX, endY, angle, pixelPerMeter } = slopeConfig;

    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.moveTo(startX - 20, startY);
    ctx.lineTo(endX + 20, endY);
    ctx.lineTo(endX + 20, endY + 20);
    ctx.lineTo(startX - 20, startY + 20);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '10px monospace';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 6; i++) {
        const s = i * 3;
        const px = startX + s * pixelPerMeter * Math.cos(angle);
        const py = startY + s * pixelPerMeter * Math.sin(angle);

        if (px > endX) break;

        const perpX = -Math.sin(angle) * 8;
        const perpY = Math.cos(angle) * 8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + perpX, py + perpY);
        ctx.stroke();

        ctx.save();
        ctx.translate(px + perpX * 1.5, py + perpY * 1.5);
        ctx.rotate(angle);
        ctx.textAlign = 'center';
        ctx.fillText(s + 'm', 0, 4);
        ctx.restore();
    }

    const pixelDist = state.s * pixelPerMeter;
    const blockX = startX + pixelDist * Math.cos(angle);
    const blockY = startY + pixelDist * Math.sin(angle);

    ctx.save();
    ctx.translate(blockX, blockY);
    ctx.rotate(angle);

    const gradient = ctx.createLinearGradient(0, -18, 0, 18);
    gradient.addColorStop(0, '#fbbf24');
    gradient.addColorStop(1, '#d97706');
    ctx.fillStyle = gradient;
    ctx.fillRect(-22, -18, 44, 36);

    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.strokeRect(-22, -18, 44, 36);

    ctx.strokeStyle = 'rgba(120, 53, 15, 0.3)';
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i += 8) {
        ctx.beginPath();
        ctx.moveTo(-20, i);
        ctx.lineTo(20, i);
        ctx.stroke();
    }

    ctx.restore();

    if (Math.abs(state.v) > 0.1) {
        const arrowLen = state.v * 8;
        const arrowStartY = -25;

        ctx.save();
        ctx.translate(blockX, blockY);
        ctx.rotate(angle);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, arrowStartY);
        ctx.lineTo(arrowLen, arrowStartY);
        ctx.stroke();

        const dir = state.v > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(arrowLen, arrowStartY);
        ctx.lineTo(arrowLen - 8 * dir, arrowStartY - 5);
        ctx.lineTo(arrowLen - 8 * dir, arrowStartY + 5);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.restore();
    }
}

// ==================== 自由落体绘制（动态生成5个虚影） ====================
function drawFreeFall() {
    const vals = experiments.freefall.values;
    const scale = 350 / vals.h;
    const startY = 50;
    const groundY = startY + 350;
    const ballX = 400;
    const ballY = startY + state.s * scale;

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '10px monospace';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
        const y = startY + i * 70;
        ctx.beginPath();
        ctx.moveTo(60, y);
        ctx.lineTo(80, y);
        ctx.stroke();
        ctx.fillText(Math.round(vals.h - i * vals.h / 5) + 'm', 20, y + 4);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, groundY, canvas.width, 50);

    // 绘制已生成的虚影
    if (state.trails) {
        for (let i = 0; i < state.trails.length; i++) {
            const trail = state.trails[i];
            if (trail.generated) {
                const grad = ctx.createRadialGradient(trail.x - 4, trail.y - 4, 0, trail.x, trail.y, 18);
                grad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
                grad.addColorStop(1, 'rgba(37, 99, 235, 0.25)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(trail.x, trail.y, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    // 当前小球
    const gradient = ctx.createRadialGradient(ballX - 5, ballY - 5, 0, ballX, ballY, 18);
    gradient.addColorStop(0, '#93c5fd');
    gradient.addColorStop(1, '#3b82f6');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 18, 0, Math.PI * 2);
    ctx.fill();

    if (state.v > 0.1) {
        const arrowLen = Math.min(state.v * 3, 80);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ballX + 30, ballY);
        ctx.lineTo(ballX + 30, ballY + arrowLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ballX + 30, ballY + arrowLen);
        ctx.lineTo(ballX + 25, ballY + arrowLen - 8);
        ctx.lineTo(ballX + 35, ballY + arrowLen - 8);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
    }
}

// ==================== 单摆绘制 ====================
function drawPendulum() {
    const vals = experiments.pendulum.values;
    const pivotX = 400;
    const pivotY = 60;
    const pixelL = vals.L * 120;

    const bobX = pivotX + pixelL * Math.sin(state.theta);
    const bobY = pivotY + pixelL * Math.cos(state.theta);

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(300, 40, 200, 15);

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    const gradient = ctx.createRadialGradient(bobX - 5, bobY - 5, 0, bobX, bobY, 22);
    gradient.addColorStop(0, '#f0abfc');
    gradient.addColorStop(1, '#a855f7');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bobX, bobY, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 40, Math.PI / 2, Math.PI / 2 - state.theta, state.theta > 0);
    ctx.stroke();

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + pixelL + 30);
    ctx.stroke();
    ctx.setLineDash([]);

    const vMag = Math.abs(state.omega * vals.L);
    if (vMag > 0.05) {
        const vDir = state.omega > 0 ? 1 : -1;
        const vx = bobX + vDir * Math.cos(state.theta) * vMag * 20;
        const vy = bobY - vDir * Math.sin(state.theta) * vMag * 20;

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bobX, bobY);
        ctx.lineTo(vx, vy);
        ctx.stroke();
    }
}

// ==================== 图表绘制 ====================
function drawCharts() {
    drawLineChart(vtCtx, vtCanvas, dataHistory.t, dataHistory.v, '#fbbf24');
    drawLineChart(stCtx, stCanvas, dataHistory.t, dataHistory.s, '#4ade80');
}

function drawLineChart(c, canv, xData, yData, color) {
    c.clearRect(0, 0, canv.width, canv.height);

    if (xData.length < 2) return;

    const maxY = Math.max(...yData, 0.1);
    const padding = 5;
    const w = canv.width - padding * 2;
    const h = canv.height - padding * 2;

    c.strokeStyle = 'rgba(0,0,0,0.1)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(padding, canv.height - padding);
    c.lineTo(canv.width - padding, canv.height - padding);
    c.stroke();

    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();

    for (let i = 0; i < xData.length; i++) {
        const px = padding + (i / (xData.length - 1)) * w;
        const py = canv.height - padding - (yData[i] / maxY) * h;

        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
    }
    c.stroke();

    c.lineTo(padding + w, canv.height - padding);
    c.lineTo(padding, canv.height - padding);
    c.closePath();

    const gradient = c.createLinearGradient(0, 0, 0, canv.height);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');
    c.fillStyle = gradient;
    c.fill();
}

// ==================== 数据面板更新 ====================
function updateDataDisplay() {
    const container = document.getElementById('data-container');
    const vals = experiments[currentExperiment].values;
    let html = '';

    const dataItem = (label, value, unit) => `
        <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
            <span class="text-gray-600 text-sm">${label}</span>
            <span class="data-display font-medium text-gray-800">${value} <span class="text-xs text-gray-400">${unit}</span></span>
        </div>
    `;

    switch (currentExperiment) {
        case 'uniform':
            html += dataItem('时间 t', time.toFixed(2), 's');
            html += dataItem('速度 v', state.v.toFixed(2), 'm/s');
            html += dataItem('位移 s', state.s.toFixed(2), 'm');
            html += dataItem('加速度 a', vals.a.toFixed(2), 'm/s²');
            break;

        case 'freefall':
            const fallTime = Math.sqrt(2 * vals.h / vals.g);
            html += dataItem('下落时间', time.toFixed(2), 's');
            html += dataItem('瞬时速度', state.v.toFixed(2), 'm/s');
            html += dataItem('下落距离', state.s.toFixed(2), 'm');
            html += dataItem('理论落地时间', fallTime.toFixed(2), 's');
            break;

        case 'pendulum':
            const T = 2 * Math.PI * Math.sqrt(vals.L / vals.g);
            html += dataItem('运行时间', time.toFixed(2), 's');
            html += dataItem('理论周期 T', T.toFixed(3), 's');
            html += dataItem('摆角 θ', (state.theta * 180 / Math.PI).toFixed(1), '°');
            html += dataItem('角速度 ω', state.omega.toFixed(3), 'rad/s');
            break;
    }

    container.innerHTML = html;
}

// ==================== 动画循环 ====================
function animate(timestamp) {
    if (!isPlaying) return;

    if (lastTime === null) {
        lastTime = timestamp;
        animationId = requestAnimationFrame(animate);
        return;
    }

    // 应用速度倍率，并限制最大步长防止跳帧
    let rawDt = (timestamp - lastTime) / 1000 * speedMultiplier;
    const maxDt = 0.05 * speedMultiplier; // 允许的最大步长
    const dt = Math.min(rawDt, maxDt);
    lastTime = timestamp;

    updatePhysics(dt);
    draw();

    animationId = requestAnimationFrame(animate);
}

// ==================== 初始化 ====================
function init() {
    switchExperiment('uniform');
}

init();
