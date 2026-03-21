import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista todos os cupons para o seu Dashboard e Relatórios
export async function GET(request: Request) {
    try {
        // SEGURANÇA TEMPORARIAMENTE DESATIVADA PARA TESTE
        const cupons = await prisma.cupom.findMany({
            orderBy: { createdAt: 'desc' },
            include: { 
                _count: { select: { logs: true } },
                // AQUI ESTÁ A MÁGICA: Trazemos o histórico completo do CRM!
                logs: {
                    include: {
                        user: {
                            select: { nome: true, email: true }
                        },
                        fatura: {
                            select: { id: true, status: true, valorTotal: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        return NextResponse.json(cupons);
    } catch (error) {
        console.error("Erro ao buscar cupons:", error);
        return NextResponse.json({ error: 'Erro ao listar cupons' }, { status: 500 });
    }
}

// POST: Cria um novo cupom com todas as nossas travas
export async function POST(request: Request) {
    try {
        // SEGURANÇA TEMPORARIAMENTE DESATIVADA PARA TESTE
        const body = await request.json();
        const { 
            codigo, tipoDesconto, valorDesconto, aplicarEm, 
            maxCiclos, limiteUsos, validade, parceiroNome,
            planosValidos, apenasPrimeiraCompra // <--- NOVOS CAMPOS AQUI
        } = body;

        const novoCupom = await prisma.cupom.create({
            data: {
                codigo: codigo.toUpperCase().trim(),
                tipoDesconto,
                valorDesconto: parseFloat(valorDesconto),
                aplicarEm,
                maxCiclos: maxCiclos ? parseInt(maxCiclos) : null,
                limiteUsos: limiteUsos ? parseInt(limiteUsos) : null,
                validade: validade ? new Date(validade) : null, // A DATA AGORA ENTRA AQUI
                parceiroNome,
                planosValidos, // <--- SALVANDO OS PLANOS DO CONTAINER
                apenasPrimeiraCompra: apenasPrimeiraCompra || false // <--- SALVANDO A TRAVA DE 1ª COMPRA
            }
        });

        return NextResponse.json(novoCupom);
    } catch (error) {
        console.error("Erro ao criar cupom:", error);
        return NextResponse.json({ error: 'Erro ao criar cupom. Verifique se o código já existe.' }, { status: 400 });
    }
}

// DELETE: Apaga um cupom do banco de dados
export async function DELETE(request: Request) {
    try {
        // Pega o ID da URL (ex: /api/admin/cupons?id=123)
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID do cupom não fornecido' }, { status: 400 });
        }

        await prisma.cupom.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Cupom apagado com sucesso' });
    } catch (error) {
        console.error("Erro ao deletar cupom:", error);
        return NextResponse.json({ error: 'Erro ao apagar cupom' }, { status: 500 });
    }
}