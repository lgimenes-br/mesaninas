export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  perfil: 'Admin' | 'Fornecedor' | 'Cliente';
  status: 'Ativo' | 'Inativo';
  fotoPerfil?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
  tipo?: 'Social' | 'Corporativo';
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  endereco?: string;
  observacoes?: string;
  createdAt?: any;
}

export interface Fornecedor {
  id: string;
  nome: string;
  cpf_cnpj: string;
  contatoPrincipal?: string;
  email: string;
  telefone: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  endereco?: string;
  observacoes?: string;
  createdAt?: any;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidadeMedida: string;
  fornecedoresRelacionados?: string[];
}

export interface Prato {
  id: string;
  nome: string;
  tipoVenda: 'Por Unidade' | 'Por Quilo';
  precoBase: number;
  rendimento: number;
  fornecedoresRelacionados?: string[];
}

export interface Orcamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  nomeEvento?: string;
  dataEvento: string;
  horaInicio?: string;
  horaTermino?: string;
  enderecoEvento?: string;
  numConvidados: number;
  pratosSelecionados: string[];
  custosExtras?: { descricao: string; valor: number }[];
  custoAlimentos: number;
  custoLogistica?: number; // legacy
  custoTotal: number;
  margemLucro: number;
  valorVenda: number;
  status: 'Rascunho' | 'Em Aberto' | 'Enviado' | 'Em Negociação' | 'Aprovado' | 'Entregue' | 'Recusado';
  statusPagamento?: 'Aguardando' | 'Pago';
  createdAt?: string;
}

