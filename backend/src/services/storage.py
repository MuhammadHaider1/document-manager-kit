import asyncio
from typing import Any

import aioboto3
from botocore.exceptions import ClientError

from src.core.config import settings


class S3StorageManager:
    def __init__(self) -> None:
        self.session = aioboto3.Session()

    # 1. Return type ko Any set karein taake wrapper dynamic resolution chalaye
    def get_client(self) -> Any:
        protocol = "https" if settings.MINIO_SECURE else "http"
        complete_url = f"{protocol}://{settings.MINIO_ENDPOINT}"

        return self.session.client(
            "s3",
            endpoint_url=complete_url,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            use_ssl=settings.MINIO_SECURE,
        )

    def get_presign_client(self) -> Any:
        """Client used only to *sign* URLs that the browser will fetch.

        Presigning is local: it never opens a connection, so pointing this at
        the public origin costs nothing. It matters because the signature covers
        the ``Host`` header, so a URL signed for the internal Docker hostname
        (`minio:9000`) would fail when the browser requests the public one.
        Falls back to ``MINIO_ENDPOINT`` when no public origin is configured.
        """
        endpoint = settings.MINIO_PUBLIC_ENDPOINT or settings.MINIO_ENDPOINT
        secure = settings.MINIO_SECURE
        if "://" in endpoint:
            scheme, _, endpoint = endpoint.partition("://")
            secure = scheme.lower() == "https"

        return self.session.client(
            "s3",
            endpoint_url=f"{'https' if secure else 'http'}://{endpoint}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            use_ssl=secure,
        )

    async def initialize_bucket(self, attempts: int = 10, delay: float = 2.0) -> None:
        """Application startup (lifespan) par bucket ensure karne ke liye.

        Object storage can still be starting when the API boots, so a failure is
        retried instead of crashing the whole app; only a persistent error is
        re-raised.
        """
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                # 2. Yahan context manager initialization line ke end par type
                # ignore lagayein
                async with self.get_client() as s3:  # type: ignore
                    try:
                        await s3.head_bucket(Bucket=settings.MINIO_BUCKET_NAME)
                        print(
                            f"📦 [MinIO] Bucket '{settings.MINIO_BUCKET_NAME}' "
                            "already exists."
                        )
                    except ClientError as e:
                        error_code = e.response.get("Error", {}).get("Code")
                        if error_code in ["404", "NoSuchBucket"]:
                            print(
                                f"🚀 [MinIO] Bucket '{settings.MINIO_BUCKET_NAME}' "
                                "not found. Creating..."
                            )
                            await s3.create_bucket(Bucket=settings.MINIO_BUCKET_NAME)
                            print(
                                f"✅ [MinIO] Bucket '{settings.MINIO_BUCKET_NAME}' "
                                "successfully created!"
                            )
                        else:
                            raise
                return
            except Exception as e:  # noqa: BLE001 - retried below, re-raised after
                last_error = e
                if attempt == attempts:
                    break
                print(
                    f"⏳ [MinIO] Not reachable yet (attempt {attempt}/{attempts}): {e}"
                )
                await asyncio.sleep(delay)

        raise RuntimeError(
            f"[MinIO] Could not initialise bucket '{settings.MINIO_BUCKET_NAME}' "
            f"after {attempts} attempts"
        ) from last_error


storage_manager = S3StorageManager()
