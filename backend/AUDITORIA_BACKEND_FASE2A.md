# Auditoría de Backend — Fase 2.A

**Rama:** dev · **Commit auditado:** `25df003` — *[Chore] Sync MX_MFGIT_SSD_TEST schema with Visit tab relocation* (2026-08-17 09:31:20 -0600, `25df003ca0ce2cfe856676d287bcb192507502fc`)
**Fecha:** 2026-08-17
**Alcance:** backend/ únicamente (src, prisma, data-import, tests, sql, config)

> Diagnóstico puro. No se modificó ningún archivo de código. `git status` limpio al
> inicio, `git pull origin dev` → *Already up to date*. Suite completa ejecutada como
> contexto: **18 archivos / 328 tests, todos en verde**.

## Resumen

| | Cantidad |
|---|---:|
| **Categoría 1** — cambios para desarrollador | **41** |
| 1.1 Comentarios y ruido | 5 |
| 1.2 TODOs y marcadores sueltos | 4 |
| 1.3 Código muerto | 8 |
| 1.4 Logging de debug olvidado | 0 (+1 observación) |
| 1.5 Nombres e imports inconsistentes | 5 |
| 1.6 Duplicación menor | 10 |
| 1.7 Archivos que no deberían llegar a producción | 9 |
| **Categoría 2** — cambios que afectan el funcionamiento | **38** |
| › Severidad **Alta** | 9 |
| › Severidad **Media** | 17 |
| › Severidad **Baja** | 12 |

Desglose de Categoría 2 por sección:

| Sección | Alta | Media | Baja | Total |
|---|---:|---:|---:|---:|
| 2.1 Hardcodeos peligrosos | 3 | 2 | 3 | 8 |
| 2.2 Manejo de errores incompleto | 1 | 5 | 1 | 7 |
| 2.3 Validaciones inconsistentes | 0 | 2 | 5 | 7 |
| 2.4 Permisos faltantes | 0 | 2 | 2 | 4 |
| 2.5 Concurrencia | 1 | 3 | 3 | 7 |
| 2.6 Configuración de entorno | 2 | 3 | 1 | 6 |
| 2.7 TEST vs PROD | 2 | 2 | 1 | 5 |
| 2.8 Dependencias | 0 | 2 | 1 | 3 |

*(2.1 y 2.6 comparten un hallazgo — `JWT_SECRET` — contado una sola vez, en 2.1.)*

---

## Categoría 1 — Cambios para desarrollador (no afectan funcionamiento)

### 1.1 Comentarios y ruido

**1.1.1 — `backend/src/app.ts:50-51`**
El comentario dice *"User administration — master role only (SSD); guard also on the router"*, pero en `app.ts` no hay ningún `requireRole` en el montaje de `/api/users`: el único guard vive en `routes/users.ts:12`.
Describe una defensa en dos capas que no existe, así que quien lea `app.ts` puede creer que el router es redundante y quitarlo.

**1.1.2 — `backend/src/services/authService.ts:10`**
Comentario huérfano `// Password used only for LDAP validation; never stored or logged.` flotando entre los imports y `hashToken()`, sin código debajo al que se refiera.
Quedó de una versión anterior en la que había una función de password ahí; hoy no anota nada.

**1.1.3 — `backend/prisma/seed.ts:8-11`**
La advertencia `⚠` dice que este seed *requiere que `07_rename_default_role_to_guest.sql` haya corrido primero*, pero ese archivo no existe en `backend/sql/` (los baseline `01_`–`07_` tampoco están versionados — ver `sql/CAMBIOS_ESQUEMA.md:3`).
El lector no puede verificar ni ejecutar la precondición que el comentario le exige.

**1.1.4 — `backend/src/middleware/auth.ts:23` y `backend/src/middleware/requestLogger.ts:5`**
Dos `// eslint-disable-next-line @typescript-eslint/no-namespace` en un backend que no tiene ESLint: no hay config ni dependencia de eslint en `backend/package.json:33-45`.
Suprimen una regla de un linter que nunca corre.

**1.1.5 — `backend/src/services/suppliersService.ts:249-253`**
Bloque de 5 líneas explicando la secuencia de niveles Intelex justo encima de `INTELEX_DERIVED_FIELDS`, que no es lo que describe; la misma explicación está completa en `suppliersService.ts:505-510` y otra vez en `domain/intelexLevels.ts:1-14`.
Tres copias de la misma explicación, y la de aquí no está pegada al código que explica.

### 1.2 TODOs y marcadores sueltos

Ninguno de los cuatro está en `backend/DEBT.md`. Los tres primeros sí están
referenciados en `backend/README.md` §5 *"Pending TODOs"* — el hallazgo es que el
registro de pendientes vive partido en dos documentos con criterios distintos.

**1.2.1 — `backend/src/auth/ldapClient.ts:2-3`**
Dos `TODO(security)`: LDAP en puerto 389 sin cifrar (sin LDAPS/StartTLS) y `API_KEY` hardcodeada en el `config.py` del servicio FastAPI.
Son riesgos de seguridad reales de un servicio del que este backend depende, anotados solo como comentario y en README, no en el registro de deuda.

**1.2.2 — `backend/src/services/eventsService.ts:188-193`**
`TODO(Phase 2)`: la futura conversión prospecto → `Supplier` debe reutilizar `hasExternalFormData` como precondición.
Es una regla de negocio pendiente escrita como comentario en el archivo en vez de como entrada de deuda.

**1.2.3 — `backend/src/domain/externalFormGate.ts:37-38`**
Tercera copia del mismo pendiente: el docblock lista *"2. eventsService — TODO hook for the future T_Event_Prospect → Supplier"* como si fuera un consumidor existente.
El comentario presenta como consumidor algo que no existe, y hay que leer dos archivos para saber que es el mismo TODO.

**1.2.4 — `backend/README.md:1160-1163` (columna `T_Supplier_ParkingData.DaysElapsed`)**
El README la declara muerta y *"candidata para la próxima limpieza de esquema"*. Verificado: nada en `src/` la escribe — solo la lee `mappers/supplierMapper.ts:184` y la escribe el seed en `prisma/seed.ts:321`.
Es trabajo de limpieza de esquema pendiente registrado solo en un README de 108 KB, no en `DEBT.md`.

