# Scott-Phillips Family Reunion Website

A full-stack web application for the Scott-Phillips Family Reunion, providing family history, genealogy, blog posts, event information, and member profiles.

## Architecture

| Layer | Technology | Directory |
|-------|-----------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, MUI, Tailwind CSS | `frontend/` |
| Backend | Spring Boot 3.4, Java 21, jOOQ, Spring Security | `backend/` |
| Database | Azure SQL Server | — |
| Storage | Azure Blob Storage + Azure Front Door CDN | — |
| Email | Gmail SMTP (Spring Mail) | — |

## Prerequisites

- **Node.js** 18+ and npm
- **Java** 21+ (JDK)
- **Gradle** 8+ (wrapper included)
- **Azure SQL Server** database (or SQL Server for local dev)

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd scott-phillips-reunion-ui
```

### 2. Backend Setup

```bash
cd backend

# Copy environment template and fill in your credentials
cp .env.example .env

# Run the Spring Boot server
./gradlew bootRun
```

The backend starts at `http://localhost:8080`.

### 3. Frontend Setup

```bash
cd frontend

# Copy environment template
cp .env.example .env.local

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend starts at `http://localhost:3000`.

## Project Structure

```
├── frontend/               Next.js app
│   ├── app/
│   │   ├── admin/          Admin dashboard (signup approvals, moderation)
│   │   ├── ancestry/       9 descendant family pages
│   │   ├── blog/           Blog with TinyMCE editor
│   │   ├── components/     Shared components (ErrorBoundary, Navigation, etc.)
│   │   ├── contact-us/     Contact form
│   │   ├── dues/           Payment page (placeholder)
│   │   ├── family-tree/    Interactive D3 family tree
│   │   ├── history/        Family history, records, meeting minutes
│   │   ├── landing/        Landing page component
│   │   ├── lib/            API client, types, utilities
│   │   ├── login/          Login page
│   │   ├── memorial/       Memorial / memories section
│   │   ├── newsletters/    Newsletter archive
│   │   ├── profile/        User profile view/edit
│   │   ├── reunion/        Reunion information
│   │   ├── signup/         Registration with admin approval
│   │   └── utils/          Utility functions
│   └── public/images/      Static images
│
├── backend/                Spring Boot app
│   └── src/main/java/com/scottfamily/scottfamily/
│       ├── config/         Security, CORS, Azure Storage config
│       ├── controller/     REST API controllers
│       ├── dto/            Data transfer objects
│       ├── properties/     Configuration property bindings
│       └── service/        Business logic services
```

## Key Features

- **Session-based authentication** with Spring Security (BCrypt passwords)
- **Admin approval workflow** for new signups and profile changes
- **Family tree visualization** using D3.js hierarchy
- **Blog system** with rich text editing (TinyMCE)
- **CDN image pipeline** — uploads to Azure Blob Storage, served via Azure Front Door
- **Responsive design** with MUI components and mobile navigation drawer
- **Role-based access control** (USER / ADMIN)

## Scripts

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Backend

| Command | Description |
|---------|-------------|
| `./gradlew bootRun` | Start Spring Boot dev server |
| `./gradlew build` | Build JAR |
| `./gradlew test` | Run tests |
| `./gradlew generateJooq` | Regenerate jOOQ classes from database schema |

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` for required configuration.

> **Security Note**: Never commit real credentials to source control. Use environment variables or a secrets manager for production deployments.
