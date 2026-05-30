FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/mmpv90-naval ./cmd/mmpv90-naval

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/mmpv90-naval /mmpv90-naval
USER nonroot:nonroot
ENTRYPOINT ["/mmpv90-naval"]
