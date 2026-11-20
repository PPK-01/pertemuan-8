import { StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { LabFormBase } from '@/features/lab/LabFormBase';
import type { LabFormMapSlot, LabFormProps } from '@/features/lab/LabFormBase';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type { LabFormFeedback, LabFormProps } from '@/features/lab/LabFormBase';

const BORDER_WIDTH = 1;

function ManualCoordinatePanel({
  latText,
  lngText,
  latError,
  lngError,
  onChangeLatText,
  onChangeLngText,
}: LabFormMapSlot) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Koordinat lab</Text>
      <Text style={styles.description}>
        {'Peta tidak tersedia di web. Isi koordinat secara manual atau tekan "Pakai lokasi saya sekarang" bila perangkat mengizinkan lokasi.'}
      </Text>
      <TextField
        label="Latitude"
        value={latText}
        onChangeText={onChangeLatText}
        placeholder="Mis. -7.770123"
        keyboardType="numeric"
        error={latError}
      />
      <TextField
        label="Longitude"
        value={lngText}
        onChangeText={onChangeLngText}
        placeholder="Mis. 110.370123"
        keyboardType="numeric"
        error={lngError}
      />
      <Text style={styles.coordinate}>{`Koordinat: ${latText || '—'}, ${lngText || '—'}`}</Text>
    </View>
  );
}

export function LabForm(props: LabFormProps) {
  return <LabFormBase {...props} renderMap={(slot) => <ManualCoordinatePanel {...slot} />} />;
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: { ...typography.heading, color: colors.text },
  description: { ...typography.caption, color: colors.textMuted },
  coordinate: { ...typography.caption, color: colors.textMuted },
});
