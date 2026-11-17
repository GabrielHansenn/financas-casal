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

## Autenticação

- Login com email e senha ou com **link mágico**. Localmente, os emails chegam no Mailpit (http://127.0.0.1:54324).
- Os links dos emails apontam para `/auth/confirm`, que troca o `token_hash` por uma sessão. Os templates ficam em `supabase/templates/` e, em produção, precisam ser colados em *Auth → Email Templates* no painel do Supabase.
- `src/proxy.ts` renova a sessão a cada request e redireciona quem não está logado para `/entrar?next=...`. O `next` é validado para nunca sair do site.
- A checagem que vale de fato fica no servidor (`getCurrentUser` em `src/lib/auth.ts`) e no banco (RLS).
- O workspace ativo fica no cookie `active_workspace_id` e é sempre revalidado contra as associações do usuário. Se o cookie for inválido, o app usa o workspace pessoal.
- Localmente, a confirmação de email está desligada (`enable_confirmations = false`). Em produção, ligue no painel.

## Workspaces e convites

- Em **Mais → Workspaces e convites** (`/workspaces`), qualquer usuário pode criar um workspace compartilhado. Quem cria vira o dono.
- O dono convida por email. O convite é enviado via SMTP (Mailpit em dev, Gmail em produção), e a tela também mostra o link para copiar ou mandar pelo WhatsApp.
- O link (`/convite/<token>`) vale **7 dias**, é de **uso único** e só funciona para o email convidado, **depois de confirmado**. Só o hash do token fica salvo no banco: se o link se perder, convide de novo, e o convite anterior é cancelado.
- Membros podem informar a **renda mensal**, usada na divisão proporcional. O dono pode renomear, remover membros e excluir o workspace, o que apaga todos os dados dele. Os outros membros podem sair.

## Lançamentos

- **Lançamento rápido**: o botão **+** abre o formulário. Valor, categoria e Salvar; o resto tem padrão (despesa, hoje, última conta usada, "eu paguei", meio a meio no workspace do casal). A divisão é calculada em `src/lib/splits.ts`, e o servidor recalcula a partir das rendas no banco (só a divisão personalizada usa os valores enviados).
- **Transações** (`/transacoes`): lista do mês agrupada por dia, com total do dia e resumo de receitas, despesas e saldo. Os filtros ficam na URL (`?month=AAAA-MM&category=<id>&account=<id>`), então dá para salvar ou compartilhar um filtro. Valores inválidos são ignorados.
- Tocar num lançamento abre a edição (mesmo formulário) e o botão de excluir. Transferências não contam em receitas/despesas; com filtro de conta, aparecem como entrada (+) ou saída (−) daquela conta.
- Contas e categorias arquivadas somem do formulário de novos lançamentos, mas os lançamentos antigos continuam mostrando o nome e podem ser editados.

## Início (dashboard)

- Mês navegável (`/?month=AAAA-MM`): saldo do mês (receitas − despesas, sem transferências), barras de receitas × despesas e comparação das despesas com o mês anterior.
- Rosca de despesas por categoria (Recharts), com a cor de cada categoria. Acima de 6 categorias, as menores viram "Demais categorias". A lista ao lado mostra nome, % e valor, então a leitura não depende só da cor, e cada linha abre a lista filtrada.
- Saldo atual por conta (view `account_balances`, todos os lançamentos), com link para a lista filtrada pela conta.
- Os totais vêm da RPC `get_period_summary` (security invoker, a RLS se aplica). A agregação fica em `src/features/dashboard/summary.ts`, com testes.

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

## Produção (Supabase + Vercel)

O banco de produção é um projeto em supabase.com. O app roda na Vercel, que faz deploy automático a cada `git push` na `main`. **O seed nunca vai para produção**: lá só ficam dados reais.

### Banco

```powershell
npx supabase login                               # uma vez por máquina (abre o navegador)
npx supabase link --project-ref <PROJECT_REF>    # uma vez; pede a senha do banco
npm run db:status:remote                         # compara migrations locais x produção
npm run db:push                                  # aplica as migrations pendentes em produção (--remote)
npm run db:backup                                # dump de schema e dados em ./backups (fora do git)
```

O `<PROJECT_REF>` fica na URL do painel: `supabase.com/dashboard/project/<PROJECT_REF>`.

Fluxo para mudar o schema:
1. Crie a migration e teste localmente (`npm run db:reset`, `npm run test:db`).
2. Faça o commit.
3. Rode `npm run db:push` **antes** de dar push no código que depende da mudança.

### Configuração no painel do Supabase

| Onde | O quê |
|---|---|
| Authentication → URL Configuration | **Site URL**: a URL da Vercel (ex.: `https://financas-casal.vercel.app`). **Redirect URLs**: `https://financas-casal.vercel.app/**` |
| Authentication → Sign In / Providers → Email | **Confirm email** ligado; tamanho mínimo de senha: 8 |
| Authentication → Emails → SMTP Settings | SMTP próprio (ver abaixo) |
| Authentication → Emails → Templates | Cole `supabase/templates/magic_link.html` em *Magic Link* e `confirmation.html` em *Confirm signup*, com os assuntos de `config.toml` |

### Email (Gmail SMTP)

1. Ative a verificação em duas etapas na conta Google e gere uma **senha de app** em https://myaccount.google.com/apppasswords.
2. No Supabase (SMTP Settings): host `smtp.gmail.com`, porta `465`, usuário = seu Gmail, senha = a senha de app, remetente = seu Gmail, nome "Finanças Casal".
3. As mesmas credenciais vão nas variáveis `SMTP_*` da Vercel. O app usa essas variáveis para enviar os convites.

O Gmail permite cerca de 500 emails por dia.

### Variáveis de ambiente na Vercel

Cadastre em *Settings → Environment Variables* (ambientes Production e Preview):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → **Publishable key** (`sb_publishable_...`) |
| `NEXT_PUBLIC_SITE_URL` | a URL da Vercel, sem barra no final |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASSWORD` | seu Gmail / a senha de app |
| `SMTP_FROM` | `Finanças Casal <seu@gmail.com>` |

Variáveis `NEXT_PUBLIC_*` são embutidas no build. Depois de alterar alguma, faça **Redeploy**.

## Convenções

- Interface em pt-BR; código, comentários, tabelas e colunas em inglês.
- Dinheiro é **sempre inteiro em centavos** (`bigint` no banco, `number` inteiro no TS). A conversão acontece só na exibição e na entrada.
- Datas de transação usam `date` e são calculadas no fuso `America/Sao_Paulo`; timestamps usam `timestamptz`.
- A segurança fica no banco (RLS). O app usa apenas a publishable key.
