# SRS & Rencana Kerja Sprint 3: Aplikasi Presensi Praktikum "Rawuh" (Lokasi, Peta, dan Notifikasi)

PM: Elang · Tim: Dhimas, Ibrahim · Sprint: 3 · Versi 3.0 (lanjutan SRS v2.2) · Repo: `PPK-01/pertemuan-8`

> **Versi sebelumnya:** SRS v1.3 (Sprint 1) di `docs/arsip/SRS-v1.3-sprint-1.md`, SRS v2.2 (Sprint 2) di `docs/arsip/SRS-v2.2-sprint-2.md`. Komentar kode dan `DESIGN.md` yang ditulis sebelum Sprint 3 dengan rujukan "SRS §x" atau "SRS v2.2 §x" mengacu ke **v2.2**. Rujukan baru sejak Sprint 3 ditulis "SRS v3 §x".

## 1. Pendahuluan

### 1.1 Tujuan

Dokumen ini mendefinisikan kebutuhan perangkat lunak Sprint 3 dan melanjutkan SRS v2.2 (Sprint 2). Pada Sprint 2 aplikasi sudah memiliki akun Firebase, data Firestore yang tersinkron realtime, presensi berkode, izin, dan pemeriksaan izin berbantuan AI. Sprint 3 menambahkan tiga kemampuan perangkat, yaitu **lokasi**, **peta**, dan **push notification**, agar presensi hanya berhasil di sekitar lab, pengguna dapat melihat sebaran dan aktivitas lab Informatika, dan pengguna terkait menerima pemberitahuan saat ada peristiwa penting. Dokumen ini juga membagi file dan tugas Dhimas dan Ibrahim agar dapat bekerja paralel tanpa merge conflict.

### 1.2 Ruang Lingkup

**Berubah dari Sprint 2:**

- Presensi dipindah ke **halaman presensi khusus** yang terpisah dari detail sesi.
- Presensi wajib lolos **validasi lokasi**: sesi Dibuka **dan** perangkat berada di dalam radius lab sesi.
- Data **lab** (nama, koordinat, radius) dikelola asisten dan disimpan di Firestore. Sesi kini merujuk lab (`labId`) sebagai pengganti teks `ruang`.
- **Peta lab interaktif** dengan marker lab, posisi perangkat sendiri, dan panel **informasi aktivitas lab** (sesi yang berlangsung dan berikutnya) yang realtime.
- **Push notification** lewat Firebase Cloud Messaging (FCM), dikirim oleh Cloud Functions berdasarkan peristiwa, hanya ke pengguna terkait.
- Penanganan **izin dan kondisi perangkat**: izin lokasi ditolak, layanan lokasi mati, lokasi palsu, akurasi buruk, dan koneksi bermasalah.
- **Rebuild** development build dengan identitas aplikasi baru dan modul native baru.

**Di luar lingkup Sprint 3 (backlog):** posisi realtime pengguna lain di peta, lokasi di latar belakang, rute/arah ke lab, presensi QR code (Could, FR-45), aplikasi iOS, pencarian alamat (geocoding), riwayat notifikasi di dalam aplikasi, serta backlog Sprint 2 yang belum tersentuh (pengajuan ulang izin, reset kata sandi, cache offline persisten).

### 1.3 Yang Dipertahankan dari Sprint 2

- Stack: Expo SDK 57, TypeScript strict, Expo Router (`src/app/`), Zustand 5, Firebase **JS SDK modular** untuk Auth dan Firestore, light mode, development build Android.
- Firestore sebagai sumber kebenaran; Zustand sebagai cache yang diisi listener; aksi tulis async mengembalikan `Result` dengan pra-cek offline dan timeout 10 detik (FR-29).
- Presensi tetap memakai **kode sesi 4 digit** di `private/code`, ID dokumen `{sessionId}_{uid}`, `serverTimestamp()`, dan satu kali per sesi (FR-07 s.d. FR-09). Validasi lokasi **ditambahkan**, bukan menggantikan kode.
- Izin, AI EDOM lokal, rekap dengan kelompok Izin, CRUD kelas praktikum, security rules deny-by-default, sistem desain `DESIGN.md`, dan aturan kepemilikan file.
- Perbaikan pasca-audit Sprint 2: `createSession` dengan id yang aman dikirim ulang, `useSessionCode` berstatus, kode error kelas dibedakan (duplikat vs masih dipakai), logout mengosongkan seluruh cache, warna dari token tema.

### 1.4 Keputusan Teknis Baru

| Aspek | Keputusan | Alasan |
| --- | --- | --- |
| Paket Firebase | **Blaze** (pay-as-you-go) dengan **budget alert** | Cloud Functions hanya tersedia di Blaze; pemakaian kelas berada di kuota gratis. Alternatif Spark (notifikasi dikirim dari HP asisten) ditolak karena token praktikan harus terbaca klien dan pengiriman tidak andal |
| Pengirim notifikasi | **Cloud Functions for Firebase** (Firestore trigger, Node.js) di folder `functions/`, mengirim lewat `firebase-admin` (FCM) | Notifikasi benar-benar dipicu peristiwa di server; perubahan dari Console pun memicu notifikasi; token hanya dibaca server |
| Penerima notifikasi | **`expo-notifications`**: izin notifikasi, token FCM perangkat (`getDevicePushTokenAsync`), handler notifikasi masuk dan diketuk | Pustaka resmi Expo untuk development build; memakai FCM langsung tanpa perantara Expo Push Service |
| `google-services.json` | Ditambahkan **hanya untuk FCM** (kebutuhan `expo-notifications` di Android). Auth dan Firestore **tetap** memakai Firebase JS SDK | Sprint 2 menghindari file ini karena tidak dibutuhkan JS SDK; FCM native membutuhkannya. Tidak memuat rahasia |
| Peta | **`react-native-maps`** dengan `PROVIDER_GOOGLE` (Maps SDK for Android) | Paling matang, marker dan titik pengguna bawaan. Pemuatan peta seluler gratis tanpa batas, tetapi billing harus aktif (memakai akun billing yang sama). `expo-maps` ditolak (alpha); MapLibre + OpenStreetMap menjadi cadangan (bagian 14) |
| API key Maps | Dibatasi ke `package` Android + SHA-1 development build; disuntikkan lewat env saat build, tidak di-commit | Mencegah penyalahgunaan kunci |
| Lokasi | **`expo-location`**, hanya **foreground** | Cukup untuk presensi, peta, dan form lab; privasi terjaga |
| Marker pengguna | Posisi **perangkat sendiri**, diperbarui realtime di perangkat (`watchPositionAsync`) selama layar peta terbuka, tidak dikirim ke server | Privasi, kuota tulis Firestore, dan baterai |
| Validasi radius | Jarak dihitung di klien (rumus haversine); bukti lokasi disimpan di dokumen presensi; rules memeriksa konsistensi bukti dengan radius lab | Rules Firestore tidak dapat membaca GPS (risiko sisa di 6.4) |
| Identitas aplikasi | `package` Android baru (usulan `com.ppk01.rawuh`), `userInterfaceStyle: "light"`, pembaruan patch Expo, dalam **satu rebuild** di Fase 0 | FCM dan API key Maps terikat ke `package` dan SHA-1; satu rebuild untuk semua perubahan native |
| Web | Tetap didukung untuk uji tampilan; **peta diganti daftar lab** di web karena `react-native-maps` tidak mendukung web; lokasi di web memakai geolocation browser; notifikasi tidak aktif di web | NFR-06 dipertahankan sejauh mungkin |

Dependency baru dipasang sekali di Fase 0 oleh Dhimas: `expo-location`, `react-native-maps`, `expo-notifications`, `expo-device` (bila dibutuhkan `expo-notifications`), lewat `npx expo install`. `functions/package.json` milik Dhimas dan terpisah dari `package.json` aplikasi.

### 1.5 Asumsi dan Hal yang Masih Terbuka

