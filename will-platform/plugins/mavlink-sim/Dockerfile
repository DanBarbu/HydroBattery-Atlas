FROM python:3.12-alpine
RUN apk add --no-cache build-base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ /app/
USER 1000:1000
CMD ["python", "-u", "mavlink_sim.py"]
