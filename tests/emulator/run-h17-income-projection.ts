/**
 * Harness de pruebas E2E de H1.7 (Proyecciones de ingresos Personal → Hogar)
 * contra el Firebase Local Emulator Suite.
 *
 * Ejecuta los SERVICIOS REALES Web:
 *   - createPersonalIncome
 *   - updatePersonalTransaction
 *   - deletePersonalTransaction
 *   - readHouseholdIncomeEntries
 *
 * contra Firestore + Auth emulados, con las Rules reales de tests/emulator/firestore.rules.
 *
 * Cubre:
 *   1. Crear ingreso real proyectado (countsAsRealIncome: true) como Miembro A de HH1.
 *   2. Editar monto/fecha/descripción manteniendo el mismo documento de proyección (status: active).
 *   3. Desmarcar el ingreso (countsAsRealIncome: false): transición active -> cancelled.
 *   4. Volver a marcar en el mismo Hogar: reactiva el mismo documento (status: active).
 *   5. Eliminar el ingreso personal: proyección cancelada (status: cancelled).
 *   6. Miembro B de HH1 puede leer únicamente el payload seguro (0 campos personales expuestos).
 *   7. Tercero no miembro C es rechazado con permission-denied.
 *
 * Ejecución:
 *   npm run test:emulator:h17
 */

import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  terminate,
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

// --- Shims para entorno Node ---
(globalThis as unknown as { window: unknown }).window = globalThis;
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||= "demo-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||= "demo-finanzas-m-plus.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||= "demo-finanzas-m-plus";
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

