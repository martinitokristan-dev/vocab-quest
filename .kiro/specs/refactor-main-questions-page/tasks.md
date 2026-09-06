# Implementation Plan: Refactor Main Questions Page

## Overview

This implementation plan breaks down the 11-phase pure extraction refactoring of `main.tsx` and `QuestionsPage.tsx` into actionable coding tasks. Each phase extracts specific code into new modules while maintaining zero behavior changes. Unit tests verify behavioral equivalence at every step.

The refactoring will:
- Improve code maintainability and modularity
- Enable better testing and reusability
- Preserve all existing functionality, accessibility, and performance characteristics
- Follow TypeScript and React best practices

## Tasks

- [-] 1. Set up testing infrastructure
  - Install Vitest and React Testing Library dependencies
  - Create `vitest.config.ts` configuration file
  - Create `tests/setup.ts` with testing environment setup
  - Add test scripts to `package.json`
  - Create test helpers and utilities directory
  - _Requirements: 4.1, 5.1, 8.1_

- [ ] 2. Phase 1: Extract Constants & Configuration
  - [~] 2.1 Create constants directory and extract TEACHER_GUIDES
    - Create `frontend-portal/src/constants/teacherGuides.ts`
    - Extract TEACHER_GUIDES mapping from QuestionsPage.tsx
    - Add TypeScript type annotations for the mapping
    - _Requirements: 2.1, 2.2, 6.1, 9.1_
  
  - [~] 2.2 Extract KINGDOM_COLORS theme configuration
    - Create `frontend-portal/src/constants/kingdomTheme.ts`
    - Extract KINGDOM_COLORS styling configuration from QuestionsPage.tsx
    - Ensure all kingdom IDs (1-3) are covered
    - _Requirements: 2.1, 2.2, 9.1_
  
  - [~] 2.3 Update QuestionsPage.tsx to import constants
    - Add import statements for TEACHER_GUIDES and KINGDOM_COLORS
    - Remove the original constant definitions
    - Verify no other files depend on these constants
    - _Requirements: 6.5, 10.1, 10.4_
  
  - [ ]* 2.4 Write unit tests for constants
    - Test TEACHER_GUIDES structure and completeness
    - Test KINGDOM_COLORS has all required properties for each kingdom
    - Verify type safety of exported constants
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [~] 2.5 Checkpoint: Verify Phase 1 completion
    - Run TypeScript compiler and verify no errors
    - Run linter and fix any issues
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 11.1, 11.2, 11.5_

- [ ] 3. Phase 2: Extract Type Definitions
  - [~] 3.1 Create types directory and extract question types
    - Create `frontend-portal/src/types/question.ts`
    - Extract QuestionType, Answer, QuestionData, QuestionFormState interfaces
    - Ensure all type exports are properly annotated
    - _Requirements: 2.2, 2.3, 9.1, 9.2_
  
  - [~] 3.2 Extract media-related types
    - Create `frontend-portal/src/types/media.ts`
    - Extract VoiceMediaType, MediaState interfaces
    - Document each type with JSDoc comments
    - _Requirements: 2.2, 2.3, 9.1, 9.5_
  
  - [~] 3.3 Extract UI state types
    - Create `frontend-portal/src/types/ui.ts`
    - Extract RecordingState and other UI-related interfaces
    - _Requirements: 2.2, 2.3, 9.1_
  
  - [~] 3.4 Update QuestionsPage.tsx to import type definitions
    - Replace inline types with imports from new type modules
    - Remove original type definitions
    - Verify type resolution works correctly
    - _Requirements: 10.1, 10.4, 10.5_
  
  - [ ]* 3.5 Write TypeScript compilation tests
    - Verify all types compile without errors
    - Test type exports are accessible
    - Verify QuestionsPage.tsx has no type errors after refactoring
    - _Requirements: 4.2, 11.1, 11.5_
  
  - [~] 3.6 Checkpoint: Verify Phase 2 completion
    - Run TypeScript strict mode type checking
    - Run linter and fix any issues
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 11.1, 11.2, 11.5_

