'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableSelect({ options, value, onChange, placeholder, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha o menu se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Encontra o item selecionado para exibir no botão
  const selectedOption = options.find(opt => opt.value === value);

  // Filtra as opções baseado no que foi digitado
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase())) ||
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Botão Principal (Aparência de Input) */}
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full p-2 border rounded flex justify-between items-center bg-white cursor-pointer ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'hover:border-blue-400'}`}
      >
        <div className="truncate text-sm text-gray-700">
          {selectedOption ? (
            <div className="flex flex-col text-left">
              <span className="font-medium">{selectedOption.label}</span>
              {selectedOption.subLabel && <span className="text-xs text-gray-400">{selectedOption.subLabel}</span>}
            </div>
          ) : (
            <span className="text-gray-400">{placeholder || 'Selecione...'}</span>
          )}
        </div>
        <ChevronDown size={16} className="text-gray-400 min-w-[16px]" />
      </div>

      {/* Lista Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-xl max-h-60 overflow-hidden flex flex-col">
          {/* Campo de Busca Interno */}
          <div className="p-2 border-b bg-gray-50 flex items-center gap-2 sticky top-0">
            <Search size={14} className="text-gray-400"/>
            <input 
              autoFocus
              className="w-full bg-transparent outline-none text-sm"
              placeholder="Digite para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Lista de Opções */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center">Nenhum resultado.</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch(''); // Limpa busca ao selecionar
                  }}
                  className={`p-2 px-3 text-sm cursor-pointer hover:bg-blue-50 flex justify-between items-center border-b border-gray-50 last:border-0 ${value === opt.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{opt.label}</span>
                    {opt.subLabel && <span className="text-xs text-gray-400">{opt.subLabel}</span>}
                  </div>
                  {value === opt.value && <Check size={14} className="text-blue-600"/>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}