import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PaginationQuery } from '../../common/pagination';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(
    private complaintsService: ComplaintsService,
    private prisma: PrismaService,
  ) {}
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post()
  @UseGuards(ThrottlerGuard, OptionalAuthGuard)
  async create(
    @Body() dto: CreateComplaintDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const reporter = user
      ? await this.prisma.user.findUnique({
          where: { authUserId: user.authUserId },
        })
      : null;
    return this.complaintsService.create(dto, reporter?.id);
  }
  @Get()
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canManageComplaints')
  findAll(@Query() query: PaginationQuery) {
    return this.complaintsService.findAll(query);
  }
  @Patch(':id')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canManageComplaints')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaintsService.updateStatus(id, dto.status, dto.adminNotes);
  }
}
