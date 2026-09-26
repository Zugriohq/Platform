import { PrismaPg } from "@prisma/adapter-pg";
import type { AlphaTradeBundle, EvidenceSnapshot } from "@zugrio/decision-core";
import { ALPHA_RELEASE_CHANNEL } from "@zugrio/alpha-api-contract";
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
          decisionCoreCaseId: input.decisionCoreCaseId,
          scenarioId: input.scenarioId,
          frameIndex: input.frameIndex,
          bundleId: input.bundle.id,
          bundleVersion: input.bundle.version,
          bundle: toJson(input.bundle),
          authority: "NO_LIVE_CAPITAL",
          releaseChannel: ALPHA_RELEASE_CHANNEL,
          projectionState: input.projection.state,
          projectionReason: input.projection.reason,
          projectionSnapshot: toJson(input.projection.current),
          // Nested create: the case and its full history commit in one transaction.
          events: {
            create: input.events.map((event) => ({
              sequence: event.sequence,
              eventType: "REPLAY_STATE_CLASSIFIED",
              occurredAt: new Date(event.occurredAt),
              state: event.state,
              reason: event.reason,
              price: new Prisma.Decimal(event.price.toString()),
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
        where: {
          scenarioId_frameIndex_bundleId_bundleVersion: {
            scenarioId: input.scenarioId,
            frameIndex: input.frameIndex,
            bundleId: input.bundle.id,
            bundleVersion: input.bundle.version,
          },
        },
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

function toJson(value: AlphaTradeBundle | EvidenceSnapshot): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function fromRow(row: CaseWithEvents): StoredDecisionCase {
  return {
    id: row.id,
    decisionCoreCaseId: row.decisionCoreCaseId,
    scenarioId: row.scenarioId,
    frameIndex: row.frameIndex,
    bundle: row.bundle as unknown as AlphaTradeBundle,
    authority: row.authority,
    projection: {
      state: row.projectionState,
      reason: row.projectionReason,
      current: row.projectionSnapshot as unknown as EvidenceSnapshot,
    },
    events: row.events.map((event) => ({
      sequence: event.sequence,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
      state: event.state,
      reason: event.reason,
      price: event.price.toNumber(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
