"""Core LoRA training pipeline."""

import json
import sys
import time
import os

from .config import TrainingConfig


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


def run_training(config: TrainingConfig):
    emit(status="preparing", message="Loading dependencies...")

    try:
        import torch
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            TrainingArguments,
            Trainer,
        )
        from peft import LoraConfig, get_peft_model, TaskType
        from datasets import Dataset
    except ImportError as e:
        emit(status="error", message=f"Missing dependency: {e}")
        return

    emit(status="preparing", message="Checking hardware...")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    emit(
        status="preparing",
        message=f"Using device: {device}"
        + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""),
    )

    # Load training data
    emit(status="preparing", message="Loading training data...")
    data_path = config.data_path
    training_data = []

    if os.path.isdir(data_path):
        # Read JSONL files from directory
        for fname in os.listdir(data_path):
            fpath = os.path.join(data_path, fname)
            if fname.endswith(".jsonl"):
                with open(fpath, "r", encoding="utf-8") as f:
                    for line in f:
                        try:
                            training_data.append(json.loads(line.strip()))
                        except json.JSONDecodeError:
                            continue
    elif os.path.isfile(data_path) and data_path.endswith(".jsonl"):
        with open(data_path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    training_data.append(json.loads(line.strip()))
                except json.JSONDecodeError:
                    continue

    if not training_data:
        emit(status="error", message="No training data found")
        return

    emit(
        status="preparing",
        message=f"Loaded {len(training_data)} training examples",
    )

    # Load model and tokenizer
    emit(status="preparing", message=f"Loading model: {config.base_model}...")
    model_name = config.base_model

    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None,
        )
    except Exception as e:
        emit(status="error", message=f"Failed to load model: {e}")
        return

    # Configure LoRA
    emit(status="preparing", message="Applying LoRA configuration...")

    target_modules = config.target_modules
    if not target_modules:
        # Auto-detect target modules
        target_modules = ["q_proj", "v_proj", "k_proj", "o_proj"]

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=config.lora_rank,
        lora_alpha=config.lora_alpha,
        lora_dropout=0.05,
        target_modules=target_modules,
    )

    model = get_peft_model(model, lora_config)
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    emit(
        status="preparing",
        message=f"Trainable parameters: {trainable_params:,} / {total_params:,} "
        f"({100 * trainable_params / total_params:.2f}%)",
    )

    # Prepare dataset
    def format_example(example):
        text = f"### Instruction:\n{example['instruction']}\n\n### Response:\n{example['response']}"
        tokens = tokenizer(
            text,
            truncation=True,
            max_length=512,
            padding="max_length",
        )
        tokens["labels"] = tokens["input_ids"].copy()
        return tokens

    dataset = Dataset.from_list(training_data)
    tokenized_dataset = dataset.map(format_example, remove_columns=dataset.column_names)

    total_steps = (len(tokenized_dataset) // config.batch_size) * config.epochs

    # Training arguments
    output_dir = os.path.join(
        os.path.dirname(data_path) if os.path.isfile(data_path) else data_path,
        "output",
        config.output_name,
    )

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=config.epochs,
        per_device_train_batch_size=config.batch_size,
        learning_rate=config.learning_rate,
        fp16=device == "cuda",
        logging_steps=1,
        save_strategy="epoch",
        report_to="none",
        remove_unused_columns=False,
    )

    # Custom callback for progress reporting
    from transformers import TrainerCallback

    class ProgressCallback(TrainerCallback):
        def __init__(self):
            self.start_time = None

        def on_train_begin(self, args, state, control, **kwargs):
            self.start_time = time.time()

        def on_log(self, args, state, control, logs=None, **kwargs):
            if logs and "loss" in logs:
                elapsed = time.time() - self.start_time if self.start_time else 0
                steps_done = state.global_step
                if steps_done > 0 and elapsed > 0:
                    steps_remaining = total_steps - steps_done
                    time_per_step = elapsed / steps_done
                    eta_seconds = int(steps_remaining * time_per_step)
                    minutes, seconds = divmod(eta_seconds, 60)
                    eta = f"{minutes}m {seconds}s"
                else:
                    eta = None

                current_epoch = int(state.epoch) if state.epoch else 0

                emit(
                    epoch=current_epoch + 1,
                    totalEpochs=config.epochs,
                    step=steps_done,
                    totalSteps=total_steps,
                    loss=round(logs["loss"], 4),
                    eta=eta,
                    status="training",
                    message=f"Step {steps_done}/{total_steps} | Loss: {logs['loss']:.4f}",
                )

    # Start training
    emit(status="training", message="Starting training loop...")

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        callbacks=[ProgressCallback()],
    )

    try:
        trainer.train()
    except Exception as e:
        emit(status="error", message=f"Training failed: {e}")
        return

    # Save the adapter
    emit(status="saving", message="Saving LoRA adapter weights...")
    adapter_path = os.path.join(output_dir, "adapter")
    model.save_pretrained(adapter_path)
    tokenizer.save_pretrained(adapter_path)

    # Create Ollama Modelfile
    emit(status="registering", message="Creating Ollama model...")
    modelfile_path = os.path.join(output_dir, "Modelfile")
    with open(modelfile_path, "w") as f:
        f.write(f"FROM {config.base_model}\n")
        f.write(f"ADAPTER {adapter_path}\n")

    # Register with Ollama
    try:
        import subprocess

        result = subprocess.run(
            ["ollama", "create", config.output_name, "-f", modelfile_path],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            emit(
                status="error",
                message=f"Failed to register model with Ollama: {result.stderr}",
            )
            return
    except Exception as e:
        emit(
            status="error",
            message=f"Could not register with Ollama: {e}. You can manually run: ollama create {config.output_name} -f {modelfile_path}",
        )
        return

    emit(
        status="complete",
        message=f"Training complete! Model '{config.output_name}' is ready to use.",
        epoch=config.epochs,
        totalEpochs=config.epochs,
        step=total_steps,
        totalSteps=total_steps,
    )
