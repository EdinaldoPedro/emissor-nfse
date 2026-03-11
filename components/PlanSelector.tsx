'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Sparkles } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: string | number;
  priceYearly: string | number;
  features: string;
  recommended: boolean;
}

interface PlanSelectorProps {
  currentPlan: string;
  currentCycle?: string;
  onSelectPlan?: (slug: string, ciclo: string) => void; // <--- NOVO
}

// === LÓGICA DE PARES (Agrupando Mensal e Anual na mesma coluna) ===
const PLAN_TIERS = [
  { id: 'tier-basic', mensal: 'BASIC', anual: 'BASIC_PLUS' },
  { id: 'tier-standard', mensal: 'STANDARD', anual: 'STANDARD_PLUS' },
  { id: 'tier-premium', mensal: 'PREMIUM', anual: 'PREMIUM_PLUS' }
];

export default function PlanSelector({ currentPlan, onSelectPlan }: PlanSelectorProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(data => {
        setPlans(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = (slug: string) => {
    if (onSelectPlan) {
        onSelectPlan(slug, ciclo); // Executa a função da página (Minha Conta)
    } else {
        router.push(`/checkout?plan=${slug}&cycle=${ciclo}`); // Vai para o checkout (Landing Page)
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>;

  return (
    <div className="w-full max-w-6xl mx-auto">
      
      {/* SELETOR DE CICLO (TOGGLE) */}
      <div className="flex justify-center mb-10">
        <div className="bg-slate-100 p-1.5 rounded-full flex relative border border-slate-200 shadow-inner">
          <button 
            onClick={() => setCiclo('MENSAL')}
            className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all z-10 ${ciclo === 'MENSAL' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Mensal
          </button>
          <button 
            onClick={() => setCiclo('ANUAL')}
            className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all z-10 flex items-center gap-2 ${ciclo === 'ANUAL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Anual 
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${ciclo === 'ANUAL' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
              Mais Limites
            </span>
          </button>
        </div>
      </div>

      {/* GRID DE PLANOS (Apenas 3 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {PLAN_TIERS.map(tier => {
          // Encontra os planos correspondentes no array que veio do banco
          const planMensal = plans.find(p => p.slug === tier.mensal);
          const planAnual = plans.find(p => p.slug === tier.anual);
          
          // Decide qual exibir baseado no Toggle
          const displayPlan = ciclo === 'MENSAL' ? planMensal : planAnual;
          
          if (!displayPlan) return null; // Prevenção caso falte algum no banco

          const isCurrent = currentPlan === displayPlan.slug;
          const price = ciclo === 'MENSAL' ? Number(displayPlan.priceMonthly) : Number(displayPlan.priceYearly);
          const priceLabel = ciclo === 'MENSAL' ? '/mês' : '/ano';

          // Tratamento inteligente das features (Como salvamos em JSON no banco)
          let parsedFeatures: string[] = [];
          try {
            parsedFeatures = JSON.parse(displayPlan.features);
          } catch {
            parsedFeatures = displayPlan.features ? String(displayPlan.features).split(',') : [];
          }

          return (
            <div 
              key={tier.id} 
              className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 ${
                isCurrent 
                  ? 'border-2 border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/10' 
                  : displayPlan.recommended
                    ? 'border-2 border-purple-500 bg-white shadow-xl shadow-purple-900/5 lg:scale-105 z-10'
                    : 'border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-slate-200/50'
              }`}
            >
              {displayPlan.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-500/30 flex items-center gap-1">
                  <Sparkles size={14} /> Recomendado
                </div>
              )}

              <div className="mb-6 text-center mt-2">
                <h3 className="font-bold text-xl text-slate-800 mb-2">{displayPlan.name.replace('Plano ', '')}</h3>
                <div className="flex justify-center items-baseline gap-1">
                  <span className="text-sm font-bold text-slate-500">R$</span>
                  <span className="text-5xl font-black text-slate-900 tracking-tight">
                    {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">{priceLabel}</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {parsedFeatures.map((feat, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-slate-700 font-medium">
                    <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${displayPlan.recommended ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                      <Check size={14} strokeWidth={3} /> 
                    </div>
                    <span className="leading-tight">{feat.trim()}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelect(displayPlan.slug)}
                disabled={isCurrent}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  isCurrent 
                    ? 'bg-blue-100 text-blue-700 cursor-default'
                    : displayPlan.recommended
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5'
                      : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 hover:-translate-y-0.5'
                }`}
              >
                {isCurrent ? 'Seu Plano Atual' : 'Assinar Agora'}
              </button>
            </div>
          );
        })}
      </div>
      
    </div>
  );
}