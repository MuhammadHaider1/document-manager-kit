import os

from celery import Celery

# The defaults match docker-compose.yml. Deployments can point the worker at a
# managed Redis instance without editing code by setting the env vars.
app = Celery(
    "docuflow_celery",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6380/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6380/1"),
    include=["src.tasks.document_tasks"],
)

app.autodiscover_tasks(["src.tasks"])

if __name__ == "__main__":
    app.start()

import src.tasks.document_tasks  # noqa: E402, F401
