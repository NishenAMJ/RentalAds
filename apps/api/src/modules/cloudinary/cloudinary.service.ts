import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinaryClient: typeof cloudinary,

    private readonly configService: ConfigService,
  ) {}

  uploadImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadApiResponse> {
    if (!file) {
      throw new BadRequestException('Image is required');
    }

    const assetFolder =
      this.configService.get<string>('CLOUDINARY_PROPERTY_FOLDER') ??
      'My_Projects/Rental_Ads';

    return new Promise((resolve, reject) => {
      const stream = this.cloudinaryClient.uploader.upload_stream(
        {
          resource_type: 'image',
          asset_folder: assetFolder,
          public_id: `${userId}-${randomUUID()}`,
          overwrite: false,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          // Incoming transformation: removes EXIF (including GPS location) before storage.
          transformation: [{ flags: 'strip_profile' }],
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            reject(new BadRequestException(`Upload failed: ${error.message}`));
            return;
          }

          if (!result) {
            reject(new BadRequestException('No upload result received'));
            return;
          }

          resolve(result);
        },
      );

      stream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await this.cloudinaryClient.uploader.destroy(publicId, {
      resource_type: 'image',
    });
  }
}
