import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';
import {
  validateCommand,
  isHighRiskCommand,
  sanitizeCommandForLogging,
  getCommandWarningMessage,
  CommandRateLimiter,
} from '../utils/command-validator.js';

const execAsync = promisify(exec);

export class BashTool {
  private currentDirectory: string = process.cwd();
  private confirmationService = ConfirmationService.getInstance();
  private rateLimiter = new CommandRateLimiter(30, 60000); // 30 commands per minute


  async execute(command: string, timeout: number = 30000): Promise<ToolResult> {
    try {
      // 1. Validate command safety
      const validation = validateCommand(command);
      if (!validation.isValid) {
        const warningMsg = getCommandWarningMessage(command);
        console.error(`[SECURITY] Blocked dangerous command: ${sanitizeCommandForLogging(command)}`);
        console.error(`[SECURITY] Reason: ${validation.reason}`);

        return {
          success: false,
          error: `Command blocked for safety: ${warningMsg || validation.reason}`
        };
      }

      // 2. Check rate limiting
      const rateLimitCheck = this.rateLimiter.canExecute(command);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: `${rateLimitCheck.reason}. Retry after ${rateLimitCheck.retryAfter}s`
        };
      }

      // 3. Check if user confirmation is needed
      const sessionFlags = this.confirmationService.getSessionFlags();
      const needsConfirmation = isHighRiskCommand(command) ||
                               (!sessionFlags.bashCommands && !sessionFlags.allOperations);

      if (needsConfirmation) {
        const warningMsg = getCommandWarningMessage(command);
        const confirmationResult = await this.confirmationService.requestConfirmation({
          operation: 'Run bash command',
          filename: command,
          showVSCodeOpen: false,
          content: `Command: ${command}\nWorking directory: ${this.currentDirectory}${warningMsg ? `\n\n${warningMsg}` : ''}`
        }, 'bash');

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error: confirmationResult.feedback || 'Command execution cancelled by user'
          };
        }
      }

      if (command.startsWith('cd ')) {
        const newDir = command.substring(3).trim();
        try {
          process.chdir(newDir);
          this.currentDirectory = process.cwd();
          return {
            success: true,
            output: `Changed directory to: ${this.currentDirectory}`
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Cannot change directory: ${error.message}`
          };
        }
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.currentDirectory,
        timeout,
        maxBuffer: 1024 * 1024
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      
      return {
        success: true,
        output: output.trim() || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Command failed: ${error.message}`
      };
    }
  }

  getCurrentDirectory(): string {
    return this.currentDirectory;
  }

  async listFiles(directory: string = '.'): Promise<ToolResult> {
    return this.execute(`ls -la ${directory}`);
  }

  async findFiles(pattern: string, directory: string = '.'): Promise<ToolResult> {
    return this.execute(`find ${directory} -name "${pattern}" -type f`);
  }

  async grep(pattern: string, files: string = '.'): Promise<ToolResult> {
    return this.execute(`grep -r "${pattern}" ${files}`);
  }
}