import { StyleSheet, Text, View } from 'react-native';

import { isLabsLoading, pickLabName, resolveLabText } from '@/components/session/labText';
import { StatusBadge } from '@/components/session/StatusBadge';
import { formatSessionTime } from '@/components/session/sessionTime';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useLabForSession, useSyncState } from '@/store/appStore';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { Attendance, Izin, Session } from '@/types';
import { formatTime } from '@/utils/time';

export type TodaySessionCardProps = {
  item: {
    session: Session;
    attendance: Attendance | null;
    izin: Izin | null;
    canAttend: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
};

type StatusPillTone = 'success' | 'info';

function StatusPill({ label, tone }: { label: string; tone: StatusPillTone }) {
  const { bg, text } = colors.feedback[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillLabel, { color: text }]}>{label}</Text>
    </View>
  );
}

export function TodaySessionCard({ item, isSelected, onSelect }: TodaySessionCardProps) {
  const { session, attendance, izin, canAttend } = item;
  const lab = useLabForSession(session.id);
  const labNama = resolveLabText(
    pickLabName(session.labId, lab?.nama, isLabsLoading(useSyncState('labs'))),
    session.ruang,
  ).text;

  return (
    <Card style={[styles.card, isSelected && styles.selectedCard]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {session.praktikum}
          </Text>
          <StatusBadge status={session.status} />
        </View>

        <View style={styles.infoList}>
          <Text style={styles.infoText}>
            Kelas: <Text style={styles.infoBold}>{session.kelas}</Text>
          </Text>
          <Text style={styles.infoText}>
            Waktu: <Text style={styles.infoBold}>{formatSessionTime(session)}</Text>
          </Text>
          <Text style={styles.infoText}>
            Lab: <Text style={styles.infoBold}>{labNama}</Text>
          </Text>
        </View>

        <View style={styles.footerRow}>
          {attendance ? (
            <StatusPill
              label={`Sudah hadir pukul ${formatTime(attendance.timestamp)}`}
              tone="success"
            />
          ) : izin?.status === 'approved' ? (
            <StatusPill label="Izin disetujui" tone="info" />
          ) : session.status === 'scheduled' ? (
            <Text style={styles.statusNote}>
              Sesi belum dibuka (mulai pukul {formatTime(session.startAt)})
            </Text>
          ) : session.status === 'closed' ? (
            <Text style={styles.statusNote}>Sesi ditutup</Text>
          ) : canAttend ? (
            <View style={styles.attendAction}>
              <Text style={styles.statusNote}>Belum presensi</Text>
              <Button
                label="Presensi"
                accessibilityLabel={`Presensi ${session.praktikum}`}
                variant={isSelected ? 'primary' : 'secondary'}
                onPress={onSelect}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const BORDER_WIDTH = 1;

const styles = StyleSheet.create({
  card: {
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border,
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  content: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    flex: 1,
  },
  infoList: {
    gap: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.textMuted,
  },
  infoBold: {
    ...typography.body,
    color: colors.text,
    fontWeight: typography.label.fontWeight,
  },
  footerRow: {
    alignItems: 'flex-start',
  },
  statusNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  attendAction: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillLabel: typography.label,
});
