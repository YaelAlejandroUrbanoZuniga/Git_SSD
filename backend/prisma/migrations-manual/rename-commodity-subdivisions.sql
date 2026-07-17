-- ─────────────────────────────────────────────────────────────────────────
-- Rename the 7 subdivided C_Commodity values to "Subcategory -- Category" order
-- (GSM request, 2026-07-17).
--
-- Applies to MX_MFGIT_SSD_TEST now, and to MX_MFGIT_SSD (production) later when
-- the change is promoted.
--
-- Safe to run WITHOUT re-seeding: this UPDATEs the Name column only. Every FK in
-- T_Supplier / T_Strategy_Entry / T_Supplier_MrlRequirement points at
-- PK_Commodity (the id), not the name, so no relations are touched.
--
-- Idempotent: each UPDATE is guarded by WHERE Name = '<old value>', so running
-- it twice (or after the value is already renamed) affects 0 rows and errors out
-- on nothing.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE C_Commodity SET Name = 'CCA -- Controllers'                    WHERE Name = 'Controllers -- CCA';
UPDATE C_Commodity SET Name = 'MSB -- Controllers'                    WHERE Name = 'Controllers -- MSB';
UPDATE C_Commodity SET Name = 'PHA -- Controllers'                    WHERE Name = 'Controllers -- PHA';
UPDATE C_Commodity SET Name = 'Headers -- E-Mechanical Components'    WHERE Name = 'E-Mechanical Components -- Headers';
UPDATE C_Commodity SET Name = 'Connectors -- E-Mechanical Components' WHERE Name = 'E-Mechanical Components -- Connectors';
UPDATE C_Commodity SET Name = 'Leadframe -- E-Mechanical Components'  WHERE Name = 'E-Mechanical Components -- Leadframe';
UPDATE C_Commodity SET Name = 'PCB -- E-Mechanical Components'        WHERE Name = 'E-Mechanical Components -- PCB';

-- Verification: should return the 7 new names, and zero rows for the old ones.
SELECT Name FROM C_Commodity
WHERE Name IN (
  'CCA -- Controllers', 'MSB -- Controllers', 'PHA -- Controllers',
  'Headers -- E-Mechanical Components', 'Connectors -- E-Mechanical Components',
  'Leadframe -- E-Mechanical Components', 'PCB -- E-Mechanical Components'
)
ORDER BY Name;
