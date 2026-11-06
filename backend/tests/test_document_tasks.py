"""Regression tests for the Celery async bridge.

Each Celery task calls ``asyncio.run`` in a long-lived worker process. The
SQLAlchemy async pool must not hand connections from one event loop to the
next, otherwise retries and failure updates die with
``attached to a different loop`` and documents stay stuck in ``processing``.
"""

import pytest

from src.tasks import document_tasks
from src.tasks.celery_app import app


def test_celery_uses_a_namespaced_default_queue():
    assert app.conf.task_default_queue == "docuflow"
    assert app.conf.task_default_exchange == "docuflow"
    assert app.conf.task_default_routing_key == "docuflow"


def test_run_async_disposes_engine_after_success(monkeypatch: pytest.MonkeyPatch):
    disposed: list[bool] = []

    class FakeEngine:
        async def dispose(self) -> None:
            disposed.append(True)

    async def work() -> str:
        return "done"

    monkeypatch.setattr(document_tasks, "engine", FakeEngine())

    assert document_tasks.run_async(work()) == "done"
    assert disposed == [True]


def test_run_async_disposes_engine_when_the_coroutine_fails(
    monkeypatch: pytest.MonkeyPatch,
):
    disposed: list[bool] = []

    class FakeEngine:
        async def dispose(self) -> None:
            disposed.append(True)

    async def work() -> None:
        raise RuntimeError("extraction failed")

    monkeypatch.setattr(document_tasks, "engine", FakeEngine())

    with pytest.raises(RuntimeError, match="extraction failed"):
        document_tasks.run_async(work())

    # The failure path still has to be able to mark the document failed.
    assert disposed == [True]
