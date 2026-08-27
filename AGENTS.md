# AGENTS.md - Finanzas M Web

Antes de tocar codigo, lee `docs/11_WEB_DEV_LOG.md` completo.

Ese archivo manda sobre este.

Reglas rapidas:

1. Revisa `git status --short`.
2. Respeta el stack web decidido.
3. No cambies modelo Firebase sin revisar Sources.
4. No expongas datos privados entre Personal y Hogar.
5. Manten `npm run build` pasando.
6. Actualiza `docs/11_WEB_DEV_LOG.md` al terminar, cuando el archivo exista.
7. No uses `PROGRESS.md` salvo instruccion explicita de Felipe.

## Contexto compartido y centro protegido

1. Lee `../../recursos/orquestador/00_LEER_PRIMERO.md` antes de actuar para identificar el producto y las reglas compartidas.
2. Si trabajas en Finanzas M+, lee `../../recursos/orquestador/PLAN_ADAPTACION_WEB.md`, la especificación y el contrato compartido.
3. Si trabajas en Finanzas M normal, lee `../../recursos/orquestador/CONTINUAR_DESARROLLO_FINANZAS_M.md` y no uses el roadmap M+ como alcance.
4. `../../recursos/orquestador/` es de solo lectura para el agente Web. No edites, muevas, renombres, resumas ni borres sus archivos.
5. Si la implementación exige una decisión, contrato o cambio transversal, entrega evidencia y una propuesta al orquestador; no actualices tú mismo su documentación.

## Preflight Git obligatorio

Antes de editar, ejecuta y reporta:

```text
git branch --show-current
git status --short --branch
git log -1 --oneline
```

- Finanzas M+ usa `develop/finanzas-m-plus` o una rama temporal autorizada nacida de ella, y el proyecto Firebase aislado `finanzas-m-plus` definido en el contrato.
- Finanzas M normal usa `develop/finanzas-m` y Firebase existente `finanzas-m`.
- `main` y `snapshot/finanzas-m-2026-08-10` son de solo lectura durante trabajo ordinario.
- Si la rama, el commit o el estado no coinciden con la tarea, detente. No cambies de rama ni descartes cambios sin autorización.

## Entrega obligatoria

Reporta rama y commit final, archivos modificados, pruebas/build ejecutados y `git status --short --branch`. Confirma que no modificaste el centro de mandos, `main` ni el snapshot.

## Servidor de desarrollo: no reiniciar por costumbre

`npm run dev` levanta Next con HMR y **precalienta las rutas solo** (el supervisor lanza `scripts/warm-dev-routes.mjs`). No hace falta tocar nada más.

Reiniciar el servidor **NO es gratis**: `next dev` compila cada ruta la primera vez que se pide. Medido en este repo: 1,3–4 s por sección tras un reinicio, frente a ~0,25 s ya compilada. Reiniciar tras cada cambio tira toda esa compilación y el QA lo paga clic a clic.

Reglas:

1. Después de editar componentes, servicios, stores, hooks o pruebas: **no reinicies**. HMR aplica el cambio solo.
2. Reinicia únicamente cuando el cambio no lo recoge HMR: `next.config.ts`, `.env*`, dependencias nuevas o un servidor caído.
3. Si reinicias a mano (sin `npm run dev`), lanza después `npm run dev:warm` para no dejarle la espera al usuario.
4. Antes de decir que algo "quedó lento", **mide**. Turbopack se probó en este proyecto y salió más lento que Webpack; está registrado en `docs/11_WEB_DEV_LOG.md`.

### Cómo detener y reiniciar de verdad

Matar el servidor **por puerto no funciona** y es lo que dejó nueve servidores huérfanos en una sola sesión de QA (puertos 3000–3008, con la máquina arrastrándose):

- `npm run dev` arranca un **supervisor** (`run-firebase-environment.mjs watch`) que relanza a su hijo cuando este muere. Matar al hijo por puerto solo consigue que el supervisor lo resucite.
- Si se mata al hijo y luego se arranca otro `npm run dev`, quedan **dos supervisores**. Next detecta el puerto ocupado y se mueve solo al siguiente libre, así que ambos siguen vivos en puertos distintos y compiten por CPU.
- Además quedan procesos `next/dist/server/lib/start-server.js` cuyo padre ya murió; no aparecen buscando "dev-watch".

Detectar duplicados:

```bash
netstat -ano | grep -E ":30[0-9][0-9].*LISTENING"
```

Más de un puerto ahí = sobran servidores.

Detener de verdad (mata supervisores, hijos y huérfanos por línea de comandos, no por puerto):

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'finanzas-m-web|run-firebase-environment' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Después: comprobar que quedan **0 puertos 30xx ocupados**, arrancar UN solo `npm run dev`, y esperar a la línea `[warm] Listo` antes de decirle al usuario que puede probar. Antes de esa línea, cada sección sigue costando segundos.

**No dejar `npm run dev` en segundo plano varias veces durante una misma sesión.** Cada invocación es un supervisor nuevo que sobrevive a la herramienta que lo lanzó.
