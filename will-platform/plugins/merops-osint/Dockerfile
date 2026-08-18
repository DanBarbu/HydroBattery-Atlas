FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/merops-osint ./cmd/merops-osint

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/merops-osint /merops-osint
USER nonroot:nonroot
ENTRYPOINT ["/merops-osint"]
