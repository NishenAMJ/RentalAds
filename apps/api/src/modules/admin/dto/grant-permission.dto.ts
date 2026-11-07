import { IsBoolean, IsEmail, IsOptional } from 'class-validator';

export class GrantPermissionDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  canApproveListings?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageAdmins?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageComplaints?: boolean;

  @IsOptional()
  @IsBoolean()
  canManagePayouts?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageCommissions?: boolean;
}
