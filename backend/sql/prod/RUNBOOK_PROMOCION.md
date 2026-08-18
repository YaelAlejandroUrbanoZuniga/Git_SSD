# RUNBOOK — Promoción a producción (`MX_MFGIT_SSD`)

**Alcance:** crear la base de datos de producción desde cero, verificarla, conectar la
aplicación y cargar los datos reales.
**Duración estimada:** 3–4 h de trabajo efectivo (sin contar la espera por el servidor).
**Quién:** Yael ejecuta · Leo (IT) provee host, permisos y respaldo.

> **Regla que no se rompe:** `npx prisma db push` **nunca** se corre contra
> `MX_MFGIT_SSD`. Destruiría los dos filtered unique indexes de `C_User`, que no
> existen en `schema.prisma` y sin los cuales el segundo usuario con `AdObjectId`
> nulo revienta el INSERT. TEST usa `db push`; producción usa estos scripts.

---

## 0. Precondiciones

Antes de tocar nada, confirmar los cinco puntos:

- [ ] Permisos `CREATE DATABASE` en la instancia de SQL Server.
- [ ] TCP/IP habilitado y puerto conocido (1433 por defecto).
- [ ] La rama `dev` del repo está en el commit que se va a promover; anotarlo aquí:
      `___________`
- [ ] `backend/sql/README.md` revisado: los 11 scripts fechados de agosto **ya están
      incluidos en este baseline**, así que no se aplican por separado. Ver §6.
- [ ] Ventana acordada con Itzel: durante la migración de datos nadie usa TEST para
      capturar información que después haya que reconciliar a mano.

