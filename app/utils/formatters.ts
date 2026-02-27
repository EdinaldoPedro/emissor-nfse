export function sanitizeStringExternal(text: string | null | undefined): string {
    if (!text) return '';
    // 1. Remove acentos (ex: "São José" vira "Sao Jose")
    const noAccents = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // 2. Remove tudo que não for letra, número ou espaço (remove aspas, traços, etc)
    return noAccents.replace(/[^a-zA-Z0-9\s]/g, "").trim();
}