import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.decorTop} />
        <View pointerEvents="none" style={styles.decorBottom} />
        <View style={styles.card}>
          <View style={styles.mark}>
            <Ionicons name="grid-outline" size={25} color={COLORS.textOnPrimary} />
          </View>
          <Text style={styles.title}>Page not found</Text>
          <Text style={styles.subtitle}>The screen you requested is unavailable.</Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Return home</Text>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  decorTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -90,
    right: -70,
    backgroundColor: COLORS.mint,
    opacity: 0.55,
  },
  decorBottom: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -80,
    left: -50,
    backgroundColor: COLORS.sakura,
    opacity: 0.5,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  mark: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginTop: 0,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 20,
  },
  link: {
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
});
