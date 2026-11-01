import { getApiBaseUrl } from "@/config/apiBaseUrl";
import { createApiClient } from "./createApiClient";
import { notifyApiNotice } from "./apiNotice";

const axios = createApiClient(getApiBaseUrl() + "api/", {
    notify: notifyApiNotice,
    currentPath: () => window.location.pathname,
    redirectToLogin: () => window.location.replace("/login"),
});

export default axios;