1. Elang (developer pada Sprint 1–2) menjadi Project Manager Sprint 3 dan tidak menulis kode fitur; pengembangnya Dhimas dan Ibrahim. File yang pada v2.2 dimiliki Elang (UI kit, tema, sisi asisten, `DESIGN.md`) berpindah ke Ibrahim.
2. **Paket Blaze dan akun billing** dapat dipasang oleh owner project (Dhimas). Bila tidak, rencana cadangan di bagian 14 berlaku.
3. Penafsiran "marker pengguna realtime" sebagai posisi perangkat sendiri, pengiriman notifikasi lewat Cloud Functions, dan peta Google **dikonfirmasi ke asisten praktikum** (P-01).
4. Lab Informatika awal diisi dari daftar nama lab (P-04); koordinatnya diatur asisten lewat aplikasi. Untuk demo, lab demo diatur di ruang demo.
5. Akurasi GPS di dalam gedung dapat buruk; radius bawaan 50 m dan batas akurasi 50 m dipilih untuk keperluan demo dan dapat disesuaikan.

## 2. Aktor dan Hak Akses

Tambahan terhadap tabel v2.2 (baris lain tetap):

| Kemampuan | Belum login | Praktikan | Asisten |
| --- | --- | --- | --- |
| Presensi | Tidak | Ya (kelasnya, sesi Dibuka, **di dalam radius lab**, sekali per sesi) | Tidak |
| Melihat daftar lab dan peta | Tidak | Ya | Ya |
| Tambah, ubah, hapus lab (koordinat, radius) | Tidak | Tidak | Ya |
| Melihat aktivitas lab | Tidak | Sesi kelasnya | Semua sesi |
| Menerima notifikasi | Tidak | Sesi dibuka, jadwal baru, keputusan izin, perubahan lokasi praktikum (kelasnya / miliknya) | Izin baru (Could, FR-55) |
| Melihat bukti lokasi presensi | Tidak | Milik sendiri | Semua (di rekap) |

## 3. Arsitektur dan Model Data

### 3.1 Struktur Firestore (tambahan dan perubahan)

```
labs/{labId}                   { nama, gedung?, lat, lng, radiusM,
                                 createdBy, createdAt, updatedBy, updatedAt }          // BARU
sessions/{sessionId}           { ...v2.2, labId }                                     // labId BARU; `ruang` lihat 3.2
attendances/{sessionId}_{uid}  { ...v2.2, labId,
                                 lokasi: { lat, lng, akurasiM, jarakM, mocked } }       // DIUBAH
users/{uid}/devices/{deviceId} { token, platform, updatedAt }                          // BARU
```

Keputusan struktur:

- **Sesi merujuk lab lewat `labId`.** Nama, koordinat, dan radius selalu dibaca dari `labs`, sehingga perubahan lab langsung tercermin di semua sesi dan peta.
- **Bukti lokasi disimpan di dokumen presensi** (koordinat, akurasi, jarak, status `mocked`) agar asisten dapat memeriksa dan rules dapat memvalidasi konsistensinya.
- **Token perangkat di subkoleksi `devices`** milik pengguna. Satu pengguna dapat memiliki beberapa perangkat. `deviceId` diturunkan dari token (mis. hash) agar penulisan ulang token yang sama tidak menggandakan dokumen.

### 3.2 Model Domain (perubahan pada `src/types/index.ts`)

```ts
export type LabId = string;

Lab {
  id, nama, gedung?: string,
  lat: number, lng: number,       // titik presensi
  radiusM: number,                // MIN_RADIUS_M..MAX_RADIUS_M
  createdBy, updatedBy
}

Session { ...v2.2, labId?: LabId }
// labId wajib untuk sesi baru (validasi form + rules create).
// `ruang` tidak lagi diisi untuk sesi baru dan dipertahankan hanya untuk sesi lama.
// Tampilan: nama lab bila labId ada, selain itu `ruang`, selain itu "Lab belum diatur".

LokasiPresensi { lat: number, lng: number, akurasiM: number, jarakM: number, mocked: boolean }
Attendance { ...v2.2, labId: LabId, lokasi: LokasiPresensi }

DevicePosition { lat: number, lng: number, akurasiM: number, mocked: boolean, at: string }

LocationStatus =
  | 'idle'                 // belum diminta
  | 'checking'             // sedang mengambil posisi
  | 'ready'                // posisi tersedia dan layak dipakai
  | 'permission_denied'    // ditolak, masih bisa diminta lagi
  | 'permission_blocked'   // ditolak permanen (harus lewat Pengaturan)
  | 'services_off'         // layanan lokasi perangkat mati
  | 'low_accuracy'         // akurasi > MAX_ACCURACY_M
  | 'mocked'               // lokasi palsu terdeteksi
  | 'timeout'              // posisi tidak didapat dalam LOCATION_TIMEOUT_MS
  | 'unavailable'          // web/perangkat tanpa layanan lokasi

AttendFailReason = ...v2.2
  | 'NO_LAB'                // sesi belum punya lab
  | 'OUTSIDE_RADIUS'        // jarak > radius lab
  | 'LOW_ACCURACY' | 'MOCKED_LOCATION'
  | 'LOCATION_PERMISSION' | 'LOCATION_SERVICES_OFF' | 'LOCATION_TIMEOUT'

NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported'

NotifPayload =                                 // `data` pada pesan FCM
  | { type: 'session_opened', sessionId }      // N1
  | { type: 'session_created', sessionId }     // N2
  | { type: 'izin_decided', izinId }           // N3
  | { type: 'location_changed', sessionId }    // N4
```

Kode error `Result` untuk lab mengikuti pola kelas pasca-audit: kode "masih dipakai" untuk hapus lab yang dipakai sesi yang belum Ditutup, kode "duplikat" untuk nama lab yang sama.

Konstanta di `src/constants/location.ts`:

| Nama | Nilai | Arti |
| --- | --- | --- |
| `DEFAULT_RADIUS_M` | 50 | Radius bawaan lab baru |
| `MIN_RADIUS_M` / `MAX_RADIUS_M` | 10 / 200 | Batas radius yang boleh diatur asisten |
| `MAX_ACCURACY_M` | 50 | Akurasi GPS terburuk yang diterima untuk presensi |
| `LOCATION_TIMEOUT_MS` | 15000 | Batas waktu mengambil posisi |

### 3.3 Alur Presensi Berbasis Lokasi

```
[halaman presensi] -> minta izin lokasi -> ambil posisi -> hitung jarak ke lab sesi
   -> tampilkan info lokasi (lab, jarak, radius, akurasi, status)
   -> praktikan isi kode -> konfirmasi
   -> store: pra-cek (offline, sesi Dibuka, kelas, sudah hadir, izin disetujui, lab ada,
             posisi segar ≤ 30 detik, mocked, akurasi, radius)
   -> tulis attendances/{sessionId}_{uid} dengan labId + lokasi
   -> rules memvalidasi ulang (status sesi, kode, bukti lokasi vs radius lab)
```

Posisi diambil ulang tepat sebelum menulis bila posisi terakhir lebih tua dari 30 detik.

### 3.4 Alur Notifikasi

```
[aksi di aplikasi atau Console] -> dokumen Firestore berubah
   -> Cloud Function (onDocumentCreated / onDocumentUpdated) mendeteksi peristiwa N1–N4
   -> menentukan penerima (praktikan kelas sesi, atau pengaju izin)
   -> membaca users/{uid}/devices -> firebase-admin messaging.sendEachForMulticast
   -> token tidak valid dihapus (FR-54)
[perangkat] -> notifikasi tampil -> diketuk -> root layout membaca `data` -> navigasi ke layar terkait
```

Region Cloud Functions disamakan dengan lokasi database Firestore.

### 3.5 Kontrak Layer Data (tambahan)

```
services/labs.ts          listenLabs, addLab, updateLab, deleteLab (cek dipakai sesi yang belum Ditutup)
services/location.ts      getPermission, requestPermission, openSettings, isServicesEnabled,
                          requestEnableServices (Android), getPosition(timeout), watchPosition,
                          distanceM(a, b) /* haversine, fungsi murni */
services/attendance.ts    submitAttendance(sessionId, code, position) /* + labId, lokasi */
services/notifications.ts getNotifPermission, requestNotifPermission, getDeviceToken,
                          saveDeviceToken, removeDeviceToken, addNotificationListeners
functions/src/index.ts    onSessionCreated (N2), onSessionUpdated (N1, N4),
                          onLabUpdated (N4), onIzinUpdated (N3)
```

