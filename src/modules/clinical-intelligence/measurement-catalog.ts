export const MEASUREMENT_TYPES = [
  'thermometer',
  'blood-pressure',
  'pulse-ox',
  'glucose',
  'weight-scale',
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  thermometer: 'Temperature',
  'blood-pressure': 'Blood pressure',
  'pulse-ox': 'Heart rate / SpO₂',
  glucose: 'Blood glucose',
  'weight-scale': 'Weight',
};

/** Keyword groups — first match wins per type when scanning text. */
export const MEASUREMENT_KEYWORDS: Record<MeasurementType, string[]> = {
  'blood-pressure': [
    'blood pressure',
    'bp',
    'systolic',
    'diastolic',
    'pressure check',
  ],
  thermometer: ['temperature', 'temp', 'fever', 'body temp', 'thermometer'],
  'pulse-ox': [
    'oxygen',
    'spo2',
    'sp o2',
    'pulse ox',
    'pulse oximeter',
    'heart rate',
    'pulse rate',
  ],
  glucose: ['glucose', 'blood sugar', 'blood glucose', 'sugar level'],
  'weight-scale': ['weight', 'weigh', 'body weight', 'scale'],
};

export function isMeasurementType(value: string): value is MeasurementType {
  return (MEASUREMENT_TYPES as readonly string[]).includes(value);
}

export function labelForMeasurement(type: string): string {
  if (isMeasurementType(type)) return MEASUREMENT_LABELS[type];
  return type.replace(/-/g, ' ');
}
