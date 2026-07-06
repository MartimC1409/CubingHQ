const fs = require('fs');

const bottomNavPatch = `
/* ============================================================
   BOTTOM NAVIGATION BAR OVERHAUL
   ============================================================ */

@media (max-width: 850px) {
    /* Center logo at the top */
    .navbar {
        padding: 0.5rem;
        justify-content: center;
    }
    .nav-brand {
        margin: 0 auto;
    }

    /* Bottom Bar */
    .nav-links {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 70px;
        background: rgba(11, 13, 23, 0.95);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        padding: 0 10px;
        gap: 10px;
        overflow-x: auto;
        overflow-y: hidden;
        border-top: 1px solid var(--clr-border);
        z-index: 999;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    .nav-links::-webkit-scrollbar {
        display: none;
    }

    /* Button formatting for bottom bar */
    .nav-btn {
        flex-direction: column;
        gap: 5px;
        font-size: 0.65rem;
        padding: 0.5rem;
        white-space: nowrap;
        min-width: 70px;
        height: 100%;
        border-radius: 0;
        background: transparent !important;
        opacity: 0.7;
    }
    .nav-btn.active, .nav-btn:hover {
        opacity: 1;
        color: var(--clr-primary);
        border-bottom: 2px solid var(--clr-primary);
    }
    .nav-btn svg {
        margin-right: 0;
        width: 22px;
        height: 22px;
        margin-bottom: 2px;
    }
    
    /* Theme Toggle */
    .theme-toggle {
        min-width: 60px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0;
    }

    /* Prevent bottom bar from hiding content */
    body {
        padding-bottom: 75px;
    }

    /* Home Page Hero */
    .hero-title {
        font-size: 2.5rem;
    }
    .hero-subtitle {
        font-size: 1rem;
        padding: 0 1rem;
    }

    /* Feature Cards */
    .home-feature-card {
        padding: 1.5rem;
        min-height: 120px;
    }
    .home-feature-card .card-title {
        font-size: 1.2rem;
    }
    .home-feature-card .icon {
        font-size: 2rem;
    }

    /* Grids */
    .setup-grid {
        grid-template-columns: 1fr !important;
    }
    .dash-grid {
        grid-template-columns: 1fr !important;
    }

    /* Dashboard Timer */
    .timer-display {
        font-size: 20vw;
    }
    .scramble-display {
        font-size: 1.2rem;
    }
    
    /* Layout */
    .setup-container {
        padding: var(--space-md);
    }
}

@media (max-width: 480px) {
    .scramble-display {
        font-size: 1rem;
    }
    .timer-display {
        font-size: 25vw;
    }
}
`;

fs.appendFileSync('style.css', bottomNavPatch);
console.log('Bottom Nav CSS applied safely.');
