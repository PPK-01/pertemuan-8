import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SyncErrorState } from '@/components/ui/SyncErrorState';
import { DEFAULT_RADIUS_M } from '@/constants/location';
import { useSyncRetry } from '@/features/asisten/useSyncRetry';
import { getAttendFailMessage } from '@/features/praktikan/attendMessages';
import type { AttendFailParams } from '@/features/praktikan/attendMessages';
import { PresensiLokasiForm } from '@/features/presensi/PresensiLokasiForm';
import { TodaySessionCard } from '@/features/presensi/TodaySessionCard';
import {
  useAppStore,
  useDistanceToLab,
  useIsOnline,
  useLabForSession,
  useLocation,
  useSyncState,
  useTodaySessionsForAttendance,
  useWatchPosition,
} from '@/store/appStore';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AttendFailReason } from '@/types';
import { formatTime } from '@/utils/time';

const SESSION_CODE_LENGTH = 4;
const PRESENSI_SYNC_KEYS = ['sessions', 'attendances', 'izin', 'labs'] as const;

export function PresensiScreen() {
  useWatchPosition(true);

  const todaySessions = useTodaySessionsForAttendance();
  const isOnline = useIsOnline();
  const sessionsSync = useSyncState('sessions');
  const attendancesSync = useSyncState('attendances');
  const syncRetry = useSyncRetry(PRESENSI_SYNC_KEYS);
  const submitAttendance = useAppStore((state) => state.submitAttendance);

  const loadingInitial =
    todaySessions.length === 0 &&
    (sessionsSync === 'loading' || attendancesSync === 'loading');

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const selectedItem = useMemo(() => {
    if (todaySessions.length === 0) return null;
    if (selectedSessionId) {
      const found = todaySessions.find((item) => item.session.id === selectedSessionId);
      if (found) return found;
    }
    return todaySessions.find((item) => item.canAttend) ?? todaySessions[0];
  }, [todaySessions, selectedSessionId]);

  const activeSession = selectedItem?.session ?? null;
  const activeLab = useLabForSession(activeSession?.id);
  const distanceInfo = useDistanceToLab(activeLab?.id);
  const location = useLocation();

  const handleSelectSession = (sessionId: string) => {
    if (selectedItem?.session.id === sessionId) return;
    setSelectedSessionId(sessionId);
    setCode('');
    setSubmitResult(null);
    setFormError(null);
  };

  const handleChangeCode = (value: string) => {
    setCode(value);
    if (formError) setFormError(null);
  };

  const buildFailParams = (reason: AttendFailReason): AttendFailParams | undefined => {
    if (reason === 'OUTSIDE_RADIUS') {
      return {
        x: distanceInfo?.jarakM != null ? Math.round(distanceInfo.jarakM) : undefined,
        lab: activeLab?.nama ?? activeSession?.ruang ?? 'Lab',
        radius: activeLab?.radiusM ?? DEFAULT_RADIUS_M,
      };
    }
    if (reason === 'LOW_ACCURACY') {
      return {
        x:
          location.position?.akurasiM != null
            ? Math.round(location.position.akurasiM)
            : undefined,
      };
    }
    return undefined;
  };

  const handleConfirmAttendance = async () => {
    if (!activeSession || submittingRef.current || code.length !== SESSION_CODE_LENGTH) return;

    submittingRef.current = true;
    setSheetVisible(false);
    setIsSubmitting(true);
    setSubmitResult(null);
    setFormError(null);

    try {
      const res = await submitAttendance(activeSession.id, code);

      if (res.ok) {
        setSubmitResult({
          success: true,
          message: `Presensi berhasil! Tercatat pukul ${formatTime(res.attendance.timestamp)}.`,
        });
        setCode('');
      } else {
        const message = getAttendFailMessage(res.reason, buildFailParams(res.reason));
        if (res.reason === 'INVALID_CODE') {
          setFormError(message);
          setSubmitResult(null);
        } else {
          setSubmitResult({ success: false, message });
        }
      }
    } catch {
      setSubmitResult({ success: false, message: getAttendFailMessage('UNKNOWN') });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const activeLabNama = activeLab?.nama || activeSession?.ruang || 'Lab belum diatur';

  return (
    <View style={styles.flex}>
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          {syncRetry.visible ? (
            <SyncErrorState
              compact
              message={syncRetry.message}
              onRetry={syncRetry.retry}
              retrying={syncRetry.retrying}
            />
          ) : null}

          {loadingInitial ? (
            <LoadingState label="Memuat sesi hari ini…" />
          ) : todaySessions.length === 0 ? (
            syncRetry.visible ? null : (
              <EmptyState
                title="Tidak Ada Sesi Hari Ini"
                message="Belum ada sesi praktikum yang dijadwalkan untuk kelasmu hari ini."
              />
            )
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sesi Hari Ini</Text>
                <View style={styles.sessionList}>
                  {todaySessions.map((item) => (
                    <TodaySessionCard
                      key={item.session.id}
                      item={item}
                      isSelected={selectedItem?.session.id === item.session.id}
                      onSelect={() => handleSelectSession(item.session.id)}
                    />
                  ))}
                </View>
              </View>

              {selectedItem && activeSession ? (
                <View style={styles.section}>
                  {submitResult &&
                  !submitResult.success &&
                  !selectedItem.attendance &&
                  selectedItem.izin?.status !== 'approved' ? (
                    <Banner tone="danger" message={submitResult.message} />
                  ) : null}

                  {selectedItem.attendance ? (
                    <Banner
                      tone="success"
                      title="Presensi Tercatat"
                      message={`Kamu sudah presensi pada sesi ini. Kehadiran tercatat pukul ${formatTime(
                        selectedItem.attendance.timestamp,
                      )}.`}
                    />
                  ) : selectedItem.izin?.status === 'approved' ? (
                    <Banner
                      tone="info"
                      title="Izin Disetujui"
                      message={getAttendFailMessage('IZIN_APPROVED')}
                    />
                  ) : selectedItem.canAttend ? (
                    <>
                      {submitResult?.success ? (
                        <Banner tone="success" message={submitResult.message} />
                      ) : null}

                      <PresensiLokasiForm
                        session={activeSession}
                        lab={activeLab}
                        code={code}
                        onChangeCode={handleChangeCode}
                        onSubmit={() => setSheetVisible(true)}
                        isSubmitting={isSubmitting}
                        isOnline={isOnline}
                        error={formError}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </Screen>

      {activeSession ? (
        <BottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          title="Konfirmasi Presensi"
          secondaryAction={{
            label: 'Batal',
            onPress: () => setSheetVisible(false),
            disabled: isSubmitting,
          }}
          primaryAction={{
            label: 'Konfirmasi',
            onPress: () => void handleConfirmAttendance(),
            loading: isSubmitting,
            disabled: isSubmitting || !isOnline,
          }}
        >
          <View style={styles.sheetRows}>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Praktikum</Text>
              <Text style={styles.sheetValue}>{activeSession.praktikum}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Kelas</Text>
              <Text style={styles.sheetValue}>{activeSession.kelas}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Lab</Text>
              <Text style={styles.sheetValue}>{activeLabNama}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Kode Sesi</Text>
              <Text style={[styles.sheetValue, styles.codeText]}>{code}</Text>
            </View>
          </View>
          <Text style={styles.sheetNote}>
            Kehadiran tidak bisa dibatalkan setelah dikonfirmasi.
          </Text>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const CODE_LETTER_SPACING = 4;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  sessionList: {
    gap: spacing.md,
  },
  sheetRows: {
    gap: spacing.md,
  },
  sheetRow: {
    gap: spacing.xs,
  },
  sheetLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  sheetValue: {
    ...typography.body,
    color: colors.text,
  },
  codeText: {
    ...typography.heading,
    letterSpacing: CODE_LETTER_SPACING,
    fontVariant: ['tabular-nums'],
  },
  sheetNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
