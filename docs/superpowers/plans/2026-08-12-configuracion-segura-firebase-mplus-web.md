# Configuración segura Firebase M+ Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que Finanzas M+ Web use Emulator Suite por defecto y solo pueda conectarse explícitamente al proyecto real `finanzas-m-plus`, sin correo en Firestore ni caché offline persistente.

**Architecture:** Una política pura resuelve `EMULATOR` o `QA_REAL` y entrega la única configuración permitida. El cliente Firebase consume esa política, usa una app nombrada, conecta emuladores sin fallback y conserva Firestore en memoria. Un lanzador Node carga el archivo QA ignorado únicamente para comandos explícitos.

**Tech Stack:** Next.js 15, TypeScript, Firebase Web SDK 12, Node.js, TSX, Emulator Suite.

---

## Estructura de archivos

- Crear `src/lib/firebase/environment.ts`: política pura de ambiente, proyectos permitidos y configuración efectiva.
- Modificar `src/lib/firebase/client.ts`: inicialización nombrada, conexión a emuladores y Firestore online-only.
- Crear `src/features/auth/firestore-user-profile.ts`: constructor puro del perfil remoto sin correo.
- Modificar `src/features/auth/auth-service.ts` y `types.ts`: usar el perfil permitido y conservar email solo en memoria Auth.
- Crear `scripts/run-firebase-environment.mjs`: lanzador explícito para emulador y QA real.
- Modificar `package.json`: comandos `dev`, `dev:qa`, `build` y `build:qa`.
- Modificar `.gitignore` y `.env.local.example`: plantilla versionada y archivo QA real ignorado.
- Crear tests unitarios de política, perfil y contrato online-only; registrarlos en `tests/unit/run-all.ts`.
- Actualizar `docs/11_WEB_DEV_LOG.md`; al cerrar, retirar los dos documentos transitorios de `docs/superpowers/`.

### Task 1: Política fail-closed de ambientes Firebase

**Files:**
- Create: `tests/unit/firebase-environment-policy.test.ts`
- Modify: `tests/unit/run-all.ts`
- Create: `src/lib/firebase/environment.ts`

- [ ] **Step 1: Write the failing test**

Crear un test de ejecución directa con `node:assert/strict`:

```ts
import assert from "node:assert/strict";
import { resolveFirebaseEnvironment } from "../../src/lib/firebase/environment";

const emulator = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
});
assert.equal(emulator.runtime, "EMULATOR");
assert.equal(emulator.useEmulators, true);
assert.equal(emulator.config.projectId, "demo-finanzas-m-plus");

const qa = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
  NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m-plus.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:test",
});
assert.equal(qa.runtime, "QA_REAL");
assert.equal(qa.useEmulators, false);
assert.equal(qa.config.projectId, "finanzas-m-plus");

assert.throws(
  () => resolveFirebaseEnvironment({
    NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
    NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "otro-proyecto.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:test",
  }),
  /finanzas-m-plus/,
);

assert.throws(
  () => resolveFirebaseEnvironment({
    NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
    NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "826697479572",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:826697479572:web:test",
  }),
  /finanzas-m-plus/,
);
assert.throws(
  () => resolveFirebaseEnvironment({ NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL" }),
  /incompleta/,
);
assert.throws(
  () => resolveFirebaseEnvironment({ NEXT_PUBLIC_FIREBASE_RUNTIME: "PROD" }),
  /EMULATOR.*QA_REAL/,
);

console.log("OK firebase-environment-policy");
```

Agregar `import "./firebase-environment-policy.test";` a `tests/unit/run-all.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/firebase-environment-policy.test.ts`

Expected: FAIL porque `src/lib/firebase/environment.ts` no existe.

- [ ] **Step 3: Write minimal implementation**

Crear `environment.ts` con:

```ts
export type FirebaseRuntime = "EMULATOR" | "QA_REAL";
type PublicEnvironment = Record<string, string | undefined>;

export type FirebaseClientEnvironment = {
  runtime: FirebaseRuntime;
  useEmulators: boolean;
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
};

const emulatorConfig = {
  apiKey: "demo-key",
  authDomain: "demo-finanzas-m-plus.firebaseapp.com",
  projectId: "demo-finanzas-m-plus",
  storageBucket: "demo-finanzas-m-plus.appspot.com",
  messagingSenderId: "demo-sender",
  appId: "demo-finanzas-m-plus-web",
};

export function resolveFirebaseEnvironment(env: PublicEnvironment): FirebaseClientEnvironment {
  const rawRuntime = env.NEXT_PUBLIC_FIREBASE_RUNTIME ?? "EMULATOR";
  if (rawRuntime !== "EMULATOR" && rawRuntime !== "QA_REAL") {
    throw new Error("Firebase runtime inválido. Usa EMULATOR o QA_REAL.");
  }
  if (rawRuntime === "EMULATOR") {
    return { runtime: "EMULATOR", useEmulators: true, config: emulatorConfig };
  }

  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  if (Object.values(config).some((value) => !value)) {
    throw new Error("Configuración QA_REAL incompleta.");
  }
  const belongsToMPlus =
    config.projectId === "finanzas-m-plus" &&
    config.authDomain === "finanzas-m-plus.firebaseapp.com" &&
    config.storageBucket === "finanzas-m-plus.firebasestorage.app" &&
    config.messagingSenderId === "608498270578" &&
    config.appId.startsWith("1:608498270578:web:");
  if (!belongsToMPlus) {
    throw new Error("QA_REAL solo admite el proyecto finanzas-m-plus.");
  }
  return { runtime: "QA_REAL", useEmulators: false, config };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/firebase-environment-policy.test.ts`

Expected: `OK firebase-environment-policy`.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/firebase/environment.ts tests/unit/firebase-environment-policy.test.ts tests/unit/run-all.ts
git commit -m "test(firebase): proteger ambientes Web M Plus"
```

### Task 2: Inicialización Firebase segura y Web online-only

**Files:**
- Create: `tests/unit/firebase-client-safety-contract.test.ts`
- Modify: `tests/unit/run-all.ts`
- Modify: `src/lib/firebase/client.ts`

- [ ] **Step 1: Write the failing structural test**

El test debe leer el código productivo y exigir el contrato observable:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/firebase/client.ts", "utf8");
assert.match(source, /resolveFirebaseEnvironment/);
assert.match(source, /connectAuthEmulator/);
assert.match(source, /connectFirestoreEmulator/);
assert.doesNotMatch(source, /persistentLocalCache|persistentMultipleTabManager|initializeFirestore/);
console.log("OK firebase-client-safety-contract");
```

Agregar su import a `run-all.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/firebase-client-safety-contract.test.ts`

Expected: FAIL porque el cliente aún usa caché persistente y no conecta emuladores.

- [ ] **Step 3: Implement minimal secure client**

Reemplazar `src/lib/firebase/client.ts` por una inicialización nombrada. Las referencias `process.env.NEXT_PUBLIC_*` deben permanecer literales para que Next.js pueda insertarlas en el bundle del navegador:

```ts
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { resolveFirebaseEnvironment } from "./environment";

const FIREBASE_APP_NAME = "finanzas-m-plus-web";
const environment = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_RUNTIME: process.env.NEXT_PUBLIC_FIREBASE_RUNTIME,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

type EmulatorConnectionState = {
  auth: Set<string>;
  firestore: Set<string>;
};

type FirebaseGlobal = typeof globalThis & {
  __finanzasMPlusFirebaseEmulators?: EmulatorConnectionState;
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

const assertBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("Firebase client is only available in the browser.");
  }
};

const getEmulatorConnectionState = (): EmulatorConnectionState => {
  const firebaseGlobal = globalThis as FirebaseGlobal;
  firebaseGlobal.__finanzasMPlusFirebaseEmulators ??= {
    auth: new Set<string>(),
    firestore: new Set<string>(),
  };
  return firebaseGlobal.__finanzasMPlusFirebaseEmulators;
};

const getAppInstance = (): FirebaseApp => {
  assertBrowser();
  if (cachedApp) return cachedApp;

  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existingApp) {
    if (existingApp.options.projectId !== environment.config.projectId) {
      throw new Error("La app Firebase M+ ya existe con otro proyecto. Reinicia el proceso.");
    }
    cachedApp = existingApp;
    return cachedApp;
  }

  cachedApp = initializeApp(environment.config, FIREBASE_APP_NAME);
  return cachedApp;
};

export const getFirebaseAuth = (): Auth => {
  if (cachedAuth) return cachedAuth;
  const app = getAppInstance();
  cachedAuth = getAuth(app);
  if (environment.useEmulators) {
    const key = `${app.name}:${environment.config.projectId}`;
    const state = getEmulatorConnectionState();
    if (!state.auth.has(key)) {
      connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099", { disableWarnings: true });
      state.auth.add(key);
    }
  }
  return cachedAuth;
};

export const getFirebaseDb = (): Firestore => {
  if (cachedDb) return cachedDb;
  const app = getAppInstance();
  cachedDb = getFirestore(app);
  if (environment.useEmulators) {
    const key = `${app.name}:${environment.config.projectId}`;
    const state = getEmulatorConnectionState();
    if (!state.firestore.has(key)) {
      connectFirestoreEmulator(cachedDb, "127.0.0.1", 8080);
      state.firestore.add(key);
    }
  }
  return cachedDb;
};

export const getGoogleProvider = (): GoogleAuthProvider => {
  cachedProvider ??= new GoogleAuthProvider();
  return cachedProvider;
};

export const getFirebaseRuntime = () => environment.runtime;
export const isFirebaseConfigured = (): boolean => true;
```

