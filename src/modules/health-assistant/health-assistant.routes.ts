import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { HealthAssistant } from '../../models';
import { AppError } from '../../utils/errors';
import { toStaffUser } from '../auth/staff-auth.service';

const router = Router();

router.get(
  '/profile',
  requireAuth('healthAssistant'),
  asyncHandler(async (req, res) => {
    const ha = await HealthAssistant.findById(req.auth!.id);
    if (!ha || !ha.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    res.json({
      ...toStaffUser(ha),
      staffCode: ha.staffCode,
    });
  })
);

export default router;
