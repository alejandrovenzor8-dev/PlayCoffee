import { PartialType } from '@nestjs/swagger';
import { CreateBranchDto } from './create-branch.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @IsBoolean() @IsOptional() isActive?: boolean;
}
