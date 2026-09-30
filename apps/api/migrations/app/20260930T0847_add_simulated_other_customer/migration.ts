#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/87ff4d62c5b4b9bc6ef91072404dd386d4878b87065577434ee082a5c150232d/contract';
import endContract from '../../snapshots/87ff4d62c5b4b9bc6ef91072404dd386d4878b87065577434ee082a5c150232d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/921d5b82b06f982c40b869130d08de8f101c38bbefc649077a02852d3b33b824/contract';
import startContract from '../../snapshots/921d5b82b06f982c40b869130d08de8f101c38bbefc649077a02852d3b33b824/contract.json' with { type: 'json' };
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
        table: 'flight_booking',
        column: col('simulate_taken_by_other', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'flight_booking',
        column: col('simulated_taken_count', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'hotel_booking',
        column: col('simulate_taken_by_other', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'hotel_booking',
        column: col('simulated_taken_count', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
