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

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=build --chmod=444 /app/build/libs/app.jar ./app.jar

USER 10001:10001

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
