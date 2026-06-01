# 11 — Web Dev Log

**Última actualización:** 2026-05-31 — WEB-0 preparación de memoria operativa web.  
**Estado actual del repo:** repo web pendiente de crear.  
**Propósito:** memoria operativa viva del frente web de Finanzas M para que cualquier agente pueda continuar sin reconstruir contexto.

---

# PARTE 1 — REGLAS PARA AGENTES IA

## 1.1. Qué es este archivo

Este archivo es la memoria operativa del repo web de Finanzas M.

Un agente debe poder leerlo y entender:

- qué está construido hoy en web;
- qué arquitectura debe respetar;
- qué decisiones ya están cerradas;
- qué debe reutilizar del modelo Android/Firebase;
- qué NO debe inventar;
- qué sigue pendiente de verdad;
- cómo cerrar una tarea correctamente.

Este archivo vive en dos lugares:

1. `docs/11_WEB_DEV_LOG.md` dentro del repo web `finanzas-m-web`.
2. Sources del proyecto ChatGPT de Felipe.

Felipe re-sube este archivo a Sources después de tareas importantes, igual que hace con `09_ANDROID_DEV_LOG.md`.

Si hay conflicto:

1. manda el archivo actual del repo web;
2. reporta la contradicción;
3. actualiza este archivo si la tarea lo requiere.

---

## 1.2. Cómo leerlo

Antes de tocar código:

1. Lee completa la Parte 1.
2. Lee completa la Parte 2.
3. Lee las últimas 2 o 3 entradas de la Parte 3.
4. Revisa `git status --short`.
5. Valida si la tarea toca:
   - Auth;
   - Firestore;
   - modelo de datos;
   - privacidad Personal/Hogar;
   - diseño;
   - rutas;
   - formularios;
   - deploy;
   - seguridad.

Si una entrada vieja contradice la Parte 2, manda la Parte 2.

Si el repo contradice este archivo, manda el repo y actualiza este archivo.

---

## 1.3. Reglas obligatorias

### Regla #1 — No trabajar sin leer este archivo

No empieces a modificar código sin leer este archivo.

Este archivo es equivalente al `09_ANDROID_DEV_LOG.md`, pero para web.

---

### Regla #2 — Respetar el stack vigente

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

No agregues librerías nuevas sin justificarlo.

No cambies framework, router, librería de UI, estado, formularios, hosting ni Firebase sin una decisión explícita de Felipe.

---

### Regla #3 — Respetar el modelo compartido con Android

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

### Regla #4 — No romper privacidad Personal/Hogar

Regla central:

```text
Personal = cuentas, bolsillos, categorías personales, saldos y pagos reales.
Hogar = eventos compartidos, responsabilidades, deudas, categorías de Hogar e ingresos compartidos seguros.
```

La web no debe exponer:

- cuentas personales de otro miembro;
- bolsillos personales de otro miembro;
- bancos personales de otro miembro;
- saldos personales de otro miembro;
- categorías personales de otro miembro;
- transacciones personales completas de otro miembro.

Hogar no tiene cuentas, bolsillos ni saldos propios.

---

### Regla #5 — Web V1 no busca paridad total

Web V1 es una versión simple para usar Finanzas M desde computador.

Debe priorizar:

- Login con Google.
- Leer usuario.
- Leer cuentas.
- Leer bolsillos en modo seguro.
- Leer categorías.
- Leer movimientos.
- Dashboard personal básico.
- Crear gasto.
- Crear ingreso.
- Crear transferencia.
- Edición/eliminación básica de movimientos.
- Vista Hogar simple.
- Deploy en Vercel.

No construir todavía:

- Home configurable.
- Edición avanzada de bolsillos.
- Reportes avanzados.
- Tarjetas de crédito.
- Plantillas.
- Recordatorios.
- Voz/Gemini.
- OCR.
- PWA.
- Multimoneda.
- Paridad visual total con Android.
- Funciones administrativas complejas de Hogar.

