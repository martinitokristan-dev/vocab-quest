# Vocab Quest - Project & Sprite Development Standards

This repository adheres to strict sprite normalization, animation behavior, and gameplay state rules.
Always review and follow [.agents/rules/SPRITES_AND_GAMEPLAY_RULES.md](.agents/rules/SPRITES_AND_GAMEPLAY_RULES.md).

## Quick Reference Summary:
- **Sprite Directory**: `frontend-game/public/assets/guide/`
- **Canvas Standards**: `400 × 800 px`, `Y=760` floor baseline, `Y=80` head top, `X≈195` feet center of mass.
- **Sprite Normalizer**: `python align_teacher_sprites.py`
- **Kingdom Teachers**:
  - Kingdom 1: **Teacher Faith** (`F1`–`F9`, eyeglasses, blue DepEd uniform).
  - Kingdom 2: **Teacher Gevina** (`G1`–`G9`, no eyeglasses, blue DepEd uniform).
  - Kingdom 3: **Principal Flores** (`teacher_yellow_*`, yellow DepEd uniform).
- **Talking Animation**: Welcoming intro hand-gesture held for ~1s on initial question arrival $\rightarrow$ stationary body vowel loop (`AH` $\rightarrow$ `EH` $\rightarrow$ `OH` $\rightarrow$ `Closed Rest`) at 340ms cadence $\rightarrow$ 2-step settle outro (`F3`/`G3` $\rightarrow$ `F1`/`G1`).
- **Answer Interruption**: Instant 0ms speech stop & mouth clear on answer tap.
- **Reaction Poses**: Locked sympathetic pose on wrong answer; locked celebrating pose on correct answer.
- **Feedback Audio**: Always use `soundManager.playFeedbackAudio()` for cheer/praise to avoid overriding reaction poses.
