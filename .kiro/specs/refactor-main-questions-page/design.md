# Design Document

## Introduction

This document specifies the technical design for refactoring `main.tsx` and `QuestionsPage.tsx` through an 11-phase pure extraction process. The refactoring improves modularity and testability while maintaining zero behavior changes through rigorous testing at each phase.

## Architecture Overview

### System Components

The refactoring system consists of four primary components:

1. **Phase Orchestrator**: Manages sequential execution of the 11 refactoring phases
2. **Extraction Engine**: Performs pure code extraction operations
3. **Verification System**: Executes tests, type checking, and linting after each phase
4. **Rollback Manager**: Provides version control checkpoints and restoration capabilities

### Design Principles

1. **Pure Extraction**: Code is moved to new modules without logic modifications
2. **Incremental Validation**: Each phase is validated before proceeding
3. **Behavioral Equivalence**: Refactored code produces identical outputs for all inputs
4. **Test-Driven Refactoring**: Unit tests verify equivalence at each step
5. **Type Safety**: TypeScript compilation ensures correctness throughout

## Phase Architecture

### Phase Workflow Pattern

Each phase follows a consistent workflow:

```
Phase Start
  ↓
Create Git Checkpoint
  ↓
Analyze Source Files
  ↓
Extract Code to Module(s)
  ↓
Update Import Statements
  ↓
Generate Unit Tests
  ↓
Execute Test Suite
  ↓
Run Type Checking
  ↓
Run Linting
  ↓
[Pass] → Generate Phase Report → Phase Complete
  ↓
[Fail] → Halt & Report Errors
```

### Phase Dependencies

```
Phase 1: Extract Constants & Configuration
  ↓
Phase 2: Extract Type Definitions
  ↓
Phase 3: Extract Utility Functions
  ↓
Phase 4: Extract Data Transformation Functions
  ↓
Phase 5: Extract Validation Logic
  ↓
Phase 6: Extract Audio/Media Handlers
  ↓
Phase 7: Extract Form State Management
  ↓
Phase 8: Extract Modal Management
  ↓
Phase 9: Extract API Integration
  ↓
Phase 10: Extract UI Components
  ↓
Phase 11: Final Cleanup & Optimization
```

## Detailed Phase Specifications

### Phase 1: Extract Constants & Configuration

**Purpose**: Extract hardcoded constants and configuration data into dedicated modules.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `constants/teacherGuides.ts` - TEACHER_GUIDES mapping
- `constants/kingdomTheme.ts` - KINGDOM_COLORS styling configuration

**Code to Extract**:
```typescript
// constants/teacherGuides.ts
export const TEACHER_GUIDES: Record<number, { teacher: string; kingdomName: string }> = {
  1: { teacher: 'Teacher Faith', kingdomName: 'EPCES Adventure Entrance' },
  2: { teacher: 'Teacher Gevina', kingdomName: 'Bayan ng Prosperidad' },
  3: { teacher: 'Principal Flores', kingdomName: 'Provincial Capitol' },
};

// constants/kingdomTheme.ts
export const KINGDOM_COLORS: Record<number, { bg: string; text: string; border: string; activeTab: string }> = {
  // ... theme configuration
};
```

**Test Requirements**:
- Verify TEACHER_GUIDES structure matches original
- Verify KINGDOM_COLORS completeness for all kingdoms (1-3)
- Verify type annotations are correct

**Success Criteria**:
- Constants are importable from new modules
- QuestionsPage.tsx imports and uses constants correctly
- All TypeScript types resolve
- Zero linting errors

---

### Phase 2: Extract Type Definitions

**Purpose**: Extract shared TypeScript types and interfaces into a types module.

**Source Files**: `QuestionsPage.tsx`, existing type definitions

**Extracted Modules**:
- `types/question.ts` - Question-related types
- `types/ui.ts` - UI state types
- `types/media.ts` - Audio/video media types

**Code to Extract**:
```typescript
// types/question.ts
export type QuestionType = 'multiple_choice' | 'identification';

export interface Answer {
  text: string;
  is_correct: boolean;
}

export interface QuestionFormState {
  questionType: QuestionType;
  sentence: string;
  highlightedWord: string;
  contextClue: string;
  imageUrl: string;
  identificationAnswer: string;
  answers: Answer[];
}

// types/media.ts
export type VoiceMediaType = 'audio' | 'video' | 'none';

export interface MediaState {
  voiceMediaType: VoiceMediaType;
  voiceAudioBlob: Blob | null;
  voiceAudioFile: File | null;
  voiceAudioUrl: string;
  audioPreviewUrl: string | null;
  voiceVideoFile: File | null;
  voiceVideoUrl: string;
  videoPreviewUrl: string | null;
}

// types/ui.ts
export interface RecordingState {
  isRecording: boolean;
  recordingSeconds: number;
  isPlayingPreview: boolean;
  playingListAudioId: number | null;
}
```

**Test Requirements**:
- Verify type exports are accessible
- Verify TypeScript compilation succeeds
- Verify no type errors in QuestionsPage.tsx after import

**Success Criteria**:
- Types compile successfully
- QuestionsPage.tsx uses imported types
- No type errors
- Zero linting errors

---

### Phase 3: Extract Utility Functions

**Purpose**: Extract pure utility functions with no external dependencies.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `utils/timeFormat.ts` - Time formatting utilities
- `utils/textHighlight.tsx` - Text highlighting logic

