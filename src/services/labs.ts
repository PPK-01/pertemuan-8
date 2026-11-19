import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db, isFirebaseReady } from './firebase';
import { devWarn } from './devLog';
import { mapFirebaseError } from './errors';
import { getInMemorySessions } from './sessions';
import { dummyLabs } from '@/data/dummy';
import { MAX_RADIUS_M, MIN_RADIUS_M } from '@/constants/location';
import type {
  CreateLabInput,
  Lab,
  LabId,
  Result,
  Session,
  UpdateLabInput,
  User,
} from '@/types';
import { createId } from '@/utils/id';

let inMemoryLabs: Lab[] = [...dummyLabs];
const fallbackLabsListeners = new Set<() => void>();

function notifyFallbackLabsListeners() {
  fallbackLabsListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Abaikan error di callback
    }
  });
}

export function getInMemoryLabs(): Lab[] {
  return inMemoryLabs;
}

function toLab(id: string, data: DocumentData): Lab {
  return {
    id,
    nama: data.nama,
    ...(data.gedung !== undefined && data.gedung !== '' ? { gedung: data.gedung } : {}),
    lat: data.lat,
    lng: data.lng,
    radiusM: data.radiusM,
    createdBy: data.createdBy,
    createdAt:
      typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ?? new Date().toISOString(),
    updatedBy: data.updatedBy,
    updatedAt:
      typeof data.updatedAt?.toDate === 'function'
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt ?? new Date().toISOString(),
  };
}

export function listenLabs(
  onData: (labs: Lab[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!isFirebaseReady || !db) {
    const notify = () => {
      onData(inMemoryLabs);
    };
    notify();
    fallbackLabsListeners.add(notify);
    return () => {
      fallbackLabsListeners.delete(notify);
    };
  }

  const labsRef = collection(db, 'labs');
  const unsubscribe = onSnapshot(
    query(labsRef),
    (snapshot) => {
      const list: Lab[] = snapshot.docs.map((d) => toLab(d.id, d.data()));
      onData(list);
    },
    (error) => {
      devWarn('labs', error);
      if (onError) onError(error);
    },
  );

  return unsubscribe;
}

function validateLabInput(
  input: CreateLabInput | UpdateLabInput,
  existingLabs: Lab[],
  excludeLabId?: string,
): Result | null {
  if (input.nama !== undefined) {
    const trimmedNama = input.nama.trim();
    if (trimmedNama.length < 2 || trimmedNama.length > 50) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Nama lab harus terdiri dari 2 hingga 50 karakter.',
      };
    }

    const isDuplicate = existingLabs.some(
      (l) => l.id !== excludeLabId && l.nama.trim().toLowerCase() === trimmedNama.toLowerCase(),
    );
    if (isDuplicate) {
      return {
        ok: false,
        code: 'DUPLICATE',
        message: 'Nama lab sudah digunakan.',
      };
    }
  }

  if (input.gedung !== undefined && input.gedung !== null) {
    const trimmedGedung = input.gedung.trim();
    if (trimmedGedung.length > 60) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Nama gedung maksimal 60 karakter.',
      };
    }
  }

  if (input.lat !== undefined) {
    if (
      typeof input.lat !== 'number' ||
      !Number.isFinite(input.lat) ||
      input.lat < -90 ||
      input.lat > 90
    ) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Latitude harus berupa angka antara -90 dan 90.',
      };
    }
  }

  if (input.lng !== undefined) {
    if (
      typeof input.lng !== 'number' ||
      !Number.isFinite(input.lng) ||
      input.lng < -180 ||
      input.lng > 180
    ) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Longitude harus berupa angka antara -180 dan 180.',
      };
    }
  }

  if (input.radiusM !== undefined) {
    if (
      typeof input.radiusM !== 'number' ||
      !Number.isInteger(input.radiusM) ||
      input.radiusM < MIN_RADIUS_M ||
      input.radiusM > MAX_RADIUS_M
    ) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: `Radius harus berupa bilangan bulat antara ${MIN_RADIUS_M} dan ${MAX_RADIUS_M} meter.`,
      };
    }
  }

  return null;
}

