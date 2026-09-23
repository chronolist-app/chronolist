import { ChronolistModal } from "@/components/modal";
import type { ModalProps } from "@/types/utility-prop";
import { useState } from "react";


/**
 * モーダルを使用するためのフック
 * @param props モーダルのプロップ
 * @returns モーダルのコンポーネントと表示状態を管理するためのオブジェクト群
 */
const useModal = (props: ModalProps) => {
    const [isOpen, setIsOpen] = useState(props.isOpen ?? false);

    /**
     * モーダルの表示状態を切り替える関数。  
     * 
     * 引数を指定しない場合は現在の表示状態を反転させる。  
     * 
     * @param show モーダルの表示状態
     */
    const toggleModalShow = (show?: boolean) => {
        setIsOpen(show ?? !isOpen);
    };

    const handleAccept = () => {
        props.onAccept?.();
    }

    const handleClose = () => {
        setIsOpen(false);
        props.onClose?.();
    };

    const handleCancel = () => {
        toggleModalShow(false);
        props.onCancel?.();
    };

    const modal = <ChronolistModal
        {...props}
        isOpen={isOpen}
        onAccept={handleAccept}
        onCancel={handleCancel}
        onClose={handleClose}
    />;

    return { modal, toggleModalShow, isOpen }
};

export default useModal;