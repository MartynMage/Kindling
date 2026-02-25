# Kindling

A cross-platform desktop app for chatting with local LLMs and fine-tuning them on your own data. Everything runs on your machine — no cloud, no API keys, complete privacy.

## Features

- **Local Chat** — Stream responses from locally-running models via Ollama
- **Model Management** — Browse, download, and switch between models
- **Conversation History** — Persistent chat history stored in SQLite
- **System Prompts** — Create reusable personas and instructions
- **LoRA Fine-Tuning** — Train models on your own documents with a guided wizard
- **Hardware Detection** — Auto-detect GPU/RAM and get model size recommendations

## Tech Stack

- **Desktop**: [Tauri](https://tauri.app/) (Rust)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Inference**: [Ollama](https://ollama.com/)
- **Fine-tuning**: Python (HuggingFace Transformers + PEFT)
- **Storage**: SQLite (via rusqlite)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Ollama](https://ollama.com/) (installed and running)

## Development

```bash
# Install dependencies
npm install

# Run in development mode (starts both Vite + Tauri)
npm run tauri dev

# Build for production
npm run tauri build
```

## Fine-Tuning Setup

The fine-tuning feature requires Python 3.10+ with ML dependencies:

```bash
cd sidecar
pip install -r requirements.txt
```

For GPU-accelerated training, ensure you have CUDA-compatible PyTorch installed.

## License

MIT
