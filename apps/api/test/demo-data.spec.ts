import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATEGORY_DEFINITIONS,
  isItemCategory,
  validateAttributes,
} from '../src/modules/categories/category-registry';

interface DemoListing {
  category: keyof typeof CATEGORY_DEFINITIONS;
  title: string;
  description: string;
  areaText: string;
  rate: number;
  ratePeriod: 'DAY' | 'WEEK' | 'MONTH';
  depositAmount: number;
  attributes: Record<string, unknown>;
  photo: string;
}

const data = JSON.parse(
  readFileSync(join(__dirname, '../scripts/demo-data.json'), 'utf8'),
) as { listings: DemoListing[] };

// The sample data goes straight into the database, bypassing the API, so it must obey the same rules the API enforces.
describe('demo seed data', () => {
  it('covers every item category', () => {
    const categories = new Set(data.listings.map((item) => item.category));
    for (const category of Object.keys(CATEGORY_DEFINITIONS))
      if (isItemCategory(category as keyof typeof CATEGORY_DEFINITIONS))
        expect(categories).toContain(category);
  });

  it.each(data.listings.map((item) => [item.title, item] as const))(
    '%s is valid for its category',
    (_title, item) => {
      expect(isItemCategory(item.category)).toBe(true);
      expect(validateAttributes(item.category, item.attributes)).toEqual(
        item.attributes,
      );
      expect(CATEGORY_DEFINITIONS[item.category].ratePeriods).toContain(
        item.ratePeriod,
      );
      expect(item.rate).toBeGreaterThan(0);
      expect(item.depositAmount).toBeGreaterThanOrEqual(0);
      expect(item.title.length).toBeGreaterThanOrEqual(3);
      expect(item.photo).toMatch(/^[a-z0-9-]+$/);
    },
  );

  it('uses unique titles so the demo listings are easy to tell apart', () => {
    const titles = data.listings.map((item) => item.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
