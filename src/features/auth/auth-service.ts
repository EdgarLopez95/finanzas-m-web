import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import type { AuthUser, FirestoreUser } from "@/features/auth/types";
import { getFirebaseAuth, getFirebaseDb, getGoogleProvider, isFirebaseConfigured } from "@/lib/firebase/client";

const mapAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email ?? "",
  displayName: user.displayName ?? "Usuario Finanzas M",
  photoUrl: user.photoURL,
});

const ensureFirestoreUser = async (user: User): Promise<void> => {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    return;
  }

  const payload: FirestoreUser = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "Usuario Finanzas M",
    photoUrl: user.photoURL,
    createdAt: serverTimestamp(),
    defaultCurrency: "COP",
    activeHouseholdId: null,
  };

  await setDoc(userRef, payload, { merge: true });
};

export const signInWithGoogle = async (): Promise<AuthUser> => {
  if (!isFirebaseConfigured()) {
    throw new Error("Configura .env.local con NEXT_PUBLIC_FIREBASE_* antes de iniciar sesion.");
  }

  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, getGoogleProvider());
  await ensureFirestoreUser(result.user);
  return mapAuthUser(result.user);
};

export const signOutUser = async (): Promise<void> => {
  if (!isFirebaseConfigured()) {
    return;
  }

  await signOut(getFirebaseAuth());
};

export const onAuthState = (callback: (user: AuthUser | null) => void) => {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }

  const auth = getFirebaseAuth();

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    await ensureFirestoreUser(user);
    callback(mapAuthUser(user));
  });
};

export const forceGoogleAccountSelection = () => {
  if (!isFirebaseConfigured()) {
    return;
  }

  getGoogleProvider().setCustomParameters({ prompt: "select_account" });
};
