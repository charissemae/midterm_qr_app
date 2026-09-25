import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
};

export default function Header({ title }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.brandRow}>
        <View style={styles.mark}>
          <Ionicons name="grid-outline" size={21} color={COLORS.textOnPrimary} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.accentMark}>
          <View style={[styles.accentSquare, styles.accentSky]} />
          <View style={[styles.accentSquare, styles.accentSakura]} />
          <View style={[styles.accentSquare, styles.accentMint]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: COLORS.textPrimary,
  },
  accentMark: {
    width: 31,
    height: 31,
    position: 'relative',
  },
  accentSquare: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
  },
  accentSky: {
    top: 0,
    left: 8,
    backgroundColor: COLORS.sky,
  },
  accentSakura: {
    top: 16,
    left: 0,
    backgroundColor: COLORS.sakura,
  },
  accentMint: {
    top: 16,
    right: 0,
    backgroundColor: COLORS.mint,
  },
});
