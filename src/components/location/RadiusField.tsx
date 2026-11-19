import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { MAX_RADIUS_M, MIN_RADIUS_M } from '@/constants/location';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type RadiusFieldProps = {
  value: number | null;
  onChange: (radiusM: number | null) => void;
  min?: number;
  max?: number;
  error?: string;
  style?: StyleProp<ViewStyle>;
};

export function RadiusField({
  value,
  onChange,
  min = MIN_RADIUS_M,
  max = MAX_RADIUS_M,
  error,
  style,
}: RadiusFieldProps) {
  const hint = `Rentang ${min}–${max} meter.`;
  const textValue = value !== null && value !== undefined ? String(value) : '';

  const handleChangeText = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '') {
      onChange(null);
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      onChange(null);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      onChange(null);
      return;
    }

    onChange(parsed);
  };

  return (
    <Card style={style}>
      <View style={styles.content}>
        <Text style={styles.title}>Radius presensi</Text>
        <Text style={styles.description}>
          Batas jarak dalam meter dari titik presensi lab yang masih dianggap berada di dalam area.
        </Text>
        <TextField
          label="Radius (meter)"
          value={textValue}
          onChangeText={handleChangeText}
          keyboardType="numeric"
          hint={hint}
          error={error}
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
