use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct Plan {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub duration_days: i32,
    pub price: f64,
}

pub fn get_plans(conn: &Connection) -> Result<Vec<Plan>, String> {
    let mut stmt = conn.prepare("SELECT id, name, description, duration_days, price FROM plans WHERE deleted_at IS NULL ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let plan_iter = stmt.query_map([], |row| {
        Ok(Plan {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            duration_days: row.get(3)?,
            price: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut plans = Vec::new();
    for p in plan_iter {
        plans.push(p.map_err(|e| e.to_string())?);
    }
    Ok(plans)
}

pub fn add_plan(conn: &Connection, name: String, description: Option<String>, duration_days: i32, price: f64) -> Result<i32, String> {
    conn.execute(
        "INSERT INTO plans (name, description, duration_days, price) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![name, description, duration_days, price]
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid() as i32)
}

pub fn update_plan(conn: &Connection, id: i32, name: String, description: Option<String>, duration_days: i32, price: f64) -> Result<(), String> {
    conn.execute(
        "UPDATE plans SET name = ?1, description = ?2, duration_days = ?3, price = ?4 WHERE id = ?5",
        rusqlite::params![name, description, duration_days, price, id]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_plan(conn: &Connection, id: i32) -> Result<(), String> {
    conn.execute("UPDATE plans SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
