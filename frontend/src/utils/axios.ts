import Axios from "axios";
import { getApiBaseUrl } from "@/config/apiBaseUrl";

const axios = Axios.create({
    baseURL: getApiBaseUrl() + "api/",
    withCredentials: true,
});

let isRedirectingToLogin = false;

axios.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (Axios.isAxiosError(error) && error.response?.status === 401) {
            const requestPath = new URL(axios.getUri(error.config), window.location.origin).pathname;
            const loginApiPath = new URL("login", axios.defaults.baseURL).pathname;

            if (
                requestPath !== loginApiPath &&
                window.location.pathname !== "/login" &&
                !isRedirectingToLogin
            ) {
                isRedirectingToLogin = true;
                window.location.replace("/login");
            }
        }

        return Promise.reject(error);
    },
);

export default axios;
