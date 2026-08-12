# Vocabulary Learning Game — Architecture (v4, revised)

Status: greenfield project. Scope: 3 maps, 9 questions/week, teacher-authored content, student play sessions, named rooms, per-map mascot characters, student avatar picker, static map backgrounds.

**v4 changes from v3:** named rooms, historical (post-close) scores view, per-map character system with correct/wrong reactions, Kahoot-style student avatar picker, static map background images. See §5d, §10, §11 for the new material; §2's table is left as the v2→v3 record and not repeated here.

---

## 1. System Overview

```
                         INTERNET
                            │
                            ▼
                 ┌────────────────────┐
                 │     CLOUDFLARE      │
                 │ Frontend Hosting/CDN│
                 └─────────┬──────────┘
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │ TEACHER PORTAL│          │ STUDENT GAME │
       │ React + TS    │          │ Phaser + TS  │
       └──────┬───────┘          └──────┬───────┘
              └───────────┬─────────────┘
                          │ HTTPS REST API
                          ▼
                 ┌────────────────────┐
                 │      RENDER        │
                 │   Laravel API      │
                 │ Controllers/Requests│
                 │ Services/Actions    │
                 │ Policies/Resources  │
                 │ Queue Worker (jobs) │
                 └───────┬─────┬──────┘
              ┌──────────┘     └──────────────┐
              ▼                               ▼
       ┌──────────────┐                ┌──────────────┐
       │  TiDB CLOUD  │                │  CLOUDINARY  │
       │ metadata only│                │ images/audio │
       └──────────────┘                └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ TTS PROVIDER │
                  │ async, cache │
                  └──────────────┘
```

This is the same shape as your v2 draft, with the gaps below closed.

---

## 2. What changed from v2, and why

| Area | v2 | v3 | Reason |
|---|---|---|---|
| Repository layer | Full Repository pattern over Eloquent | **Dropped by default.** Services call Eloquent models directly. Add a Repository only for the one or two models where you genuinely swap query strategies (e.g. `VocabularyRepository` if search/matching logic gets complex). | At 9 questions/week scale, a blanket repository layer is indirection with no payoff — it just adds files to keep in sync. |
| TTS generation | Implied synchronous (teacher saves → wait → Cloudinary) | **Queued job.** Saving a question returns immediately; a `GenerateVocabularyAudio` job runs in the background; teacher UI shows a "generating…" badge that flips to "ready" via polling or a websocket event. | A slow/failed TTS call should never block a teacher's save. |
| Audio review | None — cache reused "forever" on first generation | **Review gate.** Generated audio is `pending_review` until a teacher listens and approves it. Only `approved` audio is served to students. | A bad TTS pronunciation gets baked into the cache permanently otherwise — this is the single highest-risk gap in v2. |
| Read caching | None | **Cache published map/question payloads** (`Cache::remember`, keyed by map id + version, TTL or explicit bust-on-publish). | Questions change weekly; students hit the same payload repeatedly in a session. No reason to hit TiDB every time. |
| Student identity | Undefined | **PIN-based room join, no accounts** (see §5). Teacher creates a room → gets a PIN → students enter the PIN → then enter a player name → join. | You need *some* authorization model before "Laravel decides correctness" (§7 below) means anything, without building real auth for kids. |
| Live progress tracking | Not mentioned | **Teacher dashboard shows every joined player, which map/question they're currently on, and a live per-question right/wrong indicator.** (see §5b) | Teacher needs to monitor the room in real time, not just see a final score after the fact. |
| Player-facing scoreboard | Not mentioned | **Right-side panel per player, grouped by map, showing a ✓/✕ indicator per question** (e.g. "Map 1 — Q1: ✕, Q2: ✓, Q3: ✓"). | Explicit requirement — students should see exactly where they went wrong, not just a total score. |
| Environments | Local + Production only | **Add a staging branch/DB** (TiDB supports branching, or just a second cheap cluster) so you publish weekly content to staging first, verify, then promote. | You're going to be editing live lesson content weekly — you want a dry run step. |
| Uptime | Not mentioned | **Add Better Stack (or similar) pinging Render** at a few minutes' interval. | You already hit this exact problem on ZTG/PamilyaHub — Render free tier sleeps. Don't rediscover it here. |

