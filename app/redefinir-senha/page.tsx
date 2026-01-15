'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [senha1, setSenha1] = useState('');
  const [senha2, setSenha2] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!token) {
    return (
        <div className="text-center">
            <AlertTriangle className="mx-auto text-red-500 mb-2" size={40}/>
            <h2 className="text-xl font-bold text-slate-800">Link Inválido</h2>
            <p className="text-slate-500 mt-2">O link de recuperação parece estar incompleto.</p>
            <Link href="/login" className="block mt-6 bg-slate-800 text-white py-2 rounded-lg">Ir para Login</Link>
        </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha1 !== senha2) return alert("As senhas não coincidem.");
    if (senha1.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

    setLoading(true);
    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword: senha1 })
        });
        
        if (res.ok) setStatus('success');
        else setStatus('error');
    } catch (e) { setStatus('error'); }
    finally { setLoading(false); }
  };

  if (status === 'success') {
      return (
        <div className="text-center py-8 animate-in fade-in zoom-in">
            <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Senha Alterada!</h2>
            <p className="text-slate-500 mb-6">Sua senha foi atualizada com sucesso.</p>
            <button onClick={() => router.push('/login')} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
              Fazer Login Agora
            </button>
        </div>
      );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
            <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                    type="password" required 
                    className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Mínimo 6 caracteres"
                    value={senha1} onChange={e => setSenha1(e.target.value)}
                />
            </div>
        </div>
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Nova Senha</label>
            <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                    type="password" required 
                    className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Repita a senha"
                    value={senha2} onChange={e => setSenha2(e.target.value)}
                />
            </div>
        </div>

        {status === 'error' && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded border border-red-200">
                O token expirou ou é inválido. Solicite uma nova recuperação.
            </div>
        )}

        <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
        >
            {loading ? <Loader2 className="animate-spin" /> : 'Salvar Nova Senha'}
        </button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Criar Nova Senha</h1>
        <Suspense fallback={<div className="text-center p-4">Carregando...</div>}>
            <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}