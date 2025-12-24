'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const [isSupport, setIsSupport] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Verifica se estamos no modo espião
    setIsSupport(localStorage.getItem('isSupportMode') === 'true');
  }, []);

  const sairDoSuporte = () => {
    // RECUPERA O ADMIN
    const adminId = localStorage.getItem('adminBackUpId');
    if (adminId) {
        localStorage.setItem('userId', adminId);
        localStorage.setItem('userRole', 'ADMIN');
        
        // Limpa sujeira
        localStorage.removeItem('adminBackUpId');
        localStorage.removeItem('isSupportMode');
        
        router.push('/admin/usuarios'); // Volta direto pra lista
    } else {
        router.push('/login'); // Fallback se der erro
    }
  };

  return (
    <div className={`min-h-screen ${isSupport ? 'bg-amber-50 border-4 border-amber-400' : ''}`}>
      
      {/* BARRA DE AVISO FLUTUANTE */}
      {isSupport && (
        <div className="bg-amber-500 text-white p-2 px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg">
          <span className="font-bold text-sm">🕵️ MODO SUPORTE ATIVO (Visualizando como cliente)</span>
          <button 
            onClick={sairDoSuporte}
            className="bg-white text-amber-600 px-4 py-1 rounded text-xs font-bold hover:bg-amber-50"
          >
            VOLTAR AO ADMIN
          </button>
        </div>
      )}

      {children}
    </div>
  );
}