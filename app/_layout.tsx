import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { AuthProvider, useAuth } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AuthProvider>
  );
}

function AppNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();

  if (loading) {
    return <LoadingState />;
  }

  const path = segments?.[0];
  const inAuthGroup = path === 'login' || path === 'register';
  const inTabsGroup = path === '(tabs)';

  return (
    <>
      {!session && inTabsGroup && <Redirect href="/login" />}
      {session && inAuthGroup && <Redirect href="/(tabs)" />}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingOrbTop} />
      <View style={styles.loadingOrbBottom} />
      <View style={styles.loadingMark}>
        <Ionicons name="grid-outline" size={28} color={COLORS.textOnPrimary} />
      </View>
      <Text style={styles.loadingBrand}>QR-ATT</Text>
      <ActivityIndicator size="small" color={COLORS.primaryDark} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  loadingOrbTop: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -80,
    right: -55,
    backgroundColor: COLORS.mint,
    opacity: 0.5,
  },
  loadingOrbBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -65,
    left: -45,
    backgroundColor: COLORS.sakura,
    opacity: 0.45,
  },
  loadingMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingBrand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: COLORS.textPrimary,
  },
  spinner: {
    marginTop: 20,
  },
});
