'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';

export default function NovoChamado() {
  const router = useRouter();
  const [form, setForm] = useState({ assunto: '', categoria: 'Dúvida', prioridade: 'MEDIA', descricao: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const userId = localStorage.getItem('userId');

      const res = await fetch('/api/suporte/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
          body: JSON.stringify(form)
      });

      if (res.ok) router.push('/cliente/suporte');
      else alert("Erro ao criar chamado");
      setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-2xl h-fit">
            <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600">
                <ArrowLeft size={18}/> Voltar
            </button>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Como podemos ajudar?</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Assunto</label>
                    <input required className="w-full p-3 border rounded-lg" placeholder="Ex: Erro ao emitir nota para CNPJ X" 
                           value={form.assunto} onChange={e => setForm({...form, assunto: e.target.value})}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                        <select className="w-full p-3 border rounded-lg bg-white" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                            <option>Dúvida</option>
                            <option>Erro no Sistema</option>
                            <option>Financeiro</option>
                            <option>Sugestão</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Prioridade</label>
                        <select className="w-full p-3 border rounded-lg bg-white" value={form.prioridade} onChange={e => setForm({...form, prioridade: e.target.value})}>
                            <option value="BAIXA">Baixa (Pode aguardar)</option>
                            <option value="MEDIA">Média (Normal)</option>
                            <option value="ALTA">Alta (Urgente)</option>
                            <option value="CRITICA">Crítica (Sistema Parado)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Descrição Detalhada</label>
                    <textarea required rows={6} className="w-full p-3 border rounded-lg" placeholder="Descreva o que aconteceu..."
                              value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})}></textarea>
                </div>

                <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex justify-center gap-2 items-center">
                    {loading ? 'Enviando...' : <><Send size={18}/> Enviar Solicitação</>}
                </button>
            </form>
        </div>
    </div>
  );
}