import { Types } from 'mongoose';
import { Appointment, ConsultationNote } from '../../models';
import { AppError } from '../../utils/errors';
import { buildPaginatedResult, parsePagination } from '../../utils/paginate';
import { serializeAppointment } from '../../serializers/appointment.serializer';
import type { UserRole } from '../../utils/tokens';

function isoDate(value?: Date | null) {
  return value ? value.toISOString() : null;
}

const SOAP_FIELDS = ['subjective', 'objective', 'assessment', 'plan'] as const;
type SoapField = (typeof SOAP_FIELDS)[number];

function mergeSoapFields(existing: string[] | undefined, incoming: SoapField[]) {
  return [...new Set([...(existing ?? []), ...incoming])];
}

function soapFieldsForRole(
  note: {
    planSharedAt?: Date | null;
    planSharedWithPatientAt?: Date | null;
    planSharedWithHealthAssistantAt?: Date | null;
    sharedSoapFieldsPatient?: string[];
    sharedSoapFieldsHealthAssistant?: string[];
  },
  role?: UserRole
): SoapField[] {
  const stored =
    role === 'healthAssistant'
      ? note.sharedSoapFieldsHealthAssistant
      : note.sharedSoapFieldsPatient;
  if (stored?.length) {
    return SOAP_FIELDS.filter((field) => stored.includes(field));
  }
  const wasShared =
    role === 'healthAssistant'
      ? isSharedWithHealthAssistant(note)
      : isSharedWithPatient(note);
  if (wasShared) {
    return ['plan'];
  }
  return [];
}

function serializeShareFields(note: {
  planSharedAt?: Date | null;
  planSharedWithPatientAt?: Date | null;
  planSharedWithHealthAssistantAt?: Date | null;
  sharedSoapFieldsPatient?: string[];
  sharedSoapFieldsHealthAssistant?: string[];
}) {
  return {
    planSharedAt: isoDate(note.planSharedAt),
    planSharedWithPatientAt: isoDate(note.planSharedWithPatientAt),
    planSharedWithHealthAssistantAt: isoDate(
      note.planSharedWithHealthAssistantAt
    ),
    sharedSoapFieldsPatient: note.sharedSoapFieldsPatient ?? [],
    sharedSoapFieldsHealthAssistant: note.sharedSoapFieldsHealthAssistant ?? [],
  };
}

function isLegacyShared(note: {
  planSharedAt?: Date | null;
  planSharedWithPatientAt?: Date | null;
  planSharedWithHealthAssistantAt?: Date | null;
}) {
  return Boolean(
    note.planSharedAt &&
      !note.planSharedWithPatientAt &&
      !note.planSharedWithHealthAssistantAt
  );
}

function isSharedWithPatient(note: {
  planSharedAt?: Date | null;
  planSharedWithPatientAt?: Date | null;
  planSharedWithHealthAssistantAt?: Date | null;
}) {
  return Boolean(note.planSharedWithPatientAt) || isLegacyShared(note);
}

function isSharedWithHealthAssistant(note: {
  planSharedAt?: Date | null;
  planSharedWithPatientAt?: Date | null;
  planSharedWithHealthAssistantAt?: Date | null;
}) {
  return Boolean(note.planSharedWithHealthAssistantAt) || isLegacyShared(note);
}

