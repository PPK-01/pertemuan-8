import type { CreateLabInput, Lab, LabId, Result, UpdateLabInput } from '@/types';
import { MAX_RADIUS_M, MIN_RADIUS_M } from '@/constants/location';

export type LabValidationError = Extract<Result, { ok: false }>;

export function validateLabNama(nama: string): LabValidationError | null {
  const trimmed = nama.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Nama lab harus terdiri dari 2 hingga 50 karakter.' };
  }
  return null;
}

export function validateLabGedung(gedung?: string | null): LabValidationError | null {
  if (gedung === undefined || gedung === null) {
    return null;
  }
  if (gedung.trim().length > 60) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Nama gedung maksimal 60 karakter.' };
  }
  return null;
}

export function validateLabLat(lat: number): LabValidationError | null {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Latitude harus berupa angka antara -90 dan 90.' };
  }
  return null;
}

export function validateLabLng(lng: number): LabValidationError | null {
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Longitude harus berupa angka antara -180 dan 180.' };
  }
  return null;
}

export function validateLabKoordinat(lat: number, lng: number): LabValidationError | null {
  return validateLabLat(lat) ?? validateLabLng(lng);
}

export function validateLabRadius(radiusM: number): LabValidationError | null {
  if (
    typeof radiusM !== 'number' ||
    !Number.isInteger(radiusM) ||
    radiusM < MIN_RADIUS_M ||
    radiusM > MAX_RADIUS_M
  ) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `Radius harus berupa bilangan bulat antara ${MIN_RADIUS_M} dan ${MAX_RADIUS_M} meter.`,
    };
  }
  return null;
}

export function validateLabInput(
  input: CreateLabInput | UpdateLabInput,
  existingLabs: Lab[],
  excludeLabId?: LabId,
): LabValidationError | null {
  if (input.nama !== undefined) {
    const error = validateLabNama(input.nama);
    if (error) {
      return error;
    }
    const trimmedNama = input.nama.trim();
    const isDuplicate = existingLabs.some(
      (lab) => lab.id !== excludeLabId && lab.nama.trim().toLowerCase() === trimmedNama.toLowerCase(),
    );
    if (isDuplicate) {
      return { ok: false, code: 'DUPLICATE', message: 'Nama lab sudah digunakan.' };
    }
  }

  if (input.gedung !== undefined) {
    const error = validateLabGedung(input.gedung);
    if (error) {
      return error;
    }
  }

  if (input.lat !== undefined && input.lng !== undefined) {
    const error = validateLabKoordinat(input.lat, input.lng);
    if (error) {
      return error;
    }
  }

  if (input.radiusM !== undefined) {
    const error = validateLabRadius(input.radiusM);
    if (error) {
      return error;
    }
  }

  return null;
}
