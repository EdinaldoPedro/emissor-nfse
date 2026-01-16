'use client';

import { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, HelpCircle, Trash2, Info } from 'lucide-react';

interface DialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'danger' | 'warning' | 'prompt' | 'success';
  placeholder?: string; // Apenas para prompt
  validationText?: string; // Texto que o usuário deve digitar para confirmar (ex: "DELETAR")
}

interface DialogContextType {
  showAlert: (opts: DialogOptions | string) => Promise<void>;
  showConfirm: (opts: DialogOptions | string) => Promise<boolean>;
  showPrompt: (opts: DialogOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType>({} as DialogContextType);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({ description: '' });
  const [inputValue, setInputValue] = useState('');
  
  // Refs para guardar a promessa (resolve)
  const resolver = useRef<(value: any) => void>(() => {});

  const openDialog = (opts: DialogOptions): Promise<any> => {
    setOptions(opts);
    setInputValue('');
    setIsOpen(true);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  };

  const handleConfirm = () => {
    if (options.type === 'prompt') {
      if (options.validationText && inputValue !== options.validationText) {
        // Treme a tela ou avisa (opcional)
        alert(`Digite "${options.validationText}" corretamente.`);
        return;
      }
      resolver.current(inputValue);
    } else {
      resolver.current(true);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (options.type === 'prompt') resolver.current(null);
    else resolver.current(false);
    setIsOpen(false);
  };

  const api = {
    showAlert: async (opts: DialogOptions | string) => {
      const config = typeof opts === 'string' ? { description: opts, type: 'info' } : opts;
      await openDialog({ ...config, type: config.type || 'info', confirmText: 'OK' });
    },
    showConfirm: async (opts: DialogOptions | string) => {
      const config = typeof opts === 'string' ? { description: opts, type: 'warning' } : opts;
      return await openDialog({ ...config, type: config.type || 'warning' });
    },
    showPrompt: async (opts: DialogOptions) => {
      return await openDialog({ ...opts, type: 'prompt' });
    }
  };

  // Ícone dinâmico
  const getIcon = () => {
    switch (options.type) {
      case 'danger': return <div className="bg-red-100 p-4 rounded-full text-red-600 mb-4 mx-auto w-fit shadow-inner"><Trash2 size={32}/></div>;
      case 'warning': return <div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 mx-auto w-fit shadow-inner"><AlertTriangle size={32}/></div>;
      case 'prompt': return <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4 mx-auto w-fit shadow-inner"><HelpCircle size={32}/></div>;
      case 'success': return <div className="bg-green-100 p-4 rounded-full text-green-600 mb-4 mx-auto w-fit shadow-inner"><CheckCircle size={32}/></div>;
      default: return <div className="bg-slate-100 p-4 rounded-full text-slate-600 mb-4 mx-auto w-fit shadow-inner"><Info size={32}/></div>;
    }
  };

  return (
    <DialogContext.Provider value={api as any}>
      {children}
      
      {/* UI DO MODAL (GLOBAL) */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100 animate-in zoom-in-95 duration-200 border border-slate-100 relative">
            
            {/* Botão Fechar no canto */}
            <button onClick={handleCancel} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition">
                <X size={20}/>
            </button>

            {getIcon()}
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {options.title || (options.type === 'danger' ? 'Zona de Perigo' : options.type === 'success' ? 'Sucesso!' : 'Atenção')}
            </h3>
            
            <p className="text-slate-500 mb-6 text-sm leading-relaxed px-2">
              {options.description}
            </p>

            {/* Input do Prompt */}
            {options.type === 'prompt' && (
              <div className="mb-6 text-left bg-slate-50 p-3 rounded-lg border border-slate-200">
                {options.validationText && (
                  <p className="text-xs text-slate-500 mb-2">
                    Para confirmar, digite <span className="font-bold select-all text-slate-800 bg-white px-1 rounded border">"{options.validationText}"</span> abaixo:
                  </p>
                )}
                <input 
                  autoFocus
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm transition"
                  placeholder={options.placeholder || "Digite aqui..."}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {options.type !== 'info' && options.type !== 'success' ? (
                <>
                  <button 
                    onClick={handleCancel}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition text-sm"
                  >
                    {options.cancelText || 'Cancelar'}
                  </button>
                  <button 
                    onClick={handleConfirm}
                    className={`px-4 py-2.5 rounded-xl text-white font-bold transition text-sm shadow-lg shadow-blue-100 ${
                      options.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' :
                      'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {options.confirmText || 'Confirmar'}
                  </button>
                </>
              ) : (
                 <button 
                    onClick={handleConfirm}
                    className="col-span-2 px-4 py-2.5 rounded-xl text-white font-bold transition text-sm shadow-lg bg-slate-900 hover:bg-slate-800"
                  >
                    {options.confirmText || 'Entendi'}
                  </button>
              )}
            </div>

          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);