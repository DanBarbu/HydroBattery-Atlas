FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/skynex-cuas ./cmd/skynex-cuas

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/skynex-cuas /skynex-cuas
USER nonroot:nonroot
ENTRYPOINT ["/skynex-cuas"]
