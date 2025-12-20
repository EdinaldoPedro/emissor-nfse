export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Visão Geral</h2>
      
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Faturamento (Mês)</p>
          <p className="text-3xl font-bold text-slate-900">R$ 12.450,00</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Notas Emitidas</p>
          <p className="text-3xl font-bold text-blue-600">42</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Plano Atual</p>
          <p className="text-xl font-bold text-green-600">Pro Mensal</p>
        </div>
      </div>

      {/* Lista Recente (Placeholder) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Últimas Notas Emitidas</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Data</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">Empresa XYZ Ltda</td>
              <td className="px-6 py-4">R$ 1.200,00</td>
              <td className="px-6 py-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">Autorizada</span></td>
              <td className="px-6 py-4">20/12/2024</td>
            </tr>
            {/* Mais linhas viriam aqui dinamicamente */}
          </tbody>
        </table>
      </div>
    </div>
  );
}