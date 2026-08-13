import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { getMailStatus, sendTestEmail } from '../mail/resend';

const testEmailSchema = z.object({
  to: z.string().email(),
});

const devRouter = Router();

devRouter.get(
  '/mail-status',
  asyncHandler(async (_req, res) => {
    res.json(getMailStatus());
  })
);

devRouter.post(
  '/test-email',
  asyncHandler(async (req, res) => {
    const { to } = testEmailSchema.parse(req.body);
    const result = await sendTestEmail(to);

    res.json({
      message: result.skipped
        ? 'No RESEND_API_KEY — logged to server console instead of sending'
        : 'Test email sent',
      to,
      ...result,
    });
  })
);

export default devRouter;