**Kontrak store (tambahan pada `src/store/appStore.ts`)**

```
State : labs, location: { status: LocationStatus, position: DevicePosition | null },
        notifPermission: NotificationPermission,
        sync: + 'labs'
Aksi  : addLab(input) / updateLab(id, patch) / deleteLab(id)  -> Promise<Result>
        requestLocation()            -> Promise<LocationStatus>   // minta izin bila perlu, lalu ambil posisi
        refreshLocation()            -> Promise<LocationStatus>
        openLocationSettings()       -> Promise<void>
        enableLocationServices()     -> Promise<LocationStatus>   // dialog sistem Android
        submitAttendance(sessionId, code) -> Promise<AttendResult> // posisi diambil dari state, divalidasi ulang
        registerDevice()             -> Promise<void>              // dipanggil setelah login
        // logout() kini juga menghapus token perangkat ini dan menghentikan watch lokasi
Hook baca (* baru):
        useLabs()*, useLabById(id)*, useLabForSession(sessionId)*,
        useLabActivity(labId)*        // { berlangsung: Session[], berikutnya: Session[] } sudah difilter per peran
        useLocation()*                // { status, position }
        useDistanceToLab(labId)*      // { jarakM, didalamRadius } | null
        useWatchPosition(enabled)*    // menyalakan watch selama layar peta terbuka
        useTodaySessionsForAttendance()*  // sesi kelas praktikan hari ini + status presensinya
        useNotifPermission()*
```

`services/location.ts` dan `services/notifications.ts` hanya diimpor oleh `store/` (aturan v2.2). Komponen peta `react-native-maps` dipakai di `features/lab/**`, bukan di `components/**`.

**Mode pengembangan tanpa Firebase.** Mode in-memory ditambah data dummy lab (minimal 3 lab, satu di antaranya tanpa sesi). Lokasi di mode ini memakai posisi perangkat sungguhan bila tersedia; konstanta pengembangan `DEV_FAKE_POSITION` (hanya `__DEV__`) boleh dipakai untuk menguji "di dalam radius" dan "di luar radius" di web.

## 4. Kebutuhan Fungsional

Kolom **Status** membandingkan dengan SRS v2.2: *Tetap*, *Diubah*, atau *Baru*.

### 4.1 Daftar Kebutuhan

**Halaman presensi**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-32 | **Halaman presensi khusus**, dibuka dari tombol aksi bulat di `PraktikanTabBar` (dan dari notifikasi N1). Menampilkan sesi kelas praktikan **hari ini**: praktikum, waktu, lab, status sesi (Dijadwalkan/Dibuka/Ditutup), dan status presensinya (Belum, Sudah hadir pukul …, Izin disetujui). | Praktikan | Baru | Must |
| FR-33 | Sesi Dibuka yang belum dipresensi tampil paling atas dengan tombol "Presensi". Sesi Dijadwalkan menampilkan jam mulai; sesi Ditutup dan yang sudah dipresensi tanpa tombol. Empty state bila tidak ada sesi hari ini. | Praktikan | Baru | Must |
| FR-07 | Presensi hanya saat sesi Dibuka, **kini lewat halaman presensi** (form kode, info lokasi, bottom sheet konfirmasi). | Praktikan | Diubah | Must |
| FR-34 | Form presensi di **detail sesi** praktikan dihapus. Bila sesi Dibuka dan belum presensi, detail sesi menampilkan tombol "Buka halaman presensi". | Praktikan | Baru | Must |

**Presensi berbasis lokasi**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-35 | Presensi berhasil hanya bila **semua** terpenuhi: sesi Dibuka; belum presensi; tidak ada izin disetujui; kode benar; sesi punya lab; posisi **di dalam radius** lab; akurasi ≤ `MAX_ACCURACY_M`; lokasi bukan palsu (`mocked` = false). | Praktikan | Baru | Must |
| FR-36 | Saat presensi, layar menampilkan **info lokasi**: nama lab, jarak ke lab (meter), radius, akurasi, dan status ("Di dalam radius" / "Di luar radius"), dalam teks, tidak hanya warna. Tombol "Perbarui lokasi". | Praktikan | Baru | Must |
| FR-37 | Di luar radius: tombol presensi nonaktif dengan pesan "Kamu berada {x} m dari {lab}. Mendekatlah hingga {radius} m." | Praktikan | Baru | Must |
| FR-38 | Dokumen presensi menyimpan `labId` dan `lokasi` (lat, lng, akurasi, jarak, mocked). Aturan satu kali per sesi tetap (FR-09). | Praktikan | Baru | Must |
| FR-39 | Rekap asisten menampilkan jarak presensi tiap praktikan (mis. "09.03 · 12 m"). | Asisten | Baru | Should |
| FR-45 | Presensi dengan memindai **QR code** sebagai pengganti mengetik kode sesi. | Praktikan | Baru | Could |

**Pengelolaan lokasi lab**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-40 | Asisten dapat **menambah, mengubah, dan menghapus lab**: nama, gedung (opsional), koordinat, radius. Tersimpan di `labs` dan langsung terlihat semua pengguna. | Asisten | Baru | Must |
| FR-41 | Koordinat diisi dengan **"Pakai lokasi saya sekarang"** atau **menggeser marker di peta**. Radius diatur dalam `MIN_RADIUS_M`–`MAX_RADIUS_M`; lingkaran radius tampil di peta form. | Asisten | Baru | Must |
| FR-04 | Form buat sesi memakai **pilihan lab** (menggantikan input teks ruang). Sesi baru wajib punya lab. | Asisten | Diubah | Must |
| FR-18 | Ubah sesi: saat Dijadwalkan semua field termasuk lab; saat Dibuka hanya topik, **lab**, dan jam selesai; saat Ditutup tidak dapat diubah. | Asisten | Diubah | Must |
| FR-43 | Lab tidak dapat dihapus bila masih dipakai sesi yang belum Ditutup; nama lab unik. | Asisten | Baru | Must |

**Peta dan informasi aktivitas lab**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-44 | **Peta lab** (tab Peta praktikan; pintasan Peta di beranda asisten): marker semua lab dan **posisi perangkat sendiri** yang diperbarui realtime selama layar terbuka. Tombol "Ke posisiku" dan "Lihat semua lab". Di web: daftar lab + jarak sebagai pengganti peta. | Keduanya | Baru | Must |
| FR-46 | Mengetuk marker membuka **panel info lab**: nama, gedung, jarak dari pengguna, **sesi yang sedang berlangsung** (Dibuka, atau Dijadwalkan dalam rentang waktunya), dan **sesi berikutnya** (praktikum, kelas, waktu, status). Perubahan sesi tercermin realtime. | Keduanya | Baru | Must |
| FR-47 | Praktikan hanya melihat sesi kelasnya di panel info lab; asisten melihat semua. Dari panel, sesi dapat dibuka ke detail sesi. | Keduanya | Baru | Must |
| FR-48 | Marker lab yang sedang memiliki sesi Dibuka dibedakan dengan ikon dan label, bukan hanya warna. | Keduanya | Baru | Should |
| FR-49 | Peta kecil di rekap sesi asisten menampilkan titik lokasi presensi praktikan dan lingkaran radius lab. | Asisten | Baru | Could |

**Push notification**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-50 | Setelah login, aplikasi meminta izin notifikasi (dengan penjelasan singkat) lalu menyimpan token FCM perangkat di `users/{uid}/devices`. Saat logout, token perangkat itu dihapus. | Keduanya | Baru | Must |
| FR-51 | Cloud Functions mengirim notifikasi berdasarkan peristiwa, **hanya ke pengguna terkait** (tabel 4.4). | Praktikan | Baru | Must |
| FR-52 | Mengetuk notifikasi membuka layar terkait: N1 → halaman presensi, N2/N4 → detail sesi, N3 → detail izin. Bila belum login, layar dibuka setelah login. | Praktikan | Baru | Must |
| FR-53 | Notifikasi yang masuk saat aplikasi terbuka tetap tampil sebagai banner sistem. | Praktikan | Baru | Must |
| FR-54 | Token tidak valid (aplikasi dihapus, token kedaluwarsa) dihapus otomatis oleh Function saat pengiriman gagal. | n/a | Baru | Should |
| FR-55 | Asisten pembuat sesi menerima notifikasi saat ada **izin baru** untuk sesinya. | Asisten | Baru | Could |

