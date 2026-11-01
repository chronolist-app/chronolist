import { Button } from "@mui/material";
import { useCallback, useState } from "react"
import AddCardIcon from '@mui/icons-material/AddCard';
import CreateTemplateBlockDialog from "./CreateTemplateBlockDialog";


const CreateTemplateBlockButton = () => {

    const [ open, setOpen ] = useState(false);

    const handleClick = useCallback(() => {
        setOpen(true);
    }, [setOpen]);

    return (
        <>
            <Button onClick={handleClick} variant={"contained"} startIcon={ <AddCardIcon /> }>テンプレートタイムブロックを追加</Button>
            <CreateTemplateBlockDialog open={open} setOpen={setOpen} />
        </>
    );
};

export default CreateTemplateBlockButton;