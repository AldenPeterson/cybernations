# CyberNations - Full Stack Application

A modern full-stack application with React frontend and Express.js backend, structured as a monorepo.

## Project Structure

```
cybernations/
├── frontend/          # React + Vite frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── backend/           # Express.js backend
│   ├── src/
│   │   ├── routes/
│   │   └── index.ts
│   └── package.json
├── package.json       # Root workspace configuration
└── README.md
```

## Features

- **Frontend**: React 19 with TypeScript and Vite
- **Backend**: Express.js with TypeScript
- **Monorepo**: npm workspaces for dependency management
- **Development**: Hot reload for both frontend and backend
- **API Proxy**: Vite proxy for seamless API calls during development

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```

   This will start both:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

### Individual Commands

**Frontend only:**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

**Build everything:**
```bash
npm run build
```

## API Endpoints

The backend provides the following endpoints:

- `GET /health` - Health check
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `GET /api/protected` - Example protected route

## Development

### Adding New API Routes

1. Create route files in `backend/src/routes/`
2. Import and use them in `backend/src/index.ts`
3. The frontend can call them via `/api/your-route`

### Frontend API Calls

The Vite proxy automatically forwards `/api/*` and `/health` requests to the backend during development. In production, you'll need to configure your deployment to handle these routes.

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Deployment

### Frontend
Build and deploy the `frontend/dist` directory to your static hosting service (Vercel, Netlify, etc.).

### Backend
Build and deploy the backend as a Node.js service:

```bash
cd backend
npm run build
npm start
```

## Architecture Benefits

1. **Separation of Concerns**: Frontend and backend are clearly separated
2. **Independent Development**: Teams can work on frontend and backend independently
3. **Shared Dependencies**: Common dependencies can be managed at the root level
4. **Easy Testing**: Each service can be tested independently
5. **Scalability**: Services can be deployed and scaled independently

## Next Steps

- Add authentication (JWT, OAuth)
- Implement database integration (PostgreSQL, MongoDB)
- Add API documentation (Swagger/OpenAPI)
- Set up CI/CD pipelines
- Add testing frameworks (Jest, Cypress)
- Implement error monitoring (Sentry)