### 1.3 Código muerto

Todo lo de abajo está verificado con grep sobre `src/`, `prisma/`, `tests/` y
`data-import/` (cero referencias), no inferido por el nombre. Los tres imports sin
usar salieron además de `tsc --noEmit --noUnusedLocals --noUnusedParameters`.

**1.3.1 — `backend/src/domain/constants.ts:25`**
`export const ENTRY_SOURCES` — una sola aparición en todo el backend: su propia declaración.
La lista de valores permitidos de `entrySource` se re-declara a mano en los zod schemas (`suppliersController.ts:11`) y en el tipo de `CreateSupplierInput`.

**1.3.2 — `backend/data-import/mappings.ts:133`**
`export const STAGE_ORDER` — exportada, cero importadores. `data-import/import-rest.ts:301` declara su propia copia local con los mismos 5 valores.
Se exporta un catálogo que nadie consume mientras el único consumidor mantiene el suyo.

**1.3.3 — `backend/data-import/mappings.ts:115` + `backend/data-import/normalize.ts:9`**
`RECOMMENDATION_INPUTS` se exporta y se importa en `normalize.ts:9`, pero jamás se usa dentro de ese archivo ni en ningún otro.
Export muerto e import muerto en la misma cadena.

**1.3.4 — `backend/data-import/normalize.ts:189`**
`export function isEventName` — solo se llama dentro del mismo archivo (`normalize.ts:201`).
El `export` sugiere una API pública que nadie usa.

**1.3.5 — `backend/data-import/import-rest.ts:21`**
`import { randomUUID } from 'node:crypto'` sin usar.

**1.3.6 — `backend/data-import/parse.ts:31`**
`CANONICAL_EVENTS` importado de `./mappings` y nunca usado (sí se usa dentro de `normalize.ts:191`, pero no aquí).

**1.3.7 — `backend/src/auth/ldapClient.ts:63`**
`private apiKey: string` nunca se lee (`tsc` lo confirma con TS6138). El comentario adyacente lo justifica como *"retained for future POST /auth/profile calls"*.
Es un parámetro de constructor que obliga a `server.ts:12` a pasar `env.ldapApiKey` para nada.

**1.3.8 — `backend/src/services/usersService.ts:149-151` y `176-178`**
Dos guards `if (existing.role.name === 'SSD' && …)` que los propios comentarios (líneas 147-148 y 173-175) declaran inalcanzables, porque el guard anterior (`143`, `169`) ya lanzó.
Código que no puede ejecutarse nunca, conservado como "segunda línea de defensa".

### 1.4 Logging de debug olvidado

**Ningún hallazgo.** Se revisaron las 60 llamadas a `console.*` en `src/`, `prisma/` y
`data-import/`: todas caen en un prefijo intencional — `[req]`, `[unhandled]`, `[audit]`,
`[notify]` (documentados en README), más `[startup]` (`config/startupCheck.ts:36,41`),
`[server]` (`server.ts:25-35`) y los prefijos de los scripts CLI `[seed]`, `[seed:demo]`,
`[import]`, `[import:rest]`, `[backfill:stage]`. No hay ningún `console.log` suelto de
depuración.

**Observación (no es hallazgo):** `[startup]` y `[server]` son prefijos intencionales que
no están en la lista de cuatro documentada en el README; conviene añadirlos ahí para que
el patrón siga siendo verificable de un vistazo.

### 1.5 Nombres e imports inconsistentes

**1.5.1 — `backend/src/routes/events.ts:14` y `:34`**
El guard se llama `b2bOnly` pero se usa en `DELETE /:id/prospects/import/:importBatchId` (`deleteImportBatch`), que no tiene nada que ver con B2B.
El nombre miente sobre qué protege; el comentario de la línea 13 tuvo que aclararlo ("*B2B scheduling **and undoing an import***").

**1.5.2 — `backend/src/routes/events.ts:10` vs `:14`**
`write = requireRole(...OPERATIONAL_WRITE_ROLES)` y `b2bOnly = requireRole('SSD')` producen exactamente el mismo conjunto de roles, uno desde la constante compartida y el otro desde un literal.
Si `OPERATIONAL_WRITE_ROLES` cambia, la mitad de las rutas del router se mueve y la otra mitad no.

**1.5.3 — `backend/src/services/strategyService.ts:231`**
`const { supplierInclude, toSupplierDTO } = await import('../mappers/supplierMapper');` — import dinámico dentro de la función, cuando los otros cinco consumidores del mismo módulo (`suppliersService.ts:12`, `trackerService.ts:15`, `config/startupCheck.ts:2`, `slaService.ts:3`, `data-import/import-suppliers.ts:28`) lo importan estáticamente al inicio.
Único import dinámico del backend, sin ciclo de dependencias que lo justifique.

**1.5.4 — `backend/tsconfig.json:2-14`**
Faltan `noUnusedLocals` y `noUnusedParameters`.
Es la razón directa por la que los cuatro elementos sin usar de §1.3.5–1.3.7 pasan `npm run typecheck` sin que nadie los vea.

**1.5.5 — `backend/src/controllers/eventsController.ts:107` y `:118` vs el resto de controllers**
`createEvent` / `updateEvent` reciben `req.user` crudo; los otros catorce handlers del backend usan `req.user ?? DEMO_USER`.
*(Tiene efecto funcional además del estilístico — ver §2.3.2.)*

### 1.6 Duplicación menor

Solo se señala dónde está duplicado y en qué archivos, sin proponer la refactorización.

**1.6.1 — Lista de valores basura**
`backend/src/domain/textValidation.ts:12` (`JUNK_VALUES`) y `backend/data-import/import-rest.ts:60` (`JUNK`) contienen los mismos 11 literales, copiados verbatim.

**1.6.2 — Conversión "día → mediodía UTC"**
Cuatro implementaciones: `backend/data-import/backfill-stage-entered-at.ts:49-54`, `backend/data-import/import-rest.ts:318-320`, en línea en `backend/data-import/import-rest.ts:462` y en línea en `backend/prisma/seed.ts:118`.

**1.6.3 — Escape de pipes para tablas Markdown**
`backend/data-import/import-suppliers.ts:249` y `backend/data-import/parse.ts:891` — la misma función `esc()` de una línea, idéntica carácter por carácter.

