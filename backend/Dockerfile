# syntax=docker/dockerfile:1

FROM eclipse-temurin:25-jdk AS development

WORKDIR /app

COPY gradlew build.gradle settings.gradle ./
COPY gradle/ ./gradle/

RUN chmod +x gradlew

RUN --mount=type=cache,id=chronolist-backend-gradle,target=/root/.gradle,sharing=locked \
    ./gradlew --version --no-daemon

COPY src/ ./src/

CMD ["./gradlew", "bootRun"]

FROM development AS build

RUN --mount=type=cache,id=chronolist-backend-gradle,target=/root/.gradle,sharing=locked \
    ./gradlew bootJar --no-daemon

FROM eclipse-temurin:25-jre AS runtime

WORKDIR /app

COPY --from=build /app/build/libs/app.jar ./app.jar

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
