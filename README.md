# Adois

**Finanças a dois, sem complicação.** PWA de organização financeira pessoal e do casal: lançamento rápido, divisão de despesas, acerto de contas, recorrências e metas. Next.js 16 (App Router), Supabase (Postgres + Auth + RLS), Tailwind + shadcn/ui.

> O nome vem de "finanças a dois". Identificadores técnicos usam `adois`. A pasta, o repositório, o `project_id` do Supabase local (`financas-casal`) e os projetos na Vercel/Supabase mantêm o nome antigo: trocar o `project_id` recriaria os containers e volumes do banco local.

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

## Acerto do casal

- Em **Casal** (`/casal`, só em workspace compartilhado): "Bruno deve R$ X para você", o botão **Registrar acerto** (já preenchido com o valor em aberto, aceita acerto parcial) e o histórico, com opção de excluir.
- O saldo considera **todas** as despesas divididas, de todos os meses: cada parte paga por outra pessoa vira dívida com quem pagou. Os acertos abatem essa dívida. A RPC `get_settlement_ledger` devolve as linhas separadas por tipo (`split` / `settlement`), e `src/lib/settlement.ts` calcula o saldo líquido e as transferências sugeridas (com 3+ pessoas, simplifica as dívidas). Tudo em centavos, com testes.
- Um acerto **não é** receita nem despesa e não altera o saldo das contas: é um registro de que o dinheiro foi repassado entre vocês.
- Se alguém sai do workspace com saldo em aberto, o saldo continua aparecendo, mas não dá para registrar um acerto com essa pessoa (o banco exige que os dois sejam membros).

## Recorrências

- Em **Mais → Recorrências** (`/recorrencias`): contas fixas e receitas semanais, mensais ou anuais, com data de fim opcional. Dá para pausar, retomar, editar e excluir.
- **Geração:** ao abrir o app, o componente `RecurrenceRunner` (no layout autenticado) chama a Server Action `runDueRecurrences`, uma vez por sessão do navegador por dia. Ela cria os lançamentos vencidos de todos os workspaces do usuário (até 12 por recorrência de cada vez) via `save_transaction` com `p_recurring_id` e `source = 'recurring'`. Salvar uma recorrência também gera na hora o que já venceu.
- **Sem duplicar:** o índice único `(recurring_id, date)` barra a segunda inserção quando os dois abrem o app ao mesmo tempo (o erro 23505 é ignorado), e `next_date` só avança se ninguém o mudou antes (lock otimista). Se uma ocorrência falha por outro motivo, a recorrência para naquela data e tenta de novo depois.
- **Datas** (`src/lib/recurrence.ts`, com testes): mensal e anual mantêm o dia da data inicial; dia 31 cai no último dia dos meses curtos e volta para 31; 29/02 anual cai em 28/02 nos anos não bissextos.
- Retomar uma recorrência pausada **não** cria os lançamentos do período pausado. Mudar a data inicial ou a frequência vale de hoje em diante. Lançamentos já gerados não mudam ao editar e continuam existindo se a recorrência for excluída.
- A divisão (meio a meio ou proporcional) é calculada no momento de cada lançamento, com as rendas atuais. Divisão personalizada não é permitida em recorrências.

## Metas

- Em **Mais → Metas** (`/metas`): nome, valor-alvo e prazo opcional. Aportes e resgates (com data, observação e quem fez), barra de progresso e, com prazo, quanto guardar por mês (arredondado para cima). As 3 primeiras metas ativas aparecem na tela Início.
- O saldo da meta é a soma das movimentações (view `goal_progress`); resgates são valores negativos. Uma meta é um acompanhamento: aportes **não** movimentam o saldo das contas.
- **O saldo nunca fica negativo:** o trigger `assert_goal_balance` (migration `20261120120000`) trava a linha da meta e recusa com 23514 qualquer inserção, alteração ou exclusão que deixe a soma abaixo de zero. Isso vale mesmo com os dois resgatando ao mesmo tempo, e também impede excluir um aporte que já foi resgatado.
- Arquivar tira a meta da lista principal e bloqueia movimentações. Excluir apaga a meta e o histórico (pede para digitar o nome quando há movimentações).

## Quadro dos Sonhos

- Aba **Sonhos** (`/sonhos`): mural de sonhos em mosaico (2 colunas no celular, 3 no desktop), com abas *Sonhando e planejando* e *Realizados* (álbum de memórias) e filtros por categoria, prazo e "de quem" na URL. Detalhe em `/sonhos/<id>`.
- **Ciclo:** `dreaming` → `planning` (virou meta, via RPC `convert_dream_to_goal`) → `achieved`. Excluir a meta vinculada devolve o sonho para `dreaming` (FK `on delete set null` + trigger). Um sonho tem no máximo uma meta, e uma meta pertence a no máximo um sonho.
- **De quem:** `owner_user_id` (`null` = "Nosso"). A tela mostra "Meu", "De Bruno" ou "Nosso" conforme quem está vendo. No workspace pessoal, o dono é sempre o usuário.
- **Ordem manual:** botão *Organizar* (grade uniforme com arrastar e soltar via dnd-kit, segurar no celular) salva `position` com a RPC `reorder_dreams`. Só aparece sem filtros, na aba principal.
- **Imagens:** bucket **privado** `dream-images`, caminho `{workspace_id}/{dream_id}/{cover|achieved}-{uuid}.{webp|jpg}`. O navegador valida (JPG/PNG/WEBP, até 5 MB), redimensiona para no máximo 1600 px e comprime em WEBP (JPEG no Safari) antes de enviar direto ao Storage. As policies do Storage exigem que o 1º segmento seja um workspace do usuário e o 2º um sonho desse workspace. As imagens aparecem por signed URL (1 hora), em `<img>` comum: o otimizador do Next guardaria cópias fora das regras do bucket.
- Excluir um sonho apaga as imagens antes da linha; excluir um workspace apaga a pasta dele no bucket antes (o banco não apaga arquivos do Storage).

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

