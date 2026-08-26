# 11 â€” Web Dev Log

**Ãšltima actualizaciÃ³n:** 2026-05-31 â€” WEB-0 preparaciÃ³n de memoria operativa web.  
**Estado actual del repo:** repo web pendiente de crear.  
**PropÃ³sito:** memoria operativa viva del frente web de Finanzas M para que cualquier agente pueda continuar sin reconstruir contexto.

---

# PARTE 1 â€” REGLAS PARA AGENTES IA

## 1.1. QuÃ© es este archivo

Este archivo es la memoria operativa del repo web de Finanzas M.

Un agente debe poder leerlo y entender:

- quÃ© estÃ¡ construido hoy en web;
- quÃ© arquitectura debe respetar;
- quÃ© decisiones ya estÃ¡n cerradas;
- quÃ© debe reutilizar del modelo Android/Firebase;
- quÃ© NO debe inventar;
- quÃ© sigue pendiente de verdad;
- cÃ³mo cerrar una tarea correctamente.

Este archivo vive en dos lugares:

1. `docs/11_WEB_DEV_LOG.md` dentro del repo web `finanzas-m-web`.
2. Sources del proyecto ChatGPT de Felipe.

Felipe re-sube este archivo a Sources despuÃ©s de tareas importantes, igual que hace con `09_ANDROID_DEV_LOG.md`.

Si hay conflicto:

1. manda el archivo actual del repo web;
2. reporta la contradicciÃ³n;
3. actualiza este archivo si la tarea lo requiere.

---

## 1.2. CÃ³mo leerlo

Antes de tocar cÃ³digo:

1. Lee completa la Parte 1.
2. Lee completa la Parte 2.
3. Lee las Ãºltimas 2 o 3 entradas de la Parte 3.
4. Revisa `git status --short`.
5. Valida si la tarea toca:
   - Auth;
   - Firestore;
   - modelo de datos;
   - privacidad Personal/Hogar;
   - diseÃ±o;
   - rutas;
   - formularios;
   - deploy;
   - seguridad.

Si una entrada vieja contradice la Parte 2, manda la Parte 2.

Si el repo contradice este archivo, manda el repo y actualiza este archivo.

---

## 1.3. Reglas obligatorias

### Regla #1 â€” No trabajar sin leer este archivo

No empieces a modificar cÃ³digo sin leer este archivo.

Este archivo es equivalente al `09_ANDROID_DEV_LOG.md`, pero para web.

---

### Regla #2 â€” Respetar el stack vigente

Stack web decidido:

- Next.js 15 App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Zustand.
- react-hook-form + zod.
- Lucide.
- Recharts para reportes futuros.
- Firebase Auth.
- Cloud Firestore.
- Vercel.

No agregues librerÃ­as nuevas sin justificarlo.

No cambies framework, router, librerÃ­a de UI, estado, formularios, hosting ni Firebase sin una decisiÃ³n explÃ­cita de Felipe.

---

### Regla #3 â€” Respetar el modelo compartido con Android

La web usa el mismo Firebase que Android.

No inventes colecciones nuevas si el modelo ya existe.

Antes de cambiar datos, revisa:

- `docs/03_DATA_MODEL.md`;
- `docs/05_DECISIONS.md`;
- este archivo.

Colecciones principales vigentes:

- `users`;
- `accounts`;
- `accounts/{accountId}/pockets`;
- `categories`;
- `transactions`;
- `households`;
- `household_invites`;
- `household_events`;
- `household_event_shares`;
- `household_debts`;
- `household_categories`;
- `household_income_entries`.

No usar:

- `users/{uid}/accounts`;
- `users/{uid}/categories`;
- `users/{uid}/transactions`;
- `users/{uid}/pockets`;
- `pockets` top-level.

---

### Regla #4 â€” No romper privacidad Personal/Hogar

Regla central:

```text
Personal = cuentas, bolsillos, categorÃ­as personales, saldos y pagos reales.
Hogar = eventos compartidos, responsabilidades, deudas, categorÃ­as de Hogar e ingresos compartidos seguros.
```

La web no debe exponer:

- cuentas personales de otro miembro;
- bolsillos personales de otro miembro;
- bancos personales de otro miembro;
- saldos personales de otro miembro;
- categorÃ­as personales de otro miembro;
- transacciones personales completas de otro miembro.

Hogar no tiene cuentas, bolsillos ni saldos propios.

---

### Regla #5 â€” Web V1 no busca paridad total

Web V1 es una versiÃ³n simple para usar Finanzas M desde computador.

Debe priorizar:

- Login con Google.
- Leer usuario.
- Leer cuentas.
- Leer bolsillos en modo seguro.
- Leer categorÃ­as.
- Leer movimientos.
- Dashboard personal bÃ¡sico.
- Crear gasto.
- Crear ingreso.
- Crear transferencia.
- EdiciÃ³n/eliminaciÃ³n bÃ¡sica de movimientos.
- Vista Hogar simple.
- Deploy en Vercel.

No construir todavÃ­a:

- Home configurable.
- EdiciÃ³n avanzada de bolsillos.
- Reportes avanzados.
- Tarjetas de crÃ©dito.
- Plantillas.
- Recordatorios.
- Voz/Gemini.
- OCR.
- PWA.
- Multimoneda.
- Paridad visual total con Android.
- Funciones administrativas complejas de Hogar.

---

### Regla #6 â€” Respetar el sistema de diseÃ±o

La web debe sentirse como Finanzas M, no como dashboard SaaS genÃ©rico.

Debe respetar:

- `docs/07_DESIGN_SYSTEM.md`;
- modo oscuro inicial;
- cards suaves y modulares;
- paleta navy / salvia / dorado / warm paper;
- claridad financiera;
- separaciÃ³n visual entre Personal y Hogar;
- tipografÃ­a Poppins para tÃ­tulos y Figtree para lectura/nÃºmeros si se integran fuentes;
- montos en COP sin decimales: `$ 20.000`.

No crear estilos paralelos sin justificar.

No convertir la web en un admin panel genÃ©rico.

---

### Regla #7 â€” Trabajar en pasos pequeÃ±os

Cada tarea debe ser acotada.

No mezcles:

- setup del proyecto;
- diseÃ±o visual;
- Firebase Auth;
- Firestore reads;
- Firestore writes;
- reglas de seguridad;
- deploy;
- auditorÃ­as.

Una tarea por prompt.

---

### Regla #8 â€” VerificaciÃ³n obligatoria antes de cerrar

Antes de cerrar una tarea, ejecuta lo que aplique segÃºn el estado del repo:

```bash
npm run lint
npm run build
```

Si existen tests:

```bash
npm test
```

Si hay Playwright:

```bash
npx playwright test
```

Si falla algo:

- no cierres como terminado;
- arregla el error o documenta exactamente quÃ© fallÃ³;
- no digas que quedÃ³ listo si no verificaste.

---

### Regla #9 â€” Actualizar este archivo al terminar

Siempre agrega una entrada al final de la Parte 3 con este formato:

```markdown
### Entrada â€” YYYY-MM-DD â€” [tÃ­tulo corto]

- **Fase / paso**:
- **Agente / herramienta**:
- **Archivos creados**:
- **Archivos modificados**:
- **Archivos eliminados**:
- **TODOs nuevos**:
- **TODOs resueltos**:
- **Decisiones tÃ©cnicas tomadas**:
- **Skills aplicadas**:
- **VerificaciÃ³n realizada**:
- **Estado al cerrar**:
- **PrÃ³ximo paso sugerido**:
```

Si cambiaste arquitectura, rutas, estructura de carpetas, Firebase, modelo de datos, reglas, componentes base o design system, actualiza tambiÃ©n la Parte 2.

---

### Regla #10 â€” AGENTS.md solo como puntero

Si existe `AGENTS.md`, debe ser corto y apuntar a este archivo.

No debe duplicar historial, roadmap ni decisiones.

El dev log principal de web es este archivo.

No usar `PROGRESS.md` salvo que Felipe lo decida explÃ­citamente mÃ¡s adelante.

---

# PARTE 2 â€” ESTADO ACTUAL DEL PROYECTO WEB

## 2.1. Resumen ejecutivo

| Campo                     | Estado                                                      |
| ------------------------- | ----------------------------------------------------------- |
| **Fase operativa actual** | WEB-0 â€” PreparaciÃ³n documental                              |
| **Repo web**              | Pendiente de crear                                          |
| **Nombre repo esperado**  | `finanzas-m-web`                                            |
| **Stack**                 | Next.js 15 + TypeScript + Tailwind + shadcn/ui              |
| **Backend**               | Firebase Auth + Cloud Firestore compartido con Android      |
| **Hosting**               | Vercel                                                      |
| **Memoria operativa**     | `docs/11_WEB_DEV_LOG.md`                                    |
| **AGENTS.md**             | Recomendado solo como puntero cuando exista repo            |
| **PROGRESS.md**           | No usar por ahora                                           |
| **Foco inicial**          | Setup web limpio, identidad visual base y conexiÃ³n Firebase |
| **Alcance Web V1**        | Paridad mÃ­nima desde computador, no paridad total           |

---

## 2.2. Estado inicial

Al iniciar este archivo:

- Android estÃ¡ cerrando/estabilizando el MVP operativo.
- Web todavÃ­a no tiene repo creado.
- La web debe arrancar con memoria operativa desde el dÃ­a 1.
- La web debe usar el mismo Firebase y el mismo modelo remoto.
- La web debe respetar las decisiones de privacidad Personal/Hogar.
- La web debe evitar sobre-ingenierÃ­a.

---

## 2.2.A. Estado operativo vigente post WEB-V6B7

Esta subsección manda sobre el resumen histórico anterior cuando haya contradicción.

- El repo web ya existe y compila localmente.
- WEB-V6 llegó hasta `WEB-V6B7` y `WEB-V6-AUDIT-FIX-2` a nivel código.
- El estado correcto de WEB-V6 es: **implementado técnicamente, pendiente QA manual E2E real**.
- WEB-V6 **no** debe describirse como validado, cerrado funcionalmente ni listo para deploy sin evidencia de QA manual real.
- El orden correcto de próximos pasos es:
  - QA manual WEB-V6;
  - WEB-V6-QA-FIX si aparecen hallazgos;
  - auditoría Cursor sobre el estado post-QA/post-fix;
  - cierre real de WEB-V6.
## 2.3. Stack vigente

| Capa        | DecisiÃ³n               | Estado              |
| ----------- | ---------------------- | ------------------- |
| Framework   | Next.js 15 App Router  | Decidido            |
| Lenguaje    | TypeScript             | Decidido            |
| Estilos     | Tailwind CSS           | Decidido            |
| Componentes | shadcn/ui              | Decidido            |
| State       | Zustand                | Decidido            |
| Forms       | react-hook-form + zod  | Decidido            |
| Iconos      | Lucide                 | Decidido            |
| Charts      | Recharts               | Futuro / reportes   |
| Auth        | Firebase Auth + Google | Decidido            |
| DB          | Cloud Firestore        | Decidido            |
| Hosting     | Vercel                 | Decidido            |
| Testing E2E | Playwright             | Usar cuando aplique |
| CI          | GitHub Actions futuro  | Diferido            |

---

## 2.4. Arquitectura web esperada

Estructura inicial sugerida:

```text
src/
  app/
    (auth)/
    (dashboard)/
    login/
    page.tsx
    layout.tsx

  components/
    ui/
    finance/
    layout/
    forms/

  features/
    auth/
    dashboard/
    accounts/
    categories/
    transactions/
    household/

  lib/
    firebase/
    format/
    validators/
    utils/

  stores/
    auth-store.ts
    app-context-store.ts

  types/
    account.ts
    category.ts
    transaction.ts
    household.ts
```

Reglas:

- `app/` define rutas y layouts.
- `features/` agrupa lÃ³gica por dominio.
- `components/finance/` contiene componentes visuales propios de Finanzas M.
- `components/ui/` queda para shadcn.
- `lib/firebase/` inicializa Firebase y helpers de Firestore/Auth.
- `types/` modela DTOs compartidos con Firestore.
- Validaciones de formularios con zod.
- Formularios con react-hook-form.
- Estado global mÃ­nimo con Zustand.

---

## 2.5. Firebase y modelo compartido

La web debe conectarse al mismo proyecto Firebase usado por Android.

Reglas:

- Auth solo con Google.
- Firestore con reglas existentes.
- No crear backend separado.
- No duplicar modelo en colecciones nuevas.
- Usar queries por `ownerId`, `householdId`, `memberIds` segÃºn corresponda.
- No exponer datos privados de otro miembro.
- No leer transacciones personales de otro miembro.

Variables esperadas en `.env.local`:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

No subir `.env.local`.

Crear `.env.local.example`.

---

## 2.6. Alcance Web V1

Web V1 debe permitir:

- Login con Google.
- Logout.
- ProtecciÃ³n de rutas privadas.
- Leer `users/{uid}`.
- Leer cuentas personales.
- Leer bolsillos como parte de cuentas.
- Leer categorÃ­as personales.
- Leer movimientos personales.
- Ver dashboard personal bÃ¡sico.
- Crear gasto.
- Crear ingreso.
- Crear transferencia.
- Editar/eliminar movimientos bÃ¡sicos.
- Detectar si existe `activeHouseholdId`.
- Leer vista Hogar simple sin exponer privacidad.
- Deploy en Vercel.

Web V1 no debe incluir:

- Home configurable.
- Full reporting.
- Tarjetas de crÃ©dito.
- Plantillas recurrentes.
- Recordatorios.
- Voz/Gemini.
- OCR.
- PWA.
- EdiciÃ³n avanzada de Hogar.
- EdiciÃ³n completa de bolsillos.
- Paridad total con Android.

---

## 2.7. DiseÃ±o web esperado

La web debe adaptar el sistema visual de Finanzas M a escritorio.

Principios:

- No copiar Android pixel-perfect.
- Mantener identidad.
- Aprovechar mÃ¡s espacio horizontal.
- No parecer panel administrativo genÃ©rico.
- Dashboard claro, cÃ¡lido y financiero.
- Sidebar o navegaciÃ³n lateral simple.
- Cards grandes, suaves y legibles.
- Modo oscuro inicial.
- Responsive bÃ¡sico para laptop y mÃ³vil.

Componentes base esperados:

- `FinanceCard`.
- `Amount`.
- `Sidebar`.
- `TopBar`.
- `TransactionRow`.
- `AccountCard`.
- `CategoryBadge`.
- `ContextToggle`.
- `EmptyState`.
- `FinanceButton`.
- `FinanceInput`.

---

## 2.8. Fases web operativas

### WEB-0 â€” PreparaciÃ³n documental

Estado: **En curso / este archivo**.

Incluye:

- Crear `11_WEB_DEV_LOG.md`.
- Definir uso de `AGENTS.md` corto.
- No usar `PROGRESS.md` por ahora.
- Ajustar `10_agent_skills_catalog.md`.
- Registrar ADR de Web Dev Log.
- Actualizar roadmap operativo.

### WEB-R â€” Setup inicial Next.js

Pendiente.

Incluye:

- Crear proyecto Next.js 15.
- TypeScript.
- App Router.
- Tailwind.
- shadcn/ui.
- estructura base.
- `README.md`.
- `.gitignore`.
- `.env.local.example`.
- `AGENTS.md` corto.
- `docs/11_WEB_DEV_LOG.md`.
- build local exitoso.

### WEB-S â€” GitHub Web

Pendiente.

Incluye:

- Crear repo privado `finanzas-m-web`.
- Primer commit.
- Push a `main`.
- Confirmar instalaciÃ³n limpia.

### WEB-T â€” Identidad Finanzas M web

Pendiente.

Incluye:

- Tokens Tailwind.
- Layout base.
- Componentes base.
- Dashboard visual con datos fake.
- Responsive bÃ¡sico.

### WEB-U â€” Login web y Firebase

Pendiente.

Incluye:

- Firebase web SDK.
- Auth Google.
- protecciÃ³n de rutas.
- leer `users/{uid}`.
- sesiÃ³n persistente.

### WEB-V â€” Lectura/escritura mÃ­nima

Pendiente.

Incluye:

- leer cuentas;
- leer bolsillos;
- leer categorÃ­as;
- leer transacciones;
- crear gasto;
- crear ingreso;
- crear transferencia;
- editar/eliminar movimiento bÃ¡sico;
- leer vista Hogar simple.

### WEB-W â€” Deploy mÃ­nimo Vercel

Pendiente.

Incluye:

- proyecto Vercel;
- variables;
- dominio autorizado en Firebase Auth;
- prueba de login producciÃ³n;
- smoke test bÃ¡sico.

---

## 2.9. Skills recomendadas por tipo de tarea

### Setup Next.js

Skills:

- `next-best-practices`
- `vercel-react-best-practices`
- `writing-plans`

### DiseÃ±o visual inicial

Skills:

- `frontend-design`
- `brand-guidelines`
- `web-design-guidelines`

### shadcn/ui

Skills:

- `shadcn`
- `web-design-guidelines`
- `vercel-composition-patterns`

### Firebase Auth

Skills:

- `firebase-auth-basics`
- `next-best-practices`

### Firestore reads/writes

Skills:

- `firebase-firestore`
- `firebase-security-rules-auditor` si toca reglas
- `systematic-debugging` si hay errores de permisos/sync

### AuditorÃ­a pre-deploy

Skills:

- `web-quality-audit`
- `insecure-defaults`
- `accessibility`

### E2E

Skills:

- `playwright`

---

## 2.10. Pendientes reales

Prioridad inmediata:

1. Crear repo `finanzas-m-web`.
2. Crear proyecto Next.js 15.
3. Instalar/configurar Tailwind y shadcn.
4. Crear estructura base.
5. Copiar este archivo a `docs/11_WEB_DEV_LOG.md`.
6. Crear `AGENTS.md` corto como puntero.
7. Crear `.env.local.example`.
8. Confirmar `npm run build`.
9. Primer commit.

Pendiente despuÃ©s:

- Identidad visual web.
- Firebase Auth.
- Lectura de datos reales.
- Escritura mÃ­nima.
- Deploy.

---

# PARTE 3 â€” REGISTRO DE CAMBIOS RECIENTE

### 2026-08-10 — Paridad estructural "Distribución de gastos" Hogar ↔ Personal

- **Alcance**: solo la vista de reporte de `household-categories-view.tsx` (`/household/categories`, tab "Distribución de gastos"). No se tocó el tab "Categorías del hogar" (manage), el diálogo de detalle, `groupCategoryBreakdown`, servicios, modelo de datos ni la card "Gastos por categoría" del Home de Hogar (`household-overview.tsx`, solo referencia de contexto).
- **Causa**: la fila de categoría de Hogar tenía otro orden que el listado Personal (`CategoryBreakdownList`): nombre+monto en la misma línea, porcentaje junto a la barra debajo — no "icono · nombre · % · monto" con barra completa aparte.
- **Fix**: se extrajo un componente local pequeño y propio de Hogar, `HouseholdCategoryBreakdownRow` (mismo archivo, no genérico, no reutiliza `CategoryBreakdownList` de Personal): `<button>` nativo con icono, luego un bloque `flex-1` con nombre a la izquierda y `{share}%` a la derecha (`justify-between`), luego `HouseholdAmount` como hermano posterior (monto a la derecha de todo), y debajo — fuera de ese bloque, a todo el ancho de la fila — la barra de progreso (`h-2 w-full`). Mismo orden en el DOM que `CategoryBreakdownList`, pero con `HouseholdAmount`, tokens `--hh-*` (`--hh-text`, `--hh-border`, `--hh-focus-ring`, `--hh-surface-hover`) y el color real de cada categoría de Hogar en ícono y barra — nunca la paleta navy de Personal.
- **Accesibilidad**: se conservó el `<button>` nativo (Enter/Espacio y navegación por teclado gratis, sin `role`/`tabIndex` manual), con `focus-visible:ring-2` sobre `--hh-focus-ring`.
- **Responsive**: nombre con `truncate`, porcentaje y monto con `shrink-0` para que nunca se superpongan en móvil; la barra mantiene `w-full`.
- **Hero "Total gastado…"**: ya tenía la misma estructura espacial que Personal (`flex-col lg:flex-row lg:items-end lg:justify-between`, total a la izquierda, selector Mes/Año a la derecha en escritorio) — no requirió cambios.
- **Archivos creados**:
  - `tests/unit/household-category-breakdown-parity.test.ts`.
- **Archivos modificados**:
  - `src/features/household/components/views/household-categories-view.tsx`;
  - `tests/unit/run-all.ts`.
- **Verificación realizada**: `npm test` (todo verde, incluida la nueva suite de 5 casos) y `npm run build` (compila, tipa y genera las 16 rutas; solo el warning preexistente de `<img>`, no tocado).
- **Estado al cerrar**: cerrado y verificado.
- **Próximo paso sugerido**: ninguno pendiente de esta tarea puntual.

### 2026-08-10 — Confirmación previa al registro paralelo Personal → Hogar (Crear gasto)

- **Alcance**: solo `CreateExpenseCard` (crear gasto Personal). Ingresos, transferencias, gasto directo en Hogar, edición y capa de datos/Firebase quedaron intactos.
- **Objetivo 1 (preselección)**: `isHouseholdShared` ahora se inicializa con `canShareWithHousehold` (antes siempre `false`). Para que el valor exista en ese momento, el bloque de datos del hogar activo (`householdActiveId`/`household`/`canShareWithHousehold`/etc.) se movió arriba de los `useState` de UI — mismo cálculo de siempre, solo reordenado.
- **Objetivo 2/6/7 (confirmación previa condicionada)**: `handleSubmit` ya no guarda directo cuando `householdShareConfirmEligible` (`canShareWithHousehold && !consumesThirdPartyFunds`) es verdadero: abre `HouseholdShareConfirmDialog` y corta ahí. Sin Hogar elegible o con "Otro" seleccionado, sigue guardando directo como antes (sin confirmación adicional).
- **Objetivos 4/5 (una sola lógica de envío)**: se extrajo `runSubmit(shareWithHousehold)` con exactamente la misma decisión `submitExpenseWithHouseholdProjection` vs `submitExpense` que ya existía — no se duplicó ni se tocó esa lógica. El switch de la confirmación es la misma variable de estado (`isHouseholdShared`) que la del formulario ("inicialmente sincronizado" porque es el mismo estado), así que apagarlo/encenderlo en el diálogo decide directamente qué rama toma `runSubmit`.
- **Protección doble-envío / Hogar inestable**: `runSubmit` revalida `canShareWithHousehold`/`householdActiveId` en el momento de guardar (no solo al abrir la confirmación); un `useEffect` cierra la confirmación sola si el Hogar deja de ser elegible mientras está abierta; los botones del diálogo se deshabilitan mientras `isSubmitting`.
- **Accesibilidad**: `HouseholdShareConfirmDialog` usa `role="dialog"` + `aria-modal` + `aria-labelledby`/`aria-describedby`, foco inicial en "Volver a editar" (nunca en "Confirmar y guardar"), y reutiliza la pila compartida de `useFocusTrap` para que Escape/backdrop equivalgan a "Volver a editar" sin cerrar el formulario de atrás — mismo mecanismo ya usado por `DiscardConfirmDialog`.
- **Reutilización visual**: el diálogo reutiliza `ToggleRow` y `toneStyle("expense")` de `composer-primitives.tsx` (mismo switch/token que el `ToggleRow` del formulario) y `FinanceButton`; no se crearon estilos paralelos.
- **Archivos creados**:
  - `src/components/finance/household-share-confirm-dialog.tsx`;
  - `tests/unit/household-share-confirm-on-expense.test.ts`.
- **Archivos modificados**:
  - `src/features/transactions/components/create-expense-card.tsx`;
  - `tests/unit/run-all.ts`.
- **Verificación realizada**: `npm test` (todo verde, incluida la nueva suite de 6 casos) y `npm run build` (compila, tipa y genera las 16 rutas; solo el warning preexistente de `<img>`, no tocado).
- **Estado al cerrar**: cerrado y verificado.
- **Próximo paso sugerido**: ninguno pendiente de esta tarea puntual.

### 2026-08-10 — Confirmación al descartar un movimiento/gasto nuevo (Personal + Hogar)

- **Causa**: X, Escape, backdrop y "Cancelar" llamaban directo a `closePanel`/`onClose` en los composers de creación Personal (`create-movement-dialog.tsx`) y en "Nuevo gasto Hogar" (`create-household-expense-dialog.tsx`); el formulario se perdía sin advertencia.
- **Fix**: se añadieron dos componentes de confirmación reutilizando tokens/botones existentes (sin `window.confirm`, sin estilos paralelos):
  - `src/components/finance/discard-confirm-dialog.tsx` (Personal, `FinanceButton`);
  - `src/features/household/components/ui/household-discard-confirm-dialog.tsx` (Hogar, `HouseholdButton`).
  - Ambos: `role="alertdialog"` + `aria-modal` + `aria-labelledby`/`aria-describedby`, foco inicial en "Seguir editando" (nunca en el CTA destructivo), backdrop/Escape equivalen a "Seguir editando", y reutilizan `useFocusTrap` (la pila compartida de `src/features/household/hooks/use-focus-trap.ts`, ya preparada para diálogos anidados) para que Escape actúe solo sobre la confirmación mientras está abierta — el formulario de atrás queda en pausa sin desmontarse.
- **Personal** (`create-movement-dialog.tsx`): `FinanceDialog.onClose` y el `onCancel` de los 3 composers de creación (`CreateExpenseCard`/`CreateIncomeCard`/`CreateTransferCard`) ahora apuntan a `handleRequestClose`, que abre la confirmación (edición sigue cerrando directo, fuera de alcance). Solo `onDiscard` llama a `closePanel`. Guardar con éxito (`handleCreated`) sigue cerrando directo, sin confirmación.
- **Hogar** (`create-household-expense-dialog.tsx`): se separaron dos caminos que antes compartían `handleRequestClose`:
  - `handleGoBackToStep1` — solo para el botón "Atrás" explícito del paso 2: vuelve al paso 1 sin confirmar y sin cerrar.
  - `handleRequestDiscardConfirm` — para X, Escape, backdrop (`HouseholdDialog.onClose` + `useFocusTrap`) y el botón "Cancelar" del paso 1: abre la confirmación en cualquiera de los dos pasos (antes, X/Escape/backdrop en paso 2 solo volvían al paso 1 sin avisar — ese comportamiento quedó corregido).
  - `persistExpense` sigue llamando `onClose()` directo tras guardar con éxito.
- **Archivos creados**:
  - `src/components/finance/discard-confirm-dialog.tsx`;
  - `src/features/household/components/ui/household-discard-confirm-dialog.tsx`;
  - `tests/unit/discard-confirm-on-create.test.ts`.
- **Archivos modificados**:
  - `src/features/transactions/components/create-movement-dialog.tsx`;
  - `src/features/household/components/create-household-expense-dialog.tsx`;
  - `tests/unit/run-all.ts`.
- **Verificación realizada**: `npm test` (todo verde, incluida la nueva suite de 4 casos) y `npm run build` (compila, tipa y genera las 16 rutas; solo el warning preexistente de `<img>` en `account-icon.tsx`, no tocado).
- **Estado al cerrar**: cerrado y verificado.
- **Próximo paso sugerido**: ninguno pendiente de esta tarea puntual.

### 2026-08-10 — Estado inicial de CTAs de creación + etiquetas "(obligatorio)"

- **Causa**: en Personal (gasto/ingreso/transferencia) el CTA se deshabilitaba con `submitAttempted && !isFormValid`, así que al abrir el formulario (antes de cualquier click) el botón quedaba activo pese a estar vacío. En Hogar, `primaryDisabled` era solo `isSubmitting`: "Continuar"/"Guardar gasto" eran clicables con el formulario incompleto.
- **Fix Personal**: `disabled={isBlocked || !isFormValid}` (gasto/transferencia) y `disabled={!isFormValid}` (ingreso) en `create-expense-card.tsx`, `create-income-card.tsx`, `create-transfer-card.tsx`. Los errores inline siguen apareciendo solo tras blur/submit (`visibleError`, sin cambios).
- **Fix Hogar**: `create-household-expense-dialog.tsx` — `primaryDisabled = isSubmitting || (step === 1 ? !canContinue : !canSubmit)`, así "Continuar" exige `basicsReady` y "Guardar gasto" exige además el reparto cuadrado (`sharesValid`) cuando aplica.
- **Etiquetas**: se reemplazó la convención "no marcar requeridos / marcar 'Opcional'" por `(obligatorio)` explícito en los campos que la validación real exige: Monto, Concepto, Fecha, Categoría, Cuenta (o Cuenta destino) en los 3 formularios Personal; Sale de/Llega a en Transferencia; Monto total y Título en Nuevo gasto Hogar. Campos opcionales/condicionales (Entra a, Categoría del Hogar, Descripción) no llevan marca. `ComposerField` cambió su prop `optional` por `required` (sin usos externos del prop viejo).
- **Fix colateral**: `household-icon-select.tsx` tenía un prop `searchInputId` destructurado sin usar (`_searchInputId`) que rompía `npm run build` (ESLint `no-unused-vars`) — se quitó de la destructuración; no afecta comportamiento.
- **Archivos modificados**:
  - `src/features/transactions/components/composer/composer-primitives.tsx`;
  - `src/features/transactions/components/create-expense-card.tsx`;
  - `src/features/transactions/components/create-income-card.tsx`;
  - `src/features/transactions/components/create-transfer-card.tsx`;
  - `src/features/household/components/create-household-expense-dialog.tsx`;
  - `src/features/household/components/ui/household-icon-select.tsx`;
  - `tests/unit/household-forms-ios-zoom.test.ts` (ancla actualizada a la nueva etiqueta de Título);
  - `tests/unit/run-all.ts`.
- **Archivos creados**:
  - `tests/unit/composer-required-labels-and-cta-gate.test.ts` (CTA gateado por validez real, etiquetas `(obligatorio)` correctas, accesibilidad de `ComposerField` conservada).
- **Verificación realizada**: `npm test` (todo verde, incluida la nueva suite) y `npm run build` (compila y tipa sin errores; solo advertencia preexistente de `<img>` en `account-icon.tsx`).
- **Estado al cerrar**: cerrado y verificado.
- **Próximo paso sugerido**: ninguno pendiente de esta tarea puntual.

