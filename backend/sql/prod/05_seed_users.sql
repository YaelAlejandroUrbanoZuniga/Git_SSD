/* ============================================================================
   05_seed_users.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Pre-aprovisiona los 21 usuarios reales del equipo GSM, por correo.

   Lista extraída de backend/prisma/seed.ts (REAL_USERS). Ver la nota de RUTA
   PRIMARIA en 04_seed_catalogs.sql: `npm run seed` hace exactamente esto y es
   lo preferido cuando el backend está disponible.

   POR QUÉ EL USERNAME ES 'pending:<parte local del correo>'. El servicio LDAP
   identifica a cada persona por su netid corporativo (ej. 'GZJGZE'), que no
   tiene ninguna relación con su correo, y solo lo revela en el login. Adivinar
   el username nunca empataba, así que la persona se recreaba como Guest en cada
   login — bug real detectado y corregido. El emparejamiento se hace por Email;
   'pending:' es un valor que jamás podría coincidir por accidente con un netid
   real, y el primer login verdadero lo reemplaza por el netid y NUNCA toca el
   rol.

   PK_User: se genera con NEWID(). El formato del id no lo interpreta nadie —
   la aplicación lo trata como opaco. `npm run seed` usaría cuid() en su lugar;
   ambos son válidos y pueden convivir en la misma tabla.

   Idempotente por Email. Re-ejecutar no duplica ni pisa el rol de nadie: si la
   persona ya existe (aunque su username ya sea el netid real), se omite.
============================================================================ */

USE [MX_MFGIT_SSD];
GO

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'miguel.angel.camacho@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:miguel.angel.camacho', N'Miguel Angel Camacho', N'miguel.angel.camacho@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'PM';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'lucia.morales@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:lucia.morales', N'Lucia Morales', N'lucia.morales@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'PM';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'christianarturo.armendariz@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:christianarturo.armendariz', N'Christian Arturo Armendariz', N'christianarturo.armendariz@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'PM';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'ivan.aguila@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:ivan.aguila', N'Ivan Aguila', N'ivan.aguila@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'PM';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'jaime.cabrera@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:jaime.cabrera', N'Jaime Cabrera', N'jaime.cabrera@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'PM';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'fernando.ramos@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:fernando.ramos', N'Fernando Ramos', N'fernando.ramos@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'miguel.molina@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:miguel.molina', N'Miguel Angel Molina', N'miguel.molina@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'antonio.toscano@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:antonio.toscano', N'Antonio Toscano', N'antonio.toscano@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'kenia.hernandez@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:kenia.hernandez', N'Kenia Hernandez', N'kenia.hernandez@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'oscar.alejandro.sanchez@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:oscar.alejandro.sanchez', N'Oscar Alejandro Sanchez', N'oscar.alejandro.sanchez@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'diego.campos@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:diego.campos', N'Diego Campos', N'diego.campos@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'agustin.carvalho@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:agustin.carvalho', N'Agustin Antonio Carvalho', N'agustin.carvalho@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'fernanda.merlo@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:fernanda.merlo', N'Fernanda Merlo', N'fernanda.merlo@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'ivan.mendoza.guadarrama@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:ivan.mendoza.guadarrama', N'Ivan Mendoza', N'ivan.mendoza.guadarrama@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'miguel.angel.guzman@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:miguel.angel.guzman', N'Miguel Angel Guzman', N'miguel.angel.guzman@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'Buyer';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'ramon.gutierrez@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:ramon.gutierrez', N'Ramon Gutierrez', N'ramon.gutierrez@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'SQD';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'vianey.perea@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:vianey.perea', N'Vianey Perea', N'vianey.perea@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'SSD';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'itzel.campos@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:itzel.campos', N'Itzel Campos', N'itzel.campos@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'SSD';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'lorena.luna@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:lorena.luna', N'Lorena Luna', N'lorena.luna@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'SSD';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'marissa.hernandez@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:marissa.hernandez', N'Marissa Hernandez', N'marissa.hernandez@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'SSD';

IF NOT EXISTS (SELECT 1 FROM [C_User] WHERE [Email] = N'yael.urbano@nexteer.com')
    INSERT INTO [C_User] ([PK_User], [Username], [DisplayName], [Email], [FK_Role], [CreatedDt])
    SELECT LOWER(CONVERT(NVARCHAR(50), NEWID())), N'pending:yael.urbano', N'Yael Urbano', N'yael.urbano@nexteer.com', r.[PK_Role], SYSDATETIME()
    FROM [C_Role] r WHERE r.[Name] = N'SSD';

GO

PRINT 'Usuarios pre-aprovisionados. Continuar con 06_verify_schema.sql.';
GO
