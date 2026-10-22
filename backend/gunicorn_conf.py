# Production Gunicorn configuration for GRAIN-VISION backend
import multiprocessing
import os

bind = os.getenv("BIND_ADDRESS", "0.0.0.0:8000")
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"

# Timeout & Keepalive configured to prevent timeouts on high-density grain samples
timeout = int(os.getenv("TIMEOUT", "120"))
keepalive = int(os.getenv("KEEPALIVE", "5"))

# Logging
loglevel = os.getenv("LOG_LEVEL", "info")
accesslog = "-"
errorlog = "-"

# SSL / TLS configuration (if terminating SSL at application level)
keyfile = os.getenv("SSL_KEYFILE", None)
certfile = os.getenv("SSL_CERTFILE", None)
