// Lista de cargos que têm acesso ao Painel Admin
export const STAFF_ROLES = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'];

export const checkIsStaff = (role: string | null) => {
  if (!role) return false;
  return STAFF_ROLES.includes(role);
};

// Rótulos bonitos para exibir na tela
export const ROLE_LABELS: Record<string, string> = {
  MASTER: '👑 Master',
  ADMIN: '🛡️ Administrador',
  SUPORTE: '🎧 Suporte',
  SUPORTE_TI: '💻 Suporte T.I.',
  CONTADOR: 'fp Contador',
  COMUM: '👤 Cliente'
};