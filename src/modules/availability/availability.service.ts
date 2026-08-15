import { Types } from 'mongoose';
import { Appointment, Doctor, DoctorAvailability } from '../../models';
import { AppError } from '../../utils/errors';
import {
  DAYS_OF_WEEK,
  defaultAvailabilityDays,
  type DayName,
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

const GMT_TIMEZONE = 'GMT';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function normalizeRange(range: TimeRange): TimeRange {
  const start = String(range?.start ?? '').slice(0, 5);
  const end = String(range?.end ?? '').slice(0, 5);
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
    throw new AppError('Times must be HH:MM in GMT', 400);
  }
  if (toMinutes(start) >= toMinutes(end)) {
    throw new AppError('Each period must end after it starts', 400);
  }
  return { start, end };
}

function asDaysRecord(value: unknown): Record<string, TimeRange[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, TimeRange[]>;
}

export function normalizeDays(
  days?: Record<string, TimeRange[]> | null
): Record<DayName, TimeRange[]> {
  const source = asDaysRecord(days);
  const normalized = {} as Record<DayName, TimeRange[]>;
  for (const day of DAYS_OF_WEEK) {
    const ranges = source[day];
    normalized[day] = Array.isArray(ranges) ? ranges.map(normalizeRange) : [];
  }
  return normalized;
}

function serializeAvailability(doc: {
  timezone: string;
  enabled: boolean;
  days: Record<string, TimeRange[]>;
}) {
  return {
    timezone: GMT_TIMEZONE,
    enabled: doc.enabled,
    days: normalizeDays(doc.days),
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
      timezone: GMT_TIMEZONE,
      enabled: true,
      days: defaultAvailabilityDays(),
    });
  }
  return record;
}

export async function getAvailability(
  doctorId: string,
  date?: string,
  options?: { excludeAppointmentId?: string }
) {
  const record = await getOrCreate(doctorId);
  const days = normalizeDays(asDaysRecord(record.days));
  const base = {
    timezone: GMT_TIMEZONE,
    enabled: record.enabled,
    days,
  };

  if (!date) return base;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('Invalid date', 400);
  }
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    throw new AppError('Invalid date', 400);
  }

  const dayName = DAYS_OF_WEEK[dayStart.getUTCDay()];
  const ranges: TimeRange[] = record.enabled
    ? days[dayName] || []
    : [{ start: '08:00', end: '18:00' }];

  let slots = splitRangesIntoHourSlots(ranges);

  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const busyFilter: Record<string, unknown> = {
    doctorId: new Types.ObjectId(doctorId),
    status: {
      $in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'],
    },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  };
  if (options?.excludeAppointmentId) {
    busyFilter._id = { $ne: new Types.ObjectId(options.excludeAppointmentId) };
  }

  const busy = await Appointment.find(busyFilter).select('startTime endTime');

  slots = slots.filter((slot) => {
    const slotStart = toMinutes(slot.start);
    const slotEnd = toMinutes(slot.end);
    return !busy.some((apt) => {
      if (!apt.startTime || !apt.endTime) return false;
      const busyStart =
        apt.startTime.getUTCHours() * 60 + apt.startTime.getUTCMinutes();
      const busyEnd =
        apt.endTime.getUTCHours() * 60 + apt.endTime.getUTCMinutes();
      return slotStart < busyEnd && busyStart < slotEnd;
    });
  });

  const todayGmt = new Date().toISOString().slice(0, 10);
  if (date === todayGmt) {
    const now = new Date();
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    slots = slots.filter((slot) => toMinutes(slot.start) > nowMin);
  }

  return { ...base, date, slots };
}

export async function assertBookableSlot(
  doctorId: string,
  start: Date,
  end: Date,
  options?: { excludeAppointmentId?: string }
) {
  const date = start.toISOString().slice(0, 10);
  if (end.toISOString().slice(0, 10) !== date) {
    throw new AppError('Appointments must start and end on the same GMT day', 400);
  }

  const availability = await getAvailability(doctorId, date, options);
  if (!('slots' in availability)) {
    throw new AppError(
      "Selected time is outside this doctor's available hours",
      400
    );
  }
  const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
  const matches = availability.slots.some(
    (slot) =>
      toMinutes(slot.start) === startMin && toMinutes(slot.end) === endMin
  );
  if (!matches) {
    throw new AppError(
      "Selected time is outside this doctor's available hours",
      400
    );
  }
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
  record.timezone = GMT_TIMEZONE;
  if (typeof input.enabled === 'boolean') record.enabled = input.enabled;
  if (input.days && typeof input.days === 'object') {
    record.days = normalizeDays(input.days);
    record.markModified('days');
  }
  await record.save();

  const doctor = await Doctor.findById(doctorId);
  if (doctor) {
    doctor.timezone = GMT_TIMEZONE;
    await doctor.save();
  }

  return serializeAvailability(record);
}