**Code to Extract**:
```typescript
// utils/timeFormat.ts
export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// utils/textHighlight.tsx
export function renderHighlightedSentence(
  sentence: string,
  targetWord?: string,
  contextClue?: string
): JSX.Element | string {
  if (!sentence) return '';
  const escapedWord = targetWord ? targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const escapedClue = contextClue ? contextClue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

  const patterns: string[] = [];
  if (escapedWord) patterns.push(escapedWord);
  if (escapedClue) patterns.push(escapedClue);
  if (patterns.length === 0) return sentence;

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const parts = sentence.split(regex);
  return (
    <span>
      {parts.map((part, i) => {
        // ... highlighting logic
      })}
    </span>
  );
}
```

**Test Requirements**:
- Test `formatSeconds` with various inputs (0, 59, 60, 125, 3599)
- Test `renderHighlightedSentence` with target word only, context clue only, both, neither
- Test regex escaping for special characters
- Verify JSX output structure

**Success Criteria**:
- All utility functions pass tests
- Functions are importable
- QuestionsPage.tsx uses imported utilities
- Zero linting errors

---

### Phase 4: Extract Data Transformation Functions

**Purpose**: Extract functions that transform or prepare data.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `services/questionTransform.ts` - Question data transformations
- `services/answerTransform.ts` - Answer data transformations

**Code to Extract**:
```typescript
// services/questionTransform.ts
import { QuestionData, Answer, QuestionType } from '../types';

export function prepareQuestionPayload(
  mapId: number,
  orderIndex: number,
  formData: {
    questionType: QuestionType;
    sentence: string;
    highlightedWord: string;
    contextClue: string;
    imageUrl: string;
    imageFile: File | null;
    voiceAudioBlob: Blob | null;
    voiceAudioFile: File | null;
    voiceAudioUrl: string;
    voiceVideoFile: File | null;
    voiceVideoUrl: string;
    voiceMediaType: string;
    identificationAnswer: string;
    answers: Answer[];
  }
) {
  const targetAnswers =
    formData.questionType === 'identification'
      ? [{ text: formData.identificationAnswer.trim() || formData.highlightedWord.trim(), is_correct: true }]
      : formData.answers;

  return {
    map_id: mapId,
    order_index: orderIndex,
    question_type: formData.questionType,
    sentence: formData.sentence.trim(),
    highlighted_word: formData.highlightedWord.trim(),
    context_clue: mapId === 2 ? formData.contextClue.trim() || undefined : undefined,
    image_url: mapId === 2 ? undefined : (formData.imageUrl.trim() || undefined),
    image_file: mapId === 2 ? undefined : (formData.imageFile || undefined),
    voice_audio_file: formData.voiceAudioBlob || formData.voiceAudioFile || undefined,
    voice_audio_url: formData.voiceAudioUrl || undefined,
    voice_video_file: formData.voiceVideoFile || undefined,
    voice_video_url: formData.voiceVideoUrl || undefined,
    voice_media_type: formData.voiceMediaType || undefined,
    answers: targetAnswers,
  };
}

// services/answerTransform.ts
export function normalizeAnswers(answers: Answer[], minLength: number = 4): Answer[] {
  const normalized = [...answers];
  while (normalized.length < minLength) {
    normalized.push({ text: '', is_correct: false });
  }
  return normalized;
}

export function loadAnswersFromQuestion(question: QuestionData): Answer[] {
  if (question.answers && question.answers.length > 0) {
    return normalizeAnswers(question.answers.map(a => ({
      text: a.text,
      is_correct: a.is_correct,
    })));
  }
  return [
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ];
}
```

**Test Requirements**:
- Test `prepareQuestionPayload` for multiple choice questions
- Test `prepareQuestionPayload` for identification questions
- Test map-specific field handling (imageUrl for map !== 2, contextClue for map === 2)
- Test `normalizeAnswers` with 0, 1, 2, 3, 4, 5 answers
- Test `loadAnswersFromQuestion` with and without existing answers

**Success Criteria**:
- All transformation functions pass tests
- Functions handle edge cases correctly
- QuestionsPage.tsx uses imported transformations
- Zero linting errors

---

### Phase 5: Extract Validation Logic

**Purpose**: Extract form validation and business rule logic.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `validation/questionValidation.ts` - Question form validation

**Code to Extract**:
```typescript
// validation/questionValidation.ts
import { QuestionType, Answer } from '../types';

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateQuestionForm(
  sentence: string,
  highlightedWord: string,
  questionType: QuestionType,
  answers: Answer[],
  identificationAnswer: string,
  questionCount: number,
  isEditing: boolean
): ValidationResult {
  // Check question limit
  if (!isEditing && questionCount >= 5) {
    return {
      valid: false,
      error: 'Each kingdom stage is limited to a maximum of 5 questions.',
    };
  }

  // Check required fields
  if (!sentence.trim() || !highlightedWord.trim()) {
    return {
      valid: false,
      error: 'Please provide both the context sentence and target vocabulary word.',
    };
  }

  // Validate multiple choice
  if (questionType === 'multiple_choice') {
    if (answers.length < 2) {
      return {
        valid: false,
        error: 'Multiple choice questions require at least 2 choices.',
      };
    }
    if (answers.some((a) => !a.text.trim())) {
      return {
        valid: false,
        error: 'Please fill out all answer choices.',
      };
    }
    if (!answers.some((a) => a.is_correct)) {
      return {
        valid: false,
        error: 'Please select one correct answer choice.',
      };
    }
  }

  // Validate identification
  if (questionType === 'identification' && !identificationAnswer.trim() && !highlightedWord.trim()) {
    return {
      valid: false,
      error: 'Please enter the target correct word to identify.',
    };
  }

  return { valid: true, error: null };
}
```

