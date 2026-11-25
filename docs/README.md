# Panduan Setup Proyek Rawuh

Panduan ini membantu anggota baru menjalankan aplikasi **Rawuh** (presensi praktikum) dari nol, memahami perbedaan *development build* dan *preview*, mengirim notifikasi uji, serta memeriksa Firestore rules. Kebutuhan perangkat lunak ada di [SRS.md](./SRS.md) (v3.3), pola desain di [../DESIGN.md](../DESIGN.md), dan panduan iOS eksperimental di [../IOS_LIVECONTAINER_GUIDE.md](../IOS_LIVECONTAINER_GUIDE.md).

---

## 1. Gambaran Singkat

Rawuh mencatat kehadiran sesi praktikum untuk dua peran: **asisten** (membuat dan membuka sesi, mengelola lab, memeriksa izin, melihat rekap) dan **praktikan** (presensi dengan kode sesi 4 digit di dalam radius lab, mengajukan izin, melihat peta lab dan riwayat). Sprint 3 menambahkan lokasi, peta, dan push notification.

| Lapisan | Teknologi |
| :--- | :--- |
| Aplikasi | Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router (`src/app/`), Zustand 5 |
| Data | Firebase JS SDK modular (Authentication, Cloud Firestore, paket Spark) |
| Lokasi | `expo-location` (foreground saja) |
| Peta | `@maplibre/maplibre-react-native` + style OpenFreeMap (tanpa API key) |
| Notifikasi | `expo-notifications`, Expo Push Service, FCM di Android |
| AI izin | Model sentimen EDOM lokal (berjalan di perangkat, tanpa API eksternal) |

---

## 2. Prasyarat

- **Node.js 22** (versi yang dipakai CI) dan npm, serta **Git**.
- **HP Android** (disarankan; demo hanya di Android). Emulator Android boleh dipakai untuk uji non-notifikasi.
- Akun **Expo** yang menjadi anggota project EAS Rawuh (untuk mengunduh build). Membuat build baru memerlukan hak akses pemegang akun EAS (lihat bagian 4).
- Akses ke project **Firebase** Rawuh bila ingin memakai data sungguhan (tanpa itu tersedia mode in-memory, bagian 3).

---

## 3. Setup

```bash
git clone https://github.com/PPK-01/pertemuan-8.git
cd pertemuan-8
npm ci
cp .env.example .env
```

Isi `.env` (nilainya diminta ke pemegang akun Firebase; **jangan di-commit**, `.env` sudah ada di `.gitignore`):

