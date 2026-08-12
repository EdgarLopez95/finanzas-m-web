# Diseño de configuración segura Firebase para Finanzas M+ Web

**Estado:** Aprobado para revisión escrita
**Producto:** Finanzas M+
**Rama:** `develop/finanzas-m-plus`
**Propietario:** Orquestador
**Ciclo de vida:** Transitorio; se retira cuando la implementación y su evidencia queden absorbidas por `docs/11_WEB_DEV_LOG.md`.

## 1. Objetivo

Conectar Web a Firebase sin permitir que un cambio de rama, una variable residual o un comando ordinario escriban accidentalmente en `finanzas-m` o en el proyecto real de Finanzas M+.

La configuración debe cumplir las decisiones vigentes:

- Emulator Suite es el ambiente predeterminado.
- `QA_REAL` exige una selección explícita.
- Finanzas M+ solo acepta `finanzas-m-plus` como proyecto real.
- Web funciona online-only y no conserva caché Firestore persistente.
- Los documentos `users/{uid}` de M+ no copian el correo de Google.
- La configuración local real no se versiona.

## 2. Alternativas evaluadas

### A. Política versionada y comandos explícitos — seleccionada

Una función pura resuelve el ambiente, genera la configuración segura del emulador y valida de forma estricta QA real. Un script inicia Next.js con `QA_REAL` solo cuando el desarrollador usa el comando correspondiente.

Ventajas: bloquea proyectos incorrectos, evita residuos entre ramas, es verificable mediante tests y mantiene el emulador como valor predeterminado.

### B. Conservar `.env.local` y validar solo `projectId`

Es más pequeña, pero `.env.local` permanece al cambiar de rama y el desarrollo seguiría apuntando al proyecto real por defecto. No cumple el aislamiento aprobado.

### C. Clones o worktrees separados por producto

Aísla físicamente los entornos, pero añade mantenimiento innecesario y no protege a otros clones. Puede usarse en el futuro, pero no sustituye las barreras dentro del código.

## 3. Arquitectura

### 3.1 Política de ambientes

Se creará un módulo puro de configuración con dos estados:

- `EMULATOR`: valor predeterminado. Ignora variables Firebase reales y usa siempre el proyecto ficticio `demo-finanzas-m-plus`.
- `QA_REAL`: solo acepta `finanzas-m-plus` y exige la configuración completa del cliente Web registrado.

`finanzas-m` y cualquier ID desconocido producen un error bloqueante antes de inicializar Auth o Firestore.

### 3.2 Archivos locales

- `.env.local` dejará de usarse y se moverá localmente a `.env.qa-real.local`.
- `.env.qa-real.local` permanecerá ignorado y Next.js no lo cargará automáticamente.
- `.env.local.example` quedará permitido en `.gitignore` y versionado con nombres de variables, ambiente `QA_REAL`, proyecto esperado y valores no sensibles vacíos cuando corresponda.

Al cambiar a `develop/finanzas-m`, el archivo QA de M+ no se carga automáticamente. La app normal falla de forma segura hasta que tenga su propio bloque de configuración.

### 3.3 Comandos

- `npm run dev`: inicia Web contra Auth y Firestore Emulator.
- `npm run dev:qa`: carga explícitamente `.env.qa-real.local` e inicia contra `finanzas-m-plus`.
- `npm run build`: compila con configuración segura de emulador.
- `npm run build:qa`: compila explícitamente con la configuración real M+.

Un script Node reutilizará el watcher actual para desarrollo y el CLI local de Next para build, sin añadir dependencias.

### 3.4 Inicialización Firebase

El cliente Firebase:

1. resuelve y valida el ambiente;
2. inicializa una app con nombre estable;
3. verifica que una instancia reutilizada conserve el proyecto esperado;
4. conecta Auth y Firestore a sus emuladores inmediatamente en `EMULATOR`;
5. usa `getFirestore(app)` sin `persistentLocalCache` ni IndexedDB persistente.

No existe fallback silencioso a otro proyecto ni a la red real.

### 3.5 Perfil del usuario

El bootstrap de `users/{uid}` conserva únicamente los campos permitidos por el contrato M+: UID, nombre visible, foto, moneda, estado de Hogar y timestamps necesarios. El correo puede existir en Firebase Authentication, pero no se copia a Firestore.

## 4. Manejo de errores

- Runtime desconocido: error explícito con los valores admitidos.
- QA real incompleto: error antes de inicializar Firebase.
- Proyecto real distinto de `finanzas-m-plus`: error bloqueante.
- Emulador no disponible: la operación falla; no hace fallback al proyecto real.
- App Firebase ya inicializada con otro proyecto: error bloqueante y solicitud de reiniciar el proceso.

## 5. Pruebas

Se aplicará TDD con funciones puras y contratos estructurales:

- runtime ausente selecciona `EMULATOR`;
- emulador siempre usa `demo-finanzas-m-plus` aunque existan variables residuales;
- `QA_REAL` acepta únicamente `finanzas-m-plus` con configuración completa;
- `QA_REAL` rechaza `finanzas-m`, IDs desconocidos y campos faltantes;
- el perfil Firestore no contiene `email`;
- el cliente Web no importa ni usa caché persistente;
- `.env.local.example` queda versionado y `.env.qa-real.local` ignorado;
- lint, suite unitaria, build de emulador y build QA pasan.

La prueba manual de Google Login se realiza después con `npm run dev:qa`; no se considera sustituida por el build.

## 6. Alcance excluido

- No se cambian ni despliegan Rules o índices en este bloque.
- No se adapta todavía el modelo funcional M+.
- No se habilita Hosting.
- No se modifica `develop/finanzas-m`, `main` ni el snapshot.
- No se elimina información del centro de mandos.

## 7. Criterio de cierre

El bloque queda cerrado cuando la rama M+ está limpia y publicada, los comandos de ambiente son explícitos, las barreras tienen pruebas, ambos builds pasan, el log Web registra la corrección y el centro de mandos refleja evidencia verificable sin declarar QA manual como completado.
