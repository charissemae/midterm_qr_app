import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.badgeMark}>
          <Text style={styles.badgeMarkText}>Q</Text>
        </View>
      </View>

      <View style={styles.bodyContainer}>
        <Text style={styles.mainTitle}>School event attendance</Text>
        <Text style={styles.subtitle}>
          Scan QR codes to record attendance during school activities.
        </Text>
      </View>

      <View style={styles.footerContainer}>
        <AppButton
          theme="primary"
          title="Scan QR code"
          icon="qr-code-outline"
          onPress={() => router.push('/scan')}
        />
        <AppButton
          title="Attendance history"
          icon="time-outline"
          onPress={() => router.push('/history')}
        />
        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push('/profile')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badgeMark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMarkText: { color: COLORS.textOnPrimary, fontSize: 24, fontWeight: '700' },
  bodyContainer: { paddingHorizontal: 32, marginBottom: 16 },
  mainTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 21 },
  footerContainer: { flex: 1 / 3, alignItems: 'center', paddingHorizontal: 24, width: '100%' },
});