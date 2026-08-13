import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { Appointment, Patient } from '../../models';
import { Types } from 'mongoose';

const router = Router();

router.get(
  '/',
  requireAuth('doctor', 'healthAssistant'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const doctorFilter =
      req.auth!.role === 'doctor'
        ? { doctorId: new Types.ObjectId(req.auth!.id) }
        : {};

    const [
      totalPatients,
      activeAppointments,
      completedConsultations,
      pendingInvitations,
      todayAppointments,
      cancelledThisMonth,
    ] = await Promise.all([
      Patient.countDocuments({ isActive: true }),
      Appointment.countDocuments({
        ...doctorFilter,
        status: { $in: ['CONFIRMED', 'PENDING_CONFIRMATION'] },
      }),
      Appointment.countDocuments({
        ...doctorFilter,
        status: 'COMPLETED',
      }),
      Patient.countDocuments({
        isActive: true,
        isRegistrationComplete: false,
      }),
      Appointment.countDocuments({
        ...doctorFilter,
        startTime: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['CANCELLED'] },
      }),
      Appointment.countDocuments({
        ...doctorFilter,
        status: 'CANCELLED',
        updatedAt: { $gte: startOfMonth },
      }),
    ]);

    res.json({
      totalPatients,
      activeAppointments,
      completedConsultations,
      pendingInvitations,
      todayAppointments,
      cancelledThisMonth,
    });
  })
);

export default router;
