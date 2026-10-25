location ^~ /api/ {
    default_type application/json;
    return 404 '{"code":"API_PROXY_NOT_CONFIGURED"}';
}
