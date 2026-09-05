import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ClaimPrintJobDto,
  CompletePrintJobDto,
  FailPrintJobDto,
} from './dto/print-agent.dto';
import { PrintAgentGuard } from './print-agent.guard';
import { PrintService } from './print.service';

@ApiTags('Print agent')
@UseGuards(PrintAgentGuard)
@Controller('print-agent')
export class PrintAgentController {
  constructor(private readonly printService: PrintService) {}

  @Post('claim')
  claim(@Body() dto: ClaimPrintJobDto) {
    return this.printService.claimNextJob(dto.agentId);
  }

  @Post(':jobId/complete')
  complete(@Param('jobId') jobId: string, @Body() dto: CompletePrintJobDto) {
    return this.printService.completeJob(jobId, dto.agentId);
  }

  @Post(':jobId/fail')
  fail(@Param('jobId') jobId: string, @Body() dto: FailPrintJobDto) {
    return this.printService.failJob(jobId, dto.agentId, dto.error);
  }
}
