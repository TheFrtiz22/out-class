import { useLocalSearchParams } from "expo-router";
import { ClubPageView } from "~/components/explore/club-page-view";

export default function ClubPage() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  return <ClubPageView id={typeof params.id === "string" ? params.id.trim() : ""} />;
}
