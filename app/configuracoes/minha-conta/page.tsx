'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Save, ArrowLeft, Mail, Phone, Calendar, CreditCard } from 'lucide-react';

export default function MinhaContaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    plano: '',
    createdAt: ''
  });

  // Carrega dados ao abrir
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => {
        setFormData({
          nome: data.nome || '',
          email: data.email || '',
          cpf: data.cpf || '',
          telefone: data.telefone || '',
          plano: data.plano || 'GRATUITO',
          createdAt: data.createdAt ? new Date(data.createdAt).toLocaleDateString('pt-BR') : '-'
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [router]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    const userId = localStorage.getItem('userId');
    
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({
          nome: formData.nome,
          cpf: formData.cpf,
          telefone: formData.telefone
        })
      });

      if (res.ok) {
        setMsg('✅ Dados atualizados com sucesso!');
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg('❌ Erro ao atualizar.');
      }
    } catch (error) {
      setMsg('❌ Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando perfil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition">
            <ArrowLeft className="text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Minha Conta</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Cartão de Resumo (Esquerda) */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <User size={40} />
              </div>
              <h2 className="font-bold text-lg text-gray-800">{formData.nome}</h2>
              <p className="text-sm text-gray-500">{formData.email}</p>
              
              <div className="mt-4 pt-4 border-t border-gray-100 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 flex gap-2"><Calendar size={16}/> Desde:</span>
                  <span className="font-medium">{formData.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 flex gap-2"><CreditCard size={16}/> Plano:</span>
                  <span className="font-bold text-green-600 px-2 py-0.5 bg-green-50 rounded text-xs">
                    {formData.plano}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário de Edição (Direita) */}
          <div className="md:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-700 mb-6 border-b pb-2">Dados Pessoais</h3>
            
            <form onSubmit={handleSalvar} className="space-y-5">
              
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                />
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Não alterável)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    disabled
                    className="w-full pl-10 p-3 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                    value={formData.email}
                  />
                </div>
              </div>

              {/* CPF e Telefone (Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.cpf}
                    onChange={e => setFormData({...formData, cpf: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="(00) 00000-0000"
                      className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Mensagem de Feedback */}
              {msg && (
                <div className={`p-3 rounded text-center text-sm font-medium ${msg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {msg}
                </div>
              )}

              {/* Botão Salvar */}
              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : <><Save size={20} /> Salvar Alterações</>}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  );
}