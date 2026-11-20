import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { CameraRef, PressEvent, PressEventWithFeatures } from '@maplibre/maplibre-react-native';

import { Banner } from '@/components/ui/Banner';
import { LabFormBase } from '@/features/lab/LabFormBase';
import type { LabFormMapSlot, LabFormProps } from '@/features/lab/LabFormBase';
import { buildRadiusPolygon } from '@/features/lab/radiusPolygon';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export type { LabFormFeedback, LabFormProps } from '@/features/lab/LabFormBase';

const INITIAL_LAT = -7.770123;
const INITIAL_LNG = 110.370123;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const CAMERA_ZOOM = 16;
const RADIUS_SOURCE_ID = 'lab-radius-source';
const RADIUS_FILL_LAYER_ID = 'lab-radius-fill';
const RADIUS_LINE_LAYER_ID = 'lab-radius-line';

type LatLngTuple = [number, number];

function LabMapCanvas({
  lat,
  lng,
  radiusM,
  latText,
  lngText,
  latError,
  lngError,
  centerNonce,
  onPickCoordinate,
}: LabFormMapSlot) {
  const cameraRef = useRef<CameraRef>(null);
  const lastCenterNonce = useRef(centerNonce);

  useEffect(() => {
    if (centerNonce === lastCenterNonce.current) {
      return;
    }
    lastCenterNonce.current = centerNonce;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    cameraRef.current?.flyTo({
      center: [lng, lat],
      zoom: CAMERA_ZOOM,
      duration: 600,
    });
  }, [centerNonce, lat, lng]);

  const hasValidCenter =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  const center: LatLngTuple = hasValidCenter ? [lng, lat] : [INITIAL_LNG, INITIAL_LAT];
  const radiusPolygon = hasValidCenter ? buildRadiusPolygon(lat, lng, radiusM) : null;

  function handleMapPress(
    event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
  ) {
    const { lngLat } = event.nativeEvent as PressEvent;
    onPickCoordinate(lngLat[1], lngLat[0]);
  }

  return (
    <>
      <View style={styles.mapContainer}>
        <Map
          mapStyle={MAP_STYLE}
          style={styles.map}
          attribution
          onPress={handleMapPress}
          accessibilityLabel="Peta lokasi lab. Ketuk peta untuk memindahkan titik lab."
        >
          <Camera ref={cameraRef} initialViewState={{ center, zoom: CAMERA_ZOOM }} />
          {radiusPolygon ? (
            <>
              <GeoJSONSource id={RADIUS_SOURCE_ID} data={radiusPolygon} />
              <Layer
                id={RADIUS_FILL_LAYER_ID}
                type="fill"
                source={RADIUS_SOURCE_ID}
                paint={{ 'fill-color': colors.primary, 'fill-opacity': 0.2 }}
              />
              <Layer
                id={RADIUS_LINE_LAYER_ID}
                type="line"
                source={RADIUS_SOURCE_ID}
                paint={{ 'line-color': colors.primary, 'line-width': 2 }}
              />
            </>
          ) : null}
          {hasValidCenter ? (
            <Marker lngLat={[lng, lat]}>
              <View accessible accessibilityLabel="Titik lab" style={styles.marker}>
                <View style={styles.markerDot} />
              </View>
            </Marker>
          ) : null}
        </Map>
      </View>
      <Text style={styles.coordinate}>{`Koordinat: ${latText || '—'}, ${lngText || '—'}`}</Text>
      {latError || lngError ? (
        <Banner tone="danger" message={latError ?? lngError ?? ''} />
      ) : null}
      <Text style={styles.hint}>Ketuk peta untuk memindahkan titik lab.</Text>
      <Text style={styles.attribution}>Peta © OpenStreetMap contributors</Text>
    </>
  );
}

export function LabForm(props: LabFormProps) {
  return <LabFormBase {...props} renderMap={(slot) => <LabMapCanvas {...slot} />} />;
}

const styles = StyleSheet.create({
  mapContainer: { height: 300 },
  map: { width: '100%', height: '100%' },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onPrimary },
  coordinate: { ...typography.caption, color: colors.textMuted },
  attribution: { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
  hint: { ...typography.caption, color: colors.textMuted },
});
