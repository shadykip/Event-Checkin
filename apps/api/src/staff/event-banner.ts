import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const maxEventBannerBytes = 5 * 1024 * 1024;

export async function prepareEventBanner(
  file?: Express.Multer.File,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (!file) return undefined;

  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 24_000_000,
      failOn: 'error',
    });

    const metadata = await image.metadata();

    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) {
      throw new Error('Unsupported image format');
    }

    const output = await image
      .rotate()
      .resize({
        width: 1440,
        height: 720,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    return Uint8Array.from(output);
  } catch {
    throw new BadRequestException(
      'Choose a readable JPEG, PNG, or WebP image under 5 MiB and 24 megapixels.',
    );
  }
}
