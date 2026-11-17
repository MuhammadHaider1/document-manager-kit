from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.config import settings

# Async Engine Setup
engine = create_async_engine(
    str(settings.DATABASE_URI),
    pool_pre_ping=True,
    echo=False,
)


# Session Factory
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# The declarative base and all model classes live in ``src.models``; import
# ``Base`` from there (``from src.models import Base``) so ``Base.metadata``
# actually contains the tables.


# Dependency to get DB Session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
