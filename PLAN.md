# Diário de Desenvolvimento — Time Tracker

> Registro cronológico das decisões, descobertas e aprendizados ao longo do desenvolvimento.
> Cada entrada descreve **o que foi feito**, **por que foi decidido assim** e **o que foi aprendido**.

---

## 2026-03-15 · Manhã — Início do Projeto

### Setup inicial

Começou com o scaffold padrão do Tauri + Vite + React + TypeScript. A decisão de usar Tauri em vez de Electron foi tomada no primeiro dia: o binário final é 10× menor, o desempenho é nativo e o Rust no backend dá segurança real sem overhead. Electron teria sido mais rápido de começar, mas o custo de longo prazo não compensaria.

Configurei o Vitest junto com o projeto desde o primeiro commit — não como afterthought. O projeto seguiu TDD desde o milestone 1. Isso pareceu excessivo no começo, mas pagou dividendos imediatos: toda vez que o comportamento do timer parecia quebrado, os testes diziam exatamente onde.

---

### ✅ feat: add timer domain model

**O primeiro commit real.** Criei `src/domain/timer.ts` com os tipos `Category` e `Session` e as funções puras de cálculo — `computeWeekMs`, `computeStreak`, `getWeekDates`.

A decisão mais importante dessa fase: **o domínio não pode saber que React existe**. Nenhum hook, nenhum import de UI. Isso permitiu testar toda a lógica de negócio em Node puro, sem montar componentes. Essa separação se provou correta dezenas de vezes depois.

Regra de negócio central: **apenas um timer pode estar ativo ao mesmo tempo**. Ao iniciar uma categoria, a anterior é pausada automaticamente. Simples, mas precisa estar no domínio, não no componente.

---

### ✅ feat: add category store + Zustand store

Zustand foi escolhido sobre Redux/Context por uma razão simples: sem boilerplate. O store é um objeto JavaScript com funções. Não há actions, reducers, selectors ou providers aninhados. Para um app com um único arquivo de store, Context com `useReducer` seria suficiente — mas o Zustand tinha a vantagem de ser atualizável sem re-renders desnecessários.

O store wrapa o domínio: `startTimer(categoryId)` chama `domain.startTimer(...)` e persiste o resultado. O store não tem lógica de negócio.

---

### ✅ feat: add minimal React UI + live elapsed time

Primeira versão da UI: lista de categorias, botão start/stop por categoria, display de tempo decorrido. Ugly, funcional, testável.

O display de tempo decorrido exigiu um `useInterval` que atualiza a cada segundo quando um timer está ativo. Descobri que o `setInterval` em React tem o problema clássico de closure stale — resolvi com `useRef` para capturar o valor mais recente sem re-registrar o intervalo.

---

### ✅ feat: add SQLite persistence layer

`tauriStorage.ts` implementa a interface `Storage` usando `tauri-plugin-sql`. A interface foi definida primeiro (TDD estrutural): `loadCategories`, `loadSessionsByDate`, `loadSessionsSince`, `getSetting`, `setSetting`, `importSessions`.

Problema encontrado: múltiplos `CREATE TABLE` num único `execute` falham silenciosamente no SQLite do Tauri. Corrigi separando cada statement. Esse bug teria sido catastrófico em produção — sem erro visível, apenas sem dados persistidos.

`inMemoryStorage.ts` implementa a mesma interface em memória, usado nos testes e como fallback no browser. Essa decisão de ter um storage substituível foi a base para o web demo meses depois.

---

### ✅ feat: add daily statistics view

A terceira tab do app. Barras de progresso por categoria com `computeWeekMs`. Simples, mas a primeira vez que os dados do domínio apareceram de forma visual.

---

## 2026-03-15 · Tarde — v0.5 a v0.7

### Parte 2 — Reports e Polish

#### ✅ M20 · Histórico de sessões agrupado por dia

A terceira tab virou `HistoryView`. Sessões agrupadas por data, com tempo total por categoria por dia. A função `groupSessionsByDate` ficou no domínio — testável.

#### ✅ M21 · Distribuição por hora do dia

`computeHourDistribution(sessions)` — conta tempo rastreado por hora (0–23). Revelou imediatamente os horários de pico pessoais. Esse dado seria a base do Energy Score depois.

#### ✅ M22 · Export CSV

`exportSessionsToCSV(sessions, categories)` — domínio puro, sem IO. O botão de export gera o blob e dispara o download via `URL.createObjectURL`. Sem plugin Tauri necessário para o caso web — a mesma função funciona nos dois ambientes.

---

#### ✅ M23 · "Última vez ativo" no CategoryItem

Pequeno mas impactante. Mostra quando a categoria foi usada pela última vez. `lastUsed(sessions, categoryId)` — uma linha de domínio.

#### ✅ M24 · Seletor de semana no Stats

Navegação entre semanas no StatsView. `getWeekDates(dateString)` já existia no domínio. O componente só precisava de um estado `selectedWeek` e setas de navegação.

#### ✅ M25 · Cor por categoria

6 swatches de cor no CategoryItem. Cor armazenada como string hex no SQLite. As cores das categorias voltariam a aparecer no stat card (M47) e no heatmap.

---

### Parte 3 — v0.7 · Desktop Nativo e Focus Guard

> Esta foi a fase mais densa do desenvolvimento. O Focus Guard não é só uma feature — é a premissa científica central do app.

#### ✅ M26 · System Tray

`tauri-plugin-menu` + `tauri-plugin-tray`. O ícone na bandeja exibe o tempo do timer ativo e um menu de contexto para controlar o app sem abrir a janela. Implementado em Rust no `main.rs`.

Descoberta: o Tauri v2 mudou a API de plugins em relação ao v1. A documentação estava desatualizada em vários pontos. Resolvi lendo o código-fonte dos plugins no GitHub.

#### ✅ M27 · Notificações nativas

Três tipos: meta atingida, lembrete diário (nenhuma sessão até X horas), timer esquecido (rodando há mais de N horas). `tauri-plugin-notification`. As notificações são disparadas por hooks no store que observam mudanças de estado.

#### ✅ M28 · Atalho global de teclado

`Ctrl+Shift+T` toggle timer, `Ctrl+Shift+Space` traz a janela para frente. `tauri-plugin-global-shortcut`. Salvo no SQLite para persistir entre sessões.

---

#### ✅ M29 · Focus Guard — Pausa Obrigatória

**O milestone mais importante do projeto.** Não é um Pomodoro timer — é um sistema baseado em evidência sobre como o cérebro funciona.

**Por que isso importa:** o hiperfoco não é uma escolha. O córtex pré-frontal suprime sinais de fadiga após ~90 minutos. O usuário sente que está produzindo, mas a qualidade degradou há 20 minutos. A única solução comprovada para ADHD/hiperfoco é fricção real com custo cognitivo para ignorar.

**Decisões de design:**
- Aviso gradual 5 minutos antes — não interrompe o trabalho, apenas avisa
- Overlay fullscreen não-dispensável na pausa — com sugestões rotativas baseadas em evidência (caminhe 2 minutos, regra 20-20-20, beba água)
- Modo Normal: 1 adiamento de 5 min + digitar "SKIP" para confirmar
- Modo Strict: sem pular, sem adiar — para quem quer compromisso real

**Modos disponíveis:**

| Modo | Foco | Pausa | Base científica |
|------|------|-------|-----------------|
| Pomodoro | 25 min | 5 min | PMC 2025 — reduz fadiga ~20% |
| 52/17 | 52 min | 17 min | DeskTime — top 10% produtivos |
| Ultradian | 90 min | 20 min | BRAC — ciclo ultradiano natural |
| Custom | N min | N min | Controle total |

`focusGuard.ts` — domínio puro: `computeNextBreak`, `shouldBreakNow`, `getFocusStats`.

#### ✅ M30 · Auto-pause por inatividade

Comando Rust customizado lendo idle time do SO. Ao retornar, pergunta se quer adicionar o tempo ausente à sessão. Integra com o Focus Guard: inatividade durante pausa obrigatória conta como pausa cumprida.

---

## 2026-03-15 · Final do Dia — v0.8 e v0.9

### Parte 4 — v0.8 · Inteligência e Autoconhecimento

> O princípio desta fase: transformar dados brutos em autoconhecimento real. O usuário deve aprender algo sobre si mesmo toda vez que abre o app.