**1.6.4 — Orden de las 5 etapas activas**
`backend/src/domain/constants.ts:3-11` (las 5 primeras de `TRACKER_STAGES`), `backend/data-import/mappings.ts:133` y `backend/data-import/import-rest.ts:301`.

**1.6.5 — Cálculo del número de folio máximo**
`backend/src/services/suppliersService.ts:96-99` y `backend/data-import/import-suppliers.ts:88-91` — el mismo `reduce` con `Number(folio.slice(prefix.length))`.

**1.6.6 — Construcción de los mapas nombre→id de catálogo**
`backend/prisma/seed.ts:592-602` (dentro de `seedDemoTrackerData`) y `backend/data-import/import-suppliers.ts:59-72` (`buildCatalogIds`) — nueve `new Map(...)` equivalentes.

**1.6.7 — Spread año por año de `needs2026`…`needs2031`**
`backend/src/services/strategyService.ts:97-102` y `:142-147` — el mismo bloque de seis líneas en `updateStrategyEntry` y en `upsertStrategyEntryByCommodity`.

**1.6.8 — Validación "entero no negativo" de los años de estrategia**
`backend/src/services/strategyService.ts:88-92` y `:133-137` — el mismo bucle, además de que `strategyController.ts:9` ya lo valida con zod.

**1.6.9 — Regla de propiedad de notas**
`backend/src/services/notesService.ts:11-75` (supplier) y `:79-131` (event) — seis funciones con la misma comprobación `note.author !== actor.displayName` repetida cuatro veces.

**1.6.10 — Regla de "qué cuenta como fecha" en Intelex**
`backend/src/domain/intelexLevels.ts:67-71` (`realDay`) y `backend/src/domain/intelexEfficiency.ts:57-63` (`dayTimestamp`) — mismo `slice(0,10)` + mismo regex, en dos archivos. Los comentarios lo declaran deliberado.

**Extra (patrón repetido, no duplicación de lógica):** `const actor = req.user ?? DEMO_USER;` aparece 15 veces en `trackerController.ts`, `suppliersController.ts`, `eventsController.ts`, `strategyController.ts` y `notificationsController.ts`.

### 1.7 Archivos/carpetas que no deberían llegar a producción

**1.7.1 — `backend/data-import/source/*.xlsx` (5 archivos, 2.6 MB) — ⚠ el más importante de esta sección**
- **(a) Por qué existe hoy:** son los 5 Excel reales de GSM que `parse.ts` lee para generar el JSON intermedio de la migración.
- **(b) Por qué sobra en producción:** el propio `backend/.gitignore` (sección *Data import*) dice literalmente *"Never commit either: the .xlsx are confidential GSM data"* — **y sin embargo los cinco están versionados en git** (`git ls-files` los lista; entraron en el commit `8b7f25a`). El `.gitignore` no aplica a archivos ya trackeados. Son datos confidenciales de proveedores reales viajando en el repo, y la migración ya corrió.
- **(c) Recomendación:** **borrar del control de versiones** (`git rm --cached`) y mover el original fuera del repo. Purgarlos del historial si la política de la empresa lo exige — siguen recuperables de cualquier clon aunque se borren del HEAD.

**1.7.2 — `backend/data-import/output/` (3.3 MB: `suppliers.json`, `events.json`, `mrl.json`, 4 logs `.md`)**
- **(a)** Salida derivada de `parse.ts` y logs de las corridas de importación.
- **(b)** Es producto generado de una migración ya ejecutada; no lo lee nada del servidor.
- **(c)** Ya está correctamente gitignorado y **no** está trackeado. Solo **borrar la copia local** antes de empaquetar el deploy.

**1.7.3 — `backend/data-import/backfill-stage-entered-at.ts` (174 líneas)**
- **(a)** Corrección retroactiva de una sola vez para `Supplier.StageEnteredAt` en las filas importadas antes de que `import-rest.ts` lo escribiera; su propia cabecera (líneas 1-31) dice *"One-time catch-up"* y explica que la importación real ya corrió el 2026-07-24.
- **(b)** Su trabajo está hecho (existe su log en `output/`) y es idempotente-por-nulos, así que en producción es solo un script que apunta a `DATABASE_URL` sin comprobar contra qué base está.
- **(c)** **Mover** fuera del path de deploy, junto con el resto de `data-import/` — conviene conservarlo como registro histórico de cómo se ancló esa columna.

**1.7.4 — `backend/data-import/` completo + los 4 scripts npm `import:*` (`package.json:15-18`)**
- **(a)** Herramienta de migración Excel → base (parse, import-suppliers, import-rest, mappings, normalize).
- **(b)** La migración es un evento único ya consumado; el servidor de producción no importa nada de Excel. Además arrastra `xlsx` como dependencia de la fase de build.
- **(c)** **Mover** fuera del path de deploy. Ojo: no se puede borrar sin más — `tests/unit/dataImportNormalize.test.ts` y `tests/unit/eventProspectsImport.test.ts` importan de `data-import/normalize.ts`.

**1.7.5 — `backend/prisma/fixtures/` (3 archivos, ~2 940 líneas de datos demo)**
- **(a)** Dataset de demo (21 proveedores, eventos, estrategia) que alimenta `SEED_DEMO=true`.
- **(b)** En producción no se siembra demo; la base tiene 533 proveedores reales. **Verificado:** el frontend ya **no** los importa (la única mención en `frontend/src/constants/stage-config.ts:23` es un comentario, no un `import`) — el README §5 está desactualizado en ese punto.
- **(c)** **Mover** fuera del path de deploy, no borrar: `prisma/seed.ts:16-26` los importa estáticamente en la cabecera (se cargan incluso sin `SEED_DEMO`) y `tests/unit/seedDemoData.test.ts` depende de ellos.

**1.7.6 — `backend/sql/2026-07-23_revert_citlaly_to_guest.sql`**
- **(a)** Data fix puntual: revertir el rol de una persona concreta de SSD a Guest en TEST.
- **(b)** Es una corrección de datos de una persona en una base concreta, no un cambio de esquema; correrla contra producción cambiaría el rol de alguien sin querer. `sql/README.md` la marca "⬜ Pendiente" en PROD, lo que la deja lista para ser aplicada por error durante la promoción.
- **(c)** **Mover** a un subdirectorio de data-fixes ya aplicados (o marcarla explícitamente como *no aplicar en PROD*), no borrar — es el registro de una acción sobre datos reales.

