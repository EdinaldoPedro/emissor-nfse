export default function ClienteDashboard() {
  return (
    <div className="min-h-screen bg-white p-8">
      <header className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Olá, Cliente!</h1>
          <p className="text-gray-500">Bem-vindo ao seu emissor de notas.</p>
        </div>
        <button className="text-red-500 text-sm hover:underline">Sair</button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer transition">
          <h2 className="text-xl font-bold text-blue-700 mb-2">🚀 Emitir Nova Nota</h2>
          <p className="text-sm text-blue-600">Clique aqui para gerar uma NFS-e agora.</p>
        </div>

        <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
          <h2 className="text-xl font-bold text-gray-700 mb-2">📂 Histórico de Notas</h2>
          <p className="text-sm text-gray-500">Veja e baixe suas notas emitidas.</p>
        </div>
      </div>
    </div>
  );
}