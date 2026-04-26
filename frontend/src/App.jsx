import { useEffect, useMemo, useRef, useState } from "react";
import UploadCard from "./components/UploadCard";

function shortenFileName(name, maxLength = 34) {
  if (!name) return "";
  if (name.length <= maxLength) return name;

  const extension = name.includes(".") ? name.split(".").pop() : "";
  const baseName = name.replace(`.${extension}`, "");

  return `${baseName.slice(0, maxLength - 9)}...${
    extension ? `.${extension}` : ""
  }`;
}

function formatMessage(text) {
  if (!text) return null;

  const cleanedText = text.replace(/\*\*/g, "").trim();

  const lines = cleanedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => {
        const isBullet = /^[-*•]\s+/.test(line);
        const isNumbered = /^\d+\.\s+/.test(line);

        if (isBullet) {
          return (
            <div key={index} className="flex gap-3">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/60" />
              <p>{line.replace(/^[-*•]\s+/, "")}</p>
            </div>
          );
        }

        if (isNumbered) {
          return (
            <div key={index} className="flex gap-3">
              <span className="shrink-0 font-semibold text-sky-300">
                {line.match(/^\d+\./)?.[0]}
              </span>
              <p>{line.replace(/^\d+\.\s+/, "")}</p>
            </div>
          );
        }

        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);

  const preview = source.text_preview || "";
  const shouldClamp = preview.length > 180;

  const scorePercent =
    source.score !== null && source.score !== undefined
      ? Math.round(source.score * 100)
      : null;

  const visiblePreview =
    !expanded && shouldClamp ? `${preview.slice(0, 180)}...` : preview;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-white/[0.04]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            title={source.file_name}
            className="truncate text-sm font-semibold text-sky-200"
          >
            {shortenFileName(source.file_name)}
          </div>

          <div className="mt-1 text-xs text-indigo-300">
            Source {source.rank || index + 1}
            {source.chunk_id ? ` • ${source.chunk_id}` : ""}
            {source.page_number ? ` • Page ${source.page_number}` : ""}
          </div>
        </div>

        <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
          #{source.rank || index + 1}
        </span>
      </div>

      {scorePercent !== null && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-500"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      )}

      <p className="break-words text-xs leading-5 text-slate-400">
        {visiblePreview}
      </p>

      {shouldClamp && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 text-xs font-semibold text-sky-300 transition hover:text-sky-200"
        >
          {expanded ? "Show less" : "Expand source"}
        </button>
      )}
    </div>
  );
}

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sources, setSources] = useState([]);
  const [chatPanelHeight, setChatPanelHeight] = useState(null);

  const leftColumnRef = useRef(null);
  const chatContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isAutoScrollLockedRef = useRef(true);

  const quickPrompts = useMemo(
    () => [
      ["Summarize", "Summarize these documents"],
      ["Key points", "Give key takeaways"],
      ["Simplify", "Explain this in simple terms"],
      ["Compare", "Compare these documents"],
    ],
    [],
  );

  const scrollToBottom = (behavior = "smooth") => {
    const container = chatContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  useEffect(() => {
    const leftColumn = leftColumnRef.current;
    if (!leftColumn) return;

    const updateHeight = () => {
      const nextHeight = Math.ceil(leftColumn.getBoundingClientRect().height);
      setChatPanelHeight(Math.max(nextHeight, 560));
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateHeight);
    });

    resizeObserver.observe(leftColumn);
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [files.length, sources.length]);

  useEffect(() => {
    if (!isAutoScrollLockedRef.current) return;

    requestAnimationFrame(() => {
      scrollToBottom("smooth");
    });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleChatScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    isAutoScrollLockedRef.current = distanceFromBottom < 120;
  };

  const handleFilesChange = (updater) => {
    setFiles((prev) => {
      const updatedFiles =
        typeof updater === "function" ? updater(prev) : updater;

      return updatedFiles;
    });

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setMessages([]);
    setInput("");
    setIsTyping(false);
    setSources([]);
    isAutoScrollLockedRef.current = true;
  };

  const handleQuickAction = (text) => {
    if (files.length === 0 || isTyping) return;
    setInput(text);
  };

  const buildChatHistory = () => {
    return messages.slice(-8).map((message) => ({
      role: message.type === "assistant" ? "assistant" : "user",
      content: message.text,
    }));
  };

  const animateAssistantResponse = (fullText) => {
    let visibleLength = 0;
    let lastTimestamp = performance.now();

    const charactersPerFrame = Math.max(2, Math.ceil(fullText.length / 220));

    const step = (timestamp) => {
      const elapsed = timestamp - lastTimestamp;

      if (elapsed >= 16) {
        visibleLength = Math.min(
          fullText.length,
          visibleLength + charactersPerFrame,
        );

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: fullText.slice(0, visibleLength),
          };
          return updated;
        });

        lastTimestamp = timestamp;
      }

      if (visibleLength < fullText.length) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        setIsTyping(false);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    if (files.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          text: "Please upload a PDF first before asking questions.",
        },
      ]);
      return;
    }

    const currentInput = input.trim();
    const chatHistory = buildChatHistory();

    isAutoScrollLockedRef.current = true;

    setMessages((prev) => [...prev, { type: "user", text: currentInput }]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: currentInput,
          top_k: 5,
          chat_history: chatHistory,
        }),
      });

      const data = await response.json();

      const fullText =
        data.answer || data.message || "No response received from server.";

      setMessages((prev) => [...prev, { type: "assistant", text: "" }]);
      setSources(data.sources || []);

      animateAssistantResponse(fullText);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          text: "Could not connect to the backend. Please make sure the FastAPI server is running.",
        },
      ]);
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050816] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_80%_5%,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.16),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25" />
      </div>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <section className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-300/5 px-4 py-2 text-sm text-sky-200 shadow-[0_0_35px_rgba(56,189,248,0.12)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
            AI Knowledge Assistant
          </div>

          <h1 className="mx-auto max-w-5xl text-4xl font-black leading-[1.1] tracking-tight md:text-6xl">
            Chat with your PDFs using{" "}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300 bg-clip-text text-transparent">
              grounded AI
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-4xl text-sm leading-6 text-slate-400">
            Upload documents, ask questions, generate summaries, compare files,
            and verify answers with source-backed context.
          </p>
        </section>

        <section className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside
            ref={leftColumnRef}
            className="flex min-h-[560px] flex-col gap-5"
          >
            <div className="flex shrink-0 flex-col rounded-[28px] border border-white/10 bg-[#0D1324]/80 p-5 shadow-2xl backdrop-blur-xl transition duration-300 hover:border-sky-300/20 hover:shadow-[0_0_50px_rgba(56,189,248,0.08)]">
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h2 className="text-lg font-bold">Documents</h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    files.length > 0
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-white/5 text-slate-400"
                  }`}
                >
                  {files.length > 0 ? `${files.length} indexed` : "Waiting"}
                </span>
              </div>

              <UploadCard onFilesChange={handleFilesChange} />
            </div>

            <div className="flex min-h-[210px] flex-col rounded-[28px] border border-white/10 bg-[#0D1324]/80 p-5 shadow-2xl backdrop-blur-xl transition duration-300 hover:border-sky-300/20 hover:shadow-[0_0_50px_rgba(56,189,248,0.08)]">
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h2 className="text-lg font-bold">Sources</h2>

                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                  {sources.length} found
                </span>
              </div>

              {sources.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm leading-6 text-slate-500">
                  Retrieved chunks will appear here after you ask a question.
                </div>
              ) : (
                <div className="custom-scrollbar max-h-[250px] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                  {sources.map((src, index) => (
                    <SourceCard
                      key={`${src.file_name}-${src.chunk_id}-${index}`}
                      source={src}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section
            className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#0A1020]/85 shadow-[0_0_90px_rgba(59,130,246,0.14)] backdrop-blur-xl transition duration-300 hover:border-sky-300/20"
            style={
              chatPanelHeight ? { height: `${chatPanelHeight}px` } : undefined
            }
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">AI Chat</h2>

                <p className="text-sm text-slate-500">
                  {files.length > 0
                    ? `Ask anything across ${files.length} uploaded document${
                        files.length > 1 ? "s" : ""
                      }`
                    : "Upload a PDF to unlock the assistant"}
                </p>
              </div>

              <div
                className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                  files.length > 0
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-red-400/10 text-red-300"
                }`}
              >
                {files.length > 0 ? "Ready" : "Locked"}
              </div>
            </div>

            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-300/20 to-indigo-500/20 text-3xl shadow-[0_0_60px_rgba(56,189,248,0.12)]">
                      ✦
                    </div>

                    <h3 className="mb-2 text-2xl font-bold">
                      {files.length > 0
                        ? "Your documents are ready"
                        : "Upload your first PDF"}
                    </h3>

                    <p className="mx-auto max-w-md text-sm leading-6 text-slate-500">
                      {files.length > 0
                        ? "Start with a question, summary, key takeaways, or comparison."
                        : "Once uploaded, the assistant will index your document and answer with sources."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((msg, index) => {
                    const isLastAssistant =
                      index === messages.length - 1 &&
                      msg.type === "assistant" &&
                      isTyping;

                    return (
                      <div
                        key={index}
                        className={`animate-[fadeIn_0.22s_ease-out] flex ${
                          msg.type === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`${
                            msg.type === "user"
                              ? "max-w-[82%] rounded-br-md bg-gradient-to-r from-sky-400 to-indigo-500 text-white shadow-[0_0_25px_rgba(56,189,248,0.25)]"
                              : "w-full max-w-none rounded-bl-md border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-slate-200 backdrop-blur-md"
                          } break-words rounded-[24px] px-5 py-4 text-sm leading-7 shadow-xl transition duration-300`}
                        >
                          {msg.text ? (
                            formatMessage(msg.text)
                          ) : isLastAssistant ? (
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400/60" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400/60 [animation-delay:0.15s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400/60 [animation-delay:0.3s]" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-black/20 p-5">
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {quickPrompts.map(([label, prompt]) => (
                  <button
                    key={label}
                    onClick={() => handleQuickAction(prompt)}
                    disabled={files.length === 0 || isTyping}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-slate-300 transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 rounded-3xl border border-white/10 bg-black/30 p-2 transition duration-300 focus-within:border-sky-300/40 focus-within:shadow-[0_0_30px_rgba(56,189,248,0.12)]">
                <textarea
                  rows={1}
                  value={input}
                  disabled={files.length === 0 || isTyping}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    files.length === 0
                      ? "Upload a PDF first..."
                      : "Ask a question about your documents..."
                  }
                  className="max-h-28 min-h-[48px] min-w-0 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 disabled:cursor-not-allowed"
                />

                <button
                  onClick={handleSend}
                  disabled={files.length === 0 || isTyping || !input.trim()}
                  className="rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-6 py-3 text-sm font-bold text-white shadow-[0_0_25px_rgba(56,189,248,0.35)] transition duration-300 hover:scale-105 hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {isTyping ? "Thinking" : "Send"}
                </button>
              </div>

              <p className="mt-3 text-center text-xs text-slate-600">
                Press Enter to send • Shift + Enter for a new line
              </p>
            </div>
          </section>
        </section>
      </main>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 999px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(125, 211, 252, 0.25);
          border-radius: 999px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(125, 211, 252, 0.4);
        }
      `}</style>
    </div>
  );
}

export default App;
