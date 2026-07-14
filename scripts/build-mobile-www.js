#!/usr/bin/env node
// Assembles www/ (the Capacitor webDir) from the canonical web app files at
// the repo root. Run via `npm run build:mobile` before `npx cap sync`.
//
// This does more than copy files: it strips things that don't belong in a
// native app shell (Google AdSense — showing AdSense ads inside a native
// WebView violates AdSense policy) and adds mobile-shell concerns that the
// website doesn't need (safe-area insets for iPhone notches, status bar
// theme-color, disabled overscroll bounce).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

const FILES_TO_COPY = [
  'index.html',
  'timer.html',
  'style.css',
  'timer.css',
  'scramble-engine.js',
  'square1-drawer.js',
  'algorithms.js',
  'algorithms-extra.js',
  'timer.js',
  'app.js',
  'competition_noise.mp3',
];

function replaceOnce(source, file, find, replace) {
  const idx = source.indexOf(find);
  if (idx === -1) {
    throw new Error(`build-mobile-www: expected to find in ${file}:\n${find}`);
  }
  return source.slice(0, idx) + replace + source.slice(idx + find.length);
}

function mobileHeadInjections(html, file) {
  html = replaceOnce(
    html,
    file,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
      '    <meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n' +
      '    <meta name="theme-color" content="#0B0D17">'
  );
  html = replaceOnce(
    html,
    file,
    '<link rel="stylesheet" href="style.css?v=3">',
    '<link rel="stylesheet" href="style.css?v=3">\n    <link rel="stylesheet" href="mobile-app.css">'
  );
  return html;
}

function stripAdSense(html, file) {
  html = replaceOnce(
    html,
    file,
    '    <!-- Google AdSense Verification & Auto Ads -->\n' +
      '    <meta name="google-adsense-account" content="ca-pub-1447384831345579">\n' +
      '    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1447384831345579"\n' +
      '     crossorigin="anonymous"></script>\n',
    '    <!-- AdSense removed for the native app build: AdSense is web-only and its policy prohibits serving inside a native WebView shell. -->\n'
  );
  return html;
}

function build() {
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });

  for (const file of FILES_TO_COPY) {
    const srcPath = path.join(ROOT, file);
    const destPath = path.join(WWW, file);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`build-mobile-www: missing expected source file ${file}`);
    }

    if (file.endsWith('.html')) {
      let html = fs.readFileSync(srcPath, 'utf8');
      html = mobileHeadInjections(html, file);
      if (file === 'index.html') {
        html = stripAdSense(html, file);
      }
      fs.writeFileSync(destPath, html);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  fs.copyFileSync(path.join(ROOT, 'scripts', 'mobile-app.css'), path.join(WWW, 'mobile-app.css'));

  console.log(`build-mobile-www: wrote ${FILES_TO_COPY.length + 1} files to ${path.relative(ROOT, WWW)}/`);
}

build();
