# backend/sql — manual migration scripts

TEST (`MX_MFGIT_SSD_TEST`) picks up schema changes via `npx prisma db push`, so
these scripts already ran there implicitly. `MX_MFGIT_SSD` (production) does
not use `db push` — every script here must be applied **by hand, in date
order**, during promotion.

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
