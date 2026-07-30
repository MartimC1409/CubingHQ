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
            'nav.more': 'More',
            'nav.theme': 'Theme',

            // ----- Algorithms -----
            'alg.all': 'All',
            'alg.setup': 'Setup',
            'alg.setupCopy': 'Copy setup',
            'alg.setupCopied': 'Setup copied',

            // ----- Theme picker -----
            'theme.title': 'Theme',
            'theme.appearance': 'Appearance',
            'theme.accent': 'Accent',
            'theme.dark': 'Dark',
            'theme.light': 'Light',
            'theme.orange': 'Orange',
            'theme.green': 'Green',
            'theme.blue': 'Blue',
            'theme.red': 'Red',

            // ----- Login modal -----
            'login.welcome': 'Sign in to CubingHQ',
            'login.subtitle': 'Connect your WCA account to make the simulator yours — it takes one click.',
            'login.wca': 'Continue with WCA',
            'login.perk.prs': 'Your personal records fill in the simulator automatically',
            'login.perk.sync': 'Solves and sessions sync across your devices',
            'login.perk.stats': 'See your official WCA profile, medals and records',
            'login.skip': 'Keep browsing without an account',
            'login.note': 'CubingHQ is an unofficial fan project. Signing in only reads your public WCA data — we never post anything.',

            // ----- Records view -----
            'records.title': 'Records',
            'records.subtitle': 'Official WCA records, worldwide and by region',
            'records.filter.event': 'Event',
            'records.filter.region': 'Region',
            'records.filter.type': 'Show',
            'records.allEvents': 'All events',
            'records.world': 'World',
            'records.continents': 'Continents',
            'records.countries': 'Countries',
            'records.type.both': 'Both',
            'records.type.single': 'Single',
            'records.type.average': 'Average',
            'records.col.event': 'Event',
            'records.col.holder': 'Holder',
            'records.col.single': 'Single',
            'records.col.average': 'Average',
            'records.loading': 'Loading records...',
            'records.hint': 'Click any event row to view detailed record information',
            'records.holderNote': 'The WCA records API publishes regional times without names, so holders are only shown for world records.',
            'records.empty.title': 'No records for this selection',
            'records.empty.desc': 'This region has no official record in the selected event yet. Try another region or event.',
            'records.stat.region': 'Region',
            'records.stat.events': 'Events with records',
            'records.stat.fastestSingle': 'Fastest single',
            'records.stat.fastestAverage': 'Fastest average',

            // ----- Home view -----
            'hero.kicker': '// solve · compete · repeat',
            'hero.badge': 'Bluetooth smart cube support is live',
            'hero.badge.cta': 'Try it',
            'hero.mock.title': 'cubinghq — Final · 3×3 · solve 4 of 5',
            'hero.mock.scramble': 'Scramble',
            'hero.mock.live': 'Live results',
            'home.section.title': 'Everything a speedcuber needs',
            'home.section.desc': 'Official WCA scrambles, competition pressure, live opponents and a database of algorithms — all in one place.',
            'hero.title.a': "Train like it's",
            'hero.title.b': 'finals day.',
            'hero.sub': 'Real WCA scrambles, a full competition simulator, live battles and smart-cube support — everything a speedcuber needs, in one place.',
            'hero.cta.sim': 'Start a simulation',
            'hero.cta.timer': 'Open the timer',
            'hero.note': 'Free · no install · works with GAN, GiiKER & GoCube smart cubes',
            'home.card.sim': 'Comp Simulation',
            'home.card.sim.desc': 'Full WCA rounds with real scrambles, scorecards and a live leaderboard — feel the pressure of comp day at home.',
            'home.sim.you': 'You',
            'home.sim.round': 'Final · 3×3 · solve 4/5',
            'home.card.battle': 'Battle',
            'home.card.battle.desc': 'Head-to-head races against cubers around the world, in real time.',
            'home.card.timer': 'Timer',
            'home.card.timer.desc': 'csTimer-style sessions and stats, with smart-cube auto start & stop.',
            'home.card.algs': 'Algorithm Database',
            'home.card.algs.desc': 'From PLL to ZBLL — thousands of cases with native previews.',
            'home.card.records': 'WCA Records',
            'home.card.records.desc': 'World, continental and national records, always current.',
            'home.card.comps': 'Competitions',
            'home.card.comps.desc': "Browse upcoming WCA competitions and see who's going.",

            // ----- Setup (comp sim) hero -----
            'setup.badge': 'WCA COMPETITION SIMULATOR',
            'setup.subtitle': "Enter your WCA ID and competition ID below. We'll pull real competition data, your PRs, and simulate the experience.",
            'sim.spacebarTimer': 'Spacebar',

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
            'bt.only333Connect': 'The smart cube can only be connected in 3x3x3 events.',
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
            'nav.more': 'Mais',
            'nav.theme': 'Tema',

            // ----- Algoritmos -----
            'alg.all': 'Todos',
            'alg.setup': 'Setup',
            'alg.setupCopy': 'Copiar setup',
            'alg.setupCopied': 'Setup copiado',

            // ----- Seletor de tema -----
            'theme.title': 'Tema',
            'theme.appearance': 'Aparência',
            'theme.accent': 'Cor de destaque',
            'theme.dark': 'Escuro',
            'theme.light': 'Claro',
            'theme.orange': 'Laranja',
            'theme.green': 'Verde',
            'theme.blue': 'Azul',
            'theme.red': 'Vermelho',

            // ----- Modal de login -----
            'login.welcome': 'Entrar no CubingHQ',
            'login.subtitle': 'Liga a tua conta WCA para o simulador ser mesmo teu — basta um clique.',
            'login.wca': 'Continuar com a WCA',
            'login.perk.prs': 'Os teus recordes pessoais entram no simulador automaticamente',
            'login.perk.sync': 'Os teus tempos e sessões sincronizam entre dispositivos',
            'login.perk.stats': 'Vê o teu perfil oficial da WCA, medalhas e recordes',
            'login.skip': 'Continuar sem conta',
            'login.note': 'O CubingHQ é um projeto de fãs, não oficial. Ao entrares, apenas lemos os teus dados públicos da WCA — nunca publicamos nada.',

            // ----- Vista de recordes -----
            'records.title': 'Recordes',
            'records.subtitle': 'Recordes oficiais da WCA, mundiais e por região',
            'records.filter.event': 'Evento',
            'records.filter.region': 'Região',
            'records.filter.type': 'Mostrar',
            'records.allEvents': 'Todos os eventos',
            'records.world': 'Mundo',
            'records.continents': 'Continentes',
            'records.countries': 'Países',
            'records.type.both': 'Ambos',
            'records.type.single': 'Single',
            'records.type.average': 'Média',
            'records.col.event': 'Evento',
            'records.col.holder': 'Detentor',
            'records.col.single': 'Single',
            'records.col.average': 'Média',
            'records.loading': 'A carregar recordes...',
            'records.hint': 'Clica numa linha para veres os detalhes do recorde',
            'records.holderNote': 'A API de recordes da WCA publica os tempos regionais sem nomes, por isso só mostramos os detentores nos recordes mundiais.',
            'records.empty.title': 'Sem recordes para esta seleção',
            'records.empty.desc': 'Esta região ainda não tem nenhum recorde oficial no evento escolhido. Experimenta outra região ou outro evento.',
            'records.stat.region': 'Região',
            'records.stat.events': 'Eventos com recorde',
            'records.stat.fastestSingle': 'Single mais rápido',
            'records.stat.fastestAverage': 'Média mais rápida',

            // ----- Página inicial -----
            'hero.kicker': '// resolve · compete · repete',
            'hero.badge': 'Suporte para cubo bluetooth já disponível',
            'hero.badge.cta': 'Experimenta',
            'hero.mock.title': 'cubinghq — Final · 3×3 · solve 4 de 5',
            'hero.mock.scramble': 'Scramble',
            'hero.mock.live': 'Resultados ao vivo',
            'home.section.title': 'Tudo o que um speedcuber precisa',
            'home.section.desc': 'Scrambles oficiais da WCA, pressão de competição, adversários ao vivo e uma base de algoritmos — tudo num só sítio.',
            'hero.title.a': 'Treina como se fosse',
            'hero.title.b': 'dia de final.',
            'hero.sub': 'Scrambles WCA reais, um simulador de competição completo, batalhas ao vivo e suporte para cubos inteligentes — tudo o que um speedcuber precisa, num só sítio.',
            'hero.cta.sim': 'Começar uma simulação',
            'hero.cta.timer': 'Abrir o cronómetro',
            'hero.note': 'Grátis · sem instalação · compatível com cubos GAN, GiiKER e GoCube',
            'home.card.sim': 'Simulação de Competição',
            'home.card.sim.desc': 'Rondas WCA completas com scrambles reais, scorecards e leaderboard ao vivo — sente a pressão do dia da competição em casa.',
            'home.sim.you': 'Tu',
            'home.sim.round': 'Final · 3×3 · solve 4/5',
            'home.card.battle': 'Batalha',
            'home.card.battle.desc': 'Corridas frente a frente contra cubers de todo o mundo, em tempo real.',
            'home.card.timer': 'Cronómetro',
            'home.card.timer.desc': 'Sessões ao estilo csTimer com estatísticas e início/paragem automáticos com cubo bluetooth.',
            'home.card.algs': 'Base de Algoritmos',
            'home.card.algs.desc': 'De PLL a ZBLL — milhares de casos com pré-visualização nativa.',
            'home.card.records': 'Recordes WCA',
            'home.card.records.desc': 'Recordes mundiais, continentais e nacionais, sempre atuais.',
            'home.card.comps': 'Competições',
            'home.card.comps.desc': 'Explora as próximas competições WCA e vê quem vai.',

            // ----- Herói da simulação -----
            'setup.badge': 'SIMULADOR DE COMPETIÇÕES WCA',
            'setup.subtitle': 'Introduz o teu WCA ID e o ID da competição. Vamos buscar dados reais da competição e os teus PRs, e simular a experiência.',
            'sim.spacebarTimer': 'Espaço',

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
            'bt.only333Connect': 'O cubo Bluetooth só pode ser ligado em eventos 3x3x3.',
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
