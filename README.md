<p align="center">
  <img src="assets/branding/rawuh-animated-logo.svg" alt="Rawuh - Sistem Presensi Praktikum" width="100%">
</p>

<p align="center">
  <a href="https://docs.expo.dev/"><img src="https://img.shields.io/badge/Expo-SDK_57-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 57" /></a>
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React_Native-0.86-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React Native 0.86" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Strict_Typed-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript Strict" /></a>
  <a href="https://zustand-demo.pmnd.rs/"><img src="https://img.shields.io/badge/State-Zustand_5-443e38?style=flat-square" alt="Zustand 5" /></a>
</p>

---

## Tentang Rawuh

**Rawuh** adalah aplikasi mobile untuk mencatat kehadiran sesi praktikum, dibangun dengan React Native dan Expo SDK 57. Ada dua peran: **asisten lab** yang mengelola sesi, lab, dan izin, dan **praktikan** yang melakukan presensi dengan kode sesi 4 digit di dalam radius lab. Data tersinkron realtime lewat Firebase (Authentication dan Cloud Firestore, paket Spark). Tampilan mengikuti sistem desain "Kartu Mahasiswa" di [DESIGN.md](./DESIGN.md).

Demo dan kriteria penerimaan berjalan di **Android**. Dukungan iOS lewat LiveContainer bersifat **eksperimental**.

---

## Fitur per Sprint

### Sprint 1: Fondasi
- Dua peran dengan alur presensi dasar dan data contoh di memori.
- Sesi praktikum (Dijadwalkan, Dibuka, Ditutup), kode 4 digit, jadwal dan riwayat presensi, rekap kehadiran.

### Sprint 2: Data dan Izin
- Akun Firebase (masuk, daftar, keluar) dan data Firestore realtime dengan *security rules* deny-by-default.
- Pengajuan izin praktikan dengan pemeriksaan berbantuan **model sentimen EDOM lokal** (berjalan di perangkat), keputusan akhir di tangan asisten.
- Kelola kelas praktikum, rekap dengan kelompok izin, penanganan offline dan timeout.

### Sprint 3: Lokasi, Peta, dan Notifikasi
- **Presensi berbasis lokasi:** halaman presensi khusus; presensi hanya berhasil saat sesi Dibuka dan perangkat berada di dalam radius lab, dengan bukti lokasi tersimpan.
- **Kelola lab** (asisten): nama, koordinat ("Pakai lokasi saya" atau ketuk peta), radius; sesi memilih lab.
- **Peta lab** dengan MapLibre dan OpenFreeMap: marker lab, posisi sendiri, panel aktivitas lab realtime (di web diganti daftar lab).
- **Push notification** lewat Expo Push Service: sesi dibuka, jadwal baru, jadwal berubah, keputusan izin, dan perubahan lokasi praktikum.
- Penanganan izin dan kondisi perangkat: izin lokasi ditolak, GPS mati, lokasi palsu, akurasi buruk, offline.
- **Eksperimental (pasca-batas):** iOS lewat LiveContainer dengan notifikasi relay Bark.

Daftar kebutuhan, status akhir, dan utang teknis ada di [docs/SRS.md](./docs/SRS.md).

---

## Memulai

Aplikasi memakai modul native, jadi **tidak dapat dijalankan di Expo Go**; gunakan *development build* Android.

```bash
npm ci
cp .env.example .env     # isi variabel EXPO_PUBLIC_FIREBASE_* (nilai dari pemegang akun Firebase)
npx expo start
```

Langkah lengkap (prasyarat, development build vs preview, masalah jaringan, notifikasi uji, rules, seed data) ada di **[docs/README.md](./docs/README.md)**.

Perintah pemeriksaan kualitas:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
```

---

## Struktur Direktori

```text
rawuh/
├── assets/                   # Aset visual dan logo (branding/)
├── scripts/                  # Seed data Firebase, setup EAS secrets, build iOS (eksperimental)
├── src/
│   ├── app/                  # Expo Router: (auth)/, asisten/, praktikan/ dan _layout.tsx
│   ├── components/           # Komponen UI berbasis props (ui/, izin/, location/, session/)
│   ├── config/               # Konfigurasi runtime dan environment
│   ├── constants/            # Konstanta lokasi (radius, akurasi, timeout)
│   ├── data/                 # Data dummy untuk mode tanpa Firebase
│   ├── features/             # Modul per fitur: asisten, auth, lab, praktikan, presensi
│   ├── services/             # Lapisan data: Firestore, lokasi, notifikasi, push, AI lokal
│   ├── store/                # State global Zustand dan sinkronisasi realtime
│   ├── theme/                # Token desain (warna, tipografi, spasi)
│   ├── types/                # Tipe domain
│   └── utils/                # Utilitas umum
├── docs/                     # SRS, panduan setup, ADR, arsip SRS versi lama
├── firestore.rules           # Aturan keamanan Cloud Firestore
├── firestore.indexes.json    # Definisi index Firestore
├── eas.json                  # Profil build EAS (development, preview, sideload, production)
├── DESIGN.md                 # Sistem desain dan pola antarmuka
├── GLOSSARY.md               # Istilah proyek
└── IOS_LIVECONTAINER_GUIDE.md # Panduan iOS eksperimental (LiveContainer dan Bark)
```

---

## Dokumen Penting

| Dokumen | Isi |
| :--- | :--- |
| [docs/SRS.md](./docs/SRS.md) | Kebutuhan perangkat lunak Sprint 3 (v3.3): lingkup, model data, kebutuhan, rules, status akhir, utang teknis |
| [docs/README.md](./docs/README.md) | Panduan setup proyek dan pengujian rules |
| [DESIGN.md](./DESIGN.md) | Sistem desain, komponen, dan pola lokasi, peta, izin perangkat |
| [IOS_LIVECONTAINER_GUIDE.md](./IOS_LIVECONTAINER_GUIDE.md) | Pemasangan iOS lewat LiveContainer dan notifikasi Bark (eksperimental) |
| [docs/arsip/](./docs/arsip/) | SRS Sprint 1 dan 2 |
