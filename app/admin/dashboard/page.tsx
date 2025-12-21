export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Painel Administrativo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Clientes */}
        <a href="/admin/clientes" className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition">
          <h2 className="text-xl font-semibold text-blue-600">Gerenciar Clientes</h2>
          <p className="text-gray-600 mt-2">Ver lista completa, aprovar cadastros e editar.</p>
        </a>

        {/* Card 2: Financeiro (Futuro) */}
        <div className="p-6 bg-white rounded-lg shadow opacity-50 cursor-not-allowed">
          <h2 className="text-xl font-semibold text-gray-400">Financeiro</h2>
          <p className="text-gray-500 mt-2">Controle de mensalidades (Em breve).</p>
        </div>

        {/* Card 3: Suporte (Futuro) */}
        <div className="p-6 bg-white rounded-lg shadow opacity-50 cursor-not-allowed">
          <h2 className="text-xl font-semibold text-gray-400">Suporte</h2>
          <p className="text-gray-500 mt-2">Chamados em aberto (Em breve).</p>
        </div>
      </div>
    </div>
  );
}