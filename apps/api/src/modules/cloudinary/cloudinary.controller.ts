import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { UsersService } from '../users/users.service';
import { CloudinaryService } from './cloudinary.service';
import { matchesDeclaredImageType } from '../../common/image-signature';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(AuthGuard)
export class CloudinaryController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
  ) {}

  @Post('property-images')
  @WriteThrottle(10)
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only JPG, PNG and WebP images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadPropertyImages(
    @CurrentUser() authUser: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('Select at least one image');
    }

    // The MIME type is client-supplied; check the real bytes before storing anything.
    const spoofed = files.find(
      (file) => !matchesDeclaredImageType(file.buffer, file.mimetype),
    );
    if (spoofed)
      throw new BadRequestException(
        `${spoofed.originalname}: the file is not a valid JPG, PNG or WebP image`,
      );

    const user = await this.usersService.findOrCreate(authUser, 'OWNER');
    const results = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file, user.id)),
    );

    return {
      images: results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
      })),
    };
  }
}
