import { describe, it, expect, vi } from 'vitest';
import { createMockFile, createMockBlob, wait } from './helpers/testUtils';

/**
 * Infrastructure validation tests
 * 
 * These tests verify that the testing infrastructure is properly configured
 * and that all test utilities work as expected.
 */
describe('Testing Infrastructure', () => {
  describe('Test Setup', () => {
    it('should have vitest globals available', () => {
      expect(describe).toBeDefined();
      expect(it).toBeDefined();
      expect(expect).toBeDefined();
      expect(vi).toBeDefined();
    });

    it('should have DOM environment available', () => {
      expect(document).toBeDefined();
      expect(window).toBeDefined();
      expect(navigator).toBeDefined();
    });
  });

  describe('Mock Utilities', () => {
    it('should create mock files', () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');
      
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.jpg');
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBe(1024);
    });

    it('should create mock blobs', () => {
      const blob = createMockBlob(2048, 'audio/webm');
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/webm');
      expect(blob.size).toBe(2048);
    });

    it('should support async waiting', async () => {
      const start = Date.now();
      await wait(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Browser API Mocks', () => {
    it('should mock URL.createObjectURL', () => {
      const blob = new Blob(['test']);
      const url = URL.createObjectURL(blob);
      
      expect(url).toBe('blob:mock-url');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('should mock URL.revokeObjectURL', () => {
      URL.revokeObjectURL('blob:mock-url');
      
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should mock MediaRecorder', () => {
      const stream = new MediaStream();
      const recorder = new MediaRecorder(stream);
      
      expect(recorder).toBeDefined();
      expect(recorder.state).toBe('inactive');
      
      recorder.start();
      expect(recorder.state).toBe('recording');
      
      recorder.stop();
      expect(recorder.state).toBe('inactive');
    });

    it('should mock navigator.mediaDevices.getUserMedia', async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      expect(stream).toBeDefined();
      expect(stream.getTracks).toBeDefined();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should mock Audio element', () => {
      const audio = new Audio('test.mp3');
      
      expect(audio).toBeDefined();
      expect(audio.src).toBe('test.mp3');
      expect(audio.paused).toBe(true);
      
      audio.play();
      expect(audio.paused).toBe(false);
      
      audio.pause();
      expect(audio.paused).toBe(true);
    });

    it('should mock window.matchMedia', () => {
      const mql = window.matchMedia('(min-width: 768px)');
      
      expect(mql).toBeDefined();
      expect(mql.matches).toBe(false);
      expect(mql.media).toBe('(min-width: 768px)');
      expect(mql.addEventListener).toBeDefined();
    });

    it('should mock IntersectionObserver', () => {
      const observer = new IntersectionObserver(() => {});
      
      expect(observer).toBeDefined();
      expect(observer.observe).toBeDefined();
      expect(observer.disconnect).toBeDefined();
    });

    it('should mock ResizeObserver', () => {
      const observer = new ResizeObserver(() => {});
      
      expect(observer).toBeDefined();
      expect(observer.observe).toBeDefined();
      expect(observer.disconnect).toBeDefined();
    });
  });

  describe('Test Helpers', () => {
    it('should import test utilities', async () => {
      const helpers = await import('./helpers');
      
      expect(helpers.createMockFile).toBeDefined();
      expect(helpers.createMockBlob).toBeDefined();
      expect(helpers.wait).toBeDefined();
      expect(helpers.mockLocalStorage).toBeDefined();
      expect(helpers.mockSessionStorage).toBeDefined();
    });

    it('should import render helpers', async () => {
      const helpers = await import('./helpers/renderHelpers');
      
      expect(helpers.render).toBeDefined();
      expect(helpers.renderWithProviders).toBeDefined();
      expect(helpers.screen).toBeDefined();
      expect(helpers.waitFor).toBeDefined();
    });

    it('should import mock data', async () => {
      const mockData = await import('./helpers/mockData');
      
      expect(mockData.mockQuestion).toBeDefined();
      expect(mockData.mockIdentificationQuestion).toBeDefined();
      expect(mockData.mockMap).toBeDefined();
      expect(mockData.createMockAnswers).toBeDefined();
      expect(mockData.createMockQuestion).toBeDefined();
      expect(mockData.createMockQuestions).toBeDefined();
    });
  });
});
