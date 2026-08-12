# Business Rules & Validation Reference — Vocabulary Learning Game

Companion to architecture.md and skills.md. This file is the source of truth for edge cases and data-integrity rules — link to it from PRs/prompts instead of re-deriving these each time.

---

## 1. Vocabulary & audio lifecycle

| Rule | Detail |
|---|---|
| One canonical audio per word | `vocabularies.word` is unique (case/whitespace-normalized on save). Two questions using "exhausted" always resolve to the same `vocabulary_audios` row. |
| New audio starts `pending_review` | Never served to students in this state. |
| Only `approved` audio is servable | Student-facing endpoints filter on `status = approved`. If a word's audio is still pending, the question **cannot be published** (see §2). |
| Rejected audio | Sets `status = rejected`, is excluded from cache lookups going forward — next question using that word triggers a fresh TTS generation, not a reuse of the rejected file. |
| Deleting a vocabulary word in use | Blocked if referenced by any question on a **published** map. Allowed (with a warning) if only referenced by draft/unpublished questions. |

---

## 2. Publishing rules

A **map** can only be set `published = true` if:
- It has at least 1 question (agree a minimum, e.g. 3).
- Every question on it has an image (`cloudinary_public_id` set).
- Every question's vocabulary word has `approved` audio.
- Every question has ≥2 answers with exactly one marked correct.
- The map has a `background_url` set.
- The map has an associated `map_characters` row with all three expression images set (`idle_url`, `correct_url`, `wrong_url`).

If any check fails, return a 422 listing *which* questions/words/assets are blocking publish — don't just say "cannot publish." (e.g. "Map 2 is missing a wrong-answer character image.")

Un-publishing a map with active `game_sessions` in progress: sessions already started may finish (grandfathered), but no new sessions can start against it.

---

## 3. Room + PIN rules

| Rule | Detail |
|---|---|
| Room name | Required, 1–100 chars, teacher-supplied, purely for the teacher's own room list — plays no role in join/auth. Falls back to `"Room #{pin}"` if left blank rather than blocking creation. |
| PIN format | 6 digits, numeric only, server-generated — never client-supplied or teacher-typed. |
| PIN uniqueness | Unique only among rooms with `status IN (waiting, in_progress)`. A closed room's PIN can be reused later. |
| Room status | `waiting` (accepting joins) → `in_progress` (teacher started it, no new joins) → `closed` (ended, read-only history). |
| Joining after start | Rejected by default once `status = in_progress` — return a clear "game already started" error, don't silently drop the student into a random question. |
| Room idle timeout | A `waiting` room with no teacher activity for a set period (e.g. 30 min) auto-closes — prevents orphaned PINs staying "active" indefinitely. |

## 4. Game session rules

| Rule | Detail |
|---|---|
| Session creation | Requires a valid PIN resolving to a `waiting` room, then a player name (non-empty, max 30 chars, trimmed, HTML stripped) and an `avatar_slug`. No profanity filter for v1 but leave a hook for one. |
| Avatar selection | `avatar_slug` required at join, must match one of a small fixed preset list (server-validated enum, e.g. `in:fox,owl,turtle,frog`) — reject unknown values with 422. Not a foreign key; the preset set is static config, not a DB-managed resource. |
| Duplicate player names | Allowed within the same room; disambiguate on the teacher dashboard by session id, not by rejecting the join. |
| Session token | Opaque, signed, short TTL (e.g. 2 hours) — long enough for one play session, short enough that a leaked token isn't a standing liability. Issued only after a successful PIN + name join, never derived from the PIN alone. |
| One session at a time per token | A submit-answer call against a `completed_at`-set session is rejected. |
| Question order | Server-determined per session, following the fixed map/question order (Map 1 → 3 Qs → Map 2 → 5 Qs → Map 3 → 5 Qs) — never trust a client-submitted "next question" pointer. |
| Map advancement | Server advances `game_sessions.current_map_id` only after all questions in the current map are answered — client cannot request the next map early. |
| Answer resubmission | A question already answered within a session cannot be re-submitted for a different result — first answer stands. Reject duplicate submits with a 409, not a silent overwrite. |

## 4a. Scoreboard & live-tracking rules

