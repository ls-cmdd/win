use axum::{
    routing::{post, get},
    Router,
    extract::{State, Query},
    http::{StatusCode, HeaderMap},
    body::Bytes,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};
use std::path::Path;
use std::fs;

// A simple state holding DB path and key
pub struct ApiState {
    pub db_path: String,
    pub db_key: String,
    pub webhook_secret: String,
}

#[derive(Deserialize, Debug)]
pub struct WebhookPayload {
    pub client_name: String,
    pub client_phone: String,
    pub plan_name: String,
    pub amount: f64,
}

#[derive(Deserialize)]
pub struct StatusQuery {
    pub phone: String,
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub status: String,
    pub end_date: Option<String>,
}

fn get_or_create_webhook_secret() -> String {
    let secret_path = Path::new(".webhook_secret");
    if secret_path.exists() {
        if let Ok(content) = fs::read_to_string(secret_path) {
            let trimmed = content.trim().to_string();
            if !trimmed.is_empty() {
                return trimmed;
            }
        }
    }
    
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos().to_string();
    let mut hasher = Sha256::new();
    hasher.update(now.as_bytes());
    let hex_key = hex::encode(hasher.finalize());
    let _ = fs::write(secret_path, &hex_key);
    hex_key
}

pub async fn start_api_server(db_path: String, db_key: String) {
    let webhook_secret = get_or_create_webhook_secret();
    let state = Arc::new(ApiState { db_path, db_key, webhook_secret });

    let app = Router::new()
        .route("/webhook/subscription", post(handle_webhook))
        .route("/api/subscriptions/status", get(handle_status))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:4545").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_status(
    State(state): State<Arc<ApiState>>,
    Query(query): Query<StatusQuery>,
) -> Result<Json<StatusResponse>, StatusCode> {
    let conn = core_db::init_db(&state.db_path, &state.db_key).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let sub_id: i32 = conn.query_row(
        "SELECT id FROM subscribers WHERE phone = ?1 AND deleted_at IS NULL",
        rusqlite::params![query.phone],
        |row| row.get(0)
    ).map_err(|_| StatusCode::NOT_FOUND)?;

    let (status, end_date): (String, String) = conn.query_row(
        "SELECT status, end_date FROM subscriptions WHERE subscriber_id = ?1 ORDER BY id DESC LIMIT 1",
        rusqlite::params![sub_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(StatusResponse { status, end_date: Some(end_date) }))
}

async fn handle_webhook(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, StatusCode> {
    let signature = headers.get("X-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let secret = state.webhook_secret.as_bytes();
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    mac.update(&body);
    let expected = hex::encode(mac.finalize().into_bytes());

    if signature != expected {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let payload: WebhookPayload = serde_json::from_slice(&body).map_err(|_| StatusCode::BAD_REQUEST)?;

    let conn = core_db::init_db(&state.db_path, &state.db_key).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let sub_id: i32 = match conn.query_row(
        "SELECT id FROM subscribers WHERE phone = ?1 AND deleted_at IS NULL",
        rusqlite::params![payload.client_phone],
        |row| row.get(0)
    ) {
        Ok(id) => id,
        Err(_) => {
            conn.execute(
                "INSERT INTO subscribers (full_name, phone) VALUES (?1, ?2)",
                rusqlite::params![payload.client_name, payload.client_phone]
            ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            conn.last_insert_rowid() as i32
        }
    };

    let (plan_id, duration_days): (i32, i32) = conn.query_row(
        "SELECT id, duration_days FROM plans WHERE name = ?1 AND deleted_at IS NULL",
        rusqlite::params![payload.plan_name],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|_| StatusCode::NOT_FOUND)?;

    conn.execute(
        &format!("INSERT INTO subscriptions (subscriber_id, plan_id, start_date, end_date, status, auto_renew) 
          VALUES (?1, ?2, date('now'), date('now', '+{} days'), 'active', 1)", duration_days),
        rusqlite::params![sub_id, plan_id]
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let sub_record_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO payments (subscription_id, amount, payment_method, receipt_number) 
          VALUES (?1, ?2, 'webhook', 'WH-' || hex(randomblob(4)))",
        rusqlite::params![sub_record_id, payload.amount]
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