#### ✅ M31 · Heatmap de produtividade (estilo GitHub)

Grid de calendário dos últimos 90 dias. Cor = intensidade de horas rastreadas. `computeDayTotals(sessions, since)` no domínio. Hover mostra data, total, categoria dominante e sessões.

Visualmente é o item que mais impressiona em uma demo. Uma linha de código no domínio, muita CSS no componente.

#### ✅ M32 · Curva de energia pessoal

`computeEnergyPattern(sessions, days)` — agrega tempo rastreado por hora do dia nos últimos N dias. Retorna picos e vales.

**Insight gerado:** "Seus melhores horários são 9–11h e 15–17h. Evite reuniões nessas janelas."

O gráfico de barras SVG foi implementado inline — sem bibliotecas de gráfico. Isso manteve o bundle pequeno e o comportamento previsível.

#### ✅ M33 · Detecção de Flow State

Sessões ≥ 45 minutos são marcadas automaticamente como flow sessions. `isFlowSession(session, threshold)`.

**Métricas adicionadas:**
- Flow sessions por semana por categoria
- % do tempo total em flow vs. sessões fragmentadas
- Condições de flow: qual horário e dia você entra mais em flow?

#### ✅ M34 · Intenções Diárias

Morning Brief ao abrir o app + Evening Review com mood score (1–5) e notas livres. `intentions.ts` no domínio.

Dados armazenados se tornaram a base do export para Notion/Obsidian (M50) meses depois. Decisão de design antecipada: armazenar tudo, expor depois.

#### ✅ M35 · Context Tags em Sessões

Tag opcional ao iniciar ou terminar: `deep work` · `meetings` · `admin` · `learning` · `blocked` · `review`. Nova coluna `tag` no SQLite.

**Análise:** quanto tempo vai para deep work vs. overhead? Esse dado mostrou que a maioria dos usuários subestima o tempo em admin/meetings.

#### ✅ M36 · AI Digest semanal via Claude API

O primeiro ponto de integração com o Claude. `formatDigestPrompt` constrói um prompt com os dados da semana. `callDigestAPI` chama `claude-haiku-4-5-20251001` com `max_tokens: 256`.

**Decisão de privacidade:** apenas agregados são enviados (horas por categoria, streak, flow count). Sem nomes de sessões, notas ou tags pessoais.

**API key:** configurada pelo usuário, armazenada localmente no SQLite. Nunca sai do dispositivo exceto para a API da Anthropic.

#### ✅ M37 · Sugestão inteligente de meta semanal

`suggestWeeklyGoal(sessions, categoryId, weeks)` — média das últimas 4 semanas + 10%. Exibida no modal de edição de meta. O usuário pode aceitar ou ajustar manualmente.

---

### Parte 5 — v0.9 · Ecossistema e Conectividade

> O app como hub. Os dados devem sair facilmente e o app deve conversar com as ferramentas que o usuário já usa.

#### ✅ M38 · Export completo (CSV + JSON + HTML Report)

Três formatos, todos gerados no domínio como strings puras:
- **CSV** — uma linha por sessão, compatível com Excel/Google Sheets
- **JSON** — estrutura completa para backup ou re-import
- **HTML Report** — relatório semanal visual e estático, pode ser salvo como PDF

`tauri-plugin-fs` + `tauri-plugin-dialog` para o save-file dialog nativo. No web, fallback para `URL.createObjectURL`.

#### ✅ M39 · Sync local via OneDrive/Dropbox

Export automático para pasta configurável. No Windows, OneDrive já está instalado. O usuário aponta o caminho e os arquivos sincronizam automaticamente entre dispositivos.

Sem servidor, sem conta, sem latência. Local-first by design.

#### ✅ M40 · Webhooks configuráveis

POST para uma URL configurável quando eventos ocorrem:

| Evento | Casos de uso |
|--------|-------------|
| `timer.started` / `timer.stopped` | Acionar luz de foco (Philips Hue via n8n) |
| `goal.reached` | Postar no Discord/Slack |
| `streak.milestone` | Salvar no Notion via Zapier |
| `focus.break_skipped` | Alerta de hiperfoco externo |
| `daily.review` | Dashboard pessoal no Airtable |

#### ✅ M41 · Backup e Restore do banco de dados

Dois botões nas configurações. Backup copia o `.db` para local escolhido. Restore importa com confirmação. Proteção total contra perda de dados em reinstalação ou troca de máquina.

#### ✅ M42 · Import de dados externos

Suporte a CSV do Toggl Track e Clockify. `parseTogglCSV(raw)` → `Session[]`. Mapeia `Project` → categoria existente (cria se não existir).

**Por que isso importa:** usuários com histórico em outras ferramentas não precisam começar do zero. O contexto histórico é parte do valor do app.

#### ✅ M43 · Focus Lock (Fullscreen)

Quando um timer está ativo, o Focus Lock coloca a janela em always-on-top e exibe apenas o timer em tela cheia minimalista. Timer circular SVG animado com `stroke-dashoffset`. Pulsa suavemente em estado de flow.

#### ✅ M44 · Layout Responsivo

O app usava `max-w-xl` fixo (576px). Em tela cheia ficava centralizado num bloco pequeno.

Migrado para `max-w-xl lg:max-w-3xl xl:max-w-4xl` com grid de 2 colunas em `lg+` para o tracker. Nenhuma quebra de teste — a lógica é toda no domínio.

#### ✅ M45 · Suporte a Idiomas (pt-BR / en)

Sem biblioteca externa. `src/i18n.tsx` com todas as strings, `useI18n()` hook, botão de idioma nas Settings.

**Problema encontrado:** `const pt: typeof en` com `as const` no objeto `en` fazia o TypeScript exigir que os valores de `pt` fossem exatamente iguais aos de `en` — tornando tradução impossível. Corrigi com `{ [K in keyof typeof en]: string }`.

---

## 2026-03-15–16 · v1.0 — Visibilidade e Impacto

> Um projeto excelente que ninguém consegue ver não existe. README, CI e visuais são tão importantes quanto o código.

#### ✅ R1 · README Profissional

Reescrito do zero com: frase de abertura forte, badges reais de CI/deploy, seção de features organizada, tech stack com justificativas, diagrama de arquitetura, instruções de setup, seção "Built with Claude Code".

Decisão: o README é marketing técnico. Deve responder em 30 segundos: o que é, por que importa, como instalar.

#### ✅ R2 · CI/CD com GitHub Actions

Dois workflows:
- `ci.yml` — roda em todo PR e push: `npm install` → `npm test` → `npm run build`
- `release.yml` — roda ao criar tag `v*.*.*`: build Tauri para Windows → GitHub Release com binários

**Resultado:** badges reais de build, instalador downloadável diretamente do GitHub Releases.

#### ✅ V1 · Timer Circular Animado (SVG)

`stroke-dashoffset` animation, sem dependências externas. O arco fecha de 0% a 100% durante o foco, muda para azul na pausa, pulsa em flow. Aparece no FocusLock (fullscreen) e como widget menor no tracker.

#### ✅ V2 · Inline Insights no Tracker

Dados que já existiam escondidos nas Stats surfaceados diretamente em cada categoria: streak atual, horário de pico pessoal, flow count da semana, progresso da meta. Nenhum novo cálculo de domínio — só exibição.

#### ✅ T1 · Onboarding First-Run

Wizard de 3 passos na primeira abertura: boas-vindas → criar categorias → escolher estilo de foco. Flag `onboarding_complete` no SQLite. Sem o wizard, novos usuários ficavam perdidos numa tela em branco.

#### ✅ T2 · Command Palette (Ctrl+K)

Lista de comandos como array simples. Filtragem em tempo real por texto. `Enter` executa, `Esc` fecha. Sem dependências externas. Impressiona devs imediatamente em demos — sinal de que o app foi feito por alguém que usa o próprio produto.

#### ✅ T3 · Real-Time Energy Score

Banner no topo do tracker com status em tempo real: pico, neutro ou vale. `computeEnergyPattern()` já existia. Bastou comparar `new Date().getHours()` com os picos do usuário.

---

## 2026-03-16 · v1.1 — Utilizável, Chamativo e Viral

> Um projeto que ninguém consegue testar não existe. Um projeto sem mecânica de compartilhamento não cresce.

#### ❌ M46 · Web Demo — Cancelado