- [ ] 4. Phase 3: Extract Utility Functions
  - [~] 4.1 Create utils directory and extract time formatting
    - Create `frontend-portal/src/utils/timeFormat.ts`
    - Extract formatSeconds function with full implementation
    - Add JSDoc documentation explaining the function
    - _Requirements: 2.1, 7.2, 9.5_
  
  - [~] 4.2 Extract text highlighting utility
    - Create `frontend-portal/src/utils/textHighlight.tsx`
    - Extract renderHighlightedSentence function
    - Preserve JSX rendering logic and regex escaping
    - _Requirements: 2.1, 2.4, 7.2_
  
  - [~] 4.3 Update QuestionsPage.tsx to use utility imports
    - Import formatSeconds and renderHighlightedSentence
    - Replace inline implementations with function calls
    - Remove original utility code
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 4.4 Write unit tests for time formatting
    - Test formatSeconds with 0, 59, 60, 125, 3599 seconds
    - Verify padding and formatting correctness
    - Test edge cases like negative numbers
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 4.5 Write unit tests for text highlighting
    - Test with target word only, context clue only, both, and neither
    - Test regex special character escaping
    - Verify JSX output structure is correct
    - Test case-insensitive matching
    - _Requirements: 4.4, 4.5_
  
  - [~] 4.6 Checkpoint: Verify Phase 3 completion
    - Run all utility tests and verify 100% pass rate
    - Run TypeScript compiler and linter
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 5. Phase 4: Extract Data Transformation Functions
  - [~] 5.1 Create services directory and extract question transform
    - Create `frontend-portal/src/services/questionTransform.ts`
    - Extract prepareQuestionPayload function with full logic
    - Handle map-specific field logic (imageUrl, contextClue)
    - _Requirements: 2.1, 2.4, 7.4, 7.5_
  
  - [~] 5.2 Extract answer transformation functions
    - Create `frontend-portal/src/services/answerTransform.ts`
    - Extract normalizeAnswers function
    - Extract loadAnswersFromQuestion function
    - _Requirements: 2.1, 7.5_
  
  - [~] 5.3 Update QuestionsPage.tsx to use transformation imports
    - Import prepareQuestionPayload, normalizeAnswers, loadAnswersFromQuestion
    - Replace inline transformation logic with function calls
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 5.4 Write tests for question payload preparation
    - Test multiple choice question payload generation
    - Test identification question payload generation
    - Test map-specific field handling (map 2 vs others)
    - Verify all fields are correctly mapped
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 5.5 Write tests for answer transformations
    - Test normalizeAnswers with 0, 1, 2, 3, 4, 5 answers
    - Test loadAnswersFromQuestion with and without existing answers
    - Verify correct answer marking is preserved
    - _Requirements: 4.4, 4.5_
  
  - [~] 5.6 Checkpoint: Verify Phase 4 completion
    - Run all transformation tests
    - Verify TypeScript compilation and linting
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 6. Phase 5: Extract Validation Logic
  - [~] 6.1 Create validation directory and extract question validation
    - Create `frontend-portal/src/validation/questionValidation.ts`
    - Extract validateQuestionForm function with all validation rules
    - Define ValidationResult interface
    - Preserve all error messages and validation logic
    - _Requirements: 2.1, 2.4, 2.5, 7.4_
  
  - [~] 6.2 Update QuestionsPage.tsx to use validation imports
    - Import validateQuestionForm and ValidationResult
    - Replace inline validation with function call
    - Handle validation results correctly
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 6.3 Write validation tests for valid inputs
    - Test validation passes with complete valid data
    - Verify ValidationResult structure
    - _Requirements: 4.4_
  
  - [ ]* 6.4 Write validation tests for error cases
    - Test question limit validation (count >= 5)
    - Test missing sentence validation
    - Test missing highlighted word validation
    - Test multiple choice with < 2 answers
    - Test multiple choice with empty answer text
    - Test multiple choice with no correct answer marked
    - Test identification with missing answer
    - _Requirements: 4.5, 4.6_
  
  - [~] 6.5 Checkpoint: Verify Phase 5 completion
    - Run all validation tests
    - Verify error messages are preserved
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 7. Phase 6: Extract Audio/Media Handlers
  - [~] 7.1 Create hooks directory and extract audio recorder hook
    - Create `frontend-portal/src/hooks/useAudioRecorder.ts`
    - Extract audio recording state and logic
    - Implement startRecording, stopRecording, clearRecording methods
    - Handle microphone permissions and errors
    - _Requirements: 2.1, 2.6, 7.6, 7.8_
  
  - [~] 7.2 Extract media playback hook
    - Create `frontend-portal/src/hooks/useMediaPlayback.ts`
    - Extract audio/video playback state and toggle logic
    - Implement cleanup on component unmount
    - _Requirements: 2.6, 7.6, 7.8_
  
  - [~] 7.3 Extract media file handlers
    - Create `frontend-portal/src/services/mediaHandlers.ts`
    - Extract handleImageFileChange function
    - Extract handleVideoFileChange function
    - Extract cleanupMediaUrl function for blob URL cleanup
    - _Requirements: 2.1, 7.5_
  
  - [~] 7.4 Update QuestionsPage.tsx to use media hooks and handlers
    - Import and use useAudioRecorder hook
    - Import and use useMediaPlayback hook
    - Import media file handlers
    - Replace inline media handling logic
    - _Requirements: 10.1, 10.4, 10.5_
  
  - [ ]* 7.5 Write tests for audio recorder hook
    - Test recording starts and stops correctly
    - Test audio blob is created after recording
    - Test preview URL generation
    - Test recording timer increments
    - Test cleanup releases resources
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 7.6 Write tests for media playback hook
    - Test playback toggles correctly
    - Test playback stops when switching items
    - Test audio ref cleanup
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 7.7 Write tests for media file handlers
    - Test image file handler creates preview URLs
    - Test video file handler creates preview URLs
    - Test old preview URLs are cleaned up properly
    - Test null file handling
    - _Requirements: 4.4, 4.5_
  
  - [~] 7.8 Checkpoint: Verify Phase 6 completion
    - Run all media handler tests
    - Verify no memory leaks from blob URLs
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2, 14.1_

