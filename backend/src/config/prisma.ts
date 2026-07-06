import { PrismaClient } from '@prisma/client';

// Single shared client for the real server process.
// Services never import this directly — they receive a client via DI
// (createApp / createServices), which is what makes them testable.
export const prisma = new PrismaClient();
