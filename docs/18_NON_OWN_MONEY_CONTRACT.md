# 18 — Contrato de dinero no propio (WA-DATA-003)

**Estado:** vigente 2026-08-07 (cierre pragmático)  
**Alcance:** paridad Android ↔ Web sobre “cuánto no propio hay” y “cuánto propio puedo gastar”.  
**No cambia:** modelo Firebase, Rules ni esquema. Solo fija el contrato operativo.

## 1. Fuente de verdad remota (compartida)

Ambas apps deben converger en el **mismo saldo no propio por ubicación** usando el ledger de ubicación, no un cálculo paralelo distinto:

| Artefacto | Rol |
|---|---|
| `third_party_fund_entries` | Entradas de dinero no propio (ingreso no real, etc.) |
| `third_party_fund_consumptions` | Consumos FIFO ligados a gastos |
| `third_party_fund_location_operations` | Movimientos de ubicación (transfer no propio, pocket_initial/delete, expense_consume OCC) |
| `third_party_fund_location_ledger/{ownerId}` | Versión OCC del ledger de ubicación |

**Held canónico en una ubicación** `(accountId, pocketId|null)`:

`held = Σ entries abiertas proyectadas en esa ubicación ± moves − consumptions`

- **Web:** `projectThirdPartyHeldAtLocation` + snapshot de entries/moves/consumptions.  
- **Android:** `ThirdPartyLocationReadRepository.heldAtLocation` / proyección equivalente (no Matching legacy solo por ingreso).

**Mi dinero (barrera local de débitos normales):**

`own = físico_ubicación − held`  
- Si `held` no finito, `< 0`, o `held > físico` → **composición inconsistente** (rechazo; **sin clamp**).  
- Si `monto > own` → **fondos propios insuficientes**.  
- Si `monto ≤ own` → permitido (aunque quede no propio retenido en la ubicación).

Aplica a: transfer normal, gasto propio, complete-share (vía gasto), declare deuda (outgoing), proyección Personal→Hogar (vía gasto).

## 2. Campos en la transacción vs colecciones

| Señal | Uso |
|---|---|
| Colecciones entries/consumptions/ops/ledger | **Fuente de verdad** del disponible no propio y de la barrera |
| `consumesThirdPartyFunds` / `thirdPartyConsumeAmount` en `transactions` | Señales de compatibilidad / OCC gasto; **no** sustituyen al ledger de ubicación para calcular held |
| UI “no propio pendiente / retenido” | Debe derivarse de la proyección canónica (misma fórmula §1), no de un total inventado en cliente |

Si una app escribe solo campos en la tx sin actualizar el ledger de ubicación (o al revés), el “disponible no propio” **puede divergir**. El contrato exige: **toda mutación que mueva o consuma no propio actualiza el modelo de ubicación acordado**.

## 3. Fuera de alcance (explícito)

- OCC multi-dispositivo “perfecto” que serialice **todas** las mutaciones normales vía ledger (techo actual = barrera local; ver TD-09 en la matriz).  
- Unificar copy de errores UI Web vs Android.  
- Migrar parsers tolerantes (`toSafeNumber` → 0).

## 4. Asserts de paridad para QA cruzado (TD-11)

Prefijo `QA-DEBT-NP-`. Tras cada paso, comparar Web y Android:

1. **Mismo held:** ubicación con físico 100 000 y no propio 40 000 → ambas UIs muestran ~40 000 retenidos / ~60 000 propios (tolerancia 1 peso).  
2. **Misma barrera:** transfer o declare de 60 001 → rechazo en ambas; 60 000 → OK en ambas.  
3. **Cross-write:** crear ingreso no real / consumo en una app → la otra, tras sync, muestra el mismo held en esa ubicación (sin “inventar” disponible).

Si (1) o (3) fallan → abrir incidencia de contrato (no “arreglar” solo UI). Si solo (2) falla en una app → regresión de barrera local.

## 5. Referencias

- Matriz: [`16_TECH_DEBT_MATRIX.md`](16_TECH_DEBT_MATRIX.md) (TD-22, TD-09, TD-11).  
- Web: `src/lib/finance/third-party-location.ts`, `own-funds-gate.ts`, servicios create-transfer / expense / complete-share / declare-debt.  
- Android: proyección canónica held + `requireOwnAvailableAtOrigin` / `checkOwnAvailable`.
