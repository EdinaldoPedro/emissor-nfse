'use client'; 

import { useState } from 'react';
import { useRouter } from 'next/navigation'; 
import { validarCPF } from '@/app/utils/cpf'; 
import { CheckCircle, AlertTriangle, Loader2, User, Mail, Lock, FileText, ArrowRight, KeyRound, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function Cadastro() {
  const router = useRouter();
  
  const [step, setStep] = useState(1); // 1 = Form, 2 = Validação
  
  // Adicionados os campos de confirmação
  const [form, setForm] = useState({ 
      nome: '', 
      email: '', 
      confirmEmail: '', 
      senha: '', 
      confirmSenha: '', 
      cpf: '' 
  });
  const [code, setCode] = useState('');
  
  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmSenha, setShowConfirmSenha] = useState(false);

  // === VALIDAÇÕES EM TEMPO REAL ===
  const validateField = (name: string, value: string, currentForm: any) => {
    let error = '';
    
    if (name === 'nome') {
        const regexNome = /^[a-zA-ZÀ-ÿ\s^~]+$/;
        if (value.length > 0 && value.trim().length < 15) error = 'Mínimo 15 caracteres.';
        else if (value.length > 0 && !regexNome.test(value)) error = 'Apenas letras e acentos permitidos.';
    }

    if (name === 'senha') {
        const isSenhaForte = value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
        if (value.length > 0 && !isSenhaForte) {
            error = 'Mín. 8 caracteres, 1 maiúscula, 1 número e 1 especial.';
        }
    }
    
    // CORREÇÃO: Agora o sistema LIMPA o erro do campo atual assim que ele fica válido!
    if (error) {
        setErrors((prev: any) => ({ ...prev, [name]: error }));
    } else {
        setErrors((prev: any) => ({ ...prev, [name]: '' }));
    }

    // Validação cruzada: E-mail e Confirmação de E-mail
    if (name === 'email' || name === 'confirmEmail') {
        const emailToCompare = name === 'email' ? value : currentForm.email;
        const confirmToCompare = name === 'confirmEmail' ? value : currentForm.confirmEmail;
        
        if (confirmToCompare.length > 0 && emailToCompare !== confirmToCompare) {
            setErrors((prev: any) => ({ ...prev, confirmEmail: 'Os e-mails não coincidem.' }));
        } else {
            setErrors((prev: any) => ({ ...prev, confirmEmail: '' }));
        }
    }

    // Validação cruzada: Senha e Confirmação de Senha
    if (name === 'senha' || name === 'confirmSenha') {
        const senhaToCompare = name === 'senha' ? value : currentForm.senha;
        const confirmToCompare = name === 'confirmSenha' ? value : currentForm.confirmSenha;
        
        if (confirmToCompare.length > 0 && senhaToCompare !== confirmToCompare) {
            setErrors((prev: any) => ({ ...prev, confirmSenha: 'As senhas não coincidem.' }));
        } else {
            setErrors((prev: any) => ({ ...prev, confirmSenha: '' }));
        }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);
    // Passamos o formulário atualizado para garantir que a comparação da validação funciona
    validateField(name, value, updatedForm);
    setServerError('');
  };

  // === MÁSCARA E VALIDAÇÃO DE CPF ===
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    setForm({ ...form, cpf: value });
    setErrors((prev: any) => ({ ...prev, cpf: '' }));
  };

  const checkCpfExist = async () => {
      if (!form.cpf) return;
      if (!validarCPF(form.cpf)) {
          setErrors((prev: any) => ({ ...prev, cpf: 'CPF inválido.' }));
          return;
      }
      
      // Verifica no BD se já existe
      try {
          const res = await fetch('/api/auth/check', {
              method: 'POST', body: JSON.stringify({ cpf: form.cpf })
          });
          const data = await res.json();
          if (data.errors?.cpf) setErrors((prev: any) => ({ ...prev, cpf: data.errors.cpf }));
      } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação Final antes de enviar
    if (errors.nome || errors.senha || errors.cpf || errors.confirmEmail || errors.confirmSenha) return;
    if (form.nome.length < 15) { setErrors((p:any) => ({...p, nome: 'Mínimo 15 caracteres.'})); return; }
    
    // Dupla verificação de segurança no submit
    if (form.email !== form.confirmEmail) { 
        setErrors((p:any) => ({...p, confirmEmail: 'Os e-mails não coincidem.'})); 
        return; 
    }
    if (form.senha !== form.confirmSenha) { 
        setErrors((p:any) => ({...p, confirmSenha: 'As senhas não coincidem.'})); 
        return; 
    }
    
    setLoading(true);
    setServerError('');

    // Removemos os campos de confirmação antes de enviar para a API (o backend não precisa deles)
    const { confirmEmail, confirmSenha, ...dadosParaEnviar } = form;

    try {
      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosParaEnviar),
      });

      const data = await res.json();

      if (res.ok) {
        setStep(2); // Avança para tela de código
      } else {
        setServerError(data.error || 'Erro ao cadastrar.');
      }
    } catch (err) {
      setServerError('Erro de conexão com o servidor.');
    } finally {
        setLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const res = await fetch('/api/auth/confirm-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: form.email, code })
          });
          const data = await res.json();
          
          if (res.ok) {
              // Login automático
              localStorage.setItem('token', data.token);
              localStorage.setItem('userId', data.user.id);
              localStorage.setItem('userRole', data.user.role);
              router.push('/cliente/dashboard');
          } else {
              setServerError(data.error || "Código inválido");
          }
      } catch (e) { setServerError("Erro de conexão."); }
      finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-blue-600 p-6 text-center">
            <h2 className="text-2xl font-bold text-white">
                {step === 1 ? 'Criar Nova Conta' : 'Verificação de Segurança'}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
                {step === 1 ? 'Preencha seus dados para começar' : `Enviamos um código para ${form.email}`}
            </p>
        </div>

        <div className="p-8">
            {serverError && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                    <AlertTriangle size={16}/> {serverError}
                </div>
            )}

            {step === 1 ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-400" size={20}/>
                            <input 
                                type="text" name="nome" required
                                className={`w-full pl-10 p-3 border rounded-lg outline-none focus:ring-2 transition ${errors.nome ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'}`}
                                placeholder="Seu nome completo"
                                value={form.nome} onChange={handleChange}
                            />
                        </div>
                        {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-slate-400" size={20}/>
                            <input 
                                type="text" name="cpf" required
                                className={`w-full pl-10 p-3 border rounded-lg outline-none focus:ring-2 transition ${errors.cpf ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'}`}
                                placeholder="000.000.000-00"
                                value={form.cpf} onChange={handleCpfChange} onBlur={checkCpfExist}
                            />
                        </div>
                        {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
                    </div>

                    {/* GRUPO DE E-MAIL */}
                    <div className="grid grid-cols-1 gap-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={20}/>
                                <input 
                                    type="email" name="email" required
                                    className="w-full pl-10 p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition"
                                    placeholder="seu@email.com"
                                    value={form.email} onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirme seu E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={20}/>
                                <input 
                                    type="email" name="confirmEmail" required
                                    className={`w-full pl-10 p-3 border rounded-lg outline-none focus:ring-2 transition ${errors.confirmEmail ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'}`}
                                    placeholder="Repita seu e-mail"
                                    value={form.confirmEmail} onChange={handleChange}
                                />
                            </div>
                            {errors.confirmEmail && <p className="text-xs text-red-500 mt-1">{errors.confirmEmail}</p>}
                        </div>
                    </div>

                    {/* GRUPO DE SENHA */}
                    <div className="grid grid-cols-1 gap-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={20}/>
                                <input 
                                    type={showSenha ? "text" : "password"} 
                                    name="senha" required
                                    className={`w-full pl-10 pr-10 p-3 border rounded-lg outline-none focus:ring-2 transition ${errors.senha ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'}`}
                                    placeholder="••••••••"
                                    value={form.senha} onChange={handleChange}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowSenha(!showSenha)}
                                    className="absolute right-3 top-3 text-slate-400 hover:text-blue-600 transition"
                                >
                                    {showSenha ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>
                            {errors.senha && <p className="text-xs text-red-500 mt-1">{errors.senha}</p>}
                            <p className="text-[10px] text-slate-400 mt-1">Mín. 8 caracteres, 1 maiúscula, 1 número e 1 símbolo.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirme sua Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={20}/>
                                <input 
                                    type={showConfirmSenha ? "text" : "password"} 
                                    name="confirmSenha" required
                                    className={`w-full pl-10 pr-10 p-3 border rounded-lg outline-none focus:ring-2 transition ${errors.confirmSenha ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'}`}
                                    placeholder="Repita sua senha"
                                    value={form.confirmSenha} onChange={handleChange}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfirmSenha(!showConfirmSenha)}
                                    className="absolute right-3 top-3 text-slate-400 hover:text-blue-600 transition"
                                >
                                    {showConfirmSenha ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>
                            {errors.confirmSenha && <p className="text-xs text-red-500 mt-1">{errors.confirmSenha}</p>}
                        </div>
                    </div>

                    <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2 mt-4">
                        {loading ? <Loader2 className="animate-spin"/> : 'Continuar'} <ArrowRight size={20}/>
                    </button>
                </form>
            ) : (
                <form onSubmit={handleConfirmCode} className="space-y-6 text-center animate-in fade-in slide-in-from-right-8">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-600">
                        <KeyRound size={32}/>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Digite o código de 6 dígitos</label>
                        <input 
                            className="w-full p-4 text-center text-3xl font-mono tracking-widest border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none transition"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g,''))}
                            placeholder="000000"
                        />
                    </div>

                    <button disabled={loading || code.length < 6} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? <Loader2 className="animate-spin"/> : <><CheckCircle size={20}/> Confirmar Cadastro</>}
                    </button>
                    
                    <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-blue-600 underline">
                        Corrigir meus dados
                    </button>
                </form>
            )}

            {step === 1 && (
                <div className="mt-8 text-center border-t pt-4">
                    <p className="text-sm text-slate-500">
                        Já tem uma conta? <Link href="/login" className="text-blue-600 font-bold hover:underline">Fazer Login</Link>
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}