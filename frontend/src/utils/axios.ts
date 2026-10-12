import Axios from "axios";

let API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) throw new Error('Not found the environment variable: "VITE_API_BASE_URL". Check the value of "env" in "launch.json".');
if (!API_BASE_URL.endsWith("/")) API_BASE_URL += "/";

const axios = Axios.create({
    baseURL: API_BASE_URL + "api/",
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
