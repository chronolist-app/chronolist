import { useSyncExternalStore } from "react";
import { Alert } from "react-bootstrap";
import { getApiNotice, notifyApiNotice, subscribeApiNotice } from "@/utils/apiNotice";

export default function ApiNotice() {
    const message = useSyncExternalStore(subscribeApiNotice, getApiNotice);
    if (!message) return null;
    return (
        <div className="position-fixed top-0 start-50 translate-middle-x p-3"
            style={{ zIndex: 2000, width: "min(90vw, 40rem)" }}>
            <Alert role="alert" variant="warning" dismissible closeLabel="通知を閉じる" onClose={() => notifyApiNotice(null)}>
                {message}
            </Alert>
        </div>
    );
}
