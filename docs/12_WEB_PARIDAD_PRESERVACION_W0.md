# W0 — Preservación visual y paridad funcional Web (Finanzas M+)

**Tipo documental:** Vivo de iniciativa (Web)
**Propietario:** Orquestador / Agente Web
**Vigencia:** Hasta el cierre verificado de la adaptación Web M+
**Repositorio:** `web/finanzas-m-web` — rama `develop/finanzas-m-plus`

> Este documento materializa las puertas **W0 (preservación visual)** y **W0.5 (paridad de adaptación)** del `PLAN_ADAPTACION_WEB.md` del centro de mandos. No sustituye al plan: lo hace ejecutable. Cualquier contradicción con el centro de mandos se resuelve a favor de `recursos/orquestador/`.

---

## 1. Propósito

Evitar que la adaptación de la Web a Finanzas M+ repita el error ocurrido en Android: en lugar de retirar/ajustar capacidades conservando la identidad visual, un agente reconstruyó flujos, pantallas y diseño desde cero, eliminando trabajo existente y costando tiempo.

Esta Web tiene un diseño terminado que **debe conservarse**. La adaptación es quirúrgica: conectar el contrato M+ a la UI existente, retirar lo que ya no aplica y añadir solo el estado mínimo que no tiene equivalente previo.

## 2. Referencias autoritativas

| Referencia | Valor | Uso |
|---|---|---|
| **Línea visual autoritativa (baseline)** | commit `c089d88818a1e32a399ef51d3236593116334499` (`c089d88`) | Toda comparación visual parte de este estado. Es la identidad que no se pierde. |
| **Punto técnico seguro M+** | commit `c153e48` de `develop/finanzas-m-plus` | Estado actual del repo: Firebase M+ configurado, cero adaptación funcional/visual. |
| **Fuente funcional** | `ESPECIFICACION_FUNCIONAL_UNICA.md` (centro de mandos) | Comportamiento esperado de Finanzas M+. |
| **Fuente técnica** | `CONTRATO_DATOS_REGLAS_COMPARTIDAS.md` (centro de mandos) | Rutas, campos, estados, permisos, índices y sincronización. |
| **Fuente de decisiones** | `DECISIONES_COMPARTIDAS.md` (centro de mandos), DEC-003…079 | Reglas de negocio/UX aprobadas. |
| **Referencia Android** | repo `android/`, rama `develop/finanzas-m-plus` | Referencia funcional y de datos. **NO es referencia visual Web.** |
| **Contrato de UI Web** | `WEB_DESIGN_SYSTEM.md` | Tokens, componentes y reglas obligatorias de la capa visual. |

## 3. Inventario de la Web base (lo que existe hoy)

Estado verificado en `c153e48` (pre-adaptación). El inventario es la base de la puerta W0: no se puede declarar terminado un bloque si no se sabe qué existía.

### 3.1 Rutas y páginas

| Ruta | Componente/página | Contexto | Estado |
|---|---|---|---|
| `/` | `AuthEntryPage` | público | VIVA |
| `/login` | redirige a `/` | público | LEGACY (compat) |
| `/dashboard` | `HomeView` (hero, cards reordenables) | Personal | VIVA |
| `/movements` | `MovementsView` (historial + filtros) | Personal | VIVA |
| `/accounts` | `AccountsView` (grid de cuentas) | Personal | VIVA |
| `/accounts/[accountId]` | `AccountDetailView` | Personal | VIVA |
| `/categories` | `CategoriesView` (reporte + gestor) | Personal | VIVA |
| `/settings` | `SettingsView` (perfil + Hogar + preferencias) | Personal/Hogar | VIVA |
| `/household` | `HouseholdOverview` | Hogar | VIVA |
| `/household/movements` | `HouseholdMovementsView` | Hogar | VIVA |
| `/household/categories` | `HouseholdCategoriesView` | Hogar | VIVA |
| `/household/settings` | `HouseholdSettingsView` | Hogar | VIVA |
| `/design-system` | `DesignSystemShowcase` | laboratorio | VIVA |

