import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { HealthAssistant } from '../../models';

const router = Router();

router.get(
  '/',
  requireAuth('doctor', 'healthAssistant'),
  asyncHandler(async (_req, res) => {
    const assistants = await HealthAssistant.find({ isActive: true })
      .sort({ firstName: 1, lastName: 1 })
      .select('firstName lastName email avatarUrl');

    res.json(
      assistants.map((a) => ({
        id: a._id.toString(),
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        avatarUrl: a.avatarUrl || '',
      }))
    );
  })
);

export default router;
