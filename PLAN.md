# Plano de Desenvolvimento — Próximas Etapas

> Aguardando aprovação antes de implementar qualquer item.

---

## Parte 1 — Limpeza e Otimização Técnica

### O1 · Remover `updateAccumulatedMs` da Storage interface
Dead code desde o Milestone 15. Sessões substituíram esse mecanismo.
Remove da interface, implementações e testes.

### O2 · Memoizar computações pesadas em `App.tsx`
`streaks`, `weekDates` e `computeWeekMs` recalculados a cada render.
Envolver em `useMemo` com dependências corretas.

### O3 · Corrigir bug silencioso em `useInitStore`
Retorna cedo se não há categorias, impedindo sessões históricas de carregarem em reinstalação.
Separar carregamento de sessões do carregamento de categorias.

### O4 · Corrigir `tauriStorage` INIT_SQL com múltiplos statements
Múltiplos `CREATE TABLE` num único `execute` pode falhar silenciosamente.
Separar cada statement em um `execute` individual.

### O5 · Dividir `CategoryItem.tsx` em subcomponentes
213 linhas misturando timer, rename e weekly goal.
Extrair `CategoryGoal` e `CategoryName`.

### O6 · Testes ausentes em `useInitStore` com histórico
Adicionar cobertura para `historySessions`, `sessions` da semana e filtragem.

---

## Parte 2 — v0.5 e v0.6

### v0.5 · Reports
- **M20** · Histórico de sessões (3ª tab, agrupado por dia)
- **M21** · Distribuição por hora do dia
- **M22** · Export CSV

### v0.6 · Polish
- **M23** · "Última vez ativo" no CategoryItem
- **M24** · Seletor de semana no Stats
- **M25** · Cor por categoria (6 swatches)

---

## Parte 3 — v0.7 · Desktop Nativo + Focus Guard

> **Princípio:** o app precisa ser útil quando a janela está fechada,
> e deve proteger o usuário de si mesmo quando o foco vira hiperfoco.

---

### M26 · System Tray com timer ao vivo

Ícone na bandeja exibe tempo do timer ativo. Menu de contexto para controlar sem abrir a janela.

```
[TT] Work · 1:23:45
  ─────────────────
  ▶ Study
  ▶ Exercise
  ─────────────────
  ■ Stop Work
  ─────────────────
  Open Time Tracker
  Quit
```

**Plugin:** `tray` (core Tauri v2) + `tauri-plugin-menu`

---

### M27 · Notificações nativas do SO

Três tipos de notificação:
1. **Meta semanal atingida** — "Work · 10h goal reached"
2. **Lembrete diário** — nenhuma categoria rastreada até X horas (configurável)
3. **Timer esquecido** — timer rodando há mais de N horas sem pausa

**Plugin:** `tauri-plugin-notification`

---

### M28 · Atalho global de teclado

- `Ctrl+Shift+T` — toggle timer ativo
- `Ctrl+Shift+Space` — trazer janela para frente

Configurável pelo usuário. Salvo em `settings` no SQLite.
**Plugin:** `tauri-plugin-global-shortcut`

---

### M29 · Focus Guard — Pausa Obrigatória (baseado em ciência)

**Problema real que resolve:** hiperfoco não é sempre uma escolha — o cérebro suprime sinais de fadiga, fome e necessidade de movimento. Após 90 min ininterruptos, o córtex pré-frontal está com glicose depletada. O usuário sente que está produzindo, mas a qualidade degradou há 20 minutos.

**Base científica:**
- **Ritmo ultradiano (BRAC):** o cérebro alterna entre ciclos de 90–120 min de alta atenção e baixa atenção. Forçar o ciclo com willpower acumula cortisol e reduz o teto do próximo ciclo.
- **Método 52/17:** dados do DeskTime mostram que os 10% mais produtivos trabalham 52 min e descansam 17 min. O intervalo deixou de ser arbitrário.
- **Pomodoro e variações:** 25+5 reduz fadiga em ~20% vs. trabalho sem estrutura (PMC 2025). Eficaz contra procrastinação.
- **ADHD/hiperfoco:** o hiperfoco é involuntário e "sticky" — o usuário literalmente não consegue parar. Pausas forçadas com fricção real são a única solução comprovada.

