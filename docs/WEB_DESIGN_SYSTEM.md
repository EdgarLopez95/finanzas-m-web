# Web Design System - Finanzas M

## 1. Proposito

Este archivo es el contrato tecnico para construir UI web en Finanzas M sin inventar estilos paralelos.
Toda pantalla nueva debe usar tokens y componentes existentes antes de crear variantes locales.

## 2. Fuentes de verdad

- `src/app/globals.css`: tokens CSS globales, alias semanticos para Tailwind v4 (`@theme inline`), dark mode base y animacion `shimmer`.
- `src/lib/design/tokens.ts`: tokens tipados (colores, spacing, radius, tipografia) para uso en TypeScript.
- `src/components/finance/*`: capa visual oficial de Finanzas M (wrappers y componentes propios).
- `src/components/ui/*`: base de shadcn/ui; no es la capa de identidad final.
- `src/app/design-system/page.tsx`: ruta de preview para validar visualmente tokens y componentes.

## 3. Filosofia visual

- Modo oscuro inicial.
- Estetica premium, legible y calida.
- Cards suaves con radios grandes.
- Jerarquia financiera clara (ingresos, gastos, transferencias, pendientes).
- Diferenciacion visual entre contexto Personal y Hogar.
- Evitar look de dashboard SaaS generico y tambien look de banca tradicional.

## 4. Tokens

Fuente: `src/app/globals.css` + `src/lib/design/tokens.ts`.

### 4.1 Colores de interfaz

`primary`, `ink`, `warmPaper`, `backgroundDark`, `backgroundDeep`, `surfaceDark`, `surfaceDarkAlt`, `heroBase`, `heroSurface`, `heroSurfaceElevated`, `borderDark`, `dividerDark`.

### 4.2 Colores financieros

`income`, `expense`, `transfer`, `pending`, `neutral`.

### 4.3 Colores de entidades

`accountBank`, `accountSavings`, `accountWallet`, `accountCash`.

### 4.4 Spacing

`2, 4, 8, 12, 16, 20, 24, 32, 40` (px).

### 4.5 Radius

`hero`, `headerBottom`, `recentMovementsCard`, `accountCarouselCard`, `cardLarge`, `cardMedium`, `fab`, `button`, `input`, `bottomSheetTop`, `chip`.

### 4.6 Typography

`displayAmount`, `headlineLarge`, `titleLarge`, `bodyLarge`, `bodyMedium`, `labelLarge`, `labelSmall`.

## 5. Componentes oficiales

### `FinanceCard`

- Proposito: contenedor principal para modulos financieros.
- Usar cuando: resumenes, bloques de dashboard, secciones con encabezado.
- No crear alternativa local si solo necesitas card con estilo Finanzas M.
- Variantes: `default`, `elevated`, `hero`, `interactive`.

### `Amount`

- Proposito: mostrar montos COP con formato consistente.
- Usar cuando: cualquier valor monetario visible.
- No crear alternativa local ni formatear moneda manualmente.
- Variantes: `default`, `income`, `expense`, `transfer`, `pending`, `neutral`.
- Sizes: `hero`, `lg`, `md`, `sm`.
- Prefijos oficiales:
  - income: `+ $ 20.000`
  - expense: `- $ 20.000`
  - transfer: `? $ 20.000`
  - pending/default/neutral: `$ 20.000`

### `FinanceButton`

- Proposito: capa Finanzas M sobre `Button` de shadcn.
- Usar cuando: acciones primarias/secundarias/destructivas.
- No crear botones locales con estilos custom si este wrapper cubre el caso.
- Tones: `filled`, `outlined`, `text`, `destructive`.

### `FinanceChip`

- Proposito: badge/capsula para estado, tipo o filtro.
- Usar cuando: estados de transaccion/contexto.
- No crear chips locales para estados ya cubiertos.
- Variantes: `neutral`, `income`, `expense`, `transfer`, `pending`, `household`.

### `FinanceTextField`

- Proposito: input visual oficial con `label`, helper/error text y accesibilidad base.
- Usar cuando: formularios financieros en pantalla.
- No crear input visual paralelo salvo requerimiento de control no soportado.
- Props clave: `label`, `helperText`, `errorText`, `containerClassName` + props nativas de `input`.

### `TransactionTimelineItem`

- Proposito: fila visual reutilizable para movimientos.
- Usar cuando: listados de transacciones recientes/historial.
- No crear otra fila base si la estructura encaja.
- Tipo soportado: `income | expense | transfer | reimbursement | pending`.
- Regla visual: `reimbursement` debe verse neutral/compensacion, no como ingreso o gasto principal.

### `EmptyState`

- Proposito: estados vacios oficiales (sin cuentas, sin movimientos, sin categorias, sin hogar).
- Usar cuando: la pantalla no tiene datos iniciales para renderizar contenido principal.
- No crear bloques vacios paralelos si `EmptyState` cubre el caso.
- Props: `title`, `description`.

### `FinanceShimmer`

- Proposito: skeleton de carga reutilizable.
- Usar cuando: placeholders de cards/listas durante carga.
- No crear animaciones `animate-pulse` ad-hoc para los mismos casos.

## 6. Relacion con shadcn/ui

- `src/components/ui` contiene primitives de shadcn.
- `src/components/finance` es la capa de identidad Finanzas M.
- Regla: si existe wrapper `finance` equivalente, usarlo antes de usar `ui` directo.
- Usar `ui` directo solo cuando no exista wrapper oficial para ese patron.

## 7. Reglas obligatorias para nuevas pantallas

- No hardcodear colores fuera de tokens salvo excepcion justificada.
- No crear cards locales si `FinanceCard` cubre el caso.
- No crear botones locales si `FinanceButton` cubre el caso.
- No formatear montos manualmente si `Amount` cubre el caso.
- No crear chips locales si `FinanceChip` cubre el caso.
- Mantener montos en COP sin decimales.
- Mantener diferenciacion visual Personal/Hogar.
- Mantener accesibilidad base (`label`, `aria-*`, foco visible) y responsive.

## 8. Ruta de preview

- Ruta: `/design-system`.
- Debe mostrar paleta, cards, buttons, chips, inputs, amounts, timeline, empty state y shimmer.
- Se usa para validar cambios visuales antes de construir features.

## 9. Checklist antes de cerrar una tarea UI

- Usa tokens del sistema.
- Usa componentes `finance/*` cuando existan.
- No hardcodea colores innecesarios.
- Se valida visualmente en `/design-system` o pantalla afectada.
- `npm run lint` OK.
- `npm run build` OK.