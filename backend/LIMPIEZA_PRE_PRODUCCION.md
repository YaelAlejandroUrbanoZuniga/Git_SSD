# Limpieza pre-producción — backend

Inventario de los 9 elementos que **no deben llegar al servidor de producción**,
con la acción recomendada para cada uno. Sale de la auditoría de Fase 2.A
(`AUDITORIA_BACKEND_FASE2A.md` §1.7).

> **Nada de esta lista se ejecutó todavía, y es intencional.** Todos estos
> elementos siguen siendo útiles para el desarrollo que falta hasta el go-live:
> los fixtures alimentan el seed demo, los scripts de `data-import/` son el
> registro de cómo entraron los datos reales, y el cliente LDAP mock es lo único
> que permite trabajar sin el servicio FastAPI levantado. Borrarlos hoy costaría
> capacidad de desarrollo sin ganar nada, porque el despliegue real todavía no
> ocurre.
>
> **Esta lista se ejecuta como parte del Bloque G del RUNBOOK de promoción**,
> justo antes del despliegue real — no antes.

Leyenda de la columna **Acción**:

- **Borrar** — el elemento no debe existir más (ni local ni en el artefacto).
- **Mover** — sale del path de despliegue pero se conserva como registro.
- **Desversionar** — sale del control de versiones (`git rm --cached`); el
  archivo local puede quedarse.

---

## 1. `data-import/source/*.xlsx` — ⚠ el más importante

| | |
|---|---|
| **Qué es** | Los 5 Excel reales de GSM que `parse.ts` lee para generar el JSON intermedio de la migración (2.6 MB). |
| **Por qué sobra** | El propio `backend/.gitignore` dice literalmente *"Never commit either: the .xlsx are confidential GSM data"* — **y aun así los cinco están versionados en git** (entraron en el commit `8b7f25a`; `.gitignore` no aplica a archivos ya trackeados). Son datos confidenciales de proveedores reales viajando en el repo, y la migración ya corrió. |
| **Acción** | **Desversionar** (`git rm --cached`) y mover el original fuera del repo. |
| **Ojo** | Purgarlos del historial si la política de la empresa lo exige: siguen siendo recuperables desde cualquier clon aunque se borren del HEAD. |

## 2. `data-import/output/`

| | |
|---|---|
| **Qué es** | Salida derivada de `parse.ts` (`suppliers.json`, `events.json`, `mrl.json`) y 4 logs `.md` de las corridas de importación — 3.3 MB. |
| **Por qué sobra** | Es producto generado de una migración ya ejecutada; el servidor no lo lee. |
| **Acción** | **Borrar** sólo la copia local antes de empaquetar el deploy. Ya está correctamente gitignorado y **no** está trackeado. |

## 3. `data-import/backfill-stage-entered-at.ts`

| | |
|---|---|
| **Qué es** | Corrección retroactiva de una sola vez para `Supplier.StageEnteredAt` (174 líneas). Su propia cabecera dice *"One-time catch-up"*. |
| **Por qué sobra** | Su trabajo está hecho (existe su log en `output/`) y la importación real corrió el 2026-07-24. |
| **Acción** | **Mover** fuera del path de deploy, junto con el resto de `data-import/`. Conviene conservarlo como registro histórico de cómo se ancló esa columna. |
| **Nota** | Desde Fase 3.A verifica que `DATABASE_URL` apunte a una base `*_TEST` antes de escribir, o bien que `ALLOW_PRODUCTION_IMPORT=true` esté seteado deliberadamente (`assertWritableDatabase`), así que el riesgo mientras siga aquí es mucho menor. |

## 4. `data-import/` completo + los 4 scripts npm `import:*`