export async function addLab(input: CreateLabInput, user: User): Promise<Result<Lab>> {
  if (!input.nama || input.lat === undefined || input.lng === undefined || input.radiusM === undefined) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Semua kolom lab wajib diisi.',
    };
  }

  try {
    let currentLabs: Lab[] = [];
    if (!isFirebaseReady || !db) {
      currentLabs = inMemoryLabs;
    } else {
      const snap = await getDocs(collection(db, 'labs'));
      currentLabs = snap.docs.map((d) => toLab(d.id, d.data()));
    }

    const validationError = validateLabInput(input, currentLabs);
    if (validationError) {
      return validationError as Result<Lab>;
    }

    const trimmedNama = input.nama.trim();
    const trimmedGedung = input.gedung ? input.gedung.trim() : undefined;
    const now = new Date().toISOString();

    if (!isFirebaseReady || !db) {
      const newLab: Lab = {
        id: createId('lab'),
        nama: trimmedNama,
        ...(trimmedGedung ? { gedung: trimmedGedung } : {}),
        lat: input.lat,
        lng: input.lng,
        radiusM: input.radiusM,
        createdBy: user.id,
        createdAt: now,
        updatedBy: user.id,
        updatedAt: now,
      };
      inMemoryLabs = [...inMemoryLabs, newLab];
      notifyFallbackLabsListeners();
      return { ok: true, data: newLab };
    }

    const labRef = doc(collection(db, 'labs'));
    const docData: Record<string, unknown> = {
      nama: trimmedNama,
      lat: input.lat,
      lng: input.lng,
      radiusM: input.radiusM,
      createdBy: user.id,
      createdAt: serverTimestamp(),
      updatedBy: user.id,
      updatedAt: serverTimestamp(),
    };
    if (trimmedGedung) {
      docData.gedung = trimmedGedung;
    }

    await setDoc(labRef, docData);

    const created: Lab = {
      id: labRef.id,
      nama: trimmedNama,
      ...(trimmedGedung ? { gedung: trimmedGedung } : {}),
      lat: input.lat,
      lng: input.lng,
      radiusM: input.radiusM,
      createdBy: user.id,
      createdAt: now,
      updatedBy: user.id,
      updatedAt: now,
    };
    return { ok: true, data: created };
  } catch (error) {
    const mapped = mapFirebaseError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }
}

export async function updateLab(
  id: LabId,
  patch: UpdateLabInput,
  user: User,
): Promise<Result> {
  try {
    let currentLabs: Lab[] = [];
    if (!isFirebaseReady || !db) {
      currentLabs = inMemoryLabs;
    } else {
      const snap = await getDocs(collection(db, 'labs'));
      currentLabs = snap.docs.map((d) => toLab(d.id, d.data()));
    }

    const validationError = validateLabInput(patch, currentLabs, id);
    if (validationError) {
      return validationError;
    }

    const now = new Date().toISOString();

    if (!isFirebaseReady || !db) {
      const target = inMemoryLabs.find((l) => l.id === id);
      if (!target) {
        return { ok: false, code: 'NOT_FOUND', message: 'Lab tidak ditemukan.' };
      }

      const updated: Lab = {
        ...target,
        ...(patch.nama !== undefined ? { nama: patch.nama.trim() } : {}),
        ...(patch.gedung !== undefined
          ? patch.gedung.trim()
            ? { gedung: patch.gedung.trim() }
            : { gedung: undefined }
          : {}),
        ...(patch.lat !== undefined ? { lat: patch.lat } : {}),
        ...(patch.lng !== undefined ? { lng: patch.lng } : {}),
        ...(patch.radiusM !== undefined ? { radiusM: patch.radiusM } : {}),
        updatedBy: user.id,
        updatedAt: now,
      };

      inMemoryLabs = inMemoryLabs.map((l) => (l.id === id ? updated : l));
      notifyFallbackLabsListeners();
      return { ok: true, data: undefined };
    }

    const labRef = doc(db, 'labs', id);
    const snap = await getDoc(labRef);
    if (!snap.exists()) {
      return { ok: false, code: 'NOT_FOUND', message: 'Lab tidak ditemukan.' };
    }

    const updateData: Record<string, unknown> = {
      updatedBy: user.id,
      updatedAt: serverTimestamp(),
    };
    if (patch.nama !== undefined) updateData.nama = patch.nama.trim();
    if (patch.gedung !== undefined) {
      const trimmed = patch.gedung.trim();
      updateData.gedung = trimmed || '';
    }
    if (patch.lat !== undefined) updateData.lat = patch.lat;
    if (patch.lng !== undefined) updateData.lng = patch.lng;
    if (patch.radiusM !== undefined) updateData.radiusM = patch.radiusM;

    await updateDoc(labRef, updateData);

    return { ok: true, data: undefined };
  } catch (error) {
    const mapped = mapFirebaseError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }
}

export async function deleteLab(id: LabId, activeSessions?: Session[]): Promise<Result> {
  try {
    let sessionsToCheck: Session[] = [];

    if (activeSessions !== undefined) {
      sessionsToCheck = activeSessions;
    } else if (!isFirebaseReady || !db) {
      sessionsToCheck = getInMemorySessions();
    } else {
      const q = query(collection(db, 'sessions'), where('labId', '==', id));
      const snap = await getDocs(q);
      sessionsToCheck = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          praktikum: data.praktikum,
          kelas: data.kelas,
          topik: data.topik,
          ruang: data.ruang ?? '',
          labId: data.labId,
          startAt: data.startAt,
          endAt: data.endAt,
          status: data.status,
          createdBy: data.createdBy,
        } as Session;
      });
    }

    // FR-43: Lab tidak dapat dihapus bila masih dipakai sesi yang belum Ditutup
    const inUse = sessionsToCheck.some(
      (s) => s.labId === id && s.status !== 'closed',
    );
    if (inUse) {
      return {
        ok: false,
        code: 'IN_USE',
        message: 'Lab ini masih dipakai sesi yang belum ditutup.',
      };
    }

    if (!isFirebaseReady || !db) {
      inMemoryLabs = inMemoryLabs.filter((l) => l.id !== id);
      notifyFallbackLabsListeners();
      return { ok: true, data: undefined };
    }

    await deleteDoc(doc(db, 'labs', id));
    return { ok: true, data: undefined };
  } catch (error) {
    const mapped = mapFirebaseError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }
}
