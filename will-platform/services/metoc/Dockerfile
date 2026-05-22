FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/metoc ./cmd/metoc

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/metoc /metoc
EXPOSE 8090
USER nonroot:nonroot
ENTRYPOINT ["/metoc"]
