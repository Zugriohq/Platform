-- ADR-0002 guards enforced by PostgreSQL itself, so that no application bug, script
-- or manual session can rewrite original decision reasoning.
--
--   * decision_event rows are append-only: UPDATE, DELETE and TRUNCATE are rejected.
--   * decision_case identity (scenario, frame, bundle, authority, channel, creation
--     time) is immutable; only the read projection and updated_at may change.
--   * decision_case rows cannot be deleted or truncated.
--   * private-alpha rows are pinned to the private-validation-alpha channel, are never
--     model-scored, and the stored decision-core projection/events must themselves
--     declare NO_LIVE_CAPITAL / STRUCTURAL_ONLY (belt and braces on top of the enums).
--
-- Decision states are deliberately NOT constrained here: their vocabulary belongs to
-- @zugrio/decision-core, and reconstruction re-runs decision-core to verify them.

ALTER TABLE "decision_case"
  ADD CONSTRAINT "decision_case_release_channel_check" CHECK ("release_channel" = 'private-validation-alpha'),
  ADD CONSTRAINT "decision_case_frame_index_check" CHECK ("frame_index" >= 0),
  ADD CONSTRAINT "decision_case_not_model_scored_check" CHECK ("model_scored" = false),
  ADD CONSTRAINT "decision_case_projection_authority_check" CHECK (
    jsonb_typeof("projection") = 'object'
    AND "projection"->>'authority' = 'NO_LIVE_CAPITAL'
    AND "projection"->>'authorityClass' = 'STRUCTURAL_ONLY'
    AND "projection"->'modelScored' = 'false'::jsonb
    AND "projection"->>'state' = "projection_state"
  );

ALTER TABLE "decision_event"
  ADD CONSTRAINT "decision_event_sequence_check" CHECK ("sequence" >= 0),
  ADD CONSTRAINT "decision_event_payload_check" CHECK (
    jsonb_typeof("payload") = 'object' AND "payload"->>'state' = "state"
  );

CREATE FUNCTION "zugrio_reject_ledger_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'zugrio: % on % is not permitted; the decision ledger is append-only (ADR-0002)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "decision_event_append_only"
  BEFORE UPDATE OR DELETE ON "decision_event"
  FOR EACH ROW EXECUTE FUNCTION "zugrio_reject_ledger_mutation"();

CREATE TRIGGER "decision_event_no_truncate"
  BEFORE TRUNCATE ON "decision_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "zugrio_reject_ledger_mutation"();

CREATE TRIGGER "decision_case_no_delete"
  BEFORE DELETE ON "decision_case"
  FOR EACH ROW EXECUTE FUNCTION "zugrio_reject_ledger_mutation"();

CREATE TRIGGER "decision_case_no_truncate"
  BEFORE TRUNCATE ON "decision_case"
  FOR EACH STATEMENT EXECUTE FUNCTION "zugrio_reject_ledger_mutation"();

CREATE FUNCTION "zugrio_reject_case_identity_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."decision_core_case_id" IS DISTINCT FROM OLD."decision_core_case_id"
     OR NEW."scenario_id" IS DISTINCT FROM OLD."scenario_id"
     OR NEW."frame_index" IS DISTINCT FROM OLD."frame_index"
     OR NEW."bundle_id" IS DISTINCT FROM OLD."bundle_id"
     OR NEW."bundle_version" IS DISTINCT FROM OLD."bundle_version"
     OR NEW."bundle" IS DISTINCT FROM OLD."bundle"
     OR NEW."authority" IS DISTINCT FROM OLD."authority"
     OR NEW."authority_class" IS DISTINCT FROM OLD."authority_class"
     OR NEW."model_scored" IS DISTINCT FROM OLD."model_scored"
     OR NEW."release_channel" IS DISTINCT FROM OLD."release_channel"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'zugrio: decision_case identity is immutable; only the projection may change (ADR-0002)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "decision_case_identity_immutable"
  BEFORE UPDATE ON "decision_case"
  FOR EACH ROW EXECUTE FUNCTION "zugrio_reject_case_identity_change"();
