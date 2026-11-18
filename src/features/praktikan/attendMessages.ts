import type { AttendFailReason } from '@/types';

export const ATTEND_FAIL_MESSAGE: Record<AttendFailReason, string> = {
  SESSION_NOT_OPEN: 'Sesi tidak sedang dibuka',
  ALREADY_ATTENDED: 'Kamu sudah presensi pada sesi ini',
  INVALID_CODE: 'Kode sesi tidak sesuai',
  NOT_IN_CLASS: 'Sesi ini bukan untuk kelasmu',
  IZIN_APPROVED: 'Izinmu untuk sesi ini sudah disetujui',
  NO_CONNECTION: 'Tidak ada koneksi. Presensi memerlukan internet',
  TIMEOUT: 'Presensi belum dapat dipastikan. Cek tab Riwayat sebelum mencoba lagi',
  UNKNOWN: 'Terjadi kesalahan sistem saat presensi. Coba lagi nanti',
  NO_LAB: 'Lab sesi ini belum diatur asisten',
  OUTSIDE_RADIUS: 'Kamu berada di luar radius lab',
  LOW_ACCURACY: 'Lokasi belum akurat. Pindah ke tempat terbuka lalu perbarui',
  MOCKED_LOCATION: 'Lokasi palsu terdeteksi. Matikan aplikasi pengubah lokasi',
  LOCATION_PERMISSION: 'Akses lokasi ditolak. Presensi membutuhkan lokasimu',
  LOCATION_SERVICES_OFF: 'Layanan lokasi di HP-mu tidak aktif',
  LOCATION_TIMEOUT: 'Lokasi belum didapat. Pastikan GPS aktif lalu coba lagi',
};
