/* ============================================================
   CubingHQ — content filter for user-submitted text
   ------------------------------------------------------------
   Battle rooms let anyone set a display name, a room name and send
   chat messages, and all of it renders next to ads on a site with a
   young user base. Previously there was nothing here at all.

   Two levels:
     - BLOCK  — slurs and sexual content involving minors. The message
                is refused outright and never sent.
     - MASK   — ordinary profanity, replaced with asterisks.
   Plus contact-detail redaction, because the Terms ask people not to
   post personal information and the most common way that rule is
   broken is someone dropping their own phone number in a public room.

   Evasion resistance is the point, not the word list. Matching runs
   against a normalised copy of the text — leetspeak folded, accents
   stripped, and separators between letters removed — so "f.u.c.k",
   "f u c k" and "fu(k" all collapse to the same thing. Indices map
   back to the original so masking hits the right characters.

   This is a client-side control and therefore a courtesy, not a
   guarantee: anyone can POST straight to the database with curl. The
   real fix is Firebase security rules, which live outside this repo.
   Filtering on render as well as on send is what makes it still worth
   having — text inserted by other means is masked when displayed.
   ============================================================ */
(function () {
    'use strict';

    // Refused outright. Kept deliberately narrow: slurs and sexualised
    // content involving minors, not merely rude words.
    var BLOCK = [
        'nigger', 'nigga', 'faggot', 'fag', 'tranny', 'retard', 'retarded',
        'kike', 'spic', 'chink', 'gook', 'wetback', 'paki', 'coon',
        'childporn', 'cp0rn', 'pedo', 'pedophile', 'paedophile', 'rape',
        'rapist', 'kys', 'killyourself'
    ];

    // Masked with asterisks. Ordinary swearing — not worth refusing a
    // message over, not worth displaying next to an ad either.
    var MASK = [
        'fuck', 'fucking', 'fucker', 'shit', 'shitty', 'bullshit', 'bitch',
        'bastard', 'cunt', 'dick', 'dickhead', 'cock', 'pussy', 'asshole',
        'arsehole', 'whore', 'slut', 'wanker', 'twat', 'prick', 'bollocks',
        'motherfucker', 'jerkoff', 'jackass', 'douche', 'douchebag'
    ];

    // Leetspeak and lookalikes, folded before matching.
    var LEET = {
        '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
        '6': 'g', '7': 't', '8': 'b', '9': 'g',
        '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't',
        '(': 'c', '{': 'c', '[': 'c', '<': 'c',

        // Cyrillic and Greek homoglyphs. NFKD leaves these alone — they are
        // genuinely different letters, not decorated Latin ones — so a single
        // Cyrillic "а" pasted into an otherwise Latin slur defeats the whole
        // word list unless they are folded explicitly.
        'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'к': 'k',
        'м': 'm', 'о': 'o', 'р': 'p', 'ѕ': 's', 'т': 't', 'у': 'y',
        'х': 'x', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'ɡ': 'g',
        'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o',
        'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ν': 'v', 'μ': 'u'
    };

    /**
     * Fold `raw` to a comparable form and record, for each character of the
     * result, which index of `raw` it came from. The map is what lets a match
     * on the normalised string mask the correct span of the original.
     */
    function normalise(raw) {
        var out = '';
        var map = [];
        // Decompose accents so "shít" folds to "shit".
        var decomposed = raw.normalize ? raw.normalize('NFKD') : raw;

        // Walking the original in step with the decomposed form is not
        // reliable once a character expands, so track the source index
        // separately and only advance it on a non-combining character.
        var srcIndex = 0;
        for (var i = 0; i < decomposed.length; i++) {
            var ch = decomposed[i];

            // Combining marks contribute nothing and belong to the previous
            // source character.
            if (/[̀-ͯ]/.test(ch)) continue;

            var lower = ch.toLowerCase();
            var folded = Object.prototype.hasOwnProperty.call(LEET, lower) ? LEET[lower] : lower;

            if (/[a-z]/.test(folded)) {
                out += folded;
                map.push(Math.min(srcIndex, raw.length - 1));
            }
            // Everything else — spaces, punctuation, digits that did not fold
            // to a letter — is dropped, which is what defeats "f.u.c.k".

            if (srcIndex < raw.length) srcIndex++;
        }
        return { text: out, map: map };
    }

    function buildPattern(words) {
        // Longest first, so "motherfucker" wins over "fuck" and the mask
        // covers the whole word rather than its middle.
        var sorted = words.slice().sort(function (a, b) { return b.length - a.length; });
        return new RegExp(sorted.join('|'), 'g');
    }

    var BLOCK_RE = buildPattern(BLOCK);
    var MASK_RE = buildPattern(MASK);

    // Contact details. Applied to the original text, not the normalised copy.
    var EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
    var PHONE_RE = /(?:\+?\d[\s-]?){9,15}/g;
    var URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;

    function containsBlocked(raw) {
        BLOCK_RE.lastIndex = 0;
        return BLOCK_RE.test(normalise(raw).text);
    }

    function maskProfanity(raw) {
        var norm = normalise(raw);
        if (!norm.text) return raw;

        // Collect the original-string indices covered by every match, then
        // blank them in one pass. Rewriting as we go would invalidate the
        // index map.
        var hits = [];
        var m;
        MASK_RE.lastIndex = 0;
        while ((m = MASK_RE.exec(norm.text)) !== null) {
            for (var k = m.index; k < m.index + m[0].length; k++) {
                if (norm.map[k] !== undefined) hits.push(norm.map[k]);
            }
            // Zero-length matches cannot happen with this pattern, but a
            // runaway loop here would hang the page.
            if (m.index === MASK_RE.lastIndex) MASK_RE.lastIndex++;
        }
        if (!hits.length) return raw;

        var chars = raw.split('');
        hits.forEach(function (i) {
            // Leave separators visible so "f.u.c.k" masks to "*.*.*.*" rather
            // than turning into an unreadable run.
            if (/[a-z0-9@$!|+({[<]/i.test(chars[i])) chars[i] = '*';
        });
        return chars.join('');
    }

    function redactContactDetails(raw) {
        return raw
            .replace(EMAIL_RE, '[removed]')
            .replace(URL_RE, '[link removed]')
            .replace(PHONE_RE, function (match) {
                // Only redact if it really is a run of digits, so a scramble
                // or a time like "12.34" survives.
                return (match.replace(/\D/g, '').length >= 9) ? '[removed]' : match;
            });
    }

    /**
     * Clean a chat message.
     * Returns { text, blocked, reason }. When blocked is true, `text` is
     * unchanged and the caller must not send it.
     */
    function cleanMessage(raw) {
        var input = String(raw == null ? '' : raw);
        if (containsBlocked(input)) {
            return { text: input, blocked: true, reason: 'prohibited' };
        }
        return {
            text: maskProfanity(redactContactDetails(input)),
            blocked: false,
            reason: null
        };
    }

    /**
     * Clean a display name or room name. Stricter than a message: anything
     * containing a blocked term is replaced wholesale rather than refused,
     * because these are rendered in contexts with no room to show an error.
     */
    function cleanName(raw, fallback) {
        var input = String(raw == null ? '' : raw).trim();
        if (!input) return fallback || 'Guest';
        if (containsBlocked(input)) return fallback || 'Guest';
        return maskProfanity(input);
    }

    window.ContentFilter = {
        cleanMessage: cleanMessage,
        cleanName: cleanName,
        isBlocked: containsBlocked
    };
})();
