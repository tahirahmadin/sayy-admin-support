import React, { useState, useRef, useEffect } from "react";
import { getAdminSupportLogs, updateAdminChatLog } from "../lib/serverActions";

const CHATS_PER_PAGE = 5;

const Support: React.FC = () => {
  const [page, setPage] = useState(1);
  const [chatLogs, setChatLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat logs on mount
  useEffect(() => {
    setLoading(true);
    getAdminSupportLogs()
      .then((logs) => {
        setChatLogs(logs || []);
        setSelectedLog((logs && logs[0]) || null);
      })
      .finally(() => setLoading(false));
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

    const newMessage = {
      sender: "support",
      content: messageInput.trim(),
      timestamp: new Date().toISOString(),
    };

    await updateAdminChatLog({
      newUserLog: [newMessage],
      clientId: selectedLog.clientId,
    });

    // Clear input after sending
    setMessageInput("");

    // Refresh logs after update
    const logs = await getAdminSupportLogs();
    setChatLogs(logs || []);
    const updatedLog = logs.find((log: any) => log._id === selectedLog._id);
    setSelectedLog(updatedLog || logs[0] || null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col h-full bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Support Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : paginatedLogs.length === 0 ? (
            <div className="p-4 text-gray-500">No chat logs found.</div>
          ) : (
            paginatedLogs.map((log) => (
              <div
                key={log._id}
                className={`p-3 cursor-pointer border-b border-gray-100 transition-colors duration-150
                  ${
                    selectedLog && selectedLog._id === log._id
                      ? "bg-indigo-50 border-l-4 border-indigo-500"
                      : "hover:bg-gray-50"
                  }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800 truncate">
                    {log.chatTitle}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {log.userLogs.length > 0 &&
                    new Date(
                      log.userLogs[log.userLogs.length - 1].timestamp
                    ).toLocaleString()}
                </div>
              </div>
            ))
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
