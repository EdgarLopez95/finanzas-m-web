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

