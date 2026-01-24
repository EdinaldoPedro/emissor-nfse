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
        // Se estivermos no passo do botão do menu (índice 3), avançamos
        if (pathname.includes('/cliente/dashboard') && stepIndex === 3) {
            setTimeout(() => {
                // Avança para o próximo passo (Minha Conta)
                setStepIndex(prev => prev + 1);
            }, 600); // 600ms para a animação do menu completar
        }
    };

    window.addEventListener('tour:menu-opened', handleMenuOpened);
    return () => window.removeEventListener('tour:menu-opened', handleMenuOpened);
  }, [stepIndex, pathname]);

  // === 2. INICIALIZAÇÃO (LÓGICA AJUSTADA) ===
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Reseta estado local para evitar conflitos ao trocar de rota
    setRun(false);

    const userId = localStorage.getItem('userId');

    if (userId) {
      // Verifica no banco se o usuário já concluiu o tutorial
      fetch('/api/perfil', { headers: { 'x-user-id': userId } })
        .then(r => r.json())
        .then(user => {
            // LÓGICA DE PRODUÇÃO:
            // Só roda se o step for menor que 4 (0, 1, 2 ou 3)
            // Se o usuário clicou em "Reiniciar" na aba minha conta, o step virou 0, então vai entrar aqui.
            if (user && typeof user.tutorialStep === 'number' && user.tutorialStep < 4) {
               configurarPassos(); 
               // Pequeno delay para garantir que a UI carregou antes de iniciar o tour
               setTimeout(() => setRun(true), 500);
            }
        })
        .catch(() => {
            // Em caso de erro (ex: sem internet), não roda para não travar
            console.log("Não foi possível verificar status do tutorial.");
        });
    }
  }, [pathname]);

  const configurarPassos = () => {
    
    // 1. Minha Conta
    if (pathname.includes('/configuracoes/minha-conta')) {
        setSteps([
            { 
                target: 'body', 
                placement: 'center', 
                title: 'Seu Perfil', 
                content: 'Aqui você gerencia seus dados de acesso e preferências.', 
                disableBeacon: true 
            },
            { 
                target: '.tour-perfil-card', 
                content: 'Visualize seu resumo e altere seu plano de assinatura aqui.' 
            },
            { 
                target: '.tour-dados-pessoais', 
                content: 'Mantenha e-mail e telefone atualizados.' 
            },
            { 
                target: '.tour-preferencias', 
                content: 'Personalize o sistema: Modo Escuro ou Idioma.' 
            },
            { 
                target: '.tour-save-btn', 
                content: 'Não esqueça de salvar suas alterações!' 
            }
        ]);
    } 
    
    // 2. Empresa
    else if (pathname === '/configuracoes') {
        setSteps([
            { 
                target: 'body', 
                placement: 'center', 
                title: 'Dados da Empresa', 
                content: 'Esta é a parte mais importante! Sem esses dados, a prefeitura não aceita suas notas.', 
                disableBeacon: true 
            },
            { 
                target: '.tour-cnpj-search', 
                content: 'Digite seu CNPJ e clique na lupa. O sistema preenche Razão Social e Endereço automaticamente!', 
                disableBeacon: true 
            },
            { 
                target: '.tour-tributacao', 
                content: 'Confira sua Inscrição Municipal e Regime Tributário. Se tiver dúvidas, consulte seu contador.' 
            },
            { 
                target: '.tour-dps-config', 
                content: 'Atenção aqui: Para testar, use "Homologação". Para emitir valendo, mude para "Produção".' 
            },
            { 
                target: '.tour-certificado', 
                content: 'Obrigatório: Envie seu Certificado A1 (.pfx) e a senha. Nós guardamos com criptografia de ponta.' 
            },
            { 
                target: '.tour-save-btn', 
                content: 'Salve suas configurações para liberar o emissor.' 
            }
        ]);
    }
    
    // 3. Dashboard
    else if (pathname.includes('/cliente/dashboard')) {
        setSteps([
            { 
                target: 'body', 
                placement: 'center', 
                title: 'Seu Painel', 
                content: 'Aqui você controla tudo.', 
                disableBeacon: true 
            },
            { 
                target: '.tour-emitir-card', 
                content: 'Clique aqui para emitir uma nova NFS-e.' 
            },
            { 
                target: '.tour-minhas-notas', 
                content: 'Aqui fica seu histórico de notas.' 
            },
            
            // PASSO DE INTERAÇÃO: BOTÃO DO MENU
            {
                target: '.tour-menu-btn',
                content: 'Clique neste ícone para abrir o menu lateral e ver mais opções.',
                spotlightClicks: true, // Permite clicar
                disableOverlayClose: true,
                hideFooter: true, // Esconde botão "Próximo" para forçar o clique no menu
                placement: 'right'
            },
            
            // PASSOS DENTRO DO MENU
            {
                target: '.tour-sidebar-perfil',
                content: 'Confira seus dados de acesso e plano aqui.',
                placement: 'right'
            },
            {
                target: '.tour-sidebar-empresa',
                content: 'Precisa mudar o certificado ou endereço da empresa? É aqui.',
                placement: 'right'
            },
            {
                target: '.tour-sidebar-gestao',
                content: 'Cadastre seus clientes recorrentes para emitir mais rápido.',
                placement: 'right'
            },
            {
                target: '.tour-sidebar-suporte',
                content: 'Teve problema? Abra um chamado no suporte.',
                placement: 'right'
            },
            
            // Passo Final
            { 
                target: 'body', 
                placement: 'center', 
                title: 'Pronto! 🚀', 
                content: 'Você já pode usar o sistema.' 
            }
        ]);
    }
  };

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, index, type } = data;

    // Atualiza o índice interno quando o usuário clica em "Próximo" ou "Voltar"
    if (type === 'step:after') {
        setStepIndex(index + 1);
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      setStepIndex(0);

      // Navegação
      if (pathname.includes('/configuracoes/minha-conta')) {
          router.push('/configuracoes');
      } 
      else if (pathname === '/configuracoes') {
          router.push('/cliente/dashboard');
      } 
      else if (pathname.includes('/cliente/dashboard')) {
          await atualizarBanco(4);
      }
    }
  };

  const atualizarBanco = async (step: number) => {
      const userId = localStorage.getItem('userId');
      if(!userId) return;
      await fetch('/api/perfil/tutorial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({ step })
      });
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex} 
      continuous
      showProgress={true}
      showSkipButton={true}
      disableOverlayClose
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#2563eb',
          zIndex: 99999,
          textColor: '#334155',
        },
        buttonNext: {
            backgroundColor: '#2563eb',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '10px 20px',
            borderRadius: '8px'
        },
        buttonBack: {
            color: '#64748b',
            marginRight: '10px'
        },
        tooltipContainer: { textAlign: 'left' }
      }}
      // === TRADUÇÃO COMPLETA ===
      locale={{ 
          back: 'Voltar', 
          close: 'Fechar', 
          last: 'Concluir', 
          next: 'Próximo',
          nextLabelWithProgress: 'Próximo (Passo {step} de {steps})', 
          skip: 'Pular',
          open: 'Abrir'
      }}
    />
  );
}