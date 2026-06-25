import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { PartyPackagesController } from './party-packages.controller';

@Module({
  controllers: [ReservationsController, PartyPackagesController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