---

### Regla #6 — Respetar el sistema de diseño

La web debe sentirse como Finanzas M, no como dashboard SaaS genérico.

Debe respetar:

- `docs/07_DESIGN_SYSTEM.md`;
- modo oscuro inicial;
- cards suaves y modulares;
- paleta navy / salvia / dorado / warm paper;
- claridad financiera;
- separación visual entre Personal y Hogar;
- tipografía Poppins para títulos y Figtree para lectura/números si se integran fuentes;
- montos en COP sin decimales: `$ 20.000`.

No crear estilos paralelos sin justificar.

No convertir la web en un admin panel genérico.

---

### Regla #7 — Trabajar en pasos pequeños

Cada tarea debe ser acotada.

No mezcles:

- setup del proyecto;
- diseño visual;
- Firebase Auth;
- Firestore reads;
- Firestore writes;
- reglas de seguridad;
- deploy;
- auditorías.

Una tarea por prompt.

---

### Regla #8 — Verificación obligatoria antes de cerrar

Antes de cerrar una tarea, ejecuta lo que aplique según el estado del repo:

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
- arregla el error o documenta exactamente qué falló;
- no digas que quedó listo si no verificaste.

---

### Regla #9 — Actualizar este archivo al terminar

Siempre agrega una entrada al final de la Parte 3 con este formato:

```markdown
### Entrada — YYYY-MM-DD — [título corto]

- **Fase / paso**:
- **Agente / herramienta**:
- **Archivos creados**:
- **Archivos modificados**:
- **Archivos eliminados**:
- **TODOs nuevos**:
- **TODOs resueltos**:
- **Decisiones técnicas tomadas**:
- **Skills aplicadas**:
- **Verificación realizada**:
- **Estado al cerrar**:
- **Próximo paso sugerido**:
```

Si cambiaste arquitectura, rutas, estructura de carpetas, Firebase, modelo de datos, reglas, componentes base o design system, actualiza también la Parte 2.

---

### Regla #10 — AGENTS.md solo como puntero

Si existe `AGENTS.md`, debe ser corto y apuntar a este archivo.

No debe duplicar historial, roadmap ni decisiones.

El dev log principal de web es este archivo.

No usar `PROGRESS.md` salvo que Felipe lo decida explícitamente más adelante.

---

# PARTE 2 — ESTADO ACTUAL DEL PROYECTO WEB

## 2.1. Resumen ejecutivo

| Campo                     | Estado                                                      |
| ------------------------- | ----------------------------------------------------------- |
| **Fase operativa actual** | WEB-0 — Preparación documental                              |
| **Repo web**              | Pendiente de crear                                          |
| **Nombre repo esperado**  | `finanzas-m-web`                                            |
| **Stack**                 | Next.js 15 + TypeScript + Tailwind + shadcn/ui              |
| **Backend**               | Firebase Auth + Cloud Firestore compartido con Android      |
| **Hosting**               | Vercel                                                      |
| **Memoria operativa**     | `docs/11_WEB_DEV_LOG.md`                                    |
| **AGENTS.md**             | Recomendado solo como puntero cuando exista repo            |
| **PROGRESS.md**           | No usar por ahora                                           |
| **Foco inicial**          | Setup web limpio, identidad visual base y conexión Firebase |
| **Alcance Web V1**        | Paridad mínima desde computador, no paridad total           |

---

## 2.2. Estado inicial

Al iniciar este archivo:

- Android está cerrando/estabilizando el MVP operativo.
- Web todavía no tiene repo creado.
- La web debe arrancar con memoria operativa desde el día 1.
- La web debe usar el mismo Firebase y el mismo modelo remoto.
- La web debe respetar las decisiones de privacidad Personal/Hogar.
- La web debe evitar sobre-ingeniería.

---

## 2.3. Stack vigente

