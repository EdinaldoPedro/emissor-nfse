import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LogParams {
  level: 'INFO' | 'ERRO' | 'ALERTA' | 'DEBUG';
  action: string;
  message: string;
  details?: any; 
  empresaId?: string;
  vendaId?: string; 
}

// --- SANITIZAÇÃO DE DADOS SENSÍVEIS ---
const CHAVES_SENSIVEIS = [
    'senha', 'password', 'senhaCertificado', 'certificadoA1', 
    'Authorization', 'token', 'key', 'pfx', 'certificado'
];

function sanitizarObjeto(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') return obj; // Se for string pura, retorna (mas idealmente não logar string com senha)
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizarObjeto(item));
    }

    if (typeof obj === 'object') {
        const novoObj: any = {};
        for (const key in obj) {
            // Verifica se a chave atual é sensível (case insensitive)
            const ehSensivel = CHAVES_SENSIVEIS.some(k => key.toLowerCase().includes(k.toLowerCase()));
            
            if (ehSensivel) {
                novoObj[key] = '*** DADO SENSÍVEL OMITIDO ***';
            } else {
                // Recursão para objetos aninhados (ex: prestador.senhaCertificado)
                novoObj[key] = sanitizarObjeto(obj[key]);
            }
        }
        return novoObj;
    }

    return obj;
}

export async function createLog({ level, action, message, details, empresaId, vendaId }: LogParams) {
  try {
    let detailsStr = '';
    
    // Aplica sanitização antes de converter para string
    const dadosSeguros = sanitizarObjeto(details);

    if (dadosSeguros) {
        if (dadosSeguros instanceof Error) {
            detailsStr = JSON.stringify({ message: dadosSeguros.message, stack: dadosSeguros.stack }, null, 2);
        } else {
            detailsStr = JSON.stringify(dadosSeguros, null, 2);
        }
    }

    await prisma.systemLog.create({
      data: {
        level,
        action,
        message,
        details: detailsStr,
        empresaId,
        vendaId 
      }
    });

    const cor = level === 'ERRO' ? '\x1b[31m' : '\x1b[32m';
    console.log(`${cor}[${level}] ${action}:\x1b[0m ${message}`);

  } catch (e) {
    console.error("FALHA AO GRAVAR LOG:", e);
  }
}