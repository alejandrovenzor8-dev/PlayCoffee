import { Module } from '@nestjs/common';
import { PrintController } from './print.controller';
import { PrintService } from './print.service';
import { PrintAgentController } from './print-agent.controller';
import { PrintAgentGuard } from './print-agent.guard';

@Module({
  controllers: [PrintController, PrintAgentController],
  providers: [PrintService, PrintAgentGuard],
  exports: [PrintService],
})
export class PrintModule {}
