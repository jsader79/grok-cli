/**
 * Custom error types for the Grok CLI application
 * Provides better error categorization and context for debugging
 */

/**
 * Base error class for all Grok CLI errors
 */
export class GrokError extends Error {
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = 'GrokError';
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends GrokError {
  constructor(
    public readonly toolName: string,
    public readonly originalError: Error,
    message?: string,
    context?: Record<string, any>
  ) {
    super(
      message || `Failed to execute tool '${toolName}': ${originalError.message}`,
      {
        ...context,
        toolName,
        originalErrorMessage: originalError.message,
        originalErrorStack: originalError.stack,
      }
    );
    this.name = 'ToolExecutionError';
  }
}

/**
 * Error thrown when tool arguments are invalid
 */
export class InvalidToolArgumentsError extends GrokError {
  constructor(
    public readonly toolName: string,
    public readonly invalidArguments: string,
    message?: string
  ) {
    super(
      message || `Invalid arguments for tool '${toolName}'`,
      {
        toolName,
        invalidArguments,
      }
    );
    this.name = 'InvalidToolArgumentsError';
  }
}

/**
 * Error thrown when a tool is not found
 */
export class ToolNotFoundError extends GrokError {
  constructor(
    public readonly toolName: string,
    public readonly availableTools?: string[]
  ) {
    super(
      `Tool '${toolName}' not found`,
      {
        toolName,
        availableTools,
      }
    );
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileOperationError extends GrokError {
  constructor(
    public readonly operation: string,
    public readonly filePath: string,
    public readonly originalError?: Error,
    message?: string
  ) {
    super(
      message || `File ${operation} failed for '${filePath}'${originalError ? ': ' + originalError.message : ''}`,
      {
        operation,
        filePath,
        originalErrorMessage: originalError?.message,
      }
    );
    this.name = 'FileOperationError';
  }
}

/**
 * Error thrown when a file is not found
 */
export class FileNotFoundError extends FileOperationError {
  constructor(public readonly filePath: string) {
    super('read', filePath, undefined, `File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Error thrown when API calls fail
 */
export class APIError extends GrokError {
  constructor(
    public readonly apiName: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
    message?: string
  ) {
    super(
      message || `${apiName} API request failed${statusCode ? ` with status ${statusCode}` : ''}`,
      {
        apiName,
        statusCode,
        originalErrorMessage: originalError?.message,
      }
    );
    this.name = 'APIError';
  }
}

/**
 * Error thrown when Grok API calls fail
 */
export class GrokAPIError extends APIError {
  constructor(
    statusCode?: number,
    originalError?: Error,
    message?: string
  ) {
    super('Grok', statusCode, originalError, message);
    this.name = 'GrokAPIError';
  }
}

/**
 * Error thrown when MCP operations fail
 */
export class MCPError extends GrokError {
  constructor(
    public readonly serverName: string,
    public readonly operation: string,
    public readonly originalError?: Error,
    message?: string
  ) {
    super(
      message || `MCP ${operation} failed for server '${serverName}'${originalError ? ': ' + originalError.message : ''}`,
      {
        serverName,
        operation,
        originalErrorMessage: originalError?.message,
      }
    );
    this.name = 'MCPError';
  }
}

/**
 * Error thrown when MCP server connection fails
 */
export class MCPConnectionError extends MCPError {
  constructor(
    serverName: string,
    originalError?: Error,
    message?: string
  ) {
    super(serverName, 'connection', originalError, message || `Failed to connect to MCP server '${serverName}'`);
    this.name = 'MCPConnectionError';
  }
}

/**
 * Error thrown when MCP tool execution fails
 */
export class MCPToolError extends MCPError {
  constructor(
    serverName: string,
    public readonly toolName: string,
    originalError?: Error,
    message?: string
  ) {
    const contextWithTool = {
      serverName,
      operation: 'tool execution',
      toolName,
      originalErrorMessage: originalError?.message,
    };
    super(
      serverName,
      'tool execution',
      originalError,
      message || `MCP tool '${toolName}' failed on server '${serverName}'`
    );
    this.name = 'MCPToolError';
    // Override context with toolName included
    Object.defineProperty(this, 'context', {
      value: contextWithTool,
      writable: false,
      enumerable: true,
    });
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends GrokError {
  constructor(
    public readonly configKey: string,
    message?: string,
    context?: Record<string, any>
  ) {
    super(
      message || `Invalid configuration for '${configKey}'`,
      {
        ...context,
        configKey,
      }
    );
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when user cancels an operation
 */
export class UserCancellationError extends GrokError {
  constructor(
    public readonly operation: string,
    public readonly userFeedback?: string
  ) {
    super(
      `Operation '${operation}' cancelled by user${userFeedback ? ': ' + userFeedback : ''}`,
      {
        operation,
        userFeedback,
      }
    );
    this.name = 'UserCancellationError';
  }
}

/**
 * Error thrown when token limit is exceeded
 */
export class TokenLimitError extends GrokError {
  constructor(
    public readonly currentTokens: number,
    public readonly maxTokens: number,
    message?: string
  ) {
    super(
      message || `Token limit exceeded: ${currentTokens} tokens (max: ${maxTokens})`,
      {
        currentTokens,
        maxTokens,
      }
    );
    this.name = 'TokenLimitError';
  }
}

/**
 * Error thrown when maximum tool rounds are reached
 */
export class MaxToolRoundsError extends GrokError {
  constructor(
    public readonly maxRounds: number,
    message?: string
  ) {
    super(
      message || `Maximum tool execution rounds reached (${maxRounds}). Stopping to prevent infinite loops.`,
      {
        maxRounds,
      }
    );
    this.name = 'MaxToolRoundsError';
  }
}

/**
 * Type guard to check if error is a GrokError
 */
export function isGrokError(error: unknown): error is GrokError {
  return error instanceof GrokError;
}

/**
 * Utility function to convert any error to a GrokError
 */
export function toGrokError(error: unknown, defaultMessage?: string): GrokError {
  if (isGrokError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new GrokError(error.message || defaultMessage || 'Unknown error occurred', {
      originalError: error.message,
      originalStack: error.stack,
    });
  }

  return new GrokError(defaultMessage || String(error));
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
  if (isGrokError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Format error for logging (includes context and stack)
 */
export function formatErrorForLogging(error: unknown): string {
  if (isGrokError(error)) {
    const parts = [
      `[${error.name}] ${error.message}`,
    ];

    if (error.context && Object.keys(error.context).length > 0) {
      parts.push(`Context: ${JSON.stringify(error.context, null, 2)}`);
    }

    if (error.stack) {
      parts.push(`Stack: ${error.stack}`);
    }

    return parts.join('\n');
  }

  if (error instanceof Error) {
    return `[${error.name}] ${error.message}\nStack: ${error.stack}`;
  }

  return String(error);
}
