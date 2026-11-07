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
import { ApiTags } from '@nestjs/swagger';
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
import {
  CreateComplaintDto,
  CreateDisputeDto,
  MyDisputeQuery,
} from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@ApiTags('complaints')
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
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('disputes')
  @UseGuards(ThrottlerGuard, AuthGuard)
  createDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.complaintsService.createDispute(user.authUserId, dto);
  }
  @Get('disputes/mine')
  @UseGuards(AuthGuard)
  myDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MyDisputeQuery,
  ) {
    return this.complaintsService.myDispute(user.authUserId, query.bookingId);
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaintsService.updateStatus(id, dto, user.authUserId);
  }
}
