import { devWarn } from './devLog';
import { safeStorage } from './storage';

const BARK_TOKEN_PREFIX = 'bark:';
const BARK_PUSH_URL = 'https://api.day.app/push';
const BARK_STORAGE_KEY = 'rawuh_bark_device_key';
const LIVE_CONTAINER_LAUNCH_URL =
  'livecontainer://livecontainer-launch?bundle-name=com.ppk01.rawuh';
const BARK_KEY_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Mengekstrak Bark Device Key dari input mentah atau URL Bark (mis. https://api.day.app/xYz123/).
 */
export function parseBarkKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const firstSegment = url.pathname.split('/').filter(Boolean)[0] ?? '';
      candidate = firstSegment;
    } catch {
      return null;
    }
  } else {
    candidate = candidate.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  }

  return BARK_KEY_REGEX.test(candidate) ? candidate : null;
}

export function toBarkDeviceToken(barkKey: string): string {
  return `${BARK_TOKEN_PREFIX}${barkKey}`;
}

export function isBarkDeviceToken(token: string): boolean {
  return token.startsWith(BARK_TOKEN_PREFIX);
}

export function extractBarkKeyFromToken(token: string): string | null {
  if (!isBarkDeviceToken(token)) return null;
  const key = token.slice(BARK_TOKEN_PREFIX.length).trim();
  return key.length > 0 ? key : null;
}

export async function getSavedBarkKey(): Promise<string | null> {
  try {
    const val = await safeStorage.getItem(BARK_STORAGE_KEY);
    if (val !== null) {
      return val === '' ? null : parseBarkKey(val);
    }
    const envKey = process.env.EXPO_PUBLIC_BARK_DEVICE_KEY;
    return envKey ? parseBarkKey(envKey) : null;
  } catch (err) {
    devWarn('bark-getSavedBarkKey', err);
    return null;
  }
}

export async function saveBarkKeyLocally(barkKey: string): Promise<void> {
  await safeStorage.setItem(BARK_STORAGE_KEY, barkKey);
}

export async function clearBarkKeyLocally(): Promise<void> {
  // Simpan string kosong agar fallback env tidak langsung aktif kembali setelah dihapus pengguna
  await safeStorage.setItem(BARK_STORAGE_KEY, '');
}

/**
 * Mengirim notifikasi push ke iPhone melalui Bark APNs Relay
 * dengan deep link auto-launch ke aplikasi Rawuh di LiveContainer.
 */
export async function sendBarkNotification(
  barkKey: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; invalidDevice?: boolean }> {
  if (!barkKey) {
    return { ok: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BARK_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        device_key: barkKey,
        title,
        body,
        url: LIVE_CONTAINER_LAUNCH_URL,
        group: 'rawuh',
        sound: 'minuet',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let invalidDevice = false;
      try {
        const errJson = (await response.json()) as { code?: number; message?: string };
        if (
          response.status === 400 ||
          errJson?.code === 400 ||
          errJson?.message?.toLowerCase().includes('device key')
        ) {
          invalidDevice = true;
        }
      } catch {
        // Abaikan error parsing JSON
      }
      devWarn('bark-sendHttpError', `${response.status} ${response.statusText}`);
      return { ok: false, invalidDevice };
    }

    return { ok: true };
  } catch (err) {
    devWarn('bark-sendNetworkError', err);
    return { ok: false };
  } finally {
    clearTimeout(timeoutId);
  }
}
