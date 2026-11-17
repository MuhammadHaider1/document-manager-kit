from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from src.api.v1 import comment
from src.api.v1.audit import router as audit_router
from src.api.v1.auth import router as auth_router
from src.api.v1.chat import router as chat_router
from src.api.v1.documents import router as doc_router
from src.api.v1.members import router as members_router
from src.api.v1.notification import router as notification_router
from src.api.v1.organizations import router as org_router
from src.api.v1.rag import router as rag_router
from src.api.v1.rbac import router as rbac_router
from src.core.config import settings
from src.core.database import SessionLocal, engine
from src.core.limiter import limiter
from src.core.seeding import seed_all_rbac
from src.models import Base
from src.services.storage import storage_manager


# 1. Lifespan Context Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Database tables schema verification. The API owns its schema, so
    # a fresh deployment needs no manual init step.
    async with engine.begin() as conn:
        # ``documentchunk.embedding`` is a ``vector(384)`` column, so the
        # pgvector type has to exist before the table that uses it is created.
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # ``create_all`` never alters an existing table, so add the columns the
        # chunker needs on databases created before they existed.
        await conn.execute(
            text(
                "ALTER TABLE documentchunk "
                "ADD COLUMN IF NOT EXISTS chunk_index INTEGER, "
                "ADD COLUMN IF NOT EXISTS page_number INTEGER"
            )
        )

    # Storage bucket initialization
    await storage_manager.initialize_bucket()

    # RBAC seeding is idempotent, so it is safe on every boot and guarantees a
    # fresh database has the roles and permissions the API checks against.
    async with SessionLocal() as session:
        await seed_all_rbac(session)

    yield
    # Shutdown logic (if needed in future)


# 2. FastAPI Application Instance Setup
app = FastAPI(title="DocuFlow API", lifespan=lifespan)

# SlowAPI Limiter Middleware & Exception Handlers
app.state.limiter = limiter


async def rate_limit_handler(request: Request, exc: Exception) -> Response:
    return _rate_limit_exceeded_handler(request, cast(RateLimitExceeded, exc))


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS is added last so it is the outermost middleware: a browser preflight is
# answered before the rate limiter sees it. A same-origin deployment (UI and API
# behind one host) sends no cross-origin requests, so this stays a no-op there.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Router Inclusions
app.include_router(org_router, prefix="/api/v1", tags=["Organizations"])
app.include_router(auth_router, prefix="/api/v1", tags=["Authentication"])
app.include_router(doc_router, prefix="/api/v1", tags=["Documents & Folders"])
app.include_router(rbac_router, prefix="/api/v1", tags=["RBAC"])
app.include_router(comment.router, prefix="/api/v1", tags=["Comments"])
app.include_router(audit_router, prefix="/api/v1", tags=["Audit Logs"])
app.include_router(notification_router, prefix="/api/v1", tags=["Notifications"])
app.include_router(members_router, prefix="/api/v1", tags=["Members"])
app.include_router(rag_router, prefix="/api/v1", tags=["RAG"])
app.include_router(chat_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "DocuFlow API"}