### 3.2 Shell y navegación

- `AppShell`: grilla `grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)]`, sidebar sticky, topbar sticky `z-40`, entrada GSAP con `prefers-reduced-motion`, contenedor raíz `data-fm-context`.
- `DashboardShell`: carcasa persistente del grupo `(dashboard)`; centraliza guard de sesión, carga de datos, contexto, período, avisos, diálogos globales.
- `Sidebar`: dos ramas visuales (Personal navy / Hogar bosque), logo, toggle de contexto, ítems por contexto, avatar de sesión.
- `TopBar`: título/subtítulo + acciones según contexto (selector de período, toggle saldos, "Editar tablero", dropdown "Nuevo"; en Hogar período + "Nuevo gasto" sage).
- Responsive: 1 columna en móvil, sidebar apilada arriba, formularios a 1 columna, acciones con `flex-wrap`.

### 3.3 Kits visuales y tokens

- **Personal (navy/dorado):** tokens `--fm-*` en `src/app/globals.css` + `src/lib/design/tokens.ts`; capa de identidad `src/components/finance/*`.
- **Hogar (bosque/menta):** tokens `--hh-*` en `globals.css`; kit `src/features/household/components/ui/*` (`HouseholdCard`, `HouseholdDialog`, `HouseholdButton`, `HouseholdAmount`, `HouseholdChip`, `HouseholdTextField`, `HouseholdEmptyState`, `HouseholdShimmer`, etc.).
- **Conmutación:** `[data-fm-context="household"]` y `[data-fm-context="personal"]` remapean roles semánticos; los kits **nunca se mezclan**.
- Tipografía: Poppins (display) / Figtree (cuerpo); radios, sombras y gradientes por contexto.

### 3.4 Componentes oficiales de la capa finance

`FinanceCard`, `Amount`, `FinanceButton`, `FinanceChip`, `FinanceTextField`, `FinanceDialog`, `FinanceSidePanel`, `FinanceDropdown`, `FinanceShimmer`, `EmptyState`, `PersonalTransactionRow`, `PersonalRecentMovementRow`, `AccountPocketCard`, `AccountIcon`, `IconSelect`, `CategoryBreakdownList`, `SettingRow`/`SettingsBlocks`, `PeriodPickerDialog`, `DiscardConfirmDialog`, `HouseholdShareConfirmDialog`, `CategoryIconColorPicker`, composer primitives, etc.

### 3.5 Patrones transversales obligatorios

- Diálogos con foco inicial útil; `alertdialog` de descarte; confirmaciones de doble envío (`createSingleFlightSubmitGuard`, `isSubmitting`).
- Estados: `FinanceShimmer`/`HouseholdShimmer`, `EmptyState`/`HouseholdEmptyState`, banners `role=alert`, errores con "Reintentar".
- GSAP con `prefers-reduced-motion`; dropdowns/comboboxes custom con teclado; listas `divide-y divide-white/8`.
- Accesibilidad: labels + `aria-*`, foco visible, `skip-link`.

### 3.6 Almacenamiento de datos / stores (referencia)

8 stores Zustand (`auth`, `app-context`, `personal-data`, `household-data`, `transaction-panel`, `ui-preferences`, `household-ui`, `household-ui-preferences`, `auto-settle-debt`). Servicios Firestore en `src/lib/firestore/` y `src/features/*/services/`. Tipos en `src/types/`. **El detalle de la migración de estos archivos es responsabilidad de W1/W2/W3, no de este documento.**

## 4. Invariantes visuales — NO se tocan

Salvo autorización explícita y registrada del usuario/orquestador, estos elementos permanecen idénticos:

