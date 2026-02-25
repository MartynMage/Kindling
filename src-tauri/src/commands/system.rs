use crate::ollama::OllamaClient;
use crate::AppState;
use serde::{Deserialize, Serialize};
use sysinfo::System;
use tauri::State;
use url::Url;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfoResponse {
    pub os: String,
    pub total_ram: u64,
    pub gpu_name: Option<String>,
    pub vram: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsResponse {
    pub ollama_url: String,
    pub default_model: Option<String>,
    pub temperature: f64,
    pub context_length: u32,
    pub top_p: f64,
    pub top_k: u32,
    pub theme: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsUpdate {
    pub ollama_url: Option<String>,
    pub default_model: Option<String>,
    pub temperature: Option<f64>,
    pub context_length: Option<u32>,
    pub top_p: Option<f64>,
    pub top_k: Option<u32>,
    pub theme: Option<String>,
}

#[tauri::command]
pub fn get_hardware_info() -> Result<HardwareInfoResponse, String> {
    let mut sys = System::new();
    sys.refresh_memory();

    let os = format!(
        "{} {}",
        System::name().unwrap_or_default(),
        System::os_version().unwrap_or_default()
    );

    Ok(HardwareInfoResponse {
        os,
        total_ram: sys.total_memory(),
        gpu_name: None, // GPU detection requires platform-specific APIs
        vram: None,
    })
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettingsResponse, String> {
    // Acquire ollama_url first, clone and release, to maintain consistent lock ordering
    let url = state.ollama_url.lock().map_err(|_| "Internal error: lock failed".to_string())?.clone();
    let db = state.db.lock().map_err(|_| "Internal error: lock failed".to_string())?;

    Ok(AppSettingsResponse {
        ollama_url: db
            .get_setting("ollama_url")
            .ok()
            .flatten()
            .unwrap_or(url),
        default_model: db.get_setting("default_model").ok().flatten(),
        temperature: db
            .get_setting("temperature")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.7),
        context_length: db
            .get_setting("context_length")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(4096),
        top_p: db
            .get_setting("top_p")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.9),
        top_k: db
            .get_setting("top_k")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(40),
        theme: db
            .get_setting("theme")
            .ok()
            .flatten()
            .unwrap_or_else(|| "dark".to_string()),
    })
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    settings: AppSettingsUpdate,
) -> Result<(), String> {
    // Validate inputs
    if let Some(url) = &settings.ollama_url {
        if !is_localhost_url(url) {
            return Err(
                "Ollama URL must point to localhost (127.0.0.1, ::1, or localhost) for security."
                    .to_string(),
            );
        }
    }
    if let Some(temp) = settings.temperature {
        if !(0.0..=2.0).contains(&temp) {
            return Err("Temperature must be between 0.0 and 2.0".to_string());
        }
    }
    if let Some(p) = settings.top_p {
        if !(0.0..=1.0).contains(&p) {
            return Err("top_p must be between 0.0 and 1.0".to_string());
        }
    }
    if let Some(k) = settings.top_k {
        if k < 1 || k > 200 {
            return Err("top_k must be between 1 and 200".to_string());
        }
    }

    // Update ollama_url FIRST (outside db lock) to maintain consistent lock ordering
    if let Some(url) = &settings.ollama_url {
        let mut ollama_url = state.ollama_url.lock().map_err(|_| "Internal error: lock failed".to_string())?;
        *ollama_url = url.clone();
    }

    let db = state.db.lock().map_err(|_| "Internal error: lock failed".to_string())?;

    if let Some(url) = &settings.ollama_url {
        db.set_setting("ollama_url", url)
            .map_err(|e| e.to_string())?;
    }
    if let Some(model) = &settings.default_model {
        db.set_setting("default_model", model)
            .map_err(|e| e.to_string())?;
    }
    if let Some(temp) = settings.temperature {
        db.set_setting("temperature", &temp.to_string())
            .map_err(|e| e.to_string())?;
    }
    if let Some(ctx) = settings.context_length {
        db.set_setting("context_length", &ctx.to_string())
            .map_err(|e| e.to_string())?;
    }
    if let Some(p) = settings.top_p {
        db.set_setting("top_p", &p.to_string())
            .map_err(|e| e.to_string())?;
    }
    if let Some(k) = settings.top_k {
        db.set_setting("top_k", &k.to_string())
            .map_err(|e| e.to_string())?;
    }
    if let Some(theme) = &settings.theme {
        db.set_setting("theme", theme)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn check_ollama_connection(state: State<'_, AppState>) -> Result<bool, String> {
    let url = state.ollama_url.lock().map_err(|_| "Internal error: lock failed".to_string())?.clone();
    let client = OllamaClient::new(&url, state.client.clone());
    Ok(client.check_connection().await)
}

/// Validate that a URL points to localhost only (SSRF prevention).
/// Accepts http:// or https:// schemes with host 127.0.0.1, ::1, or localhost.
fn is_localhost_url(raw_url: &str) -> bool {
    let parsed = match Url::parse(raw_url) {
        Ok(u) => u,
        Err(_) => return false,
    };

    // Only allow http/https schemes
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return false,
    }

    // Check host is strictly localhost
    match parsed.host_str() {
        Some("localhost") | Some("127.0.0.1") | Some("[::1]") | Some("::1") => true,
        _ => false,
    }
}
