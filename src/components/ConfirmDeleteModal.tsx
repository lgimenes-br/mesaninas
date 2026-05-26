import React from 'react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({ isOpen, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
      <div className="bg-[#f4efdc] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h3 className="font-serif font-bold text-lg text-[#00382b] tracking-tight mb-2">Apagar Registro?</h3>
          <p className="text-sm text-[#00382b]/80">
            Tem certeza que deseja apagar este registro?<br/>Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="px-6 py-5 flex gap-3 justify-center border-t border-[#00382b]/10 bg-white/20">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-[#00382b] bg-transparent border border-[#00382b] rounded-md transition-colors hover:bg-[#00382b]/10 flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-bold text-[#f4efdc] bg-red-500 hover:bg-red-600 rounded-md shadow-sm transition-colors flex-1"
          >
            Sim, apagar
          </button>
        </div>
      </div>
    </div>
  );
}
