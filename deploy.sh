#!/bin/sh
set -eu

docker stop automated-app || true
docker rm automated-app || true

docker build -t automated-app:latest .
docker run -d --name automated-app -p 9061:9061 automated-app:latest
