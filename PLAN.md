# Time Tracker — Development Log

> Registro cronológico das decisões de desenvolvimento. Status atual: **v1.0.0-alpha**, 57 arquivos de teste, 578 testes passando, TypeScript limpo.

---

## Estado Atual (2026-03-17)

| Área | Status |
|------|--------|
| Testes | ✅ 578 passando, 0 falhando |
| TypeScript | ✅ zero erros |
| Build Vite | ✅ funcional |
| Build Tauri | ⚠️ pendente (requer toolchain MSVC no Windows) |
| Cobertura | ~80%+ (estimativa) |

---

## Arquitetura

```
src/
  domain/       # lógica de negócio pura — sem React, sem Tauri
  components/   # componentes React
  hooks/        # side-effects e bridges Tauri
  store/        # Zustand store
  persistence/  # interface Storage + implementações
src-tauri/      # backend Rust (Tauri 2)
cli/            # CLI companion (better-sqlite3)
vscode-extension/
```

**Regra central:** `src/domain/` não tem imports de React ou Tauri. Testável em Node puro.

**Storage adapters:**

| Adapter | Uso |
|---------|-----|
| `tauriStorage` | App desktop (SQLite via tauri-plugin-sql) |
| `inMemoryStorage` | Testes e fallback browser |
| `demoStorage` | Web demo (wraps inMemory com seed de 90 dias) |

**Rust commands registrados:** `get_active_window`, `get_git_log`, `update_tray_status`, `get_idle_seconds`, `set_always_on_top`, `capture_screenshot`, `list_screenshots`, `delete_screenshots_before`, `get_input_activity`

---

## Fase 1 — Core (M1–M20)

Março 2026, manhã.

- **Timer domain** (`timer.ts`): `Category`, `Session`, `computeWeekMs`, `computeStreak`, `getWeekDates`. Regra central: apenas um timer ativo por vez.
- **Zustand store**: wrapa domínio, sem lógica de negócio.
- **SQLite persistence**: `tauriStorage` com `inMemoryStorage` como fallback. Bug crítico resolvido: múltiplos `CREATE TABLE` num único `execute` falham silenciosamente — separar statements.
- **UI inicial**: lista de categorias, start/stop, display de tempo decorrido com `useRef` para evitar stale closure no `setInterval`.
- **Stats view**: barras de progresso por categoria.

---

## Fase 2 — Reports e Polish (M20–M30)

- **HistoryView**: sessões agrupadas por data, tempo total por categoria.
- **Hour distribution**: `computeHourDistribution()` — base da curva de energia.
- **Export CSV/JSON/HTML**: domínio puro como strings, sem IO. `URL.createObjectURL` para download no browser.
- **Semana navigation**: `getWeekDates()` já existia, só precisou de estado `selectedWeek`.
- **Cores por categoria**: hex string no SQLite, reaparece no stat card e heatmap.

### Focus Guard (M29)

Feature central do app. Não é Pomodoro — é overlay baseado em ciência cognitiva.

| Modo | Foco | Pausa | Base |
|------|------|-------|------|
| Pomodoro | 25 min | 5 min | PMC 2025 |
| 52/17 | 52 min | 17 min | DeskTime top 10% |
| Ultradian | 90 min | 20 min | BRAC natural |
| Custom | N min | N min | — |

- Aviso 5 min antes, overlay fullscreen não-dispensável
- Modo Normal: 1 adiamento + digitar "SKIP"
- Modo Strict: sem pular

- **System Tray** (M26): `tauri-plugin-menu` + `tauri-plugin-tray`. Tauri v2 quebrou API do v1 — ler código-fonte dos plugins.
- **Auto-pause** (M30): idle detection via Rust command.

---

## Fase 3 — Inteligência (M31–M37)

- **Heatmap** (M31): grid 90 dias, cor = intensidade. `computeDayTotals()`.
- **Curva de energia** (M32): `computeEnergyPattern()` — picos e vales por hora. SVG inline sem bibliotecas.
- **Flow State** (M33): sessões ≥ 45 min. `isFlowSession()`.
- **Intenções + Evening Review** (M34): `intentions.ts` no domínio. Base para export Markdown.
- **Context Tags** (M35): coluna `tag` no SQLite.
- **AI Digest** (M36): Claude Haiku. Apenas agregados enviados — sem nomes ou notas pessoais. API key armazenada localmente.
- **Sugestão de meta** (M37): média das últimas 4 semanas + 10%.

---

## Fase 4 — Ecossistema (M38–M45)

