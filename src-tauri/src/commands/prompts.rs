use crate::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemPromptResponse {
    pub id: String,
    pub name: String,
    pub content: String,
    pub created_at: String,
}

impl From<crate::db::SystemPrompt> for SystemPromptResponse {
    fn from(p: crate::db::SystemPrompt) -> Self {
        SystemPromptResponse {
            id: p.id,
            name: p.name,
            content: p.content,
            created_at: p.created_at,
        }
    }
}

#[tauri::command]
pub fn list_system_prompts(
    state: State<'_, AppState>,
) -> Result<Vec<SystemPromptResponse>, String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    let prompts = db.list_system_prompts().map_err(|e| e.to_string())?;
    Ok(prompts.into_iter().map(|p| p.into()).collect())
}

#[tauri::command]
pub fn create_system_prompt(
    state: State<'_, AppState>,
    name: String,
    content: String,
) -> Result<SystemPromptResponse, String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    let prompt = db
        .create_system_prompt(&name, &content)
        .map_err(|e| e.to_string())?;
    Ok(prompt.into())
}

#[tauri::command]
pub fn update_system_prompt(
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    db.update_system_prompt(&id, &name, &content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_system_prompt(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    db.delete_system_prompt(&id).map_err(|e| e.to_string())
}