**Modos disponíveis:**

| Modo | Foco | Pausa | Público |
|------|------|-------|---------|
| Pomodoro | 25 min | 5 min | Iniciantes, tarefas curtas |
| 52/17 | 52 min | 17 min | Trabalho profissional sustentado |
| Ultradian | 90 min | 20 min | Trabalho criativo/cognitivo profundo |
| Custom | N min | N min | Controle total |

**Comportamento da pausa:**
1. **Aviso gradual** — overlay semitransparente aparece 5 min antes com contagem regressiva. Não bloqueia o trabalho ainda.
2. **Pausa ativa** — overlay fullscreen não-dispensável. Exibe:
   - Contador de tempo de pausa restante
   - Sugestão rotativa baseada em evidência:
     - "Levante e caminhe por 2 minutos"
     - "Olhe para algo a 6 metros por 20 segundos (regra 20-20-20)"
     - "Beba um copo d'água"
     - "Faça 5 respirações profundas"
     - "Estique pescoço e ombros"
   - Estatística motivacional: "Você focou 94 min — você merece isso"
3. **Fricção para pular:**
   - **Modo Normal:** 1 adiamento de 5 min por sessão, depois exige digitar "SKIP" para confirmar
   - **Modo Strict (opt-in):** sem pular, sem adiar — ideal para quem quer se comprometer
4. **Idle detection:** se o usuário já está inativo há 3+ min, a pausa não é forçada — ele já está descansando

**Métricas rastreadas:**
- Pausas cumpridas vs. puladas por semana
- Sequência de pausas cumpridas (streak de disciplina)
- Sessão mais longa sem pausa (alerta se > 2h)

**Configurações salvas:** modo, intervalo, duração da pausa, strict mode, horário "não perturbe" (ex: não forçar pausa das 9h–9h15)

**Novo domain:** `focusGuard.ts` — puro, testável
```ts
computeNextBreak(sessions, config) → Date
shouldBreakNow(activeEntry, config) → boolean
getFocusStats(sessions) → { compliance: number, longestSession: number }
```

**Plugin Tauri:** `tauri-plugin-notification` (já no M27) para alerta fora da janela

---

### M30 · Auto-pause por inatividade

Detecta inatividade por N minutos e pausa o timer. Ao retornar, pergunta: "Você ficou ausente 12 min. Adicionar ao Work?"

Integra com Focus Guard: inatividade durante uma pausa obrigatória conta como pausa cumprida.

**Implementação:** Rust custom command lendo idle time do SO.

---

## Parte 4 — v0.8 · Inteligência e Autoconhecimento

> **Princípio:** transformar dados brutos em autoconhecimento real.
> O usuário deve aprender algo sobre si mesmo toda vez que abre o app.

---

### M31 · Heatmap de produtividade (estilo GitHub)

Grid de calendário dos últimos 90 dias. Cor = intensidade de horas rastreadas.
Hover: data, total do dia, categoria dominante, sessões.

```
Mar  ░░▒▒▓▓██▓▓░░▒▒▓▓██░░▒▒▓▓
Feb  ░░░░▒▒▓▓██░░░░▒▒▓▓██░░░░
Jan  ░░▒▒░░▒▒▓▓▓▓██▓▓░░░░▒▒▒▒
```

**Domain:** `computeDayTotals(sessions, since)` → `{ date, totalMs, topCategory }[]`

---

### M32 · Curva de energia pessoal

Com base nos últimos 30 dias, o app identifica seus horários naturais de pico e vale.

```
Your energy pattern (based on 30 days)

        ▄▄
   ▃▃  ████  ▃▃        ▃▃
░░▁▁▁▁████████▁▁▁▁▃▃▃▃████▃▃░░
 6h  8h  10h  12h  14h  16h  18h  20h

Peak: 9–11h · 15–17h
Valley: 12–14h (post-lunch dip)
```