- **Export completo** (M38): CSV, JSON, HTML. `tauri-plugin-fs` + `tauri-plugin-dialog`.
- **Sync local** (M39): export automático para pasta OneDrive/Dropbox. Local-first by design.
- **Webhooks** (M40): POST em `timer.started`, `timer.stopped`, `goal.reached`, etc.
- **Backup/Restore** (M41): cópia do `.db`.
- **Import Toggl/Clockify** (M42): `parseTogglCSV()` → `Session[]`.
- **Focus Lock fullscreen** (M43): always-on-top, timer circular SVG animado.
- **Layout responsivo** (M44): grid 2 colunas em `lg+`.
- **i18n pt-BR/en** (M45): sem biblioteca externa. Bug TypeScript: `const pt: typeof en` com `as const` exige valores idênticos — usar `{ [K in keyof typeof en]: string }`.

---

## Fase 5 — Visibilidade (R1–T3)

- **README profissional** (R1): badges CI/deploy reais, "Built with Claude Code".
- **GitHub Actions CI/CD** (R2): `ci.yml` em todo PR, `release.yml` em tag `v*.*.*`.
- **Stat Card compartilhável** (M47): SVG → canvas → PNG via Clipboard API.
- **Productivity Wrapped** (M48): 6 slides estilo Spotify.
- **Export Markdown** (M50): compatível com Obsidian/Notion.
- **NLP Time Entry** (M51): Claude parseia linguagem natural → `ParsedTimeEntry`. `JSON.stringify` nos inputs contra prompt injection.
- **GitHub Correlation** (M52): `useGitHubActivity()` via API pública. Overlay no heatmap.
- **CLI** (M53): `npx @productivity-challenge/cli start work`. `better-sqlite3`, sem deps além do driver.
- **VS Code Extension** (M54): status bar `⏱ Work · 01:23:45`. Polling via CLI.
- **Onboarding** (T1): wizard 3 passos, flag no SQLite.
- **Command Palette** (T2): `Ctrl+K`, filtragem em tempo real.
- **Energy Score Banner** (T3): compara hora atual com picos históricos.

---

## Fase 6 — Segurança (S1–S5)

11 issues encontradas e corrigidas em auditoria formal:

| Severidade | Issue | Correção |
|-----------|-------|----------|
| Crítica | Command injection VS Code extension | `spawnSync` array, `shell: false` |
| Alta | CSP `null` no Tauri | CSP restritiva com allowlist |
| Alta | Prompt injection via nomes de categoria | `JSON.stringify` inputs |
| Alta | Path traversal no sync | validar absolute + rejeitar `..` |
| Alta | SVG XSS via nomes de categoria | `escapeXml()` |
| Média | Erro raw da API ao usuário | mensagens genéricas por HTTP status |
| Média | GitHub username não validado | regex `^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$` |
| Média | SSRF no webhook | `isSafeWebhookUrl()` bloqueia localhost e IPs privados |
| Média | Backup JSON sem validação | checagem de tipos antes de `importSessions` |
| Baixa | Rate limit digest | cooldown 10s via `useRef` |
| Baixa | Double-submit NLP | estado `confirming` com flag |

**Regra aprendida:** em apps desktop com Tauri, prompt injection, SSRF e path traversal são vetores reais.

---

## Fase 7 — Developer Intelligence Engine (P1–P7)

> Zero fricção. O app observa em vez de pedir registro manual.

| # | Feature | Status |
|---|---------|--------|
| **P1** | Smart Capture — captura passiva por processo/janela | ✅ domain + Rust stub |
| **P2** | Context Switching Score | ✅ domain |
| **P3** | Deep Work Score (DWS 0–100) | ✅ domain |
| **P4** | Local Git Correlation (sem token, offline) | ✅ Rust command |
| **P5** | Meeting & Build Intelligence | ✅ via P7 recommendations |
| **P6** | Daily Activity Timeline (Gantt visual) | ✅ componente + testes |
| **P7** | Focus Recommendations Engine | ✅ domain + UI |

**P3 — Deep Work Score:**
```
+25 pts   janela única > 25 min contínuos
+25 pts   context switches < 5 na última hora
+25 pts   sessão ≥ 45 min (flow threshold)
+25 pts   nenhum app de distração ativo
```

---

## Fase 8 — Inovações (I1–I7)

