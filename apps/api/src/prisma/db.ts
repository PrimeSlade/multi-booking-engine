import postgres from '@prisma/orm-postgres/runtime';
import 'temporal-polyfill/global';
import type { Contract } from '@/prisma/contract';
import contractJson from '@/prisma/contract.json';

export const db = process.env.DATABASE_URL
  ? postgres<Contract>({ contractJson, url: process.env.DATABASE_URL })
  : postgres<Contract>({ contractJson });

let connection: Promise<void> | undefined;

export function connectDatabase(): Promise<void> {
  connection ??= db
    .connect()
    .then(() => undefined)
    .catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
  return connection;
}

export function disconnectDatabase(): Promise<void> {
  return db.close();
}
