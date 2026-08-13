import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/async-handler';
import { AppError } from '../../utils/errors';
import { uploadBufferToCloudinary } from '../../lib/cloudinary';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('file is required', 400);
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'carelio',
      filename: `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      mimeType: req.file.mimetype,
    });

    res.json({
      success: true,
      url: result.url,
      message: 'File uploaded successfully',
    });
  })
);

export default router;
