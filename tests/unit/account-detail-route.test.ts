import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveActiveNavHref, personalNavigationItems, householdNavigationItems } from "@/components/layout/navigation";
import { resolveContextForPath, resolveContextRedirection } from "@/lib/navigation/app-context";

console.log("Running unit tests for account-detail-route.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");
const exists = (rel: string): boolean => fs.existsSync(path.resolve(repoRoot, "src", rel));

/**
 * El detalle de cuenta sigue siendo una RUTA, no un modal (contrato de
 * navegacion de la Web base).
 *
 * Adaptado en W2: el detalle pasa a `MplusAccountDetailView` y pierde lo que el
 * contrato v1 retira (saldo, bolsillos, ajuste de saldo, cierre/reapertura y
 * eliminacion en cascada). Lo que esta prueba sigue protegiendo es lo que NO
 * cambia: que la ruta exista, que se llegue a ella desde la lista, que
 * "cargando" y "no existe" sigan siendo estados distintos, y que el contexto y
 * el item activo del sidebar se comporten igual.
 */
export function runAccountDetailRouteTests() {
  let checks = 0;

  // 1. La ruta existe y es una page real, no un modal montado desde la lista.
  assert.ok(
    exists("app/(dashboard)/accounts/[accountId]/page.tsx"),
    "debe existir la pantalla /accounts/[accountId]",
  );
  const page = readSrc("app/(dashboard)/accounts/[accountId]/page.tsx");
  assert.match(
    page,
    /<MplusAccountDetailView/,
    "la page debe renderizar el detalle del contrato v1",
  );
  checks += 2;

  // 1b. "Cargando" y "no existe" son estados distintos: el copy de not-found
  // solo puede emitirse cuando la lista de cuentas ya está resuelta.
  assert.match(
    page,
    /if \(!account && status !== "success"\)[\s\S]{0,400}Cargando cuenta/,
    "sin datos resueltos debe mostrarse un estado de carga, no 'no encontramos esta cuenta'",
  );
  assert.ok(
    page.indexOf("Cargando cuenta") < page.indexOf("No encontramos esta cuenta"),
    "la guarda de carga debe evaluarse ANTES del empty de not-found",
  );
  checks += 2;

  // 2. La lista navega por URL al detalle, tanto en activas como en archivadas.
  const accountsView = readSrc("features/accounts/components/mplus-accounts-view.tsx");
  const pushes = accountsView.match(/router\.push\(`\/accounts\/\$\{account\.id\}`\)/g) ?? [];
  assert.ok(
    pushes.length >= 2,
    `tanto la card de cuenta como la fila archivada deben navegar al detalle (encontrados: ${pushes.length})`,
  );
  checks += 1;

  // 2b. Capacidades retiradas por el contrato v1: no pueden reaparecer ni en la
  // lista ni en el detalle. Se buscan IDENTIFICADORES, no prosa: los
  // comentarios de ambos archivos nombran a proposito lo que se retiro.
  const detail = readSrc("features/accounts/components/mplus-account-detail-view.tsx");
  for (const [surface, source] of [
    ["la lista", accountsView],
    ["el detalle", detail],
  ] as const) {
    for (const retired of [
      "PocketDetailDialog",
      "AccountPocketCard",
      "adjustAccountBalance",
      "calculateAccountPhysicalBalances",
      "deletePersonalEntityCascade",
    ]) {
      assert.ok(
        !source.includes(retired),
        `${surface} no puede reintroducir '${retired}': el contrato v1 lo retiro`,
      );
    }
  }
  checks += 10;

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

  // 5. La edición sigue siendo un modal dentro del detalle, no otra pantalla.
  assert.match(detail, /<MplusAccountDialog/, "editar la cuenta se resuelve en un modal del detalle");
  checks += 1;

  console.log(`  ✓ Detalle de cuenta como ruta /accounts/[accountId] verificado (${checks} aserciones pasadas).`);
}

runAccountDetailRouteTests();
