FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kms-stub ./cmd/kms-stub

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/kms-stub /kms-stub
EXPOSE 8082
USER nonroot:nonroot
ENTRYPOINT ["/kms-stub"]
