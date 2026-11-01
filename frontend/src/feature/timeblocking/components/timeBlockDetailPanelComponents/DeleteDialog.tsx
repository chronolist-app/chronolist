import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useCallback, type FC } from "react";


type DeleteDialogProps = {
    deleteBlock: () => void,
    open: boolean,
    setOpen: (open: boolean) => void,
};

/**
 * ブロックを削除する確認ダイアログ
 */
const DeleteDialog: FC<DeleteDialogProps> = ({ deleteBlock, open, setOpen }) => {

    const handleClose = useCallback(() => {
        setOpen(false);
    }, [setOpen]);

    const handleDelete = useCallback(() => {
        deleteBlock();
        handleClose();
    }, [deleteBlock, handleClose]);

    return (
        <>
            <Dialog onClose={handleClose} open={open}>
                <DialogTitle>本当に削除しますか?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        削除したブロックは復元することはできません。
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>キャンセル</Button>
                    <Button onClick={handleDelete}>削除</Button>
                </DialogActions>
            </Dialog>
        </>
    )
};

export default DeleteDialog;