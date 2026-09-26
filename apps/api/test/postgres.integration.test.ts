/**
 * PostgreSQL integration tests for the ADR-0002 ledger guarantees.
 *
 * Requires ZUGRIO_TEST_DATABASE_URL: a connection string for a role allowed to
 * CREATE/DROP DATABASE. Each run creates and drops its own database. CI sets
 * ZUGRIO_REQUIRE_DB_TESTS=1 so these tests fail rather than skip when no DB is configured.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { staleEntryScenario, currentEntryScenario } from "@zugrio/decision-core";
import { PrismaDecisionCaseStore } from "../src/persistence/prisma-decision-case-store.js";
import { postJson, startApi, type RunningApi } from "./helpers.js";

const adminUrl = process.env["ZUGRIO_TEST_DATABASE_URL"];
if (!adminUrl && process.env["ZUGRIO_REQUIRE_DB_TESTS"] === "1") {
  throw new Error("ZUGRIO_REQUIRE_DB_TESTS=1 but ZUGRIO_TEST_DATABASE_URL is not set");
}

const apiRoot = fileURLToPath(new URL("..", import.meta.url));

describe.skipIf(!adminUrl)("PostgreSQL decision ledger", () => {
  const databaseName = `zugrio_test_${randomBytes(6).toString("hex")}`;
  let databaseUrl: string;
  let sql: pg.Client;
  let store: PrismaDecisionCaseStore;
  let api: RunningApi;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${databaseName}`);
    await admin.end();

    const url = new URL(adminUrl!);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();

    // Apply the committed migrations exactly as the container entrypoint does.
    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });

    sql = new pg.Client({ connectionString: databaseUrl });
    await sql.connect();
    store = new PrismaDecisionCaseStore(databaseUrl);
    api = await startApi(store);
  });

  afterAll(async () => {
    await api?.close();
    await sql?.end();
    if (!adminUrl) return;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await admin.end();
  });

  async function materialize(frameIndex: number, scenarioId = staleEntryScenario.id) {
    return api.request("/v1/alpha/decision-cases", postJson({ scenarioId, frameIndex }));
  }

  it("reports postgres persistence as healthy", async () => {
    const { status, body } = await api.request("/health");
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ persistence: "postgres", database: "ok" });
  });

  it("persists a case and reconstructs it identically after a restart", async () => {
    const created = await materialize(6);
    expect(created.status).toBe(201);
    const persisted = created.body.data.decisionCase;
    expect(persisted.consistentWithDecisionCore).toBe(true);
    expect(persisted.projection).toMatchObject({ structuralState: "STRUCTURAL_READY", outcome: "PASS" });
    expect(persisted.events.some((entry: { event: { changes: unknown[] } }) => entry.event.changes.length > 0)).toBe(true);

    // A fresh store/app instance proves reconstruction comes from PostgreSQL, not memory.
    const restarted = await startApi(new PrismaDecisionCaseStore(databaseUrl));
    try {
      const fetched = await restarted.request(`/v1/alpha/decision-cases/${persisted.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.data).toEqual(persisted);
    } finally {
      await restarted.close();
    }

    const rows = await sql.query(
      `SELECT authority::text, authority_class::text, model_scored, release_channel FROM decision_case WHERE id = $1`,
      [persisted.id],
    );
    expect(rows.rows[0]).toEqual({
      authority: "NO_LIVE_CAPITAL",
      authority_class: "STRUCTURAL_ONLY",
      model_scored: false,
      release_channel: "private-validation-alpha",
    });
  });

  it("creates exactly one case under concurrent materialization", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => materialize(3, currentEntryScenario.id)));
    expect(responses.every((response) => response.status === 200 || response.status === 201)).toBe(true);
    expect(responses.filter((response) => response.body.data.created)).toHaveLength(1);
    expect(new Set(responses.map((response) => response.body.data.decisionCase.id)).size).toBe(1);
    const count = await sql.query(
      `SELECT count(*)::int AS n FROM decision_case WHERE scenario_id = $1 AND frame_index = 3`,
      [currentEntryScenario.id],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("rejects UPDATE, DELETE and TRUNCATE on decision events", async () => {
    const { body } = await materialize(2);
    const caseId = body.data.decisionCase.id;
    await expect(sql.query(`UPDATE decision_event SET payload = jsonb_set(payload, '{stateReason}', '"hindsight"') WHERE case_id = $1`, [caseId])).rejects.toThrow(/append-only/);
    await expect(sql.query(`DELETE FROM decision_event WHERE case_id = $1`, [caseId])).rejects.toThrow(/append-only/);
    await expect(sql.query(`TRUNCATE decision_event CASCADE`)).rejects.toThrow(/append-only/);
    await expect(sql.query(`DELETE FROM decision_case WHERE id = $1`, [caseId])).rejects.toThrow(/append-only/);
  });

  it("keeps case identity immutable while allowing projection updates", async () => {
    const { body } = await materialize(1);
    const caseId = body.data.decisionCase.id;
    await expect(sql.query(`UPDATE decision_case SET frame_index = 0 WHERE id = $1`, [caseId])).rejects.toThrow(/identity is immutable/);
    await expect(sql.query(`UPDATE decision_case SET bundle = '{}'::jsonb WHERE id = $1`, [caseId])).rejects.toThrow(/identity is immutable/);
    await expect(sql.query(`UPDATE decision_case SET bundle_key = 'other' WHERE id = $1`, [caseId])).rejects.toThrow(/identity is immutable/);
    await expect(sql.query(`UPDATE decision_case SET evaluated_at = now() WHERE id = $1`, [caseId])).rejects.toThrow(/identity is immutable/);

    // The projection is the mutable read model; changing it must not touch the ledger,
    // and reconstruction must report the divergence rather than trust it.
    const before = await api.request(`/v1/alpha/decision-cases/${caseId}`);
    await sql.query(
      `UPDATE decision_case SET projection_outcome = 'PASS',
         projection = jsonb_set(projection, '{outcome}', '"PASS"') WHERE id = $1`,
      [caseId],
    );
    const after = await api.request(`/v1/alpha/decision-cases/${caseId}`);
    expect(after.body.data.events).toEqual(before.body.data.events);
    expect(after.body.data.consistentWithDecisionCore).toBe(false);
  });

  it("cannot store any authority other than NO_LIVE_CAPITAL / STRUCTURAL_ONLY or a foreign release channel", async () => {
    const { body } = await materialize(0);
    const caseId = body.data.decisionCase.id;
    await expect(sql.query(`UPDATE decision_case SET authority = 'LIVE_CAPITAL' WHERE id = $1`, [caseId])).rejects.toThrow(/invalid input value for enum/);
    await expect(sql.query(`UPDATE decision_case SET authority_class = 'MODEL_ADMITTED' WHERE id = $1`, [caseId])).rejects.toThrow(/invalid input value for enum/);
    await expect(sql.query(`UPDATE decision_case SET model_scored = true WHERE id = $1`, [caseId])).rejects.toThrow(/not_model_scored_check|identity is immutable/);
    await expect(
      sql.query(`UPDATE decision_case SET projection = jsonb_set(projection, '{authority}', '"LIVE_CAPITAL"') WHERE id = $1`, [caseId]),
    ).rejects.toThrow(/projection_authority_check/);
    await expect(
      sql.query(`UPDATE decision_case SET projection = jsonb_set(projection, '{modelScored}', 'true') WHERE id = $1`, [caseId]),
    ).rejects.toThrow(/projection_authority_check/);
    await expect(
      sql.query(
        `INSERT INTO decision_case (id, evaluation_id, decision_core_case_id, scenario_id, scenario_version, frame_index,
           evaluated_at, bundle_key, bundle, release_channel, projection_structural_state, projection_outcome, projection, updated_at)
         VALUES (gen_random_uuid(), 'e', 'c', 's', 'v', 0, now(), 'k', '{}', 'production', NULL, 'WAIT',
           '{"evaluationId":"e","structuralState":null,"outcome":"WAIT","authority":"NO_LIVE_CAPITAL","authorityClass":"STRUCTURAL_ONLY","modelScored":false}', now())`,
      ),
    ).rejects.toThrow(/release_channel_check/);
  });
});
