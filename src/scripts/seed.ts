import { connectDb } from '../db/connect';
import { Doctor, HealthAssistant, Patient } from '../models';
import { hashPassword } from '../utils/passwords';

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
      twoFactorEnabled: false,
      isActive: true,
      mustResetPassword: false,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const patient = await Patient.findOneAndUpdate(
    { patientId: 'PAT-1001' },
    {
      patientId: 'PAT-1001',
      email: 'patient.demo@carelio.app',
      phoneNumber: '+233200000003',
      fullName: 'Demo Patient',
      dob: new Date('1990-01-15'),
      gender: 'female',
      address: 'Accra, Ghana',
      bloodType: 'O+',
      invitedByDoctorId: doctor._id,
      assignedAssistantId: ha._id,
      isRegistrationComplete: true,
      isActive: true,
      phoneVerified: true,
      emailVerified: true,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  console.log('Seed complete:');
  console.log(`  Doctor: ${doctor.email} / ${password}`);
  console.log(`  Health Assistant: ${ha.email} / ${password}`);
  console.log(`  Patient ID: ${patient.patientId}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
