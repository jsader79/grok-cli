import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTokenCounter } from '../token-counter';

describe('TokenCounter', () => {
  describe('createTokenCounter', () => {
    it('should create a token counter for gpt-4 model', () => {
      const counter = createTokenCounter('gpt-4');
      expect(counter).toBeDefined();
      expect(counter.countTokens).toBeDefined();
      expect(counter.countMessageTokens).toBeDefined();
    });

    it('should create a token counter for grok model (fallback to gpt-4)', () => {
      const counter = createTokenCounter('grok-code-fast-1');
      expect(counter).toBeDefined();
    });

    it('should handle unknown models gracefully', () => {
      const counter = createTokenCounter('unknown-model');
      expect(counter).toBeDefined();
    });
  });

  describe('countTokens', () => {
    let counter: ReturnType<typeof createTokenCounter>;

    beforeEach(() => {
      counter = createTokenCounter('gpt-4');
    });

    afterEach(() => {
      counter.dispose();
    });

    it('should count tokens in simple text', () => {
      const text = 'Hello, world!';
      const tokenCount = counter.countTokens(text);
      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });

    it('should count tokens in empty string', () => {
      const tokenCount = counter.countTokens('');
      expect(tokenCount).toBe(0);
    });

    it('should count tokens in code', () => {
      const code = 'function hello() { return "world"; }';
      const tokenCount = counter.countTokens(code);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should count tokens in multi-line text', () => {
      const text = `Line 1
Line 2
Line 3`;
      const tokenCount = counter.countTokens(text);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should count more tokens for longer text', () => {
      const shortText = 'Hello';
      const longText = 'Hello world, this is a much longer text with many more words';

      const shortCount = counter.countTokens(shortText);
      const longCount = counter.countTokens(longText);

      expect(longCount).toBeGreaterThan(shortCount);
    });

    it('should handle special characters', () => {
      const text = '🚀 Emoji test with special chars: @#$%^&*()';
      const tokenCount = counter.countTokens(text);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const text = '你好世界 Привет мир';
      const tokenCount = counter.countTokens(text);
      expect(tokenCount).toBeGreaterThan(0);
    });
  });

  describe('countMessageTokens', () => {
    let counter: ReturnType<typeof createTokenCounter>;

    beforeEach(() => {
      counter = createTokenCounter('gpt-4');
    });

    afterEach(() => {
      counter.dispose();
    });

    it('should count tokens in single message', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello, how are you?' }
      ];
      const tokenCount = counter.countMessageTokens(messages);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should count tokens in conversation', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'What is the weather?' },
        { role: 'assistant' as const, content: 'I can help you with that.' }
      ];
      const tokenCount = counter.countMessageTokens(messages);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should count more tokens for longer conversations', () => {
      const shortConvo = [
        { role: 'user' as const, content: 'Hi' }
      ];
      const longConvo = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'What is the weather today?' },
        { role: 'assistant' as const, content: 'I can help you check the weather.' },
        { role: 'user' as const, content: 'Thanks, please do that.' }
      ];

      const shortCount = counter.countMessageTokens(shortConvo);
      const longCount = counter.countMessageTokens(longConvo);

      expect(longCount).toBeGreaterThan(shortCount);
    });

    it('should handle empty message array', () => {
      const tokenCount = counter.countMessageTokens([]);
      // Empty array should return at least 0 tokens
      expect(tokenCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle messages with empty content', () => {
      const messages = [
        { role: 'user' as const, content: '' }
      ];
      const tokenCount = counter.countMessageTokens(messages);
      // Should count role tokens even if content is empty
      expect(tokenCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('estimateStreamingTokens', () => {
    let counter: ReturnType<typeof createTokenCounter>;

    beforeEach(() => {
      counter = createTokenCounter('gpt-4');
    });

    afterEach(() => {
      counter.dispose();
    });

    it('should estimate tokens in streaming text', () => {
      const text = 'This is streaming content';
      const estimate = counter.estimateStreamingTokens(text);
      expect(estimate).toBeGreaterThan(0);
    });

    it('should provide reasonable estimate compared to actual count', () => {
      const text = 'Hello world, this is a test message';
      const estimate = counter.estimateStreamingTokens(text);
      const actual = counter.countTokens(text);

      // Estimate should be within reasonable range of actual
      // Allow 50% variance for streaming estimation
      expect(estimate).toBeGreaterThan(0);
      expect(Math.abs(estimate - actual) / actual).toBeLessThan(0.5);
    });

    it('should handle empty string in streaming', () => {
      const estimate = counter.estimateStreamingTokens('');
      expect(estimate).toBe(0);
    });
  });

  describe('memory management', () => {
    it('should dispose encoder properly', () => {
      const counter = createTokenCounter('gpt-4');
      expect(() => counter.dispose()).not.toThrow();
    });

    it('should allow counting after creation', () => {
      const counter = createTokenCounter('gpt-4');
      const count1 = counter.countTokens('test');
      const count2 = counter.countTokens('test');
      expect(count1).toBe(count2);
      counter.dispose();
    });
  });

  describe('model-specific behavior', () => {
    it('should handle gpt-4 model', () => {
      const counter = createTokenCounter('gpt-4');
      const count = counter.countTokens('Hello world');
      expect(count).toBeGreaterThan(0);
      counter.dispose();
    });

    it('should handle gpt-3.5-turbo model', () => {
      const counter = createTokenCounter('gpt-3.5-turbo');
      const count = counter.countTokens('Hello world');
      expect(count).toBeGreaterThan(0);
      counter.dispose();
    });

    it('should handle grok models using gpt-4 encoding', () => {
      const counter = createTokenCounter('grok-code-fast-1');
      const count = counter.countTokens('Hello world');
      expect(count).toBeGreaterThan(0);
      counter.dispose();
    });
  });
});
