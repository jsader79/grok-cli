/**
 * Command validation utilities for bash tool
 * Provides security checks to prevent dangerous command execution
 */

export interface CommandValidationResult {
  isValid: boolean;
  reason?: string;
  severity?: 'warning' | 'error';
}

/**
 * Dangerous commands that should be blocked or warned about
 */
const DANGEROUS_COMMANDS = {
  // Destructive file operations
  'rm -rf /': {
    severity: 'error' as const,
    reason: 'Attempting to delete root directory',
  },
  'rm -rf /*': {
    severity: 'error' as const,
    reason: 'Attempting to delete all files in root',
  },
  'rm -rf ~': {
    severity: 'error' as const,
    reason: 'Attempting to delete home directory',
  },
  'rm -rf $HOME': {
    severity: 'error' as const,
    reason: 'Attempting to delete home directory',
  },

  // System modification
  'mkfs': {
    severity: 'error' as const,
    reason: 'Attempting to format filesystem',
  },
  'dd if=': {
    severity: 'error' as const,
    reason: 'Direct disk write operation',
  },

  // Fork bombs
  ':(){ :|:& };:': {
    severity: 'error' as const,
    reason: 'Fork bomb detected',
  },
};

/**
 * Patterns that indicate potentially dangerous operations
 */
const DANGEROUS_PATTERNS = [
  {
    pattern: /rm\s+-rf\s+\/(?!tmp|var\/tmp)/,
    severity: 'error' as const,
    reason: 'Attempting to recursively delete from root directory',
  },
  {
    pattern: /rm\s+-rf.*\*/,
    severity: 'warning' as const,
    reason: 'Recursive deletion with wildcards',
  },
  {
    pattern: />+\s*\/dev\/(sda|hda|nvme)/,
    severity: 'error' as const,
    reason: 'Attempting to write directly to disk device',
  },
  {
    pattern: /chmod\s+777\s+\//,
    severity: 'warning' as const,
    reason: 'Setting overly permissive permissions on root',
  },
  {
    pattern: /curl.*\|\s*bash/,
    severity: 'warning' as const,
    reason: 'Piping remote script directly to bash',
  },
  {
    pattern: /wget.*\|\s*bash/,
    severity: 'warning' as const,
    reason: 'Piping remote script directly to bash',
  },
  {
    pattern: /eval\s+\$\(/,
    severity: 'warning' as const,
    reason: 'Using eval with command substitution',
  },
  {
    pattern: /:\(\)\{.*:\|:&\s*\};:/,
    severity: 'error' as const,
    reason: 'Fork bomb detected',
  },
];

/**
 * Commands that require explicit user confirmation even with auto-approve
 */
const HIGH_RISK_COMMANDS = [
  'rm',
  'rmdir',
  'unlink',
  'dd',
  'mkfs',
  'fdisk',
  'chmod',
  'chown',
  'kill',
  'killall',
  'shutdown',
  'reboot',
  'halt',
  'init',
];

/**
 * Validate a bash command for safety
 */
export function validateCommand(command: string): CommandValidationResult {
  const trimmed = command.trim();

  // Check for empty command
  if (!trimmed) {
    return {
      isValid: false,
      reason: 'Empty command',
      severity: 'error',
    };
  }

  // Check exact matches first
  for (const [dangerousCmd, { severity, reason }] of Object.entries(DANGEROUS_COMMANDS)) {
    if (trimmed === dangerousCmd || trimmed.includes(dangerousCmd)) {
      return {
        isValid: false,
        reason,
        severity,
      };
    }
  }

  // Check patterns
  for (const { pattern, severity, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        reason,
        severity,
      };
    }
  }

  // All checks passed
  return {
    isValid: true,
  };
}

/**
 * Check if a command is high-risk and needs explicit confirmation
 */
export function isHighRiskCommand(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return HIGH_RISK_COMMANDS.includes(firstWord);
}

/**
 * Sanitize command for logging (remove sensitive data)
 */
export function sanitizeCommandForLogging(command: string): string {
  // Remove API keys, tokens, passwords
  const sanitized = command
    .replace(/([a-zA-Z_]+KEY|TOKEN|PASSWORD|SECRET)=["']?[^"'\s]+["']?/gi, '$1=***')
    .replace(/(--?)(key|token|password|secret)[=\s]+["']?[^"'\s]+["']?/gi, '$1$2=***')
    // Remove URLs with auth
    .replace(/(https?:\/\/)([^:]+):([^@]+)@/g, '$1$2:***@');

  return sanitized;
}

/**
 * Get a user-friendly explanation of why a command is dangerous
 */
export function getCommandWarningMessage(command: string): string | null {
  const validation = validateCommand(command);

  if (!validation.isValid) {
    const severityEmoji = validation.severity === 'error' ? '🚫' : '⚠️';
    return `${severityEmoji} ${validation.reason}`;
  }

  if (isHighRiskCommand(command)) {
    return '⚠️ This command modifies system state and requires confirmation';
  }

  return null;
}

/**
 * Rate limiting for bash commands
 */
export class CommandRateLimiter {
  private commandHistory: { timestamp: number; command: string }[] = [];
  private readonly maxCommandsPerMinute: number;
  private readonly windowMs: number;

  constructor(maxCommandsPerMinute: number = 30, windowMs: number = 60000) {
    this.maxCommandsPerMinute = maxCommandsPerMinute;
    this.windowMs = windowMs;
  }

  /**
   * Check if a command can be executed or if rate limit is exceeded
   */
  canExecute(command: string): { allowed: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now();

    // Clean up old entries
    this.commandHistory = this.commandHistory.filter(
      (entry) => now - entry.timestamp < this.windowMs
    );

    // Check rate limit
    if (this.commandHistory.length >= this.maxCommandsPerMinute) {
      const oldestCommand = this.commandHistory[0];
      const retryAfter = Math.ceil((oldestCommand.timestamp + this.windowMs - now) / 1000);

      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.maxCommandsPerMinute} commands per minute`,
        retryAfter,
      };
    }

    // Record this command
    this.commandHistory.push({ timestamp: now, command });

    return { allowed: true };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.commandHistory = [];
  }

  /**
   * Get current usage statistics
   */
  getStats(): { commandsInWindow: number; maxCommands: number; utilizationPercent: number } {
    const now = Date.now();
    const recentCommands = this.commandHistory.filter(
      (entry) => now - entry.timestamp < this.windowMs
    );

    return {
      commandsInWindow: recentCommands.length,
      maxCommands: this.maxCommandsPerMinute,
      utilizationPercent: (recentCommands.length / this.maxCommandsPerMinute) * 100,
    };
  }
}
