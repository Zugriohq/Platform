import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Res } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
  ALPHA_RESPONSE_META,
  type AlphaEnvelope,
  type DecisionCase,
  type EngineChartScene,
  type MaterializeDecisionCaseRequest,
  type MaterializeDecisionCaseResult,
  type PersistedDecisionCase,
  type ScenarioDetail,
  type ScenarioSummary,
} from "@zugrio/alpha-api-contract";
import { envelope, schemas } from "../openapi-schemas.js";
import { DecisionCaseService } from "./decision-case.service.js";
import { ScenarioCatalog } from "./scenario-catalog.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NON_NEGATIVE_INTEGER = /^(0|[1-9]\d{0,8})$/;

function wrap<T>(data: T): AlphaEnvelope<T> {
  return { meta: ALPHA_RESPONSE_META, data };
}

@ApiTags("private-validation-alpha")
@Controller("v1/alpha")
export class AlphaController {
  constructor(
    @Inject(ScenarioCatalog) private readonly catalog: ScenarioCatalog,
    @Inject(DecisionCaseService) private readonly cases: DecisionCaseService,
  ) {}

  @Get("scenarios")
  @ApiOperation({ summary: "List validation replay scenarios" })
  @ApiOkResponse({ schema: envelope(schemas.scenarioList) })
  listScenarios(): AlphaEnvelope<ScenarioSummary[]> {
    return wrap(this.catalog.list());
  }

  @Get("scenarios/:scenarioId")
  @ApiOperation({ summary: "Get a validation replay scenario with all frames" })
  @ApiParam({ name: "scenarioId", type: String })
  @ApiOkResponse({ schema: envelope(schemas.scenarioDetail) })
  @ApiNotFoundResponse({ schema: schemas.error })
  getScenario(@Param("scenarioId") scenarioId: string): AlphaEnvelope<ScenarioDetail> {
    const detail = this.catalog.detail(scenarioId);
    if (!detail) throw new NotFoundException(`Scenario "${scenarioId}" not found`);
    return wrap(detail);
  }

  @Get("scenarios/:scenarioId/frames/:frameIndex")
  @ApiOperation({ summary: "Deterministic decision-core DecisionCase for one replay frame (not persisted)" })
  @ApiParam({ name: "scenarioId", type: String })
  @ApiParam({ name: "frameIndex", type: "integer", description: "Zero-based replay frame index" })
  @ApiOkResponse({ schema: envelope(schemas.decisionCase) })
  @ApiBadRequestResponse({ schema: schemas.error })
  @ApiNotFoundResponse({ schema: schemas.error })
  getFrameDecisionCase(
    @Param("scenarioId") scenarioId: string,
    @Param("frameIndex") frameIndexParam: string,
  ): AlphaEnvelope<DecisionCase> {
    if (!NON_NEGATIVE_INTEGER.test(frameIndexParam)) {
      throw new BadRequestException("frameIndex must be a non-negative integer");
    }
    const decision = this.catalog.frameDecisionCase(scenarioId, Number(frameIndexParam));
    if (!decision) throw new NotFoundException(`Frame ${frameIndexParam} of scenario "${scenarioId}" not found`);
    return wrap(decision);
  }

  @Get("scenarios/:scenarioId/frames/:frameIndex/chart-scene")
  @ApiOperation({ summary: "Engine-owned semantic chart scene for one replay frame" })
  @ApiParam({ name: "scenarioId", type: String })
  @ApiParam({ name: "frameIndex", type: "integer", description: "Zero-based replay frame index" })
  @ApiOkResponse({ schema: envelope(schemas.chartScene) })
  @ApiBadRequestResponse({ schema: schemas.error })
  @ApiNotFoundResponse({ schema: schemas.error })
  getFrameChartScene(
    @Param("scenarioId") scenarioId: string,
    @Param("frameIndex") frameIndexParam: string,
  ): AlphaEnvelope<EngineChartScene> {
    if (!NON_NEGATIVE_INTEGER.test(frameIndexParam)) {
      throw new BadRequestException("frameIndex must be a non-negative integer");
    }
    const scene = this.catalog.frameChartScene(scenarioId, Number(frameIndexParam));
    if (!scene) throw new NotFoundException(`Frame ${frameIndexParam} of scenario "${scenarioId}" not found`);
    return wrap(scene);
  }

  @Post("decision-cases")
  @HttpCode(201)
  @ApiOperation({
    summary: "Persist a validation Decision Case for a known scenario frame",
    description:
      "Idempotent per scenario/frame/bundle version: repeating the request returns the original case with 200. " +
      "Only NO_LIVE_CAPITAL validation cases can be created.",
  })
  @ApiBody({ schema: schemas.materializeRequest })
  @ApiCreatedResponse({ description: "Case created", schema: envelope(schemas.materializeResult) })
  @ApiOkResponse({ description: "Case already existed", schema: envelope(schemas.materializeResult) })
  @ApiBadRequestResponse({ schema: schemas.error })
  async materialize(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AlphaEnvelope<MaterializeDecisionCaseResult>> {
    const result = await this.cases.materialize(parseMaterializeRequest(body));
    if (!result.created) response.status(200);
    return wrap(result);
  }

  @Get("decision-cases/:caseId")
  @ApiOperation({ summary: "Reconstruct a persisted Decision Case with its append-only event history" })
  @ApiParam({ name: "caseId", type: String, format: "uuid" })
  @ApiOkResponse({ schema: envelope(schemas.persistedCase) })
  @ApiBadRequestResponse({ schema: schemas.error })
  @ApiNotFoundResponse({ schema: schemas.error })
  async getDecisionCase(@Param("caseId") caseId: string): Promise<AlphaEnvelope<PersistedDecisionCase>> {
    if (!UUID.test(caseId)) throw new BadRequestException("caseId must be a UUID");
    return wrap(await this.cases.reconstruct(caseId.toLowerCase()));
  }
}

/** Strict: only `scenarioId` and `frameIndex`; authority can never be supplied by a caller. */
export function parseMaterializeRequest(body: unknown): MaterializeDecisionCaseRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object");
  }
  const record = body as Record<string, unknown>;
  const unexpected = Object.keys(record).filter((key) => key !== "scenarioId" && key !== "frameIndex");
  if (unexpected.length > 0) throw new BadRequestException(`Unexpected field(s): ${unexpected.join(", ")}`);

  const { scenarioId, frameIndex } = record;
  if (typeof scenarioId !== "string" || scenarioId.length === 0 || scenarioId.length > 200) {
    throw new BadRequestException("scenarioId must be a non-empty string");
  }
  if (typeof frameIndex !== "number" || !Number.isSafeInteger(frameIndex) || frameIndex < 0) {
    throw new BadRequestException("frameIndex must be a non-negative integer");
  }
  return { scenarioId, frameIndex };
}
