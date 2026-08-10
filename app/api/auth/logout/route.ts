import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName } from "../../../auth";

export const runtime = "nodejs";

export async function POST() {
  (await cookies()).set(sessionCookieName(), "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  redirect("/login");
}
