/* ============================================================
   CubingHQ — Internationalization (English / Português)
   ------------------------------------------------------------
   Lightweight i18n with two mechanisms:
     - Static HTML: elements marked with data-i18n / data-i18n-html /
       data-i18n-placeholder / data-i18n-title are (re)translated on
       load and whenever the language changes.
     - Dynamic JS: modules call AppI18N.t(key, fallback) and re-render
       on the 'app-language-changed' document event.

   The language toggle button is injected into #nav-links so it works
   on both index.html and timer.html without markup changes.
   Choice persists in localStorage ('chq_lang').
   ============================================================ */
(function () {
    'use strict';

    const STORAGE_KEY = 'chq_lang';

    const DICT = {
        en: {
            // ----- Navigation -----
            'nav.home': 'Home',
            'nav.timer': 'Timer',
            'nav.compsim': 'Comp Sim',
            'nav.records': 'Records',
            'nav.competitions': 'Competitions',
            'nav.algorithms': 'Algorithms',
            'nav.history': 'History',
            'nav.battle': 'Battle',
            'nav.login': 'Login',

            // ----- Login modal -----
            'login.welcome': 'Welcome!',
            'login.subtitle': 'Login to access your personalized simulation data.',
            'login.wca': 'Login with WCA',

            // ----- Home view -----
            'home.badge': 'WELCOME TO',
            'home.subtitle': 'The ultimate platform for speedcubers. Simulate real WCA competitions, learn new algorithms, and track your records.',
            'home.card.sim': ' Comp Simulation',
            'home.card.sim.desc': 'Experience the pressure of an official WCA competition with full simulation.',
            'home.card.algs': ' Algorithm Database',
            'home.card.algs.desc': 'Browse thousands of native 2D algorithms across all WCA events.',
            'home.card.records': ' WCA Records',
            'home.card.records.desc': 'Keep track of the latest global, continental, and national records.',
            'home.card.comps': ' Competitions',
            'home.card.comps.desc': 'Track your progress and analyze your personal speedcubing stats.',
            'home.card.battle': ' Battle',
            'home.card.battle.desc': 'Real-time head-to-head speedcubing against other cubers around the world.',

            // ----- Setup (comp sim) hero -----
            'setup.badge': 'WCA COMPETITION SIMULATOR',
            'setup.subtitle': "Enter your WCA ID and competition ID below. We'll pull real competition data, your PRs, and simulate the experience.",

            // ----- Timer view -----
            'timer.newScramble': ' New Scramble',
            'timer.timeList': 'Time List',
            'timer.settings': 'Settings',
            'timer.group.timer': 'Timer',
            'timer.group.display': 'Display',
            'timer.group.data': 'Data',
            'timer.group.about': 'About',
            'timer.set.event': 'Event',
            'timer.set.hold': 'Hold (ms)',
            'timer.set.inspection': 'Inspection',
            'timer.set.voice': 'Voice cues',
            'timer.set.manual': 'Manual entry',
            'timer.set.showSolves': 'Show solves',
            'timer.set.hideTime': 'Hide time while solving',
            'timer.set.hideScramble': 'Hide scramble while solving',
            'timer.opt.off': 'Off',
            'timer.opt.on15': 'On (15s)',
            'timer.opt.on812': 'On (8s, 12s)',
            'timer.opt.all': 'All',
            'timer.opt.last5': 'Last 5',
            'timer.opt.last10': 'Last 10',
            'timer.opt.last20': 'Last 20',
            'timer.opt.last50': 'Last 50',
            'timer.data.desc': 'Auto-saves locally and syncs to cloud when signed in.',
            'timer.data.exportCsv': 'Export current session as CSV',
            'timer.data.clear': 'Clear current session data',
            'timer.clearSession': ' Clear Session',
            'timer.export': ' Export',
            'timer.import': ' Import',
            'timer.submit': 'Submit',
            'timer.delete': ' Delete',
            'timer.hint': 'Space = start/stop · 1=OK · 2=+2 · 3=DNF · Ctrl+Z=delete last',
            'timer.manualHint': 'Type time and press Enter<br><small>e.g. <code>1234</code> = 12.34s &nbsp;·&nbsp; <code>1:05.30</code> = 1m 5.30s</small>',
            'timer.manualPlaceholder': 'Type time...',
            'timer.stopHint': 'Click a penalty or press 1 / 2 / 3 / Esc &nbsp;·&nbsp; Shift+Backspace to delete',
            'timer.about.intro': '<strong>SimTimer</strong> — a csTimer-inspired speedcubing practice tool.',
            'timer.about.features': 'Features:',

            // Dynamic timer strings
            'timer.phase.idle': 'Hold Space / Tap',
            'timer.phase.inspecting': 'Inspecting',
            'timer.phase.holding': 'Hold to ready',
            'timer.phase.ready': 'READY',
            'timer.phase.running': 'Solve!',
            'timer.phase.stopped': 'Stopped',
            'timer.phase.dnf': 'DNF (+2)',
            'timer.generating': 'Generating scramble…',
            'timer.noSolves': 'No solves yet — press space to start!',
            'timer.avgOf5': 'Average of 5',
            'timer.meanOf3': 'Mean of 3',
            'stats.count': 'Solve count',
            'stats.best': 'Best single',
            'stats.mean': 'Mean',
            'stats.std': 'Std dev',
            'stats.bestPrefix': 'Best',
            'stats.currPrefix': 'Curr',
            'stats.success': 'Success',

            // ----- Bluetooth smart cube -----
            'bt.connect': 'Smart Cube',
            'bt.connecting': 'Connecting…',
            'bt.disconnect': 'Disconnect',
            'bt.connected': 'Connected',
            'bt.moves': 'Moves',
            'bt.battery': 'Battery',
            'bt.markSolved': 'Mark as solved',
            'bt.markSolvedHint': 'Hold the cube solved with WHITE on top and GREEN facing you, then click.',
            'bt.notSupported': 'Web Bluetooth is not supported in this browser. Use Chrome or Edge over HTTPS.',
            'bt.connectFailed': 'Could not connect to the smart cube.',
            'bt.followScramble': 'Follow the scramble on the cube — completed moves turn green.',
            'bt.scrambleDone': 'Scramble complete — start solving to start the timer!',
            'bt.solving': 'Solving…',
            'bt.offScramble': 'Off scramble — undo the wrong move or click "Mark as solved" to restart.',
            'bt.only333': 'Smart cube tracking works with 3x3x3 events only.',
        },

        pt: {
            // ----- Navegação -----
            'nav.home': 'Início',
            'nav.timer': 'Cronómetro',
            'nav.compsim': 'Simulação',
            'nav.records': 'Recordes',
            'nav.competitions': 'Competições',
            'nav.algorithms': 'Algoritmos',
            'nav.history': 'Histórico',
            'nav.battle': 'Batalha',
            'nav.login': 'Entrar',

            // ----- Modal de login -----
            'login.welcome': 'Bem-vindo!',
            'login.subtitle': 'Inicia sessão para acederes aos teus dados personalizados de simulação.',
            'login.wca': 'Entrar com a WCA',

            // ----- Página inicial -----
            'home.badge': 'BEM-VINDO AO',
            'home.subtitle': 'A plataforma definitiva para speedcubers. Simula competições WCA reais, aprende novos algoritmos e acompanha os teus recordes.',
            'home.card.sim': ' Simulação de Competição',
            'home.card.sim.desc': 'Vive a pressão de uma competição oficial da WCA com simulação completa.',
            'home.card.algs': ' Base de Algoritmos',
            'home.card.algs.desc': 'Explora milhares de algoritmos 2D nativos de todos os eventos WCA.',
            'home.card.records': ' Recordes WCA',
            'home.card.records.desc': 'Acompanha os recordes mundiais, continentais e nacionais mais recentes.',
            'home.card.comps': ' Competições',
            'home.card.comps.desc': 'Acompanha o teu progresso e analisa as tuas estatísticas de speedcubing.',
            'home.card.battle': ' Batalha',
            'home.card.battle.desc': 'Duelos de speedcubing em tempo real contra cubers de todo o mundo.',

            // ----- Herói da simulação -----
            'setup.badge': 'SIMULADOR DE COMPETIÇÕES WCA',
            'setup.subtitle': 'Introduz o teu WCA ID e o ID da competição. Vamos buscar dados reais da competição e os teus PRs, e simular a experiência.',

            // ----- Cronómetro -----
            'timer.newScramble': ' Novo Scramble',
            'timer.timeList': 'Lista de Tempos',
            'timer.settings': 'Definições',
            'timer.group.timer': 'Cronómetro',
            'timer.group.display': 'Visualização',
            'timer.group.data': 'Dados',
            'timer.group.about': 'Sobre',
            'timer.set.event': 'Evento',
            'timer.set.hold': 'Espera (ms)',
            'timer.set.inspection': 'Inspeção',
            'timer.set.voice': 'Avisos de voz',
            'timer.set.manual': 'Entrada manual',
            'timer.set.showSolves': 'Mostrar tempos',
            'timer.set.hideTime': 'Ocultar tempo durante o solve',
            'timer.set.hideScramble': 'Ocultar scramble durante o solve',
            'timer.opt.off': 'Desligado',
            'timer.opt.on15': 'Ligada (15s)',
            'timer.opt.on812': 'Ligados (8s, 12s)',
            'timer.opt.all': 'Todos',
            'timer.opt.last5': 'Últimos 5',
            'timer.opt.last10': 'Últimos 10',
            'timer.opt.last20': 'Últimos 20',
            'timer.opt.last50': 'Últimos 50',
            'timer.data.desc': 'Guarda automaticamente no dispositivo e sincroniza com a nuvem quando tens sessão iniciada.',
            'timer.data.exportCsv': 'Exportar sessão atual em CSV',
            'timer.data.clear': 'Apagar dados da sessão atual',
            'timer.clearSession': ' Limpar Sessão',
            'timer.export': ' Exportar',
            'timer.import': ' Importar',
            'timer.submit': 'Submeter',
            'timer.delete': ' Apagar',
            'timer.hint': 'Espaço = iniciar/parar · 1=OK · 2=+2 · 3=DNF · Ctrl+Z=apagar último',
            'timer.manualHint': 'Escreve o tempo e prime Enter<br><small>ex.: <code>1234</code> = 12.34s &nbsp;·&nbsp; <code>1:05.30</code> = 1m 5.30s</small>',
            'timer.manualPlaceholder': 'Escreve o tempo...',
            'timer.stopHint': 'Clica numa penalização ou prime 1 / 2 / 3 / Esc &nbsp;·&nbsp; Shift+Backspace para apagar',
            'timer.about.intro': '<strong>SimTimer</strong> — uma ferramenta de treino de speedcubing inspirada no csTimer.',
            'timer.about.features': 'Funcionalidades:',

            // Textos dinâmicos do cronómetro
            'timer.phase.idle': 'Mantém Espaço / Toca',
            'timer.phase.inspecting': 'Inspeção',
            'timer.phase.holding': 'Mantém para preparar',
            'timer.phase.ready': 'PRONTO',
            'timer.phase.running': 'Resolve!',
            'timer.phase.stopped': 'Parado',
            'timer.phase.dnf': 'DNF (+2)',
            'timer.generating': 'A gerar scramble…',
            'timer.noSolves': 'Ainda sem tempos — prime espaço para começar!',
            'timer.avgOf5': 'Média de 5',
            'timer.meanOf3': 'Média de 3',
            'stats.count': 'Nº de solves',
            'stats.best': 'Melhor single',
            'stats.mean': 'Média',
            'stats.std': 'Desvio padrão',
            'stats.bestPrefix': 'Melhor',
            'stats.currPrefix': 'Atual',
            'stats.success': 'Sucesso',

            // ----- Cubo Bluetooth -----
            'bt.connect': 'Cubo Bluetooth',
            'bt.connecting': 'A ligar…',
            'bt.disconnect': 'Desligar',
            'bt.connected': 'Ligado',
            'bt.moves': 'Movimentos',
            'bt.battery': 'Bateria',
            'bt.markSolved': 'Marcar como resolvido',
            'bt.markSolvedHint': 'Segura o cubo resolvido com o BRANCO para cima e o VERDE para ti, e clica.',
            'bt.notSupported': 'O Web Bluetooth não é suportado neste navegador. Usa o Chrome ou o Edge com HTTPS.',
            'bt.connectFailed': 'Não foi possível ligar ao cubo Bluetooth.',
            'bt.followScramble': 'Segue o scramble no cubo — os movimentos feitos ficam verdes.',
            'bt.scrambleDone': 'Scramble completo — começa a resolver para iniciar o cronómetro!',
            'bt.solving': 'A resolver…',
            'bt.offScramble': 'Fora do scramble — desfaz o movimento errado ou clica em "Marcar como resolvido" para recomeçar.',
            'bt.only333': 'O acompanhamento do cubo Bluetooth só funciona em eventos 3x3x3.',
        },
    };

    function detectLang() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'pt' || saved === 'en') return saved;
        const nav = (navigator.language || '').toLowerCase();
        return nav.startsWith('pt') ? 'pt' : 'en';
    }

    let currentLang = detectLang();

    function t(key, fallback) {
        const langDict = DICT[currentLang] || DICT.en;
        if (key in langDict) return langDict[key];
        if (key in DICT.en) return DICT.en[key];
        return fallback !== undefined ? fallback : key;
    }

    // Replace only the text content of an element, preserving child
    // elements such as inline SVG icons: the translated string goes into
    // the last non-empty text node (or is appended if none exists).
    function setText(el, text) {
        let target = null;
        for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') target = node;
        }
        if (target) {
            target.nodeValue = text;
        } else if (el.children.length === 0) {
            el.textContent = text;
        } else {
            el.appendChild(document.createTextNode(text));
        }
    }

    function applyTranslations(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach(el => setText(el, t(el.dataset.i18n)));
        scope.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
        scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
        scope.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
        document.documentElement.lang = currentLang;
        const toggle = document.getElementById('lang-toggle-label');
        if (toggle) toggle.textContent = currentLang.toUpperCase();
    }

    function setLang(lang) {
        if (lang !== 'pt' && lang !== 'en') return;
        currentLang = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
        applyTranslations();
        document.dispatchEvent(new CustomEvent('app-language-changed', { detail: { lang } }));
    }

    function toggleLang() {
        setLang(currentLang === 'en' ? 'pt' : 'en');
    }

    // Inject the language toggle into the nav bar (both pages have #nav-links).
    function injectToggle() {
        const navLinks = document.getElementById('nav-links');
        if (!navLinks || document.getElementById('lang-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'lang-toggle';
        btn.className = 'nav-btn';
        btn.title = 'Português / English';
        btn.setAttribute('aria-label', 'Mudar idioma / Change language');
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span id="lang-toggle-label"></span>';
        btn.addEventListener('click', toggleLang);
        const themeToggle = navLinks.querySelector('.theme-toggle');
        navLinks.insertBefore(btn, themeToggle || null);
    }

    function init() {
        injectToggle();
        applyTranslations();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.AppI18N = { t, setLang, toggleLang, getLang: () => currentLang, apply: applyTranslations };
})();
