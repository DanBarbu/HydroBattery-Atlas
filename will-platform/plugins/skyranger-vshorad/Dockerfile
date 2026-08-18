FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/skyranger-vshorad ./cmd/skyranger-vshorad

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/skyranger-vshorad /skyranger-vshorad
USER nonroot:nonroot
ENTRYPOINT ["/skyranger-vshorad"]
