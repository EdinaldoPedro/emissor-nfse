'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Paperclip, X, FileText, Loader2 } from 'lucide-react';

export default function NovoChamado() {
  const router = useRouter();
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [form, setForm] = useState({ 
      assuntoId: '', 
      descricao: '', 
      anexoBase64: '', 
      anexoNome: '' 
  });
  const [loading, setLoading] = useState(false);

  // Busca lista de assuntos do backend
  useEffect(() => {
      fetch('/api/admin/suporte/catalogo')
        .then(r => r.json())
        .then(data => {
            if(Array.isArray(data)) setCatalogo(data.filter((i: any) => i.ativo));
        })
        .catch(() => setCatalogo([]));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 10 * 1024 * 1024) return alert("O arquivo deve ter no máximo 10MB.");
          const reader = new FileReader();
          reader.onloadend = () => {
              setForm(prev => ({ ...prev, anexoBase64: reader.result as string, anexoNome: file.name }));
          };
          reader.readAsDataURL(file);
      }
  };

  const removeAnexo = () => setForm(prev => ({ ...prev, anexoBase64: '', anexoNome: '' }));

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!form.assuntoId) return alert("Selecione um assunto.");
      
      setLoading(true);
      const userId = localStorage.getItem('userId');

      const res = await fetch('/api/suporte/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
          body: JSON.stringify(form)
      });

      if (res.ok) router.push('/cliente/suporte');
      else alert("Erro ao criar chamado.");
      setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-2xl h-fit">
            <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition">
                <ArrowLeft size={18}/> Voltar
            </button>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Abrir Novo Chamado</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Qual o motivo do contato?</label>
                    <select required className="w-full p-3 border rounded-lg bg-white outline-blue-500" 
                        value={form.assuntoId} onChange={e => setForm({...form, assuntoId: e.target.value})}>
                        <option value="" disabled>Selecione um assunto...</option>
                        {catalogo.map(item => (
                            <option key={item.id} value={item.id}>{item.titulo}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Descrição Detalhada</label>
                    <textarea required rows={6} className="w-full p-3 border rounded-lg outline-blue-500" 
                        placeholder="Descreva o que aconteceu..."
                        value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})}
                    ></textarea>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Anexar Arquivo (Opcional)</label>
                    {!form.anexoBase64 ? (
                        <label className="flex items-center gap-2 w-fit px-4 py-2 border border-dashed border-blue-300 bg-blue-50 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 transition">
                            <Paperclip size={18}/> <span className="text-sm font-bold">Escolher arquivo (Máx 10MB)</span>
                            <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf"/>
                        </label>
                    ) : (
                        <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-lg w-fit border border-slate-200">
                            <FileText size={20} className="text-slate-500"/>
                            <span className="text-sm font-medium max-w-[200px] truncate">{form.anexoNome}</span>
                            <button type="button" onClick={removeAnexo} className="text-red-500 hover:bg-red-100 p-1 rounded"><X size={16}/></button>
                        </div>
                    )}
                </div>

                <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex justify-center gap-2 items-center shadow-lg transition">
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <><Send size={18}/> Enviar Solicitação</>}
                </button>
            </form>
        </div>
    </div>
  );
}