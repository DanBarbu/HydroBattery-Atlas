FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/tenant-admin ./cmd/tenant-admin

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/tenant-admin /tenant-admin
EXPOSE 8081
USER nonroot:nonroot
ENTRYPOINT ["/tenant-admin"]
