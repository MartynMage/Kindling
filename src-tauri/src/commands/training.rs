use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrainingConfig {
    pub base_model: String,
    pub data_path: String,
    pub output_name: String,
    pub epochs: u32,
    pub learning_rate: f64,
    pub lora_rank: u32,
    pub lora_alpha: u32,
    pub batch_size: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrainingProgressEvent {
    pub epoch: u32,
    pub total_epochs: u32,
    pub step: u32,
    pub total_steps: u32,
    pub loss: f64,
    pub eta: Option<String>,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrainingDataPair {
    pub instruction: String,
    pub response: String,
}

#[derive(Debug, Serialize)]
pub struct TrainingDataResult {
    pub pairs: Vec<TrainingDataPair>,
}

#[tauri::command]
pub async fn start_training(
    app: AppHandle,
    _state: State<'_, AppState>,
    config: TrainingConfig,
) -> Result<(), String> {
    // Emit initial status
    app.emit(
        "training-progress",
        TrainingProgressEvent {
            epoch: 0,
            total_epochs: config.epochs,
            step: 0,
            total_steps: 0,
            loss: 0.0,
            eta: None,
            status: "preparing".to_string(),
            message: Some("Preparing training environment...".to_string()),
        },
    )
    .ok();

    // In production, this spawns the Python sidecar process.
    // The sidecar reads config via stdin and streams progress as JSON lines to stdout.
    // For now, we store the config and prepare for sidecar integration.
    let config_json = serde_json::to_string(&config).map_err(|e| e.to_string())?;

    // Spawn the training process in a background thread
    let app_handle = app.clone();
    tokio::spawn(async move {
        // Look for the sidecar binary
        let sidecar_name = if cfg!(target_os = "windows") {
            "kindling-trainer.exe"
        } else {
            "kindling-trainer"
        };

        // Try to find sidecar in app directory or PATH
        let sidecar_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(sidecar_name)));

        match sidecar_path {
            Some(path) if path.exists() => {
                // Spawn the sidecar process
                let mut child = match tokio::process::Command::new(&path)
                    .stdin(std::process::Stdio::piped())
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn()
                {
                    Ok(c) => c,
                    Err(e) => {
                        app_handle.emit(
                            "training-progress",
                            TrainingProgressEvent {
                                epoch: 0,
                                total_epochs: 0,
                                step: 0,
                                total_steps: 0,
                                loss: 0.0,
                                eta: None,
                                status: "error".to_string(),
                                message: Some(format!("Failed to start trainer: {}", e)),
                            },
                        ).ok();
                        return;
                    }
                };

                // Send config via stdin
                if let Some(mut stdin) = child.stdin.take() {
                    use tokio::io::AsyncWriteExt;
                    stdin.write_all(config_json.as_bytes()).await.ok();
                    stdin.write_all(b"\n").await.ok();
                    drop(stdin);
                }

                // Read stdout for progress updates
                if let Some(stdout) = child.stdout.take() {
                    use tokio::io::{AsyncBufReadExt, BufReader};
                    let reader = BufReader::new(stdout);
                    let mut lines = reader.lines();

                    while let Ok(Some(line)) = lines.next_line().await {
                        if let Ok(progress) =
                            serde_json::from_str::<TrainingProgressEvent>(&line)
                        {
                            app_handle.emit("training-progress", progress).ok();
                        }
                    }
                }

                child.wait().await.ok();
            }
            _ => {
                // Sidecar not found - emit error
                app_handle.emit(
                    "training-progress",
                    TrainingProgressEvent {
                        epoch: 0,
                        total_epochs: 0,
                        step: 0,
                        total_steps: 0,
                        loss: 0.0,
                        eta: None,
                        status: "error".to_string(),
                        message: Some(
                            "Training sidecar not found. Please install the Python training module."
                                .to_string(),
                        ),
                    },
                ).ok();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_training() -> Result<(), String> {
    // In a full implementation, this would signal the sidecar process to stop
    // via a cancellation token or by killing the process
    Ok(())
}

#[tauri::command]
pub async fn generate_training_data(
    _state: State<'_, AppState>,
    documents_path: String,
    _model: String,
) -> Result<TrainingDataResult, String> {
    // Validate and canonicalize path to prevent traversal
    let path = std::path::Path::new(&documents_path);
    let canonical_path = path
        .canonicalize()
        .map_err(|_| "Invalid documents path".to_string())?;

    if !canonical_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Only allow paths from user-accessible directories
    let home_dir = dirs::home_dir().unwrap_or_default();
    if !canonical_path.starts_with(&home_dir) {
        return Err("Documents must be within your home directory".to_string());
    }

    let mut pairs = Vec::new();

    // Read text files and generate basic training pairs
    if let Ok(entries) = std::fs::read_dir(&canonical_path) {
        for entry in entries.flatten() {
            let file_path = entry.path();
            let ext = file_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");

            if !["txt", "md"].contains(&ext) {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(&file_path) {
                // Split into chunks and create Q&A pairs
                let chunks: Vec<&str> = content
                    .split("\n\n")
                    .filter(|c| c.trim().len() > 50)
                    .collect();

                for chunk in chunks.iter().take(10) {
                    let trimmed = chunk.trim();
                    let first_sentence = trimmed
                        .split('.')
                        .next()
                        .unwrap_or(trimmed)
                        .trim();

                    if first_sentence.len() > 10 {
                        pairs.push(TrainingDataPair {
                            instruction: format!(
                                "Explain the following topic: {}",
                                first_sentence
                            ),
                            response: trimmed.to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(TrainingDataResult { pairs })
}