1. `AppShell`, `DashboardShell`, `Sidebar`, `TopBar` y la jerarquía general de rutas (solo puede cambiar la lista de ítems del sidebar).
2. Composición de páginas: contenedores, grids, cards, densidad de información.
3. Formularios, selectores, diálogos, paneles, listas y controles existentes (incluido el composer y sus estados).
4. Estados vacío, carga, error, confirmación y prevención de doble envío.
5. Iconografía, paleta, tipografía, espaciado, radios, sombras y breakpoints.
6. Comportamiento desktop/móvil (orden, prioridad y visibilidad de acciones).
7. Tokens `--fm-*` / `--hh-*` y los kits `finance/*` y `household/ui/*` tal como están.
8. El contexto `[data-fm-context]` y la regla de que Personal y Hogar nunca mezclan cromo.

**Regla de oro:** la adaptación debe verse como *la misma aplicación Web con capacidades retiradas o ajustadas*, nunca como una app reconstruida.

## 5. Lecciones de Android — anti-patrones a evitar

Contexto: en la rama Android M+ un agente, ante una instrucción de "adaptar/retirar capacidades", terminó reconstruyendo flujos y pantallas desde cero. Consecuencias: pérdida de tiempo, superficies duplicadas, decisiones de diseño no solicitadas y churn de código. Estas lecciones se convierten en reglas duras para la Web:

1. **No reconstruir lo que se puede retirar o ajustar.** Retirar = desconectar circuito; ajustar = cambiar un dato/estado/acción dentro del mismo componente. Reconstruir = decisión explícita del usuario.
2. **No inventar diseño nuevo para cubrir un requisito técnico.** Si conectar el contrato a la UI existente se ve más fácil "haciendo otra cosa", es señal de detenerse, no de improvisar.
3. **No mezclar cromo Personal/Hogar.** El verde solo en Hogar, el navy/dorado solo en Personal. En caso de duda, se detiene y se pregunta.
4. **No tocar dominio retirado.** No se resucitan bolsillos, saldos, transferencias, dinero no propio, eventos, shares, deudas o reembolsos solo porque su código exista en la Web base.
5. **No usar Android como referencia visual.** Android sirve para reglas de negocio, estados, casos borde y fixtures; su composición/densidad/estilo no se copia a la Web.
6. **No eliminar código legacy antes de sustituir y probar su reemplazo.** El retiro se hace después de conectar, probar y aceptar visualmente la nueva vía.
7. **No ampliar alcance "por limpieza".** "Optimizar", "modernizar" o "mejorar UX" sin un requisito funcional aprobado es rediseño disfrazado.
8. **No marcar una celda "Adaptar" como permiso de reemplazo.** La matriz indica exactamente qué propiedad/acción cambia y qué permanece idéntico.

## 6. Matriz de impacto por bloque

Formato obligatorio por bloque antes de editar código (puerta W0/W0.5). Una celda "Adaptar" describe el delta mínimo; no autoriza reemplazar el componente.

| Ruta/estado | Componentes actuales | Conservar | Adaptar | Retirar | Delta visual exacto solicitado | Evidencia base |
|---|---|---|---|---|---|---|
| (por llenar por bloque W1–W5) | | | | | | |

### 6.1 Matriz preliminar W2 — Personal (orientativa, debe ratificarse en la auditoría del bloque)

