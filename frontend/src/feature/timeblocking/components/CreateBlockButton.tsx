import CHButton from "@/components/CHButton";
import { useCallback, useState } from "react";
import AddCardIcon from '@mui/icons-material/AddCard';
import CreateBlockDialog from "./CreateBlockDialog";


/** タイムブロック作成ダイアログを開く操作を表示する。 */
const CreateBlockButton = () => {

    const [ open, setOpen ] = useState(false);

    const handleClick = useCallback(() => {
        setOpen(true);
    }, [setOpen]);

    return (
        <>
            <CHButton onClick={handleClick} startIcon={<AddCardIcon />} label="タイムブロックを追加" />
            <CreateBlockDialog open={open} setOpen={setOpen} />
        </>
    );
};

export default CreateBlockButton;