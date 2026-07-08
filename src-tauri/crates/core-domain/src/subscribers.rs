use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct Subscriber {
    pub id: i32,
    pub full_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub national_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

pub fn get_subscribers(conn: &Connection, search: String) -> Result<Vec<Subscriber>, String> {
    let query_param = format!("%{}%", search);
    let mut stmt = conn.prepare("
        SELECT id, full_name, phone, email, national_id, notes, created_at 
        FROM subscribers 
        WHERE deleted_at IS NULL AND (full_name LIKE ?1 OR phone LIKE ?1)
        ORDER BY created_at DESC
    ").map_err(|e| e.to_string())?;
    
    let sub_iter = stmt.query_map([&query_param], |row| {
        Ok(Subscriber {
            id: row.get(0)?,
            full_name: row.get(1)?,
            phone: row.get(2)?,
            email: row.get(3)?,
            national_id: row.get(4)?,
            notes: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut subs = Vec::new();
    for sub in sub_iter {
        subs.push(sub.map_err(|e| e.to_string())?);
    }
    Ok(subs)
}

pub fn add_subscriber(conn: &Connection, full_name: String, phone: String, email: Option<String>, national_id: Option<String>, notes: Option<String>) -> Result<i32, String> {
    conn.execute(
        "INSERT INTO subscribers (full_name, phone, email, national_id, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![full_name, phone, email, national_id, notes]
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid() as i32)
}

pub fn update_subscriber(conn: &Connection, id: i32, full_name: String, phone: String, email: Option<String>, national_id: Option<String>, notes: Option<String>) -> Result<(), String> {
    conn.execute(
        "UPDATE subscribers SET full_name = ?1, phone = ?2, email = ?3, national_id = ?4, notes = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = ?6",
        rusqlite::params![full_name, phone, email, national_id, notes, id]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_subscriber(conn: &Connection, id: i32) -> Result<(), String> {
    conn.execute("UPDATE subscribers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
