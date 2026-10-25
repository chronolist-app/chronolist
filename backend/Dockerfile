FROM eclipse-temurin:25-jdk AS development

WORKDIR /app

COPY . .

RUN chmod +x gradlew

CMD ["./gradlew", "bootRun"]

FROM development AS build

RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:25-jre AS runtime

WORKDIR /app

COPY --from=build /app/build/libs/app.jar ./app.jar

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
