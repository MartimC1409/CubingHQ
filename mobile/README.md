# CubingHQ mobile

An Expo shell that wraps the CubingHQ web app (the static site at the repo
root) in a native iOS/Android container, built with `expo-dev-client` so the
app runs as a development build rather than in Expo Go.

## Configure the web app URL

The shell loads whatever `webAppUrl` points at. Set it in `app.json`:

```json
"extra": { "webAppUrl": "https://cubinghq.com" }
```

To run the shell against a local checkout, serve the repo root and override
the URL with a LAN address (`localhost` won't resolve from a phone):

```sh
# from the repo root, in another terminal
npx serve -l 8080 .

# then
EXPO_PUBLIC_WEB_APP_URL=http://192.168.1.10:8080 npx expo start
```

## Run it

```sh
npm install
npx expo start          # loads into a development build
```

`expo-dev-client` means the JS bundle attaches to a native development build,
so a build has to exist on the device first:

```sh
npx expo run:ios        # local build, needs Xcode on macOS
npx expo run:android    # local build, needs Android Studio
```

## Build with EAS

```sh
npm install -g eas-cli
eas login
eas build --platform ios --profile development   # simulator/internal build
eas build --platform ios --profile production    # App Store build
```

The `development` and `preview` profiles produce iOS simulator builds;
`production` produces a store-signed archive and needs an Apple Developer
account for credentials.

## Notes

- Navigation stays inside the WebView for the app's own host and
  `worldcubeassociation.org` (so WCA OAuth sign-in completes); every other
  link opens in the system browser.
- The Android hardware back button walks the web app's history before
  exiting.
- The web app itself pulls `cubing.net`, Google Fonts, and Chart.js from CDNs,
  so the shell needs a network connection regardless of where it's hosted.
