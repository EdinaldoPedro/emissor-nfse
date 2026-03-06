import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Total de clientes cadastrados no SaaS inteiro
        const totalClientes = await prisma.cliente.count();

        // 2. Total de NFS-e emitidas (Status AUTORIZADA) na plataforma toda
        const totalNotas = await prisma.notaFiscal.count({
            where: { status: 'AUTORIZADA' }
        });

        // 3. Municípios atingidos (Resolvido no JS para não quebrar o banco SQLite)
        const clientes = await prisma.cliente.findMany({
            select: { cidade: true }
        });
        const municipiosUnicos = new Set(clientes.map(c => c.cidade).filter(Boolean));
        const municipios = municipiosUnicos.size;

        // 4. Valor Total do Mês Atual de todas as notas do SaaS
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        const notasMes = await prisma.notaFiscal.aggregate({
            where: {
                createdAt: { gte: primeiroDiaMes }, 
                status: 'AUTORIZADA' 
            },
            _sum: { valor: true }
        });

        return NextResponse.json({
            totalNotas,
            totalClientes,
            municipios,
            valorMes: Number(notasMes._sum.valor) || 0
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas globais:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}