| # | Feature | Status |
|---|---------|--------|
| **I1** | Ollama local LLM (AI 100% offline) | ✅ `llm.ts` + Settings UI |
| **I2** | Ciclos adaptativos (aprende seu ritmo) | ✅ `adaptiveCycles.ts` |
| **I3** | Code Quality × Tempo | ✅ `codeQuality.ts` + UI |
| **I4** | Focus Debt (dívida cognitiva) | ✅ `focusDebt.ts` + FocusDebtBanner |
| **I5** | Distraction Recovery Time (DRT) | ✅ `distractionRecovery.ts` |
| **I6** | Screenshot Timeline (memória visual do dia) | ✅ Rust + UI + Settings |
| **I7** | Accountability P2P (JSON card export/import) | ✅ `accountability.ts` + UI |

**I1 — Lógica de fallback do backend de IA:**
```
1. Ollama em localhost:11434 disponível? → usa modelo local
2. Claude API key configurada?           → usa Claude API
3. Nenhum?                               → features de IA desabilitadas
```

**I7 — Implementação P2P simplificada:** UDP/TCP networking seria complexo e arriscado. Implementado como JSON card (export/import local) com validação em runtime via `validatePartnerCard()`.

---

## Fase 9 — Qualidade Técnica (QA)

- **C1** ✅ Removidos artefatos web demo (`demoStorage.ts` marcado como web-only, workflows removidos)
- **QA2** ✅ Testes adicionados: `WeeklyStatCard`, `NLPTimeEntry`, `DigestView`, `ProductivityWrapped`
- **QA3** ✅ App.tsx refatorado: extraído `TrackerView`, `StatsView`, `HistoryView`, etc.

---

## Fase 10 — Inovações Adicionais (N1–N8)

| # | Feature | Domain | UI | Status |
|---|---------|--------|-----|--------|
| **N1** | Attention Residue Timer | `attentionResidue.ts` | `AttentionResidueBanner` | ✅ |
| **N2** | Burnout Risk Indicator | `burnoutRisk.ts` | `BurnoutRiskBadge` | ✅ |
| **N3** | Maker vs. Manager Mode | `makerManager.ts` | `MakerManagerBadge` | ✅ |
| **N4** | AI Session Naming | `sessionNaming.ts` | `SessionNameSuggestion` | ✅ |
| **N5** | Dead Time Recovery | `deadTimeRecovery.ts` | `DeadTimeRecoveryWidget` | ✅ |
| **N6** | Distraction Budget | `distractionBudget.ts` | `DistractionBudgetWidget` | ✅ |
| **N7** | Input Intelligence (KB+Mouse) | `inputIntelligence.ts` | `InputIntelligenceWidget` | ✅ Rust stub |
| **N8** | Minimum Viable Day (MVD) | `minimumViableDay.ts` | `MVDWidget` | ✅ |

### Decisões de design

**N1 — Attention Residue:** 5 min de settling após troca de categoria. Banner amber com countdown MM:SS. Baseado em Sophie Leroy (2009).

**N2 — Burnout Risk:** score 0–100 a partir de sessões noturnas (≥22h), work nos dois dias de fim de semana, dias com >9h, sem dias de descanso em 7 dias, e nível de focus debt. Não alarmista — informativo.

**N3 — Maker/Manager:** blocos ≥30 min = maker, <30 min = manager. Classificação por percentual (≥60% de um tipo define o modo, senão "mixed").

**N4 — Session Naming:** heurístico puro sem chamada de rede. Padrões por processo (VS Code → "Coding", Slack → "Communication", etc.). Título mais frequente como fallback. `buildNamingPrompt()` para quando há backend de IA disponível.

**N5 — Dead Time:** threshold padrão 10 min, boundary exclusiva (`idleMs > threshold`). Sugere até 3 micro-tasks que caibam no tempo idle disponível.

**N6 — Distraction Budget:** 30 min default, sem bloqueio — apenas visibilidade. Cada bloco contado apenas para a primeira regra que faz match.

**N7 — Input Intelligence:** Rust `get_input_activity` retorna zeros (stub). Implementação real exige `WH_KEYBOARD_LL` + `WH_MOUSE_LL` com thread separada. `useInputActivity` hook conta eventos no frontend como fallback imediato.

**N8 — MVD:** máximo 3 itens. `isMVDAchieved` retorna false para lista vazia. `canAddMVDItem` bloqueia ao atingir MAX_MVD_ITEMS.

---

## Números Finais

| Métrica | Valor |
|---------|-------|
| Arquivos de teste | 57 |
| Testes totais | 578 |
| Domínio modules | 20+ |
| Componentes React | 30+ |
| Rust commands | 9 |
| Idiomas | pt-BR, English |
| i18n keys | 185+ |
| Versão | 1.0.0-alpha |