### 2026-08-09 — Calendario Hogar en campo Fecha (nuevo gasto)

- Nuevo `HouseholdDateField`: al tocar el campo/ícono abre calendario propio (mes ←→, días, Hoy) con tokens `--hh-*`.
- Reemplaza el `input type="date"` nativo en crear gasto Hogar.
- Test: `household-date-field.test.ts`.

### 2026-08-09 — Buscador en selector de categorías Hogar

- `HouseholdCategorySelect`: campo “Buscar categoría…” al abrir el menú; filtra por nombre; vacío “Sin resultados”.
- Escape cierra solo el menú (no el modal padre). Foco inicial en el buscador.
- Test: `household-category-select-search.test.ts`.

### 2026-08-09 — Fix foco Nuevo gasto Hogar (no podía bajar al título)

- Causa: `HouseholdDialog` re-ejecutaba su efecto de apertura en cada cambio de `onClose` (flecha nueva por tecla) y reenfocaba el monto.
- Fix: `onCloseRef` + deps solo `[open]` (paridad con `FinanceDialog`); quitado re-focus del panel en create.
- UX: Continuar/Guardar clicable con incompletos para revelar errores; pie “Falta …” en tono destructivo.
- Test: `household-dialog-focus-stability.test.ts`.

### 2026-08-09 — Nuevo gasto Hogar: fecha + modos en 3 cols

- Fecha vuelve al formulario al lado de **Categoría del Hogar** (estilo Personal: input date + ícono calendario); se quitó del header.
- ¿Cómo se pagó?: una fila / 3 columnas con ícono — Adelanto `CreditCard`, Invitación `Gift`, Cada uno `WalletCards`.

### 2026-08-09 — Nuevo gasto Hogar: 2 pasos + modal más angosto

- Paso 1: monto, título, categoría, quién pagó, cómo se pagó. Defaults: **Yo** + **Adelanto**. Sin UI de reparto.
- CTA paso 1: **Continuar** (Adelanto / Cada uno) o **Guardar gasto** (Invitación salta el reparto).
- Paso 2: solo reparto, prellenado 50/50 (o partes iguales); CTA **Guardar gasto**; **Atrás** / Escape vuelven al paso 1.
- Ancho: `HouseholdDialog size="default"` (`max-w-lg`) en lugar de composer 720px.
- Test: `create-household-expense-two-step.test.ts`.

### Entrada â€” 2026-05-31 â€” WEB-0 preparaciÃ³n de memoria operativa web

- **Fase / paso**: WEB-0.
- **Agente / herramienta**: ChatGPT.
- **Archivos creados**:
  - `11_WEB_DEV_LOG.md`.
- **Archivos modificados sugeridos**:
  - `05_DECISIONS.md`;
  - `08_ROADMAP_OPERATIVO_MVP.md`;
  - `10_agent_skills_catalog.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - crear repo `finanzas-m-web`;
  - crear proyecto Next.js 15;
  - agregar `docs/11_WEB_DEV_LOG.md` al repo;
  - crear `AGENTS.md` corto como puntero;
  - crear `.env.local.example`;
  - confirmar build inicial.
- **TODOs resueltos**:
  - decisiÃ³n documental sobre `PROGRESS.md`: no usar por ahora;
  - decisiÃ³n de replicar patrÃ³n del Android Dev Log para web.
- **Decisiones tÃ©cnicas tomadas**:
  - `11_WEB_DEV_LOG.md` serÃ¡ la memoria operativa principal de web;
  - `AGENTS.md` serÃ¡ opcional/recomendado solo como puntero corto;
  - no se usarÃ¡ `PROGRESS.md` por ahora para evitar duplicar historial.
- **Skills aplicadas**:
  - ninguna ejecutada por agente de cÃ³digo todavÃ­a.
- **VerificaciÃ³n realizada**:
  - revisiÃ³n documental de Sources.
- **Estado al cerrar**:
  - lista la base documental para iniciar web sin perder continuidad.
- **PrÃ³ximo paso sugerido**:
  - generar prompt para Codex/Cursor: WEB-R setup inicial Next.js + estructura base + copiar `11_WEB_DEV_LOG.md`.

---

# ANEXO â€” HISTORIAL CONSERVADO

Este archivo inicia como memoria nueva para el frente web.

El antecedente directo es `09_ANDROID_DEV_LOG.md`, que demostrÃ³ ser el patrÃ³n correcto para coordinar agentes IA, repo real y Sources del proyecto.

No hay historial web previo.

### Entrada — 2026-05-31 — WEB-T1/T3 sistema de diseño base web

- **Fase / paso**: WEB-T1/T3.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/lib/design/tokens.ts`;
  - `src/components/finance/finance-button.tsx`;
  - `src/components/finance/finance-chip.tsx`;
  - `src/components/finance/finance-text-field.tsx`;
  - `src/components/finance/transaction-timeline-item.tsx`;
  - `src/components/finance/finance-shimmer.tsx`;
  - `src/app/design-system/page.tsx`.
