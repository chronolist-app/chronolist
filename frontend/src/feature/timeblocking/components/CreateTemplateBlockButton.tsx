import CHButton from "@/components/CHButton";
import { useCallback, useState } from "react"
import AddCardIcon from '@mui/icons-material/AddCard';
import CreateTemplateBlockDialog from "./CreateTemplateBlockDialog";


/** テンプレートブロック作成ダイアログを開く操作を表示する。 */
const CreateTemplateBlockButton = () => {

    const [ open, setOpen ] = useState(false);

    const handleClick = useCallback(() => {
        setOpen(true);
    }, [setOpen]);

    return (
        <>
            <CHButton onClick={handleClick} startIcon={<AddCardIcon />} label="テンプレートタイムブロックを追加" />
            <CreateTemplateBlockDialog open={open} setOpen={setOpen} />
        </>
    );
};

export default CreateTemplateBlockButton;