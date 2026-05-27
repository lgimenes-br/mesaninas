# Painel de Diretrizes do Agente (Catering System)

## Regras de Interface e Componentes

### 1. Botões Reutilizáveis
- **Sempre utilize o componente `<Button />`** importado de `@/components/Button` (ou `../components/Button`) em todas as novas telas, formulários e fluxos gerados.
- **Evite** declarar botões nativos `<button>` com classes do Tailwind repetidas para botões principais, secundários ou de contorno.
- Assinatura das props do Componente `Button`:
  - `variant`: `'primary' | 'secondary' | 'outline'`
  - `size`: `'sm' | 'md' | 'lg'`
- Exemplo de Uso:
  ```tsx
  import Button from '../components/Button';

  <Button variant="primary" size="md" onClick={handleSave}>
    Salvar Alterações
  </Button>
  ```
