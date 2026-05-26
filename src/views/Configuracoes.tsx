import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Settings, Save } from 'lucide-react';

export default function Configuracoes() {
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pix, setPix] = useState('');

  const [margemLucro, setMargemLucro] = useState<number | ''>('');
  const [aliquotaNF, setAliquotaNF] = useState<number | ''>('');
  const [validadeProposta, setValidadeProposta] = useState<number | ''>('');

  const [politicasCancelamento, setPoliticasCancelamento] = useState('');
  const [regrasQuebra, setRegrasQuebra] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracoes', 'gerais'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNomeFantasia(data.nomeFantasia || '');
        setCnpj(data.cnpj || '');
        setEmail(data.email || '');
        setTelefone(data.telefone || '');
        setPix(data.pix || '');
        setMargemLucro(data.margemLucro !== undefined ? data.margemLucro : '');
        setAliquotaNF(data.aliquotaNF !== undefined ? data.aliquotaNF : '');
        setValidadeProposta(data.validadeProposta !== undefined ? data.validadeProposta : '');
        setPoliticasCancelamento(data.politicasCancelamento || '');
        setRegrasQuebra(data.regrasQuebra || '');
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    value = value.replace(/^(\d{2})(\d)/, '$1.$2');
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
    setCnpj(value);
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (value.length > 0) {
      value = value.replace(/^(\d{0,2})/, '($1');
    }
    setTelefone(value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage({ type: '', text: '' });
    try {
      await setDoc(doc(db, 'configuracoes', 'gerais'), {
        nomeFantasia,
        cnpj,
        email,
        telefone,
        pix,
        margemLucro: Number(margemLucro) || 0,
        aliquotaNF: Number(aliquotaNF) || 0,
        validadeProposta: Number(validadeProposta) || 0,
        politicasCancelamento,
        regrasQuebra
      }, { merge: true });
      
      setSaveMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error("Erro ao salvar configurações", error);
      setSaveMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-mesaninas-creme/30 items-center justify-center">
         <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
         <p className="mt-4 text-mesaninas-green/70 font-medium">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-12">
      <div className="w-full flex flex-col gap-6 mt-4">
        {saveMessage.text && (
          <div className={`p-4 rounded-xl text-sm font-medium shadow-sm border ${
            saveMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* CARD 1: Dados da Marca */}
        <section className="bg-white border border-mesaninas-creme rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-mesaninas-creme/20 border-b border-mesaninas-creme font-serif font-bold text-lg text-mesaninas-green">
            Dados da Marca (Branding & Contato)
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Nome Fantasia</label>
              <input type="text" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">CNPJ da Empresa</label>
              <input type="text" value={cnpj} onChange={handleCnpjChange} placeholder="00.000.000/0000-00" className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">E-mail Comercial</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Telefone/WhatsApp Principal</label>
              <input type="text" value={telefone} onChange={handleTelefoneChange} placeholder="(00) 00000-0000" className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Chave PIX Oficial</label>
              <input type="text" value={pix} onChange={e => setPix(e.target.value)} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
          </div>
        </section>

        {/* CARD 2: Regras Financeiras */}
        <section className="bg-white border border-mesaninas-creme rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-mesaninas-creme/20 border-b border-mesaninas-creme font-serif font-bold text-lg text-mesaninas-green">
            Regras Financeiras Padrão
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Margem de Lucro Padrão (%)</label>
              <input type="number" value={margemLucro} onChange={e => setMargemLucro(Number(e.target.value))} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Alíquota de Nota Fiscal / Imposto (%)</label>
              <input type="number" value={aliquotaNF} onChange={e => setAliquotaNF(Number(e.target.value))} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Validade Padrão das Propostas (dias)</label>
              <input type="number" value={validadeProposta} onChange={e => setValidadeProposta(Number(e.target.value))} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow" />
            </div>
          </div>
        </section>

        {/* CARD 3: Termos e Condições */}
        <section className="bg-white border border-mesaninas-creme rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-mesaninas-creme/20 border-b border-mesaninas-creme font-serif font-bold text-lg text-mesaninas-green">
            Termos e Condições
          </div>
          <div className="p-6 grid grid-cols-1 gap-6">
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Políticas de Cancelamento e Reembolso</label>
              <textarea value={politicasCancelamento} onChange={e => setPoliticasCancelamento(e.target.value)} rows={4} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 resize-y focus:border-mesaninas-yellow" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Regras de Quebra de Materiais e Logística</label>
              <textarea value={regrasQuebra} onChange={e => setRegrasQuebra(e.target.value)} rows={4} className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 resize-y focus:border-mesaninas-yellow" />
            </div>
          </div>
        </section>

        {/* Botão de Salvar no final */}
        <div className="flex justify-end mt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-mesaninas-green text-mesaninas-creme rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save size={18} />
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}
