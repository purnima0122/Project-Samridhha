import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class BootstrapAdminDto {
  @IsString()
  bootstrapKey: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^[0-9]{10}$/, {
    message: 'Phone number must be 10 digits',
  })
  number: string;

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[0-9])/, {
    message: 'Password must contain at least one number',
  })
  password: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:[1-9]|[12][0-9]|3[0-2])$/, {
    message: 'Ward number must be between 1 and 32',
  })
  wardNo?: string;
}
