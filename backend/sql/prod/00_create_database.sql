/* ============================================================================
   00_create_database.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Crea la base de datos de PRODUCCIÓN: MX_MFGIT_SSD.

   Ejecutar UNA vez, conectado al contexto [master], antes de cualquier otro
   script de esta carpeta. Los scripts 01..06 se ejecutan después, en orden,
   con el contexto ya puesto en MX_MFGIT_SSD.

   Esta carpeta es SOLO para producción. MX_MFGIT_SSD_TEST ya existe y se
   mantiene con `npx prisma db push` — no correr estos scripts contra TEST.

   Tamaños y autogrowth: no se fijan aquí a propósito. El volumen esperado es
   bajo (≈533 proveedores + historial), así que los defaults de la instancia
   son suficientes. Si Nexteer tiene lineamientos propios de tamaño inicial /
   autogrowth para esta instancia, Leo los aplica aquí.

   RECOVERY SIMPLE: elegido porque no hay requisito de recuperación
   point-in-time para esta aplicación y evita el crecimiento del log de
   transacciones sin backups de log programados. Si IT define una política de
   respaldo con log backups, cambiar a FULL.
============================================================================ */

USE [master];
GO

IF DB_ID('MX_MFGIT_SSD') IS NULL
BEGIN
    CREATE DATABASE [MX_MFGIT_SSD];
    PRINT 'MX_MFGIT_SSD creada.';
END
ELSE
    PRINT 'MX_MFGIT_SSD ya existe — no se hace nada.';
GO

ALTER DATABASE [MX_MFGIT_SSD] SET RECOVERY SIMPLE;
GO

-- Requerido por Prisma para lecturas sin bloqueo de escritores.
-- MX_MFGIT_SSD_TEST corre con esta misma configuración.
ALTER DATABASE [MX_MFGIT_SSD] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

PRINT 'Listo. Continuar con 01_create_tables.sql sobre MX_MFGIT_SSD.';
GO
