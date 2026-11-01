    def valid_host:
        if startswith("[") then
            ltrimstr("[") | rtrimstr("]")
            | . as $host
            | split(":") | map(select(length > 0)) as $groups
            | ($groups | all(test("^[0-9a-fA-F]{1,4}$")))
              and (if $host | contains("::") then
                  ($host | split("::") | length) == 2
                  and ($groups | length) < 8
                  and ($host | split("::") | all(
                      . == "" or test("^[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$")
                  ))
              else
                  ($host | split(":") | length) == 8
                  and ($groups | length) == 8
              end)
        elif test("^[0-9.]+$") then
            split(".")
            | length == 4 and all(
                test("^(0|[1-9][0-9]{0,2})$") and (tonumber <= 255)
            )
        else
            rtrimstr(".") | split(".")
            | all(test("^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$"))
              and (last | test("^(?:[0-9]+|0[xX][0-9a-fA-F]+)$") | not)
        end;
    .
    | capture("^(?<scheme>https?)://(?<host>\\[[0-9a-fA-F:]+\\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(?<port>[0-9]+))?(?<path>/[^\\s\\\\?#]*)?\\z"; "i")
    | select(.port == null or ((.port | tonumber) >= 1 and (.port | tonumber) <= 65535))
    | select(.host | valid_host)
    | .scheme |= ascii_downcase
