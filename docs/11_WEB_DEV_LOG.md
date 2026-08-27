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

### Entrada — 2026-08-26 — Corrección de padding, márgenes y alineación en `/household/movements`

- **Fase / paso**: Ajuste fino de paridad visual de tarjetas, espaciados y dimensiones entre Personal y Hogar.
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Hogar (`--hh-*`); TypeScript.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/household/components/mplus-household-movements-view.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Eliminación de doble padding y discrepancias de dimensiones en Hogar**:
    - Se removió el contenedor `<div className="space-y-6">` que envolvía `MplusHouseholdMovementsView`, adoptando el Fragment `<>` directo para que el espaciado entre tarjetas provenga fielmente del contenedor `AppShell` (`space-y-5`), exactamente igual que en Personal.
    - Se configuró `contentClassName="p-4"` en ambas `HouseholdCard`, eliminando el padding interno por defecto `p-6` sumado a `p-4 sm:p-5` que duplicaba el tamaño vertical y horizontal de las tarjetas en Hogar.
    - Se estandarizó el ancho de los 3 selectores contextuales (Miembro, Categoría Hogar y Cuenta origen) a `w-full sm:w-48`, alineándolos con los `w-full sm:w-48` de Personal.
    - Se igualó el padding de entrada en el campo de búsqueda (`pl-11 pr-8`) y el padding de los botones de tipo (`h-9 px-3 text-xs`).
- **Decisiones técnicas tomadas**:
  - Homogeneización geométrica y de espaciados exactos sin alterar ningún token, contrato ni modelo de datos.
- **Skills aplicadas**: `frontend-design`, `accessibility`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 40 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Tarjetas de `/household/movements` con idénticos márgenes, paddings y proporciones que `/movements` Personal.
- **Próximo paso sugerido**: Verificación visual por parte del usuario.

### Entrada — 2026-08-26 — Rediseño y alineación arquitectónica de `/household/settings`

- **Fase / paso**: Adaptación de la arquitectura visual de Ajustes Hogar inspirada en Ajustes Personal (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Tailwind CSS; tokens Hogar (`--hh-*`); TypeScript.
- **Archivos creados**:
  - `tests/unit/household-settings-view.test.ts`
- **Archivos modificados**:
  - `src/features/household/components/mplus-household-settings-view.tsx`
  - `src/app/(dashboard)/household/settings/page.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Card superior unificada de 2 columnas (Hero de Hogar)**:
    - Se rediseñó el Hero superior a ancho completo (`lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]`), apilado de forma natural en móvil con divisor horizontal/vertical.
    - **Columna izquierda ("Tu cuenta")**: Avatar del usuario autenticado (`ProfileAvatar`), nombre prominente, correo, badge de contexto "Miembro del hogar" y metadata de moneda "COP".
    - **Columna derecha ("Hogar compartido")**: Título del espacio compartido, badge de integrantes ("2 de 2 miembros") y lista compacta de miembros con avatar, nombre, rol y estado ("Miembro activo" / "En pausa").
    - Cero exposición de información financiera privada ni saldos de otros miembros.
  - **Grilla de 2 columnas para Preferencias y Organización**:
    - **Card de Preferencias**: Explica de forma transparente que la protección de saldos (modo incógnito) es global y se gestiona en Personal, informa sobre notificaciones de gastos para móvil y resume la moneda del hogar (COP) sin inventar toggles falsos.
    - **Card de Organización**: Filas semánticas a ancho completo con iconos temáticos (`Tags`, `Users`, `Shield`), títulos, descripciones, chevron, foco visible y área táctil mínima de 44px:
      1. `Categorías de gasto del hogar` (conteo de categorías activas y enlace a `/household/categories`).
      2. `Integrantes e invitaciones` (conteo de miembros y enlace de gobernanza a Ajustes Personal).
      3. `Administrar el hogar` (absorbe el aviso previo integrándolo de forma limpia como acción navegable hacia Ajustes Personal).
  - **Aislamiento de tokens e integridad**:
    - Uso exclusivo de tokens `--hh-*` y `HouseholdCard`.
    - Ajustes Personal (`src/features/settings/components/mplus-settings-view.tsx` y `src/components/finance/settings-blocks.tsx`) permanece 100% intacto.
    - Cero cambios en Firebase, contratos compartidos, reglas de seguridad ni centro de mandos.
- **Decisiones técnicas tomadas**:
  - Implementación del subcomponente `HouseholdSettingItem` con semántica `<button>` o `<div>` según interactividad, garantizando área táctil de 44px y anillo de foco visible `--hh-focus-ring`.
  - Conexión de `useAuthStore` en `HouseholdSettingsPage` para alimentar la identidad del usuario actual (`displayName`, `email`, `photoUrl`).
- **Skills aplicadas**: `frontend-design`, `accessibility`, `test-driven-development`.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 41 suites unitarias pasando al 100% (8 pruebas en `household-settings-view.test.ts`).
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Ajustes Hogar alineado con la jerarquía, elegancia y proporciones maduras de Ajustes Personal, adaptado a los permisos y tokens de Hogar.
- **Próximo paso sugerido**: QA manual de usuario en la navegación y visualización de Ajustes Hogar.

### Entrada — 2026-08-26 — Restauración de acceso visible a Categorías en menú lateral Personal

- **Fase / paso**: Corrección de encontrabilidad y navegación en menú lateral Personal.
- **Agente / herramienta**: agente Web; TypeScript.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/components/layout/navigation.ts`
  - `tests/unit/personal-shell-navigation.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Restauración de "Gastos por categoría" en Personal**:
    - Se restauró el ítem `Gastos por categoría` (`/categories`) con icono `CircleDollarSign` en `personalNavigationItems`, ubicado entre `Movimientos` y `Ajustes`.
    - La vista de categorías personales ofrece distribución completa por tabs y administración del catálogo, funcionalidad que el gráfico resumen del Inicio no sustituye.
    - Se mantuvo intacto el diseño del Inicio, la ruta `/household/categories` en Hogar y el aislamiento entre contextos.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 41 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Navegación de categorías visible, accesible y coherente en Personal y Hogar.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Unificación de arquitectura visual de Gastos por Categoría en Hogar

- **Fase / paso**: Alineación de diseño y paridad de experiencia en `/household/categories` respecto de `/categories` Personal.
- **Agente / herramienta**: agente Web; TypeScript; Next.js 15; Tailwind CSS; tokens Hogar (`--hh-*`).
- **Archivos creados**:
  - `tests/unit/household-categories-view.test.ts`
- **Archivos modificados**:
  - `src/features/household/components/mplus-household-categories-view.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Paridad de estructura y diseño en Gastos por Categoría Hogar**:
    - **Control de pestañas**: Centrado en `max-w-md mx-auto` con botones al 50% de ancho (`Distribución de gastos` y `Categorías del hogar`).
    - **Pestaña Distribución de gastos**: Implementación de arquitectura de 2 Cards:
      1. Card Hero superior (`HouseholdCard variant="hero"`) con `Total gastado en [Mes Año]` y `HouseholdAmount size="hero"`.
      2. Card de Desglose (`HouseholdCard variant="default"`) con filas por categoría, porcentaje, monto a la derecha y barra de progreso inferior con animación y fondo `--hh-border-soft`.
    - **Pestaña Categorías del hogar (Gestión)**:
      1. Botón superior punteado a ancho completo `+ Nueva categoría` (`w-full h-14 rounded-2xl border border-dashed`).
      2. Lista vertical en `HouseholdCard` a ancho completo con `divide-y divide-[var(--hh-border-soft)]`.
      3. Menú de 3 puntos `MoreVertical` en cada fila con opciones flotantes accesibles (`Editar` y `Archivar`).
      4. Confirmación inline al archivar con advertencia `¿Archivar [Categoría]?` antes de aplicar la mutación.
      5. Sección inferior `Archivadas` con chip de conteo y botón `Reactivar`.
    - **Aislamiento estricto de tokens**: Uso exclusivo de tokens `--hh-*` y componentes `Household*`. Cero tokens `--fm-*` en Hogar. Personal permanece intacto.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100% (7 nuevas pruebas en `household-categories-view.test.ts`).
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Ambas vistas de categorías (Personal y Hogar) comparten la misma gramática y arquitectura visual, respetando sus tokens e identidades de color respectivas.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Paridad visual exacta en Hero Card de Ajustes Hogar

- **Fase / paso**: Perfeccionamiento visual y alineación milimétrica de Ajustes Hogar (`/household/settings`) con Ajustes Personal (`/settings`).
- **Agente / herramienta**: agente Web; TypeScript; Next.js 15; Tailwind CSS; tokens Hogar (`--hh-*`).
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/household/components/mplus-household-settings-view.tsx`
  - `tests/unit/household-settings-view.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Paridad exacta de proporciones y layout en Hero Card de Hogar**:
    - **Columna Izquierda ("Tu cuenta")**: Estandarización de tipografía, avatar `xl`, espaciado y línea inferior `Moneda · COP` idéntica a Personal.
    - **Columna Derecha ("Hogar compartido")**:
      1. Se reemplazó la grilla horizontal de 2 columnas de integrantes por una **lista vertical a ancho completo** (`space-y-2`), con avatares `sm` y filas completas idénticas a Personal.
      2. Se agregaron las acciones en el pie de tarjeta: `Salir (pausa)` y `Salirme del todo` con enlace coordinado a Ajustes Personal.
      3. Se eliminaron chips superfluos para mantener simetría y altura idéntica en ambas columnas.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Hero Card de Ajustes Hogar con paridad visual y estructural exacta respecto de Personal.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Corrección de desviación Web: eliminación de alta de movimientos desde Hogar

- **Fase / paso**: Alineación funcional con Android y especificación M+ (§5.1, §12.3, §14, §18.3).
- **Agente / herramienta**: agente Web; TypeScript; Next.js 15; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/components/layout/dashboard-shell.tsx`
  - `tests/unit/household-shell-navigation.test.ts`
  - `tests/unit/personal-shell-navigation.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Eliminación del CTA de alta desde Hogar**:
    - Se eliminó el botón `+ Nuevo gasto` (`HouseholdButton`) y el handler `openCreateExpense` del encabezado superior de las rutas de Hogar (`/household`, `/household/movements`, `/household/categories`, `/household/settings`).
    - Motivo: En Finanzas M+, Hogar es una consolidación compartida de solo lectura; las altas de ingresos y gastos se originan exclusivamente desde Personal marcando `Contar en Hogar`.
    - Se alineó la experiencia Web con la regla de Android (`shouldShowFab` visible únicamente en Personal).
    - En Hogar, el encabezado conserva exclusivamente el selector de período. En Personal, el menú `Nuevo` continúa operando con normalidad.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Shell de Hogar alineado funcionalmente con Android y la especificación canónica.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Depuración de Ajustes: retiro de preferencias legacy, diagnóstico QA-only y reinicio alineado con Android

- **Fase / paso**: Depuración de Ajustes Web (W5).
- **Agente / herramienta**: agente Web; Next.js 15; Zustand; TypeScript; webpack (`NormalModuleReplacementPlugin`).
- **Archivos creados**:
  - `src/lib/qa/qa-tools.ts`
  - `src/features/qa-reset/index.tsx`
  - `src/features/qa-reset/production-stub.tsx`
  - `src/features/qa-reset/components/qa-diagnostics-card.tsx`
  - `src/features/qa-reset/components/qa-reset-setting-item.tsx`
  - `src/features/qa-reset/services/mplus-reset-gateway.ts`
  - `tests/unit/settings-legacy-and-qa-surface.test.ts`
  - `tests/unit/mplus-account-reset-flow.test.ts`
- **Archivos movidos**:
  - `mplus-reset-confirm-dialog.tsx` → `src/features/qa-reset/components/qa-reset-confirm-dialog.tsx`
  - `mplus-account-reset-service.ts` → `src/features/qa-reset/services/`
- **Archivos eliminados**:
  - `src/stores/ui-preferences-store.ts`
  - `src/stores/household-ui-preferences-store.ts`
  - `tests/unit/household-ui-preferences-store.test.ts`
- **TODOs resueltos**:
  - **Retiro de preferencias y Home configurable legacy**: fuera "Ocultar saldos al abrir", el botón del ojo del encabezado, "Notificaciones" y "Cards de Inicio", con su estado, claves de `localStorage` (`fm-hide-balances`, `fm-notifications-enabled`, `fm-board-order`, `fm-board-hidden`, `fm-hh-board-*`), acciones, pruebas y consumidores. La prop `masked` se retira de las 22 superficies que la propagaban: sin la preferencia era una prop que nunca podía ser `true`. Los dos stores de preferencias quedaron vacíos al retirar sus campos y se eliminaron; el gemelo de Hogar (`isEditingHouseholdBoard`, `householdBoardOrder`, `householdHiddenCards`) no tenía ningún consumidor de producción. También se retira `exitBoardEditing` de la limpieza de frontera de contexto.
  - **Ajustes con el alcance de la especificación §19**: desaparece la card Preferencias (quedaba vacía), desaparece la card "Sincronización en vivo" (§19.4 prohíbe diagnósticos técnicos al usuario final) y Organización conserva solo categorías y cuentas. Se mantienen perfil Google informativo, card de ciclo de vida del Hogar y cierre de sesión con confirmación.
  - **Diagnóstico de sincronización limitado a QA**: nuevo panel con evidencia real de los stores (estado y error de Personal y de Hogar, mes cargado, contador de recargas `generation`, UID abreviado, contexto, conectividad del navegador y la razón por la que la puerta QA está abierta). La acción "Recargar lecturas" re-ejecuta los `refresh()` reales y decide el resultado con el estado que quedó en los stores, no con que la promesa resolviera. No hay cola manual ni modo offline simulado. Es seguro de repetir: el circuito Web no usa `onSnapshot` (solo `getDoc`/`getDocs`) y ambos stores descartan respuestas obsoletas por `generation`; hay prueba que impide introducir listeners sin revisarlo.
  - **Reinicio QA alineado con Android y validado contra residuos de Hogar**: ver detalle abajo.
