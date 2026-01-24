'use client';
import { useState, useEffect } from 'react';
import { X, CheckCircle, ArrowRight, Building, FileText, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OnboardingTutorial() {
    const [step, setStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    // Verifica status ao carregar
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if(userId) {
            fetch('/api/perfil', { headers: {'x-user-id': userId} })
                .then(r => r.json())
                .then(user => {
                    // Se step for menor que 4 (concluído), abre
                    if (user.tutorialStep < 4) {
                        setStep(user.tutorialStep + 1); // Começa do próximo passo
                        setIsOpen(true);
                    }
                });
        }
    }, []);

    const updateProgress = async (newStep: number) => {
        const userId = localStorage.getItem('userId');
        await fetch('/api/perfil/tutorial', { // Vamos criar essa rota rápida abaixo
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'x-user-id': userId || ''},
            body: JSON.stringify({ step: newStep })
        });
        setStep(newStep);
        if (newStep >= 4) setIsOpen(false);
    };

    if (!isOpen) return null;

    const steps = [
        {
            id: 1,
            title: "Bem-vindo ao NFSe Fácil!",
            desc: "Vamos configurar sua conta para você emitir sua primeira nota em menos de 2 minutos. Você tem 7 dias grátis!",
            icon: <Award size={48} className="text-yellow-500"/>,
            actionLabel: "Começar Configuração",
            action: () => {
                router.push('/configuracoes');
                updateProgress(2);
            }
        },
        {
            id: 2,
            title: "Dados da Empresa",
            desc: "Preencha o CNPJ e o endereço da sua empresa. Isso é obrigatório para a prefeitura.",
            icon: <Building size={48} className="text-blue-500"/>,
            actionLabel: "Já Preenchi",
            action: () => updateProgress(3)
        },
        {
            id: 3,
            title: "Certificado Digital",
            desc: "Sem certificado A1 não é possível assinar a nota. Faça o upload do arquivo .pfx nas configurações.",
            icon: <FileText size={48} className="text-green-500"/>,
            actionLabel: "Tenho Certificado",
            action: () => {
                router.push('/emitir');
                updateProgress(4); // Finaliza
            }
        }
    ];

    const current = steps.find(s => s.id === step);
    if (!current) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
                
                {/* Header com Progresso */}
                <div className="bg-slate-50 p-6 border-b text-center relative">
                    <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    <div className="flex justify-center mb-4">
                        {current.icon}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{current.title}</h2>
                    <div className="flex justify-center gap-2 mt-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i <= step ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`}></div>
                        ))}
                    </div>
                </div>

                <div className="p-8 text-center">
                    <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                        {current.desc}
                    </p>

                    <button 
                        onClick={current.action}
                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                        {current.actionLabel} <ArrowRight size={20}/>
                    </button>
                    
                    <button onClick={() => setIsOpen(false)} className="mt-4 text-sm text-slate-400 hover:text-slate-600 underline">
                        Pular tutorial (Não recomendado)
                    </button>
                </div>
            </div>
        </div>
    );
}