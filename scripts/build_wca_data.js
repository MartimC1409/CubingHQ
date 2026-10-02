/* Builds the WCA data the Records and Sum of Ranks pages read.

   The WCA's own API publishes record TIMES with no names, and has no
   sum-of-ranks endpoint at all — a Sum of Ranks board needs every ranked
   competitor in every event, which is a database export, not an API call.
   So this script reads the full results (via the unofficial WCA REST API,
   a daily static mirror of the official export on GitHub) and writes
   small static files the site can load:

     data/records/<region>.json        record holders for one region
     data/sor/<region>-single.json     Sum of Ranks board, single ranks
     data/sor/<region>-average.json    Sum of Ranks board, average ranks
     data/meta.json                    when, and from which export

   <region> is WcaCountries.fileKey: "world", a continent slug or an ISO2.

   Sum of Ranks follows the WCA / cubing.com definition: a competitor's
   rank in every event, added up, where an event they are not ranked in
   counts as (number of people ranked in that event, in that region) + 1.
   Without that penalty the totals reward competing in fewer events.

   Run:  node scripts/build_wca_data.js
   Env:  WCA_DATA_SOURCE  base URL of the mirror (default below)
         WCA_DATA_OUT     output directory       (default ./data)
   Scheduled daily by .github/workflows/wca-data.yml. */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = (process.env.WCA_DATA_SOURCE
    || 'https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/v1').replace(/\/$/, '');
const OUT = path.resolve(process.env.WCA_DATA_OUT || path.join(ROOT, 'data'));

// The seventeen current WCA events, in the WCA's display order. Discontinued
// events (feet, magic, old multi) are not part of Sum of Ranks.
const EVENTS = ['333', '222', '444', '555', '666', '777', '333bf', '333fm', '333oh',
    'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf'];
const EVENTS_BY_TYPE = {
    single: EVENTS,
    average: EVENTS.filter(e => e !== '333mbf'),   // multi-blind has no average
};
const TYPES = ['single', 'average'];

// How many rows of each board are published. The page paginates them.
const BOARD_SIZE = { world: 1000, continent: 500, country: 200 };

/* ---------------------------------------------------------------- */

function loadCountries() {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'wca-countries.js'), 'utf8'), sandbox);
    return sandbox.window.WcaCountries;
}

async function getJson(url, tries = 4) {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            if (attempt >= tries) throw new Error(`${url}: ${err.message}`);
            await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
        }
    }
}