**Izin dan kondisi perangkat**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-56 | Sebelum meminta izin lokasi, tampil penjelasan kenapa lokasi dibutuhkan, lalu tombol "Izinkan lokasi". | Keduanya | Baru | Must |
| FR-57 | Setiap kondisi lokasi punya pesan dan aksi yang jelas (tabel 4.3): ditolak, ditolak permanen, layanan mati, akurasi buruk, lokasi palsu, waktu habis. | Keduanya | Baru | Must |
| FR-58 | Offline: pola FR-29 (banner, tombol tulis nonaktif). Peta tetap tampil dengan data lab terakhir; panel info lab memberi tanda data mungkin belum terbaru. | Keduanya | Baru | Must |
| FR-59 | Izin notifikasi ditolak: aplikasi tetap berfungsi; di profil tampil "Notifikasi nonaktif" + "Buka Pengaturan". | Keduanya | Baru | Should |

**Lintas fitur**

| ID | Kebutuhan | Peran | Status | Prioritas |
| --- | --- | --- | --- | --- |
| FR-03 | Detail sesi menampilkan **nama lab** (dari `labs`) sebagai pengganti ruang, ikut ter-update realtime. | Keduanya | Diubah | Must |
| FR-31 | Security rules diperluas untuk `labs`, `devices`, dan bukti lokasi presensi (bagian 6). | Keduanya | Diubah | Must |
| FR-12 | Tiga alur demo end-to-end (bagian 9) berjalan konsisten. | Keduanya | Diubah | Must |

### 4.2 Aturan Validasi (tambahan)

| Input | Aturan |
| --- | --- |
| Nama lab | Dipangkas spasi, 2–50 karakter, unik (tanpa membedakan huruf besar/kecil) |
| Gedung | Opsional, maksimal 60 karakter |
| Koordinat | `lat` −90..90, `lng` −180..180, angka berhingga |
| Radius | Bilangan bulat `MIN_RADIUS_M`..`MAX_RADIUS_M` |
| Sesi | `labId` wajib dan merujuk lab yang ada (menggantikan aturan ruang 1–30 karakter untuk sesi baru) |
| Posisi presensi | Umur ≤ 30 detik, akurasi ≤ `MAX_ACCURACY_M`, `mocked` = false |

Fungsi validasi berupa fungsi murni: `features/lab/labValidation.ts` (milik Ibrahim) dan `services/location.ts#distanceM` (milik Dhimas).

### 4.3 Pesan Error dan Kondisi Lokasi

| Kondisi | Pesan | Aksi |
| --- | --- | --- |
| Izin lokasi belum diminta | "Rawuh membutuhkan lokasimu untuk memastikan kamu berada di lab saat presensi." | "Izinkan lokasi" |
| `permission_denied` | "Akses lokasi ditolak. Presensi membutuhkan lokasimu." | "Coba lagi" |
| `permission_blocked` | "Akses lokasi diblokir. Aktifkan di Pengaturan aplikasi." | "Buka Pengaturan" |
| `services_off` | "Layanan lokasi di HP-mu tidak aktif." | "Aktifkan lokasi" |
| `low_accuracy` | "Lokasi belum akurat (±{x} m). Pindah ke dekat jendela atau tempat terbuka, lalu perbarui." | "Perbarui lokasi" |
| `mocked` | "Lokasi palsu terdeteksi. Matikan aplikasi pengubah lokasi." | n/a |
| `timeout` | "Lokasi belum didapat. Pastikan GPS aktif lalu coba lagi." | "Perbarui lokasi" |
| `unavailable` | "Lokasi tidak tersedia di perangkat ini." | n/a |
| Presensi `OUTSIDE_RADIUS` | "Kamu berada {x} m dari {lab}. Mendekatlah hingga {radius} m." | "Perbarui lokasi" |
| Presensi `NO_LAB` | "Lab sesi ini belum diatur asisten." | n/a |
| Hapus lab dipakai sesi | "Lab ini masih dipakai sesi yang belum ditutup." | n/a |
| Izin notifikasi ditolak | "Notifikasi nonaktif. Kamu tidak akan menerima pemberitahuan sesi dan izin." | "Buka Pengaturan" |

Pesan error v2.2 tetap berlaku. Urutan pra-cek presensi v2.2 diperluas: offline → sesi tidak Dibuka → kelas berbeda → sudah hadir → izin disetujui → **lab tidak ada → status lokasi bukan `ready` → di luar radius**. Bila penulisan tetap ditolak rules, penentuan alasan mengikuti v2.2.

### 4.4 Peristiwa Notifikasi

| ID | Peristiwa (pemicu) | Penerima | Judul / isi | Tujuan saat diketuk |
| --- | --- | --- | --- | --- |
| N1 | Status sesi `scheduled → open` | Praktikan kelas sesi | "Sesi dibuka" / "{Praktikum} kelas {X} dibuka. Presensi sekarang di {Lab}." | Halaman presensi |
| N2 | Dokumen sesi dibuat | Praktikan kelas sesi | "Jadwal baru" / "{Praktikum}: {hari, tanggal, jam} di {Lab}." | Detail sesi |
| N3 | Status izin `→ approved / rejected` | Praktikan pengaju | "Izin disetujui" / "Izin ditolak" + "untuk {Praktikum} {tanggal}." | Detail izin |
| N4 | `labId` sesi yang belum Ditutup berubah, **atau** koordinat/nama lab yang dipakai sesi yang belum Ditutup berubah | Praktikan kelas sesi tersebut | "Lokasi praktikum berubah" / "{Praktikum} kini di {Lab}." | Detail sesi |
| N5 (Could) | Izin baru dibuat | Asisten pembuat sesi | "Izin baru" / "{Nama} mengajukan izin untuk {Praktikum}." | Detail izin asisten |

Function tidak mengirim notifikasi ganda untuk satu peristiwa (mis. N2 tidak terkirim lagi saat sesi diubah). N4 dari perubahan lab dikirim satu kali per sesi terdampak.

## 5. Integrasi AI

Tidak berubah dari v2.2 bagian 5.

## 6. Keamanan dan Firebase Security Rules

### 6.1 Prinsip (tambahan)

- Lokasi diperlakukan sebagai data pribadi: hanya dikirim saat presensi berhasil, hanya terbaca pemilik dan asisten.
- Token perangkat hanya terbaca pemiliknya; Cloud Functions membacanya lewat Admin SDK.
- Service account, API key Maps, dan konfigurasi rahasia tidak masuk repo. `google-services.json` boleh di-commit (tidak memuat rahasia); API key Maps disuntikkan lewat env saat build.

### 6.2 Ringkasan Akses per Koleksi (tambahan dan perubahan)

| Koleksi | Baca | Tulis |
| --- | --- | --- |
| `labs` | Semua pengguna login | Asisten, dengan validasi field (4.2) |
| `sessions` | Tetap | Tambahan: `labId` wajib saat create dan merujuk lab yang ada; saat Dibuka, `changedOnly` kini `['topik', 'labId', 'endAt', 'updatedAt']` |
| `attendances` | Tetap | Tambahan saat create: `labId` = `labId` sesi; bukti `lokasi` lengkap; `jarakM` ≤ `radiusM` lab; `akurasiM` ≤ 50; `mocked == false` |
| `users/{uid}/devices` | Pemilik | Pemilik |

### 6.3 Sketsa Rules (tambahan pada sketsa v2.2)

