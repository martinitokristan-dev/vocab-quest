# 📜 Vocab Quest Development Rules & Sprite System Specifications

## 🌟 1. Kingdom Teachers & Character Design Specifications

### 🏛️ Kingdom 1 (EPCES Kingdom / Easy Mode - `mapId === 1`)
- **Character Name**: **Teacher Faith**
- **Visual Appearance**: Filipina teacher, Royal Blue DepEd uniform (checkered blazer, pencil skirt, blue-striped ascot bow), long wavy black hair, **clear round eyeglasses**, black pumps, wristwatch.
- **Base Idle Sprite**: `F1.png`
- **Intro Welcoming Hand Sprite**: `F2.png` (Hand raised to the left, held for ~1.0s)
- **Speaking Stance (Closed Mouth)**: `F3.png`
- **Talking Loop Vowel Sprites**:
  - `F4.png`: "AH" tall open mouth
  - `F5.png`: "EH" wide open mouth
  - `F6.png`: "OH" round open mouth
  - `F3.png`: Closed mouth breath rest
- **Feedback Reactions (Non-repeating Shuffle)**:
  - **Correct / Praise**: `teacher_blue_correct_1.png`, `teacher_blue_correct_2.png`, `teacher_blue_correct_3.png`
  - **Incorrect / Sympathetic**: `teacher_blue_incorrect_1.png`, `teacher_blue_incorrect_2.png`, `teacher_blue_incorrect_3.png`

---

### 🏛️ Kingdom 2 (Bayan ng Prosperidad / Medium Mode - `mapId === 2`)
- **Character Name**: **Teacher Gevina**
- **Visual Appearance**: Filipina teacher, Royal Blue DepEd uniform (checkered blazer, pencil skirt, blue-striped ascot bow), long wavy black hair, **NO eyeglasses**, cute curvy chibi proportions, black pumps, wristwatch.
- **Base Idle Sprite**: `G1.png`
- **Intro Welcoming Hand Sprite**: `G2.png` (Hand raised to the left, held for ~1.0s, feet aligned at X≈195px)
- **Speaking Stance (Closed Mouth)**: `G3.png` (Hands clasped horizontally at waist)
- **Talking Loop Vowel Sprites**:
  - `G4.png`: "AH" tall open mouth (Hands clasped horizontally at waist)
  - `G5.png`: "EH" wide open mouth (Hands clasped horizontally at waist)
  - `G6.png`: "OH" round open mouth (Hands clasped horizontally at waist)
  - `G3.png`: Closed mouth breath rest (Hands clasped horizontally at waist)
- **Outro Settle Sprites**: `G7.png` (Gentle eyes-closed smile), `G8.png` (Base arms-down smile), `G9.png`
- **Feedback Reactions (Non-repeating Shuffle)**:
  - **Correct / Praise**: `teacher_gevina_correct_1.png`, `teacher_gevina_correct_2.png`, `teacher_gevina_correct_3.png`
  - **Incorrect / Sympathetic**: `teacher_gevina_incorrect_1.png`, `teacher_gevina_incorrect_2.png`, `teacher_gevina_incorrect_3.png`

---

### 🏛️ Kingdom 3 (Provincial Capitol / Hard Mode - `mapId === 3`)
- **Character Name**: **Principal Flores**
- **Visual Appearance**: Sunny Yellow DepEd uniform, brown batik ascot, black skirt, pumps.
- **Base Idle & Reading Sprite**: `teacher_yellow_pose1.png`
- **Feedback Reactions**:
  - **Correct / Praise**: `teacher_yellow_pose2.png` (Thumbs Up), `teacher_yellow_happy.png` (Celebration)
  - **Incorrect / Sympathetic**: `teacher_yellow_sad.png` (Encouraging Chin-Tap)

---

## 📐 2. Sprite Normalization & Canvas Alignment Standard

All teacher and character sprites must adhere to the standardized canvas to prevent any jumping, shifting, or flickering:
- **Canvas Resolution**: `400 × 800 px` (Transparent RGBA PNG).
- **Floor Baseline (`Y = 760 px`)**: The bottom of the teacher's heels rests exactly at `Y = 760`.
- **Head Top (`Y = 80 px`)**: The top of the hair sits at `Y = 80`.
- **Standing Axis / Feet Center (`X ≈ 195 - 200 px`)**:
  - Alignment MUST be computed based on the **standing lower-body/feet center of mass**, NOT bounding-box center.
  - When an arm or hand extends out (e.g., `G2.png`, `F2.png`), the feet and torso MUST stay locked at `X ≈ 195 - 200 px`.
- **Automated Normalizer**: Always run `python align_teacher_sprites.py` after adding or updating any sprite in `frontend-game/public/assets/guide/`.

---

## 🎬 3. Animation & Lip-Sync Runtime Rules (`main.ts`)

1. **Initial Question Arrival**:
   - Plays welcoming hand-raise gesture (`G2` / `F2`) held for **~1.0s** (3 ticks) $\rightarrow$ settles into speaking stance (`G3` / `F3`) $\rightarrow$ enters vowel loop.
2. **Stationary Body Vowel Talking Loop (340ms Cadence)**:
   - Body & hands remain 100% stationary.
   - Smooth 4-frame vowel cycle:
     $$\text{AH (G4/F4)} \longrightarrow \text{EH (G5/F5)} \longrightarrow \text{OH (G6/F6)} \longrightarrow \text{Closed Rest (G3/F3)}$$
3. **Smooth Outro Settle**:
   - When question audio ends: Immediately closes mouth (`G3` / `F3`), holds for **400ms**, and gently relaxes to base idle (`G1` / `F1`).
4. **Replay Audio Behavior**:
   - When tapping **REPLAY**: Teacher starts **DIRECTLY on the stationary mouth-talking loop** (`G4`/`F4` $\rightarrow$ `G5`/`F5` $\rightarrow$ `G6`/`F6` $\rightarrow$ `G3`/`F3`).
   - Does **NOT** re-trigger the greeting hand-raise on replay.
   - Smoothly closes mouth and relaxes when replay audio ends.

---

## ⚡ 4. Answer Evaluation & Feedback Pose Rules

1. **Immediate 0ms Interruption**:
   - Tapping ANY answer card (`pointerdown`/`click`) immediately calls `soundManager.stopSpeech()` and `clearTeacherAnimationTimers()`.
   - Any ongoing narration or mouth animation is cancelled on the spot with zero lag.
2. **Locked Reaction Poses**:
   - **Wrong Answer**: Instantly displays a random, non-repeating sympathetic pose (`teacher_*_incorrect_1..3`).
   - **Correct Answer**: Instantly displays a random, non-repeating celebratory victory pose (`teacher_*_correct_1..3`).
   - Reaction poses stay **locked on stage** while waiting for the next answer or advancing.
3. **Separation of Feedback Audio from Question Lip-Sync**:
   - Teacher praise and cheer audio MUST be played using `soundManager.playFeedbackAudio(url)`.
   - `playFeedbackAudio` plays the teacher's authentic voice WITHOUT triggering the question mouth-sync loop, keeping the celebratory or sympathetic reaction pose intact!

---

## 🛠️ 5. Build & Validation Checklist

Before every deployment or commit:
1. Run `python align_teacher_sprites.py` to ensure all sprites are normalized.
2. Run `npm run build` in `frontend-game/` — must compile with **0 errors**.
3. Verify dev servers (`localhost:5174` game, `localhost:5173` portal, `localhost:8000` backend).
