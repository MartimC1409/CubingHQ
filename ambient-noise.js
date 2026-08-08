/* ============================================================
   CubingHQ — synthesized competition-hall ambience
   ------------------------------------------------------------
   Replaces the 4.9 MB competition_noise.mp3, which was a rip of a
   third-party video and had no business being served from a
   monetized domain. This generates the same "busy venue" bed from
   scratch with the Web Audio API: no asset, no download, no
   licensing question.

   How it sounds like a room rather than a hiss:
     - brown noise (integrated white) for the low rumble of a crowd
     - a bandpass around the vocal range for the murmur on top
     - two slow, out-of-phase LFOs on the murmur's gain, so the
       level drifts the way a hall does instead of sitting flat

   Exposes just enough of the HTMLAudioElement surface for app.js to
   drive it unchanged: volume, currentTime, loop, play(), pause().
   play() returns a promise, because the caller .catch()es it.

   The AudioContext is created lazily on the first play(): building
   one before a user gesture leaves it suspended in every browser,
   and Chrome logs a warning about it.
   ============================================================ */
(function () {
    'use strict';

    function createAmbientNoise() {
        let ctx = null;
        let master = null;      // final gain -> destination, carries `volume`
        let sources = [];       // live BufferSources/Oscillators, stopped on pause
        let volume = 1;
        let playing = false;

        // A few seconds of brown noise, looped. Brown (not white) because the
        // 1/f² rolloff is what makes it read as a room instead of a TV
        // tuned to a dead channel. Long enough that the loop point is not
        // audible under the murmur layer.
        function buildNoiseBuffer(audioCtx, seconds) {
            const length = Math.floor(audioCtx.sampleRate * seconds);
            const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            let last = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                // Leaky integrator: the 0.02 feed keeps it from wandering off
                // to DC, the 3.5 puts it back near unity peak.
                last = (last + 0.02 * white) / 1.02;
                data[i] = last * 3.5;
            }
            return buffer;
        }

        function start() {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!ctx) {
                ctx = new AudioCtx();
                master = ctx.createGain();
                master.gain.value = volume;
                master.connect(ctx.destination);
            }

            const noise = buildNoiseBuffer(ctx, 6);

            // --- Layer 1: low rumble ---------------------------------------
            const rumble = ctx.createBufferSource();
            rumble.buffer = noise;
            rumble.loop = true;
            const rumbleFilter = ctx.createBiquadFilter();
            rumbleFilter.type = 'lowpass';
            rumbleFilter.frequency.value = 340;
            const rumbleGain = ctx.createGain();
            rumbleGain.gain.value = 0.5;
            rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);

            // --- Layer 2: crowd murmur -------------------------------------
            const murmur = ctx.createBufferSource();
            murmur.buffer = noise;
            murmur.loop = true;
            // Offset the read head so the two layers never correlate, which
            // would otherwise make the loop obvious.
            const murmurFilter = ctx.createBiquadFilter();
            murmurFilter.type = 'bandpass';
            murmurFilter.frequency.value = 900;
            murmurFilter.Q.value = 0.6;
            const murmurGain = ctx.createGain();
            murmurGain.gain.value = 0.22;
            murmur.connect(murmurFilter).connect(murmurGain).connect(master);

            // Two slow LFOs at incommensurable rates, so the swell pattern
            // takes minutes to repeat and never sounds mechanical.
            const lfoA = ctx.createOscillator();
            lfoA.frequency.value = 0.07;
            const lfoAGain = ctx.createGain();
            lfoAGain.gain.value = 0.06;
            lfoA.connect(lfoAGain).connect(murmurGain.gain);

            const lfoB = ctx.createOscillator();
            lfoB.frequency.value = 0.023;
            const lfoBGain = ctx.createGain();
            lfoBGain.gain.value = 0.04;
            lfoB.connect(lfoBGain).connect(murmurGain.gain);

            const now = ctx.currentTime;
            rumble.start(now);
            murmur.start(now, 2.5);
            lfoA.start(now);
            lfoB.start(now);
            sources = [rumble, murmur, lfoA, lfoB];

            // Autoplay policy: if the context was created before a gesture it
            // comes up suspended, so always try to resume.
            if (ctx.state === 'suspended') ctx.resume();
            playing = true;
        }

        function stop() {
            sources.forEach((node) => {
                try { node.stop(); } catch (e) { /* already stopped */ }
                try { node.disconnect(); } catch (e) { /* already detached */ }
            });
            sources = [];
            playing = false;
        }

        return {
            // Accepted and ignored — the layers loop by construction. Kept so
            // callers written against HTMLAudioElement don't throw.
            loop: true,
            currentTime: 0,

            get volume() { return volume; },
            set volume(v) {
                volume = Math.max(0, Math.min(1, Number(v) || 0));
                if (master && ctx) {
                    // Short ramp instead of a jump: a step on the gain of a
                    // running noise source is audible as a click.
                    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
                }
            },

            play() {
                try {
                    if (!playing) start();
                    else if (ctx && ctx.state === 'suspended') ctx.resume();
                    return Promise.resolve();
                } catch (err) {
                    return Promise.reject(err);
                }
            },

            pause() {
                if (playing) stop();
            }
        };
    }

    window.createAmbientNoise = createAmbientNoise;
})();
