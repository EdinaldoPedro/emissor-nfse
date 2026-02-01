'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface SearchableSelectProps {
    options: any[];
    onSelect?: (item: any) => void; // Novo padrão
    onChange?: (item: any) => void; // Padrão antigo (Legado)
    value?: any; // Aceita Objeto ou ID (controle externo)
    placeholder?: string;
    labelKey?: string;
    valueKey?: string;
    disabled?: boolean;
}

export default function SearchableSelect({ 
    options = [], 
    onSelect,
    onChange,
    value,
    placeholder = "Selecione...", 
    labelKey = "label", 
    valueKey = "value",
    disabled = false
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [internalSelected, setInternalSelected] = useState<any>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // LÓGICA DE CONTROLE DE VALOR (Híbrida)
    // Se passar 'value' via props, usa ele. Se não, usa o estado interno.
    // Tenta achar o objeto na lista caso o 'value' seja apenas um ID (string/number).
    const getSelectedItem = () => {
        if (value !== undefined && value !== null) {
            // Se o valor já é um objeto completo, usa ele
            if (typeof value === 'object' && value !== null) return value;
            // Se é um ID, tenta encontrar nas opções
            return options.find(o => o[valueKey] === value) || null;
        }
        return internalSelected;
    };

    const selectedItem = getSelectedItem();

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Filtra opções
    const filteredOptions = options.filter(option => {
        // Proteção contra undefined/null
        if (!option) return false;
        
        const label = option[labelKey] ? String(option[labelKey]).toLowerCase() : "";
        const document = option.documento ? String(option.documento) : ""; 
        const search = searchTerm.toLowerCase();
        
        // Busca inteligente (Nome ou Documento)
        return label.includes(search) || document.includes(search);
    });

    const handleSelect = (item: any) => {
        setInternalSelected(item);
        
        // Dispara ambos os eventos para garantir compatibilidade
        if (onSelect) onSelect(item);
        if (onChange) onChange(item);
        
        setIsOpen(false);
        setSearchTerm("");
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInternalSelected(null);
        if (onSelect) onSelect(null);
        if (onChange) onChange(null);
        setSearchTerm("");
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {/* INPUT VISUAL */}
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full border rounded-lg p-3 flex justify-between items-center bg-white cursor-pointer transition-all ${
                    isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-slate-400'
                } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
            >
                <div className="flex-1 truncate">
                    {selectedItem ? (
                        <span className="text-slate-800 font-medium">
                            {selectedItem[labelKey] || selectedItem.nome || selectedItem.razaoSocial || selectedItem.descricao} 
                            {selectedItem.documento && <span className="text-slate-400 text-xs ml-2 font-normal">({selectedItem.documento})</span>}
                        </span>
                    ) : (
                        <span className="text-slate-400 text-sm">{placeholder}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {selectedItem && !disabled && (
                        <button onClick={clearSelection} type="button" className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500">
                            <X size={16} />
                        </button>
                    )}
                    <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* LISTA DROPDOWN */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    
                    {/* CAMPO DE BUSCA */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input 
                                autoFocus
                                className="w-full pl-9 p-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* OPÇÕES */}
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                                Nenhuma opção encontrada.
                            </div>
                        ) : (
                            filteredOptions.map((option, idx) => (
                                <button
                                    key={option[valueKey] || option.id || idx}
                                    onClick={() => handleSelect(option)}
                                    type="button"
                                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition border-b border-slate-50 last:border-0 flex justify-between items-center group"
                                >
                                    <span>
                                        {option[labelKey] || option.nome || option.razaoSocial || option.descricao}
                                        {option.documento && <span className="text-slate-400 text-xs ml-2 group-hover:text-blue-400">({option.documento})</span>}
                                    </span>
                                    {/* Indicador de Selecionado */}
                                    {selectedItem && (selectedItem[valueKey] === option[valueKey] || selectedItem.id === option.id) && (
                                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}