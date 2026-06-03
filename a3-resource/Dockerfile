FROM docker.m.daocloud.io/library/maven:3.9.9-eclipse-temurin-11 AS build

WORKDIR /workspace

RUN mkdir -p /root/.m2 \
    && cat > /root/.m2/settings.xml <<'EOF'
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <mirrors>
    <mirror>
      <id>aliyunmaven</id>
      <mirrorOf>*</mirrorOf>
      <name>Aliyun Maven</name>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
EOF

COPY . .

RUN mvn -pl a3-resource -am -DskipTests package

FROM docker.m.daocloud.io/library/eclipse-temurin:11-jre

ENV JAVA_OPTS=""

WORKDIR /app

COPY --from=build /workspace/a3-resource/target/a3-resource.jar /app/app.jar

EXPOSE 8086

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar --spring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}"]
