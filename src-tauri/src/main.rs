#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
use serde::{Deserialize, Serialize};
use core_domain::{auth, plans, subscribers, subscriptions, payments, dashboard};
use core_db::init_db;
use core_license;
use core_api;
use tokio;
use std::time::Duration;
use tauri::Manager;

struct AppState {
    db: Mutex<Connection>,
    current_user_role: Mutex<Option<String>>,
    db_path: Mutex<String>,
}

#[derive(Serialize)]
struct UserResponse {
    id: i32,
    username: String,
    role: String,
}

fn check_admin(state: &State<AppState>) -> Result<(), String> {
    let role = state.current_user_role.lock().unwrap();
    if let Some(r) = role.as_ref() {
        if r == "admin" {
            return Ok(());
        }
    }
    Err("Unauthorized: Requires Admin role".to_string())
}

#[tauri::command]
fn check_system_setup(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().unwrap();
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL", [], |row| row.get(0)).unwrap_or(0);
    Ok(count > 0)
}

#[tauri::command]
fn setup_system(password: String, state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL", [], |row| row.get(0)).unwrap_or(0);
    
    if count > 0 {
        return Err("System already setup".to_string());
    }
    
    let hash = auth::hash_password(&password).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?1, ?2, ?3)",
        rusqlite::params!["admin", hash, "admin"]
    ).map_err(|e| e.to_string())?;
    
    Ok("Admin user created successfully.".to_string())
}

#[tauri::command]
fn login(username: &str, password: &str, state: State<AppState>) -> Result<UserResponse, String> {
    let conn = state.db.lock().unwrap();
    
    let user_res: Result<(i32, String, String, String), _> = conn.query_row(
        "SELECT id, username, password_hash, role FROM users WHERE username = ?1 AND deleted_at IS NULL",
        [username],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    );
    
    match user_res {
        Ok((id, un, hash, role)) => {
            if auth::verify_password(password, &hash) {
                conn.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?1", [id]).ok();
                *state.current_user_role.lock().unwrap() = Some(role.clone());
                Ok(UserResponse { id, username: un, role })
            } else {
                Err("Invalid credentials".to_string())
            }
        },
        Err(_) => Err("Invalid credentials".to_string())
    }
}

#[tauri::command]
fn get_plans(state: State<AppState>) -> Result<Vec<plans::Plan>, String> {
    let conn = state.db.lock().unwrap();
    plans::get_plans(&conn)
}

#[tauri::command]
fn add_plan(name: String, description: Option<String>, duration_days: i32, price: f64, state: State<AppState>) -> Result<i32, String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    plans::add_plan(&conn, name, description, duration_days, price)
}

#[tauri::command]
fn update_plan(id: i32, name: String, description: Option<String>, duration_days: i32, price: f64, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    plans::update_plan(&conn, id, name, description, duration_days, price)
}

#[tauri::command]
fn delete_plan(id: i32, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    plans::delete_plan(&conn, id)
}

#[tauri::command]
fn get_subscribers(search: String, state: State<AppState>) -> Result<Vec<subscribers::Subscriber>, String> {
    let conn = state.db.lock().unwrap();
    subscribers::get_subscribers(&conn, search)
}

#[tauri::command]
fn add_subscriber(full_name: String, phone: String, email: Option<String>, national_id: Option<String>, notes: Option<String>, state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    subscribers::add_subscriber(&conn, full_name, phone, email, national_id, notes)
}

#[tauri::command]
fn delete_subscriber(id: i32, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    subscribers::delete_subscriber(&conn, id)
}

#[tauri::command]
fn update_subscriber(id: i32, full_name: String, phone: String, email: Option<String>, national_id: Option<String>, notes: Option<String>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    subscribers::update_subscriber(&conn, id, full_name, phone, email, national_id, notes)
}

#[tauri::command]
fn get_subscriptions(state: State<AppState>) -> Result<Vec<subscriptions::Subscription>, String> {
    let conn = state.db.lock().unwrap();
    subscriptions::get_subscriptions(&conn)
}

#[tauri::command]
fn add_subscription(subscriber_id: i32, plan_id: i32, start_date: String, end_date: String, status: String, auto_renew: bool, state: State<AppState>) -> Result<i32, String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    subscriptions::add_subscription(&conn, subscriber_id, plan_id, start_date, end_date, status, auto_renew)
}

#[tauri::command]
fn renew_subscription(id: i32, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    subscriptions::renew_subscription(&conn, id)
}

#[tauri::command]
fn cancel_subscription(id: i32, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    subscriptions::cancel_subscription(&conn, id)
}

#[tauri::command]
fn get_payments(state: State<AppState>) -> Result<Vec<payments::Payment>, String> {
    let conn = state.db.lock().unwrap();
    payments::get_payments(&conn)
}

#[tauri::command]
fn add_payment(subscription_id: i32, amount: f64, payment_method: String, receipt_number: String, notes: Option<String>, state: State<AppState>) -> Result<i32, String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    payments::add_payment(&conn, subscription_id, amount, payment_method, receipt_number, notes)
}

#[tauri::command]
fn update_payment(id: i32, amount: f64, payment_method: String, receipt_number: String, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    payments::update_payment(&conn, id, amount, payment_method, receipt_number)
}

