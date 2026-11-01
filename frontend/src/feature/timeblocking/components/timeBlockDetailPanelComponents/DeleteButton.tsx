import { useCallback, useState, type FC } from "react";
import { Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteDialog from "./DeleteDialog";


type DeleteButtonProps = {
    onDelete: () => void;
};

const DeleteButton: FC<DeleteButtonProps> = ({ onDelete }) => {
    
    const [ open, setOpen ] = useState(false);

    const handleClick = useCallback(() => {
        setOpen(true);
    }, [setOpen]);

    return (
        <>
            <Button onClick={handleClick} startIcon={<DeleteIcon />}>ブロックを削除</Button>
            <DeleteDialog deleteBlock={onDelete} open={open} setOpen={setOpen} />
        </>
    );
};

export default DeleteButton;