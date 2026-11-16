import CHButton from "@/components/CHButton";
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
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
                    <CHButton variant="secondary" appearance="text" onClick={handleClose} label="キャンセル" />
                    <CHButton variant="danger" onClick={handleDelete} label="削除" />
                </DialogActions>
            </Dialog>
        </>
    )
};

export default DeleteDialog;