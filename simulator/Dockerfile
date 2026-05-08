FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY produce.py .
ENV KAFKA_BOOTSTRAP=kafka:29092 \
    EVENTS_PER_SECOND=5
CMD ["python", "produce.py"]
