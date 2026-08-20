import assert from "node:assert/strict";

import {
  DEFAULT_MEMBER_DISPLAY_NAME,
  buildHouseholdMemberIdentity,
} from "../../src/features/auth/firestore-user-profile";
import { buildInitialUserProfile } from "../../src/lib/mplus/user-bootstrap";
import { userProfileToFirestore } from "../../src/lib/mplus/converters";
import { mplusValidators } from "../../src/lib/mplus/schemas";

/**
 * Perfil minimo del contrato v1 (§6) e identidad compartida (§11).
 *
 * Antes, el login escribia un perfil legacy en `users/{uid}` con
 * `displayName`, `photoUrl`, `defaultCurrency` y `activeHouseholdId`. El
 * contrato v1 fija exactamente que campos admite ese documento y prohibe
 * cualquier extra; la identidad de Google solo se publica dentro de la
 * membresia del Hogar.
 */

// --- identidad compartida (contrato §11.1) ---
{
  const identity = buildHouseholdMemberIdentity({
    uid: "user-a",
    email: "private@example.com",
    displayName: "  Usuario A  ",
    photoURL: "https://example.com/a.png",
  });

  assert.deepEqual(identity, {
    displayName: "Usuario A",
    photoUrl: "https://example.com/a.png",
  });
  assert.equal("email" in identity, false, "el correo nunca se copia a Firestore (contrato §3.11)");
}

// Sin nombre de Google: se usa el nombre por defecto, nunca una cadena vacia.
assert.deepEqual(buildHouseholdMemberIdentity({ uid: "u", displayName: null, photoURL: null }), {
  displayName: DEFAULT_MEMBER_DISPLAY_NAME,
  photoUrl: "",
});
assert.deepEqual(buildHouseholdMemberIdentity({ uid: "u", displayName: "   ", photoURL: "" }), {
  displayName: DEFAULT_MEMBER_DISPLAY_NAME,
  photoUrl: "",
});

// Foto no HTTPS: se descarta, no se "arregla" (las Rules exigen HTTPS).
assert.equal(
  buildHouseholdMemberIdentity({ uid: "u", displayName: "A", photoURL: "http://x/a.png" }).photoUrl,
  "",
);
assert.equal(
  buildHouseholdMemberIdentity({ uid: "u", displayName: "A", photoURL: "data:image/png;base64,AA" })
    .photoUrl,
  "",
);

// Limites del contrato: nombre <= 100, URL <= 2048.
assert.equal(
  buildHouseholdMemberIdentity({ uid: "u", displayName: "x".repeat(150), photoURL: null })
    .displayName.length,
  100,
);
assert.equal(
  buildHouseholdMemberIdentity({
    uid: "u",
    displayName: "A",
    photoURL: `https://example.com/${"x".repeat(2100)}`,
  }).photoUrl,
  "",
);

// --- perfil operativo (contrato §6) ---
{
  const profile = buildInitialUserProfile(
    "user-a",
    1_700_000_000_000,
    "11111111-1111-4111-8111-111111111111",
  );

  // Estado inicial exigido por `validUserCreate` en las Rules canonicas.
  assert.equal(profile.status, "ready");
  assert.equal(profile.householdId, null);
  assert.equal(profile.householdMembershipState, "none");
  assert.equal(profile.personalCatalogVersion, 1);
  assert.equal(profile.revision, 1);
  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.resetRequestedAtMillis, null);

  // Pasa el validador de contrato y no filtra identidad ni campos legacy.
  mplusValidators.user(profile);
  const wire = userProfileToFirestore(profile);
  for (const forbidden of [
    "email",
    "displayName",
    "photoUrl",
    "defaultCurrency",
    "activeHouseholdId",
    "uid",
  ]) {
    assert.equal(forbidden in wire, false, `users/{uid} no admite '${forbidden}' (contrato §6.2/§6.3)`);
  }
}

console.log("OK firestore-user-profile");
