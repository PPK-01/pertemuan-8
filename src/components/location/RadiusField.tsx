import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type RadiusFieldProps = {
  value: number;
  onChange: (radiusM: number) => void;
  min?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
};

export function RadiusField({ value, onChange, min, max, style }: RadiusFieldProps) {
  const hint = min != null && max != null ? `Rentang ${min}–${max} meter.` : undefined;

  return (
    <Card style={style}>
      <View style={styles.content}>
        <Text style={styles.title}>Radius presensi</Text>
        <Text style={styles.description}>
          Batas jarak dalam meter dari titik presensi lab yang masih dianggap berada di dalam area.
        </Text>
        <TextField
          label="Radius (meter)"
          value={String(value)}
          onChangeText={(text) => {
            const parsed = parseInt(text, 10);
            onChange(Number.isNaN(parsed) ? 0 : parsed);
          }}
          keyboardType="numeric"
          hint={hint}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  title: { ...typography.heading, color: colors.text },
  description: { ...typography.body, color: colors.textMuted },
});
