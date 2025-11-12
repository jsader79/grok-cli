import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCommand,
  isHighRiskCommand,
  sanitizeCommandForLogging,
  getCommandWarningMessage,
  CommandRateLimiter,
} from '../../src/utils/command-validator';

describe('Command Validator', () => {
  describe('validateCommand', () => {
    it('should allow safe commands', () => {
      const result = validateCommand('ls -la');
      expect(result.isValid).toBe(true);
    });

    it('should block rm -rf /', () => {
      const result = validateCommand('rm -rf /');
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reason).toContain('root directory');
    });

    it('should block rm -rf ~', () => {
      const result = validateCommand('rm -rf ~');
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('should block fork bombs', () => {
      const result = validateCommand(':(){ :|:& };:');
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reason).toContain('Fork bomb');
    });

    it('should warn about piping to bash', () => {
      const result = validateCommand('curl http://example.com/script.sh | bash');
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('should block recursive deletion with wildcards', () => {
      const result = validateCommand('rm -rf ./*');
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('should block writes to disk devices', () => {
      const result = validateCommand('dd if=/dev/zero > /dev/sda');
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('should return false for empty commands', () => {
      const result = validateCommand('');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty command');
    });
  });

  describe('isHighRiskCommand', () => {
    it('should identify high-risk commands', () => {
      expect(isHighRiskCommand('rm file.txt')).toBe(true);
      expect(isHighRiskCommand('chmod 777 file')).toBe(true);
      expect(isHighRiskCommand('kill 1234')).toBe(true);
      expect(isHighRiskCommand('shutdown now')).toBe(true);
    });

    it('should not flag safe commands', () => {
      expect(isHighRiskCommand('ls -la')).toBe(false);
      expect(isHighRiskCommand('cat file.txt')).toBe(false);
      expect(isHighRiskCommand('echo "hello"')).toBe(false);
    });
  });

  describe('sanitizeCommandForLogging', () => {
    it('should sanitize API keys', () => {
      const cmd = 'curl -H "API_KEY=secret123" https://api.example.com';
      const sanitized = sanitizeCommandForLogging(cmd);
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('***');
    });

    it('should sanitize tokens', () => {
      const cmd = 'export TOKEN=abc123';
      const sanitized = sanitizeCommandForLogging(cmd);
      expect(sanitized).not.toContain('abc123');
      expect(sanitized).toContain('***');
    });

    it('should sanitize passwords in URLs', () => {
      const cmd = 'git clone https://user:password@github.com/repo.git';
      const sanitized = sanitizeCommandForLogging(cmd);
      expect(sanitized).not.toContain('password');
      expect(sanitized).toContain('***');
    });

    it('should leave safe commands unchanged', () => {
      const cmd = 'ls -la /home/user';
      const sanitized = sanitizeCommandForLogging(cmd);
      expect(sanitized).toBe(cmd);
    });
  });

  describe('getCommandWarningMessage', () => {
    it('should return warning for dangerous commands', () => {
      const msg = getCommandWarningMessage('rm -rf /');
      expect(msg).not.toBeNull();
      expect(msg).toContain('🚫');
    });

    it('should return warning for high-risk commands', () => {
      const msg = getCommandWarningMessage('rm file.txt');
      expect(msg).not.toBeNull();
      expect(msg).toContain('⚠️');
    });

    it('should return null for safe commands', () => {
      const msg = getCommandWarningMessage('ls -la');
      expect(msg).toBeNull();
    });
  });

  describe('CommandRateLimiter', () => {
    let limiter: CommandRateLimiter;

    beforeEach(() => {
      limiter = new CommandRateLimiter(3, 1000); // 3 commands per second for testing
    });

    it('should allow commands within rate limit', () => {
      const result1 = limiter.canExecute('ls');
      expect(result1.allowed).toBe(true);

      const result2 = limiter.canExecute('pwd');
      expect(result2.allowed).toBe(true);

      const result3 = limiter.canExecute('whoami');
      expect(result3.allowed).toBe(true);
    });

    it('should block commands exceeding rate limit', () => {
      limiter.canExecute('cmd1');
      limiter.canExecute('cmd2');
      limiter.canExecute('cmd3');

      const result = limiter.canExecute('cmd4');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset rate limiter', () => {
      limiter.canExecute('cmd1');
      limiter.canExecute('cmd2');
      limiter.canExecute('cmd3');

      limiter.reset();

      const result = limiter.canExecute('cmd4');
      expect(result.allowed).toBe(true);
    });

    it('should provide accurate stats', () => {
      limiter.canExecute('cmd1');
      limiter.canExecute('cmd2');

      const stats = limiter.getStats();
      expect(stats.commandsInWindow).toBe(2);
      expect(stats.maxCommands).toBe(3);
      expect(stats.utilizationPercent).toBeCloseTo(66.67, 1);
    });

    it('should allow commands after window expires', async () => {
      limiter.canExecute('cmd1');
      limiter.canExecute('cmd2');
      limiter.canExecute('cmd3');

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = limiter.canExecute('cmd4');
      expect(result.allowed).toBe(true);
    });
  });
});
