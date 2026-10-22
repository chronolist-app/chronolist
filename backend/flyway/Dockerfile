FROM redgate/flyway:11.15.0

# jdbc:mysql の sslMode=VERIFY_IDENTITY に対応するドライバーを固定して同梱する。
ADD --chmod=0644 --checksum=sha256:49ed93c8b2bea9cb0929b85a8a28837b191d0f8eac6919fdcef16e36e2cd53b3 \
    https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/9.4.0/mysql-connector-j-9.4.0.jar \
    /flyway/drivers/mysql-connector-j-9.4.0.jar

COPY conf/flyway.conf /flyway/conf/flyway.conf
COPY sql/ /flyway/sql/

CMD ["info"]
