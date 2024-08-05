import React from 'react'
import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import config from '../config'
import "./OnBoarding.css"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'


async function setDefaultSchema(schema: any): Promise<void> {
  const url = `${config.api_base_url}business/timetable/default`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(schema),
  })
  if (!res.ok) {
    throw new Error('Network response was not ok')
  }
}


type ConverstaionEntry = {
  type: string
  content: string
}

const openai = new OpenAI({
  apiKey: config.openai_key,
  dangerouslyAllowBrowser: true,
})

export function OnBoarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const schemaMutation = useMutation({
    mutationFn: setDefaultSchema,
    onError: (error) => {
      console.error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      navigate("/schedule")
    }
  })

  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0)
  const [conversation, setConversation] = React.useState<ConverstaionEntry[]>(
    [],
  )
  const [userInput, setUserInput] = React.useState('')
  const [result, setResult] = React.useState<any>('')

  const defaultQuestions = [
    'What are your business hours?',
    'How many employees do you need per shift?',
    'Are there any special requirements for weekends?',
  ]

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault()

    // Add the current question and user's answer to the conversation
    setConversation((prev) => [
      ...prev,
      { type: 'question', content: defaultQuestions[currentQuestionIndex] },
      { type: 'answer', content: userInput },
    ])

    // Move to the next question
    setCurrentQuestionIndex((prev) => prev + 1)

    // Clear the input field
    setUserInput('')
  }

  const generateSchedule = async () => {
    const input = conversation
      .filter((item) => item.type === 'answer')
      .map((item) => item.content)
      .join(' ')

    const ShiftSchema = z.object({
      from: z.string(),
      to: z.string(),
      requiredEmployees: z.number(),
    })

    const DaySchema = z.object({
      shifts: z.array(ShiftSchema),
    })

    const CalendarEvent = z.object({
      monday: DaySchema,
      tuesday: DaySchema,
      wednesday: DaySchema,
      thursday: DaySchema,
      friday: DaySchema,
      saturday: DaySchema,
      sunday: DaySchema,
    })

    try {
      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content:
              'Extract the opening hours and how many will work per shift. When something is closed, it means there are no registered shifts that day. Put the shift with earliest opening hour first.',
          },
          {
            role: 'user',
            content: input,
          },
        ],
        response_format: zodResponseFormat(CalendarEvent, 'event'),

      })
      const event = completion.choices[0].message
      console.log(event)

      setResult(event)
      schemaMutation.mutate(event.parsed)
    } catch (error) {
      console.error('Error generating schedule:', error)
    }
  }

  React.useEffect(() => { }, [result])
  return (
    <>
      <div className="text-neutral-900">
        <h1 className="text-4xl text-neutral-900 mb-12">Onboarding</h1>
        {schemaMutation.isPending && <p>Setting schema...</p>}
        {schemaMutation.isError && <p>Error submitting, please try again</p>}

        <div className='grid grid-flow-row content-center max-h-[450px] overflow-y-scroll w-1/2 mx-auto'>
          <div className="flex flex-col gap-4">
            {conversation.map((item, index) => (
              <div key={index} className={`${item.type} px-8 py-4 rounded-full`}>
                <p>
                  {item.content ? item.content : 'Do you want to do any changes? If not, please click submit.'}
                </p>
              </div>
            ))}
            <div className={`question px-8 py-4 rounded-full`}>
              <p>
                {defaultQuestions[currentQuestionIndex]
                  ? defaultQuestions[currentQuestionIndex]
                  : 'Do you want to do any changes? If not, please click submit.'}
              </p>
            </div>
          </div>
        </div>
        <form
          className="flex flex-row justify-center gap-4 mt-12 w-1/2 mx-auto"
          onSubmit={handleSubmit}
        >
          <input
            className="input w-full rounded-full"
            placeholder="Type your answer here..."
            name="query"
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
          />
          <button type="submit" className="submitButton rounded-full">
            Answer{' '}
          </button>
          {currentQuestionIndex >= defaultQuestions.length && (
            <button className="submitButton rounded-full" onClick={generateSchedule}>
              Submit
            </button>
          )}
        </form>
      </div>
    </>
  )
}
