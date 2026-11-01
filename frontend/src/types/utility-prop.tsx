import type { ReactNode } from "react";


export interface PullDownProps {
    /**
     * プルダウンに表示される文字列
     */
    items: string[];

    /**
     * 文字列が選択された際に使用するデータ上の値。  
     * 指定がない場合は `items` を代わりに使用する。
     */
    values?: string[];

    /**
     * 選択時に実行する関数
     * @param value 選択された項目の値
     */
    onChange?: (value: string) => void;

    /**
     * デフォルト値。 `values` 内の値を指定する。  
     * 指定されていない場合、 `items` の最初の項目を使用する。
     */
    defaultValue?: string;

    /**
     * フォームとして使用する場合の識別子。  
     * 指定がない場合、自動でUUIDが生成される。
     */
    formLabel?: string;
}

export interface ModalProps {
    title: string;
    isOpen?: boolean;
    id?: string;
    className?: string;
    acceptButtonlabel?: string;
    onAccept?: () => void;
    cancelButtonlabel?: string;
    onCancel?: () => void;
    onClose?: () => void;
    children?: ReactNode | ReactNode[];
}