async function main() {
  const { getFirebaseDb, getFirebaseAuth } = await import("@/lib/firebase/client");

  if (process.env.HARNESS_IMPORT_CHECK === "1") {
    await import("@/features/transactions/services/create-personal-income");
    await import("@/features/transactions/services/update-personal-transaction");
    await import("@/features/transactions/services/delete-personal-transaction");
    await import("@/features/household/services/read-household-income-entries");
    console.log("Import/resolve OK: todos los modulos de H1.7 cargan en Node.");
    return;
  }

  const { createPersonalIncome } = await import("@/features/transactions/services/create-personal-income");
  const { updatePersonalTransaction } = await import("@/features/transactions/services/update-personal-transaction");
  const { deletePersonalTransaction } = await import("@/features/transactions/services/delete-personal-transaction");
  const { readHouseholdIncomeEntries } = await import("@/features/household/services/read-household-income-entries");

  // ---- Conectar a emuladores ----
  const fsHostRaw = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [fsHost, fsPort] = fsHostRaw.split(":");
  const authHostRaw = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

  const auth: Auth = getFirebaseAuth();
  connectAuthEmulator(auth, `http://${authHostRaw}`, { disableWarnings: true });

  const db: Firestore = getFirebaseDb();
  connectFirestoreEmulator(db, fsHost, Number(fsPort));

  console.log("Iniciando suite H1.7 de proyecciones de ingresos contra Firestore + Auth emulados...");

  const timestamp = Date.now();
  const emailA = `userA_h17_${timestamp}@test.com`;
  const emailB = `userB_h17_${timestamp}@test.com`;
  const emailC = `userC_h17_${timestamp}@test.com`;
  const pass = "password123";

  let uidA = "";
  let uidB = "";
  let uidC = "";

  const hhId = `hh_h17_${timestamp}`;
  const accIdA = `acc_a_h17_${timestamp}`;
  const catIdA = `cat_a_h17_${timestamp}`;

  try {
    // 1. Crear usuarios A, B, C
    const resA = await createUserWithEmailAndPassword(auth, emailA, pass);
    uidA = resA.user.uid;

    await signOut(auth);
    const resB = await createUserWithEmailAndPassword(auth, emailB, pass);
    uidB = resB.user.uid;

    await signOut(auth);
    const resC = await createUserWithEmailAndPassword(auth, emailC, pass);
    uidC = resC.user.uid;

    // 2. Sembrar documento de cada usuario autenticado como sí mismo
    await signInWithEmailAndPassword(auth, emailA, pass);
    await setDoc(doc(db, "users", uidA), { activeHouseholdId: hhId, email: emailA });

    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailB, pass);
    await setDoc(doc(db, "users", uidB), { activeHouseholdId: hhId, email: emailB });

    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailC, pass);
    await setDoc(doc(db, "users", uidC), { activeHouseholdId: null, email: emailC });

    // 3. Autenticado como User A: crear el Hogar y la infraestructura personal de A
    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailA, pass);

    await setDoc(doc(db, "households", hhId), {
      ownerId: uidA,
      memberIds: [uidA, uidB],
      name: "Hogar H17",
      status: "active",
      createdAt: new Date(),
    });

    await setDoc(doc(db, "accounts", accIdA), {
      ownerId: uidA,
      name: "Cuenta Nomina A",
      currentBalance: 5000000,
      createdAt: new Date(),
    });

    await setDoc(doc(db, "categories", catIdA), {
      ownerId: uidA,
      kind: "income",
      name: "Salarios",
      createdAt: new Date(),
    });

    ok("Sembrado inicial de usuarios, hogar, cuenta y categoría completado");

    // =========================================================================
    // ESCENARIO 1: Crear ingreso real proyectado (countsAsRealIncome: true)
    // =========================================================================
    const incomeDate1 = new Date("2026-07-28T10:00:00Z");
    await createPersonalIncome({
      ownerId: uidA,
      amount: 2000000,
      accountId: accIdA,
      categoryId: catIdA,
      date: incomeDate1,
      description: "  Nomina   Julio  ",
      countsAsRealIncome: true,
    });

    // Obtener la transacción creada
    const txSnap = await getDocs(
      query(collection(db, "transactions"), where("ownerId", "==", uidA), where("type", "==", "income"))
    );
    assert(txSnap.docs.length === 1, "Transacción personal de ingreso creada");
    const txDoc = txSnap.docs[0];
    const txId = txDoc.id;

    // Obtener la proyección en household_income_entries
    const projSnap = await getDocs(
      query(
        collection(db, "household_income_entries"),
        where("sourceOwnerId", "==", uidA),
        where("sourceTransactionId", "==", txId)
      )
    );
    assert(projSnap.docs.length === 1, "Documento de proyección creado en household_income_entries");
    const projDoc = projSnap.docs[0];
    const projId = projDoc.id;
    const projData = projDoc.data();

    assert(projData.status === "active", "Proyección inicial tiene status active");
    assert(projData.amount === 2000000, "Proyección inicial tiene amount 2000000");
    assert(projData.visibleDescription === "Nomina Julio", "Descripción normalizada sin espacios extra");
    assert(projData.householdId === hhId, "Proyección asignada al activeHouseholdId del owner");

    // Aserción estricta de privacidad
    assert(projData.accountId === undefined, "Invariante de privacidad: 0 accountId en el documento compartido");
    assert(projData.pocketId === undefined, "Invariante de privacidad: 0 pocketId en el documento compartido");
    assert(projData.categoryId === undefined, "Invariante de privacidad: 0 categoryId en el documento compartido");
    assert(projData.currentBalance === undefined, "Invariante de privacidad: 0 saldo de cuenta en el documento compartido");

    // =========================================================================
    // ESCENARIO 2: Editar monto/fecha/descripción manteniendo la proyección activa
    // =========================================================================
    const incomeDate2 = new Date("2026-07-29T10:00:00Z");
    await updatePersonalTransaction({
      transactionId: txId,
      ownerId: uidA,
      type: "income",
      amount: 2500000,
      accountId: accIdA,
      categoryId: catIdA,
      date: incomeDate2,
      description: "Nomina Julio Reajustada",
      countsAsRealIncome: true,
    });

    const projSnap2 = await getDoc(doc(db, "household_income_entries", projId));
    assert(projSnap2.exists(), "La proyección conserva la misma referencia de documento al editar");
    const projData2 = projSnap2.data()!;
    assert(projData2.amount === 2500000, "Edición actualiza el monto a 2500000");
    assert(projData2.visibleDescription === "Nomina Julio Reajustada", "Edición actualiza visibleDescription");
    assert(projData2.status === "active", "Edición conserva status active");

    // =========================================================================
    // ESCENARIO 3: Desmarcar el ingreso (countsAsRealIncome: false) -> status: cancelled
    // =========================================================================
    await updatePersonalTransaction({
      transactionId: txId,
      ownerId: uidA,
      type: "income",
      amount: 2500000,
      accountId: accIdA,
      categoryId: catIdA,
      date: incomeDate2,
      description: "Ingreso en tránsito",
      countsAsRealIncome: false,
    });

    const projSnap3 = await getDoc(doc(db, "household_income_entries", projId));
    assert(projSnap3.data()?.status === "cancelled", "Desmarcar ingreso transiciona proyección a status: cancelled");

    // =========================================================================
    // ESCENARIO 4: Volverlo a marcar (countsAsRealIncome: true) -> reactiva el mismo documento
    // =========================================================================
    await updatePersonalTransaction({
      transactionId: txId,
      ownerId: uidA,
      type: "income",
      amount: 2800000,
      accountId: accIdA,
      categoryId: catIdA,
      date: incomeDate2,
      description: "Nomina Confirmada",
      countsAsRealIncome: true,
    });

    const projSnap4 = await getDoc(doc(db, "household_income_entries", projId));
    const projData4 = projSnap4.data()!;
    assert(projData4.status === "active", "Re-marcar ingreso reactiva la proyección a status: active");
    assert(projData4.amount === 2800000, "Proyección reactivada actualiza el monto a 2800000");
    assert(projData4.visibleDescription === "Nomina Confirmada", "Proyección reactivada actualiza visibleDescription");

    // =========================================================================
    // ESCENARIO 5: Lectura segura por Miembro B
    // =========================================================================
    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailB, pass);

    const bEntries = await readHouseholdIncomeEntries(hhId);
    assert(bEntries.length === 1, "Miembro B lee la proyección activa del Hogar");
    const entryForB = bEntries[0];
    assert(entryForB.id === projId, "ID de entrada leída coincide");
    assert(entryForB.amount === 2800000, "Monto leído por B es 2800000");
    assert(entryForB.visibleDescription === "Nomina Confirmada", "Descripción leída por B es 'Nomina Confirmada'");
    assert(entryForB.sourceOwnerId === uidA, "sourceOwnerId de B coincide con Owner A");

    // Aserción estricta de objeto parseado para B
    assert((entryForB as any).accountId === undefined, "Objeto devuelto a B contiene 0 accountId");
    assert((entryForB as any).pocketId === undefined, "Objeto devuelto a B contiene 0 pocketId");
    assert((entryForB as any).categoryId === undefined, "Objeto devuelto a B contiene 0 categoryId");

    // =========================================================================
    // ESCENARIO 6: Rechazo de lectura para Tercero C (no miembro)
    // =========================================================================
    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailC, pass);

    let rejectedC = false;
    try {
      await readHouseholdIncomeEntries(hhId);
    } catch (err: any) {
      rejectedC = err?.message?.includes("permission-denied") || err?.code === "permission-denied";
    }
    assert(rejectedC, "Tercero no miembro C es rechazado con permission-denied por Security Rules");

    // =========================================================================
    // ESCENARIO 7: Borrado de la transacción personal -> proyección cancelada
    // =========================================================================
    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailA, pass);

    await deletePersonalTransaction({
      ownerId: uidA,
      transactionId: txId,
    });

    const projSnap7 = await getDoc(doc(db, "household_income_entries", projId));
    assert(projSnap7.data()?.status === "cancelled", "Borrado de transacción personal transiciona proyección a status: cancelled");

    // Verificar que Miembro B ya no la ve activa
    await signOut(auth);
    await signInWithEmailAndPassword(auth, emailB, pass);

    const bEntriesAfterDelete = await readHouseholdIncomeEntries(hhId);
    assert(bEntriesAfterDelete.length === 0, "Miembro B no ve entradas canceladas tras el borrado");

  } catch (err) {
    bad("Excepción no capturada en el harness de emulador H1.7", err);
  } finally {
    await terminate(db);
  }

  console.log("\n==================================================");
  console.log(`H1.7 Emulator Harness :: Passed: ${passed} | Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("Fallas:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

void main();
