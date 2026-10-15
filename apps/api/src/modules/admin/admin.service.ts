import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async grantPermission(dto: GrantPermissionDto) {
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser)
      throw new NotFoundException('No user found with that email');

    const flags = dto;

    return this.prisma.adminPermission.upsert({
      where: { userId: targetUser.id },
      create: {
        userId: targetUser.id,
        canApproveListings: flags.canApproveListings ?? false,
        canManageAdmins: flags.canManageAdmins ?? false,
        canManageComplaints: flags.canManageComplaints ?? false,
      },
      update: {
        ...(flags.canApproveListings !== undefined
          ? { canApproveListings: flags.canApproveListings }
          : {}),
        ...(flags.canManageAdmins !== undefined
          ? { canManageAdmins: flags.canManageAdmins }
          : {}),
        ...(flags.canManageComplaints !== undefined
          ? { canManageComplaints: flags.canManageComplaints }
          : {}),
      },
    });
  }
}