| Rule | Detail |
|---|---|
| Per-question result storage | Every submit writes one `student_answers` row with `map_id`, `question_index_in_map`, `is_correct` — this single write is the source for both the student scoreboard and the teacher dashboard. No separate "score summary" table to keep in sync. |
| Unanswered questions | Rendered as a neutral placeholder on the scoreboard (not blank, not guessed-at), so the student always sees the full question list for the current map ahead of time. |
| Teacher dashboard refresh | Broadcast on room-scoped private channel `room.{room_id}` on every `student_answers` write and on `current_map_id`/`current_question_index` change. Poll fallback at 3–5s if websocket delivery fails. |
| Teacher visibility scope | A teacher only sees live tracking for rooms they own — same ownership check as §5 of architecture.md, enforced via Policy. |
| Room close behavior | On `status = closed`, live tracking freezes at last-known state (becomes historical, not deleted) — teacher can still review who got what wrong after the session ends. |

## 4b. Historical scores view

| Rule | Detail |
|---|---|
| Access route | Same endpoint serves both live and closed rooms (`GET /rooms/{id}/results`) — behavior branches on `rooms.status`, not on separate routes. |
| Closed-room data | Read-only, sourced from the same `student_answers`/`game_sessions` rows already frozen per §4a's "Room close behavior" — no separate historical snapshot table. |
| Ownership | Same `teacher_id` scoping as §6 — a teacher cannot view another teacher's room results, closed or not. |
| Deleted room edge case | If data-retention (§9) later allows deleting old rooms, a delete on a room with any `student_answers` should be a soft-delete/archive, not a hard delete, so past scores stay reviewable until a retention policy explicitly says otherwise. |

---

## 5. Scoring

- Score is **derived**, not stored as a mutable running total: `SELECT COUNT(*) FROM student_answers WHERE game_session_id = ? AND is_correct = true`.
- `is_correct` is written once, server-side, at submit time — never recomputed from client input later.
- `game_sessions.completed_at` is set when all questions across **all three maps** have a corresponding `student_answers` row for that session — server-checked, not client-declared.

---

## 6. Teacher authorization

- A teacher can only read/write maps, questions, and rooms they own (`teacher_id` scoping on every query — enforced via Policy, not just a `WHERE` clause someone might forget).
- No cross-teacher visibility into another teacher's rooms, maps, or student results in v1. If multi-teacher schools become a requirement later, this needs a proper role/permission layer — don't half-build it now.

---

## 7. Validation quick-reference (field-level)

| Field | Rule |
|---|---|
| `pin` (join request) | exactly 6 digits, numeric, server-generated on the room side, client only ever *submits* it to join |
| `player_name` | required, 1–30 chars, trimmed, no HTML |
| `avatar_slug` (join request) | required, must be one of a fixed server-side preset enum, no free text |
| `room.name` | required, 1–100 chars, defaults to `"Room #{pin}"` if omitted |
| `map.title` | required, 1–100 chars |
| `map.background_image` | jpeg/png/webp only, max 5MB, required before a map can be published |
| `map_character.{idle,correct,wrong}_image` | jpeg/png/webp only, max 5MB each, all three required before a map can be published |
| `map.order_index` | required, 1–3, fixed per the design (1=EPCES/3Q, 2=Prince Hypermart/5Q, 3=Naliyagan/5Q) |
| `question.sentence` | required, 1–300 chars, must contain `highlighted_word` verbatim |
| `question.highlighted_word` | required, 1–50 chars, letters/hyphens only |
| `answers[]` | 2–4 items, each 1–100 chars, exactly one `is_correct = true` |
| `image` upload | jpeg/png/webp only, max 5MB (confirm against your Cloudinary plan limits); required for Map 1 questions, not required for Map 2/3 per the difficulty design |
| `vocabulary_audio` upload (manual override) | mp3/wav only, max 2MB, max 15s duration |

---

## 8. Error-handling conventions

- Validation failures: 422 with field-keyed error messages (Laravel default shape) — no custom envelope needed.
- Authorization failures: 403, no detail on *why* beyond "not authorized" (don't leak whether a resource exists to a non-owner).
- Invalid/expired PIN: 404 with a clear message ("PIN not found") — don't distinguish "never existed" from "already closed," same reasoning as not leaking resource existence.
- Not found / not yet published (student trying to access a draft map): 404, treated identically to "doesn't exist" — don't distinguish for students.
- TTS/Cloudinary provider failures: never surface the raw provider error to the teacher UI. Log the raw error server-side (`tts_failure` event per skills.md §5), return a generic "audio generation failed, please retry" to the client.

---

## 9. Data retention (decide before you need it)

Not required for v1 launch, but flag before this becomes a real gap:
- How long do closed `rooms` + their `game_sessions` + `student_answers` live? (No student PII is stored beyond a display name, so this is lower-stakes than a normal student-data system, but still worth a stated policy.)
- What happens to a room's session history when a teacher deletes their account — cascade delete, or soft-archive?
