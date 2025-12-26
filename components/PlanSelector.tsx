'use client';
import { useState, useEffect } from 'react';
import { Check, Star, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: string;
  priceYearly: string;
  features: string;
  recommended: boolean;
}

interface PlanSelectorProps {
  currentPlan: string; // Slug do plano atual (ex: 'GRATUITO')
  currentCycle: string; // 'MENSAL' ou 'ANUAL'
  onSelectPlan: (slug: string, ciclo: string) => Promise<void>;
}

export default function PlanSelector({ currentPlan, currentCycle, onSelectPlan }: PlanSelectorProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>(currentCycle as 'MENSAL' | 'ANUAL' || 'MENSAL');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(data => {
        setPlans(data);
        setLoading(false);
      });
  }, []);

  const handleSelect = async (slug: string) => {
    setProcessing(slug);
    await onSelectPlan(slug, ciclo);
    setProcessing(null);
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>;

  return (
    <div className="w-full">
      {/* SELETOR DE CICLO (Toggle) */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-full flex relative">
          <button 
            onClick={() => setCiclo('MENSAL')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all z-10 ${ciclo === 'MENSAL' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Mensal
          </button>
          <button 
            onClick={() => setCiclo('ANUAL')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all z-10 ${ciclo === 'ANUAL' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Anual <span className="text-[10px] text-green-600 ml-1">(-17%)</span>
          </button>
        </div>
      </div>

      {/* GRID DE PLANOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.slug;
          const price = ciclo === 'MENSAL' ? Number(plan.priceMonthly) : Number(plan.priceYearly);
          const priceLabel = ciclo === 'MENSAL' ? '/mês' : '/ano';

          return (
            <div 
              key={plan.id} 
              className={`relative flex flex-col p-6 rounded-xl border-2 transition-all ${
                isCurrent 
                  ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' 
                  : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-lg'
              } ${plan.recommended && !isCurrent ? 'border-purple-200' : ''}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md">
                  Recomendado
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-bold text-lg text-slate-800">{plan.name}</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-3xl font-black text-slate-900">
                    {price === 0 ? 'Grátis' : `R$ ${price.toFixed(2)}`}
                  </span>
                  {price > 0 && <span className="text-sm text-slate-500 ml-1">{priceLabel}</span>}
                </div>
              </div>

              <div className="flex-1 space-y-3 mb-6">
                {plan.features.split(',').map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                    <span className="leading-tight">{feat.trim()}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelect(plan.slug)}
                disabled={isCurrent || processing !== null}
                className={`w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                  isCurrent 
                    ? 'bg-blue-200 text-blue-700 cursor-default'
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'
                }`}
              >
                {processing === plan.slug ? (
                  <Loader2 className="animate-spin" size={18}/>
                ) : isCurrent ? (
                  'Seu Plano Atual'
                ) : (
                  'Escolher este Plano'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}