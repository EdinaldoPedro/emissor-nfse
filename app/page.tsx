import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-600">NFSe Facil</div>
        <nav className="space-x-4">
          <Link href="/login" className="text-slate-600 hover:text-blue-600">Login</Link>
          <Link href="/cadastro" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Começar Grátis
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900 mb-6">
          Emita Notas Fiscais Nacionais <br /> <span className="text-blue-600">sem dor de cabeça</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          O sistema ideal para prestadores de serviço e MEIs. Simples, rápido e integrado ao novo Portal Nacional.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/cadastro" className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition">
            Criar Conta Agora <ArrowRight size={20} />
          </Link>
        </div>

        {/* Features Simples */}
        <div className="grid md:grid-cols-3 gap-8 mt-20 text-left">
          {[
            "Emissão Ilimitada",
            "Envio por Email/WhatsApp",
            "Gestão de Clientes",
            "Suporte Web e Mobile",
            "Backup Automático",
            "Certificado A1"
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-slate-100">
              <CheckCircle className="text-green-500" size={20} />
              <span className="font-medium text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}