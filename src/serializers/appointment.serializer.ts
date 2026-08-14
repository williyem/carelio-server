import type { IAppointment } from '../models/Appointment';
import type { IDoctor } from '../models/Doctor';
import type { IPatient } from '../models/Patient';

function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

function isDoctor(value: unknown): value is IDoctor {
  return !!value && typeof value === 'object' && 'email' in value && 'firstName' in value;
}

function isPatient(value: unknown): value is IPatient {
  return !!value && typeof value === 'object' && 'patientId' in value;
}

export function serializeAppointmentDoctor(doctor: IDoctor) {
  return {
    id: doctor._id.toString(),
    email: doctor.email,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    phoneNumber: doctor.phoneNumber,
    twoFactorEnabled: doctor.twoFactorEnabled,
    twoFactorSecret: doctor.totpSecret ?? null,
    isActive: doctor.isActive,
  };
}

export function serializeAppointmentPatient(patient: IPatient) {
  return {
    id: patient._id.toString(),
    patientId: patient.patientId,
    fullName: patient.fullName ?? '',
    email: patient.email ?? '',
    phoneNumber: patient.phoneNumber ?? '',
    dob: patient.dob ? patient.dob.toISOString().slice(0, 10) : undefined,
    gender: patient.gender ?? undefined,
    isRegistrationComplete: patient.isRegistrationComplete,
  };
}

export function serializeAppointment(appointment: IAppointment) {
  const doctorRef = appointment.doctorId;
  const patientRef = appointment.patientId;

  const doctor = isDoctor(doctorRef)
    ? serializeAppointmentDoctor(doctorRef)
    : {
        id: doctorRef.toString(),
        email: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        isActive: true,
      };

  const patient = isPatient(patientRef)
    ? serializeAppointmentPatient(patientRef)
    : undefined;

  const startTime = iso(appointment.startTime);
  const telehealth = appointment.telehealth
    ? {
        id: appointment._id.toString(),
        doctorId: isDoctor(doctorRef) ? doctorRef._id.toString() : doctorRef.toString(),
        appointmentId: appointment._id.toString(),
        patientId: isPatient(patientRef)
          ? patientRef._id.toString()
          : patientRef.toString(),
        doctorToken: appointment.telehealth.doctorToken ?? '',
        patientToken: appointment.telehealth.patientToken ?? '',
        zoomSessionId: appointment.telehealth.sessionId ?? null,
        createdAt: iso(appointment.createdAt)!,
        updatedAt: iso(appointment.updatedAt)!,
      }
    : undefined;

  return {
    id: appointment._id.toString(),
    patientId: isPatient(patientRef)
      ? patientRef._id.toString()
      : patientRef.toString(),
    doctorId: isDoctor(doctorRef)
      ? doctorRef._id.toString()
      : doctorRef.toString(),
    bookedByAssistantId: appointment.bookedByAssistantId
      ? appointment.bookedByAssistantId.toString()
      : null,
    date: startTime ? startTime.slice(0, 10) : undefined,
    startTime,
    endTime: iso(appointment.endTime),
    isImmediate: appointment.isImmediate,
    status: appointment.status,
    code: appointment.code,
    cancellationReason: appointment.cancellationReason ?? null,
    reschedulingReason: appointment.reschedulingReason ?? null,
    cancelledBy: appointment.cancelledBy
      ? appointment.cancelledBy.toString()
      : null,
    cancelledByUserType: appointment.cancelledByUserType ?? null,
    createdAt: iso(appointment.createdAt)!,
    updatedAt: iso(appointment.updatedAt)!,
    doctor,
    ...(patient ? { patient } : {}),
    ...(telehealth ? { telehealth } : {}),
  };
}
