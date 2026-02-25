use reqwest::Client;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    #[serde(rename = "modified_at")]
    pub modified_at: String,
    pub size: u64,
    pub digest: String,
    pub details: ModelDetails,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelDetails {
    pub format: String,
    pub family: String,
    #[serde(rename = "parameter_size")]
    pub parameter_size: String,
    #[serde(rename = "quantization_level")]
    pub quantization_level: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListModelsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<ChatOptions>,
}

#[derive(Debug, Serialize)]
pub struct ChatOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatStreamChunk {
    pub message: Option<ChatMessage>,
    pub done: bool,
}

#[derive(Debug, Serialize)]
pub struct PullRequest {
    pub name: String,
    pub stream: bool,
}

#[derive(Debug, Deserialize)]
pub struct PullProgress {
    pub status: String,
    pub digest: Option<String>,
    pub total: Option<u64>,
    pub completed: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct DeleteRequest {
    pub name: String,
}

pub struct OllamaClient {
    client: Client,
    base_url: Url,
}

impl OllamaClient {
    pub fn new(base_url: &str, client: Client) -> Self {
        // Ensure the base URL ends with a trailing slash so Url::join works correctly
        let normalized = if base_url.ends_with('/') {
            base_url.to_string()
        } else {
            format!("{}/", base_url)
        };
        let parsed = Url::parse(&normalized).unwrap_or_else(|_| {
            Url::parse("http://localhost:11434/").expect("hardcoded URL is valid")
        });
        OllamaClient {
            client,
            base_url: parsed,
        }
    }

    /// Build a full endpoint URL by joining a relative path onto the base.
    fn endpoint(&self, path: &str) -> String {
        self.base_url
            .join(path)
            .map(|u| u.to_string())
            .unwrap_or_else(|_| format!("{}{}", self.base_url, path))
    }

    pub async fn check_connection(&self) -> bool {
        self.client
            .get(self.endpoint("api/tags"))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    pub async fn list_models(&self) -> Result<Vec<OllamaModel>, reqwest::Error> {
        let resp = self
            .client
            .get(self.endpoint("api/tags"))
            .send()
            .await?
            .json::<ListModelsResponse>()
            .await?;
        Ok(resp.models)
    }

    pub async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        options: Option<ChatOptions>,
    ) -> Result<reqwest::Response, reqwest::Error> {
        let req = ChatRequest {
            model: model.to_string(),
            messages,
            stream: true,
            options,
        };
        let resp = self
            .client
            .post(self.endpoint("api/chat"))
            .json(&req)
            .send()
            .await?
            .error_for_status()?;
        Ok(resp)
    }

    pub async fn pull_model(
        &self,
        name: &str,
    ) -> Result<reqwest::Response, reqwest::Error> {
        let req = PullRequest {
            name: name.to_string(),
            stream: true,
        };
        self.client
            .post(self.endpoint("api/pull"))
            .json(&req)
            .send()
            .await
    }

    pub async fn delete_model(&self, name: &str) -> Result<(), reqwest::Error> {
        let req = DeleteRequest {
            name: name.to_string(),
        };
        self.client
            .delete(self.endpoint("api/delete"))
            .json(&req)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }
}
