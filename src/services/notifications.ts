import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

import type { NotifPayload, NotificationPermission, Result, Role } from '@/types';
import { db, isFirebaseReady } from './firebase';
import { devWarn } from './devLog';

let cachedToken: string | null = null;
let lastHandledColdStartIdentifier: string | null = null;

// Fallback in-memory jika Firebase belum aktif
const inMemoryDevices = new Map<
  string,
  { token: string; platform: string; updatedAt: string }
>();

/**
 * Konfigurasi channel notifikasi Android dengan prioritas MAX (wajib sebelum meminta izin di Android 13+).
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    } catch (err) {
      devWarn('notif-setNotificationChannel', err);
    }
  }
}

/**
 * Konfigurasi handler tampilan notifikasi foreground (banner sistem).
 */
export function configureNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    devWarn('notif-setNotificationHandler', err);
  }
}

// Inisialisasi awal notification handler saat modul dimuat
configureNotificationHandler();

function mapPermissionStatus(
  status: Notifications.PermissionStatus,
): NotificationPermission {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return 'granted';
    case Notifications.PermissionStatus.DENIED:
      return 'denied';
    case Notifications.PermissionStatus.UNDETERMINED:
      return 'undetermined';
    default:
      return 'unsupported';
  }
}

/**
 * Memeriksa status izin notifikasi saat ini.
 */
export async function getNotifPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return 'unsupported';
  }
  try {
    const settings = await Notifications.getPermissionsAsync();
    return mapPermissionStatus(settings.status);
  } catch (err) {
    devWarn('notif-getNotifPermission', err);
    return 'unsupported';
  }
}

/**
 * Meminta izin notifikasi dengan penjelasan singkat sebelum dialog sistem ditampilkan (SRS 4.3, FR-50).
 */
export async function requestNotifPermission(
  showExplanation = true,
): Promise<NotificationPermission> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return 'unsupported';
  }

  try {
    // Buat channel Android SEBELUM meminta izin (Android 13+)
    await setupAndroidNotificationChannel();

    const current = await getNotifPermission();
    if (current === 'granted') {
      return 'granted';
    }

    if (showExplanation && current === 'undetermined') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Izin Notifikasi',
          'Rawuh membutuhkan izin notifikasi agar kamu menerima pemberitahuan jadwal praktikum, pembukaan sesi, dan status izin.',
          [
            {
              text: 'Nanti',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Lanjutkan',
              onPress: () => resolve(true),
            },
          ],
          {
            cancelable: true,
            onDismiss: () => resolve(false),
          },
        );
      });

      if (!confirmed) {
        return await getNotifPermission();
      }
    }

    const requested = await Notifications.requestPermissionsAsync();
    return mapPermissionStatus(requested.status);
  } catch (err) {
    devWarn('notif-requestNotifPermission', err);
    return 'denied';
  }
}

/**
 * Membuka pengaturan aplikasi di sistem operasi perangkat (FR-59).
 */
export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    devWarn('notif-openNotificationSettings', err);
  }
}

/**
 * Mengambil Expo Push Token untuk perangkat ini.
 */
export async function getDeviceToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  try {
    const perm = await getNotifPermission();
    if (perm !== 'granted') {
      return null;
    }

    // Pastikan channel notifikasi Android dibuat dengan prioritas MAX
    await setupAndroidNotificationChannel();

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '94ab994b-31a4-4bcf-8a08-88672cc4040f';

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    cachedToken = tokenResult.data;
    return tokenResult.data;
  } catch (err) {
    devWarn('notif-getDeviceToken', err);
    return null;
  }
}

/**
 * Menghasilkan hash 16 karakter heksadesimal deterministik dari token push
 * sebagai ID dokumen devices agar penulisan token yang sama idempoten dan tidak menduplikasi data.
 */
export function hashToken(token: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c64e6d ^ 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

/**
 * Menyimpan token perangkat di subkoleksi users/{uid}/devices/{deviceId}.
 */
export async function saveDeviceToken(
  uid: string,
  token: string,
): Promise<Result<void>> {
  if (!uid || !token) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'UID dan token wajib diisi',
    };
  }

  const deviceId = hashToken(token);
  cachedToken = token;
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  if (!isFirebaseReady || !db) {
    inMemoryDevices.set(`${uid}_${deviceId}`, {
      token,
      platform,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, data: undefined };
  }

  try {
    const deviceRef = doc(db, 'users', uid, 'devices', deviceId);
    await setDoc(deviceRef, {
      token,
      platform,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, data: undefined };
  } catch (err) {
    devWarn('notif-saveDeviceToken', err);
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'Gagal menyimpan token perangkat',
    };
  }
}

/**
 * Menghapus token perangkat di users/{uid}/devices/{deviceId} saat logout (FR-50)
 * atau saat token ditolak (FR-54). Dilengkapi timeout 10 detik agar tidak hang saat offline.
 */
