import config from '../config'

export type TTReuslt = {
  firstWeekDate: Date
  weeks: { [key: string]: Week }
}

export type Week = {
  monday: Day
  tuesday: Day
  wednesday: Day
  thursday: Day
  friday: Day
  saturday: Day
  sunday: Day
  weekStr: string
}

export type Day = {
  shifts: Shift[]
}

export type Shift = {
  from: string
  to: string
  requiredEmployees: number
}

export function formatShiftTime(t: string): string {
  // from 0000-01-01T08:00:00Z
  // to 08:00
  t = t.slice(11, 16)
  return t
}

export async function getTimetableForNext12Months(
  date: Date,
): Promise<TTReuslt> {
  const from = date
  const to = new Date(from)
  to.setFullYear(to.getFullYear() + 1)

  const url = `${
    config.api_base_url
  }business/timetable?from=${from.toLocaleDateString()}&to=${to.toLocaleDateString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }

  const data = await res.json()
  return data
}
