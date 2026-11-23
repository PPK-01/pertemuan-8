# Presensi Praktikum Rawuh - Sprint 2 (Dhimas: Fondasi Data, Auth, AI & Praktikan)

Dokumen ini merangkum panduan konfigurasi, arsitektur, dan pengujian untuk lingkup kerja **Dhimas** pada Sprint 2 aplikasi Presensi Praktikum **Rawuh** (React Native + Firebase + AI). Dokumen kebutuhan perangkat lunak mengacu pada `docs/arsip/SRS-v2.2-sprint-2.md`.

---

## 1. Cakupan Tugas Dhimas (D-01 s.d. D-12)

1. **D-01 & D-02**: Fondasi Firebase Modular JS SDK (`firebase`), konfigurasi `src/config/env.ts`, safe wrapper untuk storage dan network connectivity.
2. **D-03**: Pembaruan kontrak tipe `src/types/index.ts` (Sprint 2) dan store terpadu `src/store/appStore.ts`.
3. **D-04**: Firebase Security Rules (`firestore.rules`), `firestore.indexes.json`, `firebase.json` dengan pengujian 9 kasus keamanan.
4. **D-05**: Sistem Autentikasi Firebase (`services/auth.ts`, `services/users.ts`), gate rute per peran, layar `login.tsx` & `daftar.tsx`, serta `KeluarButton`.
5. **D-06**: Sinkronisasi Firestore Realtime (`store/sync.ts`), listener per peran, mapping error Indonesia (`services/errors.ts`), timeout 10 detik, dan penanganan offline.
6. **D-07**: Layanan Sesi & Kelas (`services/sessions.ts`, `services/kelas.ts`) dengan pemisahan kode 4 digit ke subdokumen `private/code`.
7. **D-08**: Alur Presensi Praktikan: validasi kode sesi, pra-cek offline/sesi/kelas/duplikasi, rekaman waktu server, dan tab Riwayat dengan ringkasan kehadiran & izin.
8. **D-09**: Fitur Pengajuan Izin Praktikan: validasi alasan (10–500 karakter), penyimpanan `izin/{sessionId}_{uid}`, tab Izin, dan layar detail izin.
9. **D-10**: Integrasi AI (`services/ai.ts`): klasifikasi alasan izin menggunakan Model Sentimen EDOM lokal (*on-device inference* murni JavaScript).
10. **D-11**: Logika rekapitulasi `computeRekap` yang memperhitungkan izin disetujui (FR-10, FR-28).
11. **D-12**: Dokumentasi teknis proyek.

---

## 2. Arsitektur Dual-Mode Runtime

Aplikasi dirancang dengan **Dual-Mode Engine**:
1. **Mode Firebase Cloud (Produksi / Staging)**: Aktif otomatis saat variabel `EXPO_PUBLIC_FIREBASE_*` diisi di file `.env`. Terhubung langsung ke Firebase Authentication dan Cloud Firestore secara realtime.
2. **Mode In-Memory Fallback (Lokal / Web)**: Aktif otomatis jika `.env` belum diisi. Memungkinkan pengujian lokal dan web langsung dijalankan untuk menguji alur auth, presensi, dan izin tanpa crash.

---

## 3. Konfigurasi Lingkungan (`.env`)

