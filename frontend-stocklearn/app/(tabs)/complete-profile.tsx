import { Redirect } from "expo-router";

export default function LegacyCompleteProfileRoute() {
  return <Redirect href={"/profile-setup" as any} />;
}

