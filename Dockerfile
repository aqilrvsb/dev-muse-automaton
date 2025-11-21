# Stage 1: Build Backend
FROM golang:1.24-alpine AS backend-builder

WORKDIR /src

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build Go binary (static)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server ./cmd/server

# Stage 2: Final Runtime Image
FROM alpine:latest

RUN apk --no-cache add ca-certificates wget

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /app/server .

# Copy static frontend files
COPY frontend ./frontend

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Run server
CMD ["./server"]