/** Fetches `<name>-page-1..N.json`, handing each page's items to `onItems`. */
async function eachPage(name, onItems, concurrency = 6) {
    const first = await getJson(`${SOURCE}/${name}-page-1.json`);
    const pages = Math.max(1, Math.ceil(first.total / first.pagination.size));
    onItems(first.items, 1, first.total);
    let next = 2;
    const worker = async () => {
        while (next <= pages) {
            const page = next++;
            const data = await getJson(`${SOURCE}/${name}-page-${page}.json`);
            onItems(data.items, page, first.total);
        }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { pages, total: first.total };
}

/** "Yiheng Wang (王艺衡)" -> keeps the local name; the page shows it as given. */
function cleanName(name) {
    return String(name || '').trim();
}

/* ---------------------------------------------------------------- */

async function main() {
    const W = loadCountries();
    const t0 = Date.now();

    // ---- 1. Every competitor and their ranks ----------------------
    const persons = [];            // [{ id, name, iso2, country, continent }]
    // ranks[type][eventIndex] -> Map(personIndex -> [world, continent, country])
    const ranks = {};
    TYPES.forEach(t => { ranks[t] = EVENTS_BY_TYPE[t].map(() => new Map()); });
    const eventIndex = {};
    TYPES.forEach(t => { eventIndex[t] = new Map(EVENTS_BY_TYPE[t].map((e, i) => [e, i])); });

    // Record candidates: anyone ranked 1 in their country holds that NR,
    // and the CR / WR are a subset of those. The competition is resolved
    // from the person's own results while they are in hand.
    const holders = [];            // [{ p, type, event, value, world, continent, country, comps }]

    let seen = 0;
    const pageInfo = await eachPage('persons', (items, page, total) => {
        for (const item of items) {
            const iso2 = String(item.country || '').toUpperCase();
            const c = W.byIso2(iso2);
            const p = persons.length;
            persons.push({
                id: item.id,
                name: cleanName(item.name),
                iso2,
                country: c ? c.id : '',
                continent: c ? c.continent : '',
            });
            const r = item.rank || {};
            for (const type of TYPES) {
                const list = type === 'single' ? r.singles : r.averages;
                for (const entry of list || []) {
                    const ei = eventIndex[type].get(entry.eventId);
                    if (ei === undefined || !entry.rank) continue;
                    const { world, continent, country } = entry.rank;
                    if (!(world > 0)) continue;
                    ranks[type][ei].set(p, [world, continent || 0, country || 0]);
                    if (country === 1 || continent === 1 || world === 1) {
                        const comps = [];
                        const results = item.results || {};
                        for (const compId of Object.keys(results)) {
                            for (const res of results[compId][entry.eventId] || []) {
                                const v = type === 'single' ? res.best : res.average;
                                if (v === entry.best) { comps.push(compId); break; }
                            }
                        }
                        holders.push({
                            p, type, event: entry.eventId, value: entry.best,
                            world, continent, country, comps,
                        });
                    }
                }
            }
        }
        seen += items.length;
        if (page % 25 === 0) console.log(`  persons: ${seen.toLocaleString()} / ${total.toLocaleString()}`);
    });
    console.log(`Read ${persons.length.toLocaleString()} competitors from ${pageInfo.pages} pages`
        + ` in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

    // ---- 2. Competition names and dates for the record holders ----
    const wantComps = new Set(holders.flatMap(h => h.comps));
    const comps = new Map();
    await eachPage('competitions', (items) => {
        for (const c of items) {
            if (wantComps.has(c.id)) {
                comps.set(c.id, { name: c.name, date: (c.date && c.date.from) || '' });
            }
        }
    });

    const version = await getJson(`${SOURCE}/version.json`).catch(() => ({}));
    const exportDate = version.export_date || '';

    // ---- 3. Regions -------------------------------------------------
    const regions = [{ id: 'world', level: 'world' }];
    W.continents.forEach(c => regions.push({ id: c.id, level: 'continent' }));
    W.countries.forEach(c => regions.push({ id: c.id, level: 'country' }));

    const inRegion = (person, region) =>
        region.level === 'world' ? true
            : region.level === 'continent' ? person.continent === region.id
                : person.country === region.id;
    const rankAt = { world: 0, continent: 1, country: 2 };

    fs.rmSync(path.join(OUT, 'sor'), { recursive: true, force: true });
    fs.rmSync(path.join(OUT, 'records'), { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT, 'sor'), { recursive: true });
    fs.mkdirSync(path.join(OUT, 'records'), { recursive: true });

    // Members of each region, computed once.
    const members = new Map(regions.map(r => [r.id, []]));
    persons.forEach((person, p) => {
        members.get('world').push(p);
        if (person.continent && members.has(person.continent)) members.get(person.continent).push(p);
        if (person.country && members.has(person.country)) members.get(person.country).push(p);
    });

    let files = 0;
    // No build timestamp anywhere: the files only change when the results
    // do, so a day without new results commits nothing.
    const index = { regions: {} };

    for (const region of regions) {
        const key = W.fileKey(region.id);
        if (!key) continue;
        const ids = members.get(region.id);
        const k = rankAt[region.level];
        const regionIndex = { competitors: {} };

        // ---- Sum of Ranks --------------------------------------------
        for (const type of TYPES) {
            const events = EVENTS_BY_TYPE[type];
            const tables = ranks[type];
            // Penalty for an unranked event: everyone ranked in it here, + 1.
            const ranked = events.map(() => 0);
            for (const p of ids) {
                for (let e = 0; e < events.length; e++) if (tables[e].has(p)) ranked[e]++;
            }
            const penalties = ranked.map(n => n + 1);

            const scored = [];
            for (const p of ids) {
                const row = new Array(events.length);
                let sum = 0, count = 0;
                for (let e = 0; e < events.length; e++) {
                    const r = tables[e].get(p);
                    const rank = r ? r[k] : 0;
                    row[e] = rank;
                    if (rank > 0) { sum += rank; count++; } else sum += penalties[e];
                }
                if (count) scored.push({ p, sum, count, row });
            }
            scored.sort((a, b) => (a.sum - b.sum) || (b.count - a.count)
                || persons[a.p].name.localeCompare(persons[b.p].name));

            const size = BOARD_SIZE[region.level];
            const rows = [];
            let pos = 0;
            for (let i = 0; i < scored.length && i < size; i++) {
                const s = scored[i];
                if (i === 0 || s.sum !== scored[i - 1].sum) pos = i + 1;
                const person = persons[s.p];
                rows.push([pos, person.id, person.name, person.iso2, s.sum, s.row]);
            }
            write(path.join(OUT, 'sor', `${key}-${type}.json`), {
                exportDate, region: region.id, type,
                events, penalties, competitors: scored.length, rows,
            });
            regionIndex.competitors[type] = scored.length;
            files++;
        }

        // ---- Records -------------------------------------------------
        const records = {};
        for (const h of holders) {
            const level = region.level;
            if ((level === 'world' && h.world !== 1)
                || (level === 'continent' && h.continent !== 1)
                || (level === 'country' && h.country !== 1)) continue;
            const person = persons[h.p];
            if (!inRegion(person, region)) continue;
            // The earliest competition where they set this exact result.
            const comp = h.comps
                .map(id => ({ id, ...(comps.get(id) || { name: id, date: '' }) }))
                .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
            const ev = records[h.event] || (records[h.event] = {});
            (ev[h.type] || (ev[h.type] = [])).push({
                id: person.id, name: person.name, iso2: person.iso2, value: h.value,
                competition: comp ? comp.name : '', competitionId: comp ? comp.id : '',
                date: comp ? comp.date : '',
            });
        }
        for (const ev of Object.values(records)) {
            for (const list of Object.values(ev)) list.sort((a, b) => a.date.localeCompare(b.date));
        }
        if (Object.keys(records).length) {
            write(path.join(OUT, 'records', `${key}.json`), {
                exportDate, region: region.id, records,
            });
            files++;
        }
        if (regionIndex.competitors.single || regionIndex.competitors.average) {
            index.regions[region.id] = regionIndex.competitors;
        }
    }

    write(path.join(OUT, 'meta.json'), {
        exportDate,
        source: 'World Cube Association results export, via the unofficial WCA REST API mirror',
        notice: 'This information is based on competition results owned and maintained by the '
            + 'World Cube Association, published at https://worldcubeassociation.org/results',
        events: EVENTS,
        regions: index.regions,
    });
    console.log(`Wrote ${files + 1} files to ${path.relative(ROOT, OUT) || OUT}`
        + ` in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

function write(file, data) {
    fs.writeFileSync(file, JSON.stringify(data));
}

if (require.main === module) {
    main().catch(err => { console.error(err); process.exit(1); });
}