```
function labOf(id) { return get(/databases/$(db)/documents/labs/$(id)).data; }

match /labs/{labId} {
  allow read: if signedIn();
  allow create, update: if isAsisten()
    && request.resource.data.keys().hasOnly(['nama','gedung','lat','lng','radiusM',
                                             'createdBy','createdAt','updatedBy','updatedAt'])
    && request.resource.data.nama is string
    && request.resource.data.nama.size() >= 2 && request.resource.data.nama.size() <= 50
    && request.resource.data.lat is number && request.resource.data.lat >= -90 && request.resource.data.lat <= 90
    && request.resource.data.lng is number && request.resource.data.lng >= -180 && request.resource.data.lng <= 180
    && request.resource.data.radiusM is int
    && request.resource.data.radiusM >= 10 && request.resource.data.radiusM <= 200;
  allow delete: if isAsisten();     // cek "masih dipakai" di service
}

// sessions: create menambah
//   && exists(/databases/$(db)/documents/labs/$(request.resource.data.labId))
// sessions: cabang update saat Dibuka memakai changedOnly(['topik','labId','endAt','updatedAt'])

// attendances: create mengganti hasOnly dan menambah
//   request.resource.data.keys().hasOnly(['sessionId','userId','kelas','code','timestamp','labId','lokasi'])
//   && request.resource.data.labId == sessionOf(request.resource.data.sessionId).labId
//   && request.resource.data.lokasi.mocked == false
//   && request.resource.data.lokasi.akurasiM <= 50
//   && request.resource.data.lokasi.jarakM <= labOf(request.resource.data.labId).radiusM

match /users/{uid}/devices/{deviceId} {
  allow read, write: if signedIn() && request.auth.uid == uid;
}
```

Sketsa ini acuan logika. Rules final diuji di emulator sebelum di-deploy (6.5) dan hanya di-deploy oleh Dhimas.

### 6.4 Risiko Sisa yang Diterima (tambahan)

- **Bukti lokasi berasal dari perangkat.** Klien yang dimodifikasi atau perangkat yang di-root dapat mengirim koordinat palsu yang tidak terdeteksi sebagai `mocked`. Mitigasi: deteksi `mocked`, kode sesi, bukti lokasi tersimpan dan terlihat di rekap, serta pemeriksaan asisten. Validasi lokasi di server (mis. Play Integrity) masuk backlog.
- **Jarak dihitung klien.** Rules hanya memeriksa konsistensi `jarakM` dengan radius, bukan menghitung ulang dari koordinat (rules tidak mendukung fungsi trigonometri).
- **Notifikasi tidak dijamin terkirim** (perangkat mati, mode hemat baterai). Notifikasi bersifat pemberitahuan; sumber kebenaran tetap data di aplikasi.

### 6.5 Pengujian Rules

Sembilan kasus v2.2 tetap, ditambah:

10. Asisten dapat membuat dan mengubah lab dengan data valid; praktikan tidak dapat menulis lab.
11. Lab dengan radius di luar 10–200 atau koordinat tidak valid ditolak.
12. Sesi baru tanpa `labId` atau dengan `labId` yang tidak ada ditolak.
13. Presensi dengan `jarakM` > radius, `akurasiM` > 50, `mocked` = true, atau `labId` berbeda dari sesi ditolak; presensi dengan bukti valid berhasil.
14. Pengguna tidak dapat membaca atau menulis `devices` milik pengguna lain.

## 7. Kebutuhan Non-Fungsional

NFR-01 s.d. NFR-12 dari v2.2 tetap berlaku, dengan catatan NFR-06 (web) mengikuti keputusan 1.4.

| ID | Kebutuhan |
| --- | --- |
| NFR-13 Privasi lokasi | Lokasi hanya diambil saat layar presensi, peta, atau form lab terbuka (foreground). Watch posisi berhenti saat layar ditinggalkan. Posisi hanya dikirim ke server saat presensi berhasil. Tidak ada background location. |
| NFR-14 Notifikasi | Notifikasi tiba ≤ 1 menit setelah peristiwa pada perangkat yang online dan mengizinkan notifikasi. |
| NFR-15 Realtime lab | Perubahan sesi dan lab tercermin di peta dan panel info lab ≤ 3 detik (selaras NFR-08). |
| NFR-16 Aksesibilitas peta | Status lokasi dan marker tidak dibedakan hanya dengan warna; tombol peta punya `aria-label`; info lab dan jarak juga tersedia sebagai teks di panel, sehingga peta tidak menjadi satu-satunya sumber informasi. |
| NFR-17 Biaya | Budget alert aktif; API key Maps dibatasi `package` + SHA-1; tidak memakai API Google berbayar (Places, Directions, Geocoding); Function tidak melakukan polling. |
| NFR-18 Baterai | Watch posisi memakai akurasi seimbang dan interval wajar (mis. 5 detik / 5 meter) dan berhenti saat aplikasi ke latar belakang. |

## 8. Navigasi dan Interaksi

```
/praktikan  (Stack)
  (tabs)/jadwal         Jadwal kelasnya                                                      [Dhimas]
  (tabs)/peta           Peta lab + panel info lab (BARU)                                     [Ibrahim]
  (tabs)/izin           Daftar izin sendiri                                                  [Dhimas]
  (tabs)/riwayat        Riwayat presensi                                                     [Dhimas]
  presensi              Halaman presensi: sesi hari ini + info lokasi + form kode (BARU)     [Ibrahim]
  sesi/[id]             Detail sesi: nama lab; form presensi diganti tombol ke halaman presensi [Dhimas]
/asisten  (Stack)
  index                 Daftar sesi; pintasan Izin, Kelas, Lab, Peta                         [Ibrahim]
  buat                  Form buat/ubah sesi dengan pilihan lab                               [Ibrahim]
  sesi/[id]             Detail + rekap dengan jarak presensi                                 [Ibrahim]
  lab/index             Daftar lab (BARU)                                                    [Ibrahim]
  lab/form              Tambah/ubah lab: peta, "Pakai lokasi saya", radius (BARU)            [Ibrahim]
  peta                  Peta lab + panel info lab (BARU)                                     [Ibrahim]
  izin/**, kelas/**     Tetap                                                                [Ibrahim]
```

- **Tab praktikan** saat ini Jadwal · Izin · Riwayat · Profil. Sprint 3 menjadikannya Jadwal · Peta · Izin · Riwayat, dengan **tombol aksi bulat** di tengah `PraktikanTabBar` membuka halaman presensi (diberi penanda bila ada sesi Dibuka yang belum dipresensi). **Profil pindah** dari tab ke tombol avatar di header Jadwal agar jumlah tab tetap empat; keputusan final di Fase 0 oleh Dhimas (pemilik tab bar) bersama Ibrahim.
- Peta asisten dan praktikan memakai komponen yang sama dari `features/lab/LabMap`; perbedaan peran hanya pada isi panel (FR-47).
- Notifikasi diketuk → root layout menavigasi sesuai `NotifPayload` (FR-52).

## 9. Skenario Demo (kriteria penerimaan utama)

Dijalankan di dua HP Android (development build baru). Prasyarat: akun asisten (mis. Dina) dan praktikan kelas A (mis. Bagas, Citra); notifikasi diizinkan di HP praktikan; **lab demo dibuat asisten dengan "Pakai lokasi saya sekarang" di ruang demo**, radius 50 m; satu lab lain berjarak jauh (mis. gedung lain).

### Alur 1: Presensi berbasis lokasi

1. **Asisten** membuat sesi Basis Data kelas A di lab demo → HP Bagas menerima **notifikasi N2**.
2. Asisten membuka sesi → **notifikasi N1**. Bagas mengetuk notifikasi → halaman presensi terbuka.
3. Halaman presensi menampilkan lab, jarak, radius, akurasi, dan status "Di dalam radius".
4. Bagas mengisi kode, konfirmasi → sukses dengan waktu server. Dokumen presensi memuat `labId` dan `lokasi`.
5. Bagas mencoba lagi → ditolak "Kamu sudah presensi pada sesi ini".
6. Di HP asisten, rekap menampilkan Bagas, jamnya, dan jaraknya dalam ≤ 3 detik.
7. (Tepi) Asisten membuat dan membuka sesi kedua di **lab jauh**. Citra membuka halaman presensi: status "Di luar radius", tombol nonaktif, pesan jarak tampil.

