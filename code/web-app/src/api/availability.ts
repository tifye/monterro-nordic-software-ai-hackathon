import config from '../config'

export type EmployeeAvailability = {
  weeks: { [key: string]: WeekAvailability }
}

export type WeekAvailability = {
  weekStr: string
  monday: DayAvailability
  tuesday: DayAvailability
  wednesday: DayAvailability
  thursday: DayAvailability
  friday: DayAvailability
  saturday: DayAvailability
  sunday: DayAvailability
}

export type DayAvailability = {
  date: string
  availability: Availability
  from: string | undefined
  to: string | undefined
}

export enum Availability {
  Available = 'available',
  Unavailable = 'unavailable',
  Partial = 'partial',
}

export async function getEmployeeAvailability(
  email: string,
): Promise<EmployeeAvailability> {
  const url = `${config.api_base_url}employee/${email}/availability`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }

  return res.json()
}
