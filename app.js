/* ============================================================
   CubingHQ — Application Logic (WCA API Integrated)
   ============================================================ */

(function () {
    'use strict';

    // ========== I18N ==========
    // Module-wide shorthand for AppI18N.t(). The English text is always passed
    // as the fallback, so a missing key degrades to the original copy instead
    // of leaking a raw key into the UI.
    const i18nT = (key, fallback) => (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);

    // ========== CONSTANTS ==========
    const WCA_API = 'https://www.worldcubeassociation.org/api/v0';
    const WCA_OAUTH_URL = 'https://www.worldcubeassociation.org/oauth/authorize';
    const WCA_CLIENT_ID = '1JYkddNS-8RmLWFIWcfkzxCDReFBT8lSoOZpY4j4_YY'; // Replace with real Client ID from WCA
    const OAUTH_REDIRECT_URI = window.location.origin + window.location.pathname;

    const EVENT_NAMES = {
        '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
        '666': '6x6x6', '777': '7x7x7', '333oh': '3x3 OH', '333bf': '3x3 BLD',
        '333fm': '3x3 FMC', '333mbf': '3x3 Multi-BLD',
        'pyram': 'Pyraminx', 'skewb': 'Skewb', 'sq1': 'Square-1',
        'minx': 'Megaminx', 'clock': 'Clock',
        '444bf': '4x4 BLD', '555bf': '5x5 BLD'
    };

    // WCA round-naming convention, given the TOTAL number of rounds an
    // event has: the last round is always the Final, the one before it a
    // Semi-Final (only when there are 3+ rounds), and earlier rounds are
    // numbered.  1→Final · 2→Round 1, Final · 3→Round 1, Semi-Final, Final
    // · 4→Round 1, Round 2, Semi-Final, Final.
    function roundNamesFor(total) {
        const t = Math.max(1, total || 1);
        const final = () => i18nT('round.final', 'Final');
        const numbered = (i) => i18nT('round.n', 'Round {n}').replace('{n}', i);
        if (t === 1) return { 1: final() };
        const names = {};
        for (let i = 1; i <= t; i++) {
            if (i === t) names[i] = final();
            else if (i === t - 1 && t >= 3) names[i] = i18nT('round.semi', 'Semi-Final');
            else names[i] = numbered(i);
        }
        return names;
    }

    // Name of `round` within an event that has `total` rounds (defaults to
    // the active simulation's round count).
    function getRoundName(round, total) {
        const t = total || state.numRounds || 4;
        return roundNamesFor(t)[round] || i18nT('round.n', 'Round {n}').replace('{n}', round);
    }

    // ---------- Competitor pacing ----------
    // How long a simulated competitor waits between attempts, in ms. It was
    // 0-30s, which for a ~38s Megaminx meant a whole five-attempt round in
    // just over four minutes — the top competitors were finished before a real
    // person had done their second solve. In an actual competition you queue,
    // get scrambled for and judged between every attempt.
    const ATTEMPT_GAP_MIN = 60000;
    const ATTEMPT_GAP_MAX = 120000;
    const attemptGap = () => ATTEMPT_GAP_MIN + Math.random() * (ATTEMPT_GAP_MAX - ATTEMPT_GAP_MIN);

    // ---------- Advancement ----------
    // The WCA decides who advances with the round's `advancementCondition`,
    // which the WCIF gives us verbatim. This used to be invented — a table of
    // 75%/50%/33% — which is how a competitor who finished 31st at a
    // competition where only the top 14 advanced was told he had gone through.
    //
    // Worse, the end-of-round message and startNextRound() computed it
    // separately and disagreed: the message used the table, the next round cut
    // at a flat 50%. Everything below goes through one function so they cannot
    // drift apart again.

    // The condition for the round being played, or null for a final (and for
    // any round we have no WCIF for).
    function advancementConditionFor(round) {
        const idx = (round || state.round) - 1;
        const r = (state.wcifRounds || [])[idx];
        return (r && r.advancementCondition) || null;
    }

    // The ranking result for one competitor: the average for Ao5/Mo3 rounds,
    // falling back to the single when there is no average yet.
    function rankingResult(c) {
        if (c.average !== undefined && c.average !== Infinity) return c.average;
        return c.best !== undefined ? c.best : Infinity;
    }

    // How many of `standings` (sorted best-first) advance out of `round`, plus
    // a phrase describing the rule so the message can state it rather than
    // leave the competitor guessing.
    function advancementInfo(standings, round) {
        const total = standings.length;
        const cond = advancementConditionFor(round);
        let count = null;
        let rule = '';

        if (cond) {
            if (cond.type === 'ranking') {
                count = cond.level;
                rule = i18nT('adv.ruleRanking', 'the top {n} advanced').replace('{n}', cond.level);
            } else if (cond.type === 'percent') {
                count = Math.floor((total * cond.level) / 100);
                rule = i18nT('adv.rulePercent', 'the top {n}% advanced').replace('{n}', cond.level);
            } else if (cond.type === 'attemptResult') {
                const limit = cond.level / 100;
                count = standings.filter(c => rankingResult(c) < limit).length;
                rule = i18nT('adv.ruleResult', 'anyone under {t} advanced').replace('{t}', formatTime(limit));
            }
        }

        if (count === null) {
            // No competition loaded: a custom sim still needs a rule, but it
            // gets stated on screen instead of applied silently.
            const fallback = { 1: 0.75, 2: 0.5, 3: 0.33 };
            const rate = fallback[round || state.round] || 0.5;
            count = Math.ceil(total * rate);
            rule = i18nT('adv.ruleEstimated', 'about the top {n}% advanced (no competition data)')
                .replace('{n}', Math.round(rate * 100));
        }

        // WCA Regulation 9p1: never more than three quarters of the round.
        count = Math.min(count, Math.floor(total * 0.75));
        count = Math.max(0, Math.min(count, total));
        return { count, rule, fromWcif: !!cond };
    }

    // Events that use Mean of 3 (instead of Average of 5)
    const MEAN_OF_3_EVENTS = ['666', '777', '333bf', '444bf', '555bf', '333fm', '333mbf'];

    // There is deliberately no pool of invented competitor names here.
    //
    // There used to be: two index-aligned lists built from real cubers, which
    // were then shuffled together. Random pairing re-emitted actual people —
    // "Max Park", "Feliks Zemdegs", "Yiheng Wang" are all reachable, and
    // Yiheng Wang is in this file's own WORLD_RECORDS — with invented times
    // attached to them on a leaderboard. Filling a field with a real person's
    // name and made-up results is not something a simulator should do.
    //
    // Opponents now come from the competition's own WCIF registrations when
    // it has them, and are numbered placeholders when it does not.

    // Average variations by event
    const EVENT_VARIATION = {
        '333': 0.12, '222': 0.18, '444': 0.10, '555': 0.08,
        '666': 0.07, '777': 0.06, '333oh': 0.13, '333bf': 0.15,
        'pyram': 0.20, 'skewb': 0.20, 'sq1': 0.18,
        'minx': 0.08, 'clock': 0.15
    };

    // Country ISO2 to flag image (works on Windows unlike emoji flags)
    function countryFlagImg(iso2, size = 20) {
        if (!iso2 || iso2.length !== 2) return '<span class="flag-placeholder">&#127757;</span>';
        const code = iso2.toLowerCase();
        const h = Math.round(size * 0.75);
        return `<img src="https://flagcdn.com/${code}.svg" alt="${iso2}" class="country-flag" style="width: ${size}px; height: auto" loading="lazy" onerror="this.outerHTML='&#127757;'">`;
    }

    // Escape a string for safe interpolation into innerHTML.
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Keep text-only version for non-HTML contexts
    function countryFlag(iso2) {
        if (!iso2 || iso2.length !== 2) return '🌍';
        const codePoints = [...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
        return String.fromCodePoint(...codePoints);
    }

    // Hardcoded WCA World Records (verified July 2026)
    const WORLD_RECORDS = {
        '333': {
            single: { time: 2.76, holder: 'Teodor Zajder', country: 'PL', competition: 'GLS Big Cubes Gdańsk 2026' },
            average: { time: 3.51, holder: 'Yiheng Wang', country: 'CN', competition: 'Hefei Cubing League 3x3 III 2026' }
        },
        '222': {
            single: { time: 0.39, holder: 'Ziyu Ye', country: 'CN', competition: 'Hefei Open 2025' },
            average: { time: 0.86, holder: 'Sujan Feist', country: 'US', competition: 'Kids America Christmas Clash OH 2025' }
        },
        '444': {
            single: { time: 15.18, holder: 'Tymon Kolasiński', country: 'PL', competition: 'Spanish Championship 2025' },
            average: { time: 18.56, holder: 'Tymon Kolasiński', country: 'PL', competition: 'Seoul Winter 2026' }
        },
        '555': {
            single: { time: 29.49, holder: 'Tymon Kolasiński', country: 'PL', competition: 'All Rounders Katowice I 2026' },
            average: { time: 33.73, holder: 'Tymon Kolasiński', country: 'PL', competition: 'All Rounders Katowice I 2026' }
        },
        '666': {
            single: { time: 57.69, holder: 'Max Park', country: 'US', competition: 'Burbank Big Cubes 2025' },
            average: { time: 64.94, holder: 'Lim Hung', country: 'MY', competition: 'UniKL MIAT Cube Open 2026' }
        },
        '777': {
            single: { time: 92.07, holder: 'Max Park', country: 'US', competition: 'West Coast Cubing Western Championship 2026' },
            average: { time: 96.86, holder: 'Max Park', country: 'US', competition: 'Nub Open Trabuco Hills Fall 2025' }
        },
        '333oh': {
            single: { time: 5.66, holder: 'Dhruva Sai Meruva', country: 'IN', competition: 'Swiss Nationals 2024' },
            average: { time: 6.99, holder: 'Zhen Chen', country: 'CN', competition: 'Wuhu Open 2026' }
        },
        '333bf': {
            single: { time: 11.67, holder: 'Charlie Eggins', country: 'AU', competition: 'Cubing at The Cube 2026' },
            average: { time: 14.05, holder: 'Charlie Eggins', country: 'AU', competition: 'Cubing at The Cube 2026' }
        },
        '333fm': {
            single: { time: 16, holder: 'Sebastiano Tronto', country: 'IT', competition: 'FMC 2019', isMoves: true },
            average: { time: 19.00, holder: 'Brian Johnson', country: 'US', competition: 'Evanston FMC Spring 2026', isMoves: true }
        },
        '333mbf': {
            single: { time: '63/65 58:23', holder: 'Graham Siggins', country: 'US', competition: 'Cubing in a Corn Maze 2025', isMulti: true },
            average: null
        },
        'pyram': {
            single: { time: 0.73, holder: 'Simon Kellum', country: 'US', competition: 'Middleton Meetup Thursday 2023' },
            average: { time: 1.14, holder: 'Lingkun Jiang', country: 'CN', competition: 'Zhengzhou Zest 2025' }
        },
        'skewb': {
            single: { time: 0.73, holder: 'Vojtěch Grohmann', country: 'CZ', competition: 'Głuszyca Open 2026' },
            average: { time: 1.52, holder: 'Carter Kucala', country: 'US', competition: 'CubingUSA Heartland Championship 2024' }
        },
        'sq1': {
            single: { time: 2.85, holder: 'Brian Johnson', country: 'US', competition: 'Evanston Qualifier 2026' },
            average: { time: 4.63, holder: 'Sameer Aggarwal', country: 'US', competition: 'Cubing in Southern Oregon 2025' }
        },
        'minx': {
            single: { time: 21.85, holder: 'Timofei Tarasenko', country: 'RU', competition: 'Start of Summer Beijing 2026' },
            average: { time: 24.38, holder: 'Timofei Tarasenko', country: 'RU', competition: 'Tashkent Open 2025' }
        },
        'clock': {
            single: { time: 1.53, holder: 'Lachlan Gibson', country: 'AU', competition: 'Shepplife Open 2025' },
            average: { time: 2.26, holder: 'Lachie Gibson', country: 'AU', competition: 'Lachie Gibson Clock Average 2025' }
        },
        '444bf': {
            single: { time: 51.96, holder: 'Stanley Chapel', country: 'US', competition: '4BLD in a Madison Hall 2023' },
            average: { time: 59.39, holder: 'Stanley Chapel', country: 'US', competition: 'New York Multimate PBQ II 2025' }
        },
        '555bf': {
            single: { time: 118.59, holder: 'Stanley Chapel', country: 'US', competition: 'Multi Mayhem VA 2026' },
            average: { time: 147.63, holder: 'Stanley Chapel', country: 'US', competition: 'Michigan Cubing Club Epsilon 2019' }
        }
    };

    // ========== STATE ==========
    // Synthesized in ambient-noise.js rather than streamed from a file. Same
    // volume/currentTime/play/pause surface, so everything below is unchanged.
    const ambientNoise = window.createAmbientNoise
        ? window.createAmbientNoise()
        : { loop: true, volume: 0, currentTime: 0, play: () => Promise.resolve(), pause: () => {} };
    ambientNoise.loop = true;
    ambientNoise.volume = 0.4;
    let compNoiseMuted = false;
    let compNoiseVolume = 0.4;

    const state = {
        // Config
        compId: '',
        compName: '',
        compData: null,     // Full competition API data
        wcifData: null,     // WCIF data
        wcifRounds: [],     // the selected event's rounds, straight from the WCIF
        wcifRoundsKnown: false, // false when the WCIF could not be fetched
        worldRecords: null, // Cached WCA world records
        event: '333',
        numSolves: 5,
        round: 1,
        numRounds: 4,       // rounds this event has (from WCIF; 4 for custom sims)
        numCompetitors: 30,
        playerName: '',
        playerWcaId: '',
        playerData: null,   // Full WCA person data
        playerAvg: 12,      // From PR
        goalTime: null,
        timeLimit: 600,
        cutoff: 0,
        soundEnabled: true,
        liveMode: false,
        spacebarTimer: false,

        // Runtime
        currentSolve: 0,
        scrambles: [],
        solves: [],
        competitors: [],
        timerState: 'idle',
        timerStart: 0,
        timerValue: 0,
        inspectionStart: 0,
        inspectionValue: 15,
        timerInterval: null,
        inspectionInterval: null,
        rtInterval: null,
        selectedPenalty: 'none',
        currentView: 'home',
        history: [],
        spaceHeld: false,
        holdTimeout: null,
        timerRaf: 0,
    };

    // ========== DOM REFERENCES ==========
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ========== INITIALIZATION ==========
    let initializeAlgorithmsUI = () => { };

    function checkOAuthCallback() {
        const hash = window.location.hash;
        if (hash.includes('access_token=')) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');
            if (token) {
                localStorage.setItem('wca_access_token', token);
                window._justLoggedIn = true;
                // Remove token from URL
                window.history.replaceState(null, null, window.location.pathname);
            }
        }
    }

    async function fetchWCAProfile() {
        const token = localStorage.getItem('wca_access_token');
        if (!token) return;

        try {
            const res = await fetch(`${WCA_API}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                state.userProfile = data.me;
                updateUIAfterLogin();
                showToast(i18nT('toast.welcomeBack', 'Welcome back, {name}!').replace('{name}', data.me.name.split(' ')[0]), 'success');
                closeLoginModal();

                // Automatically load their WCA stats if they have a WCA ID
                if (state.userProfile.wca_id) {
                    await lookupWCAProfile(state.userProfile.wca_id, true);
                    
                    // If they just logged in, switch to stats view!
                    if (window._justLoggedIn) {
                        switchView('statistics');
                        window._justLoggedIn = false;
                    }
                }
            } else {
                localStorage.removeItem('wca_access_token');
            }
        } catch (err) {
            console.error('Failed to fetch WCA profile', err);
        }
    }

    function updateUIAfterLogin() {
        if (!state.userProfile) return;
        let navBtn = $('#nav-login-btn') || $('#nav-profile-btn');
        if (navBtn) {
            const avatarUrl = state.userProfile.avatar?.url || 'https://www.worldcubeassociation.org/assets/missing_avatar_thumb-12654dd6f1aa6d458e80d41e6c4ea6cf79b7c53d1010e6fb3eb18ce86d9ed8df.png';
            
            // Clone the button to remove old login listeners
            const newBtn = navBtn.cloneNode(true);
            newBtn.innerHTML = `<img src="${avatarUrl}" alt="Profile" class="nav-avatar">`;
            newBtn.title = "Profile";
            newBtn.id = 'nav-profile-btn';
            navBtn.parentNode.replaceChild(newBtn, navBtn);
            
            newBtn.addEventListener('click', async () => {
                if (state.userProfile && state.userProfile.wca_id) {
                    await lookupWCAProfile(state.userProfile.wca_id, true);
                    switchView('statistics');
                } else {
                    showToast(i18nT('toast.noWcaLinked', 'No WCA ID linked to this account.'), 'info');
                }
            });
        }
    }

    function handleWCALogin(e) {
        if (e) e.preventDefault();
        const url = `${WCA_OAUTH_URL}?client_id=${WCA_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&response_type=token&scope=public`;
        window.location.href = url;
    }

    // ========== LOGIN MODAL ==========
    // Focus is moved into the dialog on open and handed back to whatever
    // opened it on close, and the page behind is locked from scrolling.
    let _loginOpener = null;

    function isLoginModalOpen() {
        const m = $('#login-modal');
        return !!m && m.style.display !== 'none';
    }

    function openLoginModal() {
        const modal = $('#login-modal');
        if (!modal) return;
        _loginOpener = document.activeElement;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        const dialog = modal.querySelector('.lu-dialog');
        if (dialog) dialog.focus();
    }

    function closeLoginModal() {
        const modal = $('#login-modal');
        if (!modal) return;
        modal.style.display = 'none';
        document.body.style.overflow = '';
        if (_loginOpener && document.contains(_loginOpener)) {
            _loginOpener.focus();
        }
        _loginOpener = null;
    }

    // Turn the profile button in the nav back into the Login button,
    // restoring the original markup (the person icon and the .nav-btn
    // class) so it matches the rest of the navigation.
    function restoreLoginNavButton() {
        const profileBtn = $('#nav-profile-btn');
        if (!profileBtn) return;
        const loginBtn = document.createElement('button');
        loginBtn.className = 'nav-btn';
        loginBtn.id = 'nav-login-btn';
        loginBtn.title = 'Login';
        loginBtn.setAttribute('data-i18n', 'nav.login');
        loginBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>Login';
        profileBtn.parentNode.replaceChild(loginBtn, profileBtn);
        loginBtn.addEventListener('click', openLoginModal);
        // Re-apply the active language to the freshly built button.
        if (window.AppI18N) window.AppI18N.apply();
    }

    function init() {
        checkOAuthCallback();
        fetchWCAProfile();
        loadTheme();
        loadHistory();
        bindEvents();
        updateEventFormatHint();
        initActivityTracker();

        if (tryRestoreSimState()) {
            // State was restored, dashboard is shown
        } else {
            handleHashRoute();
        }

        window.addEventListener('hashchange', handleHashRoute);
    }

    // ========== THEME ==========
    // theme.js owns appearance + accent and wires the picker to
    // #theme-toggle; these remain as thin fallbacks for the case where it
    // failed to load, so the page is never stuck on the default palette.
    function loadTheme() {
        if (window.AppTheme) return;
        const saved = localStorage.getItem('sc-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
    }

    function toggleTheme() {
        if (window.AppTheme) { window.AppTheme.toggleMode(); return; }
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('sc-theme', next);
    }

    // ========== NAVIGATION (Hash-based Routing) ==========
    const VIEW_TO_HASH = {
        'home': '#home', 'setup': '#simulation', 'dashboard': '#simulation',
        'statistics': '#stats', 'records': '#records', 'history': '#history', 'competitions': '#competitions', 'algorithms': '#algorithms', 'practice': '#practice', 'battle': '#battle'
    };
    const HASH_TO_VIEW = {
        '#home': 'home', '#simulation': 'setup', '#stats': 'statistics', '#records': 'records', '#history': 'history', '#competitions': 'competitions', '#algorithms': 'algorithms', '#practice': 'practice', '#battle': 'battle', '': 'home'
    };

    function switchView(viewName, updateHash = true) {
        if (viewName !== 'dashboard' && state.rtInterval) {
            clearInterval(state.rtInterval);
            state.rtInterval = null;
        }

        // Stop algorithm trainer when leaving practice view to prevent ghost timers
        if (viewName !== 'practice' && trainerState.active) {
            resetTrainerState();
        }

        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#${viewName}-view`).classList.add('active');
        state.currentView = viewName;
        
        if (viewName === 'dashboard' && state.soundEnabled) {
            // No seek any more: the bed is generated, so it has no intro to skip.
            ambientNoise.play().catch(e => console.warn('Audio play failed', e));
        } else {
            ambientNoise.pause();
        }

        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        if (viewName === 'setup' || viewName === 'dashboard') {
            $('#nav-simulation-btn').classList.add('active');
        } else if (viewName === 'home') {
            $('#nav-home-btn').classList.add('active');
        } else if (viewName === 'statistics') {
            if ($('#nav-profile-btn')) $('#nav-profile-btn').classList.add('active');
        } else if (viewName === 'records') {
            $('#nav-records-btn').classList.add('active');
        } else if (viewName === 'history') {
            $('#nav-history-btn').classList.add('active');
        } else if (viewName === 'competitions') {
            $('#nav-competitions-btn').classList.add('active');
        } else if (viewName === 'algorithms' || viewName === 'practice') {
            $('#nav-algorithms-btn').classList.add('active');
        } else if (viewName === 'battle') {
            if ($('#nav-battle-btn')) $('#nav-battle-btn').classList.add('active');
        }

        // Update URL hash
        if (updateHash) {
            const hash = VIEW_TO_HASH[viewName] || '#home';
            if (window.location.hash !== hash) {
                window.location.hash = hash;
            }
        }
    }

    function handleHashRoute() {
        const hash = window.location.hash || '#home';
        const targetView = HASH_TO_VIEW[hash] || 'setup';

        // If navigating to #home and simulation is active, show dashboard
        if (targetView === 'setup' && isSimulationActive()) {
            switchView('dashboard', false);
        } else {
            switchView(targetView, false);
            if (targetView === 'history') renderHistory();
            if (targetView === 'records') loadWorldRecords();
            if (targetView === 'competitions' && !state.upcomingCompsFetched) fetchUpcomingCompetitions();
            if (targetView === 'algorithms') initializeAlgorithmsUI();
            if (targetView === 'battle') initBattle();
        }
    }

    function isSimulationActive() {
        return state.scrambles.length > 0 && state.currentSolve < state.numSolves;
    }

    // ========== EVENT BINDINGS ==========
    const trainerState = {
        active: false,
        algList: [],      // [{name, alg}]
        selectedIdxs: new Set(),
        currentCase: null,
        times: [],
        timerRunning: false,
        startTime: null,
        timerInterval: null,
        currentEvent: '3x3',
        currentSetName: '',
        lastCase: null,
        spaceHeld: false,
        spaceHoldTimeout: null,
        spaceHoldTime: 500,
        isReadyToStart: false,
    };

    function resetTrainerState() {
        trainerState.active = false;
        cancelAnimationFrame(trainerState.timerRaf || 0);
        trainerState.timerRunning = false;
        if (trainerState.spaceHoldTimeout) clearTimeout(trainerState.spaceHoldTimeout);
        trainerState.spaceHoldTimeout = null;
        trainerState.spaceHeld = false;
        trainerState.isReadyToStart = false;
    }
    function bindEvents() {
        // Login Modal
        if ($('#nav-login-btn')) {
            $('#nav-login-btn').addEventListener('click', openLoginModal);
        }

        if ($('#login-close-btn')) {
            $('#login-close-btn').addEventListener('click', closeLoginModal);
        }
        if ($('#login-skip-btn')) {
            $('#login-skip-btn').addEventListener('click', closeLoginModal);
        }

        // Click on the backdrop (not the dialog) closes it.
        window.addEventListener('click', (e) => {
            if (e.target === $('#login-modal')) closeLoginModal();
        });

        // Escape closes the dialog.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isLoginModalOpen()) {
                e.preventDefault();
                closeLoginModal();
            }
        });

        if ($('#wca-login-btn')) {
            $('#wca-login-btn').addEventListener('click', handleWCALogin);
        }

        if ($('#logout-btn')) {
            $('#logout-btn').addEventListener('click', () => {
                localStorage.removeItem('wca_access_token');
                state.userProfile = null;
                restoreLoginNavButton();
                switchView('home');
                showToast(i18nT('toast.loggedOut', 'Logged out successfully'), 'success');
            });
        }

        // Theme (click + keyboard). theme.js binds the same button to open
        // the picker, so only take over when it is absent — otherwise a click
        // would both open the picker and flip the mode behind it.
        if (!window.AppTheme) {
            $('#theme-toggle').addEventListener('click', toggleTheme);
            $('#theme-toggle').addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTheme(); }
            });
        }

        // Nav
        $('#nav-logo').addEventListener('click', () => {
            switchView('home');
        });
        $('#nav-home-btn').addEventListener('click', () => {
            switchView('home');
        });
        $('#nav-simulation-btn').addEventListener('click', () => {
            if (state.currentView === 'dashboard' || isSimulationActive()) {
                switchView('dashboard');
            } else {
                switchView('setup');
            }
        });
        $('#nav-history-btn').addEventListener('click', () => {
            renderHistory();
            switchView('history');
        });
        const timerNav = $('#nav-timer-btn');
        if (timerNav && !timerNav._scBound) {
            timerNav.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'timer.html';
            });
            timerNav._scBound = true;
        }

        $('#nav-records-btn').addEventListener('click', () => {
            switchView('records');
            loadWorldRecords();
        });
        $('#nav-competitions-btn').addEventListener('click', () => {
            switchView('competitions');
            if (!state.upcomingCompsFetched) fetchUpcomingCompetitions();
        });
        $('#nav-algorithms-btn').addEventListener('click', () => {
            switchView('algorithms');
            initializeAlgorithmsUI();
        });
        if ($('#nav-battle-btn')) {
            $('#nav-battle-btn').addEventListener('click', () => {
                switchView('battle');
                initBattle();
            });
        }
        // Guest battle removed

        // Algorithms View Logic (Native + TwistyPlayer)
        const algEventSelect = $('#alg-event-select');
        const algSubsetContainer = $('#alg-subset-container');
        const algSubgroupSelect = $('#alg-subgroup-select');

        // Currently-selected subgroup (or ALL_SUBGROUP / null). The chip row is
        // the visible control; this is what the trainer reads.
        let algCurrentSubgroup = null;
        let _subgroupChips = null;
        let _zbllNormalised = false;

        // ZBLL ships as one flat array of "ZBLL U 1" … "ZBLL AS 72". Bucket it
        // into the seven sets so the set selector (and the existing
        // object-subgroup machinery + trainer) work — without touching any alg.
        function normaliseZbll() {
            if (_zbllNormalised) return;
            _zbllNormalised = true;
            const z = ALGORITHMS['3x3'] && ALGORITHMS['3x3']['ZBLL'];
            if (!Array.isArray(z)) return;
            const ORDER = ['U', 'T', 'L', 'Pi', 'H', 'S', 'AS'];
            const groups = {};
            ORDER.forEach(g => { groups[g] = []; });
            const other = [];
            z.forEach(item => {
                const m = /^ZBLL\s+([A-Za-z]+)\s/.exec(item.name || '');
                const g = m && m[1];
                if (g && groups[g]) groups[g].push(item);
                else other.push(item);
            });
            const out = {};
            ORDER.forEach(g => { if (groups[g].length) out[g] = groups[g]; });
            if (other.length) out.Other = other;
            ALGORITHMS['3x3']['ZBLL'] = out;
        }

        initializeAlgorithmsUI = function () {
            if (typeof ALGORITHMS === 'undefined') return;
            normaliseZbll();
            const currentEvent = algEventSelect.value;
            // Hide empty sets (e.g. placeholder arrays left in the base db)
            const subsets = Object.keys(ALGORITHMS[currentEvent] || {}).filter(k => {
                const v = ALGORITHMS[currentEvent][k];
                if (Array.isArray(v)) return v.length > 0;
                return v && Object.keys(v).length > 0;
            });

            algSubsetContainer.innerHTML = '';
            algSubgroupSelect.style.display = 'none';
            hideSubgroupChips();

            subsets.forEach((subset, index) => {
                const btn = document.createElement('button');
                btn.className = `btn btn-secondary alg-cat-btn ${index === 0 ? 'active' : ''}`;
                btn.textContent = subset;
                btn.dataset.category = subset;
                btn.addEventListener('click', (e) => {
                    $$('.alg-cat-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    handleSubsetSelection(currentEvent, subset);
                });
                algSubsetContainer.appendChild(btn);
            });

            if (subsets.length > 0) {
                handleSubsetSelection(currentEvent, subsets[0]);
            } else {
                $('#algorithms-grid').innerHTML = `<p style="color: var(--clr-text-muted);">${esc(i18nT('algs.noneForEvent', 'No algorithms found for this event.'))}</p>`;
            }
        }

        function handleSubsetSelection(event, subset) {
            const data = ALGORITHMS[event][subset];
            if (!data) return;

            if (Array.isArray(data)) {
                algSubgroupSelect.style.display = 'none';
                hideSubgroupChips();
                algCurrentSubgroup = null;
                renderAlgorithms(event, subset, null);
                return;
            }

            const subgroups = Object.keys(data);

            // Keep the native <select> populated as an accessible fallback and
            // as the value the trainer used to read; the chip row is the
            // visible control.
            algSubgroupSelect.innerHTML = '';
            const allOpt = document.createElement('option');
            allOpt.value = ALL_SUBGROUP;
            allOpt.textContent = `${subset} — ${i18nT('alg.all', 'All')}`;
            algSubgroupSelect.appendChild(allOpt);
            subgroups.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = `${subset} ${sub}`;
                algSubgroupSelect.appendChild(opt);
            });
            algSubgroupSelect.style.display = 'none';
            algSubgroupSelect.onchange = (e) => selectSubgroup(event, subset, e.target.value);

            // Large sets (ZBLL, 7 sets) default to the first set rather than
            // "All", so we never render hundreds of live previews at once.
            const heavy = subgroups.length > 3;
            const initial = heavy ? subgroups[0] : ALL_SUBGROUP;

            renderSubgroupChips(event, subset, subgroups, heavy, initial);
            selectSubgroup(event, subset, initial);
        }

        function ensureSubgroupChips() {
            if (_subgroupChips) return _subgroupChips;
            const row = document.createElement('div');
            row.id = 'alg-subgroup-chips';
            row.className = 'alg-subgroup-chips';
            row.setAttribute('role', 'group');
            row.setAttribute('aria-label', i18nT('aria.algSet', 'Algorithm set'));
            algSubgroupSelect.parentNode.insertBefore(row, algSubgroupSelect);
            _subgroupChips = row;
            return row;
        }

        function hideSubgroupChips() {
            if (_subgroupChips) { _subgroupChips.style.display = 'none'; _subgroupChips.innerHTML = ''; }
        }

        function renderSubgroupChips(event, subset, subgroups, heavy, initial) {
            const row = ensureSubgroupChips();
            row.style.display = 'flex';
            row.innerHTML = '';
            const values = heavy ? subgroups.slice() : [ALL_SUBGROUP].concat(subgroups);
            values.forEach(val => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'alg-group-chip' + (val === initial ? ' active' : '');
                chip.dataset.subgroup = val;
                chip.textContent = val === ALL_SUBGROUP ? i18nT('alg.all', 'All') : val;
                chip.setAttribute('aria-pressed', val === initial ? 'true' : 'false');
                chip.addEventListener('click', () => {
                    row.querySelectorAll('.alg-group-chip').forEach(c => {
                        c.classList.remove('active');
                        c.setAttribute('aria-pressed', 'false');
                    });
                    chip.classList.add('active');
                    chip.setAttribute('aria-pressed', 'true');
                    selectSubgroup(event, subset, val);
                });
                row.appendChild(chip);
            });
        }

        function selectSubgroup(event, subset, val) {
            algCurrentSubgroup = val;
            if (algSubgroupSelect) algSubgroupSelect.value = val;
            renderAlgorithms(event, subset, val);
        }

        if (algEventSelect) {
            algEventSelect.addEventListener('change', initializeAlgorithmsUI);
        }

        // ---- Professional case previews --------------------------------
        // Cube-shaped events are displayed the way algorithm sheets are
        // read: yellow on top, green in front (z2 from the standard
        // white-top scheme the renderer starts in). Note: twisty-player's
        // built-in stickering masks are defined against the white-top
        // scheme and mis-color the case when combined with a z2 setup, so
        // previews use full colors on purpose.
        function caseOrientationFor(event, subset, subgroup) {
            if (event === '2x2' || event === '3x3' || event === '4x4' || event === '5x5' || event === 'Skewb') return 'z2';
            return '';
        }

        // Pyraminx previews mimic SpeedCubeDB: a 3D view looking down at
        // the top vertex (three faces visible around the tip), plus a
        // small back view for the hidden face.
        function tunePlayerForEvent(el, twistyPuzzleId) {
            if (twistyPuzzleId !== 'pyraminx') return;
            el.setAttribute('visualization', '3D');
            el.setAttribute('back-view', 'top-right');
            el.setAttribute('camera-latitude', '90');
            el.setAttribute('camera-latitude-limit', '90');
        }

        // Apply the display orientation to a live twisty-player element
        // (used by the trainer / hint players).
        function applyCaseAppearance(el, event) {
            const rot = caseOrientationFor(event, trainerState.currentSubset, trainerState.currentSubgroup);
            if (rot) el.setAttribute('experimental-setup-alg', rot);
            else el.removeAttribute('experimental-setup-alg');
        }

        // Draw a case on a live twisty-player, preferring the case's SETUP
        // (reproduces the exact scrambled case with corners/centres solved).
        // Falls back to the solving alg with anchor="end" when no setup exists.
        function applyCasePreviewToPlayer(el, item, event) {
            const puzzle = getPuzzleName(event);
            const caseRot = caseOrientationFor(event, trainerState.currentSubset, trainerState.currentSubgroup);
            if (item.setup) {
                let s = event === 'Skewb' ? expandSkewbMacros(item.setup) : item.setup;
                if (window.ScrambleEngine) s = window.ScrambleEngine.normalizeAlgFor(puzzle, s);
                el.removeAttribute('experimental-setup-anchor');
                el.setAttribute('alg', '');
                el.setAttribute('experimental-setup-alg', (caseRot ? caseRot + ' ' : '') + s);
            } else {
                let a = event === 'Skewb' ? expandSkewbMacros(item.alg) : item.alg;
                if (window.ScrambleEngine) a = window.ScrambleEngine.normalizeAlgFor(puzzle, a);
                el.setAttribute('experimental-setup-anchor', 'end');
                if (caseRot) el.setAttribute('experimental-setup-alg', caseRot);
                else el.removeAttribute('experimental-setup-alg');
                el.setAttribute('alg', a);
            }
        }

        // Lazily instantiate twisty-player previews as cards scroll into view
        // (critical for big sets like ZBLL — 472 cases).
        let _algObserver = null;
        function ensureAlgObserver() {
            if (_algObserver) return _algObserver;
            _algObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const holder = entry.target;
                    _algObserver.unobserve(holder);
                    if (holder.dataset.loaded) return;
                    holder.dataset.loaded = '1';
                    const player = document.createElement('twisty-player');
                    player.setAttribute('puzzle', holder.dataset.puzzle);
                    if (holder.dataset.previewSetup) {
                        // Show the case exactly as its setup produces it.
                        player.setAttribute('experimental-setup-alg', holder.dataset.previewSetup);
                    } else {
                        player.setAttribute('alg', holder.dataset.alg);
                        // Anchor at the end: the player shows the state the alg
                        // SOLVES (i.e. the case), for every notation incl. SQ1.
                        player.setAttribute('experimental-setup-anchor', 'end');
                        if (holder.dataset.setupRot) player.setAttribute('experimental-setup-alg', holder.dataset.setupRot);
                    }
                    // Square-1 has no 2D net in the renderer — 3D (with back view).
                    if (window.ScrambleEngine) {
                        window.ScrambleEngine.applyViz(player, holder.dataset.puzzle);
                    } else {
                        player.setAttribute('visualization', '2D');
                    }
                    tunePlayerForEvent(player, holder.dataset.puzzle);
                    player.setAttribute('background', 'none');
                    player.setAttribute('control-panel', 'none');
                    player.setAttribute('viewer-link', 'none');
                    player.style.width = '100%';
                    player.style.height = '100%';
                    holder.textContent = '';
                    holder.appendChild(player);
                });
            }, { rootMargin: '300px' });
            return _algObserver;
        }

        // Track current selection so the search box can re-render.
        let _algCurrent = { event: null, subset: null, subgroup: null };

        // Sentinel subgroup value meaning "show every case across all subgroups".
        const ALL_SUBGROUP = '__ALL__';

        // Small i18n helper for the algorithms view.

        // Render logic
        function renderAlgorithms(event, subset, subgroup) {
            const grid = $('#algorithms-grid');
            if (!grid || typeof ALGORITHMS === 'undefined') return;
            _algCurrent = { event, subset, subgroup };

            grid.innerHTML = '';
            let algs = [];
            const subsetData = ALGORITHMS[event][subset];
            if (subgroup === ALL_SUBGROUP && subsetData && !Array.isArray(subsetData)) {
                // Flatten every subgroup into one combined list.
                algs = Object.values(subsetData).flat();
            } else if (subgroup) {
                algs = subsetData[subgroup] || [];
            } else {
                algs = subsetData || [];
            }

            const searchEl = $('#alg-search');
            const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
            const filtered = q
                ? algs.filter(a => (a.name || '').toLowerCase().includes(q) || (a.alg || '').toLowerCase().includes(q))
                : algs;

            const countEl = $('#alg-count');
            if (countEl) countEl.textContent = (filtered.length === 1 ? i18nT('algs.caseN', '{n} case') : i18nT('algs.casesN', '{n} cases')).replace('{n}', filtered.length);

            if (filtered.length === 0) {
                grid.innerHTML = `<p style="color: var(--clr-text-muted);">${esc(i18nT('algs.noMatches', 'No cases match your search.'))}</p>`;
                return;
            }

            const puzzleName = getPuzzleName(event);
            const obs = ensureAlgObserver();
            const frag = document.createDocumentFragment();

            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'setup-card alg-card';

                const holder = document.createElement('div');
                holder.className = 'alg-card-viz';

                let previewAlg = event === 'Skewb' ? expandSkewbMacros(item.alg) : item.alg;
                if (window.ScrambleEngine) previewAlg = window.ScrambleEngine.normalizeAlgFor(puzzleName, previewAlg);
                if (event === 'Square-1' && window.Square1Drawer) {
                    // Flat square diagram (sarah-style). The pictured case is
                    // the state the solving alg starts from = inverse of the alg.
                    const caseState = item.setup ? item.setup : getInverse(item.alg, event);
                    const drawn = window.Square1Drawer.render(holder, caseState);
                    const svg = holder.querySelector('svg');
                    if (svg) { svg.style.maxWidth = 'none'; svg.style.width = 'auto'; svg.style.height = '100%'; svg.style.margin = '0'; }
                    // A few stored algorithms are not valid sequences from
                    // solved, so the state above is one the puzzle can never
                    // reach — every real case is in cube shape. Mark it instead
                    // of letting a wrong picture look authoritative.
                    if (drawn && !drawn.legal) {
                        const warn = document.createElement('span');
                        warn.className = 'alg-card-warn';
                        warn.textContent = i18nT('algs.badDiagram', 'Diagram unavailable');
                        warn.title = i18nT('algs.badDiagramHint',
                            'The stored algorithm is not a valid sequence from solved, so this picture is not a real case.');
                        holder.appendChild(warn);
                    }
                } else if (isPreviewable(event, item.alg)) {
                    holder.dataset.puzzle = puzzleName;
                    const caseRot = caseOrientationFor(event, subset, subgroup);
                    // Prefer the case's own SETUP for the picture: it reproduces
                    // the exact scrambled case with corners/centres left solved.
                    // (Deriving it from the solving alg via anchor="end" leaves
                    // corners scrambled whenever the alg carries an AUF — that was
                    // the "Super Hedge looks broken" bug.)
                    if (item.setup) {
                        let setupAlg = event === 'Skewb' ? expandSkewbMacros(item.setup) : item.setup;
                        if (window.ScrambleEngine) setupAlg = window.ScrambleEngine.normalizeAlgFor(puzzleName, setupAlg);
                        holder.dataset.previewSetup = (caseRot ? caseRot + ' ' : '') + setupAlg;
                    } else {
                        holder.dataset.alg = previewAlg;
                        if (caseRot) holder.dataset.setupRot = caseRot;
                    }
                    holder.innerHTML = '<span style="color:var(--clr-text-muted);font-size:0.75rem;">…</span>';
                    obs.observe(holder);
                } else {
                    holder.innerHTML = '<span style="color:var(--clr-text-muted);font-size:2.2rem;" aria-hidden="true">🧩</span>';
                    holder.title = i18nT('algs.no2d', 'No 2D preview for this notation');
                }
                card.appendChild(holder);

                const h3 = document.createElement('h3');
                h3.className = 'alg-card-name';
                h3.textContent = item.name;
                card.appendChild(h3);

                const code = document.createElement('code');
                code.className = 'alg-card-alg';
                code.textContent = item.alg;
                card.appendChild(code);

                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn btn-secondary btn-sm alg-copy-btn';
                copyBtn.textContent = i18nT('algs.copy', 'Copy');
                copyBtn.setAttribute('aria-label', i18nT('aria.copyAlg', 'Copy algorithm for {name}').replace('{name}', item.name));
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard && navigator.clipboard.writeText(item.alg)
                        .then(() => showToast(i18nT('toast.algCopied', 'Algorithm copied'), 'success'))
                        .catch(() => {});
                });
                card.appendChild(copyBtn);

                frag.appendChild(card);
            });
            grid.appendChild(frag);
        }

        // Live search over the currently selected set
        const algSearchInput = $('#alg-search');
        if (algSearchInput) {
            algSearchInput.addEventListener('input', () => {
                if (_algCurrent.event) renderAlgorithms(_algCurrent.event, _algCurrent.subset, _algCurrent.subgroup);
            });
        }

        // ====== PRACTICE TRAINER ======


        function getPuzzleName(event) {
            if (event === '2x2') return '2x2x2';
            if (event === '4x4') return '4x4x4';
            if (event === '5x5') return '5x5x5';
            if (event === 'Pyraminx') return 'pyraminx';
            if (event === 'Megaminx') return 'megaminx';
            if (event === 'Square-1') return 'square1';
            if (event === 'Skewb') return 'skewb';
            return '3x3x3';
        }

        // Sarah's Skewb notation macros: S = sledge, H = hedge.
        function expandSkewbMacros(alg) {
            return alg.trim().split(/\s+/).map(m => {
                if (m === 'S') return "R' L R L'";
                if (m === 'H') return "L R' L' R";
                if (m === 'SS') return "R' L R L' R' L R L'";
                return m;
            }).join(' ');
        }

        // Can twisty-player draw this alg for this event?
        function isPreviewable(event, alg) {
            if (!alg || alg === 'skip') return false;
            if (event === 'Square-1') return true;
            if (event === 'Skewb') {
                // WCA skewb moves (R L U B) plus F (used by Sarah's method) and rotations.
                const expanded = expandSkewbMacros(alg);
                return expanded.split(/\s+/).every(m => /^[RLUBFxyz](2'?|'2?|2|')?$/.test(m) || /^[RLUBFxyz]$/.test(m));
            }
            return true;
        }

        // Notation-aware inverse (cube/pyraminx/skewb/megaminx/sq1).
        function invertSq1(alg) {
            const parts = alg.split('/').map(s => s.trim());
            return parts.reverse().map(seg => {
                if (!seg) return '';
                const m = seg.match(/\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/);
                if (!m) return seg;
                return `(${-parseInt(m[1], 10)},${-parseInt(m[2], 10)})`;
            }).join(' / ').trim();
        }

        function getInverse(alg, event) {
            if (!alg || alg === 'skip') return '';
            if (alg.trim() === '/') return '/';
            if (event === 'Square-1' || /^[\s()\/\d,+-]+$/.test(alg)) return invertSq1(alg);
            const moves = alg.trim().split(/\s+/);
            return moves.reverse().map(m => {
                if (m === 'S') return 'H';       // skewb sledge <-> hedge
                if (m === 'H') return 'S';
                if (m === 'SS') return 'H H';
                if (m.endsWith('++')) return m.slice(0, -2) + '--';
                if (m.endsWith('--')) return m.slice(0, -2) + '++';
                if (m.endsWith("'")) return m.slice(0, -1);
                if (m.endsWith('2')) return m;
                return m + "'";
            }).join(' ');
        }

        // Preferred trainer scramble: the scraped setup when available,
        // otherwise the computed inverse of the algorithm.
        function getCaseSetup(item, event) {
            if (item.setup) return item.setup;
            return getInverse(item.alg, event);
        }

        function formatTimeSec(ms) {
            const s = ms / 1000;
            return s.toFixed(2);
        }

        // Open case selection modal
        function openCaseSelectModal() {
            if (typeof ALGORITHMS === 'undefined') return;
            const event = algEventSelect.value;
            const activeBtn = document.querySelector('.alg-cat-btn.active');
            const subset = activeBtn ? activeBtn.dataset.category : null;
            const subgroupVal = algCurrentSubgroup;

            if (!subset) { showToast(i18nT('toast.pickCategory', 'Select an algorithm category first'), 'error'); return; }

            let algData = ALGORITHMS[event] && ALGORITHMS[event][subset];
            if (!algData) return;
            if (!Array.isArray(algData)) {
                if (subgroupVal === ALL_SUBGROUP) algData = Object.values(algData).flat();
                else if (subgroupVal) algData = algData[subgroupVal];
            }
            if (!Array.isArray(algData)) { showToast(i18nT('toast.pickSubgroup', 'Select a subgroup first'), 'error'); return; }

            const validAlgs = algData.filter(a => a.alg && a.alg !== 'skip');
            trainerState.algList = validAlgs;
            trainerState.currentEvent = event;
            trainerState.currentSubset = subset;
            trainerState.currentSubgroup = (subgroupVal === ALL_SUBGROUP) ? null : subgroupVal;

            const label = (subgroupVal && subgroupVal !== ALL_SUBGROUP) ? `${subset} ${subgroupVal}` : `${subset} — All`;
            trainerState.currentSetName = `${event} ${label}`;

            // Select all by default
            trainerState.selectedIdxs = new Set(validAlgs.map((_, i) => i));

            renderCaseSelectGrid();
            $('#case-select-title').textContent = `${i18nT('algs.selectCases', 'Select Cases to Practice')} — ${trainerState.currentSetName}`;
            $('#alg-case-select-modal').style.display = 'flex';
            updateCaseSelectCount();
        }

        function renderCaseSelectGrid() {
            const grid = $('#alg-case-select-grid');
            grid.innerHTML = '';
            trainerState.algList.forEach((alg, i) => {
                const card = document.createElement('div');
                card.className = 'case-select-card' + (trainerState.selectedIdxs.has(i) ? ' selected' : '');
                card.dataset.idx = i;
                card.innerHTML = `
                    <div class="case-select-checkbox"></div>
                    <div class="case-select-name">${alg.name}</div>
                `;
                card.addEventListener('click', () => {
                    if (trainerState.selectedIdxs.has(i)) {
                        trainerState.selectedIdxs.delete(i);
                        card.classList.remove('selected');
                    } else {
                        trainerState.selectedIdxs.add(i);
                        card.classList.add('selected');
                    }
                    updateCaseSelectCount();
                });
                grid.appendChild(card);
            });
        }

        function updateCaseSelectCount() {
            $('#case-select-count-label').textContent = i18nT('algs.nSelected', '{n} selected').replace('{n}', trainerState.selectedIdxs.size);
        }

        // Start trainer session
        function startTrainerSession() {
            if (trainerState.selectedIdxs.size === 0) {
                showToast(i18nT('toast.pickOneCase', 'Select at least 1 case'), 'error');
                return;
            }
            $('#alg-case-select-modal').style.display = 'none';
            trainerState.times = [];
            trainerState.timerRunning = false;
            trainerState.active = true;
            clearInterval(trainerState.timerInterval);

            // Show view
            switchView('practice');

            // Update header
            $('#trainer-set-name').textContent = trainerState.currentSetName;
            $('#trainer-case-count').textContent = i18nT('algs.casesN', '{n} cases').replace('{n}', trainerState.selectedIdxs.size);

            // Update puzzle type (Square-1 needs 3D — no 2D net available)
            const puzzle = getPuzzleName(trainerState.currentEvent);
            $('#trainer-twisty').setAttribute('puzzle', puzzle);
            $('#hint-twisty').setAttribute('puzzle', puzzle);
            if (window.ScrambleEngine) {
                window.ScrambleEngine.applyViz($('#trainer-twisty'), puzzle);
                window.ScrambleEngine.applyViz($('#hint-twisty'), puzzle);
            }
            tunePlayerForEvent($('#trainer-twisty'), puzzle);
            tunePlayerForEvent($('#hint-twisty'), puzzle);

            renderTimeList();
            loadNextCase();
        }

        function getRandomCase() {
            const keys = Array.from(trainerState.selectedIdxs);
            if (keys.length === 0) return null;
            const idx = keys[Math.floor(Math.random() * keys.length)];
            return trainerState.algList[idx];
        }

        function loadNextCase(forceCase = null) {
            const c = forceCase || getRandomCase();
            if (!c) return;
            trainerState.currentCase = c;
            trainerState.lastCase = c;

            const event = trainerState.currentEvent;

            // Show scramble (scraped setup when available, else computed inverse)
            const scramble = getCaseSetup(c, event);
            $('#trainer-scramble').textContent = scramble || i18nT('algs.noScramble', '(no scramble)');

            // Show the case state in the twisty-player. Using
            // experimental-setup-anchor="end" draws the state that the
            // algorithm solves — correct for every notation (incl. SQ1).
            const twisty = $('#trainer-twisty');
            if (isPreviewable(event, c.alg)) {
                twisty.style.visibility = 'visible';
                applyCasePreviewToPlayer(twisty, c, event);
            } else {
                twisty.setAttribute('alg', '');
                twisty.style.visibility = 'hidden';
            }

            // Reset timer display
            resetTimerDisplay();
        }

        function resetTimerDisplay() {
            $('#trainer-timer-time').textContent = '0.00';
            $('#trainer-timer-time').className = 'trainer-timer-time';
            $('#trainer-timer-status').textContent = i18nT('algs.pressSpace', 'Press Space to start');
            $('#trainer-timer-status').style.color = '';
            trainerState.timerRunning = false;
            clearInterval(trainerState.timerInterval);
        }

        function startTimer() {
            trainerState.startTime = performance.now();
            trainerState.timerRunning = true;
            const timeEl = $('#trainer-timer-time');
            const statusEl = $('#trainer-timer-status');
            timeEl.className = 'trainer-timer-time running';
            statusEl.textContent = 'Solving...';
            statusEl.style.color = '';
            cancelAnimationFrame(trainerState.timerRaf || 0);
            function tick() {
                if (!trainerState.timerRunning) return;
                const elapsed = performance.now() - trainerState.startTime;
                if (timeEl) timeEl.textContent = formatTimeSec(elapsed);
                trainerState.timerRaf = requestAnimationFrame(tick);
            }
            trainerState.timerRaf = requestAnimationFrame(tick);
        }

        function stopTimer() {
            if (!trainerState.timerRunning) return;
            cancelAnimationFrame(trainerState.timerRaf || 0);
            trainerState.timerRunning = false;
            const elapsed = performance.now() - trainerState.startTime;
            const timeEl = $('#trainer-timer-time');
            if (timeEl) {
                timeEl.textContent = formatTimeSec(elapsed);
                timeEl.className = 'trainer-timer-time';
            }
            const statusEl = $('#trainer-timer-status');
            if (statusEl) {
                statusEl.textContent = i18nT('algs.pressSpaceNext', 'Press Space for next case');
                statusEl.style.color = '';
            }
            addTime(elapsed, trainerState.currentCase ? trainerState.currentCase.name : '?');
        }

        function addTime(ms, caseName) {
            const isPB = trainerState.times.length === 0 || ms < Math.min(...trainerState.times.map(t => t.ms));
            trainerState.times.unshift({ ms, caseName, isPB });
            renderTimeList();
        }

        function renderTimeList() {
            const list = $('#trainer-times-list');
            const times = trainerState.times;
            if (times.length === 0) {
                list.innerHTML = `<div class="trainer-times-empty">${esc(i18nT('algs.noSolves', 'No solves yet — start practicing!'))}</div>`;
                $('#trainer-stat-mean').textContent = '—';
                $('#trainer-stat-best').textContent = '—';
                $('#trainer-stat-count').textContent = '0';
                return;
            }

            list.innerHTML = times.map((t, i) => `
                <div class="trainer-time-entry">
                    <span class="trainer-time-num">${times.length - i}</span>
                    <span class="trainer-time-case" title="${t.caseName}">${t.caseName}</span>
                    <span class="trainer-time-val${t.isPB ? ' pb' : ''}">${formatTimeSec(t.ms)}</span>
                </div>
            `).join('');

            const msArr = times.map(t => t.ms);
            const mean = msArr.reduce((a, b) => a + b, 0) / msArr.length;
            const best = Math.min(...msArr);
            $('#trainer-stat-mean').textContent = formatTimeSec(mean);
            $('#trainer-stat-best').textContent = formatTimeSec(best);
            $('#trainer-stat-count').textContent = times.length;
        }

        function showHintModal() {
            const c = trainerState.currentCase;
            if (!c) return;
            const event = trainerState.currentEvent;
            $('#alg-hint-case-name').textContent = c.name;
            $('#alg-hint-alg').textContent = c.alg || '—';
            const hintTwisty = $('#hint-twisty');
            if (isPreviewable(event, c.alg)) {
                const puzzle = getPuzzleName(event);
                hintTwisty.style.visibility = 'visible';
                hintTwisty.setAttribute('puzzle', puzzle);
                if (window.ScrambleEngine) window.ScrambleEngine.applyViz(hintTwisty, puzzle);
                tunePlayerForEvent(hintTwisty, puzzle);
                applyCasePreviewToPlayer(hintTwisty, c, event);
            } else {
                hintTwisty.setAttribute('alg', '');
                hintTwisty.style.visibility = 'hidden';
            }
            $('#alg-hint-modal').style.display = 'flex';
        }

        function closeHintModal() {
            $('#alg-hint-modal').style.display = 'none';
        }



        function exitTrainer() {
            resetTrainerState();
            switchView('algorithms');
        }

        // Trainer button events
        $('#alg-practice-btn').addEventListener('click', openCaseSelectModal);
        $('#case-select-close').addEventListener('click', () => { $('#alg-case-select-modal').style.display = 'none'; });
        $('#case-select-cancel-btn').addEventListener('click', () => { $('#alg-case-select-modal').style.display = 'none'; });
        $('#case-select-start-btn').addEventListener('click', startTrainerSession);
        $('#case-select-all-btn').addEventListener('click', () => {
            trainerState.algList.forEach((_, i) => trainerState.selectedIdxs.add(i));
            document.querySelectorAll('.case-select-card').forEach(c => c.classList.add('selected'));
            updateCaseSelectCount();
        });
        $('#case-select-none-btn').addEventListener('click', () => {
            trainerState.selectedIdxs.clear();
            document.querySelectorAll('.case-select-card').forEach(c => c.classList.remove('selected'));
            updateCaseSelectCount();
        });

        $('#trainer-back-btn').addEventListener('click', exitTrainer);
        $('#trainer-hint-btn').addEventListener('click', showHintModal);
        $('#trainer-skip-btn').addEventListener('click', () => { loadNextCase(); });
        $('#trainer-redo-btn').addEventListener('click', () => {
            if (trainerState.lastCase) loadNextCase(trainerState.lastCase);
        });
        $('#trainer-clear-times-btn').addEventListener('click', () => {
            trainerState.times = [];
            renderTimeList();
        });

        // Hint modal close
        $('#alg-hint-close').addEventListener('click', closeHintModal);
        $('#alg-hint-modal').addEventListener('click', (e) => {
            if (e.target === $('#alg-hint-modal')) closeHintModal();
        });

        // Space bar timer + keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!trainerState.active) return;
            if ($('#alg-hint-modal').style.display !== 'none' || $('#alg-case-select-modal').style.display !== 'none') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (trainerState.timerRunning) {
                    stopTimer();
                    setTimeout(() => loadNextCase(), 800);
                } else if (!trainerState.spaceHeld) {
                    trainerState.spaceHeld = true;
                    trainerState.isReadyToStart = false;
                    $('#trainer-timer-status').textContent = i18nT('battle.holding', 'Holding...');
                    $('#trainer-timer-status').style.color = 'var(--clr-warning)';
                    
                    if (trainerState.spaceHoldTime > 0) {
                        trainerState.spaceHoldTimeout = setTimeout(() => {
                            trainerState.isReadyToStart = true;
                            $('#trainer-timer-status').textContent = i18nT('algs.ready', 'Ready!');
                            $('#trainer-timer-status').style.color = 'var(--clr-success)';
                        }, trainerState.spaceHoldTime);
                    } else {
                        trainerState.isReadyToStart = true;
                        $('#trainer-timer-status').textContent = i18nT('algs.ready', 'Ready!');
                        $('#trainer-timer-status').style.color = 'var(--clr-success)';
                    }
                }
            } else if (e.key === 'h' || e.key === 'H') {
                showHintModal();
            } else if (e.key === 's' || e.key === 'S') {
                if (!trainerState.timerRunning) loadNextCase();
            } else if (e.key === 'Escape') {
                closeHintModal();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!trainerState.active || e.code !== 'Space') return;
            e.preventDefault();

            if (trainerState.spaceHeld && !trainerState.timerRunning) {
                clearTimeout(trainerState.spaceHoldTimeout);
                if (trainerState.isReadyToStart) {
                    startTimer();
                } else {
                    $('#trainer-timer-status').textContent = i18nT('algs.pressSpace', 'Press Space to start');
                    $('#trainer-timer-status').style.color = '';
                }
            }
            trainerState.spaceHeld = false;
            trainerState.isReadyToStart = false;
        });

        $('#hold-time-select').addEventListener('change', (e) => {
            trainerState.spaceHoldTime = parseInt(e.target.value, 10);
        });

        // Click on main area = space bar equivalent
        const overlay = $('#alg-trainer-overlay');
        
        function handlePointerDown(e) {
            if (!trainerState.active) return;
            const target = e.target;
            if (target.closest('button') || target.closest('.alg-trainer-sidebar') || target.closest('.alg-trainer-topbar') || target.closest('.alg-trainer-scramble-bar')) return;
            
            if (trainerState.timerRunning) {
                stopTimer();
                setTimeout(() => loadNextCase(), 800);
            } else if (!trainerState.spaceHeld) {
                trainerState.spaceHeld = true;
                trainerState.isReadyToStart = false;
                $('#trainer-timer-status').textContent = i18nT('battle.holding', 'Holding...');
                $('#trainer-timer-status').style.color = 'var(--clr-warning)';
                
                if (trainerState.spaceHoldTime > 0) {
                    trainerState.spaceHoldTimeout = setTimeout(() => {
                        trainerState.isReadyToStart = true;
                        $('#trainer-timer-status').textContent = i18nT('algs.ready', 'Ready!');
                        $('#trainer-timer-status').style.color = 'var(--clr-success)';
                    }, trainerState.spaceHoldTime);
                } else {
                    trainerState.isReadyToStart = true;
                    $('#trainer-timer-status').textContent = i18nT('algs.ready', 'Ready!');
                    $('#trainer-timer-status').style.color = 'var(--clr-success)';
                }
            }
        }
        
        function handlePointerUp(e) {
            if (!trainerState.active) return;
            if (trainerState.spaceHeld && !trainerState.timerRunning) {
                clearTimeout(trainerState.spaceHoldTimeout);
                if (trainerState.isReadyToStart) {
                    startTimer();
                } else {
                    $('#trainer-timer-status').textContent = i18nT('algs.pressSpace', 'Press Space to start');
                    $('#trainer-timer-status').style.color = '';
                }
            }
            trainerState.spaceHeld = false;
            trainerState.isReadyToStart = false;
        }

        // The algorithm grid, the case count and the trainer status are all
        // written from here, so a language switch has to redraw them. The event
        // is fired by the global language handler, which cannot see this scope.
        document.addEventListener('cs-algorithms-relabel', () => {
            try {
                const active = document.querySelector('.alg-cat-btn.active');
                if (active) handleSubsetSelection(algEventSelect.value, active.dataset.category);
                if (trainerState.active) renderTimeList();
            } catch (e) { /* algorithms view never opened */ }
        });

        overlay.addEventListener('mousedown', handlePointerDown);
        overlay.addEventListener('touchstart', handlePointerDown);
        overlay.addEventListener('mouseup', handlePointerUp);
        overlay.addEventListener('touchend', handlePointerUp);
        overlay.addEventListener('mouseleave', handlePointerUp);


        $$('.event-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (chip.classList.contains('disabled')) return;
                $$('.event-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                state.event = chip.dataset.event;
                updateEventFormatHint();
                updatePRDisplay();
                updateEventCompInfo();
            });
        });

        // WCA API lookups
        $('#search-comp-btn').addEventListener('click', lookupCompetition);
        $('#search-wca-btn').addEventListener('click', lookupWCAProfile);

        // Past competitions lookup
        $('#search-past-comps-btn').addEventListener('click', fetchPastCompetitions);

        // Also trigger on Enter key
        $('#comp-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupCompetition(); } });
        $('#wca-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupWCAProfile(); } });
        $('#past-comp-wca-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchPastCompetitions(); } });

        // Upcoming competitions by WCA ID lookup
        $('#search-upcoming-comps-btn').addEventListener('click', fetchUpcomingCompetitionsForWCA);
        $('#upcoming-comp-wca-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchUpcomingCompetitionsForWCA(); } });

        // Setup form
        $('#setup-form').addEventListener('submit', handleSetupSubmit);

        // Dashboard buttons
        $('#back-to-setup-btn').addEventListener('click', () => { clearSimState(); switchView('setup'); });
        $('#fullscreen-btn').addEventListener('click', toggleFullscreen);

        // In-simulation Spacebar Timer toggle (moved here from the setup card).
        const dashSpaceToggle = $('#dash-spacebar-toggle');
        if (dashSpaceToggle) {
            dashSpaceToggle.addEventListener('change', () => {
                state.spacebarTimer = dashSpaceToggle.checked;
                resetTimer();
                saveSimState();
            });
        }

        // Volume control
        const volSlider = $('#comp-volume-slider');
        const muteBtn = $('#mute-noise-btn');
        const muteOn = $('#mute-icon-on');
        const muteOff = $('#mute-icon-off');

        if (volSlider) {
            // Restore saved volume
            const savedVol = localStorage.getItem('sc-comp-volume');
            if (savedVol !== null) {
                compNoiseVolume = parseFloat(savedVol);
                ambientNoise.volume = compNoiseVolume;
                volSlider.value = Math.round(compNoiseVolume * 100);
            }
            // Restore saved mute state
            const savedMuted = localStorage.getItem('sc-comp-muted');
            if (savedMuted === 'true') {
                compNoiseMuted = true;
                ambientNoise.volume = 0;
                if (muteOn) muteOn.style.display = 'none';
                if (muteOff) muteOff.style.display = 'block';
                if (muteBtn) {
                    muteBtn.style.color = 'var(--clr-danger)';
                    muteBtn.title = i18nT('title.unmuteNoise', 'Unmute competition noise');
                }
            }

            volSlider.addEventListener('input', () => {
                compNoiseVolume = parseInt(volSlider.value) / 100;
                if (!compNoiseMuted) {
                    ambientNoise.volume = compNoiseVolume;
                }
                localStorage.setItem('sc-comp-volume', compNoiseVolume);
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                compNoiseMuted = !compNoiseMuted;
                localStorage.setItem('sc-comp-muted', compNoiseMuted);
                if (compNoiseMuted) {
                    ambientNoise.volume = 0;
                    if (muteOn) muteOn.style.display = 'none';
                    if (muteOff) muteOff.style.display = 'block';
                    muteBtn.style.color = 'var(--clr-danger)';
                    muteBtn.title = i18nT('title.unmuteNoise', 'Unmute competition noise');
                } else {
                    ambientNoise.volume = compNoiseVolume;
                    if (muteOn) muteOn.style.display = 'block';
                    if (muteOff) muteOff.style.display = 'none';
                    muteBtn.style.color = '';
                    muteBtn.title = i18nT('title.muteNoiseOn', 'Mute competition noise');
                }
            });
        }

        // Toggle scramble colors
        const toggleColorsBtn = $('#toggle-scramble-colors-btn');
        if (toggleColorsBtn) {
            toggleColorsBtn.addEventListener('click', () => {
                const visual = $('#scramble-visual');
                if (visual) visual.classList.toggle('show-colors');
            });
        }

        // Penalty buttons
        $$('.penalty-btn').forEach(btn => {
            btn.addEventListener('click', () => selectPenalty(btn.dataset.penalty));
        });

        // Submit solve
        $('#submit-solve-btn').addEventListener('click', submitSolve);

        // Manual input
        const timeInput = $('#manual-time-input');
        if (timeInput) {
            timeInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (!val) {
                    e.target.value = '';
                    return;
                }
                const num = parseInt(val, 10);
                e.target.value = (num / 100).toFixed(2);
            });
            timeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    $('#submit-solve-btn').click();
                }
            });
        }

        // Spacebar timer (simulation dashboard) — only active when the
        // Spacebar Timer setting is on and the dashboard is showing.
        document.addEventListener('keydown', (e) => { if (e.code === 'Space') simSpaceDown(e); });
        document.addEventListener('keyup', (e) => { if (e.code === 'Space') simSpaceUp(e); });
        // Touch / click on the big timer display acts like the spacebar.
        const spaceTimerEl = $('#sim-space-timer');
        if (spaceTimerEl) {
            const down = (e) => {
                if (!state.spacebarTimer) return;
                e.preventDefault();
                if (state.timerState === 'running') simTimerStop();
                else if (state.timerState === 'stopped') submitSolve();
                else if (state.timerState === 'idle' && !state.spaceHeld) { state.spaceHeld = true; simTimerReady(); }
            };
            const up = (e) => {
                if (!state.spacebarTimer) return;
                e.preventDefault();
                if (state.timerState === 'ready') simTimerStart();
                state.spaceHeld = false;
            };
            spaceTimerEl.addEventListener('mousedown', down);
            spaceTimerEl.addEventListener('mouseup', up);
            spaceTimerEl.addEventListener('touchstart', down, { passive: false });
            spaceTimerEl.addEventListener('touchend', up, { passive: false });
        }

        // Round end
        $('#next-round-btn').addEventListener('click', startNextRound);
        $('#new-sim-btn').addEventListener('click', () => {
            clearSimState();
            $('#round-end-overlay').style.display = 'none';
            switchView('setup');
        });
        $('#copy-results-btn').addEventListener('click', copyResults);

        // History
        $('#clear-history-btn').addEventListener('click', clearHistory);


    }

    // ========== WCA API: COMPETITION LOOKUP ==========
    async function lookupCompetition() {
        const compId = $('#comp-id').value.trim();
        if (!compId) { showToast(i18nT('toast.needCompId', 'Please enter a competition ID'), 'error'); return; }

        // Show loading
        $('#comp-info-display').style.display = 'none';
        $('#comp-error-display').style.display = 'none';
        $('#comp-loading').style.display = 'flex';
        $('#search-comp-btn').classList.add('loading');

        try {
            const res = await fetch(`${WCA_API}/competitions/${compId}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();

            state.compData = data;
            state.compId = data.id;
            state.compName = data.name;
            state.numCompetitors = data.competitor_limit || 30;

            // Drop the previous competition's rounds before fetching the new
            // ones. Without this, a WCIF that fails after one that succeeded
            // leaves the old competition's round count and cutoffs in place.
            state.wcifData = null;
            state.wcifRounds = [];
            state.wcifRoundsKnown = false;

            // Display info
            $('#comp-display-name').textContent = data.name;
            $('#comp-display-date').textContent = `${data.start_date}${data.end_date !== data.start_date ? ' → ' + data.end_date : ''}`;

            // Parse venue from markdown link if needed
            let venue = data.venue || '';
            const venueMatch = venue.match(/\[([^\]]+)\]/);
            if (venueMatch) venue = venueMatch[1];
            $('#comp-display-venue').textContent = venue || 'N/A';

            $('#comp-display-city').textContent = `${data.city || ''}, ${data.country_iso2 || ''}`;
            $('#comp-display-limit').textContent = `Competitor limit: ${data.competitor_limit || 'None'}`;
            $('#comp-display-events').textContent = `Events: ${(data.event_ids || []).map(e => EVENT_NAMES[e] || e).join(', ')}`;

            // Update event chips - enable only events at this comp
            if (data.event_ids) {
                updateAvailableEvents(data.event_ids);
            }

            // Fetch WCIF for round/cutoff/time-limit data. Awaited: it is what
            // fills in the round list, and firing it off unawaited meant the
            // dropdown could still be showing the hardcoded four rounds when
            // the competition was announced as loaded.
            await fetchWCIF(compId);

            $('#comp-info-display').style.display = 'block';
            $('#comp-error-display').style.display = 'none';
            showToast(`✅ ${i18nT('toast.found', 'Found')}: ${data.short_name || data.name}`, 'success');

        } catch (err) {
            console.error('Error fetching competition:', err);
            state.compData = null;
            $('#comp-info-display').style.display = 'none';
            $('#comp-error-display').style.display = 'flex';
            $('#comp-error-text').textContent = `Competition "${compId}" not found. Error: ${err.message}`;
        } finally {
            $('#comp-loading').style.display = 'none';
            $('#search-comp-btn').classList.remove('loading');
        }
    }

    async function fetchWCIF(compId) {
        try {
            const res = await fetch(`${WCA_API}/competitions/${compId}/wcif/public`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            state.wcifData = data;

            // Count actual competitors for this event
            updateEventCompInfo();

        } catch (err) {
            // Not every competition exposes a public WCIF. Say so rather than
            // quietly pretending every event has four rounds — the round list
            // is the one thing only the WCIF can tell us.
            console.warn('[Sim] WCIF unavailable for', compId, err);
            state.wcifData = null;
            updateEventCompInfo();
            showToast(i18nT('toast.noWcif',
                'Round data unavailable for this competition — rounds and cutoffs are estimated.'), 'info');
        }
    }

    function updateAvailableEvents(eventIds) {
        $$('.event-chip').forEach(chip => {
            const event = chip.dataset.event;
            if (eventIds.includes(event)) {
                chip.classList.remove('disabled');
            } else {
                chip.classList.add('disabled');
                chip.classList.remove('selected');
            }
        });

        // If currently selected event isn't available, select the first available
        const selectedChip = $('.event-chip.selected');
        if (!selectedChip || selectedChip.classList.contains('disabled')) {
            const firstAvailable = $(`.event-chip:not(.disabled)`);
            if (firstAvailable) {
                firstAvailable.classList.add('selected');
                firstAvailable.querySelector('input').checked = true;
                state.event = firstAvailable.dataset.event;
                updateEventFormatHint();
                updatePRDisplay();
            }
        }
    }

    // Rebuild the "Starting Round" dropdown so it only offers rounds that
    // actually exist for the current event (state.numRounds), with the
    // correct WCA names. Keeps the current pick if still valid, otherwise
    // clamps it to the last existing round.
    function updateRoundOptions() {
        const sel = $('#round-select');
        if (!sel) return;
        const total = Math.max(1, state.numRounds || 4);
        const names = roundNamesFor(total);
        const prev = parseInt(sel.value, 10) || 1;
        sel.innerHTML = '';
        for (let i = 1; i <= total; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = names[i];
            sel.appendChild(opt);
        }
        sel.value = String(Math.min(prev, total));
    }

    function updateEventCompInfo() {
        const infoPanel = $('#event-comp-info');

        if (!state.wcifData) {
            // No competition loaded — allow a generic multi-round custom sim.
            state.wcifRounds = [];
            state.wcifRoundsKnown = false;
            state.numRounds = 4;
            updateRoundOptions();
            infoPanel.style.display = 'none';
            return;
        }

        // Find the selected event in WCIF
        const eventData = (state.wcifData.events || []).find(e => e.id === state.event);
        if (!eventData || !eventData.rounds || eventData.rounds.length === 0) {
            state.wcifRounds = [];
            state.wcifRoundsKnown = false;
            state.numRounds = 4;
            updateRoundOptions();
            infoPanel.style.display = 'none';
            return;
        }

        // Keep the rounds themselves, not just how many there are: the
        // advancement condition for each one lives in here.
        state.wcifRounds = eventData.rounds;
        state.wcifRoundsKnown = true;

        // The limits belong to the round being played. Reading round 1's for a
        // simulation starting at round 2 gave the wrong cutoff, and later
        // rounds routinely drop the cutoff altogether.
        const startRound = Math.min(
            parseInt(($('#round-select') || {}).value, 10) || 1,
            eventData.rounds.length,
        );
        const round1 = eventData.rounds[startRound - 1] || eventData.rounds[0];

        // Time limit
        const timeLimit = round1.timeLimit;
        if (timeLimit) {
            const tlSeconds = timeLimit.centiseconds / 100;
            state.timeLimit = tlSeconds;
            $('#event-time-limit').textContent = formatTime(tlSeconds);
        } else {
            $('#event-time-limit').textContent = '10:00';
            state.timeLimit = 600;
        }

        // Cutoff
        const cutoff = round1.cutoff;
        if (cutoff) {
            const cutSeconds = cutoff.attemptResult / 100;
            state.cutoff = cutSeconds;
            $('#event-cutoff').textContent = formatTime(cutSeconds) + ` (best of ${cutoff.numberOfAttempts})`;
        } else {
            state.cutoff = 0;
            $('#event-cutoff').textContent = 'None';
        }

        // Number of rounds for this event — drives the round dropdown so
        // the user can't pick a round the competition doesn't have.
        state.numRounds = eventData.rounds.length;
        $('#event-rounds-count').textContent = `${eventData.rounds.length} round${eventData.rounds.length > 1 ? 's' : ''}`;
        updateRoundOptions();

        // Count competitors registered for this event
        const registeredForEvent = (state.wcifData.persons || []).filter(p =>
            p.registration && p.registration.status === 'accepted' &&
            p.registration.eventIds && p.registration.eventIds.includes(state.event)
        ).length;
        state.numCompetitors = Math.max(registeredForEvent, 2);
        $('#event-competitor-count').textContent = `${registeredForEvent} registered`;

        infoPanel.style.display = 'block';
    }

    // ========== WCA API: RECORDS ==========
    let activeRecordEvent = null;
    let fetchedWorldRecords = null;
    // Whole /records payload: world + continental + national buckets, each
    // { eventId: { single: <raw>, average: <raw> } }.
    let liveWcaRecords = null;

    // Records view filter state. `region` is 'world', a continent id
    // ('_Europe') or a WCA country id ('Portugal').
    const recordsFilter = { event: 'all', region: 'world', type: 'both' };

    // Fixed WCA display order for the events we cover.
    const RECORDS_EVENT_ORDER = [
        '333', '222', '444', '555', '666', '777',
        '333bf', '333fm', '333oh', 'clock', 'minx',
        'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf'
    ];

    // Convert a raw WCA record value into the format used by our record store.
    function wcaRawToDisplay(eventId, raw, isAverage) {
        if (raw === null || raw === undefined) return null;
        if (eventId === '333mbf') return { time: decodeMBLD(raw), isMulti: true };
        if (eventId === '333fm') {
            return isAverage
                ? { time: raw / 100, isMoves: true }
                : { time: raw, isMoves: true };
        }
        return { time: raw / 100 }; // centiseconds -> seconds
    }

    // Live record TIMES from the official WCA API. (The v0 endpoint has no
    // holder names, so holder/competition metadata comes from our stored
    // list and is refreshed via the admin page.)
    async function fetchLiveWcaRecords() {
        if (liveWcaRecords) return liveWcaRecords;
        try {
            const res = await fetch('https://www.worldcubeassociation.org/api/v0/records');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (data && data.world_records) {
                liveWcaRecords = {
                    world: data.world_records,
                    continental: data.continental_records || {},
                    national: data.national_records || {},
                };
            }
        } catch (err) {
            console.warn('Live WCA records unavailable, using stored records:', err);
        }
        return liveWcaRecords;
    }

    // Live records for the selected region, as { eventId: { single, average } }.
    // Returns null when we have no live data at all (offline / API down), which
    // makes the table fall back to the curated world records.
    function recordsForRegion(region) {
        if (!liveWcaRecords) return null;
        if (!region || region === 'world') return liveWcaRecords.world || null;
        if (region.startsWith('_')) return (liveWcaRecords.continental || {})[region] || {};
        return (liveWcaRecords.national || {})[region] || {};
    }

    // WR / CR / NR, matching the region being shown.
    function recordLevelLabel(region) {
        if (!region || region === 'world') return 'WR';
        return region.startsWith('_') ? 'CR' : 'NR';
    }

    // Build the record for one event in the active region: live times from the
    // WCA overlaid on our curated holder/competition metadata. Holder metadata
    // only applies worldwide — the API gives no names for regional records.
    function buildRecordFor(eventId, regionRecords, isWorld) {
        const stored = (fetchedWorldRecords && fetchedWorldRecords[eventId])
            ? fetchedWorldRecords[eventId]
            : WORLD_RECORDS[eventId];

        const live = regionRecords && regionRecords[eventId];
        if (!live) {
            // No live data for this region/event. Worldwide we can still show
            // the curated record; regionally we have nothing to show.
            return isWorld ? stored : null;
        }

        const meta = isWorld ? stored : null;
        const rec = { single: null, average: null };
        const liveSingle = wcaRawToDisplay(eventId, live.single, false);
        const liveAvg = wcaRawToDisplay(eventId, live.average, true);

        // The live feed carries times but no names — the v0 endpoint has none —
        // so holder and competition can only come from the stored list. That is
        // fine right up until a record changes hands: the time updates, the
        // name does not, and the page credits the previous holder with somebody
        // else's result. On a page headed "Official WCA records" that is the
        // worst kind of wrong, because it is specific and plausible.
        //
        // So the stored metadata is only trusted while it still describes the
        // time being shown. When the two disagree the record has moved on: show
        // the live time with no name rather than the wrong name. Self-correcting
        // for every event, instead of relying on someone noticing.
        const metaFor = (side, liveVal) => {
            const stale = !side || typeof side.time !== 'number'
                || Math.abs(side.time - liveVal.time) > 0.005;
            return stale ? {} : side;
        };

        if (liveSingle) {
            rec.single = Object.assign(
                { holder: '—', country: '', competition: '' },
                metaFor(meta && meta.single, liveSingle),
                liveSingle,
            );
        } else if (isWorld) {
            rec.single = meta && meta.single;
        }
        if (liveAvg) {
            rec.average = Object.assign(
                { holder: '—', country: '', competition: '' },
                metaFor(meta && meta.average, liveAvg),
                liveAvg,
            );
        } else if (isWorld) {
            rec.average = meta && meta.average;
        }
        return (rec.single || rec.average) ? rec : null;
    }

    async function loadWorldRecords() {
        if (!fetchedWorldRecords || !liveWcaRecords) {
            $('#records-loading').style.display = 'flex';
            $('#records-table').style.display = 'none';
            const [customRes] = await Promise.allSettled([
                fetch('https://simulatecubing-default-rtdb.firebaseio.com/records.json').then(r => r.json()),
                fetchLiveWcaRecords()
            ]);
            if (customRes.status === 'fulfilled' && customRes.value) {
                fetchedWorldRecords = customRes.value;
            }
        }
        buildRecordsFilters();
        renderRecordsTable();
        fetchUpcomingCompetitions();
    }

    // Populate the event/region selects once, then keep them in sync with
    // the active language.
    let _recordsFiltersBuilt = false;
    function buildRecordsFilters() {
        const eventSel = $('#records-event-filter');
        const regionSel = $('#records-region-filter');
        if (!eventSel || !regionSel) return;

        // Events
        eventSel.innerHTML = '';
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = i18nT('records.allEvents', 'All events');
        eventSel.appendChild(allOpt);
        RECORDS_EVENT_ORDER.forEach(id => {
            if (!EVENT_NAMES[id]) return;
            const o = document.createElement('option');
            o.value = id;
            o.textContent = EVENT_NAMES[id];
            eventSel.appendChild(o);
        });
        eventSel.value = recordsFilter.event;

        // Regions: World, then continents, then countries
        const W = window.WcaCountries;
        regionSel.innerHTML = '';
        const world = document.createElement('option');
        world.value = 'world';
        world.textContent = i18nT('records.world', 'World');
        regionSel.appendChild(world);
        if (W) {
            const contGroup = document.createElement('optgroup');
            contGroup.label = i18nT('records.continents', 'Continents');
            W.continents.forEach(c => {
                const o = document.createElement('option');
                o.value = c.id;
                o.textContent = c.name;
                contGroup.appendChild(o);
            });
            regionSel.appendChild(contGroup);

            const countryGroup = document.createElement('optgroup');
            countryGroup.label = i18nT('records.countries', 'Countries');
            W.countries.forEach(c => {
                const o = document.createElement('option');
                o.value = c.id;
                o.textContent = c.name;
                countryGroup.appendChild(o);
            });
            regionSel.appendChild(countryGroup);
        }
        regionSel.value = recordsFilter.region;

        if (_recordsFiltersBuilt) return;
        _recordsFiltersBuilt = true;

        eventSel.addEventListener('change', () => {
            recordsFilter.event = eventSel.value;
            renderRecordsTable();
        });
        regionSel.addEventListener('change', () => {
            recordsFilter.region = regionSel.value;
            renderRecordsTable();
        });
        $$('.records-filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                $$('.records-filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                recordsFilter.type = chip.dataset.type;
                renderRecordsTable();
            });
        });
    }

    // Everything this module writes into the DOM itself — option labels,
    // table bodies, badges, empty states — is invisible to data-i18n, so it
    // has to be rebuilt when the language changes. Each renderer bails out on
    // its own when its view has never been opened, and a failure in one must
    // not stop the rest, hence the per-call guard.
    document.addEventListener('app-language-changed', () => {
        const redraw = (fn) => { try { fn(); } catch (e) { /* view not ready */ } };
        if (_recordsFiltersBuilt) {
            redraw(buildRecordsFilters);
            redraw(renderRecordsTable);
        }
        redraw(updateRoundOptions);
        redraw(updateEventFormatHint);
        redraw(updateScorecard);
        redraw(updateGoalTracker);
        redraw(renderLeaderboard);
        redraw(renderHistory);
        if (battleState.lastLobbyData) redraw(() => renderBattleLobby(battleState.lastLobbyData));
        if (battleState.currentRoomData) redraw(() => renderBattleRoomView(battleState.currentRoomData));
        document.dispatchEvent(new CustomEvent('cs-algorithms-relabel'));
    });

    // Format one side of a record for the table. FMC counts moves: a single is
    // a whole number, a mean always carries two decimals (WCA convention).
    function formatRecordValue(rec, isAverage) {
        if (!rec) return '—';
        if (rec.isMulti) return rec.time;
        if (rec.isMoves) {
            if (typeof rec.time !== 'number') return String(rec.time);
            return isAverage ? rec.time.toFixed(2) : String(rec.time);
        }
        return formatTime(rec.time);
    }

    function formatRecordHolder(rec) {
        if (!rec || !rec.holder || rec.holder === '—') return '—';
        return `${countryFlagImg(rec.country)} ${rec.holder}`;
    }

    function renderRecordsTable() {
        const tbody = $('#records-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        activeRecordEvent = null;

        const region = recordsFilter.region;
        const isWorld = !region || region === 'world';
        const regionRecords = recordsForRegion(region);
        const showSingle = recordsFilter.type !== 'average';
        const showAverage = recordsFilter.type !== 'single';

        // Column visibility follows the type filter, and holder columns only
        // carry names worldwide.
        const table = $('#records-table');
        if (table) {
            table.classList.toggle('hide-single', !showSingle);
            table.classList.toggle('hide-average', !showAverage);
            table.classList.toggle('hide-holders', !isWorld);
        }

        // Column headings follow the region: WR / CR / NR.
        const level = recordLevelLabel(region);
        const thSingle = $('#records-th-single');
        const thAverage = $('#records-th-average');
        if (thSingle) thSingle.textContent = `${level} ${i18nT('records.col.single', 'Single')}`;
        if (thAverage) thAverage.textContent = `${level} ${i18nT('records.col.average', 'Average')}`;

        const events = recordsFilter.event === 'all'
            ? RECORDS_EVENT_ORDER
            : RECORDS_EVENT_ORDER.filter(id => id === recordsFilter.event);

        const rendered = [];
        events.forEach(eventId => {
            if (!EVENT_NAMES[eventId]) return;
            const rec = buildRecordFor(eventId, regionRecords, isWorld);
            if (!rec) return;
            // Respect the type filter: a row with nothing to show is dropped.
            if (!showSingle && !rec.average) return;
            if (!showAverage && !rec.single) return;

            const tr = document.createElement('tr');
            tr.className = 'records-row';
            tr.dataset.event = eventId;
            tr.innerHTML = `
                <td class="rec-event">
                    <span class="rec-event-name">${EVENT_NAMES[eventId]}</span>
                </td>
                <td class="rec-time rec-single" data-label="${level} ${esc(i18nT('records.col.single', 'Single'))}">${formatRecordValue(rec.single, false)}</td>
                <td class="rec-holder rec-holder-single">${formatRecordHolder(rec.single)}</td>
                <td class="rec-time rec-average" data-label="${level} ${esc(i18nT('records.col.average', 'Average'))}">${formatRecordValue(rec.average, true)}</td>
                <td class="rec-holder rec-holder-average">${formatRecordHolder(rec.average)}</td>
                <td class="rec-expand-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></td>
            `;
            tr.addEventListener('click', () => toggleRecordDetail(eventId, tr, rec));
            tbody.appendChild(tr);
            rendered.push({ eventId, rec });
        });

        renderRecordsSummary(rendered, isWorld);

        const empty = $('#records-empty');
        if (empty) empty.style.display = rendered.length ? 'none' : 'flex';
        const note = $('#records-holder-note');
        if (note) note.style.display = (!isWorld && rendered.length) ? 'flex' : 'none';

        $('#records-loading').style.display = 'none';
        // Empty string, not 'table': an inline display would beat the mobile
        // stylesheet, which lays the rows out as cards instead.
        if (table) table.style.display = rendered.length ? '' : 'none';
    }

    // Summary cards above the table, reflecting the current selection.
    function renderRecordsSummary(rendered, isWorld) {
        const strip = $('#records-stats-strip');
        if (!strip) return;

        const regionId = recordsFilter.region;
        const W = window.WcaCountries;
        // Country and continent names come from the WCA's own English list and
        // stay as published; only "World" is a plain word we translate.
        const regionName = (!regionId || regionId === 'world')
            ? i18nT('records.world', 'World')
            : (W ? W.name(regionId) : i18nT('records.world', 'World'));
        const iso2 = W ? W.iso2(regionId) : '';
        const regionIcon = iso2
            ? countryFlagImg(iso2, 26)
            : (isWorld ? '🌍' : '🌐');

        // Fastest single / average among the rendered rows (timed events only —
        // FMC counts moves and MBLD is a composite string).
        const timed = rendered.filter(r => r.rec && !(r.rec.single || {}).isMulti && !(r.rec.single || {}).isMoves);
        const best = (key) => {
            const vals = timed.map(r => r.rec[key]).filter(r => r && typeof r.time === 'number');
            if (!vals.length) return null;
            return vals.reduce((a, b) => (a.time <= b.time ? a : b));
        };
        const bestSingle = best('single');
        const bestAverage = best('average');
        const bestSingleEvent = bestSingle ? timed.find(r => r.rec.single === bestSingle) : null;
        const bestAvgEvent = bestAverage ? timed.find(r => r.rec.average === bestAverage) : null;

        const card = (icon, value, label) => `
            <div class="records-stat-card">
                <div class="records-stat-icon">${icon}</div>
                <div class="records-stat-info">
                    <span class="records-stat-value">${value}</span>
                    <span class="records-stat-label">${label}</span>
                </div>
            </div>`;

        strip.innerHTML = [
            card(regionIcon, esc(regionName), i18nT('records.stat.region', 'Region')),
            card('🧩', String(rendered.length), i18nT('records.stat.events', 'Events with records')),
            card('⚡', bestSingle ? `${formatRecordValue(bestSingle, false)} <small>${esc(EVENT_NAMES[bestSingleEvent.eventId])}</small>` : '—',
                 i18nT('records.stat.fastestSingle', 'Fastest single')),
            card('📊', bestAverage ? `${formatRecordValue(bestAverage, true)} <small>${esc(EVENT_NAMES[bestAvgEvent.eventId])}</small>` : '—',
                 i18nT('records.stat.fastestAverage', 'Fastest average')),
        ].join('');
    }



    async function fetchUpcomingCompetitions() {
        const listContainer = $('#upcoming-comps-list');
        if (!listContainer) return;

        listContainer.innerHTML = `<div class="upcoming-comps-loading"><div class="spinner"></div><span>${esc(i18nT('comps.loading', 'Loading upcoming competitions...'))}</span></div>`;

        try {
            const today = new Date().toISOString().split('T')[0];
            // The WCA `start` filter is on the competition's END date, so it
            // also returns events that are already under way (and ones that
            // began today). Ask for a bigger page and keep only the ones that
            // have not started yet, so "Upcoming" really means upcoming.
            const res = await fetch(`${WCA_API}/competitions?start=${today}&sort=start_date&per_page=75`);
            if (!res.ok) throw new Error('Failed to fetch');
            const all = await res.json();
            const comps = all
                .filter(c => c.start_date && c.start_date > today)
                .sort((a, b) => a.start_date.localeCompare(b.start_date))
                .slice(0, 20);

            if (comps.length === 0) {
                listContainer.innerHTML = `<div class="upcoming-comps-empty">${esc(i18nT('comps.none', 'No upcoming competitions found.'))}</div>`;
                return;
            }

            listContainer.innerHTML = '';

            comps.forEach(comp => {
                const countryCode = comp.country_iso2 || '';
                const city = comp.city || 'Unknown';
                const limit = comp.competitor_limit || '—';
                const startDate = comp.start_date || '';
                const endDate = comp.end_date || '';
                const dateStr = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
                const shortName = comp.short_name || comp.name || 'Competition';
                const compUrl = `https://www.worldcubeassociation.org/competitions/${comp.id}`;

                const card = document.createElement('a');
                card.className = 'upcoming-comp-item';
                card.href = compUrl;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
                card.innerHTML = `
                    <div class="upcoming-comp-info">
                        <span class="upcoming-comp-name">${shortName}</span>
                        <span class="upcoming-comp-meta">${countryFlagImg(countryCode, 14)} ${city} · 👥 ${limit}</span>
                    </div>
                    <span class="upcoming-comp-date">${dateStr}</span>
                `;
                listContainer.appendChild(card);
            });
            state.upcomingCompsFetched = true;
        } catch (err) {
            console.error('Error fetching upcoming competitions:', err);
            listContainer.innerHTML = `<div class="upcoming-comps-empty">${esc(i18nT('comps.loadFailed', 'Failed to load upcoming competitions.'))}</div>`;
        }
    }

    // `record` is the merged record the table row was built from, so the
    // expanded detail can never contradict the row above it.
    function toggleRecordDetail(eventId, rowEl, record) {
        // Close any existing detail row
        const existing = document.querySelector('.record-detail-row');
        const wasActive = existing && existing.dataset.event === eventId;

        if (existing) {
            existing.classList.add('closing');
            setTimeout(() => existing.remove(), 300);
            document.querySelectorAll('.records-row.active').forEach(r => r.classList.remove('active'));
        }

        if (wasActive) {
            activeRecordEvent = null;
            return;
        }

        activeRecordEvent = eventId;
        rowEl.classList.add('active');

        const rec = record
            || (fetchedWorldRecords && fetchedWorldRecords[eventId])
            || WORLD_RECORDS[eventId];
        if (!rec) return;

        const detailRow = document.createElement('tr');
        detailRow.className = 'record-detail-row';
        detailRow.dataset.event = eventId;

        // WR / CR / NR, matching the region the table is showing.
        const level = recordLevelLabel(recordsFilter.region);

        // Holder and competition only exist for world records; regional rows
        // carry the time alone.
        const detailMeta = (side) => {
            let html = '';
            if (side.holder && side.holder !== '—') {
                html += `
                    <div class="record-detail-holder">
                        <span class="record-detail-flag">${countryFlagImg(side.country, 28)}</span>
                        <span class="record-detail-name">${esc(side.holder)}</span>
                    </div>`;
            }
            if (side.competition) {
                html += `
                    <div class="record-detail-comp">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${esc(side.competition)}
                    </div>`;
            }
            return html;
        };

        let singleCard = '';
        if (rec.single) {
            let timeDisplay;
            if (rec.single.isMulti) timeDisplay = rec.single.time;
            else if (rec.single.isMoves) timeDisplay = `${rec.single.time} moves`;
            else timeDisplay = formatTime(rec.single.time);

            singleCard = `
                <div class="record-detail-card record-detail-single">
                    <div class="record-detail-badge">${level} SINGLE</div>
                    <div class="record-detail-time">${timeDisplay}</div>
                    ${detailMeta(rec.single)}
                </div>
            `;
        }

        let avgCard = '';
        if (rec.average) {
            let timeDisplay;
            if (rec.average.isMoves) timeDisplay = `${rec.average.time.toFixed(2)} moves`;
            else timeDisplay = formatTime(rec.average.time);

            avgCard = `
                <div class="record-detail-card record-detail-average">
                    <div class="record-detail-badge avg-badge">${level} AVERAGE</div>
                    <div class="record-detail-time">${timeDisplay}</div>
                    ${detailMeta(rec.average)}
                </div>
            `;
        }

        // Comparison bar (only for timed events with both records)
        let comparisonBar = '';
        if (rec.single && rec.average && !rec.single.isMulti && !rec.single.isMoves) {
            const ratio = Math.min((rec.single.time / rec.average.time) * 100, 100);
            comparisonBar = `
                <div class="record-comparison">
                    <div class="comparison-label">Single vs Average</div>
                    <div class="comparison-bar-wrap">
                        <div class="comparison-bar-fill" style="width: ${ratio}%"></div>
                    </div>
                    <div class="comparison-values">
                        <span>${formatTime(rec.single.time)}</span>
                        <span class="comparison-diff">Δ ${formatTime(rec.average.time - rec.single.time)}</span>
                        <span>${formatTime(rec.average.time)}</span>
                    </div>
                </div>
            `;
        }

        detailRow.innerHTML = `
            <td colspan="6">
                <div class="record-detail-content">
                    <div class="record-detail-cards">
                        ${singleCard}
                        ${avgCard}
                    </div>
                    ${comparisonBar}
                </div>
            </td>
        `;

        rowEl.after(detailRow);
        // Force reflow for animation
        detailRow.offsetHeight;
        detailRow.classList.add('open');
    }

    function decodeMBLD(value) {
        if (!value || value <= 0) return '—';
        const str = String(value).padStart(9, '0');
        const difference = 99 - parseInt(str.slice(0, 2), 10);
        const timeInSeconds = parseInt(str.slice(2, 7), 10);
        const missed = parseInt(str.slice(7, 9), 10);
        const solved = difference + missed;
        const attempted = solved + missed;

        const mins = Math.floor(timeInSeconds / 60);
        const secs = timeInSeconds % 60;
        return `${solved}/${attempted} ${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ========== WCA API: PERSON LOOKUP ==========
    async function lookupWCAProfile(overrideWcaId = null, quiet = false) {
        const wcaId = (typeof overrideWcaId === 'string' ? overrideWcaId : ($('#wca-id') ? $('#wca-id').value : '')).trim().toUpperCase();
        if (!wcaId) { showToast(i18nT('toast.needWcaId', 'Please enter a WCA ID'), 'error'); return; }

        if (!quiet) {
            // Show loading
            if ($('#wca-info-display')) $('#wca-info-display').style.display = 'none';
            if ($('#wca-error-display')) $('#wca-error-display').style.display = 'none';
            if ($('#wca-loading')) $('#wca-loading').style.display = 'flex';
            if ($('#search-wca-btn')) $('#search-wca-btn').classList.add('loading');
        }

        try {
            const res = await fetch(`${WCA_API}/persons/${wcaId}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();

            state.playerData = data;
            state.playerWcaId = data.person.wca_id;
            state.playerName = data.person.name;

            // Display info ALWAYS (so if user visits stats or setup page, it's populated)
            if ($('#wca-display-name')) $('#wca-display-name').textContent = data.person.name;
            if ($('#wca-display-country')) $('#wca-display-country').textContent = data.person.country ? data.person.country.name : 'N/A';
            if ($('#wca-display-medals')) $('#wca-display-medals').textContent = `🥇${data.medals.gold} 🥈${data.medals.silver} 🥉${data.medals.bronze}`;
            if ($('#wca-display-comps')) $('#wca-display-comps').textContent = `${data.competition_count} competitions`;

                // Avatar
                const avatar = data.person.avatar;
                if ($('#wca-avatar')) {
                    if (avatar && !avatar.is_default && avatar.thumb_url) {
                        $('#wca-avatar').src = avatar.thumb_url;
                        $('#wca-avatar').style.display = 'block';
                    } else {
                        $('#wca-avatar').style.display = 'none';
                    }
                }

                // Populate Statistics Tab
                if ($('#stats-placeholder')) $('#stats-placeholder').style.display = 'none';
                if ($('#stats-content')) $('#stats-content').style.display = 'block';
                if ($('#stats-name')) $('#stats-name').textContent = data.person.name;
                if ($('#stats-country')) $('#stats-country').textContent = data.person.country ? data.person.country.name : 'N/A';
                if ($('#stat-comps-count')) $('#stat-comps-count').textContent = data.competition_count;
                if ($('#stat-gold')) $('#stat-gold').textContent = data.medals.gold;
                if ($('#stat-silver')) $('#stat-silver').textContent = data.medals.silver;
                if ($('#stat-bronze')) $('#stat-bronze').textContent = data.medals.bronze;
                if ($('#stats-wcaid')) $('#stats-wcaid').textContent = data.person.wca_id;

                const genderMap = { 'm': 'Male', 'f': 'Female', 'o': 'Other' };
                if ($('#stats-gender-badge')) {
                    if (data.person.gender && genderMap[data.person.gender]) {
                        if ($('#stats-gender')) $('#stats-gender').textContent = genderMap[data.person.gender];
                        $('#stats-gender-badge').style.display = 'inline-block';
                    } else {
                        $('#stats-gender-badge').style.display = 'none';
                    }
                }

                const totalEvents = Object.keys(data.personal_records).length;
                const totalMedals = data.medals.gold + data.medals.silver + data.medals.bronze;
                if ($('#stats-total-events')) $('#stats-total-events').textContent = totalEvents;
                if ($('#stats-total-medals')) $('#stats-total-medals').textContent = totalMedals;

                // Populate PR Table
                const prBody = $('#stats-pr-body');
                if (prBody) {
                    prBody.innerHTML = '';
                    const prEvents = Object.keys(data.personal_records);
                    const wcaOrderFull = [
                        '333', '222', '444', '555', '666', '777',
                        '333bf', '333fm', '333oh', 'clock', 'minx',
                        'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf'
                    ];
                    prEvents.sort((a, b) => {
                        let idxA = wcaOrderFull.indexOf(a);
                        let idxB = wcaOrderFull.indexOf(b);
                        if (idxA === -1) idxA = 999;
                        if (idxB === -1) idxB = 999;
                        return idxA - idxB;
                    });

                    prEvents.forEach(eventId => {
                        const pr = data.personal_records[eventId];
                        const tr = document.createElement('tr');

                        let singleStr = '—';
                        let avgStr = '—';
                        let worldRank = '—';
                        let nationalRank = '—';

                        if (pr.single) {
                            if (eventId === '333fm') singleStr = String(pr.single.best);
                            else if (eventId === '333mbf') singleStr = decodeMBLD(pr.single.best);
                            else singleStr = formatTime(pr.single.best / 100);
                            worldRank = pr.single.world_rank;
                            nationalRank = pr.single.country_rank;
                        }

                        if (pr.average) {
                            if (eventId === '333fm') avgStr = (pr.average.best / 100).toFixed(2);
                            else avgStr = formatTime(pr.average.best / 100);
                            if (!pr.single || (pr.average.world_rank < pr.single.world_rank)) {
                                worldRank = pr.average.world_rank;
                                nationalRank = pr.average.country_rank;
                            }
                        }

                        tr.innerHTML = `
                            <td class="lb-name" style="font-weight: 600; text-align: center;">${EVENT_NAMES[eventId] || eventId}</td>
                            <td class="lb-best" style="font-family: var(--font-mono); font-weight: 500; text-align: center;">${singleStr}</td>
                            <td class="lb-avg" style="font-family: var(--font-mono); font-weight: 500; text-align: center;">${avgStr}</td>
                            <td style="font-family: var(--font-mono); color: var(--clr-primary); font-weight: 600; text-align: center;">#${nationalRank}</td>
                            <td style="font-family: var(--font-mono); color: var(--clr-primary); font-weight: 600; text-align: center;">#${worldRank}</td>
                        `;
                        prBody.appendChild(tr);
                    });
                }

                // Update PR display for selected event
                updatePRDisplay();

                if ($('#stats-avatar')) {
                    const avatar2 = data.person.avatar;
                    if (avatar2 && !avatar2.is_default && avatar2.thumb_url) {
                        $('#stats-avatar').src = avatar2.thumb_url;
                        $('#stats-avatar').style.display = 'block';
                    } else {
                        $('#stats-avatar').style.display = 'none';
                    }
                }

                if ($('#wca-info-display')) $('#wca-info-display').style.display = 'block';
                if ($('#wca-error-display')) $('#wca-error-display').style.display = 'none';
                
                if (!quiet) {
                    showToast(`✅ ${i18nT('toast.found', 'Found')}: ${data.person.name}`, 'success');
                }
            // End of removed if (!quiet) block

        } catch (err) {
            console.error('Error fetching WCA profile:', err);
            state.playerData = null;
            if (!quiet) {
                if ($('#wca-info-display')) $('#wca-info-display').style.display = 'none';
                if ($('#wca-error-display')) $('#wca-error-display').style.display = 'flex';
                if ($('#wca-error-text')) $('#wca-error-text').textContent = `WCA ID "${wcaId}" not found. Error: ${err.message}`;
            }
        } finally {
            if (!quiet) {
                if ($('#wca-loading')) $('#wca-loading').style.display = 'none';
                if ($('#search-wca-btn')) $('#search-wca-btn').classList.remove('loading');
            }
        }
    }

    // ========== WCA API: PAST COMPETITIONS LOOKUP ==========

    async function fetchPastCompetitions() {
        const wcaId = $('#past-comp-wca-id').value.trim().toUpperCase();
        if (!wcaId) { showToast(i18nT('toast.needWcaId', 'Please enter a WCA ID'), 'error'); return; }

        const loadingDiv = $('#past-comps-loading');
        const errorDiv = $('#past-comps-error');
        const resultsDiv = $('#past-comps-results');
        const errorText = $('#past-comps-error-text');
        const btn = $('#search-past-comps-btn');

        loadingDiv.style.display = 'flex';
        errorDiv.style.display = 'none';
        resultsDiv.style.display = 'none';
        btn.classList.add('loading');
        resultsDiv.innerHTML = '';

        try {
            // Check if person exists first to get a clean 404
            const personRes = await fetch(`${WCA_API}/persons/${wcaId}`);
            if (!personRes.ok) throw new Error(`WCA ID ${wcaId} not found.`);

            const resultsRes = await fetch(`${WCA_API}/persons/${wcaId}/results`);
            if (!resultsRes.ok) throw new Error('Could not fetch results.');

            const resultsData = await resultsRes.json();

            if (!resultsData || resultsData.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No competitions found for ${wcaId}.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // Extract unique competition IDs in chronological order (WCA API natural order)
            const uniqueComps = new Set();
            resultsData.forEach(r => uniqueComps.add(r.competition_id));

            // Reverse to get latest to oldest
            const compsList = Array.from(uniqueComps).reverse();

            resultsDiv.innerHTML = `<div class="upcoming-comps-title" style="margin-bottom: var(--space-sm); text-align: left;">Past Competitions (${compsList.length})</div>`;

            const compListContainer = document.createElement('div');
            compListContainer.style.display = 'flex';
            compListContainer.style.flexDirection = 'column';
            compListContainer.style.gap = '8px';
            compListContainer.style.textAlign = 'left';

            compsList.forEach(compId => {
                const link = document.createElement('a');
                link.href = `https://www.worldcubeassociation.org/competitions/${compId}`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "upcoming-comp-item";
                link.style.textDecoration = 'none';
                link.innerHTML = `
                    <div style="flex: 1;">
                        <div class="upcoming-comp-name">${compId}</div>
                        <div class="upcoming-comp-date">${esc(i18nT('comps.viewOnWca', 'View on WCA →'))}</div>
                    </div>
                `;
                compListContainer.appendChild(link);
            });

            resultsDiv.appendChild(compListContainer);
            resultsDiv.style.display = 'block';

        } catch (err) {
            console.error('Error fetching past competitions:', err);
            errorText.textContent = err.message;
            errorDiv.style.display = 'flex';
        } finally {
            loadingDiv.style.display = 'none';
            btn.classList.remove('loading');
        }
    }

    // Fetch upcoming competitions a particular WCA ID is REGISTERED for.
    // Uses the /users/{wcaId}?upcoming_competitions=true endpoint (inspired by
    // upcomingcomps.netlify.app) - a single API call returns the user's profile
    // plus an array of upcoming competitions they're registered for. This is
    // dramatically simpler/faster than the previous WCIF scan approach.
    // Note: returns 404 for WCA IDs without a WCA account (rare; all modern
    // registrations require an account).
    async function fetchUpcomingCompetitionsForWCA() {
        // Guard against Enter-key double-fire while a request is in flight.
        const btnGuard = $('#search-upcoming-comps-btn');
        if (!btnGuard || btnGuard.disabled) return;

        const wcaId = $('#upcoming-comp-wca-id').value.trim().toUpperCase();
        if (!wcaId) { showToast(i18nT('toast.needWcaId', 'Please enter a WCA ID'), 'error'); return; }

        const loadingDiv = $('#upcoming-comps-search-loading');
        const errorDiv   = $('#upcoming-comps-search-error');
        const resultsDiv = $('#upcoming-comps-search-results');
        const errorText  = $('#upcoming-comps-search-error-text');
        const btn        = btnGuard;

        loadingDiv.style.display = 'flex';
        errorDiv.style.display   = 'none';
        resultsDiv.style.display = 'none';
        btn.classList.add('loading');
        btn.disabled = true;
        resultsDiv.innerHTML = '';

        try {
            // Single API call: returns user profile + upcoming_competitions + ongoing_competitions.
            // Inspired by upcomingcomps.netlify.app (open source).
            const res = await fetch(
                `${WCA_API}/users/${wcaId}?upcoming_competitions=true&ongoing_competitions=true`
            );
            if (res.status === 404) {
                // 404 means the WCA ID has no WCA account (all modern registrations
                // require one, so this is rare - mostly affects very old competitors).
                throw new Error(`No WCA account linked to ${wcaId}. Upcoming registrations are only available for competitors with a WCA account.`);
            }
            if (!res.ok) {
                throw new Error(`Could not fetch registrations (HTTP ${res.status}).`);
            }

            const data = await res.json();
            const upcoming = Array.isArray(data.upcoming_competitions)
                ? data.upcoming_competitions
                : [];

            if (upcoming.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No upcoming registrations found for ${wcaId}.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // Filter out cancelled comps (cancelled_at != null) - a cancelled
            // comp isn't something the user is meaningfully registered to.
            // Then sort by start_date ascending (lex YYYY-MM-DD = chronological).
            // The API may already do the sort, but be defensive.
            const sortedUpcoming = upcoming
                .filter(c => c && c.start_date && !c.cancelled_at)
                .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

            if (sortedUpcoming.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No upcoming registrations found for ${wcaId}.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // Render
            resultsDiv.innerHTML = `<div class="upcoming-comps-title" style="margin-bottom: var(--space-sm); text-align: left; font-weight: 700;">Upcoming Registrations for ${wcaId} (${sortedUpcoming.length})</div>`;

            const compListContainer = document.createElement('div');
            compListContainer.style.display = 'flex';
            compListContainer.style.flexDirection = 'column';
            compListContainer.style.gap = '8px';
            compListContainer.style.textAlign = 'left';

            sortedUpcoming.forEach(c => {
                const countryCode = c.country_iso2 || '';
                const city        = c.city || 'Unknown';
                const startDate   = c.start_date || '';
                const endDate     = c.end_date || '';
                const dateStr     = startDate === endDate ? startDate : `${startDate} \u2192 ${endDate}`;
                const shortName   = c.short_name || c.name || c.id || 'Competition';
                const compUrl     = `https://www.worldcubeassociation.org/competitions/${c.id}`;
                const eventsStr   = (Array.isArray(c.event_ids) ? c.event_ids : [])
                    .map(e => EVENT_NAMES[e] || e)
                    .join(', ') || '\u2014';

                const card = document.createElement('a');
                card.className = 'upcoming-comp-item';
                card.href      = compUrl;
                card.target    = '_blank';
                card.rel       = 'noopener noreferrer';
                card.innerHTML = `
                    <div class="upcoming-comp-info">
                        <span class="upcoming-comp-name">${shortName}</span>
                        <span class="upcoming-comp-meta">${countryFlagImg(countryCode, 14)} ${city}</span>
                        <span class="upcoming-comp-meta" style="font-size: 0.75rem; opacity: 0.85; margin-top: 2px;"><strong style="opacity: 0.7;">Events:</strong> ${eventsStr}</span>
                    </div>
                    <span class="upcoming-comp-date">${dateStr}</span>
                `;
                compListContainer.appendChild(card);
            });

            resultsDiv.appendChild(compListContainer);
            resultsDiv.style.display = 'block';

        } catch (err) {
            console.error('Error fetching upcoming registrations:', err);
            errorText.textContent = err.message;
            errorDiv.style.display = 'flex';
        } finally {
            loadingDiv.style.display = 'none';
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    function updatePRDisplay() {
        if (!state.playerData) return;

        const currentEvent = state.event;
        const prs = state.playerData.personal_records;
        const eventPR = prs[currentEvent];

        // Set playerAvg to a realistic CURRENT average, not just the all-time PR.
        // PR avg is the best ever — current performance is typically ~10-20% slower.
        // For events without an official average (BLD, FMC, MBLD), use single * 1.1 as proxy.
        if (eventPR) {
            let baseAvg = null;
            if (eventPR.average) {
                baseAvg = eventPR.average.best / 100;
            } else if (eventPR.single) {
                baseAvg = eventPR.single.best / 100 * 1.1;
            }
            if (baseAvg !== null) {
                // Apply a small realistic buffer: current performance is slightly above PR
                state.playerAvg = baseAvg * 1.12;
                state.playerPRAvg = baseAvg;      // store the actual PR for display
                state.playerPRSingle = eventPR.single ? eventPR.single.best / 100 : null;
            }
        } else {
            state.playerAvg = 15; // default fallback
            state.playerPRAvg = null;
            state.playerPRSingle = null;
        }

        const prTableBody = $('#pr-table-body');
        if (!prTableBody) return;

        // Show ONLY the personal records for the currently selected event
        const allEvents = Object.keys(prs).filter(evt => evt === currentEvent);

        if (allEvents.length === 0) {
            prTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--clr-text-muted);">${esc(i18nT('stats.noResults', 'No official results yet.'))}</td></tr>`;
        } else {
            prTableBody.innerHTML = allEvents.map(evt => {
                const rec = prs[evt];
                const s = rec.single;
                const a = rec.average;

                let sTime, aTime;
                if (evt === '333fm') {
                    sTime = s ? String(s.best) : '—';
                    aTime = a ? (a.best / 100).toFixed(2) : '—';
                } else if (evt === '333mbf') {
                    sTime = s ? decodeMBLD(s.best) : '—';
                    aTime = '—';
                } else {
                    sTime = s ? formatTime(s.best / 100) : '—';
                    aTime = a ? formatTime(a.best / 100) : '—';
                }

                const sNR = s ? s.country_rank : '—';
                const aNR = a ? a.country_rank : '—';
                const sWR = s ? s.world_rank : '—';
                const aWR = a ? a.world_rank : '—';

                // Pick the best rank to show (use average's rank if available, else single)
                const dispNR = (aNR !== '—') ? aNR : sNR;
                const dispWR = (aWR !== '—') ? aWR : sWR;

                const isCurrent = evt === currentEvent;
                const activeStyle = isCurrent ? 'background: var(--clr-primary-glow);' : '';

                return `
                    <tr class="records-row" style="${activeStyle}">
                        <td class="rec-event-name">${EVENT_NAMES[evt] || evt}</td>
                        <td class="rec-time rec-single" style="text-align: center;">${sTime}</td>
                        <td class="rec-time" style="text-align: center;">${aTime}</td>
                        <td style="font-size: 0.8rem; color: var(--clr-primary); font-weight: 600; text-align: center;">${dispNR !== '—' ? '#' + dispNR : '—'}</td>
                        <td style="font-size: 0.8rem; color: var(--clr-primary); font-weight: 600; text-align: center;">${dispWR !== '—' ? '#' + dispWR : '—'}</td>
                    </tr>
                `;
            }).join('');
        }

        $('#pr-display').style.display = 'block';
    }

    function updateEventFormatHint() {
        const event = state.event || document.querySelector('input[name="event"]:checked')?.value || '333';
        const isMo3 = MEAN_OF_3_EVENTS.includes(event);
        state.numSolves = isMo3 ? 3 : 5;
        const hint = $('#event-format-hint');
        if (hint) {
            hint.textContent = isMo3 ? i18nT('timer.meanOf3', 'Mean of 3') : i18nT('setup.ao5', 'Average of 5');
        }
    }

    // ========== SETUP ==========
    async function handleSetupSubmit(e) {
        e.preventDefault();

        // Validate WCA ID was looked up
        if (!state.playerData) {
            const wcaInput = $('#wca-id').value.trim();
            if (wcaInput) {
                await lookupWCAProfile();
                if (!state.playerData) return;
            } else if (state.userProfile && state.userProfile.wca_id) {
                // User is logged in via WCA OAuth — use their WCA ID automatically
                await lookupWCAProfile(state.userProfile.wca_id, true);
                if (!state.playerData) {
                    showToast('⚠️ ' + i18nT('toast.profileFailed', 'Could not load your WCA profile. Please try again.'), 'error');
                    return;
                }
            } else {
                showToast('⚠️ ' + i18nT('toast.lookupFirst', 'Please enter or look up a WCA ID first'), 'error');
                return;
            }
        }
        
        // Also lookup competition if entered but not searched
        if (!state.wcifData) {
            const compInput = $('#comp-id').value.trim();
            if (compInput) {
                await lookupCompetition();
            }
        }

        // Collect config
        state.event = document.querySelector('input[name="event"]:checked').value;

        // Validate registration if comp is loaded
        if (state.compId && state.wcifData) {
            const isRegistered = (state.wcifData.persons || []).some(p =>
                p.wcaId === state.playerWcaId &&
                p.registration && p.registration.status === 'accepted' &&
                p.registration.eventIds && p.registration.eventIds.includes(state.event)
            );
            if (!isRegistered) {
                showToast('⚠️ ' + i18nT('toast.notRegistered', 'You are not registered for {event} at this competition!').replace('{event}', EVENT_NAMES[state.event] || state.event), 'error');
                return;
            }
        }
        // Clamp to a round that actually exists (the dropdown is already
        // limited, but guard against stale values).
        state.round = Math.min(parseInt($('#round-select').value, 10) || 1, state.numRounds || 4);
        state.goalTime = $('#goal-time').value ? parseFloat($('#goal-time').value) : null;
        state.soundEnabled = $('#sound-toggle').checked;
        state.liveMode = $('#live-mode-toggle')?.checked || false;
        // Spacebar Timer is now toggled inside the simulation, not here —
        // keep whatever the in-dashboard toggle last set (default off).

        // Determine numSolves from event
        state.numSolves = MEAN_OF_3_EVENTS.includes(state.event) ? 3 : 5;

        // Use competition name if available, otherwise use ID
        if (!state.compName && state.compId) {
            state.compName = state.compId;
        } else if (!state.compName) {
            state.compName = i18nT('sim.customComp', 'Custom Competition');
        }

        // Ensure we have a valid numCompetitors
        if (!state.numCompetitors || state.numCompetitors < 2) {
            state.numCompetitors = 30;
        }

        startSimulation();
    }

    // ========== SIMULATION ==========
    async function startSimulation() {
        state.currentSolve = 0;
        state.solves = [];
        state.selectedPenalty = 'none';

        // Generate official random-state scrambles for the whole round
        showToast(i18nT('toast.generatingScrambles', 'Generating official scrambles…'), 'info');
        state.scrambles = await generateScrambleSet(state.event, state.numSolves);

        // Generate competitors
        await generateCompetitors();

        // Update UI
        updateDashboardHeader();
        renderScorecardTemplate();
        updateScrambleDisplay();
        updateGoalTracker();
        renderLeaderboard();
        resetTimer();

        switchView('dashboard');
        showToast(`🏁 ${i18nT('toast.simStarted', 'Simulation started!')} ${EVENT_NAMES[state.event]} - ${getRoundName(state.round)}`, 'info');
        
        if (state.rtInterval) clearInterval(state.rtInterval);
        state.rtInterval = setInterval(updateRealTimeSimulation, 500);

        saveSimState();
    }

    // ========== SCRAMBLE GENERATION ==========
    // All scrambles come from the shared ScrambleEngine (scramble-engine.js):
    // official cubing.js random-state scrambles with local offline fallbacks.
    async function generateScramble(event) {
        if (window.ScrambleEngine) return window.ScrambleEngine.get(event);
        return 'R U R\' U\'';
    }

    async function generateScrambleSet(event, count) {
        const scrambles = [];
        // Generate sequentially: the scramble worker is single-threaded anyway,
        // and this keeps memory pressure low for big-cube events.
        for (let i = 0; i < count; i++) {
            scrambles.push(await generateScramble(event));
        }
        return scrambles;
    }

    // ========== COMPETITOR GENERATION ==========
    // Is the loaded competition in the past? (Historical-PR mode applies.)
    function isPastComp() {
        const d = state.compData && state.compData.start_date;
        if (!d) return false;
        // Compare date-only; a comp starting today or earlier counts as past.
        const today = new Date().toISOString().slice(0, 10);
        return d < today;
    }

    // Cache of a WCA ID's full results history (chronological, oldest first).
    const _resultsCache = new Map();
    async function fetchPersonResults(wcaId) {
        if (_resultsCache.has(wcaId)) return _resultsCache.get(wcaId);
        const p = fetch(`${WCA_API}/persons/${wcaId}/results`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => []);
        _resultsCache.set(wcaId, p);
        return p;
    }

    // A competitor's PR (single & average, in seconds) ENTERING a given
    // competition. Because /persons/{id}/results is ordered oldest→newest,
    // everything before the target competition's first appearance is
    // "before the comp". Returns null fields if unknown.
    async function historicalPRForCompetitor(wcaId, compId, eventId) {
        const results = await fetchPersonResults(wcaId);
        if (!Array.isArray(results) || results.length === 0) return { single: null, average: null };
        const cutIdx = results.findIndex(r => r.competition_id === compId);
        // If they have no result at this comp (registered DNS, or data gap),
        // fall back to their full history (best estimate we can make).
        const priorResults = cutIdx === -1 ? results : results.slice(0, cutIdx);
        let bestSingle = Infinity, bestAvg = Infinity;
        for (const r of priorResults) {
            if (r.event_id !== eventId) continue;
            if (typeof r.best === 'number' && r.best > 0) bestSingle = Math.min(bestSingle, r.best);
            if (typeof r.average === 'number' && r.average > 0) bestAvg = Math.min(bestAvg, r.average);
        }
        return {
            single: bestSingle === Infinity ? null : bestSingle / 100,
            average: bestAvg === Infinity ? null : bestAvg / 100
        };
    }

    // Run async tasks with a concurrency limit (be gentle with the WCA API).
    async function mapWithConcurrency(items, limit, worker) {
        const out = new Array(items.length);
        let i = 0;
        async function run() {
            while (i < items.length) {
                const idx = i++;
                out[idx] = await worker(items[idx], idx);
            }
        }
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
        return out;
    }

    async function generateCompetitors() {
        state.competitors = [];
        state.fieldIsSimulated = false;

        let wcifCompetitors = [];
        if (state.wcifData && state.wcifData.persons) {
            wcifCompetitors = state.wcifData.persons.filter(p =>
                p.registration && p.registration.status === 'accepted' &&
                p.registration.eventIds && p.registration.eventIds.includes(state.event) &&
                p.wcaId !== state.playerWcaId
            );
        }

        if (wcifCompetitors.length > 0) {
            const toAdd = wcifCompetitors.slice(0, state.numCompetitors - 1);

            // For PAST competitions, replace current PRs with each
            // competitor's PR as it stood entering that competition.
            const historical = new Map();
            if (isPastComp()) {
                // Cap the number of live API lookups so a large past comp
                // doesn't fire 100+ requests / risk rate limits. Competitors
                // beyond the cap fall back to their current WCIF PRs.
                const MAX_HISTORICAL_FETCHES = 60;
                const withId = toAdd.filter(p => p.wcaId).slice(0, MAX_HISTORICAL_FETCHES);
                if (withId.length) {
                    showToast(i18nT('toast.fetchingPrs', 'Fetching historical PRs ({n})…').replace('{n}', withId.length), 'info');
                    await mapWithConcurrency(withId, 8, async (p) => {
                        try {
                            const pr = await historicalPRForCompetitor(p.wcaId, state.compId, state.event);
                            historical.set(p.wcaId, pr);
                        } catch (e) { /* fall back to current PR below */ }
                    });
                }
            }

            for (const p of toAdd) {
                let prAvg = null;
                let prSingle = null;

                const hist = p.wcaId ? historical.get(p.wcaId) : null;
                if (hist && (hist.single !== null || hist.average !== null)) {
                    prAvg = hist.average;
                    prSingle = hist.single;
                } else if (p.personalBests) {
                    const avgObj = p.personalBests.find(pb => pb.eventId === state.event && pb.type === 'average');
                    const singleObj = p.personalBests.find(pb => pb.eventId === state.event && pb.type === 'single');
                    if (avgObj) prAvg = avgObj.best / 100;
                    if (singleObj) prSingle = singleObj.best / 100;
                }

                let compAvg = prAvg || (prSingle ? prSingle * 1.2 : state.playerAvg + (Math.random() * 5));
                compAvg = Math.max(compAvg, 0.5);

                // Don't generate solves yet — they are added progressively
                state.competitors.push({
                    name: p.name,
                    wcaId: p.wcaId || null,
                    country: p.countryIso2 || '',
                    prSingle: prSingle,
                    prAvg: prAvg,
                    avg: compAvg,
                    solves: [],
                    best: Infinity,
                    average: Infinity,
                    status: 'waiting',
                    statusUntil: Date.now() + Math.random() * ATTEMPT_GAP_MAX
                });
            }

            state.numCompetitors = state.competitors.length + 1;
        } else {
            // No WCIF registrations for this event, so the field is invented.
            // It is labelled as such rather than dressed up with names.
            state.fieldIsSimulated = true;
            for (let i = 0; i < state.numCompetitors - 1; i++) {
                const name = i18nT('sim.competitorN', 'Competitor {n}').replace('{n}', i + 1);

                const spread = state.playerAvg * 0.6;
                const compAvg = state.playerAvg + (Math.random() * spread * 2 - spread);
                const clampedAvg = Math.max(compAvg, state.playerAvg * 0.3);

                // Don't generate solves yet — they are added progressively
                state.competitors.push({
                    name,
                    simulated: true,
                    wcaId: null,
                    country: '',
                    prSingle: null,
                    prAvg: clampedAvg,
                    avg: clampedAvg,
                    solves: [],
                    best: Infinity,
                    average: Infinity,
                    status: 'waiting',
                    statusUntil: Date.now() + Math.random() * ATTEMPT_GAP_MAX
                });
            }
        }
    }

    // Update the real-time simulation state for competitors
    let _lastSimRender = 0;
    function updateRealTimeSimulation() {
        if (!state.competitors || state.competitors.length === 0) return;
        if (document.hidden) return;
        // Throttle DOM renders to every 1s to reduce lag
        const nowTs = Date.now();
        const shouldRender = nowTs - _lastSimRender > 1000;

        const now = Date.now();
        let changed = false;

        const variation = EVENT_VARIATION[state.event] || 0.12;

        state.competitors.forEach(comp => {
            if (comp.status === 'finished') return;

            if (now >= comp.statusUntil) {
                if (comp.status === 'waiting') {
                    comp.status = 'solving';
                    
                    const solveVariation = comp.avg * variation;
                    let time = comp.avg + (Math.random() * solveVariation * 2 - solveVariation);
                    time = Math.max(0.5, time);
                    comp.nextSolveTime = time;

                    comp.statusUntil = now + (time * 1000);
                    changed = true;
                } else if (comp.status === 'solving') {
                    const isDNF = Math.random() < 0.03;
                    const isPlus2 = !isDNF && Math.random() < 0.05;
                    const time = comp.nextSolveTime || comp.avg;

                    comp.solves.push({
                        time: Math.round(time * 100) / 100,
                        penalty: isDNF ? 'dnf' : (isPlus2 ? '+2' : 'none'),
                        result: isDNF ? Infinity : (isPlus2 ? Math.round((time + 2) * 100) / 100 : Math.round(time * 100) / 100)
                    });

                    comp.best = getCompBest(comp.solves);
                    comp.average = comp.solves.length === state.numSolves ? calculateAverage(comp.solves) : Infinity;

                    if (comp.solves.length >= state.numSolves) {
                        comp.status = 'finished';
                    } else {
                        comp.status = 'waiting';
                        comp.statusUntil = now + attemptGap();
                    }
                    changed = true;
                }
            }
        });

        if (changed && shouldRender) {
            _lastSimRender = nowTs;
            renderLeaderboard();
        }
    }

    function getCompBest(solves) {
        const valid = solves.filter(s => s.penalty !== 'dnf');
        if (valid.length === 0) return Infinity;
        return Math.min(...valid.map(s => s.result));
    }

    function calculateAverage(solves) {
        if (solves.length === 3) {
            const dnfCount = solves.filter(s => s.penalty === 'dnf').length;
            if (dnfCount > 0) return Infinity;
            const sum = solves.reduce((a, s) => a + s.result, 0);
            return Math.round((sum / 3) * 100) / 100;
        }

        if (solves.length === 5) {
            const dnfCount = solves.filter(s => s.penalty === 'dnf').length;
            if (dnfCount >= 2) return Infinity;
            const results = solves.map(s => s.penalty === 'dnf' ? Infinity : s.result);
            const sorted = [...results].sort((a, b) => a - b);
            const middle = sorted.slice(1, -1);
            const sum = middle.reduce((a, b) => a + b, 0);
            return Math.round((sum / 3) * 100) / 100;
        }

        return Infinity;
    }

    // ========== MANUAL TIMER STATE ==========
    function resetTimer() {
        cancelAnimationFrame(state.timerRaf || 0);
        state.spaceHeld = false;
        const input = $('#manual-time-input');
        const spaceTimer = $('#sim-space-timer');
        const hint = $('#timer-hint');
        const title = $('#timer-card-title');
        const statusEl = $('#timer-status');
        // Keep the in-dashboard toggle in sync with the active mode.
        const spaceToggle = $('#dash-spacebar-toggle');
        if (spaceToggle) spaceToggle.checked = !!state.spacebarTimer;

        if (state.spacebarTimer) {
            // Spacebar timing mode: hide the text input, show the live timer.
            state.timerState = 'idle';
            state.timerValue = 0;
            if (input) input.style.display = 'none';
            if (spaceTimer) {
                spaceTimer.style.display = 'block';
                spaceTimer.textContent = '0.00';
                spaceTimer.className = 'sim-space-timer';
            }
            if (hint) hint.textContent = i18nT('sim.spaceHint', 'Hold Space (or tap) to start · tap again to stop');
            if (title) title.textContent = '⏱️ ' + i18nT('nav.timer', 'Timer');
            if (statusEl) { statusEl.textContent = i18nT('timer.phase.ready', 'READY'); statusEl.className = 'timer-status ready'; }
        } else {
            // Manual entry mode (original behavior).
            state.timerState = 'stopped';
            if (input) {
                input.style.display = '';
                input.readOnly = false;
                input.value = '';
                setTimeout(() => input.focus(), 50);
            }
            if (spaceTimer) spaceTimer.style.display = 'none';
            if (hint) hint.textContent = i18nT('dash.typeHint', 'Type numbers (e.g. 954 for 9.54s) and press Enter');
            if (title) title.textContent = i18nT('dash.enterTime', '⌨️ Enter Time');
            if (statusEl) { statusEl.textContent = i18nT('dash.input', 'INPUT'); statusEl.className = 'timer-status ready'; }
        }
        $('#submit-solve-btn').disabled = false;
        selectPenalty('none');
    }

    // ========== SPACEBAR TIMER (simulation) ==========
    function simTimerReady() {
        if (state.timerState !== 'idle') return;
        state.timerState = 'ready';
        const t = $('#sim-space-timer');
        if (t) { t.textContent = '0.00'; t.className = 'sim-space-timer is-ready'; }
        const s = $('#timer-status');
        if (s) { s.textContent = 'RELEASE'; s.className = 'timer-status ready'; }
    }

    function simTimerStart() {
        state.timerState = 'running';
        state.timerStart = performance.now();
        const t = $('#sim-space-timer');
        if (t) t.className = 'sim-space-timer is-running';
        const s = $('#timer-status');
        if (s) { s.textContent = 'SOLVING'; s.className = 'timer-status running'; }
        const tick = () => {
            if (state.timerState !== 'running') return;
            const elapsed = (performance.now() - state.timerStart) / 1000;
            if (t) t.textContent = elapsed.toFixed(2);
            state.timerRaf = requestAnimationFrame(tick);
        };
        state.timerRaf = requestAnimationFrame(tick);
    }

    function simTimerStop() {
        cancelAnimationFrame(state.timerRaf || 0);
        const elapsed = (performance.now() - state.timerStart) / 1000;
        state.timerValue = Math.round(elapsed * 100) / 100;
        state.timerState = 'stopped';
        const t = $('#sim-space-timer');
        if (t) { t.textContent = state.timerValue.toFixed(2); t.className = 'sim-space-timer is-stopped'; }
        // Mirror into the manual input so submitSolve() reads it unchanged.
        const input = $('#manual-time-input');
        if (input) input.value = state.timerValue.toFixed(2);
        const hint = $('#timer-hint');
        if (hint) hint.textContent = i18nT('sim.submitHint', 'Space to submit · or set +2 / DNF first');
        const s = $('#timer-status');
        if (s) { s.textContent = i18nT('sim.stopped', 'STOPPED'); s.className = 'timer-status ready'; }
        if (state.soundEnabled) playBeep(660, 60);
    }

    // Space handling for the simulation dashboard timer.
    function simSpaceDown(e) {
        if (!state.spacebarTimer) return;
        if (state.currentView !== 'dashboard') return;
        if (state.currentSolve >= state.numSolves) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
        e.preventDefault();
        if (state.timerState === 'running') {
            simTimerStop();
        } else if (state.timerState === 'stopped') {
            // second press submits the recorded solve and advances
            submitSolve();
        } else if (state.timerState === 'idle' && !state.spaceHeld) {
            state.spaceHeld = true;
            simTimerReady();
        }
    }

    function simSpaceUp(e) {
        if (!state.spacebarTimer) return;
        if (state.currentView !== 'dashboard') return;
        e.preventDefault();
        if (state.timerState === 'ready') {
            simTimerStart();
        }
        state.spaceHeld = false;
    }

    // ========== PENALTIES ==========
    function selectPenalty(penalty) {
        state.selectedPenalty = penalty;
        $$('.penalty-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.penalty === penalty);
        });
    }

    // ========== SOLVE SUBMISSION ==========
    function submitSolve() {
        if (state.currentSolve >= state.numSolves) return;

        const val = $('#manual-time-input').value;
        const penalty = state.selectedPenalty;

        if (!val && penalty !== 'dnf') {
            showToast(i18nT('toast.invalidTime', 'Please enter a valid time'), 'error');
            return;
        }

        const time = parseFloat(val) || 0;
        let result;

        if (penalty === 'dnf') {
            result = Infinity;
        } else if (penalty === '+2') {
            result = Math.round((time + 2) * 100) / 100;
        } else {
            result = Math.round(time * 100) / 100;
        }

        state.solves.push({
            time: Math.round(time * 100) / 100,
            penalty, result,
            scramble: state.scrambles[state.currentSolve]
        });

        // Play submit sound
        if (state.soundEnabled) playBeep(880, 80);

        state.currentSolve++;


        updateScorecard();
        updateGoalTracker();
        updateDashboardBadges();
        saveSimState();

        if (state.currentSolve >= state.numSolves) {
            finishRound();
        } else {
            updateScrambleDisplay();
            resetTimer();

            if (state.liveMode) {
                showToast('⏳ ' + i18nT('toast.waitingNext', 'Waiting for next attempt...'), 'info');
                setTimeout(() => showToast('✅ ' + i18nT('toast.readyNext', 'Ready for next attempt!'), 'success'), 5000 + Math.random() * 10000);
            }
        }
    }

    // ========== UI UPDATES ==========
    function updateDashboardHeader() {
        $('#dash-comp-name').textContent = state.compName;
        $('#dash-event-badge').textContent = EVENT_NAMES[state.event];
        $('#dash-round-badge').textContent = getRoundName(state.round);
        updateDashboardBadges();
    }

    function updateDashboardBadges() {
        const current = Math.min(state.currentSolve + 1, state.numSolves);
        const solBadge = $('#dash-solve-badge');
        if (solBadge) solBadge.textContent = `Solve ${current}/${state.numSolves}`;
        const scName = $('#scorecard-name');
        if (scName) scName.textContent = state.playerName;
        const scEvent = $('#scorecard-event');
        if (scEvent) scEvent.textContent = `${EVENT_NAMES[state.event]} — ${getRoundName(state.round)}`;
    }

    function renderScorecardTemplate() {
        const tbody = $('#scorecard-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        for (let i = 0; i < state.numSolves; i++) {
            const tr = document.createElement('tr');
            if (i === state.currentSolve) tr.classList.add('current-solve');
            // Only show scramble for current solve, hide future ones
            const scrambleText = (i === state.currentSolve && state.scrambles[i])
                ? truncateScramble(state.scrambles[i])
                : (i < state.currentSolve && state.scrambles[i])
                    ? truncateScramble(state.scrambles[i])
                    : `<span class="scramble-hidden">${esc(i18nT('sim.hidden', 'Hidden'))}</span>`;
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="scramble-cell">${scrambleText}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
            `;
            tbody.appendChild(tr);
        }

        const sb = $('#stat-best'); if (sb) sb.textContent = '—';
        const sw = $('#stat-worst'); if (sw) sw.textContent = '—';
        const sa = $('#stat-average'); if (sa) sa.textContent = '—';
    }

    function updateScorecard() {
        const tbody = $('#scorecard-body');
        const rows = tbody.querySelectorAll('tr');

        const validResults = state.solves.filter(s => s.penalty !== 'dnf').map(s => s.result);
        const bestResult = validResults.length > 0 ? Math.min(...validResults) : null;
        const worstResult = state.solves.length > 0 ?
            (state.solves.some(s => s.penalty === 'dnf') ? Infinity :
                (validResults.length > 0 ? Math.max(...validResults) : null)) : null;

        state.solves.forEach((solve, i) => {
            if (!rows[i]) return;
            rows[i].classList.remove('current-solve');
            rows[i].classList.add('completed');

            const cells = rows[i].querySelectorAll('td');
            cells[2].textContent = formatTime(solve.time);
            cells[3].textContent = solve.penalty === 'none' ? '' : solve.penalty.toUpperCase();
            cells[4].textContent = solve.penalty === 'dnf' ? 'DNF' : formatTime(solve.result);

            cells[4].classList.remove('best-time', 'worst-time');
            if (solve.result === bestResult && state.solves.length > 1) cells[4].classList.add('best-time');
            if ((solve.penalty === 'dnf' || solve.result === worstResult) && state.solves.length > 1) cells[4].classList.add('worst-time');
        });

        if (state.currentSolve < state.numSolves && rows[state.currentSolve]) {
            rows[state.currentSolve].classList.add('current-solve');
        }

        if (validResults.length > 0) $('#stat-best').textContent = formatTime(Math.min(...validResults));
        const allResults = state.solves.map(s => s.penalty === 'dnf' ? Infinity : s.result);
        if (allResults.length > 0) {
            if (state.solves.some(s => s.penalty === 'dnf')) {
                $('#stat-worst').textContent = 'DNF';
            } else {
                const finiteWorst = allResults.filter(r => r !== Infinity);
                if (finiteWorst.length > 0) $('#stat-worst').textContent = formatTime(Math.max(...finiteWorst));
            }
        }

        if (state.solves.length === state.numSolves) {
            const avg = calculateAverage(state.solves);
            $('#stat-average').textContent = avg === Infinity ? 'DNF' : formatTime(avg);
        }
    }

    function updateScrambleDisplay() {
        if (state.currentSolve >= state.numSolves) return;
        const scramble = state.scrambles[state.currentSolve];
        const scrambleEl = $('#scramble-text');
        scrambleEl.textContent = scramble;
        renderCubeNet(state.event);
        // Also refresh scorecard to reveal current scramble and hide future
        renderScorecardTemplate();
        // Re-apply completed solves to scorecard
        if (state.solves.length > 0) updateScorecard();
    }

    function renderCubeNet(event) {
        const container = $('#scramble-visual');
        container.innerHTML = '';

        const puzzleMap = {
            '333': '3x3x3',
            '222': '2x2x2',
            '444': '4x4x4',
            '555': '5x5x5',
            '666': '6x6x6',
            '777': '7x7x7',
            '333oh': '3x3x3',
            '333bf': '3x3x3',
            '333fm': '3x3x3',
            'pyram': 'pyraminx',
            'skewb': 'skewb',
            'sq1': 'square1',
            'minx': 'megaminx',
            'clock': 'clock'
        };

        const puzzleType = puzzleMap[event];
        if (!puzzleType) {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'color: var(--clr-text-muted); font-size: 0.85rem; text-align: center;';
            placeholder.textContent = `Visual preview not available for ${EVENT_NAMES[event] || event}`;
            container.appendChild(placeholder);
            return;
        }

        const scramble = state.scrambles[state.currentSolve];

        // Square-1: csTimer-style flat diagram instead of the 3D player.
        if (event === 'sq1' && window.Square1Drawer) {
            const holder = document.createElement('div');
            holder.style.cssText = 'width:100%;max-width:300px;height:150px;margin:0 auto;';
            window.Square1Drawer.render(holder, scramble || '');
            container.appendChild(holder);
            return;
        }

        const player = document.createElement('twisty-player');
        player.setAttribute('puzzle', puzzleType);
        player.setAttribute('experimental-setup-alg',
            window.ScrambleEngine ? window.ScrambleEngine.normalizeAlgFor(puzzleType, scramble) : scramble);
        // Square-1 has no 2D net in the renderer — 3D (with back view).
        if (window.ScrambleEngine) {
            window.ScrambleEngine.applyViz(player, puzzleType);
        } else {
            player.setAttribute('visualization', '2D');
        }
        player.setAttribute('background', 'none');
        player.setAttribute('control-panel', 'none');
        if (['222', '333', '444', '555', '666', '777', '333oh', '333bf', '333fm'].includes(event)) {
            player.setAttribute('color-scheme', '{"D": "#FFFFFF"}');
        }
        player.style.width = '100%';
        player.style.height = '150px';
        player.style.maxWidth = '300px';
        player.style.margin = '0 auto';

        container.appendChild(player);
    }

    function updateGoalTracker() {
        // goalTarget is the user-set goal, or if none, the actual PR avg (not the simulation estimate)
        const prAvgForDisplay = state.playerPRAvg || state.playerAvg;
        const goalTarget = state.goalTime || prAvgForDisplay;
        $('#goal-target-avg').textContent = formatTime(goalTarget);

        // Show PR average accurately (from playerPRAvg set in updatePRDisplay)
        if (state.playerData) {
            const eventPR = state.playerData.personal_records[state.event];
            if (eventPR && eventPR.average) {
                $('#goal-pr-avg').textContent = formatTime(eventPR.average.best / 100);
            } else if (eventPR && eventPR.single) {
                $('#goal-pr-avg').textContent = formatTime(eventPR.single.best / 100);
            } else {
                $('#goal-pr-avg').textContent = '—';
            }
        }

        if (state.solves.length === 0) {
            $('#goal-current-avg').textContent = '—';
            $('#goal-status').textContent = i18nT('dash.waiting', 'Waiting...');
            $('#goal-status').className = 'goal-val goal-status';
            updateGoalRing(0);
            return;
        }

        const validSolves = state.solves.filter(s => s.penalty !== 'dnf');
        if (validSolves.length === 0) {
            $('#goal-current-avg').textContent = 'DNF';
            $('#goal-status').textContent = i18nT('goal.allDnf', 'All DNF');
            $('#goal-status').className = 'goal-val goal-status behind';
            updateGoalRing(0);
            return;
        }

        const currentAvg = validSolves.reduce((sum, s) => sum + s.result, 0) / validSolves.length;
        $('#goal-current-avg').textContent = formatTime(currentAvg);

        const progress = Math.min(100, Math.max(0, (1 - (currentAvg - goalTarget) / goalTarget) * 100));
        updateGoalRing(Math.round(progress));

        if (currentAvg <= goalTarget) {
            $('#goal-status').textContent = '✅ ' + i18nT('goal.onTrack', 'On Track!');
            $('#goal-status').className = 'goal-val goal-status on-track';
        } else {
            const diff = (currentAvg - goalTarget).toFixed(2);
            $('#goal-status').textContent = i18nT('goal.behind', '+{n}s behind').replace('{n}', diff);
            $('#goal-status').className = 'goal-val goal-status behind';
        }
    }

    function updateGoalRing(pct) {
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (pct / 100) * circumference;
        const ring = $('#goal-ring-fill');
        ring.style.strokeDashoffset = offset;

        if (pct >= 80) ring.style.stroke = 'var(--clr-success)';
        else if (pct >= 50) ring.style.stroke = 'var(--clr-primary)';
        else if (pct >= 25) ring.style.stroke = 'var(--clr-warning)';
        else ring.style.stroke = 'var(--clr-danger)';

        $('#ring-pct').textContent = pct + '%';
    }

    function renderLeaderboard() {
        const tbody = $('#leaderboard-body');
        tbody.innerHTML = '';

        // Say where the field came from. A leaderboard is read as a record of
        // who was there, so an invented one has to be labelled — otherwise the
        // only thing distinguishing it from real WCA registrations is that the
        // names happen to be numbers.
        const note = $('#lb-source');
        if (note) {
            note.textContent = state.fieldIsSimulated
                ? i18nT('sim.fieldSimulated', 'Simulated field — not real competitors')
                : i18nT('sim.fieldReal', 'Registered competitors from the WCA');
            note.classList.toggle('is-simulated', !!state.fieldIsSimulated);
        }

        const hasFinished = state.solves.length === state.numSolves;
        const computedAvg = calculateAverage(state.solves);

        let prSingle = Infinity;
        let prAvgPlayer = null;
        if (state.playerData && state.playerData.personal_records[state.event]) {
            if (state.playerData.personal_records[state.event].single) {
                prSingle = state.playerData.personal_records[state.event].single.best / 100;
            }
            if (state.playerData.personal_records[state.event].average) {
                prAvgPlayer = state.playerData.personal_records[state.event].average.best / 100;
            }
        }

        const playerCountry = state.playerData?.person?.country_iso2 || state.playerData?.person?.country?.iso2 || '';

        const playerData = {
            name: state.playerName,
            isPlayer: true,
            country: playerCountry,
            prSingle: prSingle !== Infinity ? prSingle : null,
            prAvg: prAvgPlayer,
            solves: state.solves,
            best: state.solves.length > 0 ? getCompBest(state.solves) : Infinity,
            average: hasFinished ? computedAvg : Infinity
        };

        const all = [...state.competitors, playerData];

        // Sort: by average if everyone is done, otherwise by best single
        const allDone = all.every(c => (c.solves ? c.solves.length : 0) >= state.numSolves);

        all.sort((a, b) => {
            if (allDone) {
                // Sort by average
                if (a.average === Infinity && b.average === Infinity) return 0;
                if (a.average === Infinity) return 1;
                if (b.average === Infinity) return -1;
                return a.average - b.average;
            } else {
                // Sort by best single during the round
                if (a.best === Infinity && b.best === Infinity) return 0;
                if (a.best === Infinity) return 1;
                if (b.best === Infinity) return -1;
                return a.best - b.best;
            }
        });

        all.forEach((comp, i) => {
            const rank = i + 1;
            const tr = document.createElement('tr');
            if (comp.isPlayer) tr.classList.add('user-row');

            let medal = '';
            if (rank === 1) medal = '🥇';
            else if (rank === 2) medal = '🥈';
            else if (rank === 3) medal = '🥉';

            const solvesCompleted = comp.solves ? comp.solves.length : 0;
            const isComplete = solvesCompleted >= state.numSolves;

            const bestStr = comp.best === Infinity ? (solvesCompleted > 0 ? 'DNF' : '—') : formatTime(comp.best);
            const avgStr = isComplete ? (comp.average === Infinity ? 'DNF' : formatTime(comp.average)) : (solvesCompleted > 0 ? `${solvesCompleted}/${state.numSolves}` : '—');
            const prStr = comp.prAvg ? formatTime(comp.prAvg) : (comp.prSingle ? formatTime(comp.prSingle) : '—');
            const flagHtml = comp.country ? countryFlagImg(comp.country, 16) : '';

            let statusBadge = '';
            if (comp.isPlayer) {
                statusBadge = `<span class="status-badge user">${esc(i18nT('home.sim.you', 'You'))}</span>`;
            } else {
                if (comp.status === 'solving') {
                    statusBadge = `<span class="status-badge solving">${esc(i18nT('lb.solving', 'Solving'))}</span>`;
                } else if (comp.status === 'waiting') {
                    statusBadge = `<span class="status-badge waiting">${esc(i18nT('lb.waiting', 'Waiting'))}</span>`;
                } else if (comp.status === 'finished') {
                    statusBadge = `<span class="status-badge finished">${esc(i18nT('lb.finished', 'Finished'))}</span>`;
                }
            }

            tr.innerHTML = `
                <td class="lb-rank">${medal || rank}</td>
                <td class="lb-name">${flagHtml} ${comp.name}${comp.isPlayer ? ' (' + esc(i18nT('home.sim.you', 'You')) + ')' : ''}</td>
                <td class="lb-pr">${prStr}</td>
                <td class="lb-best">${bestStr}</td>
                <td class="lb-avg">${avgStr}</td>
                <td class="lb-status">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

        $('#lb-count').textContent = `${all.length} competitors`;
    }

    // ========== ROUND COMPLETION ==========
    function finishRound() {
        if (state.rtInterval) clearInterval(state.rtInterval);
        
        if (state.soundEnabled) playBeep(523, 200);

        const avg = calculateAverage(state.solves);
        const validSolves = state.solves.filter(s => s.penalty !== 'dnf');
        const best = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.result)) : Infinity;

        renderLeaderboard();

        const playerData = { name: state.playerName, isPlayer: true, best, average: avg };
        const all = [...state.competitors, playerData];
        all.sort((a, b) => {
            if (a.average === Infinity && b.average === Infinity) return 0;
            if (a.average === Infinity) return 1;
            if (b.average === Infinity) return -1;
            return a.average - b.average;
        });

        const placement = all.findIndex(c => c.isPlayer) + 1;
        const total = all.length;

        $('#end-avg').textContent = avg === Infinity ? 'DNF' : formatTime(avg);
        $('#end-placement').textContent = `${placement}/${total}`;
        $('#end-best').textContent = best === Infinity ? 'DNF' : formatTime(best);

        // Is there another round after this one for this event?
        const hasNextRound = state.round < (state.numRounds || 4);

        // One source of truth for who goes through — the same call that
        // startNextRound() makes when it builds the next field.
        const adv = advancementInfo(all, state.round);
        state.lastAdvanceCount = adv.count;
        const advanced = hasNextRound && placement <= adv.count;

        let message = i18nT('end.placed', 'You placed {p} out of {n} competitors.')
            .replace('{p}', placement + getOrdinal(placement))
            .replace('{n}', total);
        if (hasNextRound) message += ' — ' + adv.rule + '.';

        if (placement === 1) {
            message = '🏆 ' + i18nT('end.won', 'INCREDIBLE! You won the round!') + '\n' + message;
        } else if (placement <= 3) {
            message = '🏅 ' + i18nT('end.podium', 'Amazing! Podium finish!') + '\n' + message;
        }

        const nextBtn = $('#next-round-btn');
        if (hasNextRound) {
            nextBtn.style.display = 'inline-flex';
            if (advanced) {
                message = '🎉 ' + i18nT('end.advanced', 'You advanced to {round}!')
                    .replace('{round}', getRoundName(state.round + 1)) + '\n' + message;
                nextBtn.textContent = i18nT('dash.nextRound', 'Next Round →');
            } else {
                // Told plainly, but not locked out: practising the next round
                // is worth more than a closed door, as long as the result is
                // not dressed up as something it wasn't.
                message = i18nT('end.notAdvanced', 'You did not make the cut this time.') + '\n' + message;
                nextBtn.textContent = i18nT('dash.practiceNextRound', 'Practise the next round →');
            }
        } else {
            nextBtn.style.display = 'none';
        }

        if (state.goalTime && avg !== Infinity) {
            if (avg <= state.goalTime) {
                message += `\n\n🎯 Goal achieved! (${formatTime(avg)} ≤ ${formatTime(state.goalTime)})`;
            } else {
                message += `\n\n❌ Missed goal by ${(avg - state.goalTime).toFixed(2)}s`;
            }
        }

        // Check if PR was beaten
        if (state.playerData && avg !== Infinity) {
            const eventPR = state.playerData.personal_records[state.event];
            if (eventPR && eventPR.average && avg < eventPR.average.best / 100) {
                message += `\n\n🔥 NEW PR AVERAGE! (beat ${formatTime(eventPR.average.best / 100)})`;
            }
            if (eventPR && eventPR.single && best < eventPR.single.best / 100) {
                message += `\n\n⚡ NEW PR SINGLE! (beat ${formatTime(eventPR.single.best / 100)})`;
            }
        }

        $('#round-end-message').textContent = message;
        $('#round-end-title').textContent = placement <= 3
            ? '🏆 ' + i18nT('end.greatPerf', 'Incredible Performance!')
            : i18nT('dash.roundComplete', 'Round Complete!');
        $('#round-end-overlay').style.display = 'flex';

        if (placement <= 3) spawnConfetti();
        saveToHistory(avg, placement, total, best);
        saveSimState();
    }

    async function startNextRound() {
        state.round = Math.min(state.round + 1, state.numRounds || 4);

        state.competitors.sort((a, b) => {
            if (a.average === Infinity && b.average === Infinity) return 0;
            if (a.average === Infinity) return 1;
            if (b.average === Infinity) return -1;
            return a.average - b.average;
        });

        // The field for the next round is exactly the number the end-of-round
        // message just announced. These were computed separately before — the
        // message used one rate and this cut at a flat 50%, which is why
        // everybody appeared to go through.
        // state.lastAdvanceCount is set when the round-end screen is shown,
        // which is the only route here. The fallback covers a restored session
        // whose stored state predates this field.
        const advCount = state.lastAdvanceCount != null
            ? state.lastAdvanceCount
            : advancementInfo(
                [...state.competitors, { isPlayer: true, average: Infinity }],
                state.round - 1,
            ).count;

        // The player takes one of the places, so the rest of the field is one
        // short of the advancing count.
        state.competitors = state.competitors.slice(0, Math.max(advCount - 1, 1));
        state.numCompetitors = state.competitors.length + 1;

        state.competitors.forEach(comp => {
            comp.solves = [];
            comp.best = Infinity;
            comp.average = Infinity;
        });

        state.currentSolve = 0;
        state.solves = [];
        state.scrambles = await generateScrambleSet(state.event, state.numSolves);

        $('#round-end-overlay').style.display = 'none';
        updateDashboardHeader();
        renderScorecardTemplate();
        updateScrambleDisplay();
        updateGoalTracker();
        renderLeaderboard();
        resetTimer();

        showToast(`🏁 ${i18nT('toast.roundStarted', '{round} started! {n} competitors remaining.').replace('{round}', getRoundName(state.round)).replace('{n}', state.numCompetitors)}`, 'info');
        saveSimState();
    }

    // ========== HISTORY ==========
    function saveToHistory(avg, placement, total, best) {
        const entry = {
            id: Date.now(),
            date: new Date().toISOString(),
            compName: state.compName,
            event: state.event,
            eventName: EVENT_NAMES[state.event],
            round: state.round,
            roundName: getRoundName(state.round),
            average: avg,
            best: best,
            placement, total,
            solves: [...state.solves],
            goal: state.goalTime,
            wcaId: state.playerWcaId
        };

        state.history.unshift(entry);
        if (state.history.length > 50) state.history = state.history.slice(0, 50);
        localStorage.setItem('sc-history', JSON.stringify(state.history));
    }

    function loadHistory() {
        try {
            const saved = localStorage.getItem('sc-history');
            state.history = saved ? JSON.parse(saved) : [];
        } catch { state.history = []; }
    }

    function renderHistory() {
        const list = $('#history-list');
        const empty = $('#history-empty');

        if (state.history.length === 0) {
            empty.style.display = 'block';
            list.querySelectorAll('.history-item').forEach(el => el.remove());
            return;
        }

        empty.style.display = 'none';
        list.querySelectorAll('.history-item').forEach(el => el.remove());

        state.history.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const avgStr = entry.average === Infinity ? 'DNF' : formatTime(entry.average);
            const bestStr = entry.best === Infinity ? 'DNF' : formatTime(entry.best);

            item.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-title">${entry.compName} — ${entry.eventName}</span>
                    <span class="history-item-date">${dateStr}</span>
                </div>
                <div class="history-item-stats">
                    <div class="history-stat"><span class="history-stat-label">Round</span><span class="history-stat-value">${entry.roundName}</span></div>
                    <div class="history-stat"><span class="history-stat-label">Average</span><span class="history-stat-value">${avgStr}</span></div>
                    <div class="history-stat"><span class="history-stat-label">Best</span><span class="history-stat-value">${bestStr}</span></div>
                    <div class="history-stat"><span class="history-stat-label">Placement</span><span class="history-stat-value">${entry.placement}/${entry.total}</span></div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    function clearHistory() {
        if (confirm(i18nT('confirm.clearHistory', 'Clear all simulation history?'))) {
            state.history = [];
            localStorage.removeItem('sc-history');
            renderHistory();
            showToast(i18nT('toast.historyCleared', 'History cleared'), 'info');
        }
    }

    // ========== UTILITIES ==========
    function formatTime(seconds) {
        if (seconds === Infinity) return 'DNF';
        if (seconds < 60) return seconds.toFixed(2);
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2).padStart(5, '0');
        return `${mins}:${secs}`;
    }

    function truncateScramble(scramble) {
        if (scramble.length <= 30) return scramble;
        return scramble.substring(0, 27) + '...';
    }

    function getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    // Get or create a stable guest ID for users without a WCA profile
    function getGuestId() {
        let id = localStorage.getItem('sc_guest_id');
        if (!id) {
            id = 'guest-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
            localStorage.setItem('sc_guest_id', id);
        }
        return id;
    }

    function getBattleChatUserName() {
        if (state.userProfile && state.userProfile.name) return state.userProfile.name;
        if (state.playerName) return state.playerName;
        return 'Guest';
    }

    function getBattleChatUserId() {
        if (state.userProfile && state.userProfile.wca_id) return state.userProfile.wca_id;
        if (state.playerWcaId) return state.playerWcaId;
        return getGuestId();
    }

    function loadBattleChat(roomId) {
        if (!roomId) return;
        battleChatRoomId = roomId;
        battleChatLastTimestamp = 0;
        battleChatSeenIds = new Set();
        const messagesEl = $('#battle-chat-messages');
        if (messagesEl) messagesEl.innerHTML = '<div class="battle-chat-empty">No messages yet \u2014 say hi!</div>';
        updateBattleChatStatus(i18nT('battle.connecting', 'connecting\u2026'));
        pollBattleChat();
        if (battleChatInterval) clearInterval(battleChatInterval);
        battleChatInterval = setInterval(() => {
            if (state.currentView !== 'battle' || !battleState.currentRoomId) {
                clearInterval(battleChatInterval);
                battleChatInterval = null;
                return;
            }
            pollBattleChat();
        }, 3000);
    }

    async function pollBattleChat() {
        if (!battleChatRoomId) return;
        try {
            // Try server-side ordering first; fall back to plain GET if the DB
            // rejects the orderBy (some RTDBs require an index rule for new paths).
            let data = null;
            try {
                const r = await fetch(`${RTDB}/battle_chats/${battleChatRoomId}.json?orderBy="timestamp"&limitToLast=50`);
                if (r.ok) data = await r.json();
            } catch (_) { /* fall through to plain GET */ }
            if (data === null) {
                const r2 = await fetch(`${RTDB}/battle_chats/${battleChatRoomId}.json`);
                if (r2.ok) data = await r2.json();
            }
            if (data === null) {
                updateBattleChatStatus(i18nT('battle.offline', 'offline'));
                return;
            }
            updateBattleChatStatus(i18nT('battle.liveLower', 'live'));

            if (!data) {
                const el = $('#battle-chat-messages');
                if (el && !el.querySelector('.battle-chat-message')) {
                    el.innerHTML = '<div class="battle-chat-empty">No messages yet \u2014 say hi!</div>';
                }
                return;
            }
            const messages = Object.entries(data)
                .map(([id, m]) => ({ id, ...m }))
                .filter(m => m && m.text && m.timestamp)
                .sort((a, b) => a.timestamp - b.timestamp);

            // Dedupe by message id AND only re-render if there are new messages
            const newOnes = messages.filter(m => !battleChatSeenIds.has(m.id));
            if (newOnes.length > 0) {
                messages.forEach(m => battleChatSeenIds.add(m.id));
                battleChatLastTimestamp = messages[messages.length - 1].timestamp;
                renderBattleChat(messages);
            }
        } catch (e) {
            updateBattleChatStatus(i18nT('battle.offline', 'offline'));
        }
    }

    // Thin wrappers over content-filter.js so a failure to load that file
    // degrades to unfiltered text rather than breaking the chat entirely.
    function filterOnRender(text) {
        const raw = text == null ? '' : String(text);
        if (!window.ContentFilter) return raw;
        const res = window.ContentFilter.cleanMessage(raw);
        return res.blocked ? '[message removed]' : res.text;
    }

    function filterName(name, fallback) {
        const raw = name == null ? '' : String(name);
        if (!window.ContentFilter) return raw || fallback;
        return window.ContentFilter.cleanName(raw, fallback);
    }

    function renderBattleChat(messages) {
        const container = $('#battle-chat-messages');
        if (!container) return;
        // Avoid full re-render; only append new messages
        const frag = document.createDocumentFragment();
        let appended = false;
        messages.forEach(msg => {
            if (battleChatSeenIds.has(msg.id)) return;
            battleChatSeenIds.add(msg.id);
            // Cap seen IDs to avoid unbounded growth in long-running chats
            if (battleChatSeenIds.size > 200) {
                const it = battleChatSeenIds.values();
                battleChatSeenIds.delete(it.next().value);
            }
            const div = document.createElement('div');
            div.className = 'battle-chat-message';
            // Use textContent for all user-supplied fields to prevent XSS
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timeSpan = document.createElement('span');
            timeSpan.className = 'chat-time';
            timeSpan.textContent = timeStr;
            const userSpan = document.createElement('span');
            userSpan.className = 'chat-user';
            userSpan.textContent = filterName(msg.userName, 'Guest') + ':';
            const textSpan = document.createElement('span');
            textSpan.className = 'chat-text';
            // Filtered on render as well as on send. The database is writable
            // by anyone with curl, so anything that skipped the send path is
            // still masked before it reaches the page.
            textSpan.textContent = filterOnRender(msg.text);
            div.appendChild(timeSpan);
            div.appendChild(userSpan);
            div.appendChild(textSpan);
            frag.appendChild(div);
            appended = true;
        });
        // Auto-scroll to bottom only when new messages arrive
        if (appended) {
            container.appendChild(frag);
            // Keep the rendered history bounded. Without this a spammed room
            // grows the DOM without limit until the panel becomes unusable.
            while (container.children.length > BATTLE_CHAT_MAX_RENDERED) {
                container.removeChild(container.firstChild);
            }
            container.scrollTop = container.scrollHeight;
        }
    }

    async function sendBattleChatMessage() {
        if (!battleChatRoomId) return;
        const input = $('#battle-chat-input');
        const btn = $('#battle-chat-send-btn');
        if (!input || !btn) return;

        // Collapse absurd runs of one character ("aaaaa…") before length capping,
        // so a spam wall becomes a short message rather than a wall.
        let text = (input.value || '').trim()
            .replace(/(.)\1{19,}/g, (m, c) => c.repeat(20))
            .substring(0, BATTLE_CHAT_MAX_LEN);
        if (!text) return;

        // Slurs are refused; ordinary profanity and contact details are
        // masked in place. Refusing tells the sender why, which stops the
        // "message vanished" confusion a silent drop would cause.
        if (window.ContentFilter) {
            const filtered = window.ContentFilter.cleanMessage(text);
            if (filtered.blocked) {
                showToast(i18nT('toast.msgBlocked', 'That message breaks the chat rules'), 'error');
                return;
            }
            text = filtered.text;
        }

        // Client-side spam brakes: a minimum gap between sends, and no
        // immediate duplicates. (Server rules would be needed to make this
        // airtight; this stops the accidental/casual case.)
        const now = Date.now();
        if (now - battleChatLastSentAt < BATTLE_CHAT_MIN_GAP_MS) {
            showToast(i18nT('toast.slowDown', 'Slow down a moment'), 'error');
            return;
        }
        if (text === battleChatLastSentText && now - battleChatLastSentAt < 10000) {
            showToast(i18nT('toast.duplicateMsg', 'That message was just sent'), 'error');
            return;
        }
        battleChatLastSentAt = now;
        battleChatLastSentText = text;
        input.disabled = true;
        btn.disabled = true;
        try {
            const payload = {
                userId: getBattleChatUserId(),
                userName: filterName(getBattleChatUserName(), 'Guest'),
                text: text,
                timestamp: Date.now()
            };
            const res = await fetch(`${RTDB}/battle_chats/${battleChatRoomId}.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                input.value = '';
                pollBattleChat(); // immediate visual update
            } else {
                console.error('Chat send failed:', res.status);
            }
        } catch (e) {
            console.error('Failed to send chat message', e);
        } finally {
            input.disabled = false;
            btn.disabled = false;
            input.focus();
        }
    }

    function stopBattleChat() {
        if (battleChatInterval) {
            clearInterval(battleChatInterval);
            battleChatInterval = null;
        }
        battleChatRoomId = null;
        battleChatLastTimestamp = 0;
        battleChatSeenIds = new Set();
    }

    function updateBattleChatStatus(status) {
        const el = $('#battle-chat-status');
        if (el) el.textContent = status;
    }

        function showToast(message, type = 'info') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
    }

    // Shared AudioContext for sound effects (singleton to avoid browser limits)
    let _audioCtx = null;
    function getAudioContext() {
        if (!_audioCtx) {
            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume if suspended (browsers require user gesture)
        if (_audioCtx.state === 'suspended') {
            _audioCtx.resume();
        }
        return _audioCtx;
    }

    function playBeep(freq, duration) {
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration / 1000);
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    }

    function spawnConfetti() {
        const container = $('#confetti-container');
        container.innerHTML = '';
        const colors = ['#6366F1', '#F97316', '#10B981', '#F59E0B', '#EF4444', '#22D3EE', '#A855F7'];
        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.left = Math.random() * 100 + '%';
            piece.style.top = '-10px';
            piece.style.animationDelay = Math.random() * 1 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            piece.style.width = (4 + Math.random() * 8) + 'px';
            piece.style.height = (4 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            container.appendChild(piece);
        }
    }

    function copyResults() {
        const avg = calculateAverage(state.solves);
        const validSolves = state.solves.filter(s => s.penalty !== 'dnf');
        const best = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.result)) : Infinity;

        let text = `CubingHQ Results\n━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `Competition: ${state.compName}\nEvent: ${EVENT_NAMES[state.event]} | ${getRoundName(state.round)}\n`;
        text += `Player: ${state.playerName} (${state.playerWcaId})\n━━━━━━━━━━━━━━━━━━━━━\n`;

        state.solves.forEach((solve, i) => {
            const result = solve.penalty === 'dnf' ? 'DNF' :
                (solve.penalty === '+2' ? formatTime(solve.result) + ' (+2)' : formatTime(solve.result));
            text += `Solve ${i + 1}: ${result}\n`;
        });

        text += `━━━━━━━━━━━━━━━━━━━━━\nAverage: ${avg === Infinity ? 'DNF' : formatTime(avg)}\n`;
        text += `Best: ${best === Infinity ? 'DNF' : formatTime(best)}\n`;

        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 ' + i18nT('toast.resultsCopied', 'Results copied to clipboard!'), 'success');
        }).catch(() => { showToast(i18nT('toast.copyFailed', 'Failed to copy'), 'error'); });
    }

    // ========== STATE PERSISTENCE ==========
    const SIM_STATE_KEY = 'sc-sim-state';
    const LAST_ACTIVITY_KEY = 'sc-last-activity';
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    function saveSimState() {
        // Only save if there's an active simulation
        if (!state.scrambles || state.scrambles.length === 0) return;

        const stateToSave = {
            compId: state.compId,
            compName: state.compName,
            event: state.event,
            numSolves: state.numSolves,
            round: state.round,
            numRounds: state.numRounds,
            numCompetitors: state.numCompetitors,
            playerName: state.playerName,
            playerWcaId: state.playerWcaId,
            playerAvg: state.playerAvg,
            goalTime: state.goalTime,
            timeLimit: state.timeLimit,
            cutoff: state.cutoff,
            soundEnabled: state.soundEnabled,
            liveMode: state.liveMode,
            spacebarTimer: state.spacebarTimer,
            currentSolve: state.currentSolve,
            scrambles: state.scrambles,
            solves: state.solves,
            competitors: state.competitors,
            selectedPenalty: state.selectedPenalty,
            playerData: state.playerData,
        };

        localStorage.setItem(SIM_STATE_KEY, JSON.stringify(stateToSave));
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }

    function tryRestoreSimState() {
        try {
            const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY), 10);
            if (!lastActivity || (Date.now() - lastActivity) > INACTIVITY_TIMEOUT) {
                clearSimState();
                return false;
            }

            const saved = localStorage.getItem(SIM_STATE_KEY);
            if (!saved) return false;

            const restored = JSON.parse(saved);
            if (!restored || !restored.scrambles || restored.scrambles.length === 0) {
                clearSimState();
                return false;
            }

            // If round was already completed, don't restore to dashboard
            if (restored.currentSolve >= restored.numSolves) {
                clearSimState();
                return false;
            }

            // Restore state
            Object.assign(state, {
                compId: restored.compId || '',
                compName: restored.compName || i18nT('sim.customComp', 'Custom Competition'),
                event: restored.event || '333',
                numSolves: restored.numSolves || 5,
                round: restored.round || 1,
                numRounds: restored.numRounds || 4,
                numCompetitors: restored.numCompetitors || 30,
                playerName: restored.playerName || 'Player',
                playerWcaId: restored.playerWcaId || '',
                playerAvg: restored.playerAvg || 12,
                goalTime: restored.goalTime || null,
                timeLimit: restored.timeLimit || 600,
                cutoff: restored.cutoff || 0,
                soundEnabled: restored.soundEnabled !== false,
                liveMode: restored.liveMode || false,
                currentSolve: restored.currentSolve || 0,
                scrambles: restored.scrambles,
                solves: restored.solves || [],
                competitors: restored.competitors || [],
                selectedPenalty: restored.selectedPenalty || 'none',
                playerData: restored.playerData || null,
                spacebarTimer: restored.spacebarTimer || false,
            });

            // Rebuild dashboard UI
            updateDashboardHeader();
            renderScorecardTemplate();
            if (state.solves.length > 0) updateScorecard();
            if (state.currentSolve < state.numSolves) updateScrambleDisplay();
            updateGoalTracker();
            renderLeaderboard();
            resetTimer();

            switchView('dashboard');
            showToast('🔄 ' + i18nT('toast.simRestored', 'Simulation restored!'), 'info');
            return true;
        } catch (err) {
            console.error('Failed to restore simulation state:', err);
            clearSimState();
            return false;
        }
    }

    function clearSimState() {
        localStorage.removeItem(SIM_STATE_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
    }

    function initActivityTracker() {
        const updateActivity = () => {
            localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        };
        document.addEventListener('click', updateActivity);
        document.addEventListener('keydown', updateActivity);
    }


    // ========== BATTLE SYSTEM (Real-time Firebase) ==========
    const RTDB = 'https://simulatecubing-default-rtdb.firebaseio.com';

    // Battle room chat state (RTDB-backed, polled every 3s)
    let battleChatInterval = null;
    let battleChatLastTimestamp = 0;
    let battleChatRoomId = null;
    let battleChatSeenIds = new Set();

    // Spam guards for room creation.
    const BATTLE_ROOM_NAME_MIN = 3;
    const BATTLE_ROOM_NAME_MAX = 40;
    const BATTLE_ROOM_COOLDOWN_MS = 30000;
    const BATTLE_ROOM_LAST_KEY = 'chq_last_room_created';

    // Spam guards for the room chat.
    const BATTLE_CHAT_MAX_RENDERED = 100;   // messages kept in the DOM
    const BATTLE_CHAT_MAX_LEN = 300;        // characters per message
    const BATTLE_CHAT_MIN_GAP_MS = 1200;    // minimum gap between sends
    let battleChatLastSentAt = 0;
    let battleChatLastSentText = '';
    const BATTLE_PATH = '/battle/rooms';

    const BATTLE_EVENTS = {
        '3x3':   { label: '3x3',      puzzle: '3x3x3',    color: '#FF6B35' },
        '2x2':   { label: '2x2',      puzzle: '2x2x2',    color: '#F7C948' },
        '4x4':   { label: '4x4',      puzzle: '4x4x4',    color: '#2ECC71' },
        '5x5':   { label: '5x5',      puzzle: '5x5x5',    color: '#3498DB' },
        '6x6':   { label: '6x6',      puzzle: '6x6x6',    color: '#9B59B6' },
        '7x7':   { label: '7x7',      puzzle: '7x7x7',    color: '#1ABC9C' },
        'oh':    { label: 'OH',        puzzle: '3x3x3',    color: '#E74C3C' },
        'clock': { label: 'Clock',     puzzle: 'clock',    color: '#FF9FF3' },
        'mega':  { label: 'Mega',      puzzle: 'megaminx', color: '#FEA47F' },
        'pyra':  { label: 'Pyra',      puzzle: 'pyraminx', color: '#6C5CE7' },
        'skewb': { label: 'Skewb',     puzzle: 'skewb',    color: '#00CEC9' },
        'sq1':   { label: 'Sq-1',      puzzle: 'square1',  color: '#FDCB6E' },
    };

    // ----- Firebase REST helpers -----
    async function fbGet(path) {
        try {
            const r = await fetch(`${RTDB}${path}.json`);
            return await r.json();
        } catch (e) { console.error('fbGet error', e); return null; }
    }
    async function fbSet(path, data) {
        try {
            const r = await fetch(`${RTDB}${path}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await r.json();
        } catch (e) { console.error('fbSet error', e); return null; }
    }
    async function fbUpdate(path, data) {
        try {
            const r = await fetch(`${RTDB}${path}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await r.json();
        } catch (e) { console.error('fbUpdate error', e); return null; }
    }
    async function fbPush(path, data) {
        try {
            const r = await fetch(`${RTDB}${path}.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await r.json(); // { name: "-NxyzId" }
        } catch (e) { console.error('fbPush error', e); return null; }
    }
    async function fbDelete(path) {
        try { await fetch(`${RTDB}${path}.json`, { method: 'DELETE' }); } catch (e) {}
    }

    // ----- User identity -----
    function getBattleUserId() {
        if (state.userProfile && state.userProfile.wca_id) return 'wca_' + state.userProfile.wca_id;
        let id = localStorage.getItem('battle_uid');
        if (!id) { id = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); localStorage.setItem('battle_uid', id); }
        return id;
    }
    function getBattleUserName() {
        return (state.userProfile && (state.userProfile.name || state.userProfile.wca_id)) || 'Guest';
    }

    // ----- State -----
    const battleState = {
        initialized: false,
        filterEvent: 'all',
        currentRoomId: null,
        isHost: false,
        lobbyPollId: null,
        roomPollId: null,
        timerRunning: false,
        timerArmed: false,
        spaceHeld: false,
        spaceHoldTimeout: null,
        startTime: null,
        timerInterval: null,
        pendingRoomId: null,
        currentRoomData: null,
        inputMode: 'keyboard', // 'keyboard' | 'typing'
        lastSeenScrambleIndex: -1,
        autoAdvancedIndex: -1,
        lastLobbyData: null,
    };

    // ----- Scramble generator -----
    // Battle scrambles use the shared engine (battle event ids like '3x3',
    // 'oh', 'mega', 'pyra' are normalized inside ScrambleEngine).
    async function generateBattleScramble(event) {
        if (window.ScrambleEngine) return window.ScrambleEngine.get(event);
        return 'R U R\' U\'';
    }

    function battleFormatTime(ms) {
        if (ms >= 60000) { const m = Math.floor(ms/60000), s = ((ms%60000)/1000).toFixed(2); return `${m}:${parseFloat(s)<10?'0':''}${s}`; }
        return (ms/1000).toFixed(2);
    }

    // ----- Init -----
    function initBattle() {
        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';

        if ($('#battle-lobby')) $('#battle-lobby').style.display = 'block';

        if (!battleState.initialized) {
            battleState.initialized = true;
            bindBattleEvents();
            document.addEventListener('keydown', battleKeyDown);
            document.addEventListener('keyup', battleKeyUp);
        }
        loadBattleLobby();
        startLobbyPolling();
    }

    // ----- Lobby polling -----
    function startLobbyPolling() {
        stopRoomPolling();
        if (battleState.lobbyPollId) clearInterval(battleState.lobbyPollId);
        battleState.lobbyPollId = setInterval(() => {
            if (state.currentView !== 'battle' || battleState.currentRoomId) {
                clearInterval(battleState.lobbyPollId);
                battleState.lobbyPollId = null;
                return;
            }
            loadBattleLobby();
        }, 4000);
    }
    function stopLobbyPolling() {
        if (battleState.lobbyPollId) { clearInterval(battleState.lobbyPollId); battleState.lobbyPollId = null; }
    }

    // ----- Room polling -----
    function startRoomPolling(roomId) {
        stopLobbyPolling();
        if (battleState.roomPollId) clearInterval(battleState.roomPollId);
        battleState.roomPollId = setInterval(async () => {
            if (state.currentView !== 'battle' || battleState.currentRoomId !== roomId) {
                clearInterval(battleState.roomPollId);
                battleState.roomPollId = null;
                return;
            }
            const data = await fbGet(`${BATTLE_PATH}/${roomId}`);
            if (!data) { leaveBattleRoom(); return; }
            // Avoid re-rendering identical room data to reduce DOM churn
            const dataHash = JSON.stringify(data);
            if (battleState.currentRoomData && battleState.currentRoomDataHash === dataHash) {
                return;
            }
            battleState.currentRoomData = data;
            battleState.currentRoomDataHash = dataHash;
            renderBattleRoomView(data);
            // Auto-advance: when all players submitted, host creates next scramble
            if (battleState.isHost && data.currentScrambleIndex !== undefined) {
                const currentIdx = data.currentScrambleIndex || 0;
                if (currentIdx > battleState.autoAdvancedIndex) {
                    const members = data.members || {};
                    const playerIds = Object.keys(members);
                    const event = data.event || '3x3';
                    const eventSolves = ((data.solves || {})[event]) || {};
                    const allSubmitted = playerIds.length > 0 && playerIds.every(pid => {
                        const s = (eventSolves[currentIdx] || {})[pid];
                        return s && s.time > 0;
                    });
                    if (allSubmitted) {
                        const newIdx = currentIdx + 1;
                        const scramble = await generateBattleScramble(event);
                        await fbSet(`${BATTLE_PATH}/${roomId}/scrambles/${newIdx}`, { scramble, event, createdAt: Date.now() });
                        await fbUpdate(`${BATTLE_PATH}/${roomId}`, { currentScrambleIndex: newIdx, updatedAt: Date.now() });
                        battleState.autoAdvancedIndex = currentIdx;
                    }
                }
            }
        }, 2000);
    }
    function stopRoomPolling() {
        if (battleState.roomPollId) { clearInterval(battleState.roomPollId); battleState.roomPollId = null; }
    }

    // ----- Load lobby -----
    async function loadBattleLobby() {
        const grid = $('#battle-rooms-grid');
        if (!grid) return;
        
        const refreshIcon = $('#battle-refresh-btn') ? $('#battle-refresh-btn').querySelector('svg') : null;
        if (refreshIcon) refreshIcon.classList.add('spinning-icon');
        
        const data = await fbGet(BATTLE_PATH);
        renderBattleLobby(data);
        
        if (refreshIcon) refreshIcon.classList.remove('spinning-icon');
    }

    function renderBattleLobby(data) {
        const grid = $('#battle-rooms-grid');
        if (!grid) return;
        // Kept so the lobby can be redrawn on a language change without
        // waiting for the next poll.
        battleState.lastLobbyData = data;

        // Prune stale rooms (inactive >30 min)
        const rooms = [];
        if (data) {
            const now = Date.now();
            Object.entries(data).forEach(([id, room]) => {
                if (!room || (now - (room.updatedAt || room.createdAt || 0) > 30 * 60 * 1000)) return;
                rooms.push({ id, ...room });
            });
        }

        const filter = battleState.filterEvent;
        const visible = filter === 'all' ? rooms : rooms.filter(r => r.event === filter);

        if (visible.length === 0) {
            grid.innerHTML = `<div class="battle-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <p>${esc(i18nT('battle.noRooms', 'No rooms found.'))} <button class="btn btn-primary" style="margin-left:8px;" onclick="document.getElementById('battle-create-room-btn').click()">${esc(i18nT('battle.createOne', 'Create one!'))}</button></p>
            </div>`;
            return;
        }

        const LOCK_CLOSED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
        const LOCK_OPEN   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

        grid.innerHTML = visible.map(room => {
            const evtInfo = BATTLE_EVENTS[room.event] || { label: room.event || '?', color: '#888' };
            const memberCount = room.members ? Object.keys(room.members).length : 0;

            return `<div class="battle-room-card" data-room-id="${room.id}" style="--evt-color:${evtInfo.color}">
                <div class="battle-privacy-badge ${room.isPrivate ? 'is-private' : 'is-public'}">
                    ${room.isPrivate ? LOCK_CLOSED : LOCK_OPEN}
                    <span>${esc(room.isPrivate ? i18nT('battle.privateRoom', 'Private Room') : i18nT('battle.publicRoom', 'Public Room'))}</span>
                </div>
                <div class="battle-room-card-event" style="background:${evtInfo.color}22;color:${evtInfo.color};border-color:${evtInfo.color}44">${evtInfo.label}</div>
                <div class="battle-room-card-name">${room.name || esc(i18nT('battle.unnamedRoom', 'Unnamed Room'))}</div>
                <div class="battle-room-card-host">${esc(i18nT('battle.host', 'Host'))}: ${room.hostName || esc(i18nT('battle.unknown', 'Unknown'))}</div>
                <div class="battle-room-card-footer">
                    <div class="battle-room-card-players">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        ${esc((memberCount === 1 ? i18nT('battle.player', '{n} player') : i18nT('battle.players', '{n} players')).replace('{n}', memberCount))}
                    </div>
                    <div class="battle-room-card-status battle-status--waiting">${esc(i18nT('battle.active', 'Active'))}</div>
                </div>
                <button class="battle-join-btn" data-room-id="${room.id}">
                    ${room.isPrivate ? '🔒 ' + esc(i18nT('battle.join', 'Join')) : esc(i18nT('battle.join', 'Join')) + ' →'}
                </button>
            </div>`;
        }).join('');

        $$('.battle-join-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const roomId = btn.dataset.roomId;
                const room = visible.find(r => r.id === roomId);
                if (!room) return;
                if (room.isPrivate) {
                    battleState.pendingRoomId = roomId;
                    $('#battle-pw-input').value = '';
                    $('#battle-pw-error').style.display = 'none';
                    $('#battle-password-modal').style.display = 'flex';
                } else {
                    joinBattleRoom(roomId);
                }
            });
        });
    }

    // Inline validation for the create-room dialog. The message sits next to
    // the field so it is visible while typing, and a toast still fires for
    // anyone whose attention is elsewhere on the page.
    function showCreateRoomError(msg, focusSel) {
        const box = $('#battle-create-error');
        const text = $('#battle-create-error-text');
        if (box && text) {
            text.textContent = msg;
            box.style.display = 'flex';
        }
        if (focusSel) {
            const field = $(focusSel);
            if (field) { field.classList.add('is-invalid'); field.focus(); }
        }
        showToast(msg, 'error');
    }

    function clearCreateRoomError() {
        const box = $('#battle-create-error');
        if (box) box.style.display = 'none';
        ['#battle-room-name-input', '#battle-room-password'].forEach(sel => {
            const f = $(sel);
            if (f) f.classList.remove('is-invalid');
        });
    }

    // ----- Bind static events -----
    function bindBattleEvents() {
        const kbMode = $('#battle-keyboard-mode');
        if (kbMode) {
            kbMode.addEventListener('touchstart', battlePointerDown, { passive: false });
            kbMode.addEventListener('touchend', battlePointerUp, { passive: false });
            kbMode.addEventListener('touchcancel', battlePointerUp, { passive: false });
            kbMode.addEventListener('mousedown', battlePointerDown);
            kbMode.addEventListener('mouseup', battlePointerUp);
            kbMode.addEventListener('mouseleave', battlePointerUp);
        }

        // Refresh button
        $('#battle-refresh-btn').addEventListener('click', loadBattleLobby);

        // Create room
        $('#battle-create-room-btn').addEventListener('click', () => {
            $('#battle-room-name-input').value = '';
            $('#battle-room-password').value = '';
            clearCreateRoomError();
            $('#battle-password-group').style.display = 'none';
            $('#battle-vis-public').classList.add('active');
            $('#battle-vis-private').classList.remove('active');
            $('#battle-create-modal').style.display = 'flex';
        });
        $('#battle-room-name-input').addEventListener('input', clearCreateRoomError);
        $('#battle-room-password').addEventListener('input', clearCreateRoomError);
        $('#battle-create-close').addEventListener('click', () => $('#battle-create-modal').style.display = 'none');
        $('#battle-create-cancel').addEventListener('click', () => $('#battle-create-modal').style.display = 'none');

        $('#battle-vis-public').addEventListener('click', () => {
            $('#battle-vis-public').classList.add('active');
            $('#battle-vis-private').classList.remove('active');
            $('#battle-password-group').style.display = 'none';
        });
        $('#battle-vis-private').addEventListener('click', () => {
            $('#battle-vis-private').classList.add('active');
            $('#battle-vis-public').classList.remove('active');
            $('#battle-password-group').style.display = 'block';
        });

        $('#battle-create-confirm').addEventListener('click', async () => {
            const name = $('#battle-room-name-input').value.trim().replace(/\s+/g, ' ');
            if (name.length < BATTLE_ROOM_NAME_MIN) {
                showCreateRoomError(
                    i18nT('toast.roomNameShort', 'Room name needs at least {n} characters').replace('{n}', BATTLE_ROOM_NAME_MIN),
                    '#battle-room-name-input');
                return;
            }
            if (name.length > BATTLE_ROOM_NAME_MAX) {
                showCreateRoomError(
                    i18nT('toast.roomNameLong', 'Room name can be at most {n} characters').replace('{n}', BATTLE_ROOM_NAME_MAX),
                    '#battle-room-name-input');
                return;
            }
            // Cooldown between room creations, so the list can't be flooded
            // by one person hammering the button.
            const lastCreated = Number(localStorage.getItem(BATTLE_ROOM_LAST_KEY) || 0);
            const waitMs = BATTLE_ROOM_COOLDOWN_MS - (Date.now() - lastCreated);
            if (waitMs > 0) {
                showCreateRoomError(
                    i18nT('toast.roomCooldown', 'Please wait {n}s before creating another room').replace('{n}', Math.ceil(waitMs / 1000)));
                return;
            }
            const isPrivate = $('#battle-vis-private').classList.contains('active');
            const password = $('#battle-room-password').value.trim();
            if (isPrivate && !password) {
                showCreateRoomError(i18nT('toast.needPassword', 'Please set a password'), '#battle-room-password');
                return;
            }
            clearCreateRoomError();

            const userId = getBattleUserId();
            const userName = getBattleUserName();
            const now = Date.now();
            const initialEvent = '3x3';
            const scramble = await generateBattleScramble(initialEvent);

            const roomData = {
                name, isPrivate,
                password: isPrivate ? password : null,
                host: userId, hostName: userName,
                event: initialEvent,
                currentScrambleIndex: 0,
                scrambles: { 0: { scramble, event: initialEvent, createdAt: now } },
                createdAt: now, updatedAt: now,
                members: { [userId]: { name: userName, joinedAt: now } },
                solves: {}
            };

            const confirmLabel = $('#battle-create-confirm-label');
            $('#battle-create-confirm').disabled = true;
            confirmLabel.textContent = i18nT('battle.creating', 'Creating...');
            const result = await fbPush(BATTLE_PATH, roomData);
            $('#battle-create-confirm').disabled = false;
            confirmLabel.textContent = i18nT('battle.createRoom', 'Create Room');

            if (!result || !result.name) { showCreateRoomError(i18nT('toast.roomCreateFailed', 'Failed to create room. Try again.')); return; }
            try { localStorage.setItem(BATTLE_ROOM_LAST_KEY, String(Date.now())); } catch (e) { /* private mode */ }
            $('#battle-create-modal').style.display = 'none';
            await enterBattleRoom(result.name, roomData);
        });

        // Password modal
        $('#battle-pw-close').addEventListener('click', () => { $('#battle-password-modal').style.display = 'none'; battleState.pendingRoomId = null; });
        $('#battle-pw-cancel').addEventListener('click', () => { $('#battle-password-modal').style.display = 'none'; battleState.pendingRoomId = null; });
        $('#battle-pw-confirm').addEventListener('click', async () => {
            const roomId = battleState.pendingRoomId;
            if (!roomId) return;
            const room = await fbGet(`${BATTLE_PATH}/${roomId}`);
            if (!room) { showToast(i18nT('toast.roomNotFound', 'Room not found'), 'error'); return; }
            const entered = $('#battle-pw-input').value;
            if (entered !== room.password) {
                $('#battle-pw-error').style.display = 'flex';
                return;
            }
            $('#battle-password-modal').style.display = 'none';
            $('#battle-pw-error').style.display = 'none';
            joinBattleRoom(roomId, room);
        });
        $('#battle-pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#battle-pw-confirm').click(); });

        // Event filter chips
        $$('.battle-filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                $$('.battle-filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                battleState.filterEvent = chip.dataset.event;
                loadBattleLobby();
            });
        });

        // Leave room
        $('#battle-leave-btn').addEventListener('click', leaveBattleRoom);

        // Battle room chat: send on click + Enter key
        const bcSend = $('#battle-chat-send-btn');
        if (bcSend) bcSend.addEventListener('click', sendBattleChatMessage);
        const bcInput = $('#battle-chat-input');
        if (bcInput) {
            bcInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendBattleChatMessage();
                }
            });
        }

        // In-room: event chips (host only)
        $$('.battle-event-chip').forEach(chip => {
            chip.addEventListener('click', async () => {
                if (!battleState.isHost) return;
                const newEvent = chip.dataset.event;
                const roomId = battleState.currentRoomId;
                if (!roomId) return;
                const scramble = await generateBattleScramble(newEvent);
                await fbUpdate(`${BATTLE_PATH}/${roomId}`, { event: newEvent, scramble, updatedAt: Date.now() });
                // Update local UI immediately
                $$('.battle-event-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });

        // New scramble button (host only)
        $('#battle-new-scramble-btn').addEventListener('click', async () => {
            if (!battleState.isHost) return;
            const roomId = battleState.currentRoomId;
            const roomData = battleState.currentRoomData;
            if (!roomId || !roomData) return;
            const event = roomData.event || '3x3';
            const newIdx = (roomData.currentScrambleIndex || 0) + 1;
            const scramble = await generateBattleScramble(event);
            // Store new scramble in Firebase then bump index
            await fbSet(`${BATTLE_PATH}/${roomId}/scrambles/${newIdx}`, { scramble, event, createdAt: Date.now() });
            await fbUpdate(`${BATTLE_PATH}/${roomId}`, { currentScrambleIndex: newIdx, updatedAt: Date.now() });
        });
    }

    // ----- Join room -----
    async function joinBattleRoom(roomId, roomDataArg) {
        const userId = getBattleUserId();
        const userName = getBattleUserName();
        const now = Date.now();
        await fbUpdate(`${BATTLE_PATH}/${roomId}/members/${userId}`, { name: userName, joinedAt: now });
        await fbUpdate(`${BATTLE_PATH}/${roomId}`, { updatedAt: now });
        const roomData = roomDataArg || await fbGet(`${BATTLE_PATH}/${roomId}`);
        if (!roomData) { showToast(i18nT('toast.roomJoinFailed', 'Could not join room'), 'error'); return; }
        await enterBattleRoom(roomId, roomData);
    }

    // ----- Enter room view -----
    async function enterBattleRoom(roomId, roomData) {
        const userId = getBattleUserId();
        battleState.currentRoomId = roomId;
        battleState.isHost = (roomData.host === userId);
        battleState.currentRoomData = roomData;
        battleState.autoAdvancedIndex = -1;

        // Reset timer
        clearInterval(battleState.timerInterval);
        battleState.timerRunning = false;
        battleState.timerArmed = false;
        const timeEl = $('#battle-timer-time');
        if (timeEl) { timeEl.textContent = '0.00'; timeEl.className = 'battle-timer-time'; }
        if ($('#battle-timer-status')) { $('#battle-timer-status').textContent = i18nT('battle.holdSpace', 'Hold Space to start timer'); $('#battle-timer-status').style.color = ''; }

        // Show/hide room UI
        if ($('#battle-lobby')) $('#battle-lobby').style.display = 'none';
        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';

        // Start chat polling for this room
        if (typeof loadBattleChat === 'function') {
            const _chatRoomId = (typeof battleState !== 'undefined' && battleState && battleState.currentRoomId) || null;
            if (_chatRoomId) loadBattleChat(_chatRoomId);
        }

        initBattleInputModeButtons();

        // Init and default mode to keyboard
        initBattleInputModeButtons();
        setBattleInputMode('keyboard');

        // Host controls
        const newScrambleBtn = $('#battle-new-scramble-btn');
        if (newScrambleBtn) newScrambleBtn.style.display = battleState.isHost ? 'flex' : 'none';

        // Enable/disable event chips based on host status
        $$('.battle-event-chip').forEach(c => {
            c.disabled = !battleState.isHost;
            c.style.opacity = battleState.isHost ? '1' : '0.5';
            c.style.cursor = battleState.isHost ? 'pointer' : 'default';
        });

        renderBattleRoomView(roomData);
        startRoomPolling(roomId);
    }


    // ----- Render room view from data -----
    function renderBattleRoomView(roomData) {
        if (!roomData) return;
        const userId = getBattleUserId();
        const event = roomData.event || '3x3';
        const evtInfo = BATTLE_EVENTS[event] || { label: event, puzzle: '3x3x3', color: '#888' };
        const currentIdx = roomData.currentScrambleIndex || 0;
        const scrambles = roomData.scrambles || {};
        const members = roomData.members || {};

        // Top bar
        if ($('#battle-room-name-display')) $('#battle-room-name-display').textContent = roomData.name || 'Room';
        const badge = $('#battle-room-event-badge');
        if (badge) {
            badge.textContent = evtInfo.label;
            badge.style.background = evtInfo.color + '22';
            badge.style.color = evtInfo.color;
        }
        if ($('#battle-scores-event-label')) $('#battle-scores-event-label').textContent = `(${evtInfo.label})`;

        // Event chips
        $$('.battle-event-chip').forEach(c => c.classList.toggle('active', c.dataset.event === event));

        // Scramble — from scrambles map (shared for all users)
        const scrambleEl = $('#battle-scramble-text');
        const currentScrambleObj = scrambles[currentIdx];
        const currentScramble = currentScrambleObj ? currentScrambleObj.scramble : null;
        if (scrambleEl) {
            scrambleEl.textContent = currentScramble || i18nT('battle.waitingScramble', 'Waiting for scramble...');
        }
        const twisty = $('#battle-twisty');
        if (twisty && currentScramble) {
            twisty.setAttribute('puzzle', evtInfo.puzzle);
            // Square-1 has no 2D net in the renderer — 3D (with back view).
            if (window.ScrambleEngine) window.ScrambleEngine.applyViz(twisty, evtInfo.puzzle);
            twisty.setAttribute('alg',
                window.ScrambleEngine ? window.ScrambleEngine.normalizeAlgFor(evtInfo.puzzle, currentScramble) : currentScramble);
        }

        // Auto-reset timer when scramble index changes
        if (currentIdx !== battleState.lastSeenScrambleIndex) {
            battleState.lastSeenScrambleIndex = currentIdx;
            clearInterval(battleState.timerInterval);
            battleState.timerRunning = false;
            const timeEl = $('#battle-timer-time');
            if (timeEl) { timeEl.textContent = '0.00'; timeEl.className = 'battle-timer-time'; }
            const statusEl = $('#battle-timer-status');
            if (statusEl) { statusEl.textContent = i18nT('battle.holdSpace', 'Hold Space to start timer'); statusEl.style.color = ''; }
            const typingDisp = $('#battle-typing-display');
            if (typingDisp) { typingDisp.textContent = '0.00'; typingDisp.className = 'battle-timer-time'; }
            const typingInp = $('#battle-typing-input');
            if (typingInp) typingInp.value = '';
        }

        // ---- Cross-table ----
        const tableWrap = $('#battle-cross-table-wrap');
        if (!tableWrap) return;

        // Ordered player IDs: host first, then others, me always highlighted
        const playerIds = Object.keys(members);
        if (playerIds.length === 0) { tableWrap.innerHTML = `<div class="battle-scores-empty">${esc(i18nT('battle.noPlayers', 'No players yet'))}</div>`; return; }

        // Get all scramble indices (newest first)
        const allIndices = Object.keys(scrambles).map(Number).sort((a,b) => b - a);
        const eventSolves = ((roomData.solves || {})[event]) || {};

        // Per-player stats across all scrambles
        function getPlayerTimes(pid) {
            const arr = [];
            allIndices.forEach(idx => {
                const s = (eventSolves[idx] || {})[pid];
                if (s && s.time > 0) arr.push({ idx, time: s.time });
            });
            return arr; // in newest-first order by allIndices
        }

        function calcAo(times, n) {
            // times: array of ms values (already in order, we take last n)
            if (times.length < n) return null;
            const slice = times.slice(0, n); // newest n
            const sorted = slice.slice().sort((a,b) => a-b);
            // Remove best and worst
            const trimmed = sorted.slice(1, -1);
            return trimmed.length ? trimmed.reduce((a,b)=>a+b,0)/trimmed.length : null;
        }

        const playerStats = {}; // pid -> { times, wins, mean, single, ao5, ao12, ao50, ao100 }
        playerIds.forEach(pid => {
            const entries = getPlayerTimes(pid);
            const times = entries.map(e => e.time);
            const sorted = times.slice().sort((a,b)=>a-b);
            playerStats[pid] = {
                times,
                wins: 0,
                mean: times.length ? times.reduce((a,b)=>a+b,0)/times.length : null,
                single: sorted[0] || null,
                ao5:   calcAo(times, 5),
                ao12:  calcAo(times, 12),
                ao50:  calcAo(times, 50),
                ao100: calcAo(times, 100),
            };
        });

        // Count wins per scramble
        allIndices.forEach(idx => {
            const rowData = eventSolves[idx] || {};
            let bestT = Infinity, bestPid = null;
            playerIds.forEach(pid => {
                const s = rowData[pid];
                if (s && s.time > 0 && s.time < bestT) { bestT = s.time; bestPid = pid; }
            });
            if (bestPid) playerStats[bestPid].wins++;
        });

        // Build table HTML
        const fmtStat = (ms) => ms !== null ? battleFormatTime(ms) : '—';

        let html = '<table class="bct">';

        // ---- Header: # | player names ----
        html += '<thead><tr class="bct-header-row"><th class="bct-th-num">#</th>';
        playerIds.forEach((pid, i) => {
            const m = members[pid] || {};
            const isMe = pid === userId;
            const isHost = pid === roomData.host;
            const color = `hsl(${(i * 67 + 180) % 360},55%,45%)`;
            html += `<th class="bct-th-player ${isMe ? 'bct-me' : ''}" style="--pcol:${color}">
                <span class="bct-player-dot" style="background:${color}"></span>
                ${m.name || pid}${isHost ? ' 👑' : ''}${isMe ? '<br><span class="bct-you-tag">(You)</span>' : ''}
            </th>`;
        });
        html += '</tr></thead><tbody>';

        // ---- Stats rows: mean, wins ----
        const statRows = [
            { label: 'mean',  get: (pid) => fmtStat(playerStats[pid].mean) },
            { label: 'wins',  get: (pid) => playerStats[pid].wins || 0 },
        ];
        statRows.forEach(row => {
            html += `<tr class="bct-stat-row"><td class="bct-td-num">${row.label}</td>`;
            playerIds.forEach(pid => {
                const val = row.get(pid);
                const isBest = row.label === 'mean'
                    ? playerStats[pid].mean !== null && playerIds.every(p2 => p2 === pid || playerStats[p2].mean === null || playerStats[pid].mean <= playerStats[p2].mean)
                    : row.label === 'wins'
                    ? playerIds.every(p2 => p2 === pid || (playerStats[pid].wins || 0) >= (playerStats[p2].wins || 0))
                    : false;
                html += `<td class="bct-td-stat ${isBest && playerIds.length > 1 ? 'bct-best-stat' : ''}">${val}</td>`;
            });
            html += '</tr>';
        });

        // ---- Divider ----
        html += `<tr class="bct-divider-row"><td colspan="${playerIds.length + 1}"></td></tr>`;

        // ---- Solve rows (newest first) ----
        if (allIndices.length === 0) {
            html += `<tr><td colspan="${playerIds.length + 1}" class="bct-empty">${esc(i18nT('battle.noSolvesTable', 'No solves yet — solve the scramble!'))}</td></tr>`;
        } else {
            allIndices.forEach(idx => {
                const rowData = eventSolves[idx] || {};
                const isCurrent = idx === currentIdx;

                // Find winner of this scramble
                let bestT = Infinity, bestPid = null;
                playerIds.forEach(pid => {
                    const s = rowData[pid];
                    if (s && s.time > 0 && s.time < bestT) { bestT = s.time; bestPid = pid; }
                });

                html += `<tr class="bct-row ${isCurrent ? 'bct-current' : ''}">`;
                html += `<td class="bct-td-num">${idx + 1}${isCurrent ? '<span class="bct-current-dot"></span>' : ''}</td>`;
                playerIds.forEach(pid => {
                    const s = rowData[pid];
                    const hasSolve = s && s.time > 0;
                    const isWinner = pid === bestPid && hasSolve && playerIds.length > 1;
                    const isMe = pid === userId;
                    html += `<td class="bct-td-time ${isWinner ? 'bct-winner' : ''} ${isMe ? 'bct-me-time' : ''} ${!hasSolve && isCurrent ? 'bct-pending' : ''}">
                        ${hasSolve ? battleFormatTime(s.time) : (isCurrent ? '·' : '')}
                    </td>`;
                });
                html += '</tr>';
            });
        }

        // ---- Footer: single, ao5, ao12, ao50, ao100 ----
        html += `<tr class="bct-divider-row"><td colspan="${playerIds.length + 1}"></td></tr>`;
        ['single','ao5','ao12','ao50','ao100'].forEach(stat => {
            html += `<tr class="bct-footer-row"><td class="bct-td-num">${stat}</td>`;
            playerIds.forEach(pid => {
                const val = playerStats[pid][stat];
                // Best among players who have this stat
                const vals = playerIds.map(p => playerStats[p][stat]).filter(v => v !== null);
                const isBest = val !== null && (vals.length === 0 || val <= Math.min(...vals)) && playerIds.length > 1;
                html += `<td class="bct-td-stat ${isBest ? 'bct-best-stat' : ''}">${fmtStat(val)}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        tableWrap.innerHTML = html;
    }

    // ----- Leave room -----
    async function leaveBattleRoom() {
        const roomId = battleState.currentRoomId;
        const userId = getBattleUserId();

        clearInterval(battleState.timerInterval);
        battleState.timerRunning = false;
        stopRoomPolling();

        if (roomId) {
            await fbDelete(`${BATTLE_PATH}/${roomId}/members/${userId}`);
            // If host and no members left, delete room
            const remaining = await fbGet(`${BATTLE_PATH}/${roomId}/members`);
            if (!remaining || Object.keys(remaining).length === 0) {
                await fbDelete(`${BATTLE_PATH}/${roomId}`);
            } else if (battleState.isHost) {
                // Transfer host to first remaining member
                const newHostId = Object.keys(remaining)[0];
                const newHostName = (remaining[newHostId] || {}).name || 'Unknown';
                await fbUpdate(`${BATTLE_PATH}/${roomId}`, { host: newHostId, hostName: newHostName, updatedAt: Date.now() });
            }
        }

        battleState.currentRoomId = null;
        battleState.isHost = false;
        battleState.currentRoomData = null;
        battleState.currentRoomDataHash = null;
        battleState.autoAdvancedIndex = -1;

        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';

        // Stop chat polling
        stopBattleChat();
        if ($('#battle-lobby')) $('#battle-lobby').style.display = 'block';

        loadBattleLobby();
        startLobbyPolling();
    }

    // ----- Timer keyboard handling -----
    // ---- Input mode switching (Keyboard / Typing) ----
    function setBattleInputMode(mode) {
        // mode: 'keyboard' | 'typing'
        battleState.inputMode = mode;
        const kbMode  = $('#battle-keyboard-mode');
        const tyMode  = $('#battle-typing-mode');
        const kbBtn   = $('#battle-mode-keyboard');
        const tyBtn   = $('#battle-mode-typing');

        if (mode === 'keyboard') {
            if (kbMode) kbMode.style.display = '';
            if (tyMode) tyMode.style.display = 'none';
            if (kbBtn) kbBtn.classList.add('active');
            if (tyBtn) tyBtn.classList.remove('active');
        } else {
            if (kbMode) kbMode.style.display = 'none';
            if (tyMode) { tyMode.style.display = 'flex'; }
            if (tyBtn) tyBtn.classList.add('active');
            if (kbBtn) kbBtn.classList.remove('active');
            const inp = $('#battle-typing-input');
            if (inp) { inp.value = ''; inp.focus(); }
            const disp = $('#battle-typing-display');
            if (disp) { disp.textContent = '0.00'; disp.className = 'battle-timer-time'; }
        }
        // Stop any running timer when switching
        if (battleState.timerRunning) {
            clearInterval(battleState.timerInterval);
            battleState.timerRunning = false;
        }
    }

    function initBattleInputModeButtons() {
        const kbBtn = $('#battle-mode-keyboard');
        const tyBtn = $('#battle-mode-typing');
        if (kbBtn && !kbBtn._bound) {
            kbBtn._bound = true;
            kbBtn.addEventListener('click', () => setBattleInputMode('keyboard'));
        }
        if (tyBtn && !tyBtn._bound) {
            tyBtn._bound = true;
            tyBtn.addEventListener('click', () => setBattleInputMode('typing'));
        }

        // Typing input — parse time on every keystroke
        const inp = $('#battle-typing-input');
        const disp = $('#battle-typing-display');
        if (inp && !inp._bound) {
            inp._bound = true;
            inp.addEventListener('input', () => {
                const parsed = parseTypedTime(inp.value);
                if (disp) {
                    disp.textContent = parsed !== null ? battleFormatTime(parsed) : inp.value || '0.00';
                    disp.className = 'battle-timer-time' + (parsed !== null ? ' pb' : '');
                }
            });
            inp.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const submitBtn = $('#battle-typing-submit');
                    if (submitBtn) submitBtn.click();
                }
            });
        }

        const submitBtn = $('#battle-typing-submit');
        if (submitBtn && !submitBtn._bound) {
            submitBtn._bound = true;
            submitBtn.addEventListener('click', async () => {
                const inp2 = $('#battle-typing-input');
                if (!inp2) return;
                const parsed = parseTypedTime(inp2.value);
                if (parsed === null || parsed <= 0) {
                    showToast(i18nT('toast.badTimeFormat', 'Invalid time format. Use digits: 1234 = 12.34s'), 'error');
                    return;
                }
                await submitBattleSolve(parsed);
                inp2.value = '';
                const disp2 = $('#battle-typing-display');
                if (disp2) { disp2.textContent = '0.00'; disp2.className = 'battle-timer-time'; }
            });
        }
    }

    // Parse typed time: digits only, interpreted as centiseconds
    // "1234" → 12.34s = 12340ms
    // "10234" → 1:02.34 = 62340ms
    // "12345" → 1:23.45 = 83450ms
    function parseTypedTime(raw) {
        const digits = raw.replace(/\D/g, '');
        if (!digits || digits.length === 0) return null;
        const n = parseInt(digits, 10);
        // interpret as centiseconds (last 2 digits = cs, rest = seconds)
        const cs = n % 100;
        const totalSec = Math.floor(n / 100);
        const ms = totalSec * 1000 + cs * 10;
        if (ms <= 0 || ms > 3600000) return null; // sanity: >0 and <1hr
        return ms;
    }

    // ---- Keyboard timer ----
    function battleKeyDown(e) {
        if (state.currentView !== 'battle') return;
        if (!battleState.currentRoomId) return;
        if (battleState.inputMode !== 'keyboard') return;
        if (e.code !== 'Space') return;
        // Don't intercept if focus is on an input
        if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();

        if (battleState.timerRunning) {
            stopBattleTimer();
        } else if (!battleState.spaceHeld) {
            battleState.spaceHeld = true;
            battleState.timerArmed = false;
            const statusEl = $('#battle-timer-status');
            if (statusEl) { statusEl.textContent = i18nT('battle.holding', 'Holding...'); statusEl.style.color = '#F1C40F'; }
            battleState.spaceHoldTimeout = setTimeout(() => {
                battleState.timerArmed = true;
                if (statusEl) { statusEl.textContent = i18nT('battle.release', 'Release to start!'); statusEl.style.color = '#2ECC71'; }
            }, 500);
        }
    }

    function battleKeyUp(e) {
        if (state.currentView !== 'battle') return;
        if (battleState.inputMode !== 'keyboard') return;
        if (e.code !== 'Space') return;
        if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();

        if (battleState.spaceHeld && !battleState.timerRunning) {
            clearTimeout(battleState.spaceHoldTimeout);
            if (battleState.timerArmed) {
                startBattleTimer();
            } else {
                const statusEl = $('#battle-timer-status');
                if (statusEl) { statusEl.textContent = i18nT('battle.holdSpace', 'Hold Space to start timer'); statusEl.style.color = ''; }
            }
        }
        battleState.spaceHeld = false;
        battleState.timerArmed = false;
    }

    
    function battlePointerDown(e) {
        if (state.currentView !== 'battle') return;
        if (!battleState.currentRoomId) return;
        if (battleState.inputMode !== 'keyboard') return;
        if (e.target && e.target.closest && e.target.closest('button')) return;
        if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();

        if (battleState.timerRunning) {
            stopBattleTimer();
        } else if (!battleState.spaceHeld) {
            battleState.spaceHeld = true;
            battleState.timerArmed = false;
            const statusEl = $('#battle-timer-status');
            if (statusEl) { statusEl.textContent = i18nT('battle.holding', 'Holding...'); statusEl.style.color = '#F1C40F'; }
            battleState.spaceHoldTimeout = setTimeout(() => {
                battleState.timerArmed = true;
                if (statusEl) { statusEl.textContent = i18nT('battle.release', 'Release to start!'); statusEl.style.color = '#2ECC71'; }
            }, 500);
        }
    }

    function battlePointerUp(e) {
        if (state.currentView !== 'battle') return;
        if (battleState.inputMode !== 'keyboard') return;
        if (e.target && e.target.closest && e.target.closest('button')) return;
        if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();

        if (battleState.spaceHeld && !battleState.timerRunning) {
            clearTimeout(battleState.spaceHoldTimeout);
            if (battleState.timerArmed) {
                startBattleTimer();
            } else {
                const statusEl = $('#battle-timer-status');
                if (statusEl) { statusEl.textContent = i18nT('battle.holdToStart', 'Hold Space/Touch to start timer'); statusEl.style.color = ''; }
            }
        }
        battleState.spaceHeld = false;
        battleState.timerArmed = false;
    }
    function startBattleTimer() {
        battleState.startTime = performance.now();
        battleState.timerRunning = true;
        const timeEl = $('#battle-timer-time');
        if (timeEl) timeEl.className = 'battle-timer-time running';
        const statusEl = $('#battle-timer-status');
        if (statusEl) { statusEl.textContent = 'Solving!'; statusEl.style.color = ''; }
        battleState.timerInterval = setInterval(() => {
            const elapsed = performance.now() - battleState.startTime;
            if (timeEl) timeEl.textContent = battleFormatTime(elapsed);
        }, 30);
    }

    async function stopBattleTimer() {
        if (!battleState.timerRunning) return;
        clearInterval(battleState.timerInterval);
        battleState.timerRunning = false;
        const elapsed = performance.now() - battleState.startTime;
        const timeEl = $('#battle-timer-time');
        if (timeEl) { timeEl.textContent = battleFormatTime(elapsed); timeEl.className = 'battle-timer-time pb'; }
        const statusEl = $('#battle-timer-status');
        if (statusEl) { statusEl.textContent = `Done! ${battleFormatTime(elapsed)}`; statusEl.style.color = '#2ECC71'; }
        await submitBattleSolve(elapsed);
        // Reset timer so user can start next attempt (while waiting for others)
        if (timeEl) { timeEl.textContent = '0.00'; timeEl.className = 'battle-timer-time'; }
        if (statusEl) { statusEl.textContent = i18nT('battle.holdSpace', 'Hold Space to start timer'); statusEl.style.color = ''; }
    }

    // ---- Shared submit ----
    async function submitBattleSolve(elapsedMs) {
        const roomId = battleState.currentRoomId;
        const userId = getBattleUserId();
        const roomData = battleState.currentRoomData;
        if (!roomId || !roomData) return;
        const event = roomData.event || '3x3';
        const idx = roomData.currentScrambleIndex || 0;
        // Use fbSet so each user has exactly one solve per scramble (overwrite if re-submitted)
        await fbSet(`${BATTLE_PATH}/${roomId}/solves/${event}/${idx}/${userId}`, {
            time: elapsedMs,
            submittedAt: Date.now()
        });
        await fbUpdate(`${BATTLE_PATH}/${roomId}`, { updatedAt: Date.now() });
        showToast(`${i18nT('toast.solveRecorded', 'Solve recorded')}: ${battleFormatTime(elapsedMs)}`, 'success');
    }

    // ========== START ==========
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const res = await fetch('https://simulatecubing-default-rtdb.firebaseio.com/algorithms.json');
            window.ALGORITHMS = await res.json();
        } catch (e) {
            console.error('Failed to load algorithms from Firebase', e);
            window.ALGORITHMS = {};
        }
        init();
    });
    // =========================================================================
    // csTimer Clone navigation hook (delegates to timer.js)
    // =========================================================================
    function initTimerView() {
        if (window.TimerModule) {
            if (!window.TimerModule.state || !window.TimerModule.state.loaded) {
                window.TimerModule.init();
            } else {
                window.TimerModule.onEnter();
            }
        }
    }



    // A read-only window onto the simulator's advancement maths, so the rules
    // can be tested against real WCIF conditions without driving a whole round
    // through the UI. Nothing here mutates state.
    window.SimRules = {
        advancementConditionFor,
        advancementInfo,
        attemptGap,
        state: () => ({
            numRounds: state.numRounds,
            round: state.round,
            wcifRounds: state.wcifRounds,
            wcifRoundsKnown: state.wcifRoundsKnown,
            numCompetitors: state.numCompetitors,
            lastAdvanceCount: state.lastAdvanceCount,
        }),
    };
})();
