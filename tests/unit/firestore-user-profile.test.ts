import assert from "node:assert/strict";

import { buildFirestoreUserProfile } from "../../src/features/auth/firestore-user-profile";

const profile = buildFirestoreUserProfile(
  {
    uid: "user-a",
    email: "private@example.com",
    displayName: "Usuario A",
    photoURL: "https://example.com/a.png",
  },
  "timestamp",
);

assert.deepEqual(profile, {
  uid: "user-a",
  displayName: "Usuario A",
  photoUrl: "https://example.com/a.png",
  createdAt: "timestamp",
  defaultCurrency: "COP",
  activeHouseholdId: null,
});
assert.equal("email" in profile, false);

console.log("OK firestore-user-profile");