| Ruta/estado | Conservar | Adaptar | Retirar | Delta visual exacto |
|---|---|---|---|---|
| `/dashboard` (hero) | Estructura de hero + cards + drag&drop | Contenido del hero a KPIs mensuales (ingresos/gastos/diferencia + gastos por categoría); desglose de ingresos como vista secundaria | Saldo real, distribución, "Te deben", "Por anotar", bolsillos | Solo cambia el contenido de las superficies existentes; misma tipografía, montos con `Amount`, mismas cards |
| Composer (crear/editar) | Diálogo `FinanceDialog size="composer"`, `OperationSelector`, campos, confirmación de descarte | Opciones a solo Ingreso/Gasto; toggle "Contar en Hogar"; categoría obligatoria; cuenta opcional | Opción Transferencia, dinero no propio | Mismo composer; cambian opciones del selector y un toggle nuevo reutilizando `ToggleRow` |
| `/movements` | Filas, agrupación por día, dropdown ⋮, diálogo de detalle | Filtros a tipo/categoría/cuenta + búsqueda; añadir acceso a Papelera | Filtro bolsillo, filtro titularidad | Filtros existentes se reconfiguran; Papelera nueva con componentes existentes |
| Papelera (nueva) | — | — | — | Estado nuevo mínimo: lista + restaurar/purgar con `EmptyState`, `FinanceDialog`, filas existentes |
| `/accounts` | Grid de `AccountPocketCard`, card punteada "Nueva cuenta", catálogo de bancos | Cuenta como etiqueta informativa (sin saldo), archivar, crear desde selector | Saldo/Disponible, bolsillos, "Ver detalle" de balance, ajuste de saldo | Se quitan los bloques de saldo/bolsillos; la card y el icono de banco se conservan |
| `/accounts/[accountId]` | Detalle con breadcrumb, resumen, movimientos | Resumen sin balance, acciones de editar/archivar | Bolsillos, reajustar disponible, cerrar/reabrir, eliminar cascada | Mismo layout; desaparecen bloques de balance |
| `/categories` | Tabs distribución/gestor, `CreateCategoryDialog`, seed, archivar | Asegurar plano (sin `parentId`), catálogos separados ingreso/gasto | Subcategorías si existen | Sin cambio visual |

### 6.2 Matriz preliminar W3 — Hogar (la de mayor riesgo)

| Ruta/estado | Conservar | Adaptar | Retirar | Delta visual exacto |
|---|---|---|---|---|
| Kit visual Hogar | `Household*` completo, tokens `--hh-*`, `[data-fm-context=household]` | Nada | Nada | Ninguno (invariante) |
| `/household` (overview) | Hero, cards, barras | Contenido a ingresos/gastos/diferencia del mes + gastos por categoría de Hogar + contador "Por clasificar" + desglose de ingresos por miembro | "Estado de aportes", shares, deudas | Solo contenido; misma gramática de cards |
| `/household/movements` | Timeline, filtros, detalle | Historial de movimientos compartidos de solo lectura con filtros miembro/tipo/categoría/cuenta + búsqueda | Eventos, ingresos legacy, shares | Mismos componentes; cambia la fuente de datos |
| `/household/categories` | Distribución + gestión, seed | Categorías de gasto de Hogar planas; crear/editar/archivar | — | Sin cambio visual |
| `/household/settings` | Layout | Card informativa (nombre + fotos) + acceso a categorías | Renombrar, salir, disolver, invitación (pasan a la card de Ajustes Personal) | Menos acciones, mismo layout |
| Crear/Unirse (en Ajustes Personal) | Diálogos existentes | Código 3 dígitos; estados waiting/active/waiting_return/desvinculado | Código 8 caracteres, disolución | Mismo diálogo; validación nueva |

### 6.3 Matriz preliminar W4 — Ajustes, navegación, deprecación

| Ruta/estado | Conservar | Adaptar | Retirar | Delta visual exacto |
|---|---|---|---|---|
| `/settings` | Hero Perfil+Hogar, preferencias, zona peligrosa | Card única de Hogar por estado (DEC-073); reinicio según DEC-079 | Sync card, "Administrar Hogar" con slots de roles legacy | Misma estructura de SettingsBlocks; cambian bloques |
| Sidebar | Rama visual Personal/Hogar, toggle, logo | Ítems a Personal/Movimientos/Hogar/Ajustes | Ítems cuentas/categorías/bolsillos como navegación principal | Reordenar la lista de ítems; sin cambio de estilos |
| Rutas/stores/services legacy | — | — | pockets, transferencias, terceros, eventos, deudas, reembolsos | Sin delta visual (retiro de código) |

## 7. Evidencia base requerida antes de implementar

Antes de W2 (y por cada bloque afectado) se captura la Web en `c089d88` en viewports fijos desktop y móvil para:

- estado normal con datos;
- estado vacío;
- carga;
- error parcial/total;
- formularios, selectores, diálogos y confirmaciones abiertos;
- navegación y comportamiento responsive.

Cada entrega compara la misma ruta/estado/viewport. Toda diferencia se clasifica como: **necesaria por deprecación**, **necesaria por capacidad M+**, **corrección de defecto aprobada** o **no autorizada**. Una diferencia sin clasificar bloquea el cierre del bloque.

