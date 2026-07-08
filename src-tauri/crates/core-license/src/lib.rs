use ed25519_dalek::{Verifier, VerifyingKey, Signature};
use sysinfo::System;
use sha2::{Sha256, Digest};

// We will use a hardcoded public key for the license verification (in a real app this is compiled in).
// To generate: a proper keypair would be used.
const PUBLIC_KEY_HEX: &str = "e2d09a0614eb581971754ed8a25bb7e113a30c507c5dbff68c8191cb5df86b40";

pub fn get_machine_footprint() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Combine some hardware info to form a unique footprint
    let host = System::host_name().unwrap_or_else(|| "unknown_host".to_string());
    let mac = "00:00:00:00:00:00"; // fallback if mac address is hard to get cross-platform without extra crates
    // sysinfo doesn't provide MAC out of the box in 0.30 easily, we'll use total memory + cpu vendor + host as a mock footprint
    let mem = sys.total_memory();
    let cpu = sys.cpus().get(0).map(|c| c.vendor_id()).unwrap_or("unknown_cpu");
    
    let raw = format!("{}-{}-{}", host, mem, cpu);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn get_license_signature() -> Option<String> {
    let lic_path = std::path::Path::new("license.lic");
    if !lic_path.exists() { return None; }
    let content = std::fs::read_to_string(lic_path).ok()?;
    let parts: Vec<&str> = content.split('|').collect();
    if parts.len() != 2 { return None; }
    Some(parts[1].to_string())
}

pub fn derive_db_key() -> String {
    let backup_path = std::path::Path::new(".db_key_backup");
    
    // Attempt to restore from backup
    if backup_path.exists() {
        if let Some(sig) = get_license_signature() {
            if let Ok(encrypted_hex) = std::fs::read_to_string(backup_path) {
                if let Ok(encrypted_bytes) = hex::decode(encrypted_hex.trim()) {
                    let mut hasher = Sha256::new();
                    hasher.update(sig.as_bytes());
                    let key_bytes = hasher.finalize();
                    
                    let decrypted_bytes: Vec<u8> = encrypted_bytes.iter().zip(key_bytes.iter().cycle()).map(|(d, k)| d ^ k).collect();
                    if let Ok(decrypted_str) = String::from_utf8(decrypted_bytes) {
                        return decrypted_str;
                    }
                }
            }
        }
    }

    let fp = get_machine_footprint();
    let mut hasher = Sha256::new();
    hasher.update(b"submanager_db_key");
    hasher.update(fp.as_bytes());
    let db_key = hex::encode(hasher.finalize());
    
    // Backup if possible
    if let Some(sig) = get_license_signature() {
        let mut key_hasher = Sha256::new();
        key_hasher.update(sig.as_bytes());
        let cipher_key = key_hasher.finalize();
        
        let encrypted_bytes: Vec<u8> = db_key.as_bytes().iter().zip(cipher_key.iter().cycle()).map(|(d, k)| d ^ k).collect();
        let _ = std::fs::write(backup_path, hex::encode(encrypted_bytes));
    }
    
    db_key
}

pub fn verify_license() -> bool {
    let lic_path = std::path::Path::new("license.lic");
    if !lic_path.exists() {
        return false; 
    }

    
    let content = match std::fs::read_to_string(lic_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    
    // Assume license format: "footprint|signature_hex"
    let parts: Vec<&str> = content.split('|').collect();
    if parts.len() != 2 { return false; }
    
    let lic_footprint = parts[0];
    let sig_hex = parts[1];
    
    let actual_footprint = get_machine_footprint();
    if lic_footprint != actual_footprint { return false; }
    
    let pub_bytes = match hex::decode(PUBLIC_KEY_HEX) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let public_key = match VerifyingKey::from_bytes(pub_bytes.as_slice().try_into().unwrap()) {
        Ok(k) => k,
        Err(_) => return false,
    };
    
    let sig_bytes = match hex::decode(sig_hex) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let signature = match Signature::from_slice(&sig_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };
    
    public_key.verify(lic_footprint.as_bytes(), &signature).is_ok()
}