function serializeNote(
  note: {
    _id: Types.ObjectId;
    appointmentId: Types.ObjectId;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    status: 'DRAFT' | 'FINAL';
    planSharedAt?: Date | null;
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
    ...serializeShareFields(note),
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

function serializeSharedNote(
  note: {
    _id: Types.ObjectId;
    appointmentId: Types.ObjectId;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan: string;
    status: 'DRAFT' | 'FINAL';
    planSharedAt?: Date | null;
    planSharedWithPatientAt?: Date | null;
    planSharedWithHealthAssistantAt?: Date | null;
    sharedSoapFieldsPatient?: string[];
    sharedSoapFieldsHealthAssistant?: string[];
    createdAt: Date;
    updatedAt: Date;
  },
  role?: UserRole,
  appointment?: ReturnType<typeof serializeAppointment>
) {
  const allowed = soapFieldsForRole(note, role);
  const soapNote: Record<string, string> = {};
  for (const field of allowed) {
    soapNote[field] = note[field] || '';
  }
  return {
    id: note._id.toString(),
    appointmentId: note.appointmentId.toString(),
    status: note.status,
    ...serializeShareFields(note),
    sharedSoapFields: allowed,
    soapNote,
    ...soapNote,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    ...(appointment ? { appointment } : {}),
  };
}

function isDoctorRole(role?: UserRole) {
  return role === 'doctor';
}

export async function getNoteByAppointment(
  appointmentId: string,
  role?: UserRole
) {
  if (!Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('Appointment not found', 404);
  }
  const note = await ConsultationNote.findOne({
    appointmentId: new Types.ObjectId(appointmentId),
  });
  if (!note) {
    return null;
  }
  if (role === 'patient') {
    if (!isSharedWithPatient(note)) return null;
    return serializeSharedNote(note, role);
  }
  if (role === 'healthAssistant') {
    if (!isSharedWithHealthAssistant(note)) return null;
    return serializeSharedNote(note, role);
  }
  if (!isDoctorRole(role)) {
    return null;
  }
  return serializeNote(note);
}

export async function listPatientNotes(
  patientId: string,
  query: { page?: number; limit?: number; search?: string },
  role?: UserRole
) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (Types.ObjectId.isValid(patientId)) {
    filter.patientId = new Types.ObjectId(patientId);
  } else {
    throw new AppError('Patient not found', 404);
  }

  const shareFilter =
    role === 'healthAssistant'
      ? {
          $or: [
            { planSharedWithHealthAssistantAt: { $ne: null } },
            {
              planSharedAt: { $ne: null },
              planSharedWithPatientAt: null,
              planSharedWithHealthAssistantAt: null,
            },
          ],
        }
      : !isDoctorRole(role)
        ? {
            $or: [
              { planSharedWithPatientAt: { $ne: null } },
              {
                planSharedAt: { $ne: null },
                planSharedWithPatientAt: null,
                planSharedWithHealthAssistantAt: null,
              },
            ],
          }
        : null;

  const searchFilter = query.search?.trim()
    ? {
        $or: [
          { subjective: { $regex: query.search.trim(), $options: 'i' } },
          { objective: { $regex: query.search.trim(), $options: 'i' } },
          { assessment: { $regex: query.search.trim(), $options: 'i' } },
          { plan: { $regex: query.search.trim(), $options: 'i' } },
        ],
      }
    : null;

  const andFilters = [shareFilter, searchFilter].filter(Boolean);
  if (andFilters.length) {
    filter.$and = andFilters;
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
    docs.map((note) => {
      const appointment = byId.get(note.appointmentId.toString());
      return isDoctorRole(role)
        ? serializeNote(note, appointment)
        : serializeSharedNote(note, role, appointment);
    }),
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

  const existing = await ConsultationNote.findOne({
    appointmentId: appointment._id,
  });
  if (existing?.status === 'FINAL') {
    if (input.action === 'approve') return serializeNote(existing);
    throw new AppError(
      'This note has been saved to file and cannot be edited',
      400
    );
  }

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

  if (note.status === 'FINAL') {
    if (input.action === 'approve') return serializeNote(note);
    throw new AppError(
      'This note has been saved to file and cannot be edited',
      400
    );
  }

  if (typeof input.subjective === 'string') note.subjective = input.subjective;
  if (typeof input.objective === 'string') note.objective = input.objective;
  if (typeof input.assessment === 'string') note.assessment = input.assessment;
  if (typeof input.plan === 'string') note.plan = input.plan;
  if (input.action === 'approve') note.status = 'FINAL';
  if (input.action === 'save') note.status = 'DRAFT';
  await note.save();
  return serializeNote(note);
}

export async function sharePlan(
  appointmentId: string,
  input: {
    recipients?: Array<'patient' | 'healthAssistant'>;
    fields?: SoapField[];
  } = {}
) {
  if (!Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('Appointment not found', 404);
  }
  const note = await ConsultationNote.findOne({
    appointmentId: new Types.ObjectId(appointmentId),
  });
  if (!note) throw new AppError('Note not found', 404);

  const fields = (input.fields?.length ? input.fields : ['plan']).filter(
    (field): field is SoapField =>
      SOAP_FIELDS.includes(field as SoapField)
  );
  if (!fields.length) {
    throw new AppError('Choose at least one SOAP section to share', 400);
  }

  const hasContent = fields.some((field) =>
    String(note[field] || '')
      .replace(/<[^>]*>/g, ' ')
      .trim()
  );
  if (!hasContent) {
    throw new AppError('Add notes to the selected SOAP sections before sending', 400);
  }

  const recipients = input.recipients?.length
    ? input.recipients
    : (['patient', 'healthAssistant'] as const);

  const now = new Date();
  if (recipients.includes('patient')) {
    note.planSharedWithPatientAt = now;
    note.sharedSoapFieldsPatient = mergeSoapFields(
      note.sharedSoapFieldsPatient,
      fields
    );
  }
  if (recipients.includes('healthAssistant')) {
    note.planSharedWithHealthAssistantAt = now;
    note.sharedSoapFieldsHealthAssistant = mergeSoapFields(
      note.sharedSoapFieldsHealthAssistant,
      fields
    );
  }
  note.planSharedAt = now;
  await note.save();
  return serializeNote(note);
}

export async function completeConsultation(appointmentId: string) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId')
    .populate('patientId');
  if (!appointment) throw new AppError('Appointment not found', 404);
  if (appointment.status === 'CANCELLED' || appointment.status === 'MISSED') {
    throw new AppError(
      `Cannot complete a ${appointment.status.toLowerCase()} appointment`,
      400
    );
  }
  if (appointment.status !== 'COMPLETED') {
    appointment.status = 'COMPLETED';
    if (!appointment.endTime) appointment.endTime = new Date();
    await appointment.save();
  }
  return serializeAppointment(appointment);
}