## 8. Checklist de la puerta W0 (por completar)

- [ ] Capturas base desktop/móvil del commit autoritativo `c089d88` (rutas y estados clave).
- [ ] Matriz de impacto de cada bloque (W2–W5) completada **sin cambios de código**.
- [ ] Elementos a conservar, adaptar y retirar identificados de forma verificable.
- [ ] Deltas visuales exactos limitados a necesidades funcionales aprobadas.
- [ ] Confirmado que Android se usa solo como referencia funcional y de datos.
- [ ] Usuario/orquestador aprobó explícitamente la matriz y los deltas antes de implementar.

## 9. Checklist de la puerta W0.5 (por completar por capacidad)

- [ ] Superficie existente conservada declarada.
- [ ] Circuito legado desconectado identificado.
- [ ] Comportamiento M+ resultante y fuente contractual declarados.
- [ ] Prueba esperada definida (emulador/unit/QA).
- [ ] Web online-only confirmada: sin copiar Room, cola, offline ni `adb reverse`.
- [ ] Si la adaptación exige reemplazar una pantalla o flujo completo → bloqueada hasta decisión del orquestador.

## 10. W0.5 — Matriz de paridad del bloque W1 (ejecutada)

W1 es un bloque de fundación: **no toca ninguna superficie visual**. La puerta W0 (capturas base + aprobación de matrices) sigue abierta y sigue bloqueando W2–W5.

| Capacidad | Superficie existente que se conserva | Circuito legado desconectado | Comportamiento M+ resultante | Fuente contractual | Prueba |
|---|---|---|---|---|---|
| Perfil de usuario en Firestore | Ninguna superficie visual: `AuthEntryPage`, shell, sidebar y topbar quedan idénticos | `buildFirestoreUserProfile` legacy (`displayName`, `photoUrl`, `defaultCurrency`, `activeHouseholdId`) y `ensureFirestoreUser` con `merge: true` | `users/{uid}` se crea con los 10 campos del contrato y nada más; la identidad de Google no se persiste aquí | §6.2, §6.3, §3.11 | `firestore-user-profile.test.ts` |
| Identidad compartida | Avatar/nombre de sesión (leídos de Firebase Auth, sin cambio) | — | `buildHouseholdMemberIdentity` produce la forma exigida por `members/{uid}`: nombre ≤100, foto vacía o HTTPS ≤2048, nunca correo | §11.1, §11.2 | `firestore-user-profile.test.ts` |
| Seed Personal | Gestor de categorías existente (sin cambio visual) | — | Seed v1 idempotente de 22 categorías con IDs deterministas; no revierte personalizaciones ni siembra durante `resetting` | §8.3, §17.1 | `mplus-seed-catalog.test.ts`, `mplus-user-bootstrap.test.ts` |
| Contrato de datos | — | Ninguno todavía: `src/types/*` y los servicios legacy siguen en pie hasta que W2/W3 sustituyan a sus consumidores (regla 6 de §5) | Fundación paralela en `src/lib/mplus/`: enums, modelos, convertidores, validadores Zod, rutas, IDs, fecha Bogotá, seeds y cálculos derivados | §4 a §25 | `mplus-contract-serialization.test.ts`, `mplus-validators.test.ts`, `mplus-bogota-date.test.ts`, `mplus-derived-calc.test.ts` |
| Mutaciones remotas | — | — | Ejecutor único con OCC por `revision`; conflicto, reintento idempotente, rechazo y `unavailable` con la misma clasificación que Android; ninguna escritura sobrevive a un conflicto | §4.3, §22, §23 | `mplus-mutation-runner.test.ts` |
| Frontera de sesión | Logout de Ajustes y guard de sesión: mismo flujo, mismo copy | Tres resets sueltos en `settings/page.tsx` | `resetAllStoresForSessionBoundary` limpia los 8 stores; ningún dato del usuario anterior sobrevive | Plan W1 ("limpieza total de stores") | `mplus-session-boundary.test.ts`, `household-p1-1-session-boundary-reset.test.ts` |
| Backend compartido | — | `firestore.indexes.json` de la raíz (manifiesto de `finanzas-m`) | Rules e índices se copian y verifican contra `android/firestore.*`; una copia desactualizada falla en `npm test` | §27.1, §20 | `mplus-canonical-backend.test.ts` |
| Paridad de serialización | — | — | Los 7 fixtures canónicos de Android se contrastan campo por campo con la serialización Web | §28.3 | `mplus-android-fixture-parity.test.ts` |

