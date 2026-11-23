import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { LabInfoSheet } from '@/components/location/LabInfoSheet';
import { LocationStatusCard } from '@/components/location/LocationStatusCard';
import type { LocationStatusCardAction } from '@/components/location/LocationStatusCard';
import { PermissionPrompt } from '@/components/location/PermissionPrompt';
import { Banner } from '@/components/ui/Banner';
import { DEFAULT_RADIUS_M } from '@/constants/location';
import { LabMarker } from '@/features/lab/LabMarker';
import {
  useAppStore,
  useDistanceToLab,
  useIsOnline,
  useLabActivity,
  useLabs,
  useLocation,
  useWatchPosition,
} from '@/store/appStore';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { Lab } from '@/types';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER_LAT = -7.770123;
const DEFAULT_CENTER_LNG = 110.370123;
const DEFAULT_ZOOM = 16;

export type LabMapProps = {
  role?: 'praktikan' | 'asisten';
};

export function LabMap({ role = 'praktikan' }: LabMapProps) {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(true);
  useWatchPosition(isFocused);

  const labs = useLabs();
  const location = useLocation();
  const isOnline = useIsOnline();

  const sessions = useAppStore((state) => state.sessions);
  const refreshLocation = useAppStore((state) => state.refreshLocation);
  const requestLocation = useAppStore((state) => state.requestLocation);
  const openLocationSettings = useAppStore((state) => state.openLocationSettings);
  const enableLocationServices = useAppStore((state) => state.enableLocationServices);

  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  const cameraRef = useRef<CameraRef>(null);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      void refreshLocation();
      return () => {
        setIsFocused(false);
      };
    }, [refreshLocation]),
  );

  const selectedLab = useMemo(
    () => (selectedLabId ? labs.find((l) => l.id === selectedLabId) ?? (labs[0] ?? null) : (labs[0] ?? null)),
    [labs, selectedLabId],
  );

  const labActivity = useLabActivity(selectedLab?.id);
  const distanceInfo = useDistanceToLab(selectedLab?.id);

  // Lab IDs with open sessions for FR-48
  const labsWithOpenSession = useMemo(() => {
    const openSet = new Set<string>();
    for (const s of sessions) {
      if (s.status === 'open' && s.labId) {
        openSet.add(s.labId);
      }
    }
    return openSet;
  }, [sessions]);

  // Initial center coordinates
  const initialCenter: [number, number] = useMemo(() => {
    if (location.position?.lng && location.position?.lat) {
      return [location.position.lng, location.position.lat];
    }
    if (labs.length > 0) {
      return [labs[0].lng, labs[0].lat];
    }
    return [DEFAULT_CENTER_LNG, DEFAULT_CENTER_LAT];
  }, [location.position, labs]);

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

  // Navigasi ke posisi pengguna
  const handleFlyToMyLocation = () => {
    if (location.position) {
      cameraRef.current?.flyTo({
        center: [location.position.lng, location.position.lat],
        zoom: DEFAULT_ZOOM,
        duration: 800,
      });
    } else {
      void handleAction(refreshLocation);
    }
  };

  // Navigasi untuk melihat semua lab (fit bounds)
  const handleFitAllLabs = () => {
    if (labs.length === 0) return;

    if (labs.length === 1) {
      cameraRef.current?.flyTo({
        center: [labs[0].lng, labs[0].lat],
        zoom: DEFAULT_ZOOM,
        duration: 800,
      });
      return;
    }

    let minLng = labs[0].lng;
    let maxLng = labs[0].lng;
    let minLat = labs[0].lat;
    let maxLat = labs[0].lat;

    // Jika posisi pengguna ada, ikut sertakan dalam bounds
    if (location.position) {
      minLng = Math.min(minLng, location.position.lng);
      maxLng = Math.max(maxLng, location.position.lng);
      minLat = Math.min(minLat, location.position.lat);
      maxLat = Math.max(maxLat, location.position.lat);
    }

    for (const lab of labs) {
      if (lab.lng < minLng) minLng = lab.lng;
      if (lab.lng > maxLng) maxLng = lab.lng;
      if (lab.lat < minLat) minLat = lab.lat;
      if (lab.lat > maxLat) maxLat = lab.lat;
    }

    cameraRef.current?.fitBounds([minLng, minLat, maxLng, maxLat], {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      duration: 800,
    });
  };

  const handleSelectLab = (lab: Lab) => {
    setSelectedLabId(lab.id);
    cameraRef.current?.flyTo({
      center: [lab.lng, lab.lat],
      zoom: DEFAULT_ZOOM,
      duration: 600,
    });
  };

  const handleSelectSession = (sessionId: string) => {
    if (role === 'asisten') {
      router.push(`/asisten/sesi/${sessionId}`);
    } else {
      router.push(`/praktikan/sesi/${sessionId}`);
    }
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
      {/* Area Peta */}
      <View style={styles.mapContainer}>
        <Map
          mapStyle={MAP_STYLE}
          style={styles.map}
          attribution
          accessibilityLabel="Peta laboratorium dan lokasi perangkat"
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: initialCenter,
              zoom: DEFAULT_ZOOM,
            }}
          />

          {/* Marker Posisi Perangkat Sendiri */}
          {location.position ? (
            <Marker lngLat={[location.position.lng, location.position.lat]}>
              <View
                accessible
                accessibilityRole="none"
                aria-label="Posisiku saat ini"
                style={styles.userMarker}
              >
                <View style={styles.userMarkerPulse} />
                <View style={styles.userMarkerCore} />
              </View>
            </Marker>
          ) : null}

          {/* Marker Semua Lab */}
          {labs.map((lab) => (
            <LabMarker
              key={lab.id}
              lab={lab}
              hasOpenSession={labsWithOpenSession.has(lab.id)}
              isSelected={selectedLab?.id === lab.id}
              onPress={() => handleSelectLab(lab)}
            />
          ))}
        </Map>

        {/* Tombol Kontrol Peta: Ke posisiku & Lihat semua lab */}
        <View style={styles.mapControls}>
          <Pressable
            accessibilityRole="button"
            aria-label="Ke posisiku"
            onPress={handleFlyToMyLocation}
            style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
          >
            <Text style={styles.controlButtonText}>Ke posisiku</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            aria-label="Lihat semua lab"
            onPress={handleFitAllLabs}
            style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
          >
            <Text style={styles.controlButtonText}>Lihat semua lab</Text>
          </Pressable>
        </View>

        {/* Atribusi OpenStreetMap wajib tampil (FR-44) */}
        <View style={styles.attributionContainer} pointerEvents="none">
          <Text style={styles.attributionText}>Peta © OpenStreetMap contributors</Text>
        </View>
      </View>

      {/* Bagian Bawah: Panel Izin/Status Lokasi & LabInfoSheet */}
      <View style={styles.bottomSection}>
        {/* Banner Offline FR-58 */}
        {!isOnline ? (
          <Banner
            tone="info"
            message="Kamu sedang offline. Data aktivitas lab mungkin belum terbaru."
          />
        ) : null}

        {/* Penanganan Izin / Status Lokasi bila bermasalah */}
        {location.status !== 'ready' ? (
          <View style={styles.statusSection}>
            {showPermissionPrompt ? (
              <PermissionPrompt
                title="Izin Lokasi"
                explanation="Rawuh membutuhkan lokasimu untuk menampilkan jarak ke lab dan posisimu di peta."
                primaryAction={{
                  label: 'Izinkan lokasi',
                  onPress: handleRequestLocation,
                  loading: isActionLoading,
                }}
              />
            ) : (
              <LocationStatusCard
                status={location.status}
                labName={selectedLab?.nama ?? 'Lab'}
                jarakM={distanceInfo?.jarakM ?? null}
                radiusM={selectedLab?.radiusM ?? DEFAULT_RADIUS_M}
                akurasiM={location.position?.akurasiM ?? null}
                action={getCardAction()}
              />
            )}
          </View>
        ) : null}

        {/* Panel Informasi Lab Terpilih */}
        {selectedLab ? (
          <LabInfoSheet
            lab={selectedLab}
            berlangsung={labActivity.berlangsung}
            berikutnya={labActivity.berikutnya}
            jarakM={distanceInfo?.jarakM ?? null}
            onPilihSesi={handleSelectSession}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Belum ada data laboratorium.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
    minHeight: 250,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapControls: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
    zIndex: 20,
  },
  controlButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  controlButtonPressed: {
    backgroundColor: colors.border,
  },
  controlButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  attributionContainer: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  attributionText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textMuted,
  },
  userMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    opacity: 0.35,
  },
  userMarkerCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  bottomSection: {
    maxHeight: '50%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  statusSection: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
