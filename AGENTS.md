# Antigravity Workspace Configuration: Grain Vision PWA

## Workspace Architecture
- **Root Directory:** `Z:\grain-vision-pwa-starter\grain-vision-pwa`
- **Backend Directory:** `./backend` (Handles analysis models and database/API routes)
- **Frontend Directory:** `./frontend` (Progressive Web App UI designed for smartphones)

## Global Constraints & Preferences
1. **Target Platform:** Mobile-first layout. The UI must be optimized entirely for smartphone screens (touch interfaces, compact scaling).
2. **Execution Guardrails:** 
   - Never modify backend files when assigned a frontend task.
   - Always request explicit approval before running terminal commands or installing new dependencies.
3. **Coding Standards:**
   - Write clean, performance-optimized, and modular code.
   - For backend computation, prioritize speed and low-latency handling.

## Multi-Agent Guidelines
- **Backend Agent Roles:** Focus heavily on endpoints, processing scripts, and data parsing logic.
- **Frontend Agent Roles:** Focus entirely on PWA features (service workers, offline caching, mobile-responsive layout). Always use light components to keep the app responsive on lower-end mobile devices.
