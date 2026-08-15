import { Types } from 'mongoose';
import { Appointment, ConsultationNote, Patient, Vital } from '../../models';
import { AppError } from '../../utils/errors';
import { chatCompletion } from './openrouter.client';

const MAX_NOTES = 15;
const SECTION_MAX = 500;

const PATIENT_SYSTEM = `You are a clinical documentation assistant for Carelio telehealth.
Summarize a patient's SOAP notes across visits for a doctor.

Rules:
- Use only the facts in the notes. Do not diagnose, prescribe, or invent details.
- Do not use markdown (no **, *, #, or code fences).
- Do not write a preamble like "AI-assisted draft" or "Based on the provided data".
- Keep it short.

Output exactly these section headings, each followed by short dash bullets:
Themes
Findings
Open plans
Flags`;

const VISIT_SYSTEM = `You are a clinical documentation assistant for Carelio telehealth.
Summarize a single consultation from SOAP notes and confirmed vitals for the treating doctor.

Rules:
- Use only the facts provided. Do not diagnose, prescribe, or invent details.
- Do not use markdown (no **, *, #, or code fences).
- Do not write a preamble like "AI-assisted draft", "Based on the provided consultation data", or "here is the summary".
- Keep it short and clinical.

Output exactly these section headings, each followed by short dash bullets:
Documented
Vitals
Follow-up`;

function truncate(text: string, max = SECTION_MAX) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function hasSoapContent(note: {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}) {
  return Boolean(
    note.subjective?.trim() ||
      note.objective?.trim() ||
      note.assessment?.trim() ||
      note.plan?.trim()
  );
}

