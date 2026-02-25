use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
        let app_dir = dirs_next().ok_or_else(|| {
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
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        self.conn.execute_batch("PRAGMA foreign_keys = ON;")?;
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
                ON messages(conversation_id);",
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
        self.conn
            .execute("DELETE FROM messages WHERE conversation_id = ?1", params![id])?;
        self.conn
            .execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn rename_conversation(&self, id: &str, title: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
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

    pub fn add_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: &str,
        model: Option<&str>,
    ) -> Result<Message> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, model, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, conversation_id, role, content, model, now],
        )?;
        self.update_conversation_timestamp(conversation_id)?;
        Ok(Message {
            id,
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
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

    pub fn search_messages(&self, query: &str) -> Result<Vec<crate::commands::conversations::SearchResult>> {
        let search_pattern = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT m.conversation_id, c.title, m.id, m.role, m.content, m.created_at
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE m.content LIKE ?1
             ORDER BY m.created_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![search_pattern], |row| {
            Ok(crate::commands::conversations::SearchResult {
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
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO system_prompts (id, name, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, content, now],
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

fn dirs_next() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("Kindling"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs_next_home().map(|p| {
            p.join("Library")
                .join("Application Support")
                .join("Kindling")
        })
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(std::path::PathBuf::from)
            .or_else(|| dirs_next_home().map(|p| p.join(".local").join("share")))
            .map(|p| p.join("kindling"))
    }
}

#[allow(dead_code)]
fn dirs_next_home() -> Option<std::path::PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(std::path::PathBuf::from)
}
