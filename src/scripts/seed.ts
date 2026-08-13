import { connectDb } from '../db/connect';
import { Doctor, HealthAssistant, Patient, Appointment } from '../models';
import { hashPassword } from '../utils/passwords';
import { generateAppointmentCode } from '../utils/ids';

async function seed() {
  await connectDb();

  const doctorEmail = 'dr.smith@carelio.app';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  const doctor = await Doctor.findOneAndUpdate(
    { email: doctorEmail },
    {
      email: doctorEmail,
      passwordHash,
      firstName: 'Ada',
      lastName: 'Smith',
      phoneNumber: '+233200000001',
      twoFactorEnabled: false,
      isActive: true,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const ha = await HealthAssistant.findOneAndUpdate(
    { email: 'ha.jones@carelio.app' },
    {
      email: 'ha.jones@carelio.app',
      passwordHash,
      firstName: 'Sam',
      lastName: 'Jones',
      phoneNumber: '+233200000002',
      staffCode: 'HA-1001',
      twoFactorEnabled: false,
      isActive: true,
      mustResetPassword: false,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  // Ensure staffCode on existing docs missing it
  if (!ha.staffCode) {
    ha.staffCode = 'HA-1001';
    await ha.save();
  }

  const patientsData = [
    {
      patientId: 'PAT-1001',
      email: 'patient.demo@carelio.app',
      phoneNumber: '+233200000003',
      fullName: 'Demo Patient',
      dob: new Date('1990-01-15'),
      gender: 'female' as const,
      address: 'Accra, Ghana',
      bloodType: 'O+' as const,
      allergies: ['Penicillin'],
      chiefComplaint: 'Recurring headaches',
      assignedAssistantId: ha._id,
      isRegistrationComplete: true,
      phoneVerified: true,
      emailVerified: true,
    },
    {
      patientId: 'PAT-1002',
      email: 'john.doe@example.com',
      phoneNumber: '+233201234567',
      fullName: 'John Doe',
      dob: new Date('1988-03-15'),
      gender: 'male' as const,
      address: '12 Independence Ave, Accra',
      bloodType: 'A+' as const,
      allergies: [],
      chiefComplaint: 'Fatigue',
      assignedAssistantId: ha._id,
      isRegistrationComplete: true,
      phoneVerified: true,
      emailVerified: true,
    },
    {
      patientId: 'PAT-1003',
      email: 'sarah.j@example.com',
      phoneNumber: '+233209876543',
      fullName: 'Sarah Johnson',
      dob: new Date('1992-07-22'),
      gender: 'female' as const,
      address: '45 Ring Road, Kumasi',
      bloodType: 'B+' as const,
      allergies: ['Latex'],
      chiefComplaint: 'Anxiety',
      assignedAssistantId: null,
      isRegistrationComplete: true,
      phoneVerified: true,
      emailVerified: false,
    },
    {
      patientId: 'PAT-1004',
      email: 'pending.invite@example.com',
      phoneNumber: '+233200000099',
      fullName: null,
      dob: null,
      gender: null,
      address: null,
      bloodType: null,
      allergies: [],
      chiefComplaint: null,
      assignedAssistantId: null,
      isRegistrationComplete: false,
      phoneVerified: false,
      emailVerified: false,
    },
  ];

  const patients = [];
  for (const data of patientsData) {
    const p = await Patient.findOneAndUpdate(
      { patientId: data.patientId },
      {
        ...data,
        invitedByDoctorId: doctor._id,
        isActive: true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    patients.push(p);
  }

  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const appointmentsSeed = [
    {
      key: 'seed-apt-1',
      patientId: patients[0]!._id,
      startTime: inTwoHours,
      endTime: inThreeHours,
      status: 'CONFIRMED' as const,
      isImmediate: false,
    },
    {
      key: 'seed-apt-2',
      patientId: patients[1]!._id,
      startTime: yesterday,
      endTime: new Date(yesterday.getTime() + 30 * 60 * 1000),
      status: 'COMPLETED' as const,
      isImmediate: false,
    },
    {
      key: 'seed-apt-3',
      patientId: patients[2]!._id,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 45 * 60 * 1000),
      status: 'PENDING_CONFIRMATION' as const,
      isImmediate: false,
    },
  ];

  for (const a of appointmentsSeed) {
    const existing = await Appointment.findOne({
      doctorId: doctor._id,
      patientId: a.patientId,
      status: a.status,
    });
    if (existing) continue;

    await Appointment.create({
      patientId: a.patientId,
      doctorId: doctor._id,
      startTime: a.startTime,
      endTime: a.endTime,
      isImmediate: a.isImmediate,
      status: a.status,
      code: generateAppointmentCode(),
      telehealth: {
        doctorToken: null,
        patientToken: null,
        sessionId: null,
      },
    });
  }

  console.log('Seed complete:');
  console.log(`  Doctor: ${doctor.email} / ${password}`);
  console.log(`  Health Assistant: ${ha.email} / ${password} (${ha.staffCode})`);
  console.log(`  Patients: ${patients.map((p) => p.patientId).join(', ')}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
