import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CATEGORY_DEFINITIONS } from './category-registry';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly config: ConfigService) {}

  /** Category definitions the web uses to draw forms and filters. Set ENABLED_CATEGORIES to launch gradually. */
  @Get()
  list() {
    const enabled = this.config
      .get<string>('ENABLED_CATEGORIES')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return Object.values(CATEGORY_DEFINITIONS).filter(
      (definition) => !enabled?.length || enabled.includes(definition.id),
    );
  }
}