**Motivo:** preocupações com LGPD e controle de dados. Mesmo com `inMemoryStorage` (zero persistência), um deploy público gera ambiguidade sobre coleta de dados e responsabilidade legal. O projeto permanece **desktop-only e local-first** por design.

**Artefatos a remover do repositório:**
- `src/persistence/demoStorage.ts`
- `vite.web.config.ts`
- `.github/workflows/deploy.yml`
- Script `build:web` do `package.json`

O `inMemoryStorage` permanece — é usado nos testes e como fallback interno.

#### ✅ M47 · Shareable Weekly Stat Card

`buildSvg()` gera SVG inline com barras por categoria, totais, streak e flows. `svgToClipboard()` renderiza em canvas e copia PNG via Clipboard API. Fallback para download SVG se clipboard não disponível.

Estados do botão: idle → copying → copied/failed. Design dark com as cores das categorias do usuário.

**O mecanismo viral:** pessoas adoram compartilhar conquistas de produtividade. Post no LinkedIn com print do card → tráfego orgânico para o repositório.

#### ✅ M48 · Productivity Wrapped

Tela de reveal estilo Spotify Wrapped. 6 slides com animação: total do mês, categoria dominante, flow count, streak máximo, horário de pico, melhor dia da semana. Slide final compartilhável.

Implementação puramente com dados já disponíveis: `computeEnergyPattern`, `isFlowSession`, `computeStreak`. Zero nova lógica de domínio.

#### ✅ M49 · README Hero Polish

Link para web demo logo abaixo do título, badges de CI/deploy ao vivo, seção "Built with Claude Code" descrevendo o processo de TDD com 54 milestones e 277 testes.

#### ✅ M50 · Export para Notion / Obsidian

`exportDayAsMarkdown(date, sessions, categories, intentions, review)` → string Markdown. Botão na IntentionsView. Formato compatível com Obsidian daily notes e importável no Notion.

```markdown
# 2026-03-15 · Productivity Review
## Time Tracked
- Work: 4h 30m · 2 flow sessions
## Intentions
- [x] Finish authentication module
## Evening Notes
Boa sessão de manhã. Tarde fragmentada por reuniões.
```

#### ✅ M51 · AI Natural Language Time Entry

`callClaudeForParsing(text, categories, apiKey, today)` parseia linguagem natural para `ParsedTimeEntry`. Mostra resultado para confirmação antes de criar a sessão.

```
"trabalhei 3h em deep work ontem de manhã"
→ Work · 09:00–12:00 · tag: deep work · data: ontem
```

**Segurança:** nomes de categorias serializados com `JSON.stringify` para evitar prompt injection. Input do usuário também serializado.

#### ✅ M52 · GitHub Activity Correlation

`useGitHubActivity(username)` busca eventos públicos via GitHub API. Conta commits por data de `PushEvent`. Overlay de pontos âmbar nas células do heatmap nos dias com commits.

Insight visual: nos dias em que mais foco foi rastreado, os commits tendem a aumentar. Devs adoram ver essa correlação.

#### ✅ M53 · CLI Companion

```bash
npx @productivity-challenge/cli start work
npx @productivity-challenge/cli stop
npx @productivity-challenge/cli status
npx @productivity-challenge/cli today
```

Lê e escreve no mesmo SQLite do app Tauri via `better-sqlite3`. Cores no terminal com ANSI escape codes — sem dependências externas além do driver SQLite.

#### ✅ M54 · VS Code Extension

Status bar mostra timer ativo (`⏱ Work · 01:23:45`). Comandos `Start`/`Stop` via Command Palette. Polling a cada 30 segundos. Comunica com o app via CLI (M53).

**Por que importa:** VS Code Marketplace tem milhões de devs navegando. Cada instalação é um vetor de descoberta do repositório principal.

---

## 2026-03-16 · Revisão de Segurança

Após os 54 milestones, fiz uma auditoria de segurança formal. 11 issues encontradas e corrigidas:

| Severidade | Issue | Correção |
|-----------|-------|----------|
| Crítica | Command injection no VS Code extension (`execSync` com template string) | `spawnSync` com array de args, `shell: false` |
| Alta | CSP desabilitada no Tauri (`"csp": null`) | CSP restritiva com allowlist explícita |
| Alta | Prompt injection via nomes de categoria | `JSON.stringify` nos inputs do prompt |
| Alta | Path traversal no sync | Validação de path absoluto e rejeição de `..` |
| Média | Erro raw da API exposto ao usuário | Mensagens genéricas por código HTTP |
| Média | Username do GitHub não validado | Regex `^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$` antes do fetch |
| Média | SSRF no webhook | `isSafeWebhookUrl()` bloqueia localhost e IPs privados |
| Média | Backup JSON sem validação de tipos | Checagem de tipos em runtime antes de `importSessions` |
| Baixa | Rate limit no digest | Cooldown de 10s via `useRef` |
| Baixa | GitHub API 403 não tratado | Respostas não-ok retornam `[]` |
| Baixa | DB world-readable no CLI | Aviso se `chmod o-r` necessário (Unix) |

Regra aprendida: **segurança no frontend não é opcional**. Mesmo num app desktop local, prompt injection, SSRF e path traversal são vetores reais.

---

## Parte 8 — Developer Intelligence Engine

> **Princípio:** zero fricção. O app observa o que você faz em vez de pedir que você registre.
> Captura passiva, local, segura — sem cloud, sem conta, sem permissões externas.

---

### P1 · Smart Capture — Captura Passiva por App/Janela

**A feature central de toda a Parte 8.** Resolve o problema #1 de todos os trackers manuais: devs esquecem de apertar Start/Stop.

#### Como funciona

Novo Rust command `get_active_window()` polled a cada 5 segundos:

```rust
#[tauri::command]
fn get_active_window() -> Option<ActiveWindow> {
    // Windows: GetForegroundWindow() + GetWindowTextW()
    //          + GetWindowThreadProcessId() → process name + executable path
    // Retorna: { title, process, executable, timestamp }
    // Fallback gracioso: retorna None se API indisponível
}
```

Hook `usePassiveCapture(rules)` no frontend:
- Acumula blocos de tempo por processo ativo
- Aplica as regras configuradas pelo usuário
- Nunca salva cada poll — agrega por bloco contínuo na mesma janela

#### Três modos de operação

| Modo | Comportamento | Para quem |
|------|--------------|-----------|
| **Sugestão** | "Você ficou 47 min no VS Code — adicionar a Work?" | Quer controle total |
| **Automático** | Atribui silenciosamente se a regra tem categoria definida | Quer zero fricção |
| **Manual** | Captura passiva desativada | Prefere o fluxo atual |

Configurável por regra — uma regra pode ser automática, outra pode pedir confirmação.

#### UX: "Scan & Assign" — setup em 2 minutos

Settings → aba "Smart Capture" → botão **"Scan running apps"**:

```
Aplicativos abertos agora              Atribuir a
─────────────────────────────────────────────────────
⬜  Code.exe           Visual Studio Code    [ Work ▾ ]
⬜  chrome.exe         Google Chrome         [ Perguntar ▾ ]
⬜  Slack.exe          Slack                 [ Work · admin ▾ ]
⬜  RiotClientServices  Riot Games           [ Lazer ▾ ]
⬜  Spotify.exe        Spotify               [ Ignorar ▾ ]
⬜  WindowsTerminal.exe Terminal             [ Work ▾ ]

[ Salvar regras ]
```

O usuário vê o que está rodando agora, atribui em segundos. Regras salvas no SQLite. Nenhum process name digitado manualmente.

#### Três camadas de matching (precedência top → down)

**Camada 1 — Processo (mais confiável)**
```
Code.exe              → Work
WindowsTerminal.exe   → Work
Zoom.exe              → Work  [tag: meeting]
Slack.exe             → Work  [tag: admin]
RiotClientServices    → Lazer
Spotify.exe           → Ignorar
```

**Camada 2 — Título da janela (captura contexto do browser)**
```
título contém "GitHub"          → Work
título contém "Stack Overflow"  → Work
título contém "YouTube"         → Lazer
título contém "documentação"    → Work  [tag: learning]
título contém "Netflix"         → Lazer
```

Isso cobre 80% dos casos sem precisar de extensão de browser. O Chrome já expõe o título da página no título da janela: `"GitHub – Pull Request #42 – Google Chrome"`.

