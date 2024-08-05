import { useQuery } from "@tanstack/react-query"
import config from "../config"
import { NavLink, useNavigate } from "react-router-dom"

export type Employee = {
  name: string
  email: string
  address: string
  dateOfBirth: string
  emergencyContact: string
}

export function getAvatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${name}&background=171717&color=fff`;
}

async function getEmployees(): Promise<Employee[]> {
  const url = `${config.api_base_url}employees`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }

  return res.json()
}

export default function Employees() {
  const navigate = useNavigate()
  const { isLoading, isError, data } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  })

  return (
    <>
      <h1 className="text-4xl text-neutral-900 mb-12 flex flex-row items-end">
        Manage Employees
        {data && data.length > 0 && (
          <span className="text-2xl text-neutral-400">, &#160; {data.length} employees</span>
        )}
        <span className="grow"></span>
        <NavLink to="/employee/add" className="bg-green-500 text-white hover:bg-green-700 text-lg p-2 rounded-sm">Add Employee</NavLink>
      </h1>

      {isLoading && <p>Loading ...</p>}
      {isError && <p>Error</p>}
      {data && data.length === 0 && (
        <>
          <p>No employees found</p>
        </>
      )}
      {data && data.length > 0 && (
        <>
          <ul className="grid grid-flow-row gap-4 text-neutral-900 w-full">
            {data.map((employee: Employee) => (
              <li key={employee.email} className="bg-neutral-200 gap-4 flex flex-row h-26 hover:opacity-80" onClick={() => navigate(`/employee/${employee.email}`)} role="button">
                <img src={getAvatarUrl(employee.name)} alt="avatar" className="s-26 rounded-sm" />
                <div className="py-4 flex flex-row w-1/3">
                  <div>
                    <h2 className="text-2xl text-neutral-900 justify-self-end">{employee.name}</h2>
                    <p className="">{employee.email}</p>
                    <p>
                      <span className="text-neutral-400">Emergency: &#160;</span>
                      {employee.emergencyContact}
                    </p>
                  </div>
                  <div className="grow"></div>
                  <div className="">
                    <p className=" text-end">{employee.dateOfBirth}</p>
                    <p className=" text-end">{employee.address}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}