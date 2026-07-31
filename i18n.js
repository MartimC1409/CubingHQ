/* ============================================================
   CubingHQ — Internationalization (English / Português)
   ------------------------------------------------------------
   Lightweight i18n with two mechanisms:
     - Static HTML: elements marked with data-i18n / data-i18n-html /
       data-i18n-placeholder / data-i18n-title / data-i18n-aria are
       (re)translated on load and whenever the language changes.
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

            // ----- Smart-cube solve analysis -----
            'analysis.title': 'Solve breakdown',
            'analysis.cross': 'CROSS',
            'analysis.f2l': 'F2L',
            'analysis.slot': 'SLOT',
            'analysis.moves': 'moves',
            'analysis.movesShort': 'm',
            'analysis.tps': 'TPS',
            'analysis.optimal': 'Optimal',
            'analysis.fumble': 'Fumble',
            'analysis.blunder': 'Blunder',
            'analysis.partial': 'Solve did not finish — showing what was tracked.',

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

            'battle.createModalTitle': 'Create Battle Room',
            'battle.roomName': 'Room Name',
            'battle.roomPassword': 'Room Password',
            'battle.wrongPassword': 'Incorrect password. Try again.',

            'home.liveBadge': 'LIVE',

            'algs.copy': 'Copy',
            'algs.practice': 'Practice',
            'aria.copyAlg': 'Copy algorithm for {name}',
            'battle.lobbyTitle': 'Battle Lobby',
            'battle.refresh': 'Refresh',

            'comps.headA': 'Discover',
            'comps.searchPast': 'Search Past Competitions',
            'comps.searchUpcoming': 'Search Upcoming Registrations',
            'footer.about': '<strong>CubingHQ</strong> — an unofficial fan project, not affiliated with the <a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener noreferrer">WCA</a>.',
            'footer.credits': 'Algorithms sourced from <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">SpeedCubeDB</a> · Scrambles &amp; puzzle rendering by <a href="https://js.cubing.net" target="_blank" rel="noopener noreferrer">cubing.js</a> · Inspired by <a href="https://cstimer.net" target="_blank" rel="noopener noreferrer">csTimer</a>.',
            'history.empty': 'No simulation history yet.<br>Complete a round to see results here.',
            'setup.headA': 'Practice Like It\'s',
            'setup.startSim': 'Start Simulation',
            'stats.headA': 'Official WCA',
            'stats.headB': 'Profile',

            'algs.caseN': '{n} case',
            'algs.casesN': '{n} cases',
            'algs.nSelected': '{n} selected',
            'algs.ready': 'Ready!',

            // ----- Timer dialogs & voice cues -----
            'alert.importBad': 'Invalid file: missing sessions data.',
            'alert.importOk': 'Import successful!',
            'alert.importParse': 'Failed to parse JSON:',
            'alert.lastSession': 'Cannot delete the only session.',
            'confirm.clearSolves': 'Clear all {n} solves in "{name}"?',
            'confirm.deleteSession': 'Delete session "{name}"? This will remove all its solves.',
            'confirm.replaceData': 'Replace all current data with imported data?',
            'prompt.renameSession': 'Rename session:',
            'prompt.sessionName': 'Session name:',
            'timer.deleteSession': 'Delete',
            'timer.newSession': 'New session',
            'timer.sessionN': 'Session {n}',
            'title.changePenalty': 'Click to change penalty',
            'title.editTime': 'Click to edit time (centiseconds)',
            'voice.12s': '12 seconds',
            'voice.8s': '8 seconds',

            // ----- Toast messages -----
            'toast.algCopied': 'Algorithm copied',
            'toast.badTimeFormat': 'Invalid time format. Use digits: 1234 = 12.34s',
            'toast.copyFailed': 'Failed to copy',
            'toast.duplicateMsg': 'That message was just sent',
            'toast.fetchingPrs': 'Fetching historical PRs ({n})…',
            'toast.found': 'Found',
            'toast.generatingScrambles': 'Generating official scrambles…',
            'toast.historyCleared': 'History cleared',
            'toast.invalidTime': 'Please enter a valid time',
            'toast.loggedOut': 'Logged out successfully',
            'toast.lookupFirst': 'Please enter or look up a WCA ID first',
            'toast.needCompId': 'Please enter a competition ID',
            'toast.needPassword': 'Please set a password',
            'toast.needWcaId': 'Please enter a WCA ID',
            'toast.noWcaLinked': 'No WCA ID linked to this account.',
            'toast.notRegistered': 'You are not registered for {event} at this competition!',
            'toast.pickCategory': 'Select an algorithm category first',
            'toast.pickOneCase': 'Select at least 1 case',
            'toast.pickSubgroup': 'Select a subgroup first',
            'toast.profileFailed': 'Could not load your WCA profile. Please try again.',
            'toast.readyNext': 'Ready for next attempt!',
            'toast.resultsCopied': 'Results copied to clipboard!',
            'toast.roomCooldown': 'Please wait {n}s before creating another room',
            'toast.roomCreateFailed': 'Failed to create room. Try again.',
            'toast.roomJoinFailed': 'Could not join room',
            'toast.roomNameLong': 'Room name can be at most {n} characters',
            'toast.roomNameShort': 'Room name needs at least {n} characters',
            'toast.roomNotFound': 'Room not found',
            'toast.roundStarted': '{round} started! {n} competitors remaining.',
            'toast.simRestored': 'Simulation restored!',
            'toast.simStarted': 'Simulation started!',
            'toast.slowDown': 'Slow down a moment',
            'toast.solveRecorded': 'Solve recorded',
            'toast.waitingNext': 'Waiting for next attempt...',
            'toast.welcomeBack': 'Welcome back, {name}!',

            // ----- Battle view (dynamic) -----
            'battle.active': 'Active',
            'battle.createOne': 'Create one!',
            'battle.createRoom': 'Create Room',
            'battle.creating': 'Creating...',
            'battle.holdSpace': 'Hold Space to start timer',
            'battle.holding': 'Holding...',
            'battle.host': 'Host',
            'battle.join': 'Join',
            'battle.liveLower': 'live',
            'battle.noPlayers': 'No players yet',
            'battle.noRooms': 'No rooms found.',
            'battle.noSolvesTable': 'No solves yet — solve the scramble!',
            'battle.offline': 'offline',
            'battle.player': '{n} player',
            'battle.players': '{n} players',
            'battle.privateRoom': 'Private Room',
            'battle.publicRoom': 'Public Room',
            'battle.release': 'Release to start!',
            'battle.unknown': 'Unknown',
            'battle.unnamedRoom': 'Unnamed Room',

            // ----- Algorithms & trainer (dynamic) -----
            'algs.no2d': 'No 2D preview for this notation',
            'algs.noMatches': 'No cases match your search.',
            'algs.noScramble': '(no scramble)',
            'algs.noneForEvent': 'No algorithms found for this event.',
            'algs.pressSpaceNext': 'Press Space for next case',

            // ----- Competitions (dynamic) -----
            'comps.loadFailed': 'Failed to load upcoming competitions.',
            'comps.none': 'No upcoming competitions found.',
            'comps.viewOnWca': 'View on WCA →',

            // ----- Comp sim (dynamic) -----
            'sim.customComp': 'Custom Competition',
            'sim.hidden': 'Hidden',
            'sim.spaceHint': 'Hold Space (or tap) to start · tap again to stop',
            'sim.stopped': 'STOPPED',
            'sim.submitHint': 'Space to submit · or set +2 / DNF first',

            // ----- Goal tracker -----
            'goal.allDnf': 'All DNF',
            'goal.behind': '+{n}s behind',
            'goal.onTrack': 'On Track!',

            // ----- Leaderboard status -----
            'lb.finished': 'Finished',
            'lb.solving': 'Solving',
            'lb.waiting': 'Waiting',

            // ----- Round end -----
            'end.greatPerf': 'Incredible Performance!',
            'end.podium': 'Amazing! Podium finish!',
            'end.won': 'INCREDIBLE! You won the round!',

            // ----- Round names -----
            'round.n': 'Round {n}',

            // ----- Confirmations -----
            'confirm.clearHistory': 'Clear all simulation history?',

            // ----- Statistics (dynamic) -----
            'stats.noResults': 'No official results yet.',

            // ----- Tooltips (dynamic) -----
            'title.muteNoiseOn': 'Mute competition noise',
            'title.unmuteNoise': 'Unmute competition noise',

            // ----- Accessible labels (dynamic) -----
            'aria.algSet': 'Algorithm set',

            // ----- Shared labels -----
            'common.all': 'All',
            'common.average': 'Average',
            'common.best': 'Best',
            'common.cancel': 'Cancel',
            'common.clear': 'Clear',
            'common.clearAll': 'Clear All',
            'common.competitions': 'Competitions',
            'common.competitionsCaps': 'COMPETITIONS',
            'common.competitors': 'Competitors',
            'common.count': 'Count',
            'common.event': 'Event',
            'common.events': 'Events',
            'common.mean': 'Mean',
            'common.name': 'Name',
            'common.password': 'Password',
            'common.profile': 'Profile',
            'common.result': 'Result',
            'common.rounds': 'Rounds',
            'common.scramble': 'Scramble',
            'common.scrambleCaps': 'SCRAMBLE',
            'common.search': 'Search',
            'common.send': 'Send',
            'common.single': 'Single',
            'common.skipToContent': 'Skip to main content',
            'common.status': 'Status',
            'common.time': 'Time',
            'common.times': 'Times',
            'common.visibility': 'Visibility',
            'common.worst': 'Worst',

            // ----- Comp sim — setup -----
            'setup.ao5': 'Average of 5',
            'setup.compNoise': 'Competition Noise',
            'setup.competition': 'Competition',
            'setup.competitionDay': 'Competition Day',
            'setup.competitionId': 'Competition ID',
            'setup.competitionIdHint': 'The ID from the WCA competition URL',
            'setup.competitionNotFound': 'Competition not found',
            'setup.cutoff': 'Cutoff',
            'setup.eventRound': 'Event & Round',
            'setup.fetchingComp': 'Fetching competition data...',
            'setup.fetchingProfile': 'Fetching WCA profile...',
            'setup.goalAverage': 'Goal Average (sec)',
            'setup.goalHint': 'What you\'re aiming for today',
            'setup.personalRecords': 'Personal Records',
            'setup.selectEvent': 'Select Event',
            'setup.simSettings': 'Simulation Settings',
            'setup.startingRound': 'Starting Round',
            'setup.timeLimit': 'Time Limit',
            'setup.wcaId': 'WCA ID',
            'setup.wcaIdHint': 'Your World Cube Association identifier',
            'setup.wcaIdNotFound': 'WCA ID not found',
            'setup.wcaIdNotFoundDot': 'WCA ID not found.',
            'setup.yourProfile': 'Your Profile',

            // ----- Round names -----
            'round.final': 'Final',
            'round.r1': 'Round 1',
            'round.r2': 'Round 2',
            'round.semi': 'Semi-Final',

            // ----- Comp sim — dashboard -----
            'dash.bestSingle': 'Best Single',
            'dash.colors': '🎨 Colors',
            'dash.compName': 'Competition Name',
            'dash.copyResults': '📋 Copy Results',
            'dash.current': 'Current',
            'dash.enterTime': '⌨️ Enter Time',
            'dash.goalTracker': '🎯 Goal Tracker',
            'dash.history': '📜 Simulation History',
            'dash.input': 'INPUT',
            'dash.leaderboard': '🏆 Leaderboard',
            'dash.newSim': 'New Simulation',
            'dash.nextRound': 'Next Round →',
            'dash.penalty': 'Pen',
            'dash.placement': 'Placement',
            'dash.prAvg': 'PR Avg',
            'dash.pressStart': 'Press Start to generate scramble...',
            'dash.progress': 'Progress',
            'dash.roundComplete': 'Round Complete!',
            'dash.scorecard': '📝 Scorecard',
            'dash.scramble': '📋 Scramble',
            'dash.solve15': 'Solve 1/5',
            'dash.submitSolve': 'Submit Solve',
            'dash.target': 'Target',
            'dash.typeHint': 'Type numbers (e.g. 954 for 9.54s) and press Enter',
            'dash.waiting': 'Waiting...',
            'dash.yourAverage': 'Your Average',

            // ----- Statistics view -----
            'stats.bronze': 'Bronze',
            'stats.caps': 'STATISTICS',
            'stats.gold': 'Gold',
            'stats.nationalRank': 'National Rank',
            'stats.noProfile': 'No Profile Loaded',
            'stats.noProfileDesc': 'Log in with WCA or look up a WCA ID on the setup page to view official statistics!',
            'stats.prRankings': 'Personal Records & Rankings',
            'stats.silver': 'Silver',
            'stats.subtitle': 'View official World Cube Association statistics, medal counts, and personal records.',
            'stats.totalMedals': 'Total Medals',
            'stats.worldRank': 'World Rank',
            'stats.wrAverage': 'WR Average',
            'stats.wrSingle': 'WR Single',

            // ----- Competitions view -----
            'comps.fetchingComps': 'Fetching competitions...',
            'comps.fetchingResults': 'Fetching WCA results...',
            'comps.loading': 'Loading upcoming competitions...',
            'comps.pastHint': 'Enter a WCA ID (e.g. 2023CARV02) to see all past competitions.',
            'comps.subtitle': 'Browse upcoming competitions globally or search a WCA ID to see past competitions attended by a competitor.',
            'comps.upcomingHint': 'Enter any WCA ID to see upcoming competitions that person is associated with.',
            'comps.upcomingTitle': '📅 Upcoming Competitions',
            'comps.viewOnLive': 'View on WCA Live →',

            // ----- Battle view -----
            'battle.connecting': 'connecting…',
            'battle.eventLabel': 'Event:',
            'battle.eventNote': 'You will choose the event inside the room. Solves are saved per-event so you can switch events freely without losing history.',
            'battle.holdToStart': 'Hold Space/Touch to start timer',
            'battle.joinRoom': 'Join Room',
            'battle.live': 'Live',
            'battle.loadingRooms': 'Loading rooms...',
            'battle.noMessages': 'No messages yet — say hi!',
            'battle.noSolves': 'No solves yet — start solving!',
            'battle.pwPrompt': 'This room is password protected. Enter the password to join.',
            'battle.room': 'Room',
            'battle.subtitle': 'Real-time speedcubing — join a room and race live',
            'battle.waitingScramble': 'Waiting for scramble...',

            // ----- Algorithms & trainer -----
            'algs.algorithm': 'Algorithm',
            'algs.caseName': 'Case Name',
            'algs.closeHint': 'Press H or click anywhere outside to close',
            'algs.deselectAll': 'Deselect All',
            'algs.hold': 'Hold:',
            'algs.noSolves': 'No solves yet — start practicing!',
            'algs.pllPractice': 'PLL Practice',
            'algs.pressSpace': 'Press Space to start',
            'algs.selectAll': 'Select All',
            'algs.selectCases': 'Select Cases to Practice',
            'algs.spaceHint': 'Space = start/stop timer',
            'algs.startPractice': 'Start Practice',
            'algs.subtitle': 'Native Algorithm Database',
            'algs.title': 'Learn & Practice',

            // ----- Timer page -----
            'timer.about.f1': 'Hold spacebar → tap to start (configurable hold)',
            'timer.about.f2': 'WCA-style 15s inspection with optional voice',
            'timer.about.f3': 'Per-solve penalty marking (1=OK, 2=+2, 3=DNF)',
            'timer.about.f4': 'Multiple sessions, all saved locally + optionally cloud',
            'timer.about.f5': 'Statistics: best Ao5/Ao12/Ao100, single PBs, std dev, success %',
            'timer.about.f6': 'Click any time to edit, click penalty to cycle',
            'timer.about.f7': 'Export/Import JSON backup',
            'timer.holdHint': 'Hold Space/Touch (0.5s) → Release to start &nbsp;·&nbsp; Press/Tap to stop',
            'timer.typeDigits': 'Type digits: 1234 = 12.34s &nbsp;·&nbsp; 10234 = 1:02.34 &nbsp;·&nbsp; Press Enter to submit',

            // ----- Input placeholders -----
            'ph.chat': 'Type a message…',
            'ph.compId': 'e.g. Euro2024',
            'ph.goalAvg': 'e.g. 10.00',
            'ph.manualTime': 'e.g. 1234 = 12.34s',
            'ph.roomName': 'e.g. Friday Night Speed Run',
            'ph.roomPw': 'Enter room password',
            'ph.searchCases': 'Search cases…',
            'ph.setRoomPw': 'Set a password for your room',
            'ph.wcaId': 'e.g. 2023CARV02',

            // ----- Tooltips -----
            'title.algs': 'Algorithms & Drills',
            'title.backToAlgs': 'Back to algorithm browser',
            'title.backToSetup': 'Back to Setup',
            'title.clearSession': 'Clear all solves in current session',
            'title.clearTimes': 'Clear times',
            'title.deleteLast': 'Delete last solve (Ctrl+Z)',
            'title.exportJson': 'Export JSON backup',
            'title.fullscreen': 'Fullscreen',
            'title.importJson': 'Import JSON backup',
            'title.kbTimer': 'Keyboard timer (spacebar)',
            'title.lookupComp': 'Look up competition',
            'title.lookupWca': 'Look up WCA profile',
            'title.manualTime': 'Type your time manually',
            'title.muteNoise': 'Mute/Unmute competition noise',
            'title.newScramble': 'New scramble (press space when idle)',
            'title.noiseVolume': 'Competition noise volume',
            'title.records': 'Records & Rankings',
            'title.redoLast': 'Redo last (R)',
            'title.refreshRooms': 'Refresh rooms',
            'title.renameSession': 'Rename session',
            'title.showHint': 'Show hint (H)',
            'title.skip': 'Skip (S)',
            'title.spaceTimer': 'Hold Space to start, tap to stop — instead of typing times',
            'title.toggleColors': 'Toggle Scramble Colors',
            'title.toggleTheme': 'Toggle theme',

            // ----- Accessible labels -----
            'aria.chatMessage': 'Chat message',
            'aria.close': 'Close',
            'aria.filterEvent': 'Filter records by event',
            'aria.filterRegion': 'Filter records by region',
            'aria.filterType': 'Filter records by result type',
            'aria.primaryNav': 'Primary navigation',
            'aria.searchCases': 'Search algorithm cases',
            'aria.searchUpcoming': 'Search upcoming competitions for this WCA ID',
            'aria.selectEvent': 'Select event',
            'aria.sendMessage': 'Send message',
            'aria.toggleTheme': 'Toggle light/dark theme',
            'aria.trainerSettings': 'Trainer settings',
            'aria.wcaIdInput': 'WCA ID to look up',
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

            // ----- Análise de resoluções (cubo bluetooth) -----
            'analysis.title': 'Análise da resolução',
            'analysis.cross': 'CRUZ',
            'analysis.f2l': 'F2L',
            'analysis.slot': 'PAR',
            'analysis.moves': 'movimentos',
            'analysis.movesShort': 'mov',
            'analysis.tps': 'MPS',
            'analysis.optimal': 'Ótimo',
            'analysis.fumble': 'Hesitação',
            'analysis.blunder': 'Erro',
            'analysis.partial': 'A resolução não terminou — a mostrar o que foi registado.',

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

            'battle.createModalTitle': 'Criar sala de batalha',
            'battle.roomName': 'Nome da sala',
            'battle.roomPassword': 'Palavra-passe da sala',
            'battle.wrongPassword': 'Palavra-passe incorreta. Tenta novamente.',

            'home.liveBadge': 'AO VIVO',

            'algs.copy': 'Copiar',
            'algs.practice': 'Praticar',
            'aria.copyAlg': 'Copiar algoritmo de {name}',
            'battle.lobbyTitle': 'Sala de batalhas',
            'battle.refresh': 'Atualizar',

            'comps.headA': 'Descobre',
            'comps.searchPast': 'Pesquisar competições passadas',
            'comps.searchUpcoming': 'Pesquisar inscrições futuras',
            'footer.about': '<strong>CubingHQ</strong> — um projeto de fãs, não oficial e sem ligação à <a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener noreferrer">WCA</a>.',
            'footer.credits': 'Algoritmos da <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">SpeedCubeDB</a> · Scrambles e desenho dos puzzles por <a href="https://js.cubing.net" target="_blank" rel="noopener noreferrer">cubing.js</a> · Inspirado no <a href="https://cstimer.net" target="_blank" rel="noopener noreferrer">csTimer</a>.',
            'history.empty': 'Ainda não há histórico de simulações.<br>Completa uma ronda para veres os resultados aqui.',
            'setup.headA': 'Treina para o',
            'setup.startSim': 'Começar simulação',
            'stats.headA': 'Perfil oficial da',
            'stats.headB': 'WCA',

            'algs.caseN': '{n} caso',
            'algs.casesN': '{n} casos',
            'algs.nSelected': '{n} selecionados',
            'algs.ready': 'Pronto!',

            // ----- Diálogos e avisos de voz do cronómetro -----
            'alert.importBad': 'Ficheiro inválido: faltam os dados das sessões.',
            'alert.importOk': 'Importação concluída!',
            'alert.importParse': 'Não foi possível ler o JSON:',
            'alert.lastSession': 'Não podes apagar a única sessão.',
            'confirm.clearSolves': 'Apagar todos os {n} solves de "{name}"?',
            'confirm.deleteSession': 'Apagar a sessão "{name}"? Todos os seus solves serão removidos.',
            'confirm.replaceData': 'Substituir todos os dados atuais pelos dados importados?',
            'prompt.renameSession': 'Mudar o nome da sessão:',
            'prompt.sessionName': 'Nome da sessão:',
            'timer.deleteSession': 'Apagar',
            'timer.newSession': 'Nova sessão',
            'timer.sessionN': 'Sessão {n}',
            'title.changePenalty': 'Clica para mudar a penalização',
            'title.editTime': 'Clica para editar o tempo (centésimos)',
            'voice.12s': '12 segundos',
            'voice.8s': '8 segundos',

            // ----- Mensagens de aviso -----
            'toast.algCopied': 'Algoritmo copiado',
            'toast.badTimeFormat': 'Formato de tempo inválido. Usa dígitos: 1234 = 12,34s',
            'toast.copyFailed': 'Não foi possível copiar',
            'toast.duplicateMsg': 'Essa mensagem acabou de ser enviada',
            'toast.fetchingPrs': 'A obter PRs históricos ({n})…',
            'toast.found': 'Encontrado',
            'toast.generatingScrambles': 'A gerar scrambles oficiais…',
            'toast.historyCleared': 'Histórico apagado',
            'toast.invalidTime': 'Introduz um tempo válido',
            'toast.loggedOut': 'Sessão terminada',
            'toast.lookupFirst': 'Introduz ou procura primeiro um WCA ID',
            'toast.needCompId': 'Introduz o ID da competição',
            'toast.needPassword': 'Define uma palavra-passe',
            'toast.needWcaId': 'Introduz um WCA ID',
            'toast.noWcaLinked': 'Não há nenhum WCA ID associado a esta conta.',
            'toast.notRegistered': 'Não estás inscrito em {event} nesta competição!',
            'toast.pickCategory': 'Escolhe primeiro uma categoria de algoritmos',
            'toast.pickOneCase': 'Escolhe pelo menos 1 caso',
            'toast.pickSubgroup': 'Escolhe primeiro um subgrupo',
            'toast.profileFailed': 'Não foi possível carregar o teu perfil da WCA. Tenta novamente.',
            'toast.readyNext': 'Pronto para a próxima tentativa!',
            'toast.resultsCopied': 'Resultados copiados para a área de transferência!',
            'toast.roomCooldown': 'Espera {n}s antes de criares outra sala',
            'toast.roomCreateFailed': 'Não foi possível criar a sala. Tenta novamente.',
            'toast.roomJoinFailed': 'Não foi possível entrar na sala',
            'toast.roomNameLong': 'O nome da sala pode ter no máximo {n} caracteres',
            'toast.roomNameShort': 'O nome da sala precisa de pelo menos {n} caracteres',
            'toast.roomNotFound': 'Sala não encontrada',
            'toast.roundStarted': '{round} começou! Faltam {n} participantes.',
            'toast.simRestored': 'Simulação restaurada!',
            'toast.simStarted': 'Simulação iniciada!',
            'toast.slowDown': 'Abranda um pouco',
            'toast.solveRecorded': 'Solve registado',
            'toast.waitingNext': 'A aguardar a próxima tentativa...',
            'toast.welcomeBack': 'Bem-vindo de volta, {name}!',

            // ----- Batalha (dinâmico) -----
            'battle.active': 'Ativa',
            'battle.createOne': 'Cria uma!',
            'battle.createRoom': 'Criar sala',
            'battle.creating': 'A criar...',
            'battle.holdSpace': 'Mantém Espaço para iniciar o cronómetro',
            'battle.holding': 'A segurar...',
            'battle.host': 'Anfitrião',
            'battle.join': 'Entrar',
            'battle.liveLower': 'ao vivo',
            'battle.noPlayers': 'Ainda sem jogadores',
            'battle.noRooms': 'Nenhuma sala encontrada.',
            'battle.noSolvesTable': 'Ainda sem solves — resolve o scramble!',
            'battle.offline': 'offline',
            'battle.player': '{n} jogador',
            'battle.players': '{n} jogadores',
            'battle.privateRoom': 'Sala privada',
            'battle.publicRoom': 'Sala pública',
            'battle.release': 'Larga para começar!',
            'battle.unknown': 'Desconhecido',
            'battle.unnamedRoom': 'Sala sem nome',

            // ----- Algoritmos e treino (dinâmico) -----
            'algs.no2d': 'Sem pré-visualização 2D para esta notação',
            'algs.noMatches': 'Nenhum caso corresponde à pesquisa.',
            'algs.noScramble': '(sem scramble)',
            'algs.noneForEvent': 'Não há algoritmos para este evento.',
            'algs.pressSpaceNext': 'Prime Espaço para o próximo caso',

            // ----- Competições (dinâmico) -----
            'comps.loadFailed': 'Não foi possível carregar as competições futuras.',
            'comps.none': 'Não foram encontradas competições futuras.',
            'comps.viewOnWca': 'Ver na WCA →',

            // ----- Simulação (dinâmico) -----
            'sim.customComp': 'Competição personalizada',
            'sim.hidden': 'Oculto',
            'sim.spaceHint': 'Mantém Espaço (ou toca) para iniciar · toca outra vez para parar',
            'sim.stopped': 'PARADO',
            'sim.submitHint': 'Espaço para submeter · ou marca primeiro +2 / DNF',

            // ----- Objetivo -----
            'goal.allDnf': 'Todos DNF',
            'goal.behind': '+{n}s de atraso',
            'goal.onTrack': 'No bom caminho!',

            // ----- Estado na classificação -----
            'lb.finished': 'Terminado',
            'lb.solving': 'A resolver',
            'lb.waiting': 'À espera',

            // ----- Fim de ronda -----
            'end.greatPerf': 'Desempenho incrível!',
            'end.podium': 'Brutal! Subiste ao pódio!',
            'end.won': 'INCRÍVEL! Ganhaste a ronda!',

            // ----- Nomes das rondas -----
            'round.n': 'Ronda {n}',

            // ----- Confirmações -----
            'confirm.clearHistory': 'Apagar todo o histórico de simulações?',

            // ----- Estatísticas (dinâmico) -----
            'stats.noResults': 'Ainda sem resultados oficiais.',

            // ----- Dicas (dinâmico) -----
            'title.muteNoiseOn': 'Silenciar o som de competição',
            'title.unmuteNoise': 'Ativar o som de competição',

            // ----- Acessibilidade (dinâmico) -----
            'aria.algSet': 'Conjunto de algoritmos',

            // ----- Etiquetas partilhadas -----
            'common.all': 'Todos',
            'common.average': 'Média',
            'common.best': 'Melhor',
            'common.cancel': 'Cancelar',
            'common.clear': 'Limpar',
            'common.clearAll': 'Limpar tudo',
            'common.competitions': 'Competições',
            'common.competitionsCaps': 'COMPETIÇÕES',
            'common.competitors': 'Participantes',
            'common.count': 'Total',
            'common.event': 'Evento',
            'common.events': 'Eventos',
            'common.mean': 'Média',
            'common.name': 'Nome',
            'common.password': 'Palavra-passe',
            'common.profile': 'Perfil',
            'common.result': 'Resultado',
            'common.rounds': 'Rondas',
            'common.scramble': 'Scramble',
            'common.scrambleCaps': 'SCRAMBLE',
            'common.search': 'Pesquisar',
            'common.send': 'Enviar',
            'common.single': 'Single',
            'common.skipToContent': 'Saltar para o conteúdo principal',
            'common.status': 'Estado',
            'common.time': 'Tempo',
            'common.times': 'Tempos',
            'common.visibility': 'Visibilidade',
            'common.worst': 'Pior',

            // ----- Simulação — configuração -----
            'setup.ao5': 'Média de 5',
            'setup.compNoise': 'Som de competição',
            'setup.competition': 'Competição',
            'setup.competitionDay': 'Dia de competição',
            'setup.competitionId': 'ID da competição',
            'setup.competitionIdHint': 'O ID que aparece no URL da competição da WCA',
            'setup.competitionNotFound': 'Competição não encontrada',
            'setup.cutoff': 'Cutoff',
            'setup.eventRound': 'Evento e ronda',
            'setup.fetchingComp': 'A obter dados da competição...',
            'setup.fetchingProfile': 'A obter perfil da WCA...',
            'setup.goalAverage': 'Média objetivo (s)',
            'setup.goalHint': 'O que queres atingir hoje',
            'setup.personalRecords': 'Recordes pessoais',
            'setup.selectEvent': 'Escolher evento',
            'setup.simSettings': 'Definições da simulação',
            'setup.startingRound': 'Ronda inicial',
            'setup.timeLimit': 'Limite de tempo',
            'setup.wcaId': 'WCA ID',
            'setup.wcaIdHint': 'O teu identificador da World Cube Association',
            'setup.wcaIdNotFound': 'WCA ID não encontrado',
            'setup.wcaIdNotFoundDot': 'WCA ID não encontrado.',
            'setup.yourProfile': 'O teu perfil',

            // ----- Nomes das rondas -----
            'round.final': 'Final',
            'round.r1': 'Ronda 1',
            'round.r2': 'Ronda 2',
            'round.semi': 'Meia-final',

            // ----- Simulação — painel -----
            'dash.bestSingle': 'Melhor single',
            'dash.colors': '🎨 Cores',
            'dash.compName': 'Nome da competição',
            'dash.copyResults': '📋 Copiar resultados',
            'dash.current': 'Atual',
            'dash.enterTime': '⌨️ Introduzir tempo',
            'dash.goalTracker': '🎯 Objetivo',
            'dash.history': '📜 Histórico de simulações',
            'dash.input': 'ENTRADA',
            'dash.leaderboard': '🏆 Classificação',
            'dash.newSim': 'Nova simulação',
            'dash.nextRound': 'Próxima ronda →',
            'dash.penalty': 'Pen',
            'dash.placement': 'Posição',
            'dash.prAvg': 'Média PR',
            'dash.pressStart': 'Carrega em Começar para gerar o scramble...',
            'dash.progress': 'Progresso',
            'dash.roundComplete': 'Ronda concluída!',
            'dash.scorecard': '📝 Folha de resultados',
            'dash.scramble': '📋 Scramble',
            'dash.solve15': 'Solve 1/5',
            'dash.submitSolve': 'Registar solve',
            'dash.target': 'Objetivo',
            'dash.typeHint': 'Escreve números (ex.: 954 para 9,54s) e prime Enter',
            'dash.waiting': 'A aguardar...',
            'dash.yourAverage': 'A tua média',

            // ----- Vista de estatísticas -----
            'stats.bronze': 'Bronze',
            'stats.caps': 'ESTATÍSTICAS',
            'stats.gold': 'Ouro',
            'stats.nationalRank': 'Classificação nacional',
            'stats.noProfile': 'Nenhum perfil carregado',
            'stats.noProfileDesc': 'Entra com a WCA ou procura um WCA ID na página de configuração para veres as estatísticas oficiais!',
            'stats.prRankings': 'Recordes pessoais e classificações',
            'stats.silver': 'Prata',
            'stats.subtitle': 'Vê estatísticas oficiais da World Cube Association, medalhas e recordes pessoais.',
            'stats.totalMedals': 'Total de medalhas',
            'stats.worldRank': 'Classificação mundial',
            'stats.wrAverage': 'WR Média',
            'stats.wrSingle': 'WR Single',

            // ----- Vista de competições -----
            'comps.fetchingComps': 'A obter competições...',
            'comps.fetchingResults': 'A obter resultados da WCA...',
            'comps.loading': 'A carregar competições futuras...',
            'comps.pastHint': 'Introduz um WCA ID (ex.: 2023CARV02) para veres todas as competições passadas.',
            'comps.subtitle': 'Explora competições futuras em todo o mundo ou pesquisa um WCA ID para veres as competições passadas de um competidor.',
            'comps.upcomingHint': 'Introduz um WCA ID para veres as competições futuras dessa pessoa.',
            'comps.upcomingTitle': '📅 Competições futuras',
            'comps.viewOnLive': 'Ver na WCA Live →',

            // ----- Vista de batalha -----
            'battle.connecting': 'a ligar…',
            'battle.eventLabel': 'Evento:',
            'battle.eventNote': 'O evento é escolhido dentro da sala. Os solves são guardados por evento, por isso podes mudar de evento à vontade sem perder o histórico.',
            'battle.holdToStart': 'Mantém Espaço/toque para iniciar o cronómetro',
            'battle.joinRoom': 'Entrar na sala',
            'battle.live': 'Ao vivo',
            'battle.loadingRooms': 'A carregar salas...',
            'battle.noMessages': 'Ainda sem mensagens — diz olá!',
            'battle.noSolves': 'Ainda sem solves — começa a resolver!',
            'battle.pwPrompt': 'Esta sala é protegida por palavra-passe. Introduz a palavra-passe para entrar.',
            'battle.room': 'Sala',
            'battle.subtitle': 'Speedcubing em tempo real — entra numa sala e corre ao vivo',
            'battle.waitingScramble': 'A aguardar scramble...',

            // ----- Algoritmos e treino -----
            'algs.algorithm': 'Algoritmo',
            'algs.caseName': 'Nome do caso',
            'algs.closeHint': 'Prime H ou clica fora para fechar',
            'algs.deselectAll': 'Desselecionar todos',
            'algs.hold': 'Espera:',
            'algs.noSolves': 'Ainda sem solves — começa a praticar!',
            'algs.pllPractice': 'Prática de PLL',
            'algs.pressSpace': 'Prime Espaço para começar',
            'algs.selectAll': 'Selecionar todos',
            'algs.selectCases': 'Escolher casos para praticar',
            'algs.spaceHint': 'Espaço = iniciar/parar cronómetro',
            'algs.startPractice': 'Começar prática',
            'algs.subtitle': 'Base de dados de algoritmos',
            'algs.title': 'Aprender e praticar',

            // ----- Página do cronómetro -----
            'timer.about.f1': 'Mantém a barra de espaço → toca para iniciar (espera configurável)',
            'timer.about.f2': 'Inspeção de 15s ao estilo WCA, com voz opcional',
            'timer.about.f3': 'Penalizações por solve (1=OK, 2=+2, 3=DNF)',
            'timer.about.f4': 'Várias sessões, guardadas no dispositivo e opcionalmente na nuvem',
            'timer.about.f5': 'Estatísticas: melhores Ao5/Ao12/Ao100, PBs de single, desvio padrão, % de sucesso',
            'timer.about.f6': 'Clica num tempo para o editar, clica na penalização para a alternar',
            'timer.about.f7': 'Exportar/importar cópia de segurança em JSON',
            'timer.holdHint': 'Mantém Espaço/toque (0,5s) → larga para iniciar &nbsp;·&nbsp; carrega/toca para parar',
            'timer.typeDigits': 'Escreve dígitos: 1234 = 12,34s &nbsp;·&nbsp; 10234 = 1:02,34 &nbsp;·&nbsp; prime Enter para submeter',

            // ----- Textos de exemplo dos campos -----
            'ph.chat': 'Escreve uma mensagem…',
            'ph.compId': 'ex.: Euro2024',
            'ph.goalAvg': 'ex.: 10.00',
            'ph.manualTime': 'ex.: 1234 = 12,34s',
            'ph.roomName': 'ex.: Corrida de Sexta à Noite',
            'ph.roomPw': 'Introduz a palavra-passe da sala',
            'ph.searchCases': 'Pesquisar casos…',
            'ph.setRoomPw': 'Define uma palavra-passe para a sala',
            'ph.wcaId': 'ex.: 2023CARV02',

            // ----- Dicas (tooltips) -----
            'title.algs': 'Algoritmos e treinos',
            'title.backToAlgs': 'Voltar à lista de algoritmos',
            'title.backToSetup': 'Voltar à configuração',
            'title.clearSession': 'Apagar todos os solves da sessão atual',
            'title.clearTimes': 'Limpar tempos',
            'title.deleteLast': 'Apagar último solve (Ctrl+Z)',
            'title.exportJson': 'Exportar cópia de segurança JSON',
            'title.fullscreen': 'Ecrã inteiro',
            'title.importJson': 'Importar cópia de segurança JSON',
            'title.kbTimer': 'Cronómetro por teclado (barra de espaço)',
            'title.lookupComp': 'Procurar competição',
            'title.lookupWca': 'Procurar perfil da WCA',
            'title.manualTime': 'Escrever o tempo manualmente',
            'title.muteNoise': 'Silenciar/ativar o som de competição',
            'title.newScramble': 'Novo scramble (prime espaço quando parado)',
            'title.noiseVolume': 'Volume do som de competição',
            'title.records': 'Recordes e classificações',
            'title.redoLast': 'Repetir o último (R)',
            'title.refreshRooms': 'Atualizar salas',
            'title.renameSession': 'Mudar o nome da sessão',
            'title.showHint': 'Mostrar dica (H)',
            'title.skip': 'Saltar (S)',
            'title.spaceTimer': 'Mantém Espaço para iniciar, toca para parar — em vez de escrever os tempos',
            'title.toggleColors': 'Alternar cores do scramble',
            'title.toggleTheme': 'Alternar tema',

            // ----- Etiquetas de acessibilidade -----
            'aria.chatMessage': 'Mensagem de chat',
            'aria.close': 'Fechar',
            'aria.filterEvent': 'Filtrar recordes por evento',
            'aria.filterRegion': 'Filtrar recordes por região',
            'aria.filterType': 'Filtrar recordes por tipo de resultado',
            'aria.primaryNav': 'Navegação principal',
            'aria.searchCases': 'Pesquisar casos de algoritmos',
            'aria.searchUpcoming': 'Procurar competições futuras deste WCA ID',
            'aria.selectEvent': 'Escolher evento',
            'aria.sendMessage': 'Enviar mensagem',
            'aria.toggleTheme': 'Alternar tema claro/escuro',
            'aria.trainerSettings': 'Definições do treino',
            'aria.wcaIdInput': 'WCA ID a procurar',
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
        scope.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
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
