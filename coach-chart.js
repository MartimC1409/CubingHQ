/* ============================================================
   CubingHQ Coach — performance trend chart
   ------------------------------------------------------------
   Answers "am I actually getting faster?", which a table of numbers
   does not. Individual solves sit behind rolling averages, PBs are
   marked, and the goal is a line on the chart — so the distance left
   is something you see rather than compute.

   Chart.js is already loaded on the site (and was previously unused).
   The goal line and session dividers are drawn by a small inline
   plugin rather than adding chartjs-plugin-annotation for two shapes.

   Exposed as window.CoachChart.
   ============================================================ */
(function () {
    'use strict';

    const A = () => window.CoachAnalytics;

    function cssVar(name, fallback) {
        try {
            const v = getComputedStyle(document.body).getPropertyValue(name).trim();
            return v || fallback;
        } catch (e) { return fallback; }
    }

    /**
     * Series colours are fixed hues, not theme tokens.
     *
     * The tokens are the wrong tool here: the site's accent is
     * user-switchable, and --clr-primary and --clr-accent both resolve
     * to it, so Ao12 and Ao50 drew in the same orange and the chart was
     * unreadable. Four lines that must be told apart need four hues
     * chosen to be distinguishable, including for the most common form
     * of colour blindness — so no red/green pairing carries meaning on
     * its own, and the four differ in lightness as well as hue.
     *
     * Structural colours stay on tokens so light and dark themes work.
     */
    function palette() {
        return {
            solves: cssVar('--clr-text-muted', '#5A5E7A'),
            ao5: '#38BDF8',    // sky
            ao12: '#A78BFA',   // violet
            ao50: '#FB923C',   // orange
            ao100: '#34D399',  // emerald
            goal: '#F43F5E',   // rose, dashed — never confused with a series
            pb: '#FCD34D',     // gold dots, not a line
            grid: cssVar('--clr-border', 'rgba(255,255,255,0.06)'),
            text: cssVar('--clr-text-secondary', '#8B8FA8'),
        };
    }

    /**
     * Draws the goal line, its label, and session dividers.
     * Registered per-chart rather than globally so nothing leaks into
     * any other Chart.js use on the site.
     */
    const markersPlugin = {
        id: 'coachMarkers',
        afterDatasetsDraw(chart, args, opts) {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return;
            const c = palette();

            // Session dividers first, so the goal line sits on top.
            if (opts.boundaries && opts.boundaries.length) {
                ctx.save();
                ctx.strokeStyle = c.grid;
                ctx.lineWidth = 1;
                for (const idx of opts.boundaries) {
                    const x = scales.x.getPixelForValue(idx);
                    if (x < chartArea.left || x > chartArea.right) continue;
                    ctx.beginPath();
                    ctx.moveTo(x, chartArea.top);
                    ctx.lineTo(x, chartArea.bottom);
                    ctx.stroke();
                }
                ctx.restore();
            }

            if (!isFinite(opts.goalMs)) return;
            const y = scales.y.getPixelForValue(opts.goalMs);
            if (y < chartArea.top || y > chartArea.bottom) return;

            ctx.save();
            ctx.strokeStyle = c.goal;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, y);
            ctx.lineTo(chartArea.right, y);
            ctx.stroke();
            ctx.setLineDash([]);

            const label = opts.goalLabel || 'Goal';
            ctx.font = '600 11px ' + cssVar('--font-body', 'Inter, sans-serif');
            const w = ctx.measureText(label).width + 12;
            const boxX = chartArea.right - w - 4;
            const boxY = Math.max(chartArea.top, y - 20);
            ctx.fillStyle = c.goal;
            ctx.beginPath();
            // Rounded label chip; roundRect is widely supported, but fall
            // back to a plain rect so an older browser still gets a label.
            if (ctx.roundRect) { ctx.roundRect(boxX, boxY, w, 16, 4); ctx.fill(); }
            else ctx.fillRect(boxX, boxY, w, 16);
            ctx.fillStyle = '#0B0D17';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, boxX + 6, boxY + 8);
            ctx.restore();
        },
    };

    let chart = null;

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Array} solves chronological
     * @param {{goalMs?:number, goalLabel?:string, window?:number, event?:string}} opts
     */
    function render(canvas, solves, opts = {}) {
        if (!canvas || !window.Chart || !A()) return null;

        const windowed = opts.window && opts.window > 0 && solves.length > opts.window
            ? solves.slice(-opts.window)
            : solves;

        const offset = solves.length - windowed.length;
        const c = palette();
        const mo3 = opts.mo3 || false;

        const labels = windowed.map((_, i) => offset + i + 1);
        const times = windowed.map(s => {
            const ms = window.CubeStats.effectiveMs(s);
            return (ms === Infinity || ms === null) ? null : ms;
        });

        const series = (n) => A().rollingAverage(windowed, n, mo3);
        const pbSet = new Set(A().pbMarkers(windowed).map(p => p.index));

        const line = (label, data, colour, width, hidden) => ({
            label, data, borderColor: colour, backgroundColor: colour,
            borderWidth: width, pointRadius: 0, pointHoverRadius: 4,
            tension: 0.25, spanGaps: true, hidden: !!hidden,
        });

        const datasets = [
            {
                label: 'Solves',
                data: times,
                borderColor: c.solves,
                backgroundColor: c.solves,
                borderWidth: 0,
                showLine: false,
                // PBs get a visible dot; everything else stays faint so the
                // averages read as the signal and solves as the texture.
                pointRadius: (ctx) => pbSet.has(ctx.dataIndex) ? 4 : 1.5,
                pointBackgroundColor: (ctx) => pbSet.has(ctx.dataIndex) ? c.pb : c.solves,
                pointBorderColor: (ctx) => pbSet.has(ctx.dataIndex) ? c.pb : c.solves,
                pointHoverRadius: 5,
                order: 10,
            },
            line('Ao5', series(5), c.ao5, 1.5, true),
            line('Ao12', series(12), c.ao12, 2, false),
            line('Ao50', series(50), c.ao50, 2, solves.length < 60),
            line('Ao100', series(100), c.ao100, 2.5, solves.length < 110),
        ];

        const boundaries = A().sessionBoundaries(windowed).map(i => i);

        if (chart) { chart.destroy(); chart = null; }

        chart = new window.Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 250 },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: c.text, maxTicksLimit: 8, autoSkip: true,
                            font: { size: 10 },
                        },
                        title: { display: false },
                    },
                    y: {
                        grid: { color: c.grid },
                        ticks: {
                            color: c.text, font: { size: 10 },
                            callback: (v) => A().fmtMs(v),
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: c.text, boxWidth: 10, boxHeight: 10,
                            usePointStyle: true, pointStyle: 'line',
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => `Solve ${items[0].label}`,
                            label: (item) => {
                                if (item.parsed.y === null) return null;
                                const pb = item.datasetIndex === 0 && pbSet.has(item.dataIndex);
                                return `${item.dataset.label}: ${A().fmtMs(item.parsed.y)}${pb ? '  ·  PB' : ''}`;
                            },
                        },
                    },
                    coachMarkers: {
                        goalMs: opts.goalMs,
                        goalLabel: opts.goalLabel,
                        boundaries,
                    },
                },
            },
            plugins: [markersPlugin],
        });

        return chart;
    }

    function destroy() {
        if (chart) { chart.destroy(); chart = null; }
    }

    // Theme changes swap every colour token, so redraw rather than
    // leaving a dark-theme chart on a light page.
    document.addEventListener('app-theme-changed', () => {
        if (chart) document.dispatchEvent(new CustomEvent('coach-chart-needs-redraw'));
    });

    window.CoachChart = { render, destroy, get instance() { return chart; } };
})();