> **⚠ Prisma engine / proxy corporativo (Zscaler) — leer antes de tocar el host de
> producción.** `npm ci` en el host del backend borra y reinstala `node_modules`,
> lo que elimina el cliente de Prisma ya generado (`node_modules/.prisma/`).
> `npm run prisma:generate` debe correr de nuevo después de cada `npm ci`, y ese
> comando descarga un binario de `binaries.prisma.sh` — si el host de producción
> está detrás del mismo Zscaler que intercepta TLS en los equipos de desarrollo,
> la descarga falla con *"unable to get local issuer certificate"* a menos que se
> exporte el certificado raíz de Zscaler a un `.pem` y se apunte
> `NODE_EXTRA_CA_CERTS` a ese archivo antes de correr comandos de Prisma. Ver el
> detalle completo en [`backend/README.md`](../../README.md#prerequisites) — la
> forma de exportar el certificado es específica de cada máquina, no del proyecto
> (documentación de Zscaler o IT). Confirmar esto con Leo **antes** de la fecha de
> provisión, no el día mismo.

---

## 1. Crear la base y la estructura

Conectado a la instancia desde SSMS, en orden estricto. Cada script imprime al final
cuál es el siguiente.

| # | Script | Contexto | Qué hace |
|---|---|---|---|
| 1 | `00_create_database.sql` | `master` | Crea `MX_MFGIT_SSD`, recovery SIMPLE, RCSI on |
| 2 | `01_create_tables.sql` | `MX_MFGIT_SSD` | 36 tablas |
| 3 | `02_create_foreign_keys.sql` | `MX_MFGIT_SSD` | 44 llaves foráneas |
| 4 | `03_create_indexes.sql` | `MX_MFGIT_SSD` | 18 índices + 2 filtered unique + INCLUDE |

**Los cuatro son idempotentes.** Si uno falla a la mitad, se corrige la causa y se
vuelve a correr completo — no hace falta borrar la base.

**Verificación intermedia:** después del 03, correr las secciones 1 y 5 de
`06_verify_schema.sql`. Estructura 36/443/36/44/18/2 y los dos filtros visibles.

---

## 2. Sembrar catálogos y usuarios

**Dos rutas. Elegir una, no las dos.**

### Ruta A — desde el backend (preferida)

```bash
# En el host donde vive el backend, con DATABASE_URL apuntando a MX_MFGIT_SSD
cd backend
npm run seed          # SIN SEED_DEMO. El default correcto ya es no cargar demo.
```

Es el mismo código que la aplicación valida, es idempotente y no borra nada.
**Nunca correr `SEED_DEMO=true` contra producción** — eso *borra y resiembra*
proveedores, eventos y estrategia con datos ficticios.

### Ruta B — solo SSMS (si el host de BD no tiene el backend)

| # | Script | Qué hace |
|---|---|---|
| 5 | `04_seed_catalogs.sql` | 9 catálogos: 37 commodities, 7 etapas, 5 roles, etc. |
| 6 | `05_seed_users.sql` | 21 usuarios reales, pre-aprovisionados por correo |

Ambos son idempotentes y se saltan lo que ya exista, así que correr A y luego B no
rompe nada — pero mantener dos rutas es exactamente lo que desincronizó la versión
anterior de estos scripts. Documentar cuál se usó.

**Verificación:** correr `06_verify_schema.sql` completo. Todo debe decir `OK`.
Especial atención a las tres verificaciones críticas de la sección 3: `Guest` en
`C_Role`, el placeholder `TBD -- Pending GSM` en `C_Commodity`, y el orden
*Subcategoría -- Categoría* de los commodities.

---

## 3. Conectar la aplicación

Cambiar en el `.env` de producción — **no en el repo**:

| Variable | Valor de producción | Por qué |
|---|---|---|
| `DATABASE_URL` | cadena a `MX_MFGIT_SSD` | — |
| `AUTH_OPTIONAL` | `false` | Con `true`, un request sin token se atribuye al usuario demo |
| `AUTH_MODE` | `ldap` | `mock` acepta la contraseña literal `password` |
| `LDAP_API_URL` | URL real del servicio FastAPI | El server se niega a arrancar sin ella en modo ldap |
| `JWT_SECRET` | secreto real, generado, fuera del repo | El default es `change-me-in-production` |
| `CORS_ORIGIN` | hostname real del frontend | — |
| `PORT` | 3000 (o el que asigne IT) | — |

Arrancar el backend. `verifyDatabaseSchema()` corre **antes** de `app.listen()`: si
falta una columna, el proceso sale con el modelo que falló en vez de escuchar roto.

- [ ] El backend arranca sin errores de esquema.
- [ ] **El banner de advertencia de `AUTH_OPTIONAL` NO aparece.** Si aparece, la
      variable quedó en `true` — detener y corregir antes de seguir.
- [ ] `GET /api/suppliers` sin token devuelve **401**.
- [ ] Login real con una cuenta de AD funciona y el rol que llega es el sembrado.

---

## 4. Migrar los datos reales

**Esto es un bloque aparte y depende de que Itzel entregue los 5 Excel actualizados.**
No forma parte de la creación de la base.

```bash
# 1. Colocar los 5 .xlsx en backend/data-import/source/
# 2. Diff de encabezados contra la corrida de julio ANTES de ejecutar nada
npm run import:parse                                                        # produce JSON + import-report.md, no toca la BD
# 3. Revisar import-report.md: conteos, fusiones, truncamientos, commodities TBD
IMPORT_REAL_DATA=true ALLOW_PRODUCTION_IMPORT=true npm run import:suppliers  # inserta proveedores
IMPORT_REAL_DATA=true ALLOW_PRODUCTION_IMPORT=true npm run import:rest      # eventos, MRL, backfill de historial
```

**Por qué dos banderas y no una:** `IMPORT_REAL_DATA=true` le dice al script "sí, quiero
correr la importación de verdad" (sin ella, corre en modo simulado). `ALLOW_PRODUCTION_IMPORT=true`
es un opt-in aparte y dice "sí, sé que esto va a escribir en producción" — `assertWritableDatabase()`
(`backend/src/config/testDatabaseGuard.ts`) lo exige específicamente cuando `DATABASE_URL` no
apunta a una base `_TEST`; sin ella el script aborta con un mensaje explícito, aunque
`IMPORT_REAL_DATA=true` ya esté puesta. Mantenerlas separadas evita que un `.env` mal copiado
escriba en producción por accidente solo porque alguien quería correr la importación real en TEST.

**Riesgo conocido:** `parse.ts` está acoplado a la estructura *anterior* de los
archivos. Si GSM movió, renombró o insertó columnas, el parser rompe o —peor— importa
mal en silencio. Presupuestar tiempo de reparación, no solo de ejecución. Por eso el
paso 2 (diff de encabezados) no es opcional.

**No hace falta `backfill-stage-entered-at.ts`.** Ese script fue una recuperación
puntual para datos que se importaron a TEST antes de que `import-rest.ts` aprendiera a
escribir `StageEnteredAt`. En una base nueva, la importación ya lo escribe.

**Verificación:**
- [ ] Conteos por etapa, por commodity y por status revisados y firmados por Itzel.
- [ ] Cero proveedores con campos obligatorios vacíos de su etapa actual.
- [ ] Registrado cuántos quedaron en `TBD -- Pending GSM` y comunicado a GSM.
- [ ] `GET /api/reports/weekly/latest` devuelve una progresión coherente.

---

## 5. Rollback

**Antes de la migración de datos** (pasos 1–3): la base está vacía de transaccional.
Rollback = `DROP DATABASE MX_MFGIT_SSD` y volver a empezar. Costo: minutos.

**Después de la migración de datos** (paso 4): rollback = restaurar el respaldo tomado
inmediatamente antes de correr los importadores.

```sql
-- Tomar ESTE respaldo antes de import:suppliers. No es opcional.
BACKUP DATABASE [MX_MFGIT_SSD]
TO DISK = N'<ruta que Leo indique>\MX_MFGIT_SSD_pre_import.bak'
WITH INIT, COMPRESSION, NAME = N'Pre-migración de Excel';
```

Los importadores son idempotentes y no destructivos (nunca `deleteMany`), así que una
corrida parcial se puede terminar sin restaurar. El respaldo cubre el caso distinto:
que los datos entren **completos pero mal** por un cambio de estructura en los Excel.

- [ ] Respaldo pre-importación tomado y su ruta registrada aquí: `___________`
- [ ] Persona designada para restaurarlo si hace falta: `___________`

---

## 6. Cerrar el registro

Al terminar, en el mismo commit:

- [ ] `backend/sql/README.md` — marcar los 11 scripts fechados como **incluidos en el
      baseline de producción**, no como pendientes de aplicar uno por uno. El baseline
      de esta carpeta ya contiene su resultado final.
- [ ] `backend/sql/CAMBIOS_ESQUEMA.md` — anotar la fecha de promoción y el commit
      exacto desde el que se generó el baseline.
- [ ] `backend/DEBT.md` — la entrada 1 (columnas del tab Visit) tiene como disparador
      **precisamente esta promoción**. Su Parte B (renombrar el contrato de cable
      `prelim_*` → `eval_*`) se resuelve aquí o se re-documenta con un disparador nuevo
      y honesto. No dejarla con un disparador que ya ocurrió.
- [ ] Este runbook — anotar fecha real de ejecución, quién lo corrió y cualquier
      desviación.

---

## Apéndice — Diferencias deliberadas entre TEST y PROD

| Aspecto | `MX_MFGIT_SSD_TEST` | `MX_MFGIT_SSD` |
|---|---|---|
| Cómo se construyó | `npx prisma db push` | Estos scripts, a mano |
| `IX_SupplierHistory_Date_ToStage` | sin columnas INCLUDE (Prisma no las declara) | **con** INCLUDE |
| Filtered unique indexes de `C_User` | creados a mano, sobreviven mientras nadie repita `db push` | creados por el script 03 |
| Datos demo | pueden existir (`SEED_DEMO=true`) | nunca |
| Nombres de constraints | los que genera Prisma | nomenclatura Nexteer (`PK_`, `FK_`, `UQ_`, `DF_`) |

Ninguna de estas diferencias afecta a la aplicación: Prisma no valida nombres de
constraints y las columnas INCLUDE solo cambian el plan de ejecución. Están listadas
para que nadie las lea como una desviación accidental.