**1.7.7 — `backend/dist/` (594 KB, del 6-jul)**
- **(a)** Compilado local de `npm run build`.
- **(b)** Está gitignorado y no trackeado, pero lleva **6 semanas obsoleto** respecto de `src/`; si se copiara al servidor tal cual se desplegaría código de julio.
- **(c)** **Borrar** la copia local y regenerar en el servidor; nunca copiarlo desde la máquina de desarrollo.

**1.7.8 — `backend/.env`**
- **(a)** Configuración local apuntando a `MX_MFGIT_SSD_TEST` con credenciales SQL reales y la API key del servicio LDAP.
- **(b)** Correctamente gitignorado y **no** trackeado, pero es exactamente el archivo que se cuela en un `scp -r backend/`.
- **(c)** **Borrar** de cualquier artefacto de deploy; producción debe recibir su propio `.env` generado en el servidor. Ver §2.1.1 y §2.6.3: el `JWT_SECRET` que hoy carga es literalmente el placeholder del `.env.example`.

**1.7.9 — `backend/src/auth/ldapClient.ts:114-168` (`MockLdapAuthClient`)**
- **(a)** Cliente LDAP simulado para desarrollo sin el servicio FastAPI (`AUTH_MODE=mock`).
- **(b)** Vive en `src/`, así que `tsconfig.build.json:9` lo compila **dentro del bundle de producción**, con 4 identidades de empleados reales (`y.urbano@nexteer.com`, `c.mendoza@…`, `a.garcia@…`, `r.sanchez@…`) y la contraseña compartida `'password'` (línea 116). Solo lo desactiva `AUTH_MODE=ldap` en tiempo de ejecución (`server.ts:10-13`).
- **(c)** **Mover** fuera de `src/` (o al menos fuera del `include` de `tsconfig.build.json`). Ver §2.7.4 para el riesgo funcional de que quede activo.

---

## Categoría 2 — Cambios que afectan el funcionamiento

### 2.1 Valores hardcodeados peligrosos

**2.1.1 — `backend/src/config/env.ts:28` (+ `backend/.env:18`, `backend/.env.example:17`)**
`jwtSecret: source.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod'` — fallback silencioso, sin validación de que el valor no sea el placeholder; y el `.env` que corre hoy contra `MX_MFGIT_SSD_TEST` trae `JWT_SECRET=change-me-in-production`, copiado verbatim del `.env.example`.
Cualquiera que conozca el repo puede firmar un token válido con rol `SSD`, porque la clave de firma es un literal público.
**Severidad: Alta**

**2.1.2 — `backend/src/config/env.ts:32`**
`authOptional: (source.AUTH_OPTIONAL ?? 'true').toLowerCase() !== 'false'` — el valor por defecto ante variable ausente es `true`, y cualquier valor distinto de la cadena exacta `'false'` (p. ej. `AUTH_OPTIONAL=0`, `AUTH_OPTIONAL=no`, `AUTH_OPTIONAL=FALSE ` con espacio) también resuelve a `true`.
Es fail-open: un `.env` incompleto o con un typo levanta el servidor **sin autenticación obligatoria**, y el único aviso es el banner de consola de `server.ts:30-35`.
**Severidad: Alta**

**2.1.3 — `backend/src/middleware/auth.ts:15-20`**
`DEMO_USER` hardcodea a una persona real (`username: 'yael.urbano'`, `displayName: 'Yael Urbano'`) con `role: 'SSD'`, el rol maestro.
Combinado con 2.1.2, toda petición sin token se atribuye a esa persona con permisos totales: las escrituras quedan firmadas con su nombre en `T_Supplier_History` y en las notificaciones, sin que ella las haya hecho.
**Severidad: Alta**

**2.1.4 — `backend/prisma/seed.ts:48-70` (`REAL_USERS`)**
21 empleados reales de GSM con nombre completo, correo corporativo y asignación de rol, escritos como literales en código versionado.
Un cambio de plantilla (alta, baja, cambio de rol) obliga a un commit, y el directorio del equipo queda expuesto en el repo; además `seedCatalogsAndUsers()` corre **siempre** (`seed.ts:725`), así que cualquier `npm run seed` reinyecta esa lista.
**Severidad: Media**

**2.1.5 — `backend/src/auth/ldapClient.ts:116-159`**
`static readonly PASSWORD = 'password'` más 4 identidades con correos `@nexteer.com` reales.
Es una puerta de entrada con credencial conocida que solo depende de que `AUTH_MODE` valga exactamente `'ldap'` (ver §2.7.4).
**Severidad: Media**

**2.1.6 — `backend/src/config/env.ts:27`**
`corsOrigin: (source.CORS_ORIGIN ?? 'http://localhost:5173')` — si la variable falta en producción, el backend acepta credenciales solo desde localhost.
No es un agujero de seguridad, pero produce un fallo total y confuso del frontend (CORS) en vez de un error de arranque claro.
**Severidad: Baja**

**2.1.7 — `backend/src/services/suppliersService.ts:199,684`, `trackerService.ts:175,279`, `mrlService.ts:164,222,248`, `eventsService.ts:127,172`**
Los `link` de las notificaciones hardcodean rutas del frontend (`/suppliers/supplier/${id}`, `/tracker/blacklisted/supplier/${id}`, `/strategy/mrl/${row.id}`, `/events/${row.id}`).
Un cambio de rutas en el frontend rompe silenciosamente los enlaces de todas las notificaciones ya emitidas y de las nuevas, sin que nada en el backend falle.
**Severidad: Baja**

**2.1.8 — `backend/data-import/backfill-stage-entered-at.ts:44` y `backend/data-import/import-rest.ts:315`**
`SUPPLIER_EVAL_IMPORT_ANCHOR = '2026-07-24'` — fecha literal duplicada en dos scripts.
Se documenta como deliberado (un `TODAY` dinámico reiniciaría los contadores en una re-corrida); se registra como hardcodeo **aceptable**, en la misma categoría que los umbrales de `domain/sla.ts`.
**Severidad: Baja**

