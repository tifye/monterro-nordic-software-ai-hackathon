import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
} from 'react-router-dom'
import Sidebar from "./components/Sidebar"
import useAuth, { login, logout, logout2 } from './utils/useAuth'
import AuthCallback from './components/AuthCallback'
import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev'
import Anonymous from './components/Anonymous'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Employees from './components/Employees'
import AddEmployee from './components/AddEmployee'
import EmployeePage from './components/Employee'
import { ScheduleOverview } from './components/ScheduleOverview'
import { OnBoarding } from './components/OnBoarding'

const isDev = process.env.NODE_ENV === 'development'

const queryClient = new QueryClient()

function LoadingLoginState() {
  return <div>Waiting for login state info ...</div>
}

function LoadingUserInfo() {
  return <div>Waiting for user info ...</div>
}

function LoggingOut() {
  return <div>Logging out ...</div>
}

function Mino() {
  const { getLoginStateComplete, isLoggedIn, csrf, userInfo, isLoggingOut } =
    useAuth()

  if (isLoggingOut) return <LoggingOut />
  if (!getLoginStateComplete) return <LoadingLoginState />
  if (!isLoggedIn) return <Anonymous login={login} />
  if (!userInfo) return <LoadingUserInfo />
  if (!csrf) throw new Error('No csrf!')

  return <Sidebar />
}

export default function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/*" element={<Mino />}>
          <Route index element={<button onClick={logout2}>logout</button>} />
          <Route path="schedule" element={<ScheduleOverview />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employee/add" element={<AddEmployee />} />
          <Route path="employee/:email" element={<EmployeePage />} />
          <Route path="onboarding" element={<OnBoarding />} />
        </Route>
      </>,
    ),
  )
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </>
  )
}

if (isDev) {
  loadDevMessages()
  loadErrorMessages()
}
