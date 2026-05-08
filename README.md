# GymTrack — Attendance Management System

A production-ready Gym Attendance application built with Node.js, Express, Prisma, and SQLite.

## Features
- **MVC Architecture**: Clean separation of concerns.
- **Member Management**: Full CRUD for gym members.
- **QR Code System**: Automatic QR generation for members; webcam-based scanner for check-in/out.
- **Dashboard**: Real-time stats and plan breakdown charts.
- **Attendance Logs**: Detailed history with CSV export capabilities.
- **Security**: 
  - Password hashing with Bcrypt.
  - CSRF protection on all state-changing routes.
  - Secure session management.
  - Input validation with express-validator.
  - Rate limiting on login.
- **Premium UI**: Dark mode, glassmorphism, and responsive design using Bootstrap 5 and custom CSS.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and configure your secrets.
   ```bash
   cp .env.example .env
   ```

3. **Database Migration**:
   Initialize the SQLite database.
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed Data**:
   Populate the database with an admin user and sample members.
   ```bash
   npm run db:seed
   ```
   **Default Credentials:**
   - **Admin**: `admin` / `adminpassword123`
   - **Staff**: `staff` / `staff123`

5. **Run the App**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: Prisma ORM, SQLite (Dev), PostgreSQL (Prod ready)
- **Frontend**: EJS Templates, Bootstrap 5, Chart.js, jsQR
- **Security**: Helmet, CSRF, Bcrypt, express-session
