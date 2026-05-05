FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gmti ./cmd/gmti

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/gmti /gmti
EXPOSE 8190/udp
USER nonroot:nonroot
ENTRYPOINT ["/gmti"]
