import { Schema, model, Document, Types } from 'mongoose';

export type NoteStatus = 'DRAFT' | 'FINAL';

export interface IConsultationNote extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: NoteStatus;
  planSharedAt?: Date | null;
  planSharedWithPatientAt?: Date | null;
  planSharedWithHealthAssistantAt?: Date | null;
  sharedSoapFieldsPatient?: string[];
  sharedSoapFieldsHealthAssistant?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const consultationNoteSchema = new Schema<IConsultationNote>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
    status: { type: String, enum: ['DRAFT', 'FINAL'], default: 'DRAFT' },
    planSharedAt: { type: Date, default: null },
    planSharedWithPatientAt: { type: Date, default: null },
    planSharedWithHealthAssistantAt: { type: Date, default: null },
    sharedSoapFieldsPatient: { type: [String], default: [] },
    sharedSoapFieldsHealthAssistant: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const ConsultationNote = model<IConsultationNote>(
  'ConsultationNote',
  consultationNoteSchema
);
