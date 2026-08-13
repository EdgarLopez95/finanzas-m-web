process.env.NEXT_PUBLIC_FIREBASE_RUNTIME = "EMULATOR";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
  "demo-finanzas-m-plus.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-finanzas-m-plus";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
  "demo-finanzas-m-plus.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "demo-sender";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "demo-finanzas-m-plus-web";

(globalThis as unknown as { window: unknown }).window = globalThis;
