import CHButton from "@/components/CHButton";
import classNames from "classnames"
import { useNavigate } from "react-router-dom"
import LogoutButton from "../login/components/LoggingOutButton";


/** アカウント操作と各アプリへの入口を表示する。 */
const HomePage = () => {

    const nav = useNavigate();

    return (
        <div className={classNames("d-flex", "flex-column", "align-items-center", "gap-2")}>
            <CHButton onClick={() => {nav("/signup")}} label="新規登録" />
            <CHButton onClick={() => {nav("/login")}} label="ログイン" />
            <LogoutButton />
            <CHButton variant="secondary" onClick={() => {nav("/todolist")}} label="ToDoリスト" />
            <CHButton variant="secondary" onClick={() => {nav("/scheduler")}} label="スケジューラ" />
            <CHButton variant="secondary" onClick={() => {nav("/timeblocking")}} label="タイムブロッキング" />
            <CHButton variant="secondary" onClick={() => {nav("/timeblocking?date=2025-12-29")}} label="タイムブロッキング(2025-12-29)" />
            <CHButton variant="secondary" onClick={() => {nav("/test")}} label="テスター" />
        </div>
    )
}

export default HomePage;