/**
 * Harness de pruebas E2E de H2.1 (Cancelación individual de cuota pendiente cancelPendingShare)
 * contra el Firebase Local Emulator Suite.
 *
 * Ejecuta el SERVICIO REAL cancelPendingShare() contra Firestore + Auth emulados,
 * utilizando las Security Rules canónicas de tests/emulator/firestore.rules.
 *
 * Escenarios probados:
 *   1. Dueño de la share (A) + Evento activo: cancelPendingShare() PERMITIDO por Rules.
 *   2. Aislamiento verificado: evento padre sigue 'active' y share de B sigue 'pending_completion'.
 *   3. Otro miembro (B): intenta cancelar una share de A (pending_completion) -> RECHAZADO por Rules (PERMISSION_DENIED).
 *   4. Intento de modificar campos inmutables (ej. responsibilityAmount) al cancelar -> RECHAZADO por Rules.
 *   5. Dueño de la share (B) + Evento activo: cancelPendingShare() PERMITIDO por Rules.
 *   6. Cascada de cancelación de evento: cancelar el evento completo actualiza shares pendientes -> PERMITIDO.
 *
 * Como correrlo:
 *   npm run test:emulator:h21
 */

import "./firebase-emulator-environment";

import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";

let passed = 0;
let failed = 0;
const failures: string[] = [];

const ok = (label: string) => {
  passed += 1;
  console.log(`  ✓ ${label}`);
};

const fail = (label: string, err: unknown) => {
  failed += 1;
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`  ✗ ${label}\n    ${msg}`);
  failures.push(`${label}: ${msg}`);
};

if (process.env.HARNESS_IMPORT_CHECK === "1") {
  console.log("Harness H2.1: import check ok.");
  process.exit(0);
}

let getFirebaseDbModule: typeof import("@/lib/firebase/client");
let getFirebaseAuthModule: typeof import("@/lib/firebase/client");
let cancelPendingShareService: typeof import("@/features/household/services/cancel-pending-share");
let cancelHouseholdEventService: typeof import("@/features/household/services/cancel-household-event");

