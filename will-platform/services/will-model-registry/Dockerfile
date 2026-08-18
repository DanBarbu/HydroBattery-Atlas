FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/will-model-registry ./cmd/will-model-registry
# Writable data dir owned by the distroless nonroot uid.
RUN mkdir -p /data && chown -R 65532:65532 /data

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/will-model-registry /will-model-registry
COPY --from=build --chown=65532:65532 /data /var/lib/will/model-registry
EXPOSE 8093
USER nonroot:nonroot
ENTRYPOINT ["/will-model-registry"]
