import type { ModalProps } from "@/types/utility-prop";
import classNames from "classnames";
import type { FC } from "react";
import { Button, Modal } from "react-bootstrap";

const MODAL_CLASS_TAG = "chronolist-modal";

export const ChronolistModal: FC<ModalProps> = ({
    title,
    isOpen,
    id,
    className,
    acceptButtonlabel,
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
                {cancelButtonlabel && (() => <Button variant="secondary" onClick={onCancel}>{cancelButtonlabel}</Button>)()}
                {acceptButtonlabel && (() => <Button variant="primary" onClick={onAccept}>{acceptButtonlabel}</Button>)()}
            </Modal.Footer>
        </Modal>
    )
}