| | |
|---|---|
| **Qué es** | La herramienta de migración Excel → base (`parse`, `import-suppliers`, `import-rest`, `mappings`, `normalize`) y sus scripts en `package.json`. |
| **Por qué sobra** | La migración es un evento único ya consumado; producción no importa nada de Excel. Además arrastra `xlsx` como dependencia de build. |
| **Acción** | **Mover** fuera del path de deploy. |
| **Ojo** | **No se puede borrar sin más**: `tests/unit/dataImportNormalize.test.ts` y `tests/unit/eventProspectsImport.test.ts` importan de `data-import/normalize.ts`. |

## 5. `prisma/fixtures/`

| | |
|---|---|
| **Qué es** | Dataset de demo (~2 940 líneas: 21 proveedores, eventos, estrategia) que alimenta `SEED_DEMO=true`. |
| **Por qué sobra** | En producción no se siembra demo; la base tiene 533 proveedores reales. |
| **Acción** | **Mover** fuera del path de deploy — **no borrar**. |
| **Ojo** | `prisma/seed.ts` los importa estáticamente en la cabecera (se cargan incluso sin `SEED_DEMO`) y `tests/unit/seedDemoData.test.ts` depende de ellos. El frontend ya **no** los importa (la única mención en `frontend/src/constants/stage-config.ts` es un comentario). |

## 6. `sql/2026-07-23_revert_citlaly_to_guest.sql`

| | |
|---|---|
| **Qué es** | Data fix puntual: revertir el rol de una persona concreta de SSD a Guest, en TEST. |
| **Por qué sobra** | No es un cambio de esquema sino una corrección de datos sobre una persona; correrla contra producción cambiaría el rol de alguien sin querer. `sql/README.md` la marca "⬜ Pendiente" en PROD, lo que la deja lista para aplicarse por error durante la promoción. |
| **Acción** | **Mover** a un subdirectorio de data-fixes ya aplicados, o marcarla explícitamente como *no aplicar en PROD*. **No borrar** — es el registro de una acción sobre datos reales. |

## 7. `dist/`

| | |
|---|---|
| **Qué es** | Compilado local de `npm run build` (594 KB, del 6-jul). |
| **Por qué sobra** | Está gitignorado y no trackeado, pero lleva semanas obsoleto respecto de `src/`; copiarlo tal cual desplegaría código de julio. |
| **Acción** | **Borrar** la copia local y regenerar en el servidor. Nunca copiarlo desde la máquina de desarrollo. |

## 8. `.env`

| | |
|---|---|
| **Qué es** | Configuración local apuntando a `MX_MFGIT_SSD_TEST` con credenciales SQL reales y la API key del servicio LDAP. |
| **Por qué sobra** | Correctamente gitignorado y **no** trackeado, pero es exactamente el archivo que se cuela en un `scp -r backend/`. |
| **Acción** | **Borrar** de cualquier artefacto de deploy. Producción debe recibir su propio `.env` generado en el servidor. |
| **Nota** | El `JWT_SECRET` que cargaba era literalmente el placeholder de `.env.example`. Desde Fase 3.A el servidor **se niega a arrancar** con ese valor (`src/config/env.ts`), así que el `.env` local ya tuvo que cambiarse. |

## 9. `src/auth/ldapClient.ts` → `MockLdapAuthClient`

| | |
|---|---|
| **Qué es** | Cliente LDAP simulado para desarrollo sin el servicio FastAPI (`AUTH_MODE=mock`). |
| **Por qué sobra** | Vive en `src/`, así que `tsconfig.build.json` lo compila **dentro del bundle de producción**, con 4 identidades de empleados reales y la contraseña compartida `'password'`. Sólo lo desactiva `AUTH_MODE=ldap` en tiempo de ejecución. |
| **Acción** | **Mover** fuera de `src/`, o al menos fuera del `include` de `tsconfig.build.json`. |
| **Nota** | Desde Fase 3.A, arrancar con `AUTH_MODE` ausente o con un valor no reconocido imprime un banner de advertencia explícito al inicio (`config/env.ts` → `authSafetyWarnings`), pero **nada impide arrancar**: mover el mock sigue siendo la única protección real. |
