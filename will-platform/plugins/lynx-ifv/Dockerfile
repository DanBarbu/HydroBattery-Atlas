FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/lynx-ifv ./cmd/lynx-ifv

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/lynx-ifv /lynx-ifv
USER nonroot:nonroot
ENTRYPOINT ["/lynx-ifv"]
