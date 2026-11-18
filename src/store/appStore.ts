import { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  dummyAttendances,
  dummyIzin,
  dummyKelasPraktikum,
  dummyLabs,
  dummySessions,
  dummyUsers,
} from '@/data/dummy';
import {
  login as authLogin,
  logout as authLogout,
  observeAuth as authObserveAuth,
  register as authRegister,
} from '@/services/auth';
import {
  addKelas as svcAddKelas,
  deleteKelas as svcDeleteKelas,
  updateKelas as svcUpdateKelas,
} from '@/services/kelas';
import {
  createSession as svcCreateSession,
  deleteSession as svcDeleteSession,
  getSessionCode as svcGetSessionCode,
  newSessionId as svcNewSessionId,
  setStatus as svcSetStatus,
  updateSession as svcUpdateSession,
} from '@/services/sessions';
import { submitAttendance as svcSubmitAttendance } from '@/services/attendance';
import {
  reviewIzin as svcReviewIzin,
  saveAiResult as svcSaveAiResult,
  submitIzin as svcSubmitIzin,
} from '@/services/izin';
import { classifyIzin } from '@/services/ai';
import { connectionService } from '@/services/connection';
import { isFirebaseReady } from '@/services/firebase';
import { withWriteGuard } from '@/services/guard';
import {
  retrySync as syncRetrySync,
  startSync as syncStartSync,
  stopSync as syncStopSync,
  type SyncKey,
  type SyncStatus,
  type SyncStoreDelegate,
} from './sync';
import type {
  Attendance,
  AttendResult,
  CreateLabInput,
  CreateSessionInput,
  DevicePosition,
  Izin,
  IzinStatus,
  KelasPraktikum,
  Lab,
  LocationStatus,
  NotificationPermission,
  RegisterInput,
  Rekap,
  Result,
  Role,
  Session,
  UpdateLabInput,
  User,
} from '@/types';

export type { SyncKey, SyncStatus };

const IDLE_SYNC: Record<SyncKey, SyncStatus> = {
  sessions: 'idle',
  kelas: 'idle',
  attendances: 'idle',
  izin: 'idle',
  users: 'idle',
  labs: 'idle',
};

export type AppStoreState = {
  authStatus: 'loading' | 'signedOut' | 'signedIn';
  currentUser: User | null;
  isOnline: boolean;
  sync: Record<SyncKey, SyncStatus>;

  users: User[];
  kelasList: KelasPraktikum[];
  sessions: Session[];
  attendances: Attendance[];
  izinList: Izin[];
  sessionCodes: Record<string, string>;

  // Lab & Lokasi (Sprint 3 §3.5)
  labs: Lab[];
  location: { status: LocationStatus; position: DevicePosition | null };
  notifPermission: NotificationPermission;

  // Internal setters
  setCurrentUser: (user: User | null) => void;
  setAuthStatus: (status: 'loading' | 'signedOut' | 'signedIn') => void;
  setSyncStatus: (key: SyncKey, status: SyncStatus) => void;
  setSessionCode: (sessionId: string, code: string) => void;
  setLabs: (labs: Lab[]) => void;
  setLocationStatus: (status: LocationStatus) => void;
  setDevicePosition: (position: DevicePosition | null) => void;
  setNotifPermission: (perm: NotificationPermission) => void;

  // Aksi Auth (FR-01, FR-13 s.d. FR-15)
  initAuth: () => () => void;
  register: (input: RegisterInput) => Promise<Result<User>>;
  login: (email: string, password: string) => Promise<Result<User>>;
  /**
   * Keluar dari akun. Bila signOut gagal, Result gagal dikembalikan dan pengguna tetap masuk
   * (cache tidak dikosongkan), karena sesi Firebase Auth masih aktif.
   */
  logout: () => Promise<Result>;

  // Sinkronisasi (C-4, NFR-02)
  retrySync: (key?: SyncKey) => void;

  // Aksi Sesi & Kelas (FR-04 s.d. FR-06, FR-18 s.d. FR-20, SRS v2.2 §3.4)
  newSessionId: () => string;
  createSession: (
    input: CreateSessionInput,
    options?: { id?: string },
  ) => Promise<Result<Session>>;
  updateSession: (id: string, patch: Partial<Session>) => Promise<Result>;
  deleteSession: (id: string) => Promise<Result>;
  openSession: (id: string) => Promise<Result>;
  closeSession: (id: string) => Promise<Result>;
  addKelas: (praktikum: string, kelas: string) => Promise<Result<KelasPraktikum>>;
  updateKelas: (id: string, praktikum: string, kelas: string) => Promise<Result>;
  deleteKelas: (id: string) => Promise<Result>;

  // Aksi Lab (FR-40, FR-41, FR-43)
  addLab: (input: CreateLabInput) => Promise<Result<Lab>>;
  updateLab: (id: string, patch: UpdateLabInput) => Promise<Result>;
  deleteLab: (id: string) => Promise<Result>;

  // Aksi Lokasi & Perangkat (FR-35, FR-50, FR-56–58)
  requestLocation: () => Promise<LocationStatus>;
  refreshLocation: () => Promise<LocationStatus>;
  openLocationSettings: () => Promise<void>;
  enableLocationServices: () => Promise<LocationStatus>;
  registerDevice: () => Promise<void>;

  // Aksi Presensi & Izin (FR-07, FR-21 s.d. FR-24, FR-26)
  submitAttendance: (sessionId: string, code: string) => Promise<AttendResult>;
  submitIzin: (sessionId: string, alasan: string) => Promise<Result<Izin>>;
  retryAi: (izinId: string) => Promise<Result>;
  reviewIzin: (
    izinId: string,
    keputusan: 'approved' | 'rejected',
    catatan?: string,
  ) => Promise<Result>;
};