Everything else in your v2 draft (Cloudflare/Render/TiDB/Cloudinary split, DB-vs-media separation, thin controllers, question→vocabulary→audio chain) was already correct and is kept as-is below.

---

## 3. Backend folder structure

```
app/
├── Actions/
│   ├── Game/            # SubmitAnswerAction, StartGameSessionAction
│   ├── Questions/       # CreateQuestionAction, PublishQuestionAction
│   └── Vocabulary/      # ResolveVocabularyAudioAction (cache check + dispatch job)
│
├── Contracts/
│   └── Services/        # interfaces for Cloudinary, TTS — for swappability, no repo contracts needed
│
├── Http/
│   ├── Controllers/     # thin, one action-call each
│   ├── Requests/        # StoreQuestionRequest, SubmitAnswerRequest, etc.
│   └── Resources/       # API response shaping
│
├── Jobs/
│   └── GenerateVocabularyAudio.php
│
├── Models/
├── Policies/
│
├── Services/
│   ├── Audio/           # TextToSpeechService
│   ├── Cloudinary/      # CloudinaryService
│   ├── Game/            # ScoringService
│   └── Vocabulary/      # VocabularyCacheService (search-before-generate)
│
└── Support/
```

Skip `Repositories/` unless a specific model earns it later.

---

## 4. Data model (core tables)

```
users              -- teachers only; students are NOT users (see §5)
rooms              -- teacher_id, name, pin, status[waiting|in_progress|closed], current_map_id
maps               -- teacher-owned, published boolean, order_index (1=EPCES, 2=Prince Hypermart, 3=Naliyagan), question_count,
                      background_cloudinary_public_id, background_url
map_characters      -- map_id (1:1 with maps), name,
                      idle_cloudinary_public_id, idle_url,
                      correct_cloudinary_public_id, correct_url,
                      wrong_cloudinary_public_id, wrong_url
questions          -- map_id, order_index (1..N within the map), sentence, highlighted_word, image_url, cloudinary_public_id, has_context_highlight (bool), has_image (bool)
answers            -- question_id, text, is_correct
vocabularies        -- word, canonical form
vocabulary_audios   -- vocabulary_id, url, cloudinary_public_id, status[pending_review|approved|rejected]
character_audios    -- type[correct|wrong], url, cloudinary_public_id  (uploaded once, not weekly; mascot *sound*, separate from map_characters' visual states)
game_sessions       -- room_id, player_name, avatar_slug, session_token_hash, status[joined|in_progress|completed], current_map_id, current_question_index, started_at, completed_at
student_answers     -- game_session_id, map_id, question_id, question_index_in_map, answer_id, is_correct, answered_at
```

`avatar_slug` is validated server-side against a small fixed enum (e.g. `fox`, `owl`, `turtle`, `frog`, ...) defined in frontend config — it is **not** a foreign key to a DB table. The preset set is static, uploaded once to Cloudinary, and not teacher-editable in v1, so a table would just be indirection with nothing to manage (same reasoning as skipping the Repository layer, §2).

`student_progress` from v2 is redundant with `student_answers` + `game_sessions` — derive progress/score from those rather than maintaining a separate mutable table (avoids a second source of truth going stale).