### Alur 2: Peta dan informasi lab

1. Bagas membuka tab **Peta** → marker semua lab dan posisinya tampil.
2. "Ke posisiku" lalu "Lihat semua lab" bekerja.
3. Bagas mengetuk lab demo → panel info menampilkan sesi yang sedang berlangsung dan sesi berikutnya.
4. Di HP asisten, sesi itu ditutup → panel di HP Bagas berubah tanpa membuka ulang aplikasi.

### Alur 3: Notifikasi kegiatan dan perubahan lokasi

1. Asisten memindahkan sesi yang belum ditutup ke lab lain → HP Bagas menerima **notifikasi N4**; peta dan detail sesi ikut berubah.
2. Citra mengajukan izin; asisten menolak → Citra menerima **notifikasi N3**; diketuk → detail izin.

### Skenario Tepi (wajib lolos di Fase 2)

| Kasus | Hasil yang diharapkan |
| --- | --- |
| Izin lokasi ditolak | Pesan + "Coba lagi"; tombol presensi nonaktif |
| Izin lokasi ditolak permanen | Pesan + "Buka Pengaturan" membuka pengaturan aplikasi |
| GPS (layanan lokasi) mati | Pesan + "Aktifkan lokasi" memunculkan dialog sistem |
| Aplikasi pengubah lokasi aktif | Status `mocked`; presensi ditolak |
| Mode pesawat di halaman presensi | Banner offline; tombol presensi nonaktif; peta tetap tampil |
| Izin notifikasi ditolak | Aplikasi tetap jalan; profil menampilkan status notifikasi nonaktif |
| Logout lalu login akun lain di HP yang sama | Notifikasi untuk akun lama tidak lagi diterima |
| Hapus lab yang dipakai sesi Dibuka | Ditolak dengan pesan jelas |
| Sesi lama tanpa lab | Tampil "Lab belum diatur"; presensi ditolak `NO_LAB` |

## 10. Struktur File dan Kepemilikan (anti merge conflict)

Elang (PM) tidak memiliki file kode fitur. **Ibrahim mengambil alih file yang pada v2.2 dimiliki Elang** (UI kit, tema, sisi asisten, `DESIGN.md`). Dhimas tetap pada fondasi data, auth, sisi praktikan yang sudah ada, dan kini juga server (Cloud Functions) dan konfigurasi native.

```
app.json, eas.json, package.json, lockfile    DHIMAS   + plugin location/maps/notifications, package baru
google-services.json                          DHIMAS   baru (FCM)
functions/**                                  DHIMAS   baru: Cloud Functions N1–N5 + package.json sendiri
firestore.rules, firestore.indexes.json       DHIMAS   + labs, devices, bukti lokasi
src/
  app/
    _layout.tsx                    DHIMAS   + handler notifikasi, navigasi saat diketuk, registerDevice
    praktikan/(tabs)/_layout.tsx   DHIMAS   tab: Jadwal, Peta, Izin, Riwayat
    praktikan/(tabs)/peta.tsx      IBRAHIM  baru (rute tipis, isi dari features/lab)
    praktikan/presensi.tsx         IBRAHIM  baru
    praktikan/sesi/[id].tsx        DHIMAS   hapus form presensi, tombol ke halaman presensi, nama lab
    praktikan/** lainnya           DHIMAS   tetap
    asisten/**                     IBRAHIM  dari Elang; + lab/index, lab/form, peta
  constants/location.ts            DHIMAS   baru
  services/                        DHIMAS   + labs, location, notifications; attendance diubah
  types/index.ts, store/**         DHIMAS   + lab, lokasi, notifikasi
  theme/**                         IBRAHIM  dari Elang
  components/**                    IBRAHIM  dari Elang; + LocationStatusCard, PermissionPrompt,
                                            LabInfoSheet, RadiusField (hanya props, tanpa store/peta)
  features/asisten/**              IBRAHIM  dari Elang; RekapList + jarak, SessionForm + pilihan lab
  features/lab/**                  IBRAHIM  baru: LabMap, LabMarker, LabForm, labValidation.ts
  features/presensi/**             IBRAHIM  baru: daftar sesi hari ini, PresensiLokasiForm
  features/praktikan/**            DHIMAS   tetap; PraktikanTabBar + tombol aksi presensi
docs/SRS.md, docs/arsip/**         ELANG (PM)
docs/adr/**                        pembuat keputusan teknis (Dhimas untuk Functions/FCM/Maps)
docs/README.md                     DHIMAS   + setup Blaze, FCM, Maps, Functions, emulator
DESIGN.md                          IBRAHIM  dari Elang; + pola lokasi, peta, izin perangkat
```

### Aturan Kepemilikan

Aturan 1–8 v2.2 tetap berlaku, dengan pemilik baru di atas. Tambahan:

9. **`react-native-maps` hanya di `features/lab/**`**, `expo-location` dan `expo-notifications` hanya di `services/`. Komponen `components/**` menerima data lokasi lewat props.
10. **`functions/` di-deploy hanya oleh Dhimas** (`firebase deploy --only functions`), sama seperti rules.
11. Perubahan `types` dan kontrak store untuk lab, lokasi, dan notifikasi diumumkan sebelum merge dan disetujui PM (P-03).

### Dampak pada Kode Sprint 2

| Kode Sprint 2 | Perubahan |
| --- | --- |
| `Session.ruang` (teks) | Sesi baru memakai `labId`; tampilan memakai nama lab; `ruang` hanya untuk sesi lama |
| `SessionForm` / `sessionFormValidation.ts` | Input ruang diganti pilihan lab dari `useLabs()` |
| `submitAttendance(sessionId, code)` | Tanda tangan tetap; store menyertakan posisi dan bukti lokasi; `AttendFailReason` bertambah |
| Form presensi di `praktikan/sesi/[id]` | Dipindah ke halaman presensi |
| `PraktikanTabBar` | Tombol aksi bulat membuka halaman presensi; tab Peta ditambah |
| `firestore.rules` | `attendances` `hasOnly` diperluas; `changedOnly` sesi Dibuka memakai `labId`; koleksi baru |
| `logout()` | Juga menghapus token perangkat dan menghentikan watch posisi |

## 11. Pembagian Tugas

Elang adalah Project Manager Sprint 3 dan tidak menulis kode fitur. Pengembangnya dua orang: **Dhimas** (fondasi native, data, lokasi, notifikasi, server) dan **Ibrahim** (UI kit, halaman presensi, sisi asisten, peta). Strategi tetap **kontrak lebih dulu**: Dhimas me-merge tanda tangan store/hook dengan implementasi sementara agar Ibrahim dapat membangun layar tanpa menunggu rebuild dan Firebase.

### 11.1 Peran

| Orang | Peran | Bertanggung jawab atas | Tidak mengerjakan |
| --- | --- | --- | --- |
| Elang | Project Manager | Lingkup dan prioritas, SRS, issue, konfirmasi ke asisten praktikum, koordinasi Blaze dan identitas aplikasi, persetujuan PR kontrak, review dan merge PR, uji integrasi, sign-off demo, form awal dan akhir | Menulis kode fitur, mengedit file developer |
| Dhimas | Developer: native + data + server | Konfigurasi dan rebuild, `types`, store, `services/`, Cloud Functions, rules, sisi praktikan yang sudah ada, README | `components/**`, `theme/`, `features/lab|presensi|asisten`, `asisten/**` |
| Ibrahim | Developer: UI + presensi + asisten + peta | Komponen dan tema, halaman presensi, peta dan panel info lab, kelola lab, form sesi dengan lab, rekap, `DESIGN.md` | `services/`, `store/`, `types/`, rules, `functions/`, konfigurasi native |

### 11.2 Tugas Elang (PM)