**Ambiente declarado para W1: EMULATOR.** No se usó QA_REAL, no se escribió en `finanzas-m-plus` y nunca se tocó `finanzas-m`. Ninguna prueba de W1 abre conexión remota.

### 10.1. Checklist W0.5 para W1

- [x] Superficie existente conservada declarada (ninguna superficie visual cambia).
- [x] Circuito legado desconectado identificado (perfil legacy de `users/{uid}`, resets sueltos de logout, manifiesto de índices de `finanzas-m`).
- [x] Comportamiento M+ resultante y fuente contractual declarados (tabla anterior).
- [x] Prueba esperada definida y ejecutada (10 pruebas unitarias nuevas + 1 adaptada).
- [x] Web online-only confirmada: sin Room, sin cola, sin persistencia offline, sin `adb reverse`; un error de red se clasifica como fallo visible.
- [x] No exigió reemplazar ninguna pantalla ni flujo visual → no hubo bloqueo por decisión del orquestador.

### 10.2. Deuda declarada al cerrar W1

1. ~~**Pruebas de emulador del contrato v1**~~ — **cerrado por ORQ-041 / DEC-081 (2026-08-20)**: el modo emulador se retiró por completo de la Web. Ya no existe `tests/emulator/` ni suite de Rules local; el único entorno es el proyecto real `finanzas-m-plus` y las Rules canónicas se prueban en el repositorio Android.
2. **`bootstrapError` sin superficie**: un bootstrap fallido al recargar una sesión viva queda registrado en el store y en consola, pero no pintado. Conectarlo a un banner es trabajo de W2/W4, no de W1 (habría exigido inventar superficie).
3. **Preferencias de tablero por dispositivo**: `fm-board-order`, `fm-board-hidden`, `fm-hide-balances` y `fm-hh-*` viven en `localStorage` sin `uid`. La frontera de sesión reinicia su estado en memoria pero no borra las claves. Volverlas preferencias por usuario es del bloque de Ajustes (W4).
4. ~~**`npm test` no termina solo sin emulador**~~ — **cerrado y corregido por ORQ-041 / DEC-081 (2026-08-20)**. El diagnóstico de W1 atribuía el cuelgue a `expense-occ-parity.test.ts` y `technical-transactions.test.ts`; **era incorrecto**. Ejecutadas de forma aislada, ambas terminan en menos de un segundo y no abren ninguna conexión. La causa real era `src/lib/firebase/client.ts`: esos dos archivos definen `global.window` en el ámbito del proceso, y cualquier módulo posterior de `run-all.ts` que llamara a `getFirebaseDb()` superaba el guard de navegador y ejecutaba `connectFirestoreEmulator("127.0.0.1", 8080)`, dejando al SDK reintentando para siempre. Al retirar el modo emulador y volver perezosa la resolución de ambiente, `npm test` termina solo en ~2,3 s. Las dos pruebas se conservan: no eran las culpables y aportan cobertura real.

---

## Notas

- La numeración `12_` sigue la convención de `docs/` del repo Web (`11_WEB_DEV_LOG.md`, `16_TECH_DEBT_MATRIX.md`, `18_NON_OWN_MONEY_CONTRACT.md`).
- Este documento no sustituye `docs/11_WEB_DEV_LOG.md`; el dev log sigue siendo la memoria operativa de la plataforma.
- El agente Web debe registrar cada entrega en `docs/11_WEB_DEV_LOG.md` conforme a `AGENTS.md`.
