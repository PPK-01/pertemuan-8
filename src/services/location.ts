import * as Location from 'expo-location';
import type { LocationPermissionResponse } from 'expo-location';
import { Linking, Platform } from 'react-native';

import { DEV_FAKE_POSITION, LOCATION_TIMEOUT_MS, MAX_ACCURACY_M } from '@/constants/location';
import type { DevicePosition, LocationStatus } from '@/types';
import { devWarn } from './devLog';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

/**
 * Memeriksa status izin lokasi di latar depan (foreground).
 */
export async function getPermission(): Promise<LocationPermissionResponse> {
  try {
    return await Location.getForegroundPermissionsAsync();
  } catch (err) {
    devWarn('location-getPermission', err);
    return {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: true,
      expires: 'never',
    };
  }
}

/**
 * Meminta izin lokasi di latar depan (foreground).
 */
export async function requestPermission(): Promise<LocationPermissionResponse> {
  try {
    return await Location.requestForegroundPermissionsAsync();
  } catch (err) {
    devWarn('location-requestPermission', err);
    return {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    };
  }
}

/**
 * Membuka pengaturan aplikasi di sistem operasi perangkat (Android/iOS).
 */
export async function openSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    devWarn('location-openSettings', err);
  }
}

/**
 * Memeriksa apakah layanan lokasi perangkat (GPS) sedang aktif.
 */
export async function isServicesEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Boolean(typeof navigator !== 'undefined' && navigator.geolocation);
  }
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * Menampilkan dialog sistem Android untuk mengaktifkan layanan lokasi presisi tinggi.
 * Mengembalikan true bila layanan kini aktif, false bila ditolak atau gagal.
 */
export async function requestEnableServices(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
      return await isServicesEnabled();
    } catch {
      return false;
    }
  }
  return isServicesEnabled();
}

/**
 * Menghitung jarak geodesik antara dua titik koordinat (meter) menggunakan rumus Haversine.
 * Fungsi murni, hasil dibulatkan ke bilangan bulat terdekat.
 */
export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000; // Radius rata-rata bumi dalam meter
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(
    Math.sqrt(Math.max(0, Math.min(1, h))),
    Math.sqrt(Math.max(0, 1 - h)),
  );
  return Math.round(R * c);
}

/**
 * Mengambil posisi perangkat satu kali dengan batas timeout (default 15 detik).
 * Mengembalikan status lokasi dan data posisi jika berhasil.
 */
export async function getPosition(
  timeoutMs: number = LOCATION_TIMEOUT_MS,
): Promise<{ status: LocationStatus; position: DevicePosition | null }> {
  // 1. Posisi tiruan pengembangan (__DEV__) untuk pengujian radius (SRS §3.5)
  if (isDev && DEV_FAKE_POSITION) {
    return {
      status: 'ready',
      position: DEV_FAKE_POSITION,
    };
  }

  // 2. Ketersediaan platform web
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { status: 'unavailable', position: null };
    }
  }

  // 3. Izin lokasi
  try {
    const perm = await getPermission();
    if (!perm.granted) {
      const status: LocationStatus = perm.canAskAgain
        ? 'permission_denied'
        : 'permission_blocked';
      return { status, position: null };
    }
  } catch {
    return { status: 'permission_denied', position: null };
  }

  // 4. Layanan lokasi aktif
  try {
    const servicesOn = await isServicesEnabled();
    if (!servicesOn) {
      return { status: 'services_off', position: null };
    }
  } catch {
    return { status: 'services_off', position: null };
  }

  // 5. Ambil posisi dengan batas waktu timeout
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('LOCATION_TIMEOUT'));
      }, timeoutMs);
    });

    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });

    const loc = await Promise.race([positionPromise, timeoutPromise]);

    const akurasiM = loc.coords.accuracy ?? 999;
    const mocked = Boolean(loc.mocked);
    const position: DevicePosition = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      akurasiM,
      mocked,
      at: new Date(loc.timestamp).toISOString(),
    };

    if (mocked) {
      return { status: 'mocked', position };
    }
    if (akurasiM > MAX_ACCURACY_M) {
      return { status: 'low_accuracy', position };
    }
    return { status: 'ready', position };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('LOCATION_TIMEOUT') || errMsg.toLowerCase().includes('timeout')) {
      return { status: 'timeout', position: null };
    }
    if (errMsg.toLowerCase().includes('denied') || errMsg.toLowerCase().includes('permission')) {
      return { status: 'permission_denied', position: null };
    }
    if (
      errMsg.toLowerCase().includes('provider') ||
      errMsg.toLowerCase().includes('disabled') ||
      errMsg.toLowerCase().includes('service')
    ) {
      return { status: 'services_off', position: null };
    }
    return { status: 'unavailable', position: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fungsi cleanup kosong bertanda khusus untuk menandai bahwa watcher tidak aktif berjalan
 * (misalnya karena izin belum diberikan atau layanan lokasi mati).
 */
export const NOOP_WATCH_CLEANUP = () => {};

/**
 * Berlangganan perubahan posisi perangkat secara berkala di latar depan (foreground).
 * Memakai akurasi seimbang (Balanced), interval 5 detik atau 5 meter (NFR-13, NFR-18).
 * Mengembalikan fungsi cleanup untuk membatalkan langganan.
 */
export async function watchPosition(
  callback: (result: { status: LocationStatus; position: DevicePosition | null }) => void,
): Promise<() => void> {
  if (isDev && DEV_FAKE_POSITION) {
    callback({ status: 'ready', position: DEV_FAKE_POSITION });
    return () => {};
  }

  if (Platform.OS === 'web' && (typeof navigator === 'undefined' || !navigator.geolocation)) {
    callback({ status: 'unavailable', position: null });
    return NOOP_WATCH_CLEANUP;
  }

  const perm = await getPermission();
  if (!perm.granted) {
    callback({
      status: perm.canAskAgain ? 'permission_denied' : 'permission_blocked',
      position: null,
    });
    return NOOP_WATCH_CLEANUP;
  }

  const servicesOn = await isServicesEnabled();
  if (!servicesOn) {
    callback({ status: 'services_off', position: null });
    return NOOP_WATCH_CLEANUP;
  }

  try {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 5,
        mayShowUserSettingsDialog: true,
      },
      (loc) => {
        const akurasiM = loc.coords.accuracy ?? 999;
        const mocked = Boolean(loc.mocked);
        const position: DevicePosition = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          akurasiM,
          mocked,
          at: new Date(loc.timestamp).toISOString(),
        };
        if (mocked) {
          callback({ status: 'mocked', position });
        } else if (akurasiM > MAX_ACCURACY_M) {
          callback({ status: 'low_accuracy', position });
        } else {
          callback({ status: 'ready', position });
        }
      },
    );

    return () => {
      sub.remove();
    };
  } catch (err) {
    devWarn('location-watchPosition', err);
    callback({ status: 'unavailable', position: null });
    return NOOP_WATCH_CLEANUP;
  }
}
