FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/trainer ./cmd/trainer

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/trainer /trainer
EXPOSE 8088
USER nonroot:nonroot
ENTRYPOINT ["/trainer"]
