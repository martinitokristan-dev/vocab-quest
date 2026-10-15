# Design Review (pass 4, finalization): Vocab Quest Voxel World Map

Verdict: **APPROVED** (0 HIGH, 0 MEDIUM new; no genuinely new HIGH found).

Scope: this was a finalization pass. I checked that each pass-3 finding is addressed in DESIGN.md revision pass 4, and looked for new HIGH defects only.

## Pass-3 findings: confirmation

1. Sound hooks (MEDIUM): addressed. `MapSoundHooks` now has hover, click, wrong, step, padlockUnlock, whoosh, success and gateOpen. Section 4 has a mapping table to existing `soundManager` calls, with firing points (whoosh twice in entry animation, success on walk arrival, gateOpen mapped to `playPadlockUnlock`).
2. Milestone-0 perf gate vs AC20 (MEDIUM): addressed. The gate is now <= 4.5 ms unthrottled, >= 55 fps on medium and >= 30 fps on low at 4x throttle, with the arithmetic shown in the text.
3. Kingdom and node gating rules (MEDIUM): addressed. A rule table defines `unlocked(k)`, `entered(k)`, entrance hit, node hit, mist/padlock and the `awaiting_kingdom_click` centring. `isKingdomProgressUnlocked` was replaced.
4. `flowMode` default (MEDIUM): addressed. Section 19.1 now resolves the mode eagerly on first `getFlowMode()` and has no `'png'` default.
5. L9-L10 under 90 units (MEDIUM): addressed. L9 is nudged to (1266,364), giving L9-L10 = 93.0, with A and B re-pinned and the clearances recomputed in 3.4.
6. Perspective endpoint (NIT), 7. demo alias (NIT, now relative imports only), 8. README limitations (NIT): addressed.

## New findings

None at HIGH severity. I did not find a concrete defect that would break implementation. The remaining risks (thin K1 hop margin of about 194 against 200, landmark rectangles measured by eye, vitest/Vite 8 compatibility) already have documented levers or arbiter tests in the design (the `LEVEL45_U` lever, the generator test, and D10).

## Verified assumptions

- Prior review's verified items (MapRenderer signatures, soundManager exports, tsconfig/package.json state, reference geometry) are unchanged.
- The pass-4 edits are present in DESIGN.md: hooks table, gating table, 4.5 ms gate, relative-import demo, eager flowMode.

## Unverified assumptions

- Performance figures remain estimates, gated by milestone 0.
- I read only the first ~237 lines of DESIGN.md in full and checked the later pass-4 edits by search. I did not re-read the whole document.
