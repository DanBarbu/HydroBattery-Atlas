FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/atak-mil ./cmd/atak-mil

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/atak-mil /atak-mil
EXPOSE 8087/udp
USER nonroot:nonroot
ENTRYPOINT ["/atak-mil"]
