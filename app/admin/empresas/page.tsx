'use client';
import { useEffect, useState } from 'react';
import { Search, Building2, Edit, Save, MapPin } from 'lucide-react';

export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [term, setTerm] = useState('');
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/empresas').then(r => r.json()).then(setEmpresas);
  }, []);

  const handleSave = async () => {
    try {
        const res = await fetch('/api/admin/empresas', {
            method: 'PUT',
            body: JSON.stringify(editing)
        });
        if(res.ok) {
            setEditing(null);
            fetch('/api/admin/empresas').then(r => r.json()).then(setEmpresas);
            alert("Dados da empresa atualizados!");
        }
    } catch(e) { alert("Erro"); }
  }

  const filtered = empresas.filter(e => 
    e.razaoSocial.toLowerCase().includes(term.toLowerCase()) || 
    e.documento.includes(term)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Manutenção de Empresas (BD)</h1>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
                placeholder="CNPJ ou Razão Social..." 
                className="pl-10 p-2 border rounded-lg w-64 focus:outline-blue-500"
                onChange={e => setTerm(e.target.value)}
            />
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editing && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Building2 /> Editar Dados da Empresa</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase">Razão Social</label>
                          <input className="w-full p-2 border rounded" value={editing.razaoSocial} onChange={e => setEditing({...editing, razaoSocial: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">CNPJ (Documento)</label>
                          <input className="w-full p-2 border rounded bg-gray-100" value={editing.documento} disabled />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">Regime Tributário</label>
                          <select className="w-full p-2 border rounded" value={editing.regimeTributario} onChange={e => setEditing({...editing, regimeTributario: e.target.value})}>
                              <option value="MEI">MEI</option>
                              <option value="SIMPLES">Simples Nacional</option>
                              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">Cidade</label>
                          <input className="w-full p-2 border rounded" value={editing.cidade} onChange={e => setEditing({...editing, cidade: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">Código IBGE</label>
                          <input className="w-full p-2 border rounded" value={editing.codigoIbge} onChange={e => setEditing({...editing, codigoIbge: e.target.value})} />
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                      <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                          <Save size={16} /> Atualizar Banco de Dados
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4 font-semibold text-slate-600">Empresa</th>
                    <th className="p-4 font-semibold text-slate-600">Dono (User)</th>
                    <th className="p-4 font-semibold text-slate-600">Localização</th>
                    <th className="p-4 font-semibold text-slate-600 text-right">Manutenção</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50 transition">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{emp.razaoSocial}</p>
                            <p className="text-slate-500 text-xs font-mono">{emp.documento}</p>
                        </td>
                        <td className="p-4">
                            {emp.donoUser ? (
                                <span className="text-blue-600 font-medium">{emp.donoUser.nome}</span>
                            ) : (
                                <span className="text-slate-400 italic">Vinculada como Cliente</span>
                            )}
                        </td>
                        <td className="p-4 text-gray-600">
                            <div className="flex items-center gap-1">
                                <MapPin size={14} className="text-gray-400"/> {emp.cidade}/{emp.uf}
                            </div>
                        </td>
                        <td className="p-4 text-right">
                            <button 
                                onClick={() => setEditing(emp)}
                                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 p-2 rounded transition border border-transparent hover:border-blue-100"
                                title="Editar dados brutos"
                            >
                                <Edit size={18} />
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