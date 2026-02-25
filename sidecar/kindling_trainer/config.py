import re
from dataclasses import dataclass, field


def camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", name).lower()


@dataclass
class TrainingConfig:
    base_model: str = ""
    data_path: str = ""
    output_name: str = "finetuned-model"
    epochs: int = 3
    learning_rate: float = 2e-4
    lora_rank: int = 16
    lora_alpha: int = 32
    batch_size: int = 4

    # LoRA target modules (auto-detected if empty)
    target_modules: list = field(default_factory=list)

    def __post_init__(self):
        # Validate numeric params
        if self.batch_size < 1:
            self.batch_size = 1
        if self.epochs < 1:
            self.epochs = 1
        if self.lora_rank < 1:
            self.lora_rank = 8
        if self.learning_rate <= 0:
            self.learning_rate = 2e-4

        # Sanitize output_name to prevent path traversal / command injection
        if self.output_name:
            self.output_name = re.sub(r"[^a-zA-Z0-9_\-.]", "", self.output_name)
        if not self.output_name:
            self.output_name = "finetuned-model"

    @classmethod
    def from_json(cls, data: dict) -> "TrainingConfig":
        """Create from JSON dict, handling camelCase keys from Tauri."""
        snake_data = {camel_to_snake(k): v for k, v in data.items()}
        # Filter to only known fields
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in snake_data.items() if k in known_fields}
        return cls(**filtered)