### 2.2 Manejo de errores incompleto

**2.2.1 — `backend/src/services/usersService.ts:70-125`, `132-159`, `162-181`**
`createUser`, `updateUserRole` y `deleteUser` no escriben ninguna fila de auditoría, mientras que `authService.ts:45` y `:139` auditan hasta el login fallido.
La concesión, el cambio y la revocación de privilegios — las operaciones más sensibles del sistema — no dejan rastro de quién las hizo ni cuándo.
**Severidad: Alta**

**2.2.2 — `backend/src/services/suppliersService.ts:696-712` (`deleteSupplier`)**
Único método de escritura del servicio que no recibe `actor`: sin `logAction`, sin `notifyTeam` y sin entrada de historial, frente a `createSupplier:194-204` y `updateSupplier:675-690` que sí notifican. El controller (`suppliersController.ts:105-112`) tampoco pasa el actor.
Un borrado duro (proveedor + todos sus satélites, por cascada) desaparece sin dejar constancia de quién lo ejecutó.
**Severidad: Media**

**2.2.3 — `backend/src/services/eventsService.ts:182-186` (`deleteEvent`)**
No audita, mientras que su hermano `createEvent:135-142` sí escribe `EVENT_CREATED`. El `delete` arrastra en cascada `supplierEntries`, `b2bMeetings`, `notes` y **todos los `EventProspect`** del evento (`schema.prisma:634`).
Es la operación destructiva más amplia del módulo de eventos y es la única del par create/delete sin auditoría.
**Severidad: Media**

**2.2.4 — `backend/src/services/eventsService.ts:229-256` (`linkSupplierToEvent`)**
No recibe `actor` (el controller en `eventsController.ts:149-156` tampoco lo pasa), así que no audita ni notifica; su hermana `addSupplierToEvent:196-226` obtiene las tres cosas a través de `createSupplier`.
Vincular un proveedor existente a un evento es invisible en auditoría y en el panel de notificaciones; crear uno nuevo no.
**Severidad: Media**

**2.2.5 — `backend/src/routes/auth.ts:10` (`POST /api/auth/login`)**
No hay rate limiting, backoff ni bloqueo por intentos fallidos en ninguna capa (ni middleware global en `app.ts:19-27`, ni en el controller, ni en `authService.login`).
Los intentos fallidos se auditan (`authService.ts:45`) pero nada los frena: un atacante puede probar contraseñas contra AD a través de este endpoint al ritmo que quiera, con el riesgo añadido de bloquear cuentas corporativas reales.
**Severidad: Media**

**2.2.6 — `backend/src/server.ts:17-40`**
No hay `process.on('unhandledRejection')` ni `process.on('uncaughtException')`, ni manejo de `SIGTERM`/`SIGINT`, ni `prisma.$disconnect()` al cerrar; tampoco se maneja el error de `app.listen` (p. ej. `EADDRINUSE`).
En producción un rechazo no capturado tumba el proceso sin log útil, y cada reinicio deja conexiones de SQL Server colgando hasta que expiren.
**Severidad: Media**

**2.2.7 — `backend/src/server.ts:19-22`**
`try { await verifyDatabaseSchema(prisma) } catch { process.exit(1) }` — el `catch` descarta el error por completo.
Hoy no se pierde información porque `startupCheck.ts:36-42` loguea antes de relanzar, pero cualquier fallo que no venga de ese bucle (p. ej. un error de conexión al construir el cliente) mata el proceso en silencio, sin una sola línea que diga por qué.
**Severidad: Baja**

### 2.3 Validaciones inconsistentes entre endpoints

**2.3.1 — `backend/src/controllers/suppliersController.ts:89-103` vs `:79-87`**
`PATCH /api/suppliers/:id` pasa `req.body as Record<string, unknown>` directo al servicio, sin zod, mientras que `POST /api/suppliers` valida con `createSchema` (líneas 8-26). El servicio filtra las **claves** (`suppliersService.ts:368-490`) pero no los **valores**.
Un `{"foundedYear": "abc"}` o `{"employees": {}}` llega crudo a Prisma y sale como 500 `INTERNAL` con requestId, en vez del 400 `VALIDATION_ERROR` que devolvería el POST equivalente; es el endpoint por el que pasan los ~120 campos editables del detalle de proveedor.
**Severidad: Media**

**2.3.2 — `backend/src/controllers/eventsController.ts:107` y `:118`**
`createEvent` y `updateEvent` reciben `req.user` sin el `?? DEMO_USER` que usan los otros catorce handlers.
Efecto real: `excludeUserId: actor?.id ?? null` (`eventsService.ts:128`, `:173`) se vuelve `null`, así que `notifyTeam` **notifica al propio autor de su propio cambio** — lo contrario de lo que documenta `notificationsService.ts:129-135` — y la fila de auditoría queda con `userId: null`.
**Severidad: Media**

**2.3.3 — `backend/src/controllers/strategyController.ts:8-10`**
`needsSchema` usa `z.record(z.string(), …)`, que acepta cualquier clave; `strategyService.ts:97-102` solo mapea `'2026'`–`'2031'`.
Un `{"strategyNeeds": {"2032": 10}}` responde 200 sin guardar nada y sin avisar: el usuario cree que capturó una necesidad que no existe.
**Severidad: Baja**

**2.3.4 — `backend/src/controllers/strategyController.ts:12-31` vs `backend/src/services/mrlService.ts:130-131`**
`mrlSchema` declara **todos** los campos opcionales, incluidos `commodity` y `buyerName`, y luego el servicio los exige a mano.
Dos capas de validación con reglas distintas para el mismo POST: zod dice que son opcionales, el servicio devuelve 400 si faltan.
**Severidad: Baja**

**2.3.5 — `backend/src/controllers/eventsController.ts:19-27`**
En un mismo schema conviven tres formas de decir "no obligatorio": `organizer: z.string()` (requerido pero admite `''`), `contactName/Email/Phone: nullish()` y `description/objective/topCountry: optional()`.
El cliente no puede deducir el contrato del endpoint sin leer el backend; el comentario de las líneas 15-18 existe precisamente para explicar la primera excepción.
**Severidad: Baja**

