import { DeviceGuide, type IDeviceGuide } from '../../models/DeviceGuide';
import { AppError } from '../../utils/errors';
import type { DeviceGuideSlug } from '../../models/DeviceGuide';

export function serializeDeviceGuide(guide: IDeviceGuide) {
  return {
    id: guide._id.toString(),
    slug: guide.slug,
    title: guide.title,
    shortLabel: guide.shortLabel,
    description: guide.description,
    image: guide.imageUrl || '',
    imageUrl: guide.imageUrl || '',
    video: guide.videoUrl || '',
    youtubeUrl: guide.youtubeUrl || '',
    tips: guide.tips || [],
    steps: guide.steps || [],
    sortOrder: guide.sortOrder ?? 0,
    isActive: guide.isActive !== false,
    createdAt: guide.createdAt.toISOString(),
    updatedAt: guide.updatedAt.toISOString(),
  };
}

const SEED_GUIDES: Array<{
  slug: DeviceGuideSlug;
  title: string;
  shortLabel: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  tips: string[];
  steps: string[];
  sortOrder: number;
}> = [
  {
    slug: 'thermometer',
    title: 'Digital thermometer',
    shortLabel: 'Temperature',
    description:
      'Measures body temperature. Prefer oral or temporal readings unless your clinician asks otherwise.',
    imageUrl: '/device-guides/thermometer/hero.jpg',
    videoUrl: '/device-guides/thermometer/demo.mp4',
    tips: [
      'Wait 15 minutes after hot/cold drinks before an oral reading.',
      'Keep the tip clean and dry before each use.',
    ],
    steps: [
      'Turn the thermometer on and wait for the ready indicator.',
      'Place it under the tongue (or against the temple for temporal models).',
      'Hold still until it beeps or the reading locks.',
      'Confirm the value on Carelio, or enter it manually if the device did not sync.',
    ],
    sortOrder: 1,
  },
  {
    slug: 'blood-pressure',
    title: 'Blood pressure cuff',
    shortLabel: 'Blood pressure',
    description:
      'Measures systolic and diastolic pressure, usually from the upper arm.',
    imageUrl: '/device-guides/blood-pressure/hero.jpg',
    videoUrl: '/device-guides/blood-pressure/demo.mp4',
    tips: [
      'Sit with feet flat and the arm resting at heart level.',
      'Avoid talking during the measurement.',
    ],
    steps: [
      'Wrap the cuff snugly around the bare upper arm.',
      'Align the artery marker with the inside of the elbow crease.',
      'Press start and stay still until the cuff deflates.',
      'Review systolic/diastolic values, then confirm in Carelio.',
    ],
    sortOrder: 2,
  },
  {
    slug: 'pulse-ox',
    title: 'Pulse oximeter',
    shortLabel: 'Heart rate / SpO₂',
    description:
      'Clips onto a fingertip to estimate heart rate and oxygen saturation.',
    imageUrl: '/device-guides/pulse-ox/hero.jpg',
    videoUrl: '/device-guides/pulse-ox/demo.mp4',
    tips: [
      'Remove dark nail polish if readings look unstable.',
      'Warm cold fingers before measuring.',
    ],
    steps: [
      'Open the clip and place it on the index or middle finger.',
      'Keep the hand still with the display facing up.',
      'Wait until SpO₂ and pulse stabilize (usually a few seconds).',
      'Confirm the reading in Carelio or enter it manually.',
    ],
    sortOrder: 3,
  },
  {
    slug: 'glucose',
    title: 'Glucose meter',
    shortLabel: 'Blood glucose',
    description:
      'Measures blood glucose from a fingerstick sample using a test strip.',
    imageUrl: '/device-guides/glucose/hero.jpg',
    videoUrl: '/device-guides/glucose/demo.mp4',
    tips: [
      'Wash and dry hands before testing.',
      'Use a new lancet and strip for each reading.',
    ],
    steps: [
      'Insert a test strip and wait for the meter to prompt for a sample.',
      'Lance the side of a fingertip and apply a drop to the strip.',
      'Wait for the meter result.',
      'Confirm the value in Carelio or record it manually.',
    ],
    sortOrder: 4,
  },
  {
    slug: 'weight-scale',
    title: 'Weight scale',
    shortLabel: 'Weight',
    description: 'Measures body weight. Prefer a hard, level floor.',
    imageUrl: '/device-guides/weight-scale/hero.jpg',
    videoUrl: '/device-guides/weight-scale/demo.mp4',
    tips: [
      'Weigh at a consistent time of day when possible.',
      'Remove shoes and heavy outerwear for comparable readings.',
    ],
    steps: [
      'Place the scale on a hard, flat surface.',
      'Step on with weight evenly distributed.',
      'Stand still until the reading locks.',
      'Confirm the weight in Carelio or enter it manually.',
    ],
    sortOrder: 5,
  },
];

