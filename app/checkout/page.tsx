'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    ArrowLeft, ShoppingCart, ShieldCheck, Zap, 
    CreditCard, QrCode, Lock, AlertTriangle, Loader2, Calendar 
} from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

// Preços fixos para cálculo
const ADDON_PRICE = 1.99; 

function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dialog = useDialog();

    const planSlug = searchParams.get('plan');
    const cycleParam = searchParams.get('cycle'); // Lê o ciclo da URL
    
    const [plano, setPlano] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Estados do Carrinho
    // Se não vier na URL, assume mensal
    const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>((cycleParam as 'MENSAL'|'ANUAL') || 'MENSAL');
    const [qtdCiclos, setQtdCiclos] = useState(1); // O CONTADOR DE TEMPO (1x, 2x...)
    const [qtdExtras, setQtdExtras] = useState(0);
    const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
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
    const precoUnitario = ciclo === 'MENSAL' ? Number(plano.priceMonthly) : Number(plano.priceYearly);
    const subtotalPlano = precoUnitario * qtdCiclos;
    const valorExtras = qtdExtras * ADDON_PRICE;
    const total = subtotalPlano + valorExtras;

    const labelCiclo = ciclo === 'MENSAL' ? 'Mês' : 'Ano';
    const labelPlural = ciclo === 'MENSAL' ? 'Meses' : 'Anos';

    const handleFinalizarCompra = async () => {
        setProcessing(true);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Delay fake

        try {
            const userId = localStorage.getItem('userId');
            await fetch('/api/pedidos', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
                body: JSON.stringify({
                    planoSlug: plano.slug,
                    ciclo,
                    quantidade: qtdCiclos, // Salva quantos ciclos comprou (ex: 2 meses)
                    notasAdicionais: qtdExtras,
                    valorTotal: total,
                    metodo: metodoPagamento
                })
            });
        } catch (e) { console.error(e); }

        setProcessing(false);
        
        await dialog.showAlert({
            type: 'danger',
            title: 'Pagamento Não Processado',
            description: 'O gateway de pagamento retornou um erro de comunicação. Nenhuma cobrança foi efetuada.'
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUNA ESQUERDA */}
                <div className="lg:col-span-2 space-y-6">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-bold text-sm">
                        <ArrowLeft size={18}/> Voltar para Planos
                    </button>

                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingCart className="text-blue-600"/> Finalizar Contratação
                    </h1>

                    {/* CARD DO PLANO (AGORA COM CONTADOR DE TEMPO) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{plano.name}</h2>
                                <p className="text-slate-500 text-sm">{plano.description}</p>
                                <span className="inline-block mt-2 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100 uppercase">
                                    Faturamento {ciclo}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-slate-800">R$ {precoUnitario.toFixed(2)}</span>
                                <span className="text-xs text-slate-400 block">/{labelCiclo.toLowerCase()}</span>
                            </div>
                        </div>

                        {/* SELETOR DE DURAÇÃO (O QUE VOCÊ PEDIU) */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between">
                            <div>
                                <span className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Calendar size={16}/> Tempo de Acesso
                                </span>
                                <span className="text-xs text-slate-500">
                                    Garanta {qtdCiclos} {qtdCiclos > 1 ? labelPlural.toLowerCase() : labelCiclo.toLowerCase()} de uso agora.
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-3 bg-white p-1 rounded-lg border shadow-sm">
                                <button 
                                    onClick={() => setQtdCiclos(Math.max(1, qtdCiclos - 1))} 
                                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded transition font-bold"
                                >
                                    -
                                </button>
                                <span className="text-lg font-bold text-blue-700 w-8 text-center">{qtdCiclos}</span>
                                <button 
                                    onClick={() => setQtdCiclos(qtdCiclos + 1)} 
                                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded transition font-bold"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CARD DE ADICIONAIS (MANTIDO) */}
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg flex items-center gap-2"><Zap className="text-yellow-400" fill="currentColor"/> Potencialize seu Plano</h3>
                                    <p className="text-indigo-200 text-sm mt-1 max-w-sm">Adicione créditos de notas avulsas que <strong>nunca expiram</strong>.</p>
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

                    {/* CARD DE PAGAMENTO (MANTIDO) */}
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
                    </div>
                </div>

                {/* COLUNA DIREITA: RESUMO */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 sticky top-6">
                        <h3 className="font-bold text-slate-800 mb-6 text-lg border-b pb-4">Resumo do Pedido</h3>
                        
                        <div className="space-y-4 text-sm text-slate-600 mb-6">
                            <div className="flex justify-between">
                                <span>{plano.name} ({qtdCiclos}x {labelCiclo})</span>
                                <span className="font-bold">R$ {subtotalPlano.toFixed(2)}</span>
                            </div>
                            {qtdExtras > 0 && (
                                <div className="flex justify-between text-indigo-600">
                                    <span>{qtdExtras}x Notas Adicionais</span>
                                    <span className="font-bold">R$ {valorExtras.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t pt-4 mb-6">
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-slate-800">Total a Pagar</span>
                                <span className="text-3xl font-black text-blue-600">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleFinalizarCompra}
                            disabled={processing}
                            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {processing ? <Loader2 className="animate-spin"/> : <ShieldCheck size={20}/>}
                            {processing ? 'Processando...' : 'Finalizar Compra'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return <Suspense fallback={<div>Carregando...</div>}><CheckoutContent /></Suspense>
}