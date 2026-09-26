-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CapitalAuthority" AS ENUM ('NO_LIVE_CAPITAL');

-- CreateEnum
CREATE TYPE "OpportunityState" AS ENUM ('FORMING', 'READY', 'TRIGGERED', 'PASS');

-- CreateEnum
CREATE TYPE "DecisionEventType" AS ENUM ('REPLAY_STATE_CLASSIFIED');

-- CreateTable
CREATE TABLE "decision_case" (
    "id" UUID NOT NULL,
    "decision_core_case_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "frame_index" INTEGER NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "bundle_version" TEXT NOT NULL,
    "bundle" JSONB NOT NULL,
    "authority" "CapitalAuthority" NOT NULL DEFAULT 'NO_LIVE_CAPITAL',
    "release_channel" TEXT NOT NULL,
    "projection_state" "OpportunityState" NOT NULL,
    "projection_reason" TEXT NOT NULL,
    "projection_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "decision_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_event" (
    "id" BIGSERIAL NOT NULL,
    "case_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" "DecisionEventType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "OpportunityState" NOT NULL,
    "reason" TEXT NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,

    CONSTRAINT "decision_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_case_scenario_frame_bundle_key" ON "decision_case"("scenario_id", "frame_index", "bundle_id", "bundle_version");

-- CreateIndex
CREATE UNIQUE INDEX "decision_event_case_sequence_key" ON "decision_event"("case_id", "sequence");

-- AddForeignKey
ALTER TABLE "decision_event" ADD CONSTRAINT "decision_event_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "decision_case"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

