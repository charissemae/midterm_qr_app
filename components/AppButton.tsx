import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '@/constants/colors';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: ButtonVariant;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export default function AppButton({
  title,
  icon,
  theme,
  variant,
  onPress,
  disabled = false,
  compact = false,
}: Props) {
  const buttonVariant = variant ?? theme ?? 'secondary';
  const isPrimary = buttonVariant === 'primary';
  const isDanger = buttonVariant === 'danger';
  const iconColor = isPrimary
    ? COLORS.textOnPrimary
    : isDanger
      ? COLORS.danger
      : COLORS.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        isPrimary && styles.primary,
        buttonVariant === 'secondary' && styles.secondary,
        isDanger && styles.danger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={compact ? 18 : 20} color={iconColor} />
      <Text
        style={[
          styles.label,
          compact && styles.compactLabel,
          isPrimary && styles.primaryLabel,
          isDanger && styles.dangerLabel,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 13,
    marginBottom: 0,
  },
  primary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  secondary: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  danger: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.danger,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  compactLabel: {
    fontSize: 13.5,
    marginLeft: 8,
  },
  primaryLabel: {
    color: COLORS.textOnPrimary,
  },
  dangerLabel: {
    color: COLORS.danger,
  },
});
