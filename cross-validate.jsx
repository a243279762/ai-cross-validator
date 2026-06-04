import { useState, useRef } from "react";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const FUSION_PROMPT = `你是一个交叉验证分析器。以下是同一个问题的多个独立回答（来自互不相关的session）。

请你：
1. 找出所有回答中一致的观点，合并成一条，前面标 🟢
2. 找出存在分歧或矛盾的观点，前面标 🔴，并说明各方怎么说的
3. 找出只有个别回答提到、其他回答未涉及的观点，前面标 🟡

直接输出结果，不要废话。用中文回答。

原始问题：
{QUESTION}

各独立回答：
{ANSWERS}`;

export default function CrossValidator() {
  const [question, setQuestion] = useState("");
  const [count, setCount] = useState(3);
  const [results, setResults] = useState([]);
  const [fusion, setFusion] = useState("");
  const [loading, setLoading] = useState(false);
  const [fusing, setFusing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef(null);

  const allDone = results.length > 0 && results.every((r) => r.status === "done");

  const sendQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setFusion("");
    setShowRaw(false);
    setResults(Array(count).fill({ text: "", status: "loading" }));

    const controller = new AbortController();
    abortRef.current = controller;

    const collected = [];

    const promises = Array.from({ length: count }, (_, i) =>
      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: question }],
        }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          const text =
            data.content
              ?.filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n") || "（无返回内容）";
          collected[i] = text;
          setResults((prev) => {
            const next = [...prev];
            next[i] = { text, status: "done" };
            return next;
          });
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            collected[i] = null;
            setResults((prev) => {
              const next = [...prev];
              next[i] = { text: `错误: ${err.message}`, status: "error" };
              return next;
            });
          }
        })
    );

    await Promise.allSettled(promises);
    setLoading(false);

    // Auto-fuse if all succeeded
    const valid = collected.filter(Boolean);
    if (valid.length >= 2) {
      await runFusion(valid);
    }
  };

  const runFusion = async (texts) => {
    setFusing(true);
    const answersText = texts
      .map((t, i) => `--- 回答 ${i + 1} ---\n${t}`)
      .join("\n\n");
    const prompt = FUSION_PROMPT
      .replace("{QUESTION}", question)
      .replace("{ANSWERS}", answersText);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text =
        data.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n") || "（融合失败）";
      setFusion(text);
    } catch (err) {
      setFusion(`融合出错: ${err.message}`);
    }
    setFusing(false);
  };

  const handleCancel = () => {
    if (abortRef.current) abortRef.current.abort();
    setLoading(false);
  };

  const statusIcon = (s) =>
    s === "loading" ? "⏳" : s === "error" ? "❌" : "✅";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>集成验证</h1>
        <p style={styles.subtitle}>
          同一问题独立调用 {count} 次 → 自动融合分析
        </p>
      </div>

      <div style={styles.inputArea}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="输入你要验证的问题..."
          style={styles.textarea}
          rows={3}
        />
        <div style={styles.controls}>
          <div style={styles.countControl}>
            <label style={styles.label}>次数</label>
            <div style={styles.countButtons}>
              {[2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  style={{
                    ...styles.countBtn,
                    ...(count === n ? styles.countBtnActive : {}),
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <button onClick={handleCancel} style={styles.cancelBtn}>
              取消
            </button>
          ) : (
            <button
              onClick={sendQuery}
              disabled={!question.trim()}
              style={{
                ...styles.sendBtn,
                ...(!question.trim() ? styles.sendBtnDisabled : {}),
              }}
            >
              发送验证
            </button>
          )}
        </div>
      </div>

      {/* Fusion result - shown first */}
      {fusing && (
        <div style={styles.fusionCard}>
          <div style={styles.fusionHeader}>
            <span style={styles.fusionLabel}>⏳ 正在融合分析...</span>
          </div>
          <div style={styles.fusionBody}>
            <div style={styles.loadingDots}>比对各回答差异中...</div>
          </div>
        </div>
      )}

      {fusion && !fusing && (
        <div style={styles.fusionCard}>
          <div style={styles.fusionHeader}>
            <span style={styles.fusionLabel}>📊 融合分析结果</span>
          </div>
          <div style={styles.fusionBody}>
            <pre style={styles.fusionText}>{fusion}</pre>
          </div>
        </div>
      )}

      {/* Toggle raw results */}
      {results.length > 0 && (
        <button
          onClick={() => setShowRaw(!showRaw)}
          style={styles.toggleBtn}
        >
          {showRaw ? "收起原始回答 ▲" : `查看 ${results.length} 条原始回答 ▼`}
        </button>
      )}

      {showRaw && results.length > 0 && (
        <div style={styles.results}>
          {results.map((r, i) => (
            <div key={i} style={styles.resultCard}>
              <div style={styles.resultHeader}>
                <span style={styles.resultLabel}>
                  {statusIcon(r.status)} 回答 {i + 1}
                </span>
              </div>
              <div style={styles.resultBody}>
                {r.status === "loading" ? (
                  <div style={styles.loadingDots}>请求中...</div>
                ) : (
                  <pre style={styles.resultText}>{r.text}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0a0a0b",
    color: "#e0e0e0",
    fontFamily: "'IBM Plex Sans', 'Noto Sans SC', sans-serif",
    padding: "20px 16px",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 6px 0",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 13,
    color: "#888",
    margin: 0,
  },
  inputArea: {
    marginBottom: 20,
  },
  textarea: {
    width: "100%",
    background: "#141416",
    border: "1px solid #2a2a2e",
    borderRadius: 10,
    color: "#e0e0e0",
    fontSize: 15,
    padding: "12px 14px",
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    lineHeight: 1.5,
  },
  controls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  countControl: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#888",
  },
  countButtons: {
    display: "flex",
    gap: 4,
  },
  countBtn: {
    width: 36,
    height: 32,
    border: "1px solid #2a2a2e",
    borderRadius: 6,
    background: "#141416",
    color: "#aaa",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  countBtnActive: {
    background: "#2563eb",
    borderColor: "#2563eb",
    color: "#fff",
    fontWeight: 600,
  },
  sendBtn: {
    padding: "8px 20px",
    background: "#2563eb",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  sendBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  cancelBtn: {
    padding: "8px 20px",
    background: "#dc2626",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  fusionCard: {
    background: "#0f1a2e",
    border: "1px solid #1e3a5f",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },
  fusionHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid #1e3a5f",
    background: "#0c1524",
  },
  fusionLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#60a5fa",
  },
  fusionBody: {
    padding: "14px",
  },
  fusionText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.75,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#e0e8f0",
    fontFamily: "inherit",
  },
  toggleBtn: {
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: "1px solid #2a2a2e",
    borderRadius: 8,
    color: "#666",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 12,
  },
  results: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  resultCard: {
    background: "#141416",
    border: "1px solid #2a2a2e",
    borderRadius: 10,
    overflow: "hidden",
  },
  resultHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid #1e1e22",
    background: "#18181b",
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#ccc",
  },
  resultBody: {
    padding: "12px 14px",
  },
  resultText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#d4d4d4",
    fontFamily: "inherit",
  },
  loadingDots: {
    color: "#666",
    fontSize: 14,
  },
};
