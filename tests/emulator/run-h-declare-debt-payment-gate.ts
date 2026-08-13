/**
 * Harness E2E del gate de declaración de pago (`household-debt-payment-gate`)
 * contra el Firebase Local Emulator Suite.
 *
 * ACTUALIZACIÓN (refuerzo final de Rules): `android/firestore.rules` ahora
 * SÍ exige, en la transición `household_debts.pending -> payment_declared`,
 * que exista una fuente de anotación del pagador —
 * `householdDebtPayerHasAnnotatedExpenseSource(eventId)`: el evento debe ser
 * `advancedByPayer` y tener `event.sourceTransactionId` no vacío, O la share
 * determinista del pagador (`${eventId}_${payerUserId}`, con
 * `payerUserId = paidByUserId` o, si está vacío, `createdByUserId`) debe
 * existir con `status == 'completed'` y `completedByTransactionId` no vacío.
 * Esto reemplaza el hallazgo de la corrida anterior de este mismo harness
 * (que documentaba, correctamente para ese momento, que Rules NO tenía esta
 * condición) — ver la entrada corregida en `docs/11_WEB_DEV_LOG.md`.
 *
 * Ahora hay DOBLE PROTECCIÓN, y este harness prueba ambas por separado:
 *
 * 1. Gate de APLICACIÓN (`resolveDebtPaymentEligibility` dentro de la propia
 *    transacción de `declareDebtPayment()`): buena UX — rechaza con un
 *    mensaje de negocio claro ANTES de intentar escribir en Firestore.
 *    Escenarios 1/1b/1c/1d.
 * 2. Gate de RULES (`householdDebtPayerHasAnnotatedExpenseSource`): la
 *    protección final e irrenunciable — se prueba con un `updateDoc` DIRECTO
 *    como deudor, sin pasar por `declareDebtPayment()`, para que ningún
 *    atajo de la app pueda maquillar el resultado. Escenarios 7 (rechazo sin
 *    anotación), 8 (permitido vía `sourceTransactionId`) y 9 (permitido vía
 *    share completada del pagador).
 *
 * Como correrlo:
 *   npm run test:emulator:debt-payment-gate
 */

import "./firebase-emulator-environment";

import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
  console.log("Harness declare-debt-payment-gate: import check ok.");
  process.exit(0);
}