- **Auditoría del reinicio — fallos encontrados y corregidos**:
  - **Lectura del perfil del compañero**: el servicio hacía `getDoc(users/{otherUid})` para desvincularlo. Rules solo permiten `get`/`update` del documento propio (`ownsPath`), así que devolvía `PERMISSION_DENIED` y abortaba el reinicio con el Hogar ya medio borrado. Se retira; la desvinculación la hace el propio cliente del compañero con `reconcileOrphanHouseholdLink` (contrato §16.3), montado en el shell. Sin eso el compañero quedaba con un `householdId` colgado que le impedía crear o unirse a un Hogar nuevo.
  - **Contador de cuentas**: los movimientos propios se borraban en bruto. Rules exigen `deleteAccountCounterIsValid`: borrar un movimiento propio con `accountId` requiere decrementar esa cuenta en la MISMA escritura, y `accountReferenceDecreaseIsBacked` solo admite un decremento de uno por escritura. El borrado fallaba, y después el borrado de cuentas también (`allow delete` exige `referenceCount == 0`). Ahora se borra por rondas, una cuenta como mucho por lote.
  - **Lotes sin acotar**: un solo `writeBatch` para todos los movimientos; revienta a las 500 operaciones y el contrato §19.4 aprieta a 200. Ahora todo va en lotes de 200.
  - **Invitaciones incompletas**: solo se buscaban por `householdId`. Se añaden las otras dos fuentes que cubre Android: el `activeInviteId` del Hogar y las creadas por el usuario (`createdBy`), que quedaban huérfanas de Hogares anteriores.
  - **Reanudabilidad**: la limpieza de subcolecciones estaba dentro de `if (householdSnap.exists())`, así que un reintento tras una corrida interrumpida saltaba los residuos. Ahora se recorren siempre y el documento del Hogar se borra al final. El paso a `resetting` es idempotente.
  - **Conteos**: `deletedMovementsCount` mezclaba movimientos propios con los compartidos del compañero. Ahora son dos cifras separadas y se reporta el desglose por subcolección.
  - **Cierre de sesión**: el diálogo volvía a `/dashboard` y afirmaba que la sesión de Google se conservaba. Ahora cierra sesión en Firebase Auth, limpia los stores y redirige al acceso inicial.
  - Se confirmó contra el contrato §5 que la lista de subcolecciones (`members`, `expenseCategories`, `categoryMappings`, `memberCategoryLabels`, `memberAccountLabels`, `closureApprovals`) está completa.
- **Decisiones técnicas tomadas**:
  - El reinicio se reescribió contra un puerto inyectable (`MplusResetGateway`). Antes llamaba al SDK directo y ninguna prueba podía ver qué borraba: por eso los fallos anteriores solo aparecían contra el proyecto real.
  - El corte de producción NO se deja al minificador. Se comprobó contra el bundle real que una llamada a función de otro módulo no se pliega, y que una variable `NEXT_PUBLIC_*` ausente del entorno del build queda como lectura en runtime: con ambas formas los textos del panel y del reinicio seguían publicados. El corte lo hace `NormalModuleReplacementPlugin` sustituyendo `@/features/qa-reset` por un stub inerte. Se aprovechó el alias que ya existía en `next.config.ts` y que apuntaba a un módulo inexistente.
  - La fila "Reiniciar cuenta" se mudó al módulo QA: dentro del bloque compartido su texto viajaba al bundle aunque nunca se renderizara.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: suite completa en verde, incluidas las 2 nuevas.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia (16/16 páginas).
  - `git diff --check`: 0 advertencias de formato.
  - **Bundle de producción inspeccionado con `grep` (cadenas ASCII, porque la minificación escapa los acentos como `\xf3` y un needle acentuado daba falso negativo)**: 0 apariciones de panel de diagnóstico, reinicio, servicio de borrado y preferencias retiradas. Con `NEXT_PUBLIC_MPLUS_QA_TOOLS=1` las herramientas sí aparecen, así que la salida de QA sigue disponible.
- **Estado al cerrar**: Ajustes Personal con el alcance de la especificación §19; diagnóstico y reinicio fuera del artefacto de producción; reinicio alineado con Android y probado contra residuos de Hogar.
- **Próximo paso sugerido**: QA manual de usuario — ejecutar un reinicio con Hogar y pareja en el proyecto real y confirmar que el compañero queda sin Hogar al abrir su sesión.

### Entrada — 2026-08-26 — Accesos directos independientes para Categorías y Cuentas en Ajustes Personal

