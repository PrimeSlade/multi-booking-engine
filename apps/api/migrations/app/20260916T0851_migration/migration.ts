#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/20d08b762e23a247a5236607c810261051fe8a97a9eb1e74b07e5a76eccd5bc3/contract';
import endContract from '../../snapshots/20d08b762e23a247a5236607c810261051fe8a97a9eb1e74b07e5a76eccd5bc3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ac3ba3170ccbf404b109f489d783899539e7264677b26c4c6ad6dc858eb940ba/contract';
import startContract from '../../snapshots/ac3ba3170ccbf404b109f489d783899539e7264677b26c4c6ad6dc858eb940ba/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'booking_step',
        constraint: 'booking_step_booking_item_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropTable({ schema: 'public', table: 'booking_item' }),
      this.dropIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_booking_item_id_idx_5072c4d1',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'booking_step',
        constraint: 'booking_step_booking_id_step_name_booking_item_id_key',
      }),
      this.dropColumn({
        schema: 'public',
        table: 'booking_step',
        column: 'booking_item_id',
      }),
      this.createTable({
        schema: 'public',
        table: 'flight_booking',
        columns: [
          col('booking_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('departure_date', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('destination', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('flight_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('flight_number', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('origin', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('passengers', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'hotel_booking',
        columns: [
          col('booking_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('check_in', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('check_out', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('city', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('hotel_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('hotel_name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('room_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('room_type', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rooms', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'booking_step',
        column: col('flight_booking_id', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'booking_step',
        column: col('hotel_booking_id', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_flight_booking_id_idx_3c0ff35c',
        columns: ['flight_booking_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_hotel_booking_id_idx_57ba87aa',
        columns: ['hotel_booking_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'flight_booking',
        index: 'flight_booking_booking_id_idx_aeea169b',
        columns: ['booking_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'hotel_booking',
        index: 'hotel_booking_booking_id_idx_aeea169b',
        columns: ['booking_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'flight_booking',
        foreignKey: {
          name: 'flight_booking_booking_id_fkey',
          columns: ['booking_id'],
          references: { schema: 'public', table: 'booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_step',
        foreignKey: {
          name: 'booking_step_flight_booking_id_fkey',
          columns: ['flight_booking_id'],
          references: {
            schema: 'public',
            table: 'flight_booking',
            columns: ['id'],
          },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'hotel_booking',
        foreignKey: {
          name: 'hotel_booking_booking_id_fkey',
          columns: ['booking_id'],
          references: { schema: 'public', table: 'booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_step',
        foreignKey: {
          name: 'booking_step_hotel_booking_id_fkey',
          columns: ['hotel_booking_id'],
          references: {
            schema: 'public',
            table: 'hotel_booking',
            columns: ['id'],
          },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
