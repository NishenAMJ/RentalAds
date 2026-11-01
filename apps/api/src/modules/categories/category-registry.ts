import { BadRequestException } from '@nestjs/common';
import type { ListingCategory, RatePeriod } from '@prisma/client';

/**
 * Everything the platform knows about a rentable category. The API validates against it and
 * `GET /categories` serves it, so the web forms and filters are drawn from the same definitions.
 * To launch a category: add it to the ListingCategory enum, then add an entry here and its text to the web messages.
 */
export type FieldType = 'select' | 'number' | 'boolean' | 'text';

export interface FieldOption {
  value: string;
  /** Web translation key for the option label. */
  labelKey: string;
}

export interface FieldDefinition {
  key: string;
  type: FieldType;
  /** Web translation key for the field label. */
  labelKey: string;
  required: boolean;
  options?: readonly FieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface CategoryDefinition {
  id: ListingCategory;
  /** CONCIERGE: renter request then admin introduction. BOOKING: dated booking paid through the platform. */
  flow: 'CONCIERGE' | 'BOOKING';
  ratePeriods: readonly RatePeriod[];
  fields: readonly FieldDefinition[];
  /** The select field the public "type" filter matches on, if any. */
  typeField?: string;
}

const options = (
  category: string,
  field: string,
  values: readonly string[],
): FieldOption[] =>
  values.map((value) => ({
    value,
    labelKey: `cat.${category}.${field}.${value}`,
  }));

const select = (
  category: string,
  key: string,
  values: readonly string[],
  required = true,
): FieldDefinition => ({
  key,
  type: 'select',
  labelKey: `cat.${category}.${key}`,
  required,
  options: options(category, key, values),
});

const number = (
  category: string,
  key: string,
  min: number,
  max: number,
  required = true,
): FieldDefinition => ({
  key,
  type: 'number',
  labelKey: `cat.${category}.${key}`,
  required,
  min,
  max,
});

const flag = (category: string, key: string): FieldDefinition => ({
  key,
  type: 'boolean',
  labelKey: `cat.${category}.${key}`,
  required: false,
});

const text = (
  category: string,
  key: string,
  maxLength: number,
  required = false,
): FieldDefinition => ({
  key,
  type: 'text',
  labelKey: `cat.${category}.${key}`,
  required,
  maxLength,
});

export const CATEGORY_DEFINITIONS: Readonly<
  Record<ListingCategory, CategoryDefinition>
> = {
  PROPERTY: {
    id: 'PROPERTY',
    flow: 'CONCIERGE',
    ratePeriods: ['MONTH'],
    fields: [],
  },
  VEHICLE: {
    id: 'VEHICLE',
    flow: 'BOOKING',
    ratePeriods: ['DAY', 'WEEK'],
    typeField: 'vehicleType',
    fields: [
      select('VEHICLE', 'vehicleType', [
        'CAR',
        'VAN',
        'SUV',
        'MOTORCYCLE',
        'SCOOTER',
        'THREE_WHEELER',
        'BUS',
      ]),
      select('VEHICLE', 'transmission', ['MANUAL', 'AUTOMATIC']),
      select('VEHICLE', 'fuel', ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']),
      number('VEHICLE', 'seats', 1, 60),
      flag('VEHICLE', 'withDriver'),
    ],
  },
  EQUIPMENT: {
    id: 'EQUIPMENT',
    flow: 'BOOKING',
    ratePeriods: ['DAY', 'WEEK'],
    typeField: 'equipmentType',
    fields: [
      select('EQUIPMENT', 'equipmentType', [
        'CAMERA',
        'AUDIO_VIDEO',
        'POWER_TOOLS',
        'CONSTRUCTION',
        'COMPUTING',
        'OTHER',
      ]),
      select('EQUIPMENT', 'condition', ['NEW', 'GOOD', 'FAIR']),
      text('EQUIPMENT', 'brand', 60),
    ],
  },
  EVENT_GEAR: {
    id: 'EVENT_GEAR',
    flow: 'BOOKING',
    ratePeriods: ['DAY'],
    typeField: 'gearType',
    fields: [
      select('EVENT_GEAR', 'gearType', [
        'SOUND',
        'LIGHTING',
        'TENT',
        'FURNITURE',
        'DECOR',
        'STAGING',
      ]),
      number('EVENT_GEAR', 'quantity', 1, 1000),
      flag('EVENT_GEAR', 'deliveryAvailable'),
    ],
  },
};

/** Categories whose listings are booked and paid through the platform. */
export const ITEM_CATEGORIES = Object.values(CATEGORY_DEFINITIONS)
  .filter((definition) => definition.flow === 'BOOKING')
  .map((definition) => definition.id);

export function isItemCategory(category: ListingCategory): boolean {
  return CATEGORY_DEFINITIONS[category].flow === 'BOOKING';
}

/**
 * Checks owner-supplied attributes against the category's fields and returns a clean copy.
 * Unknown keys, wrong types, out-of-range numbers and bad select values are all rejected, so only
 * known fields are ever stored (and later published).
 */
export function validateAttributes(
  category: ListingCategory,
  input: unknown,
): Record<string, string | number | boolean> {
  const definition = CATEGORY_DEFINITIONS[category];
  const source =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const known = new Set(definition.fields.map((field) => field.key));
  const problems = Object.keys(source)
    .filter((key) => !known.has(key))
    .map((key) => `${key} is not a recognised field`);
  const clean: Record<string, string | number | boolean> = {};

  for (const field of definition.fields) {
    const value = source[field.key];
    if (value === undefined || value === null || value === '') {
      if (field.required) problems.push(`${field.key} is required`);
      continue;
    }
    if (field.type === 'select') {
      if (
        typeof value !== 'string' ||
        !field.options?.some((option) => option.value === value)
      )
        problems.push(
          `${field.key} must be one of: ${field.options?.map((option) => option.value).join(', ')}`,
        );
      else clean[field.key] = value;
    } else if (field.type === 'number') {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < field.min! ||
        value > field.max!
      )
        problems.push(
          `${field.key} must be a whole number from ${field.min} to ${field.max}`,
        );
      else clean[field.key] = value;
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean')
        problems.push(`${field.key} must be true or false`);
      else clean[field.key] = value;
    } else if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > field.maxLength!
    ) {
      problems.push(
        `${field.key} must be text of at most ${field.maxLength} characters`,
      );
    } else clean[field.key] = value.trim();
  }
  if (problems.length) throw new BadRequestException(problems);
  return clean;
}
