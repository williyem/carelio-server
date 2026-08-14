import { Types } from 'mongoose';
import { Appointment, Doctor, DoctorAvailability } from '../../models';
import { AppError } from '../../utils/errors';
import {
  DAYS_OF_WEEK,
  defaultAvailabilityDays,
} from '../../utils/staff-profile';

export interface TimeRange {
  start: string;
  end: string;
}

export interface HourSlot {
  start: string;
  end: string;
  label: string;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function format12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function splitRangesIntoHourSlots(ranges: TimeRange[]): HourSlot[] {
  const slots: HourSlot[] = [];
  for (const range of ranges) {
    let start = toMinutes(range.start);
    const end = toMinutes(range.end);
    while (start + 60 <= end) {
      const slotStart = fromMinutes(start);
      const slotEnd = fromMinutes(start + 60);
      slots.push({
        start: slotStart,
        end: slotEnd,
        label: `${format12Hour(slotStart)} - ${format12Hour(slotEnd)}`,
      });
      start += 60;
    }
  }
  return slots;
}

function serializeAvailability(doc: {
  timezone: string;
  enabled: boolean;
  days: Record<string, TimeRange[]>;
}) {
  return {
    timezone: doc.timezone || 'America/New_York',
    enabled: doc.enabled,
    days: doc.days || {},
  };
}

async function getOrCreate(doctorId: string) {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.isActive) {
    throw new AppError('Doctor not found', 404);
  }

  let record = await DoctorAvailability.findOne({
    doctorId: new Types.ObjectId(doctorId),
  });
  if (!record) {
    record = await DoctorAvailability.create({
      doctorId: new Types.ObjectId(doctorId),
      timezone: doctor.timezone || 'America/New_York',
      enabled: true,
      days: defaultAvailabilityDays(),
    });
  }
  return record;
}

export async function getAvailability(doctorId: string, date?: string) {
  const record = await getOrCreate(doctorId);
  const base = serializeAvailability(record);

  if (!date) return base;

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('Invalid date', 400);
  }

  const dayName = DAYS_OF_WEEK[parsed.getDay()];
  const ranges: TimeRange[] = record.enabled
    ? (record.days?.[dayName] as TimeRange[]) || []
    : [{ start: '08:00', end: '18:00' }];

  let slots = splitRangesIntoHourSlots(ranges);

  const dayStart = new Date(parsed);
  const dayEnd = new Date(parsed);
  dayEnd.setHours(23, 59, 59, 999);

  const busy = await Appointment.find({
    doctorId: new Types.ObjectId(doctorId),
        status: { $in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  }).select('startTime endTime');

  slots = slots.filter((slot) => {
    const slotStart = toMinutes(slot.start);
    const slotEnd = toMinutes(slot.end);
    return !busy.some((apt) => {
      if (!apt.startTime || !apt.endTime) return false;
      const busyStart = apt.startTime.getHours() * 60 + apt.startTime.getMinutes();
      const busyEnd = apt.endTime.getHours() * 60 + apt.endTime.getMinutes();
      return slotStart < busyEnd && busyStart < slotEnd;
    });
  });

  return { ...base, date, slots };
}

export async function updateAvailability(
  doctorId: string,
  input: {
    timezone?: string;
    enabled?: boolean;
    days?: Record<string, TimeRange[]>;
  }
) {
  const record = await getOrCreate(doctorId);
  if (typeof input.timezone === 'string') record.timezone = input.timezone;
  if (typeof input.enabled === 'boolean') record.enabled = input.enabled;
  if (input.days && typeof input.days === 'object') {
    record.days = input.days;
    record.markModified('days');
  }
  await record.save();

  const doctor = await Doctor.findById(doctorId);
  if (doctor && input.timezone) {
    doctor.timezone = input.timezone;
    await doctor.save();
  }

  return serializeAvailability(record);
}
