import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { StatusBadge } from '@/components/session/StatusBadge';
import { formatSessionTime, sessionTimeText } from '@/components/session/sessionTime';
import { STATUS_LABEL } from '@/components/session/statusLabel';
import { PRESSED_OPACITY } from '@/components/ui/pressable';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { Lab, Session } from '@/types';

export type LabInfoSheetProps = {
  lab: Lab | null;
  berlangsung: Session[];
  berikutnya: Session[];
  onPilihSesi?: (sessionId: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function LabInfoSheet({
  lab,
  berlangsung,
  berikutnya,
  onPilihSesi,
  style,
}: LabInfoSheetProps) {
  return (
    <View style={[styles.panel, style]}>
      <Text style={styles.labName}>{lab?.nama ?? 'Lab belum diatur'}</Text>
      {lab?.gedung ? <Text style={styles.gedung}>{lab.gedung}</Text> : null}

      {berlangsung.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sedang berlangsung</Text>
          {berlangsung.map((session) => (
            <SessionInfoRow key={session.id} session={session} onPilihSesi={onPilihSesi} />
          ))}
        </View>
      ) : null}

      {berikutnya.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Berikutnya</Text>
          {berikutnya.map((session) => (
            <SessionInfoRow key={session.id} session={session} onPilihSesi={onPilihSesi} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type SessionInfoRowProps = {
  session: Session;
  onPilihSesi?: (sessionId: string) => void;
};

function SessionInfoRow({ session, onPilihSesi }: SessionInfoRowProps) {
  return (
    <Pressable
      onPress={() => onPilihSesi?.(session.id)}
      disabled={!onPilihSesi}
      role="button"
      // Status dibacakan dengan teks yang sama dengan badge, bukan nilai mentah ('open').
      aria-label={`${session.praktikum}, Kelas ${session.kelas}, ${session.topik}, ${STATUS_LABEL[session.status]}`}
      style={({ pressed }) => [styles.row, pressed && onPilihSesi && { opacity: PRESSED_OPACITY }]}
    >
      <View style={styles.topLine}>
        <Text style={styles.praktikum} numberOfLines={1}>
          {session.praktikum}
        </Text>
        <StatusBadge status={session.status} />
      </View>

      <Text style={styles.topik} numberOfLines={2}>
        {session.topik}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Kelas:</Text>
        <Text style={styles.metaValue}>{session.kelas}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Waktu:</Text>
        <Text style={[styles.metaValue, sessionTimeText]}>{formatSessionTime(session)}</Text>
      </View>
    </Pressable>
  );
}

// Garis tepi tipis sama dengan Card, Banner, dan Button; belum ada token lebar garis.
const BORDER_WIDTH = 1;

const TOPIK_LINE_HEIGHT = 22;

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: BORDER_WIDTH,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
    gap: spacing.md,
  },
  labName: { ...typography.title, color: colors.text },
  gedung: { ...typography.caption, color: colors.textMuted },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.textMuted },
  row: {
    minHeight: layout.minTouch,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  praktikum: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.primary,
    flex: 1,
  },
  topik: {
    fontSize: typography.body.fontSize,
    lineHeight: TOPIK_LINE_HEIGHT,
    fontWeight: '600',
    color: colors.text,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaLabel: { ...typography.caption, color: colors.textMuted },
  metaValue: { ...typography.caption, color: colors.text, fontWeight: typography.label.fontWeight },
});
