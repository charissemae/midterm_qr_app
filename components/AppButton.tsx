import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({ title, icon, theme, onPress, disabled }: Props) {
  if (theme === 'primary') {
    return (
      <View
        style={[
          styles.buttonOuter,
          { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 12 },
          disabled && styles.disabled,
        ]}
      >
        <Pressable
          style={[styles.buttonInner, { backgroundColor: COLORS.primary }]}
          onPress={onPress}
          disabled={disabled}
        >
          <Ionicons
            name={icon}
            size={20}
            color={COLORS.textOnPrimary}
            style={styles.icon}
          />
          <Text style={[styles.label, styles.labelPrimary, { color: COLORS.textOnPrimary }]}>
            {title}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.buttonOuter, disabled && styles.disabled]}>
      <Pressable style={styles.buttonInner} onPress={onPress} disabled={disabled}>
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.textSecondary}
          style={styles.icon}
        />
        <Text style={styles.label}>{title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    marginBottom: 14,
  },
  buttonInner: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: { paddingRight: 10 },
  label: {
    fontSize: 15.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  labelPrimary: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});