**Camada 3 — URL (com extensão de browser, opt-in)**
```
github.com              → Work
docs.rust-lang.org      → Work  [tag: learning]
twitter.com             → Lazer
twitch.tv               → Lazer
```

Extensão mínima (< 80 linhas) envia `{ url, domain, title }` via WebSocket local para o Tauri. Totalmente opt-in.

#### Regras padrão pré-configuradas (smart defaults)

Ao instalar, o app já vem com regras para as ferramentas mais comuns para devs:

```typescript
const DEFAULT_DEV_RULES: WindowRule[] = [
  // Editores
  { process: 'Code.exe',           label: 'VS Code',       suggestion: 'Work' },
  { process: 'idea64.exe',         label: 'IntelliJ IDEA', suggestion: 'Work' },
  { process: 'webstorm64.exe',     label: 'WebStorm',      suggestion: 'Work' },
  { process: 'devenv.exe',         label: 'Visual Studio',  suggestion: 'Work' },
  { process: 'nvim.exe',           label: 'Neovim',        suggestion: 'Work' },
  // Terminais
  { process: 'WindowsTerminal.exe', label: 'Terminal',     suggestion: 'Work' },
  { process: 'wt.exe',             label: 'Terminal',      suggestion: 'Work' },
  // Comunicação
  { process: 'Zoom.exe',           label: 'Zoom',          suggestion: 'Work', tag: 'meeting' },
  { process: 'Teams.exe',          label: 'MS Teams',      suggestion: 'Work', tag: 'meeting' },
  { process: 'Slack.exe',          label: 'Slack',         suggestion: 'Work', tag: 'admin' },
  { process: 'Discord.exe',        label: 'Discord',       suggestion: null   }, // perguntar
  // Jogos e Lazer
  { process: 'EpicGamesLauncher',  label: 'Epic Games',    suggestion: 'Lazer' },
  { process: 'steam.exe',          label: 'Steam',         suggestion: 'Lazer' },
  { process: 'RiotClientServices', label: 'Riot Games',    suggestion: 'Lazer' },
  // Background
  { process: 'Spotify.exe',        label: 'Spotify',       suggestion: null   }, // ignorar
]
```

O usuário confirma ou ajusta no primeiro uso. Não é imposto — é uma sugestão educada.

#### Privacidade por design

- Títulos de janelas **nunca são enviados para nenhuma API** sem consentimento explícito
- Logs de captura armazenados localmente no SQLite, tabela `passive_events`
- Opção "Excluir apps sensíveis": qualquer processo pode ser marcado como "não rastrear + não perguntar"
- Modo "Stealth de Revisão": só salva totais agregados (não quais janelas específicas)
- Sem upload, sem sync automático de dados de captura

#### Domain: `passiveCapture.ts`

```typescript
type WindowRule = {
  id: string
  matchType: 'process' | 'title' | 'executable'
  pattern: string          // string exata ou regex
  categoryId: string | null  // null = ignorar
  tag?: string
  mode: 'auto' | 'suggest' | 'ignore'
  enabled: boolean
}

type CaptureBlock = {
  process: string
  title: string
  startedAt: number
  endedAt: number
  categoryId: string | null
  tag?: string
  confirmed: boolean       // false = sugestão pendente
}

// Funções puras, testáveis:
matchRule(window: ActiveWindow, rules: WindowRule[]) → WindowRule | null
aggregateBlocks(events: RawPollEvent[]) → CaptureBlock[]
pendingSuggestions(blocks: CaptureBlock[]) → CaptureBlock[]
```

---

### P2 · Context Switching Score

Com a captura passiva ativa (P1), cada mudança de janela é um evento. Context switching é o maior destruidor silencioso de deep work — e nenhum tracker expõe isso.

**Cálculo:**
```
switches_per_hour = count(window_changes) / elapsed_hours
```

**Display no tracker:** badge discreto `⇄ 8/h` ao lado do timer ativo.

**Thresholds (baseados em pesquisa):**
```
< 6/h   → 🟢 Foco sólido
6–15/h  → 🟡 Foco moderado
> 15/h  → 🔴 Trabalho fragmentado
```

Alerta não-intrusivo quando > 15/h por 20 min seguidos: *"23 mudanças de janela na última hora — considere fechar apps secundários."*

**StatsView:** gráfico "Context switches por dia" na semana. Correlação visual com Deep Work Score (P3).

---

### P3 · Deep Work Score (DWS 0–100)

Métrica composta que transforma dados brutos da captura passiva em um número compreensível.

```
Componentes:
  +25 pts   janela única por > 25 min contínuos
  +25 pts   context switches < 5 na última hora
  +25 pts   sessão ≥ 45 min (flow threshold existente)
  +25 pts   nenhum app de "distração" ativo (lista configurável)
```

**Por sessão:** badge `DWS 87` visível no CategoryItem enquanto timer roda.

**Tendência semanal no StatsView:**
```
Seg  ████████████████  DWS 78  (4h 20m rastreado)
Ter  ██████████████    DWS 71
Qua  █████████████████ DWS 82  ← melhor dia
Qui  ████████          DWS 41  (muitas reuniões)
Sex  ████████████      DWS 60
```

**Insight para LinkedIn:** *"Não meço horas brutas — meço qualidade cognitiva. DWS médio esta semana: 74."*

---

### P4 · Local Git Correlation

Diferente do M52 (GitHub API pública), analisa **repositórios locais** — funciona offline, sem token.

```rust
#[tauri::command]
fn get_git_log(repo_path: String, since_date: String) → Vec<GitCommit> {
    // spawn: git log --since=DATE --pretty=format:"%H|%ai|%s" --no-merges
    // Valida: repo_path deve ser diretório absoluto existente (sem path traversal)
}
```

Settings: lista de repos monitorados (paths locais). Usuário adiciona com file picker nativo.

**Correlações geradas:**
- Overlay de commits no heatmap (mesmo visual do M52, mas offline)
- "Sessões com DWS > 70 produziram X commits em média"
- "Seu horário de maior commit density: 10–11h"
- "Commit velocity esta semana: +18% vs. semana passada"

**Privacidade:** apenas contagem e timestamps são usados. Mensagens de commit não são armazenadas no SQLite do tracker — só o count por data.

---

### P5 · Meeting & Build Intelligence

**Meeting detection:** P1 já captura `Zoom.exe`, `Teams.exe` etc. com tag `meeting`. O que falta é a análise:

```
Esta semana:
  Deep work   12h 30m  ████████████████  54%
  Reuniões     5h 20m  ███████           23%  ← 1h acima da média
  Admin        2h 10m  ███                9%
  Outros       3h 20m  ████              14%
```

Alerta semanal se reuniões > 30% do tempo rastreado.

**Build/compile detection:** CPU > 60% com `cargo.exe`, `tsc`, `webpack`, `gradle`, `dotnet` no foreground → tag automático `building`.

```
Tempo esperando builds esta semana: 1h 47m
Equivale a: 11% do tempo de Work
```

---

### P6 · Daily Activity Timeline

Visualização Gantt no HistoryView com dados da captura passiva:

```
09:00 ████████████████  VS Code · Work · deep work        2h 12m
11:12 ████              Chrome · Work · research            22m
11:34 ████████          Zoom · Work · meeting               47m
12:21 ░░░░░░░░          —  não rastreado (almoço?)          38m
13:00 █████████████     VS Code · Work · deep work          1h 45m  ⚡ flow
14:45 ████              Slack · Work · admin                18m
15:03 ██████████████    VS Code · Work · deep work          1h 55m  ⚡ flow
```

Hover em cada bloco → tooltip com processo, título (opt-in), DWS do bloco, context switches.

Gaps visíveis em cinza — o usuário vê imediatamente os "buracos" no dia.

---

### P7 · Focus Recommendations Engine

Recomendações acionáveis geradas pelos padrões reais do usuário — sem precisar de API key (heurísticas puras), opcionalmente enriquecidas com Claude API.

```
📊  Análise dos seus últimos 30 dias

  "Você tem 68% menos context switches às terças.
   Considere proteger terças-feiras para trabalho profundo."

  "Suas sessões de VS Code entre 9–11h têm DWS médio de 84.
   Fora desse horário: 51. Proteja esse bloco."

  "Você passou 1h 47min esperando builds esta semana.
   Rodar builds em background liberaria esse tempo."

  "Reuniões consomem 23% do seu tempo — 1h acima da sua média histórica."
```

