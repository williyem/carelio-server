import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

let configured = false;

export function getCloudinary() {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new AppError('Cloudinary is not configured', 500);
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    configured = true;
  }

  return cloudinary;
}

export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    filename?: string;
    mimeType?: string;
  } = {}
): Promise<{ url: string; publicId: string; resourceType: string }> {
  const client = getCloudinary();
  const isPdf =
    options.mimeType === 'application/pdf' ||
    options.filename?.toLowerCase().endsWith('.pdf');

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: options.folder || 'carelio',
        resource_type: isPdf ? 'raw' : 'auto',
        public_id: options.filename
          ? options.filename.replace(/\.[^.]+$/, '')
          : undefined,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new AppError('Cloudinary upload failed', 500));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
        });
      }
    );
    stream.end(buffer);
  });
}
