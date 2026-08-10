/**
 * Harness de pruebas E2E de H1.6b/H1.6c (cascada de borrado de cuenta/bolsillo: cancelación de
 * eventos + reversión/cascada de shares y deudas) contra el Firebase Local Emulator Suite.
 *
 * Ejecuta el SERVICIO REAL deleteAccountCascade() contra Firestore + Auth emulados, con las
 * Rules reales (getAfter(), R1b) cargadas desde tests/emulator/firestore.rules. No toca
 * produccion, no hace deploy.
 *
 * Cubre, en un solo escenario compuesto para reflejar cómo interactúan entre sí dentro de la
 * MISMA transacción atómica:
 *   1. Evento ya cancelado antes de la cascada creado por el OWNER A (creado active y cancelado
 *      vía updateDoc previo a la cascada) — no entra a linkedEventsToCancel (evita re-cancelación
 *      cancelled -> cancelled rechazada por Rules) y su share completada vinculada revierte a "cancelled".
 *   2. Evento activo que la propia cascada cancela (creado por el owner, con una transacción
 *      relatedEventId siendo borrada) — status efectivo "cancelled", no el status pre-transacción.
 *   3. Esa misma transacción TAMBIÉN completó una share del evento (mismo caso 2): debe
 *      actualizarse una sola vez (limpiar vínculo + quedar "cancelled"), nunca dos escrituras.
 *   4. Share pending_completion y deuda pending del evento cancelado (derivadas) -> cancelled.
 *   5. Aislamiento: un evento hermano del mismo hogar, sin transacción vinculada al borrado,
 *      permanece intacto (activo, con su share pending_completion sin tocar).
 *
 * Como correrlo (requiere Java/JDK instalado):
 *   npm run test:emulator:h16b
 *
 * Modo smoke (sin emulador, solo valida que los modulos resuelven/cargan):
 *   HARNESS_IMPORT_CHECK=1 npx tsx tests/emulator/run-h16b-cascade-cancel.ts
 */

import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  terminate,
  type Firestore,
} from "firebase/firestore";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";

// --- Shims: el cliente real exige "browser" + config NEXT_PUBLIC_* ---
(globalThis as unknown as { window: unknown }).window = globalThis;
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||= "demo-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||= "demo-finanzas-m.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||= "demo-finanzas-m";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||= "demo-app-id";

let passed = 0;
let failed = 0;
const failures: string[] = [];

const ok = (label: string) => {
  passed += 1;
  console.log(`  ✓ ${label}`);
};
const bad = (label: string, detail?: unknown) => {
  failed += 1;
  const msg = detail instanceof Error ? detail.message : detail ? String(detail) : "";
  failures.push(`${label}${msg ? ` :: ${msg}` : ""}`);
  console.log(`  ✗ ${label}${msg ? ` :: ${msg}` : ""}`);
};

const assert = (cond: boolean, label: string) => (cond ? ok(label) : bad(label));

const expectResolves = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    ok(label);
  } catch (err) {
    bad(label, err);
  }
};

