const fs = require('fs');

const cssPatch = `

/* ============================================================
   MOBILE RESPONSIVENESS OVERHAUL
   ============================================================ */

.hamburger {
    display: none;
    cursor: pointer;
    color: var(--clr-text);
}

@media (max-width: 850px) {
    .hamburger {
        display: flex;
        align-items: center;
        padding: 0.5rem;
    }
    
    .nav-links {
        position: fixed;
        top: 70px;
        left: -100%;
        flex-direction: column;
        background: var(--clr-surface);
        width: 100%;
        height: calc(100vh - 70px);
        text-align: center;
        transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 10px 27px rgba(0, 0, 0, 0.2);
        padding: var(--space-xl) 0;
        gap: var(--space-lg);
        overflow-y: auto;
    }
    
    .nav-links.mobile-active {
        left: 0;
    }
    
    .nav-btn {
        width: 80%;
        justify-content: center;
        font-size: 1.1rem;
        padding: 1rem;
    }
    
    .theme-toggle {
        margin: 1rem auto;
        transform: scale(1.2);
    }
}

@media (max-width: 768px) {
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

fs.appendFileSync('style.css', cssPatch);
console.log('Mobile CSS patched.');