La resolución del módulo ya es fail-closed: una configuración inválida lanza error antes de que `isFirebaseConfigured()` pueda devolver `true`.

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
npx tsx tests/unit/firebase-client-safety-contract.test.ts
npm test
```

Expected: ambos PASS; los errores simulados existentes pueden aparecer en consola, pero el proceso termina con código 0.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/firebase/client.ts tests/unit/firebase-client-safety-contract.test.ts tests/unit/run-all.ts
git commit -m "feat(firebase): aislar runtime Web M Plus"
```

### Task 3: Perfil Firestore sin correo

**Files:**
- Create: `tests/unit/firestore-user-profile.test.ts`
- Modify: `tests/unit/run-all.ts`
- Create: `src/features/auth/firestore-user-profile.ts`
- Modify: `src/features/auth/auth-service.ts`
- Modify: `src/features/auth/types.ts`

- [ ] **Step 1: Write the failing behavior test**

```ts
import assert from "node:assert/strict";
import { buildFirestoreUserProfile } from "../../src/features/auth/firestore-user-profile";

const profile = buildFirestoreUserProfile({
  uid: "user-a",
  email: "private@example.com",
  displayName: "Usuario A",
  photoURL: "https://example.com/a.png",
}, "timestamp");

assert.equal(profile.uid, "user-a");
assert.equal(profile.displayName, "Usuario A");
assert.equal("email" in profile, false);
console.log("OK firestore-user-profile");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/firestore-user-profile.test.ts`

Expected: FAIL porque el constructor no existe.

- [ ] **Step 3: Implement profile builder and integrate it**

Eliminar `email` únicamente de `FirestoreUser` en `types.ts`; `AuthUser.email` permanece porque pertenece a la sesión local de Firebase Auth. Crear `firestore-user-profile.ts` con:

```ts
export type FirestoreUser = {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  createdAt: unknown;
  defaultCurrency: "COP";
  activeHouseholdId: string | null;
};
```

```ts
import type { FirestoreUser } from "./types";

type FirebaseProfileSource = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export const buildFirestoreUserProfile = (
  user: FirebaseProfileSource,
  createdAt: unknown,
): FirestoreUser => ({
  uid: user.uid,
  displayName: user.displayName ?? "Usuario Finanzas M+",
  photoUrl: user.photoURL ?? null,
  createdAt,
  defaultCurrency: "COP",
  activeHouseholdId: null,
});
```

Importar con `import { buildFirestoreUserProfile } from "./firestore-user-profile";`, retirar el import de tipo `FirestoreUser` que quede sin uso y, dentro de `ensureFirestoreUser`, sustituir todo el payload inline por:

