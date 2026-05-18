FROM maven:3.9.9-eclipse-temurin-11 AS build

WORKDIR /workspace

COPY . .

RUN mvn -pl a3-learning -am -DskipTests package

FROM eclipse-temurin:11-jre

ENV JAVA_OPTS=""

WORKDIR /app

COPY --from=build /workspace/a3-learning/target/a3-learning.jar /app/app.jar

EXPOSE 8090

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar --spring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}"]
