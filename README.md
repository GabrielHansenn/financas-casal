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
