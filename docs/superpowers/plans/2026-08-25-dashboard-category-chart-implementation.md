# Dashboard Category Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Personal dashboard-card grid with one responsive category bar chart that switches between expenses and income.

**Architecture:** Add a pure adapter in the current Personal view model that limits categories to six plus `Otras`. Render it with a focused native-Tailwind chart component; simplify `MplusHomeView` and remove the obsolete board-edit control from `DashboardShell`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, existing Finance components, Node unit tests.

---

### Task 1: Model chart data

**Files:**
- Modify: `src/features/movements/lib/personal-month-view-model.ts`
- Create: `tests/unit/personal-dashboard-category-chart.test.ts`
- Modify: `tests/unit/run-all.ts`

- [ ] Write failing tests for `buildDashboardCategoryChartData(items)`.
- [ ] Test sorted positive categories, empty input, one category, six categories, seven categories creating `Otras`, exact `Otras` sum, and finite non-negative shares.
- [ ] Implement and export `DashboardCategoryChartItem` with `name`, `amount`, `share`, `color`, `iconKey` and `buildDashboardCategoryChartData`.
- [ ] Retain six largest positive categories; aggregate all remaining positive categories in `Otras` with a neutral canonical color and `other` icon key.
- [ ] Run `npx tsx tests/unit/personal-dashboard-category-chart.test.ts` then `npm test`.
- [ ] Commit: `feat(mplus-web): prepara datos del gráfico por categoría`.

### Task 2: Build the responsive chart

**Files:**
- Create: `src/features/movements/components/personal-category-chart.tsx`
- Modify: `tests/unit/personal-dashboard-category-chart.test.ts`

- [ ] Create `PersonalCategoryChart({ items, mode })`, where `mode` is `"expense" | "income"` and `items` is `readonly DashboardCategoryChartItem[]`.
- [ ] Desktop at `md` and above: vertical bars in a responsive grid; each item visibly shows category name, COP amount, and share.
- [ ] Mobile below `md`: horizontal bars; complete name at left and amount/share at right; do not use `overflow-x-auto` or fixed-width chart surfaces.
- [ ] Use category canonical color; provide a descriptive accessible label per bar with name, COP amount, and share. Use `motion-safe` width/height transitions only.
- [ ] Add source-level tests for desktop/mobile presentations, semantic labels, visible values, and absence of horizontal-scroll utilities.
- [ ] Run `npm test` and commit: `feat(mplus-web): agrega gráfico responsive por categoría`.

### Task 3: Replace the Personal dashboard grid

**Files:**
- Modify: `src/features/movements/components/personal-home-view.tsx`
- Modify: `src/components/layout/dashboard-shell.tsx`
- Modify: `tests/unit/personal-dashboard-category-chart.test.ts`

- [ ] Write assertions that `MplusHomeView` uses `PersonalCategoryChart`, defaults its selector to Gastos, and no longer renders `MPLUS_BOARD_CARDS`, movement preview, account preview, drag/drop or hidden-card UI.
- [ ] Remove the dashboard-board-only state, handlers, preview rendering, and imports from `personal-home-view.tsx`; leave routes and Household untouched.
- [ ] Under the existing monthly flow summary, render one full-width `FinanceCard` only: dynamic title `Gastos por categoría`/`Ingresos por categoría`, dynamic month subtitle, native accessible `Gastos`/`Ingresos` buttons with `aria-pressed`, in-card mode-specific empty state, or `PersonalCategoryChart`.
- [ ] Use `buildDashboardCategoryChartData` on the active existing expense/income breakdown; do not change domain calculations or Firebase.
- [ ] In `dashboard-shell.tsx`, remove only the Personal `Editar tablero` button and its now-unused state/imports. Preserve period, visibility and `Nuevo` actions.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Commit: `feat(mplus-web): simplifica inicio con gráfico único`.

### Task 4: QA and documentation

**Files:**
- Modify: `docs/11_WEB_DEV_LOG.md`

- [ ] Manually inspect `/dashboard` at 320, 390, 768, 1024, and wide desktop for empty, one-category, six-category and seven-plus-category states.
- [ ] Confirm vertical desktop bars, horizontal mobile bars, no horizontal page scroll, switch without route navigation, and no changes to Household, movements or accounts routes.
- [ ] Record files, adapter rule, viewports, commands and any populated-data limitation in `docs/11_WEB_DEV_LOG.md`.
- [ ] Re-run all validation commands, inspect `git status --short --branch`, and commit documentation as `docs(mplus-web): registra gráfico principal del inicio`.
- [ ] Do not push unless explicitly requested.

## Plan self-review

- The plan covers the approved single-card scope, responsive orientation, selector, six-plus-`Otras` rule, empty state, accessibility, removal of board editing, tests, QA and documentation.
- No Firebase, contract, route, Household, or financial-domain behavior is changed.
