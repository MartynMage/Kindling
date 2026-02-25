"""
Kindling Trainer - LoRA fine-tuning sidecar.

Reads a JSON training config from stdin,
streams progress as JSON lines to stdout.
"""

import sys
import json
from .trainer import run_training
from .config import TrainingConfig


def main():
    raw = sys.stdin.readline().strip()
    if not raw:
        emit(status="error", message="No config received")
        sys.exit(1)

    try:
        data = json.loads(raw)
        config = TrainingConfig.from_json(data)
    except (json.JSONDecodeError, TypeError) as e:
        emit(status="error", message=f"Invalid config: {e}")
        sys.exit(1)

    run_training(config)


def emit(**kwargs):
    defaults = {
        "epoch": 0,
        "totalEpochs": 0,
        "step": 0,
        "totalSteps": 0,
        "loss": 0.0,
        "eta": None,
        "status": "training",
        "message": None,
    }
    defaults.update(kwargs)
    print(json.dumps(defaults), flush=True)


if __name__ == "__main__":
    main()
