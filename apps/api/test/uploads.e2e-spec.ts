import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { CLOUDINARY } from '../src/modules/cloudinary/cloudinary.provider';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: (token: string) =>
        Promise.resolve({
          data: {
            user:
              token === 'valid-token'
                ? { id: 'verified-supabase-id', email: 'owner@pilot.test' }
                : null,
          },
          error: token === 'valid-token' ? null : new Error('Invalid token'),
        }),
    },
  }),
}));

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The real guard, multipart interceptor, controller and upload service run here.
// Only Supabase, Prisma and the Cloudinary network client are replaced.
describe('Authenticated property image uploads', () => {
  let app: INestApplication<App>;
  const upsert = jest.fn().mockResolvedValue({ id: 'database-user-123' });
  const uploadStream = jest.fn(
    (
      options: { public_id: string },
      callback: (error: undefined, result: object) => void,
    ) => ({
      end: () =>
        callback(undefined, {
          secure_url: `https://res.cloudinary.com/pilot/${options.public_id}.jpg`,
          public_id: options.public_id,
          width: 100,
          height: 80,
          format: 'jpg',
          extra_provider_metadata: 'not-public',
        }),
    }),
  );

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ user: { upsert } })
      .overrideProvider(CLOUDINARY)
      .useValue({ uploader: { upload_stream: uploadStream } })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  const post = () =>
    request(app.getHttpServer()).post('/uploads/property-images');
  it('rejects missing and invalid tokens without database or upload calls', async () => {
    await post()
      .attach('photos', Buffer.from('test'), {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      })
      .expect(401);
    await post().auth('bad-token', { type: 'bearer' }).expect(401);
    expect(upsert).not.toHaveBeenCalled();
    expect(uploadStream).not.toHaveBeenCalled();
  });
  it('uses the verified database user, ignores forged user IDs, and gives each image a unique ID', async () => {
    const response = await post()
      .auth('valid-token', { type: 'bearer' })
      .field('userId', 'forged-user')
      .attach('photos', jpegBytes, {
        filename: 'first.jpg',
        contentType: 'image/jpeg',
      })
      .attach('photos', pngBytes, {
        filename: 'second.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authUserId: 'verified-supabase-id' },
        create: {
          authUserId: 'verified-supabase-id',
          email: 'owner@pilot.test',
          role: 'OWNER',
        },
      }),
    );
    const body = response.body as { images: { publicId: string }[] };
    expect(body.images).toHaveLength(2);
    expect(new Set(body.images.map((image) => image.publicId)).size).toBe(2);
    for (const image of body.images) {
      expect(image.publicId).toMatch(/^database-user-123-/);
      expect(Object.keys(image).sort()).toEqual([
        'format',
        'height',
        'publicId',
        'url',
        'width',
      ]);
    }
    expect(response.text).not.toContain('forged-user');
    expect(response.text).not.toContain('extra_provider_metadata');
  });
  it('strips embedded metadata such as GPS location before storing', async () => {
    await post()
      .auth('valid-token', { type: 'bearer' })
      .attach('photos', jpegBytes, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ transformation: [{ flags: 'strip_profile' }] }),
      expect.any(Function),
    );
  });
  it('rejects files whose content does not match their declared type', async () => {
    await post()
      .auth('valid-token', { type: 'bearer' })
      .attach('photos', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    await post()
      .auth('valid-token', { type: 'bearer' })
      .attach('photos', pngBytes, {
        filename: 'mislabelled.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(uploadStream).not.toHaveBeenCalled();
  });
  it('rejects empty submissions', async () => {
    await post().auth('valid-token', { type: 'bearer' }).expect(400);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('rejects unsupported MIME types', async () => {
    await post()
      .auth('valid-token', { type: 'bearer' })
      .attach('photos', Buffer.from('test'), {
        filename: 'document.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(uploadStream).not.toHaveBeenCalled();
  });
  it('rejects more than ten images', async () => {
    let submission = post().auth('valid-token', { type: 'bearer' });
    for (let index = 0; index < 11; index++) {
      submission = submission.attach('photos', Buffer.from('test'), {
        filename: `${index}.webp`,
        contentType: 'image/webp',
      });
    }
    await submission.expect(400);
    expect(uploadStream).not.toHaveBeenCalled();
  });
  it('rejects images larger than 8 MiB', async () => {
    await post()
      .auth('valid-token', { type: 'bearer' })
      .attach('photos', Buffer.alloc(8 * 1024 * 1024 + 1), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);
    expect(uploadStream).not.toHaveBeenCalled();
  });
});