// Delegate sync adapter untuk memutus require-cycle antara appStore dan sync
function getSyncDelegate(
  get: () => AppStoreState,
  set: (
    partial:
      | Partial<AppStoreState>
      | ((state: AppStoreState) => Partial<AppStoreState>),
  ) => void,
): SyncStoreDelegate {
  return {
    setSyncStatus: (key, status) => {
      set((state) => ({ sync: { ...state.sync, [key]: status } }));
    },
    getSyncStatus: (key) => get().sync[key],
    setKelasList: (kelasList) => set({ kelasList }),
    setSessions: (sessions) => set({ sessions }),
    setAttendances: (attendances) => set({ attendances }),
    setIzinList: (izinList) => set({ izinList }),
    setUsers: (users) => set({ users }),
    setLabs: (labs) => set({ labs }),
    retryAi: (izinId) => get().retryAi(izinId),
  };
}

export const useAppStore = create<AppStoreState>()((set, get) => ({
  authStatus: 'loading',
  currentUser: null,
  isOnline: connectionService.isConnected,
  sync: IDLE_SYNC,

  // State awal: jika Firebase aktif, mulai dengan data kosong (O-4). Jika fallback in-memory, muat dummy data.
  users: isFirebaseReady ? [] : dummyUsers,
  kelasList: isFirebaseReady ? [] : dummyKelasPraktikum,
  sessions: isFirebaseReady ? [] : dummySessions,
  attendances: isFirebaseReady ? [] : dummyAttendances,
  izinList: isFirebaseReady ? [] : dummyIzin,
  sessionCodes: {},

  // Lab & Lokasi
  labs: isFirebaseReady ? [] : dummyLabs,
  location: {
    status: 'idle',
    position: null,
  },
  notifPermission: 'undetermined',

  setCurrentUser: (user) => {
    set({
      currentUser: user,
      authStatus: user ? 'signedIn' : 'signedOut',
    });
    if (user) {
      syncStartSync(user, getSyncDelegate(get, set));
    } else {
      syncStopSync(getSyncDelegate(get, set));
      // Seluruh cache dikosongkan agar akun berikutnya di perangkat yang sama tidak melihat data
      // akun sebelumnya (mis. daftar praktikan atau kode sesi milik asisten).
      set({
        sync: IDLE_SYNC,
        users: isFirebaseReady ? [] : dummyUsers,
        kelasList: isFirebaseReady ? [] : dummyKelasPraktikum,
        sessions: isFirebaseReady ? [] : dummySessions,
        attendances: isFirebaseReady ? [] : dummyAttendances,
        izinList: isFirebaseReady ? [] : dummyIzin,
        sessionCodes: {},
        labs: isFirebaseReady ? [] : dummyLabs,
        location: { status: 'idle', position: null },
      });
    }
  },

  setAuthStatus: (authStatus) => set({ authStatus }),

  setSyncStatus: (key, status) => {
    set((state) => ({
      sync: { ...state.sync, [key]: status },
    }));
  },

  setSessionCode: (sessionId, code) => {
    set((state) => ({
      sessionCodes: { ...state.sessionCodes, [sessionId]: code },
    }));
  },

  setLabs: (labs) => set({ labs }),

  setLocationStatus: (status) =>
    set((state) => ({ location: { ...state.location, status } })),

  setDevicePosition: (position) =>
    set((state) => ({ location: { ...state.location, position } })),

  setNotifPermission: (notifPermission) => set({ notifPermission }),

  initAuth: () => {
    return authObserveAuth((user) => {
      get().setCurrentUser(user);
    });
  },

  retrySync: (key) => {
    const user = get().currentUser;
    if (user) {
      syncRetrySync(key, user, getSyncDelegate(get, set));
    }
  },

  register: async (input) => {
    const res = await authRegister(input);
    if (res.ok) {
      get().setCurrentUser(res.data);
    }
    return res;
  },

  login: async (email, password) => {
    const res = await authLogin(email, password);
    if (res.ok) {
      get().setCurrentUser(res.data);
    }
    return res;
  },

  logout: async () => {
    const res = await authLogout();
    if (res.ok) {
      get().setCurrentUser(null);
    }
    return res;
  },

  newSessionId: () => svcNewSessionId(),

  createSession: async (input, options) => {
    const id = options?.id;
    if (id) {
      const cached = get().sessions.find((s) => s.id === id);
      if (cached) {
        return { ok: true, data: cached };
      }
    }
    return withWriteGuard(() => svcCreateSession({ ...input, id }));
  },

  updateSession: async (id, patch) => {
    return withWriteGuard(() => svcUpdateSession(id, patch));
  },

  deleteSession: async (id) => {
    return withWriteGuard(() => svcDeleteSession(id));
  },

  openSession: async (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (session && session.status !== 'scheduled') {
      return {
        ok: false,
        code: 'CONFLICT',
        message:
          session.status === 'open'
            ? 'Sesi sudah dibuka'
            : 'Sesi sudah ditutup dan tidak dapat dibuka kembali',
      };
    }
    return withWriteGuard(() => svcSetStatus(id, 'open'));
  },

  closeSession: async (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (session && session.status !== 'open') {
      return {
        ok: false,
        code: 'CONFLICT',
        message:
          session.status === 'closed'
            ? 'Sesi sudah ditutup'
            : 'Sesi belum dibuka',
      };
    }
    return withWriteGuard(() => svcSetStatus(id, 'closed'));
  },

  addKelas: async (praktikum, kelas) => {
    const user = get().currentUser;
    return withWriteGuard(() => svcAddKelas(praktikum, kelas, user?.id ?? ''));
  },

  updateKelas: async (id, praktikum, kelas) => {
    return withWriteGuard(() => svcUpdateKelas(id, praktikum, kelas));
  },

  deleteKelas: async (id) => {
    return withWriteGuard(() => svcDeleteKelas(id));
  },

  addLab: async (input) => {
    const user = get().currentUser;
    const now = new Date().toISOString();
    const newLab: Lab = {
      id: `lab-${Date.now()}`,
      nama: input.nama,
      gedung: input.gedung,
      lat: input.lat,
      lng: input.lng,
      radiusM: input.radiusM,
      createdBy: user?.id ?? 'usr-asisten-1',
      createdAt: now,
      updatedBy: user?.id ?? 'usr-asisten-1',
      updatedAt: now,
    };
    set((state) => ({ labs: [...state.labs, newLab] }));
    return { ok: true, data: newLab };
  },

  updateLab: async (id, patch) => {
    const now = new Date().toISOString();
    const user = get().currentUser;
    set((state) => ({
      labs: state.labs.map((l) =>
        l.id === id
          ? {
              ...l,
              ...patch,
              updatedBy: user?.id ?? l.updatedBy,
              updatedAt: now,
            }
          : l,
      ),
    }));
    return { ok: true, data: undefined };
  },

  deleteLab: async (id) => {
    const activeSession = get().sessions.find(
      (s) => s.labId === id && s.status !== 'closed',
    );
    if (activeSession) {
      return {
        ok: false,
        code: 'IN_USE',
        message: 'Lab ini masih dipakai sesi yang belum ditutup.',
      };
    }
    set((state) => ({
      labs: state.labs.filter((l) => l.id !== id),
    }));
    return { ok: true, data: undefined };
  },

  requestLocation: async () => {
    const dummyPos: DevicePosition = {
      lat: -7.770123,
      lng: 110.370123,
      akurasiM: 10,
      mocked: false,
      at: new Date().toISOString(),
    };
    set({
      location: {
        status: 'ready',
        position: dummyPos,
      },
    });
    return 'ready';
  },

  refreshLocation: async () => {
    return get().requestLocation();
  },

  openLocationSettings: async () => {},

  enableLocationServices: async () => {
    return get().requestLocation();
  },

  registerDevice: async () => {
    set({ notifPermission: 'granted' });
  },

  submitAttendance: async (sessionId, code) => {
    const user = get().currentUser;
    if (!user) {
      return { ok: false, reason: 'UNKNOWN' };
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      return { ok: false, reason: 'SESSION_NOT_OPEN' };
    }

    const approvedIzin = get().izinList.some(
      (i) =>
        i.sessionId === sessionId &&
        i.userId === user.id &&
        i.status === 'approved',
    );
    if (approvedIzin) {
      return { ok: false, reason: 'IZIN_APPROVED' };
    }

    const alreadyAttended = get().attendances.some(
      (a) => a.sessionId === sessionId && a.userId === user.id,
    );
    if (alreadyAttended) {
      return { ok: false, reason: 'ALREADY_ATTENDED' };
    }

    return svcSubmitAttendance(sessionId, user, code, session);
  },

  submitIzin: async (sessionId, alasan) => {
    const user = get().currentUser;
    if (!user) {
      return {
        ok: false,
        code: 'PERMISSION_DENIED',
        message: 'Harap masuk terlebih dahulu',
      };
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      return { ok: false, code: 'NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    return withWriteGuard(() => svcSubmitIzin(sessionId, user, alasan, session));
  },

  retryAi: async (izinId) => {
    const izin = get().izinList.find((i) => i.id === izinId);
    if (!izin) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Pengajuan izin tidak ditemukan',
      };
    }

    return withWriteGuard(async () => {
      const aiResult = await classifyIzin(izin.alasan);
      return svcSaveAiResult(izinId, aiResult);
    });
  },

  reviewIzin: async (izinId, keputusan, catatan) => {
    const user = get().currentUser;
    return withWriteGuard(() =>
      svcReviewIzin(izinId, user?.id ?? '', keputusan, catatan),
    );
  },
}));

