import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@playcoffee.mx' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class PinLoginDto {
  @ApiProperty({ example: 'admin@playcoffee.mx' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @MinLength(4)
  pin: string;
}
