import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString() @MinLength(1) @MaxLength(128)
  username: string;

  @IsString() @MinLength(1) @MaxLength(256)
  password: string;

  @IsOptional() @IsString() @MaxLength(128)
  deviceName?: string;
}
