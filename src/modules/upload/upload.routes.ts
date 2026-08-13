import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { asyncHandler } from '../../utils/async-handler';
import { AppError } from '../../utils/errors';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
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

    const url = `http://localhost:4000/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url,
      message: 'File uploaded successfully',
    });
  })
);

export default router;
