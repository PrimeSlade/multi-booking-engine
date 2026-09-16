#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/12b45558cc3dcd10f63df50c5063fb488432b52f5f99f8684f55d467cbbcf05f/contract';
import startContract from '../../snapshots/12b45558cc3dcd10f63df50c5063fb488432b52f5f99f8684f55d467cbbcf05f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ac3ba3170ccbf404b109f489d783899539e7264677b26c4c6ad6dc858eb940ba/contract';
import endContract from '../../snapshots/ac3ba3170ccbf404b109f489d783899539e7264677b26c4c6ad6dc858eb940ba/contract.json' with { type: 'json' };
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
      this.dropColumn({
        schema: 'public',
        table: 'booking',
        column: 'products',
      }),
      this.dropColumn({
        schema: 'public',
        table: 'booking_step',
        column: 'product',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'booking_step',
        constraint: 'booking_step_booking_id_step_name_key',
      }),
      this.createTable({
        schema: 'public',
        table: 'booking_item',
        columns: [
          col('booking_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('check_in', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('check_out', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('departure_date', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('destination', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('flight_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('flight_number', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hotel_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hotel_name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('origin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('passengers', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('room_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('room_type', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rooms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('type', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'booking_step',
        column: col('booking_item_id', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'booking_step',
        constraint: 'booking_step_booking_id_step_name_booking_item_id_key',
        columns: ['booking_id', 'step_name', 'booking_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_item',
        index: 'booking_item_booking_id_idx_aeea169b',
        columns: ['booking_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_booking_item_id_idx_5072c4d1',
        columns: ['booking_item_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_item',
        foreignKey: {
          name: 'booking_item_booking_id_fkey',
          columns: ['booking_id'],
          references: { schema: 'public', table: 'booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_step',
        foreignKey: {
          name: 'booking_step_booking_item_id_fkey',
          columns: ['booking_item_id'],
          references: {
            schema: 'public',
            table: 'booking_item',
            columns: ['id'],
          },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