**2.3.6 — `suppliersController.ts:24`, `eventsController.ts:21,43`, `eventsController.ts:68`**
`contactEmail`, `website` y `phone` se validan solo como `z.string()` (o `.max(100)`), sin formato, mientras `usersService.ts:44` sí aplica `EMAIL_RE` a los correos de usuario.
Un correo o web inválido entra a la base y llega al frontend como enlace roto; la regla de formato existe en el proyecto pero se aplica en un solo endpoint de los cuatro que reciben correos.
**Severidad: Baja**

**2.3.7 — `backend/src/controllers/eventsController.ts:114-124`**
`eventPatchSchema = eventSchema.partial()` acepta `{}`; `updateEvent` ejecuta entonces un `update` vacío y **dispara igualmente la notificación** `event_updated` (`eventsService.ts:167-177`).
Un PATCH que no cambia nada notifica a todo el equipo — precisamente lo que `updateSupplier:675` sí evita comprobando `changedFields.length > 0`.
**Severidad: Baja**

### 2.4 Verificaciones de permisos faltantes

**2.4.1 — `backend/src/middleware/auth.ts:51-75`**
`authenticate` confía únicamente en los claims del JWT; nunca relee la fila de `C_User`.
Un cambio de rol vía `usersService.updateUserRole` o un `deleteUser` no surten efecto hasta que expira el access token (`JWT_EXPIRES_IN=900`, 15 min): un usuario degradado o eliminado conserva sus permisos durante ese tiempo. El `deleteUser:180` sí revoca los refresh tokens, pero por la cascada del FK (`schema.prisma:767`), no explícitamente.
**Severidad: Media**

**2.4.2 — `backend/src/services/notesService.ts:49`, `:71`, `:109`, `:127`**
La propiedad de una nota se comprueba con `note.author !== actor.displayName`, un nombre para mostrar, no un id de usuario.
Dos empleados con el mismo `displayName` pueden editar y borrar las notas del otro; y si AD devuelve un nombre distinto (`authService.ts:93` lo refresca en cada login), la persona pierde el acceso a sus propias notas. El módulo hermano `eventProspectsService.isInterestOwner:62-65` resuelve esto mismo priorizando el id y usando el nombre solo como fallback documentado.
**Severidad: Media**

**2.4.3 — `backend/src/app.ts:51` vs `backend/src/routes/users.ts:12`**
`/api/users` se monta **sin** guard a nivel de app; el único `requireRole('SSD')` está en el router (que sí lo aplica a las 4 rutas con `router.use`). Todos los demás routers operativos llevan además el `operationalRead` del montaje (`app.ts:42-48`).
Hoy es correcto y `tests/integration/rbac.test.ts` lo cubre, pero el módulo más sensible del sistema es el único protegido por una sola línea, y el comentario de `app.ts:50` afirma que hay dos capas.
**Severidad: Baja**

**2.4.4 — `backend/src/services/eventProspectsService.ts:291-293`**
Es el único servicio del backend que re-verifica el rol (`if (actor.role !== 'SSD')`); los otros ~40 métodos de servicio confían exclusivamente en el guard del router.
No es un hueco de permisos, sino una profundidad de defensa desigual: si alguien llama a un servicio desde otro servicio (como hace `eventsService.addSupplierToEvent → createSupplier`), solo este comprueba el rol.
**Severidad: Baja**

### 2.5 Concurrencia no documentada

Ninguno de estos casos está cubierto por las tres entradas de `backend/DEBT.md`.

**2.5.1 — `backend/src/services/suppliersService.ts:442-464`**
La rama `prelim_parts` ejecuta **su propio `$transaction`** (`deleteMany` + `createMany`) **dentro del bucle de ruteo de campos**, es decir antes del chequeo de `rejected` (líneas 492-496) y antes de la transacción principal (línea 582).
Un PATCH que traiga `prelim_parts` junto con una clave no permitida borra y reescribe todas las partes preliminares y **después** lanza el 400: la escritura ya se confirmó y no se revierte. Lo mismo ocurre si falla cualquier paso posterior de la transacción principal.
**Severidad: Alta**

**2.5.2 — `backend/src/services/suppliersService.ts:80-103` (`nextFolio`)**
Lee todos los folios, calcula el máximo y suma uno, todo **fuera de transacción**; `folio` es `@unique` (`schema.prisma:53`).
Dos `POST /api/suppliers` simultáneos calculan el mismo folio: el segundo revienta con un `P2002` crudo que el errorHandler traduce a un 500 `INTERNAL`, no a un 409 entendible. Con un equipo capturando en paralelo durante un evento de scouting es un escenario realista.
**Severidad: Media**

**2.5.3 — `backend/src/services/trackerService.ts:363-387` (`setParkingSubStatus`)**
Confirma su propia transacción (sub-status + historial) y **después**, si el valor es `'No Go'`, llama a `blacklistSupplier`, que abre una segunda transacción independiente.
Un fallo entre ambas deja al proveedor con sub-status "No Go" pero todavía `ACTIVE` y en Parking Lot: un estado que la UI muestra como rechazado pero que el tracker sigue contando como activo.
**Severidad: Media**

**2.5.4 — `backend/src/services/eventsService.ts:209-223` (`addSupplierToEvent`)**
`createSupplier` confirma su transacción y luego, por separado, se inserta el `eventSupplierEntry`.
Si la inserción del vínculo falla, queda un proveedor creado, con folio consumido, notificación enviada e historial escrito, pero sin relación con el evento del que nació — y el endpoint devuelve error, así que el usuario reintentará y creará un duplicado.
**Severidad: Media**

**2.5.5 — `backend/src/services/authService.ts:168-189` (`refresh`)**
Se busca el token, se comprueba que no esté revocado ni expirado, y sólo después se revoca y se emite el nuevo dentro de una transacción; nada impide que dos peticiones concurrentes con el mismo refresh token pasen ambas la comprobación.
Ambas obtienen tokens nuevos válidos: un refresh token robado y usado en paralelo con el legítimo no se detecta (no hay detección de reutilización).
**Severidad: Baja**

