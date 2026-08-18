FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/vector-mini-uas ./cmd/vector-mini-uas

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/vector-mini-uas /vector-mini-uas
USER nonroot:nonroot
ENTRYPOINT ["/vector-mini-uas"]
