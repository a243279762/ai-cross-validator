🌐 **English** | [中文](README_zh.md)

# AI Cross-Validator

AI still hallucinates. A lot. This tool reduces the risk by sending the same question to multiple independent sessions and automatically analyzing where they agree and disagree.

- 🟢 **Consensus across sessions** → likely reliable
- 🔴 **Disagreement between sessions** → AI is probably making things up
- 🟡 **Mentioned by only one session** → needs further verification

Inspired by the **Delphi Method** — where independent experts answer the same question anonymously, then results are aggregated to find consensus.

## How It Works

1. You enter a question
2. The tool sends it to 2/3/5 completely independent API calls (no shared context)
3. All responses are sent to another session for fusion analysis
4. You get a color-coded summary: consensus, disagreements, and outliers

## Usage

This is a **React Artifact** that runs inside the Claude App (mobile or desktop):

1. In a Claude conversation, ask Claude to create a React artifact with the code from `cross-validate.jsx`
2. The artifact opens in the chat interface
3. Enter your question, select call count (2/3/5), hit send
4. Wait for the fusion analysis

No backend needed. No deployment. Runs entirely inside Claude.

## The Methodology

This tool implements **Path 2** of a broader AI output verification methodology:

| Path | Use Case | Method | Enterprise Equivalent |
|------|----------|--------|-----------------------|
| Path 1 | Complex problems | Hierarchical decomposition + layer-by-layer verification | Red Team, Pre-Mortem, MECE |
| **Path 2** | **Open-ended questions** | **Multi-session cross-validation (this tool)** | **Delphi Method** |
| Path 3 | Hard facts needed | Deterministic verification (papers, authoritative sources) | Due Diligence, Peer Review |

## Tech

- Runtime: Claude App Artifact (React)
- API: Anthropic Messages API (`/v1/messages`)
- Model: Claude Sonnet (lower cost, suitable for multiple calls)
- Zero backend, zero deployment

## License

MIT
