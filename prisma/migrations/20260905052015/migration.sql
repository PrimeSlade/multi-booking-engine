-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('in_progress', 'awaiting_user_decision', 'partially_confirmed', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "StepScope" AS ENUM ('product', 'itinerary');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('pending', 'in_progress', 'success', 'failed', 'compensating', 'compensated');

-- CreateTable
CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "products" JSONB NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'in_progress',
    "decision_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_step" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "scope" "StepScope" NOT NULL,
    "product" TEXT,
    "agent" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "retryable" BOOLEAN,
    "result" JSONB,
    "error" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_step_booking_id_idx" ON "booking_step"("booking_id");

-- CreateIndex
CREATE INDEX "booking_step_status_idx" ON "booking_step"("status");

-- CreateIndex
CREATE INDEX "booking_step_booking_id_stage_idx" ON "booking_step"("booking_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "booking_step_booking_id_step_name_key" ON "booking_step"("booking_id", "step_name");

-- AddForeignKey
ALTER TABLE "booking_step" ADD CONSTRAINT "booking_step_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
