import { Types } from 'mongoose';
import { AccessGrant, Doctor, HealthAssistant } from '../../models';
import { AppError } from '../../utils/errors';

export async function listGrants(patientId: string) {
  const grants = await AccessGrant.find({
    patientId: new Types.ObjectId(patientId),
  }).sort({ createdAt: -1 });

  const people = await Promise.all(
    grants.map(async (grant) => {
      const role = grant.granteeRole;
      const person =
        role === 'doctor'
          ? await Doctor.findById(grant.granteeId)
          : await HealthAssistant.findById(grant.granteeId);
      return {
        id: grant.granteeId.toString(),
        grantId: grant._id.toString(),
        name: person
          ? `${person.firstName} ${person.lastName}`.trim()
          : 'Unknown',
        email: person?.email || '',
        role,
        granted: true,
      };
    })
  );

  return {
    people,
    grantedIds: people.map((p) => p.id),
  };
}

export async function grantAccess(
  patientId: string,
  granteeId: string,
  granteeRole: 'doctor' | 'health-assistant'
) {
  if (!Types.ObjectId.isValid(granteeId)) {
    throw new AppError('Invalid grantee', 400);
  }

  const person =
    granteeRole === 'doctor'
      ? await Doctor.findById(granteeId)
      : await HealthAssistant.findById(granteeId);
  if (!person) throw new AppError('Clinician not found', 404);

  const grant = await AccessGrant.findOneAndUpdate(
    {
      patientId: new Types.ObjectId(patientId),
      granteeId: new Types.ObjectId(granteeId),
    },
    {
      patientId: new Types.ObjectId(patientId),
      granteeId: new Types.ObjectId(granteeId),
      granteeRole,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return {
    id: grant!.granteeId.toString(),
    grantId: grant!._id.toString(),
    name: `${person.firstName} ${person.lastName}`.trim(),
    email: person.email,
    role: granteeRole,
    granted: true,
  };
}

export async function revokeAccess(patientId: string, granteeId: string) {
  const result = await AccessGrant.findOneAndDelete({
    patientId: new Types.ObjectId(patientId),
    granteeId: new Types.ObjectId(granteeId),
  });
  if (!result) throw new AppError('Grant not found', 404);
  return { success: true };
}
