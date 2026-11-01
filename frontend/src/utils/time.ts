

export const formattedTime = (time: Date) => {
    return time.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

/**
 * 時刻を表すクラス.  
 * 23:59 のようなオブジェクトとして扱われる.  
 */
export class Time {
    private _hour: number;
    private _minute: number;

    /**
     * 現在時刻を示す `Time` オブジェクトを生成する.
     */
    constructor();
    /**
     * 指定の時間（分）を `HH:MM` の形式で表現する `Time` オブジェクトを生成する.
     * @param minutes 合計時間（分）
     */
    constructor(minutes: number);
    /**
     * 時刻を表す `Time` オブジェクトを生成する.
     * @param time 時刻
     */
    constructor(time: Time);
    /**
     * `string` で `HH:MM` の形式で表現された時刻を表す `Time` オブジェクトを生成する.
     * @param time 時刻
     */
    constructor(time: string);
    /**
     * `Date` オブジェクトから時刻を抽出し, `Time` オブジェクトを生成する.
     * @param date 時刻を含む日付オブジェクト
     */
    constructor(date: Date);
    /**
     * 時刻を表す `Time` オブジェクトを生成する.
     * @param hour 時
     * @param minute 分
     */
    constructor(hour: number, minute: number);
    constructor(firstArg?: number | Time | string | Date, minute?: number) {
        let minutes: number | undefined = undefined;
        // 引数に何も受け取らなかった場合は現在時刻を参照
        if (firstArg === undefined) {
            minutes = (new Time(new Date())).toMinutes();
        }
        // 合計時間（分）で与えられた場合の処理
        if (typeof firstArg === "number" && minute === undefined) {
            minutes = firstArg;
        }
        // Time オブジェクトを受け取った場合の処理
        if (firstArg instanceof Time) {
            minutes = firstArg.toMinutes();
        }
        // `HH:mm` の形式の文字列を受け取った場合
        // 時＋分 形式の生成を経由
        if (typeof firstArg === "string") {
            const [hour, minute] = firstArg.split(":").map(Number);
            minutes = (new Time(hour, minute)).toMinutes();
        }
        // Date オブジェクトを受け取った場合は、Dateオブジェクトから時刻を抽出
        // 時＋分 形式の生成を経由
        if (firstArg instanceof Date) {
            minutes = (new Time(firstArg.getHours(), firstArg.getMinutes())).toMinutes();
        }
        // 時＋分 で与えられた場合の処理
        // 最もベースとなる定義方法で, 他の定義のほとんどはここを経由して初期化する
        if (typeof firstArg === "number" && typeof minute === "number") {
            minutes = firstArg * 60 + minute;
        }

        // 引数に不正な型の値が与えられた場合のエラーチェック処理
        if (minutes === undefined) throw new Error("Invalid argument type.");

        this._hour = Math.floor(minutes / 60);
        this._minute = minutes % 60;
    }

    /**
     * 時刻を `HH:mm` の形で表した文字列に変換する.
     * 
     * @param zeroPadding ゼロ埋めをするかどうか. デフォルトで `true`.
     * @returns 時刻を `HH:mm` の形で表した文字列
     */
    public toString(zeroPadding = true): string {
        let h = String(this._hour);
        let m = String(this._minute);
        if (zeroPadding) {
            h = h.padStart(2, '0');
            m = m.padStart(2, '0');
        }
        return `${h}:${m}`
    }

    /**
     * 時刻を分単位に変換した数値を返す.
     * @returns 時間（分）
     */
    public toMinutes(): number {
        return this._hour * 60 + this._minute;
    }

    /**
     * 指定の時刻を足した時刻を返す.
     * 
     * 元の `Time` オブジェクトは変更されない.
     * @param time 時刻
     */
    public add(time: Time): Time;
    /**
     * 指定の時刻（分）を足した時刻を返す.
     * 
     * 元の `Time` オブジェクトは変更されない.
     * @param time 時刻
     */
    public add(minute: number): Time;
    public add(a: Time | number): Time {
        const addedMinute = typeof a === "number" ? a : (a as Time).toMinutes();
        return new Time(this.toMinutes() + addedMinute);
    };

    /**
     * 指定の時刻を引いた時刻を返す.
     * 
     * 元の `Time` オブジェクトは変更されない.
     * @param time 時刻
     */
    public subtract(time: Time): Time;
    /**
     * 指定の時刻（分）を引いた時刻を返す.
     * 
     * 元の `Time` オブジェクトは変更されない.
     * @param time 時刻（分）
     */
    public subtract(minute: number): Time;
    public subtract(a: Time | number): Time {
        const subtractedMinute = typeof a === "number" ? a : (a as Time).toMinutes();
        return this.add(-subtractedMinute);
    };

    get hour(): number { return this._hour; }
    set hour(hour: number) {
        if (!(0 <= hour)) throw new Error("hour must be greater than or equal to 0."); 
        this._hour = hour; 
    }
    get minute(): number { return this._minute; }
    set minute(minute: number) {
        if (minute < 0 || minute > 59) throw new Error("minute must be between 0 and 59."); 
        this._minute = minute; 
    }
}