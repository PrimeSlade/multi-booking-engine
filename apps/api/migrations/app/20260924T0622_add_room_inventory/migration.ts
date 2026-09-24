#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0432943f75a24abc37c443768fcbd997fc5b4bdd2d2c5ce0f54e7369d292e076/contract';
import endContract from '../../snapshots/0432943f75a24abc37c443768fcbd997fc5b4bdd2d2c5ce0f54e7369d292e076/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a616477d2bfa7cc4f32bedcfd728aa4161e51ac5c610ffe603cfc27ac4aa7a2f/contract';
import startContract from '../../snapshots/a616477d2bfa7cc4f32bedcfd728aa4161e51ac5c610ffe603cfc27ac4aa7a2f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  lit,
  rawSql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'room',
        column: col('rooms_left', 'int4', {
          notNull: true,
          default: lit(10),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      rawSql({
        id: 'data.room.rooms_left',
        label: 'Backfill room inventory from availability',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: {
            schema: 'public',
            objectType: 'column',
            name: 'rooms_left',
            table: 'room',
          },
        },
        precheck: [
          {
            description: 'ensure room inventory columns exist',
            sql: 'SELECT (COUNT(*) = 2) AS "result" FROM "information_schema"."columns" WHERE "table_schema" = \'public\' AND "table_name" = \'room\' AND "column_name" IN (\'available\', \'rooms_left\')',
          },
        ],
        execute: [
          {
            description: 'map available rooms to 10 and unavailable rooms to 0',
            sql: 'UPDATE "public"."room" SET "rooms_left" = CASE WHEN "available" THEN 10 ELSE 0 END',
          },
        ],
        postcheck: [
          {
            description: 'verify room inventory matches prior availability',
            sql: 'SELECT NOT EXISTS (SELECT 1 FROM "public"."room" WHERE ("available" AND "rooms_left" <> 10) OR (NOT "available" AND "rooms_left" <> 0)) AS "result"',
          },
        ],
      }),
      this.dropColumn({ schema: 'public', table: 'room', column: 'available' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
