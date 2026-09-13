import { Logger } from '@nestjs/common';
import postgres from '@prisma/orm-postgres/runtime';
import 'temporal-polyfill/global';
import type { Contract } from '@/prisma/contract';
import contractJson from '@/prisma/contract.json';

const logger = new Logger('PrismaDatabase');
const databaseUrl = process.env.DATABASE_URL;
let databaseTarget =
  'Prisma runtime default (DATABASE_URL was not set at client creation)';

if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const port = url.port || '5432';
    const database = url.pathname.replace(/^\//, '') || '(none)';
    const schema = url.searchParams.get('schema') ?? 'public';

    databaseTarget = `${url.hostname}:${port}/${database}?schema=${schema}`;
  } catch {
    databaseTarget = 'configured, but URL could not be parsed (value redacted)';
  }
}

logger.log(`Database target: ${databaseTarget}`);

export const db = databaseUrl
  ? postgres<Contract>({ contractJson, url: databaseUrl })
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
