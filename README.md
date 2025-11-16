# Chatbot Automation Platform - V2.0 (Rebuilt from Scratch)

🚀 **Status**: Phase 1 Complete - Basic Infrastructure Ready

## Quick Start

### Railway Deployment (Current)

Railway will automatically deploy from the `main` branch.

**Expected behavior:**
1. ✅ Dockerfile multi-stage build (Node.js → Go → Alpine)
2. ✅ Frontend builds in `/app/dist/`
3. ✅ Backend compiles to `/app/server`
4. ✅ Health check available at `/healthz`
5. ✅ Frontend accessible at root URL

**Test checklist:**
- [ ] Railway build succeeds
- [ ] Health check responds: `{"status":"ok"}`
- [ ] Frontend loads (React app with "Chatbot Automation Platform" heading)
- [ ] No MIME type errors in browser console
- [ ] Static assets load from `/assets/` directory

### Local Development

```bash
# Frontend (development mode)
npm run dev
# Access: http://localhost:5173

# Backend (development mode)
go run cmd/server/main.go
# Access: http://localhost:8080

# Build frontend
npm run build

# Build backend
CGO_ENABLED=0 go build -o server.exe ./cmd/server

# Test production build locally
./server.exe
# Access: http://localhost:8080
```

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Go 1.23 + Fiber v2
- **Database**: Supabase (PostgreSQL via REST API)
- **Deployment**: Railway (Docker)

### Key Features
- ✅ Railway-optimized (immediate health check, no blocking initialization)
- ✅ Clean asset organization (no MIME type confusion)
- ✅ Supabase-only architecture (no PostgreSQL direct connection)
- ✅ Static binary (CGO_ENABLED=0 for Alpine Linux)

## Environment Variables

### Railway Environment Variables (Required)
```
PORT=8080                          # Automatically set by Railway
VITE_SUPABASE_URL=https://...     # Set in Railway dashboard
VITE_SUPABASE_ANON_KEY=eyJ...     # Set in Railway dashboard
```

### Build-time Variables (Docker)
```dockerfile
ARG VITE_SUPABASE_URL              # Injected during Docker build
ARG VITE_SUPABASE_ANON_KEY         # Injected during Docker build
```

## Project Structure

```
.
├── cmd/server/main.go             # Go server entry point
├── src/                           # React frontend source
│   ├── App.tsx                    # Main React component
│   ├── main.tsx                   # React entry point
│   └── integrations/supabase/     # Supabase client
├── dist/                          # Frontend build output
├── Dockerfile                     # Multi-stage build
├── railway.toml                   # Railway configuration
└── SYSTEM_ARCHITECTURE_COMPLETE.md # Full system documentation
```

## Deployment Status

### Latest Deployment
- Commit: 071c103
- Status: Deploying...
- Expected URL: https://chatbot-automation-production.up.railway.app

## Rollback

If needed, previous working system at commit `9257997`:
```bash
git checkout 9257997
```

## Next Phases

- [ ] **Phase 2**: Database schema in Supabase
- [ ] **Phase 3**: Backend core (handlers, services, models)
- [ ] **Phase 4**: Frontend core (auth, routing, components)
- [ ] **Phase 5**: Flow builder
- [ ] **Phase 6**: WhatsApp integrations
- [ ] **Phase 7**: AI integration

---

**Documentation**: See [SYSTEM_ARCHITECTURE_COMPLETE.md](SYSTEM_ARCHITECTURE_COMPLETE.md) for complete system architecture of the old system (reference for rebuilding).
