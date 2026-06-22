import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

// Cloudflare R2, S3 uyumlu. region 'auto', path-style zorunlu.
export function createR2Client(config: ConfigService): S3Client {
  const endpoint = config.get<string>('R2_ENDPOINT');
  const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') as string;
  const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') as string;
  // Prod fail-fast (L12): eksik R2 yapılandırması sessizce AWS'e düşmesin.
  if (
    config.get<string>('NODE_ENV') === 'production' &&
    (!endpoint || !accessKeyId || !secretAccessKey)
  ) {
    throw new Error(
      'Production R2 yapılandırması eksik (R2_ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY zorunlu)',
    );
  }
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export const R2_CLIENT = 'R2_CLIENT';
