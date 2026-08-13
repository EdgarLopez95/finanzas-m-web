/**
 * Harness de pruebas E2E de R1 (cancelación atómica Android<->Rules) contra el Firebase
 * Local Emulator Suite.
 *
 * Prueba que sustituir get() por getAfter() en las transiciones de household_event_shares /
 * household_debts que validan el status del evento padre (household_events) es compatible con
 * AMBOS patrones de escritura:
 *   1. Patrón secuencial Android: cancelar el evento como escritura Firestore independiente,
 *      y despues (en una escritura Firestore separada) cascadear el status de una share/deuda.
 *   2. Patrón atómico Web: cancelar el evento Y cascadear shares/deudas en la MISMA
 *      transacción/batch, via el servicio real cancelHouseholdEvent().
 * Y que sigue RECHAZANDO:
 *   3. Cascadear una share/deuda a "cancelled" cuando el evento padre NO se cancela (ni antes
 *      ni en la misma operación) — sigue "active".
 *   4. Escrituras de un usuario que no es miembro del hogar (isMember gate).
 *
 * H1.5a (añadido): el escenario 2 tambien prueba que las LECTURAS de cancelHouseholdEvent() ya
 * no fallan por permisos (antes de H1.5a, la consulta de shares/deudas solo por eventId sin
 * householdId era rechazada por Rules en la fase de lectura, antes de llegar siquiera a la
 * transacción — ver docs/11_WEB_DEV_LOG.md, entrada "H1.5a"). El escenario 5 prueba que cancelar
 * un evento no afecta shares/deudas de OTRO evento del mismo hogar (aislamiento del filtro en
 * memoria por eventId tras consultar por householdId).
 *
 * No toca produccion. No modifica android/firestore.rules (fuente canonica) ni despliega Rules;
 * solo ejercita la copia local tests/emulator/firestore.rules cargada por el emulador.
 *
 * Como correrlo (requiere Java/JDK instalado):
 *   npm run test:emulator:r1
 *
 * Modo smoke (sin emulador, solo valida que los modulos resuelven/cargan):
 *   HARNESS_IMPORT_CHECK=1 npx tsx tests/emulator/run-r1-atomic-cancel.ts
 */

import "./firebase-emulator-environment";

import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
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

const expectThrows = async (label: string, includes: RegExp, fn: () => Promise<unknown>) => {
  try {
    await fn();
    bad(`${label} (no lanzo error)`);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (includes.test(m)) ok(label);
    else bad(`${label} (lanzo, pero mensaje inesperado)`, err);
  }
};

