import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';
import { AccountService } from './account.service';
import { UsersService } from './users.service';

class DeleteAccountDto {
  /** Typed confirmation guards against accidental or forged-click deletion. */
  @IsIn(['DELETE'])
  confirm!: string;
}

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.profile(user);
  }

  @Post('me/verification')
  @WriteThrottle(5)
  requestOwnerVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.users.requestOwnerVerification(user);
  }

  @Get('me/export')
  @WriteThrottle(5)
  export(@CurrentUser() user: AuthenticatedUser) {
    return this.account.exportData(user);
  }

  @Post('me/delete')
  @WriteThrottle(3)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeleteAccountDto,
  ) {
    if (body.confirm !== 'DELETE')
      throw new BadRequestException('Type DELETE to confirm');
    return this.account.deleteAccount(user);
  }
}
