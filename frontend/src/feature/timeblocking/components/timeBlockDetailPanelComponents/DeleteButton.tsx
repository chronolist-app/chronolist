import CHButton from "@/components/CHButton";
import { useCallback, useState, type FC } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteDialog from "./DeleteDialog";


type DeleteButtonProps = {
    onDelete: () => void;
};

/** ブロックの削除確認ダイアログを開く操作を表示する。 */
const DeleteButton: FC<DeleteButtonProps> = ({ onDelete }) => {
    
    const [ open, setOpen ] = useState(false);

    const handleClick = useCallback(() => {
        setOpen(true);
    }, [setOpen]);

    return (
        <>
            <CHButton variant="danger" appearance="text" onClick={handleClick} startIcon={<DeleteIcon />} label="ブロックを削除" />
            <DeleteDialog deleteBlock={onDelete} open={open} setOpen={setOpen} />
        </>
    );
};

export default DeleteButton;