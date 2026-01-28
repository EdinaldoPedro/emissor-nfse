'use client';

import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { usePathname, useRouter } from 'next/navigation';

export default function AppTour() {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0); 
  const pathname = usePathname();
  const router = useRouter();

  // === 1. LISTENER DO MENU (AVANÇO AUTOMÁTICO) ===
  useEffect(() => {
    const handleMenuOpened = () => {
        if (pathname.includes('/cliente/dashboard') && stepIndex === 3) {
            setTimeout(() => {
                setStepIndex(prev => prev + 1);
            }, 600); 
        }
    };
    window.addEventListener('tour:menu-opened', handleMenuOpened);
    return () => window.removeEventListener('tour:menu-opened', handleMenuOpened);
  }, [stepIndex, pathname]);

  // === 2. CONFIGURAÇÃO DE PASSOS ===
  const configurarPassos = () => {
    // 1. Minha Conta
    if (pathname.includes('/configuracoes/minha-conta')) {
        setSteps([
            { target: 'body', placement: 'center', title: 'Seu Perfil', content: 'Aqui você gerencia seus dados de acesso e preferências.', disableBeacon: true },
            { target: '.tour-perfil-card', content: 'Visualize seu resumo e altere seu plano aqui.' },
            { target: '.tour-dados-pessoais', content: 'Mantenha seus dados sempre atualizados.' },
            { target: '.tour-preferencias', content: 'Personalize o sistema (Modo Escuro, Idioma).' },
            { target: '.tour-save-btn', content: 'Clique em Salvar para finalizar.' }
        ]);
    } 
    // 2. Empresa
    else if (pathname === '/configuracoes') {
        setSteps([
            { target: 'body', placement: 'center', title: 'Dados da Empresa', content: 'Preencha os dados obrigatórios para emitir notas.', disableBeacon: true },
            { target: '.tour-cnpj-search', content: 'Busque os dados automaticamente pelo CNPJ.' },
            { target: '.tour-tributacao', content: 'Confira Inscrição Municipal e Regime Tributário.' },
            { target: '.tour-dps-config', content: 'Defina o ambiente (Teste ou Produção).' },
            { target: '.tour-certificado', content: 'Faça upload do Certificado A1 aqui.' },
            { target: '.tour-save-btn', content: 'Salve para liberar o painel.' }
        ]);
    }
    // 3. Dashboard
    else if (pathname.includes('/cliente/dashboard')) {
        setSteps([
            { target: 'body', placement: 'center', title: 'Seu Painel', content: 'Visão geral do negócio.', disableBeacon: true },
            { target: '.tour-emitir-card', content: 'Botão rápido para emitir nota.' },
            { target: '.tour-minhas-notas', content: 'Histórico de notas emitidas.' },
            { target: '.tour-menu-btn', content: 'Clique no menu para ver mais opções.', spotlightClicks: true, disableOverlayClose: true, hideFooter: true, placement: 'right' },
            { target: '.tour-sidebar-perfil', content: 'Dados de acesso.', placement: 'right' },
            { target: '.tour-sidebar-empresa', content: 'Configurações da empresa.', placement: 'right' },
            { target: '.tour-sidebar-gestao', content: 'Cadastro de clientes.', placement: 'right' },
            { target: '.tour-sidebar-suporte', content: 'Suporte técnico.', placement: 'right' },
            { target: 'body', placement: 'center', title: 'Pronto! 🚀', content: 'Sistema configurado.' }
        ]);
    }
  };

  // === 3. INICIALIZAÇÃO BLINDADA ===
  useEffect(() => {
    // Roda apenas no cliente
    if (typeof window === 'undefined') return;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (userId && token) {
      // Adiciona timestamp para evitar cache do navegador e forçar dados frescos
      fetch(`/api/perfil?t=${Date.now()}`, { 
          headers: { 
              'x-user-id': userId,
              'Authorization': `Bearer ${token}` 
          } 
      })
        .then(r => r.json())
        .then(user => {
            // Só roda se o step for menor que 4 (não concluído) e se for um número válido
            if (typeof user.tutorialStep === 'number' && user.tutorialStep < 4) {
               configurarPassos(); 
               
               // Pequeno delay para garantir que o DOM renderizou
               setTimeout(() => {
                   setStepIndex(0); // Garante início do zero
                   setRun(true);
               }, 1000);
            } else {
                setRun(false); // Garante que pare se já tiver terminado
            }
        })
        .catch(err => console.error("Erro Tour:", err));
    }
  }, [pathname]); // Recarrega ao mudar de rota

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, index, type } = data;

    if (type === 'step:after') setStepIndex(index + 1);

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      setStepIndex(0);

      // Salva e Navega para o próximo fluxo
      if (pathname.includes('/configuracoes/minha-conta')) {
          await atualizarBanco(2);
          router.push('/configuracoes');
      } 
      else if (pathname === '/configuracoes') {
          await atualizarBanco(3);
          router.push('/cliente/dashboard');
      } 
      else if (pathname.includes('/cliente/dashboard')) {
          await atualizarBanco(4); // 4 = Concluído geral
      }
    }
  };

  const atualizarBanco = async (step: number) => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      if(!userId) return;
      
      await fetch('/api/perfil/tutorial', {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json', 
              'x-user-id': userId,
              'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ step })
      });
  };

  return (
    <Joyride
      key={pathname} // Força remontagem ao trocar rota
      steps={steps}
      run={run}
      stepIndex={stepIndex} 
      continuous
      showProgress={false}
      showSkipButton={true}
      disableOverlayClose
      callback={handleJoyrideCallback}
      styles={{
        options: { primaryColor: '#2563eb', zIndex: 99999, textColor: '#334155' },
        buttonNext: { backgroundColor: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 'bold', padding: '10px 20px', borderRadius: '8px' },
        buttonBack: { color: '#64748b', marginRight: '10px' },
        tooltipContainer: { textAlign: 'left' }
      }}
      locale={{ back: 'Voltar', close: 'Fechar', last: 'Concluir', next: 'Próximo', nextLabelWithProgress: 'Próximo', skip: 'Pular', open: 'Abrir' }}
    />
  );
}