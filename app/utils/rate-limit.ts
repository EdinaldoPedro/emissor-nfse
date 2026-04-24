import crypto from 'crypto';
import { prisma } from '@/app/utils/prisma';

function hashKey(key: string) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const keyHash = hashKey(key);
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    const total = await prisma.systemLog.count({
        where: {
            action: 'RATE_LIMIT_CHECK',
            message: keyHash,
            createdAt: { gte: windowStart }
        }
    });

    if (total >= limit) {
        return false;
    }

    await prisma.systemLog.create({
        data: {
            level: 'DEBUG',
            action: 'RATE_LIMIT_CHECK',
            message: keyHash,
            details: JSON.stringify({ windowMs })
        }
    });

    return true;
}