Os scripts rodam no PowerShell. O `db:types` (`scripts/db-types.mjs`) só grava `src/types/database.ts` se a geração der certo: com o banco local parado, o arquivo fica intacto.

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
| Authentication → URL Configuration | **Site URL**: a URL da Vercel (ex.: `https://seu-app.vercel.app`). **Redirect URLs**: `https://seu-app.vercel.app/**` |
| Authentication → Sign In / Providers → Email | **Confirm email** ligado; tamanho mínimo de senha: 8 |
| Authentication → Emails → SMTP Settings | SMTP próprio (ver abaixo) |
| Authentication → Emails → Templates | Cole `supabase/templates/magic_link.html` em *Magic Link* e `confirmation.html` em *Confirm signup*, com os assuntos de `config.toml` |

### Email (Gmail SMTP)

1. Ative a verificação em duas etapas na conta Google e gere uma **senha de app** em https://myaccount.google.com/apppasswords.
2. No Supabase (SMTP Settings): host `smtp.gmail.com`, porta `465`, usuário = seu Gmail, senha = a senha de app, remetente = seu Gmail, nome "Adois".
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
| `SMTP_FROM` | `Adois <seu@gmail.com>` |

Variáveis `NEXT_PUBLIC_*` são embutidas no build. Depois de alterar alguma, faça **Redeploy**.

### Checklist de deploy

Antes de cada `git push` na `main`:

- [ ] `npm run check` e `npm run build` passam; `npm run test:db` passa (com o Supabase local rodando).
- [ ] Teve migration nova? `npm run db:push` e depois `npm run db:status:remote` (todas as linhas com "Remote" preenchido).
- [ ] Mudou `public/sw.js` de forma que exija limpar o cache? Suba o `VERSION` dele.

Uma vez (ou ao trocar de domínio):

- [ ] Supabase → URL Configuration: Site URL e Redirect URLs com o domínio da Vercel.
- [ ] Supabase → Confirm email ligado, senha mínima 8, SMTP próprio configurado, templates colados.
- [ ] Vercel → as variáveis da tabela acima em Production (e Preview, se usar). `SMTP_PASSWORD` como *Sensitive*. Nenhuma `sb_secret_...` em lugar nenhum.
- [ ] Backup manual de tempos em tempos: `npm run db:backup` (o plano grátis não tem backup automático e pausa o projeto após 7 dias sem uso).

Depois do deploy, no celular:

- [ ] Cadastro novo recebe o email de confirmação; magic link e convite chegam e abrem o app.
- [ ] Instalar o app (Mais → Aplicativo) e abrir pelo ícone: abre em tela cheia.
- [ ] Modo avião com o app aberto: aparece o aviso de sem conexão; ao recarregar, a página "Você está sem internet".

## PWA e offline

- **Instalável:** manifest (`src/app/manifest.ts`), ícones gerados em `src/app/icons/[variant]` e o card **Mais → Aplicativo**: no Chrome/Android ele mostra o botão de instalar; no iPhone/iPad, o passo a passo do Safari (Compartilhar → Adicionar à Tela de Início).
- **Service worker** (`public/sw.js`, escrito à mão, registrado só em produção): guarda apenas arquivos estáticos com hash (`/_next/static`), ícones, o manifest e a página `/offline`. **Páginas e dados logados nunca são guardados no aparelho**: a navegação vai sempre para a rede e, se ela cair, mostra `/offline`. POST (Server Actions), requisições RSC e chamadas ao Supabase passam direto. `sw.js` é servido com `Cache-Control: no-store` para as atualizações chegarem na próxima visita.
- **Queda de conexão com o app aberto:** `experimental.useOffline` (Next) segura navegações e Server Actions e as repete quando a conexão volta. O `OfflineBanner` avisa: um lançamento salvo sem sinal é enviado ao reconectar, desde que o app continue aberto.
- **Headers de segurança** em todas as rotas (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. HSTS vem da Vercel.
- Para testar o PWA localmente: `npm run build` e `npm run start` (o service worker não é registrado no `npm run dev`). No celular pela rede local é preciso HTTPS: `npm run dev:https` não registra o SW; prefira testar no deploy da Vercel.

## Convenções

- Interface em pt-BR; código, comentários, tabelas e colunas em inglês.
- Dinheiro é **sempre inteiro em centavos** (`bigint` no banco, `number` inteiro no TS). A conversão acontece só na exibição e na entrada.
- Datas de transação usam `date` e são calculadas no fuso `America/Sao_Paulo`; timestamps usam `timestamptz`.
- A segurança fica no banco (RLS). O app usa apenas a publishable key.
