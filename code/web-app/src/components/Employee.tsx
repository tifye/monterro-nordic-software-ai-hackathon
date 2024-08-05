import { useNavigate, useParams } from "react-router-dom"
import config from "../config"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Employee, getAvatarUrl } from "./Employees"
import { SVGProps } from "react"
import { getEmployeeAvailability, WeekAvailability } from "../api/availability"
import React from "react"
import { formatShiftTime } from "../api/timetable"

const generateBgColor = (availability: string) => {
  if (availability === "available") {
    return "bg-green-400 border-green-600 hover:bg-green-100";
  } else if (availability === "partial") {
    return "bg-yellow-200 border-yellow-600 hover:bg-yellow-100";
  } else if (availability === "unavailable") {
    return "bg-gray-200 border-gray-600 hover:bg-gray-100";
  }
};

const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};


const generateDateContent = (day: any) => {
  if (
    day.availability === "available" ||
    day.availability === "unavailable"
  ) {
    return "All day";
  } else if (day.availability === "partial") {
    return `${day.from.slice(11, 16)} - ${day.to.slice(11, 16)}`;
  } else {
    return "";
  }
};

async function getEmployee(email: string): Promise<Employee> {
  const url = `${config.api_base_url}employee/${email}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }

  return res.json()
}


export function MaterialSymbolsChevronLeftRounded(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="currentColor" d="m10.8 12l3.9 3.9q.275.275.275.7t-.275.7t-.7.275t-.7-.275l-4.6-4.6q-.15-.15-.212-.325T8.425 12t.063-.375t.212-.325l4.6-4.6q.275-.275.7-.275t.7.275t.275.7t-.275.7z"></path></svg>
  )
}

export function MaterialSymbolsChevronRightRounded(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M12.6 12L8.7 8.1q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l4.6 4.6q.15.15.213.325t.062.375t-.062.375t-.213.325l-4.6 4.6q-.275.275-.7.275t-.7-.275t-.275-.7t.275-.7z"></path></svg>
  )
}

async function removeEmployee(email: string): Promise<void> {
  const url = `${config.api_base_url}employee/${email}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
}