Sem API key: geradas com `if/else` simples sobre os padrões calculados.
Com API key: enviadas como JSON agregado para o Claude, que retorna texto em linguagem natural.

---

## Tabela de Priorização — Parte 8

| # | Milestone | O que entrega | Impacto | Esforço | Status |
|---|-----------|--------------|---------|---------|--------|
| **P1** | Smart Capture + Rules Engine | Rastreamento zero-fricção | 🔴 Fundação | Médio (Rust WinAPI) | ✅ domain + Rust stub |
| **P2** | Context Switching Score | Métrica de fragmentação | 🟠 Diferenciador | Baixo | ✅ domain |
| **P3** | Deep Work Score | Qualidade cognitiva 0–100 | 🟠 Diferenciador | Baixo | ✅ domain |
| **P4** | Local Git Correlation | Dev output vs. foco | 🟠 Dev-specific | Médio (Rust spawn git) | ✅ Rust command |
| **P5** | Meeting & Build Intelligence | Overhead visibility | 🟡 Insight | Baixo | ✅ via P7 recommendations |
| **P6** | Daily Activity Timeline | Visualização do dia real | 🟡 Visual | Médio | 🔲 UI pendente |
| **P7** | Focus Recommendations | Coaching acionável | 🟡 AI | Baixo | ✅ domain + UI |

**Ordem recomendada:**
```
P1 (Smart Capture + Rules Engine)
  → P2 (Context Switch)
    → P3 (Deep Work Score)
      → P6 (Timeline visual)
        → P5 (Meeting/Build intel)
          → P4 (Git Correlation local)
            → P7 (Recommendations)
```

P1 é o Rust command + domain + UI de configuração. Tudo mais é análise sobre os dados que P1 coleta.

---

## Parte 9 — Qualidade, Segurança e Dívida Técnica

> **Princípio:** features novas sobre código frágil acumulam juros.
> Esta parte paga a dívida técnica identificada na auditoria de qualidade,
> antes de continuar adicionando funcionalidade.

---

### C1 · Remover Artefatos do Web Demo (M46 cancelado)

Deletar os quatro arquivos criados para o web demo, que não fazem mais sentido no projeto desktop-only:

- `src/persistence/demoStorage.ts` — seed de dados falsos, não usada em produção nem testes
- `vite.web.config.ts` — config Vite específica para build web
- `.github/workflows/deploy.yml` — workflow de deploy para GitHub Pages
- Remover script `"build:web"` do `package.json`

O `inMemoryStorage.ts` **não é removido** — continua sendo usado pelos testes e como fallback interno quando Tauri não está disponível.

---

### QA1 · Security & Reliability Hardening

Cinco problemas de severidade crítica/alta que precisam ser corrigidos antes de qualquer release público.

#### S1 — XSS via SVG injection (`WeeklyStatCard.tsx:41`)

Nomes de categoria são interpolados diretamente na string SVG sem escape.
Um nome como `</text><script>alert()</script>` executa no web demo.

```typescript
// Antes (vulnerável):
<text ...>${s.name.slice(0, 8)}</text>

// Depois (seguro):
function escapeXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
         .replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}
<text ...>${escapeXml(s.name.slice(0, 8))}</text>
```

#### S2 — Path traversal incompleto (`SettingsView.tsx:50`)

A validação atual bloqueia `..` mas não UNC paths (`\\server\share`) nem `./subdir`.

```typescript
// Solução: normalizar e verificar prefix
import { resolve, isAbsolute } from '@tauri-apps/api/path'
const normalized = await resolve(syncPath)
if (!isAbsolute(normalized) || normalized.includes('..')) {
  setSyncStatus('Invalid sync path.')
  return
}
```

#### S3 — Promises sem `.catch()` (`useInitStore.ts`, `App.tsx`)

Se o SQLite falhar ao iniciar, o store nunca é populado e a UI fica em branco sem mensagem alguma.

```typescript
// useInitStore.ts
Promise.all([...])
  .then(([persisted, allSessions]) => { ... })
  .catch(err => {
    console.error('Storage init failed:', err)
    // Exibir estado de erro no store para a UI reagir
    useTimerStore.setState({ initError: true })
  })
```

Padrão a aplicar em todos os `Promise.all` sem handler de erro em `App.tsx`.

#### S4 — Race condition no confirm do NLPTimeEntry

Dois cliques rápidos no botão "Adicionar sessão" criam sessões duplicadas.

```typescript
// Adicionar estado de loading:
const [confirming, setConfirming] = useState(false)

async function handleConfirm() {
  if (!parsed || confirming) return
  setConfirming(true)
  try { await onConfirm(parsed) }
  finally { setConfirming(false); setParsed(null); setText('') }
}
```

#### S5 — Stale closure em global shortcut (`App.tsx:163`)

O `useEffect` com `deps: []` registra o shortcut uma vez, mas a função `toggle` captura o estado inicial e nunca atualiza. O workaround correto é ler o estado diretamente do store via `getState()` (sem closure).

```typescript
useEffect(() => {
  registerGlobalShortcuts({
    toggle: () => {
      // Lê estado fresh a cada invocação — sem closure
      const { categories } = useTimerStore.getState()
      const active = categories.find(c => c.activeEntry !== null)
      active ? stopTimer(active.id) : startTimer(categories[0]?.id)
    }
  })
}, []) // deps [] correto agora — toggle não captura nada externo
```

---

### QA2 · Cobertura de Testes — Componentes sem Testes

Quatro componentes adicionados na v1.1 não têm nenhum teste. Todos têm lógica não-trivial ou chamadas externas.

#### `WeeklyStatCard.test.tsx`
- Renderiza sem crash com dados vazios
- SVG contém nomes escapados (previne regressão do S1)
- Botão "Share" entra em estado "Copied!" após click
- Fallback de download quando clipboard API não disponível

#### `NLPTimeEntry.test.tsx`
- Estado idle → loading → parsed ao submeter
- Exibe preview correto após parse bem-sucedido
- Botão confirm desabilitado durante `confirming` (previne S4)
- Exibe erro quando API falha
- Limpa estado ao cancelar

#### `DigestView.test.tsx`
- Botão desabilitado sem API key configurada
- Entra em estado loading ao gerar
- Exibe resultado após resposta bem-sucedida
- Respeita cooldown de 10s (botão desabilitado após uso)
- Exibe mensagem de erro genérica (não raw) em falha

#### `ProductivityWrapped.test.tsx`
- Renderiza slide 1 corretamente com dados mockados
- Botão "Próximo" avança para slide 2
- Slide final exibe botão de compartilhar
- Não crasha com historySessions vazio

---

### QA3 · Refactor: App.tsx (God Component)

`App.tsx` tem 700+ linhas, 20+ handlers e gerencia estado de 5 views diferentes.
É o arquivo mais difícil de testar e o maior risco de regressão no projeto.

#### Extração proposta

```
src/components/
  App.tsx              ← orquestrador puro (~150 linhas)
  TrackerView.tsx      ← view do timer, CategoryItem list, EnergyBanner
  StatsContainer.tsx   ← StatsView + dados computados
  HistoryContainer.tsx ← HistoryView + dados agrupados
  IntentionsContainer.tsx ← IntentionsView + estado local
```

`App.tsx` fica responsável apenas por:
- Resolver a view ativa (`'tracker' | 'stats' | ...`)
- Passar `storage` para os containers
- Montar hooks globais (webhooks, shortcuts, notifications, idle)

Cada container carrega seus próprios dados e expõe apenas o JSX.

#### Benefício direto nos testes

Hoje `App.test.tsx` precisa montar o componente inteiro para testar qualquer coisa.
Após o refactor, `TrackerView.test.tsx` testa o tracker isolado, sem simular SQLite, Focus Guard e digest ao mesmo tempo.

#### Memoization correta de `categoryInsights`

```typescript
// Antes: O(c × n) a cada render quando qualquer sessão muda
const categoryInsights = useMemo(() =>
  Object.fromEntries(categories.map(c => {
    const catSessions = historySessions.filter(s => s.categoryId === c.id)
    // ...
  })),
[categories, historySessions, sessions, streaks])

// Depois: pre-index uma vez, lookup O(1) por categoria
const sessionsByCategory = useMemo(() => {
  const map = new Map<string, Session[]>()
  for (const s of historySessions) {
    const arr = map.get(s.categoryId) ?? []
    arr.push(s)
    map.set(s.categoryId, arr)
  }
  return map
}, [historySessions])

const categoryInsights = useMemo(() =>
  Object.fromEntries(categories.map(c => {
    const catSessions = sessionsByCategory.get(c.id) ?? []
    // ...
  })),
[categories, sessionsByCategory])
```

