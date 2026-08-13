import { Types } from 'mongoose';
import { Appointment, ConsultationNote } from '../../models';
import { AppError } from '../../utils/errors';
import { buildPaginatedResult, parsePagination } from '../../utils/paginate';
import { serializeAppointment } from '../../serializers/appointment.serializer';

function serializeNote(
  note: {
    _id: Types.ObjectId;
    appointmentId: Types.ObjectId;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    status: 'DRAFT' | 'FINAL';
    createdAt: Date;
    updatedAt: Date;
  },
  appointment?: ReturnType<typeof serializeAppointment>
) {
  const soapNote = {
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
  };
  return {
    id: note._id.toString(),
    appointmentId: note.appointmentId.toString(),
    status: note.status,
    soapNote,
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    ...(appointment ? { appointment } : {}),
  };
}

export async function getNoteByAppointment(appointmentId: string) {
  if (!Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('Appointment not found', 404);
  }
  const note = await ConsultationNote.findOne({
    appointmentId: new Types.ObjectId(appointmentId),
  });
  if (!note) {
    throw new AppError('Note not found', 404);
  }
  return serializeNote(note);
}

export async function listPatientNotes(
  patientId: string,
  query: { page?: number; limit?: number; search?: string }
) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (Types.ObjectId.isValid(patientId)) {
    filter.patientId = new Types.ObjectId(patientId);
  } else {
    throw new AppError('Patient not found', 404);
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { subjective: { $regex: q, $options: 'i' } },
      { objective: { $regex: q, $options: 'i' } },
      { assessment: { $regex: q, $options: 'i' } },
      { plan: { $regex: q, $options: 'i' } },
    ];
  }

  const [docs, totalDocs] = await Promise.all([
    ConsultationNote.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    ConsultationNote.countDocuments(filter),
  ]);

  const appointmentIds = docs.map((d) => d.appointmentId);
  const appointments = await Appointment.find({
    _id: { $in: appointmentIds },
  })
    .populate('doctorId')
    .populate('patientId');
  const byId = new Map(
    appointments.map((apt) => [apt._id.toString(), serializeAppointment(apt)])
  );

  return buildPaginatedResult(
    docs.map((note) =>
      serializeNote(note, byId.get(note.appointmentId.toString()))
    ),
    totalDocs,
    page,
    limit
  );
}

export async function upsertSoap(
  appointmentId: string,
  input: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    action?: 'save' | 'approve';
  }
) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);

  const status = input.action === 'approve' ? 'FINAL' : 'DRAFT';
  const note = await ConsultationNote.findOneAndUpdate(
    { appointmentId: appointment._id },
    {
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      subjective: input.subjective ?? '',
      objective: input.objective ?? '',
      assessment: input.assessment ?? '',
      plan: input.plan ?? '',
      status,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return serializeNote(note!);
}

export async function updateNote(
  noteId: string,
  input: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    action?: 'save' | 'approve';
  }
) {
  const note = await ConsultationNote.findById(noteId);
  if (!note) throw new AppError('Note not found', 404);

  if (typeof input.subjective === 'string') note.subjective = input.subjective;
  if (typeof input.objective === 'string') note.objective = input.objective;
  if (typeof input.assessment === 'string') note.assessment = input.assessment;
  if (typeof input.plan === 'string') note.plan = input.plan;
  if (input.action === 'approve') note.status = 'FINAL';
  if (input.action === 'save') note.status = 'DRAFT';
  await note.save();
  return serializeNote(note);
}

export async function completeConsultation(appointmentId: string) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId')
    .populate('patientId');
  if (!appointment) throw new AppError('Appointment not found', 404);
  appointment.status = 'COMPLETED';
  if (!appointment.endTime) appointment.endTime = new Date();
  await appointment.save();
  return serializeAppointment(appointment);
}
