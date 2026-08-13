import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { Doctor } from '../../models';
import { AppError } from '../../utils/errors';
import { toStaffUser } from '../auth/staff-auth.service';

const router = Router();

router.get(
  '/profile',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const doctor = await Doctor.findById(req.auth!.id);
    if (!doctor || !doctor.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    res.json(toStaffUser(doctor));
  })
);

export default router;
