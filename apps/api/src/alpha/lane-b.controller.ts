import { BadRequestException, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ALPHA_RESPONSE_META, type AlphaEnvelope, type LaneBValidationFrame, type LaneBScenarioSummary } from '@zugrio/alpha-api-contract';
import { buildLaneBValidationFrame, laneBScenarios, SharedEntryEngine } from '@zugrio/decision-core';
import { envelope, schemas } from '../openapi-schemas.js';

/** Read-only named research fixtures. No caller-supplied market/account facts or execution route. */
@ApiTags('private-validation-alpha')
@Controller('v1/alpha/engine-validation')
export class LaneBController {
  private readonly engine = new SharedEntryEngine();
  @Get('scenarios')
  @ApiOperation({summary:'List fabricated shared-entry/account-risk validation replays'})
  @ApiOkResponse({schema:envelope(schemas.laneBScenarios)})
  list():AlphaEnvelope<readonly LaneBScenarioSummary[]> { return {meta:ALPHA_RESPONSE_META,data:laneBScenarios}; }

  @Get('scenarios/:scenarioId/frames/:frameIndex')
  @ApiOperation({summary:'Evaluate a research-only shared entry and downstream account-risk frame',description:'Fabricated mechanical validation only. Does not size, reserve, persist an order or execute. Repeated reads reuse canonical engine state.'})
  @ApiParam({name:'scenarioId',type:String})
  @ApiParam({name:'frameIndex',type:'integer'})
  @ApiOkResponse({schema:envelope(schemas.laneBFrame)})
  @ApiBadRequestResponse({schema:schemas.error})
  @ApiNotFoundResponse({schema:schemas.error})
  frame(@Param('scenarioId') scenarioId:string,@Param('frameIndex') frameIndex:string):AlphaEnvelope<LaneBValidationFrame> {
    if(!/^(0|[1-9]\d{0,8})$/.test(frameIndex)) throw new BadRequestException('frameIndex must be a non-negative integer');
    const result=buildLaneBValidationFrame(this.engine,scenarioId,Number(frameIndex));
    if(!result) throw new NotFoundException('Unknown engine validation frame');
    return {meta:ALPHA_RESPONSE_META,data:result};
  }
}
