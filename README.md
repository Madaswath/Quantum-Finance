# Quantum Wealth Financial Super-App

A fiduciary private ledger and AI diagnostic service engine.

This project consists of an Angular frontend and a Python FastAPI backend with a PostgreSQL + pgvector database.

## Architecture

- **Frontend:** Angular 19+ application, communicating with the backend API.
- **Backend:** Python FastAPI application, serving the API routes.
- **Database:** PostgreSQL extended with `pgvector` for semantic embeddings.

## Prerequisites

- Node.js (for frontend)
- Docker and Docker Compose (for backend and database)

## Running the Application

### 1. Environment Setup

Copy `.env.example` to `.env` (or create a new `.env` file) in the root directory or `backend` directory depending on your setup. Make sure to set the following variables:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET_KEY=super_quantum_secure_secret_key_2026
```

*(Note: The frontend may also require `.env.local` based on its configuration, refer to `.env.example` if it exists.)*

### 2. Backend & Database (Docker)

To start the FastAPI backend and PostgreSQL database, run the following command from the root directory:

```bash
docker-compose up -d
```

This will build the backend image and start both the `backend-api` service on port `8000` and the `fintech-db` service on port `5432`.

Backend API Documentation will be available at: `http://localhost:8000/docs`

### 3. Frontend (Angular)

To run the Angular frontend locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`.

## Scripts (Frontend)

- `npm start` - Starts the Angular dev server.
- `npm run dev` - Starts the development server on port 3000 (accessible on local network).
- `npm run build` - Builds the application.
- `npm run test` - Runs unit tests.
- `npm run lint` - Runs linting.
