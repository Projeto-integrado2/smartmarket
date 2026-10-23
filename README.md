# SmartMarket

Front (React + Vite + Tailwind v4) no GitHub Pages + API Flask (SQLite) em Docker na Homelab.

```
src/                    # Front: components/, pages/, hooks/, services/api.ts, data/mockProducts.ts
backend/                # API: app.py, config.py, models/, routes/, services/, seed.py
```

> **Sem `VITE_API_URL` o front usa dados mockados** (modo demonstração). Com ela, usa a API.

## 1. Rodar o backend (Homelab ou local)

1. Copie o modelo: `cd backend && cp .env.example .env`
2. Edite o `.env`:
   - `GEMINI_API_KEY`: gere em https://aistudio.google.com/apikey
   - `GEMINI_MODEL`: por padrão, `gemini-2.5-flash`
   - `CORS_ORIGINS`: origens completas permitidas, separadas por vírgula. A configuração não aceita `*`, origem vazia ou URL com caminho.
   - `RATELIMIT_STORAGE_URI`: no Compose, mantenha `redis://rate-limiter:6379/0`; sem Docker, use `redis://localhost:6379/0`.
   - `ADMIN_USERNAME` e `ADMIN_PASSWORD`: credenciais para criar o administrador inicial; a senha deve ter ao menos 12 caracteres.
   - `ADMIN_TOKEN_SECRET`: segredo aleatório com pelo menos 32 caracteres, usado para assinar tokens administrativos. Gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
   Se já existir um `.env` antigo, mantenha o valor de `GEMINI_MODEL` atualizado.
3. Suba: `docker compose up -d --build`
4. Teste: abra `http://localhost:5000/api/products` (deve listar 4 produtos).

O banco é o arquivo `data/smartmarket.db` (criado e populado sozinho). Faça backup copiando essa pasta.
O Compose inicia um Redis privado, sem porta exposta, para rate limiting. Em produção
com múltiplas instâncias, configure todas para o mesmo Redis protegido e durável.
Sem Docker, instale Redis e execute `pip install -r requirements.txt && python app.py`.
`CHAT_RATE_LIMIT` ajusta o limite de mensagens do chat por IP; o padrão é
`10 per minute; 60 per hour`. O IP é obtido da conexão direta e cabe ao proxy
reverso impedir acesso direto à API; cabeçalhos de encaminhamento do cliente não
são confiados.

O primeiro usuário administrativo é criado no banco no primeiro início da API, se ainda não existir. A senha fica armazenada como hash; alterar `ADMIN_PASSWORD` depois não redefine a senha já cadastrada. Mantenha `ADMIN_TOKEN_SECRET` estável entre reinicializações e não o compartilhe. O login emite um token com validade de 8 horas.

## 2. Rodar o front local

1. No PowerShell, na raiz do projeto, instale as dependências:
   `pnpm install`
2. Para usar os dados mockados, deixe `VITE_API_URL` vazio ou remova a variável.
   Para conectar à API local, crie `.env.local` com
   `VITE_API_URL=http://localhost:5000`. Configure também `http://localhost:5173`
   em `CORS_ORIGINS` no backend. O modo mockado é voltado à demonstração do
   frontend: os produtos cadastrados no painel aparecem quando o front está
   conectado à API.
3. Inicie o front com `pnpm dev` e abra o endereço exibido (normalmente
   `http://localhost:5173`).

É necessário ter Node.js instalado. Se o comando `pnpm` não estiver disponível,
execute `corepack enable` no PowerShell e abra um novo terminal.
Na Home, adicione produtos pelo catálogo ou pela página de detalhes e abra
`Carrinho` para ajustar quantidades e consultar o subtotal. O carrinho é
demonstrativo, mantido apenas enquanto a aplicação está aberta; não finaliza
pedidos nem processa pagamentos.

## 3. Publicar o front no GitHub Pages

1. **HTTPS na API é obrigatório.** O Pages é HTTPS e o navegador bloqueia chamadas para `http://`.
   Exponha a API da Homelab com HTTPS, por exemplo: Cloudflare Tunnel, Caddy ou Nginx + domínio.
   Anote a URL final (ex.: `https://api.seudominio.com`).
