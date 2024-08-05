import { useMutation, useQuery } from '@tanstack/react-query'
import {
  formatShiftTime,
  getTimetableForNext12Months,
  TTReuslt,
  Week,
} from '../api/timetable'
import React from 'react'
import {
  MaterialSymbolsChevronLeftRounded,
  MaterialSymbolsChevronRightRounded,
} from './Employee'
import { zodResponseFormat } from 'openai/helpers/zod'
import config from '../config'
import OpenAI from 'openai'
import { WeekAvailability } from '../api/availability'
import { z } from 'zod'
import { getAvatarUrl } from './Employees'

const openai = new OpenAI({
  apiKey: config.openai_key,
  dangerouslyAllowBrowser: true,
})

type EmployeesWeekAvailability = {
  Weeks: { [key: string]: WeekAvailability }
}

type MeepInput = {
  schedule: Week
  employees: EmployeesWeekAvailability
  weekDate: string
}



async function createScheduleForWeek(date: string, schedule: any): Promise<void> {
  const url = `${config.api_base_url}business/schedule/${date}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schedule }),
  })

  console.log(JSON.stringify({ schedule }))
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
}

type ShiftSchedule = {
  from: string
  to: string
  employees: string[]
}
type DaySchedule = {
  shifts: ShiftSchedule[]
}
type WeekSchedule = {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}


async function getScheduleForWeek(date: string): Promise<WeekSchedule> {
  const url = `${config.api_base_url}business/schedule/${date}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
  return res.json()
}

async function meep(input: MeepInput): Promise<void> {
  const Shifts = z.object({
    from: z.string(),
    to: z.string(),
    employees: z.array(z.string()),
  })

  const Output = z.object({
    monday: z.object({
      shifts: z.array(Shifts),
    }),
    tuesday: z.object({
      shifts: z.array(Shifts),
    }),
    wednesday: z.object({
      shifts: z.array(Shifts),
    }),
    thursday: z.object({
      shifts: z.array(Shifts),
    }),
    friday: z.object({
      shifts: z.array(Shifts),
    }),
    saturday: z.object({
      shifts: z.array(Shifts),
    }),
    sunday: z.object({
      shifts: z.array(Shifts),
    }),
  })

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'system',
        content:
          'Extract the current employees and their preferred times to work. If the key availability is set to available, then the employee can work any day that day. If the value is partial, they can only work the times in the from and to date.',
      },
      {
        role: 'user',
        content: JSON.stringify(input.employees),
      },
      {
        role: 'system',
        content:
          'From the employees extracted, input them into the schedule that is provided. The amount of employees can not exceed the requiredEmployees.',
      },
      {
        role: 'user',
        content: JSON.stringify(input.schedule),
      },
    ],
    response_format: zodResponseFormat(Output, 'event'),
  })
  const event = completion.choices[0].message
  console.log(event.parsed)

  await createScheduleForWeek(input.weekDate, event.parsed)
}

