"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isUser: boolean;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 用于自动滚动到底部
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      isUser: true,
    };

    const aiPlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isUser: false,
    };

    const newMessages = [...messages, userMessage, aiPlaceholder];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const payloadMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!response.body) throw new Error("没有响应体");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

               const text = decoder.decode(value, { stream: true });
        
        for (let i = 0; i < text.length; i++) {
          aiResponse += text[i];
          
          // 实时检查是否触发了计算暗号
          let displayContent = aiResponse;
          
          // 正则匹配 [CALCULATE: 150, A4, bw, true]
          const regex = /\[CALCULATE:\s*(\d+),\s*(A4|A3),\s*(bw|color),\s*(true|false)\]/i;
          const match = aiResponse.match(regex);

          if (match) {
            // 提取参数
            const pages = parseInt(match[1]);
            const paperSize = match[2].toUpperCase();
            const mode = match[3].toLowerCase();
            const doubleSided = match[4].toLowerCase() === 'true';

            // ！！！精准算价公式！！！
            let pricePerSheet = 0;
            if (paperSize === 'A4') {
              if (mode === 'bw') pricePerSheet = doubleSided ? 0.4 : 0.2;
              else pricePerSheet = doubleSided ? 1.0 : 0.5;
            } else {
              if (mode === 'bw') pricePerSheet = doubleSided ? 0.8 : 0.4;
              else pricePerSheet = doubleSided ? 2.0 : 1.0;
            }

            // 阶梯定价（A4超100页）
            if (paperSize === 'A4' && pages > 100) {
              if (mode === 'bw') pricePerSheet = doubleSided ? 0.24 : 0.12;
              else pricePerSheet = doubleSided ? 0.6 : 0.3;
            }

            // 计算纸张数和总价
            const sheets = doubleSided ? Math.ceil(pages / 2) : pages;
            const totalPrice = (sheets * pricePerSheet).toFixed(2);

            // 把暗号替换成最终给用户看的话
            displayContent = aiResponse.replace(regex, `算下来一共是 **${totalPrice}元**。请去主页上传 PDF 文件，系统会自动生成订单哦~`);
          }

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: displayContent,
            };
            return updated;
          });
          
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      }
    } catch (error) {
      console.error("请求失败:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "哎呀，网络出了点小差，请稍后再试。",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 外层背景：加了一层好看的浅灰渐变
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-gradient-to-br from-gray-50 to-gray-200 sm:p-4 font-sans">
      
      {/* 聊天卡片主体 */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-[85vh] border border-white/50">
        
        {/* 顶部 Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 text-center shrink-0 shadow-sm z-10">
          <div className="font-bold text-lg flex items-center justify-center gap-2">
            <span className="text-2xl">🖨️</span> 兰二-714 AI 助手
          </div>
          <div className="text-xs text-blue-100 mt-1 opacity-90">随时为你解答打印问题</div>
        </div>

        {/* 聊天记录区 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl shadow-inner">
                👋
              </div>
              <p className="text-sm font-medium">你好！我是打印店 AI 助手。</p>
              <p className="text-xs text-gray-300">可以问我：A4双面多少钱？怎么传文件？</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}
              >
                {/* AI 的头像 */}
                {!msg.isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs mr-2 shrink-0 shadow-sm">
                    AI
                  </div>
                )}

                <div
                  className={`max-w-[75%] p-3.5 text-[15px] leading-relaxed shadow-sm ${
                    msg.isUser
                      ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm whitespace-pre-wrap"
                  }`}
                >
                  {/* 如果 AI 还没回复，显示跳跃的小圆点 */}
                  {msg.content === "" && !msg.isUser ? (
                    <div className="flex space-x-1.5 items-center h-5">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部输入框 */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-full pl-5 pr-12 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </form>
          <div className="text-center text-[11px] text-gray-400 mt-3">
            AI 可能会犯错，请核对重要信息。
          </div>
        </div>

      </div>
    </div>
  );
}