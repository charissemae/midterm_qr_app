import { useState } from 'react';
import {
  StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, TouchableWithoutFeedback, Keyboard, Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
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
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.badgeMark}>
              <Text style={styles.badgeMarkText}>Q</Text>
            </View>

            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Register to start recording attendance</Text>

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email}. Click the link to verify your
                  account, then come back and sign in.
                </Text>
                <Link href="/login" style={styles.link}>Back to sign in</Link>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input} value={fullName} onChangeText={setFullName}
                  placeholder="Your full name" placeholderTextColor={COLORS.textSecondary} editable={!loading}
                />
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input} value={email} onChangeText={setEmail}
                  placeholder="your.email@school.edu" placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none" keyboardType="email-address" editable={!loading}
                />
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input} value={password} onChangeText={setPassword}
                  placeholder="At least 6 characters" placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry editable={!loading}
                />
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password" placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry editable={!loading}
                />
                <Text style={styles.label}>I am a...</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    style={[styles.roleChip, role === 'student' && styles.roleChipActive]}
                    onPress={() => setRole('student')}
                  >
                    <Text style={[styles.roleChipText, role === 'student' && styles.roleChipTextActive]}>Student</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.roleChip, role === 'teacher' && styles.roleChipActive]}
                    onPress={() => setRole('teacher')}
                  >
                    <Text style={[styles.roleChipText, role === 'teacher' && styles.roleChipTextActive]}>Teacher</Text>
                  </Pressable>
                </View>

                {error && <Text style={styles.error}>{error}</Text>}

                {loading ? (
                  <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                ) : (
                  <AppButton theme="primary" title="Sign up" icon="person-add-outline" onPress={handleRegister} />
                )}
              </View>
            )}

            {!success && (
              <Link href="/login" style={styles.link}>Already have an account? Sign in</Link>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  badgeMark: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  badgeMarkText: { color: COLORS.textOnPrimary, fontSize: 20, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 24 },
  form: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.card, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary,
  },
  error: { fontSize: 13.5, color: COLORS.danger, marginTop: 12, marginBottom: 4 },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  roleChip: {
    flex: 1, paddingVertical: 12, borderRadius: 11, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'center',
  },
  roleChipActive: { borderColor: COLORS.primary, backgroundColor: '#fff' },
  roleChipText: { fontSize: 13.5, fontWeight: '600', color: COLORS.textSecondary },
  roleChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  loader: { marginVertical: 16 },
  link: { fontSize: 13, color: COLORS.primary, textAlign: 'center', fontWeight: '700', marginTop: 4 },
  successContainer: {
    alignItems: 'center', marginBottom: 24, padding: 20,
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  successTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  successText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
});