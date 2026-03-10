"""
Celery worker entry point.

Start worker:
    celery -A celery_worker.celery worker --loglevel=info

Start beat (scheduler):
    celery -A celery_worker.celery beat --loglevel=info
"""
from app import create_app
from tasks import make_celery

flask_app = create_app("development")
celery = make_celery(flask_app)

# Import tasks so they are registered with Celery
import tasks  # noqa: F401
