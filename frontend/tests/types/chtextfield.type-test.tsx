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
void [input, area, sx, slots, size];