| Variabel | Fungsi |
| :--- | :--- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID` | Konfigurasi Firebase yang dibaca aplikasi saat bundling |
| `ASISTEN_INVITE_CODE` | Hanya untuk skrip seed; tidak boleh berawalan `EXPO_PUBLIC_` karena variabel itu ikut tertanam di aplikasi |

**Mode tanpa Firebase (in-memory).** Bila variabel Firebase kosong, aplikasi berjalan otomatis dengan data lokal di memori (data dummy, termasuk beberapa lab). Mode ini cukup untuk menguji tampilan dan alur dasar, tetapi data hilang saat aplikasi ditutup, **notifikasi tidak berfungsi**, dan perilakunya bukan acuan uji akhir. Periksa bahwa variabel Firebase benar-benar terbaca bila data tidak tersimpan.

Pemeriksaan kualitas sebelum membuka PR:

```bash
npx tsc --noEmit    # atau: npm run typecheck
npx expo lint       # atau: npm run lint
```

---

## 4. Development Build vs Preview

Aplikasi memakai modul native (MapLibre, notifikasi, lokasi) sehingga **Expo Go tidak dapat dipakai**. Ada dua jenis build Android, keduanya memakai package `com.ppk01.rawuh`:

| | Development build | Preview |
| :--- | :--- | :--- |
| Profil di `eas.json` | `development` | `preview` |
| Berisi | `expo-dev-client`: menampilkan launcher dan **memuat JavaScript dari server Metro** (`npx expo start`) | JavaScript yang **dibekukan saat build** (bundel tetap di APK) |
| Perubahan kode | Terlihat tanpa build ulang (selama tidak ada modul native baru) | Perlu build baru |
| Variabel Firebase | Dibaca Metro dari `.env` di laptop | Dibaca saat build dari EAS Environment Variables (lingkungan `preview`) |
| Cocok untuk | Pengembangan harian | Demo atau uji tanpa laptop |

**Keduanya tidak dapat terpasang bersamaan** karena package sama. Untuk berganti jenis: **logout dari aplikasi → uninstall → pasang build yang lain**. Logout dulu agar token notifikasi akun dihapus dari `users/{uid}/devices`.

**Membedakan build di expo.dev.** Buka halaman *Builds* project Rawuh: tiap build menampilkan **profile** (`development` atau `preview`) dan **commit** sumbernya. Pilih profile yang sesuai kebutuhan, dan untuk preview pastikan commit-nya yang terbaru sebelum dipasang.

**Pemilik akun/project EAS** (saat ini pemegang akun yang ditunjuk di SRS 1.4) yang dapat membuat build baru dan mengelola kredensial. Profil build ada di [../eas.json](../eas.json). Sinkronisasi variabel Firebase dari `.env` ke EAS (untuk preview dan production) dilakukan pemegang akun dengan `npm run build:setup-secrets`.

Perintah build (hanya pemegang akun EAS):

```bash
npx eas-cli build --platform android --profile development   # development build
npx eas-cli build --platform android --profile preview       # APK preview
```

---

## 5. Menjalankan Aplikasi

```bash
npx expo start
```

1. Pasang development build di HP (bagian 4).
2. Buka aplikasi; pada launcher pilih server pengembangan yang muncul atau masukkan URL yang ditampilkan terminal.
3. Pastikan HP dan laptop **berada di jaringan yang sama**.

**Masalah "Host unreachable" / tidak menemukan server:**

- HP dan laptop beda jaringan, atau Wi-Fi kampus memblokir komunikasi antar-perangkat. Solusi: gunakan **hotspot** dari HP lain atau laptop, atau jalankan `npx expo start --tunnel` (CLI dapat meminta memasang paket tunnel bila belum ada).
- Firewall di laptop memblokir port Metro. Izinkan Node.js pada jaringan privat.

**Demo dengan development build.** Agar bundel dimuat seperti rilis (tanpa mode pengembangan), jalankan `npx expo start --no-dev --minify`.

**Web.** `npx expo start --web` hanya untuk uji tampilan: peta diganti **daftar lab**, lokasi memakai geolocation browser, notifikasi tidak aktif (SRS 1.4).

---

## 6. Notifikasi Push

- **Pengirim:** aplikasi asisten memanggil **Expo Push Service** (`https://exp.host/--/api/v2/push/send`) segera setelah aksi berhasil. Di Android Expo meneruskan lewat **FCM**. Tidak ada server tambahan.
- **Kredensial FCM:** `google-services.json` ada di repo (tanpa rahasia). **Kunci akun layanan FCM V1 hanya disimpan di kredensial EAS** dan tidak boleh masuk repo, chat, atau dokumen.
- **Channel Android:** `default`, dibuat sebelum izin notifikasi diminta.
- **Uji cepat dengan Expo push tool:**
  1. Login di HP dan izinkan notifikasi.
  2. Ambil token dari Firestore `users/{uid}/devices` (field `token`, berbentuk `ExponentPushToken[...]`).
  3. Buka Expo push notifications tool (`https://expo.dev/notifications`), tempel token, isi judul dan isi, serta data JSON, mis. `{"type":"session_opened","sessionId":"<id sesi>"}`.
  4. Kirim; notifikasi harus tampil dan, bila diketuk, membuka layar sesuai tipe (`session_opened` → halaman presensi, `session_created` dan `location_changed` → detail sesi, `izin_decided` dengan `izinId` → detail izin).
- **iOS (eksperimental):** notifikasi lewat relay Bark, di luar kriteria penerimaan. Lihat [../IOS_LIVECONTAINER_GUIDE.md](../IOS_LIVECONTAINER_GUIDE.md).

---

## 7. Peta

