export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  perfil: 'Admin' | 'Fornecedor' | 'Cliente';
  status: 'Ativo' | 'Inativo';
  fotoPerfil?: string;
  isOnline?: boolean;
  ultimoAcesso?: any;
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
  estoqueMinimo?: number;
  unidadeMedida: string;
  fornecedoresRelacionados?: string[];
}

export interface FornecedorCusto {
  fornecedorId: string;
  nome: string;
  custo: number;
}

export interface Prato {
  id: string;
  nome: string;
  tipoVenda: 'Por Unidade' | 'Por Quilo';
  rendimento: number;
  fornecedoresCustos: FornecedorCusto[];
  imagemUrl?: string;
}

export interface PratoOrcamento {
  pratoId: string;
  nome: string;
  fornecedorId: string;
  fornecedorNome: string;
  custo: number;
  tipoVenda: 'Por Unidade' | 'Por Quilo';
  rendimento: number;
  imagemUrl?: string;
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
  pratosSelecionados: PratoOrcamento[] | string[]; // Backwards compatibility for string[]
  custosExtras?: { descricao: string; valor: number }[];
  custoAlimentos: number;
  custoLogistica?: number; // legacy
  custoTotal: number;
  margemLucro: number;
  valorVenda: number;
  imagemUrl?: string;
  materiaisEstoque?: { materialId: string; nome: string; quantidade: number }[];
  estoqueBaixado?: boolean;
  status: 'Rascunho' | 'Em Aberto' | 'Enviado' | 'Em Negociação' | 'Aprovado' | 'Entregue' | 'Recusado';
  statusPagamento?: 'Aguardando' | 'Pago';
  createdAt?: string;
  ultimoEditor?: string;
}

export interface Transacao {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: 'Receita' | 'Despesa';
  valor: number;
  status: 'Pago' | 'Pendente';
  createdAt?: string;
}

export interface CustoOperacionalCategoria {
  id: string;
  nome: string;
}

export interface CustoLancado {
  idCategoria: string;
  valor: number;
  observacao?: string;
}


