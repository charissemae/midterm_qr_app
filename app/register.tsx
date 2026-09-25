import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');

  const handleRegister = async () => {
    setError(null);
    if (!email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        role,
      });
      if (authError) {
        setError(authError.message);
      } else if (data?.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
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
              <Text style={styles.title}>Create account</Text>
            </View>

            {success ? (
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={28} color={COLORS.success} />
                </View>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successText}>
                  Verify your account at {email}, then sign in to continue.
                </Text>
                <Link href="/login" style={styles.successLink}>
                  <Text style={styles.successLinkText}>Back to sign in</Text>
                </Link>
              </View>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="person-outline" size={18} color={COLORS.textTertiary} />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>

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
                    placeholder="At least 6 characters"
                    placeholderTextColor={COLORS.textTertiary}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.textTertiary} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor={COLORS.textTertiary}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <Text style={styles.label}>Role</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: role === 'student' }}
                    style={({ pressed }) => [
                      styles.roleOption,
                      role === 'student' && styles.roleOptionActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setRole('student')}
                    disabled={loading}
                  >
                    <Ionicons
                      name="school-outline"
                      size={18}
                      color={role === 'student' ? COLORS.primaryDark : COLORS.textTertiary}
                    />
                    <Text
                      style={[
                        styles.roleText,
                        role === 'student' && styles.roleTextActive,
                      ]}
                    >
                      Student
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: role === 'teacher' }}
                    style={({ pressed }) => [
                      styles.roleOption,
                      role === 'teacher' && styles.roleOptionActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setRole('teacher')}
                    disabled={loading}
                  >
                    <Ionicons
                      name="easel-outline"
                      size={18}
                      color={role === 'teacher' ? COLORS.primaryDark : COLORS.textTertiary}
                    />
                    <Text
                      style={[
                        styles.roleText,
                        role === 'teacher' && styles.roleTextActive,
                      ]}
                    >
                      Teacher
                    </Text>
                  </Pressable>
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
                    title="Create account"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
            )}

            {!success ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already registered?</Text>
                <Link href="/login" style={styles.link}>
                  <Text style={styles.linkText}>Sign in</Text>
                </Link>
              </View>
            ) : null}
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
    marginTop: 42,
    marginBottom: 22,
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
    marginTop: 15,
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
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  roleOptionActive: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primarySoft,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  roleTextActive: {
    color: COLORS.primaryDark,
  },
  pressed: {
    opacity: 0.8,
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
  successCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 26,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 7,
  },
  successText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 9,
    marginBottom: 20,
  },
  successLink: {
    paddingVertical: 4,
  },
  successLinkText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
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
