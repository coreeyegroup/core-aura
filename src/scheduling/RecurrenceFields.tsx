import { Plus } from "lucide-react";
import { maxScheduleTimes, type Frequency } from "./recurrence";

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurrenceFields({ frequency, setFrequency, days, setDays, times, setTimes,
  monthDay, setMonthDay, date, setDate }: {
  frequency: Frequency | "once";
  setFrequency: (value: Frequency | "once") => void;
  days: number[];
  setDays: (value: number[]) => void;
  times: string[];
  setTimes: (value: string[]) => void;
  monthDay: number;
  setMonthDay: (value: number) => void;
  date: string;
  setDate: (value: string) => void;
}) {
  return <>
      <label>Repeat
        <select value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}>
          <option value="daily">Daily</option><option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option><option value="once">One time</option>
        </select>
      </label>
      {frequency === "weekly" && <fieldset className="recurrence-wide"><legend>Days of week</legend>
        <div className="day-choices">{dayNames.map((name, index) => <label key={name}>
          <input type="checkbox" checked={days.includes(index)} onChange={event =>
            setDays(event.target.checked ? [...days, index].sort((a, b) => a - b) : days.filter(day => day !== index))} />{name}
        </label>)}</div>
      </fieldset>}
      {frequency === "monthly" && <label className="recurrence-wide">Day of month
        <input type="number" min={1} max={31} required value={Number.isNaN(monthDay) ? "" : monthDay}
          onChange={event => setMonthDay(event.target.valueAsNumber)} />
        {monthDay > 28 && <small>Months without this date are skipped.</small>}
      </label>}
      {frequency === "once" && <label className="recurrence-wide">Date
        <input type="date" required value={date} onChange={event => setDate(event.target.value)} />
      </label>}
      <fieldset className="recurrence-wide"><legend>{frequency === "once" ? "Time" : "Times of day"}</legend>
        <div className="schedule-times">
          {(frequency === "once" ? times.slice(0, 1) : times).map((time, index) => <div key={index} className="schedule-time">
            <input type="time" required aria-label={index ? "Reminder time " + (index + 1) : "Reminder time"} value={time}
              onChange={event => setTimes(times.map((value, i) => i === index ? event.target.value : value))} />
            {!index || frequency === "once" ? null : <button type="button" aria-label={"Remove time " + (index + 1)}
              onClick={() => setTimes(times.filter((_, i) => i !== index))}>−</button>}
          </div>)}
          {frequency !== "once" && <button type="button" disabled={times.length >= maxScheduleTimes}
            onClick={() => setTimes([...times, ""])}><Plus size={15} aria-hidden="true" /> Add time</button>}
        </div>
      </fieldset>
  </>;
}