**Insight gerado:** "Seus melhores horários são 9–11h e 15–17h. Evite reuniões nessas janelas."
**Domain:** `computeEnergyPattern(sessions)` → curva por hora com picos e vales marcados.

---

### M33 · Detecção de Flow State

Sessões contínuas acima de 45 minutos são marcadas automaticamente como "flow sessions". Rastreadas separadamente.

```
Work — Mar 15
  09:12 → 11:34   2h 22m  ⚡ flow
  14:00 → 14:40   0h 40m
```

**Métricas adicionais:**
- Flow sessions por semana por categoria
- % do tempo total em flow vs. sessões fragmentadas
- "Condições de flow": qual horário e dia você entra mais em flow?

**Domain function:** `isFlowSession(session, threshold = 45 * 60000)` → `boolean`

---

### M34 · Intenções Diárias (Morning Brief + Evening Review)

Ao abrir o app pela primeira vez no dia, uma tela opcional de micro-planejamento:

```
Good morning. What matters today?

  Work      [ 3h ]  ───────────── suggested based on goal
  Study     [ 1h ]
  Exercise  [ 0h ]

[ Start my day ]
```

À noite (ou manualmente), Evening Review:
```
Today: 6h 40m tracked

  Work   3h 12m  ✓ goal reached
  Study  0h 45m  ↓ 15 min below intention

How was your focus today? [ 😞 ][ 😐 ][ 😊 ][ 🔥 ]

Notes (optional): ___________________________
[ Save review ]
```

**Dados armazenados:** intenções diárias, mood score, notas — base para análise retroativa.
**Novo domain:** `dailyReview.ts`

---

### M35 · Context Tags em Sessões

O usuário pode adicionar uma tag opcional ao iniciar ou terminar uma sessão:

```
Work  [deep work ▾]  00:45:12  Stop
```

Tags pré-definidas + custom:
- `deep work` · `meetings` · `admin` · `learning` · `blocked` · `review`

**Análise:** quanto tempo vai para deep work vs. overhead? O dashboard mostra breakdown por tag.
**Domain:** `tag?: string` em `Session`. Nova coluna `tag` no SQLite.

---

### M36 · AI Digest semanal via Claude API

Segunda-feira, o app gera um resumo inteligente da semana anterior.

**O que é enviado à API (sem dados sensíveis por default):**
```json
{
  "week": "2026-W11",
  "categories": [
    { "name": "Work", "weeklyMs": 28800000, "goalMs": 36000000, "streak": 4, "flowSessions": 3 },
    { "name": "Study", "weeklyMs": 7200000, "streak": 2 }
  ],
  "energyPattern": { "peaks": [9, 10, 15], "valleys": [13, 14] },
  "focusGuardCompliance": 0.85,
  "moodAverage": 3.2,
  "comparedToPreviousWeek": { "Work": "+2h", "Study": "-30min" }
}
```

**Output exibido em linguagem natural:**
> "Esta semana você focou 8h em Work, 2h acima da semana passada. Seu streak de 4 dias é o melhor dos últimos 30. Você entrou em flow 3 vezes — sempre entre 9–11h. Terça foi seu dia mais produtivo. Sugiro proteger terças de manhã para trabalho profundo."

**Privacidade:** nomes de categorias podem ser anonimizados nas configurações.
**API key:** configurada pelo usuário, armazenada localmente.
**Plugin Tauri:** `tauri-plugin-http` · **SDK:** `@anthropic-ai/sdk`

---

### M37 · Sugestão inteligente de meta semanal

Ao definir um goal, o app sugere um valor baseado na média das últimas 4 semanas + 10%.

```
Set weekly goal for Work
────────────────────────────────────
Your average (last 4 weeks): 7h 20m
Suggested: 8h/week  (+9%)

[ Use suggestion ]  [ Set manually ]
```

---

## Parte 5 — v0.9 · Ecossistema e Conectividade

> **Princípio:** o app como hub. Os dados devem sair facilmente,
> e o app deve conversar com as ferramentas que o usuário já usa.

