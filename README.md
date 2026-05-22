# Copal — Gestión de Redes Sociales

Aplicación web privada para publicar y programar contenido en Instagram, Facebook y LinkedIn.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + TypeScript + Express.js |
| Base de datos | PostgreSQL via Prisma ORM |
| Storage | Cloudinary |
| Auth | JWT (access 15min + refresh 7d httpOnly cookie) |

---

## Setup rápido (Docker)

### 1. Variables de entorno

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` con tus valores reales (ver sección Variables de entorno más abajo).

Genera una ENCRYPTION_KEY de 64 hex chars:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Levantar servicios

```bash
docker compose up -d
```

Esto inicia PostgreSQL y el backend en `http://localhost:4000`.

### 3. Migrations + seed

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

Usuario inicial: `admin@copal.app` / `admin123`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`

---

## Setup manual (desarrollo local)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # editar con tus valores
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `development` o `production` |
| `PORT` | Puerto del backend (default: 4000) |
| `FRONTEND_URL` | URL del frontend (ej: http://localhost:5173) |
| `JWT_SECRET` | Secret para access tokens (mín 32 chars) |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens (mín 32 chars) |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) para AES-256-GCM |
| `DATABASE_URL` | PostgreSQL connection string |

| `META_APP_ID` | ID de tu Meta App |
| `META_APP_SECRET` | Secret de tu Meta App |
| `META_REDIRECT_URI` | `http://localhost:4000/api/oauth/meta/callback` |
| `LINKEDIN_CLIENT_ID` | Client ID de LinkedIn App |
| `LINKEDIN_CLIENT_SECRET` | Client Secret de LinkedIn App |
| `LINKEDIN_REDIRECT_URI` | `http://localhost:4000/api/oauth/linkedin/callback` |
| `CLOUDINARY_CLOUD_NAME` | Nombre de tu cuenta Cloudinary |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary |

---

## Conectar cuentas Meta (Facebook + Instagram)

1. Crea una app en [Meta for Developers](https://developers.facebook.com).
2. Agrega los productos: **Facebook Login** e **Instagram Graph API**.
3. En "Valid OAuth Redirect URIs" agrega: `http://localhost:4000/api/oauth/meta/callback`
4. En Permisos solicita: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `pages_show_list`.
5. Para producción, solicita revisión de permisos en Meta.
6. Copia `App ID` y `App Secret` a `.env`.
7. En la app ve a **Cuentas → Conectar → Facebook**.
8. El flujo OAuth guarda el Page Access Token cifrado. Nunca viaja al frontend.

### Instagram via Graph API

Instagram requiere una Página de Facebook vinculada a la cuenta de Instagram Business/Creator. El token de la página sirve para publicar en Instagram asociado.

---

## Conectar LinkedIn

1. Crea una app en [LinkedIn Developer Portal](https://www.linkedin.com/developers/).
2. En "Auth" agrega Redirect URL: `http://localhost:4000/api/oauth/linkedin/callback`
3. Solicita los scopes: `openid`, `profile`, `w_member_social`.
4. Copia `Client ID` y `Client Secret` a `.env`.
5. En la app ve a **Cuentas → Conectar → LinkedIn**.

---

## Estructura de carpetas

```
copal/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Esquema de BD completo
│   │   └── seed.ts             # Usuario admin inicial
│   └── src/
│       ├── index.ts            # Entry point + worker startup
│       ├── config.ts           # Validación de env vars con Zod
│       ├── prisma.ts           # Singleton PrismaClient
│       ├── middleware/
│       │   ├── auth.middleware.ts
│       │   ├── error.middleware.ts
│       │   └── upload.middleware.ts
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── oauth.routes.ts
│       │   ├── posts.routes.ts
│       │   ├── media.routes.ts
│       │   ├── publications.routes.ts
│       │   ├── accounts.routes.ts
│       │   ├── settings.routes.ts
│       │   └── dashboard.routes.ts
│       ├── services/
│       │   ├── instagram.service.ts  # Instagram Graph API
│       │   ├── facebook.service.ts   # Meta Graph API
│       │   ├── linkedin.service.ts   # LinkedIn UGC API
│       │   ├── cloudinary.service.ts
│       │   └── scheduler.service.ts
│       ├── workers/
│       │   └── db-scheduler.ts
│       └── utils/
│           ├── crypto.ts       # AES-256-GCM encrypt/decrypt
│           └── jwt.ts          # Access + refresh tokens
└── frontend/
    └── src/
        ├── api/                # Clientes HTTP por dominio
        ├── components/         # Layout, Sidebar, UI primitivos
        ├── hooks/              # useAuth, useToast
        ├── pages/              # Una página por ruta
        └── types/              # Tipos compartidos TypeScript
```

---

## API Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con email/password |
| POST | `/api/auth/logout` | Invalida refresh token |
| POST | `/api/auth/refresh` | Rota refresh token y devuelve nuevo access token |
| GET | `/api/auth/me` | Perfil del usuario autenticado |
| GET | `/api/oauth/meta/connect` | Inicia OAuth Meta |
| GET | `/api/oauth/meta/callback` | Callback OAuth Meta |
| GET | `/api/oauth/linkedin/connect` | Inicia OAuth LinkedIn |
| GET | `/api/oauth/linkedin/callback` | Callback OAuth LinkedIn |
| GET/POST | `/api/posts` | Listar / crear posts |
| GET/PUT/DELETE | `/api/posts/:id` | Obtener / actualizar / eliminar post |
| GET | `/api/publications` | Listar publicaciones programadas |
| POST | `/api/publications/:id/retry` | Reintentar publicación fallida |
| GET | `/api/publications/:id/logs` | Logs de una publicación |
| POST | `/api/media/upload` | Subir archivo a Cloudinary |
| GET/DELETE | `/api/media` · `/api/media/:id` | Listar / eliminar media |
| GET/DELETE/PATCH | `/api/accounts` | Cuentas conectadas |
| GET/PATCH | `/api/settings` | Configuración del usuario |
| GET | `/api/dashboard/metrics` | Métricas del dashboard |

---

## Flujo de publicación

1. Usuario crea un post con `status: scheduled` y `scheduled_at`.
2. El backend crea un registro en `scheduled_publications`.
3. El scheduler DB-based (corriendo en el mismo proceso) se activa en el momento correcto.
4. Llama al adapter correspondiente (instagram/facebook/linkedin service).
5. En caso de éxito: actualiza estado a `published`, guarda log.
6. En caso de fallo: reintenta hasta 3 veces con backoff exponencial (1min, 2min, 4min).
7. Después del 3er fallo: marca como `failed`. El usuario puede reintentar manualmente.
7. Las publicaciones programadas persisten en PostgreSQL y sobreviven reinicios del servidor.

---

## Seguridad

- Tokens de redes sociales almacenados cifrados con AES-256-GCM. Nunca se exponen al frontend.
- Archivos validados por tipo MIME real (no solo extensión) via multer.
- Todas las rutas del backend protegidas por `requireAuth` middleware excepto `/api/auth/login`.
- Rate limiting en `/api/auth` (20 req/15min).
- Helmet.js activo en producción.
- Cookies httpOnly para refresh tokens.
- CORS restringido a `FRONTEND_URL`.