**Test Requirements**:
- Test validation with valid inputs
- Test question limit validation (non-editing, count >= 5)
- Test missing sentence validation
- Test missing highlighted word validation
- Test multiple choice with < 2 answers
- Test multiple choice with empty answer text
- Test multiple choice with no correct answer
- Test identification with missing answer

**Success Criteria**:
- All validation tests pass
- Validation function handles all edge cases
- QuestionsPage.tsx uses imported validation
- Zero linting errors

---

### Phase 6: Extract Audio/Media Handlers

**Purpose**: Extract media recording, playback, and file handling logic.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `hooks/useAudioRecorder.ts` - Audio recording hook
- `hooks/useMediaPlayback.ts` - Media playback hook
- `services/mediaHandlers.ts` - File handling utilities

**Code to Extract**:
```typescript
// hooks/useAudioRecorder.ts
import { useState, useRef } from 'react';

export interface AudioRecorderResult {
  isRecording: boolean;
  recordingSeconds: number;
  audioBlob: Blob | null;
  audioPreviewUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearRecording: () => void;
  error: string | null;
}

export function useAudioRecorder(): AudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      setError(null);
      clearRecording();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setError('Microphone permission required to record.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const clearRecording = () => {
    stopRecording();
    setAudioBlob(null);
    if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
  };

  return {
    isRecording,
    recordingSeconds,
    audioBlob,
    audioPreviewUrl,
    startRecording,
    stopRecording,
    clearRecording,
    error,
  };
}

// hooks/useMediaPlayback.ts
import { useState, useRef } from 'react';

export interface MediaPlaybackResult {
  isPlaying: boolean;
  playingId: number | null;
  togglePlayback: (id: number, url: string) => void;
  stopPlayback: () => void;
}

export function useMediaPlayback(): MediaPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayback = (id: number, url: string) => {
    if (playingId === id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.onpause = () => setIsPlaying(false);
      audioRef.current.onplay = () => setIsPlaying(true);
    }
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    setPlayingId(id);
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPlayingId(null);
    }
  };

  return {
    isPlaying,
    playingId,
    togglePlayback,
    stopPlayback,
  };
}

// services/mediaHandlers.ts
export function handleImageFileChange(
  file: File | null,
  currentPreviewUrl: string | null
): {
  imageFile: File | null;
  imageUrl: string;
  imagePreviewUrl: string | null;
} {
  if (!file) {
    return {
      imageFile: null,
      imageUrl: '',
      imagePreviewUrl: null,
    };
  }
  
  // Clean up old preview URL
  if (currentPreviewUrl && currentPreviewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  
  return {
    imageFile: file,
    imageUrl: '',
    imagePreviewUrl: URL.createObjectURL(file),
  };
}

export function handleVideoFileChange(
  file: File | null,
  currentPreviewUrl: string | null
): {
  videoFile: File | null;
  videoUrl: string;
  videoPreviewUrl: string | null;
} {
  if (!file) {
    return {
      videoFile: null,
      videoUrl: '',
      videoPreviewUrl: null,
    };
  }
  
  // Clean up old preview URL
  if (currentPreviewUrl && currentPreviewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  
  return {
    videoFile: file,
    videoUrl: '',
    videoPreviewUrl: URL.createObjectURL(file),
  };
}

export function cleanupMediaUrl(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
```

**Test Requirements**:
- Test audio recorder starts and stops correctly
- Test audio blob is created after recording
- Test preview URL is generated
- Test recording timer increments
- Test cleanup releases resources
- Test media playback toggles correctly
- Test media playback stops when switching items
- Test image/video file handlers create preview URLs
- Test old preview URLs are cleaned up

**Success Criteria**:
- All media handler tests pass
- Hooks work correctly in isolation
- QuestionsPage.tsx uses imported hooks
- Zero memory leaks from blob URLs
- Zero linting errors

---

### Phase 7: Extract Form State Management

**Purpose**: Extract form state initialization, reset, and update logic.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `hooks/useQuestionForm.ts` - Question form state management hook

