import { SetMetadata } from '@nestjs/common';

export type AdminPermissionName =
  | 'canApproveListings'
  | 'canManageAdmins'
  | 'canManageComplaints'
  | 'canManagePayouts'
  | 'canManageCommissions';
export const PERMISSION_KEY = 'adminPermission';
export const RequirePermission = (permission: AdminPermissionName) =>
  SetMetadata(PERMISSION_KEY, permission);
