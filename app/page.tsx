import Hub from "./hub";
import { getCurrentUser } from "./auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <Hub user={user} />;
}
