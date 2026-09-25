import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import {
  ensureProfile,
  getProfile,
  updateProfile,
  type Profile,
} from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    let nextProfile = await getProfile(user.id);
    if (!nextProfile) {
      await ensureProfile(user.id, user.email);
      nextProfile = await getProfile(user.id);
    }
    setProfile(nextProfile);
    setDraftName(nextProfile?.full_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateProfile(user.id, {
      full_name: draftName.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((previous) => {
        const base =
          previous ?? {
            id: user.id,
            email: user.email ?? '',
            full_name: null,
            role: 'student' as const,
          };
        return { ...base, full_name: draftName.trim() };
      });
      setEditing(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  const displayName = profile?.full_name?.trim() || 'Add your name';
  const initial = displayName.charAt(0).toUpperCase() || 'Q';
  const isTeacher = profile?.role === 'teacher';
  const roleLabel = profile ? (isTeacher ? 'Teacher' : 'Student') : 'Member';

  return (
    <View style={styles.container}>
      <Header title="Profile" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityCard}>
          <View style={styles.identityTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
              <View style={styles.avatarAccent} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.identityName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <View style={[styles.roleBadge, isTeacher ? styles.teacherBadge : styles.studentBadge]}>
              <Text style={[styles.roleBadgeText, isTeacher ? styles.teacherBadgeText : styles.studentBadgeText]}>
                {roleLabel}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.nameSection}>
            <Text style={styles.sectionLabel}>Display name</Text>
            {editing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.nameInput}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Your full name"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="words"
                  editable={!saving}
                />
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.saveButton,
                    saving && styles.saveButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleSaveName}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>{saving ? '...' : 'Save'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}
                onPress={() => setEditing(true)}
              >
                <Text style={styles.nameValue}>{profile?.full_name || 'Tap to add your name'}</Text>
                <View style={styles.editAction}>
                  <Text style={styles.editText}>Edit</Text>
                  <Ionicons name="pencil-outline" size={15} color={COLORS.primaryDark} />
                </View>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-outline" size={19} color={COLORS.textPrimary} />
            </View>
            <View>
              <Text style={styles.accountTitle}>Account details</Text>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {user?.email || 'Not available'}
            </Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Account ID</Text>
            <Text style={styles.fieldValueSmall} numberOfLines={1} ellipsizeMode="middle">
              {user?.id || 'Not available'}
            </Text>
          </View>
        </View>

        <View style={styles.signOutWrap}>
          <AppButton
            variant="danger"
            title="Sign out"
            icon="log-out-outline"
            onPress={handleSignOut}
            disabled={loading}
          />
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
    paddingBottom: 34,
  },
  identityCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: COLORS.mint,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  avatarAccent: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 5,
    right: -3,
    bottom: -3,
    backgroundColor: COLORS.matcha,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  identityCopy: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },
  identityName: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  roleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  teacherBadge: {
    backgroundColor: COLORS.sakura,
    borderColor: COLORS.tanDeep,
  },
  studentBadge: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryDark,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  teacherBadgeText: {
    color: COLORS.tanDeep,
  },
  studentBadgeText: {
    color: COLORS.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 17,
  },
  nameSection: {
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: COLORS.textTertiary,
    marginBottom: 8,
  },
  nameRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  editAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  saveButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textOnPrimary,
  },
  pressed: {
    opacity: 0.78,
  },
  accountCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    marginTop: 15,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  accountIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: COLORS.sky,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  accountTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  field: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  fieldValueSmall: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  signOutWrap: {
    marginTop: 23,
  },
});