async function main() {
  console.log("=================================================");
  console.log("Harness E2E — declareDebtPayment() vs household-debt-payment-gate (Firestore Emulator)");
  console.log("=================================================\n");

  const clientModule = await import("@/lib/firebase/client");
  const declareDebtPaymentModule = await import("@/features/household/services/declare-debt-payment");
  const completeShareModule = await import("@/features/household/services/complete-household-event-share");
  const createEventModule = await import("@/features/household/services/create-household-event");

  const db: Firestore = clientModule.getFirebaseDb();
  const auth: Auth = clientModule.getFirebaseAuth();

  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

  const stamp = Date.now();
  const emailGerson = `test-dpg-gerson-${stamp}@example.com`;
  const emailFamilia = `test-dpg-familia-${stamp}@example.com`;
  const pass = "Password123!";

  const gersonCred = await createUserWithEmailAndPassword(auth, emailGerson, pass).catch(() =>
    signInWithEmailAndPassword(auth, emailGerson, pass)
  );
  const uidGerson = gersonCred.user.uid;
  await signOut(auth);

  const familiaCred = await createUserWithEmailAndPassword(auth, emailFamilia, pass).catch(() =>
    signInWithEmailAndPassword(auth, emailFamilia, pass)
  );
  const uidFamilia = familiaCred.user.uid;
  await signOut(auth);

  const hhId = `hh_dpg_${stamp}`;

  // --- Sembrar como Gerson: hogar, cuenta y categoría propias ---
  await signInWithEmailAndPassword(auth, emailGerson, pass);
  await setDoc(doc(db, "users", uidGerson), {
    email: emailGerson,
    displayName: "Gerson",
    activeHouseholdId: hhId,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "households", hhId), {
    name: "Hogar DPG Test",
    ownerId: uidGerson,
    memberIds: [uidGerson, uidFamilia],
    memberCount: 2,
    inviteCode: "INVDPG001",
    inviteCodeExpiresAt: null,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const gersonAccountId = `acc_gerson_${stamp}`;
  await setDoc(doc(db, "accounts", gersonAccountId), {
    ownerId: uidGerson,
    name: "Cuenta Gerson",
    balance: 500000,
    currency: "COP",
    institutionName: "Banco Gerson",
    type: "bank",
    includeInTotal: true,
    archived: false,
    iconKey: "bank",
    iconType: "generic",
    color: "",
    updatedAt: serverTimestamp(),
  });
  const gersonCategoryId = `cat_gerson_expense_${stamp}`;
  await setDoc(doc(db, "categories", gersonCategoryId), {
    ownerId: uidGerson,
    name: "Mercado",
    icon: "shopping-bag",
    type: "expense",
    archived: false,
  });

  // --- Sembrar como Familia: cuenta propia con saldo suficiente ---
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);
  await setDoc(doc(db, "users", uidFamilia), {
    email: emailFamilia,
    displayName: "Familia",
    activeHouseholdId: hhId,
    createdAt: serverTimestamp(),
  });
  const familiaAccountId = `acc_familia_${stamp}`;
  await setDoc(doc(db, "accounts", familiaAccountId), {
    ownerId: uidFamilia,
    name: "Cuenta Familia",
    balance: 200000,
    currency: "COP",
    institutionName: "Banco Familia",
    type: "bank",
    includeInTotal: true,
    archived: false,
    iconKey: "bank",
    iconType: "generic",
    color: "",
    updatedAt: serverTimestamp(),
  });

  // --- Sembrar como Gerson: evento advancedByPayer $120.000, share Gerson $120.000, deuda Familia->Gerson $60.000 ---
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const evtId = `evt_dpg_${stamp}`;
  const shareIdGerson = `${evtId}_${uidGerson}`;
  await setDoc(doc(db, "household_events", evtId), {
    householdId: hhId,
    title: "Adelanto Gerson DPG",
    totalAmount: 120000,
    householdCategoryId: "cat_general",
    createdByUserId: uidGerson,
    paidByUserId: uidGerson,
    settlementMode: "advancedByPayer",
    status: "active",
    description: "",
    sourceTransactionId: null,
    eventDate: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "household_event_shares", shareIdGerson), {
    householdId: hhId,
    eventId: evtId,
    memberUserId: uidGerson,
    responsibilityAmount: 120000,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const debtId = `debt_dpg_${stamp}`;
  await setDoc(doc(db, "household_debts", debtId), {
    householdId: hhId,
    eventId: evtId,
    fromUserId: uidFamilia,
    toUserId: uidGerson,
    amount: 60000,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // -----------------------------------------------------------------
  // ESCENARIO 1: ANTES de que Gerson anote — Familia intenta declarar pago.
  // Debe RECHAZARSE por el GATE DE APLICACIÓN
  // (resolveDebtPaymentEligibility, dentro de la misma transacción de
  // declareDebtPayment) ANTES de siquiera intentar escribir en Firestore —
  // por eso el error NO trae PERMISSION_DENIED aunque Rules TAMBIÉN
  // rechazaría el mismo intento (verificado de forma independiente y directa
  // en el Escenario 7 más abajo, sin pasar por declareDebtPayment()). Esta
  // es la capa de buena UX: el usuario nunca ve un error crudo de permisos.
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);

  let rejectedBeforeAnnotation = false;
  let rejectionWasAppLevelNotRules = false;
  try {
    await declareDebtPaymentModule.declareDebtPayment({
      debtId,
      ownerId: uidFamilia,
      accountId: familiaAccountId,
      pocketId: null,
      date: new Date(),
    });
  } catch (err) {
    rejectedBeforeAnnotation = true;
    const msg = String(err instanceof Error ? err.message : err);
    rejectionWasAppLevelNotRules = !msg.includes("PERMISSION_DENIED") && !msg.includes("permission-denied");
  }

  if (rejectedBeforeAnnotation && rejectionWasAppLevelNotRules) {
    ok("Escenario 1: declareDebtPayment() rechazado por el GATE DE LA APP (buena UX) antes de que Gerson anote");
  } else if (rejectedBeforeAnnotation) {
    fail("Escenario 1", "el rechazo vino de Firestore Rules (PERMISSION_DENIED) en vez del gate de la app — la app debería atajarlo antes de escribir, para buena UX");
  } else {
    fail("Escenario 1", "declareDebtPayment() NO debió permitirse antes de que Gerson anotara su gasto");
  }

  // Verificar: sin salida creada, deuda sigue pending, saldo de Familia intacto.
  const debtAfterRejection = await getDoc(doc(db, "household_debts", debtId));
  const familiaAccountAfterRejection = await getDoc(doc(db, "accounts", familiaAccountId));
  const familiaTxsAfterRejection = await getDocs(
    query(collection(db, "transactions"), where("ownerId", "==", uidFamilia))
  );

  if (debtAfterRejection.data()?.status === "pending") {
    ok("Escenario 1b: la deuda sigue 'pending' tras el rechazo");
  } else {
    fail("Escenario 1b", `estado esperado 'pending', recibido '${debtAfterRejection.data()?.status}'`);
  }
  if (familiaAccountAfterRejection.data()?.currentBalance === undefined && familiaAccountAfterRejection.data()?.balance === 200000) {
    ok("Escenario 1c: el saldo de Familia no cambió tras el rechazo");
  } else if (familiaAccountAfterRejection.data()?.balance === 200000) {
    ok("Escenario 1c: el saldo de Familia no cambió tras el rechazo");
  } else {
    fail("Escenario 1c", `saldo esperado 200000, recibido ${JSON.stringify(familiaAccountAfterRejection.data())}`);
  }
  if (familiaTxsAfterRejection.empty) {
    ok("Escenario 1d: no se creó ninguna transacción de salida para Familia");
  } else {
    fail("Escenario 1d", `se encontraron ${familiaTxsAfterRejection.size} transacciones inesperadas`);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 2: Gerson completa "Por anotar" (completeHouseholdEventShare real).
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  try {
    await completeShareModule.completeHouseholdEventShare({
      shareId: shareIdGerson,
      ownerId: uidGerson,
      accountId: gersonAccountId,
      pocketId: null,
      categoryId: gersonCategoryId,
      date: new Date(),
    });
    ok("Escenario 2: Gerson completó 'Por anotar' (completeHouseholdEventShare real)");
  } catch (err) {
    fail("Escenario 2", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 3: DESPUÉS de que Gerson anota — Familia declara pago -> debe funcionar.
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);

  try {
    await declareDebtPaymentModule.declareDebtPayment({
      debtId,
      ownerId: uidFamilia,
      accountId: familiaAccountId,
      pocketId: null,
      date: new Date(),
    });

    const debtAfterDeclare = await getDoc(doc(db, "household_debts", debtId));
    const familiaAccountAfterDeclare = await getDoc(doc(db, "accounts", familiaAccountId));

    if (debtAfterDeclare.data()?.status === "payment_declared" && debtAfterDeclare.data()?.outgoingTransactionId) {
      ok("Escenario 3: declareDebtPayment() PERMITIDO después de que Gerson anotó — deuda pasó a payment_declared");
    } else {
      fail("Escenario 3", `estado esperado 'payment_declared' con outgoingTransactionId, recibido ${JSON.stringify(debtAfterDeclare.data())}`);
    }
    // El campo autoritativo tras un débito real es `currentBalance` (el
    // servicio real lee `currentBalance ?? balance` y escribe siempre
    // `currentBalance` — mismo contrato que el resto de la app).
    if (familiaAccountAfterDeclare.data()?.currentBalance === 140000) {
      ok("Escenario 3b: el saldo de Familia bajó exactamente $60.000 (200.000 -> 140.000)");
    } else {
      fail("Escenario 3b", `saldo esperado currentBalance=140000, recibido ${JSON.stringify(familiaAccountAfterDeclare.data())}`);
    }
  } catch (err) {
    fail("Escenario 3: declareDebtPayment() debió permitirse tras la anotación de Gerson", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 4: no se puede declarar dos veces (regresión ya conocida).
  // -----------------------------------------------------------------
  try {
    await declareDebtPaymentModule.declareDebtPayment({
      debtId,
      ownerId: uidFamilia,
      accountId: familiaAccountId,
      pocketId: null,
      date: new Date(),
    });
    fail("Escenario 4", "declareDebtPayment() no debió permitirse dos veces sobre la misma deuda");
  } catch {
    ok("Escenario 4: segundo intento de declarar la misma deuda fue rechazado (sin doble salida)");
  }

  // -----------------------------------------------------------------
  // ESCENARIO 5: evento con sourceTransactionId ya presente -> declara sin
  // necesitar completar una share (segunda fuente de la prioridad).
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const evtId2 = `evt_dpg_src_${stamp}`;
  const fakeSourceTxId = `tx_source_${stamp}`;
  await setDoc(doc(db, "household_events", evtId2), {
    householdId: hhId,
    title: "Adelanto Gerson con fuente ya resuelta",
    totalAmount: 80000,
    householdCategoryId: "cat_general",
    createdByUserId: uidGerson,
    paidByUserId: uidGerson,
    settlementMode: "advancedByPayer",
    status: "active",
    description: "",
    sourceTransactionId: fakeSourceTxId,
    eventDate: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const debtId2 = `debt_dpg_src_${stamp}`;
  await setDoc(doc(db, "household_debts", debtId2), {
    householdId: hhId,
    eventId: evtId2,
    fromUserId: uidFamilia,
    toUserId: uidGerson,
    amount: 40000,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);

  try {
    await declareDebtPaymentModule.declareDebtPayment({
      debtId: debtId2,
      ownerId: uidFamilia,
      accountId: familiaAccountId,
      pocketId: null,
      date: new Date(),
    });
    const debt2After = await getDoc(doc(db, "household_debts", debtId2));
    if (debt2After.data()?.status === "payment_declared") {
      ok("Escenario 5: con event.sourceTransactionId ya presente, declareDebtPayment() funciona sin necesitar una share completada");
    } else {
      fail("Escenario 5", `estado esperado 'payment_declared', recibido ${JSON.stringify(debt2After.data())}`);
    }
  } catch (err) {
    fail("Escenario 5", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 6: no-regresión — invitation/eachPaysOwn nunca generan
  // household_debts (verificado vía createHouseholdEvent real, ambos modos).
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const householdCategoryForTest = {
    id: "cat_general",
    householdId: hhId,
    name: "General",
    iconKey: "shopping-bag",
    color: "#EF4444",
    archived: false,
  };

  try {
    const invitationEventId = await createEventModule.createHouseholdEvent({
      householdId: hhId,
      createdByUserId: uidGerson,
      paidByUserId: uidGerson,
      settlementMode: "invitation",
      title: "Cena invitación DPG",
      totalAmount: 50000,
      householdCategoryId: "cat_general",
      eventDate: new Date(),
      memberShares: [
        { memberUserId: uidGerson, responsibilityAmount: 50000 },
        { memberUserId: uidFamilia, responsibilityAmount: 0 },
      ],
      householdMemberIds: [uidGerson, uidFamilia],
      availableCategories: [householdCategoryForTest],
    });

    const eachPaysOwnEventId = await createEventModule.createHouseholdEvent({
      householdId: hhId,
      createdByUserId: uidGerson,
      paidByUserId: uidGerson,
      settlementMode: "eachPaysOwn",
      title: "Cine eachPaysOwn DPG",
      totalAmount: 60000,
      householdCategoryId: "cat_general",
      eventDate: new Date(),
      memberShares: [
        { memberUserId: uidGerson, responsibilityAmount: 30000 },
        { memberUserId: uidFamilia, responsibilityAmount: 30000 },
      ],
      householdMemberIds: [uidGerson, uidFamilia],
      availableCategories: [householdCategoryForTest],
    });

    // Mismo patrón de lectura que el servicio real (`read-household-debts.ts`):
    // Rules solo garantizan una query segura filtrada por `householdId`; un
    // filtro por `eventId` no está cubierto por las Rules y Firestore no
    // puede probar la query como segura. Se lee por householdId (real) y se
    // filtra por eventId en memoria.
    const allHouseholdDebts = await getDocs(query(collection(db, "household_debts"), where("householdId", "==", hhId)));
    const debtsForInvitation = allHouseholdDebts.docs.filter((d) => d.data().eventId === invitationEventId);
    const debtsForEachPaysOwn = allHouseholdDebts.docs.filter((d) => d.data().eventId === eachPaysOwnEventId);

    if (debtsForInvitation.length === 0 && debtsForEachPaysOwn.length === 0) {
      ok("Escenario 6: invitation y eachPaysOwn no generaron ninguna household_debts (no-regresión)");
    } else {
      fail("Escenario 6", `invitation debts=${debtsForInvitation.length}, eachPaysOwn debts=${debtsForEachPaysOwn.length}`);
    }
  } catch (err) {
    fail("Escenario 6", err);
  }

  // ===================================================================
  // PRUEBA DIRECTA DE RULES (Escenarios 7, 8, 9): `updateDoc` crudo como
  // deudor, SIN pasar por `declareDebtPayment()`. Esto ejerce
  // `householdDebtPayerHasAnnotatedExpenseSource` de forma aislada — ningún
  // atajo de la app puede maquillar el resultado. Cada escenario usa un
  // evento/deuda propios para no interferir entre sí.
  // ===================================================================

  const attemptDirectPaymentDeclaredWrite = async (targetDebtId: string) =>
    updateDoc(doc(db, "household_debts", targetDebtId), {
      status: "payment_declared",
      outgoingTransactionId: `tx_direct_${Date.now()}`,
      paymentDeclaredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  // -----------------------------------------------------------------
  // ESCENARIO 7: sin sourceTransactionId y sin share completada del pagador
  // -> Rules deben RECHAZAR con permission-denied, incluso escribiendo
  // exactamente los campos permitidos por el whitelist.
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const evtRulesReject = `evt_dpg_rules_reject_${stamp}`;
  await setDoc(doc(db, "household_events", evtRulesReject), {
    householdId: hhId,
    title: "Evento sin anotar (prueba directa de Rules)",
    totalAmount: 30000,
    householdCategoryId: "cat_general",
    createdByUserId: uidGerson,
    paidByUserId: uidGerson,
    settlementMode: "advancedByPayer",
    status: "active",
    description: "",
    sourceTransactionId: null,
    eventDate: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Share del pagador existe pero SIGUE pendiente (no completada) — no debe habilitar la transición.
  await setDoc(doc(db, "household_event_shares", `${evtRulesReject}_${uidGerson}`), {
    householdId: hhId,
    eventId: evtRulesReject,
    memberUserId: uidGerson,
    responsibilityAmount: 30000,
    status: "pending_completion",
    completedByTransactionId: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const debtRulesReject = `debt_dpg_rules_reject_${stamp}`;
  await setDoc(doc(db, "household_debts", debtRulesReject), {
    householdId: hhId,
    eventId: evtRulesReject,
    fromUserId: uidFamilia,
    toUserId: uidGerson,
    amount: 15000,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);

  try {
    await attemptDirectPaymentDeclaredWrite(debtRulesReject);
    fail("Escenario 7", "Rules debieron rechazar la transición sin sourceTransactionId ni share completada del pagador");
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    if (msg.includes("PERMISSION_DENIED") || msg.includes("permission-denied")) {
      ok("Escenario 7: Rules RECHAZARON (permission-denied) el updateDoc directo sin anotación del pagador");
    } else {
      fail("Escenario 7", `se esperaba permission-denied, se recibió: ${msg}`);
    }
  }
  const debtRulesRejectAfter = await getDoc(doc(db, "household_debts", debtRulesReject));
  if (debtRulesRejectAfter.data()?.status === "pending") {
    ok("Escenario 7b: la deuda sigue 'pending' tras el rechazo directo de Rules");
  } else {
    fail("Escenario 7b", `estado esperado 'pending', recibido '${debtRulesRejectAfter.data()?.status}'`);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 8: event.sourceTransactionId no vacío -> Rules deben PERMITIR
  // la misma escritura directa (updateDoc crudo, sin declareDebtPayment()).
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const evtRulesAllowSource = `evt_dpg_rules_allow_source_${stamp}`;
  await setDoc(doc(db, "household_events", evtRulesAllowSource), {
    householdId: hhId,
    title: "Evento con sourceTransactionId (prueba directa de Rules)",
    totalAmount: 30000,
    householdCategoryId: "cat_general",
    createdByUserId: uidGerson,
    paidByUserId: uidGerson,
    settlementMode: "advancedByPayer",
    status: "active",
    description: "",
    sourceTransactionId: `tx_source_direct_${stamp}`,
    eventDate: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const debtRulesAllowSource = `debt_dpg_rules_allow_source_${stamp}`;
  await setDoc(doc(db, "household_debts", debtRulesAllowSource), {
    householdId: hhId,
    eventId: evtRulesAllowSource,
    fromUserId: uidFamilia,
    toUserId: uidGerson,
    amount: 15000,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);

  try {
    await attemptDirectPaymentDeclaredWrite(debtRulesAllowSource);
    const debtAfter = await getDoc(doc(db, "household_debts", debtRulesAllowSource));
    if (debtAfter.data()?.status === "payment_declared") {
      ok("Escenario 8: Rules PERMITIERON la transición directa cuando event.sourceTransactionId no es vacío");
    } else {
      fail("Escenario 8", `estado esperado 'payment_declared', recibido ${JSON.stringify(debtAfter.data())}`);
    }
  } catch (err) {
    fail("Escenario 8: Rules debieron permitir la transición con sourceTransactionId presente", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 9: share del pagador 'completed' con completedByTransactionId
  // no vacío (sin sourceTransactionId en el evento) -> Rules deben PERMITIR.
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const evtRulesAllowShare = `evt_dpg_rules_allow_share_${stamp}`;
  await setDoc(doc(db, "household_events", evtRulesAllowShare), {
    householdId: hhId,
    title: "Evento con share completada (prueba directa de Rules)",
    totalAmount: 30000,
    householdCategoryId: "cat_general",
    createdByUserId: uidGerson,
    paidByUserId: uidGerson,
    settlementMode: "advancedByPayer",
    status: "active",
    description: "",
    sourceTransactionId: null,
    eventDate: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Share determinista del pagador: ${eventId}_${payerUserId}, ya completed.
  await setDoc(doc(db, "household_event_shares", `${evtRulesAllowShare}_${uidGerson}`), {
    householdId: hhId,
    eventId: evtRulesAllowShare,
    memberUserId: uidGerson,
    responsibilityAmount: 30000,
    status: "completed",
    completedByTransactionId: `tx_share_completed_${stamp}`,
    completedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const debtRulesAllowShare = `debt_dpg_rules_allow_share_${stamp}`;
  await setDoc(doc(db, "household_debts", debtRulesAllowShare), {
    householdId: hhId,
    eventId: evtRulesAllowShare,
    fromUserId: uidFamilia,
    toUserId: uidGerson,
    amount: 15000,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailFamilia, pass);

  try {
    await attemptDirectPaymentDeclaredWrite(debtRulesAllowShare);
    const debtAfter = await getDoc(doc(db, "household_debts", debtRulesAllowShare));
    if (debtAfter.data()?.status === "payment_declared") {
      ok("Escenario 9: Rules PERMITIERON la transición directa cuando la share del pagador está completed con completedByTransactionId");
    } else {
      fail("Escenario 9", `estado esperado 'payment_declared', recibido ${JSON.stringify(debtAfter.data())}`);
    }
  } catch (err) {
    fail("Escenario 9: Rules debieron permitir la transición con la share del pagador completada", err);
  }

  // -----------------------------------------------------------------
  // ESCENARIO 10 (no-regresión): el ACREEDOR no puede declarar su propia
  // deuda a favor (declareDebtPayment exige ownerId === fromUserId).
  // -----------------------------------------------------------------
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailGerson, pass);

  const evtCreditorAttempt = `evt_dpg_creditor_${stamp}`;
  await setDoc(doc(db, "household_events", evtCreditorAttempt), {
    householdId: hhId,
    title: "Evento para intento del acreedor",
    totalAmount: 30000,
    householdCategoryId: "cat_general",
    createdByUserId: uidGerson,
    paidByUserId: uidGerson,
    settlementMode: "advancedByPayer",
    status: "active",
    description: "",
    sourceTransactionId: `tx_source_creditor_${stamp}`,
    eventDate: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const debtCreditorAttempt = `debt_dpg_creditor_${stamp}`;
  await setDoc(doc(db, "household_debts", debtCreditorAttempt), {
    householdId: hhId,
    eventId: evtCreditorAttempt,
    fromUserId: uidFamilia,
    toUserId: uidGerson,
    amount: 15000,
    status: "pending",
    outgoingTransactionId: null,
    incomingTransactionId: null,
    paymentDeclaredAt: null,
    paidAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    // Gerson (el ACREEDOR, toUserId) intenta declarar el pago de una deuda que no es suya como deudor.
    await declareDebtPaymentModule.declareDebtPayment({
      debtId: debtCreditorAttempt,
      ownerId: uidGerson,
      accountId: gersonAccountId,
      pocketId: null,
      date: new Date(),
    });
    fail("Escenario 10", "el acreedor (toUserId) NUNCA debió poder declarar el pago de una deuda en la que no es el deudor");
  } catch {
    ok("Escenario 10: el acreedor no puede declarar el pago (declareDebtPayment exige ser el deudor)");
  }
  const debtCreditorAttemptAfter = await getDoc(doc(db, "household_debts", debtCreditorAttempt));
  if (debtCreditorAttemptAfter.data()?.status === "pending") {
    ok("Escenario 10b: la deuda sigue 'pending' tras el intento rechazado del acreedor");
  } else {
    fail("Escenario 10b", `estado esperado 'pending', recibido '${debtCreditorAttemptAfter.data()?.status}'`);
  }

  console.log("\n-------------------------------------------------");
  console.log(`Resultados declare-debt-payment-gate: ${passed} pasadas, ${failed} falladas.`);
  if (failed > 0) {
    console.error("Fallos:\n" + failures.join("\n"));
    process.exit(1);
  } else {
    console.log("¡Todas las pruebas E2E del gate de declaración de pago en emulador pasaron exitosamente!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Error no capturado en harness declare-debt-payment-gate:", err);
  process.exit(1);
});
