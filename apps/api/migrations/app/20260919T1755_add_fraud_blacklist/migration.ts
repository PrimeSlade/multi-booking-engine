#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/20d08b762e23a247a5236607c810261051fe8a97a9eb1e74b07e5a76eccd5bc3/contract';
import startContract from '../../snapshots/20d08b762e23a247a5236607c810261051fe8a97a9eb1e74b07e5a76eccd5bc3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a616477d2bfa7cc4f32bedcfd728aa4161e51ac5c610ffe603cfc27ac4aa7a2f/contract';
import endContract from '../../snapshots/a616477d2bfa7cc4f32bedcfd728aa4161e51ac5c610ffe603cfc27ac4aa7a2f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'fraud_blacklist',
        columns: [
          col('user_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['user_id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
