import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (e) {
  console.warn('WebView not available', e);
}

export default function LearnScreen() {
  const { accessToken } = useAuth();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const injectedConfig = useMemo(
    () =>
      `window.__APP_CONFIG__ = ${JSON.stringify({
        apiBaseUrl: API_BASE_URL,
        accessToken,
      })}; true;`,
    [accessToken],
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/stocklearn.html'));
        if (Platform.OS === 'web') {
          if (!isMounted) return;
          setUri(asset.uri);
          return;
        }
        await asset.downloadAsync();
        if (!isMounted) return;
        setUri(asset.localUri || asset.uri);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Unable to load lesson module.');
      }
    };

    load();

    return () => {
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
      }
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!uri) return;
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
    }
    readyTimeoutRef.current = setTimeout(() => {
      setError('Lesson module failed to initialize. No ready signal received.');
    }, 7000);
  }, [uri]);

  if (!WebView && Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>WebView missing</Text>
        <Text style={styles.errorText}>
          Install react-native-webview to render the gamified learning module.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Lesson load failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>If this persists, ensure the device has internet access.</Text>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading lesson module…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          src={
            uri
              ? `${uri}?apiBaseUrl=${encodeURIComponent(API_BASE_URL)}&accessToken=${encodeURIComponent(
                  accessToken || '',
                )}`
              : undefined
          }
          style={styles.webIframe as any}
          onLoad={() => {
            setIsReady(true);
            if (readyTimeoutRef.current) {
              clearTimeout(readyTimeoutRef.current);
            }
          }}
          title="Gamified Learning"
        />
      ) : (
        <WebView
          source={{ uri }}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={injectedConfig}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          onError={(event: any) => {
            const msg = event?.nativeEvent?.description || 'WebView failed to load content.';
            setError(msg);
            if (readyTimeoutRef.current) {
              clearTimeout(readyTimeoutRef.current);
            }
          }}
          onHttpError={(event: any) => {
            const status = event?.nativeEvent?.statusCode;
            const desc = event?.nativeEvent?.description || 'HTTP error';
            setError(`WebView HTTP error ${status}: ${desc}`);
            if (readyTimeoutRef.current) {
              clearTimeout(readyTimeoutRef.current);
            }
          }}
          onMessage={(event: any) => {
            const data = event?.nativeEvent?.data;
            if (data === 'ready') {
              setIsReady(true);
              if (readyTimeoutRef.current) {
                clearTimeout(readyTimeoutRef.current);
              }
              return;
            }
            if (typeof data === 'string' && data.startsWith('error:')) {
              setError(data.replace('error:', '').trim());
              if (readyTimeoutRef.current) {
                clearTimeout(readyTimeoutRef.current);
              }
            }
          }}
          style={styles.webview}
        />
      )}
      {!isReady && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading lesson module…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1E',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0F1E',
  },
  webIframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0B0F1E',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F1E',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
