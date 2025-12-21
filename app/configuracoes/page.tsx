'use client';

import { useState, useEffect } from 'react';
import { Building2, Save, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesEmpresa() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [empresa, setEmpresa] = useState({
    documento: '',
    razaoSocial: '',
    nomeFantasia: '',
  });

  // Carregar dados atuais ao abrir a tela
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    async function carregarDados() {
      const res = await fetch('/api/perfil', {
        headers: { 'x-user-id': userId }
      });
      if (res.ok) {
        const dados = await res.json();
        setEmpresa({
          documento: dados.documento || '',
          razaoSocial: dados.razaoSocial || '',
          nomeFantasia: dados.nomeFantasia || '',
        });
      }
    }
    carregarDados();
  }, [router]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify(empresa),
      });

      if (res.ok) {
        setMsg('✅ Dados da empresa atualizados com sucesso!');
      } else {
        setMsg('❌ Erro ao atualizar.');
      }
    } catch (error) {
      setMsg('❌ Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        
        <div className="flex items-center gap-4 mb-8 border-b pb-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dados da Minha Empresa</h1>
            <p className="text-gray-500 text-sm">Essas informações aparecerão nas suas Notas Fiscais como "Prestador".</p>
          </div>
        </div>

        <form onSubmit={handleSalvar} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ ou CPF</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="00.000.000/0000-00"
                value={empresa.documento}
                onChange={e => setEmpresa({...empresa, documento: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Razão Social (Nome Oficial)</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: João da Silva Serviços ME"
              value={empresa.razaoSocial}
              onChange={e => setEmpresa({...empresa, razaoSocial: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome Fantasia (Marca)</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: JS Tech"
              value={empresa.nomeFantasia}
              onChange={e => setEmpresa({...empresa, nomeFantasia: e.target.value})}
            />
          </div>

          {msg && (
            <div className={`p-3 rounded text-center ${msg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {msg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            {loading ? 'Salvando...' : <><Save size={20} /> Salvar Alterações</>}
          </button>
        </form>
      </div>
    </div>
  );
}