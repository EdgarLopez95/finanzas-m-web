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
