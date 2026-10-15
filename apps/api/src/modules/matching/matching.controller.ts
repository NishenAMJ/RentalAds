import { SaveSuggestionDto, UpdateMatchStatusDto } from './matching.dto';
import { Query } from '@nestjs/common';
import { PaginationQuery } from '../../common/pagination';
import {
  Body,
  Post,
  Patch,
  ParseUUIDPipe,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { MatchingService } from './matching.service';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('matching')
@UseGuards(AuthGuard, AdminPermissionGuard)
@RequirePermission('canApproveListings')
export class MatchingController {
  constructor(private matchingService: MatchingService) {}

  @Get('dashboard')
  dashboard(@Query() query: PaginationQuery) {
    return this.matchingService.dashboardMatches(query);
  }

  @Get('requests/:id/suggestions')
  async suggestions(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.matchingService.findSuggestionsForRequest(requestId, query);
  }
  @Post('requests/:id/suggestions')
  save(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: SaveSuggestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchingService.saveSuggestion(
      requestId,
      dto.listingId,
      dto.locationOverrideReason,
      user.authUserId,
      dto.recommendationReason,
    );
  }
  @Get('requests/:id/candidates/:listingId')
  lookup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('listingId') listingId: string,
  ) {
    return this.matchingService.lookupCandidate(id, listingId);
  }
  @Get('requests/:id/matches')
  saved(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQuery,
  ) {
    return this.matchingService.savedMatches(id, query);
  }
  @Patch('matches/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchStatusDto,
  ) {
    return this.matchingService.updateStatus(id, dto.status);
  }
}
