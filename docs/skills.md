# Agent Skills & Working Rules — Vocabulary Learning Game

Paste this into your agent's system/rules config (Windsurf/Cursor) at project start. It defines *how* the agent works, not just what stack to use.

---

## 1. Workflow discipline

1. **Audit before you fix.** For any bug or feature request, first investigate and report findings (files touched, root cause, proposed change) before writing code. Wait for confirmation unless explicitly told to proceed straight through.
2. **One phase at a time.** Break work into small, named phases and follow the build order in architecture.md §9 ("Development build phases") — scaffolding → migrations/models → auth → core CRUD → vocabulary/TTS → game session/scoring → live+historical tracking → teacher portal → student game/assets → integration → deployment. Stop at the end of each phase and wait for a go-ahead before starting the next, unless told otherwise.
3. **No bundling.** If you notice an unrelated bug while working, **stop and report it** — do not fix it inline as part of the current task. Log it as a separate item.
4. **Never self-certify.** Do not report a task as "PASS," "done," or "working" based on your own read of the code. Provide the specific thing to check (a screenshot to take, a query to run, a request to send) so it can be independently verified.
5. **Cite the "why."** Every non-trivial change should note which requirement/phase of the architecture doc it satisfies (e.g. "this implements the async TTS job from architecture.md §6").

---

## 2. Hard boundaries (never violate)

- Laravel is **API-only**. No Blade views, no server-rendered pages for the game or portal.
- React (teacher portal) and Phaser (student game) are **separate frontend apps**, both stateless clients of the API — neither talks to TiDB or Cloudinary directly.
- Controllers stay thin: request in → Form Request validation → Action/Service call → Resource out. Never put TTS calls, Cloudinary calls, scoring logic, or raw DB queries inside a controller.
- External providers (Cloudinary, TTS) are only ever called through their dedicated Service class — never inline from a Controller, Action, or (especially) a React/Phaser component.
- Never trust client-submitted correctness. The student game submits `question_id` + `answer_id` only; Laravel computes and returns the result. See architecture.md §7.
- No binary files (images/audio) go into TiDB — metadata + URL only. Binaries live in Cloudinary.
- No repository layer unless a specific model's query complexity genuinely justifies one — ask before adding one preemptively.

---

## 3. Validation rules

Apply Form Request validation for every mutating endpoint. Minimum required rules per resource:

**StoreQuestionRequest / UpdateQuestionRequest**
- `map_id`: required, must belong to the authenticated teacher
- `sentence`: required, string, contains the `highlighted_word` as a substring
- `highlighted_word`: required, string, max 50 chars
- `image`: optional on update, required on create; image mimes only, max size enforced (agree a limit, e.g. 5MB)
- `answers`: required array, min 2 / max 4 items
- `correct_answer`: required, must be one of the submitted `answers`

**SubmitAnswerRequest**
- `game_session_token`: required, must resolve to an active session
- `question_id`: required, must belong to the session's map
- `answer_id`: required, must belong to `question_id`

**StoreMapRequest**
- `title`: required, string
- `teacher_id`: implicit from auth, never trust a client-submitted teacher/owner id
- `background_image`: image mimes only, max size enforced, required before publish (not required at draft-save time — see rules-and-validation §2)

**StoreMapCharacterRequest**
- `map_id`: required, must belong to the authenticated teacher
- `idle_image`, `correct_image`, `wrong_image`: image mimes only, max size enforced; all three required before the owning map can be published

**StoreRoomRequest**
- `name`: required, 1–100 chars, defaults to `"Room #{pin}"` server-side if omitted — never blocks room creation
- `teacher_id`: implicit from auth
- `pin`: never accepted from the client — always server-generated

**JoinRoomRequest**
- `pin`: required, exactly 6 digits
- `player_name`: required, 1–30 chars, trimmed, HTML stripped
- `avatar_slug`: required, must match the fixed preset enum

Reject anything not covered above with a 422, not a silent default.

---

## 4. Testing expectations

- Every Action/Service gets a unit test for its core branch logic (e.g. `VocabularyCacheService`: hit vs. miss vs. rejected-audio paths).
- Every mutating endpoint gets a feature test covering: happy path, unauthorized owner, invalid payload.
- The scoring/correctness logic (§7 of architecture.md) needs an explicit test proving a client-submitted "correct" flag is ignored — this is the one piece of logic that must never regress silently.
- The publish-gate (rules-and-validation §2) needs a test proving the 422 correctly names *which* question/word/asset is blocking — not just that it returns 422.
- No PR/phase is "done" without at least the above; report test coverage gaps rather than skipping silently.

### 4a. Test folder + automation setup

- Tests live at `backend/tests/Feature` (endpoint-level, one file per resource — `RoomTest.php`, `GameSessionTest.php`, `MapPublishTest.php`, etc.) and `backend/tests/Unit` (Action/Service-level branch logic). This is created once in Phase 0 (architecture.md §9), not improvised later.
- Run locally with `php artisan test` (or `./vendor/bin/pest` if using PestPHP) before calling any phase done — this is what "never self-certify" (§1 rule 4) actually means in practice: run the suite and report the result, don't eyeball the code.
- Wire a CI workflow (GitHub Actions) that runs the full suite on every push/PR — fails loud, doesn't rely on someone remembering to run it locally. Gate merges to `develop`/`main` on it passing.
- For manual/exploratory API testing during a phase (before the automated suite covers it), keep a Postman/Insomnia collection alongside the repo — not required to be automated, but useful for the "send a request to independently verify" pattern in §1 rule 4.

---

## 5. Naming & structure conventions

- Actions: verb + noun, e.g. `PublishQuestionAction`, `ResolveVocabularyAudioAction`.
- Jobs: past-tense-neutral, e.g. `GenerateVocabularyAudio` (not `GenerateVocabularyAudioJob` — the `Jobs/` namespace already says that).
- Events for logging: `tts_cache_hit`, `tts_generation`, `tts_failure`, `question_published`, `game_session_started`, `answer_submitted` — use these exact names so log queries stay consistent.
- Frontend API clients: one typed client per resource (`questionsApi.ts`, `gameSessionApi.ts`), no ad-hoc `fetch()` calls scattered through components.

---

## 6. When the agent is uncertain

If a request is ambiguous or would require inventing a decision not covered in architecture.md (e.g. "what happens if a teacher deletes a vocabulary word that's referenced by a past game session"), **stop and ask** rather than picking a default silently. Small, reversible defaults (variable naming, file layout within an already-defined folder) don't need a check-in — architectural or data-integrity decisions do.
