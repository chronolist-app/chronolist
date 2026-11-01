import type { PullDownProps } from "@/types/utility-prop";
import classNames from "classnames";
import { useEffect, useState, type FC } from "react";
import { v4 as uuidv4 } from "uuid";

// プルダウン要素固有のクラス名
const PULLDOWN_CLASS_TAG = "chronolist-pulldown";

// プルダウン要素が持つクラス群
const PULLDOWN_CLASS_NAMES = classNames(
    PULLDOWN_CLASS_TAG,
    "form-select",
);

/**
 * Chronolist共通のプルダウン要素を提供するコンポーネント。  
 * 
 * `values` が設定されていない場合、 `items` をそのまま使用する。  
 * 
 * デフォルト値が指定されていない場合、 `values` の最初のアイテムを  
 * デフォルト値として使用する。  
 * 
 * デフォルト値を指定した場合に、その値が `values` に含まれていない場合、  
 * コンソールに警告を出し、最初のアイテムをデフォルト値として使用する。  
 * 
 * `onChange` の引数には、 `values` の値が渡されることに注意。  
 * 
 * @throws プルダウンに含まれるアイテムが0個の場合に発生する。
 * @throws `items` と `values` の長さが異なる場合に発生する。
 */
const PullDown: FC<PullDownProps> = ({ items, onChange, defaultValue, formLabel, values: originalValues }) => {

    if (items.length === 0) throw new Error("No items were given to PullDown");

    const [ values, setValues] = useState(originalValues || items);

    const [ selectedValue, setSelectedValue ] = useState(defaultValue || values[0]);

    useEffect(() => {
        setValues(originalValues || items);
        if (values.length !== items.length) throw new Error("[chronolist] The number of values must be the same as the number of items");

        setSelectedValue(defaultValue || values[0]);

        // デフォルト値が指定されている場合に、その値がitemsに含まれているかどうかのチェック
        if (defaultValue && !values.includes(selectedValue)) {
            console.log(`[chronolist]WARNING: The default value "${selectedValue}" is not included in items. The first value "${values[0]}" will be used instead.`);
            setSelectedValue(values[0]);
        }
    }, [defaultValue, originalValues, items]);

    const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (!onChange) return;
        onChange(event.target.value);
        setSelectedValue(event.target.value);
    };

    return (
        <select
            className={PULLDOWN_CLASS_NAMES}
            onChange={handleSelect}
            aria-label={formLabel || uuidv4()}
            value={selectedValue}
        >
            {Array.from({ length: items.length }, (_, i) => i).map((i) => (
                <option key={i} value={values[i]} >
                    {items[i]}
                </option>
            ))}
        </select>
    )
}

export default PullDown;