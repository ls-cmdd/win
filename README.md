# Subscription Management System

A comprehensive offline-first subscription management desktop application built with React, Tauri v2, and Rust. 
It helps you manage subscribers, subscription plans, active subscriptions, and payments all in a local SQLite database (SQLCipher encrypted).

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand, React-Hook-Form.
- **Backend/Core**: Tauri v2, Rust.
- **Database**: SQLite (via rusqlite with SQLCipher encryption support).

## Prerequisites

- Node.js (v18+)
- Rust (latest stable)
- Tauri v2 dependencies for Windows development.

## Setup & Running Locally

1. Install npm dependencies:
```bash
npm install
```

2. Run the application in development mode (starts Vite + Tauri app):
```bash
npm run tauri dev
```

3. Build the application for production:
```bash
npm run tauri build
```

## Features

- **Dashboard**: Gives an overview of active subscribers, monthly revenue, and subscriptions expiring soon.
- **Subscribers Management**: Add, view, search, and manage user details securely.
- **Plans**: Create and manage subscription plans.
- **Subscriptions**: Assign plans to subscribers, manage status and renewal.
- **Payments**: Record payments for subscriptions, generate unique receipt numbers.
- **Multi-language**: Built-in support for English and Arabic (RTL).
- **Secure Offline Storage**: All data is kept securely on the local encrypted database.

## Architecture & Code organization

- `src-tauri/` - Rust Tauri backend workspace containing `core-db` and `core-domain` crates for database logic and domain rules.
- `src/` - React frontend with specific feature modules (subscribers, plans, subscriptions, payments).

## GitHub Actions

There is a GitHub Action configured in `.github/workflows/release.yml`. Whenever you push a tag that starts with `v` (e.g. `v1.0.0`), the action will build the Windows `.exe` and create a GitHub Release draft.
# sub
# sub
# sub
# subs
# subs
# subs
# sub
