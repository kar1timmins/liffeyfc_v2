# ─── Stage 1: Build ───────────────────────────────────────────────────────────
# Use the official Go image to compile the binary.
# All build dependencies stay in this stage — they are NOT included in the final image.
FROM golang:1.24-alpine AS builder

# Install git (needed by go mod download for some indirect deps).
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Cache dependency downloads in a separate layer.
# Only re-downloaded when go.mod / go.sum change.
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build a statically-linked binary.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -extldflags '-static'" \
    -o /sentinel \
    ./main.go

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
# Minimal Alpine image; final image size < 20 MB.
FROM alpine:3.19

# ca-certificates is required for TLS connections to RPC nodes and Redis.
# tzdata is used by the Go runtime for time zone handling in logs.
RUN apk add --no-cache ca-certificates tzdata

# Non-root user for security.
RUN addgroup -S sentinel && adduser -S -G sentinel sentinel
USER sentinel

WORKDIR /app
COPY --from=builder /sentinel ./sentinel

# ── Environment defaults ──────────────────────────────────────────────────────
# These can be overridden per-deployment on Railway.
ENV PORT=8080

# ── Health endpoint ───────────────────────────────────────────────────────────
EXPOSE 8080

ENTRYPOINT ["./sentinel"]
