import { createBrowserRouter, createRoutesFromElements, Route } from "react-router-dom";

import ToDoListTestPage from "@/feature/tester/components/toDoListIndex";
import TesterPage from "@/feature/tester";
import SchedulerTestPage from "@/feature/tester/components/schedulerIndex";
import ToDoListPage from "@/feature/todolist";
import SchedulerPage from "@/feature/schesuler";
import HomePage from "@/feature/home";
import LoginPage from "@/feature/login";
import SingnUpPage from "@/feature/signup";
import TimeBlockingPage from "@/feature/timeblocking";
import AppLayout from "@/layouts/AppLayout";


const routesBasic = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path="/" element={<HomePage />} />
            <Route path="/test" element={<TesterPage />} />
            <Route path="/test/todolist" element={
                <AppLayout>
                    <ToDoListTestPage />
                </AppLayout>
            } />
            <Route path="/test/scheduler" element={
                <AppLayout>
                    <SchedulerTestPage />
                </AppLayout>
            } />
            <Route path="/todolist" element={
                <AppLayout>
                    <ToDoListPage />
                </AppLayout>
            } />
            <Route path="/scheduler" element={
                <AppLayout>
                    <SchedulerPage />
                </AppLayout>
            } />
            <Route path="/timeblocking" element={
                <AppLayout>
                    <TimeBlockingPage />
                </AppLayout>
            } />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SingnUpPage />} />
        </>
    )
);

export default routesBasic;