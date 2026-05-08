FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/core-sync ./cmd/core-sync

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/core-sync /core-sync
EXPOSE 8083
USER nonroot:nonroot
ENTRYPOINT ["/core-sync"]