export async function removeDeviceToken(
  uid: string,
  tokenToRemove?: string,
): Promise<Result<void>> {
  const token = tokenToRemove ?? cachedToken;
  if (!uid || !token) {
    return { ok: true, data: undefined };
  }

  const deviceId = hashToken(token);

  if (!isFirebaseReady || !db) {
    inMemoryDevices.delete(`${uid}_${deviceId}`);
    if (token === cachedToken) cachedToken = null;
    return { ok: true, data: undefined };
  }

  try {
    const deviceRef = doc(db, 'users', uid, 'devices', deviceId);
    await Promise.race([
      deleteDoc(deviceRef),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000),
      ),
    ]);
    if (token === cachedToken) cachedToken = null;
    return { ok: true, data: undefined };
  } catch (err) {
    devWarn('notif-removeDeviceToken', err);
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'Gagal menghapus token perangkat',
    };
  }
}

/**
 * Mengambil seluruh token perangkat aktif milik seorang pengguna dari users/{uid}/devices.
 */
export async function getDeviceTokensForUser(uid: string): Promise<string[]> {
  if (!uid) return [];

  if (!isFirebaseReady || !db) {
    const tokens: string[] = [];
    for (const [key, val] of inMemoryDevices.entries()) {
      if (key.startsWith(`${uid}_`) && val.token) {
        tokens.push(val.token);
      }
    }
    return tokens;
  }

  try {
    const devicesCol = collection(db, 'users', uid, 'devices');
    const snap = await getDocs(devicesCol);
    const tokens: string[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && typeof data.token === 'string' && data.token.length > 0) {
        tokens.push(data.token);
      }
    });
    return tokens;
  } catch (err) {
    devWarn('notif-getDeviceTokensForUser', err);
    return [];
  }
}

/**
 * Mengekstrak NotifPayload dari data notifikasi Expo.
 */
export function extractNotifPayload(rawData: unknown): NotifPayload | null {
  if (!rawData) return null;
  let data = rawData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;

  // Bila data terbungkus di dalam properti data (format payload FCM/Expo push tertentu)
  const payload = (d.data && typeof d.data === 'object' ? d.data : d) as Record<
    string,
    unknown
  >;

  const type = payload.type;
  if (type === 'session_opened' && typeof payload.sessionId === 'string') {
    return { type: 'session_opened', sessionId: payload.sessionId };
  }
  if (type === 'session_created' && typeof payload.sessionId === 'string') {
    return { type: 'session_created', sessionId: payload.sessionId };
  }
  if (type === 'location_changed' && typeof payload.sessionId === 'string') {
    return { type: 'location_changed', sessionId: payload.sessionId };
  }
  if (type === 'izin_decided' && typeof payload.izinId === 'string') {
    return { type: 'izin_decided', izinId: payload.izinId };
  }

  return null;
}

/**
 * Menentukan rute target navigasi aplikasi berdasarkan NotifPayload dan peran pengguna (FR-52).
 */
export function getNotifTargetRoute(
  payload: NotifPayload,
  role?: Role,
): string {
  switch (payload.type) {
    case 'session_opened':
      return role === 'asisten'
        ? `/asisten/sesi/${payload.sessionId}`
        : '/praktikan/presensi';
    case 'session_created':
    case 'location_changed':
      return role === 'asisten'
        ? `/asisten/sesi/${payload.sessionId}`
        : `/praktikan/sesi/${payload.sessionId}`;
    case 'izin_decided':
      return role === 'asisten'
        ? `/asisten/izin/${payload.izinId}`
        : `/praktikan/izin/${payload.izinId}`;
    default:
      return '/';
  }
}

/**
 * Mendaftarkan listener notifikasi masuk (foreground) dan interaksi tap notifikasi.
 */
export function addNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void,
): () => void {
  const receivedSub = onReceived
    ? Notifications.addNotificationReceivedListener(onReceived)
    : null;

  const responseSub = onResponse
    ? Notifications.addNotificationResponseReceivedListener(onResponse)
    : null;

  // Cek jika aplikasi dibuka dari cold-start melalui interaksi notifikasi (dedupe jika sudah diproses)
  if (onResponse) {
    Notifications.getLastNotificationResponseAsync()
      .then((lastResponse) => {
        if (lastResponse) {
          const id = lastResponse.notification.request.identifier;
          if (id && id === lastHandledColdStartIdentifier) {
            return;
          }
          lastHandledColdStartIdentifier = id;
          onResponse(lastResponse);
        }
      })
      .catch((err) => {
        devWarn('notif-getLastNotificationResponseAsync', err);
      });
  }

  return () => {
    receivedSub?.remove();
    responseSub?.remove();
  };
}
