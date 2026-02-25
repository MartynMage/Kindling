from dataclasses import dataclass, field


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

    # Derived from camelCase JSON keys
    def __post_init__(self):
        # Handle camelCase from Tauri
        for attr in list(vars(self)):
            camel = attr
            snake = ""
            for c in camel:
                if c.isupper():
                    snake += "_" + c.lower()
                else:
                    snake += c
            if snake != attr and hasattr(self, camel):
                setattr(self, snake, getattr(self, camel))
