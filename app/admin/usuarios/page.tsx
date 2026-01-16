'use client';
import { useEffect, useState } from 'react';
import { Search, LogIn, CreditCard, Edit, Save, X, Building2, Unlink, RefreshCw, KeyRound, AtSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/app/contexts/DialogContext';

export default function GestaoClientes() {
  const router = useRouter();
  const dialog = useDialog();
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<any[]>([]);
  const [term, setTerm] = useState('');
  
  const [editingUser, setEditingUser] = useState<any>(null);
  const [novoCnpj, setNovoCnpj] = useState(''); 

  useEffect(() => {
    carregarUsuarios();
    fetch('/api/admin/plans', {
         headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    }).then(r => r.json()).then(setPlanosDisponiveis);
  }, []);

  const carregarUsuarios = () => {
    fetch('/api/admin/users', {
         headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    }).then(r => r.json()).then(data => {
        // Filtra apenas COMUM (Clientes) e outros cargos baixos, se desejar
        // Aqui removi o filtro rígido para você ver todos, ou você pode manter:
        const listaClientes = data.filter((u: any) => !['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(u.role));
        setClientes(listaClientes);
    });
  };

  const handleSaveUser = async () => {
      const [slug, ciclo] = editingUser.planoCombinado.split('|');

      const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
          },
          body: JSON.stringify({ 
              id: editingUser.id, 
              plano: slug,
              planoCiclo: ciclo
          })
      });
      if(res.ok) {
          setEditingUser(null);
          carregarUsuarios();
          dialog.showAlert({ type: 'success', title: 'Sucesso', description: "Dados do cliente salvos!" });
      } else {
          dialog.showAlert({ type: 'danger', title: 'Erro', description: "Não foi possível salvar os dados." });
      }
  };

  const handleUnlinkCompany = async () => {
      const confirmed = await dialog.showConfirm({
          title: 'Desvincular Empresa',
          description: 'O usuário perderá o acesso à empresa atual. Tem certeza?',
          confirmText: 'Sim, desvincular',
          type: 'warning'
      });
      if (!confirmed) return;

      const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
          },
          body: JSON.stringify({ id: editingUser.id, unlinkCompany: true })
      });

      if(res.ok) {
          dialog.showAlert("Empresa desvinculada com sucesso.");
          setEditingUser(null);
          carregarUsuarios();
      } else {
          dialog.showAlert({ type: 'danger', title: 'Erro', description: "Erro ao desvincular." });
      }
  };

  const handleUpdateCnpj = async () => {
      if(!novoCnpj || novoCnpj.length < 14) return dialog.showAlert({ type: 'warning', description: "Digite um CNPJ válido (14 dígitos)." });
      
      const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
          },
          body: JSON.stringify({ 
              id: editingUser.id, 
              empresaId: editingUser.empresa?.id,
              newCnpj: novoCnpj
          })
      });

      const data = await res.json();
      if(res.ok) {
          dialog.showAlert({ type: 'success', description: data.message });
          setEditingUser(null);
          carregarUsuarios();
      } else {
          dialog.showAlert({ type: 'danger', title: 'Falha', description: data.error || "Erro ao processar." });
      }
  };
  
  const handleSendReset = async () => {
      const confirmed = await dialog.showConfirm({
          title: 'Resetar Senha',
          description: `Enviar e-mail de redefinição para ${editingUser.email}?`,
          confirmText: 'Enviar E-mail'
      });
      if(!confirmed) return;

      try {
          const res = await fetch('/api/auth/forgot-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: editingUser.email })
          });
          
          if(res.ok) dialog.showAlert({ type: 'success', description: "E-mail de recuperação enviado!" });
          else dialog.showAlert({ type: 'danger', description: "Erro ao enviar e-mail." });

      } catch (e) { dialog.showAlert("Erro de conexão."); }
  };

  const handleResetEmail = async () => {
    const confirmed = await dialog.showConfirm({
        title: 'Forçar Troca de E-mail',
        description: `O e-mail atual (${editingUser.email}) será removido. No próximo login (via CPF), o usuário será obrigado a cadastrar um novo.\n\nDeseja continuar?`,
        type: 'danger',
        confirmText: 'Sim, Resetar E-mail'
    });
    if(!confirmed) return;

    try {
        const res = await fetch('/api/admin/users', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({ id: editingUser.id, resetEmail: true })
        });
        
        if(res.ok) {
            dialog.showAlert({ type: 'success', title: 'Feito', description: "E-mail resetado com sucesso." });
            setEditingUser(null);
            carregarUsuarios();
        } else {
            dialog.showAlert({ type: 'danger', description: "Erro ao resetar e-mail." });
        }
    } catch (e) { dialog.showAlert("Erro de conexão."); }
  };

  const abrirEdicao = (user: any) => {
      const ciclo = user.planoCiclo || 'MENSAL';
      const slug = user.plano || 'GRATUITO';
      
      setEditingUser({
          ...user,
          planoCombinado: `${slug}|${ciclo}`
      });
      setNovoCnpj(user.empresa ? user.empresa.documento : '');
  }

  // === CORREÇÃO DA FUNÇÃO DE ACESSO (IMPERSONATE) ===
  const acessarSuporte = async (targetId: string) => {
    const adminId = localStorage.getItem('userId');
    
    // Salva o ID do admin para poder voltar depois
    if (adminId) localStorage.setItem('adminBackUpId', adminId);

    try {
        const res = await fetch('/api/admin/impersonate', {
            method: 'POST', body: JSON.stringify({ targetUserId: targetId })
        });
        const data = await res.json();
        
        if (data.success) {
            // 1. LIMPEZA CRÍTICA: Remove qualquer contexto de empresa/contador anterior
            // Isso evita que o admin tente acessar a empresa errada ao trocar de cliente
            localStorage.removeItem('empresaContextId'); 
            
            // 2. Define os dados da sessão falsa
            localStorage.setItem('userId', data.fakeSession.id);
            localStorage.setItem('userRole', data.fakeSession.role);
            localStorage.setItem('isSupportMode', 'true');
            
            // 3. Redireciona
            router.push('/cliente/dashboard');
        } else {
             dialog.showAlert({ type: 'danger', description: "Falha ao iniciar sessão." });
        }
    } catch (error) { 
        dialog.showAlert({ type: 'danger', description: "Erro ao acessar conta do cliente." }); 
    }
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-800">Gerenciar Cliente</h3>
                    <button onClick={() => setEditingUser(null)}><X size={20}/></button>
                </div>
                
                <div className="space-y-6">
                    {/* DADOS PESSOAIS */}
                    <div className="bg-gray-50 p-3 rounded border">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Dados Pessoais</label>
                        <p className="font-bold text-slate-700">{editingUser.nome}</p>
                        <p className="text-xs text-slate-500">{editingUser.email}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3">
                             <button onClick={handleSendReset} className="bg-white border border-blue-200 text-blue-600 text-xs font-bold py-2 rounded hover:bg-blue-50 flex items-center justify-center gap-2 transition">
                                <KeyRound size={14}/> Reset Senha
                            </button>
                            <button onClick={handleResetEmail} className="bg-white border border-orange-200 text-orange-600 text-xs font-bold py-2 rounded hover:bg-orange-50 flex items-center justify-center gap-2 transition">
                                <AtSign size={14}/> Reset Email
                            </button>
                        </div>
                    </div>

                    {/* ÁREA DA EMPRESA */}
                    <div className="border-t pt-4">
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-2">
                            <Building2 size={16}/> Empresa Vinculada
                        </label>
                        
                        {editingUser.empresa ? (
                            <div className="space-y-3">
                                <div className="p-2 bg-blue-50 border border-blue-100 rounded text-sm">
                                    <p className="font-bold text-blue-900 line-clamp-1">{editingUser.empresa.razaoSocial}</p>
                                    <p className="text-xs text-blue-600 font-mono mt-1">Atual: {editingUser.empresa.documento}</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1">Trocar CNPJ (Apenas se livre)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            className="flex-1 p-2 border rounded text-sm font-mono"
                                            value={novoCnpj}
                                            onChange={e => setNovoCnpj(e.target.value)}
                                            placeholder="Novo CNPJ..."
                                        />
                                        <button onClick={handleUpdateCnpj} className="bg-slate-800 text-white px-3 rounded hover:bg-slate-700" title="Salvar Novo CNPJ">
                                            <RefreshCw size={16}/>
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleUnlinkCompany} className="w-full text-red-600 text-xs border border-red-200 hover:bg-red-50 p-2 rounded flex items-center justify-center gap-2 transition">
                                    <Unlink size={14}/> Desvincular (Resetar)
                                </button>
                            </div>
                        ) : (
                            <div className="text-center p-4 border-2 border-dashed border-gray-200 rounded text-gray-400 text-sm">
                                Nenhuma empresa vinculada.
                            </div>
                        )}
                    </div>

                    {/* PLANO */}
                    <div className="border-t pt-4">
                        <label className="block text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-2">
                            <CreditCard size={16}/> Assinatura
                        </label>
                        <select 
                            className="w-full p-2 border rounded bg-white text-slate-800 focus:ring-2 focus:ring-green-500 text-sm"
                            value={editingUser.planoCombinado}
                            onChange={e => setEditingUser({...editingUser, planoCombinado: e.target.value})}
                        >
                            {planosDisponiveis.map(p => {
                                if (Number(p.priceMonthly) === 0) {
                                    return <option key={`${p.slug}|MENSAL`} value={`${p.slug}|MENSAL`}>{p.name} (Gratuito)</option>
                                }
                                return [
                                    <option key={`${p.slug}|MENSAL`} value={`${p.slug}|MENSAL`}>{p.name} Mensal</option>,
                                    <option key={`${p.slug}|ANUAL`} value={`${p.slug}|ANUAL`}>{p.name} Anual</option>
                                ]
                            })}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                        <button onClick={handleSaveUser} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 font-bold shadow-lg shadow-green-100 transition">
                            <Save size={18}/> Salvar Tudo
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* TABELA */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Empresa</th>
                    <th className="p-4">Plano</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(cli => (
                    <tr key={cli.id} className="border-b hover:bg-slate-50 transition">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{cli.nome}</p>
                            <p className="text-xs text-slate-500">{cli.email}</p>
                        </td>
                        <td className="p-4">
                            {cli.empresa ? (
                                <div>
                                    <p className="font-medium text-slate-700 text-xs line-clamp-1">{cli.empresa.razaoSocial}</p>
                                    <p className="text-[10px] text-slate-500 font-mono bg-slate-100 inline-block px-1 rounded mt-1">{cli.empresa.documento}</p>
                                </div>
                            ) : <span className="text-orange-400 text-xs font-bold bg-orange-50 px-2 py-1 rounded">Pendente</span>}
                        </td>
                        <td className="p-4">
                            <span className="flex items-center gap-1 w-fit text-green-700 bg-green-50 px-2 py-1 rounded text-[10px] font-bold border border-green-200 uppercase">
                                {cli.plano} {cli.planoCiclo === 'ANUAL' ? '(A)' : '(M)'}
                            </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2 items-center">
                            <button onClick={() => abrirEdicao(cli)} className="text-blue-600 hover:bg-blue-50 p-2 border border-blue-100 rounded transition" title="Gerenciar">
                                <Edit size={16}/>
                            </button>
                            <button 
                                onClick={() => acessarSuporte(cli.id)}
                                className="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition"
                                title="Acessar como este cliente"
                            >
                                <LogIn size={14}/>
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