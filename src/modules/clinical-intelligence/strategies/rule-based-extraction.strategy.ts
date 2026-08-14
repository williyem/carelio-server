import {
  MEASUREMENT_KEYWORDS,
  MEASUREMENT_TYPES,
  type MeasurementType,
} from '../measurement-catalog';

export function extractMeasurementsByRules(text: string): MeasurementType[] {
  const normalized = text.toLowerCase();
  const found = new Set<MeasurementType>();

  for (const type of MEASUREMENT_TYPES) {
    const keywords = MEASUREMENT_KEYWORDS[type];
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      found.add(type);
    }
  }

  return Array.from(found);
}
