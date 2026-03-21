import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client'; 

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // AGORA RECEBEMOS OS PACOTES QUE ESTÃO NO CARRINHO TAMBÉM
        const { codigo, planoId, pacotesIds } = body; 

        if (!codigo) {
            return NextResponse.json({ error: 'Código não informado.' }, { status: 400 });
        }

        const cupom = await prisma.cupom.findUnique({
            where: { codigo: codigo.toUpperCase().trim() }
        });

        if (!cupom) return NextResponse.json({ error: 'Cupom inválido ou inexistente.' }, { status: 404 });
        if (!cupom.ativo) return NextResponse.json({ error: 'Este cupom foi desativado.' }, { status: 400 });

        if (cupom.validade && new Date(cupom.validade) < new Date()) {
            return NextResponse.json({ error: 'Este cupom já expirou.' }, { status: 400 });
        }

        if (cupom.limiteUsos && cupom.vezesUsado >= cupom.limiteUsos) {
            return NextResponse.json({ error: 'Este cupom está esgotado.' }, { status: 400 });
        }

        // --- AQUI ESTÁ A CORREÇÃO DA ABRANGÊNCIA ---
        if (cupom.planosValidos && cupom.planosValidos.length > 0) {
            const planosPermitidos = cupom.planosValidos.split(',');
            
            let temItemValido = false;
            // O plano principal está na lista do cupom?
            if (planoId && planosPermitidos.includes(planoId)) temItemValido = true;
            
            // Algum dos pacotes do carrinho está na lista do cupom?
            if (pacotesIds && Array.isArray(pacotesIds) && pacotesIds.some(id => planosPermitidos.includes(id))) {
                temItemValido = true;
            }

            if (!temItemValido) {
                return NextResponse.json({ error: 'Cupom não aplicável aos itens selecionados.' }, { status: 400 });
            }
        }

        return NextResponse.json({
            id: cupom.id,
            codigo: cupom.codigo,
            tipoDesconto: cupom.tipoDesconto,
            valorDesconto: Number(cupom.valorDesconto),
            aplicarEm: cupom.aplicarEm,
            maxCiclos: cupom.maxCiclos,
            planosValidos: cupom.planosValidos // MANDAMOS A LISTA DE VOLTA PARA O FRONTEND CALCULAR
        });

    } catch (error) {
        console.error("Erro ao validar cupom:", error);
        return NextResponse.json({ error: 'Erro interno ao validar o cupom.' }, { status: 500 });
    }
}