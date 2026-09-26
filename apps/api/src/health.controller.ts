import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { ALPHA_RESPONSE_META, type AlphaEnvelope, type HealthStatus } from "@zugrio/alpha-api-contract";
import { API_VERSION } from "./config.js";
import { envelope, schemas } from "./openapi-schemas.js";
import type { DecisionCaseStore } from "./persistence/decision-case-store.js";
import { DECISION_CASE_STORE } from "./tokens.js";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(@Inject(DECISION_CASE_STORE) private readonly store: DecisionCaseStore) {}

  @Get("health")
  @ApiOperation({ summary: "Liveness plus database reachability (used by Docker and through the tunnel)" })
  @ApiOkResponse({ schema: envelope(schemas.health) })
  @ApiServiceUnavailableResponse({ description: "Database unreachable", schema: envelope(schemas.health) })
  async health(@Res({ passthrough: true }) response: Response): Promise<AlphaEnvelope<HealthStatus>> {
    const databaseOk = await this.store.ping();
    if (!databaseOk) response.status(503);
    return {
      meta: ALPHA_RESPONSE_META,
      data: {
        status: databaseOk ? "ok" : "degraded",
        service: "zugrio-api",
        version: API_VERSION,
        persistence: this.store.kind,
        database: databaseOk ? "ok" : "unavailable",
      },
    };
  }
}
