import { PrismaClient } from '@prisma/client';

// Shared client for the server process (services get theirs via DI).
export const prisma = new PrismaClient();