Peta memakai **MapLibre** dengan style vektor **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`): **tanpa API key dan tanpa registrasi**. Atribusi "© OpenStreetMap contributors, OpenFreeMap" **wajib tampil** satu kali di peta. OpenFreeMap disediakan apa adanya; rencana cadangan ada di SRS bagian 14. Komponen MapLibre hanya dipakai di `src/features/lab/`.

---

## 8. Firestore dan Seed Data

**Rules** ada di `firestore.rules` dan **hanya di-deploy oleh pemegang akun Firebase yang ditunjuk**:

```bash
firebase deploy --only firestore:rules
```

Untuk memeriksa apakah rules yang ter-deploy sama dengan repo: buka Firebase Console → Firestore Database → Rules, lalu bandingkan isinya dengan `firestore.rules` di `main`. Bila berbeda, laporkan ke pemegang akun; jangan menyalin rules dari Console ke repo tanpa PR.

**Seed data** (memerlukan `.env` dan akses ke project Firebase; jalankan hanya bila diminta pemegang akun):

```bash
node scripts/seed-firebase.js   # akun seed, kelas, dan sesi contoh (butuh ASISTEN_INVITE_CODE)
node scripts/seed-labs.js       # data lab awal (koordinat sementara; atur ulang lewat aplikasi)
node scripts/seed-izin.js       # data izin contoh
```

Kata sandi akun seed **tidak ditulis di dokumen ini**; tanyakan ke pemegang akun Firebase. Lab demo untuk gladi dibuat asisten lewat aplikasi dengan "Pakai lokasi saya sekarang".

Akun seed untuk demo dan verifikasi:

- **Asisten**: `dina@rawuh.ac.id`, `raka@rawuh.ac.id`
- **Praktikan (Kelas A)**: `bagas@rawuh.ac.id`, `citra@rawuh.ac.id`
- **Praktikan (Kelas B)**: `dani@rawuh.ac.id`, `eka@rawuh.ac.id`
- **Kode undangan asisten**: disimpan di dokumen `/config/asisten` (field `inviteCode`) dan dibagikan secara privat.

### 8.1 Ringkasan Rules

Prinsip *deny-by-default*:

- `users/{uid}`: pemilik membuat dokumennya; asisten wajib menyertakan kode undangan yang diverifikasi server.
- `sessions/{id}`: praktikan hanya membaca sesi kelasnya; kode 4 digit di subdokumen `private/code` hanya terbaca asisten.
- `attendances/{sessionId}_{uid}`: presensi hanya saat sesi `open`, kelas sesuai, kode cocok, belum presensi, tanpa izin disetujui, dengan bukti `lokasi` yang valid (SRS 6.2).
- `izin/{sessionId}_{uid}`: praktikan mengajukan dengan status awal `pending_ai`; hanya asisten yang memutuskan.
- `labs`: baca semua pengguna login, tulis asisten dengan validasi field.
- `users/{uid}/devices/{deviceId}`: token milik pengguna; asisten dapat membaca dan menghapus, tidak dapat membuat atau mengubah.

### 8.2 Bukti Uji 14 Kasus Keamanan Rules (DoD dan SRS 6.5)

Pengujian dilakukan lewat Rules Playground di Firebase Console dan verifikasi pada rules yang ter-deploy (D-03, D-05, D-06; PR #19). Belum ada skrip uji otomatis di repo.

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

> **Ringkasan:** 14 dari 14 kasus yang diuji dinyatakan **lulus** pada saat pengujian. Karena pengujian manual, hasil ini perlu diulang bila `firestore.rules` berubah.

### 8.3 Ringkasan Cek Singkat Live Deployment (Sprint 3)

1. **D-03 (Lab & Sesi)**: `deleteLab` memverifikasi sesi aktif langsung ke Firestore untuk mencegah orphaned `labId`.
2. **D-05 (Presensi Lokasi)**: Validasi field `lokasi` (map dengan hasOnly & hasAll 5 kunci: `lat`, `lng`, `akurasiM`, `jarakM`, `mocked`), `akurasiM <= 50`, `jarakM <= radiusM`, `mocked == false`, konsistensi `labId`, serta kompatibilitas mundur dokumen presensi lama Sprint 2.
3. **D-06 (Perangkat & Notifikasi Push)**: Validasi subkoleksi `devices` (`platform in ['android', 'ios']`, `token.size() <= 200`, `updatedAt is timestamp`), isolasi token antar pengguna, hak asisten membaca/menghapus token, dan pencegahan modifikasi token orang lain.
4. **Uji Kasus 1–9 Sesi & Presensi**: Verifikasi regresi memastikan pembaruan rules Sprint 3 pada `sessions` dan `attendances` tidak merusak validasi status sesi, kode privat, izin, dan hak akses praktikan.

---

## 9. Struktur Rute Utama

| Rute | Berkas | Isi |
| :--- | :--- | :--- |
| `/(auth)/login`, `/(auth)/daftar` | `src/app/(auth)/` | Masuk dan daftar (praktikan atau asisten dengan kode undangan) |
| `/praktikan/jadwal` | `src/app/praktikan/(tabs)/jadwal.tsx` | Jadwal sesi kelas dengan nama lab |
| `/praktikan/peta` | `src/app/praktikan/(tabs)/peta.tsx` | Peta lab dan panel info lab |
| `/praktikan/izin`, `/praktikan/riwayat` | `src/app/praktikan/(tabs)/` | Izin dan riwayat presensi |
| `/praktikan/presensi` | `src/app/praktikan/presensi.tsx` | Halaman presensi: sesi hari ini, info lokasi, form kode |
| `/praktikan/sesi/[id]` | `src/app/praktikan/sesi/[id].tsx` | Detail sesi dengan tombol ke halaman presensi dan ajukan izin |
| `/praktikan/izin/baru`, `/praktikan/izin/[id]` | `src/app/praktikan/izin/` | Form dan detail izin |
| `/asisten` | `src/app/asisten/index.tsx` | Daftar sesi dengan pintasan Izin, Kelas, Lab, Peta |
| `/asisten/buat` | `src/app/asisten/buat.tsx` | Form buat/ubah sesi dengan pilihan lab |
| `/asisten/sesi/[id]` | `src/app/asisten/sesi/[id].tsx` | Detail sesi, kode, dan rekap |
| `/asisten/lab`, `/asisten/lab/form` | `src/app/asisten/lab/` | Kelola lab (peta, radius, "Pakai lokasi saya") |
| `/asisten/peta` | `src/app/asisten/peta.tsx` | Peta lab dan panel info lab |
| `/asisten/izin/**`, `/asisten/kelas/**` | `src/app/asisten/` | Pemeriksaan izin dan kelola kelas |