async function main() {
  const { getFirebaseDb, getFirebaseAuth } = await import("@/lib/firebase/client");

  if (process.env.HARNESS_IMPORT_CHECK === "1") {
    await import("@/features/accounts/services/delete-personal-entity-cascade");
    console.log("Import/resolve OK: todos los modulos de servicio cargan en Node.");
    return;
  }

  const { deleteAccountCascade } = await import(
    "@/features/accounts/services/delete-personal-entity-cascade"
  );

  // ---- Conectar a emuladores ----
  const fsHostRaw = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [fsHost, fsPort] = fsHostRaw.split(":");
  const authHostRaw = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

  const auth: Auth = getFirebaseAuth();
  connectAuthEmulator(auth, `http://${authHostRaw}`, { disableWarnings: true });
  const db: Firestore = getFirebaseDb();
  connectFirestoreEmulator(db, fsHost, Number(fsPort));

  // ---- Usuarios de prueba ----
  const emailA = `felipe.a+${Date.now()}@test.dev`;
  const credA = await createUserWithEmailAndPassword(auth, emailA, "password123");
  const uidA = credA.user.uid;

  const emailB = `felipe.b+${Date.now()}@test.dev`;
  await signOut(auth);
  const credB = await createUserWithEmailAndPassword(auth, emailB, "password123");
  const uidB = credB.user.uid;

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, "password123");
  console.log(`\nUsuarios de prueba: A=${uidA} (dueño de la cuenta a borrar)  B=${uidB}`);

  // ---- Seed: hogar de 2 miembros, cuenta de A ----
  const HH = "hh-h16b";
  const ACC_A = "acc-h16b-a";

  await setDoc(doc(db, "households", HH), {
    ownerId: uidA,
    memberIds: [uidA, uidB],
    status: "active",
    name: "Casa H16b",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "users", uidA), { activeHouseholdId: HH, displayName: "A", updatedAt: serverTimestamp() });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailB, "password123");
  await setDoc(doc(db, "users", uidB), { activeHouseholdId: HH, displayName: "B", updatedAt: serverTimestamp() });

  // Autenticarse como A (owner del evento y de la cuenta a borrar)
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, "password123");

  // EVT_CANCELLED: creado por A como active, y luego cancelado vía updateDoc previo a la cascada.
  // Respeta Security Rules (create exige createdByUserId == uidA y status == active, update admite active -> cancelled).
  // Con el filtro status === "active" de linkedEventsToCancel, no re-escribe cancelled -> cancelled.
  const EVT_CANCELLED = "evt-h16b-cancelled";
  await setDoc(doc(db, "household_events", EVT_CANCELLED), {
    householdId: HH,
    createdByUserId: uidA,
    paidByUserId: uidB,
    settlementMode: "advancedByPayer",
    sourceTransactionId: null,
    householdCategoryId: "cat-h16b",
    title: "Evento ya cancelado por owner",
    description: null,
    eventDate: serverTimestamp(),
    totalAmount: 1000,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "household_events", EVT_CANCELLED), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "accounts", ACC_A), {
    ownerId: uidA,
    name: "Cuenta H16b",
    currentBalance: 1_000_000,
    createdAt: serverTimestamp(),
  });

  // EVT_ACTIVE_TO_CANCEL: creado por A, activo. Una transacción de A con relatedEventId lo
  // apunta -> la cascada lo agrega a linkedEventsToCancel y lo cancela en esta misma operación.
  const EVT_ACTIVE_TO_CANCEL = "evt-h16b-active";
  await setDoc(doc(db, "household_events", EVT_ACTIVE_TO_CANCEL), {
    householdId: HH,
    createdByUserId: uidA,
    paidByUserId: uidA,
    settlementMode: "advancedByPayer",
    sourceTransactionId: null,
    householdCategoryId: "cat-h16b",
    title: "Evento activo a cancelar",
    description: null,
    eventDate: serverTimestamp(),
    totalAmount: 2000,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // EVT_SIBLING: creado por A también, pero SIN transacción relacionada siendo borrada ->
  // nunca entra a linkedEventsToCancel. Control de aislamiento.
  const EVT_SIBLING = "evt-h16b-sibling";
  await setDoc(doc(db, "household_events", EVT_SIBLING), {
    householdId: HH,
    createdByUserId: uidA,
    paidByUserId: uidA,
    settlementMode: "advancedByPayer",
    sourceTransactionId: null,
    householdCategoryId: "cat-h16b",
    title: "Evento hermano intacto",
    description: null,
    eventDate: serverTimestamp(),
    totalAmount: 500,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Transacciones de A en ACC_A (se borrarán con la cuenta).
  const TX_CANCELLED_LINK = doc(collection(db, "transactions")).id;
  await setDoc(doc(db, "transactions", TX_CANCELLED_LINK), {
    ownerId: uidA,
    type: "expense",
    amount: 1000,
    accountId: ACC_A,
    pocketId: null,
    targetAccountId: null,
    targetPocketId: null,
    categoryId: "cat-h16b",
    date: serverTimestamp(),
    description: "Cuota de evento ya cancelado",
    createdAt: serverTimestamp(),
    source: "manual",
    status: "confirmed",
    isHousehold: false,
    householdId: null,
    relatedEventId: EVT_CANCELLED,
    relatedDebtId: null,
  });

  const TX_ORIGIN = doc(collection(db, "transactions")).id;
  await setDoc(doc(db, "transactions", TX_ORIGIN), {
    ownerId: uidA,
    type: "expense",
    amount: 2000,
    accountId: ACC_A,
    pocketId: null,
    targetAccountId: null,
    targetPocketId: null,
    categoryId: "cat-h16b",
    date: serverTimestamp(),
    description: "Cuota que origina y completa el evento activo",
    createdAt: serverTimestamp(),
    source: "manual",
    status: "confirmed",
    isHousehold: false,
    householdId: null,
    relatedEventId: EVT_ACTIVE_TO_CANCEL,
    relatedDebtId: null,
  });

  // Shares y deudas.
  const SHARE_CANCELLED = "share-h16b-cancelled"; // completed, evento YA cancelado antes
  await setDoc(doc(db, "household_event_shares", SHARE_CANCELLED), {
    eventId: EVT_CANCELLED,
    householdId: HH,
    memberUserId: uidA,
    responsibilityAmount: 1000,
    status: "completed",
    completedAt: serverTimestamp(),
    completedByTransactionId: TX_CANCELLED_LINK,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const SHARE_COMPLETED_SAMEOP = "share-h16b-completed-sameop"; // completed, evento se cancela EN esta misma cascada
  await setDoc(doc(db, "household_event_shares", SHARE_COMPLETED_SAMEOP), {
    eventId: EVT_ACTIVE_TO_CANCEL,
    householdId: HH,
    memberUserId: uidA,
    responsibilityAmount: 2000,
    status: "completed",
    completedAt: serverTimestamp(),
    completedByTransactionId: TX_ORIGIN,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const SHARE_PENDING_DERIVATIVE = "share-h16b-pending-derivative"; // pending_completion, cascada por evento cancelado
  await setDoc(doc(db, "household_event_shares", SHARE_PENDING_DERIVATIVE), {
    eventId: EVT_ACTIVE_TO_CANCEL,
    householdId: HH,
    memberUserId: uidB,
    responsibilityAmount: 500,
    status: "pending_completion",
    completedAt: null,
    completedByTransactionId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const DEBT_PENDING_DERIVATIVE = "debt-h16b-pending-derivative"; // pending, cascada por evento cancelado
  await setDoc(doc(db, "household_debts", DEBT_PENDING_DERIVATIVE), {
    householdId: HH,
    eventId: EVT_ACTIVE_TO_CANCEL,
    fromUserId: uidB,
    toUserId: uidA,
    amount: 300,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const SHARE_SIBLING = "share-h16b-sibling"; // del evento hermano, debe quedar intacta
  await setDoc(doc(db, "household_event_shares", SHARE_SIBLING), {
    eventId: EVT_SIBLING,
    householdId: HH,
    memberUserId: uidB,
    responsibilityAmount: 500,
    status: "pending_completion",
    completedAt: null,
    completedByTransactionId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  ok("Seed completo: 3 eventos, 4 shares, 1 deuda, 2 transacciones, 1 cuenta");

  // ================= Ejecutar la cascada real =================
  console.log("\n[H1.6b/H1.6c] deleteAccountCascade(ACC_A) — cancela EVT_ACTIVE_TO_CANCEL y revierte/cascada todo lo vinculado");
  await expectResolves("deleteAccountCascade() resuelve sin error", () =>
    deleteAccountCascade({ ownerId: uidA, accountId: ACC_A })
  );

  // ---- Caso 1: evento ya cancelado antes de la cascada por el owner ----
  {
    const eventSnap = await getDoc(doc(db, "household_events", EVT_CANCELLED));
    assert(eventSnap.data()?.status === "cancelled", "[caso 1] evento ya cancelado por el owner conserva status cancelled sin re-escritura");

    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE_CANCELLED));
    assert(shareSnap.data()?.status === "cancelled", "[caso 1] share de evento YA cancelado revierte a cancelled");
    assert(shareSnap.data()?.completedByTransactionId === null, "[caso 1] vínculo completedByTransactionId limpiado");
  }

  // ---- Caso 2 + 3: evento activo cancelado en la misma cascada; su share completada por la
  // MISMA transacción que originó la cancelación se actualiza una sola vez ----
  {
    const eventSnap = await getDoc(doc(db, "household_events", EVT_ACTIVE_TO_CANCEL));
    assert(eventSnap.data()?.status === "cancelled", "[caso 2] evento activo terminó cancelled (cascada propia)");

    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE_COMPLETED_SAMEOP));
    assert(shareSnap.data()?.status === "cancelled", "[caso 3] share completada por la tx que originó la cancelación termina cancelled (status EFECTIVO, no pre-transacción)");
    assert(shareSnap.data()?.completedByTransactionId === null, "[caso 3] vínculo limpiado en la única escritura");
  }

  // ---- Caso 4: derivadas del evento cancelado ----
  {
    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE_PENDING_DERIVATIVE));
    assert(shareSnap.data()?.status === "cancelled", "[caso 4] share pending_completion derivada -> cancelled");

    const debtSnap = await getDoc(doc(db, "household_debts", DEBT_PENDING_DERIVATIVE));
    assert(debtSnap.data()?.status === "cancelled", "[caso 4] deuda pending derivada -> cancelled");
  }

  // ---- Caso 5: aislamiento del evento hermano ----
  {
    const eventSnap = await getDoc(doc(db, "household_events", EVT_SIBLING));
    assert(eventSnap.data()?.status === "active", "[caso 5] evento hermano sigue active, no se tocó");

    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE_SIBLING));
    assert(shareSnap.data()?.status === "pending_completion", "[caso 5] share del evento hermano sin tocar");
  }

  await terminate(db).catch(() => undefined);
}

main()
  .then(() => {
    console.log(`\n=================  RESULTADO H1.6b/H1.6c  =================`);
    console.log(`PASS: ${passed}   FAIL: ${failed}`);
    if (failed > 0) {
      console.log(`\nFallos:`);
      for (const f of failures) console.log(`  - ${f}`);
    }
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("\nError fatal en el harness:", err);
    process.exit(1);
  });
