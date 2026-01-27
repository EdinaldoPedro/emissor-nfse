'use client';
import { useEffect, useState } from 'react';
import { 
    Search, LogIn, CreditCard, Edit, Save, X, Building2, Unlink, 
    RefreshCw, KeyRound, AtSign, AlertTriangle, ShieldCheck, 
    History, Clock, CheckCircle, UserCog, User 
} from 'lucide-react';
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
  
  // === ESTADOS PARA MODAL DE CONFIRMAÇÃO (AUDITORIA) ===
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // === ESTADOS PARA HISTÓRICO DE PLANOS ===
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    carregarUsuarios();
    
    // Busca planos com proteção contra erro
    fetch('/api/plans?visao=admin', { 
        cache: 'no-store',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    .then(r => r.json())
    .then(data => {
        if (Array.isArray(data)) setPlanosDisponiveis(data);
        else setPlanosDisponiveis([]);
    })
    .catch(() => setPlanosDisponiveis([]));
    
  }, []);

  const carregarUsuarios = () => {
    fetch('/api/admin/users', {
         headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    }).then(r => r.json()).then(data => {
        if(Array.isArray(data)) {
            const listaClientes = data.filter((u: any) => !['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(u.role));
            setClientes(listaClientes);
        }
    });
  };

  // --- 1. ABRIR MODAL DE CONFIRMAÇÃO ---
  const handlePreSaveUser = () => {
      if (!editingUser.planoCombinado) return;
      setShowConfirmModal(true);
  };

  // --- 2. SALVAR COM AUDITORIA ---
  const handleConfirmChange = async () => {
      if(!justificativa || justificativa.length < 5) return dialog.showAlert({type:'warning', description: 'Digite uma justificativa válida.'});
      if(!adminPassword) return dialog.showAlert({type:'warning', description: 'Digite sua senha.'});

      setIsProcessing(true);
      const [slug, ciclo] = editingUser.planoCombinado.split('|');

      try {
          const res = await fetch('/api/admin/users', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
              },
              body: JSON.stringify({ 
                  id: editingUser.id, 
                  plano: slug,
                  planoCiclo: ciclo,
                  justification: justificativa,
                  adminPassword: adminPassword
              })
          });

          if(res.ok) {
              setShowConfirmModal(false);
              setEditingUser(null);
              setJustificativa('');
              setAdminPassword('');
              carregarUsuarios();
              dialog.showAlert({ type: 'success', title: 'Sucesso', description: "Plano atualizado e registrado." });
          } else {
              const err = await res.json();
              dialog.showAlert({ type: 'danger', title: 'Erro', description: err.error || "Erro ao salvar." });
          }
      } catch (error) { 
          dialog.showAlert("Erro de conexão."); 
      } finally { 
          setIsProcessing(false); 
      }
  };

  // --- FUNÇÕES UTILITÁRIAS ---
  const handleUnlinkCompany = async () => { 
      const res = await fetch('/api/admin/users', { method: 'PUT', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('token')}, body: JSON.stringify({ id: editingUser.id, unlinkCompany: true }) });
      if(res.ok) { dialog.showAlert("Empresa desvinculada."); setEditingUser(null); carregarUsuarios(); }
  };
  const handleUpdateCnpj = async () => { 
      const res = await fetch('/api/admin/users', { method: 'PUT', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('token')}, body: JSON.stringify({ id: editingUser.id, empresaId: editingUser.empresa?.id, newCnpj: novoCnpj }) });
      if(res.ok) { dialog.showAlert("CNPJ atualizado."); setEditingUser(null); carregarUsuarios(); }
  };
  const handleSendReset = async () => { await fetch('/api/auth/forgot-password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: editingUser.email }) }); dialog.showAlert("Email enviado."); };
  const handleResetEmail = async () => { 
      const res = await fetch('/api/admin/users', { method: 'PUT', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('token')}, body: JSON.stringify({ id: editingUser.id, resetEmail: true }) });
      if(res.ok) { dialog.showAlert("Email resetado."); setEditingUser(null); carregarUsuarios(); }
  };
  
  const abrirEdicao = (user: any) => {
      const ciclo = user.planoCiclo || 'MENSAL';
      const slug = user.plano === 'SEM_PLANO' ? 'SUSPENDED' : (user.plano || 'GRATUITO');
      setEditingUser({ ...user, planoCombinado: `${slug}|${ciclo}` });
      setNovoCnpj(user.empresa ? user.empresa.documento : '');
      setJustificativa(''); setAdminPassword('');
  }

  // === 3. ABRIR HISTÓRICO ===
  const abrirHistorico = (user: any) => {
      setHistoryUser(user);
      setLoadingHistory(true);
      setHistoryData([]); 

      fetch(`/api/admin/users/${user.id}/history`, {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      })
      .then(async (r) => {
          if (r.status === 404) {
              console.error("Rota de histórico não encontrada (404).");
              return []; 
          }
          const json = await r.json();
          return Array.isArray(json) ? json : [];
      })
      .then(setHistoryData)
      .catch((err) => {
          console.error(err);
          setHistoryData([]);
      })
      .finally(() => setLoadingHistory(false));
  };

  const acessarSuporte = async (targetId: string) => {
    // 1. SALVAR QUEM É O ADMIN ANTES DE TROCAR (IMPORTANTE!)
    const adminId = localStorage.getItem('userId');
    if (adminId) localStorage.setItem('adminBackUpId', adminId);

    const res = await fetch('/api/admin/impersonate', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
    const data = await res.json();
    
    if(data.success) { 
        localStorage.setItem('userId', data.fakeSession.id); 
        localStorage.setItem('userRole', data.fakeSession.role); 
        localStorage.setItem('isSupportMode', 'true'); 
        router.push('/cliente/dashboard'); 
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

      {/* === MODAL DE HISTÓRICO === */}
      {historyUser && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-0 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <History className="text-blue-600"/> Histórico de Assinaturas
                        </h3>
                        <p className="text-sm text-slate-500">Cliente: <strong>{historyUser.nome}</strong></p>
                    </div>
                    <button onClick={() => setHistoryUser(null)}><X size={24} className="text-slate-400 hover:text-red-500"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                            <RefreshCw className="animate-spin"/> Carregando...
                        </div>
                    ) : historyData.length === 0 ? (
                        <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                            <p>Nenhum registro de histórico encontrado.</p>
                            <p className="text-xs mt-1">(Verifique se a API /history retornou 404)</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {historyData.map((item: any) => (
                                <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 relative overflow-hidden">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.origem === 'MANUAL_ADMIN' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                    
                                    <div className="flex-1 pl-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg font-bold text-slate-800">{item.plano}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border uppercase ${item.status === 'ATIVO' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 flex flex-wrap gap-4 font-mono">
                                            <span className="flex items-center gap-1"><Clock size={12}/> Início: {item.dataInicio ? new Date(item.dataInicio).toLocaleDateString() : '-'}</span>
                                            {item.dataFim ? (
                                                <span>Fim: {new Date(item.dataFim).toLocaleDateString()}</span>
                                            ) : (
                                                <span className="text-green-600 font-bold">Vitalício</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="md:w-1/2 md:border-l border-t md:border-t-0 pl-0 md:pl-4 pt-4 md:pt-0 border-slate-100 flex flex-col justify-center">
                                        <div className="flex items-start gap-2">
                                            {item.origem === 'MANUAL_ADMIN' ? (
                                                <UserCog size={18} className="text-amber-600 mt-0.5 shrink-0"/>
                                            ) : (
                                                <CheckCircle size={18} className="text-blue-600 mt-0.5 shrink-0"/>
                                            )}
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    {item.origem === 'MANUAL_ADMIN' ? `Alterado por: ${item.adminNome}` : 'Via Sistema'}
                                                </p>
                                                <p className="text-sm text-slate-700 leading-snug italic bg-slate-50 p-2 rounded border border-slate-100">
                                                    "{item.justificativa}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* === MODAL DE JUSTIFICATIVA E SENHA (AUDITORIA) === */}
      {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm border-t-4 border-amber-500">
                  <div className="flex items-center gap-3 mb-4 text-amber-600">
                      <AlertTriangle size={28}/>
                      <h3 className="font-bold text-lg leading-tight">Auditoria de Alteração</h3>
                  </div>
                  
                  <p className="text-sm text-slate-600 mb-4">
                      Você está alterando manualmente o contrato de um cliente. Essa ação será registrada nos logs do sistema em seu nome.
                  </p>

                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Motivo da Alteração (Obrigatório)</label>
                          <textarea 
                              className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                              rows={3}
                              placeholder="Ex: Pagamento via PIX manual, Cortesia por erro..."
                              value={justificativa}
                              onChange={e => setJustificativa(e.target.value)}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Confirme com SUA Senha</label>
                          <div className="relative">
                              <input 
                                  type="password"
                                  className="w-full pl-8 p-2 border rounded text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                  placeholder="Sua senha de login..."
                                  value={adminPassword}
                                  onChange={e => setAdminPassword(e.target.value)}
                              />
                              <ShieldCheck className="absolute left-2.5 top-2.5 text-slate-400" size={14}/>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                      <button 
                          onClick={() => setShowConfirmModal(false)}
                          disabled={isProcessing}
                          className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded transition"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleConfirmChange}
                          disabled={isProcessing}
                          className="flex-1 py-2 bg-amber-500 text-white font-bold rounded hover:bg-amber-600 transition flex justify-center items-center gap-2"
                      >
                          {isProcessing ? 'Validando...' : 'Confirmar e Salvar'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE EDIÇÃO PRINCIPAL */}
      {editingUser && !showConfirmModal && (
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
                            <option value="SUSPENDED|DEFAULT" className="text-red-600 font-bold bg-red-50">⛔ SUSPENDER ACESSO / SEM PLANO</option>
                            <hr />
                            {(planosDisponiveis || []).map((p: any) => {
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
                        <button onClick={handlePreSaveUser} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 font-bold shadow-lg shadow-green-100 transition">
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
                            {cli.plano === 'SEM_PLANO' || cli.planoStatus === 'suspended' ? (
                                <span className="flex items-center gap-1 w-fit text-red-700 bg-red-50 px-2 py-1 rounded text-[10px] font-bold border border-red-200 uppercase">
                                    SUSPENSO ⛔
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 w-fit text-green-700 bg-green-50 px-2 py-1 rounded text-[10px] font-bold border border-green-200 uppercase">
                                    {cli.plano} {cli.planoCiclo === 'ANUAL' ? '(A)' : '(M)'}
                                </span>
                            )}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2 items-center">
                            {/* BOTÃO HISTÓRICO */}
                            <button 
                                onClick={() => abrirHistorico(cli)} 
                                className="text-slate-600 hover:bg-slate-100 p-2 border border-slate-200 rounded transition" 
                                title="Histórico de Assinaturas"
                            >
                                <History size={16}/>
                            </button>
                            
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