export default function EmployeePage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [clickedWeekDate, setClickedWeekDate] = React.useState("");

  function showModal(date: string) {
    console.log("meep", date)
    setClickedWeekDate(date);
    setModalOpen((pre) => !pre);
  }

  const { email } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const removeMutation = useMutation({
    mutationFn: removeEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employees'],
      })
      // navigate back to employees page
      navigate('/employees', { replace: true })
    },
  })
  const { isLoading, isError, data } = useQuery({
    queryKey: ['employee', email],
    queryFn: () => getEmployee(email!),
  })
  const avaQuery = useQuery({
    queryKey: ['employee', email, 'availability'],
    queryFn: () => getEmployeeAvailability(email!),
  })
  const [showingFromWeekIdx, setShowingFromWeekIdx] = React.useState(0)
  const [curWeeks, setCurWeeks] = React.useState<[string, WeekAvailability][]>([])

  React.useEffect(() => {
    if (!avaQuery.data) {
      return
    }

    const weeks = Object.entries(avaQuery.data.weeks)
    setCurWeeks(weeks.slice(showingFromWeekIdx, showingFromWeekIdx + 4))
  }, [avaQuery.data, showingFromWeekIdx])

  console.log(JSON.stringify(curWeeks))

  return (
    <>
      {modalOpen && <Modal modalState={setModalOpen} email={email} getDate={() => clickedWeekDate} />}
      {isLoading && <p>Loading ...</p>}
      {isError && <p>Something went wrong</p>}
      {data && (
        <>
          <div className="flex flex-row w-full gap-12 h-36 text-neutral-900 mb-12">
            <img src={getAvatarUrl(data.name)} alt="avatar" className="h-36 aspect-square rounded-sm" />
            <div className="flex flex-row w-1/3 bg-neutral-200 p-10">
              <div>
                <h2 className="text-2xl text-neutral-900 justify-self-end">{data.name}</h2>
                <p className="">{data.email}</p>
                <p>
                  <span className="text-neutral-400">Emergency: &#160;</span>
                  {data.emergencyContact}
                </p>
              </div>
              <div className="grow"></div>
              <div className="">
                <p className=" text-end">{data.dateOfBirth}</p>
                <p className=" text-end">{data.address}</p>
              </div>
            </div>
            <span className="grow"></span>
            <div>
              <button onClick={() => removeMutation.mutate(email!)} className="bg-red-500 text-white hover:bg-red-700 text-lg p-2 rounded-sm h-min">Remove Employee</button>
              {removeMutation.isPending && <span className="loading loading-spinner"></span>}
              {removeMutation.isError && <p>Something went wrong</p>}
            </div>
          </div>

          {avaQuery.isLoading && <p>Loading ...</p>}
          {avaQuery.isError && <p>Error</p>}
          {avaQuery.data && (
            <>
              <div className="w-full py-2 mb-2 border-b-2 border-neutral-500 flex flex-row items-center text-neutral-900 text-2xl">
                <span>August 2024</span>
                <span className="grow"></span>
                <button className="text-4xl"><MaterialSymbolsChevronLeftRounded /></button>
                <button className="text-4xl"><MaterialSymbolsChevronRightRounded /></button>
              </div>
              <div className="grid grid-flow-row gap-4">
                <div className="grid grid-cols-8 text-xl gap-4 *:h-min mt-8 mb-4">
                  <div></div>
                  <div className="h-min">Monday</div>
                  <div className="h-min">Tuesday</div>
                  <div className="h-min">Wednesday</div>
                  <div className="h-min">Thursday</div>
                  <div className="h-min">Friday</div>
                  <div className="h-min">Saturday</div>
                  <div className="h-min">Sunday</div>
                </div>
                {curWeeks.map((week) => (
                  <div key={week[1].weekStr} className="text-neutral-900">
                    <div className="grid grid-cols-8 gap-4">
                      <div className="text-xl">{week[1].weekStr}</div>
                      <div
                        className={`${generateBgColor(
                          week[1].monday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border rounded-sm cursor-pointer`}
                        onClick={() => showModal(week[0])}
                      >
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].monday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].monday)}
                        </p>
                      </div>
                      <div
                        onClick={() => showModal(week[0])}
                        className={`${generateBgColor(
                          week[1].tuesday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border border-green-600 rounded-sm cursor-pointer`}
                      >
                        {" "}
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].tuesday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].tuesday)}
                        </p>
                      </div>
                      <div
                        onClick={() => showModal(week[0])}
                        className={`${generateBgColor(
                          week[1].wednesday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border border-green-600 rounded-sm cursor-pointer`}
                      >
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].wednesday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].wednesday)}
                        </p>
                      </div>
                      <div
                        onClick={() => showModal(week[0])}
                        className={`${generateBgColor(
                          week[1].thursday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border border-green-600 rounded-sm cursor-pointer`}
                      >
                        {" "}
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].thursday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].thursday)}
                        </p>
                      </div>
                      <div
                        onClick={() => showModal(week[0])}
                        className={`${generateBgColor(
                          week[1].friday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border border-green-600 rounded-sm cursor-pointer`}
                      >
                        {" "}
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].friday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].friday)}
                        </p>
                      </div>
                      <div
                        onClick={() => showModal(week[0])}
                        className={`${generateBgColor(
                          week[1].saturday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border border-green-600 rounded-sm cursor-pointer`}
                      >
                        {" "}
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].saturday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].saturday)}
                        </p>
                      </div>
                      <div
                        onClick={() => showModal(week[0])}
                        className={`${generateBgColor(
                          week[1].sunday.availability
                        )} flex items-start justify-start flex-col w-36 px-3 py-4 border border-green-600 rounded-sm cursor-pointer`}
                      >
                        <p className="text-md font-semibold">
                          {capitalizeFirstLetter(week[1].sunday.availability)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {generateDateContent(week[1].sunday)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}


type MeepInput = {
  email: string
  availability: any
  weekDate: string
}

async function updateEmployeeAvailability(input: MeepInput): Promise<void> {
  const url = `${config.api_base_url}employee/${input.email}/availability/${input.weekDate}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ availability: input.availability }),
  })
  console.log(input)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
}

export function Modal({ modalState, email, getDate }: any) {
  const navigate = useNavigate();
  const querylient = useQueryClient();
  const avaMutation = useMutation({
    mutationFn: updateEmployeeAvailability,
    onError: (error) => {
      modalState((pre: any) => !pre)
    },
    onSuccess: () => {
      querylient.invalidateQueries({
        queryKey: ['employee', 'availability'],
      });
      modalState((pre: any) => !pre)
      navigate(`/employee/${email}`);
    },
  })
  const [availability, setAvailability] = React.useState("available");
  const [to, setTo] = React.useState("08:00");
  const [from, setFrom] = React.useState("16:00");

  const handleAvailabilityChange = (event: any) => {
    setAvailability(event.target.value);
  };

  const handleFromChange = (event: any) => {
    setFrom(event.target.value);
  };

  const handleToChange = (event: any) => {
    setTo(event.target.value);
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();

    const result =
      availability === "partial"
        ? {
          availability: availability,
          to: to,
          from: from,
        }
        : { availability: availability };
    console.log(result);
    console.log(getDate())
    avaMutation.mutate({ email: email, availability: result, weekDate: getDate() });
    return result;
  };

  return (
    <div className="bg-slate-50 shadow-sm z-50 w-[20%] rounded-sm p-8 flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <MaterialSymbolsCloseSmallOutlineRounded
        onClick={() => modalState((pre: any) => !pre)}
        className="left-2 top-2 w-8 h-8 cursor-pointer"
      />
      <form
        className="flex flex-col items-start gap-5 justify-start w-full px-6 font-semibold"
        onSubmit={handleSubmit}
      >
        <div className="flex justify-between items-center gap-4 w-full">
          <label>Availability: </label>
          <select
            className="bg-slate-100 p-1 font-semibold w-[50%] rounded-md"
            value={availability}
            onChange={handleAvailabilityChange}
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="partial">Partial</option>
          </select>
        </div>
        {availability === "partial" && (
          <>
            <div className="flex justify-between items-center gap-5 w-full">
              <label>From: </label>
              <select
                className="bg-slate-100 p-1 font-semibold w-[50%] rounded-md"
                value={from}
                onChange={handleFromChange}
              >
                <option value="00:00">00:00</option>
                <option value="00:30">00:30</option>
                <option value="01:00">01:00</option>
                <option value="01:30">01:30</option>
                <option value="02:00">02:00</option>
                <option value="02:30">02:30</option>
                <option value="03:00">03:00</option>
                <option value="03:30">03:30</option>
                <option value="04:00">04:00</option>
                <option value="04:30">04:30</option>
                <option value="05:00">05:00</option>
                <option value="05:30">05:30</option>
                <option value="06:00">06:00</option>
                <option value="06:30">06:30</option>
                <option value="07:00">07:00</option>
                <option value="07:30">07:30</option>
                <option value="08:00">08:00</option>
                <option value="08:30">08:30</option>
                <option value="09:00">09:00</option>
                <option value="09:30">09:30</option>
                <option value="10:00">10:00</option>
                <option value="10:30">10:30</option>
                <option value="11:00">11:00</option>
                <option value="11:30">11:30</option>
                <option value="12:00">12:00</option>
                <option value="12:30">12:30</option>
                <option value="13:00">13:00</option>
                <option value="13:30">13:30</option>
                <option value="14:00">14:00</option>
                <option value="14:30">14:30</option>
                <option value="15:00">15:00</option>
                <option value="15:30">15:30</option>
                <option value="16:00">16:00</option>
                <option value="16:30">16:30</option>
                <option value="17:00">17:00</option>
                <option value="17:30">17:30</option>
                <option value="18:00">18:00</option>
                <option value="18:30">18:30</option>
                <option value="19:00">19:00</option>
                <option value="19:30">19:30</option>
                <option value="20:00">20:00</option>
                <option value="20:30">20:30</option>
                <option value="21:00">21:00</option>
                <option value="21:30">21:30</option>
                <option value="22:00">22:00</option>
                <option value="22:30">22:30</option>
                <option value="23:00">23:00</option>
                <option value="23:30">23:30</option>
              </select>
            </div>
            <div className="flex justify-between items-center gap-5 w-full">
              <label>To: </label>
              <select
                className="bg-slate-100 p-1 font-semibold w-[50%] rounded-md"
                value={to}
                onChange={handleToChange}
              >
                <option value="00:00">00:00</option>
                <option value="00:30">00:30</option>
                <option value="01:00">01:00</option>
                <option value="01:30">01:30</option>
                <option value="02:00">02:00</option>
                <option value="02:30">02:30</option>
                <option value="03:00">03:00</option>
                <option value="03:30">03:30</option>
                <option value="04:00">04:00</option>
                <option value="04:30">04:30</option>
                <option value="05:00">05:00</option>
                <option value="05:30">05:30</option>
                <option value="06:00">06:00</option>
                <option value="06:30">06:30</option>
                <option value="07:00">07:00</option>
                <option value="07:30">07:30</option>
                <option value="08:00">08:00</option>
                <option value="08:30">08:30</option>
                <option value="09:00">09:00</option>
                <option value="09:30">09:30</option>
                <option value="10:00">10:00</option>
                <option value="10:30">10:30</option>
                <option value="11:00">11:00</option>
                <option value="11:30">11:30</option>
                <option value="12:00">12:00</option>
                <option value="12:30">12:30</option>
                <option value="13:00">13:00</option>
                <option value="13:30">13:30</option>
                <option value="14:00">14:00</option>
                <option value="14:30">14:30</option>
                <option value="15:00">15:00</option>
                <option value="15:30">15:30</option>
                <option value="16:00">16:00</option>
                <option value="16:30">16:30</option>
                <option value="17:00">17:00</option>
                <option value="17:30">17:30</option>
                <option value="18:00">18:00</option>
                <option value="18:30">18:30</option>
                <option value="19:00">19:00</option>
                <option value="19:30">19:30</option>
                <option value="20:00">20:00</option>
                <option value="20:30">20:30</option>
                <option value="21:00">21:00</option>
                <option value="21:30">21:30</option>
                <option value="22:00">22:00</option>
                <option value="22:30">22:30</option>
                <option value="23:00">23:00</option>
                <option value="23:30">23:30</option>
              </select>
            </div>
          </>
        )}

        <button type="submit" className="submitButton">
          Answer
        </button>
      </form>
    </div>
  );
}

export function MaterialSymbolsCloseSmallOutlineRounded(
  props: SVGProps<SVGSVGElement>
) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="m12 13.4l-2.9 2.9q-.275.275-.7.275t-.7-.275t-.275-.7t.275-.7l2.9-2.9l-2.9-2.875q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l2.9 2.9l2.875-2.9q.275-.275.7-.275t.7.275q.3.3.3.713t-.3.687L13.375 12l2.9 2.9q.275.275.275.7t-.275.7q-.3.3-.712.3t-.688-.3z"
      ></path>
    </svg>
  );
}
