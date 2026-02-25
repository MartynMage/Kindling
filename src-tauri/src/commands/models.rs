use crate::ollama::{OllamaClient, PullProgress};
use crate::AppState;
use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelResponse {
    pub name: String,
    pub modified_at: String,
    pub size: u64,
    pub digest: String,
    pub details: ModelDetailsResponse,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDetailsResponse {
    pub format: String,
    pub family: String,
    pub parameter_size: String,
    pub quantization_level: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ModelPullProgressEvent {
    pub status: String,
    pub digest: Option<String>,
    pub total: Option<u64>,
    pub completed: Option<u64>,
}

#[tauri::command]
pub async fn list_models(
    state: State<'_, AppState>,
) -> Result<Vec<ModelResponse>, String> {
    let url = state.ollama_url.lock().map_err(|_| "Internal error: lock failed".to_string())?.clone();
    let client = OllamaClient::new(&url, state.client.clone());
    let models = client.list_models().await.map_err(|e| e.to_string())?;

    Ok(models
        .into_iter()
        .map(|m| ModelResponse {
            name: m.name,
            modified_at: m.modified_at,
            size: m.size,
            digest: m.digest,
            details: ModelDetailsResponse {
                format: m.details.format,
                family: m.details.family,
                parameter_size: m.details.parameter_size,
                quantization_level: m.details.quantization_level,
            },
        })
        .collect())
}

#[tauri::command]
pub async fn pull_model(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<(), String> {
    // Reset pull cancellation flag
    {
        let mut cancelled = state.pull_cancelled.lock().map_err(|_| "Internal error: lock failed".to_string())?;
        *cancelled = false;
    }

    let url = state.ollama_url.lock().map_err(|_| "Internal error: lock failed".to_string())?.clone();
    let client = OllamaClient::new(&url, state.client.clone());
    let response = client.pull_model(&name).await.map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        // Check cancellation
        {
            let cancelled = state.pull_cancelled.lock().unwrap_or_else(|e| e.into_inner());
            if *cancelled {
                app.emit(
                    "model-pull-progress",
                    ModelPullProgressEvent {
                        status: "cancelled".to_string(),
                        digest: None,
                        total: None,
                        completed: None,
                    },
                ).ok();
                return Ok(());
            }
        }

        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                buffer.push_str(&text);

                while let Some(newline_pos) = buffer.find('\n') {
                    let line = buffer[..newline_pos].to_string();
                    buffer = buffer[newline_pos + 1..].to_string();

                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(progress) = serde_json::from_str::<PullProgress>(trimmed) {
                        app.emit(
                            "model-pull-progress",
                            ModelPullProgressEvent {
                                status: progress.status,
                                digest: progress.digest,
                                total: progress.total,
                                completed: progress.completed,
                            },
                        )
                        .ok();
                    }
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_pull(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut cancelled = state
        .pull_cancelled
        .lock()
        .map_err(|_| "Internal error: failed to acquire lock".to_string())?;
    *cancelled = true;
    Ok(())
}

#[tauri::command]
pub async fn delete_model(
    state: State<'_, AppState>,
    name: String,
) -> Result<(), String> {
    let url = state.ollama_url.lock().map_err(|_| "Internal error: lock failed".to_string())?.clone();
    let client = OllamaClient::new(&url, state.client.clone());
    client
        .delete_model(&name)
        .await
        .map_err(|e| e.to_string())
}