**Code to Extract**:
```typescript
// hooks/useQuestionForm.ts
import { useState } from 'react';
import { QuestionType, Answer, QuestionData } from '../types';
import { loadAnswersFromQuestion } from '../services/answerTransform';

export interface QuestionFormState {
  questionType: QuestionType;
  identificationAnswer: string;
  sentence: string;
  highlightedWord: string;
  contextClue: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  voiceAudioBlob: Blob | null;
  voiceAudioFile: File | null;
  voiceAudioUrl: string;
  audioPreviewUrl: string | null;
  voiceVideoFile: File | null;
  voiceVideoUrl: string;
  videoPreviewUrl: string | null;
  voiceMediaType: 'audio' | 'video' | 'none';
  answers: Answer[];
}

export interface QuestionFormActions {
  setQuestionType: (type: QuestionType) => void;
  setIdentificationAnswer: (answer: string) => void;
  setSentence: (sentence: string) => void;
  setHighlightedWord: (word: string) => void;
  setContextClue: (clue: string) => void;
  setImageUrl: (url: string) => void;
  setImageFile: (file: File | null) => void;
  setImagePreviewUrl: (url: string | null) => void;
  setVoiceAudioBlob: (blob: Blob | null) => void;
  setVoiceAudioFile: (file: File | null) => void;
  setVoiceAudioUrl: (url: string) => void;
  setAudioPreviewUrl: (url: string | null) => void;
  setVoiceVideoFile: (file: File | null) => void;
  setVoiceVideoUrl: (url: string) => void;
  setVideoPreviewUrl: (url: string | null) => void;
  setVoiceMediaType: (type: 'audio' | 'video' | 'none') => void;
  setAnswers: (answers: Answer[]) => void;
  resetForm: () => void;
  loadQuestionForEdit: (question: QuestionData) => void;
}

const initialFormState: QuestionFormState = {
  questionType: 'multiple_choice',
  identificationAnswer: '',
  sentence: '',
  highlightedWord: '',
  contextClue: '',
  imageUrl: '',
  imageFile: null,
  imagePreviewUrl: null,
  voiceAudioBlob: null,
  voiceAudioFile: null,
  voiceAudioUrl: '',
  audioPreviewUrl: null,
  voiceVideoFile: null,
  voiceVideoUrl: '',
  videoPreviewUrl: null,
  voiceMediaType: 'none',
  answers: [
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
};

export function useQuestionForm(): [QuestionFormState, QuestionFormActions] {
  const [state, setState] = useState<QuestionFormState>(initialFormState);

  const actions: QuestionFormActions = {
    setQuestionType: (type) => setState(s => ({ ...s, questionType: type })),
    setIdentificationAnswer: (answer) => setState(s => ({ ...s, identificationAnswer: answer })),
    setSentence: (sentence) => setState(s => ({ ...s, sentence })),
    setHighlightedWord: (word) => setState(s => ({ ...s, highlightedWord: word })),
    setContextClue: (clue) => setState(s => ({ ...s, contextClue: clue })),
    setImageUrl: (url) => setState(s => ({ ...s, imageUrl: url })),
    setImageFile: (file) => setState(s => ({ ...s, imageFile: file })),
    setImagePreviewUrl: (url) => setState(s => ({ ...s, imagePreviewUrl: url })),
    setVoiceAudioBlob: (blob) => setState(s => ({ ...s, voiceAudioBlob: blob })),
    setVoiceAudioFile: (file) => setState(s => ({ ...s, voiceAudioFile: file })),
    setVoiceAudioUrl: (url) => setState(s => ({ ...s, voiceAudioUrl: url })),
    setAudioPreviewUrl: (url) => setState(s => ({ ...s, audioPreviewUrl: url })),
    setVoiceVideoFile: (file) => setState(s => ({ ...s, voiceVideoFile: file })),
    setVoiceVideoUrl: (url) => setState(s => ({ ...s, voiceVideoUrl: url })),
    setVideoPreviewUrl: (url) => setState(s => ({ ...s, videoPreviewUrl: url })),
    setVoiceMediaType: (type) => setState(s => ({ ...s, voiceMediaType: type })),
    setAnswers: (answers) => setState(s => ({ ...s, answers })),
    
    resetForm: () => {
      // Cleanup blob URLs before reset
      if (state.imagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.imagePreviewUrl);
      }
      if (state.audioPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.audioPreviewUrl);
      }
      if (state.videoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.videoPreviewUrl);
      }
      setState(initialFormState);
    },
    
    loadQuestionForEdit: (question) => {
      const qType = question.question_type || 'multiple_choice';
      const correctAns = question.answers?.find((a) => a.is_correct)?.text || question.highlighted_word || '';
      const loadedAnswers = loadAnswersFromQuestion(question);
      
      setState({
        questionType: qType,
        identificationAnswer: correctAns,
        sentence: question.sentence,
        highlightedWord: question.highlighted_word || '',
        contextClue: question.context_clue || '',
        imageUrl: question.image_url || '',
        imageFile: null,
        imagePreviewUrl: question.image_url ? resolveMediaUrl(question.image_url) : null,
        voiceAudioBlob: null,
        voiceAudioFile: null,
        voiceAudioUrl: question.voice_audio_url || '',
        audioPreviewUrl: question.voice_audio_url ? resolveMediaUrl(question.voice_audio_url) : null,
        voiceVideoFile: null,
        voiceVideoUrl: question.voice_video_url || '',
        videoPreviewUrl: question.voice_video_url ? resolveMediaUrl(question.voice_video_url) : null,
        voiceMediaType: question.voice_media_type || 'none',
        answers: loadedAnswers,
      });
    },
  };

  return [state, actions];
}

// Note: resolveMediaUrl should be imported from api service
```

**Test Requirements**:
- Test form initializes with default values
- Test individual setters update state correctly
- Test resetForm clears all state
- Test resetForm cleans up blob URLs
- Test loadQuestionForEdit populates form correctly
- Test answer normalization when loading

**Success Criteria**:
- All form state tests pass
- Hook manages state correctly
- QuestionsPage.tsx uses imported hook
- No memory leaks from unreleased URLs
- Zero linting errors

---

### Phase 8: Extract Modal Management

**Purpose**: Extract modal state and lifecycle management.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `hooks/useQuestionModal.ts` - Modal state management hook

**Code to Extract**:
```typescript
// hooks/useQuestionModal.ts
import { useState } from 'react';
import { QuestionData } from '../types';

export interface QuestionModalState {
  showModal: boolean;
  editingQuestion: QuestionData | null;
}

export interface QuestionModalActions {
  openCreateModal: () => void;
  openEditModal: (question: QuestionData) => void;
  closeModal: () => void;
}

export function useQuestionModal(
  questionCount: number,
  onLimitReached: () => void
): [QuestionModalState, QuestionModalActions] {
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);

  const actions: QuestionModalActions = {
    openCreateModal: () => {
      if (questionCount >= 5) {
        onLimitReached();
        return;
      }
      setEditingQuestion(null);
      setShowModal(true);
    },
    
    openEditModal: (question: QuestionData) => {
      setEditingQuestion(question);
      setShowModal(true);
    },
    
    closeModal: () => {
      setShowModal(false);
      setEditingQuestion(null);
    },
  };

  return [
    { showModal, editingQuestion },
    actions,
  ];
}
```

