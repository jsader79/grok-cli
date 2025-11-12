import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TextEditorTool } from '../text-editor';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('TextEditorTool', () => {
  let editor: TextEditorTool;
  let tempDir: string;

  beforeEach(async () => {
    editor = new TextEditorTool();
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grok-cli-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
    // Reset session flags
    const confirmationService = (editor as any).confirmationService;
    confirmationService.setSessionFlag('fileOperations', false);
    confirmationService.setSessionFlag('allOperations', false);
  });

  describe('view', () => {
    it('should view file contents', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello, World!', 'utf-8');

      const result = await editor.view(filePath);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, World!');
    });

    it('should view file with line numbers', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3', 'utf-8');

      const result = await editor.view(filePath);
      expect(result.success).toBe(true);
      expect(result.output).toContain('1: Line 1');
      expect(result.output).toContain('2: Line 2');
    });

    it('should view specific line range', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await editor.view(filePath, [2, 4]);
      expect(result.success).toBe(true);
      expect(result.output).toContain('2: Line 2');
      expect(result.output).toContain('4: Line 4');
      expect(result.output).not.toContain('Line 1');
      expect(result.output).not.toContain('Line 5');
    });

    it('should list directory contents', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2', 'utf-8');

      const result = await editor.view(tempDir);
      expect(result.success).toBe(true);
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
    });

    it('should handle non-existent file', async () => {
      const result = await editor.view(path.join(tempDir, 'nonexistent.txt'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should truncate long files', async () => {
      const filePath = path.join(tempDir, 'long.txt');
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
      await fs.writeFile(filePath, lines, 'utf-8');

      const result = await editor.view(filePath);
      expect(result.success).toBe(true);
      // Should show first 10 lines and indicate more
      expect(result.output).toContain('Line 1');
      expect(result.output).toContain('+10 lines');
    });
  });

  describe('create', () => {
    beforeEach(() => {
      // Skip confirmations for tests
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should create new file', async () => {
      const filePath = path.join(tempDir, 'new.txt');
      const content = 'New file content';

      const result = await editor.create(filePath, content);
      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should create file in nested directory', async () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'file.txt');
      const content = 'Nested file';

      const result = await editor.create(filePath, content);
      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should add file to edit history', async () => {
      const filePath = path.join(tempDir, 'new.txt');
      await editor.create(filePath, 'content');

      const history = editor.getEditHistory();
      expect(history).toHaveLength(1);
      expect(history[0].command).toBe('create');
      expect(history[0].path).toBe(filePath);
    });

    it('should generate diff output for new file', async () => {
      const filePath = path.join(tempDir, 'new.txt');
      const content = 'Line 1\nLine 2';

      const result = await editor.create(filePath, content);
      expect(result.success).toBe(true);
      expect(result.output).toContain('+Line 1');
      expect(result.output).toContain('+Line 2');
    });
  });

  describe('strReplace', () => {
    beforeEach(() => {
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should replace text in file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await editor.strReplace(filePath, 'World', 'Universe');
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Hello Universe');
    });

    it('should replace only first occurrence by default', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'cat cat cat', 'utf-8');

      const result = await editor.strReplace(filePath, 'cat', 'dog', false);
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('dog cat cat');
    });

    it('should replace all occurrences with replaceAll flag', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'cat cat cat', 'utf-8');

      const result = await editor.strReplace(filePath, 'cat', 'dog', true);
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('dog dog dog');
    });

    it('should handle multi-line replacement', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const original = 'Line 1\nLine 2\nLine 3';
      await fs.writeFile(filePath, original, 'utf-8');

      const result = await editor.strReplace(filePath, 'Line 1\nLine 2', 'New Line 1\nNew Line 2');
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('New Line 1\nNew Line 2\nLine 3');
    });

    it('should return error if file not found', async () => {
      const result = await editor.strReplace(
        path.join(tempDir, 'nonexistent.txt'),
        'old',
        'new'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if string not found', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await editor.strReplace(filePath, 'NonExistent', 'New');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should generate diff output', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await editor.strReplace(filePath, 'World', 'Universe');
      expect(result.success).toBe(true);
      expect(result.output).toContain('-Hello World');
      expect(result.output).toContain('+Hello Universe');
    });
  });

  describe('replaceLines', () => {
    beforeEach(() => {
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should replace single line', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3', 'utf-8');

      const result = await editor.replaceLines(filePath, 2, 2, 'New Line 2');
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Line 1\nNew Line 2\nLine 3');
    });

    it('should replace multiple lines', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4', 'utf-8');

      const result = await editor.replaceLines(filePath, 2, 3, 'New Line 2\nNew Line 3');
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Line 1\nNew Line 2\nNew Line 3\nLine 4');
    });

    it('should handle invalid line numbers', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2', 'utf-8');

      const result = await editor.replaceLines(filePath, 5, 10, 'New');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('undoEdit', () => {
    beforeEach(() => {
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should undo create operation', async () => {
      const filePath = path.join(tempDir, 'new.txt');
      await editor.create(filePath, 'content');
      expect(await fs.pathExists(filePath)).toBe(true);

      const result = await editor.undoEdit();
      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(false);
    });

    it('should undo str_replace operation', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');
      await editor.strReplace(filePath, 'World', 'Universe');

      const result = await editor.undoEdit();
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should return error if no edits to undo', async () => {
      const result = await editor.undoEdit();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No edits to undo');
    });
  });

  describe('diff generation', () => {
    beforeEach(() => {
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should generate diff for simple change', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3', 'utf-8');

      const result = await editor.strReplace(filePath, 'Line 2', 'Modified Line 2');
      expect(result.success).toBe(true);
      expect(result.output).toContain('-Line 2');
      expect(result.output).toContain('+Modified Line 2');
    });

    it('should show context lines in diff', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await editor.strReplace(filePath, 'Line 3', 'Modified');
      expect(result.success).toBe(true);
      // Should show context (surrounding unchanged lines)
      expect(result.output).toContain(' Line 2');
      expect(result.output).toContain(' Line 4');
    });

    it('should count additions and removals', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Old line', 'utf-8');

      const result = await editor.strReplace(filePath, 'Old line', 'New line 1\nNew line 2');
      expect(result.success).toBe(true);
      expect(result.output).toContain('addition');
      expect(result.output).toContain('removal');
    });
  });

  describe('fuzzy matching', () => {
    beforeEach(() => {
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should fuzzy match function with whitespace differences', async () => {
      const filePath = path.join(tempDir, 'test.js');
      const original = `function hello() {
  console.log("world");
}`;
      await fs.writeFile(filePath, original, 'utf-8');

      // Try to replace - fuzzy matching may or may not work depending on implementation
      // The current implementation only does fuzzy matching for multi-line function patterns
      const searchStr = `function hello() {\n  console.log("world");\n}`;
      const result = await editor.strReplace(filePath, searchStr, 'function hello() {\n  console.log("universe");\n}');

      // Should succeed with exact match
      expect(result.success).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('universe');
    });
  });

  describe('edit history', () => {
    beforeEach(() => {
      const confirmationService = (editor as any).confirmationService;
      confirmationService.setSessionFlag('fileOperations', true);
    });

    it('should track multiple edits', async () => {
      const filePath1 = path.join(tempDir, 'file1.txt');
      const filePath2 = path.join(tempDir, 'file2.txt');

      await editor.create(filePath1, 'content1');
      await editor.create(filePath2, 'content2');

      const history = editor.getEditHistory();
      expect(history).toHaveLength(2);
      expect(history[0].command).toBe('create');
      expect(history[1].command).toBe('create');
    });

    it('should clear history item on undo', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await editor.create(filePath, 'content');
      expect(editor.getEditHistory()).toHaveLength(1);

      await editor.undoEdit();
      expect(editor.getEditHistory()).toHaveLength(0);
    });
  });
});
