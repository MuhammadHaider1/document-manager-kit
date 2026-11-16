import os

from celery import Celery

from src.core.config import settings

# The defaults match docker-compose.yml. Deployments can point the worker at a
# managed Redis instance without editing code by setting the env vars.
app = Celery(
    "docuflow_celery",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6380/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6380/1"),
    include=["src.tasks.document_tasks"],
)

# Redis may be shared by several local applications. A namespaced queue keeps
# this worker from consuming stale or unrelated jobs from Celery's generic
# ``celery`` queue, while still allowing deployments to override the name.
app.conf.task_default_queue = os.getenv("CELERY_TASK_DEFAULT_QUEUE", "docuflow")
app.conf.task_default_exchange = app.conf.task_default_queue
app.conf.task_default_routing_key = app.conf.task_default_queue

# A book-sized PDF can take minutes to embed on CPU. These limits stop a single
# stuck job from occupying a worker slot forever; the hard limit is a last
# resort after the soft limit has had a chance to fail the task cleanly.
app.conf.task_soft_time_limit = settings.CELERY_TASK_SOFT_TIME_LIMIT
app.conf.task_time_limit = settings.CELERY_TASK_TIME_LIMIT

app.autodiscover_tasks(["src.tasks"])

if __name__ == "__main__":
    app.start()

import src.tasks.document_tasks  # noqa: E402, F401
