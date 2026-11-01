
export class DueDate {
    year: number;
    month: number;
    date: number;

    /**
     * コンストラクタ  
     * 指定がない場合は今日の日付を設定する
     * @param date 日付
     */
    constructor(date?: string | Date);
    /**
     * コンストラクタ
     * @param year 年
     * @param month 月
     * @param date 日
     */
    constructor(year: number, month: number, date: number);
    constructor(year_or_date?: number | string | Date, month?: number, day?: number) {
        let date: Date;
        if (!year_or_date) {
            date = new Date();
        } else if (typeof year_or_date === "string"){
            date = new Date(year_or_date);
        } else if (year_or_date instanceof Date) {
            date = year_or_date;
        } else {
            if (!month || !day) throw new Error("'month' and 'day' must be specified.");
            date = new Date(year_or_date, month - 1, day);
        }
        this.year = date.getFullYear();
        this.month = date.getMonth() + 1;
        this.date = date.getDate();
    }

    /**
     * 日付をまとめて設定する
     * @param date 日付
     */
    setDate(date: string | Date): void;
    /**
     * 日付をまとめて設定する
     * @param year 年
     * @param month 月
     * @param date 日
     */
    setDate(year: number, month: number, date: number): void;
    setDate(year_or_date: number | string | Date, month?: number, day?: number): void {
        this.constructor(year_or_date, month, day);
    }

    toString(): string{
        const month = this.month < 10 ? `0${this.month}` : `${this.month}`;
        const date = this.date < 10 ? `0${this.date}` : `${this.date}`;
        return `${this.year}-${month}-${date}`
    }

    /**
     * 表示用のテキストとしてフォーマットされた日付文字列を返す
     * @returns フォーマットされた文字列
     */
    toDisplayString(): string{
        return this.toString().replace(/-/g, "/");
    }
}

export class DueTime {
    hour: number;
    minute: number;

    /**
     * コンストラクタ  
     * 指定がない場合は 00:00 を設定する
     * @param time 時刻
     */
    constructor(time?: string);
    constructor(hour: number, minute: number, second: number);
    constructor(hour_or_time: number | string = "00:00", minute?: number) {
        if (typeof hour_or_time === "string"){
            const [hour, minute, ] = hour_or_time.split(":").map(Number);
            this.hour = hour;
            this.minute = minute;
            return;
        }
        if (!minute) throw new Error("'minute' must be specified.");
        this.hour = hour_or_time;
        this.minute = minute;
    }

    setTime(time: string): void;
    setTime(hour: number, minute: number): void;
    setTime(hour_or_time: number | string, minute?: number): void {
        this.constructor(hour_or_time, minute);
    }

    toString(): string{
        const h = this.hour < 10 ? `0${this.hour}` : `${this.hour}`;
        const m = this.minute < 10 ? `0${this.minute}` : `${this.minute}`;
        return `${h}:${m}`
    }
}