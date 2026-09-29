-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CapitalAuthority" AS ENUM ('NO_LIVE_CAPITAL');

-- CreateEnum
CREATE TYPE "AuthorityClass" AS ENUM ('STRUCTURAL_ONLY');

-- CreateEnum
CREATE TYPE "DecisionEventType" AS ENUM ('REPLAY_STATE_CLASSIFIED');

-- CreateTable
CREATE TABLE "decision_case" (
    "id" UUID NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "decision_core_case_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "scenario_version" TEXT NOT NULL,
    "frame_index" INTEGER NOT NULL,
    "evaluated_at" TIMESTAMPTZ(3) NOT NULL,
    "bundle_key" TEXT NOT NULL,
    "bundle" JSONB NOT NULL,
    "authority" "CapitalAuthority" NOT NULL DEFAULT 'NO_LIVE_CAPITAL',
    "authority_class" "AuthorityClass" NOT NULL DEFAULT 'STRUCTURAL_ONLY',
    "model_scored" BOOLEAN NOT NULL DEFAULT false,
    "release_channel" TEXT NOT NULL,
    "projection_structural_state" TEXT,
    "projection_outcome" TEXT NOT NULL,
    "projection" JSONB NOT NULL,
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
    "evaluation_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "structural_state" TEXT,
    "outcome" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "decision_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_case_evaluation_id_key" ON "decision_case"("evaluation_id");

-- CreateIndex
CREATE INDEX "decision_case_decision_core_case_id_idx" ON "decision_case"("decision_core_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_event_case_sequence_key" ON "decision_event"("case_id", "sequence");

-- AddForeignKey
ALTER TABLE "decision_event" ADD CONSTRAINT "decision_event_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "decision_case"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

