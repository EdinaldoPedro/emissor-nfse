'use client';
import { useEffect, useState } from 'react';
import { Search, LogIn, CreditCard, Edit, Save, X, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GestaoClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<any[]>([]); // <--- LISTA DE PLANOS DO BD
  const [term, setTerm] = useState('');
  
  const [editingUser, setEditingUser] = useState<any>(null);

  // Carrega Usuários e Planos
  useEffect(() => {
    carregarUsuarios();
    fetch('/api/admin/plans').then(r => r.json()).then(setPlanosDisponiveis);
  }, []);

  const carregarUsuarios = () => {
    fetch('/api/admin/users').then(r => r.json()).then(data => {
        const apenasClientes = data.filter((u: any) => u.role === 'COMUM');
        setClientes(apenasClientes);
    });
  };

  const handleSaveUser = async () => {
      // Divide o valor do select (Ex: "PRO|MENSAL")
      const [slug, ciclo] = editingUser.planoCombinado.split('|');

      const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ 
              id: editingUser.id, 
              plano: slug,
              planoCiclo: ciclo
          })
      });
      if(res.ok) {
          setEditingUser(null);
          carregarUsuarios();
          alert("Plano do cliente atualizado!");
      } else {
          alert("Erro ao salvar");
      }
  };

  const abrirEdicao = (user: any) => {
      // Cria o valor combinado para o select funcionar
      const ciclo = user.planoCiclo || 'MENSAL';
      const slug = user.plano || 'GRATUITO';
      
      setEditingUser({
          ...user,
          planoCombinado: `${slug}|${ciclo}` // Ex: "PRO|ANUAL"
      });
  }

  // ... (função acessarSuporte igual ...)
  const acessarSuporte = async (targetId: string) => {
    const adminId = localStorage.getItem('userId');
    if (adminId) localStorage.setItem('adminBackUpId', adminId);
    try {
        const res = await fetch('/api/admin/impersonate', {
            method: 'POST', body: JSON.stringify({ targetUserId: targetId })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('userId', data.fakeSession.id);
            localStorage.setItem('userRole', data.fakeSession.role);
            localStorage.setItem('isSupportMode', 'true');
            router.push('/cliente/dashboard');
        }
    } catch (error) { alert("Erro ao acessar."); }
  };

  const filtered = clientes.filter(c => c.nome.toLowerCase().includes(term.toLowerCase()) || c.email.includes(term));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Clientes (SaaS)</h1>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input placeholder="Buscar cliente..." className="pl-10 p-2 border rounded-lg w-64" onChange={e => setTerm(e.target.value)} />
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Editar Cliente</h3>
                    <button onClick={() => setEditingUser(null)}><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Cliente</label>
                        <input className="w-full p-2 bg-gray-100 border rounded" value={editingUser.nome} disabled />
                        <p className="text-xs text-gray-400 mt-1">{editingUser.email}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plano de Assinatura</label>
                        <select 
                            className="w-full p-2 border rounded bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                            value={editingUser.planoCombinado}
                            onChange={e => setEditingUser({...editingUser, planoCombinado: e.target.value})}
                        >
                            {planosDisponiveis.map(p => {
                                // Para cada plano, geramos as opções Mensal e Anual
                                // Se o preço for 0, só mostra uma opção "Gratuito"
                                if (Number(p.priceMonthly) === 0) {
                                    return (
                                        <option key={`${p.slug}|MENSAL`} value={`${p.slug}|MENSAL`}>
                                            {p.name} (Gratuito)
                                        </option>
                                    )
                                }
                                return [
                                    <option key={`${p.slug}|MENSAL`} value={`${p.slug}|MENSAL`}>
                                        {p.name} Mensal (R$ {Number(p.priceMonthly).toFixed(2)})
                                    </option>,
                                    <option key={`${p.slug}|ANUAL`} value={`${p.slug}|ANUAL`}>
                                        {p.name} Anual (R$ {Number(p.priceYearly).toFixed(2)})
                                    </option>
                                ]
                            })}
                        </select>
                    </div>

                    <hr className="my-4"/>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Segurança</label>
                        <button onClick={() => alert("Em breve")} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <KeyRound size={14} /> Enviar link de reset de senha
                        </button>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={handleSaveUser} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2">
                            <Save size={18}/> Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* TABELA DE CLIENTES */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Empresa</th>
                    <th className="p-4">Contrato (Plano)</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(cli => (
                    <tr key={cli.id} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{cli.nome}</p>
                            <p className="text-xs text-slate-500">{cli.email}</p>
                        </td>
                        <td className="p-4">
                            {cli.empresa ? (
                                <div>
                                    <p className="font-medium text-slate-700">{cli.empresa.razaoSocial}</p>
                                    <p className="text-xs text-slate-500 font-mono">{cli.empresa.documento}</p>
                                </div>
                            ) : <span className="text-red-300 text-xs">-</span>}
                        </td>
                        <td className="p-4">
                            <span className="flex items-center gap-1 w-fit text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200 uppercase">
                                <CreditCard size={12}/> {cli.plano} {cli.planoCiclo === 'ANUAL' ? '(Anual)' : ''}
                            </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => abrirEdicao(cli)} className="text-slate-500 hover:text-blue-600 p-2 border rounded hover:bg-blue-50" title="Editar Plano">
                                <Edit size={16}/>
                            </button>
                            <button 
                                onClick={() => acessarSuporte(cli.id)}
                                className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition"
                            >
                                <LogIn size={14}/> Acessar Painel
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}