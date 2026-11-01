import { Button } from "@mui/material"
import { useCallback, useState } from "react";
import AddCardIcon from '@mui/icons-material/AddCard';
import CreateBlockDialog from "./CreateBlockDialog";


const CreateBlockButton = () => {

    const [ open, setOpen ] = useState(false);

    const handleClick = useCallback(() => {
        setOpen(true);
    }, [setOpen]);

    return (
        <>
            <Button onClick={handleClick} variant={"contained"} startIcon={ <AddCardIcon /> }>タイムブロックを追加</Button>
            <CreateBlockDialog open={open} setOpen={setOpen} />
        </>
    );
};

export default CreateBlockButton;