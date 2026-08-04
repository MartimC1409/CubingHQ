import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

// The CubingHQ web app is the product; this shell hosts it natively. Point
// EXPO_PUBLIC_WEB_APP_URL at a LAN dev server (e.g. http://192.168.1.10:8080)
// to run the shell against a local checkout instead of production.
const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? Constants.expoConfig?.extra?.webAppUrl;

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Anything off these hosts opens in the system browser rather than taking
// over the shell — WCA pages, ad clicks, external algorithm sites.
const INTERNAL_HOSTS = [hostOf(WEB_APP_URL), 'www.worldcubeassociation.org'];

function isInternal(url) {
  return INTERNAL_HOSTS.includes(hostOf(url));
}

export default function App() {
  const webViewRef = useRef(null);
  const canGoBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Android's hardware back button should walk the web app's history before
  // it backs out of the app entirely.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const reload = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleRequest = useCallback((request) => {
    if (isInternal(request.url)) return true;
    // about:blank and data: URLs come from the page itself, not a tap.
    if (request.url.startsWith('http')) Linking.openURL(request.url);
    return false;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {failed ? (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>Can&apos;t reach CubingHQ</Text>
            <Text style={styles.errorBody}>
              Check your connection and try again.
            </Text>
            <Pressable style={styles.retry} onPress={reload}>
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: WEB_APP_URL }}
            style={styles.webview}
            // The simulator uses WebGL and the timer plays audio cues, so let
            // media start without a second tap and stay inline.
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            // Scale-to-fit and bounce fight the web app's own fixed layout.
            scalesPageToFit={false}
            bounces={false}
            overScrollMode="never"
            // Keep the WCA OAuth redirect inside the WebView so sign-in works;
            // hand genuinely external links to the system browser.
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={handleRequest}
            onNavigationStateChange={(navState) => {
              canGoBack.current = navState.canGoBack;
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.statusCode >= 500) {
                setLoading(false);
                setFailed(true);
              }
            }}
          />
        )}

        {loading && !failed ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#a1a1aa" />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  webview: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorBody: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retry: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#27272a',
  },
  retryLabel: {
    color: '#fafafa',
    fontSize: 15,
    fontWeight: '600',
  },
});
