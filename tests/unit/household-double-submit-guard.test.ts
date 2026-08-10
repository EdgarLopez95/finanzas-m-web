import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-double-submit-guard.test.ts...");

// ==========================================
// H4.1: impedir doble envío de acciones financieras de Hogar.
//
// Estos 9 hooks realizan escrituras financieras de Hogar (crean/mueven dinero real o crean
// registros de deuda/gasto compartido) y no tenían guarda contra reenvío antes de este bloque:
//   1. use-declare-debt-payment.ts        (crea reimbursement saliente + descuenta saldo)
//   2. use-confirm-debt-reception.ts      (crea reimbursement entrante + suma saldo)
//   3. use-complete-household-event-share.ts (crea gasto personal + descuenta saldo)
//   4. use-undo-declared-debt-payment.ts  (borra transacción + revierte saldo)
//   5. use-create-household-event.ts      (crea household_event + shares + deudas)
//   6. use-update-household-event.ts      (edita monto/fecha de un evento, incl. reconciliación)
//   7. use-cancel-household-event.ts      (cancela evento + cascada shares/deudas)
//   8. use-cancel-pending-share.ts        (cancela una responsabilidad pendiente)
//   9. use-create-personal-expense-with-household-projection.ts (Personal->Hogar directo: crea
//      household_event + shares + deudas desde un gasto personal)
//
// Excluidos explícitamente de este bloque (verificado, no asumido):
//   - useCreateHousehold, useJoinHousehold, useLeaveHousehold, useDissolveHousehold,
//     useGenerateInviteCode: ya tenían guarda (estado o useRef) antes de este bloque.
//   - useRenameHousehold, useClearActiveHousehold: no son acciones financieras (nombre/ referencia
//     local, no mueven dinero ni crean deuda/gasto).
//   - useHouseholdCategories: CRUD de metadata de categorías, no una transacción financiera (no
//     crea gasto, deuda ni movimiento de saldo).
//   - hooks de borrado de cuenta/transacción personal (delete-personal-transaction,
//     delete-personal-entity-cascade): son acciones del dominio Personal con efectos secundarios
//     en Hogar, no acciones de Hogar en sí; quedan fuera de este bloque explícitamente.
// ==========================================

