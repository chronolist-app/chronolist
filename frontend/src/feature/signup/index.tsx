import myAxios from "@/utils/axios";
import axios from "axios";
import { useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";


const SingnUpPage= () => {

    const [loginId, setLoginId] = useState<string>("");
    const [password, setPassword] = useState<string>("");

    const nav = useNavigate();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSignUp = async () => {
        console.log("---サインアップ処理を開始----------------------------------------")
        try {
            await myAxios({
                url: "/signup",
                method: "post",
                data: {
                    loginId,
                    password,
                },
                withCredentials: true,
            });
            setErrorMsg(null);
            console.log("---サインアップ処理を終了----------------------------------------")
            nav("/");
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;
                setErrorMsg(`Some error happened! status: ${status} code: ${err.response?.data}`);
            } else {
                setErrorMsg("Some unknown error happened!");
            }
        }
        console.log("---サインアップ処理を終了----------------------------------------")
    };

    return (
        <>
            <h1>新規登録</h1>

            {errorMsg && <p style={{color: "red"}}>{errorMsg}</p>}

            <div>
                <label>ログインID</label>
                <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
            </div>
            <div>
                <label>パスワード</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button variant="primary" onClick={handleSignUp}>サインアップ</Button>
        </>
    )
}

export default SingnUpPage;