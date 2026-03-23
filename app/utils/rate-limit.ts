// app/utils/rate-limit.ts

const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(key);

    // Sistema de Limpeza Automática (Garbage Collection para não estourar a memória)
    if (rateLimitMap.size > 2000) {
        rateLimitMap.forEach((value, mapKey) => {
            if (value.expiresAt < now) rateLimitMap.delete(mapKey);
        });
    }

    if (!record || record.expiresAt < now) {
        // Primeira tentativa ou janela expirada: Cria novo registo
        rateLimitMap.set(key, { count: 1, expiresAt: now + windowMs });
        return true; 
    }

    if (record.count >= limit) {
        // Estourou o limite! Bloqueado.
        return false; 
    }

    // Ainda dentro do limite: Aumenta a contagem
    record.count += 1;
    return true; 
}