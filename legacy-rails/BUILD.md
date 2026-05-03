
# Build and deploy

## Build docker image

this creates a multi-arch docker image and pushes it to Docker Hub.  You must be logged in to Docker Hub for this to work. Increment the image tag in the command below to create a new version of the image.

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
 -t registry.k.pd.o/moviedb:1.0 \
 --push .
```

Use `docker buildx` instead of `docker build` to create and push a multi-arch manifest in one command. The `--push` flag automatically creates the manifest and pushes all platforms to Docker Hub.
