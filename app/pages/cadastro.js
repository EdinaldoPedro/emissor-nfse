import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Cadastro() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Processando...');
    setErro(false);

    try {
      const response = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        setMsg('Sucesso! Redirecionando para login...');
        setTimeout(() => router.push('/login'), 2000); // Manda pro login
      } else {
        setErro(true);
        setMsg(data.message || 'Erro ao cadastrar.');
      }
    } catch (err) {
      setErro(true);
      setMsg('Erro de conexão com o servidor.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Crie sua conta</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Nome Completo:</label>
          <input 
            type="text" 
            name="nome" 
            value={form.nome} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Email:</label>
          <input 
            type="email" 
            name="email" 
            value={form.email} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>Senha:</label>
          <input 
            type="password" 
            name="senha" 
            value={form.senha} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <button type="submit" style={{ width: '100%', padding: '10px', background: 'green', color: 'white', border: 'none', cursor: 'pointer' }}>
          Cadastrar Agora
        </button>
      </form>

      {msg && (
        <p style={{ color: erro ? 'red' : 'green', marginTop: '10px', textAlign: 'center' }}>
          {msg}
        </p>
      )}
    </div>
  );
}