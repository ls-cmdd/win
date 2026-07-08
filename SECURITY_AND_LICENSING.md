# Security & Licensing Architecture Document

This document details the security model, cryptographic licensing framework, native user login architecture, and includes a guide (with fully-functional code) on how to build and operate the **License Activation Tool** for the system.

---

## 1. System Security Overview

The application is engineered as an **offline-first, zero-trust desktop application**. Unlike traditional cloud-dependent software, all customer and transaction data is kept exclusively on the operator's physical device, meaning:
* **Zero Cloud Exposure**: Sensitive client information, phone numbers, and cash ledger records never leave the local machine.
* **SQLCipher Encrypted Storage**: The database is fully encrypted at-rest using military-grade AES-256 (via SQLCipher).
* **Asymmetric License Defense**: System activation is secured through Ed25519 digital signatures, preventing key-gen bypasses or simple patch modifications.

---

## 2. Database Security & Key Derivation

The application utilizes a locally stored SQLite database, encrypted using **SQLCipher**. 

### A. Key Derivation Flow
To prevent direct file copy/theft (e.g., pulling the SQLite file onto another machine to read the data), the database encryption key is bound to the host hardware.

1. **Hardware Footprint Calculation**:
   During boot, the Rust kernel queries the host hardware via the `sysinfo` library to extract:
   * **Host Name**
   * **Total Memory (RAM)**
   * **First CPU Vendor ID**
   
   These fields are concatenated and hashed with **SHA-256** to generate a deterministic 64-character hex string representing the machine's hardware signature:
   $$\text{Footprint} = \text{SHA-256}(\text{HostName} \parallel \text{TotalMemory} \parallel \text{CPUVendorID})$$

2. **Key Generation**:
   The hardware footprint is mixed with a hardcoded application salt (`"submanager_db_key"`) and hashed via **SHA-256** to construct the dynamic SQLCipher key.
   $$\text{Database Key} = \text{SHA-256}(\text{"submanager_db_key"} \parallel \text{Footprint})$$

### B. Hardware Survivability Backup
To ensure that normal hardware upgrades (such as adding more RAM) do not corrupt or permanently lock users out of their databases:
* When the license is validated, the derived database key is encrypted using the **License Signature** as an encryption key (XOR stream cipher salted with SHA-256).
* This encrypted key is saved as a fallback under `.db_key_backup`.
* If hardware metrics change, the system can decrypt and restore the database key using the stable **License Signature** present in `license.lic`.

---

## 3. Native User Authentication Architecture

Authentication operates entirely inside the secure Rust thread, shielding passwords from memory sniffing or client-side JavaScript bypasses.

### A. Password Storage
User credentials are saved in the `users` table:
* **Password Hashing**: Plaintext passwords are never stored. The system hashes them natively using the **bcrypt** password hashing algorithm.
* **Salt Security**: bcrypt automatically generates unique, cryptographically strong random salts for each user during password registration or setup.
* **Computational Cost**: Uses a secure cost factor (`DEFAULT_COST`), forcing slow password checking to eliminate the feasibility of brute-force attacks.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'staff', 'accountant')),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### B. Verification Flow
1. The user inputs their username and password in the React login view.
2. The credentials are sent via a secure IPC bridge `invoke('login', { username, password })` to Rust.
3. The Rust kernel queries the SQLite database, pulls the associated `password_hash`, and executes `bcrypt::verify(password, hash)`.
4. If successful, Rust establishes a secure state session and returns the user object with their specific role (`admin`, `staff`, or `accountant`).
5. Role restrictions are enforced at the command level: administrative actions (like adding/deleting plans or payments) call `check_admin` inside Rust, failing early if the session holder lacks sufficient privileges.

---

## 4. Cryptographic License Verification

Licenses are verified offline using asymmetric public-key cryptography (**Ed25519**). This makes it mathematically impossible to forge a license key without possessing the secret private key.

