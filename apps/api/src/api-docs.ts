import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Interactive API documentation at /docs, generated from the controllers and DTOs.
 * On by default while developing; in production set ENABLE_API_DOCS=true to publish it.
 */
export function configureApiDocs(app: INestApplication) {
  const enabled =
    process.env.ENABLE_API_DOCS === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_API_DOCS !== 'false');
  if (!enabled) return;
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('RentalHub Sri Lanka API')
      .setDescription(
        'Rentals for homes (introduced by our team) and items such as vehicles, equipment and event gear (booked and paid online). ' +
          'Routes marked with a lock need a Supabase access token as a Bearer token; browsing and price quotes are public. ' +
          'Money is whole Sri Lankan rupees; dates are YYYY-MM-DD in Sri Lanka time.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
