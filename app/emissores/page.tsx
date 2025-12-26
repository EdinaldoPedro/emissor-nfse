'use client';
import { useEffect, useState } from 'react';
import { Server, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ListaEmissores() {
  const [emissores, setEmissores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CORREÇÃO: Agora aponta para a rota padronizada 'emissoes'
    fetch('/api/admin/emissoes')
      .then(r => r.json())
      .then(data => {
        setEmissores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if(loading) return <div className="p-8 text-center text-gray-500">Carregando painel de emissões...</div>;

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
            <div className="p-8 bg-white rounded-xl shadow-sm text-center text-gray-400">
                Nenhuma empresa emissora ativa no momento.
                <br/><span className="text-xs">Cadastre um certificado ou emita uma nota para aparecer aqui.</span>
            </div>
        ) : (
            emissores.map(emp => (
                <Link key={emp.id} href={`/admin/emissoes/${emp.id}`}>
                    <div className="bg-white p-6 rounded-xl shadow-sm border hover:border-blue-400 transition cursor-pointer group">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${emp.certificadoA1 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                    <Server size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition">{emp.razaoSocial}</h3>
                                    <p className="text-xs text-slate-500 font-mono">CNPJ: {emp.documento} | IBGE: {emp.codigoIbge || 'N/A'}</p>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-center">
                                        <p className="font-bold text-slate-800 text-lg">{emp._count.notasEmitidas}</p>
                                        <p className="text-xs text-slate-500">Notas</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`font-bold text-lg ${emp.errosRecentes > 0 ? 'text-red-600' : 'text-gray-400'}`}>{emp.errosRecentes}</p>
                                        <p className="text-xs text-slate-500">Erros (24h)</p>
                                    </div>
                                    <div className="pl-4 border-l">
                                        <ArrowRight className="text-gray-300 group-hover:text-blue-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                             {emp.certificadoA1 ? (
                                 <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded border border-green-200">
                                     <CheckCircle size={10} /> Certificado Ativo
                                 </span>
                             ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-200">
                                     <AlertTriangle size={10} /> Sem Certificado
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