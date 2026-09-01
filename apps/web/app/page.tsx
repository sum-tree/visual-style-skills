import { listPublicStyles } from "@visual-style/style-registry";
import { connection } from "next/server";
import { StyleStudio } from "@/components/style-studio";

export default async function HomePage() {
  await connection();
  return <StyleStudio styles={listPublicStyles()} />;
}
