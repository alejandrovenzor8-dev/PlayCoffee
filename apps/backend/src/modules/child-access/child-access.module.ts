import { Module } from '@nestjs/common';
import { ChildAccessService } from './child-access.service';
import { ChildAccessController } from './child-access.controller';

@Module({
  controllers: [ChildAccessController],
  providers: [ChildAccessService],
  exports: [ChildAccessService],
})
export class ChildAccessModule {}