**Test Requirements**:
- Test modal opens for create when question count < 5
- Test modal does not open when question count >= 5
- Test limit callback is called when at limit
- Test modal opens for edit with question data
- Test closeModal clears editing question
- Test closeModal closes modal

**Success Criteria**:
- All modal tests pass
- Hook manages modal state correctly
- QuestionsPage.tsx uses imported hook
- Zero linting errors

---

### Phase 9: Extract API Integration

**Purpose**: Extract API data fetching and mutation logic.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `hooks/useQuestions.ts` - Question data management hook
- `hooks/useMaps.ts` - Map data management hook

**Code to Extract**:
```typescript
// hooks/useQuestions.ts
import { useState, useEffect } from 'react';
import { api, QuestionData } from '../services/api';

export interface QuestionsState {
  questions: QuestionData[];
  loading: boolean;
  error: string | null;
}

export interface QuestionsActions {
  fetchQuestions: (mapId: number) => Promise<void>;
  silentRefreshQuestions: (mapId: number) => Promise<void>;
  deleteQuestion: (questionId: number) => Promise<void>;
  removeQuestionOptimistically: (questionId: number) => void;
}

export function useQuestions(selectedMapId: number | null): [QuestionsState, QuestionsActions] {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMapId) {
      fetchQuestions(selectedMapId);
    }
  }, [selectedMapId]);

  const fetchQuestions = async (mapId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getQuestions(mapId);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to load questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const silentRefreshQuestions = async (mapId: number) => {
    try {
      const res = await api.getQuestions(mapId);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to silently refresh questions:', err);
    }
  };

  const deleteQuestion = async (questionId: number) => {
    await api.deleteQuestion(questionId);
  };

  const removeQuestionOptimistically = (questionId: number) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  return [
    { questions, loading, error },
    { fetchQuestions, silentRefreshQuestions, deleteQuestion, removeQuestionOptimistically },
  ];
}

// hooks/useMaps.ts
import { useState, useEffect } from 'react';
import { api, MapData } from '../services/api';

export interface MapsState {
  maps: MapData[];
  selectedMapId: number | null;
  loading: boolean;
  error: string | null;
}

export interface MapsActions {
  fetchMaps: () => Promise<void>;
  silentRefreshMaps: () => Promise<void>;
  selectMap: (mapId: number) => void;
  updateMapQuestionCount: (mapId: number, count: number) => void;
}

export function useMaps(): [MapsState, MapsActions] {
  const [maps, setMaps] = useState<MapData[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMaps();
      const sorted = [...res.data].sort((a, b) => a.order_index - b.order_index);
      setMaps(sorted);
      if (sorted.length > 0 && !selectedMapId) {
        setSelectedMapId(sorted[0].id);
      }
    } catch (err) {
      console.error('Failed to load maps:', err);
      setError('Failed to load maps');
    } finally {
      setLoading(false);
    }
  };

  const silentRefreshMaps = async () => {
    try {
      const res = await api.getMaps();
      const sorted = [...res.data].sort((a, b) => a.order_index - b.order_index);
      setMaps(sorted);
    } catch (err) {
      console.error('Failed to silently refresh maps:', err);
    }
  };

  const selectMap = (mapId: number) => {
    setSelectedMapId(mapId);
  };

  const updateMapQuestionCount = (mapId: number, count: number) => {
    setMaps(prev =>
      prev.map(m => (m.id === mapId ? { ...m, question_count: count } : m))
    );
  };

  return [
    { maps, selectedMapId, loading, error },
    { fetchMaps, silentRefreshMaps, selectMap, updateMapQuestionCount },
  ];
}
```

**Test Requirements**:
- Test `useQuestions` fetches data on mount
- Test `useQuestions` refetches when mapId changes
- Test silent refresh doesn't show loading state
- Test optimistic removal updates state immediately
- Test `useMaps` fetches and sorts maps
- Test `useMaps` auto-selects first map
- Test map question count updates correctly

**Success Criteria**:
- All API hook tests pass
- Hooks handle loading and error states
- QuestionsPage.tsx uses imported hooks
- Zero linting errors

---

### Phase 10: Extract UI Components

**Purpose**: Extract reusable UI components from the main page.

**Source Files**: `QuestionsPage.tsx`

**Extracted Modules**:
- `components/QuestionCard.tsx` - Individual question card component
- `components/QuestionModal.tsx` - Question create/edit modal
- `components/MapTabs.tsx` - Kingdom/map selection tabs
- `components/AnswerChoiceEditor.tsx` - Answer choice editor component
- `components/MediaRecorder.tsx` - Audio/video recording UI

