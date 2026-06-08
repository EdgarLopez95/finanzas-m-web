/**
 * Harness de pruebas E2E de WEB-V6B6 contra el Firebase Local Emulator Suite.
 *
 * Ejecuta los SERVICIOS REALES (create/update/delete de gastos e ingresos)
 * contra un Firestore + Auth emulados, cargando las reglas reales de
 * android/firestore.rules. No toca produccion.
 *
 * Como correrlo (requiere Java/JDK instalado):
 *   npm run test:emulator
 *
 * Modo smoke (sin emulador, solo valida que los modulos resuelven/cargan):
 *   HARNESS_IMPORT_CHECK=1 npx tsx tests/emulator/run-v6b6.ts
 */

import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
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
  console.log(`  \u2713 ${label}`);
};
const bad = (label: string, detail?: unknown) => {
  failed += 1;
  const msg = detail instanceof Error ? detail.message : detail ? String(detail) : "";
  failures.push(`${label}${msg ? ` :: ${msg}` : ""}`);
  console.log(`  \u2717 ${label}${msg ? ` :: ${msg}` : ""}`);
};

const assert = (cond: boolean, label: string) => (cond ? ok(label) : bad(label));
const approx = (a: number, b: number) => Math.abs(a - b) < 0.001;

/** Espera que la promesa RESUELVA (no lance). Detecta regresion read-after-write. */
const expectResolves = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    ok(label);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/all reads.*before all writes|reads to be executed/i.test(m)) {
      bad(`${label} [REGRESION read-after-write]`, err);
    } else {
      bad(label, err);
    }
  }
};

/** Espera que la promesa LANCE, idealmente con un mensaje que contenga `includes`. */
const expectThrows = async (label: string, includes: RegExp, fn: () => Promise<unknown>) => {
  try {
    await fn();
    bad(`${label} (no lanzo error)`);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (includes.test(m)) ok(`${label}`);
    else bad(`${label} (lanzo, pero mensaje inesperado)`, err);
  }
};

