FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/plugin-loader ./cmd/plugin-loader

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/plugin-loader /plugin-loader
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/plugin-loader"]