---

### M38 · Export completo (CSV + JSON + HTML Report)

Botão "Export" com diálogo nativo de save-file.

**Formatos:**
- **CSV** — uma linha por sessão, compatível com Excel/Google Sheets
- **JSON** — estrutura completa categorias + sessões, para backup ou re-import
- **HTML Report** — relatório semanal visual e estático, pode ser compartilhado por e-mail ou salvo como PDF pelo browser

```html
<!-- weekly-report-2026-W11.html -->
Time Tracker — Weekly Report — March 9–15, 2026

Work    ████████████████  8h 00m  (goal: 10h · 80%)
Study   ████████          3h 00m
──────────────────────────────────
Total   11h 00m  ·  streak: 4 days
```

**Plugin Tauri:** `tauri-plugin-fs` + `tauri-plugin-dialog`

---

### M39 · Sync local via OneDrive/Dropbox

Multi-device sem servidor. O banco SQLite pode ser copiado automaticamente para uma pasta sincronizada na nuvem. O usuário configura o caminho (ex: `C:\Users\...\OneDrive\TimeTracker\`).

**Comportamento:**
- Export automático diário do banco para a pasta de sync
- Ao abrir o app em outro dispositivo, detecta o arquivo de sync e pergunta se importa
- Conflict resolution simples: "arquivo local tem sessões mais recentes que o sync — mesclar?"

**Por que funciona no Windows:** OneDrive já está instalado. O usuário só aponta o caminho.
**Plugin Tauri:** `tauri-plugin-fs`

---

### M40 · Webhooks configuráveis

POST para uma URL configurável quando eventos ocorrem:

| Evento | Payload |
|--------|---------|
| `timer.started` | `{ category, startedAt, tag? }` |
| `timer.stopped` | `{ category, startedAt, endedAt, durationMs, tag? }` |
| `goal.reached` | `{ category, goalMs, weeklyMs, week }` |
| `streak.milestone` | `{ category, streak, milestone: 7 \| 14 \| 30 \| 100 }` |
| `focus.break_skipped` | `{ sessionMs, category }` |
| `daily.review` | `{ mood, totalMs, topCategory }` |

**Casos de uso:**
- Postar no Discord/Slack quando uma meta é atingida
- Salvar sessões no Notion/Airtable via Zapier ou n8n
- Acionar uma automação home (ex: ligar/desligar uma luz de sinalização de foco)
- Triggerar um webhook para Philips Hue: luz verde quando Work começa, vermelha quando pausa obrigatória

**Plugin Tauri:** `tauri-plugin-http`

---

### M41 · Backup e Restore do banco de dados

Dois botões nas configurações:
- **Backup** — copia `timetracker.db` para local escolhido
- **Restore** — importa um `.db` com confirmação ("Isso substituirá todos os seus dados")

Proteção total contra perda de dados em reinstalação ou troca de máquina.
**Plugin:** `tauri-plugin-fs` + `tauri-plugin-dialog`

---

### M42 · Import de dados externos

Suporte a importar histórico de outras ferramentas:

**Toggl Track (CSV):**
```
User,Project,Start date,Start time,End date,End time,Duration
John,Work,2026-03-10,09:00:00,2026-03-10,11:30:00,02:30:00
```

**Clockify (CSV):** estrutura similar.

O app mapeia `Project` → categoria existente (cria se não existir), importa sessões históricas.
**Domain function:** `parseTogglCSV(raw)` → `Session[]`

---

### M43 · Modo Foco (Focus Lock)

Quando um timer está ativo, o usuário pode ativar o "Focus Lock" que:
1. Coloca a janela em always-on-top (visível sobre outros apps)
2. Mostra apenas o timer ativo em fullscreen minimalista
3. Opcionalmente abre uma URL de bloqueio (ex: `leechblock` via shell) ou envia webhook para bloqueador externo

```
┌───────────────────────────────┐
│                               │
│         W O R K               │
│        02:14:33               │
│                               │
│    [ Pause ]  [ Break now ]   │
│                               │
└───────────────────────────────┘
```

---

## Tabela Resumo Completa

| Item | Versão | Tipo | Novos Plugins Tauri | Destaque |
|------|--------|------|---------------------|----------|
| O1–O6 | — | Limpeza | — | |
| M20–M22 | v0.5 | Reports | fs, dialog | |
| M23–M25 | v0.6 | Polish | — | |
| M26 Tray | v0.7 | Desktop | tray (core) | Controle sem abrir janela |
| M27 Notificações | v0.7 | Desktop | notification | |
| M28 Shortcuts | v0.7 | Desktop | global-shortcut | |
| **M29 Focus Guard** | **v0.7** | **Wellbeing** | **notification** | **⭐ pausa obrigatória baseada em ciência** |
| M30 Auto-pause | v0.7 | Desktop | Rust custom | |
| M31 Heatmap | v0.8 | Visual | — | |
| M32 Curva de energia | v0.8 | Visual | — | ⭐ padrão pessoal de pico/vale |
| M33 Flow Detection | v0.8 | IA | — | ⭐ sessões em estado de flow |
| **M34 Daily Intentions** | **v0.8** | **Wellbeing** | **—** | **⭐ morning brief + evening review + mood** |
| M35 Context Tags | v0.8 | UX | — | deep work vs. admin |
| **M36 AI Digest** | **v0.8** | **IA** | **http** | **⭐ Claude API — insights em linguagem natural** |
| M37 Sugestão de meta | v0.8 | IA | — | |
| M38 Export HTML Report | v0.9 | Ecossistema | fs, dialog | relatório compartilhável |
| **M39 Sync OneDrive** | **v0.9** | **Ecossistema** | **fs** | **⭐ multi-device sem servidor** |
| M40 Webhooks | v0.9 | Ecossistema | http | Hue, Zapier, Discord |
| M41 Backup/Restore | v0.9 | Ecossistema | fs, dialog | |
| M42 Import Toggl | v0.9 | Ecossistema | fs | migração |
| M43 Focus Lock | v0.9 | UX | — | fullscreen timer |
| **M44 Layout Responsivo** | **v0.9** | **Polish** | **—** | **layout escala em tela cheia** |
| **M45 Suporte a Idiomas** | **v0.9** | **Polish** | **—** | **pt-BR / English via i18n.ts** |

---

### M44 · Layout Responsivo

Atualmente tudo usa `max-w-xl` fixo (576px). Em tela cheia fica centralizado num bloco pequeno.

**Mudanças:**
- Header e main: `max-w-xl lg:max-w-3xl xl:max-w-4xl`
- Tracker view: grid de 2 colunas em telas `lg+`
- Padding e espaçamentos escalam com breakpoints Tailwind

---

### M45 · Suporte a Idiomas (pt-BR / en)

**Implementação sem biblioteca externa:**
- `src/i18n.ts` — objeto com todas as strings traduzidas
- `useI18n()` hook — lê preferência do `localStorage`, expõe função `t(key)`
- Botão de idioma nas Settings (EN / PT)
- Traduz todas as strings visíveis da UI

---

## Ordem de Implementação

```
── Agora ─────────────────────────────────────────
O1 → O2 → O3 → O4 → O5 → O6

── v0.5 ──────────────────────────────────────────
M20 → M21 → M22

── v0.6 ──────────────────────────────────────────
M23 → M24 → M25

── v0.7 · Desktop + Wellbeing ────────────────────
M26 (tray) → M27 (notificações) → M28 (shortcuts)
→ M29 (Focus Guard ⭐) → M30 (auto-pause)

── v0.8 · Inteligência ───────────────────────────
M31 (heatmap) → M32 (energia) → M33 (flow)
→ M34 (daily intentions ⭐) → M35 (tags)
→ M36 (AI digest ⭐) → M37 (sugestão meta)

── v0.9 · Ecossistema ────────────────────────────
M38 (export) → M39 (sync OneDrive ⭐)
→ M40 (webhooks) → M41 (backup)
→ M42 (import) → M43 (focus lock)
```
