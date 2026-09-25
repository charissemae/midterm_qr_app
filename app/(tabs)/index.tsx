import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';

export default function Index() {
  return (
    <View style={styles.container}>
      <Header title="Home" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Make every scan count.</Text>
          </View>
          <View style={styles.motif}>
            <View style={styles.motifRing} />
            <View style={styles.motifCard}>
              <Ionicons name="qr-code" size={62} color={COLORS.textPrimary} />
            </View>
            <View style={styles.motifDotOne} />
            <View style={styles.motifDotTwo} />
            <View style={styles.motifDotThree} />
          </View>
        </View>

        <AppButton
          theme="primary"
          title="Scan attendance"
          icon="scan-outline"
          onPress={() => router.push('/scan')}
        />

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Quick access</Text>
          </View>
          <View style={styles.sectionRule} />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => router.push('/history')}
          >
            <View style={[styles.actionIcon, styles.historyIcon]}>
              <Ionicons name="time-outline" size={21} color={COLORS.textPrimary} />
            </View>
            <Text style={styles.actionTitle}>History</Text>
            <Ionicons name="arrow-forward" size={17} color={COLORS.primaryDark} style={styles.actionArrow} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => router.push('/profile')}
          >
            <View style={[styles.actionIcon, styles.profileIcon]}>
              <Ionicons name="person-outline" size={21} color={COLORS.textPrimary} />
            </View>
            <Text style={styles.actionTitle}>Profile</Text>
            <Ionicons name="arrow-forward" size={17} color={COLORS.primaryDark} style={styles.actionArrow} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 30,
  },
  hero: {
    minHeight: 246,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  heroOrbOne: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -95,
    right: -55,
    backgroundColor: COLORS.mint,
    opacity: 0.7,
  },
  heroOrbTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: -78,
    left: -42,
    backgroundColor: COLORS.sakura,
    opacity: 0.58,
  },
  heroCopy: {
    padding: 22,
    zIndex: 2,
  },
  heroTitle: {
    maxWidth: 215,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.7,
    color: COLORS.textPrimary,
    marginTop: 0,
  },
  motif: {
    position: 'absolute',
    width: 150,
    height: 150,
    right: 9,
    bottom: 18,
  },
  motifRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    opacity: 0.45,
  },
  motifCard: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 27,
    right: 17,
    bottom: 17,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  motifDotOne: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 5,
    top: 7,
    right: 8,
    backgroundColor: COLORS.sakura,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
  },
  motifDotTwo: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 4,
    bottom: 5,
    right: 4,
    backgroundColor: COLORS.sky,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
  },
  motifDotThree: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 3,
    top: 48,
    left: 4,
    backgroundColor: COLORS.mint,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    position: 'relative',
  },
  actionPressed: {
    backgroundColor: COLORS.surfaceMuted,
    transform: [{ scale: 0.985 }],
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  historyIcon: {
    backgroundColor: COLORS.sakura,
  },
  profileIcon: {
    backgroundColor: COLORS.sky,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  actionArrow: {
    position: 'absolute',
    right: 13,
    bottom: 15,
  },
});
