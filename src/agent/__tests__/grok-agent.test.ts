import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrokAgent } from '../grok-agent';
import { GrokToolCall } from '../../grok/client';

// Mock the dependencies
vi.mock('../../grok/client');
vi.mock('../../grok/tools');
vi.mock('../../tools/text-editor');
vi.mock('../../tools/bash');
vi.mock('../../tools/search');
vi.mock('../../utils/token-counter');
vi.mock('../../utils/custom-instructions');

describe('GrokAgent - Tool Execution Routing', () => {
  let agent: GrokAgent;
  const mockApiKey = 'test-api-key';

  beforeEach(async () => {
    // Mock custom instructions to return empty
    const customInstructions = await import('../../utils/custom-instructions');
    vi.mocked(customInstructions).loadCustomInstructions = vi.fn(() => '');

    agent = new GrokAgent(mockApiKey);
  });

  describe('executeTool routing', () => {
    it('should route view_file to text editor', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'view_file',
          arguments: JSON.stringify({ path: '/test/file.txt' })
        }
      };

      // Mock text editor's view method
      const mockView = vi.fn().mockResolvedValue({ success: true, output: 'file content' });
      (agent as any).textEditor.view = mockView;

      const result = await (agent as any).executeTool(toolCall);

      expect(mockView).toHaveBeenCalledWith('/test/file.txt', undefined);
      expect(result.success).toBe(true);
    });

    it('should route view_file with line range to text editor', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_2',
        type: 'function',
        function: {
          name: 'view_file',
          arguments: JSON.stringify({
            path: '/test/file.txt',
            start_line: 10,
            end_line: 20
          })
        }
      };

      const mockView = vi.fn().mockResolvedValue({ success: true, output: 'lines 10-20' });
      (agent as any).textEditor.view = mockView;

      await (agent as any).executeTool(toolCall);

      expect(mockView).toHaveBeenCalledWith('/test/file.txt', [10, 20]);
    });

    it('should route create_file to text editor', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_3',
        type: 'function',
        function: {
          name: 'create_file',
          arguments: JSON.stringify({
            path: '/test/new.txt',
            content: 'new content'
          })
        }
      };

      const mockCreate = vi.fn().mockResolvedValue({ success: true });
      (agent as any).textEditor.create = mockCreate;

      await (agent as any).executeTool(toolCall);

      expect(mockCreate).toHaveBeenCalledWith('/test/new.txt', 'new content');
    });

    it('should route str_replace_editor to text editor', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_4',
        type: 'function',
        function: {
          name: 'str_replace_editor',
          arguments: JSON.stringify({
            path: '/test/file.txt',
            old_str: 'old text',
            new_str: 'new text',
            replace_all: false
          })
        }
      };

      const mockStrReplace = vi.fn().mockResolvedValue({ success: true });
      (agent as any).textEditor.strReplace = mockStrReplace;

      await (agent as any).executeTool(toolCall);

      expect(mockStrReplace).toHaveBeenCalledWith(
        '/test/file.txt',
        'old text',
        'new text',
        false
      );
    });

    it('should route bash to bash tool', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_5',
        type: 'function',
        function: {
          name: 'bash',
          arguments: JSON.stringify({ command: 'ls -la' })
        }
      };

      const mockExecute = vi.fn().mockResolvedValue({ success: true, output: 'file list' });
      (agent as any).bash.execute = mockExecute;

      await (agent as any).executeTool(toolCall);

      expect(mockExecute).toHaveBeenCalledWith('ls -la');
    });

    it('should route search to search tool', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_6',
        type: 'function',
        function: {
          name: 'search',
          arguments: JSON.stringify({
            query: 'test query',
            search_type: 'content',
            case_sensitive: false
          })
        }
      };

      const mockSearch = vi.fn().mockResolvedValue({ success: true, output: 'search results' });
      (agent as any).search.search = mockSearch;

      await (agent as any).executeTool(toolCall);

      expect(mockSearch).toHaveBeenCalledWith('test query', expect.objectContaining({
        searchType: 'content',
        caseSensitive: false
      }));
    });

    it('should route create_todo_list to todo tool', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_7',
        type: 'function',
        function: {
          name: 'create_todo_list',
          arguments: JSON.stringify({
            todos: [
              { task: 'Task 1', priority: 'high' },
              { task: 'Task 2', priority: 'low' }
            ]
          })
        }
      };

      const mockCreateTodo = vi.fn().mockResolvedValue({ success: true });
      (agent as any).todoTool.createTodoList = mockCreateTodo;

      await (agent as any).executeTool(toolCall);

      expect(mockCreateTodo).toHaveBeenCalled();
    });

    it('should route update_todo_list to todo tool', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_8',
        type: 'function',
        function: {
          name: 'update_todo_list',
          arguments: JSON.stringify({
            updates: [{ index: 0, status: 'completed' }]
          })
        }
      };

      const mockUpdateTodo = vi.fn().mockResolvedValue({ success: true });
      (agent as any).todoTool.updateTodoList = mockUpdateTodo;

      await (agent as any).executeTool(toolCall);

      expect(mockUpdateTodo).toHaveBeenCalled();
    });

    it('should handle edit_file with Morph editor when available', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_9',
        type: 'function',
        function: {
          name: 'edit_file',
          arguments: JSON.stringify({
            target_file: '/test/file.txt',
            instructions: 'make changes',
            code_edit: 'new code'
          })
        }
      };

      const mockEditFile = vi.fn().mockResolvedValue({ success: true });
      (agent as any).morphEditor = { editFile: mockEditFile };

      await (agent as any).executeTool(toolCall);

      expect(mockEditFile).toHaveBeenCalledWith(
        '/test/file.txt',
        'make changes',
        'new code'
      );
    });

    it('should return error for edit_file when Morph not available', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_10',
        type: 'function',
        function: {
          name: 'edit_file',
          arguments: JSON.stringify({
            target_file: '/test/file.txt',
            instructions: 'make changes',
            code_edit: 'new code'
          })
        }
      };

      (agent as any).morphEditor = null;

      const result = await (agent as any).executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Morph Fast Apply not available');
    });

    it('should route MCP tools with mcp__ prefix', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_11',
        type: 'function',
        function: {
          name: 'mcp__linear__create_issue',
          arguments: JSON.stringify({ title: 'Test Issue' })
        }
      };

      const mockExecuteMCP = vi.fn().mockResolvedValue({ success: true });
      (agent as any).executeMCPTool = mockExecuteMCP;

      await (agent as any).executeTool(toolCall);

      expect(mockExecuteMCP).toHaveBeenCalledWith(toolCall);
    });

    it('should return error for unknown tool', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_12',
        type: 'function',
        function: {
          name: 'unknown_tool',
          arguments: JSON.stringify({})
        }
      };

      const result = await (agent as any).executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle JSON parse errors in tool arguments', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_13',
        type: 'function',
        function: {
          name: 'view_file',
          arguments: 'invalid json'
        }
      };

      const result = await (agent as any).executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution error');
    });

    it('should handle tool execution errors', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_14',
        type: 'function',
        function: {
          name: 'view_file',
          arguments: JSON.stringify({ path: '/test/file.txt' })
        }
      };

      const mockView = vi.fn().mockRejectedValue(new Error('File system error'));
      (agent as any).textEditor.view = mockView;

      const result = await (agent as any).executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution error');
    });
  });

  describe('tool execution options handling', () => {
    it('should pass all search options correctly', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_15',
        type: 'function',
        function: {
          name: 'search',
          arguments: JSON.stringify({
            query: 'pattern',
            search_type: 'content',
            include_pattern: '*.ts',
            exclude_pattern: 'node_modules',
            case_sensitive: true,
            whole_word: true,
            regex: true,
            max_results: 50,
            file_types: ['typescript'],
            include_hidden: false
          })
        }
      };

      const mockSearch = vi.fn().mockResolvedValue({ success: true });
      (agent as any).search.search = mockSearch;

      await (agent as any).executeTool(toolCall);

      expect(mockSearch).toHaveBeenCalledWith('pattern', {
        searchType: 'content',
        includePattern: '*.ts',
        excludePattern: 'node_modules',
        caseSensitive: true,
        wholeWord: true,
        regex: true,
        maxResults: 50,
        fileTypes: ['typescript'],
        includeHidden: false
      });
    });

    it('should handle replace_all flag in str_replace_editor', async () => {
      const toolCall: GrokToolCall = {
        id: 'call_16',
        type: 'function',
        function: {
          name: 'str_replace_editor',
          arguments: JSON.stringify({
            path: '/test/file.txt',
            old_str: 'old',
            new_str: 'new',
            replace_all: true
          })
        }
      };

      const mockStrReplace = vi.fn().mockResolvedValue({ success: true });
      (agent as any).textEditor.strReplace = mockStrReplace;

      await (agent as any).executeTool(toolCall);

      expect(mockStrReplace).toHaveBeenCalledWith(
        '/test/file.txt',
        'old',
        'new',
        true
      );
    });
  });

  describe('agent configuration', () => {
    it('should use provided model', () => {
      const customAgent = new GrokAgent(mockApiKey, undefined, 'grok-4-latest');
      expect(customAgent.getCurrentModel()).toBe('grok-4-latest');
    });

    it('should use custom max tool rounds', () => {
      const customAgent = new GrokAgent(mockApiKey, undefined, undefined, 100);
      expect((customAgent as any).maxToolRounds).toBe(100);
    });

    it('should default to 400 max tool rounds', () => {
      expect((agent as any).maxToolRounds).toBe(400);
    });

    it('should initialize Morph editor when API key available', () => {
      const originalEnv = process.env.MORPH_API_KEY;
      process.env.MORPH_API_KEY = 'test-morph-key';

      const agentWithMorph = new GrokAgent(mockApiKey);
      expect((agentWithMorph as any).morphEditor).toBeDefined();

      process.env.MORPH_API_KEY = originalEnv;
    });

    it('should not initialize Morph editor without API key', () => {
      const originalEnv = process.env.MORPH_API_KEY;
      delete process.env.MORPH_API_KEY;

      const agentWithoutMorph = new GrokAgent(mockApiKey);
      expect((agentWithoutMorph as any).morphEditor).toBeNull();

      if (originalEnv) process.env.MORPH_API_KEY = originalEnv;
    });
  });

  describe('getCurrentDirectory', () => {
    it('should get current directory from bash tool', () => {
      const mockGetDir = vi.fn().mockReturnValue('/test/dir');
      (agent as any).bash.getCurrentDirectory = mockGetDir;

      const dir = agent.getCurrentDirectory();

      expect(mockGetDir).toHaveBeenCalled();
      expect(dir).toBe('/test/dir');
    });
  });

  describe('executeBashCommand', () => {
    it('should execute bash command through bash tool', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ success: true, output: 'command output' });
      (agent as any).bash.execute = mockExecute;

      const result = await agent.executeBashCommand('echo hello');

      expect(mockExecute).toHaveBeenCalledWith('echo hello');
      expect(result.success).toBe(true);
    });
  });

  describe('setModel', () => {
    it('should update model and recreate token counter', () => {
      const originalModel = agent.getCurrentModel();

      agent.setModel('grok-3-fast');

      expect(agent.getCurrentModel()).toBe('grok-3-fast');
      expect(agent.getCurrentModel()).not.toBe(originalModel);
    });
  });

  describe('abortCurrentOperation', () => {
    it('should abort operation if controller exists', () => {
      (agent as any).abortController = new AbortController();
      const abortSpy = vi.spyOn((agent as any).abortController, 'abort');

      agent.abortCurrentOperation();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should handle abort when no controller exists', () => {
      (agent as any).abortController = null;

      expect(() => agent.abortCurrentOperation()).not.toThrow();
    });
  });
});
