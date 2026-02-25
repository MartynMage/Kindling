#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod ollama;

use db::Database;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Database>,
    pub ollama_url: Mutex<String>,
    pub stream_cancelled: Mutex<bool>,
    pub pull_cancelled: Mutex<bool>,
    pub training_cancelled: Mutex<bool>,
    /// Tracks the conversation currently being streamed (prevents concurrent sends)
    pub active_stream: Mutex<Option<String>>,
    pub client: reqwest::Client,
}

fn main() {
    let database = Database::new().expect("Failed to initialize database");

    // Load saved ollama_url from database, fall back to default
    let ollama_url = database
        .get_setting("ollama_url")
        .ok()
        .flatten()
        .unwrap_or_else(|| "http://localhost:11434".to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: Mutex::new(database),
            ollama_url: Mutex::new(ollama_url),
            stream_cancelled: Mutex::new(false),
            pull_cancelled: Mutex::new(false),
            training_cancelled: Mutex::new(false),
            active_stream: Mutex::new(None),
            client: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to build HTTP client"),
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::send_message,
            commands::chat::stop_streaming,
            commands::conversations::create_conversation,
            commands::conversations::list_conversations,
            commands::conversations::get_conversation,
            commands::conversations::delete_conversation,
            commands::conversations::rename_conversation,
            commands::conversations::export_conversation,
            commands::conversations::search_messages,
            commands::conversations::delete_messages_after,
            commands::models::list_models,
            commands::models::pull_model,
            commands::models::cancel_pull,
            commands::models::delete_model,
            commands::prompts::list_system_prompts,
            commands::prompts::create_system_prompt,
            commands::prompts::update_system_prompt,
            commands::prompts::delete_system_prompt,
            commands::system::get_hardware_info,
            commands::system::get_settings,
            commands::system::update_settings,
            commands::system::check_ollama_connection,
            commands::training::start_training,
            commands::training::stop_training,
            commands::training::generate_training_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
