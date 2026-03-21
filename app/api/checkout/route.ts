import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        // Recebe os dados do carrinho (Apenas para visualizar no console do servidor, se quiser)
        const body = await request.json();
        console.log("Carrinho Recebido:", body);

        // Retorna o sucesso imediato para o frontend avançar para o QR Code
        return NextResponse.json({ 
            mensagem: "Pronto, estou aguardando a implementação da API com o banco Inter!",
            faturaId: "MOCK_FATURA_" + Date.now(),
            qrCodePix: "00020101021126580014br.gov.bcb.pix... (Gerado pelo sistema)"
        }, { status: 200 });

    } catch (error) {
        console.error('Erro no Mock do Checkout:', error);
        return NextResponse.json({ error: 'Erro interno ao processar pedido' }, { status: 500 });
    }
}