**Code to Extract**:
```typescript
// components/QuestionCard.tsx
import React from 'react';
import { QuestionData } from '../types';
import { renderHighlightedSentence } from '../utils/textHighlight';
import { resolveMediaUrl } from '../services/api';
import { Trash2, BookOpen, Type, CheckCircle2 } from 'lucide-react';

interface QuestionCardProps {
  question: QuestionData;
  index: number;
  onEdit: (question: QuestionData) => void;
  onDelete: (question: QuestionData) => void;
  onPlayAudio: (id: number, url: string) => void;
  isAudioPlaying: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  onEdit,
  onDelete,
  onPlayAudio,
  isAudioPlaying,
}) => {
  return (
    <div className="surface-card p-5 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all space-y-4 shadow-sm bg-white">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs flex items-center justify-center font-bold border border-slate-200 shadow-xs">
            #{index + 1}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {question.question_type === 'identification' ? (
              <>
                <Type className="w-3.5 h-3.5 text-purple-600" />
                <span>Format: Identification (Typing)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Format: Multiple Choice</span>
              </>
            )}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
              Target Word:
            </span>
            <span className="text-emerald-900 font-bold">{question.highlighted_word}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(question)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Edit question details"
          >
            <span>Edit</span>
          </button>

          <button
            onClick={() => onDelete(question)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
            title="Delete question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 text-slate-400" />
            <span>Challenge Sentence (Context):</span>
          </div>
          <div className="text-sm md:text-base font-medium text-slate-900 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            "{renderHighlightedSentence(question.sentence, question.highlighted_word, question.context_clue || undefined)}"
          </div>
          {question.context_clue && (
            <div className="text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">Context Clue:</span>
              <span className="text-slate-800 font-bold underline decoration-slate-400 decoration-2 underline-offset-2">
                {question.context_clue}
              </span>
            </div>
          )}
        </div>

        {/* Image Preview */}
        {question.image_url && (
          <div className="shrink-0 flex flex-col items-center gap-1">
            <a
              href={resolveMediaUrl(question.image_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={resolveMediaUrl(question.image_url)}
                alt="Context"
                className="w-20 h-20 object-cover rounded-lg border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              />
            </a>
          </div>
        )}
      </div>

      {/* Audio Playback */}
      {question.voice_audio_url && (
        <button
          onClick={() => onPlayAudio(question.id, question.voice_audio_url!)}
          className="text-xs text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer"
        >
          {isAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isAudioPlaying ? 'Pause' : 'Play'} Voiceover</span>
        </button>
      )}
    </div>
  );
};

// components/MapTabs.tsx
import React from 'react';
import { MapData } from '../types';
import { Crown } from 'lucide-react';
import { TEACHER_GUIDES, KINGDOM_COLORS } from '../constants';

interface MapTabsProps {
  maps: MapData[];
  selectedMapId: number | null;
  questionCounts: Record<number, number>;
  onSelectMap: (mapId: number) => void;
}

export const MapTabs: React.FC<MapTabsProps> = ({
  maps,
  selectedMapId,
  questionCounts,
  onSelectMap,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        Select Stage / Kingdom:
      </label>
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
        {maps.map((m) => {
          const order = m.order_index;
          const guide = TEACHER_GUIDES[order];
          const colors = KINGDOM_COLORS[order] ?? KINGDOM_COLORS[1];
          const isSelected = selectedMapId === m.id;
          const count = questionCounts[m.id] ?? m.question_count ?? 0;

          return (
            <button
              key={m.id}
              onClick={() => onSelectMap(m.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                isSelected
                  ? colors.activeTab
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{guide ? `${guide.teacher} • ${m.title}` : m.title}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-black/20 text-white font-bold' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// components/AnswerChoiceEditor.tsx
import React from 'react';
import { Answer } from '../types';
import { CheckCircle2, X } from 'lucide-react';

interface AnswerChoiceEditorProps {
  answers: Answer[];
  onAnswerTextChange: (index: number, text: string) => void;
  onCorrectAnswerSelect: (index: number) => void;
  onAddChoice: () => void;
  onRemoveChoice: (index: number) => void;
}

export const AnswerChoiceEditor: React.FC<AnswerChoiceEditorProps> = ({
  answers,
  onAnswerTextChange,
  onCorrectAnswerSelect,
  onAddChoice,
  onRemoveChoice,
}) => {
  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span>Answer Choices (2-4 options):</span>
      </label>

      {answers.map((ans, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCorrectAnswerSelect(idx)}
            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              ans.is_correct
                ? 'bg-emerald-500 border-emerald-500'
                : 'bg-white border-slate-300 hover:border-emerald-400'
            }`}
            title="Mark as correct answer"
          >
            {ans.is_correct && <CheckCircle2 className="w-4 h-4 text-white" />}
          </button>

          <input
            type="text"
            value={ans.text}
            onChange={(e) => onAnswerTextChange(idx, e.target.value)}
            placeholder={`Choice ${idx + 1}`}
            className="input flex-1"
            required
          />

          {answers.length > 2 && (
            <button
              type="button"
              onClick={() => onRemoveChoice(idx)}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Remove choice"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}

      {answers.length < 4 && (
        <button
          type="button"
          onClick={onAddChoice}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
        >
          + Add Choice
        </button>
      )}
    </div>
  );
};

