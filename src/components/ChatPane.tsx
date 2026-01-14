import { useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { applyDocumentEdits } from "../lib/documentUtils";

interface ChatPaneProps {
  documentId: Id<"documents"> | null;
  documentContent: string;
  onApplyEdit: (newContent: string) => void;
}

export function ChatPane({ documentId, documentContent, onApplyEdit }: ChatPaneProps) {
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const messages = useQuery(
    api.messages.list,
    documentId ? { documentId } : "skip"
  );
  
  const streamChat = useAction(api.ai.streamChat);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!message.trim() || !documentId || isStreaming) return;

    const userMessage = message;
    setMessage("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      // Start streaming
      const response = await streamChat({
        documentId,
        message: userMessage,
        documentContent,
      });
      
      // Apply any document edits
      if (response.edits && response.edits.length > 0) {
        const newContent = applyDocumentEdits(documentContent, response.edits);
        onApplyEdit(newContent);
        toast.success("Document updated by AI");
      }
      
      setStreamingMessage("");
    } catch (error) {
      toast.error("Failed to send message");
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!documentId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a document to start chatting
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b bg-white">
        <h3 className="font-semibold text-lg">AI Assistant</h3>
        <p className="text-sm text-gray-600 mb-2">Ask questions or request edits to your document</p>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setMessage("Create a professional outline")}
            className="px-2 py-1 bg-gray-100 rounded text-gray-700 hover:bg-gray-200"
          >
            Create outline
          </button>
          <button
            onClick={() => setMessage("Improve the writing")}
            className="px-2 py-1 bg-gray-100 rounded text-gray-700 hover:bg-gray-200"
          >
            Improve writing
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.map((msg) => (
          <div
            key={msg._id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "bg-white border shadow-sm"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              <div className={`text-xs mt-2 ${
                msg.role === "user" ? "text-blue-100" : "text-gray-500"
              }`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-white border shadow-sm">
              <div className="whitespace-pre-wrap text-sm">
                {streamingMessage}
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex space-x-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask the AI to help edit your document..."
            className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            disabled={isStreaming}
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || isStreaming}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
