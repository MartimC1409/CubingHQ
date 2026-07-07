/* ============================================================
   SimulateCubing — Application Logic (WCA API Integrated)
   ============================================================ */

(function () {
    'use strict';

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

    const ROUND_NAMES = { 1: 'Round 1', 2: 'Round 2', 3: 'Semi-Final', 4: 'Final' };

    // Events that use Mean of 3 (instead of Average of 5)
    const MEAN_OF_3_EVENTS = ['666', '777', '333bf', '444bf', '555bf', '333fm', '333mbf'];

    // First names and last names for realistic competitor generation
    const FIRST_NAMES = [
        'Max', 'Feliks', 'Tymon', 'Yiheng', 'Luke', 'Matty', 'Ruihang', 'Patrick',
        'Leo', 'Martin', 'Seung', 'Antoine', 'Chris', 'Dana', 'Juliette', 'Ming',
        'Kevin', 'Sebastian', 'Tommy', 'Jayden', 'Ava', 'Chloe', 'Diego', 'Elijah',
        'Fiona', 'Gael', 'Hannah', 'Ivan', 'Jun', 'Kai', 'Liam', 'Mia', 'Nina',
        'Oscar', 'Priya', 'Quinn', 'Ravi', 'Sofia', 'Tomas', 'Uma', 'Victor',
        'Wen', 'Xander', 'Yuki', 'Zara', 'Aiden', 'Bella', 'Carlos', 'Daria',
        'Erik', 'Flora', 'Gustav', 'Hana', 'Igor', 'Jade', 'Lars', 'Marta'
    ];

    const LAST_NAMES = [
        'Park', 'Zemdegs', 'Kolasinski', 'Wang', 'Garrett', 'Intan', 'Xu', 'Ponce',
        'Borber', 'Egdal', 'Hyun', 'Cantin', 'Olson', 'Yi', 'Chen', 'Zhang',
        'Lee', 'Kim', 'Mueller', 'Richter', 'Garcia', 'Silva', 'Santos', 'Taylor',
        'Wilson', 'Brown', 'Miller', 'Anderson', 'Thomas', 'Martinez', 'Robinson',
        'Clark', 'Lewis', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Hill',
        'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Roberts',
        'Turner', 'Phillips', 'Campbell', 'Evans', 'Edwards', 'Collins', 'Stewart'
    ];

    // Scramble move sets
    const MOVES = {
        '333': { faces: ['U', 'D', 'R', 'L', 'F', 'B'], modifiers: ['', "'", '2'], length: 20 },
        '222': { faces: ['U', 'R', 'F'], modifiers: ['', "'", '2'], length: 11 },
        '444': { faces: ['U', 'D', 'R', 'L', 'F', 'B', 'Uw', 'Rw', 'Fw'], modifiers: ['', "'", '2'], length: 44 },
        '555': { faces: ['U', 'D', 'R', 'L', 'F', 'B', 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw'], modifiers: ['', "'", '2'], length: 60 },
        '666': { faces: ['U', 'D', 'R', 'L', 'F', 'B', 'Uw', 'Rw', 'Fw', '3Uw', '3Rw', '3Fw'], modifiers: ['', "'", '2'], length: 80 },
        '777': { faces: ['U', 'D', 'R', 'L', 'F', 'B', 'Uw', 'Rw', 'Fw', '3Uw', '3Rw', '3Fw'], modifiers: ['', "'", '2'], length: 100 },
        '333oh': { faces: ['U', 'D', 'R', 'L', 'F', 'B'], modifiers: ['', "'", '2'], length: 20 },
        '333bf': { faces: ['U', 'D', 'R', 'L', 'F', 'B'], modifiers: ['', "'", '2'], length: 20 },
        'pyram': { faces: ['U', 'R', 'L', 'B', 'u', 'r', 'l', 'b'], modifiers: ['', "'"], length: 11 },
        'skewb': { faces: ['U', 'R', 'L', 'B'], modifiers: ['', "'"], length: 11 },
        'sq1': null,
        'minx': { faces: ['U', 'R', 'D', 'L', 'F'], modifiers: ['++', '--'], length: 77 },
        'clock': null
    };

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
            average: { time: 7.72, holder: 'Luke Garrett', country: 'US', competition: 'Chicagoland Newcomers 2025' }
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
    const ambientNoise = new Audio('competition_noise.mp3');
    ambientNoise.loop = true;
    ambientNoise.volume = 0.4;

    const state = {
        // Config
        compId: '',
        compName: '',
        compData: null,     // Full competition API data
        wcifData: null,     // WCIF data
        worldRecords: null, // Cached WCA world records
        event: '333',
        numSolves: 5,
        round: 1,
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
                showToast(`Welcome back, ${data.me.name.split(' ')[0]}!`, 'success');
                if ($('#login-modal')) $('#login-modal').style.display = 'none';
                if ($('#signup-modal')) $('#signup-modal').style.display = 'none';

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
                    showToast('No WCA ID linked to this account.', 'info');
                }
            });
        }
    }

    function handleWCALogin(e) {
        if (e) e.preventDefault();
        const url = `${WCA_OAUTH_URL}?client_id=${WCA_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&response_type=token&scope=public`;
        window.location.href = url;
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
    function loadTheme() {
        const saved = localStorage.getItem('sc-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
    }

    function toggleTheme() {
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

        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#${viewName}-view`).classList.add('active');
        state.currentView = viewName;
        
        if (viewName === 'dashboard' && state.soundEnabled) {
            ambientNoise.currentTime = 300; // Start at 5 minute mark
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
    function bindEvents() {
        // Login Modal
        const loginModal = $('#login-modal');

        if ($('#nav-login-btn')) {
            $('#nav-login-btn').addEventListener('click', () => {
                if (loginModal) loginModal.style.display = 'flex';
            });
        }

        if ($('#login-close-btn')) {
            $('#login-close-btn').addEventListener('click', () => {
                if (loginModal) loginModal.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === loginModal) loginModal.style.display = 'none';
        });

        if ($('#wca-login-btn')) {
            $('#wca-login-btn').addEventListener('click', handleWCALogin);
        }

        if ($('#logout-btn')) {
            $('#logout-btn').addEventListener('click', () => {
                localStorage.removeItem('wca_access_token');
                state.userProfile = null;
                
                // Reset Profile button back to Login button
                const profileBtn = $('#nav-profile-btn');
                if (profileBtn) {
                    const loginBtn = profileBtn.cloneNode(true);
                    loginBtn.id = 'nav-login-btn';
                    loginBtn.innerHTML = `Login`;
                    loginBtn.title = "Login";
                    loginBtn.className = "btn btn-primary btn-sm";
                    profileBtn.parentNode.replaceChild(loginBtn, profileBtn);
                    
                    loginBtn.addEventListener('click', () => {
                        if (loginModal) loginModal.style.display = 'flex';
                    });
                }
                
                switchView('home');
                showToast('Logged out successfully', 'success');
            });
        }

        // Theme
        $('#theme-toggle').addEventListener('click', toggleTheme);

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

        initializeAlgorithmsUI = function () {
            if (typeof ALGORITHMS === 'undefined') return;
            const currentEvent = algEventSelect.value;
            const subsets = Object.keys(ALGORITHMS[currentEvent] || {});

            algSubsetContainer.innerHTML = '';
            algSubgroupSelect.style.display = 'none';

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
                $('#algorithms-grid').innerHTML = '<p style="color: var(--clr-text-muted);">No algorithms found for this event.</p>';
            }
        }

        function handleSubsetSelection(event, subset) {
            const data = ALGORITHMS[event][subset];
            if (!data) return;

            if (Array.isArray(data)) {
                algSubgroupSelect.style.display = 'none';
                renderAlgorithms(event, subset, null);
            } else {
                algSubgroupSelect.style.display = 'block';
                algSubgroupSelect.innerHTML = '';
                const subgroups = Object.keys(data);

                subgroups.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = `${subset} ${sub}`;
                    algSubgroupSelect.appendChild(opt);
                });

                // Update listener safely
                algSubgroupSelect.onchange = (e) => {
                    renderAlgorithms(event, subset, e.target.value);
                };

                renderAlgorithms(event, subset, subgroups[0]);
            }
        }

        if (algEventSelect) {
            algEventSelect.addEventListener('change', initializeAlgorithmsUI);
        }

        // Render logic
        function renderAlgorithms(event, subset, subgroup) {
            const grid = $('#algorithms-grid');
            if (!grid || typeof ALGORITHMS === 'undefined') return;

            grid.innerHTML = '';
            let algs = [];

            if (subgroup) {
                algs = ALGORITHMS[event][subset][subgroup] || [];
            } else {
                algs = ALGORITHMS[event][subset] || [];
            }

            algs.forEach(item => {
                const card = document.createElement('div');
                card.className = 'setup-card';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.alignItems = 'center';
                card.style.padding = '1.5rem';
                card.style.textAlign = 'center';

                // Map event to twisty-player puzzle name
                let puzzleName = "3x3x3";
                if (event === "2x2") puzzleName = "2x2x2";
                if (event === "4x4") puzzleName = "4x4x4";
                if (event === "5x5") puzzleName = "5x5x5";
                if (event === "Pyraminx") puzzleName = "pyraminx";
                if (event === "Megaminx") puzzleName = "megaminx";

                card.innerHTML = `
                    <div style="width: 140px; height: 140px; margin-bottom: 1rem; position: relative;">
                        <twisty-player 
                            puzzle="${puzzleName}" 
                            alg="${getInverse(item.alg)}" 
                            visualization="2D" 
                            background="none" 
                            control-panel="none" 
                            viewer-link="none"
                            style="width: 100%; height: 100%;">
                        </twisty-player>
                    </div>
                    <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem; color: var(--clr-text);">${item.name}</h3>
                    <code style="display: block; background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--clr-primary); font-family: var(--font-mono); letter-spacing: 0.5px; width: 100%; overflow-wrap: anywhere;">${item.alg}</code>
                `;
                grid.appendChild(card);
            });
        }

        // ====== PRACTICE TRAINER ======
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

        function getPuzzleName(event) {
            if (event === '2x2') return '2x2x2';
            if (event === '4x4') return '4x4x4';
            if (event === '5x5') return '5x5x5';
            if (event === 'Pyraminx') return 'pyraminx';
            if (event === 'Megaminx') return 'megaminx';
            return '3x3x3';
        }

        function getInverse(alg) {
            if (!alg || alg === 'skip') return '';
            const moves = alg.trim().split(/\s+/);
            return moves.reverse().map(m => {
                if (m.endsWith("'")) return m.slice(0, -1);
                if (m.endsWith('2')) return m;
                return m + "'";
            }).join(' ');
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
            const subgroupVal = algSubgroupSelect.style.display !== 'none' ? algSubgroupSelect.value : null;

            if (!subset) { showToast('Select an algorithm category first', 'error'); return; }

            let algData = ALGORITHMS[event] && ALGORITHMS[event][subset];
            if (!algData) return;
            if (!Array.isArray(algData) && subgroupVal) algData = algData[subgroupVal];
            if (!Array.isArray(algData)) { showToast('Select a subgroup first', 'error'); return; }

            const validAlgs = algData.filter(a => a.alg && a.alg !== 'skip');
            trainerState.algList = validAlgs;
            trainerState.currentEvent = event;

            const label = subgroupVal ? `${subset} ${subgroupVal}` : subset;
            trainerState.currentSetName = `${event} ${label}`;

            // Select all by default
            trainerState.selectedIdxs = new Set(validAlgs.map((_, i) => i));

            renderCaseSelectGrid();
            $('#case-select-title').textContent = `Select Cases — ${trainerState.currentSetName}`;
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
            $('#case-select-count-label').textContent = `${trainerState.selectedIdxs.size} selected`;
        }

        // Start trainer session
        function startTrainerSession() {
            if (trainerState.selectedIdxs.size === 0) {
                showToast('Select at least 1 case', 'error');
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
            $('#trainer-case-count').textContent = `${trainerState.selectedIdxs.size} cases`;

            // Update puzzle type
            const puzzle = getPuzzleName(trainerState.currentEvent);
            $('#trainer-twisty').setAttribute('puzzle', puzzle);
            $('#hint-twisty').setAttribute('puzzle', puzzle);

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

            // Show scramble (inverse of alg)
            const scramble = getInverse(c.alg);
            $('#trainer-scramble').textContent = scramble || '(no scramble)';

            // Show case in twisty-player (show inverse so you see scrambled state)
            const twisty = $('#trainer-twisty');
            twisty.setAttribute('alg', c.alg === 'skip' ? '' : getInverse(c.alg));

            // Reset timer display
            resetTimerDisplay();
        }

        function resetTimerDisplay() {
            $('#trainer-timer-time').textContent = '0.00';
            $('#trainer-timer-time').className = 'trainer-timer-time';
            $('#trainer-timer-status').textContent = 'Press Space to start';
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
            trainerState.timerInterval = setInterval(() => {
                const elapsed = performance.now() - trainerState.startTime;
                timeEl.textContent = formatTimeSec(elapsed);
            }, 30);
        }

        function stopTimer() {
            if (!trainerState.timerRunning) return;
            clearInterval(trainerState.timerInterval);
            trainerState.timerRunning = false;
            const elapsed = performance.now() - trainerState.startTime;
            const timeEl = $('#trainer-timer-time');
            timeEl.textContent = formatTimeSec(elapsed);
            timeEl.className = 'trainer-timer-time';
            $('#trainer-timer-status').textContent = 'Press Space for next case';
            $('#trainer-timer-status').style.color = '';
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
                list.innerHTML = '<div class="trainer-times-empty">No solves yet — start practicing!</div>';
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
            $('#alg-hint-case-name').textContent = c.name;
            $('#alg-hint-alg').textContent = c.alg || '—';
            const hintTwisty = $('#hint-twisty');
            hintTwisty.setAttribute('puzzle', getPuzzleName(trainerState.currentEvent));
            hintTwisty.setAttribute('alg', c.alg === 'skip' ? '' : getInverse(c.alg));
            $('#alg-hint-modal').style.display = 'flex';
        }

        function closeHintModal() {
            $('#alg-hint-modal').style.display = 'none';
        }

        function exitTrainer() {
            trainerState.active = false;
            clearInterval(trainerState.timerInterval);
            trainerState.timerRunning = false;
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
                    $('#trainer-timer-status').textContent = 'Holding...';
                    $('#trainer-timer-status').style.color = 'var(--clr-warning)';
                    
                    if (trainerState.spaceHoldTime > 0) {
                        trainerState.spaceHoldTimeout = setTimeout(() => {
                            trainerState.isReadyToStart = true;
                            $('#trainer-timer-status').textContent = 'Ready!';
                            $('#trainer-timer-status').style.color = 'var(--clr-success)';
                        }, trainerState.spaceHoldTime);
                    } else {
                        trainerState.isReadyToStart = true;
                        $('#trainer-timer-status').textContent = 'Ready!';
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
                    $('#trainer-timer-status').textContent = 'Press Space to start';
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
                $('#trainer-timer-status').textContent = 'Holding...';
                $('#trainer-timer-status').style.color = 'var(--clr-warning)';
                
                if (trainerState.spaceHoldTime > 0) {
                    trainerState.spaceHoldTimeout = setTimeout(() => {
                        trainerState.isReadyToStart = true;
                        $('#trainer-timer-status').textContent = 'Ready!';
                        $('#trainer-timer-status').style.color = 'var(--clr-success)';
                    }, trainerState.spaceHoldTime);
                } else {
                    trainerState.isReadyToStart = true;
                    $('#trainer-timer-status').textContent = 'Ready!';
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
                    $('#trainer-timer-status').textContent = 'Press Space to start';
                    $('#trainer-timer-status').style.color = '';
                }
            }
            trainerState.spaceHeld = false;
            trainerState.isReadyToStart = false;
        }

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

        // Setup form
        $('#setup-form').addEventListener('submit', handleSetupSubmit);

        // Dashboard buttons
        $('#back-to-setup-btn').addEventListener('click', () => { clearSimState(); switchView('setup'); });
        $('#fullscreen-btn').addEventListener('click', toggleFullscreen);

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
        if (!compId) { showToast('Please enter a competition ID', 'error'); return; }

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

            // Fetch WCIF for round/cutoff/time-limit data
            fetchWCIF(compId);

            $('#comp-info-display').style.display = 'block';
            $('#comp-error-display').style.display = 'none';
            showToast(`✅ Found: ${data.short_name || data.name}`, 'success');

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
            if (!res.ok) return;
            const data = await res.json();
            state.wcifData = data;

            // Count actual competitors for this event
            updateEventCompInfo();

        } catch (err) {
            // WCIF not available for all competitions, that's okay
            state.wcifData = null;
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

    function updateEventCompInfo() {
        const infoPanel = $('#event-comp-info');

        if (!state.wcifData) {
            infoPanel.style.display = 'none';
            return;
        }

        // Find the selected event in WCIF
        const eventData = (state.wcifData.events || []).find(e => e.id === state.event);
        if (!eventData) {
            infoPanel.style.display = 'none';
            return;
        }

        const round1 = eventData.rounds && eventData.rounds[0];
        if (!round1) {
            infoPanel.style.display = 'none';
            return;
        }

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

        // Number of rounds for this event
        $('#event-rounds-count').textContent = `${eventData.rounds.length} round${eventData.rounds.length > 1 ? 's' : ''}`;

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

    async function loadWorldRecords() {
        if (!fetchedWorldRecords) {
            $('#records-loading').style.display = 'flex';
            $('#records-table').style.display = 'none';
            try {
                const res = await fetch('https://simulatecubing-default-rtdb.firebaseio.com/records.json');
                const data = await res.json();
                if (data) fetchedWorldRecords = data;
            } catch (err) {
                console.error("Failed to fetch custom world records:", err);
            }
        }
        renderRecordsTable();
        fetchUpcomingCompetitions();
    }

    function renderRecordsTable() {
        // Render the table
        const tbody = $('#records-table-body');
        tbody.innerHTML = '';

        const wcaOrder = [
            '333', '222', '444', '555', '666', '777',
            '333bf', '333fm', '333oh', 'clock', 'minx',
            'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf'
        ];

        wcaOrder.forEach(eventId => {
            const rec = (fetchedWorldRecords && fetchedWorldRecords[eventId]) ? fetchedWorldRecords[eventId] : WORLD_RECORDS[eventId];
            if (!rec || !EVENT_NAMES[eventId]) return;

            const tr = document.createElement('tr');
            tr.className = 'records-row';
            tr.dataset.event = eventId;

            let singleStr, singleHolder, avgStr, avgHolder;

            // Format single
            if (rec.single) {
                if (rec.single.isMulti) {
                    singleStr = rec.single.time;
                } else if (rec.single.isMoves) {
                    singleStr = String(rec.single.time);
                } else {
                    singleStr = formatTime(rec.single.time);
                }
                singleHolder = `${countryFlagImg(rec.single.country)} ${rec.single.holder}`;
            } else {
                singleStr = '—';
                singleHolder = '—';
            }

            // Format average
            if (rec.average) {
                if (rec.average.isMoves) {
                    avgStr = rec.average.time.toFixed(2);
                } else {
                    avgStr = formatTime(rec.average.time);
                }
                avgHolder = `${countryFlagImg(rec.average.country)} ${rec.average.holder}`;
            } else {
                avgStr = '—';
                avgHolder = '—';
            }

            tr.innerHTML = `
                <td class="rec-event">
                    <span class="rec-event-name">${EVENT_NAMES[eventId]}</span>
                </td>
                <td class="rec-time rec-single">${singleStr}</td>
                <td class="rec-holder">${singleHolder}</td>
                <td class="rec-time rec-average">${avgStr}</td>
                <td class="rec-holder">${avgHolder}</td>
                <td class="rec-expand-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></td>
            `;

            tr.addEventListener('click', () => toggleRecordDetail(eventId, tr));
            tbody.appendChild(tr);
        });

        $('#records-loading').style.display = 'none';
        $('#records-table').style.display = 'table';
    }



    async function fetchUpcomingCompetitions() {
        const listContainer = $('#upcoming-comps-list');
        if (!listContainer) return;

        listContainer.innerHTML = '<div class="upcoming-comps-loading"><div class="spinner"></div><span>Loading upcoming competitions...</span></div>';

        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`${WCA_API}/competitions?start=${today}&sort=start_date&per_page=20`);
            if (!res.ok) throw new Error('Failed to fetch');
            const comps = await res.json();

            if (comps.length === 0) {
                listContainer.innerHTML = '<div class="upcoming-comps-empty">No upcoming competitions found.</div>';
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
            listContainer.innerHTML = '<div class="upcoming-comps-empty">Failed to load upcoming competitions.</div>';
        }
    }

    function toggleRecordDetail(eventId, rowEl) {
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

        const rec = (fetchedWorldRecords && fetchedWorldRecords[eventId]) ? fetchedWorldRecords[eventId] : WORLD_RECORDS[eventId];
        if (!rec) return;

        const detailRow = document.createElement('tr');
        detailRow.className = 'record-detail-row';
        detailRow.dataset.event = eventId;

        let singleCard = '';
        if (rec.single) {
            let timeDisplay;
            if (rec.single.isMulti) timeDisplay = rec.single.time;
            else if (rec.single.isMoves) timeDisplay = `${rec.single.time} moves`;
            else timeDisplay = formatTime(rec.single.time);

            singleCard = `
                <div class="record-detail-card record-detail-single">
                    <div class="record-detail-badge">WR SINGLE</div>
                    <div class="record-detail-time">${timeDisplay}</div>
                    <div class="record-detail-holder">
                        <span class="record-detail-flag">${countryFlagImg(rec.single.country, 28)}</span>
                        <span class="record-detail-name">${rec.single.holder}</span>
                    </div>
                    <div class="record-detail-comp">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${rec.single.competition}
                    </div>
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
                    <div class="record-detail-badge avg-badge">WR AVERAGE</div>
                    <div class="record-detail-time">${timeDisplay}</div>
                    <div class="record-detail-holder">
                        <span class="record-detail-flag">${countryFlagImg(rec.average.country, 28)}</span>
                        <span class="record-detail-name">${rec.average.holder}</span>
                    </div>
                    <div class="record-detail-comp">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${rec.average.competition}
                    </div>
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
        if (!wcaId) { showToast('Please enter a WCA ID', 'error'); return; }

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
                    showToast(`✅ Found: ${data.person.name}`, 'success');
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
        if (!wcaId) { showToast('Please enter a WCA ID', 'error'); return; }

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
                        <div class="upcoming-comp-date">View on WCA →</div>
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
            prTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--clr-text-muted);">No official results yet.</td></tr>';
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
            hint.textContent = isMo3 ? 'Mean of 3' : 'Average of 5';
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
                    showToast('⚠️ Could not load your WCA profile. Please try again.', 'error');
                    return;
                }
            } else {
                showToast('⚠️ Please enter or look up a WCA ID first', 'error');
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
                showToast(`⚠️ You are not registered for ${EVENT_NAMES[state.event] || state.event} at this competition!`, 'error');
                return;
            }
        }
        state.round = parseInt($('#round-select').value);
        state.goalTime = $('#goal-time').value ? parseFloat($('#goal-time').value) : null;
        state.soundEnabled = $('#sound-toggle').checked;
        state.liveMode = $('#live-mode-toggle')?.checked || false;

        // Determine numSolves from event
        state.numSolves = MEAN_OF_3_EVENTS.includes(state.event) ? 3 : 5;

        // Use competition name if available, otherwise use ID
        if (!state.compName && state.compId) {
            state.compName = state.compId;
        } else if (!state.compName) {
            state.compName = 'Custom Competition';
        }

        // Ensure we have a valid numCompetitors
        if (!state.numCompetitors || state.numCompetitors < 2) {
            state.numCompetitors = 30;
        }

        startSimulation();
    }

    // ========== SIMULATION ==========
    function startSimulation() {
        state.currentSolve = 0;
        state.solves = [];
        state.selectedPenalty = 'none';

        // Generate scrambles
        state.scrambles = [];
        for (let i = 0; i < state.numSolves; i++) {
            state.scrambles.push(generateScramble(state.event));
        }

        // Generate competitors
        generateCompetitors();

        // Update UI
        updateDashboardHeader();
        renderScorecardTemplate();
        updateScrambleDisplay();
        updateGoalTracker();
        renderLeaderboard();
        resetTimer();

        switchView('dashboard');
        showToast(`🏁 Simulation started! ${EVENT_NAMES[state.event]} - ${ROUND_NAMES[state.round]}`, 'info');
        
        if (state.rtInterval) clearInterval(state.rtInterval);
        state.rtInterval = setInterval(updateRealTimeSimulation, 500);

        saveSimState();
    }

    // ========== SCRAMBLE GENERATION ==========
    function generateScramble(event) {
        if (event === 'sq1') return generateSQ1Scramble();
        if (event === 'clock') return generateClockScramble();

        const config = MOVES[event] || MOVES['333'];
        const moves = [];
        let lastFace = '';
        let secondLastFace = '';

        for (let i = 0; i < config.length; i++) {
            let face;
            do {
                face = config.faces[Math.floor(Math.random() * config.faces.length)];
            } while (
                face === lastFace ||
                (face === secondLastFace && isOppositeFace(face, lastFace))
            );

            const modifier = config.modifiers[Math.floor(Math.random() * config.modifiers.length)];
            moves.push(face + modifier);

            secondLastFace = lastFace;
            lastFace = face;
        }

        return moves.join(' ');
    }

    function isOppositeFace(a, b) {
        const opposites = { 'U': 'D', 'D': 'U', 'R': 'L', 'L': 'R', 'F': 'B', 'B': 'F' };
        return opposites[a] === b;
    }

    function generateSQ1Scramble() {
        const moves = [];
        for (let i = 0; i < 13; i++) {
            const top = Math.floor(Math.random() * 12) - 5;
            const bot = Math.floor(Math.random() * 12) - 5;
            moves.push(`(${top},${bot})`);
            if (i < 12) moves.push('/');
        }
        return moves.join(' ');
    }

    function generateClockScramble() {
        const pins = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
        const moves = [];
        pins.forEach(pin => {
            const val = Math.floor(Math.random() * 12) - 5;
            moves.push(`${pin}${val >= 0 ? val + '+' : Math.abs(val) + '-'}`);
        });
        moves.push('y2');
        pins.forEach(pin => {
            const val = Math.floor(Math.random() * 12) - 5;
            moves.push(`${pin}${val >= 0 ? val + '+' : Math.abs(val) + '-'}`);
        });
        return moves.join(' ');
    }

    // ========== COMPETITOR GENERATION ==========
    function generateCompetitors() {
        state.competitors = [];

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

            for (const p of toAdd) {
                let prAvg = null;
                let prSingle = null;
                if (p.personalBests) {
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
                    statusUntil: Date.now() + Math.random() * 30000
                });
            }

            state.numCompetitors = state.competitors.length + 1;
        } else {
            const usedNames = new Set();
            for (let i = 0; i < state.numCompetitors - 1; i++) {
                let name;
                do {
                    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
                    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
                    name = `${first} ${last}`;
                } while (usedNames.has(name));
                usedNames.add(name);

                const spread = state.playerAvg * 0.6;
                const compAvg = state.playerAvg + (Math.random() * spread * 2 - spread);
                const clampedAvg = Math.max(compAvg, state.playerAvg * 0.3);

                // Don't generate solves yet — they are added progressively
                state.competitors.push({
                    name,
                    wcaId: null,
                    country: '',
                    prSingle: null,
                    prAvg: clampedAvg,
                    avg: clampedAvg,
                    solves: [],
                    best: Infinity,
                    average: Infinity,
                    status: 'waiting',
                    statusUntil: Date.now() + Math.random() * 30000
                });
            }
        }
    }

    // Update the real-time simulation state for competitors
    function updateRealTimeSimulation() {
        if (!state.competitors || state.competitors.length === 0) return;

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
                        comp.statusUntil = now + Math.random() * 30000;
                    }
                    changed = true;
                }
            }
        });

        if (changed) {
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
        state.timerState = 'stopped';
        const input = $('#manual-time-input');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 50);
        }
        $('#submit-solve-btn').disabled = false;
        selectPenalty('none');
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
            showToast('Please enter a valid time', 'error');
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
                showToast('⏳ Waiting for next attempt...', 'info');
                setTimeout(() => showToast('✅ Ready for next attempt!', 'success'), 5000 + Math.random() * 10000);
            }
        }
    }

    // ========== UI UPDATES ==========
    function updateDashboardHeader() {
        $('#dash-comp-name').textContent = state.compName;
        $('#dash-event-badge').textContent = EVENT_NAMES[state.event];
        $('#dash-round-badge').textContent = ROUND_NAMES[state.round];
        updateDashboardBadges();
    }

    function updateDashboardBadges() {
        const current = Math.min(state.currentSolve + 1, state.numSolves);
        const solBadge = $('#dash-solve-badge');
        if (solBadge) solBadge.textContent = `Solve ${current}/${state.numSolves}`;
        const scName = $('#scorecard-name');
        if (scName) scName.textContent = state.playerName;
        const scEvent = $('#scorecard-event');
        if (scEvent) scEvent.textContent = `${EVENT_NAMES[state.event]} — ${ROUND_NAMES[state.round]}`;
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
                    : '<span class="scramble-hidden">Hidden</span>';
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

        const player = document.createElement('twisty-player');
        player.setAttribute('puzzle', puzzleType);
        player.setAttribute('experimental-setup-alg', scramble);
        player.setAttribute('visualization', '2D');
        player.setAttribute('background', 'none');
        player.setAttribute('control-panel', 'none');
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
            $('#goal-status').textContent = 'Waiting...';
            $('#goal-status').className = 'goal-val goal-status';
            updateGoalRing(0);
            return;
        }

        const validSolves = state.solves.filter(s => s.penalty !== 'dnf');
        if (validSolves.length === 0) {
            $('#goal-current-avg').textContent = 'DNF';
            $('#goal-status').textContent = 'All DNF';
            $('#goal-status').className = 'goal-val goal-status behind';
            updateGoalRing(0);
            return;
        }

        const currentAvg = validSolves.reduce((sum, s) => sum + s.result, 0) / validSolves.length;
        $('#goal-current-avg').textContent = formatTime(currentAvg);

        const progress = Math.min(100, Math.max(0, (1 - (currentAvg - goalTarget) / goalTarget) * 100));
        updateGoalRing(Math.round(progress));

        if (currentAvg <= goalTarget) {
            $('#goal-status').textContent = '✅ On Track!';
            $('#goal-status').className = 'goal-val goal-status on-track';
        } else {
            const diff = (currentAvg - goalTarget).toFixed(2);
            $('#goal-status').textContent = `+${diff}s behind`;
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
                statusBadge = '<span class="status-badge user">You</span>';
            } else {
                if (comp.status === 'solving') {
                    statusBadge = '<span class="status-badge solving">Solving</span>';
                } else if (comp.status === 'waiting') {
                    statusBadge = '<span class="status-badge waiting">Waiting</span>';
                } else if (comp.status === 'finished') {
                    statusBadge = '<span class="status-badge finished">Finished</span>';
                }
            }

            tr.innerHTML = `
                <td class="lb-rank">${medal || rank}</td>
                <td class="lb-name">${flagHtml} ${comp.name}${comp.isPlayer ? ' (You)' : ''}</td>
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

        let message = '';
        if (placement === 1) {
            message = '🏆 INCREDIBLE! You won the round!';
            $('#next-round-btn').style.display = state.round < 4 ? 'inline-flex' : 'none';
        } else if (placement <= 3) {
            message = '🏅 Amazing! Podium finish!';
            $('#next-round-btn').style.display = state.round < 4 ? 'inline-flex' : 'none';
        } else {
            // Check if would advance (top 75% for R1, top 50% for R2, etc)
            const advancementRates = { 1: 0.75, 2: 0.5, 3: 0.33, 4: 0 };
            const advRate = advancementRates[state.round] || 0;
            const advCount = Math.ceil(total * advRate);
            const advanced = advCount > 0 && placement <= advCount;

            message = `You placed ${placement}${getOrdinal(placement)} out of ${total} competitors.`;
            if (advanced && state.round < 4) {
                message = `🎉 Congratulations! You advanced to ${ROUND_NAMES[state.round + 1]}!\n` + message;
                $('#next-round-btn').style.display = 'inline-flex';
            } else {
                $('#next-round-btn').style.display = 'none';
            }
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
        $('#round-end-title').textContent = placement <= 3 ? '🏆 Incredible Performance!' : 'Round Complete!';
        $('#round-end-overlay').style.display = 'flex';

        if (placement <= 3) spawnConfetti();
        saveToHistory(avg, placement, total, best);
        saveSimState();
    }

    function startNextRound() {
        state.round = Math.min(state.round + 1, 4);

        state.competitors.sort((a, b) => {
            if (a.average === Infinity && b.average === Infinity) return 0;
            if (a.average === Infinity) return 1;
            if (b.average === Infinity) return -1;
            return a.average - b.average;
        });

        const advCount = Math.ceil(state.numCompetitors * 0.5);
        state.competitors = state.competitors.slice(0, Math.max(advCount - 1, 1));
        state.numCompetitors = state.competitors.length + 1;

        state.competitors.forEach(comp => {
            comp.solves = [];
            comp.best = Infinity;
            comp.average = Infinity;
        });

        state.currentSolve = 0;
        state.solves = [];
        state.scrambles = [];
        for (let i = 0; i < state.numSolves; i++) {
            state.scrambles.push(generateScramble(state.event));
        }

        $('#round-end-overlay').style.display = 'none';
        updateDashboardHeader();
        renderScorecardTemplate();
        updateScrambleDisplay();
        updateGoalTracker();
        renderLeaderboard();
        resetTimer();

        showToast(`🏁 ${ROUND_NAMES[state.round]} started! ${state.numCompetitors} competitors remaining.`, 'info');
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
            roundName: ROUND_NAMES[state.round],
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
        if (confirm('Clear all simulation history?')) {
            state.history = [];
            localStorage.removeItem('sc-history');
            renderHistory();
            showToast('History cleared', 'info');
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

        let text = `SimulateCubing Results\n━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `Competition: ${state.compName}\nEvent: ${EVENT_NAMES[state.event]} | ${ROUND_NAMES[state.round]}\n`;
        text += `Player: ${state.playerName} (${state.playerWcaId})\n━━━━━━━━━━━━━━━━━━━━━\n`;

        state.solves.forEach((solve, i) => {
            const result = solve.penalty === 'dnf' ? 'DNF' :
                (solve.penalty === '+2' ? formatTime(solve.result) + ' (+2)' : formatTime(solve.result));
            text += `Solve ${i + 1}: ${result}\n`;
        });

        text += `━━━━━━━━━━━━━━━━━━━━━\nAverage: ${avg === Infinity ? 'DNF' : formatTime(avg)}\n`;
        text += `Best: ${best === Infinity ? 'DNF' : formatTime(best)}\n`;

        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Results copied to clipboard!', 'success');
        }).catch(() => { showToast('Failed to copy', 'error'); });
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
            numCompetitors: state.numCompetitors,
            playerName: state.playerName,
            playerWcaId: state.playerWcaId,
            playerAvg: state.playerAvg,
            goalTime: state.goalTime,
            timeLimit: state.timeLimit,
            cutoff: state.cutoff,
            soundEnabled: state.soundEnabled,
            liveMode: state.liveMode,
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
                compName: restored.compName || 'Custom Competition',
                event: restored.event || '333',
                numSolves: restored.numSolves || 5,
                round: restored.round || 1,
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
            showToast('🔄 Simulation restored!', 'info');
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
    };

    // ----- Scramble generator -----
    function generateBattleScramble(event) {
        const suf = ["", "'", "2"];
        // Build a pool of moves and generate scramble avoiding same-face consecutive moves
        function buildPool(faces) {
            return faces.flatMap(f => suf.map(s => f + s));
        }
        function buildMoves(pool, length) {
            const result = [];
            let lastFace = '', secondLastFace = '';
            for (let i = 0; i < length; i++) {
                let move, face;
                let attempts = 0;
                do {
                    move = pool[Math.floor(Math.random() * pool.length)];
                    // Face is the letter(s) before any suffix
                    face = move.replace(/['2]$/,'').replace(/w$/,'');
                    attempts++;
                    if (attempts > 200) break;
                } while (face === lastFace || face === secondLastFace);
                secondLastFace = lastFace;
                lastFace = face;
                result.push(move);
            }
            return result.join(' ');
        }

        // ---- 2x2 ----
        if (event === '2x2') return buildMoves(buildPool(['U','R','F']), 10);

        // ---- 3x3 / OH ----
        if (event === '3x3' || event === 'oh') return buildMoves(buildPool(['U','D','R','L','F','B']), 20);

        // ---- 4x4 — outer + Uw Rw Fw Bw Lw Dw (no inner Fw2/Bw2 equivalent redundancy) ----
        if (event === '4x4') {
            const outer = buildPool(['U','D','R','L','F','B']);
            const wide  = buildPool(['Uw','Rw','Fw','Bw','Lw','Dw']);
            return buildMoves([...outer, ...wide], 40);
        }

        // ---- 5x5 — outer + 2-wide + 3-wide ----
        if (event === '5x5') {
            const outer  = buildPool(['U','D','R','L','F','B']);
            const wide2  = buildPool(['Uw','Rw','Fw','Bw','Lw','Dw']);
            const wide3  = buildPool(['3Uw','3Rw','3Fw','3Bw','3Lw','3Dw']);
            return buildMoves([...outer, ...wide2, ...wide3], 60);
        }

        // ---- 6x6 — outer + 2-wide + 3-wide ----
        if (event === '6x6') {
            const outer  = buildPool(['U','D','R','L','F','B']);
            const wide2  = buildPool(['Uw','Rw','Fw','Bw','Lw','Dw']);
            const wide3  = buildPool(['3Uw','3Rw','3Fw','3Bw','3Lw','3Dw']);
            return buildMoves([...outer, ...wide2, ...wide3], 80);
        }

        // ---- 7x7 — outer + 2-wide + 3-wide + 4-wide ----
        if (event === '7x7') {
            const outer  = buildPool(['U','D','R','L','F','B']);
            const wide2  = buildPool(['Uw','Rw','Fw','Bw','Lw','Dw']);
            const wide3  = buildPool(['3Uw','3Rw','3Fw','3Bw','3Lw','3Dw']);
            const wide4  = buildPool(['4Uw','4Rw','4Fw','4Bw','4Lw','4Dw']);
            return buildMoves([...outer, ...wide2, ...wide3, ...wide4], 100);
        }

        // ---- Clock ----
        if (event === 'clock') {
            const pins = ['d', 'U', 'R', 'dR'];
            const turns = [1,2,3,4,5,6,-1,-2,-3,-4,-5,-6];
            const sides = ['U','D','L','R','UL','UR','DL','DR','ALL'];
            let moves = [];
            for (let i = 0; i < 9; i++) {
                const face = sides[i % sides.length];
                const t = turns[Math.floor(Math.random() * turns.length)];
                moves.push(`${face}${t > 0 ? '+' : ''}${t}`);
            }
            return moves.join(' ');
        }

        // ---- Megaminx ----
        if (event === 'mega') {
            const megaMoves = [];
            const dirs = ['+', '-'];
            for (let i = 0; i < 70; i++) {
                const face = ['U','R','D','L','BL','BR'][Math.floor(Math.random()*6)];
                const d = dirs[Math.floor(Math.random()*2)];
                megaMoves.push(`${face}${d}${d}`);
            }
            return megaMoves.join(' ');
        }

        // ---- Pyraminx ----
        if (event === 'pyra') {
            const tips  = buildPool(['u','l','r','b']);
            const faces = buildPool(['U','L','R','B']);
            return buildMoves(faces, 9) + ' ' + tips.slice(0,4).join(' ');
        }

        // ---- Skewb ----
        if (event === 'skewb') return buildMoves(buildPool(['U','R','L','B']), 9);

        // ---- Square-1 ----
        if (event === 'sq1') {
            let moves = [];
            for (let i = 0; i < 11; i++) {
                const u = Math.floor(Math.random() * 12) - 6;
                const d = Math.floor(Math.random() * 12) - 6;
                moves.push(`(${u},${d})`);
                if (i < 10) moves.push('/');
            }
            return moves.join(' ');
        }

        // ---- fallback 3x3 ----
        return buildMoves(buildPool(['U','D','R','L','F','B']), 20);
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
            if (state.currentView === 'battle' && !battleState.currentRoomId) loadBattleLobby();
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
            if (state.currentView === 'battle' && battleState.currentRoomId === roomId) {
                const data = await fbGet(`${BATTLE_PATH}/${roomId}`);
                if (!data) { leaveBattleRoom(); return; }
                battleState.currentRoomData = data;
                renderBattleRoomView(data);
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
                <p>No rooms found. <button class="btn btn-primary" style="margin-left:8px;" onclick="document.getElementById('battle-create-room-btn').click()">Create one!</button></p>
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
                    <span>${room.isPrivate ? 'Private Room' : 'Public Room'}</span>
                </div>
                <div class="battle-room-card-event" style="background:${evtInfo.color}22;color:${evtInfo.color};border-color:${evtInfo.color}44">${evtInfo.label}</div>
                <div class="battle-room-card-name">${room.name || 'Unnamed Room'}</div>
                <div class="battle-room-card-host">Host: ${room.hostName || 'Unknown'}</div>
                <div class="battle-room-card-footer">
                    <div class="battle-room-card-players">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        ${memberCount} player${memberCount !== 1 ? 's' : ''}
                    </div>
                    <div class="battle-room-card-status battle-status--waiting">Active</div>
                </div>
                <button class="battle-join-btn" data-room-id="${room.id}">
                    ${room.isPrivate ? '🔒 Join' : 'Join →'}
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
            $('#battle-password-group').style.display = 'none';
            $('#battle-vis-public').classList.add('active');
            $('#battle-vis-private').classList.remove('active');
            $('#battle-create-modal').style.display = 'flex';
        });
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
            const name = $('#battle-room-name-input').value.trim();
            if (!name) { showToast('Please enter a room name', 'error'); return; }
            const isPrivate = $('#battle-vis-private').classList.contains('active');
            const password = $('#battle-room-password').value.trim();
            if (isPrivate && !password) { showToast('Please set a password', 'error'); return; }

            const userId = getBattleUserId();
            const userName = getBattleUserName();
            const now = Date.now();
            const initialEvent = '3x3';
            const scramble = generateBattleScramble(initialEvent);

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

            $('#battle-create-confirm').disabled = true;
            $('#battle-create-confirm').textContent = 'Creating...';
            const result = await fbPush(BATTLE_PATH, roomData);
            $('#battle-create-confirm').disabled = false;
            $('#battle-create-confirm').textContent = 'Create Room';

            if (!result || !result.name) { showToast('Failed to create room. Try again.', 'error'); return; }
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
            if (!room) { showToast('Room not found', 'error'); return; }
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

        // In-room: event chips (host only)
        $$('.battle-event-chip').forEach(chip => {
            chip.addEventListener('click', async () => {
                if (!battleState.isHost) return;
                const newEvent = chip.dataset.event;
                const roomId = battleState.currentRoomId;
                if (!roomId) return;
                const scramble = generateBattleScramble(newEvent);
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
            const scramble = generateBattleScramble(event);
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
        if (!roomData) { showToast('Could not join room', 'error'); return; }
        await enterBattleRoom(roomId, roomData);
    }

    // ----- Enter room view -----
    async function enterBattleRoom(roomId, roomData) {
        const userId = getBattleUserId();
        battleState.currentRoomId = roomId;
        battleState.isHost = (roomData.host === userId);
        battleState.currentRoomData = roomData;

        // Reset timer
        clearInterval(battleState.timerInterval);
        battleState.timerRunning = false;
        battleState.timerArmed = false;
        const timeEl = $('#battle-timer-time');
        if (timeEl) { timeEl.textContent = '0.00'; timeEl.className = 'battle-timer-time'; }
        if ($('#battle-timer-status')) { $('#battle-timer-status').textContent = 'Hold Space to start timer'; $('#battle-timer-status').style.color = ''; }

        // Show/hide room UI
        if ($('#battle-lobby')) $('#battle-lobby').style.display = 'none';
        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';

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
            scrambleEl.textContent = currentScramble || 'Waiting for scramble...';
        }
        const twisty = $('#battle-twisty');
        if (twisty && currentScramble) {
            twisty.setAttribute('puzzle', evtInfo.puzzle);
            twisty.setAttribute('alg', currentScramble);
        }

        // Auto-reset timer when scramble index changes
        if (currentIdx !== battleState.lastSeenScrambleIndex) {
            battleState.lastSeenScrambleIndex = currentIdx;
            clearInterval(battleState.timerInterval);
            battleState.timerRunning = false;
            const timeEl = $('#battle-timer-time');
            if (timeEl) { timeEl.textContent = '0.00'; timeEl.className = 'battle-timer-time'; }
            const statusEl = $('#battle-timer-status');
            if (statusEl) { statusEl.textContent = 'Hold Space to start timer'; statusEl.style.color = ''; }
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
        if (playerIds.length === 0) { tableWrap.innerHTML = '<div class="battle-scores-empty">No players yet</div>'; return; }

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
            html += `<tr><td colspan="${playerIds.length + 1}" class="bct-empty">No solves yet — solve the scramble!</td></tr>`;
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

        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';
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
                    showToast('Invalid time format. Use digits: 1234 = 12.34s', 'error');
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
            if (statusEl) { statusEl.textContent = 'Holding...'; statusEl.style.color = '#F1C40F'; }
            battleState.spaceHoldTimeout = setTimeout(() => {
                battleState.timerArmed = true;
                if (statusEl) { statusEl.textContent = 'Release to start!'; statusEl.style.color = '#2ECC71'; }
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
                if (statusEl) { statusEl.textContent = 'Hold Space to start timer'; statusEl.style.color = ''; }
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
            if (statusEl) { statusEl.textContent = 'Holding...'; statusEl.style.color = '#F1C40F'; }
            battleState.spaceHoldTimeout = setTimeout(() => {
                battleState.timerArmed = true;
                if (statusEl) { statusEl.textContent = 'Release to start!'; statusEl.style.color = '#2ECC71'; }
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
                if (statusEl) { statusEl.textContent = 'Hold Space/Touch to start timer'; statusEl.style.color = ''; }
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
        showToast(`Solve recorded: ${battleFormatTime(elapsedMs)}`, 'success');
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
})();
