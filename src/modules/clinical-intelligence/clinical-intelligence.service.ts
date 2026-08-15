import type { MeasurementType } from './measurement-catalog';
import { labelForMeasurement } from './measurement-catalog';
import { extractMeasurementsByAi } from './strategies/ai-extraction.strategy';
import { extractMeasurementsByRules } from './strategies/rule-based-extraction.strategy';

export type ExtractionStrategy = 'ai' | 'rules';

export type ExtractMeasurementsResult = {
  measurements: {
    vitalType: MeasurementType;
    label: string;
  }[];
  strategy: ExtractionStrategy;
  degraded: boolean;
};

export async function extractMeasurements(
  text: string
): Promise<ExtractMeasurementsResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { measurements: [], strategy: 'rules', degraded: false };
  }

  const aiResult = await extractMeasurementsByAi(trimmed);
  if (aiResult !== null) {
    return {
      measurements: aiResult.map((vitalType) => ({
        vitalType,
        label: labelForMeasurement(vitalType),
      })),
      strategy: 'ai',
      degraded: false,
    };
  }

  const ruleResult = extractMeasurementsByRules(trimmed);
  return {
    measurements: ruleResult.map((vitalType) => ({
      vitalType,
      label: labelForMeasurement(vitalType),
    })),
    strategy: 'rules',
    degraded: true,
  };
}