Salin berkas `.env.example` menjadi `.env` lalu lengkapi variabel berikut:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# AI API Integration
EXPO_PUBLIC_AI_URL=https://api.pengajar.ac.id/v1/classify-izin
EXPO_PUBLIC_AI_KEY=your_ai_api_key
```

> **Catatan Keamanan:** Berkas `.env` telah didaftarkan di `.gitignore` dan dilarang untuk di-commit ke repositori.

---

## 4. Menjalankan Aplikasi

### A. Menjalankan Aplikasi (Expo / Dev Client)
Mulai development server Metro:
```bash
npx expo start
```
Atau dengan development client:
```bash
npx expo start --dev-client
```

### B. Pengujian Web
```bash
npx expo start --web
```

### C. Verifikasi Kualitas Kode
```bash
npx tsc --noEmit
```

---

## 5. Peta Route Sprint 2 (Area Tanggung Jawab Dhimas)

| Route | File Komponen | Deskripsi |
| :--- | :--- | :--- |
| `/` | `src/app/index.tsx` | Gate utama: mengarahkan user berdasarkan auth status & peran |
| `/(auth)/login` | `src/app/(auth)/login.tsx` | Form masuk (Email & Kata Sandi) |
| `/(auth)/daftar` | `src/app/(auth)/daftar.tsx` | Form registrasi peran Praktikan / Asisten Lab |
| `/praktikan/jadwal` | `src/app/praktikan/(tabs)/jadwal.tsx` | Daftar jadwal sesi kelas praktikan secara realtime |
| `/praktikan/izin` | `src/app/praktikan/(tabs)/izin.tsx` | Daftar pengajuan izin praktikan dan status verifikasi |
| `/praktikan/riwayat` | `src/app/praktikan/(tabs)/riwayat.tsx` | Riwayat presensi dan ringkasan hadir & izin disetujui |
| `/praktikan/sesi/[id]` | `src/app/praktikan/sesi/[id].tsx` | Detail sesi, form presensi 4 digit, dan tombol ajukan izin |
| `/praktikan/izin/baru` | `src/app/praktikan/izin/baru.tsx` | Form pengajuan izin (alasan 10–500 karakter) |
| `/praktikan/izin/[id]` | `src/app/praktikan/izin/[id].tsx` | Detail izin: status, alasan, dan keputusan asisten |

---

## 6. Firebase Security Rules (`firestore.rules`)

Aturan keamanan menerapkan prinsip *deny-by-default*:
- `users/{uid}`: Hanya pemilik yang dapat membuat dokumen akunnya sendiri; asisten wajib menyertakan kode undangan yang diverifikasi server.
- `sessions/{id}`: Praktikan hanya dapat membaca sesi untuk kelasnya; kode 4 digit sesi disimpan di subdokumen `private/code` yang hanya dapat dibaca asisten.
- `attendances/{sessionId}_{uid}`: Praktikan hanya dapat menulis presensi saat sesi berstatus `open`, kelas sesuai, kode cocok, belum presensi, dan tidak memiliki izin yang telah disetujui. ID dokumen deterministik `{sessionId}_{uid}` mencegah duplikasi presensi di level database.
- `izin/{sessionId}_{uid}`: Praktikan mengajukan izin dengan status awal `pending_ai`. Asisten adalah satu-satunya pihak yang berhak mengubah status menjadi `approved` atau `rejected` melalui field `review`.

Untuk mendeploy rules:
```bash
firebase deploy --only firestore:rules
```

### 6.1 Bukti Uji 14 Kasus Keamanan Rules (DoD & SRS §6.5 Sprint 3)

Pengujian aturan keamanan Cloud Firestore (`firestore.rules`) diverifikasi menggunakan Rules Playground di Firebase Console, verifikasi live deployment (D-03, D-05, D-06), dan pengujian unit rules. Seluruh pengujian menerapkan prinsip *deny-by-default*, validasi skema ketat (`hasOnly`, `hasAll`), serta pembatasan peran (`isAsisten`, `isPraktikan`, pemilik data).

| Nomor Kasus | Skenario | Hasil yang Diharapkan | Hasil Aktual | Status |
| :-: | :--- | :--- | :--- | :-: |
| 1 | Praktikan mencoba membuat, mengubah, atau menghapus sesi praktikum (`/sessions/{sid}`) | Ditolak (hanya asisten yang memiliki hak tulis sesi) | DENIED | PASS |
| 2 | Praktikan membaca subdokumen kode privat (`/sessions/{sid}/private/code`) atau sesi kelas lain | Ditolak (subdokumen privat hanya untuk asisten, sesi kelas lain diblokir) | DENIED | PASS |
| 3 | Presensi pada sesi Dibuka: kode benar vs kode salah vs presensi kedua kali (duplikat ID) | Kode benar diterima; kode salah ditolak; presensi kedua ditolak | ALLOWED (benar) / DENIED (salah & duplikat) | PASS |
| 4 | Presensi pada sesi Dijadwalkan atau Ditutup, atas nama UID lain, atau izin disetujui | Ditolak (hanya sesi open, UID cocok, dan izin belum disetujui) | DENIED | PASS |
| 5 | Praktikan membaca rekaman presensi atau pengajuan izin praktikan lain | Ditolak (praktikan hanya diizinkan membaca dokumen miliknya sendiri) | DENIED | PASS |
| 6 | Praktikan mencoba menulis review izin atau mengubah status izin menjadi `approved` | Ditolak (transisi status dan penulisan review hanya diizinkan untuk asisten) | DENIED | PASS |
| 7 | Registrasi asisten tanpa kode undangan valid, atau mengubah field `role`/`kelas` akun | Ditolak (kode undangan diverifikasi ke `/config/asisten`, role/kelas tidak boleh diubah) | DENIED | PASS |
| 8 | Asisten menghapus sesi yang berstatus bukan Dijadwalkan (`open`/`closed`), atau lompat status | Ditolak (penghapusan hanya untuk status `scheduled`, transisi status harus bertahap) | DENIED | PASS |
| 9 | Pengguna belum login (tamu) mengakses koleksi operasional (`sessions`, `users`, `attendances`, dll.) | Ditolak di semua koleksi operasional; baca diizinkan hanya pada `/kelasPraktikum` | DENIED (operasional) / ALLOWED (`kelasPraktikum`) | PASS |
| 10 | Asisten membuat/mengubah data lab valid; Praktikan mencoba menulis data lab | Asisten diizinkan; Praktikan ditolak (hanya asisten yang dapat mengelola koleksi lab) | Asisten ALLOWED / Praktikan DENIED | PASS |
| 11 | Pembuatan/pembaruan lab dengan radius di luar rentang 10–200 m, atau koordinat lat/lng tidak valid | Ditolak (radiusM wajib integer 10–200, lat -90 s.d. 90, lng -180 s.d. 180) | DENIED | PASS |
| 12 | Pembuatan sesi baru tanpa `labId` atau dengan `labId` yang tidak terdaftar di koleksi `labs` | Ditolak (`exists(/databases/$(db)/documents/labs/$(labId))` bernilai false) | DENIED | PASS |
| 13 | Presensi lokasi: `jarakM` > radius, `akurasiM` > 50, `mocked` = true, atau `labId` berbeda dari sesi | Ditolak jika jarak/akurasi/mocked/labId tidak sesuai; Bukti valid diterima | ALLOWED (bukti valid) / DENIED (pelanggaran lokasi) | PASS |
| 14 | Manajemen devices (`/users/{uid}/devices`): praktikan membaca token pengguna lain; asisten membaca/mengubah token orang lain | Praktikan dilarang membaca token lain; Asisten diizinkan membaca & menghapus tetapi dilarang membuat/mengubah token orang lain; Pemilik diizinkan kelola tokennya sendiri (token <= 200, platform android/ios) | Sesuai aturan (Praktikan lain DENIED, Asisten baca/hapus ALLOWED, Asisten create/update DENIED, Pemilik ALLOWED) | PASS |

> **Ringkasan DoD Security Sprint 3:** Seluruh 14 kasus pengujian aturan keamanan Cloud Firestore dinyatakan **LULUS (100% PASS)** tanpa celah keamanan (*zero security vulnerability*).

### 6.2 Ringkasan Cek Singkat Live Deployment (Sprint 3)
1. **D-03 (Lab & Sesi)**: `deleteLab` memverifikasi sesi aktif langsung ke Firestore untuk mencegah orphaned `labId`.
2. **D-05 (Presensi Lokasi)**: Validasi field `lokasi` (map dengan hasOnly & hasAll 5 kunci: `lat`, `lng`, `akurasiM`, `jarakM`, `mocked`), `akurasiM <= 50`, `jarakM <= radiusM`, `mocked == false`, konsistensi `labId`, serta kompatibilitas mundur dokumen presensi lama Sprint 2.
3. **D-06 (Perangkat & Notifikasi Push)**: Validasi subkoleksi `devices` (`platform in ['android', 'ios']`, `token.size() <= 200`, `updatedAt is timestamp`), isolasi token antar pengguna, hak asisten membaca/menghapus token, dan pencegahan modifikasi token orang lain.
4. **Uji Kasus 1–9 Sesi & Presensi**: Verifikasi regresi memastikan pembaruan rules Sprint 3 pada `sessions` dan `attendances` tidak merusak validasi status sesi, kode privat, izin, dan hak akses praktikan.

---

## 7. Akun Seed Uji Coba

Untuk keperluan demo dan verifikasi:
- **Asisten**: `dina@rawuh.ac.id`, `raka@rawuh.ac.id` (Kata sandi bebas pada mode fallback)
- **Praktikan (Kelas A)**: `bagas@rawuh.ac.id`, `citra@rawuh.ac.id`
- **Praktikan (Kelas B)**: `dani@rawuh.ac.id`, `eka@rawuh.ac.id`
- **Kode Undangan Asisten**: Dikelola secara rahasia di Cloud Firestore pada dokumen `/config/asisten` (field `inviteCode`) dan dibagikan secara privat (bukan di repositori publik).