// O-3 & FR-29: Pasang pemantauan status koneksi secara global dan pasang ulang otomatis listener yang error saat kembali online
connectionService.subscribe((isConnected) => {
  useAppStore.setState({ isOnline: isConnected });
  if (isConnected) {
    const store = useAppStore.getState();
    const user = store.currentUser;
    if (user) {
      (Object.keys(store.sync) as SyncKey[]).forEach((key) => {
        if (store.sync[key] === 'error') {
          store.retrySync(key);
        }
      });
    }
  }
});

// ===== Fungsi Murni Rekapitulasi (FR-10, FR-28, FR-39) =====

export function computeRekap(
  session: Session,
  users: User[],
  attendances: Attendance[],
  izinList: Izin[],
): Rekap {
  const praktikan = users.filter(
    (user) => user.role === 'praktikan' && user.kelas === session.kelas,
  );

  const attendanceByUser = new Map<string, Attendance>();
  for (const att of attendances) {
    if (att.sessionId === session.id && !attendanceByUser.has(att.userId)) {
      attendanceByUser.set(att.userId, att);
    }
  }

  const hadir = praktikan
    .flatMap((user) => {
      const att = attendanceByUser.get(user.id);
      return att ? [{ user, timestamp: att.timestamp, lokasi: att.lokasi }] : [];
    })
    .sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

  const hadirIds = new Set(hadir.map((h) => h.user.id));

  const approvedIzinMap = new Map<string, Izin>();
  for (const iz of izinList) {
    if (iz.sessionId === session.id && iz.status === 'approved') {
      approvedIzinMap.set(iz.userId, iz);
    }
  }

  const izin = praktikan
    .flatMap((user) => {
      const iz = approvedIzinMap.get(user.id);
      return iz ? [{ user, izin: iz }] : [];
    })
    .sort((a, b) => a.user.name.localeCompare(b.user.name, 'id'));

  const izinApprovedIds = new Set(izin.map((i) => i.user.id));

  const belumHadir = praktikan
    .filter((user) => !hadirIds.has(user.id) && !izinApprovedIds.has(user.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  return {
    total: praktikan.length,
    hadir,
    izin,
    belumHadir,
  };
}

// ===== Hook Baca Store =====

export function useCurrentUser(): User | null {
  return useAppStore((state) => state.currentUser);
}

export function useAuthStatus(): 'loading' | 'signedOut' | 'signedIn' {
  return useAppStore((state) => state.authStatus);
}

export function useIsOnline(): boolean {
  return useAppStore((state) => state.isOnline);
}

export function useSyncState(key: SyncKey): SyncStatus {
  return useAppStore((state) => state.sync[key]);
}

export function useKelasList(): KelasPraktikum[] {
  return useAppStore((state) => state.kelasList);
}

export function useSessionsForUser(userId: string): Session[] {
  return useAppStore(
    useShallow((state) => {
      const user =
        state.currentUser?.id === userId
          ? state.currentUser
          : state.users.find((u) => u.id === userId);
      if (!user) return [];

      const visible =
        user.role === 'asisten'
          ? state.sessions
          : state.sessions.filter((s) => s.kelas === user.kelas);

      return [...visible].sort((a, b) => a.startAt.localeCompare(b.startAt));
    }),
  );
}

export function useSessionById(id: string): Session | null {
  return useAppStore((state) => state.sessions.find((s) => s.id === id) ?? null);
}

export type SessionCodeStatus = 'loading' | 'ready' | 'error';

export type SessionCodeState = {
  code: string | null;
  status: SessionCodeStatus;
  retry: () => void;
};

export function useSessionCode(sessionId?: string): SessionCodeState {
  const codeInStore = useAppStore((state) =>
    sessionId ? state.sessionCodes[sessionId] : undefined,
  );
  const setSessionCode = useAppStore((state) => state.setSessionCode);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const fetchCode = useCallback(
    (sid: string) => {
      fetchSessionCode(sid)
        .then((code) => {
          if (code) {
            setSessionCode(sid, code);
            setFailedFor((prev) => (prev === sid ? null : prev));
          } else {
            setFailedFor(sid);
          }
        })
        .catch(() => {
          setFailedFor(sid);
        });
    },
    [setSessionCode],
  );

  useEffect(() => {
    if (!sessionId || codeInStore !== undefined) return;
    fetchCode(sessionId);
  }, [sessionId, codeInStore, fetchCode]);

  const retry = useCallback(() => {
    if (sessionId) {
      setFailedFor(null);
      fetchCode(sessionId);
    }
  }, [sessionId, fetchCode]);

  const status: SessionCodeStatus =
    codeInStore !== undefined
      ? 'ready'
      : sessionId !== undefined && failedFor === sessionId
        ? 'error'
        : 'loading';
  const code = codeInStore ?? null;

  return useMemo(() => ({ code, status, retry }), [code, status, retry]);
}

export function useAttendanceBySession(sessionId: string): Attendance[] {
  return useAppStore(
    useShallow((state) =>
      state.attendances.filter((a) => a.sessionId === sessionId),
    ),
  );
}

export function useAttendanceByUser(userId: string): Attendance[] {
  return useAppStore(
    useShallow((state) => state.attendances.filter((a) => a.userId === userId)),
  );
}

export function useHasAttended(sessionId: string, userId: string): boolean {
  return useAppStore((state) =>
    state.attendances.some(
      (a) => a.sessionId === sessionId && a.userId === userId,
    ),
  );
}

export function useRekap(sessionId: string): Rekap | null {
  const session = useSessionById(sessionId);
  const users = useAppStore((state) => state.users);
  const attendances = useAppStore((state) => state.attendances);
  const izinList = useAppStore((state) => state.izinList);

  return useMemo(
    () => (session ? computeRekap(session, users, attendances, izinList) : null),
    [session, users, attendances, izinList],
  );
}

export function useIzinByUser(userId: string): Izin[] {
  return useAppStore(
    useShallow((state) =>
      state.izinList
        .filter((i) => i.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  );
}

export function useIzinById(id: string): Izin | null {
  return useAppStore((state) => state.izinList.find((i) => i.id === id) ?? null);
}

export function useIzinBySession(sessionId: string): Izin[] {
  return useAppStore(
    useShallow((state) =>
      state.izinList
        .filter((i) => i.sessionId === sessionId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  );
}

export function useIzinForAsisten(
  filter?: IzinStatus | 'all' | 'pending',
): Izin[] {
  return useAppStore(
    useShallow((state) => {
      let list = state.izinList;
      if (filter === 'pending') {
        list = list.filter(
          (i) => i.status === 'pending_ai' || i.status === 'pending_review',
        );
      } else if (filter && filter !== 'all') {
        list = list.filter((i) => i.status === filter);
      }
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
  );
}

export async function fetchSessionCode(sessionId: string): Promise<string | null> {
  const res = await svcGetSessionCode(sessionId);
  return res.ok ? res.data : null;
}

// ===== Hook Lab & Lokasi (Sprint 3 §3.5) =====

export function useLabs(): Lab[] {
  return useAppStore((state) => state.labs);
}

export function useLabById(id: string | undefined): Lab | null {
  return useAppStore((state) =>
    id ? state.labs.find((l) => l.id === id) ?? null : null,
  );
}

export function useLabForSession(sessionId: string | undefined): Lab | null {
  return useAppStore((state) => {
    if (!sessionId) return null;
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || !session.labId) return null;
    return state.labs.find((l) => l.id === session.labId) ?? null;
  });
}

export function useLabActivity(labId: string | undefined): {
  berlangsung: Session[];
  berikutnya: Session[];
} {
  return useAppStore(
    useShallow((state) => {
      if (!labId) return { berlangsung: [], berikutnya: [] };
      const user = state.currentUser;
      const now = new Date().toISOString();

      let sessions = state.sessions.filter((s) => s.labId === labId);
      if (user && user.role === 'praktikan') {
        sessions = sessions.filter((s) => s.kelas === user.kelas);
      }

      const berlangsung = sessions.filter(
        (s) =>
          s.status === 'open' ||
          (s.status === 'scheduled' && now >= s.startAt && now <= s.endAt),
      );

      const berikutnya = sessions
        .filter((s) => s.status === 'scheduled' && s.startAt > now)
        .sort((a, b) => a.startAt.localeCompare(b.startAt));

      return { berlangsung, berikutnya };
    }),
  );
}

export function useLocation(): {
  status: LocationStatus;
  position: DevicePosition | null;
} {
  return useAppStore(useShallow((state) => state.location));
}

function calculateDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function useDistanceToLab(
  labId: string | undefined,
): { jarakM: number; didalamRadius: boolean } | null {
  return useAppStore(
    useShallow((state) => {
      if (!labId || !state.location.position) return null;
      const lab = state.labs.find((l) => l.id === labId);
      if (!lab) return null;

      const jarakM = calculateDistanceM(
        state.location.position.lat,
        state.location.position.lng,
        lab.lat,
        lab.lng,
      );

      return {
        jarakM,
        didalamRadius: jarakM <= lab.radiusM,
      };
    }),
  );
}

export function useWatchPosition(enabled: boolean): void {
  const requestLocation = useAppStore((state) => state.requestLocation);

  useEffect(() => {
    if (!enabled) return;
    void requestLocation();
  }, [enabled, requestLocation]);
}

export function useTodaySessionsForAttendance(): {
  session: Session;
  attendance: Attendance | null;
  izin: Izin | null;
  canAttend: boolean;
}[] {
  return useAppStore(
    useShallow((state) => {
      const user = state.currentUser;
      if (!user || user.role !== 'praktikan') return [];

      const todayStr = new Date().toISOString().slice(0, 10);
      const userSessions = state.sessions.filter(
        (s) => s.kelas === user.kelas && s.startAt.startsWith(todayStr),
      );

      const items = userSessions.map((session) => {
        const att =
          state.attendances.find(
            (a) => a.sessionId === session.id && a.userId === user.id,
          ) ?? null;
        const iz =
          state.izinList.find(
            (i) => i.sessionId === session.id && i.userId === user.id,
          ) ?? null;

        const isIzinApproved = iz?.status === 'approved';
        const canAttend = session.status === 'open' && !att && !isIzinApproved;

        return { session, attendance: att, izin: iz, canAttend };
      });

      // FR-33: Sesi Dibuka yang belum dipresensi tampil paling atas
      return items.sort((a, b) => {
        if (a.canAttend && !b.canAttend) return -1;
        if (!a.canAttend && b.canAttend) return 1;
        return a.session.startAt.localeCompare(b.session.startAt);
      });
    }),
  );
}

export function useNotifPermission(): NotificationPermission {
  return useAppStore((state) => state.notifPermission);
}
