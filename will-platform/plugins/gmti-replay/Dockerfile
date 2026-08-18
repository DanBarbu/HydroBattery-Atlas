# Multi-context build: copy both gmti-replay and the gmti module that it
# depends on via a relative replace directive.
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY gmti-replay/go.mod ./gmti-replay/
COPY gmti ./gmti
WORKDIR /src/gmti-replay
COPY gmti-replay/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gmti-replay ./cmd/gmti-replay

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/gmti-replay /gmti-replay
USER nonroot:nonroot
ENTRYPOINT ["/gmti-replay"]
