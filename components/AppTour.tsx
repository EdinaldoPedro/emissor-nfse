'use client';

import { useEffect, useState } from 'react';
import {
  ACTIONS,
  EVENTS,
  Joyride,
  STATUS,
  type EventData,
  type Step,
} from 'react-joyride';
import { usePathname, useRouter } from 'next/navigation';

export default function AppTour() {
  const [isMounted, setIsMounted] = useState(false);
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleMenuOpened = () => {
      if (pathname.includes('/cliente/dashboard') && stepIndex === 3) {
        setTimeout(() => {
          setStepIndex((prev) => prev + 1);
        }, 600);
      }
    };

    window.addEventListener('tour:menu-opened', handleMenuOpened);
    return () => window.removeEventListener('tour:menu-opened', handleMenuOpened);
  }, [stepIndex, pathname]);

  const configurarPassos = () => {
    if (pathname.includes('/configuracoes/minha-conta')) {
      setSteps([
        {
          target: 'body',
          placement: 'center',
          title: 'Seu Perfil',
          content: 'Aqui você gerencia seus dados de acesso e preferências.',
          skipBeacon: true,
        },
        { target: '.tour-perfil-card', content: 'Visualize seu resumo e altere seu plano aqui.' },
        { target: '.tour-dados-pessoais', content: 'Mantenha seus dados sempre atualizados.' },
        { target: '.tour-preferencias', content: 'Personalize o sistema (Modo Escuro, Idioma).' },
        { target: '.tour-save-btn', content: 'Clique em Salvar para finalizar.' },
      ]);
    } else if (pathname === '/configuracoes') {
      setSteps([
        {
          target: 'body',
          placement: 'center',
          title: 'Dados da Empresa',
          content: 'Preencha os dados obrigatórios para emitir notas.',
          skipBeacon: true,
        },
        { target: '.tour-cnpj-search', content: 'Busque os dados automaticamente pelo CNPJ.' },
        { target: '.tour-tributacao', content: 'Confira Inscrição Municipal e Regime Tributário.' },
        { target: '.tour-dps-config', content: 'Defina o ambiente (Teste ou Produção).' },
        { target: '.tour-certificado', content: 'Faça upload do Certificado A1 aqui.' },
        { target: '.tour-save-btn', content: 'Salve para liberar o painel.' },
      ]);
    } else if (pathname.includes('/cliente/dashboard')) {
      setSteps([
        {
          target: 'body',
          placement: 'center',
          title: 'Seu Painel',
          content: 'Visão geral do negócio.',
          skipBeacon: true,
        },
        { target: '.tour-emitir-card', content: 'Botão rápido para emitir nota.' },
        { target: '.tour-minhas-notas', content: 'Histórico de notas emitidas.' },
        {
          target: '.tour-menu-btn',
          content: 'Clique no menu para ver mais opções.',
          placement: 'right',
          blockTargetInteraction: false,
          overlayClickAction: false,
          buttons: ['close'],
        },
        { target: '.tour-sidebar-perfil', content: 'Dados de acesso.', placement: 'right' },
        { target: '.tour-sidebar-empresa', content: 'Configurações da empresa.', placement: 'right' },
        { target: '.tour-sidebar-gestao', content: 'Cadastro de clientes.', placement: 'right' },
        { target: '.tour-sidebar-suporte', content: 'Suporte técnico.', placement: 'right' },
        {
          target: 'body',
          placement: 'center',
          title: 'Pronto! 🚀',
          content: 'Sistema configurado.',
        },
      ]);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userId = localStorage.getItem('userId');
    if (!userId) return;

    fetch(`/api/perfil?t=${Date.now()}`, {
      headers: { 'x-user-id': userId },
    })
      .then((r) => r.json())
      .then((user) => {
        if (typeof user.tutorialStep === 'number' && user.tutorialStep < 4) {
          configurarPassos();

          setTimeout(() => {
            setStepIndex(0);
            setRun(true);
          }, 1000);
        } else {
          setRun(false);
        }
      })
      .catch((err) => console.error('Erro Tour:', err));
  }, [pathname]);

  const atualizarBanco = async (step: number) => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId) return;

    await fetch('/api/perfil/tutorial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ step }),
    });
  };

  const handleJoyrideEvent = async (data: EventData) => {
  const { action, index, status, type } = data;

  if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
    setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    return;
  }

  if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
    setRun(false);
    setStepIndex(0);

    if (pathname.includes('/configuracoes/minha-conta')) {
      await atualizarBanco(2);
      router.push('/configuracoes');
    } else if (pathname === '/configuracoes') {
      await atualizarBanco(3);
      router.push('/cliente/dashboard');
    } else if (pathname.includes('/cliente/dashboard')) {
      await atualizarBanco(4);
    }
  }
};


  if (!isMounted) return null;

  return (
    <Joyride
      key={pathname}
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideEvent}
      options={{
        primaryColor: '#2563eb',
        textColor: '#334155',
        zIndex: 99999,
        overlayClickAction: false,
        blockTargetInteraction: true,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      styles={{
        buttonPrimary: {
          backgroundColor: '#2563eb',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 700,
          padding: '10px 20px',
          borderRadius: '8px',
        },
        buttonBack: {
          color: '#64748b',
          marginRight: '10px',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
      }}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Concluir',
        next: 'Próximo',
        nextWithProgress: 'Próximo ({current} de {total})',
        skip: 'Pular',
        open: 'Abrir',
      }}
    />
  );
}
