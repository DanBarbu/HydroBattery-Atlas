FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/bms ./cmd/bms

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/bms /bms
EXPOSE 8084
USER nonroot:nonroot
ENTRYPOINT ["/bms"]
