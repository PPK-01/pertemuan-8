import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LocationStatusCard } from '@/components/location/LocationStatusCard';
import type { LocationStatusCardAction } from '@/components/location/LocationStatusCard';
import { PermissionPrompt } from '@/components/location/PermissionPrompt';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CodeInput } from '@/components/ui/CodeInput';
import { DEFAULT_RADIUS_M } from '@/constants/location';
import { getAttendFailMessage } from '@/features/praktikan/attendMessages';
import {
  useAppStore,
  useDistanceToLab,
  useLocation,
} from '@/store/appStore';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { Lab, Session } from '@/types';

const SESSION_CODE_LENGTH = 4;

export type PresensiLokasiFormProps = {
  session: Session;
  lab: Lab | null;
  code: string;
  onChangeCode: (code: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isOnline: boolean;
  error?: string | null;
};

export function PresensiLokasiForm({
  session,
  lab,
  code,
  onChangeCode,
  onSubmit,
  isSubmitting,
  isOnline,
  error,
}: PresensiLokasiFormProps) {
  const location = useLocation();
  const distanceInfo = useDistanceToLab(lab?.id);

  const requestLocation = useAppStore((state) => state.requestLocation);
  const refreshLocation = useAppStore((state) => state.refreshLocation);
  const openLocationSettings = useAppStore((state) => state.openLocationSettings);
  const enableLocationServices = useAppStore((state) => state.enableLocationServices);

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  const labName = lab?.nama || session.ruang || 'Lab belum diatur';
  const radiusM = lab?.radiusM ?? DEFAULT_RADIUS_M;
  const jarakM = distanceInfo?.jarakM ?? null;
  const inRadius = distanceInfo?.didalamRadius ?? false;

  const canSubmit =
    isOnline &&
    location.status === 'ready' &&
    inRadius &&
    code.length === SESSION_CODE_LENGTH &&
    !isSubmitting;

  const handleAction = async (actionFn: () => Promise<unknown>) => {
    setIsActionLoading(true);
    try {
      await actionFn();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRequestLocation = () => {
    setHasRequestedPermission(true);
    void handleAction(requestLocation);
  };

  const showPermissionPrompt =
    location.status === 'idle' ||
    (location.status === 'permission_denied' && !hasRequestedPermission);

  const getCardAction = (): LocationStatusCardAction | undefined => {
    switch (location.status) {
      case 'idle':
      case 'permission_denied':
        return {
          label: location.status === 'idle' ? 'Izinkan lokasi' : 'Coba lagi',
          onPress: handleRequestLocation,
          loading: isActionLoading,
        };
      case 'permission_blocked':
        return {
          label: 'Buka Pengaturan',
          onPress: () => void handleAction(openLocationSettings),
        };
      case 'services_off':
        return {
          label: 'Aktifkan lokasi',
          onPress: () => void handleAction(enableLocationServices),
          loading: isActionLoading,
        };
      case 'low_accuracy':
      case 'timeout':
      case 'ready':
      case 'checking':
        return {
          label: 'Perbarui lokasi',
          onPress: () => void handleAction(refreshLocation),
          loading: isActionLoading || location.status === 'checking',
        };
      case 'mocked':
      case 'unavailable':
        return undefined;
    }
  };

  return (
    <View style={styles.container}>
      {!isOnline ? (
        <Banner tone="danger" message={getAttendFailMessage('NO_CONNECTION')} />
      ) : null}

      {showPermissionPrompt ? (
        <PermissionPrompt
          title="Izin Lokasi"
          explanation="Rawuh membutuhkan lokasimu untuk memastikan kamu berada di lab saat presensi."
          primaryAction={{
            label: 'Izinkan lokasi',
            onPress: handleRequestLocation,
            loading: isActionLoading,
          }}
        />
      ) : (
        <LocationStatusCard
          status={location.status}
          labName={labName}
          jarakM={jarakM}
          radiusM={radiusM}
          akurasiM={location.position?.akurasiM ?? null}
          action={getCardAction()}
        />
      )}

      {!lab ? (
        <Banner tone="danger" message={getAttendFailMessage('NO_LAB')} />
      ) : null}

      <Card>
        <View style={styles.formContent}>
          <View style={styles.copy}>
            <Text style={styles.title}>Kode Sesi</Text>
            <Text style={styles.description}>
              Masukkan 4 digit kode yang diberikan oleh asisten.
            </Text>
          </View>

          <CodeInput
            value={code}
            onChange={onChangeCode}
            error={error ?? undefined}
          />

          <Button
            label="Presensi"
            onPress={onSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  formContent: {
    gap: spacing.md,
    alignItems: 'stretch',
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
  },
});
