use crate::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationResponse {
    pub id: String,
    pub title: String,
    pub model: String,
    pub system_prompt_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationWithMessages {
    pub conversation: ConversationResponse,
    pub messages: Vec<MessageResponse>,
}

impl From<crate::db::Conversation> for ConversationResponse {
    fn from(c: crate::db::Conversation) -> Self {
        ConversationResponse {
            id: c.id,
            title: c.title,
            model: c.model,
            system_prompt_id: c.system_prompt_id,
            created_at: c.created_at,
            updated_at: c.updated_at,
        }
    }
}

impl From<crate::db::Message> for MessageResponse {
    fn from(m: crate::db::Message) -> Self {
        MessageResponse {
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role,
            content: m.content,
            model: m.model,
            created_at: m.created_at,
        }
    }
}

#[tauri::command]
pub fn create_conversation(
    state: State<'_, AppState>,
    model: String,
    system_prompt_id: Option<String>,
) -> Result<ConversationResponse, String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    let convo = db
        .create_conversation(&model, system_prompt_id.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(convo.into())
}

#[tauri::command]
pub fn list_conversations(
    state: State<'_, AppState>,
) -> Result<Vec<ConversationResponse>, String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    let convos = db.list_conversations().map_err(|e| e.to_string())?;
    Ok(convos.into_iter().map(|c| c.into()).collect())
}

#[tauri::command]
pub fn get_conversation(
    state: State<'_, AppState>,
    id: String,
) -> Result<ConversationWithMessages, String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    let convo = db
        .get_conversation(&id)
        .map_err(|e| e.to_string())?
        .ok_or("Conversation not found")?;
    let messages = db.get_messages(&id).map_err(|e| e.to_string())?;
    Ok(ConversationWithMessages {
        conversation: convo.into(),
        messages: messages.into_iter().map(|m| m.into()).collect(),
    })
}

#[tauri::command]
pub fn delete_conversation(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    db.delete_conversation(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_conversation(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Internal error: database lock".to_string())?;
    db.rename_conversation(&id, &title)
        .map_err(|e| e.to_string())
}