async function setupAndRunH21EmulatorTests() {
  console.log("=================================================");
  console.log("Harness E2E H2.1 — cancelPendingShare (Firestore Emulator)");
  console.log("=================================================\n");

  getFirebaseDbModule = await import("@/lib/firebase/client");
  getFirebaseAuthModule = await import("@/lib/firebase/client");
  cancelPendingShareService = await import("@/features/household/services/cancel-pending-share");
  cancelHouseholdEventService = await import("@/features/household/services/cancel-household-event");

  const db: Firestore = getFirebaseDbModule.getFirebaseDb();
  const auth: Auth = getFirebaseAuthModule.getFirebaseAuth();

  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

  const emailA = `test-h21-user-a-${Date.now()}@example.com`;
  const emailB = `test-h21-user-b-${Date.now()}@example.com`;
  const pass = "Password123!";

  // 1. Crear usuarios A y B
  const userACred = await createUserWithEmailAndPassword(auth, emailA, pass).catch(async () =>
    signInWithEmailAndPassword(auth, emailA, pass)
  );
  const uidA = userACred.user.uid;

  await signOut(auth);

  const userBCred = await createUserWithEmailAndPassword(auth, emailB, pass).catch(async () =>
    signInWithEmailAndPassword(auth, emailB, pass)
  );
  const uidB = userBCred.user.uid;

  // Sembrar user doc de B
  await setDoc(doc(db, "users", uidB), {
    email: emailB,
    displayName: "Usuario B",
    activeHouseholdId: null,
    createdAt: serverTimestamp(),
  });

  // Autenticar como A y sembrar user doc de A
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, pass);
  await getDoc(doc(db, "users", uidA));

  const hhId = `hh_h21_${Date.now()}`;
  const now = new Date();

  await setDoc(doc(db, "users", uidA), {
    email: emailA,
    displayName: "Usuario A",
    activeHouseholdId: hhId,
    createdAt: serverTimestamp(),
  });

  // Sembrar Hogar
  await setDoc(doc(db, "households", hhId), {
    name: "Hogar H2.1 Test",
    ownerId: uidA,
    memberIds: [uidA, uidB],
    memberCount: 2,
    inviteCode: "INVH2100",
    inviteCodeExpiresAt: null,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Actualizar activeHouseholdId en User B
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailB, pass);
  await getDoc(doc(db, "users", uidB));
  await setDoc(doc(db, "users", uidB), {
    email: emailB,
    displayName: "Usuario B",
    activeHouseholdId: hhId,
    createdAt: serverTimestamp(),
  });

  // Autenticar como A para crear evento y shares
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, pass);
  await getDoc(doc(db, "users", uidA));

  const evtId = `evt_h21_${Date.now()}`;
  const shareIdA = `${evtId}_${uidA}`;
  const shareIdB = `${evtId}_${uidB}`;
  const shareIdA_test3 = `${evtId}_test3_${uidA}`;

  await setDoc(doc(db, "household_events", evtId), {
    householdId: hhId,
    title: "Gasto Salida H2.1",
    totalAmount: 300,
    householdCategoryId: "cat_general",
    createdByUserId: uidA,
    paidByUserId: uidA,
    settlementMode: "eachPaysOwn",
    status: "active",
    description: "",
    sourceTransactionId: null,
    eventDate: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "household_event_shares", shareIdA), {
    householdId: hhId,
    eventId: evtId,
    memberUserId: uidA,
    responsibilityAmount: 100,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "household_event_shares", shareIdB), {
    householdId: hhId,
    eventId: evtId,
    memberUserId: uidB,
    responsibilityAmount: 100,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "household_event_shares", shareIdA_test3), {
    householdId: hhId,
    eventId: evtId,
    memberUserId: uidA,
    responsibilityAmount: 100,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // -----------------------------------------------------------------
  // ESCENARIO 1: Dueño de la share (A) cancela su propia share con evento activo
  // -----------------------------------------------------------------
  try {
    await cancelPendingShareService.cancelPendingShare({
      shareId: shareIdA,
      currentUid: uidA,
    });

    const shareASnap = await getDoc(doc(db, "household_event_shares", shareIdA));
    if (shareASnap.data()?.status === "cancelled") {
      ok("Escenario 1: Dueño (A) canceló exitosamente su share pendiente con evento activo");
    } else {
      fail("Escenario 1", `Estado esperado 'cancelled', recibido '${shareASnap.data()?.status}'`);
    }
  } catch (err) {
    fail("Escenario 1: Dueño (A) debió poder cancelar su share", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 2: Aislamiento — comprobar que evento y share de B permanecen intactos
  // -----------------------------------------------------------------
  try {
    const evtSnap = await getDoc(doc(db, "household_events", evtId));
    const shareBSnap = await getDoc(doc(db, "household_event_shares", shareIdB));

    if (evtSnap.data()?.status === "active" && shareBSnap.data()?.status === "pending_completion") {
      ok("Escenario 2: Aislamiento verificado — Evento sigue 'active' y share de B sigue 'pending_completion'");
    } else {
      fail("Escenario 2", `Evento status: ${evtSnap.data()?.status}, Share B status: ${shareBSnap.data()?.status}`);
    }
  } catch (err) {
    fail("Escenario 2: Verificación de aislamiento falló", err);
  }

  // -----------------------------------------------------------------
  // Autenticar como Usuario B para escenarios 3, 4 y 5
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailB, pass);
  await getDoc(doc(db, "users", uidB));

  // -----------------------------------------------------------------
  // ESCENARIO 3: Usuario B intenta cancelar la share (shareIdA_test3) que pertenece a A
  // -----------------------------------------------------------------
  try {
    await updateDoc(doc(db, "household_event_shares", shareIdA_test3), {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
    fail("Escenario 3a", "Usuario B no debió modificar la share de Usuario A");
  } catch (err) {
    const msg = String(err);
    if (msg.includes("PERMISSION_DENIED") || msg.includes("permission-denied")) {
      ok("Escenario 3a: Rules rechazaron con PERMISSION_DENIED a Usuario B intentando modificar la share de Usuario A");
    } else {
      fail("Escenario 3a", err);
    }
  }

  // -----------------------------------------------------------------
  // ESCENARIO 4: Usuario B intenta cancelar shareIdB alterando responsabilidad inmutable
  // -----------------------------------------------------------------
  const shareIdB_invalid = `${evtId}_invalid_${uidB}`;
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, pass);
  await getDoc(doc(db, "users", uidA));

  await setDoc(doc(db, "household_event_shares", shareIdB_invalid), {
    householdId: hhId,
    eventId: evtId,
    memberUserId: uidB,
    responsibilityAmount: 100,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailB, pass);
  await getDoc(doc(db, "users", uidB));

  try {
    await updateDoc(doc(db, "household_event_shares", shareIdB_invalid), {
      status: "cancelled",
      responsibilityAmount: 50, // Campo inmutable alterado
      updatedAt: serverTimestamp(),
    });
    fail("Escenario 4", "Intento de modificar responsabilidad inmutable debió ser rechazado por Rules");
  } catch (err) {
    const msg = String(err);
    if (msg.includes("PERMISSION_DENIED") || msg.includes("permission-denied")) {
      ok("Escenario 4: Rules rechazaron modificación de campo inmutable (responsibilityAmount) al cancelar");
    } else {
      fail("Escenario 4", err);
    }
  }

  // -----------------------------------------------------------------
  // ESCENARIO 5: Usuario B cancela legalmente su propia share (shareIdB)
  // -----------------------------------------------------------------
  try {
    await cancelPendingShareService.cancelPendingShare({
      shareId: shareIdB,
      currentUid: uidB,
    });

    const shareBSnap = await getDoc(doc(db, "household_event_shares", shareIdB));
    if (shareBSnap.data()?.status === "cancelled") {
      ok("Escenario 5: Dueño (B) canceló exitosamente su propia share pendiente con evento activo");
    } else {
      fail("Escenario 5", `Estado esperado 'cancelled', recibido '${shareBSnap.data()?.status}'`);
    }
  } catch (err) {
    fail("Escenario 5: Dueño (B) debió poder cancelar su propia share", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 6: Cascada al cancelar el evento sigue funcionando normalmente
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, pass);
  await getDoc(doc(db, "users", uidA));

  const evtId2 = `evt_h21_cascade_${Date.now()}`;
  const shareIdA2 = `${evtId2}_${uidA}`;

  await setDoc(doc(db, "household_events", evtId2), {
    householdId: hhId,
    title: "Gasto Cascada H2.1",
    totalAmount: 100,
    householdCategoryId: "cat_general",
    createdByUserId: uidA,
    paidByUserId: uidA,
    settlementMode: "invitation",
    status: "active",
    description: "",
    sourceTransactionId: null,
    eventDate: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "household_event_shares", shareIdA2), {
    householdId: hhId,
    eventId: evtId2,
    memberUserId: uidA,
    responsibilityAmount: 100,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await cancelHouseholdEventService.cancelHouseholdEvent({ eventId: evtId2 });
    const shareA2Snap = await getDoc(doc(db, "household_event_shares", shareIdA2));
    if (shareA2Snap.data()?.status === "cancelled") {
      ok("Escenario 6: Cascada al cancelar evento padre actualizó share a 'cancelled' como se esperaba");
    } else {
      fail("Escenario 6", `Estado de share2 esperado 'cancelled', recibido '${shareA2Snap.data()?.status}'`);
    }
  } catch (err) {
    fail("Escenario 6: Cascada de cancelación falló", err);
  }

  console.log("\n-------------------------------------------------");
  console.log(`Resultados H2.1: ${passed} pasadas, ${failed} falladas.`);
  if (failed > 0) {
    console.error("Fallos:\n" + failures.join("\n"));
    process.exit(1);
  } else {
    console.log("¡Todas las pruebas E2E H2.1 en emulador pasaron exitosamente!");
    process.exit(0);
  }
}

setupAndRunH21EmulatorTests().catch((err) => {
  console.error("Error no capturado en harness H2.1:", err);
  process.exit(1);
});
