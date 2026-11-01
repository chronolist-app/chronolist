FROM eclipse-temurin:25-jdk

RUN apt-get update \
    && apt-get install -y curl git \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace