#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0432943f75a24abc37c443768fcbd997fc5b4bdd2d2c5ce0f54e7369d292e076/contract';
import startContract from '../../snapshots/0432943f75a24abc37c443768fcbd997fc5b4bdd2d2c5ce0f54e7369d292e076/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/921d5b82b06f982c40b869130d08de8f101c38bbefc649077a02852d3b33b824/contract';
import endContract from '../../snapshots/921d5b82b06f982c40b869130d08de8f101c38bbefc649077a02852d3b33b824/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  lit,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'booking',
        column: col('simulate_partial_failure', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
