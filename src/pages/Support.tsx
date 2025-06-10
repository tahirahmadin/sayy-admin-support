import React, { useState, useRef, useEffect } from "react";
import { getAdminSupportLogs, updateAdminChatLog } from "../lib/serverActions";
import { backendSocketUrl } from "../utils/constants";

const CHATS_PER_PAGE = 5;
const WS_RECONNECT_DELAY = 2000;

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
}

interface ChatLog {
  _id: string;
  clientId: string;
  chatTitle: string;
  userLogs: Message[];
  hasUnread?: boolean;
}

const Support: React.FC = () => {
  const [page, setPage] = useState(1);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ChatLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const connectWebSocket = () => {
    // Prevent multiple connection attempts
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected, skipping new connection");
      return;
    }

    // If we're already trying to connect, don't try again
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket connection in progress, skipping new connection");
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      console.log("Closing existing WebSocket connection");
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Create new WebSocket connection
      const wsUrl = `${backendSocketUrl}/socket.io/?client-id=support`;
      console.log("Attempting to connect to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let connectionTimeout: NodeJS.Timeout;

      ws.onopen = () => {
        console.log("WebSocket connection established successfully");
        setIsOnline(true);
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
        // Clear connection timeout
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setIsOnline(false);
        wsRef.current = null;

        // Clear connection timeout
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
        }

        // Only attempt to reconnect if:
        // 1. The connection was lost unexpectedly (not a clean close)
        // 2. We're not already trying to reconnect
        // 3. The component is still mounted
        if (
          !reconnectTimeoutRef.current &&
          event.code !== 1000 &&
          !event.wasClean
        ) {
          console.log("Scheduling reconnection attempt...");
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Executing scheduled reconnection...");
            reconnectTimeoutRef.current = undefined;
            connectWebSocket();
          }, WS_RECONNECT_DELAY);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error occurred:", error);
        setIsOnline(false);
      };

      // Set a connection timeout
      connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("WebSocket connection timeout");
          ws.close();
        }
      }, 10000); // 10 second timeout

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received WebSocket message:", data);

          if (data.clientId && data.message && data.type === "chatUpdated") {
            // Update the selected log with the new message
            const newMessage: Message = {
              content: data.message.content,
              sender: data.message.sender,
              timestamp: new Date(data.message.timestamp),
            };

            // Update the selected log if it matches
            setSelectedLog((prev) => {
              if (!prev || prev.clientId !== data.clientId) return prev;
              return {
                ...prev,
                userLogs: [...prev.userLogs, newMessage],
                hasUnread: false,
              };
            });

            // Update the chat logs list
            setChatLogs((prev) =>
              prev.map((log) =>
                log.clientId === data.clientId
                  ? {
                      ...log,
                      userLogs: [...log.userLogs, newMessage],
                      hasUnread: log.clientId !== selectedLog?.clientId,
                    }
                  : log
              )
            );

            // Scroll to bottom when new message arrives
            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      setIsOnline(false);
    }
  };

  // WebSocket connection on component mount
  useEffect(() => {
    console.log("Initializing WebSocket connection");
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      console.log("Cleaning up WebSocket connection");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Fetch chat logs on mount
  useEffect(() => {
    // Create new AbortController for this effect
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        const logs = await getAdminSupportLogs();
        if (!signal.aborted) {
          console.log("logs", logs);
          setChatLogs(logs || []);
          setSelectedLog((logs && logs[0]) || null);
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Error fetching logs:", error);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Pagination logic
  const totalPages = Math.ceil(chatLogs.length / CHATS_PER_PAGE);
  const paginatedLogs = chatLogs.slice(
    (page - 1) * CHATS_PER_PAGE,
    page * CHATS_PER_PAGE
  );

  // Scroll to bottom on chat change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedLog]);

  const handleSendMessage = async () => {
    if (!selectedLog || !messageInput.trim()) return;

    const newMessage: Message = {
      sender: "support",
      content: messageInput.trim(),
      timestamp: new Date(),
    };

    try {
      // Update the UI immediately for better UX
      setSelectedLog((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          userLogs: [...prev.userLogs, newMessage],
        };
      });

      // Update the chat logs list immediately
      setChatLogs((prev) =>
        prev.map((log) =>
          log.clientId === selectedLog.clientId
            ? {
                ...log,
                userLogs: [...log.userLogs, newMessage],
              }
            : log
        )
      );

      // Clear input after sending
      setMessageInput("");

      // Send to server
      await updateAdminChatLog({
        newUserLog: [
          {
            ...newMessage,
            timestamp: newMessage.timestamp.toISOString(), // Convert to ISO string for server
          },
        ],
        clientId: selectedLog.clientId,
      });

      // Refresh logs after update to ensure consistency
      const logs = await getAdminSupportLogs();
      setChatLogs(logs || []);
      const updatedLog = logs.find((log: any) => log._id === selectedLog._id);
      setSelectedLog(updatedLog || logs[0] || null);
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally show an error message to the user
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectChat = (log: ChatLog) => {
    setSelectedLog(log);
    // Clear unread status when selecting a chat
    setChatLogs((prev) =>
      prev.map((chat) =>
        chat.clientId === log.clientId ? { ...chat, hasUnread: false } : chat
      )
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col h-full bg-white">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Support Chats</h2>
          <div
            className={`w-2 h-2 rounded-full ${
              isOnline ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : paginatedLogs.length === 0 ? (
            <div className="p-4 text-gray-500">No chat logs found.</div>
          ) : (
            paginatedLogs.map((log) => {
              const lastMessage = log.userLogs[log.userLogs.length - 1];
              const lastMessageTime = lastMessage
                ? new Date(lastMessage.timestamp)
                : null;

              return (
                <div
                  key={log._id}
                  className={`p-3 cursor-pointer border-b border-gray-100 transition-all duration-300 relative
                    ${
                      selectedLog && selectedLog._id === log._id
                        ? "bg-indigo-50 border-l-4 border-indigo-500"
                        : "hover:bg-gray-50"
                    }
                    ${
                      log.hasUnread
                        ? "bg-blue-50 border-l-4 border-blue-500 animate-pulse-subtle"
                        : ""
                    }
                  `}
                  onClick={() => handleSelectChat(log)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-800 truncate">
                          {log.chatTitle}
                        </span>
                        {log.hasUnread && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            New
                          </span>
                        )}
                      </div>
                      {lastMessage && (
                        <div className="mt-1 text-sm text-gray-600 truncate">
                          <span className="font-medium">
                            {lastMessage.sender}:{" "}
                          </span>
                          {lastMessage.content}
                        </div>
                      )}
                    </div>
                    {log.hasUnread && (
                      <div className="flex items-center space-x-2 ml-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                    {lastMessageTime && (
                      <span className="text-gray-500">
                        {lastMessageTime.toLocaleDateString()} at{" "}
                        {lastMessageTime.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {log.hasUnread && (
                      <span className="text-blue-600 text-xs font-medium">
                        Unread message
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-2 flex justify-between items-center border-t border-gray-200 bg-gray-50">
          <button
            className="px-2 py-1 text-gray-600 hover:text-indigo-600 rounded disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            className="px-2 py-1 text-gray-600 hover:text-indigo-600 rounded disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col h-full bg-gray-50">
        {selectedLog ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
              {selectedLog.userLogs.map((msg: any, idx: number) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.sender === "support" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-lg px-4 py-2 rounded-lg ${
                      msg.sender === "support"
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-800 shadow-sm"
                    }`}
                  >
                    <div className="text-sm">{msg.content}</div>
                    <div
                      className={`text-xs mt-1 ${
                        msg.sender === "support"
                          ? "text-indigo-100"
                          : "text-gray-500"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 p-2 border border-gray-200 rounded-lg text-black bg-white"
                />
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
};

export default Support;
