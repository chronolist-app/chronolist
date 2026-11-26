import CHButton from "@/components/CHButton";
import CHTextField from "@/components/CHTextField";
import { customizedFetch } from "@/utils/fetch";
import axios from "axios";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";


/** ログイン情報の入力と認証操作を表示する。 */
const LoginPage = () => {

    const [serchParams] = useSearchParams();

    const [hasError, setHasError] = useState(() => serchParams.has("error"));
    const hasLogout = serchParams.has("logout");

    const [ loginId, setLoginId ] = useState<string>("");
    const [ password, setPassword ] = useState<string>("");
    const nav = useNavigate();

    const handleLogin = async () => {
        setHasError(false);
        console.log("---ログイン処理を開始----------------------------------------")
        try {
            await customizedFetch({
                url: "/login",
                method: "POST",
                data: {
                    loginId,
                    password,
                },
            })

            // ログイン成功時処理
            console.log("ログイン成功");
            nav("/")

        } catch (err) {
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;

                // 入力値によるエラー
                if (status === 401) {
                    console.log("ログインIDまたはパスワードが不正です");
                    setHasError(true);
                }
            } else {
                console.log("不明なエラー");
            }
        }
        console.log("---ログイン処理を終了----------------------------------------")
    }
    
    return (
        <>
            <h1>ログイン画面</h1>

            {hasError && (<div role="alert" style={{color: "red"}}>ログインIDまたはパスワードが違います</div>)}
            {hasLogout && (<div style={{color: "blue"}}>ログアウトしました</div>)}

            <form>
                <div>
                    <CHTextField label="ログインID" type="text" name="login_id" value={loginId} required onChange={(e) => setLoginId(e.target.value)} />
                </div>
                <div>
                    <CHTextField label="パスワード" type="password" name="password" value={password} required onChange={(e) => setPassword(e.target.value)} />
                </div>
                <CHButton onClick={handleLogin} label="APIログイン" />
            </form>
        </>
    )
}

export default LoginPage;
