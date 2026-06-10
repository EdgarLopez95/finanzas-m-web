import assert from "node:assert/strict";

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

console.log("OK auth-routing");
