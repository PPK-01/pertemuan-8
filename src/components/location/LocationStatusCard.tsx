import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { ButtonProps } from '@/components/ui/Button';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { LocationStatus } from '@/types';

export type LocationStatusCardAction = Pick<
  ButtonProps,
  'label' | 'onPress' | 'variant' | 'loading' | 'disabled'
>;

export type LocationStatusCardProps = {
  status: LocationStatus;
  labName: string;
  jarakM: number | null;
  radiusM: number;
  akurasiM: number | null;
  action?: LocationStatusCardAction;
  style?: StyleProp<ViewStyle>;
};

type StatusVisual = {
  title: string;
  message: string;
  tone: 'success' | 'danger' | 'info' | 'warning';
};

function describeStatus(
  status: LocationStatus,
  context: { labName: string; jarakM: number | null; radiusM: number; akurasiM: number | null },
): StatusVisual {
  switch (status) {
    case 'ready': {
      const dalamRadius = context.jarakM !== null && context.jarakM <= context.radiusM;
      if (dalamRadius) {
        return {
          title: 'Di dalam radius',
          message: `Kamu berada di area lab ${context.labName}.`,
          tone: 'success',
        };
      }
      return {
        title: 'Di luar radius',
        message:
          context.jarakM === null
            ? `Kamu berada di luar area lab ${context.labName}.`
            : `Kamu berada ${context.jarakM} m dari ${context.labName}. Mendekatlah hingga ${context.radiusM} m.`,
        tone: 'warning',
      };
    }
    case 'checking':
      return { title: 'Mengecek lokasi', message: 'Menentukan posisi perangkat…', tone: 'info' };
    case 'idle':
      return {
        title: 'Menunggu lokasi',
        message: 'Rawuh membutuhkan lokasimu untuk memastikan kamu berada di lab saat presensi.',
        tone: 'info',
      };
    case 'permission_denied':
      return { title: 'Akses lokasi ditolak', message: 'Presensi membutuhkan lokasimu.', tone: 'danger' };
    case 'permission_blocked':
      return { title: 'Akses lokasi diblokir', message: 'Aktifkan di Pengaturan aplikasi.', tone: 'danger' };
    case 'services_off':
      return { title: 'Layanan lokasi tidak aktif', message: 'Layanan lokasi di HP-mu tidak aktif.', tone: 'warning' };
    case 'low_accuracy':
      return {
        title: 'Lokasi belum akurat',
        message: `Lokasi belum akurat (±${context.akurasiM ?? 0} m). Pindah ke dekat jendela atau tempat terbuka, lalu perbarui.`,
        tone: 'warning',
      };
    case 'mocked':
      return { title: 'Lokasi palsu terdeteksi', message: 'Matikan aplikasi pengubah lokasi.', tone: 'danger' };
    case 'timeout':
      return { title: 'Lokasi belum didapat', message: 'Pastikan GPS aktif lalu coba lagi.', tone: 'warning' };
    case 'unavailable':
      return { title: 'Lokasi tidak tersedia', message: 'Lokasi tidak tersedia di perangkat ini.', tone: 'danger' };
  }
}

export function LocationStatusCard({
  status,
  labName,
  jarakM,
  radiusM,
  akurasiM,
  action,
  style,
}: LocationStatusCardProps) {
  const visual = describeStatus(status, { labName, jarakM, radiusM, akurasiM });
  const { bg, text } = colors.feedback[visual.tone];

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: text }, style]}>
      <Text style={[styles.title, { color: text }]}>{visual.title}</Text>
      <Text style={[styles.message, { color: text }]}>{visual.message}</Text>
      {status === 'ready' ? (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Jarak</Text>
            <Text style={styles.detailValue}>{jarakM != null ? `${jarakM} m` : '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Radius</Text>
            <Text style={styles.detailValue}>{`${radiusM} m`}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Akurasi</Text>
            <Text style={styles.detailValue}>{akurasiM != null ? `±${akurasiM} m` : '—'}</Text>
          </View>
        </View>
      ) : null}
      {action ? <Button {...action} /> : null}
    </View>
  );
}

// Garis tepi tipis sama dengan Card, Banner, dan Button; belum ada token lebar garis.
const BORDER_WIDTH = 1;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: BORDER_WIDTH,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.heading, color: colors.text },
  message: { ...typography.body, color: colors.text },
  details: { gap: spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailLabel: { ...typography.caption, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontVariant: ['tabular-nums'] },
});
