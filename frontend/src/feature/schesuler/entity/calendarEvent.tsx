import { v4 as uuidv4 } from "uuid";

import type { CalendarEventApi } from "../types/api";
import type { ScheduleKind } from "../types/statics";
import { nextDate } from "@/utils/date";
import { fromDateString, fromDateTimeString } from "@/utils/date";

/**
 * カレンダーイベントに必要な情報を持つデータクラス.  
 * `kind` の値によって安全に日付情報を保持できるよう設計されている.  
 */
class CalendarEvent {
    private _id: number;
    private _clientId: string;
    private _scheduleId?: number;
    private _kind: ScheduleKind;
    private _startAt?: Date;
    private _endAt?: Date;
    private _startDate?: Date;
    private _endDate?: Date;
    title: string;
    color: string;
    memo?: string;

    constructor(
        id: number,
        kind: ScheduleKind,
        startAt: Date,
        endAt: Date,
        title: string,
        color: string,
        scheduleId?: number,
        memo?: string | null,
        clientId?: string,
    );
    constructor(
        id: number,
        kind: ScheduleKind,
        startDate: Date,
        endDate: Date,
        title: string,
        color: string,
        scheduleId?: number,
        memo?: string | null,
        clientId?: string,
    );
    constructor(
        id: number,
        kind: ScheduleKind,
        startAtOrDate: Date,
        endAtOrDate: Date,
        title: string,
        color: string,
        scheduleId?: number,
        memo?: string | null,
        clientId?: string
    ){
        this._id = id;
        this._clientId = clientId || uuidv4();
        this._kind = kind;
        this.title = title;
        this.color = color;
        this._scheduleId = scheduleId;
        this.memo = memo || undefined;

        switch (kind) {
            case "DATED":
                this._startAt = startAtOrDate;
                this._endAt = endAtOrDate;
                break;
            case "ALL_DAY":
                this._startDate = startAtOrDate;
                this._endDate = endAtOrDate;
                break;
            default:
                throw new Error(`"kind", ${kind}, value is invalid.`);
        }
    }

    get id(){
        return this._id;
    }

    get clientId(){
        return this._clientId;
    }

    get scheduleId(){
        return this._scheduleId;
    }

    get kind(){
        return this._kind;
    }

    /**
     * `SchedulerKind` の値を変更したとき, 値によって `**At` と `**Date` の値を入れ替える.
     */
    set kind(kind: ScheduleKind){
        this._kind = kind;
        switch (kind) {
            case "DATED":
                this._startAt = this._startAt || this._startDate;
                this._endAt = this._endAt || this._endDate;
                this._startDate = undefined;
                this._endDate = undefined;
                break;
            case "ALL_DAY":
                this._startDate = this._startAt || this._startDate;
                this._endDate = this._endAt || this._endDate;
                this._startAt = undefined;
                this._endAt = undefined;
                break;
        }
    }

    get startAt(): Date | undefined { return this._startAt; }
    
    set startAt(startAt: Date) { 
        if (this._kind != "DATED") throw new Error(`A ${this._kind} schedule cannot set 'startAt'.`);
        this._startAt = startAt;
    }

    get endAt(): Date | undefined { return this._endAt; }

    set endAt(endAt: Date) { 
        if (this._kind != "DATED") throw new Error(`A ${this._kind} schedule cannot set 'endAt'.`);
        this._endAt = endAt;
    }

    get startDate(): Date | undefined { return this._startDate }

    set startDate(startDate: Date){
        if (this._kind != "ALL_DAY") throw new Error(`A ${this._kind} schedule cannot set 'startDate'.`);
        this._startDate = startDate;
    }

    get endDate(): Date | undefined { return this._endDate }

    set endDate(endDate: Date){
        if (this._kind != "ALL_DAY") throw new Error(`A ${this._kind} schedule cannot set 'endDate'.`);
        this._endDate = endDate;
    }

    /**
     * APIから受け取ったデータをもとに `CalendarEvent` オブジェクトを作成するマッパー関数.
     * @param api APIから受け取ったオブジェクト
     * @returns 作成した `CalendarEvent` オブジェクト
     */
    static createFromApiObject(api: CalendarEventApi){
        const s = api.kind === "ALL_DAY" ? api.startDate : api.startAt;
        const e = api.kind === "ALL_DAY" ? api.endDate : api.endAt;
        if (!s) throw new Error("'startAt' or 'startDate' value is invalid.");
        if (!e) throw new Error("'endAt' or 'endDate' value is invalid.");
        return new CalendarEvent(
            api.id,
            api.kind,
            api.kind === "ALL_DAY" ? fromDateString(s) : fromDateTimeString(s),
            api.kind === "ALL_DAY" ? fromDateString(e) : fromDateTimeString(e),
            api.title,
            api.color,
            api.scheduleId || undefined,
            api.memo || undefined,
        );
    }

    /**
     * `FullCalendar` で使用するイベントオブジェクトに変換した連想配列を生成するメソッド.
     * @returns `FullCalendar` で使用するイベント形式にフォーマットした連想配列
     */
    toEventLabel(){
        const s = this._startAt || this._startDate;
        const e = this._endAt || this._endDate;
        if (!s) throw new Error("Both 'startAt' and 'startDate' are undefined");
        if (!e) throw new Error("Both 'endAt' and 'endDate' are undefined");
        
        return {
            id: this.clientId,
            title: this.title,
            allDay: this.kind == "ALL_DAY",
            start: s,
            // Fullcalendarの終了日時は、指定日の翌日を指定する仕様
            end: this.kind == "ALL_DAY" ? nextDate(e) : e,
            borderColor: this.color,
            textColor: this.color,
        }
    }

    clone(): CalendarEvent {
        return new CalendarEvent(
            this.id,
            this.kind,
            this.startAt || this.startDate || new Date(),
            this.endAt || this.endDate || new Date(),
            this.title,
            this.color,
            this.scheduleId,
            this.memo,
            this.clientId,
        );
    }
}

export default CalendarEvent;