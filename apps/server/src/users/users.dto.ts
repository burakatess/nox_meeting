import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @Matches(/^[a-z0-9._-]{3,64}$/, { message: 'username 3-64 karakter: a-z 0-9 . _ -' })
  username: string;

  @IsString() @MinLength(1) @MaxLength(128)
  displayName: string;

  @IsString() @MinLength(12) @MaxLength(128)
  password: string;

  @IsIn(['admin', 'auditor', 'member'])
  role: 'admin' | 'auditor' | 'member';
}
