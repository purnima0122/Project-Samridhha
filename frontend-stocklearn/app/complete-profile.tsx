import { Redirect } from "expo-router";

export default function CompleteProfileRedirect() {
  return <Redirect href={"/profile-setup" as any} />;
}

