import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveActiveNavHref, personalNavigationItems, householdNavigationItems } from "@/components/layout/navigation";
import { resolveContextForPath, resolveContextRedirection } from "@/lib/navigation/app-context";

console.log("Running unit tests for account-detail-route.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");
const exists = (rel: string): boolean => fs.existsSync(path.resolve(repoRoot, "src", rel));

export function runAccountDetailRouteTests() {
  let checks = 0;

  // 1. La ruta existe y es una page real, no un modal montado desde la lista.
  assert.ok(
    exists("app/(dashboard)/accounts/[accountId]/page.tsx"),
    "debe existir la pantalla /accounts/[accountId]",
  );
  const page = readSrc("app/(dashboard)/accounts/[accountId]/page.tsx");
  assert.match(page, /<AccountDetailView/, "la page debe renderizar AccountDetailView");
  assert.match(
    page,
    /router\.replace\("\/accounts"\)/,
    "tras eliminar la cuenta la URL no puede quedar huérfana",
  );
  checks += 3;

  // 1b. "Cargando" y "no existe" son estados distintos: el copy de not-found
  // solo puede emitirse cuando la lista de cuentas ya está resuelta.
  assert.match(
    page,
    /const accountsResolved = personalData\.status === "success";/,
    "el not-found debe depender de que la carga personal haya resuelto",
  );
  assert.match(
    page,
    /if \(!account && !accountsResolved\)[\s\S]{0,400}Cargando cuenta/,
    "sin datos resueltos debe mostrarse un estado de carga, no 'no encontramos esta cuenta'",
  );
  assert.ok(
    page.indexOf("Cargando cuenta") < page.indexOf("No encontramos esta cuenta"),
    "la guarda de carga debe evaluarse ANTES del empty de not-found",
  );
  checks += 3;

  // 2. La lista ya no monta el detalle como overlay: navega por URL.
  const views = readSrc("features/dashboard/components/personal-views.tsx");
  assert.doesNotMatch(views, /AccountDetailDialog/, "el detalle ya no puede montarse como diálogo desde la lista");
  assert.doesNotMatch(views, /selectedAccountForDetail/, "la lista ya no guarda estado de detalle abierto");
  const pushes = views.match(/router\.push\(`\/accounts\/\$\{account\.id\}`\)/g) ?? [];
  assert.ok(
    pushes.length >= 2,
    `tanto la card de cuenta como la fila de cuenta cerrada deben navegar al detalle (encontrados: ${pushes.length})`,
  );
  checks += 3;

  // 3. Contexto: la sub-ruta sigue siendo exclusiva de Personal y, desde Hogar,
  // se sigue redirigiendo igual que /accounts.
  assert.equal(resolveContextForPath("/accounts/abc123"), "personal", "/accounts/{id} es exclusiva de Personal");
  assert.equal(
    resolveContextRedirection({ pathname: "/accounts/abc123", context: "household" }).replaceHref,
    "/household",
    "desde contexto Hogar, la sub-ruta de Cuentas redirige igual que /accounts",
  );
  assert.equal(
    resolveContextRedirection({ pathname: "/accounts/abc123", context: "personal" }).shouldRedirect,
    false,
    "en contexto Personal la sub-ruta se renderiza sin redirección",
  );
  checks += 3;

  // 4. Sidebar: la sub-ruta mantiene "Cuentas" activo, y el match por prefijo
  // no rompe Hogar (gana siempre el href más específico).
  assert.equal(
    resolveActiveNavHref("/accounts/abc123", personalNavigationItems),
    "/accounts",
    "en el detalle de cuenta debe seguir activo el ítem Cuentas",
  );
  assert.equal(resolveActiveNavHref("/accounts", personalNavigationItems), "/accounts");
  assert.equal(
    resolveActiveNavHref("/household/settings", householdNavigationItems),
    "/household/settings",
    "en Hogar gana el ítem más específico, no /household",
  );
  assert.equal(resolveActiveNavHref("/household", householdNavigationItems), "/household");
  assert.equal(
    resolveActiveNavHref("/design-system", personalNavigationItems),
    null,
    "una ruta fuera del menú no marca ningún ítem",
  );
  assert.equal(
    resolveActiveNavHref("/accounts-otro", personalNavigationItems),
    null,
    "el prefijo exige barra: /accounts-otro no es sub-ruta de /accounts",
  );
  checks += 6;

  // 5. Los diálogos pequeños siguen siendo modales dentro del detalle.
  const detail = readSrc("features/accounts/components/account-detail-view.tsx");
  for (const dialog of ["EditAccountDialog", "EditPocketDialog", "FinanceDialog"]) {
    assert.ok(detail.includes(dialog), `${dialog} debe seguir montándose como modal dentro del detalle`);
  }
  checks += 3;

  // 6. Los bolsillos del rail abren su detalle (mismo flujo que la lista de
  // Cuentas) en lugar de exponer iconos de acción al hover: mover / editar /
  // eliminar viven ahora en un único sitio, `PocketDetailDialog`.
  assert.match(detail, /<PocketDetailDialog/, "el detalle de cuenta debe montar el detalle de bolsillo");
  assert.match(
    detail,
    /onClick=\{\(\) => setSelectedPocketId\(pocket\.id\)\}/,
    "la fila de bolsillo debe abrir su detalle al click",
  );
  assert.doesNotMatch(
    detail,
    /aria-label=\{`Mover dinero del bolsillo/,
    "las acciones al hover del bolsillo se movieron al detalle: no deben duplicarse en la fila",
  );
  assert.doesNotMatch(
    detail,
    /aria-label=\{`Eliminar el bolsillo/,
    "eliminar bolsillo ya no es una acción de la fila",
  );
  checks += 4;

  console.log(`  ✓ Detalle de cuenta como ruta /accounts/[accountId] verificado (${checks} aserciones pasadas).`);
}

runAccountDetailRouteTests();