#[tauri::command]
fn delete_payment(id: i32, state: State<AppState>) -> Result<(), String> {
    check_admin(&state)?;
    let conn = state.db.lock().unwrap();
    payments::delete_payment(&conn, id)
}

#[tauri::command]
fn get_dashboard_stats(state: State<AppState>) -> Result<dashboard::DashboardStats, String> {
    let conn = state.db.lock().unwrap();
    dashboard::get_dashboard_stats(&conn)
}

#[tauri::command]
fn get_chart_data(state: State<AppState>) -> Result<Vec<dashboard::ChartDataPoint>, String> {
    let conn = state.db.lock().unwrap();
    dashboard::get_chart_data(&conn)
}

#[tauri::command]
fn check_license() -> bool {
    core_license::verify_license()
}

#[tauri::command]
fn activate_license(key: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    std::fs::write("license.lic", key).map_err(|e| e.to_string())?;
    
    if core_license::verify_license() {
        app_handle.exit(0);
        Ok(())
    } else {
        let _ = std::fs::remove_file("license.lic");
        Err("Invalid License Key".to_string())
    }
}

#[tauri::command]
fn get_webhook_secret() -> Result<String, String> {
    use sha2::Digest;
    let secret_path = std::path::Path::new(".webhook_secret");
    if secret_path.exists() {
        if let Ok(content) = std::fs::read_to_string(secret_path) {
            let trimmed = content.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(trimmed);
            }
        }
    }
    
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos().to_string();
    let mut hasher = sha2::Sha256::new();
    hasher.update(now.as_bytes());
    let hex_key = hex::encode(hasher.finalize());
    let _ = std::fs::write(secret_path, &hex_key);
    Ok(hex_key)
}

#[tauri::command]
fn rotate_webhook_secret() -> Result<String, String> {
    use sha2::Digest;
    let secret_path = std::path::Path::new(".webhook_secret");
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos().to_string();
    let mut hasher = sha2::Sha256::new();
    hasher.update(now.as_bytes());
    let hex_key = hex::encode(hasher.finalize());
    let _ = std::fs::write(secret_path, &hex_key);
    Ok(hex_key)
}

#[tauri::command]
fn sync_auth_session(role: Option<String>, state: State<AppState>) -> Result<(), String> {
    *state.current_user_role.lock().unwrap() = role;
    Ok(())
}

fn main() {
    let has_license = core_license::verify_license();
    
    // 1. Database Encryption
    let db_key = core_license::derive_db_key();
    let db = init_db("data.db", &db_key).expect("Failed to init db");
    
    if has_license {
        // 3. API Server in background (only if licensed)
        let api_db_key = db_key.clone();
        tokio::spawn(async move {
            core_api::start_api_server("data.db".to_string(), api_db_key).await;
        });
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            db: Mutex::new(db),
            current_user_role: Mutex::new(None),
            db_path: Mutex::new("data.db".to_string()),
        })
        .setup(move |app| {
            if !has_license {
                // Close main window
                if let Some(main_window) = app.get_webview_window("main") {
                    main_window.close().unwrap();
                }
                // Open activation window
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "activation",
                    tauri::WebviewUrl::App("/activation.html".into())
                )
                .title("Activate License")
                .inner_size(500.0, 400.0)
                .center()
                .build()
                .unwrap();
            } else {
                // 5. Periodic Job for Notifications and 9. Automated Backups
                let handle = app.handle().clone();
                
                // Notification Job
                tokio::spawn(async move {
                    loop {
                        tokio::time::sleep(Duration::from_secs(3600)).await; // hourly check
                        use tauri_plugin_notification::NotificationExt;
                        let _ = handle.notification().builder()
                            .title("System Check")
                            .body("Checked for expiring subscriptions.")
                            .show();
                    }
                });
                
                // Backup Job
                tokio::spawn(async move {
                    loop {
                        tokio::time::sleep(Duration::from_secs(86400)).await; // daily backup
                        if let Ok(mut path) = std::env::current_dir() {
                            path.push("data.db");
                            let mut backup_dir = std::env::current_dir().unwrap();
                            backup_dir.push("backups");
                            let _ = std::fs::create_dir_all(&backup_dir);
                            
                            let date = chrono::Local::now().format("%Y-%m-%d").to_string();
                            backup_dir.push(format!("data_backup_{}.db", date));
                            let _ = std::fs::copy(&path, &backup_dir);
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_system_setup, setup_system, login, sync_auth_session,
            get_subscribers, add_subscriber, update_subscriber, delete_subscriber,
            get_plans, add_plan, update_plan, delete_plan,
            get_subscriptions, add_subscription, renew_subscription, cancel_subscription,
            get_payments, add_payment, update_payment, delete_payment,
            get_dashboard_stats, get_chart_data, create_backup,
            check_license, activate_license, get_webhook_secret, rotate_webhook_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn create_backup(state: tauri::State<AppState>) -> Result<(), String> {
    let path = state.db_path.lock().unwrap().clone();
    let mut backup_dir = std::env::current_dir().unwrap();
    backup_dir.push("backups");
    let _ = std::fs::create_dir_all(&backup_dir);
    let date = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    backup_dir.push(format!("data_backup_{}.db", date));
    std::fs::copy(&path, &backup_dir).map_err(|e| e.to_string())?;
    Ok(())
}
