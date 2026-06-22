import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

// Cloudflare R2, S3 uyumlu. region 'auto', path-style zorunlu.
export function createR2Client(config: ConfigService): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.get<string>('R2_ENDPOINT'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.get<string>('R2_ACCESS_KEY_ID') as string,
      secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') as string,
    },
  });
}

export const R2_CLIENT = 'R2_CLIENT';