```ts
const payload = buildFirestoreUserProfile(user, serverTimestamp());
```

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
npx tsx tests/unit/firestore-user-profile.test.ts
npm test
```

Expected: PASS y ninguna escritura de perfil contiene `email`.

- [ ] **Step 5: Commit**

```powershell
git add src/features/auth/firestore-user-profile.ts src/features/auth/auth-service.ts src/features/auth/types.ts tests/unit/firestore-user-profile.test.ts tests/unit/run-all.ts
git commit -m "fix(auth): excluir correo del perfil Firestore M Plus"
```

### Task 4: Comandos explícitos y archivos de ambiente

**Files:**
- Create: `scripts/run-firebase-environment.mjs`
- Inspect only: `scripts/dev-watch.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.env.local.example`
- Local move: `.env.local` → `.env.qa-real.local`
- Create: `tests/unit/firebase-command-contract.test.ts`
- Modify: `tests/unit/run-all.ts`

- [ ] **Step 1: Write the failing command contract test**

Crear `tests/unit/firebase-command-contract.test.ts` con:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const gitignore = fs.readFileSync(".gitignore", "utf8");
const runner = fs.readFileSync("scripts/run-firebase-environment.mjs", "utf8");

assert.match(pkg.scripts.dev, /EMULATOR/);
assert.match(pkg.scripts["dev:qa"], /QA_REAL/);
assert.match(pkg.scripts.build, /EMULATOR/);
assert.match(pkg.scripts["build:qa"], /QA_REAL/);
assert.match(gitignore, /!\.env\.local\.example/);
assert.match(runner, /\.env\.qa-real\.local/);
assert.match(runner, /delete childEnv\[key\]/);
console.log("OK firebase-command-contract");
```

Agregar `import "./firebase-command-contract.test";` a `tests/unit/run-all.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/firebase-command-contract.test.ts`

Expected: FAIL porque los comandos y el lanzador aún no existen.

- [ ] **Step 3: Implement the runner**

Crear `scripts/run-firebase-environment.mjs` con el siguiente contenido. En `EMULATOR` elimina las seis variables reales heredadas para que tampoco queden incrustadas en el bundle:

```js
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [runtime, target, ...targetArgs] = process.argv.slice(2);
const allowedRuntimes = new Set(["EMULATOR", "QA_REAL"]);
const allowedTargets = new Set(["watch", "next"]);
const firebaseKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

if (!allowedRuntimes.has(runtime) || !allowedTargets.has(target)) {
  console.error("Uso: run-firebase-environment.mjs EMULATOR|QA_REAL watch|next [...args]");
  process.exit(1);
}

const parseEnvFile = (contents) => {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Línea inválida en el archivo de ambiente QA.");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

const childEnv = { ...process.env, NEXT_PUBLIC_FIREBASE_RUNTIME: runtime };
if (runtime === "EMULATOR") {
  for (const key of firebaseKeys) delete childEnv[key];
} else {
  const qaPath = path.resolve(".env.qa-real.local");
  if (!fs.existsSync(qaPath)) {
    throw new Error("Falta .env.qa-real.local para ejecutar QA_REAL.");
  }
  const qaValues = parseEnvFile(fs.readFileSync(qaPath, "utf8"));
  const missing = firebaseKeys.filter((key) => !qaValues[key]);
  if (missing.length > 0) {
    throw new Error(`Configuración QA_REAL incompleta: ${missing.join(", ")}`);
  }
  for (const key of firebaseKeys) childEnv[key] = qaValues[key];
}

const script = target === "watch"
  ? path.resolve("scripts/dev-watch.mjs")
  : path.resolve("node_modules/next/dist/bin/next");
const args = target === "watch" ? [script] : [script, ...targetArgs];
const child = spawn(process.execPath, args, { stdio: "inherit", env: childEnv });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
```

`scripts/dev-watch.mjs` ya hereda `process.env`; no modificarlo si la verificación confirma ese comportamiento.

Actualizar scripts:

```json
{
  "dev": "node scripts/run-firebase-environment.mjs EMULATOR watch",
  "dev:qa": "node scripts/run-firebase-environment.mjs QA_REAL watch",
  "dev:watch": "node scripts/run-firebase-environment.mjs EMULATOR watch",
  "dev:turbo": "node scripts/run-firebase-environment.mjs EMULATOR next dev --turbopack",
  "build": "node scripts/run-firebase-environment.mjs EMULATOR next build",
  "build:qa": "node scripts/run-firebase-environment.mjs QA_REAL next build"
}
```

En `.gitignore`, conservar `.env*` y añadir `!.env.local.example`. Reemplazar la plantilla por:

