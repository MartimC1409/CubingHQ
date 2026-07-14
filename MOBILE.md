# CubingHQ — iOS & Android app

The iOS and Android apps are the existing CubingHQ web app (`index.html`,
`timer.html`, `app.js`, `timer.js`, `algorithms*.js`, `style.css`, `timer.css`,
`scramble-engine.js`, `square1-drawer.js`) wrapped with [Capacitor](https://capacitorjs.com)
into real native Xcode and Android Studio projects — not a rewrite. Capacitor
ships a native shell (Swift on iOS, Kotlin/Java on Android) that hosts the
same HTML/CSS/JS in a WebView, plus a JS bridge for native APIs. This was the
practical choice given the app is a large (~700KB), framework-free HTML/CSS/JS
codebase already; rewriting it in React Native/Flutter would mean
re-implementing everything (timer, scramble engine, algorithm trainer, WCA
Live integration) a second time in a different language.

App identity: `appId com.cubinghq.app`, display name **CubingHQ**.

## How the pieces fit together

```
index.html, app.js, style.css, ...   <- canonical web app (also what the live website serves)
        |
        |  npm run build:mobile   (scripts/build-mobile-www.js)
        v
www/                                  <- generated mobile bundle (committed, see note below)
        |
        |  npx cap sync
        v
ios/App/App/public/                   <- embedded copy Xcode builds from
android/app/src/main/assets/public/   <- embedded copy Gradle builds from
```

`scripts/build-mobile-www.js` copies the runtime web files into `www/` and:
- Removes the Google AdSense script/meta tags. AdSense is web-only —
  serving AdSense ads inside a native WebView shell violates AdSense policy,
  so the app build strips it. (The root `index.html` used by the live site
  is untouched.)
- Adds `viewport-fit=cover`, `theme-color`, and an `apple-mobile-web-app-*`
  meta tags, and links `mobile-app.css` (safe-area-inset padding so the
  fixed top bar and bottom tab bar clear the iPhone notch/Dynamic Island and
  the home-indicator gesture area, plus disabled overscroll bounce).

Files intentionally **not** included in the app bundle: `admin.html` /
`admin_records.html` (site-owner data-entry tools, not linked from the app
itself), and the various `_*.py`, `patch_*.js`, `temp_*.html`, `*.json` test
fixtures at the repo root — those are one-off scripts/scratch files used
while developing the website, not runtime dependencies (confirmed by
grepping for references before excluding anything).

`www/`, `ios/`, and `android/` are committed to this branch so the project
builds immediately after cloning — only `Pods/`, Gradle's `build/` /
`.gradle/`, and other machine-specific build output are gitignored. If you
change the web app, re-run `npm run sync` (or `sync:ios` / `sync:android`)
before opening the native IDE, otherwise it'll build the previous snapshot.

## Everyday workflow

```bash
npm install                 # once
npm run sync                # rebuild www/ + copy into both native projects
npm run open:ios            # opens ios/App/App.xcworkspace... see limitation below
npm run open:android        # opens android/ in Android Studio
```

## What was verified in this environment, and what wasn't

This session ran in a Linux container with no Xcode/macOS and no Android
SDK, and the network egress policy blocks binary downloads from GitHub
Releases (confirmed for both `sharp`'s prebuilt binary and Gradle's own
distribution zip — both 403'd through the proxy, so per the proxy's own
guidance these weren't retried or routed around). Concretely:

- **Verified**: `npx cap add ios` / `add android` completed successfully;
  `npx cap sync` is clean; `AndroidManifest.xml`, `build.gradle`
  (`applicationId com.cubinghq.app`), `Info.plist`
  (`CFBundleDisplayName CubingHQ`), and `strings.xml` all contain the
  expected values; the `INTERNET` permission is present (the app needs it —
  WCA Live data, Google Fonts, Chart.js, and the `cubing/twisty` cube
  renderer are all loaded from CDNs at runtime); app icons and splash
  screens were generated at every resolution Capacitor's templates expect
  and spot-checked visually.
- **Not verified**: an actual compiled `.app`/`.ipa` or `.apk`/`.aab`.
  iOS builds and code signing categorically require Xcode on macOS — there
  is no Linux workaround for that, Apple-imposed. Android builds require
  the Android SDK/build-tools, which aren't installed here, and this
  container can't download Gradle itself to try (see above). Both will
  build normally in their real IDEs; nothing in this setup is
  Linux-container-specific.

### Building for real

**iOS** (needs a Mac):
1. `npm run open:ios` (or open `ios/App/App.xcworkspace` in Xcode directly).
2. Plugins resolve via Swift Package Manager automatically on first open —
   no CocoaPods step needed (Capacitor 8 uses SPM by default).
3. Pick a signing team under *Signing & Capabilities* (needs a free or paid
   Apple Developer account), then Run.
4. To publish: Product → Archive → Distribute App, needs an active Apple
   Developer Program membership ($99/yr) to submit to the App Store.

**Android**:
1. `npm run open:android` (or open the `android/` folder in Android Studio).
2. Let Gradle sync (Android Studio bundles its own Gradle + SDK, so this
   step that failed in this container will work normally there).
3. Run on a device/emulator directly.
4. To publish: Build → Generate Signed App Bundle, needs a Google Play
   Console account ($25 one-time) to submit to the Play Store.

## Two things worth fixing separately (found while setting this up, out of scope for the app packaging itself)

- **`.env` with a live `OPENROUTER_API_KEY` is committed to this repo's
  git history.** Recommend rotating that key and removing it from history
  (`.env` is now gitignored going forward, but that alone doesn't scrub
  already-committed history or already-tracked content).
- **`node_modules/` (589 files, an unused Express install with no
  `package.json` to explain it) was committed to git with no
  `.gitignore`.** This branch untracks it and adds a proper `.gitignore` +
  `package.json`. Your working copy on disk is unaffected either way.
