import React from "react"
import { getAvatarUrl } from "./Employees"
import config from "../config"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

type AddEmployeesInput = {
  name: string
  email: string
  address: string
  emergencyContact: string
  dateOfBirth: string
}

async function addEmployee(input: AddEmployeesInput): Promise<void> {
  const url = `${config.api_base_url}employee`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
}

export default function AddEmployee() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { mutate, isError, isPending } = useMutation({
    mutationFn: addEmployee,
    onError: (error) => {
      console.error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', "employeesWeek"] })
      navigate('/employees', { replace: true })
    }
  })
  const [name, setName] = React.useState<string>('')
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const address = formData.get('address') as string
    const emergency = formData.get('emergency') as string
    const dob = formData.get('dob') as string
    console.log({ name, email, address, emergency, dob })

    mutate({ name, email, address, emergencyContact: emergency, dateOfBirth: dob })
  }
  return (
    <div className="text-neutral-900">
      <h1 className="text-4xl text-neutral-900 mb-12">
        Add an Employee
      </h1>

      {isError && <p>Error, please try again</p>}
      {isPending && <p>Adding employee ...</p>}

      <div className="h-24 aspect-square bg-neutral-900 mb-8">
        {name !== '' && (
          <img
            src={getAvatarUrl(name)}
            alt="avatar"
            className="h-24 aspect-square rounded-sm"
          />
        )}
      </div>

      <form onSubmit={handleSubmit} className="w-full sm:w-1/2">
        <div className="mb-5">
          <label htmlFor="name-input" className="block mb-2 font-medium text-lg">Name</label>
          <input
            type="text"
            id="name-input"
            name="name"
            className="border border-neutral-600 text-sm text-white rounded-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            autoComplete="name"
            required
            placeholder="John Doe"
            value={name}
            onInput={(e) => setName((old) => (e.target as any).value)}
          />
        </div>
        <div className="mb-5">
          <label htmlFor="email-input" className="block mb-2 font-medium text-lg">Email</label>
          <input
            type="text"
            id="email-input"
            name="email"
            className="border border-neutral-600 text-sm text-white rounded-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            autoComplete="email"
            required
            placeholder="john.doe@email.com"
          />
        </div>
        <div className="mb-5">
          <label htmlFor="address-input" className="block mb-2 font-medium text-lg">Address</label>
          <input
            type="text"
            id="address-input"
            name="address"
            className="border border-neutral-600 text-sm text-white rounded-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            autoComplete="address-level4"
            required
            placeholder="123 Main St, City, State, Zip"
          />
        </div>
        <div className="mb-5">
          <label htmlFor="emergency-input" className="block mb-2 font-medium text-lg">Emergency phone</label>
          <input
            type="text"
            id="emergency-input"
            name="emergency"
            className="border border-neutral-600 text-sm text-white rounded-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            autoComplete="mobile"
            required
            placeholder="123-456-7890"
          />
        </div>
        <div className="mb-5">
          <label htmlFor="dob-input" className="block mb-2 font-medium text-lg">Date of birth</label>
          <input
            type="text"
            id="dob-input"
            name="dob"
            className="border border-neutral-600 text-sm text-white rounded-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            autoComplete="bday-day"
            required pattern="\d{4}-\d{2}-\d{2}" placeholder="yyyy-mm-dd"
          />
        </div>

        <button
          type="submit"
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-sm"
        >
          Add Employee
        </button>
      </form>
    </div>
  )
}