| Capa        | Decisión               | Estado              |
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
- `features/` agrupa lógica por dominio.
- `components/finance/` contiene componentes visuales propios de Finanzas M.
- `components/ui/` queda para shadcn.
- `lib/firebase/` inicializa Firebase y helpers de Firestore/Auth.
- `types/` modela DTOs compartidos con Firestore.
- Validaciones de formularios con zod.
- Formularios con react-hook-form.
- Estado global mínimo con Zustand.

---

## 2.5. Firebase y modelo compartido

La web debe conectarse al mismo proyecto Firebase usado por Android.

Reglas:

- Auth solo con Google.
- Firestore con reglas existentes.
- No crear backend separado.
- No duplicar modelo en colecciones nuevas.
- Usar queries por `ownerId`, `householdId`, `memberIds` según corresponda.
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
- Protección de rutas privadas.
- Leer `users/{uid}`.
- Leer cuentas personales.
- Leer bolsillos como parte de cuentas.
- Leer categorías personales.
- Leer movimientos personales.
- Ver dashboard personal básico.
- Crear gasto.
- Crear ingreso.
- Crear transferencia.
- Editar/eliminar movimientos básicos.
- Detectar si existe `activeHouseholdId`.
- Leer vista Hogar simple sin exponer privacidad.
- Deploy en Vercel.

Web V1 no debe incluir:

- Home configurable.
- Full reporting.
- Tarjetas de crédito.
- Plantillas recurrentes.
- Recordatorios.
- Voz/Gemini.
- OCR.
- PWA.
- Edición avanzada de Hogar.
- Edición completa de bolsillos.
- Paridad total con Android.

---

## 2.7. Diseño web esperado

La web debe adaptar el sistema visual de Finanzas M a escritorio.

Principios:

- No copiar Android pixel-perfect.
- Mantener identidad.
- Aprovechar más espacio horizontal.
- No parecer panel administrativo genérico.
- Dashboard claro, cálido y financiero.
- Sidebar o navegación lateral simple.
- Cards grandes, suaves y legibles.
- Modo oscuro inicial.
- Responsive básico para laptop y móvil.

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

### WEB-0 — Preparación documental

Estado: **En curso / este archivo**.

Incluye:

- Crear `11_WEB_DEV_LOG.md`.
- Definir uso de `AGENTS.md` corto.
- No usar `PROGRESS.md` por ahora.
- Ajustar `10_agent_skills_catalog.md`.
- Registrar ADR de Web Dev Log.
- Actualizar roadmap operativo.

### WEB-R — Setup inicial Next.js

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

### WEB-S — GitHub Web

Pendiente.

Incluye:

- Crear repo privado `finanzas-m-web`.
- Primer commit.
- Push a `main`.
- Confirmar instalación limpia.

### WEB-T — Identidad Finanzas M web

Pendiente.

Incluye:

- Tokens Tailwind.
- Layout base.
- Componentes base.
- Dashboard visual con datos fake.
- Responsive básico.

### WEB-U — Login web y Firebase

Pendiente.

Incluye:

- Firebase web SDK.
- Auth Google.
- protección de rutas.
- leer `users/{uid}`.
- sesión persistente.

### WEB-V — Lectura/escritura mínima

Pendiente.

Incluye:

- leer cuentas;
- leer bolsillos;
- leer categorías;
- leer transacciones;
- crear gasto;
- crear ingreso;
- crear transferencia;
- editar/eliminar movimiento básico;
- leer vista Hogar simple.

### WEB-W — Deploy mínimo Vercel

Pendiente.

Incluye:

- proyecto Vercel;
- variables;
- dominio autorizado en Firebase Auth;
- prueba de login producción;
- smoke test básico.

---

## 2.9. Skills recomendadas por tipo de tarea

### Setup Next.js

Skills:

- `next-best-practices`
- `vercel-react-best-practices`
- `writing-plans`

### Diseño visual inicial

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

### Auditoría pre-deploy

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

Pendiente después:

- Identidad visual web.
- Firebase Auth.
- Lectura de datos reales.
- Escritura mínima.
- Deploy.

