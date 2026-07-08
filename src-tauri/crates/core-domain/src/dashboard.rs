use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct DashboardStats {
    pub active_subscribers: i32,
    pub current_month_revenue: f64,
    pub expiring_soon: i32,
    pub churn_rate: f64,
}

pub fn get_dashboard_stats(conn: &Connection) -> Result<DashboardStats, String> {
    let active_subscribers: i32 = conn.query_row(
        "SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND deleted_at IS NULL", 
        [], 
        |row| row.get(0)
    ).unwrap_or(0);
    
    let current_month_revenue: f64 = conn.query_row(
        "SELECT SUM(amount) FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now') AND deleted_at IS NULL",
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);
    
    let expiring_soon: i32 = conn.query_row(
        "SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND end_date BETWEEN date('now') AND date('now', '+7 days') AND deleted_at IS NULL",
        [],
        |row| row.get(0)
    ).unwrap_or(0);
    
    let churn_rate: f64 = conn.query_row(
        "SELECT 
            CASE 
                WHEN (SELECT COUNT(*) FROM subscriptions WHERE deleted_at IS NULL AND start_date < date('now', 'start of month')) = 0 THEN 0.0
                ELSE (CAST((SELECT COUNT(*) FROM subscriptions WHERE status IN ('expired', 'cancelled') AND end_date >= date('now', 'start of month') AND deleted_at IS NULL) AS REAL) / 
                      CAST((SELECT COUNT(*) FROM subscriptions WHERE deleted_at IS NULL AND start_date < date('now', 'start of month')) AS REAL)) * 100.0
            END",
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);
    
    Ok(DashboardStats {
        active_subscribers,
        current_month_revenue,
        expiring_soon,
        churn_rate,
    })
}

#[derive(Serialize)]
pub struct ChartDataPoint {
    pub name: String,
    pub revenue: f64,
}

pub fn get_chart_data(conn: &Connection) -> Result<Vec<ChartDataPoint>, String> {
    let mut stmt = conn.prepare("
        SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as revenue
        FROM payments
        WHERE deleted_at IS NULL
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12
    ").map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok(ChartDataPoint {
            name: row.get(0)?,
            revenue: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut data = Vec::new();
    for r in rows {
        data.push(r.map_err(|e| e.to_string())?);
    }
    
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_churn_rate_calculation() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("
            CREATE TABLE subscriptions (
                id INTEGER PRIMARY KEY,
                status TEXT,
                start_date TEXT,
                end_date TEXT,
                deleted_at TEXT
            );
            INSERT INTO subscriptions (status, start_date, end_date) VALUES ('active', date('now', '-2 month'), date('now', '+1 month'));
            INSERT INTO subscriptions (status, start_date, end_date) VALUES ('expired', date('now', '-2 month'), date('now', 'start of month', '+1 day'));
        ").unwrap();

        let stats = get_dashboard_stats(&conn).unwrap();
        // 1 active, 1 expired -> churn should be 50%
        assert_eq!(stats.churn_rate, 50.0);
    }
}
