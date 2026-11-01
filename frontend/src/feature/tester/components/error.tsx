import type { FC } from "react";

const ErrorDisplay: FC<{err: Error}> = ({err}) => {
    return (
        <>
            <h1>Some error happened!</h1>
            <div>{err.name}</div>
            <div>{err.message}</div>
            <div>{err.stack}</div>
        </>
    );
}

export default ErrorDisplay;