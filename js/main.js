const App = {
    modules: [], container: null, currentExpId: null,
    _themeDrawTimer: null,

    init() {
        try {
            console.log("🚀 App 初始化开始...");
            this.container = document.getElementById('app');
            this.bindThemeToggle();

            let hash = window.location.hash.slice(1);
            let path = hash || 'main';
            this.handleRoute(path);

            window.addEventListener('hashchange', () => {
                let hash = window.location.hash.slice(1);
                let path = hash || 'main';
                this.handleRoute(path);
            });

            document.addEventListener('click', (e) => {
                const link = e.target.closest('[data-link]');
                if(link) {
                    e.preventDefault();
                    const href = link.getAttribute('href');
                    window.location.hash = href;
                }
            });
        } catch (error) {
            console.error("❌ App初始化严重错误:", error);
            document.getElementById('app').innerHTML = `<div style="color:red;padding:20px;background:white;border-radius:8px;"><h3>初始化出错</h3><p>请按 F12 查看控制台错误详情。</p><pre>${error.message}</pre></div>`;
        }
    },
    registerModule(module) { this.modules.push(module); },
    getModule(id) { return this.modules.find(m => m.id === id); },
    handleRoute(route) {
        const backBtn = document.getElementById('back-home-btn');
        const cleanRoute = route.replace(/^\/+/, '') || 'main';

        if(cleanRoute === 'main') {
            backBtn.classList.add('hidden');
            this.renderHome();
        }
        else {
            const module = this.getModule(cleanRoute);
            if(module) {
                backBtn.classList.remove('hidden');
                this.renderExperiment(module);
            }
            else {
                window.location.hash = 'main';
                backBtn.classList.add('hidden');
            }
        }
    },
    goHome() { window.location.hash = 'main'; },
    renderHome() {
        this.container.innerHTML = `
            <div class="mb-8 animate-fadeInUp"><h2 class="text-3xl font-bold text-main mb-2">选择实验</h2><p class="text-secondary text-sm">请选择一个物理实验开始模拟探究</p></div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
                ${this.modules.map(m => `<div class="acrylic-card rounded-2xl p-6 cursor-pointer hover:scale-[1.02] transition-all" data-link href="/${m.id}"><div class="w-14 h-14 rounded-xl bg-white/40 dark:bg-white/10 flex items-center justify-center mb-4 shadow-inner">${m.icon}</div><h3 class="text-lg font-semibold mb-1 text-main">${m.title}</h3><p class="text-sm text-secondary">${m.desc}</p></div>`).join('')}
            </div>
        `;
    },
    renderExperiment(module) {
        if (window._currentAnimId) { cancelAnimationFrame(window._currentAnimId); window._currentAnimId = null; }
        if (window._expState && window._expState.destroy) window._expState.destroy();
        const state = module.createState();
        window._expState = state;
        this.currentExpId = module.id;

        this.container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeInUp">
                <div class="lg:col-span-2"><div class="acrylic rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-4 flex-wrap gap-2 border-b border-border-color/50 pb-3">
                        <h2 class="text-lg font-semibold text-main">${module.title}</h2>
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="flex items-center gap-1 bg-white/40 dark:bg-white/5 rounded-lg p-1 shadow-sm speed-btn-group">
                                <button class="speed-btn px-2 py-1 text-xs rounded-md text-main" data-speed="0.5">0.5×</button>
                                <button class="speed-btn px-2 py-1 text-xs rounded-md active-speed text-main" data-speed="1">1×</button>
                                <button class="speed-btn px-2 py-1 text-xs rounded-md text-main" data-speed="2">2×</button>
                                <button class="speed-btn px-2 py-1 text-xs rounded-md text-main" data-speed="5">5×</button>
                            </div>
                            <button class="glass-btn px-3 py-1.5 rounded-lg text-sm font-medium text-main" onclick="App.getModule('${module.id}').reset()">⟳ 重置</button>
                            <button class="glass-btn px-3 py-1.5 rounded-lg text-sm font-medium text-main" onclick="App.getModule('${module.id}').step()">⏭ 步进</button>
                            <button class="glass-btn-primary px-4 py-1.5 rounded-lg text-sm font-medium" id="play-btn" onclick="App.getModule('${module.id}').togglePlay()">▶ 开始</button>
                        </div>
                    </div>
                    <canvas id="expCanvas" width="800" height="450" class="w-full rounded-xl shadow-inner border border-white/20 dark:border-white/5" style="height: auto; aspect-ratio: 800 / 450;"></canvas>
                    <div class="mt-4 grid grid-cols-2 gap-4">
                        <div class="acrylic-dark rounded-xl p-3"><p class="text-xs text-secondary mb-2 font-mono tracking-wide">速度-时间图像 (v-t)</p><canvas id="vtChart" width="440" height="160" class="w-full rounded-lg" style="height: auto; aspect-ratio: 440 / 160;"></canvas></div>
                        <div class="acrylic-dark rounded-xl p-3"><p class="text-xs text-secondary mb-2 font-mono tracking-wide">位移-时间图像 (s-t)</p><canvas id="stChart" width="440" height="160" class="w-full rounded-lg" style="height: auto; aspect-ratio: 440 / 160;"></canvas></div>
                    </div>
                </div></div>
                <div class="space-y-4 max-h-[660px] overflow-y-auto scrollbar-thin pr-2 custom-scrollbar">
                    <div class="acrylic rounded-2xl p-5"><h3 class="font-semibold mb-4 flex items-center gap-2 text-main"><svg class="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>参数调节</h3><div id="params-container" class="space-y-5">${module.renderParams ? module.renderParams() : ''}</div></div>
                    <div class="acrylic rounded-2xl p-5"><h3 class="font-semibold mb-4 flex items-center gap-2 text-main"><svg class="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>实时数据</h3><div id="data-container" class="space-y-1"></div></div>
                    <div class="acrylic rounded-2xl p-5"><h3 class="font-semibold mb-3 flex items-center gap-2 text-main"><svg class="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>实验原理</h3><div id="theory-container" class="text-sm text-main leading-relaxed space-y-1.5">${module.renderTheory()}</div></div>
                </div>
            </div>
        `;
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active-speed'));
                this.classList.add('active-speed');
                if(window._expState && window._expState.setSpeed) window._expState.setSpeed(parseFloat(this.dataset.speed));
            });
        });

        try {
            state.init();
            state.draw();
            if (window.renderMathInElement) {
                window.renderMathInElement(document.getElementById('theory-container'), {
                    delimiters: [{ left: '$', right: '$', display: false }],
                    throwOnError: false
                });
            }
        } catch(e) {
            console.error(`❌ 渲染实验 ${module.id} 时出现严重错误:`, e);
        }
    },
    bindThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        if(!toggleBtn) return;
        const savedTheme = localStorage.getItem('theme');
        if(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.body.classList.add('dark');
        
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
            clearTimeout(this._themeDrawTimer);
            this._themeDrawTimer = setTimeout(() => {
                if (window._expState && window._expState.draw) {
                    window._expState.draw();
                }
                const theoryContainer = document.getElementById('theory-container');
                if (theoryContainer && window.renderMathInElement) {
                    theoryContainer.innerHTML = theoryContainer.innerHTML;
                    window.renderMathInElement(theoryContainer, {
                        delimiters: [{ left: '$', right: '$', display: false }],
                        throwOnError: false
                    });
                }
            }, 50);
        });
    }
};
document.addEventListener('DOMContentLoaded', () => App.init());