// Additional components would follow similar patterns...
```

**Test Requirements**:
- Test QuestionCard renders correctly with all question types
- Test QuestionCard calls handlers on button clicks
- Test MapTabs renders all maps
- Test MapTabs highlights selected map
- Test MapTabs calls onSelectMap when clicked
- Test AnswerChoiceEditor renders all answers
- Test AnswerChoiceEditor updates answer text
- Test AnswerChoiceEditor selects correct answer
- Test AnswerChoiceEditor adds/removes choices

**Success Criteria**:
- All component tests pass
- Components render correctly in isolation
- QuestionsPage.tsx uses extracted components
- Zero linting errors

---

### Phase 11: Final Cleanup & Optimization

**Purpose**: Final cleanup, optimization, and documentation.

**Source Files**: `QuestionsPage.tsx`, `main.tsx`, all extracted modules

**Activities**:
1. Remove any remaining dead code from QuestionsPage.tsx
2. Verify all imports are used and correctly ordered
3. Add JSDoc comments to public APIs
4. Verify all TypeScript types are explicit
5. Run final linting and type checking
6. Generate comprehensive test coverage report
7. Create module dependency diagram
8. Document all extracted modules in README

**Extracted/Created Modules**:
- `docs/REFACTORING_SUMMARY.md` - Complete refactoring documentation
- Updated module exports with JSDoc comments

**Test Requirements**:
- Full integration test of QuestionsPage
- End-to-end test of question creation flow
- End-to-end test of question editing flow
- End-to-end test of question deletion flow
- Verify no regression in existing functionality

**Success Criteria**:
- Code coverage >= 80%
- All TypeScript strict mode checks pass
- Zero linting errors
- All imports optimized
- Documentation complete
- Module structure clean and organized

---

## Module Organization

### Final Directory Structure

```
frontend-portal/src/
├── main.tsx
├── pages/
│   └── QuestionsPage.tsx
├── components/
│   ├── QuestionCard.tsx
│   ├── QuestionModal.tsx
│   ├── MapTabs.tsx
│   ├── AnswerChoiceEditor.tsx
│   └── MediaRecorder.tsx
├── hooks/
│   ├── useAudioRecorder.ts
│   ├── useMediaPlayback.ts
│   ├── useQuestionForm.ts
│   ├── useQuestionModal.ts
│   ├── useQuestions.ts
│   └── useMaps.ts
├── services/
│   ├── api.ts (existing)
│   ├── questionTransform.ts
│   ├── answerTransform.ts
│   └── mediaHandlers.ts
├── utils/
│   ├── timeFormat.ts
│   └── textHighlight.tsx
├── validation/
│   └── questionValidation.ts
├── types/
│   ├── question.ts
│   ├── ui.ts
│   └── media.ts
└── constants/
    ├── teacherGuides.ts
    └── kingdomTheme.ts
```

## Testing Framework Integration

### Test Structure

Each phase will have dedicated test files following the pattern:

```
tests/
├── phase1/
│   ├── constants.test.ts
│   └── teacherGuides.test.ts
├── phase2/
│   ├── questionTypes.test.ts
│   └── mediaTypes.test.ts
├── phase3/
│   ├── timeFormat.test.ts
│   └── textHighlight.test.tsx
├── phase4/
│   ├── questionTransform.test.ts
│   └── answerTransform.test.ts
├── phase5/
│   └── questionValidation.test.ts
├── phase6/
│   ├── useAudioRecorder.test.ts
│   ├── useMediaPlayback.test.ts
│   └── mediaHandlers.test.ts
├── phase7/
│   └── useQuestionForm.test.ts
├── phase8/
│   └── useQuestionModal.test.ts
├── phase9/
│   ├── useQuestions.test.ts
│   └── useMaps.test.ts
├── phase10/
│   ├── QuestionCard.test.tsx
│   ├── MapTabs.test.tsx
│   └── AnswerChoiceEditor.test.tsx
└── phase11/
    └── integration.test.tsx
```

### Testing Tools

- **Test Runner**: Vitest (to be configured)
- **React Testing**: @testing-library/react
- **Mocking**: Vitest's built-in mocking capabilities
- **Coverage**: Vitest coverage reporting

### Test Setup

1. Install testing dependencies:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

2. Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

3. Create `tests/setup.ts`:
```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

4. Update `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## Verification System

### Phase Verification Checklist

After each phase, the verification system must confirm:

1. **Type Checking**: `npm run build` (runs tsc -b)
2. **Linting**: `npm run lint`
3. **Unit Tests**: `npm run test:run`
4. **Test Coverage**: Verify coverage meets minimum threshold
5. **Import Resolution**: Verify no missing imports
6. **Build Success**: Verify Vite build completes

### Automated Verification Script

```bash
#!/bin/bash
# verify-phase.sh

PHASE=$1

echo "🔍 Verifying Phase $PHASE..."

echo "📦 Running TypeScript compiler..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Type checking failed"
  exit 1
fi

echo "🔧 Running linter..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"
  exit 1
fi

echo "🧪 Running tests..."
npm run test:run -- tests/phase$PHASE/
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ Phase $PHASE verification complete!"
```

## Rollback Mechanisms

### Git Checkpoint Strategy

Before each phase:

```bash
# Create checkpoint branch
git checkout -b phase-${PHASE_NUMBER}-checkpoint

# Commit all current work
git add .
git commit -m "Phase ${PHASE_NUMBER} checkpoint: ${PHASE_DESCRIPTION}"

# Tag the checkpoint
git tag -a "phase-${PHASE_NUMBER}" -m "Checkpoint before Phase ${PHASE_NUMBER}"

# Return to main refactoring branch
git checkout refactor-questions-page
```

### Rollback Procedure

If a phase fails or needs to be reverted:

```bash
# Option 1: Soft rollback (keep changes as uncommitted)
git reset --soft phase-${PHASE_NUMBER}

# Option 2: Hard rollback (discard all changes)
git reset --hard phase-${PHASE_NUMBER}

# Option 3: Create new branch from checkpoint
git checkout -b refactor-retry phase-${PHASE_NUMBER}
```

### Stash Preservation

Before creating checkpoints, preserve any uncommitted work:

```bash
# Stash uncommitted changes
git stash push -m "WIP before Phase ${PHASE_NUMBER}"

# Create checkpoint...

