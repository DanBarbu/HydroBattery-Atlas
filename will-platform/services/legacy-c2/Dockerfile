FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/legacy-c2 ./cmd/legacy-c2

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/legacy-c2 /legacy-c2
EXPOSE 8089
USER nonroot:nonroot
ENTRYPOINT ["/legacy-c2"]
