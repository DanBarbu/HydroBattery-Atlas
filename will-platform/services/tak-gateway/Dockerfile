FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/tak-gateway ./cmd/tak-gateway
# Writable state dir for the install/first-run decision record, owned by the
# distroless nonroot uid so the running container can persist a decision.
RUN mkdir -p /data && chown -R 65532:65532 /data

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/tak-gateway /tak-gateway
COPY --from=build --chown=65532:65532 /data /var/lib/will/tak-gateway
EXPOSE 8092
USER nonroot:nonroot
ENTRYPOINT ["/tak-gateway"]
