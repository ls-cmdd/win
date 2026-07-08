use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct Subscription {
    pub id: i32,
    pub subscriber_id: i32,
    pub subscriber_name: String,
    pub plan_id: i32,
    pub plan_name: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
}

pub fn get_subscriptions(conn: &Connection) -> Result<Vec<Subscription>, String> {
    let mut stmt = conn.prepare("
        SELECT s.id, s.subscriber_id, sub.full_name, s.plan_id, p.name, s.start_date, s.end_date, s.status
        FROM subscriptions s
        JOIN subscribers sub ON s.subscriber_id = sub.id
        JOIN plans p ON s.plan_id = p.id
        WHERE s.deleted_at IS NULL
        ORDER BY s.created_at DESC
    ").map_err(|e| e.to_string())?;
    
    let sub_iter = stmt.query_map([], |row| {
        Ok(Subscription {
            id: row.get(0)?,
            subscriber_id: row.get(1)?,
            subscriber_name: row.get(2)?,
            plan_id: row.get(3)?,
            plan_name: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
            status: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut subs = Vec::new();
    for sub in sub_iter {
        subs.push(sub.map_err(|e| e.to_string())?);
    }
    Ok(subs)
}

pub fn add_subscription(conn: &Connection, subscriber_id: i32, plan_id: i32, start_date: String, end_date: String, status: String, auto_renew: bool) -> Result<i32, String> {
    conn.execute(
        "INSERT INTO subscriptions (subscriber_id, plan_id, start_date, end_date, status, auto_renew) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![subscriber_id, plan_id, start_date, end_date, status, auto_renew]
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid() as i32)
}

pub fn renew_subscription(conn: &Connection, id: i32) -> Result<(), String> {
    conn.execute("
        UPDATE subscriptions 
        SET end_date = date(
            CASE WHEN end_date < date('now') THEN date('now') ELSE end_date END, 
            '+' || (SELECT duration_days FROM plans WHERE id = subscriptions.plan_id) || ' days'
        ),
        status = 'active'
        WHERE id = ?1
    ", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn cancel_subscription(conn: &Connection, id: i32) -> Result<(), String> {
    conn.execute("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
