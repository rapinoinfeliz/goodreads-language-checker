# Goodreads PT Edition Checker

Extensão para Google Chrome que facilita a busca por edições em português de livros no Goodreads. 

## Funcionalidades

- **Detecção Automática:** Verifica automaticamente se o livro atual possui uma edição em Português e exibe um badge visual.
- **Painel de Edições:** Lista todas as versões em português disponíveis com suas respectivas capas e informações adicionais (editora, ano).
- **Ações Rápidas:** Botões para copiar o **ISBN-13** ou o título do livro para a área de transferência.
- **Busca Rápida:** Botão para abrir o Telegram web pronto para pesquisar o livro em grupos e canais específicos.
- **Cache Inteligente:** Armazena resultados em cache local para evitar requisições redundantes e respeitar limites de taxa, com TTL de 7 dias para livros não encontrados.

## Instalação

Como a extensão não está publicada na Chrome Web Store, a instalação deve ser feita manualmente (Modo Desenvolvedor):

1. Clone ou baixe este repositório para o seu computador.
2. Abra o Google Chrome e acesse `chrome://extensions/`.
3. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (Developer mode).
4. Clique no botão **"Carregar sem compactação"** (Load unpacked).
5. Selecione a pasta onde você clonou/extraiu os arquivos deste repositório (a pasta que contém o `manifest.json`).
6. Pronto! O ícone da extensão aparecerá na sua barra e ela já estará funcionando no Goodreads.

## Como Usar

- Navegue até a página de qualquer livro no [Goodreads](https://www.goodreads.com/).
- Se existirem edições em português, um botão flutuante vermelho "🇧🇷 PT-BR" aparecerá no canto inferior direito da tela.
- Clique nele para ver a lista de edições e realizar ações rápidas (copiar ISBN, título, etc.).
- A extensão também injeta as informações diretamente nas listas de prêmios e pesquisas do Goodreads ao passar o mouse sobre as capas dos livros.

## Tecnologias Usadas

- **Manifest V3:** Padrão atualizado de extensões do Chrome.
- **Vanilla JavaScript:** Sem dependências pesadas, para performance e rapidez.
- **MutationObserver:** Para identificar mudanças dinâmicas na página e atuar apenas quando necessário (com *debounce* de performance).
