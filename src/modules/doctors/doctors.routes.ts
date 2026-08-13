import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { Doctor } from '../../models';
import { buildPaginatedResult, parsePagination } from '../../utils/paginate';

const router = Router();

router.get(
  '/',
  requireAuth('doctor', 'healthAssistant'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { isActive: true };

    const [docs, totalDocs] = await Promise.all([
      Doctor.find(filter)
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(limit),
      Doctor.countDocuments(filter),
    ]);

    res.json(
      buildPaginatedResult(
        docs.map((d) => ({
          id: d._id.toString(),
          email: d.email,
          password: '',
          firstName: d.firstName,
          lastName: d.lastName,
          phoneNumber: d.phoneNumber,
          twoFactorEnabled: d.twoFactorEnabled,
          twoFactorSecret: null,
          isActive: d.isActive,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        totalDocs,
        page,
        limit
      )
    );
  })
);

export default router;
