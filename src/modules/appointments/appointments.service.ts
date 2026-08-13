import { Types } from "mongoose";
import { Appointment, Patient, Doctor, IAppointment } from "../../models";
import { AppError } from "../../utils/errors";
import { buildPaginatedResult, parsePagination } from "../../utils/paginate";
import { generateAppointmentCode } from "../../utils/ids";
import { serializeAppointment } from "../../serializers/appointment.serializer";
import type { UserRole } from "../../utils/tokens";

async function resolvePatientObjectId(
  patientId: string,
): Promise<Types.ObjectId> {
  if (Types.ObjectId.isValid(patientId)) {
    const byId = await Patient.findById(patientId);
    if (byId) return byId._id as Types.ObjectId;
  }
  const byCode = await Patient.findOne({ patientId });
  if (!byCode) throw new AppError("Patient not found", 404);
  return byCode._id as Types.ObjectId;
}

async function getPopulated(id: string) {
  const apt = await Appointment.findById(id)
    .populate("doctorId")
    .populate("patientId");
  if (!apt) throw new AppError("Appointment not found", 404);
  return apt;
}

export async function listAppointments(
  query: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  },
  auth: { id: string; role: UserRole },
) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (auth.role === "doctor") {
    filter.doctorId = new Types.ObjectId(auth.id);
  }

  if (query.status) filter.status = query.status as IAppointment["status"];

  if (query.startDate || query.endDate) {
    filter.startTime = {};
    if (query.startDate) {
      (filter.startTime as Record<string, Date>).$gte = new Date(
        query.startDate,
      );
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      // include end of day if date-only
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999);
      (filter.startTime as Record<string, Date>).$lte = end;
    }
  }

  const [docs, totalDocs] = await Promise.all([
    Appointment.find(filter)
      .populate("doctorId")
      .populate("patientId")
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    docs.map((d) => serializeAppointment(d)),
    totalDocs,
    page,
    limit,
  );
}

export async function listUpcoming(
  query: { page?: number; limit?: number },
  auth: { id: string; role: UserRole },
) {
  const { page, limit, skip } = parsePagination({
    page: query.page,
    limit: query.limit ?? 5,
  });

  const filter: Record<string, unknown> = {
    status: { $in: ["CONFIRMED", "PENDING_CONFIRMATION"] },
    startTime: { $gte: new Date() },
  };

  if (auth.role === "doctor") {
    filter.doctorId = new Types.ObjectId(auth.id);
  }

  const [docs, totalDocs] = await Promise.all([
    Appointment.find(filter)
      .populate("doctorId")
      .populate("patientId")
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    docs.map((d) => serializeAppointment(d)),
    totalDocs,
    page,
    limit,
  );
}

export async function listRecent(auth: { id: string; role: UserRole }) {
  const filter: Record<string, unknown> = {
    status: "COMPLETED",
  };
  if (auth.role === "doctor") {
    filter.doctorId = new Types.ObjectId(auth.id);
  }

  const docs = await Appointment.find(filter)
    .populate("doctorId")
    .populate("patientId")
    .sort({ endTime: -1, updatedAt: -1 })
    .limit(20);

  const serialized = docs.map((d) => serializeAppointment(d));
  return buildPaginatedResult(serialized, serialized.length, 1, 20);
}

export async function getAppointmentById(id: string) {
  const apt = await getPopulated(id);
  return serializeAppointment(apt);
}

export async function listPatientAppointments(
  patientIdParam: string,
  query: { page?: number; limit?: number; status?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const patientObjectId = await resolvePatientObjectId(patientIdParam);

  const filter: Record<string, unknown> = { patientId: patientObjectId };
  if (query.status) filter.status = query.status as IAppointment["status"];

  const [docs, totalDocs] = await Promise.all([
    Appointment.find(filter)
      .populate("doctorId")
      .populate("patientId")
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    docs.map((d) => serializeAppointment(d)),
    totalDocs,
    page,
    limit,
  );
}

export async function createAppointment(
  input: {
    patientId: string;
    isImmediate: boolean;
    startTime?: string;
    endTime?: string;
    doctorId?: string;
  },
  auth: { id: string; role: UserRole },
) {
  const patientObjectId = await resolvePatientObjectId(input.patientId);

  let doctorId: string;
  if (auth.role === "doctor") {
    doctorId = auth.id;
  } else {
    if (!input.doctorId) {
      throw new AppError("doctorId is required", 400);
    }
    doctorId = input.doctorId;
  }

  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.isActive) {
    throw new AppError("Doctor not found", 404);
  }

  let startTime: Date;
  let endTime: Date;
  let status: IAppointment["status"];

  if (input.isImmediate) {
    startTime = new Date();
    endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    status = "CONFIRMED";
  } else {
    if (!input.startTime || !input.endTime) {
      throw new AppError("startTime and endTime are required", 400);
    }
    startTime = new Date(input.startTime);
    endTime = new Date(input.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new AppError("Invalid startTime or endTime", 400);
    }
    if (endTime <= startTime) {
      throw new AppError("endTime must be after startTime", 400);
    }
    status = "CONFIRMED";
  }

  let code = generateAppointmentCode();
  while (await Appointment.exists({ code })) {
    code = generateAppointmentCode();
  }

  const apt = await Appointment.create({
    patientId: patientObjectId,
    doctorId: new Types.ObjectId(doctorId),
    startTime,
    endTime,
    isImmediate: input.isImmediate,
    status,
    code,
    telehealth: {
      doctorToken: null,
      patientToken: null,
      sessionId: null,
    },
  });

  const populated = await getPopulated(apt._id.toString());
  return serializeAppointment(populated);
}

export async function rescheduleAppointment(
  id: string,
  input: { startTime: string; endTime: string; reschedulingReason?: string },
) {
  const apt = await Appointment.findById(id);
  if (!apt) throw new AppError("Appointment not found", 404);
  if (apt.status === "CANCELLED" || apt.status === "COMPLETED") {
    throw new AppError(
      `Cannot reschedule a ${apt.status.toLowerCase()} appointment`,
      400,
    );
  }

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new AppError("Invalid startTime or endTime", 400);
  }
  if (endTime <= startTime) {
    throw new AppError("endTime must be after startTime", 400);
  }

  apt.startTime = startTime;
  apt.endTime = endTime;
  apt.reschedulingReason = input.reschedulingReason ?? null;
  apt.isImmediate = false;
  apt.status = "CONFIRMED";
  await apt.save();

  const populated = await getPopulated(apt._id.toString());
  return serializeAppointment(populated);
}

export async function cancelAppointment(
  id: string,
  cancellationReason: string,
  auth: { id: string; role: UserRole },
) {
  const apt = await Appointment.findById(id);
  if (!apt) throw new AppError("Appointment not found", 404);
  if (apt.status === "CANCELLED") {
    throw new AppError("Appointment is already cancelled", 400);
  }
  if (apt.status === "COMPLETED") {
    throw new AppError("Cannot cancel a completed appointment", 400);
  }

  apt.status = "CANCELLED";
  apt.cancellationReason = cancellationReason;
  apt.cancelledBy = new Types.ObjectId(auth.id);
  apt.cancelledByUserType = auth.role === "patient" ? "patient" : "doctor";
  await apt.save();

  const populated = await getPopulated(apt._id.toString());
  return serializeAppointment(populated);
}
