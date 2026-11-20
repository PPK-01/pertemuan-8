import type { DevicePosition } from '@/types';

/**
 * Konstanta Geofencing & Lokasi Rawuh (Sprint 3)
 * Mengacu pada SRS v3.2 §3.2
 */

/** Radius bawaan lab baru (meter). */
export const DEFAULT_RADIUS_M = 50;

/** Batas minimum radius lab yang boleh diatur asisten (meter). */
export const MIN_RADIUS_M = 10;

/** Batas maksimum radius lab yang boleh diatur asisten (meter). */
export const MAX_RADIUS_M = 200;

/** Akurasi GPS terburuk yang diterima untuk presensi (meter). */
export const MAX_ACCURACY_M = 50;

/** Batas waktu maksimal pengambilan posisi GPS (milidetik). */
export const LOCATION_TIMEOUT_MS = 15000;

/**
 * Posisi tiruan pengembangan (__DEV__) untuk pengujian "di dalam/di luar radius" di web (SRS §3.5).
 * Bernilai null secara default agar menggunakan posisi GPS/browser nyata.
 */
export const DEV_FAKE_POSITION: DevicePosition | null = null;
