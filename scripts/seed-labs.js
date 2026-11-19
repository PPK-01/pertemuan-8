const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} = require("firebase/firestore");

// Muat variabel environment dari .env di root jika ada
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const FIREBASE_ENV = {
  apiKey: "EXPO_PUBLIC_FIREBASE_API_KEY",
  authDomain: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "EXPO_PUBLIC_FIREBASE_APP_ID",
};

const missingFirebaseEnv = Object.values(FIREBASE_ENV).filter((name) => !process.env[name]);
if (missingFirebaseEnv.length > 0) {
  console.error("\n❌ [ERROR] Konfigurasi Firebase belum lengkap di environment!");
  console.error("Lengkapi variabel berikut di file .env (lihat .env.example):");
  for (const name of missingFirebaseEnv) {
    console.error(`  ${name}=`);
  }
  console.error("");
  process.exit(1);
}

const firebaseConfig = Object.fromEntries(
  Object.entries(FIREBASE_ENV).map(([key, name]) => [key, process.env[name]]),
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_PASSWORD = "password123";

// Daftar 5 Lab Informatika sesuai arahan PM Elang (SRS v3.2 §11.2 P-03)
const INITIAL_LABS = [
  {
    id: "lab-1",
    nama: "Lab Pemrograman Dasar",
    gedung: "Gedung A, lantai 1",
    lat: -7.770123,
    lng: 110.370123,
    radiusM: 50,
  },
  {
    id: "lab-2",
    nama: "Lab Rekayasa Perangkat Lunak",
    gedung: "Gedung A, lantai 2",
    lat: -7.770456,
    lng: 110.370456,
    radiusM: 50,
  },
  {
    id: "lab-3",
    nama: "Lab Basis Data",
    gedung: "Gedung A, lantai 2",
    lat: -7.770789,
    lng: 110.370789,
    radiusM: 50,
  },
  {
    id: "lab-4",
    nama: "Lab Jaringan Komputer",
    gedung: "Gedung B, lantai 1",
    lat: -7.771112,
    lng: 110.371112,
    radiusM: 50,
  },
  {
    id: "lab-5",
    nama: "Lab Kecerdasan Buatan",
    gedung: "Gedung B, lantai 3",
    lat: -7.775,
    lng: 110.375,
    radiusM: 50,
  },
];

async function seedLabs() {
  console.log("=== SEEDING INITIAL LABS RAWUH ===");

  console.log("\n✓ Login sebagai Asisten Dina untuk membuat dokumen Lab...");
  const dinaUser = await signInWithEmailAndPassword(auth, "dina@rawuh.ac.id", DEFAULT_PASSWORD);

  for (const lab of INITIAL_LABS) {
    const labRef = doc(db, "labs", lab.id);
    const snap = await getDoc(labRef);
    if (!snap.exists()) {
      await setDoc(labRef, {
        nama: lab.nama,
        gedung: lab.gedung,
        lat: lab.lat,
        lng: lab.lng,
        radiusM: lab.radiusM,
        createdBy: dinaUser.user.uid,
        createdAt: serverTimestamp(),
        updatedBy: dinaUser.user.uid,
        updatedAt: serverTimestamp(),
      });
      console.log(`✓ Lab dibuat: ${lab.nama} (${lab.gedung}) - radius: ${lab.radiusM}m`);
    } else {
      console.log(`✓ Lab sudah ada: ${lab.nama}`);
    }
  }

  console.log("\n=== SEEDING LABS SELESAI DENGAN SUKSES! ===");
}

seedLabs().catch((err) => {
  console.error("Seeding labs gagal:", err);
  process.exit(1);
});