| ID | Tugas | Kapan | Hasil |
| --- | --- | --- | --- |
| P-01 | Mengonfirmasi ke asisten praktikum: notifikasi lewat Cloud Functions + FCM, peta Google, marker = posisi perangkat sendiri, QR sebagai Could | Sesi pertama | Konfirmasi dicatat di 1.5 |
| P-02 | Memastikan **Blaze + budget alert** aktif (dilakukan Dhimas sebagai owner) dan menyepakati `package` baru | Sebelum D-01 | Billing aktif; nama `package` final |
| P-03 | Menyetujui PR kontrak: D-02 dan setiap perubahan `types`, tanda tangan store/hook, struktur Firestore, rules, atau Functions | Fase 0 dan seterusnya | PR kontrak disetujui |
| P-04 | Menyusun daftar nama lab Informatika untuk data awal | Fase 0 | Data awal lab |
| P-05 | Membuat issue per tugas, memantau progres harian, memutuskan penundaan Should/Could | Sepanjang sprint | Papan tugas, catatan di SRS |
| P-06 | Review dan merge PR setelah 1 approval rekan; menjaga aturan proses (bagian 12) | Sepanjang sprint | Riwayat PR rapi |
| P-07 | Checklist uji dari bagian 9 dan 6.5; memimpin gladi Fase 2; sign-off demo | Fase 2 | Checklist, daftar bug, sign-off |
| P-08 | Memperbarui `docs/SRS.md`, form awal dan form akhir | Sepanjang sprint | SRS final, form terisi |

### 11.3 Tugas Dhimas

| ID | Tugas | FR / NFR | File utama | Bergantung pada | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| D-01 | **Konfigurasi native + rebuild**: `package` baru, `userInterfaceStyle: "light"`, patch Expo, `expo-location`, `react-native-maps`, `expo-notifications` + config plugin, daftarkan app Android di Firebase (`google-services.json`), aktifkan Maps SDK for Android, API key terbatas lewat env, rebuild dev build, bagikan APK | 1.4, NFR-17 | `app.json`, `eas.json`, `package.json`, `google-services.json` | P-02 | APK baru terpasang di HP semua anggota; peta kosong tampil; izin lokasi dan notifikasi bisa diminta |
| D-02 | Kontrak `types`, konstanta lokasi, tanda tangan store/hook (3.5) dengan implementasi sementara (data dummy lab, posisi dummy) | Bagian 3 | `types/`, `constants/location.ts`, `store/**` | n/a | PR disetujui PM; Ibrahim mulai I-03 dst. |
| D-03 | Service dan store **lab** (listen, CRUD, cek dipakai, nama unik), `labId` di sesi, data awal lab | FR-40, FR-43, FR-04, FR-18 (data) | `services/labs.ts`, `services/sessions.ts`, `store/**`, `scripts/` | D-02 | Lab tersinkron realtime; hapus lab dipakai ditolak |
| D-04 | Service dan store **lokasi**: izin, layanan mati, timeout, akurasi, `mocked`, buka pengaturan, aktifkan layanan, watch, `distanceM` | FR-35, FR-56–58, NFR-13, NFR-18 | `services/location.ts`, `store/**` | D-01, D-02 | Semua `LocationStatus` dapat dipicu dan teruji di HP |
| D-05 | **Presensi berbasis lokasi** di store/service: pra-cek diperluas, bukti lokasi, pesan alasan; detail sesi praktikan diubah (tombol ke halaman presensi, nama lab) | FR-07, FR-34, FR-35, FR-38, FR-03 | `services/attendance.ts`, `store/**`, `praktikan/sesi/[id]`, `features/praktikan/**` | D-03, D-04 | Presensi berhasil di dalam radius, ditolak di luar radius |
| D-06 | **Registrasi perangkat**: izin notifikasi, token, simpan/hapus di `devices`, handler notifikasi masuk dan diketuk di root layout | FR-50, FR-52, FR-53, FR-59 | `services/notifications.ts`, `store/**`, `app/_layout.tsx` | D-01 | Token tersimpan; notifikasi uji dari Console tampil dan navigasi benar |
| D-07 | **Cloud Functions** N1–N4 (+ N5 Could), pembersihan token tidak valid, region sesuai Firestore, deploy | FR-51, FR-54, FR-55, NFR-14 | `functions/**` | D-06, P-02 | Tiga peristiwa demo memicu notifikasi ke penerima yang benar |
| D-08 | **Rules** koleksi baru + perubahan sesi/presensi, uji 14 kasus di emulator, deploy | FR-31, 6.5 | `firestore.rules` | D-03, D-05 | 14 kasus lulus dan tercatat (uji emulator: Should bila waktu habis, minimal Rules Playground) |
| D-09 | `PraktikanTabBar`: tab Peta + tombol aksi bulat ke halaman presensi dengan penanda sesi Dibuka | 8 | `praktikan/(tabs)/_layout.tsx`, `features/praktikan/PraktikanTabBar` | I-01 | Navigasi praktikan sesuai bagian 8 |
| D-10 | README: `docs/README.md` diubah dari panduan per orang menjadi panduan setup proyek (Firebase Blaze, FCM, Maps key, Functions, emulator, hasil uji rules, akun seed); bagian basi dibersihkan (`KeluarButton`, env AI, Expo Go, switch peran di README root) | n/a | `docs/README.md`, `README.md` | Semua tugas Dhimas | Anggota baru dapat menjalankan proyek dari nol |

Urutan Dhimas: D-01 (jalur kritis), D-02, lalu D-03, D-04, D-06 paralel; D-05 setelah D-03 dan D-04; D-07 setelah D-06; D-08, D-09; D-10 terakhir.

### 11.4 Tugas Ibrahim

| ID | Tugas | FR / NFR | File utama | Bergantung pada | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| I-01 | Stub komponen baru dengan **props final**: `LocationStatusCard` (status, jarak, radius, akurasi, aksi), `PermissionPrompt` (judul, penjelasan, aksi utama/sekunder), `LabInfoSheet` (lab, sesi berlangsung, sesi berikutnya, onPilihSesi), `RadiusField` | NFR-02, NFR-16 | `components/**` | n/a | Dhimas dapat memakainya tanpa menunggu |
| I-02 | Finalisasi komponen: semua `LocationStatus`, aksesibilitas, responsif | FR-36, FR-56–58, NFR-16 | `components/**`, `theme/**` | I-01 | Benar di 360dp, tablet, landscape |
| I-03 | **Halaman presensi**: daftar sesi hari ini, info lokasi, form kode, sheet konfirmasi, pesan alasan | FR-32, FR-33, FR-36, FR-37 | `praktikan/presensi.tsx`, `features/presensi/**` | D-02; D-04/D-05 untuk data nyata | Alur 1 langkah 2–7 lolos |
| I-04 | **Kelola lab** (asisten): daftar, form dengan peta, "Pakai lokasi saya", geser marker, lingkaran radius, hapus dengan konfirmasi | FR-40, FR-41, FR-43 | `asisten/lab/**`, `features/lab/LabForm`, `labValidation.ts` | D-02; D-03 | Lab tersimpan dan tampil di peta |
| I-05 | **Form sesi dengan pilihan lab** dan ubah lab saat Dibuka | FR-04, FR-18 | `asisten/buat`, `features/asisten/SessionForm`, `sessionFormValidation.ts` | D-02; D-03 | Sesi baru wajib lab; ubah lab memicu N4 |
| I-06 | **Peta lab** (asisten dan praktikan): marker, posisi sendiri, "Ke posisiku", "Lihat semua lab", panel info lab realtime, pengganti web | FR-44, FR-46–48 | `features/lab/LabMap`, `LabMarker`, `praktikan/(tabs)/peta`, `asisten/peta` | D-02; D-03, D-04 | Alur 2 lolos |
| I-07 | Beranda asisten: pintasan Lab dan Peta; rekap dengan jarak presensi (+ peta kecil, Could) | FR-39, FR-49 | `asisten/index`, `asisten/sesi/[id]`, `features/asisten/RekapList` | D-05 | Rekap menampilkan jarak |
| I-08 | Memperbarui `DESIGN.md`: pola status lokasi, permission prompt, peta, panel info lab; merapikan sisa token | n/a | `DESIGN.md` | I-02 | Panduan terdokumentasi |

Urutan Ibrahim: I-01, I-02, lalu I-03, I-04, I-05, I-06, I-07; I-08 terakhir.

### 11.5 Serah-terima antara Dhimas dan Ibrahim

