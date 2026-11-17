# Finanças Casal

PWA de organização financeira pessoal e do casal. Next.js 16 (App Router), Supabase (Postgres + Auth + RLS), Tailwind + shadcn/ui.

## Pré-requisitos

- Node.js 24 ou superior e npm
- Docker Desktop rodando (no Windows, com backend WSL2)
- O Supabase CLI já vem como devDependency: use sempre `npx supabase ...`

## Setup local

```powershell
npm install
npx supabase start        # sobe Postgres, Auth, Studio e Mailpit no Docker
npx supabase status       # mostra URLs e chaves
copy .env.example .env.local
```

Preencha o `.env.local` com:

| Variável | Valor local |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` do `supabase status` (`http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` (`sb_publishable_...`) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `SMTP_*` | já vêm prontos para o Mailpit (`127.0.0.1:54325`) |

> A **secret key** (`sb_secret_...`) não é usada pelo app. Nunca coloque essa chave em variáveis `NEXT_PUBLIC_*`.

Depois rode o app:

```powershell
npm run dev
```

Acesse **http://localhost:3000**, não `127.0.0.1`: os cookies de sessão não são compartilhados entre os dois endereços.

## Serviços locais

| Serviço | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (emails de login e convites) | http://127.0.0.1:54324 |
| API do Supabase | http://127.0.0.1:54321 |

## Banco de dados

As migrations ficam em `supabase/migrations` e o seed em `supabase/seed.sql`.

```powershell
npx supabase migration new nome_da_migration   # cria uma nova migration
npm run db:migrate     # aplica migrations pendentes (supabase migration up)
npm run db:reset       # recria o banco do zero: migrations + seed
npm run db:types       # regenera src/types/database.ts
npm run test:db        # testes pgTAP (RLS e integridade) em supabase/tests
```

Sempre que o schema mudar, rode `npm run db:types`.

### Usuários de teste (seed)

| Email | Senha | Papel |
|---|---|---|
| `ana@teste.local` | `senha123` | dona do workspace compartilhado "Casa", renda R$ 6.000 |
| `bruno@teste.local` | `senha123` | membro de "Casa", renda R$ 4.000 |

O seed cria o workspace pessoal de cada um e o workspace "Casa". "Casa" tem conta conjunta e cartão, despesas do mês atual e do anterior (divisões igual, proporcional e personalizada), um acerto, o aluguel recorrente e uma meta com aportes. As datas são relativas ao mês atual, então sempre há dados do "mês atual".

### Modelo e segurança

- **Workspaces**: todo usuário ganha um workspace pessoal no cadastro (trigger `on_auth_user_created`), com categorias padrão e uma conta. Workspaces compartilhados, convites e aceite passam por RPCs (`create_shared_workspace`, `create_workspace_invite`, `accept_workspace_invite`).
- **RLS** em todas as tabelas, via `is_workspace_member(workspace_id)`. Usuários anônimos não têm acesso a nada.
- **Integridade no banco**:
  - FKs compostas `(id, workspace_id)` impedem referências entre workspaces.
  - Uma constraint trigger *deferrable* garante que a soma dos splits é igual ao valor da transação.
  - Triggers garantem que `paid_by` e os splits são de membros do workspace.
- **Transação + splits** são gravados atomicamente pela RPC `save_transaction`.
- **Convenção para novas funções SQL**: o Postgres concede `EXECUTE` a `PUBLIC` por padrão. Toda função nova precisa de `revoke execute ... from public, anon, authenticated` e de um `grant` explícito, se o app for chamá-la.

### Testes do banco (pgTAP)

`npm run test:db` roda `supabase/tests/database/*.test.sql`. Cada arquivo roda numa transação com rollback, então não altera os dados do seed.
- `rls.test.sql`: um usuário de fora não vê nem altera nada de um workspace alheio; um membro não escala privilégios; anon não lê nada.
- `integrity.test.sql`: FKs entre workspaces, regras de split, convites (email errado, reuso, expiração), recorrência duplicada, saldos e ledger do acerto.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run dev:https` | dev com HTTPS local (necessário para testar o PWA/service worker pelo celular na rede) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários (Vitest) |
| `npm run check` | lint + typecheck + testes |
| `npm run build` | build de produção |

Os scripts rodam no PowerShell. O npm executa scripts via `cmd.exe` no Windows, então o redirecionamento em `db:types` gera UTF-8 corretamente.

## Convenções

- Interface em pt-BR; código, comentários, tabelas e colunas em inglês.
- Dinheiro é **sempre inteiro em centavos** (`bigint` no banco, `number` inteiro no TS). A conversão acontece só na exibição e na entrada.
- Datas de transação usam `date` e são calculadas no fuso `America/Sao_Paulo`; timestamps usam `timestamptz`.
- A segurança fica no banco (RLS). O app usa apenas a publishable key.
