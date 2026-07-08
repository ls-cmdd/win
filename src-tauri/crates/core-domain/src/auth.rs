use bcrypt::{hash, verify, DEFAULT_COST};

/// Hashes a plain-text password using the bcrypt algorithm with a default cost factor.
pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    hash(password, DEFAULT_COST)
}

/// Verifies a plain-text password against a hashed bcrypt password string.
pub fn verify_password(password: &str, hash_str: &str) -> bool {
    verify(password, hash_str).unwrap_or(false)
}