# Restore stashed changes
git stash pop
```

## Error Handling Strategy

### Phase Failure Handling

When a phase fails verification:

1. **Capture Error Context**:
   - Log all error messages
   - Capture stack traces
   - Record which verification step failed

2. **Generate Failure Report**:
   ```markdown
   # Phase ${N} Failure Report
   
   ## Failed Verification Step
   [Type Checking | Linting | Tests | Build]
   
   ## Error Messages
   ```
   [Error output]
   ```
   
   ## Affected Files
   - file1.ts
   - file2.tsx
   
   ## Recommended Actions
   - Action 1
   - Action 2
   ```

3. **Halt Progression**:
   - Do not proceed to next phase
   - Preserve current state
   - Alert developer

4. **Provide Rollback Option**:
   - Offer automated rollback
   - Preserve error logs
   - Create issue ticket

## Performance Considerations

### Optimization Strategies

1. **Memoization Preservation**: Ensure all React.memo, useMemo, and useCallback optimizations are maintained
2. **Bundle Size**: Monitor bundle size after each phase to ensure no regressions
3. **Import Optimization**: Use tree-shaking friendly imports
4. **Code Splitting**: Prepare for future code splitting at component boundaries

### Performance Metrics

Track these metrics after each phase:

- Bundle size (main chunk)
- Number of modules
- Module dependency depth
- Cyclomatic complexity
- Test execution time

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Pure Extraction Preserves Logic

*For any* code block extracted to a new module, the logic SHALL remain unchanged and produce identical behavior.

**Validates: Requirements 2.1, 3.1**

### Property 2: Extracted Functions Have Identical Input-Output Behavior

*For any* function extracted to a module and *for any* valid input, the function SHALL produce the same output as the original inline code.

**Validates: Requirements 2.1, 3.2, 4.4**

### Property 3: State Management Behavior Matches

*For any* state management logic extracted and *for any* sequence of state operations, the resulting state SHALL be identical to the original implementation.

**Validates: Requirements 2.6, 3.3, 7.7**

### Property 4: DOM Rendering Matches

*For any* React component extracted and *for any* valid props, the rendered DOM structure SHALL be identical to the original implementation.

**Validates: Requirements 3.4**

### Property 5: Side Effects Match

*For any* function with side effects extracted and *for any* valid input, the sequence of side effects (API calls, state mutations, DOM updates) SHALL match the original implementation.

**Validates: Requirements 3.5, 3.6**

### Property 6: Control Flow and Error Handling Preserved

*For any* code with control flow (branches, loops) or error handling extracted and *for any* input, the execution paths and error behaviors SHALL match the original.

**Validates: Requirements 2.4, 2.5**

### Property 7: React Hooks and Optimizations Preserved

*For any* React hook (useState, useEffect, useMemo, useCallback) extracted, the hook behavior, dependency tracking, and performance characteristics SHALL match the original.

**Validates: Requirements 7.6, 14.3, 14.4**

### Property 8: Event Handlers Preserved

*For any* event handler extracted and *for any* event input, the handler SHALL execute with the same behavior as the original.

**Validates: Requirements 7.8**

### Property 9: TypeScript Types and Signatures Preserved

*For any* function extracted, the TypeScript signature (parameters, return type, generic constraints) SHALL match the original, and all type checking SHALL pass.

**Validates: Requirements 2.2, 2.3, 9.1**

### Property 10: Import Resolution Correct

*For any* module extraction, all imports in the source file and extracted module SHALL resolve correctly, and no unused imports SHALL remain.

**Validates: Requirements 6.4, 10.1, 10.2, 10.4, 10.5**

### Property 11: Application Initialization Works

*For any* extraction from main.tsx, the React application SHALL initialize and render correctly without errors.

**Validates: Requirements 6.2, 6.3**

### Property 12: Accessibility Features Preserved

*For any* component extracted, all ARIA attributes, keyboard navigation handlers, screen reader hints, focus management, and semantic HTML SHALL be preserved.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**

### Property 13: Caching and Memoization Preserved

*For any* code with caching or memoization extracted and *for any* sequence of calls, the cache hit/miss behavior and performance characteristics SHALL match the original.

**Validates: Requirements 14.3, 14.5**

### Property 14: Each Phase Produces Modules

*For any* completed phase, at least one new module file SHALL be created containing extracted code.

**Validates: Requirements 1.3**

## Acceptance Criteria Mapping

### Phase Completion Criteria

Each phase is considered complete when:

1. All planned modules have been extracted
2. All unit tests for the phase pass
3. TypeScript compilation succeeds with no errors
4. Linting produces no errors
5. Git checkpoint has been created
6. Phase report has been generated

### End-to-End Success Criteria

The entire refactoring is successful when:

1. All 11 phases complete successfully
2. QuestionsPage.tsx is modular and maintainable
3. main.tsx follows best practices
4. Overall test coverage >= 80%
5. No behavioral regressions detected
6. All accessibility features preserved
7. Performance characteristics maintained
8. Documentation complete

## Risk Mitigation

### Identified Risks

1. **State Management Complexity**: React hooks with complex dependencies may break if extracted incorrectly
   - **Mitigation**: Test state transitions thoroughly, use React Testing Library to verify hook behavior

2. **Circular Dependencies**: Extracted modules may inadvertently create import cycles
   - **Mitigation**: Use dependency analysis tools, maintain strict module hierarchy

3. **Performance Regression**: Additional module boundaries may introduce overhead
   - **Mitigation**: Profile before/after, maintain memoization patterns

4. **Type Safety Loss**: Generic types may lose specificity during extraction
   - **Mitigation**: Use explicit type annotations, verify with strict TypeScript mode

5. **Test Coverage Gaps**: Newly extracted modules may lack comprehensive tests
   - **Mitigation**: Enforce minimum coverage thresholds, review test completeness

## Conclusion

This design provides a comprehensive blueprint for refactoring `main.tsx` and `QuestionsPage.tsx` through 11 systematic phases. Each phase is independently testable, reversible, and produces measurable improvements in code quality. The verification system ensures behavioral equivalence is maintained throughout, and the rollback mechanisms provide safety nets against regressions.

The modular architecture resulting from this refactoring will improve maintainability, enable better testing, and facilitate future enhancements to the Questions Page functionality.
