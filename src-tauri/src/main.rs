#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod ollama;

use db::Database;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Database>,
    pub ollama_url: Mutex<String>,
}

fn main() {
    let database = Database::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: Mutex::new(database),
            ollama_url: Mutex::new("http://localhost:11434".to_string()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::send_message,
            commands::conversations::create_conversation,
            commands::conversations::list_conversations,
            commands::conversations::get_conversation,
            commands::conversations::delete_conversation,
            commands::conversations::rename_conversation,
            commands::models::list_models,
            commands::models::pull_model,
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