- [ ] 8. Phase 7: Extract Form State Management
  - [~] 8.1 Create and implement useQuestionForm hook
    - Create `frontend-portal/src/hooks/useQuestionForm.ts`
    - Define QuestionFormState and QuestionFormActions interfaces
    - Implement all form setters (20+ setter functions)
    - Implement resetForm with blob URL cleanup
    - Implement loadQuestionForEdit function
    - _Requirements: 2.1, 2.6, 7.7, 7.8_
  
  - [~] 8.2 Update QuestionsPage.tsx to use form hook
    - Import useQuestionForm hook
    - Replace individual useState calls with hook
    - Update all form field handlers to use hook actions
    - Verify form reset and load logic works
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 8.3 Write tests for form initialization
    - Test form initializes with default values
    - Verify all fields have correct initial state
    - Test form state structure
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 8.4 Write tests for form setters and reset
    - Test individual setters update state correctly
    - Test resetForm clears all state
    - Test resetForm cleans up blob URLs
    - Test loadQuestionForEdit populates form correctly
    - Test answer normalization when loading
    - _Requirements: 4.4, 4.5_
  
  - [~] 8.5 Checkpoint: Verify Phase 7 completion
    - Run all form state tests
    - Verify no memory leaks from unreleased URLs
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 9. Phase 8: Extract Modal Management
  - [~] 9.1 Create and implement useQuestionModal hook
    - Create `frontend-portal/src/hooks/useQuestionModal.ts`
    - Define QuestionModalState and QuestionModalActions interfaces
    - Implement openCreateModal with question limit check
    - Implement openEditModal and closeModal
    - _Requirements: 2.1, 2.6, 7.7_
  
  - [~] 9.2 Update QuestionsPage.tsx to use modal hook
    - Import useQuestionModal hook
    - Replace modal state management with hook
    - Wire up modal actions to UI handlers
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 9.3 Write tests for modal state management
    - Test modal opens for create when question count < 5
    - Test modal does not open when question count >= 5
    - Test limit callback is called when at limit
    - Test modal opens for edit with question data
    - Test closeModal clears editing question
    - Test closeModal closes modal
    - _Requirements: 4.3, 4.4, 4.5_
  
  - [~] 9.4 Checkpoint: Verify Phase 8 completion
    - Run all modal tests
    - Verify modal behavior matches original
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 10. Phase 9: Extract API Integration
  - [~] 10.1 Create and implement useQuestions hook
    - Create `frontend-portal/src/hooks/useQuestions.ts`
    - Define QuestionsState and QuestionsActions interfaces
    - Implement fetchQuestions, silentRefreshQuestions
    - Implement deleteQuestion and removeQuestionOptimistically
    - Handle loading and error states
    - _Requirements: 2.1, 2.6, 7.7_
  
  - [~] 10.2 Create and implement useMaps hook
    - Create `frontend-portal/src/hooks/useMaps.ts`
    - Define MapsState and MapsActions interfaces
    - Implement fetchMaps with sorting logic
    - Implement silentRefreshMaps, selectMap, updateMapQuestionCount
    - Handle auto-selection of first map
    - _Requirements: 2.1, 2.6, 7.7_
  
  - [~] 10.3 Update QuestionsPage.tsx to use API hooks
    - Import useQuestions and useMaps hooks
    - Replace API fetching logic with hooks
    - Update dependent components to use hook state
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 10.4 Write tests for useQuestions hook
    - Test hook fetches data on mount when mapId is provided
    - Test hook refetches when mapId changes
    - Test silent refresh doesn't show loading state
    - Test optimistic removal updates state immediately
    - Test error handling
    - _Requirements: 4.3, 4.4, 4.5_
  
  - [ ]* 10.5 Write tests for useMaps hook
    - Test hook fetches and sorts maps on mount
    - Test auto-selects first map
    - Test map selection updates state
    - Test map question count updates correctly
    - Test error handling
    - _Requirements: 4.3, 4.4, 4.5_
  
  - [~] 10.6 Checkpoint: Verify Phase 9 completion
    - Run all API hook tests
    - Verify loading and error states work correctly
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 11. Phase 10: Extract UI Components
  - [~] 11.1 Create and implement QuestionCard component
    - Create `frontend-portal/src/components/QuestionCard.tsx`
    - Extract question card rendering logic
    - Accept props for question data, handlers, and audio state
    - Preserve all styling and accessibility attributes
    - _Requirements: 2.1, 7.3, 9.6, 15.1, 15.2, 15.5_
  
  - [~] 11.2 Create and implement MapTabs component
    - Create `frontend-portal/src/components/MapTabs.tsx`
    - Extract kingdom/map selection tabs logic
    - Use TEACHER_GUIDES and KINGDOM_COLORS constants
    - Preserve keyboard navigation and ARIA attributes
    - _Requirements: 2.1, 7.3, 9.6, 15.1, 15.2_
  
  - [~] 11.3 Create and implement AnswerChoiceEditor component
    - Create `frontend-portal/src/components/AnswerChoiceEditor.tsx`
    - Extract answer choice editing UI
    - Handle add, remove, and update operations via props
    - Preserve form accessibility
    - _Requirements: 2.1, 7.3, 9.6, 15.1, 15.4_
  
  - [~] 11.4 Create additional UI components
    - Create `frontend-portal/src/components/QuestionModal.tsx` for modal UI
    - Create `frontend-portal/src/components/MediaRecorder.tsx` for recording UI
    - Extract and preserve all component-specific logic
    - _Requirements: 2.1, 7.3, 9.6_
  
  - [~] 11.5 Update QuestionsPage.tsx to use extracted components
    - Import all extracted UI components
    - Replace inline JSX with component usage
    - Pass correct props to each component
    - Verify component composition works correctly
    - _Requirements: 10.1, 10.4, 10.5_
  
  - [ ]* 11.6 Write tests for QuestionCard component
    - Test renders correctly with multiple choice question
    - Test renders correctly with identification question
    - Test calls edit handler on edit button click
    - Test calls delete handler on delete button click
    - Test audio playback button works
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 11.7 Write tests for MapTabs component
    - Test renders all maps correctly
    - Test highlights selected map
    - Test displays question counts
    - Test calls onSelectMap when tab clicked
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 11.8 Write tests for AnswerChoiceEditor component
    - Test renders all answers
    - Test updates answer text on input change
    - Test selects correct answer on radio click
    - Test adds choice when add button clicked (if < 4)
    - Test removes choice when remove button clicked (if > 2)
    - _Requirements: 4.3, 4.4_
  
  - [~] 11.9 Checkpoint: Verify Phase 10 completion
    - Run all component tests
    - Verify components render correctly in isolation
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2_

