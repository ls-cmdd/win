use rusqlite::{Connection, Result};

mod embedded {
    use refinery::embed_migrations;
    embed_migrations!("../../migrations");
}

pub fn init_db(db_path: &str, key: &str) -> Result<Connection> {
    let mut conn = Connection::open(db_path)?;
    
    // Enable SQLCipher encryption
    conn.pragma_update(None, "key", key)?;
    
    // Run schema migrations using refinery
    embedded::migrations::runner().run(&mut conn).expect("Failed to run database migrations");
    
    Ok(conn)
}
