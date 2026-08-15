import { Schema, model, Document, Types } from 'mongoose';

export type AppointmentStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MISSED';

export interface ITelehealthStub {
  doctorToken?: string | null;
  patientToken?: string | null;
  sessionId?: string | null;
}

export interface IMeasurementRequest {
  id: string;
  vitalType: string;
  label: string;
  source: 'ai' | 'rules' | 'manual';
  status:
    | 'suggested'
    | 'requested'
    | 'acknowledged'
    | 'no_device'
    | 'completed'
    | 'cancelled';
  patientResponse?: string | null;
  requestedAt?: Date;
  respondedAt?: Date;
}

export interface IAppointment extends Document {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  bookedByAssistantId?: Types.ObjectId | null;
  startTime?: Date;
  endTime?: Date;
  isImmediate: boolean;
  status: AppointmentStatus;
  code: string;
  cancellationReason?: string | null;
  reschedulingReason?: string | null;
  cancelledBy?: Types.ObjectId | null;
  cancelledByUserType?: 'doctor' | 'patient' | null;
  telehealth?: ITelehealthStub;
  deviceCaptureEnabled?: boolean;
  measurementRequests?: IMeasurementRequest[];
  /** Doctor-only AI visit overview. Not exposed to patients. */
  aiVisitSummary?: {
    text: string;
    generatedAt: Date;
    generatedByDoctorId: Types.ObjectId | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
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
      index: true,
    },
    bookedByAssistantId: {
      type: Schema.Types.ObjectId,
      ref: 'HealthAssistant',
      default: null,
      index: true,
    },
    startTime: { type: Date },
    endTime: { type: Date },
    isImmediate: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        'PENDING_CONFIRMATION',
        'CONFIRMED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'MISSED',
      ],
      default: 'CONFIRMED',
      index: true,
    },
    code: { type: String, required: true, unique: true },
    cancellationReason: { type: String, default: null },
    reschedulingReason: { type: String, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, default: null },
    cancelledByUserType: {
      type: String,
      enum: ['doctor', 'patient', null],
      default: null,
    },
    telehealth: {
      doctorToken: { type: String, default: null },
      patientToken: { type: String, default: null },
      sessionId: { type: String, default: null },
    },
    deviceCaptureEnabled: { type: Boolean, default: true },
    measurementRequests: {
      type: [
        {
          id: { type: String, required: true },
          vitalType: { type: String, required: true },
          label: { type: String, required: true },
          source: {
            type: String,
            enum: ['ai', 'rules', 'manual'],
            required: true,
          },
          status: {
            type: String,
            enum: [
              'suggested',
              'requested',
              'acknowledged',
              'no_device',
              'completed',
              'cancelled',
            ],
            required: true,
          },
          patientResponse: { type: String, default: null },
          requestedAt: { type: Date },
          respondedAt: { type: Date },
        },
      ],
      default: [],
    },
    aiVisitSummary: {
      type: {
        text: { type: String, required: true },
        generatedAt: { type: Date, required: true },
        generatedByDoctorId: {
          type: Schema.Types.ObjectId,
          ref: 'Doctor',
          default: null,
        },
      },
      default: null,
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ startTime: 1 });
appointmentSchema.index({ doctorId: 1, startTime: 1 });
appointmentSchema.index({ bookedByAssistantId: 1, startTime: 1 });

export const Appointment = model<IAppointment>('Appointment', appointmentSchema);