function formatNoteBlock(
  note: {
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    status?: string;
    updatedAt?: Date;
    createdAt?: Date;
  },
  index: number
) {
  const when = (note.updatedAt || note.createdAt)?.toISOString?.() ?? 'unknown';
  return [
    `Visit note #${index + 1} (${note.status || 'DRAFT'}, ${when})`,
    note.subjective?.trim()
      ? `S: ${truncate(note.subjective)}`
      : null,
    note.objective?.trim() ? `O: ${truncate(note.objective)}` : null,
    note.assessment?.trim()
      ? `A: ${truncate(note.assessment)}`
      : null,
    note.plan?.trim() ? `P: ${truncate(note.plan)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatVital(vital: {
  vitalType: string;
  reading: Record<string, unknown>;
  recordedAt: Date;
}) {
  return `- ${vital.vitalType} @ ${vital.recordedAt.toISOString()}: ${JSON.stringify(
    vital.reading
  )}`;
}

export type PatientAiSummary = {
  summary: string;
  noteCount: number;
  generatedAt: string;
  generatedByDoctorId: string | null;
  cached: boolean;
};

export type VisitAiSummary = {
  summary: string;
  generatedAt: string;
  generatedByDoctorId: string | null;
  cached: boolean;
};

function serializeStoredPatientSummary(
  stored: {
    text: string;
    generatedAt: Date;
    noteCount: number;
    generatedByDoctorId?: Types.ObjectId | null;
  },
  cached: boolean
): PatientAiSummary {
  return {
    summary: stored.text,
    noteCount: stored.noteCount,
    generatedAt: stored.generatedAt.toISOString(),
    generatedByDoctorId: stored.generatedByDoctorId
      ? stored.generatedByDoctorId.toString()
      : null,
    cached,
  };
}

function serializeStoredVisitSummary(
  stored: {
    text: string;
    generatedAt: Date;
    generatedByDoctorId?: Types.ObjectId | null;
  },
  cached: boolean
): VisitAiSummary {
  return {
    summary: stored.text,
    generatedAt: stored.generatedAt.toISOString(),
    generatedByDoctorId: stored.generatedByDoctorId
      ? stored.generatedByDoctorId.toString()
      : null,
    cached,
  };
}

export async function getPatientAiSummary(
  patientId: string
): Promise<PatientAiSummary | null> {
  if (!Types.ObjectId.isValid(patientId)) {
    throw new AppError('Patient not found', 404);
  }

  const patient = await Patient.findById(patientId).select('aiClinicalSummary');
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  const stored = patient.aiClinicalSummary;
  if (!stored?.text?.trim() || !stored.generatedAt) {
    return null;
  }

  return serializeStoredPatientSummary(stored, true);
}

export async function summarizePatientNotes(
  patientId: string,
  options?: { regenerate?: boolean; doctorId?: string }
): Promise<PatientAiSummary> {
  if (!Types.ObjectId.isValid(patientId)) {
    throw new AppError('Patient not found', 404);
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  const regenerate = Boolean(options?.regenerate);
  const stored = patient.aiClinicalSummary;
  if (!regenerate && stored?.text?.trim() && stored.generatedAt) {
    return serializeStoredPatientSummary(stored, true);
  }

  const docs = await ConsultationNote.find({
    patientId: patient._id,
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_NOTES);

  const withContent = docs.filter(hasSoapContent);
  if (withContent.length === 0) {
    throw new AppError('No SOAP notes to summarize', 400, {
      code: 'NO_NOTES',
    });
  }

  const payload = withContent
    .map((note, index) => formatNoteBlock(note, index))
    .join('\n\n');

  const summary = await chatCompletion(
    [
      { role: 'system', content: PATIENT_SYSTEM },
      {
        role: 'user',
        content: `Summarize these patient SOAP notes for the clinician:\n\n${payload}`,
      },
    ],
    { maxTokens: 900, timeoutMs: 25_000, temperature: 0.2 }
  );

  if (!summary) {
    throw new AppError('AI summary unavailable', 503, {
      code: 'AI_UNAVAILABLE',
    });
  }

  const generatedAt = new Date();
  const doctorObjectId =
    options?.doctorId && Types.ObjectId.isValid(options.doctorId)
      ? new Types.ObjectId(options.doctorId)
      : null;

  patient.aiClinicalSummary = {
    text: summary,
    generatedAt,
    noteCount: withContent.length,
    generatedByDoctorId: doctorObjectId,
  };
  await patient.save();

  return {
    summary,
    noteCount: withContent.length,
    generatedAt: generatedAt.toISOString(),
    generatedByDoctorId: doctorObjectId ? doctorObjectId.toString() : null,
    cached: false,
  };
}

export async function getVisitAiSummary(
  appointmentId: string
): Promise<VisitAiSummary | null> {
  if (!Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('Appointment not found', 404);
  }

  const appointment = await Appointment.findById(appointmentId).select(
    'aiVisitSummary'
  );
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  const stored = appointment.aiVisitSummary;
  if (!stored?.text?.trim() || !stored.generatedAt) {
    return null;
  }

  return serializeStoredVisitSummary(stored, true);
}

export async function summarizeVisit(
  appointmentId: string,
  options?: { regenerate?: boolean; doctorId?: string }
): Promise<VisitAiSummary> {
  if (!Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('Appointment not found', 404);
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  const regenerate = Boolean(options?.regenerate);
  const stored = appointment.aiVisitSummary;
  if (!regenerate && stored?.text?.trim() && stored.generatedAt) {
    return serializeStoredVisitSummary(stored, true);
  }

  const [note, vitals] = await Promise.all([
    ConsultationNote.findOne({
      appointmentId: appointment._id,
    }),
    Vital.find({
      appointmentId: appointment._id,
      status: 'confirmed',
    }).sort({ recordedAt: -1 }),
  ]);

  const soapOk = note ? hasSoapContent(note) : false;
  if (!soapOk && vitals.length === 0) {
    throw new AppError('No SOAP notes or confirmed vitals to summarize', 400, {
      code: 'NO_CONTENT',
    });
  }

  const parts: string[] = [];
  if (note && soapOk) {
    parts.push(formatNoteBlock(note, 0));
  }
  if (vitals.length) {
    parts.push(
      'Confirmed vitals:\n' + vitals.map((v) => formatVital(v)).join('\n')
    );
  }

  const summary = await chatCompletion(
    [
      { role: 'system', content: VISIT_SYSTEM },
      {
        role: 'user',
        content: `Summarize this consultation for the clinician:\n\n${parts.join(
          '\n\n'
        )}`,
      },
    ],
    { maxTokens: 700, timeoutMs: 25_000, temperature: 0.2 }
  );

  if (!summary) {
    throw new AppError('AI summary unavailable', 503, {
      code: 'AI_UNAVAILABLE',
    });
  }

  const generatedAt = new Date();
  const doctorObjectId =
    options?.doctorId && Types.ObjectId.isValid(options.doctorId)
      ? new Types.ObjectId(options.doctorId)
      : null;

  appointment.aiVisitSummary = {
    text: summary,
    generatedAt,
    generatedByDoctorId: doctorObjectId,
  };
  await appointment.save();

  return {
    summary,
    generatedAt: generatedAt.toISOString(),
    generatedByDoctorId: doctorObjectId ? doctorObjectId.toString() : null,
    cached: false,
  };
}