### A. Components
* **Private Key** (Kept private by you): Used to sign machine footprints.
* **Public Key** (Hardcompiled into `core-license/src/lib.rs`):
  `PUBLIC_KEY_HEX = "e2d09a0614eb581971754ed8a25bb7e113a30c507c5dbff68c8191cb5df86b40"`
  Used to verify signatures.

### B. Verification Logic
On application launch:
1. Rust reads the `license.lic` file.
2. The file is split by the pipe symbol: `footprint|signature_hex`.
3. The system verifies:
   * **Footprint Matching**: That the footprint inside the license matches the current machine's physical footprint exactly.
   * **Asymmetric Signature**: That the signature of the footprint matches the compiled-in `PUBLIC_KEY_HEX` using the Ed25519 digital signature algorithm.
4. If both checks pass, the application opens. If failed, the user is redirected to the `activation.html` gate.

---

## 5. How to Build the License Activation Tool

To activate client installations, you must create an **Activation Key Generator Tool** that uses your private key to sign the client's machine footprint.

Below is a fully-functional, standalone Node.js script. This script utilizes the secure `@noble/curves` library to perform Ed25519 cryptographic signatures.

### A. Prerequisites
Install the required cryptographic packages:
```bash
npm install @noble/curves hex-to-binary
```

### B. Complete Key Generator Code (`generator.ts`)
Create a file named `generator.ts` with the following content:

```typescript
import { ed25519 } from '@noble/curves/ed25519';

// =========================================================================
// CRYPTOGRAPHIC KEYPAIR CONFIGURATION
// =========================================================================
// The public key corresponding to this private key is hardcoded in the app:
// "e2d09a0614eb581971754ed8a25bb7e113a30c507c5dbff68c8191cb5df86b40"
// Keep this private key strictly confidential!
const PRIVATE_KEY_HEX = "182db649f872365cb93822a138ff963884ffb23cb691f1ba4f783307521190bc";

/**
 * Generates a production license file contents.
 * @param machineFootprint The host footprint supplied by the client app
 */
export function generateLicense(machineFootprint: string): string {
  // 1. Clean the input footprint
  const footprint = machineFootprint.trim();
  if (!footprint) {
    throw new Error("Client hardware footprint cannot be empty!");
  }

  // 2. Convert key hex to byte array
  const privateKeyBytes = hexToBytes(PRIVATE_KEY_HEX);
  const messageBytes = new TextEncoder().encode(footprint);

  // 3. Cryptographically sign the machine footprint
  const signatureBytes = ed25519.sign(messageBytes, privateKeyBytes);
  const signatureHex = bytesToHex(signatureBytes);

  // 4. Construct the license structure
  return `${footprint}|${signatureHex}`;
}

// Helper utilities for byte manipulation
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =========================================================================
// CLI INTERACTIVE INTERFACE
// =========================================================================
function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("\n=======================================================");
    console.log("   Subscription System - License Key Generator Tool   ");
    console.log("=======================================================");
    console.log("Usage:   node generator.js <client_machine_footprint>");
    console.log("Example: node generator.js a5d8f61902ec56b78e2354cf89201fba45...\n");
    process.exit(1);
  }

  try {
    const footprint = args[0];
    const licenseContent = generateLicense(footprint);
    
    console.log("\n[SUCCESS] License key generated successfully!");
    console.log("\n--- COPY THE BLOCK BELOW ---");
    console.log(licenseContent);
    console.log("----------------------------");
    console.log("\nInstructions:\n1. Save the block above as a file named 'license.lic'\n2. Place it in the root folder of the subscriber software.");
  } catch (err: any) {
    console.error("\n[ERROR] Failed to generate license:", err.message);
  }
}

// Execute CLI if run directly
if (require.main === module) {
  main();
}
```

### C. Running the Generator
To generate a license for a customer:
1. Compile the script or run it directly using `ts-node` or `node`:
   ```bash
   npx ts-node generator.ts <CLIENT_FOOTPRINT_HEX>
   ```
2. Copy the resulting output (e.g. `a5d8f6...|3f2a8c...`).
3. Save it as `license.lic` and send it to the client. Placing this file next to the executable will instantly activate their system.
