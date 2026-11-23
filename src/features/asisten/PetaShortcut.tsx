import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/ui/pressable';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type PetaShortcutProps = {
  onPress: () => void;
};

/** Pintasan beranda asisten ke peta laboratorium; tampilannya sepadan dengan KelasShortcut. */
export function PetaShortcut({ onPress }: PetaShortcutProps) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label="Peta, lihat persebaran dan aktivitas lab"
      style={({ pressed }) => [styles.button, pressed && { opacity: PRESSED_OPACITY }]}
    >
      <Text style={styles.label}>Peta</Text>
      <View style={styles.spacer} />
      <Text style={styles.hint}>Lihat</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { ...typography.label, color: colors.text },
  spacer: { flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
});
