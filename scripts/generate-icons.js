#!/usr/bin/env node
// One-off asset generator for native app icons + splash screens. Renders the
// site's existing cube-grid brand mark (see the inline SVG favicon in
// index.html) via headless Chromium at each exact resolution Capacitor's
// `cap add` scaffolding created, and writes straight to those paths.
//
// Not wired into `npm run build:mobile` — icons rarely change, and this
// needs Playwright + a Chromium binary (present in this dev container at
// /opt/pw-browsers, or `npm i -D playwright-core` elsewhere).
//
// Usage: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    const globalRoot = require('child_process')
      .execSync('npm root -g')
      .toString()
      .trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const { chromium } = loadPlaywright();
const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const BG = '#0B0D17';
const SQUARES = [
  ['#FF6B35', '#F7C948', '#2ECC71'],
  ['#E74C3C', '#6366F1', '#3498DB'],
  ['#9B59B6', '#1ABC9C', '#FF6B35'],
];

// Matches the favicon markup in index.html: a 32x32 viewBox, 8x8 rounded
// squares on a 10-unit grid (2 unit margin/gap).
function cubeSvg() {
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 2 + col * 10;
      const y = 2 + row * 10;
      cells.push(`<rect x="${x}" y="${y}" width="8" height="8" rx="1.5" fill="${SQUARES[row][col]}"/>`);
    }
  }
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${cells.join('')}</svg>`;
}

function pageHtml({ width, height, transparent, logoFraction, withWordmark }) {
  const logoSize = Math.round(Math.min(width, height) * logoFraction);
  const wordmark = withWordmark
    ? `<div style="margin-top:${Math.round(logoSize * 0.35)}px;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-weight:800;font-size:${Math.round(
        logoSize * 0.34
      )}px;letter-spacing:-0.02em;display:flex;">
         <span style="color:#F5F6FA;">Cubing</span><span style="background:linear-gradient(135deg,#6366F1,#F97316);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">HQ</span>
       </div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:${width}px; height:${height}px; background:${transparent ? 'transparent' : BG}; }
    body { display:flex; align-items:center; justify-content:center; flex-direction:column; }
    .logo { width:${logoSize}px; height:${logoSize}px; }
  </style></head><body>
    <div class="logo">${cubeSvg()}</div>
    ${wordmark}
  </body></html>`;
}

async function render(page, destPath, opts) {
  await page.setViewportSize({ width: opts.width, height: opts.height });
  await page.setContent(pageHtml(opts));
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await page.screenshot({ path: destPath, omitBackground: !!opts.transparent });
  console.log(`  wrote ${path.relative(ROOT, destPath)} (${opts.width}x${opts.height})`);
}

const FLAT_ICON_TARGETS = [
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024],
  ['android/app/src/main/res/mipmap-mdpi/ic_launcher.png', 48, 48],
  ['android/app/src/main/res/mipmap-hdpi/ic_launcher.png', 72, 72],
  ['android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', 96, 96],
  ['android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', 144, 144],
  ['android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 192, 192],
  ['android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png', 48, 48],
  ['android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png', 72, 72],
  ['android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', 96, 96],
  ['android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png', 144, 144],
  ['android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png', 192, 192],
];

const FOREGROUND_ICON_TARGETS = [
  ['android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png', 108, 108],
  ['android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png', 162, 162],
  ['android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png', 216, 216],
  ['android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png', 324, 324],
  ['android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', 432, 432],
];

const SPLASH_TARGETS = [
  ['ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png', 2732, 2732],
  ['ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png', 2732, 2732],
  ['ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png', 2732, 2732],
  ['android/app/src/main/res/drawable/splash.png', 480, 320],
  ['android/app/src/main/res/drawable-land-mdpi/splash.png', 480, 320],
  ['android/app/src/main/res/drawable-land-hdpi/splash.png', 800, 480],
  ['android/app/src/main/res/drawable-land-xhdpi/splash.png', 1280, 720],
  ['android/app/src/main/res/drawable-land-xxhdpi/splash.png', 1600, 960],
  ['android/app/src/main/res/drawable-land-xxxhdpi/splash.png', 1920, 1280],
  ['android/app/src/main/res/drawable-port-mdpi/splash.png', 320, 480],
  ['android/app/src/main/res/drawable-port-hdpi/splash.png', 480, 800],
  ['android/app/src/main/res/drawable-port-xhdpi/splash.png', 720, 1280],
  ['android/app/src/main/res/drawable-port-xxhdpi/splash.png', 960, 1600],
  ['android/app/src/main/res/drawable-port-xxxhdpi/splash.png', 1280, 1920],
];

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage();

  console.log('Flat app icons (opaque background, platform applies its own mask):');
  for (const [rel, w, h] of FLAT_ICON_TARGETS) {
    await render(page, path.join(ROOT, rel), { width: w, height: h, transparent: false, logoFraction: 0.66 });
  }

  console.log('Android adaptive icon foregrounds (transparent, safe-zone padded):');
  for (const [rel, w, h] of FOREGROUND_ICON_TARGETS) {
    await render(page, path.join(ROOT, rel), { width: w, height: h, transparent: true, logoFraction: 0.66 });
  }

  console.log('Splash screens:');
  for (const [rel, w, h] of SPLASH_TARGETS) {
    await render(page, path.join(ROOT, rel), {
      width: w,
      height: h,
      transparent: false,
      logoFraction: 0.22,
      withWordmark: true,
    });
  }

  await browser.close();

  // Adaptive icon background color (was Capacitor's default white).
  const bgColorXml = path.join(ROOT, 'android/app/src/main/res/values/ic_launcher_background.xml');
  fs.writeFileSync(
    bgColorXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`
  );
  console.log(`  updated ${path.relative(ROOT, bgColorXml)} -> ${BG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