async function getAllEmployeesWeekAvailability(
  date: Date,
): Promise<EmployeesWeekAvailability> {
  const url = `${config.api_base_url
    }employees/availability/week/${date.toLocaleDateString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
  return res.json()
}

export function ScheduleOverview() {
  const [curWeek, setCurWeek] = React.useState<Week>()
  const [curWeekIndex, setCurWeekIndex] = React.useState<number>(0)
  const [curWeekDate, setCurWeekDate] = React.useState<string>('')
  const curWeekScheduleQuery = useQuery<WeekSchedule>({
    queryKey: ['schedule', curWeekDate],
    queryFn: async () => {
      const data = await getScheduleForWeek(curWeekDate)
      return data
    },
  })
  const ttQuery = useQuery<TTReuslt>({
    queryKey: ['week-schedule', curWeekDate],
    queryFn: async () => {
      const data = await getTimetableForNext12Months(new Date())
      // first key is the current week
      const cwd = Object.keys(data.weeks)[curWeekIndex]
      setCurWeek(data.weeks[cwd])
      setCurWeekDate(cwd)
      return data
    },
  })
  const employeesWeekQuery = useQuery<EmployeesWeekAvailability>({
    queryKey: ['employeesWeek'],
    queryFn: async () => getAllEmployeesWeekAvailability(new Date()),
  })
  const generateMutation = useMutation({
    mutationFn: meep,
    onError: (error) => {
      console.error(error)
    },
    onSuccess: (data) => {
      console.log(data)
    },
  })

  console.log(curWeekScheduleQuery.data)

  return (
    <div className="text-neutral-900">
      <h1 className="text-4xl text-neutral-900 mb-12">Schedule Overview</h1>

      {ttQuery.isLoading && <p>Loading ...</p>}
      {ttQuery.isError && <p>Error</p>}
      {ttQuery.data && (
        <>
          <div className="flex flex-col">
            <div className="flex flex-row text-lg gap-4 mb-4">
              <span>{curWeekDate}</span>
              <span className="grow"></span>
              {curWeek && employeesWeekQuery.data && (
                <>
                  {generateMutation.isError && <p>Error</p>}
                  <button
                    onClick={() =>
                      generateMutation.mutate({
                        weekDate: curWeekDate,
                        schedule: curWeek!,
                        employees: employeesWeekQuery.data!,
                      })
                    }
                    className="to-sky-500 rounded-full text-white bg-gradient-to-tr from-green-500 text-lg p-2 px-4 hover:from-emerald-500 duration-150 transition-all hover:to-blue-500 h-min"
                  >
                    {generateMutation.isPending && 'Generating ...'}
                    {!generateMutation.isPending && 'Generate Employee Schedule'}
                  </button>
                </>
              )}
              <span>{curWeek?.weekStr}</span>
              <div className="text-3xl">
                <button>
                  <MaterialSymbolsChevronLeftRounded />
                </button>
                <button>
                  <MaterialSymbolsChevronRightRounded />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-4 border-b items-center border-neutral-700 pb-2 mb-4">
              <div>Monday</div>
              <div>Tuesday</div>
              <div>Wednesday</div>
              <div>Thursday</div>
              <div>Friday</div>
              <div>Saturday</div>
              <div>Sunday</div>
            </div>
            <div className="grid grid-cols-7 gap-4">
              <div id="monday" className="flex flex-col gap-2">
                {curWeek?.monday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
              <div id="tuesdays" className="flex flex-col gap-2">
                {curWeek?.tuesday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
              <div id="wednesday" className="flex flex-col gap-2">
                {curWeek?.wednesday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
              <div id="thursday" className="flex flex-col gap-2">
                {curWeek?.thursday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
              <div id="friday" className="flex flex-col gap-2">
                {curWeek?.friday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
              <div id="saturday" className="flex flex-col gap-2">
                {curWeek?.saturday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
              <div id="sunday" className="flex flex-col gap-2">
                {curWeek?.sunday.shifts.map((s) => (
                  <div
                    key={curWeekDate + s.from.toString()}
                    className="h-16 w-full flex flex-col bg-neutral-200 border border-neutral-700 p-2 rounded-sm"
                  >
                    <span>
                      {formatShiftTime(s.from)} - {formatShiftTime(s.to)}
                    </span>
                    <span>{s.requiredEmployees} employees needed</span>
                  </div>
                ))}
              </div>
            </div>


            {curWeekScheduleQuery.isLoading && <p>Loading ...</p>}
            {curWeekScheduleQuery.data && (
              <>
                <div className='grid grid-cols-7 gap-4 mt-8'>
                  <div>
                    {curWeekScheduleQuery.data.monday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>

                          ))}
                        </ul>
                      </>
                    ))}
                  </div>

                  <div>
                    {curWeekScheduleQuery.data.tuesday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>

                          ))}
                        </ul>
                      </>
                    ))}
                  </div>

                  <div>
                    {curWeekScheduleQuery.data.wednesday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>

                          ))}
                        </ul>
                      </>
                    ))}
                  </div>

                  <div>
                    {curWeekScheduleQuery.data.thursday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>

                          ))}
                        </ul>
                      </>
                    ))}
                  </div>

                  <div>
                    {curWeekScheduleQuery.data.friday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>

                          ))}
                        </ul>
                      </>
                    ))}
                  </div>

                  <div>
                    {curWeekScheduleQuery.data.saturday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>

                          ))}
                        </ul>
                      </>
                    ))}
                  </div>

                  <div>
                    {curWeekScheduleQuery.data.sunday.shifts.map((s) => (
                      <>
                        <ul className='flex flex-col gap-4'>
                          {s.employees.map((e) => (
                            <li className='w-full bg-neutral-200 border overflow-clip border-neutral-900 rounded-sm'>
                              <div className="flex flex-row h-26">
                                <img src={getAvatarUrl(e)} className='h-full aspect-square' alt="meep" />
                                <div className='h-26 w-full grow bg-neutral-900'></div>
                              </div>
                              <span className='block max-w-full text-ellipsis px-2 overflow-hidden'>{e}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </>
      )}
    </div>
  )
}