**2.5.6 — `backend/src/services/slaService.ts:29-99`**
Cada lectura recalcula el SLA y, si difiere, escribe; con el tablero completo eso puede ser un `$transaction` con N `update` en una petición **de lectura**.
Sobre los 533 proveedores reales, un `GET /api/suppliers` puede convertirse en cientos de escrituras, y dos lecturas concurrentes compiten por las mismas filas (el resultado es idempotente, así que no corrompe datos, pero sí genera contención).
**Severidad: Baja**

**2.5.7 — `backend/src/services/homeService.ts:10-18` y `backend/src/services/strategyService.ts:174-181`**
Ambos hacen `prisma.supplier.findMany()` **sin `where` de paginación**, cargando todas las filas con sus relaciones sólo para contar; `getCommodityDrilldown:229` además llama a `getStrategyOverview` completo y luego vuelve a consultar.
`/api/home/summary` es el endpoint que ve todo el mundo (incluido `Guest`) y es el más caro del sistema; con 533 proveedores ya es notable y crece linealmente.
**Severidad: Baja**

### 2.6 Configuración de entorno inconsistente

**2.6.1 — `backend/.env.example:26` y `:35` vs `backend/src/config/env.ts:16` y `:32`**
El ejemplo que todo el mundo copia trae `AUTH_MODE=mock` y `AUTH_OPTIONAL=true`, y el código usa exactamente esos mismos dos valores como *default* ante variable ausente.
Un despliegue hecho a partir del `.env.example` — o con un `.env` incompleto — arranca con autenticación opcional **y** LDAP simulado: cualquier petición sin token es `SSD`, y quien mande token puede entrar como `yael.urbano` con la contraseña `password`. Los dos valores más peligrosos son los dos defaults.
**Severidad: Alta**

**2.6.2 — `backend/src/config/env.ts:35` vs `backend/.env.example`**
El código lee `DEFAULT_APP_ROLE` (`source.DEFAULT_APP_ROLE ?? 'Guest'`) y `authService.ts:117` lo usa como `role: { connect: { name: env.defaultRole } }`, pero **la variable no aparece en `.env.example`** (sí está en el `.env` real, línea 39).
Nadie que configure el servidor desde el ejemplo sabe que existe; y si se define con un valor que no está en `C_Role`, el **primer login de cada usuario nuevo** falla con un error de Prisma que el errorHandler convierte en 500, sin que nada lo detecte al arrancar.
**Severidad: Media**

**2.6.3 — `backend/.env.example:17` → `backend/.env:18`**
El placeholder `JWT_SECRET=change-me-in-production` se copió tal cual al entorno que corre hoy contra `MX_MFGIT_SSD_TEST`, y `loadEnv` no lo rechaza.
*(Es el mismo hallazgo que §2.1.1, listado aquí porque el origen es la plantilla de configuración; contado una sola vez en el resumen.)*
**Severidad: Alta**

**2.6.4 — `backend/src/config/env.ts:26`, `:29`, `:30`**
`Number(source.PORT ?? 3000)`, `Number(source.JWT_EXPIRES_IN ?? 900)` y `Number(source.REFRESH_EXPIRES_DAYS ?? 7)` nunca comprueban `NaN`.
`PORT=abc` hace que `app.listen(NaN)` escuche en un puerto aleatorio (el servidor "arranca bien" y nadie lo encuentra); `JWT_EXPIRES_IN=abc` hace que `jwt.sign` lance en **cada** login; `REFRESH_EXPIRES_DAYS=abc` produce un `expiresAt` inválido en la base.
**Severidad: Media**

**2.6.5 — Todo `backend/src/`**
No existe `NODE_ENV` ni ninguna otra señal de entorno: `grep -rn "NODE_ENV" src` no devuelve nada.
Nada puede condicionarse a "estamos en producción", así que ninguno de los defaults peligrosos de §2.1.1–2.1.3 y §2.6.1 puede bloquearse ahí, ni pueden endurecerse mensajes de error o logs por entorno.
**Severidad: Media**

**2.6.6 — `backend/.env.example:8`**
`DATABASE_URL` apunta a `localhost:1433;database=ssd_pipeline`, una base que no existe en ningún punto del proyecto (las reales son `MX_MFGIT_SSD_TEST` y `MX_MFGIT_SSD`).
Quien siga el ejemplo apunta a una base inexistente y ve fallar el `startupCheck` sin pista de cuál es el nombre correcto.
**Severidad: Baja**

### 2.7 Diferencias TEST vs producción no documentadas

Se excluye todo lo ya cubierto por `backend/sql/prod/RUNBOOK_PROMOCION.md`.

**2.7.1 — `backend/prisma/seed.ts:582-588` (`seedDemoTrackerData`)**
Con `SEED_DEMO=true`, el seed ejecuta `eventB2BMeeting.deleteMany()`, `eventSupplierEntry.deleteMany()`, `eventNote.deleteMany()`, `event.deleteMany()`, **`supplier.deleteMany()`** (satélites en cascada), `strategyEntry.deleteMany()` y `mrlRequirement.deleteMany()` contra lo que sea que apunte `DATABASE_URL`. **No hay ninguna comprobación del nombre de la base** — ni siquiera la advertencia que `data-import/backfill-stage-entered-at.ts:29-30` sí documenta.
Una variable de entorno separa un seed normal de borrar los 533 proveedores reales, y el script está expuesto como `npm run seed` en `package.json:14`.
**Severidad: Alta**

**2.7.2 — `backend/src/server.ts:10-13` + `backend/src/auth/ldapClient.ts:114-168`**
`env.authMode === 'ldap' ? HttpLdapAuthClient : MockLdapAuthClient` — cualquier valor que no sea exactamente `'ldap'` (incluida la variable ausente, ver `env.ts:16`) selecciona el mock, que está compilado dentro de `dist/`.
En producción, un `.env` sin `AUTH_MODE` no falla ni avisa: simplemente sustituye Active Directory por cuatro usuarios fijos con contraseña `password`. El banner de `server.ts:26` imprime el modo, pero nada impide arrancar.
**Severidad: Alta**

**2.7.3 — `backend/package.json:13`**
`"prisma:push": "prisma db push"` está expuesto como script npm sin guarda alguna, mientras `backend/sql/README.md:1-5` establece que `db push` es exclusivo de TEST y que producción se aplica a mano, en orden de fecha.
La política documentada depende únicamente de que nadie escriba `npm run prisma:push` con el `.env` de producción cargado; el comando reescribiría el esquema saltándose los scripts de `sql/`.
**Severidad: Media**

