import { useEffect, useState, type ChangeEvent, type FC } from "react"


type CheckBoxProps = {
    id?: string,
    className?: string,
    defaultChecked?: boolean,
    onChange?: (isChecked: boolean) => void,
}

const CheckBox: FC<CheckBoxProps> = ({
    id,
    className,
    defaultChecked = false,
    onChange,
}) => {
    const [isChecked, setIsChecked] = useState<boolean>(defaultChecked);
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newChecked = e.target.checked;
        setIsChecked(newChecked);
        onChange?.(newChecked);
    };

    useEffect(() => {
        setIsChecked(defaultChecked);
    }, [defaultChecked]);

    return (
        <input
            type="checkbox"
            id={id}
            className={className}
            checked={isChecked}
            onChange={handleChange}
        />
    );
}

export default CheckBox;