---

# PARTE 3 — REGISTRO DE CAMBIOS RECIENTE

### Entrada — 2026-05-31 — WEB-0 preparación de memoria operativa web

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
  - decisión documental sobre `PROGRESS.md`: no usar por ahora;
  - decisión de replicar patrón del Android Dev Log para web.
- **Decisiones técnicas tomadas**:
  - `11_WEB_DEV_LOG.md` será la memoria operativa principal de web;
  - `AGENTS.md` será opcional/recomendado solo como puntero corto;
  - no se usará `PROGRESS.md` por ahora para evitar duplicar historial.
- **Skills aplicadas**:
  - ninguna ejecutada por agente de código todavía.
- **Verificación realizada**:
  - revisión documental de Sources.
- **Estado al cerrar**:
  - lista la base documental para iniciar web sin perder continuidad.
- **Próximo paso sugerido**:
  - generar prompt para Codex/Cursor: WEB-R setup inicial Next.js + estructura base + copiar `11_WEB_DEV_LOG.md`.

---

# ANEXO — HISTORIAL CONSERVADO

Este archivo inicia como memoria nueva para el frente web.

El antecedente directo es `09_ANDROID_DEV_LOG.md`, que demostró ser el patrón correcto para coordinar agentes IA, repo real y Sources del proyecto.

No hay historial web previo.

### Entrada � 2026-05-31 � WEB-T1/T3 sistema de dise�o base web

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
- **Decisiones t�cnicas tomadas**:
  - Tailwind v4 usa tokens por CSS variables y `@theme inline` en `globals.css`;
  - `@/lib/utils` queda como fuente principal de `cn` y `@/lib/utils/cn` como re-export;
  - se mantienen aliases de variables legacy para no romper placeholders existentes.
- **Skills aplicadas**:
  - `frontend-design`;
  - `shadcn`;
  - `web-design-guidelines`.
- **Verificaci�n realizada**:
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - sistema de dise�o web base implementado y visible en `/design-system`.
- **Pr�ximo paso sugerido**:
  - WEB-U: integrar Auth Google con rutas protegidas manteniendo componentes visuales nuevos.

### Regla adicional � lectura obligatoria para UI web

Para cualquier tarea UI web, leer tambien `docs/WEB_DESIGN_SYSTEM.md` antes de editar componentes, pantallas o tokens.

### Entrada � 2026-05-31 � WEB-T-DOC documentacion del sistema de diseno web

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

### Entrada � 2026-05-31 � WEB-T-AUDIT cierre de sistema de dise�o web

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
  - normalizar codificaci�n UTF-8 de `docs/11_WEB_DEV_LOG.md` (persistente).
- **TODOs resueltos**:
  - `Amount` con prefijo de transferencia correcto (`?`);
  - `EmptyState` oficializado en dise�o web y expuesto en `/design-system`;
  - cobertura de `reimbursement` en vitrina de timeline;
  - auditor�a de hardcodes: sin hardcodes cr�ticos fuera de tokens (solo swatch inline justificado en vitrina).
- **Decisiones t�cnicas tomadas**:
  - mantener `EmptyState` como componente oficial de `finance/*`;
  - mantener `style={{ backgroundColor: color }}` solo en la vitrina de paleta de `/design-system` por necesidad demostrativa;
  - mantener `/dashboard` con componentes `finance/*` sin estilos paralelos.
- **Skills aplicadas**:
  - `accessibility` (revisi�n de estados y foco);
  - auditor�a visual/manual del sistema.
- **Verificaci�n realizada**:
  - `npm run lint`;
  - `npm run build`.
- **Estado al cerrar**:
  - sistema de dise�o web auditado, alineado y listo para soportar WEB-U sin deuda visual bloqueante.
- **Pr�ximo paso sugerido**:
  - iniciar WEB-U (Auth Google) usando `docs/WEB_DESIGN_SYSTEM.md` como contrato UI.
