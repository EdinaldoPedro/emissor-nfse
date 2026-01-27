'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    ArrowLeft, ShoppingCart, ShieldCheck, Zap, 
    CreditCard, QrCode, Lock, AlertTriangle, Loader2 
} from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

// Preços fixos para cálculo (Idealmente viriam da API/Banco)
const ADDON_PRICE = 1.99; // Preço por nota extra

function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dialog = useDialog();

    const planSlug = searchParams.get('plan');
    const [plano, setPlano] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Estados do Carrinho
    const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
    const [qtdExtras, setQtdExtras] = useState(0);
    const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    
    // Estado de Processamento (Fake Payment)
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        // Busca detalhes do plano escolhido
        fetch('/api/plans')
            .then(r => r.json())
            .then(plans => {
                const selected = plans.find((p: any) => p.slug === planSlug);
                if (selected) setPlano(selected);
                setLoading(false);
            });
    }, [planSlug]);

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;
    if (!plano) return <div className="p-10 text-center">Plano não encontrado.</div>;

    // Cálculos
    const precoBase = ciclo === 'MENSAL' ? Number(plano.priceMonthly) : Number(plano.priceYearly);
    const valorExtras = qtdExtras * ADDON_PRICE;
    const total = precoBase + valorExtras;

    const handleFinalizarCompra = async () => {
        setProcessing(true);

        // 1. Simula delay de rede com o Banco
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Cria o Pedido no Banco (Status PENDENTE)
        // Isso é importante para você ter o registro da tentativa de compra
        try {
            const userId = localStorage.getItem('userId');
            await fetch('/api/pedidos', { // Vamos criar essa rota simples abaixo
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
                body: JSON.stringify({
                    planoSlug: plano.slug,
                    ciclo,
                    notasAdicionais: qtdExtras,
                    valorTotal: total,
                    metodo: metodoPagamento
                })
            });
        } catch (e) { console.error("Erro ao criar pedido", e); }

        // 3. FALHA PROPOSITAL (Simulação de erro do Gateway)
        setProcessing(false);
        
        await dialog.showAlert({
            type: 'danger',
            title: 'Pagamento Não Processado',
            description: 'O gateway de pagamento retornou um erro de comunicação. Nenhuma cobrança foi efetuada. Por favor, tente novamente mais tarde ou contate o suporte.'
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUNA ESQUERDA: CONFIGURAÇÃO */}
                <div className="lg:col-span-2 space-y-6">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-bold text-sm">
                        <ArrowLeft size={18}/> Voltar para Planos
                    </button>

                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingCart className="text-blue-600"/> Finalizar Contratação
                    </h1>

                    {/* CARD DO PLANO */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{plano.name}</h2>
                                <p className="text-slate-500 text-sm">{plano.description}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-slate-800">R$ {precoBase.toFixed(2)}</span>
                                <span className="text-xs text-slate-400 block">{ciclo === 'MENSAL' ? '/mês' : '/ano'}</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-600">Ciclo de Faturamento:</span>
                            <div className="flex bg-white rounded-lg p-1 border">
                                <button onClick={() => setCiclo('MENSAL')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${ciclo === 'MENSAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Mensal</button>
                                <button onClick={() => setCiclo('ANUAL')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${ciclo === 'ANUAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Anual (-15%)</button>
                            </div>
                        </div>
                    </div>

                    {/* CARD DE ADICIONAIS (UPSELL) */}
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg flex items-center gap-2"><Zap className="text-yellow-400" fill="currentColor"/> Potencialize seu Plano</h3>
                                    <p className="text-indigo-200 text-sm mt-1 max-w-sm">Adicione créditos de notas avulsas que <strong>nunca expiram</strong>. Use quando seu limite mensal acabar.</p>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                                <div>
                                    <span className="block text-xs font-bold text-indigo-300 uppercase">Notas Extras</span>
                                    <span className="text-2xl font-bold">{qtdExtras} <span className="text-sm font-normal text-indigo-300">unid.</span></span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setQtdExtras(Math.max(0, qtdExtras - 5))} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center font-bold text-xl transition">-</button>
                                    <button onClick={() => setQtdExtras(qtdExtras + 5)} className="w-10 h-10 rounded-full bg-white text-indigo-900 hover:bg-indigo-50 flex items-center justify-center font-bold text-xl transition shadow-lg">+</button>
                                </div>
                            </div>
                            <p className="text-center text-xs text-indigo-300 mt-2">R$ 1,99 por nota adicional</p>
                        </div>
                    </div>

                    {/* CARD DE PAGAMENTO */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Lock size={18}/> Forma de Pagamento</h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button onClick={() => setMetodoPagamento('PIX')} className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition ${metodoPagamento === 'PIX' ? 'border-green-500 bg-green-50 text-green-700' : 'hover:border-slate-300 text-slate-500'}`}>
                                <QrCode size={24}/> <span className="text-sm font-bold">Pix (Instantâneo)</span>
                            </button>
                            <button onClick={() => setMetodoPagamento('CREDIT_CARD')} className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition ${metodoPagamento === 'CREDIT_CARD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:border-slate-300 text-slate-500'}`}>
                                <CreditCard size={24}/> <span className="text-sm font-bold">Cartão de Crédito</span>
                            </button>
                        </div>

                        {metodoPagamento === 'CREDIT_CARD' && (
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
                                <AlertTriangle className="mx-auto mb-2 text-amber-500"/>
                                Ambiente seguro. Seus dados são criptografados.
                            </div>
                        )}
                        {metodoPagamento === 'PIX' && (
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center text-green-700 text-sm">
                                O QR Code será gerado na próxima etapa.
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: RESUMO (STICKY) */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 sticky top-6">
                        <h3 className="font-bold text-slate-800 mb-6 text-lg border-b pb-4">Resumo do Pedido</h3>
                        
                        <div className="space-y-4 text-sm text-slate-600 mb-6">
                            <div className="flex justify-between">
                                <span>{plano.name} ({ciclo === 'MENSAL' ? 'Mensal' : 'Anual'})</span>
                                <span className="font-bold">R$ {precoBase.toFixed(2)}</span>
                            </div>
                            {qtdExtras > 0 && (
                                <div className="flex justify-between text-indigo-600">
                                    <span>{qtdExtras}x Notas Adicionais</span>
                                    <span className="font-bold">R$ {valorExtras.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-green-600">
                                <span>Desconto Promocional</span>
                                <span className="font-bold">- R$ 0,00</span>
                            </div>
                        </div>

                        <div className="border-t pt-4 mb-6">
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-slate-800">Total a Pagar</span>
                                <span className="text-3xl font-black text-blue-600">R$ {total.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 text-right">Renovação automática cancelável a qualquer momento.</p>
                        </div>

                        <button 
                            onClick={handleFinalizarCompra}
                            disabled={processing}
                            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {processing ? <Loader2 className="animate-spin"/> : <ShieldCheck size={20}/>}
                            {processing ? 'Processando...' : 'Finalizar Compra'}
                        </button>
                        
                        <div className="mt-4 flex justify-center gap-2 opacity-50">
                            {/* Ícones de bandeiras de cartão fictícios */}
                            <div className="w-8 h-5 bg-slate-200 rounded"></div>
                            <div className="w-8 h-5 bg-slate-200 rounded"></div>
                            <div className="w-8 h-5 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return <Suspense fallback={<div>Carregando...</div>}><CheckoutContent /></Suspense>
}