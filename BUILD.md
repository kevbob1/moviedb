# Building and Running moviedb

## Prerequisites
- Docker installed

## Build Instructions
To build the Docker image, run:

```bash
docker build -t moviedb .
```

## Run Instructions
To run the container:

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  moviedb
```

The application will be available at http://localhost:3000.
