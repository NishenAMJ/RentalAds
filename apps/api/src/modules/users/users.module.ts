import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountService } from './account.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AccountService],
  exports: [UsersService],
})
export class UsersModule {}