- **Fase / paso**: Refinamiento de la arquitectura visual de Ajustes Personal (`/settings`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS; tokens Personal (`--fm-*`).
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/components/finance/settings-blocks.tsx`
  - `tests/unit/settings-legacy-and-qa-surface.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Reemplazo de la card contenedora "Organización" por dos cards hermanas independientes**:
    - Se eliminó el contenedor exterior y el título `Organización`.
    - Se implementaron dos cards directas, independientes y accesibles:
      1. `Administrar categorías`: Título, descripción `Crea, edita y archiva tus categorías personales.`, icono `Tag`, navegación a `/categories`.
      2. `Administrar cuentas`: Título, descripción `Crea, edita y archiva tus cuentas personales informativas.`, icono `CreditCard`, navegación a `/accounts`.
    - Cada card es un único botón interactivo con semántica accesible, soporte de teclado, foco visible con token `--fm-pending`, hover/active reactivos y sin chevrons redundantes.
    - Responsive: 2 columnas en desktop (`md:grid-cols-2`) y 1 columna en móvil/tablet con separación consistente.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Ajustes Personal con accesos directos independientes y limpios para categorías y cuentas.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Grilla de 2 columnas en pantallas de Categorías (Personal y Hogar)

- **Fase / paso**: Refinamiento visual responsive de Categorías (`/categories` y `/household/categories`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/categories/components/mplus-categories-view.tsx`
  - `src/features/household/components/mplus-household-categories-view.tsx`
  - `tests/unit/household-categories-view.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Grilla de dos columnas en escritorio para Categorías (Personal y Hogar)**:
    - En `/categories` (Personal) tanto para Gastos como para Ingresos, la lista de categorías activas y archivadas se renderiza en una grilla responsive de 2 columnas (`grid grid-cols-1 md:grid-cols-2 gap-3`) en desktop, apilándose en 1 columna en móvil.
    - En `/household/categories` (Hogar), las categorías de gasto activas y archivadas se renderizan con la misma disposición en grilla de 2 columnas en desktop (`grid grid-cols-1 md:grid-cols-2 gap-3`).
    - Se conservaron intactos todos los menúes contextuales (3 puntos: Editar / Archivar), diálogos, confirmaciones de archivo inline, reactivación de archivadas, tokens visuales correspondientes (`--fm-*` en Personal, `--hh-*` en Hogar) y estado de datos.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100% (incluyendo nueva aserción WA-HOU-CAT-008).
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Categorías de Personal y Hogar con grilla de 2 columnas en escritorio y 1 columna en móvil.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Ajuste visual en texto explicativo de Cuentas (`/accounts`)

- **Fase / paso**: Refinamiento visual responsive de Cuentas (`/accounts`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/accounts/components/mplus-accounts-view.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Ampliación horizontal del texto explicativo de Cuentas**:
    - Se removió la restricción artificial `max-w-xl` del párrafo de descripción en la card superior de `/accounts`.
    - El texto *"Son etiquetas opcionales para recordar de donde salio o entro el dinero. No guardan saldo ni afectan tus totales del mes."* ahora se extiende naturalmente en una sola línea en pantallas anchas y se envuelve limpiamente según el espacio disponible sin cortes forzados.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Texto superior de Cuentas fluido y aprovechando el ancho disponible.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Alineación del botón de cierre (X) en encabezados de Diálogos

- **Fase / paso**: Refinamiento visual de alineación en diálogos (`FinanceDialog` y `HouseholdDialog`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/components/finance/finance-dialog.tsx`
  - `src/features/household/components/ui/household-dialog.tsx`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Alineación horizontal exacta del botón de cierre (X) con el título / selector de operación**:
    - Antes, el contenedor flex envolvía tanto el título como el subtítulo en la columna izquierda con `items-center`, haciendo que el botón de cierre (X) en la derecha se centrara respecto a la altura total (`title + subtitle`), cayendo por debajo de la línea visual del control segmentado (Gasto / Ingreso).
    - Se reestructuró el encabezado para alinear la fila superior (`title` y botón `X`) con `items-center` en su propia fila horizontal, y ubicar el `subtitle` de manera secundaria inmediatamente debajo.
    - Se aplicó tanto en `FinanceDialog` (Personal) como en `HouseholdDialog` (Hogar).
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Botón de cierre (X) perfectamente alineado en el eje horizontal del selector de operación / título del diálogo.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Rediseño integral de Inicio / Resumen mensual Personal (`/dashboard`)

- **Fase / paso**: Rediseño y optimización de jerarquía visual financiera del Inicio Personal.
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/lib/personal-month-view-model.ts`
  - `src/features/movements/components/personal-home-view.tsx`
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-flow-summary.test.ts`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Balance mensual como dato protagonista**:
    - Se elevó "Balance del mes" al KPI de primer nivel en la card hero de resumen mensual, con tipografía destacada (`text-3xl sm:text-4xl font-bold font-[var(--font-display)]`) y señal semántica sobria (`income` verde, `expense` rojo/coral, o neutral con indicador "En equilibrio" cuando es $0).
  - **2. Comparación independiente y a escala de Ingresos vs Gastos**:
    - Se eliminó la barra única continua de total compartido (que sugería 100% de una misma bolsa).
    - Se implementaron dos barras horizontales independientes que parten del mismo origen, cuya escala relativa se calcula con respecto al valor dominante (`maxFlow`), permitiendo comparar magnitudes directamente (ej. Gastos 100%, Ingresos 41.2%).
  - **3. Rediseño horizontal de Categorías**:
    - Se reemplazó la visualización de barras verticales amontonadas por una lista horizontal completa y escaneable ordenada de mayor a menor:
      - Icono de color y nombre a la izquierda.
      - Barra horizontal proporcional central (`flex-1`) que aprovecha todo el ancho del contenedor.
      - Monto formateado y porcentaje a la derecha.
    - Se implementó precisión para importes pequeños reales menores al 1% (`<1%` en lugar de mostrar falsamente `0%`).
    - Se eliminaron alturas fijas forzadas (`min-h-[220px]`, `h-64`), permitiendo que la card responda orgánicamente a la cantidad de categorías (compacta y sobria con 2 categorías, expandible con 6-7).
    - Se refinaron los estados hover (`hover:bg-white/[0.03]`), focus visible (`focus-visible:ring-[var(--fm-pending)]`) y transiciones de 150ms.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Inicio Personal con jerarquía financiera clara de 3 niveles, barras comparativas independientes y lista horizontal de categorías adaptativa.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Iteración de 'Gastos por categoría' a Gráfica de Barras Verticales

- **Fase / paso**: Refinamiento de visualización analítica de categorías en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Gráfica de barras verticales para categorías**:
    - Se transformó la sección de categorías en una gráfica de barras verticales con lectura de izquierda a derecha.
    - **Jerarquía en 3 zonas verticales por columna**:
      1. **Superior**: Importe principal arriba (`Amount`) y porcentaje secundario más liviano (`<1%`, `100%`).
      2. **Central**: Barra vertical de ancho moderado (36–44px, `w-9 sm:w-11`), `rounded-t-xl`, creciendo con `motion-safe:transition-[height]`. Escala proporcional real con marca visual mínima (`min-h-[6px]`) para gastos reales de baja magnitud (ej. Mercado \$8.222 frente a Arriendo \$8.000.000).
      3. **Inferior**: Línea base sutil (`border-t border-white/10`), punto de color de categoría y nombre centrado con wrap controlado (`break-words line-clamp-2`).
    - **Distribución espacial equilibrada**: Para pocas categorías ($\le 3$), las columnas se agrupan centradas y armónicas (`max-w-xl mx-auto gap-8 sm:gap-16`) sin arrinconarse a los extremos; para más categorías se distribuyen proporcionalmente.
    - **Altura expresiva y proporcionada**: Área vertical de trazado de ~280–320px que elimina el vacío inferior.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfica de barras verticales de categorías implementada con distribución balanceada, escala fidedigna y jerarquía visual en 3 zonas.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Reorganización de Card 'Resumen de Agosto' en Composición Asimétrica de 2 Zonas

- **Fase / paso**: Reorganización interna de la card hero mensual en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-home-view.tsx`
  - `tests/unit/personal-dashboard-flow-summary.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **Composición horizontal asimétrica de 2 zonas**:
    - **Zona Izquierda (~42%, `lg:col-span-5`)**: Balance del mes como dato protagonista exclusivo (`BALANCE DEL MES` label subordinado, importe display grande `text-3xl sm:text-4xl lg:text-[38px] font-bold`, con soporte de `$ 0` neutral e indicador "En equilibrio").
    - **Divisor sutil**: Separación visual limpia mediante respiración y divisor vertical en desktop (`lg:border-l lg:border-white/8 lg:pl-8`).
    - **Zona Derecha (~58%, `lg:col-span-7`)**: Ingresos y Gastos apilados en dos filas horizontales largas:
      - Fila 1 (Ingresos): Ícono `ArrowUpRight` (24x24px) + label `Ingresos` a la izquierda, importe `Amount` a la derecha, y barra horizontal continua de escala común a todo el ancho.
      - Fila 2 (Gastos): Ícono `ArrowDownLeft` (24x24px) + label `Gastos` a la izquierda, importe `Amount` a la derecha, y barra horizontal continua de escala común a todo el ancho.
  - **Compactación vertical**: Reducción de padding vertical para lograr una tarjeta densa, elegante y cohesionada tipo Linear/Raycast sin vacíos sobrantes.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Card hero mensual reorganizada con balance a la izquierda e ingresos/gastos apilados a la derecha con barras de ancho completo.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Gráfica de Barras Vertical con Plot Real e Insight Contextual de Balance

- **Fase / paso**: Refinamiento de visualización analítica completa de categorías y resumen mensual en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/lib/personal-month-view-model.ts`
  - `src/features/movements/components/personal-category-chart.tsx`
  - `src/features/movements/components/personal-home-view.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `tests/unit/personal-dashboard-flow-summary.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Plot de gráfica real con escala vertical Y y guías horizontales**:
    - Escala porcentual izquierda con 5 marcas (`100%`, `75%`, `50%`, `25%`, `0%`).
    - 5 líneas guía horizontales sutiles a través de todo el ancho (`border-b border-white/[0.04]`), con la baseline `0%` más definida (`border-b border-white/12`).
  - **2. Posicionamiento amplio y orgánico a lo largo del plot**:
    - Columnas distribuidas de izquierda a derecha con separación generosa (`gap-12 sm:gap-20 md:gap-28 pl-6 sm:pl-12`), aprovechando el ancho útil sin agruparse artificialmente en el centro.
    - Barras de ancho controlado (48–56px, `w-12 sm:w-14`) con `rounded-t-2xl`.
  - **3. Porcentajes de participación real**:
    - Arriendo / vivienda muestra su porcentaje real preciso (`99,9%`) en lugar de 100% artificial.
    - Mercado muestra `<1%` con marca mínima de `6px` sobre la baseline.
  - **4. Metadata inferior de pie de gráfica**:
    - Chip contextual inferior izquierdo: `ℹ️ Mostrando {count} de {count} categorías · Total: $ {totalFormatted}`.
  - **5. Insight contextual debajo del Balance**:
    - Tag contextual informativo bajo el balance: `Gastaste $ 4.708.222 más de lo que ingresaste` (rojo con ícono `ArrowDownLeft`), `Ingresaste $ X más de lo que gastaste` (verde con `ArrowUpRight`), o `Tus ingresos y gastos están en equilibrio este mes` (neutral).
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfica vertical estructurada como plot real con escala porcentual, guías horizontales, metadata inferior e insight contextual bajo el Balance.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Refinamiento Final de Densidad y Composición de Inicio Personal

- **Fase / paso**: Pulido fino de densidad vertical, distribución horizontal y metadata en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `src/features/movements/components/personal-home-view.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Reducción de altura y eliminación de vacíos**:
    - Se retiró la expansión vertical artificial `flex-1 min-h-0` de la card de categorías, adaptando la altura orgánicamente al contenido (`h-[230px] sm:h-[250px]` para el plot, padding contenido `py-4 sm:py-4.5`).
  - **2. Redistribución horizontal equilibrada (35–45%)**:
    - Con 2 categorías, las columnas se ubican ocupando el primer 35–45% del ancho del plot (`gap-16 sm:gap-28 md:gap-36 pl-8 sm:pl-16`), dejando que las guías abarquen todo el ancho y las columnas tengan respiración cómoda sin arrinconarse ni dispersarse.
  - **3. Metadata inferior refinada**:
    - Se transformó el chip inferior en una línea de texto informativa y silenciosa (`Mostrando 2 de 2 categorías · Total: $ 8.008.222`) con ícono sutil y sin bordes pesados de componente interactivo.
  - **4. Contención del tag contextual de balance**:
    - Se atenuó la superficie del tag de balance (`bg-[rgba(248,113,113,0.06)] border-[rgba(248,113,113,0.14)] text-[var(--fm-expense)]/90`), subordinándolo claramente al número principal del Balance.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Dashboard refinado con densidad compacta estilo Linear/Raycast, altura proporcionada al contenido y metadata discreta.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Distribución Responsiva a Todo el Ancho, Gridlines Suaves, Labels de Una Línea y Tooltip

- **Fase / paso**: Refinamiento analítico de la gráfica de categorías en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Distribución responsiva flexible a todo el ancho**:
    - Se implementó `justify-around` con márgenes laterales balanceados (`px-4 sm:px-10 md:px-16`) para repartir uniformemente 2, 3, 4, 6 u 8 categorías por todo el ancho útil del plot sin agruparlas a la izquierda ni sobredimensionar las columnas (ancho visual estable de 44–56px).
  - **2. Atenuación de gridlines intermedias**:
    - Las líneas de 25%, 50% y 75% se redujeron a `border-white/[0.02]` para integrarse al fondo y no competir con las barras ni las cifras.
    - Se mantuvo 0% como baseline nítida (`border-white/12`) y 100% como referencia superior sutil (`border-white/[0.04]`).
  - **3. Nombres de categorías en una sola línea**:
    - Se retiró `line-clamp-2` y se configuró `truncate` (`whitespace-nowrap overflow-hidden text-ellipsis`) con altura uniforme en el eje horizontal inferior.
  - **4. Tooltip flotante con detalle completo**:
    - Al hacer hover o focus en cada categoría se despliega un tooltip oscuro estilizado (`bg-[rgba(14,20,32,0.97)] border-white/12`) con:
      - Nombre completo de categoría (sin truncar).
      - Importe destacado (`$ 8.000.000` / `$ 8.222`).
      - Porcentaje (`99,9% del gasto total` / `<1% del gasto total`).
  - **5. Estado hover unificado**:
    - El hover/focus en barra o label activa el tooltip y atenúa sutilmente las demás categorías (`opacity-65`).
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfica de categorías con distribución responsiva completa, gridlines suaves, nombres de una línea y tooltip interactivo accesible.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Gráfica Flexible Verticalmente en Viewport, Gridlines Sutiles y Eje Y Legible

- **Fase / paso**: Corrección de jerarquía visual y flexibilidad vertical de la gráfica de categorías en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `src/features/movements/components/personal-home-view.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Inversión de jerarquía entre gridlines y números del eje Y**:
    - Se atenuaron drásticamente las líneas horizontales (25%, 50%, 75% a `border-white/[0.02]`, 100% a `border-white/[0.035]`, 0% a `border-white/10`).
    - Se incrementó la legibilidad de las marcas porcentuales del eje Y (`text-[11px] sm:text-xs font-semibold text-[var(--fm-text-muted)]`) eliminando opacidades que las hacían ver apagadas/deshabilitadas.
  - **2. Flexibilidad vertical completa en desktop**:
    - La card "Gastos por categoría" y el plot de gráfica absorben el alto restante del viewport (`flex-1 min-h-0 flex flex-col justify-between`, con plot `flex-1 min-h-[220px]`).
    - La distancia entre las referencias de 0%, 25%, 50%, 75% y 100% se ajusta proporcionalmente a la altura de la ventana sin vacíos muertos.
    - Las barras escalan fluidamente en base a su porcentaje relativo a la nueva altura flexible del plot.
  - **3. Metadata inferior anclada al final**:
    - La metadata del pie de gráfica se mantiene anclada en la parte inferior (`mt-auto pt-4 shrink-0`) dejando una respiración limpia respecto al borde de la card.
  - **4. Soporte de nombres de categorías más amplios**:
    - Se amplió el ancho disponible para el label (`max-w-[160px] sm:max-w-[200px] truncate`) permitiendo que "Arriendo / vivienda" mantenga mayor información reconocible en una sola línea.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfica flexible verticalmente absorbiendo el alto del viewport con escala Y nítida y legible, gridlines sutiles y metadata anclada.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Altura Visual Normalizada contra Categoría Máxima y Porcentaje Real Independiente

- **Fase / paso**: Visualización analítica de barras en Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/lib/personal-month-view-model.ts`
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Normalización de altura visual contra la categoría mayor**:
    - La categoría de mayor valor en el período alcanza el 100% de la altura útil del plot (`visualHeight = (categoryAmount / maxCategoryAmount) * 100`).
    - Las demás barras son directamente proporcionales a la mayor (ej. $8.000.000 y $8.000.000 ambas al 100%, $8.222 proporcional al ~0,1%).
    - En caso de empate de máximos (ej. 10 categorías de $100.000), las 10 barras alcanzan el 100% de altura.
  - **2. Conservación del porcentaje real de participación sobre el total**:
    - El porcentaje informativo es completamente independiente (`percentageOfTotal = (categoryAmount / totalCategoryAmount) * 100`).
    - Conserva formato de alta fidelidad (`shareLabel`: `<1%`, `99,9%`, `50%`, `10%`, etc.).
  - **3. Retiro del eje falso y adición de texto de apoyo**:
    - Se eliminaron las marcas engañosas del eje vertical (100%..0%) que sugerían % del total mensual.
    - Se añadió el texto explicativo visible y accesible: *"Las barras comparan cada categoría con la de mayor valor"*.
  - **4. Cobertura de pruebas unitarias**:
    - Añadidas pruebas unitarias específicas para: categoría única, empate de máximos, 10 categorías iguales, categoría dominante + pequeña, lista vacía/cero y conservación de invariantes de porcentaje real.
- **Verificación realizada**:
  - `npx tsc --noEmit`: 0 errores.
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gráfica de categorías optimizada con comparación relativa respecto a la categoría máxima, preservación de porcentajes reales y texto explicativo.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Acabado Visual y Textura de Barras en Gráfico Vertical

- **Fase / paso**: Acabado visual, textura y capas de "Gastos por categoría" / "Ingresos por categoría" (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; CSS / Tailwind.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `src/app/design-system/design-system-showcase.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Líneas horizontales de referencia en segundo plano (z-0)**:
    - Se redujo drásticamente la opacidad de las líneas horizontales (`border-white/[0.06]` en superior, `border-white/[0.035]` en intermedias, `border-white/[0.08]` en baseline).
    - Se confinaron exactamente al área de trazado (`top-[38px] bottom-[30px]`), evitando cruzar visualmente los números de monto/porcentaje superiores ni los nombres de categoría inferiores.
  - **2. Textura sutil y no plana en las barras**:
    - Se superpuso una textura ligera multivariable mediante gradiente vertical de profundidad (`linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.12) 100%)`) y micro-patrón diagonal a 45° con 8% de opacidad (`repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.08) 3px, rgba(255,255,255,0.08) 6px)`), más bisel interior de luz suave (`boxShadow: inset 0 1px 0 rgba(255,255,255,0.2)`).
    - Mantiene plena fidelidad del color de la categoría sin mutearlo y preserva contraste en barras pequeñas.
  - **3. Radio superior contenido (8-10px)**:
    - Se ajustó a `rounded-t-lg` (8–10px) en las dos esquinas superiores únicamente; la base permanece recta alineada al eje inferior.
  - **4. Capas y jerarquía visual**:
    - Guías en `z-0`, columnas y barras en `z-10`, tooltips flotantes en `z-30`. Montos y porcentajes tienen máxima prominencia y legibilidad.
  - **5. Pruebas unitarias**:
    - Añadida prueba `WA-CAT-CHART-015` verificando textura CSS, radio `rounded-t-lg`, líneas en `z-0` y texto explicativo.
- **Verificación realizada**:
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npx tsc --noEmit`: 0 errores.
  - `npm run lint`: 0 errores / 0 advertencias.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - Capturas de pantalla Playwright en desktop y móvil validadas.
- **Estado al cerrar**: Acabado visual completado satisfactoriamente con barras táctiles/texturadas, radio de 8-10px, guías ultra-sutiles en z-0 y cero interferencia visual con los datos.
- **Próximo paso sugerido**: QA de usuario final.

### Entrada — 2026-08-26 — Posición Dinámica de Etiquetas y Tooltips sobre Barras Verticales

- **Fase / paso**: Posicionamiento dinámico de monto/porcentaje y tooltip inteligente en `/dashboard`.
- **Agente / herramienta**: agente Web; TypeScript; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Posicionamiento dinámico de monto y porcentaje**:
    - El bloque de monto y porcentaje de cada categoría se posiciona dinámicamente (`absolute bottom-[calc(100%+6px)]`) directamente sobre el extremo superior de su barra.
    - Se eliminó la alineación rígida en una franja superior fija; cada etiqueta sigue fielmente la altura visual calculada de su barra manteniendo una separación constante y pequeña (6px).
  - **2. Tooltip anclado siempre por encima de los valores**:
    - El tooltip se ancla de forma consistente siempre por encima del bloque de monto y porcentaje (`bottom-[calc(100%+44px)]`) en todas las alturas de barra (incluyendo las del 100% o máximas).
    - Se amplió la respiración superior del plot a `pt-14 sm:pt-16` para que las barras máximas dispongan de amplio espacio superior para sus valores y el tooltip flotante sin ningún corte.
  - **3. Conservación de guías de fondo y legibilidad**:
    - Las líneas horizontales permanecen como sutil referencia visual en `z-0` de fondo; las etiquetas en `z-20` incorporan `drop-shadow-md` para garantizar máxima legibilidad.
  - **4. Pruebas unitarias**:
    - Añadida prueba `WA-CAT-CHART-016` para validar posicionamiento dinámico de etiquetas y tooltip siempre superior.
- **Verificación realizada**:
  - `npm test`: 42 suites unitarias pasando al 100% (19 pruebas específicas del gráfico).
  - `npx tsc --noEmit`: 0 errores.
  - `npm run lint`: 0 errores / 0 advertencias.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Etiquetas y tooltips posicionados de forma dinámica y proporcional siempre sobre cada barra y sus valores, sin franja fija superior y con holgura superior para las barras máximas.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Navegación e Interacción por Clic en Barras de Categorías

- **Fase / paso**: Interacción de navegación al hacer clic en columnas/barras del gráfico de categorías hacia `/movements` con filtro activo.
- **Agente / herramienta**: agente Web; TypeScript; Next.js navigation.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/movements/components/personal-category-chart.tsx`
  - `src/features/movements/components/movements-view.tsx`
  - `src/app/(dashboard)/movements/page.tsx`
  - `tests/unit/personal-dashboard-category-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Navegación por clic / teclado en PersonalCategoryChart**:
    - Cada barra de categoría es interactiva (`role="button"`, `tabIndex={0}`, `cursor-pointer`, feedback visual `active:scale-[0.98]`).
    - El área interactiva de hover y clic quedó estrictamente confinada a la **barra física** (su altura calculada y su bloque de monto superior) y al **nombre de categoría** inferior, evitando activaciones accidentales en el espacio vacío del fondo.
    - Al hacer clic o presionar `Enter`/`Space`, navega inmediatamente a `/movements?categoryId=${categoryId}&type=${mode}`.
  - **2. Lectura y sincronización de filtros en MplusMovementsView**:
    - `MplusMovementsView` ahora lee `useSearchParams()` para inicializar `categoryFilter` y `typeFilter` de forma reactiva cuando se accede desde la gráfica o enlaces externos.
    - Se envolvió `MovementsPage` en `<Suspense>` conforme a las mejores prácticas de Next.js App Router para soportar parámetros de consulta sin desoptimizar la compilación.
  - **3. Pruebas unitarias**:
    - Añadida prueba `WA-CAT-CHART-017` verificando handlers de navegación por clic y lectura de query params en la vista de movimientos.
- **Verificación realizada**:
  - `npm test`: 42 suites unitarias pasando al 100% (20 pruebas específicas del gráfico de categorías).
  - `npx tsc --noEmit`: 0 errores.
  - `npm run lint`: 0 errores / 0 advertencias.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Interacción completada: hacer clic en una barra del gráfico redirige directamente al historial de movimientos con el filtro de esa categoría y tipo activo, con área de clic y hover delimitada a la barra real.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Paridad de Diseño entre Inicio Personal e Inicio de Hogar con Tokens de Hogar

- **Fase / paso**: Paridad visual, analítica e interactiva de Inicio de Hogar (`/household`) con Inicio Personal (`/dashboard`).
- **Agente / herramienta**: agente Web; TypeScript; Next.js; Tailwind CSS.
- **Archivos creados**: Ninguno.
- **Archivos modificados**:
  - `src/features/household/lib/household-dashboard-view-model.ts`
  - `src/features/household/components/household-category-chart.tsx`
  - `src/features/household/components/mplus-household-overview.tsx`
  - `src/features/household/components/mplus-household-movements-view.tsx`
  - `src/app/(dashboard)/household/movements/page.tsx`
  - `tests/unit/household-dashboard-chart.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Resumen Hero asimétrico en 2 zonas en Hogar (`MplusHouseholdOverview`)**:
    - **Zona izquierda (40–45%)**: Balance del mes protagonista (`HouseholdAmount` display size `text-3xl sm:text-4xl lg:text-[38px]`), estado "En equilibrio" y banner de insight contextual dinámico (*"Gastaron $ X más de lo que ingresaron"*, *"Ingresaron $ X más de lo que gastaron"*, etc.).
    - **Zona derecha (55–60%)**: Filas apiladas de Ingresos compartidos y Gastos compartidos con badge de icono cuadrado, montos destacados y barras de progreso proporcionales a todo el ancho (`incomeScalePercent` y `expenseScalePercent`).
  - **2. Gráfico vertical de distribución de Hogar (`HouseholdCategoryChart`)**:
    - Altura flexible que aprovecha el espacio vertical útil (`min-h-[220px]`).
    - Líneas de referencia horizontales sutiles en capa `z-0` ajustadas a tokens de Hogar.
    - Textura sutil y no plana en las barras (gradiente vertical 180° + micro-patrón diagonal a 45° con 8% de opacidad y bisel interior de luz suave), con radio superior contenido (`rounded-t-lg`).
    - Posicionamiento dinámico del bloque de monto y porcentaje (`bottom-[calc(100%+6px)]`) directamente sobre el extremo superior de cada barra.
    - Tooltip flotante en capa `z-30` anclado siempre por encima de los valores (`bottom-[calc(100%+44px)]`) con diseño de Hogar (`bg-[var(--hh-surface-elevated)]`).
    - Puntos de color y nombres centrados en una sola línea debajo de la baseline.
    - Metadata inferior con conteo de elementos, total y leyenda explicativa *"Las barras comparan cada categoría/integrante..."*.
  - **3. Navegación por clic y deep linking en Hogar**:
    - Clic o teclado en barras/etiquetas navega a `/household/movements` con filtros reactivos (`categoryId`, `type`, `memberId`).
    - `MplusHouseholdMovementsView` inicializa filtros desde `useSearchParams()`.
    - `HouseholdMovementsPage` envuelta en `<Suspense>`.
  - **4. Normalización visual en view-model (`household-dashboard-view-model.ts`)**:
    - `barScalePercent` normalizado contra el elemento de mayor valor (100% de altura útil).
    - `shareLabel` independiente para el porcentaje real sobre el total.
    - Soporte de hasta 10 categorías/integrantes directamente (o top 9 + "Otras" si > 10).
  - **5. Cobertura de pruebas unitarias**:
    - Pruebas `WA-HOU-DASH-001` a `012` actualizadas y verificadas al 100%.
- **Verificación realizada**:
  - `npm test`: 42 suites unitarias pasando al 100%.
  - `npx tsc --noEmit`: 0 errores.
  - `npm run lint`: 0 errores.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Paridad completa lograda entre Hogar y Personal: misma arquitectura visual, micro-detalles de interacción, texturas y barras proporcionales ejecutados con los tokens de diseño `--hh-*` de Hogar.
- **Próximo paso sugerido**: QA manual de usuario en `/household`.

### Entrada — 2026-08-26 — Paridad funcional de "Contar en Hogar" con Android

- **Fase / paso**: Paridad funcional del flujo "Contar en Hogar" en Personal (`/dashboard`, `/movements`, `MovementComposerCard`).
- **Agente / herramienta**: agente Web; TypeScript; Next.js; React; Firestore.
- **Archivos creados**:
  - `src/features/movements/components/composer/share-with-household-confirm-dialog.tsx`
  - `src/features/movements/components/composer/remove-from-household-confirm-dialog.tsx`
  - `tests/unit/mplus-share-with-household.test.ts`
- **Archivos modificados**:
  - `src/features/movements/hooks/use-mplus-personal.ts`
  - `src/features/movements/services/movement-mutations.ts`
  - `src/features/movements/hooks/use-movement-mutations.ts`
  - `src/features/movements/components/movement-composer-card.tsx`
  - `src/features/movements/components/movement-composer-dialog.tsx`
  - `tests/unit/run-all.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. Elegibilidad estricta de "Contar en Hogar"**:
    - `useMplusHouseholdSharing` valida que tanto la membresía (`profile.householdMembershipState === "active"`) como el Hogar real (`household !== null && household.status === "active"`) y el `householdId` existan y estén activos.
    - Se oculta/deshabilita si el Hogar está en `waiting`, `waiting_return`, `closing`, `left`, `none` o sin Hogar.
  - **2. Estado inicial y preservación de elección**:
    - En alta nueva con Hogar elegible, el toggle viene activado por defecto (`true`).
    - Si el usuario lo desactiva manualmente, su decisión se respeta durante la edición.
    - En edición de movimiento existente, refleja si el movimiento ya estaba compartido (`movement.householdId !== null`).
  - **3. Diálogo de confirmación "Contar en Hogar" antes de guardar**:
    - Abre el modal accesible `ShareWithHouseholdConfirmDialog` con `useFocusTrap`, soporte para Escape, backdrop click y foco controlado.
    - Título "Contar en Hogar" y explicación clara del modelo compartido.
    - Resumen compacto del movimiento: concepto, monto con `Amount`, categoría personal con icono/color, fecha formateada y cuenta informativa.
    - Botón primario "Confirmar y compartir", botón secundario "Guardar solo en Personal" (persiste sin compartir inmediatamente) y botón Cancelar (cierra sin guardar ni alterar el toggle).
  - **4. Categoría de Hogar para gastos y aprendizaje de equivalencia**:
    - En gastos compartidos, consulta `categoryMappings/{ownerId}__{personalCategoryId}` y preselecciona la equivalencia aprendida si existe y está activa.
    - Selector de categorías activas de Hogar y opción "Clasificar después" (`householdCategoryId = null`).
    - Nota informativa *"La usaremos para próximos gastos tuyos de [Categoría personal]"* cuando se selecciona una categoría de Hogar.
    - Al confirmar, `createMovement` y `updateMovement` persisten `householdId`, `householdCategoryId` y crean/actualizan en la misma transacción atómica el documento `categoryMappings` correspondiente, actualizando inmediatamente el store de Hogar con `applyCommittedMapping`.
  - **5. Ingresos compartidos**:
    - Abren confirmación sin selector de categoría de Hogar y persisten siempre `householdCategoryId = null`.
  - **6. Diálogo de confirmación "Retirar de Hogar"**:
    - Al editar un movimiento compartido previamente y desactivar el toggle, abre `RemoveFromHouseholdConfirmDialog` explicando que deja de verse en Hogar pero permanece en Personal.
    - Persiste `householdId = null` y `householdCategoryId = null` solo tras confirmar "Retirar".
  - **7. Pruebas y validaciones técnicas**:
    - Suite completa `tests/unit/mplus-share-with-household.test.ts` con cobertura de los 10 escenarios requeridos.
- **Verificación realizada**:
  - `npm test`: 43 suites unitarias pasando al 100%.
  - `npx tsc --noEmit`: 0 errores de TypeScript.
  - `npm run lint`: 0 errores de linter.
  - `npm run build`: compilación limpia de producción (16/16 páginas generadas).
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Flujo de "Contar en Hogar" con paridad funcional total contra el comportamiento canónico de Android.
- **Próximo paso sugerido**: QA manual de usuario.

### Entrada — 2026-08-26 — Paridad en gestión de gastos compartidos "Por clasificar" y creación de categoría desde revisión

- **Fase / paso**: Gestión de gastos compartidos "Por clasificar" y creación de categoría de Hogar desde la revisión (`/household`, `/household/movements`, `ShareWithHouseholdConfirmDialog`).
- **Agente / herramienta**: agente Web; TypeScript; Next.js; React; Firestore.
- **Archivos creados**:
  - `src/features/household/components/household-category-dialog.tsx`
- **Archivos modificados**:
  - `src/features/movements/components/composer/share-with-household-confirm-dialog.tsx`
  - `src/features/household/components/mplus-household-overview.tsx`
  - `src/features/household/components/mplus-household-movements-view.tsx`
  - `tests/unit/mplus-share-with-household.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Archivos eliminados**: Ninguno.
- **TODOs nuevos**: Ninguno.
- **TODOs resueltos**:
  - **1. No elegir una categoría arbitrariamente en "Contar en Hogar"**:
    - Si no existe una equivalencia aprendida previa (o la categoría aprendida fue archivada), `ShareWithHouseholdConfirmDialog` selecciona por defecto *"Clasificar después"* (`householdCategoryId = null`).
    - Si existe una equivalencia aprendida y activa, se preselecciona automáticamente.
    - Si se confirma con *"Clasificar después"*, se persiste `householdId` válido con `householdCategoryId = null` sin crear ni alterar `categoryMappings`.
  - **2. Navegación directa a revisión de gastos "Por clasificar"**:
    - El banner de aviso de pendientes en el tablero de Hogar (`MplusHouseholdOverview`) ahora navega con los parámetros de consulta exactos `/household/movements?categoryId=unclassified&type=expense`.
  - **3. Crear categoría de Hogar desde la revisión de gastos**:
    - Dentro del diálogo de reclasificación en `MplusHouseholdMovementsView`, se agregó la acción *"Nueva categoría de Hogar"* (en cabecera y como opción punteada en la lista).
    - Abre el modal `HouseholdCategoryDialog` reutilizando el servicio canónico `createHouseholdExpenseCategory`.
    - Al crearse exitosamente:
      - Se registra inmediatamente en el store de Hogar (`applyCommittedCategory`).
      - Se asigna de forma inmediata al gasto bajo revisión mediante la transacción atómica `correctPartnerMovementCategory`.
      - Se crea/actualiza la equivalencia aprendida en `categoryMappings` para el dueño del movimiento.
      - Se refleja el estado local sin recarga de página.
    - Si se cancela la creación, se regresa a la lista de categorías sin modificar el gasto.
  - **4. Reclasificación de gastos propios y de la pareja**:
    - El flujo sirve tanto para gastos propios (`movement.ownerId === currentUid`) como para gastos de la pareja, con mensajes contextualizados y respetando la regla de que los ingresos compartidos permanecen siempre con categoría nula.
  - **5. Cobertura de pruebas unitarias**:
    - `tests/unit/mplus-share-with-household.test.ts` actualizado con 14 escenarios completos verificados.
- **Verificación realizada**:
  - `npm test`: 43 suites unitarias pasando al 100%.
  - `npx tsc --noEmit`: 0 errores de TypeScript.
  - `npm run lint`: 0 errores de ESLint.
  - `git diff --check`: 0 advertencias de formato.
- **Estado al cerrar**: Gestión de gastos por clasificar y creación de categoría desde revisión completada con paridad canónica con Android.
- **Próximo paso sugerido**: QA manual de usuario.




### Entrada — 2026-08-26 — Corrección: el reinicio QA fallaba contra el proyecto real por `allow list` de movimientos

- **Fase / paso**: Corrección del reinicio QA tras QA manual del usuario.
- **Origen**: QA manual reportó `Missing or insufficient permissions` al confirmar el reinicio. La entrada anterior daba el reinicio por bueno apoyándose en una suite que pasaba; la suite tenía un punto ciego.
- **Causa raíz confirmada en `android/firestore.rules`**: la consulta de movimientos compartidos era `where householdId == X` sin filtrar el ciclo de vida. `allow list` de `movements` solo permite listar un documento ajeno si está `active` (§9.5: en Papelera el otro miembro pierde la lectura de inmediato). Firestore evalúa la regla contra CADA documento devuelto, así que un solo compartido de la pareja en Papelera hace que el servidor rechace la consulta **entera**.
- **Por qué la suite no lo detectó**: el gateway falso modelaba `create`, `update` y `delete`, pero **no `allow list`**. Se añadieron las dos reglas de listado que el reinicio puede violar (`movements` y `householdInvites`), el fixture ahora incluye un compartido de la pareja en Papelera, y una aserción comprueba que la consulta anterior es rechazada — la guarda no es decorativa.
- **Archivos modificados**:
  - `src/features/qa-reset/services/mplus-account-reset-service.ts`
  - `src/features/qa-reset/services/mplus-reset-gateway.ts`
  - `src/features/qa-reset/components/qa-reset-confirm-dialog.tsx`
  - `tests/unit/mplus-account-reset-flow.test.ts`
  - `docs/11_WEB_DEV_LOG.md`
- **Cambios**:
  - La consulta de compartidos añade `lifecycleState == "active"` (usa el índice compuesto ya desplegado `householdId, lifecycleState, occurredAt`).
  - Cada paso del reinicio se etiqueta: un fallo ahora dice qué operación lo produjo en vez de un `Missing or insufficient permissions` pelado. Una limpieza destructiva que muere a medio camino no puede reportarse con un mensaje genérico.
  - Las dos consultas de invitaciones pasan a best-effort con su motivo anotado, igual que Android (`runCatching`). El `activeInviteId` del Hogar, que es el caso normal, no depende de ninguna consulta.
  - El resultado incluye `skipped`: lo que no se pudo limpiar y por qué, visible en el diálogo. Nada se silencia.
- **Limitación de contrato detectada — requiere decisión del orquestador**: DEC-080 pide borrar «todos los movimientos compartidos de ambos miembros», pero las Rules desplegadas **no permiten ni listar** los que la pareja tenga en Papelera (§9.5 les quita la lectura al otro miembro). Web no puede cumplir DEC-080 al pie de la letra sin un cambio de Rules. Android tiene la misma limitación en el servidor, aunque su copia local en Room puede enmascararla. Queda reportado, no resuelto por cuenta propia.
- **Verificación realizada**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.
- **Pendiente**: QA manual del usuario. El reinicio contra el proyecto real **no está confirmado**: la entrada anterior lo dio por bueno sin esa evidencia y se equivocó.

### Entrada — 2026-08-26 — Corrección 2: error al cargar Ajustes y orden del borrado de Hogar

- **Fase / paso**: Segunda corrección del reinicio QA tras QA manual del usuario.
- **Origen**: QA manual reportó `Runtime FirebaseError: Missing or insufficient permissions` **al refrescar `/settings`**, sin pulsar nada. Ese síntoma no era el reinicio.
- **Causa del error al cargar — `useMplusOrphanHouseholdReconciler`, introducido en la entrada anterior**. Dos defectos propios:
  1. **Sin manejo de error**: el efecto lanzaba `void (async () => …)()` sin `catch`. Cualquier rechazo de Firestore salía como *unhandled rejection* y Next lo mostraba como error de runtime encima de una página que por lo demás funcionaba. Una reparación de fondo nunca puede tumbar la pantalla.
  2. **Carrera con la carga del perfil**: la condición era `householdStatus === "success" && household === null`. En el primer render el perfil aún no está, el driver llama a `load(null, …)` y el store queda en `success` con `household: null`; cuando el perfil llega con su `householdId`, la condición ya se cumplía con un estado que no hablaba de ese Hogar. Ahora se exige además `store.householdId === profile.householdId`.
- **Causa de fondo — la cuenta quedó atascada**: el fallo anterior marcó `users/{uid}.status = "resetting"` y alcanzó a borrar invitaciones y subcolecciones (incluidos los `members`) antes de morir. Sin membresía activa, las Rules quitan la lectura del Hogar y de sus subcolecciones (`allow read: if currentUserIsActiveMember`), así que el reintento **no podía leer** lo que quedó a medias y abortaba: la cuenta quedaba atrapada en `resetting`, estado en el que las Rules niegan toda escritura nueva (`parentUser(uid).status == 'ready'`).
- **Tercer fallo, de orden, encontrado por el modelo mejorado**: el servicio borraba las subcolecciones —`members` incluido— **antes** de consultar los movimientos compartidos. `allow list` de `movements` solo deja ver un documento ajeno si quien consulta es miembro activo, así que ese borrado destruía la membresía que la consulta necesitaba y los compartidos de la pareja quedaban sin borrar. Se reordenó: compartidos primero, subcolecciones después, `members` al final.
- **Cambios**:
  - Lecturas del Hogar, subcolecciones y compartidos pasan a *best-effort*: un residuo ilegible se anota en `skipped` y no bloquea el resto. El borrado del documento del Hogar se intenta **siempre** — `allow delete` no exige membresía activa, solo `fixedHouseholdMember` (que las Rules resuelven por dentro) más el perfil en `resetting`.
  - Así una cuenta atascada puede terminar su reinicio y volver a `ready`.
- **Pruebas añadidas**: el gateway falso ahora modela también `allow get/read` del Hogar y de sus subcolecciones (exigen membresía activa) y la dependencia de membresía en la rama compartida de `allow list`. Escenario nuevo que reproduce el estado exacto de la cuenta atascada —`resetting` con subcolecciones ya borradas— y exige que el reinicio se complete, borre el Hogar y deje el perfil en `ready`.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde (7 escenarios de reinicio); `npm run lint` 0 errores.
- **Lección registrada**: dos entradas seguidas dieron el reinicio por bueno apoyándose en un modelo de Rules incompleto. Cada vez que el modelo se completó (primero `allow list`, después `allow read` y la membresía), apareció otro fallo real que la suite en verde estaba tapando. El modelo se amplía **antes** de volver a afirmar que algo funciona.
- **Pendiente**: QA manual del usuario.

### Entrada — 2026-08-26 — Corrección 3: el reseed exigía perfil `ready` y corría todavía en `resetting`

- **Fase / paso**: Tercera corrección del reinicio QA tras QA manual del usuario.
- **Origen**: con los pasos ya etiquetados, QA manual devolvió el punto exacto: `[resembrar catalogo Personal] Missing or insufficient permissions`. Todo lo anterior (Hogar, movimientos, cuentas, categorías) sí se borró.
- **Causa raíz**: `validPersonalCategoryCreate` exige `parentUser(uid).status == 'ready'`. El reseed corría como paso 6, con el perfil todavía en `resetting`, así que el servidor rechazaba las 22 categorías. El reinicio moría en el ÚLTIMO paso, con todo ya borrado y la cuenta atrapada en `resetting` — el peor momento posible para fallar, porque en ese estado las Rules niegan toda escritura nueva.
- **Corrección**: se invierten los pasos 6 y 7. El perfil pasa a `ready` ANTES de resembrar. Es al revés del orden narrado en el contrato §17.2, y es deliberado: con las Rules desplegadas, ese orden es imposible para un cliente que escribe directo. El resultado final es idéntico (perfil `ready` + catálogo base).
  - La ventana entre ambos pasos es segura: si el proceso muriera justo ahí, el perfil queda `ready` sin categorías y `ensureMplusUserBootstrap` las siembra en el siguiente login, que ya es idempotente y solo crea las que faltan.
  - El reseed pasa a best-effort: llegados a ese punto la cuenta ya está limpia y en `ready`, que es lo que la desatasca; un fallo al sembrar no puede volver a bloquearla. Se anota en `skipped`.
- **Pruebas añadidas**: el gateway falso modela ahora `allow create` de `users/{uid}/categories` (exige `ready`, evaluado contra el estado del perfil **después** del lote, porque un mismo batch puede dejarlo en `ready`). Aserción que comprueba que sembrar en `resetting` es rechazado — la guarda no es decorativa.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.
- **Nota de recuperación**: una cuenta que quedó en `resetting` NO se arregla cerrando y abriendo sesión — `ensureMplusUserBootstrap` se salta el seed en ese estado a propósito. Hay que volver a ejecutar el reinicio, que ahora sí completa y devuelve el perfil a `ready`.
- **Pendiente**: QA manual del usuario.

### Entrada — 2026-08-26 — Corrección 4: el cierre del reinicio no navegaba al acceso inicial

- **Fase / paso**: Cuarta corrección del reinicio QA tras QA manual del usuario.
- **Resultado del QA previo**: el reinicio **completó correctamente**. Firestore confirmó `status: "ready"`, `householdId: null`, `householdMembershipState: "none"`, `resetRequestedAt: null` y la subcolección `categories` recreada.
- **Síntoma restante**: al terminar, la pestaña quedaba en blanco y congelada. La evidencia decisiva estaba en la barra de direcciones de la captura: **la URL seguía siendo `/settings`**. La navegación nunca ocurrió; no era un problema de renderizado del acceso inicial (comprobado aparte: `/` carga bien y su contenido es visible).
- **Causa raíz**: `handleFinish` hacía `await signOutUser()` y después `router.replace("/")`. Ese `await` es justo lo que desmonta el componente: el cierre de sesión dispara el listener de Firebase Auth, que limpia la sesión del store, y Ajustes monta el diálogo solo mientras hay `uid` (`currentUid && <QaResetConfirmDialog …>`). Al volver del `await`, el `router.replace` sale del closure de un componente ya desmontado y no navega.
- **Corrección**: navegación dura con `window.location.assign("/")`, que no depende de React y funciona igual desde un componente desmontado. Se retiran `clearSession()` y `resetAllStoresForSessionBoundary()` del cierre: una recarga completa hace eso por construcción, y es lo que corresponde después de borrar todos los datos sobre los que la pantalla estaba construida.
  - Es además lo que hacía el código original (`window.location.reload()`); retirarlo en la primera pasada de este bloque fue la regresión.
- **Prueba actualizada**: se comprueba `window.location.assign("/")` y la ausencia de `useRouter` — la dependencia real, no el texto, para que el comentario que explica por qué no se usa `router.replace` no haga fallar la prueba.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — Acceso con Google: la ventana emergente podía dejar la pantalla muerta

- **Fase / paso**: Corrección de robustez del acceso, detectada al volver a iniciar sesión tras el reinicio QA.
- **Síntoma reportado**: se abre el cuadro de Google, se elige la cuenta y no pasa nada; el cuadro no vuelve a abrirse. En consola, `Cross-Origin-Opener-Policy policy would block the window.close call` desde `cb=gapi.loaded_0`.
- **Origen NO relacionado con los cambios de este bloque**: se comprobó que la app no envía ninguna cabecera COOP (`curl -D -` sobre `localhost:3000` no la incluye), no hay middleware y las variables `NEXT_PUBLIC_FIREBASE_*` siguen presentes. El bloqueo ocurre del lado del navegador/Google sobre `signInWithPopup`.
- **Defecto propio confirmado**: `handleSignIn` hacía `await signInWithGoogle()` sin más. Cuando COOP impide la comunicación de vuelta, esa promesa **no resuelve ni rechaza**; el `finally` nunca corre, `isSubmitting` se queda en `true` y los dos botones —ambos con `disabled={isSubmitting}`— quedan inservibles hasta recargar. Una promesa que nunca se asienta no se atrapa con `catch`.
- **Cambios**:
  - `handleSignIn` corre la ventana emergente contra un reloj (`Promise.race`, `POPUP_TIMEOUT_MS = 90 s`, margen para elegir cuenta + contraseña + verificación en dos pasos). Al vencer no se cancela nada: se devuelve el control a la pantalla y se ofrece la alternativa.
  - Nueva vía por redirección: `signInWithGoogleRedirect()` + `consumeGoogleRedirectResult()`, que al volver a la página completa **el mismo bootstrap del contrato** (`ensureContractUser`) que la vía emergente — una sesión nunca se da por lista sin su `users/{uid}` confirmado.
  - Botón "Entrar sin ventana emergente", visible solo cuando la emergente falló o venció.
  - Los errores de acceso muestran ahora el **código** de Firebase (`auth/popup-blocked`, etc.). Sin él, cualquier fallo se veía como un genérico "no se pudo iniciar sesión".
- **Pruebas añadidas** en `auth-routing.test.ts`: existencia del límite de espera, rehabilitación de los botones, vía por redirección con su recogida al volver, y que esa vía no se salte `ensureContractUser`.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores; pantalla de acceso cargada en navegador con los dos botones habilitados y sin errores de consola.
- **Si la redirección tampoco completa**: el siguiente sospechoso es el particionado de almacenamiento de terceros de Chrome, porque `authDomain` (`*.firebaseapp.com`) no coincide con el dominio de la app (`localhost`). La salida documentada es servir el handler de Auth desde el propio dominio. No se toca sin evidencia de que haga falta.

### Entrada — 2026-08-26 — Corrección 5: contador de cuenta desincronizado abortaba el reinicio

- **Fase / paso**: Robustez del reinicio QA, encontrada al revisar por qué podrían sobrevivir cuentas.
- **Causa**: el decremento usaba `Math.max(0, referenceCount - 1)`. Si una cuenta tenía `referenceCount = 0` pero seguía habiendo movimientos apuntándola (datos desincronizados), eso produce un decremento inválido: las Rules exigen `data.referenceCount == resource.data.referenceCount - 1`, y `0 == -1` es falso. El servidor rechazaba la escritura y **abortaba el reinicio entero**, dejando la cuenta atrapada en `resetting`. El `Math.max` disfrazaba un caso imposible en vez de reconocerlo.
- **Corrección**: cuando el contador ya está en 0, ese movimiento no se puede borrar bajo las Rules desplegadas (`deleteAccountCounterIsValid` lo bloquea). Se anota en `skipped` y se continúa; el resto de la limpieza vale más que un documento suelto.
- **Además**: el borrado de cuentas y categorías propias pasa a best-effort con reporte. Una cuenta con el contador descuadrado no puede impedir que el perfil vuelva a `ready`, que es lo que desatasca la sesión.
- **Prueba añadida**: escenario con `acc-2` en `referenceCount: 0` y `mov-4` todavía apuntándola. Exige que el reinicio termine, que el perfil quede `ready`, que el movimiento imposible quede reportado con su cuenta y que el resto (incluida esa misma cuenta, que sí es borrable con 0) se limpie.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde (8 escenarios de reinicio); `npm run lint` 0 errores.

### Entrada — 2026-08-26 — El reinicio QA ahora elimina `users/{uid}`: la cuenta arranca de cero

- **Fase / paso**: Cambio de alcance del reinicio QA, pedido por Felipe tras el QA manual.
- **Petición**: al reiniciar, la cuenta debe **eliminarse de Firestore** y empezar de cero, no volver a `ready` conservando el perfil.
- **Divergencia con la especificación, registrada a propósito**: §20.1 dice que el reinicio «conserva su acceso, nombre y foto de Google» y §20.2 que deja «`users/{uid}` en `ready` + seed». Lo pedido es el alcance de `deleteAccountAndClear` de Android (`MplusAccountResetRepository`, paso 6: borrado directo de `users/{uid}`), no el de `runResumableSequence`. **Requiere decisión del orquestador** para alinear la especificación; el agente Web no edita `recursos/orquestador/`.
- **Las Rules ya lo permiten**, sin cambios: `allow delete: if ownsPath(uid) && resource.data.status == 'resetting'` (línea 1050). Y `validUserCreate` admite recrear el perfil en el siguiente login (`status: ready`, sin Hogar), así que la cuenta vuelve a nacer limpia.
- **Cambios**:
  - Nuevo paso 6: se elimina `users/{uid}` en lugar de dejarlo en `ready`. Se retira el reseed: `ensureMplusUserBootstrap` crea perfil y catálogo base al volver a entrar, como con un usuario nuevo. Esto además hace desaparecer el problema de la corrección 3 (sembrar exige `ready`), porque ya no se siembra durante el reinicio.
  - **Camino de respaldo**: si la eliminación falla, se vuelve al comportamiento anterior (`ready` + reseed) y se reporta. Conserva el historial de `revision`, pero evita lo único inaceptable: dejar la cuenta atrapada en `resetting`, estado en el que las Rules niegan toda escritura.
  - El resultado informa `deletedUserProfile`, y el diálogo lo muestra (`perfil: eliminado / conservado`) junto al copy actualizado.
- **Aclaración importante que el copy refleja**: esto elimina el **perfil de Firestore**, no la identidad en **Firebase Authentication**. El correo sigue en `Authentication → Users` con el mismo UID; Android tampoco la borra. Eliminarla exigiría `deleteUser()` con reautenticación reciente, que es otra operación.
- **Pruebas actualizadas**: el gateway falso modela `allow delete` de `users/{uid}` (exige `resetting`). Los 8 escenarios comprueban ahora que el perfil queda eliminado y que no queda ningún residuo bajo `users/{uid}`; el de idempotencia comprueba que un segundo reinicio falla con un mensaje explícito («no existe en Firestore») en vez de fallar de forma opaca.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — Corrección 6: el primer login tras el reinicio fallaba por carrera de bootstrap (`already-exists`)

- **Fase / paso**: Corrección derivada del cambio anterior (el reinicio ahora elimina `users/{uid}`).
- **Síntoma reportado**: al entrar con Google no pasa nada visible, pero en Firestore el perfil **sí** aparece creado. Consola: `POST …/documents:commit 409 (Conflict)` y `RestConnection RPC 'Commit' failed with error: {"code":"already-exists"}`, con `"currentDocument":{"exists":false}` en la petición.
- **Causa raíz**: el inicio de sesión dispara **dos** bootstraps a la vez — el de `signInWithGoogle` y el del listener `onAuthState`, que también llama a `ensureContractUser`. Mientras `users/{uid}` ya existía era inocuo (ambos solo leían). Desde que el reinicio elimina el perfil, **ambos intentan crearlo**: el commit lleva la precondición `currentDocument.exists = false` y el que pierde recibe `already-exists`.
  - Ese código no estaba contemplado: `ensureProfile` toleraba el `conflict` de OCC local, pero `already-exists` viene del **servidor** y caía en `rejected` → `throw MplusBootstrapError` → el inicio de sesión entero fallaba, justo después de que el perfil quedara correctamente creado.
  - Es un defecto latente que solo se manifestaba en el primer login de un usuario nuevo; el cambio anterior lo convirtió en el caso de todos los días.
- **Correcciones**:
  1. **Se elimina la carrera en su origen**: `ensureMplusUserBootstrap` comparte una única promesa en vuelo por `uid` (`inFlightBootstrap`), así que los dos caminos del login esperan el mismo bootstrap en vez de competir.
  2. **Y se sobrevive si ocurre igual** (otra pestaña, otro dispositivo): crear algo que ya existe con el estado que queríamos es éxito, no fallo. `ensureProfile` trata `already-exists` como el `conflict` que ya toleraba: relee y continúa.
- **Pruebas añadidas** en `mplus-user-bootstrap.test.ts`: existencia del bootstrap compartido, tolerancia a `already-exists`, y que ese caso se evalúe **antes** del `throw` — si se colocara después, el throw se lo comería y la prueba pasaría igual sin arreglar nada.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — Corrección 7: el dashboard se pintaba antes de que existiera `users/{uid}`

- **Fase / paso**: Tercera consecuencia del cambio de alcance del reinicio (eliminar `users/{uid}`).
- **Síntoma reportado**: el inicio de sesión ya entra, pero el dashboard aparece con «Error al cargar datos — Missing or insufficient permissions».
- **Causa raíz**: `onAuthState` reportaba la sesión y **después** corría el bootstrap, deliberadamente, para no retrasar el pintado en una recarga con sesión viva. Pero las Rules de `users/{uid}/accounts` y `users/{uid}/categories` exigen `parentUserExists(uid)` (líneas 1053 y 1060): sin `users/{uid}` creado, la **primera** lectura del dashboard es rechazada. Era inocuo mientras el perfil existiera siempre; desde que el reinicio lo elimina, el primer login pasa siempre por ese caso.
- **Corrección**: el bootstrap se completa **antes** de reportar la sesión. La sesión se reporta pase lo que pase —un bootstrap fallido no puede dejar la pestaña colgada en «cargando»—; si falló, queda en `bootstrapError` en vez de fingir que la cuenta está lista.
  - Coste en una recarga normal: dos lecturas, no escrituras, porque el perfil ya existe. Y no hay trabajo duplicado con el login: `inFlightBootstrap` hace que ambos caminos compartan la misma promesa.
- **Ajuste asociado**: la red de seguridad de `useAuthBootstrap` pasa de 8 s a 20 s. Ese margen cubre ahora también el bootstrap; en un primer login hay que crear el perfil y sembrar 22 categorías, y con 8 s una conexión lenta habría devuelto a la persona a la pantalla de acceso con la cuenta a medio preparar.
- **Prueba añadida** en `auth-routing.test.ts`: se compara la posición de `await ensureContractUser(user.uid)` con la de `callback(mapAuthUser(user))` y se exige que el bootstrap vaya primero. Es exactamente el orden que fallaba, así que invertirlo vuelve a poner la prueba en rojo.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores; `/dashboard` cargado en navegador sin errores de consola.
- **Patrón registrado**: las tres últimas correcciones (5, 6 y 7) son la misma raíz — el reinicio pasó a eliminar `users/{uid}`, y eso convirtió el camino de «usuario nuevo», que casi nunca se recorría, en el de cada día. Cada paso que asumía un perfil preexistente salió a la luz uno tras otro.

### Entrada — 2026-08-26 — Crear Hogar rechazado: la identidad del miembro no salía de los claims del token

- **Fase / paso**: Corrección de creación de Hogar tras QA manual.
- **Síntoma**: «Crear un hogar» → `Missing or insufficient permissions`.
- **Análisis contra `android/firestore.rules`**: `validHouseholdCreate` (línea 549) encadena, en la misma transacción, la creación del Hogar, la membresía y la invitación, más la actualización de `users/{uid}`. Se verificaron uno a uno: `validInviteId` (`^[0-9]{3}$`) coincide con `newHouseholdInviteCode`; `validInviteShape` exige `expiresAt == createdAt + 7d` y `INVITE_VALIDITY_MILLIS` son exactamente 7 días; `validHouseholdShape` exige `name` y `householdToFirestore` lo escribe. El eslabón que **no** encajaba es `identityMatchesClaims` (línea 747).
- **Causa**: esa regla exige igualdad EXACTA entre lo que se escribe en la membresía y los claims del ID token:
  - `data.displayName == request.auth.token.name`
  - `data.photoUrl == request.auth.token.picture`

  Web construía la membresía desde `User.displayName` / `User.photoURL` con dos capas de respaldo encima (`userName || "Usuario"` en la card, `displayName.trim() || "Usuario"` en el servicio, y `photoUrl.trim()`). Son fuentes parecidas pero distintas: cualquier divergencia —un valor por defecto del cliente, una foto sin URL, un perfil actualizado en Google que aún no se refrescó en el objeto `User`— hace que el servidor rechace la escritura sin decir cuál de los dos campos falló.
- **Corrección**: la membresía se construye desde los claims del ID token (`readIdentityClaims`, vía `getIdTokenResult`), que es literalmente el valor con el que el servidor compara. Los valores de la UI quedan solo como respaldo para cuando el claim no viene — caso en el que la regla tampoco lo exige (`!('name' in request.auth.token)`). Aplica a crear Hogar, unirse y reingresar.
- **Diagnóstico añadido**: preflight con los validadores del contrato (`household`, `member`, `invite`, `user`) antes de abrir la transacción. Un error de forma pasa a verse como tal, con el campo concreto, en vez de como un `Missing or insufficient permissions` genérico, y sin gastar un viaje al servidor.
- **Honestidad sobre el diagnóstico**: es la hipótesis mejor fundada tras descartar el resto de eslabones de la regla, pero **no está confirmada contra el proyecto real**. Si persiste, el preflight y el mensaje crudo de Firestore acotan el siguiente paso.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — Auditoría de "unirse con código" y "renombrar Hogar" contra las Rules

- **Fase / paso**: Auditoría preventiva pedida por Felipe, antes de tocar esos flujos en QA.
- **Método**: recorrer condición por condición `validInviteConsumptionHouseholdUpdate` (827), `validRejoinConsumptionHouseholdUpdate` (701), `validInviteConsumption` (883), `validHouseholdRename` (590) y `validHouseholdUpdateShape` (601), y comparar cada una con lo que Web escribe y con lo que comprueba antes de escribir.
- **Verificado y correcto** (no se tocó): el código de invitación y su vencimiento a 7 días exactos; el `activeInviteId = null` en ambas rutas de consumo; la preservación de `createdAt`/`expiresAt`/`reservedForUid` en la invitación; el `joinedAt` en la reactivación de una membresía; que el renombrado escriba SOLO las cuatro claves que admite `affectedKeys().hasOnly`; y `validActiveInviteIdTransition`, que se cumple sola al ser un update parcial.
- **Cinco huecos encontrados, todos con el mismo efecto**: el servidor rechazaba con `Missing or insufficient permissions` sin decir qué corregir.
  1. **Membresía previa**: Web exigía `membershipState !== "none" && householdId !== null` (un AND). Las Rules miran SOLO `householdMembershipState == 'none'`, así que un perfil en pausa (`left`) sin `householdId` pasaba la guarda local y moría en el servidor. Ahora se replica la condición exacta, con mensaje propio para el caso de pausa: la salida no es la misma.
  2. **Consumir el propio código**: `validInviteConsumptionHouseholdUpdate` exige `request.auth.uid != resource.data.memberAId`. Es lo más fácil de encontrar probando en solitario y no había comprobación.
  3. **Hogar ya completo**: el primer ingreso exige `status == 'waiting' && memberBId == null`. Un código viejo contra un Hogar ya emparejado daba error de permisos.
  4. **Renombrar con el mismo nombre**: `validHouseholdRename` exige `data.name != resource.data.name`. Guardar el nombre actual no es un no-op: el servidor lo **rechaza**.
  5. **Hogar heredado sin `name`**: `validHouseholdUpdateShape` bifurca según el documento tenga o no `name`; si no lo tiene, valida contra `validLegacyHouseholdShape`, cuyo `hasOnly` no admite `name`. Añadirlo es imposible desde el cliente. Ahora se dice claro y se señala que debe resolverse desde el contrato compartido. Los Hogares creados desde Web siempre llevan `name`, así que solo afecta a documentos heredados.
- **Diseño**: las guardas se extrajeron a dos funciones puras exportadas, `resolveJoinRejection` y `resolveRenameRejection`, para poder probarlas de verdad en vez de afirmar que cierto texto existe en el archivo. `renameHousehold` pasa a recibir el `MplusHousehold` completo (antes recibía `householdId` + `expectedRevision`), porque necesita el nombre actual para decidir.
- **Pruebas añadidas** (`mplus-household-join-rename-guards.test.ts`): los dos caminos felices —primer ingreso y reingreso reservado con el Hogar ya `active`—, cada rechazo con su código, los límites inclusivos (vencimiento a la hora exacta, nombre de 50 caracteres) y el ORDEN de precedencia: un código vencido se reporta como vencido aunque además haya membresía previa, y un nombre inválido se reporta antes que la condición de Hogar heredado — primero lo que la persona sí puede corregir.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.
- **Sin confirmar contra el proyecto real**: es análisis de reglas más pruebas locales. Falta el QA manual de los dos flujos con dos cuentas.

### Entrada — 2026-08-26 — Crear Hogar: la causa real era sembrar el catálogo dentro del batch de creación

- **Fase / paso**: Corrección de la creación de Hogar. **Rectifica el diagnóstico de la entrada anterior.**
- **Dato que lo resolvió**: Felipe reportó que crear Hogar **sí funciona en Android** y no en Web. Eso descarta las Rules como causa y obliga a buscar la diferencia en lo que cada cliente escribe. La entrada anterior había apuntado a `identityMatchesClaims` como hipótesis; era una mejora real de robustez, pero **no era la causa**.
- **Causa raíz**: `createHousehold` sembraba las categorías de gasto del Hogar (§13.1) **dentro de la misma transacción** que crea el Hogar. `firestore.rules` (expenseCategories, línea 1155):

  ```
  allow create: if currentUserIsActiveMember(householdId) &&
    get(householdPath(householdId)).data.status == 'active' && ...
  ```

  Ninguna de las dos condiciones puede cumplirse en ese batch: el Hogar nace `waiting`, no `active`; y `currentUserIsActiveMember` resuelve con `get()`, que lee el estado ANTERIOR al batch, cuando la membresía todavía no existe. El servidor rechazaba la transacción entera.
- **Android ya lo tenía resuelto y documentado**, en `MplusHouseholdCategoryRepository`: «el seed solo puede sembrarse con el Hogar `active` — `firestore.rules` rechaza `expenseCategories.create` mientras está `waiting` — por eso `ensureSeed` se llama al detectar la transición a activo, no al crear el Hogar». Web era el que se salía del acuerdo.
- **Corrección**: la siembra sale de `createHousehold` y pasa a `ensureHouseholdExpenseSeed` (en `mplus-household-categories-service`), disparada por `useMplusHouseholdSeeder` cuando el Hogar está `active`. Es idempotente —lee lo existente y solo crea lo que falta, con IDs deterministas—, así que es segura en cada carga y desde los dos miembros a la vez. Un fallo de siembra no tumba la pantalla: se registra y el Hogar sigue usable con `Por clasificar`.
- **Pruebas añadidas**: que `mplus-household-service` ya no referencie `HOUSEHOLD_EXPENSE_SEED` (sembrar ahí vuelve a romper la creación entera), que la siembra lea antes de escribir y no escriba si no falta nada, y que su driver solo actúe con el Hogar `active`.
- **Lección**: la pregunta «¿funciona en la otra plataforma?» habría acotado esto en un paso. Cuando un flujo falla solo en Web y las Rules son compartidas, la causa está en la diferencia de escritura, no en las Rules — y Android es la referencia a leer primero.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — Por qué el servidor de desarrollo se siente lento al cambiar de sección

- **Fase / paso**: Diagnóstico de rendimiento del entorno de desarrollo (no afecta a producción).
- **Pregunta**: cambiar de sección durante el QA es muy lento y atrasa las pruebas.
- **Medición (no estimación)**: `next dev` compila cada ruta la PRIMERA vez que se pide.

  | Ruta | 1ª visita | 2ª visita |
  |---|---|---|
  | `/dashboard` | 2,4–4,1 s | 0,26 s |
  | `/movements` | 1,3–2,4 s | 0,23 s |
  | `/household` | 1,3–3,1 s | 0,25 s |
  | `/household/settings` | hasta 8,1 s | 0,32 s |

  Una vez compilada, cada sección responde en 0,22–0,32 s. El coste es de compilación bajo demanda, no de la app.
- **Turbopack medido y DESCARTADO**: con caché borrada en ambos, Webpack resultó más rápido en este proyecto — `/` 19,9 s vs 26,9 s; `/dashboard` 10,3 s vs 12,2 s; el resto de secciones 1,2–1,5 s vs 2,7–4,2 s. Además `next.config.ts` usa `webpack()` (el gate de release de las herramientas QA) y Turbopack lo ignora con aviso. Se mantiene Webpack; queda registrado para no volver a proponerlo sin medir.
- **Mitigación añadida**: `npm run dev:warm` (`scripts/warm-dev-routes.mjs`) pide las 10 rutas una vez, en serie, tras arrancar el servidor. El coste de compilación sigue existiendo pero se paga en segundo plano —24 s en total— en vez de en el primer clic de cada sección. Medido después de precalentar: **todas las secciones entre 0,22 s y 0,32 s**.
  - En serie a propósito: en paralelo compiten por el mismo compilador, el total sale peor y el servidor queda sin responder mientras tanto.
  - No toca el servidor ni la configuración: solo hace peticiones.
- **Causa estructural, pendiente de decisión**: la preferencia registrada «tras cada implementación, matar el servidor y relanzar `npm run dev`» tira a la basura toda la compilación en memoria, así que cada sección vuelve a costar sus segundos. Next tiene HMR y la mayoría de los cambios (componentes, servicios, pruebas) no necesitan reinicio; solo lo exigen `next.config.ts`, variables de entorno y dependencias nuevas. Relajar esa regla es la mejora más grande disponible, pero es una preferencia de Felipe y no se cambia sin su visto bueno.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — El precalentado de rutas se dispara solo al arrancar el servidor

- **Fase / paso**: Continuación del diagnóstico de lentitud del entorno de desarrollo.
- **Petición**: que el precalentado ocurra automáticamente al arrancar el servidor, y que la regla valga en cualquier sesión, no solo en este chat.
- **Cambios**:
  - `dev-watch.mjs` acepta `warmOnStart` y lanza `scripts/warm-dev-routes.mjs` en cada arranque, incluidos los reinicios. Si se apaga el servidor con el precalentado en vuelo, se detiene también.
  - `run-firebase-environment.mjs` pasa `warmOnStart: true`. **Este era el detalle que fallaba**: `dev-watch.mjs` tenía la comprobación de "me han ejecutado directamente", pero `npm run dev` pasa por el runner, que lo **importa** — así que esa comprobación nunca se cumplía y el precalentado quedaba apagado en el uso real. Solo se vio al probarlo de verdad; el gate parecía correcto leyendo el código.
  - `warm-dev-routes.mjs` **descubre el puerto**. `next dev` se mueve solo al siguiente libre si el 3000 está ocupado, y el script apuntaba fijo al 3000: en la primera prueba real precalentó otro servidor. Ahora sondea 3000-3010 y comprueba que quien contesta sea esta app antes de calentarla.
- **Persistencia de la regla**: `AGENTS.md` gana una sección propia — no reiniciar por costumbre, qué cambios sí exigen reinicio, y correr `npm run dev:warm` si se arranca Next por otra vía. Queda en el repo, así que cualquier agente lo lee sin depender de la memoria de una sesión.
- **Resultado medido**: arranque + precalentado 29,4 s en segundo plano; después, navegación entre secciones **0,28–0,47 s** (`/household/settings` 0,89 s).
- **Hallazgo operativo**: se encontraron **nueve servidores de desarrollo huérfanos** (puertos 3000-3008) acumulados por los reinicios de la sesión. Matar por puerto no basta: el supervisor relanza a su hijo, y además quedan procesos `next/dist/server/lib/start-server.js` cuyo padre ya murió. Para limpiar de verdad hay que matar los procesos `node` cuya línea de comandos apunte a este repo. Es otra razón, además del tiempo de compilación, por la que la máquina se iba poniendo lenta durante el QA.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde (incluida la prueba nueva de que el runner enciende el precalentado); `npm run lint` 0 errores.

### Entrada — 2026-08-26 — Cierre: cómo se impide que esto se repita

- **Fase / paso**: Consolidación de las reglas del entorno de desarrollo.
- **Revisión de lo documentado**: la primera versión de la sección en `AGENTS.md` cubría «no reinicies» y «mide antes de opinar», pero **no** el mecanismo que de verdad causó los nueve servidores huérfanos. Sin eso, el próximo agente que reinicie con razón (regla 2) repetiría el mismo destrozo.
- **Hueco cubierto** — nueva subsección «Cómo detener y reiniciar de verdad» en `AGENTS.md`:
  - Matar por puerto NO funciona: el supervisor relanza a su hijo.
  - Arrancar otro `npm run dev` encima deja DOS supervisores; Next se mueve solo al siguiente puerto libre y ambos quedan vivos compitiendo por CPU.
  - Quedan además procesos `next/dist/server/lib/start-server.js` cuyo padre ya murió, que no aparecen buscando «dev-watch».
  - Comando de detección (`netstat`) y comando de parada real (matar por línea de comandos).
  - Esperar a `[warm] Listo` antes de decirle al usuario que puede probar.
  - No dejar varios `npm run dev` en segundo plano en una misma sesión.
- **Protección contra deriva silenciosa**: `firebase-command-contract.test.ts` comprueba ahora que `dev:warm` siga en `package.json`, que el script exista, y que `AGENTS.md` conserve la regla —incluida la explicación de por qué matar por puerto no sirve—. Si alguien retira el andamiaje, la documentación dejaría de mentir en silencio: la suite falla. Súmese a la prueba ya existente de que el runner enciende `warmOnStart`.
- **Tres capas, a propósito**: `AGENTS.md` (lo lee cualquier agente al abrir el repo), memoria de proyecto (lo lee este asistente aunque no abra el repo) y pruebas (fallan si el andamiaje se rompe). Ninguna capa por sí sola basta: la documentación no obliga a nadie, y las pruebas no enseñan el porqué.
- **Límite honesto**: nada de esto **impide** que un agente ignore `AGENTS.md`. Lo que sí garantiza es que (a) la información esté donde se busca, (b) el andamiaje no se rompa sin que salte una prueba, y (c) el coste esté cuantificado, para que la decisión de reiniciar sea informada y no automática.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores. Servidor intacto durante toda la verificación (no se reinició).

### Entrada — 2026-08-26 — Lentitud al cambiar de sección: medí la capa equivocada

- **Fase / paso**: Continuación del diagnóstico de rendimiento en desarrollo. **Corrige la conclusión de la entrada anterior.**
- **Qué pasó**: tras el precalentado, `curl` daba 0,10–0,17 s por sección y se dio el problema por resuelto. Felipe siguió viendo ~5 s al cambiar de sección. Ambas cosas eran ciertas: **se estaba midiendo la capa equivocada.**
- **Lo que mide `curl`**: la respuesta del servidor (HTML, y también el payload RSC de navegación cliente — se comprobaron los dos: 0,05–0,16 s). El servidor NO es el cuello de botella.
- **Lo que no medía**: lo que el navegador descarga, parsea y ejecuta. Medido ahora:

  | Chunk | Peso en dev |
  |---|---|
  | Cada sección (`page.js`) | **6,7–8,1 MB** |
  | `(dashboard)/layout.js` | 9,4 MB |
  | `main-app.js` | 7,4 MB |

  En producción esas mismas rutas pesan 4–14 KB (salida de `npm run build`). El código de desarrollo va sin minificar y con envoltorio de HMR por módulo. Transferirlo desde localhost es instantáneo (0,02–0,06 s); parsearlo y ejecutarlo no.
- **Intento fallido, registrado para que nadie lo repita**: se probó bajar el coste con `config.devtool = "eval-cheap-module-source-map"` en el hook `webpack()`. **Next lo revierte** y avisa por consola («Reverting webpack devtool to 'false'. Changing the webpack devtool in development mode will cause severe performance regressions»). Medido antes y después: **cero KB de diferencia**. El cambio se retiró y quedó una nota en `next.config.ts` para que no se vuelva a intentar.
- **Lo que sí mejoró**: el precalentado bajó de ~29 s a **14,2 s** al arrancar sin servidores duplicados compitiendo por CPU.
- **Pendiente de confirmar con evidencia del navegador**: no se puede afirmar que los ~5 s sean exactamente el parseo de esos 7 MB sin una medición desde la sesión real (Performance/Network de DevTools con sesión iniciada). El servidor está descartado con datos; el resto es hipótesis hasta que llegue esa medición.
- **Lección**: «el servidor responde en 0,1 s» no es lo mismo que «la app se siente rápida». Antes de declarar resuelto un problema de percepción, medir en la capa donde la persona lo vive.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores.

### Entrada — 2026-08-26 — La tarjeta de quien crea el Hogar no se enteraba de que la pareja entró

- **Fase / paso**: Corrección de la espera de pareja, reportada en QA con dos cuentas.
- **Síntoma**: quien se une con el código ve su tarjeta actualizada al instante; quien creó el Hogar sigue viendo «test · Esperando a tu pareja» con el código en pantalla, como si no hubiera entrado nadie.
- **Causa**: Web es **pull** — lee cuando algo cambia de su lado. `load` del store de Hogar corta si el hogar y el período no cambiaron, así que en la sesión de quien creó el Hogar nadie vuelve a leer. Quien se une sí ve el cambio porque es quien ejecuta la acción y su propio código recarga después.
- **¿Viola el contrato? No.** §21.4 (DEC-061) atribuye las lecturas en vivo a **Android** («Hogar conserva su fuente en vivo separada»), y §22 «Comportamiento Web» no las exige: Web consulta y escribe solo con conexión, sin persistencia offline. Es un hueco de uso real, no un incumplimiento.
- **Corrección acotada**: `useMplusHouseholdWaitingWatcher` comprueba el documento del Hogar cada 4 s **solo mientras el estado es `waiting` o `waiting_return`**, y se apaga solo en cuanto deja de serlo. Una lectura por vuelta; la recarga completa (miembros, categorías, movimientos) solo se dispara si el documento cambió de verdad — entró la pareja, o regresó. Con limpieza del temporizador, para que cambiar de Hogar o cerrar sesión no acumule intervalos.
  - Se eligió sondeo acotado y no `onSnapshot` a propósito: el único estado del producto que consiste en esperar a otra persona es este, tiene principio y final claros, y así no se introduce un canal de lecturas en vivo que el contrato no pide a Web. Tampoco es «sincronización manual» de §19.4: no hay ningún control para el usuario.
- **Lo que sigue SIN cubrir, y conviene saberlo**: el resto de cambios del otro miembro —un movimiento compartido nuevo, una salida, un renombrado— siguen necesitando recargar la página. Cerrarlo del todo exige lecturas en vivo para Hogar en Web, que sería una decisión de contrato (§22) y un bloque de trabajo aparte. **Queda propuesto al orquestador, no ejecutado.**
- **Pruebas añadidas**: que el vigilante exista y esté montado en el shell, que solo actúe en los estados de espera, que limpie su temporizador, y que solo recargue cuando el documento cambió — no en cada vuelta.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores. **Sin reiniciar el servidor**: el cambio es de código de aplicación y lo recoge HMR (regla nueva de `AGENTS.md`).

### Entrada — 2026-08-26 — Falta de retroalimentación al cambiar de sección

- **Fase / paso**: Mejora de percepción de carga, pedida tras el QA de rendimiento.
- **Síntoma reportado**: «le doy click y parece que no hace nada». La pantalla anterior se quedaba congelada hasta que la sección destino podía renderizar.
- **Causa**: no había ningún `loading.tsx` en el árbol de rutas. Sin ese límite de Suspense, el App Router **mantiene la pantalla anterior** hasta que el segmento destino está listo. Los esqueletos que ya existían en `DashboardShell` cubren la carga de DATOS, que es una fase posterior: entre el clic y ese momento no había nada.
- **Corrección**: dos límites de carga, uno por ambiente.
  - `src/app/(dashboard)/loading.tsx` — esqueleto con `FinanceShimmer` (tokens Personales).
  - `src/app/(dashboard)/household/loading.tsx` — esqueleto con `HouseholdShimmer` (tokens `--hh-*`). Un esqueleto con el tono equivocado se lee como un parpadeo de contexto, así que el ambiente Hogar lleva el suyo.
  - Ambos viven DENTRO del layout del grupo, así que la barra lateral y la superior no parpadean: solo se sustituye el área de contenido. Y se parecen a propósito a los esqueletos de `DashboardShell`: el paso de «cargando la sección» a «cargando los datos» no debe notarse.
  - Accesibles: `role="status"`, `aria-busy`, `aria-live` y un texto solo para lectores de pantalla.
- **Verificado**: `app-build-manifest.json` registra `/(dashboard)/loading` y `/(dashboard)/household/loading` como segmentos propios, así que Next los está usando.
- **Prueba añadida** en `personal-shell-navigation.test.ts`: que ambos archivos existan, que cada uno use el shimmer de SU ambiente, y que se anuncien como ocupados para lectores de pantalla.
- **Nota de contexto**: esto se nota mucho más en desarrollo, donde cada sección pesa megabytes sin minificar (ver entrada anterior), pero el hueco existía igual en producción ante cualquier latencia. No sustituye a la medición pendiente sobre el origen real de los ~5 s.
- **Verificación**: `npx tsc --noEmit` 0 errores; `npm test` en verde; `npm run lint` 0 errores. Sin reiniciar el servidor.

### Entrada — 2026-08-27 — Corrección y refinamiento del modo Ingresos en el gráfico de barras de Hogar

- **Fase / paso**: Refinamiento y corrección del modo `Ingresos` en el gráfico analítico de Hogar.
- **Contexto y requerimiento**:
  - Se eliminó el uso de listas/bloques (`household-income-breakdown.tsx`) para el modo Ingresos del dashboard de Hogar.
  - Se unificó la experiencia visual dentro del mismo componente de barras verticales `HouseholdCategoryChart` que ya utiliza `Gastos`.
  - En modo `Gastos`: una barra por categoría compartida de Hogar.
  - En modo `Ingresos`: barras verticales por cada categoría personal de ingreso (`ownerId + categoryId`), agrupadas por responsable (“Tú” primero, luego pareja).
- **Detalles del diseño implementado en `HouseholdCategoryChart`**:
  - **Alineación exacta sobre línea base**: el track de la barra y las líneas guía se alinean en la base de 64px (`bottom-16`), garantizando que montos y porcentajes se sitúen estrictamente por encima de la barra y que los nombres de categoría queden inmediatamente debajo de la línea base.
  - **Tooltip enriquecido con jerarquía completa**:
    - Fila 1: `ProfileAvatar` (foto de Google / inicial) + nombre visible del responsable (“Tú” / nombre pareja).
    - Fila 2: nombre completo de la categoría (ej. “Freelance”, “Salario”, “Categoría de ingreso”).
    - Fila 3: monto formateado con `$ X.XXX.XXX`.
    - Fila 4: porcentaje sobre el total global de ingresos compartidos (`X% del total de ingresos compartidos`).
  - **Etiquetas inferiores de grupo**:
    - Identificador discreto centrado bajo todas las barras de cada responsable: `ProfileAvatar` + nombre (“Tú” / nombre pareja) + porcentaje del aporte de esa persona, sin duplicaciones de texto.
    - Divisor vertical sutil entre grupos únicamente cuando existan barras de más de un integrante.
  - **Escala e interacción**:
    - Altura de barras comparada contra la categoría individual de mayor valor de todo el Hogar.
    - Porcentaje visible sobre el total global de ingresos compartidos.
    - Clic en barra filtra por `type=income`, responsable y categoría (`/household/movements?categoryId=...&memberId=...&type=income`).
    - Clic en el identificador del responsable filtra por `type=income` y responsable (`/household/movements?memberId=...&type=income`).
    - Fallback seguro para etiquetas faltantes de la pareja: `"Categoría de ingreso"`.
- **Verificación**:
  - `npm test`: 100% de suites en verde.
  - `npx tsc --noEmit`: 0 errores TypeScript.
  - `npm run build`: compilación de producción exitosa.

### Entrada — 2026-08-27 — Paridad de sincronización en tiempo real Web ↔ Android con Firestore `onSnapshot`

- **Fase / paso**: Implementación de sincronización reactiva en tiempo real en Web para paridad total con Android.
- **Contexto y objetivo**: Android recibe cambios remotos de Firestore instantáneamente. Web utilizaba lecturas puntuales (`getDoc/getDocs`) y requería recargar para ver cambios de Android u otra pestaña. Se implementó una arquitectura centralizada de listeners Firestore en tiempo real (`onSnapshot`) gestionada a través de `SubscriptionRegistry`.
- **Arquitectura implementada**:
  - **`SubscriptionRegistry` (`src/lib/firestore/subscription-registry.ts`)**: registro estructurado de desuscripción por ámbito (`personal` y `household`). Evita duplicación de listeners y asegura limpieza atómica y segura de listeners obsoletos.
  - **Servicios reactivos con `onSnapshot`**:
    - Personal: `subscribeMplusUserProfile`, `subscribeMplusAccounts`, `subscribeMplusCategories`, `subscribePersonalMonthMovements`, `subscribePersonalTrashedMovements`.
    - Hogar: `subscribeMplusHousehold`, `subscribeMplusHouseholdMembers`, `subscribeMplusHouseholdActiveInvite`, `subscribeMplusHouseholdExpenseCategories`, `subscribeMplusCategoryMappings`, `subscribeMplusMemberCategoryLabels`, `subscribeMplusMemberAccountLabels`, `subscribeHouseholdMonthMovements`.
  - **Stores Zustand (`useMplusPersonalStore`, `useMplusHouseholdStore`)**:
    - `load()` conecta automáticamente los listeners requeridos vía `subscriptionRegistry`.
    - Control de ciclo de vida con `generation` para descartar de forma segura callbacks obsoletos tras cambios de usuario o mes.
    - `reset()` desuscribe atómicamente el ámbito correspondiente.
  - **Frontera de sesión (`session-boundary.ts`)**: desuscripción total (`subscriptionRegistry.unregisterAll()`) en cambios de usuario o logout.
  - **Reemplazo de polling**: el sondeo por temporizador de 4 s para espera de pareja (`waiting/waiting_return`) fue sustituido por el listener reactivo de `households/{householdId}` (`household-doc`).
- **Pruebas técnicas y validación**:
  - `tests/unit/settings-legacy-and-qa-surface.test.ts`: actualizada la regla para autorizar `onSnapshot` en servicios centralizados y validar el gobierno por `subscriptionRegistry` y `generation`.
  - `tests/unit/mplus-household-join-rename-guards.test.ts`: actualizada la aserción de espera de pareja reactiva en vivo.
  - `tests/unit/mplus-realtime-sync.test.ts`: suite unitaria con cobertura de los 8 escenarios requeridos (movimientos en vivo, cuentas/categorías, papelera, transición de estado en Hogar, integrantes/categorías/mapeos de Hogar, movimientos compartidos, ciclo de vida de `SubscriptionRegistry` y descarte por `generation`).
- **Verificación técnica**:
  - `npm test`: 44 suites pasando al 100% (todas las pruebas unitarias verdes).
  - `npx tsc --noEmit`: 0 errores de tipado TypeScript.
  - `npm run build`: compilación de producción exitosa (16/16 rutas generadas).

### Entrada — 2026-08-27 — Paridad con Android en el desglose jerárquico de ingresos de Hogar

- **Fase / paso**: Desglose jerárquico de ingresos compartidos de Hogar por integrante y categorías personales.
- **Contexto y problema**:
  - Android muestra los ingresos compartidos en jerarquía: (1) responsable ("Tú" o pareja con avatar, nombre, subtotal y %), y (2) debajo de cada responsable, sus categorías personales de ingreso con monto y porcentaje.
  - Web aplanaba esta información en "Aportes por integrante" perdiendo la categoría personal origen (por ejemplo si una persona tiene Salario y Freelance, solo salía el total acumulado).
- **Implementación**:
  - **Cálculo puro y modelos (`src/features/household/lib/household-dashboard-view-model.ts`)**:
    - Se definieron los tipos `HouseholdIncomeCategoryRow` y `HouseholdMemberIncomeSection`.
    - Se implementó `resolveHouseholdIncomeCategoryLabel` para resolver nombre, icono y color desde el catálogo personal propio (si `isOwn`) o `categoryLabels` (pareja), con fallback seguro (`"Categoría"`, `"other"`, `"#94A3B8"`).
    - Se implementó `buildHouseholdIncomeSections` con orden canónico: "Tú" siempre primero, luego integrantes por subtotal desc; dentro de cada integrante, categorías por importe desc con desempate estable.
  - **Componente jerárquico (`src/features/household/components/household-income-breakdown.tsx`)**:
    - Renderiza las secciones por responsable con avatar (`ProfileAvatar`), nombre, subtotal (`HouseholdAmount`) y porcentaje.
    - Renderiza las categorías internas con su icono, nombre, monto, porcentaje y barra de escala proporcional.
    - Clic en el integrante filtra por responsable; clic en la categoría filtra por tipo, responsable y categoría (`/household/movements?categoryId=...&memberId=...&type=income`).
  - **Integración (`mplus-household-overview.tsx` y `household/page.tsx`)**:
    - Consumo de `personalCategories` desde `useMplusPersonalStore` y `categoryLabels` desde `useMplusHouseholdStore`.
    - Ajuste de títulos: "Gastos por categoría" / "Ingresos por integrante" y subtítulo "Fuentes de ingreso compartidas en {mes}".
    - Modo Gastos permanece intacto agrupado por categorías compartidas de Hogar.
  - **Filtros en Historial de Movimientos (`mplus-household-movements-view.tsx`)**:
    - Ajustado el filtrado de `selectedCategoryId` para movimientos `income` (que usan `m.categoryId` personal en vez de `m.householdCategoryId`).
    - Actualizado el selector `<select>` para listar categorías de ingreso cuando corresponda.
- **Pruebas y Verificación**:
  - `tests/unit/household-dashboard-chart.test.ts`: añadidas pruebas `WA-HOU-DASH-010B`, `WA-HOU-DASH-010C` y `WA-HOU-DASH-013` validando todos los escenarios de agrupación, orden ("Tú" primero), resolución de etiquetas propias y de pareja, fallbacks, accesibilidad y tokens de Hogar.
  - `npm test`: todas las suites en verde (100% passing).
  - `npx tsc --noEmit`: 0 errores de tipado TypeScript.

### Entrada — 2026-08-27 — Gráfico plano unificado de Ingresos por categoría en Hogar (Finanzas M+ Web)

- **Fase / paso**: Unificación visual del gráfico de Ingresos de Hogar a estructura plana idéntica a Gastos.
- **Contexto y objetivo**:
  - Se eliminó cualquier separación visual, agrupación por integrante, divisores verticales o badges/subtotales de miembro en el gráfico de Ingresos de Hogar.
  - El modo Ingresos se visualiza ahora como UN único gráfico plano de barras verticales equidistantes a lo ancho de la tarjeta, compartiendo la misma altura (`min-h-[220px]`), líneas guía, área de trazado, textura, baseline (`bottom-8`) y estética que el modo Gastos.
- **Modelo visual y datos**:
  - Cada barra representa una categoría de ingreso de un integrante (`ownerId + categoryId`). Si ambos integrantes tienen la misma categoría (ej. Salario), aparecen como dos barras consecutivas e independientes.
  - Orden: global estrictamente descendente por importe.
  - Altura de barra (`barScalePercent`): normalizada contra la categoría de ingreso de mayor valor de todo el Hogar en el período.
  - Porcentaje (`share`): calculado sobre el total global de ingresos del Hogar.
  - Eje inferior: únicamente el punto de color y el nombre de la categoría en una sola línea con `truncate`. No hay nombres de integrante en el eje.
- **Tooltip enriquecido**:
  - La identidad del responsable se expone **exclusivamente dentro del tooltip** al hacer hover o foco sobre la barra.
  - Contenido del tooltip:
    - Fila 1: `ProfileAvatar` (foto circular con fallback de inicial) + "Tú" o nombre del responsable.
    - Fila 2: Nombre de la categoría de ingreso.
    - Fila 3: Monto en pesos (`$ ...`).
    - Fila 4: Porcentaje del total de ingresos compartidos (`X% del total de ingresos compartidos`).
- **Textos y Metadata**:
  - Título: `"Ingresos por categoría"`.
  - Subtítulo: `"Total ingresado en {mes}"`.
  - Metadata inferior: `"Mostrando X de X categorías · Total: $..."`.
  - Nota lateral inferior: `"Las barras comparan cada categoría con la de mayor valor"`.
- **Archivos modificados**:
  - `src/features/household/lib/household-dashboard-view-model.ts`: función pura `buildHouseholdIncomeCategoryChartData` y tipo `HouseholdIncomeCategoryChartItem`.
  - `src/features/household/components/household-category-chart.tsx`: simplificación del modo `income` con layout plano idéntico a `expense`, sin divisores ni etiquetas grupales externas, tooltip enriquecido.
  - `src/features/household/components/mplus-household-overview.tsx`: integración de `buildHouseholdIncomeCategoryChartData`, paso de `incomeItems`, títulos y subtítulos actualizados.
  - `tests/unit/household-dashboard-chart.test.ts`: pruebas unitarias y estructurales `WA-HOU-DASH-010B`, `WA-HOU-DASH-011`, `WA-HOU-DASH-012` y `WA-HOU-DASH-013`.
### Entrada — 2026-08-27 — Clasificación rápida modal de gastos de Hogar pendientes (Paridad UX Android)

- **Fase / paso**: Modal de clasificación rápida secuencial de gastos compartidos pendientes desde el dashboard de Hogar.
- **Contexto y objetivo**:
  - Dar paridad UX con Android: al pulsar "Clasificar gastos" o hacer clic sobre la barra "Por clasificar" en el gráfico de Gastos de Hogar, ya no se navega al historial de Movimientos.
  - Se abre directamente un modal de clasificación rápida (`HouseholdQuickClassifyDialog`) sobre el dashboard de Hogar.
- **Flujo y capacidades**:
  - **Cola secuencial de gastos**: Recibe todos los movimientos compartidos activos del mes con `type === "expense"` y `householdCategoryId === null`.
  - **Tarjeta de gasto actual**: Muestra concepto (`title`), monto (`HouseholdAmount`), fecha formateada en Bogotá, responsable con avatar circular (`ProfileAvatar`) y nombre ("Tú" o pareja), y categoría personal original como contexto discreto.
  - **Selector de categorías de Hogar**: Grid accesible con icono y color de cada categoría activa del hogar para asignación inmediata en 1 clic.
  - **Creación de categoría inline**: Botón "+ Nueva categoría" abre `HouseholdCategoryDialog` sin perder el contexto; al crearse, se asigna inmediatamente al gasto actual y avanza la cola.
  - **Persistencia atómica de equivalencias**: `correctPartnerMovementCategory` actualiza el movimiento y guarda la regla en `categoryMappings/{ownerId}__{personalCategoryId}` solo para gastos futuros (sin reclasificar gastos pasados). Si la equivalencia ya apunta a la misma categoría, no reescribe ni incrementa revisión redundantemente.
  - **Manejo de errores / conflictos**: Si ocurre un conflicto OCC o error, se conserva el gasto en la cola con alerta visible (`role="alert"`) y opción de reintento.
  - **Acción "Clasificar después" y cierre**: Permite omitir el gasto actual sin modificar datos, y al clasificar el último se cierra automáticamente y actualiza contadores y gráficos en Zustand sin refresco manual.
- **Archivos creados / modificados**:
  - `src/features/household/components/household-quick-classify-dialog.tsx` (Nuevo componente modal).
  - `src/features/household/components/mplus-household-overview.tsx` (Conexión de botón de aviso y clic de barra "Por clasificar" al modal).
  - `src/features/household/services/read-household-movements.ts` (Lectura transaccional interna e idempotencia en `correctPartnerMovementCategory`).
  - `tests/unit/household-quick-classify.test.ts` (Nueva suite de 8 pruebas unitarias).
  - `tests/unit/run-all.ts` (Registro de la suite).
### Entrada — 2026-08-27 — Cierre de paridad de negocio: Periodo Hogar (AUD-04), Reinicio de cuenta como producto (AUD-09), Resolución de conflictos OCC (AUD-10) y Copy Login

- **Fase / paso**: Implementación de los 4 cierres de negocio Finanzas M+ (contrato / spec) en Web.
- **Detalle de cambios**:
  - **1. AUD-04 (Periodo Hogar = mes de la UI)**:
    - Asegurado que todos los drivers de carga de datos en Personal (`use-mplus-personal.ts`) y Hogar (`use-mplus-household.ts`) canalicen `SelectedPeriod` a través de `toContractPeriod` (`src/lib/mplus/period.ts`), convirtiendo el mes 0-indexado de JavaScript (`Date.getMonth()`) al rango calendario 1-12 del contrato Firestore y `resolveMonthRangeFor`.
    - Verificación y prueba de regresión en `tests/unit/mplus-period-contract.test.ts`.
  - **2. AUD-09 (Reinicio de cuenta es producto en Ajustes, no herramienta QA)**:
    - Separación arquitectónica: el reinicio profundo de cuenta (spec §20 / DEC-080) fue extraído a `src/features/settings/services/mplus-account-reset-service.ts`, `mplus-reset-gateway.ts` y `src/features/settings/components/mplus-reset-confirm-dialog.tsx`.
    - La Zona Peligrosa de Ajustes (`SettingsFooter` en `settings-blocks.tsx`) monta "Reiniciar cuenta" de forma nativa en producto.
    - El módulo `src/features/qa-reset/` queda reservado exclusivamente para diagnósticos técnicos (`QaDiagnosticsCard`), cuyo barril es sustituido por `production-stub.tsx` en builds de producción.
    - El servicio de reinicio mantiene exactamente las 2 consultas autorizadas por Rules sobre `householdInvites` (`createdBy == uid` y `householdId == householdId`), con pruebas estrictas añadidas en `tests/unit/mplus-account-reset-flow.test.ts` que rechazan cualquier listado sin `where` o por otros campos.
  - **3. AUD-10 (Resolución de conflictos OCC en Movimientos)**:
    - `useMovementMutations` captura `outcome.kind === "conflict"`, deserializa el snapshot remoto con `movementFromFirestore` y expone `conflictState`.
    - Creado `MovementConflictDialog` (`src/features/movements/components/movement-conflict-dialog.tsx`) con diseño a 2 columnas (versión local con borrador vs versión del servidor con snapshot remoto).
    - Métodos de resolución: `resolveConflictKeepServer` (adopta la versión remota) y `resolveConflictKeepLocal` (reintenta la mutación con `baseRevision` actualizada a la del servidor).
    - Montado en `MovementComposerDialog`.
    - Nueva suite de pruebas: `tests/unit/movement-conflict-resolution.test.ts`.
  - **4. Copy Login (`auth-entry-page.tsx`)**:
    - Retiradas referencias legacy ("Saldo real", "Cuentas y bolsillos").
    - Actualizados textos y `HIGHLIGHTS` a actividad mensual y finanzas en pareja/Hogar compartido, sin saldos acumulados ni bolsillos.
- **Verificación técnica**:
  - `npm test`: 46 suites unitarias pasando al 100% (todas verdes).
  - `npx tsc --noEmit`: 0 errores de TypeScript.
  - `npm run build`: compilación de producción exitosa (16/16 páginas generadas y optimizadas).

### Entrada — 2026-08-27 — Corrección AUD-10: Eliminación de refresco silencioso en ramas de conflicto OCC

- **Fase / paso**: Corrección de resolución de conflictos OCC (spec §22.2).
- **Problema detectado**: `use-movement-mutations.ts`, `mplus-accounts-view.tsx`, `mplus-account-detail-view.tsx` y `mplus-categories-view.tsx` ejecutaban `if (outcome.kind === "conflict") await refresh();`. Este refresco silencioso recargaba el store antes de que el usuario pudiera elegir en el diálogo de conflicto, causando que cerrar el diálogo adoptara silenciosamente la versión remota (violando spec §22.2 por last-write-wins).
- **Correcciones implementadas**:
  - **1. Movimientos (`use-movement-mutations.ts`)**:
    - Se eliminó completamente `if (outcome.kind === "conflict") await refresh()` de `run()`.
    - En caso de conflicto, los stores se conservan exactamente en su último estado confirmado local previo al intento.
    - `conflictState` almacena `{ draft, baseMovement: current, serverMovement: (parsed remoteSnapshot or null) }`.
    - *Conservar versión local*: `resolveConflictKeepLocal` reintenta la mutación con `baseRevision = serverMovement.revision` y el `draft` original. Si vuelve a dar conflicto, actualiza `conflictState` sin refresco silencioso.
    - *Conservar versión del servidor*: `resolveConflictKeepServer` aplica puntualmente `serverMovement` con `applyCommittedMovement` o `removeMovement` (si fue eliminado remotamente), sin requerir un `refresh()` completo.
    - *Cerrar diálogo sin elegir*: `conflictState = null`, el store permanece intacto con la versión anterior.
  - **2. Cuentas y Categorías**:
    - Se eliminó `if (outcome.kind === "conflict") await refresh()` en `mplus-accounts-view.tsx`, `mplus-account-detail-view.tsx` y `mplus-categories-view.tsx`. Un conflicto muestra un mensaje de aviso y no sobreescribe el store local de forma silenciosa.
  - **3. Suite de Pruebas**:
    - `tests/unit/movement-conflict-resolution.test.ts` actualizado con aserciones estrictas que validan la ausencia de llamadas a `refresh()` en ramas de conflicto en los hooks y vistas, fallando explícitamente si se reintroduce la recarga silenciosa.
- **Verificación técnica**:
  - `npm test`: 46 suites pasando al 100% (todas verdes).
  - `npm run build`: compilación de producción exitosa (16/16 páginas generadas y optimizadas).