| Serah-terima | Dari | Ke | Dibutuhkan sebelum |
| --- | --- | --- | --- |
| APK development build baru (D-01) | Dhimas | Ibrahim, Elang | Uji peta, lokasi, notifikasi di HP |
| Kontrak `types` dan store/hook (D-02) | Dhimas | Ibrahim | I-03 s.d. I-07 dimulai |
| Props final komponen (I-01) | Ibrahim | Dhimas | D-05, D-09 |
| Service lab aktif (D-03) | Dhimas | Ibrahim | Uji I-04, I-05, I-06 dengan data nyata |
| Service lokasi + presensi aktif (D-04, D-05) | Dhimas | Ibrahim | Uji I-03 dengan data nyata |
| Functions aktif (D-07) | Dhimas | Elang | Gladi Alur 1 dan 3 |

Aturan kerja: tugas selesai bila PR di-merge, `npx tsc --noEmit` lolos, diuji pemiliknya di HP (development build baru) atau web, dan disetujui satu reviewer.

### 11.6 Fase dan Jadwal

| Fase | Waktu | Isi |
| --- | --- | --- |
| Fase 0: Kontrak dan rebuild | Rabu–Kamis | P-01, P-02, D-01, D-02, I-01 |
| Fase 1: Paralel | Kamis–Senin | D-03 s.d. D-09, I-02 s.d. I-07 |
| Fase 2: Integrasi | Selasa | Gladi tiga alur di dua HP, skenario tepi, uji rules, cross review, perbaikan bug, I-08, D-10 |
| Demo | Rabu | Presentasi ke asisten praktikum |

**Jalur kritis:** P-02 → D-01 (rebuild) → semua uji di HP. Bila D-01 terlambat, Ibrahim tetap membangun UI dengan data sementara dan web; D-01 adalah prioritas pertama Dhimas.

### 11.7 Fase 2: Integrasi dan Hardening

| Kegiatan | Pemimpin | Peserta |
| --- | --- | --- |
| Gladi Alur 1 dan 3 (HP asisten dan HP praktikan) | Elang | Dhimas, Ibrahim |
| Gladi Alur 2, peran HP ditukar | Elang | Dhimas, Ibrahim |
| Skenario tepi lokasi dan notifikasi | Dhimas | Ibrahim menguji, Elang mencatat |
| Uji rules 14 kasus | Dhimas | Ibrahim mereview |
| Cek responsif, landscape, aksesibilitas peta | Ibrahim | Dhimas |
| Cross code review | Dhimas mereview PR Ibrahim, Ibrahim mereview PR Dhimas | Elang merge |
| Perbaikan bug | Pemilik file | Elang memantau |
| Sign-off, rekaman demo, SRS final, README | Elang | Ibrahim menyiapkan tangkapan layar, Dhimas melengkapi README |

## 12. Alur Git dan Konfigurasi

- `main` diproteksi: wajib PR + **1 approval**, berlaku juga untuk admin, tanpa push langsung dan tanpa force push. Proteksi tidak boleh dimatikan.
- Branch otomatis dihapus setelah PR di-merge. PR bertumpuk tetap **draft** dan base-nya dipindah ke `main` sebelum di-merge.
- Branch: `feat/dhimas-<topik>`, `feat/ibrahim-<topik>`, `chore/...`, `fix/...`. Satu tugas (D-xx/I-xx) = satu PR.
- Commit **head-body**: `feat: ...` / `fix: ...` / `chore: ...` / `docs: ...` huruf kecil, **tanpa scope dalam kurung**, tanpa titik, body menjelaskan kenapa. Tanpa trailer `Co-Authored-By`.
- Aturan AI agent v2.2 tetap (boleh commit dan push ke branch fitur sampai PR draft, atribusi dimatikan, tidak boleh push ke `main` atau merge).
- **Rahasia:** `.env` tidak di-commit; API key Maps lewat env; service account Firebase tidak pernah masuk repo; `npm audit fix` tidak dijalankan tanpa PR khusus.
- **Development build:** Sprint 3 menambah native module dan mengganti `package`. Rebuild dilakukan Dhimas di D-01 dan APK dibagikan ke semua anggota; build lama tidak dipakai lagi.

## 13. Definition of Done

- Alur 1, 2, dan 3 berjalan penuh di dua HP Android dengan Firebase sungguhan.
- Seluruh kebutuhan **Must** (FR-32 s.d. FR-59 dan FR v2.2 yang diubah) terpenuhi; status Should/Could dicatat; NFR-13 s.d. NFR-18 terpenuhi.
- Rules baru di-deploy; 14 kasus uji tercatat.
- Skenario tepi bagian 9 tertangani.
- Tidak ada `console.error`, tidak ada `any`, tidak ada warna langsung di luar `src/theme`, `npx tsc --noEmit` lolos.
- Tidak ada rahasia di repo; budget alert aktif; API key Maps dibatasi.
- Semua perubahan lewat PR yang direview; tidak ada push langsung ke `main`.
- `docs/SRS.md`, `docs/README.md`, dan `DESIGN.md` diperbarui. PM memberi sign-off setelah gladi bersama.

## 14. Risiko dan Catatan

| Risiko | Mitigasi |
| --- | --- |
| Akun billing tidak dapat dipasang (Blaze gagal) | Rencana cadangan: notifikasi dikirim dari aplikasi asisten lewat Expo Push Service (kelemahan keamanan dan keandalan dicatat di README); peta memakai MapLibre + tile OpenStreetMap dengan atribusi. PM memutuskan paling lambat Kamis |
| Rebuild (D-01) terlambat atau gagal | Prioritas pertama Dhimas; Ibrahim bekerja dengan data sementara dan web |
| GPS dalam ruangan tidak akurat | Radius 50 m, batas akurasi 50 m, lab demo diatur di ruang demo, tombol "Perbarui lokasi" |
| Lokasi dipalsukan | Deteksi `mocked`, kode sesi, bukti lokasi di rekap, rules memvalidasi bukti; risiko sisa dicatat (6.4) |
| Notifikasi lambat atau tidak muncul saat demo | Uji sehari sebelum demo; izin notifikasi dan pengecualian hemat baterai diperiksa; sumber kebenaran tetap data di aplikasi |
| API key Maps disalahgunakan | Kunci dibatasi `package` + SHA-1, tidak di-commit, budget alert |
| Beban Dhimas terlalu berat (native + data + server) | Tugas UI dipusatkan ke Ibrahim; D-08 uji emulator dan FR-54/55 boleh digeser; PM memantau harian |
| Peralihan kepemilikan file Elang ke Ibrahim | Elang menjelaskan struktur UI kit dan sisi asisten di awal sprint; `DESIGN.md` menjadi acuan |
| Konflik merge pada `types`, `store`, rules, Functions | Pemilik tunggal Dhimas; perubahan kontrak diumumkan dan disetujui PM |
| Sesi lama tanpa `labId` | Tampil "Lab belum diatur"; presensi ditolak `NO_LAB`; asisten dapat memilih lab lewat ubah sesi |

## 15. Riwayat Perubahan

| Versi | Perubahan |
| --- | --- |
| 1.0–1.3 | Sprint 1 (lihat SRS v1.3) |
| 2.0–2.2 | Sprint 2 (lihat SRS v2.2) |
| 3.0 | **Sprint 3.** PM Elang; developer Dhimas dan Ibrahim; file milik Elang berpindah ke Ibrahim. Paket Blaze, Cloud Functions + FCM untuk notifikasi berbasis peristiwa (N1–N5), `expo-notifications`, `react-native-maps` (Google), `expo-location` foreground. Halaman presensi khusus, presensi berbasis lokasi dengan bukti lokasi, koleksi `labs` dan pengelolaannya, sesi merujuk `labId`, peta lab dengan posisi perangkat sendiri dan panel aktivitas lab, penanganan izin dan kondisi perangkat. Menambah FR-32 s.d. FR-59, NFR-13 s.d. NFR-18, 5 kasus uji rules, tiga alur demo, struktur file dan tugas P-/D-/I- baru, rencana cadangan bila billing gagal |
