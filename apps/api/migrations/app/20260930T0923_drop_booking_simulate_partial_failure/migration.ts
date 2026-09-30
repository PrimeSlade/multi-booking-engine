#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/87ff4d62c5b4b9bc6ef91072404dd386d4878b87065577434ee082a5c150232d/contract';
import startContract from '../../snapshots/87ff4d62c5b4b9bc6ef91072404dd386d4878b87065577434ee082a5c150232d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d4d81d9bd359840df03fbc821eb5d83d16816a135a9bc8f27d506c720a9226d7/contract';
import endContract from '../../snapshots/d4d81d9bd359840df03fbc821eb5d83d16816a135a9bc8f27d506c720a9226d7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({
        schema: 'public',
        table: 'booking',
        column: 'simulate_partial_failure',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
