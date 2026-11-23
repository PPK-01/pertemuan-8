import type { Izin, Lab, NotifPayload, Session, User } from '@/types';
import { formatDate, formatTime } from '@/utils/time';
import { devWarn } from './devLog';
import { getDeviceTokensForUser } from './notifications';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: NotifPayload;
  sound?: 'default' | null;
  channelId?: string;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH_SIZE = 100;

/**
 * Format jadwal sesi praktikum untuk isi notifikasi ({hari, tanggal, jam}).
 * Contoh: "Senin, 23 Nov, 08.00"
 */
export function formatSessionSchedule(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  const dayAndDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d);
  const timeStr = formatTime(startAt);
  return `${dayAndDate}, ${timeStr}`;
}

/**
 * Mengirim pesan push notification ke Expo Push API dalam batch maksimal 100 pesan.
 * Mengembalikan daftar token yang ditolak oleh Expo Push Service (mis. DeviceNotRegistered).
 */
export async function sendPush(messages: PushMessage[]): Promise<string[]> {
  if (!messages || messages.length === 0) {
    return [];
  }

  const rejectedTokens: string[] = [];

  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const chunk = messages.slice(i, i + MAX_BATCH_SIZE);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
        signal: controller.signal,
      });

      if (!response.ok) {
        devWarn('push-sendPushHttpError', `${response.status} ${response.statusText}`);
        continue;
      }

      const resData = (await response.json()) as {
        data?: {
          status?: 'ok' | 'error';
          message?: string;
          details?: { error?: string };
        }[];
      };

      if (Array.isArray(resData?.data)) {
        resData.data.forEach((ticket, idx) => {
          if (ticket.status === 'error') {
            const token = chunk[idx]?.to;
            if (token && ticket.details?.error === 'DeviceNotRegistered') {
              rejectedTokens.push(token);
              devWarn('push-ticketError', `${token}: DeviceNotRegistered`);
            } else if (token) {
              devWarn('push-ticketError', `${token}: ${ticket.message || ticket.details?.error}`);
            }
          }
        });
      }
    } catch (err) {
      devWarn('push-sendPushNetworkError', err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return rejectedTokens;
}

/**
 * Mengirim notifikasi push ke daftar pengguna berdasarkan UID mereka.
 */
export async function sendNotificationToUsers(
  uids: string[],
  title: string,
  body: string,
  data: NotifPayload,
): Promise<string[]> {
  if (!uids || uids.length === 0) {
    return [];
  }

  try {
    const tokenPromises = uids.map((uid) => getDeviceTokensForUser(uid));
    const tokenLists = await Promise.all(tokenPromises);
    const allTokens = Array.from(new Set(tokenLists.flat()));

    if (allTokens.length === 0) {
      return [];
    }

    const messages: PushMessage[] = allTokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
      channelId: 'default',
    }));

    return await sendPush(messages);
  } catch (err) {
    devWarn('push-sendNotificationToUsers', err);
    return [];
  }
}

/**
 * Notifikasi N1: Status sesi dijadwalkan dibuka (scheduled → open).
 * Penerima: praktikan kelas sesi tersebut.
 */
export async function notifySessionOpened(
  session: Session,
  users: User[],
  labs: Lab[],
): Promise<void> {
  const praktikanUids = users
    .filter((u) => u.role === 'praktikan' && u.kelas === session.kelas)
    .map((u) => u.id);

  if (praktikanUids.length === 0) return;

  const lab = session.labId ? labs.find((l) => l.id === session.labId) : null;
  const labName = lab?.nama || session.ruang || 'Lab';

  const title = 'Sesi dibuka';
  const body = `${session.praktikum} kelas ${session.kelas} dibuka. Presensi sekarang di ${labName}.`;
  const payload: NotifPayload = { type: 'session_opened', sessionId: session.id };

  await sendNotificationToUsers(praktikanUids, title, body, payload);
}

/**
 * Notifikasi N2: Sesi baru dibuat.
 * Penerima: praktikan kelas sesi tersebut.
 */
export async function notifySessionCreated(
  session: Session,
  users: User[],
  labs: Lab[],
): Promise<void> {
  const praktikanUids = users
    .filter((u) => u.role === 'praktikan' && u.kelas === session.kelas)
    .map((u) => u.id);

  if (praktikanUids.length === 0) return;

  const lab = session.labId ? labs.find((l) => l.id === session.labId) : null;
  const labName = lab?.nama || session.ruang || 'Lab';
  const scheduleStr = formatSessionSchedule(session.startAt);

  const title = 'Jadwal baru';
  const body = `${session.praktikum}: ${scheduleStr} di ${labName}.`;
  const payload: NotifPayload = { type: 'session_created', sessionId: session.id };

  await sendNotificationToUsers(praktikanUids, title, body, payload);
}

/**
 * Notifikasi N3: Status izin diputuskan (approved / rejected).
 * Penerima: praktikan pengaju izin.
 */
export async function notifyIzinDecided(
  izin: Izin,
  session: Session | undefined,
  keputusan: 'approved' | 'rejected',
): Promise<void> {
  const praktikanUid = izin.userId;
  if (!praktikanUid) return;

  const praktikumName = session?.praktikum || 'Praktikum';
  const tanggalStr = session?.startAt ? formatDate(session.startAt) : formatDate(izin.createdAt);
  const keputusanText = keputusan === 'approved' ? 'disetujui' : 'ditolak';

  const title = `Izin ${keputusanText}`;
  const body = `untuk ${praktikumName} ${tanggalStr}.`;
  const payload: NotifPayload = { type: 'izin_decided', izinId: izin.id };

  await sendNotificationToUsers([praktikanUid], title, body, payload);
}

/**
 * Notifikasi N4: Lokasi sesi praktikum berubah (labId sesi berubah atau koordinat/nama lab berubah).
 * Penerima: praktikan kelas sesi tersebut.
 */
export async function notifyLocationChanged(
  session: Session,
  users: User[],
  labName: string,
): Promise<void> {
  const praktikanUids = users
    .filter((u) => u.role === 'praktikan' && u.kelas === session.kelas)
    .map((u) => u.id);

  if (praktikanUids.length === 0) return;

  const title = 'Lokasi praktikum berubah';
  const body = `${session.praktikum} kini di ${labName}.`;
  const payload: NotifPayload = { type: 'location_changed', sessionId: session.id };

  await sendNotificationToUsers(praktikanUids, title, body, payload);
}
