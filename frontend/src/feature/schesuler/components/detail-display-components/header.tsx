import { useContext } from "react"
import classNames from "classnames";

import CalendarEventsContext from "../contexts/calendar-events-context";
import SelectedCalendarEventContext from "../contexts/selected-event";
import { Button } from "react-bootstrap";


const HEADER_ID = "scheduler-detail-display-header";
const HEADER_INFO_ID = "scheduler-detail-display-header-info";
const HEADER_TITLE_ID = "scheduler-detail-display-header-title";

const HEADER_CLASS_NAMES = classNames(
    "d-flex", "flex-column", "align-items-center",
);
const HEADER_INFO_CLASS_NAMES = classNames(
    "d-flex", "align-items-center", "justify-content-between",
);
const HEADER_TITLE_CLASS_NAMES = classNames(
    
);

const Header = () => {
    const { events } = useContext(CalendarEventsContext);
    const { eventId } = useContext(SelectedCalendarEventContext);

    const selectedEvent = events.find(event => event.id === eventId);

    return (
        <div id={HEADER_ID} className={HEADER_CLASS_NAMES}>
            <div id={HEADER_INFO_ID} className={HEADER_INFO_CLASS_NAMES}>
                <div
                    className={classNames("border", "border-1", "rounded-1")}
                    style={{borderColor: selectedEvent?.color}}
                >
                    <label style={{color: selectedEvent?.color}}>
                        通常予定
                    </label>
                </div>
                <Button variant="danger" size="sm" className={""}>削除</Button>
            </div>

            <p id={HEADER_TITLE_ID} className={HEADER_TITLE_CLASS_NAMES}>
                {selectedEvent?.title}
            </p>
        </div>
    );
};

export default Header;