```dotenv
NEXT_PUBLIC_FIREBASE_RUNTIME=QA_REAL
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=finanzas-m-plus.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=finanzas-m-plus
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=finanzas-m-plus.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Verificar la ruta exacta y mover localmente `.env.local` a `.env.qa-real.local`; no borrar ni imprimir su contenido.

- [ ] **Step 4: Verify command contract and ignore behavior**

Run:

```powershell
npx tsx tests/unit/firebase-command-contract.test.ts
git check-ignore -q .env.qa-real.local
if ($LASTEXITCODE -ne 0) { throw '.env.qa-real.local debe estar ignorado' }
git check-ignore .env.local.example
```

Expected: test PASS; QA local ignorado; la plantilla no aparece como ignorada y puede añadirse a Git.

- [ ] **Step 5: Commit**

```powershell
git add .gitignore .env.local.example package.json scripts/run-firebase-environment.mjs tests/unit/firebase-command-contract.test.ts tests/unit/run-all.ts
git commit -m "chore(firebase): hacer explícito el ambiente Web"
```

### Task 5: Verificación integral y QA real sin escrituras

**Files:**
- Modify only if a failure requires a scoped fix: files from Tasks 1–4

- [ ] **Step 1: Run static verification**

```powershell
git diff --check
rg -n "persistentLocalCache|persistentMultipleTabManager|initializeFirestore" src/lib/firebase
rg -n "email:" src/features/auth/auth-service.ts src/features/auth/firestore-user-profile.ts
```

Expected: `git diff --check` limpio; los dos `rg` no encuentran contratos prohibidos.

- [ ] **Step 2: Run complete tests and lint**

```powershell
npm run lint
npm test
```

Expected: exit code 0. La advertencia preexistente de `<img>` puede mantenerse registrada; no forma parte de este bloque.

- [ ] **Step 3: Build safe emulator target**

Ejecutar el build y comprobar, sin imprimir valores, que las identificaciones únicas de la app real no quedaron embebidas:

```powershell
npm run build
$artifactFiles = Get-ChildItem .next -Recurse -File -Include *.js,*.json,*.html
function Test-BuildContains([string]$needle) {
  if (-not $needle) { return $false }
  return [bool]($artifactFiles | Select-String -SimpleMatch -Pattern $needle -Quiet)
}
$qa = @{}
Get-Content .env.qa-real.local | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $qa[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
if (-not (Test-BuildContains 'demo-finanzas-m-plus')) { throw 'El build no contiene el proyecto demo M+.' }
foreach ($key in @('NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_APP_ID')) {
  if (Test-BuildContains $qa[$key]) { throw "El build EMULATOR contiene un valor QA real: $key" }
}
```

Expected: build exitoso, proyecto demo presente y ningún valor QA real detectado.

- [ ] **Step 4: Build explicit QA target**

```powershell
npm run build:qa
$artifactFiles = Get-ChildItem .next -Recurse -File -Include *.js,*.json,*.html
function Test-BuildContains([string]$needle) {
  if (-not $needle) { return $false }
  return [bool]($artifactFiles | Select-String -SimpleMatch -Pattern $needle -Quiet)
}
$qa = @{}
Get-Content .env.qa-real.local | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $qa[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
foreach ($key in @('NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_APP_ID')) {
  if (-not (Test-BuildContains $qa[$key])) { throw "El build QA no contiene el valor esperado: $key" }
}
if (Test-BuildContains 'finanzas-m.firebaseapp.com') { throw 'El build QA contiene configuración de Finanzas M normal.' }
```

Expected: build exitoso, valores M+ presentes y ninguna configuración de Finanzas M normal.

- [ ] **Step 5: Verify remote registration read-only**

Usar Firebase CLI en modo lectura y capturar su JSON para no imprimir configuración. El script solo muestra booleanos y falla si algo difiere:

```powershell
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'
$appsResponse = (firebase apps:list WEB --project finanzas-m-plus --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar las apps Firebase.' }
$webApp = $appsResponse.result | Where-Object { $_.displayName -eq 'Finanzas M+ Web' } | Select-Object -First 1
if (-not $webApp) { throw 'No existe la app registrada Finanzas M+ Web.' }

$sdkResponse = (firebase apps:sdkconfig WEB $webApp.appId --project finanzas-m-plus --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el SDK Web.' }
$remote = $sdkResponse.result.sdkConfig
$qa = @{}
Get-Content .env.qa-real.local | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $qa[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
$sdkMatches =
  $remote.apiKey -eq $qa.NEXT_PUBLIC_FIREBASE_API_KEY -and
  $remote.authDomain -eq $qa.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN -and
  $remote.projectId -eq $qa.NEXT_PUBLIC_FIREBASE_PROJECT_ID -and
  $remote.storageBucket -eq $qa.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET -and
  [string]$remote.messagingSenderId -eq $qa.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID -and
  $remote.appId -eq $qa.NEXT_PUBLIC_FIREBASE_APP_ID
if (-not $sdkMatches) { throw 'La configuración local no coincide con la app Web remota.' }
Write-Output "Configuración Web coincide: $sdkMatches"

$dbResponse = (firebase firestore:databases:list --project finanzas-m-plus --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Firestore.' }
$database = $dbResponse.result | Where-Object { $_.name -like '*/databases/(default)' } | Select-Object -First 1
$databaseMatches =
  $database.databaseEdition -eq 'STANDARD' -and
  $database.locationId -eq 'us-east1' -and
  $database.deleteProtectionState -eq 'DELETE_PROTECTION_ENABLED' -and
  $database.pointInTimeRecoveryEnablement -eq 'POINT_IN_TIME_RECOVERY_DISABLED'
if (-not $databaseMatches) { throw 'La base Firestore remota difiere del contrato aprobado.' }
Write-Output "Configuración Firestore coincide: $databaseMatches"
```

Expected: dos líneas `True`; ninguna credencial o valor individual se imprime.

- [ ] **Step 6: Record manual QA as pending**

No iniciar sesión ni escribir automáticamente. Registrar como pendiente el QA manual con `npm run dev:qa`, porque el popup Google necesita intervención del usuario y las Rules M+ aún pertenecen al siguiente bloque.

### Task 6: Documentación, limpieza transitoria y publicación

**Files:**
- Modify: `docs/11_WEB_DEV_LOG.md`
- Delete after absorption: `docs/superpowers/specs/2026-08-12-configuracion-segura-firebase-mplus-web-design.md`
- Delete after absorption: `docs/superpowers/plans/2026-08-12-configuracion-segura-firebase-mplus-web.md`
- Orchestrator modifies afterward: `recursos/orquestador/ESTADO_PROYECTO.md`, `PROGRESO_REDISENO_APP.md`, `HISTORIAL_CAMBIOS.md`

- [ ] **Step 1: Append a corrective Dev Log entry**

La entrada debe indicar:

- hallazgos de la auditoría;
- política EMULATOR/QA_REAL aplicada;
- correo retirado de Firestore;
- persistencia offline retirada;
- comandos y pruebas ejecutados;
- QA Google real aún pendiente;
- commit inicial `3756abb` y commits de corrección.

No reescribir la entrada histórica anterior; esta nueva entrada la corrige de forma aditiva.

- [ ] **Step 2: Remove transient design and plan**

Después de verificar que el Dev Log conserva objetivo, decisiones, archivos, pruebas y siguiente paso, eliminar únicamente los dos documentos transitorios listados. Su contenido permanece recuperable en los commits documentales.

- [ ] **Step 3: Run final verification**

```powershell
npm run lint
npm test
npm run build
npm run build:qa
git diff --check
git status --short --branch
```

Expected: todos los comandos exitosos y solo cambios esperados preparados.

- [ ] **Step 4: Commit and push Web**

```powershell
git add docs/11_WEB_DEV_LOG.md docs/superpowers
git commit -m "docs: cerrar configuración segura Firebase Web M Plus"
git push origin develop/finanzas-m-plus
```

Confirmar que `main`, `snapshot/finanzas-m-2026-08-10`, `develop/finanzas-m` y el centro de mandos no cambiaron durante la entrega Web.

- [ ] **Step 5: Update the command center as orchestrator**

Con evidencia del commit Web publicado, añadir un resumen pequeño y trazable al estado, progreso e historial del centro. Revisar diff, crear commit documental y dejar ambos repositorios limpios.