async function main() {
  const { getFirebaseDb, getFirebaseAuth } = await import("@/lib/firebase/client");

  if (process.env.HARNESS_IMPORT_CHECK === "1") {
    await import("@/features/household/services/cancel-household-event");
    console.log("Import/resolve OK: todos los modulos de servicio cargan en Node.");
    return;
  }

  const { cancelHouseholdEvent } = await import(
    "@/features/household/services/cancel-household-event"
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

  const emailIntruder = `intruso+${Date.now()}@test.dev`;
  await signOut(auth);
  await createUserWithEmailAndPassword(auth, emailIntruder, "password123");

  // Volver a A para el seed (owner del hogar)
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, "password123");

  console.log(`\nUsuarios de prueba: A=${uidA}  B=${uidB}`);

  // ---- Seed: hogar de 2 miembros ----
  const HH = "hh-r1";
  await setDoc(doc(db, "households", HH), {
    ownerId: uidA,
    memberIds: [uidA, uidB],
    status: "active",
    name: "Casa R1",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "users", uidA), { activeHouseholdId: HH, displayName: "A", updatedAt: serverTimestamp() });

  // La Rule de users/{userId} exige isOwner(userId): cada quien solo puede escribir su propio
  // doc. Cambiar de sesion a B para sembrar users/{uidB}, y volver a A para el resto del seed.
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailB, "password123");
  await setDoc(doc(db, "users", uidB), { activeHouseholdId: HH, displayName: "B", updatedAt: serverTimestamp() });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, "password123");
  ok("Seed de hogar de 2 miembros completado");

  const seedEvent = async (eventId: string, paidByUserId: string) => {
    await setDoc(doc(db, "household_events", eventId), {
      householdId: HH,
      createdByUserId: uidA,
      paidByUserId,
      settlementMode: "advancedByPayer",
      sourceTransactionId: null,
      householdCategoryId: "cat-r1",
      title: `Evento ${eventId}`,
      description: null,
      eventDate: serverTimestamp(),
      totalAmount: 100000,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const seedShare = async (shareId: string, eventId: string, memberUserId: string, status: string) => {
    await setDoc(doc(db, "household_event_shares", shareId), {
      eventId,
      householdId: HH,
      memberUserId,
      responsibilityAmount: 50000,
      status,
      completedAt: null,
      completedByTransactionId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const seedDebt = async (debtId: string, eventId: string, fromUserId: string, toUserId: string, status: string) => {
    await setDoc(doc(db, "household_debts", debtId), {
      householdId: HH,
      eventId,
      fromUserId,
      toUserId,
      amount: 50000,
      status,
      outgoingTransactionId: null,
      incomingTransactionId: null,
      paymentDeclaredAt: null,
      paidAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  // ================= ESCENARIO 1: patrón Android secuencial =================
  console.log("\n[1] Patron Android: cancelar evento y DESPUES, en una escritura separada, cascadear la share");
  {
    const EVT = "evt-r1-seq";
    const SHARE = "share-r1-seq";
    await seedEvent(EVT, uidA);
    await seedShare(SHARE, EVT, uidB, "pending_completion");

    // Paso 1: cancelar el evento como escritura Firestore INDEPENDIENTE (branch D).
    await expectResolves("paso 1: cancelar evento (escritura independiente)", () =>
      setDoc(doc(db, "household_events", EVT), { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true })
    );

    // Paso 2: DESPUES, en otra escritura Firestore independiente, cascadear la share.
    // getAfter() sobre un doc que no forma parte de ESTA escritura debe comportarse igual que
    // get(): lee el status ya comprometido en el paso 1 ("cancelled").
    await expectResolves("paso 2: cascadear share a cancelled (escritura independiente posterior)", () =>
      setDoc(doc(db, "household_event_shares", SHARE), { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true })
    );

    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE));
    assert(shareSnap.data()?.status === "cancelled", "share terminó en status cancelled");
  }

  // ================= ESCENARIO 2: patrón Web atómico =================
  console.log("\n[2] Patron Web: cancelHouseholdEvent() cancela evento + share pending_completion + deuda pending EN LA MISMA transacción");
  {
    const EVT = "evt-r1-atomic";
    const SHARE = "share-r1-atomic";
    const DEBT = "debt-r1-atomic";
    await seedEvent(EVT, uidA);
    await seedShare(SHARE, EVT, uidB, "pending_completion");
    await seedDebt(DEBT, EVT, uidB, uidA, "pending");

    // H1.5a: antes de este fix, cancelHouseholdEvent() nunca llegaba a la transacción — fallaba
    // en su PRIMERA lectura (getDocs por eventId, sin householdId) con
    // "Property householdId is undefined on object. for 'list'" antes de escribir nada. Aquí se
    // confirma explícitamente que la promesa resuelve limpio, sin ningún error de permisos ni de
    // evaluación de Rules en la fase de lectura.
    let scenario2Error: unknown = null;
    try {
      await cancelHouseholdEvent({ eventId: EVT });
    } catch (err) {
      scenario2Error = err;
    }
    assert(scenario2Error === null, "cancelHouseholdEvent() atomico NO lanza error (ni de lectura ni de escritura)");
    if (scenario2Error) {
      const msg = scenario2Error instanceof Error ? scenario2Error.message : String(scenario2Error);
      assert(!/permission|insufficient|denied|undefined on object|for 'list'/i.test(msg), "el error (si lo hubo) NO es de permisos/lectura por lista");
    }

    const eventSnap = await getDoc(doc(db, "household_events", EVT));
    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE));
    const debtSnap = await getDoc(doc(db, "household_debts", DEBT));
    assert(eventSnap.data()?.status === "cancelled", "evento terminó cancelled");
    assert(shareSnap.data()?.status === "cancelled", "share pending_completion terminó cancelled (misma transacción)");
    assert(debtSnap.data()?.status === "cancelled", "deuda pending terminó cancelled (misma transacción)");
  }

  // ================= ESCENARIO 5: aislamiento entre eventos del mismo hogar (H1.5a) =================
  console.log("\n[5] Aislamiento: cancelar un evento NO debe tocar shares/deudas de otro evento del mismo hogar");
  {
    const EVT_X = "evt-r1-iso-x"; // se cancela
    const EVT_Y = "evt-r1-iso-y"; // hermano en el mismo hogar, debe permanecer intacto
    const SHARE_X = "share-r1-iso-x";
    const DEBT_X = "debt-r1-iso-x";
    const SHARE_Y = "share-r1-iso-y";
    const DEBT_Y = "debt-r1-iso-y";

    await seedEvent(EVT_X, uidA);
    await seedShare(SHARE_X, EVT_X, uidB, "pending_completion");
    await seedDebt(DEBT_X, EVT_X, uidB, uidA, "pending");

    await seedEvent(EVT_Y, uidB);
    await seedShare(SHARE_Y, EVT_Y, uidA, "pending_completion");
    await seedDebt(DEBT_Y, EVT_Y, uidA, uidB, "pending");

    await expectResolves("cancelHouseholdEvent(EVT_X) resuelve sin tocar EVT_Y", () =>
      cancelHouseholdEvent({ eventId: EVT_X })
    );

    const eventXSnap = await getDoc(doc(db, "household_events", EVT_X));
    const shareXSnap = await getDoc(doc(db, "household_event_shares", SHARE_X));
    const debtXSnap = await getDoc(doc(db, "household_debts", DEBT_X));
    assert(eventXSnap.data()?.status === "cancelled", "EVT_X terminó cancelled");
    assert(shareXSnap.data()?.status === "cancelled", "share de EVT_X terminó cancelled");
    assert(debtXSnap.data()?.status === "cancelled", "deuda de EVT_X terminó cancelled");

    const eventYSnap = await getDoc(doc(db, "household_events", EVT_Y));
    const shareYSnap = await getDoc(doc(db, "household_event_shares", SHARE_Y));
    const debtYSnap = await getDoc(doc(db, "household_debts", DEBT_Y));
    assert(eventYSnap.data()?.status === "active", "EVT_Y (hermano, mismo hogar) sigue active, no se tocó");
    assert(shareYSnap.data()?.status === "pending_completion", "share de EVT_Y sigue pending_completion, no se tocó");
    assert(debtYSnap.data()?.status === "pending", "deuda de EVT_Y sigue pending, no se tocó");
  }

  // ================= ESCENARIO 3: rechazo con evento activo =================
  console.log("\n[3] Rechazo: cascadear share/deuda a cancelled dejando el evento activo (ni antes ni en la misma operación)");
  {
    const EVT = "evt-r1-noclose";
    const SHARE = "share-r1-noclose";
    const DEBT = "debt-r1-noclose";
    await seedEvent(EVT, uidA); // permanece "active" durante todo el escenario
    await seedShare(SHARE, EVT, uidB, "pending_completion");
    await seedDebt(DEBT, EVT, uidB, uidA, "pending");

    await expectThrows(
      "cascadear share a cancelled con evento activo denegado",
      /permission|insufficient|denied|false for/i,
      () => setDoc(doc(db, "household_event_shares", SHARE), { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true })
    );
    await expectThrows(
      "cascadear deuda a cancelled con evento activo denegado",
      /permission|insufficient|denied|false for/i,
      () => setDoc(doc(db, "household_debts", DEBT), { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true })
    );

    const shareSnap = await getDoc(doc(db, "household_event_shares", SHARE));
    const debtSnap = await getDoc(doc(db, "household_debts", DEBT));
    assert(shareSnap.data()?.status === "pending_completion", "share NO cambió (sigue pending_completion)");
    assert(debtSnap.data()?.status === "pending", "deuda NO cambió (sigue pending)");
  }

  // ================= ESCENARIO 4: rechazo de usuario no autorizado =================
  console.log("\n[4] Rechazo: usuario que no es miembro del hogar no puede cancelar el evento ni cascadear shares/deudas");
  {
    const EVT = "evt-r1-intruder";
    const SHARE = "share-r1-intruder";
    await seedEvent(EVT, uidA);
    await seedShare(SHARE, EVT, uidB, "pending_completion");

    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailIntruder, "password123");

    await expectThrows(
      "intruso cancelando el evento denegado",
      /permission|insufficient|denied|false for/i,
      () => setDoc(doc(db, "household_events", EVT), { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true })
    );
    await expectThrows(
      "intruso cascadeando la share denegado",
      /permission|insufficient|denied|false for/i,
      () => setDoc(doc(db, "household_event_shares", SHARE), { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true })
    );

    // Volver al owner por limpieza
    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailA, "password123");

    const eventSnap = await getDoc(doc(db, "household_events", EVT));
    assert(eventSnap.data()?.status === "active", "evento NO cambió (sigue active, el intruso no pudo escribir)");
  }

  await terminate(db).catch(() => undefined);
}

main()
  .then(() => {
    console.log(`\n=================  RESULTADO R1  =================`);
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
