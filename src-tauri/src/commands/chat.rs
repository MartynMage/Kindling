use crate::ollama::{ChatMessage, ChatOptions, OllamaClient, ChatStreamChunk};
use crate::AppState;
use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

/// Maximum accumulated response size (10 MB) to prevent memory exhaustion from
/// runaway or malicious Ollama responses.
const MAX_RESPONSE_SIZE: usize = 10 * 1024 * 1024;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamEvent {
    pub conversation_id: String,
    pub token: Option<String>,
    pub done: bool,
    pub error: Option<String>,
    /// The database ID of the saved assistant message (sent with done=true)
    pub message_id: Option<String>,
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    conversation_id: String,
    content: String,
    model: String,
    system_prompt: Option<String>,
    skip_user_save: Option<bool>,
) -> Result<(), String> {
    // Prevent concurrent sends — only one stream at a time
    {
        let mut active = state
            .active_stream
            .lock()
            .map_err(|_| "Internal error: failed to acquire lock".to_string())?;
        if active.is_some() {
            return Err("A message is already being generated. Please wait or stop it first.".to_string());
        }
        *active = Some(conversation_id.clone());
    }

    // Reset cancellation flag at the start of a new message
    {
        let mut cancelled = state
            .stream_cancelled
            .lock()
            .map_err(|_| "Internal error: failed to acquire lock".to_string())?;
        *cancelled = false;
    }

    let ollama_url = state
        .ollama_url
        .lock()
        .map_err(|_| "Internal error: failed to acquire lock".to_string())?
        .clone();

    // Save user message to database (skip during regeneration to avoid duplicates)
    if !skip_user_save.unwrap_or(false) {
        let db = state
            .db
            .lock()
            .map_err(|_| "Internal error: failed to acquire database lock".to_string())?;
        db.add_message(&conversation_id, "user", &content, None)
            .map_err(|e| e.to_string())?;
    }

    // Build message history and load settings
    let (messages, chat_options) = {
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

        // Load model parameters from settings
        let options = ChatOptions {
            temperature: db.get_setting("temperature").ok().flatten().and_then(|v| v.parse().ok()),
            top_p: db.get_setting("top_p").ok().flatten().and_then(|v| v.parse().ok()),
            top_k: db.get_setting("top_k").ok().flatten().and_then(|v| v.parse().ok()),
            num_ctx: db.get_setting("context_length").ok().flatten().and_then(|v| v.parse().ok()),
        };

        (chat_messages, options)
    };

    // Stream response from Ollama
    let client = OllamaClient::new(&ollama_url, state.client.clone());
    let response = match client
        .chat_stream(&model, messages, Some(chat_options))
        .await
    {
        Ok(r) => r,
        Err(e) => {
            // Clear active stream on error
            if let Ok(mut active) = state.active_stream.lock() {
                *active = None;
            }
            return Err(e.to_string());
        }
    };

    let mut stream = response.bytes_stream();
    let mut full_response = String::new();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        // Check cancellation flag
        {
            let cancelled = state.stream_cancelled.lock().unwrap_or_else(|e| e.into_inner());
            if *cancelled {
                // Save whatever we have so far
                let mut saved_id = None;
                if !full_response.trim().is_empty() {
                    let db = state.db.lock().map_err(|_| {
                        "Internal error: failed to acquire database lock".to_string()
                    })?;
                    let saved_msg = db.add_message(
                        &conversation_id,
                        "assistant",
                        &full_response,
                        Some(&model),
                    )
                    .map_err(|e| format!("Failed to save message: {}", e))?;
                    saved_id = Some(saved_msg.id);
                }
                // Clear active stream
                if let Ok(mut active) = state.active_stream.lock() {
                    *active = None;
                }
                app.emit(
                    "chat-stream",
                    ChatStreamEvent {
                        conversation_id: conversation_id.clone(),
                        token: None,
                        done: true,
                        error: None,
                        message_id: saved_id,
                    },
                )
                .ok();
                return Ok(());
            }
        }

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

                            // Guard against unbounded response accumulation
                            if full_response.len() > MAX_RESPONSE_SIZE {
                                // Save what we have and abort
                                let mut saved_id = None;
                                if !full_response.trim().is_empty() {
                                    if let Ok(db) = state.db.lock() {
                                        if let Ok(saved_msg) = db.add_message(
                                            &conversation_id,
                                            "assistant",
                                            &full_response,
                                            Some(&model),
                                        ) {
                                            saved_id = Some(saved_msg.id);
                                        }
                                    }
                                }
                                if let Ok(mut active) = state.active_stream.lock() {
                                    *active = None;
                                }
                                app.emit(
                                    "chat-stream",
                                    ChatStreamEvent {
                                        conversation_id: conversation_id.clone(),
                                        token: None,
                                        done: true,
                                        error: Some("Response size limit exceeded".to_string()),
                                        message_id: saved_id,
                                    },
                                )
                                .ok();
                                return Ok(());
                            }

                            app.emit(
                                "chat-stream",
                                ChatStreamEvent {
                                    conversation_id: conversation_id.clone(),
                                    token: Some(msg.content.clone()),
                                    done: false,
                                    error: None,
                                    message_id: None,
                                },
                            )
                            .ok();
                        }
                        if chunk.done {
                            let mut saved_id = None;
                            // Only save non-empty responses
                            if !full_response.trim().is_empty() {
                                let db = state.db.lock().map_err(|_| {
                                    "Internal error: failed to acquire database lock".to_string()
                                })?;
                                let saved_msg = db.add_message(
                                    &conversation_id,
                                    "assistant",
                                    &full_response,
                                    Some(&model),
                                )
                                .map_err(|e| format!("Failed to save message: {}", e))?;
                                saved_id = Some(saved_msg.id.clone());

                                // Auto-title if this is the first exchange
                                if let Ok(messages) = db.get_messages(&conversation_id) {
                                    if messages.len() <= 2 {
                                        if let Ok(Some(convo)) =
                                            db.get_conversation(&conversation_id)
                                        {
                                            if convo.title == "New conversation" {
                                                // Use truncation as fallback title immediately
                                                let fallback = truncate_as_title(&content);
                                                db.rename_conversation(&conversation_id, &fallback)
                                                    .ok();
                                                // Fire off async LLM title generation
                                                let app2 = app.clone();
                                                let cid = conversation_id.clone();
                                                let user_msg = content.clone();
                                                let assistant_msg = full_response.clone();
                                                let url = ollama_url.clone();
                                                let m = model.clone();
                                                let client2 = state.client.clone();
                                                tokio::spawn(async move {
                                                    if let Some(title) = generate_title_with_llm(
                                                        &url, &client2, &m, &user_msg, &assistant_msg
                                                    ).await {
                                                        // We can't access AppState from a detached task,
                                                        // so emit an event for the frontend to refresh
                                                        app2.emit("conversation-title-updated", serde_json::json!({
                                                            "conversationId": cid,
                                                            "title": title,
                                                        })).ok();
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                            }

                            // Clear active stream
                            if let Ok(mut active) = state.active_stream.lock() {
                                *active = None;
                            }

                            app.emit(
                                "chat-stream",
                                ChatStreamEvent {
                                    conversation_id: conversation_id.clone(),
                                    token: None,
                                    done: true,
                                    error: None,
                                    message_id: saved_id,
                                },
                            )
                            .ok();
                        }
                    }
                }
            }
            Err(e) => {
                // Clear active stream on error
                if let Ok(mut active) = state.active_stream.lock() {
                    *active = None;
                }
                app.emit(
                    "chat-stream",
                    ChatStreamEvent {
                        conversation_id: conversation_id.clone(),
                        token: None,
                        done: true,
                        error: Some(e.to_string()),
                        message_id: None,
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
                        conversation_id: conversation_id.clone(),
                        token: Some(msg.content.clone()),
                        done: false,
                        error: None,
                        message_id: None,
                    },
                )
                .ok();
            }
        }
    }

    // Clear active stream when function exits normally
    if let Ok(mut active) = state.active_stream.lock() {
        *active = None;
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_streaming(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut cancelled = state
        .stream_cancelled
        .lock()
        .map_err(|_| "Internal error: failed to acquire lock".to_string())?;
    *cancelled = true;
    Ok(())
}

fn truncate_as_title(first_message: &str) -> String {
    let trimmed = first_message.trim();
    if trimmed.len() <= 40 {
        trimmed.to_string()
    } else {
        let truncated: String = trimmed.chars().take(37).collect();
        format!("{}...", truncated.trim_end())
    }
}

/// Generate a conversation title using the LLM itself
async fn generate_title_with_llm(
    ollama_url: &str,
    client: &reqwest::Client,
    model: &str,
    user_message: &str,
    assistant_response: &str,
) -> Option<String> {
    use crate::ollama::{ChatRequest};

    let prompt = format!(
        "Generate a short title (max 6 words) for this conversation. Reply with ONLY the title, no quotes or punctuation.\n\nUser: {}\nAssistant: {}",
        &user_message[..user_message.len().min(200)],
        &assistant_response[..assistant_response.len().min(200)]
    );

    let req = ChatRequest {
        model: model.to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        stream: false,
        options: Some(ChatOptions {
            temperature: Some(0.3),
            top_p: None,
            top_k: None,
            num_ctx: Some(256),
        }),
    };

    let base = if ollama_url.ends_with('/') {
        ollama_url.to_string()
    } else {
        format!("{}/", ollama_url)
    };
    let endpoint = url::Url::parse(&base)
        .and_then(|u| u.join("api/chat"))
        .map(|u| u.to_string())
        .unwrap_or_else(|_| format!("{}/api/chat", ollama_url));

    let resp = client
        .post(endpoint)
        .json(&req)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .ok()?;

    let json: serde_json::Value = resp.json().await.ok()?;
    let title = json["message"]["content"]
        .as_str()?
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .to_string();

    if title.is_empty() || title.len() > 80 {
        return None;
    }

    Some(title)
}
