FROM python:3.11-slim

# HF Spaces run containers under a fixed, non-root user for security — match
# that here so file ownership is correct from the start.
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Fixed, explicit cache location, set before anything downloads a model — so
# build-time (root) and run-time (appuser) agree on the same path, rather
# than silently re-downloading at startup due to a $HOME mismatch.
ENV HOME=/home/appuser
ENV HF_HOME=/app/.cache/huggingface

COPY requirements.txt .

# CPU-only torch first — same fix used for Render. sentence-transformers
# would otherwise pull in the full CUDA build, pure dead weight on hardware with no GPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download both models at build time, not at container startup — the
# same fix that solved the slow/looping startup issue on Render.
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; SentenceTransformer('all-MiniLM-L6-v2'); CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

COPY . .

# Hand ownership of the app code + the model cache just downloaded as root
# over to the non-root user before actually running as that user.
RUN chown -R appuser:appuser /app /home/appuser
USER appuser

# Cloud Run injects $PORT dynamically (typically 8080); fall back to 7860
# for local runs or HF Spaces where $PORT isn't set.
EXPOSE 7860
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}