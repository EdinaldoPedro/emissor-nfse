'use client';

import { useEffect, useState } from 'react';
import { 
    Plus, Search, Edit, Trash2, MapPin, 
    User, Building2, Globe, Loader2, X, CheckCircle, 
    ArrowLeft, Save
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/app/contexts/DialogContext';
import { validarCPF } from '@/app/utils/cpf';

interface Cliente {
  id: string;
  nome: string;
  nomeFantasia?: string; 
  inscricaoMunicipal?: string; 
  email: string;
  documento: string;
  tipo: 'PJ' | 'PF' | 'EXT';
  cidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  codigoIbge?: string;
  pais?: string;
}

export default function MeusClientes() {
  const router = useRouter();
  const dialog = useDialog();
  
  // === ESTADOS DE DADOS ===
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // === ESTADOS DE CONTROLE VISUAL ===
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'SELECAO' | 'FORMULARIO'>('SELECAO');
  
  const [salvando, setSalvando] = useState(false);
  const [buscandoDados, setBuscandoDados] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  
  // === ESTADO DO FORMULÁRIO ===
  const [clienteAtual, setClienteAtual] = useState<Cliente>({ 
    id: '', nome: '', nomeFantasia: '', inscricaoMunicipal: '', 
    email: '', documento: '', cidade: '', uf: '', cep: '', 
    logradouro: '', numero: '', bairro: '', codigoIbge: '',
    tipo: 'PJ', pais: 'Brasil'
  });

  const isPJ = clienteAtual.tipo === 'PJ';

  // --- CARREGAMENTO ---
  const carregarClientes = async () => {
    setLoading(true);
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');
    const token = localStorage.getItem('token'); 

    if (!userId || !token) return;

    try {
      const res = await fetch('/api/clientes', { 
          headers: { 
              'x-user-id': userId, 
              'x-empresa-id': contextId || '',
              'Authorization': `Bearer ${token}` 
          } 
      });
      const dados = await res.json();
      
      if (Array.isArray(dados)) {
          setClientes(dados);
          setFilteredClientes(dados);
      }
    } catch (erro) { console.error(erro); } 
    finally { setLoading(false); }
  };

  useEffect(() => { carregarClientes(); }, []);

  useEffect(() => {
    if (!termoBusca) {
      setFilteredClientes(clientes);
    } else {
      const lower = termoBusca.toLowerCase();
      const filtrados = clientes.filter(c => 
        c.nome.toLowerCase().includes(lower) || 
        c.documento.includes(lower) || 
        (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(lower))
      );
      setFilteredClientes(filtrados);
    }
  }, [termoBusca, clientes]);

  // --- LÓGICA DO WIZARD ---
  const abrirNovoCadastro = () => {
    setClienteAtual({ 
        id: '', nome: '', nomeFantasia: '', inscricaoMunicipal: '', email: '', 
        documento: '', cidade: '', uf: '', cep: '', logradouro: '', 
        numero: '', bairro: '', codigoIbge: '', tipo: 'PJ', pais: 'Brasil' 
    });
    setModalStep('SELECAO');
    setIsFormOpen(true);
  }

  const selecionarTipo = (tipo: 'PJ' | 'PF' | 'EXT') => {
      setClienteAtual(prev => ({ 
          ...prev, 
          tipo,
          pais: tipo === 'EXT' ? '' : 'Brasil',
          documento: '' 
      }));
      setModalStep('FORMULARIO');
  };

  const abrirEdicao = (cliente: Cliente) => {
    setClienteAtual({ ...cliente, pais: cliente.pais || 'Brasil' });
    setModalStep('FORMULARIO'); 
    setIsFormOpen(true);
  }

  const voltarSelecao = () => {
    if (!clienteAtual.id) setModalStep('SELECAO');
  }

  // --- BUSCAS E VALIDAÇÕES ---
  
  // Verifica se o cliente já existe no banco (para CPF e CNPJ)
  const verificarClienteExistente = async (doc: string) => {
        setBuscandoDados(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/clientes/check', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ documento: doc })
            });
            
            if (res.ok) {
                const dados = await res.json();
                if (dados) {
                    setClienteAtual(prev => ({ ...prev, ...dados }));
                    dialog.showAlert({ type: 'info', title: 'Cliente Encontrado', description: 'Os dados foram carregados da sua base.' });
                    return true;
                }
            }
        } catch (e) { console.error(e); }
        finally { setBuscandoDados(false); }
        return false;
    };

  // Busca CNPJ na API Externa
  const executarBuscaCNPJ = async (cnpjLimpo: string) => {
      setBuscandoDados(true);
      const token = localStorage.getItem('token');
      try {
          const res = await fetch('/api/external/cnpj', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ cnpj: cnpjLimpo })
          });
          const dados = await res.json();
          if (res.ok) {
              setClienteAtual(prev => ({
                  ...prev,
                  nome: dados.razaoSocial, nomeFantasia: dados.nomeFantasia,
                  email: dados.email, cep: dados.cep,
                  logradouro: dados.logradouro, numero: dados.numero,
                  bairro: dados.bairro, cidade: dados.cidade, uf: dados.uf,
                  codigoIbge: dados.codigoIbge
              }));
              dialog.showAlert({ type: 'success', description: 'Dados carregados da Receita!' });
          } else { 
              dialog.showAlert("CNPJ não encontrado na Receita."); 
          }
      } catch (e) { } 
      finally { setBuscandoDados(false); }
  };

  const handleDocumentoChange = async (val: string) => {
      if (clienteAtual.tipo === 'EXT') {
          setClienteAtual(prev => ({ ...prev, documento: val }));
          return;
      }

      let v = val.replace(/\D/g, '');
      const rawLength = v.length;

      // Máscara
      let documentoFormatado = v;
      if (clienteAtual.tipo === 'PF') {
          if (v.length <= 11) {
            documentoFormatado = v.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
          }
      } else {
          if (v.length <= 14) {
            documentoFormatado = v.slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
          }
      }

      setClienteAtual(prev => ({ ...prev, documento: documentoFormatado }));

      // === AUTOMAÇÃO PF (11 Dígitos) ===
      if (clienteAtual.tipo === 'PF' && rawLength === 11) {
          if (!validarCPF(documentoFormatado)) {
               dialog.showAlert({ type: 'warning', title: 'CPF Inválido', description: 'Verifique os números digitados.' });
               return;
          }
          await verificarClienteExistente(v);
      }

      // === AUTOMAÇÃO PJ (14 Dígitos) ===
      if (clienteAtual.tipo === 'PJ' && rawLength === 14) {
          const achouInterno = await verificarClienteExistente(v);
          if (!achouInterno) {
              executarBuscaCNPJ(v);
          }
      }
  };

  const handleBuscarCep = async () => {
      if (clienteAtual.tipo === 'EXT') return;
      const cepLimpo = clienteAtual.cep?.replace(/\D/g, '');
      if (!cepLimpo || cepLimpo.length !== 8) return; 

      setBuscandoDados(true);
      try {
          const res = await fetch('/api/external/cep', { method: 'POST', body: JSON.stringify({ cep: cepLimpo }) });
          const dados = await res.json();
          if (res.ok) {
              setClienteAtual(prev => ({
                  ...prev,
                  logradouro: dados.logradouro, bairro: dados.bairro,
                  cidade: dados.cidade || dados.localidade, uf: dados.uf,
                  codigoIbge: dados.codigoIbge
              }));
          }
      } catch (e) { } finally { setBuscandoDados(false); }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAtual.nome) return dialog.showAlert("Nome é obrigatório.");
    
    setSalvando(true);
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');
    const token = localStorage.getItem('token');

    try {
      const metodo = clienteAtual.id ? 'PUT' : 'POST';
      const res = await fetch('/api/clientes', {
        method: metodo,
        headers: { 
            'Content-Type': 'application/json', 
            'x-user-id': userId || '', 
            'x-empresa-id': contextId || '',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(clienteAtual)
      });

      if (res.ok) {
        dialog.showAlert({ type: 'success', description: 'Salvo com sucesso!' });
        setIsFormOpen(false);
        carregarClientes();
      } else { 
          const err = await res.json();
          dialog.showAlert({ type: 'danger', description: err.error || 'Erro ao salvar.' }); 
      }
    } catch (error) { dialog.showAlert("Erro de conexão."); } 
    finally { setSalvando(false); }
  };

  const handleExcluir = async (id: string) => {
    if (!await dialog.showConfirm({ type: 'danger', title: 'Excluir?', description: 'Confirmar exclusão?' })) return;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const contextId = localStorage.getItem('empresaContextId');

    await fetch(`/api/clientes?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '', 'x-empresa-id': contextId || '', 'Authorization': `Bearer ${token}` }
    });
    carregarClientes();
  };

  // Classes utilitárias para reutilização
  const labelClass = "block text-xs font-bold text-slate-500 mb-1 uppercase";
  const inputClass = "w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm text-slate-700";

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* CABEÇALHO */}
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/cliente/dashboard')} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><User className="text-blue-600"/> Meus Clientes</h1>
                    <p className="text-slate-500 text-sm">Gerencie tomadores PF e PJ.</p>
                </div>
            </div>
            
            <button onClick={abrirNovoCadastro} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium shadow-md">
                <Plus size={20} /> Novo Cliente
            </button>
        </div>

        {/* MODAL */}
        {isFormOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                    
                    {/* Header do Modal */}
                    <div className="flex justify-between items-center p-6 border-b bg-white z-10">
                        <div className="flex items-center gap-3">
                            {/* Botão voltar só aparece se for formulario de novo cadastro */}
                            {modalStep === 'FORMULARIO' && !clienteAtual.id && (
                                <button onClick={voltarSelecao} className="text-slate-400 hover:text-blue-600"><ArrowLeft size={20}/></button>
                            )}
                            <h3 className="font-bold text-lg text-slate-800">
                                {modalStep === 'SELECAO' ? 'Novo Cliente' : clienteAtual.id ? 'Editar Cliente' : `Novo - ${clienteAtual.tipo === 'EXT' ? 'Exterior' : clienteAtual.tipo}`}
                            </h3>
                        </div>
                        <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24} /></button>
                    </div>
            
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        
                        {/* --- ETAPA 1: SELEÇÃO --- */}
                        {modalStep === 'SELECAO' && (
                            <div className="space-y-6 py-4">
                                <p className="text-center text-slate-500">Selecione o tipo de cliente que deseja cadastrar:</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button onClick={() => selecionarTipo('PJ')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition gap-3 group h-40">
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition"><Building2 size={24}/></div>
                                        <span className="font-bold text-slate-700">Pessoa Jurídica</span>
                                        <span className="text-xs text-slate-400">CNPJ</span>
                                    </button>
                                    
                                    <button onClick={() => selecionarTipo('PF')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition gap-3 group h-40">
                                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition"><User size={24}/></div>
                                        <span className="font-bold text-slate-700">Pessoa Física</span>
                                        <span className="text-xs text-slate-400">CPF</span>
                                    </button>

                                    <button onClick={() => selecionarTipo('EXT')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition gap-3 group h-40">
                                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition"><Globe size={24}/></div>
                                        <span className="font-bold text-slate-700">Exterior</span>
                                        <span className="text-xs text-slate-400">Internacional</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- ETAPA 2: FORMULÁRIO --- */}
                        {modalStep === 'FORMULARIO' && (
                            <form onSubmit={handleSalvar} className="space-y-6 animate-in slide-in-from-right-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>
                                            {clienteAtual.tipo === 'PJ' ? 'CNPJ' : clienteAtual.tipo === 'PF' ? 'CPF' : 'NIF / Documento'}
                                        </label>
                                        <div className="relative">
                                            <input 
                                                className={`${inputClass} font-mono pr-10`}
                                                value={clienteAtual.documento || ''} 
                                                onChange={e => handleDocumentoChange(e.target.value)}
                                                placeholder={clienteAtual.tipo === 'EXT' ? 'Opcional para exterior' : 'Apenas números'}
                                                maxLength={clienteAtual.tipo === 'EXT' ? 20 : 18}
                                            />
                                            {buscandoDados && (
                                                <div className="absolute right-3 top-3 text-blue-500">
                                                    <Loader2 className="animate-spin" size={20}/>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Email</label>
                                        <input type="email" placeholder="email@cliente.com" className={inputClass}
                                            value={clienteAtual.email || ''} onChange={e => setClienteAtual({...clienteAtual, email: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className={`grid grid-cols-1 ${isPJ ? 'md:grid-cols-2' : ''} gap-6`}>
                                    <div>
                                        <label className={labelClass}>
                                            {isPJ ? 'Razão Social' : 'Nome Completo'}
                                        </label>
                                        <input 
                                            required 
                                            className={inputClass}
                                            value={clienteAtual.nome} 
                                            onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})}
                                        />
                                    </div>
                                    
                                    {isPJ && (
                                        <div>
                                            <label className={labelClass}>Nome Fantasia</label>
                                            <input className={inputClass}
                                                value={clienteAtual.nomeFantasia || ''} onChange={e => setClienteAtual({...clienteAtual, nomeFantasia: e.target.value})}
                                            />
                                        </div>
                                    )}
                                </div>

                                {isPJ && (
                                    <div>
                                        <label className={labelClass}>Inscrição Municipal (Opcional)</label>
                                        <input placeholder="Ex: 12345" className={inputClass}
                                            value={clienteAtual.inscricaoMunicipal || ''} onChange={e => setClienteAtual({...clienteAtual, inscricaoMunicipal: e.target.value})}
                                        />
                                    </div>
                                )}

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative">
                                    <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2">
                                        <MapPin size={16}/> Endereço {clienteAtual.tipo === 'EXT' && '(Exterior)'}
                                    </h4>
                                    {buscandoDados && <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-blue-600"><Loader2 className="animate-spin" size={14}/> Buscando...</div>}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {clienteAtual.tipo === 'EXT' && (
                                            <div className="md:col-span-3">
                                                <label className={labelClass}>País</label>
                                                <input className={`${inputClass} bg-yellow-50`} 
                                                    placeholder="Ex: Estados Unidos"
                                                    value={clienteAtual.pais} onChange={e => setClienteAtual({...clienteAtual, pais: e.target.value})}
                                                />
                                            </div>
                                        )}

                                        <div className="md:col-span-1">
                                            <label className={labelClass}>{clienteAtual.tipo === 'EXT' ? 'Zip Code' : 'CEP'}</label>
                                            <input required className={`${inputClass} font-bold text-blue-700`}
                                                value={clienteAtual.cep || ''} 
                                                onChange={e => setClienteAtual({...clienteAtual, cep: e.target.value})}
                                                onBlur={handleBuscarCep}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Logradouro</label>
                                            <input className={inputClass}
                                                value={clienteAtual.logradouro || ''} onChange={e => setClienteAtual({...clienteAtual, logradouro: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Número</label>
                                            <input required placeholder="Nº" className={inputClass}
                                                value={clienteAtual.numero || ''} onChange={e => setClienteAtual({...clienteAtual, numero: e.target.value})}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Bairro</label>
                                            <input className={inputClass}
                                                value={clienteAtual.bairro || ''} onChange={e => setClienteAtual({...clienteAtual, bairro: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Cidade</label>
                                            <input className={inputClass}
                                                value={clienteAtual.cidade || ''} onChange={e => setClienteAtual({...clienteAtual, cidade: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{clienteAtual.tipo === 'EXT' ? 'Província/Estado' : 'UF'}</label>
                                            <input className={inputClass}
                                                value={clienteAtual.uf || ''} onChange={e => setClienteAtual({...clienteAtual, uf: e.target.value})} maxLength={clienteAtual.tipo === 'EXT' ? 50 : 2}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Footer do Modal (Só aparece no formulário) */}
                    {modalStep === 'FORMULARIO' && (
                        <div className="flex justify-end gap-3 p-6 border-t bg-white">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Cancelar</button>
                            <button onClick={handleSalvar} disabled={salvando} className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-lg shadow-green-100 flex items-center gap-2">
                                {salvando ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18} /> Salvar</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* LISTAGEM (MANTIDA IGUAL AO ORIGINAL) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Buscar por nome ou documento..."
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Documento</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Localização</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Carregando...</td></tr>
                        ) : filteredClientes.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>
                        ) : (
                            filteredClientes.map((cliente) => (
                                <tr key={cliente.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{cliente.nome}</div>
                                        {cliente.nomeFantasia && <div className="text-xs text-slate-500">{cliente.nomeFantasia}</div>}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                        {cliente.documento || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold border w-fit flex items-center gap-1 ${
                                            cliente.tipo === 'PJ' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                            cliente.tipo === 'PF' ? 'bg-green-100 text-green-800 border-green-200' :
                                            'bg-purple-100 text-purple-800 border-purple-200'
                                        }`}>
                                            {cliente.tipo === 'EXT' ? <Globe size={10}/> : cliente.tipo === 'PJ' ? <Building2 size={10}/> : <User size={10}/>}
                                            {cliente.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {cliente.cidade ? `${cliente.cidade}/${cliente.uf}` : <span className="text-slate-300 italic">--</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => abrirEdicao(cliente)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={18}/></button>
                                        <button onClick={() => handleExcluir(cliente.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}