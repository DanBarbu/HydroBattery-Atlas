FROM python:3.12-alpine
WORKDIR /app
RUN pip install --no-cache-dir fastapi==0.115.0 uvicorn==0.30.6
COPY stub.py /app/stub.py
EXPOSE 7443
CMD ["uvicorn", "stub:app", "--host", "0.0.0.0", "--port", "7443"]
