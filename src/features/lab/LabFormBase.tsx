import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LocationStatusCard } from '@/components/location/LocationStatusCard';
import { RadiusField } from '@/components/location/RadiusField';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { DEFAULT_RADIUS_M, MAX_ACCURACY_M } from '@/constants/location';
import {
  validateLabGedung,
  validateLabLat,
  validateLabLng,
  validateLabNama,
  validateLabRadius,
} from '@/features/lab/labValidation';
import type { LabValidationError } from '@/features/lab/labValidation';
import { useAppStore, useLocation } from '@/store/appStore';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { CreateLabInput, Lab, LabId, LocationStatus } from '@/types';

export type LabFormFeedback = { id: number; message: string };

export type LabFormProps = {
  lab?: Lab | null;
  labs?: Lab[];
  onSubmit: (input: CreateLabInput) => void;
  onDelete?: (id: LabId) => void;
  submitting?: boolean;
  submitLabel?: string;
  submitError?: LabFormFeedback | null;
  disabledHint?: string;
  deleteDisabled?: boolean;
};

export type LabFormMapSlot = {
  lat: number;
  lng: number;
  radiusM: number;
  latText: string;
  lngText: string;
  latError?: string;
  lngError?: string;
  centerNonce: number;
  onPickCoordinate: (lat: number, lng: number) => void;
  onChangeLatText: (text: string) => void;
  onChangeLngText: (text: string) => void;
};

type LabFormBaseProps = LabFormProps & {
  renderMap: (slot: LabFormMapSlot) => ReactNode;
};

type LabFormErrors = {
  nama: LabValidationError | null;
  gedung: LabValidationError | null;
  lat: LabValidationError | null;
  lng: LabValidationError | null;
  radius: LabValidationError | null;
};

const INITIAL_LAT = -7.770123;
const INITIAL_LNG = 110.370123;
const DELETE_OFFLINE_HINT = 'Hapus lab tidak tersedia saat offline.';

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function parseCoordinate(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

function validateCoordinateText(text: string, kind: 'lat' | 'lng'): LabValidationError | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: kind === 'lat' ? 'Latitude wajib diisi.' : 'Longitude wajib diisi.',
    };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: kind === 'lat' ? 'Latitude harus berupa angka.' : 'Longitude harus berupa angka.',
    };
  }

  return kind === 'lat' ? validateLabLat(value) : validateLabLng(value);
}

function validateNamaField(nama: string, existingLabs: Lab[]): LabValidationError | null {
  const basicError = validateLabNama(nama);
  if (basicError) {
    return basicError;
  }

  const trimmed = nama.trim().toLowerCase();
  const isDuplicate = existingLabs.some(
    (item) => item.nama.trim().toLowerCase() === trimmed,
  );
  if (isDuplicate) {
    return { ok: false, code: 'DUPLICATE', message: 'Nama lab sudah digunakan.' };
  }

  return null;
}

function hasError(errors: LabFormErrors): boolean {
  return Boolean(errors.nama || errors.gedung || errors.lat || errors.lng || errors.radius);
}