- [ ] 12. Phase 11: Final Cleanup & Optimization
  - [~] 12.1 Remove dead code and unused imports
    - Scan QuestionsPage.tsx for any remaining inline logic
    - Remove unused variables and functions
    - Remove unused import statements
    - Verify no orphaned code remains
    - _Requirements: 10.2, 10.3_
  
  - [~] 12.2 Add JSDoc documentation to public APIs
    - Document all exported functions with JSDoc
    - Document all exported hooks with usage examples
    - Document all exported components with prop descriptions
    - Add type annotations where missing
    - _Requirements: 9.1, 9.5_
  
  - [~] 12.3 Optimize imports and exports
    - Organize imports consistently (React, third-party, local)
    - Create index files for easier importing where beneficial
    - Use barrel exports for related modules
    - Verify tree-shaking compatibility
    - _Requirements: 9.2, 10.3, 10.4_
  
  - [~] 12.4 Run final validation checks
    - Run TypeScript in strict mode and fix any issues
    - Run ESLint with all rules and fix warnings
    - Verify no console errors or warnings in browser
    - Test application end-to-end manually
    - _Requirements: 11.1, 11.2, 11.5, 11.6_
  
  - [ ]* 12.5 Write integration tests
    - Write end-to-end test of question creation flow
    - Write end-to-end test of question editing flow
    - Write end-to-end test of question deletion flow
    - Verify no regression in existing functionality
    - _Requirements: 4.1, 4.2, 5.1_
  
  - [~] 12.6 Generate test coverage report
    - Run test coverage analysis
    - Verify coverage >= 80%
    - Identify any untested code paths
    - Add tests for critical uncovered areas
    - _Requirements: 12.3, 12.5_
  
  - [~] 12.7 Create refactoring documentation
    - Create `docs/REFACTORING_SUMMARY.md`
    - Document all extracted modules and their purposes
    - Create module dependency diagram
    - Document testing strategy and coverage
    - List all phases completed and outcomes
    - _Requirements: 8.2, 8.3, 8.5, 12.1, 12.2, 12.6_
  
  - [~] 12.8 Final checkpoint: Verify Phase 11 and entire refactoring
    - Run full test suite and verify 100% pass rate
    - Run TypeScript compiler in strict mode
    - Run linter with no errors
    - Verify application works correctly end-to-end
    - Confirm all accessibility features preserved
    - Confirm no performance regressions
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 5.1, 11.1, 11.2, 11.5, 14.1, 15.1_

