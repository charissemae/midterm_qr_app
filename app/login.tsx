import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: authError } = await signIn(email.trim(), password);
      if (authError) {
        setError(authError.message);
        return;
      }
      const session = data?.session;
      const user = data?.user;
      if (!session) {
        if (user) {
          setError('Email not confirmed yet. Check your inbox, then sign in again.');
        } else {
          setError('No session returned. Please try again.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.decorTop} />
      <View pointerEvents="none" style={styles.decorRight} />
      <View pointerEvents="none" style={styles.decorBottom} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 18}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandRow}>
              <View style={styles.brandLockup}>
                <View style={styles.brandMark}>
                  <Ionicons name="grid-outline" size={23} color={COLORS.textOnPrimary} />
                </View>
                <View>
                  <Text style={styles.brandName}>QR-ATT</Text>
                </View>
              </View>
              <View style={styles.brandAccent}>
                <View style={[styles.brandSquare, styles.brandSquareSky]} />
                <View style={[styles.brandSquare, styles.brandSquareSakura]} />
                <View style={[styles.brandSquare, styles.brandSquareMint]} />
              </View>
            </View>

            <View style={styles.intro}>
              <Text style={styles.title}>Welcome back</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputShell}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textTertiary} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputShell}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textTertiary} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              {error ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Ionicons name="alert-circle-outline" size={17} color={COLORS.danger} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primaryDark}
                  style={styles.loader}
                />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign in"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to QR-ATT?</Text>
              <Link href="/register" style={styles.link}>
                <Text style={styles.linkText}>Create an account</Text>
              </Link>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  decorTop: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -88,
    right: -54,
    backgroundColor: COLORS.mint,
    opacity: 0.58,
  },
  decorRight: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: 210,
    right: -70,
    backgroundColor: COLORS.sakura,
    opacity: 0.5,
  },
  decorBottom: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -85,
    left: -55,
    backgroundColor: COLORS.sky,
    opacity: 0.36,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: COLORS.textPrimary,
  },
  brandAccent: {
    width: 38,
    height: 38,
    position: 'relative',
  },
  brandSquare: {
    position: 'absolute',
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
  },
  brandSquareSky: {
    top: 0,
    left: 10,
    backgroundColor: COLORS.sky,
  },
  brandSquareSakura: {
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.sakura,
  },
  brandSquareMint: {
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.mint,
  },
  intro: {
    marginTop: 48,
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: COLORS.textPrimary,
  },
  formCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 7,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  error: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.danger,
  },
  loader: {
    marginVertical: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  link: {
    marginLeft: 5,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
});
