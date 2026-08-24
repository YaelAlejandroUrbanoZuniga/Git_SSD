# backend/sql — manual migration scripts

TEST (`MX_MFGIT_SSD_TEST`) picks up schema changes via `npx prisma db push`, so
these scripts already ran there implicitly. `MX_MFGIT_SSD` (production) does
not use `db push` — every script here must be applied **by hand, in date
order**, during promotion.

> ⚠ **`npm run prisma:push:test-only` NUNCA debe correrse con el `.env` de
> producción cargado.** `prisma db push` reescribe el esquema de la base a la que
> apunte `DATABASE_URL`, saltándose por completo los scripts de esta carpeta y el
> orden por fecha que la promoción a producción exige. El script npm lleva el
> sufijo `:test-only` justamente para que no se teclee por inercia; el nombre es
> la única guarda que tiene, así que verifica qué `.env` está cargado antes de
> ejecutarlo.

This table is maintained **manually**. It does not autogenerate from the
`sql/` folder — update it whenever a script is added here, or whenever one is
actually run against `MX_MFGIT_SSD`.

| Script | Descripción breve | Aplicado en TEST | Aplicado en PROD (MX_MFGIT_SSD) |
| --- | --- | --- | --- |
| `2026-07-22_add_supervisorname.sql` | Agrega `SupervisorName` a `C_User` (LDAP supervisor/manager name). | ✅ | ⬜ Pendiente |
| `2026-07-23_add_intelex_currentlevel.sql` | Agrega `CurrentLevel` a `T_Supplier_IntelexData` (sub-status Investigate→L0…L4→Completed). | ✅ | ⬜ Pendiente |
| `2026-07-23_drop_event_topcommodity.sql` | Elimina `TopCommodity` de `T_Event` (campo retirado del modelo). | ✅ | ⬜ Pendiente |
| `2026-07-23_revert_citlaly_to_guest.sql` | Data fix puntual: revierte a un usuario de rol SSD a Guest. | ✅ | ⬜ Pendiente |
| `2026-08-07_add_notification_category.sql` | Agrega `Category` a `T_User_Notification` (qué pasó, separado de la severidad `Type`). | ✅ | ⬜ Pendiente |
| `2026-08-07_move_visit_tab_and_add_costmodel.sql` | Agrega `CostModel`/`TabVisit` a `T_Supplier_EvaluationData`, migra el flag de completado del tab Visit y hace backfill. | ✅ | ⬜ Pendiente |
| `2026-08-10_backfill_notification_category.sql` | Backfill de `Category` en notificaciones creadas antes del 2026-08-07. | ✅ | ⬜ Pendiente |
| `2026-08-10_add_filtered_unique_indexes_cuser.sql` | Recrea los filtered unique indexes de `C_User` (`Email`, `AdObjectId`) que hoy solo existen manualmente en TEST. | ✅ | ⬜ Pendiente |
| `2026-08-11_add_intelex_efficiencyglobal.sql` | Agrega `EfficiencyGlobal` a `T_Supplier_IntelexData` (promedio de las eficiencias por nivel, que además pasan a calcularse con la fórmula escalonada Expected-vs-Real del Excel del equipo). | ✅ | ⬜ Pendiente |
| `2026-08-13_add_event_prospect.sql` | Crea `T_Event_Prospect` (prospectos pre-evento importados desde Excel, con marca de interés de un solo dueño y agenda B2B). No toca `T_Supplier`. | ⬜ Pendiente | ⬜ Pendiente |
| `2026-08-13_drop_role_rasic_assignment.sql` | Elimina `T_Role_RasicAssignment` (scaffold RASIC sin uso; el modelo de permisos es el flat SSD-write / resto-read). | ⬜ Pendiente | ⬜ Pendiente |
| `2026-08-17_add_note_authorid.sql` | Agrega `FK_AuthorUser` (nullable) a `T_Supplier_Note` y `T_Event_Note`: la propiedad de una nota pasa a comprobarse por id de usuario, con `Author` (nombre para mostrar) sólo como fallback documentado. Sin backfill. | ✅ | ➖ No aplica — ya plegado al baseline |

**`2026-08-17_add_note_authorid.sql` ya no hay que correrlo a mano en
producción.** Era el único script fechado que no estaba reflejado en
`sql/prod/`: la columna `FK_AuthorUser` y sus dos FKs
(`FK_SupplierNote_AuthorUser`, `FK_EventNote_AuthorUser`) ahora se crean
directamente en `01_create_tables.sql` y `02_create_foreign_keys.sql`, con los
mismos nombres y tipos que usa este script. Una base recién construida desde
`sql/prod/` ya los tiene; correr el script encima es inofensivo (es idempotente)
pero redundante.
