use crate::ollama::{ChatMessage, OllamaClient, ChatStreamChunk};
use crate::AppState;
use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Clone)]
pub struct ChatStreamEvent {
    pub token: Option<String>,
    pub done: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    conversation_id: String,
    content: String,
    model: String,
    system_prompt: Option<String>,
) -> Result<(), String> {
    let ollama_url = state
        .ollama_url
        .lock()
        .map_err(|_| "Internal error: failed to acquire lock".to_string())?
        .clone();

    // Save user message to database
    {
        let db = state
            .db
            .lock()
            .map_err(|_| "Internal error: failed to acquire database lock".to_string())?;
        db.add_message(&conversation_id, "user", &content, None)
            .map_err(|e| e.to_string())?;
    }

    // Build message history
    let messages = {
        let db = state
            .db
            .lock()
            .map_err(|_| "Internal error: failed to acquire database lock".to_string())?;
        let db_messages = db
            .get_messages(&conversation_id)
            .map_err(|e| e.to_string())?;

        let mut chat_messages = Vec::new();

        if let Some(ref prompt) = system_prompt {
            chat_messages.push(ChatMessage {
                role: "system".to_string(),
                content: prompt.clone(),
            });
        }

        for msg in &db_messages {
            chat_messages.push(ChatMessage {
                role: msg.role.clone(),
                content: msg.content.clone(),
            });
        }

        chat_messages
    };

    // Stream response from Ollama
    let client = OllamaClient::new(&ollama_url);
    let response = client
        .chat_stream(&model, messages)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    let mut full_response = String::new();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                buffer.push_str(&text);

                // Process complete lines from the buffer
                while let Some(newline_pos) = buffer.find('\n') {
                    let line = buffer[..newline_pos].to_string();
                    buffer = buffer[newline_pos + 1..].to_string();

                    if line.trim().is_empty() {
                        continue;
                    }

                    if let Ok(chunk) = serde_json::from_str::<ChatStreamChunk>(&line) {
                        if let Some(ref msg) = chunk.message {
                            full_response.push_str(&msg.content);
                            app.emit(
                                "chat-stream",
                                ChatStreamEvent {
                                    token: Some(msg.content.clone()),
                                    done: false,
                                    error: None,
                                },
                            )
                            .ok();
                        }
                        if chunk.done {
                            // Only save non-empty responses
                            if !full_response.trim().is_empty() {
                                let db = state.db.lock().map_err(|_| {
                                    "Internal error: failed to acquire database lock".to_string()
                                })?;
                                db.add_message(
                                    &conversation_id,
                                    "assistant",
                                    &full_response,
                                    Some(&model),
                                )
                                .map_err(|e| format!("Failed to save message: {}", e))?;

                                // Auto-title if this is the first exchange
                                if let Ok(messages) = db.get_messages(&conversation_id) {
                                    if messages.len() <= 2 {
                                        if let Ok(Some(convo)) =
                                            db.get_conversation(&conversation_id)
                                        {
                                            if convo.title == "New conversation" {
                                                let title = generate_title(&content);
                                                db.rename_conversation(&conversation_id, &title)
                                                    .ok();
                                            }
                                        }
                                    }
                                }
                            }

                            app.emit(
                                "chat-stream",
                                ChatStreamEvent {
                                    token: None,
                                    done: true,
                                    error: None,
                                },
                            )
                            .ok();
                        }
                    }
                }
            }
            Err(e) => {
                app.emit(
                    "chat-stream",
                    ChatStreamEvent {
                        token: None,
                        done: true,
                        error: Some(e.to_string()),
                    },
                )
                .ok();
                return Err(e.to_string());
            }
        }
    }

    // Process any remaining data in the buffer
    if !buffer.trim().is_empty() {
        if let Ok(chunk) = serde_json::from_str::<ChatStreamChunk>(buffer.trim()) {
            if let Some(ref msg) = chunk.message {
                full_response.push_str(&msg.content);
                app.emit(
                    "chat-stream",
                    ChatStreamEvent {
                        token: Some(msg.content.clone()),
                        done: false,
                        error: None,
                    },
                )
                .ok();
            }
        }
    }

    Ok(())
}

fn generate_title(first_message: &str) -> String {
    let trimmed = first_message.trim();
    if trimmed.len() <= 40 {
        trimmed.to_string()
    } else {
        let truncated: String = trimmed.chars().take(37).collect();
        format!("{}...", truncated.trim_end())
    }
}