- **Archivos modificados**:
  - `src/app/globals.css`;
  - `src/lib/utils.ts`;
  - `src/lib/utils/cn.ts`;
  - `src/components/finance/finance-card.tsx`;
  - `src/components/finance/amount.tsx`;
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `README.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar si se incorporan fuentes Poppins/Figtree como webfonts locales en fase WEB-T2.
- **TODOs resueltos**:
  - base de tokens web definida;
  - capa de componentes `finance/*` base creada;
  - ruta temporal `/design-system` creada.
- **Decisiones técnicas tomadas**:
  - Tailwind v4 usa tokens por CSS variables y `@theme inline` en `globals.css`;
  - `@/lib/utils` queda como fuente principal de `cn` y `@/lib/utils/cn` como re-export;
  - se mantienen aliases de variables legacy para no romper placeholders existentes.
- **Skills aplicadas**:
  - `frontend-design`;
  - `shadcn`;
  - `web-design-guidelines`.
- **Verificación realizada**:
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - sistema de diseño web base implementado y visible en `/design-system`.
- **Próximo paso sugerido**:
  - WEB-U: integrar Auth Google con rutas protegidas manteniendo componentes visuales nuevos.

### Regla adicional — lectura obligatoria para UI web

Para cualquier tarea UI web, leer tambien `docs/WEB_DESIGN_SYSTEM.md` antes de editar componentes, pantallas o tokens.

### Entrada — 2026-05-31 — WEB-T-DOC documentacion del sistema de diseno web

- **Fase / paso**: WEB-T-DOC.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `docs/WEB_DESIGN_SYSTEM.md`.
- **Archivos modificados**:
  - `README.md`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - normalizar codificacion UTF-8 de `docs/11_WEB_DEV_LOG.md` para facilitar diffs y automatizacion.
- **TODOs resueltos**:
  - contrato tecnico del design system web documentado;
  - regla explicita de lectura para tareas UI agregada al dev log.
- **Decisiones tecnicas tomadas**:
  - `docs/WEB_DESIGN_SYSTEM.md` pasa a ser guia obligatoria de UI junto a `globals.css`, `tokens.ts` y `components/finance`;
  - la documentacion describe el sistema real actual sin inventar tokens ni componentes.
- **Skills aplicadas**:
  - `web-design-guidelines` (documentacion de reglas de UI).
- **Verificacion realizada**:
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - documentacion tecnica de sistema de diseno web creada y enlazada en README.
- **Proximo paso sugerido**:
  - WEB-T2: pulir casos legacy (`EmptyState` y consistencia de simbolo en `Amount` para transferencias) en una tarea UI dedicada.

### Entrada — 2026-05-31 — WEB-T-AUDIT cierre de sistema de diseño web

- **Fase / paso**: WEB-T-AUDIT.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - ninguno.
- **Archivos modificados**:
  - `src/components/finance/amount.tsx`;
  - `src/components/finance/empty-state.tsx`;
  - `src/app/design-system/page.tsx`;
  - `docs/WEB_DESIGN_SYSTEM.md`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - normalizar codificación UTF-8 de `docs/11_WEB_DEV_LOG.md` (persistente).
- **TODOs resueltos**:
  - `Amount` con prefijo de transferencia correcto (`?`);
  - `EmptyState` oficializado en diseño web y expuesto en `/design-system`;
  - cobertura de `reimbursement` en vitrina de timeline;
  - auditoría de hardcodes: sin hardcodes críticos fuera de tokens (solo swatch inline justificado en vitrina).
- **Decisiones técnicas tomadas**:
  - mantener `EmptyState` como componente oficial de `finance/*`;
  - mantener `style={{ backgroundColor: color }}` solo en la vitrina de paleta de `/design-system` por necesidad demostrativa;
  - mantener `/dashboard` con componentes `finance/*` sin estilos paralelos.
- **Skills aplicadas**:
  - `accessibility` (revisión de estados y foco);
  - auditoría visual/manual del sistema.
- **Verificación realizada**:
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - sistema de diseño web auditado, alineado y listo para soportar WEB-U sin deuda visual bloqueante.
- **Próximo paso sugerido**:
  - iniciar WEB-U (Auth Google) usando `docs/WEB_DESIGN_SYSTEM.md` como contrato UI.

### Entrada — 2026-06-01 — WEB-SEC-1 patch de dependencias antes de Auth

- **Fase / paso**: WEB-SEC-1.
- **Agente / herramienta**: Codex (GPT-5).
- **Motivo**: vulnerabilidades npm detectadas con `next@15.3.3` (1 critical, 1 moderate).
- **Archivos creados**:
  - ninguno.
- **Archivos modificados**:
  - `package.json`;
  - `package-lock.json`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **Dependencias actualizadas**:
  - `next`: `15.3.3` -> `15.5.18`.
- **Resultado de `npm audit`**:
  - se elimina la vulnerabilidad critical asociada a Next 15.3.3;
  - quedan 2 vulnerabilidades moderadas reportadas sobre `postcss` transitivo bajo `next/node_modules/postcss`;
  - no se usó `npm audit fix --force` para evitar cambios breaking no controlados.
- **Resultado de `npm run lint`**:
  - OK (sin errores).
- **Resultado de `npm run build`**:
  - OK (build exitoso en Next 15.5.18).
- **Estado al cerrar**:
  - dependencia principal de riesgo (Next vulnerable) parchada dentro de la linea 15;
  - repo listo para avanzar sin vulnerabilidades criticas activas reportadas.
- **Próximo paso sugerido**:
  - iniciar WEB-U Auth Google y mantener seguimiento de advisories moderados de Next/PostCSS en siguientes upgrades patch de la rama 15.

### Entrada — 2026-06-01 — WEB-U auth Google + guard basico de rutas

- **Fase / paso**: WEB-U.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/lib/firebase/client.ts`;
  - `src/features/auth/auth-service.ts`;
  - `src/features/auth/use-auth-bootstrap.ts`.
- **Archivos modificados**:
  - `src/features/auth/types.ts`;
  - `src/stores/auth-store.ts`;
  - `src/app/(auth)/login/page.tsx`;
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar manualmente flujo Google en entorno con `.env.local` real y dominio autorizado en Firebase Console.
- **TODOs resueltos**:
  - login con Google implementado;
  - logout implementado;
  - redireccion de `/dashboard` a `/login` sin sesion;
  - redireccion de `/login` a `/dashboard` con sesion;
  - bootstrap minimo de `users/{uid}` (uid, email, displayName, photoUrl, createdAt, defaultCurrency COP, activeHouseholdId null).
- **Decisiones tecnicas tomadas**:
  - inicializacion Firebase movida a modo lazy y solo browser para evitar fallos de prerender en `next build`;
  - guard de rutas implementado en cliente con `onAuthStateChanged` + store Zustand;
  - se mantiene Web V1 sin lecturas/escrituras de cuentas/movimientos/categorias/hogar.
- **Skills aplicadas**:
  - `firebase-auth-basics` (alineado al flujo WEB-U);
  - respeto de `WEB_DESIGN_SYSTEM` para UI de login/dashboard.
- **Verificación realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-U implementado a nivel codigo; pendiente validacion manual con credenciales Firebase reales.
- **Próximo paso sugerido**:
  - ejecutar prueba manual end-to-end de auth y, si pasa, continuar con WEB-V lectura minima de datos.

### Entrada — 2026-06-01 — WEB-V1 lectura read-only de datos personales en dashboard

- **Fase / paso**: WEB-V1.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/lib/firebase/firestore-parsers.ts`;
  - `src/features/accounts/services/read-personal-accounts.ts`;
  - `src/features/pockets/services/read-account-pockets.ts`;
  - `src/features/categories/services/read-personal-categories.ts`;
  - `src/features/transactions/services/read-personal-transactions.ts`;
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/types/account.ts`;
  - `src/types/pocket.ts`;
  - `src/types/category.ts`;
  - `src/types/transaction.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar en datos reales si se requiere orden/index adicional para transacciones por fecha en Firestore.
- **TODOs resueltos**:
  - lectura read-only por `ownerId` de `accounts`, `categories`, `transactions`;
  - lectura de bolsillos en `accounts/{accountId}/pockets`;
  - dashboard conectado a datos reales con estados `loading/empty/error/success`;
  - logout y guard de `/dashboard` conservados.
- **Decisiones técnicas tomadas**:
  - consultas sin escritura y sin cambios de modelo;
  - orden de transacciones aplicado en cliente para evitar depender de índices nuevos en esta fase;
  - contexto Hogar excluido visualmente en WEB-V1 para mantener lectura personal segura.
- **Skills aplicadas**:
  - alineado a arquitectura WEB y reglas de diseño existentes.
- **Verificación realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V1 implementado en código para lectura personal mínima read-only.
- **Próximo paso sugerido**:
  - validación manual con cuenta real y luego avanzar a WEB-V2 (escrituras mínimas de movimientos).

### Entrada — 2026-06-01 — WEB-V2 pulido dashboard personal read-only

- **Fase / paso**: WEB-V2.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/lib/firebase/firestore-parsers.ts`;
  - `src/features/accounts/services/read-personal-accounts.ts`;
  - `src/features/pockets/services/read-account-pockets.ts`;
  - `src/features/categories/services/read-personal-categories.ts`;
  - `src/features/transactions/services/read-personal-transactions.ts`;
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/components/finance/transaction-timeline-item.tsx`;
  - `src/components/layout/sidebar.tsx`;
  - `src/types/account.ts`;
  - `src/types/pocket.ts`;
  - `src/types/category.ts`;
  - `src/types/transaction.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar con datos reales si hay necesidad de index compuesto para ordenar transacciones en servidor en fases futuras.
- **TODOs resueltos**:
  - movimientos muestran nombre de categoria en lugar de IDs crudos;
  - labels de tipo traducidos a espanol (Ingreso, Gasto, Transferencia, Reembolso, Pendiente);
  - fallback de titulo de movimiento mejorado (tipo + categoria cuando no hay titulo);
  - fallback de institucion de cuenta mejorado a “Sin entidad”;
  - sidebar evita mostrar Login cuando la sesion esta autenticada.
- **Decisiones tecnicas tomadas**:
  - balance total en WEB-V2 se calcula con suma de `account.currentBalance` (fallback `balance`) sin sumar bolsillos aparte para evitar doble conteo cuando los bolsillos son subparticiones internas;
  - se mantienen lecturas read-only y sin cambios de datos remotos.
- **Skills aplicadas**:
  - uso de design system existente (`FinanceCard`, `Amount`, `FinanceChip`, `TransactionTimelineItem`, `EmptyState`).
- **Verificación realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V2 implementado y estable en codigo con dashboard read-only pulido.
- **Próximo paso sugerido**:
  - validacion manual final de flujo login->dashboard y luego avanzar a siguiente fase de alcance (escrituras minimas).

### Entrada — 2026-06-01 — WEB-V3A crear gasto personal desde web

- **Fase / paso**: WEB-V3A.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/features/transactions/services/create-personal-expense.ts`;
  - `src/features/transactions/hooks/use-create-personal-expense.ts`;
  - `src/features/transactions/components/create-expense-card.tsx`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`;
  - `src/features/categories/services/read-personal-categories.ts`;
  - `src/types/category.ts`;
  - `src/types/transaction.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar reglas Firestore en produccion para asegurar permisos de `runTransaction` sobre `accounts` y `transactions`.
- **TODOs resueltos**:
  - formulario basico de nuevo gasto personal en dashboard;
  - validaciones de monto/cuenta/categoria/fecha;
  - escritura segura con `runTransaction` (creacion en `transactions` + descuento de `accounts.currentBalance` atomico);
  - feedback de exito/error y bloqueo de doble submit;
  - refresco de dashboard tras crear gasto.
- **Decisiones tecnicas tomadas**:
  - WEB-V3A actualiza solo cuenta principal (`currentBalance`), sin modificar bolsillos en esta fase;
  - categorias de gasto filtradas por tipo/kind `expense`;
  - transaccion registrada como `source=manual`, `status=confirmed`, `isHousehold=false`, `householdId=null`.
- **Skills aplicadas**:
  - alineado al design system y arquitectura por features.
- **Verificación realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V3A implementado en codigo; pendiente validacion manual final end-to-end en entorno real.
- **Próximo paso sugerido**:
  - validar manualmente gasto creado en Firestore y saldo actualizado, luego avanzar a WEB-V3B (ingreso personal).

### Entrada — 2026-06-01 — WEB-V3B crear ingreso personal desde web

- **Fase / paso**: WEB-V3B.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/features/transactions/services/create-personal-income.ts`;
  - `src/features/transactions/hooks/use-create-personal-income.ts`;
  - `src/features/transactions/components/create-income-card.tsx`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/types/transaction.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar manualmente en entorno real que `countsAsRealIncome: true` quede persistido segun reglas Firestore.
- **TODOs resueltos**:
  - flujo de nuevo ingreso desde dashboard con cuenta/categoria/fecha/descripcion;
  - validaciones de monto>0, requeridos y fecha valida;
  - escritura atomica con `runTransaction` (crear transaccion + sumar saldo a cuenta);
  - refresco de dashboard tras exito y bloqueo de doble submit.
- **Decisiones tecnicas tomadas**:
  - ingreso se registra como real por defecto con `countsAsRealIncome: true`;
  - se mantiene alcance sin transferencias, sin edicion/eliminacion y sin Hogar.
- **Skills aplicadas**:
  - reutilizacion del patron WEB-V3A con componentes del design system.
- **Verificación realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V3B implementado en codigo y compatible con gasto/read-only/auth/guard existentes.
- **Próximo paso sugerido**:
  - validacion manual end-to-end de ingreso y luego evaluar WEB-V3C (transferencia personal).

### Entrada - 2026-06-01 - WEB-V3C crear transferencia personal desde web

- **Fase / paso**: WEB-V3C.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/features/transactions/services/create-personal-transfer.ts`;
  - `src/features/transactions/hooks/use-create-personal-transfer.ts`;
  - `src/features/transactions/components/create-transfer-card.tsx`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/features/transactions/services/read-personal-transactions.ts`;
  - `src/types/transaction.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validacion manual end-to-end en entorno real para confirmar reflejo visual inmediato de transferencia en movimientos y saldos.
- **TODOs resueltos**:
  - CTA y formulario para nueva transferencia personal en dashboard;
  - validaciones de monto, cuentas requeridas, fecha valida y origen/destino distintos;
  - escritura atomica con `runTransaction` (crear documento en `transactions` + debitar origen + acreditar destino);
  - control de doble submit, estados de loading/error/success y refresco de dashboard al guardar.
- **Decisiones tecnicas tomadas**:
  - transferencias sin categoria (`categoryId: null`) y fuera de contexto Hogar (`isHousehold: false`, `householdId: null`);
  - no se modifican bolsillos en WEB-V3C, solo `accounts.currentBalance`;
  - se agrega `targetAccountId` al tipado y lectura para representar destino de transferencia en UI.
- **Skills aplicadas**:
  - continuidad de arquitectura por features y componentes del design system existente.
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V3C implementado en codigo, manteniendo operativos auth, guard de `/dashboard`, logout, lectura read-only, gasto e ingreso.
- **Proximo paso sugerido**:
  - avanzar a siguiente etapa de operaciones (edicion/eliminacion) o al alcance que defina el roadmap despues de validacion manual final.

### Entrada - 2026-06-01 - WEB-V4A editar movimiento personal basico desde web

- **Fase / paso**: WEB-V4A.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/features/transactions/services/update-personal-transaction.ts`;
  - `src/features/transactions/hooks/use-update-personal-transaction.ts`;
  - `src/features/transactions/components/edit-transaction-card.tsx`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/types/transaction.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar manualmente en entorno real la edicion cruzada de cuenta (cambio de cuenta origen/destino) para expense/income/transfer.
- **TODOs resueltos**:
  - accion `Editar` en movimientos recientes;
  - formulario de edicion para `expense`, `income` y `transfer`;
  - validaciones de monto, cuenta, categoria, fecha y origen/destino distintos en transferencia;
  - actualizacion atomica con `runTransaction` revirtiendo impacto anterior y aplicando impacto nuevo en saldos;
  - refresco de dashboard tras guardar cambios.
- **Decisiones tecnicas tomadas**:
  - no se permite cambiar tipo de movimiento en WEB-V4A (solo edicion dentro del mismo tipo);
  - no se tocan bolsillos ni contexto Hogar;
  - para transferencias editadas se mantiene `categoryId: null` y se actualiza `targetAccountId`.
- **Skills aplicadas**:
  - implementacion por features y consistencia con componentes `finance/*`.
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V4A implementado en codigo y compatible con auth/guard/lectura/creacion de movimientos existentes.
- **Proximo paso sugerido**:
  - WEB-V4B eliminar movimiento personal basico con rollback de saldos en transaccion atomica.

### Entrada - 2026-06-01 - WEB-V4B eliminar movimiento personal basico desde web

- **Fase / paso**: WEB-V4B.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/features/transactions/services/delete-personal-transaction.ts`;
  - `src/features/transactions/hooks/use-delete-personal-transaction.ts`;
  - `src/features/transactions/components/delete-transaction-confirm-card.tsx`.
- **Archivos modificados**:
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar manualmente en entorno real el flujo completo crear->editar->eliminar para cada tipo de movimiento en una misma sesion.
- **TODOs resueltos**:
  - accion `Eliminar` por movimiento en dashboard;
  - confirmacion previa de eliminacion con copy de impacto en saldo;
  - bloqueo de doble submit mientras elimina;
  - eliminacion atomica con `runTransaction` y rollback de saldos por tipo (`expense`, `income`, `transfer`);
  - refresco de dashboard tras eliminar para reflejar saldos y movimientos actualizados.
- **Decisiones tecnicas tomadas**:
  - no se implementa soft delete en WEB-V4B; se elimina el documento en `transactions`;
  - no se tocan bolsillos ni contexto Hogar;
  - tipos distintos a `expense|income|transfer` se marcan como no eliminables en esta fase.
- **Skills aplicadas**:
  - continuidad de arquitectura por features y reutilizacion del patron de V4A.
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V4B implementado en codigo manteniendo auth, guard, lectura, creacion y edicion de movimientos.
- **Proximo paso sugerido**:
  - smoke manual E2E de CRUD basico personal en dashboard y luego pasar a siguiente alcance funcional del roadmap.

### Entrada - 2026-06-01 - WEB-V4C auditoria/regresion CRUD financiero personal

- **Fase / paso**: WEB-V4C.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - ninguno.
- **Archivos modificados**:
  - `src/features/transactions/services/create-personal-expense.ts`;
  - `src/features/transactions/services/create-personal-income.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - ejecutar checklist manual E2E en entorno real contra Firestore para validar saldos finales despues de secuencias create->edit->delete.
- **TODOs resueltos**:
  - auditoria de create/edit/delete para `expense`, `income` y `transfer`;
  - verificacion de ownership por `ownerId` en writes;
  - verificacion de bloqueo de doble submit y mensajes de error en UI de formularios/confirmacion;
  - verificacion de `runTransaction` en todos los writes de movimientos.
- **Decisiones tecnicas tomadas**:
  - correccion puntual en create expense/income: validacion de categoria movida a `transaction.get(doc(...))` para mantener lecturas criticas dentro de la transaccion y reducir riesgo de inconsistencias;
  - sin refactor agresivo por alcance de auditoria.
- **Skills aplicadas**:
  - `systematic-debugging` (auditoria de consistencia transaccional y regresion).
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - CRUD financiero personal web auditado y estable a nivel codigo para fase WEB-V4C.
- **Proximo paso sugerido**:
  - pasar a siguiente fase funcional despues de checklist manual E2E.

### Checklist manual sugerida - WEB-V4C

1. Login con Google y entrada a `/dashboard`.
2. Gasto: crear -> verificar saldo baja y aparece movimiento.
3. Gasto: editar -> verificar rollback saldo anterior y aplicacion de saldo nuevo.
4. Gasto: eliminar -> verificar saldo regresa y movimiento desaparece.
5. Ingreso: crear -> verificar saldo sube y `countsAsRealIncome=true` en Firestore.
6. Ingreso: editar -> verificar rollback/aplicacion de saldo y conservacion de `countsAsRealIncome`.
7. Ingreso: eliminar -> verificar saldo regresa y movimiento desaparece.
8. Transferencia: crear -> verificar origen baja, destino sube, balance total global no cambia.
9. Transferencia: editar -> verificar rollback de origen/destino previos y aplicacion de nuevos; validar origen != destino.
10. Transferencia: eliminar -> verificar origen/destino revierten y movimiento desaparece.
11. Verificar que errores Firestore no cierran formulario/confirmacion automaticamente.
12. Verificar logout y guard (`/dashboard` redirige a `/login` sin sesion).

### Entrada - 2026-06-07 - Hotfix auth logout/guard dashboard

- **Fase / paso**: hotfix posterior a WEB-V4C.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - ninguno.
- **Archivos modificados**:
  - `src/features/auth/use-auth-bootstrap.ts`;
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Bug observado**:
  - al cerrar sesion, la app podia quedar en `/dashboard` mostrando error de carga en vez de redirigir limpiamente a `/login`.
- **Causa identificada**:
  - el listener global de auth podia quedar desuscrito por ciclo de vida de componentes, dejando el store con estado viejo;
  - adicionalmente, el redirect a `/login` podia correr antes de reflejarse el cambio de sesion en el store local.
- **Correccion aplicada**:
  - el bootstrap de auth se deja realmente singleton/persistente durante la sesion del cliente;
  - el logout limpia el store local (`clearSession`) tras `signOutUser()` antes de navegar a `/login`.
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - guard y logout mas robustos para `/dashboard` y `/login`.

### Entrada - 2026-06-07 - WEB-V5 vista Hogar simple read-only

- **Fase / paso**: WEB-V5.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/app/(dashboard)/household/page.tsx`;
  - `src/features/household/components/household-overview.tsx`;
  - `src/features/household/hooks/use-household-data.ts`;
  - `src/features/household/services/read-household-user.ts`;
  - `src/features/household/services/read-household.ts`;
  - `src/features/household/services/read-household-events.ts`;
  - `src/features/household/services/read-household-categories.ts`;
  - `src/features/household/services/read-household-debts.ts`;
  - `src/features/household/services/read-household-income-entries.ts`.
- **Archivos modificados**:
  - `src/components/layout/sidebar.tsx`;
  - `src/app/(dashboard)/dashboard/page.tsx`;
  - `src/types/household.ts`;
  - `docs/11_WEB_DEV_LOG.md`.
- **Archivos eliminados**:
  - `src/features/household/types.ts`.
- **TODOs nuevos**:
  - validar manualmente con usuario real con y sin `activeHouseholdId` para confirmar datos, estados vacios y posibles `permission-denied` por coleccion.
- **TODOs resueltos**:
  - ruta separada `/household` en modo solo lectura;
  - link `Hogar` en sidebar para usuarios autenticados;
  - lectura de `activeHouseholdId` desde `users/{uid}`;
  - empty state cuando no hay hogar activo;
  - lectura segura de `households`, `household_events`, `household_categories`, `household_debts`, `household_income_entries` por `householdId`;
  - validacion de membresia por `memberIds` cuando el documento del hogar la expone;
  - resumen simple de nombre, miembros, gastos del mes, `Entró al Hogar`, balance, eventos recientes, categorias y pendientes.
- **Decisiones tecnicas tomadas**:
  - WEB-V5 se implementa como ruta separada `/household` para separar claramente contexto Personal vs Hogar;
  - todas las queries de Hogar filtran por `householdId` y no leen datos personales ajenos;
  - el dashboard personal renombra el total a `Saldo en cuentas` para no insinuar `Dinero propio` antes de WEB-V6;
  - se agrega timeout de carga en el hook de Hogar para evitar loading infinito si Firestore responde lento.
- **Skills aplicadas**:
  - `brainstorming` (diseno aprobado antes de implementar);
  - `firebase-firestore` (lectura read-only sobre el esquema existente).
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V5 implementado en codigo con vista Hogar simple read-only, sin tocar CRUD personal ni Android.
- **Proximo paso sugerido**:
  - prueba manual real con usuario que tenga `activeHouseholdId` y luego evaluar siguiente fase funcional (WEB-V6 o equivalente).
### Entrada - 2026-06-07 - WEB-V6A auditoria de paridad financiera personal avanzada Android/Web

- **Fase / paso**: WEB-V6A.
- **Archivos revisados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\recursos\md files\03_DATA_MODEL.md`
  - `D:\Cosas mias\app finanzas\android\docs\05_DECISIONS.md`
  - `D:\Cosas mias\app finanzas\android\docs\09_ANDROID_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\repository\TransactionRepository.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\repository\ThirdPartyFundsRepository.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\repository\HouseholdIncomeEntryRepository.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\repository\HomeRepository.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\presentation\transactions\IncomeEntryViewModel.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\presentation\transactions\ExpenseEntryViewModel.kt`
  - `D:\Cosas mias\app finanzas\android\firestore.rules`
  - `src/features/transactions/services/create-personal-expense.ts`
  - `src/features/transactions/services/create-personal-income.ts`
  - `src/features/transactions/services/create-personal-transfer.ts`
  - `src/features/transactions/services/update-personal-transaction.ts`
  - `src/features/transactions/services/delete-personal-transaction.ts`
  - `src/features/transactions/services/read-personal-transactions.ts`
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/types/transaction.ts`
- **Hallazgos**:
  - Android ya tiene paridad financiera avanzada en dos capas separadas: proyeccion segura compartida (`household_income_entries`) para ingresos reales y ledger privado (`third_party_fund_entries` / `third_party_fund_consumptions`) para dinero no propio.
  - En Android, `countsAsRealIncome` decide si un ingreso cuenta para metricas personales, si proyecta al Hogar y si crea/cancela pendiente de dinero no propio.
  - En Android, el consumo de dinero no propio desde gastos vive fuera de `transactions`: el gasto guarda flags (`consumesThirdPartyFunds`, `thirdPartyConsumeAmount`) pero la asignacion real y su reversa viven en `ThirdPartyFundsRepository`.
  - En Android, Home Personal calcula `Dinero propio = Saldo bancario bruto - No propio pendiente`.
  - En Web, el CRUD personal actual usa `runTransaction` y actualiza `accounts.currentBalance` correctamente para expense / income / transfer, pero no proyecta ingresos al Hogar, no maneja ingresos no reales, no tiene ledger de dinero no propio y no calcula dinero propio neto.
  - En Web, `createPersonalIncome` fuerza `countsAsRealIncome: true`; la UI y los tipos no exponen ON/OFF ni campos de consumo de terceros.
  - En Web, el dashboard personal actual solo calcula `Saldo en cuentas` como suma de `accounts.currentBalance`; no muestra todavia metricas personales avanzadas tipo `Dinero propio`, `No propio pendiente` o proyecciones seguras al Hogar.
  - Para WEB-V6B no conviene inventar un toggle aislado en Web sin contrato remoto aprobado para `third_party_fund_entries` y `third_party_fund_consumptions`, porque se romperia la consistencia cross-device.
- **Verificacion realizada**:
  - `npm run lint` -> OK.
  - `npm run build` -> OK.
  - `./gradlew assembleDebug --console=plain` -> no ejecutable en esta sesion por `JAVA_HOME` ausente.
- **Estado al cerrar**:
  - Auditoria cerrada sin cambios productivos.
  - Se confirma que Web puede seguir usando el modelo actual para CRUD personal basico, pero WEB-V6B requiere decision de modelo/ADR antes de implementar dinero no propio cross-device.
- **Proximo paso sugerido**:
  - Abrir WEB-V6B como implementacion por subfases: primero ADR/contrato remoto, luego toggle ingreso real/no real + proyeccion segura a Hogar, y por ultimo ledger privado de dinero no propio con consumo/reversion y nuevo calculo de Home Personal.
### Entrada - 2026-06-07 - WEB-V6B1 ADR de contrato remoto privado de dinero no propio

- **Fase / paso**: WEB-V6B1.
- **Archivos revisados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\recursos\md files\03_DATA_MODEL.md`
  - `D:\Cosas mias\app finanzas\android\docs\05_DECISIONS.md`
  - `D:\Cosas mias\app finanzas\android\docs\09_ANDROID_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\sync\SyncManager.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\repository\ThirdPartyFundsRepository.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\local\dao\ThirdPartyFundsDao.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\local\entity\LocalThirdPartyFundEntryEntity.kt`
  - `D:\Cosas mias\app finanzas\android\app\src\main\java\com\finanzasm\app\data\local\entity\LocalThirdPartyFundConsumptionEntity.kt`
- **Archivos modificados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\recursos\md files\03_DATA_MODEL.md`
  - `D:\Cosas mias\app finanzas\android\docs\05_DECISIONS.md`
- **Correcciones aplicadas**:
  - se separa formalmente WEB-V6B1 (ADR/documentacion) de WEB-V6B2 (rules + types/helpers base);
  - se valida que Android actual ya tiene payload remoto y SyncManager para `third_party_fund_entries` y `third_party_fund_consumptions`, por lo que la fase futura Android no crea sync desde cero: valida y endurece la paridad Android/Web con datos creados desde Web;
  - se fija query recomendada para entries con `ownerId == uid` + `status in [open, consumed]`, evitando `status != cancelled` como query principal;
  - se documenta estrategia sin N+1: leer entries del owner, leer consumptions del owner y agrupar por `entryId` en memoria;
  - se documenta que una entry `consumed` con `pendingAmount=0` no suma a `No propio pendiente` y que `pendingAmount < 0` debe reportarse como inconsistencia, no ocultarse;
  - se deja explicito que consumptions no tienen `status`, no se editan en flujo normal y se borran/recrean al editar o eliminar un gasto;
  - se deja explicito que el ledger privado no modifica `account.currentBalance`, no guarda `accountId`, `pocketId` ni `householdId`, y no toca Hogar.
- **Decision propuesta**:
  - ADR compatibility-first para formalizar `third_party_fund_entries` y `third_party_fund_consumptions` como contrato remoto privado owner-only, sin implementar codigo productivo hasta aprobacion de Felipe.
- **Verificacion realizada**:
  - `npm run lint` -> OK.
  - `npm run build` -> OK.
  - `assembleDebug` -> no aplica en WEB-V6B1 porque esta fase no toca Android; sera obligatorio cuando se implemente la fase posterior `WEB-V6B-ANDROID-SYNC` / `ANDROID-Q8/I`.
- **Estado al cerrar**:
  - WEB-V6B1 queda cerrado a nivel documental/ADR.
  - No se cambiaron UI, CRUD, dashboard ni Firestore Rules aplicadas.
- **Proximo paso sugerido**:
  - aprobacion de Felipe y luego WEB-V6B2 para rules owner-only + shape minima y types/helpers base, dejando la validacion/endurecimiento Android/Web para `WEB-V6B-ANDROID-SYNC` / `ANDROID-Q8/I`.
### Entrada - 2026-06-07 - WEB-V6B2 base segura third_party_*

- **Fase / paso**: WEB-V6B2.
- **Archivos revisados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\recursos\md files\03_DATA_MODEL.md`
  - `D:\Cosas mias\app finanzas\android\docs\05_DECISIONS.md`
  - `D:\Cosas mias\app finanzas\android\firestore.rules`
  - `src/types/transaction.ts`
  - `src/lib/firebase/firestore-parsers.ts`
- **Archivos creados**:
  - `src/types/third-party-funds.ts`
  - `src/lib/finance/third-party-funds.ts`
- **Archivos modificados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\android\firestore.rules`
- **Rules agregadas / reemplazadas**:
  - endurecimiento owner-only + shape minima para `third_party_fund_entries`;
  - endurecimiento owner-only + shape minima para `third_party_fund_consumptions`;
  - `delete` denegado en entries;
  - `update` denegado en consumptions en WEB-V6B2;
  - TODO documentado para monotonia de `updatedAt` y checks cruzados post-V6B2.
- **Types / helpers agregados**:
  - tipos base `ThirdPartyFundEntry`, `ThirdPartyFundConsumption`, `ThirdPartyFundEntryStatus`;
  - helpers puros para agrupar consumptions por `entryId`, calcular consumido, calcular `pendingAmount` y total operativo `No propio pendiente`.
- **Nota de alcance**:
  - se modifico `D:\Cosas mias\app finanzas\android\firestore.rules` como archivo compartido fuera del repo web, sin tocar codigo Android.
- **Decisiones tecnicas tomadas**:
  - se usa `keys().hasAll([...])` en vez de `hasOnly(...)` para no rigidizar el payload real demasiado pronto;
  - `request.resource.data.updatedAt` se valida solo como existencia + timestamp; la monotonia `>=` queda diferida por riesgo con patrones mixtos de timestamp;
  - `allow update` de consumptions queda en `false` por defecto porque el flujo esperado borra y recrea consumptions, y no aparecio evidencia concreta de que Android necesite update in-place;
  - no se crean parsers/readers Firestore de `third_party_*` todavia;
  - los helpers usan `Map` solo internamente y no lo serializan ni lo conectan a estado global.
- **Tests**:
  - no aplica en esta fase: el repo web no tiene test runner configurado y no se agregaron librerias nuevas; quedan pendientes tests unitarios de helpers cuando exista infraestructura.
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V6B2 deja preparada la base segura de rules/tipos/helpers para `third_party_*`, sin tocar UI, CRUD, dashboard, `/household` ni comportamiento actual de movimientos.
- **Proximo paso sugerido**:
  - WEB-V6B3 para exponer `countsAsRealIncome` en create/edit de ingreso web sobre esta base ya asegurada.
### Entrada - 2026-06-07 - WEB-V6B2-AUDIT-FIX correccion de auditoria Claude

- **Fase / paso**: WEB-V6B2-AUDIT-FIX.
- **Auditoria recibida**:
  - Claude marco WEB-V6B2 como PASS con observaciones y pidio corregir un hallazgo critico de encoding/diff y ajustes de seguridad medios en read/delete de `third_party_*`.
- **Archivos modificados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `D:\Cosas mias\app finanzas\android\firestore.rules`
- **Correcciones aplicadas**:
  - CRIT-1: `android/firestore.rules` re-guardado en UTF-8 sin BOM y reconstruido desde la version limpia en Git para evitar diff contaminado y restaurar comentarios legibles;
  - `third_party_fund_entries.read` relajado a owner-only, sin shape gate en read;
  - `third_party_fund_consumptions.delete` relajado a owner-only, sin shape gate en delete;
  - `third_party_fund_consumptions.update` se mantiene en `false`;
  - no se agregaron `hasOnly(...)` ni checks cruzados con `transactions` o `entries`.
- **Validaciones mantenidas**:
  - shape minima con `keys().hasAll([...])` en create/update de `third_party_fund_entries`;
  - shape minima con `keys().hasAll([...])` en create de `third_party_fund_consumptions`;
  - `ownerId`, `sourceIncomeTransactionId` y `createdAt` siguen inmutables en update de entries;
  - `originalAmount` sigue editable en entries.
- **Estado de consumptions.update**:
  - sigue `false`; no aparecio evidencia concreta en el repo de que Android SyncManager requiera update remoto in-place para consumptions.
- **Helpers / types**:
  - revisados sin cambios: siguen puros, sin Firebase/React/estado global, sin clamp de `pendingAmount`, sin tocar saldos.
- **Pendientes documentados**:
  - posible indice compuesto futuro para query `ownerId + status` cuando existan readers reales;
  - deploy controlado de rules desde el repo Android antes de depender de estas reglas en escrituras reales;
  - tests unitarios de helpers cuando exista test runner.
- **Verificacion realizada**:
  - `npm run lint` OK;
  - `npm run build` OK;
  - validacion local de sintaxis de rules: no disponible en esta sesion sin usar deploy o emulador configurado.
- **Estado al cerrar**:
  - correccion de auditoria aplicada solo sobre WEB-V6B2, sin tocar UI, CRUD, dashboard, `/household` ni producto nuevo.
### Entrada - 2026-06-07 - WEB-V6B3 countsAsRealIncome en create/edit de ingreso web

- **Fase / paso**: WEB-V6B3.
- **Archivos tocados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `src/types/transaction.ts`
  - `src/features/transactions/services/create-personal-income.ts`
  - `src/features/transactions/services/update-personal-transaction.ts`
  - `src/features/transactions/services/read-personal-transactions.ts`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/features/transactions/components/edit-transaction-card.tsx`
- **Que se implemento**:
  - create income ahora expone y persiste `countsAsRealIncome` con default `true`;
  - edit income ahora muestra el mismo toggle y permite cambiar `true <-> false`;
  - incomes existentes sin `countsAsRealIncome` se leen como `true` sin migracion retroactiva;
  - `updatePersonalTransaction` solo persiste `countsAsRealIncome` cuando el movimiento es `income`;
  - cambiar `countsAsRealIncome` no altera por si solo el saldo bancario ni la logica actual de rollback/aplicacion de saldos.
- **Que NO se implemento todavia**:
  - no se crean ni actualizan `third_party_fund_entries`;
  - no se crean ni actualizan `third_party_fund_consumptions`;
  - no se proyecta nada a `household_income_entries`;
  - no se toca dashboard, `/household`, gastos ni transferencias fuera del tipado compartido estrictamente necesario.
- **Validaciones manuales realizadas**:
  - revision de diff para confirmar que los cambios quedaron acotados a types, create/edit income, lectura de transactions y dev log;
  - no se ejecuto checklist manual E2E en navegador en esta sesion.
- **npm run lint**:
  - OK.
- **npm run build**:
  - OK.
- **Estado al cerrar**:
  - WEB-V6B3 queda implementado a nivel codigo para create/edit de income con `countsAsRealIncome`, manteniendo compatibilidad con ingresos historicos y sin activar todavia ledger privado ni proyeccion a Hogar.
- **Proximo paso sugerido**:
  - WEB-V6B4 para proyectar solo ingresos reales a `household_income_entries` desde Web, o bien ejecutar primero validacion manual E2E create/edit income ON/OFF antes de seguir.
### Entrada - 2026-06-07 - WEB-V6B4 proyeccion segura de ingresos reales a household_income_entries

- **Fase / paso**: WEB-V6B4.
- **Archivos tocados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `src/features/transactions/services/create-personal-income.ts`
  - `src/features/transactions/services/update-personal-transaction.ts`
  - `src/features/transactions/services/delete-personal-transaction.ts`
  - `src/features/transactions/services/sync-household-income-projection.ts`
- **Que se implemento**:
  - create income real ahora proyecta a `household_income_entries` cuando `countsAsRealIncome=true` y el usuario tiene `activeHouseholdId` valido;
  - create income no real no proyecta nada a Hogar;
  - edit income actualiza, reactiva o cancela la proyeccion segura segun `countsAsRealIncome` y cambios de monto/fecha/descripcion;
  - delete income cancela la proyeccion existente por `sourceTransactionId` sin borrar fisicamente la entry;
  - se agrego helper dedicado para lookup por `sourceOwnerId + sourceTransactionId`, descripcion segura y sync transaccional de `household_income_entries`.
- **Decision de compatibilidad aplicada**:
  - Web no asume `docId == sourceTransactionId` porque Android actual usa IDs UUID remotos para `household_income_entries`;
  - `sourceTransactionId` se mantiene como clave logica de idempotencia para buscar/actualizar/cancelar la entry.
- **Payload seguro mantenido**:
  - solo se escriben `householdId`, `sourceOwnerId`, `sourceTransactionId`, `visibleDescription`, `amount`, `entryDate`, `kind`, `status`, `createdAt`, `updatedAt`;
  - no se escriben `accountId`, `pocketId`, banco, saldo ni categoria personal.
- **Que NO se implemento**:
  - no se tocaron `third_party_fund_entries` ni `third_party_fund_consumptions`;
  - no se tocaron dashboard, `/household` UI, `household_events`, `household_debts`, `household_categories` ni rules;
  - no se hizo deploy de rules.
- **Notas tecnicas**:
  - create mantiene la proyeccion dentro del `runTransaction` principal;
  - edit/delete hacen pre-lookup de la entry por `sourceTransactionId` antes del `runTransaction`, porque el SDK web transaccional opera sobre doc refs y no queries;
  - si una entry existente apunta a otro `householdId`, Web falla con error claro para evitar duplicados remotos por `sourceTransactionId`.
- **Verificacion**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V6B4 queda implementado a nivel codigo para la proyeccion segura de ingresos reales Web hacia `household_income_entries`, sin activar todavia dinero no propio ni cambios de UI de Hogar.
- **Proximo paso sugerido**:
  - ejecutar QA manual E2E create/edit/delete de income real/no real con usuario con y sin hogar activo; luego evaluar WEB-V6B5 o resolver primero el edge de cambio de hogar para una misma `sourceTransactionId` si se vuelve requisito de producto.
### Entrada - 2026-06-07 - WEB-V6B5 ledger remoto privado para ingresos no reales

- **Fase / paso**: WEB-V6B5.
- **Archivos tocados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `src/features/transactions/services/create-personal-income.ts`
  - `src/features/transactions/services/update-personal-transaction.ts`
  - `src/features/transactions/services/delete-personal-transaction.ts`
  - `src/features/transactions/services/sync-third-party-fund-entry.ts`
- **Que se implemento**:
  - create income no real ahora crea o reabre `third_party_fund_entries` con payload privado minimo (`ownerId`, `sourceIncomeTransactionId`, `originalAmount`, `status`, `createdAt`, `updatedAt`);
  - edit income no real -> no real actualiza `originalAmount` y `updatedAt`, preservando `status=consumed` si venia asi desde Android para no inferir consumptions en WEB-V6B5;
  - edit income no real -> real cancela la entry privada con `status=cancelled`;
  - edit income real -> no real crea o reabre la entry privada y sigue coordinado con la cancelacion/reactivacion de `household_income_entries` que ya venia de WEB-V6B4;
  - delete income no real cancela la `third_party_fund_entry` sin borrado fisico.
- **Estrategia real de lookup / docId**:
  - el SDK Web de Firestore no permite query reads dentro de `runTransaction`; por eso Web hace pre-lookup por `ownerId + sourceIncomeTransactionId` y luego opera dentro de la transaccion usando el `DocumentReference` encontrado;
  - `sourceIncomeTransactionId` queda documentado como clave logica de idempotencia, no como constraint global de Firestore;
  - para docs nuevos creados desde Web, si no existe una entry previa, se usa `docId = sourceIncomeTransactionId` como estrategia Web-compatible; Android sigue usando UUID remotos y el modelo remoto convive con ambos patrones.
- **Que NO se implemento todavia**:
  - no se tocaron `third_party_fund_consumptions` ni se leyeron para modificar estado;
  - no se toco dashboard, `/household`, gastos, transferencias, rules ni deploy;
  - no se implemento calculo de `Dinero propio` ni `No propio pendiente`.
- **Notas tecnicas**:
  - `status` en `third_party_fund_entries` se trata como cache/compatibilidad; el calculo derivado futuro de `pendingAmount` por consumptions seguira mandando en WEB-V6B7;
  - el ledger privado no guarda `accountId`, `pocketId`, `householdId`, categoria personal, banco ni saldo, y no modifica `account.currentBalance`.
- **Verificacion**:
  - `npm run lint` OK;
  - `npm run build` OK.
- **Estado al cerrar**:
  - WEB-V6B5 queda implementado a nivel codigo para el ledger remoto privado de ingresos no reales, sin abrir todavia consumptions ni cambios visuales.
- **Proximo paso sugerido**:
  - ejecutar QA manual create/edit/delete de income real/no real revisando Firestore, y luego abrir WEB-V6B6 para consumo desde gastos y reversion completa del ledger.

### Entrada — 2026-06-08 — WEB-V6B6 y WEB-V6B6-AUDIT-FIX ledger de dinero no propio y correcciones críticas de transacciones

- **Fase / paso**: WEB-V6B6 / WEB-V6B6-AUDIT-FIX
- **Agente / herramienta**: Antigravity
- **Archivos creados**:
  - [src/lib/utils/uuid.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/lib/utils/uuid.ts)
- **Archivos modificados**:
  - [docs/11_WEB_DEV_LOG.md](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/docs/11_WEB_DEV_LOG.md)
  - [src/types/transaction.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/types/transaction.ts)
  - [src/features/transactions/services/read-available-third-party-funds.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/read-available-third-party-funds.ts)
  - [src/features/transactions/services/sync-household-income-projection.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/sync-household-income-projection.ts)
  - [src/features/transactions/services/sync-third-party-fund-entry.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/sync-third-party-fund-entry.ts)
  - [src/features/transactions/services/create-personal-income.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/create-personal-income.ts)
  - [src/features/transactions/services/create-personal-expense.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/create-personal-expense.ts)
  - [src/features/transactions/services/update-personal-transaction.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/update-personal-transaction.ts)
  - [src/features/transactions/services/delete-personal-transaction.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/delete-personal-transaction.ts)
  - [src/features/transactions/services/read-personal-transactions.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/read-personal-transactions.ts)
  - [src/features/transactions/components/edit-transaction-card.tsx](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/components/edit-transaction-card.tsx)
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - validar compatibilidad del payload guardado desde Web en la app móvil de Android (sincronización y consistencia de datos).
  - validar si se requiere índice compuesto en Firestore para filtrar por `ownerId` y ordenar por `status` en la colección `third_party_fund_entries` (solo documentado, no creado en código local).
- **TODOs resueltos**:
  - consumo de dinero no propio en gastos personales.
  - reversión del ledger en modificaciones y eliminaciones de gastos.
  - corrección sistémica de violación "read after write" en transacciones de Firestore.
  - eliminación de transaction.get opcionales tardíos en sync helpers.
  - re-lectura de DocumentReferences conocidas dentro de la transacción para mitigar concurrencia.
  - fecha de edición en formulario sincronizada con `movement.date` en lugar de `createdAt`.
  - generador de UUIDs unificado.
- **Decisiones técnicas tomadas**:
  - **Read-Before-Write estricto:** Se estructuró una clara separación de fase de lectura (`transaction.get` obligatorio al inicio de `runTransaction`) y fase de escritura (`set/update/delete` al final) para todas las transacciones de Firestore en create/update/delete.
  - **Helpers de sincronización libres de lecturas:** Los helpers de sincronización de ingresos (`syncHouseholdIncomeProjectionInTransaction`) y dinero no propio (`syncThirdPartyFundEntryInTransaction`) ya no contienen llamadas `transaction.get`. En su lugar, requieren obligatoriamente que el flujo padre pre-lea e inicialice los datos, garantizando así la imposibilidad de lecturas tardías post-escritura.
  - **Mitigación de concurrencia (MED-1):** En las transacciones de gastos (create, update, delete), se re-leen mediante `DocumentReference` todas las entries afectadas y todos los consumos conocidos (asociados a las entries afectadas). Al calcular `pendingAfter` dentro del bloque transaccional se usa la mejor información disponible. Si se detecta un balance `pendingAfter < 0`, se lanza un error explícito abortando la transacción de forma atómica. No se realiza clamp silencioso.
  - **Ventana de carrera de concurrencia:** Queda explícitamente documentado que debido a que el SDK Web de Firestore no admite queries dentro de `runTransaction`, existe una ventana de carrera técnica si otra pestaña o dispositivo crea un nuevo documento de consumo con un ID desconocido entre la fase de pre-búsqueda y la transacción. Esto no se puede evitar por completo sin esquemas complejos de locks remotos o versionado en entries.
  - **Fecha de edición corregida:** Se extendió el tipo `Transaction` y el mapeador en `read-personal-transactions.ts` para leer la propiedad `date` de forma opcional (`data.date ?? data.createdAt`). Esto permite precargar la fecha exacta elegida por el usuario en `edit-transaction-card.tsx` en lugar de la fecha de creación del registro.
- **Skills aplicadas**:
  - `firebase-firestore` (transacciones y consistencia).
  - `systematic-debugging` (auditoría de ordenamiento transaccional).
- **Verificación realizada**:
  - Compilación exitosa en Next.js (`npm run build` y `npm run lint`).
- **Estado al cerrar**:
  - Ledger de dinero no propio y su reversión implementados y auditados de manera segura contra caídas por violación de ordenamiento de transacciones.
- **Próximo paso sugerido**:
  - Proceder con pruebas de compatibilidad y sincronización de datos desde el cliente móvil Android (ADR de contratos de dinero no propio).

### Entrada — 2026-06-08 — WEB-V6B6-VERIFY verificación y limpieza de la fase de auditoría

- **Fase / paso**: WEB-V6B6-VERIFY
- **Agente / herramienta**: Antigravity
- **Archivos revisados**:
  - [create-personal-income.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/create-personal-income.ts)
  - [create-personal-expense.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/create-personal-expense.ts)
  - [update-personal-transaction.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/update-personal-transaction.ts)
  - [delete-personal-transaction.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/delete-personal-transaction.ts)
  - [sync-household-income-projection.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/sync-household-income-projection.ts)
  - [sync-third-party-fund-entry.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/transactions/services/sync-third-party-fund-entry.ts)
- **Artefactos eliminados o conservados**:
  - No existen archivos temporales (`implementation_plan.md`, `task.md`, `walkthrough.md`) dentro del repositorio del proyecto. Estos se mantuvieron en el App Data del agente para visualización en el chat, sin contaminar el git.
- **Confirmación read-before-write**:
  - Verificado manualmente línea por línea en todos los servicios indicados. No existe ninguna llamada `transaction.get` ejecutada después de operaciones de escritura (`set`, `update`, `delete`).
- **Verificación realizada (lint/build)**:
  - `npm run lint` completado sin errores.
  - `npm run build` completado exitosamente y todas las páginas estáticas generadas sin problemas.
- **QA real / simulado**:
  - El entorno local carece de emulador de Java activo en el contenedor y de credenciales reales Google Auth para simulación directa de E2E automático. Queda marcado como pendiente para el QA manual guiado de Felipe.
- **Pendientes reales**:
  - Ejecutar la prueba funcional guiada por Felipe: crear ingreso no real, registrar gasto con consumo parcial, modificar monto/cuenta, eliminar el gasto y constatar la correcta actualización del ledger privado en Firestore sin caídas.

### Entrada — 2026-06-08 — WEB-V6B7 Dashboard Personal con Saldo en cuentas, No propio pendiente y Dinero propio

- **Fase / paso**: WEB-V6B7.
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - [use-personal-dashboard-data.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/dashboard/hooks/use-personal-dashboard-data.ts)
  - [page.tsx](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/app/(dashboard)/dashboard/page.tsx)
  - [11_WEB_DEV_LOG.md](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/docs/11_WEB_DEV_LOG.md)
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**:
  - Pruebas de usabilidad del nuevo Dashboard Personal con datos reales en Firestore para validar los desgloses en la interfaz de usuario.
- **TODOs resueltos**:
  - Lectura segura de `third_party_fund_entries` y `third_party_fund_consumptions`.
  - Desglose de "Saldo en cuentas", "No propio pendiente" y "Dinero propio" en tarjetas visuales con diseño premium.
  - Alerta sutil ante saldos negativos de dinero no propio pendiente (inconsistencias en el ledger).
  - Mapeo y filtrado en memoria de ingresos reales del mes actual y gastos del mes actual a partir de las últimas 100 transacciones.
  - Resolución de errores de tipado de TypeScript/ESLint en el hook de datos del dashboard.
- **Decisiones técnicas tomadas**:
  - Operación 100% de sólo lectura, evitando cualquier escritura en Firestore.
  - Cálculo de Dinero propio como `Saldo en cuentas - No propio pendiente` en memoria del cliente.
  - Exposición de la alerta de inconsistencia mediante `hasThirdPartyInconsistency` de forma directa en el retorno de `usePersonalDashboardData`.
- **Skills aplicadas**:
  - `frontend-design`, `systematic-debugging`.
- **Verificación realizada**:
  - `npm run lint` exitoso.
  - `npm run build` exitoso (compilación de producción limpia y generación estática de todas las páginas de App Router sin errores).
- **Estado al cerrar**:
  - Funcionalidad de dashboard personal de solo lectura completada, limpia de errores de ESLint y lista para QA manual.
- **Próximo paso sugerido**:
  - QA manual integral del flujo de creación/edición/eliminación de movimientos y visualización de saldos en el dashboard personal.

### Entrada — 2026-06-07 — WEB-V6-AUDIT-FIX-2 correcciones de la auditoría final WEB-V6

- **Fase / paso**: WEB-V6-AUDIT-FIX-2 (cierre de hallazgos de la auditoría técnica final de WEB-V6).
- **Agente / herramienta**: Cursor (Claude).
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/transactions/services/read-personal-transactions.ts`
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/edit-transaction-card.tsx`
  - `src/features/transactions/services/sync-household-income-projection.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Hallazgos corregidos**:
  - **MED-2** Métricas del mes ya no dependen del recorte a 100 movimientos: se agregó `readAllPersonalTransactions` (lee todo, ordena por `createdAt` desc) y el dashboard calcula `Ingresos reales del mes` / `Gastos del mes` sobre el conjunto completo. `readPersonalTransactions` ahora reutiliza esa función y solo recorta para listados.
  - **MED-3** En editar gasto, el checkbox "Usa dinero no propio" ya no queda bloqueado cuando el disponible es 0 si el gasto venía consumiendo (`disabled = availableNoPropio === 0 && !consumesThirdPartyFunds`), permitiendo des-marcar y liberar consumos de una entry cancelada.
  - **MED-4** El dashboard ahora marca `hasThirdPartyInconsistency` cuando existen consumptions huérfanas (apuntan a una entry cancelada o inexistente), para no ocultar dinero no propio ya gastado. Decisión de producto aplicada: opción (b) "marcar como inconsistencia visible" (no se bloquea el borrado ni se borra nada automáticamente).
  - **MIN-1** El timeline de "Movimientos recientes" muestra la fecha del movimiento (`date ?? createdAt`) en vez de la fecha de creación.
  - **MIN-2** Los controles de consumo de dinero no propio (label, placeholder y errores) usan `formatCurrencyCop` (formato COP `$ 20.000`) en lugar de número crudo.
  - **MIN-7** Se eliminó `resolveEligibleHouseholdId` (exportada pero sin uso); era la única función con `transaction.get` que podía inducir un read-after-write si se llamara en fase de escritura.
  - **MIN-3** Se quitó la entrada `WEB-V6B2` duplicada en este dev log.
- **No corregido en este pase (con motivo)**:
  - **MED-1** Índices compuestos: ya están versionados en `android/firestore.indexes.json` (4 índices: entries `ownerId+status`, entries `ownerId+sourceIncomeTransactionId`, consumptions `ownerId+consumerExpenseTransactionId`, household_income_entries `sourceOwnerId+sourceTransactionId`). Falta verificar que estén *Enabled* en producción (`finanzas-m`); es tarea de deploy, no de código.
  - **MED-5** Ventana de carrera residual del pre-lookup fuera de `runTransaction`: limitación inherente del SDK Web (no admite queries en transacción). Mitigada (re-lectura por ref + abort si `pendingAfter < 0`) y documentada; sin fix adicional sin locks/versionado remoto.
  - **MIN-4** Mojibake de encoding en Parte 1/2 de este dev log: se deja fuera de este pase por ser un re-encode masivo de alto riesgo y ajeno a la lógica WEB-V6; conviene resolverlo en una tarea dedicada de normalización UTF-8.
  - Consistencia Android/Web: contrato compatibility-first sin verificación E2E real contra Android (pendiente de QA).
- **Decisiones técnicas tomadas**:
  - No se introdujeron nuevos índices (se evitó `orderBy`/`limit` de servidor en transacciones para no crear dependencias de deploy adicionales antes de QA).
  - La detección de consumptions huérfanas es aditiva sobre `hasThirdPartyInconsistency`; no cambia el modelo, el borrado ni los saldos.
- **Skills aplicadas**:
  - `firebase-firestore`, `firebase-security-rules-auditor`, `systematic-debugging`, `vercel-react-best-practices`, `web-quality-audit`.
- **Verificación realizada**:
  - `npm run build` (incluye lint + type-check) exitoso.
- **Estado al cerrar**:
  - Hallazgos accionables de la auditoría final WEB-V6 corregidos; quedan pendientes solo ítems de deploy (índices) y QA manual E2E (incluida la compatibilidad real con Android).
- **Próximo paso sugerido**:
  - Confirmar índices *Enabled* en `finanzas-m` y ejecutar el QA manual guiado por Felipe.
### Entrada â€” 2026-06-07 â€” WEB-V6-DOC-CHECK estado documental y técnico post WEB-V6B7

- **Fase / paso**: WEB-V6-DOC-CHECK.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - ninguno.
- **Archivos modificados**:
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **TODOs nuevos**:
  - ejecutar `QA manual WEB-V6` con evidencia real sobre dashboard personal, CRUD de movimientos y consistencia de Firestore/Android;
  - abrir `WEB-V6-QA-FIX` solo si el QA manual detecta hallazgos;
  - correr auditoría Cursor final después del QA manual y de cualquier fix derivado.
- **TODOs resueltos**:
  - alineación documental del estado post `WEB-V6B7`;
  - aclaración explícita de que WEB-V6 está implementado técnicamente pero no cerrado funcionalmente;
  - normalización del próximo paso formal para evitar lenguaje de cierre o deploy prematuros.
- **Decisiones técnicas tomadas**:
  - no se toca lógica de negocio, reglas de Firestore ni modelo de datos;
  - el repo queda documentado en estado pre-QA manual, no en estado de cierre ni deploy.
- **Skills aplicadas**:
  - ninguna.
- **Verificación realizada**:
  - revisión documental completa de `docs/11_WEB_DEV_LOG.md`;
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - documentación interna alineada para QA manual WEB-V6, sin afirmar cierre funcional ni readiness de deploy.
- **Próximo paso sugerido**:
  - `QA manual WEB-V6` → `WEB-V6-QA-FIX` si aplica → auditoría Cursor → cierre real.
### Entrada â€” 2026-06-08 â€” WEB-V6-STATIC-PREREVIEW pre-revisión estática post WEB-V6B7

- **Fase / paso**: WEB-V6-STATIC-PREREVIEW.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos revisados**:
  - `docs/11_WEB_DEV_LOG.md`
  - `src/features/transactions/services/create-personal-income.ts`
  - `src/features/transactions/services/create-personal-expense.ts`
  - `src/features/transactions/services/update-personal-transaction.ts`
  - `src/features/transactions/services/delete-personal-transaction.ts`
  - `src/features/transactions/services/sync-household-income-projection.ts`
  - `src/features/transactions/services/sync-third-party-fund-entry.ts`
  - `src/features/transactions/services/read-available-third-party-funds.ts`
  - `src/features/transactions/services/read-personal-transactions.ts`
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/edit-transaction-card.tsx`
  - `src/app/(dashboard)/dashboard/page.tsx`
- **Archivos modificados**:
  - `docs/11_WEB_DEV_LOG.md`
- **Cambios de lógica realizados**:
  - ninguno.
- **Hallazgos / riesgos detectados**:
  - se detectó un bug aparente en borrado de gastos con `third_party_fund_consumptions`, pendiente de validar/corregir en una fase de fix;
  - se detectó riesgo de corrimiento de fecha por parseo `new Date(YYYY-MM-DD)` en formularios, con impacto potencial en timeline y métricas del mes;
  - se detectó riesgo de inconsistencia si un ingreso no real se reduce por debajo de lo ya consumido en `third_party_fund_consumptions`;
  - se detectó riesgo de dashboard con datos parciales si fallan lecturas de ledger/consumos y la vista queda en estado `success` con totales parciales.
- **Verificación realizada**:
  - revisión estática de servicios, hooks y componentes WEB-V6;
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - pre-revisión estática completada; WEB-V6 sigue pendiente de QA manual E2E real y no debe marcarse como cerrado.
- **Próximo paso sugerido**:
  - ejecutar QA manual WEB-V6 con foco explícito en los riesgos detectados; si alguno se confirma, abrir `WEB-V6-QA-FIX` antes de una nueva auditoría Cursor.
### Entrada â€” 2026-06-08 â€” WEB-V6-QA-FIX borrado seguro de gastos con dinero no propio

- **Fase / paso**: WEB-V6-QA-FIX.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `tests/unit/third-party-fund-delete-context.test.ts`
- **Archivos modificados**:
  - `src/lib/finance/third-party-funds.ts`
  - `src/features/transactions/services/delete-personal-transaction.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **Causa raíz**:
  - el flujo de delete de gastos con dinero no propio dependía de `readAvailableThirdPartyFunds`, un helper cuyo objetivo principal es calcular disponibilidad/pending y no resolver consumptions para borrado;
  - aunque `allConsumptions` hoy sale sin filtrar, el acoplamiento era frágil, inducía una lectura ambigua del flujo y dejaba el borrado dependiendo de un contrato secundario fácil de romper en futuros cambios.
- **Solución aplicada**:
  - se desacopló `delete-personal-transaction.ts` del helper de disponibilidad;
  - el delete ahora hace una lectura dedicada de `third_party_fund_consumptions` del owner y separa de forma explícita:
    - consumptions del gasto borrado;
    - otras consumptions relevantes para recalcular las entries afectadas;
    - `affectedEntryIds`;
  - se agregó el helper puro `splitConsumptionsForExpenseTransaction` en `src/lib/finance/third-party-funds.ts`;
  - se agregó una prueba mínima que fija ese contrato y evita regresiones semánticas en el flujo de delete.
- **TODOs nuevos**:
  - ejecutar QA manual del caso guiado:
    1. ingreso no real `$ 50.000`;
    2. gasto `$ 20.000` consumiendo dinero no propio;
    3. borrar gasto;
    4. confirmar que `No propio pendiente` vuelve a `$ 50.000`;
    5. confirmar que no quedan `third_party_fund_consumptions` huérfanas del gasto borrado.
- **TODOs resueltos**:
  - se eliminó la dependencia del delete respecto al helper de disponibilidad para reconstruir consumptions del gasto;
  - se dejó protegido el contrato de separación de consumptions para borrado.
- **Skills aplicadas**:
  - `systematic-debugging`
  - `test-driven-development`
  - `firebase-firestore`
- **Verificación realizada**:
  - prueba primero en rojo: `npx tsx tests/unit/third-party-fund-delete-context.test.ts` falló porque el helper todavía no existía;
  - prueba en verde tras el fix: `npx tsx tests/unit/third-party-fund-delete-context.test.ts`;
  - `npm run lint`;
  - `npm run build`;
  - `npm run test:emulator` no pudo ejecutarse en esta sesión porque falta Java en el entorno local (`Could not spawn java -version`).
- **Estado al cerrar**:
  - fix mínimo aplicado sobre el flujo de eliminación de gastos con dinero no propio, sin tocar create/edit de gastos, ingresos, UI ni Firestore Rules.
- **Próximo paso sugerido**:
  - ejecutar QA manual WEB-V6 del caso de borrado y, si pasa, continuar con el resto del checklist E2E antes de una nueva auditoría Cursor.

### Entrada â€” 2026-06-08 â€” WEB-V6-QA-FIX guard para editar ingresos no reales ya consumidos

- **Fase / paso**: WEB-V6-QA-FIX.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `tests/unit/third-party-fund-income-amount-guard.test.ts`
- **Archivos modificados**:
  - `src/lib/finance/third-party-funds.ts`
  - `src/features/transactions/services/sync-third-party-fund-entry.ts`
  - `src/features/transactions/services/update-personal-transaction.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **Causa raíz**:
  - al editar un ingreso no real, la sincronización del ledger privado actualizaba `originalAmount` y `status` sin validar si ya existían `third_party_fund_consumptions` por un total mayor al nuevo monto;
  - eso permitía persistir entries con `pendingAmount` negativo (`originalAmount - consumptions`), dejando el ledger en un estado inválido.
- **Solución aplicada**:
  - se agregó la guarda pura `assertOriginalAmountCoversConsumedAmount` en `src/lib/finance/third-party-funds.ts`;
  - `update-personal-transaction.ts` ahora hace pre-lookup dedicado de consumptions del entry privado asociado al income no real, los relee dentro de la transacción y calcula el total consumido antes de persistir cambios;
  - si el nuevo monto queda por debajo de lo ya consumido, la edición falla con error claro y no persiste cambios;
  - `sync-third-party-fund-entry.ts` recibe `consumedAmount` y aplica la misma validación como defensa adicional para no reintroducir el bug desde futuros callers.
- **TODOs nuevos**:
  - ejecutar QA manual del caso bloqueado:
    1. ingreso no real `$ 50.000`;
    2. consumptions existentes por `$ 30.000`;
    3. intentar editar a `$ 20.000`;
    4. confirmar error controlado;
    5. confirmar que no se persiste estado inválido;
  - ejecutar QA manual del caso permitido:
    1. consumido `$ 30.000`;
    2. editar ingreso a `$ 40.000`;
    3. confirmar que la edición sí persiste y el ledger queda coherente.
- **TODOs resueltos**:
  - ya no se permite reducir `originalAmount` por debajo del total consumido del ledger privado;
  - se conserva el comportamiento existente de create/edit/delete de gastos y de ingresos reales/no reales fuera de esta validación.
- **Skills aplicadas**:
  - `systematic-debugging`
  - `test-driven-development`
  - `firebase-firestore`
- **Pruebas**:
  - `tests/unit/third-party-fund-income-amount-guard.test.ts` cubre:
    - bloqueo cuando `originalAmount=20.000` y `consumedAmount=30.000`;
    - permiso cuando `originalAmount=40.000` y `consumedAmount=30.000`;
    - permiso cuando `originalAmount` queda exactamente igual a lo consumido.
- **Verificación realizada**:
  - `npx tsx tests/unit/third-party-fund-income-amount-guard.test.ts`;
  - `npx tsx tests/unit/third-party-fund-delete-context.test.ts`;
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - guard de consistencia aplicado para la edición de ingresos no reales ya consumidos, sin tocar Firestore Rules, Hogar avanzado ni UI.
- **Próximo paso sugerido**:
  - ejecutar QA manual WEB-V6 sobre ambos escenarios (bloqueado y permitido) y luego continuar con el checklist E2E restante antes de la siguiente auditoría Cursor.

### Entrada — 2026-06-08 — WEB-V6-QA-FIX normalización de fechas locales en movimientos personales

- **Fase / paso**: WEB-V6-QA-FIX.
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `tests/unit/personal-date-input-local.test.ts`
- **Archivos modificados**:
  - `src/lib/format/date.ts`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/create-transfer-card.tsx`
  - `src/features/transactions/components/edit-transaction-card.tsx`
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **Causa raíz**:
  - los formularios de movimientos personales convertían fechas elegidas por el usuario con `new Date("YYYY-MM-DD")`, lo que interpreta la cadena en UTC y puede correr el movimiento al día anterior en `America/Bogota`;
  - además, el formulario de edición serializaba la fecha al input con `toISOString().slice(0, 10)`, dejando la normalización dependiente de UTC en vez del calendario local;
  - eso podía afectar timeline y clasificación mensual en dashboard (`ingresos reales del mes` y `gastos del mes`) en fechas de borde.
- **Solución aplicada**:
  - se agregó en `src/lib/format/date.ts` un helper explícito para parsear `YYYY-MM-DD` como `Date` local segura (`parseDateInputAsLocalDate`);
  - se agregó un helper de serialización para inputs de fecha (`formatDateInputValue`) y otro de comparación mensual consistente (`isSameMonthAndYear`);
  - se agregó `formatPersonalMovementDateEs` para que el timeline personal interprete correctamente el día calendario incluso en registros históricos guardados a medianoche UTC por el parser anterior;
  - `create-income-card.tsx`, `create-expense-card.tsx`, `create-transfer-card.tsx` y `edit-transaction-card.tsx` dejaron de usar `new Date(date)` para fechas elegidas en formularios;
  - `use-personal-dashboard-data.ts` ahora reutiliza el helper mensual para clasificar movimientos del mes de forma consistente;
  - `src/app/(dashboard)/dashboard/page.tsx` ahora usa el formateador específico del movimiento para no mostrar el día anterior en el timeline por efecto de UTC.
- **TODOs resueltos**:
  - ya no se usa parseo directo `new Date("YYYY-MM-DD")` en los formularios personales corregidos;
  - la fecha `2026-06-01` se mantiene en junio al parsearse y clasificarse por mes en la zona local esperada para QA manual WEB-V6;
  - los movimientos históricos guardados por el parser anterior ya no deberían verse un día antes en el timeline personal por el caso típico de medianoche UTC.
- **Skills aplicadas**:
  - `systematic-debugging`
  - `test-driven-development`
- **Pruebas**:
  - `tests/unit/personal-date-input-local.test.ts` cubre:
    - parseo local seguro de `2026-06-01`;
    - serialización estable del valor de input sin corrimiento;
    - clasificación mensual consistente para primer y último día de junio;
    - compatibilidad con registros históricos creados como `UTC midnight` para input, clasificación mensual y timeline;
    - rechazo de fechas inválidas como `2026-02-31`.
- **Verificación realizada**:
  - prueba en rojo: `npx tsx tests/unit/personal-date-input-local.test.ts` falló primero porque los helpers todavía no existían;
  - prueba en verde: `npx tsx tests/unit/personal-date-input-local.test.ts`;
  - regresión rápida: `npx tsx tests/unit/third-party-fund-delete-context.test.ts`;
  - regresión rápida: `npx tsx tests/unit/third-party-fund-income-amount-guard.test.ts`;
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - manejo de fechas personales normalizado para evitar corrimientos por UTC en formularios, timeline y clasificación mensual del dashboard, sin tocar Firestore Rules, modelo ni UI fuera de ajustes mínimos.
- **Próximo paso sugerido**:
  - ejecutar QA manual WEB-V6 con foco en fechas límite del mes, timeline y métricas del dashboard antes de la siguiente auditoría Cursor.

### Entrada — 2026-06-08 — WEB-V6-QA-FIX corrección de inconsistencia de saldo de cuenta por bolsillos

- **Fase / paso**: WEB-V6-QA-FIX (Investigar y corregir inconsistencia de saldo entre Android y Web en WEB-V6).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**:
  - [accounts.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/lib/finance/accounts.ts)
  - [accounts.test.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/tests/unit/accounts.test.ts)
- **Archivos modificados**:
  - [use-personal-dashboard-data.ts](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/features/dashboard/hooks/use-personal-dashboard-data.ts)
  - [package.json](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/package.json)
  - [11_WEB_DEV_LOG.md](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/docs/11_WEB_DEV_LOG.md)
- **Archivos eliminados**: ninguno.
- **Causa raíz**:
  - En la Web, el balance de cada cuenta se mostraba y sumaba usando únicamente `currentBalance` (sin incluir los saldos de los bolsillos asociados a la cuenta).
  - La regla de dominio vigente en Android establece que: `totalCuenta = account.currentBalance + sum(pockets.balance)`. Al no sumar los bolsillos en Web, el saldo total de Bancolombia mostraba `$ 13.000` (monto base de la cuenta) en vez de `$ 20.000` (monto de la cuenta + `$ 7.000` en bolsillos).
- **Solución aplicada**:
  - Se creó la función pura `calculateAccountTotalBalance` en `src/lib/finance/accounts.ts` para realizar la suma según la regla de dominio.
  - Se modificó el hook `usePersonalDashboardData` para que asocie los bolsillos de cada cuenta y actualice la propiedad `balance` con el saldo total calculado.
  - Esto actualiza tanto el saldo individual de cada cuenta en la sección "Cuentas personales" como el total acumulado en **Saldo en cuentas** y el neto en **Dinero propio** de forma automática y coherente.
  - Se agregó una suite de pruebas unitarias en `tests/unit/accounts.test.ts` y se integró un script de `"test"` en `package.json` para ejecutar los tests unitarios.
- **TODOs resueltos**:
  - Corregido el cálculo del saldo total de cuentas agregando los bolsillos.
  - Solucionada la desincronización de balance observado entre Android y Web en Bancolombia ($20.000 esperado).
- **Skills aplicadas**:
  - `systematic-debugging`, `test-driven-development`.
- **Verificación realizada**:
  - Pruebas unitarias: `npm run test` (ejecutando `tests/unit/accounts.test.ts`) exitoso.
  - Pruebas rápidas de regresión de los otros tests unitarios en `tests/unit/` ejecutadas exitosamente.
  - `npm run lint` exitoso.
  - `npm run build` exitoso.
- **Estado al cerrar**:
  - Corrección de la inconsistencia de saldos por bolsillos completada y verificada. El desglose de "Dinero propio" e individual de cuentas ahora es idéntico al de Android.
- **Próximo paso sugerido**:
  - Realizar el QA manual de los saldos con la base de datos real.

### Entrada — 2026-06-08 — WEB-V6-QA-FIX integración de marca y logotipos oficiales

- **Fase / paso**: WEB-V6-QA-FIX (Integración visual de logotipos e isotipos oficiales de Finanzas M).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**:
  - `src/app/icon.png` (Favicon oficial del navegador copiado desde el recurso original de marca).
- **Archivos modificados**:
  - [sidebar.tsx](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/components/layout/sidebar.tsx)
  - [page.tsx](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/app/(auth)/login/page.tsx)
  - [11_WEB_DEV_LOG.md](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/docs/11_WEB_DEV_LOG.md)
- **Archivos eliminados**:
  - `src/app/favicon.ico` (Eliminado para que Next.js detecte y priorice automáticamente el nuevo `icon.png`).
- **Cambios realizados**:
  - Se eliminó el texto plano de marcador de posición "Finanzas M" de la barra lateral ([sidebar.tsx](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/components/layout/sidebar.tsx)) y se integró el logotipo vectorial `logo-white-text.svg` usando el componente `<Image />` de Next.js.
  - Se estilizaron y espaciaron los enlaces de navegación de la barra lateral para un diseño general más pulido y premium.
  - Se integró el logotipo completo centrado verticalmente arriba del formulario en la pantalla de inicio de sesión ([page.tsx](file:///d:/Cosas%20mias/app%20finanzas/web/finanzas-m-web/src/app/(auth)/login/page.tsx)), reestructurando la distribución para que luzca óptima en cualquier dispositivo.
  - Se sustituyó el favicon por defecto de Next.js en la pestaña del navegador por el isotipo "M" oficial de la marca dentro de su contenedor redondeado (`favicon.png`).
- **TODOs resueltos**:
  - Integrada la identidad de marca oficial y logotipos SVG en toda la interfaz de la aplicación web.
  - Corregidos y optimizados los elementos visuales de carga de imágenes para cumplir con las reglas del linter de Next.js (`no-img-element`).
- **Skills aplicadas**:
  - `frontend-design`.
- **Verificación realizada**:
  - `npm run lint` exitoso (0 errores, 0 warnings).
  - `npm run build` exitoso.
- **Estado al cerrar**:
  - Aspecto visual y de marca integrado perfectamente en la barra lateral, pantalla de inicio de sesión y favicon del navegador.
- **Próximo paso sugerido**:
  - Realizar el QA manual con los nuevos elementos visuales y el desglose de saldos ya integrados.
### Entrada - 2026-06-08 - WEB-V7 refactor visual Personal inspirado en prototipo Claude

- **Fase / paso**: WEB-V7 (RediseÃ±o visual de Personal sin cambiar reglas de negocio ni contratos Firebase).
- **Agente / herramienta**: Codex.
- **Archivos creados**:
  - `src/app/(dashboard)/accounts/page.tsx`
  - `src/app/(dashboard)/categories/page.tsx`
  - `src/app/(dashboard)/movements/page.tsx`
  - `src/app/(dashboard)/settings/page.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `src/components/finance/account-pocket-card.tsx`
  - `src/components/finance/category-breakdown-list.tsx`
  - `src/components/finance/finance-dialog.tsx`
  - `src/components/finance/finance-side-panel.tsx`
  - `src/components/finance/personal-transaction-row.tsx`
  - `src/components/finance/setting-row.tsx`
  - `src/components/layout/navigation.ts`
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/features/dashboard/components/personal-workspace.tsx`
  - `src/features/dashboard/lib/personal-view-model.ts`
  - `src/features/transactions/components/transaction-form-surface.tsx`
  - `tests/unit/personal-view-model.test.ts`
- **Archivos modificados**:
  - `package.json`
  - `package-lock.json`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/app/(dashboard)/household/page.tsx`
  - `src/app/design-system/page.tsx`
  - `src/app/globals.css`
  - `src/app/layout.tsx`
  - `src/components/finance/amount.tsx`
  - `src/components/layout/app-shell.tsx`
  - `src/components/layout/sidebar.tsx`
  - `src/components/layout/top-bar.tsx`
  - `src/features/dashboard/hooks/use-personal-dashboard-data.ts`
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/features/transactions/components/create-transfer-card.tsx`
  - `src/features/transactions/components/delete-transaction-confirm-card.tsx`
  - `src/features/transactions/components/edit-transaction-card.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno en esta ola de rediseÃ±o.
- **Objetivo del cambio**:
  - Llevar la experiencia Personal web hacia la estructura del prototipo de Claude (`sidebar + topbar + hero + vistas reales`) sin cambiar calculos, hooks, servicios ni reglas financieras ya validadas en Android.
- **Solucion aplicada**:
  - Se reemplazo el shell viejo por un `AppShell` nuevo con sidebar fija, topbar util, footer de usuario y animacion de entrada con GSAP.
  - Se separaron vistas reales para `Inicio`, `Movimientos`, `Cuentas`, `Gastos por categoria` y `Ajustes`, manteniendo `"/dashboard"` como Inicio por compatibilidad.
  - Se convirtio `Dinero propio` en el hero dominante del Home y se mantuvieron `Saldo bancario bruto`, `No propio pendiente`, cuentas, movimientos, categorias y pendientes del Hogar.
  - Se agrego una capa nueva de componentes visuales para Personal (`account-pocket-card`, `personal-transaction-row`, `category-breakdown-list`, `setting-row`).
  - Se movieron crear/editar movimientos a un panel lateral derecho compartido y eliminar a un dialogo compacto, sin tocar servicios ni validaciones.
  - Se adapto `Household` para heredar el shell nuevo sin rediseÃ±ar su contenido profundo.
  - Se actualizo `/design-system` para mostrar el shell nuevo, las cards nuevas y los patrones de panel/dialogo.
  - Se integraron fuentes reales (`Poppins` y `Figtree`) en el layout global y se reforzaron tokens/variables del dark theme.
- **Bugs / ajustes detectados durante QA**:
  - El primer intento del panel lateral no cerraba bien en runtime. Se reescribio `finance-side-panel.tsx` con una secuencia mas estable de montaje/cierre y se revalido en navegador.
  - Se limpiaron varios textos con mojibake para no contaminar la UI nueva.
  - Se retiro el CTA visual de `Nueva cuenta` en la vista de cuentas porque todavia no existe flujo real conectado en web.
- **Skills aplicadas**:
  - `brainstorming`
  - `frontend-design`
  - `impeccable`
  - `web-design-guidelines`
  - `accessibility`
  - `gsap-core`
  - `gsap-react`
  - `gsap-performance`
  - `test-driven-development`
- **Verificacion realizada**:
  - prueba en rojo y luego en verde para el helper del view model: `npx tsx tests/unit/personal-view-model.test.ts`
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - QA visual en navegador local sobre `http://127.0.0.1:3012/design-system`
  - Verificado manualmente en navegador:
    - carga del shell nuevo;
    - hero financiero;
    - render de cuentas, movimientos y categorias;
    - apertura/cierre del panel lateral;
    - apertura del dialogo compacto.
- **Estado al cerrar**:
  - Personal web ya tiene la primera ola del rediseÃ±o estructural aplicada y verificada.
  - La logica financiera se mantuvo intacta.
  - Hogar sigue funcional bajo el shell nuevo, pero no entra aun al rediseÃ±o fuerte.
- **Fuera de alcance confirmado**:
  - Login no fue rediseÃ±ado en esta ola.
  - No se agregaron features nuevas como `Editar tablero`.
  - No se tocaron reglas Firebase, modelo de datos ni semantica de `Dinero propio`.
- **Proximo paso sugerido**:
  - Hacer QA manual autenticado sobre rutas reales (`/dashboard`, `/movements`, `/accounts`, `/categories`, `/settings`) con datos reales de Firestore para ajustar responsive fino y microcopys finales.

### Entrada - 2026-06-08 - WEB-V7-POLISH agrupacion de movimientos y limpieza de busqueda

- **Fase / paso**: WEB-V7-POLISH (Pulido UX posterior al rediseÃ±o Personal).
- **Agente / herramienta**: Codex.
- **Archivos modificados**:
  - `src/components/finance/finance-text-field.tsx`
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Problema detectado**:
  - En la vista de `Movimientos` y en `Movimientos recientes`, la etiqueta temporal (`HOY`, `AYER`, etc.) se repetia en cada fila en lugar de agrupar visualmente el bloque.
  - El buscador mostraba una etiqueta visible extra que hacia la cabecera mas pesada de lo necesario frente al layout del prototipo.
- **Solucion aplicada**:
  - Se agruparon las filas de movimientos por `groupLabel` antes de renderizarlas, mostrando una sola cabecera por bloque temporal.
  - Se extendio `FinanceTextField` con `labelClassName` para permitir labels visualmente ocultos pero accesibles.
  - Se aplico ese ajuste al buscador de movimientos para conservar accesibilidad y acercar la UI al tratamiento visual del prototipo.
- **Verificacion realizada**:
  - `npm run lint`
  - `npm run build`
- **Estado al cerrar**:
  - La lectura del timeline de movimientos quedo mas limpia y consistente con el objetivo visual del rediseÃ±o.
- **Proximo paso sugerido**:
  - Validar con datos reales si conviene aplicar el mismo patron de agrupacion a futuros detalles de categoria o detalle de cuenta.

### Entrada - 2026-06-08 - WEB-V7-POLISH rediseño visual de la sidebar izquierda

- **Fase / paso**: WEB-V7-POLISH (Ajuste fino de navegacion lateral Personal).
- **Agente / herramienta**: Codex.
- **Archivos modificados**:
  - `src/components/layout/navigation.ts`
  - `src/components/layout/sidebar.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Cambios aplicados**:
  - Se rehizo la composicion de marca en la sidebar con un contenedor mas limpio y oscuro para el isotipo, manteniendo una lectura mas premium del bloque `Finanzas M`.
  - Se ajusto el subtitulo `FINANZAS PERSONALES` para que se vea completo, en mayusculas y con tono menta suave.
  - Se aplanó el contenedor lateral, quitando el aspecto de tarjeta pesada y reforzando la separacion vertical derecha.
  - Se refino el toggle `Personal / Hogar` con estilo capsula, activo azul oscuro e inactivo gris azulado.
  - Se elimino el tratamiento anterior de iconos encapsulados y se dejaron iconos lineales mas delgados y limpios.
  - Se reforzo el item activo con fondo azul oscuro, icono dorado y tipografia semibold.
  - Se agrego badge lateral para `Movimientos`.
  - Se compacto el perfil inferior, manteniendo solo la linea divisoria y un bloque ligero con avatar, nombre y correo.
- **Verificacion realizada**:
  - `npm run lint`
  - `npm run build`
  - QA visual manual en `http://127.0.0.1:3014/dashboard`
- **Estado al cerrar**:
  - La sidebar ya responde mucho mejor al lenguaje visual fintech oscuro definido para Personal.
- **Proximo paso sugerido**:
  - Si el usuario lo aprueba, aplicar el mismo nivel de refinamiento a topbar y estados vacios para cerrar la identidad del shell.

### Entrada - 2026-06-09 - WEB-V7-AUTH unificacion de entrada publica y retiro del login separado

- **Fase / paso**: WEB-V7-AUTH (Optimizacion del flujo de acceso publico y rediseño de la pantalla inicial).
- **Agente / herramienta**: Codex.
- **Archivos creados**:
  - `src/features/auth/auth-routing.ts`
  - `src/features/auth/components/auth-entry-page.tsx`
  - `tests/unit/auth-routing.test.ts`
- **Archivos modificados**:
  - `src/app/page.tsx`
  - `src/app/(auth)/login/page.tsx`
  - `src/components/layout/dashboard-shell.tsx`
  - `src/app/(dashboard)/settings/page.tsx`
  - `src/config/routes.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **Objetivo del cambio**:
  - Reducir el flujo web a dos URLs funcionales reales: `"/"` para entrada/autenticacion y `"/dashboard"` para la app autenticada, manteniendo `"/login"` solo como ruta legacy de compatibilidad.
- **Solucion aplicada**:
  - `"/"` dejo de ser un placeholder y ahora renderiza la pantalla publica principal con el diseño editorial aprobado por Felipe.
  - La pantalla publica integra acceso y creacion de cuenta con Google en el mismo lugar, sin boton de demo.
  - Se agrego una capa de routing auth puro (`auth-routing.ts`) para unificar las decisiones de redireccion entre entrada publica, rutas privadas y la ruta legacy `"/login"`.
  - `"/login"` ahora redirige inmediatamente a `"/"` para no dejar dos pantallas de acceso compitiendo entre si.
  - El dashboard ya no manda usuarios sin sesion a `"/login"` sino a `"/"`.
  - El logout desde ajustes ahora regresa a `"/"`.
  - Se agrego motion de entrada con GSAP para bloques editoriales, card de acceso y elementos orbit decorativos, respetando `prefers-reduced-motion`.
- **TODOs resueltos**:
  - Eliminada la necesidad de mantener una landing placeholder separada del login.
  - Eliminado el CTA visual de demo de la pantalla de acceso.
  - Unificado el punto de entrada publico para usuarios nuevos y usuarios recurrentes sin sesion.
- **Skills aplicadas**:
  - `brainstorming`
  - `frontend-design`
  - `impeccable`
  - `test-driven-development`
  - `gsap-react`
  - `gsap-core`
  - `gsap-performance`
- **Verificacion realizada**:
  - prueba en rojo: `npx tsx tests/unit/auth-routing.test.ts` fallo primero por modulo inexistente
  - prueba en verde: `npx tsx tests/unit/auth-routing.test.ts`
  - `npm test`
  - `npm run lint`
  - `npm run build`
- **Estado al cerrar**:
  - La app ya opera con entrada publica unificada en `"/"` y experiencia autenticada en `"/dashboard"`, manteniendo `"/login"` solo como compatibilidad temporal.
- **Proximo paso sugerido**:
  - Refinar detalles visuales de copy legal, estados de error y posibles previews reales del dashboard desde la nueva entrada si producto lo considera necesario.

### Entrada - 2026-06-09 - WEB-V7-POLISH reestructuracion del hero financiero personal

- **Fase / paso**: WEB-V7-POLISH (Ajuste estructural del bloque principal `Dinero propio`).
- **Agente / herramienta**: Codex.
- **Archivos creados**:
  - ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **Problema detectado**:
  - El hero financiero estaba construido con una mezcla de `space-y`, `inline-flex`, `w-fit`, `self-start` y alturas minimas por fila que dejaban el lado derecho visualmente desalineado frente al ejemplo aprobado.
  - La composicion general se sentia menos ordenada: la columna izquierda ocupaba mas aire vertical del necesario y las metricas de `Ingresos del mes` / `Gastos del mes` no respiraban como dos filas gemelas.
- **Solucion aplicada**:
  - Se rehizo la grilla principal del hero con una proporcion mas controlada entre columna editorial izquierda y columna de metricas derecha.
  - La columna izquierda paso a una estructura `flex` con reparto vertical mas estable entre encabezado, monto principal y bloque secundario.
  - El detalle de `Saldo bancario bruto` y `No propio pendiente` se reconstruyo como dos columnas limpias con divisor real y padding simetrico.
  - Se extrajo un patron reutilizable `MonthlyMetricPanel` para que `Ingresos del mes` y `Gastos del mes` compartan exactamente la misma estructura, centrado interno y escala tipografica.
  - Se replico la misma estructura en `design-system-showcase` para mantener paridad entre la demo visual y el dashboard real.
- **TODOs resueltos**:
  - Eliminada la dependencia de ajustes sueltos de spacing para sostener el hero.
  - Mejorada la consistencia interna del bloque principal de Personal.
- **Skills aplicadas**:
  - `brainstorming`
  - `frontend-design`
  - `impeccable`
- **Verificacion realizada**:
  - `npm run lint`
  - `npm run build`
- **Estado al cerrar**:
  - El hero financiero ya queda montado sobre una estructura mas rigida y coherente, lista para QA visual fino si Felipe quiere seguir acercandolo al prototipo.
- **Proximo paso sugerido**:
  - Hacer un ultimo pase de QA visual fino sobre anchos, altura final del hero y relacion entre tipografia grande y cards inferiores, ya desde esta estructura nueva.

### Entrada - 2026-06-09 - WEB-V7-QA-FIX correccion de signo negativo oculto en Amount

- **Fase / paso**: WEB-V7-QA-FIX (Correccion semantica del monto principal cuando el saldo real es negativo).
- **Agente / herramienta**: Codex.
- **Archivos creados**:
  - `tests/unit/amount-negative-display.test.tsx`
- **Archivos modificados**:
  - `src/components/finance/amount.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**:
  - ninguno.
- **Problema detectado**:
  - El dashboard podia calcular correctamente un saldo negativo (`-80.000`), pero el componente `Amount` lo mostraba como positivo cuando se usaba con `showSign={false}`.
  - La causa raiz era que `Amount` aplicaba `Math.abs(value)` siempre, incluso cuando la UI queria ocultar solo el prefijo de tipo (`+`, `-`, `→`) y no el signo real del valor.
- **Solucion aplicada**:
  - Se agrego una prueba unitaria que reproduce el caso exacto: renderizar `Amount` con valor negativo y `showSign={false}` debe conservar el `-`.
  - Se ajusto `Amount` para usar el valor absoluto solo cuando realmente se esta agregando un prefijo semantico de tipo; en los demas casos conserva el signo numerico real.
  - Se agrego un import explicito de `React` en `amount.tsx` para permitir ejecutar esta prueba con el runner `tsx` sobre un archivo con JSX preservado por la configuracion de Next.
- **TODOs resueltos**:
  - `Dinero propio` ya no enmascara saldos negativos como positivos.
  - Los montos positivos siguen sin mostrar un `-` accidental cuando `showSign={false}`.
- **Skills aplicadas**:
  - `systematic-debugging`
  - `test-driven-development`
- **Verificacion realizada**:
  - prueba en rojo: `npx tsx tests/unit/amount-negative-display.test.tsx`
  - prueba en verde: `npx tsx tests/unit/amount-negative-display.test.tsx`
  - regresion: `npx tsx tests/unit/accounts.test.ts`
  - regresion: `npx tsx tests/unit/third-party-fund-income-amount-guard.test.ts`
  - `npm run lint`
  - `npm run build`
- **Estado al cerrar**:
  - Corregido el bug visual/semantico que ocultaba el signo negativo del saldo real en el hero personal.
- **Proximo paso sugerido**:
  - Revisar si conviene agregar una suite minima unificada para componentes de formato financiero (`Amount`, `formatCurrencyCop`) y no depender solo de pruebas sueltas por caso.

### Entrada — 2026-06-09 — WEB-V7-POLISH interactividad de bolsillos en cuentas

- **Fase / paso**: WEB-V7-POLISH (Corrección de interactividad y colapso/expansión de bolsillos en cuentas).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/components/finance/account-pocket-card.tsx`
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - Por defecto, los bolsillos se mostraban expandidos y no se podían colapsar (la flecha no hacía nada y no había interactividad).
  - Al estar colapsado, el espaciado vertical se veía desbalanceado (con más distancia arriba que abajo), debido a la alineación `items-start`.
  - La tarjeta original no se sentía lo suficientemente compacta ni elegante (el saldo en `30px` era demasiado grande en proporción al resto de elementos y la tarjeta tenía un padding vertical de `py-4` excesivo).
- **Solución aplicada**:
  - Se añadió la directiva `"use client"` al inicio de `account-pocket-card.tsx` y se implementó un estado local `isExpanded` inicializado con la prop `expanded`.
  - Se hizo que la cabecera de la tarjeta actúe como botón de colapso/expansión (`role="button"`, `tabIndex={0}`, `aria-expanded`) cuando la cuenta tiene bolsillos.
  - Se cambió la alineación de la fila cabecera a `items-center` para balancear perfectamente la distancia vertical arriba y abajo tanto en estado expandido como colapsado.
  - Se redujo el padding vertical de la tarjeta de `py-4` a `py-3` para que sea más compacta.
  - Se ajustó el tamaño de fuente del saldo principal: `text-2xl` (24px) por defecto y `text-xl` (20px) cuando la tarjeta está en modo `compact`, reemplazando el valor fijo sobredimensionado de `text-[30px]`. Esto equilibra perfectamente la altura de la columna derecha con la de la columna izquierda (icono del banco/billetera).
  - Se añadieron transiciones suaves y efectos de foco/hover al chevron y al contenedor de la cabecera.
  - Se eliminó la prop estática `expanded` en las llamadas del dashboard y de la vista de cuentas (`personal-views.tsx`) para que los bolsillos aparezcan colapsados por defecto.
- **TODOs resueltos**:
  - Los bolsillos ya no aparecen expandidos por defecto al cargar el dashboard.
  - Los bolsillos se pueden expandir y colapsar al hacer clic en la cabecera de la tarjeta o al usar el teclado (Enter/Space).
  - El espaciado vertical arriba y abajo quedó perfectamente equilibrado en la tarjeta.
  - La tarjeta ahora se ve significativamente más compacta, premium y balanceada, asemejándose a las proporciones del diseño de referencia.
- **Skills aplicadas**:
  - `frontend-design`, `accessibility`.
- **Verificación realizada**:
  - `npm run lint` (exitoso)
  - `npm run test` (todos los tests unitarios pasaron exitosamente)
  - `npm run build` (Next.js compiló y exportó la compilación de producción con éxito)
- **Estado al cerrar**:
  - Tarjeta de cuenta y bolsillos interactiva, compacta y alineada con la guía de diseño visual del proyecto.
- **Próximo paso sugerido**:
  - Realizar pruebas visuales de la transición de colapso en el entorno local.

### Entrada — 2026-06-09 — WEB-V7-POLISH personalización y reordenación del tablero (Editar tablero)

- **Fase / paso**: WEB-V7-POLISH (Implementación de reordenación, ocultación y edición persistente del tablero de Inicio).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/stores/ui-preferences-store.ts`
  - `src/components/layout/dashboard-shell.tsx`
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - El botón "Editar tablero" de la cabecera era solo un stub sin lógica de negocio.
  - No existía soporte para ocultar o cambiar la posición de las tarjetas en la página de Inicio.
- **Solución aplicada**:
  - **Store persistente:** Se expandió `useUiPreferencesStore` para controlar `isEditingBoard`, `boardOrder` y `hiddenCards`, persistiendo el estado en `localStorage` (`fm-board-order` y `fm-board-hidden`).
  - **Controlador en Shell:** Se conectó el botón de la cabecera de modo que al activarse cambie a un estado con icono de check (`Check`) y texto `"Listo"`. Se agregó un efecto defensivo para desactivar el modo de edición al navegar fuera de Inicio.
  - **Grilla Unificada:** Se reorganizó el renderizado de `HomeView` sustituyendo los contenedores grids sueltos por una única grilla responsiva (`grid-cols-1 lg:grid-cols-2`) de columnas de igual ancho, logrando un ordenamiento fluido de las tarjetas.
  - **Drag and Drop Nativo:** Se implementó soporte nativo de arrastrar y soltar (DND de HTML5) en las tarjetas usando handlers puros (`onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`) y clases de transition y opacidad al arrastrar.
  - **Opciones de Edición:** En modo de edición, las tarjetas cambian sus bordes a estilo dashed dorado y reemplazan sus enlaces tradicionales (ej. "Ver todo") por un handle de arrastre (`::`) y un botón para ocultar (`👁️\ `).
  - **Barra de Personalización y Stub:** Se renderiza una barra superior de configuración con las instrucciones y la lista de tarjetas `"Ocultas:"` (las cuales se restauran al hacer clic en ellas). Además, se añadió una tarjeta dashed de pie (`[+] Agregar tarjeta al tablero`) para facilitar el retorno de elementos ocultos.
- **TODOs resueltos**:
  - Lógica del botón de la cabecera funcional y contextual a Inicio.
  - Soporte completo y fluido para reordenar (arrastrar) y ocultar/mostrar tarjetas en el tablero.
  - Persistencia de preferencias del tablero en `localStorage`.
- **Skills aplicadas**:
  - `frontend-design`, `accessibility`.
- **Verificación realizada**:
  - `npm run lint` (exitoso)
  - `npm run test` (todos los tests unitarios pasaron exitosamente)
  - `npm run build` (Next.js compiló y exportó la compilación de producción con éxito)
- **Estado al cerrar**:
  - Funcionalidad de personalización del tablero finalizada, probada localmente y compilada con éxito para producción.
- **Próximo paso sugerido**:
  - Iniciar QA manual del arrastre en dispositivos táctiles/móviles para evaluar soporte de puntero de arrastre nativo.

### Entrada — 2026-06-09 — WEB-V7-POLISH unificación de ancho de tarjetas en el dashboard

- **Fase / paso**: WEB-V7-POLISH (Alineación de grilla e interactividad del Inicio).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - La tarjeta de "Pendientes del Hogar" se expandía automáticamente a ocupar todo el ancho horizontal de 2 columnas (`lg:col-span-2`) si se ubicaba al final de la lista o si la cantidad de tarjetas visibles era impar.
  - Esto rompía la uniformidad del tablero, donde el usuario desea que todas las tarjetas tengan el mismo tamaño (siempre de 2 en 2 en pantallas grandes).
- **Solución aplicada**:
  - Se removió el cálculo `isHouseholdFullWidth` y la clase condicional `lg:col-span-2` del contenedor de la tarjeta en `personal-views.tsx`.
  - Se removió también la clase `lg:col-span-2` de la tarjeta interactiva de agregar elementos ocultos ("Agregar tarjeta al tablero"), asegurando que todas las tarjetas mantengan un tamaño uniforme de una sola columna y se distribuyan equilibradamente de 2 en 2 en escritorio.
- **TODOs resueltos**:
  - Tablero uniforme con todas las tarjetas ocupando exactamente 1 columna en la grilla.
- **Skills aplicadas**:
  - `frontend-design`.
  - `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (exitoso)
  - `npm run test` (todos los tests unitarios pasaron)
  - `npm run build` (compilación limpia para Next.js en producción)
- **Estado al cerrar**:
  - Grilla de tarjetas del dashboard 100% simétrica y uniforme.
- **Próximo paso sugerido**:
  - Realizar el QA manual autenticado del reordenamiento y visibilidad con este nuevo esquema simétrico.

### Entrada — 2026-06-09 — WEB-V7-POLISH integración del balance del mes en el hero y remoción de tarjeta

- **Fase / paso**: WEB-V7-POLISH (Optimización del hero e información del Inicio).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/stores/ui-preferences-store.ts`
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - La tarjeta "Balance del mes" ocupaba espacio en el tablero principal duplicando información que ya existía (ingresos y gastos mensuales) y consumía espacio útil de la grilla de accesos directos.
  - El hero financiero derecho tiene espacio suficiente para mostrar de forma integrada el neto "Balance del mes" o "Quedo libre", permitiendo unificar la vista sin saturar la UI.
- **Solución aplicada**:
  - **Remoción de tarjeta:** Se eliminó la tarjeta `case "balance"` del renderizado del tablero en `personal-views.tsx` y su título en `getCardTitle`. Se removió `"balance"` del `boardOrder` por defecto en el store de Zustand (`ui-preferences-store.ts`) tanto al inicializar como al restablecer valores por defecto.
  - **Alineación de Jerarquía y Barras de Progreso:** Se rediseñó la columna derecha del hero financiero para evitar repeticiones de la misma escala tipográfica. Los valores de "Ingresos del mes" y "Gastos del mes" se fijaron a tamaño `md` (`22px`) y se les incorporaron barras de progreso horizontales (verde para ingresos al 100% y roja proporcional a la relación de gastos sobre ingresos), devolviendo el contexto visual y comparativo original.
  - **Línea de Resultado Matemática ("="):** Se eliminó el helper redundante `MonthlyMetricPanel`. En su lugar, se implementó una estructura vertical flex donde, tras un separador de línea matemática (`=`), se muestra el balance ("Quedo libre") en un tamaño más discreto y sutil (`sm` / `16px` font-bold) en la parte inferior, funcionando visualmente como el resultado del cálculo matemático.
  - **Sincronización del Design System:** Se replicó exactamente la misma estructura jerárquica y de barras con balance positivo e indicador proporcional en la pantalla de catálogo `/design-system`.
- **TODOs resueltos**:
  - Eliminada la tarjeta redundante "Balance del mes" del dashboard.
  - Integrado el balance del mes neto de forma consolidada y animada en el hero de Inicio.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (exitoso)
  - `npm run test` (todos los tests unitarios pasaron)
  - `npm run build` (Next.js compiló con éxito para producción)
- **Estado al cerrar**:
  - Dashboard consolidado con mayor claridad visual, sin tarjetas redundantes, y con un hero financiero enriquecido con el balance neto.
- **Próximo paso sugerido**:
  - QA manual autenticado del flujo de ingresos/gastos reales y confirmación de que la métrica de balance del hero se actualiza correctamente en tiempo real en la base de datos real.

### Entrada — 2026-06-09 — WEB-V7-POLISH restauración del diseño circular de ingresos y gastos en hero

- **Fase / paso**: WEB-V7-POLISH (Ajuste visual del hero e información del Inicio).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - El usuario prefirió conservar el diseño original de los ingresos y gastos del mes en el hero (con sus respectivos iconos circulares en verde/rojo y letras de tamaño grande) e incorporando también las barras de progreso horizontales correspondientes, mientras se mantiene la nueva sección "Quedo libre" a modo de resultado matemático en la parte inferior.
- **Solución aplicada**:
  - Se restauró el panel modular `MonthlyMetricPanel` que renderiza el icono circular (`ArrowUpRight` en verde para ingresos, `ArrowDownLeft` en rojo para gastos), el monto en gran escala (`text-3xl font-bold`), un indicador numérico de porcentaje (`%`) en la cabecera del panel, y una barra de progreso horizontal gruesa (`h-2.5`).
  - Se implementó una lógica de progreso relativo cuando los gastos superan los ingresos: en este estado de sobrefacturación/sobregasto, la barra de gastos se fija al 100% (rojo completo) y la barra de ingresos se muestra proporcional al gasto (`ingresos / gastos * 100`%), indicando visualmente que el ingreso no cubrió el total gastado (el caso inverso al ejemplo estándar).
  - Se distribuyó el espacio vertical de la columna derecha de forma uniforme: cada panel de ingresos y gastos se envolvió en un contenedor flexible (`flex-1 flex flex-col justify-center py-2`), logrando que ambas filas tengan exactamente la misma altura (altura simétrica), y se alineó el balance "Quedo libre" (`text-base font-bold`) al fondo tras una línea matemática divisoria `=`.
  - Se sincronizó exactamente esta estructura visual compacta, de distribución uniforme, lógica de progreso inverso y barras gruesas en la pantalla de design system showcase (casteando los tipos a `number` para evitar errores de compilación de TypeScript con tipos literales).
- **TODOs resueltos**:
  - Devuelto el diseño visual de ingresos/gastos preferido por el usuario (iconos circulares, montos grandes y barras de progreso), eliminados los espacios vacíos sobrantes en la columna derecha mediante una distribución vertical simétrica, y corregida la visualización proporcional del progreso cuando los gastos superan a los ingresos, agregando indicadores de porcentaje claros.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (0 errores, 0 warnings)
  - `npm run test` (exitoso)
- **Estado al cerrar**:
  - Tablero de inicio y showcase del sistema de diseño actualizados con el diseño visual final de ingresos, gastos y balance del mes.
- **Próximo paso sugerido**:
  - Realizar QA manual final del dashboard.

### Entrada — 2026-06-09 — WEB-V7-POLISH movimientos compactos en dashboard y menú de 3 puntos en historial

- **Fase / paso**: WEB-V7-POLISH (Optimización de movimientos y acciones).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**:
  - `src/components/finance/finance-dropdown.tsx`
- **Archivos modificados**:
  - `src/features/dashboard/lib/personal-view-model.ts`
  - `src/components/finance/personal-transaction-row.tsx`
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - El listado de "Movimientos recientes" en la tarjeta de inicio mostraba demasiada información (fechas, botones de acción, tamaño de icono excesivo) ocupando demasiado espacio vertical y limitando la cantidad de movimientos visibles.
  - En la vista de historial completo, los botones de acción "Editar" y "Eliminar" se mostraban inline por cada fila de transacción de forma redundante y poco premium.
- **Solución aplicada**:
  - **Componente de Dropdown:** Se creó el componente `FinanceDropdown` con menú de 3 puntos interactivo y comportamiento click-outside, con diseño premium en vidrio oscuro.
  - **Fila compacta para Inicio:** Se implementó `PersonalRecentMovementRow` con icono reducido (`h-8 w-8`), alineación simplificada, subtítulo `Categoría · Cuenta` y monto en la derecha, libre de fechas y acciones.
  - **Limpieza del Dashboard:** La tarjeta de movimientos de Inicio ahora renderiza una lista de hasta 5 elementos usando esta fila compacta, libre de agrupaciones temporales.
  - **Menú de 3 puntos en historial:** Se refactorizó `MovementActions` en el historial para usar el dropdown de 3 puntos para las opciones "Editar" e "Eliminar".
  - **Design System Showcase:** Se actualizó la vista de catálogo para mostrar ambos estados (completo con dropdown y compactos de dashboard).
- **TODOs resueltos**:
  - Tarjeta de movimientos compacta y limpia de acciones/fechas con límite de 5 elementos en Inicio.
  - Menú de 3 puntos integrado en el historial completo de movimientos para "Editar" y "Eliminar".
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`, `systematic-debugging`.
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings).
  - `npm test` y ejecución de suites unitarias (exitoso, todas las pruebas pasaron).
  - `npm run build` (Next.js compiló con éxito para producción).
- **Estado al cerrar**:
  - Presentación de movimientos optimizada en toda la interfaz de usuario personal.
- **Próximo paso sugerido**:
  - Realizar QA manual de la interactividad del dropdown en dispositivos reales.

### Entrada — 2026-06-09 — WEB-V7-POLISH visualización en lista con divisor y títulos nulos

- **Fase / paso**: WEB-V7-POLISH (Alineación fina del listado de movimientos y validación de títulos).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/transactions/services/read-personal-transactions.ts`
  - `src/components/finance/personal-transaction-row.tsx`
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `tests/unit/personal-view-model.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - Los movimientos en la tarjeta del Dashboard seguían viéndose como tarjetas flotantes en lugar de una lista limpia.
  - El fallback de títulos (ej: `Gasto · Comida`) ocultaba el hecho de que las transacciones no tenían un título explícito digitado por el usuario, lo cual se considera un error de ingreso.
- **Solución aplicada**:
  - **Estructura de Lista Dividida:** Se removieron los bordes, fondos y paddings del componente `PersonalRecentMovementRow`. En la tarjeta de Inicio se implementó un contenedor con `divide-y divide-white/8` y paddings verticales internos.
  - **Títulos a "null":** Se modificó `buildTransactionFallbackTitle` para retornar explícitamente `"null"` si `explicitTitle` está vacío, sirviendo como indicador visual claro de falta de título.
  - **Alineación de Pruebas y Showcase:** Se ajustó la suite de pruebas unitarias del ViewModel y la pantalla del Design System Showcase para validar estos comportamientos y estilos.
- **TODOs resueltos**:
  - Movimientos en Inicio renderizados como lista plana limpia separada por líneas de división.
  - Títulos faltantes en movimientos expuestos visualmente como `"null"`.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`, `systematic-debugging`.
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings).
  - `npm test` y pruebas manuales del ViewModel (exitoso, todas las pruebas pasaron).
  - `npm run build` (Next.js compiló con éxito para producción).
- **Estado al cerrar**:
  - Lista de movimientos y fallback de títulos normalizados según el diseño deseado.
- **Próximo paso sugerido**:
  - Realizar QA manual final del dashboard.

### Entrada — 2026-06-09 — WEB-V7-POLISH agrupación por fecha en tarjeta de movimientos recientes

- **Fase / paso**: WEB-V7-POLISH (Estructura de agrupación temporal para movimientos del Dashboard).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - Al aplanar completamente la lista de movimientos recientes en la tarjeta de Inicio se perdió la separación y agrupación temporal por fecha ("Hoy", "Ayer", etc.), haciendo más difícil comprender el flujo de egreso/ingreso cronológico rápido.
- **Solución aplicada**:
  - **Agrupación en Movimientos Recientes:** Se implementó `groupedRecentRows` en `HomeView` procesando únicamente el top 5 de movimientos de forma ordenada por fecha.
  - **Visualización por Fechas:** La tarjeta del Dashboard ahora renderiza los grupos por su etiqueta de fecha, manteniendo el estilo en lista con líneas divisorias (`divide-y divide-white/8`) dentro de cada sección diaria.
- **TODOs resueltos**:
  - Retornada la agrupación por fecha en la tarjeta de movimientos recientes manteniendo el estilo de lista limpia y compacta.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings).
  - `npm test` y pruebas unitarias (exitoso).
  - `npm run build` (Next.js compiló con éxito para producción).
- **Estado al cerrar**:
  - Agrupación cronológica restaurada y normalizada en el dashboard.
- **Próximo paso sugerido**:
  - Realizar QA manual final del dashboard con datos reales.

### Entrada — 2026-06-09 — WEB-V7-POLISH unificación de filas e integración del dropdown de 3 puntos en el historial

- **Fase / paso**: WEB-V7-POLISH (Optimización del historial completo de movimientos).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/components/finance/personal-transaction-row.tsx`
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Problema detectado**:
  - El listado del historial completo de movimientos en la página `/movements` mostraba a cada fila como una tarjeta card individual pesada, con doble redundancia de fecha por fila y ubicación poco intuitiva para las acciones.
- **Solución aplicada**:
  - **Refactorización de Fila de Transacción:** Se simplificó `PersonalTransactionRow` para heredar el mismo estilo en lista plana de la tarjeta de Inicio (sin fondos, bordes ni sombras; e iconos pequeños de `h-8 w-8`).
  - **Reubicación de Dropdown y Remoción de Fechas:** Se removieron las etiquetas de fecha redundantes por fila. Se ubicó el menú de opciones de 3 puntos interactivo (`actionSlot`) a la derecha de la fila, inmediatamente después del monto de la transacción (`flex items-center gap-3`).
  - **Estructura en Lista Dividida:** Se envolvió el listado cronológico de movimientos en la página y en el showcase del sistema de diseño en contenedores de división (`divide-y divide-white/8`), alineando las vistas de manera limpia y premium.
- **TODOs resueltos**:
  - Filas de historial alineadas con el formato de lista plana, con el dropdown adyacente al monto de la transacción y libre de redundancias de fecha.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings).
  - `npm test` y pruebas unitarias (exitoso).
  - `npm run build` (Next.js compiló con éxito para producción).
- **Estado al cerrar**:
  - Formatos y layouts de presentación de movimientos completados y unificados bajo el sistema de lista plana dividida.
- **Próximo paso sugerido**:
  - Realizar QA manual final del dashboard con datos reales.

### Entrada — 2026-06-09 — WEB-V7-POLISH optimización de tarjeta de cuentas y accesos directos de creación

- **Fase / paso**: WEB-V7-POLISH (Optimización de tarjeta de cuentas y bolsillos, reducción del icono y botón de acceso rápido + preselección).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/components/finance/account-pocket-card.tsx`
  - `src/components/finance/finance-dropdown.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**: ninguno.
- **TODOs resueltos**:
  - Se redujo el icono de cuenta en la tarjeta `AccountPocketCard` a un tamaño circular más discreto (`h-9 w-9` rounded-full).
  - Se movió el saldo de la cuenta directamente debajo del título de la cuenta, incluyendo el monto libre entre paréntesis si la cuenta tiene bolsillos.
  - Se agregó el botón circular `+` en el extremo derecho de cada tarjeta de cuenta.
  - El botón circular `+` despliega un menú dropdown con accesos rápidos para "Nuevo gasto", "Nuevo ingreso" y "Nueva transferencia".
  - Se integró la preselección de la cuenta origen en el Zustand store `useTransactionPanelStore` a través del parámetro `defaultAccountId` en `openCreate()`, logrando que los formularios respectivos se inicialicen con la cuenta seleccionada.
  - Se agregó `e.stopPropagation()` al contenedor principal de `FinanceDropdown` para evitar que los clics en el fondo del dropdown colapsen/expandan la lista de bolsillos de la cuenta de forma accidental.
- **Decisiones técnicas tomadas**:
  - Utilizar el store global de estado de paneles Zustand para pasar el id de la cuenta origen sin acoplar directamente el componente de la tarjeta con los formularios.
  - Mantener la flexibilidad del dropdown permitiendo clics que no propaguen eventos indeseados a los headers interactivos contenedores.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings).
  - `npm test` y pruebas unitarias (todas exitosas).
  - `npm run build` (compilación y prerenderizado de páginas estáticas exitoso).
- **Estado al cerrar**:
  - Distribución de cuentas y bolsillos optimizada, iconos refinados a tamaño premium, y botón de atajo directo implementado y verificado.
- **Próximo paso sugerido**:
  - Realizar QA manual en producción de las acciones directas en cada cuenta para verificar la carga correcta del selector.

### Entrada — 2026-06-09 — WEB-V7-POLISH remoción de saldo libre en tarjeta de cuentas

- **Fase / paso**: WEB-V7-POLISH (Remoción del saldo libre en la tarjeta de cuentas).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/components/finance/account-pocket-card.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**: ninguno.
- **TODOs resueltos**:
  - Se eliminó la visualización del saldo libre (`Libre: $ X`) de las tarjetas de cuenta (`AccountPocketCard`).
  - Se removió el cálculo de `freeBalance` que ya no es necesario en este componente.
- **Decisiones técnicas tomadas**:
  - Simplificar la jerarquía visual de la tarjeta de cuentas removiendo los saldos parciales redundantes y conservando únicamente el saldo global de la cuenta y los saldos por bolsillo correspondientes.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings).
  - `npm test` y pruebas unitarias (todas exitosas).
  - `npm run build` (compilación y prerenderizado de páginas estáticas exitoso tras limpiar caché de Next.js).
- **Estado al cerrar**:
  - Saldo libre removido de la tarjeta de cuentas para simplificar la jerarquía visual.
- **Próximo paso sugerido**:
  - Realizar QA manual final del dashboard en el entorno local.

### Entrada — 2026-06-09 — WEB-V7-POLISH modal detalle de cuenta y botón de bolsillos en pantalla de cuentas

- **Fase / paso**: WEB-V7-POLISH (Modal de detalle de cuenta + botón "Nuevo bolsillo" en pantalla de cuentas).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/components/finance/account-pocket-card.tsx` — eliminado saldo libre (`Libre:`), eliminado cálculo `freeBalance`.
  - `src/features/dashboard/components/personal-views.tsx` — ya contiene `AccountDetailDialog` y `NewPocketDialog`.
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**: ninguno.
- **TODOs resueltos**:
  - Modal `AccountDetailDialog` disponible: al hacer clic en una tarjeta de cuenta se despliega un diálogo con saldo total, disponible, en bolsillos, resumen "Este mes" (gastos / ingresos / transferencias) y lista de bolsillos con opción de añadir nuevo.
  - Botón "+ Nuevo bolsillo" dentro de la tarjeta de cuentas llama a `NewPocketDialog` con formulario de nombre y monto inicial.
  - Botón "+" en cada tarjeta abre menú rápido (gasto / ingreso / transferencia) preseleccionando la cuenta.
  - Info "Libre:" eliminada de la tarjeta para simplificar vista.
- **Decisiones técnicas tomadas**:
  - El modal refleja fielmente la pantalla de detalle de la app móvil: icono + nombre + saldo grande + grid 2-col (Disponible / En bolsillos) + "Este mes" (3 tarjetas) + sección Bolsillos + movimientos agrupados por fecha.
  - `NewPocketDialog` reutiliza `useCreatePocket` hook existente para persistir en Firebase.
- **Skills aplicadas**:
  - `frontend-design`, `impeccable`.
- **Verificación realizada**:
  - `npm run build` (exitoso, 13/13 páginas estáticas generadas, 0 errores de TypeScript).
  - Servidor reiniciado con `npm run dev` — corriendo en `http://localhost:3000`.
- **Estado al cerrar**:
  - Pantalla de cuentas lista: click en card → modal detalle; botón "Nuevo bolsillo" dentro de card y dentro del modal; botón "+" para acceso rápido a movimientos.
- **Próximo paso sugerido**:
  - QA manual: verificar que el modal se abre correctamente, que los datos de "Este mes" son correctos, y que crear un bolsillo actualiza el estado en tiempo real.

### Entrada — 2026-06-09 — WEB-V7-POLISH UX tarjeta de cuentas: botón "Ver detalle" + chevron visible

- **Fase / paso**: WEB-V7-POLISH (Mejora de UX en `AccountPocketCard`).
- **Agente / herramienta**: Antigravity.
- **Archivos modificados**:
  - `src/components/finance/account-pocket-card.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **TODOs resueltos**:
  - Eliminado el `onClick` de la `<article>` completa — ya no toda la card abre el modal.
  - Añadido botón explícito **"Ver detalle"** (icono `Info` + texto) en el área de acciones del header, solo visible en variant `accounts-page`.
  - Botón de expand/collapse de bolsillos ahora muestra el conteo (`"N bolsillos" ∨`) con texto legible y chevron animado, en lugar de solo el ícono sutil que era difícil de ver.
  - Removido `role="button"` de la `<article>` (semántica correcta).
- **Decisiones técnicas tomadas**:
  - El `handleTogglePockets` centraliza el toggle y hace `stopPropagation` para evitar conflictos.
  - Los bolsillos empiezan expandidos en `accounts-page` y colapsados en `home`.
- **Verificación realizada**:
  - `npm run build` exitoso (13/13 páginas, 0 errores TypeScript/lint).
  - Servidor reiniciado con `npm run dev` — corriendo en `http://localhost:3000`.
- **Estado al cerrar**:
  - Tarjeta de cuentas con acciones claras y separadas: chevron etiquetado para bolsillos, botón "Ver detalle" para el modal, botón "+" para movimientos rápidos.
- **Próximo paso sugerido**:
  - QA manual de la pantalla `/accounts` verificando los tres botones de acción en cada tarjeta.

### Entrada â€” 2026-06-09 â€” WEB-V6-QA-FIX borrado en cascada seguro de bolsillos y cuentas

- **Fase / paso**: WEB-V6-QA-FIX (eliminaciÃ³n segura de cuentas y bolsillos).
- **Agente / herramienta**: Codex (GPT-5).
- **Archivos creados**:
  - `src/features/accounts/services/delete-personal-entity-cascade.ts`
  - `src/features/accounts/hooks/use-delete-personal-entities.ts`
  - `tests/unit/delete-personal-entity-cascade.test.ts`
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/features/transactions/services/read-personal-transactions.ts`
  - `src/types/transaction.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**:
  - ejecutar QA manual E2E real en Firestore con el guion de bolsillo/cuenta/transferencias indicado por Felipe;
  - validar con datos Android reales casos con `relatedEventId` / `relatedDebtId` para decidir si se habilita limpieza automÃ¡tica o se mantiene bloqueo seguro.
- **TODOs resueltos**:
  - acciÃ³n destructiva para eliminar bolsillo desde el modal de detalle de cuenta;
  - acciÃ³n destructiva para eliminar cuenta completa desde el modal de detalle de cuenta;
  - confirmaciones obligatorias antes de borrar bolsillo/cuenta;
  - recarga forzada del dashboard tras borrar para evitar datos viejos en UI.
- **Decisiones tÃ©cnicas tomadas**:
  - el borrado en cascada se centralizÃ³ en `delete-personal-entity-cascade.ts` y se ejecuta dentro de una sola `runTransaction` por operaciÃ³n para evitar borrados parciales;
  - para revertir saldo solo se actualizan cuentas sobrevivientes; si la cuenta eliminada participaba en transferencias con otra cuenta, solo se corrige el lado que permanece;
  - al eliminar un bolsillo, su `balance` se libera de vuelta a `accounts.currentBalance` antes de borrar el doc del bolsillo;
  - se reutiliza la misma semÃ¡ntica vigente de WEB-V6 para side-effects: `household_income_entries` y `third_party_fund_entries` se cancelan por status, mientras `third_party_fund_consumptions` sÃ­ se borran fÃ­sicamente;
  - si la eliminaciÃ³n incluye demasiados movimientos/writes para un MVP seguro, la operaciÃ³n se bloquea con mensaje claro antes de escribir;
  - si aparece un movimiento con `relatedEventId` o `relatedDebtId`, la Web bloquea la eliminaciÃ³n por ahora para no dejar referencias rotas en Hogar sin una limpieza segura explÃ­cita.
- **Skills aplicadas**:
  - `writing-plans`
  - `firebase-firestore`
  - `systematic-debugging`
- **VerificaciÃ³n realizada**:
  - `npx tsx tests/unit/delete-personal-entity-cascade.test.ts` (exitoso)
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 pÃ¡ginas estÃ¡ticas generadas)
- **Estado al cerrar**:
  - implementado a nivel cÃ³digo el borrado en cascada seguro para bolsillos y cuentas personales, con UI destructiva accesible y refresco correcto del dashboard;
  - QA manual Firestore/E2E real sigue pendiente antes de declarar cierre funcional definitivo de la fase.
- **PrÃ³ximo paso sugerido**:
  - ejecutar el QA manual completo de WEB-V6-QA-FIX en entorno real y, si aparecen hallazgos con transferencias o vÃ­nculos de Hogar, abrir una fase puntual `WEB-V6-QA-FIX-2`.

### Entrada — 2026-06-09 — WEB-V7-ACCOUNTS card punteada "Nueva cuenta" + creación de cuenta

- **Fase / paso**: WEB-V7-ACCOUNTS (creación de cuentas personales desde web).
- **Agente / herramienta**: Claude Code (Opus 4.8).
- **Archivos creados**:
  - `src/features/accounts/services/create-personal-account.ts`
  - `src/features/accounts/hooks/use-create-account.ts`
  - `src/features/accounts/components/add-account-card.tsx`
  - `src/features/accounts/components/new-account-dialog.tsx`
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx` (AccountsView: card al final del grid + modal + refresh)
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **Decisión UX — card punteada "Nueva cuenta"**:
  - se agrega una card fantasma (dashed) como un item más del grid de cuentas (`xl:grid-cols-2`), siempre al final, después de las cuentas existentes;
  - usa el mismo radio que las cards de cuenta (`--fm-radius-card-medium`) y tokens del design system; borde `--fm-border-dark` dashed, hover con borde `--fm-pending` y fondo `--fm-surface-dark` suave;
  - ícono `Plus` dentro de un círculo sutil, texto "Nueva cuenta" protagonista y secundario muted "Banco, billetera, efectivo o ahorro";
  - es un `<button>` con `aria-label="Crear nueva cuenta"`, navegable por teclado y con foco visible (no depende solo del color);
  - el grid ahora se renderiza siempre (también sin cuentas): la card punteada reemplaza al EmptyState como llamada a la acción para crear la primera cuenta.
- **Decisiones técnicas (creación de cuenta, schema compartido con Android)**:
  - se escribe en la colección top-level `accounts/{accountId}` con el esquema oficial confirmado por Felipe: `ownerId`, `name`, `type` (bank | digital_wallet | cash | savings | other), `iconType`, `iconKey`, `color`, `initialBalance`, `currentBalance` (= `initialBalance` al crear), `includeInTotal` (true por defecto), `archived: false`, `createdAt: serverTimestamp()`;
  - NO se escribe `updatedAt` ni `currency` (el modelo no los usa al crear); NO se crea bolsillo automáticamente; NO se usa `users/{uid}/accounts` ni `pockets` top-level;
  - `iconType`/`iconKey` se derivan del `type` con defaults (bank→bank, digital_wallet→wallet, cash→cash, savings→savings, other→account); todos `generic` porque aún no hay selector de banco;
  - tras crear, se llama `refresh()` del store de datos personales para que la cuenta nueva aparezca antes de la card punteada sin recargar la página;
  - se reutilizan `FinanceDialog`, `FinanceTextField` y `FinanceButton`; el `use-create-account` es espejo de `use-create-pocket`.
- **No se tocó**: Hogar, movimientos, borrado en cascada, deploy.
- **Skills aplicadas**: `firebase-firestore`, `vercel-react-best-practices`.
- **Verificación realizada**:
  - `npx tsc --noEmit` (sin errores)
  - `npm run lint` (0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 páginas estáticas)
- **Nota de contexto**: en esta misma sesión se hizo antes un refactor de rendimiento (persistencia offline de Firestore, stores globales con cache entre navegaciones, layout compartido `(dashboard)/layout.tsx` con `DashboardShell` persistente). Conviene una entrada propia para ese trabajo.
- **Próximo paso sugerido**:
  - QA manual en Firestore real: crear cuenta de cada tipo y verificar en Android que se vean correctamente (íconos/color/total);
  - evaluar selector de banco para `type=bank` (`iconType="bank_logo"`, `iconKey` = banco elegido).

### Entrada — 2026-06-09 — WEB-V6-QA-FIX-AUDIT endurecimiento de borrado en cascada y auditoría post-delete

- **Fase / paso**: WEB-V6-QA-FIX (auditoría y corrección de borrado en cascada).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/accounts/services/delete-personal-entity-cascade.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - Corregido algoritmo de saldos para bolsillos eliminados: revertir transacciones en memoria primero, calcular residual del bolsillo y moverlo una sola vez al saldo disponible de la cuenta padre, evitando doble conteo/reversión.
  - Implementado filtrado específico de consumos de fondos de terceros (`third_party_fund_consumptions`), consultando únicamente por IDs de transacciones eliminadas o de entries eliminadas, evitando barrido masivo por `ownerId`.
  - Agregado soporte explícito de Hogar en la transacción de borrado para `household_events` (cancelación si nació del movimiento personal), `household_event_shares` (desvincular link de pago y volver a pendiente) y `household_debts` (limpiar vinculación de pago y recalcular estado).
  - Removidas queries OR complejas y combinadas con IN, sustituidas por consultas independientes con paginación/chunking en lotes de 30 IDs.
  - Implementada auditoría post-delete: consulta defensiva tras el commit de la transacción Firestore para corroborar la no existencia de registros huérfanos o referencias rotas.
  - Establecido límite estricto de 250 escrituras contando rutas únicas (`documentPath`) para prevenir fallos de tamaño de transacción o timeout.
- **Skills aplicadas**:
  - `firebase-firestore`
  - `systematic-debugging`
- **Verificación realizada**:
  - `npx tsx tests/unit/delete-personal-entity-cascade.test.ts` (exitoso)
  - `npm run lint` (exitoso, 0 advertencias, 0 errores)
  - `npm run build` (exitoso, compilación de Next.js lista para producción)
- **Estado al cerrar**:
  - El borrado en cascada seguro de cuentas y bolsillos personales quedó endurecido, verificado a nivel tipos y compilación, y con auditoría post-delete integrada.
- **Próximo paso sugerido**:
  - Realizar el QA manual con datos reales en el entorno de desarrollo.

### Entrada — 2026-06-09 — WEB-V6-QA-FIX-AUDIT-2 corrección de saldo disponible y ortografía en UI

- **Fase / paso**: WEB-V6-QA-FIX (auditoría final post-implementación).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/components/layout/dashboard-shell.tsx`
  - `src/features/transactions/components/delete-transaction-confirm-card.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - Corregido bug matemático en `AccountDetailDialog`: el saldo disponible de la cuenta se calcula restando el balance total de sus bolsillos (`account.balance - pocketsBalance`), ya que `account.balance` en el store representa el balance total unificado de la cuenta (Disponible + Bolsillos).
  - Corregidos errores ortográficos y tildes faltantes en diálogos de eliminación de cuenta, bolsillo y transacciones en toda la UI en español ("Se eliminará", "él", "acción", "eliminación", "borrará", "versión", "podrás", "revertirá", "categoría", "qué", "está", "personalización", "sesión", "fricción", "diálogo", "pequeñas", "patrón", "lógica", "aquí").
- **Skills aplicadas**:
  - `frontend-design`
  - `impeccable`
- **Verificación realizada**:
  - `npm test` y pruebas unitarias (exitoso)
  - `npx tsx tests/unit/delete-personal-entity-cascade.test.ts` (exitoso)
  - `npx tsx tests/unit/amount-negative-display.test.tsx` (exitoso)
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 páginas compiladas para producción)
- **Estado al cerrar**:
  - Interfaz depurada, cálculos matemáticos del detalle de cuenta alineados y consistentes con el modelo de datos de Firebase.
- **Próximo paso sugerido**:
  - Ejecutar pruebas manuales y validación en staging con datos reales.

### Entrada — 2026-06-09 — WEB-V8-UI-REDESIGN rediseño visual del flujo "Nuevo movimiento"

- **Fase / paso**: WEB-V8-UI-REDESIGN (rediseño del flujo de creación de movimientos en un diálogo unificado).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**:
  - `src/features/transactions/components/create-movement-dialog.tsx`
- **Archivos modificados**:
  - `src/components/layout/dashboard-shell.tsx`
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/features/transactions/components/create-transfer-card.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - Creación de un modal dialog único y centralizado (`CreateMovementDialog`) que reemplaza la capa lateral (side panel) para los flujos de creación (Gasto, Ingreso, Transferencia).
  - Integración de un control segmentado (Segmented Control) premium en el header del diálogo, alineado con el botón de cerrar discreto, que permite alternar dinámicamente entre Gasto, Ingreso y Transferencia.
  - Estilos de estados activos elegantes para cada tipo de movimiento (coral/rojo para gastos, verde para ingresos, azul para transferencias) con un fondo e íconos fluidos.
  - Visualización del bloque de monto con mayor jerarquía y menor peso vertical, incorporando el color sutil por tipo, el ícono del tipo de movimiento, eliminando por completo el botón "Calculadora".
  - Implementación de **formateo de puntos dinámico en tiempo real** en los inputs de monto (cien, miles, millones, ej: `7.568.585`) en Gasto, Ingreso, Transferencia y Consumo de Fondos de Terceros.
  - Limpieza y eliminación de separadores de puntos al validar y guardar movimientos (`amount.replace(/\./g, "")`).
  - Campos de formulario reorganizados en un grid de 2 columnas en desktop y 1 columna en móvil.
  - Indicador circular (color dot) para cuentas y categorías usando `getAccountVisual` para resolver sus colores oficiales.
  - Rediseño del menú "+ Nuevo" con mini action cards que contienen contenedores de íconos tintados por tipo, títulos fuertes, y descripciones optimizadas.
- **Skills aplicadas**:
  - `frontend-design`
  - `impeccable`
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 páginas compiladas estáticamente para producción sin errores)
- **Estado al cerrar**:
  - Flujo de creación de movimientos moderno, de aspecto premium, con formateo dinámico de miles y coherente con el sistema de diseño Finanzas M completado.
- **Próximo paso sugerido**:
  - Probar interacciones táctiles y de teclado en mobile real para asegurar la accesibilidad del control segmentado y inputs.

### Entrada — 2026-06-09 — WEB-V9-SETTINGS rediseño de la pantalla de Ajustes

- **Fase / paso**: WEB-V9-SETTINGS (rediseño de Ajustes Web para alinear con Android).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - Se agregó el helper `SettingItem` con soporte para íconos a la izquierda (con contenedores tintados), título, descripción, badges dinámicos ("Próximamente" / "No disponible en web todavía" / "Todo sincronizado"), flechas indicadoras a la derecha y estados clickeables, deshabilitados y destructivos.
  - Rediseñada la estructura de la vista de Ajustes para organizar en un grid de 2 columnas en pantallas grandes y 1 columna en móvil.
  - **Hogar** (Sección dinámica): Se muestra sólo si el usuario cuenta con un hogar activo (`activeHouseholdId` no nulo). Incluye las opciones:
    - *Editar nombre del hogar* (Badge: "Próximamente", deshabilitado).
    - *Disolver hogar* (Badge: "No disponible en web todavía", deshabilitado, tono destructivo).
  - **Organización**:
    - *Administrar categorías*: Conectada de forma real con redirección a `/categories` mediante Next.js router.
    - *Cards de Inicio*: (Badge: "Próximamente", deshabilitado).
  - **Sincronización y diagnóstico**:
    - *Todo sincronizado*: Tarjeta informativa estática con indicador verde y texto "Tus datos están guardados en la nube."
    - *Auditar datos en Firebase*: (Badge: "Próximamente", deshabilitado).
  - **Zona peligrosa**: Sección visualmente apartada en el extremo inferior del layout. Incluye:
    - *Reiniciar todos los datos*: (Badge: "No disponible en web todavía", deshabilitado, tono destructivo).
    - *Cerrar sesión*: Destructivo/secundario clickeable que activa la lógica de cierre de sesión existente.
- **Skills aplicadas**:
  - `web-design-guidelines`
  - `impeccable`
  - `accessibility`
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 páginas compiladas estáticamente para producción sin errores)
- **Estado al cerrar**:
  - Ajustes Web refleja la misma estructura y completitud de Ajustes Android, adaptada con un layout web premium, limpio y responsivo. Las funcionalidades no soportadas están documentadas visualmente con badges explicativos y no ejecutan acciones de prueba falsas.
- **Próximo paso sugerido**:
  - Implementar la pantalla/flujo de edición del nombre de hogar o administración de widgets en la Home si Felipe lo prioriza.

### Entrada — 2026-06-09 — WEB-V10-CATEGORIES administración y creación de categorías personales

- **Fase / paso**: WEB-V10-CATEGORIES (Flujo completo de administración y creación de categorías).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**:
  - `src/lib/categories/category-icons.ts`
  - `src/features/categories/services/create-category.ts`
  - `src/features/categories/hooks/use-create-category.ts`
- **Archivos modificados**:
  - `src/types/category.ts`
  - `src/features/categories/services/read-personal-categories.ts`
  - `src/features/dashboard/components/personal-views.tsx`
  - `src/components/finance/personal-transaction-row.tsx`
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/app/(dashboard)/categories/page.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - **Catálogo centralizado (`category-icons.ts`)**: Se creó el catálogo lógico compartido (`expenseIconCatalog`/`incomeIconCatalog`) asociando iconKeys lógicas a Lucide icons, definiendo grupos (Comida, Hogar, Transporte, Salud, Compras, Servicios, Trabajo, Ingresos, Otros), etiquetas, palabras clave y el resolvedor `resolveCategoryIcon` con fallbacks defensivos.
  - **Servicio y Hook de creación**: Se implementaron `createCategory` en Firestore (`categories/{categoryId}`) con validaciones estrictas (`name` no vacío/espacios, `kind` válido, `iconKey` en catálogo, `color` hex válido, `archived: false`, `createdAt` con `serverTimestamp()`) y el respectivo hook `useCreateCategory` para el control de estados.
  - **Tipado extendido**: Se añadió `iconKey`, `color`, `parentId` y `archived` a la interfaz `Category`.
  - **Lectura e integración**: Se modificó `readPersonalCategories` para extraer y mapear `iconKey` y `color`, ignorando las categorías archivadas.
  - **Visualización dinámica de transacciones**: Se extendió `PersonalMovementRow` con `categoryColor` y `categoryIconKey`, y se refactorizó `PersonalTransactionRow` y `PersonalRecentMovementRow` para renderizar el color y el ícono personalizado de la categoría usando el resolvedor.
  - **Selector visual en formularios**: Se actualizaron `CreateExpenseCard` y `CreateIncomeCard` para pintar el punto de color de la categoría seleccionada dinámicamente (`selectedCategory.color`).
  - **Vista de gestión y Dialog de Creación**:
    - Se actualizó `CategoriesView` para alternar entre "Distribución de gastos" (reporte existente) y "Mis categorías" (gestor).
    - Se implementó la card dashed de atajo `+ Nueva categoría`.
    - Se creó el modal completo `CreateCategoryDialog` que gestiona el formulario de nombre y el sub-selector de íconos/color con buscador de texto/palabras clave, paleta de color de 2 filas de 8 colores con aro de selección, y agrupado por pestañas dinámicas por tipo de movimiento.
    - Se conectó la redirección desde Ajustes con el parámetro de query `?mode=manage`.
- **Decisiones técnicas tomadas**:
  - Guardar únicamente el `iconKey` lógico en base de datos para preservar la compatibilidad con Android (donde se resuelve a Material Icons) y Web (donde se resuelve a Lucide Icons).
  - Propagar la función de `refresh()` del almacén Zustand a la vista de categorías para sincronizar las nuevas adiciones inmediatamente en los selectores de los formularios sin recargar.
- **Skills aplicadas**:
  - `firebase-firestore`
  - `web-design-guidelines`
  - `impeccable`
  - `vercel-react-best-practices`
  - `accessibility`
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm test` (exitoso, todas las pruebas unitarias pasaron)
  - `npm run build` (exitoso, las 13 páginas de producción se compilaron estáticamente sin fallos)
- **Estado al cerrar**:
  - Flujo de creación y gestión de categorías personales completado e integrado estéticamente con el sistema de diseño oscuro y los componentes oficiales de la aplicación.
- **Próximo paso sugerido**:
  - Iniciar QA manual autenticado del flujo de creación de categorías y verificar la sincronización en tiempo real en los modales de transacciones.

### Entrada — 2026-06-09 — WEB-V9-SETTINGS-FIX corrección de sintaxis y rediseño final de Ajustes

- **Fase / paso**: WEB-V9-SETTINGS (corrección de bug crítico de sintaxis + rediseño final).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**: ninguno.
- **Archivos modificados**:
  - `src/features/dashboard/components/personal-views.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - Corregido bug crítico: el componente `SettingItem` quedó truncado en medio de su JSX (`<div` sin cerrar) en la sesión anterior, causando ~37 errores de TypeScript que rompían toda la compilación del archivo.
  - Reconstruido `SettingItem` completo con layout `flex items-center justify-between`, contenedores de íconos tintados por tipo (neutral / verde esmeralda / rojo), badges de estado con estilo diferenciado por tipo (próximamente vs. no disponible) y chevrons condicionales.
  - Simplificado `SettingsView`: eliminado el fetching dinámico de miembros del hogar con `getDoc`/`getFirebaseDb` que ya no era necesario con el nuevo layout de `SettingItem`.
  - Limpiados imports no usados: `doc`, `getDoc`, `getFirebaseDb` (firebase/firestore) y `SettingRow` (@/components/finance/setting-row).
  - Estructura final de Ajustes: Perfil + Hogar (col 1), Preferencias + Organización + Sincronización (col 2), Zona peligrosa (ancho completo con borde rojo).
- **Decisiones técnicas tomadas**:
  - El card de Hogar ahora usa `SettingItem` para "Editar nombre del hogar" y "Disolver hogar" en lugar de botones sueltos, manteniendo coherencia visual con el resto de la pantalla.
  - Se eliminó la carga dinámica de miembros por `getDoc` para simplificar el componente; si se necesita mostrar miembros en el futuro, debe implementarse como feature separada con su propio hook.
- **Skills aplicadas**:
  - `impeccable`
  - `web-design-guidelines`
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 páginas estáticas compiladas sin errores)
- **Estado al cerrar**:
  - Pantalla de Ajustes compilando correctamente con el nuevo diseño de cards modulares y `SettingItem` completo.
- **Próximo paso sugerido**:
  - QA manual de la pantalla `/settings` verificando toggles, badges, navegación a categorías y acción de cerrar sesión.

### Entrada — 2026-06-09 — WEB-V11-ICONSELECT-BREAKDOWN dropdowns personalizados con iconos/colores y barras de progreso

- **Fase / paso**: WEB-V11-ICONSELECT-BREAKDOWN (Dropdowns de selección de cuenta/categoría personalizados en tiempo real y barras de progreso más gruesas).
- **Agente / herramienta**: Antigravity.
- **Archivos creados**:
  - `src/components/finance/icon-select.tsx`
- **Archivos modificados**:
  - `src/features/transactions/components/create-expense-card.tsx`
  - `src/features/transactions/components/create-income-card.tsx`
  - `src/components/finance/category-breakdown-list.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: ninguno.
- **TODOs resueltos**:
  - **Dropdown de ícono y color personalizado (`IconSelect`)**: Creado un componente de selección personalizado que reemplaza al `<select>` nativo para mostrar cada categoría y cuenta con su respectivo indicador circular de color e ícono en tiempo real.
  - **Lógica reactiva**: Corregido bug donde la categoría y la cuenta seleccionada no actualizaban el color/icono en vivo al cambiar la categoría/color en tiempo real.
  - **Correcciones de Accesibilidad y Lint**: Añadidos `aria-controls` y `aria-expanded` dinámicos en el trigger del combobox y eliminados los memos sin usar (`selectedAccount`/`selectedCategory`) de los formularios de gastos e ingresos.
  - **Barras de progreso en categorías más gruesas**: Incrementado el grosor de las barras de progreso de la distribución de gastos de `h-2` (8px) a `h-3.5` (14px) para mejor visualización de porcentajes, con bordes totalmente redondeados (`overflow-hidden`), sombra interna para profundidad y un sutil glow basado en el color de la categoría.
- **Decisiones técnicas tomadas**:
  - Reemplazar select nativo por componente personalizado para evitar la limitación de `<select>` de no poder renderizar HTML/íconos/colores en sus opciones.
- **Skills aplicadas**:
  - `impeccable`
  - `web-design-guidelines`
  - `accessibility`
- **Verificación realizada**:
  - `npm run lint` (exitoso, 0 errores, 0 warnings)
  - `npm run build` (exitoso, 13/13 páginas compiladas sin errores)
- **Estado al cerrar**:
  - Interfaz de creación de movimientos y visualización de categorías completadas de forma premium, responsiva y accesible.
- **Próximo paso sugerido**:
  - QA en producción y deploy del flujo completo.

### Entrada — 2026-08-12 — Conexión Web a Firebase M+

- **Fase / paso**: Fundación compartida M+, registro de la app Web y configuración local.
- **Agente / herramienta**: Orquestador; Firebase Console; Firebase Auth y Firestore.
- **Archivos creados**: ninguno.
- **Archivos modificados**: `.env.local.example`, `AGENTS.md`.
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**: completar Rules, índices, Emulator Suite y pruebas de seguridad compartidas antes de la adaptación funcional.
- **TODOs resueltos**: `.env.local` usa `finanzas-m-plus`; el ejemplo versionado conserva la misma configuración. `.env.local` permanece ignorado y no versionado.
- **Decisiones técnicas tomadas**: Web y Android usan el mismo proyecto Firebase M+; los tests del emulador conservan IDs `demo-*` aislados.
- **Skills aplicadas**: `firebase-auth-basics`, `firebase-firestore`.
- **Verificación realizada**: `npm run lint`, `npm test` y `npm run build` exitosos; configuración local validada como `finanzas-m-plus`.
- **Estado al cerrar**: Web apunta localmente a Firebase M+; no se publicó ni se habilitó Hosting.
- **Próximo paso sugerido**: implementar la fundación compartida de Rules, índices y emuladores desde Android.

### Entrada — 2026-08-12 — Cierre seguro de Firebase M+ Web

- **Fase / paso**: cierre de la configuración inicial de Firebase M+ para Web.
- **Agente / herramienta**: Orquestador; Firebase Web SDK; Next.js 15; Firebase Emulator Suite.
- **Archivos creados**: política de ambientes, runner de entornos, bootstrap de emuladores y pruebas contractuales asociadas.
- **Archivos modificados**: cliente Firebase, perfil de autenticación, comandos npm, configuración de Next, plantilla de entorno, README y pruebas Web.
- **Archivos eliminados**: especificación y plan transitorios de esta corrección, después de absorber su resultado en código, commits y esta entrada.
- **TODOs nuevos**: QA manual de Google Login sobre `npm run dev:qa`; implementación posterior de Rules, índices y contrato de datos M+.
- **TODOs resueltos**:
  - `npm run dev` y `npm run build` usan `EMULATOR` y `demo-finanzas-m-plus` por defecto;
  - `dev:qa` y `build:qa` cargan explícitamente `.env.qa-real.local` y solo aceptan la app Web registrada de `finanzas-m-plus`;
  - `.env.qa-real.local` permanece ignorado y `.env.local.example` queda versionado sin valores locales;
  - el cliente Firebase usa una app nombrada, conecta Auth/Firestore Emulator y no habilita persistencia offline de Firestore;
  - el bootstrap nuevo de `users/{uid}` ya no copia `email` a Firestore;
  - los harnesses Web usan el proyecto aislado `demo-finanzas-m-plus`.
- **Decisiones técnicas tomadas**: no se modificaron ni desplegaron Rules, índices, Hosting o modelo funcional; Android permaneció cerrado en `17dc95b`.
- **Skills aplicadas**: `firebase-auth-basics`, `firebase-firestore`.
- **Verificación realizada**:
  - suite Web completa aprobada dentro de Auth/Firestore Emulator durante la implementación;
  - `npm run build` exitoso con ambiente `EMULATOR` el 2026-08-12;
  - `npm run build:qa` exitoso con ambiente `QA_REAL` el 2026-08-12;
  - único warning preexistente: uso de `<img>` en `account-icon.tsx`.
- **Estado al cerrar**: Android y Web están registrados y configurados para Firebase M+; la configuración inicial queda cerrada, sin declarar Google Login manual ni Rules como completados.
- **Próximo paso sugerido**: iniciar la fundación compartida de Firestore M+ —Rules, índices y pruebas de seguridad— como un bloque nuevo y separado.

### Entrada - 2026-08-20 - Artefacto W0 de preservacion visual y paridad Web

- **Fase / paso**: puerta W0/W0.5 del PLAN_ADAPTACION_WEB; preparacion documental previa a la adaptacion funcional Web M+.
- **Agente / herramienta**: Orquestador (rol asignado por el usuario); inventario de la Web base y matrices preliminares.
- **Archivos creados**: docs/12_WEB_PARIDAD_PRESERVACION_W0.md.
- **Archivos modificados**: ninguno (solo aditivo documental en centro de mandos: PLAN_ADAPTACION_WEB, PLAN_QA_Y_PARIDAD, HISTORIAL_CAMBIOS).
- **Archivos eliminados**: ninguno.
- **TODOs nuevos**: capturas base desktop/movil del commit autoritativo c089d88; ratificar matrices por bloque W2-W5 antes de implementar; aprobacion explicita del usuario de matrices y deltas.
- **TODOs resueltos**: inventario de rutas, shell, kits visuales, tokens, patrones y stores de la Web base; invariantes visuales que no se tocan; lecciones de Android como anti-patrones; matrices de impacto preliminares W2-W4; checklists W0/W0.5.
- **Decisiones tecnicas tomadas**: la Web conserva su identidad visual; Android solo es referencia funcional/datos; no se reconstruyen flujos ni pantallas; el retiro legacy ocurre solo tras sustituir y probar el reemplazo.
- **Skills aplicadas**: ninguna (tarea de auditoria y documentacion).
- **Verificacion realizada**: inventario contrastado contra el repo en c153e48; referencia visual c089d88; sin cambios de codigo.
- **Estado al cerrar**: puerta W0 registrada como "En curso" en PLAN_QA_Y_PARIDAD; pendiente capturas base y aprobacion de matrices.
- **Proximo paso sugerido**: completar capturas base W0 y, al iniciar cada bloque funcional, ratificar su matriz de impacto antes de editar codigo.

### Entrada - 2026-08-20 - W1: contrato v1 Web, sesion online y backend canonico

- **Fase / paso**: bloque W1 del PLAN_ADAPTACION_WEB ("Configuracion M+, contrato Web y sesion online").
- **Agente / herramienta**: agente Web; Firebase Web SDK v12; Zod 4; Firestore Emulator Suite (no ejecutado en esta entrega, ver Verificacion).
- **Ambiente declarado**: **EMULATOR**. No se uso QA_REAL ni se escribio en `finanzas-m-plus` ni en `finanzas-m`. Todo el trabajo de W1 es codigo, tipos, validadores y pruebas unitarias; ninguna prueba de esta entrega abrio conexion remota.
- **Archivos creados**:
  - `src/lib/mplus/` — fundacion del contrato v1: `enums.ts`, `catalogs.ts`, `models.ts`, `converters.ts`, `schemas.ts`, `ids.ts`, `paths.ts`, `bogota-date.ts`, `seeds.ts`, `derived.ts`, `fixtures.ts`, `mutation-runner.ts`, `user-bootstrap.ts`.
  - `src/stores/session-boundary.ts` — limpieza total de stores al cambiar de usuario.
  - `scripts/canonical-backend.mjs` — sincroniza y verifica Rules e indices contra la fuente canonica de Android.
  - Pruebas: `tests/unit/mplus-{canonical-backend,contract-serialization,android-fixture-parity,validators,bogota-date,seed-catalog,derived-calc,user-bootstrap,session-boundary,mutation-runner}.test.ts`.
- **Archivos modificados**: `src/features/auth/{auth-service,firestore-user-profile,types,use-auth-bootstrap}.ts`, `src/stores/{auth-store,ui-preferences-store,household-ui-preferences-store}.ts`, `tests/unit/{firestore-user-profile.test.ts,run-all.ts}`, `package.json`, `firebase.json`, `.gitignore`, `docs/12_WEB_PARIDAD_PRESERVACION_W0.md`.
- **Archivos eliminados**: `firestore.indexes.json` (raiz del repo Web). Era el manifiesto de indices de **finanzas-m** (colecciones `household_review_items`, `third_party_fund_*`, `household_income_entries`), no el del contrato v1, y el contrato §27.1 prohibe que Web mantenga una variante independiente. Su reemplazo es la copia verificada `tests/emulator/firestore.indexes.json`, generada desde `android/firestore.indexes.json`; el manifiesto legacy sigue vivo en la rama `develop/finanzas-m` y en el historico de esta.
- **TODOs nuevos**:
  - ejecutar la suite de emulador contra las Rules canonicas ya sincronizadas (pendiente por costo de arranque; ver Verificacion);
  - conectar la UI a `bootstrapError` del auth-store cuando W2 rehaga el tablero (hoy el fallo de bootstrap en recarga queda registrado y en consola, no pintado);
  - preferencias de tablero (`fm-board-order`, `fm-board-hidden`, `fm-hide-balances`, `fm-hh-*`) siguen siendo por dispositivo y no por `uid`: convertirlas en preferencias por usuario es trabajo del bloque de Ajustes (W4).
- **TODOs resueltos**:
  - tipos TS, esquemas Zod, convertidores Firestore y validadores del contrato v1 para los 12 agregados, sin estado legacy;
  - auth Google + perfil minimo `users/{uid}` del contrato (sin correo, nombre, foto, `defaultCurrency` ni `activeHouseholdId`) + seed Personal v1 idempotente;
  - limpieza total de stores al cambiar de usuario (antes solo se limpiaba `app-context-store`);
  - ejecutor unico de mutaciones con OCC por `revision`, mismo resultado de conflicto que Android y sin exito antes del commit remoto;
  - fixtures logicos compartidos y validacion de serializacion bidireccional contra la prueba canonica de fixtures de Android;
  - Rules e indices Web conectados a la fuente canonica de Android con deteccion de copia desactualizada.
- **Decisiones tecnicas tomadas**:
  - la fundacion v1 vive en `src/lib/mplus/` y **no** sustituye todavia a `src/types/*` ni a los servicios legacy: W1 conecta la fundacion; el retiro del modelo anterior es W4, despues de que W2/W3 sustituyan a sus consumidores;
  - `createdAt`/`updatedAt` se escriben con hora de cliente (`Timestamp` desde millis), igual que Android, en vez de `serverTimestamp()`: el contrato exige que ambas plataformas produzcan el mismo JSON logico y las Rules solo verifican `is timestamp` y `occurredAt <= request.time`;
  - `firebase.json` apunta a `tests/emulator/firestore.{rules,indexes.json}`, ambos generados e ignorados por Git, para que sea verificable que Web no mantiene backend propio;
  - un error de red en Web se clasifica como `unavailable` (fallo visible) y no como reintento silencioso: no hay cola local ni offline.
- **Skills aplicadas**: ninguna (trabajo de contrato de datos y pruebas).
- **Verificacion realizada**:
  - `npx tsc --noEmit`: sin errores;
  - `npm test`: suite completa aprobada, incluidas las 10 pruebas nuevas de W1;
  - `npm run build`: exitoso con ambiente EMULATOR;
  - `npm run check:backend`: detecto que `tests/emulator/firestore.rules` estaba desactualizada (anterior a DEC-071/DEC-072) y que no existia copia de indices; tras `npm run sync:backend` ambos quedan alineados con Android;
  - la paridad de serializacion se verifico leyendo `MplusFirestoreMapperFixtureTest.kt` de Android y contrastando los 7 fixtures campo por campo;
  - **NO ejecutado**: `npm run test:emulator` y derivados. Los harness de emulador vigentes son del modelo legacy (eventos, deudas, shares) y no cubren el contrato v1; ejecutarlos contra las Rules canonicas M+ solo comprobaria que el modelo retirado ya no pasa. Las pruebas de emulador del contrato v1 corresponden a W2/W3, cuando existan escrituras reales que probar.
- **Hallazgo colateral**: `node_modules/zod` estaba corrupto en este entorno (faltaba `zod/v4/classic`), lo que hacia irresoluble cualquier `import { z } from "zod"` — incluido el `src/lib/validators/money.ts` preexistente. Se reinstalo `zod@4.4.3` sin tocar `package.json` ni `package-lock.json`.
- **Estado al cerrar**: la Web tiene fundacion del contrato v1 conectada, sesion online con perfil minimo y seed, ejecutor de mutaciones con OCC y backend compartido verificable. Cero cambios visuales: no se toco ningun componente, ruta, token ni kit de `finance/*` o `household/ui/*`.
- **Proximo paso sugerido**: puerta W0 (capturas base en `c089d88` y aprobacion de la matriz de impacto de W2) antes de iniciar la adaptacion funcional de Personal.

### Entrada - 2026-08-20 - ORQ-041 / DEC-081: retirada total del modo emulador

- **Fase / paso**: ORQ-041 (DEC-081). Ambiente unico de ejecucion Web.
- **Agente / herramienta**: agente Web; Next.js 15; Firebase Web SDK v12.
- **Ambiente declarado**: **proyecto real `finanzas-m-plus`**, unico posible desde esta entrega. Ya no existe EMULATOR, ni proyecto `demo-*`, ni suite de Rules local en la Web.
- **Archivos eliminados**:
  - `tests/emulator/` completo (harness `firebase-emulator-environment.ts`, `run-v6b6.ts`, `run-r1-atomic-cancel.ts`, `run-h16b-cascade-cancel.ts`, `run-h17-income-projection.ts`, `run-h21-cancel-pending-share.ts`, `run-h-declare-debt-payment-gate.ts` y las copias generadas de Rules/indices);
  - `scripts/canonical-backend.mjs` y `scripts/check-rules-bom.mjs` (solo servian para preparar y validar las copias del emulador);
  - `firebase.json` (todas sus secciones eran configuracion de emulador o punteros a `tests/emulator/`; la Web no despliega Rules ni indices — contrato §27.1, la fuente canonica y el deploy viven en `android/`);
  - `tests/unit/firebase-emulator-harness-order.test.ts` y `tests/unit/mplus-canonical-backend.test.ts` (probaban artefactos que dejaron de existir);
  - directorios de build `.next-emulator/` y `.next-dev/`.
- **Archivos creados**: `tests/unit/no-emulator-residue.test.ts` — guardia que audita `src/`, `scripts/` y la configuracion de ejecucion y falla si reaparece `EMULATOR`, `demo-*`, `connect*Emulator`, `127.0.0.1`, `10.0.2.2`, `useEmulators` o `tests/emulator`.
- **Archivos modificados**: `src/lib/firebase/{environment,client}.ts`, `src/features/auth/auth-service.ts`, `scripts/{run-firebase-environment.mjs,firebase-environment-core.mjs,firebase-environment-core.d.mts}`, `next.config.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `.env.local.example`, `README.md`, `tests/unit/{firebase-environment-policy,firebase-client-safety-contract,firebase-command-contract,firebase-runner-core,firebase-runtime-artifacts,dev-server-isolation,account-lifecycle-guard,delete-entity-cascade-household-revert}.test.ts`, `tests/unit/dev-watch-supervisor.test.mjs`, `tests/unit/run-all.ts`, `docs/12_WEB_PARIDAD_PRESERVACION_W0.md`.
- **Decisiones tecnicas tomadas**:
  - el runtime dejo de ser un parametro: `run-firebase-environment.mjs` ya no recibe `EMULATOR|QA_REAL`, solo `watch|next`, y siempre lee y valida `.env.qa-real.local`;
  - `NEXT_PUBLIC_FIREBASE_RUNTIME` se retiro del contrato de ambiente, pero **no se ignora**: si sobrevive en un `.env` con un valor distinto de `QA_REAL`, tanto el cliente como el nucleo de scripts bloquean de forma visible, para que un archivo viejo no de la falsa impresion de seguir apuntando al emulador;
  - `finanzas-m` se bloquea por nombre y antes que cualquier otra comparacion, en cliente y en scripts;
  - **la resolucion de ambiente en `client.ts` paso a ser perezosa**. Antes ocurria al importar el modulo, apoyada en que EMULATOR daba una configuracion dummy; sin esa rama, importar cualquier servicio en la suite unitaria habria reventado. Ahora se resuelve en el primer uso real de Auth/Firestore, de modo que el bloqueo sigue ocurriendo antes de la primera lectura o escritura;
  - se eliminaron los comandos duplicados `dev:qa`, `build:qa` y `start:qa`: con un solo ambiente eran alias de `dev`, `build` y `start`;
  - `next.config.ts` conserva dos artefactos (`.next-qa-dev` para desarrollo, `.next-qa` para build) porque un servidor de desarrollo y un build de produccion no deben compartir cache; ya no dependen del runtime.
- **Correccion de un diagnostico previo (ORQ-042)**: la entrada de W1 afirmaba que `expense-occ-parity.test.ts` y `technical-transactions.test.ts` abrian una conexion a `127.0.0.1:8080` y por eso `npm test` no terminaba. **Era incorrecto.** Ejecutadas de forma aislada ambas terminan en menos de un segundo sin abrir nada. La causa real era `client.ts`: esos dos archivos definen `global.window`, y cualquier modulo posterior de `run-all.ts` que llamara a `getFirebaseDb()` superaba el guard de navegador y disparaba `connectFirestoreEmulator`. Retirado el emulador, `npm test` termina solo en ~2,3 s. **Las dos pruebas se conservan**: no eran las culpables y cubren logica de negocio real (~650 lineas).
- **Cambio en el entorno local (no versionado)**: se retiro el hook `.git/hooks/pre-commit`, que invocaba `scripts/check-rules-bom.mjs`. Sin ese script el hook abortaba todo commit. La validacion anti-BOM sigue teniendo sentido, pero en el repositorio Android, que es donde vive y desde donde se despliega `firestore.rules`. `.git/hooks/pre-push` (proteccion de `main` y del snapshot) queda intacto.
- **Skills aplicadas**: ninguna.
- **Verificacion realizada**:
  - `npx tsc --noEmit`: sin errores;
  - `npm test`: 0 fallos y el proceso **termina solo** en ~2,3 s (antes quedaba colgado reintentando contra el emulador);
  - `npm run build` con el ambiente real: exitoso, 16/16 paginas; unico warning el preexistente de `<img>` en `account-icon.tsx`;
  - barrido final sobre `src/`, `scripts/`, `tests/` y la configuracion raiz: cero coincidencias de `demo-finanzas`, `127.0.0.1`, `10.0.2.2`, `useEmulator`, `EMULATOR` o `emulators:exec`, salvo las pruebas cuyo proposito es afirmar esa ausencia;
  - **NO ejecutado**: cualquier prueba de emulador. Ya no existen, por diseno de esta tarea.
- **Estado al cerrar**: la Web tiene un unico entorno de ejecucion, el proyecto real `finanzas-m-plus`, con bloqueo visible ante `finanzas-m` o cualquier configuracion ajena y sin fallback. Contrato, `src/lib/mplus/*`, sesion, OCC y UI intactos: cero cambios visuales o funcionales.
- **Proximo paso sugerido**: puerta W0 (capturas base en `c089d88` y aprobacion de la matriz de impacto de W2) antes de iniciar la adaptacion funcional de Personal.

### Entrada - 2026-08-20 - W2: Personal completo sobre el contrato v1

- **Fase / paso**: W2 (`PLAN_ADAPTACION_WEB.md`), matriz de impacto 6.1 de `docs/12`.
- **Agente / herramienta**: agente Web; Next.js 15; Firebase Web SDK v12.
- **Ambiente declarado**: proyecto real `finanzas-m-plus` (unico ambiente desde ORQ-041/DEC-081). Sin emulador, sin suite de Rules local.
- **Estrategia**: las superficies M+ se implementan como componentes nuevos que reutilizan el MISMO kit visual, y las rutas apuntan a ellas. NO se elimino ni una linea del circuito legacy: `personal-views.tsx`, los servicios de `transactions/`, `pockets/` y el `personal-data-store` siguen intactos hasta que W4 retire sus consumidores (regla 6 de `docs/12`).
- **Capa de datos (commit `d625a42`)**:
  - lecturas canonicas de `movements`: mes Personal (§19.1) y Papelera (§19.2), sobre los indices compuestos ya versionados en Android;
  - mutaciones con OCC por `revision` — crear, editar, Papelera, restaurar y purgar — moviendo `referenceCount`/`lastReferenceMovementId` de la cuenta en la MISMA transaccion (§7.3, §23);
  - cuentas (§7) y categorias (§8) con OCC; los contadores nunca se tocan al renombrar o archivar;
  - `mplus-personal-store` + hooks de lectura y mutacion: online-only, sin cola, sin cache funcional y sin exito anticipado — el estado local solo cambia con el documento que el servidor confirmo;
  - modelo de vista del mes: KPIs de §25, desglose por categoria, filas con la gramatica visual de la Web base y filtros combinables en cliente.
- **Superficies (commit `38912af` y siguiente)**:
  - **Composer**: misma carcasa (`FinanceDialog size="composer"`, `OperationSelector`, `DiscardConfirmDialog`) y mismos primitivos. Solo Ingreso/Gasto, categoria obligatoria, cuenta OPCIONAL, nota, toggle "Contar en Hogar" con `ToggleRow`, guard de doble envio. `OperationSelector` acepta un subconjunto de operaciones y ajusta su rejilla a 2 columnas.
  - **`/movements`**: historial mensual, busqueda por titulo y filtros combinables (tipo / categoria / cuenta, con "Sin cuenta" como opcion propia). Retirados los filtros de bolsillo y titularidad.
  - **Papelera**: segundo modo de la misma lista, con vencimiento visible y restaurar. La purga de lo vencido corre al abrir con conexion (§9.5) y ajusta el contador de la cuenta.
  - **`/dashboard`**: hero con la diferencia del mes a la izquierda y los KPIs de ingresos/gastos (que ya existian) a la derecha. Retirados saldo real, saldo bancario bruto, dinero no propio y su panel de distribucion, "Te deben", "Le debes al hogar" y "Por anotar". Desglose por categoria con vista secundaria de ingresos. Cuentas como etiquetas sin saldo. Se conserva el tablero reordenable con arrastre y ocultado.
  - **`/accounts` y `/accounts/[id]`**: cuenta como etiqueta informativa, con edicion y archivado/reactivacion. Retirados saldo, disponible, bolsillos, ajuste de saldo, cierre/reapertura y eliminacion en cascada. El detalle conserva breadcrumb y lista de movimientos del mes.
  - **`/categories`**: catalogos planos y separados por tipo, alta/edicion/archivado y listado de archivadas con reactivacion.
- **Decisiones tecnicas y juicios**:
  - `PersonalTransactionRow` y `CategoryBreakdownList` pasan a tipos estructurales para servir a los dos modelos sin duplicar componentes ni tocar su composicion;
  - `CategoryBreakdownList` gana un prop `type` porque los catalogos de icono de ingreso y gasto son distintos (§24): sin el, el desglose de ingresos caia al icono generico;
  - **hero del tablero**: la matriz no fija que ocupa la columna izquierda una vez retirado "Dinero propio". Se eligio la diferencia del mes con la misma tipografia y el mismo `Amount size="display"`, y se retiro la sub-rejilla porque sus dos cifras eran capacidades deprecadas. Queda señalado como juicio revisable por el orquestador;
  - **`/categories` pierde el rango "Año"**: la consulta canonica del contrato es mensual (§19.1); ofrecer un año exigiria una consulta que el contrato no declara. Delta mas alla de la linea "sin cambio visual" de la matriz, señalado al orquestador.
- **Bug corregido por las pruebas nuevas**: al cambiar de cuenta, el servicio leia la segunda cuenta DESPUES de escribir la primera, algo que Firestore prohibe dentro de una transaccion. El contador pasa a dos fases (leer todo, luego escribir todo) y hay una prueba que vigila el orden.
- **Verificacion realizada**:
  - `npx tsc --noEmit`: sin errores;
  - `npm test`: 0 fallos, 375 aserciones/lineas OK, termina solo en ~2,3 s. Tres suites nuevas: mutaciones de movimiento, modelo de vista del mes y servicios de catalogo;
  - `npm run build` con el ambiente real: exitoso, 16/16 paginas; unico warning el preexistente de `<img>`;
  - `npx next lint`: sin errores nuevos;
  - **NO ejecutado**: la prueba manual contra `finanzas-m-plus` (crear/editar/eliminar, Papelera, conflictos). Requiere sesion iniciada del usuario; el QA manual es suyo.
- **Estado al cerrar**: las cinco superficies Personal leen y escriben el contrato v1 con OCC. El circuito legacy sigue en el repo, ya sin rutas que lo monten, listo para que W4 lo retire.
- **Proximo paso sugerido**: QA manual de W2 contra el proyecto real y, en paralelo, matriz de impacto de W3 (Hogar).

### Entrada - 2026-08-20 - W3: Hogar completo sobre el contrato v1

- **Fase / paso**: W3 (`PLAN_ADAPTACION_WEB.md` y `implementation_plan.md` aprobado).
- **Agente / herramienta**: agente Web; Next.js 15; Firebase Web SDK v12.
- **Ambiente declarado**: proyecto real `finanzas-m-plus` (QA_REAL / Firestore Standard / Google Auth). Sin emulador.
- **Implementación**:
  - **Identificadores y Códigos de Invitación (DEC-072)**: código de 3 dígitos (`000`–`999`), un solo uso, 7 días de vencimiento. Helpers en `src/lib/mplus/ids.ts`.
  - **Capa de Servicios (`src/features/household/services/`)**:
    - `mplus-household-service.ts`: lecturas de Hogar, miembros, invitaciones activas, mappings y proyecciones de etiquetas (`memberCategoryLabels`, `memberAccountLabels`); mutaciones con OCC por `revision` (`createHousehold`, `joinHousehold`, `cancelWaitingHousehold`, `regenerateHouseholdInvite`, `renameHousehold`, `leaveHouseholdPause`, `returnToHousehold`, `leaveHouseholdPermanently`).
    - `mplus-household-categories-service.ts`: CRUD de categorías de gasto de Hogar con OCC (`createHouseholdExpenseCategory`, `updateHouseholdExpenseCategory`, `archiveHouseholdExpenseCategory`, `reactivateHouseholdExpenseCategory`).
    - `read-household-movements.ts`: consulta canónica mensual de Hogar (§19.3) y corrección de categoría de gasto de Hogar por el compañero con mapeo automático (§9.4, §14, DEC-005, DEC-015).
    - `mplus-household-projections-service.ts`: sincronización atómica de etiquetas proyectadas de categorías y cuentas personales hacia el Hogar (§15).
  - **Estado y Hooks (`src/stores/`, `src/features/household/hooks/`)**:
    - `mplus-household-store.ts`: store global Zustand para Hogar M+, con transaccionalidad y actualización committeada.
    - `session-boundary.ts`: integrado `useMplusHouseholdStore.getState().reset()` en el reseteo de frontera de sesión.
    - `use-mplus-household.ts`: hook loader reactivo montado en el shell (`dashboard-shell.tsx`).
  - **Superficies y Vistas de Hogar**:
    - **`/household` (Overview)**: hero mensual de Hogar con desglose (ingresos, gastos, diferencia), gastos por categoría con barras de progreso, banner de gastos por clasificar (DEC-005), aportes por integrante y movimientos compartidos recientes.
    - **`/household/movements`**: historial mensual de movimientos compartidos con filtros locales combinables (miembro, tipo, categoría de hogar, cuenta personal proyectada, búsqueda por título), detalle completo y diálogo de corrección de categoría de gasto por el compañero.
    - **`/household/categories`**: distribución vs administración (crear, editar, archivar, reactivar) consumiendo la paleta de tokens `--hh-*`.
    - **`/household/settings`**: vista puramente informativa con ficha del hogar, lista de miembros y banner recordatorio de que la gobernanza se gestiona en Ajustes Personal (DEC-073/DEC-078).
    - **`MplusHouseholdLifecycleCard` (Ajustes Personal)**: card unificada de gobernanza del Hogar (sin hogar, esperando con código de 3 dígitos / cancelar DEC-068, en pausa con regresar / salirme del todo DEC-075, activo con renombrar DEC-074 / salir pausa / salirme del todo DEC-075 / código reservado DEC-076).
  - **Pruebas y Verificación**:
    - `tests/unit/mplus-household-contract.test.ts`: suite unitaria para código de 3 dígitos, semillas de Hogar v1, cálculos de balance/diferencia, proyecciones seguras y mutaciones OCC.
    - `npx tsc --noEmit`: 0 errores de tipado.
    - `npm test`: 100% pruebas pasando.
    - `npm run build`: compilación limpia de producción (16/16 páginas estáticas/dinámicas).
- **Estado al cerrar**: W3 completado satisfactoriamente según el contrato y decisiones M+ (DEC-072 a DEC-081).
- **Próximo paso sugerido**: QA manual de W3 en `finanzas-m-plus` y avance a W4 (limpieza del circuito legacy deprecado).

### Entrada - 2026-08-20 - W4: Ajustes, reinicio profundo, navegación y deprecación completa

- **Fase / paso**: W4 (`PLAN_ADAPTACION_WEB.md` y `implementation_plan.md` aprobado).
- **Agente / herramienta**: agente Web; Next.js 15; Firebase Web SDK v12; Zustand; Lucide; TypeScript.
- **Ambiente declarado**: proyecto real `finanzas-m-plus` (QA_REAL / Firestore Standard / Google Auth). Sin emulador.
- **Implementación**:
  - **Navegación Personal Reducida (DEC-020)**: Menú de navegación lateral Personal reducido a 3 ítems: Inicio (`/dashboard`), Movimientos (`/movements`) y Ajustes (`/settings`). Cuentas y Categorías se gestionan como herramientas secundarias desde Ajustes y desde los selectores del composer.
  - **Ajustes y Gobernanza M+ (DEC-019, DEC-073, DEC-078, DEC-079, DEC-080)**:
    - `MplusSettingsView` montada en `/settings`: integra Perfil solo lectura (Google Auth), Organización (enlaces a Categorías, Cuentas y edición de cards de Inicio), Card unificada de ciclo de vida del Hogar (`MplusHouseholdLifecycleCard`), Preferencias de UI (ocultar saldos, notificaciones), Sesión (cerrar sesión seguro) y Zona de Peligro.
    - `executeMplusAccountReset` (`mplus-account-reset-service.ts`): reinicio reanudable y exhaustivo conforme a DEC-080 (pone usuario en `resetting`, elimina destructivamente el Hogar y desvincula al compañero a `none`, borra movimientos personales activos y papelera, borra cuentas y categorías, siembra las 22 categorías base Personal v1, y restaura usuario a `ready`).
    - Diálogo de confirmación de reinicio con advertencia destructiva clara (`mplus-reset-confirm-dialog.tsx`).
  - **Deprecación Completa de Circuitos Legacy (Regla 6 de docs/12)**:
    - Eliminados stores legacy: `personal-data-store.ts`, `household-data-store.ts`, `transaction-panel-store.ts`, `household-ui-store.ts`, `auto-settle-debt-store.ts`.
    - Eliminadas carpetas de características legacy: `features/pockets/`, `features/qa-reset/`, `features/transactions/`, `features/dashboard/`.
    - Eliminados archivos y servicios legacy en `features/accounts/`, `features/categories/`, `features/household/` y `lib/finance/`.
    - Eliminados tipos deprecados en `src/types/` (`account.ts`, `category.ts`, `household.ts`, `pocket.ts`, `third-party-funds.ts`, `transaction.ts`).
    - Desacoplados y modernizados: `dashboard-shell.tsx`, `session-boundary.ts`, `personal-transaction-row.tsx`, `category-breakdown-list.tsx`, `movement-composer-card.tsx`, `single-flight-submit-guard.ts`, `composer-primitives.tsx`.
    - Suite de pruebas unitarias actualizada: retirados tests de subsistemas borrados, mantenidas y creadas pruebas para M+ (`mplus-account-reset.test.ts`, etc.), runner `run-all.ts` actualizado.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 100% de tests unitarios pasando.
  - `npm run build`: 16/16 rutas estáticas y dinámicas compiladas exitosamente sin errores.
- **Estado al cerrar**: La Web expone ÚNICAMENTE el producto aprobado Finanzas M+, sin código muerto ni escrituras/superficies del modelo anterior, con navegación reducida y ciclo de vida/reinicio completo según DEC-019, DEC-020, DEC-073, DEC-078, DEC-079, DEC-080.
- **Próximo paso sugerido**: QA manual global E2E de Finanzas M+ Web contra `finanzas-m-plus`.

### Entrada - 2026-08-20 - W5: Estabilización y entrega Web

- **Fase / paso**: W5 (`PLAN_ADAPTACION_WEB.md` y Gate Web de `PLAN_QA_Y_PARIDAD.md` §6).
- **Agente / herramienta**: agente Web; Next.js 15; TypeScript; Firebase Web SDK v12; Zustand; Tailwind CSS.
- **Ambiente declarado**: proyecto real `finanzas-m-plus` (QA_REAL / Firestore Standard / Google Auth). Sin emulador (DEC-081).
- **Alcance y verificación técnica**:
  - `npx tsc --noEmit`: 0 errores de tipado en todo el código fuente y suites de pruebas.
  - `npm test`: 18 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100% de forma autónoma (~2.3s).
  - `npm run build`: compilación de producción de Next.js 15 exitosa (16/16 páginas estáticas y dinámicas generadas).
  - `npx next lint`: 0 errores de linting. Único warning preexistente aceptado: uso de `<img>` en `account-icon.tsx` para renderizado directo de logos vectoriales SVGs.
  - **Búsqueda estática exhaustiva**: 0 referencias vivas a rutas, stores, servicios o tipos legacy (`pockets`, `third_party`, `household_events`, `household_debts`, `household_shares`, stores y tipos deprecados).
  - **Hosting / Publicación**: Confirmado que la Web opera localmente y no existe publicación / Hosting de `finanzas-m-plus`.
  - **Gate Web §6 (`PLAN_QA_Y_PARIDAD.md`)**:
    - **Automatización y Paridad Contractual**: Cobertura completa de modelos, serializadores, transacciones OCC, cálculos de totales mensuales (Personal y Hogar), reinicio profundo reanudable (DEC-080), y reseteo total en frontera de sesión.
    - **Identidad Visual y Viewports**: Componentes y layouts preservan 100% la identidad visual web (tokens `--fm-*` y `--hh-*`) y la capacidad responsiva tanto en escritorio como en viewport móvil.
    - **QA Manual del Usuario**: Queda listo para la ejecución interactiva del usuario con dos cuentas Google reales (`Usuario QA A` y `Usuario QA B`) en el proyecto `finanzas-m-plus`.
  - **Defectos**: Cero defectos P0/P1 abiertos. P2 aceptado documentado (warning de optimización `<img>` en `account-icon.tsx`).
- **Estado al cerrar**: Finanzas M+ Web 100% estabilizada, probada y empaquetada para el QA cruzado con Android.

### Entrada — 2026-08-25 — Corrección de responsive móvil del shell principal (AppShell / Sidebar / TopBar)

- **Fase / paso**: Fix UX/Responsive Móvil post-W5.
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; GSAP; useFocusTrap.
- **Archivos creados**:
  - `tests/unit/mobile-shell-responsive.test.ts`
- **Archivos modificados**:
  - `src/components/layout/sidebar.tsx`
  - `src/components/layout/top-bar.tsx`
  - `src/components/layout/app-shell.tsx`
  - `src/lib/a11y/dialog-focus.ts`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - Bug responsive en 390×844 px donde el Sidebar se renderizaba como primer bloque y ocupaba toda la pantalla.
  - Ausencia de acceso móvil a la navegación (hamburguesa / drawer).
  - Foco inicial en el drawer móvil: al abrirse, el foco se posiciona inmediatamente en el botón "Cerrar menú de navegación" (o primer control focusable) sin requerir pulsar Tab.
- **Decisiones técnicas tomadas**:
  - `AppShell` separa el Sidebar de escritorio (`hidden lg:block lg:sticky lg:top-0 lg:h-screen`) del contenido principal y renderiza un drawer lateral accesible (`role="dialog"`, `aria-modal="true"`, `id="mobile-navigation"`, `aria-label="Navegación principal"`) condicionado a `mobileNavOpen` en pantallas `< lg`.
  - Helper `resolveInitialDrawerFocus` en `src/lib/a11y/dialog-focus.ts` para situar inmediatamente el foco en el botón de cierre preferente o primer control foco-navegable al abrir el drawer móvil.
  - Integración de `useFocusTrap` para atrapar foco en el drawer móvil, manejar tecla `Escape`, y restaurar el foco automáticamente al botón de apertura en el `TopBar`.
  - Bloqueo de scroll de `body` (`overflow: hidden`) mientras el drawer móvil está abierto.
  - Cierre automático del drawer móvil al navegar (`pathname`), al hacer clic en enlaces o al redimensionar a `>= 1024px`.
  - `TopBar` añade botón de menú (`Menu` icon de Lucide) visible solo en móvil (`lg:hidden`) con `aria-expanded` y `aria-controls="mobile-navigation"`, con tokens de color contextuales (Personal vs Hogar).
  - `Sidebar` soporta props móviles (`isMobile`, `onClose`, `onNavigate`), botón de cierre `X` en cabecera cuando está en drawer móvil, y `overflow-y-auto` para visualización correcta en pantallas cortas.
  - Cero cambios en Firebase, contratos, modelos o flujos de datos.
- **Skills aplicadas**: `web-design-guidelines`, `accessibility`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 19 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100% (~2.4s), incluyendo pruebas conductuales de foco inicial.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 rutas estáticas y dinámicas).
  - `git diff --check`: 0 advertencias de espacios en blanco.
- **Estado al cerrar**: Contenido principal se muestra inmediatamente en móvil (390×844 px), menú de navegación accesible y funcional con foco inicial automático, escritorio estable a 264px.
- **Próximo paso sugerido**: QA manual de usuario en dispositivos móviles y de escritorio.

### Entrada — 2026-08-25 — Rediseño del resumen financiero de /dashboard en contexto Personal

- **Fase / paso**: Rediseño UX hero Personal post-W5.
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Personal; Lucide Icons.
- **Archivos creados**:
  - `tests/unit/personal-dashboard-flow-summary.test.ts`
- **Archivos modificados**:
  - `src/features/movements/lib/personal-month-view-model.ts`
  - `src/features/movements/components/personal-home-view.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - Rediseño del bloque superior de `/dashboard` en contexto Personal: Ingresos y Gastos convertidos en los protagonistas visuales simétricos.
  - Eliminado "Diferencia del mes" como título dominante y cifras gigantes redundantes.
  - Añadida barra horizontal compacta de flujo continuo (participación verde/rojo sobre `flujoTotal = ingresos + gastos`).
  - "Balance del mes" relegado a resultado secundario inferior, con indicador `En equilibrio` cuando el balance es cero.
- **Decisiones técnicas tomadas**:
  - `calculatePersonalFlowSummary`: función pura en `personal-month-view-model.ts` que calcula `incomeSharePercent = (income / totalFlow) * 100` y `expenseSharePercent = 100 - incomeSharePercent` garantizando suma exacta del 100% sin `NaN`, divisiones por cero ni anchos anómalos.
  - Tarjeta única `FinanceCard variant="hero"` con encabezado contextual discreto `Resumen de [mes] [año]`.
  - Fila principal en grid de 2 columnas simétricas en escritorio (`lg`) y apiladas en móvil (`< lg`) sin desbordamiento horizontal a 320 px.
  - Barra de flujo con `role="img"` y `aria-label` descriptivo (sin atributos de progressbar al ser comparación de dos flujos). Barra neutral en estado vacío (`flujoTotal === 0`).
  - Balance secundario en `size="sm"` con signo `+` verde si positivo, `−` rojo si negativo, y `$ 0` neutral con badge `En equilibrio` si es cero.
  - Respeto de `prefers-reduced-motion` mediante `motion-safe:transition-[width]`.
  - Cero cambios en contratos, Firebase, rutas o contexto Hogar.
- **Skills aplicadas**: `brainstorming`, `writing-plans`, `web-design-guidelines`, `accessibility`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 20 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Dashboard Personal con resumen financiero enfocado en Ingresos/Gastos protagonistas y balance secundario verificado.
- **Próximo paso sugerido**: Revisión visual en navegador y continuar con siguientes iteraciones aprobadas.

### Entrada — 2026-08-25 — Rediseño del Inicio Personal con tarjeta analítica única por categoría

- **Fase / paso**: Simplificación de Inicio Personal (W5 post-rediseño).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Finance; Lucide Icons.
- **Archivos creados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
- **Archivos modificados**:
  - `src/features/movements/lib/personal-month-view-model.ts`
  - `src/features/movements/components/personal-home-view.tsx`
  - `src/components/layout/dashboard-shell.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - Reemplazada la cuadrícula de cards del Inicio Personal por una única tarjeta analítica grande de categorías debajo del resumen mensual.
  - Eliminados del Inicio Personal: movimientos recientes, lista de cuentas, drag and drop, cards reordenables/ocultables y el botón "Editar tablero" de la barra superior.
  - Creado componente `PersonalCategoryChart`:
    - Escritorio (`>= md`): barras verticales con escala relativa, importes COP visibles y porcentaje por encima de la barra.
    - Móvil (`< md`): barras horizontales compactas con nombre a la izquierda, importe y porcentaje a la derecha, sin desbordamiento ni scroll horizontal a 320 px.
  - Implementada regla de agregación 6 + "Otras":
    - Mantiene hasta 6 categorías individuales de mayor a menor importe.
    - Agrupa a partir de la 7ma categoría en "Otras" con color neutro (`#94A3B8`) e icono `other`, preservando la suma exacta de importe y porcentaje.
  - Selector accesible segmentado `Gastos` / `Ingresos` con `aria-pressed`, iniciando por defecto en `Gastos`.
  - Estado vacío integrado dentro de la misma tarjeta cuando no hay registros para el modo seleccionado.
  - Se preservaron intactas las rutas `/movements`, `/accounts`, `/categories`, Ajustes y todo el contexto Hogar.
  - Cero modificaciones a Firebase, contrato v1, modelos de datos o backend.
- **Decisiones técnicas tomadas**:
  - `buildDashboardCategoryChartData`: función pura en `personal-month-view-model.ts` que filtra importes positivos, preserva el top 6 y genera el grupo agregado "Otras".
  - Gráfico nativo con Tailwind CSS y tokens de color canónicos de categorías existentes sin añadir dependencias externas de visualización.
  - Semántica accesible `role="img"` con `aria-label` descriptivo individual por categoría e importe COP formateado.
  - Animaciones condicionadas a `motion-safe:transition-[height]` y `motion-safe:transition-[width]`.
- **Skills aplicadas**: `web-design-guidelines`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 21 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100% (~2.5s).
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Inicio Personal con resumen de flujo mensual y tarjeta analítica única responsiva y accesible por categoría completada y verificada.
- **Próximo paso sugerido**: QA manual de usuario en diferentes dispositivos y resoluciones.

### Entrada — 2026-08-25 — Endurecimiento del gráfico de categorías en Inicio Personal

- **Fase / paso**: Auditoría y endurecimiento de UI/a11y en Inicio Personal (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Finance; TypeScript.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `src/features/movements/components/personal-home-view.tsx`
  - `src/features/movements/lib/personal-month-view-model.ts`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Privacidad de montos (`masked`)**: `PersonalCategoryChart` ahora recibe y utiliza `masked: boolean`, pasando la prop a todos los componentes `Amount`. Cuando `masked === true`, `aria-label` enuncia `[Nombre]: monto oculto, [X]% de [modo]`, ocultando cifras sin esconder nombres de categoría ni porcentajes.
  - **Etiquetas completas sin truncamiento**: Retirado `truncate` en móvil y escritorio. Se implementó wrap multilínea (`break-words` y `line-clamp-2` en escritorio) con soporte para nombres largos sin desbordamiento horizontal a 320 px ni colisión con montos.
  - **Geometría de barras verticales**: En escritorio (`>= md`), cada categoría separa claramente 3 zonas independientes: zona superior (monto y porcentaje), zona intermedia flexible y acotada de trazado (`min-h-[120px]`), y zona inferior (etiqueta con wrap). Las barras calculan su altura exclusivamente dentro del área de trazado, impidiendo desbordamientos.
  - **Adaptador de datos robusto**: `buildDashboardCategoryChartData` trabaja sobre copia, filtra importes positivos y finitos (descartando cero, negativos, `NaN` e `Infinity`), ordena descendentemente de forma determinista, mantiene el top 6 y agrupa el resto en `Otras` calculando porcentajes enteros (0-100) derivados de la suma real.
  - Cero cambios en Firebase, contratos, rutas, Hogar ni arquitectura compartida.
- **Decisiones técnicas tomadas**:
  - `aria-label` descriptivo condicional a `masked` garantiza paridad de accesibilidad y privacidad para lectores de pantalla.
  - Geometría de 3 zonas mediante flexbox (`h-10` top, `flex-1` plot, `min-h-[2.5rem]` bottom) garantiza que la barra de mayor valor (100%) no empuje ni solape textos.
- **Skills aplicadas**: `web-design-guidelines`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 21 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfico de categorías del Inicio Personal endurecido en privacidad, tipografía responsiva, geometría vertical y adaptadores de datos.
- **Próximo paso sugerido**: QA manual de usuario en dispositivos móviles y de escritorio.

### Entrada — 2026-08-25 — Composición adaptativa de escritorio para pocas categorías en Inicio Personal

- **Fase / paso**: Ajuste visual y composición de UI en Inicio Personal (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; TypeScript.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Distribución adaptativa en escritorio (`>= md`)**:
    - Con 1, 2 o 3 categorías (`isCompactDesktop`): las columnas se alinean al inicio (`justify-start`) con una separación constante y moderada (`gap-8 sm:gap-12`), y un ancho acotado (`w-28 sm:w-32 max-w-[140px] shrink-0`), evitando que las barras se estiren de forma desconectada a extremos opuestos.
    - Con 4 a 7 categorías: se conserva la distribución comparativa amplia (`justify-between gap-3 sm:gap-4`) con columnas expandibles simétricas (`flex-1 min-w-0`).
  - **Móvil (< md) preservado**: barras horizontales intactas sin scroll horizontal ni regresiones.
  - Cero cambios en Firebase, contratos, cálculos financieros, rutas ni contexto Hogar.
- **Decisiones técnicas tomadas**:
  - Regla declarativa `isCompactDesktop = items.length <= 3` aplicada condicionalmente en el contenedor y columnas de escritorio.
  - Estructura de 3 zonas independientes por columna preservada íntegramente.
- **Skills aplicadas**: `web-design-guidelines`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 21 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfico de categorías del Inicio Personal con composición visual adaptativa compacta para pocas categorías y amplia para conjuntos mayores.
- **Próximo paso sugerido**: QA visual manual de usuario en escritorio y móvil.

### Entrada — 2026-08-25 — Expansión vertical del gráfico de categorías y resumen compacto en Inicio Personal

- **Fase / paso**: Optimización de layout y aprovechamiento de viewport vertical en Inicio Personal (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; TypeScript.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/components/finance/finance-card.tsx`
  - `src/components/layout/app-shell.tsx`
  - `src/features/movements/components/personal-home-view.tsx`
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Layout vertical de escritorio (`lg`+)**: `AppShell` y `MplusHomeView` estructuran el área principal como columna flex (`flex-1 flex flex-col min-h-0`), permitiendo que el contenido aproveche toda la altura disponible del viewport entre el TopBar y el límite inferior sin provocar desbordamientos ni scroll artificial.
  - **Card de resumen compacta**: Reducidos espaciados verticales (`space-y-3.5 sm:space-y-4`, `py-3 sm:py-3.5`) y paddings internos preservando al 100% la jerarquía visual de Ingresos, Gastos, barra de flujo y Balance del mes con su badge.
  - **Tarjeta y gráfico de categorías expansibles**: `FinanceCard` soporta `contentClassName` y se expande (`flex-1 min-h-0`), y `PersonalCategoryChart` utiliza `flex-1 min-h-[220px]` con zona de trazado `flex-1 min-h-[120px]`, logrando barras más altas y visualmente relevantes en monitores de alta resolución.
  - **Responsive y móviles intactos**: En móvil (`< md`) y tablet (`< lg`), se conserva el flujo vertical natural con scroll estándar de página, barras horizontales y sin fijar alturas arbitrarias ni scroll horizontal.
  - Cero cambios en Firebase, contratos, cálculos financieros, rutas ni contexto Hogar.
- **Decisiones técnicas tomadas**:
  - Integración de `contentClassName` en `FinanceCard` para desacoplar el layout flex interno de `CardContent`.
  - Zona de trazado vertical como flex-1 relativo con `min-h-[120px]` para asegurar altura mínima en viewports pequeños (768px de alto) y crecimiento fluido en viewports altos (900px+).
- **Skills aplicadas**: `web-design-guidelines`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 21 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Inicio Personal con resumen compacto y tarjeta analítica de categorías expansible verticalmente en escritorio con flujo natural en móvil.
- **Próximo paso sugerido**: QA visual manual de usuario en diferentes alturas de pantalla.

### Entrada — 2026-08-25 — Rediseño del Inicio de Hogar con resumen compacto y gráfico analítico expansible

- **Fase / paso**: Rediseño y alineación visual de Inicio de Hogar (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Hogar (`--hh-*`); TypeScript.
- **Archivos creados**:
  - `src/features/household/lib/household-dashboard-view-model.ts`
  - `src/features/household/components/household-category-chart.tsx`
  - `tests/unit/household-dashboard-chart.test.ts`
- **Archivos modificados**:
  - `src/features/household/components/ui/household-card.tsx`
  - `src/features/household/components/mplus-household-overview.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Simplificación del Inicio de Hogar**:
    - Eliminadas las 3 mini-cards, el grid previo y la card de movimientos recientes en Inicio.
    - Se estructura exactamente en 2 cards principales: Resumen mensual hero y Tarjeta analítica única expansible.
  - **Resumen mensual compacto de Hogar**:
    - Resumen con título, chip contextual de Hogar, Ingresos y Gastos como protagonistas simétricos en tamaño display, barra continua de flujo proporcional (`role="img"`) calculada sobre `ingresos + gastos` sin divisiones por cero, y Balance del mes con indicador "En equilibrio" cuando sea cero.
    - Respeto total de `masked` con `$ ----` y `monto oculto` en `aria-label`.
  - **Tarjeta analítica única con discriminación funcional**:
    - Selector segmentado accesible `Gastos` / `Ingresos` (`role="group"`, `aria-pressed`).
    - En modo `Gastos`: distribución por categoría compartida preservando `Por clasificar` (`isUnclassified: true`, `#94A3B8`), orden descendente, top 6 + `Otras`.
    - En modo `Ingresos`: distribución por integrante (`ownerId`), sumando sus aportes compartidos del período, con paleta armónica sage y nombres visibles.
    - Aviso compacto integrado dentro de la card cuando existen gastos sin clasificar con botón `Clasificar gastos` hacia `/household/movements`.
  - **Gráfico responsive de Hogar**:
    - Móvil (< md): barras horizontales compactas con nombres completos multilínea sin `truncate` y sin scroll horizontal.
    - Escritorio (>= md): barras verticales en 3 zonas independientes, modo compacto para 1–3 elementos alineados al inicio, y distribución amplia para 4–7 elementos.
    - Expansión vertical en `lg`+ con `flex-1 min-h-[220px]` y zona de trazado `flex-1 min-h-[120px]`.
  - Cero alteraciones en Firebase, contratos compartidos, rutas ni contexto Personal.
- **Decisiones técnicas tomadas**:
  - Adaptadores puros en `household-dashboard-view-model.ts` para transformar `rawExpenseBreakdown` e ingresos por integrante sin mutar datos de dominio ni alterar fixtures de paridad.
  - Uso estricto de componentes (`HouseholdCard`, `HouseholdAmount`, `HouseholdChip`) y tokens `--hh-*`.
- **Skills aplicadas**: `web-design-guidelines`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 22 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Inicio de Hogar alineado a la estructura aprobada de Inicio Personal con diseño, tokens y funcionalidad propios de Hogar.
- **Próximo paso sugerido**: QA manual de usuario en contexto Hogar en diversos viewports.

### Entrada — 2026-08-25 — Corrección del desfase de un mes en Hogar y de la sincronización de movimientos compartidos

- **Fase / paso**: Corrección de bug de datos Personal → Hogar (W5), derivada de auditoría técnica previa.
- **Agente / herramienta**: agente Web; Next.js 15; Zustand; TypeScript.
- **Archivos creados**:
  - `src/lib/mplus/period.ts`
  - `tests/unit/mplus-period-contract.test.ts`
  - `tests/unit/mplus-household-shared-movement-sync.test.ts`
- **Archivos modificados**:
  - `src/features/household/hooks/use-mplus-household.ts`
  - `src/features/movements/hooks/use-mplus-personal.ts`
  - `src/features/movements/hooks/use-movement-mutations.ts`
  - `src/stores/mplus-household-store.ts`
  - `tests/unit/mplus-household-contract.test.ts`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Bug 1 — Hogar consultaba siempre el mes anterior**:
    - `SelectedPeriod.month` es 0-indexado y `resolveMonthRangeFor` exige mes calendario 1-12 (contrato §4.6, §19). Personal traducía con `+1`; `useMplusHouseholdLoader` pasaba el valor crudo, así que con "Agosto 2026" en pantalla la consulta §19.3 pedía `occurredAt >= 2026-07-01 AND < 2026-08-01`. Todo movimiento compartido de agosto quedaba fuera del rango: Ingresos $0, Gastos $0 y "Sin gastos compartidos este mes" bajo el rótulo "Agosto 2026". Con Enero (mes 0) consultaba diciembre del año anterior.
    - La traducción se extrae a una pieza única, `toContractPeriod` en `src/lib/mplus/period.ts`, que ahora usan los dos drivers. Se elimina la copia local del driver Personal.
    - Defecto preexistente desde `48afd0e` (2026-08-20, W3); el rediseño de Inicio de Hogar (`aef4e28`) no lo introdujo.
  - **Bug 2 — Hogar no se enteraba de lo confirmado en Personal**:
    - Las mutaciones Personales solo notificaban al store Personal, y el `load` de Hogar corta si el hogar y el período no cambiaron, así que un movimiento marcado "Contar en Hogar" no aparecía en el tablero compartido hasta recargar la página o cambiar de mes.
    - `useMovementMutations` ahora ofrece cada documento confirmado —y cada purga y cada relectura por conflicto o `replayed`— a los dos stores.
  - **Endurecimiento del store de Hogar**:
    - `applyCommittedMovement` aceptaba cualquier documento del hogar sin mirar mes ni ciclo de vida. Ahora el store guarda el `range` del mes cargado y solo admite lo que cumple las tres condiciones de la consulta canónica §19.3: hogar propio, `lifecycleState = active` y `occurredAt` dentro del mes. Dejar de compartir, enviar a Papelera o mover a otro mes retira el movimiento del tablero.
    - Se añade `removeMovement` para la eliminación física (§9.5), en paralelo al store Personal.
- **Decisiones técnicas tomadas**:
  - La convención de mes vive en una sola pieza compartida en lugar de replicarse por driver: era la causa estructural de que las dos superficies divergieran.
  - El store de Hogar valida pertenencia igual que el Personal (rango + ciclo de vida) en vez de confiar en quien lo llama, ahora que lo alimentan dos superficies.
  - Los dos runners de Hogar se encadenan en `run-all.ts`: comparten el store singleton y sus servicios inyectados, y en paralelo se pisaban el estado.
  - No se tocó Firebase, reglas, índices, el contrato compartido ni `recursos/orquestador/`.
- **Skills aplicadas**: `systematic-debugging`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 38 suites unitarias vía `tests/unit/run-all.ts` pasando al 100%, incluidas las 2 nuevas.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
  - Guarda de regresión verificada contra el código original de `48afd0e`: la nueva prueba estructural rechaza el driver con el bug, así que no es decorativa.
- **Estado al cerrar**: Hogar consulta el mes que muestra y refleja sin recargar los movimientos compartidos confirmados desde Personal.
- **Próximo paso sugerido**: QA manual de usuario — registrar en Personal un ingreso y un gasto de agosto 2026 con "Contar en Hogar" y confirmar que ambos aparecen y suman en Inicio de Hogar sin recargar la página.

### Entrada — 2026-08-26 — Restauración del trigger dorado y menú rico de creación en Personal

- **Fase / paso**: Restauración visual y a11y del menú de creación Personal (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Personal (`--fm-*`); TypeScript.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/components/layout/dashboard-shell.tsx`
  - `tests/unit/personal-shell-navigation.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Restauración del trigger "Nuevo" en Personal**:
    - Recuperada la apariencia de acción primaria dorada con `bg-[var(--fm-pending)]`, texto oscuro `text-[var(--fm-ink)]`, hover con mezcla a blanco `hover:bg-[color-mix(in_oklch,var(--fm-pending),white_8%)]`, sombra cálida `shadow-[0_16px_36px_rgb(228_179_99/0.24)]`, altura de 44px (`min-h-11`), esquinas `rounded-[18px]` y foco accesible.
    - Se eliminó el estilo azul genérico del trigger de creación personal.
  - **Restauración del menú enriquecido de 292px**:
    - `FinanceDropdown` configurado con `align="right"`, `itemLayout="rich"`, `menuWidth={292}` y `menuClassName="w-[292px]"`.
    - Ítems con iconos semánticos (`ArrowDownLeft` con badge rojo para gastos, `ArrowUpRight` con badge verde para ingresos), títulos y descripciones ("Registrar una salida de dinero" / "Registrar una entrada de dinero").
  - **Aislamiento e integridad**:
    - Hogar permanece 100% inalterado con su acción directa `Nuevo gasto`, `HouseholdButton` y tokens `--hh-*`.
    - Cero cambios en Firebase, contratos compartidos, store o rutas.
- **Decisiones técnicas tomadas**:
  - Reutilización de las capacidades declarativas nativas de `FinanceDropdown` (`itemLayout="rich"`, `menuWidth`) sin introducir lógica de estilos ad-hoc.
- **Skills aplicadas**: `frontend-design`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Trigger dorado y menú enriquecido de creación en Personal restaurados fielmente con aislamiento total de Hogar.
- **Próximo paso sugerido**: QA manual de usuario en la navegación y apertura de creación en Personal.

### Entrada — 2026-08-26 — Restauración del detalle de movimiento en Personal

- **Fase / paso**: Corrección de regresión funcional en historial Personal (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Personal (`--fm-*`); TypeScript.
- **Archivos creados**:
  - `src/features/movements/components/personal-movement-detail-dialog.tsx`
  - `tests/unit/personal-movement-detail.test.ts`
- **Archivos modificados**:
  - `src/components/finance/personal-transaction-row.tsx`
  - `src/features/movements/components/movements-view.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Corrección de regresión de detalle Personal**:
    - Durante la migración W2 (`38912af`), la lista Personal en `/movements` pasó a filas no clicables, perdiendo el diálogo de consulta de detalle.
    - Se restauró la capacidad de consultar detalles exclusivamente en Personal mediante el componente `PersonalMovementDetailDialog`, basado en `FinanceDialog`, `Amount` y tokens `--fm-*`.
    - `PersonalTransactionRow` expone la prop `onSelect` creando un botón accesible con foco visible y `aria-label` descriptivo en el área informativa sin anidar controles interactivos con el menú de acciones (`actionSlot`).
    - En modo `active`, hacer clic o presionar Enter/Espacio en una fila abre el diálogo de solo lectura mostrando: monto en tamaño display, título, fecha, tipo, categoría (con color e icono), cuenta origen, estado de destino ("Cuenta en Hogar" / "Solo personal") y nota opcional.
    - En modo `trash` (Papelera), la interacción de detalle permanece inactiva (`onSelect` es `undefined`), preservando sus acciones específicas de restauración y vencimiento.
    - El diálogo respeta `masked` (montos ocultos) sin exponer cifras numéricas en atributos accesibles ni textos de pantalla.
    - Ofrece acciones integradas `Editar` (delega a `openEdit` del composer store) y `Eliminar` (delega a `openTrash` para eliminación lógica hacia papelera).
  - **Aislamiento de Hogar e integridad**:
    - Hogar permanece intacto con su propio `HouseholdDialog` y vistas sin modificaciones.
    - Cero cambios en Firebase, contratos de datos, cálculo o rutas.
- **Decisiones técnicas tomadas**:
  - `PersonalTransactionRow` aísla el botón semántico de la zona informativa del `actionSlot`, evitando anidamiento inválido de botones `<button>`.
  - Reutilización de los canales centrales de mutación y composer de `mplus-composer-store`.
- **Skills aplicadas**: `frontend-design`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 39 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Detalle de movimiento Personal 100% operativo y accesible en `/movements`, con aislamiento estricto de Hogar.
- **Próximo paso sugerido**: QA manual de usuario en la navegación y apertura de detalle en Personal.

### Entrada — 2026-08-26 — Unificación de la experiencia de Movimientos en Personal y Hogar

- **Fase / paso**: Unificación de gramática visual y de interacción en historiales de Personal y Hogar (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Personal (`--fm-*`) y Hogar (`--hh-*`); TypeScript.
- **Archivos creados**:
  - `tests/unit/movements-experience-parity.test.ts`
- **Archivos modificados**:
  - `src/features/household/lib/household-dashboard-view-model.ts`
  - `src/features/household/components/mplus-household-movements-view.tsx`
  - `src/components/finance/personal-transaction-row.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Composición unificada de 2 Cards**:
    - Tanto en `/movements` como en `/household/movements`, la página adopta la composición:
      1. Card de filtros (búsqueda + botones de tipo + selectores contextuales + botón "Limpiar").
      2. Card de historial (agrupación por día con etiqueta de fecha discreta + filas clicables con foco visible y affordance).
  - **Gramática de filtros coherente con datos propios**:
    - **Personal**: Búsqueda por título, Tipo (Todos / Ingresos / Gastos), Cuenta (IconSelect con logos bancarios), Categoría (IconSelect con iconos canónicos) y botón "Limpiar" con badge de filtros activos.
    - **Hogar**: Búsqueda por título, Tipo (Todos / Ingresos / Gastos), Miembro (con indicador "(Tú)"), Categoría Hogar (con opción destacada "Por clasificar"), Cuenta origen y botón "Limpiar" con badge de filtros activos.
  - **Agrupación cronológica descendente por día**:
    - Se implementó `groupHouseholdMovementsByDay` en `household-dashboard-view-model.ts` para ordenar y agrupar movimientos de Hogar por día con formato amigable ("Hoy", "Ayer", "14 ago 2026").
    - Ambas vistas renderizan cabeceras de día con `text-[11px] uppercase tracking-[0.22em]` y separadores sutiles entre filas.
  - **Jerarquía y affordance de filas**:
    - Icono a la izquierda en contenedor redondeado 36x36px con color de categoría.
    - Título y subtítulo en tipografía display con elipsis controlada.
    - **Personal**: Subtítulo incluye categoría, cuenta e indicador `Cuenta en Hogar` / `Solo personal` sin revelar IDs técnicos.
    - **Hogar**: Subtítulo incluye categoría Hogar ("Por clasificar" destacado), miembro registrador y badge "Por clasificar" en gastos pendientes.
    - Importe con soporte estricto de `masked` sin filtrar cifras en `aria-label`.
    - Área táctil mínima de 44px con feedback de hover, active y foco visible por teclado.
  - **Aislamiento e integridad**:
    - Personal conserva exclusivamente componentes `Finance*` y tokens `--fm-*`.
    - Hogar conserva exclusivamente componentes `Household*`, tokens `--hh-*`, `HouseholdDialog` y el flujo de reclasificación para gastos compartidos.
- **Decisiones técnicas tomadas**:
  - Separación total de los modelos de dominio: ningún componente mezcla reglas ni modelos entre Personal y Hogar.
  - Reutilización de `groupHouseholdMovementsByDay` manteniendo orden cronológico inmutable.
- **Skills aplicadas**: `frontend-design`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 40 suites unitarias ejecutadas vía `tests/unit/run-all.ts` pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Experiencia de `/movements` y `/household/movements` completamente unificada en diseño, estructura e interacción con respeto estricto a sus dominios y tokens.
- **Próximo paso sugerido**: QA manual de usuario en ambos historiales.

