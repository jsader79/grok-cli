import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Text } from "ink";
import { GrokAgent, ChatEntry } from "../../agent/grok-agent.js";
import { useInputHandler } from "../../hooks/use-input-handler.js";
import { LoadingSpinner } from "./loading-spinner.js";
import { CommandSuggestions } from "./command-suggestions.js";
import { ModelSelection } from "./model-selection.js";
import { ChatHistory } from "./chat-history.js";
import { ChatInput } from "./chat-input.js";
import { MCPStatus } from "./mcp-status.js";
import ConfirmationDialog from "./confirmation-dialog.js";
import {
  ConfirmationService,
  ConfirmationOptions,
} from "../../utils/confirmation-service.js";
import ApiKeyInput from "./api-key-input.js";
import cfonts from "cfonts";

interface ChatInterfaceProps {
  agent?: GrokAgent;
  initialMessage?: string;
}

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({
  agent,
  initialMessage,
}: {
  agent: GrokAgent;
  initialMessage?: string;
}) {
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmationOptions, setConfirmationOptions] =
    useState<ConfirmationOptions | null>(null);
  const scrollRef = useRef<any>();
  const processingStartTime = useRef<number>(0);
  const streamingContentBuffer = useRef<string>("");
  const streamingUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const lastDiagnosticTime = useRef<number>(0);

  const confirmationService = ConfirmationService.getInstance();

  // Wrapped setChatHistory that enforces size limiting
  const sizeLimitedSetChatHistory = useCallback((updater: React.SetStateAction<ChatEntry[]>) => {
    setChatHistory(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Apply size limiting to all updates
      return next.length > 100 ? next.slice(-100) : next;
    });
  }, []);

  // Helper function to add entries to history with size limiting
  const addToHistory = useCallback((entry: ChatEntry | ChatEntry[]) => {
    sizeLimitedSetChatHistory(prev => {
      const newEntries = Array.isArray(entry) ? entry : [entry];
      return [...prev, ...newEntries];
    });
  }, [sizeLimitedSetChatHistory]);

  // Debounced update for streaming content
  const flushStreamingContent = useCallback(() => {
    if (streamingContentBuffer.current) {
      const content = streamingContentBuffer.current;
      streamingContentBuffer.current = "";

      sizeLimitedSetChatHistory((prev) =>
        prev.map((entry, idx) =>
          idx === prev.length - 1 && entry.isStreaming
            ? { ...entry, content: entry.content + content }
            : entry
        )
      );
    }
  }, [sizeLimitedSetChatHistory]);

  const {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    commandSuggestions,
    availableModels,
    autoEditEnabled,
  } = useInputHandler({
    agent,
    chatHistory,
    setChatHistory: sizeLimitedSetChatHistory,
    setIsProcessing,
    setIsStreaming,
    setTokenCount,
    setProcessingTime,
    processingStartTime,
    isProcessing,
    isStreaming,
    isConfirmationActive: !!confirmationOptions,
  });

  useEffect(() => {
    // Only clear console on non-Windows platforms or if not PowerShell
    // Windows PowerShell can have issues with console.clear() causing flickering
    const isWindows = process.platform === "win32";
    const isPowerShell =
      process.env.ComSpec?.toLowerCase().includes("powershell") ||
      process.env.PSModulePath !== undefined;

    if (!isWindows || !isPowerShell) {
      console.clear();
    }

    // Add top padding
    console.log("    ");

    // Generate logo with margin to match Ink paddingX={2}
    const logoOutput = cfonts.render("GROK", {
      font: "3d",
      align: "left",
      colors: ["magenta", "gray"],
      space: true,
      maxLength: "0",
      gradient: ["magenta", "cyan"],
      independentGradient: false,
      transitionGradient: true,
      env: "node",
    });

    // Add horizontal margin (2 spaces) to match Ink paddingX={2}
    const logoLines = (logoOutput as any).string.split("\n");
    logoLines.forEach((line: string) => {
      if (line.trim()) {
        console.log(" " + line); // Add 2 spaces for horizontal margin
      } else {
        console.log(line); // Keep empty lines as-is
      }
    });

    console.log(" "); // Spacing after logo

    setChatHistory([]);
  }, []);

  // Memory diagnostics (only log every 30 seconds to avoid spam)
  useEffect(() => {
    if (!isStreaming) return;

    const diagnosticInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastDiagnosticTime.current >= 30000) {
        lastDiagnosticTime.current = now;
        console.error(`[DEBUG] Chat history size: ${chatHistory.length} entries`);
        console.error(`[DEBUG] Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
      }
    }, 5000); // Check every 5 seconds, but only log every 30 seconds

    return () => clearInterval(diagnosticInterval);
  }, [chatHistory.length, isStreaming]);

  // Cleanup streaming buffer on unmount or when streaming stops
  useEffect(() => {
    if (!isStreaming && streamingUpdateTimer.current) {
      clearTimeout(streamingUpdateTimer.current);
      streamingUpdateTimer.current = null;
      flushStreamingContent();
    }

    return () => {
      if (streamingUpdateTimer.current) {
        clearTimeout(streamingUpdateTimer.current);
        flushStreamingContent();
      }
    };
  }, [isStreaming, flushStreamingContent]);

  // Process initial message if provided (streaming for faster feedback)
  useEffect(() => {
    if (initialMessage && agent) {
      const userEntry: ChatEntry = {
        type: "user",
        content: initialMessage,
        timestamp: new Date(),
      };
      setChatHistory([userEntry]);

      const processInitialMessage = async () => {
        setIsProcessing(true);
        setIsStreaming(true);

        try {
          let streamingEntry: ChatEntry | null = null;
          for await (const chunk of agent.processUserMessageStream(initialMessage)) {
            switch (chunk.type) {
              case "content":
                if (chunk.content) {
                  if (!streamingEntry) {
                    const newStreamingEntry = {
                      type: "assistant" as const,
                      content: chunk.content,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    addToHistory(newStreamingEntry);
                    streamingEntry = newStreamingEntry;
                  } else {
                    // Buffer the content and debounce updates
                    streamingContentBuffer.current += chunk.content;

                    // Clear existing timer
                    if (streamingUpdateTimer.current) {
                      clearTimeout(streamingUpdateTimer.current);
                    }

                    // Schedule flush after 50ms of no new content
                    streamingUpdateTimer.current = setTimeout(() => {
                      flushStreamingContent();
                      streamingUpdateTimer.current = null;
                    }, 50);
                  }
                }
                break;
              case "token_count":
                if (chunk.tokenCount !== undefined) {
                  setTokenCount(chunk.tokenCount);
                }
                break;
              case "tool_calls":
                if (chunk.toolCalls) {
                  // Flush any pending streaming content first
                  if (streamingUpdateTimer.current) {
                    clearTimeout(streamingUpdateTimer.current);
                    streamingUpdateTimer.current = null;
                  }
                  flushStreamingContent();

                  // Stop streaming for the current assistant message
                  sizeLimitedSetChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming
                        ? {
                            ...entry,
                            isStreaming: false,
                            toolCalls: chunk.toolCalls,
                          }
                        : entry
                    )
                  );
                  streamingEntry = null;

                  // Add individual tool call entries to show tools are being executed
                  const toolCallEntries = chunk.toolCalls.map((toolCall) => ({
                    type: "tool_call" as const,
                    content: "Executing...",
                    timestamp: new Date(),
                    toolCall: toolCall,
                  }));
                  addToHistory(toolCallEntries);
                }
                break;
              case "tool_result":
                if (chunk.toolCall && chunk.toolResult) {
                  sizeLimitedSetChatHistory((prev) =>
                    prev.map((entry) => {
                      if (entry.isStreaming) {
                        return { ...entry, isStreaming: false };
                      }
                      if (
                        entry.type === "tool_call" &&
                        entry.toolCall?.id === chunk.toolCall?.id
                      ) {
                        return {
                          ...entry,
                          type: "tool_result",
                          content: chunk.toolResult?.success
                            ? chunk.toolResult?.output || "Success"
                            : chunk.toolResult?.error || "Error occurred",
                          toolResult: chunk.toolResult,
                        };
                      }
                      return entry;
                    })
                  );
                  streamingEntry = null;
                }
                break;
              case "done":
                // Flush any pending streaming content
                if (streamingUpdateTimer.current) {
                  clearTimeout(streamingUpdateTimer.current);
                  streamingUpdateTimer.current = null;
                }
                flushStreamingContent();

                if (streamingEntry) {
                  sizeLimitedSetChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming ? { ...entry, isStreaming: false } : entry
                    )
                  );
                }
                setIsStreaming(false);
                break;
            }
          }
        } catch (error: any) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `Error: ${error.message}`,
            timestamp: new Date(),
          };
          addToHistory(errorEntry);
          setIsStreaming(false);
        }

        setIsProcessing(false);
        processingStartTime.current = 0;
      };

      processInitialMessage();
    }
  }, [initialMessage, agent]);

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on("confirmation-requested", handleConfirmationRequest);

    return () => {
      confirmationService.off(
        "confirmation-requested",
        handleConfirmationRequest
      );
    };
  }, [confirmationService]);

  useEffect(() => {
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
      return;
    }

    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      setProcessingTime(
        Math.floor((Date.now() - processingStartTime.current) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, isStreaming]);

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);

    // Reset processing states when operation is cancelled
    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
  };

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Show tips only when no chat history and no confirmation dialog */}
      {chatHistory.length === 0 && !confirmationOptions && (
        <Box flexDirection="column" marginBottom={2}>
          <Text color="cyan" bold>
            Tips for getting started:
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">
              1. Ask questions, edit files, or run commands.
            </Text>
            <Text color="gray">2. Be specific for the best results.</Text>
            <Text color="gray">
              3. Create GROK.md files to customize your interactions with Grok.
            </Text>
            <Text color="gray">
              4. Press Shift+Tab to toggle auto-edit mode.
            </Text>
            <Text color="gray">5. /help for more information.</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">
          Type your request in natural language. Ctrl+C to clear, 'exit' to
          quit.
        </Text>
      </Box>

      <Box flexDirection="column" ref={scrollRef}>
        <ChatHistory
          entries={chatHistory}
          isConfirmationActive={!!confirmationOptions}
        />
      </Box>

      {/* Show confirmation dialog if one is pending */}
      {confirmationOptions && (
        <ConfirmationDialog
          operation={confirmationOptions.operation}
          filename={confirmationOptions.filename}
          showVSCodeOpen={confirmationOptions.showVSCodeOpen}
          content={confirmationOptions.content}
          onConfirm={handleConfirmation}
          onReject={handleRejection}
        />
      )}

      {!confirmationOptions && (
        <>
          <LoadingSpinner
            isActive={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
          />

          <ChatInput
            input={input}
            cursorPosition={cursorPosition}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
          />

          <Box flexDirection="row" marginTop={1}>
            <Box marginRight={2}>
              <Text color="cyan">
                {autoEditEnabled ? "▶" : "⏸"} auto-edit:{" "}
                {autoEditEnabled ? "on" : "off"}
              </Text>
              <Text color="gray" dimColor>
                {" "}
                (shift + tab)
              </Text>
            </Box>
            <Box marginRight={2}>
              <Text color="yellow">≋ {agent.getCurrentModel()}</Text>
            </Box>
            <MCPStatus />
          </Box>

          <CommandSuggestions
            suggestions={commandSuggestions}
            input={input}
            selectedIndex={selectedCommandIndex}
            isVisible={showCommandSuggestions}
          />

          <ModelSelection
            models={availableModels}
            selectedIndex={selectedModelIndex}
            isVisible={showModelSelection}
            currentModel={agent.getCurrentModel()}
          />
        </>
      )}
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ChatInterface({
  agent,
  initialMessage,
}: ChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<GrokAgent | null>(
    agent || null
  );

  const handleApiKeySet = (newAgent: GrokAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return (
    <ChatInterfaceWithAgent
      agent={currentAgent}
      initialMessage={initialMessage}
    />
  );
}