2. No `.env` do backend, declare a origem exata do Pages em `CORS_ORIGINS`
   (ex.: `https://SEU_USUARIO.github.io`; sem caminho), separada por vírgulas
   de outras origens de confiança, e rode `docker compose up -d`.
3. No `vite.config.ts`, ajuste o `base` para o nome do repositório:
   `base: '/NOME_DO_REPO/'`.
4. No GitHub: *Settings → Secrets and variables → Actions → Variables* → crie `VITE_API_URL` com a URL do passo 1.
5. *Settings → Pages → Source: GitHub Actions* e adicione um workflow que rode
   `pnpm install && pnpm build` (com `VITE_API_URL` no `env`) e publique a pasta `dist/`.
   Modelo oficial: https://github.com/actions/starter-workflows/blob/main/pages/static.yml

## Segurança da API

- **Chave Gemini:** a chave é lida de `GEMINI_API_KEY` no ambiente do backend e
  não deve ser colocada no frontend. Se a chave existente foi incluída em
  materiais compartilhados, trate-a como comprometida: revogue-a manualmente
  no Google AI Studio, gere outra e atualize o `.env`/segredos do ambiente.
  Depois, reconstrua e substitua imagens Docker antigas. Essa revogação não é
  feita pela aplicação.
- **`.env`:** os arquivos `.env` são ignorados pelo Git e excluídos do contexto
  de build Docker; Compose injeta as variáveis em runtime. Não envie `.env`
  para repositórios nem imagens.
- **CORS:** `CORS_ORIGINS` é obrigatória e deve conter origens exatas, como
  `http://localhost:5173` ou `https://SEU_USUARIO.github.io`. O backend falha
  ao iniciar com a variável ausente, vazia, inválida ou wildcard. CORS apenas
  limita navegadores; não autentica clientes.
- **Acesso e limites:** clientes podem consultar o catálogo e usar o chat sem
  login. As rotas administrativas de cadastro, edição, estoque e arquivamento
  exigem autenticação do administrador no backend. Rate limits por IP, CORS
  restrito por origem em navegadores e validação de payload reduzem abuso, mas
  CORS não autentica clientes nem substitui a autorização administrativa.
- O chat pode sugerir receitas em uma conversa; não há mais geração ou seção
  automática de receita diária.
- O chat aceita mensagens de até 2.000 caracteres e requisições de até 32 KiB.
  As instruções do modelo reforçam que mensagens e dados externos não são
  confiáveis; prompt injection continua sendo um risco residual e não é
  eliminado apenas por instruções de sistema.

## Painel administrativo

Com a API configurada, acesse **Painel** no frontend e entre com as credenciais do administrador inicial. O login é necessário somente para o painel administrativo. Clientes continuam podendo consultar o catálogo e usar o chat sem login. O painel permite criar e editar produtos, ajustar estoque, pesquisar no catálogo e arquivar/restaurar itens. Os IDs são gerados pela API. Produtos arquivados permanecem no banco, mas deixam de aparecer no catálogo público e no chat. O alerta de estoque baixo usa o limite global de menos de 10 unidades.

Todas as operações de escrita exigem autenticação no backend. A API administrativa inclui `POST /api/admin/auth/login`, `GET /api/admin/auth/me`, `GET/POST /api/admin/products`, `PUT /api/admin/products/<id>`, `PATCH /api/admin/products/<id>/stock` e as ações `POST /api/admin/products/<id>/archive` e `/restore`. Credenciais e tokens administrativos não devem ser enviados a clientes não confiáveis.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products` | Lista produtos (`?category=` e `?q=`) |
| GET | `/api/products/<id>` | Detalhe do produto |
| POST | `/api/chat` | Body `{ "message": "...", "session_id": "...", "cart": [{ "product_id": "SM-2087", "quantity": 1 }] }` → `{ text, products }`. `session_id` identifica o histórico salvo no SQLite; `cart` é opcional e preços/subtotal são calculados pelo backend a partir do catálogo. Em falhas temporárias do Gemini, retorna `{"status":"erro","mensagem":"Assistente temporariamente indisponível. Tente em instantes."}`. |