## Notes

- Tasks marked with `*` are optional test tasks that can be skipped for faster implementation, but are recommended for quality assurance
- Each phase includes a checkpoint task to ensure incremental validation
- All phases preserve existing behavior—no functionality changes are introduced
- TypeScript is used throughout for type safety
- React hooks and components follow best practices
- All accessibility features (ARIA attributes, keyboard navigation, screen reader support) must be preserved
- Blob URLs must be cleaned up properly to prevent memory leaks
- Each task references specific requirements for traceability
- Test coverage target is >= 80% for the entire refactored codebase
- Git checkpoints should be created before each phase for rollback capability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4", "3.5"] },
    { "id": 6, "tasks": ["3.6"] },
    { "id": 7, "tasks": ["4.1", "4.2"] },
    { "id": 8, "tasks": ["4.3", "4.4", "4.5"] },
    { "id": 9, "tasks": ["4.6"] },
    { "id": 10, "tasks": ["5.1", "5.2"] },
    { "id": 11, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 12, "tasks": ["5.6"] },
    { "id": 13, "tasks": ["6.1"] },
    { "id": 14, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 15, "tasks": ["6.5"] },
    { "id": 16, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 17, "tasks": ["7.4", "7.5", "7.6", "7.7"] },
    { "id": 18, "tasks": ["7.8"] },
    { "id": 19, "tasks": ["8.1"] },
    { "id": 20, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 21, "tasks": ["8.5"] },
    { "id": 22, "tasks": ["9.1"] },
    { "id": 23, "tasks": ["9.2", "9.3"] },
    { "id": 24, "tasks": ["9.4"] },
    { "id": 25, "tasks": ["10.1", "10.2"] },
    { "id": 26, "tasks": ["10.3", "10.4", "10.5"] },
    { "id": 27, "tasks": ["10.6"] },
    { "id": 28, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 29, "tasks": ["11.5", "11.6", "11.7", "11.8"] },
    { "id": 30, "tasks": ["11.9"] },
    { "id": 31, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 32, "tasks": ["12.4", "12.5", "12.6"] },
    { "id": 33, "tasks": ["12.7"] },
    { "id": 34, "tasks": ["12.8"] }
  ]
}
```
