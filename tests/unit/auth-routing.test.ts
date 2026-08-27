import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getAuthRedirectPath } from "@/features/auth/auth-routing";

assert.equal(
  getAuthRedirectPath({ area: "public", status: "authenticated" }),
  "/dashboard",
  "la entrada publica debe mandar al dashboard cuando ya existe sesion"
);

assert.equal(
  getAuthRedirectPath({ area: "public", status: "unauthenticated" }),
  null,
  "la entrada publica no debe redirigir cuando el usuario aun no inicio sesion"
);

assert.equal(
  getAuthRedirectPath({ area: "protected", status: "unauthenticated" }),
  "/",
  "las vistas privadas deben regresar al inicio cuando no hay sesion"
);

assert.equal(
  getAuthRedirectPath({ area: "protected", status: "loading" }),
  null,
  "las vistas privadas no deben redirigir mientras se resuelve la sesion"
);

assert.equal(
  getAuthRedirectPath({ area: "legacy-login", status: "loading" }),
  "/",
  "la ruta legacy de login debe redirigir siempre al inicio"
);

// ─── Acceso con Google: la pantalla no puede quedarse muerta ─────────────────
//
// Fallo real de QA: Chrome bloqueo la comunicacion de vuelta de la ventana
// emergente (COOP) y la promesa de `signInWithPopup` se quedo sin resolver NI
// rechazar. Como los dos botones se deshabilitan con `isSubmitting` y el
// `finally` nunca llego a ejecutarse, la pantalla de acceso quedaba inservible
// hasta recargar. Una promesa que nunca se asienta no se atrapa con `catch`:
// hace falta dejar de esperarla y ofrecer otra via.

const authEntrySource = readFileSync(
  path.resolve(__dirname, "../../src/features/auth/components/auth-entry-page.tsx"),
  "utf-8",
);
const authServiceSource = readFileSync(
  path.resolve(__dirname, "../../src/features/auth/auth-service.ts"),
  "utf-8",
);

assert.ok(
  authEntrySource.includes("Promise.race"),
  "el acceso debe dejar de esperar a la ventana emergente en vez de bloquear la pantalla",
);
assert.ok(
  authEntrySource.includes("POPUP_TIMEOUT_MS"),
  "debe existir un limite explicito de espera de la ventana emergente",
);
assert.ok(
  authEntrySource.includes("setIsSubmitting(false)"),
  "los botones deben volver a habilitarse pase lo que pase",
);

// Y debe existir la salida por redireccion, con su recogida al volver.
assert.ok(
  authServiceSource.includes("signInWithRedirect"),
  "debe existir el acceso por redireccion como alternativa a la ventana emergente",
);
assert.ok(
  authServiceSource.includes("getRedirectResult"),
  "el resultado de la redireccion debe recogerse al volver a la pagina",
);
assert.ok(
  authEntrySource.includes("consumeGoogleRedirectResult"),
  "la pantalla de acceso debe recoger el resultado de la redireccion al montarse",
);
assert.ok(
  authEntrySource.includes("handleRedirectSignIn"),
  "la persona debe poder disparar la via por redireccion",
);

// El bootstrap del contrato no se puede saltar por venir de una redireccion.
assert.ok(
  /consumeGoogleRedirectResult[\s\S]*?ensureContractUser/.test(authServiceSource),
  "la via por redireccion debe confirmar `users/{uid}` igual que la ventana emergente",
);

// ─── El perfil debe existir ANTES de pintar la app ───────────────────────────
//
// Fallo real de QA: tras iniciar sesion, el dashboard aparecia con
// "Error al cargar datos — Missing or insufficient permissions".
//
// `onAuthState` reportaba la sesion y DESPUES corria el bootstrap, para no
// retrasar el pintado en una recarga con sesion viva. Pero las Rules de
// `users/{uid}/accounts` y `users/{uid}/categories` exigen
// `parentUserExists(uid)`: sin `users/{uid}` creado, la PRIMERA lectura del
// dashboard muere. Era inocuo mientras el perfil existiera siempre; desde que
// el reinicio QA lo elimina, el primer login pasa siempre por ese caso.

{
  const bootstrapAt = authServiceSource.indexOf("await ensureContractUser(user.uid)");
  const callbackAt = authServiceSource.indexOf("callback(mapAuthUser(user))");

  assert.ok(bootstrapAt > -1, "el listener de sesion debe preparar la cuenta");
  assert.ok(callbackAt > -1, "el listener de sesion debe reportar la sesion");
  assert.ok(
    bootstrapAt < callbackAt,
    "la cuenta debe quedar creada en el servidor ANTES de reportar la sesion: si no, la primera lectura del dashboard es rechazada",
  );
}

// Y un bootstrap fallido no puede dejar la pestania colgada en 'cargando':
// la sesion se reporta igual y el fallo queda en `bootstrapError`.
assert.ok(
  authServiceSource.includes("setBootstrapError"),
  "un bootstrap fallido debe quedar registrado, no silenciado",
);

console.log("OK auth-routing");