export async function seedDeviceGuides() {
  for (const guide of SEED_GUIDES) {
    await DeviceGuide.findOneAndUpdate(
      { slug: guide.slug },
      {
        $setOnInsert: {
          ...guide,
          youtubeUrl: '',
          isActive: true,
        },
      },
      { upsert: true }
    );
  }
}

export async function listActiveDeviceGuides() {
  const docs = await DeviceGuide.find({ isActive: true }).sort({
    sortOrder: 1,
    title: 1,
  });
  return docs.map(serializeDeviceGuide);
}

export async function listAllDeviceGuides() {
  const docs = await DeviceGuide.find().sort({ sortOrder: 1, title: 1 });
  return docs.map(serializeDeviceGuide);
}

export async function createDeviceGuide(input: {
  slug: string;
  title: string;
  shortLabel: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  tips?: string[];
  steps?: string[];
  sortOrder?: number;
  isActive?: boolean;
}) {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new AppError(
      'Slug must be lowercase letters, numbers, and hyphens',
      400
    );
  }

  const existing = await DeviceGuide.findOne({ slug }).exec();
  if (existing) {
    throw new AppError('A device guide with this slug already exists', 409);
  }

  const count = await DeviceGuide.countDocuments();
  const guide = await DeviceGuide.create({
    slug,
    title: input.title.trim(),
    shortLabel: input.shortLabel.trim(),
    description: input.description?.trim() || '',
    imageUrl: input.imageUrl || '',
    videoUrl: input.videoUrl || '',
    youtubeUrl: input.youtubeUrl || '',
    tips: input.tips || [],
    steps: input.steps || [],
    sortOrder: input.sortOrder ?? count + 1,
    isActive: input.isActive !== false,
  });

  return serializeDeviceGuide(guide);
}

export async function deleteDeviceGuide(slug: string) {
  const result = await DeviceGuide.findOneAndDelete({
    slug: slug.trim().toLowerCase(),
  }).exec();
  if (!result) {
    throw new AppError('Device guide not found', 404);
  }
  return { deleted: true, slug: result.slug };
}

export async function updateDeviceGuide(
  slug: string,
  input: Partial<{
    title: string;
    shortLabel: string;
    description: string;
    imageUrl: string;
    videoUrl: string;
    youtubeUrl: string;
    tips: string[];
    steps: string[];
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const guide = await DeviceGuide.findOne({
    slug: slug.trim().toLowerCase(),
  }).exec();
  if (!guide) {
    throw new AppError('Device guide not found', 404);
  }

  if (typeof input.title === 'string') guide.title = input.title;
  if (typeof input.shortLabel === 'string') guide.shortLabel = input.shortLabel;
  if (typeof input.description === 'string')
    guide.description = input.description;
  if (typeof input.imageUrl === 'string') guide.imageUrl = input.imageUrl;
  if (typeof input.videoUrl === 'string') guide.videoUrl = input.videoUrl;
  if (typeof input.youtubeUrl === 'string') guide.youtubeUrl = input.youtubeUrl;
  if (Array.isArray(input.tips)) guide.tips = input.tips;
  if (Array.isArray(input.steps)) guide.steps = input.steps;
  if (typeof input.sortOrder === 'number') guide.sortOrder = input.sortOrder;
  if (typeof input.isActive === 'boolean') guide.isActive = input.isActive;

  await guide.save();
  return serializeDeviceGuide(guide);
}
