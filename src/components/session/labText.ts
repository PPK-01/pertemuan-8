/** Placeholder saat data lab sesi belum tersinkron. */
export const LAB_LOADING_TEXT = 'Memuat lab…';

/** Fallback saat sesi tidak punya lab maupun ruang. */
export const LAB_UNSET_TEXT = 'Lab belum diatur';

/**
 * Kontrak prop `labName` untuk komponen yang menampilkan lab sesi (FR-03):
 * - string tidak kosong: nama lab.
 * - `''`: lab sedang dimuat, tampilkan placeholder (bukan fallback).
 * - `undefined`: tidak ada nama lab, pakai `ruang` sesi lama, selain itu "Lab belum diatur".
 */
export function resolveLabText(
  labName: string | undefined,
  ruang: string | undefined,
): { text: string; loading: boolean } {
  if (labName === '') return { text: LAB_LOADING_TEXT, loading: true };
  return { text: labName || ruang || LAB_UNSET_TEXT, loading: false };
}

/**
 * Menentukan nilai `labName` untuk pemanggil. `''` hanya bila sesi punya `labId`, lab belum
 * ditemukan, dan sinkronisasi labs belum selesai; labId yatim (labs sudah ready) menjadi `undefined`.
 */
export function pickLabName(
  labId: string | undefined,
  foundName: string | undefined,
  labsLoading: boolean,
): string | undefined {
  if (!labId) return undefined;
  if (foundName) return foundName;
  return labsLoading ? '' : undefined;
}

/** Status sinkron `labs` yang berarti data lab masih akan datang. */
export function isLabsLoading(status: 'idle' | 'loading' | 'ready' | 'error'): boolean {
  return status === 'idle' || status === 'loading';
}
