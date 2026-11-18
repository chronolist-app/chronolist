import CHTextField from "../../src/components/CHTextField";

const input = <CHTextField label="入力" value="値"
    onChange={event => { const value: string = event.target.value; void value; }}
    onBlur={event => { event.currentTarget.focus(); }}
    onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
const area = <CHTextField multiline rows={3}
    onChange={event => { const value: string = event.target.value; void value; }}
    onBlur={event => { const element: HTMLInputElement | HTMLTextAreaElement = event.currentTarget; void element; }} />;
// @ts-expect-error MUIのsxは公開しない
const sx = <CHTextField sx={{ color: "red" }} />;
// @ts-expect-error MUIのslotPropsは公開しない
const slots = <CHTextField slotProps={{ htmlInput: {} }} />;
// @ts-expect-error HTMLの文字幅sizeは使わない
const size = <CHTextField size={20} />;
// @ts-expect-error MUIが管理するアニメーションイベントは指定しない
const animation = <CHTextField onAnimationStart={() => {}} />;
// ReactのJSXではハイフンを含む未知の属性を許可するため、Propsへの代入で検査する。
// @ts-expect-error aria-invalidはerrorから内部で管理する
const invalid: import("../../src/components/CHTextField").CHTextFieldProps = { "aria-invalid": true };
void [input, area, sx, slots, size, animation, invalid];
