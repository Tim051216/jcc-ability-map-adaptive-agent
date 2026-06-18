$ids = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*MessageApplication*' -or $_.CommandLine -like '*a3-message-service*' } | Select-Object -ExpandProperty ProcessId)
if ($ids.Count -gt 0) { Stop-Process -Id $ids -Force -ErrorAction SilentlyContinue }
$env:SPRING_DATASOURCE_URL='jdbc:mysql://127.0.0.1:3306/tj_message?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true'
$env:SPRING_DATASOURCE_USERNAME='root'
$env:SPRING_DATASOURCE_PASSWORD='123456'
$env:SPRING_REDIS_HOST='127.0.0.1'
$env:SPRING_REDIS_PORT='6379'
$env:SPRING_CLOUD_NACOS_CONFIG_ENABLED='false'
$env:SPRING_CLOUD_NACOS_DISCOVERY_ENABLED='false'
$env:SPRING_CLOUD_DISCOVERY_ENABLED='false'
Set-Location 'F:\A3-cnsoftbei\a3-learning-agent-system'
mvn -f a3-message/pom.xml -pl a3-message-service spring-boot:run -Dspring-boot.run.profiles=local 1>'F:\A3-cnsoftbei\a3-learning-agent-system\msg-run.out.log' 2>'F:\A3-cnsoftbei\a3-learning-agent-system\msg-run.err.log'
