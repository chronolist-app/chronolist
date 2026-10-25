import axios from "@/utils/axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiNotice, notifyApiNotice } from "@/utils/apiNotice"
import { Button } from "react-bootstrap";

/**
 * ログアウト処理を行うための関数及び処理中であるかどうかを示す値を返すフック
 * 
 * @returns ログアウト処理中を表す値とログアウト処理を行う関数を保持する連想配列
 */
const useLogout = () => {
    
    const nav = useNavigate();
    const [isLoggingOut, setLoggingOut] = useState(false);

    const logout = async () => {
        setLoggingOut(true);
        try {
            await axios.post("logout");
            nav("/login?logout");
        } catch {
            if (!getApiNotice()) notifyApiNotice("ログアウトできませんでした。もう一度お試しください。");
        } finally {
            setLoggingOut(false);
        }
    };

    return {
        isLoggingOut,
        logout,
    };
};

/**
 * ログアウト処理を行うコンポーネント  
 * @returns ログアウトボタンコンポーネント
 */
const LogoutButton = () => {

    const { isLoggingOut, logout } = useLogout();

    return (
        <>
            <Button className="m-1" variant="secondary" disabled={isLoggingOut} onClick={logout}>
                ログアウト
            </Button>
        </>
    )
};

export default LogoutButton;