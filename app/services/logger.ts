import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LogParams {
  level: 'INFO' | 'ERRO' | 'ALERTA' | 'DEBUG';
  action: string;
  message: string;
  details?: any; // Pode ser objeto, string, erro...
  empresaId?: string;
}

export async function createLog({ level, action, message, details, empresaId }: LogParams) {
  try {
    // Converte objetos/erros para string bonita (JSON)
    let detailsStr = '';
    if (details) {
        if (details instanceof Error) {
            detailsStr = JSON.stringify({ message: details.message, stack: details.stack }, null, 2);
        } else {
            detailsStr = JSON.stringify(details, null, 2);
        }
    }

    await prisma.systemLog.create({
      data: {
        level,
        action,
        message,
        details: detailsStr,
        empresaId
      }
    });

    // Também joga no console para desenvolvimento
    const cor = level === 'ERRO' ? '\x1b[31m' : '\x1b[32m';
    console.log(`${cor}[${level}] ${action}:\x1b[0m ${message}`);

  } catch (e) {
    console.error("FALHA AO GRAVAR LOG:", e);
  }
}