`maps.question_count` matches the fixed structure from the game design: **Map 1 (EPCES Kingdom) = 3 questions, Map 2 (Prince Hypermart Kingdom) = 5 questions, Map 3 (Naliyagan Kingdom) = 5 questions** (assumed to match Map 2's count per the original design doc — confirm this with the teacher/design source before locking it in). `has_context_highlight` and `has_image` flags on `questions` capture the escalating difficulty across maps (Map 1: picture + highlighted context clue; Map 2: no picture, context clue still highlighted; Map 3: no picture, no highlight — word only underlined). See the companion game-flow document for the full per-map UI flow.

---

## 5. Room + PIN join flow (replaces class-code model)

No student accounts, no passwords — this is a classroom tool, not a public platform.

**Teacher side:**
1. Teacher creates a **room** for a play session, gives it a **name** (e.g. "Grade 5 – Section A, Aug 10") and picks the map set / starts from Map 1. The name is for the teacher's own room list — it plays no role in how students join.
2. Server generates a short numeric **PIN** (e.g. `4-6` digits, e.g. `284917`), unique among currently-*active* rooms (PINs can be reused once a room closes).
3. Teacher's screen shows the PIN large, plus a live list of joined players (see §5b).
4. Teacher explicitly **starts** the game once players have joined — students who join mid-game either wait for the next room or are blocked (decide which; default: blocked, cleaner state).

**Student side:**
1. Homepage → "Join Game" → enter PIN.
2. Server validates: PIN exists, room is still in `waiting` status (not started/closed) → if valid, proceed; if not, show a clear error ("PIN not found" / "This game has already started").
3. Student is prompted for a **player name**, then picks a basic **avatar** from a fixed preset set (Kahoot-style — no customization, purely a visual identity marker, not the same thing as the per-map character in §5e).
4. Server creates a `game_session` row: `room_id`, `player_name`, `avatar_slug`, `status = joined`. Returns an opaque, signed **session token** to the Phaser client.
5. That session token is what authorizes every subsequent call (`start-question`, `submit-answer`) — never the player name or PIN alone, since those aren't secret/unique enough to trust as auth.

**Validation on every request (§7 still applies):**
Laravel checks: session token valid → session belongs to an active room → question belongs to the room's current map → room hasn't been closed by the teacher. Never trust the client's claim of "what map/question I'm on."

**Player name collisions:** Two students can pick the same display name in the same room — allow it, but disambiguate on the teacher dashboard using the underlying session id (e.g. show as "Anna (2)" if a duplicate).

### 5a. Data model additions/changes

```
rooms              -- id, teacher_id, pin, status[waiting|in_progress|closed], current_map_id
game_sessions      -- room_id, player_name, session_token_hash, status[joined|in_progress|completed], current_map_id, current_question_index
student_answers    -- game_session_id, map_id, question_id, question_index_in_map, answer_id, is_correct, answered_at
```

`current_map_id` + `current_question_index` on `game_sessions` is what powers the teacher's live tracking view — updated server-side whenever the student's client requests the next question, not client-declared.

### 5b. Teacher live tracking dashboard

While a room is active, the teacher's portal shows, per joined player:
- Player name
- Current map (e.g. "Map 2 — Prince Hypermart Kingdom")
- Current question number within that map (e.g. "Q3 of 5")
- Running tally: correct / wrong so far, and which specific questions were wrong (map + question number)

This is driven by the same `student_answers` + `game_sessions.current_*` fields the scoreboard uses (§5c) — same data, two views. Push updates via Pusher/websocket broadcast on a room-scoped private channel (`room.{room_id}`) so the teacher's screen updates live without polling; fall back to a 3–5s poll if websockets aren't available.

### 5c. Student-facing scoreboard (right-side panel)

Visible to the student throughout play (and on a results screen at the end), grouped by map:

```
Map 1 — EPCES Kingdom
  Q1: ✓
  Q2: ✕
  Q3: ✓

Map 2 — Prince Hypermart Kingdom
  Q1: ✓
  Q2: ✓
  Q3: —   (not yet answered)
  ...
```

Rules:
- Only questions already answered show ✓/✕; unanswered questions show a neutral placeholder (`—` or dimmed), never blank/missing — the student should always see the full shape of what's ahead.
- Source of truth is `student_answers` (`is_correct` written once at submit time, per §6 below) — the scoreboard never recomputes correctness client-side, only renders what the server already decided.
- This same per-question breakdown is what the teacher dashboard reads for the "which questions were wrong" tally in §5b — one table, two consumers.

### 5d. Historical scores view (closed rooms)

Teacher's room list shows every room they own (named per §5, newest first), each with a "View Scores" button/action — this is one route, two data-freshness states, not a separate feature:

- **Room still `waiting`/`in_progress`:** button opens the live tracking view (§5b).
- **Room `closed`:** same route (`GET /rooms/{id}/results`), same Policy check as everything else (teacher-ownership scoping, rules-and-validation.md §6), but the underlying `student_answers` + `game_sessions.current_*` data is already frozen per rules-and-validation §4a ("Room close behavior") — so it just renders as a static final scoreboard instead of pushing live updates.

No new table. This is a routing/UI decision on top of data that already exists.

### 5e. Visual layer: map background, per-map character, student avatar

Three distinct visual pieces, don't conflate them:

| Piece | Scope | Where it appears | Reacts to answers? |
|---|---|---|---|
| Map background | 1 static image per map | Behind the whole question screen while playing that map | No |
| Map character (mascot) | 1 per map, 3 states (`idle`/`correct`/`wrong`) | Right side of every question screen for that map | Yes — swaps state after each submit |
| Student avatar | 1 per session, picked from a fixed preset at join | Small identity marker next to the player's name (join screen, teacher dashboard, scoreboard) | No |

**Question screen layout (per §7 of rules-and-validation.md's per-map difficulty design):** question image (Map 1 only) at top → sentence + multiple-choice answers below → map's character docked on the right, reacting on submit. The character state swap is driven by the server's already-computed `is_correct` (architecture.md §7) — never decided client-side, same rule as scoring.

**Asset pipeline (how art gets in):** this is a one-time, offline asset pipeline, not a runtime integration — Laravel never calls an image-generation API. Generate the 9 character images (3 maps × idle/correct/wrong) and 3 backgrounds ahead of time (e.g. with Gemini's Nano Banana models, which support multi-reference-image conditioning for character consistency — lock a single "character sheet" reference image per mascot first, then generate the `correct`/`wrong` variants *from* that reference rather than re-describing the character each time), review them yourself, then upload the finals to Cloudinary and store the returned `public_id`/`url` on `maps` / `map_characters` through the normal map-creation endpoints. No job/queue needed here (unlike TTS) since this isn't weekly content — it's set once per map.

---

## 6. TTS cache flow (unchanged core logic, now async + reviewed)

```
Teacher saves question with word "exhausted"
        ↓
VocabularyCacheService: search vocabulary_audios for "exhausted"
        ↓
   ┌────┴────┐
 EXISTS    MISSING
   │            │
 status=      dispatch GenerateVocabularyAudio job
 approved?         ↓
   │           TTS Provider → Cloudinary → save row, status=pending_review
 reuse             ↓
              Teacher notified in portal → listens → approves/rejects
                   ↓
              approved → now servable to students
              rejected → regenerate or manually re-record
```

Log `tts_cache_hit`, `tts_generation`, `tts_failure` events — these are your cost signal, keep tracking them as planned in v2.

---

## 7. Security & validation (kept from v2, now grounded in §5)

Student sends only: `game_session_token`, `question_id`, `answer_id`.
Laravel independently checks: session active → room not closed → question belongs to the room's current map → map published → answer belongs to question → computes correctness → advances `current_map_id`/`current_question_index` server-side. The Phaser client only renders the result and the next question it's given back — it never computes correct/incorrect itself, and never tells the server what map/question comes next. The PIN and player name are never treated as credentials on their own; only the signed session token issued after join authorizes any gameplay call (§5).

---

## 8. Deployment

```
Local:  React/Phaser → localhost, Laravel → localhost, TiDB (dev branch) + Cloudinary → remote
Staging: Cloudflare preview / Render staging service → TiDB staging branch
Production: Cloudflare → Render → TiDB Cloud (prod) → Cloudinary / TTS
```

Add Better Stack (or UptimeRobot) pinging the Render API every few minutes to prevent free-tier sleep — same fix you already applied on ZTG/PamilyaHub.

Git: `main`, `develop`, `feature/*`, `fix/*`. CI/CD: frontend → Cloudflare, backend → Render, gated on staging verification for weekly content pushes specifically (not every code deploy needs this, just content publishing).

---

## 9. Development build phases (execution order)

This is the order to actually build the system in, one phase at a time per skills.md §1 — stop and confirm at the end of each before starting the next. Every backend phase ends with automated tests, not a manual "looks right" check (skills.md §4).

**Phase 0 — Project scaffolding**
- Create repo, folder structure: `backend/` (Laravel), `frontend-portal/` (React/TS), `frontend-game/` (Phaser/TS).
- `composer create-project laravel/laravel backend`, install Sanctum (teacher auth), Pusher/websocket broadcasting package, queue driver.
- `npm create vite@latest` for both frontends (React-TS template for portal, vanilla-TS or React-wrapper template for Phaser).
- Set up `.env` for TiDB, Cloudinary, TTS provider, Pusher — local only at this stage, no live keys committed.
- Create `backend/tests/Feature` and `backend/tests/Unit` (Laravel ships both, just confirm they're wired to PestPHP or PHPUnit, whichever the team prefers) — this is the folder from your "create a folder for test" step, it lives inside `backend/`, not as a sibling of it.
- **Verify:** `php artisan test` runs (even with zero real tests yet) and `npm run dev` boots both frontend shells.

**Phase 1 — Migrations + models (no endpoints yet)**
- All tables from §4/§5a, including v4 additions: `rooms.name`, `maps.background_*`, `map_characters`, `game_sessions.avatar_slug`.
- Eloquent models + relationships, no business logic yet.
- **Test:** migration round-trip (`migrate:fresh` succeeds), model factory + relationship unit tests (a `Map` has many `Question`s, a `Map` has one `MapCharacter`, etc.).

**Phase 2 — Auth + teacher ownership**
- Teacher registration/login (Sanctum), Policies for map/room/question ownership (rules-and-validation §6).
- **Test:** feature tests proving a teacher cannot read/write another teacher's map/room/question (403), per skills.md §4's "unauthorized owner" requirement.

**Phase 3 — Core CRUD: maps, questions, answers, rooms**
- Form Requests from skills.md §3, thin controllers → Actions → Resources.
- Includes `rooms.name` on create, `maps.background_*` and `map_characters` upload endpoints.
- Publish-gate logic (rules-and-validation §2, including the new background/character checks).
- **Test:** feature test per endpoint — happy path, invalid payload (422), unauthorized owner (403); a dedicated test for the publish-gate 422 listing *which* question/word is blocking.

**Phase 4 — Vocabulary + TTS pipeline**
- `VocabularyCacheService`, `GenerateVocabularyAudio` job, review/approve/reject flow (§6).
- **Test:** unit tests for cache hit / miss / rejected-audio branches (skills.md §4); feature test that unapproved audio blocks publish.

**Phase 5 — Room/PIN join + game session flow**
- PIN generation/uniqueness, join endpoint (name + avatar pick), session token issuance, `SubmitAnswerRequest` + scoring (§7).
- **Test:** the non-negotiable one from skills.md §4 — a feature test proving a client-submitted "correct" flag is ignored and the server's own computation wins. Plus: duplicate-submit 409, join-after-start rejection, PIN uniqueness-among-active-rooms.

**Phase 6 — Live tracking + historical scores API**
- Room-scoped broadcast channel, `current_map_id`/`current_question_index` server-side advancement, `GET /rooms/{id}/results` (§5d).
- **Test:** broadcast event fires on `student_answers` write; results endpoint returns identical shape whether room is open or closed (just live vs. frozen).

**Phase 7 — Frontend: teacher portal (React)**
- Map/question/room builder, publish flow, live dashboard, historical scores view, room naming UI, character/background upload UI.
- Typed API clients per resource (skills.md §5) — no ad-hoc `fetch()`.

**Phase 8 — Frontend: student game (Phaser) + visual assets**
- PIN join → name → avatar picker → question screen (image/sentence/answers/character per §5e) → scoreboard.
- Drop in the Gemini-generated backgrounds/character states (§5e) once Phase 3's upload endpoints exist to actually store them.

**Phase 9 — End-to-end integration pass**
- Full run: teacher creates named room → student joins with PIN + avatar → plays all 3 maps → teacher views live, then closed, scores.
- Regression run of the full automated suite before this is called done — not a self-certified "it works" (skills.md §4).

**Phase 10 — Deployment**
- As already specified in §8 above: staging branch/DB, Better Stack ping, CI/CD gated on staging verification for content pushes.

---

## 10. Explicitly out of scope for v1

- Repository pattern (add later only if justified)
- Student accounts/passwords (deliberately replaced by PIN + player name, §5 — not a gap, a decision)
- Cross-room / historical leaderboards across multiple play sessions
- Analytics dashboards beyond the live room view (§5b) and raw `student_answers` queries

Keep this list visible so scope doesn't creep back in mid-build.
