"""Document ingestion and training data generation."""

import os
import json


MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB per file


def read_documents(folder_path: str) -> list[str]:
    """Read all supported documents from a folder."""
    chunks = []

    for fname in os.listdir(folder_path):
        fpath = os.path.join(folder_path, fname)
        ext = os.path.splitext(fname)[1].lower()

        # Security: skip symlinks and oversized files
        if os.path.islink(fpath):
            continue
        if not os.path.isfile(fpath):
            continue
        if os.path.getsize(fpath) > MAX_FILE_SIZE:
            continue

        if ext in (".txt", ".md"):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Split into paragraphs
                    paragraphs = [
                        p.strip()
                        for p in content.split("\n\n")
                        if len(p.strip()) > 50
                    ]
                    chunks.extend(paragraphs)
            except (OSError, UnicodeDecodeError):
                continue

    return chunks


def chunks_to_training_pairs(
    chunks: list[str],
) -> list[dict]:
    """Convert document chunks into instruction/response training pairs."""
    pairs = []

    for chunk in chunks:
        # Extract first sentence as a topic
        sentences = chunk.split(".")
        if not sentences or len(sentences[0].strip()) < 10:
            continue

        topic = sentences[0].strip()

        # Generate different instruction styles
        pairs.append(
            {
                "instruction": f"Explain the following topic: {topic}",
                "response": chunk,
            }
        )

        if len(sentences) > 2:
            pairs.append(
                {
                    "instruction": f"Summarize this: {chunk[:200]}...",
                    "response": ". ".join(s.strip() for s in sentences[:3] if s.strip())
                    + ".",
                }
            )

    return pairs


def save_training_data(pairs: list[dict], output_path: str):
    """Save training pairs as JSONL."""
    with open(output_path, "w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair) + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m kindling_trainer.data_prep <folder_path>")
        sys.exit(1)

    folder = sys.argv[1]
    chunks = read_documents(folder)
    pairs = chunks_to_training_pairs(chunks)

    output = os.path.join(folder, "training_data.jsonl")
    save_training_data(pairs, output)
    print(f"Generated {len(pairs)} training pairs -> {output}")
