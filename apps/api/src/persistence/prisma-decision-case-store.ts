import { PrismaPg } from "@prisma/adapter-pg";
import type { AlphaTradeBundle, DecisionEvent } from "@zugrio/decision-core";
import { ALPHA_RELEASE_CHANNEL, type DecisionCaseProjection } from "@zugrio/alpha-api-contract";
import { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { CreateResult, DecisionCaseStore, NewDecisionCase, StoredDecisionCase } from "./decision-case-store.js";

const withEvents = { events: { orderBy: { sequence: "asc" } } } as const;
type CaseWithEvents = Prisma.DecisionCaseGetPayload<{ include: typeof withEvents }>;

/** PostgreSQL ledger. Append-only and identity immutability are also enforced by DB triggers. */
export class PrismaDecisionCaseStore implements DecisionCaseStore {
  readonly kind = "postgres" as const;
  private readonly prisma: PrismaClient;

  constructor(databaseUrl: string) {
    // Bounded connect timeout so /health reports "unavailable" instead of hanging.
    const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, max: 10 });
    this.prisma = new PrismaClient({ adapter });
  }

  async create(input: NewDecisionCase): Promise<CreateResult> {
    try {
      const row = await this.prisma.decisionCase.create({
        data: {
          evaluationId: input.evaluationId,
          decisionCoreCaseId: input.decisionCoreCaseId,
          scenarioId: input.scenarioId,
          scenarioVersion: input.scenarioVersion,
          frameIndex: input.frameIndex,
          evaluatedAt: new Date(input.evaluatedAt),
          bundleKey: input.bundleKey,
          bundle: toJson(input.bundle),
          authority: "NO_LIVE_CAPITAL",
          authorityClass: "STRUCTURAL_ONLY",
          modelScored: false,
          releaseChannel: ALPHA_RELEASE_CHANNEL,
          projectionStructuralState: input.projection.structuralState,
          projectionOutcome: input.projection.outcome,
          projection: toJson(input.projection),
          // Nested create: the case and its full history commit in one transaction.
          events: {
            create: input.events.map((event) => ({
              sequence: event.sequence,
              eventType: "REPLAY_STATE_CLASSIFIED",
              evaluationId: event.event.evaluationId,
              occurredAt: new Date(event.occurredAt),
              structuralState: event.event.structuralState,
              outcome: event.event.outcome,
              payload: toJson(event.event),
            })),
          },
        },
        include: withEvents,
      });
      return { created: true, record: fromRow(row) };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      // Concurrent or repeated materialization of the same case: return the original.
      const existing = await this.prisma.decisionCase.findUnique({
        where: { evaluationId: input.evaluationId },
        include: withEvents,
      });
      if (!existing) throw error;
      return { created: false, record: fromRow(existing) };
    }
  }

  async findById(id: string): Promise<StoredDecisionCase | undefined> {
    const row = await this.prisma.decisionCase.findUnique({ where: { id }, include: withEvents });
    return row ? fromRow(row) : undefined;
  }

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function toJson(value: AlphaTradeBundle | DecisionCaseProjection | DecisionEvent): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function fromRow(row: CaseWithEvents): StoredDecisionCase {
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    decisionCoreCaseId: row.decisionCoreCaseId,
    scenarioId: row.scenarioId,
    scenarioVersion: row.scenarioVersion,
    frameIndex: row.frameIndex,
    evaluatedAt: row.evaluatedAt.toISOString(),
    bundle: row.bundle as unknown as AlphaTradeBundle,
    bundleKey: row.bundleKey,
    authority: row.authority,
    authorityClass: row.authorityClass,
    modelScored: false,
    projection: row.projection as unknown as DecisionCaseProjection,
    events: row.events.map((event) => ({
      sequence: event.sequence,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
      event: event.payload as unknown as DecisionEvent,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
