
export default function ClienteDashboard() {
  return (
    <div className="min-h-screen bg-white p-8">
      <header className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Painel do Cliente</h1>
          <p className="text-gray-500">Bem-vindo à sua área exclusiva.</p>
        </div>
        <a href="/login" className="text-red-500 text-sm hover:underline">Sair</a>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Botão de Emitir Nota */}
        <div className="p-6 border rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer transition shadow-sm">
          <h2 className="text-xl font-bold text-blue-700 mb-2">🚀 Emitir Nova Nota</h2>
          <p className="text-sm text-blue-600">Clique aqui para preencher e gerar uma NFS-e.</p>
        </div>

        {/* Botão de Histórico */}
        <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer transition shadow-sm">
          <h2 className="text-xl font-bold text-gray-700 mb-2">📂 Minhas Notas</h2>
          <p className="text-sm text-gray-500">Consulte e baixe as notas que você já emitiu.</p>
        </div>
      </div>
    </div>
  );
}