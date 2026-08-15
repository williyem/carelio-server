import { chatCompletion } from '../openrouter.client';
import {
  isMeasurementType,
  MEASUREMENT_TYPES,
  type MeasurementType,
} from '../measurement-catalog';

const SYSTEM_PROMPT = `You extract requested patient measurements from clinician notes.
Return ONLY valid JSON: {"measurements":["blood-pressure"]}
Allowed values: ${MEASUREMENT_TYPES.join(', ')}
Do not diagnose or recommend treatment. Only list measurement types explicitly or clearly implied.`;

function parseAiJson(content: string): MeasurementType[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as { measurements?: unknown };
    if (!Array.isArray(parsed.measurements)) return [];
    return parsed.measurements.filter(
      (item): item is MeasurementType =>
        typeof item === 'string' && isMeasurementType(item)
    );
  } catch {
    return [];
  }
}

export async function extractMeasurementsByAi(
  text: string
): Promise<MeasurementType[] | null> {
  const content = await chatCompletion([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Extract measurement types from this clinical note:\n\n${text}`,
    },
  ]);

  if (!content) return null;
  return parseAiJson(content);
}
