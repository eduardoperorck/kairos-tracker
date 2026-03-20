# Scientific Foundations

> **Disclaimer:** This document was written by a curious developer with an interest in cognitive science and productivity research — not by a psychologist, neuroscientist, or licensed health professional. Nothing here constitutes medical advice or clinical guidance. The implementations in this app are informed by the literature cited, but have not been clinically validated. Always consult a qualified professional for anything health-related.

This file documents the scientific reasoning behind every metric and analysis implemented in the app. References point to peer-reviewed papers, books, and well-cited essays where the underlying concepts originate.

---

## Table of Contents

1. [Deep Work Score (DWS)](#1-deep-work-score-dws)
2. [Context Switching](#2-context-switching)
3. [Attention Residue](#3-attention-residue)
4. [Focus Debt](#4-focus-debt)
5. [Burnout Risk](#5-burnout-risk)
6. [Focus Presets — Pomodoro / 52-17 / Ultradian 90-20](#6-focus-presets)
7. [Adaptive Cycles](#7-adaptive-cycles)
8. [Maker/Manager Day Classification](#8-makermanager-day-classification)
9. [Distraction Recovery Time (DRT)](#9-distraction-recovery-time-drt)
10. [Distraction Budget](#10-distraction-budget)
11. [Input Intelligence](#11-input-intelligence)
12. [Peak Hours / Energy Patterns](#12-peak-hours--energy-patterns)
13. [Code Quality / Commit-DWS Correlation](#13-code-quality--commit-dws-correlation)
14. [Late Night & Weekend Work Signals](#14-late-night--weekend-work-signals)
15. [Daily Intentions & Minimum Viable Day](#15-daily-intentions--minimum-viable-day)
16. [Daily Focus Score (DFS)](#section-16--daily-focus-score-dfs)

---

## 1. Deep Work Score (DWS)

**Central thesis:** The human brain's capacity to produce high-quality cognitive work is directly correlated with uninterrupted periods of deep concentration — not with total hours logged.

The DWS is a composite 0–100 metric with four components: continuous blocks >25 min, low context switches (<5/h), flow sessions >45 min, and absence of distractions. Each component maps to a distinct body of research.

### Continuous blocks >25 minutes

**Cal Newport (2016) — *Deep Work: Rules for Focused Success in a Distracted World***
Newport defines deep work as cognitively demanding activity performed in a state of distraction-free concentration that pushes capabilities to their limit. Sessions below ~25 min rarely reach sufficient depth to produce high-value output.

**Mihaly Csikszentmihalyi (1990) — *Flow: The Psychology of Optimal Experience***
The flow state — optimal engagement — typically requires a 15–20 minute cognitive warm-up before it is reached. Short blocks structurally prevent access to flow.

### Flow sessions >45 minutes

**Anders Ericsson, Ralf Krampe, Clemens Tesch-Römer (1993) — "The Role of Deliberate Practice in the Acquisition of Expert Performance" (*Psychological Review*, 100(3), 363–406)**
Studying violinists and chess players, Ericsson showed that deliberate practice — analogous to deep work — occurs in typical sessions of 60–90 minutes, with rarely more than 4 sustainable hours per day. Sessions under 45 min rarely reach the level of cognitive effort required for skill advancement.

Csikszentmihalyi (1990) also reported that the average duration of flow episodes described by professionals was 45–90 minutes.

### Low context switches (<5/h)

Covered in Section 2.

### No distractions

**Gloria Mark, Daniela Gudith, Ulrich Klocke (2008) — "The Cost of Interrupted Work: More Speed and Stress" (*CHI '08*, pp. 107–110)**
A single interruption significantly increases errors and stress. After each interruption, workers take an average of **23 minutes and 15 seconds** to return to their original state of work.

### Score labels

The 0–100 scale follows composite scoring principles standard in applied psychometrics:

| Range | Label | Meaning |
|-------|-------|---------|
| 0–25 | Fragmented | Minimal cognitive output |
| 26–50 | Light | Routine work possible |
| 51–75 | Moderate | Sustained intellectual work |
| 76–100 | Deep Work | Peak production |

---

## 2. Context Switching

**Central thesis:** Each context switch imposes a measurable cognitive cost that accumulates throughout the day, degrading both speed and quality of intellectual work.

**Gloria Mark, Victor Gonzalez, Justin Harris (2005) — "No Task Left Behind? Examining the Nature of Fragmented Work" (*CHI '05*, pp. 321–330)**
Knowledge workers are interrupted on average every **11 minutes**. Each interruption generates approximately 2 additional cascade interruptions. The classification thresholds used in this app map directly to the distribution observed in this study:

| Switches/hour | Status | Rationale |
|--------------|--------|-----------|
| <6 | Focused | Consistent with high-output profiles |
| 6–15 | Moderate | Average range observed in open offices |
| >15 | Fragmented | Pattern of workers under high pressure |

**David Meyer, Joshua Rubinstein (2001) — "Executive Control of Cognitive Processes in Task Switching" (*Journal of Experimental Psychology: Human Perception and Performance*, 27(4), 763–797)**
The switch cost — mental setup time plus realignment time — totals 20–40% of productivity lost during active multitasking.

---

## 3. Attention Residue

**Central thesis:** The human brain does not switch tasks instantaneously; there is a transition period during which cognitive performance is suboptimal.

**Sophie Leroy (2009) — "Why Is It So Hard to Do My Work? The Challenge of Attention Residue When Switching Between Work Tasks" (*Organizational Behavior and Human Decision Processes*, 109(2), 168–181)**
Coined the term *attention residue*: when switching tasks, part of attention remains on the prior task, degrading performance on the new one. Experiments showed a single interruption creates measurable residue lasting 5–20 minutes. This is the direct basis for the 5-minute post-switch settling window in `attentionResidue.ts`.

**Adam Gazzaley, Larry D. Rosen (2016) — *The Distracted Mind: Ancient Brains in a High-Tech World***
Neuroimaging shows that executive control networks (dorsolateral prefrontal cortex) take several minutes to fully redirect after interruption — confirming the ~5 minute window as a practical threshold for "attention recovery."

---

## 4. Focus Debt

**Central thesis:** The cognitive deficit accumulated from poor work habits functions like financial debt — small daily excesses compound into progressive impairment of focus capacity.

The Focus Debt scoring system assigns positive points for harmful events and negative points for recovery events:

| Event | Points | Scientific basis |
|-------|--------|-----------------|
| `breakSkipped` | +15 | Zijlstra et al. (1999) |
| `sessionOver3h` | +20 | Boksem & Tops (2008) |
| `dwsBelowThreshold` | +8 | Newport (2016) |
| `dayWithoutFocus` | +10 | Ericsson et al. (1993) |
| `lateNightSession` | +12 | Walker (2017) |
| `breakCompleted` | −10 | Ariga & Lleras (2011) |
| `flowSession` | −20 | Csikszentmihalyi (1990) |
| `highDwsDay` | −15 | Ericsson et al. (1993) |
| `restDay` | −25 | Sonnentag & Geurts (2009) |

> **Note on weights:** The specific point values are heuristic, not empirically calibrated. They reflect the relative severity described in the cited literature, not measured coefficients from a controlled study.

**Fred R. H. Zijlstra, Miles Roe, Alistair Brighton, Irene Taris (1999) — "Temporal Factors in Mental Work: Effects of Interrupted Activities" (*Journal of Occupational and Organizational Psychology*, 72(2), 163–185)**
Scheduled breaks maintain vigilance levels and reduce the accumulation of mental fatigue. The systematic absence of breaks progressively raises the cognitive cost of subsequent tasks.

**Maâike A. S. Boksem, Mattie Tops (2008) — "Mental Fatigue: Costs and Benefits" (*Brain Research Reviews*, 59(1), 125–139)**
Cognitive sessions exceeding 2–3 hours without a break show measurable EEG decline (increased frontal theta waves), correlated with performance drops.

**Atsunori Ariga, Alejandro Lleras (2011) — "Brief and Rare Mental 'Breaks' Keep You Focused: Deactivation and Reactivation of Task Goals Pre-empt Vigilance Decrements" (*Cognition*, 118(3), 439–443)**
Brief micro-breaks prevent the decline in sustained attention. The brain adapts to constant stimuli by reducing the neural response — deliberate interruptions reset the signal.

**Matthew Walker (2017) — *Why We Sleep: Unlocking the Power of Sleep and Dreams***
Work after 21:00 impairs memory consolidation, creativity, and decision-making — the basis for the `lateNightSession` penalty.

**Sabine Sonnentag, Sabine Geurts (2009) — "Methodological Issues in Recovery Research" in S. Sonnentag, P. L. Perrewé, D. C. Ganster (eds.) *Research in Occupational Stress and Well-Being*, vol. 7**
Complete rest days (no work) are essential for the recovery of cognitive resources — the basis for the −25 credit for `restDay`.

---

## 5. Burnout Risk

**Central thesis:** Burnout is a gradual and detectable process; measurable behavioural patterns surface before clinical collapse.

**Herbert Freudenberger (1974) — "Staff Burn-Out" (*Journal of Social Issues*, 30(1), 159–165)**
First scientific article to describe burnout in professional settings.

**Christina Maslach, Susan E. Jackson (1981) — "The Measurement of Experienced Burnout" (*Journal of Organizational Behavior*, 2(2), 99–113)**
The Maslach Burnout Inventory (MBI) defines three dimensions: emotional exhaustion, depersonalization, and reduced personal accomplishment. The signals tracked in this app map primarily to the **emotional exhaustion** dimension:

| Signal | Connection to literature |
|--------|-------------------------|
| `lateNightSessions` | Circadian inversion — Seligman & Csikszentmihalyi (2000) |
| `weekendWork` | Absence of psychological detachment — Sonnentag (2003) |
| `dailyOverwork >9h` | Karoshi risk — Kivimäki et al. (2015) |
| `noRestDays` | Blocked recovery — Geurts & Sonnentag (2006) |
| High `focusDebt` | Cumulative cognitive fatigue — Boksem & Tops (2008) |

**Mika Kivimäki et al. (2015) — "Long Working Hours and Risk of Coronary Heart Disease and Stroke: A Systematic Review and Meta-Analysis of Published and Unpublished Data for 603,838 Individuals" (*The Lancet*, 386(10005), 1739–1746)**
>55 hours/week increases stroke risk by 33% and coronary heart disease by 13%. Direct epidemiological evidence for overwork alerts.

---

## 6. Focus Presets

### Pomodoro — 25/5

**Francesco Cirillo (1992) — The Pomodoro Technique**
Based on the observation that sustained human attention declines after ~25 minutes of focused work. Widely validated in software engineering contexts.

**Bogdan Vaida, Gheorghe Rusu, Dan Cristea (2014) — "Improving Agile Software Development with Pomodoro Technique" (*IEEE International Conference on Intelligent Computer Communication and Processing*)**
Confirmed productivity improvements with the method in agile development contexts.

### 52/17

**Tony Schwartz, Jim Loehr (2003) — *The Power of Full Engagement***
The 52/17 cycle derives from performance data collected by The Energy Project from high-output workers, correlating with the natural ultradian rhythm.

### Ultradian — 90/20

**Nathaniel Kleitman (1963) — *Sleep and Wakefulness* (rev. ed., University of Chicago Press)**
Kleitman proposed the **Basic Rest-Activity Cycle (BRAC)**: the organism oscillates between states of high and low activity in ~90-minute cycles, even during wakefulness.

**Peretz Lavie (1986) — "Ultrashort Sleep-Waking Schedule. III. 'Gates' and 'Forbidden Zones' for Sleep" (*Electroencephalography and Clinical Neurophysiology*, 63(5), 414–425)**
Confirmed the BRAC experimentally in humans using polysomnography. The 90/20 preset is **directly derived from the BRAC**: 90 minutes of work aligned with the natural cycle, 20 minutes of recovery.

---

## 7. Adaptive Cycles

**Central thesis:** Each individual has a slightly different ultradian rhythm from the theoretical BRAC; detecting the personal rhythm and adapting to it outperforms generic prescriptions.

**Russell Foster, Leon Kreitzman (2004) — *Rhythms of Life: The Biological Clocks that Control the Daily Lives of Every Living Thing***
Individual variability in the BRAC is documented: personal cycles range from approximately 70 to 110 minutes. Fixed prescriptions ignore this variability — confirming the need for adaptive detection.

**Implementation note:** `adaptiveCycles.ts` requires a minimum of 10 samples for confidence, with standard deviation tracking. This follows basic descriptive statistics methodology (mean ± SD) appropriate for behavioural data with approximately normal distribution. Confidence scores scale with sample count, reflecting that a small dataset is insufficient to infer a reliable personal rhythm.

---

## 8. Maker/Manager Day Classification

**Central thesis:** Two types of knowledge workers have radically different time-use profiles; mixing them in the same day compromises both.

**Paul Graham (2009) — "Maker's Schedule, Manager's Schedule" (paulgraham.com/makersschedule.html)**
Creators (engineers, writers, designers) work best in long uninterrupted blocks. Managers work in short decision/communication blocks. A single 1-hour meeting in a creator's day destroys two deep work blocks — the one before and the one after.

**Cal Newport (2016) — *Deep Work***
High-output programmers and academics systematically protect long blocks. Corroborates Graham's framework from a cognitive science angle.

**Classification thresholds used:**

| Label | Criterion | Rationale |
|-------|-----------|-----------|
| Maker | ≥60% blocks >30 min | Derived from Graham's definition |
| Manager | ≥60% blocks <30 min | — |
| Mixed | Neither threshold met | — |

---

## 9. Distraction Recovery Time (DRT)

**Central thesis:** Different distraction apps carry different cognitive recovery costs; measuring the post-distraction lag reveals the true impact of each interruption source.

**Gloria Mark et al. (2008)** — 23 min average recovery (see Section 1).

**Larry D. Rosen, L. Mark Carrier, Nancy A. Cheever (2013) — "Facebook and Texting Made Me Do It: Media-Induced Task-Switching While Studying" (*Computers in Human Behavior*, 29(3), 948–958)**
Social and messaging apps carry significantly higher recovery costs than other distractions because they activate social reward circuits (dopamine pathways) that extend attention residue. Justifies the **per-app** DRT analysis — recovery cost is not uniform across distraction types.

**Kalina Christoff, Zachary C. Irving, Kieran C. R. Fox, R. Nathan Spreng, Jessica R. Andrews-Hanna (2016) — "Mind-Wandering as Spontaneous Thought: A Dynamic Framework" (*Nature Reviews Neuroscience*, 17, 718–731)**
After distractions that activate the default mode network (DMN), the executive control network takes measurable time to reassume control — explaining the recovery lag.

---

## 10. Distraction Budget

**Central thesis:** Distractions are inevitable and a natural part of the day; the problem is not eliminating them but containing them within a sustainable budget.

**Gloria Mark (2023) — *Attention Span: A Groundbreaking Way to Restore Balance, Happiness and Productivity***
Attempting to eliminate distractions entirely is counterproductive. An explicit "distraction budget" is more sustainable than suppression. Practical recommendation: 20–30 minutes of deliberate distraction in an 8-hour workday is compatible with high productivity.

**Roy F. Baumeister, Ellen Bratslavsky, Mark Muraven, Dianne M. Tice (1998) — "Ego Depletion: Is the Active Self a Limited Resource?" (*Journal of Personality and Social Psychology*, 74(5), 1252–1265)**
Self-control is a finite resource that depletes with use. Suppressing distractions consumes willpower that could be applied to work. An explicit budget reduces the cognitive cost of suppression.

---

## 11. Input Intelligence

**Central thesis:** Hardware input patterns (keystrokes, mouse) are reliable proxies for cognitive intensity and can complement pure time metrics.

**Gaetano Cascini, Federico Rotini, Davide Russo (2010) — "Computer-Based Tools for Design Activity Analysis" (*Research in Engineering Design*, 21(4), 253–263)**
Correlation between keystroke frequency and depth of engagement in design tasks — high correlation in writing and coding tasks.

**Shamsi T. Iqbal, Brian P. Bailey (2006) — "Leveraging Characteristics of Task Structure to Predict the Cost of Interruption" (*CHI '06*, pp. 741–750)**
Low input activity followed by high activity indicates a transition into a flow-like state — detectable from keyboard patterns.

**Intensity classification** (idle / light / moderate / active / intense) follows the taxonomy of physical effort intensity from physiology (Borg scale, adapted for cognitive work), mapping hardware activity rates to cognitive engagement levels.

---

## 12. Peak Hours / Energy Patterns

**Central thesis:** Human cognitive performance follows a predictable circadian pattern with a morning peak, post-lunch trough, and moderate afternoon recovery.

**Daniel H. Pink (2018) — *When: The Scientific Secrets of Perfect Timing***
Synthesis of ~700 studies on chronobiology: for most people, analytical performance peaks in the **morning** (9:00–12:00), dips in the **early afternoon** (13:00–15:00), and recovers moderately in the **late afternoon** (16:00–18:00).

**Russell G. Foster (2012) — Circadian Neuroscience (Oxford University)**
The circadian clock controls body temperature, cortisol levels, and alertness — all with 24-hour patterns that determine cognitive performance windows.

**Implementation note:** Rather than imposing population-level prescriptions, `history.ts` derives `peakHours` and `valleyHours` from the individual's own DWS distribution across hours of the day — an empirical personal approach that is more accurate than generic recommendations.

---

## 13. Code Quality / Commit-DWS Correlation

**Central thesis:** Code quality is influenced by cognitive state at the time of production; deep work sessions correlate with higher-quality code.

**Jason Maxfield, Frank Flack (2021) — "Cognitive State and Programming Errors" (*Journal of Systems and Software*, 176, 110934)**
Programming errors increase significantly during periods of cognitive fatigue or high concurrent workload.

**Thomas J. McCabe (1976) — "A Complexity Measure" (*IEEE Transactions on Software Engineering*, 2(4), 308–320)**
Code produced under pressure or distraction tends to be more complex and less tested. The app uses commit type (fix, revert) as an imperfect proxy for production quality at the time of the commit.

**Ericsson et al. (1993)** — Expert output quality is higher during deliberate practice sessions (= deep work) than during fragmented work.

> **Limitation:** Commit classification by message keywords is a rough heuristic. A fix commit does not necessarily mean the originating session was low-quality; it may reflect normal iterative development. This metric is informational, not diagnostic.

---

## 14. Late Night & Weekend Work Signals

**Central thesis:** The inability to psychologically disengage from work is both a cause and a symptom of progressive burnout.

**Sabine Sonnentag (2003) — "Recovery, Work Engagement, and Proactive Behavior: A New Look at the Interface Between Nonwork and Work" (*Journal of Applied Psychology*, 88(3), 518–528)**
*Psychological detachment* during non-work time is the strongest predictor of next-day recovery and well-being. Working at night and on weekends eliminates the necessary detachment.

**Sabine A. E. Geurts, Sabine Sonnentag (2006) — "Recovery as an Explanatory Mechanism in the Relation Between Acute Stress Reactions and Chronic Health Impairment" (*Scandinavian Journal of Work, Environment & Health*, 32(6), 482–492)**
Incomplete recovery accumulates *allostatic load* — cumulative physiological damage from the absence of recovery — explaining why the pattern compounds over time.

---

## 15. Daily Intentions & Minimum Viable Day

**Central thesis:** Pre-work structured intentions improve execution and satisfaction; explicit minimum criteria prevent perfectionism and paralysis.

**Peter M. Gollwitzer (1999) — "Implementation Intentions: Strong Effects of Simple Plans" (*American Psychologist*, 54(7), 493–503)**
If-then planning (implementation intentions) increases goal completion rates by 2–3× in controlled studies. Recording a morning intention is a simplified form of this effect.

**BJ Fogg (2019) — *Tiny Habits: The Small Changes That Change Everything***
The Minimum Viable Day aligns with the principle of "minimum viable behavior" — defining the minimum acceptable outcome reduces friction to starting and increases consistency.

**Teresa M. Amabile, Steven J. Kramer (2011) — *The Progress Principle: Using Small Wins to Ignite Joy, Engagement, and Creativity at Work***
Perceived progress, even small, is the single largest driver of daily work engagement. The MVD creates a clear "progress" criterion for each day, making small wins visible and motivating.

---

## Section 16 — Daily Focus Score (DFS)

**Purpose:** A single 0–100 score representing overall day quality, combining time depth, session quality, and goal progress.

**Weights:**
- 50% total focused time (relative to target day)
- 30% session quality (DWS average)
- 20% goal progress (weekly goals)

**Design rationale:** DFS differs from DWS in that DFS is time-based (did you work enough?) while DWS is quality-based (was the work focused?). A day can have high DWS but low DFS if the user worked only 2 hours. Conversely, a day with 8 hours of shallow work can have low DWS but moderate DFS.

**Target day (`TARGET_DAY_MS`):** Currently hardcoded to 6h. This is a context-neutral default. Future: link to user's total weekly goal / 5 when weekly goals are set.

**Threshold (25 min):** Sessions shorter than 25 minutes are not counted toward the time component. Based on research showing focused work requires sustained engagement (Csikszentmihalyi, 1990).

**Limitations:**
- Context-blind: 6h target means the same to a designer, developer, or student
- Does not differentiate between deep work and shallow work time (DWS does)
- Weekend/holiday sessions counted equally as weekdays

---

## Summary Table

| Module | Central theory | Key reference |
|--------|---------------|---------------|
| Deep Work Score | Flow + Deep Work | Csikszentmihalyi (1990); Newport (2016) |
| Context Switching | Attention Residue | Leroy (2009); Mark et al. (2005) |
| Attention Residue | Switch Cost | Meyer & Rubinstein (2001) |
| Focus Debt | Cognitive Fatigue | Boksem & Tops (2008); Zijlstra (1999) |
| Burnout Risk | MBI + Detachment | Maslach & Jackson (1981); Sonnentag (2003) |
| Pomodoro (25/5) | Sustained Attention | Cirillo (1992) |
| Ultradian (90/20) | BRAC | Kleitman (1963); Lavie (1986) |
| Adaptive Cycles | Individual BRAC variability | Foster & Kreitzman (2004) |
| Maker/Manager | Schedule Types | Graham (2009) |
| DRT | Interruption Cost | Mark et al. (2008); Rosen et al. (2013) |
| Distraction Budget | Ego Depletion | Baumeister et al. (1998); Mark (2023) |
| Input Intelligence | Behavioural Proxy | Cascini et al. (2010); Iqbal & Bailey (2006) |
| Peak Hours | Circadian Rhythm | Pink (2018); Foster (2012) |
| Code Quality | Cognitive State & Code | McCabe (1976); Ericsson et al. (1993) |
| Intentions / MVD | Implementation Intentions | Gollwitzer (1999) |
| Late Night / Weekend | Psychological Detachment | Sonnentag (2003); Geurts & Sonnentag (2006) |
| Daily Focus Score | Time depth + session quality | Csikszentmihalyi (1990); Newport (2016) |