export function LabFormBase({
  lab,
  labs = [],
  onSubmit,
  onDelete,
  submitting = false,
  submitLabel,
  submitError,
  disabledHint,
  deleteDisabled = false,
  renderMap,
}: LabFormBaseProps) {
  const isEdit = lab != null;
  const { status, position } = useLocation();
  const requestLocation = useAppStore((state) => state.requestLocation);
  const refreshLocation = useAppStore((state) => state.refreshLocation);
  const openLocationSettings = useAppStore((state) => state.openLocationSettings);
  const enableLocationServices = useAppStore((state) => state.enableLocationServices);

  const [nama, setNama] = useState(lab?.nama ?? '');
  const [gedung, setGedung] = useState(lab?.gedung ?? '');
  const [latText, setLatText] = useState(() => formatCoordinate(lab?.lat ?? INITIAL_LAT));
  const [lngText, setLngText] = useState(() => formatCoordinate(lab?.lng ?? INITIAL_LNG));
  const [radiusM, setRadiusM] = useState<number | null>(lab?.radiusM ?? DEFAULT_RADIUS_M);
  const [attempted, setAttempted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [centerNonce, setCenterNonce] = useState(0);

  const lat = parseCoordinate(latText);
  const lng = parseCoordinate(lngText);
  const displayRadiusM = radiusM ?? DEFAULT_RADIUS_M;

  const existingLabs = useMemo(
    () => labs.filter((item) => item.id !== lab?.id),
    [labs, lab?.id],
  );

  const input = useMemo<CreateLabInput>(
    () => ({
      nama: nama.trim(),
      gedung: gedung.trim(),
      lat,
      lng,
      radiusM: displayRadiusM,
    }),
    [nama, gedung, lat, lng, displayRadiusM],
  );

  const errors = useMemo<LabFormErrors>(
    () => ({
      nama: validateNamaField(nama, existingLabs),
      gedung: validateLabGedung(gedung),
      lat: validateCoordinateText(latText, 'lat'),
      lng: validateCoordinateText(lngText, 'lng'),
      radius:
        radiusM === null
          ? { ok: false, code: 'INVALID_INPUT', message: 'Radius wajib diisi.' }
          : validateLabRadius(radiusM),
    }),
    [nama, existingLabs, gedung, latText, lngText, radiusM],
  );

  function handleSubmit() {
    setAttempted(true);
    if (!hasError(errors) && radiusM !== null) {
      onSubmit({ ...input, radiusM });
    }
  }

  async function handleUseMyLocation() {
    if (locating || submitting) {
      return;
    }

    setLocating(true);
    try {
      await requestLocation();
      const next = useAppStore.getState().location;
      if (next.status === 'ready' && next.position && !next.position.mocked) {
        setLatText(formatCoordinate(next.position.lat));
        setLngText(formatCoordinate(next.position.lng));
        setCenterNonce((value) => value + 1);
      }
    } finally {
      setLocating(false);
    }
  }

  function handlePickCoordinate(nextLat: number, nextLng: number) {
    setLatText(formatCoordinate(nextLat));
    setLngText(formatCoordinate(nextLng));
  }

  function locationAction(currentStatus: LocationStatus) {
    switch (currentStatus) {
      case 'idle':
        return { label: 'Izinkan lokasi', onPress: () => void handleUseMyLocation() };
      case 'permission_denied':
        return { label: 'Coba lagi', onPress: () => void handleUseMyLocation() };
      case 'permission_blocked':
        return { label: 'Buka Pengaturan', onPress: () => void openLocationSettings() };
      case 'services_off':
        return { label: 'Aktifkan lokasi', onPress: () => void enableLocationServices() };
      case 'low_accuracy':
      case 'timeout':
        return { label: 'Perbarui lokasi', onPress: () => void refreshLocation() };
      default:
        return undefined;
    }
  }

  const latError = attempted ? errors.lat?.message : undefined;
  const lngError = attempted ? errors.lng?.message : undefined;
  const lowAccuracy =
    status === 'ready' && position != null && position.akurasiM > MAX_ACCURACY_M;
  const locationName = nama.trim() || 'lab ini';

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        <TextField
          label="Nama lab"
          value={nama}
          onChangeText={setNama}
          placeholder="Mis. Lab Pemrograman Dasar"
          error={attempted ? errors.nama?.message : undefined}
          maxLength={50}
        />
        <TextField
          label="Gedung"
          value={gedung}
          onChangeText={setGedung}
          placeholder="Mis. Gedung A"
          hint="Opsional"
          error={attempted ? errors.gedung?.message : undefined}
          maxLength={60}
        />
        <RadiusField
          value={radiusM}
          onChange={setRadiusM}
          error={attempted ? errors.radius?.message : undefined}
        />
      </View>

      {renderMap({
        lat,
        lng,
        radiusM: displayRadiusM,
        latText,
        lngText,
        latError,
        lngError,
        centerNonce,
        onPickCoordinate: handlePickCoordinate,
        onChangeLatText: setLatText,
        onChangeLngText: setLngText,
      })}

      <View style={styles.locationSection}>
        <Text style={styles.sectionTitle}>Lokasi perangkat</Text>
        {status === 'ready' && position ? (
          <Card>
            <View style={styles.locationReady}>
              <Text style={styles.locationReadyTitle}>Lokasi perangkat siap</Text>
              <Text style={styles.hint}>
                {`Akurasi ±${Math.round(position.akurasiM)} m. Tekan "Pakai lokasi saya sekarang" untuk menyalin koordinat ke lab.`}
              </Text>
              {lowAccuracy ? (
                <Text style={styles.warning}>
                  {`Akurasi lokasi masih rendah (±${Math.round(position.akurasiM)} m, batas ${MAX_ACCURACY_M} m). Pindah ke dekat jendela atau tempat terbuka lalu perbarui.`}
                </Text>
              ) : null}
              {position.mocked ? (
                <Text style={styles.warning}>
                  Lokasi palsu terdeteksi. Matikan aplikasi pengubah lokasi.
                </Text>
              ) : null}
            </View>
          </Card>
        ) : (
          <LocationStatusCard
            status={status}
            labName={locationName}
            jarakM={null}
            radiusM={displayRadiusM}
            akurasiM={position?.akurasiM ?? null}
            action={locationAction(status)}
          />
        )}

        <Button
          label="Pakai lokasi saya sekarang"
          variant="secondary"
          onPress={() => void handleUseMyLocation()}
          loading={locating}
          disabled={
            submitting ||
            status === 'checking' ||
            status === 'unavailable' ||
            status === 'permission_blocked'
          }
          accessibilityLabel="Pakai lokasi saya sekarang sebagai titik lab"
        />
      </View>

      <View style={styles.actions}>
        {submitError ? (
          <Banner key={submitError.id} tone="danger" message={submitError.message} />
        ) : null}
        <Button
          label={submitLabel ?? (isEdit ? 'Simpan perubahan' : 'Buat lab')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={disabledHint !== undefined}
          accessibilityLabel={submitLabel ?? (isEdit ? 'Simpan perubahan lab' : 'Buat lab')}
        />
        {disabledHint ? <Text style={styles.hint}>{disabledHint}</Text> : null}
        {isEdit && onDelete ? (
          <Button
            label="Hapus lab"
            onPress={() => onDelete(lab.id)}
            variant="danger"
            disabled={submitting || deleteDisabled}
            accessibilityLabel={`Hapus lab ${lab.nama}`}
          />
        ) : null}
        {isEdit && deleteDisabled ? (
          <Text style={styles.hint}>{DELETE_OFFLINE_HINT}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  fields: { gap: spacing.md },
  locationSection: { gap: spacing.md },
  sectionTitle: { ...typography.heading, color: colors.text },
  locationReady: { gap: spacing.xs },
  locationReadyTitle: { ...typography.label, color: colors.text },
  actions: { gap: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
  warning: { ...typography.caption, color: colors.feedback.warning.text },
});