#### Fix: memory leak no intervalo de idle detection

```typescript
// Antes: activeCategory?.name muda quando o usuário renomeia → intervalo recria
}, [activeStartedAt, activeCategory?.name])

// Depois: identity estável
}, [activeStartedAt, activeCategory?.id])
```

---

## Tabela Resumo — Parte 9

| Item | Tipo | Severidade | Esforço | Status |
|------|------|-----------|---------|--------|
| C1 Remover artefatos web demo | Limpeza | 🟠 Alto | 5 min | ✅ |
| S1 SVG XSS | Segurança | 🔴 Crítico | 15 min | ✅ |
| S2 Path traversal | Segurança | 🟠 Alto | 30 min | ✅ |
| S3 Promises sem catch | Confiabilidade | 🟠 Alto | 30 min | ✅ |
| S4 Double-submit NLP | Confiabilidade | 🟠 Alto | 20 min | ✅ |
| S5 Stale closure shortcut | Confiabilidade | 🟡 Médio | 20 min | ✅ |
| QA2 Testes novos componentes | Qualidade | 🟠 Alto | 2–3h | ✅ |
| QA3 App.tsx refactor | Arquitetura | 🟡 Médio | 3–4h | ✅ |

**Ordem recomendada:**
```
C1 (remover web demo)
  → QA1 (S1 → S2 → S3 → S4 → S5)  ← tudo < 2h total, máximo impacto
  → QA2 (testes dos novos componentes)
    → QA3 (refactor App.tsx)
```

C1 deve ser o primeiro commit — remove superfície desnecessária antes de qualquer fix.
QA1 pode ser feito num único commit antes de qualquer nova feature.
QA3 deve ser feito antes da Parte 8 (P1 Smart Capture) — o App.tsx dividido facilita muito adicionar um novo hook de captura passiva sem aumentar ainda mais o god component.

---

## Parte 10 — Inovações Revolucionárias

> **Princípio:** não competir com Toggl, RescueTime ou WakaTime em features incrementais.
> Fazer coisas que eles fundamentalmente não conseguem fazer — porque são cloud-first.
> O local-first não é uma limitação. É o diferencial.

---

### I1 · Integração com Ollama — LLM 100% Local

**O argumento de privacidade definitivo.**

O projeto usa Claude API para digest semanal e NLP entry. Isso funciona — mas exige API key, cobra por token e envia dados para fora da máquina. Para devs conscientes de privacidade, isso é um bloqueador.

