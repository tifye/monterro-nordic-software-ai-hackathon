import { NavLink, Outlet } from "react-router-dom";
import useAuth from "../utils/useAuth";
import React, { useEffect } from "react";

export default function Sidebar() {
  const { userInfo } = useAuth();
  const [avatarUrl, setAvatarUrl] = React.useState<string>("");

  useEffect(() => {
    if (!userInfo) return
    const avatarUrl = `https://ui-avatars.com/api/?name=${userInfo.given_name}+${userInfo.family_name}&background=171717&color=fff`;
    setAvatarUrl(avatarUrl);
  }, [userInfo]);

  return (
    <>
      <div className="grid grid-cols-12 min-h-svh">
        <section className="col-span-2 bg-neutral-900 h-full">
          <menu className="menu p-4 text-white gap-2">
            <li>
              <NavLink to="/onboarding">
                <h2 className="text-xl">On Boarding</h2>
              </NavLink>
            </li>
            <li>
              <NavLink to="/schedule">
                <h2 className="text-xl">Schedule</h2>
              </NavLink>
            </li>
            <li>
              <NavLink to="/employees">
                <h2 className="text-xl">Employees</h2>
              </NavLink>
            </li>
            <li>
              <NavLink to="/employee/add">
                <h2 className="pl-2 text-lg">Add Employee</h2>
              </NavLink>
            </li>
          </menu>
        </section>
        <div className="bg-neutral-100 col-span-10 px-16 h-full">
          <section className="w-full py-8 border-b-2 border-neutral-500 flex flex-row-reverse text-neutral-900">
            {userInfo && (
              <div className="grid grid-flow-col gap-4 content-center">
                <img src={avatarUrl} alt="avatar" className="w-10 h-10 rounded-sm" />
                <span className="text-lg inline-block self-center">{userInfo.given_name} {userInfo.family_name}</span>
              </div>
            )}
          </section>
          <main className="py-12">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}