#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/12b45558cc3dcd10f63df50c5063fb488432b52f5f99f8684f55d467cbbcf05f/contract';
import endContract from '../../snapshots/12b45558cc3dcd10f63df50c5063fb488432b52f5f99f8684f55d467cbbcf05f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'airline',
        columns: [
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'booking',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('decision_expires_at', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('products', 'json', {
            notNull: true,
            codecRef: { codecId: 'pg/json@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('in_progress'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'booking_status_check_7293a702',
            "\"status\" IN ('in_progress', 'awaiting_user_decision', 'partially_confirmed', 'confirmed', 'failed')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'booking_step',
        columns: [
          col('agent', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('attempt', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('booking_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('error', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('product', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('result', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('retryable', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('scope', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('stage', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('step_index', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('step_name', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'booking_step_scope_check_7140f2cf',
            "\"scope\" IN ('product', 'itinerary')",
          ),
          checkExpression(
            'booking_step_status_check_aee21de6',
            "\"status\" IN ('pending', 'in_progress', 'success', 'failed', 'compensating', 'compensated')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'flight',
        columns: [
          col('airline_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('departure_time', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('destination', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('flight_number', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('origin', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('price', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('seats_left', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'hotel',
        columns: [
          col('city', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'room',
        columns: [
          col('available', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('hotel_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('price', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('room_type', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'booking_step',
        constraint: 'booking_step_booking_id_step_name_key',
        columns: ['booking_id', 'step_name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_booking_id_idx_aeea169b',
        columns: ['booking_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_booking_id_stage_idx_90ddef17',
        columns: ['booking_id', 'stage'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_step',
        index: 'booking_step_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'flight',
        index: 'flight_airline_id_idx_1844ec6e',
        columns: ['airline_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'room',
        index: 'room_hotel_id_idx_3d513303',
        columns: ['hotel_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_step',
        foreignKey: {
          name: 'booking_step_booking_id_fkey',
          columns: ['booking_id'],
          references: { schema: 'public', table: 'booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'flight',
        foreignKey: {
          name: 'flight_airline_id_fkey',
          columns: ['airline_id'],
          references: { schema: 'public', table: 'airline', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'room',
        foreignKey: {
          name: 'room_hotel_id_fkey',
          columns: ['hotel_id'],
          references: { schema: 'public', table: 'hotel', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
