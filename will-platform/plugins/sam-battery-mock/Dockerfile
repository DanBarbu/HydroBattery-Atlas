FROM python:3.12-alpine
WORKDIR /app
COPY src/ /app/
USER 1000:1000
CMD ["python", "-u", "sam_battery_mock.py"]
