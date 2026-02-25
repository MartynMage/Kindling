use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Search result returned by full-text message search.
/// Defined here (rather than in commands) to avoid circular module dependencies.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub conversation_id: String,
    pub conversation_title: String,
    pub message_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model: String,
    pub system_prompt_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemPrompt {
    pub id: String,
    pub name: String,
    pub content: String,
    pub created_at: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let app_dir = app_data_dir().ok_or_else(|| {
            rusqlite::Error::InvalidParameterName(
                "Could not determine application data directory".to_string(),
            )
        })?;
        std::fs::create_dir_all(&app_dir).map_err(|e| {
            rusqlite::Error::InvalidParameterName(
                format!("Failed to create data directory {:?}: {}", app_dir, e),
            )
        })?;
        let db_path = app_dir.join("kindling.db");
        let conn = Connection::open(&db_path)?;

        // On Unix, restrict database file to owner-only (mode 0600)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if db_path.exists() {
                let perms = std::fs::Permissions::from_mode(0o600);
                std::fs::set_permissions(&db_path, perms).ok();
            }
        }

        let db = Database { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        // Enable WAL mode for better concurrency and foreign keys for referential integrity
        self.conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New conversation',
                model TEXT NOT NULL,
                system_prompt_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                model TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS system_prompts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at
                ON messages(conversation_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_conversations_updated
                ON conversations(updated_at DESC);",
        )?;
        Ok(())
    }

    // --- Conversations ---

    pub fn create_conversation(
        &self,
        model: &str,
        system_prompt_id: Option<&str>,
    ) -> Result<Conversation> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO conversations (id, title, model, system_prompt_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, "New conversation", model, system_prompt_id, now, now],
        )?;
        Ok(Conversation {
            id,
            title: "New conversation".to_string(),
            model: model.to_string(),
            system_prompt_id: system_prompt_id.map(|s| s.to_string()),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn list_conversations(&self) -> Result<Vec<Conversation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, model, system_prompt_id, created_at, updated_at
             FROM conversations ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                system_prompt_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_conversation(&self, id: &str) -> Result<Option<Conversation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, model, system_prompt_id, created_at, updated_at
             FROM conversations WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                system_prompt_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;
        Ok(rows.next().transpose()?)
    }

    pub fn delete_conversation(&self, id: &str) -> Result<()> {
        // Use a transaction so both deletes succeed or neither does
        self.conn.execute("BEGIN TRANSACTION", [])?;
        match (|| -> Result<()> {
            self.conn.execute("DELETE FROM messages WHERE conversation_id = ?1", params![id])?;
            self.conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
            Ok(())
        })() {
            Ok(()) => {
                self.conn.execute("COMMIT", [])?;
                Ok(())
            }
            Err(e) => {
                self.conn.execute("ROLLBACK", []).ok();
                Err(e)
            }
        }
    }

    pub fn rename_conversation(&self, id: &str, title: &str) -> Result<()> {
        // Truncate title to prevent oversized values
        let safe_title: String = title.chars().take(255).collect();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![safe_title, now, id],
        )?;
        Ok(())
    }

    pub fn update_conversation_timestamp(&self, id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    // --- Messages ---

    /// Maximum message content size: 10 MB.  Messages longer than this are
    /// truncated before being persisted.  This prevents accidental memory
    /// bloat from enormous LLM outputs while still allowing very long
    /// conversations.
    const MAX_MESSAGE_CONTENT: usize = 10 * 1024 * 1024;

    pub fn add_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: &str,
        model: Option<&str>,
    ) -> Result<Message> {
        // Truncate oversized content to prevent DB bloat
        let safe_content: &str = if content.len() > Self::MAX_MESSAGE_CONTENT {
            // Find a valid char boundary near the limit
            let mut end = Self::MAX_MESSAGE_CONTENT;
            while !content.is_char_boundary(end) && end > 0 {
                end -= 1;
            }
            &content[..end]
        } else {
            content
        };

        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, model, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, conversation_id, role, safe_content, model, now],
        )?;
        self.update_conversation_timestamp(conversation_id)?;
        Ok(Message {
            id,
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: safe_content.to_string(),
            model: model.map(|s| s.to_string()),
            created_at: now,
        })
    }

    pub fn get_messages(&self, conversation_id: &str) -> Result<Vec<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, role, content, model, created_at
             FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                model: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    /// Delete all messages in a conversation after (and including) the message with the given ID.
    /// Used for regeneration to clean up old assistant messages from the DB.
    pub fn delete_messages_after(&self, conversation_id: &str, after_message_id: &str) -> Result<u64> {
        // Get the created_at timestamp of the reference message
        let mut stmt = self.conn.prepare(
            "SELECT created_at FROM messages WHERE id = ?1 AND conversation_id = ?2",
        )?;
        let ts: Option<String> = stmt
            .query_map(params![after_message_id, conversation_id], |row| row.get(0))?
            .next()
            .transpose()?;

        if let Some(timestamp) = ts {
            let deleted = self.conn.execute(
                "DELETE FROM messages WHERE conversation_id = ?1 AND created_at > ?2",
                params![conversation_id, timestamp],
            )?;
            Ok(deleted as u64)
        } else {
            Ok(0)
        }
    }

    pub fn search_messages(&self, query: &str) -> Result<Vec<SearchResult>> {
        // Limit query length to prevent DoS
        let trimmed: String = query.chars().take(500).collect();
        // Escape LIKE wildcards to prevent unintended matching
        let escaped = trimmed.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
        let search_pattern = format!("%{}%", escaped);
        let mut stmt = self.conn.prepare(
            "SELECT m.conversation_id, c.title, m.id, m.role, m.content, m.created_at
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE m.content LIKE ?1 ESCAPE '\\'
             ORDER BY m.created_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![search_pattern], |row| {
            Ok(SearchResult {
                conversation_id: row.get(0)?,
                conversation_title: row.get(1)?,
                message_id: row.get(2)?,
                role: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    // --- System Prompts ---

    pub fn list_system_prompts(&self) -> Result<Vec<SystemPrompt>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, content, created_at FROM system_prompts ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SystemPrompt {
                id: row.get(0)?,
                name: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_system_prompt(&self, name: &str, content: &str) -> Result<SystemPrompt> {
        // Validate inputs
        let safe_name: String = name.chars().take(255).collect();
        let safe_content: String = content.chars().take(50000).collect();
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO system_prompts (id, name, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, safe_name, safe_content, now],
        )?;
        Ok(SystemPrompt {
            id,
            name: name.to_string(),
            content: content.to_string(),
            created_at: now,
        })
    }

    pub fn update_system_prompt(&self, id: &str, name: &str, content: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE system_prompts SET name = ?1, content = ?2 WHERE id = ?3",
            params![name, content, id],
        )?;
        Ok(())
    }

    pub fn delete_system_prompt(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM system_prompts WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- Settings ---

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
        Ok(rows.next().transpose()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}

/// Determine the application data directory using the `dirs` crate for consistency.
fn app_data_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        dirs::data_dir().map(|p| p.join("Kindling"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::data_dir().map(|p| p.join("Kindling"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::data_dir().map(|p| p.join("kindling"))
    }
}