async function main() {
  // ---- Carga dinamica del cliente + servicios reales (despues de shims) ----
  const { getFirebaseDb, getFirebaseAuth } = await import("@/lib/firebase/client");

  if (process.env.HARNESS_IMPORT_CHECK === "1") {
    await import("@/features/transactions/services/create-personal-expense");
    await import("@/features/transactions/services/update-personal-transaction");
    await import("@/features/transactions/services/delete-personal-transaction");
    await import("@/features/transactions/services/create-personal-income");
    await import("@/features/transactions/services/read-available-third-party-funds");
    await import("@/features/transactions/services/sync-third-party-fund-entry");
    await import("@/features/transactions/services/sync-household-income-projection");
    console.log("Import/resolve OK: todos los modulos de servicio cargan en Node.");
    return;
  }

  const { createPersonalExpense } = await import(
    "@/features/transactions/services/create-personal-expense"
  );
  const { updatePersonalTransaction } = await import(
    "@/features/transactions/services/update-personal-transaction"
  );
  const { deletePersonalTransaction } = await import(
    "@/features/transactions/services/delete-personal-transaction"
  );
  const { createPersonalIncome } = await import(
    "@/features/transactions/services/create-personal-income"
  );

  // ---- Conectar a emuladores ----
  const fsHostRaw = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [fsHost, fsPort] = fsHostRaw.split(":");
  const authHostRaw = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

  const auth: Auth = getFirebaseAuth();
  connectAuthEmulator(auth, `http://${authHostRaw}`, { disableWarnings: true });
  const db: Firestore = getFirebaseDb();
  connectFirestoreEmulator(db, fsHost, Number(fsPort));

  // ---- Usuario de prueba (owner) ----
  const email = `felipe+${Date.now()}@test.dev`;
  const cred = await createUserWithEmailAndPassword(auth, email, "password123");
  const uid = cred.user.uid;
  console.log(`\nUsuario de prueba: ${email} (uid=${uid})`);

  // ---- Helpers de lectura ----
  const getBalance = async (accountId: string): Promise<number> => {
    const snap = await getDoc(doc(db, "accounts", accountId));
    const d = snap.data() ?? {};
    return Number(d.currentBalance ?? d.balance ?? 0);
  };
  const consumptionsOfExpense = async (expenseId: string) => {
    const snap = await getDocs(
      query(
        collection(db, "third_party_fund_consumptions"),
        where("ownerId", "==", uid),
        where("consumerExpenseTransactionId", "==", expenseId)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  };
  const entryPending = async (entryId: string): Promise<{ pending: number; status: string }> => {
    const entrySnap = await getDoc(doc(db, "third_party_fund_entries", entryId));
    const original = Number((entrySnap.data() ?? {}).originalAmount ?? 0);
    const status = String((entrySnap.data() ?? {}).status ?? "");
    // La regla de list exige filtrar por ownerId; el entryId se filtra en cliente (igual que la app).
    const consSnap = await getDocs(
      query(collection(db, "third_party_fund_consumptions"), where("ownerId", "==", uid))
    );
    const consumed = consSnap.docs
      .filter((d) => String((d.data() as { entryId?: string }).entryId ?? "") === entryId)
      .reduce((s, d) => s + Number((d.data() as { amount?: number }).amount ?? 0), 0);
    return { pending: original - consumed, status };
  };
  const findTxId = async (type: string, amount: number): Promise<string | null> => {
    const snap = await getDocs(
      query(collection(db, "transactions"), where("ownerId", "==", uid), where("type", "==", type))
    );
    const match = snap.docs.find((d) => approx(Number((d.data() as { amount?: number }).amount ?? -1), amount));
    return match ? match.id : null;
  };

  // ---- Seed ----
  console.log("\n[Seed] cuentas, categorias, hogar y entry de dinero no propio");
  const ACC1 = "acc-1";
  const ACC2 = "acc-2";
  const CAT_EXP = "cat-exp";
  const CAT_INC = "cat-inc";
  const HH = "hh-1";
  const E1 = "entry-1";
  const ACC1_START = 1_000_000;
  const ACC2_START = 500_000;

  await setDoc(doc(db, "accounts", ACC1), { ownerId: uid, name: "Banco A", currentBalance: ACC1_START, createdAt: serverTimestamp() });
  await setDoc(doc(db, "accounts", ACC2), { ownerId: uid, name: "Banco B", currentBalance: ACC2_START, createdAt: serverTimestamp() });
  await setDoc(doc(db, "categories", CAT_EXP), { ownerId: uid, name: "Mercado", kind: "expense", createdAt: serverTimestamp() });
  await setDoc(doc(db, "categories", CAT_INC), { ownerId: uid, name: "Sueldo", kind: "income", createdAt: serverTimestamp() });
  await setDoc(doc(db, "households", HH), { ownerId: uid, memberIds: [uid], status: "active", name: "Casa", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await setDoc(doc(db, "users", uid), { activeHouseholdId: HH, displayName: "Felipe", updatedAt: serverTimestamp() });
  await setDoc(doc(db, "third_party_fund_entries", E1), {
    ownerId: uid,
    sourceIncomeTransactionId: "seed-income-E1",
    originalAmount: 100_000,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  ok("Seed completado (incluye create de entry via reglas owner-only)");

  // ================= ESCENARIO 1: gasto sin consumo =================
  console.log("\n[1] Crear gasto normal (sin consumo)");
  {
    const before = await getBalance(ACC1);
    await expectResolves("crear gasto 11000 sin consumo", () =>
      createPersonalExpense({ ownerId: uid, amount: 11_000, accountId: ACC1, categoryId: CAT_EXP, date: new Date() })
    );
    assert(approx(await getBalance(ACC1), before - 11_000), "saldo ACC1 baja exactamente 11000");
    const txId = await findTxId("expense", 11_000);
    const snap = txId ? await getDoc(doc(db, "transactions", txId)) : null;
    const data = (snap?.data() ?? {}) as Record<string, unknown>;
    assert(!("consumesThirdPartyFunds" in data) && !("thirdPartyConsumeAmount" in data), "gasto NO persiste consumesThirdPartyFunds/thirdPartyConsumeAmount");
  }

  // ================= ESCENARIO 2: gasto con consumo parcial =================
  console.log("\n[2] Crear gasto 80000 consumiendo 60000 de E1 (pending 100000)");
  {
    const before = await getBalance(ACC1);
    await expectResolves("crear gasto con consumo 60000", () =>
      createPersonalExpense({ ownerId: uid, amount: 80_000, accountId: ACC1, categoryId: CAT_EXP, date: new Date(), consumesThirdPartyFunds: true, thirdPartyConsumeAmount: 60_000 })
    );
    assert(approx(await getBalance(ACC1), before - 80_000), "saldo ACC1 baja por el total (80000), no por el consumo");
    const expId = await findTxId("expense", 80_000);
    const cons = expId ? await consumptionsOfExpense(expId) : [];
    assert(cons.length === 1 && approx(Number((cons[0] as { amount?: number }).amount ?? 0), 60_000), "se creo 1 consumption de 60000");
    const e = await entryPending(E1);
    assert(approx(e.pending, 40_000) && e.status === "open", "E1 pending=40000 y status=open (derivado manda)");
  }

  // ================= ESCENARIO 3: editar gasto cambiando MONTO TOTAL y consumo (CRIT-1) =================
  console.log("\n[3] Editar ese gasto -> total 90000, consumo 75000 (cambia monto: gatillo CRIT-1)");
  {
    const expId = await findTxId("expense", 80_000);
    const accBefore = await getBalance(ACC1);
    await expectResolves("editar gasto con consumo + cambio de monto NO lanza read-after-write", () =>
      updatePersonalTransaction({ ownerId: uid, transactionId: expId!, type: "expense", amount: 90_000, accountId: ACC1, categoryId: CAT_EXP, date: new Date(), consumesThirdPartyFunds: true, thirdPartyConsumeAmount: 75_000 })
    );
    const cons = await consumptionsOfExpense(expId!);
    assert(cons.length === 1 && approx(Number((cons[0] as { amount?: number }).amount ?? 0), 75_000), "consumption viejo borrado y recreado en 75000 (sin duplicados)");
    const e = await entryPending(E1);
    assert(approx(e.pending, 25_000), "E1 pending=25000 tras editar");
    assert(approx(await getBalance(ACC1), accBefore - 10_000), "saldo ACC1 ajusta el delta del total (-10000 adicional)");
  }

  // ================= ESCENARIO 4: editar gasto cambiando de CUENTA (CRIT-1) =================
  console.log("\n[4] Editar ese gasto -> cambia a ACC2 (manteniendo total 90000 y consumo 75000)");
  {
    const expId = await findTxId("expense", 90_000);
    const a1Before = await getBalance(ACC1);
    const a2Before = await getBalance(ACC2);
    await expectResolves("editar gasto con consumo + cambio de cuenta NO lanza read-after-write", () =>
      updatePersonalTransaction({ ownerId: uid, transactionId: expId!, type: "expense", amount: 90_000, accountId: ACC2, categoryId: CAT_EXP, date: new Date(), consumesThirdPartyFunds: true, thirdPartyConsumeAmount: 75_000 })
    );
    assert(approx(await getBalance(ACC1), a1Before + 90_000), "ACC1 recupera +90000");
    assert(approx(await getBalance(ACC2), a2Before - 90_000), "ACC2 baja -90000");
    const cons = await consumptionsOfExpense(expId!);
    assert(cons.length === 1 && approx(Number((cons[0] as { amount?: number }).amount ?? 0), 75_000), "consumption sigue en 75000 sin duplicar");
  }

  // ================= ESCENARIO 5: eliminar gasto con consumo (CRIT-2) =================
  console.log("\n[5] Eliminar ese gasto -> reversion del ledger (gatillo CRIT-2)");
  {
    const expId = await findTxId("expense", 90_000);
    const a2Before = await getBalance(ACC2);
    await expectResolves("eliminar gasto con consumo NO lanza read-after-write", () =>
      deletePersonalTransaction({ ownerId: uid, transactionId: expId! })
    );
    assert(approx(await getBalance(ACC2), a2Before + 90_000), "ACC2 recupera +90000 al eliminar");
    const cons = await consumptionsOfExpense(expId!);
    assert(cons.length === 0, "consumptions del gasto eliminadas");
    const e = await entryPending(E1);
    assert(approx(e.pending, 100_000) && e.status === "open", "E1 vuelve a pending=100000 status=open");
    const stillThere = await findTxId("expense", 90_000);
    assert(stillThere === null, "documento de transaccion eliminado");
  }

  // ================= ESCENARIO 6: crear income REAL con proyeccion a Hogar (CRIT-3) =================
  console.log("\n[6] Crear income real 50000 con hogar activo (gatillo CRIT-3 household sync)");
  {
    const before = await getBalance(ACC1);
    await expectResolves("crear income real NO lanza read-after-write", () =>
      createPersonalIncome({ ownerId: uid, amount: 50_000, accountId: ACC1, categoryId: CAT_INC, countsAsRealIncome: true, date: new Date(), description: "Sueldo" })
    );
    assert(approx(await getBalance(ACC1), before + 50_000), "ACC1 sube +50000");
    const incId = await findTxId("income", 50_000);
    const proj = await getDocs(query(collection(db, "household_income_entries"), where("sourceOwnerId", "==", uid), where("sourceTransactionId", "==", incId!)));
    assert(proj.docs.length === 1 && String((proj.docs[0].data() as { status?: string }).status) === "active", "se creo 1 household_income_entry activa");
  }

  // ================= ESCENARIO 7: crear income NO REAL -> ledger privado (CRIT-3) =================
  console.log("\n[7] Crear income no real 30000 -> third_party_fund_entry (gatillo CRIT-3 third-party sync)");
  {
    await expectResolves("crear income no real NO lanza read-after-write", () =>
      createPersonalIncome({ ownerId: uid, amount: 30_000, accountId: ACC1, categoryId: CAT_INC, countsAsRealIncome: false, date: new Date(), description: "Reembolso" })
    );
    const incId = await findTxId("income", 30_000);
    if (!incId) {
      bad("crear income no real produjo una transaccion (no se creo: revisar error arriba)");
    } else {
      const entrySnap = await getDoc(doc(db, "third_party_fund_entries", incId));
      assert(entrySnap.exists() && String((entrySnap.data() as { status?: string }).status) === "open" && approx(Number((entrySnap.data() as { originalAmount?: number }).originalAmount ?? 0), 30_000), "entry privada creada (open, original 30000)");
      const proj = await getDocs(query(collection(db, "household_income_entries"), where("sourceOwnerId", "==", uid), where("sourceTransactionId", "==", incId)));
      assert(proj.docs.length === 0, "income no real NO proyecta a Hogar");
    }
  }

  // ================= ESCENARIO 8: guarda de sobre-consumo =================
  console.log("\n[8] Intentar consumir mas que el disponible -> debe abortar todo");
  {
    const before = await getBalance(ACC1);
    await expectThrows("consumir > disponible lanza error", /disponible/i, () =>
      createPersonalExpense({ ownerId: uid, amount: 999_999, accountId: ACC1, categoryId: CAT_EXP, date: new Date(), consumesThirdPartyFunds: true, thirdPartyConsumeAmount: 999_999 })
    );
    assert(approx(await getBalance(ACC1), before), "saldo ACC1 sin cambios (abort atomico, sin gasto parcial)");
    const ghost = await findTxId("expense", 999_999);
    assert(ghost === null, "no quedo transaccion fantasma");
  }

  // ================= ESCENARIO 9: reglas owner-only (cross-user) =================
  console.log("\n[9] Reglas: otro usuario NO puede leer el ledger privado");
  {
    await signOut(auth);
    const cred2 = await createUserWithEmailAndPassword(auth, `intruso+${Date.now()}@test.dev`, "password123");
    void cred2;
    await expectThrows("lectura de entries de otro owner = permission-denied", /permission|insufficient|denied|false for/i, async () => {
      await getDocs(query(collection(db, "third_party_fund_entries"), where("ownerId", "==", uid)));
    });
    // volver al owner por limpieza
    await signOut(auth);
    await signInWithEmailAndPassword(auth, email, "password123");
  }

  await terminate(db).catch(() => undefined);
}

main()
  .then(() => {
    console.log(`\n=================  RESULTADO  =================`);
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
