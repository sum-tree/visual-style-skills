import { listPublicStyles } from "@visual-style/style-registry";
import { StyleStudio } from "@/components/style-studio";

export default function HomePage() {
  return <StyleStudio styles={listPublicStyles()} />;
}