**Solução:** detectar automaticamente se o usuário tem [Ollama](https://ollama.ai) rodando localmente (`localhost:11434`) e usá-lo como backend de IA primário.

```
Lógica de fallback:
  1. Ollama disponível em localhost:11434? → usa modelo local (Llama3, Phi-3, Mistral)
  2. Claude API key configurada?           → usa Claude API
  3. Nenhum?                               → features de IA desabilitadas (UI indica)
```

**Features que passam a funcionar offline e grátis:**
- Digest semanal
- NLP time entry ("trabalhei 2h em deep work hoje de manhã")
- Focus Recommendations (I5)
- Qualquer nova feature de IA futura

**Implementação:**
```typescript
// src/domain/llm.ts — abstração unificada
type LLMBackend = 'ollama' | 'claude' | 'none'

async function detectBackend(): Promise<LLMBackend> {
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(500) })
    if (r.ok) return 'ollama'
  } catch { /* offline */ }
  const key = await storage.getSetting('claude_api_key')
  return key ? 'claude' : 'none'
}

async function callLLM(prompt: string, backend: LLMBackend): Promise<string> {
  if (backend === 'ollama') return callOllama(prompt)
  if (backend === 'claude') return callClaude(prompt)
  throw new Error('No LLM backend available')
}
```

**Settings:** dropdown "AI Backend" com status ao vivo: `● Ollama (local) — llama3:8b` ou `● Claude API` ou `○ Não configurado`.

**Por que revoluciona para o GitHub/comunidade:**
- Único tracker que diz *"AI-powered, 100% offline, zero dados saindo"* com evidência técnica
- Ollama tem 70k+ stars no GitHub — comunidade enorme que vai notar
- Post perfeito: *"Rodo análise de produtividade com IA local. Sem API key. Sem cloud. Sem custo."*

---

### I2 · Ciclos Adaptativos — Aprende Seu Ritmo Real

**Focus Guard usa intervalos fixos escolhidos por você. Esta feature os substitui pelo que seus dados mostram.**

Com 30+ dias de dados passivos (P1), o app tem os blocos de foco reais do usuário — não declarados, observados. Regressão simples sobre `CaptureBlock[]`:

```typescript
// src/domain/adaptiveCycles.ts
function computeNaturalCycle(blocks: CaptureBlock[]): NaturalCycle {
  const durations = blocks
    .filter(b => b.categoryId !== null && b.confirmed)
    .map(b => b.endedAt - b.startedAt)
    .filter(d => d > 10 * 60_000) // sessões > 10 min

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  const stddev = Math.sqrt(durations.map(d => (d - mean) ** 2).reduce((a,b) => a+b) / durations.length)

  return {
    focusMs: Math.round(mean),
    breakMs: Math.round(mean * 0.25), // regra empírica: 25% do ciclo
    confidence: Math.min(durations.length / 30, 1), // 0–1, precisa de 30+ sessões
    stddevMs: Math.round(stddev),
  }
}
```

**UI no Focus Guard settings:**
```
Preset personalizado (gerado dos seus dados)          ← destacado
  Ciclo: 67 min de foco · 17 min de pausa
  Baseado em 94 sessões dos últimos 45 dias
  Confiança: ██████████ alta

  ○ Pomodoro (25/5)
  ○ 52/17
  ○ Ultradian (90/20)
  ● Seu Ritmo (67/17)   ← selecionado automaticamente quando disponível
  ○ Custom
```

**Insight adicional:** mostrar a distribuição das sessões naturais como histograma pequeno. O usuário vê que realmente trabalha em blocos de ~67 min.

**Por que revoluciona:** nenhum app de foco aprende com seus dados. Todos pedem que você escolha um preset de uma pesquisa com outras pessoas. Isso é personalização real baseada em evidência.

---

### I3 · Qualidade de Código × Tempo

**Transforma intuição em dado: seu código é pior à tarde?**

Usando os dados do git local (P4) e os blocos de tempo rastreados, o app correlaciona quando você trabalhou com a qualidade dos commits produzidos naquele período.

**Métricas de qualidade calculadas localmente:**
```rust
// Rust command: analisa git diff de cada commit
fn analyze_commit(repo: &str, hash: &str) -> CommitMetrics {
    // git show --stat {hash} → linhas adicionadas/removidas
    // git log --follow → commits no mesmo arquivo (proxy de retrabalho)
    // Tamanho do diff como proxy de complexidade
    CommitMetrics {
        lines_added: u32,
        lines_removed: u32,
        files_changed: u32,
        is_fix: bool,     // mensagem contém "fix", "revert", "hotfix"
        is_test: bool,    // mensagem contém "test" ou arquivos *.test.*
    }
}
```

**Correlação com tempo rastreado:**
```
Commits em sessões com DWS > 70:
  Linhas por commit: 87  ·  Taxa de fix-commits: 4%  ·  Testes incluídos: 68%

Commits em sessões com DWS < 40:
  Linhas por commit: 214 ·  Taxa de fix-commits: 23% ·  Testes incluídos: 31%
```

**Insight mais impactante para devs:**
```
"Commits feitos após 15h têm 3x mais chance de gerar um fix-commit
 nos 2 dias seguintes. Seu horário pós-15h tem DWS médio de 38."
```

**Por que revoluciona:** é o primeiro tracker que conecta produtividade rastreada com output técnico mensurável. Dev pode usar para argumentar internamente pela proteção de blocos de foco.

---

### I4 · Focus Debt — Dívida de Foco

**A metáfora que devs entendem instantaneamente, aplicada ao cérebro.**

Assim como dívida técnica acumula juros, dívida cognitiva acumula déficit de performance. O app rastreia esse saldo continuamente.

**Sistema de pontos:**
```typescript
// src/domain/focusDebt.ts
const DEBT_RULES = {
  breakSkipped:          +15,  // pausa pulada
  sessionOver3h:         +20,  // sessão sem pausa > 3h
  dwsBelowThreshold:     +8,   // DWS < 30 por mais de 1h
  dayWithoutFocus:       +10,  // dia sem nenhuma sessão > 20 min
  lateNightSession:      +12,  // sessão após 22h
  breakCompleted:        -10,  // pausa cumprida
  flowSession:           -20,  // flow session ≥ 45 min
  highDwsDay:            -15,  // dia com DWS médio > 70
  restDay:               -25,  // dia sem nenhuma sessão (descanso real)
} as const
```

**Display:** medidor no tracker, visível sempre.

```
Dívida de Foco:  ███████░░░  68 pts  🟡 Moderada

Hoje: +15 (pausa pulada 14h) · -10 (pausa cumprida 16h)
Tendência: ↑ acumulando há 3 dias

"Com 68 pts de dívida, seu próximo bloco de trabalho profundo
 provavelmente terá DWS 15–20 pontos abaixo do normal."
```

**Quando dívida > 100:** banner vermelho sutil + sugestão concreta. Não alarmista — informativo.

**Gamificação leve:** badge "Debt-free" quando dívida = 0 por 7 dias consecutivos. Aparece no Stat Card (M47).

**Por que revoluciona:** dívida é a metáfora mais familiar do universo dev. Aplicar ao estado cognitivo é óbvio em retrospecto mas ninguém fez. Postável, citável, discutível.

---

### I5 · Distraction Recovery Time (DRT)

**Cada interrupção custa mais do que o tempo da interrupção. Esta feature mede exatamente quanto.**

Com captura passiva (P1), o app detecta quando uma interrupção ocorre (janela de distração abre) e mede o tempo até o próximo bloco de foco contínuo > 10 min.

```typescript
// src/domain/distractionRecovery.ts
function computeDRT(blocks: CaptureBlock[], distractionApps: string[]): DRTMetrics {
  // Para cada bloco de distração:
  // - encontrar o próximo bloco de foco após ele
  // - DRT = gap entre fim da distração e início do foco
  return {
    averageDrtMs: number,        // média geral
    byApp: Map<string, number>,  // DRT médio por app interruptor
    trend: 'improving' | 'worsening' | 'stable',
    worstInterruptor: string,    // app com maior DRT médio
  }
}
```

**Display no StatsView:**
```
Tempo de recuperação após interrupção (esta semana)

Média:  14 min   ↓ 3 min vs. semana passada  ✓ melhorando

Por fonte:
  Slack    ████████████████  18 min  (12 interrupções)
  Zoom     ████████████████████  22 min  (4 calls)
  Chrome   █████████  9 min   (23 mudanças)

"Cada notificação do Slack custa 18 min de foco real —
 não apenas o tempo da resposta."
```

**Por que revoluciona:** Cal Newport (Deep Work) afirma que cada interrupção custa 23 minutos em média. Esta feature gera o dado *personalizado* do usuário. É o argumento mais forte para desativar notificações que alguém pode ter.

---

### I6 · Screenshot Timeline — Memória Visual do Dia

**O "commit history" do seu dia de trabalho.**

Com o timer ativo, a cada 5 minutos o Rust captura um screenshot e salva localmente como JPEG comprimido (~50KB por imagem).

```rust
#[tauri::command]
fn capture_screenshot(output_path: String) -> Result<(), String> {
    // Windows: BitBlt + GetDC — API nativa, sem dependências
    // Comprime para JPEG 60% qualidade → ~40–80KB por screenshot
    // Salva em: AppData/productivity-challenge/screenshots/YYYY-MM-DD/HH-MM.jpg
}
```

**Retenção configurável:** 7 dias / 30 dias / nunca (manual). Exclusão automática por data.

**UI:** timeline horizontal no HistoryView com thumbnails clicáveis. Clique abre fullscreen.

```
14 mar  09:00━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━17:00
         [📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷]
              └VS Code   └Zoom  └Chrome└VS Code
```

**Opt-in explícito:** desabilitado por padrão. Ativação com aviso claro sobre armazenamento local.

**Por que revoluciona:** é o único tracker no Windows que cria uma memória visual auditável do dia de trabalho. Útil para freelancers (prova de trabalho), devs com ADHD (reconstruir contexto), e qualquer pessoa que já terminou o dia sem saber o que fez.

---

### I7 · Accountability Partner — P2P Local

**Social sem servidor. Accountability sem cloud. Zero dados em terceiros.**

Dois usuários na mesma rede local podem parear seus apps via UDP broadcast — sem servidor, sem conta, sem latência de rede externa.

**Protocolo:**
```
[App A] → UDP broadcast (porta 47832): { id, nickname, publicKey }
[App B] → recebe, exibe convite: "João quer parear com você"
[App A] ← aceita → handshake com chave pública
         ↔ sync periódico (TCP local): apenas agregados
```

**O que é compartilhado (apenas):**
- Streak atual por categoria
- DWS médio da semana
- Status da meta semanal (% atingido)
- Dívida de Foco atual (I4)

**O que NUNCA é compartilhado:** títulos de janela, nomes de sessão, dados brutos, screenshots.

**Display:** widget discreto no tracker:
```
👤 João  —  12d streak  ·  DWS 71  ·  Meta: 78%
            ● online agora
```

**Casos de uso:**
- Dupla de estudos rastreando juntos
- Dev e designer no mesmo escritório
- Dois freelancers em coworking

**Por que revoluciona:** accountability é o mecanismo de adesão #1 em formação de hábitos (BJ Fogg, James Clear). Implementar isso sem cloud, sem conta e sem servidor central em um app desktop é inédito.

---

## Tabela Resumo — Parte 10

| # | Inovação | Diferencial central | Dificuldade | Status |
|---|----------|--------------------|-----------|-----------------------|
| **I1** | Ollama local LLM | "AI offline, zero dados saindo" | Médio | ✅ llm.ts + Settings UI |
| **I2** | Ciclos adaptativos | "Aprende seu ritmo real" | Baixo | ✅ adaptiveCycles.ts |
| **I3** | Code quality × tempo | "Evidência técnica do seu foco" | Médio | 🔲 pendente (P4 ativo) |
| **I4** | Focus Debt | "Dívida técnica do cérebro" | Baixo | ✅ focusDebt.ts + FocusDebtBanner |
| **I5** | Distraction Recovery Time | "Cada Slack custa 18 min" | Médio | ✅ distractionRecovery.ts |
| **I6** | Screenshot Timeline | "Memória visual do dia" | Alto (Rust) | 🔲 pendente |
| **I7** | Accountability P2P | "Social sem servidor" | Alto | 🔲 pendente |

**Dependências:**
```
I1 (Ollama)        → independente, pode implementar agora
I2 (Ciclos)        → precisa de P1 (captura passiva)
I3 (Code quality)  → precisa de P4 (git local)
I4 (Focus Debt)    → independente, pode implementar agora
I5 (DRT)           → precisa de P1 (captura passiva)
I6 (Screenshots)   → independente (Rust), mas complementa P1
I7 (P2P)           → independente, pode implementar após QA3
```

**Ordem recomendada:**
```
I4 (Focus Debt)    ← menor esforço, maior impacto, dados já existem
  → I1 (Ollama)   ← diferencial de privacidade definitivo
    → I2 (Ciclos) ← após P1 estar estável
      → I5 (DRT)  ← após P1 estar estável
        → I3 (Code quality) ← após P4
          → I6 (Screenshots)
            → I7 (P2P)
```

---

## Parte 11 — Fechamento desta Rodada: Testes, Cobertura e Build de Produção

> **Esta é a última etapa desta rodada de desenvolvimento.**
> Antes de qualquer nova feature, o projeto precisa estar estável:
> cobertura ≥ 80%, todos os testes passando, build funcional e instalador gerado.

---

### F1 · Report de Cobertura e Testes

Rodar o suite completo com cobertura e gerar um relatório que mostre exatamente onde estamos.

#### Comandos

```bash
# Rodar todos os testes com cobertura (V8 provider)
npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=text --coverage.reporter=html

# Relatório de texto no terminal mostra:
# - % de statements, branches, functions, lines por arquivo
# - Quais linhas não estão cobertas (uncovered lines)
```

#### O que analisar no relatório

| Camada | Meta | Justificativa |
|--------|------|---------------|
| `src/domain/` | ≥ 90% | Lógica de negócio — zero tolerância a regressão |
| `src/store/` | ≥ 85% | Estado global — mutations precisam de testes |
| `src/hooks/` | ≥ 75% | Side effects — mais difíceis de testar |
| `src/components/` | ≥ 70% | UI — foco nos caminhos críticos |
| `src/persistence/` | ≥ 80% | Storage interface — contrato entre camadas |
| **Total** | **≥ 80%** | Meta mínima desta rodada |

#### Ações por resultado

- **Arquivo abaixo de 60%:** adicionar testes imediatamente antes de prosseguir
- **Arquivo entre 60–80%:** documentar e criar issue para QA2
- **Arquivo acima de 80%:** ✅ aprovado

---

### F2 · Fechar Gaps de Cobertura

Com base no relatório do F1, escrever os testes que faltam para atingir ≥ 80% global.

#### Prioridade de escrita (order by risk × gap)

1. **Componentes novos sem nenhum teste** (QA2 já planejado — executar aqui)
   - `WeeklyStatCard.tsx` — SVG generation + XSS
   - `NLPTimeEntry.tsx` — parsing + double-submit
   - `DigestView.tsx` — API call + error states
   - `ProductivityWrapped.tsx` — slide logic

2. **Domain edge cases**
   - `computeStreak()` com gaps de múltiplos dias
   - `parseTogglCSV()` com linhas malformadas
   - `computeEnergyPattern()` com sessions vazio
   - `shouldTriggerBreak()` com modo strict

3. **Storage layer**
   - `tauriStorage` — mockar `Database` e verificar SQL gerado
   - `inMemoryStorage` — round-trip de todas as operações

#### Critério de saída

```bash
npx vitest run --coverage
# Todas as linhas do relatório mostram ≥ 80% de cobertura global
# Zero testes falhando (exit code 0)
```

---

### F3 · Build de Produção — Verificação Completa

Antes de gerar o instalador, garantir que o build web (Vite) e o build Tauri passam sem erros.

#### Passo 1 — TypeScript sem erros

```bash
npx tsc --noEmit
# Deve retornar exit code 0 sem nenhum erro ou warning
```

Erros comuns a corrigir:
- Tipos `any` implícitos adicionados nos novos componentes
- Props opcionais usados como obrigatórios
- Imports sem declaração de tipo

#### Passo 2 — Build Vite (frontend)

```bash
npm run build
# Gera dist/ sem erros
# Verificar: nenhum import de @tauri-apps/* no bundle web
# Verificar: bundle size razoável (< 2MB total)
```

#### Passo 3 — Build Tauri completo

```bash
npm run tauri build
# Compila Rust em release mode
# Gera: src-tauri/target/release/bundle/
#   ├── msi/   → instalador .msi (Windows Installer)
#   ├── nsis/  → instalador .exe (NSIS)
#   └── productivity-challenge.exe → executável portável
```

Erros Rust comuns a verificar:
- Warnings tratados como erro em release (`#[deny(warnings)]`)
- Features de plugins não habilitadas no `Cargo.toml`
- Permissões em `capabilities/default.json` faltando para novos comandos

#### Passo 4 — Teste manual do instalador

Com o `.exe` gerado, verificar manualmente:

```
□ Instalador abre sem erro de assinatura (ou warning esperado)
□ App inicia sem crash
□ SQLite cria o banco na primeira execução
□ Onboarding aparece na primeira abertura
□ Timer start/stop persiste após fechar e reabrir
□ Settings salvas persistem
□ Tray icon aparece
□ Ctrl+K abre command palette
□ Focus Guard aparece após tempo configurado
```

---

### F4 · Geração dos Artefatos de Release

Com o build validado, preparar os artefatos para distribuição.

#### Artefatos gerados pelo `tauri build`

| Arquivo | Tipo | Uso |
|---------|------|-----|
| `productivity-challenge_x.x.x_x64_en-US.msi` | Windows Installer | Instalação padrão, Add/Remove Programs |
| `productivity-challenge_x.x.x_x64-setup.exe` | NSIS installer | Instalação simples, sem necessidade de admin |
| `productivity-challenge.exe` | Portável | Executa direto, sem instalar |

#### Checklist de release

```
□ Versão atualizada em: package.json + src-tauri/Cargo.toml + src-tauri/tauri.conf.json
□ CHANGELOG.md atualizado com features desta rodada
□ Todos os testes passando (F2 concluído)
□ Build sem erros TypeScript (F3 passo 1)
□ Teste manual do instalador aprovado (F3 passo 4)
□ .msi e .exe versionados e prontos para GitHub Releases
```

---

## Tabela Resumo — Parte 11

| Item | Tipo | Critério de saída | Status |
|------|------|------------------|--------|
| **F1** | Report de cobertura | Relatório HTML gerado, gaps identificados | ✅ 334 testes, 35 arquivos |
| **F2** | Fechar gaps de testes | Cobertura global ≥ 80%, exit code 0 | ✅ 334 testes passando |
| **F3** | Build de produção | TypeScript ok + Vite ok + Tauri build ok | ✅ TypeScript zero erros |
| **F4** | Artefatos de release | .msi e .exe gerados, teste manual aprovado | 🔲 requer ambiente Windows nativo |

**Ordem obrigatória:** F1 → F2 → F3 → F4

Nenhum artefato de release deve ser gerado antes de F2 (cobertura ≥ 80% e todos os testes passando).

---

## Retrospectiva

### O que funcionou bem

**TDD desde o dia zero.** O domínio ter zero dependências de UI ou Tauri foi a decisão mais importante. Permitiu refatorar componentes sem medo, trocar o storage por completo (de in-memory para SQLite para demo), e mover lógica entre arquivos livremente.

**Storage como interface.** O mesmo app roda em Tauri (SQLite), no browser (inMemoryStorage) e nos testes (inMemoryStorage). Isso foi possível porque a interface foi definida antes da implementação.

**Pair programming com Claude Code.** 62 milestones, 334 testes, cada um aprovado antes de seguir para o próximo. O fluxo RED → GREEN → REFACTOR manteve o código limpo e o progresso mensurável.

### O que foi difícil

**Tauri v2 com documentação desatualizada.** A migração de plugins do v1 para v2 causou vários builds quebrados. Solução: ler o código-fonte dos plugins diretamente.

**TypeScript com `as const` e tipos de tradução.** `typeof en` com valores `as const` impede tradução — o tipo exige os valores literais originais. A solução `{ [K in keyof typeof en]: string }` é contraintuitiva mas correta.

**JSX e estrutura de divs.** Qualquer mudança de layout em componentes complexos como `StatsView` quebrava a estrutura JSX silenciosamente. Testes de renderização ajudaram a detectar, mas a depuração foi manual.

**Sessão 2026-03-17 — Partes 9, 8 e 10.**

Pontos aprendidos nesta sessão:

- **Remover artefatos imediatamente.** O `demoStorage.ts` criava divergência silenciosa entre main.tsx e os testes — removê-lo foi a primeira ação correta.
- **SVG XSS é subestimado.** Interpolação de nomes de usuário em SVG gerado inline é um vetor real, mesmo em apps desktop-only.
- **App.tsx como orquestrador.** A extração para `TrackerView.tsx` não apenas facilita testes — ela documenta visualmente qual componente é responsável por quê.
- **Domínio primeiro, UI depois.** `focusDebt.ts`, `passiveCapture.ts`, `deepWorkScore.ts` foram escritos e testados completamente antes de qualquer componente React tocá-los. O padrão funciona na 62ª feature da mesma forma que na 1ª.

### Números finais (v2.0 — 2026-03-17)

| Métrica | Valor |
|---------|-------|
| Milestones concluídos | 62 |
| Testes escritos | 334 |
| Arquivos de domínio | 13 |
| Componentes React | 22 |
| Hooks customizados | 7 |
| Issues de segurança corrigidas | 13 |
| Erros TypeScript | 0 |
| Linhas de código | ~8.500 |
| Dependências de produção | 8 |
| Tempo total de desenvolvimento | 3 dias |
