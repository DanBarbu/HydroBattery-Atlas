FROM python:3.12-alpine
WORKDIR /app
RUN pip install --no-cache-dir grpcio==1.66.2 grpcio-tools==1.66.2 protobuf==5.28.2
COPY src/ /app/
USER 1000:1000
EXPOSE 50051
CMD ["python", "-u", "echo_plugin.py"]