**2.7.4 — `backend/data-import/*.ts` (`import-suppliers.ts:253`, `import-rest.ts:513`, `backfill-stage-entered-at.ts:66`)**
Los tres scripts se protegen con una variable de entorno (`IMPORT_REAL_DATA`, `BACKFILL_STAGE_ENTERED_AT`) pero leen `DATABASE_URL` del mismo `.env` que el servidor, sin verificar contra qué base están.
Con el `.env` de producción cargado, `IMPORT_REAL_DATA=true npm run import:suppliers` insertaría los proveedores del Excel directamente en `MX_MFGIT_SSD`.
**Severidad: Media**

**2.7.5 — `backend/src/config/startupCheck.ts:8-22`**
La verificación de drift cubre 3 modelos (`Supplier`, `Notification`, `SupplierEvalData`) de los ~36 del esquema.
Un `ALTER` pendiente en cualquier otra tabla no se detecta al arrancar sino la primera vez que un usuario abre la pantalla afectada, y aparece como 500. El propio comentario lo declara deliberado ("*just the ones that have already broken once*"), pero el riesgo aumenta con cada script nuevo en `sql/`.
**Severidad: Baja**

### 2.8 Dependencias riesgosas

**2.8.1 — `backend/package-lock.json` (6-jul) vs `package-lock.json` de la raíz (17-ago)**
El repo tiene **dos lockfiles**: la raíz declara `workspaces: ["frontend", "backend"]` (`package.json:6-9`) y su lock ya resuelve el workspace `backend`, pero `backend/package-lock.json` sigue ahí, seis semanas más viejo.
Según desde qué carpeta se corra `npm install`/`npm ci` se resuelve un árbol de dependencias distinto: el lock de la raíz ignora el anidado, y un `npm install` dentro de `backend/` ignora el de la raíz. En el servidor, "instalar dependencias" deja de ser una operación determinista.
**Severidad: Media**

**2.8.2 — `backend/package.json:26-31` y `:33-45`**
Todas las dependencias usan rangos caret (`^`), incluidas las de runtime: `@prisma/client ^5.22.0`, `express ^4.21.2`, `jsonwebtoken ^9.0.2`, `zod ^3.24.1`, `dotenv ^17.4.2`, más `prisma ^5.22.0` en devDependencies.
Un `npm install` (sin `ci`) en el servidor puede traer minors distintos de los probados; y el par `prisma`/`@prisma/client` **debe** ir en la misma versión — con dos carets independientes pueden desincronizarse en una instalación futura y romper la generación del cliente.
**Severidad: Media**

**2.8.3 — `backend/package.json` (ausencia de `engines`)**
No hay campo `engines`, ni en `backend/package.json` ni en el `package.json` de la raíz.
Nada declara ni verifica la versión de Node en el momento de instalar, así que el servidor puede quedarse con un runtime distinto del validado sin que `npm install` lo advierta.
*(La versión de Node en sí ya está reportada en `SSD_Pendientes_v2_0.md` §3.1; lo que se reporta aquí es la ausencia del campo que la fijaría.)*
**Severidad: Baja**

---

## Lo que NO se tocó y por qué

Elementos que aparecieron durante la revisión y que **no** se reportan como hallazgo
porque ya están registrados como decisión consciente:

- **Columnas del tab Visit bajo nombres `prelim_*` en el contrato de wire** — `SUPPLIER_EVAL_FIELDS` en `suppliersService.ts:266-272` agrupa claves `prelim_*` que escriben en `SupplierEvalData`, y `supplierMapper.ts:304-317` las lee de ahí. Cubierto por **`DEBT.md` §1** ("Visit-tab columns still live under `T_Supplier_PreliminaryData`"), Parte A completada y Parte B diferida a la promoción a producción.
- **`moveSupplierToStage` rechaza cualquier movimiento de un proveedor `BLACKLISTED`** (`trackerService.ts:73-75`) — sin ruta de reingreso al pipeline. Cubierto por **`DEBT.md` §2** ("Blacklisted suppliers cannot re-enter the active pipeline"), pendiente de confirmación de SSD/Itzel.
- **Agenda B2B duplicada entre `T_Event_Prospect` y `T_Event_B2BMeeting`** — `eventProspectsService.setProspectB2b:393-441` escribe columnas `B2b*` propias del prospecto en paralelo a la entidad de agenda real. Cubierto por **`DEBT.md` §3** ("B2B scheduling now exists in two tables").
- **Los 6 hallazgos de `SSD_Pendientes_v2_0.md` §3.1** (conteo de tablas, conteo de tests, versión de Node, `xlsx@0.18.5`, `sql/README.md` desincronizado, `README.md` raíz desactualizado) — excluidos por instrucción. Se confirmó de paso que `sql/README.md` sigue marcando `2026-08-13_add_event_prospect.sql` como "⬜ Pendiente" en TEST cuando el modelo `EventProspect` ya está en el esquema y en uso, pero eso es exactamente el punto ya reportado.
- **Diferencias TEST vs PROD ya cubiertas en `sql/prod/RUNBOOK_PROMOCION.md`** — excluidas por instrucción. Los cinco puntos de §2.7 son ajenos a ese runbook (borrado por seed, selección del cliente LDAP mock, script `prisma:push` sin guarda, scripts de `data-import` sin verificación de base, y cobertura parcial del `startupCheck`).
- **El token en `localStorage`** — es frontend y ya está documentado.

### Nota al margen (frontend — fuera del cuerpo del reporte)

`backend/README.md` §5 afirma que *"~19 archivos de páginas/componentes del frontend
siguen importando `backend/prisma/fixtures/*.ts` directamente"*. **Verificado: ya no es
cierto** — la única aparición en `frontend/src` es un comentario en
`frontend/src/constants/stage-config.ts:23`, no un `import`. Se anota porque cambia la
recomendación de §1.7.5: los fixtures pueden salir del path de deploy sin tocar el
frontend, y sólo hay que atender la dependencia de `prisma/seed.ts` y del test
`tests/unit/seedDemoData.test.ts`.
