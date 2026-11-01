import { Button } from "react-bootstrap"
import { useNavigate } from "react-router-dom"


const TesterPage = () => {

    const nav = useNavigate();
    
    return (
        <>
            <h1>Tester Page</h1>
            <Button className="m-2" onClick={() => {nav("/test/todolist")}}>ToDoリスト</Button>
            <Button className="m-2" onClick={() => {nav("/test/scheduler")}}>スケジューラ</Button>
        </>
    )
}

export default TesterPage;