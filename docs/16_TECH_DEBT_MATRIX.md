# 16 — Matriz de deuda técnica Web

**Última actualización:** 2026-08-07 — cierre pragmático de deuda conjunta  
**Propósito:** una sola fuente viva de estado. Si un ítem no está aquí, no existe como deuda gestionada.

Leyenda: `hecho` · `aceptado` · `pendiente` · `bloqueado` (requiere Android/Rules conjunto)

## Prioridad Alta — integridad (cerrada en código + Rules)

| ID | Ítem | Estado | Dueño | Notas |
|---|---|---|---|---|
| TD-01 | `tsc --noEmit` verde | hecho | Web | |
| TD-02 | Barrera propio/no propio HH (Web) | hecho | Web | complete-share + declare-debt |
| TD-03 | Proyección Hogar sin clamp | hecho | Web | |
| TD-04 | Validación relacional update evento | hecho | Web | |
| TD-05 | Gate qa-reset producción | hecho | Web | |
| TD-06 | Matriz + `.gitignore` | hecho | Web | |
| TD-08a | close↔pocket Web `pocketCount` | hecho | Web | |
| TD-08b | close↔pocket Android cliente | hecho | Android | `pocketCount` + `!archived` + migración v14 |
| TD-09a | Declare pago Android Mi dinero | hecho | Android | |
| TD-09b | Held canónico A/B/C Android | hecho | Android | |
| TD-07a | Rules emulator = Android working | hecho | Web | 841 líneas / SHA `0a812df3…` |
| TD-07b | Rules guards close↔pocket | hecho | Android | Incluidas en candidato desplegado |
| TD-07 | Deploy Rules a prod | hecho | Felipe + Web | 2026-08-07 · SHA `0a812df3…` (detalle en log Parte 2). Confirmar release en consola Firebase (reauth API pendiente). |
| TD-21 | Montos inválidos + gate deuda en Rules | hecho | Conjunto | Viajó en el mismo deploy (`isValidTransactionAmount`, gate `payment_declared`) |

## Aceptado / bloqueado (sin limbo)

| ID | Ítem | Estado | Dueño | Notas |
|---|---|---|---|---|
| TD-09 | OCC multi-dispositivo fuerte | aceptado | Conjunto | Techo = barrera local (paridad Android actual) |
| TD-10 | Atomicidad complete-share / proyección (2 pasos Android) | aceptado | Conjunto | P2; no corrompe Mi dinero por sí sola |
| TD-10b | AUD-005 edit/cancel evento Hogar atómico | bloqueado | Conjunto | Pre-read + txn en Web (`update-household-event` / `cancel-household-event`). Cierre futuro = lista/versión canónica con Android; **no** parche Web solo |
| TD-12 | Parsers `toSafeNumber` → 0 | aceptado temporal | Conjunto | |
| TD-13 | Timezone / período civil | aceptado | Conjunto | TZ del dispositivo en ambas apps |
| TD-18–20 | Deps / warnings lint / barrera local transfer | aceptado | — | |
| TD-22 | Contrato dinero no propio (WA-DATA-003) | hecho (doc) | Conjunto | [`18_NON_OWN_MONEY_CONTRACT.md`](18_NON_OWN_MONEY_CONTRACT.md) |
| TD-23 | Paridad UX/código Web no propio (G1–G5) | hecho (código) | Web | Mapa de ownership, bolsillo↔held atómico, inmutabilidad, panel de composición, copy unificado. Validado con `tsc` + unit tests; **runtime pendiente** vía TD-11 |
| TD-24 | Review items de Hogar sin UI | aceptado | Web | Queda en Firestore para qa-reset/dissolve, intencional sin UI por ahora |

## Pendiente (no bloquea integridad ya desplegada)

| ID | Ítem | Estado | Dueño | Notas |
|---|---|---|---|---|
| TD-11 | QA real 2 usuarios / Android↔Web | pendiente | Felipe | Checklist abajo (única hoja) |
| TD-14–17 | Perf / boundaries / monolito / lint CLI | pendiente | Web | Mejora continua; no dinero |

---

## Checklist QA cruzado (TD-11) — única hoja

**Dueño:** Felipe · **Prefijo:** `QA-DEBT-` · **Cuándo:** ya (Rules desplegadas).  
Marca Pass/Fail; al terminar avisa al agente para TD-11 → `hecho` o fallos abiertos.

| # | Caso | Web | Android | Pass? | Notas |
|---|---|---|---|---|---|
| 1 | Transfer: 100k físico / 40k no propio → 60k OK; 60 001 rechazo | | | | |
| 2 | Declare deuda > Mi dinero rechazo; ≤ OK | | | | |
| 3 | Complete share ≤ / > Mi dinero | | | | |
| 4 | close↔pocket (crear en cerrada; cerrar con bolsillo; cerrar vacía) | | | | |
| 5 | Cross-device + held coherente ([contrato 18](18_NON_OWN_MONEY_CONTRACT.md) §4) | | | | |
| 6 | Privacidad Hogar (sin cuenta/bolsillo/saldo del otro) | | | | |
| 7 | (Opcional) Consola Rules = release post-`0a812df3…` | | | | |

**Resultado:** fecha ______ · resumen ______ · bloqueantes ______

### Criterio de cierre de deuda de integridad gestionada

1. Filas Alta en `hecho` (arriba).  
2. OCC / timezone / AUD-005 con estado explícito (aceptado/bloqueado).  
3. Contrato no propio publicado.  
4. TD-11 con evidencia pass (o fallos priorizados, no limbo).

**Hoy:** 1–3 cumplidos en documentación/código. **Falta solo 4 (tú).**