async function runHouseholdDoubleSubmitGuardTests() {
  // ==========================================
  // Comportamiento del patrón de guarda (useRef, no useState) replicado en plano JS. Se usa
  // useRef y no el patrón de solo-estado de useCreateHousehold porque setIsSubmitting/setState de
  // React no se refleja de forma síncrona en el closure de una segunda invocación disparada antes
  // de que React re-renderice (el mismo problema que ya motivó useRef en useGenerateInviteCode/
  // useJoinHousehold, H1.2). Este test prueba que el patrón realmente deduplica invocaciones
  // concurrentes disparadas de forma síncrona, antes de que la primera resuelva.
  // ==========================================

  const makeGuardedAction = () => {
    const isSubmittingRef = { current: false };
    let serviceCalls = 0;
    const action = async (): Promise<boolean> => {
      if (isSubmittingRef.current) {
        return false;
      }
      isSubmittingRef.current = true;
      try {
        serviceCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5)); // simula la llamada remota real
        return true;
      } finally {
        isSubmittingRef.current = false;
      }
    };
    return { action, getServiceCalls: () => serviceCalls };
  };

  // Test 1: dos invocaciones concurrentes (disparadas de forma síncrona, sin esperar la primera)
  // producen una sola llamada real al servicio.
  {
    const { action, getServiceCalls } = makeGuardedAction();
    const [first, second] = await Promise.all([action(), action()]);
    assert.strictEqual(getServiceCalls(), 1, "dos invocaciones concurrentes -> 1 sola llamada real");
    assert.strictEqual(first, true, "la primera invocación se ejecuta y resuelve true");
    assert.strictEqual(second, false, "la segunda invocación (concurrente) se descarta y resuelve false sin llamar al servicio");
  }

  // Test 2: tres invocaciones concurrentes -> sigue siendo 1 sola llamada real (no solo 2).
  {
    const { action, getServiceCalls } = makeGuardedAction();
    const results = await Promise.all([action(), action(), action()]);
    assert.strictEqual(getServiceCalls(), 1, "tres invocaciones concurrentes -> 1 sola llamada real");
    assert.strictEqual(results.filter(Boolean).length, 1, "solo una de las tres resuelve true");
  }

  // Test 3: invocaciones SECUENCIALES (esperando a que la primera termine) sí producen una
  // llamada real cada una — la guarda no bloquea permanentemente, solo mientras hay una
  // operación en curso.
  {
    const { action, getServiceCalls } = makeGuardedAction();
    const first = await action();
    const second = await action();
    assert.strictEqual(getServiceCalls(), 2, "dos invocaciones secuenciales -> 2 llamadas reales");
    assert.strictEqual(first, true, "primera invocación secuencial resuelve true");
    assert.strictEqual(second, true, "segunda invocación secuencial (tras completar la primera) también resuelve true");
  }

  // Test 4: si la acción falla, la guarda se libera igual (reset en finally) — un reintento
  // tras un error no queda bloqueado para siempre.
  {
    const isSubmittingRef = { current: false };
    let serviceCalls = 0;
    const failingThenOkAction = async (shouldFail: boolean): Promise<boolean> => {
      if (isSubmittingRef.current) return false;
      isSubmittingRef.current = true;
      try {
        serviceCalls += 1;
        if (shouldFail) throw new Error("fallo simulado");
        return true;
      } catch {
        return false;
      } finally {
        isSubmittingRef.current = false;
      }
    };
    const first = await failingThenOkAction(true);
    const second = await failingThenOkAction(false);
    assert.strictEqual(first, false, "la invocación que falla resuelve false");
    assert.strictEqual(second, true, "una invocación posterior al error se ejecuta normalmente (guarda liberada)");
    assert.strictEqual(serviceCalls, 2, "ambas invocaciones (fallida y exitosa) llegaron a llamar al servicio, cada una por separado");
  }

  console.log("  ✓ Patrón de guarda useRef: concurrencia deduplicada, secuencial no bloqueado, reset tras error");

  // ==========================================
  // Contrato estructural: los 9 hooks en alcance de H4.1 realmente aplican el patrón —
  // chequeo de isSubmittingRef.current ANTES de iniciar el envío (setIsSubmitting/setState) y
  // reset de isSubmittingRef.current dentro de un bloque finally.
  // ==========================================
  const repoRoot = path.join(__dirname, "../..");
  const hookFiles = [
    { path: "src/features/household/hooks/use-declare-debt-payment.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-confirm-debt-reception.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-complete-household-event-share.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-undo-declared-debt-payment.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-create-household-event.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-update-household-event.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-cancel-household-event.ts", startMarker: "setIsSubmitting(true)" },
    { path: "src/features/household/hooks/use-cancel-pending-share.ts", startMarker: "setIsSubmitting(true)" },
    {
      path: "src/features/transactions/hooks/use-create-personal-expense-with-household-projection.ts",
      startMarker: "setState({ isSubmitting: true",
    },
  ];

  for (const { path: relPath, startMarker } of hookFiles) {
    const fullPath = path.join(repoRoot, relPath);
    const content = fs.readFileSync(fullPath, "utf8");

    assert.ok(content.includes("useRef"), `${relPath}: debe importar useRef`);
    assert.ok(content.includes("isSubmittingRef"), `${relPath}: debe declarar isSubmittingRef`);

    const guardCheckIndex = content.indexOf("if (isSubmittingRef.current)");
    const startIndex = content.indexOf(startMarker);
    assert.ok(guardCheckIndex !== -1, `${relPath}: debe chequear if (isSubmittingRef.current) antes de enviar`);
    assert.ok(startIndex !== -1, `${relPath}: debe contener el marcador de inicio de envío "${startMarker}"`);
    assert.ok(
      guardCheckIndex < startIndex,
      `${relPath}: el chequeo de isSubmittingRef.current debe ocurrir ANTES de "${startMarker}" (guarda antes de cualquier llamada remota)`
    );

    const finallyIndex = content.indexOf("finally {");
    const resetIndex = content.indexOf("isSubmittingRef.current = false;");
    assert.ok(resetIndex !== -1, `${relPath}: debe resetear isSubmittingRef.current = false`);
    assert.ok(finallyIndex !== -1 && resetIndex > finallyIndex, `${relPath}: el reset debe ocurrir dentro de un bloque finally`);
  }

  console.log(`  ✓ Contrato estructural: los 9 hooks de H4.1 aplican isSubmittingRef antes del envío y lo resetean en finally`);

  console.log("household-double-submit-guard.test.ts: 5/5 pruebas pasadas.");
}

runHouseholdDoubleSubmitGuardTests().catch((err) => {
  console.error("Test failure in household-double-submit-guard.test.ts:", err);
  process.exitCode = 1;
});
