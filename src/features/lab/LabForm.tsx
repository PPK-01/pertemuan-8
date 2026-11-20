import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { Camera, Map, GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import type { CameraRef, PressEvent, PressEventWithFeatures } from '@maplibre/maplibre-react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { RadiusField } from '@/components/location/RadiusField';
import { DEFAULT_RADIUS_M } from '@/constants/location';
import { useLocation } from '@/store/appStore';
import { validateLabInput } from '@/features/lab/labValidation';
import type { LabValidationError } from '@/features/lab/labValidation';
import type { CreateLabInput, Lab, LabId } from '@/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

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
};

const INITIAL_LAT = -7.770123;
const INITIAL_LNG = 110.370123;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const CAMERA_ZOOM = 16;
const RADIUS_SOURCE_ID = 'lab-radius-source';
const RADIUS_LAYER_ID = 'lab-radius-layer';
// Perkiraan resolusi peta pada CAMERA_ZOOM di lintang Yogyakarta (meter per piksel).
const METERS_PER_PIXEL =
  (156543.03392 * Math.cos((INITIAL_LAT * Math.PI) / 180)) / 2 ** CAMERA_ZOOM;

type LatLngTuple = [number, number];

export function LabForm({
  lab,
  labs = [],
  onSubmit,
  onDelete,
  submitting = false,
  submitLabel,
  submitError,
  disabledHint,
}: LabFormProps) {
  const isEdit = lab != null;
  const { position } = useLocation();
  const cameraRef = useRef<CameraRef>(null);
  const isWeb = Platform.OS === 'web';

  const [nama, setNama] = useState(lab?.nama ?? '');
  const [gedung, setGedung] = useState(lab?.gedung ?? '');
  const [lat, setLat] = useState(lab?.lat ?? INITIAL_LAT);
  const [lng, setLng] = useState(lab?.lng ?? INITIAL_LNG);
  const [radiusM, setRadiusM] = useState<number | null>(lab?.radiusM ?? DEFAULT_RADIUS_M);
  const [attempted, setAttempted] = useState(false);

  const existingLabs = useMemo(() => labs.filter((item) => item.id !== lab?.id), [labs, lab?.id]);

  const input = useMemo<CreateLabInput>(
    () => ({
      nama: nama.trim(),
      ...(gedung.trim() ? { gedung: gedung.trim() } : {}),
      lat,
      lng,
      radiusM: radiusM ?? DEFAULT_RADIUS_M,
    }),
    [nama, gedung, lat, lng, radiusM],
  );

  const validationError = useMemo<LabValidationError | null>(() => {
    if (radiusM === null) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Radius wajib diisi.' };
    }
    return validateLabInput(input, existingLabs, lab?.id);
  }, [input, radiusM, existingLabs, lab?.id]);

  const validationMessage = attempted && validationError ? validationError.message : undefined;

  function handleSubmit() {
    setAttempted(true);
    if (validationError === null && radiusM !== null) {
      onSubmit({ ...input, radiusM });
    }
  }

  function handleUseMyLocation() {
    if (!position) {
      return;
    }
    setLat(position.lat);
    setLng(position.lng);
    cameraRef.current?.flyTo({ center: [position.lng, position.lat], zoom: CAMERA_ZOOM, duration: 600 });
  }

  function handleMapPress(
    event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
  ) {
    const { lngLat } = event.nativeEvent as PressEvent;
    setLat(lngLat[1]);
    setLng(lngLat[0]);
  }

  const markerPosition: LatLngTuple = [lng, lat];
  const displayRadiusM = radiusM ?? DEFAULT_RADIUS_M;
  const circleRadiusPx = Math.max(12, displayRadiusM / METERS_PER_PIXEL);

  const radiusSourceData = {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [lng, lat] as [number, number],
    },
    properties: { radiusM: displayRadiusM },
  };

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        <TextField
          label="Nama lab"
          value={nama}
          onChangeText={setNama}
          placeholder="Mis. Lab Pemrograman Dasar"
          error={validationMessage}
          maxLength={50}
        />
        <TextField
          label="Gedung"
          value={gedung}
          onChangeText={setGedung}
          placeholder="Mis. Gedung A"
          hint="Opsional"
          maxLength={60}
        />
        <RadiusField value={radiusM} onChange={setRadiusM} error={validationMessage} />
      </View>

      <View style={styles.mapContainer}>
        {isWeb ? (
          <View style={styles.mapFallback}>
            <Text style={styles.mapFallbackText}>
              {'Peta tidak tersedia di web. Atur koordinat dengan tombol "Pakai lokasi saya sekarang".'}
            </Text>
          </View>
        ) : (
          <Map mapStyle={MAP_STYLE} style={styles.map} attribution onPress={handleMapPress}>
            <Camera ref={cameraRef} initialViewState={{ center: [lng, lat], zoom: CAMERA_ZOOM }} />
            <GeoJSONSource id={RADIUS_SOURCE_ID} data={radiusSourceData} />
            <Layer
              id={RADIUS_LAYER_ID}
              type="circle"
              source={RADIUS_SOURCE_ID}
              paint={{
                'circle-radius': circleRadiusPx,
                'circle-color': colors.primary,
                'circle-opacity': 0.2,
              }}
            />
            <Marker lngLat={markerPosition}>
              <View style={styles.marker}>
                <View style={styles.markerDot} />
              </View>
            </Marker>
          </Map>
        )}
      </View>
      <Text style={styles.coordinate}>{`Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`}</Text>
      {isWeb ? null : <Text style={styles.hint}>Ketuk peta untuk memindahkan titik lab.</Text>}
      <Text style={styles.attribution}>Peta © OpenStreetMap contributors</Text>

      <Button
        label="Pakai lokasi saya sekarang"
        variant="secondary"
        onPress={handleUseMyLocation}
        disabled={!position || submitting}
      />
      {position ? null : (
        <Text style={styles.hint}>Lokasi perangkat belum tersedia atau izin lokasi belum diberikan.</Text>
      )}

      <View style={styles.actions}>
        {validationMessage ? (
          <Banner key="validation" tone="danger" message={validationMessage} />
        ) : submitError ? (
          <Banner key={submitError.id} tone="danger" message={submitError.message} />
        ) : null}
        <Button
          label={submitLabel ?? (isEdit ? 'Simpan perubahan' : 'Buat lab')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={disabledHint !== undefined}
        />
        {disabledHint ? <Text style={styles.hint}>{disabledHint}</Text> : null}
        {isEdit && onDelete ? (
          <Button label="Hapus lab" onPress={() => onDelete(lab!.id)} variant="danger" disabled={submitting} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  fields: { gap: spacing.md },
  mapContainer: { height: 300 },
  map: { width: '100%', height: '100%' },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  mapFallbackText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  marker: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onPrimary },
  coordinate: { ...typography.caption, color: colors.textMuted },
  attribution: { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
  actions: { gap: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
});
