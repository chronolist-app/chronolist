import CHButton from "@/components/CHButton";
import type { ModalProps } from "@/types/utility-prop";
import classNames from "classnames";
import type { FC } from "react";
import { Modal } from "react-bootstrap";

const MODAL_CLASS_TAG = "chronolist-modal";

/** ラベル付きの共通操作ボタンを備えたモーダルを表示する。 */
export const ChronolistModal: FC<ModalProps> = ({
    title,
    isOpen,
    id,
    className,
    acceptButtonlabel,
    acceptButtonVariant = "primary",
    onAccept,
    cancelButtonlabel,
    onCancel,
    onClose,
    children
}) => {
    return (
        <Modal
            show={isOpen}
            id={id}
            className={classNames(MODAL_CLASS_TAG, className)}
            onHide={onClose}
        >
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
            <Modal.Footer>
                {cancelButtonlabel && <CHButton variant="secondary" appearance="text" onClick={onCancel} label={cancelButtonlabel} />}
                {acceptButtonlabel && <CHButton variant={acceptButtonVariant} onClick={onAccept} label={acceptButtonlabel} />}
            </Modal.Footer>
        </Modal>
    )
}
