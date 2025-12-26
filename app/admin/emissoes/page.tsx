'use client';
import { useEffect, useState } from 'react';
import { Server, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ListaEmissores() {
  const [emissores, setEmissores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Busca na API correta de monitoramento
    fetch('/api/admin/emissoes')
      .then(async (r) => {
        if (!r.ok) throw new Error('Falha ao buscar emissores');
        return r.json();
      })
      .then(data => {
        setEmissores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Não foi possível carregar a lista de monitoramento.');
        setLoading(false);
      });
  }, []);

  if(loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 className="animate-spin mb-2" size={32}/>
        <p>Carregando painel de emissões...</p>
    </div>
  );

  if(error) return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg m-6 border border-red-200">
          <AlertTriangle className="mx-auto mb-2" size={32}/>
          <p>{error}</p>
      </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Central de Emissões</h1>
            <p className="text-sm text-slate-500">Monitoramento técnico de empresas emissoras.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {emissores.length === 0 ? (
            <div className="p-12 bg-white rounded-xl shadow-sm text-center border border-dashed border-gray-300">
                <Server className="mx-auto text-gray-300 mb-4" size={48}/>
                <h3 className="text-lg font-bold text-gray-600">Nenhuma empresa ativa</h3>
                <p className="text-sm text-gray-400 mt-1">
                    Cadastre um certificado digital ou emita uma nota para a empresa aparecer aqui.
                </p>
            </div>
        ) : (
            emissores.map(emp => (
                <Link key={emp.id} href={`/admin/emissoes/${emp.id}`}>
                    <div className="bg-white p-6 rounded-xl shadow-sm border hover:border-blue-400 transition cursor-pointer group relative overflow-hidden">
                        {/* Indicador lateral de status (Vermelho se teve erro recente) */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${emp.errosRecentes > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>

                        <div className="flex justify-between items-start pl-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${emp.certificadoA1 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                    <Server size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition">{emp.razaoSocial}</h3>
                                    <p className="text-xs text-slate-500 font-mono flex gap-2">
                                        <span>CNPJ: {emp.documento}</span>
                                        {emp.codigoIbge && <span>• IBGE: {emp.codigoIbge}</span>}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="text-right flex items-center gap-6">
                                <div className="text-center">
                                    <p className="font-bold text-slate-800 text-xl">{emp._count?.notasEmitidas || 0}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Notas</p>
                                </div>
                                <div className="text-center">
                                    <p className={`font-bold text-xl ${emp.errosRecentes > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                        {emp.errosRecentes || 0}
                                    </p>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Erros 24h</p>
                                </div>
                                <ArrowRight className="text-gray-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-1" />
                            </div>
                        </div>
                        
                        <div className="mt-4 pl-4 flex gap-2">
                             {emp.certificadoA1 ? (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded border border-green-200">
                                     <CheckCircle size={10} /> Certificado OK
                                 </span>
                             ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold rounded border border-orange-200">
                                     <AlertTriangle size={10} /> Certificado Pendente
                                 </span>
                             )}
                        </div>
                    </div>
                </Link>
            ))
        )}
      </div>
    </div>
  );
}