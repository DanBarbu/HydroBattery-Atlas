FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/fires ./cmd/fires

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/fires /fires
EXPOSE 8087
USER nonroot:nonroot
ENTRYPOINT ["/fires"]
