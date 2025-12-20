"use client";

import { useState } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck } from "lucide-react";

export default function EmitirNotaPage() {
  const [step, setStep] = useState(1);
  
  // Estado Unificado da Nota Fiscal
  const [nfData, setNfData] = useState({
    cliente: "",
    servicoDescricao: "",
    valor: "",
    retencoes: false
  });

  // Cálculo simulado de imposto (Ex: 6% Simples Nacional)
  const valorNumerico = parseFloat(nfData.valor) || 0;
  const impostoEstimado = valorNumerico * 0.06;
  const valorLiquido = nfData.retencoes ? valorNumerico - impostoEstimado : valorNumerico;

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-8">Emitir Nova NFS-e</h2>

      {/* Indicador de Passos */}
      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
        {[
          { id: 1, label: "Tomador", icon: Building2 },
          { id: 2, label: "Serviço", icon: Calculator },
          { id: 3, label: "Revisão", icon: FileCheck }
        ].map((s) => (
          <div key={s.id} className={`flex flex-col items-center bg-slate-100 px-4 py-2 rounded-lg ${step >= s.id ? "text-blue-600" : "text-slate-400"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= s.id ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-500"}`}>
              <s.icon size={20} />
            </div>
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        
        {/* PASSO 1: TOMADOR */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Quem é o cliente?</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Cliente</label>
              <select 
                className="w-full p-3 border rounded-lg bg-slate-50 outline-blue-500 text-slate-700"
                value={nfData.cliente}
                onChange={(e) => setNfData({...nfData, cliente: e.target.value})}
              >
                <option value="">Selecione...</option>
                <option value="Empresa Exemplo Ltda">Empresa Exemplo Ltda (12.345.678/0001-90)</option>
                <option value="João da Silva">João da Silva (123.456.789-00)</option>
              </select>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-yellow-800 text-sm">
              ℹ️ O endereço será preenchido automaticamente com base no cadastro do cliente.
            </div>
          </div>
        )}

        {/* PASSO 2: SERVIÇO E VALORES */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Detalhes do Serviço</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Valor do Serviço (R$)</label>
              <input 
                type="number" 
                placeholder="0,00"
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold"
                value={nfData.valor}
                onChange={(e) => setNfData({...nfData, valor: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discriminação do Serviço</label>
              <textarea 
                rows={4}
                placeholder="Ex: Desenvolvimento de software referente ao mês de Dezembro..."
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700"
                value={nfData.servicoDescricao}
                onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}
              ></textarea>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <input 
                type="checkbox" 
                id="retencao"
                checked={nfData.retencoes}
                onChange={(e) => setNfData({...nfData, retencoes: e.target.checked})}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="retencao" className="text-slate-700 select-none">
                Haverá retenção de impostos na fonte?
              </label>
            </div>
          </div>
        )}

        {/* PASSO 3: REVISÃO */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Confirme os dados</h3>
            
            <div className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Tomador:</span>
                <span className="font-medium text-slate-900">{nfData.cliente || "Não informado"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Descrição:</span>
                <span className="font-medium text-slate-900 truncate max-w-xs">{nfData.servicoDescricao}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Valor Bruto:</span>
                <span className="font-bold text-slate-900">R$ {valorNumerico.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Impostos Estimados (6%):</span>
                <span>R$ {impostoEstimado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600 border-t pt-4 mt-2">
                <span>Valor Líquido:</span>
                <span>R$ {valorLiquido.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-xs text-center text-slate-400">
              Ao clicar em emitir, a nota será enviada para o ambiente nacional.
            </p>
          </div>
        )}

        {/* BOTÕES DE NAVEGAÇÃO */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium px-4 py-2">
              <ArrowLeft size={18} /> Voltar
            </button>
          ) : <div></div>}

          {step < 3 ? (
            <button 
              onClick={handleNext} 
              disabled={!nfData.cliente && step === 1}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo Passo <ArrowRight size={18} />
            </button>
          ) : (
            <button className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-200 transition font-bold text-lg">
              <CheckCircle size={20} /> EMITIR NOTA AGORA
            </button>
          )}
        </div>

      </div>
    </div>
  );
}